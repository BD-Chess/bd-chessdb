const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { boot } = require('./source-context-integration.test.cjs');
const { Chess } = require('../js/chess.min.js');
const C = require('../js/8zc-study-core.js');
const S = require('../js/8zc-study-store.js');
const KEY = 'ChessBest:LAB:v2:studies';
const topPicks = fs.readFileSync(path.resolve(__dirname, '../Games/ChessBest_Top_Picks.pgn'), 'utf8');
const tcecPicks = fs.readFileSync(path.resolve(__dirname, '../Games/ChessBest_Top_Picks_TCEC.pgn'), 'utf8');

function seed(count) {
  const state = S.empty();
  for (let i = 0; i < count; i++) state.studies.push(C.create(Chess, { id: 'existing-' + i, title: 'Existing ' + i }));
  state.activeId = state.studies.at(-1)?.id || null;
  return JSON.stringify(state);
}
const studies = h => JSON.parse(h.w.localStorage.getItem(KEY));
const button = (h, text) => {
  const found = [...h.w.document.querySelectorAll('button')].find(node => node.textContent === text);
  assert.ok(found, text); return found;
};
async function pick(h) {
  const select = h.el('popularGamesPanel').querySelector('.library-native-selects select');
  await h.until(() => select.options.length > 1, 'Top Picks populated from the actual curated PGN');
  const value = select.options[1].value, study = h.w.ChessStudy.parsePGN(h.w.Chess, value);
  const ply = Number(study.headers.ChessBestAnchorPly);
  assert.ok(ply > 0);
  let node = study.nodes.root;
  for (let i = 0; i < ply; i++) node = study.nodes[node.children[0]];
  h.el('btnGames').click();
  select.value = value; select.dispatchEvent(new h.w.Event('change'));
  return { pgn: value, fen: node.fen, ply, title: study.headers.ChessBestTitle, headers: study.headers };
}
async function anchored(h, expected) {
  await h.until(() => h.w.ChessLabHost.getContext().fen === expected.fen, 'saved Top Pick opens at its curated anchor');
  const context = h.w.ChessLabHost.getContext();
  assert.equal(context.moves.length, expected.ply);
  assert.equal(context.headers.White, expected.headers.White);
  assert.equal(context.headers.Black, expected.headers.Black);
  assert.match(h.el('boardGameTitle').textContent, /Gukesh/);
  const marker = JSON.parse(h.w.localStorage.getItem('ChessBest:LAB:v2:top-pick'));
  assert.equal(marker.cursor, expected.ply);
  assert.equal(h.w.localStorage.getItem('ChessBest:LAB:v2:game'), expected.pgn, 'whole curated PGN is retained alongside cursor');
  assert.equal(h.el('popularGamesPanel').classList.contains('open'), false);
}

test('Top Pick is durably saved before its real loader opens the curated position', { timeout: 10000 }, async t => {
  const h = await boot(t, { libraryPGN: topPicks });
  const expected = await pick(h);
  await anchored(h, expected);
  const saved = studies(h).studies.filter(study => study.headers.ChessBestTitle === expected.title);
  assert.equal(saved.length, 1, 'one saved record backs the loaded Top Pick');
  assert.equal(saved[0].headers.White, expected.headers.White);
  assert.equal(h.errors.length, 0, h.errors.join('\n'));
});

test('Review retains the complete annotated Top Pick through history navigation and one deliberate jump', { timeout: 10000 }, async t => {
  const h = await boot(t, { libraryPGN: topPicks });
  const expected = await pick(h);
  await anchored(h, expected);
  const host = h.w.ChessLabHost;
  const review = host.getReviewGame();
  assert.equal(review.cursor, expected.ply);
  assert.ok(review.totalPly > review.cursor);
  assert.equal(review.sourcePGN, expected.pgn, 'source comment remains available at an intermediate cursor');
  assert.equal(review.sourceIsOriginal, true);
  assert.equal(review.moves[expected.ply].san, 'f6');
  const savedBeforeNavigation = studies(h).studies.length;
  host.navigateReview(expected.ply + 1);
  assert.equal(host.getReviewGame().cursor, expected.ply + 1);
  host.navigateReview(expected.ply);
  assert.equal(host.getContext().fen, expected.fen);
  assert.equal(studies(h).studies.length, savedBeforeNavigation, 'jumping among loaded moves does not create more studies');
  assert.equal(h.errors.length, 0, h.errors.join('\n'));
});

