// DualFrame hosted Free adapter; no inference runs merely by importing this file.
// Verified provider references: Cloudflare FLUX.2 klein 4B launch (2026-01-15),
// Workers AI pricing (2026-10-09), and data-usage docs. Account access, processing
// terms, photographic fidelity and zero-overage evidence are separate gates.
import sharp from 'sharp';
import {createHash} from 'node:crypto';

export const FREE_MODEL='@cf/black-forest-labs/flux-2-klein-4b';
export const FREE_PLAN_SCHEMA='bd.dualframe.free-plan.v1';
export const FREE_AUTHORIZATION_SCHEMA='bd.dualframe.free-reservation.v1';
export const FREE_PRICING=Object.freeze({version:'cloudflare-workers-ai-2026-10-09',daily_neurons:10000,input_tile_neurons:5.37,output_tile_neurons:26.05});
const ID=/^[a-zA-Z0-9_-]{8,100}$/;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const MAX_PIXELS=24000000,MAX_BYTES=32*1024*1024;
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
class FreeProviderError extends Error {
 constructor(code,status=400,ambiguous=false,requestId=null){super(code);this.code=code;this.status=status;this.ambiguous=ambiguous;this.requestId=requestId;this.automatic_paid_retry=false;this.reservation_released=false;}
}
const fail=(code,status=400,ambiguous=false,requestId=null)=>{throw new FreeProviderError(code,status,ambiguous,requestId);};
const neuronUnits=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&Number.isSafeInteger(Math.round(value*100))&&Math.abs(Math.round(value*100)/100-value)<1e-8?Math.round(value*100):null;
const safeRequestId=value=>typeof value==='string'&&/^[A-Za-z0-9._:-]{1,160}$/.test(value)?value:null;
const utcDay=time=>new Date(time).toISOString().slice(0,10);

function requestGeometry(width,height){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<256||height<256||width>1920||height>1920)fail('FREE_OUTPUT_GEOMETRY_UNSUPPORTED');
}
/** Conservative reservation estimate, NOT an invoice. Rounding each axis up to
 * 512-pixel tiles avoids understating an arbitrary raster's known tile pricing.
 * Keep uncertainty/reserve margin in the trusted account-wide quota service. */
export function freeRequestNeurons({width,height,input_images}){
 requestGeometry(width,height);
 if(!Number.isInteger(input_images)||input_images<0||input_images>4)fail('FREE_REFERENCE_COUNT_INVALID');
 return (Math.ceil(width/512)*Math.ceil(height/512)*2605+input_images*537)/100;
}
export function freeProviderPlan({plan_id,calls}={}){
 if(!ID.test(plan_id||'')||!Array.isArray(calls)||calls.length<1||calls.length>16)fail('FREE_PLAN_INVALID');
 const ids=new Set();
 const normalized=calls.map(call=>{
  if(!plain(call)||!ID.test(call.call_id||'')||ids.has(call.call_id))fail('FREE_PLAN_INVALID');
  ids.add(call.call_id);
  return {call_id:call.call_id,width:call.width,height:call.height,input_images:call.input_images,maximum_neurons:freeRequestNeurons(call)};
 });
 const plan={schema:FREE_PLAN_SCHEMA,model:FREE_MODEL,pricing_version:FREE_PRICING.version,plan_id,calls:normalized,maximum_neurons:normalized.reduce((sum,c)=>sum+Math.round(c.maximum_neurons*100),0)/100};
 return {...plan,fingerprint:sha(Buffer.from(JSON.stringify(plan)))};
}
function verifiedPlan(input){
 if(!plain(input)||input.schema!==FREE_PLAN_SCHEMA||input.model!==FREE_MODEL||input.pricing_version!==FREE_PRICING.version)fail('FREE_PLAN_INVALID');
 const plan=freeProviderPlan(input);
 if(plan.fingerprint!==input.fingerprint||plan.maximum_neurons!==input.maximum_neurons||plan.calls.some((call,i)=>call.maximum_neurons!==input.calls[i].maximum_neurons))fail('FREE_PLAN_INVALID');
 return plan;
}

/** TRUST BOUNDARY: proof must come from the injected server authorization
 * callback after an atomic account-wide reservation and single-call claim.
 * Client-supplied policy flags, email, tier, or this proof cannot grant access.
 * Paid Workers accounts are deliberately unsupported until a separately
 * verified provider-enforced no-overage route is implemented. */
