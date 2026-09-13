/* Injectable native execution adapter. No credentials, scheduler, provider SDK or
 * public route is installed here. Absent verified adapters this is BLOCKED.
 * All external operations occur outside CAS callbacks. */
import { createHash } from 'node:crypto';
import { CoreError, digest, normalizeIdentities, effectGate, grantWork, beginAttempt, recordOutcome, admitSuccessor, replay } from './core.mjs';

const fail = code => { throw new CoreError(code); };
const hashBytes = bytes => createHash('sha256').update(bytes).digest('hex');
function replace(draft, next) {
  if (draft === next) return;
  const metadata = draft._store;
  for (const key of Object.keys(draft)) delete draft[key];
  Object.assign(draft, next);
  if (metadata) draft._store = metadata;
}
function findWork(state, runId, workItemId) {
  return Object.values(state.work).find(work => work.run_id === runId && work.work_item_id === workItemId);
}
function resultCandidate(outcome) {
  const candidate = outcome?.candidate;
  if (!candidate || !candidate.patch || !candidate.result) fail('MODEL_CANDIDATE_UNAVAILABLE');
  return candidate;
}
function roleFor(mission, research) {
  const kind = mission.target_artifact.kind.toLowerCase();
  if (research.events.length && mission.success_criteria.length) return { role: 'Verifier', reason: 'An accepted contribution exists and explicit success tests remain.' };
  if (/prototype|code|html|application|patch/.test(kind)) return { role: 'Builder', reason: 'The frozen target requires a working artifact.' };
  return { role: 'Researcher', reason: 'The frozen target requires source-bound synthesis.' };
}

