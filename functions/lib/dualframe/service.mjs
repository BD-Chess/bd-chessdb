import {randomUUID,createHash} from 'node:crypto';
import {bearer,checkPassword,signToken,verifyToken} from './auth.mjs';
import {modelFor,keyFor,publicCapabilities} from './contracts.mjs';
import {callProvider,ProviderError} from './providers.mjs';
import {inspectImage,finishImage,hash,normalizationProof,prepareEditInput} from './images.mjs';
import {taskGeometry} from '../../../public/Nara/dualframe-lab/core.mjs';

const OWNER='bd-research-owner',CHUNK=1024*1024,MAX_FILE=64*1024*1024;
const ID=/^[a-zA-Z0-9_-]{8,100}$/,HASH=/^[a-f0-9]{64}$/;
const origins=new Set(['https://bd-chess.github.io','https://www.mdlxdcc.org','https://mdlxdcc.org']);
function fail(code,status=400){throw Object.assign(Error(code),{status});}
const cleanName=s=>String(s||'Untitled').replace(/[\u0000-\u001f]/g,'').slice(0,120);
const readJSON=async req=>{const t=await req.text();if(t.length>16000)fail('REQUEST_TOO_LARGE',413);try{return JSON.parse(t);}catch{fail('INVALID_JSON');}};
export function createService({store,env,fetcher=fetch,runProvider=callProvider,now=()=>Date.now(),dispatch=null}){
 const get=key=>store.get(key,{type:'json',consistency:'strong'}),bytes=key=>store.get(key,{type:'arrayBuffer',consistency:'strong'}).then(v=>v===null?null:Buffer.from(v));
 const put=async(key,value)=>{const result=await store.setJSON(key,value,{onlyIfNew:true});if(typeof result?.modified!=='boolean')fail('STORAGE_VERSION_UNSUPPORTED',503);if(result.modified&&JSON.stringify(await get(key))!==JSON.stringify(value))fail('STORAGE_WRITE_UNCONFIRMED',503);return result;};
 const session=req=>verifyToken(bearer(req),env('DF_SESSION_SECRET'),'session',now());
 function json(req,data,status=200){const origin=req.headers.get('origin');const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','vary':'Origin'};if(origin&&origins.has(origin)){headers['access-control-allow-origin']=origin;headers['access-control-allow-headers']='authorization,content-type,range';headers['access-control-expose-headers']='content-range,content-length';headers['access-control-allow-methods']='GET,POST,PUT,OPTIONS';}return Response.json(data,{status,headers});}
 async function ownedAsset(owner,id){if(!ID.test(id))fail('ASSET_UNKNOWN',404);const meta=await get(`asset-meta/${owner}/${id}`);if(!meta)fail('ASSET_UNKNOWN',404);return meta;}
 async function getJob(owner,id){if(!ID.test(id))fail('JOB_UNKNOWN',404);const j=await get(`jobs/${owner}/${id}`);if(!j)fail('JOB_UNKNOWN',404);return j;}
 async function state(j){
  const root=`job-events/${j.owner}/${j.job_id}`;
  if(await get(`${root}/rejected`))return {...j,status:'REJECTED'};
  const result=await get(`${root}/ready`);if(result)return {...j,...result,status:await get(`${root}/accepted`)?'ACCEPTED':'READY'};
  const failed=await get(`${root}/failed`);if(failed)return {...j,...failed};
  const claim=await get(`${root}/submitted`);if(claim)return {...j,status:now()-claim.at>15*60000?'HELD':'RUNNING',...(now()-claim.at>15*60000?{error:'PROVIDER_STATE_UNKNOWN',detail:'Submission was recorded; no automatic paid retry.'}:{})};
  return {...j,status:await get(`${root}/cancelled`)?'CANCELLED':'PENDING'};
 }
 async function schedule(req,j){
  const token=signToken({owner:j.owner,scope:'worker',job_id:j.job_id},env('DF_SESSION_SECRET'),20*60,now());
  if(dispatch)return dispatch({job_id:j.job_id,token});
  const url=new URL('/.netlify/functions/dualframe-work-background',req.url);
  const r=await fetcher(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({job_id:j.job_id,token}),signal:AbortSignal.timeout(15000),redirect:'error'});
  if(r.status!==202)fail('WORKER_DISPATCH_FAILED',503);
 }
 async function handle(req){
  try{
   const u=new URL(req.url),path=u.pathname.replace(/^\/api\/df/,'').replace(/^\/\.netlify\/functions\/dualframe-api/,'').replace(/^\/\.netlify\/functions\/dualframe-auth$/,'/auth');
   if(req.method==='OPTIONS'){const origin=req.headers.get('origin');if(!origin||!origins.has(origin))return json(req,{error:'ORIGIN_NOT_ALLOWED'},403);return json(req,{ok:true});}
   if(path==='/capabilities'&&req.method==='GET')return json(req,publicCapabilities(env));
   if(path==='/auth'&&req.method==='POST'){
    if(!env('DF_PASSWORD_VERIFIER')||!env('DF_SESSION_SECRET'))fail('AUTH_NOT_CONFIGURED',503);
    const b=await readJSON(req);if(!checkPassword(b.password,env('DF_PASSWORD_VERIFIER')))fail('UNAUTHORIZED',401);
    const token=signToken({owner:OWNER,scope:'session',device:ID.test(b.device||'')?b.device:randomUUID()},env('DF_SESSION_SECRET'),30*86400,now());
    return json(req,{token,expires_at:new Date(now()+30*86400000).toISOString(),owner:OWNER});
   }
   const claim=session(req),owner=claim.owner;
   if(path==='/session'&&req.method==='GET')return json(req,{ok:true,expires_at:new Date(claim.exp*1000).toISOString(),owner});
   if(path==='/uploads/init'&&req.method==='POST'){
    const b=await readJSON(req);if(!HASH.test(b.sha256||'')||!Number.isInteger(b.size)||b.size<24||b.size>MAX_FILE||!['original','normalized'].includes(b.kind))fail('UPLOAD_INVALID');
    if(b.kind==='original'&&b.size>12*1024*1024)fail('UPLOAD_TOO_LARGE',413);
    const id=randomUUID(),n=Math.ceil(b.size/CHUNK);await put(`uploads/${owner}/${id}`,{id,owner,sha256:b.sha256,size:b.size,kind:b.kind,chunks:n,created_at:now()});return json(req,{upload_id:id,chunk_size:CHUNK,chunks:n});
   }
   const chunk=path.match(/^\/uploads\/([-a-zA-Z0-9_]+)\/(\d+)$/);
   if(chunk&&req.method==='PUT'){
    const info=await get(`uploads/${owner}/${chunk[1]}`),index=Number(chunk[2]);if(!info||!Number.isInteger(index)||index<0||index>=info.chunks)fail('UPLOAD_UNKNOWN',404);
    if(now()-info.created_at>86400000)fail('UPLOAD_EXPIRED',410);
    const data=Buffer.from(await req.arrayBuffer()),expected=Math.min(CHUNK,info.size-index*CHUNK);if(data.length!==expected)fail('CHUNK_SIZE_INVALID');
    const key=`chunks/${owner}/${info.id}/${index}`;const written=await store.set(key,data,{onlyIfNew:true});
    if(!written.modified){const old=await bytes(key);if(!old||hash(old)!==hash(data))fail('CHUNK_CONFLICT',409);}
    return json(req,{ok:true,index});
   }
   const finish=path.match(/^\/uploads\/([-a-zA-Z0-9_]+)\/finish$/);
   if(finish&&req.method==='POST'){
    const info=await get(`uploads/${owner}/${finish[1]}`);if(!info)fail('UPLOAD_UNKNOWN',404);
    const existing=await get(`asset-meta/${owner}/${info.id}`);if(existing)return json(req,existing);
    const list=[];for(let i=0;i<info.chunks;i++){const part=await bytes(`chunks/${owner}/${info.id}/${i}`);if(!part)fail('UPLOAD_INCOMPLETE',409);list.push(part);}
    const data=Buffer.concat(list);if(data.length!==info.size||hash(data)!==info.sha256)fail('UPLOAD_HASH_MISMATCH',409);
    const dimensions=await inspectImage(data);if(info.kind==='normalized'&&dimensions.format!=='png')fail('NORMALIZED_PNG_REQUIRED');
    const meta={asset_id:info.id,sha256:info.sha256,byte_size:info.size,...dimensions,kind:info.kind,mime:dimensions.format==='jpeg'?'image/jpeg':`image/${dimensions.format}`,owner};
    await store.set(`assets/${owner}/${info.id}`,data,{onlyIfNew:true});await put(`asset-meta/${owner}/${info.id}`,meta);
    for(let i=0;i<info.chunks;i++)await store.delete(`chunks/${owner}/${info.id}/${i}`);
    return json(req,meta);
   }
   if(path==='/pairs'&&req.method==='POST'){
    const b=await readJSON(req),original=await ownedAsset(owner,b.original_asset_id),normalized=await ownedAsset(owner,b.normalized_asset_id);
    if(original.kind!=='original'||normalized.kind!=='normalized'||original.sha256!==b.original_sha256)fail('PAIR_INVALID');
    const id=hash(Buffer.from(owner+':'+original.sha256)).slice(0,40),pair={pair_id:id,owner,title:cleanName(b.title),original,normalized,created_at:new Date(now()).toISOString()};
    await put(`pairs/${owner}/${id}`,pair);return json(req,{pair_id:id,original:{sha256:original.sha256,width:normalized.width,height:normalized.height}});
   }
   const deletePair=path.match(/^\/pairs\/([-a-zA-Z0-9_]+)$/);
   if(deletePair&&req.method==='DELETE'){if(!ID.test(deletePair[1]))fail('PAIR_INVALID');await put(`deleted-pairs/${owner}/${deletePair[1]}`,{at:now()});return json(req,{deleted:true});}
   if((path==='/expand'||path==='/generate')&&req.method==='POST'){
    const b=await readJSON(req),operation=path==='/generate'?'generate':'expand',m=modelFor(b.model);
    if(!m)fail('MODEL_UNKNOWN');if(!keyFor(m,env))fail('KEY_NOT_CONFIGURED',503);if(operation==='expand'&&!m.edit)fail('MODEL_GENERATION_ONLY');
    if(!HASH.test(b.idempotency_key||'')||!['portrait','landscape'].includes(b.target)||!['faithful','smart','infographic'].includes(b.mode)||!['hd','4k'].includes(b.quality)||typeof b.prompt!=='string'||b.prompt.length>3000||!['center','left','right','top','bottom'].includes(b.position||'center')||!Number.isInteger(b.seed)||b.seed<0||b.seed>2147483647)fail('JOB_INVALID');
    let pair=null;if(operation==='expand'){if(!ID.test(b.pair_id||''))fail('PAIR_UNKNOWN',404);pair=await get(`pairs/${owner}/${b.pair_id}`);if(!pair||pair.original.sha256!==b.input_sha256)fail('INPUT_HASH_MISMATCH',409);taskGeometry(pair.normalized.width,pair.normalized.height,b.target,b.position,b.mode,b.quality);}
    if(!b.prompt.trim()&&operation==='generate')fail('PROMPT_REQUIRED');
    const id=hash(Buffer.from(owner+':'+b.idempotency_key)),root=`jobs/${owner}/${id}`;
    const effective={operation,model:b.model,provider:m.provider,pair_id:pair?.pair_id||null,input_sha256:pair?.original.sha256||null,normalized_asset_id:pair?.normalized.asset_id||null,target:b.target,quality:b.quality,mode:b.mode,position:b.position||'center',prompt:b.prompt,seed:b.seed,task_parameters_hash:HASH.test(b.task_parameters_hash||'')?b.task_parameters_hash:null,text_layout:b.text_layout||null};
    const fingerprint=hash(Buffer.from(JSON.stringify(effective))),existing=await get(root);
    if(existing){if(existing.request_fingerprint!==fingerprint)fail('IDEMPOTENCY_CONFLICT',409);return json(req,{job_id:id,status:(await state(existing)).status,reused:true});}
    const ratio=b.target==='portrait'?'9:16':'16:9',instruction=operation==='generate'?`Create one image in ${ratio}. `:b.mode==='faithful'?`Extend this scene naturally to ${ratio}. Preserve the subject, identity, original scene and lighting; create the missing surroundings. `:b.mode==='infographic'?`Create a ${ratio} visual background based on the reference, with space for a text overlay. Do not draw text. `:`Recompose this reference as ${ratio}. Preserve the subject identity and scene; intelligently reveal a wider environment rather than crop. `;
    const job={...effective,job_id:id,owner,idempotency_key:b.idempotency_key,request_fingerprint:fingerprint,provider_prompt:instruction+b.prompt,created_at:new Date(now()).toISOString(),created_ms:now(),status:'PENDING',provider_cost:null,cost_currency:null};
    const created=await put(root,job);if(!created.modified&&(await get(root))?.request_fingerprint!==fingerprint)fail('IDEMPOTENCY_CONFLICT',409);if(created.modified)await schedule(req,job);return json(req,{job_id:id,status:'PENDING',reused:!created.modified},202);
   }
   const jobRoute=path.match(/^\/jobs\/([-a-zA-Z0-9_]+)(?:\/(accept|reject|cancel|resume))?$/);
   if(jobRoute){const j=await getJob(owner,jobRoute[1]);if(req.method==='GET'&&!jobRoute[2])return json(req,await state(j));
    if(req.method==='POST'&&jobRoute[2]){
     const action=jobRoute[2],s=await state(j),root=`job-events/${owner}/${j.job_id}`;
     if(action==='accept'){if(!['READY','ACCEPTED'].includes(s.status))fail('OUTPUT_NOT_READY',409);await put(`${root}/accepted`,{at:now()});}
     if(action==='reject')await put(`${root}/rejected`,{at:now()});
     if(action==='cancel')await put(`${root}/cancelled`,{at:now()});
     // Resume is receipt/status recovery. It cannot make another paid submission.
     if(action==='resume'&&s.status==='PENDING')await schedule(req,j);
     return json(req,await state(j));
    }
   }
   const asset=path.match(/^\/assets\/([-a-zA-Z0-9_]+)$/);
   if(asset&&req.method==='GET'){
    const meta=await ownedAsset(owner,asset[1]),data=await bytes(`assets/${owner}/${asset[1]}`);if(!data)fail('ASSET_UNKNOWN',404);
    const match=req.headers.get('range')?.match(/^bytes=(\d+)-(\d+)$/);let start=0,end=data.length-1,status=200;
    if(match){start=Number(match[1]);end=Math.min(Number(match[2]),data.length-1);if(start<0||end<start||start>=data.length||end-start+1>3*1024*1024)fail('RANGE_INVALID',416);status=206;}
    else if(data.length>3*1024*1024){start=0;end=3*1024*1024-1;status=206;}
    const headers=new Headers(json(req,{}).headers);headers.set('content-type',meta.mime);headers.set('content-length',String(end-start+1));headers.set('accept-ranges','bytes');if(status===206)headers.set('content-range',`bytes ${start}-${end}/${data.length}`);
    return new Response(data.subarray(start,end+1),{status,headers});
   }
   if(path==='/library'&&req.method==='GET'){
    const listing=await store.list({prefix:`jobs/${owner}/`}),jobs=[];for(const entry of listing.blobs.slice(-200)){const j=await get(entry.key);if(j&&!(j.pair_id&&await get(`deleted-pairs/${owner}/${j.pair_id}`))){const s=await state(j);if(s.status!=='REJECTED')jobs.push(s);}}
    const pairList=await store.list({prefix:`pairs/${owner}/`}),pairs=[];for(const entry of pairList.blobs.slice(-200)){const p=await get(entry.key);if(p&&!await get(`deleted-pairs/${owner}/${p.pair_id}`))pairs.push(p);}
    return json(req,{pairs,jobs:jobs.sort((a,b)=>b.created_at.localeCompare(a.created_at)),truncated:listing.blobs.length>200||pairList.blobs.length>200});
   }
   return json(req,{error:'NOT_FOUND'},404);
  }catch(e){const code=e.message==='UNAUTHORIZED'?'UNAUTHORIZED':/^[A-Z0-9_]+$/.test(e.message)?e.message:'REQUEST_FAILED';return json(req,{error:code},e.status||(code==='UNAUTHORIZED'?401:code==='REQUEST_FAILED'?500:400));}
 }
 async function work(payload){
  const claim=verifyToken(payload?.token,env('DF_SESSION_SECRET'),'worker',now());if(claim.job_id!==payload.job_id)fail('UNAUTHORIZED',401);
  const j=await getJob(claim.owner,payload.job_id),root=`job-events/${j.owner}/${j.job_id}`;
  if(await get(`${root}/ready`)||await get(`${root}/failed`)||await get(`${root}/cancelled`))return;
  // Immutable reservation: platform retries/repeated dispatches never repeat a paid call.
  const locked=await put(`${root}/submitted`,{at:now(),owner:j.owner,job_id:j.job_id,reservation_id:randomUUID()});if(!locked.modified)return;
  const started=now();
  try{
   const source=j.normalized_asset_id?await bytes(`assets/${j.owner}/${j.normalized_asset_id}`):null;
   if(j.operation==='expand'&&!source)fail('SOURCE_ASSET_MISSING',409);
   const edit=await prepareEditInput(source,j),result=await runProvider(edit.job,edit.source,env,{fetcher}),finished=await finishImage(result.bytes,source,j),asset_id=randomUUID();
   if(j.pair_id){const pair=await get(`pairs/${j.owner}/${j.pair_id}`);finished.output.normalization_proof=await normalizationProof(await bytes(`assets/${j.owner}/${pair.original.asset_id}`),source);}
   await store.set(`assets/${j.owner}/${asset_id}`,finished.bytes,{onlyIfNew:true});await put(`asset-meta/${j.owner}/${asset_id}`,{...finished.output,asset_id,owner:j.owner,kind:'generated'});
   await put(`${root}/ready`,{status:'READY',output:{...finished.output,asset_id,provider:j.provider,model_key:j.model,model_or_version:result.model,task_parameters_hash:j.task_parameters_hash},provider_request_id:result.request_id,provider_cost:result.actual_cost??null,cost_currency:result.cost_currency??null,provider_parameters:result.parameters,source_placement:finished.output.source_placement,latency_ms:now()-started,completed_at:new Date(now()).toISOString()});
  }catch(e){await put(`${root}/failed`,{status:e.ambiguous?'HELD':'FAILED',error:e.code||(/^[A-Z0-9_]+$/.test(e.message)?e.message:'GENERATION_FAILED'),provider_status:e.status||null,provider_request_id:e.requestId||null,detail:e.detail||'',automatic_paid_retry:false,latency_ms:now()-started});}
 }
 return {handle,work};
}
