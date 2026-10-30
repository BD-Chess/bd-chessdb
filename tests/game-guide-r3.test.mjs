import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { makeHandler } from '../functions/game-guide.mjs';
import { createLogStore } from '../functions/lib/game-guide/log.mjs';
import { stepTexts } from '../functions/lib/game-guide/content.mjs';
import { diagnosticEvent } from '../functions/lib/game-guide/diagnostics.mjs';

process.env.MDLXDCC_GUIDE_SESSION_SECRET = 'offline-r3-fixture-only-'.repeat(4);
process.env.MDLXDCC_GUIDE_CLAUDE_MODEL = 'claude-sonnet-5-5';
// This suite exercises the real transport adapter against an in-memory SDK double.
globalThis.fetch = () => assert.fail('network is forbidden in the targeted test');
const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const game = stepTexts(await read('../public/game/dayton1903/index.html'), JSON.parse(await read('../public/game/dayton1903/game.json')));
const fixtures = JSON.parse(await read('./fixtures/r3-provider.synthetic.json'));
const body = extra => ({ slug: 'dayton1903', provider: 'claude', mode: 'IZUMLJAJ', development: true,
  protocol: 'game-guide-tools-v1', opened: ['s1','s2','s3'], learning: { asked: ['s2'], cards: {} },
  history: [{ role: 'user', content: 'Ptice malo zasukajo konice kril … dobi več vzgona in se dvigne.' },
    { role: 'assistant', content: 'Kaj se zgodi na drugi strani?' }],
  message: 'Druga konica se zasuka obratno … letalo se zravna.', ...extra });
const traces = logs => logs.filter(e => e.kind === 'guide_trace');
const results = input => input.flatMap(m => Array.isArray(m.content) ? m.content.filter(c => c.type === 'tool_result').map(c => JSON.parse(c.content)) : []);
function harness(sequence, { visitor = false } = {}) {
  const logs = [], seen = [], rpcCalls = [];
  const store = createLogStore({ rpc: async (action, data) => {
    rpcCalls.push(action);
    if (action === 'game_log_append') logs.push(...structuredClone(data.events));
    return { ok: true };
  } });
  const handler = makeHandler({ accessFactory: async () => ({ role: visitor ? 'visitor' : 'owner', id: 'offline-r3' }),
    publicEnabled: () => true, configured: { claude: true }, logStore: store,
    continuationSecret: () => process.env.MDLXDCC_GUIDE_SESSION_SECRET,
    gameFactory: async () => structuredClone(game), budgetFactory: () => ({ reserve: async () => null, settle: async () => {} }),
    clientFactory: async () => ({ messages: { stream(payload) {
      seen.push(structuredClone(payload));
      const response = structuredClone(sequence[seen.length - 1]); assert.ok(response, `Unexpected round ${seen.length}`);
      return { async *[Symbol.asyncIterator]() {
        for (const block of response.content) if (block.type === 'text') yield { type: 'content_block_delta', delta: { type: 'text_delta', text: block.text } };
      }, finalMessage: async () => response };
    } } }) });
  return { logs, seen, rpcCalls, async post(value) {
    const response = await handler(new Request('https://www.mdlxdcc.org/.netlify/functions/game-guide', {
      method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(value) }));
    assert.equal(response.status, 200);
    return (await response.text()).split('\n\n').filter(Boolean).map(frame => JSON.parse(frame.slice(6)));
  } };
}
async function turn(h, value) {
  const events = []; let next = value;
  for (let hop = 0; hop < 3; hop++) {
    const batch = await h.post(next); events.push(...batch);
    const token = batch.find(e => e.type === 'continue')?.token;
    if (!token) return events;
    next = { continuation: token, receipts: batch.filter(e => e.type === 'action').map(a => ({ call_id:a.call_id, name:a.name, opened:a.id, ok:true, visible:true, already_open:false })) };
  }
  assert.fail('Unexpected continuation loop');
}
const ok = events => { assert.ok(events.some(e => e.type === 'done')); assert.ok(!events.some(e => e.type === 'error')); };

