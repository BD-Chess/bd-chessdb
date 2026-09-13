const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Chess } = require('../js/chess.min.js');
const DCC = require('../js/8zc-dcc-core.js');
const start = new Chess().fen();
const uci = m => m.from + m.to + (m.promotion || '');
const rootMoves = [
  { move: 'e2e4', score: 30, sourceOrder: 0 }, { move: 'd2d4', score: 30, sourceOrder: 1 },
  { move: 'c2c4', score: 30, sourceOrder: 2 }, { move: 'g1f3', score: 30, sourceOrder: 3 },
  { move: 'b1c3', score: 20, sourceOrder: 4 }, { move: 'a2a3', score: 19, sourceOrder: 5 }
];
function line(fen) {
  const board = new Chess(fen), moves = [];
  for (let i = 0; i < 8 && !board.game_over(); i++) { const move = board.moves({ verbose: true })[0]; moves.push(uci(move)); board.move(move); }
  return moves;
}
function service(fen = start, overrides = {}) {
  const rootSide = new Chess(fen).turn();
  return { Chess, fen, moves: rootMoves, settings: { dccDepth: 3 },
    getPV: async f => ({ score: new Chess(f).turn() === rootSide ? 30 : -30, depth: 24, pv: line(f) }),
    getScore: async f => new Chess(f).turn() === rootSide ? 30 : -30,
    getMoves: async f => ({ moves: new Chess(f).moves({ verbose: true }).map((m, i) => ({ move: uci(m), score: 0, sourceOrder: i })) }),
    ...overrides };
}
test('balanced coverage includes every legal root within10cp despite the inspection cap', async () => {
  const result = await DCC.analyze(service());
  assert.equal(result.candidates.length, 5);
  assert.deepEqual(new Set(result.candidates.map(c => c.move)), new Set(rootMoves.slice(0, 5).map(m => m.move)));
  assert.equal(result.receipt.coverage.eligible, 5);
  assert.equal(result.receipt.coverage.eligibleInspected, 5);
  assert.equal(result.receipt.coverage.omitted[0].move, 'a2a3');
  assert.equal(result.receipt.calls, 15);
  const legacy = await DCC.analyze(service(start, { settings: { dccDepth: 3, dccPolicy: 'legacy' } }));
  assert.equal(legacy.candidates.length, 3);
  assert.equal(legacy.receipt.coverage.omitted.filter(m => m.eligible).length, 2);
});
test('round-robin gives every candidate one observation before any receives a second', async () => {
  const calls = [];
  const api = service();
  const result = await DCC.analyze({ ...api, getPV: async fen => { calls.push(['pv', fen]); return api.getPV(fen); },
    getScore: async fen => { calls.push(['score', fen]); return api.getScore(fen); } });
  assert.deepEqual(calls.slice(0, 5).map(c => c[0]), ['pv', 'pv', 'pv', 'pv', 'pv']);
  assert.deepEqual(calls.slice(5).map(c => c[0]), Array(10).fill('score'));
  assert.equal(new Set(calls.slice(0, 5).map(c => c[1])).size, 5);
  assert.equal(result.receipt.status, 'complete');
});
test('logical budgets and cancellation retain a deterministic incomplete result or abort', async () => {
  const limited = await DCC.analyze(service(start, { settings: { dccDepth: 5, dccRequestBudget: 6 } }));
  assert.equal(limited.receipt.calls, 6);
  assert.equal(limited.receipt.maxCalls, 6);
  assert.equal(limited.receipt.limited, true);
  assert.equal(limited.dcc1Move, 'e2e4');
  assert.equal(limited.receipt.status, 'partial');
  let calls = 0;
  await assert.rejects(DCC.analyze(service(start, { cancelled: () => calls >= 3,
    getPV: async fen => { calls++; return { score: -30, pv: line(fen) }; } })), { name: 'AbortError' });
  assert.equal(calls, 3);
});
for (const color of ['w', 'b']) test('critical opponent reply can reject a sampled favorite for ' + color + ' without widening root guard', async () => {
  const board = new Chess(); if (color === 'b') board.move('e4');
  const fen = board.fen(), square = color === 'w' ? 'e4' : 'e5';
  const moves = color === 'w' ? [{ move: 'e2e4', score: 30 }, { move: 'd2d4', score: 29 }] : [{ move: 'e7e5', score: 30 }, { move: 'd7d5', score: 29 }];
  const api = service(fen, { moves, settings: { dccDepth: 3, dccDefenseCheck: true, dccDefensePlies: 2, dccDefenseCandidates: 2 },
    getPV: async f => {
      const state = new Chess(f);
      const rootScore = state.turn() === color ? (state.get(square)?.color === color ? -120 : 20) : 30;
      return { score: state.turn() === color ? rootScore : -rootScore, depth: 26, pv: line(f) };
    }
  });
  const result = await DCC.analyze(api);
  assert.equal(result.dcc1Move, moves[1].move);
  assert.equal(result.receipt.defense.comparable, true);
  const bad = result.candidates.find(c => c.move === moves[0].move).data;
  const good = result.candidates.find(c => c.move === moves[1].move).data;
  assert.equal(bad.defense.worstEval, -120);
  assert.equal(good.defense.worstEval, 20);
  assert.equal(bad.defense.setback, 140);
  assert.ok(good.eligible);
  assert.equal(result.receipt.defense.exhaustive, false);
  assert.match(result.receipt.reason, /not a proof/);
});
test('unknown critical reply blocks preference changes and remains visibly incomplete', async () => {
  const api = service(start, { moves: rootMoves.slice(0, 2), settings: { dccDepth: 3, dccDefenseCheck: true, dccDefensePlies: 2 },
    getPV: async f => ({ score: new Chess(f).turn() === 'w' ? null : -30, depth: 24, pv: line(f) }) });
  const result = await DCC.analyze(api);
  assert.equal(result.dcc1Move, 'e2e4');
  assert.equal(result.receipt.status, 'partial');
  assert.equal(result.receipt.defense.comparable, false);
  assert.match(result.receipt.reason, /insufficient comparable defense coverage/);
  assert.ok(result.candidates.every(c => c.data.defense.worstEval === null));
});
test('source errors preserve raw fallback and abort errors are never swallowed', async () => {
  const failed = await DCC.analyze(service(start, { getPV: async () => { throw new Error('offline'); } }));
  assert.equal(failed.dcc1Move, 'e2e4');
  assert.equal(failed.receipt.errors.length, 5);
  assert.equal(failed.receipt.status, 'partial');
  await assert.rejects(DCC.analyze(service(start, { getPV: async () => { const e = new Error('cancel'); e.name = 'AbortError'; throw e; } })), { name: 'AbortError' });
});
test('gap-aware sensors never connect missing observations or fabricate an end score', () => {
  const metrics = DCC.sensors([30, null, -50, -50], start);
  assert.deepEqual(metrics.gaps, [2]);
  assert.equal(metrics.volatility, 0);
  assert.equal(metrics.stability, null);
  assert.equal(metrics.trend, 'unknown');
  assert.equal(metrics.adsr.shape, 'unknown');
  assert.equal(metrics.bonus, 0);
  assert.equal(DCC.sensors([30, 30, null], start).endEval, null);
});
test('sensor ablations are named, additive and preserve raw provider order when disabled', async () => {
  assert.equal(DCC.config({ dccPolicy: 'legacy' }).structureMode, 'rank');
  assert.equal(DCC.config({ dccPolicy: 'legacy', dccStructureMode: 'descriptive' }).structureMode, 'descriptive');
  assert.equal(DCC.sensors([30, 30, 30], start, { dccPolicy: 'legacy', dccStructureMode: 'descriptive' }).sensorContributions.structure, 0);
  const metrics = DCC.sensors([30, 20, 30], start);
  assert.equal(metrics.sensorContributions.structure, 0);
  assert.equal(metrics.bonus, Object.values(metrics.sensorContributions).reduce((a, b) => a + b, 0));
  const ranked = DCC.sensors([30, 20, 30], start, { dccStructureMode: 'rank' });
  assert.ok(ranked.sensorContributions.structure < 0);
  const disabled = { stability: false, floor: false, volatility: false, trend: false, structure: false };
  const result = await DCC.analyze(service(start, { settings: { dccDepth: 3, dccSensors: disabled } }));
  assert.equal(result.dcc1Move, 'e2e4');
  assert.ok(result.candidates.every(c => c.data.bonus === 0));
});
test('samples preserve typed provider metadata and null source depth instead of inventing it', async () => {
  const result = await DCC.analyze(service(start, { moves: rootMoves.slice(0, 1), getScore: async () => ({ score: 0, source: 'fixture', retrievedAt: '2026-09-13T00:00:00Z' }) }));
  const data = result.candidates[0].data;
  assert.equal(data.samples[0].sourceDepth, 24);
  assert.equal(data.samples[1].sourceDepth, null);
  assert.equal(data.samples[1].source, 'fixture');
  assert.equal(data.samples[1].retrievedAt, '2026-09-13T00:00:00Z');
  assert.equal(data.samples[1].score, 0);
});
test('geometric relationships produce questions only from legal complete sampled branches', () => {
  const fen = '4k3/8/8/8/8/8/4q3/4K2R w K - 0 1';
  const graph = DCC.relationships(Chess, fen);
  assert.ok(graph.pieces.find(p => p.square === 'e1').attackers.includes('e2'));
  assert.deepEqual(DCC.tacticalQuestions(Chess, start, [{ moves: ['e2e5'], endEval: 0, complete: true }]), []);
  assert.deepEqual(DCC.tacticalQuestions(Chess, start, [{ moves: ['e2e4'], endEval: null, complete: false }]), []);
  const questions = DCC.tacticalQuestions(Chess, start, [{ moves: ['e2e4', 'd7d5'], endEval: 20, complete: true }]);
  assert.ok(questions.length > 0);
  assert.ok(questions.every(q => q.contributesToRank === false && q.san.join(' ') === 'e4 d5'));
});
