const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const base = path.resolve(__dirname, '..');

function setup(t, { pgn, timing } = {}) {
  const dom = new JSDOM(fs.readFileSync(path.join(base, 'index.html'), 'utf8'), {
    url: 'https://bd-chess.github.io/bd-chessdb/chess/new/', runScripts: 'outside-only'
  });
  const w = dom.window; t.after(() => w.close());
  let wall = 0, running = true;
  Object.defineProperty(w.performance, 'now', { value: () => wall });
  w.setInterval = () => 0;
  for (const file of ['chess.min.js', '8zc-time-core.js', '8zc-workspace.js']) w.eval(fs.readFileSync(path.join(base, 'js', file), 'utf8'));
  const game = new w.Chess(); if (pgn) assert(game.load_pgn(pgn));
  if (timing) w.localStorage.setItem('chessLabTiming-v1', timing);
  const workspace = w.ChessWorkspace.create({ Chess: w.Chess, game, settings: { showTimers: true },
    onDisplaySettings() {}, analyze: async () => null, onAnnotations() {}, isBusy: () => false,
    isSimulationRunning: () => running, stopActivities() {} });
  return { w, game, workspace, advance(ms) { wall += ms; }, setRunning(value) { running = value; },
    get(id) { return w.document.getElementById(id); } };
}

test('simulation clocks exclude setup, MovePause and board rendering between both sides', t => {
  const x = setup(t), ws = x.workspace;
  ws.start('sim', { baseMs: 60000, incrementMs: 2000 });
  x.advance(5000); ws.render(); assert.equal(ws.clockSnapshot().remaining.w, 60000);
  assert(ws.beginTurn()); x.advance(3500); const end = ws.endTurn();
  assert.equal(end.remaining.w, 56500); assert.equal(end.running, false);
  x.advance(7000); ws.render(); const fen = x.game.fen(), move = x.game.move('e4');
  const row = ws.recordMove(fen, move);
  assert.equal(row.think_ms, 3500); assert.equal(row.clock_ms, 58500);
  x.advance(9000); ws.render(); assert.equal(ws.clockSnapshot().remaining.b, 60000);
  assert(ws.beginTurn()); x.advance(1500); ws.endTurn();
  const replyFen = x.game.fen(), reply = x.game.move('e5'); x.advance(3000);
  assert.equal(ws.recordMove(replyFen, reply).clock_ms, 60500);
  assert.equal(ws.clockSnapshot().running, false);
  assert.match(x.get('timerCaption').textContent, /time remaining/);
});

test('simulation reload and same-run resume retain clock totals, partial turn and recorded PGN times', t => {
  const x = setup(t), ws = x.workspace;
  ws.start('sim', { baseMs: 30000, incrementMs: 1000 });
  ws.beginTurn(); x.advance(2000); ws.endTurn();
  const fen = x.game.fen(), move = x.game.move('e4'); ws.recordMove(fen, move);
  ws.beginTurn(); x.advance(3000); ws.endTurn();
  const saved = JSON.parse(JSON.stringify(ws.clockSnapshot()));
  const y = setup(t, { pgn: x.game.pgn(), timing: x.w.localStorage.getItem('chessLabTiming-v1') });
  y.workspace.restoreClock(saved); y.advance(86400000); y.workspace.render();
  assert.equal(y.workspace.clockSnapshot().remaining.b, 27000);
  assert.equal(y.workspace.clockSnapshot().running, false);
  assert.match(y.workspace.pgnTime(0, y.game.history({ verbose: true })[0], fen), /\[%emt 2\.000\]/);
  y.workspace.beginTurn(); y.advance(4000); y.workspace.endTurn();
  const replyFen = y.game.fen(), reply = y.game.move('e5'); y.advance(1000);
  const row = y.workspace.recordMove(replyFen, reply);
  assert.equal(row.think_ms, 7000); assert.equal(row.clock_ms, 24000);
  assert.equal(y.workspace.clockSnapshot().remaining.w, 29000);
  assert.throws(() => y.workspace.restoreClock(saved), /does not match the board turn/);
});

test('human countdown still starts immediately, runs through move display, and preserves pause behavior', async t => {
  const x = setup(t), ws = x.workspace;
  ws.start('human', { seconds: 60, increment: 2 });
  x.advance(5000); assert(ws.beforeMove());
  const fen = x.game.fen(), move = x.game.move('e4');
  assert.equal(ws.recordMove(fen, move).clock_ms, 57000);
  x.advance(2000); assert.equal(ws.clockSnapshot().remaining.b, 58000);
  ws.pause(); x.advance(9000); assert.equal(ws.beforeMove(), false);
  assert.equal(ws.clockSnapshot().remaining.b, 58000);
  assert.equal(x.get('workspaceTimers').hidden, false);
  await Promise.resolve();
});

test('review after a timed engine game permits new moves without changing the expired checkpoint', t => {
  const x = setup(t), ws = x.workspace;
  ws.start('sim', { baseMs: 1000, incrementMs: 2000 });
  ws.beginTurn(); x.advance(1200);
  const finished = ws.endTurn(); assert.equal(finished.flagged, 'w');
  x.setRunning(false); ws.stop(); x.advance(5000);
  assert(ws.beforeMove());
  const fen = x.game.fen(), move = x.game.move('e4');
  assert(ws.recordMove(fen, move));
  assert.equal(ws.clockSnapshot().mode, 'elapsed'); assert.equal(ws.clockSnapshot().flagged, null);
  assert.equal(x.get('workspaceTimers').hidden, true);
  assert.equal(finished.flagged, 'w'); assert.equal(finished.remaining.w, 0);
});
