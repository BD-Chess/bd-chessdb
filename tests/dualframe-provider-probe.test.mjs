import test from 'node:test';
import assert from 'node:assert/strict';
import {probeModelKeys,classifyResponse} from '../functions/lib/dualframe/provider-health.mjs';

const fakeKey='TEST_PRIVATE_API_KEY_DO_NOT_ECHO';
const envir=name=>name==='DF_QWEN_API_KEY'||name==='DF_XAI_API_KEY'||name==='DF_OPENAI_API_KEY'||name==='DF_GEMINI_API_KEY'?fakeKey:null;
const date=()=>Date.parse('2026-10-14T21:00:00.000Z');

test('real read-only model GETs verify accessible models, not image generation',async()=>{
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url,method:options.method,redirect:options.redirect,auth:options.headers.authorization,body:options.body});
  if(url.endsWith('gpt-image-2.5-flare'))return Response.json({id:'gpt-image-2.5-flare'});
  if(url.includes('/image-generation-models/'))return Response.json({id:'grok-imagine-image-2.0'});
  if(url.endsWith('gpt-image-2.5-sunburst'))return Response.json({error:'not accessible'},{status:404});
  if(url.endsWith('/api/v1/models'))return Response.json({data:[{id:'wan2.7-image-pro'}]});
  throw Error('UNEXPECTED_URL');
 };
 const result=await probeModelKeys(['openai-flare','grok-imagine','openai-sunburst','wan-image-pro'],envir,{fetcher,now:date});
 assert.equal(result.schema,'bd.dualframe.provider-probes.v1');
 assert.deepEqual(result.models.map(x=>x.status),['MODEL_ACCESSIBLE','MODEL_ACCESSIBLE','MODEL_NOT_FOUND','MODEL_ACCESSIBLE']);
 assert.equal(result.billable_requests,0);
 assert.equal(result.checked_at,'2026-10-14T21:00:00.000Z');
 assert.ok(calls.every(x=>x.method==='GET'&&x.redirect==='error'&&x.body===undefined));
 assert.ok(calls.every(x=>x.auth==='Bearer '+fakeKey));
 assert.equal(JSON.stringify(result).includes(fakeKey),false);
 assert.ok(result.models.every(x=>!x.generation_tested&&!x.editing_tested));
});
test('catalog confirmation is explicitly weaker than listing this model',async()=>{
 const result=await probeModelKeys(['wan-image-pro'],envir,{fetcher:async()=>Response.json({data:[{id:'other-model'}]})});
 assert.equal(result.models[0].status,'PROVIDER_REACHABLE');
 assert.equal(result.models[0].probe,'read_only_model_catalog');
});
test('provider response classes preserve auth, entitlement, listing, throttle, error and network distinctions',()=>{
 for(const [code,status] of [[401,'AUTH_FAILED'],[403,'PERMISSION_DENIED'],[404,'MODEL_NOT_FOUND'],[429,'RATE_LIMITED'],[500,'PROVIDER_ERROR'],[200,'PROVIDER_REACHABLE']])
  assert.equal(classifyResponse(code,{direct:true,modelId:'expected',data:{id:'not-expected'}}),status);
 assert.equal(classifyResponse(404,{direct:false,modelId:'expected'}),'CATALOG_NOT_AVAILABLE');
 assert.equal(classifyResponse(200,{direct:true,modelId:'expected',data:{id:'expected'}}),'MODEL_ACCESSIBLE');
});
test('network failures never echo raw provider secrets',async()=>{
 const result=await probeModelKeys(['openai-flare'],envir,{fetcher:async()=>{throw Error(fakeKey+' request failed');}});
 assert.equal(result.models[0].status,'NETWORK_ERROR');
 assert.equal(JSON.stringify(result).includes(fakeKey),false);
});
test('missing keys, unimplemented vendor metadata checks and malformed requests make no paid or unsafe calls',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw Error('NOT_ALLOWED');};
 assert.equal((await probeModelKeys(['minimax-image','glm-image'],envir,{fetcher})).models.map(x=>x.status).join(','),'KEY_MISSING,KEY_MISSING');
 const withAllKeys=name=>name.includes('KEY')?fakeKey:null;
 assert.equal((await probeModelKeys(['minimax-image','glm-image'],withAllKeys,{fetcher})).models.map(x=>x.status).join(','),'PROBE_UNAVAILABLE,PROBE_UNAVAILABLE');
 assert.equal(calls,0);
 for(const args of [[],['unknown'],['openai-flare','openai-flare'],['openai-flare',null]])
  await assert.rejects(()=>probeModelKeys(args,envir,{fetcher}),/INVALID_PROBE_MODELS/);
 assert.equal(calls,0);
});
test('custom Qwen host is allowlisted, preventing arbitrary SSRF URLs',async()=>{
 let requests=0;const env=name=>name==='DF_QWEN_API_HOST'?'https://example.com/steal':envir(name);
 const result=await probeModelKeys(['wan-image-pro'],env,{fetcher:async()=>{requests++;throw Error('SHOULD_NOT_RUN');}});
 assert.equal(result.models[0].status,'PROBE_CONFIG_ERROR');
 assert.equal(requests,0);
});
test('Gemini model metadata is requested with header key and no generation',async()=>{
 const calls=[];
 const result=await probeModelKeys(['gemini-nano'],envir,{fetcher:async(url,options)=>{calls.push({url,method:options.method,hasKey:Boolean(options.headers['x-goog-api-key'])});return Response.json({name:'models/gemini-nano-banana-2.1'});}});
 assert.equal(result.models[0].status,'MODEL_ACCESSIBLE');
 assert.deepEqual(calls,[{url:'https://generativelanguage.googleapis.com/v1beta/models/gemini-nano-banana-2.1',method:'GET',hasKey:true}]);
});
