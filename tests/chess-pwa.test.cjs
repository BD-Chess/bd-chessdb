const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { JSDOM } = require('jsdom');
const { IDBFactory } = require('fake-indexeddb');

const chessRoot = path.resolve(__dirname, '../public/chess');
const lanes = [
  { name: 'CURRENT', base: chessRoot, suffix: '/chess/', prefix: 'ChessBest:CURRENT:v2:' },
  { name: 'LAB', base: path.join(chessRoot, 'new'), suffix: '/chess/new/', prefix: 'ChessBest:LAB:v2:' }
];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = (lane, file) => fs.readFileSync(path.join(lane.base, file));
const release = lane => JSON.parse(read(lane, 'release.json'));

function workerHarness(lane, rootPath, buckets = new Map()) {
  const root = new URL(rootPath, 'https://example.test');
  const handlers = {};
  const state = { offline: false, skipped: 0, claimed: 0, requests: [], failPath: null };
  const key = input => new URL(input.url || input, root).href;
  const response = bytes => ({ ok: true, type: 'basic', bytes, clone() { return response(bytes); } });
  async function fetch(input) {
    const url = new URL(key(input)); state.requests.push(url.href);
    if (state.offline || url.pathname === state.failPath) throw Error('offline/unavailable');
    const relative = decodeURIComponent(url.pathname.slice(root.pathname.length)) || 'index.html';
    return response(read(lane, relative));
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
  vm.runInNewContext(read(lane, 'sw.js').toString(), { self, caches, fetch, URL, Request, Set });
  async function dispatch(name, extra = {}) {
    let promise;
    handlers[name]({ waitUntil: p => promise = p, respondWith: p => promise = p, ...extra });
    return promise;
  }
  return { root, state, buckets, caches, dispatch };
}

test('CURRENT and LAB have distinct install identities, intact releases and complete offline shells', () => {
  const identities = [];
  for (const lane of lanes) {
    const record = release(lane);
    assert.equal(record.schema, 'chessbest-channel-pwa/1');
    assert.equal(record.channel, lane.name);
    assert.equal(record.path, lane.suffix);
    assert.equal(record.storage_namespace, lane.prefix);
    assert.equal(hash(read(lane, 'sw.js')), record.worker_sha256);
    const assets = Object.keys(record.assets_sha256);
    assert(assets.length > 60, `${lane.name}: incomplete offline asset list`);
    for (const [file, digest] of Object.entries(record.assets_sha256)) {
      assert.equal(hash(read(lane, file)), digest, `${lane.name}: ${file}`);
    }
    assert(!assets.some(name => /Lichess-API|\.url$|\.nnue$|\.zip$|test\.|token/i.test(name)),
      `${lane.name}: never precache tokens or engine rebuild inputs`);
    for (const file of [
      'index.html', 'pwa.js', 'manifest.webmanifest', 'js/8zc-lab-storage.js',
      'js/8zc-review-core.js', 'js/8zc-sim-runner.js', 'js/8zc-study-store.js',
      'css/8zc-review.css', 'config/bots.json', 'research/benchmark-fixtures.json',
      'vendor/stockfish/stockfish-18-lite-single.js',
      'vendor/stockfish/stockfish-18-lite-single.wasm',
      'Games/ChessBest_Top_Picks.pgn', 'Games/ChessBest_Top_Picks_TCEC.pgn',
      'Games/ChessBest_Top_Picks_TCEC.LICENSE.md',
      'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'
    ]) assert(assets.includes(file), `${lane.name}: missing ${file}`);
    assert.match(read(lane, 'Games/ChessBest_Top_Picks_TCEC.LICENSE.md').toString(), /CC BY-SA 3\.0/);
    const dom = new JSDOM(read(lane, 'index.html').toString());
    for (const el of dom.window.document.querySelectorAll('script[src], link[rel=stylesheet], link[rel=manifest], link[rel=apple-touch-icon]')) {
      const ref = (el.getAttribute('src') || el.getAttribute('href')).split('?')[0];
      assert(assets.includes(ref), `${lane.name}: ${ref} must work offline`);
    }
    assert.equal(dom.window.document.querySelector('[aria-current=page]').textContent, lane.name);
    dom.window.close();
    const manifest = JSON.parse(read(lane, 'manifest.webmanifest'));
    assert.equal(manifest.display, 'standalone');
    const manifestURL = new URL('manifest.webmanifest', `https://example.test/bd-chessdb${lane.suffix}`);
    const identity = new URL(manifest.id, manifestURL).href;
    assert.equal(identity, `https://example.test/bd-chessdb${lane.suffix}`);
    assert.equal(new URL(manifest.start_url, manifestURL).href, identity);
    assert.equal(new URL(manifest.scope, manifestURL).href, identity);
    identities.push(identity);
  }
  assert.notEqual(...identities, 'CURRENT and LAB must install separately');
});

for (const lane of lanes) for (const prefix of ['', '/bd-chessdb']) {
  const scope = prefix + lane.suffix;
  test(`${lane.name} offline shell, versioned assets and API boundary at ${scope}`, async () => {
    const h = workerHarness(lane, scope);
    const assets = release(lane).assets_sha256;
    await h.dispatch('install'); await h.dispatch('activate');
    h.state.offline = true;
    for (const name of ['', 'index.html?launch=homescreen', ...Object.keys(assets).map(name => name + '?v=offline')]) {
      const reply = await h.dispatch('fetch', { request: new Request(new URL(name, h.root)) });
      assert(reply?.ok, `${lane.name}: ${name}`);
      assert.equal(hash(reply.bytes), assets[name.split('?')[0] || 'index.html']);
    }
    const otherLane = lane.name === 'CURRENT' ? new URL('new/index.html', h.root)
      : new URL('../index.html', h.root);
    for (const url of [
      'https://chessdb.cn/cdb.php?board=x', new URL('Lichess-API.txt', h.root),
      new URL('/.netlify/functions/chess-lab-gemini', h.root),
      new URL(lane.name === 'CURRENT' ? 'old/index.html' : '../old/index.html', h.root),
      otherLane, new URL(lane.name === 'CURRENT' ? 'PWA/' : '../PWA/', h.root),
      new URL('unknown.html', h.root)
    ]) assert.equal(await h.dispatch('fetch', { request: new Request(url) }), undefined,
      `${lane.name} must not intercept ${url}`);
    assert.equal(await h.dispatch('fetch', {
      request: new Request(new URL('index.html', h.root), { method: 'POST' })
    }), undefined);
  });
}

test('updates wait for user action and cannot delete caches belonging to the other lane', async () => {
  const buckets = new Map();
  for (const lane of lanes) {
    const h = workerHarness(lane, `/bd-chessdb${lane.suffix}`, buckets);
    const name = `chessbest-chess-${lane.name.toLowerCase()}-old`;
    await (await h.caches.open(name)).put(new URL('index.html', h.root), { old: true });
    const otherName = `chessbest-chess-${lane.name === 'CURRENT' ? 'lab' : 'current'}-other`;
    await h.caches.open(otherName);
    await h.caches.open('trip-pwa-cache');
    h.state.failPath = new URL('vendor/stockfish/stockfish-18-lite-single.wasm', h.root).pathname;
    await assert.rejects(h.dispatch('install'));
    assert.equal(h.state.skipped, 0); assert.equal(h.state.claimed, 0);
    assert(buckets.has(name));
    h.state.failPath = null;
    await h.dispatch('install');
    assert.equal(h.state.skipped, 0, 'do not swap modules during a game');
    await h.dispatch('message', { data: { type: 'ACTIVATE_UPDATE' } });
    assert.equal(h.state.skipped, 1);
    await h.dispatch('activate');
    assert(!buckets.has(name), `${lane.name} old cache should be retired`);
    assert(buckets.has(otherName), 'other lane cache must survive');
    assert(buckets.has('trip-pwa-cache'), 'other application cache must survive');
    const cachedName = [...buckets.keys()].find(item =>
      item.startsWith(`chessbest-chess-${lane.name.toLowerCase()}-`) && item !== name);
    assert(cachedName, `${lane.name} needs an independent release cache`);
    const before = h.state.requests.length;
    const reply = await h.dispatch('fetch', { request: new Request(new URL('index.html?v=next', h.root)) });
    assert.equal(hash(reply.bytes), release(lane).assets_sha256['index.html']);
    assert.equal(h.state.requests.length, before, 'never mix old HTML with a new script bundle');
  }
});

test('CURRENT and LAB copy shared legacy data into separate namespaces without overwriting either lane', async () => {
  const oldGame = '[White "Shared legacy"] 1. d4 d5 *';
  const map = new Map([
    ['chessLabGame-v8', oldGame], ['chessLabSettings-v8', '{"sfAnalysisDepth":14}'],
    ['ChessBest:LAB:v2:game', 'existing LAB game'],
    ['ChessBest:PWA:v2:game', 'old unused PWA game']
  ]);
  const written = [];
  const storage = {
    getItem: key => map.has(key) ? map.get(key) : null,
    setItem(key, value) { written.push(key); map.set(key, String(value)); },
    removeItem: key => map.delete(key)
  };
  const indexedDB = new IDBFactory();
  const locks = { request(_name, _options, callback) { return Promise.resolve().then(callback); } };
  for (const lane of lanes) {
    const Migration = require(path.join(lane.base, 'js/8zc-lab-storage.js'));
    const result = await Migration.create({ localStorage: storage, indexedDB, locks }).ready;
    assert.equal(result.complete, true);
    assert.equal(Migration.KEYS.game, lane.prefix + 'game');
    assert.equal(storage.getItem(Migration.KEYS.settings), '{"sfAnalysisDepth":14}');
  }
  assert.equal(storage.getItem('ChessBest:CURRENT:v2:game'), oldGame);
  assert.equal(storage.getItem('ChessBest:LAB:v2:game'), 'existing LAB game');
  assert.equal(storage.getItem('ChessBest:PWA:v2:game'), 'old unused PWA game');
  assert.equal(storage.getItem('chessLabGame-v8'), oldGame);
  assert.equal(storage.getItem('chessLabSettings-v8'), '{"sfAnalysisDepth":14}');
  assert(written.every(key => key.startsWith('ChessBest:CURRENT:v2:') || key.startsWith('ChessBest:LAB:v2:')));
  storage.removeItem('ChessBest:CURRENT:v2:game');
  const Current = require(path.join(lanes[0].base, 'js/8zc-lab-storage.js'));
  await Current.create({ localStorage: storage, indexedDB, locks }).ready;
  assert.equal(storage.getItem('ChessBest:CURRENT:v2:game'), null, 'deleted records stay deleted');
  assert.equal(storage.getItem('ChessBest:LAB:v2:game'), 'existing LAB game');
});
