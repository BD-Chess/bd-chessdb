const test = require('node:test');
const assert = require('node:assert/strict');
const { Chess } = require('../js/chess.min.js');
const SIM = require('../js/8zc-sim-core.js');
const Tournament = require('../js/8zc-tournament-core.js');
const Time = require('../js/8zc-time-core.js');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const DCC = require('../js/8zc-dcc-core.js');
const Runner = require('../js/8zc-sim-runner.js');
const clone = value => JSON.parse(JSON.stringify(value));
const uci = move => move.from + move.to + (move.promotion || '');

function memoryStore() {
  let sequence = 0;
  const runs = new Map(), events = new Map();
  return { runs, events, ready: async () => {}, createId: prefix => `${prefix}-${++sequence}`,
    saveRun: async run => { runs.set(run.id, clone(run)); }, saveEvent: async event => { events.set(event.id, clone(event)); },
    getRun: async id => runs.has(id) ? clone(runs.get(id)) : null, getEvent: async id => events.has(id) ? clone(events.get(id)) : null,
    checkpointSync(run, event) { runs.set(run.id, clone(run)); events.set(event.id, clone(event)); } };
}
function storage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
}
function opening(sans = []) {
  const board = new Chess(); sans.forEach(move => assert(board.move(move)));
  return { id: 'opening-1', name: 'Test opening', startFen: board.fen(), startPgn: board.pgn(), openingPlies: sans.length, bookPlies: sans.length };
}
function script(sans) {
  const board = new Chess(), result = new Map();
  for (const san of sans) { const fen = board.fen(), move = board.move(san); assert(move); result.set(fen, [{ move: uci(move), score: 0 }]); }
  return result;
}
function harness(t, options = {}) {
  const game = new Chess(), wall = options.wall || { value: 0 }, store = options.store || memoryStore();
  const stats = options.stats || { prepare: 0, roots: [], dcc: [], cdb: [], errors: [] };
  let clock = Time.create({ running: false });
  const advance = ms => { wall.value += ms; };
  const now = () => wall.value;
  const workspace = {
    start(mode, cfg = {}) { clock = Time.create({ mode: cfg.baseMs ? 'countdown' : 'elapsed', seconds: (cfg.baseMs || 0) / 1000,
      increment: (cfg.incrementMs || 0) / 1000, turn: game.turn(), now: now(), running: false }); },
    beginTurn() { Time.resume(clock, now()); return !clock.flagged; },
    endTurn() { Time.pause(clock, now()); return Time.snapshot(clock, now()); },
    clockSnapshot() { return Time.snapshot(clock, now()); },
    restoreClock(saved) { clock = Time.restore(saved, now()); assert.equal(clock.turn, game.turn()); },
    recordMove(fen, move) { return Time.move(clock, move.color, game.turn(), now(), '2026-09-25T12:00:00.000Z', { allowPaused: true, pauseAfter: true }); }
  };
  const plan = options.plan || script(['f3', 'e5', 'g4', 'Qh4#']);
  const movesAt = fen => { const moves = plan.get(fen); assert(moves, 'Unexpected position requested: ' + fen); return clone(moves); };
  const SF = { create() {
    const ledger = { rootNodes: 0, rootDepth: 0, rootElapsedMs: 0, extraNodes: 0, extraElapsedMs: 0 };
    return { ledger,
      async prepare() { stats.prepare++; advance(options.warmupMs ?? 25); },
      async root(fen, opts) {
        stats.roots.push({ fen, options: opts }); advance(options.rootMs ?? 120);
        Object.assign(ledger, { rootNodes: 24000, rootDepth: 12, rootElapsedMs: options.rootMs ?? 120 });
        if (options.root) return options.root(fen, opts, stats.roots.length);
        return { moves: options.rootMoves ? options.rootMoves(fen) : movesAt(fen), complete: true, provider: 'SF' };
      },
      async analyzeDCC(fen, root, settings, signal, limits) {
        stats.dcc.push({ fen, limits }); advance(options.dccMs ?? 80);
        Object.assign(ledger, { extraNodes: 6000, extraElapsedMs: options.dccMs ?? 80 });
        return { dcc1Move: root.moves[root.moves.length - 1].move, candidates: [],
          receipt: { fen, provider: 'SF', status: 'complete', calls: 2, reason: 'Comparable sampled continuations' } };
      }, destroy() {} };
  } };
  const callbacks = { ...options.callbacks, error(error) { stats.errors.push(error); options.callbacks?.error?.(error); } };
  const runner = Runner.create({ Chess, SIM, Tournament, SF, Engine: {}, DCC: options.dccCore || DCC, game, workspace, store,
    getCDB: async (fen, opts) => { stats.cdb.push({ fen, options: opts }); advance(options.cdbMs ?? 10);
      return options.cdb ? options.cdb(fen, opts, stats.cdb.length) : { moves: movesAt(fen) }; },
    getPV: async () => { throw new Error('Unexpected CDB DCC probe'); }, getScore: async () => { throw new Error('Unexpected CDB score probe'); },
    settings: () => ({ dccDepth: 3 }), callbacks, now, storage: options.storage || storage() });
  t.after(async () => { if (runner.busy()) await runner.pause(); await runner.settled(); });
  return { runner, game, workspace, store, stats, wall, advance };
}
const config = overrides => ({ format: 'single', white: 'raw', black: 'raw', limitMode: 'depth', depth: 12, movePauseMs: 0, ...overrides });
async function startAndFinish(x, cfg, openings) {
  const event = await x.runner.start(cfg, openings);
  await x.runner.settled();
  assert.deepEqual(x.stats.errors, []);
  return x.store.getEvent(event.id);
}

