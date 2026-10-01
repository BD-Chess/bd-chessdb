const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Chess } = require('../js/chess.min.js');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/8zc-utils.js'), 'utf8');
const start = source.indexOf('  async function fetchAnnotations()');
const end = source.indexOf('  /* ------------------------------------------------------------------\n     10. BOARD OVERLAYS', start);
assert(start >= 0 && end > start);
function harness(selected, cdb, sf) {
  const status = { textContent: '' }, button = { innerText: '', style: {} };
  const c = { game: new Chess(), settings: { analysisSource: selected, dccEnabled: false, topN: 5 },
    analysisGeneration: 0, activityEpoch: 0, annotationRequestId: 0,
    showEval: true, simRunning: false, replayRunning: false, playState: { active: false, assistanceLocked: false },
    status, calls: { cdb: 0, sf: 0, annotations: [], bar: [] },
    cachedFetchChessDB: async fen => { c.calls.cdb++; return typeof cdb === 'function' ? cdb(fen) : cdb; },
    runLocalSF: async (fen, options) => { c.calls.sf++; return typeof sf === 'function' ? sf(fen, options) : sf; },
    positionEval: { update: (...args) => c.calls.bar.push(args) },
    annotateMove: (...args) => c.calls.annotations.push(args),
    showAnalysisCandidates() {}, runDCCLookahead: async () => {}, renderDCCView() {},
    latestDCCResults: [], latestDCCReceipt: null, evalRetryTimer: null, clearInterval() {},
    document: { getElementById: id => id === 'analysisSourceStatus' ? status : button },
    console };
  vm.createContext(c); vm.runInContext(source.slice(start, end), c);
  return c;
}
const root = { moves: [{ move: 'e2e4', score: 12 }], complete: true };
const local = { root: { ...root, provider: 'SF' }, analysis: null };
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
