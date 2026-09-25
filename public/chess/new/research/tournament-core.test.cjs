const test = require('node:test');
const assert = require('node:assert/strict');
const { Chess } = require('../js/chess.min.js');
const T = require('../js/8zc-tournament-core.js');

test('each opening gets every round-robin pair in both colors', () => {
  const openings = ['a', 'b'].map(id => ({ id, startFen: new Chess().fen(), startPgn: '' }));
  const games = T.createSchedule({ format: 'round-robin', rounds: 2 }, openings);
  assert.equal(games.length, 48);
  for (const opening of openings) for (const white of T.ENGINES) for (const black of T.ENGINES) {
    if (white === black) continue;
    assert.equal(games.filter(game => game.openingId === opening.id && game.white === white && game.black === black).length, 2);
  }
  assert.equal(T.createSchedule({ format: 'duel', engines: ['sf', 'dcc'] }, openings).length, 4);
});
test('standings and crosstable score completed results only', () => {
  const games = [
    { id: 1, white: 'sf', black: 'dcc', state: 'complete', result: '1-0' },
    { id: 2, white: 'dcc', black: 'sf', state: 'complete', result: '1/2-1/2' },
    { id: 3, white: 'dcc', black: 'sf', state: 'incomplete', result: '*' },
    { id: 4, white: 'sf', black: 'dcc', state: 'paused', result: '1/2-1/2' },
    { id: 5, white: 'sf', black: 'dcc', state: 'queued', result: '*' }
  ];
  const [sf, dcc] = T.standings(games);
  assert.equal(sf.engine, 'sf'); assert.equal(sf.points, 1.5); assert.equal(sf.played, 2);
  assert.equal(sf.interrupted, 2); assert.equal(sf.pending, 1); assert.equal(dcc.points, 0.5);
  assert.equal(T.crosstable(games).matrix.sf.dcc.played, 2);
});
test('Auto extracts contiguous mainline book plies, otherwise nine full moves', () => {
  const book = '[Event "Book line"]\n\n1. e4 {book} e5 {book} (1... c5 {book}) 2. Nf3 {search} Nc6 *';
  const output = T.extractOpenings(Chess, book);
  assert.equal(output.rejected.length, 0); assert.equal(output.openings[0].openingPlies, 2);
  assert.equal(output.openings[0].boundary, 'book-comments');
  const long = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 *';
  const auto = T.extractOpenings(Chess, long).openings[0];
  assert.equal(auto.openingPlies, 18); assert.equal(auto.boundary, 'fullmoves');
  const explicit = T.extractOpenings(Chess, book, { mode: 'fullmoves', fullmoves: 2 }).openings[0];
  assert.equal(explicit.openingPlies, 4);
  const board = new Chess(); assert.equal(board.load_pgn(auto.startPgn), true); assert.equal(board.fen(), auto.startFen);
});
test('dedup positions across games and reject nonorthodox, malformed or illegal games', () => {
  const pgn = '[Event "A"]\n\n1. e4 e5 *\n\n[Event "B"]\n\n1. e4 e5 *\n\n[Variant "Chess960"]\n\n1. e4 *\n\n[Event "Illegal"]\n\n1. e5 *';
  const output = T.extractOpenings(Chess, pgn, { fullmoves: 1 });
  assert.equal(output.openings.length, 1); assert.equal(output.duplicates, 1); assert.equal(output.rejected.length, 2);
  const current = T.extractOpenings(Chess, output.openings[0].startPgn, { mode: 'current', currentFen: output.openings[0].startFen });
  assert.equal(current.openings[0].openingPlies, 2); assert.equal(current.openings[0].boundary, 'current');
  const mismatch = T.extractOpenings(Chess, output.openings[0].startPgn, { mode: 'current', currentFen: new Chess().fen() });
  assert.equal(mismatch.openings.length, 0); assert.match(mismatch.rejected[0].reason, /does not match/);
});

test('selected round-robin engines are honored and invalid duels are never substituted', () => {
  const openings = [{ id: 'a', startFen: new Chess().fen() }];
  const games = T.createSchedule({ format: 'round-robin', engines: ['sf', 'dcc', 'sf'] }, openings);
  assert.equal(games.length, 2); assert.deepEqual(new Set(games.flatMap(game => [game.white, game.black])), new Set(['sf', 'dcc']));
  assert.equal(T.createSchedule({ format: 'round-robin' }, openings).length, 12);
  assert.throws(() => T.createSchedule({ format: 'duel', engines: ['sf', 'sf'] }, openings), /different engines/);
  assert.throws(() => T.createSchedule({ format: 'duel', white: 'sf', black: 'sf' }, openings), /different engines/);
  assert.throws(() => T.createSchedule({ format: 'round-robin', engines: ['sf'] }, openings), /different engines/);
  assert.throws(() => T.createSchedule({ engines: ['sf', 'unknown'] }, openings), /Unknown tournament engine/);
  assert.throws(() => T.createSchedule({ format: 'round-robin', rounds: 1000 }, openings), /10,000-game limit/);
});
