import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeHandler } from '../functions/game-guide.mjs';
import { createSession, modelContext, validateBody } from '../functions/lib/game-guide/runtime.mjs';
import { stepTexts } from '../functions/lib/game-guide/content.mjs';
import { gameGuideError } from '../public/assets/game-guide/errors.mjs';

const game = stepTexts(await readFile(new URL('../public/game/dayton1903/index.html', import.meta.url), 'utf8'), JSON.parse(await readFile(new URL('../public/game/dayton1903/game.json', import.meta.url), 'utf8')));
const actor = { role: 'owner', id: 'offline-r2' }, secret = 'offline-fixture-only-'.repeat(4);
const request = extra => validateBody({ slug: 'dayton1903', message: 'Začniva.', provider: 'claude', mode: 'IZUMLJAJ', development: true, opened: ['s1'], protocol: 'game-guide-tools-v1', ...extra });
const use = (name, args, id = name) => ({ name, arguments: args, call_id: id });
const assessment = () => use('assess_challenge', { step: 's2', card: 'A', achieved: game.steps.find(s => s.id === 's2').key_ideas.length, stars: 0, why: 'Mehanizem je razložen.', explanation: '', bonus: 'none', advantage: '' });
const toolResults = input => input.flatMap(m => m.type === 'function_call_output' ? [JSON.parse(m.output)] : Array.isArray(m.content) ? m.content.filter(c => c.type === 'tool_result').map(c => JSON.parse(c.content)) : []);
function harness(outputs) {
  const seen = [];
  const handler = makeHandler({ accessFactory: async () => actor, configured: { claude: true, gpt: true }, continuationSecret: () => secret,
    gameFactory: async () => structuredClone(game), clientFactory: async () => ({}), budgetFactory: () => ({}), logStore: { start: async () => null },
    round: async args => {
      const index = seen.length; seen.push({ system: args.system, input: structuredClone(args.input) });
      const output = typeof outputs === 'function' ? outputs(args, index) : outputs[index]; assert.ok(output, `Unexpected round ${index}`);
      const text = output.text || '', calls = output.calls || [];
      const response = args.provider === 'claude' ? { content: [...(text ? [{ type: 'text', text }] : []), ...calls.map(c => ({ type: 'tool_use', id: c.call_id, name: c.name, input: c.arguments }))] }
        : { output: [...(text ? [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }] : []), ...calls.map(c => ({ type: 'function_call', ...c, arguments: JSON.stringify(c.arguments) }))] };
      return { text, calls: args.provider === 'claude' ? calls : calls.map(c => ({ ...c, arguments: JSON.stringify(c.arguments) })), response };
    } });
  return { seen, async post(body) {
    const response = await handler(new Request('https://www.mdlxdcc.org/.netlify/functions/game-guide', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
    assert.equal(response.status, 200);
    return (await response.text()).split('\n\n').filter(Boolean).map(frame => JSON.parse(frame.slice(6)));
  } };
}
async function turn(h, body, visible = true) {
  const events = []; let next = body;
  for (let hop = 0; hop < 4; hop++) {
    const batch = await h.post(next); events.push(...batch);
    const token = batch.find(e => e.type === 'continue')?.token;
    if (!token) return events;
    next = { continuation: token, receipts: batch.filter(e => e.type === 'action').map(a => ({ call_id: a.call_id, name: a.name, opened: a.id, ok: visible, visible, already_open: false })) };
  }
  assert.fail('Unexpected continuation loop');
}
const state = events => events.find(e => e.type === 'state')?.learning;
const assertDone = events => { assert.ok(events.some(e => e.type === 'done')); assert.ok(!events.some(e => e.type === 'error'), JSON.stringify(events)); };

test('R2 exact Dayton flow: s2 -> s3 -> one question -> correct answer -> s6; s4/s5 stay closed', async () => {
  const h = harness((args) => {
    const ctx = JSON.parse(args.system.split('KONTEKST IGRE (podatki):\n')[1]);
    if (toolResults(args.input).some(r => r.visible)) return { text: 'Preberi na desni.' };
    if (toolResults(args.input).some(r => r.wait_for_player)) return { text: 'Kaj se zgodi z vzgonom na vsaki strani?' };
    if (!ctx.opened.some(s => s.id === 's2')) return { calls: [use('open_step', { id: 's2' })] };
    if (!ctx.opened.some(s => s.id === 's3')) return { calls: [use('open_step', { id: 's3' })] };
    if (!ctx.learning.asked.includes('s2')) return { calls: [use('ask_understanding', { step: 's2', question: 'Kaj se zgodi z vzgonom na vsaki strani?' })] };
    if (!ctx.learning.cards.s2) return { calls: [assessment()] };
    assert.deepEqual(ctx.allowed_open_steps, [{ id: 's6', kind: 'reveal' }]);
    return { calls: [use('open_step', { id: 's6' })] };
  });
  let opened = ['s1'], learning = { asked: [], cards: {} };
  const messages = ['Začniva.', 'Namig', 'Z žico bi spreminjal kot konic.', 'Na eni strani se vzgon poveča, na drugi zmanjša.'];
  const actions = []; const roundCounts = [];
  for (const message of messages) {
    const before = h.seen.length, events = await turn(h, request({ message, opened, learning })); assertDone(events);
    for (const action of events.filter(e => e.type === 'action')) { actions.push(action.id); opened.push(action.id); }
    learning = state(events); roundCounts.push(h.seen.length - before);
  }
  assert.deepEqual(actions, ['s2', 's3', 's6']); assert.deepEqual(learning.asked, ['s2']); assert.equal(learning.cards.s2.card, 'A');
  assert.deepEqual(roundCounts, [2, 2, 2, 3]); assert.ok(!opened.includes('s4') && !opened.includes('s5'));
});

test('R2 allowlist matches execution: optional tiered hints, reveal gate, skip and story', () => {
  let s = createSession(game, request({ opened: ['s1', 's2', 's3'], message: 'Namig' }));
  assert.deepEqual(s.allowedOpenSteps(), [{ id: 's4', kind: 'hint' }]);
  assert.deepEqual(modelContext(game, s).reveal_after_assessment, { id: 's6', requires: 'assess_challenge', step: 's2' });
  assert.throws(() => s.execute('open_step', { id: 's5' }), /HINT_ORDER/);
  s = createSession(game, request({ opened: ['s1', 's2', 's3'], message: 'Moj odgovor.', learning: { asked: ['s2'], cards: {} } }));
  assert.deepEqual(s.allowedOpenSteps(), []); assert.throws(() => s.execute('open_step', { id: 's6' }), /UNDERSTANDING_BEFORE_REVEAL/);
  const assessed = s.execute('assess_challenge', assessment().arguments);
  assert.deepEqual(assessed.allowed_open_steps, [{ id: 's6', kind: 'reveal' }]);
  assert.equal(s.execute('open_step', { id: 's6' }).action.id, 's6'); assert.deepEqual(s.allowedOpenSteps(), []);
  assert.throws(() => s.execute('open_step', { id: 's7' }), /READ_FIRST/);
  for (const extra of [{ message: 'Preskoči.', opened: ['s1', 's2', 's3'] }, { mode: 'ZGODBA' }]) {
    s = createSession(game, request(extra)); assert.deepEqual(s.allowedOpenSteps(), [{ id: 's6', kind: 'reveal' }]);
    assert.equal(s.execute('open_step', { id: 's6' }).action.id, 's6');
  }
});

test('R2 rejected call returns exact allowed ids; one correction opens s6', async () => {
  const h = harness([{ calls: [use('open_step', { id: 's5' })] }, { calls: [use('open_step', { id: 's6' })] }, { text: 'Preberi.' }]);
  const events = await turn(h, request({ opened: ['s1', 's2', 's3'], learning: { asked: ['s2'], cards: { s2: { card: 'A', line: 'Kartica A' } } } }));
  assertDone(events); assert.deepEqual(events.filter(e => e.type === 'action').map(a => a.id), ['s6']);
  const result = toolResults(h.seen[1].input).at(-1); assert.equal(result.ok, false); assert.equal(result.error, 'HINT_ON_REQUEST');
  assert.deepEqual(result.allowed_open_steps, [{ id: 's6', kind: 'reveal' }]); assert.equal(h.seen.length, 3);
});

test('R2 repeated invalid tools stop after initial call + one repair', async () => {
  const h = harness(() => ({ calls: [use('open_step', { id: 's5' })] }));
  const events = await turn(h, request({ opened: ['s1', 's2', 's3'] }));
  assert.equal(h.seen.length, 2); assert.ok(events.some(e => e.code === 'TOOL_LIMIT')); assert.ok(!events.some(e => e.type === 'action'));
});

test('R2 unsupported opening stops after one repair with player-safe OPEN_STEP_REQUIRED', async () => {
  const h = harness(() => ({ text: 'Odpiram naslednji izziv.' }));
  const events = await turn(h, request()); assert.equal(h.seen.length, 2);
  assert.ok(events.some(e => e.code === 'OPEN_STEP_REQUIRED')); assert.ok(!events.some(e => e.type === 'delta'));
  assert.match(h.seen[1].input.at(-1).content, /allowed_open_steps.*s2/);
});

test('R2 repair allowance survives browser continuation', async () => {
  const h = harness([{ calls: [use('open_step', { id: 's5' })] }, { calls: [use('open_step', { id: 's2' })] }]);
  const events = await turn(h, request(), false);
  assert.equal(h.seen.length, 2); assert.ok(events.some(e => e.code === 'TOOL_LIMIT')); assert.ok(!events.some(e => e.type === 'done'));
});

test('R2 a rejected call in an action batch is counted once across the receipt', async () => {
  const h = harness([{ calls: [use('open_step', { id: 's5' }), use('open_step', { id: 's2' }, 'valid')] }, { text: 'Preberi.' }]);
  const events = await turn(h, request()); assertDone(events); assert.equal(h.seen.length, 2);
  assert.equal(toolResults(h.seen[1].input).filter(r => r.error).length, 1);
});

test('R2 localized errors explain interruption without tool codes or a phantom retry button', () => {
  for (const english of [false, true]) for (const code of ['TOOL_LIMIT', 'OPEN_STEP_REQUIRED']) {
    const text = gameGuideError(code, english); assert.ok(text.length > 30); assert.ok(!/TOOL_LIMIT|OPEN_STEP_REQUIRED|open_step|Poskusi znova|try again/i.test(text));
    assert.match(text, english ? /writing box/ : /polju/);
  }
});
