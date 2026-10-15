import {isIP} from 'node:net';
import {modelFor,keyFor} from './contracts.mjs';
import {masterGeometry} from './enhancement.mjs';

const jsonHeaders=key=>({'authorization':`Bearer ${key}`,'content-type':'application/json'});
const dataURI=bytes=>`data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
export class ProviderError extends Error {
 constructor(code,status=502,requestId=null,ambiguous=false,detail=''){super(code);this.code=code;this.status=status;this.requestId=requestId;this.ambiguous=ambiguous;this.detail=detail;}
}
export function safeImageURL(value){
 const u=new URL(value);const h=u.hostname.toLowerCase().replace(/^\[|\]$/g,'');
 if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||isIP(h)||h==='localhost'||h.endsWith('.local')||h.endsWith('.internal')||!h.includes('.'))throw new ProviderError('INVALID_PROVIDER_IMAGE_URL');
 return u.href;
}
function cleanError(data,key){const s=String(data?.error?.message||data?.message||data?.base_resp?.status_msg||data?.code||'').slice(0,700);return s.split(key).join('[redacted]').replace(/(?:sk-|AIza)[A-Za-z0-9_-]{16,}/g,'[redacted]').replace(/https:\/\/\S+/g,'[provider URL]').slice(0,500);}
export function requestSize(model,target,quality,source=false,sourceDimensions=null){
 if(sourceDimensions){
  if(model.provider!=='openai'||!model.edit)throw new ProviderError('ENHANCEMENT_MODEL_UNSUPPORTED',400);
  const geometry=masterGeometry(sourceDimensions.source_width||sourceDimensions.width,sourceDimensions.source_height||sourceDimensions.height,{maxEdge:Math.min(quality==='4k'?3840:1920,model.editMaxEdge||model.maxEdge||3840),multiple:16});
  return {...geometry,aspect:geometry.source_aspect_ratio};
 }
 let [w,h]=target==='portrait'?(quality==='4k'?[2160,3840]:[1080,1920]):(quality==='4k'?[3840,2160]:[1920,1080]);
 const edge=source?(model.editMaxEdge||model.maxEdge):model.maxEdge;
 if(edge&&Math.max(w,h)>edge){const f=edge/Math.max(w,h);w=Math.floor(w*f);h=Math.floor(h*f);}
 const multiple=model.provider==='openai'?16:model.provider==='minimax'?8:model.provider==='zai'?32:1;
 const round=model.provider==='openai'?Math.ceil:Math.floor;w=Math.max(multiple,round(w/multiple)*multiple);h=Math.max(multiple,round(h/multiple)*multiple);
 return {width:w,height:h,aspect:target==='portrait'?'9:16':'16:9'};
}
export function providerRequest(job,source,env){
 const m=modelFor(job.model),key=m&&keyFor(m,env);if(!m)throw new ProviderError('MODEL_UNKNOWN',400);if(!key)throw new ProviderError('KEY_NOT_CONFIGURED',503);
 const edit=job.operation!=='generate'&&!!source;
 if(edit&&!m.edit)throw new ProviderError('MODEL_GENERATION_ONLY',400);
 if(job.operation==='enhance'&&(!edit||m.provider!=='openai'))throw new ProviderError('ENHANCEMENT_MODEL_UNSUPPORTED',400);
 const sourceDimensions=job.operation==='enhance'?(job._master_geometry||job.master_geometry):null;
 if(job.operation==='enhance'&&!sourceDimensions)throw new ProviderError('ENHANCEMENT_GEOMETRY_REQUIRED',400);
 const size=requestSize(m,job.target,job.quality,edit,sourceDimensions),prompt=job.provider_prompt||job.prompt;
 if(typeof prompt!=='string'||!prompt.trim())throw new ProviderError('PROVIDER_PROMPT_REQUIRED',400);
 // Provider limits are rejection boundaries. Silent truncation changes the
 // user's task and can remove its identity/preservation instructions.
 const promptLimit=m.provider==='minimax'?1500:m.key==='qwen-zimage'?800:12000;
 if(prompt.length>promptLimit)throw new ProviderError('PROVIDER_PROMPT_TOO_LONG',400);
 const base={model:m,key,edit,size,prompt,provider:m.provider};
 if(m.provider==='openai'){
  const fields={model:m.model,prompt,quality:job.provider_quality||'high',size:`${size.width}x${size.height}`,n:'1',output_format:'png'};
  if(edit){const body=new FormData();for(const [k,v] of Object.entries(fields))body.append(k,v);body.append('image[]',new Blob([source],{type:'image/png'}),'source.png');if(job.operation==='expand'&&(job.master_hash||job.master_sha256)&&job._original_reference)body.append('image[]',new Blob([job._original_reference],{type:'image/png'}),'original-reference.png');if(job._mask)body.append('mask',new Blob([job._mask],{type:'image/png'}),'mask.png');return {...base,url:'https://api.openai.com/v1/images/edits',headers:{authorization:`Bearer ${key}`},body};}
  return {...base,url:'https://api.openai.com/v1/images/generations',headers:jsonHeaders(key),body:JSON.stringify({...fields,n:1})};
 }
 if(m.provider==='gemini'){
  const input=edit?[{type:'text',text:prompt},{type:'image',data:Buffer.from(source).toString('base64'),mime_type:'image/png'}]:prompt;
  return {...base,url:'https://generativelanguage.googleapis.com/v1beta/interactions',headers:{'x-goog-api-key':key,'content-type':'application/json'},body:JSON.stringify({model:m.model,input,response_format:{type:'image',mime_type:'image/png',aspect_ratio:size.aspect,image_size:job.quality==='4k'?'4K':'2K'}})};
 }
 if(m.provider==='xai')return {...base,url:`https://api.x.ai/v1/images/${edit?'edits':'generations'}`,headers:jsonHeaders(key),body:JSON.stringify({model:m.model,prompt,n:1,aspect_ratio:size.aspect,resolution:'2k',quality:'medium',response_format:'b64_json',...(edit?{image:{type:'image_url',url:dataURI(source)}}:{})})};
 if(m.provider==='minimax')return {...base,url:'https://api.minimax.io/v1/image_generation',headers:jsonHeaders(key),body:JSON.stringify({model:m.model,prompt,width:size.width,height:size.height,n:1,response_format:'base64',...(Number.isInteger(job.seed)?{seed:job.seed}:{}),...(edit?{subject_reference:[{type:'character',image_file:dataURI(source)}]}:{})})};
 if(m.provider==='zai'){
  const preset=job.target==='portrait'?'1056x1568':'1568x1056';
  return {...base,url:'https://api.z.ai/api/paas/v4/images/generations',headers:jsonHeaders(key),body:JSON.stringify({model:m.model,prompt,size:preset,quality:'hd'})};
 }
 if(m.provider==='qwen'){
  const host=(env('DF_QWEN_API_HOST')||'https://ws-w0wh18jpdbeyf7d7.ap-southeast-1.maas.aliyuncs.com').replace(/\/$/,'');
  const u=new URL(host);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||!(u.hostname.endsWith('.maas.aliyuncs.com')||['dashscope-intl.aliyuncs.com','dashscope.aliyuncs.com'].includes(u.hostname)))throw new ProviderError('QWEN_HOST_INVALID',503);
  if(m.key==='qwen-zimage'){
   // Z-Image Turbo now uses Model Studio synchronous multimodal generation; the old
   // text2image/image-synthesis async protocol is for legacy model families.
   const outputSize=job.target==='portrait'?(job.quality==='4k'?'1152*2048':'864*1536'):(job.quality==='4k'?'2048*1152':'1536*864');
   return {...base,url:`${host}/api/v1/services/aigc/multimodal-generation/generation`,headers:jsonHeaders(key),body:JSON.stringify({model:m.model,input:{messages:[{role:'user',content:[{text:prompt}]}]},parameters:{size:outputSize,prompt_extend:false,...(Number.isInteger(job.seed)?{seed:job.seed}:{})}})};
  }
  return {...base,url:`${host}/api/v1/services/aigc/multimodal-generation/generation`,headers:jsonHeaders(key),body:JSON.stringify({model:m.model,input:{messages:[{role:'user',content:[...(edit?[{image:dataURI(source)}]:[]),{text:prompt}]}]},parameters:{size:`${size.width}*${size.height}`,n:1,prompt_extend:false,watermark:false}})};
 }
 if(m.provider==='mistral')return {...base,url:'https://api.mistral.ai/v1/agents',headers:jsonHeaders(key),body:JSON.stringify({model:m.model,name:'DualFrame Image R&D',instructions:'Generate exactly one image requested by the user. Use the image_generation tool once.',tools:[{type:'image_generation'}]})};
 throw new ProviderError('PROVIDER_UNKNOWN',400);
}
export function findImage(data){
 // Gemini Interactions responds with steps[].content[]; return the most recent completed
 // model image, not a text block. Legacy SDKs also surface output_image.data.
 if(Array.isArray(data?.steps)){
  const modelSteps=data.steps.filter(s=>s?.type==='model_output').reverse();
  for(const step of modelSteps)for(const content of [...(step.content||[])].reverse()){
   if(content?.type==='image'&&typeof content.data==='string'&&content.data.length>0)
    return {base64:content.data,mime:content.mime_type||'image/jpeg'};
  }
 }
 if(data?.output?.results?.[0]?.url)return {url:data.output.results[0].url};
 if(data?.output_image?.data)return {base64:data.output_image.data,mime:data.output_image.mime_type||'image/jpeg'};
 if(data?.data?.[0]?.b64_json)return {base64:data.data[0].b64_json,mime:'image/png'};
 if(data?.data?.[0]?.url)return {url:data.data[0].url};
 if(data?.data?.image_base64?.[0])return {base64:data.data.image_base64[0],mime:'image/png'};
 if(data?.data?.image_urls?.[0])return {url:data.data.image_urls[0]};
 const walk=(obj,depth=0)=>{if(depth>12||!obj)return null;if(Array.isArray(obj)){for(const x of obj){const y=walk(x,depth+1);if(y)return y;}return null;}if(typeof obj!=='object')return null;
  if(obj.type==='image'&&typeof obj.data==='string')return {base64:obj.data,mime:obj.mime_type||'image/png'};
  if(obj.inlineData?.data)return {base64:obj.inlineData.data,mime:obj.inlineData.mimeType||'image/png'};
  if(typeof obj.image==='string')return obj.image.startsWith('data:')?{base64:obj.image.split(',')[1],mime:'image/png'}:{url:obj.image};
  if(obj.file_id&&obj.type==='tool_file')return {file:obj.file_id};
  if(typeof obj.url==='string'&&['image_url','image'].includes(obj.type))return {url:obj.url};
  for(const [k,v] of Object.entries(obj)){if(['steps','choices','outputs','output','content','message','candidates','results','data'].includes(k)){const y=walk(v,depth+1);if(y)return y;}}return null;};
 return walk(data);
}
export async function callProvider(job,source,env,{fetcher=fetch,delay=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const request=providerRequest(job,source,env);let requestId=null;
 async function json(url,body,headers=request.headers,method='POST',billable=false){
  let r;try{r=await fetcher(url,{method,headers,body:body??undefined,signal:AbortSignal.timeout(240000),redirect:'error'});}catch{throw new ProviderError('PROVIDER_TRANSPORT_UNCERTAIN',502,requestId,billable);}
  requestId=r.headers.get('x-request-id')||r.headers.get('request-id')||requestId;
  let data;try{data=await r.json();}catch{throw new ProviderError('PROVIDER_RESPONSE_INVALID',502,requestId,billable);}
  if(!r.ok||data?.base_resp?.status_code){throw new ProviderError('PROVIDER_REJECTED',r.status>=400?r.status:502,requestId,false,cleanError(data,request.key));}
  return data;
 }
 let data=await json(request.url,request.body,request.headers,'POST',request.provider!=='mistral');
 if(request.provider==='mistral'){
  const id=data.id;if(!id||!/^[a-zA-Z0-9_-]+$/.test(id))throw new ProviderError('MISTRAL_AGENT_ID_INVALID');
  data=await json('https://api.mistral.ai/v1/conversations',JSON.stringify({agent_id:id,inputs:request.prompt}),request.headers,'POST',true);
 }
 if(request.provider==='qwen'&&data.output?.task_id){
  const id=data.output.task_id;if(!/^[a-zA-Z0-9_-]+$/.test(id))throw new ProviderError('PROVIDER_TASK_ID_INVALID');
  const u=new URL(request.url);const poll=`${u.origin}/api/v1/tasks/${id}`;requestId=id;
  let ready=false;for(let i=0;i<90;i++){data=await json(poll,null,request.headers,'GET');const status=data.output?.task_status;if(status==='SUCCEEDED'){ready=true;break;}if(['FAILED','CANCELED'].includes(status))throw new ProviderError('PROVIDER_TASK_FAILED',502,requestId,false,cleanError(data,request.key));await delay(2000);}
  if(!ready)throw new ProviderError('PROVIDER_TASK_PENDING',502,requestId,true);
 }
 const image=findImage(data);if(!image)throw new ProviderError('NO_IMAGE_RETURNED',502,requestId,false,cleanError(data,request.key));
 let bytes;
 if(image.base64){if(image.base64.length>100*1024*1024)throw new ProviderError('PROVIDER_IMAGE_TOO_LARGE');bytes=Buffer.from(image.base64.replace(/^data:[^,]+,/,''),'base64');}
 else{
  const url=image.file?`https://api.mistral.ai/v1/files/${encodeURIComponent(image.file)}/content`:safeImageURL(image.url);
  let r;try{r=await fetcher(url,{headers:image.file?{authorization:`Bearer ${request.key}`}:{},signal:AbortSignal.timeout(90000),redirect:'error'});}catch{throw new ProviderError('IMAGE_DOWNLOAD_FAILED',502,requestId);}
  if(!r.ok)throw new ProviderError('IMAGE_DOWNLOAD_FAILED',r.status,requestId);
  if(Number(r.headers.get('content-length'))>75*1024*1024)throw new ProviderError('PROVIDER_IMAGE_TOO_LARGE');
  const chunks=[];let total=0;for await(const chunk of r.body){total+=chunk.byteLength;if(total>75*1024*1024)throw new ProviderError('PROVIDER_IMAGE_TOO_LARGE');chunks.push(Buffer.from(chunk));}bytes=Buffer.concat(chunks);
 }
 if(!bytes?.length)throw new ProviderError('NO_IMAGE_RETURNED');
 return {bytes,provider:request.provider,model:request.model.model,request_id:requestId||data.request_id||data.id||null,actual_cost:null,cost_currency:null,parameters:{target:job.target,quality:job.quality,provider_size:request.size,seed_applied:['minimax'].includes(request.provider)?job.seed:null,reference_type:request.edit?request.model.reference||'image':null}};
}
