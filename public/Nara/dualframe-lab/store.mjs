const DB = 'bd-dualframe-lab-v1';
// v3 adds receipts only. Existing pairs/assets remain readable without hydration.
const VERSION=3;
const blobIds=new WeakMap();
export const isBlobReference=value=>value?.__df_blob===1&&typeof value.id==='string';
function references(value,out=new Set()){
 if(isBlobReference(value))out.add(value.id);
 else if(Array.isArray(value))for(const item of value)references(item,out);
 else if(value&&typeof value==='object'&&!(value instanceof Blob))for(const item of Object.values(value))references(item,out);
 return out;
}
// Blob bytes move into a separate store. The original hash and every other field survive.
function separate(value,pairId,assets,seen=new Map()){
 if(value instanceof Blob){
  if(seen.has(value))return seen.get(value);
  const id=blobIds.get(value)||pairId+':'+crypto.randomUUID();
  const ref={__df_blob:1,id,size:value.size,type:value.type};seen.set(value,ref);
  if(!blobIds.has(value))assets.set(id,value);
  return ref;
 }
 if(isBlobReference(value)){
  if(!value.id.startsWith(pairId+':'))throw Error('STORAGE_ASSET_OWNER_MISMATCH');
  return {...value};
 }
 if(Array.isArray(value))return value.map(item=>separate(item,pairId,assets,seen));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,separate(item,pairId,assets,seen)]));
 return value;
}
export function storageErrorCode(error){
 const name=error?.name||'';
 if(name==='QuotaExceededError')return 'STORAGE_QUOTA_EXCEEDED';
 if(name==='AbortError')return 'STORAGE_TRANSACTION_ABORTED';
 if(name==='SecurityError'||name==='NotAllowedError')return 'STORAGE_ACCESS_DENIED';
 if(name==='InvalidStateError')return 'STORAGE_CONNECTION_CLOSED';
 if(name==='ConstraintError')return 'STORAGE_RECORD_CONFLICT';
 if(name==='NotFoundError'||name==='VersionError')return 'STORAGE_SCHEMA_ERROR';
 if(name==='UnknownError'||name==='DataError')return 'STORAGE_IO_FAILURE';
 return 'STORAGE_OPERATION_FAILED';
}
const storageError=error=>Object.assign(new Error(storageErrorCode(error)),{cause:error});
export async function storageEstimate(){
 if(!navigator.storage?.estimate)return {supported:false,usage:null,quota:null};
 try{const {usage,quota}=await navigator.storage.estimate();return {supported:Number.isFinite(usage)&&Number.isFinite(quota)&&quota>0,usage:Number.isFinite(usage)?usage:null,quota:Number.isFinite(quota)&&quota>0?quota:null};}
 catch{return {supported:false,usage:null,quota:null};}
}
let connection,updateBarrier=false,activeWrites=0,writeWaiters=[];
export async function openStore() {
  if (connection) return connection;
  connection = await new Promise((resolve,reject) => {
    const request = indexedDB.open(DB,VERSION);
    request.onupgradeneeded = event => {
      const db=request.result,tx=request.transaction;
      for (const name of ['pairs','scores'])if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:name === 'pairs' ? 'pair_id' : 'comparison_id'});
      if(!db.objectStoreNames.contains('sync'))db.createObjectStore('sync');
      const assets=db.objectStoreNames.contains('assets')?tx.objectStore('assets'):db.createObjectStore('assets');
      if(event.oldVersion>=2)return;
      const cursor=tx.objectStore('pairs').openCursor();
      // One legacy pair at a time; upgrade transaction rolls everything back on failure.
      cursor.onsuccess=()=>{const row=cursor.result;if(!row)return;try{
        const writes=new Map(),meta=separate(row.value,row.value.pair_id,writes);
        for(const [id,blob] of writes)assets.put(blob,id);
        row.update(meta);row.continue();
      }catch{tx.abort();}};
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(storageError(request.error));
    request.onblocked = () => reject(Error('STORAGE_DB_BLOCKED'));
  });
  connection.onversionchange=()=>{connection?.close();connection=null;};
  return connection;
}
async function operation(store,mode,action) {
  const writing=mode==='readwrite';
  if(writing&&updateBarrier)throw Error('UPDATE_IN_PROGRESS');
  if(writing)activeWrites++;
  try {
  const db = await openStore();
  return await new Promise((resolve,reject) => {
    let tx,r,result,settled=false;
    const fail=error=>{if(!settled){settled=true;reject(storageError(error));}};
    try{tx=db.transaction(store,mode);r=action(tx.objectStore(store));}
    catch(error){fail(error);return;}
    r.onsuccess=()=>{result=r.result;};
    r.onerror=()=>fail(r.error||tx.error);
    tx.oncomplete=()=>{if(!settled){settled=true;resolve(result);}};
    tx.onerror=()=>fail(tx.error||r.error);
    tx.onabort=()=>fail(tx.error||r.error||{name:'AbortError'});
  });
  } finally { if(writing){activeWrites--;if(activeWrites===0){for(const resolve of writeWaiters)resolve();writeWaiters=[];}} }
}
async function writePair(pair,id=pair?.pair_id){
 if(updateBarrier)throw Error('UPDATE_IN_PROGRESS');
 activeWrites++;
 try{
  const db=await openStore(),writes=new Map();let meta=typeof pair==='function'?null:pair?separate(pair,id,writes):null,keep=references(meta);
  await new Promise((resolve,reject)=>{
   const tx=db.transaction(['pairs','assets'],'readwrite'),pairs=tx.objectStore('pairs'),assets=tx.objectStore('assets');
   tx.oncomplete=()=>{for(const [key,blob] of writes)blobIds.set(blob,key);resolve();};
   tx.onabort=tx.onerror=()=>reject(storageError(tx.error||{name:'AbortError'}));
   const old=pairs.get(id);old.onsuccess=()=>{
    if(typeof pair==='function')try{const value=pair(old.result);meta=value?separate(value,id,writes):null;keep=references(meta);}catch{tx.abort();return;}
    for(const key of references(old.result))if(!keep.has(key))assets.delete(key);
    for(const [key,blob] of writes)assets.put(blob,key);
    // Missing asset references abort, preserving the old pair and its image bytes.
    for(const key of keep)if(!writes.has(key)){const request=assets.getKey(key);request.onsuccess=()=>{if(request.result===undefined)tx.abort();};}
    if(meta)pairs.put(meta);else pairs.delete(id);
   };
  });
  return meta;
 }finally{activeWrites--;if(!activeWrites){for(const resolve of writeWaiters)resolve();writeWaiters=[];}}
}
export const putPair = p => writePair(p);
export const updatePair = (id,updater) => writePair(updater,id);
export const removePair = id => writePair(null,id);
export const getPairs = () => operation('pairs','readonly',s=>s.getAll());
export const getPair = id => operation('pairs','readonly',s=>s.get(id));
export const getSyncState = key => operation('sync','readonly',s=>s.get(key));
export const putSyncState = (key,value) => operation('sync','readwrite',s=>s.put(value,key));
// Each verified remote asset is committed independently. A failed later variant
// therefore cannot roll back the original or force it to transfer on reload.
export async function putSyncAsset(key,pairId,blob,metadata={}){
 if(!(blob instanceof Blob))throw Error('STORAGE_ASSET_INVALID');
 if(updateBarrier)throw Error('UPDATE_IN_PROGRESS');
 activeWrites++;
 try{
  const db=await openStore(),id=pairId+':sync:'+key,ref={__df_blob:1,id,size:blob.size,type:blob.type},receipt={...metadata,blob:ref};
  await new Promise((resolve,reject)=>{
   const tx=db.transaction(['assets','sync'],'readwrite');
   tx.objectStore('assets').put(blob,id);tx.objectStore('sync').put(receipt,key);
   tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(storageError(tx.error||{name:'AbortError'}));
  });blobIds.set(blob,id);return receipt;
 }finally{activeWrites--;if(!activeWrites){for(const resolve of writeWaiters)resolve();writeWaiters=[];}}
}
export async function getStoredBlob(value){
 if(value instanceof Blob)return value;
 if(!isBlobReference(value))return null;
 const blob=await operation('assets','readonly',s=>s.get(value.id));
 if(!(blob instanceof Blob)||blob.size!==value.size||blob.type!==value.type)throw Error('STORAGE_ASSET_MISSING');
 blobIds.set(blob,value.id);return blob;
}
export function hasStoredBlobs(value){
 if(isBlobReference(value))return true;
 if(value instanceof Blob)return false;
 if(Array.isArray(value))return value.some(hasStoredBlobs);
 return value&&typeof value==='object'?Object.values(value).some(hasStoredBlobs):false;
}
export async function hydratePair(value,seen=new Map()){
 if(!hasStoredBlobs(value))return value;
 if(isBlobReference(value)){if(!seen.has(value.id))seen.set(value.id,getStoredBlob(value));return seen.get(value.id);}
 if(value instanceof Blob)return value;
 if(Array.isArray(value))return Promise.all(value.map(item=>hydratePair(item,seen)));
 if(value&&typeof value==='object')return Object.fromEntries(await Promise.all(Object.entries(value).map(async([key,item])=>[key,await hydratePair(item,seen)])));
 return value;
}
export const getScores = () => operation('scores','readonly',s=>s.getAll());
// add(), not put(): an existing blind score cannot be edited by resubmission.
export const addScore = s => operation('scores','readwrite',o=>o.add(s));
export async function prepareForUpdate(){updateBarrier=true;if(activeWrites)await new Promise(resolve=>writeWaiters.push(resolve));await getPairs();await getScores();}
export function cancelUpdatePreparation(){updateBarrier=false;}

