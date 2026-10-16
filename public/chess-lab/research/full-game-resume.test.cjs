const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { boot: baseBoot } = require('./source-context-integration.test.cjs');
const boot = (t, options = {}) => baseBoot(t, { skipReady: true, ...options });
const key = 'ChessBest:LAB:v2:game';
const dump = w => Object.fromEntries(Object.keys(w.localStorage).map(k => [k, w.localStorage.getItem(k)]));
const host = h => h.w.ChessLabHost;
const review = h => host(h).getReviewGame();
const fixture = '[Event "Disposable full-game resume regression"]\n[White "A"]\n[Black "B"]\n[Result "*"]\n\n1. e4 {Keep this comment} e5 2. Nf3 *';
async function importPGN(h, pgn) {
  if (host(h).getContext().settings.ioFormat !== 'pgn') h.el('btnFormat').click();
  h.w.prompt = () => pgn;
  await h.el('btnInput').onclick();
}
function check(h, sans, cursor, fen, source) {
  const r = review(h);
  assert.deepEqual(Array.from(r.moves, m => m.san), sans);
  assert.equal(r.totalPly, sans.length);
  assert.equal(r.cursor, cursor);
  assert.equal(host(h).getContext().fen, fen);
  if (source !== undefined) assert.equal(r.sourcePGN, source);
  assert.equal(h.errors.length, 0, h.errors.join('\n'));
}

for (const cursor of [0, 1, 2, 3]) test(`ordinary imported full line restores at cursor ${cursor}`, async t => {
  const h = await boot(t); await importPGN(h, fixture);
  host(h).navigateReview(cursor);
  const fen = host(h).getContext().fen;
  check(h, ['e4', 'e5', 'Nf3'], cursor, fen, fixture);
  const reopened = await boot(t, { initialStorage: dump(h.w) });
  check(reopened, ['e4', 'e5', 'Nf3'], cursor, fen, fixture);
  assert.equal(review(reopened).headers.Event, 'Disposable full-game resume regression');
});

test('manual newest moves persist and read-only navigation retains a changed branch', async t => {
  const h = await boot(t);
  h.drop('e2', 'e4'); h.drop('e7', 'e5'); h.drop('g1', 'f3');
  let reopened = await boot(t, { initialStorage: dump(h.w) });
  check(reopened, ['e4', 'e5', 'Nf3'], 3, host(h).getContext().fen);
  host(h).navigateReview(1); h.drop('c7', 'c5'); h.drop('g1', 'f3');
  const branchFen = host(h).getContext().fen;
  reopened = await boot(t, { initialStorage: dump(h.w) });
  check(reopened, ['e4', 'c5', 'Nf3'], 3, branchFen);
  host(h).navigateReview(0);
  check(h, ['e4', 'c5', 'Nf3'], 0, new h.w.Chess().fen());
  reopened = await boot(t, { initialStorage: dump(h.w) });
  check(reopened, ['e4', 'c5', 'Nf3'], 0, new h.w.Chess().fen());
  h.el('last').click(); check(h, ['e4', 'c5', 'Nf3'], 3, branchFen);
});

test('unchanged annotated source retains variations and black-to-move custom root', async t => {
  const pgn = '[Event "Black-root annotated fixture"]\n[SetUp "1"]\n[FEN "rnbqkbnr/pppppppp/8/8/8/4P3/PPPP1PPP/RNBQKBNR b KQkq - 0 1"]\n[Result "1/2-1/2"]\n\n1... e5 {Black comment} (1... c5) 2. Nf3 Nc6 1/2-1/2';
  const h = await boot(t); await importPGN(h, pgn);
  for (const cursor of [0, 1, 3]) {
    host(h).navigateReview(cursor); const fen = host(h).getContext().fen;
    const reopened = await boot(t, { initialStorage: dump(h.w) });
    check(reopened, ['e5', 'Nf3', 'Nc6'], cursor, fen, pgn);
    assert.equal(review(reopened).headers.SetUp, '1');
    assert.equal(review(reopened).headers.Result, '1/2-1/2');
  }
});

test('non-Top-Pick Library load and navigation leave source/Study records intact', async t => {
  const h = await boot(t, { beforeInit(w) {
    const oldFetch = w.fetch;
    w.fetch = async (url, ...args) => /Games\/CarlsenM_Selected.pgn$/.test(String(url))
      ? { ok: true, text: async () => fixture } : oldFetch(url, ...args);
  } });
  await importPGN(h, fixture);
  const studies = h.w.localStorage.getItem('ChessBest:LAB:v2:studies');
  const select = [...h.el('popularGamesPanel').querySelectorAll('select')].find(s =>
    [...s.options].some(o => o.value === fixture));
  assert(select, 'ordinary Library source loaded');
  select.value = fixture;
  await select.chessLoadSelected();
  host(h).navigateReview(1); const fen = host(h).getContext().fen;
  const record = JSON.parse(h.w.localStorage.getItem(key)); assert.equal(record.topPick, null);
  assert.equal(h.w.localStorage.getItem('ChessBest:LAB:v2:studies'), studies);
  const reopened = await boot(t, { initialStorage: dump(h.w) });
  check(reopened, ['e4', 'e5', 'Nf3'], 1, fen, fixture);
});

