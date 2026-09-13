import { effectGate } from './core.mjs';
import { EMAIL_PROTOCOL, buildEmailObservatory, emailEffectGate, reconcileMailboxMessages,
  reduceEmailDispatch, selectEmailWork, serializeEmailMetadata } from './email.mjs';

const ACTIVE = new Set(['QUEUED', 'ACTIVE', 'WAITING', 'VERIFYING']);
const PENDING = new Set(['RESERVED', 'SENDING', 'UNCERTAIN', 'SENT_PENDING_DELIVERY']);
const token = x => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(x);
const blocked = (code, extra = {}) => ({ ok: false, status: 'BLOCKED', code, live_send_claimed: false, ...extra });

/** Server-only adapter. The factory does not schedule, register or replace a worker.
 * `store` is the managed atomic CAS store. All dependencies/config are supplied by
 * the authenticated host, never from a request or model/mail body.
 *
 * Transport contract:
 *   readMailboxMetadata({run_id,account_ids}) -> {records,coverage}
 *   prepareMessage({run,plan,metadata}) -> {body:string}
 * Preparation in this adapter is DETERMINISTIC_NO_MODEL and NO_PAID only.
 * An LLM/RHP generator is a separate unbound capability; it cannot be hidden in
 * prepareMessage. Its future adapter requires its own authoritative effect gate.
 *   send({sender_account_id,recipient_account_id,subject,body,metadata,
 *         dispatch_key,permit,authorizeEffect})
 * send MUST await authorizeEffect once immediately before its one provider send.
 * No automatic provider retry is allowed; a lost response is reconciled by reads.
 * Transport success fields are not delivery evidence.
 */
