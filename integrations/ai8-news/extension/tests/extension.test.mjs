import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash, webcrypto} from 'node:crypto';

const base = new URL('../', import.meta.url);
const source = name => fs.readFileSync(new URL(name, base), 'utf8');
await import('../core.js');
const C = globalThis.AI8NewsCore;
const manifest = JSON.parse(source('manifest.json'));
const extensionId = [...createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex').slice(0, 32)].map(c => String.fromCharCode(97 + parseInt(c, 16))).join('');
const article = () => ({url: 'https://ground.news/article/example-story', title: 'Example', text: 'A sourced public news summary with enough context for two independent views.', inputKind: 'ground-summary', capturedAt: '2026-11-07T01:00:00.000Z'});
const hash = text => createHash('sha256').update(text).digest('hex');
const result = (id, a = article(), models = ['gpt', 'claude']) => ({requestedModels: models, v: 1, type: 'result', requestId: id, cached: false, createdAt: '2026-11-07T01:01:00Z', article: {url: a.url, title: a.title, inputKind: a.inputKind, sha256: hash(a.text)}, results: Object.fromEntries(['gpt', 'claude'].map(model => [model, !models.includes(model) ? {status: 'not-requested', analysis: null} : {status: 'ok', analysis: {summary: '<img src=x onerror=alert(1)>', opinion: 'Independent ' + model, reasons: ['<script>bad()</script>'], uncertainties: ['Unknown'], questions: ['Why?']}}]))});

class Event {
  callbacks = [];
  addListener(callback) { this.callbacks.push(callback); }
  emit(...args) { for (const callback of this.callbacks) callback(...args); }
}
class Node {
  constructor(tag = 'div') { this.tagName = tag.toUpperCase(); this.children = []; this.listeners = {}; this.attributes = {}; this._text = ''; this.hidden = false; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  set innerHTML(_) { throw Error('Unsafe HTML rendering attempted'); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this._text = ''; this.children = children; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  fire(type, event) { for (const callback of this.listeners[type] || []) callback(event); }
  attachShadow(options) { assert.equal(options.mode, 'closed'); this.shadow = new Node('shadow'); return this.shadow; }
  closest() { return null; }
}
class Document {
  constructor() { this.documentElement = new Node('html'); this.body = new Node('body'); this.documentElement.append(this.body); this.ids = new Map(); this.created = []; this.title = 'Example'; }
  createElement(tag) { const n = new Node(tag); this.created.push(n); return n; }
  getElementById(id) { return this.ids.get(id) || null; }
  querySelector() { return null; }
  field(id, value, tag = 'input') { const n = this.createElement(tag); n.value = value; this.ids.set(id, n); this.body.append(n); return n; }
}
function chromeFixture() {
  const sent = [], ports = [], runtimeMessages = [];
  const tabStates = new Map([[7, {id: 7, url: 'https://www.mdlxdcc.org/news/'}]]);
  const frameStates = new Map([['7:0', {frameId: 0, documentId: 'document-one', result: {url: 'https://www.mdlxdcc.org/news/', directChild: false}}]]);
  let captureReply = null;
  const chrome = {
    runtime: {id: extensionId, getManifest: () => manifest, lastError: null, onMessage: new Event(), onInstalled: new Event(), onStartup: new Event(),
      sendMessage: async message => { runtimeMessages.push(message); return {ok: true}; },
      connectNative: name => { assert.equal(name, 'org.ai8.news'); const port = {onMessage: new Event(), onDisconnect: new Event(), posted: [], postMessage(message) { this.posted.push(message); }}; ports.push(port); return port; }},
    tabs: {onRemoved: new Event(), onUpdated: new Event(), get: async id => tabStates.get(id), sendMessage: async (tabId, message, options) => { sent.push({tabId, message, options}); return message.type === 'capture' && captureReply ? captureReply(message, options) : {ready: true}; }},
    scripting: {executeScript: async options => options.func ? [frameStates.get(options.target.tabId + ':' + options.target.frameIds[0])].filter(Boolean) : []},
    contextMenus: {onClicked: new Event(), removeAll: callback => callback(), create() {}},
    action: {onClicked: new Event()},
  };
  return {chrome, sent, ports, runtimeMessages, tabStates, frameStates, setFrame: (sender, directChild = sender.frameId > 0) => frameStates.set(sender.tab.id + ':' + sender.frameId, {frameId: sender.frameId, documentId: sender.documentId, result: {url: sender.url, directChild}}), setCaptureReply: fn => { captureReply = fn; }};
}
function context(extra = {}) {
  return vm.createContext({console, URL, TextEncoder, crypto: webcrypto, setTimeout, clearTimeout, ...extra});
}
const tick = () => new Promise(resolve => setTimeout(resolve, 20));
async function worker({modelSelection = true, subscribe = true} = {}) {
  const f = chromeFixture(); const ctx = context({chrome: f.chrome});
  vm.runInContext(source('core.js'), ctx);
  vm.runInContext(source('background.js').replace(/^import '\.\/core\.js';\n/, ''), ctx);
  const sender = {id: extensionId, tab: {id: 7}, frameId: 0, documentId: 'document-one', url: 'https://www.mdlxdcc.org/news/'};
  const message = (data, from = sender) => new Promise(resolve => f.chrome.runtime.onMessage.callbacks[0](data, from, resolve));
  if (subscribe) await message({type: 'subscribe'});
  const port = f.ports[0]; if (port) port.onMessage.emit({v: 1, type: 'ready', requestId: port.posted[0].requestId, ...(modelSelection ? {hostVersion: '0.2.0', capabilities: {modelSelection: true}} : {})});
  return {...f, message, sender, port};
}

test('manifest pins one identity and narrowly scoped automatic access', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(extensionId, 'nlhhhmkffnmnobnjodhgmcmgjdfjlldh');
  assert.deepEqual(manifest.permissions, ['nativeMessaging', 'activeTab', 'contextMenus', 'scripting']);
  assert.equal(manifest.externally_connectable, undefined);
  assert.equal(manifest.web_accessible_resources, undefined);
  assert.ok(!JSON.stringify(manifest).includes('<all_urls>'));
  assert.ok(manifest.host_permissions.every(p => /^https:\/\/(ground\.news\/\*|(?:www\.)?mdlxdcc\.org\/news(?:\/\*|$))/.test(p)));
  assert.deepEqual(manifest.content_scripts.find(group => group.all_frames === true).matches, ['https://ground.news/*']);
  for (const host of ['www.mdlxdcc.org', 'mdlxdcc.org']) {
    assert.ok(manifest.content_scripts.find(group => group.all_frames === false).matches.includes(`https://${host}/news`));
    assert.ok(C.isOwnedNewsUrl(`https://${host}/news`));
  }
  assert.match(manifest.content_security_policy.extension_pages, /connect-src 'none'/);
});
test('article validation accepts literal content and rejects command-shaped extra fields', () => {
  const a = article(); a.text = ' \u0085' + a.text + '\u0085 ';
  assert.equal(C.normalizeArticle(a).text, article().text);
  assert.throws(() => C.normalizeArticle({...article(), command: 'sh -c bad'}), /fields/);
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'https://user:password@example.com/story']) assert.throws(() => C.normalizeArticle({...article(), url}));
  assert.throws(() => C.normalizeArticle({...article(), url: 'https://example.com/', inputKind: 'ground-summary'}));
  assert.equal(C.normalizeArticle({...article(), url: 'https://example.com/', inputKind: 'selection'}).inputKind, 'selection');
  assert.equal(C.isOwnedNewsUrl('https://www.mdlxdcc.org.evil.test/news'), false);
  assert.equal(C.isOwnedNewsUrl('https://www.mdlxdcc.org:8443/news'), false);
  assert.equal(C.isGroundArticleUrl('https://ground.news.evil.test/article/x'), false);
  assert.equal(C.isGroundArticleUrl('https://ground.news:8443/article/x'), false);
});
test('text bounds and Unicode preserve the exact hash input', () => {
  assert.equal(C.normalizeArticle({...article(), text: 'a'.repeat(59999)}).text.length, 59999);
  assert.throws(() => C.normalizeArticle({...article(), text: 'a'.repeat(60000)}));
  assert.throws(() => C.normalizeArticle({...article(), text: 'bad\u0000text'}));
  assert.throws(() => C.normalizeArticle({...article(), text: 'bad\ud800text'}));
  assert.equal(C.truncateText('a😀b', 2), 'a');
  assert.equal(C.truncateText('a😀b', 3), 'a😀');
});
test('native messages reject malformed/model-missing output and whitelist extras', () => {
  const r = result('request-one'); r.secret = 'must not reach page'; r.results.gpt.analysis.raw_output = 'private';
  const clean = C.normalizeNativeMessage(r, 'request-one');
  assert.equal(clean.secret, undefined); assert.equal(clean.results.gpt.analysis.raw_output, undefined);
  assert.throws(() => C.normalizeNativeMessage(r, 'other-request'));
  assert.throws(() => C.normalizeNativeMessage({...r, v: 2}));
  assert.throws(() => C.normalizeNativeMessage({...r, results: {gpt: r.results.gpt}}));
  assert.throws(() => C.normalizeNativeMessage({...r, results: {...r.results, gpt: {status: 'ok', analysis: null}}}));
  assert.throws(() => C.normalizeNativeMessage({...r, article: {...r.article, sha256: 'bad'}}));
});
test('result identity binds URL, input kind and normalized text hash', () => {
  const r = C.normalizeNativeMessage(result('request-one'), 'request-one'); const a = C.normalizeArticle(article());
  assert.equal(C.verifyResultBinding(r, a, hash(a.text)), true);
  assert.throws(() => C.verifyResultBinding(r, a, '0'.repeat(64)));
  assert.throws(() => C.verifyResultBinding(r, {...a, url: 'https://ground.news/article/different'}, hash(a.text)));
  assert.throws(() => C.verifyResultBinding(r, {...a, inputKind: 'selection'}, hash(a.text)));
});
test('sidebar renders model/publisher markup as literal text in separate cards', () => {
  const document = new Document(); const ctx = context({document}); vm.runInContext(source('view.js'), ctx);
  const panel = ctx.AI8NewsView.createPanel(document);
  ctx.AI8NewsView.renderMessage(panel, C.normalizeNativeMessage(result('request-one'), 'request-one'));
  assert.equal(panel.output.children.length, 2);
  assert.match(panel.output.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.match(panel.output.textContent, /<script>bad\(\)<\/script>/);
  assert.ok(!document.created.some(n => ['IMG', 'SCRIPT', 'IFRAME'].includes(n.tagName)));
  assert.match(panel.output.children[0].textContent, /GPT \/ Codex/);
  assert.match(panel.output.children[1].textContent, /Claude/);
});
test('native port routes streams to the exact document and rejects wrong source binding', async () => {
  const f = await worker(); f.message({type: 'analyze', requestId: 'request-one', article: article()}); await tick();
  assert.equal(f.port.posted.filter(x => x.action === 'analyze').length, 1);
  f.port.onMessage.emit({v: 1, type: 'progress', requestId: 'request-one', message: 'Working', secret: 'not forwarded'});
  let delivered = f.sent.at(-1); assert.equal(delivered.options.documentId, 'document-one'); assert.equal(delivered.message.payload.secret, undefined);
  f.port.onMessage.emit({...result('request-one'), article: {...result('request-one').article, sha256: '0'.repeat(64)}});
  delivered = f.sent.at(-1); assert.equal(delivered.message.payload.type, 'error'); assert.equal(delivered.message.payload.uncertain, true);
  assert.equal(f.port.posted.filter(x => x.action === 'analyze').length, 1);
});
test('disconnect reports uncertainty and never automatically reconnects or resubmits', async () => {
  const f = await worker(); f.message({type: 'analyze', requestId: 'request-one', article: article()}); await tick();
  f.port.onDisconnect.emit(); await tick();
  assert.ok(f.sent.some(x => x.message.payload?.requestId === 'request-one' && x.message.payload.uncertain));
  assert.equal(f.ports.length, 1);
  assert.equal(f.port.posted.filter(x => x.action === 'analyze').length, 1);
});
test('foreign senders, subframes and arbitrary runtime commands cannot start jobs', async () => {
  const f = await worker();
  for (const from of [{...f.sender, id: 'another-extension'}, {...f.sender, frameId: 4}]) f.message({type: 'analyze', requestId: 'bad', article: article()}, from);
  f.message({type: 'exec', command: 'sh'});
  f.message({type: 'analyze', requestId: 'bad', article: article(), command: 'sh'});
  await tick(); assert.equal(f.port.posted.filter(x => x.action === 'analyze').length, 0);
});
test('only one job is dispatched while another is active', async () => {
  const f = await worker(); f.message({type: 'analyze', requestId: 'request-one', article: article()});
  f.message({type: 'analyze', requestId: 'request-two', article: article()}); await tick();
  assert.equal(f.port.posted.filter(x => x.action === 'analyze').length, 1);
  assert.ok(f.sent.some(x => x.message.payload?.type === 'error' && x.message.payload.requestId === 'request-two'));
  f.port.onMessage.emit(result('request-one'));
  assert.equal(f.sent.at(-1).message.payload.type, 'result');
});
test('owned page ignores synthetic click and page messages, then binds trusted click once', async () => {
  const f = chromeFixture(); const document = new Document(); const a = article();
  for (const [id, value] of [['ai8-url', a.url], ['ai8-title', a.title], ['ai8-text', a.text], ['ai8-kind', a.inputKind]]) document.field(id, value);
  const button = document.field('ai8-analyze', '', 'button'); const posted = [];
  const window = {postMessage: (message, origin) => posted.push({message, origin}), addEventListener() { throw Error('Page-driven message listener must not be installed'); }};
  const ctx = context({document, window, location: new URL('https://www.mdlxdcc.org/news/'), chrome: f.chrome, MutationObserver: class {observe() {}}});
  for (const name of ['core.js', 'view.js', 'content.js']) vm.runInContext(source(name), ctx);
  f.chrome.runtime.onMessage.emit({channel: 'ai8-news', type: 'native', payload: {type: 'ready', installed: true, nativeHostAvailable: true}}, {id: extensionId});
  button.fire('click', {isTrusted: false}); await tick(); assert.equal(f.runtimeMessages.filter(x => x.type === 'analyze').length, 0);
  button.fire('click', {isTrusted: true}); await tick();
  const calls = f.runtimeMessages.filter(x => x.type === 'analyze'); assert.equal(calls.length, 1);
  const id = calls[0].requestId;
  assert.equal(calls[0].article.text, a.text);
  assert.ok(posted.some(x => x.message.type === 'progress' && x.message.payload.requestId === id));
  assert.ok(posted.every(x => x.origin === 'https://www.mdlxdcc.org'));
  f.chrome.runtime.onMessage.emit({channel: 'ai8-news', type: 'native', payload: result('stale')}, {id: extensionId});
  assert.ok(!posted.some(x => x.message.type === 'result'));
  f.chrome.runtime.onMessage.emit({channel: 'ai8-news', type: 'native', payload: result(id)}, {id: extensionId});
  assert.equal(posted.filter(x => x.message.type === 'result').length, 1);
});
test('duplicate trusted click preserves the active request until its result', async () => {
  const f = chromeFixture(); const document = new Document(); const a = article(); const posted = [];
  for (const [id, value] of [['ai8-url', a.url], ['ai8-title', a.title], ['ai8-text', a.text], ['ai8-kind', a.inputKind]]) document.field(id, value);
  const button = document.field('ai8-analyze', '', 'button');
  const ctx = context({document, window: {postMessage: message => posted.push(message)}, location: new URL('https://www.mdlxdcc.org/news'), chrome: f.chrome, MutationObserver: class {observe() {}}});
  for (const name of ['core.js', 'view.js', 'content.js']) vm.runInContext(source(name), ctx);
  const native = payload => f.chrome.runtime.onMessage.emit({channel: 'ai8-news', type: 'native', payload}, {id: extensionId});
  native({type: 'ready', installed: true, nativeHostAvailable: true});
  button.fire('click', {isTrusted: true}); button.fire('click', {isTrusted: true}); await tick();
  const calls = f.runtimeMessages.filter(x => x.type === 'analyze'); assert.equal(calls.length, 1);
  assert.equal(posted.filter(x => x.type === 'error').length, 0);
  native(result(calls[0].requestId)); assert.equal(posted.filter(x => x.type === 'result').length, 1);
});
test('explicit context selection waits for initial host readiness and dispatches once', async () => {
  const f = chromeFixture(); const document = new Document();
  const ctx = context({document, window: {postMessage() { throw Error('Publisher must not receive result broadcasts'); }}, location: new URL('https://publisher.example/story'), chrome: f.chrome, MutationObserver: class {observe() {}}});
  for (const name of ['core.js', 'view.js', 'content.js']) vm.runInContext(source(name), ctx);
  const a = {...article(), url: 'https://publisher.example/story', inputKind: 'selection'};
  f.chrome.runtime.onMessage.emit({channel: 'ai8-news', type: 'selection', article: a}, {id: extensionId});
  assert.equal(f.runtimeMessages.filter(x => x.type === 'analyze').length, 0);
  const ready = {channel: 'ai8-news', type: 'native', payload: {type: 'ready', installed: true, nativeHostAvailable: true}};
  f.chrome.runtime.onMessage.emit(ready, {id: extensionId}); f.chrome.runtime.onMessage.emit(ready, {id: extensionId}); await tick();
  const calls = f.runtimeMessages.filter(x => x.type === 'analyze'); assert.equal(calls.length, 1); assert.equal(calls[0].article.inputKind, 'selection');
});
test('Ground landing injection mounts article button after SPA navigation', () => {
  const f = chromeFixture(); const document = new Document(); let mutation;
  const location = new URL('https://ground.news/');
  const ctx = context({document, window: {postMessage() { throw Error('Ground must not receive private results'); }}, location, chrome: f.chrome, MutationObserver: class {constructor(callback) {mutation = callback;} observe() {}}});
  for (const name of ['core.js', 'view.js', 'content.js']) vm.runInContext(source(name), ctx);
  assert.equal(document.created.filter(n => n.tagName === 'BUTTON' && n.textContent === 'AI8 view').length, 0);
  location.href = 'https://ground.news/article/a-story'; mutation();
  const buttons = document.created.filter(n => n.tagName === 'BUTTON' && n.textContent === 'AI8 view'); assert.equal(buttons.length, 1);
  location.href = 'https://ground.news/'; mutation(); assert.equal(buttons[0].hidden, true);
  location.href = 'https://ground.news/article/another-story'; mutation(); assert.equal(buttons[0].hidden, false);
  assert.equal(f.runtimeMessages.filter(m => m.type === 'analyze').length, 0);
});

// Minimal structural DOM fixture matching the public Ground article header, with
// invented text. No live article content, browser profile or model calls needed.
class GroundNode extends Node {
  constructor(tag, attributes = {}, text = '') {
    super(tag); this.attributes = attributes; this._text = text; this.parentElement = null;
    this.style = {gridArea: /grid-area\s*:\s*([^;]+)/.exec(attributes.style || '')?.[1]?.trim()};
    this.display = 'block'; this.visibility = 'visible';
  }
  append(...children) { for (const child of children) child.parentElement = this; super.append(...children); }
  closest(selector) {
    let node = this;
    while (node) {
      if (selector === '#article-summary' && node.attributes.id === 'article-summary') return node;
      if (selector !== '#article-summary' && (node.hidden || 'hidden' in node.attributes || node.attributes['aria-hidden'] === 'true' || ['NAV', 'FOOTER', 'SCRIPT', 'STYLE'].includes(node.tagName))) return node;
      node = node.parentElement;
    }
    return null;
  }
  getClientRects() {
    let node = this;
    while (node) { if (node.display === 'none') return []; node = node.parentElement; }
    return [{}];
  }
  get innerText() { return this.textContent; }
}
function groundFixture({style = 'grid-area:header'} = {}) {
  const document = new Document();
  const main = new GroundNode('main'); const story = new GroundNode('article');
  const header = new GroundNode('div', {style}); const title = new GroundNode('h1', {}, 'A small public example');
  main.append(story); story.append(header); header.append(title); document.body.append(main);
  const nodes = () => { const found = []; const walk = n => { found.push(n); n.children.forEach(walk); }; walk(main); return found; };
  document.querySelector = selector => { assert.equal(selector, 'h1'); return title; };
  document.querySelectorAll = selector => {
    assert.equal(selector, 'main article ul.list-disc');
    return nodes().filter(n => n.tagName === 'UL' && (n.attributes.class || '').split(/\s+/).includes('list-disc'));
  };
  function summary({parent = header, attributed = true, text = ['A local library opened a reading room this week.', 'The report leaves its long term funding unclear.'], hidden = false} = {}) {
    const block = new GroundNode('div'); const textBlock = new GroundNode('div');
    const list = new GroundNode('ul', {class: 'list-outside list-disc'}); list.hidden = hidden;
    for (const bullet of text) list.append(new GroundNode('li', {}, bullet));
    const attribution = new GroundNode('div', {}, attributed ? 'Insights by Ground AI' : 'Other page information');
    textBlock.append(list); block.append(textBlock, attribution); parent.append(block);
    return {block, textBlock, list, attribution};
  }
  const f = chromeFixture(); let mutation;
  const ctx = context({document, window: {postMessage() { throw Error('Ground must not receive private result broadcasts'); }}, location: new URL('https://ground.news/article/a-small-example'), chrome: f.chrome,
    getComputedStyle: node => ({display: node.display || 'block', visibility: node.visibility || 'visible'}), MutationObserver: class {constructor(fn) { mutation = fn; } observe() {}}});
  function click() {
    for (const name of ['core.js', 'view.js', 'content.js']) vm.runInContext(source(name), ctx);
    f.chrome.runtime.onMessage.emit({channel: 'ai8-news', type: 'native', payload: {type: 'ready', installed: true, nativeHostAvailable: true}}, {id: extensionId});
    document.created.find(n => n.tagName === 'BUTTON' && n.textContent === 'AI8 view').fire('click', {isTrusted: true});
    return f.runtimeMessages.filter(m => m.type === 'analyze');
  }
  function bootFrame(direct = true) { ctx.window.top = {}; ctx.window.parent = direct ? ctx.window.top : {}; for (const name of ['core.js', 'view.js', 'content.js']) vm.runInContext(source(name), ctx); }
  return {document, main, story, header, title, summary, click, bootFrame, f, ctx, mutate: () => mutation()};
}
test('real Ground header structure captures only attributed direct summary bullets', () => {
  for (const style of ['grid-area:header', 'grid-area: header;']) {
    const f = groundFixture({style}); const s = f.summary();
    const linked = new GroundNode('a', {}, ' More context.'); s.list.children[0].append(linked);
    f.header.append(new GroundNode('div', {}, 'Bias Comparison · 21 Articles · Read Full Article'));
    // Actual publisher cards repeat this ID. Even a matching list inside the
    // header must never become the selected summary.
    for (let i = 0; i < 2; i++) { const card = new GroundNode('div', {id: 'article-summary'}); f.header.append(card); f.summary({parent: card}); }
    const outside = new GroundNode('section'); f.story.append(outside); f.summary({parent: outside});
    const calls = f.click(); assert.equal(calls.length, 1);
    assert.equal(calls[0].article.text, 'A local library opened a reading room this week. More context.\nThe report leaves its long term funding unclear.');
    assert.equal(calls[0].article.inputKind, 'ground-summary');
    assert.equal(calls[0].article.title, 'A small public example');
  }
});
test('ambiguous Ground summaries fail closed and offer explicit selection', () => {
  const f = groundFixture(); f.summary(); f.summary();
  assert.equal(f.click().length, 0);
  assert.ok(f.document.created.some(n => /Označite želeno besedilo/.test(n.textContent)));
});
test('Ground capture rejects missing, hidden or unrelated Ground AI attribution', () => {
  for (const mode of ['missing', 'hidden', 'css-hidden', 'unrelated']) {
    const f = groundFixture(); const s = f.summary({attributed: mode !== 'missing' && mode !== 'unrelated'});
    if (mode === 'hidden') s.attribution.hidden = true;
    if (mode === 'css-hidden') s.attribution.visibility = 'hidden';
    if (mode === 'unrelated') f.header.append(new GroundNode('div', {}, 'Insights by Ground AI'));
    assert.equal(f.click().length, 0, mode);
  }
});
test('hidden Ground summary variants are excluded from unique candidate count', () => {
  const f = groundFixture(); const good = f.summary(); f.summary({hidden: true});
  const cssHidden = f.summary(); cssHidden.block.display = 'none';
  assert.equal(f.click()[0].article.text, good.list.children.map(n => n.textContent).join('\n'));
});
test('unrecognized Ground pages never fall back to whole-page metadata', () => {
  const f = groundFixture();
  f.main.append(new GroundNode('div', {'data-testid': 'ground-summary'}, 'A plausible but unrecognized page summary which is not trusted.'));
  f.main.append(new GroundNode('div', {}, 'A small public example\nEntire page metadata and unrelated text.\n21 Articles\nRead Full Article'));
  assert.equal(f.click().length, 0);
  assert.ok(f.document.created.some(n => /Označite želeno besedilo/.test(n.textContent)));
});
test('Ground summaries require direct LI children and enough actual text', () => {
  for (const mode of ['wrapper', 'short', 'empty-rendered']) {
    const f = groundFixture(); const s = f.summary({text: mode === 'short' ? ['Too short.'] : undefined});
    if (mode === 'wrapper') s.list.append(new GroundNode('div', {}, 'Unexpected wrapper text'));
    if (mode === 'empty-rendered') Object.defineProperty(s.list, 'innerText', {value: ''});
    assert.equal(f.click().length, 0, mode);
  }
});

const snapshot = value => JSON.parse(JSON.stringify(value));
const frameSender = (f, values = {}) => ({...f.sender, frameId: 3, documentId: 'ground-document-one', url: article().url, ...values});
async function registerGround(f, values = {}) {
  const sender = frameSender(f, values); f.setFrame(sender);
  assert.equal((await f.message({type: 'subscribe', directChild: true, source: {url: sender.url, title: 'Ground story'}}, sender)).ok, true);
  return sender;
}
function ownedFixture(mode = 'frame') {
  const f = chromeFixture(), document = new Document(), posted = [], a = article();
  for (const [id, value] of [['ai8-url', a.url], ['ai8-title', a.title], ['ai8-text', a.text], ['ai8-kind', a.inputKind], ['ai8-source-mode', mode]]) document.field(id, value);
  for (const id of ['ai8-gpt', 'ai8-claude', 'ai8-analyze', 'ai8-current', 'ai8-load']) document.field(id, '', 'button');
  const ctx = context({document, window: {postMessage: message => posted.push(message)}, location: new URL('https://www.mdlxdcc.org/news/'), chrome: f.chrome, MutationObserver: class {observe() {}}});
  for (const name of ['core.js', 'view.js', 'content.js']) vm.runInContext(source(name), ctx);
  const receive = message => f.chrome.runtime.onMessage.emit({channel: 'ai8-news', ...message}, {id: extensionId}, () => {});
  receive({type: 'native', payload: {type: 'ready', installed: true, nativeHostAvailable: true}});
  return {...f, document, posted, receive, click: (id, trusted = true) => document.getElementById(id).fire('click', {isTrusted: trusted})};
}

test('model selections are canonical, strict and bound to matching requested results', () => {
  assert.deepEqual(C.normalizeModels(['claude', 'gpt']), ['gpt', 'claude']);
  for (const models of [null, [], ['gpt', 'gpt'], ['unknown'], 'gpt']) assert.throws(() => C.normalizeModels(models));
  const onlyGPT = C.normalizeNativeMessage(result('one', article(), ['gpt']));
  assert.equal(onlyGPT.results.claude.status, 'not-requested');
  assert.equal(C.verifyResultBinding(onlyGPT, article(), hash(article().text), ['gpt']), true);
  assert.throws(() => C.verifyResultBinding(onlyGPT, article(), hash(article().text), ['claude']));
  assert.throws(() => C.normalizeNativeMessage({...result('one'), requestedModels: ['gpt']}));
});
test('Ground subframe content publishes only metadata and responds to exact capture requests without UI or native jobs', () => {
  const f = groundFixture(); f.summary(); f.bootFrame();
  assert.equal(f.document.created.filter(n => n.tagName === 'BUTTON').length, 0);
  assert.deepEqual(Object.keys(f.f.runtimeMessages[0]).sort(), ['directChild', 'source', 'type']);
  assert.equal(f.f.runtimeMessages[0].type, 'subscribe');
  assert.equal(f.f.runtimeMessages[0].source.text, undefined);
  const responses = [];
  f.f.chrome.runtime.onMessage.emit({channel: 'ai8-news', type: 'capture', requestId: 'capture-one'}, {id: extensionId}, x => responses.push(x));
  assert.equal(responses[0].requestId, 'capture-one'); assert.equal(responses[0].article.inputKind, 'ground-summary');
  f.f.chrome.runtime.onMessage.emit({channel: 'ai8-news', type: 'capture', requestId: 'foreign'}, {id: 'foreign'}, x => responses.push(x));
  for (const type of ['selection', 'open-panel', 'native', 'analyze']) f.f.chrome.runtime.onMessage.emit({channel: 'ai8-news', type, article: article()}, {id: extensionId}, () => {});
  assert.equal(responses.length, 1);
  assert.equal(f.document.created.filter(n => n.tagName === 'BUTTON').length, 0);
  assert.equal(f.f.runtimeMessages.filter(m => m.type.includes('analyze')).length, 0);
  f.ctx.location.href = 'https://ground.news/article/next-story'; f.title.textContent = 'Next story'; f.mutate();
  assert.equal(f.f.runtimeMessages.at(-1).type, 'source-update'); assert.equal(f.f.runtimeMessages.at(-1).source.url, f.ctx.location.href);
});
test('nested Ground frames are inert and cannot become the reader', async () => {
  const nested = groundFixture(); nested.summary(); nested.bootFrame(false);
  assert.equal(nested.f.runtimeMessages.length, 0); assert.equal(nested.f.chrome.runtime.onMessage.callbacks.length, 0);
  const f = await worker(), sender = frameSender(f);
  for (const directChild of [false, undefined]) assert.equal((await f.message({type: 'subscribe', directChild, source: {url: sender.url, title: 'Nested'}}, sender)).ok, false);
  assert.equal(f.port.posted.filter(m => m.action === 'analyze').length, 0);
});
test('capture-only targets the registered exact Ground document and never invokes either model', async () => {
  const f = await worker(), sender = await registerGround(f);
  f.setCaptureReply(message => ({requestId: message.requestId, article: article()}));
  await f.message({type: 'capture-frame', requestId: 'capture-only'});
  const sent = f.sent.find(x => x.message.type === 'capture');
  assert.deepEqual(snapshot(sent.options), {documentId: sender.documentId});
  assert.equal(sent.tabId, 7);
  const captured = f.sent.find(x => x.message.type === 'source' && x.message.payload.requestId === 'capture-only');
  assert.equal(captured.options.documentId, f.sender.documentId); assert.equal(captured.message.payload.article.text, article().text);
  assert.equal(f.port.posted.filter(m => m.action === 'analyze').length, 0);
});
test('Ground frames cannot request analysis or spoof metadata for another URL', async () => {
  const f = await worker(), sender = await registerGround(f);
  for (const type of ['analyze', 'analyze-frame', 'capture-frame', 'exec']) assert.equal((await f.message({type, requestId: 'denied', article: article(), models: ['gpt']}, sender)).ok, false);
  assert.equal((await f.message({type: 'source-update', directChild: true, source: {url: 'https://ground.news/article/spoofed', title: 'Spoofed'}}, sender)).ok, false);
  const foreign = {...sender, url: 'https://publisher.example/story'};
  assert.equal((await f.message({type: 'subscribe', directChild: true, source: {url: sender.url, title: 'Foreign'}}, foreign)).ok, false);
  assert.equal(f.port.posted.filter(m => m.action === 'analyze').length, 0);
});
test('frame analysis captures once, sends only the selected reader and checks requested-model result binding', async () => {
  const f = await worker(); await registerGround(f);
  f.setCaptureReply(message => ({requestId: message.requestId, article: article()}));
  await f.message({type: 'analyze-frame', requestId: 'gpt-only', models: ['gpt']});
  const calls = f.port.posted.filter(m => m.action === 'analyze');
  assert.equal(calls.length, 1); assert.deepEqual(snapshot(calls[0].models), ['gpt']);
  f.port.onMessage.emit(result('gpt-only', article(), ['gpt']));
  assert.equal(f.sent.at(-1).message.payload.type, 'result'); assert.equal(f.sent.at(-1).message.payload.results.claude.status, 'not-requested');
  await f.message({type: 'analyze-frame', requestId: 'claude-only', models: ['claude']});
  f.port.onMessage.emit(result('claude-only'));
  assert.equal(f.sent.at(-1).message.payload.type, 'error'); assert.equal(f.sent.at(-1).message.payload.uncertain, true);
});
test('navigation during capture rejects stale snapshots without dispatching a model', async () => {
  const f = await worker(), sender = await registerGround(f); let finish;
  f.setCaptureReply(message => new Promise(resolve => { finish = () => resolve({requestId: message.requestId, article: article()}); }));
  const pending = f.message({type: 'analyze-frame', requestId: 'capture-race', models: ['gpt']}); await tick();
  const next = {...sender, url: 'https://ground.news/article/new-story'}; f.setFrame(next);
  await f.message({type: 'source-update', directChild: true, source: {url: next.url, title: 'Next'}}, next);
  finish(); await pending;
  assert.equal(f.port.posted.filter(m => m.action === 'analyze').length, 0);
  assert.ok(f.sent.some(x => x.message.payload?.requestId === 'capture-race' && x.message.payload.type === 'error'));
});
test('navigation during native work releases UI but keeps one native job and drops its stale result', async () => {
  const f = await worker(), sender = await registerGround(f);
  f.setCaptureReply(message => ({requestId: message.requestId, article: article()}));
  await f.message({type: 'analyze-frame', requestId: 'running-old', models: ['gpt']});
  const next = {...sender, url: 'https://ground.news/article/new-story'}; f.setFrame(next);
  await f.message({type: 'source-update', directChild: true, source: {url: next.url, title: 'Next'}}, next);
  assert.ok(f.sent.some(x => x.message.payload?.requestId === 'running-old' && x.message.payload.type === 'error'));
  await f.message({type: 'analyze', requestId: 'too-soon', article: article(), models: ['claude']});
  assert.equal(f.port.posted.filter(m => m.action === 'analyze').length, 1);
  f.port.onMessage.emit(result('running-old', article(), ['gpt']));
  assert.ok(!f.sent.some(x => x.message.payload?.requestId === 'running-old' && x.message.payload.type === 'result'));
  await f.message({type: 'analyze', requestId: 'after-terminal', article: article(), models: ['claude']});
  assert.equal(f.port.posted.filter(m => m.action === 'analyze').length, 2);
});
test('ambiguous frames and mismatched capture correlations cannot feed analysis', async () => {
  const f = await worker(); await registerGround(f); await registerGround(f, {frameId: 4, documentId: 'second-ground'});
  f.setCaptureReply(message => ({requestId: message.requestId, article: article()}));
  await f.message({type: 'analyze-frame', requestId: 'ambiguous', models: ['gpt']});
  assert.equal(f.sent.filter(m => m.message.type === 'capture').length, 0);
  const second = await worker(); await registerGround(second);
  second.setCaptureReply(() => ({requestId: 'wrong', article: article()}));
  await second.message({type: 'analyze-frame', requestId: 'mismatched', models: ['gpt']});
  assert.equal(second.port.posted.filter(m => m.action === 'analyze').length, 0);
});
test('toolbar uses trusted clicks and source mode to request only the selected agents', () => {
  for (const [button, models] of [['ai8-gpt', ['gpt']], ['ai8-claude', ['claude']], ['ai8-analyze', ['gpt', 'claude']]]) {
    for (const mode of ['url', 'manual', 'frame']) {
      const f = ownedFixture(mode);
      f.click(button, false); assert.equal(f.runtimeMessages.filter(m => m.type.includes('analyze')).length, 0);
      f.click(button);
      const calls = f.runtimeMessages.filter(m => m.type.includes('analyze')); assert.equal(calls.length, 1);
      assert.equal(calls[0].type, mode === 'frame' ? 'analyze-frame' : 'analyze'); assert.deepEqual(snapshot(calls[0].models), models);
      assert.equal(f.document.created.filter(n => n.attributes['data-ai8-news-extension'] === 'panel').length, 0);
      assert.ok(f.posted.some(p => p.type === 'progress' && p.payload.requestId === calls[0].requestId));
    }
  }
});
test('current-story click captures only and ignores late/stale sources after a URL edit', () => {
  const f = ownedFixture(); f.click('ai8-current');
  const capture = f.runtimeMessages.find(m => m.type === 'capture-frame'); assert.ok(capture);
  assert.equal(f.runtimeMessages.filter(m => m.type.includes('analyze')).length, 0);
  f.receive({type: 'source', payload: {requestId: 'wrong-capture', article: article()}});
  assert.equal(f.posted.filter(m => m.type === 'source').length, 0);
  f.document.getElementById('ai8-source-mode').value = 'url'; f.document.getElementById('ai8-url').fire('input', {isTrusted: true});
  f.receive({type: 'source', payload: {requestId: capture.requestId, article: article()}});
  f.receive({type: 'source', payload: {url: article().url, title: 'Unsolicited'}});
  assert.equal(f.posted.filter(m => m.type === 'source').length, 0);
});
test('trusted URL edits release an active request and its eventual native result is ignored', () => {
  const f = ownedFixture('url'); f.click('ai8-gpt');
  const request = f.runtimeMessages.find(m => m.type === 'analyze');
  f.document.getElementById('ai8-url').fire('input', {isTrusted: true});
  assert.ok(f.posted.some(p => p.type === 'error' && p.payload.requestId === request.requestId));
  f.receive({type: 'native', payload: result(request.requestId, article(), ['gpt'])});
  assert.equal(f.posted.filter(m => m.type === 'result').length, 0);
  assert.equal(f.runtimeMessages.filter(m => m.type.includes('analyze')).length, 1);
});

test('publisher capture requires a current explicit activeTab gesture and ignores iframe context-menu selections', async () => {
  const f = await worker(), url = 'https://publisher.example/story';
  f.tabStates.set(7, {id: 7, url}); f.chrome.tabs.onUpdated.emit(7, {status: 'loading'});
  const sender = {...f.sender, documentId: 'publisher-document', url}; f.setFrame(sender);
  assert.equal((await f.message({type: 'subscribe'}, sender)).ok, false);
  f.chrome.contextMenus.onClicked.emit({menuItemId: 'ai8-view-selection', frameId: 3, selectionText: 'Not the top page', pageUrl: url}, {id: 7, url}); await tick();
  assert.ok(!f.sent.some(x => x.message.type === 'selection'));
  f.chrome.action.onClicked.emit({id: 7, url}); await tick();
  assert.equal((await f.message({type: 'subscribe'}, sender)).ok, true);
  await f.message({type: 'analyze', requestId: 'publisher-user-gesture', article: {...article(), url, inputKind: 'selection'}, models: ['claude']}, sender);
  assert.equal(f.port.posted.filter(m => m.action === 'analyze').length, 1);
});
test('replacing the owned top document invalidates an in-flight frame capture', async () => {
  const f = await worker(); await registerGround(f); let finish;
  f.setCaptureReply(message => new Promise(resolve => { finish = () => resolve({requestId: message.requestId, article: article()}); }));
  const pending = f.message({type: 'analyze-frame', requestId: 'old-owned-document', models: ['gpt']}); await tick();
  const nextTop = {...f.sender, documentId: 'new-owned-document'}; f.setFrame(nextTop);
  await f.message({type: 'subscribe'}, nextTop);
  finish(); await pending;
  assert.equal(f.port.posted.filter(m => m.action === 'analyze').length, 0);
  assert.ok(!f.sent.some(x => x.message.payload?.requestId === 'old-owned-document' && x.options.documentId === 'new-owned-document'));
});

test('legacy native host cannot accidentally run both providers for a single-agent request', async () => {
  const f = await worker({modelSelection: false});
  await f.message({type: 'analyze', requestId: 'requires-new-host', article: article(), models: ['gpt']});
  assert.equal(f.port.posted.filter(m => m.action === 'analyze').length, 0);
  assert.ok(f.sent.some(m => m.message.payload?.requestId === 'requires-new-host' && m.message.payload.type === 'error'));
  const ready = f.sent.findLast(m => m.message.payload?.type === 'ready').message.payload;
  assert.equal(ready.nativeHostAvailable, true); assert.equal(ready.extensionVersion, '0.2.0');
  assert.equal(ready.capabilities.frameCapture, true); assert.equal(ready.capabilities.modelSelection, false);
  await f.message({type: 'analyze', requestId: 'backward-both', article: article()});
  assert.equal(f.port.posted.filter(m => m.action === 'analyze').length, 1);
});

test('reader iframe loading retains the owned toolbar and the new document remains capturable', async () => {
  const f = await worker(); await registerGround(f);
  f.chrome.tabs.onUpdated.emit(7, {status: 'loading'}, f.tabStates.get(7));
  const next = await registerGround(f, {documentId: 'ground-after-loading', url: 'https://ground.news/article/after-loading'});
  const nextArticle = {...article(), url: next.url};
  f.setCaptureReply(message => ({requestId: message.requestId, article: nextArticle}));
  assert.equal((await f.message({type: 'capture-frame', requestId: 'after-child-loading'})).ok, true);
  const capture = f.sent.findLast(x => x.message.type === 'capture');
  assert.equal(capture.options.documentId, 'ground-after-loading');
  assert.ok(f.sent.some(x => x.message.type === 'source-probe'));
  assert.equal(f.sent.findLast(x => x.message.type === 'source').message.payload.article.url, next.url);
  assert.equal(f.port.posted.filter(x => x.action === 'analyze').length, 0);
});
test('Ground child may register metadata before parent startup and later capture without models or retries', async () => {
  const f = await worker({subscribe: false}), frame = await registerGround(f);
  assert.equal(f.ports.length, 0); // Metadata never opens a native connection.
  await f.message({type: 'subscribe'});
  assert.ok(f.sent.some(x => x.message.type === 'source-probe'));
  f.setCaptureReply(message => ({requestId: message.requestId, article: article()}));
  assert.equal((await f.message({type: 'capture-frame', requestId: 'child-before-parent'})).ok, true);
  assert.equal(f.sent.findLast(x => x.message.type === 'capture').options.documentId, frame.documentId);
  assert.equal(f.ports[0].posted.filter(x => x.action === 'analyze').length, 0);
});
test('Chrome current-document identity rejects queued old child and top messages after replacement', async () => {
  const f = await worker(), oldFrame = await registerGround(f);
  f.chrome.tabs.onUpdated.emit(7, {status: 'loading'}, f.tabStates.get(7));
  const currentTop = {...f.sender, documentId: 'current-top-document'}; f.setFrame(currentTop);
  const currentFrame = {...oldFrame, documentId: 'current-ground-document', url: 'https://ground.news/article/current'}; f.setFrame(currentFrame);
  await f.message({type: 'subscribe'}, currentTop);
  assert.equal((await f.message({type: 'subscribe', directChild: true, source: {url: oldFrame.url, title: 'Old'}}, oldFrame)).ok, false);
  assert.equal((await f.message({type: 'subscribe'}, f.sender)).ok, false);
  assert.equal((await f.message({type: 'subscribe', directChild: true, source: {url: currentFrame.url, title: 'Current'}}, currentFrame)).ok, true);
  f.setCaptureReply(message => ({requestId: message.requestId, article: {...article(), url: currentFrame.url}}));
  assert.equal((await f.message({type: 'capture-frame', requestId: 'current-only'}, currentTop)).ok, true);
  assert.equal(f.sent.findLast(x => x.message.type === 'capture').options.documentId, currentFrame.documentId);
});
test('a claimed direct child must also pass Chrome current-frame verification', async () => {
  const f = await worker(), sender = frameSender(f); f.setFrame(sender, false);
  assert.equal((await f.message({type: 'subscribe', directChild: true, source: {url: sender.url, title: 'Nested frame pretending direct'}}, sender)).ok, false);
  f.setFrame({...sender, documentId: 'different-document'});
  assert.equal((await f.message({type: 'subscribe', directChild: true, source: {url: sender.url, title: 'Replaced frame'}}, sender)).ok, false);
  assert.equal(f.port.posted.filter(x => x.action === 'analyze').length, 0);
});
