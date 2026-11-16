'use strict';
// /llms/ page: load the shipped JSON exactly the way the page does (relative fetch from the
// page URL), run the page's own scripts in jsdom and check that every table renders non-empty.
// Run: node --test tests/llms-page.test.cjs   (needs jsdom: npm ci, or NODE_PATH to a jsdom install)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const DIR = path.resolve(__dirname, '..', 'public', 'llms');
const HTML = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const read = name => JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8'));
const META = read('meta_index.json');
const SRC = read('sources.json');
const COM = read('commentary_sl.json');

async function boot(url, lang) {
  const requested = [];
  const errors = [];
  const dom = new JSDOM(HTML, {
    url, runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(window) {
      if (lang) window.localStorage.setItem('mdlxdcc-lang', lang);
      window.fetch = async (u) => {
        const abs = new URL(u, window.location.href);
        requested.push(abs.pathname);
        const m = /(?:^|\/)llms\/((?:data\/\d{4}-\d{2}-\d{2}\/)?(?:meta_index|sources|commentary_sl)|captures)\.json$/.exec(abs.pathname);
        if (!m) return { ok: false, status: 404, json: async () => { throw new Error('404'); } };
        const text = fs.readFileSync(path.join(DIR, m[1] + '.json'), 'utf8');
        return { ok: true, status: 200, json: async () => JSON.parse(text) };
      };
      window.addEventListener('error', e => errors.push(String(e.message || e.error)));
    }
  });
  const { window } = dom;
  await window.__llmsReady;
  return { window, doc: window.document, requested, errors };
}
const rows = (doc, id) => doc.querySelectorAll('#' + id + ' tbody tr').length;
const cellText = (doc, sel) => (doc.querySelector(sel) || {}).textContent || '';

test('shipped JSON matches the schema the page reads', () => {
  assert.equal(META.schema, 'ai8-llm-meta-index-v1');
  assert.equal(SRC.schema, 'ai8-llm-meta-sources-v1');
  assert.equal(COM.schema, 'ai8-llm-meta-commentary-v1');
  assert.match(META.data_fetched, /^\d{4}-\d{2}-\d{2}$/);
  const ranked = META.models.filter(m => m.overall_rank);
  assert.ok(ranked.length >= 20, 'at least 20 ranked models');
  assert.equal(ranked.length, META.counts.models_ranked);
  assert.equal(META.ranking.length, ranked.length);
  const ids = new Set(META.models.map(m => m.model_id));
  for (const id of META.ranking) assert.ok(ids.has(id), 'ranking id in models: ' + id);
  for (const k of ['reasoning', 'coding', 'agentic', 'knowledge', 'preference', 'multilingual'])
    assert.ok(META.models.some(m => m.categories && m.categories[k]), 'category has data: ' + k);
  assert.ok(META.models.some(m => m.output_tokens_per_s), 'speed data');
  assert.ok(META.models.some(m => m.slovenian != null), 'Slovenian data');
  assert.ok(SRC.accepted.length >= 10 && SRC.rejected.length >= 1);
  assert.equal(SRC.accepted.length, META.counts.sources_accepted);
  // No raw scraped pages and nothing secret-looking in the shipped data.
  for (const f of fs.readdirSync(DIR)) assert.ok(['index.html', 'chats.html', 'meta_index.json', 'sources.json', 'commentary_sl.json', 'captures.json', 'data'].includes(f), 'unexpected file ' + f);
  // Every capture stays published (BD, 2026-11-16): captures.json lists them newest first, each has its three files,
  // and the root files are the latest capture.
  const CAPS = JSON.parse(fs.readFileSync(path.join(DIR, 'captures.json'), 'utf8'));
  assert.equal(CAPS.schema, 'ai8-llm-meta-captures-v1');
  assert.ok(CAPS.captures.length >= 2 && CAPS.captures.some(c => c.date === '2026-10-30'), 'the 30. 10. capture is kept');
  assert.equal(CAPS.latest, CAPS.captures[0].date);
  assert.equal(META.data_fetched, CAPS.latest);
  for (const c of CAPS.captures) {
    assert.equal(c.path, 'data/' + c.date + '/');
    for (const n of ['meta_index.json', 'sources.json', 'commentary_sl.json']) {
      const p = path.join(DIR, 'data', c.date, n);
      assert.ok(fs.existsSync(p), 'capture file ' + c.date + '/' + n);
      if (c.date === CAPS.latest) assert.ok(fs.readFileSync(p).equals(fs.readFileSync(path.join(DIR, n))), 'root = latest capture: ' + n);
    }
    assert.equal(JSON.parse(fs.readFileSync(path.join(DIR, 'data', c.date, 'meta_index.json'), 'utf8')).data_fetched, c.date);
  }
  for (const d of fs.readdirSync(path.join(DIR, 'data'))) assert.ok(CAPS.captures.some(c => c.date === d), 'listed capture ' + d);
  const all = HTML + JSON.stringify(META) + JSON.stringify(SRC) + JSON.stringify(COM);
  assert.equal(/sk-ant-|ghp_[A-Za-z0-9]{20}|AIza[0-9A-Za-z_-]{30}|BD_GDrive|rclone\.conf|refresh_token/.test(all), false);
});

