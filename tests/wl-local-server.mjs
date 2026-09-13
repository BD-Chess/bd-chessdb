// Local-only browser fixture. All credentials, ciphertexts and research content
// below are synthetic. Never deploy this test server or the /__qa routes.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createCipheriv, createHash, pbkdf2Sync, randomBytes } from 'node:crypto';
import { createManagedHandler, initialState } from '../functions/_wl/service.mjs';
import { createAtomicStore } from '../functions/_wl/store.mjs';
const root = path.resolve(import.meta.dirname, '..'), secret = 'SYNTHETIC_ONLY', key = randomBytes(32), vaultId = 'synthetic-qa';
const sha = value => createHash('sha256').update(value).digest('hex');
function box(value, cryptoKey, aad) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', cryptoKey, iv); cipher.setAAD(Buffer.from(aad));
  const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final(), cipher.getAuthTag()]);
  return { format: 'WL-ENC-2', iv: iv.toString('base64'), cipher: data.toString('base64'), sha256: sha(data) };
}
const salt = randomBytes(16), kek = pbkdf2Sync(secret, salt, 600000, 32, 'sha256');
const vault = { format: 'WL-VAULT-2', vault_id: vaultId, kdf: { name: 'PBKDF2-SHA256', salt: salt.toString('base64'), iterations: 600000 },
  control: box({ schema: 'synthetic-control', ok: true }, key, 'WL:control:' + vaultId), wrap: box({ key: key.toString('base64') }, kek, 'WL:wrap:' + vaultId) };
const summary = box({ schema: 'wl.bd.summary.v1', generated_at_utc: '2026-09-12T00:00:00Z',
  frontiers: { email: { logical_messages: 10, A_turn: 4, B_turn: 6 }, rhp: { events: 5, event_id: 'e000005' } },
  email: { title: 'SYNTHETIC_EMAIL_TITLE', overview: 'SYNTHETIC_PRIVATE_EMAIL_VIEW', sections: [{ heading: 'Fixture', text: 'Synthetic statement only.' }], assessment: 'REPORTED' },
  rhp: { title: 'SYNTHETIC_RESEARCH_TITLE', overview: 'SYNTHETIC_PRIVATE_RESEARCH_VIEW', sections: [{ heading: 'Fixture', text: 'Synthetic result only.' }], assessment: 'UNVERIFIED' }
}, key, 'WL:BD:summary:v1');
const legacyState = box({ schema: 'wl.state.v2', run_id: 'WL-RHP11-20260912', revision: 7, updated_at: '2026-09-12T17:59:08Z', entries: Array.from({ length: 6 }, (_, i) => ({ seq: i + 1, event_id: 'e' + String(i + 1).padStart(6, '0'), path: 'data/entries/e' + String(i + 1).padStart(6, '0') + '.enc.json' })) }, key, 'WL:state:' + vaultId);
let row = null, version = 0;
const blobs = { async getWithMetadata() { return structuredClone(row); }, async setJSON(_k, value, options) {
  if ((options.onlyIfNew && row) || (options.onlyIfMatch && options.onlyIfMatch !== row?.etag)) return { modified: false };
  row = { data: value, etag: String(++version) }; return { modified: true, etag: row.etag };
} };
const store = createAtomicStore({ blobs, key: randomBytes(32), initial: initialState });
const handler = createManagedHandler({ authenticate: req => req.headers.get('x-wl-password') === secret, makeStore: () => store });
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:4173');
    if (url.pathname.startsWith('/api/')) {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const request = new Request(url, { method: req.method, headers: req.headers, ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Buffer.concat(chunks) }) });
      const response = await handler(request); res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text()); return;
    }
    if (/^\/__qa\/(320|390|1440)$/.test(url.pathname)) {
      const width = url.pathname.split('/').pop();
      res.setHeader('Content-Type', 'text/html'); res.end(`<!doctype html><title>WL synthetic viewport ${width}</title><body style="margin:0;background:#ddd"><iframe title="WL synthetic ${width}px" src="/WL/BD/?qa=unlocked" style="border:0;width:${width}px;height:1100px"></iframe></body>`); return;
    }
    if (url.pathname === '/__qa/boot.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end(`sessionStorage.setItem('wl-v2-session',${JSON.stringify(JSON.stringify({ vault: vaultId, key: key.toString('base64') }))});`); return;
    }
    const fixed = { '/WL/vault.json': vault, '/WL/BD/summary.enc.json': summary, '/WL/state.enc.json': legacyState };
    if (fixed[url.pathname]) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(fixed[url.pathname])); return; }
    const file = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
    if (!file.startsWith('/WL/') || file.includes('..')) { res.writeHead(404); res.end('Not found'); return; }
    let bytes = await readFile(path.join(root, 'public', file));
    if (file === '/WL/BD/index.html' && url.searchParams.get('qa') === 'unlocked') bytes = Buffer.from(bytes.toString().replace('<script ', '<script src="/__qa/boot.js"></script><script '));
    if (file === '/WL/BD/reader.js') bytes = Buffer.from(bytes.toString().replace("controlPassword=''", "controlPassword='SYNTHETIC_ONLY'"));
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    res.setHeader('Cache-Control', 'no-store'); res.end(bytes);
  } catch (error) { res.writeHead(500); res.end('Fixture failure'); }
});
server.listen(4173, '0.0.0.0', () => console.log('Synthetic WL fixture ready on port 4173. No production credentials or writes.'));
