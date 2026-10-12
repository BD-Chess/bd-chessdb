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
  assert.equal(all.length, 10);
  for (const pgn of all) {
    const review = Review.build({ Chess, pgn });
    const anchor = Number(review.headers.ChessBestAnchorPly);
    const moment = review.moments.find(item => item.ply === anchor);
    assert.ok(moment, review.headers.ChessBestTitle);
    assert.equal(moment.fen, review.headers.ChessBestAnchorFEN);
    assert.ok(['PGN annotation', 'Curated PGN position'].includes(moment.basis));
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


test('Dreev Review V4 preserves the V3 notes, 99-ply line, and encoded mate correction', () => {
  const pgn = picks('ChessBest_Top_Picks.pgn').find(item => item.includes('[ChessBestReviewVersion "4"]'));
  assert.ok(pgn, 'Review V4 PGN is present');
  const review = Review.build({ Chess, pgn });
  assert.equal(review.sourceStatus, 'PGN main line verified');
  assert.equal(review.totalPly, 99);
  const annotated = review.moments.filter(moment => moment.basis === 'PGN annotation');
  assert.equal(annotated.length, 12);
  const mate = annotated.find(moment => moment.detail.includes('CDB encoded mate score'));
  assert.ok(mate, 'the 45...fxg2 decision is navigable');
  assert.match(mate.detail, /30000 − 29973 = 27 plies, about M14 with Black to move/);
  assert.match(mate.detail, /CDB encoded mate score, not 29,973 cp/);
  assert.doesNotMatch(mate.detail, /29973 cp/);
  assert.match(annotated.find(moment => moment.moveLabel.includes('20... Rac8')).detail, /22...Rb8 is a different position/);
  assert.match(annotated.find(moment => moment.moveLabel.includes('34... b5')).detail, /already been revealed by GPT/);
  assert.match(annotated.find(moment => moment.moveLabel.includes('37... Ra8')).detail, /not a blind-find test/);
  assert.equal(review.analysis.status, 'not-computed');
  assert.equal(review.analysis.evaluations, null);
  const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '../Games/ChessBest_Top_Picks.catalog.json'), 'utf8'));
  const entry = catalog.cases.find(item => item.id === 'dreev-kasparov-moscow-1996-19-bxa4');
  assert.equal(entry.evidence.review_v3.source_report, 'docs/chessbest-evidence/dreev-kasparov-review-v3-20261011.md');
  assert.equal(entry.evidence.review_v3.mate_score.cdb_raw, 29973);
  assert.equal(entry.evidence.review_v3.mate_score.distance_plies, 27);
  assert.equal(entry.evidence.review_v3.mate_score.formal_proof, false);
  assert.equal(entry.evidence.review_v3.r4_frozen.historical_played_root_cp.final, 56);
  assert.equal(entry.evidence.review_v3.r4_frozen.complete_typed_score_counts_published, false);
});

function dreevEvidence() {
  const pgn = picks('ChessBest_Top_Picks.pgn').find(item => item.includes('[ChessBestReviewVersion "4"]'));
  const review = Review.build({ Chess, pgn });
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/dreev-kasparov-review.json'), 'utf8'));
  return { review, data };
}

test('saved R4/SF evidence binds all 100 positions and validates every published candidate and PV', () => {
  const { review, data } = dreevEvidence();
  const result = Review.attachEvidence(review, data, Chess);
  assert.equal(result.evidence.positions.length, 100);
  assert.deepEqual(result.evidence.coverage.cdb_played_types, { cp:56, mate:2, special:0, unknown:41 });
  assert.equal(result.evidence.coverage.cdb_scored, 58);
  assert.equal(result.evidence.coverage.sf_played, 76, 'baseline coverage is not misrepresented as all played scores');
  assert.equal(result.evidence.coverage.sf_comparisons, 43);
  const row = result.evidence.positions[89];
  assert.equal(row.cdb.candidates.find(c => c.uci === 'f3g2').score.plies, 27);
  assert.equal(row.cdb.candidates.find(c => c.uci === row.played), undefined, 'played Bxd6 stays unscored in R4');
  assert.equal(row.comparison.depth, 34);
  assert.equal(row.comparison.candidates[0].pv.checkmate, true);
  assert.equal(row.comparison.candidates[0].pv.steps.at(-1).label, '58... Qh2#');
  assert.equal(result.moves.length, 99, 'analysis continuation does not extend the historical game');
});