export function verifyFreePlanReservation(proof,{accountId,plan,now=Date.now()}={}){
 const normalized=verifiedPlan(plan);
 if(!plain(proof)||proof.schema!==FREE_AUTHORIZATION_SCHEMA||proof.verified!==true)fail('FREE_PROVIDER_NOT_CONFIGURED',503);
 if(proof.account_id!==accountId||proof.plan_fingerprint!==normalized.fingerprint||!ID.test(proof.reservation_id||'')||typeof proof.policy_version!=='string'||!proof.policy_version||proof.policy_version.length>100)fail('FREE_AUTHORIZATION_INVALID',403);
 if(proof.account_plan!=='workers-free'||proof.no_overage_verified!==true)fail('FREE_NO_OVERAGE_UNVERIFIED',403);
 if(proof.account_usage_verified!==true||proof.uncertain_submissions_included!==true||proof.whole_plan_reserved!==true)fail('FREE_ALLOWANCE_UNKNOWN',409);
 const checked=Date.parse(proof.verified_at),expires=Date.parse(proof.expires_at),day=utcDay(now),reset=Date.parse(day+'T00:00:00.000Z')+86400000;
 if(!Number.isFinite(checked)||!Number.isFinite(expires)||checked>now||utcDay(checked)!==day||expires<=now||expires>reset||proof.usage_utc_day!==day)fail('FREE_AUTHORIZATION_EXPIRED',409);
 const allowance=neuronUnits(proof.allowance_neurons),usage=neuronUnits(proof.account_usage_neurons),reserved=neuronUnits(proof.account_reserved_neurons),whole=neuronUnits(proof.plan_reserved_neurons),remaining=neuronUnits(proof.plan_remaining_reserved_neurons);
 if([allowance,usage,reserved,whole,remaining].some(v=>v===null)||allowance!==1000000)fail('FREE_ALLOWANCE_UNKNOWN',409);
 if(usage+reserved>allowance||whole<Math.round(normalized.maximum_neurons*100)||reserved<remaining||whole<remaining)fail('FREE_ALLOWANCE_EXHAUSTED',429);
 return {reservation_id:proof.reservation_id,policy_version:proof.policy_version,plan_fingerprint:normalized.fingerprint,remaining_neurons:remaining/100,reset_at:new Date(reset).toISOString()};
}
export function verifyFreeAuthorization(proof,{accountId,plan,callId,now=Date.now()}={}){
 const normalized=verifiedPlan(plan),call=normalized.calls.find(c=>c.call_id===callId);
 if(!call)fail('FREE_PLAN_CALL_UNKNOWN');
 const reserved=verifyFreePlanReservation(proof,{accountId,plan:normalized,now});
 if(proof.call_id!==callId)fail('FREE_AUTHORIZATION_INVALID',403);
 if(proof.call_claimed!==true)fail('FREE_ALLOWANCE_UNKNOWN',409);
 if(Math.round(reserved.remaining_neurons*100)<Math.round(call.maximum_neurons*100))fail('FREE_ALLOWANCE_EXHAUSTED',429);
 return {reservation_id:reserved.reservation_id,policy_version:reserved.policy_version,plan_fingerprint:reserved.plan_fingerprint,call_id:callId,maximum_call_neurons:call.maximum_neurons,reset_at:reserved.reset_at};
}

function imageInput(value){
 if(Buffer.isBuffer(value))return value;
 if(value instanceof Uint8Array)return Buffer.from(value);
 if(value instanceof ArrayBuffer)return Buffer.from(value);
 fail('FREE_REFERENCE_INVALID');
}
export async function prepareFreeReference(input){
 const source=imageInput(input);
 if(!source.length||source.length>MAX_BYTES)fail('FREE_REFERENCE_INVALID');
 let meta,prepared,decoded;
 try{
  meta=await sharp(source,{limitInputPixels:MAX_PIXELS,failOn:'error',animated:false}).metadata();
  if(!['png','jpeg','webp'].includes(meta.format)||!meta.width||!meta.height||(meta.pages||1)>1)fail('FREE_REFERENCE_INVALID');
  decoded=meta.autoOrient||meta;
  prepared=await sharp(source,{limitInputPixels:MAX_PIXELS,failOn:'error',animated:false}).rotate().toColourspace('srgb').resize({width:511,height:511,fit:'inside',withoutEnlargement:true}).png().toBuffer({resolveWithObject:true});
 }catch{fail('FREE_REFERENCE_INVALID');}
 return {bytes:prepared.data,receipt:{source_sha256:sha(source),source_width:decoded.width,source_height:decoded.height,submitted_sha256:sha(prepared.data),submitted_width:prepared.info.width,submitted_height:prepared.info.height,mime:'image/png',transformation:'deterministic-orient-srgb-png-contain-max-511-v1',resampled:decoded.width!==prepared.info.width||decoded.height!==prepared.info.height,original_bytes_unchanged:true,identity_quality_verified:false}};
}
async function responseJSON(response){
 if(Number(response.headers.get('content-length'))>MAX_BYTES)fail('FREE_PROVIDER_RESPONSE_TOO_LARGE',502,true);
 let raw;
 if(response.body){
  const parts=[];let total=0;
  for await(const piece of response.body){const part=Buffer.from(piece);total+=part.length;if(total>MAX_BYTES)fail('FREE_PROVIDER_RESPONSE_TOO_LARGE',502,true);parts.push(part);}
  raw=Buffer.concat(parts).toString('utf8');
 }else raw=await response.text();
 if(Buffer.byteLength(raw)>MAX_BYTES)fail('FREE_PROVIDER_RESPONSE_TOO_LARGE',502,true);
 try{return JSON.parse(raw);}catch{fail('FREE_PROVIDER_RESPONSE_INVALID',502,true);}
}

