const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Chess } = require('../js/chess.min.js');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/8zc-utils.js'), 'utf8');
const start = source.indexOf('  async function fetchAnnotations()');
const end = source.indexOf('  /* ------------------------------------------------------------------\n     10. BOARD OVERLAYS', start);
const controlStart = source.indexOf('  function syncSFAnalysisControl()');
const controlEnd = source.indexOf('  function evalTrend(', controlStart);
const clickStart = source.indexOf("  document.getElementById('btnAnalysisDeepen').addEventListener('click'");
const clickEnd = source.indexOf("  for (const key of ['CDB', 'SF', 'DCC'])", clickStart);
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
    sfAnalysisFen: null, sfAnalysisDepth: null, sfWorking: false, offlineEvidence: null,
    localController: null, localProvider: null, activeLookaheadId: 0,
    lastAnalysisResult: null, activeAnalysisProvider: null, activeAnalysisFen: null,
    showEval: true, simRunning: false, replayRunning: false, playState: { active: false, assistanceLocked: false },
    status, deepen, calls: { cdb: 0, sf: 0, sfOptions: [], annotations: [], bar: [], sources: [], dcc: [] },
    cachedFetchChessDB: async fen => { c.calls.cdb++; return typeof cdb === 'function' ? cdb(fen) : cdb; },
    runLocalSF: async (fen, options) => { c.calls.sf++; c.calls.sfOptions.push(options); return typeof sf === 'function' ? sf(fen, options) : sf; },
    positionEval: { update: (...args) => c.calls.bar.push(args), updateSource: (...args) => c.calls.sources.push(args),
      updateDCC: (...args) => c.calls.dcc.push(args) },
    uciToSan: (fen, move) => new Chess(fen).move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] })?.san,
    annotateMove: (...args) => c.calls.annotations.push(args),
    showAnalysisCandidates() {}, runDCCLookahead: async () => {}, renderDCCView() {},
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
test('Auto chooses usable CDB and SF only for no-score or provider failure, with distinct reasons', async () => {
  for (const [cdb, expectedSF, reason] of [
    [{ ...root, reason: 'CDB evaluated candidates' }, 0, 'CDB evaluated'],
    [{ moves: [], reason: 'CDB no usable database evaluation' }, 1, 'no usable database'],
    [{ moves: [], reason: 'CDB network/provider unavailable' }, 1, 'network/provider unavailable']]) {
    const c = harness('auto', cdb, local); await c.fetchAnnotations();
    assert.equal(c.calls.cdb, 1); assert.equal(c.calls.sf, expectedSF);
    assert.match(c.status.textContent, new RegExp(reason));
    assert.equal(c.calls.annotations.length, 1);
    assert.equal(c.calls.bar[0][2], expectedSF ? 'SF' : 'CDB');
  }
});
test('explicit CDB never substitutes SF; explicit SF never queries CDB', async () => {
  const missing = harness('cdb', { moves: [], reason: 'CDB network/provider unavailable' }, local);
  await missing.fetchAnnotations(); assert.equal(missing.calls.sf, 0);
  assert.match(missing.status.textContent, /unavailable/);
  const sf = harness('sf', { moves: [], reason: 'bad' }, local);
  await sf.fetchAnnotations(); assert.equal(sf.calls.cdb, 0); assert.equal(sf.calls.sf, 1);
});
test('source or position switch discards late CDB and SF results', async () => {
  let release; const pending = new Promise(resolve => { release = resolve; });
  const c = harness('auto', () => pending, local);
  const task = c.fetchAnnotations(); await Promise.resolve();
  c.settings.analysisSource = 'sf'; c.analysisGeneration++;
  release({ ...root, reason: 'CDB evaluated candidates' }); await task;
  assert.equal(c.calls.annotations.length, 0); assert.equal(c.calls.sf, 0);
  let finish; const slow = harness('sf', null, () => new Promise(resolve => { finish = resolve; }));
  const another = slow.fetchAnnotations(); await Promise.resolve();
  slow.game.move('e4'); slow.analysisGeneration++; finish(local); await another;
  assert.equal(slow.calls.annotations.length, 0);
});
test('Analysis label is disabled for CDB, deepens SF by two plies and preserves source badge SAN', async () => {
  const cdb = harness('cdb', { ...root, reason: 'CDB evaluated candidates' }, local);
  cdb.syncSFAnalysisControl();
  assert.equal(cdb.deepen.disabled, true);
  assert.match(cdb.deepen.title, /Choose SF or All/);
  cdb.deepen.click(); assert.equal(cdb.calls.sf, 0); assert.equal(cdb.calls.cdb, 0);
  const sf = harness('sf', null, local);
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
  const c = harness('sf', null, () => new Promise(resolve => { finish = resolve; }));
  let aborted = 0, destroyed = 0;
  c.localController = { abort() { aborted++; } };
  c.localProvider = { destroy() { destroyed++; } };
  const pending = c.fetchAnnotations();
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
  options.onInfo('', { depth: 99, nodes: 90000 });
  finish(local); await pending;
  assert.equal(c.status.textContent, stoppedStatus);
  assert.equal(c.calls.annotations.length, 0);
  assert.equal(c.calls.sources.length, 0);
  assert.equal(c.calls.bar.length, 0);
});

