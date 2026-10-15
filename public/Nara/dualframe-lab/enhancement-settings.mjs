export const ENHANCEMENT_SETTINGS_KEY='bd-dualframe-enhancement-v1';
export const DEFAULT_ENHANCEMENT_SETTINGS=Object.freeze({natural:true,artistic:false,background:'keep',strength:'natural',tier:'free',model:'openai-sunburst',includeHD:false,reviewMaster:false});
export function normalizeEnhancementSettings(value={}){
 const v=value&&typeof value==='object'?value:{};
 return {natural:v.natural!==false,artistic:v.artistic===true,background:['keep','cleanup','replace','studio'].includes(v.background)?v.background:'keep',strength:['subtle','natural','strong'].includes(v.strength)?v.strength:'natural',tier:v.tier==='premium'?'premium':'free',model:['openai-sunburst','openai-flare'].includes(v.model)?v.model:'openai-sunburst',includeHD:v.includeHD===true,reviewMaster:v.reviewMaster===true};
}
export function readEnhancementSettings(storage){try{return normalizeEnhancementSettings(JSON.parse(storage.getItem(ENHANCEMENT_SETTINGS_KEY)||'null'));}catch{return normalizeEnhancementSettings();}}
export function writeEnhancementSettings(value,storage){const result=normalizeEnhancementSettings(value);storage.setItem(ENHANCEMENT_SETTINGS_KEY,JSON.stringify(result));return result;}