test('Top Pick cursor/Review V4 survive; changed branch loses old identity and adjudication', async t => {
  const all = fs.readFileSync(path.join(__dirname, '../Games/ChessBest_Top_Picks.pgn'), 'utf8');
  const pgn = all.split(/(?=\[Event ")/).find(x => x.includes('ChessBestAnchorPly'));
  const h = await boot(t, { libraryPGN: pgn });
  h.el('btnGames').click();
  await h.until(() => h.el('popularGamesPanel').querySelector('.library-result'), 'Top Pick available');
  h.el('popularGamesPanel').querySelector('.library-result').click();
  await h.until(() => review(h).totalPly > 3, 'Top Pick loaded');
  host(h).navigateReview(1); const before = review(h), fen = host(h).getContext().fen;
  assert.equal(JSON.parse(h.w.localStorage.getItem(key)).topPick.cursor, 1);
  const reopened = await boot(t, { initialStorage: dump(h.w) });
  check(reopened, Array.from(before.moves, m => m.san), 1, fen, before.sourcePGN);
  host(h).navigateReview(0);
  const alternative = new h.w.Chess().moves({ verbose: true }).find(m => m.san !== before.moves[0].san);
  h.drop(alternative.from, alternative.to);
  const branch = review(h), record = JSON.parse(h.w.localStorage.getItem(key));
  assert.equal(record.topPick, null);
  assert.doesNotMatch(record.pgn, /\[ChessBest(?:Anchor|Source|Title|Teaser)|\[Termination/);
  assert.equal(branch.lineChanged, true);
  const changed = await boot(t, { initialStorage: dump(h.w) });
  check(changed, [alternative.san], 1, host(h).getContext().fen);
  assert.equal(review(changed).headers.ChessBestSource, undefined);
});

test('legacy plain PGN and envelope without resume load complete sources', async t => {
  for (const record of [fixture, JSON.stringify({ schema: 'chessbest-game/1', pgn: fixture, topPick: null })]) {
    const h = await boot(t, { initialStorage: { [key]: record } });
    assert.equal(review(h).totalPly, 3);
    host(h).navigateReview(1); const fen = host(h).getContext().fen;
    const reopened = await boot(t, { initialStorage: dump(h.w) });
    check(reopened, ['e4', 'e5', 'Nf3'], 1, fen, fixture);
  }
});

test('invalid resume metadata and unsupported/corrupt records preserve original bytes', async t => {
  const h = await boot(t); await importPGN(h, fixture); host(h).navigateReview(1);
  const valid = JSON.parse(h.w.localStorage.getItem(key));
  for (const change of [{ cursor: -1 }, { cursor: 4 }, { cursor: '1' }, { cursor: 1.5 },
    { totalPlies: 2 }, { pgnLength: 1 }, { fen: new h.w.Chess().fen() }]) {
    const raw = JSON.stringify({ ...valid, resume: { ...valid.resume, ...change } });
    const reopened = await boot(t, { initialStorage: { [key]: raw } });
    assert.equal(review(reopened).totalPly, 3);
    assert.equal(h.w.localStorage.getItem(key), JSON.stringify(valid));
    assert.equal(reopened.w.localStorage.getItem(key), raw);
    assert.equal(host(reopened).saveBeforeUpdate(), false);
  }
  for (const raw of ['{bad', '{"schema":"chessbest-game/2","pgn":"1. e4"}', 'not a valid PGN']) {
    const reopened = await boot(t, { initialStorage: { [key]: raw } });
    assert.equal(reopened.w.localStorage.getItem(key), raw);
    assert.equal(host(reopened).saveBeforeUpdate(), false);
  }
});

test('quota refusal at a review cursor leaves the last good full-line/cursor atomic record', async t => {
  const h = await boot(t); await importPGN(h, fixture); host(h).navigateReview(1);
  const durable = h.w.localStorage.getItem(key), write = h.w.Storage.prototype.setItem;
  h.w.Storage.prototype.setItem = function (k, v) {
    if (k === key) throw new h.w.DOMException('fixture full', 'QuotaExceededError');
    return write.call(this, k, v);
  };
  host(h).navigateReview(0);
  assert.equal(h.w.localStorage.getItem(key), durable);
  assert.equal(host(h).saveBeforeUpdate(), false);
  const reopened = await boot(t, { initialStorage: dump(h.w) });
  const expected = new h.w.Chess(); expected.move('e4');
  check(reopened, ['e4', 'e5', 'Nf3'], 1, expected.fen(), fixture);
});

test('empty-line resume metadata is validated and a valid new empty game can reopen', async t => {
  const h = await boot(t), record = JSON.parse(h.w.localStorage.getItem(key));
  const reopened = await boot(t, { initialStorage: dump(h.w) });
  check(reopened, [], 0, new h.w.Chess().fen());
  for (const resume of [null, { cursor: 1, totalPlies: 0, pgnLength: 0, fen: new h.w.Chess().fen() }]) {
    const raw = JSON.stringify({ ...record, pgn: '', resume });
    const broken = await boot(t, { initialStorage: { [key]: raw } });
    assert.equal(broken.w.localStorage.getItem(key), raw);
    assert.equal(host(broken).saveBeforeUpdate(), false);
  }
});
