import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initialState, applyCommand, effectGate, bindWorker, verifyLegacyRepair, normalizeIdentities,
  grantWork, beginAttempt, recordOutcome, admitSuccessor, replay, reconcileExpired,
  missionGuard, validateSources, digest,
} from '../functions/_wl/core.mjs';

const NOW = '2026-09-13T01:00:00.000Z';
const OWNER = { id: 'BD', authenticated: true, role: 'owner', auth_ref: 'test-session' };
const WORKER = { id: 'worker:sole', authenticated: true, role: 'worker' };
const RECIPIENTS = ['bd-owned-gmail-bdsim', 'bd-owned-outlook-llm'];
const owner = (now = NOW, capabilities = {}) => ({ actor: OWNER, now, capabilities: { approved_recipient_ids: RECIPIENTS, ...capabilities } });
const worker = (now = NOW, capabilities = {}) => ({ actor: WORKER, now, capabilities });
const mission = (extra = {}) => ({ mission_id: 'm:one', intent: 'Improve the GUI', target_outcome: 'Working improved GUI prototype', target_artifact: { kind: 'prototype' }, source_scope: [], source_requirements: [], success_criteria: ['opens'], ...extra });
const command = (state, action, parameters = {}, runId = 'run:one', commandId = `${action}:${state.revision}`) => ({ command_id: commandId, run_id: runId, action, expected_revision: state.runs[runId]?.revision ?? 0, control_epoch: state.runs[runId]?.control_epoch ?? 0, parameters });
const request = (state, extra = {}, runId = 'run:one') => ({ run_id: runId, expected_revision: state.runs[runId].revision, control_epoch: state.runs[runId].control_epoch, ...extra });
const params = (extra = {}) => ({ run_kind: 'NEW_WL', title: 'Prototype', lab_id: 'lab:one', mission: mission(), ...extra });
function start(extra = {}, runId = 'run:one', capabilities = {}) {
  let state = initialState();
  state = applyCommand(state, command(state, 'START', params(extra), runId), owner(NOW, capabilities)).state;
  return state;
}
function bind(state, runId = 'run:one', now = NOW) {
  return bindWorker(state, request(state, { worker_id: WORKER.id }, runId), owner(now, { worker_binding_verified: true, binding_evidence_ref: 'synthetic:binding' })).state;
}
function ready(extra = {}) { return bind(start(extra)); }
function grant(state, extra = {}) {
  return grantWork(state, request(state, { lab_id: 'lab:one', work_item_id: 'initial', expected_parent: null, trigger_id: 'event:1', trigger_kind: 'EVENT_TRIGGERED', ...extra }), worker());
}
function candidate(initial = ready()) {
  const granted = grant(initial); let state = granted.state;
  const token = { lab_id: 'lab:one', turn_permit_id: granted.result.turn_permit_id, attempt_id: 'attempt:1' };
  state = beginAttempt(state, request(state, token), worker()).state;
  state = recordOutcome(state, request(state, { ...token, outcome: { status: 'KNOWN_SUCCESS', receipt_ref: 'model:receipt:1' } }), worker()).state;
  return { state, token };
}
const output = { complete: true, artifacts: [{ artifact_id: 'artifact:1', kind: 'prototype', digest: 'a'.repeat(64), receipt_ref: 'readback:1' }], tests: [{ criterion_id: 'opens', status: 'PASS', receipt_ref: 'test:1' }] };
function accept(state, token, result = output) {
  return admitSuccessor(state, request(state, { ...token, patch: { set: { answer: 42 }, remove: [] }, result }), worker(NOW, { artifact_receipts_verified: true }));
}
const errorIs = code => error => error.code === code;

test('CREATE is durable DRAFT; explicit START starts exactly 168h using server clock', () => {
  let state = initialState();
  state = applyCommand(state, command(state, 'CREATE', params()), owner()).state;
  assert.equal(state.runs['run:one'].status, 'DRAFT');
  assert.equal(state.runs['run:one'].expires_at, null);
  const later = '2026-09-13T02:00:00.000Z';
  state = applyCommand(state, { ...command(state, 'START'), now: '1900-01-01T00:00:00Z' }, owner(later)).state;
  assert.equal(state.runs['run:one'].managed_window_started_at, later);
  assert.equal(state.runs['run:one'].expires_at, '2026-09-20T02:00:00.000Z');
  assert.equal(state.runs['run:one'].status, 'BLOCKED');
  assert.equal(state.runs['run:one'].block_reason, 'WORKER_NOT_BOUND');
});

