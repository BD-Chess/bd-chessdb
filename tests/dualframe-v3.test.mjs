import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
const sharp=createRequire(new URL('../functions/package.json',import.meta.url))('sharp');
import {passwordVerifier,checkPassword,signToken,verifyToken} from '../functions/lib/dualframe/auth.mjs';
import {MODELS,modelFor,publicCapabilities} from '../functions/lib/dualframe/contracts.mjs';
import {providerRequest,callProvider,safeImageURL,findImage} from '../functions/lib/dualframe/providers.mjs';
import {finishImage,hash} from '../functions/lib/dualframe/images.mjs';
import {createService} from '../functions/lib/dualframe/service.mjs';
import {MODELS as frontendModels} from '../public/Nara/dualframe-lab/models.mjs';
import {collectOrientationAssets,zipStore} from '../public/Nara/dualframe-lab/zip-store.mjs';

const secret=randomBytes(32).toString('base64url'),password=randomBytes(12).toString('hex'),verifier=passwordVerifier(password);
const fakeKey=randomBytes(32).toString('hex');
const env=k=>k==='DF_SESSION_SECRET'?secret:k==='DF_PASSWORD_VERIFIER'?verifier:MODELS.flatMap(m=>m.keys).includes(k)?fakeKey:null;
const job=model=>({model,prompt:'A quiet coast in warm evening light',target:'portrait',quality:'hd',mode:'smart',operation:'generate',position:'center',seed:42});
const png=await sharp({create:{width:160,height:90,channels:4,background:{r:40,g:110,b:190,alpha:1}}}).png().toBuffer();
class Store{constructor(){this.map=new Map();}async set(k,v,o={}){if(o.onlyIfNew&&this.map.has(k))return {modified:false};this.map.set(k,Buffer.from(v));return {modified:true};}async setJSON(k,v,o={}){if(o.onlyIfNew&&this.map.has(k))return {modified:false};this.map.set(k,structuredClone(v));return {modified:true};}async get(k,o={}){const v=this.map.get(k);if(v===undefined)return null;if(o.type==='arrayBuffer'){const b=Buffer.from(v);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}return structuredClone(v);}async delete(k){this.map.delete(k);}async list({prefix}){return {blobs:[...this.map.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))};}}

