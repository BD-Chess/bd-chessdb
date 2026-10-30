import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeHandler } from '../functions/game-guide.mjs';
import { createSession, validateBody, hintRequested, playerQuestion, answerText, openingClaim, modelContext, cleanLearning } from '../functions/lib/game-guide/runtime.mjs';
import { stepTexts } from '../functions/lib/game-guide/content.mjs';

// P0-R3.5 regressions from playtest bb70266e (Dayton 1903, gpt-6.1-sol low, R3.3 code), moves 7/20/23/26–30.
// All providers are offline doubles; no network or paid model calls.
globalThis.fetch = () => assert.fail('network forbidden');
const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const game = stepTexts(await read('../public/game/dayton1903/index.html'), JSON.parse(await read('../public/game/dayton1903/game.json')));
const observed = JSON.parse(await read('./fixtures/game-r35-playtest.observed.json'));
const step = id => game.steps.find(s => s.id === id), idea = id => step(id.split('.')[0]).key.key_ideas.find(x => x.id === id).text;
const INVITE = 'Na desni se je odprl nov korak. Preberi in mi povej, ko si pripravljen.';
// Learning as the client held it before the observed move (asked ideas and cards from the same log).
function learningAt(move) {
  const learning = { asked: [], asked_ideas: {}, cards: {} };
  for (const a of observed[move].asked_before) { learning.asked.push(a.step); (learning.asked_ideas[a.step] ??= []).push(a.idea); }
  for (const [id, c] of Object.entries(observed[move].cards_before)) learning.cards[id] = { card: c.card, line: `Kartica ${c.card}`, achieved: c.achieved, independent: [], score: c.score };
  return learning;
}
const body = (move, extra = {}) => ({ slug: 'dayton1903', provider: 'claude', mode: 'IZUMLJAJ', development: true, protocol: 'game-guide-tools-v1',
  opened: observed[move].opened, learning: learningAt(move), history: [], message: observed[move].player_message, ...extra });
const session = (move, extra) => createSession(game, validateBody(body(move, extra)));
const rounds = move => observed[move].events.filter(e => e.phase === 'model_round');

function provider(kind, script, logs = []) {
  let at = 0; const payloads = [];
  const client = kind === 'claude' ? { messages: { stream(payload) {
    payloads.push(structuredClone(payload)); const r = script[at++]; assert.ok(r, 'unexpected provider round');
    const content = [...(r.text ? [{ type: 'text', text: r.text }] : []), ...(r.call ? [{ type: 'tool_use', id: `call_${at}`, name: r.call[0], input: r.call[1] }] : [])];
    const response = { content, stop_reason: r.call ? 'tool_use' : 'end_turn', usage: { input_tokens: 10, output_tokens: 2 } };
    return { async *[Symbol.asyncIterator]() { if (r.text) yield { type: 'content_block_delta', delta: { type: 'text_delta', text: r.text } }; }, finalMessage: async () => response };
  } } } : { responses: { async create(payload) {
    payloads.push(structuredClone(payload)); const r = script[at++]; assert.ok(r, 'unexpected provider round');
    const output = [...(r.text ? [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: r.text }] }] : []),
      ...(r.call ? [{ type: 'function_call', call_id: `call_${at}`, name: r.call[0], arguments: JSON.stringify(r.call[1]) }] : [])];
    const response = { output, status: 'completed', usage: { input_tokens: 10, output_tokens: 2 } };
    return (async function* () { if (r.text) yield { type: 'response.output_text.delta', delta: r.text }; yield { type: 'response.completed', response }; })();
  } } };
  const handler = makeHandler({ accessFactory: async () => ({ role: 'owner', id: 'offline-r35' }), configured: { claude: true, gpt: true },
    gameFactory: async () => structuredClone(game), clientFactory: async () => client, continuationSecret: () => 'offline-r35-secret-'.repeat(4),
    logStore: { start: async () => ({ id: '00000000-0000-4000-8000-000000000035' }), append: async (_, events) => logs.push(...structuredClone(events)) } });
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
const clean = events => events.some(e => e.type === 'done' && !e.recovered) && !events.some(e => e.type === 'error');
const prompt = payload => payload.system ?? payload.instructions;
const context = payload => JSON.parse(prompt(payload).split('KONTEKST IGRE (podatki):\n')[1]);

