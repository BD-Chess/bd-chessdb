// Read-only vendor model access probes. No image generation, file, POST or billing endpoint calls.
// Provider API keys never leave the server. Never include upstream response bodies in the result.
import {MODELS,modelFor,keyFor} from './contracts.mjs';

const ids=new Set(MODELS.map(m=>m.key));
const defaultQwen='https://ws-w0wh18jpdbeyf7d7.ap-southeast-1.maas.aliyuncs.com';
function qwenCatalogHost(env){
 const raw=String(env('DF_QWEN_API_HOST')||defaultQwen).replace(/\/+$/,'');
 const u=new URL(raw);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.port&&u.port!=='443'||!(u.hostname.endsWith('.maas.aliyuncs.com')||['dashscope-intl.aliyuncs.com','dashscope.aliyuncs.com'].includes(u.hostname)))throw Error('PROBE_HOST_INVALID');
 return raw+'/api/v1/models';
}
function spec(model,key,env){
 const headers={'authorization':'Bearer '+key};
 switch(model.provider){
  case 'openai':return{url:'https://api.openai.com/v1/models/'+encodeURIComponent(model.model),headers,direct:true};
  case 'xai':return{url:'https://api.x.ai/v1/image-generation-models/'+encodeURIComponent(model.model),headers,direct:true};
  case 'gemini':return{url:'https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model.model),headers:{'x-goog-api-key':key},direct:true};
  case 'qwen':return{url:qwenCatalogHost(env),headers,direct:false};
  case 'mistral':return{url:'https://api.mistral.ai/v1/models',headers,direct:false};
  default:return null; // Other vendors: no verified free read-only model endpoint in this adapter.
 }
}
function idsFrom(data){
 const candidates=[data?.data?.models,data?.data?.data,data?.data,data?.models,data?.output?.models];
 const arr=candidates.find(Array.isArray)||[];
 return arr.flatMap(x=>[x?.id,x?.model,x?.model_id,x?.name,...(Array.isArray(x?.aliases)?x.aliases:[])]).filter(x=>typeof x==='string');
}
export function classifyResponse(code,{direct=false,modelId=null,data=null}={}){
 if(code===401)return 'AUTH_FAILED';
 if(code===403)return 'PERMISSION_DENIED';
 if(code===404)return direct?'MODEL_NOT_FOUND':'CATALOG_NOT_AVAILABLE';
 if(code===429)return 'RATE_LIMITED';
 if(code>=500)return 'PROVIDER_ERROR';
 if(code!==200)return 'PROBE_UNAVAILABLE';
 if(direct)return data?.id===modelId||data?.name==='models/'+modelId?'MODEL_ACCESSIBLE':'PROVIDER_REACHABLE';
 const models=idsFrom(data);
 return models.includes(modelId)?'MODEL_ACCESSIBLE':'PROVIDER_REACHABLE';
}
export async function probeModelKeys(modelKeys,env,{fetcher=fetch,now=()=>Date.now()}={}){
 if(!Array.isArray(modelKeys)||!modelKeys.length||modelKeys.length>MODELS.length||modelKeys.some(k=>typeof k!=='string'||!ids.has(k))||new Set(modelKeys).size!==modelKeys.length)throw Error('INVALID_PROBE_MODELS');
 const checked_at=new Date(now()).toISOString();
 const work=modelKeys.map(async key=>{
  const model=modelFor(key),configured=Boolean(keyFor(model,env));
  const result={key,provider:model.provider,configured,checked_at,probe:'none',status:'KEY_MISSING',generation_tested:false,editing_tested:false};
  if(!configured)return result;
  let cfg;try{cfg=spec(model,keyFor(model,env),env);}catch{return{...result,status:'PROBE_CONFIG_ERROR'};}
  if(!cfg)return{...result,status:'PROBE_UNAVAILABLE'};
  result.probe=cfg.direct?'read_only_model_get':'read_only_model_catalog';
  let response;
  try{response=await fetcher(cfg.url,{method:'GET',headers:cfg.headers,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(7000)});}
  catch{return{...result,status:'NETWORK_ERROR'};}
  let data=null;
  if(response.status===200){
   const length=Number(response.headers?.get?.('content-length'));
   if(!Number.isFinite(length)||length<=512*1024)try{data=await response.json();}catch{}
  }
  return {...result,status:classifyResponse(response.status,{direct:cfg.direct,modelId:model.model,data})};
 });
 return {schema:'bd.dualframe.provider-probes.v1',checked_at,models:await Promise.all(work),billable_requests:0};
}
