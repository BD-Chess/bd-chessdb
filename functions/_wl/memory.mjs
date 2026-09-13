/**
 * WL Session Memory v1: private source/capsule persistence and bounded retrieval.
 *
 * Store contract: read() -> root; mutate(fn) atomically commits a draft root and
 * returns fn(draft)'s JSON-safe result. fn is synchronous and side-effect free;
 * the store may retry it. A failed callback must not commit. Use an encrypted
 * server store, or wrap that interface with createEncryptedMemoryStore below.
 *
 * authorize(context, request) is MANDATORY, synchronous, and fail-closed. It must
 * check trusted CURRENT identity/control/source+target scopes and revocations;
 * never construct context permissions from request/capsule text. Store rollback
 * cannot roll back that external control authority. Whole-store rollback needs
 * an external monotonic control head; this module does not claim to create one.
 *
 * Context verified_test_digests/artifact_digests must be server-derived receipts,
 * not caller assertions. Content origin annotations are validated, not magically
 * discovered: intake still needs trusted classification of allowed source bytes.
 * Local tests of these adapters are not live capture/cold-start/model evidence.
 */
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const MEMORY_SCHEMA = 'wl.memory.state.v1';
export const SOURCE_SCHEMA = 'wl.memory.source.v1';
export const CAPSULE_SCHEMA = 'wl.memory.capsule.v1';
const COVERAGE = new Set(['FULL_AT_SNAPSHOT', 'SELECTED_RANGES', 'VISIBLE_CONTEXT_ONLY']);
const PRIVACY = new Set(['WL_PRIVATE_RAW', 'WL_PRIVATE_DERIVED']);
const ORIGINS = new Set(['PROJECT_SESSION', 'PROJECT_ATTACHMENT', 'TOOL_OUTPUT', 'PUBLIC_REFERENCE']);
const ITEM_ORIGINS = new Set(['VISIBLE_USER_STATEMENT', 'ASSISTANT_STATEMENT', 'TOOL_OBSERVATION', 'SOURCE_QUOTATION', 'EXTRACTOR_INFERENCE', 'UNKNOWN']);
const EPISTEMIC = new Set(['PREVERJENO', 'PODPRTO', 'SKLEPANJE', 'HIPOTEZA', 'SPEKULACIJA', 'ODPRTO', 'OVRŽENO']);
const ITEM_TYPES = new Set(['INTENT', 'CLAIM', 'DECISION', 'COUNTERARGUMENT', 'FAILURE', 'TEST', 'ALTERNATIVE', 'LESSON', 'REOPEN', 'NEXT_ACTION']);
const RELATIONS = new Set(['supports', 'contradicts', 'supersedes', 'derived_from', 'tested_by', 'implemented_in', 'reopens', 'next_step', 'uses_lesson']);
const MAX_SOURCE_BYTES = 1024 * 1024;
const MAX_CAPSULE_BYTES = 128 * 1024;
const MAX_PACKET_CHARS = 48000;
const MAX_MEMORY_BYTES = 1024 * 1024;
const clone = value => structuredClone(value);
const fail = code => { const error = new Error(code); error.code = code; throw error; };
const need = (condition, code) => { if (!condition) fail(code); };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const string = value => typeof value === 'string' && value.length > 0;
const digestString = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const strings = value => Array.isArray(value) && value.every(string);

export function canonicalMemoryJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { need(Number.isFinite(value), 'NONFINITE_JSON'); return JSON.stringify(value); }
  if (Array.isArray(value)) return '[' + value.map(canonicalMemoryJson).join(',') + ']';
  need(record(value) && Object.getPrototypeOf(value) === Object.prototype, 'INVALID_JSON_OBJECT');
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalMemoryJson(value[key])).join(',') + '}';
}

export function memoryDigest(value) {
  return createHash('sha256').update(Buffer.isBuffer(value) ? value : typeof value === 'string' ? value : canonicalMemoryJson(value)).digest('hex');
}

function fields(object, required, optional = []) {
  need(record(object), 'INVALID_OBJECT');
  for (const key of required) need(Object.hasOwn(object, key), 'MISSING_FIELD_' + key);
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(object)) need(allowed.has(key), 'UNKNOWN_FIELD_' + key);
}

function rejectSensitive(text) {
  // Conservative lexical guards supplement trusted source classification.
  need(!/-----BEGIN (?:[A-Z ]*PRIVATE KEY)-----|\b(?:sk|ghp|gho|github_pat)[-_][A-Za-z0-9_]{16,}|\b(?:password|api[_ -]?key|access[_ -]?token|client[_ -]?secret)\s*[:=]\s*\S+/i.test(text), 'SECRET_PAYLOAD_REJECTED');
  need(!/(?:PREAI8|PRE[-_ ]AI8)[\s\S]{0,100}(?:email body|mail body|quoted email|telo (?:e-?pošte|emaila))|(?:email body|quoted email)[\s\S]{0,100}(?:PREAI8|PRE[-_ ]AI8)/i.test(text), 'PREAI8_EMAIL_CONTENT_REJECTED');
}

