const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const { JSDOM, VirtualConsole } = require('jsdom');
const base = path.resolve(__dirname, '..');
const baseline = process.env.CHESS_CONTEXT_BASELINE;
const readSource = file => baseline
  ? require('node:child_process').execFileSync('git', ['show', `${baseline}:public/chess/new/${file}`], { cwd: base, encoding: 'utf8' })
  : fs.readFileSync(path.join(base, file), 'utf8');

// The shipped page and host/chat wiring run unchanged. Only external CDB,
// DCC computation and the local worker are deterministic fixture boundaries.
async function boot(t, options = {}) {
  const errors = [], vc = new VirtualConsole();
  vc.on('jsdomError', error => errors.push(error.message));
  const dom = new JSDOM(readSource('index.html'), {
    url: 'https://www.mdlxdcc.org/chess/', runScripts: 'outside-only',
    pretendToBeVisual: true, virtualConsole: vc
  });
  const w = dom.window;
  const archiveReady = new Promise(resolve => w.addEventListener('chess-sim-collections', resolve, { once: true }));
  t.after(async () => {
    // The real boot opens the simulation archive asynchronously. Closing jsdom
    // before its first render would turn its normal completion into a rejection.
    await Promise.race([archiveReady, new Promise(resolve => setTimeout(resolve, 1500))]);
    w.close();
  });
  Object.defineProperty(w.HTMLElement.prototype, 'innerText', {
    get() { return this.textContent; }, set(value) { this.textContent = String(value); }, configurable: true
  });
  await new Promise(resolve => w.addEventListener('load', resolve));
  w.HTMLElement.prototype.scrollTo = w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.AbortController = AbortController;
  w.structuredClone = structuredClone;
  w.indexedDB = new (require('fake-indexeddb').IDBFactory)();
  const lockQueues = new Map();
  Object.defineProperty(w.navigator, 'locks', { value: { request(name, settings, callback) {
    const result = (lockQueues.get(name) || Promise.resolve()).then(callback || settings);
    lockQueues.set(name, result.catch(() => {})); return result;
  } }, configurable: true });
  if (options.initialStudies) w.localStorage.setItem('ChessBest:CURRENT:v2:studies', options.initialStudies);
  w.alert = text => { throw Error(text); }; w.confirm = () => true;
  w.URL.createObjectURL = () => 'blob:fixture'; w.URL.revokeObjectURL = () => {};
  const timeout = w.setTimeout.bind(w);
  w.setTimeout = (fn, ms, ...args) => timeout(fn, ms === 150 ? 1 : ms, ...args);
  let boardOptions, sent, failStudyWrites = false;
  const realStore = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = function (key, value) {
    if (failStudyWrites && key === 'ChessBest:CURRENT:v2:studies') throw new w.DOMException('Fixture full storage', 'QuotaExceededError');
    return realStore.call(this, key, value);
  };
  w.Chessboard = (id, options) => {
    boardOptions = options; let fen = options.position;
    for (let rank = 1; rank <= 8; rank++) for (const file of 'abcdefgh') {
      const square = w.document.createElement('div'); square.className = 'square-' + file + rank;
      w.document.getElementById(id).append(square);
    }
    return { position(value) { if (value) fen = value; return fen; }, resize() {}, orientation() {} };
  };
  function moves(fen, provider) {
    const legal = new w.Chess(fen).moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));
    const preferred = provider === 'CDB' ? 'e2e4' : 'd2d4';
    legal.sort((a, b) => Number(b === preferred) - Number(a === preferred));
    return legal.slice(0, 3).map((move, i) => ({ move, score: (provider === 'CDB' ? 12 : 48) - i,
      scoreType: 'cp', rank: i + 1, ...(provider === 'SF' ? { depth: 11 } : {}) }));
  }
  w.fetch = async (url, requestOptions) => {
    const u = new URL(url, w.location.href);
    if (u.pathname.includes('chess-lab-gemini')) {
      sent = JSON.parse(requestOptions.body);
      return { ok: true, json: async () => ({ ok: true, text: 'Fixture answer.' }) };
    }
    if (options.libraryPGN && /Games\/ChessBest_Top_Picks\.pgn$/.test(u.pathname))
      return { ok: true, text: async () => options.libraryPGN };
    const text = u.searchParams.get('action') === 'queryall'
      ? moves(u.searchParams.get('board'), 'CDB').map(m => `move:${m.move},score:${m.score},rank:${m.rank},note:*`).join('|') : '';
    return { ok: true, text: async () => text, json: async () => ({}) };
  };
  for (const file of [...w.document.querySelectorAll('script[src]')].map(node => node.getAttribute('src').split('?')[0])) {
    if (/jquery-|chessboard-/.test(file)) continue;
    w.eval(readSource(file));
    if (file === 'js/8zc-dcc-core.js') w.ChessDCC.analyze = async ({ fen, moves: candidates }) => ({
      allMoves: candidates, dcc1Move: candidates[0]?.move,
      candidates: candidates.map(m => ({ ...m, data: { ...m, raw: m.score, dccScore: m.score + 1,
        isMdlPick: m === candidates[0], status: 'complete', complete: true, observedPlies: 1, targetPlies: 1, samples: [] } })),
      receipt: { fen, provider: 'CDB', status: 'complete', reason: 'Raw and DCC agree', calls: 0, completed: candidates.length, total: candidates.length }
    });
    if (file === 'js/8zc-sf-provider.js') w.ChessSFProvider.create = () => ({
      destroy() {}, ledger: { rootDepth: 11, rootNodes: 1200, extraNodes: 0 },
      root: async fen => ({ fen, provider: 'SF', source: 'Fixture SF', complete: true, moves: moves(fen, 'SF') }),
      analyzeDCC: async () => null
    });
    if (file === 'js/8zc-utils.js') await w.initAll();
  }
  const el = id => w.document.getElementById(id);
  const until = async (condition, label) => {
    const deadline = Date.now() + 3000;
    while (!condition() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
    assert.ok(condition(), label);
  };
  const ready = () => until(() => /SF local depth/.test(el('analysisSourceStatus').textContent)
    && /CDB/.test(el('allEvalBadges').querySelector('[data-eval-source="DCC"] small')?.textContent || ''), 'independent SF and CDB-based DCC completed');
  el('analysisSource').value = 'sf'; el('analysisSource').dispatchEvent(new w.Event('change'));
  await ready();
  return { w, el, errors, ready, until, drop: (...args) => boardOptions.onDrop(...args),
    failStudyWrites(value) { failStudyWrites = value; },
    ask() { el('geminiQuestion').value = 'Compare sources'; el('geminiForm').dispatchEvent(new w.Event('submit', { cancelable: true })); return sent; } };
}

