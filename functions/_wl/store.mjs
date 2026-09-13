import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, scryptSync } from 'node:crypto';

export const STORE_SCHEMA = 'wl.managed.encrypted.v1';
export const NORMAL_CAPACITY = 3 * 1024 * 1024;
export const MAX_CAPACITY = 4 * 1024 * 1024;
const RECONCILIATION_CACHE_SIZE = 64;
const AAD = Buffer.from('WL:managed:control:v1');
export class StoreError extends Error {
  constructor(code, status = 503) { super(code); this.code = code; this.status = status; }
}
const sha = x => createHash('sha256').update(x).digest('hex');
export function passwordDataKey(password) {
  if (typeof password !== 'string' || password.length < 1 || password.length > 200) throw new StoreError('KEY_UNAVAILABLE', 401);
  return scryptSync(password, 'WL:BD:managed:private-store:v1', 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}
export function sealState(value, key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new StoreError('KEY_UNAVAILABLE');
  const bytes = Buffer.from(JSON.stringify(value));
  if (bytes.length > MAX_CAPACITY) throw new StoreError('STORE_CAPACITY_REQUIRES_ARCHIVE', 507);
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(AAD);
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return { schema: STORE_SCHEMA, iv: iv.toString('base64'), ciphertext: encrypted.toString('base64'), tag: cipher.getAuthTag().toString('base64'), sha256: sha(encrypted) };
}
export function openState(envelope, key) {
  try {
    if (envelope?.schema !== STORE_SCHEMA) throw Error();
    const encrypted = Buffer.from(envelope.ciphertext, 'base64');
    if (sha(encrypted) !== envelope.sha256) throw Error();
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
    decipher.setAAD(AAD); decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
    const state = JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'));
    if (!state || typeof state !== 'object' || !Number.isSafeInteger(state._store?.revision)) throw Error();
    return state;
  } catch { throw new StoreError('STORE_INTEGRITY_OR_KEY_FAILURE'); }
}

// One encrypted aggregate is the transaction boundary: controls, permits,
// accepted patches, command receipts and memory cursors commit together.
// No network/model/send operation is permitted inside mutate's callback.
export function createAtomicStore({ blobs, key, initial, maxRetries = 8, objectKey = 'root.v1.enc.json' }) {
  async function readVersion() {
    const current = await blobs.getWithMetadata(objectKey, { type: 'json', consistency: 'strong' });
    if (!current) return { state: { ...initial(), _store: { revision: 0, transactions: {} } }, etag: null };
    if (typeof current.etag !== 'string' || !current.etag) throw new StoreError('CAS_ETAG_UNAVAILABLE');
    return { state: openState(current.data, key), etag: current.etag };
  }
  return {
    async read() { return (await readVersion()).state; },
    async mutate(fn, { safety = false } = {}) {
      const transaction = randomUUID();
      for (let i = 0; i < maxRetries; i++) {
        const { state, etag } = await readVersion();
        const draft = structuredClone(state);
        const result = fn(draft);
        if (result && typeof result.then === 'function') throw new StoreError('ASYNC_TRANSACTION_FORBIDDEN', 400);
        // Idempotent reads/retries do not consume a storage revision.
        if (JSON.stringify(draft) === JSON.stringify(state)) return result;
        // This is a bounded storage-response reconciliation cache, not the
        // canonical command/event journal. Those records remain untouched.
        // Keep only a digest: command/packet payloads must not be copied here.
        const transactions = Object.fromEntries(Object.entries(state._store.transactions).slice(-(RECONCILIATION_CACHE_SIZE - 1)));
        transactions[transaction] = { result_digest: sha(JSON.stringify(result) ?? 'null'), revision: state._store.revision + 1 };
        draft._store = { revision: state._store.revision + 1, transactions };
        // Ordinary intake cannot consume the final MiB reserved for trusted
        // STOP/Pause/delete/expiry/revocation operations. HTTP body cannot opt in.
        if (!safety && Buffer.byteLength(JSON.stringify(draft)) > NORMAL_CAPACITY) throw new StoreError('STORE_INTAKE_CAPACITY_RESERVED_FOR_STOP', 507);
        const envelope = sealState(draft, key);
        let write;
        try {
          write = await blobs.setJSON(objectKey, envelope, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
        } catch {
          // An uncertain storage effect is reconciled before any retry.
          const readback = await readVersion();
          if (readback.state._store.transactions[transaction]?.result_digest === transactions[transaction].result_digest) return result;
          throw new StoreError('UNKNOWN_STORAGE_EFFECT_RECONCILE_REQUIRED');
        }
        if (typeof write?.modified !== 'boolean') throw new StoreError('CAS_UNSUPPORTED');
        if (!write.modified) continue;
        const readback = await readVersion();
        const recorded = readback.state._store.transactions[transaction];
        if (recorded?.result_digest !== transactions[transaction].result_digest) throw new StoreError('COMMIT_READBACK_UNVERIFIED');
        return result;
      }
      throw new StoreError('CAS_CONFLICT_RETRY_SAME_COMMAND', 409);
    }
  };
}
