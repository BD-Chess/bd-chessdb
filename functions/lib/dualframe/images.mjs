import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {taskGeometry,verifyProtectedPixels} from '../../../public/Nara/dualframe-lab/core.mjs';
import {masterGeometry,enhancementOutputGeometry,ENHANCEMENT_CONTRACT} from './enhancement.mjs';
import {modelFor} from './contracts.mjs';
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const image=bytes=>sharp(bytes,{limitInputPixels:24000000,failOn:'error',animated:false}).rotate().toColourspace('srgb').ensureAlpha();
export async function inspectImage(bytes){const m=await sharp(bytes,{limitInputPixels:24000000,failOn:'error'}).metadata();if(!['png','jpeg','webp'].includes(m.format)||!m.width||!m.height||m.pages>1||m.width*m.height>24000000)throw Error('IMAGE_INVALID');return {width:m.autoOrient?.width||m.width,height:m.autoOrient?.height||m.height,format:m.format};}
export async function normalizationProof(original,normalized){
 const a=await image(original).raw().toBuffer({resolveWithObject:true}),b=await image(normalized).raw().toBuffer({resolveWithObject:true});
 return {scope:'server-decoded-sRGB-RGBA8',original_sha256:hash(original),normalized_sha256:hash(normalized),verified:a.info.width===b.info.width&&a.info.height===b.info.height&&a.data.equals(b.data)};
}
export async function prepareEditInput(source,job){
 if(job.operation==='enhance'){
  if(!source)throw Error('SOURCE_ASSET_MISSING');
  const s=await inspectImage(source),model=modelFor(job.model);
  if(model?.provider!=='openai'||!model.edit)throw Error('ENHANCEMENT_MODEL_UNSUPPORTED');
  const geometry=masterGeometry(s.width,s.height,{maxEdge:Math.min(job.quality==='4k'?3840:1920,model.editMaxEdge||model.maxEdge||3840),multiple:16});
  const canvas=await image(source).resize(geometry.width,geometry.height,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
  // The complete normalized source is present. An enhance stage must never use
  // Faithful's later pixel-paste step, which would erase the enhancement.
  return {source:canvas,job:{...job,_master_geometry:geometry}};
 }
 if(!source||job.mode!=='faithful'||job.provider!=='openai')return {source,job};
 const s=await inspectImage(source),p=taskGeometry(s.width,s.height,job.target,job.position,job.mode,job.quality);
 const canvas=await sharp({create:{width:p.width,height:p.height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:source,left:p.x,top:p.y}]).png().toBuffer();
 const opaque=await sharp({create:{width:s.width,height:s.height,channels:4,background:{r:0,g:0,b:0,alpha:1}}}).png().toBuffer();
 const mask=await sharp({create:{width:p.width,height:p.height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:opaque,left:p.x,top:p.y}]).png().toBuffer();
 return {source:canvas,job:{...job,_mask:mask}};
}
function lineage(job){const recipe=job.recipe||job.enhancement_recipe;return {source_sha256:job.input_sha256||null,original_sha256:job.input_sha256||null,master_sha256:job.master_hash||job.master_sha256||null,family_id:job.family_id||null,recipe:recipe||null,recipe_hash:job.recipe_hash||null,recipe_version:recipe?.schema||ENHANCEMENT_CONTRACT};}
export function masterExportGeometry(width,height,quality='hd'){
 masterGeometry(width,height);if(!['hd','4k'].includes(quality))throw Error('ENHANCEMENT_QUALITY_INVALID');
 const edge=quality==='4k'?3840:1920,ratio=edge/Math.max(width,height),w=Math.max(1,Math.round(width*ratio)),h=Math.max(1,Math.round(height*ratio)),scale=Math.min(w/width,h/height),content_width=Math.max(1,Math.round(width*scale)),content_height=Math.max(1,Math.round(height*scale));
 return {...masterGeometry(w,h),source_width:width,source_height:height,content_width,content_height,x:Math.floor((w-content_width)/2),y:Math.floor((h-content_height)/2),scale,source_is_resampled:scale!==1,source_aspect_ratio:`${width}:${height}`,padding:w!==content_width||h!==content_height,requested_long_edge:edge,dimension_rounding:w*height!==h*width};
}
async function renderContained(bytes,geometry,fit='contain'){
 const dimensions=await inspectImage(bytes),scale=Math.min(geometry.width/dimensions.width,geometry.height/dimensions.height),content_width=Math.max(1,Math.round(dimensions.width*scale)),content_height=Math.max(1,Math.round(dimensions.height*scale));
 const output=await image(bytes).resize(geometry.width,geometry.height,{fit,background:{r:0,g:0,b:0,alpha:0}}).png({compressionLevel:7}).toBuffer();
 return {bytes:output,source:dimensions,placement:{fit,no_crop:true,content_width,content_height,x:Math.floor((geometry.width-content_width)/2),y:Math.floor((geometry.height-content_height)/2),padding:content_width!==geometry.width||content_height!==geometry.height},upscaled:scale>1};
}
/** Preserve full source framing for arbitrary source ratios. Provider padding or
 * resampling is disclosed; no generic 16:9/9:16 cover crop is applied. */
export async function finishMasterImage(providerBytes,normalizedSource,job){
 if(job.operation!=='enhance'||!normalizedSource)throw Error('ENHANCEMENT_SOURCE_REQUIRED');
 const source=await inspectImage(normalizedSource),geometry=masterExportGeometry(source.width,source.height,job.quality),result=await renderContained(providerBytes,geometry),recipe=job.recipe||job.enhancement_recipe;
 return {bytes:result.bytes,output:{...lineage(job),width:geometry.width,height:geometry.height,mime:'image/png',byte_size:result.bytes.length,sha256:hash(result.bytes),normalized_source_sha256:hash(normalizedSource),role:recipe?.kind==='artistic'?'artistic-master':'natural-master',operation:'enhance',mode:recipe?.kind||'natural',family_stage:'master',source_aspect_ratio:geometry.source_aspect_ratio,source_framing:'complete-source-aspect',provider_width:result.source.width,provider_height:result.source.height,provider_native_dimensions:{width:result.source.width,height:result.source.height},exported_dimensions:{width:geometry.width,height:geometry.height},provider_response_fit:result.placement,source_placement:geometry,pixel_proof:null,resolution_verified:true,native_4k:!result.upscaled&&!result.placement.padding&&Math.max(geometry.width,geometry.height)>=3840&&Math.min(geometry.width,geometry.height)>=2160,resolution_origin:result.upscaled?'upscaled':result.placement.padding?'provider-native-contained':result.source.width!==geometry.width||result.source.height!==geometry.height?'provider-native-downsampled':'provider-native',no_crop:true}};
}
export async function deriveFrameFromMaster(masterBytes,job){
 if(!masterBytes)throw Error('MASTER_ASSET_MISSING');
 const source=await inspectImage(masterBytes),geometry=job.output_geometry||enhancementOutputGeometry(job.target,job.quality),fit=job.fit||'resize';
 if(!Number.isInteger(geometry.width)||!Number.isInteger(geometry.height)||geometry.width<1||geometry.height<1||geometry.width*geometry.height>24000000)throw Error('DERIVATIVE_GEOMETRY_INVALID');
 if(!['resize','contain'].includes(fit))throw Error('DERIVATIVE_FIT_INVALID');
 if(fit==='resize'&&source.width*geometry.height!==source.height*geometry.width)throw Error('DERIVATIVE_CROP_NOT_AUTHORIZED');
 const expected=job.master_hash||job.master_sha256;if(expected&&hash(masterBytes)!==expected)throw Error('MASTER_HASH_MISMATCH');
 const result=await renderContained(masterBytes,geometry),parent=hash(masterBytes);
 return {bytes:result.bytes,output:{...lineage(job),sha256:hash(result.bytes),width:geometry.width,height:geometry.height,mime:'image/png',byte_size:result.bytes.length,parent_sha256:parent,parent_output_sha256:parent,master_sha256:parent,operation:'derive',role:'deterministic-derivative',direction:job.target,fit,no_crop:true,disclosed_padding:result.placement.padding,source_placement:result.placement,provider_width:source.width,provider_height:source.height,resolution_verified:true,native_4k:job.master_native_4k===true&&!result.upscaled&&!result.placement.padding&&Math.max(geometry.width,geometry.height)>=3840&&Math.min(geometry.width,geometry.height)>=2160,resolution_origin:result.upscaled?'deterministic-upscaled':result.placement.padding?'deterministic-contained':'deterministic-downsampled',model_calls:0}};
}
/** HD copies use the accepted saved 4K bytes, with no model submission. */
export async function deriveHDFromAccepted(parentBytes,parentMeta,job={}){
 if(!['ACCEPTED'].includes(parentMeta?.acceptance||parentMeta?.status))throw Error('DERIVATIVE_PARENT_NOT_ACCEPTED');
 if(!parentMeta?.sha256||hash(parentBytes)!==parentMeta.sha256)throw Error('DERIVATIVE_PARENT_HASH_MISMATCH');
 const source=await inspectImage(parentBytes),portrait=source.height>source.width,target=portrait?'portrait':'landscape',fourK=enhancementOutputGeometry(target,'4k');
 if(source.width!==fourK.width||source.height!==fourK.height||parentMeta.width!==source.width||parentMeta.height!==source.height)throw Error('DERIVATIVE_PARENT_NOT_4K');
 const result=await deriveFrameFromMaster(parentBytes,{...job,target,quality:'hd',output_geometry:enhancementOutputGeometry(target,'hd'),fit:'resize',master_hash:parentMeta.sha256});
 return {...result,output:{...result.output,role:'hd-derivative',quality:'hd',parent_asset_id:parentMeta.asset_id||null,parent_sha256:parentMeta.sha256,parent_output_sha256:parentMeta.sha256,master_sha256:parentMeta.master_sha256||job.master_hash||null,native_4k:false,resolution_origin:'deterministic-downsampled',provider_width:parentMeta.provider_width??source.width,provider_height:parentMeta.provider_height??source.height,model_calls:0}};
}
export async function finishImage(providerBytes,normalizedSource,job){
 if(job.operation==='enhance')return finishMasterImage(providerBytes,normalizedSource,job);
 const provider=await inspectImage(providerBytes),source=normalizedSource?await inspectImage(normalizedSource):null;
 const p=source&&job.operation!=='generate'?taskGeometry(source.width,source.height,job.target,job.position,job.mode,job.quality):{width:job.target==='portrait'?(job.quality==='4k'?2160:1080):(job.quality==='4k'?3840:1920),height:job.target==='portrait'?(job.quality==='4k'?3840:1920):(job.quality==='4k'?2160:1080),x:0,y:0,scale:1,source_width:0,source_height:0};
 const {data,info}=await image(providerBytes).resize(p.width,p.height,{fit:'cover',position:'centre'}).raw().toBuffer({resolveWithObject:true});
 let sourceData=null;
 if(source&&job.mode==='faithful'&&job.operation!=='generate'){
  const raw=await image(normalizedSource).raw().toBuffer({resolveWithObject:true});sourceData=raw.data;
  for(let y=0;y<source.height;y++)sourceData.copy(data,((y+p.y)*p.width+p.x)*4,y*source.width*4,(y+1)*source.width*4);
 }
 const png=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png({compressionLevel:7}).toBuffer();
 let pixelProof=null;
 if(sourceData){const saved=await image(png).raw().toBuffer();pixelProof=verifyProtectedPixels({sourceData:new Uint8Array(sourceData),sourceWidth:source.width,sourceHeight:source.height,outputData:new Uint8Array(saved),outputWidth:p.width,outputHeight:p.height,placement:p});if(!pixelProof.verified)throw Error('PROTECTED_PIXELS_CHANGED');pixelProof={...pixelProof,checked_scope:'server-decoded-saved-output-normalized-rgba',source_sha256:job.input_sha256,normalized_source_sha256:hash(normalizedSource),output_sha256:hash(png)};}
 const upscaled=provider.width<p.width||provider.height<p.height;
 return {bytes:png,output:{width:p.width,height:p.height,mime:'image/png',byte_size:png.length,sha256:hash(png),source_placement:source? p:null,pixel_proof:pixelProof,provider_width:provider.width,provider_height:provider.height,resolution_verified:true,native_4k:!upscaled&&Math.max(provider.width,provider.height)>=3840&&Math.min(provider.width,provider.height)>=2160,resolution_origin:upscaled?'upscaled':pixelProof?'provider-native-composite':'provider-native',source_sha256:job.input_sha256||null,mode:job.mode,operation:job.operation}};
}
