import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createAtomicStore, openState, sealState, NORMAL_CAPACITY } from '../functions/_wl/store.mjs';
import { readJSON, checkOrigin, errorResponse } from '../functions/_wl/http.mjs';

class CASBlobs {
  constructor() { this.row = null; this.version = 0; this.writes = []; }
  async getWithMetadata() { return structuredClone(this.row); }
  async setJSON(key, value, conditions) {
    this.writes.push(conditions);
    if ((conditions.onlyIfNew && this.row) || (conditions.onlyIfMatch && conditions.onlyIfMatch !== this.row?.etag)) return { modified: false };
    this.row = { data: structuredClone(value), etag: String(++this.version), metadata: {} };
    return { modified: true, etag: this.row.etag };
  }
}
const setup = (blobs = new CASBlobs()) => ({ blobs, store: createAtomicStore({ blobs, key: randomBytes(32), initial: () => ({ count: 0, receipts: {} }) }) });
test('BUILD:G3 / F05: simultaneous control updates preserve every receipt using CAS', async () => {
  const { store, blobs } = setup();
  await Promise.all(Array.from({ length: 6 }, (_, i) => store.mutate(s => { s.receipts['c' + i] = true; return ++s.count; })));
  const s = await store.read(); assert.equal(s.count, 6); assert.equal(Object.keys(s.receipts).length, 6);
  assert.ok(blobs.writes.some(x => x.onlyIfNew)); assert.ok(blobs.writes.some(x => x.onlyIfMatch));
});
test('BUILD:G3 / FI-T05: commit followed by lost response reconciles without duplicate effect', async () => {
  const blobs = new CASBlobs(), write = blobs.setJSON.bind(blobs); let once = true;
  blobs.setJSON = async (...args) => { const result = await write(...args); if (once) { once = false; throw Error('lost response'); } return result; };
  const { store } = setup(blobs);
  assert.equal(await store.mutate(s => ++s.count), 1); assert.equal((await store.read()).count, 1); assert.equal(blobs.writes.length, 1);
});
test('BUILD:G3: no response before commit is UNKNOWN and not silently retried', async () => {
  const blobs = new CASBlobs(); blobs.setJSON = async () => { throw Error('timeout'); };
  const { store } = setup(blobs);
  await assert.rejects(store.mutate(s => ++s.count), { code: 'UNKNOWN_STORAGE_EFFECT_RECONCILE_REQUIRED' });
  assert.equal((await store.read()).count, 0);
});
test('BUILD:G6: unsupported storage return cannot be called CAS PASS', async () => {
  const blobs = new CASBlobs(); blobs.setJSON = async () => undefined;
  await assert.rejects(setup(blobs).store.mutate(s => ++s.count), { code: 'CAS_UNSUPPORTED' });
});
test('BUILD:G6: data is encrypted and key/tamper failures do not reset state', async () => {
  const key = randomBytes(32), value = { secretText: 'private synthetic intent', _store: { revision: 1, transactions: {} } };
  const box = sealState(value, key); assert.ok(!JSON.stringify(box).includes(value.secretText));
  assert.deepEqual(openState(box, key), value);
  assert.throws(() => openState(box, randomBytes(32)), { code: 'STORE_INTEGRITY_OR_KEY_FAILURE' });
  box.tag = randomBytes(16).toString('base64');
  assert.throws(() => openState(box, key), { code: 'STORE_INTEGRITY_OR_KEY_FAILURE' });
});
test('BUILD:G3: async external effects cannot run inside a CAS retry callback', async () => {
  const { store, blobs } = setup();
  await assert.rejects(store.mutate(async s => { s.count++; return 1; }), { code: 'ASYNC_TRANSACTION_FORBIDDEN' });
  assert.equal(blobs.writes.length, 0);
});
test('BUILD:G6: cross-origin commands denied, no permissive CORS', () => {
  assert.throws(() => checkOrigin(new Request('https://wl.example/api/wl/managed', { headers: { origin: 'https://attacker.example' } })), { code: 'ORIGIN_DENIED' });
  assert.equal(errorResponse(Error('private body')).headers.get('access-control-allow-origin'), null);
});
test('BUILD:G6: body bounds, content type, syntax and error redaction', async () => {
  const req = body => new Request('https://wl.example', { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  await assert.rejects(readJSON(req('{"a":"oversize"}'), 2), { code: 'PAYLOAD_TOO_LARGE' });
  await assert.rejects(readJSON(req('{')), { code: 'INVALID_JSON' });
  const response = await errorResponse(Error('x-wl-password=PRIVATE_SYNTHETIC')).text();
  assert.ok(!response.includes('PRIVATE_SYNTHETIC'));
});
test('C1: intake leaves capacity for STOP and storage reconciliation never duplicates private payload', async () => {
  const { store } = setup();
  await store.mutate(s => { s.journal = 'x'.repeat(NORMAL_CAPACITY - 2048); return { large: s.journal }; });
  assert.ok(JSON.stringify((await store.read())._store).length < 512);
  await assert.rejects(store.mutate(s => { s.newWork = 'y'.repeat(4096); return true; }), { code: 'STORE_INTAKE_CAPACITY_RESERVED_FOR_STOP' });
  assert.equal((await store.read()).newWork, undefined);
  await store.mutate(s => { s.status = 'STOPPED'; s.stopReceipt = 'z'.repeat(4096); return 'STOPPED'; }, { safety: true });
  assert.equal((await store.read()).status, 'STOPPED');
});
test('C1: bounded reconciliation cache retains canonical command history', async () => {
  const { store } = setup();
  for (let i = 0; i < 70; i++) await store.mutate(s => { s.receipts['command-' + i] = { command_id: i }; return ++s.count; });
  const state = await store.read();
  assert.equal(Object.keys(state._store.transactions).length, 64);
  assert.equal(Object.keys(state.receipts).length, 70);
});
