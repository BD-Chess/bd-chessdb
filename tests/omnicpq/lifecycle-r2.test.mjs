import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { validateLifecycleAnswer } from '../../functions/lib/omnicpq/lifecycle.mjs';
import { canExportTests } from '../../public/OmniCPQ/core.mjs';
import { makeHandler } from '../../functions/omnicpq-assistant.mjs';
import { loadKnowledge } from '../../functions/lib/omnicpq/knowledge.mjs';
import { readSSE } from '../../functions/lib/omnicpq/provider.mjs';

// Independent fixture authority: unchanged private v15 schema/example, not validator output.
const packText = await readFile(process.env.OMNICPQ_TEST_KNOWLEDGE || '.private/omnicpq/knowledge.json', 'utf8');
const pack = JSON.parse(packText), schemaText = pack.files['references/LIFECYCLE_OUTPUT.schema.json'];
const schema = JSON.parse(schemaText), example = JSON.parse(pack.files['references/PLM_TEST_EXAMPLE.json']);
const hash = text => createHash('sha256').update(text, 'utf8').digest('hex');
const schemaSha256 = hash(schemaText), clone = value => JSON.parse(JSON.stringify(value));
const fence = value => '```json\n' + JSON.stringify(value, null, 2) + '\n```';
const business = () => ({ schema: 'omnicpq.lifecycle-output.v1', kind: 'BUSINESS_REQUIREMENT', service: 'Predlog ščž',
  context: { model_version: null, environment: 'UNKNOWN' }, sources: [], requirements: [], open_questions: [],
  draft: { title: '', business_goal: '', as_is: '', to_be: '', scope: [], rules: [], billing: [], lifecycle: [], integrations: [], acceptance_criteria: [], proposed_work_items: [] },
  lifecycle_states: Object.fromEntries(['proposal', 'approved', 'implemented', 'tested'].map(key => [key, { status: 'UNKNOWN', source_ids: [], note: '' }])) });
async function check(text, expected, suppliedSchema = schema) {
  const result = await validateLifecycleAnswer(text, suppliedSchema, schemaSha256);
  assert.equal(result.state, expected); assert.equal(result.schemaSha256, schemaSha256);
  assert.equal(result.contentSha256, hash(text)); assert(Array.isArray(result.issues));
  if (expected === 'VALID') assert.deepEqual(result.issues, []);
  if (['INVALID', 'AMBIGUOUS'].includes(expected)) {
    assert(result.issues.length > 0);
    for (const issue of result.issues) for (const key of ['path', 'category', 'message']) assert.equal(typeof issue[key], 'string');
  }
  return result;
}

test('pinned v15 example and minimal requirement are valid without mutation', async () => {
  const manifest = JSON.parse(pack.manifestText);
  assert.equal(schemaSha256, manifest.payload_files.find(file => file.path === 'references/LIFECYCLE_OUTPUT.schema.json').sha256);
  const before = JSON.stringify({ schema, example });
  await check(fence(example), 'VALID'); await check(fence(business()), 'VALID');
  assert.equal(JSON.stringify({ schema, example }), before);
});

test('nullable and unrestricted optional v15 values remain valid', async () => {
  const data = clone(example);
  data.context.model_version = null; data.context.requirement_version = null;
  data.sources[0].version = null; data.sources[0].sha256 = null; data.coverage[0].gap = null;
  data.tests[0].expected_result.expected_value = { unknown_business_key: [null, 2, true] };
  data.tests[0].input = { arbitrary_business_field: { nested: true } };
  await check(fence(data), 'VALID');
  data.tests[0].execution_status = 'PASS'; data.tests[0].actual_result = { observed: 'ročni izid' };
  data.tests[0].evidence = [{ kind: 'USER_REPORTED', description: 'Poročilo uporabnika', locator: 'manual:test-1' }];
  await check(fence(data), 'VALID'); // Format validity does not independently verify this report.
});