test('password verifier validates without storing the input password',()=>{assert.equal(checkPassword(password,verifier),true);assert.equal(checkPassword(password+'x',verifier),false);assert.equal(verifier.includes(password),false);});
test('saved session survives calls but expires, rejects changes and cannot act as a worker',()=>{const t=signToken({owner:'bd-research-owner',scope:'session'},secret,100,1000000);assert.equal(verifyToken(t,secret,'session',1001000).owner,'bd-research-owner');assert.throws(()=>verifyToken(t+'x',secret,'session',1001000));assert.throws(()=>verifyToken(t,secret,'worker',1001000));assert.throws(()=>verifyToken(t,secret,'session',1100000));});
test('seven providers and identical direct model contracts in UI and server',()=>{assert.equal(new Set(MODELS.map(m=>m.provider)).size,7);for(const m of MODELS)assert.equal(frontendModels.find(x=>x.key===m.key)?.endpoint,m.model);const c=publicCapabilities(env);assert.equal(c.models.length,11);assert.equal(c.models.some(m=>JSON.stringify(m).includes(fakeKey)),false);assert.equal(c.models.every(m=>m.account_verified===false),true);});
for(const model of MODELS)test(`${model.key}: exact provider route, one image and valid dimensions`,()=>{const r=providerRequest(job(model.key),null,env);assert.equal(new URL(r.url).protocol,'https:');const b=JSON.parse(r.body);assert.equal(b.model,model.model);if(b.n!==undefined)assert.equal(Number(b.n),1);if(b.parameters?.n!==undefined)assert.equal(b.parameters.n,1);if(model.provider==='openai'){assert.equal(r.size.width%16,0);assert.equal(r.size.height%16,0);}if(model.provider==='minimax'){assert.equal(r.size.width%8,0);assert.equal(r.size.height%8,0);}assert.equal(r.key,fakeKey);});
test('OpenAI image editing uses multipart while xAI editing uses JSON',()=>{const j={...job('openai-sunburst'),operation:'expand'};const a=providerRequest(j,png,env);assert.ok(a.body instanceof FormData);assert.equal(a.headers['content-type'],undefined);assert.ok(a.body.get('image[]'));const b=providerRequest({...j,model:'grok-imagine'},png,env);assert.equal(b.headers['content-type'],'application/json');assert.ok(JSON.parse(b.body).image.url.startsWith('data:image/png;base64,'));});
test('generation-only models do not silently pretend to edit a source',()=>{for(const key of ['glm-image','mistral-image','qwen-zimage'])assert.throws(()=>providerRequest({...job(key),operation:'expand'},png,env),/MODEL_GENERATION_ONLY/);});
test('provider rejection removes the credential from the diagnostic',async()=>{await assert.rejects(callProvider(job('grok-imagine'),null,env,{fetcher:async()=>Response.json({error:{message:'Rejected '+fakeKey}},{status:401})}),e=>e.code==='PROVIDER_REJECTED'&&!e.detail.includes(fakeKey)&&e.status===401);});
test('uncertain paid submission is marked uncertain and is never retried',async()=>{let count=0;await assert.rejects(callProvider(job('openai-sunburst'),null,env,{fetcher:async()=>{count++;throw Error('timeout');}}),e=>e.ambiguous===true);assert.equal(count,1);});
test('actual bytes are decoded from each supported provider response',async()=>{const b64=png.toString('base64');const samples=[['openai-sunburst',{data:[{b64_json:b64}]}],['gemini-nano',{output_image:{data:b64,mime_type:'image/png'}}],['grok-imagine',{data:[{b64_json:b64}]}],['minimax-image',{data:{image_base64:[b64]},base_resp:{status_code:0}}],['qwen-image-pro',{output:{choices:[{message:{content:[{image:'data:image/png;base64,'+b64}]}}]}}]];for(const [key,data] of samples){let count=0;const r=await callProvider(job(key),null,env,{fetcher:async()=>{count++;return Response.json(data);}});assert.deepEqual(r.bytes,png);assert.equal(count,1);}});
test('Mistral runs the image agent then downloads its returned file',async()=>{const urls=[];const r=await callProvider(job('mistral-image'),null,env,{fetcher:async(url)=>{urls.push(String(url));if(url.endsWith('/agents'))return Response.json({id:'agent_12345'});if(url.endsWith('/conversations'))return Response.json({outputs:[{content:[{type:'tool_file',file_id:'file_12345'}]}]});return new Response(png,{headers:{'content-type':'image/png'}});}});assert.deepEqual(r.bytes,png);assert.equal(urls.length,3);assert.ok(urls[2].endsWith('/files/file_12345/content'));});
test('Z-Image synchronous response completes with one submission and no task polling',async()=>{const calls=[];const r=await callProvider(job('qwen-zimage'),null,env,{fetcher:async(url,o)=>{calls.push(o?.method||'GET');if(String(url).includes('/multimodal-generation/generation'))return Response.json({output:{choices:[{message:{content:[{image:'https://cdn.example.com/result.png'}]}}]}});if(String(url)==='https://cdn.example.com/result.png')return new Response(png);throw Error('UNEXPECTED_REQUEST');}});assert.deepEqual(r.bytes,png);assert.deepEqual(calls,['POST','GET']);});
test('image download URLs reject credentials, private literal hosts and unsupported ports',()=>{for(const u of ['http://cdn.example.com/a.png','https://127.0.0.1/a','https://[::1]/a','https://localhost/a','https://metadata.google.internal/a','https://user:pass@example.com/a','https://cdn.example.com:444/a'])assert.throws(()=>safeImageURL(u));assert.equal(safeImageURL('https://cdn.example.com/a.png'),'https://cdn.example.com/a.png');});
test('Faithful checks saved RGBA including transparency, and labels enlarged output',async()=>{const data=Buffer.alloc(32*20*4);for(let n=0;n<data.length;n+=4){data[n]=n%255;data[n+1]=91;data[n+2]=153;data[n+3]=(n/4)%3?255:128;}const source=await sharp(data,{raw:{width:32,height:20,channels:4}}).png().toBuffer();const r=await finishImage(png,source,{...job('openai-sunburst'),operation:'expand',mode:'faithful',input_sha256:hash(source)});assert.equal(r.output.pixel_proof.verified,true);assert.equal(r.output.pixel_proof.channel_difference_count,0);assert.equal(r.output.resolution_origin,'upscaled');assert.equal(r.output.native_4k,false);assert.equal(r.output.sha256,hash(r.bytes));});
test('unauthenticated direct calls cannot upload, submit or read private files',async()=>{let calls=0;const s=createService({store:new Store(),env,runProvider:async()=>{calls++;return {bytes:png};}});for(const [path,method] of [['/expand','POST'],['/uploads/init','POST'],['/library','GET'],['/assets/abcdefgh','GET']]){const r=await s.handle(new Request('https://www.mdlxdcc.org/api/df'+path,{method,...(method==='POST'?{body:'{}'}:{})}));assert.equal(r.status,401);}assert.equal(calls,0);});
test('complete authenticated upload -> job -> saved image -> restore, with one paid reservation',async()=>{
 const store=new Store(),scheduled=[];let calls=0;const s=createService({store,env,dispatch:async p=>scheduled.push(p),runProvider:async()=>{calls++;return {bytes:png,model:'mock-contract',parameters:{},request_id:'fixture-request'};}});
 const login=await s.handle(new Request('https://www.mdlxdcc.org/api/df/auth',{method:'POST',body:JSON.stringify({password,device:'test_device'})}));assert.equal(login.status,200);const token=(await login.json()).token;
 const api=async(path,method='GET',body=null,raw=null,extra={})=>s.handle(new Request('https://www.mdlxdcc.org/api/df'+path,{method,headers:{authorization:'Bearer '+token,...extra},...(raw?{body:raw}:body?{body:JSON.stringify(body)}:{})}));
 const uploaded=[];for(const kind of ['original','normalized']){const t=await(await api('/uploads/init','POST',{kind,sha256:hash(png),size:png.length})).json();assert.ok(t.upload_id);assert.equal((await api(`/uploads/${t.upload_id}/0`,'PUT',null,png)).status,200);const done=await(await api(`/uploads/${t.upload_id}/finish`,'POST',{})).json();uploaded.push(done.asset_id);}
 const pair=await(await api('/pairs','POST',{original_asset_id:uploaded[0],normalized_asset_id:uploaded[1],original_sha256:hash(png),title:'Fixture'})).json();
 const body={model:'openai-sunburst',pair_id:pair.pair_id,input_sha256:hash(png),idempotency_key:hash(Buffer.from('one owner request')),target:'portrait',mode:'faithful',quality:'hd',position:'center',prompt:'Extend the coast',seed:42};
 const submit=await api('/expand','POST',body);assert.equal(submit.status,202);const id=(await submit.json()).job_id;
 const duplicate=await(await api('/expand','POST',body)).json();assert.equal(duplicate.job_id,id);assert.equal(scheduled.length,1);
 await Promise.all([s.work(scheduled[0]),s.work(scheduled[0])]);assert.equal(calls,1);
 const state=await(await api('/jobs/'+id)).json();assert.equal(state.status,'READY');assert.equal(state.output.pixel_proof.verified,true);
 const image=await api('/assets/'+state.output.asset_id,'GET',null,null,{range:'bytes=0-2097151'});assert.equal(image.status,206);assert.equal(hash(Buffer.from(await image.arrayBuffer())),state.output.sha256);
 assert.equal((await api(`/jobs/${id}/accept`,'POST',{})).status,200);const library=await(await api('/library')).json();assert.equal(library.pairs.length,1);assert.equal(library.jobs[0].status,'ACCEPTED');
 await api(`/jobs/${id}/resume`,'POST',{});assert.equal(scheduled.length,1);assert.equal(calls,1);
 const conflict=await api('/expand','POST',{...body,prompt:'A different request with the same key'});assert.equal(conflict.status,409);
});


