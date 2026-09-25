/* Exercise the production analysis memo with real DCC and evidence modules.
 * A cached decision must carry the same frozen source snapshot as that decision. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Chess } = require('../js/chess.min.js');
const DCC = require('../js/8zc-dcc-core.js');
const Evidence = require('../js/8zc-evidence.js');
const source = fs.readFileSync(path.join(__dirname, '../js/8zc-utils.js'), 'utf8');
const definitions = [...source.matchAll(/^ {2}(?:async )?function (\w+)\(/gm)];
const definition = definitions.findIndex(match => match[1] === 'analyzePosition');
assert.ok(definition >= 0, 'Production analyzePosition exists');
const productionFunction = source.slice(definitions[definition].index, definitions[definition + 1].index);
const fen = new Chess().fen();
const roots = () => [{ move: 'e2e4', score: 30, sourceOrder: 0 }, { move: 'd2d4', score: 30, sourceOrder: 1 }];

function context() {
  const events = [], calls = [];
  const c = {
    Chess, DCC, window: { ChessEvidence: Evidence }, analysisGeneration: 0, offlineEvidence: null,
    settings: { dccDepth: 3, dccPolicy: 'balanced', dccDefenseCheck: false, evalMode: 'direct' },
    analysisMemo: new Map(), analysisPending: new Map(), sourceObservations: new Map(),
    labSnapshots: new Map(), lastAnalysisResult: null, console,
    labListeners: [value => events.push(value)], updateDCCProgress() {},
    getLabContext: () => ({ analysis: c.lastAnalysisResult, evidence: c.labSnapshots.get(fen) }),
    evidenceProviders(collector) {
      const respond = (kind, position, response) => {
        calls.push({ kind, fen: position });
        collector.capture({ kind, fen: position, source: 'deterministic-fixture', response });
        return Promise.resolve(response);
      };
      return {
        getMoves: position => respond('moves', position, { moves: roots() }),
        getPV(position) {
          const board = new Chess(position), pv = [];
          const score = board.turn() === 'w' ? 30 : -30;
          for (let i = 0; i < 8 && !board.game_over(); i++) {
            const move = board.moves({ verbose: true })[0];
            pv.push(move.from + move.to + (move.promotion || ''));
            board.move(move);
          }
          return respond('pv', position, { score, depth: 24, pv });
        },
        getScore: position => respond('score', position, new Chess(position).turn() === 'w' ? 30 : -30)
      };
    }
  };
  vm.createContext(c);
  vm.runInContext(productionFunction, c);
  return { c, events, calls };
}

test('A → B → A cache restores exact A evidence and emits a matching analysis context', async () => {
  const { c, events, calls } = context();
  const a = await c.analyzePosition(fen, roots());
  assert.equal(a.receipt.status, 'complete');
  const evidenceA = c.labSnapshots.get(fen);
  Evidence.validate(evidenceA);
  c.settings.dccDepth = 5;
  const b = await c.analyzePosition(fen, roots());
  assert.equal(b.receipt.status, 'complete');
  const evidenceB = c.labSnapshots.get(fen);
  assert.notEqual(evidenceA.id, evidenceB.id);
  const callsBeforeHit = calls.length;
  c.settings.dccDepth = 3;
  const restored = await c.analyzePosition(fen, roots());
  assert.equal(restored, a, 'A uses the already computed decision');
  assert.equal(calls.length, callsBeforeHit, 'A cache hit does not call the sample provider');
  assert.equal(c.labSnapshots.get(fen).id, evidenceA.id, 'A restores its original evidence, not B evidence');
  assert.equal(c.lastAnalysisResult, a);
  assert.equal(events.at(-1).analysis, a);
  assert.equal(events.at(-1).evidence.id, evidenceA.id);
  assert.equal(events.at(-1).evidence.payload.settings.dccDepth, a.receipt.requestedPlies);
});

test('changed root evaluations invalidate cached decisions and freeze the new candidate list', async () => {
  const { c, calls } = context();
  const first = await c.analyzePosition(fen, roots());
  const callsBefore = calls.length;
  const changed = roots(); changed[1].score = 80;
  const second = await c.analyzePosition(fen, changed);
  assert.notEqual(second, first);
  assert.ok(calls.length > callsBefore);
  assert.equal(second.receipt.rawBest, 'd2d4');
  const evidence = c.labSnapshots.get(fen);
  assert.equal(evidence.payload.analysis.receipt.rawBest, 'd2d4');
  const replay = Evidence.replay(evidence);
  assert.equal((await replay.getMoves(fen)).moves.find(move => move.move === 'd2d4').score, 80);
});

test('a provider tie-order change cannot reuse the previous tie decision', async () => {
  const { c } = context();
  const first = await c.analyzePosition(fen, roots());
  const reordered = roots().reverse().map((move, sourceOrder) => ({ ...move, sourceOrder }));
  const second = await c.analyzePosition(fen, reordered);
  assert.notEqual(first, second);
  assert.equal(first.receipt.rawBest, 'e2e4');
  assert.equal(second.receipt.rawBest, 'd2d4');
  assert.equal(second.dcc1Move, 'd2d4');
  assert.equal(c.labSnapshots.get(fen).payload.analysis.dcc1Move, 'd2d4');
});
