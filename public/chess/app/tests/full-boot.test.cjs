const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { indexedDB } = require('fake-indexeddb');

const base = path.resolve(__dirname, '..');
test('APP donor boots with isolated storage and the five actual game views', { timeout: 20000 }, async t => {
  const errors = [], vc = new VirtualConsole();
  vc.on('jsdomError', error => errors.push(error.message));
  const w = new JSDOM(fs.readFileSync(path.join(base, 'play.html'), 'utf8'), {
    url: 'https://example.test/chess/app/play.html', runScripts: 'outside-only',
    pretendToBeVisual: true, virtualConsole: vc
  }).window;
  t.after(() => w.close());
  await new Promise(resolve => w.addEventListener('load', resolve));
  const timed = w.setTimeout.bind(w);
  w.setTimeout = (fn, ms, ...args) => ms > 1000 ? 0 : timed(fn, ms, ...args);
  w.setInterval = () => 0;
  Object.defineProperty(w.HTMLElement.prototype, 'innerText', {
    get() { return this.textContent; }, set(value) { this.textContent = String(value); }, configurable: true
  });
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLElement.prototype.scrollTo = function () {};
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.indexedDB = indexedDB;
  let lockTail = Promise.resolve();
  Object.defineProperty(w.navigator, 'locks', { value: { request(_name, options, job) {
    const next = lockTail.then(job || options); lockTail = next.catch(() => {}); return next;
  } } });
  w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
  w.URL.createObjectURL = () => 'blob:fixture'; w.URL.revokeObjectURL = () => {};
  w.alert = message => { throw Error(message); }; w.confirm = () => true;
  let boardFen = '';
  w.Chessboard = (id, options) => {
    const target = w.document.getElementById(id);
    if (id === 'board') {
      for (let r = 1; r <= 8; r++) for (const file of 'abcdefgh') {
        const square = w.document.createElement('div'); square.className = `square-${file}${r}`; target.append(square);
      }
    }
    boardFen = options.position;
    return { position(next) { if (next) boardFen = next; return boardFen; }, resize() {}, orientation() {} };
  };
  w.fetch = async input => {
    const url = new URL(input, w.location.href);
    let text = '';
    if (url.searchParams.get('action') === 'queryall') {
      const chess = new w.Chess(url.searchParams.get('board'));
      text = chess.moves({ verbose: true }).slice(0, 5).map(move =>
        `move:${move.from}${move.to}${move.promotion || ''},score:0,rank:1,note:*`).join('|');
    } else if (url.pathname.startsWith('/chess/app/')) {
      const file = path.resolve(base, '.' + url.pathname.slice('/chess/app'.length));
      if (file.startsWith(base + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) text = fs.readFileSync(file, 'utf8');
    }
    return { ok: true, text: async () => text, json: async () => JSON.parse(text || '{}') };
  };
  const scripts = [...w.document.querySelectorAll('script[src]')]
    .map(node => node.getAttribute('src').split('?')[0]);
  for (const file of scripts) {
    if (/jquery-|chessboard-/.test(file)) continue;
    w.eval(fs.readFileSync(path.join(base, file), 'utf8'));
    if (file === 'js/8zc-sf-provider.js') w.ChessSFProvider.create = () => ({
      prepare: async () => {}, destroy() {},
      root: async fen => ({ fen, provider: 'SF', complete: true, moves: [] }),
      analyzeDCC: async () => ({ candidates: [], receipt: { status: 'partial' } })
    });
    if (file === 'js/8zc-utils.js') await w.initAll();
  }
  const until = async predicate => {
    const deadline = Date.now() + 5000;
    while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
    assert.ok(predicate(), 'APP host did not become ready');
  };
  await until(() => !!w.ChessLabHost && w.document.querySelector('.top-buttons')?.parentElement?.id === 'appBoardControls');
  const byId = id => w.document.getElementById(id);
  assert.equal(w.ChessLabStorage.KEYS.game, 'ChessBest:APP:v1:game');
  assert.equal(byId('board').querySelectorAll('[class^="square-"]').length, 64);
  assert.equal(byId('appTabs').querySelectorAll('[data-app-tab]').length, 5);
  byId('appTabs').querySelector('[data-app-tab="moves"]').click();
  assert.equal(w.document.body.dataset.appView, 'moves');
  byId('appTabs').querySelector('[data-app-tab="review"]').click();
  await until(() => !!byId('gameReviewPanel'));
  assert.equal(byId('gameReviewPanel').hidden, false);
  assert.equal(byId('gameReviewPanel').getAttribute('role'), 'region');
  byId('appTabs').querySelector('[data-app-tab="deep"]').click();
  assert.equal(byId('deepAnalysisPanel').hidden, false);
  byId('appTabs').querySelector('[data-app-tab="dcc"]').click();
  assert.equal(byId('btnViewToggle').getAttribute('aria-pressed'), 'true');
  byId('appTabs').querySelector('[data-app-tab="board"]').click();
  assert.equal(boardFen, w.ChessLabHost.getContext().fen);
  assert.equal(byId('btnViewToggle').getAttribute('aria-pressed'), 'false');
  assert.equal(errors.length, 0, errors.join('\n'));
  // The simulation archive opens asynchronously after the UI has booted.
  await new Promise(resolve => setTimeout(resolve, 1200));
});