test('Review keeps TCEC adjudication only on its verified original line', { timeout: 10000 }, async t => {
  const h = await boot(t, { libraryPGN: tcecPicks });
  const expected = await pick(h);
  await h.until(() => h.w.ChessLabHost.getContext().fen === expected.fen, 'TCEC anchored at its source position');
  const host = h.w.ChessLabHost;
  const review = host.getReviewGame();
  assert.equal(review.cursor, 96);
  assert.equal(review.totalPly, 124);
  assert.equal(review.moves[96].san, 'Rba1');
  assert.equal(review.headers.Termination, 'adjudication');
  assert.equal(review.sourcePGN, expected.pgn);
  host.navigateReview(95);
  assert.equal(host.getReviewGame().cursor, 95);
  host.navigateReview(96);
  assert.equal(host.getContext().fen, expected.fen);
  assert.equal(h.errors.length, 0, h.errors.join('\n'));
});

test('Review labels an explored line without inheriting the original curated decision', { timeout: 10000 }, async t => {
  const h = await boot(t, { libraryPGN: topPicks });
  const expected = await pick(h);
  await h.until(() => h.w.ChessLabHost.getContext().fen === expected.fen, 'original curated anchor loaded');
  assert.equal(h.w.ChessLabHost.getReviewGame().sourceIsOriginal, true);
  h.drop('b8', 'h8'); // Explore 44...Rh8 instead of the recorded 44...f6.
  const explored = h.w.ChessLabHost.getReviewGame();
  assert.equal(explored.lineChanged, true);
  assert.equal(explored.sourceIsOriginal, false);
  assert.equal(explored.moves.at(-1).san, 'Rh8');
  assert.equal(explored.headers.ChessBestAnchorPly, undefined);
  assert.equal(explored.headers.ChessBestTeaser, undefined);
  assert.equal(explored.headers.Result, undefined);
  assert.doesNotMatch(explored.sourcePGN, /Critical moment:/);
  assert.equal(h.errors.length, 0, h.errors.join('\n'));
});

test('Top Pick at 20 Studies keeps the board until explicit removal and resumes the original anchored load once', { timeout: 10000 }, async t => {
  const h = await boot(t, { initialStudies: seed(20), libraryPGN: topPicks });
  const before = h.w.ChessLabHost.getContext().fen, expected = await pick(h);
  await h.until(() => h.w.document.querySelector('.chess-study-dialog h2')?.textContent === 'Studies full — 20 / 20', 'capacity manager opened');
  assert.equal(h.w.ChessLabHost.getContext().fen, before);
  assert.equal(studies(h).studies.length, 20);
  const check = h.w.document.querySelector('.chess-capacity-row input');
  check.checked = true; check.dispatchEvent(new h.w.Event('change'));
  button(h, 'Remove selected Studies').click(); button(h, 'Confirm removal').click();
  await h.until(() => studies(h).studies.length === 19, 'selected record removed durably');
  button(h, 'Continue pending action').click();
  await anchored(h, expected);
  assert.equal(studies(h).studies.length, 20);
  assert.equal(studies(h).studies.filter(study => study.headers.ChessBestTitle === expected.title).length, 1);
  assert.equal(h.errors.length, 0, h.errors.join('\n'));
});

test('failed Top Pick persistence retains the original board, game and selected game identity', { timeout: 10000 }, async t => {
  const h = await boot(t, { libraryPGN: topPicks });
  const before = h.w.ChessLabHost.getContext(), originalStudies = h.w.localStorage.getItem(KEY);
  const title = h.el('boardGameTitle').textContent, game = h.w.localStorage.getItem('ChessBest:LAB:v2:game');
  h.failStudyWrites(true);
  await pick(h);
  await h.until(() => /QUOTA/.test(h.w.document.querySelector('.chess-study-status')?.textContent || ''), 'quota failure is shown');
  assert.equal(h.w.ChessLabHost.getContext().fen, before.fen);
  assert.equal(h.el('boardGameTitle').textContent, title);
  assert.equal(h.w.localStorage.getItem('ChessBest:LAB:v2:game'), game);
  assert.equal(h.w.localStorage.getItem(KEY), originalStudies);
  assert.equal(h.w.localStorage.getItem('ChessBest:LAB:v2:top-pick'), null);
  assert.equal(h.errors.length, 0, h.errors.join('\n'));
});
