import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
const read = file => readFileSync(new URL('../public/news/' + file, import.meta.url));
const html = read('index.html').toString('utf8');
const source = read('news-hub.js').toString('utf8');
const catalog = JSON.parse(read('catalog.json'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
class Element {
  constructor(tag = 'div', id = '') { this.tagName = tag.toUpperCase(); this.id = id; this.children = []; this.value = ''; this._text = ''; this.className = ''; this.hidden = false; this.disabled = false; this.attributes = {}; this.handlers = new Map(); }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(x => x.textContent).join(''); }
  set innerHTML(_) { throw Error('Untrusted data must not be parsed as HTML'); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this._text = ''; this.children = [...nodes]; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; if (name === 'href') delete this.href; }
  addEventListener(type, callback) { this.handlers.set(type, callback); }
  fire(type, extra = {}) { return this.handlers.get(type)?.({target: this, isTrusted: false, preventDefault() {}, ...extra}); }
  querySelector(selector) { const walk = n => { for (const c of n.children) { if (selector[0] === '.' && c.className.split(/\s+/).includes(selector.slice(1))) return c; const found = walk(c); if (found) return found; } return null; }; return walk(this); }
}
const tick = () => new Promise(resolve => setImmediate(resolve));
async function page({search = '', sourceFetch} = {}) {
  const nodes = new Map();
  for (const match of html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)) {
    const e = new Element(match[1], match[3]); e.hidden = /\bhidden\b/.test(match[2]); e.disabled = /\bdisabled\b/.test(match[2]);
    e.value = /\bvalue="([^"]*)"/.exec(match[2])?.[1] || ''; e.src = /\bsrc="([^"]*)"/.exec(match[2])?.[1];
    assert(!nodes.has(e.id), 'duplicate ID ' + e.id); nodes.set(e.id, e);
  }
  for (const id of ['gpt', 'claude']) { const status = new Element('span'); status.className = 'voice-status'; const body = new Element('div'); body.className = 'voice-body'; nodes.get(id + '-opinion').append(status, body); }
  nodes.get('ai8-kind').value = 'ground-summary'; nodes.get('archive-latest').href = 'archive.html';
  const handlers = new Map(), fetches = [];
  const location = {origin: 'https://www.mdlxdcc.org', href: 'https://www.mdlxdcc.org/news/' + search, search: search.split('#')[0], hash: search.includes('#') ? '#' + search.split('#')[1] : '', replace(url) { this.replaced = url; }};
  const window = {addEventListener(type, handler) { handlers.set(type, handler); }, postMessage() { throw Error('Page must not invoke native analysis'); }};
  const fetch = async (url, options) => { fetches.push([url, options]); return url === 'catalog.json' ? {ok: true, json: async () => structuredClone(catalog)} : sourceFetch ? sourceFetch(url, options) : {ok: false, json: async () => ({ok: false, error: 'No readable public text'})}; };
  runInNewContext(source, {document: {getElementById: id => nodes.get(id), createElement: tag => new Element(tag)}, window, location, URL, URLSearchParams, Intl, Date, Object, console, fetch, setTimeout, clearTimeout, AbortController}, {timeout: 1000});
  await tick();
  const send = (type, payload, override = {}) => handlers.get('message')?.({source: window, origin: location.origin, data: {source: 'ai8-news-extension', type, payload}, ...override});
  const fill = () => { nodes.get('ai8-source-mode').value = 'url'; nodes.get('ai8-url').value = 'https://ground.news/article/example'; nodes.get('ai8-title').value = 'A chosen story'; nodes.get('ai8-text').value = 'Source text to compare.'; };
  return {$: id => nodes.get(id), send, fill, location, fetches};
}
const analysis = opinion => ({summary: 'A source summary.', opinion, reasons: ['A reason.'], uncertainties: ['Unknown.'], questions: ['Why?']});
const result = requestId => ({requestId, requestedModels: ['gpt', 'claude'], article: {url: 'https://example.com/story', title: 'Chosen source', inputKind: 'article', sha256: 'a'.repeat(64)}, results: {gpt: {status: 'ok', analysis: analysis('GPT opinion.')}, claude: {status: 'ok', analysis: analysis('Claude opinion.')}}, cached: false, createdAt: '2026-11-07T01:00:00Z'});
const imported = (url = 'https://example.com/story') => ({url, title: 'A public story', text: 'The publicly available article text.', inputKind: 'article', capturedAt: '2026-11-07T01:00:00Z', extraction: {method: 'article', truncated: true}});
const reply = article => ({ok: true, json: async () => ({ok: true, article})});
const ready = (override = {}) => ({installed: true, nativeHostAvailable: true, extensionVersion: '0.2.0', capabilities: {frameCapture: true, modelSelection: true}, ...override});

