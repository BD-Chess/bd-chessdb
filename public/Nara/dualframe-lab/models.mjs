// Provider contracts are capabilities, not evidence that live access is enabled.
import { canonicalMode } from './core.mjs?v=3.0-r4.11';
const model=(key,provider,label,endpoint,modes,extras={})=>Object.freeze({key,provider,label,endpoint,provider_model_id:endpoint,modes:Object.freeze(modes),live:provider!=='demo',...extras});
export const MODEL_REGISTRY=Object.freeze({
  'openai-sunburst':model('openai-sunburst','openai','GPT Image 2.5 Sunburst','gpt-image-2.5-sunburst',['faithful','smart','infographic'],{direct:true,edit:true,max_edge:3840}),
  'openai-flare':model('openai-flare','openai','GPT Image 2.5 Flare','gpt-image-2.5-flare',['faithful','smart','infographic'],{direct:true,edit:true,max_edge:3840}),
  'gemini-nano':model('gemini-nano','gemini','Nano Banana 2.1','gemini-nano-banana-2.1',['faithful','smart','infographic'],{direct:true,edit:true,max_edge:5504}),
  'grok-imagine':model('grok-imagine','xai','Grok Imagine Image 2.0','grok-imagine-image-2.0',['faithful','smart','infographic'],{direct:true,edit:true,max_edge:2048}),
  'qwen-image-pro':model('qwen-image-pro','qwen','Qwen Image 3.0 Pro','qwen-image-3.0-pro',['faithful','smart','infographic'],{direct:true,edit:true,max_edge:2048}),
  'qwen-image':model('qwen-image','qwen','Qwen Image 3.0','qwen-image-3.0',['faithful','smart','infographic'],{direct:true,edit:true,max_edge:2048}),
  'wan-image-pro':model('wan-image-pro','qwen','Wan 2.7 Image Pro','wan2.7-image-pro',['faithful','smart','infographic'],{direct:true,edit:true,max_edge:4096,edit_max_edge:2048}),
  'qwen-zimage':model('qwen-zimage','qwen','Z-Image Turbo','z-image-turbo',['smart','infographic'],{direct:true,edit:false,max_edge:2048}),
  'minimax-image':model('minimax-image','minimax','MiniMax Image 01','image-01',['faithful','smart','infographic'],{direct:true,edit:true,reference_type:'character',max_edge:2048}),
  'glm-image':model('glm-image','zai','GLM-Image','glm-image',['smart','infographic'],{direct:true,edit:false,max_edge:2048}),
  'mistral-image':model('mistral-image','mistral','Mistral Image Agent','mistral-medium-latest',['smart','infographic'],{direct:true,edit:false}),
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