test('owner auth, revision, command replay and same-ID conflict are fail-closed', () => {
  let state = initialState(); const create = command(state, 'START', params(), 'run:one', 'same');
  assert.throws(() => applyCommand(state, create, { actor: { id: 'BD', authenticated: false }, now: NOW }), errorIs('UNAUTHENTICATED'));
  const first = applyCommand(state, create, owner()); state = first.state;
  const again = applyCommand(state, create, owner());
  assert.equal(again.result.duplicate, true); assert.equal(again.state, state);
  assert.throws(() => applyCommand(state, { ...create, parameters: params({ title: 'Changed' }) }, owner()), errorIs('COMMAND_ID_PAYLOAD_CONFLICT'));
  assert.throws(() => applyCommand(state, { ...command(state, 'STOP'), expected_revision: 0 }, owner()), errorIs('STALE_REVISION'));
  assert.throws(() => applyCommand(state, { ...command(state, 'STOP'), control_epoch: 0 }, owner()), errorIs('STALE_CONTROL_EPOCH'));
  assert.equal(first.state.commands.same.created_at, NOW);
});

test('all identity alias cases apply symmetrically, without repair or coercion', () => {
  for (const [canonical, alias] of [['lab_id', 'lab_uid'], ['turn_permit_id', 'step_ticket_id']]) {
    const base = { lab_id: 'l', turn_permit_id: 'p' };
    assert.equal(normalizeIdentities(base)[canonical], base[canonical]);
    const legacy = { ...base, [alias]: base[canonical] }; delete legacy[canonical];
    assert.equal(normalizeIdentities(legacy)[canonical], base[canonical]);
    assert.equal(normalizeIdentities({ ...base, [alias]: base[canonical] })[canonical], base[canonical]);
    assert.throws(() => normalizeIdentities({ ...base, [alias]: 'OTHER' }), errorIs(`CONFLICTING_${canonical.toUpperCase()}_ALIAS`));
    for (const invalid of [null, 0, '', ' ']) assert.throws(() => normalizeIdentities({ ...base, [alias]: invalid }));
    const missing = { ...base }; delete missing[canonical]; assert.throws(() => normalizeIdentities(missing));
    assert.throws(() => normalizeIdentities({ ...base, [alias]: `${base[canonical]} ` }));
  }
});

test('Pause/Resume preserve deadline and invalidate an in-flight gate', () => {
  let state = ready(); const old = request(state, { worker_id: WORKER.id }); const end = state.runs['run:one'].expires_at;
  assert.equal(effectGate(state, old, NOW).ok, true);
  state = applyCommand(state, command(state, 'PAUSE'), owner()).state;
  assert.equal(effectGate(state, old, NOW).ok, false);
  assert.equal(effectGate(state, request(state, { worker_id: WORKER.id }), NOW).code, 'RUN_PAUSED');
  assert.equal(state.runs['run:one'].expires_at, end);
  state = applyCommand(state, command(state, 'PROLONG', { duration_hours: 24 }), owner()).state;
  assert.equal(state.runs['run:one'].status, 'PAUSED');
  state = applyCommand(state, command(state, 'RESUME'), owner()).state;
  assert.equal(effectGate(state, request(state, { worker_id: WORKER.id }), NOW).ok, true);
  assert.equal(effectGate(state, old, NOW).ok, false);
});

test('STOP revokes old execution grant; PROLONG cannot resume it', () => {
  let { state, token } = candidate(); const originalGrant = state.runs['run:one'].execution_grant;
  state = applyCommand(state, command(state, 'STOP'), owner()).state;
  assert.ok(state.runs['run:one'].execution_grant > originalGrant);
  state = applyCommand(state, command(state, 'PROLONG', { duration_hours: 24 }), owner()).state;
  assert.equal(state.runs['run:one'].status, 'STOPPED');
  assert.throws(() => applyCommand(state, command(state, 'RESUME'), owner()), errorIs('EXPLICIT_REOPEN_REQUIRED'));
  state = applyCommand(state, command(state, 'PROLONG_AND_RESUME', { duration_hours: 168 }), owner()).state;
  assert.equal(state.runs['run:one'].status, 'WAITING');
  assert.throws(() => accept(state, token), errorIs('REVOKED_EXECUTION_GRANT'));
  assert.throws(() => beginAttempt(state, request(state, { ...token, attempt_id: 'attempt:2' }), worker()), errorIs('REVOKED_EXECUTION_GRANT'));
});

