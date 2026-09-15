import {scrypt,createHash,timingSafeEqual} from 'node:crypto';
import {getStore} from '@netlify/blobs';

const TEMP_ACCESS_MS=30*24*60*60*1000;
const ACCESS_STORE='trip-mdl-access';

function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, no-cache, must-revalidate','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});}
function limiter(){return limiter.state??=(new Map());}
function allowed(ip){const now=Date.now(),map=limiter();for(const [key,row]of map)if(row.until<now)map.delete(key);if(map.size>=10000&&!map.has(ip))return false;const row=map.get(ip)||{n:0,until:now+900000};map.set(ip,row);return ++row.n<=8;}
function derive(password,salt){return new Promise((resolve,reject)=>scrypt(password,salt,32,{N:131072,r:8,p:1,maxmem:256*1024*1024},(error,key)=>error?reject(error):resolve(key)));}
function parseRecord(record){const [saltHex,expectedHex]=String(record||'').split(':');if(!/^[a-f0-9]{64}$/.test(saltHex||'')||!/^[a-f0-9]{64}$/.test(expectedHex||''))return null;return {salt:Buffer.from(saltHex,'hex'),expected:Buffer.from(expectedHex,'hex')};}
async function matches(password,record){const parsed=parseRecord(record);if(!parsed)return false;const actual=await derive(password,parsed.salt);return timingSafeEqual(actual,parsed.expected);}
function sha(text){return createHash('sha256').update(String(text),'utf8').digest('hex');}
function credential(master){return createHash('sha256').update(master+'||mdlxdcc.org||trip-mdl-v1','utf8').digest('base64');}

export default async function unlock(req,context){
  if(req.method!=='POST')return json({error:'method'},405);
  const origin=req.headers.get('origin');if(!origin||origin!==new URL(req.url).origin)return json({error:'origin'},403);
  if(!allowed(String(context?.ip||'unknown')))return json({error:'rate'},429);
  if(!req.headers.get('content-type')?.startsWith('application/json'))return json({error:'input'},400);
  try{
    const reader=req.body?.getReader();if(!reader)return json({error:'input'},400);let size=0,parts=[];
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();return json({error:'input'},413);}parts.push(value);}
    const body=JSON.parse(Buffer.concat(parts).toString('utf8'));
    if(body.schema!=='TripUnlockV1'||typeof body.password!=='string'||!body.password.length||body.password.length>1024)return json({error:'input'},400);

    const master=Netlify.env.get('TRIP_MDL_MASTER');
    const ownerRecord=Netlify.env.get('TRIP_MDL_OWNER_PASSWORD_SCRYPT');
    const tempRecord=Netlify.env.get('TRIP_MDL_TEMP_PASSWORD_SCRYPT');
    const tempInviteId=Netlify.env.get('TRIP_MDL_TEMP_INVITE_ID');
    if(!master||master.length<43||!parseRecord(ownerRecord))return json({error:'unavailable'},503);

    let accessClass=null,temporaryExpiresAt=null;
    if(await matches(body.password,ownerRecord)){
      accessClass='owner';
    }else if(parseRecord(tempRecord)&&tempInviteId&&await matches(body.password,tempRecord)){
      const now=Date.now();
      const store=getStore(ACCESS_STORE,{consistency:'strong'});
      const key='temp/'+sha(origin+'|'+tempInviteId);
      let state=await store.get(key,{type:'json'});
      if(!state){
        state={schema:'TripTempAccessV1',inviteIdHash:sha(tempInviteId),originHash:sha(origin),activatedAt:new Date(now).toISOString(),expiresAt:new Date(now+TEMP_ACCESS_MS).toISOString()};
        await store.setJSON(key,state);
        state=await store.get(key,{type:'json'});
      }
      const expires=Date.parse(state?.expiresAt||'');
      if(state?.schema!=='TripTempAccessV1'||state?.inviteIdHash!==sha(tempInviteId)||state?.originHash!==sha(origin)||!Number.isFinite(expires)||expires<=now)return json({error:'temporary_expired'},401);
      accessClass='temporary';temporaryExpiresAt=state.expiresAt;
    }else{
      body.password='';return json({error:'unlock'},401);
    }
    body.password='';
    return json({schema:'TripUnlockV1',engine:'bd-trip-browser-r1.1.0',credential:credential(master),accessClass,temporaryExpiresAt});
  }catch(_){return json({error:'unlock'},400);}
}
export const config={path:'/api/trip-mdl-unlock',method:'POST',rateLimit:{windowLimit:8,windowSize:60,aggregateBy:['ip','domain']}};
