const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/8zc-sim-store.js');
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), values };
}
const fallback = saved => S.create({ indexedDB: null, localStorage: saved, locks: null });
function run(id = 'game-1', extra = {}) { return { id, state: 'running', trace: [], pgn: '[Event "Test"]\n\n*', ...extra }; }

test('serial saves capture each move and archive survives a new connection', async () => {
  const saved = storage(), store = fallback(saved), game = run();
  const first = store.saveRun(game);
  game.trace.push({ move: 'e2e4' });
  const second = store.saveRun(game);
  game.trace.push({ move: 'e7e5' });
  assert.equal((await first).trace.length, 0);
  assert.equal((await second).trace.length, 1);
  const reopened = fallback(saved), restored = await reopened.getRun(game.id);
  assert.equal(restored.trace.length, 1);
  restored.trace.length = 0;
  assert.equal((await reopened.getRun(game.id)).trace.length, 1);
  assert.equal(reopened.status().mode, 'localStorage');
  assert.match(reopened.status().warning, /IndexedDB/);
});

test('conflicting tab writes reject and a later explicit read permits continuing', async () => {
  const saved = storage(), one = fallback(saved), two = fallback(saved);
  await one.saveRun(run());
  const stale = await two.getRun('game-1');
  await one.saveRun(run('game-1', { result: '1-0' }));
  await assert.rejects(two.saveRun(stale), /another tab/);
  const current = await two.getRun('game-1');
  current.note = 'reviewed'; await two.saveRun(current);
  assert.equal((await one.getRun('game-1')).result, '1-0');
});

test('JSON import preserves originals and reconnects colliding event and game IDs', async () => {
  const store = fallback(storage());
  await store.saveEvent({ id: 'event-1', games: [{ id: 'slot-1', runId: 'game-1' }] });
  await store.saveRun(run('game-1', { eventId: 'event-1', result: '1-0' }));
  const original = await store.exportJSON(), result = await store.importJSON(original);
  assert.deepEqual([result.runs, result.events], [1, 1]);
  assert.notEqual(result.idMap.runs['game-1'], 'game-1');
  const copy = await store.getRun(result.idMap.runs['game-1']);
  const event = await store.getEvent(result.idMap.events['event-1']);
  assert.equal(copy.eventId, event.id);
  assert.equal(event.games[0].runId, copy.id);
  assert.equal((await store.getRun('game-1')).eventId, 'event-1');
  assert.equal((await store.listRuns()).length, 2);
  await assert.rejects(store.importJSON(original.replace('"schema": "chess-sim-archive"', '"schema": "wrong"')), /Unsupported/);
  assert.equal((await store.listRuns()).length, 2);
});

test('invalid and unsafe imports do not mutate existing data; quota errors are explicit', async () => {
  const saved = storage(), store = fallback(saved);
  await store.saveRun(run());
  const exported = JSON.parse(await store.exportJSON());
  exported.runs.push(exported.runs[0]);
  await assert.rejects(store.importJSON(JSON.stringify(exported)), /Duplicate/);
  await assert.rejects(store.importJSON('{"schema":"chess-sim-archive","version":1,"runs":[{"id":"x","__proto__":{"polluted":true}}],"events":[]}'), /Unsafe/);
  assert.equal({}.polluted, undefined);
  assert.equal((await store.listRuns()).length, 1);
  saved.setItem = () => { throw Error('QuotaExceededError'); };
  await assert.rejects(store.saveRun(run('game-2')), /not saved.*Quota/);
  assert.equal((await store.listRuns()).length, 1);
});

test('checkpoint recovers a thinking turn after reload, respecting an active runner lease', async () => {
  const saved = storage(), store = fallback(saved);
  await store.saveRun(run());
  saved.setItem('chessSimRunnerLease-v1', JSON.stringify({ owner: 'tab-a', expires: Date.now() + 30000 }));
  store.checkpointSync(run('game-1', { remainingMs: 17000 }), null);
  const other = fallback(saved); await other.ready();
  assert.equal((await other.getRun('game-1')).remainingMs, undefined);
  assert.equal((await other.recoverCheckpoint('tab-b')).activeElsewhere, true);
  assert.equal((await other.recoverCheckpoint('tab-a')).recovered, 1);
  assert.equal((await other.getRun('game-1')).remainingMs, 17000);
});

test('a stale checkpoint cannot replace a newer durable game or imported replacement', async () => {
  const saved = storage(), store = fallback(saved);
  await store.saveRun(run());
  store.checkpointSync(run('game-1', { remainingMs: 5000 }));
  await store.saveRun(run('game-1', { result: '1-0', state: 'complete' }));
  const reopened = fallback(saved); await reopened.ready();
  assert.equal((await reopened.getRun('game-1')).state, 'complete');
  assert.equal((await reopened.getRun('game-1')).remainingMs, undefined);
});

