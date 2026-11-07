// BD Start sync (BD, 2026-11-07): one end-to-end encrypted record per vault.
// The browser derives the vault id and the AES-GCM key from BD's sync password
// (public/Start/sync.js). This function only ever sees the vault id and
// ciphertext; it cannot read notes, calendar entries or links.
const VAULT = /^[a-f0-9]{64}$/;
const IV = /^[A-Za-z0-9+/]{16}$/;
const DATA = /^[A-Za-z0-9+/]+={0,2}$/;
export const LIMITS = Object.freeze({ vaults: 5, dataChars: 1_500_000 });
const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Pragma': 'no-cache',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive'
};
const answer = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });
const keyOf = vault => 'vault-' + vault;

export function createStartSync({ store, now = () => Date.now(), limits = LIMITS }) {
  async function read(vault) {
    const found = await store.getWithMetadata(keyOf(vault), { type: 'json' });
    return found && found.data ? { record: found.data, etag: found.etag } : null;
  }
  async function vaultCount() {
    const listed = await store.list({ prefix: 'vault-' });
    return (listed && listed.blobs || []).length;
  }
  return async function handle(req) {
    const vault = String(req.headers.get('x-bd-start-vault') || '');
    if (!VAULT.test(vault)) return answer({ ok: false, error: 'vault' }, 400);
    if (req.method === 'GET') {
      const current = await read(vault);
      if (!current) return answer({ ok: true, exists: false, revision: 0 });
      const { revision, updatedAt, iv, data } = current.record;
      return answer({ ok: true, exists: true, revision, updatedAt, iv, data });
    }
    if (req.method === 'DELETE') {
      await store.delete(keyOf(vault));
      return answer({ ok: true });
    }
    if (req.method !== 'PUT') return answer({ ok: false, error: 'method' }, 405);
    if (Number(req.headers.get('content-length') || 0) > limits.dataChars + 4096) return answer({ ok: false, error: 'size' }, 413);
    let body;
    try { body = await req.json(); } catch (_) { return answer({ ok: false, error: 'json' }, 400); }
    const base = body && body.baseRevision;
    if (!Number.isSafeInteger(base) || base < 0 || typeof body.iv !== 'string' || !IV.test(body.iv) || typeof body.data !== 'string' || !DATA.test(body.data)) return answer({ ok: false, error: 'input' }, 400);
    if (body.data.length > limits.dataChars) return answer({ ok: false, error: 'size' }, 413);
    const current = await read(vault);
    const revision = current ? current.record.revision : 0;
    if (base !== revision) return answer({ ok: false, error: 'conflict', revision }, 409);
    if (!current && await vaultCount() >= limits.vaults) return answer({ ok: false, error: 'vault_limit' }, 403);
    const next = { revision: revision + 1, updatedAt: new Date(now()).toISOString(), iv: body.iv, data: body.data };
    // Compare-and-set: a parallel write from another device cannot be overwritten silently.
    const written = await store.setJSON(keyOf(vault), next, current ? (current.etag ? { onlyIfMatch: current.etag } : {}) : { onlyIfNew: true });
    if (!written || written.modified !== true) {
      const again = await read(vault);
      return answer({ ok: false, error: 'conflict', revision: again ? again.record.revision : 0 }, 409);
    }
    return answer({ ok: true, revision: next.revision, updatedAt: next.updatedAt });
  };
}
