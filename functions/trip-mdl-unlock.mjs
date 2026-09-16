import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {getStore} from '@netlify/blobs';

const TEMP_ACCESS_MS=30*24*60*60*1000;
const ACCESS_STORE='trip-mdl-access';
const TEMP_INVITE_ID='trip-mdl-temp-20260915-r1';
const OWNER_AUTH_TAG='dca4939357422d63d748abd63a81106b0bdbc8469feb15f972898ff6abb758b5';
const TEMP_AUTH_TAG='2440ee508fe3111a0e52daa65724c416846d7616dcb84bea48a041949ffb7842';

function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, no-cache, must-revalidate','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});}
function sha(text){return createHash('sha256').update(String(text),'utf8').digest('hex');}
function credential(master){return createHash('sha256').update(master+'||mdlxdcc.org||trip-mdl-v1','utf8').digest('base64');}
function authTag(master,kind,password){return createHmac('sha256',master).update(kind+'|'+password,'utf8').digest();}
function matches(master,kind,password,expectedHex){const expected=Buffer.from(expectedHex,'hex'),actual=authTag(master,kind,password);return expected.length===actual.length&&timingSafeEqual(actual,expected);}
function configState(){
  const master=Netlify.env.get('TRIP_MDL_MASTER');
  const tagsOk=/^[a-f0-9]{64}$/.test(OWNER_AUTH_TAG)&&/^[a-f0-9]{64}$/.test(TEMP_AUTH_TAG);
  return {master,configured:!!(master&&master.length>=43&&tagsOk)};
}

export default async function unlock(req){
  if(req.method==='GET'){
    const {configured}=configState();
    return json({schema:'TripUnlockHealthV1',configured,policy:'owner-permanent+temporary-30d-first-use'},configured?200:503);
  }
  if(req.method!=='POST')return json({error:'method'},405);
  const origin=req.headers.get('origin');if(!origin||origin!==new URL(req.url).origin)return json({error:'origin'},403);
  if(!req.headers.get('content-type')?.startsWith('application/json'))return json({error:'input'},400);
  try{
    const reader=req.body?.getReader();if(!reader)return json({error:'input'},400);let size=0,parts=[];
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();return json({error:'input'},413);}parts.push(value);}
    const body=JSON.parse(Buffer.concat(parts).toString('utf8'));
    if(body.schema!=='TripUnlockV1'||typeof body.password!=='string'||!body.password.length||body.password.length>1024)return json({error:'input'},400);

    const {master,configured}=configState();
    if(!configured)return json({error:'unavailable'},503);

    let accessClass=null,temporaryExpiresAt=null;
    if(matches(master,'owner',body.password,OWNER_AUTH_TAG)){
      accessClass='owner';
    }else if(matches(master,'temp',body.password,TEMP_AUTH_TAG)){
      const now=Date.now();
      const store=getStore(ACCESS_STORE,{consistency:'strong'});
      const key='temp/'+sha(origin+'|'+TEMP_INVITE_ID);
      let state=await store.get(key,{type:'json'});
      if(!state){
        state={schema:'TripTempAccessV1',inviteIdHash:sha(TEMP_INVITE_ID),originHash:sha(origin),activatedAt:new Date(now).toISOString(),expiresAt:new Date(now+TEMP_ACCESS_MS).toISOString()};
        await store.setJSON(key,state);
        state=await store.get(key,{type:'json'});
      }
      const expires=Date.parse(state?.expiresAt||'');
      if(state?.schema!=='TripTempAccessV1'||state?.inviteIdHash!==sha(TEMP_INVITE_ID)||state?.originHash!==sha(origin)||!Number.isFinite(expires)||expires<=now)return json({error:'temporary_expired'},401);
      accessClass='temporary';temporaryExpiresAt=state.expiresAt;
    }else{
      body.password='';return json({error:'unlock'},401);
    }
    body.password='';
    return json({schema:'TripUnlockV1',engine:'bd-trip-browser-r1.1.0',credential:credential(master),accessClass,temporaryExpiresAt});
  }catch(_){return json({error:'unlock'},400);}
}
export const config={path:'/api/trip-mdl-unlock',rateLimit:{windowLimit:8,windowSize:60,aggregateBy:['ip','domain']}};
