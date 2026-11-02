import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// Exact public-client function bodies run against an invented DOM and mock
// transports. The app module and all of its imports remain inert.
const defaultApp = fileURLToPath(new URL('../public/OmniCPQ/app.mjs', import.meta.url));
const appPath = process.env.OMNI_NO_CPQ_TEST_APP_PATH || defaultApp;
const raw = readFileSync(appPath);
if (process.env.OMNI_NO_CPQ_TEST_APP_PATH) assert.equal(createHash('sha256').update(raw).digest('hex'), '4aeeabd0cf9b9d585564e0cdba5b0a89a448e6cbaf32a0f171ef152d91fe7ccb');
const source = raw.toString('utf8');
const defaultIndex = fileURLToPath(new URL('../public/OmniCPQ/index.html', import.meta.url));
const indexRaw = readFileSync(process.env.OMNI_NO_CPQ_TEST_INDEX_PATH || defaultIndex);
if (process.env.OMNI_NO_CPQ_TEST_INDEX_PATH) assert.equal(createHash('sha256').update(indexRaw).digest('hex'), 'd8c82c79a7f8d59886e7a07354beae8aefd9098043e0edfd12a149f71c986637');

function makeNode(attrs = {}, tagName = '', parentElement = null) {
  return { id: attrs.id || '', tagName, parentElement, children: [], checked: 'checked' in attrs, disabled: 'disabled' in attrs,
    hidden: 'hidden' in attrs, open: 'open' in attrs, value: attrs.value || '', textContent: '',
    setAttribute() {}, focus() {}, close() {}, showModal() {}, append() {}, replaceChildren() {}, classList: { toggle() {} } };
}

// Read only actual public HTML ancestry and native hidden/disabled attributes.
// This models DOM reachability, not CSS/layout or a real browser session.
function htmlNodes(html) {
  const nodes = new Map(), stack = [], voids = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
  let offset = 0;
  while (true) {
    const start = html.indexOf('<', offset); if (start < 0) break;
    if (html.startsWith('<!--', start)) { offset = html.indexOf('-->', start + 4) + 3; assert.ok(offset > start); continue; }
    let quote = null, end = start + 1;
    for (; end < html.length; end++) { const c = html[end]; if (quote) { if (c === quote) quote = null; } else if (c === '"' || c === "'") quote = c; else if (c === '>') break; }
    assert.ok(end < html.length); offset = end + 1;
    const token = html.slice(start + 1, end), match = /^\/?\s*([A-Za-z][\w:-]*)/.exec(token); if (!match) continue;
    const tag = match[1].toLowerCase();
    if (token.startsWith('/')) { const i = stack.map(n => n.tagName).lastIndexOf(tag); if (i >= 0) stack.length = i; continue; }
    const attrs = {};
    for (const a of token.slice(match[0].length).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? '';
    const element = makeNode(attrs, tag, stack.at(-1) || null); element.parentElement?.children.push(element);
    if (element.id) { assert.equal(nodes.has(element.id), false, 'duplicate public HTML id'); nodes.set(element.id, element); }
    if (!voids.has(tag) && !token.endsWith('/')) stack.push(element);
  }
  return nodes;
}

function between(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `source boundary ${start}`);
  return source.slice(a, b);
}

