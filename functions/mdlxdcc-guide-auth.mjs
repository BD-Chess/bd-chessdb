import { authenticate, signIn, sessionCookie, logoutCookie } from './lib/mdlxdcc-guide/access.mjs';
import { usageFor } from './lib/mdlxdcc-guide/cost.mjs';
const headers = { 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' };
const json = (value, status = 200, extra = {}) => Response.json(value, { status, headers:{ ...headers, ...extra } });
export function makeAuthHandler({ auth = authenticate, login = signIn, usage = usageFor } = {}) {
 return async (req, context = {}) => {
  if (context.site?.name && context.site.name !== 'mdlxdcc') return json({ error:{ code:'SITE_UNAVAILABLE' } },404);
  if (!['GET','POST'].includes(req.method)) return json({ error:{ code:'METHOD_NOT_ALLOWED' } },405);
  if ((req.headers.get('origin') && req.headers.get('origin') !== new URL(req.url).origin) || req.headers.get('sec-fetch-site') === 'cross-site') return json({ error:{ code:'ORIGIN_NOT_ALLOWED' } },403);
  try {
   if (req.method === 'GET') {
    let actor; try { actor = await auth(req); } catch(e) { if (e.code === 'AUTH_REQUIRED') return json({ authenticated:false }); throw e; }
    return json({ authenticated:true, account:{ email:actor.email, role:actor.role }, usage:await usage(actor) });
   }
   if (!req.headers.get('content-type')?.startsWith('application/json')) return json({ error:{code:'INVALID_JSON'} },415);
   const raw = await req.text(); if (raw.length > 2000) return json({error:{code:'INVALID_LOGIN'}},400);
   let body; try { body=JSON.parse(raw); } catch { return json({error:{code:'INVALID_LOGIN'}},400); }
   if (body.action === 'logout') return json({ authenticated:false },200,{'Set-Cookie':logoutCookie()});
   const actor = await login(body.action, body.email, body.password);
   return json({ authenticated:true, account:{ email:actor.email, role:actor.role }, usage:await usage(actor) },200,{'Set-Cookie':sessionCookie(actor)});
  } catch(e) {
   const code = ['INVALID_EMAIL','INVALID_PASSWORD','INVALID_LOGIN','ACCOUNT_EXISTS','AUTH_REQUIRED','STORAGE_UNAVAILABLE','AUTH_UNAVAILABLE'].includes(e.code) ? e.code : 'AUTH_UNAVAILABLE';
   return json({ error:{ code } },e.status >= 400 && e.status <= 503 ? e.status : 503);
  }
 };
}
export default makeAuthHandler();
export const config = { rateLimit:{windowLimit:12, windowSize:60, aggregateBy:['ip','domain']} };
