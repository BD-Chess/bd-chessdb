const test = require('node:test');
const assert = require('node:assert/strict');
const { Chess } = require('../js/chess.min.js');
const SIM = require('../js/8zc-sim-core.js');
const fen = new Chess().fen();
const moves = [{ move: 'e2e4', score: 0 }, { move: 'd2d4', score: 0 }, { move: 'g1f3', score: -5 }];
const analysis = { dcc1Move: 'd2d4', candidates: [], receipt: { fen, status: 'complete', calls: 15 } };

test('equal-eval CDB retains first source move while DCC may select a different tied move', () => {
  const raw = SIM.decision(Chess, fen, 'raw', moves, analysis);
  const dcc = SIM.decision(Chess, fen, 'dcc', moves, analysis);
  assert.equal(raw.move, 'e2e4'); assert.equal(raw.changed, false);
  assert.equal(dcc.move, 'd2d4'); assert.equal(dcc.changed, true);
  assert.equal(dcc.raw_gap, 0); assert.equal(dcc.exact_ties, 2); assert.equal(dcc.near_ties, 3);
  assert.equal(raw.dcc_choice, dcc.dcc_choice, 'observation does not change the raw policy');
});
test('near-eval selection records the actual cp gap, including zero and negative root scores', () => {
  const input = [{ move: 'e2e4', score: -30 }, { move: 'd2d4', score: -36 }];
  const chosen = SIM.decision(Chess, fen, 'dcc', input, analysis);
  assert.equal(chosen.raw_gap, 6); assert.equal(chosen.dcc_raw_gap, 6);
  assert.equal(chosen.raw_score, -36); assert.equal(chosen.exact_ties, 1);
});
test('missing or stale analysis is explicit and cannot supply another position’s DCC move', () => {
  for (const a of [null, { ...analysis, receipt: { fen: 'stale', status: 'complete' } }]) {
    const chosen = SIM.decision(Chess, fen, 'dcc', moves, a);
    assert.equal(chosen.move, 'e2e4'); assert.equal(chosen.dcc_choice, null);
    assert.equal(chosen.coverage, 'unknown'); assert.equal(chosen.picked_by, 'cdb-fallback');
  }
});
test('illegal/unknown raw moves are excluded and underpromotion identities remain separate', () => {
  assert.equal(SIM.decision(Chess, fen, 'raw', [{ move: 'e2e5', score: 10 }, { move: 'e2e4', score: null }], null), null);
  const f = '7k/P7/8/8/8/8/8/7K w - - 0 1';
  const m = [{ move: 'a7a8q', score: 0 }, { move: 'a7a8n', score: 0 }];
  const chosen = SIM.decision(Chess, f, 'dcc', m, { ...analysis, dcc1Move: 'a7a8n', receipt: { fen: f, status: 'complete' } });
  assert.equal(chosen.move, 'a7a8n'); assert.equal(chosen.raw_best, 'a7a8q');
});
test('paused/limited/missing-data lines are not draws; legal terminal results remain results', () => {
  for (const why of ['paused', 'no evaluated move', 'move limit reached']) assert.equal(SIM.outcome(new Chess(), why).result, '*');
  const mate = new Chess(); ['f3', 'e5', 'g4', 'Qh4#'].forEach(m => mate.move(m));
  assert.deepEqual(SIM.outcome(mate), { state: 'complete', result: '0-1', reason: 'checkmate' });
});
test('PGN and CSV retain custom black-to-move start, both policies, gaps and partial result', () => {
  const b = new Chess(); b.move('c4'); const startFen = b.fen();
  const row = SIM.decision(Chess, startFen, 'raw', [{ move: 'e7e6', score: 0 }], null);
  const run = { id: 1, startedAt: '2026-09-12T00:00:00Z', white: 'dcc', black: 'raw', startFen,
    config: { version: 'test', depth: 5, candidates: 3, guard: 10, source: 'direct' },
    trace: [{ ...row, fen: startFen, ply: 1 }], state: 'paused', result: '*', reason: 'paused' };
  const pgn = SIM.toPGN(Chess, run), loaded = new Chess();
  assert.match(pgn, /White "CDB \+ DCC"/); assert.match(pgn, /Black "CDB \(top 1\)"/);
  assert.match(pgn, /1\.\.\. e6/); assert.match(pgn, /DCCCoverageGaps "1"/); assert.match(pgn, /\*$/);
  assert.equal(loaded.load_pgn(pgn), true); b.move('e6'); assert.equal(loaded.fen(), b.fen());
  const csv = SIM.toCSV([run]); assert.match(csv, /dcc_raw_gap,exact_ties/); assert.match(csv, /"cdb-top1"/);
  assert.match(csv, /"paused","\*","paused"/);
  assert.throws(() => SIM.toPGN(Chess, { ...run, startFen: fen }), /position mismatch/);
});