test('compact toolbar, Ground iframe and source inspector expose the extension contract', () => {
  assert.match(html, /id="ground-frame" src="https:\/\/ground\.news\/"/);
  for (const id of ['ai8-url', 'ai8-load', 'ai8-current', 'ai8-gpt', 'ai8-claude', 'ai8-analyze', 'ai8-source-mode', 'ai8-title', 'ai8-text', 'ai8-kind', 'source-inspector']) assert.match(html, new RegExp('id="' + id + '"'));
  for (const id of ['ai8-gpt', 'ai8-claude', 'ai8-analyze']) assert.match(html, new RegExp('id="' + id + '" type="button"[^>]*disabled'));
  assert.match(html, /id="ai8-source-mode" type="hidden" value="frame"/);
  assert.match(html, /Nove lastne dnevne izdaje so v premoru/);
  assert.doesNotMatch(html, /class="hero/);
  assert.doesNotMatch(source, /contentWindow|contentDocument|localStorage|sessionStorage/);
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
  const p = await page({search: '?date=2026-10-31&section=science-tech#source'});
  assert.equal(p.location.replaced, 'https://www.mdlxdcc.org/news/archive.html?date=2026-10-31&section=science-tech#source'); assert.equal(p.fetches.length, 0);
});
test('frame mode starts without source text and only native readiness enables analyses', async () => {
  const p = await page(); assert.equal(p.$('ground-frame').src, 'https://ground.news/'); assert.equal(p.$('ai8-source-mode').value, 'frame');
  assert.equal(p.$('ai8-analyze').disabled, true); assert.equal(p.fetches.length, 1); assert.equal(p.fetches[0][0], 'catalog.json');
  p.send('ready', ready({nativeHostAvailable: false, capabilities: {frameCapture: true, modelSelection: false}})); assert.equal(p.$('ai8-analyze').disabled, true); assert.equal(p.$('ai8-current').disabled, false);
  assert.doesNotMatch(p.$('connection-title').textContent, /Posodobi/);
  p.$('ai8-current').fire('click'); assert.match(p.$('analysis-status').textContent, /Pridobivam trenutno novico/); assert.equal(p.$('drawer-status').hidden, true);
  p.send('ready', ready()); p.$('ai8-gpt').fire('click'); assert.match(p.$('analysis-status').textContent, /Čakam na lokalni/); assert.equal(p.$('analysis-drawer').hidden, false); assert.equal(p.fetches.length, 1);
});
test('legacy readiness cannot enable the new toolbar and URL retrieval still works', async () => {
  const p = await page({sourceFetch: async () => reply(imported())});
  p.send('ready', {installed: true, nativeHostAvailable: true});
  for (const id of ['ai8-gpt', 'ai8-claude', 'ai8-analyze', 'ai8-current']) assert.equal(p.$(id).disabled, true);
  assert.match(p.$('connection-title').textContent, /Posodobi AI8 view/); assert.match(p.$('analysis-status').textContent, /Posodobi AI8 view/);
  p.$('ai8-gpt').fire('click'); assert.equal(p.$('ai8-results').hidden, true); assert.equal(p.fetches.length, 1);
  p.$('ai8-url').value = 'https://example.com/story'; await p.$('ai8-load').fire('click');
  assert.equal(p.$('ai8-text').value, imported().text); assert.equal(p.fetches.length, 2);
  assert.equal(p.$('ai8-gpt').disabled, true);
});
test('old native model capability requires a host update while frame capture remains available', async () => {
  const p = await page();
  p.send('ready', ready({capabilities: {frameCapture: true, modelSelection: false}}));
  for (const id of ['ai8-gpt', 'ai8-claude', 'ai8-analyze']) assert.equal(p.$(id).disabled, true);
  assert.equal(p.$('ai8-current').disabled, false); assert.match(p.$('connection-message').textContent, /povezovalnik še ne podpira/);
  p.$('ai8-current').fire('click'); p.send('source', {requestId: 'capture-only', article: {...imported('https://ground.news/article/readable'), inputKind: 'ground-summary'}});
  assert.equal(p.$('ai8-text').value, imported().text); assert.equal(p.$('ai8-gpt').disabled, true);
  p.send('ready', ready()); assert.equal(p.$('ai8-gpt').disabled, false); assert.equal(p.$('ai8-claude').disabled, false);
});
test('Ground homepage navigates the frame without requesting article extraction', async () => {
  const p = await page(); p.$('ai8-url').value = 'https://ground.news/'; await p.$('ai8-load').fire('click');
  assert.equal(p.fetches.length, 1); assert.equal(p.$('ai8-source-mode').value, 'frame'); assert.equal(p.$('reader-view').hidden, true);
});
test('URL import opens other publishers in the reader and never navigates their iframe or starts analysis', async () => {
  const p = await page({sourceFetch: async () => reply(imported())}); p.$('ai8-url').value = 'https://example.com/story'; await p.$('ai8-load').fire('click');
  assert.equal(p.$('ground-frame').src, 'https://ground.news/'); assert.equal(p.$('reader-view').hidden, false); assert.equal(p.$('ai8-source-mode').value, 'url');
  assert.equal(p.$('ai8-text').value, imported().text); assert.equal(p.$('reader-text').textContent, imported().text); assert.match(p.$('source-extraction').textContent, /skrajšano/);
  assert.equal(p.fetches[1][0], '/api/news-source?url=' + encodeURIComponent('https://example.com/story')); assert.equal(p.$('ai8-results').hidden, true);
  p.$('ai8-url').value = 'https://ground.news.evil.test/article/x'; await p.$('ai8-load').fire('click'); assert.equal(p.$('ground-frame').src, 'https://ground.news/');
});
test('imported titles stay valid Unicode when their length limit splits an emoji', async () => {
  let counter = 0;
  const titles = ['a'.repeat(399) + '😀 more', 'b'.repeat(398) + '😀 more'];
  const p = await page({sourceFetch: async () => reply({...imported(), title: titles[counter++]})});
  p.$('ai8-url').value = 'https://example.com/story'; await p.$('ai8-load').fire('click');
  assert.equal(p.$('ai8-title').value, 'a'.repeat(399));
  assert.equal(p.$('reader-title').textContent, 'a'.repeat(399));
  await p.$('ai8-load').fire('click');
  assert.equal(p.$('ai8-title').value, 'b'.repeat(398) + '😀');
  assert.equal(p.$('ai8-title').value.length, 400);
  assert.equal(p.$('reader-title').textContent, 'b'.repeat(398) + '😀');
});
test('URL imports ignore out-of-order responses and typing invalidates a pending source', async () => {
  const waiting = []; const p = await page({sourceFetch: () => new Promise(resolve => waiting.push(resolve))});
  p.$('ai8-url').value = 'https://example.com/old'; const first = p.$('ai8-load').fire('click');
  p.$('ai8-url').value = 'https://example.com/new'; const second = p.$('ai8-load').fire('click');
  waiting[1](reply({...imported('https://example.com/new'), title: 'New'})); await second;
  waiting[0](reply({...imported('https://example.com/old'), title: 'Old'})); await first; assert.equal(p.$('ai8-title').value, 'New');
  p.$('ai8-url').value = 'https://example.com/third'; const third = p.$('ai8-load').fire('click'); p.$('ai8-url').value = 'https://example.com/editing'; p.$('ai8-url').fire('input');
  waiting[2](reply(imported('https://example.com/third'))); await third; assert.equal(p.$('ai8-title').value, ''); assert.equal(p.fetches.length, 4);
});
test('URL errors clear old source, retain explicit failure and restore controls', async () => {
  const p = await page(); p.send('ready', ready()); p.fill(); p.$('ai8-url').value = 'https://example.com/private'; await p.$('ai8-load').fire('click');
  assert.equal(p.$('ai8-text').value, ''); assert.match(p.$('analysis-status').textContent, /No readable public text/); assert.equal(p.$('source-inspector').open, true); assert.equal(p.$('ai8-analyze').disabled, false);
  assert.equal(p.$('ai8-kind').value, 'article');
  p.$('ai8-title').value = 'Manually captured source'; p.$('ai8-text').value = 'The accessible publisher text.'; p.$('ai8-gpt').fire('click'); assert.match(p.$('analysis-status').textContent, /Čakam na lokalni/);
  p.$('ai8-url').value = 'javascript:alert(1)'; await p.$('ai8-load').fire('click'); assert.equal(p.fetches.length, 2); assert.match(p.$('analysis-status').textContent, /http ali https/);
});
test('only self-origin extension sources update the frame source; metadata clears stale article text', async () => {
  const p = await page(); p.fill(); p.send('source', {url: 'https://ground.news/article/new', title: 'New frame title'}, {origin: 'https://evil.test'}); assert.equal(p.$('ai8-text').value, 'Source text to compare.');
  p.send('ready', ready()); p.$('ai8-current').fire('click');
  p.send('source', {url: 'https://ground.news/article/new', title: 'New frame title'}); assert.equal(p.$('ai8-url').value, 'https://ground.news/article/new'); assert.equal(p.$('ai8-title').value, 'New frame title'); assert.equal(p.$('ai8-text').value, ''); assert.equal(p.$('ai8-source-mode').value, 'frame');
  p.send('source', {article: {...imported('https://ground.news/article/new'), inputKind: 'ground-summary'}}); assert.equal(p.$('ai8-text').value, imported().text); assert.equal(p.$('ai8-source-mode').value, 'frame');
});
test('hidden frame updates and late frame captures cannot replace a URL reader source', async () => {
  const p = await page({sourceFetch: async () => reply(imported())});
  p.$('ai8-url').value = 'https://example.com/story'; await p.$('ai8-load').fire('click');
  p.send('source', {url: 'https://ground.news/article/other', title: 'Unrelated hidden frame'});
  p.send('source', {requestId: 'late-capture', article: {...imported('https://ground.news/article/other'), inputKind: 'ground-summary'}});
  p.send('source', {requestId: 'late-error', error: 'Old frame capture failed'});
  assert.equal(p.$('ai8-url').value, imported().url); assert.equal(p.$('ai8-title').value, imported().title);
  assert.equal(p.$('ai8-text').value, imported().text); assert.equal(p.$('reader-text').textContent, imported().text);
  assert.equal(p.$('ai8-source-mode').value, 'url'); assert.equal(p.$('reader-view').hidden, false);
  assert.match(p.$('analysis-status').textContent, /Vir je pridobljen/);
});
test('frame metadata cannot abort an in-flight Ground URL import', async () => {
  let finish;
  const p = await page({sourceFetch: () => new Promise(resolve => { finish = resolve; })});
  const url = 'https://ground.news/article/public'; p.$('ai8-url').value = url;
  const pending = p.$('ai8-load').fire('click');
  p.send('source', {url: 'https://ground.news/', title: 'Ground homepage'});
  assert.equal(p.$('ai8-url').value, url); assert.equal(p.fetches[1][1].signal.aborted, false);
  finish(reply({...imported(url), inputKind: 'ground-summary'})); await pending;
  assert.equal(p.$('ai8-url').value, url); assert.equal(p.$('ai8-text').value, imported().text); assert.equal(p.$('ai8-source-mode').value, 'url');
});
test('capture errors preserve source fields and same-URL metadata preserves the captured body', async () => {
  const p = await page(); p.send('ready', ready());
  const article = {...imported('https://ground.news/article/readable'), inputKind: 'ground-summary'};
  p.send('source', {requestId: 'capture-ok', article});
  p.send('source', {url: article.url, title: 'A refreshed title'});
  assert.equal(p.$('ai8-text').value, article.text); assert.equal(p.$('ai8-title').value, 'A refreshed title');
  const before = [p.$('ai8-url').value, p.$('ai8-title').value, p.$('ai8-text').value, p.$('source-extraction').textContent];
  p.$('ai8-current').fire('click'); p.send('source', {requestId: 'capture-error', error: 'Please select the accessible text'});
  assert.deepEqual([p.$('ai8-url').value, p.$('ai8-title').value, p.$('ai8-text').value, p.$('source-extraction').textContent], before);
  assert.match(p.$('analysis-status').textContent, /Please select/); assert.equal(p.$('source-inspector').open, true);
  assert.equal(p.$('drawer-status').hidden, false); assert.match(p.$('drawer-status').textContent, /Please select/);
  p.send('source', {url: 'https://ground.news/article/next', title: 'The next story'});
  assert.equal(p.$('ai8-text').value, ''); assert.equal(p.$('ai8-url').value, 'https://ground.news/article/next');
});
test('navigation during an analysis updates the source after its matching terminal error', async () => {
  const p = await page(); p.send('ready', ready());
  p.send('source', {article: {...imported('https://ground.news/article/old'), inputKind: 'ground-summary'}});
  p.$('ai8-analyze').fire('click'); p.send('progress', {requestId: 'old-job'});
  p.send('source', {url: 'https://ground.news/article/new', title: 'New story'});
  assert.equal(p.$('ai8-url').value, 'https://ground.news/article/old');
  p.send('error', {requestId: 'old-job', error: 'Source changed; previous analysis will not be retried'});
  assert.equal(p.$('ai8-url').value, 'https://ground.news/article/new'); assert.equal(p.$('ai8-text').value, '');
  assert.match(p.$('analysis-status').textContent, /Source changed/); assert.equal(p.$('ai8-analyze').disabled, false);
  p.send('result', result('old-job')); assert.equal(p.$('ai8-results').hidden, true);
});
test('paste and blur share one automatic import while Enter can explicitly refresh it', async () => {
  const p = await page({sourceFetch: async () => reply(imported())});
  p.$('ai8-url').value = 'https://example.com/story'; p.$('ai8-url').fire('paste'); p.$('ai8-url').fire('input');
  await new Promise(resolve => setTimeout(resolve, 260)); await tick();
  assert.equal(p.fetches.length, 2);
  await p.$('ai8-url').fire('change'); assert.equal(p.fetches.length, 2);
  p.$('ai8-url').fire('keydown', {key: 'Enter'}); await tick(); assert.equal(p.fetches.length, 3);
});
test('individual requests hide the unrequested voice and retain matching source identity', async () => {
  const p = await page(); p.send('ready', ready()); p.$('ai8-gpt').fire('click'); p.send('progress', {requestId: 'current', requestedModels: ['gpt']});
  p.send('result', result('stale')); assert.equal(p.$('ai8-results').hidden, true);
  const r = result('current'); r.requestedModels = ['gpt']; r.results.claude = {status: 'not-requested'}; p.send('result', r);
  assert.equal(p.$('gpt-opinion').hidden, false); assert.equal(p.$('claude-opinion').hidden, true); assert.match(p.$('gpt-opinion').textContent, /GPT opinion/); assert.equal(p.$('result-sha').textContent, 'a'.repeat(64)); assert.equal(p.$('ai8-analyze').disabled, false);
});
test('URL mode validates required text while frame capture accepts empty fields; partial results stay separate', async () => {
  const p = await page(); p.send('ready', ready()); p.fill(); p.$('ai8-title').value = ''; p.$('ai8-claude').fire('click'); assert.match(p.$('analysis-status').textContent, /naslov/);
  p.$('ai8-current').fire('click'); assert.equal(p.$('ai8-source-mode').value, 'frame'); p.$('ai8-analyze').fire('click'); assert.match(p.$('analysis-status').textContent, /Čakam na lokalni/);
  p.send('progress', {requestId: 'partial'}); const r = result('partial'); r.results.claude = {status: 'error', error: 'Claude login required'}; r.cached = true; p.send('result', r);
  assert.match(p.$('gpt-opinion').textContent, /GPT opinion/); assert.match(p.$('claude-opinion').textContent, /Claude login required/); assert.match(p.$('result-time').textContent, /Shranjena/);
});
test('result and article markup is literal; unsafe result URLs never become links', async () => {
  const p = await page(); p.send('progress', {requestId: 'xss'}); const attack = '<img src=x onerror=alert(1)>'; const r = result('xss'); r.article.title = attack; r.article.url = 'javascript:alert(1)'; r.article.sha256 = attack; r.results.gpt.analysis.opinion = attack; p.send('result', r);
  assert.equal(p.$('result-title').textContent, attack); assert.equal(p.$('result-url').hidden, true); assert.equal(p.$('result-integrity').hidden, true); assert.match(p.$('gpt-opinion').textContent, /<img src=x/);
  p.$('ai8-panel').fire('click'); assert.equal(p.$('analysis-drawer').hidden, true); p.$('ai8-setup').fire('click'); assert.equal(p.$('setup-details').open, true);
});
