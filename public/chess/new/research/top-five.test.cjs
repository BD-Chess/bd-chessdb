/* Regression: the live initial FEN had one learn=0 score, but 20 learn=1 scores.
   Exercise production retrieval and annotation functions, without network. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Chess } = require('../js/chess.min.js');
const DCC = require('../js/8zc-dcc-core.js');
const source = fs.readFileSync(path.join(__dirname, '../js/8zc-utils.js'), 'utf8');
const definitions = [...source.matchAll(/^ {2}(?:async )?function (\w+)\(/gm)];
const start = new Chess().fen();
// Leading candidates captured from ChessDB on 2026-09-12, in provider order.
const opening = ['e2e4', 'd2d4', 'g1f3', 'b1c3', 'c2c4', 'a2a3'];
const row = (move, score, rank = 1) => `move:${move},score:${score},rank:${rank},note:*`;
const cloud = opening.map((m, i) => row(m, i ? 0 : 1, i ? 1 : 2)).join('|');
const verified = opening.map((m, i) => row(m, i ? '??' : 1, i ? 0 : 2)).join('|');

function context(responses = [verified, cloud]) {
  const calls = [], badges = [];
  const c = {
    Chess, DCC, AbortController, console: { warn() {} },
    settings: { evalMode: 'direct', topN: 5, dccEnabled: true },
    requestPending: new Map(), evalCache: {}, sleep: async () => {},
    setTimeout: () => 1, clearTimeout() {}, clearInterval() {}, persistEvalCache() {},
    fetch: async url => {
      calls.push(url);
      const mode = Number(new URL(url, 'https://example.test').searchParams.get('learn'));
      const text = responses[mode];
      if (text instanceof Error) throw text;
      return { ok: true, text: async () => text };
    },
    game: new Chess(), showEval: true, simRunning: false, replayRunning: false,
    playState: { active: false }, analysisGeneration: 0, evalRetryTimer: 1,
    document: { getElementById: () => ({ style: {} }) },
    annotateMove: (...args) => badges.push(args),
    runDCCLookahead: async (moves, fen) => { c.analysisInput = { moves, fen }; },
    renderDCCView() {}, calls, badges
  };
  vm.createContext(c);
  for (const name of ['fetchChessText', 'cachedFetchChessDB', 'fetchAnnotations']) {
    const i = definitions.findIndex(m => m[1] === name);
    assert.ok(i >= 0);
    vm.runInContext(source.slice(definitions[i].index, definitions[i + 1].index), c);
  }
  return c;
}

test('restores all five opening moves, retaining provider order in zero-score ties', async () => {
  const c = context();
  const { moves } = await c.cachedFetchChessDB(start);
  assert.deepEqual(Array.from(moves.slice(0, 5), m => m.move), opening.slice(0, 5));
  assert.equal(moves.length, 6);
  assert.equal(moves[1].score, 0);
  assert.equal(new Set(moves.map(m => m.move)).size, 6);
});

test('verified measured values override cloud values, unknown values do not', async () => {
  const c = context([verified, cloud.replace('score:1', 'score:30')]);
  const { moves } = await c.cachedFetchChessDB(start);
  assert.equal(moves.find(m => m.move === 'e2e4').score, 1);
  assert.equal(moves.find(m => m.move === 'd2d4').score, 0);
});

test('rejects illegal moves and old unverified-loss sentinels without discarding verified losses', async () => {
  const c = context(['', [row('e2e5', 900), row('d2d4', '??'), row('g1f3', -1000, 0),
    row('b1c3', -1000, 2), row('e2e4', 0)].join('|')]);
  const { moves } = await c.cachedFetchChessDB(start);
  assert.deepEqual(Array.from(moves, m => m.move), ['e2e4', 'b1c3']);
});

test('a failed source keeps the other result available and is retried', async () => {
  for (const failedMode of [0, 1]) {
    const replies = [verified, cloud]; replies[failedMode] = new Error('offline');
    const c = context(replies);
    const first = await c.cachedFetchChessDB(start);
    assert.equal(first.moves.length, failedMode === 0 ? 6 : 1);
    await c.cachedFetchChessDB(start);
    assert.equal(c.calls.length, 3, 'only the failed request is repeated');
  }
});

test('in-flight/cache reuse keeps learn modes and direct/proxy sources separate', async () => {
  const c = context();
  await Promise.all([c.cachedFetchChessDB(start), c.cachedFetchChessDB(start)]);
  assert.equal(c.calls.length, 2);
  assert.equal(Object.keys(c.evalCache).length, 2);
  await c.cachedFetchChessDB(start);
  assert.equal(c.calls.length, 2);
  c.settings.evalMode = 'proxy';
  const { moves } = await c.cachedFetchChessDB(start);
  assert.equal(c.calls.length, 4);
  assert.equal(moves.length, 6);
  assert.ok(c.calls.slice(2).every(url => url.startsWith('/.netlify/functions/queryall?')));
  assert.deepEqual(c.calls.slice(2).map(url => new URL(url, 'https://example.test').searchParams.get('learn')).sort(), ['0', '1']);
});

test('board displays top five while shared DCC receives the full legal candidate list', async () => {
  const c = context();
  await c.fetchAnnotations();
  assert.deepEqual(c.badges.map(b => b[0]), opening.slice(0, 5));
  assert.equal(c.badges.filter(b => b[2]).length, 1);
  assert.equal(c.analysisInput.moves.length, 6);
  assert.equal(c.analysisInput.fen, start);
});
