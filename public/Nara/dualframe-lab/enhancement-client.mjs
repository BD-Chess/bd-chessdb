import {sha256,headerSize} from './core.mjs?v=3.0-r4.11';

const HASH=/^[a-f0-9]{64}$/,ID=/^[a-zA-Z0-9_-]{8,100}$/;
const copy=value=>structuredClone(value);
const fail=code=>{throw Error(code);};
const jobPath=id=>'/jobs/'+encodeURIComponent(id);
const planPath=id=>'/plans/'+encodeURIComponent(id);
const itemKey=value=>value.asset_id||[value.family_id,value.job_id||value.candidate_id,value.sha256].join(':');
function retain(items=[],value){const key=itemKey(value),index=items.findIndex(item=>itemKey(item)===key);return index<0?[...items,value]:items.map((item,i)=>i===index?{...item,...value}:item);}
function familyIn(pair,id){return (pair.enhancement_families||[]).find(family=>family.plan_id===id||family.attempt_id===id);}

// The captured store facade belongs to one verified account epoch. No task uses
// global storage after an await, and no uncertain paid request is posted again.
export function createEnhancementClient({api,store,onChange=()=>{},signal}={}){
 if(!api?.request||!api.awaitJob||!api.asset||!api.uploadPair||!store?.getPair||!store.updatePair||!store.getStoredBlob)fail('ENHANCEMENT_CLIENT_INVALID');
 const running=new Map();
 const check=()=>{if(signal?.aborted)fail('CANCELLED');};
 async function call(path,options={}){check();const result=await api.request(path,{...options,signal});check();return result;}
 async function pairFor(id){check();const pair=await store.getPair(id);check();if(!pair?.original||!HASH.test(pair.original.sha256||''))fail('PAIR_UNKNOWN');return pair;}
 async function notify(pair,id){try{await onChange(copy(familyIn(pair,id)),pair);}catch{/* A presentation callback cannot authorize or replay provider work. */}}
 async function update(id,familyId,change,editPair=value=>value){
  check();let updated;
  await store.updatePair(id,pair=>{
   if(!pair)fail('PAIR_UNKNOWN');
   const family=familyIn(pair,familyId);if(!family)fail('ENHANCEMENT_FAMILY_UNKNOWN');
   const next=typeof change==='function'?change(family):{...family,...change};
   updated=editPair({...pair,enhancement_families:(pair.enhancement_families||[]).map(item=>item===family?next:item)},next);
   return updated;
  });check();await notify(updated,familyId);return familyIn(updated,familyId);
 }
 async function familyFor(id,planId){const pair=await pairFor(id),family=familyIn(pair,planId);if(!family?.plan)fail('ENHANCEMENT_FAMILY_UNKNOWN');validatePlan(pair,family.plan);return {pair,family};}
 function validatePlan(pair,plan){
  if(!HASH.test(plan?.plan_id||'')||!HASH.test(plan.fingerprint||'')||!HASH.test(plan.family_id||'')||plan.source_sha256!==pair.original.sha256||plan.pair_id!==pair.upload_id||!Array.isArray(plan.calls)||plan.calls[0]?.operation!=='enhance'||plan.calls.some(call=>!HASH.test(call.call_id||'')))fail('ENHANCEMENT_PLAN_MISMATCH');
 }
 async function keepError(id,planId,error){
  if(error.message==='STORAGE_OWNER_CHANGED'||signal?.aborted)throw error;
  await update(id,planId,family=>({...family,status:'HELD',error:error.message,automatic_paid_retry:false}));throw error;
 }
 function exclusive(id,action){const old=running.get(id)||Promise.resolve(),result=old.catch(()=>{}).then(action);running.set(id,result);return result.finally(()=>{if(running.get(id)===result)running.delete(id);});}
 async function verifiedBlob(meta){
  if(!ID.test(meta?.asset_id||'')||!HASH.test(meta.sha256||'')||!Number.isSafeInteger(meta.byte_size)||meta.byte_size<1||meta.byte_size>75*1024*1024||!Number.isSafeInteger(meta.width)||!Number.isSafeInteger(meta.height)||meta.width<1||meta.height<1||!/^image\/(png|jpeg|webp)$/.test(meta.mime||''))fail('OUTPUT_METADATA_INVALID');
  check();const blob=await api.asset(meta.asset_id);check();
  if(!(blob instanceof Blob)||blob.size!==meta.byte_size)fail('OUTPUT_SIZE_MISMATCH');
  if(blob.type!==meta.mime)fail('OUTPUT_MIME_MISMATCH');
  const bytes=await blob.arrayBuffer();if(await sha256(bytes)!==meta.sha256)fail('OUTPUT_HASH_MISMATCH');
  const observed=headerSize(bytes);if(observed.width!==meta.width||observed.height!==meta.height||observed.mime!==meta.mime)fail('OUTPUT_DIMENSION_MISMATCH');check();return blob;
 }
 function validateState(plan,state,call){
  if(state?.job_id!==call.call_id||state.enhancement_plan_id!==plan.plan_id||state.family_id!==plan.family_id||state.pair_id!==plan.pair_id||state.input_sha256!==plan.source_sha256||state.operation!==call.operation)fail('ENHANCEMENT_JOB_MISMATCH');
  if(state.output&&(state.output.family_id!==plan.family_id||state.output.pair_id!==plan.pair_id||state.output.source_sha256!==plan.source_sha256))fail('OUTPUT_LINEAGE_MISMATCH');
 }
 async function settled(plan,call,state){
  if(!state||['PLANNED','PENDING','RUNNING'].includes(state.status)){
   check();state=await api.awaitJob(call.call_id,{signal});check();
  }
  validateState(plan,state,call);return state;
 }
 function assetFrom(plan,state,blob,extra={}){
  return {...state.output,blob,job_id:state.job_id,candidate_id:state.job_id,enhancement_plan_id:plan.plan_id,family_id:plan.family_id,source_sha256:plan.source_sha256,recipe:plan.recipe,recipe_hash:plan.recipe_hash,direction:state.target,quality:plan.quality,provider:state.provider||plan.provider,model_key:state.model||plan.model,mode:plan.recipe?.kind||'natural',origin:'generated',acceptance:state.status,path:`enhancement/${plan.family_id}/${state.output.sha256}.png`,provenance_verified:true,provenance_basis:'authenticated-gateway-hash-verified',provider_cost:state.provider_cost??null,cost_currency:state.cost_currency??null,...extra};
 }
 async function persistMaster(id,plan,state){
  validateState(plan,state,plan.calls[0]);
  if(!['READY','ACCEPTED'].includes(state.status))fail(state.error||state.status||'MASTER_NOT_READY');
  const {family}=await familyFor(id,plan.plan_id);let asset=family.master;
  if(asset){
   if(asset.asset_id!==state.output?.asset_id||asset.sha256!==state.output?.sha256)fail('MASTER_RECEIPT_CHANGED');
   const blob=await store.getStoredBlob(asset.blob);check();if(!(blob instanceof Blob)||await sha256(blob)!==asset.sha256)fail('MASTER_LOCAL_HASH_MISMATCH');
   asset={...asset,acceptance:state.status};
  }else asset=assetFrom(plan,state,await verifiedBlob(state.output),{family_stage:'master',role:plan.recipe.kind+'-master'});
  return update(id,plan.plan_id,f=>({...f,status:state.status==='READY'?'MASTER_READY':'MASTER_ACCEPTED',master_job_id:state.job_id,master:asset,error:null}),
   (pair)=>({...pair,masters:retain(pair.masters,asset),jobs:retainJobs(pair.jobs,{...state,candidate:asset,result_sha256:asset.sha256})}));
 }
 function retainJobs(jobs=[],job){const found=jobs.findIndex(value=>value.job_id===job.job_id);return found<0?[...jobs,job]:jobs.map((value,i)=>i===found?{...value,...job}:value);}
 async function persistFrame(id,plan,call,state){
  validateState(plan,state,call);if(!['READY','ACCEPTED'].includes(state.status))fail(state.error||state.status||'FRAME_NOT_READY');
  const {family}=await familyFor(id,plan.plan_id),master=family.master;
  if(!master||master.acceptance!=='ACCEPTED'||state.master_sha256!==master.sha256||state.master_asset_id!==master.asset_id||state.master_job_id!==family.master_job_id||state.output?.master_sha256!==master.sha256)fail('FRAME_MASTER_LINEAGE_MISMATCH');
  const existing=(await pairFor(id)).candidates?.find(asset=>asset.asset_id===state.output.asset_id);let asset;
  if(existing){const blob=await store.getStoredBlob(existing.blob);check();if(await sha256(blob)!==state.output.sha256)fail('OUTPUT_HASH_MISMATCH');asset={...existing,acceptance:state.status};}
  else asset=assetFrom(plan,state,await verifiedBlob(state.output),{family_stage:'frame',master_sha256:master.sha256,master_asset_id:master.asset_id,acceptance:state.status,mode:'smart'});
  await update(id,plan.plan_id,f=>({...f,status:'FRAMES_PENDING',frame_jobs:retainJobs(f.frame_jobs,{job_id:state.job_id,target:call.target,operation:call.operation,status:state.status}),error:null}),pair=>{
   const next={...pair,candidates:retain(pair.candidates,asset),jobs:retainJobs(pair.jobs,{...state,candidate:asset,result_sha256:asset.sha256})};
   if(state.status==='ACCEPTED'){
    const slot=plan.quality==='4k'?'fourK':'hd',previous=pair.variants?.[call.target]?.[slot];
    if(previous)next.candidates=retain(next.candidates,previous);
    next.variants={...pair.variants,[call.target]:{...pair.variants?.[call.target],[slot]:asset}};
   }
   return next;
  });return asset;
 }
 async function persistHD(id,plan,call,state){
  const meta=state.hd_copy;if(!meta)return;
  if(plan.quality!=='4k'||!plan.include_hd||meta.family_id!==plan.family_id||meta.source_sha256!==plan.source_sha256||meta.pair_id!==plan.pair_id||meta.master_sha256!==state.master_sha256||meta.parent_sha256!==state.output.sha256||meta.parent_asset_id!==state.output.asset_id||!meta.parent_asset_ids?.includes(state.output.asset_id)||meta.model_calls!==0)fail('HD_PARENT_LINEAGE_MISMATCH');
  const existing=(await pairFor(id)).candidates?.find(asset=>asset.asset_id===meta.asset_id);
  if(existing){const blob=await store.getStoredBlob(existing.blob);check();if(await sha256(blob)!==meta.sha256)fail('OUTPUT_HASH_MISMATCH');return;}
  const asset={...assetFrom(plan,{...state,output:meta},await verifiedBlob(meta)),quality:'hd',direction:call.target,acceptance:'ACCEPTED',role:'hd-derivative',family_stage:'hd-copy',mode:'smart'};
  await update(id,plan.plan_id,f=>f,pair=>{const previous=pair.variants?.[call.target]?.hd;return {...pair,candidates:retain(previous?retain(pair.candidates,previous):pair.candidates,asset),variants:{...pair.variants,[call.target]:{...pair.variants?.[call.target],hd:asset}},jobs:retainJobs(pair.jobs,{...state,hd_copy:asset})};});
 }
 async function finishFrames(id,plan){
  const {family}=await familyFor(id,plan.plan_id),master=family.master;if(!master||master.acceptance!=='ACCEPTED')fail('ACCEPTED_MASTER_REQUIRED');
  // Re-read and hash the durable bytes before authorizing any dependent job.
  const blob=await store.getStoredBlob(master.blob);check();if(!(blob instanceof Blob)||await sha256(blob)!==master.sha256)fail('MASTER_LOCAL_HASH_MISMATCH');
  if(plan.calls.length===1)return update(id,plan.plan_id,{status:'COMPLETE',error:null});
  const receipt=await call(planPath(plan.plan_id)+'/frames',{method:'POST',body:{master_job_id:family.master_job_id,master_asset_id:master.asset_id,master_sha256:master.sha256}});
  if(receipt.plan_id!==plan.plan_id||receipt.family_id!==plan.family_id||!Array.isArray(receipt.jobs)||receipt.jobs.length!==plan.calls.length-1||receipt.jobs.some(job=>!plan.calls.slice(1).some(call=>call.call_id===job.job_id&&call.target===job.target&&call.operation===job.operation)))fail('FRAME_RECEIPT_MISMATCH');
  await update(id,plan.plan_id,{status:'FRAMES_PENDING',frame_jobs:receipt.jobs,error:null});
  for(const frameCall of plan.calls.slice(1)){
   let state=await settled(plan,frameCall,await call(jobPath(frameCall.call_id)));await persistFrame(id,plan,frameCall,state);
   if(state.status==='READY'){
    // Candidate bytes and lineage are already committed. Acceptance can now
    // publish the saved frame and optionally make a deterministic HD copy.
    await call(jobPath(state.job_id)+'/accept',{method:'POST',body:{}});
    state=await call(jobPath(state.job_id));validateState(plan,state,frameCall);
    if(state.status!=='ACCEPTED')fail('FRAME_ACCEPTANCE_UNCONFIRMED');await persistFrame(id,plan,frameCall,state);
   }
   await persistHD(id,plan,frameCall,state);
  }
  return update(id,plan.plan_id,{status:'COMPLETE',error:null});
 }
 async function readPlan(id,planId){
  const {family}=await familyFor(id,planId),remote=await call(planPath(planId));validatePlan(await pairFor(id),remote);
  if(remote.fingerprint!==family.plan.fingerprint)fail('ENHANCEMENT_PLAN_CHANGED');return remote;
 }
 async function resumeInternal(id,planId){
  const plan=await readPlan(id,planId),masterCall=plan.calls[0],remote=plan.jobs?.find(job=>job.job_id===masterCall.call_id);
  if(!remote||remote.status==='PLANNED')return update(id,planId,f=>({...f,status:f.submit_intent?'HELD':'PLANNED',error:f.submit_intent?'MASTER_SUBMISSION_NOT_CONFIRMED':null}));
  if(remote.status==='REJECTED')return update(id,planId,{status:'REJECTED',error:null});
  // A lost POST response is recovered through the same server job. Commit that
  // receipt before waiting for a running job, exactly as for the original POST.
  await update(id,planId,{master_job_id:remote.job_id,recovered_master_receipt:{job_id:remote.job_id,source:'GET /plans',status:remote.status}});
  const state=await settled(plan,masterCall,remote);const family=await persistMaster(id,plan,state);
  if(state.status==='READY')return family;
  return finishFrames(id,plan);
 }
 async function plan(id,options={}){return exclusive(id,async()=>{
  let pair=await pairFor(id);const attempt_id=await sha256(crypto.randomUUID()),requestOptions={recipe:copy(options.recipe),direction:options.direction??'',model:options.model,service_tier:options.service_tier??options.tier??'free',quality:options.quality??'hd',seed:options.seed??0,enhance_only:options.enhance_only??false,include_hd:options.include_hd??false,same_orientation_fit:options.same_orientation_fit??'model',review_master:options.review_master??false};
  await store.updatePair(id,current=>{if(!current||current.original.sha256!==pair.original.sha256)fail('INPUT_HASH_MISMATCH');return {...current,enhancement_families:[...(current.enhancement_families||[]),{attempt_id,status:'PLANNING',plan_request:requestOptions,created_at:new Date().toISOString()}]};});
  try{
   if(!pair.upload_id||pair.gateway_version!=='v3'){
    const raw=await store.getStoredBlob(pair.original.blob),normalized=await store.getStoredBlob(pair.original.normalized);check();
    if(!(raw instanceof Blob)||!(normalized instanceof Blob)||await sha256(raw)!==pair.original.sha256)fail('INPUT_HASH_MISMATCH');
    const uploaded=await api.uploadPair({pair_id:pair.pair_id,original:{...pair.original,blob:raw,normalized},variants:{landscape:{},portrait:{}},jobs:[]});check();
    if(!ID.test(uploaded?.pair_id||'')||uploaded.original?.sha256!==pair.original.sha256)fail('INPUT_HASH_MISMATCH');
    await store.updatePair(id,current=>{if(!current||current.original.sha256!==pair.original.sha256)fail('INPUT_HASH_MISMATCH');return {...current,upload_id:uploaded.pair_id,gateway_version:'v3'};});pair=await pairFor(id);
   }
   const result=await call('/plans',{method:'POST',body:{...requestOptions,pair_id:pair.upload_id,input_sha256:pair.original.sha256,idempotency_key:attempt_id}});validatePlan(pair,result);
   await update(id,attempt_id,f=>({...f,plan_id:result.plan_id,family_id:result.family_id,plan:copy(result),status:result.available?'PLANNED':'BLOCKED',error:result.blocked_reason||null}));return result;
  }catch(error){return keepError(id,attempt_id,error);}
 });}
 async function start(id,input){const planId=typeof input==='string'?input:input?.plan_id;return exclusive(id,async()=>{
  try{
   const {family}=await familyFor(id,planId),plan=family.plan;if(typeof input==='object'&&input.fingerprint!==plan.fingerprint)fail('PLAN_CONSENT_REQUIRED');
   if(!plan.available)fail(plan.blocked_reason||'ENHANCE_POLICY_NOT_CONFIGURED');
   if(family.submit_intent)return await resumeInternal(id,planId);
   const idempotency_key=await sha256(crypto.randomUUID());
   await update(id,planId,{submit_intent:{idempotency_key,consent_fingerprint:plan.fingerprint,at:new Date().toISOString()},status:'MASTER_SUBMITTING',error:null,automatic_paid_retry:false});
   const receipt=await call('/enhance',{method:'POST',body:{plan_id:planId,fingerprint:plan.fingerprint,consent_fingerprint:plan.fingerprint,idempotency_key}});
   if(receipt.job_id!==plan.calls[0].call_id||receipt.plan_id!==planId||receipt.family_id!==plan.family_id)fail('MASTER_RECEIPT_MISMATCH');
   await update(id,planId,{master_job_id:receipt.job_id,master_receipt:copy(receipt),status:'MASTER_PENDING'});
   const state=await settled(plan,plan.calls[0]);const saved=await persistMaster(id,plan,state);
   return state.status==='ACCEPTED'?await finishFrames(id,plan):saved;
  }catch(error){return keepError(id,planId,error);}
 });}
 async function resume(id,planId){return exclusive(id,async()=>{try{return await resumeInternal(id,planId);}catch(error){return keepError(id,planId,error);}});}
 async function acceptMaster(id,planId){return exclusive(id,async()=>{
  try{
   const plan=await readPlan(id,planId),state=await call(jobPath(plan.calls[0].call_id));validateState(plan,state,plan.calls[0]);
   if(!['READY','ACCEPTED'].includes(state.status))fail('MASTER_NOT_READY');await persistMaster(id,plan,state);
   if(state.status==='READY')await call(jobPath(state.job_id)+'/accept',{method:'POST',body:{}});
   const accepted=await call(jobPath(state.job_id));validateState(plan,accepted,plan.calls[0]);if(accepted.status!=='ACCEPTED')fail('MASTER_ACCEPTANCE_UNCONFIRMED');
   await persistMaster(id,plan,accepted);return await finishFrames(id,plan);
  }catch(error){return keepError(id,planId,error);}
 });}
 async function rejectMaster(id,planId){return exclusive(id,async()=>{
  try{
   const plan=await readPlan(id,planId),state=await call(jobPath(plan.calls[0].call_id));validateState(plan,state,plan.calls[0]);
   if(state.status==='ACCEPTED')fail('MASTER_ALREADY_ACCEPTED');if(state.status!=='READY'&&state.status!=='REJECTED')fail('MASTER_NOT_READY');
   if(state.status==='READY'){await persistMaster(id,plan,state);await call(jobPath(state.job_id)+'/reject',{method:'POST',body:{}});}
   const rejected=await call(jobPath(state.job_id));validateState(plan,rejected,plan.calls[0]);if(rejected.status!=='REJECTED')fail('MASTER_REJECTION_UNCONFIRMED');
   return update(id,planId,f=>({...f,status:'REJECTED',error:null,master:f.master?{...f.master,acceptance:'REJECTED'}:f.master}),pair=>({...pair,masters:(pair.masters||[]).map(master=>master.family_id===plan.family_id?{...master,acceptance:'REJECTED'}:master),jobs:retainJobs(pair.jobs,{...rejected,candidate:undefined})}));
  }catch(error){return keepError(id,planId,error);}
 });}
 return Object.freeze({plan,start,resume,acceptMaster,rejectMaster});
}
