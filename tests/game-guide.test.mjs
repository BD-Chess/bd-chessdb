import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeHandler } from '../functions/game-guide.mjs';
import { authenticate, sessionCookie } from '../functions/lib/mdlxdcc-guide/access.mjs';
import { validateBody, validateGame, createSession, gameTools, loadGame, instructions } from '../functions/lib/game-guide/runtime.mjs';

const game = JSON.parse(await readFile(new URL('../public/game/_fixture/game.json', import.meta.url)));
const owner = { id: 'owner', role: 'owner', email: 'owner@example.invalid' };
const visitor = { id: 'v1', role: 'visitor', email: 'visitor@example.invalid' };
process.env.MDLXDCC_GUIDE_SESSION_SECRET = 'synthetic-test-secret-'.repeat(4);
process.env.MDLXDCC_GUIDE_OWNER_EMAIL = owner.email;
const cookie = actor => sessionCookie(actor).split(';')[0];
const request = (body = {}, headers = {}, method = 'POST') => new Request('https://www.mdlxdcc.org/.netlify/functions/game-guide', { method, headers: { 'Content-Type': 'application/json', cookie: cookie(owner), ...headers }, ...(method === 'POST' ? { body: JSON.stringify({ slug: '_fixture', message: 'Nadaljuj', ...body }) } : {}) });
// GAME-LOG-R1: these Guide tests do not exercise logging; inject a store that never logs.
const noLog = { start: async () => null, append: async () => {} };
const base = { logStore: noLog, configured: { claude: true, gpt: true }, gameFactory: async () => game, accessFactory: req => authenticate(req, { rpc: async () => ({ active: true }) }) };
const readEvents = async response => (await response.text()).split('\n\n').filter(Boolean).map(line => JSON.parse(line.slice(6)));
function fakeClient(provider, frames, capture = []) {
  let i = 0;
  if (provider === 'claude') return { messages: { stream(payload) {
    capture.push(payload); const frame = frames[i++];
    assert.ok(frame, 'unexpected provider round');
    const response = { content: [...(frame.text ? [{ type: 'text', text: frame.text }] : []), ...(frame.calls || []).map((c, n) => ({ type: 'tool_use', id: 'c' + n, name: c.name, input: c.args }))], usage: { input_tokens: 12, output_tokens: 4 } };
    return { async *[Symbol.asyncIterator]() { if (frame.text) yield { type: 'content_block_delta', delta: { type: 'text_delta', text: frame.text } }; }, async finalMessage() { return response; } };
  } } };
  return { responses: { async create(payload) {
    capture.push(payload); const frame = frames[i++]; assert.ok(frame, 'unexpected provider round');
    return { async *[Symbol.asyncIterator]() {
      if (frame.text) yield { type: 'response.output_text.delta', delta: frame.text };
      yield { type: 'response.completed', response: { status: 'completed', output: (frame.calls || []).map((c, n) => ({ type: 'function_call', call_id: 'c' + n, name: c.name, arguments: JSON.stringify(c.args) })), usage: { input_tokens: 12, output_tokens: 4 } } };
    } };
  } } };
}

test('owner cookie, absent/forged/expired cookie, visitor gate, origin and development access', async () => {
  const handler = makeHandler(base);
  const get = headers => request({}, headers, 'GET');
  assert.equal((await handler(get({}))).status, 200);
  for (const c of ['', cookie(visitor), cookie(owner) + 'x', sessionCookie(owner, Date.now() - 9 * 3600000).split(';')[0]]) {
    const r = await handler(get({ cookie: c })); assert.equal(r.status, 403); assert.equal((await r.json()).error.code, 'GAME_NOT_OPEN');
  }
  assert.equal((await handler(get({ origin: 'https://evil.invalid' }))).status, 403);
  const publicHandler = makeHandler({ ...base, publicEnabled: () => true });
  assert.equal((await publicHandler(get({ cookie: '' }))).status, 401);
  assert.equal((await publicHandler(get({ cookie: cookie(visitor) }))).status, 200);
  const r = await publicHandler(request({ development: true }, { cookie: cookie(visitor) }));
  assert.equal(r.status, 403); assert.equal((await r.json()).error.code, 'DEVELOPMENT_OWNER_ONLY');
});

