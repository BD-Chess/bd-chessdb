// Operator policy requires a real atomic backend. There are no default budgets,
// plain Blob read/modify counters, or client-authorized administrators.
import {modelFor} from './contracts.mjs';
export const OPERATOR_POLICY_SCHEMA='bd.dualframe.operator-policy.v1';
const providers=new Set(['openai','gemini','xai','qwen','minimax','zai','mistral','cloudflare']);
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const fail=(code,status=400)=>{throw Object.assign(Error(code),{code,status});};
const bounded=(v,max=100)=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[\u0000-\u001f\u007f]/u.test(v);
const number=v=>Number.isSafeInteger(v)&&v>=0;
function shape(v,keys){if(!plain(v)||Object.keys(v).some(k=>!keys.includes(k)))fail('OPERATOR_POLICY_INVALID');}
function cap(v){shape(v,['amount_minor','currency']);if(!number(v.amount_minor)||typeof v.currency!=='string'||!/^[A-Z]{3}$/.test(v.currency))fail('OPERATOR_SPEND_CAP_REQUIRED');return {amount_minor:v.amount_minor,currency:v.currency};}
function limits(v){shape(v,['calls_per_day','storage_bytes','transfer_bytes_per_day','concurrent_jobs','concurrent_transfers','spend_cap']);for(const k of ['calls_per_day','storage_bytes','transfer_bytes_per_day','concurrent_jobs','concurrent_transfers'])if(!number(v[k]))fail('OPERATOR_LIMITS_REQUIRED');return {...v,spend_cap:cap(v.spend_cap)};}
export function validateOperatorPolicy(input){
 shape(input,['schema','version','enabled','kill_switch','models','per_owner','global','provider_quotas','retention']);
 if(input.schema!==OPERATOR_POLICY_SCHEMA||!bounded(input.version)||typeof input.enabled!=='boolean'||typeof input.kill_switch!=='boolean'||!Array.isArray(input.models)||!input.models.length||input.models.length>32)fail('OPERATOR_POLICY_INVALID');
 const seen=new Set(),models=input.models.map(m=>{shape(m,['key','provider','tier','enabled','operations','resolutions','maximum_call_cost']);const known=modelFor(m.key),free=['cloudflare-flux-free','@cf/black-forest-labs/flux-2-klein-4b'].includes(m.key)&&m.provider==='cloudflare';if((!known&&!free)||(!free&&known.provider!==m.provider)||!providers.has(m.provider)||seen.has(m.key)||!['free','premium'].includes(m.tier)||typeof m.enabled!=='boolean'||(m.tier==='free'&&!free))fail('OPERATOR_MODEL_INVALID');seen.add(m.key);if(!Array.isArray(m.operations)||!m.operations.length||m.operations.some(x=>!['enhance','expand','generate','derive'].includes(x))||!Array.isArray(m.resolutions)||!m.resolutions.length||m.resolutions.some(x=>!['hd','4k'].includes(x)))fail('OPERATOR_MODEL_INVALID');return {...m,...(m.maximum_call_cost!==undefined?{maximum_call_cost:cap(m.maximum_call_cost)}:{}),operations:[...new Set(m.operations)],resolutions:[...new Set(m.resolutions)]};});
 if(!plain(input.per_owner)||!Object.keys(input.per_owner).length||Object.keys(input.per_owner).length>10000)fail('OPERATOR_OWNER_LIMITS_REQUIRED');
 const per_owner=Object.create(null);for(const [owner,value] of Object.entries(input.per_owner)){if(!/^[A-Za-z0-9_-]{8,100}$/.test(owner))fail('OPERATOR_OWNER_INVALID');shape(value,['premium','limits']);if(typeof value.premium!=='boolean')fail('OPERATOR_ENTITLEMENT_REQUIRED');per_owner[owner]={premium:value.premium,limits:limits(value.limits)};}
 const global=limits(input.global);if(!plain(input.provider_quotas)||!Object.keys(input.provider_quotas).length)fail('OPERATOR_PROVIDER_QUOTAS_REQUIRED');
 const provider_quotas={};for(const [provider,q] of Object.entries(input.provider_quotas)){if(!providers.has(provider))fail('OPERATOR_PROVIDER_INVALID');shape(q,['units_per_day','unit','concurrent_jobs','spend_cap']);if(!number(q.units_per_day)||!number(q.concurrent_jobs)||!['requests','neurons'].includes(q.unit))fail('OPERATOR_PROVIDER_QUOTAS_REQUIRED');provider_quotas[provider]={...q,spend_cap:cap(q.spend_cap)};}
 if(models.some(m=>!provider_quotas[m.provider]))fail('OPERATOR_PROVIDER_QUOTAS_REQUIRED');
 shape(input.retention,['original_days','derived_days','tombstone_days']);if(Object.values(input.retention).length!==3||Object.values(input.retention).some(v=>!number(v)))fail('OPERATOR_RETENTION_REQUIRED');
 return {schema:OPERATOR_POLICY_SCHEMA,version:input.version,enabled:input.enabled,kill_switch:input.kill_switch,models,per_owner,global,provider_quotas,retention:{...input.retention}};
}
async function configured(backend){if(typeof backend?.readPolicy!=='function')fail('ENHANCE_POLICY_NOT_CONFIGURED',503);const record=await backend.readPolicy();if(!record?.policy)fail('ENHANCE_POLICY_NOT_CONFIGURED',503);return {...record,policy:validateOperatorPolicy(record.policy)};}
export function createOperatorPolicyService({backend=null,authorizeAdmin=null,now=()=>Date.now()}={}){
 async function isAdmin(p){return p?.auth_method==='verified-account'&&bounded(p.issuer,500)&&bounded(p.subject,200)&&typeof authorizeAdmin==='function'&&await authorizeAdmin(p)===true;}
 async function guard(principal){if(principal?.admin!==true||!await isAdmin(principal))fail('ADMIN_IDENTITY_REQUIRED',403);}
 return {
  async resolvePrincipal(principal){return {...principal,admin:await isAdmin(principal)};},
  async read({principal}){await guard(principal);const current=await configured(backend);return {policy:current.policy,audit:current.audit||null,atomic_quota_backend:typeof backend.reservePlan==='function'&&typeof backend.claimCall==='function'&&typeof backend.settleCall==='function'};},
  async update({principal,expected_version,policy}){await guard(principal);if(typeof backend?.compareAndSwapPolicy!=='function')fail('OPERATOR_POLICY_BACKEND_UNAVAILABLE',503);const next=validateOperatorPolicy(policy);if((expected_version!==null&&!bounded(expected_version))||next.version===expected_version)fail('OPERATOR_POLICY_VERSION_INVALID');const raw=await backend.readPolicy(),current=raw?.policy?validateOperatorPolicy(raw.policy):null;if((current?.version||null)!==expected_version)fail('OPERATOR_POLICY_CONFLICT',409);const audit={updated_at:new Date(now()).toISOString(),issuer:principal.issuer,subject:principal.subject,previous_version:expected_version};const result=await backend.compareAndSwapPolicy({expected_version,policy:next,audit});if(result?.modified!==true)fail('OPERATOR_POLICY_CONFLICT',409);const saved=await configured(backend);if(JSON.stringify(saved.policy)!==JSON.stringify(next))fail('OPERATOR_POLICY_WRITE_UNCONFIRMED',503);return {policy:saved.policy,audit:saved.audit||audit};}
 };
}
export function createEnhancementPolicy({backend=null}={}){
 async function inspect({owner,principal,proposal}){
  if(!['readPolicy','reservePlan','claimCall','settleCall'].every(key=>typeof backend?.[key]==='function'))return {allowed:false,reason:'ENHANCE_POLICY_NOT_CONFIGURED'};
  const {policy}=await configured(backend),reply={policy_version:policy.version,model:proposal.model,tier:proposal.tier,maximum_api_calls:proposal.maximum_api_calls,cost:null};
  const deny=reason=>({...reply,allowed:false,reason});if(!policy.enabled||policy.kill_switch)return deny('ENHANCE_KILL_SWITCH');
  const mapping=policy.models.find(m=>m.key===proposal.model&&m.tier===proposal.tier&&m.enabled);if(!mapping)return deny('MODEL_POLICY_DENIED');
  if(!mapping.resolutions.includes(proposal.quality)||proposal.calls.some(c=>!mapping.operations.includes(c.operation)))return deny('OPERATION_POLICY_DENIED');
  const own=policy.per_owner[owner];if(!own)return deny('OWNER_POLICY_NOT_CONFIGURED');
  if(proposal.tier==='premium'&&!own.premium)return deny('PAID_ENTITLEMENT_REQUIRED');
  const provider=policy.provider_quotas[mapping.provider];if(proposal.tier==='free'&&(!Number.isFinite(proposal.free_plan?.maximum_neurons)||provider?.unit!=='neurons'||provider.units_per_day<proposal.free_plan.maximum_neurons))return deny('FREE_ALLOWANCE_UNKNOWN');if(!provider||own.limits.calls_per_day<proposal.maximum_api_calls||policy.global.calls_per_day<proposal.maximum_api_calls||provider.units_per_day<proposal.maximum_api_calls||own.limits.concurrent_jobs<1||policy.global.concurrent_jobs<1||provider.concurrent_jobs<1)return deny('PLAN_QUOTA_INSUFFICIENT');
  // Unknown prices stay unknown. The trusted ledger must enforce the explicit
  // configured spend caps conservatively before it can grant a reservation.
  let cost=null;if(typeof backend.quotePlan==='function'){try{cost=await backend.quotePlan({owner,principal,proposal,policy});}catch{return deny('COST_QUOTE_UNAVAILABLE');}if(proposal.tier==='premium'&&cost===null)return deny('PREMIUM_COST_UPPER_BOUND_UNKNOWN');}
  return {...reply,cost,allowed:true,paid_entitlement_verified:own.premium===true};
 }
 async function authorize(input){const result=await inspect({owner:input.owner,principal:input.principal,proposal:input.plan});if(!result.allowed)fail(result.reason,403);if(result.policy_version!==input.plan.policy_version)fail('PLAN_POLICY_CHANGED',409);const {policy}=await configured(backend);if(policy.version!==input.plan.policy_version)fail('PLAN_POLICY_CHANGED',409);return policy;}
 return {
  configurationStatus:Object.freeze({configured:['readPolicy','reservePlan','claimCall','settleCall'].every(key=>typeof backend?.[key]==='function')&&backend?.configurationStatus?.configured!==false,status:['readPolicy','reservePlan','claimCall','settleCall'].every(key=>typeof backend?.[key]==='function')?'ENHANCE_POLICY_INTERFACE_CONFIGURED_UNVERIFIED':'ENHANCE_POLICY_NOT_CONFIGURED'}),
  inspect,
  async reserve(input){const policy=await authorize(input),r=await backend.reservePlan({...input,policy,requirements:{whole_plan:true,model_calls:input.plan.maximum_api_calls,provider_units:input.plan.tier==='free'?input.plan.free_plan.maximum_neurons:input.plan.maximum_api_calls,retain_uncertain:true,require_spend_cap_enforcement:true}});if(r?.atomic!==true||r.limits_enforced!==true||r.uncertain_included!==true||r.owner!==input.owner)fail('PLAN_QUOTA_RESERVATION_UNVERIFIED',503);return {...r,verified:true};},
  async authorizeCall(input){const policy=await authorize(input),proof=await backend.claimCall({...input,policy,requirements:{single_call:true,recheck_entitlement:true,retain_uncertain:true}});if(proof?.atomic!==true||proof.limits_enforced!==true||proof.owner!==input.owner)fail('PLAN_QUOTA_CLAIM_UNVERIFIED',503);return {...proof,verified:true};},
  async settleCall(input){if(typeof backend?.settleCall!=='function')fail('OPERATOR_QUOTA_BACKEND_UNAVAILABLE',503);const actual=input.result?.actual_cost??null;return backend.settleCall({...input,retain_reservation:input.uncertain===true||actual===null,actual_cost:actual});}
 };
}
