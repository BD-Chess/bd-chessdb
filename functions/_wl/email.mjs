import { createHash, randomUUID } from 'node:crypto';

// Pure protocol, mailbox evidence and dispatch reducers. No mailbox transport exists
// here. Callers must persist reducer state atomically and supply current lifecycle
// and permit checks immediately before an external effect.
export const EMAIL_PROTOCOL = 'AI8-EMAIL-DIALOGUE-v1';
export const PREAI8_ADAPTER = 'PREAI8_EXPLICIT_FIELDS_v1';
export const PREAI8_HOURLY_PROTOCOL = 'PREAI8-HOURLY-R2';
export const EMAIL_DEFAULT_WINDOW_SECONDS = 168 * 3600;
const LEGACY_RUNS = new Set(['PREAI8-20260912-A', 'PREAI8-20260912-B']);
const BLOCKED = new Set(['PAUSED', 'STOPPED', 'EXPIRED', 'DELETED']);
const META_FIELDS = ['protocol', 'run_id', 'turn', 'role', 'dispatch_key',
  'parent_dispatch_key', 'parent_provider_ids', 'original_started_at',
  'managed_window_started_at', 'prepared_at', 'expires_at', 'worker_invocation_id',
  'wake_mode', 'lifecycle_revision'];
const digest = value => createHash('sha256').update(value).digest('hex');
const token = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(value);
const opaque = value => typeof value === 'string' && value.length > 0 && value.length <= 500 && !/[\r\n\x00]/.test(value);
const instant = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const iso = value => new Date(value).toISOString();
const fail = error => ({ ok: false, error });
const canonical = value => JSON.stringify(value, Object.keys(value).sort());

export function validateEmailMetadata(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('METADATA_REQUIRED');
  if (Object.keys(input).some(k => !META_FIELDS.includes(k))) return fail('UNKNOWN_METADATA_FIELD');
  if (input.protocol !== EMAIL_PROTOCOL) return fail('UNSUPPORTED_PROTOCOL');
  for (const key of ['run_id', 'role', 'dispatch_key', 'worker_invocation_id']) {
    if (!token(input[key])) return fail(`INVALID_${key.toUpperCase()}`);
  }
  if (!Number.isSafeInteger(input.turn) || input.turn < 0) return fail('INVALID_TURN');
  if (!Number.isSafeInteger(input.lifecycle_revision) || input.lifecycle_revision < 1) return fail('INVALID_LIFECYCLE_REVISION');
  if (input.parent_dispatch_key !== null && !token(input.parent_dispatch_key)) return fail('INVALID_PARENT');
  if (!Array.isArray(input.parent_provider_ids) || input.parent_provider_ids.length > 20 || input.parent_provider_ids.some(x => !opaque(x))) return fail('INVALID_PARENT_PROVIDER_IDS');
  for (const key of ['original_started_at', 'managed_window_started_at', 'prepared_at', 'expires_at']) {
    if (!instant(input[key])) return fail(`INVALID_${key.toUpperCase()}`);
  }
  if (Date.parse(input.original_started_at) > Date.parse(input.managed_window_started_at)
    || Date.parse(input.managed_window_started_at) >= Date.parse(input.expires_at)
    || Date.parse(input.prepared_at) < Date.parse(input.managed_window_started_at)
    || Date.parse(input.prepared_at) >= Date.parse(input.expires_at)) return fail('INVALID_METADATA_WINDOW');
  if (!['event', 'hourly', 'manual'].includes(input.wake_mode)) return fail('INVALID_WAKE_MODE');
  return { ok: true, metadata: Object.fromEntries(META_FIELDS.map(k => [k, structuredClone(input[k])])) };
}

export function serializeEmailMetadata(input) {
  const checked = validateEmailMetadata(input);
  return checked.ok ? { ok: true, serialized: JSON.stringify(checked.metadata), metadata: checked.metadata } : checked;
}

