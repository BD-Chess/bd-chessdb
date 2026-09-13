import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { initialState, applyCommand, bindWorker, digest } from '../functions/_wl/core.mjs';
import { createNativeWorker } from '../functions/_wl/native-worker.mjs';

const AT = '2026-09-13T02:00:00.000Z';
const owner = { actor: { id: 'BD', role: 'owner', authenticated: true }, now: AT };
const actor = { id: 'native:sole', role: 'worker', authenticated: true };
const bytes = '<!doctype html><title>Verified GUI prototype</title>';
const sha = value => createHash('sha256').update(value).digest('hex');
const artifact = { artifact_id: 'prototype.html', kind: 'prototype', digest: sha(bytes), receipt_ref: 'artifact:readback:1' };
const testReceipt = { criterion_id: 'opens', status: 'PASS', receipt_ref: 'test:opens:1' };
const candidate = () => ({ patch: { set: { artifact: artifact.artifact_id }, remove: [] }, result: { complete: true, artifacts: [artifact], tests: [testReceipt] } });
const generated = () => ({ receipt_ref: 'native:model:1', candidate: candidate() });
const input = (extra = {}) => ({ run_id: 'native:run', lab_id: 'native:lab', work_item_id: 'initial', expected_parent: null, trigger_id: 'event:1', trigger_kind: 'EVENT_TRIGGERED', attempt_id: 'attempt:1', ...extra });
function setup(missionExtra = {}) {
  let root = applyCommand(initialState(), { command_id: 'start', run_id: 'native:run', action: 'START', expected_revision: 0, control_epoch: 0,
    parameters: { run_kind: 'NEW_WL', title: 'Synthetic native Mission', lab_id: 'native:lab', mission: {
      mission_id: 'native:mission', intent: 'Build a prototype', target_outcome: 'Working GUI', target_artifact: { kind: 'prototype' },
      success_criteria: ['opens'], source_scope: [], source_requirements: [], ...missionExtra,
    } } }, owner).state;
  root = bindWorker(root, { run_id: 'native:run', expected_revision: 1, control_epoch: 1, worker_id: actor.id }, { ...owner, capabilities: { worker_binding_verified: true, binding_evidence_ref: 'synthetic:binding' } }).state;
  let clock = AT, calls = 0, readHook = null;
  const store = {
    async read() { if (readHook) readHook(); return structuredClone(root); },
    async mutate(fn) { const draft = structuredClone(root), result = fn(draft); root = draft; return result; },
  };
  const defaults = {
    store, now: () => clock,
    authenticateWorker: async () => ({ actor, capabilities: { native_model_verified: true } }),
    model: async payload => { calls++; assert.equal(payload.execution_authority, 'NONE'); assert.equal(payload.cost_policy, 'NO_PAID'); return generated(); },
    verifyResult: async ({ candidate: output }) => {
      assert.equal(sha(bytes), artifact.digest, 'independent readback hashes exact synthetic artifact bytes');
      return { verified: true, receipt_ref: 'verifier:1', artifacts: [artifact], tests: [testReceipt] };
    },
  };
  function control(action) {
    const run = root.runs['native:run'];
    root = applyCommand(root, { command_id: `${action}:${root.revision}`, run_id: run.run_id, action,
      expected_revision: run.revision, control_epoch: run.control_epoch, parameters: {} }, { ...owner, now: clock }).state;
  }
  return { store, defaults, runner: options => createNativeWorker({ ...defaults, ...options }), get: () => root,
    set: value => { root = value; }, calls: () => calls, clock: value => { clock = value; }, hook: fn => { readHook = fn; }, control };
}

test('native loop binds same frozen Mission, calls allowed model, verifies actual artifact and accepts with replay', async () => {
  const f = setup(); let observed;
  const result = await f.runner({ model: async payload => { observed = payload; return generated(); } }).run(input());
  assert.equal(result.status, 'NATIVE_LOOP_ACCEPTED');
  assert.equal(result.receipt.mission_id, 'native:mission');
  assert.equal(result.model_calls_this_invocation, 1);
  assert.equal(observed.role_selection.role, 'Builder');
  assert.equal(result.replay.model_calls, 0);
  assert.equal(f.get().runs['native:run'].status, 'COMPLETED');
  assert.equal(f.get().missions['native:mission'].status, 'result');
});

