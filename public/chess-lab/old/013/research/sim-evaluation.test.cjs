/* No network/DOM dependencies: the actual runner, spectator and chess legality. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { Chess } = require('../js/chess.min.js');
const Eval = require('../js/8zc-eval-bar.js');
const Runner = require('../js/8zc-sim-runner.js');
const SIM = require('../js/8zc-sim-core.js');
const flush = () => new Promise(resolve => setImmediate(resolve));
const defer = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const uci = m => m.from + m.to + (m.promotion || '');
function best(fen, score) { return { fen, moves: [{ move: uci(new Chess(fen).moves({ verbose: true })[0]), score }] }; }
function viewFor(game) {
  const log = [], sources = [], pending = [];
  return { log, sources, pending,
    markComparisonPending(fen, hold) { assert.equal(fen, game.fen()); assert.equal(hold, false); pending.push(fen); },
    render() {}, updateSource(...args) { sources.push(args); },
    update(fen, score, source, settled) { assert.equal(fen, game.fen(), 'never paint a score on another FEN'); log.push({ fen, score, source, settled, measured: Eval.measure(fen, score, null, source) }); }
  };
}
function sfDecision(game, score, extra = {}) {
  return { fen: game.fen(), pick: { actual_provider: 'SF', raw_best: best(game.fen(), score).moves[0].move,
    raw_best_score: score, root_depth: 5, ...extra } };
}

test('CDB refresh follows both colors; current SF depth 5 is fallback, not the preferred spectator', async () => {
  const game = new Chess(), view = viewFor(game), requests = [];
  const watcher = Eval.watchSimulation({ Chess, game, view, getCDB(fen, options) {
    const d = defer(); requests.push({ fen, options, ...d }); return d.promise;
  } });
  watcher.start();
  watcher.decision(sfDecision(game, -30));
  assert.equal(view.log.at(-1).measured.label, '-0.30');
  assert.equal(view.sources.at(-1)[3], 5);
  requests[0].resolve(best(game.fen(), 25)); await flush();
  assert.equal(view.log.at(-1).measured.label, '+0.25');
  assert.equal(view.log.at(-1).source, 'CDB');
  watcher.decision(sfDecision(game, -999));
  assert.equal(view.log.at(-1).source, 'CDB');
  game.move('e4'); watcher.position();
  requests[1].resolve(best(game.fen(), 180)); await flush();
  assert.equal(view.log.at(-1).measured.label, '-1.80', 'CDB raw score uses side-to-move POV');
  game.move('e5'); watcher.position();
  requests[2].resolve(best(game.fen(), -310)); await flush();
  assert.equal(view.log.at(-1).measured.label, '-3.10');
  assert.equal(view.pending.length, 3);
  assert(requests.every(r => r.options.signal === undefined && r.options.timeoutMs <= 5000));
  watcher.stop();
});

test('slow CDB coalesces to newest position and pause/resume rejects same-FEN late responses', async () => {
  const game = new Chess(), view = viewFor(game), requests = [];
  const watcher = Eval.watchSimulation({ Chess, game, view, getCDB(fen) {
    const d = defer(); requests.push({ fen, ...d }); return d.promise;
  } });
  watcher.start(); game.move('e4'); watcher.position(); game.move('e5'); watcher.position();
  assert.equal(requests.length, 1, 'bounded one in-flight spectator lookup');
  requests[0].resolve(best(requests[0].fen, 500)); await flush();
  assert.equal(view.log.length, 0); assert.equal(requests.length, 2);
  assert.equal(requests[1].fen, game.fen());
  watcher.stop(); watcher.start();
  requests[1].resolve(best(requests[1].fen, 900)); await flush();
  assert.equal(view.log.length, 0, 'same FEN is not the same run generation');
  assert.equal(requests.length, 3);
  requests[2].resolve(best(game.fen(), 42)); await flush();
  assert.equal(view.log.at(-1).measured.label, '+0.42');
  watcher.stop();
});

test('the actor CDB receipt paints immediately and is not erased by observer failure or shallow SF', async () => {
  const game = new Chess(), view = viewFor(game), d = defer();
  const watcher = Eval.watchSimulation({ Chess, game, view, getCDB: () => d.promise });
  watcher.start();
  const value = sfDecision(game, 130); value.pick.actual_provider = 'CDB';
  watcher.decision(value);
  d.reject(Error('network')); await flush(); watcher.decision(sfDecision(game, 5));
  assert.equal(view.log.length, 1); assert.equal(view.log[0].measured.label, '+1.30');
  const before = view.log.length; game.move('d4'); watcher.decision(value);
  assert.equal(view.log.length, before, 'pre-move receipt cannot describe child board');
  watcher.stop();
});

test('unavailable/invalid CDB means unknown, or current SF with typed mate distance, never invented zero', async () => {
  const game = new Chess(), view = viewFor(game);
  const watcher = Eval.watchSimulation({ Chess, game, view, getCDB: async fen => ({ fen, moves: [{ move: 'a1a8', score: 1000 }] }) });
  watcher.start(); await flush();
  assert.equal(view.log.at(-1).measured.label, '—');
  watcher.decision(sfDecision(game, 29995, { score_type: 'mate', raw_best_mate_in: 3 }));
  assert.equal(view.log.at(-1).measured.label, '#3');
  game.move('e4'); watcher.position(); await flush();
  watcher.decision(sfDecision(game, 29995, { score_type: 'mate', raw_best_mate_in: 2 }));
  assert.equal(view.log.at(-1).measured.label, '−#2');
  assert.equal(view.log.at(-1).source, 'SF');
  watcher.stop();
});

test('terminal mate/draw render from game state with no unnecessary spectator request', () => {
  const game = new Chess(); ['f3', 'e5', 'g4', 'Qh4#'].forEach(m => game.move(m));
  let rendered = 0, requests = 0;
  const view = viewFor(game); view.render = () => rendered++;
  const watcher = Eval.watchSimulation({ Chess, game, view, getCDB: async () => { requests++; return {}; } });
  watcher.start();
  assert.equal(Eval.measure(game.fen(), null, 'mate').white, 0);
  assert.equal(rendered, 1); assert.equal(requests, 0);
  watcher.stop(); game.load('8/8/8/8/8/8/5k2/7K w - - 0 1'); watcher.start();
  assert.equal(Eval.measure(game.fen(), null, 'draw').label, '0.00');
  assert.equal(rendered, 2); assert.equal(requests, 0); watcher.stop();
});

test('actual SF-depth-5 vs CDB/SF runner updates spectator every ply without changing decision budgets', { timeout: 5000 }, async () => {
  const game = new Chess(), view = viewFor(game), ids = { n: 0 }, runs = new Map(), events = new Map(), storageData = new Map();
  const requests = [], sfBudgets = [], decisions = [];
  const getCDB = async (fen, options) => {
    requests.push({ fen, actor: !!options.signal, timeout: options.timeoutMs });
    const parts = fen.split(' '), ply = (Number(parts[5]) - 1) * 2 + (parts[1] === 'b' ? 1 : 0);
    const whiteCp = 25 - 80 * ply;
    return best(fen, whiteCp * (parts[1] === 'b' ? -1 : 1));
  };
  const snapshot = () => ({ mode: 'elapsed', remaining: { w: 0, b: 0 }, used: { w: 0, b: 0 }, turnSpent: 2, flagged: null });
  const workspace = { start() {}, restoreClock() {}, beginTurn() {}, endTurn: snapshot, clockSnapshot: snapshot,
    recordMove: () => ({ think_ms: 2, after: snapshot(), at_utc: new Date().toISOString() }) };
  const store = { createId: prefix => prefix + (++ids.n), ready: async () => {}, saveRun: async r => runs.set(r.id, r),
    saveEvent: async e => events.set(e.id, e), getRun: async id => runs.get(id), getEvent: async id => events.get(id) };
  const storage = { getItem: k => storageData.get(k) || null, setItem: (k,v) => storageData.set(k,v), removeItem: k => storageData.delete(k) };
  const SF = { create: () => ({ prepare: async () => {}, destroy() {}, ledger: { rootDepth: 5 },
    root: async (fen, options) => { sfBudgets.push(options.depth); return { ...best(fen, -7), complete: true }; } }) };
  const DCC = { config: () => ({}), play: (g, m) => g.move({ from: m.slice(0,2), to: m.slice(2,4), promotion: m[4] }) };
  let runner;
  runner = Runner.create({ Chess, SIM, SF, DCC, game, workspace, store, storage, getCDB, settings: () => ({}),
    evaluation: { watchSimulation: options => Eval.watchSimulation({ ...options, view }) },
    callbacks: { decision(value) { decisions.push(value); }, move(run) { if (run.trace.length === 6) void runner.pause('fixture bound'); } } });
  await runner.start({ format: 'single', white: 'sf', black: 'raw', depth: 5, movePauseMs: 15 }, [{ id: 'start', startFen: game.fen() }]);
  await runner.settled(); await flush();
  assert.equal(decisions.length, 6); assert.deepEqual(sfBudgets, [5,5,5]);
  assert(decisions.every((d,i) => d.pick.actual_provider === (i%2 ? 'CDB' : 'SF')));
  const cdbPositions = new Map(view.log.filter(row => row.source === 'CDB').map(row => [row.fen, row.measured.label]));
  for (let i=0; i<6; i++) {
    const expected = (25 - 80*i) / 100;
    assert.equal(cdbPositions.get(decisions[i].fen), (expected>0?'+':'')+expected.toFixed(2), `ply ${i}`);
  }
  assert(requests.filter(r => r.actor).every(r => r.timeout === 5000));
  assert(requests.filter(r => !r.actor).every(r => r.timeout === 3500));
  assert.equal(runner.busy(), false);
});