test('Deep analysis publishes only rank 1 for the active All position and invalidates pending main replies', () => {
  const c = harness('all', root, local);
  const begin = source.indexOf('  function beginDeepAnalysis()');
  vm.runInContext(source.slice(begin, source.indexOf('  const labHost =', begin)), c);
  const publish = c.beginDeepAnalysis(), fen = c.game.fen();
  assert.equal(c.annotationRequestId, 1);
  const snapshot = { fen, depth: 24, lines: [
    { multipv: 2, depth: 24, score: { type: 'cp', white: 16 }, pv: ['d2d4'] },
    { multipv: 1, depth: 22, score: { type: 'cp', white: 31 }, pv: ['e2e4'] }
  ], limits: { searchMoves: [] } };
  publish(snapshot);
  assert.deepEqual(c.calls.sources.at(-1), [fen, snapshot.lines[1].score, 'SF', 22, 'e4', false]);
  snapshot.lines[1].depth = 23; publish(snapshot);
  assert.equal(c.calls.sources.at(-1)[3], 23);
  snapshot.limits.searchMoves = ['e2e4']; publish(snapshot);
  assert.equal(c.calls.sources.at(-1)[5], true);
  const count = c.calls.sources.length;
  c.game.move('e4'); publish(snapshot);
  c.game.undo(); c.analysisGeneration++; publish(snapshot);
  assert.equal(c.calls.sources.length, count, 'leaving and returning to the same FEN cannot revive an old search');
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


test('SF depth setting saves, cancels an older search and applies to SF, All and fallback', async () => {
  for (const selected of ['sf', 'all', 'auto', 'dcc']) {
    const c = harness(selected, { moves: [], reason: 'No CDB evaluation' }, local);
    c.depthInput.value = '12'; c.depthInput.change({ target: c.depthInput });
    await c.pendingFetch;
    assert.equal(c.settings.sfAnalysisDepth, 12);
    assert.equal(JSON.parse(c.stored.get('settings')).sfAnalysisDepth, 12);
    assert.equal(c.calls.sfOptions.at(-1).depth, 12);
  }
  let finish;
  const c = harness('sf', null, () => new Promise(resolve => { finish = resolve; }));
  const old = c.fetchAnnotations(); const finishOld = finish;
  let aborted = false;
  c.localController = { abort() { aborted = true; } };
  c.depthInput.value = '18'; c.depthInput.change({ target: c.depthInput });
  assert.equal(aborted, true);
  assert.equal(c.calls.sfOptions.at(-1).depth, 18);
  finishOld(local); await old;
  assert.equal(c.calls.sources.length, 0, 'old-depth results cannot repaint');
  finish(local); await c.pendingFetch;
  assert.equal(c.calls.sources.at(-1)[3], 7, 'report measured depth, never the target');
});

test('depth input normalizes limits and does not interrupt a simulation', () => {
  const c = harness('sf', null, local);
  for (const [input, expected] of [['',15], ['invalid',15], [null,15], [0,1], [-10,1], [500,128], [12.6,13]])
    assert.equal(c.normalizeSFDepth(input), expected);
  c.simRunning = true;
  c.localController = { abort() { assert.fail('review depth must not abort Sim'); } };
  c.depthInput.value = '20'; c.depthInput.change({ target: c.depthInput });
  assert.equal(c.calls.sf, 0); assert.equal(c.settings.sfAnalysisDepth, 20);
  assert.equal(c.settings.sfRootNodes, 24000);
});
