import {fixtureAccountUsage} from './fixtures/account-usage.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createService} from '../functions/lib/dualframe/service.mjs';
import {createAccountIdentity,accountOwner} from '../functions/lib/dualframe/account-identity.mjs';
import {passwordVerifier,signToken,verifyToken} from '../functions/lib/dualframe/auth.mjs';
import {hash} from '../functions/lib/dualframe/images.mjs';
const sharp=createRequire(new URL('../functions/package.json',import.meta.url))('sharp');
const origin='https://www.mdlxdcc.org',issuer=origin+'/.netlify/identity',secret='tenant-fixture-private-signing-key-not-production',password='synthetic-legacy-password',verifier=passwordVerifier(password),clock=()=>Date.UTC(2026,9,15,13);
const pixels=await Promise.all(['#b12520','#2055b1','#278634'].map(background=>sharp({create:{width:32,height:24,channels:4,background}}).png().toBuffer()));
const owners={alpha:accountOwner(issuer,'synthetic-alpha'),beta:accountOwner(issuer,'synthetic-beta')};
class Store{
 map=new Map();
 async set(key,value,options={}){if(options.onlyIfNew&&this.map.has(key))return {modified:false};this.map.set(key,Buffer.from(value));return {modified:true};}
 async setJSON(key,value,options={}){if(options.onlyIfNew&&this.map.has(key))return {modified:false};this.map.set(key,structuredClone(value));return {modified:true};}
 async get(key,{type}={}){const value=this.map.get(key);if(value===undefined)return null;if(type==='arrayBuffer'){const bytes=Buffer.from(value);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);}return structuredClone(value);}
 async delete(key){this.map.delete(key);}
 async list({prefix,cursor}){const keys=[...this.map.keys()].filter(key=>key.startsWith(prefix)).sort(),start=Number(cursor||0),end=Math.min(start+3,keys.length);return {blobs:keys.slice(start,end).map(key=>({key})),...(end<keys.length?{cursor:String(end)}:{})};}
}
const marker=asset=>({__df_remote_asset:1,asset_id:asset.asset_id,sha256:asset.sha256,size:asset.byte_size,type:asset.mime});
function recordBody(pair,overrides={}){const record={pair_id:'local_'+pair.original.asset_id,upload_id:pair.pair_id,original:{sha256:pair.original.sha256,blob:marker(pair.original),normalized:marker(pair.normalized)},...overrides};return {record_id:hash(Buffer.from(JSON.stringify(record))),source_sha256:record.original.sha256,asset_ids:[pair.original.asset_id,pair.normalized.asset_id],record};}
function quotaPolicy(){
 const reservations=new Map(),used=new Map(),limit=1;
 return {used,reservations,async inspect({owner,principal,proposal}){assert.equal(owner,principal.owner);return {allowed:true,policy_version:'synthetic-operator-grant-v1',model:proposal.model,tier:proposal.tier,maximum_api_calls:3,cost:null,paid_entitlement_verified:true};},async reserve({owner,plan,idempotency_key}){assert.equal(owner,plan.owner);const key=owner+':'+idempotency_key;if(reservations.has(key))return reservations.get(key);if((used.get(owner)||0)+plan.maximum_api_calls>limit)throw Object.assign(Error('QUOTA_EXHAUSTED'),{status:429});used.set(owner,(used.get(owner)||0)+plan.maximum_api_calls);const value={verified:true,whole_plan_reserved:true,byte_quota_reserved:true,reservation_id:'reservation_'+hash(Buffer.from(key)),plan_fingerprint:plan.fingerprint,policy_version:plan.policy_version,maximum_api_calls:plan.maximum_api_calls,call_ids:plan.calls.filter(call=>call.model_calls).map(call=>call.call_id)};reservations.set(key,value);return value;},async authorizeCall(){throw Error('TENANT_TEST_MUST_NOT_EXECUTE_PROVIDER');}};
}
async function harness({policy=null,binding=null,existingStore=null}={}){
 const store=existingStore||new Store(),scheduled=[];let providerCalls=0,networkCalls=0;
 const env=key=>({DF_SESSION_SECRET:secret,DF_PASSWORD_VERIFIER:verifier,DF_OPENAI_API_KEY:'synthetic-provider-key',DF_ACCOUNT_IDENTITY_ENABLED:'true',DF_ACCOUNT_IDENTITY_ISSUER:issuer,DF_ACCOUNT_ALLOWED_SUBJECTS_JSON:'["synthetic-alpha","synthetic-beta"]',DF_BD_ACCOUNT_BINDING_JSON:binding?JSON.stringify(binding):null}[key]??null);
 // Mock only the trusted Identity SDK boundary. The actual identity adapter,
 // tenant derivation, signed session exchange and all service routes execute.
 const identityOptions={env,now:clock,getIdentityConfig:()=>({url:issuer}),getSettings:async()=>({autoconfirm:false})};
 const accountIdentity=async request=>{
  const login=request.headers.get('cookie')?.match(/fixture-login=(alpha|beta)(?:;|$)/)?.[1];
  const user=login?{id:'synthetic-'+login,email:login+'@fixture.invalid',confirmedAt:'2026-10-14T12:00:00Z',userMetadata:{owner:'bd-research-owner',admin:true,paid_entitlement:999},appMetadata:{roles:['admin']}}:null;
  return createAccountIdentity({...identityOptions,getUser:async()=>user})(request);
 };
 accountIdentity.status=createAccountIdentity({...identityOptions,getUser:async()=>null}).status;
 const service=createService({accountUsage:fixtureAccountUsage(Object.values(owners)),store,env,now:clock,accountIdentity,enhancementPolicy:policy,dispatch:async payload=>scheduled.push(payload),runProvider:async()=>{providerCalls++;throw Error('NO_PROVIDER_IN_TENANT_TEST');},fetcher:async()=>{networkCalls++;throw Error('NO_NETWORK_IN_TENANT_TEST');}});
 async function api(token,path,method='GET',body,raw,headers={}){return service.handle(new Request(origin+'/api/df'+path,{method,headers:{origin,...(token?{authorization:'Bearer '+token}:{}),...headers},...(raw?{body:raw}:body!==undefined?{body:JSON.stringify(body)}:{})}));}
 async function login(name,body={}){const response=await api(null,'/auth/account','POST',body,undefined,{cookie:'fixture-login='+name});assert.equal(response.status,200,JSON.stringify(await response.clone().json()));return response.json();}
 const [alpha,beta]=await Promise.all([login('alpha',{owner:'bd-research-owner',admin:true}),login('beta',{owner:owners.alpha,admin:true})]);
 async function upload(token,data,kind='original',extra={}){
  const response=await api(token,'/uploads/init','POST',{kind,sha256:hash(data),size:data.length,...extra});assert.equal(response.status,200,JSON.stringify(await response.clone().json()));const ticket=await response.json();
  for(let i=0;i<ticket.chunks;i++)assert.equal((await api(token,`/uploads/${ticket.upload_id}/${i}`,'PUT',undefined,data.subarray(i*ticket.chunk_size,(i+1)*ticket.chunk_size))).status,200);
  const completed=await api(token,`/uploads/${ticket.upload_id}/finish`,'POST',{});assert.equal(completed.status,200,JSON.stringify(await completed.clone().json()));return completed.json();
 }
 async function pair(account,index){const data=pixels[index],original=await upload(account.token,data,'original',{owner:'forged-owner'}),normalized=await upload(account.token,data,'normalized'),response=await api(account.token,'/pairs','POST',{owner:'forged-owner',original_asset_id:original.asset_id,normalized_asset_id:normalized.asset_id,original_sha256:original.sha256,title:'Synthetic '+index});assert.equal(response.status,200);return {...await response.json(),original,normalized};}
 async function receipt(account,pair,suffix='fixture',operation='expand'){
  const job_id=hash(Buffer.from(account.owner+suffix)),asset_id='output_'+job_id.slice(0,30),family_id='family_'+job_id.slice(0,30),data=pixels[2],output={asset_id,owner:account.owner,sha256:hash(data),byte_size:data.length,mime:'image/png',width:32,height:24,kind:operation==='enhance'?'natural-master':'derived',role:operation==='enhance'?'natural-master':'landscape-output',source_sha256:pair.original.sha256,pair_id:pair.pair_id,family_id};
  await store.set(`assets/${account.owner}/${asset_id}`,data);await store.setJSON(`asset-meta/${account.owner}/${asset_id}`,output);
  const job={job_id,owner:account.owner,pair_id:pair.pair_id,input_sha256:pair.original.sha256,operation,target:'landscape',quality:'hd',mode:'smart',family_id,recipe:{kind:'natural'},created_at:'2026-10-15T00:00:00Z'};await store.setJSON(`jobs/${account.owner}/${job_id}`,job);await store.setJSON(`job-events/${account.owner}/${job_id}/ready`,{status:'READY',output});await store.setJSON(`job-events/${account.owner}/${job_id}/accepted`,{at:clock()});return {...job,output};
 }
 async function manifest(token){const records={assets:[],pairs:[],jobs:[],titles:[],sync_records:[],tombstones:[]};let cursor=null;do{const response=await api(token,'/sync/manifest?limit=2'+(cursor?'&cursor='+encodeURIComponent(cursor):''));assert.equal(response.status,200);const page=await response.json();for(const key in records)records[key].push(...page.records[key]);cursor=page.next_cursor;}while(cursor);return records;}
 const planBody=(pair,id='one')=>({pair_id:pair.pair_id,input_sha256:pair.original.sha256,recipe:{kind:'natural'},model:'openai-sunburst',service_tier:'premium',quality:'hd',enhance_only:true,idempotency_key:hash(Buffer.from(id))});
 return {store,service,api,login,alpha,beta,upload,pair,receipt,manifest,scheduled,policy,planBody,get providerCalls(){return providerCalls;},get networkCalls(){return networkCalls;}};
}
async function denied(response,codes){assert.ok(response.status>=400&&response.status<500,'must deny at the tenant boundary: '+response.status);const result=await response.json();if(codes)assert.ok(codes.includes(result.error),JSON.stringify(result));return result;}