function fixture({ connected = false, checked = true, automatic = false } = {}) {
  const nodes = htmlNodes(indexRaw.toString('utf8')), calls = { post: [], observe: 0, connect: 0, disconnect: 0, resume: 0, execute: 0, save: 0, notices: [] };
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, makeNode());
    return nodes.get(id);
  };
  const visible = id => { for (let element = node(id); element; element = element.parentElement) if (element.hidden || (element.tagName === 'details' && !element.open)) return false; return true; };
  node('browser-include').checked = checked; node('browser-include').disabled = !connected;
  if (connected) node('browser-tools').hidden = false;
  node('browser-auto').checked = automatic;
  node('message').value = 'Izmišljeno vprašanje brez CPQ povezave';
  node('environment').value = 'UNKNOWN';
  node('agent-actions').value = '3'; node('agent-calls').value = '3'; node('agent-minutes').value = '2';
  const observation = { schema: 'omnicpq.gui.observation.v2', url: 'https://cpq.test.invalid/Order', title: 'Synthetic CPQ', routeScope: 'order',
    controls: [], fields: {}, text: 'FRESH_SYNTHETIC_CPQ', capturedAt: '2026-11-02T00:00:00Z' };
  const bridge = {
    async connect() { calls.connect++; return { token: 'pair-2', capabilities: { cdpAvailable: true } }; },
    async observe() { calls.observe++; return observation; },
    async disconnect() { calls.disconnect++; }, async resume() { calls.resume++; },
  };
  let serial = 0;
  const sandbox = { console, AbortController, DOMException, STARTER_VERSION: 'SYNTHETIC_STARTER_VERSION', performance: { now: () => ++serial }, navigator: { onLine: true },
    document: { getElementById: node, querySelectorAll: () => [] }, window: {}, bridgeMock: bridge,
    experienceMock: { handleCommand: () => false, setAccess() {} },
    previewRefresher: { invalidate() {}, idle() {}, noteFresh() {} },
    autoConnector: { stop() {} }, notice: text => calls.notices.push(text),
    browserProblem: error => error?.message || 'SYNTHETIC_ERROR', showWorkspaceStatus() {}, updateComparisonGate() {},
    localWrite: () => { calls.save++; }, fitComposer() {}, disconnect() {}, setSnapshot: value => { sandbox.hooks.state.snapshot = value; },
    cpqLocation: url => String(url).startsWith('https://cpq.test.invalid/') ? { environment: 'STAGE' } : null,
    rememberNavigationAmbiguities() {}, clearNavigationAmbiguities() {},
    createAgentRun: (goal, options) => ({ goal, accountId: options.accountId, epoch: options.epoch, budget: { recoveries: 0 }, attempted: [], step: 0, recoveries: 0, modelCalls: 0 }),
    runLimit: () => null, uuid: () => 'synthetic-' + ++serial, digest: async () => 'synthetic-hash', canonicalInput: value => JSON.stringify(value),
    getContext: () => ({ text: 'MANUAL_SYNTHETIC_CONTEXT', manualUrl: '', environment: 'UNKNOWN', workspace: {} }),
    conversationHistory: () => sandbox.hooks.state.messages.map(m => ({ role: m.role, content: m.content })),
    renderMessages: () => { for (const m of sandbox.hooks.state.messages) { m.statusNode ||= { textContent: '' }; m.contentNode ||= { textContent: '' }; } },
    visibleAnswer: value => value, queueConversationEnd() {}, showUsage() {}, issue: value => value,
    navigationProposal: () => null, actionSignature: () => 'mock-action', rememberCurrentOrderTabContext() {},
    executeBrowserNavigation: async () => { calls.execute++; throw Error('UNEXPECTED_CPQ_EXECUTION'); },
    navigationUnprovenEffects: new Map(), navigationNoDispatchErrors: new Set(), recoveryKind: () => null,
    fetch: async (url, options) => { calls.post.push({ url, body: JSON.parse(options.body) }); return { ok: true, headers: { get: () => 'text/event-stream' }, body: {} }; },
    sseEvents: async function* () { yield { type: 'done', status: 'complete', clientRequestId: calls.post.at(-1).body.clientRequestId }; },
    continuationMessage: run => run.goal, explicitGoalGrant: () => ({ synthetic: true }), captureFrame: async () => { throw Error('UNEXPECTED_CAPTURE'); },
  };
  const snippets = [
    source.match(/^const API = .*$/m)[0],
    between('const state = {', '\nlet installEvent'),
    "const $=id=>document.getElementById(id);let browserBridge=bridgeMock,accessEpoch=0,browserConnectionEpoch=0,browserPairToken='pair-1',browserChoiceEpoch=0,experience=experienceMock,followConversation=false;",
    source.match(/^const BRIDGE_CONNECTION_FAILURES=.*$/m)[0],
    between('function ownerAccess(', '\nfunction mayExport('),
    between('function bodyForInput(', '\nfunction unboundStageConstraint('),
    between('function unboundStageConstraint(', '\nfunction setMode('),
    between('function clearFrozen(', '\nfunction setDraft('),
    ...(source.includes('function syncBrowserIncludeControl(') ? [between('function syncBrowserIncludeControl(', '\nfunction setBusy(')] : []),
    between('function setBusy(', '\nfunction download('),
    between('function browserUnavailable(', '\nfunction disconnectBrowser('),
    between('function disconnectBrowser(', '\nlet browserObservationLane'),
    between('let browserObservationLane=null;', '\nasync function connectBrowser('),
    between('async function connectBrowser(', '\nfunction stageGoalText('),
    between('async function send(', '\nasync function freeze('),
    between("for (const id of ['browser-include','browser-auto']) $(id).onchange", "\n$('settings-open').onclick"),
    'globalThis.hooks={state,send,browserUnavailable,connectBrowser,ownerAccess,setBusy,bodyForInput,epochs:()=>({accessEpoch,browserConnectionEpoch,browserChoiceEpoch}),advanceAccess:()=>accessEpoch++,advanceConnection:()=>browserConnectionEpoch++};',
  ];
  vm.createContext(sandbox); vm.runInContext(snippets.join('\n'), sandbox, { filename: 'source-derived-public-client.js' });
  Object.assign(sandbox.hooks.state, { ownerVerified: true, role: 'owner', ready: true, accountId: 'synthetic-owner', browserConnected: connected,
    browserObservation: connected ? observation : null, pendingDraft: { message: 'PRESERVED_PENDING_DRAFT' } });
  sandbox.hooks.ownerAccess(true);
  const draft = node('message').value;
  return { ...sandbox.hooks, sandbox, bridge, node, calls, observation, draft, visible,
    toggle(id) { const control = node(id); if (control.disabled || !visible(id)) return false; control.checked = !control.checked; control.onchange?.({ target: control }); return true; } };
}