test('a CDB miss plays the SF fallback and applies SF DCC for the hybrid DCC policy', async t => {
  const book = opening(['f3', 'e5', 'g4']);
  for (const policy of ['raw', 'dcc']) {
    const x = harness(t, { cdb: () => ({ moves: [], reason: 'outside CDB coverage' }),
      rootMoves: () => policy === 'dcc' ? [{ move: 'b8c6', score: 0 }, { move: 'd8h4', score: -5 }] : [{ move: 'd8h4', score: 0 }] });
    const event = await startAndFinish(x, config({ white: 'sf', black: policy }), [book]);
    const run = await x.store.getRun(event.games[0].runId), row = run.trace[0];
    assert.equal(event.state, 'complete'); assert.equal(run.result, '0-1'); assert.equal(run.reason, 'checkmate');
    assert.equal(row.move, 'd8h4'); assert.equal(row.policy, policy); assert.equal(row.provider, 'SF');
    assert.equal(row.fallback, true); assert.equal(row.fallback_reason, 'outside CDB coverage');
    assert.equal(row.picked_by, policy === 'dcc' ? 'dcc' : 'sf-top1'); assert.equal(x.stats.dcc.length, policy === 'dcc' ? 1 : 0);
    assert.equal(x.stats.roots.length, 1); assert.equal(x.stats.roots[0].options.depth, 12);
    assert.deepEqual(x.stats.roots[0].options.history.moves, ['f2f3', 'e7e5', 'g2g4']);
    const replay = new Chess(); assert(replay.load_pgn(run.pgn)); assert.deepEqual(replay.history(), ['f3', 'e5', 'g4', 'Qh4#']);
  }
});

test('the hybrid retries CDB on every new position after an SF fallback', async t => {
  const plan = script(['f3', 'e5', 'g4', 'Qh4#']);
  const x = harness(t, { plan, cdb: (fen, opts, count) => count === 1 ? { moves: [], reason: 'unknown position' } : { moves: clone(plan.get(fen)) } });
  const event = await startAndFinish(x, config(), [opening()]);
  const run = await x.store.getRun(event.games[0].runId);
  assert.equal(event.state, 'complete'); assert.equal(run.trace.length, 4);
  assert.deepEqual(run.trace.map(row => row.provider), ['SF', 'CDB', 'CDB', 'CDB']);
  assert.deepEqual(run.trace.map(row => row.fallback), [true, false, false, false]);
  assert.equal(x.stats.cdb.length, 4); assert.equal(x.stats.roots.length, 1);
  assert.equal(new Set(x.stats.cdb.map(call => call.fen)).size, 4);
});

test('a complete paired event scores both colors and reload skips completed games', async t => {
  const book = opening(['f3', 'e5', 'g4']);
  const x = harness(t), event = await startAndFinish(x, config({ format: 'duel', white: 'raw', black: 'sf' }), [book]);
  assert.equal(event.state, 'complete'); assert.equal(event.games.length, 2); assert.equal(event.nextIndex, 2);
  assert.deepEqual(event.games.map(game => [game.white, game.black]), [['raw', 'sf'], ['sf', 'raw']]);
  assert(event.games.every(game => game.result === '0-1' && game.state === 'complete'));
  const standings = Tournament.standings(event.games);
  assert(standings.every(row => row.played === 2 && row.points === 1));
  const restored = harness(t, { store: x.store });
  await restored.runner.resume(event.id); await restored.runner.settled();
  const saved = await x.store.getEvent(event.id);
  assert.equal(saved.state, 'complete'); assert.equal(saved.games.length, 2);
  assert.equal(restored.stats.roots.length, 0); assert.equal(restored.stats.cdb.length, 0);
  assert.equal(x.store.runs.size, 2, 'reload does not duplicate finished games');
});

