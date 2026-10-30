import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeHandler } from '../functions/game-guide.mjs';
import { createSession, validateBody, unsafeReply, openingClaim, modelContext } from '../functions/lib/game-guide/runtime.mjs';
import { stepTexts } from '../functions/lib/game-guide/content.mjs';
import { usageSummary, stopReason } from '../functions/lib/game-guide/log.mjs';
import { diagnosticEvent } from '../functions/lib/game-guide/diagnostics.mjs';

// P0-R3.4 regressions from playtest 803fdb92 (moves 15/17/20/21). All providers are offline doubles.
globalThis.fetch = () => assert.fail('network forbidden');
const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const game = stepTexts(await read('../public/game/dayton1903/index.html'), JSON.parse(await read('../public/game/dayton1903/game.json')));
const observed = JSON.parse(await read('./fixtures/game-r34-playtest.observed.json'));
const s14 = game.steps.find(s => s.id === 's14'), idea = id => s14.key.key_ideas.find(x => x.id === id).text;
const card = line => ({ card: 'A', line, achieved: [], independent: [], score: 3 });
const learning = { asked: ['s2', 's2', 's8', 's8'], asked_ideas: {}, cards: { s2: card('Kartica A · zgodovinska pot · 3/5'), s8: card('Kartica A · zgodovinska pot · 3/5') } };
const move20Learning = () => ({ ...structuredClone(learning), asked: [...learning.asked, 's14'], asked_ideas: { s14: [observed.move20.asked_before.idea] } });
const body = (move, extra = {}) => ({ slug: 'dayton1903', provider: 'claude', mode: 'IZUMLJAJ', development: true, protocol: 'game-guide-tools-v1',
  opened: observed[move].opened, learning: structuredClone(learning), history: [], message: observed[move].player_message, ...extra });
const session = (move, extra) => createSession(game, validateBody(body(move, extra)));
const modelText = (move, seq) => observed[move].events.find(e => e.seq === seq).last_model_text;

test('R3.4 guard: observed »že odprt« / »v odprtem besedilu« prose about visible steps is not an opening claim', () => {
  assert.equal(observed.move15.events[1].payload.code, 'OPEN_STEP_REQUIRED'); assert.equal(observed.move17.events.at(-1).reason, 'OPEN_STEP_REQUIRED');
  assert.equal(unsafeReply(modelText('move15', 142), game, session('move15')), null);
  for (const seq of [168, 172]) assert.equal(unsafeReply(modelText('move17', seq), game, session('move17')), null, String(seq));
  // Same claims without the visible step remain violations (s14 not opened yet / named unopened step).
  assert.equal(unsafeReply(modelText('move17', 168), game, session('move15')), 'OPEN_STEP_REQUIRED');
  assert.equal(unsafeReply('Izziv je že odprt na desni.', game, session('move15')), 'OPEN_STEP_REQUIRED');
});
test('R3.4 guard: real opening claims, next/new steps and unopened hint/reveal stay OPEN_STEP_REQUIRED', () => {
  const s = session('move17');
  for (const text of ['Odprl sem izziv na desni.', 'Odpiram razkritje.', 'Na desni se je odprl nov korak.', 'Naslednji izziv je že odprt na desni.',
    'Namig je že odprt na desni.', 'Razkritje je že odprto, preberi ga.', 'Že odprto »Gibljivo smerno krmilo« preberi na desni.', 'The next step is already open.'])
    assert.equal(openingClaim(text, game, s), true, text);
  const hinted = session('move20', { learning: move20Learning() });
  for (const text of ['V odprtem namigu piše, da zvito krilo zaostaja.', 'Namig je že odprt na desni.', 'Izziv »Zakaj se zavrti in kaj spremeniš?« je že odprt.', 'To ostaja odprto vprašanje.'])
    assert.equal(openingClaim(text, game, hinted), false, text);
});

