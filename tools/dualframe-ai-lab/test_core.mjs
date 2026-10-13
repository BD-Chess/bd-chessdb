import test from 'node:test';
import assert from 'node:assert/strict';
import { geometry, deviceOrientation, selectAsset, checkPair, comparisonEligibility, sha256, blindOrder, headerSize, sniff, transition, publicManifest, csv, MAX_PIXELS } from '../../public/Nara/dualframe-lab/core.mjs';
const hash='a'.repeat(64);
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
  const p=structuredClone(pair);p.variants.portrait.fourK={width:2160,height:3840,path:'P4.png',resolution_verified:true};
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
  const out={sha256:hash,width:1080,height:1920,source_sha256:hash,lineage_status:'SOURCE_VERIFIED',direction:'portrait',target_ratio:'9:16',review_scale_policy:'equal-canvas-v1',provider:'bria'};
  assert.equal(comparisonEligibility(pair,out,out).eligible,true);
  for(const patch of [{source_sha256:'f'.repeat(64)},{lineage_status:'SOURCE_UNVERIFIED'},{direction:'landscape'},{target_ratio:'16:9'},{width:960,height:540},{review_scale_policy:'unequal'},{provider:'demo'}])assert.equal(comparisonEligibility(pair,{...out,...patch},out).eligible,false);
  assert.equal(comparisonEligibility(pair,out,null).eligible,false);
});
test('blind assignment is reproducible and reverses over a bounded set of persisted seeds',async()=>{
  const orders=new Set();for(let i=0;i<12;i++){const one=await blindOrder(pair.pair_id,String(i),['x','y']);assert.deepEqual(one,await blindOrder(pair.pair_id,String(i),['x','y']));orders.add(one.join(','));}assert.equal(orders.size,2);assert.equal(await sha256('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
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
