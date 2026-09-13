/** HTTP boundary integration, synthetic requests and encrypted atomic CAS adapter.
 * No live mailbox, provider history, model call or deployed-memory claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createAtomicStore } from '../functions/_wl/store.mjs';
import { createManagedHandler, createMemoryHandler, initialState } from '../functions/_wl/service.mjs';
import { bindWorker } from '../functions/_wl/core.mjs';
import { SOURCE_SCHEMA, CAPSULE_SCHEMA, memoryDigest, memorySourceRef, memoryCapsuleDigest } from '../functions/_wl/memory.mjs';

const TIME='2026-09-13T01:00:00.000Z',PROJECT='AI8 Wake Lab',AUTH='SYNTHETIC_ONLY';
function input(suffix='1'){
 const text='Synthetic owner export: build a report.\nAssistant reports a result; it remains unverified.\nAlternative: retain the baseline.\n',bytes=Buffer.from(text);
 const source={schema:SOURCE_SCHEMA,source_snapshot_id:'snapshot-'+suffix,project_id:PROJECT,source_session_id:'export-session-'+suffix,branch_id:'bridge-main',source_identity_kind:'BRIDGE_SCOPED',provider_session_id:null,source_provider:'OWNER_PROVIDED_EXPORT',execution_surface:'WL_BD_OWNER_IMPORT_V1',actor_identity_ref:'WL_OWNER_PASSWORD_V1',project_membership_evidence_ref:'OWNER_EXPLICIT_AI8_WAKE_LAB_IMPORT',source_scope_ref:'explicit-owner-scope-'+suffix,retention_scope_ref:'private-retention-'+suffix,acquisition_mode:'HUMAN_ASSISTED_EXPORT_IMPORT',source_frontier:'owner-export-fragment-'+suffix,captured_at:TIME,privacy_class:'WL_PRIVATE_RAW',origin_domains:['PROJECT_SESSION'],bytes_base64:bytes.toString('base64'),bytes_digest:memoryDigest(bytes),representation_utf8:text,representation_digest:memoryDigest(bytes),normalizer_ref:null,coverage:{mode:'VISIBLE_CONTEXT_ONLY',ranges:[{start:0,end:bytes.length}],complete_inventory:false,total_source_bytes:null,missing_artifact_refs:[]},lineage_refs:[]};
 const span={domain:'BYTES',start:0,end:bytes.length,digest:memoryDigest(bytes)};
 const item=(id,type,text,origin='ASSISTANT_STATEMENT')=>({item_id:id,type,text,origin_kind:origin,speaker_observation:origin==='VISIBLE_USER_STATEMENT'?'user':'assistant',source_spans:[structuredClone(span)],epistemic_status:'ODPRTO',evidence_class:type==='TEST'?'REPORTED_RESULT':'UNKNOWN',evidence_refs:[],instruction_taint:true});
 const capsule={schema:CAPSULE_SCHEMA,capsule_id:'capsule-'+suffix,revision:1,supersedes_ref:null,project_id:PROJECT,source_ref:memorySourceRef(source),source_digest:memoryDigest(source),source_coverage:structuredClone(source.coverage),memory_scope:'PROJECT_LIBRARY',lab_id:null,items:[item('intent','INTENT','Build a report','VISIBLE_USER_STATEMENT'),item('test','TEST','Assistant reports an unverified result'),item('alternative','ALTERNATIVE','Retain the baseline')],relations:[],artifacts:[],next_handles:[{action:'Inspect current source',input_refs:[],preconditions:['Check allowed scope'],cheapest_test:'Compare the retained baseline',expected_evidence:'Exact verification receipt',reopen_condition:'Changed source evidence'}],extractor_version:'synthetic-extractor-v1',extraction_contract_ref:'owner-export-capsule-v1',extraction_receipt_ref:'synthetic-extraction-'+suffix,model_observation:null,privacy_class:'WL_PRIVATE_DERIVED',retention_scope_ref:source.retention_scope_ref,allowed_use:['RESEARCH'],payload_digest:''};
 const result={source,capsule,cursor:{stream_id:'owner-export-'+suffix,before:0,after:bytes.length}};return rebind(result);
}
function rebind(value){value.capsule.source_ref=memorySourceRef(value.source);value.capsule.source_digest=memoryDigest(value.source);value.capsule.source_coverage=structuredClone(value.source.coverage);value.capsule.payload_digest=memoryCapsuleDigest(value.capsule);return value}
function fixture(){
 let row=null,version=0,clock=TIME,beforeMemoryMutation=null,afterMemoryMutation=null,serial=0;
 const blobs={async getWithMetadata(){return structuredClone(row)},async setJSON(_key,value,options){if((options.onlyIfNew&&row)||(options.onlyIfMatch&&options.onlyIfMatch!==row?.etag))return {modified:false};row={data:value,etag:String(++version)};return {modified:true,etag:row.etag}}};
 const store=createAtomicStore({blobs,key:randomBytes(32),initial:initialState});
 const memoryStore={read:()=>store.read(),async mutate(fn,opts){if(beforeMemoryMutation){const hook=beforeMemoryMutation;beforeMemoryMutation=null;await hook()}const result=await store.mutate(fn,opts);if(afterMemoryMutation){const hook=afterMemoryMutation;afterMemoryMutation=null;await hook()}return result}};
 const authenticate=req=>req.headers.get('x-wl-password')===AUTH;
 const managed=createManagedHandler({authenticate,makeStore:()=>store,now:()=>clock});
 const memory=createMemoryHandler({authenticate,makeStore:()=>memoryStore,now:()=>clock});
 async function call(handler,endpoint,body,{auth=true,origin}={}){const req=new Request('https://wl.example/api/wl/'+endpoint,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(auth?{'x-wl-password':AUTH}:{}),...(origin?{origin}:{})},...(body?{body:JSON.stringify(body)}:{})});const r=await handler(req);return {status:r.status,data:await r.json(),headers:r.headers}}
 const mem=(body,opts)=>call(memory,'memory',body,opts),manage=(body,opts)=>call(managed,'managed',body,opts);
 async function createRun(sourceRefs,suffix='1'){
  const cmd={action:'CREATE',command_id:'create-'+suffix,run_id:'run-'+suffix,expected_revision:0,control_epoch:0,parameters:{run_kind:'NEW_WL',title:'Synthetic memory integration '+suffix,lab_id:'lab-'+suffix,source_scope:sourceRefs,mission:{mission_id:'mission-'+suffix,intent:'Inspect permitted historical export',target_outcome:'Synthetic report',target_artifact:{kind:'report'},source_requirements:[],source_scope:sourceRefs,success_criteria:[]}}};
  const response=await manage(cmd);assert.equal(response.status,200,JSON.stringify(response.data));return {project_id:PROJECT,mission_id:'mission-'+suffix,lab_id:'lab-'+suffix,run_id:'run-'+suffix,purpose:'RESEARCH',exposure_ref:'client-cannot-mint-authority',mode:'HISTORICAL'};
 }
 async function command(target,action,parameters={}){const run=(await store.read()).runs[target.run_id];const result=await manage({action,command_id:'action-'+(++serial),run_id:run.run_id,expected_revision:run.revision,control_epoch:run.control_epoch,parameters});assert.equal(result.status,200,JSON.stringify(result.data));return result}
 async function bindSyntheticWorker(target){await store.mutate(root=>{const run=root.runs[target.run_id];const changed=bindWorker(root,{run_id:run.run_id,worker_id:'SYNTHETIC_WORKER',expected_revision:run.revision,control_epoch:run.control_epoch},{actor:{id:'BD',authenticated:true,role:'owner'},now:clock,capabilities:{worker_binding_verified:true,binding_evidence_ref:'SYNTHETIC_TEST_BINDING_ONLY'}});const metadata=root._store;for(const key of Object.keys(root))delete root[key];Object.assign(root,changed.state);root._store=metadata;return changed.result})}
 const retrieve=(target,id='retrieval-1',extra={})=>mem({action:'retrieve',parameters:{retrieval_id:id,target,query:'report',max_chars:16000,...extra}});
 return {store,mem,manage,createRun,command,bindSyntheticWorker,retrieve,raw:()=>JSON.stringify(row),time:v=>{clock=v},beforeMutation:fn=>{beforeMemoryMutation=fn},afterMutation:fn=>{afterMemoryMutation=fn}};
}

test('HTTP S1: partial owner import persists encrypted; exact Mission scope yields a non-authoritative packet',async()=>{
 const f=fixture(),source=input(),target=await f.createRun([memorySourceRef(source.source)]);
 assert.equal((await f.mem({action:'ingest',parameters:source},{auth:false})).status,401);
 const imported=await f.mem({action:'ingest',parameters:source});assert.equal(imported.status,200,JSON.stringify(imported.data));assert.equal(imported.data.result.readback_verified,true);assert.equal(imported.data.result.coverage.complete_inventory,false);assert.equal(imported.data.result.execution_authority,'NONE');
 const duplicate=await f.mem({action:'ingest',parameters:source});assert.deepEqual(duplicate.data.result,imported.data.result);
 assert.ok(!f.raw().includes('Synthetic owner export'));assert.ok(!f.raw().includes('Build a report'));
 const result=await f.retrieve(target);assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.result.packet.capsules.length,1);assert.equal(result.data.result.packet.capsules[0].source_ref,memorySourceRef(source.source));assert.match(result.data.result.exposure_ref,/^owner-exposure:/);assert.notEqual(result.data.result.exposure_ref,target.exposure_ref);assert.equal(result.data.result.execution_authority,'NONE');assert.equal(result.data.result.packet.research_permit_consumed,false);assert.equal(result.data.result.packet.live_cold_start_proven,false);assert.match(result.headers.get('cache-control'),/no-store/);
 const status=await f.mem();assert.equal(status.data.memory.source_count,1);assert.equal(status.data.memory.total_history_count,null);assert.equal(status.data.memory.history_sync,'AUTO_HISTORY_SYNC_NOT_ACTIVATED');
});

test('HTTP S1: invented provider/history/full capture claims are rejected before persistence',async()=>{
 const mutations=[s=>{s.acquisition_mode='VERIFIED_SCOPED_HISTORY_ADAPTER'},s=>{s.acquisition_mode='SESSION_SIDE_CHECKPOINT'},s=>{s.source_identity_kind='PROVIDER_OBSERVED';s.provider_session_id='invented-provider-id'},s=>{s.provider_session_id='invented'},s=>{s.coverage.mode='FULL_AT_SNAPSHOT';s.coverage.complete_inventory=true;s.coverage.total_source_bytes=Buffer.from(s.bytes_base64,'base64').length},s=>{s.source_provider='CHATGPT_NATIVE_HISTORY'},s=>{s.execution_surface='SCHEDULED_WORKER'},s=>{s.actor_identity_ref='INVENTED_SERVICE_AUTHORITY'},s=>{s.project_membership_evidence_ref='INVENTED_MEMBERSHIP'}];
 for(const mutate of mutations){const f=fixture(),body=input();mutate(body.source);rebind(body);const rejected=await f.mem({action:'ingest',parameters:body});assert.equal(rejected.status,403);assert.equal(rejected.data.error,'OWNER_IMPORT_PROVENANCE_REQUIRED');assert.equal((await f.mem()).data.memory.source_count,0)}
});

test('HTTP S1: body-supplied artifact/test/model evidence never becomes trusted authority',async()=>{
 const testDigest=memoryDigest('synthetic test digest'),artifactDigest=memoryDigest('synthetic artifact digest');
 const attempts=[
  {code:'REPORTED_RESULT_NOT_VERIFIED',change:c=>{c.items[1].epistemic_status='PREVERJENO';c.items[1].evidence_class='VERIFIED_TEST_RESULT';c.items[1].evidence_refs=[testDigest]}},
  {code:'ARTIFACT_NOT_READBACK_VERIFIED',change:c=>{c.artifacts=[{artifact_id:'claimed-artifact',digest:artifactDigest,status:'AVAILABLE'}]}},
  {code:'MODEL_INVOCATION_NOT_OBSERVED',change:c=>{c.model_observation={provider:'invented',model_id:'invented',invocation_ref:'claimed-model-call'}}}
 ];
 for(const attempt of attempts){const f=fixture(),body=input();attempt.change(body.capsule);rebind(body);const authority={verified_test_digests:[testDigest],artifact_digests:[artifactDigest],verified_model_invocation_refs:['claimed-model-call'],authenticated:true};
  const rejected=await f.mem({action:'ingest',context:authority,capabilities:authority,parameters:{...body,context:authority}});assert.notEqual(rejected.status,200);assert.equal(rejected.data.error,attempt.code);assert.equal((await f.mem()).data.memory.source_count,0)}
});

test('HTTP S1: wrong target tuple and unscoped other lab expose no capsule or snippet',async()=>{
 const f=fixture(),body=input();assert.equal((await f.mem({action:'ingest',parameters:body})).status,200);const allowed=await f.createRun([memorySourceRef(body.source)]),other=await f.createRun(['different-source-ref'],'2');
 const wrong=await f.retrieve({...allowed,lab_id:other.lab_id},'wrong-lab');assert.equal(wrong.status,403);assert.equal(wrong.data.error,'MEMORY_TARGET_SCOPE_DENIED');
 const empty=await f.retrieve(other,'other-lab');assert.equal(empty.status,200);assert.equal(empty.data.result.packet.capsules.length,0);assert.ok(!JSON.stringify(empty.data).includes('Build a report'));
 const invented=await f.retrieve({...allowed,mission_id:'invented-mission'},'invented-target');assert.equal(invented.status,403);
 const origin=await f.mem({action:'retrieve',parameters:{target:allowed,retrieval_id:'origin',max_chars:16000}},{origin:'https://attacker.example'});assert.equal(origin.status,403);assert.equal(origin.data.error,'ORIGIN_DENIED');
});

test('HTTP S1: lab-scoped capsules remain absent even when a second Mission names their source',async()=>{
 const f=fixture(),body=input();body.capsule.memory_scope='LAB_SCOPED';body.capsule.lab_id='lab-1';rebind(body);assert.equal((await f.mem({action:'ingest',parameters:body})).status,200);const first=await f.createRun([memorySourceRef(body.source)]),second=await f.createRun([memorySourceRef(body.source)],'2');assert.equal((await f.retrieve(first)).data.result.packet.capsules.length,1);const denied=await f.retrieve(second,'lab2');assert.equal(denied.data.result.packet.capsules.length,0);
});

test('HTTP S1: Pause, Stop and exact expiry block retrieval; revoke still works under global pause',async()=>{
 const f=fixture(),body=input();await f.mem({action:'ingest',parameters:body});const target=await f.createRun([memorySourceRef(body.source)]);await f.bindSyntheticWorker(target);await f.command(target,'START');await f.command(target,'PAUSE');assert.equal((await f.retrieve(target,'paused')).data.error,'MEMORY_TARGET_SCOPE_DENIED');await f.command(target,'RESUME');assert.equal((await f.retrieve(target,'resumed')).status,200);await f.command(target,'STOP');assert.equal((await f.retrieve(target,'stopped')).data.error,'MEMORY_TARGET_SCOPE_DENIED');await f.command(target,'PROLONG_AND_RESUME',{duration_hours:24});f.time((await f.store.read()).runs[target.run_id].expires_at);const expired=await f.retrieve(target,'expired');assert.notEqual(expired.status,200);assert.equal(expired.data.error,'MEMORY_SCOPE_DENIED');
 await f.store.mutate(root=>{root.global_control.status='PAUSED';return {fixture:true}});const status=await f.mem();assert.equal(status.data.memory.source_count,1);const revoked=await f.mem({action:'revoke',parameters:{ref:memorySourceRef(body.source),reason:'Synthetic owner revocation',authority_ref:'owner-authenticated-request'}});assert.equal(revoked.status,200);assert.equal(revoked.data.result.content_erased,false);assert.equal((await f.mem()).data.memory.source_count,0);assert.equal(Object.keys((await f.store.read()).memory.sources).length,1);assert.equal(Object.keys((await f.store.read()).memory.retrievals).length,0);
});

test('HTTP S1: STOP and explicit reopen before retrieval commit invalidate minted exposure context',async()=>{
 const f=fixture(),body=input();await f.mem({action:'ingest',parameters:body});const target=await f.createRun([memorySourceRef(body.source)]);await f.command(target,'START');
 f.beforeMutation(async()=>{await f.command(target,'STOP');await f.command(target,'PROLONG_AND_RESUME',{duration_hours:24})});
 const rejected=await f.retrieve(target,'in-flight-stop-reopen');assert.notEqual(rejected.status,200);assert.equal(rejected.data.error,'MEMORY_SCOPE_DENIED');assert.ok(!JSON.stringify(rejected.data).includes('Build a report'));assert.equal((await f.store.read()).memory.retrievals['in-flight-stop-reopen'],undefined);
 const renewed=await f.retrieve(target,'new-owner-exposure');assert.equal(renewed.status,200);assert.equal(renewed.data.result.packet.capsules.length,1);
});

test('HTTP S1: STOP and reopen after storage commit still prevent stale packet readback',async()=>{
 const f=fixture(),body=input();await f.mem({action:'ingest',parameters:body});const target=await f.createRun([memorySourceRef(body.source)]);await f.command(target,'START');
 f.afterMutation(async()=>{await f.command(target,'STOP');await f.command(target,'PROLONG_AND_RESUME',{duration_hours:24})});
 const rejected=await f.retrieve(target,'after-commit-stop-reopen');assert.notEqual(rejected.status,200);assert.equal(rejected.data.error,'MEMORY_SCOPE_DENIED');assert.ok(!JSON.stringify(rejected.data).includes('Build a report'));
 const retry=await f.retrieve(target,'after-commit-stop-reopen');assert.notEqual(retry.status,200);assert.equal(retry.data.error,'RETRIEVAL_ID_CONFLICT');
});
