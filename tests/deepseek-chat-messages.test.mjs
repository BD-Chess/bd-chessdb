import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import productionHandler, { makeMessagesHandler, config } from '../functions/deepseek-chat-messages.mjs';
import { cookieName, origin, makeSession, sessionLifetime } from '../functions/lib/deepseek-chat/session.mjs';

const owner = 'owner@example.invalid';
const secret = 't'.repeat(43);
const now = Date.now();
const getEnv = key => ({ DEEPSEEK_CHAT_OWNER_EMAIL: owner, DEEPSEEK_CHAT_SESSION_SECRET: secret }[key]);
const cookie = `${cookieName}=${makeSession(owner, secret, now)}`;
const path = config.path[0];

function request({ method = 'GET', id, body, credentials = cookie, siteOrigin = origin, host = origin } = {}) {
  const headers = new Headers();
  if (credentials) headers.set('cookie', credentials);
  if (siteOrigin) headers.set('origin', siteOrigin);
  if (body !== undefined) headers.set('content-type', 'application/json');
  return new Request(host + path + (id ? `/${id}` : ''), {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function syntheticMailbox() {
  const messages = new Map();
  const calls = [];
  return {
    messages,
    calls,
    async available(account) {
      calls.push(['available', account]);
      return true;
    },
    async get({ owner, id }) {
      calls.push(['get', owner]);
      return messages.get(id);
    },
    async enqueue({ owner, id, prompt, reasoning }) {
      calls.push(['enqueue', owner]);
      const previous = messages.get(id);
      if (previous) return previous.prompt === prompt && previous.reasoning === reasoning ? previous : null;
      const message = { id, state: 'queued', prompt, reasoning, internal: 'fixture-only' };
      messages.set(id, message);
      return message;
    },
    async stop({ owner, id }) {
      calls.push(['stop', owner]);
      const previous = messages.get(id);
      if (previous && previous.state !== 'complete') previous.state = 'stopping';
      return previous;
    },
  };
}

test('production handler keeps mailbox disconnected by default', async () => {
  const handler = makeMessagesHandler({ getEnv, now: () => now });
  assert.equal(typeof productionHandler, 'function');
  const health = await handler(request());
  assert.deepEqual(await health.json(), { available: false });
  assert.equal(health.headers.get('cache-control'), 'no-store, private');
  const body = { id: randomUUID(), prompt: 'fixture', reasoning: true };
  assert.equal((await handler(request({ method: 'POST', body }))).status, 503);
  assert.equal((await handler(request({ id: body.id }))).status, 503);
});

test('authenticated submission, distinct ACK and result with matching UUID', async () => {
  const mailbox = syntheticMailbox();
  const handler = makeMessagesHandler({ mailbox, getEnv, now: () => now });
  const id = randomUUID();
  const body = { id, prompt: '  Kaj je 17 + 25?  ', reasoning: true };
  const submitted = await handler(request({ method: 'POST', body }));
  assert.equal(submitted.status, 202);
  assert.deepEqual(await submitted.json(), { id, state: 'queued', prompt: 'Kaj je 17 + 25?' });
  assert.equal(mailbox.messages.get(id).reasoning, true);
  mailbox.messages.get(id).state = 'acknowledged';
  assert.equal((await (await handler(request({ id }))).json()).state, 'acknowledged');
  Object.assign(mailbox.messages.get(id), { state: 'complete', reply: '42' });
  assert.deepEqual(await (await handler(request({ id }))).json(), {
    id, state: 'complete', prompt: 'Kaj je 17 + 25?', reply: '42',
  });
  assert.equal((await handler(request({ id: randomUUID() }))).status, 404);
  assert.equal((await handler(request({ method: 'POST', body: { ...body, prompt: 'Drugačno vprašanje' } }))).status, 409);
  const repeat = await handler(request({ method: 'POST', body }));
  assert.equal((await repeat.json()).state, 'complete');
  assert.equal(mailbox.messages.size, 1);
  assert.ok(mailbox.calls.every(([, account]) => account === owner));
});

test('unauthenticated, expired, cross-origin and malformed requests do not call the adapter', async () => {
  const mailbox = syntheticMailbox();
  const handler = makeMessagesHandler({ mailbox, getEnv, now: () => now });
  const id = randomUUID();
  const body = { id, prompt: 'Test', reasoning: false };
  assert.equal((await handler(request({ credentials: '' }))).status, 401);
  const expired = `${cookieName}=${makeSession(owner, secret, now - sessionLifetime * 1000)}`;
  assert.equal((await handler(request({ credentials: expired, id }))).status, 401);
  assert.equal((await handler(request({ method: 'POST', body, siteOrigin: null }))).status, 403);
  assert.equal((await handler(request({ method: 'POST', body, siteOrigin: 'https://outside.invalid' }))).status, 403);
  assert.equal((await handler(request({ method: 'POST', body }), { site: { name: 'bd-chess' } })).status, 404);
  assert.equal((await handler(request({ host: 'https://outside.invalid' }))).status, 404);
  assert.equal((await handler(request({ id: 'not-uuid' }))).status, 404);
  for (const malformed of [
    { ...body, id: 12 }, { ...body, prompt: ' ' }, { ...body, reasoning: 'true' },
    { ...body, prompt: 'x'.repeat(8001) }, { ...body, prompt: 'x'.repeat(70000) }, { ...body, shell: true },
  ]) {
    assert.equal((await handler(request({ method: 'POST', body: malformed }))).status, 400);
  }
  assert.deepEqual(mailbox.calls, []);
});

test('STOP response distinguishes request from final stop and preserves a completed reply', async () => {
  const mailbox = syntheticMailbox();
  const handler = makeMessagesHandler({ mailbox, getEnv, now: () => now });
  const id = randomUUID();
  await handler(request({ method: 'POST', body: { id, prompt: 'test', reasoning: true } }));
  const stopRequest = () => request({ method: 'POST', id, body: { action: 'stop' } });
  const stopped = await handler(stopRequest());
  assert.equal(stopped.status, 202);
  assert.equal((await stopped.json()).state, 'stopping');
  mailbox.messages.get(id).state = 'stopped';
  assert.equal((await (await handler(request({ id }))).json()).state, 'stopped');
  Object.assign(mailbox.messages.get(id), { state: 'complete', reply: '42' });
  assert.equal((await (await handler(stopRequest())).json()).reply, '42');
  mailbox.messages.get(id).id = randomUUID();
  assert.equal((await handler(request({ id }))).status, 503);
});