// The legacy adapter accepts explicit extracted fields from a trusted collector,
// never heuristically parses email bodies. Actual collector binding remains a live
// capability gate; the PREAI8 heartbeat protocol is not an email protocol.
export function adaptPreai8Metadata(fields, { adapter = PREAI8_ADAPTER } = {}) {
  if (adapter !== PREAI8_ADAPTER || !fields || !LEGACY_RUNS.has(fields.run_id)) return fail('UNSUPPORTED_PREAI8_FORMAT');
  const hourly = fields.protocol === PREAI8_HOURLY_PROTOCOL;
  if (fields.protocol && !hourly && fields.protocol !== PREAI8_ADAPTER) return fail('UNSUPPORTED_PREAI8_PROTOCOL');
  if (hourly && (fields.metadata_revision !== 3 || !['BD_SIM', 'LLM'].includes(fields.role)
    || !instant(fields.started_at_utc) || !instant(fields.prepared_at_utc))) return fail('INVALID_PREAI8_HOURLY_METADATA');
  if (!Number.isSafeInteger(fields.turn) || fields.turn < 0 || !token(fields.role) || !token(fields.dispatch_key)) return fail('INVALID_PREAI8_LINEAGE');
  if (fields.parent_dispatch_key != null && !token(fields.parent_dispatch_key)) return fail('INVALID_PARENT');
  if (!Array.isArray(fields.parent_provider_ids || []) || (fields.parent_provider_ids || []).some(x => !opaque(x))) return fail('INVALID_PARENT_PROVIDER_IDS');
  const providerIds = hourly ? [fields.parent_message_id, fields.parent_internet_message_id].filter(x => x != null) : fields.parent_provider_ids || [];
  if (providerIds.some(x => !opaque(x))) return fail('INVALID_PARENT_PROVIDER_IDS');
  return { ok: true, metadata: {
    protocol: PREAI8_ADAPTER, run_id: fields.run_id, turn: fields.turn, role: fields.role,
    dispatch_key: fields.dispatch_key, parent_dispatch_key: fields.parent_dispatch_key ?? null,
    parent_provider_ids: [...providerIds],
    original_started_at: instant(hourly ? fields.started_at_utc : fields.original_started_at) ? iso(hourly ? fields.started_at_utc : fields.original_started_at) : null,
    lifecycle_revision: null, compatibility_only: true, live_format_verified: false,
    source_protocol: hourly || fields.source_protocol === PREAI8_HOURLY_PROTOCOL ? PREAI8_HOURLY_PROTOCOL : PREAI8_ADAPTER,
    source_metadata_revision: hourly ? fields.metadata_revision : fields.source_metadata_revision === 3 ? 3 : null
  } };
}

export function parsePreai8MessageMetadata(body) {
  if (typeof body !== 'string') return fail('PREAI8_METADATA_BLOCK_REQUIRED');
  const start = '--- PREAI8 METADATA ---', end = '--- END METADATA ---';
  const at = body.indexOf(start), stop = body.indexOf(end, at+start.length);
  if (at < 0 || stop < 0 || body.indexOf(start,at+start.length) >= 0 || body.indexOf(end,stop+end.length) >= 0) return fail('AMBIGUOUS_PREAI8_METADATA_BLOCK');
  const raw = body.slice(at+start.length,stop).trim();
  if (raw.length > 6000) return fail('PREAI8_METADATA_TOO_LARGE');
  let fields; try { fields = JSON.parse(raw); } catch { return fail('INVALID_PREAI8_METADATA_JSON'); }
  if (fields?.protocol !== PREAI8_HOURLY_PROTOCOL) return fail('UNSUPPORTED_PREAI8_PROTOCOL');
  return adaptPreai8Metadata(fields);
}

export function createEmailDialogue(input, { recipientAllowlist, now, runId = `EMAIL-${randomUUID()}` } = {}) {
  if (!instant(now) || !token(runId)) return fail('INVALID_CLOCK_OR_RUN_ID');
  if (!input || typeof input !== 'object') return fail('INPUT_REQUIRED');
  if (Object.keys(input).some(k => !['title', 'seed', 'recipient_ids', 'duration_seconds'].includes(k))) return fail('UNSUPPORTED_DIALOGUE_FIELD');
  if (!Array.isArray(input.recipient_ids) || input.recipient_ids.length !== 2 || new Set(input.recipient_ids).size !== 2) return fail('TWO_DISTINCT_ACCOUNT_IDS_REQUIRED');
  const accounts = input.recipient_ids.map(id => recipientAllowlist?.[id]);
  if (input.recipient_ids.some(x => !token(x)) || accounts.some(a => !a || a.bd_owned !== true || a.enabled !== true || !token(a.role) || !token(a.provider))) return fail('RECIPIENT_NOT_ALLOWED');
  if (accounts[0].role === accounts[1].role) return fail('DISTINCT_ROLES_REQUIRED');
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200 || /[\r\n\x00]/.test(input.title)) return fail('INVALID_TITLE');
  if (typeof input.seed !== 'string' || !input.seed.trim() || input.seed.length > 20000) return fail('INVALID_SEED');
  const seconds = input.duration_seconds ?? EMAIL_DEFAULT_WINDOW_SECONDS;
  if (!Number.isSafeInteger(seconds) || seconds < 60 || seconds > 366 * 86400) return fail('INVALID_DURATION');
  return { ok: true, run: {
    run_id: runId, run_kind: 'EMAIL_DIALOGUE', protocol: EMAIL_PROTOCOL,
    started_at: iso(now), managed_window_started_at: null, expires_at: null,
    requested_duration_seconds: seconds, status: 'CREATED', lifecycle_revision: 0,
    first_turn: 0, roles: accounts.map(a => a.role), account_ids: [...input.recipient_ids],
    required_sources: accounts.map((a, i) => `${a.provider}:${input.recipient_ids[i]}`),
    live_send_capability: 'UNVERIFIED', memory_import: 'FORBIDDEN',
    // Private fields: never project through the aggregate observatory.
    title: input.title.trim(), seed: input.seed,
    subject: `[AI8-EMAIL:${runId}] ${input.title.trim()}`
  } };
}