test('validation restricts slug, provider, mode and signals without accepting pasted contents', () => {
  const body = validateBody({ slug: '_fixture', message: 'Pojdiva', fair_play: { paste_events: 1, paste_length: 16, contents: 'NEVER_FORWARD' } });
  assert.equal(body.provider, 'claude'); assert.equal(body.mode, 'ZGODBA'); assert.equal(JSON.stringify(body).includes('NEVER_FORWARD'), false);
  for (const patch of [{ slug: '../private' }, { provider: 'other' }, { mode: 'admin' }, { message: '' }, { fair_play: { typing_ms: -1 } }]) assert.throws(() => validateBody({ slug: '_fixture', message: 'hi', ...patch }));
  validateGame(game, '_fixture'); assert.throws(() => validateGame({ ...game, steps: [game.steps[0], game.steps[0]] }, '_fixture'));
});

test('server loads only a fixed own-origin allowlisted JSON path and disallows redirects', async () => {
  let seen;
  await loadGame('_fixture', { fetcher: async (url, options) => { seen = { url, options }; return Response.json(game); } });
  assert.equal(seen.url, 'https://www.mdlxdcc.org/game/_fixture/game.json'); assert.equal(seen.options.redirect, 'error');
  await assert.rejects(loadGame('https://evil.invalid', { fetcher: () => assert.fail('must not fetch') }));
});

test('story skips challenges/hints and enforces sequential story/reveal/epilogue', () => {
  const session = createSession(game, validateBody({ slug: '_fixture', message: 'Naprej' }));
  assert.throws(() => session.execute('open_step', { id: 's2' }), /STORY_ONLY/);
  assert.throws(() => session.execute('open_step', { id: 's3' }), /STORY_ONLY/);
  assert.throws(() => session.execute('open_step', { id: 's9' }), /STEP_ORDER/);
  for (const id of ['s4', 's7', 's8', 's9']) assert.equal(session.execute('open_step', { id }).action.id, id);
  assert.throws(() => session.execute('open_step', { id: 'other' }), /INVALID_STEP/);
});

test('invent mode requires explicit hint request, ordered tiers, reveal before provisional label', () => {
  let session = createSession(game, validateBody({ slug: '_fixture', message: 'Naprej', mode: 'IZUMLJAJ' }));
  session.execute('open_step', { id: 's2' });
  assert.throws(() => session.execute('open_step', { id: 's3' }), /HINT_ON_REQUEST/);
  assert.throws(() => session.execute('mark_result', { step: 's2', label: 'samostojno' }), /RESULT_AFTER_REVEAL/);
  session = createSession(game, validateBody({ slug: '_fixture', message: 'Prosim za namig', mode: 'IZUMLJAJ', opened: ['s2'] }));
  session.execute('open_step', { id: 's3' }); session.execute('open_step', { id: 's4' });
  assert.throws(() => session.execute('mark_result', { step: 's2', label: 'samostojno' }), /HELP_WAS_OPENED/);
  assert.equal(session.execute('mark_result', { step: 's2', label: 's_pomocjo' }).action.label, 's_pomocjo');
  assert.throws(() => session.execute('mark_result', { step: 's2', label: 'cheater' }), /INVALID_RESULT/);
  const tierGame = structuredClone(game); tierGame.steps.splice(3, 0, { ...game.steps[2], id: 's3b', tier: 2 });
  session = createSession(tierGame, validateBody({ slug: '_fixture', message: 'namig', mode: 'IZUMLJAJ', opened: ['s2'] }));
  assert.throws(() => session.execute('open_step', { id: 's3b' }), /HINT_ORDER/);
  session.execute('open_step', { id: 's3' }); session.execute('open_step', { id: 's3b' });
});

test('development can open all steps but exposes no result tool and rejects forged result call', () => {
  const body = validateBody({ slug: '_fixture', message: 'Pokaži vse', development: true });
  const session = createSession(game, body);
  for (const s of [...game.steps].reverse()) session.execute('open_step', { id: s.id });
  assert.equal(gameTools(true).some(t => t.name === 'mark_result'), false);
  assert.throws(() => session.execute('mark_result', { step: 's2', label: 'samostojno' }), /DEVELOPMENT_NO_RESULTS/);
  assert.match(instructions(game, body), /NIKOLI ne kliči mark_result/);
});

for (const provider of ['claude', 'gpt']) test(`${provider}: shared real provider transport, budget reserve/settle, SSE tools and final text`, async () => {
  const payloads = [], ledger = [], client = fakeClient(provider, [{ calls: [{ name: 'open_step', args: { id: 's4' } }] }, { text: 'Plošča se nagne.' }], payloads);
  const handler = makeHandler({ ...base, clientFactory: async p => { assert.equal(p, provider); return client; }, budgetFactory: (actor, p, model) => {
    assert.equal(actor.role, 'owner'); assert.equal(p, provider);
    assert.equal(model, provider === 'claude' ? 'claude-sonnet-5-5' : 'gpt-6-luna');
    return { reserve: async payload => { ledger.push('reserve'); return { id: 'mock' }; }, settle: async (_, usage) => { assert.ok(usage); ledger.push('settle'); } };
  } });
  const response = await handler(request({ provider })); assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const events = await readEvents(response);
  assert.equal(events.find(e => e.type === 'action').id, 's4'); assert.equal(events.find(e => e.type === 'delta').text, 'Plošča se nagne.'); assert.equal(events.at(-1).type, 'done');
  assert.deepEqual(ledger, ['reserve', 'settle', 'reserve', 'settle']); assert.equal(payloads.length, 2);
});

