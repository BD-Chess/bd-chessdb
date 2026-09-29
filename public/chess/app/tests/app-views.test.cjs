const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const app = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(app, 'play.html'), 'utf8');
const script = fs.readFileSync(path.join(app, 'js/app-mobile.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

test('phone views switch in one tap and retain the shared position', async () => {
  const dom = new JSDOM(html, { url: 'https://example.test/chess/app/play.html', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, d = w.document, byId = id => d.getElementById(id);
  let fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', listener, more = 0, replay = 0, sim = 0;
  const minis = [];
  w.ChessLabReady = Promise.resolve();
  w.ChessLabHost = { getContext: () => ({ fen, history: [] }), onChange: fn => { listener = fn; } };
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
  assert.equal(byId('analysisSource').parentElement.parentElement.id, 'appBoardControls');
  assert.equal(d.querySelector('.top-buttons').parentElement.id, 'appBoardControls');
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