export function createNativeWorker({ store, now = () => new Date().toISOString(), authenticateWorker, model, resolveSources, verifyResult, reconcileModelEffect } = {}) {
  if (!store?.read || !store?.mutate) fail('ATOMIC_STORE_REQUIRED');
  function clock() {
    const value = now();
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) fail('SERVER_TIME_REQUIRED');
    return new Date(value).toISOString();
  }
  async function reduce(fn) {
    return store.mutate(draft => { const reduced = fn(draft); replace(draft, reduced.state); return reduced.result; });
  }
  function gate(state, run, attempt, actor, at, globalEpoch) {
    if (globalEpoch != null && state.global_control.epoch !== globalEpoch) fail('STALE_GLOBAL_CONTROL_EPOCH');
    const checked = effectGate(state, {
      run_id: run.run_id, expected_revision: attempt?.revision ?? run.revision,
      control_epoch: attempt?.control_epoch ?? run.control_epoch,
      execution_grant: attempt?.execution_grant ?? run.execution_grant,
      worker_id: actor.id, effect: 'RESEARCH',
    }, at);
    if (!checked.ok) fail(checked.code);
  }
  function token(run, work, attempt) {
    return { run_id: run.run_id, lab_id: run.lab_id, turn_permit_id: work.turn_permit_id,
      attempt_id: attempt.attempt_id, expected_revision: attempt.revision, control_epoch: attempt.control_epoch };
  }
  async function checkedSources(mission, run, context, expectedBinding) {
    if (!resolveSources && mission.source_requirements.length) fail('SOURCE_UNAVAILABLE_TO_EXECUTOR');
    const bundle = resolveSources ? await resolveSources({ mission, run, expected_binding: expectedBinding ?? null }, context) : { bindings: [], content: [] };
    if (!Array.isArray(bundle?.bindings) || !Array.isArray(bundle?.content)) fail('SOURCE_ADAPTER_INVALID');
    const allowed = new Set(mission.source_scope.map(s => typeof s === 'string' ? s : s.source_id));
    for (const content of bundle.content) {
      const binding = bundle.bindings.find(b => b.source_id === content.source_id);
      if (!allowed.has(content.source_id) || !binding || typeof content.text !== 'string' || hashBytes(Buffer.from(content.text)) !== binding.digest) fail('SOURCE_CONTENT_HASH_CONFLICT');
    }
    for (const required of mission.source_requirements) {
      const sourceId = typeof required === 'string' ? required : required.source_id;
      if (!bundle.content.some(content => content.source_id === sourceId)) fail('SOURCE_UNAVAILABLE_TO_EXECUTOR');
    }
    return bundle;
  }
  async function checkArtifacts(mission, candidate, attempt, context) {
    if (typeof verifyResult !== 'function') fail('ARTIFACT_VERIFIER_UNAVAILABLE');
    const proof = await verifyResult({ mission, candidate, attempt }, context);
    if (proof?.verified !== true || typeof proof.receipt_ref !== 'string' || !proof.receipt_ref || !Array.isArray(proof.artifacts) || !Array.isArray(proof.tests)) fail('ARTIFACT_READBACK_UNVERIFIED');
    for (const artifact of candidate.result.artifacts ?? []) {
      if (!proof.artifacts.some(a => a.artifact_id === artifact.artifact_id && a.digest === artifact.digest && a.receipt_ref === artifact.receipt_ref)) fail('ARTIFACT_RECEIPT_MISMATCH');
    }
    for (const test of candidate.result.tests ?? []) {
      if (test.status === 'PASS' && !proof.tests.some(t => (t.criterion_id ?? t.test_id) === (test.criterion_id ?? test.test_id) && t.status === 'PASS' && t.receipt_ref === test.receipt_ref)) fail('TEST_RECEIPT_UNVERIFIED');
    }
    return proof;
  }

  return {
    async run(input, executionContext) {
      let calledModel = false;
      try {
        // Request/body authority flags are never merged into this context.
        if (typeof authenticateWorker !== 'function') fail('BLOCKED_WORKER_IDENTITY');
        const authentication = await authenticateWorker(executionContext);
        if (!authentication?.actor?.authenticated || authentication.actor.role !== 'worker') fail('BLOCKED_WORKER_IDENTITY');
        const context = { actor: { ...authentication.actor }, capabilities: { ...authentication.capabilities } };
        const currentContext = () => ({ ...context, now: clock() });
        const request = normalizeIdentities(input, { requirePermit: false });
        let state = await store.read(), run = state.runs[request.run_id];
        if (!run || run.run_kind !== 'NEW_WL' || request.lab_id !== run.lab_id) fail('LAB_SCOPE_CONFLICT');
        if (!run.worker_binding?.verified || run.worker_binding.worker_id !== context.actor.id) fail('WORKER_NOT_BOUND');
        let work = findWork(state, run.run_id, request.work_item_id);
        const grantRequest = { run_id: run.run_id, lab_id: run.lab_id, work_item_id: request.work_item_id,
          expected_parent: request.expected_parent ?? null, trigger_id: request.trigger_id,
          trigger_kind: request.trigger_kind ?? 'HOURLY_FALLBACK',
          expected_revision: run.revision, control_epoch: run.control_epoch };
        if (work?.accepted) {
          const prior = await reduce(draft => grantWork(draft, grantRequest, currentContext()));
          state = await store.read();
          const restored = replay(state, run.run_id);
          return { status: 'ALREADY_ACCEPTED', receipt: prior.accepted, replay: restored, model_calls_this_invocation: 0 };
        }
        if (context.capabilities.native_model_verified !== true || typeof model !== 'function') fail('BLOCKED_NATIVE_MODEL_ADAPTER');
        if (typeof verifyResult !== 'function') fail('BLOCKED_ARTIFACT_VERIFIER');
        const globalEpoch = state.global_control.epoch;
        gate(state, run, null, context.actor, clock(), globalEpoch);
        const mission = state.missions[run.mission_id];
        const sourceBundle = await checkedSources(mission, run, context, work?.source_binding);
        work = await reduce(draft => grantWork(draft, { ...grantRequest, sources: sourceBundle.bindings }, currentContext()));
        if (digest(sourceBundle.bindings) !== work.source_binding.source_set_hash) fail('FROZEN_SOURCE_BINDING_CONFLICT');
        let attempts = Object.values(work.attempts);
        let attempt = attempts.find(a => a.status === 'KNOWN_SUCCESS' && a.outcome?.candidate);
        const uncertain = attempts.find(a => ['UNKNOWN_EFFECT', 'STARTED'].includes(a.status));
        if (!attempt && uncertain) {
          if (uncertain.status === 'STARTED' && context.capabilities.recovery_invocation_terminated !== true) fail('ATTEMPT_IN_FLIGHT');
          if (typeof reconcileModelEffect !== 'function') fail('RECONCILIATION_REQUIRED');
          const reconciled = await reconcileModelEffect({ work, attempt: uncertain }, context);
          if (!reconciled?.verified || !reconciled.receipt_ref || !['KNOWN_SUCCESS', 'NO_EFFECT', 'KNOWN_FAILURE'].includes(reconciled.outcome?.status)) fail('RECONCILIATION_REQUIRED');
          if (reconciled.outcome.status === 'KNOWN_SUCCESS') resultCandidate(reconciled.outcome);
          attempt = await reduce(draft => recordOutcome(draft, { ...token(run, work, uncertain), outcome: reconciled.outcome }, {
            ...currentContext(), capabilities: { ...context.capabilities, reconciliation_verified: true, reconciliation_receipt_ref: reconciled.receipt_ref },
          }));
          if (attempt.status !== 'KNOWN_SUCCESS') attempt = null;
          state = await store.read(); work = findWork(state, run.run_id, request.work_item_id);
        }
        if (!attempt) {
          if (typeof request.attempt_id !== 'string' || !request.attempt_id) fail('ATTEMPT_ID_REQUIRED');
          attempt = await reduce(draft => {
            // A duplicate STARTED receipt is not ownership of the generation call.
            // Only the invocation that atomically inserts this attempt may call it.
            if (findWork(draft, run.run_id, request.work_item_id)?.attempts[request.attempt_id]) fail('ATTEMPT_IN_FLIGHT');
            return beginAttempt(draft, { ...grantRequest, turn_permit_id: work.turn_permit_id, attempt_id: request.attempt_id }, currentContext());
          });
          if (attempt.status !== 'STARTED') fail('FRESH_ATTEMPT_ID_REQUIRED');
          // Last current read before generation. A later STOP cannot unsend a model
          // request already started; its result remains passive and cannot commit.
          state = await store.read();
          try {
            gate(state, state.runs[run.run_id], attempt, context.actor, clock(), globalEpoch);
            const durableAttempt = findWork(state, run.run_id, request.work_item_id)?.attempts[attempt.attempt_id];
            if (durableAttempt?.status !== 'STARTED') fail('ATTEMPT_ALREADY_RECONCILED');
          } catch (error) {
            await reduce(draft => recordOutcome(draft, { ...token(run, work, attempt), outcome: { status: 'NO_EFFECT', reason: error.code } }, currentContext()));
            throw error;
          }
          let generated;
          try {
            calledModel = true;
            generated = await model({ mission, source_bindings: sourceBundle.bindings, source_content: sourceBundle.content,
              research_state: state.research[run.run_id].current, work, attempt_id: attempt.attempt_id,
              role_selection: roleFor(mission, state.research[run.run_id]), privacy_class: 'PRIVATE', cost_policy: 'NO_PAID', execution_authority: 'NONE' }, context);
          } catch {
            await reduce(draft => recordOutcome(draft, { ...token(run, work, attempt), outcome: { status: 'UNKNOWN_EFFECT', provider_attempt_ref: attempt.attempt_id } }, currentContext()));
            fail('MODEL_UNKNOWN_EFFECT_RECONCILE_REQUIRED');
          }
          if (!generated?.receipt_ref || !generated?.candidate?.patch || !generated?.candidate?.result) {
            await reduce(draft => recordOutcome(draft, { ...token(run, work, attempt), outcome: { status: 'KNOWN_FAILURE', reason: 'MODEL_PROTOCOL_INVALID' } }, currentContext()));
            fail('MODEL_PROTOCOL_INVALID');
          }
          attempt = await reduce(draft => recordOutcome(draft, { ...token(run, work, attempt), outcome: { status: 'KNOWN_SUCCESS', receipt_ref: generated.receipt_ref, candidate: generated.candidate } }, currentContext()));
        }
        const candidate = resultCandidate(attempt.outcome);
        state = await store.read();
        gate(state, state.runs[run.run_id], attempt, context.actor, clock(), globalEpoch);
        const proof = await checkArtifacts(mission, candidate, attempt, context);
        const accepted = await reduce(draft => {
          gate(draft, draft.runs[run.run_id], attempt, context.actor, clock(), globalEpoch);
          return admitSuccessor(draft, { ...token(run, work, attempt), patch: candidate.patch, result: candidate.result }, {
            ...currentContext(), capabilities: { ...context.capabilities, artifact_receipts_verified: true },
          });
        });
        state = await store.read();
        const durable = findWork(state, run.run_id, request.work_item_id)?.accepted;
        if (!durable || digest(durable) !== digest(Object.fromEntries(Object.entries(accepted).filter(([key]) => key !== 'duplicate')))) fail('ACCEPTANCE_READBACK_UNVERIFIED');
        const restored = replay(state, run.run_id);
        return { status: 'NATIVE_LOOP_ACCEPTED', receipt: durable, verification_receipt_ref: proof.receipt_ref,
          replay: restored, model_calls_this_invocation: Number(calledModel), runtime_claim: 'ADAPTER_EXECUTION_ONLY_LIVE_ACTIVATION_REQUIRES_SEPARATE_RECEIPT' };
      } catch (error) {
        return { status: 'BLOCKED', code: error instanceof CoreError ? error.code : 'NATIVE_ADAPTER_FAILURE', model_calls_this_invocation: Number(calledModel) };
      }
    },
    async replay(runId, executionContext) {
      if (typeof authenticateWorker !== 'function') fail('BLOCKED_WORKER_IDENTITY');
      const authentication = await authenticateWorker(executionContext), state = await store.read(), run = state.runs[runId];
      if (!authentication?.actor?.authenticated || authentication.actor.role !== 'worker' || !run?.worker_binding?.verified || run.worker_binding.worker_id !== authentication.actor.id) fail('WORKER_NOT_BOUND');
      return replay(state, runId);
    },
  };
}
