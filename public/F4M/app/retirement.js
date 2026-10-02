/* Flip4M retired APP route: migrate only into an empty unified destination; never overwrite. */
(() => {'use strict';
const OLD='flip4m-app-2.2',DEST='flip4m-unified-2.6',KEY='checkpoint',MIG='flip4m.app.retired.2.6.migration',$=id=>document.getElementById(id),cl=x=>JSON.parse(JSON.stringify(x));
function openNamed(name,create){return new Promise((resolve,reject)=>{let fresh=false;const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{fresh=true;if(create&&!r.result.objectStoreNames.contains('state'))r.result.createObjectStore('state');else if(!create)r.transaction.abort();};r.onsuccess=()=>resolve({db:r.result,fresh});r.onerror=()=>{if(!create&&fresh&&r.error?.name==='AbortError')resolve(null);else reject(r.error);};r.onblocked=()=>reject(Error('Storage blocked'));});}
function all(db){return new Promise((resolve,reject)=>{if(!db.objectStoreNames.contains('state'))return resolve([]);const out=[],r=db.transaction('state').objectStore('state').openCursor();r.onsuccess=()=>{const c=r.result;if(!c)return resolve(out);out.push([c.key,c.value]);c.continue();};r.onerror=()=>reject(r.error);});}
function fallback(name){try{return JSON.parse(localStorage.getItem(name)||'null');}catch(_){return null;}}
async function snapshot(name,create=false){let entries=[],db=null;try{const x=await openNamed(name,create);if(x){db=x.db;entries=await all(db);}}catch(_){}const checkpoint=entries.find(x=>x[0]===KEY)?.[1]||null,fb=fallback(name),primary=fb&&(!checkpoint||String(fb.savedAt||'')>String(checkpoint.savedAt||''))?fb:checkpoint;return{name,entries,primary,fallback:fb,db};}
async function migrate(){
 const source=await snapshot(OLD,false),dest=await snapshot(DEST,true);
 try{
  if(!source.primary)return{status:'no-legacy',source,dest};
  if(dest.entries.length||dest.primary)return{status:'preserved-conflict',source,dest};
  await new Promise((resolve,reject)=>{const tx=dest.db.transaction('state','readwrite'),s=tx.objectStore('state');for(const [k,v] of source.entries)s.put(cl(v),k);s.put(cl(source.primary),KEY);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Migration aborted'));});
  if(source.fallback===source.primary)try{localStorage.setItem(DEST,JSON.stringify(source.primary));}catch(_){}
  try{if(!localStorage.getItem('flip4m.unified.2.6.preferences')){const p=localStorage.getItem('flip4m.app.2.2.preferences');if(p)localStorage.setItem('flip4m.unified.2.6.preferences',p);}localStorage.setItem(MIG,JSON.stringify({status:'copied',legacy_preserved:true,at:new Date().toISOString()}));}catch(_){}
  return{status:'copied',source,dest};
 }finally{source.db?.close();dest.db?.close();}
}
async function exportLegacy(){
 const s=await snapshot(OLD,false);try{if(!s.primary)throw Error('No legacy APP save found');const map=new Map(s.entries),data=cl(s.primary);async function hydrate(b){if(!b)return;for(let i=0;i<(b.runs||[]).length;i++)if(b.runs[i]?.storeRef){const v=map.get(b.runs[i].storeRef);if(v)b.runs[i]=v;}}await hydrate(data.batch);for(const b of data.pastBatches||[])await hydrate(b);const payload={...data,recovery:{source:OLD,exportedAt:new Date().toISOString(),route:location.href}};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));a.download='Flip4M_APP_legacy_recovery.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);$('status').textContent='Legacy APP save exported. / Stari APP save je izvožen.';}finally{s.db?.close();}}
$('openUnified').onclick=()=>location.href='../new/?view=app';$('exportLegacy').onclick=()=>exportLegacy().catch(e=>$('status').textContent=e.message);
if('serviceWorker'in navigator&&isSecureContext){navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='PAGE_BUILD')e.ports[0]?.postMessage({build:'retired-2.6.0'});});navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).catch(()=>{});}
(async()=>{try{const r=await migrate();$('status').textContent=r.status==='copied'?'Old APP save copied safely; original preserved. / Stari APP save varno kopiran; original ostaja.':r.status==='preserved-conflict'?'Unified save already exists; old APP save was NOT overwritten and remains recoverable. / Unified save že obstaja; stari APP ni bil prepisan.':'No old APP save found. / Stari APP save ni najden.';if(new URLSearchParams(location.search).get('recovery')!=='1')setTimeout(()=>location.replace('../new/?view=app'),550);}catch(e){$('status').textContent='Migration stopped safely: '+e.message;}})();
})();