test('R3.5 P0 move 26: »… Namig prosim.« at the end of a question is a hint request and opens the next hint s20', () => {
  const [refused] = rounds('move26')[0].tool_uses;
  assert.equal(refused.args.id, 's20'); assert.equal(refused.result.error, 'HINT_ON_REQUEST');
  assert.match(observed.move26.events.find(e => e.kind === 'agent_response').text, /Namiga ti zdaj ne morem prikazati/);
  const s = session('move26');
  assert.ok(s.allowedOpenSteps().some(x => x.id === 's20')); assert.equal(s.execute('open_step', { id: 's20' }).action.id, 's20');
  for (const m of [observed.move26.player_message, 'Ne vem. Kakšen namig?', 'Daj mi en namig.', 'Lahko dobim namig?', 'namig', 'Namig, prosim.', 'Mi daš namig?',
    'Še en namig bi prosil.', 'Prosim za namig', 'Hint please', 'Can I get a hint?', 'Ok, tole je težko, namig prosim, potem nadaljujem.', 'Pomoč prosim'])
    assert.equal(hintRequested(m), true, m);
  for (const m of ['Brez namiga prosim.', 'Ne rabim namiga, samo povej, ali sem blizu.', 'Namiga ne potrebujem.', 'No hint.', 'Ne vem.', 'Zataknil sem se.',
    'Iz prvega namiga razumem, da je propeler krilo.', 'Namig mi je pomagal: propeler je krilo.', 'Kaj pravi namig?', observed.move20.player_message])
    assert.equal(hintRequested(m), false, m);
});

for (const kind of ['claude', 'gpt']) test(`R3.5 ${kind}: move 26 replay opens s20 with one invite line, no rejection`, async () => {
  const logs = [], h = provider(kind, [{ call: ['open_step', { id: 's20' }] }, { text: 'Preberi namig na desni.' }], logs);
  const events = await h.run(body('move26', { provider: kind }));
  assert.ok(clean(events)); assert.deepEqual(events.filter(e => e.type === 'action').map(e => e.id), ['s20']);
  assert.equal(text(events), INVITE); assert.ok(!logs.some(e => e.kind === 'error'));
});

test('R3.5 P1 move 20: no hint request → s16 is refused with reason and a clear next', () => {
  const [opened] = rounds('move20')[0].tool_uses; assert.equal(opened.args.id, 's16'); assert.equal(opened.result.ok, true);
  const s = session('move20');
  assert.ok(!s.allowedOpenSteps().some(x => x.id === 's16'));
  assert.throws(() => s.execute('open_step', { id: 's16' }), e => e.message === 'HINT_ON_REQUEST' && e.details.reason === 'HINT_NOT_REQUESTED' && e.details.next === 'reply_to_player' && /explicitly asks/.test(e.details.rule));
  for (const message of ['Ne vem.', 'Zataknil sem se.']) assert.throws(() => session('move20', { message }).execute('open_step', { id: 's16' }), /HINT_ON_REQUEST/);
  assert.equal(session('move20', { message: 'Ne vem. Daj namig.' }).execute('open_step', { id: 's16' }).action.id, 's16');
});

for (const kind of ['claude', 'gpt']) test(`R3.5 ${kind}: move 20 replay — unrequested hint is refused, the reply stays a reply`, async () => {
  const logs = [], h = provider(kind, [{ call: ['open_step', { id: 's16' }] }, { text: 'Zanimivo. Kaj bi z repom naredil, da se letalo ne bi obračalo?' }], logs);
  const events = await h.run(body('move20', { provider: kind }));
  assert.ok(clean(events)); assert.ok(!events.some(e => e.type === 'action'));
  const [refused] = results([h.payloads.at(-1)]); assert.equal(refused.error, 'HINT_ON_REQUEST'); assert.equal(refused.details.next, 'reply_to_player');
  assert.ok(!refused.allowed_open_steps.some(x => x.kind === 'hint')); assert.match(text(events), /z repom/);
});

