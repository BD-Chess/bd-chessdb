import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import vm from 'node:vm';
import { makeHandler, validateBody } from '../../functions/omnicpq-assistant.mjs';
import { loadKnowledge, verifyPack, selectService } from '../../functions/lib/omnicpq/knowledge.mjs';
import { authenticate, sessionCookie } from '../../functions/lib/mdlxdcc-guide/access.mjs';
import { SKILL } from '../../functions/lib/omnicpq/identity.mjs';
import { callOpenAI, readSSE } from '../../functions/lib/omnicpq/provider.mjs';
import { canonicalInput, structured, lifecycleIssues, csv, exportSession, sha256Portable } from '../../public/OmniCPQ/core.mjs';
import { PROMPTS, CANONICAL_PROMPTS, PROMPTS_SHA256 } from '../../public/OmniCPQ/prompts.mjs';

const packText = await readFile(process.env.OMNICPQ_TEST_KNOWLEDGE || '.private/omnicpq/knowledge.json', 'utf8');
const knowledge = await loadKnowledge({ reader: async () => packText });
const owner = async () => ({ id: 'test-owner', role: 'owner' });
const budget = () => ({ reserve: async () => null, settle: async () => {} });
const input = (changes = {}) => ({ message: 'Kako nadaljujem po podpisu?', mode: 'work', profile: 'fast', context: { text: '', environment: 'UNKNOWN', manualUrl: '' }, history: [], clientRequestId: randomUUID(), ...changes });
const req = (body, options = {}) => new Request('https://example.test/.netlify/functions/omnicpq-assistant', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://example.test', ...options.headers }, body: JSON.stringify(body), ...(options.signal ? { signal: options.signal } : {}) });
const events = async response => { assert.equal(response.status, 200); const all = []; for await (const e of readSSE(response.body)) all.push(e); return all; };
const factory = changes => makeHandler({ enabled: true, accessFactory: owner, knowledgeFactory: async () => knowledge, budgetFactory: budget, ...changes });
const transport = async ({ payload, onText, onIdentity }) => {
  onIdentity({ model: 'test-observed-model', reasoning: 'low', providerRequestId: 'test-id' }); onText('Prvi '); onText('drugi.');
  return { model: 'test-observed-model', reasoning: 'low', usage: { input_tokens: 12, output_tokens: 4 }, status: 'complete' };
};
test('plain HTTP preview SHA-256 fallback matches independent Node hashes including Unicode and image bytes', async () => {
  for (const bytes of [Buffer.from(''), Buffer.from('abc'), Buffer.from('Vprašanje · ščž'), Buffer.alloc(10000, 129), await readFile('public/OmniCPQ/icons/original.png')]) {
    assert.equal(sha256Portable(bytes), createHash('sha256').update(bytes).digest('hex'));
  }
});

test('original v16 payloads verified; modified, missing and extra private source rejected', async () => {
  const verified = await verifyPack(packText); assert.equal(verified.manifest.version, 'v0.1.6'); assert.equal(knowledge.skill.zipSha256, SKILL.zipSha256);
  for (const mutate of [p => { p.files['SKILL.md'] += '\nForged'; }, p => { delete p.files['SKILL.md']; }, p => { p.files['references/NEW.md'] = 'x'; }]) {
    const pack = JSON.parse(packText); mutate(pack); await assert.rejects(verifyPack(JSON.stringify(pack)), { code: 'KNOWLEDGE_INTEGRITY' });
  }
});
test('all 19 canonical IDs, titles, messages and modes exactly match the same v16 Copilot package', () => {
  const exact = JSON.parse(JSON.parse(packText).files['copilot/PROMPTS.json']);
  assert.deepEqual(CANONICAL_PROMPTS, exact.prompts); assert.equal(CANONICAL_PROMPTS.length, 19); assert.equal(PROMPTS_SHA256, knowledge.skill.promptsSha256);
});
test('service-specific retrieval: SO isolated, current VPI beats past SO; full documents and locators retained', async () => {
  const so = await knowledge.retrieve(validateBody(input({ message: 'TS Suvereni oblak disk Backup cena' })));
  assert.equal(so.service.id, 'TS_SO'); assert(so.sources.some(s => s.path.includes('PLM_RULEBOOK_R2')));
  const vpi = await knowledge.retrieve(validateBody(input({ message: 'VPI cena', history: [{ role: 'user', content: 'TS Suvereni oblak' }] })));
  assert.equal(vpi.service.id, 'VPI'); assert(!vpi.sources.some(s => s.path.includes('ts-suvereni-oblak/')));
  const registry = JSON.parse(JSON.parse(packText).files['references/SERVICE_REGISTRY.json']);
  assert.equal(selectService(registry, 'SD-WAN Lite konfiguracija').service_id, 'SD_WAN_LITE');
  const typedPLM = await knowledge.retrieve(validateBody(input({ message: 'Pripravi testne scenarije za VPI' })));
  assert(typedPLM.sources.some(s => s.path === 'references/PLM_TESTING.md'));
  const typedRequirement = await knowledge.retrieve(validateBody(input({ message: 'Pripravi poslovno zahtevo za novo cloud storitev' })));
  assert(typedRequirement.sources.some(s => s.path === 'references/POSLOVNA_ZAHTEVA_IT_PLM.md'));
  for (const s of vpi.sources) { assert(s.sha256); assert(s.sections.length); assert(vpi.text.includes(JSON.parse(packText).files[s.path])); }
  assert(so.sources.length < 30); assert(vpi.sources.length < 30);
});
test('anonymous/visitor denied before knowledge or transport; forged owner body does not grant access', async () => {
  for (const accessFactory of [async () => { throw Object.assign(Error(), { code: 'AUTH_REQUIRED' }); }, async () => ({ id: 'v', role: 'visitor' })]) {
    let reads = 0; const handler = factory({ accessFactory, knowledgeFactory: async () => { reads++; return knowledge; }, transport });
    for (const request of [req(input({ role: 'owner' })), new Request('https://example.test/.netlify/functions/omnicpq-assistant')]) {
      const r = await handler(request); assert([401, 403].includes(r.status)); assert(!JSON.stringify(await r.json()).includes('SKILL.md'));
    }
    assert.equal(reads, 0);
  }
});
test('real signed session: owner passes, modified cookie and public visitor fail', async () => {
  const oldSecret = process.env.MDLXDCC_GUIDE_SESSION_SECRET, oldEmail = process.env.MDLXDCC_GUIDE_OWNER_EMAIL;
  process.env.MDLXDCC_GUIDE_SESSION_SECRET = 'TEST_ONLY_' + 'a'.repeat(60); process.env.MDLXDCC_GUIDE_OWNER_EMAIL = 'owner@example.test';
  try {
    const handler = factory({ accessFactory: r => authenticate(r, { rpc: async () => ({ active: true }) }), transport });
    const ownerCookie = sessionCookie({ id: 'owner', email: 'owner@example.test', role: 'owner' }).split(';')[0];
    const visitorCookie = sessionCookie({ id: 'v', email: 'visitor@example.test', role: 'visitor' }).split(';')[0];
    assert.equal((await handler(new Request('https://example.test/api', { headers: { cookie: ownerCookie } }))).status, 200);
    assert.equal((await handler(req(input(), { headers: { cookie: visitorCookie } }))).status, 403);
    assert.equal((await handler(req(input(), { headers: { cookie: ownerCookie + 'changed' } }))).status, 401);
  } finally { if (oldSecret === undefined) delete process.env.MDLXDCC_GUIDE_SESSION_SECRET; else process.env.MDLXDCC_GUIDE_SESSION_SECRET = oldSecret;
    if (oldEmail === undefined) delete process.env.MDLXDCC_GUIDE_OWNER_EMAIL; else process.env.MDLXDCC_GUIDE_OWNER_EMAIL = oldEmail; }
});
test('owner metadata does not call provider; origin and client model/role configuration rejected', async () => {
  let calls = 0; const handler = factory({ transport: async (...a) => { calls++; return transport(...a); } });
  const status = await handler(new Request('https://example.test/api')); const body = await status.json();
  assert.equal(body.observedModel, 'UNKNOWN'); assert.equal(body.privateKnowledge, 'VERIFIED'); assert.equal(calls, 0);
  assert.equal((await handler(req(input(), { headers: { origin: 'https://evil.test' } }))).status, 403);
  for (const changes of [{ model: 'gpt-6-astra' }, { profile: 'expensive' }, { role: 'owner' }, { knowledgeUrl: 'http://internal/' }]) assert.equal((await handler(req(input(changes)))).status, 400);
  assert.equal(calls, 0);
});
test('stream has real event metadata, single deltas and no duplicated final text; duplicate request rejected', async () => {
  let calls = 0; const handler = factory({ transport: async args => { calls++; return transport(args); } });
  const body = input(), stream = await events(await handler(req(body)));
  assert.equal(stream.filter(e => e.type === 'delta').map(e => e.text).join(''), 'Prvi drugi.');
  assert.equal(stream.filter(e => e.type === 'done').length, 1); assert.equal(stream.at(-1).model, 'test-observed-model');
  assert.equal(stream.at(-1).costStatus, 'UNKNOWN'); assert(stream[0].sources.length > 0); assert(stream[0].requestId); assert(stream[0].retrievalMs >= 0);
  assert.equal((await handler(req(body))).status, 409); assert.equal(calls, 1);
});
test('snapshot actual PNG bytes reach multimodal transport; same hash/ID/time returned; no URL fetch', async () => {
  const image = await readFile('public/OmniCPQ/icons/favicon-32.png'); const sha256 = createHash('sha256').update(image).digest('hex');
  const snapshot = { id: randomUUID(), capturedAt: new Date().toISOString(), method: 'file', sha256, dataUrl: 'data:image/png;base64,' + image.toString('base64') };
  const handler = factory({ transport: async args => {
    const content = args.payload.input.at(-1).content; assert.equal(content[1].type, 'input_image'); assert.equal(content[1].image_url, snapshot.dataUrl);
    assert.equal(args.payload.store, false); assert(content[0].text.includes('http://private.invalid/cpq')); return transport(args);
  } });
  const stream = await events(await handler(req(input({ snapshot, context: { text: 'Aktiven modal', manualUrl: 'http://private.invalid/cpq', environment: 'STAGE' } }))));
  assert.equal(stream[0].snapshot.sha256, sha256); assert.equal(stream[0].snapshot.id, snapshot.id); assert.equal(stream[0].snapshot.capturedAt, snapshot.capturedAt); assert(!('dataUrl' in stream[0].snapshot));
  assert.throws(() => validateBody(input({ snapshot: { ...snapshot, sha256: '0'.repeat(64) } })), { code: 'SNAPSHOT_INTEGRITY' });
});
test('abort propagates to transport and blocks later text; partial answer is explicit', async () => {
  let started; const ready = new Promise(r => { started = r; }); let aborted = false;
  const handler = factory({ transport: async ({ signal, onText }) => {
    onText('Ohranjen del.'); started(); await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
    aborted = signal.aborted; onText('NE SME BITI POSLANO'); throw Error('abort');
  } });
  const controller = new AbortController(), response = await handler(req(input(), { signal: controller.signal }));
  await ready; controller.abort(); const stream = await events(response);
  assert(aborted); assert.equal(stream.filter(e => e.type === 'delta').map(e => e.text).join(''), 'Ohranjen del.'); assert.equal(stream.at(-1).code, 'CANCELLED'); assert.equal(stream.at(-1).partial, true);
});
test('all three prompt modes reach isolated system task logic; missing-screen source rule included', async () => {
  for (const prompt of PROMPTS) {
    const handler = factory({ transport: async args => {
      assert(args.payload.instructions.includes('Izbrana začetna naloga je ' + prompt.canonicalMode));
      assert(args.payload.instructions.includes('Sam URL ni pogled v CPQ'));
      if (prompt.mode === 'plm') { assert(args.payload.instructions.includes('references/PLM_TESTING.md')); assert(args.payload.instructions.includes('oracle_status')); }
      if (prompt.mode === 'jira') assert(args.payload.instructions.includes('POSLOVNA_ZAHTEVA_IT_PLM.md'));
      return transport(args);
    } });
    assert.equal((await events(await handler(req(input({ message: prompt.message, mode: prompt.mode, promptId: prompt.id }))))).at(-1).status, 'complete');
    assert.equal((await handler(req(input({ message: 'Spremenjeno sporočilo', promptId: prompt.id })))).status, 400);
  }
});
test('shared v16 output is preserved; invalid PASS flagged, CSV formula escaped, images excluded from session', () => {
  const baseInput = input();
  assert.notEqual(canonicalInput(baseInput), canonicalInput({ ...baseInput, history: [{ role: 'user', content: 'Prejšnja zahteva' }] }));
  const example = JSON.parse(JSON.parse(packText).files['references/PLM_TEST_EXAMPLE.json']);
  const parsed = structured('```json\n' + JSON.stringify(example) + '\n```');
  assert.deepEqual(parsed, example); assert.equal(parsed.tests[0].execution_status, 'NOT_RUN'); assert.deepEqual(lifecycleIssues(parsed), []);
  parsed.tests[0].execution_status = 'PASS'; assert(lifecycleIssues(parsed).some(x => x.includes('actual_result') || x.includes('evidence')));
  assert(csv([{ input: '=HYPERLINK("x")' }]).includes("'=HYPERLINK"));
  const exported = exportSession({ mode: 'work', messages: [{ role: 'user', content: 'x', snapshot: { dataUrl: 'PRIVATE_IMAGE' }, password: 'PRIVATE_PASSWORD' }], comparisons: [] });
  assert(!JSON.stringify(exported).includes('PRIVATE_'));
  assert.notEqual(canonicalInput({ message: 'x', mode: 'work', context: {}, snapshot: null }), canonicalInput({ message: 'y', mode: 'work', context: {}, snapshot: null }));
});
test('provider HTTP transport uses actual returned identity/usage, no retry; secrets and provider errors redacted', async () => {
  const previous = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = 'TEST_ONLY_NOT_A_REAL_KEY';
  let count = 0; const deltas = [], identity = [];
  try {
    const fetcher = async (url, options) => {
      count++; assert.equal(url, 'https://api.openai.com/v1/responses'); assert.equal(options.method, 'POST');
      const frames = [{ type: 'response.created', response: { id: 'r1', model: 'actually-returned-model', reasoning: { effort: 'low' } } }, { type: 'response.output_text.delta', delta: 'Dober dan' }, { type: 'response.completed', response: { id: 'r1', model: 'actually-returned-model', reasoning: { effort: 'low' }, status: 'completed', usage: { input_tokens: 2, output_tokens: 2 } } }];
      return new Response(frames.map(e => `data: ${JSON.stringify(e)}\n\n`).join(''), { headers: { 'x-request-id': 'provider-id' } });
    };
    const result = await callOpenAI({ payload: { model: 'configured-model' }, signal: new AbortController().signal, onText: x => deltas.push(x), onIdentity: x => identity.push(x), fetcher });
    assert.equal(result.model, 'actually-returned-model'); assert.equal(result.providerRequestId, 'provider-id'); assert.equal(deltas.join(''), 'Dober dan'); assert.equal(count, 1);
    await assert.rejects(callOpenAI({ payload: {}, signal: new AbortController().signal, onText: () => {}, onIdentity: () => {}, fetcher: async () => { count++; return new Response('SECRET_ERROR_DETAIL', { status: 429 }); } }), { code: 'RATE_LIMITED' }); assert.equal(count, 2);
  } finally { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; }
});
test('PWA install verifies complete shell; incomplete update preserves old/foreign caches; API never intercepted', async () => {
  const source = await readFile('public/OmniCPQ/sw.js', 'utf8'), integrity = JSON.parse(await readFile('public/OmniCPQ/shell-integrity.json', 'utf8'));
  const manifest = JSON.parse(await readFile('public/OmniCPQ/manifest.webmanifest', 'utf8'));
  assert.equal(manifest.id, './'); assert.equal(manifest.scope, './'); assert.equal(manifest.display, 'standalone'); assert.equal(manifest.lang, 'sl');
  for (const prefix of ['/OmniCPQ/', '/bd-chessdb/OmniCPQ/']) {
    const listeners = {}, stores = new Map([['other-app-cache', new Map()], ['omnicpq-shell:' + prefix + ':old', new Map()]]); let corrupt = true;
    const cacheAPI = { keys: async () => [...stores.keys()], delete: async k => stores.delete(k), open: async key => {
      if (!stores.has(key)) stores.set(key, new Map()); const map = stores.get(key);
      return { put: async (url, response) => map.set(String(url), response), match: async url => map.get(String(url)) };
    } };
    const fetcher = async url => {
      const name = new URL(url).pathname.slice(prefix.length);
      if (name === 'shell-integrity.json') return Response.json(integrity);
      return new Response(corrupt && name === 'app.mjs' ? 'BROKEN' : await readFile('public/OmniCPQ/' + name));
    };
    vm.runInNewContext(source, { self: { registration: { scope: 'https://example.test' + prefix }, addEventListener: (name, cb) => { listeners[name] = cb; }, clients: { claim: async () => {} }, skipWaiting: () => {} }, caches: cacheAPI, fetch: fetcher, crypto, URL, Response, Map, Set, Uint8Array, Promise });
    const install = () => { let p; listeners.install({ waitUntil: v => { p = v; } }); return p; };
    await assert.rejects(install(), /Invalid shell hash/); assert(stores.has('omnicpq-shell:' + prefix + ':old')); assert(stores.has('other-app-cache'));
    corrupt = false; await install(); let activation; listeners.activate({ waitUntil: p => { activation = p; } }); await activation;
    assert(stores.has('other-app-cache')); assert(!stores.has('omnicpq-shell:' + prefix + ':old'));
    let intercepted = false; listeners.fetch({ request: new Request('https://example.test/.netlify/functions/omnicpq-assistant'), respondWith: () => { intercepted = true; } }); assert.equal(intercepted, false);
    listeners.fetch({ request: new Request('https://cpq.internal/sl'), respondWith: () => { intercepted = true; } }); assert.equal(intercepted, false);
    let cachedResponse; listeners.fetch({ request: new Request('https://example.test' + prefix), respondWith: p => { cachedResponse = p; } }); assert((await cachedResponse).ok);
  }
});

