/**
 * Bounded, injected encrypted Git research journal for NEW_WL only.
 * No credentials, Git provider client, scheduler or model call is installed here.
 *
 * Transport interface (all async):
 * getRef(ref) -> commit SHA
 * readFile({commit,path}) -> Buffer | null (null means confirmed absent)
 * createCommit({parent,files:[{path,bytes:Buffer}],message}) -> commit SHA;
 *   inherit the parent's exact tree and replace ONLY supplied paths.
 * inspectCommit({commit,parent}) -> {commit,parents:[SHA],changed_paths:[path]}
 * isAncestor({ancestor,descendant}) -> boolean
 * updateRef({ref,expected,commit,force:false}) -> {updated:boolean}
 *   MUST perform conditional non-force update against exact expected SHA.
 *   A network timeout must throw, never be reported as updated:false.
 *
 * authorize(context,{phase,candidate,namespace,ref}) must check current trusted
 * scope/identity/control/grant, separately allowing read-only reconciliation.
 * Checks immediately precede the ref request. This is NOT an atomic transaction
 * between Git and an independent control store: a caller's durable outbox must
 * keep Git publication pending until this sink returns a verified receipt.
 * Whole-store rollback must not restore permissions. No live adapter is claimed.
 */
import { createHash, createHmac, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

export const GIT_CANDIDATE_SCHEMA = 'wl.git-journal.candidate.v1';
export const GIT_MANIFEST_SCHEMA = 'wl.git-journal.manifest.v1';
export const GIT_SINK_ASSURANCE = 'INJECTED_TRANSPORT_ONLY_NO_LIVE_BINDING';
const SHA = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const DIGEST = /^[a-f0-9]{64}$/;
const PREFIX = /^public\/AI8\/WL_RUNS\/[a-f0-9]{32}$/;
const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;
const MAX_EVENTS = 512;
const copy = value => structuredClone(value);
function fail(code) { throw Object.assign(new Error(code), { code }); }
function need(condition, code) { if (!condition) fail(code); }
function object(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
function id(x) { return typeof x === 'string' && x.length > 0 && x.length <= 512 && !UNSAFE.has(x); }
function sha(x) { return typeof x === 'string' && SHA.test(x); }

export function canonicalJournalJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { need(Number.isFinite(value), 'NONFINITE_JSON'); return JSON.stringify(value); }
  if (Array.isArray(value)) return '[' + value.map(canonicalJournalJson).join(',') + ']';
  need(object(value) && Object.getPrototypeOf(value) === Object.prototype, 'INVALID_JSON');
  const keys = Object.keys(value).sort(); need(keys.every(k => !UNSAFE.has(k)), 'UNSAFE_OBJECT_KEY');
  return '{' + keys.map(key => JSON.stringify(key) + ':' + canonicalJournalJson(value[key])).join(',') + '}';
}
export function journalDigest(value) {
  return createHash('sha256').update(Buffer.isBuffer(value) ? value : canonicalJournalJson(value)).digest('hex');
}
function same(a, b) { return canonicalJournalJson(a) === canonicalJournalJson(b); }
function exactFields(value, required, optional = []) {
  need(object(value), 'INVALID_OBJECT'); const allowed = new Set([...required, ...optional]);
  need(required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => allowed.has(key)), 'OBJECT_FIELDS_INVALID');
}
function applyPatch(current, patch) {
  exactFields(patch, ['set'], ['remove']);
  need(object(patch.set) && Array.isArray(patch.remove ?? []) && (patch.remove ?? []).every(id), 'PATCH_INVALID');
  const result = copy(current);
  for (const key of patch.remove ?? []) delete result[key];
  for (const [key, value] of Object.entries(patch.set)) { need(id(key), 'PATCH_KEY_INVALID'); result[key] = copy(value); }
  return result;
}