export function expectedEmailRole(run, turn) {
  const first = run?.first_turn;
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(turn) || turn < first || !Array.isArray(run.roles) || run.roles.length !== 2 || run.roles.some(x => !token(x)) || run.roles[0] === run.roles[1]) return null;
  return run.roles[(turn - first) % 2];
}

function sourceCoverage(required, supplied, nowMs) {
  const sources = required.map(id => {
    const item = supplied?.[id];
    const freshRead = item?.status === 'OK' && instant(item.measured_at) && Date.parse(item.measured_at) <= nowMs;
    return { source_id: id, status: freshRead ? 'OK' : 'SOURCE_BLOCKED', measured_at: freshRead ? iso(item.measured_at) : null };
  });
  const okCount = sources.filter(x => x.status === 'OK').length;
  return { status: required.length && okCount === required.length ? 'COMPLETE' : okCount ? 'PARTIAL' : 'SOURCE_BLOCKED', sources };
}

function recordEvidence(record) {
  const adapted = record.compatibility_adapter === PREAI8_ADAPTER
    ? adaptPreai8Metadata(record.metadata)
    : validateEmailMetadata(record.metadata);
  if (!adapted.ok) return adapted;
  if (!token(record.provider) || !token(record.account_id) || !['SENT', 'INBOX', 'DRAFT'].includes(record.folder)) return fail('INVALID_MAILBOX_SOURCE');
  const m = adapted.metadata;
  const providerId = opaque(record.provider_message_id) ? record.provider_message_id : null;
  const internetId = opaque(record.internet_message_id) ? record.internet_message_id : null;
  const lineageId = record.verified_lineage === true && opaque(record.verified_lineage_id) ? record.verified_lineage_id : null;
  const identityKeys = [`dispatch:${m.run_id}:${m.dispatch_key}`];
  if (internetId) identityKeys.push(`internet:${internetId}`);
  if (providerId) identityKeys.push(`provider:${record.provider}:${record.account_id}:${providerId}`);
  if (lineageId) identityKeys.push(`lineage:${lineageId}`);
  const bodyDigest = typeof record.body === 'string' ? digest(record.body)
    : /^[0-9a-f]{64}$/.test(record.body_digest || '') ? record.body_digest : null;
  const time = record.sent_at ?? record.received_at;
  return { ok: true, evidence: {
    metadata: m, identity_keys: identityKeys, source_id: `${record.provider}:${record.account_id}`,
    provider_id: providerId, folder: record.folder, body_digest: bodyDigest,
    sent_at: instant(time) ? iso(time) : null,
    delivered: record.folder === 'INBOX' || (record.folder === 'SENT' && record.delivery_confirmed === true),
    // Digest the complete normalized protocol metadata. Divergent copies cannot
    // silently replace expiry, role or lineage metadata.
    metadata_digest: digest(canonical(m))
  } };
}

