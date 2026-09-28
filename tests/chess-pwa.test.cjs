const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { JSDOM } = require('jsdom');
const { IDBFactory } = require('fake-indexeddb');
const base = path.resolve(__dirname, '../public/chess/PWA');
const source = path.resolve(__dirname, '../public/chess/new');
const release = JSON.parse(fs.readFileSync(path.join(base, 'release.json')));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function workerHarness(rootPath = '/bd-chessdb/chess/PWA/') {
  const root = new URL(rootPath, 'https://example.test');
  const handlers = {}, buckets = new Map();
  const state = { offline: false, skipped: 0, claimed: 0, requests: [], failPath: null };
  const key = input => new URL(input.url || input, root).href;
  const response = bytes => ({ ok: true, type: 'basic', bytes, clone() { return response(bytes); } });
  async function fetch(input) {
    const url = new URL(key(input)); state.requests.push(url.href);
    if (state.offline || url.pathname === state.failPath) throw Error('offline/unavailable');
    const relative = decodeURIComponent(url.pathname.slice(root.pathname.length)) || 'index.html';
    return response(fs.readFileSync(path.join(base, relative)));
  }
  const caches = {
    keys: async () => [...buckets.keys()], delete: async name => buckets.delete(name),
    open: async name => {
      if (!buckets.has(name)) buckets.set(name, new Map());
      const map = buckets.get(name);
      return {
        match: async input => map.get(key(input)),
        put: async (input, value) => map.set(key(input), value),
        addAll: async inputs => {
          const all = await Promise.all(inputs.map(async input => [key(input), await fetch(input)]));
          for (const [url, value] of all) map.set(url, value);
        }
      };
    }
  };
  const self = { location: { href: new URL('sw.js', root).href },
    addEventListener: (name, fn) => handlers[name] = fn,
    skipWaiting: async () => state.skipped++, clients: { claim: async () => state.claimed++ } };
  vm.runInNewContext(fs.readFileSync(path.join(base, 'sw.js'), 'utf8'), { self, caches, fetch, URL, Request, Set });
  async function dispatch(name, extra = {}) {
    let promise;
    handlers[name]({ waitUntil: p => promise = p, respondWith: p => promise = p, ...extra });
    return promise;
  }
  return { root, state, buckets, caches, dispatch };
}

test('release hashes, LAB provenance, install identity and complete static asset closure', () => {
  for (const [file, digest] of Object.entries(release.source_files_sha256)) assert.equal(hash(fs.readFileSync(path.join(source, file))), digest, file);
  for (const [file, digest] of Object.entries(release.pwa_assets_sha256)) assert.equal(hash(fs.readFileSync(path.join(base, file))), digest, file);
  assert.equal(hash(fs.readFileSync(path.join(base, 'sw.js'))), release.worker_sha256);
  const assets = Object.keys(release.pwa_assets_sha256);
  assert(!assets.some(name => /Lichess-API|\.url$|test\.|token/i.test(name)));
  for (const required of ['js/8zc-sim-store.js', 'js/8zc-sim-runner.js', 'js/8zc-tournament-ui.js', 'js/8zc-lab-storage.js', 'js/8zc-study-store.js', 'js/8zc-review-core.js', 'js/8zc-review-ui.js', 'css/8zc-review.css', 'css/8zc-tournament.css', 'vendor/stockfish/stockfish-18-lite-single.wasm', 'Games/ChessBest_Top_Picks.pgn', 'Games/ChessBest_Top_Picks_TCEC.pgn', 'Games/ChessBest_Top_Picks_TCEC.LICENSE.md']) assert(assets.includes(required));
  assert.match(fs.readFileSync(path.join(base, 'Games/ChessBest_Top_Picks_TCEC.LICENSE.md'), 'utf8'), /CC BY-SA 3\.0/);
  const dom = new JSDOM(fs.readFileSync(path.join(base, 'index.html'), 'utf8'));
  for (const el of dom.window.document.querySelectorAll('script[src], link[rel=stylesheet], link[rel=manifest], link[rel=apple-touch-icon]')) {
    const ref = (el.getAttribute('src') || el.getAttribute('href')).split('?')[0];
    assert(assets.includes(ref), ref + ' must be available offline');
  }
  assert.equal(dom.window.document.querySelector('[aria-current=page]').textContent, 'PWA');
  dom.window.close();
  const manifest = JSON.parse(fs.readFileSync(path.join(base, 'manifest.webmanifest')));
  assert.deepEqual([manifest.id, manifest.start_url, manifest.scope], ['./', './', './']);
  assert.equal(manifest.display, 'standalone');
  const help = fs.readFileSync(path.join(base, '8zc-help.html'), 'utf8');
  const about = fs.readFileSync(path.join(base, '8zc-about.html'), 'utf8');
  const home = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
  assert.match(help, /data from the previous PWA is copied into this PWA’s new storage/);
  assert.match(help, /This guide describes the installed PWA/);
  assert.doesNotMatch(help, /development version|LAB-only storage|restores LAB preferences|This release gives LAB/);
  assert.match(about, /INSTALLED PWA/);
  assert.doesNotMatch(about, /DEVELOPMENT WORKSPACE|Development board/);
  assert.match(home, /Ohranjeni podatki PWA/);
  assert.doesNotMatch(home, /Razvojni Analysis Lab|Samostojni podatki LAB/);
});

