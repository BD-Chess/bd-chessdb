// Local preferences are optional UI state; no API keys, passwords or image bytes live here.
export const SETTINGS_KEY='bd-dualframe-settings-v1';
export const HEALTH_KEY='bd-dualframe-model-health-v1';
export const DEFAULT_ENABLED_MODELS=Object.freeze(['wan-image-pro','grok-imagine','openai-flare','openai-sunburst']);
export const DEFAULT_SETTINGS=Object.freeze({
 mode:'smart',model:'openai-sunburst',quality:'hd',position:'center',rememberLast:false,
 enabledModels:[...DEFAULT_ENABLED_MODELS],galleryCollection:'all',viewerQuality:'auto',
 delaySeconds:1,autoSyncMetadata:true,preloadAdjacent:true
});
export function normalizeSettings(source={},keys=null){
 const item=source&&typeof source==='object'?source:{};
 const validKeys=new Set(keys||['wan-image-pro','grok-imagine','openai-flare','openai-sunburst','gemini-nano','qwen-image-pro','qwen-image','qwen-zimage','minimax-image','glm-image','mistral-image']);
 let enabled=Array.isArray(item.enabledModels)?[...new Set(item.enabledModels.filter(k=>validKeys.has(k)))]:DEFAULT_ENABLED_MODELS.filter(k=>validKeys.has(k));
 if(!enabled.length)enabled=DEFAULT_ENABLED_MODELS.filter(k=>validKeys.has(k)); // Always retain at least one active model.
 if(!enabled.length)enabled=[...validKeys].slice(0,1);
 const model=enabled.includes(item.model)?item.model:enabled.includes(DEFAULT_SETTINGS.model)?DEFAULT_SETTINGS.model:enabled[0];
 const one=(v,choices,fallback)=>choices.includes(v)?v:fallback;
 const delay=Number(item.delaySeconds);
 return {
 mode:one(item.mode,['faithful','smart','infographic'],DEFAULT_SETTINGS.mode),
 model,quality:one(item.quality,['hd','4k'],DEFAULT_SETTINGS.quality),
 position:one(item.position,['center','left','right','top','bottom'],DEFAULT_SETTINGS.position),
 rememberLast:item.rememberLast===true,
 enabledModels:enabled,galleryCollection:one(item.galleryCollection,['all','own','reference','favorites'],DEFAULT_SETTINGS.galleryCollection),
 viewerQuality:one(item.viewerQuality,['auto','hd','4k'],DEFAULT_SETTINGS.viewerQuality),
 delaySeconds:[0,0.5,1,2,3,4,5].includes(delay)?delay:DEFAULT_SETTINGS.delaySeconds,
 autoSyncMetadata:item.autoSyncMetadata!==false,preloadAdjacent:item.preloadAdjacent!==false
 };
}
export function readSettings(storage=globalThis.localStorage,keys=null){
 try{return normalizeSettings(JSON.parse(storage.getItem(SETTINGS_KEY)||'null'),keys);}
 catch{return normalizeSettings({},keys);}
}
export function writeSettings(config,storage=globalThis.localStorage,keys=null){
 const value=normalizeSettings(config,keys);
 storage.setItem(SETTINGS_KEY,JSON.stringify(value));return value;
}
export function orientationTransition(previous,target,delaySeconds){
 return !previous||previous===target?'unchanged':Number(delaySeconds)>0?'delay':'immediate';
}
export function estimateHydrationSafety(estimate,size){
 if(!estimate?.supported||!Number.isFinite(estimate?.quota)||!Number.isFinite(estimate?.usage))return {safe:true,known:false,reason:'STORAGE_ESTIMATE_UNAVAILABLE'};
 const free=Math.max(0,estimate.quota-estimate.usage);
 const reserve=Math.max(40*1048576,estimate.quota*.1);
 return {safe:Number.isFinite(size)&&size>=0&&free>=size+reserve,known:true,free,reserve,reason:free>=size+reserve?'OK':'STORAGE_ESTIMATED_LOW'};
}
export function readModelHealth(storage=globalThis.localStorage){
 try{const x=JSON.parse(storage.getItem(HEALTH_KEY)||'{}');return x&&typeof x==='object'&&!Array.isArray(x)?x:{};}catch{return {};}
}
export function recordModelHealth(key,task,status,storage=globalThis.localStorage){
 if(!key||!['READY','ACCEPTED','FAILED','HELD','CANCELLED'].includes(status))return;
 try{const data=readModelHealth(storage),prior=data[key]||{},item={lastTask:task==='generate'?'generate':'expand',lastStatus:status,lastAt:new Date().toISOString(),successful:(prior.successful||0)+(['READY','ACCEPTED'].includes(status)?1:0),failed:(prior.failed||0)+(status==='FAILED'?1:0)};
 data[key]=item;storage.setItem(HEALTH_KEY,JSON.stringify(data));}catch{}
}

/** True transfer size, not the historical size/bytes guess. The API emits byte_size. */
export function remoteTransferBytes(assets){
 if(!Array.isArray(assets)||!assets.length)throw Error('STORAGE_REMOTE_SIZE_UNKNOWN');
 let total=0;
 for(const asset of assets){
  const n=Number(asset?.byte_size??asset?.size??asset?.bytes);
  if(!Number.isSafeInteger(n)||n<=0)throw Error('STORAGE_REMOTE_SIZE_UNKNOWN');
  total+=n;
  if(!Number.isSafeInteger(total))throw Error('STORAGE_REMOTE_SIZE_UNKNOWN');
 }
 return total;
}
