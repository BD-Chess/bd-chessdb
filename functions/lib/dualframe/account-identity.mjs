// Restricted application-session bridge for the existing Netlify host.
// SDK contract verified against @netlify/identity 2.0.0 npm tarball:
// SHA-256 6fbd8d6b160d16246ba35de03c9442d9ea5017c3095629623629b88922d2cad2.
// The SDK supplies server getUser()/getIdentityConfig()/getSettings(); client
// email, owner, role, membership, cookies decoded by us, and body flags never do.
import {createHash} from 'node:crypto';

export const ACCOUNT_IDENTITY_SCHEMA='bd.dualframe.account-principal.v1';
const SUBJECT=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const sha=value=>createHash('sha256').update(value).digest('hex');
const timestamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)?Date.parse(value):NaN;
function fail(code,status=503){throw Object.assign(Error(code),{code,status});}
function identityIssuer(value){
 if(typeof value!=='string'||value.length>500)fail('IDENTITY_ISSUER_INVALID');
 let url;try{url=new URL(value);}catch{fail('IDENTITY_ISSUER_INVALID');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||(url.port&&url.port!=='443')||!url.hostname.includes('.')||url.pathname.replace(/\/$/,'')!=='/.netlify/identity')fail('IDENTITY_ISSUER_INVALID');
 return url.origin+'/.netlify/identity';
}
function jsonConfig(value,code){
 if(typeof value!=='string'||!value||value.length>65536)fail(code);
 try{return JSON.parse(value);}catch{fail(code);}
}
/** Subject is a stable provider identifier, not an email address or device ID. */
export function accountOwner(issuer,subject){
 const canonical=identityIssuer(issuer);
 if(typeof subject!=='string'||!SUBJECT.test(subject))fail('ACCOUNT_SUBJECT_INVALID',403);
 return 'account_'+sha('bd.dualframe.account.v1\0'+canonical+'\0'+subject);
}

/** Returns a createService-compatible async accountIdentity(req) callback.
 * Runtime integration must inject the actual SDK functions from a v2 Netlify
 * Function. publicAccessVerified must reflect separately verified release
 * gates, not user preferences. This module enrolls no account, changes no
 * Identity setting, signs no token and accesses no private library. */
