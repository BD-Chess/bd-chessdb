import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
const sharp=createRequire(new URL('../functions/package.json',import.meta.url))('sharp');
import {finishImage,hash} from '../functions/lib/dualframe/images.mjs';
import {publicCapabilities} from '../functions/lib/dualframe/contracts.mjs';
import {createService} from '../functions/lib/dualframe/service.mjs';
import {passwordVerifier,signToken} from '../functions/lib/dualframe/auth.mjs';
import {fixtureAccountUsage} from './fixtures/account-usage.mjs';

const owner='bd-research-owner',secret=randomBytes(32).toString('hex'),password=randomBytes(16).toString('hex'),verifier=passwordVerifier(password),key=randomBytes(32).toString('hex');
const env=k=>k==='DF_SESSION_SECRET'?secret:k==='DF_PASSWORD_VERIFIER'?verifier:k==='DF_XAI_API_KEY'?key:null;
const source=await sharp({create:{width:160,height:90,channels:4,background:'#206080'}}).png().toBuffer();
const native={operation:'expand',model:'grok-imagine',provider:'xai',target:'landscape',quality:'hd',mode:'smart',position:'center',seed:1729,preserve_provider_native:true,input_sha256:hash(source)};
const jpeg=await sharp(source).jpeg({quality:91}).withMetadata({orientation:1}).toBuffer();
class Store{
 constructor(){this.map=new Map();}
 async set(k,v,o={}){if(o.onlyIfNew&&this.map.has(k))return {modified:false};this.map.set(k,Buffer.from(v));return {modified:true};}
 async setJSON(k,v,o={}){if(o.onlyIfNew&&this.map.has(k))return {modified:false};this.map.set(k,structuredClone(v));return {modified:true};}
 async get(k,o={}){const v=this.map.get(k);if(v===undefined)return null;if(o.type==='arrayBuffer'){const b=Buffer.from(v);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}return structuredClone(v);}
 async delete(k){this.map.delete(k);}
 async list({prefix}){return {blobs:[...this.map.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))};}
}
async function harness(){
 const store=new Store(),scheduled=[];let calls=0;
 const service=createService({store,env,accountUsage:fixtureAccountUsage(['other_native_owner']),dispatch:async p=>scheduled.push(p),runProvider:async j=>{calls++;assert.equal(j.preserve_provider_native,true);return {bytes:jpeg,model:'grok-imagine-image-2.0',parameters:{seed_applied:null},request_id:'offline-native'};}});
 const session=await(await service.handle(new Request('https://www.mdlxdcc.org/api/df/auth',{method:'POST',body:JSON.stringify({password,device:'native_fixture'})}))).json();
 const pair={pair_id:'native_pair_fixture',original:{asset_id:'original_native_fixture',sha256:hash(source),kind:'original'},normalized:{asset_id:'normalized_native_fixture',sha256:hash(source),kind:'normalized',width:160,height:90}};
 await store.setJSON(`pairs/${owner}/${pair.pair_id}`,pair);
 for(const a of [pair.original,pair.normalized]){await store.set(`assets/${owner}/${a.asset_id}`,source);await store.setJSON(`asset-meta/${owner}/${a.asset_id}`,{...a,owner,byte_size:source.length,mime:'image/png'});}
 const api=(path,method='GET',body,token=session.token,headers={})=>service.handle(new Request('https://www.mdlxdcc.org/api/df'+path,{method,headers:{authorization:'Bearer '+token,...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})}));
 const body={model:native.model,pair_id:pair.pair_id,input_sha256:hash(source),target:native.target,quality:native.quality,mode:native.mode,position:'center',seed:1729,prompt:'Recompose this exact reference',idempotency_key:hash(Buffer.from('native fixture')),preserve_provider_native:true};
 return {store,service,scheduled,api,body,calls:()=>calls};
}

test('native PNG/JPEG/WebP bytes, MIME and dimensions are unchanged; old HD still resamples',async()=>{
 for(const [format,mime] of [['png','image/png'],['jpeg','image/jpeg'],['webp','image/webp']]){
  const bytes=await sharp(source).toFormat(format).toBuffer(),result=await finishImage(bytes,source,native);
  assert.deepEqual(result.bytes,bytes);assert.equal(result.output.mime,mime);assert.equal(result.output.width,160);assert.equal(result.output.height,90);assert.equal(result.output.provider_width,160);assert.equal(result.output.provider_height,90);assert.equal(result.output.sha256,hash(bytes));assert.equal(result.output.provider_response_sha256,hash(bytes));assert.equal(result.output.byte_size,bytes.length);assert.equal(result.output.resolution_origin,'provider-native-unmodified');
 }
 const legacy=await finishImage(jpeg,source,{...native,preserve_provider_native:false});assert.equal(legacy.output.width,1920);assert.equal(legacy.output.height,1080);assert.equal(legacy.output.mime,'image/png');assert.notEqual(legacy.output.sha256,hash(jpeg));
});

