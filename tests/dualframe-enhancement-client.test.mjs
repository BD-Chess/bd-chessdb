import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
import {IDBFactory} from 'fake-indexeddb';
import {createEnhancementClient} from '../public/Nara/dualframe-lab/enhancement-client.mjs';
const sharp=createRequire(new URL('../functions/package.json',import.meta.url))('sharp');
if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const hash=value=>createHash('sha256').update(value).digest('hex');
const digest=async value=>hash(Buffer.from(await value.arrayBuffer()));
const clone=value=>structuredClone(value);
const recipe={schema:'bd.dualframe.enhancement.v1',kind:'natural',strength:'natural',background:'keep'};
async function fixture(options={}){
 globalThis.indexedDB=new IDBFactory();
 const storage=await import('../public/Nara/dualframe-lab/store.mjs?enhance='+crypto.randomUUID());await storage.openStore();const store=storage.captureStorageScope();
 const raster=async(width,height,color)=>new Blob([await sharp({create:{width,height,channels:4,background:{r:color,g:30,b:90,alpha:1}}}).png().toBuffer()],{type:'image/png'});
 const raw=await raster(64,48,100),normalized=await raster(64,48,105),old=await raster(36,64,70);
 const pair={schema:'bd.dualframe.pair.v1',pair_id:'local_fixture_0001',original:{blob:raw,normalized,sha256:await digest(raw),width:64,height:48,source_orientation:'landscape',filename:'synthetic.png',visibility:'private'},variants:{landscape:{},portrait:{hd:{asset_id:'old_variant_0001',blob:old,sha256:await digest(old),width:36,height:64,direction:'portrait',path:'old.png',acceptance:'ACCEPTED'}}},jobs:[],candidates:[]};await store.putPair(pair);
 const plans=new Map(),jobs=new Map(),assets=new Map(),counts={enhance:0,frames:0,accept:0,download:0,upload:0},events=[];
 const api={};let failFrames=!!options.failFrames,ambiguousStart=!!options.ambiguousStart,failHD=!!options.failHD;
 const family=async id=>(await store.getPair(pair.pair_id)).enhancement_families?.find(value=>value.plan_id===id);
 async function asset(plan,call,color,extra={}){
  const width=call.operation==='enhance'?64:call.target==='portrait'?(plan.quality==='4k'?2160:36):(plan.quality==='4k'?3840:64),height=call.operation==='enhance'?48:call.target==='portrait'?(plan.quality==='4k'?3840:64):(plan.quality==='4k'?2160:36),blob=await raster(width,height,color),asset_id='asset_'+call.call_id;
  const meta={asset_id,sha256:await digest(blob),byte_size:blob.size,mime:blob.type,width,height,pair_id:plan.pair_id,family_id:plan.family_id,source_sha256:plan.source_sha256,...extra};assets.set(asset_id,blob);return meta;
 }
 async function stateFor(plan,call){
  const master=jobs.get(plan.calls[0].call_id),base={job_id:call.call_id,enhancement_plan_id:plan.plan_id,family_id:plan.family_id,pair_id:plan.pair_id,input_sha256:plan.source_sha256,operation:call.operation,target:call.target,quality:plan.quality,provider:'synthetic',model:'synthetic-model',status:call.operation==='enhance'&&!plan.review_master?'ACCEPTED':'READY'};
  if(call.operation==='enhance')return {...base,output:await asset(plan,call,180)};
  return {...base,master_job_id:master.job_id,master_asset_id:master.output.asset_id,master_sha256:master.output.sha256,output:await asset(plan,call,200,{master_sha256:master.output.sha256})};
 }
 api.uploadPair=async uploaded=>{counts.upload++;assert.ok(uploaded.original.blob instanceof Blob);assert.ok(uploaded.original.normalized instanceof Blob);assert.deepEqual(uploaded.variants,{landscape:{},portrait:{}});assert.deepEqual(uploaded.jobs,[]);assert.equal(await digest(uploaded.original.blob),pair.original.sha256);return {pair_id:'remote_fixture_0001',original:{sha256:pair.original.sha256}};};
 api.asset=async id=>{counts.download++;events.push('download:'+id);if(failHD&&id.startsWith('hd_')){failHD=false;throw Error('HD_NETWORK_INTERRUPTED');}const blob=assets.get(id);return options.corruptMaster&&id===jobs.values().next().value?.output.asset_id?new Blob(['bad'],{type:'image/png'}):blob;};
 api.awaitJob=async id=>{const state=jobs.get(id),local=await family(state.enhancement_plan_id);if(state.operation==='enhance')assert.equal(local.master_receipt?.job_id||local.master_job_id,id,'master receipt is durable before polling');events.push('poll:'+id);return clone(state);};
 api.request=async(path,{method='GET',body}={})=>{
  events.push(method+':'+path);
  if(path==='/plans'&&method==='POST'){
   assert.match(body.idempotency_key,/^[a-f0-9]{64}$/);assert.equal(body.pair_id,'remote_fixture_0001');const id=hash('plan:'+body.idempotency_key),call=(target,operation)=>({call_id:hash(id+target+operation),target,operation,model_calls:1});
   const plan={plan_id:id,family_id:id,fingerprint:hash('fingerprint:'+id),source_sha256:body.input_sha256,pair_id:body.pair_id,recipe:body.recipe,recipe_hash:hash(JSON.stringify(body.recipe)),model:body.model,provider:'synthetic',tier:body.service_tier,review_master:body.review_master,enhance_only:body.enhance_only,quality:body.quality,include_hd:body.include_hd,calls:[call('landscape','enhance'),...(body.enhance_only?[]:[call('portrait','expand'),call('landscape','derive')])],maximum_api_calls:body.enhance_only?1:2,available:!options.blocked,blocked_reason:options.blocked?'FREE_PROVIDER_NOT_CONFIGURED':null,cost:null,geometry:{master:{width:64,height:48}},paid_fallback:false};plans.set(id,plan);return clone(plan);
  }
  if(path==='/enhance'&&method==='POST'){
   counts.enhance++;const plan=plans.get(body.plan_id),local=await family(plan.plan_id);assert.equal(local.submit_intent.consent_fingerprint,plan.fingerprint);assert.equal(body.consent_fingerprint,plan.fingerprint);const state=await stateFor(plan,plan.calls[0]);jobs.set(state.job_id,state);
   if(ambiguousStart){ambiguousStart=false;throw Error('PROVIDER_TRANSPORT_UNCERTAIN');}return {plan_id:plan.plan_id,family_id:plan.family_id,job_id:state.job_id,status:state.status};
  }
  const planMatch=path.match(/^\/plans\/([a-f0-9]{64})(\/frames)?$/);
  if(planMatch){const plan=plans.get(planMatch[1]);if(!planMatch[2])return {...clone(plan),jobs:plan.calls.map(call=>clone(jobs.get(call.call_id)||{job_id:call.call_id,status:'PLANNED',operation:call.operation,target:call.target}))};
   counts.frames++;const local=await family(plan.plan_id);assert.equal(local.master.acceptance,'ACCEPTED');assert.equal(await digest(await store.getStoredBlob(local.master.blob)),body.master_sha256,'master bytes must be committed before frames');assert.equal(local.master.sha256,jobs.get(plan.calls[0].call_id).output.sha256);
   if(failFrames){failFrames=false;throw Error('FRAME_NETWORK_INTERRUPTED');}
   for(const call of plan.calls.slice(1))if(!jobs.has(call.call_id))jobs.set(call.call_id,await stateFor(plan,call));return {plan_id:plan.plan_id,family_id:plan.family_id,jobs:plan.calls.slice(1).map(call=>({job_id:call.call_id,target:call.target,operation:call.operation,status:jobs.get(call.call_id).status}))};
  }
  const jobMatch=path.match(/^\/jobs\/([a-f0-9]{64})(?:\/(accept|reject))?$/);
  if(jobMatch){const state=jobs.get(jobMatch[1]);if(method==='POST'){
    const local=await store.getPair(pair.pair_id),saved=state.operation==='enhance'?familyIn(local,state.enhancement_plan_id).master:local.candidates.find(asset=>asset.asset_id===state.output.asset_id);assert.equal(await digest(await store.getStoredBlob(saved.blob)),state.output.sha256,'candidate bytes durable before acceptance');
    if(jobMatch[2]==='reject')state.status='REJECTED';else {counts.accept++;state.status='ACCEPTED';const plan=plans.get(state.enhancement_plan_id);
     if(plan.quality==='4k'&&plan.include_hd&&state.operation!=='enhance'&&!state.hd_copy){const portrait=state.target==='portrait',blob=await raster(portrait?1080:1920,portrait?1920:1080,200),asset_id='hd_'+state.job_id;assets.set(asset_id,blob);state.hd_copy={asset_id,sha256:await digest(blob),byte_size:blob.size,mime:blob.type,width:portrait?1080:1920,height:portrait?1920:1080,pair_id:plan.pair_id,family_id:plan.family_id,source_sha256:plan.source_sha256,master_sha256:state.master_sha256,parent_sha256:state.output.sha256,parent_asset_id:state.output.asset_id,parent_asset_ids:[state.output.asset_id],model_calls:0};}
    }
   }return clone(state);
  }
  throw Error('UNEXPECTED_REQUEST:'+method+':'+path);
 };
 const client=()=>createEnhancementClient({api,store});
 return {pair,storage,store,api,client,counts,plans,jobs,assets,events,family,options:{recipe,model:'synthetic-model',service_tier:'premium',...options.planOptions}};
}
function familyIn(pair,id){return pair.enhancement_families.find(value=>value.plan_id===id);}

