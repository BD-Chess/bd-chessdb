// Concept and product direction: Bojan Dobrečevič (BD).
// Adapted from the 2026-10-15 enhancement candidate. Pure contracts only:
// these helpers neither authorize a provider call nor assert visual fidelity.
export const ENHANCEMENT_CONTRACT='bd.dualframe.enhancement.v1';
export const ENHANCEMENT_PLAN_CONTRACT='bd.dualframe.enhancement-plan.v1';
const MAX_PIXELS=24000000;
const backgrounds=new Set(['keep','cleanup','replace','studio','free']);
const strengths=new Set(['subtle','natural','strong']);
const kinds=new Set(['natural','artistic']);
const recipeKeys=new Set(['schema','kind','strength','background']);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));

export function normalizeEnhancementRecipe(input){
 if(!plain(input))throw Error('ENHANCEMENT_RECIPE_REQUIRED');
 if(Object.keys(input).some(key=>!recipeKeys.has(key)))throw Error('ENHANCEMENT_RECIPE_INVALID');
 if(input.schema!==undefined&&input.schema!==ENHANCEMENT_CONTRACT)throw Error('ENHANCEMENT_SCHEMA_INVALID');
 const kind=input.kind;
 if(!kinds.has(kind))throw Error('ENHANCEMENT_KIND_INVALID');
 const strength=input.strength??'natural';
 if(!strengths.has(strength))throw Error('ENHANCEMENT_STRENGTH_INVALID');
 const background=input.background??(kind==='artistic'?'free':'keep');
 if(!backgrounds.has(background)||(kind==='artistic'?background!=='free':background==='free'))throw Error('ENHANCEMENT_BACKGROUND_INVALID');
 return {schema:ENHANCEMENT_CONTRACT,kind,strength,background};
}

const bg={
 keep:'Keep the existing location and background, including meaningful details; improve only photographic quality.',
 cleanup:'Keep the recognizable location. Reduce small distracting clutter only; never remove people or meaningful context.',
 replace:'Replace only the setting with a realistic location. Match perspective, depth, light and contact shadows; preserve every person.',
 studio:'Use a quiet studio background with subtle tone, believable hair edges, light and contact shadows.',
 free:'Freely create an entirely different believable scene, pose, outfit, setting, era, lens and composition.'
};
const natural='Professionally enhance this photograph while preserving its recognizable people. Correct exposure, white balance, lighting, noise, recoverable tonal detail, contrast, color and restrained sharpness. Preserve each face, expression, apparent age, natural skin color and texture, distinctive marks, hair, clothing, pose and proportions. Preserve the exact number of people and their individual identities. Retouch harsh skin lighting gently; retain pores and characteristic lines. Never reshape features, bleach skin, change age or use a plastic beauty filter. Protect complete hands, feet and heads, with useful margins for both orientations. Do not crop away original context.';
const artistic='Create one photorealistic artistic interpretation of the SAME recognizable people in the reference. Preserve each person\'s facial anatomy, apparent age, natural skin color, distinctive features and individual identity; preserve the exact number of people. Freely change pose, outfit, setting, era, lighting, lens, composition and atmosphere. Keep lifelike skin texture, plausible anatomy and natural hands; never blend faces, duplicate or omit people. Protect complete heads, hands and feet with useful margins for both orientations. This is a new artistic scene, not a claim about historical events.';
const strengthText={subtle:'Keep photographic adjustments discreet.',natural:'Aim for a natural, polished photograph.',strong:'Use stronger photographic improvements while preserving identity.'};

function checkUserDirection(value){
 if(typeof value!=='string'||value.length>450||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(value))throw Error('ENHANCEMENT_DIRECTION_INVALID');
 return value.normalize('NFC').trim();
}
function boundedPrompt(prompt,maxLength){
 if(!Number.isInteger(maxLength)||maxLength<1||maxLength>12000)throw Error('ENHANCEMENT_PROMPT_LIMIT_INVALID');
 if(prompt.length>maxLength)throw Error('ENHANCEMENT_PROMPT_TOO_LONG');
 return prompt;
}
export function enhancementPrompt(input,userDirection='',{maxLength=1500}={}){
 const r=normalizeEnhancementRecipe(input),user=checkUserDirection(userDirection);
 return boundedPrompt([r.kind==='natural'?natural:artistic,bg[r.background],strengthText[r.strength],
  'Output only the photograph: no text, logos or watermarks.',
  ...(user?['Optional direction, subordinate to the preservation rules above: '+JSON.stringify(user)]:[])
 ].join(' '),maxLength);
}
export function compositionFromMasterPrompt(target,optionalDirection='',{maxLength=1500}={}){
 if(target!=='portrait'&&target!=='landscape')throw Error('TARGET_INVALID');
 const user=checkUserDirection(optionalDirection),ratio=target==='portrait'?'9:16':'16:9';
 return boundedPrompt(`Create a ${ratio} photograph from this accepted master. Preserve the SAME recognizable people and the SAME scene, appearance, apparent age, skin, expression, hair, outfit and photographic treatment. Extend believable surroundings to reframe without harsh cropping. Protect complete heads, hands and feet and natural anatomy; preserve the exact number of people without duplicates. Do not retouch faces again, blend identities or independently change the background. Output only the photo, no text, logos or watermark.${user?' Optional framing direction, subordinate to these rules: '+JSON.stringify(user):''}`,maxLength);
}

