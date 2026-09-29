const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { Chess } = require('../js/chess.min.js');

const app = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(app, 'play.html'), 'utf8');
const script = fs.readFileSync(path.join(app, 'js/app-mobile.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

test('phone views switch in one tap and retain the shared position', async () => {
  const dom = new JSDOM(html, { url: 'https://example.test/chess/app/play.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, d = w.document, byId = id => d.getElementById(id);
  let fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', listener, more = 0, replay = 0, sim = 0;
  let analyses = {}, suggested = null;
  const minis = [];
  w.ChessLabReady = Promise.resolve();
  w.ChessLabHost = {
    Chess,
    getContext: () => ({ fen, history: [], analysisSources: analyses }),
    getReviewGame: () => ({ cursor: 0, totalPly: 0 }),
    playSuggestedMove: move => { suggested = move; return true; },
    onChange: fn => { listener = fn; }
  };
  w.ChessLabLayout = { openTools: () => { more++; }, closeTools: () => {} };
  w.Chessboard = (_id, options) => {
    const board = { fen: options.position, position(next) { this.fen = next; }, resize() {} };
    minis.push(board); return board;
  };
  byId('btnViewToggle').setAttribute('aria-pressed', 'false');
  byId('btnViewToggle').addEventListener('click', () => {
    const next = byId('btnViewToggle').getAttribute('aria-pressed') !== 'true';
    byId('btnViewToggle').setAttribute('aria-pressed', String(next));
  });
  const review = d.createElement('section'); review.id = 'gameReviewPanel'; review.hidden = true;
  byId('controls').append(review);
  byId('btnGameReview').addEventListener('click', () => { review.hidden = !review.hidden; });
  const deep = d.createElement('section'); deep.id = 'deepAnalysisPanel'; deep.hidden = true;
  const close = d.createElement('button'); close.dataset.deep = 'close'; close.addEventListener('click', () => { deep.hidden = true; });
  deep.append(close); byId('workspaceDisplay').append(deep);
  byId('btnDeepAnalysis').addEventListener('click', () => { deep.hidden = !deep.hidden; });
  byId('btnGames').addEventListener('click', () => byId('popularGamesPanel').classList.add('open'));
  byId('btnCloseGames').addEventListener('click', () => byId('popularGamesPanel').classList.remove('open'));
  byId('btnReplay').addEventListener('click', () => { replay++; });
  byId('btnSim').addEventListener('click', () => { sim++; });
  w.eval(script);
  w.dispatchEvent(new w.Event('load'));
  await flush();

  const tab = view => byId('appTabs').querySelector(`[data-app-tab="${view}"]`).click();
  assert.equal(byId('analysisSource').closest('.app-analysis-slot')?.parentElement.className, 'app-action-row');
  assert.equal(d.querySelector('.top-buttons').parentElement.id, 'appBoardControls');
  assert.equal(byId('appBoardControls').firstElementChild.classList.contains('top-buttons'), true);
  assert.equal(byId('appSim').parentElement.className, 'app-action-row');
  assert.equal(byId('analysisSourceStatus').parentElement.id, 'appBoardControls');
  assert.equal(d.querySelectorAll('[data-app-lang]').length, 2);
  assert.equal(byId('appTopLine').hidden, false);
  assert.equal(byId('appTopLineLabel').textContent, 'TOP LINE · CDB/SF');
  assert.equal(byId('appTopLineMoves').textContent, 'Analyzing…');
  d.querySelector('[data-app-lang="sl"]').click();
  assert.equal(d.documentElement.lang, 'sl');
  assert.equal(byId('appTopLineMoves').textContent, 'Analiziram…');
  assert.equal(byId('appTabs').querySelector('[data-app-tab="board"] span:last-child').textContent, 'Šahovnica');
  assert.equal(byId('appSim').textContent, 'Sim / Play');
  d.querySelector('[data-app-lang="en"]').click();
  assert.equal(d.documentElement.lang, 'en');
  assert.equal(byId('appTabs').querySelector('[data-app-tab="board"] span:last-child').textContent, 'Board');
  assert.equal(byId('appSim').textContent, 'Sim / Play');
  assert.equal(byId('workspaceTimers').parentElement.parentElement.id, 'appClocks');
  byId('appSim').click();
  assert.equal(sim, 1);
  tab('moves');
  assert.equal(d.body.dataset.appView, 'moves');
  assert.equal(minis.length, 1);
  fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
  listener();
  assert.equal(minis[0].fen, fen);
  tab('review');
  assert.equal(review.hidden, false);
  tab('deep');
  assert.equal(review.hidden, true);
  assert.equal(deep.hidden, false);
  tab('dcc');
  assert.equal(deep.hidden, true);
  assert.equal(byId('btnViewToggle').getAttribute('aria-pressed'), 'true');
  assert.equal(byId('appReplay').hidden, false);
  byId('appReplay').click();
  assert.equal(replay, 1);
  tab('board');
  assert.equal(byId('btnViewToggle').getAttribute('aria-pressed'), 'false');
  assert.equal(byId('appPositionPreview').hidden, true);
  byId('appGames').click();
  assert.equal(d.body.dataset.appView, 'moves');
  assert.ok(byId('popularGamesPanel').classList.contains('open'));
  tab('board');
  assert.ok(!byId('popularGamesPanel').classList.contains('open'));
  byId('appMore').click();
  assert.equal(more, 1);
  tab('moves');
  byId('appSimMore').click();
  assert.equal(d.body.dataset.appView, 'board');
  assert.equal(sim, 2);
  assert.equal(byId('appTabs').querySelectorAll('[aria-current="page"]').length, 1);
  let pauseRequests = 0;
  d.addEventListener('chess:pause-request', () => { pauseRequests++; });
  for (const [kind, label, action] of [
    ['sim', 'Simulation running', 'Pause'],
    ['replay', 'DCC replay running', 'Stop replay'],
    ['local', 'Game in progress', 'End game']
  ]) {
    d.dispatchEvent(new w.CustomEvent('chess:activity', { detail: { kind, simRunning: kind === 'sim' } }));
    assert.equal(byId('appActivity').hidden, false);
    assert.equal(byId('appActivityText').textContent, label);
    assert.equal(byId('appPause').textContent, action);
    byId('appPause').click();
  }
  assert.equal(pauseRequests, 3);
  d.dispatchEvent(new w.CustomEvent('chess:activity', { detail: { kind: 'analysis', simRunning: false } }));
  assert.equal(byId('appActivity').hidden, true);
  dom.window.close();
});

test('Moves opens around the current move in a long game and preserves manual scrolling', async () => {
  const dom = new JSDOM(html, { url: 'https://example.test/chess/app/play.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, d = w.document, byId = id => d.getElementById(id);
  let history = Array(20).fill('e4');
  w.ChessLabReady = Promise.resolve();
  w.ChessLabHost = {
    getContext: () => ({ fen: 'start', history }),
    onChange: fn => { w.positionChanged = fn; }
  };
  w.Chessboard = () => ({ resize() {}, position() {} });
  w.requestAnimationFrame = callback => callback();
  const display = byId('workspaceDisplay');
  display.getBoundingClientRect = () => ({ top: 100, height: 500 });
  byId('moves').innerHTML = '<table><tr><td class="move current" data-history-ply="19">Bb6</td></tr></table>';
  byId('moves').querySelector('.move').getBoundingClientRect = () => ({ top: 500, height: 44 });
  w.eval(script);
  w.dispatchEvent(new w.Event('load'));
  await flush();
  const tab = view => byId('appTabs').querySelector(`[data-app-tab="${view}"]`).click();
  tab('moves');
  assert.equal(display.scrollTop, 172);
  display.scrollTop = 300;
  tab('board');
  tab('moves');
  assert.equal(display.scrollTop, 300);
  history = Array(21).fill('e4');
  byId('moves').querySelector('.move').dataset.historyPly = '20';
  w.positionChanged();
  assert.equal(display.scrollTop, 472);
  dom.window.close();
});


test('APP language waits for chess bootstrap before touching the donor DOM', async () => {
  const dom = new JSDOM(html, { url: 'https://example.test/chess/app/play.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, d = w.document, byId = id => d.getElementById(id);
  Object.defineProperty(w.navigator, 'language', { value: 'sl-SI', configurable: true });
  let releaseReady;
  w.ChessLabReady = new Promise(resolve => { releaseReady = resolve; });
  w.ChessLabHost = {
    getContext: () => ({ fen: 'start', history: [], analysisSources: {} }),
    onChange: () => {}
  };
  w.eval(script);
  w.dispatchEvent(new w.Event('load'));
  await flush();
  assert.equal(d.documentElement.lang, 'en');
  assert.notEqual(byId('analysisSource').parentElement.parentElement.id, 'appBoardControls');
  releaseReady();
  await flush(); await flush();
  assert.equal(d.documentElement.lang, 'sl');
  assert.equal(byId('analysisSource').parentElement.parentElement.id, 'appBoardControls');
  assert.equal(byId('appTopLineMoves').textContent, 'Analiziram…');
  dom.window.close();
});
