/* Durable per-run storage: large finished experiments are not rewritten each ply.
 * Only the active game and checkpoint metadata are written on ordinary moves.
 * IndexedDB failures use an explicit localStorage fallback, never a false saved status.
 */
(function(root){'use strict';
const NAME='flip4m-lab-2.1',KEY='checkpoint',cl=x=>JSON.parse(JSON.stringify(x));let dbPromise=null,queue=Promise.resolve();const saved=new Map();
function open(){if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open(NAME,1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Storage blocked'));});return dbPromise;}
function get(db,key){return new Promise((resolve,reject)=>{const r=db.transaction('state').objectStore('state').get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}
async function read(){
 let db;try{db=await open();}catch(_){try{return JSON.parse(localStorage.getItem(NAME)||'null');}catch(_){return null;}}
 const data=await get(db,KEY);if(!data)return null;
 async function hydrate(b){if(!b)return;for(let i=0;i<b.runs.length;i++)if(b.runs[i]?.storeRef){const r=await get(db,b.runs[i].storeRef);if(!r)throw Error('Missing saved run '+b.runs[i].storeRef);b.runs[i]=r;}}
 await hydrate(data.batch);for(const b of data.pastBatches||[])await hydrate(b);return data;
}
function write(value){
 const writes=[],pack=b=>{if(!b)return b;const runs=b.runs.map(r=>{const key='run:'+b.instanceId+':'+r.index,signature=r.trace.length+':'+(r.trace.at(-1)?.presentation_ms||0);if(saved.get(key)!==signature)writes.push({key,signature,data:cl(r)});return {storeRef:key};});return {...b,runs};};
 const lightweight=cl({...value,batch:pack(value.batch),pastBatches:(value.pastBatches||[]).map(pack)});
 const task=async()=>{try{const db=await open();await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite'),s=tx.objectStore('state');for(const w of writes)s.put(w.data,w.key);s.put(lightweight,KEY);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Storage aborted'));});for(const w of writes)saved.set(w.key,w.signature);return 'indexeddb';}catch(_){try{localStorage.setItem(NAME,JSON.stringify(value));return 'localstorage';}catch(_){return 'unavailable';}}};
 queue=queue.catch(()=>{}).then(task);return queue;
}
async function quarantine(){try{const db=await open(),raw=await get(db,KEY);if(raw)await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put(raw,'recovery:'+new Date().toISOString());tx.oncomplete=resolve;tx.onerror=reject;});}catch(_){try{const raw=localStorage.getItem(NAME);if(raw)localStorage.setItem(NAME+'.recovery.'+Date.now(),raw);}catch(_){}}}
root.F4MStore={read,write,quarantine,flush:()=>queue};
})(globalThis);