module.exports = { boot };
if (require.main === module) {
test('SF board retains CDB DCC analysis and evidence in real Study host context', { timeout: 10000 }, async t => {
  const h = await boot(t), context = h.w.ChessLabHost.getContext();
  assert.match(h.el('positionEval').getAttribute('aria-label'), /SF/);
  assert.equal(context.analysis?.receipt.provider, 'CDB', 'Study keeps the actual CDB DCC analysis although board source is SF');
  assert.equal(context.evidence?.payload.fen, context.fen, 'CDB evidence remains available alongside SF display');
  assert.equal(context.analysisSources.CDB.allMoves[0].move, 'e2e4');
  assert.equal(context.analysisSources.SF.allMoves[0].move, 'd2d4');
  assert.equal(context.analysisSources.DCC.receipt.provider, 'CDB');
  assert.equal(context.analysisSources.SF.receipt.fen, context.fen);
  assert.equal(context.analysisSources.SF.receipt.scorePOV, 'root player to move');
  assert.deepEqual(JSON.parse(JSON.stringify(context.analysisSources.SF.receipt.positionHistory)), { startFen: new h.w.Chess().fen(), moves: [] });
  h.el('btnStudy').click();
  const studyButton = text => {
    const button = [...h.w.document.querySelectorAll('.chess-study-dialog button')].find(node => node.textContent === text);
    assert.ok(button, text); return button;
  };
  studyButton('A / B comparison').click();
  studyButton('Pin workspace analysis as A').click();
  const savedA = () => JSON.parse(h.w.localStorage.getItem('ChessBest:CURRENT:v2:studies') || 'null')?.comparison?.A;
  await h.until(() => savedA()?.analysis?.receipt?.provider === 'CDB', 'actual Study pin retains CDB DCC with SF board selected');
  assert.equal(h.el('analysisSource').value, 'sf');
  assert.equal(savedA().fen, context.fen);
  assert.equal(savedA().analysis.receipt.fen, context.fen);
  assert.deepEqual(savedA().analysis.receipt.positionHistory, { startFen: new h.w.Chess().fen(), moves: [] });
  assert.equal(savedA().analysis.receipt.providerPositionContext, 'fen-only');
  assert.equal(h.errors.length, 0, h.errors.join('\n'));
});

test('Gemini receives the independent measured CDB, SF and DCC sources through real send wiring', { timeout: 10000 }, async t => {
  const h = await boot(t), sent = h.ask();
  assert.equal(sent.snapshot.cdbCandidates[0]?.move, 'e2e4', 'CDB candidate is retained with SF selected');
  assert.equal(sent.snapshot.sfCandidates[0]?.move, 'd2d4', 'SF candidate has its own measurement');
  assert.equal(sent.snapshot.dccReceipt.provider, 'CDB');
  assert.equal(sent.snapshot.analysisProvider, 'SF', 'legacy selected-provider fields retain the board source');
  assert.equal(sent.snapshot.analysisCandidates[0]?.move, 'd2d4');
  assert.equal(sent.snapshot.sourceReceipts.SF.fen, sent.snapshot.fen);
  assert.equal(sent.snapshot.sourceReceipts.CDB.provider, 'CDB');
  assert.equal(h.errors.length, 0, h.errors.join('\n'));
});

test('source snapshots stay frozen and a board move cannot reuse the previous position or history', { timeout: 10000 }, async t => {
  const h = await boot(t), original = h.w.ChessLabHost.getContext();
  const originalFen = original.fen;
  original.analysisSources.CDB.allMoves[0].score = 900;
  assert.equal(h.w.ChessLabHost.getContext().analysisSources.CDB.allMoves[0].score, 12, 'caller edits cannot mutate captured measurements');
  h.drop('e2', 'e4');
  const pending = h.w.ChessLabHost.getContext(), asked = h.ask().snapshot;
  assert.notEqual(pending.fen, originalFen);
  assert.equal(pending.analysis, null, 'previous-position DCC is never attached to a new board');
  assert.equal(asked.cdbCandidates.length, 0);
  assert.equal(asked.sfCandidates.length, 0);
  assert.equal(asked.dccCandidates.length, 0);
  await h.ready();
  const current = h.w.ChessLabHost.getContext();
  for (const role of ['CDB', 'SF', 'DCC']) {
    assert.equal(current.analysisSources[role].receipt.fen, current.fen);
    assert.deepEqual(JSON.parse(JSON.stringify(current.analysisSources[role].receipt.positionHistory.moves)), ['e2e4']);
  }
  assert.equal(original.analysisSources.SF.receipt.fen, originalFen, 'returned earlier snapshot stays at its original position');
  assert.equal(h.errors.length, 0, h.errors.join('\n'));
});
}
