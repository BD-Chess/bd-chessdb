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
const result = (id, a = article()) => ({v: 1, type: 'result', requestId: id, cached: false, createdAt: '2026-11-07T01:01:00Z', article: {url: a.url, title: a.title, inputKind: a.inputKind, sha256: hash(a.text)}, results: Object.fromEntries(['gpt', 'claude'].map(model => [model, {status: 'ok', analysis: {summary: '<img src=x onerror=alert(1)>', opinion: 'Independent ' + model, reasons: ['<script>bad()</script>'], uncertainties: ['Unknown'], questions: ['Why?']}}]))});

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
  const chrome = {
    runtime: {id: extensionId, lastError: null, onMessage: new Event(), onInstalled: new Event(), onStartup: new Event(),
      sendMessage: async message => { runtimeMessages.push(message); return {ok: true}; },
      connectNative: name => { assert.equal(name, 'org.ai8.news'); const port = {onMessage: new Event(), onDisconnect: new Event(), posted: [], postMessage(message) { this.posted.push(message); }}; ports.push(port); return port; }},
    tabs: {onRemoved: new Event(), sendMessage: async (tabId, message, options) => { sent.push({tabId, message, options}); return {ready: true}; }},
    scripting: {executeScript: async () => []},
    contextMenus: {onClicked: new Event(), removeAll: callback => callback(), create() {}},
    action: {onClicked: new Event()},
  };
  return {chrome, sent, ports, runtimeMessages};
}
function context(extra = {}) {
  return vm.createContext({console, URL, TextEncoder, crypto: webcrypto, setTimeout, clearTimeout, ...extra});
}
const tick = () => new Promise(resolve => setTimeout(resolve, 20));
function worker() {
  const f = chromeFixture(); const ctx = context({chrome: f.chrome});
  vm.runInContext(source('core.js'), ctx);
  vm.runInContext(source('background.js').replace(/^import '\.\/core\.js';\n/, ''), ctx);
  const sender = {id: extensionId, tab: {id: 7}, frameId: 0, documentId: 'document-one', url: 'https://www.mdlxdcc.org/news/'};
  const message = (data, from = sender) => f.chrome.runtime.onMessage.emit(data, from, () => {});
  message({type: 'subscribe'});
  const port = f.ports[0]; port.onMessage.emit({v: 1, type: 'ready', requestId: port.posted[0].requestId});
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
  assert.ok(manifest.content_scripts[0].matches.includes('https://ground.news/*'));
  for (const host of ['www.mdlxdcc.org', 'mdlxdcc.org']) {
    assert.ok(manifest.content_scripts[0].matches.includes(`https://${host}/news`));
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
  const f = worker(); f.message({type: 'analyze', requestId: 'request-one', article: article()}); await tick();
  assert.equal(f.port.posted.filter(x => x.action === 'analyze').length, 1);
  f.port.onMessage.emit({v: 1, type: 'progress', requestId: 'request-one', message: 'Working', secret: 'not forwarded'});
  let delivered = f.sent.at(-1); assert.equal(delivered.options.documentId, 'document-one'); assert.equal(delivered.message.payload.secret, undefined);
  f.port.onMessage.emit({...result('request-one'), article: {...result('request-one').article, sha256: '0'.repeat(64)}});
  delivered = f.sent.at(-1); assert.equal(delivered.message.payload.type, 'error'); assert.equal(delivered.message.payload.uncertain, true);
  assert.equal(f.port.posted.filter(x => x.action === 'analyze').length, 1);
});
test('disconnect reports uncertainty and never automatically reconnects or resubmits', async () => {
  const f = worker(); f.message({type: 'analyze', requestId: 'request-one', article: article()}); await tick();
  f.port.onDisconnect.emit(); await tick();
  assert.ok(f.sent.some(x => x.message.payload.requestId === 'request-one' && x.message.payload.uncertain));
  assert.equal(f.ports.length, 1);
  assert.equal(f.port.posted.filter(x => x.action === 'analyze').length, 1);
});
test('foreign senders, subframes and arbitrary runtime commands cannot start jobs', async () => {
  const f = worker();
  for (const from of [{...f.sender, id: 'another-extension'}, {...f.sender, frameId: 4}]) f.message({type: 'analyze', requestId: 'bad', article: article()}, from);
  f.message({type: 'exec', command: 'sh'});
  f.message({type: 'analyze', requestId: 'bad', article: article(), command: 'sh'});
  await tick(); assert.equal(f.port.posted.filter(x => x.action === 'analyze').length, 0);
});
test('only one job is dispatched while another is active', async () => {
  const f = worker(); f.message({type: 'analyze', requestId: 'request-one', article: article()});
  f.message({type: 'analyze', requestId: 'request-two', article: article()}); await tick();
  assert.equal(f.port.posted.filter(x => x.action === 'analyze').length, 1);
  assert.ok(f.sent.some(x => x.message.payload.type === 'error' && x.message.payload.requestId === 'request-two'));
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