test('a saved decision resumes without repeating work or charging viewer and reload time', async t => {
  const book = opening(['f3', 'e5', 'g4']);
  const wall = { value: 0 }, x = harness(t, { wall, warmupMs: 5000,
    cdb: () => ({ moves: [], reason: 'outside CDB coverage' }),
    callbacks: { shouldPause: () => 'Inspect this decision' } });
  const event = await startAndFinish(x, config({ white: 'sf', black: 'dcc', limitMode: 'game-time', baseMs: 60000, incrementMs: 1000 }), [book]);
  assert.equal(event.state, 'paused');
  const paid = await x.store.getRun(event.games[0].runId);
  assert.equal(paid.trace.length, 0); assert.equal(paid.pendingDecision.pick.move, 'd8h4');
  assert.equal(paid.clock.running, false); assert.equal(paid.clock.used.b, 210);
  assert.equal(paid.clock.remaining.b, 59790); assert.equal(paid.clock.remaining.w, 60000);
  const rootCount = x.stats.roots.length, dccCount = x.stats.dcc.length, cdbCount = x.stats.cdb.length;
  x.advance(3600000);
  const resumed = harness(t, { wall, store: x.store, stats: x.stats,
    callbacks: { shouldPause: () => 'Inspect this decision', decision() { wall.value += 2000; } } });
  await resumed.runner.resume(event.id); await resumed.runner.settled();
  const completed = await x.store.getEvent(event.id), run = await x.store.getRun(completed.games[0].runId);
  assert.equal(completed.state, 'complete'); assert.equal(run.result, '0-1'); assert.equal(run.trace.length, 1);
  assert.equal(run.pendingDecision, undefined); assert.equal(x.stats.roots.length, rootCount);
  assert.equal(x.stats.dcc.length, dccCount); assert.equal(x.stats.cdb.length, cdbCount);
  assert.equal(run.trace[0].turn_ms, 210); assert.equal(run.trace[0].clock_ms, 60790);
  assert.equal(run.clock.remaining.b, 60790); assert.equal(run.clock.used.b, 210);
  assert.equal(run.clock.remaining.w, 60000); assert.equal(run.clock.running, false);
  assert.match(run.pgn, /\[TimeControl "60\+1"\]/);
  assert.match(run.pgn, /\[%clk 0:01:00\.790\]/);
});


test('both colors obey CDB top-one and CDB DCC policies through the actual runner', async t => {
  const legal = fen => new Chess(fen).moves({ verbose: true }).slice(0, 2).map(move => ({ move: uci(move), score: 0 }));
  for (const [white, black] of [['raw', 'dcc'], ['dcc', 'raw']]) {
    let x;
    x = harness(t, { cdb: fen => ({ moves: legal(fen) }),
      dccCore: { ...DCC, analyze: async ({ fen, moves }) => ({ dcc1Move: moves[1].move, candidates: [], receipt: { fen, status: 'complete', calls: 2 } }) },
      callbacks: { move(run) { if (run.trace.length === 2) x.runner.pause('Two-ply policy checkpoint'); } } });
    const event = await startAndFinish(x, config({ white, black }), [opening()]);
    const run = await x.store.getRun(event.games[0].runId);
    assert.deepEqual(run.trace.map(row => row.policy), [white, black]);
    assert.deepEqual(run.trace.map(row => row.changed), [white === 'dcc', black === 'dcc']);
    assert(run.trace.every(row => row.provider === 'CDB'));
    assert.equal(x.stats.roots.length, 0); assert.equal(run.state, 'paused'); assert.equal(run.result, '*');
    for (const row of run.trace) assert.equal(row.move, legal(row.fen)[row.policy === 'dcc' ? 1 : 0].move);
  }
});

test('both colors obey SF and SF DCC policies without querying CDB', async t => {
  const legal = fen => new Chess(fen).moves({ verbose: true }).slice(0, 2).map(move => ({ move: uci(move), score: 0 }));
  for (const [white, black] of [['sf', 'sf-dcc'], ['sf-dcc', 'sf']]) {
    let x;
    x = harness(t, { rootMoves: legal, cdb: () => { throw new Error('Direct SF must not query CDB'); },
      callbacks: { move(run) { if (run.trace.length === 2) x.runner.pause('Two-ply policy checkpoint'); } } });
    const event = await startAndFinish(x, config({ white, black }), [opening()]);
    const run = await x.store.getRun(event.games[0].runId);
    assert.deepEqual(run.trace.map(row => row.policy), [white, black]);
    assert.deepEqual(run.trace.map(row => row.changed), [white === 'sf-dcc', black === 'sf-dcc']);
    assert(run.trace.every(row => row.provider === 'SF' && row.root_nodes === 24000));
    assert.equal(x.stats.cdb.length, 0); assert.equal(x.stats.roots.length, 2); assert.equal(x.stats.dcc.length, 1);
    assert.equal(run.state, 'paused'); assert.equal(run.result, '*');
  }
});

