import { validateLifecycleAnswer } from './lifecycle.mjs';
import { catalogExtracts, resolveCatalogQuery,categoryQuestion } from './catalog.mjs';
import { resolve } from 'node:path';
import { SKILL, error, hash } from './identity.mjs';
import { SKILL_V15 } from './v15.mjs';
import { openSealedKnowledge } from './sealed-knowledge.mjs';
import { gunzipSync } from 'node:zlib';
import { runtime } from './runtime.mjs';
import {readCurrentPrivateDocument as readPrivateDocument} from './private-release.mjs';
import {readLearning} from './learning.mjs';

const env = key => globalThis.Netlify?.env?.get(key) ?? process.env[key];
const norm = value => String(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const safePath = path => /^(?:SKILL\.md|copilot\/PROMPTS\.json|references\/[a-zA-Z0-9_./-]+\.(?:md|json))$/.test(path) && !path.split('/').includes('..');
let cached;
const activeSkill = () => env('OMNICPQ_ACTIVE_RELEASE') === 'v15' ? SKILL_V15 : SKILL;

// A fixed, server-controlled key, never a user URL/key or a public source path.
export async function readPrivatePack() {
  // Private, EU-region site store; decrypt only inside an authenticated server function.
  // A separate 256-bit secret protects the ciphertext; the login password is never used as an encryption key.
  if (env('OMNICPQ_KNOWLEDGE_MODE') === 'sealed_blobs_v15') {
    if (activeSkill().release !== 'v15') throw error('KNOWLEDGE_UNAVAILABLE');
    const { getStore } = await import('@netlify/blobs');
    let sealed;
    try {
      sealed = await getStore({ name: 'omnicpq-private-prod', region: 'eu-central-1', consistency: 'strong' })
        .get('v15/knowledge.enc.json', { type: 'text', consistency: 'strong' });
    } catch { throw error('KNOWLEDGE_UNAVAILABLE'); }
    if (!sealed) throw error('KNOWLEDGE_UNAVAILABLE');
    return openSealedKnowledge(sealed, env('OMNICPQ_KNOWLEDGE_DEK_B64'), SKILL_V15);
  }
  if (env('OMNICPQ_KNOWLEDGE_MODE') === 'database') {
    // The existing database RPC has a fixed legacy slot; the pack's pinned
    // ZIP/manifest and per-file hashes, rather than that slot name, define v16.
    const result = await runtime('knowledge');
    if (result.encoding !== 'gzip-base64' || typeof result.payload !== 'string' || result.payload.length > 8_000_000) throw error('KNOWLEDGE_UNAVAILABLE');
    const text = gunzipSync(Buffer.from(result.payload, 'base64'), { maxOutputLength: 32_000_000 }).toString('utf8');
    if (await hash(text) !== result.sha256) throw error('KNOWLEDGE_INTEGRITY');
    return text;
  }
  if (env('OMNICPQ_KNOWLEDGE_MODE') === 'blobs') {
    const name = env('OMNICPQ_KNOWLEDGE_STORE');
    if (!/^omnicpq-private-[a-z0-9-]{1,40}$/.test(name || '')) throw error('KNOWLEDGE_UNAVAILABLE');
    const { getStore } = await import('@netlify/blobs');
    const text = await getStore({ name, consistency: 'strong' }).get(activeSkill().release + '/knowledge.json', { type: 'text' });
    if (!text || Buffer.byteLength(text) > 32_000_000) throw error('KNOWLEDGE_UNAVAILABLE');
    return text;
  }
  // Local preview owns its file reader and injects it explicitly. Keeping all
  // filesystem discovery out of this deployed import graph prevents the native
  // ESM tracer from treating unrelated repository files as runtime resources.
  throw error('KNOWLEDGE_UNAVAILABLE');
}

export async function verifyPack(text) {
  let pack, manifest;
  try {
    pack = JSON.parse(text);
    if (pack.schema !== 'omnicpq.private_knowledge.v1' || pack.zipSha256 !== activeSkill().zipSha256 ||
        await hash(pack.manifestText) !== activeSkill().manifestSha256) throw Error();
    manifest = JSON.parse(pack.manifestText);
    if (manifest.version !== activeSkill().version || manifest.payload_files.length !== activeSkill().payloads) throw Error();
    const expected = new Map(manifest.payload_files.filter(f => safePath(f.path)).map(f => [f.path, f]));
    if (Object.keys(pack.files).length !== expected.size) throw Error();
    for (const [path, file] of Object.entries(pack.files)) {
      const spec = expected.get(path);
      if (!spec || typeof file !== 'string' || Buffer.byteLength(file) !== spec.bytes || await hash(file) !== spec.sha256) throw Error();
    }
    return { files: pack.files, manifest, packSha256: await hash(text) };
  } catch { throw error('KNOWLEDGE_INTEGRITY'); }
}

export async function loadKnowledge({ reader = readPrivatePack } = {}) {
  // Cache is process memory only; an input or failed verification is never cached.
  if (reader === readPrivatePack && cached && cached.release === activeSkill().release && cached.until > Date.now()) return cached.value;
  let verified;
  try { verified = await verifyPack(await reader()); }
  catch (e) { throw e.code ? e : error('KNOWLEDGE_UNAVAILABLE'); }
  const value = createRetriever(verified);
  if (reader === readPrivatePack) cached = { release: activeSkill().release, until: Date.now() + 60_000, value };
  return value;
}

const words = text => norm(text).match(/[a-z0-9_]+/g) || [];
const escapeRE = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const followup = text => /^(?:kaj pa|se\b|dodaj\b|dopolni\b|nadaljuj\b|razsiri\b|popravi\b|in\b|pa\b)/.test(norm(text).trim());
const priceQuestion = text => words(text).some(w => /^(?:cen(?:a|e|i|o|ah|am|ami|ik[a-z]*|ov[a-z]*)|cpl|popust[a-z]*|obracun[a-z]*|billing)$/.test(w));
const newCloudService = text => /\b(?:nov[a-z]*|neznan[a-z]*)\b.{0,55}\b(?:it|cloud|oblacn[a-z]*)\b/.test(norm(text)) && /\b(?:storitev|storitv[a-z]*|produkt[a-z]*)\b/.test(norm(text));
const cpqProcess = text => /\b(?:gui|klik[a-z]*|zaslon[a-z]*|modal[a-z]*|zavih[a-z]*|korak[a-z]*|nadaljuj[a-z]*|vnesti|vnes[a-z]*|konfigurir[a-z]*)\b|\b(?:pripraviti|ustvariti|preveri|najdi|izberi)\b.{0,40}\b(?:ponudb[a-z]*|narocil[a-z]*|dokument[a-z]*)\b/.test(norm(text));

// Longer aliases suppress only an overlapping generic alias, never another
// independently named service. A bare acronym is a question, not an SO rule.
function serviceMatch(registry, text) {
  const value = norm(text), hits = [];
  for (const row of registry.product_modules) for (const alias of [...row.aliases, ...(row.offering_prefixes || [])]) {
    const pattern = new RegExp(`(^|[^a-z0-9_])(${escapeRE(norm(alias))})(?=$|[^a-z0-9_])`, 'g');
    for (const match of value.matchAll(pattern)) hits.push({ row, start: match.index + match[1].length, end: match.index + match[0].length });
  }
  const specific = hits.filter(hit => !hits.some(other => other.row !== hit.row && other.start <= hit.start && other.end >= hit.end && other.end - other.start > hit.end - hit.start));
  const rows = [...new Map(specific.map(hit => [hit.row.service_id, hit.row])).values()];
  const unresolved = (!rows.length && (/\b(?:vpn|vps)\b/.test(value) || /\bSO\b/.test(String(text)) || value.trim() === 'so')) ||
    (/\bvps\b/.test(value) && !rows.some(row => row.service_id === 'VPI_DDOS_VPS'));
  return { row: rows.length === 1 && !unresolved ? rows[0] : null, ambiguous: unresolved || rows.length > 1, candidates: rows.map(row => row.service_id) };
}

export function selectService(registry, text) { return serviceMatch(registry, text).row; }

function statedIntent(text) {
  const value = norm(text);
  const plm = /\b(?:qa|testn[a-z]*\s+(?:nacrt[a-z]*|scenarij[a-z]*|plan[a-z]*)|pokritost\s+model[a-z]*)\b/.test(value) ||
    /\b(?:pripravi|naredi|generiraj|izdelaj|dopolni|razsiri)\b.{0,60}\b(?:test[a-z]*|scenarij[a-z]*)\b/.test(value) ||
    /\b(?:negativn[a-z]*|mejn[a-z]*)\b.{0,40}\b(?:primer[a-z]*|test[a-z]*|scenarij[a-z]*)\b/.test(value);
  const jira = /\bposlovn[a-z]*\s+zahtev[a-z]*\b|\b(?:zahtev[a-z]*|specifikacij[a-z]*)\b.{0,40}\b(?:it|plm|jir[a-z]*)\b|\b(?:osnutek|pripravi|naredi|izdelaj)\b.{0,30}\bspecifikacij[a-z]*\b/.test(value);
  if (plm || jira) return { mode: jira ? 'jira' : 'plm', plm, jira };
  if (/\b(?:zasnuj|modeliranje|predlog modela|hierarhij[a-z]* modela)\b/.test(value)) return {mode:'model',plm:false,jira:false};
  if (/\b(?:razlozi storitev|vodic|poslovni namen|kako deluje storitev)\b/.test(value)) return {mode:'guide',plm:false,jira:false};
  if (/\b(?:kako|kje)\b.{0,80}\b(?:dodam|dodati|spremenim|izklopim|odstranim|kopiram|izberem|kliknem|nadaljujem)\b|\b(?:klikni|kliknem|modal|zaslon|ne deluje|napaka)\b/.test(value)) return { mode: 'work', plm: false, jira: false };
  return null;
}

export function resolveIntent(request, registry) {
  const primary = { GUIDE_TS:'guide',MODEL_TS:'model',CPQ_HELP: 'work', PLM_TESTS: 'plm', JIRA_REQUIREMENT: 'jira' }[request.promptId];
  if (primary) return { mode: primary, plm: primary === 'plm', jira: primary === 'jira', basis: 'canonical_prompt' };
  const current = statedIntent(request.message);
  if (current) return { ...current, basis: 'message' };
  const currentService = registry ? serviceMatch(registry, request.message) : null;
  if (!request.promptId && request.mode === 'work' && followup(request.message) && !currentService?.ambiguous) {
    for (const prior of [...request.history].reverse()) if (prior.role === 'user') {
      const priorService = registry ? serviceMatch(registry, prior.content) : null;
      if (currentService?.row && priorService?.row && currentService.row.service_id !== priorService.row.service_id) break;
      const intent = statedIntent(prior.content);
      if (intent) return { ...intent, basis: 'history_followup' };
    }
  }
  return { mode: request.mode, plm: request.mode === 'plm', jira: request.mode === 'jira', basis: 'selected_mode' };
}

// Match registry phrases with bounded words and a small inflection allowance;
// e.g. "dodam dodatno storitev" matches the registered "dodaj ..." trigger.
const triggerWord = word => /^(?:dodam|dodaj[a-z]*|dodati)$/.test(word) ? 'dodaj' :
  /^(?:sprememb[a-z]*|spremen[a-z]*)$/.test(word) ? 'sprememb' : word;
function matchesTrigger(text, trigger) {
  const haystack = words(text).map(triggerWord), needle = words(trigger).map(triggerWord);
  return needle.length > 0 && haystack.some((_, at) => needle.every((word, i) => {
    const actual = haystack[at + i];
    return actual === word || (word.length >= 6 && actual?.length >= 5 && actual.startsWith(word.slice(0, 5)));
  }));
}

export function createRetriever({ files, manifest, packSha256 },{documentReader=readPrivateDocument,learningReader=readLearning}={}) {
  const registry = JSON.parse(files['references/SERVICE_REGISTRY.json']);
  const specs = new Map(manifest.payload_files.map(f => [f.path, f]));
  const lifecycleSchema = JSON.parse(files['references/LIFECYCLE_OUTPUT.schema.json']);
  return {
    skill: { ...activeSkill(), packSha256, promptsSha256: specs.get('copilot/PROMPTS.json').sha256,
      outputSchemaSha256: specs.get('references/LIFECYCLE_OUTPUT.schema.json').sha256 },
    validateLifecycleAnswer: text => validateLifecycleAnswer(text, lifecycleSchema, specs.get('references/LIFECYCLE_OUTPUT.schema.json').sha256),
    canonicalPrompts: JSON.parse(files['copilot/PROMPTS.json']).prompts,
    services: registry.product_modules.map(({ service_id, title, coverage }) => ({ id: service_id, title, coverage })),
    async retrieve(request) {
      const intent = resolveIntent(request, registry), current = serviceMatch(registry, request.message);
      const selected = request.service ? registry.product_modules.find(s => s.service_id === request.service) : null;
      if (request.service && !selected) throw error('INVALID_SERVICE', 400);
      const unknownNewService = !current.row && !current.ambiguous && newCloudService(request.message);
      let selection = current, service = selected || current.row;
      if (selected && (current.ambiguous || (current.row && current.row.service_id !== selected.service_id))) {
        selection = { row: null, ambiguous: true, conflict: true, candidates: [...new Set([...current.candidates, selected.service_id])] };
        service = null;
      }
      if (unknownNewService) service = null;
      if (!request.service && !unknownNewService && !service && !selection.ambiguous) {
        selection = serviceMatch(registry, request.context.text); service = selection.row;
      }
      if (!request.service && !unknownNewService && !service && !selection.ambiguous) for (const h of [...request.history].reverse()) {
        if (h.role !== 'user') continue;
        selection = serviceMatch(registry, h.content); service = selection.row;
        if (service || selection.ambiguous) break;
      }
      const contextService = serviceMatch(registry, request.context.text);
      const chosen = current.row || (request.service ? service : null);
      const contextFits = !chosen || (!contextService.ambiguous && (!contextService.row || contextService.row.service_id === chosen.service_id));
      const previous = [...request.history].reverse().find(h => h.role === 'user');
      const previousService = previous ? serviceMatch(registry, previous.content) : null;
      const carry = previous && followup(request.message) && !current.ambiguous && !selection.conflict && !unknownNewService && (!service || !previousService.row || previousService.row.service_id === service.service_id);
      const question = norm([request.message, contextFits && !current.ambiguous && !selection.conflict && !unknownNewService ? request.context.text : '', carry ? previous.content : ''].join('\n'));
      const pricing = priceQuestion(question);
      const paths = new Set(['SKILL.md', 'references/WORK_MODES.md', 'references/RESPONSE_CONTRACT.md', 'references/CONTEXT_PROTOCOL.md', 'references/SERVICE_ROUTING.md']);
      const add = path => { if (files[path]) paths.add(path); };
      if (intent.mode === 'work' && cpqProcess(question)) add('references/CPQ_FLOW.md');
      if (intent.plm) {
        add('references/PLM_TESTING.md'); add('references/LIFECYCLE_VALIDATION.md'); add('references/LIFECYCLE_OUTPUT.schema.json'); add('references/PLM_TEST_EXAMPLE.json');
      }
      if (intent.jira) { add('references/JIRA_REQUIREMENTS.md'); add('references/POSLOVNA_ZAHTEVA_IT_PLM.md'); add('references/LIFECYCLE_OUTPUT.schema.json'); }
      if(intent.mode==='model'){add('references/PLM_OWNERSHIP.md');add('references/POSLOVNA_ZAHTEVA_IT_PLM.md');add('references/PLM_EXPORTS_20261022.md');}
      for (const row of [...(registry.process_modules || []), ...(registry.context_modules || [])]) {
        if (row.process_id === 'DOCUMENT_MANAGEMENT' && intent.mode !== 'work' && !/\bdokument[a-z]*\b/.test(question)) continue;
        if (row.process_id === 'V12_BUSINESS_REQUIREMENT' && !intent.jira) continue;
        // A4 category navigation is not itself a PLM validation incident.
        // Keep the complete diagnostic module/ledger for actual incident signals.
        if (row.process_id === 'V12_PLM_DIAGNOSTICS' && categoryQuestion(question) &&
            !/\b(?:kardinalnost|total_no_of_child_instances|closed fixed|napak[a-z]*|incident[a-z]*)\b/.test(question)) continue;
        if (!(row.triggers || [row.title]).some(trigger => matchesTrigger(question, trigger))) continue;
        add(row.entrypoint);
        for (const path of row.evidence_paths || []) add(path);
        if (row.process_id) {
          add('references/PROCESS_ROUTING.md');
          if (intent.mode === 'work' && row.process_id !== 'CPL') add('references/CPQ_FLOW.md');
        }
      }
      if (/primerjav|copilot|benchmark/.test(question)) add('references/COMPARISON_PROTOCOL.md');
      if (/primeri uporabe|galerij|zmore pomocnik/.test(question)) add('references/PROMPT_GALLERY.md');
      if (request.promptId === 'CAPABILITIES' || /pokrit|podprt|podpir|kandidat|portfelj|katere storitve|kaj (?:se )?zmore|kaj (?:se )?manjka/.test(question)) add('references/SERVICE_COVERAGE.md');
      if (request.promptId === 'COVERAGE') add('references/SERVICE_COVERAGE.md');
      if (request.promptId === 'SOURCES' || /viri znanja|izvor.{0,20}znanj|od kod.{0,20}znan/.test(question)) add('references/KNOWLEDGE_ORIGINS.md');
      const hierarchyRequested=intent.mode==='work'&&categoryQuestion(question);
      const catalogRequested = hierarchyRequested || request.promptId === 'PLM_CATALOG' || /\b(?:plm|cenik|sifr[a-z]*|katalog[a-z]*|kategorij[a-z]*|copa|co-pa)\b/.test(question);
      const catalogQuestion = resolveCatalogQuery(files,request.message,{allowCarry:Boolean(carry && !current.row && !current.ambiguous && !selection.conflict && !unknownNewService && service?.service_id !== 'TS_SO'),context:contextFits ? request.context.text : '',previous:previous?.content || ''})+(hierarchyRequested&&service?'\nStoritev v trenutnem kontekstu: '+service.title:'');
      const extracts = catalogExtracts(files, catalogQuestion, { requested: !(intent.jira&&!service) && catalogRequested && (service?.service_id !== 'TS_SO'||hierarchyRequested) && request.promptId !== 'SO_RELATIONS' });
      if (catalogRequested || extracts.length || service?.service_id === 'TS_SO' || request.promptId === 'SO_RELATIONS') add('references/PLM_EXPORTS_20261022.md');
      if (service?.service_id === 'TS_SO' || request.promptId === 'SO_RELATIONS' || /ikt\.so\./.test(question)) add('references/PLM_SO_20261022.json');
      if (/promo_type|mmer-5890|ecm-13407|standard request|sinhronizacij.{0,30}(?:plm|mcrm)|ikt oprem/.test(question)) add('references/PILOT_R2_DIAGNOSTICS_DELNI.md');
      if (service) {
        add(service.entrypoint);
        if (service.service_id === 'TS_SO') {
          add('references/ts-suvereni-oblak/PLM_RULEBOOK_R2.md');
          add('references/ts-suvereni-oblak/EVIDENCE_LIMITS.md');
          if (pricing || /\b(?:kolic[a-z]*|disk[a-z]*|backup|drs|licenc[a-z]*)\b/.test(question)) add('references/ts-suvereni-oblak/PRICE_GUIDE.md');
        }
      }
      const targets = [
        [pricing, ['PRICE_GUIDE.md', 'OMNICPQ_POGODBENE_CENE_CPL.md']],
        [/napak|tezav|diagnost|incident|ne deluje/, ['JIRA_DIAGNOSTICS.md', 'SUPPORT_CASES.md', 'INCIDENT_TEMPLATE.md']],
        [/integracij|sinhron|dogodek|sapcc|oms|trm/, ['JIRA_INTEGRACIJE_STANJA_ID_DELNI.md']],
        [/kopir|sprememb|selit|dodaj|odstran|izkljuc|lastnist/, ['PROCESS_ROUTING.md']],
        [/plm|stevnost|relacij|validacij/, ['JIRA_PLM_VALIDACIJA_IZIDI_DELNI.md']],
      ];
      for (const [pattern, names] of targets) if (typeof pattern === 'boolean' ? pattern : pattern.test(question)) for (const name of names) add('references/' + name);
      // Follow direct Markdown references from the selected product entrypoint;
      // generic/shared cross-links are added only if relevant to the question.
      if (service) for (const match of files[service.entrypoint].matchAll(/\]\(([^)#]+\.md)(?:#[^)]+)?\)/g)) {
        const path = resolve('/knowledge', service.entrypoint, '..', match[1]).slice('/knowledge/'.length);
        if (path.startsWith('references/ts-suvereni-oblak/') && /MODULE|CURRENT_MODEL|PLM_RULEBOOK/.test(path)) add(path);
        else if ((pricing || /\b(?:kolic[a-z]*|sla)\b/.test(question)) && /PRICE|CENE|SLA/.test(path)) add(path);
      }
      add('references/INTEGRATION_CONFLICTS.md');
      const seen = new Set(), sources = [], blocks = []; let size = 0;
      for (const path of paths) {
        const text = files[path], sha256 = specs.get(path)?.sha256;
        if (seen.has(sha256)) continue;
        seen.add(sha256); size += text.length;
        // Never slice a source across a qualification or adjacent section.
        if (size > 190_000) throw error('RETRIEVAL_LIMIT', 422);
        const id = `S${sources.length + 1}`;
        const sections = []; let heading = 'Celoten dokument', start = 1;
        const lines = text.split('\n');
        lines.forEach((line, i) => { if (/^#{1,6} /.test(line)) {
          if (i > start) sections.push({ heading, startLine: start, endLine: i });
          heading = line.replace(/^#+ /, ''); start = i + 1;
        }});
        sections.push({ heading, startLine: start, endLine: lines.length });
        const kind = /SERVICE_COVERAGE/.test(path) ? 'coverage_overview_not_product_rule' : /PLM_TEST_EXAMPLE/.test(path) ? 'synthetic_example_not_product_rule' : /JIRA_REQUIREMENTS|PLM_TESTING|WORK_MODES/.test(path) ? 'shared_workflow' : /JIRA|SUPPORT|INCIDENT/.test(path) ? 'diagnostic_evidence' : /POSLOVNA|PLM_OWNERSHIP/.test(path) ? 'proposal_template' : 'skill_reference';
        sources.push({ id, path, sha256, kind, sections });
        blocks.push(`<source id="${id}" path="${path}" kind="${kind}">\n${text}\n</source>`);
      }
      for (const extract of extracts) {
        const bytes = extract.text.length;
        if (size + bytes > 190_000) throw error('RETRIEVAL_LIMIT', 422);
        size += bytes;
        const id = `S${sources.length+1}`;
        sources.push({ id, path: extract.path, sha256: specs.get(extract.path)?.sha256, extractSha256: await hash(extract.text),
          kind: extract.kind, locator: extract.locator, sections: [{ heading: 'Izbrane celotne cenovne vrstice', startLine: 1, endLine: 1 }] });
        blocks.push(`<source id="${id}" path="${extract.path}" kind="${extract.kind}">\n${extract.text}\n</source>`);
      }
      let documentationStatus='NOT_REQUESTED';
      if(service?.service_id==='TS_SO'&&(hierarchyRequested||/\b(?:cpu|vcpu|ram|disk[a-z]*|konfigur[a-z]*)\b/.test(question))){
        try{
          const name='A4_SO_WORKED_EXAMPLE_R3.md',item=await documentReader(name),text=item.bytes.toString('utf8'),id=`S${sources.length+1}`;
          sources.push({id,path:'playbooks/'+name,sha256:item.sha256,kind:'dated_ui_example_not_universal_product_rule',sections:[{heading:'SO/A4 dokazni primer R3',startLine:1,endLine:text.split('\n').length}]});
          blocks.push(`<source id="${id}" path="playbooks/${name}" kind="dated_ui_example_not_universal_product_rule">\n${text}\n</source>`);
        }catch{/* Private context is optional; original v16 and fresh UI remain usable. */}
      }
      if(request.promptId==='COVERAGE'){
        try{
          const name='B2B_pokritost_in_kandidati_OmniCPQ_v18.md',item=await documentReader(name),text=item.bytes.toString('utf8'),id=`S${sources.length+1}`;
          sources.push({id,path:'documents/'+name,sha256:item.sha256,kind:'private_documentation_v18_not_new_product_rule',sections:[{heading:'Dokumentacija v18',startLine:1,endLine:text.split('\n').length}]});
          blocks.push(`<source id="${id}" path="documents/${name}" kind="private_documentation_v18_not_new_product_rule">\n${text}\n</source>`);documentationStatus='V18_AVAILABLE';
        }catch{documentationStatus='V18_PRIVATE_STORAGE_PENDING';}
      }
      let learningStatus='NOT_REQUESTED';
      if(service){
        try{
          const learning=await learningReader(),record=learning.data.records.find(r=>r.serviceId===service.service_id);
          if(record){
            const selected={...record,sources:record.sources.map(({text,...source})=>source)},text=JSON.stringify(selected),id=`S${sources.length+1}`;
            if(size+text.length>190_000)throw error('RETRIEVAL_LIMIT',422);
            sources.push({id,path:'documents/ts-b2b-learning-r2.json#'+record.id,sha256:learning.sha256,kind:'dated_learning_layer_not_live_catalog',locator:'https://www.mdlxdcc.org/.netlify/functions/omnicpq-documents?file=ts-b2b-learning-r2.json#'+record.id,sections:[{heading:'Pilotna učna plast · '+record.title,startLine:1,endLine:1}]});
            blocks.push(`<source id="${id}" path="documents/ts-b2b-learning-r2.json#${record.id}" kind="dated_learning_layer_not_live_catalog">\n${text}\n</source>`);learningStatus=learning.version;
          }else learningStatus='NO_PILOT_FOR_SERVICE';
        }catch{learningStatus='PRIVATE_LEARNING_PENDING';}
      }
      return { service: service ? { id: service.service_id, title: service.title, coverage: service.coverage } : null,
        serviceResolution: { ambiguous: !service && selection.ambiguous, conflict: Boolean(selection.conflict), unknownNewService, candidates: !service ? selection.candidates : [] },
        intent, documentationStatus,learningStatus,sources, text: blocks.join('\n\n'), skill: this.skill };
    },
  };
}