test('offline checked CPQ allows explicit opt out and ordinary send', async () => {
  const f = fixture(); f.state.messages.push({ role: 'assistant', content: 'PRESERVED_CONVERSATION' });
  f.state.browserObservation = { ...f.observation, text: 'STALE_CPQ_SYNTHETIC_SENTINEL' };
  f.browserUnavailable(Error('BRIDGE_NOT_PAIRED'));
  await f.send();
  assert.equal(f.calls.post.length, 0); assert.equal(f.node('message').value, f.draft);
  assert.equal(f.node('browser-include').checked, true);
  assert.equal(f.node('browser-include').disabled, false, 'checked unavailable context must allow explicit uncheck');
  assert.equal(f.toggle('browser-include'), true);
  assert.equal(f.node('message').value, f.draft); assert.equal(f.state.pendingDraft.message, 'PRESERVED_PENDING_DRAFT');
  f.calls.resume = 0; await f.send();
  assert.equal(f.calls.post.length, 1); assert.equal(f.calls.post[0].body.message, f.draft);
  assert.equal(f.calls.post[0].body.browser, null);
  assert.equal(JSON.stringify(f.calls.post[0].body).includes('STALE_CPQ_SYNTHETIC_SENTINEL'), false);
  assert.equal(f.calls.post[0].body.history[0].content, 'PRESERVED_CONVERSATION');
  assert.equal(f.calls.observe, 0); assert.equal(f.calls.connect, 0); assert.equal(f.calls.resume, 0); assert.equal(f.calls.execute, 0);
});

test('expired pair preserves draft and checked choice until explicit uncheck', async () => {
  const f = fixture({ connected: true });
  f.bridge.observe = async () => { f.calls.observe++; throw Error('BRIDGE_NOT_PAIRED'); };
  await f.send();
  assert.equal(f.state.browserConnected, false); assert.equal(f.state.browserObservation, null);
  assert.equal(f.node('message').value, f.draft); assert.equal(f.calls.post.length, 0);
  assert.equal(f.node('browser-include').checked, true); assert.equal(f.node('browser-include').disabled, false);
  f.toggle('browser-include'); f.calls.resume = 0; await f.send();
  assert.equal(f.calls.post.length, 1); assert.equal(f.calls.post[0].body.browser, null); assert.equal(f.calls.resume, 0);
});