export function reconcileMailboxMessages(records, { knownRuns = [], coverage = {}, now } = {}) {
  if (!Array.isArray(records) || !instant(now)) return fail('INVALID_RECONCILIATION_INPUT');
  const registered = new Map(knownRuns.map(r => [r.run_id, r]));
  const evidence = [], anomalies = [];
  records.forEach((record, index) => {
    const parsed = recordEvidence(record);
    if (!parsed.ok) { anomalies.push({ code: parsed.error, record_index: index,
      ...(registered.has(record?.metadata?.run_id) ? { run_id: record.metadata.run_id } : {}) }); return; }
    if (!registered.has(parsed.evidence.metadata.run_id)) { anomalies.push({ code: 'UNREGISTERED_RUN', record_index: index }); return; }
    const run = registered.get(parsed.evidence.metadata.run_id);
    if (!run.required_sources?.includes(parsed.evidence.source_id)) { anomalies.push({ code: 'UNREGISTERED_SOURCE', run_id: run.run_id, record_index: index }); return; }
    evidence.push(parsed.evidence);
  });
  // Union all verified identities: a later Inbox copy may bridge a provider-only
  // observation with a dispatch-key observation. Identity conflicts quarantine
  // the whole component, including copies from another registered run.
  const parents = evidence.map((_, i) => i), identities = new Map();
  const find = i => parents[i] === i ? i : (parents[i] = find(parents[i]));
  evidence.forEach((e, i) => e.identity_keys.forEach(key => {
    if (identities.has(key)) parents[find(i)] = find(identities.get(key));
    else identities.set(key, i);
  }));
  const groups = new Map();
  evidence.forEach((e, i) => { const key = find(i); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(e); });
  const messages = [];
  for (const copies of groups.values()) {
    const m = copies[0].metadata;
    const bodyHashes = new Set(copies.map(c => c.body_digest).filter(Boolean));
    const metaHashes = new Set(copies.map(c => c.metadata_digest));
    if (bodyHashes.size > 1 || metaHashes.size > 1) {
      for (const runId of new Set(copies.map(c => c.metadata.run_id))) anomalies.push({ code: 'LOGICAL_MESSAGE_CONFLICT', run_id: runId, dispatch_key: m.dispatch_key });
      continue;
    }
    const sent = copies.some(c => c.folder !== 'DRAFT');
    const times = copies.filter(c => c.folder !== 'DRAFT').map(c => c.sent_at).filter(Boolean).sort();
    messages.push({ ...m, logical_key: digest(copies.flatMap(c => c.identity_keys).sort().join('\n')),
      source_ids: [...new Set(copies.map(c => c.source_id))].sort(),
      provider_ids: [...new Set(copies.map(c => c.provider_id).filter(Boolean))].sort(),
      sent, delivered: copies.some(c => c.delivered), draft_only: !sent,
      sent_at: times[0] ?? null, copies: copies.length });
  }
  const runs = knownRuns.map(run => {
    const mine = messages.filter(m => m.run_id === run.run_id).sort((a,b) => a.turn - b.turn || a.dispatch_key.localeCompare(b.dispatch_key));
    const runAnomalies = anomalies.filter(a => a.run_id === run.run_id);
    const atTurn = new Map();
    for (const m of mine.filter(m => m.sent)) {
      if (!atTurn.has(m.turn)) atTurn.set(m.turn, []);
      atTurn.get(m.turn).push(m);
      if (m.role !== expectedEmailRole(run, m.turn)) runAnomalies.push({ code: 'ROLE_PARITY', run_id: run.run_id, turn: m.turn });
    }
    for (const [turn, candidates] of atTurn) if (candidates.length > 1) runAnomalies.push({ code: 'TURN_FORK', run_id: run.run_id, turn });
    const chain = [];
    let turn = run.first_turn;
    while (Number.isSafeInteger(turn) && atTurn.has(turn)) {
      const candidates = atTurn.get(turn);
      if (candidates.length !== 1) break;
      const m = candidates[0], parent = chain.at(-1);
      if (m.role !== expectedEmailRole(run, turn)) break;
      const parentMatches = parent && (m.parent_dispatch_key === parent.dispatch_key
        || (!m.parent_dispatch_key && m.parent_provider_ids.some(id => parent.provider_ids.includes(id))));
      if ((turn === run.first_turn && (m.parent_dispatch_key || m.parent_provider_ids.length))
        || (turn > run.first_turn && (!parentMatches || !parent.delivered))) {
        runAnomalies.push({ code: 'INVALID_OR_UNDELIVERED_PARENT', run_id: run.run_id, turn }); break;
      }
      chain.push(m); turn++;
    }
    if (mine.some(m => m.sent && !chain.includes(m)) && !runAnomalies.length) runAnomalies.push({ code: 'LINEAGE_GAP', run_id: run.run_id });
    const sourceState = sourceCoverage(run.required_sources || [], coverage, Date.parse(now));
    const last = chain.at(-1) ?? null;
    return { run_id: run.run_id, messages: mine, valid_chain: chain, anomalies: runAnomalies,
      coverage: sourceState, highest_valid_turn: last?.turn ?? null,
      last_writer: last?.role ?? null, next_expected_role: expectedEmailRole(run, last ? last.turn + 1 : run.first_turn),
      unanswered_parent: last?.delivered && !runAnomalies.length ? last : null };
  });
  return { ok: true, measured_at: iso(now), messages, runs, anomalies };
}

