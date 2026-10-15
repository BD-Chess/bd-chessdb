import {getStore} from '@netlify/blobs';
import {createService} from './service.mjs';
import {decryptConfiguration} from './config-crypto.mjs';
import {createAccountIdentity} from './account-identity.mjs';
import {createEnhancementLedger} from './enhancement-ledger.mjs';
import {createEnhancementPolicy,createOperatorPolicyService} from './enhancement-policy.mjs';
export const VAULT_KEY='configuration/private-v3';
export const configurationStore=()=>getStore({name:'dualframe-rd-v3',consistency:'strong'});
function heldIdentity(code){
 const callback=async()=>{throw Object.assign(Error(code),{code,status:503});};
 callback.status=()=>({configured:false,status:code,public_enabled:false,restricted_subjects_configured:false,legacy_binding_configured:false});
 return callback;
}
// Keep Identity's runtime discovery and network operations completely dormant
// for the existing protected service unless explicitly configured server-side.
export async function runtimeAccountIdentity(env,{loadIdentity=()=>import('@netlify/identity')}={}){
 let enabled;
 try{enabled=env('DF_ACCOUNT_IDENTITY_ENABLED')==='true';}catch{return heldIdentity('IDENTITY_NOT_CONFIGURED');}
 if(!enabled)return null;
 let sdk;
 try{
  sdk=await loadIdentity();
  if(['getUser','getIdentityConfig','getSettings'].some(key=>typeof sdk?.[key]!=='function'))throw Error('IDENTITY_SDK_UNAVAILABLE');
 }catch{return heldIdentity('IDENTITY_SDK_UNAVAILABLE');}
 return createAccountIdentity({getUser:sdk.getUser,getIdentityConfig:sdk.getIdentityConfig,getSettings:sdk.getSettings,env,publicAccessVerified:false});
}
const loadDefaultPg=()=>import('pg');
let configuredPool=null;
const policyError=code=>Object.assign(Error(code),{code,status:503});
function operatorIssuer(value){
 let url;try{url=new URL(value);}catch{throw policyError('OPERATOR_ADMIN_BINDINGS_INVALID');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||(url.port&&url.port!=='443')||url.pathname.replace(/\/$/,'')!=='/.netlify/identity')throw policyError('OPERATOR_ADMIN_BINDINGS_INVALID');
 return url.origin+'/.netlify/identity';
}
export function parseOperatorAdminBindings(raw,{now=Date.now()}={}){
 if(typeof raw!=='string'||!raw||raw.length>65536)throw policyError('OPERATOR_ADMIN_BINDINGS_REQUIRED');
 let values;try{values=JSON.parse(raw);}catch{throw policyError('OPERATOR_ADMIN_BINDINGS_INVALID');}
 if(!Array.isArray(values)||!values.length||values.length>100)throw policyError('OPERATOR_ADMIN_BINDINGS_INVALID');
 const keys=new Set();
 return Object.freeze(values.map(value=>{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['issuer','subject','verified','verified_at','verification_receipt'].includes(key))||value.verified!==true||typeof value.subject!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(value.subject)||typeof value.verification_receipt!=='string'||!value.verification_receipt.trim()||value.verification_receipt.length>500||/[\u0000-\u001f\u007f]/.test(value.verification_receipt)||typeof value.verified_at!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value.verified_at)||!Number.isFinite(Date.parse(value.verified_at))||Date.parse(value.verified_at)>now)throw policyError('OPERATOR_ADMIN_BINDINGS_INVALID');
  const issuer=operatorIssuer(value.issuer),key=issuer+'\0'+value.subject;
  if(keys.has(key))throw policyError('OPERATOR_ADMIN_BINDINGS_INVALID');keys.add(key);
  return Object.freeze({issuer,subject:value.subject,verified_at:value.verified_at,verification_receipt:value.verification_receipt});
 }));
}
function heldPolicies(status){return {enhancementPolicy:null,operatorPolicy:null,accountUsage:null,configurationStatus:Object.freeze({configured:false,status,database_verified:false,schema_verified:false})};}
/** Configuration only. Pool construction is lazy: no connect, SQL, migrations,
 * policy seeding, account enrollment or provider request occurs here. */