function provider(kind, rounds, logs) {
  let at = 0; const payloads = [];
  const client = kind === 'claude' ? { messages: { stream(payload) {
    payloads.push(structuredClone(payload)); const r = rounds[at++]; assert.ok(r, 'unexpected provider round');
    const content = [...(r.text ? [{ type: 'text', text: r.text }] : []), ...(r.call ? [{ type: 'tool_use', id: `call_${at}`, name: r.call[0], input: r.call[1] }] : [])];
    const response = { content, stop_reason: r.call ? 'tool_use' : 'end_turn', usage: r.usage ?? { input_tokens: 10, output_tokens: 2 } };
    return { async *[Symbol.asyncIterator]() { if (r.text) yield { type: 'content_block_delta', delta: { type: 'text_delta', text: r.text } }; }, finalMessage: async () => response };
  } } } : { responses: { async create(payload) {
    payloads.push(structuredClone(payload)); const r = rounds[at++]; assert.ok(r, 'unexpected provider round');
    const output = [...(r.text ? [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: r.text }] }] : []),
      ...(r.call ? [{ type: 'function_call', call_id: `call_${at}`, name: r.call[0], arguments: JSON.stringify(r.call[1]) }] : [])];
    const response = { output, status: r.status ?? 'completed', ...(r.incomplete ? { incomplete_details: { reason: r.incomplete } } : {}), usage: r.usage ?? { input_tokens: 10, output_tokens: 2 } };
    return (async function* () { if (r.text) yield { type: 'response.output_text.delta', delta: r.text }; yield { type: response.status === 'incomplete' ? 'response.incomplete' : 'response.completed', response }; })();
  } } };
  const handler = makeHandler({ accessFactory: async () => ({ role: 'owner', id: 'offline-r34' }), configured: { claude: true, gpt: true },
    gameFactory: async () => structuredClone(game), clientFactory: async () => client, continuationSecret: () => 'offline-r34-secret-'.repeat(4),
    logStore: { start: async () => ({ id: '00000000-0000-4000-8000-000000000034' }), append: async (_, events) => logs.push(...structuredClone(events)) } });
  return { payloads, async run(value) {
    const events = []; let next = value;
    for (let n = 0; n < 4; n++) {
      const response = await handler(new Request('https://www.mdlxdcc.org/.netlify/functions/game-guide', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(next) }));
      assert.equal(response.status, 200); const batch = (await response.text()).split('\n\n').filter(Boolean).map(x => JSON.parse(x.slice(6))); events.push(...batch);
      const token = batch.find(x => x.type === 'continue')?.token; if (!token) return events;
      next = { continuation: token, receipts: batch.filter(x => x.type === 'action').map(x => ({ call_id: x.call_id, name: x.name, opened: x.id, ok: true, visible: true, already_open: false })) };
    }
    assert.fail('continuation bound');
  } };
}
const text = events => events.filter(e => e.type === 'delta').map(e => e.text).join('');
const results = payloads => payloads.flatMap(p => (p.messages || p.input || []).flatMap(m => Array.isArray(m.content) ? m.content.filter(c => c.type === 'tool_result').map(c => JSON.parse(c.content)) : m.type === 'function_call_output' ? [JSON.parse(m.output)] : []));

for (const kind of ['claude', 'gpt']) test(`R3.4 ${kind}: moves 15 and 17 answer in one round, no rejection, no turn stop, no unrequested opening`, async () => {
  for (const [move, seq] of [['move15', 142], ['move17', 168]]) {
    const logs = [], h = provider(kind, [{ text: modelText(move, seq) }], logs);
    const events = await h.run(body(move, { provider: kind }));
    assert.equal(h.payloads.length, 1); assert.equal(text(events), modelText(move, seq).trim());
    assert.ok(events.some(e => e.type === 'done' && !e.recovered)); assert.ok(!events.some(e => e.type === 'error' || e.type === 'action'));
    assert.ok(!logs.some(e => e.kind === 'error' || e.payload?.phase === 'turn_stopped'));
  }
});

test('R3.4 R7 ids: ask_understanding and assess_challenge accept s14.kN or text and return ids', () => {
  const s = session('move20', { learning: move20Learning() });
  const asked = s.execute('ask_understanding', { step: 's14', idea: 's14.k2', question: 'Kaj bi se zgodilo, če bi bil rep večji?' });
  assert.deepEqual(asked, { ok: true, wait_for_player: true, idea_id: 's14.k2' }); assert.deepEqual(s.learning.asked_ideas.s14, [idea('s14.k1'), idea('s14.k2')]);
  const ctx = modelContext(game, s); assert.deepEqual(ctx.sealed_key.key_idea_ids.map(x => x.id), ['s14.k1', 's14.k2', 's14.k3', 's14.k4']);
  const byID = session('move20', { message: observed.move21.player_message });
  const r = byID.execute('assess_challenge', { step: 's14', achieved: ['s14.k1', 's14.k3', idea('s14.k4')], path: 'historical', why: 'Upor zvitega krila in gibljiv rep, povezan z zvijanjem.', advantages: [] });
  const byText = session('move20', { message: observed.move21.player_message }).execute('assess_challenge', { ...observed.move21.events[1].tool_uses[0].args });
  assert.equal(r.card, 'A'); assert.equal(r.score, byText.score); assert.equal(r.stars, byText.stars); assert.deepEqual(r.achieved_ids, ['s14.k1', 's14.k3', 's14.k4']);
  assert.deepEqual(byText.achieved_ids, ['s14.k1', 's14.k3', 's14.k4']);
  for (const achieved of [['s14.k9'], ['s8.k1'], ['s14.k1', idea('s14.k1')]]) assert.throws(() => session('move20').execute('assess_challenge', { step: 's14', achieved, path: 'historical', why: 'Razlaga.', advantages: [] }),
    e => e.message === 'INVALID_ASSESSMENT' && e.details.field === 'achieved' && e.details.allowed.achieved_ids.includes('s14.k2'));
});

