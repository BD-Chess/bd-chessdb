import {randomUUID} from 'node:crypto';
const LEGACY_OWNER='bd-research-owner';
const fail=(code,status=503)=>{throw Object.assign(Error(code),{code,status});};
const encoder=new TextEncoder();
/** Server-only adapter. Request sizes, owner and resource keys never come from a
 * browser's claimed usage counters. An uncertain stream retains its SQL claim. */
export function createAccountUsageControls({accountUsage=null}){
 const owners=new WeakMap();
 const required=['reserveStorage','authorizeReservedStorage','authorizePlanAsset','beginTransfer','completeTransfer','holdTransfer'];
 function backend(owner){if(owner===LEGACY_OWNER)return null;if(!required.every(k=>typeof accountUsage?.[k]==='function'))fail('BYTE_USAGE_POLICY_NOT_CONFIGURED');return accountUsage;}
 async function readBody(req,max){
  const owner=owners.get(req),api=owner?backend(owner):null,raw=req.headers.get('content-length');
  if(raw!==null&&!/^\d+$/.test(raw))fail('CONTENT_LENGTH_INVALID',400);
  const declared=raw===null?null:Number(raw);if(declared!==null&&(!Number.isSafeInteger(declared)||declared>max))fail('REQUEST_TOO_LARGE',413);
  const lease=api?await api.beginTransfer({owner,request_id:randomUUID(),byte_count:max}):null;
  const reader=req.body?.getReader(),parts=[];let total=0,complete=false;
  try{if(reader)while(true){const item=await reader.read();if(item.done)break;total+=item.value.byteLength;if(total>max||(declared!==null&&total>declared)){await reader.cancel().catch(()=>{});fail('REQUEST_TOO_LARGE',413);}parts.push(Buffer.from(item.value));}if(declared!==null&&total!==declared)fail('CONTENT_LENGTH_MISMATCH',400);complete=true;return Buffer.concat(parts,total);}
  finally{if(lease){if(complete)await api.completeTransfer({owner,claim_id:lease.claim_id,actual_bytes:total});else await api.holdTransfer({owner,claim_id:lease.claim_id,actual_bytes:total});}}
 }
 async function readJSON(req,max=16000){const data=await readBody(req,max);try{return JSON.parse(data.toString('utf8'));}catch{fail('INVALID_JSON',400);}}
 async function meterResponse(req,response){
  const owner=owners.get(req);if(!owner||owner===LEGACY_OWNER||response.status>=400)return response;const api=backend(owner);
  // JSON and ranged bytes are already bounded by the service. Use exact encoded
  // bytes rather than trusting Content-Length provided by the caller.
  const declared=response.headers.get('content-length'),length=declared!==null?Number(declared):(await response.clone().arrayBuffer()).byteLength;
  if(!Number.isSafeInteger(length)||length<0)fail('TRANSFER_LENGTH_UNKNOWN');
  const lease=await api.beginTransfer({owner,request_id:randomUUID(),byte_count:length}),reader=response.body?.getReader();let actual=0,ended=false;
  const hold=async()=>{if(!ended){ended=true;await api.holdTransfer({owner,claim_id:lease.claim_id});}};
  const stream=new ReadableStream({async pull(controller){try{const item=reader?await reader.read():{done:true};if(item.done){if(actual!==length)fail('TRANSFER_LENGTH_MISMATCH');await api.completeTransfer({owner,claim_id:lease.claim_id,actual_bytes:actual});ended=true;controller.close();}else{actual+=item.value.byteLength;if(actual>length)fail('TRANSFER_RESERVED_BOUND_EXCEEDED');controller.enqueue(item.value);}}catch(error){await hold().catch(()=>{});controller.error(error);}},async cancel(){await reader?.cancel().catch(()=>{});await hold();}});
  const headers=new Headers(response.headers);headers.set('content-length',String(length));return new Response(stream,{status:response.status,statusText:response.statusText,headers});
 }
 return {markOwner:(req,owner)=>{owners.set(req,owner);backend(owner);},readBody,readJSON,meterResponse,
  reserveStorage:input=>backend(input.owner)?.reserveStorage(input),
  authorizeReservedStorage:input=>backend(input.owner)?.authorizeReservedStorage(input),
  authorizePlanAsset:input=>backend(input.owner)?.authorizePlanAsset(input),
  configured:()=>required.every(k=>typeof accountUsage?.[k]==='function'),
  jsonBytes:value=>encoder.encode(JSON.stringify(value)).byteLength};
}