test('R3 native adapter: reported Dayton body, rejected unknown tool, one correction, assessment and visible s6 in both modes', async () => {
  for (const development of [true, false]) {
    const h = harness([fixtures.unknown_tool, fixtures.assessment, fixtures.reveal, fixtures.done]);
    const events = await turn(h, body({ development })); ok(events);
    assert.deepEqual(events.filter(e => e.type === 'action').map(e => e.id), ['s6']);
    assert.equal(h.seen.length, 4);
    const rejection = results(h.seen[1].messages).at(-1);
    assert.equal(rejection.error, 'TOOL_NOT_AVAILABLE');
    assert.ok(rejection.allowed_tools.includes('assess_challenge'));
    assert.equal(rejection.allowed_tools.includes('mark_result'), !development);
    assert.equal(rejection.reveal_after_assessment.id, 's6');
    const rejected = traces(h.logs).find(e => e.payload.tool_uses?.[0]?.result?.error);
    assert.equal(rejected.payload.tool_uses[0].name, 'learning');
    assert.deepEqual(rejected.payload.tool_uses[0].args, { step:'s2', card:'A' });
    assert.equal(rejected.payload.round_count, 1);
    assert.ok(traces(h.logs).some(e => e.payload.phase === 'browser_result' && e.payload.result.visible));
    if (process.env.R3_EVIDENCE_DIR) await writeFile(`${process.env.R3_EVIDENCE_DIR}/TRACE_${development ? 'DEV' : 'PLAY'}.json`, JSON.stringify({ source:'synthetic SDK response; not live provider evidence', logs:h.logs }, null, 2));
  }
});

test('R3 invalid reveal gets assessment prerequisite and recovers within the four-round bound', async () => {
  const h = harness([fixtures.reveal, fixtures.assessment, fixtures.reveal, fixtures.done]);
  ok(await turn(h, body()));
  const rejected = traces(h.logs).find(e => e.payload.tool_uses?.[0]?.result?.error);
  assert.equal(rejected.payload.tool_uses[0].result.error, 'UNDERSTANDING_BEFORE_REVEAL');
  assert.equal(h.seen.length, 4);
});

test('R3 repeated invalid call produces private reason and last text, then safe done without TOOL_LIMIT', async () => {
  const h = harness([fixtures.unknown_tool, fixtures.unknown_tool]);
  const events = await turn(h, body()); ok(events);
  assert.equal(h.seen.length, 2); assert.ok(!events.some(e => e.type === 'action'));
  assert.ok(events.some(e => e.type === 'done' && e.recovered));
  assert.ok(!/Kartico bom|TOOL_LIMIT|learning|s6/.test(events.filter(e => e.type === 'delta').map(e => e.text).join('')));
  const stop = traces(h.logs).at(-1).payload;
  assert.equal(stop.round_count, 2); assert.equal(stop.reason, 'TOOL_LIMIT');
  assert.equal(stop.last_model_text, 'Kartico bom pripravil.');
});

test('R3 visitor consent gates every diagnostic, including a supplied existing session ID', async () => {
  for (const consent of [false, true]) {
    const h = harness([fixtures.unknown_tool, fixtures.unknown_tool], { visitor: true });
    ok(await turn(h, body({ development:false, log_consent:consent, game_session_id:'11111111-1111-4111-8111-111111111111' })));
    assert.equal(traces(h.logs).length > 0, consent);
    if (!consent) { assert.deepEqual(h.rpcCalls, []); assert.deepEqual(h.logs, []); }
  }
});

test('R3 diagnostics redact credentials, cookies, email/IP, and bound oversized model data', () => {
  const event = diagnosticEvent('model_round', { round_count:1, tool_uses:[{ name:'learning', args:{
    api_key:'must-not-persist', Cookie:'session=must-not-persist', nested:{ authorization:'must-not-persist' },
    why:'Bearer hidden-credential api_key=hidden-value sk-ant-abcdefghijklmnop owner@example.test 192.0.2.7',
    raw:'{"token":"hidden-json-value"} __Host-session=hidden-cookie' } }] });
  const text = JSON.stringify(event);
  assert.ok(!/must-not-persist|hidden-credential|hidden-value|hidden-json-value|hidden-cookie|sk-ant-|owner@example|192\.0\.2\.7/.test(text));
  const huge = diagnosticEvent('model_round', { tool_uses:Array.from({length:48}, () => ({ args:{ why:'Ž'.repeat(20000) } })) });
  assert.ok(Buffer.byteLength(JSON.stringify(huge.payload)) <= 160000); assert.equal(huge.payload.truncated, true);
});

test('R3 database constraint accepts private trace and still rejects unknown event kinds', { skip: !process.env.GAME_LOG_PGLITE_MODULE }, async () => {
  const { PGlite } = await import(process.env.GAME_LOG_PGLITE_MODULE);
  const db = new PGlite();
  try {
    await db.exec("create schema mdlxdcc_guide_private; create table mdlxdcc_guide_private.game_events (kind text constraint game_events_kind_check check (kind in ('player_message','agent_response','open_step','set_mode','mark_result','fair_play','cost','error')), payload jsonb check (octet_length(payload::text) <= 160000));");
    await db.exec(await read('../supabase/migrations/20261030081530_game_guide_trace.sql'));
    await db.query('insert into mdlxdcc_guide_private.game_events values ($1,$2)', ['guide_trace', JSON.stringify(diagnosticEvent('model_round', { round_count:1 }).payload)]);
    await assert.rejects(db.exec("insert into mdlxdcc_guide_private.game_events values ('arbitrary','{}')"));
  } finally { await db.close(); }
});