test('page renders every table from its own data (SL)', async () => {
  const { window, doc, requested, errors } = await boot('https://www.mdlxdcc.org/llms/');
  assert.deepEqual(errors, []);
  assert.deepEqual(requested.slice().sort(), ['/llms/captures.json', '/llms/commentary_sl.json', '/llms/meta_index.json', '/llms/sources.json']);
  assert.equal(doc.getElementById('status').textContent, '');
  const ranked = META.models.filter(m => m.overall_rank).length;
  assert.equal(rows(doc, 'overall'), Math.min(40, ranked));
  assert.equal(cellText(doc, '#overall tbody tr .mid'), META.ranking[0]);
  doc.getElementById('all-toggle').click();
  assert.equal(rows(doc, 'overall'), ranked);
  doc.querySelector('#overall button[data-model]').click();
  assert.equal(doc.querySelectorAll('#overall tr.detail').length, 1);
  assert.ok(doc.querySelectorAll('#overall tr.detail table.bs tbody tr').length > 0, 'board scores in detail');
  assert.equal(rows(doc, 'tiers'), Object.keys(META.value_tiers).length);
  const tabs = [...doc.querySelectorAll('#tabs button[data-cat]')].map(b => b.getAttribute('data-cat'));
  assert.deepEqual(tabs, ['reasoning', 'coding', 'agentic', 'knowledge', 'preference', 'multilingual', 'sl', 'long_context', 'speed']);
  for (const c of tabs) {
    doc.querySelector('#tabs button[data-cat="' + c + '"]').click();
    const n = rows(doc, 'cattable');
    assert.ok(n > 0, 'category table rows: ' + c);
    assert.ok(doc.querySelector('#cattable tbody tr .mid'), 'category table has models: ' + c);
    assert.ok(doc.getElementById('catdesc').textContent.length > 20, 'category description: ' + c);
  }
  assert.equal(rows(doc, 'disagree'), META.disagreements.length);
  assert.ok(META.disagreements.length > 0);
  assert.equal(rows(doc, 'boardleaders'), META.board_leaders.length);
  assert.ok(doc.getElementById('disagree-text').textContent.length > 50, 'disagreement commentary');
  assert.ok(doc.getElementById('commentary').textContent.length > 200, 'commentary');
  assert.equal(doc.querySelectorAll('#accepted details.src').length, SRC.accepted.length);
  assert.equal(doc.querySelectorAll('#rejected li').length, SRC.rejected.length);
  assert.ok(doc.querySelectorAll('#leaders li').length >= 7);
  assert.equal(rows(doc, 'weights'), Object.keys(META.config.category_weights).length);
  assert.match(doc.getElementById('strip-text').textContent, /^Podatki zbrani: \d+\. \d+\. \d{4}$/);
  // No automatic refresh: the page must not promise one (BD, 2026-11-16).
  assert.doesNotMatch(HTML, /Naslednja osvežitev|Next refresh|samodejno vsak|refreshes automatically|· mesečno|refreshed monthly/);
  assert.equal(doc.querySelector('[data-k="sources_accepted"]').textContent, String(META.counts.sources_accepted));
  for (const a of doc.querySelectorAll('#accepted a[href], #rejected a[href]')) assert.match(a.getAttribute('href'), /^https?:\/\//);
  // Language toggle re-renders the dynamic parts.
  doc.querySelector('[data-ai8-lang="en"]').click();
  await new Promise(r => window.setTimeout(r, 0)); // MutationObserver callback
  assert.equal(doc.documentElement.lang, 'en');
  assert.match(doc.getElementById('strip-text').textContent, /^Data collected: \d+ \w+ \d{4}$/);
  assert.match(cellText(doc, '#overall thead'), /Overall/);
  assert.equal(doc.title, 'LLM meta-index — which model is really the best');
  window.close();
});

test('relative data path works without trailing slash and on GitHub Pages', async () => {
  for (const [url, prefix] of [['https://www.mdlxdcc.org/llms', '/llms/'], ['https://bd-chess.github.io/bd-chessdb/llms/', '/bd-chessdb/llms/'], ['https://www.mdlxdcc.org/llms/index.html', '/llms/']]) {
    const { window, doc, requested } = await boot(url, 'en');
    assert.ok(requested.every(p => p.startsWith(prefix)), url + ' -> ' + requested.join(','));
    assert.ok(rows(doc, 'overall') > 0);
    assert.equal(doc.querySelector('a[data-file="meta_index.json"]').href, new URL(prefix + 'meta_index.json', url).href);
    window.close();
  }
});

test('site brand, Gemini 4 note, sortable headers, provider filter and URL state', async () => {
  const { window, doc, errors } = await boot('https://www.mdlxdcc.org/llms/');
  assert.deepEqual(errors, []);
  // Brand: MDL×DCC.org | BD×AI Lab, as on the landing page.
  assert.equal(doc.querySelector('.site-header .brand-mark').textContent, 'MDL×DCC.org');
  assert.equal(doc.querySelector('.site-header .brand-sub').textContent.replace(/\s+/g, ''), 'BD×AILab');
  assert.equal(doc.querySelector('.site-header .brand-sub a').getAttribute('href'), 'https://www.mdlxdcc.org/start/');
  // New models: Gemini 4 Hydrogen is ranked in the 16. 11. 2026 build, so while it is new the note shows its rank.
  const hy = META.models.find(m => m.model_id === 'gemini-4-hydrogen');
  assert.ok(hy && hy.overall_rank, 'Hydrogen is ranked in the latest build');
  if ((Date.now() - Date.UTC(2026, 10, 12)) / 864e5 <= 59) {
    assert.equal(doc.getElementById('newbox').hidden, false);
    assert.match(doc.getElementById('newbox').textContent, new RegExp('gemini-4-hydrogen — izšel 12\\. 11\\. 2026 · #' + hy.overall_rank + ' '));
  }

  const ranked = META.models.filter(m => m.overall_rank);
  const firstMid = id => cellText(doc, '#' + id + ' tbody tr .mid');
  const ariaOf = (id, k) => doc.querySelector('#' + id + ' button.sortb[data-sort="' + k + '"]').closest('th').getAttribute('aria-sort');
  const sortBy = (id, k) => doc.querySelector('#' + id + ' button.sortb[data-sort="' + k + '"]').click();
  // First click on price: cheapest first; second click: most expensive first; models without a price stay last.
  sortBy('overall', 'price');
  assert.equal(ariaOf('overall', 'price'), 'ascending');
  const priced = ranked.filter(m => m.price).sort((a, b) => a.price.blended_3to1 - b.price.blended_3to1);
  assert.equal(META.models.find(m => m.model_id === firstMid('overall')).price.blended_3to1, priced[0].price.blended_3to1);
  sortBy('overall', 'price');
  assert.equal(ariaOf('overall', 'price'), 'descending');
  assert.equal(META.models.find(m => m.model_id === firstMid('overall')).price.blended_3to1, priced[priced.length - 1].price.blended_3to1);
  doc.getElementById('all-toggle').click();
  const trs = [...doc.querySelectorAll('#overall tbody tr')];
  const lastId = trs[trs.length - 1].querySelector('.mid').textContent;
  if (ranked.some(m => !m.price)) assert.equal(META.models.find(m => m.model_id === lastId).price, null);
  // Rank numbers stay the fixed overall ranks after sorting.
  for (const tr of trs.slice(0, 10)) assert.equal(tr.querySelector('.rk').textContent, String(META.models.find(m => m.model_id === tr.querySelector('.mid').textContent).overall_rank));
  // First click on a score column: highest first.
  sortBy('overall', 'overall');
  assert.equal(ariaOf('overall', 'overall'), 'descending');
  assert.equal(firstMid('overall'), META.ranking[0]);
  // Every model table has sortable headers.
  for (const id of ['overall', 'cattable', 'disagree', 'boardleaders', 'weights']) assert.ok(doc.querySelectorAll('#' + id + ' th button.sortb').length >= 2, 'sortable headers: ' + id);

  // Provider filter: Anthropic only, then its best model only.
  doc.querySelector('#vchips button[data-vendor="Anthropic"]').click();
  const anth = ranked.filter(m => m.vendor === 'Anthropic');
  assert.equal(rows(doc, 'overall'), anth.length);
  for (const s of doc.querySelectorAll('#overall tbody tr .sub')) assert.match(s.textContent, /^Anthropic/);
  const sel = doc.getElementById('vtop');
  sel.value = '1';
  sel.dispatchEvent(new window.Event('change'));
  assert.equal(rows(doc, 'overall'), 1);
  assert.match(window.location.search, /v=Anthropic/);
  assert.match(window.location.search, /top=1/);
  assert.equal([...doc.querySelectorAll('[data-fnote]')].filter(n => !n.hidden).length, 3);
  doc.querySelector('#tabs button[data-cat="coding"]').click();
  assert.equal(rows(doc, 'cattable'), 1);
  assert.match(window.location.search, /cat=coding/);
  doc.querySelector('[data-fclear]').click();
  assert.equal(rows(doc, 'overall'), ranked.length); // "show all ranked" was switched on above
  assert.equal(doc.getElementById('all-toggle').hidden, false);
  assert.doesNotMatch(window.location.search, /v=|top=/);
  window.close();

  // The same view opens again from its link.
  const b = await boot('https://www.mdlxdcc.org/llms/?v=Anthropic,Google&top=1&cat=coding&s=price.a&cs=overall.d');
  assert.deepEqual(b.errors, []);
  assert.deepEqual([...b.doc.querySelectorAll('#vchips button[aria-pressed="true"]')].map(x => x.getAttribute('data-vendor')).sort(), ['Anthropic', 'Google']);
  assert.equal(b.doc.getElementById('vtop').value, '1');
  assert.equal(rows(b.doc, 'overall'), 2);
  assert.equal(b.doc.querySelector('#overall button.sortb[data-sort="price"]').closest('th').getAttribute('aria-sort'), 'ascending');
  assert.equal(b.doc.querySelector('#tabs button[aria-pressed="true"]').getAttribute('data-cat'), 'coding');
  assert.equal(b.doc.querySelector('#cattable button.sortb[data-sort="overall"]').closest('th').getAttribute('aria-sort'), 'descending');
  b.window.close();
});

test('older captures stay available: ?d= loads them and the list switches between dates', async () => {
  const CAPS = JSON.parse(fs.readFileSync(path.join(DIR, 'captures.json'), 'utf8'));
  const OLD = JSON.parse(fs.readFileSync(path.join(DIR, 'data', '2026-10-30', 'meta_index.json'), 'utf8'));
  const { window, doc, requested, errors } = await boot('https://www.mdlxdcc.org/llms/?d=2026-10-30');
  assert.deepEqual(errors, []);
  assert.ok(requested.includes('/llms/data/2026-10-30/meta_index.json'), requested.join(','));
  assert.ok(!requested.includes('/llms/meta_index.json'));
  assert.match(doc.getElementById('strip-text').textContent, /^Podatki zbrani: 30\. 10\. 2026$/);
  assert.equal(cellText(doc, '#overall tbody tr .mid'), OLD.ranking[0]);
  const sel = doc.getElementById('cap-sel');
  assert.equal(doc.getElementById('cap-pick').hidden, false);
  assert.equal(sel.value, '2026-10-30');
  assert.equal(sel.options.length, CAPS.captures.length);
  assert.equal(doc.getElementById('strip-warn').hidden, false, 'older capture is marked');
  assert.equal(doc.querySelector('a[data-file="meta_index.json"]').getAttribute('href'), 'data/2026-10-30/meta_index.json');
  // Hydrogen came out after this capture, so the note lists it without numbers.
  assert.match(doc.getElementById('newbox').textContent, /gemini-4-hydrogen — izšel 12\. 11\. 2026 · po zadnjem zajemu podatkov/);
  window.close();
  const b = await boot('https://www.mdlxdcc.org/llms/?d=1999-01-01');
  assert.deepEqual(b.errors, []);
  assert.equal(b.doc.getElementById('cap-sel').value, CAPS.latest, 'an unknown date falls back to the latest capture');
  assert.ok(b.requested.includes('/llms/meta_index.json'));
  b.window.close();
});
