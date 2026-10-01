'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { IDBFactory } = require('fake-indexeddb');
const Migration = require('../js/8zc-lab-storage.js');
const SimStore = require('../js/8zc-sim-store.js');
function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { values, getItem: key => values.has(key) ? values.get(key) : null,
    setItem(key, value) { values.set(key, String(value)); }, removeItem(key) { values.delete(key); } };
}
function locks() {
  let queue = Promise.resolve();
  return { names: [], request(name, options, fn) { this.names.push(name); const task = queue.then(typeof options === 'function' ? options : fn); queue = task.catch(() => {}); return task; } };
}
async function db(idb, name, records = {}, version = 1) {
  return new Promise((resolve, reject) => {
    const request = idb.open(name, version);
    request.onupgradeneeded = () => { for (const key of Object.keys(records)) request.result.createObjectStore(key, { keyPath: 'id' }); };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result, stores = Object.keys(records);
      if (!stores.length) return resolve(database);
      const tx = database.transaction(stores, 'readwrite');
      for (const key of stores) records[key].forEach(value => tx.objectStore(key).put(value));
      tx.oncomplete = () => resolve(database); tx.onerror = () => reject(tx.error);
    };
  });
}
async function records(idb, name, store) {
  const database = await db(idb, name);
  return new Promise((resolve, reject) => {
    const req = database.transaction(store).objectStore(store).getAll();
    req.onsuccess = () => { database.close(); resolve(req.result); }; req.onerror = () => reject(req.error);
  });
}
function setup(initial) { return { localStorage: storage(initial), indexedDB: new IDBFactory(), locks: locks(), timeoutMs: 1000 }; }
const K = Migration.KEYS, D = Migration.DATABASES;

test('copies all legacy local data, isolates credentials, and never changes the source', async () => {
  const values = Object.fromEntries(Migration.LOCAL.map(([key], i) => [key, 'source ' + i]));
  values['8zc.evidence.v1'] = '[]';
  values['ChessBest-sim-v1-fallback'] = JSON.stringify({ schema: 'chess-sim-archive', version: 1, runs: [], events: [] });
  const env = setup(values), before = new Map(env.localStorage.values), migration = Migration.create(env);
  assert.equal((await migration.ready).complete, true);
  for (const [old, next] of Migration.LOCAL) { assert.equal(env.localStorage.getItem(next), values[old]); assert.equal(env.localStorage.getItem(old), before.get(old)); }
  assert.ok(env.locks.names.every(name => name === K.studies));
  const receipt = env.localStorage.getItem(K.migration);
  assert.ok(!receipt.includes(values.chessBestLichessToken));
  assert.ok(!receipt.includes(values.chessBestAnthropicKey));
});

test('existing LAB values including empty strings win; completed migration never resurrects deletions', async () => {
  const env = setup({ chessLabGame: 'irrelevant', 'chessLabGame-v8': 'old game', [K.game]: '', 'chessLabStudy-v1': '{"studies":[1]}', [K.studies]: '{"studies":[]}' });
  await Migration.create(env).ready;
  assert.equal(env.localStorage.getItem(K.game), '');
  assert.equal(env.localStorage.getItem(K.studies), '{"studies":[]}');
  env.localStorage.removeItem(K.game); env.localStorage.removeItem(K.studies);
  await Migration.create(env).ready;
  assert.equal(env.localStorage.getItem(K.game), null); assert.equal(env.localStorage.getItem(K.studies), null);
});

test('quota failure blocks boot, retains source and completed copies, and resumes without overwriting', async () => {
  const env = setup({ 'chessLabSettings-v8': '{"depth":11}', 'chessLabGame-v8': '1. e4 e5' });
  const original = env.localStorage.setItem.bind(env.localStorage); let full = true;
  env.localStorage.setItem = (key, value) => { if (full && key === K.game) throw new DOMException('full', 'QuotaExceededError'); original(key, value); };
  const migration = Migration.create(env);
  await assert.rejects(migration.ready, /share that quota/);
  assert.equal(migration.status().complete, false);
  assert.equal(env.localStorage.getItem('chessLabGame-v8'), '1. e4 e5');
  original(K.settings, '{"depth":21}'); full = false;
  await migration.retry();
  assert.equal(env.localStorage.getItem(K.settings), '{"depth":21}');
  assert.equal(env.localStorage.getItem(K.game), '1. e4 e5');
});

