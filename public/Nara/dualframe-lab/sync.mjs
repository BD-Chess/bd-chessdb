import * as disk from './store.mjs?v=3.0-r4.11';

const HASH=/^[a-f0-9]{64}$/;
const remoteRef=value=>value?.__df_remote_asset===1;
const sizeOf=value=>[value?.byte_size,value?.size,value?.bytes].find(x=>Number.isSafeInteger(x)&&x>=0)??null;
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'&&!(value instanceof Blob)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',value instanceof Blob?await value.arrayBuffer():new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const aborted=signal=>{if(signal?.aborted)throw Error('SYNC_INTERRUPTED');};
const errorCode=error=>/^[A-Z0-9_]+$/.test(error?.message||'')?error.message:'SYNC_TRANSFER_FAILED';
function collect(value,predicate,out=[],path=[],parent=null){
 if(predicate(value)){out.push({value,path,parent});return out;}
 if(Array.isArray(value))value.forEach((item,i)=>collect(item,predicate,out,[...path,i],value));
 else if(value&&typeof value==='object'&&!(value instanceof Blob))for(const [key,item] of Object.entries(value))collect(item,predicate,out,[...path,key],value);
 return out;
}
function at(value,path){for(const key of path)value=value?.[key];return value;}
function set(value,path,item){let parent=value;for(const key of path.slice(0,-1))parent=parent[key];parent[path.at(-1)]=item;}
function metaClone(value){
 if(value instanceof Blob||disk.isBlobReference(value))return value;
 if(Array.isArray(value))return value.map(metaClone);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!['sync_conflicts','sync_missing_assets','title_sync_pending','title_sync_error','title_revision','sync_last_frontier','cloud_source_saved'].includes(key)).map(([key,item])=>[key,metaClone(item)]));
 return value;
}
function limiter(max){let running=0;const waiting=[];function next(){while(running<max&&waiting.length){const {task,resolve,reject}=waiting.shift();running++;Promise.resolve().then(task).then(resolve,reject).finally(()=>{running--;next();});}}return task=>new Promise((resolve,reject)=>{waiting.push({task,resolve,reject});next();});}
const identity=item=>item?.candidate_id||item?.gateway_job_id||item?.job_id||item?.asset_id||item?.sha256||JSON.stringify(item);
function union(a=[],b=[]){const values=new Map(a.map(x=>[identity(x),x]));for(const item of b){const id=identity(item);values.set(id,values.has(id)?{...values.get(id),...item}:item);}return [...values.values()];}
function mergeEnhancementFamilies(local=[],incoming=[]){
 const merged=[...local],order=['PLANNING','PLANNED','MASTER_SUBMITTING','MASTER_PENDING','MASTER_READY','MASTER_ACCEPTED','FRAMES_PENDING','COMPLETE'];
 for(const family of incoming){
  const index=merged.findIndex(value=>['plan_id','attempt_id','family_id'].some(key=>value[key]&&value[key]===family[key]));if(index<0){merged.push(family);continue;}
  const old=merged[index],master=old.master&&family.master?{...family.master,...old.master,...(family.master.blob?{blob:family.master.blob}:{})}:old.master||family.master;
  const status=old.status==='REJECTED'||family.status==='REJECTED'?'REJECTED':order.indexOf(family.status)>order.indexOf(old.status)?family.status:old.status||family.status;
  merged[index]={...family,...old,status,...(master?{master}:{}),frame_jobs:union(old.frame_jobs,family.frame_jobs)};
 }
 return merged;
}
export function mergeSyncedPair(local,incoming){
 if(!local)return incoming;
 const merged={...incoming,...local,original:{...incoming.original,...local.original},variants:{portrait:{...incoming.variants?.portrait,...local.variants?.portrait},landscape:{...incoming.variants?.landscape,...local.variants?.landscape}},jobs:union(local.jobs,incoming.jobs),candidates:union(local.candidates,incoming.candidates)};
 merged.sync_selection_resolutions={...incoming.sync_selection_resolutions,...local.sync_selection_resolutions};
 merged.sync_conflicts=(merged.sync_conflicts||[]).filter(conflict=>conflict.kind!=='selection'||merged.sync_selection_resolutions[conflict.direction+'.'+conflict.quality]!==conflict.local_sha256);
 for(const key of ['blob','normalized'])if(incoming.original?.[key])merged.original[key]=incoming.original[key];
 for(const direction of ['portrait','landscape'])for(const quality of ['hd','fourK']){
  const a=local.variants?.[direction]?.[quality],b=incoming.variants?.[direction]?.[quality];
  if(a&&b&&a.sha256!==b.sha256){const resolved=merged.sync_selection_resolutions[direction+'.'+quality]===a.sha256;merged.candidates=union(merged.candidates,[{...b,sync_acceptance_state:'ACCEPTED',sync_selection_conflict:!resolved}]);if(!resolved)merged.sync_conflicts=union(merged.sync_conflicts,[{kind:'selection',direction,quality,local_sha256:a.sha256,remote_sha256:b.sha256}]);}
  else if(a&&b&&b.blob)merged.variants[direction][quality]={...a,...b};
 }
 for(const [key,value] of Object.entries(incoming.original||{}))if(local.original?.[key]===undefined)merged.original[key]=value;
 // These are preserved alternative family/master records, never replacements.
 for(const key of ['families','masters','accepted_variants'])if(Array.isArray(incoming[key])||Array.isArray(local[key]))merged[key]=union(local[key],incoming[key]);
 if(Array.isArray(incoming.enhancement_families)||Array.isArray(local.enhancement_families))merged.enhancement_families=mergeEnhancementFamilies(local.enhancement_families,incoming.enhancement_families);
 if(incoming.sync_missing_assets?.length)merged.sync_missing_assets=incoming.sync_missing_assets;else delete merged.sync_missing_assets;
 return merged;
}

