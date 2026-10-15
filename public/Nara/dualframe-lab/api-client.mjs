import {sha256} from './core.mjs?v=3.0-r4';
export const API_BASE=/^(www\.)?mdlxdcc\.org$/.test(location.hostname)||/netlify\.app$/.test(location.hostname)||['localhost','127.0.0.1'].includes(location.hostname)?location.origin:'https://www.mdlxdcc.org';
const STORAGE='bd-dualframe-api-session-v3';
let session=null,authPromise=null,validated=false;
const uploads=new Map();
try{const value=JSON.parse(localStorage.getItem(STORAGE)||'null');if(value?.token&&Date.parse(value.expires_at)>Date.now())session=value;else localStorage.removeItem(STORAGE);}catch{}
export const apiUnlocked=()=>!!session;
export function lockAPI(){session=null;validated=false;uploads.clear();try{localStorage.removeItem(STORAGE);}catch{}document.dispatchEvent(new CustomEvent('df-auth-change'));}
export function sessionExpiry(){return session?.expires_at||null;}
export async function request(path,{method='GET',body,raw,headers={},publicRequest=false}={}){
 const response=await fetch(API_BASE+'/api/df'+path,{method,headers:{...(!publicRequest&&session?{authorization:`Bearer ${session.token}`}:{}) ,...(body?{'content-type':'application/json'}:{}),...headers},body:raw??(body?JSON.stringify(body):undefined),signal:AbortSignal.timeout(45000),credentials:'omit',cache:'no-store',redirect:'error'});
 if(!response.ok){let data;try{data=await response.json();}catch{}if(response.status===401)lockAPI();const e=Error(data?.error||`API_HTTP_${response.status}`);e.status=response.status;throw e;}
 if(response.headers.get('content-type')?.includes('application/json'))return response.json();
 return response;
}
export const capabilities=()=>request('/capabilities',{publicRequest:true});
export async function ensureAuth(language='en'){
 if(session&&!validated){try{await request('/session');validated=true;}catch(e){if(e.status!==401)throw e;}}
 if(session)return session;if(authPromise)return authPromise;
 const dialog=document.getElementById('api-auth'),form=document.getElementById('api-auth-form'),input=document.getElementById('api-password'),error=document.getElementById('api-auth-error');
 if(!dialog||!form||!input)throw Error('AUTH_DIALOG_MISSING');
 authPromise=new Promise((resolve,reject)=>{
  let done=false;
  const cleanup=()=>{form.removeEventListener('submit',submit);dialog.removeEventListener('close',cancel);input.value='';authPromise=null;};
  const cancel=()=>{if(!done){cleanup();reject(Error('AUTH_CANCELLED'));}};
  const submit=async event=>{event.preventDefault();error.textContent='';const button=form.querySelector('button[type=submit]');button.disabled=true;
   try{let device;try{device=localStorage.getItem('bd-df-device');if(!device){device=crypto.randomUUID();localStorage.setItem('bd-df-device',device);}}catch{device=crypto.randomUUID();}
    const value=await request('/auth',{method:'POST',publicRequest:true,body:{password:input.value,device}});session={token:value.token,expires_at:value.expires_at};validated=true;
    try{localStorage.setItem(STORAGE,JSON.stringify(session));}catch{}
    done=true;cleanup();dialog.close();document.dispatchEvent(new CustomEvent('df-auth-change'));resolve(session);
   }catch(e){error.textContent=e.message==='UNAUTHORIZED'?(language==='sl'?'Geslo ni pravilno.':'Incorrect password.'):(language==='sl'?'Povezava API ni uspela: ':'API connection failed: ')+e.message;}finally{button.disabled=false;}
  };
  form.addEventListener('submit',submit);dialog.addEventListener('close',cancel);dialog.showModal();input.focus();
 });return authPromise;
}
export async function asset(id){
 let start=0,total=null,mime='image/png';const pieces=[];
 do{const response=await request('/assets/'+encodeURIComponent(id),{headers:{range:`bytes=${start}-${start+2097151}`}});mime=response.headers.get('content-type')||mime;const data=await response.arrayBuffer();pieces.push(data);
  const range=response.headers.get('content-range')?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
  if(!range){total=data.byteLength;start=total;}else{if(Number(range[1])!==start||data.byteLength!==Number(range[2])-start+1)throw Error('ASSET_RANGE_INVALID');total=Number(range[3]);start=Number(range[2])+1;}
  if(total>75*1024*1024||data.byteLength===0)throw Error('ASSET_SIZE_INVALID');
 }while(start<total);return new Blob(pieces,{type:mime});
}
async function upload(blob,kind){
 const sha=await sha256(blob),ticket=await request('/uploads/init',{method:'POST',body:{sha256:sha,size:blob.size,kind}});
 for(let i=0;i<ticket.chunks;i++)await request(`/uploads/${ticket.upload_id}/${i}`,{method:'PUT',raw:blob.slice(i*ticket.chunk_size,Math.min(blob.size,(i+1)*ticket.chunk_size))});
 const result=await request(`/uploads/${ticket.upload_id}/finish`,{method:'POST',body:{}});if(result.sha256!==sha)throw Error('UPLOAD_HASH_MISMATCH');return result;
}
export async function uploadPair(pair){
 if(pair.gateway_version==='v3'&&pair.upload_id)return {pair_id:pair.upload_id,original:{sha256:pair.original.sha256}};
 if(uploads.has(pair.original.sha256))return uploads.get(pair.original.sha256);
 const promise=(async()=>{const original=await upload(pair.original.blob,'original'),normalized=await upload(pair.original.normalized,'normalized');
  const saved=await request('/pairs',{method:'POST',body:{original_asset_id:original.asset_id,normalized_asset_id:normalized.asset_id,original_sha256:pair.original.sha256,title:pair.original.filename||pair.original.name}});pair.upload_id=saved.pair_id;pair.gateway_version='v3';return saved;})();uploads.set(pair.original.sha256,promise);
 try{return await promise;}catch(e){uploads.delete(pair.original.sha256);throw e;}
}
export async function awaitJob(id,{signal,onState}={}){
 for(let i=0;i<360;i++){if(signal?.aborted)throw Error('CANCELLED');const state=await request('/jobs/'+id);onState?.(state);
  if(['READY','ACCEPTED','FAILED','HELD','CANCELLED'].includes(state.status))return state;
  await new Promise(resolve=>{const timer=setTimeout(resolve,1800);signal?.addEventListener('abort',()=>{clearTimeout(timer);resolve();},{once:true});});
 }return {job_id:id,status:'HELD',error:'JOB_STILL_RUNNING'};
}
export async function compatibleAPI(path,{method='GET',body,raw,pair}={}){
 if(path==='/api/uploads')return uploadPair(pair);
 if(path.startsWith('/api/assets/'))return asset(path.slice('/api/assets/'.length));
 return request(path.replace(/^\/api/,''),{method,body,raw});
}

