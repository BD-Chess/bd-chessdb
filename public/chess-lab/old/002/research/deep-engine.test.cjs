'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Deep = require('../js/8zc-deep-engine.js');
const { Chess } = require('../js/chess.min.js');
const START = new Chess().fen();
const BLACK = (() => { const g = new Chess(); g.move('e4'); return g.fen(); })();
class WorkerStub {
  constructor(autoReady = true) { this.commands = []; this.terminated = false; this.autoReady = autoReady; }
  postMessage(command) {
    this.commands.push(command);
    if (this.autoReady && command === 'uci') queueMicrotask(() => this.emit('uciok'));
    if (this.autoReady && command === 'isready') queueMicrotask(() => this.emit('readyok'));
  }
  emit(line) { this.onmessage?.({ data: line }); }
  terminate() { this.terminated = true; }
}
function fixture(options) {
  const workers = [];
  const engine = Deep.create(Object.assign({ Chess, workerFactory: () => { const w = new WorkerStub(); workers.push(w); return w; } }, options));
  return { engine, workers };
}
const ready = () => new Promise(resolve => setImmediate(resolve));
test('UCI preserves zero, centipawn/mate type, White perspective and bounds', () => {
  const info = Deep.parseInfo('info depth 18 multipv 2 score cp 0 nodes 125000 time 30 pv e7e5 g1f3', BLACK);
  assert.equal(info.score.white, 0); assert.equal(info.multipv, 2); assert.equal(info.nodes, 125000);
  assert.deepEqual(info.pv, ['e7e5', 'g1f3']);
  const mate = Deep.parseInfo('info score mate -3 upperbound pv e7e5', BLACK).score;
  assert.deepEqual(mate, { type: 'mate', value: -3, root: -3, white: 3, bound: 'upper', whiteBound: 'lower', unit: 'moves' });
  assert.equal(Deep.parseInfo('info score cp 38 lowerbound pv e7e5', BLACK).score.white, -38);
});
test('Unknown or malformed scores never become a zero evaluation', () => {
  assert.equal(Deep.parseInfo('info string NNUE evaluation using a network', START), null);
  assert.equal(Deep.parseInfo('info depth 3 score cp nonsense pv e2e4', START).score, undefined);
  assert.equal(Deep.parseInfo('info nodes 250', START).score, undefined);
  assert.deepEqual(Deep.parseInfo('info wdl 100 800 100 score cp 0 pv e2e4', START).whiteWdl, [100, 800, 100]);
});
test('Node and infinite budgets do not inherit a hidden depth cap', () => {
  assert.equal(Deep.limitsFor({ fen: START, nodes: 100000 }, Chess).depth, null);
  assert.equal(Deep.limitsFor({ fen: START, infinite: true }, Chess).depth, null);
  assert.equal(Deep.limitsFor({ fen: START }, Chess).depth, 14);
  assert.throws(() => Deep.limitsFor({ fen: START, depth: 12, infinite: true }, Chess));
});
test('Input validation blocks UCI injection, malformed FEN, illegal/promoted root moves', () => {
  assert.throws(() => Deep.validateFen(START + '\nquit', Chess));
  assert.throws(() => Deep.validateFen('8/8/8/8/8/8/8/8 w - - 0 1', Chess));
  assert.throws(() => Deep.limitsFor({ fen: START, searchMoves: ['e2e5'] }, Chess));
  assert.throws(() => Deep.limitsFor({ fen: START, searchMoves: ['e2e4\nquit'] }, Chess));
  assert.throws(() => Deep.limitsFor({ fen: START, nodes: NaN }, Chess));
  const promotion = '7k/P7/8/8/8/8/8/7K w - - 0 1';
  assert.deepEqual(Deep.limitsFor({ fen: promotion, searchMoves: ['a7a8n'] }, Chess).searchMoves, ['a7a8n']);
});
test('Optional legal history reaches the exact root and is sent for repetition detection', async () => {
  const { engine, workers } = fixture();
  const history = { startFen: START, moves: ['e2e4'] };
  const done = engine.analyze({ fen: BLACK, history, nodes: 1000 }); await ready();
  assert(workers[0].commands.includes('position fen ' + START + ' moves e2e4'));
  workers[0].emit('bestmove e7e5');
  assert.equal((await done).positionHistory, 'Validated history supplied from startFen');
  assert.throws(() => Deep.limitsFor({ fen: START, history }, Chess), /does not reach/);
});
test('Handshake precedes search; completed MultiPV retains per-line depths and aggregate nodes', async () => {
  const { engine, workers } = fixture();
  const seen = [];
  const done = engine.analyze({ fen: START, nodes: 12000, multiPV: 2, searchMoves: ['e2e4', 'd2d4'], onInfo: (info, snapshot) => seen.push(snapshot) });
  await ready(); const w = workers[0];
  assert.equal(w.commands.at(-1), 'go nodes 12000 searchmoves e2e4 d2d4');
  assert(w.commands.indexOf('isready') < w.commands.findIndex(c => c.startsWith('position ')));
  w.emit('info depth 10 multipv 1 score cp 30 nodes 11000 pv e2e4 e7e5');
  w.emit('info depth 9 multipv 2 score cp 20 nodes 12050 pv d2d4 d7d5');
  w.emit('bestmove e2e4 ponder e7e5');
  const result = await done;
  assert.equal(result.nodes, 12050); assert.deepEqual(result.lines.map(l => l.depth), [10, 9]);
  assert.equal(result.bestMove, 'e2e4'); assert.equal(result.coldHash, true); assert(w.terminated);
  assert.equal(seen.length, 2); assert.equal(engine.isRunning(), false);
});
test('Stop returns partial analysis and sends actual UCI stop', async () => {
  const { engine, workers } = fixture();
  const done = engine.analyze({ fen: BLACK, infinite: true }); await ready();
  workers[0].emit('info depth 5 score cp 17 nodes 500 pv e7e5');
  engine.stop(); assert.equal(workers[0].commands.at(-1), 'stop');
  workers[0].emit('bestmove e7e5'); const result = await done;
  assert.equal(result.stopped, true); assert.equal(result.lines[0].score.white, -17);
  assert.equal(result.forcedStop, false);
});
test('Partial rank exchange preserves the last complete comparable MultiPV iteration', async () => {
  const { engine, workers } = fixture(); const done = engine.analyze({ fen: START, multiPV: 2, nodes: 15000 }); await ready();
  const w = workers[0];
  w.emit('info depth 10 multipv 1 score cp 30 nodes 11000 pv e2e4');
  w.emit('info depth 10 multipv 2 score cp 25 nodes 11000 pv d2d4');
  w.emit('info depth 11 multipv 1 score cp 35 nodes 15000 pv d2d4');
  w.emit('bestmove d2d4');
  const result = await done;
  assert.equal(result.completeMultiPV, true); assert.equal(result.linesDepth, 10);
  assert.deepEqual(result.lines.map(line => line.pv[0]), ['e2e4', 'd2d4']);
  assert.deepEqual(result.lines.map(line => line.score.root), [30, 25]);
  assert.equal(result.partialLines[0].depth, 11); assert.equal(result.bestMove, 'd2d4');
});
test('Unresponsive stop terminates worker without imposing a search deadline', async () => {
  const { engine, workers } = fixture({ stopGraceMs: 5 });
  const done = engine.analyze({ fen: START, infinite: true }); await ready(); engine.stop();
  const result = await done;
  assert.equal(result.stopped, true); assert.equal(result.forcedStop, true); assert(workers[0].terminated);
});
test('Abort cancels loading and search and suppresses late info', async () => {
  const { engine, workers } = fixture(); const controller = new AbortController(); let infoCount = 0;
  const done = engine.analyze({ fen: START, signal: controller.signal, onInfo: () => infoCount++ });
  await ready(); const staleHandler = workers[0].onmessage; controller.abort();
  await assert.rejects(done, { name: 'AbortError' });
  staleHandler({ data: 'info depth 7 score cp 900 pv e2e4' });
  assert.equal(infoCount, 0); assert(workers[0].terminated);
  const loading = fixture({ workerFactory: () => new WorkerStub(false) });
  const c = new AbortController(), p = loading.engine.analyze({ fen: START, signal: c.signal }); c.abort();
  await assert.rejects(p, { name: 'AbortError' });
});
test('Superseding position terminates old worker; old bestmove cannot complete new search', async () => {
  const { engine, workers } = fixture();
  const old = engine.analyze({ fen: START }); const oldRejection = assert.rejects(old, { name: 'AbortError' }); await ready();
  const stale = workers[0].onmessage;
  const fresh = engine.analyze({ fen: BLACK }); await oldRejection; await ready();
  stale({ data: 'bestmove e2e4' }); assert(engine.isRunning()); assert(workers[0].terminated);
  workers[1].emit('bestmove e7e5'); assert.equal((await fresh).fen, BLACK);
});
test('Worker readiness failures reject cleanly; closed engines cannot restart', async () => {
  const { engine } = fixture({ workerFactory: () => new WorkerStub(false), readyTimeoutMs: 5 });
  await assert.rejects(engine.analyze({ fen: START }), /did not become ready/);
  engine.destroy(); await assert.rejects(engine.analyze({ fen: START }), /destroyed/);
});
test('Terminal bestmove without legal move is represented as null', async () => {
  const { engine, workers } = fixture(); const p = engine.analyze({ fen: '7k/6Q1/5K2/8/8/8/8/8 b - - 0 1' });
  await ready(); workers[0].emit('bestmove (none)');
  assert.equal((await p).bestMove, null);
});
