// AIm³ MentalArena MALm v1.3.1 — stateless provider relay.
// Workflow, prompts, API keys, runs, and artifacts remain in the unlocked browser page.
const ALLOWED_HOSTS = new Set([
  'api.openai.com','api.anthropic.com','api.deepseek.com','generativelanguage.googleapis.com',
  'api.x.ai','api.z.ai','api.minimax.io','api.mistral.ai','api.moonshot.ai','dashscope-intl.aliyuncs.com'
]);

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
  const timeoutMs = Math.max(30000, Math.min(14_400_000, Number(req.timeout_ms || 1_800_000)));
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
    return reply(200,{ok:true,status:r.status,data},origin);
  } catch (e) {
    const msg = e?.name === 'AbortError' ? `Provider relay timeout after ${timeoutMs} ms` : String(e?.message || e);
    return reply(502,{ok:false,error:msg},origin);
  } finally { clearTimeout(timer); }
};