test('pinned required/type/enum/pattern/conditional rules reject malformed plans', async t => {
  const cases = [
    ['required service', d => { delete d.service; }],
    ['empty service', d => { d.service = ''; }],
    ['unknown top-level property', d => { d.unapproved = true; }],
    ['null context', d => { d.context = null; }],
    ['null source', d => { d.sources[0] = null; }],
    ['null test', d => { d.tests[0] = null; }],
    ['null expected result', d => { d.tests[0].expected_result = null; }],
    ['wrong sources type', d => { d.sources = {}; }],
    ['invalid source hash', d => { d.sources[0].sha256 = 'bad'; }],
    ['invalid environment', d => { d.context.environment = 'LIVE'; }],
    ['invalid priority', d => { d.tests[0].priority = 'P9'; }],
    ['invalid execution status', d => { d.tests[0].execution_status = 'DONE'; }],
    ['invalid oracle status', d => { d.tests[0].expected_result.oracle_status = 'ASSUMED'; }],
    ['missing required test field', d => { delete d.tests[0].preconditions; }],
    ['empty tests', d => { d.tests = []; }],
    ['empty steps', d => { d.tests[0].steps = []; }],
    ['NOT_RUN actual result', d => { d.tests[0].actual_result = 'passed'; }],
    ['NOT_RUN evidence', d => { d.tests[0].evidence = [{ kind: 'OBSERVED', description: 'x', locator: 'x' }]; }],
    ['PASS without result/evidence', d => { d.tests[0].execution_status = 'PASS'; }],
    ['FAIL without confirmed oracle', d => { Object.assign(d.tests[0], { execution_status: 'FAIL', actual_result: 'x', evidence: [{ kind: 'OBSERVED', description: 'x', locator: 'x' }] }); d.tests[0].expected_result.oracle_status = 'PROPOSED'; }],
    ['CONFIRMED without source', d => { d.tests[0].expected_result.source_ids = []; }],
    ['missing conditional coverage', d => { delete d.coverage; }],
  ];
  for (const [name, mutate] of cases) await t.test(name, async () => {
    const data = clone(example); mutate(data); const before = JSON.stringify(data);
    await check(fence(data), 'INVALID'); assert.equal(JSON.stringify(data), before);
  });
});

test('source, requirement, test and coverage references form an unambiguous graph', async t => {
  const cases = [
    ['duplicate source ID', d => { d.sources.push(clone(d.sources[0])); }],
    ['duplicate requirement ID', d => { d.requirements.push(clone(d.requirements[0])); }],
    ['duplicate test ID', d => { d.tests[1].test_id = d.tests[0].test_id; }],
    ['requirement source missing', d => { d.requirements[0].source_ids = ['MISSING']; }],
    ['expectation source missing', d => { d.tests[0].expected_result.source_ids = ['MISSING']; }],
    ['test requirement missing', d => { d.tests[0].requirement_ids = ['MISSING']; }],
    ['coverage requirement missing', d => { d.coverage[0].requirement_id = 'MISSING'; }],
    ['coverage test missing', d => { d.coverage[0].test_ids = ['MISSING']; }],
  ];
  for (const [name, mutate] of cases) await t.test(name, async () => {
    const data = clone(example); mutate(data); await check(fence(data), 'INVALID');
  });
  const data = business(); data.lifecycle_states.approved.source_ids = ['MISSING'];
  await check(fence(data), 'INVALID');
});

test('both BUSINESS_REQUIREMENT conditional payload and state constraints apply', async () => {
  for (const change of [d => { delete d.draft; }, d => { delete d.lifecycle_states; }, d => { d.draft = null; },
    d => { delete d.draft.billing; }, d => { d.lifecycle_states.tested.status = 'PASS'; }]) {
    const data = business(); change(data); await check(fence(data), 'INVALID');
  }
});

test('absent, malformed and differing fenced lifecycle blocks fail safely', async () => {
  await check('Običajno besedilo ščž.', 'ABSENT');
  await check('```json\n{"unrelated":true}\n```', 'ABSENT');
  await check('```json\n{"schema":"omnicpq.lifecycle-output.v1","kind":"TEST_PLAN",\n```', 'INVALID');
  const other = clone(example); other.service = 'Druga storitev';
  await check(fence(example) + '\n\n' + fence(other), 'AMBIGUOUS');
  for (const value of [null, [], 17, 'text']) {
    const result = await validateLifecycleAnswer(fence(value), schema, schemaSha256);
    assert.notEqual(result.state, 'VALID');
  }
});

