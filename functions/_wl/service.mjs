import { applyCommand, initialState, reconcileExpired, replay, CoreError } from './core.mjs';
import { createMemoryService, memoryDigest } from './memory.mjs';
import { checkOrigin, errorResponse, json, readJSON } from './http.mjs';

export const ACCOUNT_IDS = ['bd-owned-gmail-bdsim', 'bd-owned-outlook-llm'];
export const CAPABILITIES = Object.freeze({
  create_new_wl: true, create_email_dialogue: true,
  email_recipients: [ { id: ACCOUNT_IDS[0], label: 'BD · Gmail' }, { id: ACCOUNT_IDS[1], label: 'BD · Outlook' } ],
  management_mode: 'OWNER_AUTHENTICATED',
  native_worker: 'BLOCKED_SECURE_UNATTENDED_IDENTITY',
  email_sender: 'BLOCKED_WORKER_BINDING', legacy_worker: 'BLOCKED_WORKER_BINDING',
  event_fast_path: 'BLOCKED_RUNTIME_SIGNAL_UNSUPPORTED',
  history_sync: 'AUTO_HISTORY_SYNC_NOT_ACTIVATED',
  effect_enforcement: 'SINK_ENFORCED_FOR_MANAGED_STATE_ONLY',
  legacy_email_effect_enforcement: 'NOT_BOUND',
  new_run_note: 'Durable drafts and lifecycle are available. No model or email sender is activated.'
});
const ownerContext = now => ({ actor: { id: 'BD', authenticated: true, role: 'owner', auth_ref: 'WL_OWNER_PASSWORD_V1' }, now, capabilities: { approved_recipient_ids: ACCOUNT_IDS } });
function replaceRoot(draft, next) {
  if (draft === next) return;
  const store = draft._store;
  for (const key of Object.keys(draft)) delete draft[key];
  Object.assign(draft, next); draft._store = store;
}
function actions(run) {
  if ((run.existing || run.run_kind === 'LEGACY_WL') && !run.worker_binding?.verified) return [];
  if (run.status === 'DELETED') return ['RESTORE_FROM_ARCHIVE'];
  const result = ['STOP', 'SOFT_DELETE'];
  if (run.status === 'DRAFT') result.unshift('START');
  if (['QUEUED', 'ACTIVE', 'WAITING', 'VERIFYING'].includes(run.status)) result.unshift('PAUSE');
  if (run.status === 'PAUSED') result.unshift('RESUME');
  if (run.managed_window_started_at) result.push('PROLONG');
  if (run.managed_window_started_at && ['PAUSED', 'STOPPED', 'EXPIRED', 'COMPLETED', 'BLOCKED'].includes(run.status)) result.push('PROLONG_AND_RESUME');
  return result;
}

// Mailbox snapshots are derived, not a replacement ledger. Missing measurement
// time remains missing even when an older producer wrote a fresh JSON file.
export function safeObservatory(snapshot, now) {
  const email = snapshot?.observatory?.email;
  const measured = snapshot?.measured_at || snapshot?.observatory?.measured_at || null;
  const refresh = Number(snapshot?.refresh_seconds) > 0 ? Number(snapshot.refresh_seconds) : 3600;
  const age = measured ? (Date.parse(now) - Date.parse(measured)) / 1000 : null;
  const coverage = snapshot?.source_coverage || snapshot?.observatory?.source_coverage || null;
  let freshness = !snapshot ? 'SOURCE_BLOCKED' : !measured || !Number.isFinite(age) || age < -180 ? 'MEASUREMENT_UNVERIFIED' : age > 2 * refresh ? 'STALE' : coverage?.complete === true ? 'FRESH' : 'PARTIAL';
  const integer = v => Number.isSafeInteger(v) && v >= 0 ? v : null;
  const runs = ['A', 'B'].map(label => ({
    run_id: `PREAI8-20260912-${label}`, label,
    logical_messages: integer(email?.runs?.[label]?.messages),
    highest_valid_turn: integer(snapshot?.email_plane?.[label]?.verified_turn),
    last_activity_at: snapshot?.email_plane?.[label]?.updated_at || null,
    last_measured_at: measured, freshness
  }));
  return { schema: 'wl.cockpit.email-observatory.v1', generated_at: snapshot?.generated_at || null,
    measured_at: measured, fetched_at: now, refresh_seconds: refresh, stale_after_seconds: 2 * refresh,
    freshness, source_coverage: coverage ? { complete: coverage.complete === true } : { complete: false },
    logical_messages: integer(email?.total_messages), runs, privacy: 'AGGREGATES_ONLY_NO_EMAIL_BODIES_OR_ADDRESSES' };
}
export function externalCards(observatory) {
  return [
    { run_id: 'WL-RHP11-20260912', run_kind: 'LEGACY_WL', title: 'Legacy WL · RHP11', block_reason: 'WORKER_BINDING_REQUIRED', counters: { accepted_turns: null }, last_activity_at: null, last_measured_at: null, source_frontier: null },
    ...observatory.runs.map(run => ({ ...run, run_kind: 'EMAIL_DIALOGUE', title: `preAI8 · ${run.label}`, block_reason: 'WORKER_BINDING_REQUIRED', counters: { logical_messages: run.logical_messages }, source_frontier: run.highest_valid_turn }))
  ].map(run => ({ ...run, status: 'BLOCKED', revision: 0, control_epoch: 0, owner: 'BD', existing: true,
    projection_only: true, original_worker_status: 'OUTSIDE_MANAGED_CONTROL',
    managed_window_started_at: null, expires_at: null, started_at: null, allowed_actions: [],
    note: 'Existing worker has not been migrated. This card cannot stop or resume it.' }));
}

