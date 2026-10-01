const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let JSDOM;
try { ({ JSDOM } = require('jsdom')); } catch (_) { /* Run with NODE_PATH pointing to the existing QA jsdom install. */ }
const options = { skip: !JSDOM && 'jsdom is needed for browser interaction tests' };
function setup(saved) {
  const dom = new JSDOM('<!doctype html><body><button id="trigger">Study</button></body>', { url: 'https://example.test/chess/new/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, base = path.join(__dirname, '../js');
  for (const file of ['chess.min.js', '8zc-study-core.js', '8zc-study-ui.js']) w.eval(fs.readFileSync(path.join(base, file), 'utf8'));
  if (saved) w.localStorage.setItem('chessLabStudy-v1', saved);
  const main = new w.Chess(), actions = [], ctx = () => ({ fen: main.fen(), startFen: main.header().FEN || w.ChessStudy.START_FEN, history: main.history({ verbose: true }), pgn: main.pgn(), analysis: { receipt: { fen: main.fen(), version: 'test' }, candidates: [{ move: main.moves({ verbose: true })[0]?.from + main.moves({ verbose: true })[0]?.to, raw: 0, dccScore: 2, complete: true }] } });
  const ui = w.ChessStudyUI.create({ mount: w.document.body, getContext: ctx, pause: () => actions.push('pause'), navigate: value => actions.push(value) });
  return { dom, w, main, ui, actions, ctx };
}
function click(w, text) { const b = [...w.document.querySelectorAll('button')].find(n => n.textContent === text); assert.ok(b, text); b.click(); }
test('saved branch editing and preview never navigate the playing board without explicit action', options, () => {
  const { dom, w, main, ui, actions, ctx } = setup();
  main.move('e4'); main.move('e5'); ui.recordPosition(ctx()); main.undo(); main.move('c5'); ui.recordPosition(ctx());
  const fen = main.fen(); ui.open();
  assert.equal(w.document.querySelectorAll('.chess-study-board>span').length, 64);
  click(w, '1… e5'); assert.equal(main.fen(), fen); assert.equal(actions.filter(x => typeof x === 'object').length, 0);
  click(w, 'Open position in workspace');
  const navigate = actions.find(x => typeof x === 'object'); assert.deepEqual(Array.from(navigate.moves), ['e2e4', 'e7e5']);
  const saved = w.localStorage.getItem('chessLabStudy-v1'); ui.destroy(); dom.window.close();
  const restored = setup(saved); assert.match(restored.ui.exportPGN(), /c5/); assert.match(restored.ui.exportPGN(), /e5/); restored.dom.window.close();
});
test('malicious imported annotations render as text, and failed import preserves saved studies', options, () => {
  const { dom, w, ui } = setup();
  ui.importPGN('[Event "<img src=x onerror=alert(1)>"]\n\n1. e4 {<script>window.hacked=true</script>} *'); ui.open();
  assert.equal(w.document.querySelectorAll('img,script').length, 0); assert.equal(w.hacked, undefined);
  const before = ui.exportJSON(); assert.throws(() => ui.importPGN('1. e4 (1. illegal) *'));
  assert.equal(ui.exportJSON(), before); assert.throws(() => ui.importJSON('{bad')); assert.equal(ui.exportJSON(), before);
  dom.window.close();
});
test('A/B evidence and question can be exported, imported and compared after reload', options, () => {
  const { dom, w, ui } = setup(); ui.captureContext(); ui.pin('A'); ui.pin('B'); ui.open('compare');
  const input = w.document.querySelector('.chess-study-body textarea'); input.value = 'Which equal move gives Black fewer safe replies?'; input.dispatchEvent(new w.Event('input'));
  const json = ui.exportJSON(); dom.window.close();
  const restored = setup(); restored.ui.importJSON(json); const ab = restored.ui.getComparison();
  assert.match(ab.question, /equal move/); assert.equal(ab.A.fen, ab.B.fen); assert.equal(ab.A.analysis.candidates[0].raw, 0); restored.dom.window.close();
});
test('deep continuation attaches to existing origin, keeps alternatives, and new game retains study', options, () => {
  const { dom, main, ui, ctx } = setup(); ui.captureContext();
  ui.saveLine({ fen: main.fen(), moves: ['e2e4', 'e7e5'], title: 'Deep A', comment: 'Stockfish depth 20' });
  ui.saveLine({ fen: main.fen(), moves: ['d2d4', 'd7d5'], title: 'Deep B' });
  assert.match(ui.exportPGN(), /Deep%20A/); assert.match(ui.exportPGN(), /d4/);
  ui.newStudy(); ui.recordPosition(ctx());
  assert.equal(JSON.parse(ui.exportJSON()).studies.length, 2);
  dom.window.close();
});
test('corrupt local storage is isolated and preserved as a recovery copy', options, () => {
  const { dom, w, ui } = setup('{broken'); ui.captureContext(); ui.open();
  assert.equal(w.localStorage.getItem('chessLabStudy-v1-recovery'), '{broken');
  assert.equal(JSON.parse(ui.exportJSON()).studies.length, 1); dom.window.close();
});
test('full studies show two explicit steps; cancellation keeps data and confirmation retries once', options, () => {
  const { dom, w, ui } = setup();
  w.alert = () => { throw Error('Native alert must not appear'); };
  w.confirm = () => { throw Error('Native confirm must not appear'); };
  for (let i = 0; i < 20; i++) ui.newStudy();
  ui.pin('A');
  const original = w.localStorage.getItem('chessLabStudy-v1');
  assert.equal(JSON.parse(original).studies.length, 20);
  let loaded = 0;
  assert.throws(() => ui.importPGN('1. d4 d5 *'), error => error.code === 'STUDY_LIMIT');
  ui.showLimitWarning(() => { ui.importPGN('1. d4 d5 *'); loaded++; });
  const overlay = w.document.querySelector('.chess-study-limit-overlay');
  assert.equal(overlay.hidden, false);
  assert.match(overlay.textContent, /up to 20 saved studies/);
  click(w, 'Remove studies');
  assert.match(overlay.textContent, /permanently remove 20/);
  assert.equal(w.localStorage.getItem('chessLabStudy-v1'), original);
  click(w, 'Back');
  click(w, 'Not now');
  assert.equal(overlay.hidden, true);
  assert.equal(w.localStorage.getItem('chessLabStudy-v1'), original);
  assert.equal(loaded, 0);
  ui.showLimitWarning(() => { ui.importPGN('1. d4 d5 *'); loaded++; });
  click(w, 'Remove studies');
  click(w, 'Remove 20 studies');
  assert.equal(overlay.hidden, true);
  assert.equal(loaded, 1);
  const saved = JSON.parse(w.localStorage.getItem('chessLabStudy-v1'));
  assert.equal(saved.studies.length, 1);
  assert.match(ui.exportPGN(), /d4/);
  assert.equal(saved.comparison.A.fen, JSON.parse(original).comparison.A.fen);
  dom.window.close();
});
test('failed or stale storage never erases saved studies', options, () => {
  const { dom, w, ui } = setup();
  for (let i = 0; i < 20; i++) ui.newStudy();
  const original = w.localStorage.getItem('chessLabStudy-v1');
  let retries = 0;
  ui.showLimitWarning(() => retries++);
  click(w, 'Remove studies');
  w.localStorage.setItem('chessLabStudy-v1', original.replace('Study 1', 'Another tab'));
  click(w, 'Remove 20 studies');
  assert.match(w.document.querySelector('.chess-study-limit-dialog').textContent, /changed in another tab/);
  assert.equal(retries, 0);
  assert.equal(JSON.parse(ui.exportJSON()).studies.length, 20);
  click(w, 'OK');
  w.localStorage.setItem('chessLabStudy-v1', original);
  ui.showLimitWarning(() => retries++);
  click(w, 'Remove studies');
  const setItem = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = () => { throw Error('storage unavailable'); };
  click(w, 'Remove 20 studies');
  w.Storage.prototype.setItem = setItem;
  assert.equal(w.localStorage.getItem('chessLabStudy-v1'), original);
  assert.equal(JSON.parse(ui.exportJSON()).studies.length, 20);
  assert.equal(retries, 0);
  dom.window.close();
});
