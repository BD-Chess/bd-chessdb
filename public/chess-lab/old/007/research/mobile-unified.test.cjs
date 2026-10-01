const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { Chess } = require('../js/chess.min.js');
const base = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(base, 'js/app-mobile.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

async function setup({ phone = false, native = false } = {}) {
  const dom = new JSDOM(html, { url: 'https://example.test/chess-lab/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, d = w.document, byId = id => d.getElementById(id);
  Object.defineProperty(w.navigator, 'userAgent', { value: phone ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1' : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', configurable: true });
  Object.defineProperty(w.navigator, 'language', { value: 'en-US', configurable: true });
  if (native) w.Capacitor = { isNativePlatform: () => true };
  let listener, suggested = null;
  let fen = new Chess().fen();
  let analyses = { CDB: { allMoves: [{ move: 'e2e4', score: 20 }], receipt: { status: 'ready', provider: 'CDB' } } };
  w.ChessLabReady = Promise.resolve();
  w.ChessLabHost = {
    Chess,
    getContext: () => ({ fen, history: [], analysisSources: analyses }),
    getReviewGame: () => ({ cursor: 0, totalPly: 0 }),
    playSuggestedMove: move => { suggested = move; return true; },
    onChange: fn => { listener = fn; return () => {}; }
  };
  w.ChessLabLayout = { openTools() {}, closeTools() {} };
  w.Chessboard = () => ({ position(next) { if (next) fen = next; return fen; }, resize() {} });
  byId('btnViewToggle').setAttribute('aria-pressed', 'false');
  byId('btnViewToggle').addEventListener('click', () => byId('btnViewToggle').setAttribute('aria-pressed', byId('btnViewToggle').getAttribute('aria-pressed') === 'true' ? 'false' : 'true'));
  w.eval(script);
  w.dispatchEvent(new w.Event('load'));
  await flush(); await flush();
  return { dom, w, d, byId, suggested: () => suggested, notify: () => listener?.() };
}

test('desktop keeps normal LAB presentation', async () => {
  const x = await setup();
  assert.equal(x.d.body.classList.contains('app-mobile'), false);
  assert.equal(x.byId('analysisSource').closest('.app-analysis-slot'), null);
  x.dom.window.close();
});

test('phone activates five-view mobile UX inside the same LAB document and namespace', async () => {
  const x = await setup({ phone: true });
  assert.equal(x.d.body.classList.contains('app-mobile'), true);
  assert.equal(x.d.body.dataset.appRuntime, 'phone');
  assert.equal(x.d.body.dataset.appView, 'board', 'fresh phone launch starts on Board');
  assert.equal(x.byId('appTabs').querySelector('[data-app-tab="board"]').getAttribute('aria-current'), 'page');
  assert.equal(x.byId('appTabs').querySelectorAll('[data-app-tab]').length, 5);
  assert.equal(x.d.querySelector('.top-buttons').parentElement.id, 'appBoardControls');
  assert.ok(x.byId('analysisSource').closest('.app-analysis-slot'));
  x.d.querySelector('[data-app-lang="sl"]').click();
  assert.equal(x.d.documentElement.lang, 'sl');
  x.d.querySelector('[data-app-lang="en"]').click();
  assert.equal(x.d.documentElement.lang, 'en');
  x.byId('settingAppTopLine').click();
  assert.equal(x.w.localStorage.getItem('ChessBest:LAB:v2:showTopLine'), '1');
  x.byId('next').click();
  assert.equal(x.suggested(), 'e2e4');
  x.byId('appTabs').querySelector('[data-app-tab="moves"]').click();
  assert.equal(x.d.body.dataset.appView, 'moves');
  x.byId('appTabs').querySelector('[data-app-tab="board"]').click();
  assert.equal(x.d.body.dataset.appView, 'board');
  x.dom.window.close();
});

test('Capacitor native forces the same mobile UX with a desktop-like user agent', async () => {
  const x = await setup({ native: true });
  assert.equal(x.d.body.classList.contains('app-mobile'), true);
  assert.equal(x.d.body.dataset.appRuntime, 'native');
  assert.equal(x.d.body.dataset.appView, 'board', 'fresh native launch starts on Board');
  assert.equal(x.byId('appTabs').querySelector('[data-app-tab="board"]').getAttribute('aria-current'), 'page');
  x.dom.window.close();
});
