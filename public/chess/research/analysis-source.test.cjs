const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Chess } = require('../js/chess.min.js');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/8zc-utils.js'), 'utf8');
const start = source.indexOf('  async function fetchAnnotations(');
const end = source.indexOf('  /* ------------------------------------------------------------------\n     10. BOARD OVERLAYS', start);
const controlStart = source.indexOf('  function syncSFAnalysisControl()');
const controlEnd = source.indexOf('  function evalTrend(', controlStart);
const clickStart = source.indexOf("  document.getElementById('btnAnalysisDeepen').addEventListener('click'");
const clickEnd = source.indexOf('  if (restoreTopPickCursor !== null)', clickStart);
assert(start >= 0 && end > start && controlStart >= 0 && controlEnd > controlStart && clickStart >= 0 && clickEnd > clickStart);
function harness(selected, cdb, sf) {
  const status = { textContent: '' }, button = { innerText: '', style: {} };
  const deepen = { disabled: false, title: '', attrs: {}, classes: {}, events: {},
    setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(name, fn) { this.events[name] = fn; }, click() { this.events.click(); } };
  deepen.classList = { toggle: (name, value) => { deepen.classes[name] = value; } };
  const depthInput = { value: '15', addEventListener: (_name, fn) => { depthInput.change = fn; } };
  const stored = new Map();
  const c = { depthInput, stored, STORAGE_KEY_SETTINGS: 'settings', localStorage: { setItem: (key, value) => stored.set(key, value) }, game: new Chess(), settings: { analysisSource: selected, dccEnabled: false, topN: 5, sfRootNodes: 24000, sfAnalysisDepth: 15 },
    analysisGeneration: 0, activityEpoch: 0, annotationRequestId: 0,
    sfAnalysisFen: null, sfAnalysisDepth: null, sfWorking: false, offlineEvidence: null, deepAnalysisFen: null,
    localController: null, localProvider: null, activeLookaheadId: 0,
    lastAnalysisResult: null, activeAnalysisProvider: null, activeAnalysisFen: null,
    showEval: true, simRunning: false, replayRunning: false, playState: { active: false, assistanceLocked: false },
    status, deepen, calls: { cdb: 0, sf: 0, sfOptions: [], annotations: [], bar: [], sources: [], dcc: [], dccLookahead: [], pendingCards: [] },
    cachedFetchChessDB: async fen => { c.calls.cdb++; return typeof cdb === 'function' ? cdb(fen) : cdb; },
    runLocalSF: async (fen, options) => { c.calls.sf++; c.calls.sfOptions.push(options); return typeof sf === 'function' ? sf(fen, options) : sf; },
    positionEval: { update: (...args) => c.calls.bar.push(args), updateSource: (...args) => c.calls.sources.push(args),
      markComparisonPending: (...args) => c.calls.pendingCards.push(args),
      updateDCC: (...args) => c.calls.dcc.push(args) },
    uciToSan: (fen, move) => new Chess(fen).move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] })?.san,
    annotateMove: (...args) => c.calls.annotations.push(args),
    showAnalysisCandidates() {}, runDCCLookahead: async (...args) => { c.calls.dccLookahead.push(args); }, renderDCCView() {},
    latestDCCResults: [], latestDCCReceipt: null, evalRetryTimer: null, clearInterval() {},
    document: { getElementById: id => id === 'analysisSourceStatus' ? status : id === 'btnAnalysisDeepen' ? deepen : id === 'settingSFDepth' ? depthInput : button,
      querySelectorAll: () => [] },
    console };
  vm.createContext(c); vm.runInContext(source.slice(controlStart, controlEnd) + source.slice(start, end), c);
  const fetch = c.fetchAnnotations;
  c.fetchAnnotations = () => (c.pendingFetch = fetch());
  vm.runInContext(source.slice(clickStart, clickEnd), c);
  const normalizeStart = source.indexOf('  function normalizeSFDepth(');
  vm.runInContext(source.slice(normalizeStart, source.indexOf('  function saveSettings()', normalizeStart)), c);
  const settingStart = source.indexOf("  document.getElementById('settingSFDepth').addEventListener('change'");
  vm.runInContext(source.slice(settingStart, source.indexOf("  sourceSelect.addEventListener('change'", settingStart)), c);
  return c;
}
const root = { moves: [{ move: 'e2e4', score: 12 }], complete: true };
const local = { root: { ...root, provider: 'SF' }, analysis: null, ledger: { rootDepth: 7, rootNodes: 24024 } };
test('old saved board selections migrate to CDB-first while retaining DCC visibility', () => {
  const start = source.indexOf("  if (settings.analysisSource === 'dcc' || settings.analysisSource === 'all')");
  const end = source.indexOf('  for (const key of', start);
  assert(start >= 0 && end > start);
  for (const old of ['auto', 'cdb', 'sf', 'dcc', 'all', 'unexpected']) {
    const context = { settings: { analysisSource: old, dccEnabled: false } };
    vm.runInNewContext(source.slice(start, end), context);
    assert.equal(context.settings.analysisSource, old === 'sf' ? 'sf' : 'auto');
    assert.equal(context.settings.dccEnabled, old === 'dcc' || old === 'all');
  }
});
test('CDB-first and SF compute three independent cards; selector controls only board annotations and left score', async () => {
  const cdb = { ...root, reason: 'CDB evaluated candidates' };
  const sfResult = { ...local, root: { ...local.root, moves: [{ move: 'd2d4', score: 48 }] } };
  for (const selected of ['auto', 'sf']) {
    const c = harness(selected, cdb, sfResult); await c.fetchAnnotations();
    assert.equal(c.calls.cdb, 1, `${selected}: CDB card calculated`);
    assert.equal(c.calls.sf, 1, `${selected}: SF card calculated`);
    assert.deepEqual(c.calls.sources.map(args => [args[2], args[4]]), [['CDB', 'e4'], ['SF', 'd4']], `${selected}: each independent card keeps its own best move`);
    assert.equal(c.calls.dccLookahead.length, 1, `${selected}: DCC card calculated even with its overlay disabled`);
    assert.equal(c.calls.dccLookahead[0][0][0].move, 'e2e4', `${selected}: DCC uses CDB candidates when available`);
    const boardSource = selected === 'sf' ? 'SF' : 'CDB';
    assert.equal(c.calls.bar.at(-1)[2], boardSource, `${selected}: left bar uses selected board source`);
    assert.equal(c.calls.annotations[0][3], boardSource, `${selected}: board overlays use selected source`);
    assert.equal(c.calls.annotations[0][0], selected === 'sf' ? 'd2d4' : 'e2e4');
  }
});
test('missing CDB falls back to SF while the CDB card remains distinct', async () => {
  const missing = { moves: [], reason: 'CDB no usable database evaluation' };
  const fallback = { ...local, analysis: { candidates: [], receipt: { provider: 'SF' } } };
  for (const selected of ['auto', 'sf']) {
    const c = harness(selected, missing, fallback); await c.fetchAnnotations();
    assert.equal(c.calls.cdb, 1); assert.equal(c.calls.sf, 1);
    assert.equal(c.calls.sources.some(args => args[2] === 'CDB' && !Number.isFinite(args[1])), true, `${selected}: CDB card unavailable`);
    assert.equal(c.calls.sources.some(args => args[2] === 'SF' && args[4] === 'e4'), true, `${selected}: SF card ready`);
    assert.equal(c.calls.dccLookahead.length, 1, `${selected}: DCC uses SF fallback candidates`);
    assert.equal(c.calls.dccLookahead[0][0][0].move, 'e2e4');
    assert.equal(c.calls.bar.at(-1)[2], 'SF', `${selected}: missing CDB activates SF`);
    assert.equal(c.calls.annotations.length, 1);
  }
});
test('SF failure leaves its card unavailable without blocking CDB board or DCC calculation', async () => {
  for (const selected of ['auto', 'sf']) {
    const c = harness(selected, { ...root, reason: 'CDB evaluated candidates' }, async () => { throw Error('local SF worker failed'); });
    await c.fetchAnnotations();
    assert.equal(c.calls.cdb, 1); assert.equal(c.calls.sf, 1);
    assert.equal(c.calls.sources.some(args => args[2] === 'CDB' && args[4] === 'e4'), true);
    assert.equal(c.calls.sources.some(args => args[2] === 'SF' && !Number.isFinite(args[1])), true, `${selected}: no stale SF score`);
    assert.equal(c.calls.dccLookahead.length, 1, `${selected}: DCC still receives CDB candidates`);
    assert.equal(c.calls.bar.at(-1)[2], selected === 'sf' ? 'SF' : 'CDB');
    assert.equal(c.calls.annotations.length, selected === 'sf' ? 0 : 1);
  }
});
test('while SF is still searching, CDB board can render but selected SF board waits for its own reply', async () => {
  for (const selected of ['auto', 'sf']) {
    let finish;
    const c = harness(selected, { ...root, reason: 'CDB evaluated candidates' }, () => new Promise(resolve => { finish = resolve; }));
    const request = c.fetchAnnotations(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(c.calls.sources.some(args => args[2] === 'CDB' && args[4] === 'e4'), true);
    assert.equal(c.calls.sources.some(args => args[2] === 'SF'), false, 'SF card has no speculative answer');
    assert.equal(c.calls.bar.length, selected === 'auto' ? 1 : 0, `${selected} bar follows the selected provider`);
    assert.equal(c.calls.annotations.length, selected === 'auto' ? 1 : 0, `${selected} overlays follow the selected provider`);
    finish(local); await request;
    assert.equal(c.calls.sources.some(args => args[2] === 'SF' && args[4] === 'e4'), true);
    assert.equal(c.calls.dccLookahead.length, 1);
  }
});
test('a completed CDB-based DCC card never repaints an SF board move as CDB', async () => {
  const c = harness('sf', { ...root, reason: 'CDB evaluated candidates' }, local);
  const overlay = { title: 'SF 48 cp · raw #1', dataset: { move: 'e2e4' }, children: [],
    classList: { remove() {}, add() {} }, querySelectorAll: () => [], appendChild(node) { this.children.push(node); } };
  c.settings.dccEnabled = true;
  c.document.querySelector = selector => selector === '.square-e4' ? { querySelector: () => overlay } : null;
  c.document.createElement = () => ({ className: '', textContent: '', title: '' });
  c.document.getElementById = id => id === 'dccProgress' ? null : id === 'analysisSourceStatus' ? c.status : c.deepen;
  c.analyzePosition = async () => ({ candidates: [{ data: { move: 'e2e4', raw: 12, score: 12, arrow: '→', status: 'complete' } }],
    receipt: { fen: c.game.fen(), provider: 'CDB', status: 'complete', completed: 1, total: 1 }, dcc1Move: 'e2e4' });
  c.labListeners = []; c.getLabContext = () => ({}); c.simSession = null; c.dccMoveAnnotations = {};
  c.hasMeasuredDCCChoice = () => true;
  const startDCC = source.indexOf('  async function runDCCLookahead(');
  const endDCC = source.indexOf('  function showDCCInfoPanel(', startDCC);
  assert(startDCC >= 0 && endDCC > startDCC);
  vm.runInContext(source.slice(startDCC, endDCC), c);
  await c.runDCCLookahead(root.moves, c.game.fen());
  assert.equal(c.calls.dcc.at(-1)[2], 'CDB', 'DCC card reports its actual candidate provider');
  assert.equal(overlay.title, 'SF 48 cp · raw #1', 'DCC card cannot relabel an SF board overlay');
  assert.equal(overlay.children.length, 0, 'CDB-based DCC markers do not attach to SF move scores');
});
test('source or position switch discards late CDB and SF results', async () => {
  let release; const pending = new Promise(resolve => { release = resolve; });
  const c = harness('auto', () => pending, local);
  const task = c.fetchAnnotations(); await Promise.resolve();
  c.settings.analysisSource = 'sf'; c.analysisGeneration++;
  release({ ...root, reason: 'CDB evaluated candidates' }); await task;
  assert.equal(c.calls.annotations.length, 0); assert.equal(c.calls.sf, 0);
  let finish; const slow = harness('sf', { ...root, reason: 'CDB evaluated candidates' }, () => new Promise(resolve => { finish = resolve; }));
  const another = slow.fetchAnnotations(); await new Promise(resolve => setImmediate(resolve));
  slow.game.move('e4'); slow.analysisGeneration++; finish(local); await another;
  assert.equal(slow.calls.annotations.length, 0);
});
test('Analysis button deepens SF by two plies in any mode without switching CDB board annotations', async () => {
  const cdb = harness('cdb', { ...root, reason: 'CDB evaluated candidates' }, local);
  await cdb.fetchAnnotations();
  assert.equal(cdb.deepen.disabled, false);
  cdb.deepen.click(); await cdb.pendingFetch;
  assert.equal(cdb.calls.sfOptions[0].depth, 15);
  assert.equal(cdb.calls.sfOptions[1].depth, 17);
  assert.equal(cdb.calls.bar.at(-1)[2], 'CDB');
  assert.equal(cdb.calls.annotations.at(-1)[3], 'CDB');
  const sf = harness('sf', { ...root, reason: 'CDB evaluated candidates' }, local);
  await sf.fetchAnnotations();
  assert.equal(sf.deepen.disabled, false);
  assert.equal(sf.deepen.title, 'Click for deeper analysis');
  sf.deepen.click(); await sf.pendingFetch;
  assert.equal(sf.calls.sfOptions[0].depth, 15);
  assert.equal(sf.calls.sfOptions[0].nodes, undefined);
  assert.equal(sf.calls.sfOptions[1].depth, 17);
  assert.equal(sf.sfAnalysisDepth, 17);
  assert.equal(sf.calls.sources.at(-1)[4], 'e4');
  sf.sfAnalysisDepth = 127;
  sf.deepen.click(); await sf.pendingFetch;
  assert.equal(sf.calls.sfOptions.at(-1).depth, 128);
  sf.game.move('e4'); await sf.fetchAnnotations();
  assert.equal(sf.calls.sfOptions.at(-1).depth, 15, 'a new position uses the saved depth again');
  const all = harness('all', { ...root, reason: 'CDB evaluated candidates' }, local);
  await all.fetchAnnotations();
  assert.deepEqual(all.calls.sources.map(args => [args[2], args[4]]), [['CDB', 'e4'], ['SF', 'e4']]);
  assert.equal(all.deepen.disabled, false);
});
test('Analysis label switches to stop while working and prevents stopped SF replies from repainting', async () => {
  let finish;
  const c = harness('sf', { ...root, reason: 'CDB evaluated candidates' }, () => new Promise(resolve => { finish = resolve; }));
  let aborted = 0, destroyed = 0;
  c.localController = { abort() { aborted++; } };
  c.localProvider = { destroy() { destroyed++; } };
  const pending = c.fetchAnnotations(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.sfWorking, true);
  assert.equal(c.deepen.disabled, false);
  assert.equal(c.deepen.title, 'Click to stop SF analysis');
  assert.equal(c.deepen.attrs['aria-label'], 'Analysis — stop SF');
  assert.equal(c.deepen.classes['is-working'], true);
  const options = c.calls.sfOptions[0];
  options.onInfo('', { depth: 8, completeDepth: 7, nodes: 45000 });
  assert.equal(c.status.textContent, 'SF depth 7 · 45000 nodes…');
  c.deepen.click();
  assert.equal(aborted, 1); assert.equal(destroyed, 1);
  assert.equal(c.sfWorking, false);
  assert.equal(options.cancelled(), true);
  assert.equal(c.deepen.title, 'Click for deeper analysis');
  assert.equal(c.deepen.classes['is-working'], false);
  const stoppedStatus = c.status.textContent;
  const sourceCount = c.calls.sources.length, barCount = c.calls.bar.length;
  options.onInfo('', { depth: 99, nodes: 90000 });
  finish(local); await pending;
  assert.equal(c.status.textContent, stoppedStatus);
  assert.equal(c.calls.annotations.length, 0);
  assert.equal(c.calls.sources.length, sourceCount, 'completed CDB card stays; stopped SF cannot publish');
  assert.equal(c.calls.bar.length, barCount, 'stopped SF cannot repaint the selected board score');
});

test('Deep analysis publishes only rank 1 for the active position without discarding CDB and DCC', () => {
  const c = harness('all', root, local);
  const begin = source.indexOf('  function beginDeepAnalysis()');
  vm.runInContext(source.slice(begin, source.indexOf('  const labHost =', begin)), c);
  const publish = c.beginDeepAnalysis(), fen = c.game.fen();
  assert.equal(c.annotationRequestId, 0, 'Deep SF does not cancel independent CDB and DCC requests');
  const snapshot = { fen, depth: 24, lines: [
    { multipv: 2, depth: 24, score: { type: 'cp', white: 16 }, pv: ['d2d4'] },
    { multipv: 1, depth: 22, score: { type: 'cp', white: 31 }, pv: ['e2e4'] }
  ], limits: { searchMoves: [] } };
  publish(snapshot);
  assert.deepEqual(c.calls.sources.at(-1), [fen, snapshot.lines[1].score, 'SF', 22, 'e4', false, 'deep']);
  snapshot.lines[1].depth = 23; publish(snapshot);
  assert.equal(c.calls.sources.at(-1)[3], 23);
  snapshot.limits.searchMoves = ['e2e4']; publish(snapshot);
  assert.equal(c.calls.sources.at(-1)[5], true);
  const count = c.calls.sources.length;
  c.game.move('e4'); publish(snapshot);
  c.game.undo(); c.analysisGeneration++; publish(snapshot);
  assert.equal(c.calls.sources.length, count, 'leaving and returning to the same FEN cannot revive an old search');
});

test('starting Deep while CDB is pending still fills CDB and DCC cards and retains the deeper SF result', async () => {
  let releaseCDB;
  const waitingCDB = new Promise(resolve => { releaseCDB = resolve; });
  const c = harness('all', () => waitingCDB, async () => {
    const stopped = Error('Deep analysis stopped the previous SF worker'); stopped.name = 'AbortError'; throw stopped;
  });
  const begin = source.indexOf('  function beginDeepAnalysis()');
  vm.runInContext(source.slice(begin, source.indexOf('  const labHost =', begin)), c);
  const previous = c.fetchAnnotations();
  const publishDeep = c.beginDeepAnalysis(); const fen = c.game.fen();
  publishDeep({ fen, lines: [{ multipv: 1, depth: 24, score: { type: 'cp', white: 38 }, pv: ['d2d4'] }] });
  assert.equal(c.calls.sources.at(-1)[2], 'SF');
  releaseCDB({ ...root, reason: 'CDB evaluated candidates' }); await previous;
  assert.equal(c.calls.sources.some(args => args[2] === 'CDB' && args[4] === 'e4'), true,
    'CDB result is not discarded when Deep starts during its request');
  assert.equal(c.calls.dccLookahead.length, 1, 'DCC gets CDB candidates even if the old SF worker aborts');
  const sfCards = c.calls.sources.filter(args => args[2] === 'SF');
  assert.equal(sfCards.length, 1, 'aborted shallow worker does not overwrite Deep SF');
  assert.equal(sfCards[0][3], 24);
  assert.equal(c.calls.bar.at(-1)[2], 'CDB', 'All keeps its chosen board source');
});

test('late shallow SF replies cannot overwrite a deeper pinned search or starve CDB DCC', async () => {
  let releaseShallow;
  const waitingSF = new Promise(resolve => { releaseShallow = resolve; });
  const c = harness('sf', { ...root, reason: 'CDB evaluated candidates' }, () => waitingSF);
  const begin = source.indexOf('  function beginDeepAnalysis()');
  vm.runInContext(source.slice(begin, source.indexOf('  const labHost =', begin)), c);
  const previous = c.fetchAnnotations(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.calls.dccLookahead.length, 1, 'CDB DCC computes while SF is still searching');
  const publishDeep = c.beginDeepAnalysis(); const fen = c.game.fen();
  publishDeep({ fen, lines: [{ multipv: 1, depth: 24, score: { type: 'cp', white: 38 }, pv: ['d2d4'] }] });
  const sfCardCount = c.calls.sources.filter(args => args[2] === 'SF').length;
  const sfBoardCount = c.calls.bar.filter(args => args[2] === 'SF').length;
  releaseShallow(local); await previous;
  assert.equal(c.calls.sources.filter(args => args[2] === 'SF').length, sfCardCount,
    'old shallow SF cannot replace the deep card with a depth 7 result');
  assert.equal(c.calls.bar.filter(args => args[2] === 'SF').length, sfBoardCount,
    'old shallow SF cannot replace the deep SF board score');
  assert.equal(c.calls.sources.filter(args => args[2] === 'SF').at(-1)[3], 24);
  assert.equal(c.calls.dccLookahead.length, 1);
});

test('Deep publisher refuses wrong pinned FEN, switched source, hidden/locked evaluation and superseded requests', () => {
  for (const mutate of [c => c.settings.analysisSource = 'sf', c => c.annotationRequestId++, c => c.activityEpoch++,
    c => c.showEval = false, c => c.playState.assistanceLocked = true, c => c.offlineEvidence = {}, c => c.simRunning = true]) {
    const c = harness('all', root, local), begin = source.indexOf('  function beginDeepAnalysis()');
    vm.runInContext(source.slice(begin, source.indexOf('  const labHost =', begin)), c);
    const publish = c.beginDeepAnalysis(), fen = c.game.fen();
    const snapshot = { fen, lines: [{ multipv: 1, depth: 18, score: { type: 'mate', white: -3 }, pv: ['e2e4'] }] };
    publish({ ...snapshot, fen: fen.replace(' w ', ' b ') });
    assert.equal(c.calls.sources.length, 0);
    publish(snapshot); assert.equal(c.calls.sources.length, 1);
    assert.equal(c.calls.sources[0][1].type, 'mate');
    mutate(c); publish(snapshot); assert.equal(c.calls.sources.length, 1);
  }
});


test('SF depth setting saves, cancels an older search and applies to both board analysis modes', async () => {
  for (const selected of ['sf', 'auto']) {
    const c = harness(selected, { moves: [], reason: 'No CDB evaluation' }, local);
    c.depthInput.value = '12'; c.depthInput.change({ target: c.depthInput });
    await c.pendingFetch;
    assert.equal(c.settings.sfAnalysisDepth, 12);
    assert.equal(JSON.parse(c.stored.get('settings')).sfAnalysisDepth, 12);
    assert.equal(c.calls.sfOptions.at(-1).depth, 12);
  }
  let finish;
  const c = harness('sf', { ...root, reason: 'CDB evaluated candidates' }, () => new Promise(resolve => { finish = resolve; }));
  const old = c.fetchAnnotations(); await new Promise(resolve => setImmediate(resolve)); const finishOld = finish;
  let aborted = false;
  c.localController = { abort() { aborted = true; } };
  c.depthInput.value = '18'; c.depthInput.change({ target: c.depthInput });
  assert.equal(aborted, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.calls.sfOptions.at(-1).depth, 18);
  const beforeOldRelease = c.calls.sources.length;
  finishOld(local); await old;
  assert.equal(c.calls.sources.length, beforeOldRelease, 'old-depth SF results cannot repaint newer CDB card');
  finish(local); await c.pendingFetch;
  assert.equal(c.calls.sources.at(-1)[3], 7, 'report measured depth, never the target');
});

test('depth input normalizes limits and does not interrupt a simulation', () => {
  const c = harness('sf', null, local);
  for (const [input, expected] of [['',11], ['invalid',11], [null,11], [0,1], [-10,1], [500,128], [12.6,13]])
    assert.equal(c.normalizeSFDepth(input), expected);
  c.simRunning = true;
  c.localController = { abort() { assert.fail('review depth must not abort Sim'); } };
  c.depthInput.value = '20'; c.depthInput.change({ target: c.depthInput });
  assert.equal(c.calls.sf, 0); assert.equal(c.settings.sfAnalysisDepth, 20);
  assert.equal(c.settings.sfRootNodes, 24000);
});
