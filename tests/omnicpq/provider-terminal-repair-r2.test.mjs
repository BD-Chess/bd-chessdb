import {MODEL_PROFILES as profiles,DEFAULT_PROFILE,modelProfile} from '../../public/OmniCPQ/model-profiles.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createHash, randomUUID } from 'node:crypto';

// Only trusted public source is evaluated; no native provider/backend dependency import.
// Every credential and transport below is synthetic. VM is not a security sandbox.
const providerSource = await fs.readFile(new URL('../../functions/lib/omnicpq/provider.mjs', import.meta.url), 'utf8');
const backendSource = await fs.readFile(new URL('../../functions/omnicpq-assistant.mjs', import.meta.url), 'utf8');
const deliveryReleaseSource = await fs.readFile(new URL('../../functions/lib/omnicpq/delivery-release.mjs', import.meta.url), 'utf8');
const problem = (code, status = 503) => Object.assign(new Error(code), { code, status });
const frame = value => 'data: ' + JSON.stringify(value) + '\n\n';
const created = { type: 'response.created', response: { id: 'synthetic-response', model: 'synthetic-model', reasoning: { effort: 'low' } } };
const delta = text => ({ type: 'response.output_text.delta', delta: text });
const terminal = (status = 'completed') => ({
  type: 'response.' + status, response: {
    id: 'synthetic-response', model: 'synthetic-model', status, reasoning: { effort: 'low' },
    usage: { input_tokens: 7, output_tokens: 3, total_tokens: 10 },
    ...(status === 'incomplete' ? { incomplete_details: { reason: 'max_output_tokens' } } : {}),
  },
});
const encoder = new TextEncoder();
const tick = () => new Promise(resolve => setImmediate(resolve));
async function bounded(promise, label = 'synthetic result') {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('TEST_DEADLINE:' + label)), 600);
    })]);
  } finally { clearTimeout(timer); }
}
function fakeStream(events, { close = false, cancel = 'resolve', chunks } = {}) {
  const stats = { cancel: 0, pull: 0 };
  let controller;
  const stream = new ReadableStream({
    start(value) {
      controller = value;
      for (const chunk of chunks || [encoder.encode(events.map(frame).join(''))]) value.enqueue(chunk);
      if (close) value.close();
    },
    pull() { stats.pull++; },
    cancel() {
      stats.cancel++;
      if (cancel === 'pending') return new Promise(() => {});
      if (cancel === 'reject') return Promise.reject(new Error('SYNTHETIC_CANCEL_SECRET'));
    },
  });
  return { stream, stats, close() { try { controller.close(); } catch {} } };
}
function loadProvider({ key = 'SYNTHETIC_DUMMY_KEY' } = {}) {
  let source = providerSource.replace(/\r\n/g, '\n');
  const header = "import { error } from './identity.mjs';\n";
  assert.ok(source.startsWith(header), 'exact public import boundary');
  source = source.slice(header.length).replaceAll('export async ', 'async ');
  assert.doesNotMatch(source, /\bimport\s*(?:\(|[{'"*])/);
  const counters = { defaultFetch: 0, fakeKeyReads: 0, fallbackEnvReads: 0 };
  const scope = vm.createContext({
    TextDecoder, error: problem,
    Netlify: { env: { get(name) {
      assert.equal(name, 'OPENAI_API_KEY'); counters.fakeKeyReads++; return key;
    } } },
    process: { env: new Proxy({}, { get() {
      counters.fallbackEnvReads++; throw new Error('ENV_FALLBACK_DENIED');
    } }) },
    fetch() { counters.defaultFetch++; throw new Error('DEFAULT_NETWORK_DENIED'); },
  });
  vm.runInContext(source + '\n;globalThis.api = { readSSE, callOpenAI };', scope);
  return { ...scope.api, counters };
}
function runProvider(events, options = {}) {
  const p = loadProvider(options), io = fakeStream(events, options);
  const seen = { text: [], identity: [], requests: [] };
  const control = options.control || new AbortController();
  const payload = { model: 'synthetic-model', input: [], reasoning: { effort: 'low' }, max_output_tokens: 6000, store: false, service_tier: 'default', stream: true };
  const promise = p.callOpenAI({
    payload, signal: control.signal,
    onText(text) { seen.text.push(text); options.onText?.(text); },
    onIdentity(identity) { seen.identity.push(identity); options.onIdentity?.(identity); },
    fetcher: async (url, init) => {
      seen.requests.push({ url, init });
      return new Response(io.stream, { status: options.status || 200, headers: { 'x-request-id': 'synthetic-request' } });
    },
  });
  return { ...p, io, seen, control, payload, promise };
}
async function rejectsCode(promise, code, status) {
  await assert.rejects(bounded(promise), e => e.code === code && (status === undefined || e.status === status));
}
function plain(value) { return JSON.parse(JSON.stringify(value)); }

test('T01 completed is logical terminal before EOF, with usage and identity', async () => {
  const r = runProvider([created, delta('answer'), terminal()]);
  try {
    const result = await bounded(r.promise);
    assert.equal(result.status, 'complete');
    assert.deepEqual(plain(result.usage), { input_tokens: 7, output_tokens: 3, total_tokens: 10 });
    assert.equal(result.providerRequestId, 'synthetic-request');
    assert.equal(result.responseId, 'synthetic-response');
    assert.deepEqual(r.seen.text, ['answer']);
    assert.equal(r.io.stream.locked, false);
    assert.equal(r.io.stats.cancel, 1);
  } finally { r.io.close(); }
});
test('T02 incomplete is partial before EOF and preserves reason', async () => {
  const r = runProvider([created, delta('partial'), terminal('incomplete')]);
  try {
    const result = await bounded(r.promise);
    assert.equal(result.status, 'partial');
    assert.equal(result.incompleteReason, 'max_output_tokens');
    assert.equal(result.usage.output_tokens, 3);
  } finally { r.io.close(); }
});
test('T03 post-terminal text/error/second terminal are not consumed', async () => {
  for (const status of ['completed', 'incomplete']) {
    const r = runProvider([created, delta('before'), terminal(status), delta('AFTER'), { type: 'error', message: 'SECRET' }, terminal()]);
    try {
      const result = await bounded(r.promise);
      assert.deepEqual(r.seen.text, ['before']);
      assert.equal(r.seen.identity.length, 2);
      assert.equal(result.status, status === 'completed' ? 'complete' : 'partial');
    } finally { r.io.close(); }
  }
});
test('T04 EOF without semantic terminal is protocol failure, not complete', async () => {
  for (const events of [[created, delta('retained')], [created, { type: 'response.output_item.done' }], [created]]) {
    const r = runProvider(events, { close: true });
    await rejectsCode(r.promise, 'PROVIDER_PROTOCOL');
    assert.deepEqual(r.seen.text, events.some(e => e.delta) ? ['retained'] : []);
  }
});
test('T05 failed and provider error use static failure, no arbitrary message leak', async () => {
  for (const type of ['response.failed', 'error']) {
    const r = runProvider([created, delta('partial'), { type, message: 'DO_NOT_LEAK', response: { error: { message: 'DO_NOT_LEAK' } } }], { cancel: 'pending' });
    try {
      await assert.rejects(bounded(r.promise), e => e.code === 'ANSWER_UNAVAILABLE' && !e.message.includes('DO_NOT_LEAK'));
      assert.deepEqual(r.seen.text, ['partial']);
    } finally { r.io.close(); }
  }
});
test('T06 HTTP errors keep mappings and do not await pending cancellation', async () => {
  for (const status of [400, 401, 429, 500, 503]) {
    const r = runProvider([], { status, cancel: 'pending' });
    try {
      await rejectsCode(r.promise, status === 429 ? 'RATE_LIMITED' : status === 400 ? 'MODEL_PROFILE_UNAVAILABLE' : 'AI_UNAVAILABLE', status === 429 ? 429 : status === 400 ? 400 : 503);
      assert.equal(r.seen.requests.length, 1);
      assert.equal(r.io.stats.cancel, 1);
    } finally { r.io.close(); }
  }
});
test('T07 pre-aborted signal is forwarded and remains cancelled', async () => {
  const control = new AbortController(); control.abort();
  const r = runProvider([created, terminal()], { control });
  try {
    await rejectsCode(r.promise, 'CANCELLED', 499);
    assert.equal(r.seen.requests[0].init.signal, control.signal);
    assert.deepEqual(r.seen.text, []);
  } finally { r.io.close(); }
});
test('T08 abort while waiting for a read remains cancelled and releases reader', async () => {
  const r = runProvider([created], { cancel: 'pending' });
  try {
    await tick();
    r.control.abort();
    // Existing EOF-after-abort path guarantees CANCELLED; its helper-default status is not 499.
    await rejectsCode(r.promise, 'CANCELLED');
    assert.equal(r.io.stream.locked, false);
  } finally { r.io.close(); }
});
test('T09 pending cancellation cannot hold a completed OR incomplete terminal', async () => {
  for (const status of ['completed', 'incomplete']) {
    const r = runProvider([created, delta('ok'), terminal(status)], { cancel: 'pending' });
    try {
      const result = await bounded(r.promise, 'pending cancellation');
      assert.equal(result.status, status === 'completed' ? 'complete' : 'partial');
      assert.equal(r.io.stats.cancel, 1);
      assert.equal(r.io.stream.locked, false);
    } finally { r.io.close(); }
  }
});
test('T10 rejected cancellation is handled without unhandled rejection', async () => {
  const unhandled = [];
  const onUnhandled = e => unhandled.push(e);
  process.on('unhandledRejection', onUnhandled);
  try {
    for (const status of [200, 429]) {
      const r = runProvider([created, delta('ok'), terminal()], { cancel: 'reject', status });
      try {
        if (status === 200) assert.equal((await bounded(r.promise)).status, 'complete');
        else await rejectsCode(r.promise, 'RATE_LIMITED');
      } finally { r.io.close(); }
    }
    await tick(); await tick();
    assert.equal(unhandled.length, 0);
  } finally { process.removeListener('unhandledRejection', onUnhandled); }
});
test('T11 split UTF8 and CRLF framing preserve Unicode', async () => {
  const wire = [created, delta('č😀\u2028\u0085漢'), terminal()].map(frame).join('').replaceAll('\n', '\r\n');
  const bytes = encoder.encode(wire);
  const chunks = Array.from(bytes, value => new Uint8Array([value]));
  const r = runProvider([], { chunks, cancel: 'pending' });
  try { await bounded(r.promise); assert.deepEqual(r.seen.text, ['č😀\u2028\u0085漢']); }
  finally { r.io.close(); }
});
test('T12 multiline data, comments, keepalives and DONE preserve framing', async () => {
  const wire = ': keepalive\n\nevent: ignored\n' + frame(created) +
    'data: {"type":"response.output_text.delta",\ndata: "delta":"joined"}\n\n' +
    'data: [DONE]\n\n' + frame(terminal());
  const r = runProvider([], { chunks: [encoder.encode(wire)] });
  try { assert.equal((await bounded(r.promise)).status, 'complete'); assert.deepEqual(r.seen.text, ['joined']); }
  finally { r.io.close(); }
});
test('T13 existing 1M buffer cap and malformed JSON still fail', async () => {
  for (const wire of ['x'.repeat(1_000_001), 'data: {not-json}\n\n']) {
    const r = runProvider([], { chunks: [encoder.encode(wire)], cancel: 'pending' });
    try {
      await assert.rejects(bounded(r.promise), e => wire.length > 1_000_000 ? e.code === 'PROVIDER_PROTOCOL' : e.name === 'SyntaxError');
      assert.equal(r.io.stream.locked, false);
    } finally { r.io.close(); }
  }
});
test('T14 mismatched, absent and malformed terminal status cannot become complete', async () => {
  for (const event of [
    { type: 'response.completed' },
    { type: 'response.completed', response: { status: 'incomplete', model: 'synthetic-model' } },
    { type: 'response.incomplete', response: { status: 'completed', model: 'synthetic-model' } },
    { type: 'response.completed', response: { status: null } },
    { type: 'response.completed', response: [] },
    { type: 'response.completed', response: 'completed' },
  ]) {
    const r = runProvider([created, event], { close: true });
    await rejectsCode(r.promise, 'PROVIDER_PROTOCOL');
  }
  const r = runProvider([{ type: 'response.completed', response: { status: 'completed' } }]);
  try { await rejectsCode(r.promise, 'PROVIDER_PROTOCOL'); } finally { r.io.close(); }
});
test('T15 callback exceptions terminate and do not wait for cancellation', async () => {
  for (const callback of ['onText', 'onIdentity']) {
    const sentinel = new Error('SYNTHETIC_CALLBACK_FAILURE');
    const r = runProvider([created, delta('before'), terminal()], {
      cancel: 'pending', [callback]() { throw sentinel; },
    });
    try { await assert.rejects(bounded(r.promise), e => e === sentinel); assert.equal(r.io.stream.locked, false); }
    finally { r.io.close(); }
  }
});
test('T16 missing synthetic key means no even-fake transport and no real environment access', async () => {
  const p = loadProvider({ key: '' });
  let calls = 0;
  await rejectsCode(p.callOpenAI({
    payload: {}, signal: new AbortController().signal, onText() {}, onIdentity() {},
    fetcher() { calls++; throw new Error('SHOULD_NOT_FETCH'); },
  }), 'AI_UNAVAILABLE');
  assert.equal(calls, 0); assert.equal(p.counters.defaultFetch, 0); assert.equal(p.counters.fallbackEnvReads, 0);
});
test('T17 payload, model, reasoning, token cap, store and service tier are unchanged; single fixed endpoint', async () => {
  const r = runProvider([created, terminal()]);
  try {
    await bounded(r.promise);
    assert.equal(r.seen.requests.length, 1);
    const { url, init } = r.seen.requests[0];
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(init.method, 'POST');
    assert.equal(init.signal, r.control.signal);
    assert.deepEqual(JSON.parse(init.body), r.payload);
    assert.equal(init.headers.Authorization, 'Bearer SYNTHETIC_DUMMY_KEY');
    assert.equal(r.counters.defaultFetch, 0); assert.equal(r.counters.fallbackEnvReads, 0);
    assert.equal(r.counters.fakeKeyReads, 1);
  } finally { r.io.close(); }
});
test('T18 transport rejection is not retried or replaced with a different model', async () => {
  const p = loadProvider(); let calls = 0;
  const sentinel = new Error('SYNTHETIC_TRANSPORT_FAILURE');
  await assert.rejects(p.callOpenAI({
    payload: { model: 'synthetic-model' }, signal: new AbortController().signal, onText() {}, onIdentity() {},
    fetcher() { calls++; throw sentinel; },
  }), e => e === sentinel);
  assert.equal(calls, 1); assert.equal(p.counters.defaultFetch, 0);
});

const backendImports = [
  "import { randomUUID, createHash } from 'node:crypto';",
  "import { authenticateOmni, demoBudget } from './lib/omnicpq/runtime.mjs';",
  "import { APP_VERSION, SKILL, ADAPTER_DELTA, error } from './lib/omnicpq/identity.mjs';",
  "import { makeDeliveryMetadata } from './lib/omnicpq/delivery-release.mjs';",
  "import { loadKnowledge } from './lib/omnicpq/knowledge.mjs';",
  "import { instructions } from './lib/omnicpq/instructions.mjs';",
  "import { callOpenAI } from './lib/omnicpq/provider.mjs';",
  "import { validateBrowser, starterMetadata, allowedStarter } from './lib/omnicpq/browser.mjs';",
  "import {normalizeMode,normalizeWorkspace,CONTEXT_FIELDS} from '../public/OmniCPQ/work-modes.mjs';",
  "import {MODEL_PROFILES as profiles,DEFAULT_PROFILE,modelProfile} from '../public/OmniCPQ/model-profiles.mjs';",
  "import {makeDemoHandler} from './lib/omnicpq/demo-assistant.mjs';",
];
function loadBackend(provider) {
  let source = backendSource.replace(/\r\n/g, '\n');
  for (const line of backendImports) {
    assert.equal(source.split(line).length, 2, 'exact backend import boundary');
    source = source.replace(line, '');
  }
  const initializer = '\nconst requestGate={seen:new Map(),active:new Set()};';
  assert.equal(source.split(initializer).length, 2);
  source = source.split(initializer)[0].replaceAll('export function ', 'function ').replaceAll('export const ', 'const ');
  assert.doesNotMatch(source, /\bimport\s*(?:\(|[{'"*])/);
  const deny = () => { throw new Error('NATIVE_DEFAULT_DEPENDENCY_DENIED'); };
  const deliveryCode = deliveryReleaseSource.replaceAll('export function ', 'function ').replaceAll('export const ', 'const ');
  assert.doesNotMatch(deliveryCode, /\bimport\s*(?:\(|[{'"*])/);
  const deliveryScope = vm.createContext({ fetch: deny, process: { env: new Proxy({}, { get: deny }) }, Netlify: { env: { get: deny } } });
  vm.runInContext(deliveryCode + '\n;globalThis.makeDeliveryMetadata = makeDeliveryMetadata;', deliveryScope);
  const scope = vm.createContext({
    TextEncoder, TextDecoder, Buffer, Response, URL, ReadableStream, AbortController,
    profiles, DEFAULT_PROFILE, modelProfile, makeDemoHandler: deny,
    setTimeout, clearTimeout, performance, randomUUID, createHash,
    console: { warn() {} }, error: problem,
    Netlify: { env: { get(name) {
      if (name === 'OMNICPQ_MODEL') return 'gpt-6-luna';
      throw new Error('UNEXPECTED_SYNTHETIC_ENV_KEY');
    } } },
    process: { env: new Proxy({}, { get: deny }) },
    APP_VERSION: 'SYNTHETIC', SKILL: 'SYNTHETIC', ADAPTER_DELTA: 'SYNTHETIC',
    makeDeliveryMetadata: deliveryScope.makeDeliveryMetadata,
    authenticateOmni: deny, demoBudget: deny, loadKnowledge: deny, callOpenAI: provider,
    instructions: () => 'SYNTHETIC_INSTRUCTIONS_NO_PRIVATE_KNOWLEDGE',
    validateBrowser: () => null, starterMetadata: [], allowedStarter: () => false,
    normalizeMode: value => ['work', 'guide', 'test'].includes(value) ? value : null,
    normalizeWorkspace: value => value, CONTEXT_FIELDS: {},
  });
  vm.runInContext(source + '\n;globalThis.api = { makeHandler, buildPayload };', scope);
  return scope.api;
}
async function backendCase(events, { abort = false, profile = 'fast' } = {}) {
  // Rebind only authenticated model setup to the selected current profile. Event order, text and terminal oracles stay unchanged.
  const selected=modelProfile(profile);
  const currentEvents=events.map(e=>e.response?.model==='synthetic-model'?{...e,response:{...e.response,model:selected.model,reasoning:{effort:selected.reasoning}}}:e);
  const p = loadProvider(), io = fakeStream(currentEvents, { cancel: 'pending' });
  const counters = { fetch: 0, reserve: 0, settle: 0, auth: 0, knowledge: 0, cpq: 0 };
  const seenPayload = [];
  const { makeHandler } = loadBackend(p.callOpenAI);
  const handler = makeHandler({
    enabled: true,
    accessFactory: async () => { counters.auth++; return { id: 'synthetic-owner', role: 'owner' }; },
    knowledgeFactory: async () => {
      counters.knowledge++;
      return {
        skill: 'SYNTHETIC', services: [], canonicalPrompts: [],
        retrieve: async () => ({ service: null, sources: [] }),
        validateLifecycleAnswer: () => ({ status: 'SYNTHETIC_NO_BUSINESS_APPROVAL' }),
      };
    },
    budgetFactory: () => ({
      reserve: async () => { counters.reserve++; return { id: 'synthetic-hold' }; },
      settle: async () => { counters.settle++; return { synthetic: true }; },
    }),
    transport: args => {
      seenPayload.push(plain(args.payload));
      return p.callOpenAI({ ...args, fetcher: async () => {
        counters.fetch++;
        return new Response(io.stream, { headers: { 'x-request-id': 'synthetic-request' } });
      } });
    },
  });
  const controller = new AbortController();
  const req = new Request('https://synthetic.invalid/.netlify/functions/omnicpq', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
    body: JSON.stringify({ message: 'SYNTHETIC_NO_CPQ', mode: 'work', profile, history: [], context: {}, clientRequestId: randomUUID() }),
  });
  let response;
  try {
    response = await handler(req);
    assert.equal(response.status, 200);
    const reading = response.text();
    if (abort) { await tick(); controller.abort(); }
    const wire = await bounded(reading, 'backend terminal');
    const messages = wire.trim().split('\n\n').filter(Boolean).map(line => JSON.parse(line.slice(6)));
    return { messages, counters, seenPayload };
  } finally { controller.abort(); io.close(); if (response?.body && !response.body.locked) await response.body.cancel().catch(() => {}); }
}
test('T19 backend genuine provider completion emits exactly one done without HTTP EOF', async () => {
  const { messages, counters, seenPayload } = await backendCase([created, delta('answer'), terminal(), delta('LATE')]);
  const endings = messages.filter(m => ['done', 'error'].includes(m.type));
  assert.equal(endings.length, 1); assert.equal(endings[0].type, 'done'); assert.equal(endings[0].status, 'complete');
  assert.deepEqual(messages.filter(m => m.type === 'delta').map(m => m.text), ['answer']);
  assert.equal(counters.fetch, 1); assert.equal(counters.reserve, 1); assert.equal(counters.settle, 1);
  assert.equal(counters.cpq, 0);
  assert.equal(seenPayload[0].model, 'gpt-6-luna');
  assert.equal(seenPayload[0].reasoning.effort, 'medium');
  assert.equal(seenPayload[0].max_output_tokens, 6000);
  assert.equal(seenPayload[0].store, false);
  assert.equal(seenPayload[0].service_tier, 'default');
});
test('T20 backend incomplete emits one partial done and keeps careful reasoning unchanged', async () => {
  const { messages, counters, seenPayload } = await backendCase([created, delta('part'), terminal('incomplete')], { profile: 'careful' });
  const endings = messages.filter(m => ['done', 'error'].includes(m.type));
  assert.equal(endings.length, 1); assert.equal(endings[0].type, 'done'); assert.equal(endings[0].status, 'partial');
  assert.equal(endings[0].incompleteReason, 'max_output_tokens');
  assert.equal(seenPayload[0].model, 'gpt-6.1-terra');
  assert.equal(seenPayload[0].reasoning.effort, 'high');
  assert.equal(counters.fetch, 1); assert.equal(counters.cpq, 0);
});
test('T21 backend provider failure emits one static error, never done', async () => {
  const { messages, counters } = await backendCase([created, delta('part'), { type: 'response.failed', response: { error: { message: 'PRIVATE_SYNTHETIC_MESSAGE' } } }]);
  const endings = messages.filter(m => ['done', 'error'].includes(m.type));
  assert.equal(endings.length, 1); assert.equal(endings[0].type, 'error');
  assert.equal(endings[0].code, 'ANSWER_UNAVAILABLE'); assert.equal(endings[0].partial, true);
  assert.equal(JSON.stringify(messages).includes('PRIVATE_SYNTHETIC_MESSAGE'), false);
  assert.equal(counters.settle, 1); assert.equal(counters.cpq, 0);
});
test('T22 backend explicit abort emits one CANCELLED error, never done', async () => {
  const { messages, counters } = await backendCase([created, delta('part')], { abort: true });
  const endings = messages.filter(m => ['done', 'error'].includes(m.type));
  assert.equal(endings.length, 1); assert.equal(endings[0].type, 'error'); assert.equal(endings[0].code, 'CANCELLED');
  assert.equal(counters.settle, 1); assert.equal(counters.cpq, 0);
});