function readStoredZip(buffer) {
 const end=buffer.lastIndexOf(Buffer.from([0x50,0x4b,0x05,0x06]));
 assert.ok(end>=0,'ZIP end record exists');
 const count=buffer.readUInt16LE(end+10),centralOffset=buffer.readUInt32LE(end+16),files=[];
 let cursor=centralOffset;
 for(let i=0;i<count;i++){
  assert.equal(buffer.readUInt32LE(cursor),0x02014b50,'central directory signature');
  const crc=buffer.readUInt32LE(cursor+16),size=buffer.readUInt32LE(cursor+24),nameLength=buffer.readUInt16LE(cursor+28),extraLength=buffer.readUInt16LE(cursor+30),commentLength=buffer.readUInt16LE(cursor+32),localOffset=buffer.readUInt32LE(cursor+42);
  const name=buffer.subarray(cursor+46,cursor+46+nameLength).toString('utf8');
  assert.equal(buffer.readUInt32LE(localOffset),0x04034b50,'local file signature');
  const localNameLength=buffer.readUInt16LE(localOffset+26),localExtraLength=buffer.readUInt16LE(localOffset+28),dataStart=localOffset+30+localNameLength+localExtraLength,data=buffer.subarray(dataStart,dataStart+size);
  let actual=0xffffffff;for(const byte of data){actual^=byte;for(let bit=0;bit<8;bit++)actual=actual&1?0xedb88320^(actual>>>1):actual>>>1;}actual=(actual^0xffffffff)>>>0;
  assert.equal(actual,crc,'CRC-32 verifies image bytes');
  files.push({name,data});
  cursor+=46+nameLength+extraLength+commentLength;
 }
 return files;
}

