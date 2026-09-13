import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EMAIL_PROTOCOL, PREAI8_ADAPTER, createEmailDialogue, validateEmailMetadata,
  serializeEmailMetadata, adaptPreai8Metadata, reconcileMailboxMessages,
  parsePreai8MessageMetadata,
  buildEmailObservatory, guardLegacyEmailSnapshot, selectEmailWork, emailEffectGate,
  reduceEmailDispatch, isProtectedEmailThread } from '../functions/_wl/email.mjs';

const NOW = '2026-09-13T12:00:00.000Z';
const EARLY = '2026-09-13T00:00:00.000Z';
const END = '2026-09-20T00:00:00.000Z';
const allowlist = { bd_gmail: { enabled: true, bd_owned: true, provider: 'gmail', role: 'BD_SIM' },
  bd_outlook: { enabled: true, bd_owned: true, provider: 'outlook', role: 'AI' } };
const sources = ['gmail:bd_gmail', 'outlook:bd_outlook'];
const coverage = Object.fromEntries(sources.map(id => [id, { status: 'OK', measured_at: NOW }]));
const gate = () => ({ allowed: true });
function run(id = 'EMAIL-A', overrides = {}) {
  return { run_id: id, run_kind: 'EMAIL_DIALOGUE', first_turn: 0, roles: ['BD_SIM', 'AI'],
    required_sources: sources, status: 'ACTIVE', lifecycle_revision: 1,
    started_at: EARLY, managed_window_started_at: EARLY, expires_at: END,
    live_send_capability: 'VERIFIED', ...overrides };
}
function metadata(turn = 0, runId = 'EMAIL-A', overrides = {}) {
  return { protocol: EMAIL_PROTOCOL, run_id: runId, turn, role: turn % 2 ? 'AI' : 'BD_SIM',
    dispatch_key: `${runId}-${turn}`, parent_dispatch_key: turn ? `${runId}-${turn-1}` : null,
    parent_provider_ids: [], original_started_at: EARLY, managed_window_started_at: EARLY,
    prepared_at: `2026-09-13T0${turn}:00:00.000Z`, expires_at: END,
    worker_invocation_id: `invocation-${turn}`, wake_mode: 'hourly', lifecycle_revision: 1, ...overrides };
}
function message(turn = 0, runId = 'EMAIL-A', overrides = {}) {
  return { metadata: metadata(turn, runId), provider: 'outlook', account_id: 'bd_outlook', folder: 'INBOX',
    provider_message_id: `${runId}-provider-${turn}`, internet_message_id: `<${runId}-${turn}@example.test>`,
    sent_at: `2026-09-13T0${turn}:00:00.000Z`, body: `private body ${turn}`,
    subject: 'PRIVATE_SUBJECT', address: 'secret@example.test', access_token: 'PRIVATE_TOKEN', ...overrides };
}
function reconcile(records, runs = [run()], coverageInput = coverage, now = NOW) {
  return reconcileMailboxMessages(records, { knownRuns: runs, coverage: coverageInput, now });
}
function observatory(reconciliation, generatedAt = NOW) {
  return buildEmailObservatory({ reconciliation, measuredAt: reconciliation.measured_at, generatedAt });
}
function reserve(overrides = {}) {
  return { type: 'RESERVE', run_id: 'EMAIL-A', dispatch_key: 'dispatch-1', invocation_id: 'wake-1',
    turn: 1, parent_dispatch_key: 'EMAIL-A-0', at: NOW, ...overrides };
}

test('G4C: only trusted enabled BD-owned recipient IDs create private dialogue; window is not started', () => {
  const input = { title: 'A research dialogue', seed: 'Question?', recipient_ids: ['bd_gmail', 'bd_outlook'] };
  const created = createEmailDialogue(input, { recipientAllowlist: allowlist, now: NOW, runId: 'EMAIL-C' });
  assert.equal(created.ok, true);
  assert.equal(created.run.requested_duration_seconds, 168*3600);
  assert.equal(created.run.managed_window_started_at, null);
  assert.equal(created.run.expires_at, null);
  assert.equal(created.run.status, 'CREATED');
  assert.equal(created.run.live_send_capability, 'UNVERIFIED');
  assert.equal(created.run.memory_import, 'FORBIDDEN');
  assert.match(created.run.subject, /^\[AI8-EMAIL:EMAIL-C\]/);
  assert.equal(createEmailDialogue({ ...input, recipient_ids: ['bd_gmail', 'third_party'] }, { recipientAllowlist: allowlist, now: NOW }).error, 'RECIPIENT_NOT_ALLOWED');
  assert.equal(createEmailDialogue({ ...input, to: 'thirdparty@example.test' }, { recipientAllowlist: allowlist, now: NOW }).error, 'UNSUPPORTED_DIALOGUE_FIELD');
  assert.equal(createEmailDialogue(input, { recipientAllowlist: { ...allowlist, bd_outlook: { ...allowlist.bd_outlook, bd_owned: false } }, now: NOW }).error, 'RECIPIENT_NOT_ALLOWED');
});

