// Server-only orchestration. Client preferences and stored plans grant no entitlement.
import {randomUUID} from 'node:crypto';
import {hash,masterExportGeometry,prepareEditInput,finishImage,finishMasterImage,deriveFrameFromMaster,deriveHDFromAccepted} from './images.mjs';
import {modelFor,keyFor} from './contracts.mjs';
import {FREE_MODEL,freeProviderPlan,verifyFreePlanReservation,runFreeProvider} from './free-provider.mjs';
import {enhancementPlan,enhancementPrompt,compositionFromMasterPrompt,masterGeometry} from './enhancement.mjs';
const HASH=/^[a-f0-9]{64}$/,ID=/^[a-zA-Z0-9_-]{8,100}$/;
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const fingerprint=value=>hash(Buffer.from(JSON.stringify(value)));
const bool=(value,fallback=false)=>{if(value===undefined)return fallback;if(typeof value!=='boolean')fail('ENHANCEMENT_PLAN_INVALID');return value;};
export function createEnhancementService({store,get,put,bytes,state,getJob,ownedAsset,env,now,schedule,runProvider,fetcher,policy=null,freeAuthorization=null,accountUsage=null}){
 const planKey=(owner,id)=>`enhancement-plans/${owner}/${id}`;
 async function getPlan(owner,id){if(!HASH.test(id||''))fail('PLAN_UNKNOWN',404);const p=await get(planKey(owner,id));if(!p)fail('PLAN_UNKNOWN',404);return p;}
 async function sourcePair(owner,id){if(!ID.test(id||''))fail('PAIR_UNKNOWN',404);const p=await get(`pairs/${owner}/${id}`);if(!p)fail('PAIR_UNKNOWN',404);if(await get(`deleted-pairs/${owner}/${id}`)||await get(`deleted-sources/${owner}/${p.original?.sha256}`))fail('PAIR_DELETED',409);return p;}
 async function inspect(owner,principal,proposal){
  if(!policy||typeof policy.inspect!=='function'||typeof policy.reserve!=='function'||typeof policy.authorizeCall!=='function')return {available:false,blocked_reason:'ENHANCE_POLICY_NOT_CONFIGURED',policy_version:null,cost:null};
  const result=await policy.inspect({owner,principal,proposal});
  if(!result?.allowed)return {available:false,blocked_reason:result?.reason||'ENHANCE_POLICY_NOT_CONFIGURED',policy_version:result?.policy_version||null,cost:null};
  if(typeof result.policy_version!=='string'||!result.policy_version||result.policy_version.length>100||result.model!==proposal.model||result.tier!==proposal.tier||!Number.isSafeInteger(result.maximum_api_calls)||result.maximum_api_calls<proposal.maximum_api_calls)return {available:false,blocked_reason:'ENHANCE_POLICY_INVALID',policy_version:null,cost:null};
  if(principal.auth_method==='verified-account'&&proposal.tier==='premium'&&result.paid_entitlement_verified!==true)return {available:false,blocked_reason:'PAID_ENTITLEMENT_REQUIRED',policy_version:result.policy_version,cost:null};
  const cost=result.cost??null;if(cost!==null&&(!Number.isFinite(cost.maximum)||cost.maximum<0||typeof cost.currency!=='string'||!/^[A-Z]{3}$/.test(cost.currency)))fail('PLAN_COST_INVALID',503);
  return {available:true,blocked_reason:null,policy_version:result.policy_version,cost};
 }
 async function createPlan(owner,principal,b){
  if(!HASH.test(b.idempotency_key||'')||!HASH.test(b.input_sha256||''))fail('ENHANCEMENT_PLAN_INVALID');
  const pair=await sourcePair(owner,b.pair_id),original=await ownedAsset(owner,pair.original.asset_id),normalized=await ownedAsset(owner,pair.normalized.asset_id);
  if(original.sha256!==b.input_sha256||pair.original.sha256!==original.sha256||normalized.sha256!==pair.normalized.sha256||normalized.kind!=='normalized')fail('INPUT_HASH_MISMATCH',409);
  const model=modelFor(b.model),freeModel=['cloudflare-flux-free',FREE_MODEL].includes(b.model),tier=b.service_tier||b.tier||'free',direction=b.direction??'';
  const options={source:{width:normalized.width,height:normalized.height,sha256:original.sha256},recipe:b.recipe,quality:b.quality||'hd',enhanceOnly:bool(b.enhance_only??b.enhanceOnly),includeHD:bool(b.include_hd??b.includeHD),serviceTier:tier,sameOrientationFit:b.same_orientation_fit||'model'};
  const specification=enhancementPlan(options),review_master=bool(b.review_master),seed=b.seed??0;
  if(!Number.isSafeInteger(seed)||seed<0||seed>2147483647)fail('JOB_INVALID');
  const masterPrompt=enhancementPrompt(b.recipe,direction),framePrompts={};for(const frame of specification.frames)framePrompts[frame.target]=compositionFromMasterPrompt(frame.target,direction)+' Reference 1 is the accepted master and governs scene, pose, outfit and photographic treatment. Reference 2 is the original photograph for likeness only; do not restore its background, pose or clothes.';
  const id=fingerprint([owner,'enhancement-plan',b.idempotency_key]),family_id=id;
  const masterExport=masterExportGeometry(normalized.width,normalized.height,options.quality),masterRequest=masterGeometry(normalized.width,normalized.height,{maxEdge:Math.min(options.quality==='4k'?3840:1920,model?.editMaxEdge||model?.maxEdge||3840),multiple:model?.provider==='openai'?16:1});
  const calls=[{call_id:fingerprint([id,'enhance']),operation:'enhance',model_calls:1,target:normalized.height>normalized.width?'portrait':'landscape',geometry:masterExport,request_geometry:masterRequest},...specification.frames.map(frame=>({call_id:fingerprint([id,frame.target]),operation:frame.operation,model_calls:frame.model_calls,target:frame.target,geometry:frame.geometry,fit:frame.fit}))];
  const proposal={schema:'bd.dualframe.server-plan.v1',plan_id:id,owner,pair_id:pair.pair_id,family_id,source_sha256:original.sha256,normalized_sha256:normalized.sha256,original_asset_id:original.asset_id,normalized_asset_id:normalized.asset_id,model:b.model,provider:freeModel?'cloudflare':model?.provider||null,provider_model:freeModel?FREE_MODEL:model?.model||null,tier,recipe:specification.recipe,recipe_hash:fingerprint(specification.recipe),direction,quality:options.quality,seed,review_master,include_hd:specification.include_hd_copy,same_orientation_fit:options.sameOrientationFit,enhance_only:options.enhanceOnly,calls,maximum_api_calls:specification.maximum_model_calls,geometry:{master:masterExport,master_export:masterExport,master_request:masterRequest,frames:specification.frames.map(f=>({target:f.target,...f.geometry,fit:f.fit}))},effective_prompts:{master:masterPrompt,frames:framePrompts},paid_fallback:false,native_resolution_verified:false};
  let freeBlocked=null;
  if(tier==='free'&&freeModel){
   proposal.geometry.master_request=masterExport;proposal.calls[0].request_geometry=masterExport;
   if(options.quality==='4k')freeBlocked='FREE_4K_UNSUPPORTED';
   else try{proposal.free_plan=freeProviderPlan({plan_id:id,calls:calls.filter(c=>c.model_calls).map(c=>({call_id:c.call_id,width:(c.request_geometry||c.geometry).width,height:(c.request_geometry||c.geometry).height,input_images:c.operation==='enhance'?1:2}))});}catch{freeBlocked='FREE_MASTER_GEOMETRY_UNSUPPORTED';}
  }
  const input_fingerprint=fingerprint(proposal),existing=await get(planKey(owner,id));if(existing){if(existing.input_fingerprint!==input_fingerprint)fail('IDEMPOTENCY_CONFLICT',409);return existing;}
  let authorization=await inspect(owner,principal,proposal);
  // Initial supported enhancement route: full source editing and explicit master geometry.
  if(tier==='free'){
   if(!freeModel)authorization={...authorization,available:false,blocked_reason:'FREE_MODEL_REQUIRED'};
   else if(freeBlocked)authorization={...authorization,available:false,blocked_reason:freeBlocked};
   else if(typeof freeAuthorization!=='function'||!/^[a-f0-9]{32}$/i.test(env('DF_CLOUDFLARE_ACCOUNT_ID')||'')||typeof env('DF_CLOUDFLARE_API_TOKEN')!=='string'||env('DF_CLOUDFLARE_API_TOKEN').length<20)authorization={...authorization,available:false,blocked_reason:'FREE_PROVIDER_NOT_CONFIGURED'};
   else if(authorization.available){const proof=await freeAuthorization({stage:'inspect-plan',owner,account_id:env('DF_CLOUDFLARE_ACCOUNT_ID'),model:FREE_MODEL,plan:proposal.free_plan,enhancement_plan:proposal,now:now()});if(proof?.available!==true||proof.zero_spend_verified!==true||proof.account_plan!=='workers-free'||proof.no_overage_verified!==true||proof.account_usage_verified!==true)authorization={...authorization,available:false,blocked_reason:proof?.blocked_reason||'FREE_ALLOWANCE_UNKNOWN'};}
  }
  else if(!model||model.provider!=='openai'||!model.edit)authorization={...authorization,available:false,blocked_reason:'ENHANCEMENT_MODEL_UNSUPPORTED'};
  else if(!keyFor(model,env))authorization={...authorization,available:false,blocked_reason:'KEY_NOT_CONFIGURED'};
  const immutable={...proposal,input_fingerprint,...authorization,principal:{owner,auth_method:principal.auth_method||'legacy-password',...(principal.issuer?{issuer:principal.issuer,subject:principal.subject}:{})},created_at:new Date(now()).toISOString()},plan={...immutable,fingerprint:fingerprint(immutable)};
  const saved=await put(planKey(owner,id),plan);if(!saved.modified){const current=await get(planKey(owner,id));if(current.input_fingerprint!==input_fingerprint)fail('IDEMPOTENCY_CONFLICT',409);return current;}return plan;
 }
 function validReservation(plan,reservation){
  if(plan.owner!=='bd-research-owner'&&reservation?.byte_quota_reserved!==true)fail('OUTPUT_STORAGE_NOT_RESERVED',503);
  if(!reservation||reservation.verified!==true||reservation.whole_plan_reserved!==true||!ID.test(reservation.reservation_id||'')||reservation.plan_fingerprint!==plan.fingerprint||reservation.policy_version!==plan.policy_version||reservation.maximum_api_calls!==plan.maximum_api_calls||JSON.stringify(reservation.call_ids)!==JSON.stringify(plan.calls.filter(c=>c.model_calls).map(c=>c.call_id)))fail('PLAN_RESERVATION_INVALID',503);
 }
 async function reserve(plan){
  if(!plan.available)fail(plan.blocked_reason||'ENHANCE_POLICY_NOT_CONFIGURED',503);
  const current=await inspect(plan.owner,plan.principal,plan);if(!current.available||current.policy_version!==plan.policy_version)fail(current.blocked_reason||'PLAN_POLICY_CHANGED',409);if(JSON.stringify(current.cost)!==JSON.stringify(plan.cost))fail('PLAN_COST_CHANGED',409);
  if(plan.tier==='free'){if(typeof freeAuthorization!=='function'||!plan.free_plan)fail('FREE_PROVIDER_NOT_CONFIGURED',503);const key=`enhancement-plan-events/${plan.owner}/${plan.plan_id}/free-reserved`;let receipt=await get(key);if(!receipt){receipt=await freeAuthorization({stage:'reserve-plan',owner:plan.owner,account_id:env('DF_CLOUDFLARE_ACCOUNT_ID'),model:FREE_MODEL,plan:plan.free_plan,enhancement_plan:plan,now:now()});const checked=verifyFreePlanReservation(receipt,{accountId:env('DF_CLOUDFLARE_ACCOUNT_ID'),plan:plan.free_plan,now:now()});if(Math.round(checked.remaining_neurons*100)<Math.round(plan.free_plan.maximum_neurons*100))fail('FREE_ALLOWANCE_EXHAUSTED',429);await put(key,receipt);}else verifyFreePlanReservation(receipt,{accountId:env('DF_CLOUDFLARE_ACCOUNT_ID'),plan:plan.free_plan,now:now()});}
  const key=`enhancement-plan-events/${plan.owner}/${plan.plan_id}/reserved`,existing=await get(key);if(existing){validReservation(plan,existing);return existing;}
  const reservation=await policy.reserve({owner:plan.owner,principal:plan.principal,plan,idempotency_key:plan.plan_id,...(plan.tier==='free'?{free_reservation:await get(`enhancement-plan-events/${plan.owner}/${plan.plan_id}/free-reserved`)}:{})});validReservation(plan,reservation);
  await put(key,reservation);const saved=await get(key);validReservation(plan,saved);if(saved.reservation_id!==reservation.reservation_id)fail('PLAN_RESERVATION_CONFLICT',409);return saved;
 }
 function jobFor(plan,call,extra={}){
  const job={operation:call.operation,job_id:call.call_id,owner:plan.owner,enhancement_plan_id:plan.plan_id,plan_fingerprint:plan.fingerprint,policy_version:plan.policy_version,family_id:plan.family_id,pair_id:plan.pair_id,input_sha256:plan.source_sha256,normalized_asset_id:plan.normalized_asset_id,normalized_sha256:plan.normalized_sha256,original_asset_id:plan.original_asset_id,model:plan.tier==='free'?FREE_MODEL:plan.model,model_key:plan.model,...(plan.free_plan?{free_plan:plan.free_plan}:{}),provider:plan.provider,service_tier:plan.tier,recipe:plan.recipe,recipe_hash:plan.recipe_hash,target:call.target,quality:plan.quality,mode:'smart',position:'center',seed:plan.seed,provider_prompt:call.operation==='enhance'?plan.effective_prompts.master:plan.effective_prompts.frames[call.target],prompt:plan.direction,master_geometry:plan.geometry.master,output_geometry:call.geometry,fit:call.fit||null,created_at:new Date(now()).toISOString(),created_ms:now(),status:'PENDING',provider_cost:null,cost_currency:null,...extra};
  return {...job,request_fingerprint:fingerprint({...job,created_at:null,created_ms:null})};
 }
 async function createJob(req,plan,call,extra={}){const job=jobFor(plan,call,extra),key=`jobs/${plan.owner}/${call.call_id}`,created=await put(key,job),saved=await get(key);if(saved.request_fingerprint!==job.request_fingerprint)fail('IDEMPOTENCY_CONFLICT',409);if(created.modified)await schedule(req,saved);return saved;}
 async function enhance(req,owner,b){
  const plan=await getPlan(owner,b.plan_id);if(b.fingerprint!==plan.fingerprint||b.consent_fingerprint!==plan.fingerprint||!HASH.test(b.idempotency_key||''))fail('PLAN_CONSENT_REQUIRED',409);
  await sourcePair(owner,plan.pair_id);await reserve(plan);
  const j=await createJob(req,plan,plan.calls[0]);return {job_id:j.job_id,plan_id:plan.plan_id,family_id:plan.family_id,status:(await state(j)).status};
 }
 async function acceptedMaster(owner,plan,b){
  if(!HASH.test(b.master_sha256||'')||!ID.test(b.master_asset_id||''))fail('MASTER_INVALID');
  const master=await getJob(owner,b.master_job_id),status=await state(master);
  if(master.enhancement_plan_id!==plan.plan_id||master.family_id!==plan.family_id||master.pair_id!==plan.pair_id||master.operation!=='enhance'||master.input_sha256!==plan.source_sha256||status.status!=='ACCEPTED'||status.output?.asset_id!==b.master_asset_id||status.output?.sha256!==b.master_sha256)fail('ACCEPTED_MASTER_REQUIRED',409);
  const asset=await ownedAsset(owner,b.master_asset_id);if(asset.sha256!==b.master_sha256||asset.family_id!==plan.family_id||asset.pair_id!==plan.pair_id||asset.source_sha256!==plan.source_sha256)fail('MASTER_LINEAGE_MISMATCH',409);
  return {master,status,asset};
 }
 async function frames(req,owner,id,b){
  const plan=await getPlan(owner,id);await sourcePair(owner,plan.pair_id);await reserve(plan);await acceptedMaster(owner,plan,b);
  const jobs=[];for(const call of plan.calls.slice(1)){const j=await createJob(req,plan,call,{master_job_id:b.master_job_id,master_asset_id:b.master_asset_id,master_sha256:b.master_sha256});jobs.push({job_id:j.job_id,target:j.target,operation:j.operation,status:(await state(j)).status});}
  return {plan_id:plan.plan_id,family_id:plan.family_id,jobs};
 }
 async function route(req,owner,principal,path,readJSON){
  if(path==='/plans'&&req.method==='POST')return {data:await createPlan(owner,principal,await readJSON(req)),status:200};
  const match=path.match(/^\/plans\/([a-f0-9]{64})(?:\/(frames))?$/);
  if(match&&req.method==='GET'&&!match[2]){const plan=await getPlan(owner,match[1]),reservation=await get(`enhancement-plan-events/${owner}/${plan.plan_id}/reserved`);return {data:{...plan,reserved:!!reservation,jobs:await Promise.all(plan.calls.map(async c=>{const j=await get(`jobs/${owner}/${c.call_id}`);return j?await state(j):{job_id:c.call_id,status:'PLANNED',operation:c.operation,target:c.target};}))}};}
  if(match&&req.method==='POST'&&match[2])return {data:await frames(req,owner,match[1],await readJSON(req)),status:202};
  if(path==='/enhance'&&req.method==='POST')return {data:await enhance(req,owner,await readJSON(req)),status:202};
  return null;
 }
 async function assertAcceptedJobMaster(j,plan){if(j.operation!=='enhance')await acceptedMaster(j.owner,plan,{master_job_id:j.master_job_id,master_asset_id:j.master_asset_id,master_sha256:j.master_sha256});}
 async function work(j){
  const root=`job-events/${j.owner}/${j.job_id}`;if(await get(`${root}/ready`)||await get(`${root}/failed`)||await get(`${root}/cancelled`))return;
  // A single worker owns authorization and submission. Uncertain work is never replayed.
  const claim=await put(`${root}/enhancement-worker`,{at:now(),job_id:j.job_id});if(!claim.modified)return;
  const started=now();let reservation,submitted=false,activePlan;
  try{
   const plan=await getPlan(j.owner,j.enhancement_plan_id);activePlan=plan;if(j.plan_fingerprint!==plan.fingerprint||j.family_id!==plan.family_id||!plan.calls.some(c=>c.call_id===j.job_id))fail('PLAN_JOB_MISMATCH',409);
   await sourcePair(j.owner,j.pair_id);reservation=await reserve(plan);await assertAcceptedJobMaster(j,plan);
   const source=await bytes(`assets/${j.owner}/${j.operation==='enhance'?j.normalized_asset_id:j.master_asset_id}`);if(!source||hash(source)!==(j.operation==='enhance'?j.normalized_sha256:j.master_sha256))fail('SOURCE_ASSET_HASH_MISMATCH',409);
   let result,finished;
   if(j.operation==='derive'){finished=await deriveFrameFromMaster(source,j);result={model:'deterministic-'+j.fit,parameters:{model_calls:0},actual_cost:0,cost_currency:null,request_id:null};}
   else{
    const current=await inspect(j.owner,plan.principal,plan);if(!current.available||current.policy_version!==plan.policy_version)fail(current.blocked_reason||'PLAN_POLICY_CHANGED',409);
    const proof=await policy.authorizeCall({owner:j.owner,principal:plan.principal,plan,job:j,reservation,...(plan.tier==='free'?{free_reservation:await get(`enhancement-plan-events/${plan.owner}/${plan.plan_id}/free-reserved`)}:{})});
    if(proof?.verified!==true||proof.call_claimed!==true||proof.reservation_id!==reservation.reservation_id||proof.plan_fingerprint!==plan.fingerprint||proof.policy_version!==plan.policy_version||proof.call_id!==j.job_id)fail('PLAN_CALL_UNAUTHORIZED',403);
    const locked=await put(`${root}/submitted`,{at:now(),owner:j.owner,job_id:j.job_id,reservation_id:reservation.reservation_id,plan_fingerprint:plan.fingerprint});if(!locked.modified)return;submitted=true;
    const original=j.operation==='enhance'?null:await bytes(`assets/${j.owner}/${j.normalized_asset_id}`);if(original&&hash(original)!==j.normalized_sha256)fail('SOURCE_ASSET_HASH_MISMATCH',409);
    if(j.service_tier==='free'){result=await runFreeProvider(j,original?[source,original]:source,env,{fetcher,now,authorize:request=>freeAuthorization({...request,stage:'authorize-call',owner:j.owner,enhancement_plan:plan,reservation,provider_claim:proof})});}
    else{const prepared=await prepareEditInput(source,{...j,...(original?{_original_reference:original}:{})});result=await runProvider(prepared.job,prepared.source,env,{fetcher});}finished=j.operation==='enhance'?await finishMasterImage(result.bytes,source,j):await finishImage(result.bytes,source,j);
   }
   const asset_id=randomUUID(),meta={...finished.output,asset_id,owner:j.owner,kind:j.operation==='enhance'?j.recipe.kind+'-master':'derived',role:j.operation==='enhance'?j.recipe.kind+'-master':j.target+'-output',pair_id:j.pair_id,family_id:j.family_id,source_sha256:j.input_sha256,parent_asset_ids:[j.operation==='enhance'?j.normalized_asset_id:j.master_asset_id],master_sha256:j.master_sha256||null,recipe:j.recipe,recipe_hash:j.recipe_hash,job_id:j.job_id};
   if(j.owner!=='bd-research-owner')await accountUsage?.authorizePlanAsset({owner:j.owner,plan_id:j.enhancement_plan_id,slot_id:j.job_id,resource_id:`assets/${j.owner}/${asset_id}`,byte_count:finished.bytes.length});
   await store.set(`assets/${j.owner}/${asset_id}`,finished.bytes,{onlyIfNew:true});const saved=await bytes(`assets/${j.owner}/${asset_id}`);if(!saved||saved.length!==meta.byte_size||hash(saved)!==meta.sha256)fail('ASSET_WRITE_UNCONFIRMED',503);await put(`asset-meta/${j.owner}/${asset_id}`,meta);
   await put(`${root}/ready`,{status:'READY',output:meta,provider_request_id:result.request_id||null,provider_cost:result.actual_cost??null,cost_currency:result.cost_currency??null,provider_parameters:result.parameters||{},latency_ms:now()-started,completed_at:new Date(now()).toISOString()});
   if(j.operation==='enhance'&&!plan.review_master)await put(`${root}/accepted`,{at:now(),asset_id,sha256:meta.sha256,family_id:j.family_id,acceptance_basis:'explicit-consented-plan-auto-continuation'});
   if(typeof policy?.settleCall==='function')await policy.settleCall({owner:j.owner,plan,job:j,reservation,result,uncertain:false});
  }catch(e){await put(`${root}/failed`,{status:e.ambiguous||submitted||/POLICY|ENTITLEMENT|QUOTA|ALLOWANCE|PLAN_COST_CHANGED|KILL_SWITCH/.test(e.code||e.message)?'HELD':'FAILED',error:e.code||(/^[A-Z0-9_]+$/.test(e.message)?e.message:'ENHANCEMENT_FAILED'),detail:'',automatic_paid_retry:false,provider_request_id:e.requestId||null,provider_status:e.status||null,latency_ms:now()-started,reservation_released:false});if(typeof policy?.settleCall==='function'&&activePlan&&reservation)await policy.settleCall({owner:j.owner,plan:activePlan,job:j,reservation,error:e.code||e.message,uncertain:submitted}).catch(()=>{});}
 }
 async function onAccept(j,s){
  if(!j.enhancement_plan_id||j.operation==='enhance'||j.quality!=='4k')return;
  const plan=await getPlan(j.owner,j.enhancement_plan_id);if(!plan.include_hd)return;const root=`job-events/${j.owner}/${j.job_id}`;if(await get(`${root}/hd-copy`))return;
  const parent=await ownedAsset(j.owner,s.output.asset_id),data=await bytes(`assets/${j.owner}/${parent.asset_id}`),derived=await deriveHDFromAccepted(data,{...parent,acceptance:'ACCEPTED'},j),asset_id=fingerprint([j.owner,j.job_id,'hd-copy',parent.sha256]);
  const meta={...derived.output,asset_id,owner:j.owner,kind:'hd-derivative',role:'hd-derivative',pair_id:j.pair_id,family_id:j.family_id,source_sha256:j.input_sha256,parent_asset_ids:[parent.asset_id],master_sha256:j.master_sha256,acceptance:'ACCEPTED',job_id:j.job_id};if(j.owner!=='bd-research-owner')await accountUsage?.authorizePlanAsset({owner:j.owner,plan_id:j.enhancement_plan_id,slot_id:j.job_id+':hd',resource_id:`assets/${j.owner}/${asset_id}`,byte_count:derived.bytes.length});await store.set(`assets/${j.owner}/${asset_id}`,derived.bytes,{onlyIfNew:true});const saved=await bytes(`assets/${j.owner}/${asset_id}`);if(!saved||hash(saved)!==meta.sha256)fail('ASSET_WRITE_UNCONFIRMED',503);await put(`asset-meta/${j.owner}/${asset_id}`,meta);await put(`${root}/hd-copy`,meta);
 }
 return {route,work,onAccept};
}