function intervalStats(messages) {
  const times = messages.filter(m => m.sent && instant(m.sent_at)).map(m => Date.parse(m.sent_at)).sort((a,b) => a-b);
  const intervals = times.slice(1).map((time, i) => (time-times[i])/1000);
  const sorted = [...intervals].sort((a,b) => a-b), n = sorted.length;
  return { first_activity_at: times.length ? iso(times[0]) : null, last_activity_at: times.length ? iso(times.at(-1)) : null,
    interval_seconds: { count: n, mean: n ? intervals.reduce((a,b) => a+b,0)/n : null,
      median: n ? (sorted[Math.floor((n-1)/2)] + sorted[Math.ceil((n-1)/2)])/2 : null }, intervals };
}

export function buildEmailObservatory({ reconciliation, generatedAt, measuredAt, refreshSeconds = 3600, staleAfterSeconds = refreshSeconds * 2 } = {}) {
  if (!reconciliation?.ok || !instant(generatedAt) || !instant(measuredAt)
    || !Number.isSafeInteger(refreshSeconds) || refreshSeconds < 1
    || !Number.isSafeInteger(staleAfterSeconds) || staleAfterSeconds < 1 || staleAfterSeconds > refreshSeconds * 2) return fail('INVALID_OBSERVATORY_INPUT');
  // measuredAt must originate from actual reconciliation, never reserialization.
  if (iso(measuredAt) !== reconciliation.measured_at || Date.parse(measuredAt) > Date.parse(generatedAt)) return fail('INVALID_MEASUREMENT_TIME');
  const runs = reconciliation.runs.map(run => {
    const stats = intervalStats(run.messages), sent = run.messages.filter(m => m.sent);
    const coveredAt = run.coverage.sources.filter(s => s.status === 'OK').map(s => s.measured_at).sort();
    const cutoff = coveredAt[0] ?? null;
    const stale = !cutoff || Date.parse(generatedAt)-Date.parse(cutoff) >= staleAfterSeconds*1000;
    return { run_id: run.run_id, logical_message_count: sent.length,
      delivered_message_count: run.messages.filter(m => m.delivered).length,
      draft_count: run.messages.filter(m => m.draft_only).length,
      completed_reply_round_count: Math.floor(run.valid_chain.filter(m => m.delivered).length / 2),
      highest_valid_turn: run.highest_valid_turn,
      last_writer: run.last_writer, next_expected_role: run.next_expected_role,
      delivery_state: run.anomalies.length ? 'ANOMALY' : run.valid_chain.at(-1)?.delivered ? 'DELIVERED' : sent.length ? 'PENDING_DELIVERY' : 'NO_SENT_EVIDENCE',
      first_activity_at: stats.first_activity_at, last_activity_at: stats.last_activity_at,
      interval_seconds: stats.interval_seconds,
      measured_at: cutoff, source_coverage: structuredClone(run.coverage),
      freshness: run.coverage.status !== 'COMPLETE' ? run.coverage.status : stale ? 'STALE' : 'FRESH',
      anomaly_count: run.anomalies.length };
  });
  const allIntervals = reconciliation.runs.flatMap(r => intervalStats(r.messages).intervals).sort((a,b) => a-b);
  const n = allIntervals.length;
  const measuredCutoffs = runs.map(r => r.measured_at).filter(Boolean).sort();
  return { ok: true, schema_version: 'WL_EMAIL_OBSERVATORY_v1', generated_at: iso(generatedAt),
    measured_at: measuredCutoffs[0] ?? null, reconciliation_completed_at: iso(measuredAt),
    refresh_seconds: refreshSeconds, stale_after_seconds: staleAfterSeconds,
    freshness: !runs.length || runs.every(r => r.freshness === 'SOURCE_BLOCKED') ? 'SOURCE_BLOCKED'
      : runs.some(r => ['PARTIAL', 'SOURCE_BLOCKED'].includes(r.freshness)) ? 'PARTIAL'
      : runs.some(r => r.freshness === 'STALE') ? 'STALE' : 'FRESH',
    privacy: 'AGGREGATES_ONLY_NO_EMAIL_BODIES_OR_ADDRESSES', derived_only: true, research_memory_import: false,
    logical_message_total: runs.reduce((sum,r) => sum+r.logical_message_count,0),
    interval_basis: 'POOLED_WITHIN_RUN_INTERVALS_ONLY',
    interval_seconds: { count: n, mean: n ? allIntervals.reduce((a,b) => a+b,0)/n : null,
      median: n ? (allIntervals[Math.floor((n-1)/2)] + allIntervals[Math.ceil((n-1)/2)])/2 : null },
    runs };
}

