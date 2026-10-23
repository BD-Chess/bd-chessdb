import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as core from '../../public/OmniCPQ/core.mjs';
import * as prompts from '../../public/OmniCPQ/prompts.mjs';
import * as starters from '../../public/OmniCPQ/starters.mjs';
import * as bridge from '../../public/OmniCPQ/browser-bridge.mjs';
import {starterMetadata} from '../../functions/lib/omnicpq/browser.mjs';

// Deterministic application event tests with a small DOM. Real browser/Edge QA: NOT_RUN.
const source = await readFile(new URL('../../public/OmniCPQ/app.mjs', import.meta.url), 'utf8');
const STORAGE = 'omnicpq:workspace:v1', PREFS = 'omnicpq:preferences:v1';
const marker = 'SYNTHETIC_OWNER_PRIVATE_MARKER';
const metadata = () => ({ available: true,version:core.APP_VERSION, simulation: false, account: { id: 'owner', role: 'owner' }, adapterDelta: 'TEST_ONLY', starterPrompts:starterMetadata, services: [{ id: 'VPI', title: 'VPI' }, { id: 'TS_SO', title: 'SO' }],
  skill: { version: 'v0.1.6', release: 'v16', files: 184, zipSha256: 'FIXTURE', promptsSha256: prompts.PROMPTS_SHA256 } });
const denied = status => Response.json({ error: { code: status === 401 ? 'AUTH_REQUIRED' : 'OWNER_REQUIRED' } }, { status });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

async function harness() {
  class Element {
    constructor(tag = 'div') { this.tagName = tag; this.children = []; this.value = ''; this.hidden = false; this.disabled = false; this.checked = false; this.dataset = {}; this._text = ''; this.classList = { add() {}, remove() {}, toggle() {} }; }
    set textContent(value) { this._text = String(value); this.children = []; }
    get textContent() { return this._text + this.children.map(c => typeof c === 'string' ? c : c.textContent).join(''); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this._text = ''; this.children = children; }
    add(option) { this.children.push(option); }
    setAttribute() {}
    removeAttribute() {}
    addEventListener() {}
    querySelector() { return this.label ||= new Element('span'); }
    focus() {}
    scrollIntoView() {}
    close() { this.open = false; }
    click() { downloads++; }
  }
  const nodes = new Map(), $ = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
  $('environment').value = 'UNKNOWN'; $('theme').value = 'dark'; $('comparison-mode').value = 'frozen';
  const stored = new Map([[PREFS, JSON.stringify({ persist: true })], [STORAGE, JSON.stringify({ schema: 'omnicpq.session.v1', accountId: 'owner', mode: 'work',
    messages: [{ role: 'user', content: marker }], comparisons: [], draft: 'UNSAVED_DRAFT', context: { text: 'PRIVATE_CONTEXT', manualUrl: 'https://example.test/private', environment: 'STAGE' } })]]);
  const events = new Map(), boot = deferred(), calls = [], clipboard = [];
  let fetcher = () => boot.promise, downloads = 0;
  const context = vm.createContext({ ...core, ...prompts, ...starters, ...bridge,
    document: { getElementById: $, createElement: tag => new Element(tag), createTextNode: text => ({ textContent: text }), querySelectorAll: () => [], addEventListener() {}, documentElement: { dataset: {} } },
    window: { isSecureContext: false, addEventListener: (name, fn) => events.set(name, fn) },
    navigator: { onLine: true, clipboard: { writeText: async text => clipboard.push(text) } },
    location: { hostname: 'example.test', href: 'https://example.test/OmniCPQ/', hash: '' }, matchMedia: () => ({ matches: false }), URLSearchParams,
    localStorage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) },
    Option: function(label, value) { return { textContent: label, value }; },
    fetch: (...args) => { calls.push(args); return fetcher(...args); },
    URL: { createObjectURL: () => 'blob:synthetic', revokeObjectURL() {} }, Blob, Response, AbortController, DOMException, performance,
    setTimeout: () => 0, setInterval: () => 0, confirm: () => true,
  });
  const executable = source.replace(/^import .*;\n/gm, '').replace('health(); installWorker();', 'globalThis.initialHealth = health(); installWorker();');
  vm.runInContext(executable + '\nglobalThis.app = { state, health, send, comparisonText, copy, download };', context);
  return { $, nodes, stored, events, calls, clipboard, context, app: context.app,
    get downloads() { return downloads; }, setFetch(fn) { fetcher = fn; },
    async owner() { boot.resolve(Response.json(metadata())); await context.initialHealth; },
  };
}

test('restored owner content and exports stay locked until owner metadata succeeds', async () => {
  const h = await harness();
  assert.equal(h.app.state.ownerVerified, false);
  assert.equal(h.$('workspace').hidden, true); assert.equal(h.$('composer').hidden, true);
  assert.equal(h.$('messages').textContent, ''); assert.equal(h.$('export-json').disabled, true);
  await h.app.copy(marker); h.app.download('test.json', marker);
  assert.equal(h.clipboard.length, 0); assert.equal(h.downloads, 0);
  await h.owner();
  assert.equal(h.app.state.ownerVerified, true); assert.equal(h.$('workspace').hidden, false);
  assert(h.$('messages').textContent.includes(marker)); assert.equal(h.$('export-json').disabled, false);
});

