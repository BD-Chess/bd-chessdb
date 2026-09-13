/* Pure control-plane reducers. The caller MUST CAS the complete returned state before
 * using any result as a grant. `ctx` is constructed by the authenticated server, never
 * by spreading a request body. No reducer performs a model call or external effect. */
import { createHash } from 'node:crypto';

export const SCHEMA = 'wl.managed-state.v1';
export const WEEK_HOURS = 168;
const ACTIVE = new Set(['QUEUED', 'ACTIVE', 'WAITING', 'VERIFYING']);
const KINDS = new Set(['NEW_WL', 'LEGACY_WL', 'EMAIL_DIALOGUE']);
const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);
export class CoreError extends Error {
  constructor(code, status = 409) { super(code); this.name = 'CoreError'; this.code = code; this.status = status; }
}
function fail(code, status) { throw new CoreError(code, status); }
function id(value, label = 'ID') {
  if (typeof value !== 'string' || !value.length || !value.trim().length || (UNSAFE.has(value) && !['TITLE', 'MISSION_INTENT', 'TARGET_OUTCOME', 'TARGET_ARTIFACT_KIND'].includes(label))) fail(`INVALID_${label}`, 400);
  return value;
}
function json(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(json).join(',')}]`;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const keys = Object.keys(value).sort();
    if (keys.some(k => UNSAFE.has(k))) fail('UNSAFE_OBJECT_KEY', 400);
    return `{${keys.map(k => `${JSON.stringify(k)}:${json(value[k])}`).join(',')}}`;
  }
  fail('INVALID_JSON_VALUE', 400);
}
export function digest(value) { return createHash('sha256').update(json(value)).digest('hex'); }
function copy(value) { return JSON.parse(json(value)); }
function time(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) fail('SERVER_TIME_REQUIRED', 400);
  return new Date(value).toISOString();
}
function trusted(ctx, role) {
  if (!ctx?.actor?.authenticated || !ctx.actor.id) fail('UNAUTHENTICATED', 401);
  if (role && ctx.actor.role !== role) fail('FORBIDDEN_ACTOR', 403);
  return time(ctx.now);
}
function worker(ctx) {
  const now = trusted(ctx);
  if (!['owner', 'worker'].includes(ctx.actor.role)) fail('FORBIDDEN_ACTOR', 403);
  return now;
}
function finish(state, result) { state.revision += 1; return { state, result }; }
function getRun(state, runId) { const run = state.runs[id(runId, 'RUN_ID')]; if (!run) fail('RUN_NOT_FOUND', 404); return run; }
function epochCheck(run, value) {
  if (!Number.isInteger(value.expected_revision) || value.expected_revision !== run.revision) fail('STALE_REVISION');
  if (!Number.isInteger(value.control_epoch) || value.control_epoch !== run.control_epoch) fail('STALE_CONTROL_EPOCH');
}
function hasExpired(run, now) { return !!run.expires_at && Date.parse(now) >= Date.parse(run.expires_at); }
function expire(run, now) {
  if (hasExpired(run, now) && !['EXPIRED', 'STOPPED', 'DELETED', 'COMPLETED'].includes(run.status)) {
    run.status = 'EXPIRED'; run.block_reason = 'WINDOW_EXPIRED'; run.execution_grant += 1;
    run.control_epoch += 1; run.revision += 1;
  }
}
function targetDeadline(now, parameters, base = now) {
  if (parameters.expires_at != null) {
    const end = time(parameters.expires_at);
    if (Date.parse(end) <= Date.parse(now)) fail('INVALID_EXPIRY', 400);
    return end;
  }
  const hours = parameters.duration_hours ?? WEEK_HOURS;
  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0 || hours > 24 * 3660) fail('INVALID_DURATION', 400);
  return new Date(Date.parse(base) + hours * 3600000).toISOString();
}

export function initialState() {
  return { schema: SCHEMA, revision: 0, runs: {}, commands: {}, missions: {}, work: {}, permits: {}, research: {}, events: [], global_control: { status: 'ACTIVE', epoch: 0 } };
}

export function normalizeIdentities(input, { requireLab = true, requirePermit = true } = {}) {
  const normalized = copy(input), provenance = [];
  for (const [canonical, alias, required] of [['lab_id', 'lab_uid', requireLab], ['turn_permit_id', 'step_ticket_id', requirePermit]]) {
    const hasCanonical = Object.hasOwn(input, canonical), hasAlias = Object.hasOwn(input, alias);
    if (hasCanonical) id(input[canonical], canonical.toUpperCase());
    if (hasAlias) id(input[alias], alias.toUpperCase());
    if (hasCanonical && hasAlias && input[canonical] !== input[alias]) fail(`CONFLICTING_${canonical.toUpperCase()}_ALIAS`, 400);
    if (!hasCanonical && !hasAlias && required) fail(`MISSING_${canonical.toUpperCase()}`, 400);
    if (hasCanonical || hasAlias) {
      normalized[canonical] = hasCanonical ? input[canonical] : input[alias];
      if (hasAlias) provenance.push({ alias, canonical, value: input[alias] });
      delete normalized[alias];
    }
  }
  return { ...normalized, identity_provenance: provenance };
}

function freezeMission(input, run, now) {
  if (!input || typeof input !== 'object') fail('MISSION_REQUIRED', 400);
  const mission = copy(input);
  id(mission.mission_id, 'MISSION_ID'); id(mission.intent, 'MISSION_INTENT'); id(mission.target_outcome, 'TARGET_OUTCOME');
  if (!mission.target_artifact || typeof mission.target_artifact !== 'object') fail('TARGET_ARTIFACT_REQUIRED', 400);
  id(mission.target_artifact.kind, 'TARGET_ARTIFACT_KIND');
  mission.source_requirements ??= []; mission.source_scope ??= run.source_scope;
  mission.allowed_effect_scope ??= ['RESEARCH']; mission.privacy_class ??= 'PRIVATE';
  mission.cost_policy ??= 'NO_PAID'; mission.success_criteria ??= [];
  mission.success_test ??= null; mission.collaboration_mode ??= 'SEED_ONLY'; mission.release_scope ??= 'PRIVATE';
  if (mission.cost_policy !== 'NO_PAID' || mission.release_scope !== 'PRIVATE') fail('SCOPE_NOT_AUTHORIZED', 403);
  if (!Array.isArray(mission.allowed_effect_scope) || mission.allowed_effect_scope.some(e => !['RESEARCH', 'PRIVATE_ARTIFACT'].includes(e))) fail('EFFECT_SCOPE_NOT_AUTHORIZED', 403);
  if (![mission.source_scope, mission.source_requirements, mission.success_criteria].every(Array.isArray)) fail('INVALID_MISSION_LIST', 400);
  mission.owner = 'BD'; mission.run_id = run.run_id; mission.lab_id = run.lab_id;
  mission.revision = 1; mission.created_at = now; mission.status = 'received';
  mission.frozen_hash = missionDigest(mission);
  return mission;
}
function missionDigest(mission) {
  const frozen = copy(mission); delete frozen.status; delete frozen.frozen_hash;
  return digest(frozen);
}

/** Authenticated owner lifecycle command. Duplicate ID/payload returns the original
 * receipt even after subsequent control changes; changed payload is a hard conflict. */
export function applyCommand(previous, command, ctx) {
  const now = trusted(ctx, 'owner');
  id(command.command_id, 'COMMAND_ID'); id(command.run_id, 'RUN_ID'); id(command.action, 'ACTION');
  const payloadHash = digest(command), prior = previous.commands[command.command_id];
  if (prior) {
    if (prior.payload_hash !== payloadHash || prior.actor_id !== ctx.actor.id) fail('COMMAND_ID_PAYLOAD_CONFLICT');
    return { state: previous, result: { ...copy(prior), duplicate: true } };
  }
  const state = copy(previous), p = command.parameters ?? {};
  let run = state.runs[command.run_id];
  if (['CREATE', 'START'].includes(command.action) && !run) {
    if (command.expected_revision !== 0 || command.control_epoch !== 0) fail('STALE_REVISION');
    if (!KINDS.has(p.run_kind)) fail('INVALID_RUN_KIND', 400);
    if (p.cost_policy && p.cost_policy !== 'NO_PAID') fail('PAID_AUTHORITY_REQUIRED', 403);
    if (p.existing && !ctx.capabilities?.import_existing_verified) fail('EXISTING_IMPORT_NOT_VERIFIED', 403);
    if (p.run_kind === 'LEGACY_WL' && Object.values(state.runs).some(r => r.run_kind === 'LEGACY_WL')) fail('LEGACY_WRITER_ALREADY_REGISTERED');
    let recipients = [];
    if (p.run_kind === 'EMAIL_DIALOGUE') {
      recipients = p.recipients ?? [];
      const allowed = ctx.capabilities?.approved_recipient_ids ?? [];
      if (!Array.isArray(recipients) || recipients.length !== 2 || new Set(recipients).size !== 2 || recipients.some(r => !allowed.includes(r))) fail('RECIPIENT_NOT_AUTHORIZED', 403);
    }
    const identities = p.run_kind === 'NEW_WL' ? normalizeIdentities(p, { requirePermit: false }) : p;
    const draft = command.action === 'CREATE' && !p.existing && p.run_kind !== 'LEGACY_WL';
    const pendingWindow = draft || p.run_kind === 'LEGACY_WL' || !!p.existing;
    run = {
      run_id: command.run_id, run_kind: p.run_kind, title: id(p.title, 'TITLE'), owner: 'BD',
      seed_or_intent_ref: p.seed_or_intent_ref ?? null, seed: p.seed ?? null, lab_id: identities.lab_id ?? null,
      requested_window: { duration_hours: p.duration_hours ?? WEEK_HOURS, ...(p.expires_at ? { expires_at: p.expires_at } : {}) },
      status: draft ? 'DRAFT' : 'BLOCKED', revision: 1, control_epoch: 1, execution_grant: 1,
      created_at: now, started_at: p.existing && p.started_at ? time(p.started_at) : pendingWindow ? null : now,
      managed_window_started_at: pendingWindow ? null : now, expires_at: pendingWindow ? null : targetDeadline(now, p),
      paused_at: null, stopped_at: null, completed_at: null, deleted_at: null,
      last_activity_at: null, last_measured_at: now, worker_profile: p.worker_profile ?? null,
      worker_binding: null, source_scope: p.source_scope ?? [], privacy_class: 'PRIVATE', cost_policy: 'NO_PAID',
      counters: { generation_attempts: 0, accepted_turns: 0, material_effects: 0, logical_messages: 0 },
      last_receipt_ref: null, block_reason: draft ? null : p.run_kind === 'LEGACY_WL' ? 'BLOCKED_REPAIR' : 'WORKER_NOT_BOUND',
      existing: !!p.existing, recipient_ids: recipients,
      eligible_work: { initial: { expected_parent: null } },
      research_head: null, mission_id: null,
    };
    if (p.run_kind === 'NEW_WL') {
      const mission = freezeMission(p.mission, run, now);
      if (state.missions[mission.mission_id]) fail('MISSION_ID_ALREADY_EXISTS');
      run.mission_id = mission.mission_id; state.missions[mission.mission_id] = mission;
      state.research[run.run_id] = { checkpoint: {}, current: {}, events: [] };
    }
    state.runs[run.run_id] = run;
  } else {
    run = getRun(state, command.run_id); epochCheck(run, command);
    if ((run.existing || run.run_kind === 'LEGACY_WL') && !run.worker_binding?.verified) fail('WORKER_BINDING_REQUIRED');
    const expired = hasExpired(run, now);
    if (run.status === 'DELETED' && command.action !== 'RESTORE_FROM_ARCHIVE') fail('RUN_DELETED');
    switch (command.action) {
      case 'CREATE': fail('RUN_ALREADY_EXISTS'); break;
      case 'START':
        if (run.status !== 'DRAFT') fail('RUN_ALREADY_EXISTS');
        run.started_at = now; run.managed_window_started_at = now;
        run.expires_at = targetDeadline(now, Object.keys(p).length ? p : run.requested_window);
        run.status = run.worker_binding?.verified ? 'WAITING' : 'BLOCKED';
        run.block_reason = run.worker_binding?.verified ? null : 'WORKER_NOT_BOUND'; break;
      case 'PAUSE':
        if (expired || !ACTIVE.has(run.status)) fail('RUN_NOT_PAUSABLE');
        run.status = 'PAUSED'; run.paused_at = now; run.block_reason = null; break;
      case 'RESUME':
        if (expired) fail('WINDOW_EXPIRED');
        if (run.status !== 'PAUSED') fail('EXPLICIT_REOPEN_REQUIRED');
        run.status = run.worker_binding?.verified ? 'WAITING' : 'BLOCKED';
        run.block_reason = run.worker_binding?.verified ? null : 'WORKER_NOT_BOUND'; break;
      case 'STOP':
        run.status = 'STOPPED'; run.stopped_at = now; run.execution_grant += 1; run.block_reason = 'OWNER_STOP'; break;
      case 'SOFT_DELETE':
        run.status = 'DELETED'; run.stopped_at ??= now; run.deleted_at = now; run.execution_grant += 1; run.block_reason = 'SOFT_DELETED'; break;
      case 'RESTORE_FROM_ARCHIVE':
        if (run.status !== 'DELETED') fail('RUN_NOT_DELETED');
        run.status = 'STOPPED'; run.deleted_at = null; run.block_reason = 'OWNER_STOP'; break;
      case 'PROLONG':
      case 'PROLONG_AND_RESUME': {
        if (!run.managed_window_started_at) fail('MANAGED_WINDOW_NOT_STARTED');
        if (expired && !['EXPIRED', 'STOPPED', 'COMPLETED'].includes(run.status)) {
          run.status = 'EXPIRED'; run.execution_grant += 1; run.block_reason = 'WINDOW_EXPIRED';
        }
        const end = targetDeadline(now, p, Date.parse(run.expires_at) > Date.parse(now) ? run.expires_at : now);
        if (Date.parse(end) <= Date.parse(run.expires_at)) fail('PROLONG_MUST_EXTEND_WINDOW', 400);
        run.expires_at = end;
        if (command.action === 'PROLONG_AND_RESUME') {
          if (!['PAUSED', 'STOPPED', 'EXPIRED', 'COMPLETED', 'BLOCKED'].includes(run.status)) fail('REOPEN_STATE_REQUIRED');
          run.execution_grant += 1;
          run.eligible_work[`reopen:${run.execution_grant}`] = { expected_parent: run.research_head };
          run.status = run.worker_binding?.verified ? 'WAITING' : 'BLOCKED';
          run.block_reason = run.worker_binding?.verified ? null : 'WORKER_NOT_BOUND';
        }
        break;
      }
      case 'ADMIT_WORK': {
        if (expired || !ACTIVE.has(run.status)) fail('RUN_NOT_ACTIVE');
        const workId = id(p.work_item_id, 'WORK_ITEM_ID');
        if (Object.hasOwn(run.eligible_work, workId)) fail('WORK_ITEM_ALREADY_ADMITTED');
        if ((p.expected_parent ?? null) !== run.research_head) fail('PARENT_CONFLICT');
        run.eligible_work[workId] = { expected_parent: run.research_head }; break;
      }
      default: fail('INVALID_ACTION', 400);
    }
    run.revision += 1; run.control_epoch += 1;
  }
  const receipt = {
    receipt_id: `command:${command.command_id}`, command_id: command.command_id, run_id: run.run_id,
    action: command.action, actor_id: ctx.actor.id, actor_auth_ref: ctx.actor.auth_ref ?? ctx.actor.id,
    expected_revision: command.expected_revision, expected_control_epoch: command.control_epoch,
    parameters_hash: digest(p), payload_hash: payloadHash, created_at: now,
    observed_result: run.status, resulting_revision: run.revision, resulting_control_epoch: run.control_epoch,
  };
  state.commands[command.command_id] = receipt; run.last_receipt_ref = receipt.receipt_id;
  return finish(state, { ...receipt, run: copy(run), duplicate: false });
}

/** Read-only, fail-closed gate. Must run against the latest CAS state immediately
 * before an effect; earlier grants and UI clocks never replace this check. */
export function effectGate(state, request, suppliedNow) {
  try {
    const now = time(suppliedNow), run = getRun(state, request.run_id);
    if (state.global_control?.status !== 'ACTIVE') fail('GLOBAL_CONTROL_BLOCKED');
    epochCheck(run, request);
    if (hasExpired(run, now)) fail('WINDOW_EXPIRED');
    if (!ACTIVE.has(run.status)) fail(`RUN_${run.status}`);
    if (!run.managed_window_started_at || !run.expires_at) fail('MANAGED_WINDOW_NOT_STARTED');
    if (!run.worker_binding?.verified) fail('WORKER_NOT_BOUND');
    if (!request.worker_id || request.worker_id !== run.worker_binding.worker_id) fail('WRONG_WORKER', 403);
    const effect = request.effect ?? 'RESEARCH';
    if (!run.worker_binding.effect_scope.includes(effect)) fail('EFFECT_SCOPE_NOT_AUTHORIZED', 403);
    if (request.paid === true) fail('PAID_AUTHORITY_REQUIRED', 403);
    if (request.recipient_id && !run.recipient_ids.includes(request.recipient_id)) fail('RECIPIENT_NOT_AUTHORIZED', 403);
    if (request.execution_grant != null && request.execution_grant !== run.execution_grant) fail('REVOKED_EXECUTION_GRANT');
    return { ok: true, code: 'EFFECT_GATE_PASS', run: copy(run), checked_at: now, execution_grant: run.execution_grant };
  } catch (error) {
    if (!(error instanceof CoreError)) throw error;
    return { ok: false, code: error.code };
  }
}
function requireGate(state, request, ctx, now) {
  const gate = effectGate(state, { ...request, worker_id: ctx.actor.id }, now);
  if (!gate.ok) fail(gate.code); return gate.run;
}

/** Binding is a server-verified deployment receipt, never a form/model assertion. */
export function bindWorker(previous, request, ctx) {
  const now = trusted(ctx, 'owner');
  if (!ctx.capabilities?.worker_binding_verified || !ctx.capabilities?.binding_evidence_ref) fail('WORKER_BINDING_UNVERIFIED', 403);
  const state = copy(previous), run = getRun(state, request.run_id); epochCheck(run, request);
  if (['STOPPED', 'DELETED', 'COMPLETED', 'EXPIRED'].includes(run.status) || hasExpired(run, now)) fail('EXPLICIT_REOPEN_REQUIRED');
  const workerId = id(request.worker_id, 'WORKER_ID');
  if (run.worker_binding && run.worker_binding.worker_id !== workerId) fail('SINGLE_WRITER_HANDOFF_REQUIRED');
  const effects = request.effect_scope ?? (run.run_kind === 'EMAIL_DIALOGUE' ? ['EMAIL_SEND'] : ['RESEARCH', 'COMMIT', 'PRIVATE_ARTIFACT']);
  const allowed = run.run_kind === 'EMAIL_DIALOGUE' ? ['EMAIL_SEND'] : ['RESEARCH', 'COMMIT', 'PRIVATE_ARTIFACT'];
  if (!Array.isArray(effects) || !effects.length || effects.some(e => !allowed.includes(e))) fail('EFFECT_SCOPE_NOT_AUTHORIZED', 403);
  run.worker_binding = { worker_id: workerId, verified: true, bound_at: now, evidence_ref: ctx.capabilities.binding_evidence_ref, effect_scope: effects };
  if (run.run_kind !== 'LEGACY_WL' && run.status !== 'DRAFT') {
    if (!run.managed_window_started_at) { run.managed_window_started_at = now; run.expires_at = targetDeadline(now, {}); }
    run.status = 'WAITING'; run.block_reason = null;
  }
  run.revision += 1; run.control_epoch += 1;
  const result = { receipt_id: `binding:${run.run_id}:${run.revision}`, run: copy(run), verified_at: now };
  state.events.push({ type: 'WORKER_BOUND', receipt_id: result.receipt_id, run_id: run.run_id, verified_at: now });
  return finish(state, result);
}

export function verifyLegacyRepair(previous, request, ctx) {
  const now = trusted(ctx, 'owner');
  const evidence = ctx.capabilities?.legacy_repair_evidence;
  if (!evidence || evidence.verdict !== 'LIVE_PASS' || !Array.isArray(evidence.accepted_events) || evidence.accepted_events.length < 2 || !evidence.control_gate_verified) fail('LEGACY_REPAIR_UNVERIFIED', 403);
  const state = copy(previous), run = getRun(state, request.run_id); epochCheck(run, request);
  if (run.run_kind !== 'LEGACY_WL' || run.status !== 'BLOCKED' || run.block_reason !== 'BLOCKED_REPAIR' || !run.worker_binding?.verified || run.managed_window_started_at) fail('LEGACY_REPAIR_STATE_CONFLICT');
  const events = evidence.accepted_events;
  if (new Set(events.map(e => e.invocation_id)).size !== events.length || new Set(events.map(e => e.event_id)).size !== events.length || events.some(e => !e.invocation_id || !e.event_id || !e.chain_verified || !e.readback_verified)) fail('LEGACY_REPAIR_UNVERIFIED');
  if (events.some((event, i) => i > 0 && Date.parse(time(event.accepted_at)) <= Date.parse(time(events[i - 1].accepted_at)))) fail('LEGACY_EVENT_ORDER_INVALID');
  const start = time(events[0].accepted_at);
  if (Date.parse(start) > Date.parse(now) || events.some(e => Date.parse(time(e.accepted_at)) > Date.parse(now))) fail('INVALID_REPAIR_TIME');
  run.managed_window_started_at = start; run.started_at ??= start; run.expires_at = targetDeadline(start, {});
  run.status = hasExpired(run, now) ? 'EXPIRED' : 'WAITING'; run.block_reason = hasExpired(run, now) ? 'WINDOW_EXPIRED' : null;
  run.repair_receipt_ref = id(evidence.receipt_ref, 'REPAIR_RECEIPT');
  run.revision += 1; run.control_epoch += 1;
  const result = { receipt_id: run.repair_receipt_ref, run: copy(run) };
  state.events.push({ type: 'LEGACY_REPAIR_VERIFIED', run_id: run.run_id, receipt_ref: run.repair_receipt_ref, accepted_at: now });
  return finish(state, result);
}

export function validateSources(mission, sources = []) {
  if (!Array.isArray(sources)) fail('INVALID_SOURCE_BINDINGS', 400);
  const allowed = new Set(mission.source_scope.map(s => typeof s === 'string' ? s : s.source_id));
  const seen = new Map();
  for (const source of sources) {
    id(source.source_id, 'SOURCE_ID');
    if (!allowed.has(source.source_id)) fail('SOURCE_SCOPE_NOT_AUTHORIZED', 403);
    if (source.available === false) fail('SOURCE_UNAVAILABLE_TO_EXECUTOR');
    if (source.hash_algorithm !== 'sha256' || !/^[a-f0-9]{64}$/.test(source.digest ?? '') || !source.provider || !source.revision || !source.role || !source.privacy_class || !Object.hasOwn(source, 'allowed_export') || !source.retrieved_at) fail('SOURCE_BINDING_INCOMPLETE');
    if (seen.has(source.source_id) && seen.get(source.source_id) !== source.digest) fail('SOURCE_HASH_CONFLICT');
    seen.set(source.source_id, source.digest);
  }
  for (const required of mission.source_requirements) {
    const sourceId = typeof required === 'string' ? required : required.source_id;
    if (!seen.has(sourceId)) fail('SOURCE_UNAVAILABLE_TO_EXECUTOR');
    if (typeof required === 'object' && required.digest && required.digest !== seen.get(sourceId)) fail('SOURCE_HASH_CONFLICT');
  }
  return { sources: copy(sources), source_set_hash: digest(sources) };
}

export function grantWork(previous, request, ctx) {
  const now = worker(ctx), state = copy(previous);
  const normalized = normalizeIdentities(request, { requirePermit: false });
  const run = getRun(state, request.run_id);
  if (run.run_kind !== 'NEW_WL' || run.lab_id !== normalized.lab_id) fail('LAB_SCOPE_CONFLICT', 403);
  if (!run.worker_binding?.verified || run.worker_binding.worker_id !== ctx.actor.id) fail('WRONG_WORKER', 403);
  const mission = state.missions[run.mission_id];
  if (mission.frozen_hash !== missionDigest(mission)) fail('FROZEN_MISSION_CONFLICT');
  const requestedTrigger = request.trigger_kind ?? 'HOURLY_FALLBACK';
  if (!['EVENT_TRIGGERED', 'HOURLY_FALLBACK', 'MANUAL', 'HEARTBEAT', 'PROJECTION'].includes(requestedTrigger)) fail('INVALID_TRIGGER_KIND', 400);
  const cap = ctx.capabilities ?? {};
  const supportedSource = ['GMAIL', 'SLACK', 'GITHUB_PULL_REQUEST'].includes(cap.event_source);
  const capTime = Date.parse(cap.event_capability_observed_at);
  const verifiedEvent = cap.event_trigger_verified === true && supportedSource && cap.event_capability_receipt_ref && Number.isFinite(capTime) && capTime <= Date.parse(now) && Date.parse(now) - capTime <= 86400000;
  const actualTrigger = requestedTrigger === 'EVENT_TRIGGERED' && !verifiedEvent ? 'HOURLY_FALLBACK' : requestedTrigger;
  const workId = id(request.work_item_id, 'WORK_ITEM_ID');
  const key = digest({ mission_id: mission.mission_id, mission_revision: mission.revision, lab_id: run.lab_id, run_id: run.run_id, work_item_id: workId });
  const existing = state.work[key];
  if (existing) {
    if ((request.expected_parent ?? null) !== existing.expected_parent) fail('ORIGINAL_PARENT_CONFLICT');
    const trigger = id(request.trigger_id, 'TRIGGER_ID');
    if (!existing.trigger_ids.includes(trigger)) { existing.trigger_ids.push(trigger); return finish(state, { ...copy(existing), duplicate: true }); }
    return { state: previous, result: { ...copy(existing), duplicate: true } };
  }
  if (request.trigger_kind === 'HEARTBEAT' || request.trigger_kind === 'PROJECTION') fail('NON_RESEARCH_TRIGGER');
  requireGate(state, request, ctx, now);
  const eligibility = run.eligible_work[workId];
  if (!eligibility) fail('WORK_ITEM_NOT_ADMITTED', 403);
  if ((request.expected_parent ?? null) !== eligibility.expected_parent || eligibility.expected_parent !== run.research_head) fail('PARENT_CONFLICT');
  const sourceBinding = validateSources(mission, request.sources ?? []);
  const permit = `permit:${key}`;
  const work = {
    logical_work_key: key, work_item_id: workId, mission_id: mission.mission_id, mission_revision: mission.revision,
    mission_hash: mission.frozen_hash, lab_id: run.lab_id, run_id: run.run_id, turn_permit_id: permit,
    expected_parent: eligibility.expected_parent, execution_grant: run.execution_grant,
    trigger_ids: [id(request.trigger_id, 'TRIGGER_ID')], trigger_kind: actualTrigger,
    requested_trigger_kind: requestedTrigger,
    event_capability_receipt_ref: verifiedEvent ? cap.event_capability_receipt_ref : null,
    event_fast_path_status: requestedTrigger === 'EVENT_TRIGGERED' ? verifiedEvent ? 'VERIFIED_BINDING' : 'BLOCKED_UNVERIFIED_BINDING' : 'NOT_USED',
    source_binding: sourceBinding, granted_at: now, status: 'GRANTED', attempts: {}, accepted: null,
  };
  state.work[key] = work; state.permits[permit] = key;
  return finish(state, copy(work));
}
function getWork(state, request) {
  const norm = normalizeIdentities(request), key = state.permits[norm.turn_permit_id];
  const work = key && state.work[key]; if (!work) fail('PERMIT_NOT_FOUND', 404);
  if (work.lab_id !== norm.lab_id || work.run_id !== request.run_id) fail('PERMIT_SCOPE_CONFLICT', 403);
  return work;
}

export function beginAttempt(previous, request, ctx) {
  const now = worker(ctx), state = copy(previous), work = getWork(state, request);
  const run = requireGate(state, { ...request, execution_grant: work.execution_grant }, ctx, now);
  if (work.status === 'ACCEPTED') fail('PERMIT_CONSUMED');
  if (work.status === 'UNKNOWN_EFFECT') fail('RECONCILIATION_REQUIRED');
  const attemptId = id(request.attempt_id, 'ATTEMPT_ID');
  if (work.attempts[attemptId]) return { state: previous, result: copy(work.attempts[attemptId]) };
  if (Object.values(work.attempts).some(a => a.status === 'STARTED')) fail('ATTEMPT_IN_FLIGHT');
  const maxAttempts = ctx.capabilities?.max_attempts_per_work ?? 3;
  if (Object.keys(work.attempts).length >= maxAttempts) fail('ATTEMPT_QUOTA_EXHAUSTED');
  const attempt = { attempt_id: attemptId, worker_id: ctx.actor.id, started_at: now, status: 'STARTED', control_epoch: run.control_epoch, revision: run.revision, execution_grant: run.execution_grant, outcome: null };
  work.attempts[attemptId] = attempt; work.status = 'IN_FLIGHT';
  state.runs[run.run_id].counters.generation_attempts += 1;
  state.missions[work.mission_id].status = 'executing_observed';
  return finish(state, copy(attempt));
}

/** Recording a late result is passive evidence, never permission to continue. */
export function recordOutcome(previous, request, ctx) {
  const now = worker(ctx), state = copy(previous), work = getWork(state, request);
  const attempt = work.attempts[id(request.attempt_id, 'ATTEMPT_ID')];
  if (!attempt || attempt.worker_id !== ctx.actor.id) fail('ATTEMPT_NOT_FOUND', 404);
  const outcome = request.outcome;
  if (!outcome || !['KNOWN_SUCCESS', 'KNOWN_FAILURE', 'UNKNOWN_EFFECT', 'NO_EFFECT'].includes(outcome.status)) fail('INVALID_OUTCOME', 400);
  const hash = digest(outcome);
  if (attempt.outcome_hash === hash) return { state: previous, result: copy(attempt) };
  if (attempt.outcome && attempt.status !== 'UNKNOWN_EFFECT') fail('OUTCOME_CONFLICT');
  if (attempt.status === 'UNKNOWN_EFFECT' && (!ctx.capabilities?.reconciliation_verified || !ctx.capabilities?.reconciliation_receipt_ref)) fail('RECONCILIATION_REQUIRED', 403);
  if (outcome.status === 'KNOWN_SUCCESS' && !outcome.receipt_ref) fail('OUTCOME_RECEIPT_REQUIRED');
  attempt.outcome = copy(outcome); attempt.outcome_hash = hash; attempt.status = outcome.status; attempt.recorded_at = now;
  if (ctx.capabilities?.reconciliation_receipt_ref) attempt.reconciliation_receipt_ref = ctx.capabilities.reconciliation_receipt_ref;
  if (work.status !== 'ACCEPTED') work.status = outcome.status === 'UNKNOWN_EFFECT' ? 'UNKNOWN_EFFECT' : 'CANDIDATE';
  const run = getRun(state, work.run_id);
  attempt.passive_only = !effectGate(state, { run_id: run.run_id, expected_revision: attempt.revision, control_epoch: attempt.control_epoch, execution_grant: attempt.execution_grant, worker_id: ctx.actor.id }, now).ok;
  return finish(state, copy(attempt));
}

export function missionGuard(mission, result) {
  if (!mission || !result) return { ok: false, code: 'INCOMPLETE_TARGET' };
  const target = mission.target_artifact;
  const artifacts = result.artifacts ?? [];
  const artifact = artifacts.find(a => a.kind === target.kind && typeof a.artifact_id === 'string' && /^[a-f0-9]{64}$/.test(a.digest ?? '') && a.receipt_ref && (!target.name || a.name === target.name));
  if (!artifact) return { ok: false, code: 'INCOMPLETE_TARGET' };
  const tests = result.tests ?? [];
  for (const criterion of mission.success_criteria ?? []) {
    const criterionId = typeof criterion === 'string' ? criterion : criterion.id;
    if (!tests.some(t => t.criterion_id === criterionId && t.status === 'PASS' && t.receipt_ref)) return { ok: false, code: 'SUCCESS_TEST_UNVERIFIED' };
  }
  if (mission.success_test) {
    const testId = typeof mission.success_test === 'string' ? mission.success_test : mission.success_test.id;
    if (!testId || !tests.some(t => (t.test_id === testId || t.criterion_id === testId) && t.status === 'PASS' && t.receipt_ref)) return { ok: false, code: 'SUCCESS_TEST_UNVERIFIED' };
  }
  return { ok: true, code: 'TARGET_VERIFIED', artifact_id: artifact.artifact_id };
}
function patchState(current, patch) {
  if (!patch || typeof patch !== 'object' || !patch.set || Array.isArray(patch.set) || !Array.isArray(patch.remove ?? [])) fail('INVALID_REPLAY_PATCH', 400);
  const next = copy(current);
  for (const key of patch.remove ?? []) { id(key, 'PATCH_KEY'); delete next[key]; }
  for (const [key, value] of Object.entries(patch.set)) { id(key, 'PATCH_KEY'); next[key] = copy(value); }
  return next;
}
export function admitSuccessor(previous, request, ctx) {
  const now = worker(ctx), state = copy(previous), work = getWork(state, request);
  const payloadHash = digest({ patch: request.patch, result: request.result });
  if (work.accepted) {
    if (work.accepted.payload_hash !== payloadHash) fail('PERMIT_CONSUMED_DIFFERENT_RESULT');
    return { state: previous, result: { ...copy(work.accepted), duplicate: true } };
  }
  const run = requireGate(state, { ...request, execution_grant: work.execution_grant, effect: 'COMMIT' }, ctx, now);
  const attempt = work.attempts[request.attempt_id];
  if (!attempt || attempt.worker_id !== ctx.actor.id || attempt.status !== 'KNOWN_SUCCESS') fail('SUCCESSFUL_ATTEMPT_REQUIRED');
  if (attempt.control_epoch !== run.control_epoch || attempt.revision !== run.revision) fail('STALE_ATTEMPT_CONTROL');
  if (work.expected_parent !== run.research_head) fail('PARENT_CONFLICT');
  if (!ctx.capabilities?.artifact_receipts_verified) fail('ARTIFACT_READBACK_UNVERIFIED', 403);
  const mission = state.missions[work.mission_id];
  if (mission.frozen_hash !== work.mission_hash || mission.frozen_hash !== missionDigest(mission)) fail('FROZEN_MISSION_CONFLICT');
  const guard = missionGuard(mission, request.result);
  if (request.result.complete && !guard.ok) fail(guard.code);
  const research = state.research[run.run_id], next = patchState(research.current, request.patch);
  const stateHash = digest(next), eventId = `event:${work.turn_permit_id}`;
  const receipt = { event_id: eventId, run_id: run.run_id, mission_id: mission.mission_id, lab_id: run.lab_id,
    turn_permit_id: work.turn_permit_id, attempt_id: request.attempt_id, parent: work.expected_parent,
    state_hash: stateHash, previous_state_hash: digest(research.current), patch: copy(request.patch), patch_hash: digest(request.patch),
    result: copy(request.result), result_hash: digest(request.result), payload_hash: payloadHash,
    source_set_hash: work.source_binding.source_set_hash, mission_hash: mission.frozen_hash,
    accepted_at: now, guard, control_epoch: run.control_epoch, execution_grant: run.execution_grant,
  };
  research.current = next; research.events.push(copy(receipt));
  work.accepted = copy(receipt); work.status = 'ACCEPTED';
  const liveRun = state.runs[run.run_id]; liveRun.research_head = eventId;
  liveRun.counters.accepted_turns += 1; liveRun.counters.material_effects += 1;
  liveRun.last_activity_at = now; liveRun.last_receipt_ref = eventId;
  liveRun.status = request.result.complete ? 'COMPLETED' : 'WAITING';
  if (request.result.complete) { liveRun.completed_at = now; liveRun.execution_grant += 1; liveRun.revision += 1; liveRun.control_epoch += 1; }
  mission.status = request.result.complete ? 'result' : 'waiting';
  return finish(state, { ...receipt, duplicate: false });
}

/** Restores accepted bytes without any generation or external effects. */
export function replay(state, runId) {
  const research = state.research[id(runId, 'RUN_ID')]; if (!research) fail('RESEARCH_NOT_FOUND', 404);
  let restored = copy(research.checkpoint), parent = null;
  for (const event of research.events) {
    if (event.parent !== parent || event.previous_state_hash !== digest(restored) || event.patch_hash !== digest(event.patch) || event.result_hash !== digest(event.result)) fail('REPLAY_INTEGRITY_FAILURE');
    restored = patchState(restored, event.patch);
    if (event.state_hash !== digest(restored)) fail('REPLAY_INTEGRITY_FAILURE');
    parent = event.event_id;
  }
  if (digest(restored) !== digest(research.current) || getRun(state, runId).research_head !== parent) fail('REPLAY_INTEGRITY_FAILURE');
  return { state: restored, state_hash: digest(restored), event_count: research.events.length, model_calls: 0 };
}

export function reconcileExpired(previous, ctx) {
  const now = worker(ctx), state = copy(previous), expired = [];
  for (const run of Object.values(state.runs)) {
    const before = run.status; expire(run, now);
    if (before !== run.status) expired.push(run.run_id);
  }
  return expired.length ? finish(state, { expired, measured_at: now }) : { state: previous, result: { expired, measured_at: now } };
}