for (const scope of ['/chess/PWA/', '/bd-chessdb/chess/PWA/']) {
  test('complete offline shell, query strings and API boundary at ' + scope, async () => {
    const h = workerHarness(scope);
    await h.dispatch('install'); await h.dispatch('activate');
    h.state.offline = true;
    for (const name of ['', 'index.html?launch=homescreen', ...Object.keys(release.pwa_assets_sha256).map(name => name + '?v=offline')]) {
      const reply = await h.dispatch('fetch', { request: new Request(new URL(name, h.root)) });
      assert(reply?.ok, name);
      assert.equal(hash(reply.bytes), release.pwa_assets_sha256[name.split('?')[0] || 'index.html']);
    }
    for (const url of ['https://chessdb.cn/cdb.php?board=x', new URL('../new/Lichess-API.txt', h.root), new URL('/api/chess-gemini', h.root), new URL('../new/index.html', h.root), new URL('unknown.html', h.root)]) {
      assert.equal(await h.dispatch('fetch', { request: new Request(url) }), undefined);
    }
    assert.equal(await h.dispatch('fetch', { request: new Request(new URL('index.html', h.root), { method: 'POST' }) }), undefined);
  });
}

test('update waits, explicit activation works, failed install cannot activate, unrelated caches survive', async () => {
  const h = workerHarness();
  const legacy = await h.caches.open('chessbest-lab-pwa-2026-09-24-1');
  await legacy.put(new URL('index.html', h.root), { old: true });
  const other = await h.caches.open('chessbest-lab-pwa-other-scope');
  await other.put('https://example.test/other/index.html', { other: true });
  await h.caches.open('trip-pwa-cache');
  h.state.failPath = new URL('vendor/stockfish/stockfish-18-lite-single.wasm', h.root).pathname;
  await assert.rejects(h.dispatch('install'));
  assert.equal(h.state.skipped, 0); assert.equal(h.state.claimed, 0);
  assert(h.buckets.has('chessbest-lab-pwa-2026-09-24-1'));
  h.state.failPath = null;
  await h.dispatch('install');
  assert.equal(h.state.skipped, 0, 'no forced update during active play');
  await h.dispatch('message', { data: { type: 'ACTIVATE_UPDATE' } });
  assert.equal(h.state.skipped, 1);
  await h.dispatch('activate');
  assert(!h.buckets.has('chessbest-lab-pwa-2026-09-24-1'));
  assert(h.buckets.has('chessbest-lab-pwa-other-scope'));
  assert(h.buckets.has('trip-pwa-cache'));
});

test('installed release stays coherent if network serves different files', async () => {
  const h = workerHarness(); await h.dispatch('install');
  const count = h.state.requests.length;
  const reply = await h.dispatch('fetch', { request: new Request(new URL('index.html?new=true', h.root)) });
  assert.equal(hash(reply.bytes), release.pwa_assets_sha256['index.html']);
  assert.equal(h.state.requests.length, count, 'use complete release instead of mixing network versions');
});

test('PWA v2 storage is distinct from LAB and CURRENT, with PWA v1 as copy sources', () => {
  const files = Object.keys(release.pwa_assets_sha256).filter(name => name.startsWith('js/') && name.endsWith('.js'));
  const all = files.map(name => fs.readFileSync(path.join(base, name), 'utf8')).join('\n');
  for (const key of ['chessPwaLabSettings-v1', 'chessPwaLabGame-v1', 'chessPwaLabStudy-v1', 'chessPwaLabTiming-v1', '8zc.pwa.evidence.v1', 'ChessDCC-pwa-evidence', 'ChessBest-pwa-sim-v1', 'chessPwaSimRunnerLease-v1']) assert(all.includes("'" + key + "'"));
  for (const key of ['chessLabSettings-v8', 'chessLabGame-v8', 'ChessBest-sim-v1', 'chessSimRunnerLease-v1', 'ChessBest:LAB:v2:']) assert(!all.includes("'" + key + "'"));
  for (const key of ['ChessBest:PWA:v2:settings', 'ChessBest:PWA:v2:studies', 'ChessBest:PWA:v2:sim', 'ChessBest:PWA:v2:evidence']) assert(all.includes(key));
});