test('G4C: strict metadata serialization rejects hidden data, parity-independent shape errors and invalid windows', () => {
  const checked = serializeEmailMetadata(metadata());
  assert.equal(checked.ok, true);
  assert.deepEqual(JSON.parse(checked.serialized), metadata());
  for (const extra of [{ body: 'secret' }, { access_token: 'secret' }, { from: 'private@example.test' }]) {
    assert.equal(validateEmailMetadata({ ...metadata(), ...extra }).error, 'UNKNOWN_METADATA_FIELD');
  }
  assert.equal(validateEmailMetadata(metadata(0, 'EMAIL-A', { turn: 0.5 })).error, 'INVALID_TURN');
  assert.equal(validateEmailMetadata(metadata(0, 'EMAIL-A', { prepared_at: END })).error, 'INVALID_METADATA_WINDOW');
  assert.equal(validateEmailMetadata(metadata(0, 'EMAIL-A', { dispatch_key: 'abc\r\nBCC:evil' })).ok, false);
});

test('G4B: PREAI8 compatibility is explicit, preserves identifiers and does not claim verified live parsing', () => {
  const fields = { run_id: 'PREAI8-20260912-A', turn: 21, role: 'BD_SIM', dispatch_key: 'existing-key-21', parent_dispatch_key: 'existing-key-20' };
  const adapted = adaptPreai8Metadata(fields);
  assert.equal(adapted.ok, true);
  assert.equal(adapted.metadata.dispatch_key, fields.dispatch_key);
  assert.equal(adapted.metadata.lifecycle_revision, null);
  assert.equal(adapted.metadata.live_format_verified, false);
  assert.equal(adaptPreai8Metadata(fields, { adapter: 'GUESS_FROM_SUBJECT' }).ok, false);
  assert.equal(adaptPreai8Metadata({ ...fields, run_id: 'random-run' }).ok, false);
  const legacyRun = run(fields.run_id, { first_turn: 21 });
  const adaptedMessage = message(0, fields.run_id, { compatibility_adapter: PREAI8_ADAPTER,
    metadata: { ...fields, parent_dispatch_key: null } });
  assert.equal(reconcile([adaptedMessage], [legacyRun]).runs[0].highest_valid_turn, 21);
});

test('G2A: duplicate Sent and Inbox copies collapse; drafts do not claim sent or delivered', () => {
  const sent = message(0, 'EMAIL-A', { provider: 'gmail', account_id: 'bd_gmail', folder: 'SENT', provider_message_id: 'gmail-local-id' });
  const inbox = message();
  const draft = message(1, 'EMAIL-A', { folder: 'DRAFT' });
  const result = reconcile([sent, inbox, draft]);
  assert.equal(result.messages.length, 2);
  assert.equal(result.messages[0].copies, 2);
  const projected = observatory(result);
  assert.equal(projected.logical_message_total, 1);
  assert.equal(projected.runs[0].draft_count, 1);
  assert.equal(projected.runs[0].delivered_message_count, 1);
  assert.equal(result.runs[0].unanswered_parent.turn, 0);
  assert.equal(observatory(reconcile([draft])).logical_message_total, 0);
});

