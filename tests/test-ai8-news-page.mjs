import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';

const read = file => readFileSync(new URL('../public/news/' + file, import.meta.url));
const html = read('index.html').toString('utf8');
const source = read('news-hub.js').toString('utf8');
const catalog = JSON.parse(read('catalog.json'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

// This small DOM fixture exercises the page's complete event flow without
// opening a browser, calling a provider or depending on an installed extension.
class Element {
  constructor(tag = 'div', id = '') {
    this.tagName = tag.toUpperCase(); this.id = id; this.children = [];
    this.value = ''; this._text = ''; this.className = ''; this.hidden = false;
    this.disabled = false; this.attributes = {}; this.handlers = new Map();
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(x => x.textContent).join(''); }
  set innerHTML(_value) { throw Error('Untrusted result must not be parsed as HTML'); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this._text = ''; this.children = [...nodes]; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; if (name === 'href') delete this.href; }
  addEventListener(type, callback) { this.handlers.set(type, callback); }
  fire(type) { this.handlers.get(type)?.({target: this, isTrusted: false}); }
  querySelector(selector) {
    const match = node => selector[0] === '.' && node.className.split(/\s+/).includes(selector.slice(1));
    const walk = node => {
      for (const child of node.children) { if (match(child)) return child; const found = walk(child); if (found) return found; }
      return null;
    };
    return walk(this);
  }
}

async function page(search = '', fetchOk = true) {
  const nodes = new Map();
  for (const match of html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)) {
    const e = new Element(match[1], match[3]);
    e.hidden = /\bhidden\b/.test(match[2]); e.disabled = /\bdisabled\b/.test(match[2]);
    assert(!nodes.has(e.id), 'duplicate DOM ID: ' + e.id); nodes.set(e.id, e);
  }
  for (const id of ['gpt', 'claude']) {
    const status = new Element('span'); status.className = 'voice-status';
    const body = new Element('div'); body.className = 'voice-body';
    nodes.get(id + '-opinion').append(status, body);
  }
  nodes.get('ai8-kind').value = 'ground-summary';
  nodes.get('archive-latest').href = 'archive.html';
  const handlers = new Map(); const fetches = [];
  const location = {origin: 'https://www.mdlxdcc.org', href: 'https://www.mdlxdcc.org/news/' + search, search: search.split('#')[0], hash: search.includes('#') ? '#' + search.split('#')[1] : '', replace(url) { this.replaced = url; }};
  const window = {addEventListener(type, handler) { handlers.set(type, handler); }, postMessage() { throw Error('The public page may not invoke native analysis'); }};
  const context = {document: {getElementById: id => nodes.get(id), createElement: tag => new Element(tag)}, window, location, URL, URLSearchParams, Intl, Date, Object, console, fetch: async (url, options) => { fetches.push([url, options]); return {ok: fetchOk, json: async () => structuredClone(catalog)}; }};
  runInNewContext(source, context, {timeout: 1000});
  await new Promise(resolve => setImmediate(resolve));
  const send = (type, payload, override = {}) => handlers.get('message')?.({source: window, origin: location.origin, data: {source: 'ai8-news-extension', type, payload}, ...override});
  const fill = () => { nodes.get('ai8-url').value = 'https://ground.news/article/example'; nodes.get('ai8-title').value = 'A chosen story'; nodes.get('ai8-text').value = 'Source text to compare.'; };
  return {$: id => nodes.get(id), send, fill, location, window, fetches};
}

const analysis = (opinion = 'A separate opinion.') => ({summary: 'A source-based summary.', opinion, reasons: ['A reason.'], uncertainties: ['An uncertainty.'], questions: ['A question?']});
const result = requestId => ({requestId, article: {url: 'https://example.com/story', title: 'Chosen source', inputKind: 'article', sha256: 'a'.repeat(64)}, results: {gpt: {status: 'ok', analysis: analysis('GPT opinion.')}, claude: {status: 'ok', analysis: analysis('Claude opinion.')}}, cached: false, createdAt: '2026-11-07T01:00:00Z'});

test('Ground News is an explicit external gateway; analysis has the extension DOM contract and no iframe', () => {
  assert.match(html, /href="https:\/\/ground\.news\/" target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /<iframe\b/i);
  for (const [id, tag] of [['ai8-url', 'input'], ['ai8-title', 'input'], ['ai8-text', 'textarea'], ['ai8-kind', 'select'], ['ai8-analyze', 'button']]) assert.match(html, new RegExp('<' + tag + '\\b[^>]*id="' + id + '"'));
  assert.match(html, /id="ai8-analyze" type="button" disabled/);
  for (const value of ['ground-summary', 'article', 'selection', 'manual']) assert.match(html, new RegExp('value="' + value + '"'));
  assert.match(html, /Nove lastne dnevne izdaje so v premoru/);
});

test('all published daily edition bytes and the old reader remain preserved behind the archive', () => {
  const expected = {'2026-10-26.json': '3998ca1deebfc4aabd10cf37e118717cdee7b5cb53fee3aa202e632c2eea86b3', '2026-10-27-r2.json': '101ba18b4a8fc8e800cad1c8457160cd81b5defe8aecdb4559e354b017dd2c33', '2026-10-27-r4.json': 'c843ef8285eb0402b159ce0e3c9e3b4c83c716f812432d6a736e56c7d0af6093', '2026-10-28.json': '699549aaaac01b3818fda40eb37c3292aa3fed794af038b99b95696d439cd662', '2026-10-29.json': '101e87b35131b3423ef0856476a756615b7fd102c4689790bc8d48263bdb8b34', '2026-10-30.json': 'd825e3afe65290ba6656b1abda2827c0dcc5ac88f98123320f5c899a9d5db40e', '2026-10-31.json': '678d72bce85911eea644b9c351639b918c3fd534db26cdf82947aeda88c5ca2b'};
  for (const [file, hash] of Object.entries(expected)) {
    assert.equal(sha(read('days/' + file)), hash);
    assert(catalog.editions.some(e => e.path === 'days/' + file && e.sha256 === hash));
  }
  assert.equal(sha(read('app.js')), '4e852200b030a858be7db39d1913c3f21d48d5fb1ce2c26b1105064d9e8f47fa');
  assert.equal(sha(read('style.css')), '11c12ad6ca4362ab73801bf4cc80e496e5b264b68fdb4ce17350ff6402309483');
  const archive = read('archive.html').toString('utf8');
  for (const id of ['date', 'archive', 'sections', 'status', 'content']) assert.match(archive, new RegExp('id="' + id + '"'));
  assert.match(archive, /src="app\.js"/);
  assert.match(archive, /world-top10-2026-10-24\.html/);
  assert.match(archive, /slovenia-top10-2026-10-24\.html/);
});

test('legacy dated URLs retain date, section and fragment in the archived reader', async () => {
  const p = await page('?date=2026-10-31&section=science-tech#source');
  assert.equal(p.location.replaced, 'https://www.mdlxdcc.org/news/archive.html?date=2026-10-31&section=science-tech#source');
  assert.equal(p.fetches.length, 0);
});

test('visitors get honest setup state, archive date and no automatic provider request', async () => {
  const p = await page();
  assert.equal(p.$('ai8-analyze').disabled, true);
  assert.equal(p.$('ai8-results').hidden, true);
  assert.equal(p.fetches.length, 1); assert.equal(p.fetches[0][0], 'catalog.json');
  assert.equal(p.$('archive-latest').href, 'archive.html?date=' + catalog.latest_published_date);
  p.send('ready', {installed: true, nativeHostAvailable: false});
  assert.equal(p.$('ai8-analyze').disabled, true);
  assert.match(p.$('connection-title').textContent, /potrebuje povezovalnik/);
  p.send('ready', {installed: true, nativeHostAvailable: true});
  assert.equal(p.$('ai8-analyze').disabled, false);
  assert.match(p.$('connection-title').textContent, /Povezovalnik je pripravljen/);
  assert.equal(p.fetches.length, 1);
  const offline = await page('', false);
  assert.equal(offline.$('archive-latest').href, 'archive.html');
});

test('unrelated origin, frame and source messages cannot change connection state', async () => {
  const p = await page(); const payload = {installed: true, nativeHostAvailable: true};
  p.send('ready', payload, {origin: 'https://other.example'});
  p.send('ready', payload, {source: {}});
  p.send('ready', payload, {data: {source: 'other', type: 'ready', payload}});
  assert.equal(p.$('ai8-analyze').disabled, true);
});

test('input scope and required source validation stay explicit for all four input kinds', async () => {
  const p = await page(); p.send('ready', {installed: true, nativeHostAvailable: true}); p.fill();
  p.$('ai8-title').value = ''; p.$('ai8-analyze').fire('click'); assert.match(p.$('analysis-status').textContent, /naslov/);
  p.fill(); p.$('ai8-url').value = 'javascript:alert(1)'; p.$('ai8-analyze').fire('click'); assert.match(p.$('analysis-status').textContent, /http ali https/);
  p.fill(); p.$('ai8-url').value = 'https://example.com/story'; p.$('ai8-analyze').fire('click'); assert.match(p.$('analysis-status').textContent, /ground\.news\/article/);
  p.$('ai8-kind').value = 'article'; p.$('ai8-kind').fire('change'); p.$('ai8-analyze').fire('click'); assert.match(p.$('analysis-status').textContent, /Čakam na lokalni povezovalnik/);
  p.$('ai8-kind').value = 'selection'; p.$('ai8-kind').fire('change'); assert.match(p.$('input-scope').textContent, /odlomek/);
  p.$('ai8-kind').value = 'manual'; p.$('ai8-kind').fire('change'); assert.match(p.$('input-scope').textContent, /ročni vnos/);
  p.$('ai8-text').value = ''; p.$('ai8-analyze').fire('click'); assert.match(p.$('analysis-status').textContent, /dodaj besedilo/);
});

test('progress and matching results render separate opinions; stale request messages are ignored', async () => {
  const p = await page(); p.send('ready', {nativeHostAvailable: true}); p.fill(); p.$('ai8-analyze').fire('click');
  p.send('progress', {requestId: 'current', message: 'Two agents working'});
  assert.equal(p.$('ai8-analyze').disabled, true);
  p.send('progress', {requestId: 'stale', message: 'Wrong progress'});
  assert.equal(p.$('analysis-status').textContent, 'Two agents working');
  p.send('result', result('stale')); assert.equal(p.$('ai8-results').hidden, true);
  p.send('result', result('current'));
  assert.equal(p.$('ai8-results').hidden, false); assert.equal(p.$('ai8-analyze').disabled, false);
  assert.match(p.$('gpt-opinion').textContent, /GPT opinion/); assert.doesNotMatch(p.$('gpt-opinion').textContent, /Claude opinion/);
  assert.match(p.$('claude-opinion').textContent, /Claude opinion/);
  assert.match(p.$('result-scope').textContent, /Besedilo članka/); assert.equal(p.$('result-sha').textContent, 'a'.repeat(64));
});

test('one failed voice never hides the other opinion and cached analysis retains its source metadata', async () => {
  const p = await page(); p.send('ready', {nativeHostAvailable: true}); p.send('progress', {requestId: 'partial'});
  const r = result('partial'); r.results.claude = {status: 'error', error: 'Claude login required'}; r.cached = true;
  p.send('result', r);
  assert.match(p.$('gpt-opinion').textContent, /GPT opinion/);
  assert.match(p.$('claude-opinion').textContent, /Claude login required/);
  assert.match(p.$('result-time').textContent, /Shranjena analiza/);
  assert.equal(p.$('result-title').textContent, 'Chosen source');
});

test('untrusted model and article strings remain literal text; unsafe source URLs never become links', async () => {
  const p = await page(); p.send('ready', {nativeHostAvailable: true}); p.send('progress', {requestId: 'xss'});
  const attack = '<img src=x onerror=alert(1)>';
  const r = result('xss'); r.article.url = 'javascript:alert(1)'; r.article.title = attack; r.article.sha256 = attack;
  r.results.gpt.analysis = analysis(attack); r.results.gpt.analysis.reasons = [attack]; r.results.claude.analysis = analysis('<script>bad()</script>');
  p.send('result', r);
  assert.equal(p.$('result-title').textContent, attack);
  assert.equal(p.$('result-url').hidden, true); assert.equal(p.$('result-url').href, undefined); assert.equal(p.$('result-integrity').hidden, true);
  assert.match(p.$('gpt-opinion').textContent, /<img src=x onerror=alert\(1\)>/);
  const tags = node => [node.tagName, ...node.children.flatMap(tags)];
  assert(!tags(p.$('gpt-opinion')).includes('IMG')); assert(!tags(p.$('claude-opinion')).includes('SCRIPT'));
});

test('errors release busy state without accepting mismatched results or running a provider', async () => {
  const p = await page(); p.send('ready', {nativeHostAvailable: true}); p.send('progress', {requestId: 'error'});
  p.send('error', {requestId: 'old', message: 'Ignore me'}); assert.equal(p.$('ai8-analyze').disabled, true);
  p.send('error', {requestId: 'error', message: 'Local helper unavailable'});
  assert.equal(p.$('ai8-analyze').disabled, false); assert.match(p.$('analysis-status').textContent, /Local helper unavailable/);
  assert.equal(p.fetches.length, 1);
});
