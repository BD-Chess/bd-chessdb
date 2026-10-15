// Transactional PostgreSQL adapter. No initialization/provisioning on import.
// Netlify Blobs is deliberately not used for transactional counters or budgets.
import {createHash} from 'node:crypto';
import {validateOperatorPolicy} from './enhancement-policy.mjs';
const SCHEMA='bd.dualframe.transactional-ledger.v1',KEY='dualframe-operator-v1';
const HASH=/^[a-f0-9]{64}$/,OWNER=/^[A-Za-z0-9_-]{8,100}$/;
const fail=(code,status=409)=>{throw Object.assign(Error(code),{code,status});};
const sha=value=>createHash('sha256').update(value).digest('hex');
const day=time=>new Date(time).toISOString().slice(0,10);
const clone=value=>structuredClone(value);
const add=(a,b)=>{const result=a+b;if(!Number.isSafeInteger(result)||result<0)fail('LEDGER_LIMIT_OVERFLOW',503);return result;};
const minor=value=>{if(typeof value!=='number'||!Number.isFinite(value)||value<0||!Number.isSafeInteger(Math.round(value*100))||Math.abs(value*100-Math.round(value*100))>1e-7)fail('COST_MINOR_UNITS_INVALID');return Math.round(value*100);};
const safeError=e=>e?.code==='42P01'?Object.assign(Error('LEDGER_SCHEMA_NOT_CONFIGURED'),{code:'LEDGER_SCHEMA_NOT_CONFIGURED',status:503}):/^[A-Z_]+$/.test(e?.message||'')?e:Object.assign(Error('LEDGER_TRANSACTION_FAILED'),{code:'LEDGER_TRANSACTION_FAILED',status:503});
export function createEnhancementLedger({pool=null,quotePlan=null,verifyZeroSpend=null,now=()=>Date.now(),maxRetries=4,maxBytes=1024*1024,maxReservations=5000}={}){
 if(!Number.isSafeInteger(maxRetries)||maxRetries<1||maxRetries>10||!Number.isSafeInteger(maxBytes)||maxBytes<1024||!Number.isSafeInteger(maxReservations)||maxReservations<1)fail('LEDGER_CONFIGURATION_INVALID',503);
 const ready=typeof pool?.connect==='function'&&typeof pool?.query==='function';
 function requirePool(){if(!ready)fail('LEDGER_DATABASE_NOT_CONFIGURED',503);}
 function decode(value){let body=value;if(typeof body==='string')try{body=JSON.parse(body);}catch{fail('LEDGER_CORRUPT',503);}if(!body||body.schema!==SCHEMA||!body.reservations||typeof body.reservations!=='object'||Array.isArray(body.reservations))fail('LEDGER_CORRUPT',503);return clone(body);}
 async function transaction(action){
  requirePool();for(let attempt=0;attempt<maxRetries;attempt++){
   let client;try{
    client=await pool.connect();await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    const locked=await client.query('SELECT body, revision FROM dualframe_operator_ledger WHERE ledger_id = $1 FOR UPDATE',[KEY]);
    const row=locked.rows[0],body=row?decode(row.body):{schema:SCHEMA,policy:null,audit:null,reservations:{}};
    const outcome=await action(body);if(outcome.write){
     const serialized=JSON.stringify(body);if(Buffer.byteLength(serialized)>maxBytes||Object.keys(body.reservations).length>maxReservations)fail('LEDGER_CAPACITY_EXHAUSTED',503);
     const written=row?await client.query('UPDATE dualframe_operator_ledger SET body = $1::jsonb, revision = revision + 1, updated_at = now() WHERE ledger_id = $2 AND revision = $3 RETURNING revision',[serialized,KEY,row.revision]):await client.query('INSERT INTO dualframe_operator_ledger (ledger_id, body, revision) VALUES ($1, $2::jsonb, 1) ON CONFLICT (ledger_id) DO NOTHING RETURNING revision',[KEY,serialized]);
     if(written.rowCount!==1)throw Object.assign(Error('SERIALIZATION_CONFLICT'),{code:'40001'});
    }
    await client.query('COMMIT');return clone(outcome.value);
   }catch(error){if(client)try{await client.query('ROLLBACK');}catch{}if(['40001','40P01'].includes(error?.code)){if(attempt+1<maxRetries)continue;fail('LEDGER_CONTENTION_RETRY_REQUIRED',503);}throw safeError(error);}
   finally{client?.release();}
  }
 }
 async function readPolicy(){requirePool();try{const result=await pool.query('SELECT body, revision FROM dualframe_operator_ledger WHERE ledger_id = $1',[KEY]);if(!result.rows[0])return null;const body=decode(result.rows[0].body);return body.policy?{policy:validateOperatorPolicy(body.policy),audit:body.audit}:null;}catch(e){throw safeError(e);}}
 async function compareAndSwapPolicy({expected_version,policy,audit}){const next=validateOperatorPolicy(policy);return transaction(body=>{if((body.policy?.version||null)!==expected_version)return {write:false,value:{modified:false}};if(next.version===expected_version)fail('OPERATOR_POLICY_VERSION_INVALID');body.policy=next;body.audit=clone(audit);return {write:true,value:{modified:true}};});}
 function policyFor(body,plan,owner){
  if(!body.policy)fail('ENHANCE_POLICY_NOT_CONFIGURED',503);const policy=validateOperatorPolicy(body.policy);
  if(policy.version!==plan.policy_version)fail('PLAN_POLICY_CHANGED');if(!policy.enabled||policy.kill_switch)fail('ENHANCE_KILL_SWITCH');
  const mapping=policy.models.find(m=>m.key===plan.model&&m.enabled&&m.tier===plan.tier);if(!mapping||!mapping.resolutions.includes(plan.quality)||plan.calls.some(c=>!mapping.operations.includes(c.operation)))fail('OPERATION_POLICY_DENIED',403);
  const own=policy.per_owner[owner],provider=policy.provider_quotas[mapping.provider];if(!own||!provider)fail('OWNER_POLICY_NOT_CONFIGURED',503);if(plan.tier==='premium'&&!own.premium)fail('PAID_ENTITLEMENT_REQUIRED',403);
  return {policy,own,provider,providerName:mapping.provider,owner};
 }
 function validatePlan(owner,plan){if(!OWNER.test(owner||'')||owner!==plan?.owner||!HASH.test(plan.plan_id||'')||!HASH.test(plan.fingerprint||'')||!Array.isArray(plan.calls)||plan.calls.length<1||plan.calls.length>16||!['premium','free'].includes(plan.tier))fail('LEDGER_PLAN_INVALID');const calls=plan.calls.filter(c=>c.model_calls===1);if(calls.length!==plan.maximum_api_calls||calls.length<1||calls.some(c=>!HASH.test(c.call_id||''))||new Set(calls.map(c=>c.call_id)).size!==calls.length||plan.calls.some(c=>![0,1].includes(c.model_calls)))fail('LEDGER_PLAN_INVALID');return calls;}
 async function maximumCost(input){if(input.plan.tier==='free'){if(typeof verifyZeroSpend!=='function'||await verifyZeroSpend(input)!==true)fail('FREE_ZERO_SPEND_UNVERIFIED',403);return {amount_minor:0,currency:null,zero_spend_verified:true};}const cost=input.plan.cost;if(!cost||typeof cost.currency!=='string'||!/^[A-Z]{3}$/.test(cost.currency)||typeof cost.maximum!=='number')fail('PREMIUM_COST_UPPER_BOUND_UNKNOWN');return {amount_minor:minor(cost.maximum),currency:cost.currency,zero_spend_verified:false};}
 function usage(body,period,{owner,providerName}){
  const result={global:{calls:0,units:0,spend:0,active:0},owner:{calls:0,units:0,spend:0,active:0},provider:{calls:0,units:0,spend:0,active:0}};
  for(const reservation of Object.values(body.reservations)){
   const unsettled=reservation.state!=='SETTLED',counted=reservation.period===period||unsettled;
   const active=Object.values(reservation.calls).filter(c=>['CLAIMED','HELD'].includes(c.state)).length,spend=reservation.charged_spend_minor;
   for(const [scope,include] of [['global',true],['owner',reservation.owner===owner],['provider',reservation.provider===providerName]])if(include){const item=result[scope];item.calls=add(item.calls,counted?reservation.maximum_api_calls:0);item.units=add(item.units,counted?reservation.units_hundredths:0);item.spend=add(item.spend,spend);item.active=add(item.active,active);}
  }return result;
 }
 function checkCaps(current,context,addition,claim=false){
  for(const [scope,limit] of [['global',context.policy.global],['owner',context.own.limits],['provider',{...context.provider,calls_per_day:Number.MAX_SAFE_INTEGER}]]){
   const used=current[scope];if(add(used.calls,addition.calls)>limit.calls_per_day)fail('CALL_QUOTA_EXHAUSTED',429);if(add(used.spend,addition.spend)>limit.spend_cap.amount_minor)fail('SPEND_QUOTA_EXHAUSTED',429);if(used.active+(claim?1:0)>limit.concurrent_jobs||(!claim&&used.active>=limit.concurrent_jobs))fail('CONCURRENCY_QUOTA_EXHAUSTED',429);
  }
  if(add(current.provider.units,addition.units)>minor(context.provider.units_per_day))fail('PROVIDER_QUOTA_EXHAUSTED',429);
 }
 function receipt(r){return {atomic:true,limits_enforced:true,job_limits_enforced:true,storage_transfer_quotas_verified:false,uncertain_included:true,owner:r.owner,reservation_id:r.reservation_id,whole_plan_reserved:true,plan_fingerprint:r.plan_fingerprint,policy_version:r.policy_version,maximum_api_calls:r.maximum_api_calls,call_ids:Object.keys(r.calls)};}
 async function reservePlan(input){
  const calls=validatePlan(input.owner,input.plan),cost=await maximumCost(input),id=sha(input.owner+':'+input.plan.plan_id),reservation_id='r_'+id;
  return transaction(body=>{
   const context=policyFor(body,input.plan,input.owner),existing=body.reservations[id];if(existing){if(existing.plan_fingerprint!==input.plan.fingerprint||existing.owner!==input.owner)fail('PLAN_RESERVATION_CONFLICT');return {write:false,value:receipt(existing)};}
   const capCurrency=context.policy.global.spend_cap.currency;for(const prior of Object.values(body.reservations))if(prior.charged_spend_minor>0&&prior.currency!==capCurrency)fail('POLICY_CURRENCY_TRANSITION_REQUIRED');
   if(cost.currency&&[context.policy.global.spend_cap.currency,context.own.limits.spend_cap.currency,context.provider.spend_cap.currency].some(c=>c!==cost.currency))fail('POLICY_CURRENCY_MISMATCH');
   const units=input.plan.tier==='free'?input.plan.free_plan?.maximum_neurons:calls.length;if(input.plan.tier==='free'&&context.provider.unit!=='neurons'||input.plan.tier==='premium'&&context.provider.unit!=='requests'||!Number.isFinite(units))fail('PROVIDER_QUOTA_UNIT_INVALID');
   const period=day(now()),unitCount=minor(units),totals=usage(body,period,context);checkCaps(totals,context,{calls:calls.length,spend:cost.amount_minor,units:unitCount});
   const record={reservation_id,owner:input.owner,plan_id:input.plan.plan_id,plan_fingerprint:input.plan.fingerprint,policy_version:input.plan.policy_version,provider:context.providerName,period,maximum_api_calls:calls.length,units_hundredths:unitCount,maximum_spend_minor:cost.amount_minor,charged_spend_minor:cost.amount_minor,currency:cost.currency,zero_spend_verified:cost.zero_spend_verified,state:'RESERVED',created_at:new Date(now()).toISOString(),calls:Object.fromEntries(calls.map(c=>[c.call_id,{state:'RESERVED',actual_spend_minor:null}]))};body.reservations[id]=record;return {write:true,value:receipt(record)};
  });
 }
 async function claimCall(input){validatePlan(input.owner,input.plan);if(input.plan.tier==='free')await maximumCost(input);return transaction(body=>{
  const context=policyFor(body,input.plan,input.owner),id=sha(input.owner+':'+input.plan.plan_id),r=body.reservations[id];if(!r||r.reservation_id!==input.reservation?.reservation_id||r.plan_fingerprint!==input.plan.fingerprint)fail('PLAN_RESERVATION_UNKNOWN');const call=r.calls[input.job?.job_id];if(!call)fail('PLAN_CALL_UNKNOWN');if(call.state!=='RESERVED')fail('CALL_ALREADY_CLAIMED');
  const totals=usage(body,day(now()),context);checkCaps(totals,context,{calls:0,units:0,spend:0},true);call.state='CLAIMED';call.claimed_at=new Date(now()).toISOString();r.state='RUNNING';return {write:true,value:{...receipt(r),call_claimed:true,call_id:input.job.job_id}};
 });}
 async function settleCall(input){return transaction(body=>{
  const id=sha(input.owner+':'+input.plan.plan_id),r=body.reservations[id];if(!r||r.reservation_id!==input.reservation?.reservation_id||r.plan_fingerprint!==input.plan.fingerprint)fail('PLAN_RESERVATION_UNKNOWN');const call=r.calls[input.job?.job_id];if(!call){if(input.plan.calls.some(c=>c.call_id===input.job?.job_id&&c.model_calls===0))return {write:false,value:{provider_call:false}};fail('PLAN_CALL_UNKNOWN');}
  if(input.uncertain===true||input.retain_reservation===true||input.actual_cost===null||input.actual_cost===undefined){if(call.state==='SETTLED')return {write:false,value:{retained:false,state:r.state,reused:true}};const knownCompleted=input.uncertain===false&&input.result?.bytes&&Number(input.result.bytes.byteLength)>0;if(knownCompleted&&['CLAIMED','HELD'].includes(call.state)){call.state='COMPLETED_COST_UNKNOWN';call.completed_at=new Date(now()).toISOString();}else if(call.state==='CLAIMED')call.state='HELD';r.state='HELD';return {write:true,value:{retained:true,state:'HELD'}};}
  const actual=minor(input.actual_cost),currency=input.result?.cost_currency;if(!r.zero_spend_verified&&((actual>0&&currency!==r.currency)||(currency&&currency!==r.currency)))fail('ACTUAL_COST_CURRENCY_UNKNOWN');if(r.zero_spend_verified&&actual!==0)fail('FREE_NONZERO_COST_RECEIPT');if(call.state==='SETTLED'){if(call.actual_spend_minor!==actual)fail('SETTLEMENT_CONFLICT');return {write:false,value:{settled:r.state==='SETTLED',state:r.state,reused:true}};}if(!['CLAIMED','HELD','COMPLETED_COST_UNKNOWN'].includes(call.state))fail('CALL_NOT_SUBMITTED');
  call.state='SETTLED';call.actual_spend_minor=actual;call.settled_at=new Date(now()).toISOString();const sum=Object.values(r.calls).reduce((total,c)=>add(total,c.actual_spend_minor||0),0),done=Object.values(r.calls).every(c=>c.state==='SETTLED');r.charged_spend_minor=done?sum:Math.max(r.maximum_spend_minor,sum);r.state=sum>r.maximum_spend_minor?'HELD':done?'SETTLED':Object.values(r.calls).some(c=>['HELD','COMPLETED_COST_UNKNOWN'].includes(c.state))?'HELD':'RUNNING';if(sum>r.maximum_spend_minor)r.error='ACTUAL_COST_EXCEEDED_RESERVATION';return {write:true,value:{settled:done&&r.state==='SETTLED',retained:r.state==='HELD',state:r.state,...(r.error?{error:r.error}:{})}};
 });}
 return {configurationStatus:Object.freeze({configured:ready,status:ready?'LEDGER_DATABASE_INTERFACE_CONFIGURED_UNVERIFIED':'LEDGER_DATABASE_NOT_CONFIGURED',storage_transfer_quotas_verified:false}),readPolicy,compareAndSwapPolicy,reservePlan,claimCall,settleCall,quotePlan:async input=>{if(typeof quotePlan==='function')return quotePlan(input);if(input.proposal?.tier!=='premium')return null;const model=input.policy?.models.find(m=>m.key===input.proposal.model),ceiling=model?.maximum_call_cost;if(!ceiling)return null;const total=ceiling.amount_minor*input.proposal.maximum_api_calls;if(!Number.isSafeInteger(total))fail('COST_MINOR_UNITS_INVALID');return {maximum:total/100,currency:ceiling.currency,estimated_as:'operator-call-ceiling',invoice_or_market_price:false};}};
}
