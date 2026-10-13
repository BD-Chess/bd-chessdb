import test from 'node:test';
import assert from 'node:assert/strict';
import { geometry, deviceOrientation, selectAsset, checkPair, comparisonEligibility, sha256, blindOrder, headerSize, sniff, transition, publicManifest, csv, MAX_PIXELS, taskGeometry, canonicalMode, modeDefinition, comparisonRubric, verifyProtectedPixels, verifiedFourK } from '../../public/Nara/dualframe-lab/core.mjs';
import { MODELS, modelFor, modelsForMode, supportsMode } from '../../public/Nara/dualframe-lab/models.mjs';
import { jobIdempotencyKey, gatewayStateAction, liveModelAvailable } from '../../public/Nara/dualframe-lab/jobs.mjs';
const hash='a'.repeat(64);
const controlledOutput=(mode='faithful')=>({sha256:hash,width:1080,height:1920,source_sha256:hash,lineage_status:'SOURCE_VERIFIED',direction:'portrait',target_ratio:'9:16',review_scale_policy:'equal-canvas-v1',provider:'bria',mode,task_parameters_hash:'d'.repeat(64),provenance_verified:true,provenance_basis:'authenticated-gateway-response',provenance_evidence:{source_sha256:hash,output_sha256:hash},pixel_proof:{verified:true,channel_difference_count:0,checked_scope:'server-decoded-saved-output-normalized-rgba',source_sha256:hash,output_sha256:hash}});
const pair={schema:'bd.dualframe.pair.v1',pair_id:'df_example0001',original:{sha256:hash,width:960,height:540,source_orientation:'landscape',visibility:'private'},variants:{portrait:{hd:{sha256:'b'.repeat(64),width:1080,height:1920,path:'P.png'}},landscape:{hd:{sha256:'c'.repeat(64),width:960,height:540,path:'L.png'}}},jobs:[]};
test('desktop stays L: wide, narrow, upright monitor; phone turns P/L; tablets use documented viewport',()=>{
  for(const [w,h] of [[1920,1080],[390,844],[1080,1920]])assert.equal(deviceOrientation({device:'desktop',width:w,height:h}),'landscape');
  assert.equal(deviceOrientation({device:'phone',width:390,height:844}),'portrait');
  assert.equal(deviceOrientation({device:'phone',width:844,height:390}),'landscape');
  assert.equal(deviceOrientation({device:'tablet',width:820,height:1180}),'portrait');
  assert.equal(deviceOrientation({device:'tablet',width:820,height:1180,tablet:'desktop'}),'landscape');
  assert.equal(deviceOrientation({device:'desktop',override:'portrait'}),'portrait');
  assert.equal(deviceOrientation({device:'desktop',simulation:'phone-p'}),'portrait');
});
test('faithful rectangles never crop, rescale or spill; both ratios and positions',()=>{
  for(const [w,h] of [[960,540],[540,960],[1920,1080],[1080,1920],[1921,1001],[1,1]])for(const target of ['portrait','landscape'])for(const position of ['center','left','right','top','bottom']){
    const p=geometry(w,h,target,position);assert.equal(p.width/p.height,target==='portrait'?9/16:16/9);assert(p.x>=0&&p.y>=0&&p.x+w<=p.width&&p.y+h<=p.height);assert.equal(p.scale,1);assert.equal(p.source_width,w);assert.equal(p.source_height,h);
  }
  assert.throws(()=>geometry(9000,9000,'portrait'),/CANVAS_PIXEL_LIMIT/);
  assert.throws(()=>geometry(0,5,'landscape'),/INVALID_GEOMETRY/);
});
test('physical variant selection preserves pair identity and manual quality; 4K absent is explicit',()=>{
  assert.equal(selectAsset(pair,'portrait','hd').asset.path,'P.png');
  assert.equal(selectAsset(pair,'landscape','hd').asset.path,'L.png');
  assert.equal(selectAsset(pair,'portrait','4k').missing,true);
  const p=structuredClone(pair);p.variants.portrait.fourK={width:2160,height:3840,path:'P4.png',resolution_verified:true,resolution_origin:'native'};
  assert.equal(selectAsset(p,'portrait','4k').quality,'4k');
  assert.equal(selectAsset(p,'landscape','4k').quality,'hd');
  assert.equal(selectAsset(p,'portrait','4k').quality,'4k');
  assert.equal(selectAsset(p,'portrait','auto',1).quality,'hd');
  assert.equal(selectAsset(p,'portrait','auto',3).quality,'4k');
  delete p.variants.portrait.hd;delete p.variants.portrait.fourK;assert.equal(selectAsset(p,'portrait').quality,'original');assert.equal(selectAsset(p,'portrait').missing,true);
});
test('manifest rejects public originals, false 4K and invalid orientation',()=>{
  assert(checkPair(pair));const p=structuredClone(pair);p.original.visibility='public';assert.throws(()=>checkPair(p),/PRIVATE_REQUIRED/);p.original.visibility='private';p.variants.portrait.fourK={sha256:hash,width:2160,height:3840,path:'P4.png'};assert.throws(()=>checkPair(p),/UNVERIFIED_4K/);p.variants.portrait.fourK.resolution_verified=true;p.variants.portrait.fourK.resolution_origin='native';assert(checkPair(p));p.variants.portrait.fourK.width=1000;assert.throws(()=>checkPair(p),/UNVERIFIED_4K/);
});
test('wrong originals, unknown provenance, geometry, review scale and demo never enter controlled aggregate',()=>{
  const out=controlledOutput();
  assert.equal(comparisonEligibility(pair,out,out).eligible,true);
  for(const patch of [{source_sha256:'f'.repeat(64)},{lineage_status:'SOURCE_UNVERIFIED'},{direction:'landscape'},{target_ratio:'16:9'},{width:960,height:540},{review_scale_policy:'unequal'},{provider:'demo'}])assert.equal(comparisonEligibility(pair,{...out,...patch},out).eligible,false);
  assert.equal(comparisonEligibility(pair,out,null).eligible,false);
});
test('blind assignment is reproducible and reverses over a bounded set of persisted seeds',async()=>{
  const orders=new Set();for(let i=0;i<12;i++){const one=await blindOrder(pair.pair_id,String(i),['x','y']);assert.deepEqual(one,await blindOrder(pair.pair_id,String(i),['x','y']));orders.add(one.join(','));}assert.equal(orders.size,2);assert.equal(await sha256('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('either demo candidate, synthetic originals, malformed hashes and non-finite dimensions are excluded',()=>{
  const out=controlledOutput();
  for(const patch of [{origin:'demo'},{provider:'demo'},{resolution_origin:'simulation'},{width:undefined},{height:NaN},{width:0},{height:-1},{width:'1080'},{sha256:undefined},{sha256:'bad'}]){
    assert.equal(comparisonEligibility(pair,out,{...out,...patch}).eligible,false,JSON.stringify(patch));
    assert.equal(comparisonEligibility(pair,{...out,...patch},out).eligible,false);
  }
  assert.equal(comparisonEligibility({...pair,original:{...pair.original,demo_fixture:true}},out,out).eligible,false);
  assert.equal(comparisonEligibility(pair,out,out).eligible,true);
});
test('magic-byte geometry rejects corruption and massive PNG before decoding',()=>{
  const bytes=new Uint8Array(24);bytes.set([137,80,78,71,13,10,26,10]);new DataView(bytes.buffer).setUint32(16,960);new DataView(bytes.buffer).setUint32(20,540);assert.equal(sniff(bytes),'image/png');assert.deepEqual(headerSize(bytes),{width:960,height:540,mime:'image/png'});new DataView(bytes.buffer).setUint32(16,MAX_PIXELS);assert.throws(()=>headerSize(bytes),/IMAGE_PIXEL_LIMIT/);assert.throws(()=>sniff(new Uint8Array(20)),/UNSUPPORTED_OR_CORRUPT/);
});
test('job state machine makes cancel, accept and rejection terminal',()=>{
  const j=transition({status:'PENDING'},'RUNNING');assert.equal(transition(j,'CANCELLED').status,'CANCELLED');assert.throws(()=>transition({status:'CANCELLED'},'READY'),/INVALID_STATE_TRANSITION/);assert.equal(transition({status:'READY'},'ACCEPTED').status,'ACCEPTED');assert.throws(()=>transition({status:'ACCEPTED'},'READY'),/INVALID_STATE_TRANSITION/);
});
test('exports retain original hashes and remove bytes, volatile URLs and gateway private IDs',()=>{
  const p={...pair,original:{...pair.original,blob:new Blob(['private']),normalized:new Blob(['private']),url:'blob:private'},upload_id:'internal',gateway_job_id:'internal',candidate:{blob:'private'}};const exported=publicManifest(p);assert.equal(exported.original.sha256,hash);assert(!JSON.stringify(exported).includes('private')||exported.original.visibility==='private');assert(!exported.original.blob&&!exported.original.normalized&&!exported.original.url&&!exported.upload_id&&!exported.candidate);assert(csv([{original_sha256:hash,note:'a,"quoted"\nline'}]).includes('"a,""quoted""\nline"'));
});


test('canonical modes preserve legacy records and return disjoint task rubrics',()=>{
  assert.equal(canonicalMode('cinematic'),'smart');assert.equal(canonicalMode('unknown'),null);assert.equal(canonicalMode(undefined),null);
  assert.equal(modeDefinition('faithful').pixel_protection,true);assert.equal(modeDefinition('smart').pixel_protection,false);
  assert.deepEqual(comparisonRubric('infographic'),['textAccuracy','textReadability','layout','hierarchy','quality']);
  assert(comparisonRubric('faithful').includes('seams'));assert(!comparisonRubric('smart').includes('seams'));assert.deepEqual(comparisonRubric('missing'),[]);
});
test('model registry uses exact endpoint identities and gates tasks',()=>{
  assert.equal(MODELS.length,5);assert.equal(modelFor('bria').key,'bria-direct');assert.equal(modelFor('fal-bria').endpoint,'fal-ai/bria/expand');
  assert.equal(modelFor('fal-sunburst').endpoint,'openai/gpt-image-2.5/sunburst/edit');assert.equal(modelFor('fal-nano').endpoint,'google/nano-banana-2.1/edit');
  assert.equal(modelFor('demo').is_ai,false);assert.equal(supportsMode('demo','cinematic'),true);assert.equal(supportsMode('fal-bria','infographic'),false);assert.equal(supportsMode('made-up','smart'),false);assert.equal(modelsForMode('infographic').length,3);
});
test('Smart and text geometry are actual HD/4K, faithful never rescales even large sources',()=>{
  for(const mode of ['smart','infographic','cinematic'])for(const [target,w,h] of [['landscape',1920,1080],['portrait',1080,1920]]){
    const hd=taskGeometry(3000,2000,target,'center',mode,'hd');assert.equal(hd.width,w);assert.equal(hd.height,h);assert(hd.scale<1);assert(hd.no_crop);
    const four=taskGeometry(3000,2000,target,'center',mode,'4k');assert.equal(four.width,w*2);assert.equal(four.height,h*2);
  }
  const faithful=taskGeometry(1920,1080,'portrait','bottom','faithful','hd');assert.equal(faithful.scale,1);assert.equal(faithful.y,faithful.height-1080);
  const four=taskGeometry(960,540,'portrait','right','faithful','4k');assert.equal(four.width,2160);assert.equal(four.height,3840);assert.equal(four.x,1200);assert.equal(four.scale,1);
  assert.throws(()=>taskGeometry(100,100,'portrait','center','unknown'),/INVALID_TASK/);assert.throws(()=>taskGeometry(100,100,'portrait','center','smart','fake4k'),/INVALID_TASK/);
});
test('pixel proof checks every protected RGBA channel, placement and alpha',()=>{
  const source=new Uint8ClampedArray([8,17,31,255,32,64,96,127,0,0,0,0,255,255,255,1]);
  const output=new Uint8ClampedArray(4*3*4);output.fill(93);const placement={x:1,y:1,source_width:2,source_height:2,scale:1};
  for(let y=0;y<2;y++)for(let x=0;x<2;x++)for(let c=0;c<4;c++)output[((y+1)*4+x+1)*4+c]=source[(y*2+x)*4+c];
  const args={sourceData:source,sourceWidth:2,sourceHeight:2,outputData:output,outputWidth:4,outputHeight:3,placement};
  const proof=verifyProtectedPixels(args);assert(proof.verified);assert.equal(proof.checked_channel_count,16);assert.equal(proof.channel_difference_count,0);
  output[((1+1)*4+1+1)*4+3]=2;const damaged=verifyProtectedPixels(args);assert(!damaged.verified);assert.equal(damaged.channel_difference_count,1);assert.equal(damaged.pixel_difference_count,1);assert.equal(damaged.max_channel_difference,1);
  assert.throws(()=>verifyProtectedPixels({...args,placement:{...placement,scale:2}}),/INVALID_PROTECTED_PLACEMENT/);assert.throws(()=>verifyProtectedPixels({...args,outputData:new Uint8Array(5)}),/INVALID_PIXEL_BUFFERS/);
});
test('declarations, mode mismatch, unbound tasks and missing pixel proofs never enter controlled score',()=>{
  const good=controlledOutput();assert(comparisonEligibility(pair,good,good).eligible);
  for(const patch of [{mode:undefined},{mode:'infographic'},{task_parameters_hash:null},{task_parameters_hash:'e'.repeat(64)},{provenance_basis:'uploader-sidecar-with-exact-input-and-output-hashes'},{provenance_verified:false},{provenance_evidence:{source_sha256:hash,output_sha256:'e'.repeat(64)}},{pixel_proof:null},{pixel_proof:{...good.pixel_proof,channel_difference_count:1}},{pixel_proof:{...good.pixel_proof,checked_scope:'normalized-rgba-values'}},{pixel_proof:{...good.pixel_proof,output_sha256:'e'.repeat(64)}}])assert(!comparisonEligibility(pair,{...good,...patch},good).eligible,JSON.stringify(patch));
  const legacy=controlledOutput('cinematic'),smart=controlledOutput('smart');assert(comparisonEligibility(pair,legacy,smart).eligible);assert.equal(comparisonEligibility(pair,legacy,smart).mode,'smart');
  const text=controlledOutput('infographic');text.pixel_proof=null;assert(comparisonEligibility(pair,text,text).eligible);assert.equal(comparisonEligibility(pair,text,text).rubric[0],'textAccuracy');
});
test('4K metadata boolean cannot promote simulation, low size, massive image or unverified reference',()=>{
  const out={width:2160,height:3840,resolution_verified:true,resolution_origin:'native'};assert(verifiedFourK(out));
  for(const patch of [{resolution_origin:'simulation'},{width:1080},{height:2000},{width:30000},{resolution_verified:false},{resolution_origin:'reference-provided'},{resolution_origin:'reference-provided',origin:'reference'}])assert(!verifiedFourK({...out,...patch}),JSON.stringify(patch));
  assert(verifiedFourK({...out,resolution_origin:'upscaled'}));for(const origin of ['provider-native','provider-native-composite']){assert(!verifiedFourK({...out,resolution_origin:origin}));assert(verifiedFourK({...out,resolution_origin:origin,native_4k:true}));}assert(verifiedFourK({...out,resolution_origin:'reference-provided',origin:'reference',reference_only:true}));
  const p=structuredClone(pair);p.variants.portrait.fourK={...out,path:'P4.png',resolution_origin:'simulation'};assert.equal(selectAsset(p,'portrait','4k').quality,'hd');assert.equal(selectAsset(p,'portrait','4k').missing,true);
});
test('accepting 4K first keeps the opposite composition visible with its true quality',()=>{
  const p=structuredClone(pair);delete p.variants.portrait.hd;
  p.variants.portrait.fourK={sha256:'e'.repeat(64),width:2160,height:3840,path:'only-P4.png',resolution_verified:true,resolution_origin:'provider-native',native_4k:true};
  for(const requested of ['hd','auto']){const selected=selectAsset(p,'portrait',requested,1);assert.equal(selected.asset.path,'only-P4.png');assert.equal(selected.orientation,'portrait');assert.equal(selected.quality,'4k');assert.equal(selected.missing,true);}
  assert.equal(selectAsset(p,'portrait','4k').missing,false);
  p.variants.portrait.fourK.resolution_origin='simulation';assert.equal(selectAsset(p,'portrait','hd').quality,'original');
});

test('originals retain their real quality label even in the source orientation branch',()=>{
  const p=structuredClone(pair);p.variants.landscape.hd={sha256:hash,width:8,height:4,path:'tiny-original.png',origin:'original'};
  for(const request of ['hd','auto','4k'])assert.equal(selectAsset(p,'landscape',request).quality,'original');
  assert.equal(selectAsset(p,'landscape','4k').missing,true);
  assert.equal(selectAsset(p,'portrait','hd').quality,'hd');
});

test('imported counterparts never acquire an HD or verified 4K label from their slot',()=>{
 const p=structuredClone(pair);p.variants.portrait.hd={sha256:hash,width:108,height:192,path:'imported.png',origin:'imported',resolution_origin:'imported-unverified',resolution_verified:false};
 for(const request of ['hd','auto','4k'])assert.equal(selectAsset(p,'portrait',request).quality,'imported');
 assert.equal(selectAsset(p,'portrait','4k').missing,true);
 assert.equal(verifiedFourK({...p.variants.portrait.hd,width:2160,height:3840}),false);
});

test('regeneration creates a distinct attempt while retries retain the exact idempotency key',async()=>{
  const request={input_sha256:hash,target:'portrait',mode:'faithful',seed:42,model:'fal-bria',quality:'hd',upload_consent:{external:true,at:'first-consent'}};
  const first=await jobIdempotencyKey(request);
  assert.equal(first,await jobIdempotencyKey({...request,upload_consent:{external:true,at:'later-consent'}}));
  const regenerate=await jobIdempotencyKey(request,'explicit-attempt-1');
  assert.notEqual(first,regenerate);
  assert.equal(regenerate,await jobIdempotencyKey(request,'explicit-attempt-1'));
  assert.notEqual(regenerate,await jobIdempotencyKey(request,'explicit-attempt-2'));
  assert.notEqual(first,await jobIdempotencyKey({...request,seed:43}));
});

test('gateway recovery consumes saved accepted outputs without polling a terminal job forever',()=>{
  for(const status of ['READY','ACCEPTED'])assert.equal(gatewayStateAction(status),'result');
  for(const status of ['FAILED','CANCELLED','HELD'])assert.equal(gatewayStateAction(status),'terminal');
  for(const status of ['PENDING','RUNNING'])assert.equal(gatewayStateAction(status),'poll');
  assert.throws(()=>gatewayStateAction('UNKNOWN'),/INVALID_GATEWAY_STATE/);
});

test('model readiness respects the selected output quality and never promotes held capability',()=>{
  const ready={models:[{key:'fal-bria',live_enabled:true,quality_gates:{hd:true,'4k':false}}]};
  assert.equal(liveModelAvailable(ready,'fal-bria','hd'),true);
  assert.equal(liveModelAvailable(ready,'fal-bria','4k'),false);
  assert.equal(liveModelAvailable(ready,'fal-nano','hd'),false);
  assert.equal(liveModelAvailable({models:[{key:'fal-bria',live_enabled:false,available:false,quality_gates:{hd:true}}]},'fal-bria','hd'),false);
  assert.equal(liveModelAvailable(null,'fal-bria','hd'),false);
});