test('generated IDs do not collide in a batch', () => {
  const ids = Array.from({ length: 1000 }, () => S.createId('game'));
  assert.equal(new Set(ids).size, ids.length);
});

const { IDBFactory } = require('fake-indexeddb');
test('IndexedDB commits each saved turn, restores after closing, and imports linked records atomically', async () => {
  const idb = new IDBFactory(), saved = storage();
  const options = { indexedDB: idb, localStorage: saved, locks: null };
  const first = S.create(options); await first.ready();
  assert.equal(first.status().mode, 'indexedDB');
  await first.saveEvent({ id: 'cup', games: [{ id: 'slot', runId: 'round-1' }] });
  await first.saveRun(run('round-1', { eventId: 'cup', trace: [{ move: 'e2e4' }] }));
  const text = await first.exportJSON(); await first.close();
  const reopened = S.create(options), game = await reopened.getRun('round-1');
  assert.equal(game.trace[0].move, 'e2e4');
  const imported = await reopened.importJSON(text);
  const eventCopy = await reopened.getEvent(imported.idMap.events.cup);
  assert.equal(eventCopy.games[0].runId, imported.idMap.runs['round-1']);
  const invalid = JSON.parse(text); invalid.runs[0].eventId = 'missing';
  await assert.rejects(reopened.importJSON(JSON.stringify(invalid)), /absent/);
  assert.equal((await reopened.listRuns()).length, 2);
  assert.equal(saved.values.size, 0);
  await reopened.close();
});

test('IndexedDB concurrent connections cannot overwrite a newer archived turn', async () => {
  const idb = new IDBFactory(), options = { indexedDB: idb, localStorage: storage(), locks: null };
  const one = S.create(options), two = S.create(options);
  await one.saveRun(run());
  const stale = await two.getRun('game-1');
  await one.saveRun(run('game-1', { trace: [{ move: 'e2e4' }] }));
  await assert.rejects(two.saveRun(stale), /another tab/);
  assert.equal((await two.getRun('game-1')).trace.length, 1);
  await one.close(); await two.close();
});

test('IndexedDB recovery atomically restores an event and its current game from the journal', async () => {
  const idb = new IDBFactory(), saved = storage(), options = { indexedDB: idb, localStorage: saved, locks: null };
  const one = S.create(options);
  await one.saveEvent({ id: 'cup', state: 'running', games: [{ id: 'slot', runId: 'round-1' }] });
  await one.saveRun(run('round-1', { eventId: 'cup' }));
  one.checkpointSync(run('round-1', { eventId: 'cup', remainingMs: 12500 }), { id: 'cup', games: [{ id: 'slot', runId: 'round-1', state: 'running' }], nextIndex: 0 });
  await one.close();
  const reopened = S.create(options); await reopened.ready();
  assert.equal((await reopened.getRun('round-1')).remainingMs, 12500);
  assert.equal((await reopened.getEvent('cup')).games[0].state, 'running');
  assert.equal(saved.getItem('ChessBest-sim-v1-checkpoint'), null);
  await reopened.close();
});

test('fallback archive migrates into IndexedDB on recovery without replacing newer existing games', async () => {
  const idb = new IDBFactory(), saved = storage(), options = { indexedDB: idb, localStorage: saved, locks: null };
  const original = S.create(options);
  await original.saveRun(run('shared', { state: 'complete', result: '1-0' }));
  await original.close();
  const temporary = fallback(saved);
  await temporary.saveEvent({ id: 'fallback-cup', games: [{ id: 'slot', runId: 'fallback-game' }] });
  await temporary.saveRun(run('fallback-game', { eventId: 'fallback-cup', trace: [{ move: 'e2e4' }] }));
  await temporary.saveRun(run('shared', { state: 'paused', result: '*' }));
  const text = JSON.parse(saved.getItem('ChessBest-sim-v1-fallback'));
  text.runs.find(item => item.id === 'shared').updatedAt = '2000-01-01T00:00:00.000Z';
  saved.setItem('ChessBest-sim-v1-fallback', JSON.stringify(text));
  const restored = S.create(options); await restored.ready();
  assert.equal(restored.status().mode, 'indexedDB');
  assert.equal((await restored.listRuns()).length, 2);
  assert.equal((await restored.getRun('shared')).result, '1-0');
  assert.equal((await restored.getRun('fallback-game')).trace[0].move, 'e2e4');
  assert.equal((await restored.getEvent('fallback-cup')).games[0].runId, 'fallback-game');
  assert.equal(saved.getItem('ChessBest-sim-v1-fallback'), null);
  await restored.close();
  const reloaded = S.create(options);
  assert.equal((await reloaded.listRuns()).length, 2);
  await reloaded.close();
});
