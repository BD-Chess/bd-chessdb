import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { authenticate, passwordMatches, env, accessError } from '../mdlxdcc-guide/access.mjs';

const COOKIE = '__Host-omnicpq-demo';
const DAY = 86400;
const sha = value => createHmac('sha256', secret()).update(value).digest('hex');
function secret() {
  const value = env('MDLXDCC_GUIDE_SESSION_SECRET');
  if (!value || value.length < 48) throw accessError('AUTH_UNAVAILABLE');
  return value;
}
export function ipHash(context) {
  let ip = String(context?.ip || '').trim().toLowerCase();
  if (ip.startsWith('::ffff:') && isIP(ip.slice(7)) === 4) ip = ip.slice(7);
  if (!isIP(ip)) throw accessError('DEMO_IP_UNAVAILABLE', 403);
  return sha('omnicpq-ip-v1:' + ip);
}
export async function runtime(action, data = {}, { fetcher = fetch } = {}) {
  const url = env('MDLXDCC_GUIDE_DATABASE_URL'), key = env('MDLXDCC_GUIDE_DATABASE_PUBLISHABLE_KEY');
  const serverKey = env('MDLXDCC_GUIDE_DATABASE_SECRET');
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url || '') || !key || !serverKey) throw accessError('STORAGE_UNAVAILABLE');
  let result;
  try {
    const response = await fetcher(url + '/rest/v1/rpc/omnicpq_runtime', {
      method: 'POST', headers: { apikey: key, 'x-mdlxdcc-guide-key': serverKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, data }), signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw Error();
    result = await response.json();
  } catch { throw accessError('STORAGE_UNAVAILABLE'); }
  if (result?.error) throw accessError(result.error, ({ AUTH_REQUIRED: 401, DEMO_EXPIRED: 403, DEMO_IP_CHANGED: 403,
    DEMO_REVOKED: 403, DEMO_LIMIT: 429, RATE_LIMITED: 429, DUPLICATE_REQUEST: 409, REQUEST_IN_PROGRESS: 409 })[result.error] || 503);
  return result;
}
export function demoCookie(actor, now = Date.now()) {
  const exp = Math.min(Math.floor(Date.parse(actor.usage.expires_at) / 1000), Math.floor(now / 1000) + DAY);
  const payload = Buffer.from(JSON.stringify({ scope: 'omnicpq-demo-v1', id: actor.id, ip: actor.ipHash, exp })).toString('base64url');
  const sig = createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${COOKIE}=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.max(0, exp - Math.floor(now / 1000))}`;
}
export const clearDemoCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
export function readDemo(req, context, now = Date.now()) {
  const value = req.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (!value || value.length > 1500) return null;
  try {
    const [payload, signature, extra] = value.split('.');
    if (!signature || extra) return null;
    const expected = createHmac('sha256', secret()).update(payload).digest(), actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (p.scope !== 'omnicpq-demo-v1' || !/^[a-f0-9-]{36}$/i.test(p.id || '') || p.exp <= now / 1000 || p.exp > now / 1000 + DAY + 5) return null;
    const ip = ipHash(context);
    if (p.ip !== ip) throw accessError('DEMO_IP_CHANGED', 403);
    return { id: p.id, email: env('OMNICPQ_DEMO_EMAIL'), role: 'demo', ipHash: ip };
  } catch (e) { if (e.code === 'DEMO_IP_CHANGED') throw e; return null; }
}
export async function authenticateOmni(req, context, { ownerAuth = authenticate, rpc = runtime } = {}) {
  try { const actor = await ownerAuth(req); if (actor.role === 'owner') return actor; }
  catch (e) { if (e.code !== 'AUTH_REQUIRED') throw e; }
  const actor = readDemo(req, context);
  if (!actor) throw accessError('AUTH_REQUIRED', 401);
  actor.usage = await rpc('check', { id: actor.id, ip_hash: actor.ipHash });
  return actor;
}
export async function loginDemo(email, password, token, context, { rpc = runtime } = {}) {
  const expected = env('OMNICPQ_DEMO_EMAIL')?.trim().toLowerCase();
  if (!expected || String(email).trim().toLowerCase() !== expected || !await passwordMatches(password, env('OMNICPQ_DEMO_PASSWORD_HASH'))) throw accessError('INVALID_LOGIN', 401);
  if (!/^[a-f0-9]{64}$/.test(token || '')) throw accessError('DEMO_INVITATION_REQUIRED', 401);
  const ip = ipHash(context);
  const result = await rpc('claim', { token_hash: sha('omnicpq-token-v1:' + token), ip_hash: ip });
  return { id: result.id, email: expected, role: 'demo', ipHash: ip, usage: result };
}
export async function createDemo({ rpc = runtime } = {}) {
  const token = randomBytes(32).toString('hex'), id = randomUUID();
  await rpc('create', { id, token_hash: sha('omnicpq-token-v1:' + token) });
  return { id, token };
}

// Prices: official gpt-6-luna page, verified 2026-10-22. Conservative upper
// rates include long context, cache writes and the regional premium. Images
// reserve the entire model context, avoiding any pixel/token approximation.
export function maximumCharge(payload) {
  if (payload.model !== 'gpt-6-luna' || payload.service_tier !== 'default' || payload.tools?.length ||
      !Number.isSafeInteger(payload.max_output_tokens) || payload.max_output_tokens < 1 || payload.max_output_tokens > 6000) throw accessError('UNPRICED_MODEL');
  const hasImage = payload.input?.some(m => Array.isArray(m.content) && m.content.some(c => c.type === 'input_image'));
  const input = hasImage ? 1_050_000 : Math.min(1_050_000, Buffer.byteLength(JSON.stringify(payload), 'utf8') + 8192);
  return input * 275 + payload.max_output_tokens * 825;
}
export function demoBudget(actor, provider, model, { rpc = runtime, requestId = randomUUID() } = {}) {
  return {
    async reserve(payload) {
      if (actor.role === 'owner') return null;
      if (actor.role !== 'demo' || provider !== 'gpt' || model !== 'gpt-6-luna') throw accessError('AUTH_REQUIRED', 401);
      const held = { id: randomUUID(), amount: maximumCharge(payload) };
      await rpc('reserve', { id: held.id, demo_id: actor.id, request_id: requestId, ip_hash: actor.ipHash, amount: held.amount });
      return held;
    },
    async settle(held, usage, rejected = false) {
      if (!held) return null;
      const known = usage && Number.isSafeInteger(usage.input_tokens) && Number.isSafeInteger(usage.output_tokens) && usage.input_tokens >= 0 && usage.output_tokens >= 0;
      const amount = rejected ? 0 : known ? usage.input_tokens * 275 + usage.output_tokens * 825 : held.amount;
      return rpc('settle', { id: held.id, demo_id: actor.id, amount, unknown: !known && !rejected });
    },
  };
}