// Preserve healthy existing aggregate values without upgrading a generation time
// into measurement evidence. This is an allowlist projection of the current
// PREAI8 v1 snapshot, suitable for its existing public/private UI consumer.
export function guardLegacyEmailSnapshot(snapshot, { now, refreshSeconds = 3600 } = {}) {
  if (!instant(now) || !Number.isSafeInteger(refreshSeconds) || refreshSeconds < 1) return fail('INVALID_SNAPSHOT_CLOCK');
  const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  const measured = instant(snapshot?.measured_at) ? iso(snapshot.measured_at) : null;
  const generated = instant(snapshot?.generated_at) ? iso(snapshot.generated_at) : null;
  const stale = measured && Date.parse(now)-Date.parse(measured) >= refreshSeconds*2000;
  const sourceComplete = snapshot?.source_coverage?.status === 'COMPLETE';
  const runs = ['A', 'B'].map(label => {
    const item = snapshot?.email_plane?.[label], stats = snapshot?.observatory?.email?.runs?.[label];
    return { run_id: `PREAI8-20260912-${label}`, verified_turn: number(item?.verified_turn),
      logical_message_count: number(stats?.messages), interval_count: number(stats?.intervals),
      mean_interval_seconds: number(stats?.mean_interval_seconds), median_interval_seconds: number(stats?.median_interval_seconds),
      last_activity_at: instant(item?.updated_at) ? iso(item.updated_at) : null };
  });
  return { ok: true, schema_version: 'WL_PREAI8_LEGACY_PROJECTION_v1', generated_at: iso(now),
    source_generated_at: generated, measured_at: measured,
    freshness: !measured ? 'SOURCE_BLOCKED' : !sourceComplete ? 'PARTIAL' : stale ? 'STALE' : 'FRESH',
    counts_basis: !measured || !sourceComplete || stale ? 'HISTORICAL_SNAPSHOT_NOT_CURRENT_TOTALS' : 'MEASURED_AGGREGATE',
    refresh_seconds: refreshSeconds, stale_after_seconds: refreshSeconds*2,
    privacy: 'AGGREGATES_ONLY_NO_EMAIL_BODIES_OR_ADDRESSES', derived_only: true, research_memory_import: false,
    logical_message_total: number(snapshot?.observatory?.email?.total_messages),
    interval_basis: 'POOLED_WITHIN_RUN_INTERVALS_ONLY',
    interval_seconds: { count: number(snapshot?.observatory?.email?.logical_within_run_intervals),
      mean: number(snapshot?.observatory?.email?.mean_within_run_interval_seconds),
      median: number(snapshot?.observatory?.email?.median_within_run_interval_seconds) }, runs };
}

function active(run, now) {
  return !BLOCKED.has(run?.status) && run?.status === 'ACTIVE' && instant(now) && instant(run.expires_at)
    && instant(run.managed_window_started_at) && Date.parse(now) >= Date.parse(run.managed_window_started_at)
    && Date.parse(now) < Date.parse(run.expires_at);
}

