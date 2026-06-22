// AIm³ MentalArena MALm v1.3.4 — stateless provider relay.
// Workflow, prompts, API keys, runs, and artifacts remain in the unlocked browser page.
const ALLOWED_HOSTS = new Set([
  'api.openai.com','api.anthropic.com','api.deepseek.com','generativelanguage.googleapis.com',
  'api.x.ai','api.z.ai','api.minimax.io','api.mistral.ai','api.moonshot.ai','ws-w0wh18jpdbeyf7d7.ap-southeast-1.maas.aliyuncs.com','dashscope-intl.aliyuncs.com'
]);
const SYNC_RELAY_BUDGET_MS = 55000;

function headers(origin='') {
  return {
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'access-control-allow-origin': origin || '*',
    'vary':'Origin',
    'access-control-allow-methods':'POST,OPTIONS',
    'access-control-allow-headers':'content-type'
  };
}
function reply(status,obj,origin=''){ return {statusCode:status,headers:headers(origin),body:JSON.stringify(obj)}; }
exports.handler = async (event) => {
  const origin = event.headers?.origin || '';
  if (event.httpMethod === 'OPTIONS') return {statusCode:204,headers:headers(origin),body:''};
  if (event.httpMethod !== 'POST') return reply(405,{ok:false,error:'POST required'},origin);
  let req;
  try { req = JSON.parse(event.body || '{}'); } catch { return reply(400,{ok:false,error:'Invalid JSON'},origin); }
  let u;
  try { u = new URL(String(req.url || '')); } catch { return reply(400,{ok:false,error:'Invalid provider URL'},origin); }
  if (u.protocol !== 'https:' || !ALLOWED_HOSTS.has(u.hostname)) return reply(403,{ok:false,error:'Provider hostname is not allowed'},origin);
  const method = String(req.method || 'POST').toUpperCase();
  if (!['GET','POST'].includes(method)) return reply(405,{ok:false,error:'Only GET and POST are allowed'},origin);
  // Netlify's synchronous function path has a finite wall-clock budget. Abort slightly
  // earlier so MALm receives a useful diagnosis instead of an opaque platform timeout.
  const requestedTimeoutMs = Math.max(30000, Number(req.timeout_ms || 1800000));
  const timeoutMs = Math.min(SYNC_RELAY_BUDGET_MS, requestedTimeoutMs);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(u.toString(), {
      method,
      headers: req.headers || {},
      body: method === 'GET' ? undefined : JSON.stringify(req.body ?? {}),
      signal: ctl.signal,
      redirect: 'error'
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = {raw:text}; }
    if (!r.ok) return reply(r.status,{ok:false,status:r.status,error:`Provider HTTP ${r.status}`,data},origin);
    return reply(200,{ok:true,status:r.status,data,transport:'netlify-sync-relay'},origin);
  } catch (e) {
    const msg = e?.name === 'AbortError'
      ? `Synchronous relay budget exceeded after ${timeoutMs} ms. MALm attempted direct browser transport first; inspect the reported direct error and retry the missing provider.`
      : String(e?.message || e);
    return reply(502,{ok:false,error:msg,requested_timeout_ms:requestedTimeoutMs,relay_budget_ms:timeoutMs},origin);
  } finally { clearTimeout(timer); }
};
