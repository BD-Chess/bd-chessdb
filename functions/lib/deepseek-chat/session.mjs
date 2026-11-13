import { createHmac, timingSafeEqual } from 'node:crypto';

export const origin = 'https://www.mdlxdcc.org';
export const cookieName = '__Host-mdlxdcc-deepseek';
export const sessionLifetime = 8 * 60 * 60;
const scope = 'mdlxdcc-deepseek-chat.v1';
const cookieAttributes = 'Path=/; Secure; HttpOnly; SameSite=Strict';

function signature(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest();
}

export function makeSession(account, secret, now) {
  const iat = Math.floor(now / 1000);
  const value = Buffer.from(JSON.stringify({
    aud: scope, sub: account, iat, exp: iat + sessionLifetime,
  })).toString('base64url');
  return [value, signature(value, secret).toString('base64url')].join('.');
}

export function sessionCookie(token) {
  return cookieName + '=' + token + '; ' + cookieAttributes + '; Max-Age=' + sessionLifetime;
}

export function logoutCookie() {
  return cookieName + '=; ' + cookieAttributes + '; Max-Age=0';
}

export function validSession(req, account, secret, now) {
  const raw = req.headers.get('cookie')?.split(';').map(part => part.trim());
  const cookies = raw?.filter(part => part.startsWith(cookieName + '='));
  if (cookies?.length !== 1) return false;
  const token = cookies[0].slice(cookieName.length + 1);
  if (!/^[A-Za-z0-9_-]{1,650}\.[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const [payload, encoded] = token.split('.');
  const supplied = Buffer.from(encoded, 'base64url');
  if (supplied.length !== 32 || supplied.toString('base64url') !== encoded ||
      !timingSafeEqual(signature(payload, secret), supplied)) return false;
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const current = Math.floor(now / 1000);
    return value.aud === scope && value.sub === account && Number.isInteger(value.iat) &&
      value.iat <= current && value.exp === value.iat + sessionLifetime && value.exp > current;
  } catch {
    return false;
  }
}