export async function runtimeOperatorPolicies(env,{loadPg=loadDefaultPg,now=()=>Date.now()}={}){
 let enabled;
 try{enabled=env('DF_OPERATOR_POLICY_ENABLED')==='true';}catch{return heldPolicies('OPERATOR_POLICY_NOT_CONFIGURED');}
 if(!enabled)return heldPolicies('OPERATOR_POLICY_NOT_CONFIGURED');
 let connectionString,bindings;
 try{
  connectionString=env('DF_OPERATOR_DATABASE_URL');
  if(typeof connectionString!=='string'||!connectionString||connectionString.length>8192)return heldPolicies('OPERATOR_DATABASE_NOT_CONFIGURED');
  const parsed=new URL(connectionString);
  if(!['postgres:','postgresql:'].includes(parsed.protocol)||!parsed.hostname||parsed.hash||parsed.pathname.length<2||/[\u0000-\u001f\u007f]/.test(connectionString))return heldPolicies('OPERATOR_DATABASE_CONFIGURATION_INVALID');
  bindings=parseOperatorAdminBindings(env('DF_OPERATOR_ADMIN_BINDINGS_JSON'),{now:now()});
 }catch(error){return heldPolicies(error?.code?.startsWith('OPERATOR_')?error.code:'OPERATOR_DATABASE_CONFIGURATION_INVALID');}
 let pool;
 try{
  if(loadPg===loadDefaultPg&&configuredPool?.connectionString===connectionString)pool=configuredPool.pool;
  else{
   const pg=await loadPg(),Pool=pg?.Pool||pg?.default?.Pool;
   if(typeof Pool!=='function')return heldPolicies('OPERATOR_DATABASE_DRIVER_UNAVAILABLE');
   pool=new Pool({connectionString,max:2,connectionTimeoutMillis:10000,idleTimeoutMillis:10000,allowExitOnIdle:true});
   // Idle driver errors must not crash unrelated protected-service requests or
   // expose credentials. Ledger operations surface sanitized request errors.
   pool.on?.('error',()=>{});
   if(loadPg===loadDefaultPg)configuredPool={connectionString,pool};
  }
 }catch{return heldPolicies('OPERATOR_DATABASE_DRIVER_UNAVAILABLE');}
 const backend=createEnhancementLedger({pool,now});
 const authorizeAdmin=async principal=>{
  if(principal?.auth_method!=='verified-account'||typeof principal.issuer!=='string'||typeof principal.subject!=='string')return false;
  // Principal comes from the existing server-verified signed session. Neither
  // request bodies, email, roles nor possession of the legacy password apply.
  let issuer;try{issuer=operatorIssuer(principal.issuer);}catch{return false;}
  return bindings.some(binding=>binding.issuer===issuer&&binding.subject===principal.subject);
 };
 const configurationStatus=Object.freeze({configured:true,status:'OPERATOR_DATABASE_INTERFACE_CONFIGURED_UNVERIFIED',database_verified:false,schema_verified:false,storage_transfer_quotas_verified:false});
 const enhancementPolicy=createEnhancementPolicy({backend}),operatorPolicy=createOperatorPolicyService({backend,authorizeAdmin,now});
 enhancementPolicy.configurationStatus=Object.freeze({...enhancementPolicy.configurationStatus,...configurationStatus});
 operatorPolicy.configurationStatus=configurationStatus;
 return {enhancementPolicy,operatorPolicy,accountUsage:backend,configurationStatus};
}
export async function runtimeService(){
 const store=configurationStore(),pack=await store.get(VAULT_KEY,{type:'json',consistency:'strong'});
 let values={};
 if(pack)values=decryptConfiguration(pack,Netlify.env.get('GEMINI_API_KEY'));
 const env=key=>Netlify.env.get(key)||values[key];
 const policies=await runtimeOperatorPolicies(env);
 return createService({store,env,accountIdentity:await runtimeAccountIdentity(env),enhancementPolicy:policies.enhancementPolicy,operatorPolicy:policies.operatorPolicy,accountUsage:policies.accountUsage});
}