export function createManagedHandler({ authenticate, makeStore, getSnapshot = async () => null, now = () => new Date().toISOString() }) {
  return async req => {
    let store;
    try {
      if (!['GET', 'POST'].includes(req.method)) return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
      checkOrigin(req);
      if (!await authenticate(req)) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
      store = await makeStore(req);
      const at = now(), context = ownerContext(at);
      if (req.method === 'GET') {
        await store.mutate(draft => { const reduced = reconcileExpired(draft, context); replaceRoot(draft, reduced.state); return reduced.result; }, { safety: true });
        const state = await store.read();
        const query = new URL(req.url).searchParams;
        if (query.has('command_id')) {
          const receipt = state.commands[query.get('command_id')];
          return receipt ? json({ ok: true, receipt }) : json({ ok: false, error: 'COMMAND_NOT_FOUND' }, 404);
        }
        if (query.has('run_id')) {
          const run = state.runs[query.get('run_id')];
          if (!run) return json({ ok: false, error: 'RUN_NOT_FOUND' }, 404);
          const research = state.research[run.run_id];
          return json({ ok: true, server_time: at, run: { ...run, allowed_actions: actions(run) }, mission: state.missions[run.mission_id] || null,
            accepted_events: research?.events || [], replay: research ? replay(state, run.run_id) : null,
            receipts: Object.values(state.commands).filter(x => x.run_id === run.run_id) });
        }
        const observatory = safeObservatory(await getSnapshot(req), at);
        const existing = externalCards(observatory).filter(run => !state.runs[run.run_id]);
        const memory = state.memory;
        const availableMemorySources = Object.keys(memory?.sources || {}).filter(ref => !memory?.revocations?.[ref]);
        return json({ ok: true, schema: 'wl.cockpit.v1', server_time: at, revision: state.revision,
          runs: [...Object.values(state.runs).map(run => ({ ...run, allowed_actions: actions(run) })), ...existing],
          capabilities: CAPABILITIES, observatory,
          memory: { source_count: availableMemorySources.length, captured_scope: 'EXPLICIT_OWNER_IMPORT_ONLY', history_sync: 'AUTO_HISTORY_SYNC_NOT_ACTIVATED', cold_start: 'NOT_VERIFIED', index: 'FILE_FIRST' },
          health: { last_projection_refresh_at: at, last_worker_invocation_at: null, last_runtime_pulse_at: null, last_control_observation_at: at },
          recent_receipts: Object.values(state.commands).slice(-30) });
      }
      const body = await readJSON(req);
      const command = { command_id: body.command_id, run_id: body.run_id, action: body.action, expected_revision: body.expected_revision,
        control_epoch: body.control_epoch ?? body.expected_control_epoch, parameters: body.parameters || {} };
      if (Object.hasOwn(body, 'control_epoch') && Object.hasOwn(body, 'expected_control_epoch') && body.control_epoch !== body.expected_control_epoch) throw new CoreError('CONTROL_EPOCH_ALIAS_CONFLICT', 400);
      if (!['CREATE', 'START', 'PAUSE', 'RESUME', 'STOP', 'PROLONG', 'PROLONG_AND_RESUME', 'SOFT_DELETE', 'RESTORE_FROM_ARCHIVE', 'ADMIT_WORK'].includes(command.action)) throw new CoreError('ACTION_NOT_ALLOWED', 400);
      if (command.parameters.existing || command.parameters.run_kind === 'LEGACY_WL') throw new CoreError('WORKER_BINDING_REQUIRED', 409);
      if (['WL-RHP11-20260912', 'PREAI8-20260912-A', 'PREAI8-20260912-B'].includes(command.run_id)) throw new CoreError('WORKER_BINDING_REQUIRED', 409);
      const receipt = await store.mutate(draft => {
        const reduced = applyCommand(draft, command, context); replaceRoot(draft, reduced.state); return reduced.result;
      }, { safety: ['STOP', 'PAUSE', 'SOFT_DELETE'].includes(command.action) });
      return json({ ok: true, server_time: at, receipt });
    } catch (error) { return errorResponse(error); }
  };
}