test('GET 401/403 locks old data and all export paths; a new owner check restores it', async () => {
  for (const status of [401, 403]) {
    const h = await harness(); await h.owner();
    h.setFetch(async () => denied(status)); await h.app.health();
    assert.equal(h.app.state.ownerVerified, false); assert.equal(h.app.state.ready, false);
    assert.equal(h.$('messages').textContent, ''); assert.equal(h.$('workspace').hidden, true);
    for (const id of ['export-md', 'export-json', 'export-comparison', 'export-snapshot', 'copy-comparison']) assert.equal(h.$(id).disabled, true);
    await h.app.copy(marker); h.app.download('test.json', marker); h.$('export-snapshot').onclick();
    assert.equal(h.clipboard.length, 0); assert.equal(h.downloads, 0);
    assert.equal(h.app.state.messages[0].content, marker); assert(h.stored.get(STORAGE).includes(marker));
    h.setFetch(async () => Response.json(metadata())); await h.app.health();
    assert(h.$('messages').textContent.includes(marker));
  }
});

test('POST 401/403 also locks the conversation instead of exposing its error result', async () => {
  for (const status of [401, 403]) {
    const h = await harness(); await h.owner(); h.setFetch(async () => denied(status));
    await h.app.send();
    assert.equal(h.app.state.ownerVerified, false); assert.equal(h.$('messages').textContent, '');
    assert.equal(h.$('export-json').disabled, true); assert.equal(h.$('composer').hidden, true);
  }
});

test('only a confirmed logout locks data; network failure and 503 preserve an unsaved draft', async () => {
  const h = await harness(); await h.owner();
  h.app.state.snapshot = { dataUrl: 'SYNTHETIC_IMAGE' };
  for (const failure of [async () => { throw Error('offline'); }, async () => Response.json({ error: { code: 'AUTH_UNAVAILABLE' } }, { status: 503 })]) {
    h.setFetch(failure); await h.$('logout').onclick();
    assert.equal(h.app.state.ownerVerified, true); assert(h.$('messages').textContent.includes(marker));
    assert.equal(h.$('message').value, 'UNSAVED_DRAFT'); assert.equal(h.$('context-text').value, 'PRIVATE_CONTEXT');
    assert.equal(h.app.state.snapshot.dataUrl, 'SYNTHETIC_IMAGE');
  }
  h.setFetch(async () => Response.json({ authenticated: false })); await h.$('logout').onclick();
  assert.equal(h.app.state.ownerVerified, false); assert.equal(h.$('workspace').hidden, true); assert.equal(h.$('messages').textContent, '');
  assert.equal(h.app.state.snapshot, null); assert.equal(h.$('crop-canvas').width, 0);
  assert.equal(h.app.state.messages[0].content, marker); assert(h.stored.get(STORAGE).includes(marker));
});

test('offline and ordinary health failure preserve an already verified owner workspace', async () => {
  const h = await harness(); await h.owner();
  h.context.navigator.onLine = false; h.events.get('offline')();
  assert.equal(h.app.state.ownerVerified, true); assert(h.$('messages').textContent.includes(marker));
  assert.equal(h.$('message').value, 'UNSAVED_DRAFT'); assert.equal(h.$('context-text').value, 'PRIVATE_CONTEXT');
  h.context.navigator.onLine = true; h.setFetch(async () => { throw Error('network'); }); await h.app.health();
  assert.equal(h.app.state.ownerVerified, true); assert.equal(h.$('workspace').hidden, false);
  assert.equal(h.$('message').value, 'UNSAVED_DRAFT'); assert(h.$('messages').textContent.includes(marker));
});

test('an earlier in-flight owner response cannot unlock a later confirmed logout', async () => {
  const h = await harness(); await h.owner(); const pending = deferred();
  h.setFetch(async (url) => url.includes('omnicpq-auth') ? Response.json({ authenticated: false }) : pending.promise);
  const oldHealth = h.app.health(); await h.$('logout').onclick();
  pending.resolve(Response.json(metadata())); await oldHealth;
  assert.equal(h.app.state.ownerVerified, false); assert.equal(h.$('messages').textContent, '');
});

test('comparison copy includes the exact canonical mode and service, including automatic selection', async () => {
  const h = await harness(); await h.owner();
  const input = { message: 'Nadaljuj', mode: 'plm', service: 'TS_SO', context: { text: '', environment: 'STAGE', manualUrl: '' }, history: [], snapshot: null };
  h.app.state.frozen = { body: input };
  h.app.state.mode = 'jira'; h.$('service').value = 'VPI';
  const so = h.app.comparisonText(); assert(so.includes(JSON.stringify({ mode: 'plm', service: 'TS_SO' })));
  input.service = 'VPI'; const vpi = h.app.comparisonText(); assert(vpi.includes(JSON.stringify({ mode: 'plm', service: 'VPI' }))); assert.notEqual(so, vpi);
  input.mode = 'work'; const work = h.app.comparisonText(); assert(work.includes(JSON.stringify({ mode: 'work', service: 'VPI' }))); assert.notEqual(work, vpi);
  input.service = null; assert(h.app.comparisonText().includes(JSON.stringify({ mode: 'work', service: null })));
  assert(h.app.comparisonText().includes('BREZ SLIKE'));
});


