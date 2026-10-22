import { signIn, sessionCookie, logoutCookie, env } from './lib/mdlxdcc-guide/access.mjs';
import { authenticateOmni, loginDemo, demoCookie, clearDemoCookie, createDemo, runtime } from './lib/omnicpq/runtime.mjs';

const headers = { 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff', Vary: 'Cookie, Origin' };
function json(value, status = 200, cookies = []) {
  const h = new Headers(headers); for (const cookie of cookies) h.append('Set-Cookie', cookie);
  return Response.json(value, { status, headers: h });
}
export function makeAuth({ auth = authenticateOmni, ownerLogin = signIn, demoLogin = loginDemo, create = createDemo, rpc = runtime } = {}) {
  return async (req, context = {}) => {
    if (context.site?.name && context.site.name !== 'mdlxdcc') return json({ error: { code: 'SITE_UNAVAILABLE' } }, 404);
    if (!['GET', 'POST'].includes(req.method)) return json({ error: { code: 'METHOD_NOT_ALLOWED' } }, 405);
    if ((req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) || req.headers.get('sec-fetch-site') === 'cross-site') return json({ error: { code: 'ORIGIN_NOT_ALLOWED' } }, 403);
    try {
      if (req.method === 'GET') {
        let actor; try { actor = await auth(req, context); } catch (e) { if (e.code === 'AUTH_REQUIRED') return json({ authenticated: false }); throw e; }
        const privateStore = actor.role === 'owner' ? { provider: 'Supabase', url: env('MDLXDCC_GUIDE_DATABASE_URL'), status: await rpc('storage_status') } : undefined;
        return json({ authenticated: true, account: { id: actor.id, role: actor.role, email: actor.email }, usage: actor.usage || { exempt: true }, privateStore });
      }
      if (!req.headers.get('content-type')?.startsWith('application/json')) return json({ error: { code: 'INVALID_JSON' } }, 415);
      const raw = await req.text(); if (raw.length > 2500) return json({ error: { code: 'INVALID_LOGIN' } }, 400);
      let body; try { body = JSON.parse(raw); } catch { return json({ error: { code: 'INVALID_JSON' } }, 400); }
      if (body.action === 'logout') return json({ authenticated: false }, 200, [logoutCookie(), clearDemoCookie()]);
      if (['create_demo', 'revoke_demo', 'list_demos'].includes(body.action)) {
        const owner = await auth(req, context); if (owner.role !== 'owner') return json({ error: { code: 'OWNER_REQUIRED' } }, 403);
        if (body.action === 'create_demo') return json({ ok: true, ...await create() });
        if (body.action === 'list_demos') return json({ ok: true, grants: await rpc('list') });
        if (!/^[a-f0-9-]{36}$/i.test(body.id || '')) return json({ error: { code: 'INVALID_DEMO' } }, 400);
        return json({ ok: true, ...await rpc('revoke', { id: body.id }) });
      }
      if (body.action !== 'login') return json({ error: { code: 'INVALID_LOGIN' } }, 400);
      if (String(body.email || '').trim().toLowerCase() === env('OMNICPQ_DEMO_EMAIL')?.trim().toLowerCase()) {
        const actor = await demoLogin(body.email, body.password, body.token, context);
        return json({ authenticated: true, account: { id: actor.id, email: actor.email, role: 'demo' }, usage: actor.usage }, 200, [logoutCookie(), demoCookie(actor)]);
      }
      // Normal visitors cannot register or sign in through the private OmniCPQ endpoint.
      if (String(body.email || '').trim().toLowerCase() !== env('MDLXDCC_GUIDE_OWNER_EMAIL')?.trim().toLowerCase()) return json({ error: { code: 'INVALID_LOGIN' } }, 401);
      const actor = await ownerLogin('login', body.email, body.password);
      return json({ authenticated: true, account: { id: actor.id, email: actor.email, role: actor.role }, usage: { exempt: true } }, 200, [clearDemoCookie(), sessionCookie(actor)]);
    } catch (e) {
      const allowed = ['AUTH_REQUIRED','AUTH_UNAVAILABLE','INVALID_LOGIN','INVALID_EMAIL','STORAGE_UNAVAILABLE','DEMO_INVITATION_REQUIRED','DEMO_IP_UNAVAILABLE','DEMO_IP_CHANGED','DEMO_EXPIRED','DEMO_REVOKED','DEMO_LIMIT','RATE_LIMITED'];
      return json({ error: { code: allowed.includes(e.code) ? e.code : 'AUTH_UNAVAILABLE' } }, e.status >= 400 && e.status <= 503 ? e.status : 503);
    }
  };
}
export default makeAuth();
export const config = { rateLimit: { windowLimit: 12, windowSize: 60, aggregateBy: ['ip','domain'] } };
