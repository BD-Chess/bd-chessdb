const DB = 'bd-dualframe-lab-v1';
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
    const request = indexedDB.open(DB,1);
    request.onupgradeneeded = () => { for (const name of ['pairs','scores']) request.result.createObjectStore(name,{keyPath:name === 'pairs' ? 'pair_id' : 'comparison_id'}); };
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
export const putPair = p => operation('pairs','readwrite',s=>s.put(p));
export const removePair = id => operation('pairs','readwrite',s=>s.delete(id));
export const getPairs = () => operation('pairs','readonly',s=>s.getAll());
export const getScores = () => operation('scores','readonly',s=>s.getAll());
// add(), not put(): an existing blind score cannot be edited by resubmission.
export const addScore = s => operation('scores','readwrite',o=>o.add(s));
export async function prepareForUpdate(){updateBarrier=true;if(activeWrites)await new Promise(resolve=>writeWaiters.push(resolve));await getPairs();await getScores();}
export function cancelUpdatePreparation(){updateBarrier=false;}