test('expiry exact boundary enforced before effect, admission, and watchdog; prolong race retains EXPIRED', () => {
  let { state, token } = candidate(); const end = state.runs['run:one'].expires_at;
  assert.equal(effectGate(state, request(state, { worker_id: WORKER.id }), end).code, 'WINDOW_EXPIRED');
  assert.throws(() => admitSuccessor(state, request(state, { ...token, patch: { set: {} }, result: output }), worker(end, { artifact_receipts_verified: true })), errorIs('WINDOW_EXPIRED'));
  const reconciled = reconcileExpired(state, worker(end));
  assert.deepEqual(reconciled.result.expired, ['run:one']);
  assert.equal(reconciled.state.runs['run:one'].status, 'EXPIRED');
  state = applyCommand(state, command(state, 'PROLONG', { duration_hours: 24 }), owner(end)).state;
  assert.equal(state.runs['run:one'].status, 'EXPIRED');
  assert.equal(effectGate(state, request(state, { worker_id: WORKER.id }), end).code, 'RUN_EXPIRED');
});

test('SOFT_DELETE stops execution but retains Mission, journal, permits and audit', () => {
  let { state, token } = candidate(); const count = Object.keys(state.work).length;
  state = applyCommand(state, command(state, 'SOFT_DELETE'), owner()).state;
  assert.equal(state.runs['run:one'].status, 'DELETED');
  assert.equal(Object.keys(state.work).length, count); assert.ok(state.missions['m:one']);
  assert.throws(() => accept(state, token), errorIs('RUN_DELETED'));
  state = applyCommand(state, command(state, 'RESTORE_FROM_ARCHIVE'), owner()).state;
  assert.equal(state.runs['run:one'].status, 'STOPPED');
  assert.ok(Object.keys(state.commands).length >= 3);
});

test('Legacy pending repair consumes no time; no pretend controls for unbound sole worker', () => {
  let state = start({ run_kind: 'LEGACY_WL', title: 'Origin' });
  assert.equal(state.runs['run:one'].managed_window_started_at, null);
  assert.equal(state.runs['run:one'].block_reason, 'BLOCKED_REPAIR');
  assert.throws(() => applyCommand(state, command(state, 'STOP'), owner()), errorIs('WORKER_BINDING_REQUIRED'));
  state = bind(state);
  assert.equal(state.runs['run:one'].managed_window_started_at, null);
  assert.throws(() => verifyLegacyRepair(state, request(state), owner()), errorIs('LEGACY_REPAIR_UNVERIFIED'));
  const evidence = { verdict: 'LIVE_PASS', control_gate_verified: true, receipt_ref: 'repair:real-proof', accepted_events: [
    { event_id: 'e10', invocation_id: 'i10', accepted_at: '2026-09-12T23:00:00.000Z', chain_verified: true, readback_verified: true },
    { event_id: 'e11', invocation_id: 'i11', accepted_at: '2026-09-13T00:00:00.000Z', chain_verified: true, readback_verified: true },
  ] };
  state = verifyLegacyRepair(state, request(state), owner(NOW, { legacy_repair_evidence: evidence })).state;
  assert.equal(state.runs['run:one'].managed_window_started_at, evidence.accepted_events[0].accepted_at);
  assert.equal(state.runs['run:one'].expires_at, '2026-09-19T23:00:00.000Z');
});

test('existing email A/B retain origin start and receive independent windows only after verified binding', () => {
  let state = initialState();
  for (const runId of ['A', 'B']) {
    state = applyCommand(state, command(state, 'CREATE', { run_kind: 'EMAIL_DIALOGUE', title: runId, existing: true, recipients: RECIPIENTS, started_at: '2026-09-12T00:00:00Z' }, runId), owner(NOW, { import_existing_verified: true })).state;
    assert.equal(state.runs[runId].expires_at, null);
    assert.throws(() => applyCommand(state, command(state, 'PAUSE', {}, runId), owner()), errorIs('WORKER_BINDING_REQUIRED'));
    state = bind(state, runId);
    assert.equal(state.runs[runId].started_at, '2026-09-12T00:00:00.000Z');
    assert.equal(state.runs[runId].managed_window_started_at, NOW);
  }
  state = applyCommand(state, command(state, 'STOP', {}, 'A'), owner()).state;
  assert.equal(effectGate(state, request(state, { worker_id: WORKER.id, effect: 'EMAIL_SEND' }, 'A'), NOW).ok, false);
  assert.equal(effectGate(state, request(state, { worker_id: WORKER.id, effect: 'EMAIL_SEND' }, 'B'), NOW).ok, true);
});

