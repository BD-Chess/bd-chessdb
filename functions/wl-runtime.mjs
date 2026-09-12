import { createHash, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';
const EXPECTED='8baf53eb091d07fa106c506e5a4b6de02ffda109f284d13ccab87c12f2466a32';
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, no-cache, must-revalidate','Pragma':'no-cache','X-Robots-Tag':'noindex, nofollow, noarchive','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const answer=(x,status=200)=>new Response(JSON.stringify(x),{status,headers});
function authorized(req){const v=req.headers.get('x-wl-control')||'';return v.length>=32&&v.length<=100&&timingSafeEqual(createHash('sha256').update(v).digest(),Buffer.from(EXPECTED,'hex'))}
export default async req=>{
 const s=getStore({name:'wl-runtime-control-v2',consistency:'strong'});
 try{
  if(req.method==='GET'){
   const c=await s.get('control',{type:'json'});const pulse=await s.get('pulse',{type:'json'});
   return answer({ok:true,protocol:'WL-RUNTIME-2',paused:c?.paused===true,server_time:new Date().toISOString(),control_updated_at:c?.updated_at||null,last_pulse_at:pulse?.at||null});
  }
  if(req.method!=='POST')return answer({ok:false,error:'method'},405);
  if(!authorized(req))return answer({ok:false,error:'unauthorized'},401);
  const raw=await req.text();if(raw.length>2000)return answer({ok:false,error:'size'},413);
  let body;try{body=JSON.parse(raw)}catch{return answer({ok:false,error:'json'},400)}
  if(!['pause','resume','pulse'].includes(body.action))return answer({ok:false,error:'action'},400);
  const at=new Date().toISOString();
  if(body.action==='pulse'){await s.setJSON('pulse',{at,source:'owner',wake_claimed:false});return answer({ok:true,wake_claimed:false,at})}
  const control={paused:body.action==='pause',updated_at:at};await s.setJSON('control',control);
  const verified=await s.get('control',{type:'json'});if(verified?.updated_at!==at||verified?.paused!==control.paused)throw Error('readback');
  return answer({ok:true,control});
 }catch{return answer({ok:false,error:'storage_unavailable'},503)}
};
export const config={path:'/api/wl/runtime',rateLimit:{windowLimit:60,windowSize:60,aggregateBy:['ip','domain']}};
