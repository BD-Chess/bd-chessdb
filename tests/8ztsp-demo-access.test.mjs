import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createDemoAccess, KEEP_DAYS, LIMITS } from '../functions/lib/8ztsp-demo-access.mjs';

class MemoryStore {
  constructor() { this.map = new Map(); }
  async setJSON(key, value) { this.map.set(key, JSON.stringify(value)); return { modified: true, etag: '"1"' }; }
  async get(key, { type } = {}) { const v = this.map.get(key); return v === undefined ? null : type === 'json' ? JSON.parse(v) : v; }
  async delete(key) { this.map.delete(key); }
  async list({ prefix = '' } = {}) { return { blobs: [...this.map.keys()].filter(k => k.startsWith(prefix)).map(key => ({ key, etag: '"1"' })), directories: [] }; }
}

const TOKEN = 'test-read-token-0123456789abcdef';
const HASH = createHash('sha256').update(TOKEN).digest('hex');
const T0 = Date.UTC(2026, 10, 15, 12, 1, 2);
const URL0 = 'https://www.mdlxdcc.org/api/8ztsp-demo-access';
const CONTEXT = { ip: '203.0.113.7', geo: { city: 'Ljubljana', subdivision: { name: 'Ljubljana', code: '061' }, country: { name: 'Slovenia', code: 'SI' }, timezone: 'Europe/Ljubljana', latitude: 46.05, longitude: 14.5 } };

let ids = 0;
const make = (store, clock = { t: T0 }, hash = HASH) =>
  createDemoAccess({ store, readTokenSha256: hash, now: () => clock.t, newId: () => (++ids).toString(16).padStart(12, '0') });
const post = (handle, body, raw) => handle(new Request(URL0, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'User-Agent': 'TestBrowser/1.0', 'Accept-Language': 'sl-SI,sl;q=0.9,en;q=0.8' },
  body: raw ?? JSON.stringify(body)
}), CONTEXT);
const read = (handle, token = TOKEN, method = 'GET', query = '') => handle(new Request(URL0 + query, {
  method, headers: token === null ? {} : { Authorization: 'Bearer ' + token }
}), CONTEXT);
const valid = { email: ' Ana@Example.org ', why: 'Teaching TSP', lang: 'sl-SI,en', tz: 'Europe/Ljubljana', ref: 'https://www.mdlxdcc.org/bd/bd_8ztsp', page: '/bd/bd_8ztsp_web', company: '' };

test('a valid request is stored with server and browser fields, and returned for the notification form', async () => {
  const store = new MemoryStore(); const handle = make(store);
  const res = await post(handle, valid); const body = await res.json();
  assert.equal(res.status, 200); assert.equal(body.ok, true);
  assert.match(body.id, /^20261115T120102Z-[0-9a-f]{12}$/);
  assert.equal(res.headers.get('cache-control'), 'no-store'); assert.equal(res.headers.get('set-cookie'), null);
  const [key] = [...store.map.keys()]; assert.equal(key, 'req/' + body.id);
  const r = JSON.parse(store.map.get(key));
  assert.equal(r.email, 'ana@example.org'); assert.equal(r.receivedAt, '2026-11-15T12:01:02.000Z');
  assert.equal(r.ip, '203.0.113.7');
  assert.deepEqual(r.location, { city: 'Ljubljana', region: 'Ljubljana', country: 'Slovenia', countryCode: 'SI', timezone: 'Europe/Ljubljana' });
  assert.equal(r.userAgent, 'TestBrowser/1.0'); assert.equal(r.acceptLanguage, 'sl-SI,sl;q=0.9,en;q=0.8');
  assert.equal(r.browserLanguages, 'sl-SI,en'); assert.equal(r.browserTimezone, 'Europe/Ljubljana');
  assert.equal(r.referrer, valid.ref); assert.equal(r.page, '/bd/bd_8ztsp_web'); assert.equal(r.why, 'Teaching TSP');
  assert.equal('latitude' in r.location, false, 'no coordinates are stored');
  assert.equal(body.notify.location, 'Ljubljana, Ljubljana, Slovenia'); assert.equal(body.notify.request_id, body.id);
  assert.equal(body.notify.ip, '203.0.113.7'); assert.equal(body.notify.email, 'ana@example.org');
});

