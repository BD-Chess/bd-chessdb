const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const waitFor = async (read, label) => {
  const end = Date.now() + 4000;
  while (Date.now() < end) { const value = read(); if (value) return value; await new Promise(r => setTimeout(r, 10)); }
  throw new Error('Timed out: ' + label);
};

for (const channel of ['CURRENT', 'LAB']) test(`${channel}: DCC click modes preserve details, legal play, clocks and session ownership`, { timeout: 20000 }, async t => {
  const base = path.resolve(__dirname, channel === 'LAB' ? '..' : '../..');
  const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
  const errors = [], vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, { url: `https://www.mdlxdcc.org/chess/${channel === 'LAB' ? 'new/' : ''}`, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window; t.after(() => w.close());
  await new Promise(resolve => w.addEventListener('load', resolve));
  Object.defineProperty(w.HTMLElement.prototype, 'innerText', { get() { return this.textContent; }, set(v) { this.textContent = String(v); }, configurable: true });
  w.HTMLElement.prototype.scrollIntoView = w.HTMLElement.prototype.scrollTo = function () {};
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.URL.createObjectURL = () => 'blob:fixture'; w.URL.revokeObjectURL = () => {};
  const realSetTimeout = w.setTimeout.bind(w);
  w.setTimeout = (fn, ms, ...args) => realSetTimeout(fn, ms === 150 ? 1 : ms, ...args);
  w.AbortController = AbortController; w.alert = msg => { throw new Error(msg); }; w.confirm = () => true;
  let fen, boardOptions;
  w.Chessboard = (id, options) => {
    boardOptions = options; fen = options.position;
    for (const file of 'abcdefgh') for (let rank = 1; rank <= 8; rank++) {
      const node = w.document.createElement('div'); node.className = `square-${file}${rank}`; w.document.getElementById(id).append(node);
    }
    return { position(value) { if (value) fen = value; return fen; }, resize() {}, orientation() {} };
  };
  const key = channel === 'LAB' ? 'chessLabSettings-v8' : 'chessNewSettings-v7';
  w.localStorage.setItem(key, JSON.stringify({ dccDepth: 1, dccTopCandidates: 3, dccDefenseCheck: false, badgeInitialDelay: 0, nextDot: false, simSpeed: 1000 }));
  w.fetch = async url => {
    const u = new URL(url, w.location.href); let text = '';
    if (u.searchParams.has('board')) {
      const board = new w.Chess(u.searchParams.get('board'));
      const preferred = ['d2d4', 'e2e4', 'c2c4', 'e7e6', 'e7e5', 'a7a8n'];
      const moves = board.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));
      moves.sort((a, b) => (preferred.indexOf(a) < 0 ? 99 : preferred.indexOf(a)) - (preferred.indexOf(b) < 0 ? 99 : preferred.indexOf(b)));
      if (u.searchParams.get('action') === 'queryall') text = moves.map(move => `move:${move},score:0,rank:1,note:*`).join('|');
      if (u.searchParams.get('action') === 'querypv') text = `score:0,depth:1,pv:${moves[0] || ''}`;
      if (u.searchParams.get('action') === 'queryscore') text = 'eval:0';
    }
    return { ok: true, text: async () => text, json: async () => ({}) };
  };
  for (const match of html.matchAll(/<script src="(js\/[^?\"]+)/g)) {
    const file = match[1];
    if (/jquery|chessboard|8zc-new-ui|8zc-lab-layout/.test(file)) continue;
    w.eval(fs.readFileSync(path.join(base, file), 'utf8'));
  }
  w.initAll();
  const el = id => w.document.getElementById(id);
  const mode = value => { el('settingDccClickAction').value = value; el('settingDccClickAction').dispatchEvent(new w.Event('change')); };
  const candidate = move => waitFor(() => el('dccAnalysisPanel').querySelector(`.dcc-candidate-button[data-move="${move}"]`), move).catch(error => { throw new Error(`${error.message}; panel=${el('dccAnalysisPanel').textContent}; errors=${errors.join(';')}`); });
  const showDCC = () => { if (el('btnViewToggle').textContent === 'DCC') el('btnViewToggle').click(); };
  const info = el('dccInfoPanel'), start = new w.Chess().fen();
  const reset = () => { el('btnNew').click(); showDCC(); };
  const loadFen = value => { w.prompt = () => value; el('btnInput').click(); showDCC(); };
  showDCC(); assert.equal(el('settingDccClickAction').value, 'hybrid');
  (await candidate('d2d4')).click();
  const expected = new w.Chess(); expected.move('d4');
  assert.equal(fen, expected.fen()); assert.equal(info.style.display, 'block'); assert.equal(info.dataset.fen, start);
  assert.match(info.textContent, /position before this move/); assert.match(el('moves').textContent, /d4/);
  const timingKey = channel === 'LAB' ? 'chessLabTiming-v1' : 'chessNewTiming-v1';
  assert.equal(JSON.parse(w.localStorage.getItem(timingKey)).records[0].move, 'd2d4');

  reset(); mode('details'); (await candidate('d2d4')).click();
  assert.equal(fen, start); assert.equal(info.style.display, 'block'); assert.equal(info.dataset.fen, start);
  assert.equal(JSON.parse(w.localStorage.getItem(key)).dccClickAction, 'details');
  mode('play'); (await candidate('d2d4')).click();
  assert.equal(fen, expected.fen()); assert.equal(info.style.display, 'none');
  reset(); const stale = await candidate('d2d4');
  const other = new w.Chess(); other.move('c4'); other.move('e6'); loadFen(other.fen());
  stale.click(); assert.equal(fen, other.fen(), 'a still-legal move from an old FEN must not apply');

  mode('hybrid'); loadFen('7k/P7/8/8/8/8/8/7K w - - 0 1');
  (await candidate('a7a8n')).click(); assert.equal(new w.Chess(fen).get('a8').type, 'n');
  assert.equal(info.style.display, 'block');

  // A click during automatic Sim pauses before applying one manual move; late work cannot commit.
  reset(); el('btnSim').click(); el('simLocalSpeed').value = '1000'; el('simStartBtn').click(); showDCC();
  await candidate('d2d4'); mode('details'); (await candidate('d2d4')).click();
  assert.equal(el('btnSim').textContent, 'Pause', 'details-only remains observational');
  mode('hybrid'); (await candidate('d2d4')).click();
  assert.equal(fen, expected.fen()); assert.equal(el('btnSim').textContent, 'Sim');
  await new Promise(r => setTimeout(r, 1200)); assert.equal(fen, expected.fen(), 'queued automatic move was cancelled');
  assert.equal(info.style.display, 'block');

  // SimB accepts a manually chosen DCC move on the human turn, then retains its explanation.
  reset(); el('btnSimB').click();
  const localBot = w.document.querySelector('input[value=dccbot]'); localBot.checked = true; localBot.dispatchEvent(new w.Event('change'));
  el('simStartBtn').click(); showDCC(); (await candidate('d2d4')).click();
  await waitFor(() => new w.Chess(fen).turn() === 'w', 'black engine reply');
  assert.match(el('moves').textContent, /d4/); assert.equal(info.style.display, 'block'); assert.equal(info.dataset.fen, start);
  el('btnNew').click(); assert.equal(info.style.display, 'none'); assert.equal(fen, start);
  assert.equal(boardOptions.onDrop('c2', 'c4'), undefined, 'drag behavior remains unchanged');
  assert.equal(boardOptions.onDrop('c4', 'c7'), 'snapback', 'illegal drag remains blocked');
  assert.deepEqual(errors, []);
});