/** Existing provider-style run interface. authorize() is required and must use
 * a trusted durable server policy/ledger; the default never enables Free.
 * No retries, account enrollment, paid fallback or external image URL fetches. */
export async function runFreeProvider(job,source,env,{fetcher=fetch,now=()=>Date.now(),authorize=null}={}){
 if(typeof authorize!=='function')fail('FREE_PROVIDER_NOT_CONFIGURED',503);
 let accountId,token;
 try{accountId=env('DF_CLOUDFLARE_ACCOUNT_ID');token=env('DF_CLOUDFLARE_API_TOKEN');}catch{fail('FREE_PROVIDER_NOT_CONFIGURED',503);}
 if(typeof accountId!=='string'||!/^[a-f0-9]{32}$/i.test(accountId)||typeof token!=='string'||token.length<20||token.length>5000)fail('FREE_PROVIDER_NOT_CONFIGURED',503);
 if(!plain(job)||job.model!==FREE_MODEL||!['enhance','expand','generate'].includes(job.operation)||!ID.test(job.job_id||'')||typeof job.provider_prompt!=='string'||!job.provider_prompt.trim()||job.provider_prompt.length>3000||!Number.isInteger(job.seed)||job.seed<0||job.seed>2147483647)fail('FREE_JOB_INVALID');
 const plan=verifiedPlan(job.free_plan),call=plan.calls.find(c=>c.call_id===job.job_id);
 if(!call)fail('FREE_PLAN_CALL_UNKNOWN');
 const references=source===null||source===undefined?[]:Array.isArray(source)?source:[source];
 if(references.length!==call.input_images||references.length>4||(job.operation==='generate'?references.length!==0:references.length===0))fail('FREE_REFERENCE_COUNT_INVALID');
 // Deterministic conversion is not AI enhancement; its hashes are explicit.
 const prepared=[];for(const reference of references)prepared.push(await prepareFreeReference(reference));
 const currentTime=now();let proof;
 try{proof=await authorize({account_id:accountId,model:FREE_MODEL,plan,call_id:job.job_id,now:currentTime});}catch{fail('FREE_AUTHORIZATION_UNAVAILABLE',503);}
 const reservation=verifyFreeAuthorization(proof,{accountId,plan,callId:job.job_id,now:now()});
 const body=new FormData();
 body.append('prompt',job.provider_prompt);body.append('width',String(call.width));body.append('height',String(call.height));body.append('seed',String(job.seed));
 for(let i=0;i<prepared.length;i++)body.append('input_image_'+i,new Blob([prepared[i].bytes],{type:'image/png'}),'reference-'+i+'.png');
 let response,requestId=null;
 try{response=await fetcher(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${FREE_MODEL}`,{method:'POST',headers:{authorization:`Bearer ${token}`},body,signal:AbortSignal.timeout(240000),redirect:'error'});}catch{fail('FREE_PROVIDER_TRANSPORT_UNCERTAIN',502,true);}
 requestId=safeRequestId(response.headers.get('cf-ray')||response.headers.get('x-request-id'));
 if(!response.ok)fail(response.status===429?'FREE_PROVIDER_RATE_LIMITED':'FREE_PROVIDER_REJECTED',response.status>=400&&response.status<=599?response.status:502,false,requestId);
 let data;
 try{data=await responseJSON(response);}catch(error){if(error instanceof FreeProviderError){error.requestId=requestId;throw error;}fail('FREE_PROVIDER_RESPONSE_INVALID',502,true,requestId);}
 if(data?.success===false)fail('FREE_PROVIDER_REJECTED',502,false,requestId);
 const encoded=data?.result?.image??data?.image;
 if(typeof encoded!=='string'||!encoded.length||encoded.length>MAX_BYTES||encoded.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))fail('FREE_PROVIDER_IMAGE_INVALID',502,true,requestId);
 const bytes=Buffer.from(encoded,'base64');let meta;
 try{meta=await sharp(bytes,{limitInputPixels:1920*1920,failOn:'error',animated:false}).metadata();if(!['png','jpeg','webp'].includes(meta.format)||(meta.pages||1)>1)fail('FREE_PROVIDER_IMAGE_INVALID',502,true,requestId);await sharp(bytes,{limitInputPixels:1920*1920,failOn:'error'}).raw().toBuffer();}catch{fail('FREE_PROVIDER_IMAGE_INVALID',502,true,requestId);}
 const width=meta.autoOrient?.width||meta.width,height=meta.autoOrient?.height||meta.height;
 if(width!==call.width||height!==call.height)fail('FREE_OUTPUT_DIMENSION_MISMATCH',502,true,requestId);
 return {bytes,provider:'cloudflare',model:FREE_MODEL,request_id:requestId,actual_cost:null,cost_currency:null,
  output:{width,height,mime:meta.format==='jpeg'?'image/jpeg':'image/'+meta.format,sha256:sha(bytes),byte_size:bytes.length,native_4k:false,resolution_verified:true,resolution_origin:'provider-native'},
  parameters:{provider_size:{width,height},steps:4,references:prepared.map(item=>item.receipt),free_reservation:reservation,pricing_version:FREE_PRICING.version,zero_overage_route:'workers-free-hard-limit',quality_verified:false}};
}