test('gallery ZIP collection includes distinct saved outputs for one orientation only',()=>{
 const a=new Blob(['same image']),b=new Blob(['portrait image']),c=new Blob(['another landscape']),d=new Blob(['provider B same bytes']);
 const pair={variants:{landscape:{hd:{blob:a,origin:'generated',direction:'landscape',sha256:'aa01',model_key:'model-a'}},portrait:{hd:{blob:b,origin:'generated',direction:'portrait',sha256:'bb01',model_key:'model-p'}}},candidates:[{blob:a,origin:'generated',direction:'landscape',sha256:'aa01',model_key:'model-a',candidate_id:'job-a'},{blob:c,origin:'generated',direction:'landscape',sha256:'cc01',model_key:'model-c',candidate_id:'job-c'},{blob:d,origin:'generated',direction:'landscape',sha256:'aa01',model_key:'model-b',candidate_id:'job-b'}],jobs:[{job_id:'job-c',target:'landscape',quality:'hd',candidate:{blob:c,origin:'generated',sha256:'cc01',model_key:'model-c'}},{job_id:'job-p',target:'portrait',quality:'hd',candidate:{blob:b,origin:'generated',direction:'portrait',sha256:'bb02',model_key:'model-p'}}],web_output:{blob:new Blob(['web output']),origin:'imported',direction:'landscape',sha256:'dd01',provider:'web-import'}};
 const items=collectOrientationAssets(pair,'landscape');
 assert.deepEqual(items.map(x=>x.asset.sha256),['aa01','cc01','aa01','dd01']);
 assert.equal(items[1].quality,'hd','job quality is retained for the model variant');
 assert.equal(collectOrientationAssets(pair,'portrait').length,2);
 assert.equal(collectOrientationAssets({variants:{landscape:{hd:{blob:a,origin:'original',direction:'landscape'}}}},'landscape').length,0);
});

test('ZIP_STORE contains exactly its selected images with valid names, sizes and CRC-32',async()=>{
 const one=Buffer.from([0,1,2,255]),two=Buffer.from('second image');
 const archive=await zipStore([{name:'images/portrait-žena.png',blob:new Blob([one])},{name:'images/model-b.webp',blob:new Blob([two])}]);
 assert.equal(archive.type,'application/zip');
 const files=readStoredZip(Buffer.from(await archive.arrayBuffer()));
 assert.deepEqual(files.map(x=>x.name),['images/portrait-žena.png','images/model-b.webp']);
 assert.deepEqual(files.map(x=>x.data),[one,two]);
 const single=await zipStore([{name:'only.png',blob:new Blob([one])}]);
 assert.equal(readStoredZip(Buffer.from(await single.arrayBuffer())).length,1);
 await assert.rejects(zipStore([{name:'../outside.png',blob:new Blob([one])}]),/ZIP_INVALID_NAME/);
});

