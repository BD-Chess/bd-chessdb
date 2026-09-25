const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Chess } = require('../js/chess.min.js');
const DCC = require('../js/8zc-dcc-core.js');
const SIM = require('../js/8zc-sim-core.js');
const source = fs.readFileSync(path.join(__dirname, '../js/8zc-utils.js'), 'utf8');
const definitions = [...source.matchAll(/^ {0,2}(?:async )?function (\w+)\(/gm)];
function extract(name) {
  const i = definitions.findIndex(m => m[1] === name), start = definitions[i].index;
  const end = name === 'startNewGame' ? source.indexOf("  document.getElementById('btnNew').onclick", start)
    : name === 'jumpTo' ? source.indexOf("  ['first','prev','next','last']", start) : definitions[i + 1].index;
  return source.slice(start, end);
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function context() {
  const nodes = new Map();
  const node = () => ({ style: {}, textContent: '', innerHTML: '', dataset: {}, replaceChildren() {},
    classList: { toggle() {} }, setAttribute() {}, appendChild() {} });
  const el = id => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); };
  const c = {
    positionEval: { render() {}, update() {} },
    simRequests: new Set(),
    workspace: { reset() {}, start() {}, pause() {}, stop() {}, history() {}, recordMove() {} },
    Chess, DCC, SIM, AbortController, console, Date, game: new Chess(),
    settings: { evalMode: 'direct', simSpeed: 0, dccDepth: 5, dccTopCandidates: 3, dccEvalFloor: 80 },
    activityEpoch: 0, analysisGeneration: 0, activeLookaheadId: 0,
    simRunning: false, simAbort: false, replayRunning: false, replayAbort: false,
    simSession: null, simExperiments: [], showEval: true, fullHistory: [],
    playState: { active: false, mode: 'idle', sessionId: 1, lichess: {}, prevShowEval: true },
    lastLoadedPGN: null, bookFlags: [], dccMoveAnnotations: {}, divergedIndex: -1,
    lastMoveIndex: -1, lastAction: null, preSimFen: null, preSimMoveIndex: -1,
    dccViewActive: false, evalRetryTimer: null, latestDCCResults: [], latestDCCReceipt: null,
    window: {}, document: { getElementById: el, querySelectorAll: () => [], createElement: node },
    board: { position() {}, orientation() {} },
    setTimeout: () => 1, clearTimeout() {}, clearInterval() {}, sleep: async () => {},
    applySettings() {}, refreshPlayUi() {}, renderLichessClocks() {}, closeSimModal() {},
    queueCoachMessage() {}, maybeEmitCoach: async () => {}, renderHistory() {},
    fetchAnnotations() {}, renderDCCView() {}, renderSimDecision() {},
    setBoardThinking: on => { c.thinking = on; },
    renderSimStats: () => { c.statsRenders++; }, statsRenders: 0,
    updateSimStatus: message => { c.status = message; },
    updateBoard: reset => { c.analysisGeneration++; if (reset || c.lastAction === 'move') c.fullHistory = c.game.history({ verbose: true }); },
    cachedFetchChessDB: async fen => ({ moves: new Chess(fen).moves({ verbose: true }).slice(0, 2).map(m => ({ move: m.from + m.to + (m.promotion || ''), score: 0 })) }),
    analyzePosition: async (fen, moves) => ({ allMoves: moves, candidates: [], dcc1Move: moves[1]?.move || moves[0]?.move, receipt: { fen, status: 'complete' } })
  };
  vm.createContext(c);
  for (const name of ['getStartFen', 'normalizeUci', 'applyUciMove', 'uciToSan', 'describeErr', 'sessionIsCurrent',
    'invalidateDCCAnalysis', 'clearLichessStreams', 'leaveActiveSession', 'startNewGame',
    'pauseSimulation', 'runSimulation', 'jumpTo', 'runDccBotTurn', 'replayGame', 'stopReplay']) {
    vm.runInContext(extract(name), c, { filename: `production:${name}` });
  }
  c.el = el;
  return c;
}

