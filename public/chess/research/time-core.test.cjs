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
