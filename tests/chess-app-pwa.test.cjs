const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { JSDOM } = require('jsdom');
const base = path.resolve(__dirname, '../public/chess/app');
const read = file => fs.readFileSync(path.join(base, file));
const release = JSON.parse(read('release.json'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function harness(prefix = '/bd-chessdb') {
  const root = new URL(`https://example.test${prefix}/chess/app/`);
  const buckets = new Map(), handlers = {};
  const state = { fail: '', offline: false, fetches: 0, skipped: 0, claimed: 0 };
  const key = input => String(input.url || input);
  const caches = {
    keys: async () => [...buckets.keys()], delete: async name => buckets.delete(name),
    open: async name => {
      if (!buckets.has(name)) buckets.set(name, new Map());
      const entries = buckets.get(name);
      return {
        match: async input => entries.get(key(input))?.clone(),
        addAll: async requests => {
          const pending = [];
          for (const request of requests) {
            state.fetches++;
            assert.equal(request.cache, 'reload');
            const name = new URL(request.url).pathname.slice(root.pathname.length);
            if (state.offline || name === state.fail) throw Error('download failed');
            const bytes = read(name);
            assert.equal(request.integrity, 'sha256-' + crypto.createHash('sha256').update(bytes).digest('base64'));
            pending.push([request.url, new Response(bytes)]);
          }
          pending.forEach(([url, response]) => entries.set(url, response));
        }
      };
    }
  };
  const self = { location: { href: new URL('sw.js', root).href },
    addEventListener: (name, fn) => handlers[name] = fn,
    skipWaiting: () => state.skipped++, clients: { claim: () => state.claimed++ } };
  vm.runInNewContext(read('sw.js').toString(), { self, caches, URL, Request, Response, Set });
  const dispatch = async (name, extra = {}) => {
    let result;
    handlers[name]?.({ waitUntil: p => result = p, respondWith: p => result = p, ...extra });
    return result;
  };
  const get = url => dispatch('fetch', { request: new Request(new URL(url, root)) });
  return { root, buckets, caches, state, dispatch, get, handlers };
}

test('APP install identity opens mobile runtime and release hashes cover all runtime dependencies', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.name, 'ChessBest APP');
  assert.equal(manifest.start_url, './play.html');
  assert.equal(manifest.id, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.equal(release.storage_namespace, 'ChessBest:APP:v1:');
  assert.equal(sha(read('sw.js')), release.worker_sha256);
  const assets = release.assets_sha256;
  for (const [name, hash] of Object.entries(assets)) assert.equal(sha(read(name)), hash, name);
  assert(!Object.keys(assets).some(name => /token|Lichess-API|\.nnue|\.zip|test\.cjs/i.test(name)));
  for (const file of ['index.html', 'play.html']) {
    const dom = new JSDOM(read(file).toString());
    for (const el of dom.window.document.querySelectorAll('script[src],link[rel=stylesheet],link[rel=manifest],link[rel=apple-touch-icon]')) {
      const name = (el.getAttribute('src') || el.getAttribute('href')).split('?')[0];
      assert(assets[name], name);
    }
    dom.window.close();
  }
});

for (const prefix of ['', '/bd-chessdb']) test(`APP offline release and sibling navigation isolation at ${prefix || '/'}`, async () => {
  const h = harness(prefix);
  await h.dispatch('install'); await h.dispatch('activate'); h.state.offline = true;
  const count = h.state.fetches;
  for (const name of ['', ...Object.keys(release.assets_sha256)]) {
    const response = await h.get(name + '?offline=1');
    assert.equal(response.status, 200, name);
    assert.equal(sha(Buffer.from(await response.arrayBuffer())), release.assets_sha256[name || 'index.html']);
  }
  for (const name of ['../', '../new/', '../old/', '../../S/app/', 'Lichess-API.txt', 'missing.html', 'https://chessdb.cn/cdb.php']) {
    assert.equal(await h.get(name), undefined, name);
  }
  assert.equal(h.state.fetches, count);
  // A missing cached asset must not fetch a potentially newer production module.
  [...h.buckets.values()][0].delete(new URL('js/app-mobile.js', h.root).href);
  assert.equal((await h.get('js/app-mobile.js')).status, 503);
});

test('failed download retains active release; updates cannot force a running game or other channel to reload', async () => {
  const h = harness();
  await h.caches.open('chessbest-chess-app-old');
  await h.caches.open('chessbest-chess-current-other');
  await h.caches.open('chessbest-chess-lab-other');
  h.state.fail = 'vendor/stockfish/stockfish-18-lite-single.wasm';
  await assert.rejects(h.dispatch('install'), /download failed/);
  assert.equal(h.buckets.size, 3);
  h.state.fail = ''; await h.dispatch('install');
  assert(h.buckets.has('chessbest-chess-app-old'));
  await h.dispatch('message', { data: { type: 'ACTIVATE_UPDATE' } });
  assert.equal(h.state.skipped, 0); assert.equal(h.state.claimed, 0);
  assert.equal(h.handlers.message, undefined);
  // Browser dispatches activate only after all old controlled clients close.
  await h.dispatch('activate');
  assert(!h.buckets.has('chessbest-chess-app-old'));
  assert(h.buckets.has('chessbest-chess-current-other'));
  assert(h.buckets.has('chessbest-chess-lab-other'));
});

test('CURRENT and LAB workers do not intercept APP navigation', () => {
  for (const lane of ['..', '../new']) {
    const handlers = {};
    const url = new URL(lane + '/sw.js', 'https://example.test/bd-chessdb/chess/app/');
    vm.runInNewContext(read(lane + '/sw.js').toString(), {
      self: { location: { href: url.href }, addEventListener: (name, fn) => handlers[name] = fn }, URL, Set
    });
    for (const suffix of ['', 'play.html', 'pwa.js', 'sw.js']) {
      let intercepted = false;
      handlers.fetch({ request: new Request('https://example.test/bd-chessdb/chess/app/' + suffix), respondWith: () => intercepted = true });
      assert.equal(intercepted, false, `${lane}: ${suffix}`);
    }
  }
});

test('PWA controls expose readiness, safe update instructions, install fallback and native bypass', async () => {
  const dom = new JSDOM(read('play.html').toString(), { url: 'https://example.test/bd-chessdb/chess/app/play.html', runScripts: 'outside-only' });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false });
  Object.defineProperty(w, 'isSecureContext', { value: true });
  let calls = 0;
  const registration = { active: {}, waiting: {}, addEventListener() {} };
  Object.defineProperty(w.navigator, 'serviceWorker', { value: {
    register: async (url, options) => {
      calls++; assert.equal(String(url), 'https://example.test/bd-chessdb/chess/app/sw.js');
      assert.equal(options.scope, 'https://example.test/bd-chessdb/chess/app/');
      assert.equal(options.updateViaCache, 'none'); return registration;
    }, ready: Promise.resolve(registration)
  } });
  await new Promise(resolve => w.addEventListener('load', resolve, { once: true }));
  w.eval(read('pwa.js').toString());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
  const byId = id => w.document.getElementById(id);
  assert.deepEqual([...w.document.querySelectorAll('.app-channel-nav a')].map(a => a.textContent.trim()), ['CURRENT', 'PREVIOUS', 'LAB', 'APP']);
  assert.match(w.document.getElementById('app-shell-polish').textContent, /scrollbar-width:none/);
  assert.match(byId('appPwaStatus').textContent, /Offline files ready/);
  assert.equal(byId('appPwaUpdate').hidden, false);
  assert.match(byId('appPwaUpdate').textContent, /close all ChessBest APP windows/);
  byId('appPwaInstall').click();
  assert.match(byId('appPwaHint').textContent, /Safari/);
  Object.defineProperty(w.navigator, 'onLine', { value: false });
  w.dispatchEvent(new w.Event('offline'));
  assert.match(byId('appPwaStatus').textContent, /^Offline ·/);
  w.Capacitor = { isNativePlatform: () => true };
  w.eval(read('pwa.js').toString());
  assert.equal(calls, 1);
  dom.window.close();
});

