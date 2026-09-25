const test = require('node:test');
const assert = require('node:assert/strict');
const { Chess } = require('../js/chess.min.js');
const SF = require('../js/8zc-sf-provider.js');
const SIM = require('../js/8zc-sim-core.js');

const fen = new Chess().fen();
const line = (move, score, rank = 1) => ({ multipv: rank, depth: 8, score: { type: 'cp', root: score, bound: 'exact' }, pv: [move] });
function fixture({ incomplete = false, coverage = true } = {}) {
  const searches = [];
  const Engine = { create: () => ({ destroy() {}, async analyze({ fen: position, nodes, depth, multiPV, signal }) {
    if (signal?.aborted) throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
    searches.push({ position, nodes, depth, multiPV });
    if (position === fen) return { lines: [line('e2e4', 0), line('d2d4', -2, 2), line('g1f3', -40, 3)],
      completeMultiPV: !incomplete, expectedLines: 3, nodes, linesDepth: 8, elapsedMs: 9, bestMove: 'e2e4' };
    return { lines: [line('e7e5', -3)], completeMultiPV: true, expectedLines: 1,
      nodes, linesDepth: 9, elapsedMs: 4 };
  } }) };
  const DCC = { async analyze({ moves, getPV, getScore }) {
    const child = new Chess(fen); child.move({ from: 'e2', to: 'e4' });
    const pv = await getPV(child.fen());
    await getScore(child.fen());
    assert.equal(pv.score, -3, 'child score is in child side-to-move POV');
    return { dcc1Move: 'd2d4', allMoves: moves,
      candidates: ['e2e4', 'd2d4'].map(move => ({ move, data: { move, eligible: true,
        complete: coverage, stability: coverage ? 0.6 : null, observedPlies: coverage ? 5 : 2, targetPlies: 5 } })),
      receipt: { fen, status: coverage ? 'complete' : 'partial', calls: 2,
        coverage: { eligibleInspected: 2 }, reason: 'Comparable trajectory' } };
  } };
  return { provider: SF.create({ Chess, Engine, DCC, multiPV: 3, rootNodes: 12000, probeNodes: 3000 }), searches };
}
test('SF root is legal same-depth MultiPV; guarded DCC keeps original #1 and accounts extra nodes', async () => {
  const { provider, searches } = fixture();
  try {
    const root = await provider.root(fen);
    assert(root.complete); assert.equal(root.moves[0].move, 'e2e4');
    for (const m of root.moves) assert(new Chess(fen).move({ from: m.move.slice(0, 2), to: m.move.slice(2, 4) }));
    const analysis = await provider.analyzeDCC(fen, root, { dccTopCandidates: 3 });
    const choice = SIM.decision(Chess, fen, 'sf-dcc', root.moves, analysis,
      { budgetNodes: 12000, rootNodes: provider.ledger.rootNodes, extraNodes: provider.ledger.extraNodes });
    assert.equal(choice.raw_best, 'e2e4'); assert.equal(choice.raw_best_score, 0);
    assert.equal(choice.move, 'd2d4'); assert(choice.changed);
    assert.equal(choice.provider, 'SF'); assert.equal(choice.root_nodes, 12000);
    assert.equal(choice.dcc_extra_nodes, 6000); assert.equal(searches.length, 3);
  } finally { provider.destroy(); }
});
test('incomplete root or DCC coverage retains SF #1', async () => {
  for (const options of [{ incomplete: true }, { coverage: false }]) {
    const { provider } = fixture(options);
    try {
      const root = await provider.root(fen);
      const result = await provider.analyzeDCC(fen, root, { dccTopCandidates: 3 });
      const choice = SIM.decision(Chess, fen, 'sf-dcc', root.moves, result);
      assert.equal(choice.move, 'e2e4'); assert.equal(result.receipt.status, 'partial');
    } finally { provider.destroy(); }
  }
});
test('mate remains typed and partial SF DCC cannot claim the raw move as a DCC selection', () => {
  const mateFen = '7k/8/5KQ1/8/8/8/8/8 w - - 0 1';
  const b = new Chess(mateFen); const moves = b.moves({ verbose: true });
  const raw = moves.find(m => m.from === 'g6' && m.to === 'g7');
  assert(raw, 'legal mate candidate');
  const uci = raw.from + raw.to;
  const options = [{ move: uci, score: 29999, scoreType: 'mate', mateIn: 1 },
    { move: moves.find(m => m.from + m.to !== uci).from + moves.find(m => m.from + m.to !== uci).to,
      score: 29998, scoreType: 'mate', mateIn: 2 }];
  const analysis = { dcc1Move: uci, receipt: { fen: mateFen, provider: 'SF', status: 'partial', reason: 'Mate scores protected' } };
  const choice = SIM.decision(Chess, mateFen, 'sf-dcc', options, analysis);
  assert.equal(choice.picked_by, 'sf-raw-safety'); assert.equal(choice.raw_best_mate_in, 1);
  assert.equal(choice.near_ties, null); assert.equal(choice.raw_gap, null);
  const run = { id: 1, startedAt: '2026-09-24T00:00:00Z', white: 'sf-dcc', black: 'sf',
    startFen: mateFen, trace: [{ ...choice, fen: mateFen, san: raw.san }], state: 'incomplete', result: '*', reason: 'stopped' };
  const pgn = SIM.toPGN(Chess, run);
  assert.match(pgn, /raw_mate_in=1/); assert.doesNotMatch(pgn, /raw_mate=29999|raw_cp=29999/);
});


test('review depth replaces the root node cap while Sim and DCC probes retain node budgets', async () => {
  const { provider, searches } = fixture();
  try {
    const root = await provider.root(fen, { depth: 15 });
    assert.equal(searches[0].depth, 15);
    assert.equal(searches[0].nodes, undefined, 'no default node cap can stop a depth search early');
    assert.equal(root.ledger.rootDepth, 8, 'ledger records reached depth');
    await provider.analyzeDCC(fen, root, { dccTopCandidates: 3 });
    assert.equal(searches[1].nodes, 3000); assert.equal(searches[1].depth, undefined);
    await provider.root(fen, { nodes: 48000 });
    assert.equal(searches.at(-1).nodes, 48000); assert.equal(searches.at(-1).depth, undefined);
  } finally { provider.destroy(); }
});