function dimensions(width,height){
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width*height>MAX_PIXELS)throw Error('ENHANCEMENT_GEOMETRY_INVALID');
}
/** A provider request canvas containing the complete source. Never use cover.
 * Multiples may require padding; content placement makes that explicit. Actual
 * provider pixels and dimensions still require validation after its response. */
export function masterGeometry(width,height,{maxEdge=Math.max(width,height),multiple=1,maxPixels=MAX_PIXELS}={}){
 dimensions(width,height);
 if(!Number.isSafeInteger(maxEdge)||maxEdge<1||maxEdge>MAX_PIXELS||!Number.isSafeInteger(multiple)||multiple<1||multiple>1024||maxEdge<multiple||!Number.isSafeInteger(maxPixels)||maxPixels<1||maxPixels>MAX_PIXELS)throw Error('ENHANCEMENT_GEOMETRY_LIMIT_INVALID');
 const scale=Math.min(1,maxEdge/Math.max(width,height),Math.sqrt(maxPixels/(width*height)));
 let canvasWidth=Math.max(multiple,Math.floor(width*scale/multiple)*multiple);
 let canvasHeight=Math.max(multiple,Math.floor(height*scale/multiple)*multiple);
 // A narrow source may round up to the minimum supported short edge.
 if(canvasWidth*canvasHeight>maxPixels||Math.max(canvasWidth,canvasHeight)>maxEdge)throw Error('ENHANCEMENT_GEOMETRY_UNSUPPORTED');
 const contentScale=Math.min(canvasWidth/width,canvasHeight/height,1);
 const contentWidth=Math.max(1,Math.min(canvasWidth,Math.round(width*contentScale)));
 const contentHeight=Math.max(1,Math.min(canvasHeight,Math.round(height*contentScale)));
 return {width:canvasWidth,height:canvasHeight,source_width:width,source_height:height,
  content_width:contentWidth,content_height:contentHeight,
  x:Math.floor((canvasWidth-contentWidth)/2),y:Math.floor((canvasHeight-contentHeight)/2),
  scale:contentScale,fit:'contain',no_crop:true,source_is_resampled:contentScale!==1,
  source_aspect_ratio:`${width}:${height}`,padding:canvasWidth!==contentWidth||canvasHeight!==contentHeight};
}

export function enhancementOutputGeometry(target,quality='hd'){
 if(!['portrait','landscape'].includes(target))throw Error('TARGET_INVALID');
 if(!['hd','4k'].includes(quality))throw Error('ENHANCEMENT_QUALITY_INVALID');
 const [width,height]=target==='portrait'?(quality==='4k'?[2160,3840]:[1080,1920]):(quality==='4k'?[3840,2160]:[1920,1080]);
 return {width,height};
}

/** Disclosure plan, not an entitlement or a price quote. The server must bind
 * source/master hashes, provider capabilities, policy version and reservations
 * before dispatch. Nonstandard source ratios explicitly need either a further
 * model-created composition or a disclosed deterministic contain export. */
export function enhancementPlan({source,recipe,quality='hd',enhanceOnly=false,includeHD=false,serviceTier='free',sameOrientationFit='model'}={}){
 if(!plain(source))throw Error('ENHANCEMENT_SOURCE_REQUIRED');
 dimensions(source.width,source.height);
 if(source.sha256!==undefined&&!/^[a-f0-9]{64}$/.test(source.sha256))throw Error('ENHANCEMENT_SOURCE_HASH_INVALID');
 const normalizedRecipe=normalizeEnhancementRecipe(recipe);
 if(!['hd','4k'].includes(quality))throw Error('ENHANCEMENT_QUALITY_INVALID');
 if(typeof enhanceOnly!=='boolean'||typeof includeHD!=='boolean'||!['free','premium'].includes(serviceTier)||!['model','contain'].includes(sameOrientationFit))throw Error('ENHANCEMENT_PLAN_INVALID');
 const target=source.height>source.width?'portrait':'landscape',opposite=target==='portrait'?'landscape':'portrait';
 const exactRatio=target==='portrait'?source.width*16===source.height*9:source.width*9===source.height*16;
 const frames=[];
 if(!enhanceOnly){
  const derived=exactRatio||sameOrientationFit==='contain';
  frames.push({target,operation:derived?'derive':'expand',model_calls:derived?0:1,geometry:enhancementOutputGeometry(target,quality),fit:derived?(exactRatio?'resize':'contain'):'provider-composition',master_required:true,no_crop:derived,disclosed_padding:derived&&!exactRatio});
  frames.push({target:opposite,operation:'expand',model_calls:1,geometry:enhancementOutputGeometry(opposite,quality),fit:'provider-composition',master_required:true,no_crop:false,disclosed_padding:false});
 }
 return {schema:ENHANCEMENT_PLAN_CONTRACT,recipe:normalizedRecipe,service_tier:serviceTier,quality,
  source:{width:source.width,height:source.height,...(source.sha256?{sha256:source.sha256}:{})},
  master:{operation:'enhance',role:normalizedRecipe.kind+'-master',model_calls:1,geometry:masterGeometry(source.width,source.height),accept_before_frames:true},
  frames,maximum_model_calls:1+frames.reduce((n,frame)=>n+frame.model_calls,0),
  include_hd_copy:includeHD&&quality==='4k'&&!enhanceOnly,hd_copy_model_calls:0,
  // Enhance-only is a master operation, not an implicitly framed 4K export.
  hd_copy_targets:includeHD&&quality==='4k'?frames.map(frame=>frame.target):[],
  estimated_cost:null,cost_currency:null,paid_fallback:false,
  provider_capability_verified:false,native_resolution_verified:false,authorized:false};
}
