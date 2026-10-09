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
  const originalStudies = JSON.parse(h.w.localStorage.getItem('ChessBest:CURRENT:v2:studies')).studies.length;
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
  assert.equal(JSON.parse(h.w.localStorage.getItem('ChessBest:CURRENT:v2:studies')).studies.length, originalStudies, 'Review does not write another Study');
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