test('two first-run tabs serialize on the Studies Web Lock and see one migration receipt', async () => {
  const env = setup({ 'chessLabStudy-v1': '{"studies":[]}' }); let writes = 0;
  const original = env.localStorage.setItem.bind(env.localStorage);
  env.localStorage.setItem = (key, value) => { if (key === K.studies) writes++; original(key, value); };
  const first = Migration.create(env), second = Migration.create(env);
  await Promise.all([first.ready, second.ready]); assert.equal(writes, 1);
  assert.equal(first.status().complete, true); assert.equal(second.status().complete, true);
});

test('missing legacy databases are never created, including no-databases() browsers', async () => {
  for (const listing of [true, false]) {
    const env = setup(); const enumerate = env.indexedDB.databases.bind(env.indexedDB);
    if (!listing) env.indexedDB.databases = undefined;
    await Migration.create(env).ready;
    assert.deepEqual(await enumerate(), []);
  }
});

test('IDB source version/schema remains untouched and existing LAB IDs win', async () => {
  const env = setup();
  (await db(env.indexedDB, 'ChessDCC-evidence', { snapshots: [{ id: 'same', n: 'old' }, { id: 'new', n: 42 }] }, 4)).close();
  (await db(env.indexedDB, D.evidence, { snapshots: [{ id: 'same', n: 'LAB' }] })).close();
  const runs = [{ id: 'g1', state: 'paused', trace: [] }], events = [{ id: 'e1', games: [{ runId: 'g1' }] }];
  (await db(env.indexedDB, 'ChessBest-sim-v1', { runs, events })).close();
  await Migration.create(env).ready;
  assert.deepEqual(await records(env.indexedDB, D.evidence, 'snapshots'), [{ id: 'new', n: 42 }, { id: 'same', n: 'LAB' }]);
  assert.deepEqual(await records(env.indexedDB, D.sim, 'runs'), runs);
  assert.deepEqual(await records(env.indexedDB, D.sim, 'events'), events);
  const source = await new Promise((resolve, reject) => { const req = env.indexedDB.open('ChessDCC-evidence'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  assert.equal(source.version, 4); source.close();
  assert.equal((await env.indexedDB.databases()).find(item => item.name === 'ChessDCC-evidence').version, 4);
});

test('a pre-existing intentionally empty LAB database stays empty', async () => {
  const env = setup();
  (await db(env.indexedDB, 'ChessDCC-evidence', { snapshots: [{ id: 'source' }] })).close();
  (await db(env.indexedDB, D.evidence, { snapshots: [] })).close();
  await Migration.create(env).ready;
  assert.deepEqual(await records(env.indexedDB, D.evidence, 'snapshots'), []);
});

test('live legacy lease is not copied and checkpoint is retained without takeover', async () => {
  const value = JSON.stringify({ schema: 'chess-sim-checkpoint', version: 1, savedAt: new Date().toISOString(), records: [{ kind: 'runs', value: { id: 'g' }, revision: 1 }] });
  const lease = JSON.stringify({ owner: 'CURRENT-tab', expires: Date.now() + 100000 });
  const env = setup({ 'ChessBest-sim-v1-checkpoint': value, 'chessSimRunnerLease-v1': lease });
  const result = await Migration.create(env).ready;
  assert.equal(env.localStorage.getItem(K.simLease), null);
  assert.equal(env.localStorage.getItem(K.simCheckpoint), null);
  assert.equal(env.localStorage.getItem(K.simLegacyCheckpoint), value);
  assert.equal(env.localStorage.getItem('chessSimRunnerLease-v1'), lease);
  assert.ok(result.warnings.some(item => /still running/.test(item)));
});

test('expired runner checkpoint copies only into a fresh LAB, with no runner lease', async () => {
  const value = JSON.stringify({ schema: 'chess-sim-checkpoint', version: 1, savedAt: new Date().toISOString(), records: [] });
  const env = setup({ 'ChessBest-sim-v1-checkpoint': value });
  await Migration.create(env).ready;
  assert.equal(env.localStorage.getItem(K.simCheckpoint), value);
  assert.equal(env.localStorage.getItem('ChessBest-sim-v1-checkpoint'), value);
});

test('missing Web Locks or unavailable IDB blocks safely, and retry count is bounded', async () => {
  const env = setup({ 'chessLabGame-v8': 'original' }); env.locks = null;
  const migration = Migration.create(env);
  await assert.rejects(migration.ready, /Web Locks/);
  await assert.rejects(migration.retry()); await assert.rejects(migration.retry());
  await assert.rejects(migration.retry(), /Three migration attempts/);
  assert.equal(env.localStorage.getItem(K.game), null);
  const unavailable = setup(); unavailable.indexedDB = null;
  await assert.rejects(Migration.create(unavailable).ready, /IndexedDB is unavailable/);
});

test('copied SIM fallback cannot overwrite a newer existing LAB record even with misleading timestamp', async () => {
  const existing = { id: 'same', label: 'LAB', updatedAt: '2020-01-01T00:00:00Z' };
  const legacy = { id: 'same', label: 'CURRENT', updatedAt: '2030-01-01T00:00:00Z' };
  const fallback = JSON.stringify({ schema: 'chess-sim-archive', version: 1, runs: [legacy, { id: 'extra' }], events: [] });
  const env = setup({ 'ChessBest-sim-v1-fallback': fallback });
  (await db(env.indexedDB, D.sim, { runs: [existing], events: [] })).close();
  await Migration.create(env).ready;
  const store = SimStore.create(env); await store.ready();
  assert.equal((await store.getRun('same')).label, 'LAB');
  assert.equal((await store.getRun('extra')).id, 'extra');
  assert.equal(env.localStorage.getItem('ChessBest-sim-v1-fallback'), fallback);
  await store.close();
});

test('fallback-only evidence and SIM archives are visible in the LAB databases after migration', async () => {
  const snapshots = [{ id: 'evidence-fallback', payload: { arbitrary: 'preserved' } }];
  const runs = [{ id: 'fallback-run', trace: [] }];
  const env = setup({ '8zc.evidence.v1': JSON.stringify(snapshots), 'ChessBest-sim-v1-fallback': JSON.stringify({ schema: 'chess-sim-archive', version: 1, runs, events: [] }) });
  await Migration.create(env).ready;
  assert.deepEqual(await records(env.indexedDB, D.evidence, 'snapshots'), snapshots);
  assert.deepEqual(await records(env.indexedDB, D.sim, 'runs'), runs);
  assert.equal(env.localStorage.getItem('8zc.evidence.v1'), JSON.stringify(snapshots));
});

test('empty existing LAB archives do not resurrect legacy fallbacks during normal store boot', async () => {
  const simFallback = JSON.stringify({ schema: 'chess-sim-archive', version: 1, runs: [{ id: 'old-game' }], events: [] });
  const env = setup({ '8zc.evidence.v1': '[{"id":"old-evidence"}]', 'ChessBest-sim-v1-fallback': simFallback });
  (await db(env.indexedDB, D.sim, { runs: [], events: [] })).close();
  (await db(env.indexedDB, D.evidence, { snapshots: [] })).close();
  await Migration.create(env).ready;
  const store = SimStore.create(env); await store.ready();
  assert.deepEqual(await store.listRuns(), []);
  assert.deepEqual(await records(env.indexedDB, D.evidence, 'snapshots'), []);
  assert.equal(env.localStorage.getItem(K.simFallback), null);
  assert.equal(env.localStorage.getItem(K.simLegacyFallback), simFallback);
  assert.equal(env.localStorage.getItem(K.evidenceLegacyFallback), '[{"id":"old-evidence"}]');
  await store.close();
});

test('IDB transaction failure never reports completion, retains legacy records, and resumes', async () => {
  const env = setup();
  (await db(env.indexedDB, 'ChessDCC-evidence', { snapshots: [{ id: 'one', value: 1 }] })).close();
  const originalOpen = env.indexedDB.open.bind(env.indexedDB); let deny = true;
  env.indexedDB.open = (name, ...args) => {
    const request = originalOpen(name, ...args);
    if (name === D.evidence) request.addEventListener('success', () => {
      if (!deny) return;
      const database = request.result, transaction = database.transaction.bind(database);
      database.transaction = (stores, mode) => {
        const tx = transaction(stores, mode);
        if (mode === 'readwrite') queueMicrotask(() => tx.abort());
        return tx;
      };
    });
    return request;
  };
  const migration = Migration.create(env); await assert.rejects(migration.ready, /did not commit/);
  assert.equal(migration.status().complete, false);
  assert.deepEqual(await records(env.indexedDB, 'ChessDCC-evidence', 'snapshots'), [{ id: 'one', value: 1 }]);
  deny = false; await migration.retry();
  assert.deepEqual(await records(env.indexedDB, D.evidence, 'snapshots'), [{ id: 'one', value: 1 }]);
});

test('crash after fallback copy before receipt resumes provenance and activates fallback-only evidence', async () => {
  const snapshots = [{ id: 'fallback-only', payload: { note: 'retained' } }];
  const env = setup({ '8zc.evidence.v1': JSON.stringify(snapshots) });
  (await db(env.indexedDB, 'ChessDCC-evidence', { snapshots: [{ id: 'durable' }] })).close();
  const original = env.localStorage.setItem.bind(env.localStorage); let crash = true;
  env.localStorage.setItem = (key, value) => {
    if (crash && key === K.migration && env.localStorage.getItem(K.evidenceFallback) !== null) throw Error('simulated crash after copy');
    original(key, value);
  };
  const migration = Migration.create(env); await assert.rejects(migration.ready, /simulated crash/);
  assert.equal(JSON.parse(env.localStorage.getItem(K.migration)).local[K.evidenceFallback], 'copying');
  crash = false; await migration.retry();
  assert.deepEqual((await records(env.indexedDB, D.evidence, 'snapshots')).map(value => value.id), ['durable', 'fallback-only']);
  assert.equal(env.localStorage.getItem('8zc.evidence.v1'), JSON.stringify(snapshots));
});

test('a fresh LAB takes newer legacy SIM fallback progress before merging, while source stores stay unchanged', async () => {
  const durable = { id: 'same-run', progress: 100, updatedAt: '2026-09-25T00:00:00Z' };
  const fallback = { ...durable, progress: 200, updatedAt: '2026-09-26T00:00:00Z' };
  const env = setup({ 'ChessBest-sim-v1-fallback': JSON.stringify({ schema: 'chess-sim-archive', version: 1, runs: [fallback], events: [] }) });
  (await db(env.indexedDB, 'ChessBest-sim-v1', { runs: [durable], events: [] })).close();
  await Migration.create(env).ready;
  assert.deepEqual(await records(env.indexedDB, D.sim, 'runs'), [fallback]);
  assert.deepEqual(await records(env.indexedDB, 'ChessBest-sim-v1', 'runs'), [durable]);
});

test('pre-existing LAB fallback owns duplicate IDs and intentional emptiness without any LAB database', async () => {
  for (const saved of [[], [{ id: 'same', label: 'LAB', updatedAt: '2020-01-01T00:00:00Z' }]]) {
    const text = JSON.stringify({ schema: 'chess-sim-archive', version: 1, runs: saved, events: [] });
    const env = setup({ [K.simFallback]: text });
    (await db(env.indexedDB, 'ChessBest-sim-v1', { runs: [{ id: 'same', label: 'CURRENT', updatedAt: '2030-01-01T00:00:00Z' }], events: [] })).close();
    await Migration.create(env).ready;
    const store = SimStore.create(env); await store.ready();
    assert.deepEqual((await store.listRuns()).map(value => ({ id: value.id, label: value.label })), saved.map(value => ({ id: value.id, label: value.label })));
    assert.equal((await records(env.indexedDB, 'ChessBest-sim-v1', 'runs'))[0].label, 'CURRENT');
    await store.close();
  }
});
