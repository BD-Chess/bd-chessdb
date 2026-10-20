import {createHash} from 'node:crypto';
import {tripActor,originOK} from './lib/andaluzija-access.mjs';
const KEY='andaluzija-2027',LIMIT=600000;
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
function envelope(e){
 const h=e?.header;
 return h?.format==='8ZShield'&&h.version===4&&h.kind==='sections'&&h.cipher==='AES-256-GCM'&&h.kdf==='PBKDF2-HMAC-SHA256'&&h.iterations>=600000&&h.iterations<=5000000&&
 typeof e.data==='string'&&e.data.length<500000&&Array.isArray(e.keys)&&e.keys.length>0&&e.keys.length<=8&&e.keys.every(k=>typeof k.salt==='string'&&k.salt.length===44&&typeof k.iv==='string'&&k.iv.length===16&&typeof k.data==='string'&&k.data.length===64)&&typeof e.iv==='string'&&e.iv.length===16;
}
export function namespace(context){
 // Site-scoped production document; previews get an entirely different store.
 const mode=context.deploy?.context;
 if(mode==='production')return 'andaluzija-2027-live-v1';
 const id=String(context.deploy?.id||'local').replace(/[^a-zA-Z0-9-]/g,'').slice(0,30)||'local';
 return 'andaluzija-2027-preview-'+id;
}
export function makeStateHandler({actor=tripActor,openStore}={}){
 return async(req,context={})=>{
  const json=(v,status=200,etag)=>Response.json(v,{status,headers:{...headers,...(etag?{ETag:etag}:{})}});
  if(context.site?.name&&context.site.name!=='mdlxdcc')return json({error:'SITE_UNAVAILABLE'},404);
  if(!originOK(req))return json({error:'ORIGIN_NOT_ALLOWED'},403);
  if(!['GET','PUT'].includes(req.method))return json({error:'METHOD_NOT_ALLOWED'},405);
  if(!actor(req))return json({error:'AUTH_REQUIRED'},401);
  if(req.method==='PUT'&&(req.headers.get('origin')!==new URL(req.url).origin||!req.headers.get('content-type')?.startsWith('application/json')))return json({error:'ORIGIN_OR_JSON_REQUIRED'},403);
  try{
   const store=await openStore(context);
   const current=await store.getWithMetadata(KEY,{type:'json',consistency:'strong'});
   const data=current?.data||{schema:'andaluzija-storage-v1',revision:0,snapshot:null,receipts:[],history:[]};
   const etag=current?.etag||'"0"';
   const view=(d,extra={})=>({schema:d.schema,revision:d.revision,snapshot:d.snapshot,updatedAt:d.updatedAt||null,receipts:d.receipts.map(x=>({requestId:x.requestId,revision:x.revision})),...extra});
   if(req.method==='GET')return json(view(data),200,etag);
   if(Number(req.headers.get('content-length')||0)>LIMIT)return json({error:'TOO_LARGE'},413);
   const raw=await req.text();if(Buffer.byteLength(raw)>LIMIT)return json({error:'TOO_LARGE'},413);
   let b;try{b=JSON.parse(raw);}catch{return json({error:'INVALID_JSON'},400);}
   if(!/^[a-zA-Z0-9_-]{8,100}$/.test(b.requestId||'')||!Number.isSafeInteger(b.baseRevision)||!envelope(b.snapshot))return json({error:'INVALID_STATE'},400);
   const digest=createHash('sha256').update(JSON.stringify({baseRevision:b.baseRevision,snapshot:b.snapshot})).digest('hex');
   const seen=data.receipts.find(r=>r.requestId===b.requestId);
   if(seen){
    if(seen.digest!==digest)return json({error:'REQUEST_ID_REUSED'},409);
    return json(view(data,{duplicate:true,acceptedRevision:seen.revision}),200,etag);
   }
   if(req.headers.get('if-match')!==etag||b.baseRevision!==data.revision)return json({error:'REVISION_CONFLICT',...view(data)},409,etag);
   const revision=data.revision+1,updatedAt=new Date().toISOString();
   const next={schema:'andaluzija-storage-v1',revision,snapshot:b.snapshot,updatedAt,
    receipts:[...data.receipts,{requestId:b.requestId,digest,revision}].slice(-32),
    history:[...(data.history||[]),...(data.snapshot?[{revision:data.revision,snapshot:data.snapshot}]:[])].slice(-3)};
   // Whole independent document replacement. No unguarded GET -> SET fallback.
   const result=await store.setJSON(KEY,next,current?{onlyIfMatch:etag}:{onlyIfNew:true});
   if(!result.modified){
    const fresh=await store.getWithMetadata(KEY,{type:'json',consistency:'strong'});
    return json({error:'REVISION_CONFLICT',...view(fresh?.data||data)},409,fresh?.etag||etag);
   }
   return json(view(next,{acceptedRevision:revision}),200,result.etag);
  }catch{return json({error:'STORAGE_UNAVAILABLE'},503);}
 };
}
export default makeStateHandler({openStore:async context=>{
 const {getStore}=await import('@netlify/blobs-andaluzija');
 return getStore({name:namespace(context),consistency:'strong'});
}});
export const config={rateLimit:{windowLimit:90,windowSize:60,aggregateBy:['ip','domain']}};

