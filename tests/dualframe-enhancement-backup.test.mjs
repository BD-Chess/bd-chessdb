import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {verifyEnhancementBackup} from '../public/Nara/dualframe-lab/enhancement-backup.mjs';
const sharp=createRequire(new URL('../functions/package.json',import.meta.url))('sharp');
const sha256=async blob=>createHash('sha256').update(Buffer.from(await blob.arrayBuffer())).digest('hex');
async function fixture(){
 const blob=new Blob([await sharp({create:{width:32,height:24,channels:4,background:'#345678'}}).png().toBuffer()],{type:'image/png'}),hash=await sha256(blob),asset={blob,sha256:hash,byte_size:blob.size,mime:blob.type,width:32,height:24,family_id:'family_fixture_0001',source_sha256:'a'.repeat(64),asset_id:'cloud_master_0001',role:'natural-master',family_stage:'master',recipe:{kind:'natural'},provenance_verified:true},plan={plan_id:'b'.repeat(64),fingerprint:'c'.repeat(64),family_id:asset.family_id,source_sha256:asset.source_sha256,calls:[{call_id:'d'.repeat(64),operation:'enhance'}],maximum_api_calls:1,available:true};
 const family={family_id:asset.family_id,plan_id:plan.plan_id,plan,status:'MASTER_READY',master:asset,master_job_id:plan.calls[0].call_id,frame_jobs:[{job_id:'e'.repeat(64),status:'PENDING'}],submit_intent:{consent_fingerprint:plan.fingerprint,idempotency_key:'f'.repeat(64)},master_receipt:{job_id:plan.calls[0].call_id},created_at:'2026-10-15T00:00:00Z'};
 return {pair:{pair_id:'local_fixture_0001',original:{sha256:asset.source_sha256,blob:new Blob(['unchanged original'])},masters:[asset],enhancement_families:[family],families:[{family_id:'old_family_0001',status:'ACCEPTED',assets:{hd:{...asset,role:'hd-derivative'}}}],jobs:[{job_id:plan.calls[0].call_id,gateway_job_id:plan.calls[0].call_id,enhancement_plan_id:plan.plan_id,status:'HELD',candidate:asset},{job_id:'legacy_job_0001',status:'ACCEPTED'}],candidates:[{...asset,candidate_id:'candidate_fixture_0001'}],variants:{landscape:{hd:{...asset,role:'hd-derivative'}}}},asset,plan};
}
test('restore verifies every new image role, preserves original/history and deactivates all family cloud controls without mutating input',async()=>{
 const {pair,plan}=await fixture(),restored=await verifyEnhancementBackup(pair,{sha256});assert.equal(pair.enhancement_families[0].status,'MASTER_READY');assert.equal(pair.masters[0].provenance_verified,true);assert.equal(await restored.original.blob.text(),'unchanged original');assert.deepEqual(restored.original,pair.original);
 for(const family of [...restored.enhancement_families,...restored.families])assert.equal(family.status,'RESTORED');
 const family=restored.enhancement_families[0];assert.deepEqual(family.restored_plan,plan);assert.equal(family.restored_plan_id,plan.plan_id);assert.equal(family.restored_status,'MASTER_READY');assert.equal(family.family_id,pair.enhancement_families[0].family_id);assert.equal(family.master.source_sha256,pair.original.sha256);
 for(const key of ['plan','plan_id','master_job_id','frame_jobs','submit_intent','master_receipt'])assert.equal(Object.hasOwn(family,key),false);
 for(const asset of [restored.masters[0],family.master,restored.families[0].assets.hd,restored.jobs[0].candidate,restored.candidates[0],restored.variants.landscape.hd]){assert.equal(asset.provenance_verified,false);assert.equal(asset.provenance_basis,'restored-backup-unverified');assert.equal(await sha256(asset.blob),asset.sha256);}
 assert.equal(restored.jobs[0].status,'RESTORED');assert.equal(restored.jobs[0].gateway_job_id,undefined);assert.equal(restored.jobs[0].restored_status,'HELD');assert.deepEqual(restored.jobs[1],pair.jobs[1]);
 const again=await verifyEnhancementBackup(restored,{sha256});assert.deepEqual(again,restored,'a second local verification does not nest another history copy');
});
test('tampered master or less visible family asset fails instead of accepting only selected variants',async()=>{
 const first=await fixture();first.pair.masters[0]={...first.asset,blob:new Blob(['tampered'],{type:'image/png'})};await assert.rejects(verifyEnhancementBackup(first.pair,{sha256}),/INVALID_BACKUP/);
 const second=await fixture();second.pair.families[0].assets.hd.sha256='0'.repeat(64);await assert.rejects(verifyEnhancementBackup(second.pair,{sha256}),/INVALID_BACKUP/);
 const third=await fixture();third.pair.enhancement_families[0].master={...third.asset,blob:{__df_blob:1,id:'foreign_owner:asset',size:third.asset.blob.size,type:'image/png'}};await assert.rejects(verifyEnhancementBackup(third.pair,{sha256}),/INVALID_BACKUP/);
});
test('dimensions, byte size and MIME are checked against actual bytes; missing master bytes are rejected',async()=>{
 const dimensions=await fixture();dimensions.pair.masters[0]={...dimensions.asset,width:33};await assert.rejects(verifyEnhancementBackup(dimensions.pair,{sha256}),/INVALID_BACKUP/);
 const size=await fixture();size.pair.masters[0]={...size.asset,byte_size:size.asset.blob.size+1};await assert.rejects(verifyEnhancementBackup(size.pair,{sha256}),/INVALID_BACKUP/);
 const mime=await fixture();mime.pair.masters[0]={...mime.asset,mime:'image/jpeg'};await assert.rejects(verifyEnhancementBackup(mime.pair,{sha256}),/INVALID_BACKUP/);
 const missing=await fixture();delete missing.pair.enhancement_families[0].master.blob;await assert.rejects(verifyEnhancementBackup(missing.pair,{sha256}),/INVALID_BACKUP/);
});
test('optional decoder is injected locally and legacy records pass through intact',async()=>{
 const {pair}=await fixture();let calls=0;const result=await verifyEnhancementBackup(pair,{sha256,inspectImage:async blob=>{calls++;assert.ok(blob instanceof Blob);return {width:32,height:24};}});assert.ok(calls>0);assert.equal(result.enhancement_families[0].status,'RESTORED');
 const legacy={pair_id:'legacy_0001',original:{blob:new Blob(['legacy']),sha256:'a'.repeat(64)},jobs:[{job_id:'legacy_job_0001',status:'ACCEPTED'}],variants:{landscape:{},portrait:{}}};assert.deepEqual(await verifyEnhancementBackup(legacy,{sha256}),legacy);
});
test('real frozen plan master geometry and prompt remain metadata while actual master bytes stay mandatory',async()=>{
 const {pair}=await fixture(),family=pair.enhancement_families[0];
 family.plan.geometry={master:{width:1920,height:1440},master_request:{width:1920,height:1440}};
 family.plan.effective_prompts={master:'Preserve every recognizable person.',frames:{portrait:'Compose the same scene.'}};
 const restored=await verifyEnhancementBackup(pair,{sha256});
 assert.equal(restored.enhancement_families[0].restored_plan.geometry.master.width,1920);
 assert.equal(restored.enhancement_families[0].restored_plan.effective_prompts.master,'Preserve every recognizable person.');
 assert.equal(await sha256(restored.enhancement_families[0].master.blob),pair.masters[0].sha256);
 const bad=structuredClone(pair);delete bad.enhancement_families[0].master.blob;
 await assert.rejects(verifyEnhancementBackup(bad,{sha256}),/INVALID_BACKUP/);
});
test('a verified saved master over 32 MiB restores through the 64 MiB raw-archive asset contract',async()=>{
 const {pair,asset}=await fixture(),blob=new Blob([asset.blob,new Uint8Array(33*1048576)],{type:'image/png'});
 const large={...asset,blob,sha256:await sha256(blob),byte_size:blob.size};
 pair.masters=[large];pair.enhancement_families[0].master=large;
 const restored=await verifyEnhancementBackup(pair,{sha256});
 assert.equal(restored.masters[0].blob.size,blob.size);assert.equal(await sha256(restored.masters[0].blob),large.sha256);
 assert.equal(restored.enhancement_families[0].automatic_paid_retry,false);
});
