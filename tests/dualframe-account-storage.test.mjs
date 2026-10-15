import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {IDBFactory} from 'fake-indexeddb';

const A='verified_account_A',B='verified_account_B',LEGACY='bd-research-owner';
const hash=async blob=>createHash('sha256').update(Buffer.from(await blob.arrayBuffer())).digest('hex');
async function fresh(){globalThis.indexedDB=new IDBFactory();return import('../public/Nara/dualframe-lab/store.mjs?account-test='+crypto.randomUUID());}
async function pair(text,id='same_pair_id'){
 const blob=new Blob([text],{type:'image/png'});
 return {pair_id:id,original:{sha256:await hash(blob),blob,normalized:blob},variants:{landscape:{},portrait:{}},jobs:[]};
}

test('verified owners, locked state and legacy records use separate persistent databases without reassignment',async()=>{
 const disk=await fresh(),legacy=await pair('legacy raw original');await disk.putPair(legacy);await disk.putSyncState('queue',{owner:'legacy',pending:true});
 assert.equal(disk.storageOwner(),LEGACY);assert.equal((await disk.openStore()).name,'bd-dualframe-lab-v1');
 const legacyRef=(await disk.getPairs())[0].original.blob;assert.equal(Object.hasOwn(legacyRef,'storage_owner'),false);
 await disk.setStorageOwner(A);assert.deepEqual(await disk.getPairs(),[]);assert.equal(await disk.getSyncState('queue'),undefined);
 const originalA=await pair('account A exact raw bytes');await disk.putPair(originalA);await disk.putSyncState('queue',{owner:A,pending:true});await disk.addScore({comparison_id:'same_score',owner:A});
 const aRef=(await disk.getPairs())[0].original.blob,aDB=(await disk.openStore()).name;assert.equal(aRef.storage_owner,A);
 const aHydrated=await disk.getStoredBlob(aRef),aFull=await disk.hydratePair((await disk.getPairs())[0]);
 await disk.setStorageOwner(B);assert.deepEqual(await disk.getPairs(),[]);assert.deepEqual(await disk.getScores(),[]);assert.equal(await disk.getSyncState('queue'),undefined);
 assert.notEqual((await disk.openStore()).name,aDB);await assert.rejects(disk.getStoredBlob(aRef),/STORAGE_ASSET_OWNER_MISMATCH/);await assert.rejects(disk.getStoredBlob(legacyRef),/STORAGE_ASSET_OWNER_MISMATCH/);
 await assert.rejects(disk.hydratePair(aFull),/STORAGE_ASSET_OWNER_MISMATCH/);await assert.rejects(disk.putSyncState('stale-checkpoint',{blob:aHydrated}),/STORAGE_ASSET_OWNER_MISMATCH/);
 await assert.rejects(disk.putPair({...originalA,original:{...originalA.original,blob:aHydrated,normalized:aHydrated}}),/STORAGE_ASSET_OWNER_MISMATCH/);
 const originalB=await pair('account B different bytes');await disk.putPair(originalB);await disk.putSyncState('queue',{owner:B,pending:true});await disk.addScore({comparison_id:'same_score',owner:B});
 const bRef=(await disk.getPairs())[0].original.blob;assert.equal(bRef.storage_owner,B);
 // Even a forged identifier pointing at a real B asset retains A's scope marker.
 await assert.rejects(disk.getStoredBlob({...aRef,id:bRef.id,size:bRef.size}),/STORAGE_ASSET_OWNER_MISMATCH/);
 await disk.setStorageOwner(null);assert.equal(disk.storageOwner(),null);assert.deepEqual(await disk.getPairs(),[]);assert.equal(await disk.getSyncState('queue'),undefined);assert.notEqual((await disk.openStore()).name,'bd-dualframe-lab-v1');
 await assert.rejects(disk.getStoredBlob(bRef),/STORAGE_ASSET_OWNER_MISMATCH/);
 await disk.setStorageOwner(A);assert.equal((await disk.openStore()).name,aDB);assert.equal(await hash(await disk.getStoredBlob((await disk.getPairs())[0].original.blob)),originalA.original.sha256);assert.equal((await disk.getSyncState('queue')).owner,A);assert.equal((await disk.getScores())[0].owner,A);
 await disk.setStorageOwner(B);assert.equal(await hash(await disk.getStoredBlob((await disk.getPairs())[0].original.blob)),originalB.original.sha256);assert.equal((await disk.getSyncState('queue')).owner,B);
 await disk.setStorageOwner(LEGACY);assert.equal(await hash(await disk.getStoredBlob((await disk.getPairs())[0].original.blob)),legacy.original.sha256);assert.equal((await disk.getSyncState('queue')).owner,'legacy');
});