export function createAccountIdentity({getUser,getIdentityConfig,getSettings,env=()=>undefined,now=()=>Date.now(),publicAccessVerified=false}={}){
 function configuration(){
  let enabled,issuer,publicEnabled,allowedJSON,bindingJSON;
  try{enabled=env('DF_ACCOUNT_IDENTITY_ENABLED');issuer=env('DF_ACCOUNT_IDENTITY_ISSUER');publicEnabled=env('DF_PUBLIC_ACCOUNTS_ENABLED');allowedJSON=env('DF_ACCOUNT_ALLOWED_SUBJECTS_JSON');bindingJSON=env('DF_BD_ACCOUNT_BINDING_JSON');}catch{fail('IDENTITY_NOT_CONFIGURED');}
  if(enabled!=='true'||typeof getUser!=='function'||typeof getIdentityConfig!=='function'||typeof getSettings!=='function')fail('IDENTITY_NOT_CONFIGURED');
  const canonical=identityIssuer(issuer),allowed=allowedJSON?jsonConfig(allowedJSON,'ACCOUNT_ALLOWLIST_INVALID'):[];
  if(!Array.isArray(allowed)||allowed.length>500||allowed.some(subject=>typeof subject!=='string'||!SUBJECT.test(subject)))fail('ACCOUNT_ALLOWLIST_INVALID');
  let binding=null;
  if(bindingJSON){
   const value=jsonConfig(bindingJSON,'BD_ACCOUNT_BINDING_INVALID');
   if(!plain(value)||Object.keys(value).some(key=>!['issuer','subject','verified','verified_at','verification_receipt'].includes(key))||value.verified!==true||typeof value.subject!=='string'||!SUBJECT.test(value.subject)||typeof value.verification_receipt!=='string'||!value.verification_receipt.trim()||value.verification_receipt.length>500||/[\u0000-\u001f]/.test(value.verification_receipt))fail('BD_ACCOUNT_BINDING_INVALID');
   const verified=timestamp(value.verified_at);
   if(!Number.isFinite(verified)||verified>now())fail('BD_ACCOUNT_BINDING_INVALID');
   let bindingIssuer;try{bindingIssuer=identityIssuer(value.issuer);}catch{fail('BD_ACCOUNT_BINDING_INVALID');}
   if(bindingIssuer!==canonical)fail('BD_ACCOUNT_BINDING_INVALID');
   binding={issuer:bindingIssuer,subject:value.subject};
  }
  return {issuer:canonical,origin:new URL(canonical).origin,allowed:new Set(allowed),binding,publicEnabled:publicEnabled==='true'&&publicAccessVerified===true};
 }
 const accountIdentity=async(req)=>{
  const config=configuration();
  // This is a same-origin cookie-authenticated exchange. Pages uses a separate
  // validated handoff into its existing bearer session, never cross-site cookies.
  if(!req||req.method!=='POST'||!req.headers||typeof req.headers.get!=='function')fail('ACCOUNT_EXCHANGE_REQUEST_INVALID',400);
  let requestOrigin;try{requestOrigin=new URL(req.url).origin;}catch{fail('ACCOUNT_EXCHANGE_REQUEST_INVALID',400);}
  if(req.headers.get('origin')!==config.origin||requestOrigin!==config.origin)fail('ACCOUNT_EXCHANGE_ORIGIN_INVALID',403);
  let identityConfig;
  try{identityConfig=getIdentityConfig();}catch{fail('IDENTITY_CONFIGURATION_UNVERIFIED');}
  // Read only url; getIdentityConfig can contain a server operator token.
  let actualIssuer;try{actualIssuer=identityIssuer(identityConfig?.url);}catch{fail('IDENTITY_CONFIGURATION_UNVERIFIED');}
  if(actualIssuer!==config.issuer)fail('IDENTITY_ISSUER_MISMATCH',403);
  let settings;
  try{settings=await getSettings();}catch{fail('IDENTITY_CONFIGURATION_UNVERIFIED');}
  if(settings?.autoconfirm!==false)fail('ACCOUNT_EMAIL_CONFIRMATION_REQUIRED');
  let user;
  try{user=await getUser();}catch{fail('ACCOUNT_IDENTITY_UNAVAILABLE');}
  if(!user)fail('ACCOUNT_UNAUTHORIZED',401);
  if(typeof user.id!=='string'||!SUBJECT.test(user.id))fail('ACCOUNT_SUBJECT_INVALID',403);
  // confirmedAt comes from the Identity API's confirmed_at field. The SDK's
  // JWT-claims fallback omits it; that incomplete fallback cannot authorize this
  // exchange. An email string or a userMetadata flag is insufficient.
  const confirmed=timestamp(user.confirmedAt);
  if(!Number.isFinite(confirmed)||confirmed>now()||typeof user.email!=='string'||user.email.length>254||!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).test(user.email))fail('ACCOUNT_EMAIL_UNVERIFIED',403);
  const legacy=config.binding?.subject===user.id&&config.binding.issuer===config.issuer;
  if(!config.publicEnabled&&!legacy&&!config.allowed.has(user.id))fail('PUBLIC_ENABLEMENT_HELD');
  // Ignore both editable userMetadata and appMetadata for paid/admin authority.
  // Existing operator-policy work must grant any future entitlement explicitly.
  return Object.freeze({schema:ACCOUNT_IDENTITY_SCHEMA,owner:legacy?'bd-research-owner':accountOwner(config.issuer,user.id),issuer:config.issuer,subject:user.id,verified_email:true,public_enabled:config.publicEnabled,paid_entitlement:0,admin:false,auth_method:'verified-account',account_access:config.publicEnabled?'public':'restricted',legacy_binding_applied:legacy});
 };
 accountIdentity.status=()=>{
  try{const config=configuration();return {configured:true,status:config.publicEnabled?'ACCOUNT_IDENTITY_CONFIGURED':'PUBLIC_ENABLEMENT_HELD',public_enabled:config.publicEnabled,restricted_subjects_configured:config.allowed.size>0,legacy_binding_configured:!!config.binding};}
  catch(error){return {configured:false,status:own(error,'code')?error.code:'IDENTITY_NOT_CONFIGURED',public_enabled:false,restricted_subjects_configured:false,legacy_binding_configured:false};}
 };
 return accountIdentity;
}
