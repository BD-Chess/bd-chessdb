const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { JSDOM } = require('jsdom');
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
  for (const required of ['js/8zc-sim-store.js', 'js/8zc-sim-runner.js', 'js/8zc-tournament-ui.js', 'css/8zc-tournament.css', 'vendor/stockfish/stockfish-18-lite-single.wasm']) assert(assets.includes(required));
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

test('PWA retains legacy storage keys and isolates new tournament storage', () => {
  const files = Object.keys(release.pwa_assets_sha256).filter(name => name.startsWith('js/') && name.endsWith('.js'));
  const all = files.map(name => fs.readFileSync(path.join(base, name), 'utf8')).join('\n');
  for (const key of ['chessPwaLabSettings-v1', 'chessPwaLabGame-v1', 'chessPwaLabStudy-v1', 'chessPwaLabTiming-v1', '8zc.pwa.evidence.v1', 'ChessDCC-pwa-evidence', 'ChessBest-pwa-sim-v1', 'chessPwaSimRunnerLease-v1']) assert(all.includes("'" + key + "'"));
  for (const key of ['chessLabSettings-v8', 'chessLabGame-v8', 'ChessBest-sim-v1', 'chessSimRunnerLease-v1']) assert(!all.includes("'" + key + "'"));
});
