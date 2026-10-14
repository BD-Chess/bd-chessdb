// Browser-local IndexedDB. Errors must not be mistaken for free-disk exhaustion.
const DB = 'bd-dualframe-lab-v1';
let connection,updateBarrier=false,activeWrites=0,writeWaiters=[];
export function storageError(error,writing=false){
 const name=error?.name||'UnknownError';
 if(name==='QuotaExceededError')return Error('STORAGE_QUOTA_EXCEEDED');
 if(name==='AbortError')return Error('STORAGE_TRANSACTION_ABORTED');
 if(name==='InvalidStateError'||name==='NotFoundError'||name==='VersionError'||name==='UnknownError')return Error('STORAGE_DATABASE_ERROR');
 if(name==='SecurityError'||name==='NotAllowedError')return Error('STORAGE_ACCESS_DENIED');
 return Error(writing?'STORAGE_WRITE_FAILURE':'STORAGE_READ_FAILURE');
}
export async function openStore() {
 if(connection)return connection;
 connection=await new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB,1);
  request.onupgradeneeded=()=>{for(const name of ['pairs','scores'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name,{keyPath:name==='pairs'?'pair_id':'comparison_id'});};
  request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();connection=null;};resolve(db);};
  request.onerror=()=>reject(storageError(request.error));
  request.onblocked=()=>reject(Error('STORAGE_DATABASE_BLOCKED'));
 });
 return connection;
}
async function operation(store,mode,action){
 const writing=mode==='readwrite';
 if(writing&&updateBarrier)throw Error('UPDATE_IN_PROGRESS');
 if(writing)activeWrites++;
 try{
  const db=await openStore();
  return await new Promise((resolve,reject)=>{
   let tx,request,settled=false;
   const rejectOnce=(error)=>{if(!settled){settled=true;reject(storageError(error,writing));}};
   try{tx=db.transaction(store,mode);request=action(tx.objectStore(store));}
   catch(error){return rejectOnce(error);}
   let result;
   request.onsuccess=()=>{result=request.result;};
   request.onerror=()=>{ /* A transaction abort is still authoritative; preserve request reason. */ };
   tx.oncomplete=()=>{if(!settled){settled=true;resolve(result);}};
   tx.onerror=()=>rejectOnce(tx.error||request.error);
   tx.onabort=()=>rejectOnce(tx.error||request.error||{name:'AbortError'});
  });
 }finally{if(writing){activeWrites--;if(activeWrites===0){for(const resolve of writeWaiters)resolve();writeWaiters=[];}}}
}
export const putPair=p=>operation('pairs','readwrite',s=>s.put(p));
export const removePair=id=>operation('pairs','readwrite',s=>s.delete(id));
export const getPairs=()=>operation('pairs','readonly',s=>s.getAll());
export const getScores=()=>operation('scores','readonly',s=>s.getAll());
export const addScore=s=>operation('scores','readwrite',o=>o.add(s));
export async function storageEstimate(){
 if(!navigator?.storage?.estimate)return {supported:false,usage:null,quota:null};
 try{const result=await navigator.storage.estimate();return {supported:true,usage:Number.isFinite(result.usage)?result.usage:null,quota:Number.isFinite(result.quota)?result.quota:null};}
 catch{return {supported:false,usage:null,quota:null};}
}
export async function prepareForUpdate(){updateBarrier=true;if(activeWrites)await new Promise(resolve=>writeWaiters.push(resolve));await getPairs();await getScores();}
export function cancelUpdatePreparation(){updateBarrier=false;}