function sourceBytes(source) {
  need(typeof source.bytes_base64 === 'string' && source.bytes_base64.length <= MAX_SOURCE_BYTES * 2, 'SOURCE_SIZE_INVALID');
  const bytes = Buffer.from(source.bytes_base64, 'base64');
  need(bytes.length > 0 && bytes.length <= MAX_SOURCE_BYTES && bytes.toString('base64') === source.bytes_base64, 'SOURCE_BYTES_INVALID');
  return bytes;
}

function validateRanges(ranges, length) {
  need(Array.isArray(ranges) && ranges.length > 0, 'COVERAGE_RANGES_REQUIRED');
  let last = 0;
  for (const range of ranges) {
    fields(range, ['start', 'end']);
    need(Number.isSafeInteger(range.start) && Number.isSafeInteger(range.end) && range.start >= last && range.end > range.start && range.end <= length, 'COVERAGE_RANGE_INVALID');
    last = range.end;
  }
}

export function validateMemorySource(source) {
  fields(source, ['schema', 'source_snapshot_id', 'project_id', 'source_session_id', 'branch_id', 'source_identity_kind', 'provider_session_id', 'source_provider', 'execution_surface', 'actor_identity_ref', 'project_membership_evidence_ref', 'source_scope_ref', 'retention_scope_ref', 'acquisition_mode', 'source_frontier', 'captured_at', 'privacy_class', 'origin_domains', 'bytes_base64', 'bytes_digest', 'representation_utf8', 'representation_digest', 'normalizer_ref', 'coverage', 'lineage_refs']);
  need(source.schema === SOURCE_SCHEMA, 'SOURCE_SCHEMA_INVALID');
  for (const key of ['source_snapshot_id', 'project_id', 'source_session_id', 'branch_id', 'source_provider', 'execution_surface', 'actor_identity_ref', 'project_membership_evidence_ref', 'source_scope_ref', 'retention_scope_ref', 'source_frontier']) need(string(source[key]), 'SOURCE_IDENTITY_REQUIRED');
  need(['BRIDGE_SCOPED', 'PROVIDER_OBSERVED'].includes(source.source_identity_kind), 'SOURCE_IDENTITY_INVALID');
  need(source.source_identity_kind === 'PROVIDER_OBSERVED' ? string(source.provider_session_id) : source.provider_session_id === null, 'PROVIDER_ID_NOT_OBSERVED');
  need(['SESSION_SIDE_CHECKPOINT', 'VERIFIED_SCOPED_HISTORY_ADAPTER', 'HUMAN_ASSISTED_EXPORT_IMPORT'].includes(source.acquisition_mode), 'SOURCE_UNAVAILABLE_TO_EXECUTOR');
  need(timestamp(source.captured_at) && PRIVACY.has(source.privacy_class), 'SOURCE_PRIVACY_OR_TIME_INVALID');
  need(strings(source.origin_domains) && source.origin_domains.length > 0 && source.origin_domains.every(x => ORIGINS.has(x)), 'SOURCE_ORIGIN_FORBIDDEN');
  need(strings(source.lineage_refs), 'SOURCE_LINEAGE_INVALID');
  const bytes = sourceBytes(source);
  need(digestString(source.bytes_digest) && memoryDigest(bytes) === source.bytes_digest, 'SOURCE_DIGEST_MISMATCH');
  // The initial adapter is exact UTF-8; binary attachments remain separate handles.
  need(Buffer.from(bytes.toString('utf8'), 'utf8').equals(bytes), 'SOURCE_UTF8_INVALID');
  rejectSensitive(bytes.toString('utf8'));
  need(typeof source.representation_utf8 === 'string', 'REPRESENTATION_REQUIRED');
  need(Buffer.byteLength(source.representation_utf8) <= MAX_SOURCE_BYTES && memoryDigest(Buffer.from(source.representation_utf8)) === source.representation_digest, 'REPRESENTATION_DIGEST_MISMATCH');
  const originalText = bytes.toString('utf8');
  if (source.representation_utf8 === originalText) {
    need(source.normalizer_ref === null || source.normalizer_ref === 'identity-v1', 'NORMALIZER_UNSUPPORTED');
  } else {
    need(source.normalizer_ref === 'crlf-to-lf-v1' && source.representation_utf8 === originalText.replace(/\r\n/g, '\n'), 'NORMALIZATION_NOT_REPRODUCIBLE');
  }
  rejectSensitive(source.representation_utf8);
  fields(source.coverage, ['mode', 'ranges', 'complete_inventory', 'total_source_bytes', 'missing_artifact_refs']);
  need(COVERAGE.has(source.coverage.mode), 'COVERAGE_UNSUPPORTED');
  need(typeof source.coverage.complete_inventory === 'boolean' && strings(source.coverage.missing_artifact_refs), 'COVERAGE_INVALID');
  validateRanges(source.coverage.ranges, bytes.length);
  if (source.coverage.mode === 'FULL_AT_SNAPSHOT') {
    need(source.coverage.complete_inventory === true && source.coverage.total_source_bytes === bytes.length && source.coverage.ranges.length === 1 && source.coverage.ranges[0].start === 0 && source.coverage.ranges[0].end === bytes.length, 'FULL_COVERAGE_UNPROVEN');
  } else {
    need(source.coverage.complete_inventory === false && (source.coverage.total_source_bytes === null || Number.isSafeInteger(source.coverage.total_source_bytes) && source.coverage.total_source_bytes >= bytes.length), 'PARTIAL_COVERAGE_INVALID');
  }
  return clone(source);
}

