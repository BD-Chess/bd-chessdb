// Sync is a metadata/byte reconciliation protocol. It never submits provider work.
import {createHash} from 'node:crypto';
const HASH=/^[a-f0-9]{64}$/,ID=/^[a-zA-Z0-9_-]{8,100}$/;
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(code,status=400)=>{throw Object.assign(Error(code),{status});};
export function syncState({store,get,put,state,now}){
 async function keys(prefix){
  const found=new Set();let cursor;
  do{const page=await store.list({prefix,...(cursor?{cursor}:{})});
   if(page?.[Symbol.asyncIterator]){for await(const part of page)for(const b of part.blobs||[])found.add(b.key);break;}
   for(const b of page?.blobs||[])found.add(b.key);
   const next=page?.cursor||page?.next_cursor||page?.nextCursor;
   if(next&&next===cursor)fail('MANIFEST_LIST_INCOMPLETE',503);
   if(page?.has_more&&!next)fail('MANIFEST_LIST_INCOMPLETE',503);
   cursor=next;
  }while(cursor);
  return [...found].sort();
 }
 async function title(owner,sha){
  const legacy=await get(`titles/${owner}/${sha}`),list=await keys(`title-versions/${owner}/${sha}/`);
  let latest=null;for(const key of list){const r=await get(key);if(Number.isSafeInteger(r?.revision)&&(!latest||r.revision>latest.revision))latest=r;}
  return latest||{...(legacy||{}),revision:0};
 }
 async function writeTitle(owner,sha,b){
  const current=await title(owner,sha);
  if(b.base_revision===undefined){
   if(current.revision>0)fail('SYNC_UPDATE_REQUIRED',409);
   const saved={title:b.title.trim(),updated_at:new Date(now()).toISOString()};
   const write=await store.setJSON(`titles/${owner}/${sha}`,saved);
   if(write?.modified!==true||JSON.stringify(await get(`titles/${owner}/${sha}`))!==JSON.stringify(saved))fail('TITLE_WRITE_UNCONFIRMED',503);
   if((await title(owner,sha)).revision>0)fail('SYNC_UPDATE_REQUIRED',409);
   return {...saved,revision:0};
  }
  if(!Number.isSafeInteger(b.base_revision)||b.base_revision<0)fail('REVISION_INVALID');
  if(current.revision!==b.base_revision)fail('TITLE_CONFLICT',409);
  const saved={title:b.title.trim(),revision:current.revision+1,updated_at:new Date(now()).toISOString()};
  const result=await put(`title-versions/${owner}/${sha}/${saved.revision}`,saved);
  if(!result.modified)fail('TITLE_CONFLICT',409);
  return saved;
 }
 async function tombstoned(owner,pairId,source){
  return Boolean((pairId&&await get(`deleted-pairs/${owner}/${pairId}`))||(source&&await get(`deleted-sources/${owner}/${source}`)));
 }
 async function uploadLineage(owner,b){
  const derived=!['original','normalized'].includes(b.kind);
  if(!derived)return {};
  const parentIds=b.parent_asset_ids||[];
  if(!Array.isArray(parentIds)||parentIds.length>16||parentIds.some(id=>!ID.test(id)))fail('LINEAGE_INVALID');
  let pair=null;
  if(b.pair_id){if(!ID.test(b.pair_id))fail('LINEAGE_INVALID');pair=await get(`pairs/${owner}/${b.pair_id}`);if(!pair||pair.original?.sha256!==b.source_sha256)fail('LINEAGE_SOURCE_MISMATCH',409);}
  else if((b.operation||b.lineage?.operation)!=='generate'||!ID.test(b.family_id||''))fail('LINEAGE_PAIR_REQUIRED');
  if(b.source_sha256!==undefined&&b.source_sha256!==null&&!HASH.test(b.source_sha256))fail('LINEAGE_INVALID');
  if(await tombstoned(owner,b.pair_id,b.source_sha256))fail('PAIR_DELETED',409);
  const parents=[];
  for(const id of new Set(parentIds)){
   const parent=await get(`asset-meta/${owner}/${id}`);if(!parent)fail('LINEAGE_PARENT_UNKNOWN',404);
   const root=pair&&(id===pair.original?.asset_id||id===pair.normalized?.asset_id);
   if(!root&&((b.pair_id&&parent.pair_id!==b.pair_id&&parent.source_sha256!==b.source_sha256)||(!b.pair_id&&parent.family_id!==b.family_id)))fail('LINEAGE_PARENT_MISMATCH',409);
   parents.push({asset_id:id,sha256:parent.sha256});
  }
  const allowedAcceptance=['ACCEPTED','READY','REJECTED','CANDIDATE','PRESERVED'];
  if(b.acceptance!==undefined&&!allowedAcceptance.includes(b.acceptance))fail('ACCEPTANCE_INVALID');
  const role=String(b.role||b.kind);if(!/^[a-z][a-z0-9_-]{0,63}$/.test(role))fail('ASSET_ROLE_INVALID');
  const lineage=b.lineage===undefined?null:b.lineage;
  if(lineage!==null&&(typeof lineage!=='object'||Array.isArray(lineage)||JSON.stringify(lineage).length>8000))fail('LINEAGE_INVALID');
  return {pair_id:pair?.pair_id||null,source_sha256:b.source_sha256||null,parent_asset_ids:[...new Set(parentIds)],parents,family_id:ID.test(b.family_id||'')?b.family_id:pair?.pair_id||null,role,acceptance:b.acceptance||'PRESERVED',lineage,lineage_verification:'client-asserted; ownership and referenced hashes server-verified',...(b.operation?{operation:b.operation}:{}),...(b.orientation&&['portrait','landscape'].includes(b.orientation)?{orientation:b.orientation}:{}),...(b.quality&&['hd','4k'].includes(b.quality)?{quality:b.quality}:{})};
 }
 async function repairMissingAliases(owner,meta,data){
  const present=new Set(await keys(`assets/${owner}/`));
  for(const key of await keys(`asset-meta/${owner}/`)){
   const id=key.split('/').pop();if(id===meta.asset_id||present.has(`assets/${owner}/${id}`))continue;const old=await get(key);if(!old||old.sha256!==meta.sha256||old.byte_size!==meta.byte_size||old.mime!==meta.mime||old.width!==meta.width||old.height!==meta.height)continue;
   const written=await store.set(`assets/${owner}/${old.asset_id}`,data,{onlyIfNew:true});if(typeof written?.modified!=='boolean')fail('STORAGE_VERSION_UNSUPPORTED',503);
   const verified=await store.get(`assets/${owner}/${old.asset_id}`,{type:'arrayBuffer',consistency:'strong'});if(!verified||createHash('sha256').update(Buffer.from(verified)).digest('hex')!==old.sha256)fail('ASSET_REPAIR_UNCONFIRMED',503);
  }
 }
 async function saveRecord(owner,b){
  if(!HASH.test(b.record_id||'')||!HASH.test(b.source_sha256||'')||!b.record||typeof b.record!=='object'||Array.isArray(b.record)||!Array.isArray(b.asset_ids)||b.asset_ids.length>2000)fail('SYNC_RECORD_INVALID');
  if(digest(b.record)!==b.record_id)fail('SYNC_RECORD_HASH_MISMATCH',409);
  if(b.record.original?.sha256!==b.source_sha256||b.record.original?.blob?.__df_remote_asset!==1||b.record.original.blob.sha256!==b.source_sha256)fail('SYNC_RECORD_SOURCE_MISMATCH',409);
  if(await tombstoned(owner,b.record.cloud_pair_id||b.record.upload_id,b.source_sha256))fail('PAIR_DELETED',409);
  const markers=[];let count=0;
  function visit(v,depth=0){if(depth>40||++count>20000)fail('SYNC_RECORD_TOO_LARGE',413);if(v===null||typeof v!=='object')return;if(v.__df_remote_asset===1){markers.push(v);return;}for(const value of Object.values(v))visit(value,depth+1);}
  visit(b.record);
  const ids=[...new Set(b.asset_ids)].sort();
  if(ids.some(id=>!ID.test(id))||JSON.stringify([...new Set(markers.map(m=>m.asset_id))].sort())!==JSON.stringify(ids))fail('SYNC_RECORD_ASSETS_INVALID');
  let hasSource=false;
  for(const marker of markers){const meta=await get(`asset-meta/${owner}/${marker.asset_id}`);if(!meta)fail('ASSET_UNKNOWN',404);if(meta.sha256!==marker.sha256||meta.byte_size!==marker.size||meta.mime!==marker.type)fail('SYNC_RECORD_ASSET_MISMATCH',409);if(meta.sha256===b.source_sha256)hasSource=true;if(meta.source_sha256&&meta.source_sha256!==b.source_sha256)fail('SYNC_RECORD_SOURCE_MISMATCH',409);}
  if(!hasSource)fail('SYNC_RECORD_SOURCE_MISSING',409);
  const key=`sync-records/${owner}/${b.record_id}`,record={record_id:b.record_id,source_sha256:b.source_sha256,asset_ids:ids,record:b.record,owner,created_at:new Date(now()).toISOString()},existing=await get(key);
  if(existing){if(digest([existing.source_sha256,existing.asset_ids,existing.record])!==digest([record.source_sha256,record.asset_ids,record.record]))fail('SYNC_RECORD_CONFLICT',409);return {record_id:b.record_id,reused:true};}
  const write=await put(key,record);if(!write.modified){const concurrent=await get(key);if(digest([concurrent.source_sha256,concurrent.asset_ids,concurrent.record])!==digest([record.source_sha256,record.asset_ids,record.record]))fail('SYNC_RECORD_CONFLICT',409);}
  return {record_id:b.record_id,reused:!write.modified};
 }
 async function snapshot(owner){
  const records={assets:[],pairs:[],jobs:[],titles:[],tombstones:[],sync_records:[]};
  const names=[['asset-meta','assets'],['pairs','pairs'],['jobs','jobs'],['deleted-pairs','tombstones'],['sync-records','sync_records']];
  const available=new Set(await keys(`assets/${owner}/`));
  for(const [prefix,kind] of names)for(const key of await keys(`${prefix}/${owner}/`)){
   const record=await get(key);if(!record)continue;
   if(kind==='assets')records.assets.push({...record,bytes_present:available.has(`assets/${owner}/${record.asset_id}`)});
   else if(kind==='jobs')records.jobs.push(await state(record));
   else if(kind==='tombstones')records.tombstones.push({...record,pair_id:key.split('/').pop(),source_sha256:record.source_sha256||null});
   else records[kind].push(record);
  }
  const tombstoneSources=new Set(records.tombstones.map(t=>t.source_sha256).filter(Boolean));for(const key of await keys(`deleted-sources/${owner}/`)){const row=await get(key),sha=key.split('/').pop();if(row&&!tombstoneSources.has(sha))records.tombstones.push({...row,source_sha256:sha,pair_id:row.pair_id||null});}
  const sources=new Set();for(const key of await keys(`titles/${owner}/`))sources.add(key.split('/').pop());for(const key of await keys(`title-versions/${owner}/`))sources.add(key.split('/').at(-2));
  for(const sha of [...sources].sort())if(HASH.test(sha)){const record=await title(owner,sha);if(record.title)records.titles.push({source_sha256:sha,...record});}
  const entries=Object.entries(records).flatMap(([kind,rows])=>rows.map(record=>({kind,record})));
  const frontier=digest({owner,schema_version:1,entries}),saved={owner,schema_version:1,frontier,entries,created_at:new Date(now()).toISOString()};
  await put(`sync-snapshots/${owner}/${frontier}`,saved);
  return saved;
 }
 async function manifest(owner,url){
  const limit=Number(url.searchParams.get('limit')||100);if(!Number.isInteger(limit)||limit<1||limit>200)fail('MANIFEST_LIMIT_INVALID');
  let snap,offset=0;const cursor=url.searchParams.get('cursor');
  if(cursor){const m=cursor.match(/^([a-f0-9]{64})\.(\d{1,10})$/);if(!m)fail('MANIFEST_CURSOR_INVALID');snap=await get(`sync-snapshots/${owner}/${m[1]}`);if(!snap)fail('MANIFEST_EXPIRED',410);offset=Number(m[2]);if(offset>snap.entries.length)fail('MANIFEST_CURSOR_INVALID');}
  else snap=await snapshot(owner);
  const records={assets:[],pairs:[],jobs:[],titles:[],tombstones:[],sync_records:[]},page=[];let pageBytes=0;for(const entry of snap.entries.slice(offset,offset+limit)){const size=Buffer.byteLength(JSON.stringify(entry));if(page.length&&pageBytes+size>2*1024*1024)break;page.push(entry);pageBytes+=size;}for(const e of page)records[e.kind].push(e.record);
  const next=offset+page.length,complete=next>=snap.entries.length;
  return {schema_version:1,owner,frontier:snap.frontier,created_at:snap.created_at,records,next_cursor:complete?null:`${snap.frontier}.${next}`,complete,total_records:snap.entries.length};
 }
 return {keys,title,writeTitle,tombstoned,uploadLineage,repairMissingAliases,saveRecord,manifest};
}
