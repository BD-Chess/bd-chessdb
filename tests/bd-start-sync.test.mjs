import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createStartSync, LIMITS } from '../functions/lib/bd-start-sync.mjs';

const require = createRequire(import.meta.url);
const Sync = require('../public/Start/sync.js');
const State = require('../public/Start/state.js');

class MemoryStore {
  constructor() { this.map = new Map(); this.n = 0; }
  async getWithMetadata(key) { const e = this.map.get(key); return e ? { data: JSON.parse(e.value), etag: e.etag, metadata: {} } : null; }
  async setJSON(key, value, options = {}) {
    const e = this.map.get(key);
    if (options.onlyIfNew && e) return { modified: false };
    if (options.onlyIfMatch !== undefined && (!e || e.etag !== options.onlyIfMatch)) return { modified: false };
    const etag = '"' + (++this.n) + '"'; this.map.set(key, { value: JSON.stringify(value), etag }); return { modified: true, etag };
  }
  async delete(key) { this.map.delete(key); }
  async list({ prefix = '' } = {}) { return { blobs: [...this.map.keys()].filter(k => k.startsWith(prefix)).map(key => ({ key, etag: this.map.get(key).etag })), directories: [] }; }
}
const vault = 'ab'.repeat(32);
const request = (method, body, v = vault) => new Request('https://www.mdlxdcc.org/api/bd-start-sync', { method, headers: Object.assign({ 'X-BD-Start-Vault': v }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
const sealed = { iv: 'AAAAAAAAAAAAAAAA', data: 'Y2lwaGVydGV4dA==' };
async function call(handle, method, body, v) { const res = await handle(request(method, body, v)); return { status: res.status, body: await res.json(), headers: res.headers }; }

test('one vault: create, read and compare-and-set by revision', async () => {
  const handle = createStartSync({ store: new MemoryStore(), now: () => Date.UTC(2026, 10, 7, 22) });
  assert.deepEqual((await call(handle, 'GET')).body, { ok: true, exists: false, revision: 0 });
  const created = await call(handle, 'PUT', { baseRevision: 0, ...sealed });
  assert.equal(created.status, 200); assert.equal(created.body.revision, 1); assert.equal(created.body.updatedAt, '2026-11-07T22:00:00.000Z');
  const read = await call(handle, 'GET');
  assert.deepEqual(read.body, { ok: true, exists: true, revision: 1, updatedAt: '2026-11-07T22:00:00.000Z', ...sealed });
  const stale = await call(handle, 'PUT', { baseRevision: 0, ...sealed });
  assert.equal(stale.status, 409); assert.deepEqual(stale.body, { ok: false, error: 'conflict', revision: 1 });
  assert.equal((await call(handle, 'PUT', { baseRevision: 1, iv: sealed.iv, data: 'bmV3ZXI=' })).body.revision, 2);
  assert.equal((await call(handle, 'GET')).body.data, 'bmV3ZXI=');
  assert.equal((await call(handle, 'DELETE')).status, 200);
  assert.equal((await call(handle, 'GET')).body.exists, false);
});

test('rejects bad vault ids, inputs, methods and oversize data', async () => {
  const handle = createStartSync({ store: new MemoryStore(), limits: { vaults: 5, dataChars: 32 } });
  assert.equal((await call(handle, 'GET', null, 'not-a-vault')).status, 400);
  assert.equal((await call(handle, 'GET', null, 'AB'.repeat(32))).status, 400, 'upper-case ids are not vault ids');
  assert.equal((await call(handle, 'POST', { baseRevision: 0, ...sealed })).status, 405);
  for (const bad of [{ baseRevision: -1, ...sealed }, { baseRevision: 1.5, ...sealed }, { baseRevision: 0, iv: 'short', data: sealed.data }, { baseRevision: 0, iv: sealed.iv, data: '<script>' }, { baseRevision: 0, iv: sealed.iv }])
    assert.equal((await call(handle, 'PUT', bad)).status, 400, JSON.stringify(bad));
  assert.equal((await call(handle, 'PUT', { baseRevision: 0, iv: sealed.iv, data: 'A'.repeat(36) })).status, 413);
  const res = await handle(new Request('https://www.mdlxdcc.org/api/bd-start-sync', { method: 'PUT', headers: { 'X-BD-Start-Vault': vault, 'Content-Type': 'application/json' }, body: '{' }));
  assert.equal(res.status, 400);
});

test('a limited number of vaults can be created; existing vaults keep working', async () => {
  const handle = createStartSync({ store: new MemoryStore(), limits: { ...LIMITS, vaults: 2 } });
  for (const v of ['11'.repeat(32), '22'.repeat(32)]) assert.equal((await call(handle, 'PUT', { baseRevision: 0, ...sealed }, v)).status, 200);
  assert.deepEqual((await call(handle, 'PUT', { baseRevision: 0, ...sealed }, '33'.repeat(32))).body, { ok: false, error: 'vault_limit' });
  assert.equal((await call(handle, 'PUT', { baseRevision: 1, ...sealed }, '11'.repeat(32))).status, 200);
});

test('a write that loses a race is reported as a conflict, never applied', async () => {
  const store = new MemoryStore(), handle = createStartSync({ store });
  await call(handle, 'PUT', { baseRevision: 0, ...sealed });
  const setJSON = store.setJSON.bind(store);
  store.setJSON = async (key, value, options) => { await setJSON(key, { ...value, data: 'b3RoZXI=' }); return setJSON(key, value, options); };
  const lost = await call(handle, 'PUT', { baseRevision: 1, iv: sealed.iv, data: 'bWluZQ==' });
  assert.equal(lost.status, 409); assert.equal(lost.body.revision, 2);
  assert.equal((await call(handle, 'GET')).body.data, 'b3RoZXI=');
});

test('responses are not cached or indexed', async () => {
  const { headers } = await call(createStartSync({ store: new MemoryStore() }), 'GET');
  assert.match(headers.get('cache-control'), /no-store/);
  assert.match(headers.get('x-robots-tag'), /noindex/);
  assert.equal(headers.get('referrer-policy'), 'no-referrer');
});

test('the browser derives one vault and key per password and seals content to that vault', async () => {
  const a = await Sync.deriveKeys('naše skrito geslo 2026'), b = await Sync.deriveKeys('naše skrito geslo 2026'), c = await Sync.deriveKeys('drugo geslo 2026');
  assert.match(a.vault, /^[a-f0-9]{64}$/); assert.deepEqual(a, b); assert.notEqual(a.vault, c.vault); assert.notEqual(a.key, c.key);
  assert.equal((await Sync.deriveKeys('café geslo')).vault, (await Sync.deriveKeys('café geslo')).vault, 'Unicode forms of one password agree');
  const content = { notes: 'Zasebna misel', events: [{ id: 'e1', title: 'Sestanek', date: '2026-11-08', time: '09:15' }] };
  const box = await Sync.seal(a, content);
  assert.match(box.iv, /^[A-Za-z0-9+/]{16}$/);
  assert(!Buffer.from(box.data, 'base64').toString('latin1').includes('Zasebna'), 'the sealed data is not plain text');
  assert.deepEqual(await Sync.open(b, box), content);
  await assert.rejects(Sync.open(c, box), 'another password cannot open it');
  await assert.rejects(Sync.open({ vault: c.vault, key: a.key }, box), 'sealed data is bound to its vault');
  const tampered = Buffer.from(box.data, 'base64'); tampered[3] ^= 1;
  await assert.rejects(Sync.open(a, { iv: box.iv, data: tampered.toString('base64') }), 'tampering is detected');
});

test('pick and merge move content between devices and keep each device\'s appearance', () => {
  const base = { version: 1, preferences: { lang: 'sl', theme: 'dark', mode: 'overview', linkGroup: 'daily', newsGroup: 'world', city: 'Ljubljana', scale: 120, calendarDate: '2026-11-07', calendarMonth: '2026-11', openPanels: Object.fromEntries(State.panels.map(id => [id, id === 'bs-note-panel'])), favoriteUrls: ['https://chatgpt.com/'], openGroups: Object.fromEntries(State.categories.map(id => [id, true])) }, links: { daily: [['Moja', 'https://example.com/', 'MO']], lab: [], markets: [] }, events: [], notes: 'Tukaj', saved: [] };
  const other = structuredClone(base);
  Object.assign(other, { notes: 'Od drugod', events: [{ id: 'e2', title: 'Dogodek', date: '2026-11-09', time: '10:00' }], saved: ['w1'], links: { daily: [], lab: [['Lab', 'https://lab.example/', 'LB']], markets: [] } });
  Object.assign(other.preferences, { theme: 'light', scale: 90, city: 'Koper', lang: 'en', favoriteUrls: ['https://claude.ai/'], openPanels: { ...base.preferences.openPanels, 'bs-note-panel': false } });
  const merged = State.normalize(Sync.merge(base, Sync.pick(other)));
  assert.equal(merged.notes, 'Od drugod'); assert.deepEqual(merged.events, other.events); assert.deepEqual(merged.saved, ['w1']); assert.deepEqual(merged.links, other.links);
  assert.deepEqual(merged.preferences.favoriteUrls, ['https://claude.ai/']); assert.equal(merged.preferences.city, 'Koper'); assert.equal(merged.preferences.lang, 'en');
  assert.equal(merged.preferences.theme, 'dark'); assert.equal(merged.preferences.scale, 120); assert.equal(merged.preferences.openPanels['bs-note-panel'], true);
  assert.equal(merged.preferences.calendarMonth, '2026-11');
  assert(Sync.same(Sync.pick(merged), Sync.pick(other)));
  const noFavorites = structuredClone(other); delete noFavorites.preferences.favoriteUrls;
  assert.equal('favoriteUrls' in Sync.merge(base, Sync.pick(noFavorites)).preferences, false, 'default favorites stay default');
  assert.throws(() => State.normalize(Sync.merge(base, { ...Sync.pick(other), links: { daily: [['x', 'javascript:alert(1)', 'X']], lab: [], markets: [] } })), 'unsafe server content fails the import validation');
});