test('R3.4 INVALID_QUESTION: observed leak names its reason once; the repeated same-idea ask is decisive, not an error', () => {
  const s = session('move20', { learning: move20Learning() }), [first, second] = observed.move20.events.map(e => e.tool_uses?.[0]);
  assert.equal(first.result.error, 'INVALID_QUESTION'); assert.equal(second.result.error, 'INVALID_QUESTION'); assert.equal(observed.move20.events[2].reason, 'TOOL_LIMIT');
  assert.throws(() => s.execute('ask_understanding', first.args), e => e.message === 'INVALID_QUESTION' && e.details.reason === 'SEALED_KEY_LEAK' && e.details.idea_id === 's14.k2'
    && e.details.next === 'assess_challenge' && e.details.remaining === 1 && e.details.unasked_ids.join() === 's14.k2,s14.k3,s14.k4');
  for (const args of [second.args, { ...second.args, idea: 's14.k2' }]) {
    const closed = s.execute('ask_understanding', args);
    assert.equal(closed.error, undefined); assert.equal(closed.question_closed, true); assert.equal(closed.next, 'assess_challenge'); assert.equal(closed.idea_id, 's14.k2');
    assert.ok(closed.reveal_after_assessment?.id === 's17'); assert.equal(s.question, null);
  }
  // A corrected, clean question for the same idea is still accepted; a different invalid idea is still a normal error.
  const fixed = session('move20', { learning: move20Learning() }); assert.throws(() => fixed.execute('ask_understanding', first.args), /INVALID_QUESTION/);
  assert.equal(fixed.execute('ask_understanding', { step: 's14', idea: 's14.k2', question: 'Kaj naredita nepremični plavuti, ko letalo drsi postrani?' }).ok, true);
  const other = session('move20', { learning: move20Learning() }); assert.throws(() => other.execute('ask_understanding', first.args), /INVALID_QUESTION/);
  assert.throws(() => other.execute('ask_understanding', { ...first.args, idea: 's14.k3' }), /INVALID_QUESTION/);
});

for (const kind of ['claude', 'gpt']) test(`R3.4 ${kind}: move 20 replay — repeated leaking ask no longer ends in TOOL_LIMIT; assessment and reveal complete`, async () => {
  const [first, second] = observed.move20.events.map(e => e.tool_uses?.[0]), logs = [];
  const h = provider(kind, [{ call: ['ask_understanding', first.args] }, { call: ['ask_understanding', second.args] },
    { call: ['assess_challenge', { step: 's14', achieved: ['s14.k1'], path: 'historical', why: 'Upor zvitega krila po namigu; rep še ni pojasnjen.', advantages: [] }] },
    { call: ['open_step', { id: 's17' }] }, { text: 'Preberi na desni.' }], logs);
  const events = await h.run(body('move20', { provider: kind, learning: move20Learning() }));
  assert.equal(h.payloads.length, 5); assert.ok(events.some(e => e.type === 'done' && !e.recovered)); assert.ok(!events.some(e => e.type === 'error'));
  assert.deepEqual(events.filter(e => e.type === 'action').map(e => e.id), ['s17']); assert.match(text(events), /Kartica A · zgodovinska pot · mejniki 1\/4/);
  const seen = results([h.payloads.at(-1)]); assert.equal(seen[0].error, 'INVALID_QUESTION'); assert.equal(seen[0].details.reason, 'SEALED_KEY_LEAK');
  assert.equal(seen[1].question_closed, true); assert.equal(seen[1].error, undefined); assert.deepEqual(seen[2].achieved_ids, ['s14.k1']);
  assert.ok(!logs.some(e => e.payload?.phase === 'turn_stopped')); assert.ok(!JSON.stringify(logs).includes('TOOL_LIMIT'));
  assert.equal(events.find(e => e.type === 'state').learning.cards.s14.card, 'A');
});