test('authenticated gallery deletion passes browser CORS preflight and keeps other pairs',async()=>{
 const owner='bd-research-owner',origin='https://bd-chess.github.io',id='a'.repeat(40),otherId='b'.repeat(40);
 const store=new Store();
 for(const pair_id of [id,otherId])await store.setJSON('pairs/'+owner+'/'+pair_id,{pair_id,owner,title:pair_id===id?'Delete fixture':'Keep fixture',created_at:'2026-10-14T10:00:00.000Z'});
 const s=createService({store,env});
 const url=path=>'https://www.mdlxdcc.org/api/df'+path;
 const preflight=await s.handle(new Request(url('/pairs/'+id),{method:'OPTIONS',headers:{origin,'access-control-request-method':'DELETE','access-control-request-headers':'authorization'}}));
 assert.equal(preflight.status,200);
 assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
 assert.ok(preflight.headers.get('access-control-allow-methods')?.split(',').includes('DELETE'));
 const foreign=await s.handle(new Request(url('/pairs/'+id),{method:'OPTIONS',headers:{origin:'https://untrusted.example','access-control-request-method':'DELETE'}}));
 assert.equal(foreign.status,403);assert.equal(foreign.headers.get('access-control-allow-origin'),null);
 const denied=await s.handle(new Request(url('/pairs/'+id),{method:'DELETE',headers:{origin}}));assert.equal(denied.status,401);
 const token=signToken({owner,scope:'session'},secret);
 const api=(path,method='GET')=>s.handle(new Request(url(path),{method,headers:{origin,authorization:'Bearer '+token}}));
 const deleted=await api('/pairs/'+id,'DELETE');assert.equal(deleted.status,200);assert.deepEqual(await deleted.json(),{deleted:true});
 const repeated=await api('/pairs/'+id,'DELETE');assert.equal(repeated.status,200);
 const list=await api('/library');assert.equal(list.status,200);
 const library=await list.json();assert.deepEqual(library.pairs.map(p=>p.pair_id),[otherId]);
 assert.ok(await store.get('pairs/'+owner+'/'+id),'deletion is a library tombstone, not proof of byte erasure');
 assert.ok(await store.get('deleted-pairs/'+owner+'/'+id),'deletion marker persists for cloud Sync');
});

test('gallery image title persists in private cloud without changing the original identity',async()=>{
 const owner='bd-research-owner',store=new Store(),s=createService({store,env});
 const sha=hash(Buffer.from('unchanged source bytes')),id='f'.repeat(40),origin='https://bd-chess.github.io';
 await store.setJSON('pairs/'+owner+'/'+id,{pair_id:id,title:'Original.jpg',owner,original:{sha256:sha},created_at:'2026-10-14T18:00:00.000Z'});
 const target='/titles/'+sha,base='https://www.mdlxdcc.org/api/df';
 const opts={origin,'content-type':'application/json'};
 const anon=await s.handle(new Request(base+target,{method:'PUT',headers:opts,body:JSON.stringify({title:'Nova slika'})}));
 assert.equal(anon.status,401,'unauthenticated rename is forbidden');
 const token=signToken({owner,scope:'session'},secret);
 const call=(path,method='GET',body)=>s.handle(new Request(base+path,{method,headers:{...opts,authorization:'Bearer '+token},...(body!==undefined?{body:JSON.stringify(body)}:{})}));
 for(const invalid of ['', ' '.repeat(8), 'x'.repeat(121),'New\nline','ABC\u202Etxt']){
  const rejected=await call(target,'PUT',{title:invalid});
  assert.equal(rejected.status,400,'invalid or control-char title is rejected');
  assert.equal((await rejected.json()).error,'TITLE_INVALID');
 }
 const a=await call(target,'PUT',{title:'  Poletno morje  '});assert.equal(a.status,200);
 assert.equal((await a.json()).title,'Poletno morje');
 const b=await call(target,'PUT',{title:'Jutro nad reko.jpg'});assert.equal(b.status,200);
 const library=await(await call('/library')).json();
 assert.equal(library.titles[sha],'Jutro nad reko.jpg');
 assert.equal(library.pairs.length,1);
 assert.equal(library.pairs[0].title,'Original.jpg','immutable original upload title survives rename');
 assert.equal(library.pairs[0].original.sha256,sha,'source identity is preserved');
 assert.ok(await store.get('titles/'+owner+'/'+sha),'new title is durable');
 assert.equal((await s.handle(new Request(base+'/library'))).status,401);
});


