import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
 createByteUsageLedger,
 GENERATED_ASSET_STORAGE_BOUND,
 GENERATED_PLAN_METADATA_BOUND
} from '../functions/lib/dualframe/account-usage-ledger.mjs';
import {createEnhancementLedger} from '../functions/lib/dualframe/enhancement-ledger.mjs';
import {OPERATOR_POLICY_SCHEMA} from '../functions/lib/dualframe/enhancement-policy.mjs';

const OWNER='account_usage_owner_01',OTHER='account_usage_owner_02';
const hash=value=>createHash('sha256').update(value).digest('hex');
const START=Date.parse('2026-10-15T23:59:00.000Z');
const error=code=>e=>e.message===code;

function policy({storage=1000,ownerStorage=storage,transfer=1000,ownerTransfer=transfer,concurrent=4,ownerConcurrent=concurrent}={}){
 const limits={calls_per_day:10,storage_bytes:ownerStorage,transfer_bytes_per_day:ownerTransfer,concurrent_jobs:2,concurrent_transfers:ownerConcurrent,spend_cap:{amount_minor:1000,currency:'USD'}};
 return {
  schema:OPERATOR_POLICY_SCHEMA,version:'usage-fixture-v1',enabled:true,kill_switch:false,
  models:[{key:'openai-sunburst',provider:'openai',tier:'premium',enabled:true,operations:['enhance','expand','derive'],resolutions:['hd','4k']}],
  per_owner:{[OWNER]:{premium:true,limits:{...limits}},[OTHER]:{premium:true,limits:{...limits}}},
  global:{...limits,storage_bytes:storage,transfer_bytes_per_day:transfer,concurrent_transfers:concurrent},
  provider_quotas:{openai:{units_per_day:10,unit:'requests',concurrent_jobs:2,spend_cap:{amount_minor:1000,currency:'USD'}}},
  retention:{original_days:0,derived_days:0,tombstone_days:0}
 };
}

// Every action gets an isolated candidate state under one mutex. Throwing an
// error discards the whole candidate, including partial multi-slot allocation.
function fixture(config=policy(),{verify=true}={}){
 let body={policy:config,reservations:{}},tail=Promise.resolve(),clock=START,revision=0;
 const transaction=async action=>{
  const previous=tail;let unlock;tail=new Promise(resolve=>{unlock=resolve;});await previous;
  try{
   const candidate=structuredClone(body),result=await action(candidate);
   if(result.write){body=candidate;revision++;}
   return structuredClone(result.value);
  }finally{unlock();}
 };
 const ledger=createByteUsageLedger({transaction,now:()=>clock,verifyUsageBaseline:verify?async input=>input.proof_id==='server-reconciled-fixture':null});
 return {ledger,transaction,snapshot:()=>structuredClone(body),revision:()=>revision,advance:ms=>{clock+=ms;},replacePolicy:p=>transaction(b=>{b.policy=p;return {write:true,value:null};})};
}
async function reconcile(ledger,owner,storage_bytes=0){
 return ledger.reconcileByteBaseline({owner,storage_bytes,proof_id:'server-reconciled-fixture'});
}
async function setup(config=policy(),options){
 const f=fixture(config,options);
 await reconcile(f.ledger,'global');await reconcile(f.ledger,OWNER);await reconcile(f.ledger,OTHER);
 return f;
}
const storage=(ledger,owner,resource_id,byte_count)=>ledger.reserveStorage({owner,resource_id,byte_count,kind:'upload'});
const begin=(ledger,owner,request_id,byte_count)=>ledger.beginTransfer({owner,request_id,byte_count});

test('explicit trusted baseline verification is required and recorded baselines cannot be overwritten',async()=>{
 const absent=fixture(policy(),{verify:false});
 await assert.rejects(reconcile(absent.ledger,'global'),error('BYTE_USAGE_BASELINE_UNVERIFIED'));
 assert.equal(absent.snapshot().byte_usage,undefined);
 const f=fixture();
 await assert.rejects(f.ledger.reconcileByteBaseline({owner:'global',storage_bytes:0,proof_id:'client-assertion',verified:true}),error('BYTE_USAGE_BASELINE_UNVERIFIED'));
 await reconcile(f.ledger,'global',30);await reconcile(f.ledger,OWNER,20);
 const revision=f.revision();
 await assert.rejects(reconcile(f.ledger,OWNER,0),error('BYTE_USAGE_BASELINE_EXISTS'));
 assert.equal(f.revision(),revision);assert.equal(f.snapshot().byte_usage.baselines[OWNER].storage_bytes,20);
});