test('new email seed retained privately; arbitrary recipient, paid call, forged approval denied', () => {
  const parameters = { run_kind: 'EMAIL_DIALOGUE', title: 'New', seed: 'Private seed', recipients: RECIPIENTS };
  const state = start(parameters); assert.equal(state.runs['run:one'].seed, 'Private seed');
  assert.throws(() => start({ ...parameters, recipients: ['attacker', RECIPIENTS[0]], approved_by: 'BD' }), errorIs('RECIPIENT_NOT_AUTHORIZED'));
  assert.throws(() => start({ cost_policy: 'ALLOW_PAID', approved_by: 'BD' }), errorIs('PAID_AUTHORITY_REQUIRED'));
  const bound = bind(state);
  assert.equal(effectGate(bound, request(bound, { worker_id: WORKER.id, effect: 'EMAIL_SEND', paid: true }), NOW).code, 'PAID_AUTHORITY_REQUIRED');
  assert.throws(() => bindWorker(state, request(state, { worker_id: WORKER.id, approved_by: 'BD' }), owner()), errorIs('WORKER_BINDING_UNVERIFIED'));
});

test('event/fallback delivery coalesces one logical work, while changed parent cannot manufacture a turn', () => {
  let state = ready(); const first = grant(state); state = first.state;
  const second = grant(state, { trigger_id: 'fallback:hour' }); state = second.state;
  assert.equal(first.result.turn_permit_id, second.result.turn_permit_id);
  assert.deepEqual(second.result.trigger_ids, ['event:1', 'fallback:hour']);
  assert.equal(Object.keys(state.work).length, 1);
  assert.throws(() => grant(state, { expected_parent: 'newer' }), errorIs('ORIGINAL_PARENT_CONFLICT'));
  assert.throws(() => grant(ready(), { trigger_kind: 'HEARTBEAT' }), errorIs('NON_RESEARCH_TRIGGER'));
  assert.throws(() => grant(ready(), { work_item_id: 'unapproved' }), errorIs('WORK_ITEM_NOT_ADMITTED'));
});

test('event mode requires fresh verified official source; unsupported or stale bindings fall back honestly', () => {
  const state = ready();
  const input = request(state, { lab_id: 'lab:one', work_item_id: 'initial', expected_parent: null, trigger_id: 'signal', trigger_kind: 'EVENT_TRIGGERED' });
  const fallback = grantWork(state, input, worker());
  assert.equal(fallback.result.trigger_kind, 'HOURLY_FALLBACK');
  assert.equal(fallback.result.event_fast_path_status, 'BLOCKED_UNVERIFIED_BINDING');
  const capability = { event_trigger_verified: true, event_source: 'GMAIL', event_capability_receipt_ref: 'synthetic:official-trigger-binding', event_capability_observed_at: NOW };
  assert.equal(grantWork(state, input, worker(NOW, capability)).result.trigger_kind, 'EVENT_TRIGGERED');
  assert.equal(grantWork(state, input, worker(NOW, { ...capability, event_source: 'ARBITRARY_NETLIFY_WEBHOOK' })).result.trigger_kind, 'HOURLY_FALLBACK');
  assert.equal(grantWork(state, input, worker(NOW, { ...capability, event_capability_observed_at: '2026-09-01T01:00:00Z' })).result.trigger_kind, 'HOURLY_FALLBACK');
  assert.throws(() => grantWork(state, { ...input, trigger_kind: 'MADE_UP' }, worker()), errorIs('INVALID_TRIGGER_KIND'));
  assert.throws(() => grantWork(fallback.state, input, { ...worker(), actor: { ...WORKER, id: 'revoked-worker' } }), errorIs('WRONG_WORKER'));
});

test('binding a draft does not start it and changing sole worker needs explicit handoff', () => {
  let state = initialState();
  state = applyCommand(state, command(state, 'CREATE', params()), owner()).state;
  state = bind(state);
  assert.equal(state.runs['run:one'].status, 'DRAFT'); assert.equal(state.runs['run:one'].expires_at, null);
  assert.throws(() => bindWorker(state, request(state, { worker_id: 'worker:second' }), owner(NOW, { worker_binding_verified: true, binding_evidence_ref: 'test' })), errorIs('SINGLE_WRITER_HANDOFF_REQUIRED'));
  state = applyCommand(state, command(state, 'START'), owner()).state;
  assert.equal(state.runs['run:one'].status, 'WAITING');
});

