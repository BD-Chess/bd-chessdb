import {sha256 as digest,headerSize} from './core.mjs?v=3.0-r4.11';

const HASH=/^[a-f0-9]{64}$/;
const invalid=()=>{throw Error('INVALID_BACKUP');};
const isEnhancement=value=>!!(value?.enhancement_plan_id||value?.family_stage||value?.family_id&&(value?.recipe||['enhance','derive'].includes(value?.operation)||/master|hd-derivative/.test(value?.role||value?.kind||'')));
const inspectHeader=async blob=>headerSize(await blob.arrayBuffer());

// Backup bytes carry history, not authority to resume a cloud plan or spend an
// allowance. This helper is local and deterministic; it never contacts an API.
export async function verifyEnhancementBackup(pair,{sha256=digest,inspectImage=inspectHeader}={}){
 if(!pair||typeof pair!=='object'||typeof sha256!=='function'||inspectImage!==null&&typeof inspectImage!=='function')invalid();
 const result=structuredClone(pair),checked=new WeakSet(),checkedBlobs=new WeakMap();
 async function verifyAsset(asset){
  const blob=asset.blob;
  if(!(blob instanceof Blob)||!HASH.test(asset.sha256||'')||!blob.size||blob.size>32*1024*1024)invalid();
  for(const key of ['byte_size','size','bytes'])if(Object.hasOwn(asset,key)&&(!Number.isSafeInteger(asset[key])||asset[key]!==blob.size))invalid();
  let proof=checkedBlobs.get(blob);
  if(!proof){
   const actualHash=await sha256(blob);if(actualHash!==asset.sha256)invalid();
   let dimensions=null;try{dimensions=inspectImage?await inspectImage(blob):null;}catch{invalid();}
   proof={sha256:actualHash,dimensions};checkedBlobs.set(blob,proof);
  }
  if(proof.sha256!==asset.sha256)invalid();
  if(Object.hasOwn(asset,'mime')&&asset.mime!==blob.type)invalid();
  for(const key of ['width','height'])if(Object.hasOwn(asset,key)&&(!Number.isSafeInteger(asset[key])||asset[key]<1))invalid();
  if(asset.width&&asset.height&&asset.width*asset.height>24000000)invalid();
  if(proof.dimensions){
   if(!Number.isSafeInteger(proof.dimensions.width)||!Number.isSafeInteger(proof.dimensions.height)||proof.dimensions.width<1||proof.dimensions.height<1||proof.dimensions.width*proof.dimensions.height>24000000)invalid();
   if(asset.width!==undefined&&proof.dimensions.width!==asset.width||asset.height!==undefined&&proof.dimensions.height!==asset.height||proof.dimensions.mime&&proof.dimensions.mime!==blob.type)invalid();
  }
  asset.provenance_verified=false;asset.provenance_basis='restored-backup-unverified';
 }
 async function visit(value,{requiredAsset=false}={}){
  if(value instanceof Blob)invalid();
  if(!value||typeof value!=='object'){if(requiredAsset)invalid();return;}
  if(value.__df_blob===1)invalid();
  if(checked.has(value))return;checked.add(value);
  if(Array.isArray(value)){if(requiredAsset)invalid();for(const child of value)await visit(child);return;}
  if(requiredAsset||Object.hasOwn(value,'blob'))await verifyAsset(value);
  for(const [key,child] of Object.entries(value)){
   if(key==='blob')continue;
   if(key==='master'&&child!==null&&child!==undefined)await visit(child,{requiredAsset:true});
   else if(key==='masters'){
    if(!Array.isArray(child))invalid();for(const master of child)await visit(master,{requiredAsset:true});
   }else await visit(child);
  }
 }
 function restoreFamily(family){
  if(!family||typeof family!=='object'||Array.isArray(family))invalid();
  if(family.plan)family.restored_plan=family.plan;
  if(family.plan_id)family.restored_plan_id=family.plan_id;
  if(family.master_job_id)family.restored_master_job_id=family.master_job_id;
  if(family.frame_jobs)family.restored_frame_jobs=family.frame_jobs;
  if(family.submit_intent)family.restored_submit_intent=family.submit_intent;
  if(family.master_receipt)family.restored_master_receipt=family.master_receipt;
  if(family.recovered_master_receipt)family.restored_recovered_master_receipt=family.recovered_master_receipt;
  if(family.status!=='RESTORED')family.restored_status=family.status||null;
  family.status='RESTORED';family.automatic_paid_retry=false;
  for(const key of ['plan','plan_id','master_job_id','frame_jobs','submit_intent','master_receipt','recovered_master_receipt','gateway_job_id','upload_id','url'])delete family[key];
 }
 for(const key of ['masters','accepted_variants']){
  if(result[key]===undefined)continue;if(!Array.isArray(result[key]))invalid();
  for(const asset of result[key])await visit(asset,{requiredAsset:true});
 }
 for(const key of ['enhancement_families','families']){
  if(result[key]===undefined)continue;if(!Array.isArray(result[key]))invalid();
  for(const family of result[key]){await visit(family);restoreFamily(family);}
 }
 // Saved candidates and job history may hold additional masters or HD copies
 // absent from the currently selected frame. Every saved byte is checked.
 for(const asset of result.candidates||[])if(isEnhancement(asset))await visit(asset,{requiredAsset:true});
 for(const branch of Object.values(result.variants||{}))for(const asset of Object.values(branch||{}))if(isEnhancement(asset))await visit(asset,{requiredAsset:true});
 for(const job of result.jobs||[])if(isEnhancement(job)){
  await visit(job);
  if(job.status!=='RESTORED')job.restored_status=job.status;
  job.status='RESTORED';job.automatic_paid_retry=false;
  if(job.gateway_job_id)job.restored_gateway_job_id=job.gateway_job_id;
  delete job.gateway_job_id;delete job.submit_intent;delete job.url;
 }
 return result;
}
