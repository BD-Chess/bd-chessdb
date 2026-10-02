const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Chess } = require('../js/chess.min.js');
const DCC = require('../js/8zc-dcc-core.js');

function lineService(rootFen, rootScore = -40) {
  const rootSide = new Chess(rootFen).turn();
  return {
    getPV: async fen => {
      const board = new Chess(fen), pv = [];
      for (let i = 0; i < 10 && !board.game_over(); i++) {
        const move = board.moves({ verbose: true })[0];
        pv.push(move.from + move.to + (move.promotion || ''));
        board.move(move);
      }
      return { score: new Chess(fen).turn() === rootSide ? rootScore : -rootScore, depth: 20, pv };
    },
    getScore: async fen => new Chess(fen).turn() === rootSide ? rootScore : -rootScore
  };
}

test('a cooperative mate later in a PV cannot bypass the 10 cp root guard', async () => {
  const board = new Chess();
  board.move('e4'); board.move('f6');
  const result = await DCC.analyze({
    Chess, fen: board.fen(), settings: { dccDepth: 3 },
    moves: [{ move: 'g1f3', score: 30 }, { move: 'd2d4', score: 0 }],
    getPV: async fen => ({ score: -30, depth: 20,
      pv: new Chess(fen).get('d4') ? ['g7g5', 'd1h5'] : ['g7g6', 'd2d3'] }),
    getScore: async fen => new Chess(fen).turn() === 'w' ? 30 : -30
  });
  const cooperative = result.candidates.find(c => c.move === 'd2d4').data;
  assert.equal(cooperative.endEval, 30000);
  assert.equal(cooperative.eligible, false);
  assert.equal(result.dcc1Move, 'g1f3');
  assert.doesNotMatch(result.receipt.reason, /immediate checkmate/);
});

test('negative root evaluations stay negative across both side-to-move cases', async () => {
  for (const side of ['w', 'b']) {
    const board = new Chess();
    if (side === 'b') board.move('e4');
    const fen = board.fen();
    const move = side === 'w' ? 'e2e4' : 'e7e5';
    const result = await DCC.analyze({ Chess, fen, settings: { dccDepth: 3 },
      moves: [{ move, score: -40 }], ...lineService(fen) });
    assert.deepEqual(result.candidates[0].data.evalSequence, [-40, -40, -40]);
    assert.equal(result.candidates[0].data.floor, -40);
  }
});

test('a missing intermediate score stays unknown and prevents preference changes', async () => {
  const fen = new Chess().fen();
  const service = lineService(fen, 0);
  let probes = 0;
  const result = await DCC.analyze({ Chess, fen, settings: { dccDepth: 5 },
    moves: [{ move: 'e2e4', score: 0 }, { move: 'd2d4', score: -1 }], ...service,
    getScore: async position => ++probes === 1 ? null : service.getScore(position) });
  const best = result.candidates.find(candidate => candidate.move === 'e2e4').data;
  assert.deepEqual(best.samples.map(sample => sample.score), [0, null, 0, 0, 0]);
  assert.equal(best.status, 'partial');
  assert.equal(best.complete, false);
  assert.equal(result.receipt.status, 'partial');
  assert.equal(result.dcc1Move, 'e2e4');
  assert.match(result.receipt.reason, /insufficient comparable/);
});

test('staged coverage deepens guarded contenders equally within the probe budget', async () => {
  const fen = new Chess().fen();
  const result = await DCC.analyze({ Chess, fen,
    settings: { dccDepth: 5, dccTopCandidates: 3 },
    moves: [{ move: 'e2e4', score: 30 }, { move: 'd2d4', score: 25 }, { move: 'g1f3', score: 0 }],
    ...lineService(fen, 30) });
  assert.equal(result.receipt.deepened, true);
  for (const candidate of result.candidates) {
    assert.equal(candidate.data.targetPlies, candidate.data.eligible ? 5 : 3);
    assert.equal(candidate.data.observedPlies, candidate.data.targetPlies);
  }
  assert.equal(result.receipt.calls, 13);
  assert.equal(result.receipt.maxCalls, 15);
});