export function validateGitCandidate(input) {
  exactFields(input, ['schema', 'run_kind', 'event', 'state', 'artifacts', 'authorization_ref']);
  need(input.schema === GIT_CANDIDATE_SCHEMA && input.run_kind === 'NEW_WL' && id(input.authorization_ref), 'NEW_WL_CANDIDATE_REQUIRED');
  const event = input.event;
  need(object(event), 'ACCEPTED_EVENT_REQUIRED');
  for (const key of ['event_id', 'run_id', 'mission_id', 'lab_id', 'turn_permit_id', 'attempt_id']) need(id(event[key]), 'EVENT_IDENTITY_INVALID');
  need(!event.run_id.startsWith('WL-RHP11-') && !event.run_id.startsWith('PREAI8-'), 'LEGACY_NAMESPACE_FORBIDDEN');
  need(event.parent === null || id(event.parent), 'EVENT_PARENT_INVALID');
  for (const key of ['state_hash', 'previous_state_hash', 'patch_hash', 'result_hash', 'payload_hash', 'source_set_hash', 'mission_hash']) need(typeof event[key] === 'string' && DIGEST.test(event[key]), 'EVENT_DIGEST_INVALID');
  need(typeof event.accepted_at === 'string' && Number.isFinite(Date.parse(event.accepted_at)) && Number.isSafeInteger(event.control_epoch) && event.control_epoch >= 0 && Number.isSafeInteger(event.execution_grant) && event.execution_grant > 0, 'EVENT_CONTROL_BINDING_INVALID');
  need(object(input.state) && object(event.result), 'RESEARCH_PAYLOAD_INVALID');
  need(journalDigest(event.patch) === event.patch_hash && journalDigest(event.result) === event.result_hash && journalDigest({ patch: event.patch, result: event.result }) === event.payload_hash && journalDigest(input.state) === event.state_hash, 'CANDIDATE_HASH_MISMATCH');
  applyPatch({}, event.patch); // validate supported reducer even before predecessor read
  need(Array.isArray(input.artifacts) && input.artifacts.length <= 32 && Array.isArray(event.result.artifacts ?? []), 'ARTIFACT_SET_INVALID');
  const declared = event.result.artifacts ?? [], actual = new Map();
  need(new Set(declared.map(a => a.artifact_id)).size === declared.length, 'ARTIFACT_ID_CONFLICT');
  let totalBytes = Buffer.byteLength(canonicalJournalJson({ event, state: input.state }));
  for (const artifact of input.artifacts) {
    exactFields(artifact, ['artifact_id', 'bytes_base64', 'digest']);
    need(id(artifact.artifact_id) && !actual.has(artifact.artifact_id) && typeof artifact.bytes_base64 === 'string', 'ARTIFACT_INVALID');
    const bytes = Buffer.from(artifact.bytes_base64, 'base64');
    need(bytes.length <= MAX_ARTIFACT_BYTES && bytes.toString('base64') === artifact.bytes_base64 && journalDigest(bytes) === artifact.digest, 'ARTIFACT_BYTES_MISMATCH');
    const declaration = declared.find(row => row.artifact_id === artifact.artifact_id);
    need(declaration && declaration.digest === artifact.digest && id(declaration.receipt_ref), 'ARTIFACT_NOT_BOUND_TO_ACCEPTED_EVENT');
    actual.set(artifact.artifact_id, bytes); totalBytes += bytes.length;
  }
  need(actual.size === declared.length, 'MISSING_ACCEPTED_ARTIFACT_BYTES');
  need(totalBytes <= MAX_TOTAL_BYTES, 'JOURNAL_CANDIDATE_TOO_LARGE');
  return copy(input);
}