test('G4B: observed PREAI8-HOURLY-R2 revision 3 parses exact markers without importing content or open-ended authority', () => {
  const fields = {protocol:'PREAI8-HOURLY-R2',metadata_revision:3,run_id:'PREAI8-20260912-A',turn:22,role:'LLM',
    dispatch_key:'PREAI8-20260912-A:22',slot_utc:'2026-09-12T23:00:00Z',parent_dispatch_key:'PREAI8-20260912-A:21',
    parent_provider:'Microsoft_Outlook_Email',parent_message_id:'synthetic-opaque-parent',parent_internet_message_id:null,
    started_at_utc:'2026-09-12T02:17:57Z',prepared_at_utc:'2026-09-12T23:21:03Z',expires_at_utc:null,
    stop_policy:'UNTIL_BD_STOPS',invocation:'hourly_backup'};
  const text=`PRIVATE RESEARCH BODY\n--- PREAI8 METADATA ---\n${JSON.stringify(fields)}\n--- END METADATA ---`;
  const parsed=parsePreai8MessageMetadata(text);
  assert.equal(parsed.ok,true);
  assert.equal(parsed.metadata.role,'LLM');
  assert.equal(parsed.metadata.original_started_at,'2026-09-12T02:17:57.000Z');
  assert.equal(parsed.metadata.lifecycle_revision,null);
  assert.equal(parsed.metadata.expires_at,undefined);
  assert.equal(parsed.metadata.stop_policy,undefined);
  assert.deepEqual(parsed.metadata.parent_provider_ids,['synthetic-opaque-parent']);
  assert.ok(!JSON.stringify(parsed).includes('PRIVATE RESEARCH BODY'));
  assert.equal(parsePreai8MessageMetadata(text+'\n'+text).ok,false);
  assert.equal(adaptPreai8Metadata({...fields,metadata_revision:4}).ok,false);
});

test('G2A: same logical ID with conflicting body, metadata or cross-run identities is quarantined', () => {
  const a = message();
  const bodyConflict = message(0, 'EMAIL-A', { body: 'a conflicting body', folder: 'SENT' });
  const r = reconcile([a, bodyConflict]);
  assert.equal(r.messages.length, 0);
  assert.equal(r.runs[0].anomalies[0].code, 'LOGICAL_MESSAGE_CONFLICT');
  const metaConflict = message(0, 'EMAIL-A', { metadata: metadata(0, 'EMAIL-A', { expires_at: '2026-09-21T00:00:00Z' }) });
  assert.equal(reconcile([a, metaConflict]).messages.length, 0);
  const b = message(0, 'EMAIL-B', { internet_message_id: a.internet_message_id });
  const crossRun = reconcile([a,b], [run(),run('EMAIL-B')]);
  assert.equal(crossRun.messages.length, 0);
  assert.ok(crossRun.runs.every(r => r.anomalies.some(a => a.code === 'LOGICAL_MESSAGE_CONFLICT')));
});

test('G2A: interval pooling only uses intervals within each parallel run', () => {
  const a = [message(0), message(1)];
  const b = [message(0, 'EMAIL-B', { sent_at: '2026-09-13T00:15:00Z' }), message(1, 'EMAIL-B', { sent_at: '2026-09-13T02:15:00Z' })];
  const o = observatory(reconcile([...a,...b], [run(),run('EMAIL-B')]));
  assert.equal(o.runs[0].interval_seconds.mean, 3600);
  assert.equal(o.runs[1].interval_seconds.mean, 7200);
  assert.equal(o.interval_seconds.mean, 5400);
  assert.equal(o.interval_seconds.count, 2);
  assert.equal(o.interval_basis, 'POOLED_WITHIN_RUN_INTERVALS_ONLY');
});

test('G2A: unavailable mailbox reports PARTIAL and cannot authorize a reply', () => {
  const c = { ...coverage, 'outlook:bd_outlook': { status: 'UNAVAILABLE' } };
  const r = reconcile([message()], [run()], c);
  const o = observatory(r);
  assert.equal(o.freshness, 'PARTIAL');
  assert.equal(o.runs[0].source_coverage.sources[1].status, 'SOURCE_BLOCKED');
  const plan = selectEmailWork({ runs: [run()], reconciliation: r, invocationId: 'wake', lifecycleGate: gate, now: NOW });
  assert.equal(plan.selected.length, 0);
  assert.equal(plan.skipped[0].reason, 'BOTH_MAILBOXES_REQUIRED');
});

