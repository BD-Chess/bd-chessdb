import { authorized } from './preai8-core.mjs';
import { requestPasswordOK } from './wl-auth.mjs';
import { appendRhp } from './preai8-store.mjs';

function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}})}
function cleanText(value,max=12000){const s=String(value||'').trim();return s&&s.length<=max?s:null}

export default async req=>{
  if(req.method!=='POST')return json({ok:false,error:'method'},405);
  const serviceOK=authorized(req.headers.get('authorization'),Netlify.env.get('PREAI8_OWNER_TOKEN'));
  if(!serviceOK&&!requestPasswordOK(req))return json({ok:false,error:'unauthorized'},401);
  let body;try{body=await req.json()}catch(_){return json({ok:false,error:'json'},400)}
  const e=body?.entry||{};
  const id=cleanText(e.id,180), agent=cleanText(e.agent,120), text=cleanText(e.text), kind=cleanText(e.kind,80)||'agent';
  const round=Number(e.round);
  if(!id||!agent||!text||!Number.isInteger(round)||round<0)return json({ok:false,error:'entry'},400);
  const entry={id,round,agent,kind,text,created_at:new Date().toISOString(),evidence:e.evidence||null};
  const state=body?.state&&typeof body.state==='object'?{...body.state,updated_at:new Date().toISOString()}:null;
  const receipt=await appendRhp(entry,state);
  return json({ok:true,receipt});
};
export const config={path:'/api/wl/ingest'};
