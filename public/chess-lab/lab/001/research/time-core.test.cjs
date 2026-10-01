const { test } = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/8zc-time-core.js');
const DCC = require('../js/8zc-dcc-core.js');
const { Chess } = require('../js/chess.min.js');

test('elapsed simulation includes long API waits without flagging either side', () => {
  const c = T.create({ now: 100 });
  const r = T.move(c, 'w', 'b', 300100, '2026-09-12T12:05:00.000Z');
  assert.equal(r.think_ms, 300000); assert.equal(c.flagged, null);
  T.tick(c, 900100); assert.deepEqual(c.used, { w: 300000, b: 600000 });
  assert.equal(c.running, true);
});
test('human increment is awarded once after a legal committed move; flag blocks late moves', () => {
  const c = T.create({ mode: 'countdown', seconds: 60, increment: 2 });
  const row = T.move(c, 'w', 'b', 5000, '2026-09-12T12:00:05.000Z');
  assert.equal(row.clock_ms, 57000); assert.equal(c.remaining.b, 60000);
  assert.equal(T.move(c, 'b', 'w', 65000, '2026-09-12T12:01:05.000Z'), null);
  assert.equal(c.flagged, 'b'); assert.equal(c.running, false);
});
test('paused time and repeated renders do not consume or duplicate player time', () => {
  const c = T.create({ mode: 'countdown', seconds: 60 });
  T.pause(c, 7000); T.tick(c, 100000); T.resume(c, 100000);
  assert.equal(T.snapshot(c, 103000).remaining.w, 50000);
  assert.equal(T.snapshot(c, 103000).remaining.w, 50000);
  assert.equal(c.remaining.w, 53000);
  const r = T.move(c, 'w', 'b', 103000, '2026-09-12T12:01:43.000Z');
  assert.equal(r.think_ms, 10000); assert.equal(r.clock_ms, 50000);
  assert.match(T.pgn(r), /\[%timestamp 2026-09-12T12:01:43.000Z\]/);
  assert.equal(T.pgn(null), '');
});
test('engine countdown charges computation only and increments once after the delay', () => {
  const c = T.create({ mode: 'countdown', seconds: 60, increment: 2, running: false });
  T.tick(c, 10000); assert.equal(c.remaining.w, 60000);
  T.resume(c, 10000); T.pause(c, 13500);
  T.tick(c, 18000); assert.equal(c.remaining.w, 56500);
  const row = T.move(c, 'w', 'b', 20000, '2026-09-25T15:00:00.000Z', { allowPaused: true, pauseAfter: true });
  assert.equal(row.think_ms, 3500); assert.equal(row.clock_ms, 58500);
  assert.equal(c.running, false); assert.equal(row.after.running, false);
  assert.equal(T.move(c, 'w', 'b', 20000, '', { allowPaused: true, pauseAfter: true }), null, 'the same move cannot earn increment twice');
  T.tick(c, 60000); assert.equal(c.remaining.b, 60000);
  T.resume(c, 60000); T.pause(c, 61500);
  const reply = T.move(c, 'b', 'w', 70000, '', { allowPaused: true, pauseAfter: true });
  assert.equal(reply.think_ms, 1500); assert.equal(reply.clock_ms, 60500);
  assert.deepEqual(c.used, { w: 3500, b: 1500 });
});
test('restored engine clocks preserve a partial turn without charging time away', () => {
  const c = T.create({ mode: 'countdown', seconds: 20, increment: 1, now: 500 });
  T.pause(c, 3500);
  const saved = JSON.parse(JSON.stringify(T.snapshot(c, 10000)));
  const restored = T.restore(saved, 7);
  T.tick(restored, 86400000); assert.equal(restored.remaining.w, 17000);
  T.resume(restored, 86400000); T.pause(restored, 86402000);
  const row = T.move(restored, 'w', 'b', 86408000, '', { allowPaused: true, pauseAfter: true });
  assert.equal(row.think_ms, 5000); assert.equal(row.clock_ms, 16000);
  assert.equal(saved.remaining.w, 17000, 'restoring does not mutate the checkpoint');
  assert.throws(() => T.restore({ ...saved, remaining: { w: -1, b: 20 } }), /Invalid saved clock/);
});
test('expired engine clocks cannot receive increment when a delayed result arrives', () => {
  const c = T.create({ mode: 'countdown', seconds: 1, increment: 5 });
  T.pause(c, 1200);
  assert.equal(c.flagged, 'w'); assert.equal(c.used.w, 1000);
  assert.equal(T.move(c, 'w', 'b', 9000, '', { allowPaused: true, pauseAfter: true }), null);
  assert.equal(c.remaining.w, 0); assert.equal(c.turn, 'w');
  const restored = T.restore(JSON.parse(JSON.stringify(c)), 0);
  T.resume(restored, 20); assert.equal(restored.running, false);
});
test('no-deadline DCC completes its requested probes even when CDB waits exceed 20 seconds', async () => {
  const realNow = Date.now; let wall = 0;
  Date.now = () => wall;
  try {
    const run = noDeadline => DCC.analyze({ Chess, fen: new Chess().fen(), settings: { dccDepth: 3, dccNoDeadline: noDeadline },
      moves: [{ move: 'e2e4', score: 0 }], getPV: async () => { wall += 30000; return { score: 0, depth: 20, pv: ['e7e5', 'g1f3'] }; },
      getScore: async () => { wall += 30000; return 0; } });
    const unlimited = await run(true); assert.equal(unlimited.receipt.status, 'complete'); assert.equal(unlimited.receipt.limited, false);
    wall = 0; const interactive = await run(false); assert.equal(interactive.receipt.limited, true);
  } finally { Date.now = realNow; }
});