test('first PWA v2 boot copies its own saved data without changing old keys or databases', async () => {
  const Migration = require(path.join(base, 'js/8zc-lab-storage.js'));
  const old = {
    'chessPwaLabSettings-v1': '{"sfAnalysisDepth":14}',
    'chessPwaLabGame-v1': '[White "Saved PWA"] 1. e4 *',
    'chessPwaLabStudy-v1': '{"schema":"chess-lab-studies","version":1,"studies":[],"activeId":null}',
    'chessPwaLabTiming-v1': '{"records":[]}',
    '8zc.pwa.evidence.v1': '[]',
    'ChessBest-pwa-sim-v1-fallback': '{"schema":"chess-sim-archive","version":1,"runs":[],"events":[]}',
    'chessLabGame-v8': 'different LAB game'
  };
  const data = new Map(Object.entries(old)), storage = {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key)
  };
  const idb = new IDBFactory();
  async function database(name, stores) {
    return new Promise((resolve, reject) => {
      const req = idb.open(name, 1);
      req.onupgradeneeded = () => Object.keys(stores).forEach(store => req.result.createObjectStore(store, { keyPath: 'id' }));
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result, tx = db.transaction(Object.keys(stores), 'readwrite');
        for (const [store, rows] of Object.entries(stores)) for (const row of rows) tx.objectStore(store).put(row);
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
      };
    });
  }
  async function rows(name, store) {
    return new Promise((resolve, reject) => {
      const req = idb.open(name); req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result, query = db.transaction(store).objectStore(store).getAll();
        query.onsuccess = () => { db.close(); resolve(query.result); }; query.onerror = () => reject(query.error);
      };
    });
  }
  const evidence = [{ id: 'retained-evidence', payload: { source: 'PWA v1' } }];
  const runs = [{ id: 'retained-run', state: 'paused', trace: [] }];
  await database('ChessDCC-pwa-evidence', { snapshots: evidence });
  await database('ChessBest-pwa-sim-v1', { runs, events: [] });
  const lockNames = [], locks = { request(name, _options, callback) { lockNames.push(name); return Promise.resolve().then(callback); } };
  const result = await Migration.create({ localStorage: storage, indexedDB: idb, locks }).ready;
  assert.equal(result.complete, true);
  assert.equal(Migration.KEYS.game, 'ChessBest:PWA:v2:game');
  assert.deepEqual(JSON.parse(storage.getItem(Migration.KEYS.settings)), { sfAnalysisDepth: 14 });
  assert.equal(storage.getItem(Migration.KEYS.game), old['chessPwaLabGame-v1']);
  assert.equal(storage.getItem(Migration.KEYS.studies), old['chessPwaLabStudy-v1']);
  assert.equal(storage.getItem('chessPwaLabGame-v1'), old['chessPwaLabGame-v1']);
  assert.equal(storage.getItem('chessLabGame-v8'), old['chessLabGame-v8']);
  assert.deepEqual(await rows(Migration.DATABASES.evidence, 'snapshots'), evidence);
  assert.deepEqual(await rows(Migration.DATABASES.sim, 'runs'), runs);
  assert.deepEqual(await rows('ChessDCC-pwa-evidence', 'snapshots'), evidence);
  assert.deepEqual(await rows('ChessBest-pwa-sim-v1', 'runs'), runs);
  assert(lockNames.every(name => name === Migration.KEYS.studies));
  storage.removeItem(Migration.KEYS.studies);
  await Migration.create({ localStorage: storage, indexedDB: idb, locks }).ready;
  assert.equal(storage.getItem(Migration.KEYS.studies), null, 'deletion after migration is not resurrected');
});

test('PWA v2 also copies older ES module state if the later PWA v1 state is absent', async () => {
  const Migration = require(path.join(base, 'js/8zc-lab-storage.js'));
  async function run(initial) {
    const values = new Map(Object.entries(initial)), writes = [], storage = {
      getItem: key => values.has(key) ? values.get(key) : null,
      setItem(key, value) { writes.push(key); values.set(key, String(value)); },
      removeItem: key => values.delete(key)
    };
    const indexedDB = { databases: async () => [] };
    const locks = { request(_name, _options, callback) { return callback(); } };
    await Migration.create({ localStorage: storage, indexedDB, locks }).ready;
    return { storage, writes };
  }
  const before = {
    'chessPwaLegacyGame-v1': '1. c4 c5 *',
    'chessPwaLegacySettings-v1': '{"sfAnalysisDepth":17}',
    'ChessBest:LAB:v2:game': 'unrelated LAB'
  };
  const fallback = await run(before);
  assert.equal(fallback.storage.getItem(Migration.KEYS.game), before['chessPwaLegacyGame-v1']);
  assert.equal(fallback.storage.getItem(Migration.KEYS.settings), before['chessPwaLegacySettings-v1']);
  assert.equal(fallback.storage.getItem('chessPwaLegacyGame-v1'), before['chessPwaLegacyGame-v1']);
  assert.equal(fallback.storage.getItem('ChessBest:LAB:v2:game'), 'unrelated LAB');
  assert(fallback.writes.every(key => key.startsWith('ChessBest:PWA:v2:')));
  const primary = await run({
    ...before, 'chessPwaLabGame-v1': '1. d4 d5 *',
    'chessPwaLabSettings-v1': '{"sfAnalysisDepth":11}',
    [Migration.KEYS.game]: 'already saved PWA v2'
  });
  assert.equal(primary.storage.getItem(Migration.KEYS.game), 'already saved PWA v2');
  assert.equal(primary.storage.getItem(Migration.KEYS.settings), '{"sfAnalysisDepth":11}');
  assert.equal(primary.storage.getItem('chessPwaLegacyGame-v1'), before['chessPwaLegacyGame-v1']);
  assert(primary.writes.every(key => key.startsWith('ChessBest:PWA:v2:')));
});
