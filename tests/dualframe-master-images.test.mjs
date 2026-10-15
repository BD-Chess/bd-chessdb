import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const sharp=createRequire(new URL('../functions/package.json',import.meta.url))('sharp');
import {prepareEditInput,finishMasterImage,finishImage,deriveFrameFromMaster,deriveHDFromAccepted,hash,inspectImage,masterExportGeometry} from '../functions/lib/dualframe/images.mjs';
import {providerRequest,callProvider,requestSize} from '../functions/lib/dualframe/providers.mjs';
import {modelFor} from '../functions/lib/dualframe/contracts.mjs';
import {verifiedFourK,selectAsset,checkPair} from '../public/Nara/dualframe-lab/core.mjs';
const recipe={schema:'bd.dualframe.enhancement.v1',kind:'natural',strength:'natural',background:'keep'};
const job={operation:'enhance',model:'openai-sunburst',provider:'openai',quality:'hd',mode:'faithful',target:'landscape',position:'center',provider_prompt:'Enhance this synthetic photograph preserving complete framing.',family_id:'family_fixture_0001',input_sha256:'a'.repeat(64),recipe};
const raster=(width,height,background={r:225,g:50,b:20,alpha:1})=>sharp({create:{width,height,channels:4,background}}).png().toBuffer();
const env=key=>key==='DF_QWEN_API_HOST'?null:'synthetic-not-a-real-key';

