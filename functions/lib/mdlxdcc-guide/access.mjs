import { createHmac, timingSafeEqual, randomBytes, randomUUID, scrypt as scryptCb, pbkdf2 as pbkdf2Cb, createDecipheriv } from 'node:crypto';
import { promisify } from 'node:util';

export const env = key => globalThis.Netlify?.env?.get(key) ?? process.env[key];
export const accessError = (code, status = 503) => Object.assign(Error(code), { code, status });
const scrypt = promisify(scryptCb), pbkdf2 = promisify(pbkdf2Cb);
const cookieName = '__Host-mdlxdcc-guide', lifetime = 8 * 3600;
const scryptOptions = { N:131072, r:8, p:1, maxmem:256 * 1024 * 1024 };
export function emailAddress(value) {
 const email = String(value || '').trim().toLowerCase();
 if (email.length > 254 || !/^[^\s@\x00-\x1f]+@[^\s@\x00-\x1f]+\.[^\s@\x00-\x1f]+$/.test(email)) throw accessError('INVALID_EMAIL', 400);
 return email;
}
export async function passwordHash(password) {
 if (typeof password !== 'string' || password.length < 8 || password.length > 256) throw accessError('INVALID_PASSWORD', 400);
 const salt = randomBytes(16), hash = await scrypt(password, salt, 32, scryptOptions);
 return `scrypt-v1$${salt.toString('hex')}$${hash.toString('hex')}`;
}
export async function passwordMatches(password, encoded) {
 if (typeof password !== 'string' || password.length > 256) return false;
 const parts = String(encoded || '').split('$');
 if (parts[0] !== 'scrypt-v1' || !/^[a-f0-9]{32}$/.test(parts[1] || '') || !/^[a-f0-9]{64}$/.test(parts[2] || '')) return false;
 const hash = await scrypt(password, Buffer.from(parts[1], 'hex'), 32, scryptOptions);
 const valid = timingSafeEqual(hash, Buffer.from(parts[2], 'hex')); hash.fill(0); return valid;
}
export async function database(action, data = {}, { fetcher = fetch } = {}) {
 const url = env('MDLXDCC_GUIDE_DATABASE_URL'), key = env('MDLXDCC_GUIDE_DATABASE_PUBLISHABLE_KEY'), secret = env('MDLXDCC_GUIDE_DATABASE_SECRET');
 if (!url || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) || !key || !secret) throw accessError('STORAGE_UNAVAILABLE');
 let result;
 try {
  const r = await fetcher(`${url}/rest/v1/rpc/mdlxdcc_guide`, { method:'POST', headers:{ apikey:key, 'x-mdlxdcc-guide-key':secret, 'Content-Type':'application/json' }, body:JSON.stringify({ action, data }), signal:AbortSignal.timeout(10000) });
  if (!r.ok) throw Error(); result = await r.json();
 } catch { throw accessError('STORAGE_UNAVAILABLE'); }
 if (result?.error) throw accessError(result.error, result.error === 'MONTHLY_LIMIT' || result.error === 'RATE_LIMITED' ? 429 : result.error === 'ACCOUNT_EXISTS' ? 409 : result.error === 'AUTH_REQUIRED' ? 401 : 503);
 return result;
}
function sessionSecret() { const secret = env('MDLXDCC_GUIDE_SESSION_SECRET'); if (!secret || secret.length < 48) throw accessError('AUTH_UNAVAILABLE'); return secret; }
export function sessionCookie(actor, now = Date.now()) {
 const payload = Buffer.from(JSON.stringify({ scope:'mdlxdcc-guide-v1', uid:actor.id, email:actor.email, role:actor.role, exp:Math.floor(now / 1000) + lifetime })).toString('base64url');
 const sig = createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
 return `${cookieName}=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${lifetime}`;
}
export const logoutCookie = () => `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
export function readSession(req, now = Date.now()) {
 const cookie = req.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
 if (!cookie || cookie.length > 2000) return null;
 try {
  const [payload, signature, extra] = cookie.split('.'); if (!signature || extra) return null;
  const expected = createHmac('sha256', sessionSecret()).update(payload).digest(), actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(expected, actual)) return null;
  const value = JSON.parse(Buffer.from(payload, 'base64url').toString());
  if (value.scope !== 'mdlxdcc-guide-v1' || !['owner','visitor'].includes(value.role) || !value.uid || typeof value.email !== 'string' || value.exp <= now / 1000 || value.exp > now / 1000 + lifetime + 5) return null;
  if (value.role === 'owner' && value.email !== env('MDLXDCC_GUIDE_OWNER_EMAIL')?.trim().toLowerCase()) return null;
  return { id:value.uid, email:value.email, role:value.role };
 } catch { return null; }
}
export async function authenticate(req, { rpc = database } = {}) {
 const actor = readSession(req); if (!actor) throw accessError('AUTH_REQUIRED', 401);
 if (actor.role === 'owner') return actor;
 const account = await rpc('account_active', { id:actor.id });
 if (!account?.active) throw accessError('AUTH_REQUIRED', 401);
 return actor;
}

// Verify the existing OWNER password against the public BD_ACCESS_V1 key wrap.
// Only verifier metadata is read: never unlock or retrieve private MAL content.
const ownerVerifierURL = 'https://raw.githubusercontent.com/BD-Chess/bd-chessdb/main/public/crp/IM3_MentalArena_MALm.html';
let verifierCache;
export async function verifyOwner(password, { fetcher = fetch, pack:provided } = {}) {
 if (typeof password !== 'string' || !password || password.length > 256) return false;
 let pack = provided;
 if (!pack) {
  if (verifierCache?.until > Date.now()) pack = verifierCache.pack;
  else {
   const r = await fetcher(ownerVerifierURL, { signal:AbortSignal.timeout(8000) });
   if (!r.ok || Number(r.headers.get('content-length') || 0) > 1500000) throw accessError('AUTH_UNAVAILABLE');
   const html = await r.text(); if (html.length > 1500000) throw accessError('AUTH_UNAVAILABLE');
   try { pack = JSON.parse(html.match(/<script\b[^>]*\bid=["']bd-access-data["'][^>]*>([\s\S]*?)<\/script>/i)?.[1] || 'null'); }
   catch { throw accessError('AUTH_UNAVAILABLE'); }
   verifierCache = { pack, until:Date.now() + 600000 };
  }
 }
 if (pack?.schema !== 'BD_ACCESS_V1' || pack.path !== 'crp/IM3_MentalArena_MALm.html' || pack.kdf?.iterations !== 600000 || !pack.wrap?.cipher || !pack.wrap?.iv) throw accessError('AUTH_UNAVAILABLE');
 const key = await pbkdf2(password, Buffer.from(pack.kdf.salt, 'base64'), pack.kdf.iterations, 32, 'sha256'); let plain;
 try {
  const ciphertext = Buffer.from(pack.wrap.cipher, 'base64'), decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(pack.wrap.iv, 'base64'));
  decipher.setAAD(Buffer.from(`BD_ACCESS_V1:${pack.path}:${pack.pair}:wrap`)); decipher.setAuthTag(ciphertext.subarray(-16));
  plain = Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()]); return plain.length === 32;
 } catch { return false; } finally { key.fill(0); plain?.fill(0); }
}
export async function signIn(action, email, password, { rpc = database, ownerVerifier = verifyOwner } = {}) {
 email = emailAddress(email);
 if (!['login','register'].includes(action) || typeof password !== 'string' || !password || password.length > 256) throw accessError('INVALID_LOGIN', 400);
 const isOwner = email === env('MDLXDCC_GUIDE_OWNER_EMAIL')?.trim().toLowerCase();
 if (isOwner) {
  if (action === 'register') throw accessError('ACCOUNT_EXISTS', 409);
  if (!await ownerVerifier(password)) throw accessError('INVALID_LOGIN', 401);
  return { id:'owner', email, role:'owner' };
 }
 if (action === 'register') {
  const actor = { id:randomUUID(), email, role:'visitor' };
  await rpc('account_create', { id:actor.id, email, password_hash:await passwordHash(password) }); return actor;
 }
 const account = await rpc('account_login', { email });
 // Perform the same expensive KDF for an unknown email to avoid a fast account oracle.
 const dummy = 'scrypt-v1$00000000000000000000000000000000$' + '0'.repeat(64);
 if (!await passwordMatches(password, account?.password_hash || dummy) || !account?.active) throw accessError('INVALID_LOGIN', 401);
 return { id:account.id, email, role:'visitor' };
}
