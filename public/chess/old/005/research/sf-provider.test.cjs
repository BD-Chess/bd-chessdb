const test = require('node:test');
const assert = require('node:assert/strict');
const { Chess } = require('../js/chess.min.js');
const SF = require('../js/8zc-sf-provider.js');
const SIM = require('../js/8zc-sim-core.js');

const fen = new Chess().fen();
const line = (move, score, rank = 1) => ({ multipv: rank, depth: 8, score: { type: 'cp', root: score, bound: 'exact' }, pv: [move] });
function fixture({ incomplete = false, coverage = true, onSearch = () => {} } = {}) {
  const searches = [];
  const preparations = [];
  const Engine = { create: () => ({ destroy() {}, async prepare(options) { preparations.push(options); },
    async analyze({ fen: position, nodes, depth, movetime, history, multiPV, signal, onInfo }) {
    if (signal?.aborted) throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
    searches.push({ position, nodes, depth, movetime, history, multiPV, signal, onInfo });
    onSearch(searches.at(-1));
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
  return { provider: SF.create({ Chess, Engine, DCC, multiPV: 3, rootNodes: 12000, probeNodes: 3000 }), searches, preparations };
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
test('Preparation and root searches forward the selected budget, history, signal and info callback', async () => {
  const { provider, searches, preparations } = fixture();
  const controller = new AbortController(), history = { startFen: fen, moves: [] }, onInfo = () => {};
  try {
    await provider.prepare({ signal: controller.signal });
    assert.equal(preparations.length, 1); assert.equal(preparations[0].signal, controller.signal);
    for (const budget of [{ depth: 12 }, { nodes: 9000 }, { movetime: 75 }]) {
      const root = await provider.root(fen, { ...budget, history, signal: controller.signal, onInfo });
      const search = searches.at(-1);
      for (const key of ['nodes', 'depth', 'movetime']) assert.equal(search[key], budget[key]);
      assert.deepEqual(search.history, history); assert.equal(search.signal, controller.signal);
      assert.equal(search.onInfo, onInfo); assert.equal(root.complete, true);
    }
  } finally { provider.destroy(); }
});
test('An already expired DCC deadline retains the completed root without starting a probe', async t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'performance');
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => 100 } });
  t.after(() => Object.defineProperty(globalThis, 'performance', descriptor));
  const { provider, searches } = fixture();
  try {
    const root = await provider.root(fen, { movetime: 25 });
    const result = await provider.analyzeDCC(fen, root, { dccTopCandidates: 3 }, undefined, { deadline: 100 });
    assert.equal(result.receipt.status, 'partial'); assert.equal(result.dcc1Move, 'e2e4');
    assert.deepEqual(result.allMoves, root.moves); assert.equal(searches.length, 1);
    assert.equal(provider.ledger.probes, 0);
  } finally { provider.destroy(); }
});
test('Timed DCC caps a probe to remaining time and stops scheduling when the deadline expires', async t => {
  let now = 100;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'performance');
  Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });
  t.after(() => Object.defineProperty(globalThis, 'performance', descriptor));
  const { provider, searches } = fixture({ onSearch: search => { if (search.position !== fen) now = 106; } });
  try {
    const root = await provider.root(fen, { movetime: 25 });
    const result = await provider.analyzeDCC(fen, root, { dccTopCandidates: 3 }, undefined,
      { deadline: 106, probeMovetime: 100 });
    assert.equal(searches.length, 2, 'the second DCC request cannot launch after expiration');
    assert.equal(searches[1].movetime, 6); assert.equal(searches[1].nodes, undefined);
    assert.equal(searches[1].depth, undefined); assert.equal(provider.ledger.probes, 1);
    assert.equal(result.receipt.status, 'partial'); assert.equal(result.dcc1Move, 'e2e4');
    assert.deepEqual(result.allMoves, root.moves);
  } finally { provider.destroy(); }
});
