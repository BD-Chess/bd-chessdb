// Bounded source-level checks reuse the shipped runner test harness.
// Deterministic provider boundaries; not a browser, network engine or phone test.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const harnessPath = require('node:path').join(__dirname, 'sim-runner.test.cjs');
const source = fs.readFileSync(harnessPath, 'utf8');
const beforeTests = source.slice(0, source.indexOf("\ntest('"));
const { harness, config, startAndFinish, opening, script, Chess, Tournament } =
  new Function('require', beforeTests + '\nreturn { harness, config, startAndFinish, opening, script, Chess, Tournament };')(createRequire(harnessPath));

test('the actual runner completes a four-policy 12-game round robin and reload skips finished games', async t => {
  const x = harness(t);
  const event = await startAndFinish(x, config({ format: 'round-robin', engines: ['raw', 'dcc', 'sf', 'sf-dcc'] }), [opening(['f3', 'e5', 'g4'])]);
  assert.equal(event.state, 'complete');
  assert.equal(event.games.length, 12);
  assert.equal(event.nextIndex, 12);
  assert.equal(x.store.runs.size, 12);
  for (const game of event.games) {
    const run = await x.store.getRun(game.runId), replay = new Chess();
    assert.equal(game.state, 'complete');
    assert.equal(game.result, '0-1');
    assert.equal(run.reason, 'checkmate');
    assert.equal(run.trace.length, 1);
    assert(replay.load_pgn(run.pgn));
    assert(replay.in_checkmate());
  }
  const standings = Tournament.standings(event.games);
  assert.equal(standings.length, 4);
  assert(standings.every(row => row.played === 6 && row.points === 3 && row.wins === 3 && row.losses === 3));
  const cross = Tournament.crosstable(event.games);
  for (const a of cross.engines) for (const b of cross.engines) {
    if (a === b) assert.equal(cross.matrix[a][b], null);
    else { assert.equal(cross.matrix[a][b].played, 2); assert.equal(cross.matrix[a][b].points, 1); }
  }
  const restored = harness(t, { store: x.store });
  await restored.runner.resume(event.id); await restored.runner.settled();
  assert.equal((await x.store.getEvent(event.id)).state, 'complete');
  assert.equal(restored.stats.cdb.length + restored.stats.roots.length, 0);
  assert.equal(x.store.runs.size, 12);
});

test('a timed runner records a time forfeit without committing the late move', async t => {
  const x = harness(t, { cdbMs: 1100 });
  const event = await startAndFinish(x, config({ limitMode: 'game-time', baseMs: 1000, incrementMs: 0 }), [opening()]);
  const run = await x.store.getRun(event.games[0].runId);
  assert.equal(event.state, 'complete');
  assert.equal(run.state, 'complete');
  assert.equal(run.reason, 'time forfeit');
  assert.equal(run.result, '0-1');
  assert.equal(run.trace.length, 0);
  assert.equal(run.clock.flagged, 'w');
  assert.equal(run.clock.remaining.w, 0);
  assert.equal(run.clock.running, false);
  assert.match(run.pgn, /\[Result "0-1"\]/);
  assert.equal(x.game.fen(), new Chess().fen());
});

test('a runner move reaching stalemate persists a completed draw', async t => {
  const fen = '7k/5K2/8/6Q1/8/8/8/8 w - - 0 1';
  const position = new Chess(fen);
  const extracted = Tournament.extractOpenings(Chess, position.pgn(), { mode: 'current', currentFen: fen });
  assert.equal(extracted.rejected.length, 0);
  const x = harness(t, { plan: new Map([[fen, [{ move: 'g5g6', score: 0 }]]]) });
  const event = await startAndFinish(x, config(), extracted.openings);
  const run = await x.store.getRun(event.games[0].runId), replay = new Chess();
  assert.equal(event.state, 'complete');
  assert.equal(run.result, '1/2-1/2');
  assert.equal(run.reason, 'draw');
  assert.equal(run.trace.length, 1);
  assert(replay.load_pgn(run.pgn));
  assert(replay.in_stalemate());
  assert.equal(run.clock.running, false);
});

test('the runner retains history and completes a threefold repetition as a draw', async t => {
  const x = harness(t, { plan: script(['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']) });
  const event = await startAndFinish(x, config(), [opening()]);
  const run = await x.store.getRun(event.games[0].runId), replay = new Chess();
  assert.equal(event.state, 'complete');
  assert.equal(run.result, '1/2-1/2');
  assert.equal(run.reason, 'draw');
  assert.equal(run.trace.length, 8);
  assert(replay.load_pgn(run.pgn));
  assert(replay.in_threefold_repetition());
  assert.equal(run.clock.running, false);
});