test('G2A: generated_at cannot reset measured_at and stale threshold is at most twice cadence', () => {
  const r = reconcile([message()]);
  const regenerated = observatory(r, '2026-09-13T14:00:00Z');
  assert.equal(regenerated.freshness, 'STALE');
  assert.equal(regenerated.measured_at, NOW);
  assert.equal(buildEmailObservatory({ reconciliation: r, measuredAt: '2026-09-13T14:00:00Z', generatedAt: '2026-09-13T14:00:00Z' }).error, 'INVALID_MEASUREMENT_TIME');
  assert.equal(buildEmailObservatory({ reconciliation: r, measuredAt: NOW, generatedAt: NOW, staleAfterSeconds: 7201 }).error, 'INVALID_OBSERVATORY_INPUT');
  const rereadAt = '2026-09-13T14:00:00Z';
  const freshCoverage = Object.fromEntries(sources.map(s => [s,{ status: 'OK', measured_at: rereadAt }]));
  const reread = observatory(reconcile([message()], [run()], freshCoverage, rereadAt), rereadAt);
  assert.equal(reread.freshness, 'FRESH');
  assert.equal(reread.logical_message_total, regenerated.logical_message_total);
});

test('G2A: observable output and metadata reducers never retain email content or secrets', () => {
  const records = [message()];
  const r = reconcile(records);
  for (const serialized of [JSON.stringify(r), JSON.stringify(observatory(r))]) {
    for (const secret of ['private body', 'PRIVATE_SUBJECT', 'secret@example.test', 'PRIVATE_TOKEN']) assert.ok(!serialized.includes(secret));
    assert.ok(!serialized.includes('"body"'));
    assert.ok(!serialized.includes('"subject"'));
  }
  assert.equal(observatory(r).research_memory_import, false);
  assert.equal(records[0].body, 'private body 0'); // read-only collector inputs
});

test('G2A: current A21/B19 counts survive projection, and old stale A3/B2 is never current', () => {
  const current = JSON.parse(fs.readFileSync(new URL('../public/data/PREAI8_STATUS.json',import.meta.url),'utf8'));
  const guarded = guardLegacyEmailSnapshot(current, { now: NOW });
  assert.equal(guarded.logical_message_total, current.observatory.email.total_messages);
  assert.equal(guarded.runs[0].verified_turn, current.email_plane.A.verified_turn);
  assert.equal(guarded.measured_at, null);
  assert.equal(guarded.freshness, 'SOURCE_BLOCKED');
  assert.equal(guarded.counts_basis, 'HISTORICAL_SNAPSHOT_NOT_CURRENT_TOTALS');
  const old = structuredClone(current);
  old.email_plane.A.verified_turn = 3; old.email_plane.B.verified_turn = 2;
  old.generated_at = '2026-09-12T03:00:00Z';
  old.measured_at = '2026-09-12T03:00:00Z'; old.source_coverage = { status: 'COMPLETE' };
  assert.equal(guardLegacyEmailSnapshot(old, { now: NOW }).freshness, 'STALE');
});

test('G4B: parity, missing parent and already-answered lineage cannot produce duplicate replies', () => {
  const r = reconcile([message(),message(1)]);
  assert.equal(r.runs[0].unanswered_parent.turn, 1);
  const plan = selectEmailWork({ runs: [run()], reconciliation: r, invocationId: 'wake', lifecycleGate: gate, now: NOW });
  assert.equal(plan.selected[0].turn, 2);
  assert.equal(plan.selected[0].role, 'BD_SIM');
  const parity = reconcile([message(0, 'EMAIL-A', { metadata: metadata(0, 'EMAIL-A', { role: 'AI' }) })]);
  assert.equal(parity.runs[0].anomalies[0].code, 'ROLE_PARITY');
  const gap = reconcile([message(1)]);
  assert.equal(gap.runs[0].anomalies[0].code, 'LINEAGE_GAP');
  const wrongParent = reconcile([message(),message(1, 'EMAIL-A', { metadata: metadata(1, 'EMAIL-A', { parent_dispatch_key: 'another-parent' }) })]);
  assert.equal(wrongParent.runs[0].anomalies[0].code, 'INVALID_OR_UNDELIVERED_PARENT');
  for (const invalid of [parity,gap,wrongParent]) {
    assert.equal(selectEmailWork({ runs:[run()], reconciliation: invalid, invocationId:'wake', lifecycleGate:gate, now:NOW }).selected.length, 0);
  }
});

