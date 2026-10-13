const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const base = path.resolve(__dirname, '..');
function setup(t, context = w => ({ fen: new w.Chess().fen() }), pause = () => {}) {
  const dom = new JSDOM(`<!doctype html>
    <select id="analysisSource"><option value="cdb">CDB</option><option value="sf-lite">SF Lite</option><option value="sf-full">SF Full</option><option value="berserk">Berserk</option><option value="reckless">Reckless</option><option value="lc0">LCZero</option></select>
    <select id="analysisCpuThreads"><option>auto</option><option>1</option><option>2</option><option>4</option><option>6</option><option>8</option></select>
    <input type="checkbox" id="analysisSFFull"><select id="settingSFEngine"><option value="sf-lite">Lite</option><option value="sf-full">Full</option></select>
    <small id="analysisCpuStatus"></small><small id="analysisDccModeNote" hidden></small>
    <button id="btnAnalysisDeepen">Deeper SF</button><button id="btnDeepAnalysis">Deep analysis</button>
    <div id="workspaceDisplay"></div>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  t.after(() => dom.window.close());
  w.eval(fs.readFileSync(path.join(base, 'js/chess.min.js'), 'utf8'));
  w.ChessDeepEngine = { validateFen(fen) { if (!new w.Chess().validate_fen(fen).valid) throw Error('Invalid FEN'); } };
  let settings = { boardSource:'cdb', analysisMode:'sf-lite', sfCardMode:'sf-lite', sfFullThreadsRequested:1 };
  let options, running = false, analyses = 0, stops = 0;
  const saved = [];
  const subscribers = new Set();
  w.ChessAnalysisSession = {
    getSettings: () => ({ ...settings }),
    capabilities: () => ({ mobile: w.innerWidth < 700, isolated:true, maxSFThreads:w.innerWidth<700?2:8,
      effectiveSFThreads: settings.sfFullThreadsRequested === 'auto' ? 2 : settings.sfFullThreadsRequested,
      totalThreads: settings.sfFullThreadsRequested === 'auto' ? 3 : Number(settings.sfFullThreadsRequested) + 1 }),
    configure(next) { settings = { ...settings, ...next }; for (const fn of subscribers) fn({ ...settings }); },
    subscribeSettings(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
    create() { return { analyze(next) { options = next; analyses++; running = true; return new Promise(() => {}); },
      stop() { stops++; running = false; }, isRunning: () => running, destroy() { running = false; } }; }
  };
  w.eval(fs.readFileSync(path.join(base, 'js/8zc-deep-ui.js'), 'utf8'));
  w.eval(fs.readFileSync(path.join(base, 'js/8zc-engine-registry.js'), 'utf8'));
  w.eval(fs.readFileSync(path.join(base, 'js/8zc-analysis-controls.js'), 'utf8'));
  const ui = w.ChessDeepUI.create({ Chess: w.Chess, getContext: () => context(w), pause,
    onSaveLine(line) { saved.push(line); return Promise.resolve({ ok: true }); } });
  t.after(() => ui.destroy());
  const el = name => w.document.querySelector('[data-deep="' + name + '"]');
  const change = select => select.dispatchEvent(new w.Event('change', { bubbles: true }));
  return { w, ui, el, change, saved, getOptions: () => options, getSettings: () => settings,
    analyses: () => analyses, stops: () => stops };
}

test('board source and independent analysis mode stay separate; CPU requests synchronize and dual PVs retain child provenance', t => {
  const x = setup(t, w => ({ fen: new w.Chess().fen() }));
  const { w, el, change } = x;
  const topMode = w.document.getElementById('analysisSource');
  const topThreads = w.document.getElementById('analysisCpuThreads');
  const seen = [];
  topMode.addEventListener('change', event => seen.push({ mode: topMode.value, handled: !!event.chessAnalysisHandled }));
  assert.equal(topMode.value, 'cdb');
  assert.equal(el('mode').value, 'sf-lite');
  assert.equal(topThreads.value,'none');
  assert.equal(w.document.getElementById('btnAnalysisDeepen').textContent,'Refresh evals');
  assert.equal(el('threads').disabled, true);
  for (const mode of ['sf-lite', 'sf-full', 'berserk', 'sf-berserk']) {
    el('mode').value = mode; change(el('mode'));
    assert.equal(topMode.value, 'cdb');
    assert.equal(x.getSettings().analysisMode, mode);
    assert.equal(seen.length,0,'Deep changes do not change or invalidate board source');
  }
  assert.equal(x.analyses(), 0, 'selection stays idle');
  el('mode').value='sf-berserk';change(el('mode'));
  topMode.value='sf-full';change(topMode);
  assert.equal(x.getSettings().boardSource,'sf-full');
  assert.equal(el('mode').value, 'sf-berserk');
  assert.equal(el('threads').disabled, false);
  assert.equal(w.document.getElementById('btnAnalysisDeepen').textContent, 'Deeper search');
  assert.equal(w.document.getElementById('analysisDccModeNote').hidden, true);
  el('threads').value = '4'; change(el('threads'));
  assert.equal(topThreads.value, '4');
  assert.equal(x.getSettings().sfFullThreadsRequested, 4);
  assert.equal(topThreads.selectedOptions[0].textContent,'CPU 4');
  assert.equal(w.ChessEngineRegistry.supported('sf-berserk'), false, 'the combined mode is not a separate registry engine');
  assert.equal(el('threads').disabled, false, 'dual SF threads remain configurable with the registry loaded');
  assert.equal(el('budget').disabled, false);
  assert.equal(el('budget').hidden, false);
  assert.equal(el('dual-time').hidden, true);
  assert.match(el('budget-note').textContent, /each engine.*selected time and depth.*depths can differ/i);
  el('time').value = '30000'; change(el('time'));
  assert.equal(seen.length,1,'CPU selection stays idle and does not change board source');
  x.ui.start();
  assert.equal(x.getOptions().movetime, 30000);
  assert.equal(x.getOptions().depth, undefined, 'selected time removes the old depth cap until depth is explicitly selected again');
  const fen = new w.Chess().fen();
  const line = { multipv: 1, depth: 12, score: { type: 'cp', white: 27 }, pv: ['e2e4', 'e7e5'] };
  const snapshot = { mode: 'sf-berserk', fen, lines: [], children: {
    'sf-full': { fen, engine: { name: 'Stockfish 19 Full', version: '19.0.1' }, jobId: 'sf-job',
      status: 'searching', threadsEffective: 4, depth: 12, nodes: 1234, elapsedMs: 1000,
      lines: [line], completeMultiPV: true, linesDepth: 12 },
    berserk: { fen, engine: { name: 'Berserk 14', network: 'berserk.nn' }, jobId: 'berserk-job',
      status: 'failed', error: 'load failed', threadsEffective: 1, lines: [], elapsedMs: 300 }
  } };
  x.getOptions().onInfo(null, snapshot);
  const cards = w.document.querySelectorAll('.deep-engine-card');
  assert.equal(cards.length, 2);
  assert.match(cards[0].textContent, /Stockfish 19 Full.*searching.*4 search threads/s);
  assert.match(cards[1].textContent, /Berserk 14.*failed.*load failed/s);
  assert.doesNotMatch(el('status').textContent, /dual complete/i);
  cards[0].querySelector('.deep-pv button').click();
  assert.equal(el('preview').hidden, false);
  el('save').click();
  assert.equal(x.saved[0].source, 'Stockfish 19 Full');
  assert.equal(x.saved[0].jobId, 'sf-job');
  assert.equal(x.saved[0].threadsEffective, 4);
  assert.equal(x.saved[0].engine.version, '19.0.1');
  assert.equal(x.ui.getResult().children['sf-full'].jobId, 'sf-job');
  el('threads').value = '2'; change(el('threads'));
  assert.ok(x.stops() > 0);
  assert.equal(el('lines').children.length,2,'settings switch retains actual engine results');
  assert.equal(x.ui.getResult().children['sf-full'].jobId,'sf-job');
  Object.defineProperty(w, 'innerWidth', { configurable: true, value: 390 });
  w.ChessAnalysisControls.refresh();
  assert.equal(el('dual-time').hidden, true);
  el('budget').value = 'depth:22'; change(el('budget'));
  x.ui.start();
  assert.equal(x.getOptions().movetime, 30000, 'mobile respects the explicit saved Deep time');
  assert.equal(x.getOptions().depth, 22, 'an explicit later depth applies alongside the selected time');
});

test('SF checkbox is bidirectional only within the board SF family, and all selection stays idle',t=>{
  const x=setup(t),{w,el,change}=x;
  const board=w.document.getElementById('analysisSource'),toggle=w.document.getElementById('analysisSFFull');
  const events=[];board.addEventListener('change',e=>events.push(!!e.chessAnalysisPassive));
  toggle.checked=true;change(toggle);
  assert.equal(board.value,'cdb');assert.equal(x.getSettings().sfCardMode,'sf-full');
  assert.equal(el('mode').value,'sf-full');assert.equal(events.length,0);
  board.value='sf-lite';change(board);assert.equal(toggle.checked,false);
  toggle.checked=true;change(toggle);
  assert.equal(board.value,'sf-full');assert.equal(events.at(-1),true);
  board.value='berserk';change(board);toggle.checked=false;change(toggle);
  assert.equal(board.value,'berserk');assert.equal(x.getSettings().sfCardMode,'sf-lite');
  board.value='sf-lite';change(board);el('mode').value='sf-full';change(el('mode'));
  assert.equal(board.value,'sf-lite','Deep SF selection cannot change Board source');assert.equal(toggle.checked,true);
  assert.equal(x.analyses(),0);assert.equal(el('mode').querySelector('option[value="cdb"]'),null);
});

test('CDB preserves the CPU request, and a non-isolated Full browser offers only CPU 1',t=>{
  const x=setup(t),{w,el,change}=x;
  const board=w.document.getElementById('analysisSource'),cpu=w.document.getElementById('analysisCpuThreads');
  el('mode').value='sf-full';change(el('mode'));el('threads').value='4';change(el('threads'));
  assert.equal(cpu.value,'none');assert.equal(x.getSettings().sfFullThreadsRequested,4);
  board.value='sf-full';change(board);assert.equal(cpu.value,'4');
  board.value='cdb';change(board);assert.equal(cpu.selectedOptions[0].textContent,'CPU —');
  assert.equal(x.getSettings().sfFullThreadsRequested,4);
  w.ChessAnalysisSession.capabilities=()=>({isolated:false,maxSFThreads:1,effectiveSFThreads:1,mobile:false,message:'GitHub Pages · single-thread fallback'});
  board.value='sf-full';change(board);
  assert.deepEqual([...cpu.options].map(o=>o.textContent),['CPU 1']);assert.equal(cpu.disabled,true);
  assert.equal(x.getSettings().sfFullThreadsRequested,4,'effective cap does not overwrite saved request');
  assert.equal(el('threads').querySelector('option[value="auto"]'),null);
});

test('a retained Lite PV saves its original provenance after Full selection',t=>{
  const x=setup(t),{el,change}=x;x.ui.start();
  const fen=new x.w.Chess().fen();
  x.getOptions().onInfo(null,{mode:'sf-lite',fen,engine:{name:'Stockfish 18 Lite'},elapsedMs:20,lines:[{multipv:1,depth:3,score:{type:'cp',white:27},pv:['e2e4']}]});
  el('mode').value='sf-full';change(el('mode'));
  el('lines').querySelector('.deep-pv button').click();el('save').click();
  assert.equal(x.saved[0].analysisMode,'sf-lite');assert.equal(x.saved[0].source,'Stockfish 18 Lite');
  assert.equal(el('export').disabled,false);assert.equal(x.analyses(),1);
});

test('live-game assistance lock prevents a selected heavy engine from starting', t => {
  const x = setup(t, w => ({ fen: new w.Chess().fen(), assistanceLocked: true }));
  const select = x.w.document.getElementById('analysisSource');
  select.value = 'berserk'; x.change(select);
  x.ui.start();
  assert.equal(x.analyses(), 0);
  assert.match(x.el('status').textContent, /unavailable in this live game/);
  assert.equal(x.el('start').disabled, true);
  const y = setup(t, undefined, () => { throw Error('Analysis tools are unavailable in this live game.'); });
  y.ui.start();
  assert.equal(y.analyses(), 0, 'host pause also vetoes engine startup');
  assert.match(y.el('status').textContent, /unavailable in this live game/);
});

test('local NNUE status updates do not cancel an active Deep search', t => {
  const x=setup(t);x.el('mode').value='sf-full';x.change(x.el('mode'));x.ui.open();x.ui.start();
  const stops=x.stops();
  x.w.ChessAnalysisSession.configure({berserkNetworkReady:true,berserkNetworkPersistent:true,berserkNetworkState:'ready'});
  assert.equal(x.stops(),stops,'NNUE status is separate from engine/CPU configuration');
  assert.equal(x.el('start').disabled,true,'the in-progress search stays active');
});


test('upper SF source selector updates the card variant while a running Deep mode remains independent', t=>{
  const x=setup(t),{w,el,change}=x;x.ui.open();x.ui.start();
  assert.equal(x.getSettings().analysisMode,'sf-lite');assert.equal(x.ui.isRunning(),true);
  const source=w.document.getElementById('analysisSource'),toggle=w.document.getElementById('analysisSFFull');
  const stopped=x.stops();source.value='sf-full';change(source);
  assert.equal(x.getSettings().boardSource,'sf-full');assert.equal(x.getSettings().sfCardMode,'sf-full');assert.equal(toggle.checked,true);
  assert.equal(x.getSettings().analysisMode,'sf-lite');assert.equal(el('mode').value,'sf-lite');assert.equal(x.ui.isRunning(),true);assert.equal(x.stops(),stopped);
  for(const mode of ['sf-lite','berserk','cdb']){source.value=mode;change(source);assert.equal(x.getSettings().boardSource,mode);assert.equal(x.getSettings().analysisMode,'sf-lite');assert.equal(x.ui.isRunning(),true);assert.equal(x.stops(),stopped);}
  assert.equal(x.analyses(),1,'display selection neither starts a replacement search nor cancels the current one');
});