test('4:3, square and portrait masters preserve source ratio and full source instead of generic frame cover',async()=>{
 for(const [width,height] of [[400,300],[320,320],[300,400]]){
  const original=await raster(width,height),provider=await raster(width,height,{r:10,g:210,b:40,alpha:1}),prepared=await prepareEditInput(original,job);
  assert.equal(prepared.job._master_geometry.no_crop,true);assert.equal(prepared.job._master_geometry.fit,'contain');assert.equal(prepared.job._mask,undefined);
  const request=providerRequest(prepared.job,prepared.source,env);assert.equal(request.size.width,prepared.job._master_geometry.width);assert.equal(request.size.height,prepared.job._master_geometry.height);assert.equal(request.body.get('size'),request.size.width+'x'+request.size.height);
  const finished=await finishMasterImage(provider,original,job);assert.equal(Math.max(finished.output.width,finished.output.height),1920);assert.equal(finished.output.width*height,finished.output.height*width);assert.equal(finished.output.no_crop,true);assert.equal(finished.output.pixel_proof,null);assert.equal(finished.output.normalized_source_sha256,hash(original));assert.equal(finished.output.original_sha256,job.input_sha256);assert.equal(finished.output.family_id,job.family_id);assert.equal(finished.output.recipe.kind,'natural');
  const raw=await sharp(finished.bytes).raw().toBuffer();assert.equal(raw[1],210,'provider enhancement remains instead of original Faithful paste');assert.deepEqual(original,await raster(width,height));
 }
});
test('provider aspect mismatch uses disclosed contain padding and preserves provider corner pixels',async()=>{
 const original=await raster(400,300),provider=await raster(200,200,{r:15,g:150,b:35,alpha:1}),result=await finishImage(provider,original,job);
 assert.equal(result.output.provider_width,200);assert.equal(result.output.provider_height,200);assert.equal(result.output.exported_dimensions.width,1920);assert.equal(result.output.provider_response_fit.padding,true);assert.equal(result.output.resolution_origin,'upscaled');assert.equal(result.output.native_4k,false);
 const {data,info}=await sharp(result.bytes).raw().toBuffer({resolveWithObject:true});assert.equal(data[3],0,'padding keeps the complete provider square instead of cropping');assert.equal(data[(240*4)+1],150);assert.equal(info.width,1920);assert.equal(info.height,1440);
 const nonstandard=masterExportGeometry(403,301,'4k');assert.equal(Math.max(nonstandard.width,nonstandard.height),3840);assert.equal(nonstandard.source_aspect_ratio,'403:301');assert.equal(nonstandard.no_crop,true);assert.equal(nonstandard.dimension_rounding,true);
});
test('master request geometry is OpenAI-only, mandatory, divisible by16 and independently source-derived',async()=>{
 assert.throws(()=>providerRequest({...job,model:'qwen-image-pro'},Buffer.from('source'),env),/ENHANCEMENT_MODEL_UNSUPPORTED/);
 assert.throws(()=>providerRequest(job,Buffer.from('source'),env),/ENHANCEMENT_GEOMETRY_REQUIRED/);
 const source=await raster(403,301),prepared=await prepareEditInput(source,{...job,master_geometry:{width:3840,height:2160}}),request=providerRequest(prepared.job,prepared.source,env);
 assert.equal(request.size.source_width,403);assert.equal(request.size.source_height,301);assert.equal(request.size.width%16,0);assert.equal(request.size.height%16,0);assert.ok(request.size.width*request.size.height<=24000000);assert.equal(request.size.no_crop,true);
 const old=requestSize(modelFor('openai-sunburst'),'portrait','4k',true);assert.equal(old.width,2160);assert.equal(old.height,3840);
});
test('master native4K labels depend on observed provider dimensions and resampling',async()=>{
 const source=await raster(3840,2160),low=await raster(1920,1080),upscaled=await finishMasterImage(low,source,{...job,quality:'4k'});
 assert.equal(upscaled.output.width,3840);assert.equal(upscaled.output.height,2160);assert.equal(upscaled.output.native_4k,false);assert.equal(upscaled.output.resolution_origin,'upscaled');assert.deepEqual(upscaled.output.provider_native_dimensions,{width:1920,height:1080});
 const native=await finishMasterImage(source,source,{...job,quality:'4k'});assert.equal(native.output.native_4k,true);assert.equal(native.output.resolution_origin,'provider-native');
});
test('OpenAI frame edit sends accepted master first and original likeness second only when master lineage exists',async()=>{
 const master=await raster(32,32),original=await raster(32,32,{r:0,g:25,b:200,alpha:1}),framing={...job,operation:'expand',mode:'smart',master_hash:hash(master),_original_reference:original};
 const request=providerRequest(framing,master,env),references=request.body.getAll('image[]');assert.equal(references.length,2);assert.deepEqual(Buffer.from(await references[0].arrayBuffer()),master);assert.deepEqual(Buffer.from(await references[1].arrayBuffer()),original);
 const legacy=providerRequest({...framing,master_hash:null},master,env);assert.equal(legacy.body.getAll('image[]').length,1);
});
test('deterministic frame derivation refuses undisclosed crop and discloses contain padding',async()=>{
 const master=await raster(400,300),before=hash(master),framing={target:'landscape',quality:'hd',master_hash:before,input_sha256:job.input_sha256,family_id:job.family_id};
 await assert.rejects(deriveFrameFromMaster(master,{...framing,fit:'resize'}),/DERIVATIVE_CROP_NOT_AUTHORIZED/);
 const contained=await deriveFrameFromMaster(master,{...framing,fit:'contain'});assert.equal(contained.output.width,1920);assert.equal(contained.output.height,1080);assert.equal(contained.output.disclosed_padding,true);assert.equal(contained.output.no_crop,true);assert.equal(contained.output.parent_sha256,before);assert.equal(contained.output.model_calls,0);assert.equal(hash(master),before);
 await assert.rejects(deriveFrameFromMaster(master,{...framing,fit:'contain',master_hash:'b'.repeat(64)}),/MASTER_HASH_MISMATCH/);
});
test('accepted4K HD derivative uses exact dimensions, parent hash and zero provider calls while preserving parent bytes',async()=>{
 for(const [width,height] of [[3840,2160],[2160,3840]]){
  const bytes=await raster(width,height),before=hash(bytes),meta={sha256:before,width,height,asset_id:'accepted_fixture_0001',acceptance:'ACCEPTED',master_sha256:'c'.repeat(64)},result=await deriveHDFromAccepted(bytes,meta,{family_id:job.family_id});
  const inspected=await inspectImage(result.bytes);assert.equal(inspected.width,width/2);assert.equal(inspected.height,height/2);assert.equal(result.output.parent_sha256,before);assert.equal(result.output.parent_asset_id,meta.asset_id);assert.equal(result.output.master_sha256,meta.master_sha256);assert.equal(result.output.model_calls,0);assert.equal(result.output.native_4k,false);assert.equal(hash(bytes),before);
  await assert.rejects(deriveHDFromAccepted(bytes,{...meta,acceptance:'READY'}),/DERIVATIVE_PARENT_NOT_ACCEPTED/);await assert.rejects(deriveHDFromAccepted(bytes,{...meta,sha256:'d'.repeat(64)}),/DERIVATIVE_PARENT_HASH_MISMATCH/);
 }
});
test('MiniMax1500/ZImage800 prompt overflow rejects before provider submission without silent truncation',async()=>{
 for(const [model,limit] of [['minimax-image',1500],['qwen-zimage',800]]){
  const exact={operation:'generate',target:'landscape',quality:'hd',model,prompt:'x'.repeat(limit),seed:42},request=providerRequest(exact,null,env),body=JSON.parse(request.body);assert.ok(JSON.stringify(body).includes('x'.repeat(limit)));
  let calls=0;await assert.rejects(callProvider({...exact,prompt:'x'.repeat(limit+1)},null,env,{fetcher:async()=>{calls++;throw Error('must not submit');}}),/PROVIDER_PROMPT_TOO_LONG/);assert.equal(calls,0);
 }
});
test('real deterministic4K output remains selectable/saveable with truthful resampled label and strict parent proof',async()=>{
 const source=await raster(1920,1080),result=await deriveFrameFromMaster(source,{target:'landscape',quality:'4k',master_hash:hash(source),input_sha256:'a'.repeat(64)}),asset={...result.output,path:'variants/landscape/derived.png'};
 assert.equal(asset.native_4k,false);assert.equal(asset.resolution_origin,'deterministic-upscaled');assert.equal(verifiedFourK(asset),true);
 const pair={schema:'bd.dualframe.pair.v1',pair_id:'derived_pair_0001',original:{sha256:'a'.repeat(64),width:1920,height:1080,source_orientation:'landscape',visibility:'private'},variants:{landscape:{fourK:asset},portrait:{}},jobs:[]};assert.equal(checkPair(pair),true);const selected=selectAsset(pair,'landscape','4k');assert.equal(selected.asset.sha256,asset.sha256);assert.equal(selected.quality,'4k');assert.equal(selected.upscaled,true);assert.equal(selected.missing,false);
 for(const extra of [{parent_sha256:null},{parent_output_sha256:'f'.repeat(64)},{model_calls:1},{native_4k:true},{operation:'generate'},{no_crop:false},{direction:'portrait'},{width:4000},{resolution_verified:false}])assert.equal(verifiedFourK({...asset,...extra}),false,JSON.stringify(extra));
 assert.equal(verifiedFourK({...asset,resolution_origin:'deterministic-contained',disclosed_padding:true}),true);assert.equal(verifiedFourK({...asset,resolution_origin:'deterministic-downsampled'}),true);
});