test('verified same-account sessions share stable tenant; forged metadata cannot claim BD or another tenant',async()=>{
 const h=await harness(),again=await h.login('alpha',{owner:owners.beta,subject:'synthetic-beta',email:'beta@fixture.invalid',role:'admin',paid_entitlement:999});assert.equal(h.alpha.owner,owners.alpha);assert.equal(h.beta.owner,owners.beta);assert.notEqual(h.alpha.owner,h.beta.owner);assert.equal(again.owner,h.alpha.owner);assert.notEqual(again.owner,'bd-research-owner');assert.equal(again.admin,false);assert.equal(again.paid_entitlement,0);
 const p=await h.pair(h.alpha,0),session=await(await h.api(again.token,'/session')).json();assert.equal(session.owner,h.alpha.owner);assert.equal(session.admin,false);assert.equal(session.paid_entitlement,0);assert.ok((await h.manifest(again.token)).pairs.some(pair=>pair.pair_id===p.pair_id));assert.equal((await h.manifest(h.beta.token)).pairs.length,0);assert.equal(h.providerCalls,0);assert.equal(h.networkCalls,0);
});
test('private asset bytes and library/export manifests are scoped to authenticated owner on every route',async()=>{
 const h=await harness(),a=await h.pair(h.alpha,0),b=await h.pair(h.beta,1);assert.notEqual(a.pair_id,b.pair_id);
 const own=await h.api(h.alpha.token,'/assets/'+a.original.asset_id);assert.equal(own.status,200);assert.equal(hash(Buffer.from(await own.arrayBuffer())),a.original.sha256);assert.equal(own.headers.get('cache-control'),'no-store');
 await denied(await h.api(h.beta.token,'/assets/'+a.original.asset_id),['ASSET_UNKNOWN']);await denied(await h.api(null,'/assets/'+a.original.asset_id),['UNAUTHORIZED']);await denied(await h.api(h.alpha.token,'/assets/'+b.normalized.asset_id),['ASSET_UNKNOWN']);
 for(const [account,pair,other] of [[h.alpha,a,b],[h.beta,b,a]]){const records=await h.manifest(account.token);assert.equal(records.pairs.length,1);assert.equal(records.pairs[0].pair_id,pair.pair_id);assert.equal(records.assets.some(asset=>asset.asset_id===other.original.asset_id),false);const library=await(await h.api(account.token,'/library')).json();assert.equal(library.pairs.some(row=>row.pair_id===other.pair_id),false);}
 assert.equal(h.providerCalls,0);assert.equal(h.networkCalls,0);
});
test('owner-scoped immutable Sync cursors cannot be replayed by another authenticated tenant',async()=>{
 const h=await harness(),a=await h.pair(h.alpha,0);await h.pair(h.beta,1);await h.receipt(h.alpha,a);
 const first=await(await h.api(h.alpha.token,'/sync/manifest?limit=1')).json();assert.ok(first.next_cursor);const foreign=await h.api(h.beta.token,'/sync/manifest?limit=1&cursor='+encodeURIComponent(first.next_cursor));assert.equal(foreign.status,410);assert.equal((await foreign.json()).error,'MANIFEST_EXPIRED');
 const next=await h.api(h.alpha.token,'/sync/manifest?limit=100&cursor='+encodeURIComponent(first.next_cursor));assert.equal(next.status,200);assert.equal((await next.json()).frontier,first.frontier);assert.equal(h.networkCalls,0);
});
test('foreign upload tickets, chunk writes and completion are denied without altering the rightful upload',async()=>{
 const h=await harness(),response=await h.api(h.alpha.token,'/uploads/init','POST',{kind:'original',sha256:hash(pixels[0]),size:pixels[0].length,owner:h.beta.owner}),ticket=await response.json();assert.equal(response.status,200);
 for(const [path,method,body,raw] of [[`/uploads/${ticket.upload_id}`,'GET'],[`/uploads/${ticket.upload_id}/0`,'PUT',undefined,pixels[0]],[`/uploads/${ticket.upload_id}/finish`,'POST',{}]])await denied(await h.api(h.beta.token,path,method,body,raw),['UPLOAD_UNKNOWN']);
 assert.deepEqual((await(await h.api(h.alpha.token,'/uploads/'+ticket.upload_id)).json()).received,[]);assert.equal(await h.store.get(`uploads/${h.beta.owner}/${ticket.upload_id}`),null);assert.equal((await h.api(h.alpha.token,`/uploads/${ticket.upload_id}/0`,'PUT',undefined,pixels[0])).status,200);const completed=await(await h.api(h.alpha.token,`/uploads/${ticket.upload_id}/finish`,'POST',{})).json();assert.equal(completed.owner,h.alpha.owner);assert.equal(completed.sha256,hash(pixels[0]));assert.equal(h.providerCalls,0);
});
test('foreign source/parent/master asset references and exported Sync records cannot cross tenant ownership',async()=>{
 const h=await harness(),a=await h.pair(h.alpha,0),b=await h.pair(h.beta,1),master=await h.receipt(h.alpha,a,'master','enhance');
 await denied(await h.api(h.beta.token,'/pairs','POST',{owner:h.alpha.owner,original_asset_id:a.original.asset_id,normalized_asset_id:a.normalized.asset_id,original_sha256:a.original.sha256}),['ASSET_UNKNOWN']);
 const base={kind:'derived',sha256:hash(pixels[2]),size:pixels[2].length};await denied(await h.api(h.beta.token,'/uploads/init','POST',{...base,pair_id:a.pair_id,source_sha256:a.original.sha256}),['LINEAGE_SOURCE_MISMATCH']);
 await denied(await h.api(h.beta.token,'/uploads/init','POST',{...base,pair_id:b.pair_id,source_sha256:b.original.sha256,parent_asset_ids:[a.normalized.asset_id]}),['LINEAGE_PARENT_UNKNOWN']);await denied(await h.api(h.beta.token,'/uploads/init','POST',{...base,pair_id:b.pair_id,source_sha256:b.original.sha256,parent_asset_ids:[master.output.asset_id]}),['LINEAGE_PARENT_UNKNOWN']);
 const own=recordBody(a);assert.equal((await h.api(h.alpha.token,'/sync/records','POST',own)).status,200);await denied(await h.api(h.beta.token,'/sync/records','POST',{...own,owner:h.alpha.owner}),['ASSET_UNKNOWN']);assert.equal((await h.manifest(h.beta.token)).sync_records.length,0);assert.equal((await h.manifest(h.alpha.token)).sync_records.length,1);assert.equal(h.providerCalls,0);
});
test('foreign job read/accept/reject/resume and plan/master routes fail before worker or provider dispatch',async()=>{
 const h=await harness({policy:quotaPolicy()}),a=await h.pair(h.alpha,0),b=await h.pair(h.beta,1),master=await h.receipt(h.alpha,a,'accepted-master','enhance');
 for(const [suffix,method] of [['','GET'],['/accept','POST'],['/reject','POST'],['/cancel','POST'],['/resume','POST']])await denied(await h.api(h.beta.token,'/jobs/'+master.job_id+suffix,method,method==='POST'?{}:undefined),['JOB_UNKNOWN']);
 const planA=await(await h.api(h.alpha.token,'/plans','POST',h.planBody(a,'a-plan'))).json(),planB=await(await h.api(h.beta.token,'/plans','POST',h.planBody(b,'b-plan'))).json();assert.equal(planA.available,true);assert.equal(planB.available,true);
 await denied(await h.api(h.beta.token,'/plans/'+planA.plan_id),['PLAN_UNKNOWN']);await denied(await h.api(h.beta.token,'/plans','POST',{...h.planBody(a,'foreign-plan'),owner:h.alpha.owner}),['PAIR_UNKNOWN']);await denied(await h.api(h.beta.token,'/enhance','POST',{plan_id:planA.plan_id,fingerprint:planA.fingerprint,consent_fingerprint:planA.fingerprint,idempotency_key:'d'.repeat(64)}),['PLAN_UNKNOWN']);
 await denied(await h.api(h.beta.token,`/plans/${planB.plan_id}/frames`,'POST',{master_job_id:master.job_id,master_asset_id:master.output.asset_id,master_sha256:master.output.sha256}),['JOB_UNKNOWN']);assert.equal(h.scheduled.length,0);assert.equal(h.providerCalls,0);assert.equal(h.networkCalls,0);
 const wrongWorker=signToken({owner:h.beta.owner,scope:'worker',job_id:master.job_id},secret,1200,clock());await assert.rejects(h.service.work({job_id:master.job_id,token:wrongWorker}),/JOB_UNKNOWN/);assert.equal((await(await h.api(h.alpha.token,'/jobs/'+master.job_id)).json()).status,'ACCEPTED');
});
test('shared-password session grants neither admin nor tenant ownership, and forged preferences grant no public paid entitlement',async()=>{
 const h=await harness(),a=await h.pair(h.alpha,0),response=await h.api(null,'/auth','POST',{password,owner:h.alpha.owner,admin:true,paid_entitlement:999}),legacy=await response.json();assert.equal(response.status,200);assert.equal(legacy.owner,'bd-research-owner');const session=await(await h.api(legacy.token,'/session')).json();assert.equal(session.admin,false);assert.equal(session.paid_entitlement,0);const claim=verifyToken(legacy.token,secret,'session',clock());assert.equal(claim.admin,undefined);assert.equal(claim.auth_method,'legacy-password');await denied(await h.api(legacy.token,'/assets/'+a.original.asset_id),['ASSET_UNKNOWN']);
 for(const path of ['/generate','/expand'])await denied(await h.api(h.alpha.token,path,'POST',{owner:'bd-research-owner',admin:true,service_tier:'premium',paid_entitlement:999,model:'openai-sunburst'}),['PAID_ENTITLEMENT_REQUIRED']);const cap=await(await h.api(null,'/capabilities')).json();assert.equal(cap.account_identity.public_enabled,false);assert.equal(h.providerCalls,0);assert.equal(h.networkCalls,0);
});
test('service supplies tenant-bound quota scope: one account exhausting its granted fixture allowance cannot consume another account allowance',async()=>{
 const policy=quotaPolicy(),h=await harness({policy}),a=await h.pair(h.alpha,0),b=await h.pair(h.beta,1);
 async function plan(account,pair,id){const response=await h.api(account.token,'/plans','POST',h.planBody(pair,id));assert.equal(response.status,200);return response.json();}
 const pa=await plan(h.alpha,a,'quota-a1'),pa2=await plan(h.alpha,a,'quota-a2'),pb=await plan(h.beta,b,'quota-b1');
 const submit=(account,p)=>h.api(account.token,'/enhance','POST',{owner:h.alpha.owner,plan_id:p.plan_id,fingerprint:p.fingerprint,consent_fingerprint:p.fingerprint,idempotency_key:hash(Buffer.from(p.plan_id))});assert.equal((await submit(h.alpha,pa)).status,202);assert.equal((await submit(h.alpha,pa)).status,202);const exhausted=await submit(h.alpha,pa2);assert.equal(exhausted.status,429);assert.equal((await exhausted.json()).error,'QUOTA_EXHAUSTED');assert.equal((await submit(h.beta,pb)).status,202);assert.equal(policy.used.get(h.alpha.owner),1);assert.equal(policy.used.get(h.beta.owner),1);assert.equal(h.scheduled.length,2);assert.equal(h.providerCalls,0);assert.equal(h.networkCalls,0);
});
test('explicit verified BD binding reuses the unchanged legacy library and bytes; first account registration cannot claim it',async()=>{
 const before=await harness(),legacy=await(await before.api(null,'/auth','POST',{password})).json(),p=await before.pair(legacy,0),master=await before.receipt(legacy,p,'legacy-master','enhance');assert.equal((await before.api(legacy.token,'/sync/records','POST',recordBody(p))).status,200);
 const legacyManifest=await before.manifest(legacy.token),legacyBytes=Buffer.from(await before.store.get(`assets/bd-research-owner/${p.original.asset_id}`,{type:'arrayBuffer'})),imageKeys=[...before.store.map.keys()].filter(key=>/^(?:assets|asset-meta|pairs)\//.test(key)).sort();assert.equal(legacyManifest.assets.length,3);assert.equal(legacyManifest.pairs.length,1);assert.equal(legacyManifest.jobs.length,1);assert.equal(legacyManifest.sync_records.length,1);assert.equal(hash(legacyBytes),p.original.sha256);
 assert.notEqual(before.alpha.owner,'bd-research-owner');await denied(await before.api(before.alpha.token,'/assets/'+p.original.asset_id),['ASSET_UNKNOWN']);assert.equal((await before.manifest(before.alpha.token)).assets.length,0);
 const binding={issuer,subject:'synthetic-alpha',verified:true,verified_at:'2026-10-15T11:00:00Z',verification_receipt:'SYNTHETIC_EXPLICIT_BD_BINDING_RECEIPT_TEST_ONLY'},after=await harness({existingStore:before.store,binding});assert.equal(after.alpha.owner,'bd-research-owner');assert.equal(after.alpha.auth_method,'verified-account');assert.equal(after.alpha.admin,false);assert.equal(after.alpha.paid_entitlement,0);assert.equal(after.beta.owner,owners.beta);
 const recovered=await after.manifest(after.alpha.token);assert.deepEqual(recovered.assets.map(asset=>[asset.asset_id,asset.sha256]).sort(),legacyManifest.assets.map(asset=>[asset.asset_id,asset.sha256]).sort());assert.equal(recovered.pairs.length,legacyManifest.pairs.length);assert.equal(recovered.jobs.length,legacyManifest.jobs.length);assert.equal(recovered.sync_records.length,legacyManifest.sync_records.length);assert.equal(recovered.jobs[0].output.asset_id,master.output.asset_id);
 const response=await after.api(after.alpha.token,'/assets/'+p.original.asset_id);assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),legacyBytes);assert.deepEqual([...after.store.map.keys()].filter(key=>/^(?:assets|asset-meta|pairs)\//.test(key)).sort(),imageKeys,'binding changes no image keys, metadata, bytes or owner records');await denied(await after.api(after.beta.token,'/assets/'+p.original.asset_id),['ASSET_UNKNOWN']);assert.equal(after.providerCalls,0);assert.equal(after.networkCalls,0);
});
