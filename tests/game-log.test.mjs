import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { makeHandler } from '../functions/game-guide.mjs';
import { sessionCookie, accessError } from '../functions/lib/mdlxdcc-guide/access.mjs';
import { createLogStore, actorKey, privateText } from '../functions/lib/game-guide/log.mjs';
import { validateBody } from '../functions/lib/game-guide/runtime.mjs';

process.env.MDLXDCC_GUIDE_SESSION_SECRET = 'offline-fixture-only-'.repeat(4);
process.env.MDLXDCC_GUIDE_OWNER_EMAIL = 'owner@example.test';
process.env.MDLXDCC_GUIDE_DATABASE_URL = '';
process.env.MDLXDCC_GUIDE_CLAUDE_MODEL = 'claude-sonnet-5-5';
const owner = { id: 'owner', role: 'owner', email: 'owner@example.test' };
const visitor = { id: randomUUID(), role: 'visitor', email: 'visitor@example.test' };
const token = 'offline-reader-token-'.repeat(3), id = randomUUID();
const url = 'https://www.mdlxdcc.org/.netlify/functions/game-guide';
const cookie = sessionCookie(owner).split(';')[0];
const fixture = JSON.parse(await readFile(new URL('../public/game/_fixture/game.json', import.meta.url)));
const message = { slug: '_fixture', provider: 'claude', mode: 'ZGODBA', development: true, message: 'Pokaži vse' };
const req = (query = '', headers = {}, method = 'GET', body) => new Request(url + query, { method, headers: { ...headers, ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
const denied = async () => { throw accessError('AUTH_REQUIRED', 401); };
function storeFixture() {
  const calls = [], logs = [];
  const store = createLogStore({ rpc: async (action, data) => {
    calls.push({ action, data });
    if (action === 'game_log_start') return { ok: true, id: data.id };
    if (action === 'game_log_append') { logs.push(...data.events); return { ok: true }; }
    if (action === 'game_log_read') return { events: [{ game_session_id: data.id, seq: data.since + 1, kind: 'player_message', payload: { text: 'hi' } }] };
    if (action === 'game_log_recent') return { sessions: [{ game_session_id: id }] };
    return { ok: true };
  } });
  return { store, calls, logs };
}

test('real owner cookie OR reader token can read JSONL/recent; missing/wrong/expired credentials and visitor get 401', async () => {
  const { store } = storeFixture();
  const h = makeHandler({ logStore: store, readToken: token, publicEnabled: () => false });
  for (const headers of [{ cookie }, { authorization: 'Bearer ' + token }]) {
    const r = await h(req(`?log=${id}&since=4`, headers));
    assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /ndjson/);
    assert.equal(JSON.parse((await r.text()).trim()).seq, 5);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.equal((await h(req('?logs=recent', headers))).status, 200);
  }
  for (const headers of [{}, { authorization: 'Bearer ' + 'x'.repeat(60) }, { cookie: cookie + 'corrupt' }, { cookie: sessionCookie(owner, Date.now() - 9 * 3600000) }, { cookie: sessionCookie(visitor) }]) {
    assert.equal((await h(req(`?log=${id}`, headers))).status, 401);
    assert.equal((await h(req('?logs=recent', headers))).status, 401);
  }
  assert.equal((await h(req(`?log=${id}&since=-1`, { cookie }))).status, 400);
  assert.equal((await h(req('?log=bad', { cookie }))).status, 400);
});

test('reader token has no play/delete authority; deletion requires the actor cookie', async () => {
  const { store, calls } = storeFixture();
  const h = makeHandler({ logStore: store, readToken: token, publicEnabled: () => false });
  assert.equal((await h(req('', { authorization: 'Bearer ' + token }, 'POST', message))).status, 403);
  assert.equal((await h(req(`?log=${id}`, { authorization: 'Bearer ' + token }, 'DELETE'))).status, 403);
  assert.equal(calls.length, 0);
  assert.equal((await h(req(`?log=${id}`, { cookie }, 'DELETE'))).status, 200);
  assert.equal(calls[0].action, 'game_log_delete');
  assert.equal(calls[0].data.actor_key, actorKey(owner));
});

test('manual UI actions are recorded without constructing a model client', async () => {
  const { store, logs } = storeFixture();
  const h = makeHandler({ logStore: store, gameFactory: async () => fixture, clientFactory: () => assert.fail('no model') });
  const r = await h(req('', { cookie }, 'POST', { ...message, operation: 'event', client_action: { name: 'set_mode', mode: 'IZUMLJAJ' } }));
  assert.equal(r.status, 200); assert.ok((await r.json()).game_session_id);
  assert.equal(logs[0].kind, 'set_mode'); assert.equal(logs[0].payload.client_reported, true);
});

test('public consent defaults NO, including an existing ID: zero log RPCs; explicit consent creates a random session', async () => {
  const { store, calls } = storeFixture();
  const body = validateBody({ ...message, development: false, game_session_id: id });
  assert.equal(await store.start(visitor, body), null); assert.equal(calls.length, 0);
  assert.throws(() => validateBody({ ...message, log_consent: 'true' }));
  const session = await store.start(visitor, { ...body, game_session_id: null, log_consent: true });
  assert.match(session.id, /^[0-9a-f-]{36}$/); assert.notEqual(session.id, id);
  assert.doesNotMatch(JSON.stringify(calls), /visitor@example|email|ip_address/);
});

test('owner development logs message/signals/actions/zero cost, no learning result or provider call', async () => {
  const { store, logs, calls } = storeFixture();
  const h = makeHandler({ logStore: store, configured: { claude: true }, gameFactory: async () => fixture,
    clientFactory: () => assert.fail('No provider needed'), budgetFactory: () => ({}) });
  const r = await h(req('', { cookie }, 'POST', message)); const output = await r.text();
  assert.match(output, /"type":"session"/); assert.match(output, /"type":"done"/);
  assert.equal(logs[0].kind, 'player_message'); assert.equal(logs[1].kind, 'fair_play');
  assert.equal(logs.filter(e => e.kind === 'open_step').length, fixture.steps.length);
  assert.equal(logs.some(e => e.kind === 'mark_result'), false);
  assert.equal(logs.find(e => e.kind === 'cost').payload.nanos, 0);
  assert.doesNotMatch(JSON.stringify(calls), /owner@example|cookie|authorization/);
  assert.equal(privateText('a@example.test 192.0.2.1 2001:db8::1'), '[email] [ip] [ip]');
});

test('normal response records provider/model, validated tool actions and Guide cost; no-consent handler writes nothing', async () => {
  for (const consenting of [false, true]) {
    const { store, calls, logs } = storeFixture(); let rounds = 0;
    const h = makeHandler({ accessFactory: async () => visitor, publicEnabled: () => true, logStore: store,
      configured: { claude: true }, gameFactory: async () => fixture, clientFactory: async () => ({}),
      budgetFactory: () => ({ reserve: async () => ({ amount: 10000000 }), settle: async () => {} }),
      round: async ({ budget, onText }) => {
        const held = await budget.reserve({ max_tokens: 2400, messages: [] });
        await budget.settle(held, { input_tokens: 10, output_tokens: 5 }); rounds++;
        onText('Pozdrav!');
        return { response: { content: [] }, text: 'Pozdrav!', calls: rounds === 1 ? [{ name: 'set_mode', arguments: { mode: 'IZUMLJAJ' }, call_id: 'fixture' }] : [] };
      } });
    const r = await h(req('', {}, 'POST', { ...message, development: false, message: 'Živjo', log_consent: consenting }));
    assert.match(await r.text(), /"type":"done"/);
    if (!consenting) assert.equal(calls.length, 0);
    else {
      assert.ok(logs.some(e => e.kind === 'set_mode'));
      assert.ok(logs.some(e => e.kind === 'agent_response' && e.payload.model));
      assert.ok(logs.some(e => e.kind === 'cost' && e.payload.phase === 'settled' && e.payload.nanos > 0));
    }
  }
});

test('actual Postgres: migration/RLS/consent/sequence/paging/ownership/erasure/tombstone and existing Guide dispatcher', async () => {
  const { PGlite } = await import(process.env.GAME_LOG_PGLITE_MODULE || '@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated;');
    await db.exec(await readFile(process.env.GAME_LOG_BASE_SQL || new URL('../supabase/migrations/20261019164920_mdlxdcc_guide_access_budget.sql', import.meta.url), 'utf8'));
    const names = await readdir(new URL('../supabase/migrations/', import.meta.url));
    const name = names.find(n => n.endsWith('_game_guide_log.sql')); assert.ok(name);
    await db.exec(await readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8'));
    const secret = 'offline-db-fixture', digest = createHash('sha256').update(secret).digest('hex');
    await db.query('insert into mdlxdcc_guide_private.config(server_key_sha256) values ($1)', [digest]);
    const rpc = async (action, data = {}) => (await db.query('select public.mdlxdcc_guide($1,$2::jsonb) as result', [action, JSON.stringify(data)])).rows[0].result;
    await db.exec('set role anon;');
    await assert.rejects(rpc('game_log_recent'));
    assert.equal((await db.query('select * from mdlxdcc_guide_private.game_events')).rows.length, 0);
    await db.query("select set_config('request.headers',$1,false)", [JSON.stringify({ 'x-mdlxdcc-guide-key': secret })]);
    const data = { id, actor_key: 'a'.repeat(64), slug: '_fixture', owner: false, consent: false, development: false };
    await rpc('game_log_start', data);
    assert.equal((await db.query('select * from mdlxdcc_guide_private.game_sessions')).rows.length, 0);
    await rpc('game_log_start', { ...data, consent: true });
    await assert.rejects(rpc('game_log_start', { ...data, consent: true, actor_key: 'b'.repeat(64) }));
    const events = [{ kind: 'player_message', payload: { text: 'hi' } }, { kind: 'set_mode', payload: { mode: 'IZUMLJAJ' } }];
    await rpc('game_log_append', { ...data, events });
    await rpc('game_log_append', { ...data, events });
    assert.deepEqual((await rpc('game_log_read', { id, since: 2 })).events.map(e => e.seq), [3, 4]);
    await assert.rejects(rpc('game_log_append', { ...data, events: [...events, { kind: 'forbidden', payload: {} }] }));
    assert.equal((await rpc('game_log_recent')).sessions[0].last_seq, 4, 'failed batch is atomic');
    const pageID = randomUUID(), pageData = { ...data, id: pageID, consent: true };
    await rpc('game_log_start', pageData);
    await rpc('game_log_append', { ...pageData, events: Array.from({ length: 25 }, () => events[0]) });
    const page1 = await rpc('game_log_read', { id: pageID, since: 0 });
    const page2 = await rpc('game_log_read', { id: pageID, since: page1.events.at(-1).seq });
    assert.equal(page1.events.length, 20); assert.equal(page2.events.length, 5);
    assert.equal(page2.events[0].seq, 21);
    await rpc('game_log_delete', pageData);
    await assert.rejects(rpc('game_log_append', { ...data, actor_key: 'b'.repeat(64), events }));
    await rpc('game_log_delete', { ...data, actor_key: 'b'.repeat(64) });
    assert.equal((await rpc('game_log_read', { id })).events.length, 4);
    await rpc('game_log_delete', data);
    assert.equal((await rpc('game_log_read', { id })).events.length, 0);
    assert.deepEqual((await rpc('game_log_recent')).sessions, []);
    assert.equal((await db.query('select actor_key from mdlxdcc_guide_private.game_sessions')).rows[0].actor_key, null);
    await assert.rejects(rpc('game_log_append', { ...data, events }));
    await assert.rejects(rpc('game_log_start', { ...data, consent: true }));
    assert.equal((await rpc('account_active', { id: visitor.id })).active, false);
    await db.query("select set_config('request.headers','{}',false)");
    await assert.rejects(rpc('game_log_read', { id }));
    assert.equal((await db.query('select * from mdlxdcc_guide_private.game_sessions')).rows.length, 0);
  } finally { await db.close(); }
});