for (const kind of ['claude', 'gpt']) test(`R3.5 ${kind}: moves 25–28 — every answer since s19 opened reaches the model; low assessment holds the reveal for the player`, async () => {
  let learning = learningAt('move25'); const logs = [];
  const play = async (move, script) => {
    const h = provider(kind, script, logs), events = await h.run(body(move, { provider: kind, learning }));
    assert.ok(clean(events), move); learning = events.find(e => e.type === 'state').learning; return { h, events };
  };
  const ask = move => rounds(move)[0].tool_uses[0].args;
  await play('move25', [{ call: ['ask_understanding', ask('move25')] }, { text: '' }]);
  await play('move26', [{ call: ['open_step', { id: 's20' }] }, { text: 'Preberi namig.' }]);
  await play('move27', [{ call: ['ask_understanding', ask('move27')] }, { text: '' }]);
  assert.deepEqual(learning.answers.s19, ['move25', 'move26', 'move27'].map(m => observed[m].player_message));
  // Move 28: observed assessment (0 milestones) and the immediate reveal attempt.
  const assess = rounds('move28')[0].tool_uses[0].args, offer = 'Dobro, en propeler spredaj je smiselna zamisel. Želiš odgovor še dopolniti ali naj odprem razkritje?';
  const { h, events } = await play('move28', [{ call: ['assess_challenge', assess] }, { call: ['open_step', { id: 's23' }] }, { text: offer }]);
  const ctx = context(h.payloads[0]);
  assert.deepEqual(ctx.challenge_answers, ['move25', 'move26', 'move27', 'move28'].map((m, i) => ({ ref: `p${i + 1}`, text: observed[m].player_message })));
  assert.equal(ctx.learning.answers, undefined); assert.match(prompt(h.payloads[0]), /VSA igralčeva sporočila izziva iz challenge_answers/);
  const [assessed, reveal] = results([h.payloads.at(-1)]);
  assert.equal(assessed.card, 'none'); assert.equal(assessed.next, 'offer_continue_or_reveal'); assert.equal(assessed.reveal_on_player_choice.id, 's23');
  assert.ok(!assessed.allowed_open_steps.some(x => x.id === 's23'));
  assert.equal(reveal.error, 'REVEAL_ON_PLAYER_CHOICE'); assert.equal(reveal.details.next, 'offer_continue_or_reveal');
  assert.ok(!events.some(e => e.type === 'action')); assert.equal(text(events), offer);
  assert.equal(learning.cards.s19.card, 'none'); assert.equal(learning.answers.s19.length, 4);
});

test('R3.5 P1 moves 27–30: assessment counts earlier answers; continuing answers lift the card, then the reveal opens', () => {
  const answers = { s19: ['move25', 'move26', 'move27', 'move28'].map(m => observed[m].player_message) };
  const s = session('move28', { learning: { ...learningAt('move28'), answers } });
  assert.deepEqual(modelContext(game, s).challenge_answers.map(x => x.ref), ['p1', 'p2', 'p3', 'p4']);
  // k1 from move 27 counts, but 1/5 is still low and the player is still answering: no automatic reveal.
  const low = s.execute('assess_challenge', { step: 's19', achieved: ['s19.k1'], path: 'historical', why: 'Propeler kot vrteče se krilo; pogon še ni pojasnjen.', advantages: [] });
  assert.equal(low.card, 'A'); assert.equal(low.next, 'offer_continue_or_reveal'); assert.equal(s.needsReveal(), false); assert.equal(s.heldAfterAssessment(), true);
  assert.throws(() => s.execute('open_step', { id: 's23' }), /REVEAL_ON_PLAYER_CHOICE/);
  // Move 30 (k4 + k5) merges with k1: 3/5 is no longer low, so the reveal follows the assessment.
  const next = createSession(game, { ...s.snapshot(), message: observed.move30.player_message });
  next.recordAnswer(); assert.equal(next.learning.answers.s19.length, 5);
  const lifted = next.execute('assess_challenge', { step: 's19', achieved: ['s19.k4', 's19.k5'], path: 'historical', why: 'Dva propelerja v nasprotnih smereh, prek verig.', advantages: [] });
  assert.equal(lifted.score, 3); assert.deepEqual(lifted.achieved_ids, ['s19.k1', 's19.k4', 's19.k5']); assert.equal(lifted.next, undefined);
  assert.ok(lifted.allowed_open_steps.some(x => x.id === 's23')); assert.equal(next.needsReveal(), true);
  assert.equal(next.execute('open_step', { id: 's23' }).action.id, 's23'); assert.equal(next.learning.answers.s19, undefined);
  // The player's choice opens a held reveal; a stall or finished answer means the player is no longer answering.
  for (const message of ['Razkrij.', 'Pokaži rešitev.', 'Naprej.', 'Ne vem več.', 'To je vse.']) {
    const chosen = createSession(game, { ...s.snapshot(), message });
    assert.equal(chosen.needsReveal(), true, message); assert.equal(chosen.execute('open_step', { id: 's23' }).action.id, 's23', message);
  }
  const asking = createSession(game, { ...s.snapshot(), message: 'Zakaj pa dva? En bi bil lažji.' });
  assert.equal(asking.needsReveal(), false); assert.equal(asking.transition().reveal_on_player_choice.id, 's23');
  // SESTRA_0217 stays: a partial s8 3/5 still unlocks and needs its reveal in the same turn.
  const s8 = createSession(game, validateBody({ ...body('move20'), opened: ['s1', 's2', 's3', 's6', 's7', 's8', 's9'], learning: {}, message: 'Ali pa bi naredil leseno škatlo z ventilatorjem.' }));
  s8.execute('assess_challenge', { step: 's8', achieved: ['s8.k1', 's8.k2', 's8.k4'], path: 'historical', why: 'Enakomeren veter, vetrovnik, veliko oblik.', advantages: [] });
  assert.equal(s8.needsReveal(), true); assert.equal(s8.execute('open_step', { id: 's12' }).action.id, 's12');
  // Stored answers are bounded and never leak into other challenges' context.
  const bounded = cleanLearning({ answers: { s19: Array.from({ length: 12 }, (_, i) => `odgovor ${i} ${'x'.repeat(2000)}`), bad$: ['x'] } });
  assert.equal(bounded.answers.s19.length, 8); assert.ok(bounded.answers.s19.every(x => x.length === 1500)); assert.equal(bounded.answers['bad$'], undefined);
  assert.equal(cleanLearning({}).answers, undefined);
  const pruned = createSession(game, validateBody(body('move28', { learning: { ...learningAt('move28'), answers: { s14: ['star odgovor'], s19: ['p1'] } } })));
  pruned.recordAnswer(); assert.deepEqual(pruned.learning.answers, { s19: ['p1', observed.move28.player_message] });
});