test('bad input is refused and nothing is stored; the honeypot looks accepted but stores nothing', async () => {
  const store = new MemoryStore(); const handle = make(store);
  for (const email of ['', 'no-at-sign', 'a@b', 'a b@example.org', 'x'.repeat(LIMITS.email) + '@e.org']) {
    const res = await post(handle, { ...valid, email }); assert.equal(res.status, 400, email); assert.equal((await res.json()).error, 'email');
  }
  assert.equal((await post(handle, null, '{not json')).status, 400);
  assert.equal((await post(handle, null, '[1,2]')).status, 400);
  assert.equal((await post(handle, null, JSON.stringify({ ...valid, why: 'x'.repeat(LIMITS.body) }))).status, 413);
  const bot = await post(handle, { ...valid, company: 'Acme' });
  assert.equal(bot.status, 200); assert.deepEqual(await bot.json(), { ok: true });
  assert.equal(store.map.size, 0);
  assert.equal((await handle(new Request(URL0, { method: 'PUT' }), CONTEXT)).status, 405);
});

test('long or odd fields are cut and cleaned; a page that is not a path is dropped', async () => {
  const store = new MemoryStore(); const handle = make(store);
  const res = await post(handle, { ...valid, why: 'a\nb\u0000c' + 'y'.repeat(900), page: 'https://evil.example/x', ref: 'r'.repeat(999) });
  const r = JSON.parse(store.map.get('req/' + (await res.json()).id));
  assert.equal(r.why.length, LIMITS.why); assert.ok(r.why.startsWith('a b c'));
  assert.equal(r.page, ''); assert.equal(r.referrer.length, LIMITS.ref);
});

test('reading needs the token; Netlify holds only its hash', async () => {
  const store = new MemoryStore(); const handle = make(store);
  await post(handle, valid);
  assert.equal((await read(handle, null)).status, 401);
  assert.equal((await read(handle, 'wrong-token-0123456789abcdef')).status, 401);
  assert.equal((await read(handle, HASH)).status, 401, 'the stored hash itself is not a token');
  const ok = await read(handle); const body = await ok.json();
  assert.equal(ok.status, 200); assert.equal(body.count, 1); assert.equal(body.keepDays, KEEP_DAYS);
  assert.equal(body.requests[0].email, 'ana@example.org');
  const unconfigured = make(store, { t: T0 }, '');
  assert.equal((await read(unconfigured)).status, 503);
  assert.equal((await post(unconfigured, valid)).status, 200, 'requests are still taken without a read token');
});

test('records are deleted 365 days after the request; DELETE removes one by id', async () => {
  const store = new MemoryStore(); const clock = { t: T0 }; const handle = make(store, clock);
  const first = (await (await post(handle, valid)).json()).id;
  clock.t = T0 + 100 * 86400000; const second = (await (await post(handle, valid)).json()).id;
  clock.t = T0 + KEEP_DAYS * 86400000; // exactly one year: still kept
  assert.equal((await (await read(handle)).json()).count, 2);
  clock.t += 1000; // one second later: the first one goes
  const after = await (await read(handle)).json();
  assert.equal(after.purged, 1); assert.deepEqual(after.requests.map(r => r.id), [second]);
  assert.equal((await read(handle, TOKEN, 'DELETE', '?id=../x')).status, 400);
  assert.equal((await read(handle, null, 'DELETE', '?id=' + second)).status, 401);
  assert.equal((await read(handle, TOKEN, 'DELETE', '?id=' + second)).status, 200);
  assert.equal(store.map.size, 0); assert.notEqual(first, second);
});
