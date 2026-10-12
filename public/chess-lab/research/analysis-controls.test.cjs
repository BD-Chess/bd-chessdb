const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const base = path.resolve(__dirname, '..');
function setup(t, context = w => ({ fen: new w.Chess().fen() }), pause = () => {}) {
  const dom = new JSDOM(`<!doctype html>
    <select id="analysisSource"><option value="auto">CDB | SF Lite</option><option value="sf-lite">SF Lite</option><option value="sf-full">SF Full</option><option value="berserk">Berserk</option><option value="sf-berserk">SF &amp; Berserk</option></select>
    <select id="analysisCpuThreads"><option>auto</option><option>1</option><option>2</option><option>4</option><option>6</option><option>8</option></select>
    <small id="analysisCpuStatus"></small><small id="analysisDccModeNote" hidden></small>
    <button id="btnAnalysisDeepen">Deeper SF</button><button id="btnDeepAnalysis">Deep analysis</button>
    <div id="workspaceDisplay"></div>`, { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  t.after(() => dom.window.close());
  w.eval(fs.readFileSync(path.join(base, 'js/chess.min.js'), 'utf8'));
  w.ChessDeepEngine = { validateFen(fen) { if (!new w.Chess().validate_fen(fen).valid) throw Error('Invalid FEN'); } };
  let settings = { analysisMode: 'auto', sfFullThreadsRequested: 'auto' };
  let options, running = false, analyses = 0, stops = 0;
  const saved = [];
  const subscribers = new Set();
  w.ChessAnalysisSession = {
    getSettings: () => ({ ...settings }),
    capabilities: () => ({ mobile: w.innerWidth < 700,
      effectiveSFThreads: settings.sfFullThreadsRequested === 'auto' ? 2 : settings.sfFullThreadsRequested,
      totalThreads: settings.sfFullThreadsRequested === 'auto' ? 3 : Number(settings.sfFullThreadsRequested) + 1 }),
    configure(next) { settings = { ...settings, ...next }; for (const fn of subscribers) fn({ ...settings }); },
    subscribeSettings(fn) { subscribers.add(fn); return () => subscribers.delete(fn); },
    create() { return { analyze(next) { options = next; analyses++; running = true; return new Promise(() => {}); },
      stop() { stops++; running = false; }, isRunning: () => running, destroy() { running = false; } }; }
  };
  w.eval(fs.readFileSync(path.join(base, 'js/8zc-deep-ui.js'), 'utf8'));
  w.eval(fs.readFileSync(path.join(base, 'js/8zc-analysis-controls.js'), 'utf8'));
  const ui = w.ChessDeepUI.create({ Chess: w.Chess, getContext: () => context(w), pause,
    onSaveLine(line) { saved.push(line); return Promise.resolve({ ok: true }); } });
  t.after(() => ui.destroy());
  const el = name => w.document.querySelector('[data-deep="' + name + '"]');
  const change = select => select.dispatchEvent(new w.Event('change', { bubbles: true }));
  return { w, ui, el, change, saved, getOptions: () => options, getSettings: () => settings,
    analyses: () => analyses, stops: () => stops };
}

test('five modes and CPU requests synchronize without loading engines; dual PVs retain child provenance', t => {
  const x = setup(t, w => ({ fen: new w.Chess().fen() }));
  const { w, el, change } = x;
  const topMode = w.document.getElementById('analysisSource');
  const topThreads = w.document.getElementById('analysisCpuThreads');
  const seen = [];
  topMode.addEventListener('change', event => seen.push({ mode: topMode.value, handled: !!event.chessAnalysisHandled }));
  assert.equal(topMode.value, 'auto');
  assert.equal(el('mode').value, 'auto');
  assert.equal(el('threads').disabled, true);
  for (const mode of ['sf-lite', 'sf-full', 'berserk', 'sf-berserk', 'auto']) {
    el('mode').value = mode; change(el('mode'));
    assert.equal(topMode.value, mode);
    assert.equal(x.getSettings().analysisMode, mode);
    assert.equal(seen.at(-1).handled, true, 'Deep changes notify board cancellation as an already configured change');
  }
  assert.equal(x.analyses(), 0, 'selection stays idle');
  topMode.value = 'sf-berserk'; change(topMode);
  assert.equal(el('mode').value, 'sf-berserk');
  assert.equal(el('threads').disabled, false);
  assert.match(w.document.getElementById('btnAnalysisDeepen').textContent, /SF & Berserk/);
  assert.equal(w.document.getElementById('analysisDccModeNote').hidden, false);
  el('threads').value = '4'; change(el('threads'));
  assert.equal(topThreads.value, '4');
  assert.equal(x.getSettings().sfFullThreadsRequested, 4);
  assert.match(w.document.getElementById('analysisCpuStatus').textContent, /SF 4 \+ Berserk 1 · 5 threads/);
  assert.equal(el('budget').disabled, true);
  assert.equal(el('budget').hidden, true);
  assert.equal(el('dual-time').textContent, '6 s each');
  assert.match(el('budget-note').textContent, /each receive up to 6 seconds.*depths can differ/i);
  assert.equal(seen.at(-1).handled, true, 'CPU changes invalidate old board work');
  x.ui.start();
  assert.equal(x.getOptions().movetime, 6000);
  assert.equal(x.getOptions().depth, undefined, 'dual search requests timed budgets, not hidden depth 14');
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
  assert.equal(el('lines').children.length, 0, 'settings switch invalidates displayed engine results');
  Object.defineProperty(w, 'innerWidth', { configurable: true, value: 390 });
  w.ChessAnalysisControls.refresh();
  assert.equal(el('dual-time').textContent, '3 s each');
  x.ui.start();
  assert.equal(x.getOptions().movetime, 3000);
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