test('G4B: Sent-only parent and malformed registered-run evidence fail closed', () => {
  const sent = reconcile([message(0, 'EMAIL-A', { folder: 'SENT' })]);
  assert.equal(sent.runs[0].unanswered_parent, null);
  assert.equal(selectEmailWork({ runs:[run()], reconciliation:sent, invocationId:'wake', lifecycleGate:gate, now:NOW }).skipped[0].reason, 'PARENT_NOT_DELIVERED');
  const malformed = reconcile([message(),message(1,'EMAIL-A',{ metadata:{ ...metadata(1), hidden:'secret' } })]);
  assert.equal(selectEmailWork({ runs:[run()], reconciliation:malformed, invocationId:'wake', lifecycleGate:gate, now:NOW }).selected.length, 0);
  const legacy=run('PREAI8-20260912-A');
  assert.equal(selectEmailWork({ runs:[legacy], reconciliation:reconcile([],[legacy]), invocationId:'wake', lifecycleGate:gate, now:NOW }).skipped[0].reason,'EXISTING_HISTORY_NOT_RECONSTRUCTED');
});

test('G4B/G4.9: bounded fair round robin selects one next message per run and no catch-up burst', () => {
  const runs = [run(),run('EMAIL-B'),run('EMAIL-C')], r = reconcile([],runs);
  const first = selectEmailWork({ runs, reconciliation:r, invocationId:'wake', lifecycleGate:gate, now:NOW, globalCap:2 });
  assert.deepEqual(first.selected.map(p=>p.run_id), ['EMAIL-A','EMAIL-B']);
  assert.ok(first.selected.every(p=>p.max_messages===1 && p.no_catch_up));
  const second = selectEmailWork({ runs, reconciliation:r, invocationId:'wake2', lifecycleGate:gate, now:NOW, globalCap:1, cursor:first.next_cursor });
  assert.equal(second.selected[0].run_id,'EMAIL-C');
  const stopped = selectEmailWork({ runs:[run('EMAIL-A',{status:'STOPPED'}),run('EMAIL-B')], reconciliation:r, invocationId:'wake', lifecycleGate:gate, now:NOW, globalCap:2 });
  assert.deepEqual(stopped.selected.map(p=>p.run_id),['EMAIL-B']);
});

test('G4.9: event/hourly identity is stable, stale measurement and already handled invocation are rejected', () => {
  const r=reconcile([message()]);
  const a=selectEmailWork({runs:[run()],reconciliation:r,invocationId:'event',lifecycleGate:gate,now:NOW});
  const b=selectEmailWork({runs:[run()],reconciliation:r,invocationId:'hourly',lifecycleGate:gate,now:NOW});
  assert.equal(a.selected[0].dispatch_key,b.selected[0].dispatch_key);
  const old = {...coverage,'gmail:bd_gmail':{status:'OK',measured_at:EARLY}};
  assert.equal(selectEmailWork({runs:[run()],reconciliation:reconcile([message()],[run()],old),invocationId:'event',lifecycleGate:gate,now:NOW}).skipped[0].reason,'FRESH_MAILBOX_MEASUREMENT_REQUIRED');
  assert.equal(selectEmailWork({runs:[run('EMAIL-A',{last_email_invocation_id:'event'})],reconciliation:r,invocationId:'event',lifecycleGate:gate,now:NOW}).selected.length,0);
});

test('G4.9: pause, stop, expiry, delete and lifecycle revision races recheck immediately before effect', () => {
  const r=reconcile([message()]), current=run();
  const plan=selectEmailWork({runs:[current],reconciliation:r,invocationId:'event',lifecycleGate:gate,now:NOW}).selected[0];
  const args={run:current,plan,permit:{opaque:'test-permit'},lifecycleGate:gate,now:NOW};
  assert.equal(emailEffectGate(args).ok,true);
  for(const status of ['PAUSED','STOPPED','DELETED','EXPIRED']) assert.equal(emailEffectGate({...args,run:{...current,status}}).error,'LIFECYCLE_BLOCKED');
  assert.equal(emailEffectGate({...args,now:END}).error,'LIFECYCLE_BLOCKED');
  assert.equal(emailEffectGate({...args,run:{...current,lifecycle_revision:2}}).error,'STALE_EMAIL_PLAN');
  assert.equal(emailEffectGate({...args,lifecycleGate:()=>({allowed:false})}).error,'PERMIT_OR_LIFECYCLE_DENIED');
  assert.equal(emailEffectGate({...args,run:{...current,live_send_capability:'UNVERIFIED'}}).error,'LIVE_SEND_CAPABILITY_UNVERIFIED');
});

