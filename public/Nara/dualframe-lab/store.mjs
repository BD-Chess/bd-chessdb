const DB = 'bd-dualframe-lab-v1';
let connection,updateBarrier=false,activeWrites=0,writeWaiters=[];
export async function openStore() {
  if (connection) return connection;
  connection = await new Promise((resolve,reject) => {
    const request = indexedDB.open(DB,1);
    request.onupgradeneeded = () => { for (const name of ['pairs','scores']) request.result.createObjectStore(name,{keyPath:name === 'pairs' ? 'pair_id' : 'comparison_id'}); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(Error('STORAGE_UNAVAILABLE'));
  });
  return connection;
}
async function operation(store,mode,action) {
  const writing=mode==='readwrite';
  if(writing&&updateBarrier)throw Error('UPDATE_IN_PROGRESS');
  if(writing)activeWrites++;
  try {
  const db = await openStore();
  return await new Promise((resolve,reject) => {
    const tx = db.transaction(store,mode), r = action(tx.objectStore(store));
    let result;
    r.onsuccess = () => { result = r.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(Error('STORAGE_QUOTA_OR_FAILURE'));
    tx.onabort = () => reject(Error('STORAGE_QUOTA_OR_FAILURE'));
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