export function memorySourceRef(source) {
  return 'src-' + memoryDigest([source.project_id, source.source_session_id, source.branch_id, source.source_snapshot_id]);
}

export function memoryCapsuleRef(capsule) {
  return 'cap-' + memoryDigest([capsule.project_id, capsule.capsule_id, capsule.revision]);
}

export function memoryCapsuleDigest(capsule) {
  const { payload_digest, ...payload } = capsule;
  return memoryDigest(payload);
}

function checkSpan(span, source) {
  fields(span, ['domain', 'start', 'end', 'digest']);
  need(['BYTES', 'REPRESENTATION_UTF8'].includes(span.domain), 'SPAN_DOMAIN_INVALID');
  const bytes = span.domain === 'BYTES' ? sourceBytes(source) : Buffer.from(source.representation_utf8);
  need(Number.isSafeInteger(span.start) && Number.isSafeInteger(span.end) && span.start >= 0 && span.end > span.start && span.end <= bytes.length, 'SPAN_RANGE_INVALID');
  // Prevent spans that cut through UTF-8 code points, or cite uncaptured original ranges.
  const slice = bytes.subarray(span.start, span.end);
  need(Buffer.from(slice.toString('utf8')).equals(slice), 'SPAN_UTF8_BOUNDARY');
  if (span.domain === 'BYTES') need(source.coverage.ranges.some(r => span.start >= r.start && span.end <= r.end), 'SPAN_OUTSIDE_COVERAGE');
  else need(source.coverage.ranges.length === 1 && source.coverage.ranges[0].start === 0 && source.coverage.ranges[0].end === sourceBytes(source).length, 'REPRESENTATION_COVERAGE_MAPPING_REQUIRED');
  need(memoryDigest(slice) === span.digest, 'SPAN_DIGEST_MISMATCH');
}