test('G4.9: reservations are idempotent and event/hourly races cannot reserve the same parent twice', () => {
  const first=reduceEmailDispatch({},reserve());
  assert.equal(first.result.status,'RESERVED');
  const retry=reduceEmailDispatch(first.state,reserve());
  assert.equal(retry.result.replay,true);
  assert.equal(retry.result.effect_allowed,false);
  const conflict=reduceEmailDispatch(first.state,reserve({turn:2}));
  assert.equal(conflict.result.error,'DISPATCH_CONFLICT');
  const collision=reduceEmailDispatch(first.state,reserve({dispatch_key:'dispatch-other',invocation_id:'hourly'}));
  assert.equal(collision.result.error,'PARENT_ALREADY_RESERVED_OR_ANSWERED');
  const sameInvocation=reduceEmailDispatch(first.state,reserve({dispatch_key:'dispatch-other',parent_dispatch_key:'other-parent',turn:2}));
  assert.equal(sameInvocation.result.error,'ONE_MESSAGE_PER_RUN_INVOCATION');
});

test('G4.9: uncertain send requires actual positive mailbox reconciliation; late delivery stays passive', () => {
  let state=reduceEmailDispatch({},reserve()).state;
  state=reduceEmailDispatch(state,{...reserve(),type:'BEGIN_SEND',gate_receipt:{allowed:true,dispatch_key:'dispatch-1'}}).state;
  state=reduceEmailDispatch(state,{...reserve(),type:'UNCERTAIN'}).state;
  assert.equal(Object.values(state.dispatches)[0].status,'UNCERTAIN');
  assert.equal(reduceEmailDispatch(state,{...reserve(),type:'BEGIN_SEND',gate_receipt:{allowed:true,dispatch_key:'dispatch-1'}}).result.error,'DISPATCH_NOT_SENDABLE');
  const late={...reserve(),type:'RECONCILE',at:'2026-09-21T00:00:00Z',mailbox_evidence:{run_id:'EMAIL-A',dispatch_key:'dispatch-1',sent:true,delivered:true,draft_only:false,source_ids:['outlook:bd_outlook'],measured_at:'2026-09-21T00:00:00Z'}};
  assert.equal(reduceEmailDispatch(state,{...late,mailbox_evidence:{...late.mailbox_evidence,sent:false}}).result.error,'POSITIVE_MAILBOX_EVIDENCE_REQUIRED');
  assert.equal(reduceEmailDispatch(state,{...late,mailbox_evidence:{...late.mailbox_evidence,draft_only:true}}).result.error,'POSITIVE_MAILBOX_EVIDENCE_REQUIRED');
  const done=reduceEmailDispatch(state,late);
  assert.equal(done.result.status,'DELIVERED');
  assert.equal(done.result.passive_only,true);
  assert.equal(done.result.effect_allowed,false);
  const sentReadback=reduceEmailDispatch(done.state,{...late,mailbox_evidence:{...late.mailbox_evidence,delivered:false}});
  assert.equal(sentReadback.result.status,'DELIVERED');
  const afterStop=reconcile([message()], [run('EMAIL-A',{status:'STOPPED'})]);
  assert.equal(afterStop.messages.length,1);
  assert.equal(selectEmailWork({runs:[run('EMAIL-A',{status:'STOPPED'})],reconciliation:afterStop,invocationId:'late',lifecycleGate:gate,now:NOW}).selected.length,0);
});

test('G4.7: cleanup protection derives from registry and retains fragmented and stopped threads', () => {
  const registeredRuns=[run('EMAIL-A',{status:'STOPPED',thread_ids:['fragment-1','fragment-2']})];
  assert.equal(isProtectedEmailThread({runId:'EMAIL-A',registeredRuns}),true);
  assert.equal(isProtectedEmailThread({threadId:'fragment-2',registeredRuns}),true);
  assert.equal(isProtectedEmailThread({runId:'EMAIL-unknown',registeredRuns}),false);
});
