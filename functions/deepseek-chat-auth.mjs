import { emailAddress, env, passwordMatches } from './lib/mdlxdcc-guide/access.mjs';
import {
  origin, makeSession, sessionCookie, logoutCookie, validSession,
} from './lib/deepseek-chat/session.mjs';

const headers = {
  'Cache-Control': 'no-store, private',
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Referrer-Policy': 'no-referrer',
  Vary: 'Cookie, Origin',
};
const maxLoginBytes = 2048;

function json(value, status = 200, extra = {}) {
  return Response.json(value, { status, headers: { ...headers, ...extra } });
}

async function readAction(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type') ?? '') ||
      !req.body || Number(req.headers.get('content-length')) > maxLoginBytes) return null;
  const reader = req.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxLoginBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export function makeAuthHandler({ getEnv = env, checkPassword = passwordMatches, now = Date.now,
  allowedOrigin = origin } = {}) {
  return async (req, context = {}) => {
    if ((context.site?.name && context.site.name !== 'mdlxdcc') ||
        new URL(req.url).origin !== allowedOrigin) return json({ error: 'NOT_FOUND' }, 404);

    const requestOrigin = req.headers.get('origin');
    if ((requestOrigin !== null && requestOrigin !== allowedOrigin) ||
        req.headers.get('sec-fetch-site') === 'cross-site') return json({ error: 'ORIGIN_FORBIDDEN' }, 403);
    if (!['GET', 'POST'].includes(req.method)) {
      return json({ error: 'METHOD_NOT_ALLOWED' }, 405, { Allow: 'GET, POST' });
    }
    if (req.method === 'POST' && requestOrigin !== allowedOrigin) {
      return json({ error: 'ORIGIN_FORBIDDEN' }, 403);
    }

    try {
      const account = emailAddress(getEnv('DEEPSEEK_CHAT_OWNER_EMAIL'));
      const hash = getEnv('DEEPSEEK_CHAT_PASSWORD_HASH');
      const secret = getEnv('DEEPSEEK_CHAT_SESSION_SECRET');
      if (!/^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(hash ?? '') ||
          !/^[A-Za-z0-9_-]{43,128}$/.test(secret ?? '')) {
        return json({ error: 'AUTH_UNAVAILABLE' }, 503);
      }

      if (req.method === 'GET') {
        if (!validSession(req, account, secret, now())) return json({ authenticated: false });
        return json({ authenticated: true, email: account, connection: 'pending' });
      }

      const body = await readAction(req);
      if (body?.action === 'logout') {
        return json({ authenticated: false }, 200, { 'Set-Cookie': logoutCookie() });
      }
      if (body?.action !== 'login' || typeof body.email !== 'string' || body.email.length > 254 ||
          typeof body.password !== 'string' || !body.password || body.password.length > 256) {
        return json({ error: 'INVALID_LOGIN' }, 400);
      }
      const passwordOk = await checkPassword(body.password, hash);
      if (!passwordOk || body.email.trim().toLowerCase() !== account) {
        return json({ error: 'INVALID_LOGIN' }, 401);
      }
      return json({ authenticated: true, email: account, connection: 'pending' },
        200, { 'Set-Cookie': sessionCookie(makeSession(account, secret, now())) });
    } catch {
      return json({ error: 'AUTH_UNAVAILABLE' }, 503);
    }
  };
}

export default makeAuthHandler();

export const config = {
  path: '/deepseek-chat/api/session',
  rateLimit: { action: 'rate_limit', aggregateBy: 'ip', windowSize: 60, windowLimit: 12 },
};
