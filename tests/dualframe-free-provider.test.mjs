import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const sharp=createRequire(new URL('../functions/package.json',import.meta.url))('sharp');
import {createHash} from 'node:crypto';
import {FREE_MODEL,FREE_AUTHORIZATION_SCHEMA,freeRequestNeurons,freeProviderPlan,verifyFreeAuthorization,prepareFreeReference,runFreeProvider} from '../functions/lib/dualframe/free-provider.mjs';

const now=Date.parse('2026-10-15T13:00:00.000Z'),accountId='a'.repeat(32),token='fake-cloudflare-token-for-mocked-tests-only';
const env=key=>({DF_CLOUDFLARE_ACCOUNT_ID:accountId,DF_CLOUDFLARE_API_TOKEN:token})[key];
const planFor=(calls=[{call_id:'master_call_01',width:512,height:256,input_images:1}])=>freeProviderPlan({plan_id:'family_plan_01',calls});
const proofFor=(plan,callId=plan.calls[0].call_id)=>({schema:FREE_AUTHORIZATION_SCHEMA,verified:true,reservation_id:'reservation_01',policy_version:'verified-test-policy-v1',account_id:accountId,account_plan:'workers-free',no_overage_verified:true,account_usage_verified:true,uncertain_submissions_included:true,whole_plan_reserved:true,call_claimed:true,plan_fingerprint:plan.fingerprint,call_id:callId,verified_at:new Date(now).toISOString(),expires_at:new Date(now+60000).toISOString(),usage_utc_day:'2026-10-15',allowance_neurons:10000,account_usage_neurons:200,account_reserved_neurons:plan.maximum_neurons,plan_reserved_neurons:plan.maximum_neurons,plan_remaining_reserved_neurons:plan.maximum_neurons});
const jobFor=plan=>({job_id:plan.calls[0].call_id,model:FREE_MODEL,operation:'enhance',provider_prompt:'Improve lighting while preserving identity.',seed:17,free_plan:plan});
const image=async(width,height)=>sharp({create:{width,height,channels:3,background:'#4b6a78'}}).png().toBuffer();

test('Free is disabled without trusted authorization or legitimate configuration',async()=>{
 let fetches=0;const fetcher=async()=>{fetches++;throw Error('must not call');};
 await assert.rejects(runFreeProvider({},null,env,{fetcher}),/FREE_PROVIDER_NOT_CONFIGURED/);
 await assert.rejects(runFreeProvider({},null,()=>undefined,{fetcher,authorize:async()=>({})}),/FREE_PROVIDER_NOT_CONFIGURED/);
 assert.equal(fetches,0);
});

test('whole-plan estimates include every declared request, every reference and output size',()=>{
 assert.equal(freeRequestNeurons({width:512,height:512,input_images:1}),31.42);
 assert.equal(freeRequestNeurons({width:1920,height:1080,input_images:4}),334.08);
 const plan=planFor([{call_id:'master_call_01',width:512,height:512,input_images:1},{call_id:'portrait_call_02',width:1080,height:1920,input_images:2}]);
 assert.equal(plan.maximum_neurons,354.76);
 for(const size of [[2160,3840],[1920,1921],[255,1024]])assert.throws(()=>freeRequestNeurons({width:size[0],height:size[1],input_images:1}),/FREE_OUTPUT_GEOMETRY_UNSUPPORTED/);
 assert.throws(()=>planFor([{call_id:'duplicate_id',width:512,height:512,input_images:0},{call_id:'duplicate_id',width:512,height:512,input_images:0}]),/FREE_PLAN_INVALID/);
});

test('unknown, stale, paid or insufficient shared allowance fails closed',()=>{
 const plan=planFor(),base=proofFor(plan),context={accountId,plan,callId:plan.calls[0].call_id,now};
 assert.equal(verifyFreeAuthorization(base,context).maximum_call_neurons,plan.maximum_neurons);
 for(const [patch,error] of [
  [{account_plan:'workers-paid'},'FREE_NO_OVERAGE_UNVERIFIED'],[{account_usage_verified:false},'FREE_ALLOWANCE_UNKNOWN'],
  [{uncertain_submissions_included:false},'FREE_ALLOWANCE_UNKNOWN'],[{whole_plan_reserved:false},'FREE_ALLOWANCE_UNKNOWN'],
  [{call_claimed:false},'FREE_ALLOWANCE_UNKNOWN'],[{account_usage_neurons:null},'FREE_ALLOWANCE_UNKNOWN'],
  [{account_usage_neurons:9999},'FREE_ALLOWANCE_EXHAUSTED'],[{plan_reserved_neurons:0},'FREE_ALLOWANCE_EXHAUSTED'],
  [{expires_at:new Date(now-1).toISOString()},'FREE_AUTHORIZATION_EXPIRED'],[{usage_utc_day:'2026-10-14'},'FREE_AUTHORIZATION_EXPIRED'],
  [{account_id:'b'.repeat(32)},'FREE_AUTHORIZATION_INVALID'],[{plan_fingerprint:'b'.repeat(64)},'FREE_AUTHORIZATION_INVALID']
 ])assert.throws(()=>verifyFreeAuthorization({...base,...patch},context),new RegExp(error));
 const forged=structuredClone(plan);forged.calls[0].maximum_neurons=0;
 assert.throws(()=>verifyFreeAuthorization(base,{...context,plan:forged}),/FREE_PLAN_INVALID/);
});

