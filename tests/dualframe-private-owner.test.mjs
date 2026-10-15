import test from 'node:test';
import {fixtureAccountUsage} from './fixtures/account-usage.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createService} from '../functions/lib/dualframe/service.mjs';
import {signToken,passwordVerifier} from '../functions/lib/dualframe/auth.mjs';
import {hash} from '../functions/lib/dualframe/images.mjs';
import {createPrivateOwnerPolicy,routeOwnerPolicy} from '../functions/lib/dualframe/private-owner-policy.mjs';
const sharp=createRequire(new URL('../functions/package.json',import.meta.url))('sharp');
const OWNER='bd-research-owner',secret='synthetic-owner-session-key-never-production',password='synthetic-fixture-only',verifier=passwordVerifier(password);
export class OwnerFixtureStore{
 map=new Map();
 async set(key,value,{onlyIfNew=false}={}){if(onlyIfNew&&this.map.has(key))return {modified:false};this.map.set(key,Buffer.from(value));return {modified:true};}
 async setJSON(key,value,{onlyIfNew=false}={}){assert.equal(onlyIfNew,true,'private owner receipts are append-only');if(this.map.has(key))return {modified:false};this.map.set(key,structuredClone(value));return {modified:true};}
 async get(key,{type}={}){const value=this.map.get(key);if(value===undefined)return null;if(type==='arrayBuffer'){const b=Buffer.from(value);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}return structuredClone(value);}
 async list({prefix}){return {blobs:[...this.map.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))};}
 async delete(key){this.map.delete(key);}
}
async function fixture({ambiguous=false,key=true}={}){
 const store=new OwnerFixtureStore(),scheduled=[],calls=[],png=await sharp({create:{width:64,height:48,channels:4,background:'#75aa99'}}).png().toBuffer();let clock=Date.now();
 const env=name=>({DF_SESSION_SECRET:secret,DF_PASSWORD_VERIFIER:verifier,DF_OPENAI_API_KEY:key?'synthetic-provider-key':null})[name];
 const policy=createPrivateOwnerPolicy({store,env,now:()=>clock}),service=createService({accountUsage:fixtureAccountUsage(['foreign_owner']),store,env,now:()=>clock,enhancementPolicy:routeOwnerPolicy(policy,null),dispatch:async p=>scheduled.push(p),runProvider:async(job)=>{calls.push(job);if(ambiguous)throw Object.assign(Error('PROVIDER_TRANSPORT_UNCERTAIN'),{ambiguous:true});return {bytes:png,parameters:{fixture:true},actual_cost:null,request_id:'synthetic-only'};}});
 const request=(path,method='GET',body,claims={owner:OWNER,auth_method:'legacy-password'})=>service.handle(new Request('https://www.mdlxdcc.org/api/df'+path,{method,headers:claims?{authorization:'Bearer '+signToken({...claims,scope:'session'},secret,3600,clock)}:{},...(body===undefined?{}:{body:JSON.stringify(body)})}));
 const original={asset_id:'fixture_original',kind:'original',sha256:hash(png),byte_size:png.length,width:64,height:48,mime:'image/png'},normalized={...original,asset_id:'fixture_normalized',kind:'normalized'};
 for(const a of [original,normalized]){await store.setJSON('asset-meta/'+OWNER+'/'+a.asset_id,a,{onlyIfNew:true});await store.set('assets/'+OWNER+'/'+a.asset_id,png,{onlyIfNew:true});}
 await store.setJSON('pairs/'+OWNER+'/fixture_pair',{pair_id:'fixture_pair',owner:OWNER,original,normalized},{onlyIfNew:true});
 const plan=async(extra={})=>{const r=await request('/plans','POST',{pair_id:'fixture_pair',input_sha256:original.sha256,recipe:{kind:'natural'},model:'openai-sunburst',service_tier:'premium',quality:'hd',idempotency_key:hash(Buffer.from(crypto.randomUUID())),...extra});assert.equal(r.status,200,JSON.stringify(await r.clone().json()));return r.json();};
 const start=p=>request('/enhance','POST',{plan_id:p.plan_id,fingerprint:p.fingerprint,consent_fingerprint:p.fingerprint,idempotency_key:hash(Buffer.from('start'))});
 return {store,service,request,scheduled,calls,png,plan,start,advance:()=>clock+=60001,job:id=>request('/jobs/'+id).then(r=>r.json())};
}
test('password owner enhancement works without Identity/PG; password never grants admin or other-owner authority',async()=>{
 const f=await fixture();assert.equal((await f.request('/auth','POST',{password:'wrong'},null)).status,401);
 const login=await(await f.request('/auth','POST',{password},null)).json();assert.equal(login.owner,OWNER);assert.ok(login.token);
 const p=await f.plan({enhance_only:true});assert.equal(p.available,true);assert.equal(p.maximum_api_calls,1);assert.equal(p.cost,null);assert.equal(p.policy_version,'private-owner-click-v1');
 const responses=await Promise.all([f.start(p),f.start(p)]);assert.ok(responses.every(r=>r.status===202));assert.equal(f.scheduled.length,1);
 await Promise.all([f.service.work(f.scheduled[0]),f.service.work(f.scheduled[0])]);assert.equal(f.calls.length,1);const job=await f.job(p.calls[0].call_id);assert.equal(job.status,'ACCEPTED');assert.equal(job.output.role,'natural-master');
 assert.equal((await f.request('/admin/policy')).status,403);assert.equal((await f.request('/auth/account','POST',{},null)).status,503);assert.equal((await f.request('/plans/'+p.plan_id,'GET',undefined,{owner:'foreign_owner',auth_method:'legacy-password'})).status,404);
 for(const route of ['/library','/enhance','/admin/policy'])assert.equal((await f.request(route,route==='/enhance'?'POST':'GET',route==='/enhance'?{}:undefined,null)).status,401);
 assert.deepEqual(Buffer.from(await f.store.get('assets/'+OWNER+'/fixture_original',{type:'arrayBuffer'})),f.png);
});
test('model/key/owner/Free checks fail before submission; BLOCKED history never poisons a new plan',async()=>{
 const missing=await fixture({key:false}),blocked=await missing.plan();assert.equal(blocked.blocked_reason,'KEY_NOT_CONFIGURED');assert.equal(missing.calls.length,0);
 const f=await fixture(),old=await f.plan({model:'gemini-nano'});assert.equal(old.available,false);assert.equal(old.blocked_reason,'ENHANCEMENT_MODEL_UNSUPPORTED');
 const free=await f.plan({service_tier:'free',model:'cloudflare-flux-free'});assert.equal(free.available,false);assert.equal(free.paid_fallback,false);
 const retry=await f.plan({recipe:{kind:'artistic'}});assert.equal(retry.available,true);assert.notEqual(old.plan_id,retry.plan_id);assert.equal((await f.request('/plans/'+old.plan_id).then(r=>r.json())).available,false);
});
test('whole-plan admission is atomic under parallel attempts; uncertain plans retain both slots across time',async()=>{
 const f=await fixture({ambiguous:true}),plans=await Promise.all([f.plan({enhance_only:true}),f.plan({enhance_only:true}),f.plan({enhance_only:true})]);
 const results=await Promise.all(plans.map(f.start));assert.equal(results.filter(r=>r.status===202).length,2);assert.equal(results.filter(r=>r.status===429).length,1);assert.equal(f.scheduled.length,2);
 for(const payload of f.scheduled)await f.service.work(payload);assert.equal(f.calls.length,2);
 for(const p of plans.slice(0,2)){const state=await f.job(p.calls[0].call_id);assert.equal(state.status,'HELD');}
 f.advance();const next=await f.plan({enhance_only:true}),r=await f.start(next);assert.equal(r.status,429);assert.equal((await r.json()).error,'OWNER_ACTIVE_PLANS_HELD');
 for(const payload of f.scheduled)await f.service.work(payload);assert.equal(f.calls.length,2);assert.equal([...f.store.map.keys()].filter(k=>k.endsWith('/closed')).length,0);
});
test('same master produces P/L exactly once; known completion releases a slot without deleting receipts',async()=>{
 const f=await fixture(),plan=await f.plan({same_orientation_fit:'contain'});assert.equal((await f.start(plan)).status,202);await f.service.work(f.scheduled[0]);const master=await f.job(plan.calls[0].call_id);
 const result=await f.request('/plans/'+plan.plan_id+'/frames','POST',{master_job_id:master.job_id,master_asset_id:master.output.asset_id,master_sha256:master.output.sha256});assert.equal(result.status,202);
 for(const payload of f.scheduled.slice(1))await f.service.work(payload);assert.equal(f.calls.length,2);for(const call of plan.calls.slice(1)){const state=await f.job(call.call_id);assert.equal(state.output.master_sha256,master.output.sha256);}
 assert.equal([...f.store.map.keys()].filter(k=>k.endsWith('/closed')).length,1);f.advance();assert.equal((await f.start(await f.plan({enhance_only:true}))).status,202);
 assert.ok(f.store.map.has('private-owner-policy/v1/reservations/'+plan.plan_id));
});