test('no adapter or unverified capability is BLOCKED before permit/model, ignoring input authority fields', async () => {
  const f = setup();
  assert.equal((await createNativeWorker({ store: f.store }).run(input())).code, 'BLOCKED_WORKER_IDENTITY');
  const denied = f.runner({ authenticateWorker: async () => ({ actor, capabilities: {} }) });
  assert.equal((await denied.run(input({ approved_by: 'BD', capabilities: { native_model_verified: true } }))).code, 'BLOCKED_NATIVE_MODEL_ADAPTER');
  assert.equal(Object.keys(f.get().work).length, 0); assert.equal(f.calls(), 0);
});

test('duplicate event/hourly fallback after completion returns accepted receipt with zero new generation', async () => {
  const f = setup(), runner = f.runner();
  const first = await runner.run(input());
  const second = await runner.run(input({ trigger_id: 'fallback:hour', trigger_kind: 'HOURLY_FALLBACK' }));
  assert.equal(second.status, 'ALREADY_ACCEPTED'); assert.equal(second.model_calls_this_invocation, 0);
  assert.equal(second.receipt.event_id, first.receipt.event_id); assert.equal(f.calls(), 1);
  assert.equal(f.get().runs['native:run'].counters.accepted_turns, 1);
});

test('simultaneous same-attempt invocation cannot both inherit ownership of STARTED model call', async () => {
  const f = setup(), runner = f.runner();
  const results = await Promise.all([runner.run(input()), runner.run(input({ trigger_id: 'fallback' }))]);
  assert.equal(f.calls(), 1);
  assert.equal(results.filter(result => result.status === 'NATIVE_LOOP_ACCEPTED').length, 1);
  assert.ok(results.some(result => result.code === 'ATTEMPT_IN_FLIGHT' || result.status === 'ALREADY_ACCEPTED'));
  assert.equal(f.get().runs['native:run'].counters.accepted_turns, 1);
});

test('STOP immediately before model prevents call and records NO_EFFECT', async () => {
  const f = setup(); let stopped = false;
  f.hook(() => {
    if (!stopped && Object.values(f.get().work).some(work => Object.values(work.attempts).some(attempt => attempt.status === 'STARTED'))) {
      stopped = true; f.control('STOP');
    }
  });
  const result = await f.runner().run(input());
  assert.equal(result.status, 'BLOCKED'); assert.equal(f.calls(), 0);
  const attempt = Object.values(f.get().work)[0].attempts['attempt:1'];
  assert.equal(attempt.status, 'NO_EFFECT'); assert.equal(attempt.passive_only, true);
});

test('STOP during model permits passive result receipt but prevents artifact acceptance', async () => {
  const f = setup();
  const result = await f.runner({ model: async () => { f.control('STOP'); return generated(); } }).run(input());
  assert.equal(result.status, 'BLOCKED'); assert.equal(result.model_calls_this_invocation, 1);
  assert.equal(f.get().runs['native:run'].counters.accepted_turns, 0);
  const attempt = Object.values(f.get().work)[0].attempts['attempt:1'];
  assert.equal(attempt.status, 'KNOWN_SUCCESS'); assert.equal(attempt.passive_only, true);
});

test('UNKNOWN model effect forbids blind retry; trusted provider readback recovers candidate without model', async () => {
  const f = setup(); let modelCalls = 0;
  const timeout = f.runner({ model: async () => { modelCalls++; throw Error('provider timeout'); } });
  assert.equal((await timeout.run(input())).code, 'MODEL_UNKNOWN_EFFECT_RECONCILE_REQUIRED');
  assert.equal((await timeout.run(input({ attempt_id: 'attempt:2' }))).code, 'RECONCILIATION_REQUIRED');
  const recovered = await f.runner({ model: async () => { modelCalls++; return generated(); }, reconcileModelEffect: async () => ({
    verified: true, receipt_ref: 'provider:readback:1', outcome: { status: 'KNOWN_SUCCESS', receipt_ref: 'native:model:1', candidate: candidate() },
  }) }).run(input({ attempt_id: 'attempt:2' }));
  assert.equal(recovered.status, 'NATIVE_LOOP_ACCEPTED'); assert.equal(recovered.model_calls_this_invocation, 0);
  assert.equal(modelCalls, 1);
});