test('deterministic reference preparation retains original bytes/hash and discloses reduced pixels',async()=>{
 const original=await image(1600,1200),hash=createHash('sha256').update(original).digest('hex');
 const result=await prepareFreeReference(original);
 assert.equal(result.receipt.source_sha256,hash);assert.equal(createHash('sha256').update(original).digest('hex'),hash);
 assert.equal(result.receipt.source_width,1600);assert.equal(result.receipt.source_height,1200);
 assert.equal(result.receipt.submitted_width,511);assert.equal(result.receipt.submitted_height,383);
 assert.equal(result.receipt.resampled,true);assert.equal(result.receipt.identity_quality_verified,false);
 assert.equal(result.receipt.submitted_sha256,createHash('sha256').update(result.bytes).digest('hex'));
 await assert.rejects(prepareFreeReference(Buffer.from('corrupt image')),/FREE_REFERENCE_INVALID/);
});

test('mock hosted edit sends binary multipart and returns decoded native raster with safe receipts',async()=>{
 const plan=planFor(),source=await image(1200,800),output=await image(512,256);let fetches=0,claims=0;
 const result=await runFreeProvider(jobFor(plan),source,env,{now:()=>now,authorize:async input=>{claims++;assert.equal(input.plan.fingerprint,plan.fingerprint);return proofFor(plan);},fetcher:async(url,options)=>{
  fetches++;assert.equal(url,`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${FREE_MODEL}`);
  assert.equal(options.headers.authorization,'Bearer '+token);assert.equal(options.headers['content-type'],undefined);
  assert.equal(options.redirect,'error');assert.ok(options.body instanceof FormData);
  assert.equal(options.body.get('width'),'512');assert.equal(options.body.get('height'),'256');assert.equal(options.body.get('seed'),'17');
  const reference=options.body.get('input_image_0');assert.ok(reference instanceof Blob);const meta=await sharp(Buffer.from(await reference.arrayBuffer())).metadata();assert.ok(meta.width<512&&meta.height<512);
  return Response.json({success:true,result:{image:output.toString('base64')}},{headers:{'cf-ray':'safe-request-01'}});
 }});
 assert.equal(fetches,1);assert.equal(claims,1);assert.ok(result.bytes.equals(output));
 assert.equal(result.output.native_4k,false);assert.equal(result.output.sha256,createHash('sha256').update(output).digest('hex'));
 assert.equal(result.actual_cost,null);assert.equal(result.parameters.steps,4);
 assert.equal(result.parameters.references[0].source_width,1200);
 const publicReceipt=JSON.stringify({...result,bytes:undefined});assert.ok(!publicReceipt.includes(token));assert.ok(!publicReceipt.includes(accountId));
});

test('claim rejection, uncertain transport and malformed provider responses never retry or expose secrets',async()=>{
 const plan=planFor(),source=await image(300,300);let fetches=0;
 const options={now:()=>now,authorize:async()=>proofFor(plan),fetcher:async()=>{fetches++;throw Error('network '+token);}};
 await assert.rejects(runFreeProvider(jobFor(plan),source,env,options),error=>error.code==='FREE_PROVIDER_TRANSPORT_UNCERTAIN'&&error.ambiguous===true&&error.automatic_paid_retry===false&&!error.message.includes(token));
 assert.equal(fetches,1);
 await assert.rejects(runFreeProvider(jobFor(plan),source,env,{...options,authorize:async()=>{throw Error(token);}}),/FREE_AUTHORIZATION_UNAVAILABLE/);assert.equal(fetches,1);
 for(const data of [{success:true,result:{image:'https://private.example/image.png'}},{success:false,errors:[{message:token}]}]){
  await assert.rejects(runFreeProvider(jobFor(plan),source,env,{...options,fetcher:async()=>{fetches++;return Response.json(data);}}),error=>!error.message.includes(token)&&/^FREE_PROVIDER_/.test(error.code));
 }
 assert.equal(fetches,3);
});

test('output hash/decoder checks reject wrong geometry and invalid raster before returning a result',async()=>{
 const plan=planFor(),source=await image(300,300),wrong=await image(256,256);
 const options={now:()=>now,authorize:async()=>proofFor(plan)};
 await assert.rejects(runFreeProvider(jobFor(plan),source,env,{...options,fetcher:async()=>Response.json({image:wrong.toString('base64')})}),/FREE_OUTPUT_DIMENSION_MISMATCH/);
 await assert.rejects(runFreeProvider(jobFor(plan),source,env,{...options,fetcher:async()=>Response.json({image:Buffer.from('not a raster').toString('base64')})}),/FREE_PROVIDER_IMAGE_INVALID/);
});

test('a trusted single-call reservation claim prevents provider replay',async()=>{
 const plan=planFor(),source=await image(300,300),output=await image(512,256);let claimed=false,fetches=0;
 const options={now:()=>now,authorize:async()=>{const proof=proofFor(plan);proof.call_claimed=!claimed;claimed=true;return proof;},fetcher:async()=>{fetches++;return Response.json({image:output.toString('base64')});}};
 await runFreeProvider(jobFor(plan),source,env,options);
 await assert.rejects(runFreeProvider(jobFor(plan),source,env,options),/FREE_ALLOWANCE_UNKNOWN/);
 assert.equal(fetches,1);
});