test('explicit opt out excludes even a still-cached observation and preserves pause', async () => {
  const f = fixture({ connected: true, automatic: true }); f.state.browserPaused = true;
  f.state.browserObservation = { ...f.observation, text: 'CACHED_CPQ_SYNTHETIC_SENTINEL' };
  assert.equal(f.toggle('browser-include'), true); assert.equal(f.state.browserStop, true);
  assert.equal(f.state.browserObservation.text, 'CACHED_CPQ_SYNTHETIC_SENTINEL');
  await f.send();
  assert.equal(f.calls.post.length, 1); assert.equal(f.calls.post[0].body.browser, null);
  assert.equal(JSON.stringify(f.calls.post[0].body).includes('CACHED_CPQ_SYNTHETIC_SENTINEL'), false);
  assert.equal(f.calls.resume, 0); assert.equal(f.calls.observe, 0); assert.equal(f.calls.connect, 0); assert.equal(f.calls.execute, 0);
  assert.equal(f.state.browserStop, true); assert.equal(f.state.browserPaused, true);
});

test('checked unavailable does not silently fall back or repair CPQ', async () => {
  const f = fixture(); f.browserUnavailable(Error('BRIDGE_PERMISSION_REQUIRED')); await f.send();
  assert.equal(f.calls.post.length, 0); assert.equal(f.calls.observe, 0); assert.equal(f.calls.connect, 0);
  assert.equal(f.node('message').value, f.draft); assert.equal(f.node('browser-include').checked, true);
});

test('explicit opt out survives a confirmed new pair', async () => {
  const f = fixture(); f.browserUnavailable(Error('BRIDGE_NOT_PAIRED')); assert.equal(f.toggle('browser-include'), true);
  await f.connectBrowser(); assert.equal(f.state.browserConnected, true); assert.equal(f.node('browser-include').checked, false);
  assert.equal(f.node('browser-include').disabled, false); assert.equal(f.calls.post.length, 0);
});

test('choice made during pairing is preserved by the existing choice epoch', async () => {
  const f = fixture(); f.browserUnavailable(Error('BRIDGE_NOT_PAIRED'));
  let resolve; f.bridge.connect = () => { f.calls.connect++; return new Promise(r => { resolve = r; }); };
  const pending = f.connectBrowser(); assert.equal(f.toggle('browser-include'), true);
  resolve({ token: 'pair-2', capabilities: {} }); await pending;
  assert.equal(f.node('browser-include').checked, false); assert.equal(f.calls.post.length, 0);
});

test('pair identity epoch change does not restore checked context', async () => {
  const f = fixture(); f.browserUnavailable(Error('BRIDGE_NOT_PAIRED')); f.toggle('browser-include');
  let resolve; f.bridge.connect = () => new Promise(r => { resolve = r; });
  const pending = f.connectBrowser(); f.advanceAccess(); f.state.ownerVerified = false;
  resolve({ token: 'pair-2', capabilities: {} }); await pending;
  assert.equal(f.node('browser-include').checked, false); assert.equal(f.calls.observe, 0); assert.equal(f.calls.disconnect, 1);
});

test('pending approval retains pair guards and explicit no-CPQ escape', async () => {
  const f = fixture(); f.bridge.connect = async () => { f.calls.connect++; throw Error('BRIDGE_PERMISSION_REQUIRED'); };
  await f.connectBrowser(); assert.equal(f.state.browserConnected, false); assert.equal(f.node('browser-include').checked, true);
  assert.equal(f.node('browser-tools').hidden, true); assert.equal(f.node('browser-read').disabled, true); assert.equal(f.node('browser-auto').disabled, true);
  assert.equal(f.visible('browser-include'), true); assert.equal(f.calls.observe, 0); assert.equal(f.calls.post.length, 0); assert.equal(f.toggle('browser-include'), true);
  await f.send(); assert.equal(f.calls.post.length, 1); assert.equal(f.calls.post[0].body.browser, null);
});