export function validateMemoryCapsule(capsule, source, context = {}) {
  fields(capsule, ['schema', 'capsule_id', 'revision', 'supersedes_ref', 'project_id', 'source_ref', 'source_digest', 'source_coverage', 'memory_scope', 'lab_id', 'items', 'relations', 'artifacts', 'next_handles', 'extractor_version', 'extraction_contract_ref', 'extraction_receipt_ref', 'model_observation', 'privacy_class', 'retention_scope_ref', 'allowed_use', 'payload_digest']);
  need(capsule.schema === CAPSULE_SCHEMA && string(capsule.capsule_id) && Number.isSafeInteger(capsule.revision) && capsule.revision > 0, 'CAPSULE_IDENTITY_INVALID');
  need(capsule.supersedes_ref === null || string(capsule.supersedes_ref), 'SUPERSEDES_INVALID');
  need(capsule.project_id === source.project_id && capsule.source_ref === memorySourceRef(source) && capsule.source_digest === memoryDigest(source), 'CAPSULE_SOURCE_MISMATCH');
  need(canonicalMemoryJson(capsule.source_coverage) === canonicalMemoryJson(source.coverage), 'CAPSULE_COVERAGE_MISMATCH');
  need(['PROJECT_LIBRARY', 'LAB_SCOPED'].includes(capsule.memory_scope) && (capsule.memory_scope === 'LAB_SCOPED' ? string(capsule.lab_id) : capsule.lab_id === null), 'CAPSULE_SCOPE_INVALID');
  need(PRIVACY.has(capsule.privacy_class) && capsule.retention_scope_ref === source.retention_scope_ref && strings(capsule.allowed_use) && capsule.allowed_use.length > 0, 'CAPSULE_PRIVACY_INVALID');
  need(string(capsule.extractor_version) && string(capsule.extraction_contract_ref) && string(capsule.extraction_receipt_ref), 'EXTRACTION_CONTRACT_REQUIRED');
  if (capsule.model_observation !== null) {
    fields(capsule.model_observation, ['provider', 'model_id', 'invocation_ref']);
    need(string(capsule.model_observation.provider) && string(capsule.model_observation.model_id) && (context.verified_model_invocation_refs || []).includes(capsule.model_observation.invocation_ref), 'MODEL_INVOCATION_NOT_OBSERVED');
  }
  need(Array.isArray(capsule.items) && capsule.items.length > 0 && capsule.items.length <= 256 && capsule.items.some(item => item.type === 'INTENT'), 'CAPSULE_ITEMS_REQUIRED');
  const ids = new Set();
  for (const item of capsule.items) {
    fields(item, ['item_id', 'type', 'text', 'origin_kind', 'speaker_observation', 'source_spans', 'epistemic_status', 'evidence_class', 'evidence_refs', 'instruction_taint']);
    need(string(item.item_id) && !ids.has(item.item_id), 'ITEM_ID_CONFLICT'); ids.add(item.item_id);
    need(ITEM_TYPES.has(item.type) && string(item.text) && ITEM_ORIGINS.has(item.origin_kind) && (item.speaker_observation === null || string(item.speaker_observation)), 'ITEM_INVALID');
    need(EPISTEMIC.has(item.epistemic_status) && ['REPORTED_RESULT', 'VERIFIED_TEST_RESULT', 'TEST_PROPOSED', 'UNKNOWN'].includes(item.evidence_class) && strings(item.evidence_refs), 'ITEM_EVIDENCE_INVALID');
    need(item.instruction_taint === true, 'INSTRUCTION_TAINT_REQUIRED');
    need(Array.isArray(item.source_spans) && item.source_spans.length > 0, 'ITEM_SOURCE_REQUIRED');
    item.source_spans.forEach(span => checkSpan(span, source)); rejectSensitive(item.text);
    if (item.evidence_class === 'VERIFIED_TEST_RESULT' || item.epistemic_status === 'PREVERJENO') {
      need(item.evidence_class === 'VERIFIED_TEST_RESULT' && item.evidence_refs.length > 0 && item.evidence_refs.every(ref => (context.verified_test_digests || []).includes(ref)), 'REPORTED_RESULT_NOT_VERIFIED');
    }
    if (item.type === 'TEST' && item.origin_kind === 'ASSISTANT_STATEMENT' && item.evidence_class === 'UNKNOWN') fail('TEST_EVIDENCE_CLASS_REQUIRED');
  }
  need(Array.isArray(capsule.relations), 'RELATIONS_REQUIRED');
  for (const relation of capsule.relations) { fields(relation, ['from', 'to', 'type']); need(ids.has(relation.from) && ids.has(relation.to) && RELATIONS.has(relation.type), 'RELATION_INVALID'); }
  need(Array.isArray(capsule.artifacts), 'ARTIFACTS_REQUIRED');
  const artifacts = new Map();
  for (const artifact of capsule.artifacts) {
    fields(artifact, ['artifact_id', 'digest', 'status']);
    need(string(artifact.artifact_id) && !artifacts.has(artifact.artifact_id) && ['AVAILABLE', 'MISSING'].includes(artifact.status), 'ARTIFACT_INVALID');
    need(artifact.digest === null || digestString(artifact.digest), 'ARTIFACT_DIGEST_INVALID');
    if (artifact.status === 'AVAILABLE') need(digestString(artifact.digest) && (context.artifact_digests || []).includes(artifact.digest), 'ARTIFACT_NOT_READBACK_VERIFIED');
    if (source.coverage.missing_artifact_refs.includes(artifact.artifact_id)) need(artifact.status === 'MISSING', 'MISSING_ARTIFACT_PROMOTED');
    artifacts.set(artifact.artifact_id, artifact);
  }
  need(Array.isArray(capsule.next_handles), 'NEXT_HANDLES_REQUIRED');
  for (const handle of capsule.next_handles) {
    fields(handle, ['action', 'input_refs', 'preconditions', 'cheapest_test', 'expected_evidence', 'reopen_condition']);
    for (const field of ['action', 'cheapest_test', 'expected_evidence', 'reopen_condition']) need(string(handle[field]), 'NEXT_HANDLE_INCOMPLETE');
    need(strings(handle.input_refs) && strings(handle.preconditions) && handle.input_refs.every(ref => artifacts.has(ref)), 'NEXT_HANDLE_ARTIFACT_UNBOUND');
  }
  const serialized = canonicalMemoryJson(capsule);
  need(Buffer.byteLength(serialized) <= MAX_CAPSULE_BYTES, 'CAPSULE_TOO_LARGE');
  rejectSensitive(serialized);
  need(memoryCapsuleDigest(capsule) === capsule.payload_digest, 'CAPSULE_DIGEST_MISMATCH');
  return clone(capsule);
}

function initialMemory() { return { schema: MEMORY_SCHEMA, sources: {}, capsules: {}, ingests: {}, cursors: {}, revocations: {}, retrievals: {}, index: {}, revision: 0 }; }
function state(root) {
  if (root.memory === undefined) root.memory = initialMemory();
  need(record(root.memory) && root.memory.schema === MEMORY_SCHEMA, 'MEMORY_STATE_SCHEMA_INVALID');
  for (const key of ['sources', 'capsules', 'ingests', 'cursors', 'revocations', 'retrievals', 'index']) need(record(root.memory[key]), 'MEMORY_STATE_INVALID');
  return root.memory;
}
function isRevoked(mem, sourceRef, capsuleRef) { return Boolean(mem.revocations[sourceRef] || capsuleRef && mem.revocations[capsuleRef]); }
function admissionCapacity(mem) {
  // Reserve room in the shared control store. Never delete history to fit a write.
  // Revocation is deliberately exempt; the outer store must also reserve space
  // for control records and its own transaction log.
  need(Buffer.byteLength(canonicalMemoryJson(mem)) <= MAX_MEMORY_BYTES, 'MEMORY_CAPACITY_REQUIRES_ARCHIVE');
}