test('a paused late SF result cannot commit a move or affect a replacement match', async t => {
  const pending = deferred(), entered = deferred(), book = opening(['f3', 'e5', 'g4']);
  const result = { moves: [{ move: 'd8h4', score: 0 }], complete: true, provider: 'SF' };
  const x = harness(t, { root(fen, opts, count) { if (count === 1) { entered.resolve(); return pending.promise; } return result; } });
  const first = await x.runner.start(config({ white: 'sf', black: 'sf' }), [book]);
  await entered.promise; await x.runner.pause('New game');
  x.game.reset();
  pending.resolve(result); await x.runner.settled();
  assert.equal(x.game.fen(), new Chess().fen());
  const oldEvent = await x.store.getEvent(first.id), oldRun = await x.store.getRun(oldEvent.games[0].runId);
  assert.equal(oldRun.trace.length, 0); assert.equal(oldRun.state, 'paused'); assert.equal(oldRun.result, '*');
  const replacement = await startAndFinish(x, config({ white: 'sf', black: 'sf' }), [book]);
  const newRun = await x.store.getRun(replacement.games[0].runId);
  assert.equal(replacement.state, 'complete'); assert.equal(newRun.trace.length, 1); assert.equal(newRun.trace[0].move, 'd8h4');
  assert.equal((await x.store.getRun(oldRun.id)).trace.length, 0);
});

test('pausing a sixty-second viewer delay settles immediately and retains its paid decision', async t => {
  const decision = deferred(), x = harness(t, { callbacks: { decision: value => decision.resolve(value) } });
  const book = opening(['f3', 'e5', 'g4']);
  const event = await x.runner.start(config({ white: 'sf', black: 'sf', movePauseMs: 60000 }), [book]);
  await decision.promise;
  const began = performance.now();
  await x.runner.pause('Inspect board');
  let timer;
  try { await Promise.race([x.runner.settled(), new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error('Pause did not interrupt MovePause')), 1000); })]); }
  finally { clearTimeout(timer); }
  assert(performance.now() - began < 1000);
  const saved = await x.store.getEvent(event.id), run = await x.store.getRun(saved.games[0].runId);
  assert.equal(saved.state, 'paused'); assert.equal(run.trace.length, 0); assert.equal(run.pendingDecision.pick.move, 'd8h4');
  assert.equal(x.game.fen(), book.startFen); assert.equal(run.clock.running, false);
});

test('initial durable-save failures leave no busy runner or tab lease', async t => {
  for (const failAt of [1, 2]) {
    const saved = memoryStore(), sharedStorage = storage(), originalSave = saved.saveEvent;
    let count = 0;
    saved.saveEvent = async event => { if (++count >= failAt) throw new Error('Disk unavailable'); return originalSave(event); };
    const x = harness(t, { store: saved, storage: sharedStorage });
    if (failAt === 1) await assert.rejects(x.runner.start(config(), [opening()]), /Disk unavailable/);
    else { await x.runner.start(config(), [opening()]); await x.runner.settled(); assert.equal(x.stats.errors.length, 1); assert.match(x.stats.errors[0].message, /Disk unavailable/); }
    assert.equal(x.runner.busy(), false); assert.equal(x.runner.current(), null);
    assert.equal(sharedStorage.getItem('chessSimRunnerLease-v1'), null); assert.equal(x.stats.roots.length, 0);
  }
});

test('a paired event restores a zero-ply custom FEN and exports both complete games', async t => {
  const fen = '7k/8/5KQ1/8/8/8/8/8 w - - 0 1', position = new Chess(fen);
  const extracted = Tournament.extractOpenings(Chess, position.pgn(), { mode: 'current', currentFen: fen });
  assert.equal(extracted.rejected.length, 0);
  const x = harness(t, { plan: new Map([[fen, [{ move: 'g6g7', score: 30000 }]]]) });
  const event = await startAndFinish(x, config({ format: 'duel', white: 'raw', black: 'sf' }), extracted.openings);
  assert.equal(event.state, 'complete'); assert.equal(event.games.length, 2);
  for (const item of event.games) {
    const run = await x.store.getRun(item.runId), replay = new Chess();
    assert.equal(run.startFen, fen); assert.equal(run.trace.length, 1); assert.equal(run.trace[0].move, 'g6g7');
    assert.equal(run.result, '1-0'); assert.equal(run.reason, 'checkmate');
    assert(replay.load_pgn(run.pgn)); assert.deepEqual(replay.history(), ['Qg7#']);
    assert.equal(replay.header().FEN, fen); assert.equal(replay.header().OpeningPlies, '0');
    assert(replay.in_checkmate());
  }
});
