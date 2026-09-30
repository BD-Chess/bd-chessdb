const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

function setup(t, host = {}) {
  const base = path.resolve(__dirname, '..');
  const dom = new JSDOM('<!doctype html><button id="btnDeepAnalysis">Deep analysis</button><div id="workspaceDisplay" class="workspace-display" aria-label="Moves and DCC analysis"><div id="moves" style="display:none">1. e4</div><div id="dccAnalysisPanel" style="display:block"><button>DCC detail</button></div></div>', { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window; t.after(() => w.close());
  const style = w.document.createElement('style'); style.textContent = fs.readFileSync(path.join(base, 'css/8zc-deep.css'), 'utf8'); w.document.head.append(style);
  w.eval(fs.readFileSync(path.join(base, 'js/chess.min.js'), 'utf8'));
  const game = new w.Chess(); let options, finish, running = false, stops = 0, hostListener = null;
  const analyses = [];
  w.ChessDeepEngine = {
    validateFen(fen) { if (!new w.Chess().validate_fen(fen).valid) throw Error('Invalid FEN'); },
    create() { return {
      isRunning: () => running,
      analyze(opts) { running = true; options = opts; analyses.push(opts); return new Promise(resolve => { finish = result => { running = false; resolve(result); }; }); },
      stop() { stops++; running = false; }, destroy() { running = false; }
    }; }
  };
  w.eval(fs.readFileSync(path.join(base, 'js/8zc-deep-ui.js'), 'utf8'));
  const ui = w.ChessDeepUI.create({ Chess: w.Chess, getContext: () => ({ fen: game.fen() }),
    onChange: listener => { hostListener = listener; return () => { hostListener = null; }; }, pause() {}, ...host });
  const el = name => w.document.querySelector('[data-deep="' + name + '"]');
  const get = id => w.document.getElementById(id);
  const snapshot = () => ({ fen: game.fen(), lines: [{ depth: 12, score: { type: 'cp', white: 25 }, pv: ['e2e4', 'e7e5'] }], nodes: 50000, elapsedMs: 1000, completeMultiPV: true, linesDepth: 12 });
  return { w, ui, game, el, get, snapshot, emit: value => options.onInfo(null, value), finish: value => finish(value),
    stops: () => stops, analyses, change: context => hostListener?.(context) };
}

test('Deep analysis toggles in the workspace and restores DCC visibility, scroll, focus and retained analysis', t => {
  const x = setup(t), { w, ui, game, el, get } = x;
  const workspace = get('workspaceDisplay'), trigger = get('btnDeepAnalysis'), dcc = get('dccAnalysisPanel');
  const originalDCC = dcc.firstElementChild, fen = game.fen(); workspace.scrollTop = 83; trigger.focus();
  trigger.click();
  assert.equal(get('deepAnalysisPanel').parentElement, workspace);
  assert.equal(w.document.querySelector('dialog'), null);
  assert.equal(w.getComputedStyle(dcc).display, 'none');
  assert.equal(dcc.style.display, 'block');
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  el('budget').value = 'depth:22'; el('roots').value = 'e4';
  el('start').click(); x.emit(x.snapshot());
  el('lines').querySelector('button').click();
  assert.equal(game.fen(), fen, 'variation preview leaves the main board pinned');
  assert.equal(el('preview').hidden, false);
  workspace.scrollTop = 124; trigger.click();
  assert.equal(get('deepAnalysisPanel').hidden, true);
  assert.equal(workspace.scrollTop, 83);
  assert.equal(workspace.getAttribute('aria-label'), 'Moves and DCC analysis');
  assert.equal(w.getComputedStyle(dcc).display, 'block');
  assert.equal(get('moves').style.display, 'none');
  assert.equal(dcc.firstElementChild, originalDCC);
  assert.equal(w.document.activeElement, trigger);
  assert.equal(x.stops(), 1);
  trigger.click();
  assert.equal(workspace.scrollTop, 124);
  assert.equal(el('budget').value, 'depth:22');
  assert.equal(el('roots').value, 'e4');
  assert.match(el('lines').textContent, /\+0.25/);
  assert.equal(el('preview').hidden, false);
  el('roots').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(get('deepAnalysisPanel').hidden, true);
  assert.equal(w.document.activeElement, trigger);
  game.move('e4'); trigger.click();
  assert.equal(el('fen').textContent, game.fen());
  assert.equal(el('roots').value, '');
  assert.equal(el('lines').children.length, 0);
  assert.equal(el('preview').hidden, true);
  ui.destroy();
  assert.equal(workspace.classList.contains('is-deep-analysis'), false);
});

test('Deep analysis publishes live and final snapshots, but never a late result after closing', async t => {
  const updates = [], starts = [];
  const x = setup(t, { onSearchStart: opts => { starts.push(opts); return snapshot => updates.push(snapshot); } });
  x.get('btnDeepAnalysis').click(); x.el('start').click();
  x.emit(x.snapshot());
  assert.equal(starts.length, 1); assert.equal(updates.length, 1);
  assert.equal(updates[0].lines[0].depth, 12);
  const done = x.snapshot(); done.lines[0].depth = 18;
  x.finish(done); await new Promise(resolve => setImmediate(resolve));
  assert.equal(updates.at(-1).lines[0].depth, 18);
  x.el('start').click(); x.ui.close();
  const count = updates.length;
  x.emit(done); x.finish(done); await new Promise(resolve => setImmediate(resolve));
  assert.equal(updates.length, count);
});

test('starting analysis reveals its toolbar once within the workspace and keeps later user scrolling', async t => {
  const x = setup(t), workspace = x.get('workspaceDisplay'), panel = x.get('deepAnalysisPanel');
  workspace.style.padding = '8px';
  Object.defineProperty(workspace, 'clientHeight', { value: 500 });
  Object.defineProperty(workspace, 'clientTop', { value: 1 });
  workspace.getBoundingClientRect = () => ({ top: 100 });
  panel.getBoundingClientRect = () => ({ top: 109 - workspace.scrollTop });
  panel.querySelector('.deep-actions').getBoundingClientRect = () => ({ top: 389 - workspace.scrollTop });
  workspace.scrollTop = 72;
  x.get('btnDeepAnalysis').click();
  x.el('roots').value = 'invalid'; x.el('start').click();
  assert.equal(workspace.scrollTop, 0, 'invalid settings stay visible for correction');
  x.el('roots').value = ''; x.el('start').click();
  assert.equal(workspace.scrollTop, 280, 'toolbar is aligned with the workspace padding');
  assert.equal(panel.style.minHeight, '764px', 'short results still have room beneath the toolbar');
  assert.equal(x.w.scrollY, 0, 'the page itself never scrolls');
  workspace.scrollTop = 340;
  x.emit(x.snapshot()); x.finish(x.snapshot()); await new Promise(resolve => setImmediate(resolve));
  assert.equal(workspace.scrollTop, 340, 'live and final results do not steal the user’s scroll');
  x.ui.close();
  assert.equal(workspace.scrollTop, 72, 'the underlying Moves/DCC position is restored');
  x.get('btnDeepAnalysis').click();
  assert.equal(workspace.scrollTop, 340, 'returning to this analysis retains its scroll');
  x.el('start').click();
  assert.equal(workspace.scrollTop, 280, 'a new search reveals the toolbar again');
  x.ui.close(); x.game.move('e4'); x.get('btnDeepAnalysis').click();
  assert.equal(panel.style.minHeight, '', 'a newly pinned position returns to the settings layout');
});

test('closing Deep analysis cancels its worker and ignores late results without changing retained UI', async t => {
  const x = setup(t), { ui, el, get } = x;
  get('btnDeepAnalysis').click(); el('start').click();
  x.emit(x.snapshot()); ui.close();
  const retained = el('lines').textContent, status = el('status').textContent;
  const late = x.snapshot(); late.lines[0].score.white = 999;
  x.emit(late); x.finish(late); await Promise.resolve();
  assert.equal(el('lines').textContent, retained);
  assert.equal(el('status').textContent, status);
  assert.match(status, /stopped; results retained/);
  assert.equal(el('stop').disabled, true);
  assert.equal(el('start').disabled, false);
  ui.destroy();
});

test('W0 Deep save awaits durable outcome, freezes its line and reports pending honestly', async t => {
  let resolve, captured, count = 0;
  const x = setup(t, { onSaveLine: line => { captured = line; count++; return new Promise(r => { resolve = r; }); } });
  x.get('btnDeepAnalysis').click(); x.el('start').click(); x.emit(x.snapshot());
  x.el('lines').querySelector('button').click();
  x.el('save').click(); x.el('save').click(); assert.equal(count, 1); assert.equal(x.el('save').disabled, true);
  assert.equal(captured.pv[0], 'e2e4');
  resolve({ ok: false, code: 'CAPACITY' }); await new Promise(r => setImmediate(r));
  assert.match(x.el('status').textContent, /Save pending/); assert.doesNotMatch(x.el('status').textContent, /Continuation saved/);
  assert.equal(x.el('save').disabled, false);
});


test('Deep search uses fixed depth presets plus Until I stop and reserves exactly three PV rows', t => {
  const x = setup(t);
  const label = x.el('budget').closest('label');
  assert.match(label.textContent, /Search depth/);
  assert.deepEqual([...x.el('budget').options].map(option => option.value),
    ['depth:14','depth:18','depth:22','depth:26','depth:30','depth:34','depth:38','depth:42','infinite']);
  const css = x.w.document.querySelector('style').textContent;
  assert.match(css, /\.deep-pv\{[^}]*height:84px;[^}]*overflow:hidden/s);
  assert.match(css, /\.deep-pv button\{[^}]*height:28px;[^}]*min-height:28px/s);
  assert.match(css, /\.deep-pv\.is-clipped::after\{[^}]*content:"…"/s);
});

