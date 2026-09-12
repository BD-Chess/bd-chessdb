import { RHP_ROSTER, EMAIL_RUNS, PROTOCOL } from './preai8-core.mjs';
import { readState, readRhp } from './preai8-store.mjs';
import { verifySession } from './wl-auth.mjs';
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, no-cache, must-revalidate','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}})}
async function snapshot(req){try{const u=new URL('/data/PREAI8_STATUS.json',req.url);const r=await fetch(u,{cache:'no-store'});return r.ok?await r.json():null}catch(_){return null}}
export default async req=>{
  if(req.method!=='GET')return json({ok:false,error:'method'},405);
  if(!verifySession(req.headers.get('authorization')))return json({ok:false,error:'unauthorized'},401);
  const [wake,rhp,email]=await Promise.all([readState(),readRhp(),snapshot(req)]);
  return json({ok:true,protocol:PROTOCOL,server_time:new Date().toISOString(),private:true,
    email_plane:{mode:'DYAD_ONLY',members:2,runs:EMAIL_RUNS,snapshot:email?.email_plane||null},
    rhp_plane:{mode:'RHP_11',members:RHP_ROSTER.length,roster:RHP_ROSTER,state:rhp.state,stream:rhp.stream},
    heartbeat:{cadence_minutes:5,paused:Boolean(wake.control?.paused),latest:wake.latest,history:wake.history.slice(-60)},
    wake_bridge:{configured:Boolean(Netlify.env.get('PREAI8_WAKE_URL')),guarantee:false},
    note:'Heartbeat is live infrastructure. RHP entries appear only when a verified executor writes them.'});
};
export const config={path:'/api/wl/data'};