test('artifact readback failure retains cached candidate; verified retry does not regenerate', async () => {
  const f = setup();
  const first = await f.runner({ verifyResult: async () => ({ verified: true, receipt_ref: 'fake:proof', artifacts: [{ ...artifact, digest: '0'.repeat(64) }], tests: [testReceipt] }) }).run(input());
  assert.equal(first.code, 'ARTIFACT_RECEIPT_MISMATCH'); assert.equal(f.calls(), 1);
  const retry = await f.runner().run(input({ trigger_id: 'retry', attempt_id: 'attempt:2' }));
  assert.equal(retry.status, 'NATIVE_LOOP_ACCEPTED'); assert.equal(retry.model_calls_this_invocation, 0); assert.equal(f.calls(), 1);
});

test('excellent analysis cannot complete frozen prototype Mission', async () => {
  const f = setup(), analysis = { ...artifact, kind: 'report' };
  const result = await f.runner({
    model: async () => ({ receipt_ref: 'analysis:model', candidate: { patch: { set: { analysis: 'excellent' } }, result: { complete: true, artifacts: [analysis], tests: [testReceipt] } } }),
    verifyResult: async () => ({ verified: true, receipt_ref: 'analysis:readback', artifacts: [analysis], tests: [testReceipt] }),
  }).run(input());
  assert.equal(result.code, 'INCOMPLETE_TARGET'); assert.equal(f.get().runs['native:run'].counters.accepted_turns, 0);
});

test('source bytes must match allowed exact binding; source substitution cannot enter reasoning', async () => {
  const f = setup({ source_scope: ['source:one'], source_requirements: ['source:one'] });
  const binding = { source_id: 'source:one', provider: 'Drive', revision: 'rev1', hash_algorithm: 'sha256', digest: sha('exact input'), role: 'governing', privacy_class: 'PRIVATE', allowed_export: false, retrieved_at: AT };
  const result = await f.runner({ resolveSources: async () => ({ bindings: [binding], content: [{ source_id: 'source:one', text: 'substituted input' }] }) }).run(input());
  assert.equal(result.code, 'SOURCE_CONTENT_HASH_CONFLICT'); assert.equal(f.calls(), 0); assert.equal(Object.keys(f.get().work).length, 0);
  const original = { bindings: [binding], content: [{ source_id: 'source:one', text: 'exact input' }] };
  const pending = await f.runner({ resolveSources: async () => original, verifyResult: async () => ({ verified: false }) }).run(input());
  assert.equal(pending.code, 'ARTIFACT_READBACK_UNVERIFIED'); assert.equal(f.calls(), 1);
  const changed = { bindings: [{ ...binding, revision: 'rev2' }], content: original.content };
  const retry = await f.runner({ resolveSources: async () => changed }).run(input({ attempt_id: 'attempt:2' }));
  assert.equal(retry.code, 'FROZEN_SOURCE_BINDING_CONFLICT'); assert.equal(f.calls(), 1);
});

test('expiry and global STOP/reopen epoch are checked again after external verification', async () => {
  const f = setup();
  const expired = await f.runner({ verifyResult: async args => {
    f.clock(f.get().runs['native:run'].expires_at); return f.defaults.verifyResult(args);
  } }).run(input());
  assert.equal(expired.code, 'WINDOW_EXPIRED'); assert.equal(f.get().runs['native:run'].counters.accepted_turns, 0);
  const g = setup();
  const stale = await g.runner({ verifyResult: async args => {
    const state = structuredClone(g.get()); state.global_control.epoch += 2; state.global_control.status = 'ACTIVE'; g.set(state);
    return g.defaults.verifyResult(args);
  } }).run(input());
  assert.equal(stale.code, 'STALE_GLOBAL_CONTROL_EPOCH'); assert.equal(g.get().runs['native:run'].counters.accepted_turns, 0);
});

test('restart replay is model-free and unavailable to another worker identity', async () => {
  const f = setup(); await f.runner().run(input());
  const restored = await f.runner().replay('native:run');
  assert.equal(restored.model_calls, 0); assert.equal(restored.state_hash, digest({ artifact: artifact.artifact_id }));
  await assert.rejects(f.runner({ authenticateWorker: async () => ({ actor: { ...actor, id: 'unapproved-worker' } }) }).replay('native:run'), { code: 'WORKER_NOT_BOUND' });
  assert.equal(f.calls(), 1);
});