test('native rejects unsupported jobs, bad aspect, rotated EXIF and incomplete image bytes',async()=>{
 for(const change of [{model:'openai-flare'},{mode:'faithful'},{operation:'generate'},{quality:'4k'}])await assert.rejects(finishImage(jpeg,source,{...native,...change}),/NATIVE_OUTPUT_UNSUPPORTED/);
 const wrong=await sharp(source).resize(90,160).png().toBuffer();await assert.rejects(finishImage(wrong,source,native),/NATIVE_IMAGE_ASPECT_INVALID/);
 const rotated=await sharp(source).jpeg().withMetadata({orientation:6}).toBuffer();await assert.rejects(finishImage(rotated,source,native),/NATIVE_IMAGE_INVALID/);
 await assert.rejects(finishImage(jpeg.subarray(0,Math.floor(jpeg.length/2)),source,native),/NATIVE_IMAGE_INVALID/);
});

test('native flag validation and owner restrictions run before dispatch; capability is explicit',async()=>{
 const h=await harness();
 for(const change of [{preserve_provider_native:'true'},{model:'openai-flare'},{mode:'faithful'},{quality:'4k'}]){const r=await h.api('/expand','POST',{...h.body,...change});assert.equal(r.status,400);assert.match((await r.json()).error,/NATIVE_OUTPUT_(OPTION_INVALID|UNSUPPORTED)/);}
 const foreign=signToken({owner:'other_native_owner',scope:'session',auth_method:'legacy-password'},secret,1200);
 assert.equal((await h.api('/expand','POST',h.body,foreign)).status,403);assert.equal(h.scheduled.length,0);assert.equal(h.calls(),0);
 const cap=publicCapabilities(env);assert.equal(cap.models.find(m=>m.key==='grok-imagine').native_output_preserved,true);assert.equal(cap.models.find(m=>m.key==='openai-flare').native_output_preserved,false);
});

test('legacy fingerprint survives omitted/false flag; native CAS is one call and remains owner-bound',async()=>{
 const h=await harness(),old={...h.body};delete old.preserve_provider_native;
 let r=await h.api('/expand','POST',old);assert.equal(r.status,202);const oldId=(await r.json()).job_id;
 const legacy=await h.store.get(`jobs/${owner}/${oldId}`);assert.equal(Object.hasOwn(legacy,'preserve_provider_native'),false);
 const e={operation:'expand',model:old.model,provider:'xai',pair_id:old.pair_id,input_sha256:old.input_sha256,normalized_asset_id:'normalized_native_fixture',target:old.target,quality:old.quality,mode:old.mode,position:old.position,prompt:old.prompt,seed:old.seed,task_parameters_hash:null,text_layout:null};assert.equal(legacy.request_fingerprint,hash(Buffer.from(JSON.stringify(e))));
 r=await h.api('/expand','POST',{...old,preserve_provider_native:false});assert.equal((await r.json()).reused,true);
 assert.equal((await h.api('/expand','POST',h.body)).status,409);
 const body={...h.body,idempotency_key:hash(Buffer.from('new native reservation'))};
 const submitted=await Promise.all([h.api('/expand','POST',body),h.api('/expand','POST',body)]);assert.deepEqual(submitted.map(r=>r.status),[202,202]);const ids=await Promise.all(submitted.map(r=>r.json()));assert.equal(ids[0].job_id,ids[1].job_id);assert.equal(h.scheduled.length,2);
 const event=h.scheduled[1];await Promise.all([h.service.work(event),h.service.work(event)]);assert.equal(h.calls(),1);
 const state=await(await h.api('/jobs/'+event.job_id)).json();assert.equal(state.status,'READY');assert.equal(state.preserve_provider_native,true);assert.equal(state.output.sha256,hash(jpeg));assert.equal(state.output.provider_response_sha256,hash(jpeg));assert.equal(state.output.normalization_proof.verified,true);
 const asset=await h.api('/assets/'+state.output.asset_id,'GET',undefined,undefined,{range:`bytes=0-${jpeg.length-1}`});assert.equal(asset.status,206);assert.equal(asset.headers.get('content-type'),'image/jpeg');assert.deepEqual(Buffer.from(await asset.arrayBuffer()),jpeg);
 const scheduled=h.scheduled.length;await h.api('/jobs/'+event.job_id);await h.api('/jobs/'+event.job_id+'/resume','POST',{});assert.equal(h.scheduled.length,scheduled);assert.equal(h.calls(),1);
 const foreign=signToken({owner:'other_native_owner',scope:'session',auth_method:'legacy-password'},secret,1200);
 assert.equal((await h.api('/jobs/'+event.job_id,'GET',undefined,foreign)).status,404);assert.equal((await h.api('/assets/'+state.output.asset_id,'GET',undefined,foreign)).status,404);assert.equal(h.calls(),1);
});