test('missing global baseline, owner baseline, policy and owner enrollment fail closed',async()=>{
 const f=fixture();
 await assert.rejects(storage(f.ledger,OWNER,'missing-global',1),error('BYTE_USAGE_BASELINE_REQUIRED'));
 await reconcile(f.ledger,'global');
 await assert.rejects(storage(f.ledger,OWNER,'missing-owner',1),error('BYTE_USAGE_BASELINE_REQUIRED'));
 await assert.rejects(begin(f.ledger,OWNER,'missing-owner-transfer',1),error('BYTE_USAGE_BASELINE_REQUIRED'));
 await reconcile(f.ledger,OWNER);
 const missingOwner=policy();delete missingOwner.per_owner[OWNER];await f.replacePolicy(missingOwner);
 await assert.rejects(storage(f.ledger,OWNER,'unenrolled',1),error('BYTE_USAGE_OWNER_NOT_CONFIGURED'));
 await f.replacePolicy(null);
 await assert.rejects(storage(f.ledger,OWNER,'no-policy',1),error('BYTE_USAGE_POLICY_NOT_CONFIGURED'));
 await assert.rejects(begin(f.ledger,OWNER,'no-policy-transfer',1),error('BYTE_USAGE_POLICY_NOT_CONFIGURED'));
 assert.equal(f.snapshot().byte_usage.storage&&Object.keys(f.snapshot().byte_usage.storage).length,0);
});