test('Deep live-follow repins every new board position, restarts one worker and resumes after Stop on the next move', async t => {
  const states = [];
  const x = setup(t, { onStateChange: state => states.push(state) });
  x.get('btnDeepAnalysis').click();
  x.el('budget').value = 'depth:18';
  x.el('start').click();
  assert.equal(x.analyses.length, 1);
  assert.equal(x.analyses[0].depth, 18);
  assert.equal(x.ui.isOpen(), true);
  assert.equal(x.ui.isRunning(), true);

  x.game.move('e4');
  const afterE4 = x.game.fen();
  x.change({ fen: afterE4, positionHistory: { startFen: new x.w.Chess().fen(), moves: ['e2e4'] } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(x.el('fen').textContent, afterE4);
  assert.equal(x.analyses.length, 2);
  assert.equal(x.analyses[1].fen, afterE4);
  assert.equal(x.analyses[1].depth, 18, 'selected Search depth follows the next move');
  assert.ok(x.stops() >= 1, 'old position search is stopped before following the new FEN');

  x.el('stop').click();
  assert.equal(x.ui.isRunning(), false);
  assert.match(x.el('status').textContent, /next move will analyze automatically/i);

  x.game.move('e5');
  const afterE5 = x.game.fen();
  x.change({ fen: afterE5, positionHistory: { startFen: new x.w.Chess().fen(), moves: ['e2e4','e7e5'] } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(x.analyses.length, 3);
  assert.equal(x.analyses[2].fen, afterE5);
  assert.equal(x.ui.isRunning(), true);
  x.ui.close();
  assert.equal(x.ui.isOpen(), false);
  assert.ok(states.some(state => state.open && state.running));
});

test('Deep SF control stops a running search and deepens a completed finite search by two plies without changing base Search depth', async t => {
  const x = setup(t);
  x.get('btnDeepAnalysis').click();
  x.el('budget').value = 'depth:18';
  x.el('start').click();
  assert.equal(x.ui.deepenOrStop(), true);
  assert.equal(x.ui.isRunning(), false, 'first click stops the running Deep worker');
  // Start again and complete at depth 18.
  x.el('start').click();
  const done = x.snapshot(); done.linesDepth = 18; done.lines[0].depth = 18;
  x.finish(done); await new Promise(resolve => setImmediate(resolve));
  assert.equal(x.ui.isRunning(), false);
  assert.equal(x.ui.deepenOrStop(), true);
  assert.equal(x.analyses.at(-1).depth, 20);
  assert.equal(x.el('budget').value, 'depth:18', 'one-shot deepen does not alter the base Search depth');
});