export function createMemoryService({ store, now = () => new Date().toISOString(), authorize } = {}) {
  need(store && typeof store.read === 'function' && typeof store.mutate === 'function', 'ATOMIC_STORE_REQUIRED');
  need(typeof authorize === 'function', 'CURRENT_AUTHORIZER_REQUIRED');
  const allow = (context, request) => authorize(context, request) === true;
  const requireAuth = (context, request) => need(allow(context, request), 'MEMORY_SCOPE_DENIED');
  function clock() { const time = now(); need(timestamp(time), 'CLOCK_INVALID'); return time; }

  return {
    async ingest({ source, capsule, cursor, causation = null }, context) {
      // Authorize source membership before material processing, and recheck in commit.
      requireAuth(context, { operation: 'ingest', project_id: source?.project_id, source_ref: source && memorySourceRef(source), source });
      need(causation === null || record(causation) && causation.origin !== 'SESSION_MEMORY' && !['CAPSULE_WRITTEN', 'INDEX_REBUILT'].includes(causation.kind), 'MEMORY_SELF_TRIGGER_REJECTED');
      const checkedSource = validateMemorySource(source);
      const checkedCapsule = validateMemoryCapsule(capsule, checkedSource, context);
      fields(cursor, ['stream_id', 'before', 'after']);
      need(string(cursor.stream_id) && Number.isSafeInteger(cursor.before) && cursor.before >= 0 && Number.isSafeInteger(cursor.after) && cursor.after > cursor.before, 'CURSOR_INVALID');
      need(cursor.after - cursor.before === source.coverage.ranges.reduce((n, r) => n + r.end - r.start, 0), 'CURSOR_EXCEEDS_PROCESSED_RANGE');
      source = checkedSource; capsule = checkedCapsule; cursor = clone(cursor);
      const srcRef = memorySourceRef(source), capRef = memoryCapsuleRef(capsule);
      const ingestKey = 'ing-' + memoryDigest([source.project_id, source.source_session_id, source.branch_id, source.bytes_digest, source.representation_digest, source.coverage, capsule.extraction_contract_ref]);
      const sourceDigest = memoryDigest(checkedSource);
      const cursorKey = memoryDigest([source.project_id, source.source_session_id, source.branch_id, cursor.stream_id]);
      const at = clock();
      let receipt;
      try {
        receipt = await store.mutate(root => {
          requireAuth(context, { operation: 'ingest', project_id: source.project_id, source_ref: srcRef, source: checkedSource });
          const mem = state(root);
          need(!isRevoked(mem, srcRef, capRef), 'MEMORY_REVOKED');
          if (mem.sources[srcRef]) need(mem.sources[srcRef].digest === sourceDigest, 'SOURCE_SNAPSHOT_CONFLICT');
          if (mem.ingests[ingestKey]) {
            const previous = mem.ingests[ingestKey];
            need(previous.capsule_digest === checkedCapsule.payload_digest && previous.source_ref === srcRef && previous.cursor_key === cursorKey && previous.cursor_before === cursor.before && previous.cursor_after === cursor.after, 'INGEST_CONFLICT');
            need(mem.capsules[previous.capsule_ref]?.capsule.payload_digest === previous.capsule_digest, 'INGEST_READBACK_MISMATCH');
            return clone(previous);
          }
          need(!mem.capsules[capRef], 'CAPSULE_REVISION_CONFLICT');
          need((mem.cursors[cursorKey] || 0) === cursor.before, 'CURSOR_CONFLICT');
          if (capsule.supersedes_ref !== null) {
            const old = mem.capsules[capsule.supersedes_ref]?.capsule;
            need(old && old.project_id === capsule.project_id && old.capsule_id === capsule.capsule_id && old.revision + 1 === capsule.revision && old.memory_scope === capsule.memory_scope && old.lab_id === capsule.lab_id, 'SUPERSEDES_BINDING_INVALID');
            need(!Object.values(mem.capsules).some(row => row.capsule.supersedes_ref === capsule.supersedes_ref), 'CAPSULE_BRANCH_REQUIRES_NEW_ID');
          } else need(capsule.revision === 1, 'CAPSULE_PREDECESSOR_REQUIRED');
          mem.sources[srcRef] ||= { source: checkedSource, digest: sourceDigest };
          mem.capsules[capRef] = { capsule: checkedCapsule, admitted_at: at, source_ref: srcRef };
          const accepted = { schema: 'wl.memory.ingest-receipt.v1', ingest_key: ingestKey, source_ref: srcRef, source_digest: sourceDigest, capsule_ref: capRef, capsule_digest: capsule.payload_digest, coverage: clone(source.coverage), cursor_key: cursorKey, cursor_before: cursor.before, cursor_after: cursor.after, accepted_at: at, status: 'CAPSULE_COMMITTED', known_effect: 'COMMITTED', evidence_class: 'STORAGE_READBACK', execution_authority: 'NONE' };
          mem.ingests[ingestKey] = accepted; mem.cursors[cursorKey] = cursor.after;
          mem.index[capRef] = { project_id: capsule.project_id, source_ref: srcRef, digest: capsule.payload_digest };
          mem.revision++;
          admissionCapacity(mem);
          return clone(accepted);
        });
      } catch (error) {
        if (['UNKNOWN_EFFECT', 'STORE_UNKNOWN_EFFECT'].includes(error.code)) {
          const recovered = state(await store.read()).ingests[ingestKey];
          if (!recovered) throw error; // Never blindly re-extract or repeat an unknown write.
          need(recovered.capsule_digest === capsule.payload_digest, 'INGEST_CONFLICT');
          receipt = clone(recovered);
        } else throw error;
      }
      const read = state(await store.read());
      requireAuth(context, { operation: 'readback', project_id: source.project_id, source_ref: srcRef });
      need(!isRevoked(read, srcRef, capRef), 'MEMORY_REVOKED');
      need(read.sources[srcRef]?.digest === sourceDigest && memoryDigest(read.sources[srcRef].source) === sourceDigest && read.capsules[capRef]?.capsule.payload_digest === capsule.payload_digest && memoryCapsuleDigest(read.capsules[capRef].capsule) === capsule.payload_digest, 'INGEST_READBACK_MISMATCH');
      return { ...receipt, readback_verified: true };
    },

    async retrieve({ target, query = '', max_chars = 16000, retrieval_id }, context) {
      fields(target, ['project_id', 'mission_id', 'lab_id', 'run_id', 'purpose', 'exposure_ref', 'mode']);
      for (const key of ['project_id', 'mission_id', 'lab_id', 'run_id', 'purpose', 'exposure_ref']) need(string(target[key]), 'RETRIEVAL_TARGET_REQUIRED');
      need(['HISTORICAL', 'CURRENT_OPERATIONAL'].includes(target.mode), 'RETRIEVAL_MODE_INVALID');
      need(string(retrieval_id) && typeof query === 'string' && query.length <= 2048 && Number.isSafeInteger(max_chars) && max_chars >= 512 && max_chars <= MAX_PACKET_CHARS, 'RETRIEVAL_REQUEST_INVALID');
      requireAuth(context, { operation: 'retrieve', project_id: target.project_id, target });
      rejectSensitive(query);
      const at = clock(), requestDigest = memoryDigest({ target, query, max_chars });
      const result = await store.mutate(root => {
        requireAuth(context, { operation: 'retrieve', project_id: target.project_id, target });
        const mem = state(root);
        if (mem.retrievals[retrieval_id]) {
          const previous = mem.retrievals[retrieval_id];
          need(previous.request_digest === requestDigest, 'RETRIEVAL_ID_CONFLICT');
          for (const entry of previous.packet.capsules) {
            need(!isRevoked(mem, entry.source_ref, entry.capsule_ref), 'MEMORY_REVOKED');
            requireAuth(context, { operation: 'use', project_id: target.project_id, source_ref: entry.source_ref, capsule_ref: entry.capsule_ref, target });
          }
          return clone(previous);
        }
        const candidates = [];
        const superseded = new Set(Object.values(mem.capsules).filter(row => row.capsule.project_id === target.project_id).map(row => row.capsule.supersedes_ref).filter(Boolean));
        for (const [capRef, row] of Object.entries(mem.capsules)) {
          const cap = row.capsule;
          // No query, title, snippet, count or ranking before this scope filter.
          if (cap.project_id !== target.project_id || isRevoked(mem, row.source_ref, capRef) || superseded.has(capRef) || !cap.allowed_use.includes(target.purpose)) continue;
          if (cap.memory_scope === 'LAB_SCOPED' && cap.lab_id !== target.lab_id) continue;
          if (!allow(context, { operation: 'retrieve_source', project_id: cap.project_id, source_ref: row.source_ref, capsule_ref: capRef, target })) continue;
          const srcRow = mem.sources[row.source_ref];
          need(srcRow && memoryDigest(srcRow.source) === srcRow.digest && cap.source_digest === srcRow.digest && memoryCapsuleDigest(cap) === cap.payload_digest, 'RETRIEVAL_SOURCE_TAMPERED');
          // Index is only a hint. Ignore stale/poisoned rows and bind canonical bytes.
          const text = cap.items.map(item => item.text).join('\n').toLocaleLowerCase('en');
          const words = query.toLocaleLowerCase('en').split(/\s+/).filter(Boolean);
          const score = words.reduce((sum, word) => sum + Number(text.includes(word)), 0);
          candidates.push({ capRef, cap, srcRow, sourceRef: row.source_ref, score });
        }
        candidates.sort((a, b) => b.score - a.score || a.capRef.localeCompare(b.capRef));
        const packet = { schema: 'wl.memory.context-packet.v1', target: clone(target), capsules: [], execution_authority: 'NONE', research_permit_consumed: false, live_cold_start_proven: false };
        const omissions = [];
        for (const { capRef, cap, srcRow, sourceRef } of candidates) {
          const missing = [...new Set([...srcRow.source.coverage.missing_artifact_refs, ...cap.artifacts.filter(a => a.status === 'MISSING').map(a => a.artifact_id)])];
          const entry = { capsule_ref: capRef, capsule_digest: cap.payload_digest, source_ref: sourceRef, source_digest: srcRow.digest, source_captured_at: srcRow.source.captured_at, coverage: clone(srcRow.source.coverage), missing_artifact_refs: missing, items: clone(cap.items), relations: clone(cap.relations), artifacts: clone(cap.artifacts), next_handles: cap.next_handles.map(handle => ({ ...clone(handle), status: handle.input_refs.some(ref => missing.includes(ref)) ? 'BLOCKED_MISSING_ARTIFACT' : target.mode === 'CURRENT_OPERATIONAL' ? 'CURRENT_SOURCE_RECHECK_REQUIRED' : 'READY_WITHIN_HISTORICAL_SCOPE' })), limitations: target.mode === 'CURRENT_OPERATIONAL' ? ['Historical memory does not verify current operational truth.'] : [] };
          packet.capsules.push(entry);
          if (canonicalMemoryJson(packet).length > max_chars) { packet.capsules.pop(); omissions.push({ capsule_ref: capRef, reason: 'CONTEXT_BUDGET_WHOLE_CAPSULE' }); }
        }
        // Whole capsules retain the counterargument/alternatives; no truncation that
        // turns a qualified source into an apparently unqualified claim.
        for (const entry of packet.capsules) requireAuth(context, { operation: 'use', project_id: target.project_id, source_ref: entry.source_ref, capsule_ref: entry.capsule_ref, target });
        const receipt = { schema: 'wl.memory.retrieval-receipt.v1', retrieval_id, request_digest: requestDigest, retrieved_at: at, target: clone(target), context_budget: max_chars, packet_digest: memoryDigest(packet), packet, exposure_ref: target.exposure_ref, omissions, evidence_class: 'SCOPED_STORAGE_RETRIEVAL', used_by_event: null, execution_authority: 'NONE' };
        mem.retrievals[retrieval_id] = receipt; mem.revision++; admissionCapacity(mem);
        return clone(receipt);
      });
      const readback = state(await store.read());
      const stored = readback.retrievals[retrieval_id];
      need(stored && stored.request_digest === requestDigest && stored.packet_digest === result.packet_digest && memoryDigest(stored.packet) === result.packet_digest, 'RETRIEVAL_READBACK_MISMATCH');
      for (const entry of result.packet.capsules) {
        need(!isRevoked(readback, entry.source_ref, entry.capsule_ref), 'MEMORY_REVOKED');
        requireAuth(context, { operation: 'use', project_id: target.project_id, source_ref: entry.source_ref, capsule_ref: entry.capsule_ref, target });
      }
      return result;
    },

    async revoke({ ref, reason, authority_ref }, context) {
      need(string(ref) && string(reason) && string(authority_ref), 'REVOCATION_INVALID');
      const at = clock();
      return store.mutate(root => {
        const mem = state(root), source = mem.sources[ref]?.source;
        const capsule = mem.capsules[ref]?.capsule;
        need(source || capsule, 'REVOCATION_REF_UNAVAILABLE');
        const project = source?.project_id || capsule.project_id;
        requireAuth(context, { operation: 'revoke', project_id: project, source_ref: source ? ref : capsule.source_ref, capsule_ref: capsule ? ref : null });
        if (mem.revocations[ref]) return clone(mem.revocations[ref]);
        const receipt = { schema: 'wl.memory.revocation.v1', ref, project_id: project, reason, authority_ref, effective_at: at, status: 'RETRIEVAL_DISABLED', content_erased: false, remaining_obligations: ['Encrypted source/capsule retention and uninspected backups require separately scoped disposal.'] };
        mem.revocations[ref] = receipt;
        for (const [key, entry] of Object.entries(mem.index)) if (key === ref || entry.source_ref === ref) delete mem.index[key];
        // Stored old packets cannot resurrect revoked content through cached lookup.
        for (const [key, entry] of Object.entries(mem.retrievals)) if (entry.packet.capsules.some(c => c.capsule_ref === ref || c.source_ref === ref)) delete mem.retrievals[key];
        mem.revision++;
        return clone(receipt);
      });
    },

    async rebuildIndex(context) {
      return store.mutate(root => {
        requireAuth(context, { operation: 'rebuild', project_id: null });
        const mem = state(root), index = {};
        for (const [ref, row] of Object.entries(mem.capsules)) {
          const cap = row.capsule;
          if (isRevoked(mem, row.source_ref, ref) || !allow(context, { operation: 'index_source', project_id: cap.project_id, source_ref: row.source_ref, capsule_ref: ref })) continue;
          need(memoryCapsuleDigest(cap) === cap.payload_digest && memoryDigest(mem.sources[row.source_ref]?.source) === cap.source_digest, 'REBUILD_SOURCE_TAMPERED');
          index[ref] = { project_id: cap.project_id, source_ref: row.source_ref, digest: cap.payload_digest };
        }
        mem.index = index; mem.revision++;
        return { schema: 'wl.memory.index-receipt.v1', status: 'FILE_FIRST_REBUILT', rows: Object.keys(index).length, model_calls: 0, supabase_calls: 0 };
      });
    },

    async status(context) {
      requireAuth(context, { operation: 'status', project_id: null });
      const mem = state(await store.read());
      const sources = Object.entries(mem.sources).filter(([ref, row]) => !isRevoked(mem, ref) && allow(context, { operation: 'status_source', project_id: row.source.project_id, source_ref: ref }));
      return { schema: 'wl.memory.status.v1', source_count: sources.length, known_scope: [...new Set(sources.map(([, row]) => row.source.project_id))], captured_coverage: sources.map(([ref, row]) => ({ source_ref: ref, coverage: clone(row.source.coverage), captured_at: row.source.captured_at })), total_history_count: null, history_sync: 'AUTO_HISTORY_SYNC_NOT_ACTIVATED', index: 'S1_INDEX_FILE_FIRST', cold_start: 'S1_COLD_START_SYNTHETIC_ONLY', learned_benefit: 'NOT_MEASURED' };
    },
  };
}

