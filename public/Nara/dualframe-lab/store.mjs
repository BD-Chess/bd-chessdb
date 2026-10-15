import {MAX_ORIGINALS} from './core.mjs?v=3.0-r4.11';
const DB = 'bd-dualframe-lab-v1';
const LEGACY_OWNER='bd-research-owner',OWNER=/^[a-zA-Z0-9_-]{8,100}$/;
// v3 adds receipts only. Existing pairs/assets remain readable without hydration.
const VERSION=3;
const blobIds=new WeakMap();
const namespaces=new Map();
function namespace(owner){
 const name=owner===LEGACY_OWNER?DB:owner===null?DB+':locked':DB+':owner:'+owner;
 if(!namespaces.has(name))namespaces.set(name,{owner,name,epoch:0,connection:null,opening:null,updateBarrier:false,activeWrites:0,writeWaiters:[]});
 return namespaces.get(name);
}
// The application explicitly selects the verified account or locked namespace.
// Existing phase-A callers retain their legacy database until that selection.
let current=namespace(LEGACY_OWNER),switching=false,switchTail=Promise.resolve();
const context=()=>({scope:current,epoch:current.epoch});
function active(ctx){if(switching||ctx.scope!==current||ctx.epoch!==ctx.scope.epoch)throw Error('STORAGE_OWNER_CHANGED');}
export const storageOwner=()=>current.owner;
function assertReference(value,ctx){
 const scoped=Object.hasOwn(value,'storage_owner');
 if(ctx.scope.owner===LEGACY_OWNER?scoped&&value.storage_owner!==LEGACY_OWNER:!scoped||value.storage_owner!==ctx.scope.owner)throw Error('STORAGE_ASSET_OWNER_MISMATCH');
}
function blobIdentity(blob,ctx){
 const known=blobIds.get(blob);if(known&&known.namespace!==ctx.scope.name)throw Error('STORAGE_ASSET_OWNER_MISMATCH');return known?.id;
}
function validateNamespace(value,ctx,seen=new WeakSet()){
 active(ctx);if(value instanceof Blob){blobIdentity(value,ctx);return;}
 if(isBlobReference(value)){assertReference(value,ctx);return;}
 if(value&&typeof value==='object'&&!seen.has(value)){seen.add(value);for(const item of Object.values(value))validateNamespace(item,ctx,seen);}
}
const reference=(id,blob,ctx)=>({__df_blob:1,id,size:blob.size,type:blob.type,...(ctx.scope.owner===LEGACY_OWNER?{}:{storage_owner:ctx.scope.owner})});
function beginWrite(ctx){active(ctx);if(ctx.scope.updateBarrier)throw Error('UPDATE_IN_PROGRESS');ctx.scope.activeWrites++;}
function endWrite(ctx){if(--ctx.scope.activeWrites===0){for(const resolve of ctx.scope.writeWaiters)resolve();ctx.scope.writeWaiters=[];}}
const writesFinished=scope=>scope.activeWrites?new Promise(resolve=>scope.writeWaiters.push(resolve)):Promise.resolve();
export function setStorageOwner(owner){
 if(owner!==null&&(typeof owner!=='string'||!OWNER.test(owner)))return Promise.reject(Error('STORAGE_OWNER_INVALID'));
 const result=switchTail.catch(()=>{}).then(async()=>{
  if(current.owner===owner)return owner;
  const old=current;switching=true;old.epoch++;
  try{
   // Started transactions finish in the original namespace before it closes.
   await writesFinished(old);await old.opening?.catch(()=>{});
   old.connection?.close();old.connection=null;old.opening=null;
   current=namespace(owner);current.epoch++;return owner;
  }finally{switching=false;}
 });
 switchTail=result;return result;
}
export const isBlobReference=value=>value?.__df_blob===1&&typeof value.id==='string';
function references(value,out=new Set()){
 if(isBlobReference(value))out.add(value.id);
 else if(Array.isArray(value))for(const item of value)references(item,out);
 else if(value&&typeof value==='object'&&!(value instanceof Blob))for(const item of Object.values(value))references(item,out);
 return out;
}
// Blob bytes move into a separate store. The original hash and every other field survive.
function separate(value,pairId,assets,ctx,seen=new Map()){
 if(value instanceof Blob){
  if(seen.has(value))return seen.get(value);
  const existing=blobIdentity(value,ctx),id=existing||pairId+':'+crypto.randomUUID();
  if(!id.startsWith(pairId+':'))throw Error('STORAGE_ASSET_OWNER_MISMATCH');
  const ref=reference(id,value,ctx);seen.set(value,ref);
  if(!blobIds.has(value))assets.set(id,value);
  return ref;
 }
 if(isBlobReference(value)){
  assertReference(value,ctx);
  if(!value.id.startsWith(pairId+':'))throw Error('STORAGE_ASSET_OWNER_MISMATCH');
  return {...value};
 }
 if(Array.isArray(value))return value.map(item=>separate(item,pairId,assets,ctx,seen));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,separate(item,pairId,assets,ctx,seen)]));
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
async function openFor(ctx) {
  active(ctx);const scope=ctx.scope;
  if(scope.connection)return scope.connection;
  if(!scope.opening)scope.opening=new Promise((resolve,reject) => {
    const request = indexedDB.open(scope.name,VERSION);
    request.onupgradeneeded = event => {
      const db=request.result,tx=request.transaction;
      for (const name of ['pairs','scores'])if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:name === 'pairs' ? 'pair_id' : 'comparison_id'});
      if(!db.objectStoreNames.contains('sync'))db.createObjectStore('sync');
      const assets=db.objectStoreNames.contains('assets')?tx.objectStore('assets'):db.createObjectStore('assets');
      if(event.oldVersion>=2)return;
      const cursor=tx.objectStore('pairs').openCursor();
      // One legacy pair at a time; upgrade transaction rolls everything back on failure.
      cursor.onsuccess=()=>{const row=cursor.result;if(!row)return;try{
        const writes=new Map(),meta=separate(row.value,row.value.pair_id,writes,ctx);
        for(const [id,blob] of writes)assets.put(blob,id);
        row.update(meta);row.continue();
      }catch{tx.abort();}};
    };
    request.onsuccess = () => {const db=request.result;scope.connection=db;db.onversionchange=()=>{db.close();if(scope.connection===db)scope.connection=null;};resolve(db);};
    request.onerror = () => reject(storageError(request.error));
    request.onblocked = () => reject(Error('STORAGE_DB_BLOCKED'));
  }).finally(()=>{scope.opening=null;});
  const db=await scope.opening;active(ctx);return db;
}
export const openStore=()=>openFor(context());
async function operation(store,mode,action,ctx=context()) {
  active(ctx);
  const writing=mode==='readwrite';
  if(writing)beginWrite(ctx);
  try {
  const db = await openFor(ctx);active(ctx);
  const value=await new Promise((resolve,reject) => {
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
  active(ctx);return value;
  } finally { if(writing)endWrite(ctx); }
}
async function writePair(pair,id=pair?.pair_id,ctx=context(),limitOriginals=false){
 beginWrite(ctx);
 try{
  const db=await openFor(ctx);active(ctx);const writes=new Map();let meta=typeof pair==='function'?null:pair?separate(pair,id,writes,ctx):null,keep=references(meta);
  await new Promise((resolve,reject)=>{
   const tx=db.transaction(['pairs','assets'],'readwrite'),pairs=tx.objectStore('pairs'),assets=tx.objectStore('assets');
   tx.oncomplete=()=>{for(const [key,blob] of writes)blobIds.set(blob,{id:key,namespace:ctx.scope.name});resolve();};
   let validationError=null;
   tx.onabort=tx.onerror=()=>reject(validationError||storageError(tx.error||{name:'AbortError'}));
   const old=pairs.get(id);old.onsuccess=()=>{
    if(typeof pair==='function')try{const value=pair(old.result);meta=value?separate(value,id,writes,ctx):null;keep=references(meta);}catch{tx.abort();return;}
    const commit=()=>{
    for(const key of references(old.result))if(!keep.has(key))assets.delete(key);
    for(const [key,blob] of writes)assets.put(blob,key);
    // Missing asset references abort, preserving the old pair and its image bytes.
    for(const key of keep)if(!writes.has(key)){const request=assets.getKey(key);request.onsuccess=()=>{if(request.result===undefined)tx.abort();};}
    if(meta)pairs.put(meta);else pairs.delete(id);
    };
    if(limitOriginals&&meta&&meta.original?.sha256!==old.result?.original?.sha256){
     const all=pairs.getAll();all.onsuccess=()=>{const hashes=new Set(all.result.filter(p=>p.pair_id!==id).map(p=>p.original?.sha256).filter(Boolean));if(!hashes.has(meta.original?.sha256)&&hashes.size>=MAX_ORIGINALS){validationError=Error('PAIR_LIMIT');tx.abort();}else commit();};
    }else commit();
   };
  });
  active(ctx);return meta;
 }finally{endWrite(ctx);}
}
export const putPair = p => writePair(p);
// New local imports enforce the gallery cap atomically. Recovery/Sync keeps
// every historical cloud record, including larger pre-existing libraries.
export const putOriginal = p => writePair(p,p?.pair_id,context(),true);
export const updatePair = (id,updater) => writePair(updater,id);
export const removePair = id => writePair(null,id);
export const getPairs = () => operation('pairs','readonly',s=>s.getAll());
export const getPair = id => operation('pairs','readonly',s=>s.get(id));
export const getSyncState = key => operation('sync','readonly',s=>s.get(key));
async function syncStateWrite(key,value,ctx=context()){validateNamespace(value,ctx);return operation('sync','readwrite',s=>s.put(value,key),ctx);}
export const putSyncState = (key,value) => syncStateWrite(key,value);
// Each verified remote asset is committed independently. A failed later variant
// therefore cannot roll back the original or force it to transfer on reload.
async function putSyncAssetFor(key,pairId,blob,metadata={},ctx=context()){
 if(!(blob instanceof Blob))throw Error('STORAGE_ASSET_INVALID');
 blobIdentity(blob,ctx);beginWrite(ctx);
 try{
  const db=await openFor(ctx);active(ctx);const id=pairId+':sync:'+key,ref=reference(id,blob,ctx),receipt={...metadata,blob:ref};
  await new Promise((resolve,reject)=>{
   const tx=db.transaction(['assets','sync'],'readwrite');
   tx.objectStore('assets').put(blob,id);tx.objectStore('sync').put(receipt,key);
   tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(storageError(tx.error||{name:'AbortError'}));
  });blobIds.set(blob,{id,namespace:ctx.scope.name});active(ctx);return receipt;
 }finally{endWrite(ctx);}
}
export const putSyncAsset=(key,pairId,blob,metadata={})=>putSyncAssetFor(key,pairId,blob,metadata);
async function getStoredBlobFor(value,ctx=context()){
 active(ctx);if(value instanceof Blob){blobIdentity(value,ctx);return value;}
 if(!isBlobReference(value))return null;
 assertReference(value,ctx);
 const blob=await operation('assets','readonly',s=>s.get(value.id),ctx);
 if(!(blob instanceof Blob)||blob.size!==value.size||blob.type!==value.type)throw Error('STORAGE_ASSET_MISSING');
 blobIds.set(blob,{id:value.id,namespace:ctx.scope.name});return blob;
}
export const getStoredBlob=value=>getStoredBlobFor(value);
export function hasStoredBlobs(value){
 if(isBlobReference(value))return true;
 if(value instanceof Blob)return false;
 if(Array.isArray(value))return value.some(hasStoredBlobs);
 return value&&typeof value==='object'?Object.values(value).some(hasStoredBlobs):false;
}
async function hydratePairFor(value,seen=new Map(),ctx=context()){
 active(ctx);
 if(!hasStoredBlobs(value))return value;
 if(isBlobReference(value)){if(!seen.has(value.id))seen.set(value.id,getStoredBlobFor(value,ctx));return seen.get(value.id);}
 if(value instanceof Blob)return value;
 if(Array.isArray(value))return Promise.all(value.map(item=>hydratePairFor(item,seen,ctx)));
 if(value&&typeof value==='object')return Object.fromEntries(await Promise.all(Object.entries(value).map(async([key,item])=>[key,await hydratePairFor(item,seen,ctx)])));
 return value;
}
async function hydrateIn(value,seen=new Map(),ctx=context()){validateNamespace(value,ctx);return hydratePairFor(value,seen,ctx);}
export const hydratePair=(value,seen=new Map())=>hydrateIn(value,seen);
export const getScores = () => operation('scores','readonly',s=>s.getAll());
// add(), not put(): an existing blind score cannot be edited by resubmission.
export const addScore = s => operation('scores','readwrite',o=>o.add(s));
async function prepareForUpdateIn(ctx=context()){active(ctx);ctx.scope.updateBarrier=true;await writesFinished(ctx.scope);active(ctx);await operation('pairs','readonly',s=>s.getAll(),ctx);await operation('scores','readonly',s=>s.getAll(),ctx);}
export const prepareForUpdate=()=>prepareForUpdateIn();
export function cancelUpdatePreparation(){const ctx=context();active(ctx);ctx.scope.updateBarrier=false;}
// A network task retains this facade across awaits. Its old epoch remains
// invalid after switching accounts, including switching back to the same user.
export function captureStorageScope(){
 const ctx=context();active(ctx);
 return Object.freeze({
  storageOwner:()=>ctx.scope.owner,isBlobReference,hasStoredBlobs,storageErrorCode,storageEstimate,
  openStore:()=>openFor(ctx),getPairs:()=>operation('pairs','readonly',s=>s.getAll(),ctx),getPair:id=>operation('pairs','readonly',s=>s.get(id),ctx),
  putPair:pair=>writePair(pair,pair?.pair_id,ctx),putOriginal:pair=>writePair(pair,pair?.pair_id,ctx,true),updatePair:(id,updater)=>writePair(updater,id,ctx),removePair:id=>writePair(null,id,ctx),
  getSyncState:key=>operation('sync','readonly',s=>s.get(key),ctx),putSyncState:(key,value)=>syncStateWrite(key,value,ctx),
  putSyncAsset:(key,pairId,blob,metadata={})=>putSyncAssetFor(key,pairId,blob,metadata,ctx),getStoredBlob:value=>getStoredBlobFor(value,ctx),hydratePair:(value,seen=new Map())=>hydrateIn(value,seen,ctx),
  getScores:()=>operation('scores','readonly',s=>s.getAll(),ctx),addScore:score=>operation('scores','readwrite',s=>s.add(score),ctx),
  prepareForUpdate:()=>prepareForUpdateIn(ctx),cancelUpdatePreparation:()=>{active(ctx);ctx.scope.updateBarrier=false;}
 });
}