export function createMemoryHandler({ authenticate, makeStore, now = () => new Date().toISOString() }) {
  return async req => {
    try {
      if (!['GET', 'POST'].includes(req.method)) return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
      checkOrigin(req);
      if (!await authenticate(req)) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
      const store = await makeStore(req);
      // Only explicit owner-authenticated requests may import this assigned project.
      // This endpoint is not a scheduled history crawler and grants no worker rights.
      const context = { actor_id: 'BD', authenticated: true };
      let authRoot = await store.read(), safetyOperation = false;
      const scopedStore = {
        async read() { authRoot = await store.read(); return authRoot; },
        async mutate(fn) { return store.mutate(draft => { authRoot = draft; return fn(draft); }, { safety: safetyOperation }); }
      };
      const authorize = (ctx, request) => {
        if (ctx.authenticated !== true) return false;
        if (!['status', 'status_source', 'revoke'].includes(request.operation) && authRoot.global_control?.status !== 'ACTIVE') return false;
        if (['status', 'rebuild'].includes(request.operation)) return true;
        if (request.project_id !== 'AI8 Wake Lab') return false;
        if (!request.target) return true; // owner-only project ingest/status/revoke
        const target = request.target, run = authRoot.runs[target.run_id], mission = authRoot.missions[target.mission_id];
        if (!run || !mission || run.mission_id !== mission.mission_id || run.lab_id !== target.lab_id ||
          ['PAUSED', 'STOPPED', 'DELETED', 'EXPIRED'].includes(run.status) || (run.expires_at && Date.parse(now()) >= Date.parse(run.expires_at))) return false;
        const expected = ctx.exposure_control;
        if (!expected || expected.run_id !== run.run_id || expected.revision !== run.revision ||
          expected.control_epoch !== run.control_epoch || expected.execution_grant !== run.execution_grant ||
          expected.global_digest !== memoryDigest(authRoot.global_control)) return false;
        const scope = new Set(mission.source_scope.map(source => typeof source === 'string' ? source : source.source_ref || source.source_id));
        return request.source_ref ? scope.has(request.source_ref) : scope.size > 0;
      };
      const service = createMemoryService({ store: scopedStore, now, authorize });
      if (req.method === 'GET') return json({ ok: true, memory: await service.status(context) });
      const body = await readJSON(req);
      if (!['ingest', 'retrieve', 'revoke', 'rebuildIndex'].includes(body.action)) throw new CoreError('ACTION_NOT_ALLOWED', 400);
      safetyOperation = body.action === 'revoke';
      if (body.action === 'ingest') {
        const source = body.parameters?.source;
        // This HTTP adapter observes only an authenticated owner-provided export.
        // A client label cannot manufacture provider/history observations.
        if (!source || source.acquisition_mode !== 'HUMAN_ASSISTED_EXPORT_IMPORT' ||
          source.source_identity_kind !== 'BRIDGE_SCOPED' || source.provider_session_id !== null ||
          source.coverage?.mode === 'FULL_AT_SNAPSHOT' || source.coverage?.complete_inventory !== false ||
          source.source_provider !== 'OWNER_PROVIDED_EXPORT' || source.execution_surface !== 'WL_BD_OWNER_IMPORT_V1' ||
          source.actor_identity_ref !== 'WL_OWNER_PASSWORD_V1' ||
          source.project_membership_evidence_ref !== 'OWNER_EXPLICIT_AI8_WAKE_LAB_IMPORT') throw new CoreError('OWNER_IMPORT_PROVENANCE_REQUIRED', 403);
      }
      // Research exposure requires a real stored target with explicit source scope;
      // a client-created target label does not grant cross-lab memory access.
      if (body.action === 'retrieve') {
        const current = await store.read(), target = body.parameters?.target;
        const run = current.runs[target?.run_id], mission = current.missions[target?.mission_id];
        if (!run || !mission || run.mission_id !== mission.mission_id || run.lab_id !== target.lab_id || !mission.source_scope.length || ['PAUSED', 'STOPPED', 'DELETED', 'EXPIRED'].includes(run.status)) throw new CoreError('MEMORY_TARGET_SCOPE_DENIED', 403);
        // This is a new owner-authenticated exposure request, never an old
        // approval resurrected from capsule or client-provided prose.
        target.exposure_ref = 'owner-exposure:' + memoryDigest({ actor: 'BD', retrieval_id: body.parameters.retrieval_id,
          project_id: target.project_id, mission_id: target.mission_id, lab_id: target.lab_id, run_id: target.run_id,
          mission_hash: mission.frozen_hash, control_epoch: run.control_epoch });
        context.target = target;
        context.exposure_control = { run_id: run.run_id, revision: run.revision, control_epoch: run.control_epoch,
          execution_grant: run.execution_grant, global_digest: memoryDigest(current.global_control) };
      }
      const result = body.action === 'rebuildIndex' ? await service.rebuildIndex(context) : await service[body.action](body.parameters, context);
      return json({ ok: true, result });
    } catch (error) { return errorResponse(error); }
  };
}

export { initialState };
