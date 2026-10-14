// Documented provider contracts, not a claim of account entitlement or image quality.
export const MODELS=Object.freeze([
 {key:'openai-sunburst',provider:'openai',label:'GPT Image 2.5 Sunburst',model:'gpt-image-2.5-sunburst',edit:true,masks:true,maxEdge:3840,keys:['DF_OPENAI_API_KEY','OPENAI_API_KEY']},
 {key:'openai-flare',provider:'openai',label:'GPT Image 2.5 Flare',model:'gpt-image-2.5-flare',edit:true,masks:true,maxEdge:3840,keys:['DF_OPENAI_API_KEY','OPENAI_API_KEY']},
 {key:'gemini-nano',provider:'gemini',label:'Nano Banana 2.1',model:'gemini-nano-banana-2.1',edit:true,maxEdge:5504,keys:['DF_GEMINI_API_KEY','GEMINI_API_KEY']},
 {key:'grok-imagine',provider:'xai',label:'Grok Imagine Image 2.0',model:'grok-imagine-image-2.0',edit:true,maxEdge:2048,keys:['DF_XAI_API_KEY','XAI_API_KEY','GROK_API_KEY']},
 {key:'qwen-image-pro',provider:'qwen',label:'Qwen Image 3.0 Pro',model:'qwen-image-3.0-pro',edit:true,maxEdge:2048,keys:['DF_QWEN_API_KEY','DASHSCOPE_API_KEY','QWEN_API_KEY']},
 {key:'qwen-image',provider:'qwen',label:'Qwen Image 3.0',model:'qwen-image-3.0',edit:true,maxEdge:2048,keys:['DF_QWEN_API_KEY','DASHSCOPE_API_KEY','QWEN_API_KEY']},
 {key:'wan-image-pro',provider:'qwen',label:'Wan 2.7 Image Pro',model:'wan2.7-image-pro',edit:true,maxEdge:4096,editMaxEdge:2048,keys:['DF_QWEN_API_KEY','DASHSCOPE_API_KEY','QWEN_API_KEY']},
 {key:'qwen-zimage',provider:'qwen',label:'Z-Image Turbo',model:'z-image-turbo',edit:false,maxEdge:2048,keys:['DF_QWEN_API_KEY','DASHSCOPE_API_KEY','QWEN_API_KEY']},
 {key:'minimax-image',provider:'minimax',label:'MiniMax Image 01',model:'image-01',edit:true,reference:'character',maxEdge:2048,keys:['DF_MINIMAX_API_KEY','MINIMAX_API_KEY']},
 {key:'glm-image',provider:'zai',label:'GLM-Image',model:'glm-image',edit:false,maxEdge:2048,keys:['DF_ZAI_API_KEY','ZAI_API_KEY','GLM_API_KEY']},
 {key:'mistral-image',provider:'mistral',label:'Mistral Image Agent',model:'mistral-medium-latest',edit:false,maxEdge:null,keys:['DF_MISTRAL_API_KEY','MISTRAL_API_KEY']}
]);
export const modelFor=key=>MODELS.find(m=>m.key===key)||null;
export function keyFor(model,env){return model.keys.map(k=>env(k)).find(x=>typeof x==='string'&&x.trim())||null;}
export function publicCapabilities(env){return {schema:'bd.dualframe.capabilities.v3',version:'3.0-r1',auth_configured:!!env('DF_PASSWORD_VERIFIER')&&!!env('DF_SESSION_SECRET'),live_enabled:MODELS.some(m=>!!keyFor(m,env)),providers:[...new Set(MODELS.map(m=>m.provider))],models:MODELS.map(({keys,...m})=>({...m,model_key:m.key,key_configured:!!keyFor(modelFor(m.key),env),available:!!keyFor(modelFor(m.key),env),live_enabled:!!keyFor(modelFor(m.key),env),account_verified:false,quality_gates:{hd:true,'4k':true},four_k_origin:m.maxEdge>=3840?'provider-capable-unverified':'resampled-export',status:keyFor(modelFor(m.key),env)?'READY_FOR_MANUAL_TEST':'KEY_NOT_CONFIGURED'}))};}