test('CDB mate encoding, SF mate units and White POV preserve type and direction', () => {
  const black = '8/8/8/8/8/8/4k3/6K1 b - - 0 1';
  assert.deepEqual(Review.decodeCdb(29973), { type:'mate', raw:29973, sign:1, plies:27, encoding:'CDB-30000' });
  assert.equal(Review.scoreText(Review.decodeCdb(29973), black), 'M14 · 27 plies');
  assert.equal(Review.scoreText(Review.decodeCdb(29973), black, 'white'), '−M14 · 27 plies');
  assert.equal(Review.scoreText({ type:'mate', moves:14, sign:1 }, black), 'M14');
  assert.equal(Review.scoreText({ type:'cp', cp:932 }, black, 'white'), '−9.32');
  assert.equal(Review.decodeCdb(20000).type, 'special', 'unclassified special codes are not cp or guessed mate');
  assert.equal(Review.scoreText({ type:'cp', cp:42, bound:'lower' }, black, 'white'), '≤−0.42');
});

test('graph keeps missing-score gaps, excludes bounds, and never assigns a cp value to mate', () => {
  const fen = new Chess().fen();
  const rows = [
    {ply:0,fen,cdb:{candidates:[{score:{type:'cp',cp:20}}]}},
    {ply:1,fen,cdb:{candidates:[]}},
    {ply:2,fen,cdb:{candidates:[{score:Review.decodeCdb(29973)}]}},
    {ply:3,fen,cdb:{candidates:[{score:{type:'cp',cp:50,bound:'upper'}}]}}
  ];
  const segments = Review.plotSeries(rows, 'cdb');
  assert.equal(segments.length, 2);
  assert.deepEqual(segments.map(s=>s.map(p=>p.ply)), [[0],[2]]);
  assert.equal(segments[1][0].cp, null);
  assert.equal(segments[1][0].mateSign, 1);
});

test('saved evidence cannot follow a modified line or mismatched FEN, and rejects special cp mislabeling', () => {
  const { review, data } = dreevEvidence();
  const wrong = structuredClone(data); wrong.positions[4].fen = new Chess().fen();
  assert.throws(()=>Review.attachEvidence(review, wrong, Chess), /identity mismatch/);
  const changed = { ...review, moves:[...review.moves] }; changed.moves[3]='d7d5';
  assert.throws(()=>Review.attachEvidence(changed, data, Chess), /different recorded line/);
  const bad = structuredClone(data); bad.positions[89].cdb.candidates[0].score={type:'cp',cp:29973};
  assert.throws(()=>Review.attachEvidence(review, bad, Chess), /mislabeled as centipawns/);
  const badPV = structuredClone(data); badPV.positions[89].comparison.candidates[0].pv[1]='a1a8';
  assert.throws(()=>Review.attachEvidence(review, badPV, Chess), /illegal move/);
});

test('ordinary imported PGN evals describe positions after their move, use White POV, and do not leak to branches', () => {
  const pgn = '[Event "Imported"]\n[Result "*"]\n\n1.e4 {[%eval 0.42,20]} e5 2.Nf3 {[%eval #-3]} Nc6 *';
  const review = Review.build({Chess,pgn});
  assert.equal(review.pgnEvaluations[0].pgn, null);
  assert.equal(review.pgnEvaluations[1].pgn.score.cp, 42);
  assert.equal(review.pgnEvaluations[1].pgn.depth, 20);
  const series = Review.plotSeries(review.pgnEvaluations, 'pgn');
  assert.equal(series[0][0].cp, 42, 'White POV annotation is not flipped at a Black-to-move position');
  assert.equal(series[1][0].cp, null);
  assert.equal(series[1][0].mateSign, -1);
  const changed = Review.build({Chess,pgn,moves:['d4','d5']});
  assert(changed.pgnEvaluations.every(row=>row.pgn===null));
});