test('concurrent owners cannot exceed a shared global storage ceiling',async()=>{
 const f=await setup(policy({storage:100,ownerStorage:100}));
 const results=await Promise.allSettled([storage(f.ledger,OWNER,'first-upload',60),storage(f.ledger,OTHER,'other-upload',60)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.find(r=>r.status==='rejected').reason.message,'STORAGE_QUOTA_EXHAUSTED');
 assert.equal(Object.values(f.snapshot().byte_usage.storage).reduce((n,r)=>n+r.bytes,0),60);
});

test('concurrent allocations for one owner enforce that owner ceiling independently',async()=>{
 const f=await setup(policy({storage:1000,ownerStorage:100}));
 const results=await Promise.allSettled([storage(f.ledger,OWNER,'upload-one',60),storage(f.ledger,OWNER,'upload-two',60)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.find(r=>r.status==='rejected').reason.message,'STORAGE_QUOTA_EXHAUSTED');
 assert.equal((await storage(f.ledger,OTHER,'independent-other-upload',100)).byte_count,100);
});

test('baseline occupancy is counted and abandoned upload allocations remain held across days',async()=>{
 const f=fixture(policy({storage:100,ownerStorage:100}));
 await reconcile(f.ledger,'global',20);await reconcile(f.ledger,OWNER,20);
 const reserved=await storage(f.ledger,OWNER,'abandoned-upload-chunks-and-final',80);
 f.advance(30*86400000);
 assert.deepEqual(await storage(f.ledger,OWNER,'abandoned-upload-chunks-and-final',10),reserved);
 await assert.rejects(storage(f.ledger,OWNER,'new-upload-after-expiration',1),error('STORAGE_QUOTA_EXHAUSTED'));
 assert.equal(f.snapshot().byte_usage.storage[reserved.reservation_id].bytes,80);
});

test('storage consumption is owner scoped, idempotent per resource and bounded cumulatively',async()=>{
 const f=await setup(),r=await storage(f.ledger,OWNER,'upload-peak',100);
 await assert.rejects(f.ledger.authorizeReservedStorage({owner:OTHER,reservation_id:r.reservation_id,resource_id:'chunk:0',byte_count:60}),error('STORAGE_RESERVATION_UNKNOWN'));
 assert.equal((await f.ledger.authorizeReservedStorage({owner:OWNER,reservation_id:r.reservation_id,resource_id:'chunk:0',byte_count:60})).remaining_bytes,40);
 assert.equal((await f.ledger.authorizeReservedStorage({owner:OWNER,reservation_id:r.reservation_id,resource_id:'chunk:0',byte_count:60})).remaining_bytes,40);
 assert.equal((await f.ledger.authorizeReservedStorage({owner:OWNER,reservation_id:r.reservation_id,resource_id:'final-copy',byte_count:40})).remaining_bytes,0);
 const before=f.snapshot();
 await assert.rejects(f.ledger.authorizeReservedStorage({owner:OWNER,reservation_id:r.reservation_id,resource_id:'unreserved-alias',byte_count:1}),error('STORAGE_RESERVED_BOUND_EXCEEDED'));
 assert.deepEqual(f.snapshot(),before);
});

test('current kill switch and lowered limits apply to later storage and transfer requests',async()=>{
 const f=await setup(),r=await storage(f.ledger,OWNER,'already-held-upload',50);
 const killed=policy();killed.kill_switch=true;killed.version='usage-killed-v2';await f.replacePolicy(killed);
 await assert.rejects(storage(f.ledger,OWNER,'new-upload',1),error('BYTE_USAGE_KILL_SWITCH'));
 await assert.rejects(f.ledger.authorizeReservedStorage({owner:OWNER,reservation_id:r.reservation_id,resource_id:'chunk:0',byte_count:1}),error('BYTE_USAGE_KILL_SWITCH'));
 await assert.rejects(begin(f.ledger,OWNER,'download',1),error('BYTE_USAGE_KILL_SWITCH'));
 const lower=policy({storage:40});lower.version='usage-lowered-v3';await f.replacePolicy(lower);
 await assert.rejects(storage(f.ledger,OWNER,'another-upload',1),error('STORAGE_QUOTA_EXHAUSTED'));
 assert.equal(f.snapshot().byte_usage.storage[r.reservation_id].bytes,50);
});

test('parallel transfers enforce global and per-owner byte ceilings transactionally',async()=>{
 const f=await setup(policy({transfer:100,ownerTransfer:100}));
 const global=await Promise.allSettled([begin(f.ledger,OWNER,'global-one',60),begin(f.ledger,OTHER,'global-two',60)]);
 assert.equal(global.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(global.find(r=>r.status==='rejected').reason.message,'TRANSFER_QUOTA_EXHAUSTED');
 const own=await setup(policy({transfer:1000,ownerTransfer:100}));
 const perOwner=await Promise.allSettled([begin(own.ledger,OWNER,'owner-one',60),begin(own.ledger,OWNER,'owner-two',60)]);
 assert.equal(perOwner.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await begin(own.ledger,OTHER,'other-owner',100)).reserved_bytes,100);
});

test('cross-owner transfer completion cannot release another owner slot or charge',async()=>{
 const f=await setup(policy({concurrent:1})),r=await begin(f.ledger,OWNER,'original',80),before=f.snapshot();
 await assert.rejects(f.ledger.completeTransfer({owner:OTHER,claim_id:r.claim_id,actual_bytes:0}),error('TRANSFER_CLAIM_UNKNOWN'));
 await assert.rejects(f.ledger.holdTransfer({owner:OTHER,claim_id:r.claim_id}),error('TRANSFER_CLAIM_UNKNOWN'));
 assert.deepEqual(f.snapshot(),before);
 await assert.rejects(begin(f.ledger,OTHER,'blocked-global-slot',1),error('TRANSFER_CONCURRENCY_EXHAUSTED'));
});

test('completed transfers release concurrency while retaining charge; replay is never a free transfer',async()=>{
 const f=await setup(policy({transfer:100,concurrent:1})),first=await begin(f.ledger,OWNER,'first-range-attempt',60);
 await assert.rejects(begin(f.ledger,OWNER,'overlapping-attempt',1),error('TRANSFER_CONCURRENCY_EXHAUSTED'));
 await f.ledger.completeTransfer({owner:OWNER,claim_id:first.claim_id,actual_bytes:60});
 await assert.rejects(begin(f.ledger,OWNER,'first-range-attempt',60),error('TRANSFER_CLAIM_REUSED'));
 const second=await begin(f.ledger,OWNER,'same-range-new-attempt',40);
 await f.ledger.completeTransfer({owner:OWNER,claim_id:second.claim_id,actual_bytes:40});
 await assert.rejects(begin(f.ledger,OWNER,'third-attempt',1),error('TRANSFER_QUOTA_EXHAUSTED'));
 const revision=f.revision();
 assert.equal((await f.ledger.completeTransfer({owner:OWNER,claim_id:first.claim_id,actual_bytes:0})).reused,true);
 assert.equal(f.revision(),revision);assert.equal(f.snapshot().byte_usage.transfers[first.claim_id].bytes,60);
});

test('uncertain transfers keep concurrency until trusted completion even across UTC reset',async()=>{
 const f=await setup(policy({transfer:1000,concurrent:1})),r=await begin(f.ledger,OWNER,'uncertain-stream',80);
 assert.equal((await f.ledger.holdTransfer({owner:OWNER,claim_id:r.claim_id})).retained,true);
 f.advance(86400000);
 await assert.rejects(begin(f.ledger,OTHER,'new-day-stream',1),error('TRANSFER_CONCURRENCY_EXHAUSTED'));
 await f.ledger.completeTransfer({owner:OWNER,claim_id:r.claim_id,actual_bytes:80});
 assert.equal((await begin(f.ledger,OTHER,'after-explicit-reconciliation',1)).reserved_bytes,1);
});

test('uncertain old-day transfer bytes count against the new day; completed old-day bytes do not',async()=>{
 const f=await setup(policy({transfer:100,concurrent:10})),held=await begin(f.ledger,OWNER,'unknown-old-day',80),known=await begin(f.ledger,OWNER,'known-old-day',20);
 await f.ledger.holdTransfer({owner:OWNER,claim_id:held.claim_id});
 await f.ledger.completeTransfer({owner:OWNER,claim_id:known.claim_id,actual_bytes:20});
 f.advance(86400000);
 await assert.rejects(begin(f.ledger,OWNER,'new-day-too-large',21),error('TRANSFER_QUOTA_EXHAUSTED'));
 assert.equal((await begin(f.ledger,OWNER,'new-day-exact-remaining',20)).reserved_bytes,20);
});

test('transfer completion cannot claim bytes beyond its reserved bound',async()=>{
 const f=await setup(),r=await begin(f.ledger,OWNER,'bounded-stream',40),before=f.snapshot();
 await assert.rejects(f.ledger.completeTransfer({owner:OWNER,claim_id:r.claim_id,actual_bytes:41}),error('TRANSFER_RESERVED_BOUND_EXCEEDED'));
 assert.deepEqual(f.snapshot(),before);
 await f.ledger.holdTransfer({owner:OWNER,claim_id:r.claim_id});
 assert.equal(f.snapshot().byte_usage.transfers[r.claim_id].bytes,40);
});

// Minimal pg-compatible fixture: row locking, candidate writes, commit and
// rollback are modeled; no database, credentials or provider is accessed.
class Pool{
 record=null;tail=Promise.resolve();
 async lock(){const previous=this.tail;let unlock;this.tail=new Promise(resolve=>{unlock=resolve;});await previous;return unlock;}
 async query(sql){assert.match(sql,/^SELECT body/);return {rows:this.record?[structuredClone(this.record)]:[],rowCount:this.record?1:0};}
 async connect(){
  const pool=this;let unlock=null,snapshot=null,pending=null;
  return {
   async query(sql,args=[]){
    if(sql.startsWith('BEGIN'))return {rows:[]};
    if(sql==='ROLLBACK'){pending=null;unlock?.();unlock=null;return {rows:[]};}
    if(sql==='COMMIT'){if(pending)pool.record=pending;unlock?.();unlock=null;return {rows:[]};}
    if(sql.startsWith('SELECT body')){unlock=await pool.lock();snapshot=pool.record?structuredClone(pool.record):null;return {rows:snapshot?[structuredClone(snapshot)]:[],rowCount:snapshot?1:0};}
    if(sql.startsWith('INSERT')){if(snapshot)return {rows:[],rowCount:0};pending={body:JSON.parse(args[1]),revision:1};return {rows:[{revision:1}],rowCount:1};}
    if(sql.startsWith('UPDATE')){if(!snapshot||snapshot.revision!==Number(args[2]))return {rows:[],rowCount:0};pending={body:JSON.parse(args[0]),revision:snapshot.revision+1};return {rows:[{revision:pending.revision}],rowCount:1};}
    assert.fail('Unexpected fixture SQL');
   },
   release(){unlock?.();unlock=null;}
  };
 }
}
function plan(label){
 const plan_id=hash(label);
 return {plan_id,owner:OWNER,fingerprint:hash(label+':fingerprint'),policy_version:'usage-fixture-v1',model:'openai-sunburst',tier:'premium',quality:'4k',include_hd:true,maximum_api_calls:2,cost:{maximum:1,currency:'USD'},calls:[
  {call_id:hash(label+':master'),operation:'enhance',model_calls:1},
  {call_id:hash(label+':landscape'),operation:'expand',model_calls:1},
  {call_id:hash(label+':portrait'),operation:'derive',model_calls:0}
 ]};
}

test('whole generation plan reserves every 75 MiB output and HD slot atomically with call quotas',async()=>{
 assert.equal(GENERATED_ASSET_STORAGE_BOUND,75*1024*1024);
 const maximum=5*GENERATED_ASSET_STORAGE_BOUND+GENERATED_PLAN_METADATA_BOUND,pool=new Pool();
 const ledger=createEnhancementLedger({pool,now:()=>START,verifyUsageBaseline:async input=>input.proof_id==='server-reconciled-fixture'});
 await ledger.compareAndSwapPolicy({expected_version:null,policy:policy({storage:maximum-1}),audit:{subject:'fixture-operator'}});
 await reconcile(ledger,'global');await reconcile(ledger,OWNER);
 const p=plan('all-outputs'),before=structuredClone(pool.record);
 await assert.rejects(ledger.reservePlan({owner:OWNER,plan:p}),error('STORAGE_QUOTA_EXHAUSTED'));
 assert.deepEqual(pool.record,before,'late metadata failure must roll back earlier output allocations and call reservations');
 const increased=policy({storage:maximum});increased.version='usage-fixture-v2';
 await ledger.compareAndSwapPolicy({expected_version:'usage-fixture-v1',policy:increased,audit:{subject:'fixture-operator'}});
 p.policy_version=increased.version;
 const r=await ledger.reservePlan({owner:OWNER,plan:p});
 assert.equal(r.byte_quota_reserved,true);assert.equal(r.storage_transfer_quotas_verified,false);
 assert.equal(r.planned_storage.maximum_bytes,maximum);assert.equal(Object.keys(r.planned_storage.slots).length,5);
 assert.ok(r.planned_storage.slots[p.calls[2].call_id],'zero-call deterministic derivative has its own bound');
 assert.ok(r.planned_storage.slots[p.calls[2].call_id+':hd'],'zero-call derivative HD copy has its own bound');
 assert.equal(Object.keys(pool.record.body.byte_usage.storage).length,6);
 assert.equal(Object.keys(pool.record.body.reservations).length,1);
 const revision=pool.record.revision;
 assert.deepEqual(await ledger.reservePlan({owner:OWNER,plan:p}),r);assert.equal(pool.record.revision,revision);
 await assert.rejects(ledger.reservePlan({owner:OWNER,plan:plan('second-plan-over-quota')}),error('PLAN_POLICY_CHANGED'));
 const second=plan('second-current-plan');second.policy_version=increased.version;
 await assert.rejects(ledger.reservePlan({owner:OWNER,plan:second}),error('STORAGE_QUOTA_EXHAUSTED'));
 assert.equal(Object.keys(pool.record.body.reservations).length,1);
 await ledger.authorizePlanAsset({owner:OWNER,plan_id:p.plan_id,slot_id:p.calls[2].call_id,resource_id:'deterministic-asset',byte_count:GENERATED_ASSET_STORAGE_BOUND});
 await assert.rejects(ledger.authorizePlanAsset({owner:OWNER,plan_id:p.plan_id,slot_id:p.calls[2].call_id,resource_id:'oversized-repair',byte_count:1}),error('STORAGE_RESERVED_BOUND_EXCEEDED'));
 await assert.rejects(ledger.authorizePlanAsset({owner:OTHER,plan_id:p.plan_id,slot_id:p.calls[0].call_id,resource_id:'cross-owner-output',byte_count:1}),error('OUTPUT_STORAGE_NOT_RESERVED'));
 await ledger.reserveStorage({owner:OWNER,plan_id:p.plan_id,resource_id:'job-and-events-metadata',byte_count:GENERATED_PLAN_METADATA_BOUND});
 assert.equal(Object.keys(pool.record.body.byte_usage.storage).length,6,'metadata uses prepaid storage rather than a second allocation');
 await assert.rejects(ledger.reserveStorage({owner:OWNER,plan_id:p.plan_id,resource_id:'overflow-metadata',byte_count:1}),error('STORAGE_RESERVED_BOUND_EXCEEDED'));
});

test('a transfer completed after UTC rollover remains charged on its completion day',async()=>{const f=await setup(policy({transfer:100})),claim=await begin(f.ledger,OWNER,'cross-midnight',80);f.advance(86400000);await f.ledger.completeTransfer({owner:OWNER,claim_id:claim.claim_id,actual_bytes:80});await assert.rejects(begin(f.ledger,OWNER,'new-day-too-large',21),error('TRANSFER_QUOTA_EXHAUSTED'));assert.equal((await begin(f.ledger,OWNER,'new-day-remaining',20)).reserved_bytes,20);});