export function createGitJournalSink({ transport, key, namespace, ref = 'refs/heads/main', authorize, maxRetries = 4 } = {}) {
  need(transport && ['getRef', 'readFile', 'createCommit', 'inspectCommit', 'isAncestor', 'updateRef'].every(name => typeof transport[name] === 'function'), 'GIT_TRANSPORT_UNAVAILABLE');
  need(Buffer.isBuffer(key) && key.length === 32, 'JOURNAL_KEY_UNAVAILABLE');
  need(typeof namespace === 'string' && PREFIX.test(namespace), 'NEW_WL_NAMESPACE_REQUIRED');
  need(typeof ref === 'string' && /^refs\/heads\/[A-Za-z0-9][A-Za-z0-9_-]*(?:\/[A-Za-z0-9][A-Za-z0-9_-]*)*$/.test(ref), 'GIT_REF_INVALID');
  need(typeof authorize === 'function' && Number.isSafeInteger(maxRetries) && maxRetries >= 1 && maxRetries <= 8, 'JOURNAL_AUTHORIZATION_REQUIRED');
  const privateKey = Buffer.from(key);
  const manifestPath = namespace + '/manifest.enc.json';
  const currentStatePath = namespace + '/state.enc.json';
  const objectKey = (kind, identity) => createHmac('sha256', privateKey).update(canonicalJournalJson({ namespace, kind, identity })).digest('hex');
  function validPath(path) {
    return path === manifestPath || path === currentStatePath || new RegExp('^' + namespace + '/(?:events|states|artifacts)/[a-f0-9]{64}\\.enc\\.json$').test(path);
  }
  async function guard(phase, candidate, context) {
    need(await authorize(context, { phase, candidate: copy(candidate), namespace, ref }) === true, 'JOURNAL_AUTHORIZATION_DENIED');
  }
  function encrypt(path, payload) {
    need(validPath(path), 'JOURNAL_PATH_FORBIDDEN');
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', privateKey, iv);
    cipher.setAAD(Buffer.from(canonicalJournalJson({ schema: 'wl.git-journal.aad.v1', namespace, path })));
    const ciphertext = Buffer.concat([cipher.update(canonicalJournalJson(payload), 'utf8'), cipher.final()]);
    // Public envelope contains only cryptographic transport data, no run identity,
    // plaintext digest, title, source name, artifact name or accepted-event metadata.
    return Buffer.from(canonicalJournalJson({ schema: 'wl.git-journal.aes-gcm.v1', iv: iv.toString('base64'), ciphertext: ciphertext.toString('base64'), tag: cipher.getAuthTag().toString('base64') }));
  }
  function decrypt(path, bytes) {
    need(validPath(path) && Buffer.isBuffer(bytes), 'JOURNAL_READBACK_INVALID');
    try {
      const envelope = JSON.parse(bytes.toString('utf8'));
      exactFields(envelope, ['schema', 'iv', 'ciphertext', 'tag']);
      need(envelope.schema === 'wl.git-journal.aes-gcm.v1', 'ENVELOPE_SCHEMA_INVALID');
      const decipher = createDecipheriv('aes-256-gcm', privateKey, Buffer.from(envelope.iv, 'base64'));
      decipher.setAAD(Buffer.from(canonicalJournalJson({ schema: 'wl.git-journal.aad.v1', namespace, path })));
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString('utf8'));
    } catch { fail('JOURNAL_DECRYPT_OR_INTEGRITY_FAILED'); }
  }
  async function readFile(commit, path) {
    need(sha(commit) && validPath(path), 'JOURNAL_READ_SCOPE_INVALID');
    const bytes = await transport.readFile({ commit, path });
    need(bytes === null || Buffer.isBuffer(bytes), 'GIT_READ_BYTES_UNVERIFIED');
    return bytes;
  }
  async function head() { const commit = await transport.getRef(ref); need(sha(commit), 'GIT_REF_SHA_INVALID'); return commit; }
  function emptyManifest(candidate) {
    return { schema: GIT_MANIFEST_SCHEMA, lab_id: candidate.event.lab_id, run_id: candidate.event.run_id, mission_id: candidate.event.mission_id, revision: 0, frontier: null, state_hash: journalDigest({}), accepted: {} };
  }
  async function snapshot(commit, candidate) {
    const manifestBytes = await readFile(commit, manifestPath);
    const stateBytes = await readFile(commit, currentStatePath);
    if (manifestBytes === null) { need(stateBytes === null, 'PARTIAL_JOURNAL_STATE'); return { manifest: emptyManifest(candidate), state: {}, manifestBytes: null }; }
    const manifest = decrypt(manifestPath, manifestBytes);
    need(manifest.schema === GIT_MANIFEST_SCHEMA && manifest.lab_id === candidate.event.lab_id && manifest.run_id === candidate.event.run_id && manifest.mission_id === candidate.event.mission_id, 'JOURNAL_SCOPE_CONFLICT');
    need(Number.isSafeInteger(manifest.revision) && manifest.revision > 0 && object(manifest.accepted) && Object.keys(manifest.accepted).length === manifest.revision, 'JOURNAL_MANIFEST_INVALID');
    need(stateBytes !== null, 'PARTIAL_JOURNAL_STATE');
    const stateRecord = decrypt(currentStatePath, stateBytes);
    need(stateRecord.schema === 'wl.git-journal.state.v1' && stateRecord.event_id === manifest.frontier && journalDigest(stateRecord.state) === manifest.state_hash, 'JOURNAL_STATE_HASH_MISMATCH');
    return { manifest, state: stateRecord.state, manifestBytes };
  }
  function paths(candidate) {
    const event = candidate.event;
    // Permit identity, not event/attempt name, is the immutable accepted slot.
    const slot = objectKey('permit', [event.lab_id, event.run_id, event.turn_permit_id]);
    return { slot, eventPath: namespace + '/events/' + slot + '.enc.json', statePath: namespace + '/states/' + slot + '.enc.json', artifacts: candidate.artifacts.map(a => ({ artifact: a, path: namespace + '/artifacts/' + objectKey('artifact', [event.run_id, event.turn_permit_id, a.artifact_id, a.digest]) + '.enc.json' })) };
  }
  async function verifyAccepted(commit, manifest, candidate, candidateDigest, p) {
    const accepted = manifest.accepted[p.slot];
    if (!accepted) return null;
    need(accepted.candidate_digest === candidateDigest, 'PERMIT_COMMITTED_DIFFERENT_CANDIDATE');
    need(accepted.event_path === p.eventPath && accepted.state_path === p.statePath && accepted.attempt_id === candidate.event.attempt_id && accepted.event_id === candidate.event.event_id, 'ACCEPTED_ATTEMPT_BINDING_MISMATCH');
    const expectedPaths = [p.eventPath, p.statePath, ...p.artifacts.map(x => x.path)];
    need(object(accepted.encrypted_hashes) && same(Object.keys(accepted.encrypted_hashes).sort(), expectedPaths.sort()), 'ACCEPTED_INVENTORY_MISMATCH');
    const payloads = new Map();
    for (const path of expectedPaths) {
      const bytes = await readFile(commit, path);
      need(bytes && journalDigest(bytes) === accepted.encrypted_hashes[path], 'ACCEPTED_OBJECT_READBACK_MISMATCH');
      payloads.set(path, decrypt(path, bytes));
    }
    need(same(payloads.get(p.eventPath), { schema: 'wl.git-journal.event.v1', event: candidate.event, candidate_digest: candidateDigest, authorization_ref: candidate.authorization_ref }), 'EVENT_READBACK_MISMATCH');
    need(same(payloads.get(p.statePath), { schema: 'wl.git-journal.state.v1', event_id: candidate.event.event_id, state: candidate.state }), 'STATE_READBACK_MISMATCH');
    for (const row of p.artifacts) need(same(payloads.get(row.path), { schema: 'wl.git-journal.artifact.v1', ...row.artifact }), 'ARTIFACT_READBACK_MISMATCH');
    return accepted;
  }
  function receipt({ candidate, candidateDigest, accepted, observedCommit, publishedCommit, status, attempts }) {
    return { schema: 'wl.git-journal.receipt.v1', status, namespace, ref, candidate_digest: candidateDigest, event_id: candidate.event.event_id, turn_permit_id: candidate.event.turn_permit_id, attempt_id: candidate.event.attempt_id, published_commit: publishedCommit, observed_commit: observedCommit, encrypted_hashes: copy(accepted.encrypted_hashes), state_hash: candidate.event.state_hash, readback_verified: true, ref_attempts: attempts, model_calls: 0, transport_assurance: GIT_SINK_ASSURANCE, control_boundary: 'CALLER_CHECKED_BEFORE_REF_REQUEST', cross_store_atomicity: 'NOT_CLAIMED', execution_authority: 'NONE' };
  }

  return {
    assurance: GIT_SINK_ASSURANCE,
    async commit(input, context) {
      const candidate = validateGitCandidate(input), candidateDigest = journalDigest(candidate), p = paths(candidate);
      await guard('READ_RECONCILE', candidate, context);
      let prepared = null;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const base = await head(), current = await snapshot(base, candidate);
        const existing = await verifyAccepted(base, current.manifest, candidate, candidateDigest, p);
        if (existing) return receipt({ candidate, candidateDigest, accepted: existing, observedCommit: base, publishedCommit: null, status: 'ALREADY_COMMITTED_READBACK_VERIFIED', attempts: attempt - 1 });
        need(current.manifest.frontier === candidate.event.parent && current.manifest.state_hash === candidate.event.previous_state_hash, 'JOURNAL_FRONTIER_CONFLICT');
        need(journalDigest(applyPatch(current.state, candidate.event.patch)) === candidate.event.state_hash, 'PATCH_REPLAY_MISMATCH');
        need(current.manifest.revision < MAX_EVENTS, 'JOURNAL_CAPACITY_REQUIRES_ARCHIVE');
        await guard('PREPARE_COMMIT', candidate, context);
        if (!prepared) {
          const immutable = [
            { path: p.eventPath, bytes: encrypt(p.eventPath, { schema: 'wl.git-journal.event.v1', event: candidate.event, candidate_digest: candidateDigest, authorization_ref: candidate.authorization_ref }) },
            { path: p.statePath, bytes: encrypt(p.statePath, { schema: 'wl.git-journal.state.v1', event_id: candidate.event.event_id, state: candidate.state }) },
            ...p.artifacts.map(row => ({ path: row.path, bytes: encrypt(row.path, { schema: 'wl.git-journal.artifact.v1', ...row.artifact }) })),
          ];
          const encryptedHashes = Object.fromEntries(immutable.map(row => [row.path, journalDigest(row.bytes)]));
          const accepted = { candidate_digest: candidateDigest, event_id: candidate.event.event_id, attempt_id: candidate.event.attempt_id, event_path: p.eventPath, state_path: p.statePath, encrypted_hashes: encryptedHashes };
          const manifest = { ...copy(current.manifest), revision: current.manifest.revision + 1, frontier: candidate.event.event_id, state_hash: candidate.event.state_hash, accepted: { ...copy(current.manifest.accepted), [p.slot]: accepted } };
          prepared = { accepted, manifestBaseDigest: journalDigest(current.manifest), files: [...immutable, { path: currentStatePath, bytes: encrypt(currentStatePath, { schema: 'wl.git-journal.state.v1', event_id: candidate.event.event_id, state: candidate.state }) }, { path: manifestPath, bytes: encrypt(manifestPath, manifest) }] };
        } else need(prepared.manifestBaseDigest === journalDigest(current.manifest), 'JOURNAL_FRONTIER_CONFLICT');
        // No pre-existing immutable object may be replaced, even if a malformed
        // manifest forgot to reference it. Partial older writes need reconciliation.
        for (const row of prepared.files.filter(x => x.path !== currentStatePath && x.path !== manifestPath)) need(await readFile(base, row.path) === null, 'IMMUTABLE_JOURNAL_PATH_EXISTS');
        need(prepared.files.every(row => validPath(row.path)), 'JOURNAL_PATH_FORBIDDEN');
        const proposed = await transport.createCommit({ parent: base, files: prepared.files.map(row => ({ path: row.path, bytes: Buffer.from(row.bytes) })), message: 'WL isolated encrypted research checkpoint' });
        need(sha(proposed), 'GIT_COMMIT_SHA_INVALID');
        const inspection = await transport.inspectCommit({ commit: proposed, parent: base });
        need(inspection?.commit === proposed && same(inspection.parents, [base]) && Array.isArray(inspection.changed_paths) && same([...inspection.changed_paths].sort(), prepared.files.map(x => x.path).sort()), 'GIT_COMMIT_SCOPE_OR_PARENT_MISMATCH');
        for (const row of prepared.files) need((await readFile(proposed, row.path))?.equals(row.bytes), 'STAGED_COMMIT_READBACK_MISMATCH');
        await guard('PUBLISH_REF', candidate, context);
        let update, unknown = false;
        try {
          update = await transport.updateRef({ ref, expected: base, commit: proposed, force: false });
          if (typeof update?.updated !== 'boolean') unknown = true;
        } catch { unknown = true; }
        if (!unknown && update.updated === false) continue; // confirmed CAS conflict only
        let observedCommit, observed, confirmed;
        try {
          await guard('READ_RECONCILE', candidate, context);
          observedCommit = await head(); observed = await snapshot(observedCommit, candidate);
          confirmed = await verifyAccepted(observedCommit, observed.manifest, candidate, candidateDigest, p);
        } catch (error) {
          if (unknown) fail('UNKNOWN_GIT_REF_EFFECT_RECONCILE_REQUIRED');
          throw error;
        }
        // Absence after a timeout is not proof the in-flight request cannot finish.
        need(confirmed, unknown ? 'UNKNOWN_GIT_REF_EFFECT_RECONCILE_REQUIRED' : 'GIT_REF_READBACK_UNVERIFIED');
        const ancestry = proposed === observedCommit || await transport.isAncestor({ ancestor: proposed, descendant: observedCommit });
        need(ancestry === true, 'GIT_REF_LINEAGE_UNVERIFIED');
        return receipt({ candidate, candidateDigest, accepted: confirmed, observedCommit, publishedCommit: proposed, status: unknown ? 'UNKNOWN_EFFECT_RECONCILED_COMMITTED' : 'COMMITTED_READBACK_VERIFIED', attempts: attempt });
      }
      fail('GIT_REF_CONFLICT_RETRY_SAME_CANDIDATE');
    },
  };
}
