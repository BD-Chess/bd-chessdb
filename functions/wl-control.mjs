import { normalizeAction, normalizeSource, PROTOCOL, slot5m } from './preai8-core.mjs';
import { readState, recordPulse, setPaused } from './preai8-store.mjs';
import { verifySession } from './wl-auth.mjs';
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, no-cache, must-revalidate','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}})}
export default async req=>{
  if(req.method!=='POST')return json({ok:false,error:'method'},405);
  if(!verifySession(req.headers.get('authorization')))return json({ok:false,error:'unauthorized'},401);
  let body;try{body=await req.json()}catch(_){return json({ok:false,error:'json'},400)}
  const action=normalizeAction(body?.action);if(!action)return json({ok:false,error:'action'},400);
  if(action==='pause'||action==='resume'){const control=await setPaused(action==='pause','WL');return json({ok:true,action,control});}
  const state=await readState();if(state.control?.paused)return json({ok:false,error:'paused'},409);
  const source=normalizeSource(body?.source,'manual');if(!source)return json({ok:false,error:'source'},400);
  const now=new Date();
  const event={protocol:PROTOCOL,event:'pulse',source,target:'RHP_11',slot_utc:slot5m(now),emitted_at:now.toISOString(),wake_bridge_configured:Boolean(Netlify.env.get('PREAI8_WAKE_URL')),wake_claimed:false};
  const receipt=await recordPulse(event);
  return json({ok:true,event,receipt,note:'Pulse recorded. No model wake is claimed.'});
};
export const config={path:'/api/wl/control'};
