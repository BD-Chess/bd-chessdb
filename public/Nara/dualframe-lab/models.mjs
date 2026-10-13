// Provider contracts are capabilities, not evidence that live access is enabled.
import { canonicalMode } from './core.mjs?v=2.0-r4';
const model=(key,provider,label,endpoint,modes,extras={})=>Object.freeze({key,provider,label,endpoint,provider_model_id:endpoint,modes:Object.freeze(modes),live:provider!=='demo',...extras});
export const MODEL_REGISTRY=Object.freeze({
  demo:model('demo','demo','Local composition preview','deterministic-canvas-v2',['faithful','smart','infographic'],{is_ai:false,native_4k:false,seed_support:true}),
  'bria-direct':model('bria-direct','bria','Bria Expand · direct','https://engine.prod.bria-api.com/v2/image/edit/expand',['faithful','smart'],{is_ai:true,pixel_preservation:'gateway-compositing-and-proof',seed_support:true}),
  'fal-bria':model('fal-bria','fal','Bria Expand · fal.ai','fal-ai/bria/expand',['faithful','smart'],{is_ai:true,pixel_preservation:'gateway-compositing-and-proof',seed_support:true}),
  'fal-sunburst':model('fal-sunburst','fal','GPT Image 2.5 Sunburst Edit','openai/gpt-image-2.5/sunburst/edit',['faithful','smart','infographic'],{is_ai:true,pixel_preservation:'gateway-compositing-and-proof'}),
  'fal-nano':model('fal-nano','fal','Nano Banana 2.1 Edit','google/nano-banana-2.1/edit',['faithful','smart','infographic'],{is_ai:true,pixel_preservation:'gateway-compositing-and-proof'})
});
export const MODELS=Object.freeze(Object.values(MODEL_REGISTRY));
export function modelFor(key){return MODEL_REGISTRY[key==='bria'?'bria-direct':key]||null;}
export function supportsMode(key,mode){return Boolean(modelFor(key)?.modes.includes(canonicalMode(mode)));}
export function modelsForMode(mode){return MODELS.filter(item=>supportsMode(item.key,mode));}
