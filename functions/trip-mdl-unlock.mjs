import {scrypt,createHash,timingSafeEqual} from 'node:crypto';

function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, no-cache, must-revalidate','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});}
function limiter(){return limiter.state??=(new Map());}
function allowed(ip){const now=Date.now(),map=limiter();for(const [key,row]of map)if(row.until<now)map.delete(key);if(map.size>=10000&&!map.has(ip))return false;const row=map.get(ip)||{n:0,until:now+900000};map.set(ip,row);return ++row.n<=8;}
function derive(password,salt){return new Promise((resolve,reject)=>scrypt(password,salt,32,{N:131072,r:8,p:1,maxmem:256*1024*1024},(error,key)=>error?reject(error):resolve(key)));}
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
    const master=Netlify.env.get('TRIP_MDL_MASTER'),record=Netlify.env.get('TRIP_MDL_PASSWORD_SCRYPT');
    if(!master||master.length<43||!record)return json({error:'unavailable'},503);
    const [saltHex,expectedHex]=record.split(':');if(!/^[a-f0-9]{64}$/.test(saltHex||'')||!/^[a-f0-9]{64}$/.test(expectedHex||''))return json({error:'unavailable'},503);
    const actual=await derive(body.password,Buffer.from(saltHex,'hex'));body.password='';
    if(!timingSafeEqual(actual,Buffer.from(expectedHex,'hex')))return json({error:'unlock'},401);
    const credential=createHash('sha256').update(master+'||mdlxdcc.org||trip-mdl-v1','utf8').digest('base64');
    return json({schema:'TripUnlockV1',engine:'bd-trip-browser-r1.1.0',credential});
  }catch(_){return json({error:'unlock'},400);}
}
export const config={path:'/api/trip-mdl-unlock',method:'POST',rateLimit:{windowLimit:8,windowSize:60,aggregateBy:['ip','domain']}};