for (const kind of ['claude', 'gpt']) test(`R3.5 ${kind}: a held reveal always ends with the continue-or-reveal choice`, async () => {
  const assess = rounds('move28')[0].tool_uses[0].args, h = provider(kind, [{ call: ['assess_challenge', assess] }, { text: 'Zamisel z enim propelerjem spredaj je smiselna.' }]);
  const events = await h.run(body('move28', { provider: kind }));
  assert.ok(clean(events)); assert.ok(!events.some(e => e.type === 'action'));
  assert.equal(text(events), 'Zamisel z enim propelerjem spredaj je smiselna.\n\nOdgovor lahko dopolniš ali napišeš »razkrij«, pa odprem razkritje.');
  // A model that insists on the held reveal gets one error, then a decisive non-error answer: no TOOL_LIMIT, no stuck message.
  const logs = [], again = provider(kind, [{ call: ['assess_challenge', assess] }, { call: ['open_step', { id: 's23' }] }, { call: ['open_step', { id: 's23' }] }, { text: 'Želiš odgovor dopolniti ali pogledati razkritje?' }], logs);
  const replay = await again.run(body('move28', { provider: kind }));
  assert.ok(clean(replay)); assert.equal(again.payloads.length, 4); assert.ok(!replay.some(e => e.type === 'action'));
  const [, first, second] = results([again.payloads.at(-1)]);
  assert.equal(first.error, 'REVEAL_ON_PLAYER_CHOICE'); assert.equal(second.error, undefined); assert.equal(second.reveal_held, true); assert.equal(second.next, 'offer_continue_or_reveal');
  assert.ok(!logs.some(e => e.payload?.phase === 'turn_stopped')); assert.equal(text(replay), 'Želiš odgovor dopolniti ali pogledati razkritje?');
});

test('R3.5 offers are not opening claims; claims stay claims', () => {
  const s = session('move28');
  for (const t of ['Želiš odgovor še dopolniti ali naj odprem razkritje?', 'Če želiš, ti pokažem namig.', 'Lahko odpreva razkritje, ko boš pripravljen.'])
    assert.equal(openingClaim(t, game, s), false, t);
  for (const t of ['Odprem razkritje.', 'Odprl sem razkritje.', 'Odpiram razkritje, preberi ga.', 'Zdaj ti pokažem rešitev.']) assert.equal(openingClaim(t, game, s), true, t);
});