/** A metadata-only manifest and a bounded two-transfer queue; no provider API. */
export function createSyncEngine({api,store=disk,onProgress=()=>{},owner='bd-research-owner',maxPasses=3}={}){
 if(!api?.manifest||!api?.uploadAsset||!api?.downloadAsset||!api?.saveRecord)throw Error('SYNC_ADAPTER_REQUIRED');
 let tail=Promise.resolve(),requests=0;
 const transfer=limiter(2),key=suffix=>`sync:${owner}:${suffix}`;
 async function catalog(){
  let cursor=null,frontier=null,pages=0;const seen=new Set(),result={schema_version:1,pairs:[],jobs:[],assets:[],sync_records:[],tombstones:[],title_records:[],titles:{}};
  do{
   if(++pages>100000)throw Error('SYNC_PAGINATION_LIMIT');
   const page=await api.manifest({cursor,limit:100});
   if(!page||!page.frontier||!page.records)throw Error('SYNC_MANIFEST_INVALID');
   if(frontier&&frontier!==page.frontier)throw Error('SYNC_FRONTIER_CHANGED');frontier=page.frontier;
   for(const name of ['pairs','jobs','assets','sync_records','tombstones'])result[name].push(...(page.records[name]||[]));
   const titles=page.records.titles||[];for(const value of titles){result.title_records.push(value);result.titles[value.source_sha256]=value.title;}
   cursor=page.next_cursor||null;
   if(cursor&&seen.has(cursor))throw Error('SYNC_CURSOR_REPEATED');if(cursor)seen.add(cursor);
   if(!cursor&&page.complete!==true)throw Error('SYNC_MANIFEST_INCOMPLETE');
  }while(cursor);
  return {...result,frontier,complete:true};
 }
 async function execute({signal}={}){
  const progress={phase:'catalog',photos:0,files:0,queued:0,running:0,completed:0,failed:0,upload_bytes:0,download_bytes:0,unknown_bytes:0,remaining:0,synced:false,errors:[],conflicts:[]};
  const emit=()=>onProgress({...progress,errors:[...progress.errors],conflicts:[...progress.conflicts],pending_requests:requests-1});
  const fail=(error,details={})=>{const entry={code:errorCode(error),...details};if(!progress.errors.some(x=>JSON.stringify(x)===JSON.stringify(entry))){progress.errors.push(entry);progress.failed++;}emit();};
  const runTransfer=(direction,task,details)=>{progress.queued++;progress.files++;emit();return transfer(async()=>{progress.queued--;progress.running++;progress.phase=direction;emit();try{aborted(signal);const result=await task();progress.completed++;return result;}catch(error){fail(error,details);return null;}finally{progress.running--;emit();}});};
  let manifest=await catalog(),lastFrontier=manifest.frontier;
  const available=new Map(),localVerified=new Map();
  let localPairs=await store.getPairs();progress.photos=localPairs.length+manifest.pairs.filter(p=>!localPairs.some(l=>l.original?.sha256===p.original?.sha256)).length;emit();
  const fingerprint=value=>JSON.stringify(stable(value??null)),expectedLocal=new Map(localPairs.map(pair=>[pair.pair_id,fingerprint(pair)]));let localChanged=false;
  // Compare inside the same metadata transaction as every sync merge. This
  // distinguishes our writes from a concurrent rename/save, preserving that
  // work and refusing to declare it uploaded until the next explicit Sync.
  const update=async(id,mutate)=>{
   const apply=current=>{if(fingerprint(current)!==(expectedLocal.get(id)??fingerprint(null)))localChanged=true;return mutate(current);};
   const result=store.updatePair?await store.updatePair(id,apply):await store.putPair(apply(await store.getPair?.(id)||localPairs.find(p=>p.pair_id===id)));
   expectedLocal.set(id,fingerprint(result));return result;
  };
  async function verifiedLocal(value,expected){const blob=await store.getStoredBlob(value);if(!(blob instanceof Blob))throw Error('STORAGE_ASSET_MISSING');const hash=await digest(blob);if(expected&&hash!==expected)throw Error('SYNC_HASH_MISMATCH');return {blob,hash};}
  async function localAsset(meta,pairId){
   if(available.has(meta.asset_id))return available.get(meta.asset_id);
   const checkpoint=await store.getSyncState(key('asset:'+meta.asset_id));
   if(checkpoint?.sha256===meta.sha256&&sizeOf(meta)!==null)try{const {blob}=await verifiedLocal(checkpoint.blob,meta.sha256);if(blob.size===sizeOf(meta)){available.set(meta.asset_id,checkpoint.blob);return checkpoint.blob;}}catch{}
   // A local source is reusable only after reading and hashing the actual bytes.
   for(const pair of localPairs)for(const member of collect(pair,x=>x instanceof Blob||disk.isBlobReference(x))){
    const expected=member.path.at(-1)==='blob'?member.parent?.sha256:null;
    if(expected!==meta.sha256)continue;
    try{const {blob}=await verifiedLocal(member.value,meta.sha256);if(blob.size!==sizeOf(meta))continue;const saved=await store.putSyncAsset(key('asset:'+meta.asset_id),pairId,blob,{asset_id:meta.asset_id,sha256:meta.sha256,byte_size:blob.size});available.set(meta.asset_id,saved.blob);return saved.blob;}catch{}
   }
   return null;
  }
  function indexAssets(snapshot){const assets=new Map(snapshot.assets.map(a=>[a.asset_id,a]));for(const pair of snapshot.pairs)for(const a of [pair.original,pair.normalized])if(a?.asset_id)assets.set(a.asset_id,{...assets.get(a.asset_id),...a});for(const job of snapshot.jobs)for(const asset of [job.output,job.hd_copy])if(asset?.asset_id)assets.set(asset.asset_id,{...assets.get(asset.asset_id),...asset});return assets;}
  async function uploadPairs(snapshot){
   const remoteAssets=indexAssets(snapshot),uploading=new Map();
   const tombstones=snapshot.tombstones;
   for(const originalPair of localPairs){
    aborted(signal);
    if(tombstones.some(t=>t.pair_id===(originalPair.upload_id||originalPair.pair_id)||t.source_sha256===originalPair.original?.sha256)){await store.putSyncState(key('tombstone:'+originalPair.pair_id),{pair_id:originalPair.pair_id,source_sha256:originalPair.original?.sha256,tombstone:true});progress.conflicts.push({kind:'tombstone',pair_id:originalPair.pair_id});continue;}
    const pair=metaClone(originalPair),members=collect(pair,x=>x instanceof Blob||disk.isBlobReference(x));
    const remotePair=snapshot.pairs.find(p=>p.original?.sha256===pair.original?.sha256);let remotePairId=remotePair?.pair_id||pair.upload_id;
    const source=pair.original?.sha256;let pairFailed=false;
    async function memberUpload(member){
     const path=member.path.join('.'),kind=path==='original.blob'?(pair.generated_from_prompt?'generated':'original'):path==='original.normalized'?'normalized':path.includes('master')?'master':path.includes('candidate')?'candidate':'derived';
     const result=await runTransfer('upload',async()=>{
      const expected=member.path.at(-1)==='blob'&&HASH.test(member.parent?.sha256||'')?member.parent.sha256:null;
      const {blob,hash}=await verifiedLocal(member.value,expected);localVerified.set(hash,{value:member.value,pair_id:pair.pair_id,size:blob.size,type:blob.type});
      const roleKey=source+':'+hash+':'+(['original','normalized'].includes(kind)?kind:'saved');
      // Install the promise before the first await: repeated references to a
      // candidate and its accepted variant must never race two uploads.
      if(!uploading.has(roleKey))uploading.set(roleKey,(async()=>{
       let remote=[...remoteAssets.values()].find(a=>a.bytes_present!==false&&a.sha256===hash&&(!a.source_sha256||a.source_sha256===source)&&(!['original','normalized'].includes(kind)||a.kind===kind)),checkpoint=await store.getSyncState(key('upload:'+roleKey));
       if(!remote&&checkpoint?.asset?.sha256===hash&&remoteAssets.get(checkpoint.asset.asset_id)?.bytes_present!==false)remote=checkpoint.asset;
       if(remote&&sizeOf(remote)!==blob.size)throw Error('SYNC_SIZE_MISMATCH');
       if(!remote){remote=await api.uploadAsset(blob,{signal,kind,source_sha256:source,pair_id:remotePairId,family_id:pair.family_id||pair.pair_id,parent_asset_ids:[],lineage:{operation:pair.generated_from_prompt?'generate':'sync',source_sha256:source,role:kind},checkpoint:checkpoint?.transport,onCheckpoint:transport=>store.putSyncState(key('upload:'+roleKey),{sha256:hash,transport})});
        if(remote?.sha256!==hash||sizeOf(remote)!==blob.size)throw Error('SYNC_UPLOAD_VERIFICATION_FAILED');progress.upload_bytes+=blob.size;
        await store.putSyncState(key('upload:'+roleKey),{asset:remote,sha256:hash,verified:true});remoteAssets.set(remote.asset_id,remote);
       }return remote;
      })());
      const remote=await uploading.get(roleKey);
      // A canonical remote reference carries the server-confirmed size/MIME.
      return {__df_remote_asset:1,asset_id:remote.asset_id,sha256:hash,size:blob.size,type:remote.mime||blob.type};
     },{pair_id:pair.pair_id,path});
     if(result)set(pair,member.path,result);else pairFailed=true;
    }
    // The backend validates derived lineage against an existing pair. Establish
    // raw/normalized source first; variants share the same global transfer queue.
    for(const path of ['original.blob','original.normalized'])for(const member of members.filter(x=>x.path.join('.')===path))await memberUpload(member);
    if(!remotePairId&&api.createPair&&remoteRef(pair.original?.blob)&&remoteRef(pair.original?.normalized)&&!pair.generated_from_prompt){
     try{const saved=await api.createPair({original_asset_id:pair.original.blob.asset_id,normalized_asset_id:pair.original.normalized.asset_id,original_sha256:source,title:pair.display_name||pair.original.filename||pair.original.name});remotePairId=saved.pair_id;pair.upload_id=saved.pair_id;pair.gateway_version='v3';await update(pair.pair_id,latest=>({...latest,upload_id:saved.pair_id,gateway_version:'v3'}));}catch(error){fail(error,{pair_id:pair.pair_id});pairFailed=true;}
    }
    await Promise.all(members.filter(x=>!['original.blob','original.normalized'].includes(x.path.join('.'))).map(memberUpload));
    if(pairFailed)continue;
    const record=stable(pair),recordId=await digest(JSON.stringify(record)),assetIds=[...new Set(collect(record,remoteRef).map(x=>x.value.asset_id))];
    try{if(!snapshot.sync_records.some(r=>r.record_id===recordId))await api.saveRecord({record_id:recordId,source_sha256:source,asset_ids:assetIds,record});await update(pair.pair_id,latest=>({...latest,cloud_source_saved:true}));}catch(error){fail(error,{pair_id:pair.pair_id});}
    const title=snapshot.title_records.find(t=>t.source_sha256===source);
    if(originalPair.title_sync_pending&&api.putTitle){
     const base=originalPair.title_revision??0;
     if((title?.revision??0)!==base&&title?.title!==originalPair.display_name){progress.conflicts.push({kind:'title',pair_id:pair.pair_id,local_title:originalPair.display_name,remote_title:title?.title});}
     else try{const saved=await api.putTitle(source,{title:originalPair.display_name,base_revision:base});await update(pair.pair_id,latest=>latest?.display_name===originalPair.display_name?{...latest,title_sync_pending:false,title_revision:saved.revision}:latest);}catch(error){fail(error,{pair_id:pair.pair_id});}
    }
   }
  }
  function legacyRecords(snapshot){
   const records=snapshot.sync_records.map(r=>r.record),sources=new Set(records.map(r=>r.original?.sha256));
   const marker=a=>a?.asset_id?{__df_remote_asset:1,asset_id:a.asset_id,sha256:a.sha256,size:sizeOf(a),type:a.mime||'image/png'}:undefined;
   for(const source of snapshot.pairs){
    if(sources.has(source.original?.sha256))continue;
    const o=source.original,n=source.normalized||o,w=n?.width||o?.width,h=n?.height||o?.height,direction=w>=h?'landscape':'portrait';
    records.push({schema:'bd.dualframe.pair.v1',pair_id:source.pair_id,upload_id:source.pair_id,gateway_version:'v3',created_at:source.created_at,original:{name:source.title,filename:source.title,sha256:o.sha256,blob:marker(o),normalized:marker(n),width:w,height:h,bytes:sizeOf(o),mime:o.mime,source_orientation:direction,visibility:'private'},variants:{landscape:{},portrait:{}},jobs:[],candidates:[]});
   }
   // Include jobs even when a generic snapshot already exists: another device
   // may have produced READY/ACCEPTED output after that immutable snapshot.
   for(const job of snapshot.jobs){
    let matches=records.filter(p=>p.upload_id===job.pair_id||p.pair_id===job.pair_id||p.original?.sha256===job.input_sha256||(job.operation==='generate'&&p.original?.sha256===job.output?.sha256));
    if(!job.output?.asset_id){for(const record of matches)record.jobs=union(record.jobs,[{...job,gateway_job_id:job.job_id}]);continue;}
    if(!matches.length&&job.operation==='generate'){
     const o=job.output,d=job.target||((o.width||1)>=(o.height||1)?'landscape':'portrait');
     const record={schema:'bd.dualframe.pair.v1',pair_id:job.job_id,generated_from_prompt:true,description:job.prompt,created_at:job.created_at,original:{name:(job.prompt||'Generated image').slice(0,100)+'.png',filename:(job.prompt||'Generated image').slice(0,100)+'.png',sha256:o.sha256,blob:marker(o),normalized:marker(o),width:o.width,height:o.height,bytes:sizeOf(o),mime:o.mime,source_orientation:d,visibility:'private',origin:'generated',creation_receipt:{...job}},variants:{landscape:{},portrait:{}},jobs:[],candidates:[]};records.push(record);matches=[record];
    }
    for(const record of matches){
    if(job.operation==='enhance'){
     const master={...job.output,blob:marker(job.output),master_id:job.job_id,job_id:job.job_id,family_id:job.family_id||job.output.family_id,recipe:job.recipe||job.output.recipe,status:job.status,acceptance:job.status,role:job.output.role||((job.recipe?.kind||'natural')+'-master')};
     record.masters=union(record.masters,[master]);record.jobs=union(record.jobs,[{...job,gateway_job_id:job.job_id,...(job.status==='READY'?{candidate:master}:{})}]);continue;
    }
    const proof=job.output.normalization_proof;
    const candidate={...job.output,blob:marker(job.output),candidate_id:job.job_id,source_sha256:record.original.sha256,direction:job.target,path:`variants/${job.target}/${job.output.sha256}.png`,provider:job.provider,model_key:job.model,origin:'generated',mode:job.mode,...(proof?{lineage_status:proof.verified?'SOURCE_VERIFIED':'NORMALIZED_SOURCE_VERIFIED',provenance_verified:proof.verified===true,provenance_basis:'authenticated-gateway-response',provenance_evidence:{source_sha256:record.original.sha256,output_sha256:job.output.sha256}}:{})};
    record.candidates=union(record.candidates,[candidate]);record.jobs=union(record.jobs,[{...job,job_id:job.job_id,gateway_job_id:job.job_id,...(job.status==='READY'?{candidate}:{})}]);
    if(job.status==='ACCEPTED'){record.variants[job.target]||={};const quality=job.quality==='4k'?'fourK':'hd';if(!record.variants[job.target][quality])record.variants[job.target][quality]=candidate;else if(record.variants[job.target][quality].sha256!==candidate.sha256)record.accepted_variants=union(record.accepted_variants,[candidate]);}
    if(job.status==='ACCEPTED'&&job.hd_copy?.asset_id){
     const hd={...job.hd_copy,blob:marker(job.hd_copy),candidate_id:job.job_id+'_hd',direction:job.target,path:`variants/${job.target}/${job.hd_copy.sha256}.png`,acceptance_state:'ACCEPTED',role:'hd-derivative'};
     record.candidates=union(record.candidates,[hd]);record.variants[job.target]||={};if(!record.variants[job.target].hd)record.variants[job.target].hd=hd;else if(record.variants[job.target].hd.sha256!==hd.sha256)record.accepted_variants=union(record.accepted_variants,[hd]);
    }
    }
   }
   return records;
  }
  async function importRecords(snapshot,affectedAsset=null){
   for(const record of legacyRecords(snapshot)){
    if(affectedAsset&&!collect(record,remoteRef).some(({value})=>value.asset_id===affectedAsset))continue;
    const tombstone=snapshot.tombstones.find(t=>t.pair_id===(record.upload_id||record.pair_id)||t.source_sha256===record.original?.sha256);
    if(tombstone){await store.putSyncState(key('tombstone:'+record.pair_id),{tombstone:true,...tombstone});continue;}
    const local=localPairs.find(p=>p.pair_id===record.pair_id||p.original?.sha256===record.original?.sha256),id=local?.pair_id||record.pair_id;
    const missing=[];
    async function replace(value,path=[]){
     if(remoteRef(value)){
      const ref=available.get(value.asset_id);if(!ref){missing.push(value.asset_id);return undefined;}
      // Re-home the independently verified receipt to this pair's ID namespace.
      if(!ref.id.startsWith(id+':')){const blob=await store.getStoredBlob(ref);return (await store.putSyncAsset(key('pair:'+id+':'+value.asset_id),id,blob,{asset_id:value.asset_id,sha256:value.sha256,byte_size:blob.size})).blob;}return ref;
     }
     if(Array.isArray(value)){const out=[];for(const item of value){const next=await replace(item,path);if(next!==undefined)out.push(next);}return out;}
     if(value&&typeof value==='object'){
      const out={};for(const [key,item] of Object.entries(value)){const next=await replace(item,[...path,key]);if(next!==undefined)out[key]=next;}
      // Do not expose a candidate/variant whose declared blob is still missing.
      if(remoteRef(value.blob)&&!out.blob)return undefined;return out;
     }return value;
    }
    const incoming=await replace(record);if(!incoming?.original?.blob)continue;
    incoming.pair_id=id;incoming.cloud_source_saved=true;incoming.sync_missing_assets=[...new Set(missing)];
    const merged=await update(id,current=>{const value=mergeSyncedPair(current,incoming),title=snapshot.title_records.find(t=>t.source_sha256===value.original.sha256);if(title&&!value.title_sync_pending){value.display_name=title.title;value.title_revision=title.revision??0;}return value;});
    const index=localPairs.findIndex(p=>p.pair_id===id);if(index>=0)localPairs[index]=merged;else localPairs.push(merged);
    for(const conflict of merged.sync_conflicts||[])if(!progress.conflicts.some(x=>JSON.stringify(x)===JSON.stringify(conflict)))progress.conflicts.push(conflict);
   }
  }
  async function download(snapshot){
   const assets=indexAssets(snapshot),records=legacyRecords(snapshot),required=new Map();
   for(const record of records){if(snapshot.tombstones.some(t=>t.pair_id===(record.upload_id||record.pair_id)||t.source_sha256===record.original?.sha256))continue;for(const {value} of collect(record,remoteRef))required.set(value.asset_id,{...assets.get(value.asset_id),...value,byte_size:assets.get(value.asset_id)?.byte_size??value.size,pair_id:localPairs.find(p=>p.original?.sha256===record.original?.sha256)?.pair_id||record.pair_id});}
   // Successful orphan uploads are receipts too. Preserve them for recovery;
   // their absence from an incomplete family is never interpreted as deletion.
   for(const asset of assets.values())if(!required.has(asset.asset_id)&&!snapshot.tombstones.some(t=>t.source_sha256===asset.source_sha256||t.pair_id===asset.pair_id))required.set(asset.asset_id,{...asset,pair_id:asset.pair_id||'sync_orphan_assets'});
   // Sequential metadata commits keep concurrent asset completions from replacing
   // one another. Blob transfer concurrency remains globally bounded at two.
   let imports=Promise.resolve();const commit=assetId=>{imports=imports.then(()=>importRecords(snapshot,assetId));return imports;};
   await Promise.all([...required.values()].map(meta=>runTransfer('download',async()=>{
    if(!HASH.test(meta.sha256||''))throw Error('SYNC_ASSET_HASH_UNKNOWN');if(sizeOf(meta)===null){progress.unknown_bytes++;throw Error('SYNC_ASSET_SIZE_UNKNOWN');}if(meta.bytes_present===false)throw Error('SYNC_CLOUD_ASSET_MISSING');
    if(await localAsset(meta,meta.pair_id))return;
    const same=localVerified.get(meta.sha256);let blob;
    if(same&&same.size===sizeOf(meta))blob=await store.getStoredBlob(same.value);
    else{const receipt=await store.getSyncState(key('download:'+meta.asset_id));blob=await api.downloadAsset(meta,{signal,checkpoint:receipt?.transport,onCheckpoint:transport=>store.putSyncState(key('download:'+meta.asset_id),{transport})});if(!(blob instanceof Blob))throw Error('SYNC_ASSET_MISSING');if(blob.size!==sizeOf(meta))throw Error('SYNC_SIZE_MISMATCH');if(await digest(blob)!==meta.sha256)throw Error('SYNC_HASH_MISMATCH');progress.download_bytes+=blob.size;}
    const saved=await store.putSyncAsset(key('asset:'+meta.asset_id),meta.pair_id,blob,{asset_id:meta.asset_id,sha256:meta.sha256,byte_size:blob.size,verified:true});available.set(meta.asset_id,saved.blob);await store.putSyncState(key('download:'+meta.asset_id),{complete:true,asset_id:meta.asset_id,sha256:meta.sha256});await commit(meta.asset_id);
   },{asset_id:meta.asset_id,pair_id:meta.pair_id})));
   await imports;await importRecords(snapshot);
   return [...required.keys()].filter(id=>!available.has(id));
  }
  let missing=[];
  for(let pass=0;pass<maxPasses;pass++){
   aborted(signal);progress.phase='reconcile';emit();
   await uploadPairs(manifest);manifest=await catalog();lastFrontier=manifest.frontier;
   missing=await download(manifest);
   const final=await catalog();
   if(final.frontier===lastFrontier){manifest=final;break;}
   manifest=final;if(pass===maxPasses-1)fail(Error('SYNC_FRONTIER_CHANGED'));
  }
  const freshPairs=await store.getPairs();if(freshPairs.length!==expectedLocal.size||freshPairs.some(pair=>fingerprint(pair)!==expectedLocal.get(pair.pair_id)))localChanged=true;
  if(localChanged)fail(Error('SYNC_LOCAL_FRONTIER_CHANGED'));
  progress.remaining=missing.length+progress.errors.length+progress.conflicts.length;progress.frontier=manifest.frontier;progress.phase='complete';progress.synced=progress.remaining===0;
  await store.putSyncState(key('last-run'),{...progress,finished_at:new Date().toISOString()});emit();return {...progress};
 }
 function sync(options={}){requests++;const work=tail.catch(()=>{}).then(()=>execute(options));tail=work.finally(()=>{requests--;});tail.catch(()=>{});return work;}
 return {sync,catalog};
}
