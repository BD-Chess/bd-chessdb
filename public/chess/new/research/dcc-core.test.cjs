const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Chess } = require('../js/chess.min.js');
const DCC = require('../js/8zc-dcc-core.js');
const start = new Chess().fen();
const moves = [{ move: 'e2e4', score: 30, rank: 1 }, { move: 'd2d4', score: 25, rank: 2 }];
function services(fen, raw = moves, overrides = {}) {
  const root = new Chess(fen).turn();
  return { Chess, fen, moves: raw, settings: { dccDepth: 5, dccTopCandidates: 3 },
    getPV: async f => {
      const b = new Chess(f), pv = [];
      for (let i = 0; i < 10 && !b.game_over(); i++) { const m = b.moves({ verbose: true })[0]; pv.push(m.from + m.to + (m.promotion || '')); b.move(m); }
      return { score: new Chess(f).turn() === root ? 30 : -30, depth: 24, pv };
    }, getScore: async f => new Chess(f).turn() === root ? 30 : -30, ...overrides };
}
test('score perspective is mover-relative for both colors, zero and missing are distinct', () => {
  assert.equal(DCC.normalize(-45, 'b', 'w'), 45);
  assert.equal(DCC.normalize(-45, 'w', 'b'), 45);
  assert.equal(DCC.normalize(0, 'w', 'w'), 0);
  assert.equal(DCC.normalize(null, 'b', 'w'), null);
  assert.equal(DCC.sensors([30, 30], start).stability, null);
});
test('full analysis observes exactly the configured total plies with consistent perspective', async () => {
  const r = await DCC.analyze(services(start));
  assert.equal(r.candidates.length, 2);
  for (const c of r.candidates) {
    assert.equal(c.data.observedPlies, 5);
    assert.deepEqual(c.data.evalSequence, [30, 30, 30, 30, 30]);
    assert.equal(c.data.status, 'complete');
  }
  assert.equal(r.receipt.calls, 10);
  assert.ok(r.receipt.calls <= r.receipt.maxCalls);
});
test('black root also receives positive advantage through alternating PV', async () => {
  const b = new Chess(); b.move('e4');
  const r = await DCC.analyze(services(b.fen(), [{ move: 'e7e5', score: 30 }]));
  assert.deepEqual(r.candidates[0].data.evalSequence, [30, 30, 30]);
  assert.equal(r.receipt.rootSide, 'b');
});
test('unknown PV cannot displace raw best; zero remains measured', async () => {
  const r = await DCC.analyze(services(start, moves, { getPV: async () => ({ score: null, pv: [] }) }));
  assert.equal(r.dcc1Move, 'e2e4');
  assert.equal(r.receipt.status, 'partial');
  assert.ok(r.candidates.every(c => c.data.status === 'unknown' && c.stability === null));
  const z = await DCC.analyze(services(start, moves, { getScore: async () => 0 }));
  assert.equal(z.candidates[0].data.endEval, 0);
});
test('illegal and malformed moves never enter the candidates', async () => {
  const r = await DCC.analyze(services(start, [{ move: 'e2e5', score: 999 }, { move: '<bad>', score: 999 }, ...moves]));
  assert.deepEqual(r.allMoves.map(m => m.move), ['e2e4', 'd2d4']);
});
test('10cp safety guard and decisive engine scores are protected', async () => {
  const r = await DCC.analyze(services(start, [{ move: 'e2e4', score: 30 }, { move: 'd2d4', score: 19 }]));
  assert.equal(r.dcc1Move, 'e2e4');
  assert.equal(r.candidates.find(c => c.move === 'd2d4').data.eligible, false);
  const m = await DCC.analyze(services(start, [{ move: 'e2e4', score: 29990 }, { move: 'd2d4', score: 29989 }]));
  assert.equal(m.dcc1Move, 'e2e4');
});
test('immediate mate is verified legally without depending on PV availability', async () => {
  const b = new Chess(); ['f3', 'e5', 'g4'].forEach(m => b.move(m));
  const r = await DCC.analyze(services(b.fen(), [{ move: 'd8h4', score: 29999 }], { getPV: async () => { throw Error('Must not request mate PV'); } }));
  assert.equal(r.dcc1Move, 'd8h4'); assert.equal(r.receipt.calls, 0);
  assert.equal(r.candidates[0].data.endEval, 30000);
});
test('cancel after awaited request discards the entire analysis', async () => {
  let stop = false;
  await assert.rejects(DCC.analyze(services(start, moves, {
    cancelled: () => stop, getPV: async () => { stop = true; return { score: 0, pv: [] }; }
  })), { name: 'AbortError' });
});
test('promotion identifiers remain distinct and legal', () => {
  const fen = '7k/P7/8/8/8/8/8/7K w - - 0 1';
  const legal = DCC.legalMoves(Chess, fen, ['a7a8q', 'a7a8n', 'a7a8x'].map(move => ({ move, score: 0 })));
  assert.equal(legal.length, 2);
  assert.notEqual(legal[0].move, legal[1].move);
});
test('same input yields same selection independent of candidate arrival order', async () => {
  const a = await DCC.analyze(services(start));
  const b = await DCC.analyze(services(start, [...moves].reverse()));
  assert.equal(a.dcc1Move, b.dcc1Move);
  assert.deepEqual(a.candidates, b.candidates);
});