test('R3.5 question detector: real questions need an answer; navigation, hint requests and hedged proposals do not', () => {
  for (const m of [observed.move7.player_message, observed.move23.player_message, 'Zakaj pa dva? En bi bil lažji.', 'Kaj pomeni tista konstanta v tabelah? Ne razumem čisto.', 'Ali so takrat že imeli vetrovnike?'])
    assert.equal(playerQuestion(m), true, m);
  for (const m of ['Prebral sem, kaj zdaj?', 'Prebral. Kaj moram zdaj narediti?', 'Prebral sem. Kaj je zdaj izziv?', 'Kaj pa zdaj?', 'Super. Kaj se je zgodilo potem?',
    observed.move26.player_message, 'Ne vem. Kakšen namig?', observed.move20.player_message, 'Kaj pa, če bi ga kar porinili z avtom?', 'Ali bi lahko uporabil dva propelerja?', 'Gremo naprej.'])
    assert.equal(playerQuestion(m), false, m);
  assert.equal(answerText(rounds('move7')[2].last_model_text), ''); assert.equal(answerText(rounds('move23')[2].last_model_text), 'cena motorja v njem ni navedena.');
});

for (const kind of ['claude', 'gpt']) test(`R3.5 ${kind}: moves 7 and 23 — the observed first answers are shown in one round`, async () => {
  for (const move of ['move7', 'move23']) {
    assert.equal(observed[move].events.find(e => e.kind === 'error').payload.code, 'OPEN_STEP_REQUIRED');
    assert.equal(observed[move].events.findLast(e => e.kind === 'agent_response').text, INVITE);
    const answer = rounds(move)[0].last_model_text, logs = [], h = provider(kind, [{ text: answer }], logs);
    const events = await h.run(body(move, { provider: kind }));
    assert.ok(clean(events), move); assert.equal(h.payloads.length, 1); assert.equal(text(events), answer); assert.ok(!logs.some(e => e.kind === 'error'));
  }
});

for (const kind of ['claude', 'gpt']) test(`R3.5 ${kind}: move 7 — a fixed invite line no longer replaces the answer; one answer round is requested`, async () => {
  const answer = rounds('move7')[0].last_model_text, logs = [];
  const h = provider(kind, [{ call: ['open_step', { id: 's7' }] }, { text: rounds('move7')[2].last_model_text }, { text: answer }], logs);
  const events = await h.run(body('move7', { provider: kind }));
  assert.ok(clean(events)); assert.equal(h.payloads.length, 3); assert.deepEqual(events.filter(e => e.type === 'action').map(e => e.id), ['s7']);
  assert.equal(text(events), `${answer}\n\n${INVITE}`);
  assert.ok(logs.some(e => e.kind === 'error' && e.payload.code === 'QUESTION_UNANSWERED' && e.payload.suppressed));
  assert.match(JSON.stringify(h.payloads[2]), /postavil vprašanje, ki še ni odgovorjeno/);
});

for (const kind of ['claude', 'gpt']) test(`R3.5 ${kind}: move 23 — post-opening prose that answers is kept before the invite line, no extra round`, async () => {
  const after = rounds('move23')[2].last_model_text, logs = [], h = provider(kind, [{ call: ['open_step', { id: 's18' }] }, { text: after }], logs);
  const events = await h.run(body('move23', { provider: kind }));
  assert.ok(clean(events)); assert.equal(h.payloads.length, 2); assert.equal(text(events), `${after}\n\n${INVITE}`); assert.ok(!logs.some(e => e.kind === 'error'));
});

for (const kind of ['claude', 'gpt']) test(`R3.5 ${kind}: an empty reply to a question gets one answer round; navigation questions do not`, async () => {
  const answer = 'O ceni motorja v odprtem besedilu ni podatka.';
  let h = provider(kind, [{ text: '' }, { text: answer }]); let events = await h.run(body('move23', { provider: kind }));
  assert.ok(clean(events)); assert.equal(h.payloads.length, 2); assert.equal(text(events), answer);
  h = provider(kind, [{ call: ['open_step', { id: 's18' }] }, { text: 'Preberi.' }]);
  events = await h.run(body('move23', { provider: kind, message: 'Prebral sem, kaj zdaj?' }));
  assert.ok(clean(events)); assert.equal(h.payloads.length, 2); assert.equal(text(events), INVITE);
});
