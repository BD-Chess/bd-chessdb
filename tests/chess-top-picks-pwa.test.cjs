const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const base = path.resolve(__dirname, '../public/chess/PWA');
const pgn = fs.readFileSync(path.join(base, 'Games/ChessBest_Top_Picks.pgn'), 'utf8');
const anchor = '1r6/5p2/3p2p1/4p1N1/R4nPP/1P1k4/5R1K/3r4 b - - 8 44';

test('installed PWA opens Top Picks at the curated position and retains the full game on next move', { timeout: 15000 }, async t => {
  const errors = [], virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(fs.readFileSync(path.join(base, 'index.html'), 'utf8'), {
    url: 'https://bd-chess.github.io/bd-chessdb/chess/PWA/', runScripts: 'outside-only',
    pretendToBeVisual: true, virtualConsole
  });
  const w = dom.window;
  t.after(() => w.close());
  Object.defineProperty(w.HTMLElement.prototype, 'innerText', {
    get() { return this.textContent; }, set(value) { this.textContent = String(value); }, configurable: true
  });
  await new Promise(resolve => w.addEventListener('load', resolve));
  w.HTMLElement.prototype.scrollTo = function () {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.Chessboard = (_id, options) => {
    for (let rank = 1; rank <= 8; rank++) for (const file of 'abcdefgh') {
      const square = w.document.createElement('div');
      square.className = 'square-' + file + rank;
      w.document.getElementById(_id).append(square);
    }
    let position = options.position;
    return { position(fen) { if (fen) position = fen; return position; }, resize() {}, orientation() {} };
  };
  w.URL.createObjectURL = () => 'blob:fixture';
  w.URL.revokeObjectURL = () => {};
  w.alert = message => { throw Error(message); };
  w.confirm = () => true;
  w.TextEncoder = TextEncoder;
  w.TextDecoder = TextDecoder;
  w.AbortController = AbortController;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.fetch = async url => {
    const address = new URL(url, w.location.href);
    const text = address.pathname.endsWith('/Games/ChessBest_Top_Picks.pgn') ? pgn : '';
    return { ok: true, text: async () => text, json: async () => ({}) };
  };
  const scripts = [...w.document.querySelectorAll('script[src]')]
    .map(script => script.getAttribute('src').split('?')[0]);
  for (const script of scripts) {
    if (/jquery-|chessboard-/.test(script)) continue;
    if (script === 'pwa.js') continue; // service-worker registration has its own tests
    w.eval(fs.readFileSync(path.join(base, script), 'utf8'));
    if (script === 'js/8zc-utils.js') w.initAll();
  }
  const get = id => w.document.getElementById(id);
  assert.equal(get('popularGamesSelect').selectedOptions[0].textContent, 'ChessBest Top Picks');
  const until = async predicate => {
    const deadline = Date.now() + 4000;
    while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert(predicate(), 'three curated games should finish loading');
  };
  await until(() => get('popularGamesPanel').querySelectorAll('.library-result').length === 3);
  assert.match(get('popularGamesPanel').querySelector('.library-result').textContent, /44\.\.\.f6/);
  get('popularGamesPanel').querySelector('.library-result').click();
  assert.equal(w.ChessLabHost.getContext().fen, anchor);
  assert.match(get('gameTitle').textContent, /Gukesh.*Carlsen/);
  assert.equal(JSON.parse(w.localStorage.getItem('chessPwaLabTopPickCursor-v1')).cursor, 87);
  assert.equal(w.localStorage.getItem('chessLabTopPickCursor-v1'), null);
  get('next').click();
  assert.equal(JSON.parse(w.localStorage.getItem('chessPwaLabTopPickCursor-v1')).cursor, 88);
  assert.equal(w.localStorage.getItem('chessPwaLabGame-v1'), pgn.trim().split(/\n\s*\n(?=\[Event)/)[0]);
  assert.deepEqual(errors, []);
});
