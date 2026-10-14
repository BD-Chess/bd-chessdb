import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {taskGeometry,verifyProtectedPixels} from '../../../public/Nara/dualframe-lab/core.mjs';
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const image=bytes=>sharp(bytes,{limitInputPixels:24000000,failOn:'error',animated:false}).rotate().toColourspace('srgb').ensureAlpha();
export async function inspectImage(bytes){const m=await sharp(bytes,{limitInputPixels:24000000,failOn:'error'}).metadata();if(!['png','jpeg','webp'].includes(m.format)||!m.width||!m.height||m.pages>1||m.width*m.height>24000000)throw Error('IMAGE_INVALID');return {width:m.autoOrient?.width||m.width,height:m.autoOrient?.height||m.height,format:m.format};}
export async function normalizationProof(original,normalized){
 const a=await image(original).raw().toBuffer({resolveWithObject:true}),b=await image(normalized).raw().toBuffer({resolveWithObject:true});
 return {scope:'server-decoded-sRGB-RGBA8',original_sha256:hash(original),normalized_sha256:hash(normalized),verified:a.info.width===b.info.width&&a.info.height===b.info.height&&a.data.equals(b.data)};
}
export async function prepareEditInput(source,job){
 if(!source||job.mode!=='faithful'||job.provider!=='openai')return {source,job};
 const s=await inspectImage(source),p=taskGeometry(s.width,s.height,job.target,job.position,job.mode,job.quality);
 const canvas=await sharp({create:{width:p.width,height:p.height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:source,left:p.x,top:p.y}]).png().toBuffer();
 const opaque=await sharp({create:{width:s.width,height:s.height,channels:4,background:{r:0,g:0,b:0,alpha:1}}}).png().toBuffer();
 const mask=await sharp({create:{width:p.width,height:p.height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:opaque,left:p.x,top:p.y}]).png().toBuffer();
 return {source:canvas,job:{...job,_mask:mask}};
}
export async function finishImage(providerBytes,normalizedSource,job){
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
