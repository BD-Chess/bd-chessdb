import test from 'node:test';
import assert from 'node:assert/strict';
import {indexedDB} from 'fake-indexeddb';
import {createHash} from 'node:crypto';
import {createImageLoader} from '../public/Nara/dualframe-lab/image-loader.mjs';
globalThis.indexedDB=indexedDB;
const digest=async b=>createHash('sha256').update(Buffer.from(await b.arrayBuffer())).digest('hex');
let store,originalHash;
test('v1 migration preserves exact original, normalized and candidate bytes, but reads metadata only',async()=>{
 const source=new Blob(['unaltered original'],{type:'image/png'}),normalized=new Blob(['normalized'],{type:'image/png'}),candidate=new Blob(['candidate'],{type:'image/webp'});
 originalHash=await digest(source);
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('bd-dualframe-lab-v1',1);r.onupgradeneeded=()=>{r.result.createObjectStore('pairs',{keyPath:'pair_id'});r.result.createObjectStore('scores',{keyPath:'comparison_id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 await new Promise((resolve,reject)=>{const tx=db.transaction(['pairs','scores'],'readwrite');tx.objectStore('pairs').put({pair_id:'df_original',original:{sha256:originalHash,blob:source,normalized},variants:{landscape:{hd:{blob:normalized}},portrait:{hd:{blob:candidate}}},jobs:[{job_id:'ready',candidate:{blob:candidate}}],candidates:[{blob:candidate}],display_name:'BD image'});tx.objectStore('scores').put({comparison_id:'locked',locked:true});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});db.close();
 store=await import('../public/Nara/dualframe-lab/store.mjs');
 const [meta]=await store.getPairs();assert.equal(meta.original.blob instanceof Blob,false);assert.ok(store.isBlobReference(meta.original.blob));
 const full=await store.hydratePair(meta);assert.equal(await digest(full.original.blob),originalHash);assert.equal(await full.original.normalized.text(),'normalized');assert.equal(await full.jobs[0].candidate.blob.text(),'candidate');assert.equal(await full.candidates[0].blob.text(),'candidate');assert.equal((await store.getScores())[0].locked,true);
});
test('metadata rename and cloud fields preserve images without reading the asset store',async()=>{
 const [meta]=await store.getPairs();meta.display_name='new name';meta.upload_id='remote';
 const db=await store.openStore(),native=db.transaction.bind(db),reads=[];db.transaction=(names,...rest)=>{reads.push(names);return native(names,...rest);};
 await store.putPair(meta);const [after]=await store.getPairs();db.transaction=native;
 assert.equal(after.display_name,'new name');assert.equal(after.upload_id,'remote');assert.equal(await digest(await store.getStoredBlob(after.original.blob)),originalHash);
 assert.ok(reads.filter(x=>x==='pairs').length>0);assert.ok(reads.every(x=>x!=='assets'));
});
test('dangling references abort atomically and keep the previous image',async()=>{
 const [meta]=await store.getPairs();meta.display_name='must rollback';meta.original.blob={...meta.original.blob,id:'df_original:missing'};
 await assert.rejects(store.putPair(meta));const [after]=await store.getPairs();assert.equal(after.display_name,'new name');assert.equal(await digest(await store.getStoredBlob(after.original.blob)),originalHash);
});
test('updated images, re-save and explicit export hydration retain exact bytes and deduplicate shared blobs',async()=>{
 const [meta]=await store.getPairs(),full=await store.hydratePair(meta),replacement=new Blob(['new candidate'],{type:'image/png'});
 full.variants.portrait.hd.blob=replacement;full.candidates.push({blob:replacement});await store.putPair(full);
 const [after]=await store.getPairs();assert.equal(after.variants.portrait.hd.blob.id,after.candidates.at(-1).blob.id);
 const exported=await store.hydratePair(after);await store.putPair(exported);
 assert.equal((await store.getPairs())[0].original.blob.id,after.original.blob.id);assert.equal(await exported.variants.portrait.hd.blob.text(),'new candidate');
 await store.prepareForUpdate();await assert.rejects(store.putPair(after),/UPDATE_IN_PROGRESS/);store.cancelUpdatePreparation();
});
test('deleting a pair releases only its owned assets and preserves locked scores',async()=>{
 const [meta]=await store.getPairs();await store.removePair(meta.pair_id);assert.deepEqual(await store.getPairs(),[]);await assert.rejects(store.getStoredBlob(meta.original.blob),/STORAGE_ASSET_MISSING/);assert.equal((await store.getScores())[0].locked,true);
});
test('visible image loads on demand; leaving the viewport revokes its URL and permits reload',async()=>{
 let observer,reads=0,revoked=[];class Observer{constructor(fn){this.fn=fn;observer=this;}observe(){}unobserve(){}}
 const img={isConnected:true,src:'',removeAttribute(){this.src='';}},loader=createImageLoader({Observer,readBlob:async()=>{reads++;return new Blob(['image']);},URLClass:{createObjectURL:()=>`blob:${reads}`,revokeObjectURL:x=>revoked.push(x)}});
 await loader.bind(img,{blob:{id:'one'}});assert.equal(reads,0);observer.fn([{target:img,isIntersecting:true}]);await new Promise(r=>setImmediate(r));assert.equal(img.src,'blob:1');
 observer.fn([{target:img,isIntersecting:false}]);assert.deepEqual(revoked,['blob:1']);assert.equal(img.src,'');observer.fn([{target:img,isIntersecting:true}]);await new Promise(r=>setImmediate(r));assert.equal(reads,2);
 img.isConnected=false;loader.sweep();assert.equal(loader.size,0);assert.deepEqual(revoked,['blob:1','blob:2']);
});
test('slow obsolete image cannot overwrite a newer selection or recreate a URL after close',async()=>{
 const pending=new Map(),revoked=[];let made=0;const img={isConnected:true,src:'',removeAttribute(){this.src='';}},loader=createImageLoader({Observer:null,readBlob:x=>new Promise(r=>pending.set(x.id,r)),URLClass:{createObjectURL:()=>`blob:${++made}`,revokeObjectURL:x=>revoked.push(x)}});
 const old=loader.bind(img,{blob:{id:'old'}},false,true),next=loader.bind(img,{blob:{id:'new'}},false,true);
 pending.get('new')(new Blob(['new']));await next;pending.get('old')(new Blob(['old']));await old;assert.equal(img.src,'blob:1');assert.equal(made,1);
 const late=loader.bind(img,{blob:{id:'late'}},false,true);loader.clear();pending.get('late')(new Blob(['late']));await late;assert.equal(img.src,'');assert.equal(made,1);assert.deepEqual(revoked,['blob:1']);
});
