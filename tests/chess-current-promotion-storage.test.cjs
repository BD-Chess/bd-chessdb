'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');

// The chess research suite owns this optional test dependency.
const researchRequire = createRequire(path.resolve(__dirname, '../public/chess/new/research/package.json'));
const { IDBFactory } = researchRequire('fake-indexeddb');
const Migration = require('../public/chess/js/8zc-lab-storage.js');
const CURRENT = 'ChessBest:CURRENT:v2:';
const LAB = 'ChessBest:LAB:v2:';
const K = Migration.KEYS;
const D = Migration.DATABASES;

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  const writes = [];
  return {
    values, writes,
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem(key, value) { writes.push(['set', key]); values.set(key, String(value)); },
    removeItem(key) { writes.push(['remove', key]); values.delete(key); }
  };
}
function locks() {
  let queue = Promise.resolve();
  return {
    names: [],
    request(name, options, fn) {
      this.names.push(name);
      const task = queue.then(typeof options === 'function' ? options : fn);
      queue = task.catch(() => {});
      return task;
    }
  };
}
function setup(initial = {}) {
  return { localStorage: storage(initial), indexedDB: new IDBFactory(), locks: locks(), timeoutMs: 1000 };
}
async function seed(idb, name, stores, version = 1) {
  return new Promise((resolve, reject) => {
    const request = idb.open(name, version);
    request.onupgradeneeded = () => {
      for (const key of Object.keys(stores)) request.result.createObjectStore(key, { keyPath: 'id' });
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const tx = database.transaction(Object.keys(stores), 'readwrite');
      for (const [key, entries] of Object.entries(stores)) {
        entries.forEach(value => tx.objectStore(key).put(value));
      }
      tx.oncomplete = () => { database.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  });
}
async function read(idb, name, store) {
  return new Promise((resolve, reject) => {
    const request = idb.open(name);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const tx = database.transaction(store, 'readonly');
      const all = tx.objectStore(store).getAll();
      all.onsuccess = () => resolve(all.result);
      all.onerror = () => reject(all.error);
      tx.oncomplete = () => database.close();
    };
  });
}
function assertNoCrossChannelWrites(saved) {
  assert(saved.writes.every(([, key]) => key.startsWith(CURRENT)),
    'CURRENT migration must not mutate LAB, PWA, or stable legacy data');
}

test('CURRENT migration copies legacy bytes under its own namespace without changing LAB', async () => {
  assert.equal(K.studies, CURRENT + 'studies');
  assert.equal(D.evidence, CURRENT + 'evidence');
  assert.equal(D.sim, CURRENT + 'sim');
  const source = Object.fromEntries(Migration.LOCAL.map(([key], index) => [key, `old:${index}`]));
  source['8zc.evidence.v1'] = '[]';
  source['ChessBest-sim-v1-fallback'] = JSON.stringify({ schema: 'chess-sim-archive', version: 1, runs: [], events: [] });
  source[LAB + 'studies'] = 'independent LAB study bytes';
  source[LAB + 'game'] = 'independent LAB PGN';
  source['chessPwaLabStudy-v1'] = 'independent PWA study bytes';
  const env = setup(source), before = new Map(env.localStorage.values);
  const result = await Migration.create(env).ready;
  assert.equal(result.complete, true);
  for (const [old, target] of Migration.LOCAL) {
    assert.equal(env.localStorage.getItem(target), before.get(old), old);
    assert.equal(env.localStorage.getItem(old), before.get(old), old);
  }
  for (const [key, bytes] of before) assert.equal(env.localStorage.getItem(key), bytes, key);
  assert(env.locks.names.every(name => name === K.studies));
  assertNoCrossChannelWrites(env.localStorage);
});

test('older CURRENT game and settings are copied when the primary legacy keys are absent', async () => {
  const fallback = setup({
    chessBestGame: '1. c4 c5', chessBestSettings: '{"sfAnalysisDepth":17}',
    [LAB + 'game']: 'different LAB game', [LAB + 'settings']: '{"sfAnalysisDepth":25}'
  });
  await Migration.create(fallback).ready;
  assert.equal(fallback.localStorage.getItem(K.game), '1. c4 c5');
  assert.equal(fallback.localStorage.getItem(K.settings), '{"sfAnalysisDepth":17}');
  assert.equal(fallback.localStorage.getItem('chessBestGame'), '1. c4 c5');
  assert.equal(fallback.localStorage.getItem('chessBestSettings'), '{"sfAnalysisDepth":17}');
  assert.equal(fallback.localStorage.getItem(LAB + 'game'), 'different LAB game');
  assertNoCrossChannelWrites(fallback.localStorage);

  const primary = setup({
    'chessLabGame-v8': '1. d4 d5', chessBestGame: '1. c4 c5',
    'chessLabSettings-v8': '{"sfAnalysisDepth":11}', chessBestSettings: '{"sfAnalysisDepth":17}'
  });
  await Migration.create(primary).ready;
  assert.equal(primary.localStorage.getItem(K.game), '1. d4 d5');
  assert.equal(primary.localStorage.getItem(K.settings), '{"sfAnalysisDepth":11}');
  assert.equal(primary.localStorage.getItem('chessBestGame'), '1. c4 c5');
  assertNoCrossChannelWrites(primary.localStorage);
});

test('existing CURRENT values win; a completed receipt cannot resurrect later deletions', async () => {
  const env = setup({
    'chessLabGame-v8': '1. e4 e5', 'chessLabStudy-v1': '{"studies":[1]}',
    [K.game]: '', [K.studies]: '{"studies":[]}', [LAB + 'game']: 'LAB game'
  });
  await Migration.create(env).ready;
  assert.equal(env.localStorage.getItem(K.game), '');
  assert.equal(env.localStorage.getItem(K.studies), '{"studies":[]}');
  env.localStorage.removeItem(K.game);
  env.localStorage.removeItem(K.studies);
  await Migration.create(env).ready;
  assert.equal(env.localStorage.getItem(K.game), null);
  assert.equal(env.localStorage.getItem(K.studies), null);
  assert.equal(env.localStorage.getItem(LAB + 'game'), 'LAB game');
  assertNoCrossChannelWrites(env.localStorage);
});

test('quota failure keeps both channels intact and retries without overwriting a newer CURRENT value', async () => {
  const env = setup({ 'chessLabSettings-v8': '{"sfAnalysisDepth":11}', 'chessLabGame-v8': '1. d4', [LAB + 'game']: 'LAB-only' });
  const original = env.localStorage.setItem.bind(env.localStorage);
  let full = true;
  env.localStorage.setItem = (key, value) => {
    if (full && key === K.game) throw new DOMException('full', 'QuotaExceededError');
    original(key, value);
  };
  const manager = Migration.create(env);
  await assert.rejects(manager.ready);
  assert.equal(manager.status().complete, false);
  assert.equal(env.localStorage.getItem('chessLabGame-v8'), '1. d4');
  original(K.settings, '{"sfAnalysisDepth":21}');
  full = false;
  assert.equal((await manager.retry()).complete, true);
  assert.equal(env.localStorage.getItem(K.settings), '{"sfAnalysisDepth":21}');
  assert.equal(env.localStorage.getItem(K.game), '1. d4');
  assert.equal(env.localStorage.getItem(LAB + 'game'), 'LAB-only');
  assertNoCrossChannelWrites(env.localStorage);
});

test('simultaneous CURRENT first runs use one lock and leave source and LAB studies untouched', async () => {
  const env = setup({ 'chessLabStudy-v1': 'legacy studies', [LAB + 'studies']: 'LAB studies' });
  const [one, two] = [Migration.create(env), Migration.create(env)];
  await Promise.all([one.ready, two.ready]);
  assert.equal(env.localStorage.writes.filter(([, key]) => key === K.studies).length, 1);
  assert.equal(env.localStorage.getItem(K.studies), 'legacy studies');
  assert.equal(env.localStorage.getItem('chessLabStudy-v1'), 'legacy studies');
  assert.equal(env.localStorage.getItem(LAB + 'studies'), 'LAB studies');
  assertNoCrossChannelWrites(env.localStorage);
});

test('CURRENT archive copy preserves old and LAB databases, with existing CURRENT ID winning', async () => {
  const env = setup({ [LAB + 'studies']: 'LAB study' });
  await seed(env.indexedDB, 'ChessDCC-evidence', { snapshots: [{ id: 'same', value: 'old' }, { id: 'extra', value: 'old' }] }, 4);
  await seed(env.indexedDB, D.evidence, { snapshots: [{ id: 'same', value: 'CURRENT' }] });
  await seed(env.indexedDB, LAB + 'evidence', { snapshots: [{ id: 'same', value: 'LAB' }] });
  await seed(env.indexedDB, 'ChessBest-sim-v1', { runs: [{ id: 'run', value: 'old' }], events: [{ id: 'event' }] });
  await Migration.create(env).ready;
  assert.deepEqual(await read(env.indexedDB, D.evidence, 'snapshots'), [
    { id: 'extra', value: 'old' }, { id: 'same', value: 'CURRENT' }
  ]);
  assert.deepEqual(await read(env.indexedDB, D.sim, 'runs'), [{ id: 'run', value: 'old' }]);
  assert.deepEqual(await read(env.indexedDB, 'ChessDCC-evidence', 'snapshots'), [
    { id: 'extra', value: 'old' }, { id: 'same', value: 'old' }
  ]);
  assert.deepEqual(await read(env.indexedDB, LAB + 'evidence', 'snapshots'), [{ id: 'same', value: 'LAB' }]);
  assert.equal((await env.indexedDB.databases()).find(value => value.name === 'ChessDCC-evidence').version, 4);
  assertNoCrossChannelWrites(env.localStorage);
});
