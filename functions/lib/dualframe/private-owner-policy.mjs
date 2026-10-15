// Private password-owner authorization only. No public entitlement or admin rights.
// Immutable admission slots and receipts use onlyIfNew; no Blob counters, mutable
// balances, expiring locks or automatic reclamation of uncertain paid work.
import {createHash} from 'node:crypto';
import {modelFor,keyFor} from './contracts.mjs';
const OWNER='bd-research-owner',VERSION='private-owner-click-v1',HASH=/^[a-f0-9]{64}$/;
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=(code,status=409)=>{throw Object.assign(Error(code),{code,status});};
export const isPrivateOwner=(owner,principal)=>owner===OWNER&&principal?.owner===OWNER&&principal?.auth_method==='legacy-password';
export function createPrivateOwnerPolicy({store,env,now=()=>Date.now()}){
 const prefix='private-owner-policy/v1/',get=key=>store.get(prefix+key,{type:'json',consistency:'strong'});
 async function once(key,value){const r=await store.setJSON(prefix+key,value,{onlyIfNew:true});if(typeof r?.modified!=='boolean')fail('OWNER_STORAGE_VERSION_UNSUPPORTED',503);const saved=await get(key);if(!saved)fail('OWNER_RECEIPT_UNCONFIRMED',503);return {created:r.modified,value:saved};}
 async function keys(prefixPart){let cursor;const out=[];do{const page=await store.list({prefix:prefix+prefixPart,...(cursor?{cursor}:{})});for(const b of page.blobs||[])out.push(b.key.slice(prefix.length));const next=page.cursor||page.next_cursor||page.nextCursor;if(next===cursor&&next)fail('OWNER_LEDGER_LIST_INCOMPLETE',503);if(page.has_more&&!next)fail('OWNER_LEDGER_LIST_INCOMPLETE',503);cursor=next;}while(cursor);return out;}
 async function inspect({owner,principal,proposal}){
  const reply={policy_version:VERSION,model:proposal.model,tier:proposal.tier,maximum_api_calls:proposal.maximum_api_calls,cost:null,paid_entitlement_verified:false};
  const deny=reason=>({...reply,allowed:false,reason});
  if(!isPrivateOwner(owner,principal))return deny('PRIVATE_OWNER_SESSION_REQUIRED');
  if(env('DF_PRIVATE_OWNER_ENHANCE_DISABLED')==='true')return deny('ENHANCE_KILL_SWITCH');
  if(proposal.tier!=='premium')return deny('FREE_PROVIDER_NOT_CONFIGURED');
  const model=modelFor(proposal.model);
  if(!model?.edit||model.provider!=='openai')return deny('ENHANCEMENT_MODEL_UNSUPPORTED');
  if(!keyFor(model,env))return deny('KEY_NOT_CONFIGURED');
  if(!HASH.test(proposal.plan_id||'')||!Array.isArray(proposal.calls)||proposal.calls.length>3||!['hd','4k'].includes(proposal.quality)||!Number.isInteger(proposal.maximum_api_calls)||proposal.maximum_api_calls<1||proposal.maximum_api_calls>3||proposal.calls.some(c=>!HASH.test(c.call_id||'')||![0,1].includes(c.model_calls)||!['enhance','expand','derive'].includes(c.operation))||proposal.calls.reduce((n,c)=>n+c.model_calls,0)!==proposal.maximum_api_calls||new Set(proposal.calls.map(c=>c.call_id)).size!==proposal.calls.length)return deny('OWNER_PLAN_INVALID');
  return {...reply,allowed:true,authorization_basis:'signed-private-password-owner-explicit-click'};
 }
 async function guard(input){const r=await inspect({owner:input.owner,principal:input.principal,proposal:input.plan});if(!r.allowed)fail(r.reason,403);if(input.plan.policy_version!==VERSION||!HASH.test(input.plan.fingerprint||''))fail('PLAN_POLICY_CHANGED');}
 function matches(value,plan){if(value.plan_id!==plan.plan_id||value.plan_fingerprint!==plan.fingerprint)fail('OWNER_RESERVATION_CONFLICT');return value;}
 async function activeSlot(plan){
  for(let slot=0;slot<2;slot++){
   const listed=await keys(`active/${slot}/`),generations=listed.filter(k=>/^active\/\d+\/\d+$/.test(k)).map(k=>Number(k.split('/')[2]));
   if(generations.length>10000)fail('OWNER_LEDGER_MAINTENANCE_REQUIRED',503);
   const last=generations.length?Math.max(...generations):-1,oldKey=`active/${slot}/${last}`,old=last<0?null:await get(oldKey),closed=old&&await get(oldKey+'/closed');
   if(old?.plan_id===plan.plan_id){matches(old,plan);return oldKey;}
   if(old&&!closed)continue;
   if(closed&&(closed.plan_fingerprint!==old.plan_fingerprint||closed.plan_id!==old.plan_id))fail('OWNER_RECEIPT_UNCONFIRMED',503);
   const key=`active/${slot}/${last+1}`,r=await once(key,{plan_id:plan.plan_id,plan_fingerprint:plan.fingerprint,at:now()});
   if(r.value.plan_id===plan.plan_id){matches(r.value,plan);return key;}
  }
  fail('OWNER_ACTIVE_PLANS_HELD',429);
 }
 async function reserve(input){
  await guard(input);const plan=input.plan,key=`reservations/${plan.plan_id}`,old=await get(key);if(old)return matches(old,plan);
  // At most two new plans/minute, each frozen to <=3 calls. These are
  // anti-double-click/admission bounds, not a provider allowance or price quote.
  const minute=Math.floor(now()/60000);let admitted=false;
  for(let slot=0;slot<2;slot++){const r=await once(`admission/${minute}/${slot}`,{plan_id:plan.plan_id,plan_fingerprint:plan.fingerprint,at:now()});if(r.value.plan_id===plan.plan_id){matches(r.value,plan);admitted=true;break;}}
  if(!admitted)fail('OWNER_RATE_LIMITED',429);
  const active_slot=await activeSlot(plan),receipt={owner:OWNER,plan_id:plan.plan_id,verified:true,whole_plan_reserved:true,reservation_id:'owner_'+plan.plan_id,plan_fingerprint:plan.fingerprint,policy_version:VERSION,maximum_api_calls:plan.maximum_api_calls,call_ids:plan.calls.filter(c=>c.model_calls).map(c=>c.call_id),active_slot,at:now(),cost:null,automatic_paid_retry:false};
  return matches((await once(key,receipt)).value,plan);
 }
 async function authorizeCall(input){
  await guard(input);const {plan,job,reservation}=input,stored=await get(`reservations/${plan.plan_id}`);if(!stored||JSON.stringify(stored)!==JSON.stringify(reservation))fail('OWNER_RESERVATION_REQUIRED',403);matches(stored,plan);
  const call=plan.calls.find(c=>c.call_id===job.job_id&&c.model_calls===1);if(!call||job.owner!==OWNER||job.model!==plan.model||job.operation!==call.operation||job.plan_fingerprint!==plan.fingerprint||job.provider_prompt!==(call.operation==='enhance'?plan.effective_prompts.master:plan.effective_prompts.frames[call.target])||await get(stored.active_slot+'/closed'))fail('OWNER_CALL_PLAN_MISMATCH',403);
  const proof={verified:true,call_claimed:true,reservation_id:stored.reservation_id,plan_fingerprint:plan.fingerprint,policy_version:VERSION,call_id:job.job_id,owner:OWNER,at:now()};
  if(!(await once(`calls/${plan.plan_id}/${job.job_id}/claimed`,proof)).created)fail('OWNER_CALL_ALREADY_CLAIMED');
  return proof;
 }
 async function settleCall({owner,plan,job,reservation,result,uncertain,error}){
  if(owner!==OWNER||!plan.calls.some(c=>c.call_id===job.job_id&&c.model_calls))return;
  const saved=await get(`reservations/${plan.plan_id}`);if(!saved||saved.reservation_id!==reservation?.reservation_id)fail('OWNER_RESERVATION_REQUIRED',403);matches(saved,plan);
  const state=uncertain?'uncertain':result?'complete':'not-submitted';
  await once(`calls/${plan.plan_id}/${job.job_id}/settled`,{plan_id:plan.plan_id,call_id:job.job_id,state,actual_cost:Number.isFinite(result?.actual_cost)?result.actual_cost:null,currency:result?.cost_currency||null,error:error||null,at:now(),automatic_paid_retry:false});
  const all=await Promise.all(saved.call_ids.map(id=>get(`calls/${plan.plan_id}/${id}/settled`)));
  if(all.every(r=>r?.state==='complete'))await once(saved.active_slot+'/closed',{plan_id:plan.plan_id,plan_fingerprint:plan.fingerprint,receipt_hash:digest(all),at:now()});
 }
 return {configurationStatus:{configured:true,status:'PRIVATE_OWNER_PASSWORD_READY',maximum_active_plans:2,maximum_new_plans_per_minute:2,maximum_calls_per_plan:3,price_verified:false},inspect,reserve,authorizeCall,settleCall};
}
export function routeOwnerPolicy(privatePolicy,publicPolicy){
 const select=input=>isPrivateOwner(input.owner,input.principal||input.plan?.principal)?privatePolicy:publicPolicy;
 return {configurationStatus:privatePolicy.configurationStatus,
  inspect:input=>select(input)?.inspect(input)||{allowed:false,reason:'ENHANCE_POLICY_NOT_CONFIGURED'},
  reserve:input=>{const p=select(input);if(!p)fail('ENHANCE_POLICY_NOT_CONFIGURED',503);return p.reserve(input);},
  authorizeCall:input=>{const p=select(input);if(!p)fail('ENHANCE_POLICY_NOT_CONFIGURED',503);return p.authorizeCall(input);},
  settleCall:input=>select(input)?.settleCall?.(input)
 };
}
