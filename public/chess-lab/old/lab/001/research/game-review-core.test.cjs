const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Chess } = require('../js/chess.min.js');
const Review = require('../js/8zc-review-core.js');

function picks(filename) {
  return fs.readFileSync(path.join(__dirname, '../Games', filename), 'utf8')
    .split(/\n\s*\n(?=\[Event\s+")/).filter(Boolean);
}

test('every curated Top Pick opens at its verified decision without inventing an evaluation', () => {
  const all = [...picks('ChessBest_Top_Picks.pgn'), ...picks('ChessBest_Top_Picks_TCEC.pgn')];
  assert.equal(all.length, 7);
  for (const pgn of all) {
    const review = Review.build({ Chess, pgn });
    const anchor = Number(review.headers.ChessBestAnchorPly);
    const moment = review.moments.find(item => item.ply === anchor);
    assert.ok(moment, review.headers.ChessBestTitle);
    assert.equal(moment.fen, review.headers.ChessBestAnchorFEN);
    assert.equal(moment.basis, 'PGN annotation');
    assert.equal(review.positions[anchor + 1].moveLabel, moment.moveLabel);
    assert.equal(review.analysis.status, 'not-computed');
    assert.equal(review.analysis.evaluations, null);
    assert.equal(review.totalPly, review.moves.length);
  }
});

test('TCEC context preserves recorded adjudication and engine identities without invented historical data', () => {
  const review = Review.build({ Chess, pgn: picks('ChessBest_Top_Picks_TCEC.pgn')[0] });
  assert.equal(review.tcec.isTcec, true);
  assert.equal(review.tcec.termination, 'adjudication');
  assert.equal(review.tcec.terminationDetails, 'SyzygyTB');
  assert.match(review.tcec.engineWhite, /^LCZero/);
  assert.match(review.tcec.engineBlack, /^Stockfish/);
  assert.equal(review.tcec.pairedOpening, null);
  assert.equal(review.tcec.historicEvaluations, null);
  assert.equal(review.tcec.principalVariations, null);
  assert.equal(review.positions[96].moveLabel, '48... a3');
  assert.equal(review.moments.find(item => item.ply === 96).moveLabel, '49. Rba1');
});

test('source annotations only apply to the same verified main line; side variations are ignored', () => {
  const pgn = '[Event "Annotator"]\n[Result "*"]\n\n1. e4 { Critical moment: compare the answer. } (1. d4 { Critical moment: not the main line. }) 1... e5 2. Nf3 $2 Nc6 *';
  const review = Review.build({ Chess, pgn });
  assert.deepEqual(review.moves, ['e2e4', 'e7e5', 'g1f3', 'b8c6']);
  assert.ok(review.moments.some(moment => moment.ply === 1 && /compare the answer/.test(moment.detail)));
  assert.ok(review.moments.some(moment => moment.ply === 2 && moment.title.includes('Mistake')));
  assert.ok(review.moments.every(moment => !moment.detail.includes('not the main line')));

  const wrongLine = Review.build({ Chess, pgn, moves: ['d4', 'd5', 'c4'] });
  assert.equal(wrongLine.sourceStatus, 'PGN annotations unavailable');
  assert.ok(wrongLine.moments.every(moment => moment.basis === 'Navigation'));
});

test('a changed line never inherits the curated anchor, teaser or source from the old PGN', () => {
  const pgn = picks('ChessBest_Top_Picks.pgn')[0];
  const game = new Chess();
  game.move('d4'); game.move('d5'); game.move('c4');
  const review = Review.build({ Chess, pgn, headers: { ChessBestAnchorPly: '2' },
    moves: game.history({ verbose: true }), lineChanged: true, sourceIsOriginal: false });
  assert.ok(review.moments.every(moment => moment.basis === 'Navigation'));
  assert.equal(review.headers.ChessBestTitle, undefined);
  assert.equal(review.headers.ChessBestAnchorPly, undefined);
  assert.equal(review.sourceStatus, 'PGN annotations unavailable');
});

test('unannotated games have truthful navigation checkpoints and legal position history', () => {
  const pgn = '[Event "Short"]\n[White "A"]\n[Black "B"]\n[Result "*"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. c3 d6 *';
  const review = Review.build({ Chess, pgn });
  assert.ok(review.moments.length >= 1);
  assert.ok(review.moments.every(moment => moment.basis === 'Navigation'));
  assert.ok(review.moments.every(moment => moment.ply >= 0 && moment.ply < review.totalPly));
  for (const moment of review.moments) {
    const game = new Chess(review.rootFen);
    for (const move of review.moves.slice(0, moment.ply)) assert.ok(game.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] }));
    assert.equal(game.fen(), moment.fen);
  }
  assert.equal(review.tcec.isTcec, false);
  assert.equal(review.tcec.termination, null);
});

test('wrong curated FEN cannot establish a critical moment in an otherwise unannotated game', () => {
  const pgn = '[Event "Test"]\n[ChessBestAnchorPly "2"]\n[ChessBestAnchorFEN "impossible"]\n[ChessBestTitle "Unverified claim"]\n[Result "*"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *';
  const review = Review.build({ Chess, pgn });
  assert.ok(review.moments.every(moment => moment.basis === 'Navigation'));
});
