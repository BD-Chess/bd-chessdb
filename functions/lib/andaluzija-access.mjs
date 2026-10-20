import {createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
import {env,readSession,verifyOwner} from './mdlxdcc-guide/access.mjs';
const NAME='__Host-andaluzija-2027',TTL=8*3600;
const secret=()=>{const s=env('MDLXDCC_GUIDE_SESSION_SECRET');if(!s||s.length<48)throw Error('AUTH_UNAVAILABLE');return s;};
export function originOK(req){return req.headers.get('sec-fetch-site')!=='cross-site'&&(!req.headers.get('origin')||req.headers.get('origin')===new URL(req.url).origin);}
export function tripActor(req){
 const owner=readSession(req);if(owner?.role==='owner')return {id:'guide-owner',scope:'andaluzija-2027'};
 try{
  const value=req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(NAME+'='))?.slice(NAME.length+1);
  if(!value||value.length>1400)return null;const [p,s,x]=value.split('.');if(x||!s)return null;
  const hash=createHmac('sha256',secret()).update(p).digest(),sig=Buffer.from(s,'base64url');
  if(hash.length!==sig.length||!timingSafeEqual(hash,sig))return null;
  const a=JSON.parse(Buffer.from(p,'base64url'));
  if(a.scope!=='andaluzija-2027'||typeof a.id!=='string'||a.exp<=Date.now()/1000||a.exp>Date.now()/1000+TTL+5)return null;
  return {id:a.id,scope:a.scope};
 }catch{return null;}
}
export function tripCookie(now=Date.now()){
 const p=Buffer.from(JSON.stringify({scope:'andaluzija-2027',id:randomUUID(),exp:Math.floor(now/1000)+TTL})).toString('base64url');
 const s=createHmac('sha256',secret()).update(p).digest('base64url');
 return NAME+'='+p+'.'+s+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+TTL;
}
export const tripLogout=()=>NAME+'=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export function makeTripAuth({actor=tripActor,verify=verifyOwner,cookie=tripCookie}={}){
 return async(req,context={})=>{
  const json=(v,status=200,extra={})=>Response.json(v,{status,headers:{...headers,...extra}});
  if(context.site?.name&&context.site.name!=='mdlxdcc')return json({error:'SITE_UNAVAILABLE'},404);
  if(!originOK(req))return json({error:'ORIGIN_NOT_ALLOWED'},403);
  if(req.method==='GET')return json({authenticated:!!actor(req),scope:'andaluzija-2027'});
  if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
  if(req.headers.get('origin')!==new URL(req.url).origin||!req.headers.get('content-type')?.startsWith('application/json'))return json({error:'ORIGIN_OR_JSON_REQUIRED'},403);
  try{
   const raw=await req.text();if(raw.length>1200)return json({error:'INVALID_LOGIN'},400);
   const b=JSON.parse(raw);if(b.action==='logout')return json({authenticated:false},200,{'Set-Cookie':tripLogout()});
   if(b.action!=='login'||typeof b.password!=='string'||b.password.length>256)return json({error:'INVALID_LOGIN'},400);
   if(!await verify(b.password))return json({error:'INVALID_LOGIN'},401);
   return json({authenticated:true,scope:'andaluzija-2027'},200,{'Set-Cookie':cookie()});
  }catch{return json({error:'AUTH_UNAVAILABLE'},503);}
 };
}