test('New game resets the reported SimB c4/e6 session and removes active locks', () => {
  const c = context(); c.game.move('c4'); c.game.move('e6');
  c.fullHistory = c.game.history({ verbose: true });
  Object.assign(c.playState, { active: true, mode: 'dccbot', userColor: 'w', autoMoveBusy: true, waiting: true });
  c.startNewGame();
  assert.equal(c.game.fen(), new Chess().fen()); assert.equal(c.fullHistory.length, 0);
  assert.equal(c.playState.active, false); assert.equal(c.playState.autoMoveBusy, false);
  assert.equal(c.thinking, false); assert.equal(c.el('gameTitle').textContent, 'Your next move starts here');
});
test('New game during a local bot request prevents the late e6 move', async () => {
  const c = context(), pending = deferred(); c.game.move('c4');
  Object.assign(c.playState, { active: true, mode: 'dccbot', userColor: 'w' });
  c.pickDCCMove = () => pending.promise;
  const task = c.runDccBotTurn(); await flush(); c.startNewGame();
  pending.resolve({ move: 'e7e6' }); await task;
  assert.equal(c.game.fen(), new Chess().fen()); assert.equal(c.playState.active, false);
});
test('each color obeys its selected policy; raw is top 1 even when DCC differs', async () => {
  for (const [white, black] of [['raw', 'dcc'], ['dcc', 'raw']]) {
    const c = context(), expected = [], read = c.cachedFetchChessDB;
    c.cachedFetchChessDB = async fen => {
      if (expected.length === 2) return { moves: [] };
      const result = await read(fen);
      const engine = new Chess(fen).turn() === 'w' ? white : black;
      expected.push(result.moves[engine === 'dcc' ? 1 : 0].move); return result;
    };
    await c.runSimulation(white, black, c.game.fen());
    assert.deepEqual(Array.from(c.simSession.trace, r => r.move), expected);
    assert.deepEqual(Array.from(c.simSession.trace, r => r.policy), [white, black]);
    assert.equal(c.simSession.result, '*'); assert.equal(c.simSession.state, 'incomplete');
  }
});
test('history selection pauses exactly at that move, retaining the rest of the line', () => {
  const c = context(); ['c4', 'e6', 'g3', 'd5'].forEach(m => c.game.move(m));
  c.fullHistory = c.game.history({ verbose: true }); c.simRunning = true;
  c.simSession = { trace: [], state: 'running' };
  c.jumpTo(0);
  const expected = new Chess(); expected.move('c4');
  assert.equal(c.game.fen(), expected.fen()); assert.equal(c.fullHistory.length, 4);
  assert.equal(c.simRunning, false); assert.equal(c.simSession.state, 'paused');
});
test('an old paused request cannot play or clean up a replacement experiment', async () => {
  const c = context(), a = deferred(), b = deferred(); let calls = 0;
  c.analyzePosition = () => (++calls === 1 ? a.promise : b.promise);
  const first = c.runSimulation('raw', 'dcc', c.game.fen()); await flush();
  c.pauseSimulation(); const second = c.runSimulation('dcc', 'raw', c.game.fen()); await flush();
  const renders = c.statsRenders; a.resolve(null); await first;
  assert.equal(c.game.history().length, 0); assert.equal(c.simRunning, true);
  assert.equal(c.simSession.id, 2); assert.equal(c.statsRenders, renders);
  c.startNewGame(); b.resolve(null); await second;
  assert.equal(c.game.history().length, 0); assert.equal(c.simRunning, false);
});
test('pause during the visible move delay prevents committing the shown candidate', async () => {
  const c = context(), delay = deferred(); c.sleep = () => delay.promise;
  const task = c.runSimulation('raw', 'dcc', c.game.fen()); await flush();
  c.pauseSimulation(); delay.resolve(); await task;
  assert.equal(c.game.history().length, 0); assert.equal(c.simSession.trace.length, 0);
});
test('Replay canceled by New game cannot restore the old move list or result panel', async () => {
  const c = context(), pending = deferred(); c.game.move('c4');
  c.fullHistory = c.game.history({ verbose: true });
  c.renderReplayProgress = () => {}; c.analyzePosition = () => pending.promise;
  const task = c.replayGame(); await flush(); c.startNewGame();
  pending.resolve(null); await task;
  assert.equal(c.game.fen(), new Chess().fen()); assert.equal(c.fullHistory.length, 0);
  assert.equal(c.el('simStatsPanel').style.display, 'none'); assert.equal(c.replayRunning, false);
});
