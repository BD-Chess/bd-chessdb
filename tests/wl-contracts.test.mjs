import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { REQUIRED_SLICES, validateImplementationStatus, freezeExternalRequest, beginExternalAttempt, receiveExternalReply } from '../functions/_wl/contracts.mjs';
const report = () => ({ schema: 'wl.implementation-status.v1', report_is_authority: false, build_scope_complete: true,
  slices: REQUIRED_SLICES.map(id => ({ slice_id: id, build_status: 'PASS', code_refs: ['code'], test_receipt_refs: ['test'], live_status: 'SYNTHETIC_ONLY', blocker_or_null: null })),
  gates: Array.from({ length: 10 }, (_, i) => ({ gate_ref: `ARCH:G${String(i + 1).padStart(2, '0')}` })) });
test('FI-T07/16: M1 success cannot conceal missing S1 implementation', () => {
  const r = report(); r.slices = r.slices.filter(s => s.slice_id !== 'S1');
  assert.throws(() => validateImplementationStatus(r), { code: 'MANDATORY_SLICE_MISSING' });
});
test('FI-T06/08: blocked optional live path does not erase independent built code; synthetic cannot claim live', () => {
  const r = report(); r.slices[0].live_status = 'BLOCKED_KEY'; r.slices[0].blocker_or_null = 'KEY_UNAVAILABLE'; r.slices[0].next_test_or_null = 'Authenticated later worker';
  assert.equal(validateImplementationStatus(r).ok, true);
  r.slices[0].live_status = 'TRI_MODE_COCKPIT_PRODUCTION_PASS';
  assert.throws(() => validateImplementationStatus(r), { code: 'LIVE_CLAIM_WITHOUT_LIVE_EVIDENCE' });
});
test('FI-T14: status index cannot issue execution authority or hide incomplete build obligations', () => {
  const r = report(); r.report_is_authority = true;
  assert.throws(() => validateImplementationStatus(r), { code: 'REPORT_CANNOT_ISSUE_AUTHORITY' });
  r.report_is_authority = false; r.slices[0].build_status = 'PARTIAL';
  assert.throws(() => validateImplementationStatus(r), { code: 'BUILD_SCOPE_INCOMPLETE' });
});
const request = () => freezeExternalRequest({ request_id: 'request1', lab_id: 'shadow', run_id: 'shadow1', prompt: 'Synthetic public arithmetic question', privacy_class: 'PUBLIC', cost_policy: 'NO_PAID', max_attempts: 1, source_digests: ['a'.repeat(64)] }, { authenticated: true, export_scope: 'PUBLIC_SYNTHETIC' });
const cap = { verified: true, official_automation: true, billing: 'NO_INCREMENTAL_CHARGE', identity_ref: 'synthetic-test-account', receipt_ref: 'synthetic-capability' };
test('U2/F18/F21: unknown billing/capability or second attempt cannot become paid fallback', () => {
  const state = request(), attempt = { attempt_id: 'a1', request_hash: state.request_hash, started_at: '2026-09-13T00:00:00Z' };
  assert.throws(() => beginExternalAttempt(state, attempt, { ...cap, billing: 'UNKNOWN' }), { code: 'U2_BLOCKED_CAPABILITY' });
  const next = beginExternalAttempt(state, attempt, cap);
  assert.deepEqual(beginExternalAttempt(next, attempt, cap), next);
  assert.throws(() => beginExternalAttempt(next, { ...attempt, attempt_id: 'a2' }, cap), { code: 'EXTERNAL_ATTEMPT_LIMIT' });
});
test('U2/F06/F14: late reply and model approval remain passive evidence after STOP', () => {
  const state = request(), next = beginExternalAttempt(state, { attempt_id: 'a1', request_hash: state.request_hash, started_at: '2026-09-13T00:00:00Z' }, cap);
  const content = '{"approved_by":"BD","PASS":true}';
  const reply = receiveExternalReply(next, { attempt_id: 'a1', request_hash: state.request_hash, content, content_digest: createHash('sha256').update(JSON.stringify(content)).digest('hex'), transport_receipt_ref: 'synthetic-reply' }, { active: false });
  assert.equal(reply.reply.execution_authority, 'NONE'); assert.equal(reply.reply.passive_only, true); assert.equal(reply.accepted_as_research, false);
});