export function createEmailWorker({ store, binding, transport, permitAuthority,
  recipientAllowlist = {}, dialogueConfigs = {}, now = () => new Date().toISOString() } = {}) {
  const bindingValid = () => binding?.enabled === true && binding.sole_worker_verified === true
    && token(binding.worker_id) && binding.worker_id === binding.existing_worker_id
    && typeof binding.evidence_ref === 'string' && binding.evidence_ref.length > 0
    && binding.transport_verified === true && binding.sink_gate_verified === true
    && typeof store?.read === 'function' && typeof store?.mutate === 'function'
    && ['readMailboxMetadata', 'prepareMessage', 'send'].every(key => typeof transport?.[key] === 'function')
    && typeof permitAuthority?.issue === 'function' && typeof permitAuthority?.verify === 'function';

  function view(run) {
    const cfg = dialogueConfigs[run.run_id];
    const ids = run.recipient_ids;
    if (!cfg || !Number.isSafeInteger(cfg.first_turn) || cfg.first_turn < 0
      || !Array.isArray(ids) || ids.length !== 2 || new Set(ids).size !== 2) return null;
    const accounts = ids.map(id => recipientAllowlist[id]);
    if (ids.some(id => !token(id)) || accounts.some(a => a?.bd_owned !== true || a.enabled !== true || !token(a.provider) || !token(a.role))) return null;
    return { ...run, status: ACTIVE.has(run.status) ? 'ACTIVE' : run.status,
      lifecycle_revision: run.revision, first_turn: cfg.first_turn,
      roles: accounts.map(a => a.role), account_ids: ids,
      required_sources: accounts.map((a,i) => `${a.provider}:${ids[i]}`),
      cadence_seconds: cfg.cadence_seconds ?? 3600, mailbox_max_age_seconds: cfg.mailbox_max_age_seconds ?? 300,
      live_send_capability: bindingValid() ? 'VERIFIED' : 'UNVERIFIED',
      has_existing_history: run.existing === true };
  }

  function coreGate(state, run, captured, recipientId, at) {
    return effectGate(state, { run_id: run.run_id, expected_revision: captured.revision,
      control_epoch: captured.control_epoch, execution_grant: captured.execution_grant,
      worker_id: binding.worker_id, effect: 'EMAIL_SEND', recipient_id: recipientId }, at);
  }

  async function measure(run) {
    const raw = await transport.readMailboxMetadata({ run_id: run.run_id, account_ids: [...run.recipient_ids] });
    const cfg = view(run);
    if (!cfg) throw new Error('DIALOGUE_CONFIG_UNVERIFIED');
    const at = now();
    const reconciliation = reconcileMailboxMessages(raw?.records, { knownRuns: [cfg], coverage: raw?.coverage, now: at });
    if (!reconciliation.ok) throw new Error('MAILBOX_METADATA_INVALID');
    return { reconciliation, observatory: buildEmailObservatory({ reconciliation,
      measuredAt: at, generatedAt: at }) };
  }

  function updateProjection(draft, runId, measured) {
    draft.email_observatory ||= {};
    draft.email_observatory[runId] = measured.observatory;
    // This plane remains disjoint from draft.research and session memory.
    const run = draft.runs[runId];
    if (run) {
      const metrics = measured.observatory.runs?.[0];
      run.last_measured_at = metrics?.measured_at ?? null;
      if (metrics?.source_coverage?.status === 'COMPLETE') {
        run.counters ||= {};
        run.counters.logical_messages = metrics.logical_message_count;
      }
    }
  }

  async function advanceCursor(cursor) {
    await store.mutate(draft => {
      draft.email_worker = { ...(draft.email_worker || {}), cursor };
      return { ok: true };
    });
  }

  async function reconcilePending(runId, measured, dispatchKey, { markUncertain = false, nextCursor } = {}) {
    return store.mutate(draft => {
      if (nextCursor !== undefined) draft.email_worker = { ...(draft.email_worker || {}), cursor: nextCursor };
      updateProjection(draft, runId, measured);
      let ledger = draft.email_dispatch || {};
      const entry = ledger.dispatches?.[`${runId}:${dispatchKey}`];
      if (!entry) return blocked('DISPATCH_NOT_RESERVED');
      if (markUncertain && entry.status === 'SENDING') {
        const changed = reduceEmailDispatch(ledger, { type: 'UNCERTAIN', run_id: runId, dispatch_key: dispatchKey, at: now() });
        ledger = changed.state;
      }
      const runEvidence = measured.reconciliation.runs.find(r => r.run_id === runId);
      const found = !runEvidence?.anomalies.length && runEvidence?.messages.find(m => m.dispatch_key === dispatchKey && m.sent && !m.draft_only);
      if (found) {
        const proof = { run_id: runId, dispatch_key: dispatchKey, sent: found.sent, delivered: found.delivered,
          draft_only: found.draft_only, source_ids: found.source_ids, measured_at: measured.reconciliation.measured_at };
        const changed = reduceEmailDispatch(ledger, { type: 'RECONCILE', run_id: runId, dispatch_key: dispatchKey,
          at: now(), mailbox_evidence: proof });
        ledger = changed.state; draft.email_dispatch = ledger;
        return { ...changed.result, run_id: runId, dispatch_key: dispatchKey,
          status: changed.result.ok ? changed.result.status : 'UNKNOWN_EFFECT', live_send_claimed: false };
      }
      draft.email_dispatch = ledger;
      return { ok: false, status: 'UNKNOWN_EFFECT', code: 'POSITIVE_MAILBOX_READBACK_REQUIRED',
        run_id: runId, dispatch_key: dispatchKey, passive_only: true, live_send_claimed: false };
    });
  }

  return {
    async tick({ invocation_id, wake_mode = 'hourly' } = {}) {
      if (!bindingValid()) return blocked('EXISTING_SOLE_WORKER_BINDING_REQUIRED');
      if (binding.preparation_mode !== 'DETERMINISTIC_NO_MODEL' || binding.preparation_cost_policy !== 'NO_PAID') {
        return blocked('PREPARATION_CAPABILITY_UNVERIFIED_OR_PAID');
      }
      if (!token(invocation_id) || !['hourly', 'event', 'manual'].includes(wake_mode)) return blocked('INVALID_WORKER_INVOCATION');
      let state;
      try { state = await store.read(); } catch { return blocked('CONTROL_READ_UNAVAILABLE'); }
      const entries = Object.values(state.runs || {}).filter(run => run.run_kind === 'EMAIL_DIALOGUE'
        && run.worker_binding?.verified === true && run.worker_binding.worker_id === binding.worker_id
        && (ACTIVE.has(run.status) || Object.values(state.email_dispatch?.dispatches || {}).some(d => d.run_id === run.run_id && PENDING.has(d.status))))
        .sort((a,b) => a.run_id.localeCompare(b.run_id));
      if (!entries.length) return { ok: true, status: 'IDLE', run_attempts: 0, sends: 0, live_send_claimed: false };
      const cursor = Number.isSafeInteger(state.email_worker?.cursor) ? state.email_worker.cursor : 0;
      const index = ((cursor % entries.length) + entries.length) % entries.length;
      const run = entries[index], cfg = view(run);
      if (!cfg) {
        try { await advanceCursor((index+1)%entries.length); } catch { return blocked('CURSOR_STORAGE_UNAVAILABLE'); }
        return blocked('TRUSTED_DIALOGUE_CONFIG_OR_ACCOUNT_ALLOWLIST_REQUIRED', { run_id: run.run_id });
      }
      let measured;
      try { measured = await measure(run); } catch {
        try { await advanceCursor((index+1)%entries.length); } catch { return blocked('CURSOR_STORAGE_UNAVAILABLE'); }
        return blocked('MAILBOX_READ_UNAVAILABLE', { run_id: run.run_id });
      }
      // Passive reconciliation wins over any new work, including after Stop.
      const pending = Object.values(state.email_dispatch?.dispatches || {}).find(d => d.run_id === run.run_id && PENDING.has(d.status));
      if (pending) {
        try { return { ...await reconcilePending(run.run_id, measured, pending.dispatch_key, { markUncertain: true, nextCursor: (index+1)%entries.length }), run_attempts: 1, sends: 0 }; }
        catch { return blocked('RECONCILIATION_STORAGE_UNAVAILABLE', { run_id: run.run_id }); }
      }
      const at = now();
      const planned = selectEmailWork({ runs: [cfg], reconciliation: measured.reconciliation,
        invocationId: invocation_id, globalCap: 1, now: at,
        lifecycleGate: () => ({ allowed: coreGate(state, run, run, null, at).ok }) });
      const plan = planned.selected?.[0];
      if (!plan) {
        try { await store.mutate(draft => { updateProjection(draft, run.run_id, measured);
          draft.email_worker = { ...(draft.email_worker || {}), cursor: (index+1)%entries.length }; return { ok: true }; }); } catch { return blocked('PROJECTION_STORAGE_UNAVAILABLE'); }
        return blocked(planned.skipped?.[0]?.reason || planned.error || 'NO_ELIGIBLE_EMAIL_WORK', { run_id: run.run_id, run_attempts: 1, sends: 0 });
      }
      const roleIndex = cfg.roles.indexOf(plan.role);
      const senderId = cfg.account_ids[roleIndex], recipientId = cfg.account_ids[1-roleIndex];
      const serialized = serializeEmailMetadata({ protocol: EMAIL_PROTOCOL, run_id: run.run_id,
        turn: plan.turn, role: plan.role, dispatch_key: plan.dispatch_key,
        parent_dispatch_key: plan.parent_dispatch_key, parent_provider_ids: plan.parent_provider_ids,
        original_started_at: run.started_at, managed_window_started_at: run.managed_window_started_at,
        prepared_at: at, expires_at: run.expires_at, worker_invocation_id: invocation_id,
        wake_mode, lifecycle_revision: run.revision });
      if (!serialized.ok) return blocked(serialized.error, { run_id: run.run_id });
      let reservation;
      try {
        reservation = await store.mutate(draft => {
          const current = draft.runs[run.run_id];
          const checked = current && coreGate(draft, current, run, recipientId, now());
          if (!checked?.ok) return blocked(checked?.code || 'RUN_NOT_FOUND');
          const result = reduceEmailDispatch(draft.email_dispatch, { type: 'RESERVE', run_id: run.run_id,
            dispatch_key: plan.dispatch_key, invocation_id, turn: plan.turn,
            parent_dispatch_key: plan.parent_dispatch_key, at: now() });
          if (!result.result.ok || result.result.replay) return { ...result.result, status: result.result.replay ? 'REPLAY_NO_SEND' : 'BLOCKED' };
          draft.email_dispatch = result.state;
          draft.email_worker = { ...(draft.email_worker || {}), cursor: (index+1)%entries.length };
          updateProjection(draft, run.run_id, measured);
          return result.result;
        });
      } catch { return blocked('RESERVATION_STORAGE_UNKNOWN', { run_id: run.run_id, sends: 0 }); }
      if (!reservation.ok || reservation.replay) return { ...reservation, run_id: run.run_id, sends: 0, live_send_claimed: false };
      let permit, prepared;
      try {
        permit = await permitAuthority.issue({ run_id: run.run_id, dispatch_key: plan.dispatch_key,
          worker_id: binding.worker_id, expected_revision: run.revision, control_epoch: run.control_epoch,
          execution_grant: run.execution_grant, effect: 'EMAIL_SEND', recipient_id: recipientId });
        // Permit issuance is asynchronous. STOP/expiry may have won while it was
        // pending. Check current authority again before even deterministic prep.
        const preparationState = await store.read();
        const preparationRun = preparationState.runs?.[run.run_id];
        const preparationGate = preparationRun && coreGate(preparationState, preparationRun, run, recipientId, now());
        if (!preparationGate?.ok) return blocked(preparationGate?.code || 'RUN_NOT_FOUND',
          { run_id: run.run_id, dispatch_key: plan.dispatch_key, sends: 0 });
        prepared = await transport.prepareMessage({ run: structuredClone(run), plan: structuredClone(plan), metadata: serialized.metadata });
      } catch { return blocked('PREPARATION_OR_PERMIT_UNAVAILABLE', { run_id: run.run_id, dispatch_key: plan.dispatch_key, sends: 0 }); }
      if (!permit || !prepared || typeof prepared.body !== 'string' || !prepared.body.trim() || prepared.body.length > 100000
        || Object.keys(prepared).some(key => key !== 'body')) return blocked('INVALID_TRUSTED_PREPARATION', { run_id: run.run_id, sends: 0 });
      let sinkCalls = 0, sinkAllowed = false;
      const authorizeEffect = async () => {
        sinkCalls++;
        if (sinkCalls !== 1) return { allowed: false, code: 'ONE_PROVIDER_SEND_ONLY' };
        const receipt = await store.mutate(draft => {
          const current = draft.runs[run.run_id], currentView = current && view(current);
          if (!currentView) return blocked('RUN_OR_CONFIGURATION_CHANGED');
          const checked = coreGate(draft, current, run, recipientId, now());
          if (!checked.ok) return blocked(checked.code);
          const gate = emailEffectGate({ run: currentView, plan, permit, now: now(), lifecycleGate: () => {
            const verified = permitAuthority.verify({ permit, run: current, plan, worker_id: binding.worker_id,
              recipient_id: recipientId, effect: 'EMAIL_SEND', now: now() });
            return { allowed: verified?.allowed === true && !(verified instanceof Promise) };
          } });
          if (!gate.ok) return blocked(gate.error);
          const changed = reduceEmailDispatch(draft.email_dispatch, { type: 'BEGIN_SEND', run_id: run.run_id,
            dispatch_key: plan.dispatch_key, at: now(), gate_receipt: { allowed: true, dispatch_key: plan.dispatch_key } });
          if (changed.result.ok) draft.email_dispatch = changed.state;
          return changed.result;
        });
        sinkAllowed = receipt.ok === true;
        return { allowed: sinkAllowed, code: receipt.code || receipt.error || 'EMAIL_EFFECT_GATE_PASS' };
      };
      let transportFailed = false;
      try {
        await transport.send({ sender_account_id: senderId, recipient_account_id: recipientId,
          subject: `[AI8-EMAIL:${run.run_id}] ${String(run.title).replace(/[\r\n]/g,' ').slice(0,200)}`,
          body: `${prepared.body}\n\n--- AI8 EMAIL METADATA ---\n${serialized.serialized}\n--- END METADATA ---`,
          metadata: serialized.metadata, dispatch_key: plan.dispatch_key, permit, authorizeEffect });
      } catch { transportFailed = true; }
      // Do not trust a provider-returned success flag, message body or role claim.
      // Actual independent mailbox readback is the only delivery proof.
      let readback;
      try { readback = await measure(run); }
      catch {
        try { await store.mutate(draft => { const changed = reduceEmailDispatch(draft.email_dispatch,
          { type: 'UNCERTAIN', run_id: run.run_id, dispatch_key: plan.dispatch_key, at: now() });
          if (changed.result.ok) draft.email_dispatch = changed.state; return changed.result; }); } catch { /* Persisted SENDING remains a retry fence. */ }
        return { ok: false, status: 'UNKNOWN_EFFECT', code: 'MAILBOX_READBACK_UNAVAILABLE', run_id: run.run_id,
          dispatch_key: plan.dispatch_key, run_attempts: 1, sends: sinkAllowed ? 1 : 0, live_send_claimed: false };
      }
      try {
        const receipt = await reconcilePending(run.run_id, readback, plan.dispatch_key, { markUncertain: transportFailed || sinkAllowed });
        return { ...receipt, run_attempts: 1, sends: sinkAllowed ? 1 : 0,
          sink_gate_checked: sinkCalls === 1 && sinkAllowed, transport_contract_violation: sinkCalls !== 1,
          evidence_class: receipt.status === 'DELIVERED' ? 'ACTUAL_MAILBOX_READBACK' : 'UNPROVEN_DELIVERY' };
      } catch { return { ok: false, status: 'UNKNOWN_EFFECT', code: 'READBACK_STORAGE_UNAVAILABLE',
        run_id: run.run_id, dispatch_key: plan.dispatch_key, sends: sinkAllowed ? 1 : 0, live_send_claimed: false }; }
    }
  };
}