export function selectEmailWork({ runs = [], reconciliation, invocationId, cursor = 0, globalCap = 1, lifecycleGate, now } = {}) {
  if (!token(invocationId) || !Number.isSafeInteger(globalCap) || globalCap < 1 || globalCap > 100 || !Number.isSafeInteger(cursor) || cursor < 0 || !instant(now)) return fail('INVALID_WORK_SELECTION');
  if (!reconciliation?.ok || typeof lifecycleGate !== 'function') return fail('EVIDENCE_AND_LIFECYCLE_GATE_REQUIRED');
  const ordered = [...runs].filter(r => r.run_kind === 'EMAIL_DIALOGUE').sort((a,b) => a.run_id.localeCompare(b.run_id));
  const selected = [], skipped = [], seen = new Set();
  let scanned = 0;
  while (scanned < ordered.length && selected.length < globalCap) {
    const index = (cursor+scanned) % ordered.length, run = ordered[index]; scanned++;
    if (seen.has(run.run_id)) continue;
    seen.add(run.run_id);
    const evidence = reconciliation.runs.find(r => r.run_id === run.run_id);
    const deny = reason => skipped.push({ run_id: run.run_id, reason });
    if (!active(run, now) || lifecycleGate({ run, now, phase: 'PLAN' })?.allowed !== true) { deny('LIFECYCLE_BLOCKED'); continue; }
    if (run.last_email_invocation_id === invocationId) { deny('ALREADY_HANDLED_INVOCATION'); continue; }
    if (run.pending_email_dispatch) { deny('SEND_RECONCILIATION_REQUIRED'); continue; }
    if (!evidence || evidence.coverage.status !== 'COMPLETE') { deny('BOTH_MAILBOXES_REQUIRED'); continue; }
    const maxAge = run.mailbox_max_age_seconds ?? 300;
    if (!Number.isSafeInteger(maxAge) || maxAge < 1 || evidence.coverage.sources.some(s => !instant(s.measured_at)
      || Date.parse(now)-Date.parse(s.measured_at) > maxAge*1000)) { deny('FRESH_MAILBOX_MEASUREMENT_REQUIRED'); continue; }
    if (evidence.anomalies.length) { deny('LINEAGE_ANOMALY'); continue; }
    const last = evidence.valid_chain.at(-1);
    if (last && !last.delivered) { deny('PARENT_NOT_DELIVERED'); continue; }
    if (!last && (LEGACY_RUNS.has(run.run_id) || run.has_existing_history === true)) { deny('EXISTING_HISTORY_NOT_RECONSTRUCTED'); continue; }
    if (!last && evidence.messages.some(m => m.sent)) { deny('LINEAGE_INCOMPLETE'); continue; }
    const nextTurn = last ? last.turn+1 : run.first_turn;
    if (run.cadence_seconds && last?.sent_at && Date.parse(now)-Date.parse(last.sent_at) < run.cadence_seconds*1000) { deny('CADENCE_NOT_DUE'); continue; }
    // Stable identity is shared by event/hourly/manual invocations, not derived
    // from invocation identity. Root must reserve this key atomically.
    const dispatchKey = `email:${digest(`${run.run_id}\n${nextTurn}\n${last?.dispatch_key ?? 'SEED'}`).slice(0,40)}`;
    selected.push({ run_id: run.run_id, turn: nextTurn, role: expectedEmailRole(run, nextTurn),
      dispatch_key: dispatchKey, parent_dispatch_key: last?.dispatch_key ?? null,
      parent_provider_ids: last?.provider_ids ?? [], worker_invocation_id: invocationId,
      lifecycle_revision: run.lifecycle_revision, planned_at: iso(now),
      no_catch_up: true, max_messages: 1 });
  }
  return { ok: true, selected, skipped, next_cursor: ordered.length ? (cursor+scanned)%ordered.length : 0,
    requires_atomic_reservation: true, live_send_claimed: false };
}

export function emailEffectGate({ run, plan, permit, lifecycleGate, now } = {}) {
  if (!active(run, now)) return fail('LIFECYCLE_BLOCKED');
  if (!plan || plan.run_id !== run.run_id || plan.lifecycle_revision !== run.lifecycle_revision) return fail('STALE_EMAIL_PLAN');
  if (!token(plan.dispatch_key) || !token(plan.worker_invocation_id) || plan.role !== expectedEmailRole(run, plan.turn)) return fail('INVALID_EMAIL_PLAN');
  if (run.live_send_capability !== 'VERIFIED') return fail('LIVE_SEND_CAPABILITY_UNVERIFIED');
  if (!permit || typeof lifecycleGate !== 'function') return fail('PERMIT_GATE_REQUIRED');
  if (run.pending_email_dispatch && run.pending_email_dispatch !== plan.dispatch_key) return fail('SEND_RECONCILIATION_REQUIRED');
  const checked = lifecycleGate({ run, plan, permit, now, phase: 'IMMEDIATELY_BEFORE_SEND' });
  return checked?.allowed === true ? { ok: true, live_send_claimed: false } : fail('PERMIT_OR_LIFECYCLE_DENIED');
}