test('durable CAS collision prevents two attempts and two accepted successors', () => {
  const initial = ready(); const eventRead = grant(initial); const fallbackRead = grant(initial, { trigger_id: 'fallback' });
  let durable = { revision: 0, value: initial };
  const cas = (expected, value) => { if (expected !== durable.revision) return false; durable = { revision: expected + 1, value }; return true; };
  assert.equal(cas(0, eventRead.state), true); assert.equal(cas(0, fallbackRead.state), false);
  const fallbackRetry = grant(durable.value, { trigger_id: 'fallback' }); assert.equal(cas(1, fallbackRetry.state), true);
  const token = { lab_id: 'lab:one', turn_permit_id: eventRead.result.turn_permit_id, attempt_id: 'first' };
  const first = beginAttempt(durable.value, request(durable.value, token), worker());
  const competing = beginAttempt(durable.value, request(durable.value, { ...token, attempt_id: 'second' }), worker());
  assert.equal(cas(2, first.state), true); assert.equal(cas(2, competing.state), false);
  assert.throws(() => beginAttempt(durable.value, request(durable.value, { ...token, attempt_id: 'second' }), worker()), errorIs('ATTEMPT_IN_FLIGHT'));
  durable.value = recordOutcome(durable.value, request(durable.value, { ...token, outcome: { status: 'KNOWN_SUCCESS', receipt_ref: 'r' } }), worker()).state;
  const a = accept(durable.value, token), b = accept(durable.value, token);
  assert.equal(cas(3, a.state), true); assert.equal(cas(3, b.state), false);
  const duplicate = accept(durable.value, token); assert.equal(duplicate.result.duplicate, true);
  assert.equal(durable.value.runs['run:one'].counters.accepted_turns, 1);
});

test('distinct authorized work in one Mission has a separate permit and retained parent', () => {
  let { state, token } = candidate(); state = accept(state, token, { ...output, complete: false }).state;
  const old = grant(state); assert.equal(old.result.status, 'ACCEPTED');
  state = applyCommand(state, command(state, 'ADMIT_WORK', { work_item_id: 'next', expected_parent: state.runs['run:one'].research_head }), owner()).state;
  const next = grant(state, { work_item_id: 'next', expected_parent: state.runs['run:one'].research_head, trigger_id: 'event:next' });
  assert.notEqual(next.result.turn_permit_id, token.turn_permit_id);
  assert.equal(Object.keys(next.state.work).length, 2);
});

test('UNKNOWN_EFFECT blocks retry until trusted receipt reconciliation; late result is passive', () => {
  const granted = grant(ready()); let state = granted.state;
  const token = { lab_id: 'lab:one', turn_permit_id: granted.result.turn_permit_id, attempt_id: 'one' };
  state = beginAttempt(state, request(state, token), worker()).state;
  state = recordOutcome(state, request(state, { ...token, outcome: { status: 'UNKNOWN_EFFECT' } }), worker()).state;
  assert.throws(() => beginAttempt(state, request(state, { ...token, attempt_id: 'two' }), worker()), errorIs('RECONCILIATION_REQUIRED'));
  assert.throws(() => recordOutcome(state, request(state, { ...token, outcome: { status: 'NO_EFFECT' } }), worker()), errorIs('RECONCILIATION_REQUIRED'));
  state = recordOutcome(state, request(state, { ...token, outcome: { status: 'NO_EFFECT' } }), worker(NOW, { reconciliation_verified: true, reconciliation_receipt_ref: 'sent-inbox:absent' })).state;
  state = beginAttempt(state, request(state, { ...token, attempt_id: 'two' }), worker()).state;
  state = applyCommand(state, command(state, 'STOP'), owner()).state;
  const late = recordOutcome(state, request(state, { ...token, attempt_id: 'two', outcome: { status: 'KNOWN_SUCCESS', receipt_ref: 'late:1' } }), worker());
  assert.equal(late.result.passive_only, true); assert.equal(late.state.runs['run:one'].status, 'STOPPED');
});

test('Mission Guard rejects excellent analysis for prototype but accepts report when requested', () => {
  const analysis = { complete: true, artifacts: [{ artifact_id: 'analysis:1', kind: 'report', digest: 'b'.repeat(64), receipt_ref: 'analysis:readback' }], tests: output.tests };
  assert.equal(missionGuard(mission(), analysis).code, 'INCOMPLETE_TARGET');
  assert.equal(missionGuard(mission({ target_artifact: { kind: 'report' } }), analysis).ok, true);
  const { state, token } = candidate(); assert.throws(() => accept(state, token, analysis), errorIs('INCOMPLETE_TARGET'));
  assert.equal(state.runs['run:one'].counters.accepted_turns, 0);
});

