import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeAuthHandler, config } from '../functions/deepseek-chat-auth.mjs';
import { passwordHash } from '../functions/lib/mdlxdcc-guide/access.mjs';
import { account, cookieName, origin, sessionLifetime } from '../functions/lib/deepseek-chat/session.mjs';

const password = 'fixture-only-synthetic-password';
const signing = 'z'.repeat(43);
const hash = await passwordHash(password);
const env = new Map([['DEEPSEEK_CHAT_PASSWORD_HASH', hash], ['DEEPSEEK_CHAT_SESSION_SECRET', signing]]);
let now = Date.now();
const handler = makeAuthHandler({ getEnv: key => env.get(key), now: () => now });
const site = { site: { name: 'mdlxdcc' } };

function request({ host = origin, siteOrigin = origin, body, cookie, metadata } = {}) {
  const headers = new Headers();
  if (body !== undefined) {
    if (siteOrigin !== null) headers.set('origin', siteOrigin);
    headers.set('content-type', 'application/json');
  }
  if (cookie) headers.set('cookie', cookie);
  if (metadata) headers.set('sec-fetch-site', metadata);
  return new Request(host + config.path, { method: body === undefined ? 'GET' : 'POST',
    headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

test('login verifies a real scrypt password and issues a host-only protected cookie', async () => {
  const initial = await handler(request(), site);
  assert.deepEqual(await initial.json(), { authenticated: false });
  assert.equal(initial.headers.get('set-cookie'), null);

  const response = await handler(request({ body: { action: 'login', email: account, password } }), site);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.deepEqual(await response.json(), { authenticated: true, email: account, connection: 'pending' });
  const value = response.headers.get('set-cookie');
  assert.match(value, /^__Host-mdlxdcc-deepseek=/);
  assert.match(value, /Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800$/);
  assert.doesNotMatch(value, /Domain=/i);
  assert.doesNotMatch(value, new RegExp(password));
  const cookie = value.split(';')[0];

  const authenticated = await handler(request({ cookie }), site);
  assert.equal((await authenticated.json()).authenticated, true);
  const foreign = await handler(request({ cookie: cookie.replace(cookieName, '__Host-mdlxdcc-guide') }), site);
  assert.equal((await foreign.json()).authenticated, false);
  const tampered = await handler(request({ cookie: cookie.replace(/=./, '=!') }), site);
  assert.equal((await tampered.json()).authenticated, false);
  const duplicate = await handler(request({ cookie: [cookie, cookie].join('; ') }), site);
  assert.equal((await duplicate.json()).authenticated, false);

  const logout = await handler(request({ cookie, body: { action: 'logout' } }), site);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0$/);
  assert.equal((await logout.json()).authenticated, false);

  const stat = now;
  now += sessionLifetime * 1000;
  try {
    const expired = await handler(request({ cookie }), site);
    assert.equal((await expired.json()).authenticated, false);
  } finally {
    now = stat;
  }
});

test('wrong owner, wrong password and attempts from another site fail closed', async () => {
  const body = { action: 'login', email: account, password };
  for (const attempt of [{ ...body, email: 'someone@example.invalid' }, { ...body, password: 'wrong' }]) {
    const response = await handler(request({ body: attempt }), site);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.deepEqual(await response.json(), { error: 'INVALID_LOGIN' });
  }
  for (const info of [{ siteOrigin: 'https://other.example' }, { siteOrigin: null }, { metadata: 'cross-site' }]) {
    const denied = await handler(request({ body, ...info }), site);
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
  }
  assert.equal((await handler(request({ host: 'https://preview.example', body }), site)).status, 404);
  assert.equal((await handler(request({ body }), { site: { name: 'bd-chess' } })).status, 404);
  assert.equal((await handler(request({ body: { ...body, pad: 'x'.repeat(2100) } }), site)).status, 400);
  assert.equal((await makeAuthHandler({ getEnv: () => undefined })(request({ body }), site)).status, 503);
});

test('public page serves only client assets with a password input and independent route', async () => {
  const html = await readFile(new URL('../public/deepseek-chat/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../public/deepseek-chat/chat.js', import.meta.url), 'utf8');
  assert.match(html, /noindex,nofollow,noarchive/);
  assert.match(html, /type="password" autocomplete="current-password"/);
  assert.match(html, /method="post"/);
  assert.match(script, /'\/deepseek-chat\/api\/session'/);
  assert.doesNotMatch(html + script, /DEEPSEEK_CHAT_(SESSION_SECRET|PASSWORD_HASH)|bd@siol\.net|scrypt-v1/);
  assert.equal(config.rateLimit.windowLimit, 12);
});
