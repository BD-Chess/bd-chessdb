import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
const STORAGE='bd-dualframe-api-session-v3',CANONICAL='https://www.mdlxdcc.org';
const expires=new Date(Date.now()+86400000).toISOString();
const accountA={token:'synthetic-token-A01',expires_at:expires,owner:'account_owner_A01',auth_method:'verified-account'};
const accountB={token:'synthetic-token-B02',expires_at:expires,owner:'account_owner_B02',auth_method:'verified-account'};
function environment(cached=accountA){
 const keys=['location','localStorage','document','fetch','open','addEventListener','removeEventListener'],old=Object.fromEntries(keys.map(key=>[key,globalThis[key]])),memory=new Map(),events=new EventTarget(),doc=new EventTarget();
 let opened=null,popup=null;
 if(cached)memory.set(STORAGE,JSON.stringify(cached));
 Object.assign(globalThis,{location:{hostname:'bd-chess.github.io',origin:'https://bd-chess.github.io'},localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)},document:doc,addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),open:url=>{opened=new URL(url);popup={closed:false,close(){this.closed=true;}};return popup;}});
 doc.getElementById=()=>null;
 const dispatch=(data,{origin=CANONICAL,source=popup}={})=>events.dispatchEvent(Object.assign(new Event('message'),{origin,source,data}));
 return {memory,doc,get opened(){return opened;},get popup(){return popup;},dispatch,
  post(session,options={}){dispatch({type:'dualframe-account-session',nonce:opened.searchParams.get('nonce'),session},options);},
  restore(){for(const [key,value]of Object.entries(old)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
 };
}
const load=()=>import('../public/Nara/dualframe-lab/api-client.mjs?client-test='+randomUUID());
function sessionFetch(url,options){
 assert.ok(url.endsWith('/session'));
 const value=options.headers.authorization==='Bearer '+accountA.token?accountA:options.headers.authorization==='Bearer '+accountB.token?accountB:null;
 return value?Response.json({ok:true,owner:value.owner,auth_method:value.auth_method,expires_at:value.expires_at}):Response.json({error:'UNAUTHORIZED'},{status:401});
}
async function switchAccount(api,e,value=accountB){const pending=api.signInAccount('sl');e.post(value);return pending;}

test('old cached tokens acquire server-resolved owner/method while keeping expiration',async()=>{
 const e=environment({token:accountA.token,expires_at:expires});let checks=0;
 try{
  globalThis.fetch=async(url,options)=>{checks++;return sessionFetch(url,options);};
  const api=await load();assert.equal(api.sessionOwner(),null);assert.equal(api.sessionMethod(),null);
  await api.validateSession();assert.equal(checks,1);assert.equal(api.sessionOwner(),accountA.owner);assert.equal(api.sessionMethod(),'verified-account');assert.equal(api.sessionExpiry(),expires);
  const stored=JSON.parse(e.memory.get(STORAGE));assert.equal(stored.owner,accountA.owner);assert.equal(stored.expires_at,expires);
 }finally{e.restore();}
});

test('old 401 cannot lock a newer account and all old in-flight controllers abort',async()=>{
 const e=environment();let finishOld,oldSignal,verified=false,changes=0;
 try{
  globalThis.fetch=async(url,options)=>{
   if(url.endsWith('/slow')){oldSignal=options.signal;return new Promise(resolve=>{finishOld=resolve;});}
   const response=sessionFetch(url,options);if(options.headers.authorization==='Bearer '+accountB.token)verified=true;return response;
  };
  const api=await load();await api.validateSession();
  e.doc.addEventListener('df-auth-change',event=>{changes++;assert.equal(verified,true);assert.equal(event.detail.new_owner,accountB.owner);});
  const captured=api.captureAPI(),old=captured.request('/slow');
  const rejected=assert.rejects(old,/AUTH_SESSION_CHANGED/);
  await switchAccount(api,e);assert.equal(oldSignal.aborted,true);
  finishOld(Response.json({error:'UNAUTHORIZED'},{status:401}));await rejected;
  assert.equal(api.sessionOwner(),accountB.owner);assert.equal(api.apiUnlocked(),true);assert.equal(changes,1);
  await assert.rejects(captured.request('/jobs/no-network'),/AUTH_SESSION_CHANGED/);
 }finally{e.restore();}
});

test('captured Sync download stops before another range or checkpoint after lock',async()=>{
 const e=environment(),bytes=new Uint8Array(2097153).fill(12),digest=createHash('sha256').update(bytes).digest('hex');let transfers=0,checkpoints=0;
 try{
  globalThis.fetch=async(url,options)=>{
   if(url.endsWith('/session'))return sessionFetch(url,options);
   transfers++;assert.equal(options.headers.authorization,'Bearer '+accountA.token);
   const start=0,end=2097151;return new Response(bytes.slice(start,end+1),{status:206,headers:{'content-range':`bytes ${start}-${end}/${bytes.length}`,'content-type':'image/png'}});
  };
  const api=await load();await api.validateSession();const scoped=api.captureAPI();
  await assert.rejects(scoped.syncTransport.downloadAsset({asset_id:'fixture_asset_01',sha256:digest,byte_size:bytes.length},{onCheckpoint:async()=>{checkpoints++;api.lockAPI();}}),/AUTH_SESSION_CHANGED/);
  assert.equal(transfers,1);assert.equal(checkpoints,1);
 }finally{e.restore();}
});

test('captured upload and job polling cannot continue in a changed session',async()=>{
 const e=environment();let inits=0,chunks=0,polls=0;
 try{
  globalThis.fetch=async(url,options)=>{
   if(url.endsWith('/session'))return sessionFetch(url,options);
   if(url.endsWith('/uploads/init')){inits++;return Response.json({upload_id:'fixture_upload_01',chunk_size:2,chunks:2});}
   if(url.includes('/jobs/')){polls++;return Response.json({status:'PENDING'});}
   chunks++;return Response.json({ok:true});
  };
  const api=await load();await api.validateSession();
  await assert.rejects(api.captureAPI().syncTransport.uploadAsset(new Blob(['abcd']),{onCheckpoint:async()=>api.lockAPI()}),/AUTH_SESSION_CHANGED/);
  assert.equal(inits,1);assert.equal(chunks,0);
  await switchAccount(api,e);
  await assert.rejects(api.captureAPI().awaitJob('job_fixture_01',{onState:()=>api.lockAPI()}),/AUTH_SESSION_CHANGED/);
  assert.equal(polls,1);
 }finally{e.restore();}
});

test('popup requires canonical origin, exact source/nonce and server-confirmed account',async()=>{
 const e=environment();let validations=0;
 try{
  globalThis.fetch=async(url,options)=>{validations++;return sessionFetch(url,options);};
  const api=await load();await api.validateSession();const pending=api.signInAccount('sl'),url=e.opened;
  assert.equal(url.origin,CANONICAL);assert.equal(url.searchParams.get('opener_origin'),'https://bd-chess.github.io');assert.equal(url.searchParams.get('lang'),'sl');assert.ok(!url.href.includes(accountB.token));
  e.post(accountB,{origin:'https://attacker.example'});e.post(accountB,{source:{}});
  e.dispatch({type:'dualframe-account-session',nonce:'wrong-nonce',session:accountB});
  e.post({...accountB,expires_at:'2000-01-01T00:00:00.000Z'});assert.equal(validations,1);
  e.post(accountB);await pending;assert.equal(validations,2);assert.equal(api.sessionOwner(),accountB.owner);
 }finally{e.restore();}
});

test('a forged popup owner or failed candidate session never replaces the current account',async()=>{
 const e=environment();let changes=0;
 try{
  globalThis.fetch=async(url,options)=>sessionFetch(url,options);
  const api=await load();await api.validateSession();e.doc.addEventListener('df-auth-change',()=>changes++);
  const forged=api.signInAccount();const rejection=assert.rejects(forged,/AUTH_SESSION_INVALID/);e.post({...accountB,owner:'guessed_owner_01'});await rejection;
  assert.equal(api.sessionOwner(),accountA.owner);assert.equal(changes,0);
  const invalid=api.signInAccount();const unauthorized=assert.rejects(invalid,error=>error.status===401);e.post({...accountB,token:'invalid-candidate-token'});await unauthorized;
  assert.equal(api.sessionOwner(),accountA.owner);assert.equal(api.apiUnlocked(),true);
 }finally{e.restore();}
});

test('current-session 401 locks that session and explicit lock cancels pending popup',async()=>{
 const e=environment();
 try{
  globalThis.fetch=async(url,options)=>url.endsWith('/session')?sessionFetch(url,options):Response.json({error:'UNAUTHORIZED'},{status:401});
  const api=await load();await api.validateSession();await assert.rejects(api.request('/forbidden'),error=>error.status===401);assert.equal(api.apiUnlocked(),false);
  const popup=api.signInAccount();const rejection=assert.rejects(popup,/AUTH_SESSION_CHANGED/);api.lockAPI();await rejection;assert.equal(e.popup.closed,true);
 }finally{e.restore();}
});

test('cached owner permits offline disk selection but cannot validate cloud authority',async()=>{
 const e=environment();let validations=0,otherCalls=0,changes=0;
 try{
  globalThis.fetch=async(url)=>{if(url.endsWith('/session'))validations++;else otherCalls++;throw TypeError('offline');};
  const api=await load();e.doc.addEventListener('df-auth-change',()=>changes++);
  assert.equal(api.cachedSessionOwner(),accountA.owner);assert.equal(api.sessionOwner(),null);assert.equal(api.sessionMethod(),null);
  await assert.rejects(api.validateSession(),/offline/);
  assert.equal(api.cachedSessionOwner(),accountA.owner);assert.equal(api.sessionOwner(),null);assert.equal(changes,0);
  await assert.rejects(api.ensureAuth(),/offline/);assert.equal(validations,2);assert.equal(otherCalls,0);
  const beforeValidation=api.captureAPI();globalThis.fetch=async(url,options)=>sessionFetch(url,options);
  await api.validateSession();assert.equal(api.sessionOwner(),accountA.owner);assert.equal(changes,1);
  await assert.rejects(beforeValidation.request('/must-not-send'),/AUTH_SESSION_CHANGED/);
  api.lockAPI();assert.equal(api.cachedSessionOwner(),null);
 }finally{e.restore();}
 const expired=environment({...accountA,expires_at:'2000-01-01T00:00:00.000Z'});
 try{const api=await load();assert.equal(api.cachedSessionOwner(),null);assert.equal(api.sessionOwner(),null);}finally{expired.restore();}
});

test('pause after first upload chunk resumes its ticket without duplicate bytes',async()=>{
 const e=environment(),blob=new Blob(['abcd']),digest=createHash('sha256').update('abcd').digest('hex'),received=new Set(),chunks=[];let checkpoint=null,tickets=0,statusChecks=0;
 try{
  globalThis.fetch=async(url,options)=>{
   if(url.endsWith('/session'))return sessionFetch(url,options);
   if(url.endsWith('/uploads/init')){tickets++;return Response.json({upload_id:'resume_upload_01',chunk_size:2,chunks:2});}
   if(url.endsWith('/uploads/resume_upload_01')){statusChecks++;return Response.json({complete:false,received:[...received]});}
   if(url.endsWith('/finish'))return Response.json({asset_id:'resume_upload_01',sha256:digest,byte_size:4});
   const index=Number(url.split('/').pop());assert.equal(options.method,'PUT');assert.equal(received.has(index),false);assert.equal(await options.raw?.text?.(),undefined);assert.equal(await options.body.text(),index===0?'ab':'cd');received.add(index);chunks.push(index);return Response.json({ok:true});
  };
  const api=await load();await api.validateSession();const transport=api.captureAPI().syncTransport,paused=new AbortController();
  await assert.rejects(transport.uploadAsset(blob,{signal:paused.signal,onCheckpoint:async value=>{checkpoint=value;if(value.next_chunk===1)paused.abort();}}),/SYNC_INTERRUPTED/);
  assert.equal(checkpoint.next_chunk,1);assert.deepEqual(chunks,[0]);
  const result=await transport.uploadAsset(blob,{signal:new AbortController().signal,checkpoint,onCheckpoint:async value=>{checkpoint=value;}});
  assert.equal(result.sha256,digest);assert.equal(tickets,1);assert.equal(statusChecks,1);assert.deepEqual(chunks,[0,1]);
 }finally{e.restore();}
});