test('frozen Mission cannot change after intake or grant; no scope in a model output grants authority', () => {
  const state = ready(); const tampered = structuredClone(state); tampered.missions['m:one'].target_artifact.kind = 'report';
  assert.throws(() => grant(tampered), errorIs('FROZEN_MISSION_CONFLICT'));
  const prepared = candidate(); prepared.state.missions['m:one'].source_scope = ['secret'];
  assert.throws(() => accept(prepared.state, prepared.token), errorIs('FROZEN_MISSION_CONFLICT'));
  const other = candidate(); const accepted = admitSuccessor(other.state, request(other.state, { ...other.token, patch: { set: { approved_by: 'BD', cost_policy: 'ALLOW_PAID' } }, result: output }), worker(NOW, { artifact_receipts_verified: true }));
  assert.equal(accepted.state.runs['run:one'].cost_policy, 'NO_PAID');
  assert.equal(accepted.state.research['run:one'].current.approved_by, 'BD');
});

test('exact source hash/identity binding distinguishes unavailable and conflicting source', () => {
  const required = mission({ source_scope: ['file:one'], source_requirements: [{ source_id: 'file:one', digest: 'a'.repeat(64) }] });
  const source = { source_id: 'file:one', provider: 'Drive', revision: 'rev1', hash_algorithm: 'sha256', digest: 'a'.repeat(64), role: 'governing', privacy_class: 'PRIVATE', allowed_export: false, retrieved_at: NOW };
  assert.equal(validateSources(required, [source]).source_set_hash, digest([source]));
  assert.throws(() => validateSources(required, []), errorIs('SOURCE_UNAVAILABLE_TO_EXECUTOR'));
  assert.throws(() => validateSources(required, [{ ...source, available: false }]), errorIs('SOURCE_UNAVAILABLE_TO_EXECUTOR'));
  assert.throws(() => validateSources(required, [{ ...source, digest: 'b'.repeat(64) }]), errorIs('SOURCE_HASH_CONFLICT'));
  assert.throws(() => validateSources(required, [{ ...source, source_id: 'file:other' }]), errorIs('SOURCE_SCOPE_NOT_AUTHORIZED'));
});

test('accepted patch replay has zero model calls; partial write and tamper are detected', () => {
  const { state, token } = candidate(); const accepted = accept(state, token);
  assert.deepEqual(replay(accepted.state, 'run:one').state, { answer: 42 });
  assert.equal(replay(accepted.state, 'run:one').model_calls, 0);
  assert.equal(replay(accepted.state, 'run:one').state_hash, accepted.result.state_hash);
  const partial = structuredClone(accepted.state); partial.research['run:one'].current = {};
  assert.throws(() => replay(partial, 'run:one'), errorIs('REPLAY_INTEGRITY_FAILURE'));
  const tamper = structuredClone(accepted.state); tamper.research['run:one'].events[0].result.artifacts[0].digest = 'f'.repeat(64);
  assert.throws(() => replay(tamper, 'run:one'), errorIs('REPLAY_INTEGRITY_FAILURE'));
  assert.equal(state.runs['run:one'].counters.accepted_turns, 0, 'reducer did not mutate caller state');
});

test('whole-root CAS retries preserve unrelated run changes and global hold defeats stale local authority', () => {
  let state = ready();
  state = applyCommand(state, command(state, 'START', { run_kind: 'EMAIL_DIALOGUE', title: 'mail', recipients: RECIPIENTS }, 'mail'), owner()).state;
  state = bind(state, 'mail');
  const stale = state; const snapshotRevision = state.revision;
  state = applyCommand(state, command(state, 'STOP', {}, 'mail'), owner()).state;
  const outdated = applyCommand(stale, command(stale, 'PAUSE'), owner());
  assert.notEqual(snapshotRevision, state.revision, 'unrelated root update prevents stale whole-root CAS');
  assert.equal(outdated.state.runs.mail.status, 'WAITING');
  state = applyCommand(state, command(state, 'PAUSE'), owner()).state;
  assert.equal(state.runs.mail.status, 'STOPPED');
  state.global_control = { status: 'STOPPED', epoch: 2 };
  assert.equal(effectGate(state, request(state, { worker_id: WORKER.id }), NOW).code, 'GLOBAL_CONTROL_BLOCKED');
});