// Private metadata-only state. A reserve is not send authorization. State storage
// must use an atomic CAS/transaction; uncertain external effects remain blocked
// until positive mailbox evidence reconciles them. Absence never proves no send.
export function reduceEmailDispatch(state = {}, event = {}) {
  const next = structuredClone(state);
  next.dispatches ||= {}; next.invocations ||= {}; next.answered_parents ||= {};
  if (!token(event.run_id) || !token(event.dispatch_key) || !instant(event.at)) return { state, result: fail('INVALID_DISPATCH_EVENT') };
  const key = `${event.run_id}:${event.dispatch_key}`, prior = next.dispatches[key];
  if (event.type === 'RESERVE') {
    if (!token(event.invocation_id) || !Number.isSafeInteger(event.turn) || event.turn < 0 || (event.parent_dispatch_key !== null && !token(event.parent_dispatch_key))) return { state, result: fail('INVALID_RESERVATION') };
    const fingerprint = digest(JSON.stringify([event.run_id, event.dispatch_key, event.turn, event.parent_dispatch_key]));
    if (prior) return { state, result: prior.fingerprint === fingerprint ? { ok: true, replay: true, status: prior.status, effect_allowed: false } : fail('DISPATCH_CONFLICT') };
    const invocationKey = `${event.run_id}:${event.invocation_id}`;
    if (next.invocations[invocationKey]) return { state, result: fail('ONE_MESSAGE_PER_RUN_INVOCATION') };
    const parentKey = `${event.run_id}:${event.parent_dispatch_key ?? 'SEED'}`;
    if (next.answered_parents[parentKey]) return { state, result: fail('PARENT_ALREADY_RESERVED_OR_ANSWERED') };
    if (Object.values(next.dispatches).some(d => d.run_id === event.run_id && ['RESERVED', 'SENDING', 'UNCERTAIN', 'SENT_PENDING_DELIVERY'].includes(d.status))) return { state, result: fail('SEND_RECONCILIATION_REQUIRED') };
    next.dispatches[key] = { run_id: event.run_id, dispatch_key: event.dispatch_key, turn: event.turn,
      parent_dispatch_key: event.parent_dispatch_key, invocation_id: event.invocation_id,
      fingerprint, status: 'RESERVED', reserved_at: iso(event.at) };
    next.invocations[invocationKey] = event.dispatch_key; next.answered_parents[parentKey] = event.dispatch_key;
    return { state: next, result: { ok: true, status: 'RESERVED', effect_allowed: false } };
  }
  if (!prior) return { state, result: fail('DISPATCH_NOT_RESERVED') };
  if (event.type === 'BEGIN_SEND') {
    if (prior.status !== 'RESERVED') return { state, result: fail('DISPATCH_NOT_SENDABLE') };
    // Opaque authoritative gate receipt supplied by root after emailEffectGate;
    // not a browser-supplied boolean and not itself a permit minting mechanism.
    if (event.gate_receipt?.allowed !== true || event.gate_receipt.dispatch_key !== event.dispatch_key) return { state, result: fail('EFFECT_GATE_REQUIRED') };
    prior.status = 'SENDING'; prior.send_started_at = iso(event.at);
  } else if (event.type === 'UNCERTAIN') {
    if (!['SENDING', 'UNCERTAIN'].includes(prior.status)) return { state, result: fail('INVALID_DISPATCH_TRANSITION') };
    prior.status = 'UNCERTAIN'; prior.uncertain_at = iso(event.at);
  } else if (event.type === 'RECONCILE') {
    const proof = event.mailbox_evidence;
    if (!proof || proof.run_id !== event.run_id || proof.dispatch_key !== event.dispatch_key || proof.sent !== true || proof.draft_only === true || !Array.isArray(proof.source_ids) || !proof.source_ids.length || !instant(proof.measured_at)) return { state, result: fail('POSITIVE_MAILBOX_EVIDENCE_REQUIRED') };
    if (Date.parse(proof.measured_at) < Date.parse(prior.reserved_at)
      || (prior.measured_at && Date.parse(proof.measured_at) < Date.parse(prior.measured_at))
      || Date.parse(proof.measured_at) > Date.parse(event.at)) return { state, result: fail('STALE_MAILBOX_EVIDENCE') };
    prior.status = proof.delivered === true || prior.status === 'DELIVERED' ? 'DELIVERED' : 'SENT_PENDING_DELIVERY';
    prior.reconciled_at = iso(event.at); prior.measured_at = iso(proof.measured_at);
  } else return { state, result: fail('UNKNOWN_DISPATCH_EVENT') };
  return { state: next, result: { ok: true, status: prior.status, passive_only: event.type === 'RECONCILE', effect_allowed: false } };
}

export function isProtectedEmailThread({ runId, threadId, registeredRuns = [] } = {}) {
  return registeredRuns.some(r => r.run_kind === 'EMAIL_DIALOGUE' && (r.run_id === runId
    || (opaque(threadId) && Array.isArray(r.thread_ids) && r.thread_ids.includes(threadId))));
}