test('busy and unverified controls cannot opt out or post', async () => {
  const f = fixture(); f.browserUnavailable(Error('BRIDGE_NOT_PAIRED')); f.setBusy(true);
  assert.equal(f.node('browser-include').disabled, true); assert.equal(f.toggle('browser-include'), false);
  await f.send(); assert.equal(f.calls.post.length, 0); assert.equal(f.node('message').value, f.draft);
  f.setBusy(false); assert.equal(f.node('browser-include').disabled, false);
  f.ownerAccess(false); assert.equal(f.node('browser-include').disabled, true); await f.send();
  assert.equal(f.calls.post.length, 0); assert.equal(f.node('message').value, f.draft);
});

test('initial checked disconnected choice becomes editable after verified access', () => {
  const f = fixture(); f.ownerAccess(true);
  assert.equal(f.node('browser-include').checked, true); assert.equal(f.node('browser-include').disabled, false);
  assert.equal(f.node('message').value, f.draft); assert.equal(f.calls.observe, 0); assert.equal(f.calls.connect, 0);
});

test('actual HTML hidden parent permits initial explicit opt out without business controls', () => {
  const f = fixture();
  assert.equal(f.node('browser-tools').hidden, true);
  assert.equal(f.visible('browser-include'), true, 'explicit include checkbox must be reachable outside hidden business controls');
  assert.equal(f.toggle('browser-include'), true); assert.equal(f.node('message').value, f.draft);
  assert.equal(f.node('browser-read').disabled, true); assert.equal(f.node('browser-auto').disabled, true);
  assert.equal(f.calls.connect, 0); assert.equal(f.calls.observe, 0); assert.equal(f.calls.post.length, 0);
});

test('late confirmed pair retains a newer busy lock on include', async () => {
  const f = fixture(); let resolve;
  f.bridge.connect = () => new Promise(r => { resolve = r; });
  const pending = f.connectBrowser(); f.setBusy(true);
  resolve({ token: 'pair-2', capabilities: {} }); await pending;
  assert.equal(f.node('browser-include').disabled, true, 'late confirmed pair must retain newer busy lock');
  assert.equal(f.toggle('browser-include'), false); assert.equal(f.calls.post.length, 0); assert.equal(f.node('message').value, f.draft);
  f.setBusy(false); assert.equal(f.node('browser-include').disabled, false);
});

test('unchecked unavailable context cannot be enabled until fresh observation', () => {
  const f = fixture({ checked: false }); f.browserUnavailable(Error('BRIDGE_NOT_PAIRED'));
  assert.equal(f.node('browser-include').disabled, true); assert.equal(f.toggle('browser-include'), false);
});

test('offline network preserves draft without CPQ or provider calls', async () => {
  const f = fixture(); f.browserUnavailable(Error('BRIDGE_NOT_PAIRED')); f.toggle('browser-include'); f.sandbox.navigator.onLine = false;
  await f.send(); assert.equal(f.calls.post.length, 0); assert.equal(f.node('message').value, f.draft);
  assert.equal(f.calls.observe, 0); assert.equal(f.calls.resume, 0); assert.equal(f.calls.connect, 0);
});

test('excluded stale context cannot drive an automatic navigation proposal', async () => {
  const f = fixture({ automatic: true }); f.node('experimental-gui').checked = true;
  f.browserUnavailable(Error('BRIDGE_NOT_PAIRED')); f.toggle('browser-include');
  f.sandbox.navigationProposal = () => ({ action: 'click', target: 'SYNTHETIC_ONLY' });
  await f.send(); assert.equal(f.calls.post[0].body.browser, null); assert.equal(f.calls.execute, 0); assert.equal(f.calls.observe, 0);
});
