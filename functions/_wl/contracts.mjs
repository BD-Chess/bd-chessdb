import { createHash } from 'node:crypto';
export const REQUIRED_SLICES = ['C1', 'L1', 'E1', 'U1', 'M1', 'WAKE', 'HEALTH', 'U1-O', 'S1', 'U2_CONTRACT'];
export const RUNTIME_SCHEMAS = {
  managed_state: 'wl.managed-state.v1', encrypted_store: 'wl.managed.encrypted.v1',
  cockpit: 'wl.cockpit.v1', email_metadata: 'AI8-EMAIL-DIALOGUE-v1',
  memory_source: 'wl.memory.source.v1', memory_capsule: 'wl.memory.capsule.v1',
  implementation_status: 'wl.implementation-status.v1', external_bridge: 'wl.external-bridge.v1'
};
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = code => { throw Object.assign(Error(code), { code }); };
const requireValue = (value, code) => { if (!value) fail(code); };

export function validateImplementationStatus(report) {
  requireValue(report?.schema === RUNTIME_SCHEMAS.implementation_status, 'REPORT_SCHEMA');
  requireValue(report.report_is_authority === false, 'REPORT_CANNOT_ISSUE_AUTHORITY');
  requireValue(typeof report.build_scope_complete === 'boolean' && Array.isArray(report.slices), 'REPORT_SCOPE_REQUIRED');
  const ids = report.slices.map(s => s.slice_id);
  requireValue(new Set(ids).size === ids.length && REQUIRED_SLICES.every(id => ids.includes(id)), 'MANDATORY_SLICE_MISSING');
  for (const slice of report.slices) {
    requireValue(Array.isArray(slice.code_refs) && Array.isArray(slice.test_receipt_refs) && typeof slice.live_status === 'string', 'SLICE_EVIDENCE_REQUIRED');
    if (report.build_scope_complete) requireValue(slice.build_status === 'PASS' && slice.code_refs.length && slice.test_receipt_refs.length, 'BUILD_SCOPE_INCOMPLETE');
    if (/(?:^|_)LIVE_PASS$|(?:^|_)PRODUCTION(?:_.*)?_PASS$|^PRODUCTION_.*PASS$/.test(slice.live_status)) {
      requireValue(slice.live_evidence?.evidence_type === 'live' && slice.live_evidence.receipt_ref && slice.live_evidence.source_sha && slice.live_evidence.measured_at, 'LIVE_CLAIM_WITHOUT_LIVE_EVIDENCE');
    }
    if (slice.blocker_or_null) requireValue(slice.next_test_or_null, 'BLOCKER_NEXT_TEST_REQUIRED');
  }
  const gates = report.gates || [];
  requireValue(Array.from({ length: 10 }, (_, i) => `ARCH:G${String(i + 1).padStart(2, '0')}`).every(id => gates.some(g => g.gate_ref === id)), 'ARCH_GATE_MISSING');
  return { ok: true, claim: 'REPORT_STRUCTURE_ONLY', runtime_tests_executed: 0 };
}

// Conditional U2 contract. There is deliberately no external transport or paid
// fallback in this module. A caller must supply independently verified capability.
export function freezeExternalRequest(input, authority) {
  requireValue(authority?.authenticated === true && authority.export_scope === 'PUBLIC_SYNTHETIC', 'EXPORT_AUTHORITY_REQUIRED');
  requireValue(input && typeof input.request_id === 'string' && typeof input.lab_id === 'string' && typeof input.run_id === 'string', 'EXTERNAL_IDENTITY_REQUIRED');
  requireValue(input.privacy_class === 'PUBLIC' && input.cost_policy === 'NO_PAID' && input.max_attempts === 1, 'EXTERNAL_SCOPE_DENIED');
  requireValue(typeof input.prompt === 'string' && input.prompt.length > 0 && input.prompt.length <= 16000, 'EXTERNAL_PROMPT_REQUIRED');
  requireValue(Array.isArray(input.source_digests) && input.source_digests.every(d => /^[a-f0-9]{64}$/.test(d)), 'EXTERNAL_SOURCE_DIGEST_REQUIRED');
  const request = structuredClone(input);
  return { schema: RUNTIME_SCHEMAS.external_bridge, request, request_hash: hash(request), attempts: {}, reply: null, accepted_as_research: false };
}
export function beginExternalAttempt(previous, input, capability) {
  requireValue(hash(previous.request) === previous.request_hash && input.request_hash === previous.request_hash, 'REQUEST_CHANGED');
  requireValue(capability?.verified === true && capability.official_automation === true && capability.billing === 'NO_INCREMENTAL_CHARGE' && capability.identity_ref && capability.receipt_ref, 'U2_BLOCKED_CAPABILITY');
  requireValue(typeof input.attempt_id === 'string' && typeof input.started_at === 'string', 'ATTEMPT_ID_REQUIRED');
  if (previous.attempts[input.attempt_id]) return structuredClone(previous);
  requireValue(Object.keys(previous.attempts).length < 1, 'EXTERNAL_ATTEMPT_LIMIT');
  const state = structuredClone(previous);
  state.attempts[input.attempt_id] = { attempt_id: input.attempt_id, started_at: input.started_at, status: 'IN_FLIGHT', capability_receipt: capability.receipt_ref };
  return state;
}
export function receiveExternalReply(previous, input, control) {
  requireValue(input.request_hash === previous.request_hash && previous.attempts[input.attempt_id], 'REPLY_BINDING_INVALID');
  requireValue(typeof input.content === 'string' && input.content_digest === hash(input.content) && input.transport_receipt_ref, 'REPLY_DIGEST_OR_RECEIPT_INVALID');
  if (previous.reply) { requireValue(previous.reply.content_digest === input.content_digest, 'REPLY_CONFLICT'); return structuredClone(previous); }
  const state = structuredClone(previous);
  state.reply = { ...structuredClone(input), epistemic_status: 'UNREVIEWED_EVIDENCE', execution_authority: 'NONE', passive_only: control?.active !== true };
  state.attempts[input.attempt_id].status = 'REPLY_OBSERVED';
  return state;
}