test('captured queues, receipts and writes reject an old account epoch, including switch-back',async()=>{
 const disk=await fresh();await disk.setStorageOwner(A);const scoped=disk.captureStorageScope(),p=await pair('account A source');await scoped.putPair(p);
 const receipt=await scoped.putSyncAsset('verified-file',p.pair_id,new Blob(['verified checkpoint'],{type:'image/png'}),{verified:true,asset_id:'synthetic_asset_id'});
 await scoped.putSyncState('transfer-checkpoint',{next_byte:123});await scoped.prepareForUpdate();
 await disk.setStorageOwner(B);await disk.putPair(await pair('account B source'));await disk.putSyncState('transfer-checkpoint',{next_byte:987});
 for(const stale of [()=>scoped.putSyncState('late-queue',{owner:A}),()=>scoped.putPair(p),()=>scoped.updatePair(p.pair_id,row=>row),()=>scoped.getPairs(),()=>scoped.getStoredBlob(receipt.blob),()=>scoped.putSyncAsset('late-file',p.pair_id,new Blob(['late']))])await assert.rejects(stale(),/STORAGE_OWNER_CHANGED/);
 assert.throws(()=>scoped.cancelUpdatePreparation(),/STORAGE_OWNER_CHANGED/);assert.equal(await disk.getSyncState('late-queue'),undefined);assert.equal((await disk.getSyncState('transfer-checkpoint')).next_byte,987);
 await disk.setStorageOwner(A);await assert.rejects(scoped.getPairs(),/STORAGE_OWNER_CHANGED/);
 // A's update barrier neither blocks B nor disappears due to a stale cancel.
 await assert.rejects(disk.putSyncState('blocked',{}),/UPDATE_IN_PROGRESS/);disk.cancelUpdatePreparation();
 const reopened=disk.captureStorageScope();assert.equal((await reopened.getSyncState('transfer-checkpoint')).next_byte,123);assert.equal(await reopened.getStoredBlob(receipt.blob).then(b=>b.text()),'verified checkpoint');await reopened.putSyncState('resumed',{ok:true});
});

test('switch waits for an already-started transaction and never redirects its bytes',async()=>{
 const disk=await fresh();await disk.setStorageOwner(A);const db=await disk.openStore(),nativeTransaction=db.transaction.bind(db),nativeClose=db.close.bind(db);
 let complete=false,closedBeforeComplete=false,start;
 const started=new Promise(resolve=>{start=resolve;});
 db.transaction=(...args)=>{const tx=nativeTransaction(...args);if(args[1]==='readwrite'){tx.addEventListener('complete',()=>{complete=true;});start();}return tx;};
 db.close=()=>{closedBeforeComplete=!complete;nativeClose();};
 const p=await pair('transaction remains in A'),write=disk.putPair(p);await started;
 const switched=disk.setStorageOwner(B);const outcomes=await Promise.allSettled([write,switched]);
 assert.equal(outcomes[1].status,'fulfilled');assert.equal(complete,true);assert.equal(closedBeforeComplete,false);assert.deepEqual(await disk.getPairs(),[]);
 // Returning the old task's result may be refused after its transaction safely
 // committed. Its durable original remains recoverable only in A's namespace.
 if(outcomes[0].status==='rejected')assert.match(outcomes[0].reason.message,/STORAGE_OWNER_CHANGED/);
 await disk.setStorageOwner(A);assert.equal(await hash(await disk.getStoredBlob((await disk.getPairs())[0].original.blob)),p.original.sha256);
});

test('invalid identities cannot select arbitrary database names or disturb the active account',async()=>{
 const disk=await fresh();await disk.setStorageOwner(A);
 for(const value of ['',undefined,42,{},'short','../other-owner','user@example.org','x'.repeat(101),'with spaces'])await assert.rejects(disk.setStorageOwner(value),/STORAGE_OWNER_INVALID/);
 assert.equal(disk.storageOwner(),A);await disk.putPair(await pair('still A'));
 await Promise.all([disk.setStorageOwner(B),disk.setStorageOwner(A)]);assert.equal(disk.storageOwner(),A);assert.equal((await disk.getPairs()).length,1);
});
