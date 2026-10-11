const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { boot } = require('./source-context-integration.test.cjs');

const picks = fs.readFileSync(path.resolve(__dirname, '../Games/ChessBest_Top_Picks.pgn'), 'utf8');

test('Review opens a loaded Top Pick at its full recorded line and hands a moment to the exact A/B position', { timeout: 12000 }, async t => {
  const h = await boot(t, { libraryPGN: picks });
  const select = h.el('popularGamesPanel').querySelector('.library-native-selects select');
  await h.until(() => select.options.length > 1, 'Top Pick available');
  const pgn = select.options[1].value;
  const anchor = Number(pgn.match(/^\[ChessBestAnchorPly "(\d+)"\]$/m)?.[1]);
  assert.ok(anchor > 0);
  select.value = pgn;
  select.dispatchEvent(new h.w.Event('change'));
  await h.until(() => h.w.ChessLabHost.getReviewGame().cursor === anchor, 'curated position loaded');
  await h.ready();
  const before = h.w.ChessLabHost.getReviewGame();
  const originalStudies = JSON.parse(h.w.localStorage.getItem('ChessBest:LAB:v2:studies')).studies.length;
  const expected = h.w.ChessGameReview.build({ Chess: h.w.Chess, pgn, moves: before.moves, startFen: before.startFen });
  const button = h.el('btnGameReview');
  button.click();
  await h.until(() => h.el('gameReviewPanel')?.classList.contains('open'), 'review drawer open');
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  assert.equal(h.el('gameReviewScrub').value, String(anchor));
  assert.equal(h.el('gameReviewScrub').max, String(expected.totalPly));
  assert.ok(expected.totalPly > anchor, 'whole game remains in review');
  assert.equal(h.el('gameReviewPanel').querySelectorAll('.game-review-source-card').length, 3);
  assert.match(h.el('gameReviewPanel').textContent, /current board/i);
  const row = h.el('gameReviewPanel').querySelector(`.game-review-moment[data-ply="${anchor}"]`);
  assert.ok(row, 'curated moment listed at verified position');
  assert.match(row.textContent, /PGN/);
  row.querySelectorAll('.game-review-actions button')[1].click();
  await h.until(() => h.w.document.querySelector('.chess-study-dialog h2')?.textContent === 'Study & compare', 'Study dialog opened');
  assert.equal(h.w.ChessLabHost.getContext().fen, expected.positions[anchor].fen);
  assert.equal(h.w.ChessLabHost.getContext().moves.length, anchor);
  assert.equal(h.el('gameReviewPanel').hidden, true);
  const tabs = [...h.w.document.querySelectorAll('.chess-study-tabs button')];
  assert.equal(tabs.find(b => b.textContent === 'A / B comparison')?.getAttribute('aria-pressed'), 'true');
  assert.equal(JSON.parse(h.w.localStorage.getItem('ChessBest:LAB:v2:studies')).studies.length, originalStudies, 'Review does not write another Study');
  assert.equal(h.errors.length, 0, h.errors.join('\n'));
});

test('recorded move gap uses one current source only and leaves missing SF played scores unknown', { timeout: 12000 }, async t => {
  const h = await boot(t, { libraryPGN: picks });
  const select = h.el('popularGamesPanel').querySelector('.library-native-selects select');
  await h.until(() => select.options.length > 1, 'Top Pick available');
  select.value = select.options[1].value;
  select.dispatchEvent(new h.w.Event('change'));
  const host = h.w.ChessLabHost;
  const anchor = Number(select.options[1].value.match(/^\[ChessBestAnchorPly "(\d+)"\]$/m)?.[1]);
  await h.until(() => host.getReviewGame().cursor === anchor, 'position loaded');
  await h.ready();
  const game = host.getReviewGame(), fen = host.getContext().fen;
  const recordedMove = game.moves[anchor].from + game.moves[anchor].to + (game.moves[anchor].promotion || '');
  const other = new h.w.Chess(fen).moves({ verbose: true })
    .map(move => move.from + move.to + (move.promotion || '')).find(move => move !== recordedMove);
  assert.ok(other);
  const originalContext = host.getContext;
  host.getContext = () => {
    const context = originalContext();
    if (context.fen === fen) {
      context.analysisSources.CDB = { receipt: { fen, provider: 'CDB', source: 'Fixture CDB', providerPositionContext: 'fen-only' },
        allMoves: [{ move: other, score: 24, rank: 1 }, { move: recordedMove, score: 10, rank: 2 }] };
      context.analysisSources.SF = { receipt: { fen, provider: 'SF', source: 'Fixture SF' },
        allMoves: [{ move: other, score: 40, scoreType: 'cp', rank: 1 }] };
    }
    return context;
  };
  h.el('btnGameReview').click();
  const content = h.el('gameReviewPanel').querySelector('.game-review-played').textContent;
  assert.match(content, /CDB:.*14 cp below first returned candidate \(mover POV\)/);
  assert.match(content, /SF:.*played move score unknown/);
  assert.match(content, /DCC:.*heuristic ranking or raw fallback, no cp gap/);
  assert.equal(h.errors.length, 0, h.errors.join('\n'));
});


test('Dreev Review V3 opens the full line and displays the corrected CDB mate annotation', { timeout: 12000 }, async t => {
  const h = await boot(t, { libraryPGN: picks });
  const select = h.el('popularGamesPanel').querySelector('.library-native-selects select');
  await h.until(() => select.options.length > 1, 'Top Pick available');
  const option = [...select.options].find(item => item.value.includes('[ChessBestReviewVersion "3"]'));
  assert.ok(option, 'Dreev Review V3 appears in the existing library');
  const pgn = option.value;
  const anchor = Number(pgn.match(/^\[ChessBestAnchorPly "(\d+)"\]$/m)?.[1]);
  assert.equal(anchor, 37);
  select.value = pgn;
  select.dispatchEvent(new h.w.Event('change'));
  const host = h.w.ChessLabHost;
  await h.until(() => host.getReviewGame().cursor === anchor, 'Dreev anchor loaded');
  await h.ready();
  const expected = h.w.ChessGameReview.build({ Chess: h.w.Chess, pgn,
    moves: host.getReviewGame().moves, startFen: host.getReviewGame().startFen });
  h.el('btnGameReview').click();
  await h.until(() => h.el('gameReviewPanel')?.classList.contains('open'), 'Review drawer open');
  assert.equal(h.el('gameReviewScrub').max, '99');
  const markers = expected.moments.filter(item => item.basis === 'PGN annotation');
  assert.equal(markers.length, 12);
  const mate = markers.find(item => item.detail.includes('CDB encoded mate score'));
  const row = h.el('gameReviewPanel').querySelector(`.game-review-moment[data-ply="${mate.ply}"]`);
  assert.ok(row, 'corrected mate note remains a navigable marker');
  assert.match(row.textContent, /30000 − 29973 = 27 plies/);
  assert.match(row.textContent, /not 29,973 cp/);
  assert.equal(h.el('gameReviewPanel').querySelectorAll('.game-review-moment').length, expected.moments.length);
  assert.equal(h.errors.length, 0, h.errors.join('\\n'));
});
