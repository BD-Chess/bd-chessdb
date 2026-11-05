import {randomUUID} from 'node:crypto';
import {authenticateOmni,demoBudget} from './runtime.mjs';
import {callOpenAI} from './provider.mjs';
import {MODEL_PROFILES,DEFAULT_PROFILE,modelProfile} from '../../../public/OmniCPQ/model-profiles.mjs';
import {validateDemoRequest,DEMO_TASKS,DEMO_POLICY,DEMO_PRODUCT,DEMO_EXTENSION_ID,fixedDemoInstructions} from '../../../public/OmniCPQ/extension-demo/privacy.mjs';
const env=key=>globalThis.Netlify?.env?.get(key)??process.env[key];
const headers={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Vary':'Cookie, Origin'};
const failure=(code,status=503)=>Response.json({ok:false,error:{code}},{status,headers});
const allowedErrors=new Set(['DEMO_UNKNOWN_FIELD','DEMO_INVALID_SHAPE','DEMO_PROTECTION_REQUIRED','DEMO_OBSERVATION_INVALID','DEMO_OBSERVATION_STALE','DEMO_CONTROL_LIMIT','DEMO_REQUEST_INVALID','DEMO_REQUEST_LIMIT','DEMO_BRIDGE_IDENTITY',
 'DEMO_LIMIT','MONTHLY_LIMIT','DEMO_EXPIRED','DEMO_REVOKED','DEMO_IP_CHANGED','RATE_LIMITED','STORAGE_UNAVAILABLE','UNPRICED_MODEL','MODEL_UNAVAILABLE','MODEL_PROFILE_UNAVAILABLE','MODEL_IDENTITY_MISMATCH','MODEL_REASONING_MISMATCH','AI_UNAVAILABLE','EMPTY_RESPONSE','OUTPUT_LIMIT']);
async function boundedBody(req){
 if(Number(req.headers.get('content-length')||0)>131072)throw Object.assign(Error('DEMO_REQUEST_LIMIT'),{code:'DEMO_REQUEST_LIMIT',status:413});
 const reader=req.body?.getReader();if(!reader)throw Object.assign(Error(),{code:'DEMO_REQUEST_INVALID',status:400});
 const parts=[];let size=0;
 try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>131072){await reader.cancel();throw Object.assign(Error(),{code:'DEMO_REQUEST_LIMIT',status:413});}parts.push(r.value);}}
 finally{reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw Object.assign(Error(),{code:'DEMO_REQUEST_INVALID',status:400});}
}
export function buildDemoPayload(request){
 validateDemoRequest(request);
 const selected=modelProfile(request.profile);
 return {model:selected.model,reasoning:{effort:selected.reasoning},instructions:fixedDemoInstructions(),
  input:[{role:'user',content:[{type:'input_text',text:JSON.stringify({task:DEMO_TASKS[request.task],observation:request.observation})}]}],
  max_output_tokens:6000,store:false,service_tier:'default',stream:true};
}
export function makeDemoHandler({accessFactory=authenticateOmni,budgetFactory=demoBudget,transport=callOpenAI,enabled,timeoutMs=50000,requestGate}={}){
 const {seen,active}=requestGate||{seen:new Map(),active:new Set()};
 return async(req,context={})=>{
  if(context.site?.name&&context.site.name!=='mdlxdcc')return failure('SITE_UNAVAILABLE',404);
  if(!['GET','POST'].includes(req.method))return failure('METHOD_NOT_ALLOWED',405);
  if((req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)||req.headers.get('sec-fetch-site')==='cross-site')return failure('ORIGIN_NOT_ALLOWED',403);
  let actor;try{actor=await accessFactory(req,context);}catch(e){return failure(['AUTH_REQUIRED','DEMO_EXPIRED','DEMO_REVOKED'].includes(e?.code)?e.code:'AUTH_UNAVAILABLE',e?.status===401?401:503);}
  if(!['owner','demo'].includes(actor?.role))return failure('OWNER_REQUIRED',403);
  const available=enabled??(env('OMNICPQ_ENABLED')==='1'&&Boolean(env('OPENAI_API_KEY')));
  if(req.method==='GET')return Response.json({ok:true,available,product:DEMO_PRODUCT,policy:DEMO_POLICY,extensionId:DEMO_EXTENSION_ID,
   defaultProfile:DEFAULT_PROFILE,profiles:MODEL_PROFILES,configuredModel:modelProfile().model,observedModel:'UNKNOWN',
   protectionScope:'CLOSED_CLIENT_PAYLOAD_ONLY_NO_INDEPENDENT_STAGE_SECURITY_ACCEPTANCE',privateKnowledge:'NOT_USED',prices:'HIDDEN',resources:'HIDDEN',
   images:'BLOCKED',history:'BLOCKED',imports:'BLOCKED',freeText:'FIXED_TASKS_ONLY',businessWrites:'BLOCKED',usage:actor.usage||{exempt:true}},{headers});
  if(!available)return failure('AI_UNAVAILABLE');
  if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return failure('DEMO_REQUEST_INVALID',415);
  let request;try{request=validateDemoRequest(await boundedBody(req));}catch(e){return failure(allowedErrors.has(e?.code)?e.code:'DEMO_REQUEST_INVALID',e?.status===413?413:400);}
  const now=Date.now();for(const [key,when]of seen)if(now-when>600000)seen.delete(key);
  if(seen.size>2000)return failure('RATE_LIMITED',429);
  const dedupe=actor.id+':'+request.clientRequestId;
  if(seen.has(dedupe))return failure('DUPLICATE_REQUEST',409);
  if(active.has(actor.id))return failure('REQUEST_IN_PROGRESS',409);
  seen.set(dedupe,now);active.add(actor.id);
  const abort=new AbortController(),requestId=randomUUID(),encoder=new TextEncoder();
  const cancel=()=>abort.abort();req.signal.addEventListener('abort',cancel,{once:true});if(req.signal.aborted)abort.abort();
  let timedOut=false,ended=false;
  const timer=setTimeout(()=>{timedOut=true;abort.abort();},timeoutMs);
  const cleanup=()=>{clearTimeout(timer);req.signal.removeEventListener('abort',cancel);active.delete(actor.id);};
  const budget=budgetFactory(actor,'gpt',modelProfile(request.profile).model,{requestId:request.clientRequestId});
  const stream=new ReadableStream({
   async start(controller){
    let held=null,length=0;
    const send=(type,data={})=>{if(!ended)controller.enqueue(encoder.encode('data: '+JSON.stringify({type,requestId,clientRequestId:request.clientRequestId,...data})+'\n\n'));};
    try{
     if(abort.signal.aborted)throw Object.assign(Error(),{code:'CANCELLED'});
     const payload=buildDemoPayload(request);
     send('meta',{configuredModel:payload.model,observedModel:'UNKNOWN',requestedReasoning:payload.reasoning.effort,observedReasoning:'UNKNOWN',profile:request.profile,policy:DEMO_POLICY,privateKnowledge:'NOT_USED',simulation:false});
     held=await budget.reserve(payload);if(abort.signal.aborted)throw Object.assign(Error(),{code:'CANCELLED'});
     const result=await transport({payload,signal:abort.signal,onIdentity:value=>{if(!abort.signal.aborted)send('identity',value);},onText:text=>{
      if(abort.signal.aborted)return;if(typeof text!=='string'||length+text.length>200000)throw Object.assign(Error(),{code:'OUTPUT_LIMIT'});length+=text.length;send('delta',{text});
     }});
     if(abort.signal.aborted)throw Object.assign(Error(),{code:'CANCELLED'});
     if(!length)throw Object.assign(Error(),{code:'EMPTY_RESPONSE'});
     const accounting=await budget.settle(held,result.usage);held=null;
     send('done',{...result,budget:accounting,cost:null,costStatus:'UNKNOWN',policy:DEMO_POLICY});
    }catch(e){
     if(held)try{await budget.settle(held,null,[400,401,403,404,422,429].includes(e?.status));}catch{}
     const code=abort.signal.aborted?(timedOut?'TIMEOUT':'CANCELLED'):allowedErrors.has(e?.code)?e.code:'ANSWER_UNAVAILABLE';
     send('error',{code,partial:length>0});
    }finally{cleanup();if(!ended){ended=true;controller.close();}}
   },
   cancel(){ended=true;abort.abort();cleanup();}
  });
  return new Response(stream,{headers:{...headers,'Content-Type':'text/event-stream; charset=utf-8','X-Accel-Buffering':'no'}});
 };
}