test('read-only provider access probe requires session and never performs billable requests',async()=>{
 const store=new Store(),origin='https://bd-chess.github.io',url='https://www.mdlxdcc.org/api/df/model-probe',called=[];
 const fetcher=async(url,options)=>{
  called.push({url,method:options.method});
  if(url.includes('/image-generation-models/'))return Response.json({id:'grok-imagine-image-2.0'});
  return Response.json({id:'gpt-image-2.5-flare'});
 };
 const api=createService({store,env,fetcher});
 const unauthorized=await api.handle(new Request(url,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({models:['openai-flare']})}));
 assert.equal(unauthorized.status,401);assert.equal(called.length,0);
 const token=signToken({owner:'bd-research-owner',scope:'session'},secret);
 const submit=models=>api.handle(new Request(url,{method:'POST',headers:{origin,'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify({models})}));
 const invalid=await submit(['unknown-model']);assert.equal(invalid.status,400);
 assert.equal((await invalid.json()).error,'INVALID_PROBE_MODELS');assert.equal(called.length,0);
 const allowed=await submit(['openai-flare','grok-imagine']);
 assert.equal(allowed.status,200);const data=await allowed.json();
 assert.deepEqual(data.models.map(x=>x.status),['MODEL_ACCESSIBLE','MODEL_ACCESSIBLE']);
 assert.equal(data.billable_requests,0);
 assert.equal(called.length,2);assert.ok(called.every(x=>x.method==='GET'));
 assert.equal(JSON.stringify(data).includes(fakeKey),false);
 assert.equal(allowed.headers.get('access-control-allow-origin'),origin);
});


test('Gemini 2.1 Interactions response parses the most recent model_output image, not tool or thought text',()=>{
 const blob=png.toString('base64');
 const response={steps:[{type:'model_input',content:[{type:'image',data:'THIS_MUST_NOT_BE_IMAGE'}]},{type:'model_output',content:[{type:'text',text:'working'},{type:'image',mime_type:'image/jpeg',data:blob}]},{type:'model_output',content:[{type:'text',text:'done'},{type:'image',mime_type:'image/png',data:blob}]}]};
 assert.deepEqual(findImage(response),{base64:blob,mime:'image/png'});
 assert.equal(findImage({steps:[{type:'model_output',content:[{type:'text',text:'No image'}]}]}),null);
 assert.deepEqual(findImage({output_image:{data:blob,mime_type:'image/jpeg'}}),{base64:blob,mime:'image/jpeg'});
});
test('Gemini 2.1 adapter uses documented Interactions REST and reads the image result without paid network calls',async()=>{
 for(const operation of ['generate','expand']){
  const job={...jobFor('gemini-nano'),operation,target:'portrait',quality:'4k'};
  const source=operation==='expand'?png:null;
  const request=providerRequest(job,source,env),body=JSON.parse(request.body);
  assert.equal(request.url,'https://generativelanguage.googleapis.com/v1beta/interactions');
  assert.equal(body.model,'gemini-nano-banana-2.1');
  assert.deepEqual(body.response_format,{type:'image',mime_type:'image/png',aspect_ratio:'9:16',image_size:'4K'});
  if(source){assert.equal(body.input[0].type,'text');assert.equal(body.input[1].type,'image');assert.equal(body.input[1].mime_type,'image/png');}
  else assert.equal(typeof body.input,'string');
  const networkCalls=[];
  const fetcher=async(url,opts)=>{networkCalls.push({url,method:opts.method});return Response.json({steps:[{type:'model_output',content:[{type:'text',text:'done'},{type:'image',data:png.toString('base64'),mime_type:'image/png'}]}]});};
  const result=await callProvider(job,source,env,{fetcher});
  assert.deepEqual(result.bytes,png);
  assert.equal(result.provider,'gemini');
  assert.deepEqual(networkCalls,[{url:'https://generativelanguage.googleapis.com/v1beta/interactions',method:'POST'}]);
 }
});
test('all eleven provider adapters retain exact model IDs and approved host routes one at a time',()=>{
 const pairs=[
  ['openai-sunburst','openai','gpt-image-2.5-sunburst','/v1/images/generations'],
  ['openai-flare','openai','gpt-image-2.5-flare','/v1/images/generations'],
  ['gemini-nano','gemini','gemini-nano-banana-2.1','/v1beta/interactions'],
  ['grok-imagine','xai','grok-imagine-image-2.0','/v1/images/generations'],
  ['qwen-image-pro','qwen','qwen-image-3.0-pro','/api/v1/services/aigc/multimodal-generation/generation'],
  ['qwen-image','qwen','qwen-image-3.0','/api/v1/services/aigc/multimodal-generation/generation'],
  ['wan-image-pro','qwen','wan2.7-image-pro','/api/v1/services/aigc/multimodal-generation/generation'],
  ['qwen-zimage','qwen','z-image-turbo','/api/v1/services/aigc/multimodal-generation/generation'],
  ['minimax-image','minimax','image-01','/v1/image_generation'],
  ['glm-image','zai','glm-image','/api/paas/v4/images/generations'],
  ['mistral-image','mistral','mistral-medium-latest','/v1/agents']
 ];
 for(const [key,provider,modelId,path] of pairs){
  const req=providerRequest(jobFor(key),null,env);
  assert.equal(req.provider,provider,key);
  assert.equal(req.model.model,modelId,key);
  assert.ok(new URL(req.url).pathname.endsWith(path),key+' '+req.url);
 }
});
function jobFor(model){return {model,prompt:'One safe illustrative scene',target:'landscape',quality:'hd',mode:'smart',operation:'generate',position:'center',seed:42};}


test('Z-Image Turbo uses current synchronous Alibaba multimodal API with documented L/P image sizes',()=>{
 for(const [target,quality,size] of [['landscape','hd','1536*864'],['portrait','hd','864*1536'],['landscape','4k','2048*1152'],['portrait','4k','1152*2048']]){
  const request=providerRequest({...jobFor('qwen-zimage'),target,quality},null,env);
  assert.equal(new URL(request.url).pathname,'/api/v1/services/aigc/multimodal-generation/generation');
  assert.equal(request.headers['X-DashScope-Async'],undefined);
  const data=JSON.parse(request.body);
  assert.equal(data.model,'z-image-turbo');
  assert.deepEqual(data.input,{messages:[{role:'user',content:[{text:'One safe illustrative scene'}]}]});
  assert.equal(data.parameters.size,size);
  assert.equal(data.parameters.prompt_extend,false);
  assert.equal(data.parameters.seed,42);
 }
});
test('Z-Image Turbo provider image URL from synchronous output is downloaded only from vetted HTTPS host',async()=>{
 const imageURL='https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/image-fixture.png?Expires=123456';
 const calls=[];
 const fetcher=async(url,opts)=>{
  calls.push({url,method:opts.method||'GET'});
  if(url.includes('/api/v1/services/aigc/multimodal-generation/generation')){
   return Response.json({output:{choices:[{finish_reason:'stop',message:{role:'assistant',content:[{image:imageURL},{text:'Generated'}]}}]},request_id:'mock-request-id'});
  }
  if(url===imageURL)return new Response(png,{status:200,headers:{'content-type':'image/png','content-length':String(png.length)}});
  throw Error('UNEXPECTED_REQUEST');
 };
 const result=await callProvider(jobFor('qwen-zimage'),null,env,{fetcher});
 assert.equal(result.model,'z-image-turbo');
 assert.deepEqual(result.bytes,png);
 assert.deepEqual(calls,[{url:'https://ws-w0wh18jpdbeyf7d7.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',method:'POST'},{url:imageURL,method:'GET'}]);
});
