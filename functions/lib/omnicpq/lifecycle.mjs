import { lifecycleIssues } from '../../../public/OmniCPQ/lifecycle-validation.mjs';
// Private host validator for the keyword set in the pinned v15 schema.
// This is not a general JSON Schema engine or proof of business truth.
import { createHash } from 'node:crypto';
const digest = text => createHash('sha256').update(text).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (o, k) => Object.hasOwn(o, k);
const keywords = new Set(['$schema','$id','title','description','$defs','$ref','type','const','enum','required','properties','additionalProperties','items','minItems','maxItems','minLength','pattern','allOf','if','then','not']);
const types = { object, array: Array.isArray, string: v => typeof v === 'string', null: v => v === null,
  boolean: v => typeof v === 'boolean', number: v => typeof v === 'number' && Number.isFinite(v), integer: Number.isInteger };
const ref = (schema, path) => {
  if (typeof path !== 'string' || !path.startsWith('#/')) throw Error('Only local schema references are supported.');
  let node = schema;
  for (const key of path.slice(2).split('/').map(k => k.replaceAll('~1','/').replaceAll('~0','~'))) {
    if (!object(node) || !own(node, key)) throw Error('Unknown schema reference.'); node = node[key];
  }
  return node;
};
function checkSchema(node, root, depth = 0) {
  if (!object(node) || depth > 40) throw Error('Unsupported schema node.');
  for (const key of Object.keys(node)) if (!keywords.has(key)) throw Error('Unsupported schema keyword: ' + key);
  if (node.$ref) ref(root, node.$ref);
  if (node.type && !(Array.isArray(node.type) ? node.type : [node.type]).every(t => own(types, t))) throw Error('Unsupported schema type.');
  if (node.pattern) new RegExp(node.pattern);
  if (own(node, 'additionalProperties') && typeof node.additionalProperties !== 'boolean') throw Error('Unsupported additionalProperties.');
  for (const key of ['$defs','properties']) if (node[key]) for (const child of Object.values(node[key])) checkSchema(child, root, depth + 1);
  for (const key of ['items','if','then','not']) if (node[key]) checkSchema(node[key], root, depth + 1);
  if (node.allOf) { if (!Array.isArray(node.allOf)) throw Error('Invalid allOf.'); for (const child of node.allOf) checkSchema(child, root, depth + 1); }
}
function shape(value, node, root, issues, path = '$', depth = 0) {
  const add = message => { if (issues.length < 40) issues.push({ path, category: 'shape', message }); };
  if (depth > 50) { add('Preveč globoko gnezdenje.'); return; }
  if (issues.length >= 40) return;
  if (node.$ref) shape(value, ref(root, node.$ref), root, issues, path, depth + 1);
  if (node.type && !(Array.isArray(node.type) ? node.type : [node.type]).some(t => types[t](value))) { add('Napačen tip vrednosti.'); return; }
  if (own(node,'const') && value !== node.const) add('Vrednost se ne ujema s shemo.');
  if (node.enum && !node.enum.includes(value)) add('Vrednost ni na dovoljenem seznamu.');
  if (typeof value === 'string') {
    if (node.minLength !== undefined && [...value].length < node.minLength) add('Besedilo je prekratko.');
    if (node.pattern && !new RegExp(node.pattern).test(value)) add('Besedilo nima zahtevane oblike.');
  }
  if (object(value)) {
    for (const key of node.required || []) if (!own(value,key)) add('Manjka obvezno polje: ' + key);
    for (const key of Object.keys(value)) {
      if (node.properties && own(node.properties,key)) shape(value[key], node.properties[key], root, issues, path + '.' + key, depth + 1);
      else if (node.additionalProperties === false) add('Nedovoljeno dodatno polje: ' + key);
    }
  }
  if (Array.isArray(value)) {
    if (node.minItems !== undefined && value.length < node.minItems) add('Seznam ima premalo elementov.');
    if (node.maxItems !== undefined && value.length > node.maxItems) add('Seznam ima preveč elementov.');
    if (node.items) value.forEach((item, i) => shape(item, node.items, root, issues, `${path}[${i}]`, depth + 1));
  }
  for (const child of node.allOf || []) shape(value, child, root, issues, path, depth + 1);
  if (node.if) { const probe = []; shape(value, node.if, root, probe, path, depth + 1); if (!probe.length && node.then) shape(value, node.then, root, issues, path, depth + 1); }
  if (node.not) { const probe = []; shape(value, node.not, root, probe, path, depth + 1); if (!probe.length) add('Vrednost je izrecno izključena.'); }
}
function graph(data, issues) {
  const add = (path, message) => { if (issues.length < 40) issues.push({ path, category: 'reference', message }); };
  const ids = (rows, field, name) => {
    const map = new Map();
    for (const [i,row] of rows.entries()) { if (map.has(row[field])) add(`$.${name}[${i}].${field}`, 'Podvojen ID.'); map.set(row[field],row); }
    return map;
  };
  const sources = ids(data.sources,'source_id','sources'), requirements = ids(data.requirements,'requirement_id','requirements');
  const tests = ids(data.tests || [],'test_id','tests');
  const links = (values, map, path) => values.forEach((id, i) => { if (!map.has(id)) add(`${path}[${i}]`, 'ID se ne nanaša na obstoječ zapis.'); });
  data.requirements.forEach((r,i) => links(r.source_ids,sources,`$.requirements[${i}].source_ids`));
  (data.tests || []).forEach((t,i) => {
    links(t.requirement_ids,requirements,`$.tests[${i}].requirement_ids`);
    links(t.expected_result.source_ids,sources,`$.tests[${i}].expected_result.source_ids`);
  });
  (data.coverage || []).forEach((c,i) => {
    links([c.requirement_id],requirements,`$.coverage[${i}].requirement_id`); links(c.test_ids,tests,`$.coverage[${i}].test_ids`);
    c.test_ids.forEach(id => { if (tests.has(id) && !tests.get(id).requirement_ids.includes(c.requirement_id)) add(`$.coverage[${i}]`, 'Test ni povezan z navedeno zahtevo.'); });
  });
  for (const [key,state] of Object.entries(data.lifecycle_states || {})) links(state.source_ids,sources,`$.lifecycle_states.${key}.source_ids`);
}
export function validateLifecycleAnswer(text, schema, schemaSha256) {
  const result = { state: 'ABSENT', schemaSha256, contentSha256: digest(typeof text === 'string' ? text : ''), issues: [] };
  const problem = (category, message) => { result.state = 'INVALID'; result.issues.push({ path: '$', category, message }); return result; };
  try {
    if (typeof text !== 'string' || text.length > 200_000) return problem('input','Odgovor ni primeren za pregled.');
    const blocks = [...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/gi)].map(m => m[1]);
    if (!blocks.length && text.trim().startsWith('{')) blocks.push(text.trim());
    const candidates = new Map(); let malformed = false;
    for (const block of blocks) {
      let data;
      try { data = JSON.parse(block); }
      catch { if (/omnicpq\.lifecycle-output|"kind"\s*:\s*"(?:TEST_PLAN|BUSINESS_REQUIREMENT)"/.test(block)) malformed = true; continue; }
      if (object(data) && (data.schema === 'omnicpq.lifecycle-output.v1' || ['TEST_PLAN','BUSINESS_REQUIREMENT'].includes(data.kind))) candidates.set(JSON.stringify(data),data);
    }
    if (candidates.size > 1 || (malformed && candidates.size)) { result.state = 'AMBIGUOUS'; result.issues.push({ path:'$', category:'selection', message:'Odgovor vsebuje več različnih ali poškodovanih lifecycle blokov.' }); return result; }
    if (malformed) return problem('parse','Lifecycle JSON ni veljaven.');
    if (!candidates.size) return result;
    try { checkSchema(schema,schema); } catch { return problem('schema','Zasebna shema uporablja nepodprto ali neveljavno obliko.'); }
    const data = candidates.values().next().value;
    shape(data,schema,schema,result.issues);
    if (!result.issues.length) graph(data,result.issues);
    if (!result.issues.length) for (const message of lifecycleIssues(data)) result.issues.push({ path: '$', category: 'semantic', message });
    result.state = result.issues.length ? 'INVALID' : 'VALID'; return result;
  } catch { return problem('validation','Pregled izhoda ni bil uspešno dokončan.'); }
}