test('APP preview keeps the phone frame for desktop/tablet clients and uses native-like fullscreen for normal phone clients', () => {
  const html = read('index.html').toString();
  assert.doesNotMatch(html, /location\.(replace|assign)|location\s*=/);
  assert.doesNotMatch(html, /preview-note/);
  assert.doesNotMatch(html, /Open without frame/i);
  assert.match(html, /main \{[^}]*justify-content:\s*center/s);
  assert.match(html, /<option value="390" selected>390 px<\/option>/);
  assert.match(html, /header-tools[\s\S]*CURRENT[\s\S]*PREVIOUS[\s\S]*LAB[\s\S]*APP[\s\S]*Preview width/);
  for (const standalone of [false, true]) {
    const dom = new JSDOM(html, {
      url: 'https://example.test/chess/app/', runScripts: 'outside-only',
      beforeParse(window) {
        Object.defineProperty(window.navigator, 'userAgent', { value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', configurable: true });
      }
    });
    const w = dom.window;
    w.matchMedia = () => ({ matches: standalone });
    Object.defineProperty(w.navigator, 'standalone', { value: standalone });
    for (const width of [320, 375, 790, 791, 1920, 3840, 600]) {
      Object.defineProperty(w, 'innerWidth', { value: width, configurable: true });
      for (const script of w.document.querySelectorAll('script:not([src])')) w.eval(script.textContent);
      w.dispatchEvent(new w.Event('resize'));
      assert.equal(w.location.pathname, '/chess/app/');
      assert.equal(w.document.documentElement.classList.contains('app-phone-browser'), false);
      assert(w.document.querySelector('.phone-frame iframe'));
    }
    dom.window.close();
  }
  const phone = new JSDOM(html, {
    url: 'https://example.test/chess/app/', runScripts: 'outside-only',
    beforeParse(window) {
      Object.defineProperty(window.navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1', configurable: true });
    }
  });
  assert.equal(phone.window.location.pathname, '/chess/app/');
  assert(phone.window.document.documentElement.classList.contains('app-phone-browser'));
  assert(phone.window.document.querySelector('.phone-frame iframe'));
  phone.window.close();
});


test('APP Deep menu uses depth-only presets and APP CDB transport is not forced away from LAB semantics', () => {
  const deep = read('js/8zc-deep-ui.js').toString();
  const budget = deep.match(/<select data-deep="budget">([\s\S]*?)<\/select>/)?.[1] || '';
  assert.deepEqual([...budget.matchAll(/value="depth:(\d+)"/g)].map(m => Number(m[1])), [14,18,22,26,30,34,38,42]);
  assert.doesNotMatch(budget, /nodes:|infinite/);
  const utils = read('js/8zc-utils.js').toString();
  assert.doesNotMatch(utils, /settings\.evalMode\s*=\s*['"]direct['"]/);
  assert.match(utils, /source === 'proxy' && action === 'queryall'/);
});


test('APP board keeps Top Line in normal flow and board coordinates inset from clipped edges', () => {
  const mobile = read('css/app-mobile.css').toString();
  const app = read('js/app-mobile.js').toString();
  assert.match(app, /controls\.append\(navRow, actionRow, status, byId\('appTopLine'\)\)/);
  assert.match(mobile, /#board-container \{[\s\S]*height:\s*auto !important;[\s\S]*min-height:\s*0 !important;/);
  assert.match(mobile, /#board \.alpha-d2270 \{ right:\s*4px; bottom:\s*4px; \}/);
  assert.match(mobile, /#board \.numeric-fc462 \{ left:\s*4px; top:\s*4px; \}/);
});
