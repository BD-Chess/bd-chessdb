import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createAtomicStore } from '../functions/_wl/store.mjs';
import { createManagedHandler, initialState, safeObservatory } from '../functions/_wl/service.mjs';

function fixture() {
  let row = null, version = 0;
  const blobs = {
    async getWithMetadata() { return structuredClone(row); },
    async setJSON(_key, value, options) {
      if ((options.onlyIfNew && row) || (options.onlyIfMatch && options.onlyIfMatch !== row?.etag)) return { modified: false };
      row = { data: value, etag: String(++version) }; return { modified: true, etag: row.etag };
    }
  };
  const store = createAtomicStore({ blobs, key: randomBytes(32), initial: initialState });
  let clock = '2026-09-13T01:00:00.000Z';
  const handler = createManagedHandler({ authenticate: req => req.headers.get('x-wl-password') === 'SYNTHETIC_ONLY', makeStore: () => store, now: () => clock });
  async function call(body, { auth = true, query = '' } = {}) {
    const req = new Request('https://wl.example/api/wl/managed' + query, {
      method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(auth ? { 'x-wl-password': 'SYNTHETIC_ONLY' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {})
    });
    const response = await handler(req); return { status: response.status, data: await response.json() };
  }
  return { store, call, time: value => { clock = value; }, raw: () => JSON.stringify(row) };
}
const create = () => ({ action: 'CREATE', command_id: 'create-1', run_id: 'new-1', expected_revision: 0, control_epoch: 0, parameters: {
  run_kind: 'NEW_WL', title: 'Private synthetic target', lab_id: 'lab-1', mission: { mission_id: 'mission-1', intent: 'Return test file', target_outcome: 'A real report file', target_artifact: { kind: 'REPORT' }, source_scope: [], source_requirements: [], success_criteria: [] }
} });
test('C1/M1: authenticated durable create survives another request; duplicate payload is one receipt', async () => {
  const f = fixture(); assert.equal((await f.call(create(), { auth: false })).status, 401);
  const first = await f.call(create()); assert.equal(first.status, 200);
  const retry = await f.call(create()); assert.equal(retry.data.receipt.duplicate, true);
  const read = await f.call(); assert.equal(read.data.runs.filter(r => r.run_id === 'new-1').length, 1);
  assert.equal(read.data.runs.find(r => r.run_id === 'new-1').status, 'DRAFT');
  assert.ok(!f.raw().includes('Private synthetic target'));
  assert.equal((await f.call(null, { query: '?command_id=create-1' })).data.receipt.command_id, 'create-1');
});
test('C1: changed command payload conflict preserves original intent', async () => {
  const f = fixture(); await f.call(create()); const changed = create(); changed.parameters.title = 'different';
  assert.equal((await f.call(changed)).status, 409);
  assert.equal((await f.call()).data.runs.find(r => r.run_id === 'new-1').title, 'Private synthetic target');
});
test('C1/L1/E1: unbound existing controls cannot pretend to stop the original sender', async () => {
  const f = fixture();
  const cards = (await f.call()).data.runs;
  assert.equal(cards.length, 3); assert.ok(cards.every(r => r.allowed_actions.length === 0));
  for (const id of cards.map(r => r.run_id)) {
    const response = await f.call({ action: 'STOP', command_id: 'stop-' + id, run_id: id, expected_revision: 0, control_epoch: 0 });
    assert.equal(response.data.error, 'WORKER_BINDING_REQUIRED');
  }
  assert.equal(Object.keys((await f.store.read()).runs).length, 0);
});
test('C1: expiry reconciles at exact 168h without UI timers or extending Pause', async () => {
  const f = fixture(); await f.call(create());
  let response = await f.call({ action: 'START', command_id: 'start-1', run_id: 'new-1', expected_revision: 1, control_epoch: 1, parameters: {} });
  assert.equal(response.data.receipt.run.expires_at, '2026-09-20T01:00:00.000Z');
  f.time('2026-09-20T01:00:00.000Z');
  assert.equal((await f.call()).data.runs.find(r => r.run_id === 'new-1').status, 'EXPIRED');
});
test('G6: body authority, aliases and unrelated actions cannot create an execution grant', async () => {
  const f = fixture(); const request = create(); request.parameters.worker_binding = { verified: true }; request.capabilities = { worker_binding_verified: true };
  const r = await f.call(request); assert.equal(r.data.receipt.run.worker_binding, null);
  const conflict = create(); conflict.expected_control_epoch = 99;
  assert.equal((await f.call(conflict)).data.error, 'CONTROL_EPOCH_ALIAS_CONFLICT');
  assert.equal((await f.call({ ...create(), action: 'PURGE' })).data.error, 'ACTION_NOT_ALLOWED');
});
test('U1-O/FI-T13: serialization is not measurement; projection excludes arbitrary private fields', () => {
  const at = '2026-09-13T01:00:00.000Z';
  const old = { generated_at: at, email_plane: { A: { verified_turn: 21, subject: 'private subject', body: 'private body' } }, observatory: { email: { total_messages: 40, runs: { A: { messages: 21 } } } } };
  const projection = safeObservatory(old, at); assert.equal(projection.freshness, 'MEASUREMENT_UNVERIFIED');
  assert.equal(projection.logical_messages, 40); assert.equal(projection.measured_at, null);
  assert.ok(!JSON.stringify(projection).includes('private'));
  old.measured_at = '2026-09-12T22:00:00.000Z'; old.source_coverage = { complete: true };
  assert.equal(safeObservatory(old, at).freshness, 'STALE');
});