test('explicit plan hydrates only source bytes; blocked Free plan cannot submit provider work',async()=>{
 const f=await fixture({blocked:true});let reads=0;const scoped={...f.store,getStoredBlob:async value=>{reads++;return f.store.getStoredBlob(value);}},client=createEnhancementClient({api:f.api,store:scoped});
 const plan=await client.plan(f.pair.pair_id,{...f.options,service_tier:'free'});assert.equal(reads,2);assert.equal(f.counts.upload,1);assert.equal((await f.family(plan.plan_id)).status,'BLOCKED');
 await assert.rejects(client.start(f.pair.pair_id,plan),/FREE_PROVIDER_NOT_CONFIGURED/);assert.equal(f.counts.enhance,0);assert.equal(f.counts.frames,0);assert.ok((await f.store.getPair(f.pair.pair_id)).variants.portrait.hd.blob);
});
test('master and receipt are durable before dependent jobs; accepted outputs preserve original and prior selected variants',async()=>{
 const f=await fixture(),client=f.client(),plan=await client.plan(f.pair.pair_id,f.options),family=await client.start(f.pair.pair_id,plan);assert.equal(family.status,'COMPLETE');assert.equal(f.counts.enhance,1);assert.equal(f.counts.frames,1);
 const local=await f.store.getPair(f.pair.pair_id);assert.equal(await digest(await f.store.getStoredBlob(local.original.blob)),f.pair.original.sha256);assert.equal(local.masters[0].acceptance,'ACCEPTED');assert.ok(local.candidates.some(asset=>asset.asset_id==='old_variant_0001'));assert.notEqual(local.variants.portrait.hd.asset_id,'old_variant_0001');assert.equal(local.jobs.length,3);
 await f.client().resume(f.pair.pair_id,plan.plan_id);assert.equal(f.counts.enhance,1);assert.equal(f.jobs.size,3);assert.equal(f.counts.download,3,'reload reuses verified saved bytes');
});
test('review pause survives client recreation; explicit master acceptance authorizes frames and rejection preserves the source',async()=>{
 const f=await fixture({planOptions:{review_master:true}}),plan=await f.client().plan(f.pair.pair_id,f.options);assert.equal((await f.client().start(f.pair.pair_id,plan)).status,'MASTER_READY');assert.equal(f.counts.frames,0);
 assert.equal((await f.client().resume(f.pair.pair_id,plan.plan_id)).status,'MASTER_READY');assert.equal(f.counts.enhance,1);assert.equal(f.counts.frames,0);
 assert.equal((await f.client().acceptMaster(f.pair.pair_id,plan.plan_id)).status,'COMPLETE');assert.equal(f.counts.enhance,1);assert.equal(f.counts.frames,1);
 const next=await f.client().plan(f.pair.pair_id,f.options);await f.client().start(f.pair.pair_id,next);assert.equal((await f.client().rejectMaster(f.pair.pair_id,next.plan_id)).status,'REJECTED');const local=await f.store.getPair(f.pair.pair_id);assert.equal(local.masters.find(master=>master.family_id===next.family_id).acceptance,'REJECTED');assert.equal(await digest(await f.store.getStoredBlob(local.original.blob)),f.pair.original.sha256);assert.equal(f.counts.frames,1);
});
test('stage-two failure retains accepted master; explicit resume recovers the same jobs without another enhancement submission',async()=>{
 const f=await fixture({failFrames:true}),plan=await f.client().plan(f.pair.pair_id,f.options);await assert.rejects(f.client().start(f.pair.pair_id,plan),/FRAME_NETWORK_INTERRUPTED/);
 const held=await f.family(plan.plan_id);assert.equal(held.status,'HELD');assert.equal(held.master.acceptance,'ACCEPTED');assert.equal(await digest(await f.store.getStoredBlob(held.master.blob)),held.master.sha256);
 assert.equal((await f.client().resume(f.pair.pair_id,plan.plan_id)).status,'COMPLETE');assert.equal(f.counts.enhance,1);assert.equal(f.jobs.size,3);
});
test('ambiguous master submission persists intent and recovery never posts enhance again, including repeated start clicks',async()=>{
 const f=await fixture({ambiguousStart:true}),client=f.client(),plan=await client.plan(f.pair.pair_id,f.options);await assert.rejects(client.start(f.pair.pair_id,plan),/PROVIDER_TRANSPORT_UNCERTAIN/);
 const held=await f.family(plan.plan_id);assert.ok(held.submit_intent);assert.equal(held.automatic_paid_retry,false);assert.equal(held.status,'HELD');
 const recovered=await Promise.all([client.start(f.pair.pair_id,plan),client.resume(f.pair.pair_id,plan.plan_id)]);assert.ok(recovered.every(family=>family.status==='COMPLETE'));assert.equal(f.counts.enhance,1);assert.equal(f.jobs.size,3);
});
test('corrupt master blocks dependent work and keeps original plus immutable plan for recovery',async()=>{
 const f=await fixture({corruptMaster:true}),plan=await f.client().plan(f.pair.pair_id,f.options);await assert.rejects(f.client().start(f.pair.pair_id,plan),/OUTPUT_SIZE_MISMATCH|OUTPUT_HASH_MISMATCH/);assert.equal(f.counts.frames,0);const local=await f.store.getPair(f.pair.pair_id);assert.equal(local.masters,undefined);assert.equal(await digest(await f.store.getStoredBlob(local.original.blob)),f.pair.original.sha256);assert.equal(familyIn(local,plan.plan_id).plan.fingerprint,plan.fingerprint);
});
test('4K acceptance retains exact parent and deterministic HD copies; interrupted copy resumes without paid work',async()=>{
 const f=await fixture({failHD:true,planOptions:{quality:'4k',include_hd:true}}),plan=await f.client().plan(f.pair.pair_id,f.options);await assert.rejects(f.client().start(f.pair.pair_id,plan),/HD_NETWORK_INTERRUPTED/);
 let local=await f.store.getPair(f.pair.pair_id);assert.equal(local.variants.portrait.fourK.acceptance,'ACCEPTED');const parent=local.variants.portrait.fourK.sha256;assert.equal(await digest(await f.store.getStoredBlob(local.variants.portrait.fourK.blob)),parent);
 assert.equal((await f.client().resume(f.pair.pair_id,plan.plan_id)).status,'COMPLETE');local=await f.store.getPair(f.pair.pair_id);assert.equal(local.variants.portrait.fourK.sha256,parent);assert.equal(local.variants.portrait.hd.parent_sha256,parent);assert.equal(local.variants.portrait.hd.model_calls,0);assert.equal(local.variants.portrait.hd.width,1080);assert.equal(local.variants.portrait.hd.height,1920);assert.equal(f.counts.enhance,1);assert.equal(f.jobs.size,3);
});
test('captured old account scope rejects late work after account change before any subsequent provider request',async()=>{
 const f=await fixture(),plan=await f.client().plan(f.pair.pair_id,f.options),awaitJob=f.api.awaitJob;
 f.api.awaitJob=async(...args)=>{const state=await awaitJob(...args);await f.storage.setStorageOwner('account_second_fixture');return state;};
 await assert.rejects(f.client().start(f.pair.pair_id,plan),/STORAGE_OWNER_CHANGED/);assert.equal(f.counts.enhance,1);assert.equal(f.counts.frames,0);assert.deepEqual(await f.storage.getPairs(),[]);
 await f.storage.setStorageOwner('bd-research-owner');await assert.rejects(f.store.getPair(f.pair.pair_id),/STORAGE_OWNER_CHANGED/);
 const restored=await f.storage.getPair(f.pair.pair_id);assert.equal(await digest(await f.storage.getStoredBlob(restored.original.blob)),f.pair.original.sha256);assert.equal(restored.masters,undefined);
});