/** Encrypt only this module's state; unrelated root state remains untouched. */
export function createEncryptedMemoryStore({ store, key, aad = 'wl-memory-v1' } = {}) {
  need(store && typeof store.read === 'function' && typeof store.mutate === 'function', 'ATOMIC_STORE_REQUIRED');
  need(Buffer.isBuffer(key) && key.length === 32 && string(aad), 'MEMORY_ENCRYPTION_KEY_REQUIRED');
  const privateKey = Buffer.from(key);
  const open = root => {
    if (!root.memory_sealed) { need(!root.memory_seal_anchor, 'MEMORY_ENVELOPE_MISSING'); return initialMemory(); }
    const envelope = root.memory_sealed;
    need(envelope.schema === 'wl.memory.aes-gcm.v1' && root.memory_seal_anchor === memoryDigest(envelope), 'MEMORY_SEAL_ANCHOR_MISMATCH');
    try {
      const decipher = createDecipheriv('aes-256-gcm', privateKey, Buffer.from(envelope.iv, 'base64'));
      decipher.setAAD(Buffer.from(aad)); decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]);
      return state({ memory: JSON.parse(plaintext.toString('utf8')) });
    } catch { fail('MEMORY_DECRYPT_FAILED'); }
  };
  const seal = memory => {
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', privateKey, iv);
    cipher.setAAD(Buffer.from(aad));
    const ciphertext = Buffer.concat([cipher.update(canonicalMemoryJson(memory), 'utf8'), cipher.final()]);
    return { schema: 'wl.memory.aes-gcm.v1', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
  };
  return {
    async read() { return { memory: open(await store.read()) }; },
    async mutate(fn) {
      return store.mutate(root => {
        need(!Object.hasOwn(root, 'memory'), 'PLAINTEXT_MEMORY_STATE_REJECTED');
        const draft = { memory: clone(open(root)) };
        const result = fn(draft); need(!(result && typeof result.then === 'function'), 'ASYNC_MEMORY_MUTATION_REJECTED');
        root.memory_sealed = seal(state(draft)); root.memory_seal_anchor = memoryDigest(root.memory_sealed);
        return result;
      });
    },
  };
}