test('unsupported schema syntax and external refs fail closed without mutation', async () => {
  for (const change of [s => { s.unevaluatedProperties = false; },
    s => { s.$defs.source.$ref = 'https://private.invalid/schema'; }, s => { s.type = 'nonexistent'; }]) {
    const altered = clone(schema); change(altered); const before = JSON.stringify(altered);
    await check(fence(example), 'INVALID', altered); assert.equal(JSON.stringify(altered), before);
  }
  await check(fence(example), 'INVALID', null);
});

test('CSV gate requires a complete TEST_PLAN and metadata for these exact content/schema bytes', async () => {
  const content = fence(example), validation = await check(content, 'VALID');
  const message = { role: 'assistant', content, status: 'complete', meta: { skill: { outputSchemaSha256: schemaSha256 }, lifecycleValidation: validation } };
  assert.equal(canExportTests(message), true);
  const negatives = [m => { m.status = 'partial'; }, m => { m.status = 'cancelled'; }, m => { m.status = 'streaming'; },
    m => { m.content += '\n'; }, m => { delete m.meta.lifecycleValidation; }, m => { m.meta.lifecycleValidation.state = 'INVALID'; },
    m => { m.meta.lifecycleValidation.state = 'AMBIGUOUS'; }, m => { m.meta.lifecycleValidation.contentSha256 = '0'.repeat(64); },
    m => { m.meta.lifecycleValidation.schemaSha256 = '0'.repeat(64); }, m => { m.meta.skill.outputSchemaSha256 = '0'.repeat(64); }];
  for (const change of negatives) { const candidate = clone(message); change(candidate); assert.equal(canExportTests(candidate), false); }
  const requirementText = fence(business());
  assert.equal(canExportTests({ ...message, content: requirementText, meta: { ...message.meta, lifecycleValidation: await check(requirementText, 'VALID') } }), false);
  for (const candidate of [null, {}, { status: 'complete', content: null, meta: null }]) assert.equal(canExportTests(candidate), false);
});

test('handler binds final validation to streamed content; owner metadata exposes no private schema', async () => {
  const knowledge = await loadKnowledge({ reader: async () => packText });
  for (const [content, state] of [[fence(example), 'VALID'], [fence({ ...example, service: '' }), 'INVALID'], ['Navaden odgovor.', 'ABSENT']]) {
    let calls = 0;
    const handler = makeHandler({ enabled: true, accessFactory: async () => ({ id: 'r2-owner', role: 'owner' }), knowledgeFactory: async () => knowledge,
      budgetFactory: () => ({ reserve: async () => null, settle: async () => {} }), transport: async ({ onText }) => {
        calls++; onText(content.slice(0, 15)); onText(content.slice(15)); return { model: 'FIXTURE', status: 'complete', usage: null };
      } });
    const metadata = await handler(new Request('https://example.test/api'));
    assert.equal(metadata.status, 200); const publicText = await metadata.text();
    assert(!publicText.includes('"$defs"')); assert(!publicText.includes('"allOf"')); assert(!publicText.includes(schemaText)); assert.equal(calls, 0);
    const request = new Request('https://example.test/api', { method: 'POST', headers: { origin: 'https://example.test', 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Pripravi PLM testni načrt.', mode: 'plm', profile: 'fast', context: {}, history: [], clientRequestId: randomUUID() }) });
    const response = await handler(request); assert.equal(response.status, 200);
    const frames = []; for await (const frame of readSSE(response.body)) frames.push(frame);
    assert.equal(frames.filter(f => f.type === 'delta').map(f => f.text).join(''), content);
    const done = frames.filter(f => f.type === 'done'); assert.equal(done.length, 1); assert.equal(calls, 1);
    assert.equal(done[0].lifecycleValidation.state, state); assert.equal(done[0].lifecycleValidation.contentSha256, hash(content));
    assert.equal(done[0].lifecycleValidation.schemaSha256, schemaSha256);
  }
});
