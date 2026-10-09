/* Durable per-run storage for the promoted primary Flip4M game.
 * Separate namespace from /f4m/new/ so future experiments cannot overwrite
 * the primary game's local checkpoint. IndexedDB failures fall back explicitly.
 */
(function(root){'use strict';
const NAME='flip4m-primary-2.1',KEY='checkpoint',cl=x=>JSON.parse(JSON.stringify(x));let dbPromise=null,queue=Promise.resolve();const saved=new Map();
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

/* Route-only navigation patch for the promoted /f4m/ primary. */
function patchPrimaryRoutes(){
 const nav=document.querySelector('.topbar nav');if(!nav)return;
 const about=nav.querySelector('a[data-i18n="about"]');if(about)about.href='/f4m/f4m/';
 const lab=nav.querySelector('a[data-i18n="previewGame"]');
 if(lab){lab.href='/f4m/new/';lab.removeAttribute('data-i18n');lab.textContent='🧪 Lab';}
 if(!nav.querySelector('a[data-primary-old]')){const old=document.createElement('a');old.href='/f4m/old/';old.dataset.primaryOld='1';old.textContent='↔ Stara / Old';nav.insertBefore(old,lab||nav.querySelector('button'));}
 const p=document.querySelector('[data-i18n="longThinkNote"]');if(p){p.removeAttribute('data-i18n');p.textContent='Velemojster/Grandmaster: do 60 s; Prvak/Champion: do 120 s. Zgodnje in enostavne pozicije dobijo manj časa; kompleksne lahko porabijo celoten maksimum.';}
}
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',()=>setTimeout(patchPrimaryRoutes,0));
})(globalThis);