/** Validate evidence ceilings; actual receipt authenticity belongs to caller. */
export function validateS1Verdicts(verdict, evidence) {
  need(record(verdict) && record(evidence), 'S1_VERDICT_INVALID');
  const enums = {
    file_first: ['S1_FILE_FIRST_SYNTHETIC_PASS', 'S1_FILE_FIRST_FAIL', 'S1_FILE_FIRST_BLOCKED'],
    capture: ['S1_CAPTURE_LIVE_PASS', 'S1_CAPTURE_PARTIAL_SOURCE', 'S1_CAPTURE_HUMAN_ASSISTED', 'S1_CAPTURE_BLOCKED'],
    cold_start: ['S1_COLD_START_LIVE_PASS', 'S1_COLD_START_SYNTHETIC_ONLY', 'S1_COLD_START_BLOCKED'],
    history_sync: ['AUTO_HISTORY_SYNC_VERIFIED', 'AUTO_HISTORY_SYNC_UNAVAILABLE', 'AUTO_HISTORY_SYNC_NOT_ACTIVATED'],
    index: ['S1_INDEX_FILE_FIRST', 'S1_INDEX_OPTIONAL_NOT_ACTIVATED', 'S1_INDEX_SHADOW_VERIFIED'],
    learned_benefit: ['NOT_MEASURED', 'VERIFIED'],
  };
  for (const [axis, value] of Object.entries(verdict)) need(enums[axis]?.includes(value), 'S1_VERDICT_INVALID');
  if (verdict.capture === 'S1_CAPTURE_LIVE_PASS') need(evidence.evidence_class === 'LIVE' && evidence.source_read_observed === true && evidence.private_readback_verified === true && digestString(evidence.source_digest), 'CAPTURE_LIVE_UNPROVEN');
  if (verdict.cold_start === 'S1_COLD_START_LIVE_PASS') {
    need(evidence.evidence_class === 'LIVE' && string(evidence.launch_evidence_ref) && string(evidence.capture_instance_ref) && string(evidence.consumer_instance_ref) && evidence.capture_instance_ref !== evidence.consumer_instance_ref && digestString(evidence.packet_digest) && evidence.observed_use === true, 'COLD_START_LIVE_UNPROVEN');
  }
  if (verdict.history_sync === 'AUTO_HISTORY_SYNC_VERIFIED') need(evidence.history_adapter_verified === true && evidence.authorized_inventory_complete === true && evidence.coverage_matches_inventory === true && evidence.cursor_readback === true, 'HISTORY_SYNC_UNPROVEN');
  if (verdict.learned_benefit === 'VERIFIED') need(evidence.matched_comparator_receipt && evidence.causal_use_observed === true, 'MEMORY_BENEFIT_UNPROVEN');
  return true;
}
