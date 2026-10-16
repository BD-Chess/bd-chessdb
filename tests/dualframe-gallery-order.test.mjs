import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {orderedGallery,moveGallery,mergeGalleryOrder} from '../public/Nara/dualframe-lab/gallery-order.mjs';
if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const ids=rows=>rows.map(row=>row.pair_id),sha=async blob=>createHash('sha256').update(Buffer.from(await blob.arrayBuffer())).digest('hex');
const row=id=>({pair_id:id,original:{sha256:id.padEnd(64,'0')}});
const base=['photo_a','photo_b','photo_c','photo_d'].map(row);
test('all four photo moves preserve every identity and disable no-op boundaries',()=>{
 for(const [action,id,expected] of [['up','photo_c',['photo_a','photo_c','photo_b','photo_d']],['down','photo_b',['photo_a','photo_c','photo_b','photo_d']],['top','photo_d',['photo_d','photo_a','photo_b','photo_c']],['bottom','photo_a',['photo_b','photo_c','photo_d','photo_a']]]){
  const moved=moveGallery(base,id,action);assert.deepEqual(ids(moved),expected);assert.deepEqual([...ids(moved)].sort(),ids(base));assert.equal(base[0].pair_id,'photo_a');
 }
 assert.deepEqual(ids(moveGallery(base,'photo_a','up')),ids(base));assert.deepEqual(ids(moveGallery(base,'photo_d','bottom')),ids(base));
 assert.throws(()=>moveGallery(base,'photo_a','invalid'),/GALLERY_MOVE_INVALID/);
});
test('favorite-filter moves skip hidden photos and preserve their relative order',()=>{
 const visibleIds=['photo_a','photo_c'];assert.deepEqual(ids(moveGallery(base,'photo_c','up',{visibleIds})),['photo_c','photo_a','photo_b','photo_d']);
 assert.deepEqual(ids(moveGallery(base,'photo_a','bottom',{visibleIds})),['photo_b','photo_c','photo_a','photo_d']);
 assert.deepEqual(ids(moveGallery(base,'photo_b','top',{visibleIds})),ids(base));
});
test('reordered photos remain deterministic across device identities; unseen imports append',()=>{
 const order=(position,clock=100,event_id='event_1234')=>({version:1,position,clock,event_id});
 const rows=[{...row('local_b'),original:{sha256:'b'},gallery_order:order(0)},{...row('local_a'),original:{sha256:'a'},gallery_order:order(0)},row('new_photo')];
 assert.deepEqual(ids(orderedGallery(rows)),['local_a','local_b','new_photo']);
 assert.deepEqual(ids(orderedGallery([row('a'),row('b')],['b','a'])),['b','a']);
});
test('order snapshots merge commutatively and older snapshots cannot undo a newer move',()=>{
 const old={version:1,position:0,clock:100,event_id:'event_old'},fresh={version:1,position:3,clock:101,event_id:'event_new'},tie={...fresh,event_id:'zzzz_event'};
 for(const [a,b] of [[old,fresh],[fresh,tie],[{...fresh,position:8},fresh]])assert.deepEqual(mergeGalleryOrder(a,b),mergeGalleryOrder(b,a));
 assert.deepEqual(mergeGalleryOrder(fresh,old),fresh);assert.deepEqual(mergeGalleryOrder(old,fresh),fresh);
 for(const invalid of [null,{...old,position:NaN},{...old,position:-1},{...old,clock:Infinity},{...old,event_id:'bad!'}])assert.deepEqual(mergeGalleryOrder(invalid,fresh),fresh);
});
async function fixture(){
 globalThis.indexedDB=new IDBFactory();const store=await import('../public/Nara/dualframe-lab/store.mjs?order='+crypto.randomUUID());await store.openStore();
 for(const item of base){const blob=new Blob(['original-'+item.pair_id],{type:'image/png'});await store.putPair({...item,display_name:'Name '+item.pair_id,favorite:true,original:{...item.original,sha256:await sha(blob),blob,normalized:blob},variants:{portrait:{},landscape:{}},jobs:[]});}
 return store;
}
async function hashes(store){return Promise.all((await store.getPairs()).map(async pair=>({id:pair.pair_id,hash:await sha(await store.getStoredBlob(pair.original.blob)),ref:pair.original.blob.id})));}
test('atomic IndexedDB move survives reload and never reads or rewrites image bytes',async()=>{
 const store=await fixture(),before=await hashes(store),db=await store.openStore();
 const moved=await store.movePair('photo_d','top',{baselineIds:ids(base)});assert.deepEqual(ids(moved),['photo_d','photo_a','photo_b','photo_c']);assert.deepEqual(await hashes(store),before);
 const reopened=await import('../public/Nara/dualframe-lab/store.mjs?reopen='+crypto.randomUUID());assert.deepEqual(ids(orderedGallery(await reopened.getPairs())),ids(moved));assert.equal((await reopened.openStore()).version,3);assert.equal(db.name,'bd-dualframe-lab-v1');
 assert.ok((await reopened.getPairs()).every(pair=>pair.favorite&&pair.display_name==='Name '+pair.pair_id));
});
test('failed ordering commit rolls back every rank and original; subsequent retry works',async()=>{
 const store=await fixture(),before=await store.getPairs(),raw=await hashes(store),put=IDBObjectStore.prototype.put;let writes=0;
 IDBObjectStore.prototype.put=function(value,...args){if(this.name==='pairs'&&value.gallery_order&&++writes===2)throw new DOMException('synthetic quota fixture','QuotaExceededError');return put.call(this,value,...args);};
 try{await assert.rejects(store.movePair('photo_a','bottom'),/STORAGE_QUOTA_EXCEEDED/);}finally{IDBObjectStore.prototype.put=put;}
 assert.deepEqual(await store.getPairs(),before);assert.deepEqual(await hashes(store),raw);assert.equal(ids(await store.movePair('photo_a','bottom')).at(-1),'photo_a');
});
test('concurrent rename and new variant survive ordering, and old owner scopes cannot write',async()=>{
 const store=await fixture();await Promise.all([store.updatePair('photo_b',pair=>({...pair,display_name:'Concurrent rename',title_sync_pending:true,variants:{portrait:{hd:{sha256:'a'.repeat(64),blob:pair.original.blob}},landscape:{}}})),store.movePair('photo_b','top')]);
 const pair=await store.getPair('photo_b');assert.equal(pair.display_name,'Concurrent rename');assert.equal(pair.title_sync_pending,true);assert.equal(pair.variants.portrait.hd.sha256,'a'.repeat(64));assert.equal(orderedGallery(await store.getPairs())[0].pair_id,'photo_b');
 const scope=store.captureStorageScope();await store.setStorageOwner(null);await assert.rejects(scope.movePair('photo_b','bottom'),/STORAGE_OWNER_CHANGED/);assert.deepEqual(await store.getPairs(),[]);
});
