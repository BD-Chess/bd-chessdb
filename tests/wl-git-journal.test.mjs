/** LOCAL_SYNTHETIC_GIT_TRANSPORT tests. No real Git provider/ref or model used. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { GIT_CANDIDATE_SCHEMA, GIT_SINK_ASSURANCE, createGitJournalSink, validateGitCandidate, journalDigest } from '../functions/_wl/git-journal.mjs';

const NS = 'public/AI8/WL_RUNS/0123456789abcdef0123456789abcdef';
const KEY = Buffer.alloc(32, 19);
const code = wanted => error => error.code === wanted;
const cloneTree = tree => new Map([...tree].map(([path, bytes]) => [path, Buffer.from(bytes)]));
const hash = value => createHash('sha1').update(value).digest('hex');

class FakeGit {
  constructor() {
    this.head = hash('initial');
    this.commits = new Map([[this.head, { parent: null, tree: new Map([['public/WL/state.enc.json', Buffer.from('unchanged encrypted origin fixture')], ['public/unrelated.html', Buffer.from('original')]]) }]]);
    this.creates = []; this.updates = []; this.sequence = 0;
    this.beforeUpdate = null; this.failure = null; this.extraPath = null; this.readTamper = false;
  }
  async getRef() { return this.head; }
  async readFile({ commit, path }) {
    const bytes = this.commits.get(commit)?.tree.get(path);
    if (!bytes) return null;
    if (this.readTamper && commit === this.head && path.includes('/events/')) return Buffer.from('tampered');
    return Buffer.from(bytes);
  }
  async createCommit({ parent, files, message }) {
    assert.ok(this.commits.has(parent));
    const tree = cloneTree(this.commits.get(parent).tree);
    for (const file of files) tree.set(file.path, Buffer.from(file.bytes));
    if (this.extraPath) tree.set(this.extraPath, Buffer.from('unauthorized change'));
    const sha = hash(parent + ':' + ++this.sequence + ':' + files.map(f => journalDigest(f.bytes)).join(':'));
    this.commits.set(sha, { parent, tree });
    this.creates.push({ parent, files: files.map(f => ({ path: f.path, digest: journalDigest(f.bytes) })), message, sha });
    return sha;
  }
  async inspectCommit({ commit, parent }) {
    const node = this.commits.get(commit), before = this.commits.get(parent).tree;
    const paths = [...new Set([...before.keys(), ...node.tree.keys()])];
    return { commit, parents: [node.parent], changed_paths: paths.filter(p => !before.get(p)?.equals(node.tree.get(p) || Buffer.alloc(0))) };
  }
  async isAncestor({ ancestor, descendant }) {
    for (let p = descendant; p; p = this.commits.get(p)?.parent) if (p === ancestor) return true;
    return false;
  }
  async updateRef(input) {
    this.updates.push({ ...input }); assert.equal(input.force, false);
    if (this.beforeUpdate) { const hook = this.beforeUpdate; this.beforeUpdate = null; await hook(input); }
    if (this.failure === 'UNKNOWN_NO_OBSERVED_EFFECT') throw new Error('timeout before outcome known');
    if (input.expected !== this.head) return { updated: false };
    assert.equal(this.commits.get(input.commit).parent, this.head, 'only non-force fast-forward');
    this.head = input.commit;
    if (this.failure === 'LOST_RESPONSE') { this.failure = null; throw new Error('response lost after ref update'); }
    if (this.failure === 'TAMPER_READBACK') this.readTamper = true;
    return { updated: true };
  }
  unrelated(path = 'public/unrelated.html', value = 'concurrent content') {
    const tree = cloneTree(this.commits.get(this.head).tree); tree.set(path, Buffer.from(value));
    const sha = hash(this.head + ':' + ++this.sequence + ':unrelated'); this.commits.set(sha, { parent: this.head, tree }); this.head = sha;
  }
}

function candidate({ number = 1, parent = null, previous = {} } = {}) {
  const artifactBytes = Buffer.from('private generated artifact ' + number);
  const patch = { set: { finding: 'private research finding ' + number }, remove: [] };
  const state = { ...previous, ...patch.set };
  const result = { complete: true, artifacts: [{ artifact_id: 'artifact-' + number, kind: 'report', digest: journalDigest(artifactBytes), receipt_ref: 'actual-verifier-receipt-' + number }], tests: [{ criterion_id: 'result-match', status: 'PASS', receipt_ref: 'test-receipt-' + number }] };
  const event = { event_id: 'event-' + number, lab_id: 'new-lab', run_id: 'new-run', mission_id: 'new-mission', turn_permit_id: 'permit-' + number, attempt_id: 'attempt-' + number, parent, state_hash: journalDigest(state), previous_state_hash: journalDigest(previous), patch, patch_hash: journalDigest(patch), result, result_hash: journalDigest(result), payload_hash: journalDigest({ patch, result }), source_set_hash: journalDigest(['bound-source']), mission_hash: journalDigest({ frozen: 'private Mission' }), accepted_at: '2026-09-13T02:00:00.000Z', control_epoch: 1, execution_grant: 1 };
  return { schema: GIT_CANDIDATE_SCHEMA, run_kind: 'NEW_WL', event, state, artifacts: [{ artifact_id: 'artifact-' + number, bytes_base64: artifactBytes.toString('base64'), digest: journalDigest(artifactBytes) }], authorization_ref: 'current-allowed-git-effect-1' };
}
function sink(git, options = {}) { return createGitJournalSink({ transport: git, key: KEY, namespace: NS, authorize: async ctx => ctx?.allowed === true, ...options }); }
const CTX = { allowed: true };

test('BUILD:G3/G7: encrypted event/state/artifacts/manifest commit atomically with exact readback and preserved origin', async () => {
  const git = new FakeGit(), initial = git.head, input = candidate();
  const receipt = await sink(git).commit(input, CTX);
  assert.equal(receipt.status, 'COMMITTED_READBACK_VERIFIED'); assert.equal(receipt.readback_verified, true);
  assert.equal(receipt.published_commit, git.head); assert.equal(receipt.observed_commit, git.head);
  assert.equal(receipt.model_calls, 0); assert.equal(receipt.transport_assurance, GIT_SINK_ASSURANCE);
  assert.equal(receipt.cross_store_atomicity, 'NOT_CLAIMED');
  const tree = git.commits.get(git.head).tree;
  assert.deepEqual(tree.get('public/WL/state.enc.json'), git.commits.get(initial).tree.get('public/WL/state.enc.json'));
  assert.equal(tree.get('public/unrelated.html').toString(), 'original');
  assert.equal(git.creates[0].files.length, 5);
  for (const [path, bytes] of tree) if (path.startsWith(NS)) {
    const text = bytes.toString();
    for (const privateText of ['new-lab', 'new-run', 'new-mission', 'private research', 'private generated', 'source_set_hash', 'attempt-1']) assert.ok(!text.includes(privateText), 'no public plaintext ' + privateText);
    assert.equal(JSON.parse(text).schema, 'wl.git-journal.aes-gcm.v1');
  }
  assert.equal(git.creates[0].message, 'WL isolated encrypted research checkpoint');
});

test('FI-T02/03: same permit/attempt/candidate retry returns recorded encrypted output, including new sink instance', async () => {
  const git = new FakeGit(), input = candidate(); const first = await sink(git).commit(input, CTX);
  const second = await sink(git).commit(structuredClone(input), CTX);
  assert.equal(second.status, 'ALREADY_COMMITTED_READBACK_VERIFIED'); assert.equal(second.published_commit, null);
  assert.equal(second.observed_commit, first.published_commit); assert.deepEqual(second.encrypted_hashes, first.encrypted_hashes);
  assert.equal(git.updates.length, 1); assert.equal(git.creates.length, 1);
  const changedAttempt = structuredClone(input); changedAttempt.event.attempt_id = 'attempt-other';
  await assert.rejects(sink(git).commit(changedAttempt, CTX), code('PERMIT_COMMITTED_DIFFERENT_CANDIDATE'));
  assert.equal(git.updates.length, 1);
});

test('BUILD:G3 concurrent unrelated main update: rebase exact encrypted candidate without model recall or lost unrelated change', async () => {
  const git = new FakeGit(); git.beforeUpdate = () => git.unrelated();
  const receipt = await sink(git).commit(candidate(), CTX);
  assert.equal(receipt.ref_attempts, 2); assert.equal(git.creates.length, 2);
  assert.deepEqual(git.creates[0].files, git.creates[1].files, 'ciphertexts reused exactly across ref race');
  assert.notEqual(git.creates[0].parent, git.creates[1].parent);
  assert.equal(git.commits.get(git.head).tree.get('public/unrelated.html').toString(), 'concurrent content');
  assert.ok(git.updates.every(call => call.force === false)); assert.equal(receipt.model_calls, 0);
});

test('BUILD:G3 same-target frontier conflict preserves competing accepted result and rejects stale candidate', async () => {
  const git = new FakeGit(), first = candidate(), stale = candidate({ number: 2 });
  git.beforeUpdate = () => sink(git).commit(first, CTX);
  await assert.rejects(sink(git).commit(stale, CTX), code('JOURNAL_FRONTIER_CONFLICT'));
  const confirmed = await sink(git).commit(first, CTX); assert.equal(confirmed.status, 'ALREADY_COMMITTED_READBACK_VERIFIED');
  assert.equal(git.updates.length, 2);
});

test('FI-T05 UNKNOWN_EFFECT: lost committed response reconciles actual ref/event exactly once', async () => {
  const git = new FakeGit(); git.failure = 'LOST_RESPONSE';
  const receipt = await sink(git).commit(candidate(), CTX);
  assert.equal(receipt.status, 'UNKNOWN_EFFECT_RECONCILED_COMMITTED'); assert.equal(receipt.readback_verified, true);
  assert.equal(git.updates.length, 1); assert.equal(receipt.published_commit, git.head);
});

test('FI-T05 UNKNOWN_EFFECT: absent event after timeout is not proof of no future effect and cannot trigger blind retry', async () => {
  const git = new FakeGit(), initial = git.head; git.failure = 'UNKNOWN_NO_OBSERVED_EFFECT';
  await assert.rejects(sink(git).commit(candidate(), CTX), code('UNKNOWN_GIT_REF_EFFECT_RECONCILE_REQUIRED'));
  assert.equal(git.updates.length, 1); assert.equal(git.head, initial);
});

test('STOP between staging and ref request prevents publication; stopped retry may only reconcile existing output', async () => {
  const git = new FakeGit(), initial = git.head; let control = true;
  const originalInspect = git.inspectCommit.bind(git);
  git.inspectCommit = async arg => { const result = await originalInspect(arg); control = false; return result; };
  const stopped = sink(git, { authorize: async (_ctx, request) => request.phase === 'READ_RECONCILE' || control });
  await assert.rejects(stopped.commit(candidate(), CTX), code('JOURNAL_AUTHORIZATION_DENIED'));
  assert.equal(git.updates.length, 0); assert.equal(git.head, initial);
  const normal = new FakeGit(); await sink(normal).commit(candidate(), CTX);
  const passive = sink(normal, { authorize: async (_ctx, req) => req.phase === 'READ_RECONCILE' });
  assert.equal((await passive.commit(candidate(), {})).status, 'ALREADY_COMMITTED_READBACK_VERIFIED');
  assert.equal(normal.updates.length, 1);
});

test('namespace and run-kind guards reject legacy paths, aliases, traversal and old origin identities', async () => {
  const git = new FakeGit();
  for (const namespace of ['public/WL', 'public/WL/BD', 'public/AI8/WL_RUNS/../WL', 'public/AI8/WL_RUNS/new-run', NS + '/']) assert.throws(() => sink(git, { namespace }), code('NEW_WL_NAMESPACE_REQUIRED'));
  const legacy = candidate(); legacy.event.run_id = 'WL-RHP11-20260912';
  await assert.rejects(sink(git).commit(legacy, CTX), code('LEGACY_NAMESPACE_FORBIDDEN'));
  const email = candidate(); email.run_kind = 'EMAIL_DIALOGUE';
  assert.throws(() => validateGitCandidate(email), code('NEW_WL_CANDIDATE_REQUIRED'));
  assert.equal(git.creates.length, 0);
});

test('commit tree inspection rejects extra protected paths before ref update', async () => {
  const git = new FakeGit(), initial = git.head; git.extraPath = 'public/WL/vault.json';
  await assert.rejects(sink(git).commit(candidate(), CTX), code('GIT_COMMIT_SCOPE_OR_PARENT_MISMATCH'));
  assert.equal(git.updates.length, 0); assert.equal(git.head, initial);
});

test('immutable orphaned event from partial prior write is not overwritten to force parity', async () => {
  const git = new FakeGit();
  git.beforeUpdate = () => {
    const event = git.creates[0].files.find(row => row.path.includes('/events/'));
    git.unrelated(event.path, 'orphaned prior object');
  };
  await assert.rejects(sink(git).commit(candidate(), CTX), code('IMMUTABLE_JOURNAL_PATH_EXISTS'));
  assert.equal(git.updates.length, 1);
});

test('state patch replay and artifact bytes must match exact accepted receipt', async () => {
  const git = new FakeGit(), altered = candidate(); altered.state.finding = 'different payload'; altered.event.state_hash = journalDigest(altered.state);
  await assert.rejects(sink(git).commit(altered, CTX), code('PATCH_REPLAY_MISMATCH'));
  const missing = candidate(); missing.artifacts = [];
  assert.throws(() => validateGitCandidate(missing), code('MISSING_ACCEPTED_ARTIFACT_BYTES'));
  const wrong = candidate(); wrong.artifacts[0].bytes_base64 = Buffer.from('different bytes').toString('base64');
  assert.throws(() => validateGitCandidate(wrong), code('ARTIFACT_BYTES_MISMATCH'));
  assert.equal(git.creates.length, 0);
});

test('two real adapter publications preserve predecessor snapshots; retry older candidate verifies its own immutable state', async () => {
  const git = new FakeGit(), first = candidate(); const firstReceipt = await sink(git).commit(first, CTX);
  const second = candidate({ number: 2, parent: first.event.event_id, previous: first.state });
  await sink(git).commit(second, CTX);
  const replay = await sink(git).commit(first, CTX);
  assert.equal(replay.status, 'ALREADY_COMMITTED_READBACK_VERIFIED'); assert.deepEqual(replay.encrypted_hashes, firstReceipt.encrypted_hashes);
  assert.equal(git.creates.length, 2);
});

test('wrong encryption key, namespace ownership, or tampered committed readback cannot pass', async () => {
  const git = new FakeGit(); await sink(git).commit(candidate(), CTX);
  await assert.rejects(sink(git, { key: Buffer.alloc(32, 20) }).commit(candidate(), CTX), code('JOURNAL_DECRYPT_OR_INTEGRITY_FAILED'));
  const foreign = candidate(); foreign.event.lab_id = 'different-lab';
  await assert.rejects(sink(git).commit(foreign, CTX), code('JOURNAL_SCOPE_CONFLICT'));
  const corrupted = new FakeGit(); corrupted.failure = 'TAMPER_READBACK';
  await assert.rejects(sink(corrupted).commit(candidate(), CTX), code('ACCEPTED_OBJECT_READBACK_MISMATCH'));
});

test('CAS retry count is bounded without force or model fallback', async () => {
  const git = new FakeGit();
  git.updateRef = async input => { git.updates.push(input); git.unrelated('public/counter.txt', String(git.updates.length)); return { updated: false }; };
  await assert.rejects(sink(git, { maxRetries: 2 }).commit(candidate(), CTX), code('GIT_REF_CONFLICT_RETRY_SAME_CANDIDATE'));
  assert.equal(git.updates.length, 2); assert.deepEqual(git.creates[0].files, git.creates[1].files);
});

test('missing transport/identity/key leaves sink unbound; false live/atomic assurance is never returned', async () => {
  assert.throws(() => createGitJournalSink({}), code('GIT_TRANSPORT_UNAVAILABLE'));
  const git = new FakeGit(); assert.throws(() => sink(git, { key: null }), code('JOURNAL_KEY_UNAVAILABLE'));
  await assert.rejects(sink(git).commit(candidate(), { allowed: false }), code('JOURNAL_AUTHORIZATION_DENIED'));
  assert.equal(git.creates.length, 0); assert.match(sink(git).assurance, /NO_LIVE_BINDING/);
});
