import {sha256} from './core.mjs?v=3.0-r4.11';
export const API_BASE=/^(www\.)?mdlxdcc\.org$/.test(location.hostname)||/netlify\.app$/.test(location.hostname)||['localhost','127.0.0.1'].includes(location.hostname)?location.origin:'https://www.mdlxdcc.org';
const STORAGE='bd-dualframe-api-session-v3',ACCOUNT_ORIGIN='https://www.mdlxdcc.org';
const OWNER=/^[a-zA-Z0-9_-]{8,100}$/;
let session=null,authPromise=null,accountPromise=null,validationPromise=null,validated=false,epoch=0,epochController=new AbortController();
const uploads=new Map(),requests=new Set(),authCancellations=new Set();
function normalizeSession(value,{legacy=false}={}){
 if(!value||typeof value!=='object'||typeof value.token!=='string'||!/^[-a-zA-Z0-9_.]{8,2500}$/.test(value.token)||typeof value.expires_at!=='string'||!Number.isFinite(Date.parse(value.expires_at))||Date.parse(value.expires_at)<=Date.now())throw Error('AUTH_SESSION_INVALID');
 const owner=value.owner||(legacy?'bd-research-owner':null),method=value.auth_method||(legacy?'legacy-password':null);
 if(!OWNER.test(owner||'')||!['legacy-password','verified-account'].includes(method))throw Error('AUTH_SESSION_INVALID');
 return {token:value.token,expires_at:value.expires_at,owner,auth_method:method};
}
try{const value=JSON.parse(localStorage.getItem(STORAGE)||'null');if(value?.token&&typeof value.token==='string'&&/^[-a-zA-Z0-9_.]{8,2500}$/.test(value.token)&&Date.parse(value.expires_at)>Date.now())session={token:value.token,expires_at:value.expires_at,owner:OWNER.test(value.owner||'')?value.owner:null,auth_method:['legacy-password','verified-account'].includes(value.auth_method)?value.auth_method:null};else localStorage.removeItem(STORAGE);}catch{}
const context=()=>({epoch,token:session?.token||null,owner:validated?session?.owner||null:null,method:validated?session?.auth_method||null:null,signal:epochController.signal});
function current(c){if(c.epoch!==epoch||c.token!==(session?.token||null))throw Error('AUTH_SESSION_CHANGED');}
function notifyAuth(oldOwner,newOwner){document.dispatchEvent(new CustomEvent('df-auth-change',{detail:{old_owner:oldOwner||null,new_owner:newOwner||null}}));}
function replaceSession(value,{notify=true,trusted=true,persist=true}={}){
 const oldOwner=validated?session?.owner||null:null;
 epoch++;epochController.abort();epochController=new AbortController();
 for(const controller of requests)controller.abort();requests.clear();
 for(const cancel of [...authCancellations])cancel();
 session=value;validated=!!value&&trusted;uploads.clear();validationPromise=null;
 if(persist)try{if(value)localStorage.setItem(STORAGE,JSON.stringify(value));else localStorage.removeItem(STORAGE);}catch{}
 if(notify)notifyAuth(oldOwner,validated?value?.owner:null);
 return session;
}
export const apiUnlocked=()=>!!session;
export const sessionOwner=()=>validated?session?.owner||null:null;
// Local/offline namespace hint only. It grants no cloud authority and never
// changes validated; callers must first classify a non-authentication failure.
export const cachedSessionOwner=()=>session&&Date.parse(session.expires_at)>Date.now()&&OWNER.test(session.owner||'')?session.owner:null;
export const sessionMethod=()=>validated?session?.auth_method||null:null;
export const sessionExpiry=()=>session?.expires_at||null;
export function lockAPI(){replaceSession(null);}
async function requestFor(c,path,{method='GET',body,raw,headers={},publicRequest=false,signal}={},tokenOverride){
 current(c);
 const controller=new AbortController(),abort=()=>controller.abort();
 const timeout=setTimeout(abort,45000);requests.add(controller);
 c.signal.addEventListener('abort',abort,{once:true});signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 const outgoing=Object.fromEntries(Object.entries(headers).filter(([key])=>!/^authorization$/i.test(key)));
 const token=tokenOverride===undefined?c.token:tokenOverride;
 if(!publicRequest&&token)outgoing.authorization='Bearer '+token;
 if(body)outgoing['content-type']='application/json';
 let ownUnauthorized=false;
 try{
  current(c);
  const response=await fetch(API_BASE+'/api/df'+path,{method,headers:outgoing,body:raw??(body?JSON.stringify(body):undefined),signal:controller.signal,credentials:'omit',cache:'no-store',redirect:'error'});
  current(c);
  if(!response.ok){
   let data;try{data=await response.json();}catch{}current(c);
   if(response.status===401&&tokenOverride===undefined&&!publicRequest&&c.token){ownUnauthorized=true;lockAPI();}
   const error=Error(typeof data?.error==='string'?data.error:'API_HTTP_'+response.status);error.status=response.status;throw error;
  }
  if(response.headers.get('content-type')?.includes('application/json')){const data=await response.json();current(c);return data;}
  // Consume the bounded asset response while its controller is still tracked.
  // No old-account stream remains live after an account change.
  const data=await response.arrayBuffer();current(c);
  return new Response([204,205,304].includes(response.status)?null:data,{status:response.status,statusText:response.statusText,headers:response.headers});
 }catch(error){if(!ownUnauthorized)current(c);throw error;}
 finally{clearTimeout(timeout);requests.delete(controller);c.signal.removeEventListener('abort',abort);signal?.removeEventListener('abort',abort);}
}
export const request=(path,options)=>requestFor(context(),path,options);
export const capabilities=()=>request('/capabilities',{publicRequest:true});
export async function validateSession(){
 if(!session)return null;
 const c=context();
 if(validationPromise?.epoch===c.epoch)return validationPromise.promise;
 const pending={epoch:c.epoch,promise:null};
 pending.promise=(async()=>{
  const receipt=await requestFor(c,'/session');current(c);
  if(!OWNER.test(receipt?.owner||''))throw Error('AUTH_SESSION_INVALID');
  const value=normalizeSession({...session,owner:receipt.owner,auth_method:receipt.auth_method||'legacy-password'});
  if(!validated||session.owner!==value.owner||session.auth_method!==value.auth_method)replaceSession(value,{notify:true});
  else{session=value;validated=true;try{localStorage.setItem(STORAGE,JSON.stringify(value));}catch{}}
  return session;
 })();
 validationPromise=pending;
 try{return await pending.promise;}finally{if(validationPromise===pending)validationPromise=null;}
}
export async function ensureAuth(language='en'){
 if(session&&Date.parse(session.expires_at)<=Date.now())lockAPI();
 if(session&&!validated){try{await validateSession();}catch(error){if(error.status!==401)throw error;}}
 if(session)return session;if(authPromise)return authPromise;
 const dialog=document.getElementById('api-auth'),form=document.getElementById('api-auth-form'),input=document.getElementById('api-password'),error=document.getElementById('api-auth-error');
 if(!dialog||!form||!input)throw Error('AUTH_DIALOG_MISSING');
 authPromise=new Promise((resolve,reject)=>{
  let done=false;
  const cleanup=()=>{form.removeEventListener('submit',submit);dialog.removeEventListener('close',cancel);authCancellations.delete(changed);input.value='';authPromise=null;};
  const changed=()=>{if(done)return;done=true;cleanup();dialog.close();reject(Error('AUTH_SESSION_CHANGED'));};
  const cancel=()=>{if(!done){done=true;cleanup();reject(Error('AUTH_CANCELLED'));}};
  const submit=async event=>{
   event.preventDefault();error.textContent='';const button=form.querySelector('button[type=submit]');button.disabled=true;
   try{
    let device;try{device=localStorage.getItem('bd-df-device');if(!device){device=crypto.randomUUID();localStorage.setItem('bd-df-device',device);}}catch{device=crypto.randomUUID();}
    const value=normalizeSession(await request('/auth',{method:'POST',publicRequest:true,body:{password:input.value,device}}),{legacy:true});
    if(done)return;done=true;cleanup();dialog.close();replaceSession(value);resolve(session);
   }catch(e){if(!done)error.textContent=e.message==='UNAUTHORIZED'?(language==='sl'?'Geslo ni pravilno.':'Incorrect password.'):(language==='sl'?'Povezava API ni uspela: ':'API connection failed: ')+e.message;}
   finally{button.disabled=false;}
  };
  authCancellations.add(changed);form.addEventListener('submit',submit);dialog.addEventListener('close',cancel);dialog.showModal();input.focus();
 });return authPromise;
}
export function signInAccount(language='en'){
 if(accountPromise)return accountPromise;
 const c=context(),nonce=crypto.randomUUID(),url=new URL('/Nara/dualframe-lab/account-login.html',ACCOUNT_ORIGIN);
 url.search=new URLSearchParams({opener_origin:location.origin,nonce,lang:language==='sl'?'sl':'en'}).toString();
 const popup=globalThis.open?.(url.href,'dualframe-account-'+nonce,'popup,width=520,height=760');
 if(!popup)return Promise.reject(Error('ACCOUNT_LOGIN_POPUP_BLOCKED'));
 accountPromise=new Promise((resolve,reject)=>{
  let done=false,processing=false;const controller=new AbortController();
  const cleanup=()=>{clearInterval(closed);clearTimeout(timeout);globalThis.removeEventListener('message',message);authCancellations.delete(changed);accountPromise=null;try{popup.close();}catch{}};
  const fail=error=>{if(done)return;done=true;controller.abort();cleanup();reject(error);};
  const changed=()=>fail(Error('AUTH_SESSION_CHANGED'));
  const message=async event=>{
   if(done||processing||event.origin!==ACCOUNT_ORIGIN||event.source!==popup||!event.data||event.data.nonce!==nonce)return;
   if(event.data.type==='dualframe-account-error')return fail(Error(/^[A-Z0-9_]{1,100}$/.test(event.data.error||'')?event.data.error:'ACCOUNT_LOGIN_FAILED'));
   if(event.data.type!=='dualframe-account-session')return;
   let candidate;try{candidate=normalizeSession(event.data.session);if(candidate.auth_method!=='verified-account')throw Error('AUTH_SESSION_INVALID');}catch{return;}
   processing=true;
   try{
    current(c);
    const verified=await requestFor(c,'/session',{signal:controller.signal},candidate.token);current(c);
    if(verified?.owner!==candidate.owner||verified?.auth_method!=='verified-account'||!Number.isFinite(Date.parse(verified.expires_at))||Date.parse(verified.expires_at)<=Date.now())throw Error('AUTH_SESSION_INVALID');
    if(Date.parse(verified.expires_at)<Date.parse(candidate.expires_at))candidate.expires_at=verified.expires_at;
    if(done)return;done=true;cleanup();replaceSession(candidate);resolve(session);
   }catch(error){fail(error);}
  };
  const closed=setInterval(()=>{if(popup.closed&&!processing)fail(Error('AUTH_CANCELLED'));},500);
  const timeout=setTimeout(()=>fail(Error('ACCOUNT_LOGIN_TIMEOUT')),5*60000);
  authCancellations.add(changed);globalThis.addEventListener('message',message);
 });return accountPromise;
}
function boundAPI(c){
 const call=(path,options)=>requestFor(c,path,options);
 const check=()=>current(c);
 const checkTransfer=signal=>{check();if(signal?.aborted)throw Error('SYNC_INTERRUPTED');};
 const transferRequest=async(signal,path,options)=>{checkTransfer(signal);try{return await call(path,{...options,signal});}catch(error){checkTransfer(signal);throw error;}};
 async function asset(id){
  check();let start=0,total=null,mime='image/png';const pieces=[];
  do{
   const response=await call('/assets/'+encodeURIComponent(id),{headers:{range:`bytes=${start}-${start+2097151}`}});check();mime=response.headers.get('content-type')||mime;
   const data=await response.arrayBuffer();check();pieces.push(data);
   const range=response.headers.get('content-range')?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
   if(!range){total=data.byteLength;start=total;}else{if(Number(range[1])!==start||data.byteLength!==Number(range[2])-start+1)throw Error('ASSET_RANGE_INVALID');total=Number(range[3]);start=Number(range[2])+1;}
   if(total>75*1024*1024||data.byteLength===0)throw Error('ASSET_SIZE_INVALID');
  }while(start<total);check();return new Blob(pieces,{type:mime});
 }
 async function upload(blob,kind){
  check();const digest=await sha256(blob);check();
  const ticket=await call('/uploads/init',{method:'POST',body:{sha256:digest,size:blob.size,kind}});
  for(let i=0;i<ticket.chunks;i++)await call(`/uploads/${ticket.upload_id}/${i}`,{method:'PUT',raw:blob.slice(i*ticket.chunk_size,Math.min(blob.size,(i+1)*ticket.chunk_size))});
  const result=await call(`/uploads/${ticket.upload_id}/finish`,{method:'POST',body:{}});check();if(result.sha256!==digest)throw Error('UPLOAD_HASH_MISMATCH');return result;
 }
 async function uploadPair(pair){
  check();
  if(pair.gateway_version==='v3'&&pair.upload_id&&(pair.gateway_owner===c.owner||(!pair.gateway_owner&&c.owner==='bd-research-owner')))return {pair_id:pair.upload_id,original:{sha256:pair.original.sha256}};
  const key=c.epoch+':'+pair.original.sha256;
  if(uploads.has(key))return uploads.get(key);
  const promise=(async()=>{
   const original=await upload(pair.original.blob,'original'),normalized=await upload(pair.original.normalized,'normalized');
   const saved=await call('/pairs',{method:'POST',body:{original_asset_id:original.asset_id,normalized_asset_id:normalized.asset_id,original_sha256:pair.original.sha256,title:pair.original.filename||pair.original.name}});
   check();pair.upload_id=saved.pair_id;pair.gateway_version='v3';pair.gateway_owner=c.owner;return saved;
  })();uploads.set(key,promise);
  try{return await promise;}catch(error){uploads.delete(key);throw error;}
 }
 async function awaitJob(id,{signal,onState}={}){
  for(let i=0;i<360;i++){
   check();if(signal?.aborted)throw Error('CANCELLED');
   const state=await call('/jobs/'+id,{signal});check();onState?.(state);check();
   if(['READY','ACCEPTED','FAILED','HELD','CANCELLED'].includes(state.status))return state;
   await new Promise(resolve=>{const finish=()=>{clearTimeout(timer);signal?.removeEventListener('abort',finish);c.signal.removeEventListener('abort',finish);resolve();};const timer=setTimeout(finish,1800);signal?.addEventListener('abort',finish,{once:true});c.signal.addEventListener('abort',finish,{once:true});});
  }check();return {job_id:id,status:'HELD',error:'JOB_STILL_RUNNING'};
 }
 async function compatibleAPI(path,{method='GET',body,raw,pair}={}){
  check();if(path==='/api/uploads')return uploadPair(pair);
  if(path.startsWith('/api/assets/'))return asset(path.slice('/api/assets/'.length));
  return call(path.replace(/^\/api/,''),{method,body,raw});
 }
 // Byte-only Sync; every range/chunk and callback stays on this captured epoch.
 async function uploadSyncAsset(blob,options={}){
  checkTransfer(options.signal);if(!(blob instanceof Blob)||!blob.size)throw Error('SYNC_ASSET_MISSING');
  const digest=await sha256(blob);checkTransfer(options.signal);let checkpoint=options.checkpoint;
  if(checkpoint?.sha256!==digest||checkpoint?.size!==blob.size)checkpoint=null;
  let ticket=checkpoint?.ticket;
  if(ticket){try{
   const status=await transferRequest(options.signal,'/uploads/'+encodeURIComponent(ticket.upload_id));
   if(status.complete){if(status.asset?.sha256!==digest||status.asset?.byte_size!==blob.size)throw Error('UPLOAD_HASH_MISMATCH');checkTransfer(options.signal);return status.asset;}
   const received=new Set(status.received||[]);let first=0;while(received.has(first))first++;checkpoint={...checkpoint,next_chunk:first};
  }catch(error){if(![404,410].includes(error.status))throw error;ticket=null;checkpoint=null;}}
  if(!ticket){
   const {kind='derived',pair_id,source_sha256,parent_asset_ids=[],lineage={},role,acceptance,family_id,operation,orientation,quality}=options;
   ticket=await transferRequest(options.signal,'/uploads/init',{method:'POST',body:{sha256:digest,size:blob.size,kind,pair_id,source_sha256,parent_asset_ids,lineage,role,acceptance,family_id,operation,orientation,quality}});
   checkpoint={sha256:digest,size:blob.size,ticket,next_chunk:0};check();await options.onCheckpoint?.(checkpoint);checkTransfer(options.signal);
  }
  if(!Number.isInteger(ticket.chunk_size)||ticket.chunk_size<=0||ticket.chunks!==Math.ceil(blob.size/ticket.chunk_size))throw Error('UPLOAD_TICKET_INVALID');
  for(let i=checkpoint.next_chunk||0;i<ticket.chunks;i++){
   await transferRequest(options.signal,`/uploads/${encodeURIComponent(ticket.upload_id)}/${i}`,{method:'PUT',raw:blob.slice(i*ticket.chunk_size,Math.min(blob.size,(i+1)*ticket.chunk_size))});
   checkpoint={...checkpoint,next_chunk:i+1};check();await options.onCheckpoint?.(checkpoint);checkTransfer(options.signal);
  }
  const result=await transferRequest(options.signal,`/uploads/${encodeURIComponent(ticket.upload_id)}/finish`,{method:'POST',body:{}});checkTransfer(options.signal);
  if(result.sha256!==digest||result.byte_size!==blob.size)throw Error('UPLOAD_HASH_MISMATCH');return result;
 }
 async function downloadSyncAsset(meta,options={}){
  checkTransfer(options.signal);const size=meta?.byte_size??meta?.size;
  if(!Number.isSafeInteger(size)||size<=0||size>75*1024*1024||!/^[a-f0-9]{64}$/.test(meta?.sha256||''))throw Error('SYNC_ASSET_SIZE_UNKNOWN');
  let checkpoint=options.checkpoint;if(checkpoint?.sha256!==meta.sha256||checkpoint?.asset_id!==meta.asset_id||checkpoint?.size!==size)checkpoint=null;
  let pieces=checkpoint?.pieces||[],start=checkpoint?.next_byte||0;
  if(!Number.isSafeInteger(start)||start<0||start>size||pieces.reduce((n,b)=>n+b.size,0)!==start){pieces=[];start=0;}
  while(start<size){
   const end=Math.min(size-1,start+2097151),response=await transferRequest(options.signal,'/assets/'+encodeURIComponent(meta.asset_id),{headers:{range:`bytes=${start}-${end}`}});
   const data=await response.blob();check();const range=response.headers.get('content-range')?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
   if(!range||Number(range[1])!==start||Number(range[2])!==end||Number(range[3])!==size||data.size!==end-start+1)throw Error('ASSET_RANGE_INVALID');
   pieces=[...pieces,data];start=end+1;check();await options.onCheckpoint?.({sha256:meta.sha256,asset_id:meta.asset_id,size,next_byte:start,pieces});checkTransfer(options.signal);
  }
  const blob=new Blob(pieces,{type:meta.mime||meta.type||'image/png'});if(blob.size!==size||await sha256(blob)!==meta.sha256)throw Error('SYNC_ASSET_HASH_MISMATCH');checkTransfer(options.signal);return blob;
 }
 const syncTransport={manifest:({cursor,limit=100,frontier}={})=>call('/sync/manifest?'+new URLSearchParams({limit:String(limit),...(cursor?{cursor}:{}),...(frontier?{frontier}:{})})),uploadAsset:uploadSyncAsset,downloadAsset:downloadSyncAsset,saveRecord:body=>call('/sync/records',{method:'POST',body}),createPair:body=>call('/pairs',{method:'POST',body}),putTitle:(digest,body)=>call('/titles/'+digest,{method:'PUT',body})};
 return Object.freeze({owner:c.owner,auth_method:c.method,request:call,uploadPair,awaitJob,asset,compatibleAPI,syncTransport,uploadSyncAsset,downloadSyncAsset});
}
export const captureAPI=()=>boundAPI(context());
export const asset=(...args)=>captureAPI().asset(...args);
export const uploadPair=(...args)=>captureAPI().uploadPair(...args);
export const awaitJob=(...args)=>captureAPI().awaitJob(...args);
export const compatibleAPI=(...args)=>captureAPI().compatibleAPI(...args);
export const uploadSyncAsset=(...args)=>captureAPI().uploadSyncAsset(...args);
export const downloadSyncAsset=(...args)=>captureAPI().downloadSyncAsset(...args);
export const syncTransport={manifest:(...args)=>captureAPI().syncTransport.manifest(...args),uploadAsset:uploadSyncAsset,downloadAsset:downloadSyncAsset,saveRecord:(...args)=>captureAPI().syncTransport.saveRecord(...args),createPair:(...args)=>captureAPI().syncTransport.createPair(...args),putTitle:(...args)=>captureAPI().syncTransport.putTitle(...args)};
