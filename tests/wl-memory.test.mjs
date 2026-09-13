/** Actual S1 module tests against a serialized durable test adapter.
 * These are LOCAL_SYNTHETIC_ADAPTER evidence, not production CAS, semantic
 * classification, live model capture, cold-start or causal-benefit claims.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SOURCE_SCHEMA, CAPSULE_SCHEMA, canonicalMemoryJson, memoryDigest,
  memorySourceRef, memoryCapsuleRef, memoryCapsuleDigest,
  validateMemorySource, validateMemoryCapsule, createMemoryService,
  createEncryptedMemoryStore, validateS1Verdicts,
} from '../functions/_wl/memory.mjs';

const TIME = '2026-09-13T01:00:00.000Z';
const ARTIFACT_DIGEST = memoryDigest(Buffer.from('standalone artifact fixture'));
const TEST_DIGEST = memoryDigest(Buffer.from('independently read test result fixture'));
const copy = value => structuredClone(value);
const code = wanted => error => error.code === wanted;

class AtomicTestStore {
  constructor(root = {}, path = null) { this.root = copy(root); this.path = path; this.queue = Promise.resolve(); this.fault = null; }
  async read() { await this.queue; return this.path ? JSON.parse(await readFile(this.path, 'utf8')) : copy(this.root); }
  async mutate(fn) {
    const next = this.queue.then(async () => {
      const before = this.path ? JSON.parse(await readFile(this.path, 'utf8')) : copy(this.root);
      const draft = copy(before), result = fn(draft);
      assert.equal(typeof result?.then, 'undefined', 'transaction callback must be synchronous');
      if (this.fault === 'BEFORE_COMMIT') { this.fault = null; throw Object.assign(new Error('injected write failure'), { code: 'INJECTED_FAILURE' }); }
      if (this.path) {
        await writeFile(this.path + '.tmp', JSON.stringify(draft), { mode: 0o600 });
        await rename(this.path + '.tmp', this.path);
      } else this.root = draft;
      if (this.fault === 'AFTER_COMMIT') { this.fault = null; throw Object.assign(new Error('injected lost response'), { code: 'UNKNOWN_EFFECT' }); }
      return copy(result);
    });
    this.queue = next.catch(() => undefined);
    return next;
  }
}

function context() {
  return { actor: 'server-authenticated-fixture', control_valid: true, projects: ['project-1'], labs: ['lab-1'], exposure_refs: ['exposure-1'], revoked: new Set(), artifact_digests: [ARTIFACT_DIGEST], verified_test_digests: [TEST_DIGEST] };
}
function authorize(ctx, request) {
  if (ctx?.actor !== 'server-authenticated-fixture' || ctx.control_valid !== true) return false;
  if (request.project_id !== null && !ctx.projects.includes(request.project_id)) return false;
  if (ctx.revoked.has(request.source_ref) || ctx.revoked.has(request.capsule_ref)) return false;
  if (request.target && (!ctx.labs.includes(request.target.lab_id) || !ctx.exposure_refs.includes(request.target.exposure_ref))) return false;
  return true;
}
function fixture(overrides = {}) {
  const text = overrides.text || 'BD intent: build the next artifact.\nAssistant reports PASS.\nCounterargument: two inputs changed.\nAlternative: retain the baseline.\n';
  const bytes = Buffer.from(text);
  const source = {
    schema: SOURCE_SCHEMA, source_snapshot_id: 'snapshot-1', project_id: 'project-1', source_session_id: 'session-1', branch_id: 'branch-main',
    source_identity_kind: 'BRIDGE_SCOPED', provider_session_id: null, project_membership_evidence_ref: 'membership-receipt-1',
    source_provider: 'SYNTHETIC_PROJECT_CHECKPOINT', execution_surface: 'LOCAL_NODE_TEST', actor_identity_ref: 'test-owner-context',
    source_scope_ref: 'source-scope-1', retention_scope_ref: 'retention-1', acquisition_mode: 'SESSION_SIDE_CHECKPOINT',
    source_frontier: 'observed-message-4', captured_at: TIME, privacy_class: 'WL_PRIVATE_RAW', origin_domains: ['PROJECT_SESSION'],
    bytes_base64: bytes.toString('base64'), bytes_digest: memoryDigest(bytes), representation_utf8: text,
    representation_digest: memoryDigest(bytes), normalizer_ref: null,
    coverage: { mode: 'VISIBLE_CONTEXT_ONLY', ranges: [{ start: 0, end: bytes.length }], complete_inventory: false, total_source_bytes: null, missing_artifact_refs: [] },
    lineage_refs: [], ...overrides.source,
  };
  const span = { domain: 'BYTES', start: 0, end: bytes.length, digest: memoryDigest(bytes) };
  const item = (id, type, content, origin = 'ASSISTANT_STATEMENT') => ({ item_id: id, type, text: content, origin_kind: origin, speaker_observation: origin === 'VISIBLE_USER_STATEMENT' ? 'user' : 'assistant', source_spans: [copy(span)], epistemic_status: 'ODPRTO', evidence_class: type === 'TEST' ? 'REPORTED_RESULT' : 'UNKNOWN', evidence_refs: [], instruction_taint: true });
  const capsule = {
    schema: CAPSULE_SCHEMA, capsule_id: 'capsule-1', revision: 1, supersedes_ref: null, project_id: source.project_id,
    source_ref: memorySourceRef(source), source_digest: memoryDigest(source), source_coverage: copy(source.coverage), memory_scope: 'PROJECT_LIBRARY', lab_id: null,
    items: [item('intent', 'INTENT', 'Build next artifact', 'VISIBLE_USER_STATEMENT'), item('test', 'TEST', 'Assistant reports PASS'), item('objection', 'COUNTERARGUMENT', 'Two inputs changed'), item('alternative', 'ALTERNATIVE', 'Retain baseline')],
    relations: [{ from: 'objection', to: 'test', type: 'contradicts' }], artifacts: [{ artifact_id: 'code-v1', digest: ARTIFACT_DIGEST, status: 'AVAILABLE' }],
    next_handles: [{ action: 'Build the next artifact', input_refs: ['code-v1'], preconditions: ['Read current source'], cheapest_test: 'Compare unchanged baseline', expected_evidence: 'Exact result receipt', reopen_condition: 'Reopen if comparison disagrees' }],
    extractor_version: 'fixture-extractor-v1', extraction_contract_ref: 'extract-v1', extraction_receipt_ref: 'fixture-extraction-1', model_observation: null, privacy_class: 'WL_PRIVATE_DERIVED', retention_scope_ref: source.retention_scope_ref, allowed_use: ['RESEARCH'], payload_digest: '',
    ...overrides.capsule,
  };
  capsule.payload_digest = memoryCapsuleDigest(capsule);
  return { source, capsule, cursor: { stream_id: 'stream-1', before: 0, after: bytes.length } };
}
function target(overrides = {}) { return { project_id: 'project-1', mission_id: 'mission-1', lab_id: 'lab-1', run_id: 'run-1', purpose: 'RESEARCH', exposure_ref: 'exposure-1', mode: 'HISTORICAL', ...overrides }; }
function request(id = 'retrieval-1', overrides = {}) { return { retrieval_id: id, target: target(), query: 'artifact', max_chars: 16000, ...overrides }; }
function service(store = new AtomicTestStore(), auth = authorize) { return { store, api: createMemoryService({ store, now: () => TIME, authorize: auth }) }; }
function rebind(input) {
  input.capsule.source_ref = memorySourceRef(input.source); input.capsule.source_digest = memoryDigest(input.source);
  input.capsule.source_coverage = copy(input.source.coverage); input.capsule.payload_digest = memoryCapsuleDigest(input.capsule);
  return input;
}

test('SM-T01/FI-T11: exact partial source validates; fabricated full coverage is rejected', () => {
  const input = fixture(); assert.equal(validateMemorySource(input.source).coverage.mode, 'VISIBLE_CONTEXT_ONLY');
  input.source.coverage.mode = 'FULL_AT_SNAPSHOT';
  assert.throws(() => validateMemorySource(input.source), code('FULL_COVERAGE_UNPROVEN'));
  input.source.coverage.complete_inventory = true; input.source.coverage.total_source_bytes = Buffer.from(input.source.bytes_base64, 'base64').length;
  assert.equal(validateMemorySource(input.source).coverage.mode, 'FULL_AT_SNAPSHOT');
});

test('SM-T02/03: unknown membership, invented provider identity and unavailable adapter fail closed', async () => {
  const { api } = service(); const input = fixture();
  input.source.project_membership_evidence_ref = null;
  await assert.rejects(api.ingest(input, context()), code('SOURCE_IDENTITY_REQUIRED'));
  const invented = fixture(); invented.source.provider_session_id = 'not-observed';
  assert.throws(() => validateMemorySource(invented.source), code('PROVIDER_ID_NOT_OBSERVED'));
  const locator = fixture(); locator.source.acquisition_mode = 'LOCATOR_ONLY';
  assert.throws(() => validateMemorySource(locator.source), code('SOURCE_UNAVAILABLE_TO_EXECUTOR'));
  await assert.rejects(api.ingest(fixture(), { ...context(), projects: [] }), code('MEMORY_SCOPE_DENIED'));
});

test('SM-T04: UTF-8 byte, normalized representation and span hashes remain distinct', () => {
  const input = fixture({ text: 'Bojan: čebela\r\n' });
  input.source.representation_utf8 = 'Bojan: čebela\n'; input.source.normalizer_ref = 'crlf-to-lf-v1';
  assert.throws(() => validateMemorySource(input.source), code('REPRESENTATION_DIGEST_MISMATCH'));
  input.source.representation_digest = memoryDigest(Buffer.from(input.source.representation_utf8)); rebind(input);
  assert.notEqual(input.source.bytes_digest, input.source.representation_digest);
  validateMemorySource(input.source); validateMemoryCapsule(input.capsule, input.source, context());
  input.capsule.items[0].source_spans[0].start = 1;
  assert.throws(() => validateMemoryCapsule(input.capsule, input.source, context()), code('SPAN_DIGEST_MISMATCH'));
  const unicode = fixture({ text: 'č' }); unicode.capsule.items[0].source_spans[0].end = 1;
  assert.throws(() => validateMemoryCapsule(unicode.capsule, unicode.source, context()), code('SPAN_UTF8_BOUNDARY'));
  const invented = fixture(); invented.source.representation_utf8 = 'A different conclusion';
  invented.source.representation_digest = memoryDigest(Buffer.from(invented.source.representation_utf8)); invented.source.normalizer_ref = 'invented-normalizer';
  assert.throws(() => validateMemorySource(invented.source), code('NORMALIZATION_NOT_REPRODUCIBLE'));
});

test('SM-T05/19: duplicate copies share one ingest; identical bytes from a different origin do not union scopes', async () => {
  const { api, store } = service(), ctx = context(), input = fixture();
  const first = await api.ingest(input, ctx), duplicate = await api.ingest(copy(input), ctx);
  assert.deepEqual(first, duplicate);
  const other = fixture({ source: { project_id: 'project-2', source_session_id: 'session-other' } });
  ctx.projects.push('project-2');
  const separate = await api.ingest(other, ctx); assert.notEqual(separate.ingest_key, first.ingest_key);
  assert.equal(Object.keys((await store.read()).memory.sources).length, 2);
  ctx.projects = ['project-1'];
  const result = await api.retrieve(request(), ctx); assert.equal(result.packet.capsules.length, 1);
  assert.equal(result.packet.capsules[0].source_ref, memorySourceRef(input.source));
});

test('SM-T06: changed same-snapshot bytes conflict; explicit edited branches retain separate lineage', async () => {
  const { api, store } = service(), ctx = context(); await api.ingest(fixture(), ctx);
  const changed = fixture({ text: 'changed exact visible source' });
  await assert.rejects(api.ingest(changed, ctx), code('SOURCE_SNAPSHOT_CONFLICT'));
  const branch = fixture({ text: 'different sibling answer', source: { branch_id: 'regenerated-branch', lineage_refs: ['session-1/branch-main'] }, capsule: { capsule_id: 'sibling-capsule' } });
  await api.ingest(branch, ctx);
  assert.equal(Object.keys((await store.read()).memory.sources).length, 2);
});

test('SM-T07/19/FI-T05: fault before commit is atomic; lost committed response reconciles exact one capsule/cursor', async () => {
  const { api, store } = service(), ctx = context(), input = fixture();
  store.fault = 'BEFORE_COMMIT'; await assert.rejects(api.ingest(input, ctx), code('INJECTED_FAILURE'));
  assert.deepEqual(await store.read(), {});
  store.fault = 'AFTER_COMMIT'; const receipt = await api.ingest(input, ctx);
  assert.equal(receipt.readback_verified, true);
  assert.equal(Object.keys((await store.read()).memory.capsules).length, 1);
  assert.equal(Object.values((await store.read()).memory.cursors)[0], input.cursor.after);
  assert.deepEqual(await api.ingest(input, ctx), receipt);
  const invalidCursor = fixture(); invalidCursor.cursor.after += 1;
  await assert.rejects(api.ingest(invalidCursor, ctx), code('CURSOR_EXCEEDS_PROCESSED_RANGE'));
});

test('SM-T07/19: real concurrent calls to injected serialized file adapter admit once', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'wl-memory-concurrency-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'state.json'); await writeFile(file, '{}', { mode: 0o600 });
  const store = new AtomicTestStore({}, file), { api } = service(store), ctx = context(), input = fixture();
  const results = await Promise.all(Array.from({ length: 12 }, () => api.ingest(copy(input), ctx)));
  assert.equal(new Set(results.map(x => x.ingest_key)).size, 1);
  const disk = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(Object.keys(disk.memory.capsules).length, 1); assert.equal(Object.keys(disk.memory.ingests).length, 1);
  // Evidence is specific to this test adapter; production CAS remains separate.
});

test('SM-T08: explicit correction supersedes retrieval while old capsule remains immutable', async () => {
  const { api, store } = service(), ctx = context(), first = fixture(); await api.ingest(first, ctx);
  const oldRef = memoryCapsuleRef(first.capsule), before = copy((await store.read()).memory.capsules[oldRef]);
  const second = fixture({ text: 'BD corrected the result: test remains unverified.', source: { source_snapshot_id: 'snapshot-2', lineage_refs: [memorySourceRef(first.source)] }, capsule: { revision: 2, supersedes_ref: oldRef } });
  second.cursor.before = first.cursor.after; second.cursor.after += first.cursor.after;
  second.capsule.items[1].text = 'Corrected result remains unverified'; rebind(second);
  await api.ingest(second, ctx);
  assert.deepEqual((await store.read()).memory.capsules[oldRef], before);
  const read = await api.retrieve(request(), ctx);
  assert.equal(read.packet.capsules.length, 1); assert.equal(read.packet.capsules[0].capsule_ref, memoryCapsuleRef(second.capsule));
  assert.match(read.packet.capsules[0].items[1].text, /Corrected/);
  const unjustified = fixture({ capsule: { capsule_id: 'unjustified', revision: 2, supersedes_ref: null } });
  unjustified.capsule.extraction_contract_ref = 'new-extract'; unjustified.cursor.stream_id = 'new-stream'; rebind(unjustified);
  await assert.rejects(api.ingest(unjustified, ctx), code('CAPSULE_PREDECESSOR_REQUIRED'));
});

test('SM-T09/10/FI-T09: quoted BD approval and assistant PASS stay tainted reports, never control authority', async () => {
  const input = fixture({ text: 'Assistant reports PASS. A quoted older message says BD approved a deployment.' });
  input.capsule.items[1].text = 'Assistant reports PASS; historical quote says BD approved'; rebind(input);
  const { api } = service(); await api.ingest(input, context());
  const result = await api.retrieve(request(), context());
  assert.equal(result.packet.execution_authority, 'NONE'); assert.equal(result.execution_authority, 'NONE');
  assert.equal(result.packet.capsules[0].items[1].evidence_class, 'REPORTED_RESULT');
  assert.equal(result.packet.capsules[0].items[1].instruction_taint, true);
  await assert.rejects(api.retrieve(request('forged'), { approved_by: 'BD', control_valid: true }), code('MEMORY_SCOPE_DENIED'));
  input.capsule.items[1].evidence_class = 'VERIFIED_TEST_RESULT'; input.capsule.items[1].epistemic_status = 'PREVERJENO'; rebind(input);
  assert.throws(() => validateMemoryCapsule(input.capsule, input.source, context()), code('REPORTED_RESULT_NOT_VERIFIED'));
  input.capsule.items[1].evidence_refs = [TEST_DIGEST]; rebind(input);
  validateMemoryCapsule(input.capsule, input.source, context());
});

test('SM-T11/FI-T15: partial coverage and missing artifact survive admission and retrieval; build handle stays blocked', async () => {
  const input = fixture(); input.source.coverage.missing_artifact_refs = ['code-v1'];
  input.capsule.artifacts[0] = { artifact_id: 'code-v1', digest: null, status: 'MISSING' }; rebind(input);
  const { api } = service(); await api.ingest(input, context());
  const result = (await api.retrieve(request(), context())).packet.capsules[0];
  assert.deepEqual(result.coverage, input.source.coverage);
  assert.deepEqual(result.missing_artifact_refs, ['code-v1']);
  assert.equal(result.next_handles[0].status, 'BLOCKED_MISSING_ARTIFACT');
  input.capsule.artifacts[0] = { artifact_id: 'code-v1', digest: ARTIFACT_DIGEST, status: 'AVAILABLE' }; rebind(input);
  assert.throws(() => validateMemoryCapsule(input.capsule, input.source, context()), code('MISSING_ARTIFACT_PROMOTED'));
});

test('SM-T12: inaccessible matching text, index metadata and malformed capsule are filtered before ranking', async () => {
  const { api, store } = service(), admin = context(); admin.projects.push('project-2');
  await api.ingest(fixture(), admin);
  const hidden = fixture({ source: { project_id: 'project-2' }, capsule: { capsule_id: 'hidden' } }); hidden.capsule.items[0].text = 'private-never-reveal'; rebind(hidden);
  await api.ingest(hidden, admin);
  // If unauthorized payloads were validated/ranked first this tampering would throw.
  await store.mutate(root => { root.memory.capsules[memoryCapsuleRef(hidden.capsule)].capsule.payload_digest = 'tampered'; return null; });
  const result = await api.retrieve(request('scoped', { query: 'private-never-reveal' }), context());
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes('private-never-reveal')); assert.ok(!serialized.includes('project-2'));
  assert.equal(result.packet.capsules.length, 1); assert.equal(result.omissions.length, 0);
});

test('SM-T12/13: source rights, target lab and explicit exposure are all required, rechecked before use', async () => {
  const { api } = service(); await api.ingest(fixture(), context());
  await assert.rejects(api.retrieve(request('foreign-lab', { target: target({ lab_id: 'lab-other' }) }), context()), code('MEMORY_SCOPE_DENIED'));
  await assert.rejects(api.retrieve(request('blind', { target: target({ exposure_ref: 'unapproved-exposure' }) }), context()), code('MEMORY_SCOPE_DENIED'));
  await assert.rejects(api.retrieve(request('null-target', { target: target({ lab_id: null }) }), context()), code('RETRIEVAL_TARGET_REQUIRED'));
  const { api: gated, store } = service(new AtomicTestStore(), (ctx, req) => req.operation !== 'use' && authorize(ctx, req));
  await gated.ingest(fixture(), context());
  await assert.rejects(gated.retrieve(request(), context()), code('MEMORY_SCOPE_DENIED'));
  assert.equal(Object.keys((await store.read()).memory.retrievals).length, 0);
});

test('SM-T14: explicit forbidden origin, quoted PREAI8 body, credential and dropped taint are rejected', async () => {
  const { api } = service();
  for (const text of ['PREAI8 quoted email body: a private longitudinal exchange', 'api_key = synthetic-secret-must-not-persist']) {
    const input = fixture({ text });
    await assert.rejects(api.ingest(input, context()), error => ['PREAI8_EMAIL_CONTENT_REJECTED', 'SECRET_PAYLOAD_REJECTED'].includes(error.code));
  }
  const origin = fixture(); origin.source.origin_domains.push('PREAI8_EMAIL_AB_BODY');
  assert.throws(() => validateMemorySource(origin.source), code('SOURCE_ORIGIN_FORBIDDEN'));
  const taint = fixture(); taint.capsule.items[0].instruction_taint = false; rebind(taint);
  assert.throws(() => validateMemoryCapsule(taint.capsule, taint.source, context()), code('INSTRUCTION_TAINT_REQUIRED'));
});

test('SM-T15: revocation survives restart and index rebuild, invalidates cached packets and does not claim erasure', async () => {
  const { api, store } = service(), ctx = context(), input = fixture(); await api.ingest(input, ctx);
  await api.retrieve(request(), ctx);
  const revoked = await api.revoke({ ref: memorySourceRef(input.source), reason: 'read scope withdrawn', authority_ref: 'control-revoke-1' }, ctx);
  assert.equal(revoked.content_erased, false);
  const restarted = service(store).api; await restarted.rebuildIndex(ctx);
  assert.equal((await restarted.retrieve(request(), ctx)).packet.capsules.length, 0);
  await assert.rejects(restarted.ingest(input, ctx), code('MEMORY_REVOKED'));
  assert.equal(Object.keys((await store.read()).memory.sources).length, 1);
});

test('SM-T15: restored old memory cannot bypass CURRENT external authorizer revocation', async () => {
  const { api, store } = service(), ctx = context(), input = fixture(); await api.ingest(input, ctx);
  const old = await store.read(); await api.retrieve(request(), ctx);
  ctx.revoked.add(memorySourceRef(input.source));
  // Deliberately restore old memory data; control authority stays outside snapshot.
  await store.mutate(root => { root.memory = old.memory; return null; });
  await api.rebuildIndex(ctx);
  assert.equal((await api.retrieve(request('after-rollback'), ctx)).packet.capsules.length, 0);
  await assert.rejects(api.ingest(input, ctx), code('MEMORY_SCOPE_DENIED'));
});

test('SM-T16: historical memory cannot certify the current process, even when capture says RUNNING', async () => {
  const { api } = service(); await api.ingest(fixture({ text: 'At old snapshot the process was RUNNING.' }), context());
  const result = await api.retrieve(request('current', { target: target({ mode: 'CURRENT_OPERATIONAL' }) }), context());
  assert.equal(result.packet.capsules[0].next_handles[0].status, 'CURRENT_SOURCE_RECHECK_REQUIRED');
  assert.match(result.packet.capsules[0].limitations[0], /does not verify current/);
});

test('SM-T17/18/20: no cloud index dependency; poisoned index ignored; rebuild/replay needs no model', async () => {
  const { api, store } = service(), ctx = context(), input = fixture(); await api.ingest(input, ctx);
  const before = (await api.retrieve(request(), ctx)).packet_digest;
  await store.mutate(root => { root.memory.index = { poison: { project_id: 'project-1', digest: 'false', source_ref: 'not-a-source' } }; return null; });
  const replay = await service(store).api.retrieve(request(), ctx); assert.equal(replay.packet_digest, before);
  const rebuilt = await api.rebuildIndex(ctx); assert.equal(rebuilt.model_calls, 0); assert.equal(rebuilt.supabase_calls, 0);
  assert.equal(rebuilt.rows, 1);
  assert.equal((await api.retrieve(request('new-id'), ctx)).packet_digest, before);
});

test('SM-T19: changed extraction under identical ingest is a conflict, never a new random retry', async () => {
  const { api, store } = service(), input = fixture(); await api.ingest(input, context());
  const changed = copy(input); changed.capsule.items[0].text = 'A new model guess'; changed.capsule.payload_digest = memoryCapsuleDigest(changed.capsule);
  await assert.rejects(api.ingest(changed, context()), code('INGEST_CONFLICT'));
  assert.equal(Object.keys((await store.read()).memory.capsules).length, 1);
});

test('SM-T21/FI-T04: self-written memory/index events cannot cause another extraction or research turn', async () => {
  const { api, store } = service(); const input = fixture();
  await assert.rejects(api.ingest({ ...input, causation: { origin: 'SESSION_MEMORY', kind: 'CAPSULE_WRITTEN' } }, context()), code('MEMORY_SELF_TRIGGER_REJECTED'));
  assert.deepEqual(await store.read(), {});
  await api.ingest({ ...input, causation: { origin: 'APPROVED_PROJECT', kind: 'CHECKPOINT_READY' } }, context());
  const result = await api.retrieve(request(), context()); assert.equal(result.packet.research_permit_consumed, false);
});

test('SM-T22/FI-T10: bounded packet preserves usable handle and objection, without claiming later model use', async () => {
  const { api } = service(); await api.ingest(fixture(), context());
  const result = await api.retrieve(request(), context()), cap = result.packet.capsules[0];
  assert.equal(cap.next_handles[0].input_refs[0], 'code-v1');
  assert.equal(cap.items.find(item => item.type === 'COUNTERARGUMENT').text, 'Two inputs changed');
  assert.equal(result.packet.live_cold_start_proven, false);
  assert.throws(() => validateS1Verdicts({ cold_start: 'S1_COLD_START_LIVE_PASS' }, { evidence_class: 'SYNTHETIC', capture_instance_ref: 'same', consumer_instance_ref: 'same' }), code('COLD_START_LIVE_UNPROVEN'));
  const tiny = await api.retrieve(request('small', { max_chars: 512 }), context());
  assert.equal(tiny.packet.capsules.length, 0); assert.equal(tiny.omissions[0].reason, 'CONTEXT_BUDGET_WHOLE_CAPSULE');
  // No partial capsule omits the objection to fit a tighter context.
});

test('SM-T23/24/FI-T08/11: capsule counts, serialization or enabled scheduler cannot claim history/live/benefit', async () => {
  const { api } = service(); await api.ingest(fixture(), context());
  const status = await api.status(context());
  assert.equal(status.total_history_count, null); assert.equal(status.learned_benefit, 'NOT_MEASURED');
  assert.equal(status.history_sync, 'AUTO_HISTORY_SYNC_NOT_ACTIVATED');
  assert.throws(() => validateS1Verdicts({ history_sync: 'AUTO_HISTORY_SYNC_VERIFIED' }, { one_capture: true, scheduler_enabled: true }), code('HISTORY_SYNC_UNPROVEN'));
  assert.throws(() => validateS1Verdicts({ learned_benefit: 'VERIFIED' }, { capsule_count: 100 }), code('MEMORY_BENEFIT_UNPROVEN'));
  assert.throws(() => validateS1Verdicts({ capture: 'S1_CAPTURE_LIVE_PASS' }, { evidence_class: 'SYNTHETIC' }), code('CAPTURE_LIVE_UNPROVEN'));
  assert.throws(() => validateS1Verdicts({ cold_start: 'GLOBAL_PASS' }, {}), code('S1_VERDICT_INVALID'));
  assert.equal(validateS1Verdicts({ file_first: 'S1_FILE_FIRST_SYNTHETIC_PASS', cold_start: 'S1_COLD_START_BLOCKED' }, {}), true);
});

test('SM-T12/14/15: AES-GCM file persistence contains no research plaintext; wrong key/AAD/tamper/rollback fail', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'wl-memory-encryption-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'sealed.json'); await writeFile(path, JSON.stringify({ unrelated: 'preserve' }), { mode: 0o600 });
  const raw = new AtomicTestStore({}, path), key = Buffer.alloc(32, 7);
  const encrypted = createEncryptedMemoryStore({ store: raw, key, aad: 'isolated-project-fixture' });
  const { api } = service(encrypted), ctx = context();
  await api.ingest(fixture(), ctx);
  const disk = await readFile(path, 'utf8'); assert.ok(!disk.includes('Build next artifact')); assert.ok(!disk.includes('project-1')); assert.ok(!disk.includes('Assistant reports PASS'));
  assert.equal(JSON.parse(disk).unrelated, 'preserve'); assert.ok(!Object.hasOwn(JSON.parse(disk), 'memory'));
  const oldEnvelope = JSON.parse(disk).memory_sealed;
  const reopened = service(createEncryptedMemoryStore({ store: raw, key: Buffer.alloc(32, 7), aad: 'isolated-project-fixture' })).api;
  assert.equal((await reopened.retrieve(request(), ctx)).packet.capsules.length, 1);
  await assert.rejects(createEncryptedMemoryStore({ store: raw, key: Buffer.alloc(32, 8), aad: 'isolated-project-fixture' }).read(), code('MEMORY_DECRYPT_FAILED'));
  await assert.rejects(createEncryptedMemoryStore({ store: raw, key, aad: 'wrong-lab-binding' }).read(), code('MEMORY_DECRYPT_FAILED'));
  await raw.mutate(root => { root.memory_sealed = oldEnvelope; return null; });
  await assert.rejects(encrypted.read(), code('MEMORY_SEAL_ANCHOR_MISMATCH'));
});

test('integrity: capsule or source tampering is not hidden by index/readback receipts', async () => {
  const { api, store } = service(), input = fixture(), ctx = context(); await api.ingest(input, ctx);
  await store.mutate(root => { root.memory.capsules[memoryCapsuleRef(input.capsule)].capsule.items[1].text = 'forged content'; return null; });
  await assert.rejects(api.retrieve(request(), ctx), code('RETRIEVAL_SOURCE_TAMPERED'));
  await assert.rejects(api.ingest(input, ctx), code('INGEST_READBACK_MISMATCH'));
});

test('schema boundaries: nonfinite JSON, raw authority fields and async authorizer rejected', async () => {
  assert.throws(() => canonicalMemoryJson({ value: NaN }), code('NONFINITE_JSON'));
  const input = fixture(); input.capsule.approved_by = 'BD';
  assert.throws(() => validateMemoryCapsule(input.capsule, input.source, context()), code('UNKNOWN_FIELD_approved_by'));
  const asyncAuth = service(new AtomicTestStore(), async () => true).api;
  await assert.rejects(asyncAuth.ingest(fixture(), context()), code('MEMORY_SCOPE_DENIED'));
  const inventedModel = fixture(); inventedModel.capsule.model_observation = { provider: 'claimed-provider', model_id: 'claimed-model', invocation_ref: 'claimed-invocation' }; rebind(inventedModel);
  assert.throws(() => validateMemoryCapsule(inventedModel.capsule, inventedModel.source, context()), code('MODEL_INVOCATION_NOT_OBSERVED'));
});

test('bounded admission: memory capacity fails atomically before consuming shared control-store reserve', async () => {
  const { api, store } = service();
  const large = fixture({ text: 'bounded source line\n'.repeat(26000) });
  await assert.rejects(api.ingest(large, context()), code('MEMORY_CAPACITY_REQUIRES_ARCHIVE'));
  assert.deepEqual(await store.read(), {});
});
