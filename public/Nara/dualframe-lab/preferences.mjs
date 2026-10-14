// DualFrame AI v3.0 preferences — presentation choices only, never credentials.
export const SETTINGS_KEY='bd-dualframe-settings-v1';
export const DEFAULT_MODELS=Object.freeze(['wan-image-pro','grok-imagine','openai-flare','openai-sunburst']);
const MODES=new Set(['faithful','smart','infographic']),QUALITIES=new Set(['hd','4k']),POSITIONS=new Set(['center','left','right','top','bottom']);
export const SETTINGS_DEFAULTS=Object.freeze({mode:'smart',model:'openai-sunburst',quality:'hd',position:'center',enabledModels:[...DEFAULT_MODELS],rememberLast:false,galleryCollection:'all',delaySeconds:2,metadataSyncOnStart:true,maxCloudDownloadMB:96});
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
export function validateSettings(input,validModels=DEFAULT_MODELS){
 const data=input&&typeof input==='object'&&!Array.isArray(input)?input:{},allowed=new Set(validModels),defaults=SETTINGS_DEFAULTS;
 const enabled=Array.isArray(data.enabledModels)?[...new Set(data.enabledModels.filter(k=>typeof k==='string'&&allowed.has(k)))]:[...defaults.enabledModels];
 // Preserve user intent, but always retain at least one model for Create.
 if(!enabled.length)enabled.push(defaults.model);
 return {
  mode:MODES.has(data.mode)?data.mode:defaults.mode,
  model:enabled.includes(data.model)?data.model:(enabled.includes(defaults.model)?defaults.model:enabled[0]),
  quality:QUALITIES.has(data.quality)?data.quality:defaults.quality,
  position:POSITIONS.has(data.position)?data.position:defaults.position,
  enabledModels:enabled,
  rememberLast:data.rememberLast===true,
  galleryCollection:['all','own','reference','favorites'].includes(data.galleryCollection)?data.galleryCollection:defaults.galleryCollection,
  delaySeconds:Number.isInteger(data.delaySeconds)&&data.delaySeconds>=0&&data.delaySeconds<=5?data.delaySeconds:defaults.delaySeconds,
  metadataSyncOnStart:data.metadataSyncOnStart!==false,
  maxCloudDownloadMB:Number.isInteger(data.maxCloudDownloadMB)&&data.maxCloudDownloadMB>=16&&data.maxCloudDownloadMB<=256?data.maxCloudDownloadMB:defaults.maxCloudDownloadMB
 };
}
export function readSettings(storage=globalThis.localStorage,models=DEFAULT_MODELS){
 try{return validateSettings(JSON.parse(storage?.getItem(SETTINGS_KEY)||'null'),models);}catch{return validateSettings(null,models);}
}
export function saveSettings(value,storage=globalThis.localStorage,models=DEFAULT_MODELS){
 const result=validateSettings(value,models);
 try{storage?.setItem(SETTINGS_KEY,JSON.stringify(result));}catch{}
 return result;
}
export function storageBudget(estimate,neededBytes,maxMB,reserveBytes=32*1024*1024){
 const requested=Number(neededBytes);
 if(!Number.isFinite(requested)||requested<0)return {allowed:false,reason:'STORAGE_UNKNOWN_SIZE'};
 if(requested>maxMB*1024*1024)return {allowed:false,reason:'STORAGE_TRANSFER_LIMIT'};
 const free=Number(estimate?.quota)-Number(estimate?.usage);
 if(Number.isFinite(free)&&Number(estimate?.quota)>0&&free-reserveBytes<requested*1.25)return {allowed:false,reason:'STORAGE_LOW_SPACE'};
 return {allowed:true,reason:null};
}
export function delayTransition(previous,next,seconds){
 if(previous===next||seconds===0)return {show:next,waitMs:0};
 return {show:previous,waitMs:seconds*1000};
}