// Sync transports are byte-only. They never create or resume an image-generation job.
export async function uploadSyncAsset(blob,options={}){
 if(!(blob instanceof Blob)||!blob.size)throw Error('SYNC_ASSET_MISSING');
 const digest=await sha256(blob);
 let checkpoint=options.checkpoint;
 if(checkpoint?.sha256!==digest||checkpoint?.size!==blob.size)checkpoint=null;
 let ticket=checkpoint?.ticket;
 if(ticket){
  try{
   const status=await request('/uploads/'+encodeURIComponent(ticket.upload_id));
   if(status.complete){if(status.asset?.sha256!==digest||status.asset?.byte_size!==blob.size)throw Error('UPLOAD_HASH_MISMATCH');return status.asset;}
   const received=new Set(status.received||[]);let first=0;while(received.has(first))first++;
   checkpoint={...checkpoint,next_chunk:first};
  }catch(error){if(![404,410].includes(error.status))throw error;ticket=null;checkpoint=null;}
 }
 if(!ticket){
  const {kind='derived',pair_id,source_sha256,parent_asset_ids=[],lineage={},role,acceptance,family_id,operation,orientation,quality}=options;
  ticket=await request('/uploads/init',{method:'POST',body:{sha256:digest,size:blob.size,kind,pair_id,source_sha256,parent_asset_ids,lineage,role,acceptance,family_id,operation,orientation,quality}});
  checkpoint={sha256:digest,size:blob.size,ticket,next_chunk:0};
  await options.onCheckpoint?.(checkpoint);
 }
 if(!Number.isInteger(ticket.chunk_size)||ticket.chunk_size<=0||ticket.chunks!==Math.ceil(blob.size/ticket.chunk_size))throw Error('UPLOAD_TICKET_INVALID');
 for(let i=checkpoint.next_chunk||0;i<ticket.chunks;i++){
  await request(`/uploads/${encodeURIComponent(ticket.upload_id)}/${i}`,{method:'PUT',raw:blob.slice(i*ticket.chunk_size,Math.min(blob.size,(i+1)*ticket.chunk_size))});
  checkpoint={...checkpoint,next_chunk:i+1};await options.onCheckpoint?.(checkpoint);
 }
 const result=await request(`/uploads/${encodeURIComponent(ticket.upload_id)}/finish`,{method:'POST',body:{}});
 if(result.sha256!==digest||result.byte_size!==blob.size)throw Error('UPLOAD_HASH_MISMATCH');
 return result;
}
export async function downloadSyncAsset(meta,options={}){
 const size=meta?.byte_size??meta?.size;
 if(!Number.isSafeInteger(size)||size<=0||size>75*1024*1024||!/^[a-f0-9]{64}$/.test(meta?.sha256||''))throw Error('SYNC_ASSET_SIZE_UNKNOWN');
 let checkpoint=options.checkpoint;
 if(checkpoint?.sha256!==meta.sha256||checkpoint?.asset_id!==meta.asset_id||checkpoint?.size!==size)checkpoint=null;
 let pieces=checkpoint?.pieces||[],start=checkpoint?.next_byte||0;
 if(!Number.isSafeInteger(start)||start<0||start>size||pieces.reduce((n,b)=>n+b.size,0)!==start){pieces=[];start=0;}
 while(start<size){
  const end=Math.min(size-1,start+2097151),response=await request('/assets/'+encodeURIComponent(meta.asset_id),{headers:{range:`bytes=${start}-${end}`}});
  const data=await response.blob(),range=response.headers.get('content-range')?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
  if(!range||Number(range[1])!==start||Number(range[2])!==end||Number(range[3])!==size||data.size!==end-start+1)throw Error('ASSET_RANGE_INVALID');
  pieces=[...pieces,data];start=end+1;
  await options.onCheckpoint?.({sha256:meta.sha256,asset_id:meta.asset_id,size,next_byte:start,pieces});
 }
 const blob=new Blob(pieces,{type:meta.mime||meta.type||'image/png'});
 if(blob.size!==size||await sha256(blob)!==meta.sha256)throw Error('SYNC_ASSET_HASH_MISMATCH');
 return blob;
}
export const syncTransport={
 manifest:({cursor,limit=100,frontier}={})=>request('/sync/manifest?'+new URLSearchParams({limit:String(limit),...(cursor?{cursor}:{}),...(frontier?{frontier}:{})})),
 uploadAsset:uploadSyncAsset,
 downloadAsset:downloadSyncAsset,
 saveRecord:body=>request('/sync/records',{method:'POST',body}),
 createPair:body=>request('/pairs',{method:'POST',body}),
 putTitle:(sha,body)=>request('/titles/'+sha,{method:'PUT',body}),
};
