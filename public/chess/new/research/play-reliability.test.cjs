/* Regression checks for asynchronous session and Replay ownership. No network. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Chess } = require('../js/chess.min.js');
const source = fs.readFileSync(path.join(__dirname, '../js/8zc-utils.js'), 'utf8');
const definitions = [...source.matchAll(/^ {0,2}(?:async )?function (\w+)\(/gm)];
function extract(name) {
  const i = definitions.findIndex(match => match[1] === name);
  assert.ok(i >= 0, `${name} exists in production source`);
  const start = definitions[i].index;
  const end = name === 'generateAnnotatedPGN' ? source.indexOf('  const btnReplay =', start) : definitions[i + 1].index;
  return source.slice(start, end);
}
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function context() {
  const status = [];
  const elements = new Map();
  const node = () => ({ style: {}, classList: { toggle() {} }, appendChild() {}, setAttribute() {}, click() {} });
  elements.set('btnReplay', node());
  elements.set('simStatsPanel', node());
  const c = {
    Chess, AbortController, DOMException, TextDecoder, URL, URLSearchParams, Blob,
    console: { warn() {}, error() {} },
    game: new Chess(),
    playState: {
      active: true, mode: 'lichess', sessionId: 1, userColor: 'w', autoPilot: true,
      autoMoveBusy: false, waiting: false, sessionAbort: new AbortController(),
      lichess: { gameId: 'game001', ready: true, token: 'test-only', apiKind: 'bot',
        lastMoves: '', initialFen: new Chess().fen(), pendingMove: null, botUsername: 'opponent' }
    },
    settings: { simSpeed: 0, dccDepth: 5, dccTopCandidates: 3, dccEvalFloor: 80 },
    analysisGeneration: 0, replayRunning: false, replayAbort: false, simRunning: false,
    fullHistory: [], lastAction: null, window: {},
    board: { position() {}, orientation() {} }, document: {
      getElementById: id => elements.get(id) || null,
      querySelectorAll: () => [], createElement: node
    },
    updateBoard() {}, setBoardThinking() {}, refreshPlayUi() {}, renderHistory() {}, renderDCCView() {},
    updateSimStatus: text => status.push(text), status,
    renderReplayProgress(annotations) { c.review = structuredClone(annotations); },
    updateLichessClocks() {}, renderLichessClocks() {},
    queueCoachMessage() {}, maybeEmitCoach: async () => {},
    reportSessionIssue: (prefix, error) => status.push(`${prefix}: ${error.message}`),
    invalidateDCCAnalysis: () => { c.analysisGeneration++; },
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    sleep: async () => {}, alert: () => assert.fail('Unexpected alert'),
    fetch: async () => assert.fail('Unexpected network request'),
    leaveActiveSession: message => { c.playState.active = false; status.push(message); },
    pickDCCMove: async () => ({ move: 'e2e4' })
  };
  vm.createContext(c);
  for (const name of ['getStartFen', 'normalizeUci', 'applyUciMove', 'uciToSan', 'describeErr',
    'sessionIsCurrent', 'sessionAbortError', 'syncGameFromMoves', 'readNdjsonStream',
    'guessUserColorFromGameFull', 'startLichessEventWait', 'startLichessGameStream',
    'sendLichessMove', 'scheduleLichessOpeningKick', 'runLichessAutoMove', 'runDccBotTurn',
    'handleLiveUserMove', 'stopReplay', 'replayAgreement', 'replayGame', 'generateAnnotatedPGN']) {
    vm.runInContext(extract(name), c, { filename: `production:${name}` });
  }
  return c;
}

test('server snapshot removes a speculative opening and preserves a custom initial FEN', () => {
  const c = context();
  c.game.move('e4');
  c.syncGameFromMoves('', 'startpos');
  assert.equal(c.game.history().length, 0);
  const start = '8/8/8/8/8/8/P3K3/7k w - - 0 25';
  c.syncGameFromMoves('a2a3', start);
  c.syncGameFromMoves('a2a3 h1g1');
  const expected = new Chess(start);
  expected.move('a3'); expected.move('Kg1');
  assert.equal(c.game.fen(), expected.fen());
  const before = c.game.fen();
  assert.throws(() => c.syncGameFromMoves('a2a9'), /cannot be reconstructed/);
  assert.equal(c.game.fen(), before, 'invalid snapshot leaves confirmed board intact');
});

test('one move POST per confirmed position, even after POST success and duplicate snapshots', async () => {
  const c = context();
  let posts = 0;
  const response = deferred();
  c.fetch = () => { posts++; return response.promise; };
  const first = c.runLichessAutoMove();
  await flush();
  assert.equal(posts, 1);
  assert.equal(c.game.history().length, 0, 'no optimistic move');
  await c.runLichessAutoMove();
  c.syncGameFromMoves('');
  response.resolve({ ok: true });
  await first;
  await c.runLichessAutoMove();
  assert.equal(posts, 1, 'successful POST stays pending until stream confirmation');
  c.syncGameFromMoves('e2e4 e7e5');
  c.pickDCCMove = async () => ({ move: 'g1f3' });
  c.fetch = async () => { posts++; return { ok: true }; };
  await c.runLichessAutoMove();
  assert.equal(posts, 2);
  assert.deepEqual(c.game.history(), ['e4', 'e5']);
});

test('late automatic analysis cannot send into a replacement session', async () => {
  const c = context();
  const pick = deferred();
  c.pickDCCMove = () => pick.promise;
  const running = c.runLichessAutoMove();
  c.playState.sessionAbort.abort();
  c.playState.sessionId++;
  c.playState.lichess.gameId = 'newgame';
  c.playState.autoMoveBusy = true;
  pick.resolve({ move: 'e2e4' });
  await running;
  assert.equal(c.game.history().length, 0);
  assert.equal(c.playState.autoMoveBusy, true, 'old cleanup cannot unlock the new worker');
});

test('late local bot analysis cannot move after Stop', async () => {
  const c = context();
  c.playState.mode = 'dccbot';
  c.playState.userColor = 'b';
  const pick = deferred();
  c.pickDCCMove = () => pick.promise;
  const running = c.runDccBotTurn();
  c.playState.active = false;
  c.playState.sessionId++;
  pick.resolve({ move: 'e2e4' });
  await running;
  assert.equal(c.game.history().length, 0);
});

test('human relay restores the confirmed board before waiting for HTTP', async () => {
  const c = context();
  c.playState.autoPilot = false;
  const before = c.game.fen();
  const move = c.game.move('e4');
  const response = deferred();
  c.fetch = () => response.promise;
  const sent = c.handleLiveUserMove(move, before);
  assert.equal(c.game.fen(), before);
  response.resolve({ ok: true });
  await sent;
  assert.equal(c.game.fen(), before);
  c.syncGameFromMoves('e2e4');
  assert.deepEqual(c.game.history(), ['e4']);
});

test('event stream ignores unrelated game starts and matches its challenge', async () => {
  const c = context();
  c.fetch = async () => new Response([
    JSON.stringify({ type: 'gameStart', game: { id: 'unrelated' } }),
    JSON.stringify({ type: 'gameStart', game: { id: 'expected' } })
  ].join('\n'));
  assert.equal(await c.startLichessEventWait('test-only', 1, Promise.resolve('expected')), 'expected');
});

test('terminal gameFull ends the session and uses the API family chosen at setup', async () => {
  const c = context();
  let endpoint;
  c.fetch = async url => {
    endpoint = url;
    return new Response(JSON.stringify({ type: 'gameFull', initialFen: 'startpos',
      white: { id: 'us' }, black: { id: 'opponent' },
      state: { moves: 'e2e4', status: 'resign', winner: 'white' } }) + '\n');
  };
  await c.startLichessGameStream('game001', 1);
  assert.match(endpoint, /\/api\/bot\/game\/stream\//);
  assert.equal(c.playState.active, false);
  assert.equal(c.game.header().Result, '1-0');
  assert.deepEqual(c.game.history(), ['e4']);
});

test('Replay Stop during analysis does not play the awaited move', async () => {
  const c = context();
  c.playState.active = false;
  c.game.move('e4'); c.game.move('e5');
  c.fullHistory = c.game.history({ verbose: true });
  const analysis = deferred();
  c.analyzePosition = () => analysis.promise;
  const running = c.replayGame();
  c.stopReplay();
  analysis.resolve({ candidates: [], allMoves: [], dcc1Move: null });
  await running;
  assert.equal(c.game.history().length, 0);
  assert.equal(c.replayRunning, false);
  assert.equal(c.playState.replaying, false);
  assert.equal(c.review.length, 0);
  assert.match(c.status.at(-1), /stopped: 0\/2/);
});

test('Replay distinguishes underpromotions and exports separate score meanings', async () => {
  const c = context();
  c.playState.active = false;
  const start = '7k/P7/8/8/8/8/8/4K3 w - - 0 1';
  c.game.load(start);
  c.game.move({ from: 'a7', to: 'a8', promotion: 'n' });
  c.fullHistory = c.game.history({ verbose: true });
  c.analyzePosition = async () => ({
    allMoves: [{ move: 'a7a8q', score: 900 }, { move: 'a7a8n', score: 0 }],
    candidates: [{ move: 'a7a8q', raw: 900, dcc: 905, stability: 1 }],
    dcc1Move: 'a7a8q', receipt: { status: 'complete' }
  });
  await c.replayGame();
  assert.equal(c.review[0].raw, 0);
  assert.equal(c.review[0].dcc, null);
  assert.equal(c.review[0].isDCC1, false);
  const pgn = c.generateAnnotatedPGN({ White: 'A "quote"', Result: '*' }, c.fullHistory, c.review, 0, null,
    { state: 'complete', initialFen: start });
  assert.match(pgn, /DCC_WhiteAgreement "0%"/);
  assert.doesNotMatch(pgn, /Accuracy/);
  assert.match(pgn, /raw_cp=0/);
  assert.match(pgn, /DCC#1=no/);
  assert.match(pgn, /A \\"quote\\"/);
  const parsed = new Chess();
  assert.equal(parsed.load_pgn(pgn), true, 'export remains a loadable PGN');
  assert.equal(parsed.fen(), c.game.fen());
});

test('partial DCC coverage is reported as a gap, not a completed comparison', async () => {
  const c = context();
  c.playState.active = false;
  c.game.move('e4');
  c.fullHistory = c.game.history({ verbose: true });
  c.analyzePosition = async () => ({ allMoves: [{ move: 'e2e4', score: 20 }],
    candidates: [], dcc1Move: 'e2e4', receipt: { status: 'partial' } });
  await c.replayGame();
  assert.equal(c.review[0].isDCC1, null);
  assert.equal(c.review[0].coverage, 'partial');
  assert.match(c.status.at(-1), /finished with gaps/);
});
