import { createHmac, timingSafeEqual, createHash } from 'node:crypto';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const enc = value => Buffer.from(value).toString('base64url');
const dec = value => Buffer.from(value, 'base64url').toString('utf8');

function safeEqual(a, b) {
  const ah = createHash('sha256').update(String(a), 'utf8').digest();
  const bh = createHash('sha256').update(String(b), 'utf8').digest();
  return ah.length === bh.length && timingSafeEqual(ah, bh);
}
function secret() { return String(Netlify.env.get('WL_SESSION_SECRET') || ''); }
export function passwordOK(value) {
  const expected = String(Netlify.env.get('WL_PASSWORD') || '');
  return Boolean(expected && value && safeEqual(value, expected));
}
export function issueSession(now = Date.now()) {
  const s = secret();
  if (!s) throw new Error('WL_SESSION_SECRET missing');
  const payload = JSON.stringify({ v:1, iat:now, exp:now + SESSION_TTL_MS, scope:'WL' });
  const body = enc(payload);
  const sig = createHmac('sha256', s).update(body).digest('base64url');
  return { token:`${body}.${sig}`, expires_at:new Date(now + SESSION_TTL_MS).toISOString() };
}
export function verifySession(header, now = Date.now()) {
  const raw = String(header || '').replace(/^Bearer\s+/i, '').trim();
  const [body, sig, extra] = raw.split('.');
  if (!body || !sig || extra) return false;
  const s = secret(); if (!s) return false;
  const expected = createHmac('sha256', s).update(body).digest('base64url');
  if (!safeEqual(sig, expected)) return false;
  try {
    const payload = JSON.parse(dec(body));
    return payload?.v === 1 && payload?.scope === 'WL' && Number(payload.exp) > now && Number(payload.iat) <= now + 60_000;
  } catch (_) { return false; }
}
