const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

function setup(t, host = {}, sessionSettings = null) {
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
  if(sessionSettings){
    const settings={...sessionSettings},listeners=new Set();
    w.ChessAnalysisSession={create:w.ChessDeepEngine.create,getSettings:()=>({...settings}),
      subscribeSettings(fn){listeners.add(fn);return()=>listeners.delete(fn);},
      configure(patch){Object.assign(settings,patch);for(const fn of listeners)fn({...settings});}};
  }
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
  assert.equal(workspace.classList.contains('is-deep-analysis'), true);
  assert.equal(dcc.style.display, 'block', 'Deep keeps the underlying DCC inline state untouched');
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
  const scrollCalls = [];
  workspace.scrollTo = options => { scrollCalls.push(options); workspace.scrollTop = options.top; };
  panel.getBoundingClientRect = () => ({ top: 109 - workspace.scrollTop });
  panel.querySelector('.deep-actions').getBoundingClientRect = () => ({ top: 389 - workspace.scrollTop });
  workspace.scrollTop = 72;
  x.get('btnDeepAnalysis').click();
  x.el('roots').value = 'invalid'; x.el('start').click();
  assert.equal(workspace.scrollTop, 0, 'invalid settings stay visible for correction');
  x.el('roots').value = ''; x.el('start').click();
  assert.equal(workspace.scrollTop, 280, 'toolbar is aligned with the workspace padding');
  assert.deepEqual(JSON.parse(JSON.stringify(scrollCalls.at(-1))), { top: 280, behavior: 'instant' }, 'manual Analyze position reveals once without an animation fighting streamed updates');
  assert.equal(panel.style.minHeight, '764px', 'short results still have room beneath the toolbar');
  assert.equal(x.w.scrollY, 0, 'the page itself never scrolls');
  workspace.scrollTop = 340;
  x.emit(x.snapshot()); x.finish(x.snapshot()); await new Promise(resolve => setImmediate(resolve));
  assert.equal(workspace.scrollTop, 340, 'live and final results do not steal the user’s scroll');
  x.ui.close();
  assert.equal(workspace.scrollTop, 72, 'the underlying Moves/DCC position is restored');
  x.get('btnDeepAnalysis').click();
  assert.equal(workspace.scrollTop, 340, 'returning to this analysis retains its scroll');
  panel.style.minHeight='1300px';
  x.el('start').click();
  assert.equal(workspace.scrollTop, 280, 'a new search reveals the toolbar again');
  assert.equal(panel.style.minHeight,'764px','an explicit shorter search releases the old tall result viewport');
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

test('Stop, close and settings cancellation immediately mark active cards stopped and retain completed results',async t=>{
  for(const action of ['stop','close','settings'])for(const pendingStatus of ['loading','ready','queued']){
    const updates=[],finals=[];
    const x=setup(t,{onSearchStart:()=>value=>updates.push(value),onResult:value=>finals.push(value)},{analysisMode:'all'});
    x.ui.start();
    const current={mode:'all',fen:x.game.fen(),status:'running',children:{
      'sf-lite':{...x.snapshot(),status:'searching'},lc0:{fen:x.game.fen(),lines:[],status:pendingStatus},
      reckless:{...x.snapshot(),status:'complete'},berserk:{...x.snapshot(),status:'failed',error:'Unavailable'}}};
    x.emit(current);
    const latest=JSON.parse(JSON.stringify(current));latest.children['sf-lite'].nodes=76543;latest.children['sf-lite'].lines[0].score.white=37;
    x.emit(latest);const published=updates.length,original=JSON.stringify(latest);
    if(action==='stop')x.ui.stop();else if(action==='close')x.ui.close();else x.w.ChessAnalysisSession.configure({analysisMode:'sf-lite'});
    const retained=x.ui.getResult();
    assert.equal(retained.status,'stopped');assert.equal(retained.stopped,true);assert.equal(retained.groupComplete,false);
    assert.equal(retained.children['sf-lite'].status,'stopped');assert.equal(retained.children.lc0.status,'stopped');
    assert.equal(retained.children.reckless.status,'complete');assert.equal(retained.children.berserk.status,'failed');
    assert.equal(retained.children['sf-lite'].nodes,76543);assert.equal(retained.children['sf-lite'].lines[0].score.white,37);
    assert.equal(JSON.stringify(latest),original,'rendered cancellation never mutates a source snapshot');
    const progress=[...x.el('lines').querySelectorAll('.deep-engine-progress')].map(el=>el.textContent);
    assert.match(progress[0],/^stopped/);assert.match(progress[1],/^stopped/);assert.match(progress[2],/^complete/);assert.match(progress[3],/^failed/);
    assert.equal(updates.length,published,'local stop status is not published as engine evidence');assert.equal(finals.length,0);
    x.emit(current);x.finish(current);await Promise.resolve();assert.equal(x.ui.getResult(),retained,'late results cannot revive stopped cards');
    if(action==='close'){x.ui.open();assert.match(x.el('lines').querySelector('.deep-engine-progress').textContent,/^stopped/);}
    x.ui.destroy();
  }
});

test('stopping a fresh run before its first info leaves an earlier completed snapshot intact',async t=>{
  const x=setup(t),completed=x.ui.start();const done=x.snapshot();x.finish(done);await completed;
  x.ui.start();x.ui.stop();assert.equal(x.ui.getResult(),done);assert.equal(done.stopped,undefined);
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


test('Deep search uses fixed depth presets plus Until I stop and reserves exactly two PV rows', t => {
  const x = setup(t);
  const label = x.el('budget').closest('label');
  assert.match(label.textContent, /Search depth/);
  assert.deepEqual([...x.el('budget').options].map(option => option.value),
    ['depth:14','depth:18','depth:22','depth:26','depth:30','depth:34','depth:38','depth:42','infinite']);
  const css = x.w.document.querySelector('style').textContent;
  assert.match(css, /\.deep-pv\{[^}]*height:56px;[^}]*overflow:hidden/s);
  assert.match(css, /\.deep-pv button\{[^}]*height:28px;[^}]*min-height:28px/s);
  assert.match(css, /\.deep-pv\.is-clipped::after\{[^}]*content:"…"/s);
});

test('Deep finite depth follows later positions, while manual Stop disables follow until Analyze position is pressed again', async t => {
  const states = [];
  const x = setup(t, { onStateChange: state => states.push(state) });
  x.get('btnDeepAnalysis').click();
  assert.equal(x.ui.isFollowing(), false, 'opening Deep alone does not enable auto-follow');
  x.el('budget').value = 'depth:18';
  x.el('start').click();
  assert.equal(x.analyses.length, 1);
  assert.equal(x.analyses[0].depth, 18);
  assert.equal(x.ui.isOpen(), true);
  assert.equal(x.ui.isRunning(), true);
  assert.equal(x.ui.isFollowing(), true);

  const workspace = x.get('workspaceDisplay'), panel = x.get('deepAnalysisPanel');
  workspace.scrollTop = 337; panel.style.minHeight = '900px';
  x.game.move('e4');
  const afterE4 = x.game.fen();
  x.change({ fen: afterE4, positionHistory: { startFen: new x.w.Chess().fen(), moves: ['e2e4'] } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(x.el('fen').textContent, afterE4);
  assert.equal(panel.style.minHeight, '900px', 'live repin keeps the established Deep viewport height');
  x.emit(x.snapshot());
  await new Promise(resolve => x.w.requestAnimationFrame(() => resolve()));
  assert.equal(workspace.scrollTop, 337, 'live repin restores the same inner Deep scroll after streamed lines return');
  assert.equal(x.analyses.length, 2);
  assert.equal(x.analyses[1].fen, afterE4);
  assert.equal(x.analyses[1].depth, 18);

  const done = x.snapshot(); done.fen = afterE4; done.linesDepth = 18; done.lines[0].depth = 18;
  x.finish(done); await new Promise(resolve => setImmediate(resolve));
  assert.equal(x.ui.isRunning(), false, 'reaching finite Search depth stops this position');
  assert.equal(x.ui.isFollowing(), true, 'reaching Search depth keeps Deep follow armed for the next position');
  assert.equal(x.el('stop').disabled, false, 'Stop remains available to disarm follow after the position completes');

  x.game.move('e5');
  const afterE5 = x.game.fen();
  x.change({ fen: afterE5, positionHistory: { startFen: new x.w.Chess().fen(), moves: ['e2e4','e7e5'] } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(x.analyses.length, 3, 'next position auto-starts while follow remains armed');
  assert.equal(x.analyses[2].fen, afterE5);
  assert.equal(x.ui.isRunning(), true);

  x.el('stop').click();
  assert.equal(x.ui.isRunning(), false);
  assert.equal(x.ui.isFollowing(), false);
  assert.match(x.el('status').textContent, /press Analyze position to resume Deep analysis/i);

  x.game.move('Nf3');
  const afterNf3 = x.game.fen();
  x.change({ fen: afterNf3, positionHistory: { startFen: new x.w.Chess().fen(), moves: ['e2e4','e7e5','g1f3'] } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(x.el('fen').textContent, afterNf3, 'stopped Deep still follows the displayed FEN');
  assert.equal(x.analyses.length, 3, 'manual Stop prevents auto-start on later positions');
  assert.equal(x.ui.isRunning(), false);
  assert.equal(x.ui.isFollowing(), false);

  x.el('start').click();
  assert.equal(x.analyses.length, 4, 'Analyze position explicitly re-arms Deep follow');
  assert.equal(x.analyses[3].fen, afterNf3);
  assert.equal(x.ui.isFollowing(), true);
  x.ui.close();
  assert.equal(x.ui.isOpen(), false);
  assert.equal(x.ui.isFollowing(), false);
  assert.ok(states.some(state => state.open && state.following));
  assert.ok(states.some(state => state.open && state.following === false));
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


test('streaming telemetry reuses cards and PV buttons, keeps focus and previews the latest score', async t => {
  const x = setup(t);
  let clock = 1000; x.w.Date.now = () => clock;
  x.get('btnDeepAnalysis').click(); x.el('start').click();
  const snapshot = () => ({ ...x.snapshot(), mode: 'all', children: {
    'sf-lite': { ...x.snapshot(), status: 'searching', engine: { name: 'SF Lite' } },
    berserk: { ...x.snapshot(), status: 'searching', engine: { name: 'Berserk' } }
  }});
  const first = snapshot(); x.emit(first);
  const card = x.el('lines').firstElementChild, row = card.querySelector('.deep-line');
  const button = row.querySelector('button'); button.focus();
  const workspace = x.get('workspaceDisplay'); workspace.scrollTop = 750;
  for (let i = 0; i < 10; i++) {
    clock += 101;
    const next = snapshot(); next.children['sf-lite'].lines[0].score.white = 80 + i;
    next.children['sf-lite'].nodes += i; x.emit(next);
  }
  assert.equal(x.el('lines').firstElementChild, card);
  assert.equal(card.querySelector('.deep-line'), row);
  assert.equal(row.querySelector('button'), button, 'unchanged PV buttons remain attached during telemetry');
  assert.equal(x.w.document.activeElement, button, 'keyboard focus survives updates');
  assert.equal(workspace.scrollTop, 750);
  assert.equal(row.querySelector('strong').textContent, '+0.89');
  button.click(); assert.equal(x.el('preview').hidden, false);
  x.ui.close();
});

test('live repin reserves existing height and never replays an old scroll after the reader moves', async t => {
  const x = setup(t), workspace = x.get('workspaceDisplay'), panel = x.get('deepAnalysisPanel');
  let clock = 1000; x.w.Date.now = () => clock;
  x.get('btnDeepAnalysis').click(); x.el('start').click(); x.emit(x.snapshot());
  Object.defineProperty(panel, 'offsetHeight', { value: 1800 });
  workspace.scrollTop = 1200;
  x.game.move('e4'); x.change({ fen: x.game.fen() });
  assert.equal(panel.style.minHeight, '1800px', 'clearing old PVs must not collapse the scroll range');
  assert.equal(workspace.scrollTop, 1200);
  const partial = x.snapshot(); partial.completeMultiPV = false;
  clock += 101; x.emit(partial);
  workspace.scrollTop = 950;
  await new Promise(resolve => x.w.requestAnimationFrame(resolve));
  assert.equal(workspace.scrollTop, 950, 'a queued paint must not undo new user scrolling');
  clock += 101; x.emit(partial);
  assert.equal(workspace.scrollTop, 950, 'incomplete group updates must not pin the reader to the old offset');
  x.ui.close();
});

test('updated PVs preserve other engines and use the new variation on click', t => {
  const x = setup(t); let clock = 1000; x.w.Date.now = () => clock;
  x.get('btnDeepAnalysis').click(); x.el('start').click();
  const snapshot = { ...x.snapshot(), mode: 'all', children: {
    'sf-lite': { ...x.snapshot(), status: 'searching' }, berserk: { ...x.snapshot(), status: 'searching' }
  }};
  x.emit(snapshot);
  const other = x.el('lines').lastElementChild.querySelector('button');
  const first = x.el('lines').firstElementChild.querySelector('button');
  clock += 101; const updated = JSON.parse(JSON.stringify(snapshot));
  updated.children['sf-lite'].lines[0].pv = ['d2d4', 'd7d5']; x.emit(updated);
  assert.equal(x.el('lines').lastElementChild.querySelector('button'), other);
  assert.equal(x.el('lines').firstElementChild.querySelector('button'), first);
  assert.equal(first.textContent, '1. d4'); first.click();
  assert.equal(x.el('preview-text').textContent, '1. d4');
  x.ui.close();
});


test('a queued variation reveal cannot scroll the workspace after Deep closes or changes position', async t => {
  const x = setup(t), workspace = x.get('workspaceDisplay');
  x.w.Chessboard = () => ({ resize() {}, position() {}, destroy() {} });
  workspace.scrollTop = 75;
  x.get('btnDeepAnalysis').click(); x.el('start').click(); x.emit(x.snapshot());
  x.el('preview').getBoundingClientRect = () => ({ top: 900 });
  workspace.getBoundingClientRect = () => ({ top: 100 });
  x.el('lines').querySelector('button').click(); x.ui.close();
  await new Promise(resolve => x.w.requestAnimationFrame(resolve));
  assert.equal(workspace.scrollTop, 75, 'late preview must not scroll the restored Moves/DCC view');
  x.get('btnDeepAnalysis').click(); x.el('start').click(); x.emit(x.snapshot());
  x.el('lines').querySelector('button').click();
  workspace.scrollTop = 420; x.game.move('e4'); x.change({ fen: x.game.fen() });
  await new Promise(resolve => x.w.requestAnimationFrame(resolve));
  assert.equal(workspace.scrollTop, 420, 'late preview must not scroll a new pinned position');
  x.ui.close();
});


test('single Lite watchdog and preparation failures never claim successful completion', async t => {
  const x = setup(t); x.get('btnDeepAnalysis').click();
  for (const failure of [
    { status: 'partial', stopped: false, forcedStop: true, stopReason: 'time-watchdog' },
    { status: 'partial', stopped: false, error: 'sf-lite preparation timed out. Retry analysis.', lines: [] }
  ]) {
    x.el('start').click(); x.finish({ ...x.snapshot(), mode: 'sf-lite', ...failure });
    await new Promise(resolve => setImmediate(resolve));
    assert.doesNotMatch(x.el('status').textContent, /Analysis complete\./);
    assert.match(x.el('status').textContent, failure.error ? /Analysis failed: sf-lite preparation timed out/ : /Stopped after the engine exceeded its time limit/);
  }
  x.ui.close();
});