test('R3.4 usage: Claude Messages and GPT Responses usage map to token counts and stop reasons only', () => {
  const claude = { input_tokens: 1200, output_tokens: 340, cache_read_input_tokens: 900, cache_creation_input_tokens: 64, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 64 }, service_tier: 'standard', note: 'prose must not be copied' };
  assert.deepEqual(usageSummary('claude', claude), { input_tokens: 1200, output_tokens: 340, cache_read: 900, cache_write: 64, cache_write_5m: 0, cache_write_1h: 64, thinking_tokens: null });
  const gpt = { input_tokens: 1500, output_tokens: 410, input_tokens_details: { cached_tokens: 1024, cache_write_tokens: 128 }, output_tokens_details: { reasoning_tokens: 256 }, total_tokens: 1910 };
  assert.deepEqual(usageSummary('gpt', gpt), { input_tokens: 1500, output_tokens: 410, cache_read: 1024, cache_write: 128, reasoning_tokens: 256 });
  assert.equal(usageSummary('gpt', null), null); assert.deepEqual(usageSummary('claude', { input_tokens: -1, output_tokens: 'x' }).input_tokens, null);
  assert.equal(stopReason('claude', { stop_reason: 'tool_use' }), 'tool_use'); assert.equal(stopReason('gpt', { status: 'completed' }), 'completed');
  assert.equal(stopReason('gpt', { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }), 'incomplete:max_output_tokens');
  assert.equal(stopReason('claude', { stop_reason: 'Some prose text' }), null);
  const truncated = diagnosticEvent('model_round', { provider: 'claude', model: 'claude-opus-5-5', effort: 'low', round_count: 1, usage: usageSummary('claude', claude), stop_reason: 'end_turn', tool_uses: Array.from({ length: 48 }, () => ({ args: 'x'.repeat(8000) })) });
  assert.equal(truncated.payload.truncated, true); assert.equal(truncated.payload.usage.cache_read, 900); assert.equal(truncated.payload.stop_reason, 'end_turn');
});

for (const kind of ['claude', 'gpt']) test(`R3.4 ${kind}: per-call usage and stop_reason reach settled cost and guide_trace events without text`, async () => {
  const usage = kind === 'claude' ? { input_tokens: 4100, output_tokens: 120, cache_read_input_tokens: 3800, cache_creation_input_tokens: 200, cache_creation: { ephemeral_5m_input_tokens: 200, ephemeral_1h_input_tokens: 0 } }
    : { input_tokens: 4300, output_tokens: 150, input_tokens_details: { cached_tokens: 4000, cache_write_tokens: 0 }, output_tokens_details: { reasoning_tokens: 64 } };
  const logs = [], h = provider(kind, [{ call: ['open_step', { id: 's15' }], usage }, { text: 'Preberi.', usage, ...(kind === 'gpt' ? { status: 'incomplete', incomplete: 'max_output_tokens' } : {}) }], logs);
  const events = await h.run(body('move17', { provider: kind, message: 'Ne vem. Kakšen namig?' }));
  assert.ok(events.some(e => e.type === 'done'));
  const settled = logs.filter(e => e.kind === 'cost' && e.payload.phase === 'settled'), traces = logs.filter(e => e.kind === 'guide_trace' && e.payload.phase === 'model_round');
  assert.equal(settled.length, 2); assert.equal(traces.length, 2);
  const expected = usageSummary(kind, usage), stops = kind === 'claude' ? ['tool_use', 'end_turn'] : ['completed', 'incomplete:max_output_tokens'];
  for (const [i, e] of settled.entries()) { assert.deepEqual(e.payload.usage, expected); assert.equal(e.payload.stop_reason, stops[i]); }
  for (const [i, e] of traces.entries()) { assert.deepEqual(e.payload.usage, expected); assert.equal(e.payload.stop_reason, stops[i]); }
  assert.equal(expected.cache_read, kind === 'claude' ? 3800 : 4000); if (kind === 'gpt') assert.equal(expected.reasoning_tokens, 64);
  for (const e of settled) assert.ok(!/Preberi|text|Ne vem/.test(JSON.stringify(e.payload)));
});
