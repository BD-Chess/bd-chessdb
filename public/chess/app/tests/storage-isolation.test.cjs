const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = path.resolve(__dirname, '..');
const storageAPI = require('../js/8zc-lab-storage.js');

function memoryStorage(seed, calls) {
  const entries = new Map(seed);
  return {
    entries,
    getItem(key) { calls.push(['get', key]); return entries.get(key) ?? null; },
    setItem(key, value) { calls.push(['set', key]); entries.set(key, value); },
    removeItem(key) { calls.push(['remove', key]); entries.delete(key); }
  };
}

function fakeIndexedDB(opened) {
  return { open(name) {
    opened.push(name);
    const values = new Map();
    let hasStore = false;
    const db = {
      objectStoreNames: { contains: () => hasStore },
      createObjectStore() { hasStore = true; },
      close() {},
      transaction() {
        const tx = {
          objectStore() {
            return {
              put(value, key) { values.set(key, value); },
              get(key) {
                const request = {};
                setImmediate(() => {
                  request.result = values.get(key);
                  request.onsuccess?.();
                  setImmediate(() => tx.oncomplete?.());
                });
                return request;
              },
              delete(key) { values.delete(key); }
            };
          },
          abort() { setImmediate(() => tx.onabort?.()); }
        };
        return tx;
      }
    };
    const request = { result: db };
    setImmediate(() => {
      request.onupgradeneeded?.();
      setImmediate(() => request.onsuccess?.());
    });
    return request;
  } };
}

test('fresh APP boot probes only APP keys and databases, retaining LAB/CURRENT data', async () => {
  const calls = [], opened = [];
  const legacy = [['ChessBest:LAB:v2:studies', 'lab-study'], ['ChessBest:CURRENT:v2:game', 'current-game']];
  const localStorage = memoryStorage(legacy, calls);
  const instance = storageAPI.create({
    localStorage,
    indexedDB: fakeIndexedDB(opened),
    locks: { request() {} }
  });
  assert.equal((await instance.ready).phase, 'ready');
  assert.equal(instance.KEYS.studies, 'ChessBest:APP:v1:studies');
  assert.deepEqual(opened, ['ChessBest:APP:v1:health']);
  assert.ok(calls.length >= 3);
  assert.ok(calls.every(([, key]) => key.startsWith('ChessBest:APP:v1:')));
  for (const [key, value] of legacy) assert.equal(localStorage.entries.get(key), value);
  assert.deepEqual([...localStorage.entries.keys()], legacy.map(([key]) => key));
});

test('missing cross-tab lock fails closed before any storage access', async () => {
  const calls = [], opened = [];
  const instance = storageAPI.create({
    localStorage: memoryStorage([], calls),
    indexedDB: fakeIndexedDB(opened),
    locks: null
  });
  await assert.rejects(instance.ready, /Web Locks/);
  assert.deepEqual(calls, []);
  assert.deepEqual(opened, []);
  assert.equal(instance.status().phase, 'blocked');
});

test('APP runtime closes over local assets and has no LAB key or token-file dependency', () => {
  const html = fs.readFileSync(path.join(app, 'play.html'), 'utf8');
  const assetPaths = [
    ...html.matchAll(/<script src="(js\/[^"?]+)(?:\?[^"]*)?"/g),
    ...html.matchAll(/<link rel="stylesheet" href="(css\/[^"?]+)(?:\?[^"]*)?"/g)
  ].map(match => match[1]);
  assert.ok(assetPaths.length > 25);
  for (const asset of assetPaths) assert.ok(fs.existsSync(path.join(app, asset)), asset);
  assert.doesNotMatch(html, /pwa\.js|manifest\.webmanifest|serviceWorker\.register/);
  assert.equal(fs.existsSync(path.join(app, 'Lichess-API.txt')), false);
  assert.equal(fs.existsSync(path.join(app, 'sw.js')), false);
  for (const filename of fs.readdirSync(path.join(app, 'js'))) {
    if (!filename.startsWith('8zc-')) continue;
    const source = fs.readFileSync(path.join(app, 'js', filename), 'utf8');
    assert.doesNotMatch(source, /ChessBest:LAB:v2:|Lichess-API\.txt/);
  }
  assert.ok(fs.existsSync(path.join(app, 'config/benchmark-fixtures.json')));
  assert.ok(fs.existsSync(path.join(app, 'vendor/stockfish/stockfish-18-lite-single.wasm')));
  assert.ok(fs.existsSync(path.join(app, 'vendor/stockfish/nn-9067e33176e8.nnue')));
  assert.ok(fs.existsSync(path.join(app, 'vendor/stockfish/stockfish-js-18.0.0-source.zip')));
});
