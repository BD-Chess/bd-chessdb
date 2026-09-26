const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');

function workerHarness(file, scope) {
  const base = new URL(scope, 'https://example.test');
  const listeners = {}, entries = new Map(), writes = [];
  const state = { status: 200, offline: false };
  const key = input => new URL(input.url || input, base).href;
  const cache = {
    match: async input => entries.get(key(input))?.clone(),
    put: async (input, value) => { writes.push(key(input)); entries.set(key(input), value); }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), {
    URL, Request, Set,
    self: { location: new URL(path.basename(file), base), addEventListener: (name, fn) => { listeners[name] = fn; } },
    caches: { open: async () => cache },
    fetch: async () => {
      if (state.offline) throw Error('fixture offline');
      return new Response('network ' + state.status, { status: state.status });
    }
  });
  return {
    state, entries, writes, base,
    seed(name, status = 200) { entries.set(new URL(name, base).href, new Response('cached ' + status, { status })); },
    request(name = 'index.html', method = 'GET') {
      let response;
      listeners.fetch({ request: new Request(new URL(name, base), { method }), respondWith: value => { response = value; } });
      return response;
    }
  };
}

for (const [label, file, scope] of [
  ['Trip domain', 'public/Trip/PWA/service-worker.js', '/Trip/PWA/'],
  ['Trip Pages', 'public/Trip/PWA/service-worker.js', '/bd-chessdb/Trip/PWA/'],
  ['Flip4M domain', 'public/F4M/PWA/sw.js', '/f4m/PWA/'],
  ['Flip4M Pages', 'public/F4M/PWA/sw.js', '/bd-chessdb/F4M/PWA/']
]) {
  test(label + ': HTTP errors fall back to a successful cached shell', async () => {
    const h = workerHarness(file, scope); h.seed('index.html');
    for (const status of [404, 500, 503]) {
      h.state.status = status;
      const response = await h.request();
      assert.equal(response.status, 200);
      assert.equal(await response.text(), 'cached 200');
    }
    assert.equal(h.writes.length, 0, 'never cache a failed response');
  });
  test(label + ': valid network, offline, no cache and invalid cache cases', async () => {
    const h = workerHarness(file, scope); h.seed('index.html');
    assert.equal(await (await h.request()).text(), 'network 200');
    h.state.offline = true;
    assert.equal((await h.request()).status, 200);
    h.entries.clear();
    await assert.rejects(h.request(), /fixture offline/);
    h.state.offline = false; h.state.status = 503;
    assert.equal((await h.request()).status, 503);
    h.seed('index.html', 500);
    assert.equal((await h.request()).status, 503, 'do not use an invalid cache as recovery');
    h.state.offline = true;
    await assert.rejects(h.request(), /fixture offline/);
  });
  test(label + ': origin, method, path and query boundaries stay scoped', async () => {
    const h = workerHarness(file, scope); h.seed('index.html'); h.state.status = 503;
    assert.equal((await h.request('index.html?launch=homescreen')).status, 200);
    assert.equal(h.writes.length, 0);
    for (const url of ['https://other.test/index.html', '/api/road', '../index.html', 'unknown.html', 'mdl-worker.enc.json']) {
      assert.equal(h.request(url), undefined, url);
    }
    assert.equal(h.request('index.html', 'POST'), undefined);
  });
}

for (const scope of ['/bd-chessdb/F4M/', '/F4M/', '/f4m/']) {
  for (const edition of ['', 'new/', 'PWA/']) {
    test('Flip4M navigation keeps host prefix and case: ' + scope + edition, async () => {
      const folder = path.join(root, 'public/F4M', edition);
      const dom = new JSDOM(fs.readFileSync(path.join(folder, 'index.html'), 'utf8'), {
        url: 'https://example.test' + scope + edition,
        runScripts: 'outside-only'
      });
      try {
        await new Promise(resolve => dom.window.addEventListener('load', resolve));
        for (const file of ['f4m-classical.js', 'f4m-store.js']) dom.window.eval(fs.readFileSync(path.join(folder, file), 'utf8'));
        dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
        await new Promise(resolve => dom.window.setTimeout(resolve, 10));
        const doc = dom.window.document;
        assert.equal(new URL(doc.querySelector('[data-i18n=about]').href).pathname, scope + 'f4m/');
        const links = [...doc.querySelectorAll('#bd-version-nav a')];
        assert.deepEqual(links.map(a => new URL(a.href).pathname), ['', 'old/', 'new/', 'PWA/'].map(p => scope + p));
        assert.equal(doc.querySelector('#bd-version-nav [aria-current=page]').textContent, edition === 'new/' ? 'LAB' : edition === 'PWA/' ? 'PWA' : 'CURRENT');
        if (!edition) assert.equal(new URL(doc.querySelector('[data-primary-old]').href).pathname, scope + 'old/');
      } finally { dom.window.close(); }
    });
  }
}

for (const edition of ['PWA', 'new']) {
test('Sudoku ' + edition + ' Phase 1 copy identifies the actual metric and its limits', () => {
  const html = fs.readFileSync(path.join(root, 'public/S', edition, 'app.html'), 'utf8');
  const dom = new JSDOM(html);
  try {
    const section = dom.window.document.getElementById('cbP1').textContent;
    assert.match(section, /LZ_process[^\n]*0\.786/);
    assert.match(section, /n_guesses[^\n]*0\.853/);
    assert.match(section, /does not establish causality or domain independence/);
    assert.doesNotMatch(section, /The kernel is domain-independent/);
    assert.doesNotMatch(dom.window.document.getElementById('chP1').textContent, /Hypothesis Confirmed/);
  } finally { dom.window.close(); }
});
}

test('Public research summaries distinguish the Sudoku metrics and link the reported table', () => {
  for (const file of ['public/crp/MDLxDCC.html', 'public/crp/AC_AA.html']) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    const dom = new JSDOM(html);
    try {
      assert(dom.window.document.querySelector('a[href="../S/PWA/app.html#cbP1"]'), file);
      assert.match(html, /0\.853[^<]*n_guesses/);
      assert.match(html, /0\.786[^<]*LZ_process/);
    } finally { dom.window.close(); }
  }
  const aa = fs.readFileSync(path.join(root, 'public/crp/AC_AA.html'), 'utf8');
  assert.doesNotMatch(aa, /ρ &gt; 0\.80 on two NP-complete domains/);
  assert.match(aa, /not a completed structure validation of all 50 genomes/);
});