test('default Claude and forged development result cannot emit a result action', async () => {
  const client = fakeClient('claude', [{ calls: [{ name: 'mark_result', args: { step: 's2', label: 'samostojno' } }] }, { text: 'Razvoj je brez beleženja.' }]);
  const handler = makeHandler({ ...base, clientFactory: async p => { assert.equal(p, 'claude'); return client; } });
  const events = await readEvents(await handler(request({ development: true })));
  assert.equal(events.some(e => e.type === 'action'), false); assert.equal(events.at(-1).type, 'done');
});

test('owner development show-all is deterministic and makes no provider round', async () => {
  const handler = makeHandler({ ...base, clientFactory: () => assert.fail('no client needed'), round: () => assert.fail('no provider call needed') });
  const events = await readEvents(await handler(request({ development: true, message: 'Pokaži vse' })));
  assert.deepEqual(events.filter(e => e.type === 'action').map(e => e.id), game.steps.map(s => s.id));
  assert.equal(events.at(-1).type, 'done'); assert.equal(events.at(-1).model, null);
});

test('Claude multiple tool results remain in one immediately following user message', async () => {
  const payloads = [];
  const handler = makeHandler({ ...base, clientFactory: async () => fakeClient('claude', [{ calls: [{ name: 'open_step', args: { id: 's2' } }, { name: 'open_step', args: { id: 's3' } }] }, { text: 'Odprto.' }], payloads) });
  const events = await readEvents(await handler(request({ development: true })));
  assert.equal(events.at(-1).type, 'done');
  const toolMessage = payloads[1].messages.at(-1); assert.equal(toolMessage.role, 'user'); assert.equal(toolMessage.content.length, 2);
  assert.ok(toolMessage.content.every(c => c.type === 'tool_result'));
});

test('deadline covers hanging game lookup; provider internals never escape', async () => {
  let handler = makeHandler({ ...base, timeoutMs: 15, gameFactory: () => new Promise(() => {}) });
  let events = await readEvents(await handler(request())); assert.equal(events.at(-1).code, 'TIMEOUT');
  handler = makeHandler({ ...base, clientFactory: async () => { throw Error('PRIVATE_PROVIDER_CREDENTIAL'); } });
  events = await readEvents(await handler(request())); assert.equal(events.at(-1).code, 'ANSWER_UNAVAILABLE'); assert.equal(JSON.stringify(events).includes('PRIVATE_PROVIDER_CREDENTIAL'), false);
});

test('fixture HTML mirrors JSON: 3 acts × 3 steps, first visible, all other steps hidden', async () => {
  const html = await readFile(new URL('../public/game/_fixture/index.html', import.meta.url), 'utf8');
  const sections = [...html.matchAll(/<section\b([^>]+)>/g)].map(m => m[1]); assert.equal(sections.length, 9);
  for (const [i, attrs] of sections.entries()) {
    const step = game.steps[i]; assert.ok(attrs.includes(`id="${step.id}"`)); assert.ok(attrs.includes(`data-kind="${step.kind}"`)); assert.ok(attrs.includes(`data-act="${step.act}"`)); assert.equal(/\bhidden\b/.test(attrs), i > 0);
    if (step.for) assert.ok(attrs.includes(`data-for="${step.for}"`));
  }
  for (const act of game.acts) assert.equal(game.steps.filter(s => s.act === act.act).length, 3);
  assert.match(html, /name="robots" content="noindex"/);
  const injections = [
    '<link rel="stylesheet" href="/assets/game-guide/game-guide.css">',
    '<script type="module" src="/assets/game-guide/game-guide.js"></script>'
  ];
  let content = html;
  for (const line of injections) {
    assert.equal(content.split(line).length - 1, 1, 'exactly one trusted injection: ' + line);
    content = content.replace(line, '');
  }
  assert.equal(/<script\b|\son[a-z]+\s*=|javascript\s*:/i.test(content), false, 'only the two trusted asset lines may inject runtime code');
  assert.equal(/<link\b/i.test(content), false, 'no additional asset injection');
});
