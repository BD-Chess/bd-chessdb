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
        const m = /(?:^|\/)llms\/(meta_index|sources|commentary_sl)\.json$/.exec(abs.pathname);
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
  for (const f of fs.readdirSync(DIR)) assert.ok(['index.html', 'meta_index.json', 'sources.json', 'commentary_sl.json'].includes(f), 'unexpected file ' + f);
  const all = HTML + JSON.stringify(META) + JSON.stringify(SRC) + JSON.stringify(COM);
  assert.equal(/sk-ant-|ghp_[A-Za-z0-9]{20}|AIza[0-9A-Za-z_-]{30}|BD_GDrive|rclone\.conf|refresh_token/.test(all), false);
});

test('page renders every table from its own data (SL)', async () => {
  const { window, doc, requested, errors } = await boot('https://www.mdlxdcc.org/llms/');
  assert.deepEqual(errors, []);
  assert.deepEqual(requested.slice().sort(), ['/llms/commentary_sl.json', '/llms/meta_index.json', '/llms/sources.json']);
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
  assert.match(doc.getElementById('strip-text').textContent, /Podatki zbrani: .+ · Naslednja osvežitev: 1\. \d+\. \d{4}/);
  assert.equal(doc.querySelector('[data-k="sources_accepted"]').textContent, String(META.counts.sources_accepted));
  for (const a of doc.querySelectorAll('#accepted a[href], #rejected a[href]')) assert.match(a.getAttribute('href'), /^https?:\/\//);
  // Language toggle re-renders the dynamic parts.
  doc.querySelector('[data-ai8-lang="en"]').click();
  await new Promise(r => window.setTimeout(r, 0)); // MutationObserver callback
  assert.equal(doc.documentElement.lang, 'en');
  assert.match(doc.getElementById('strip-text').textContent, /Data collected: .+ · Next refresh: 1 \w+ \d{4}/);
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
