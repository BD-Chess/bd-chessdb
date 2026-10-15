import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {sha256,MAX_ORIGINALS} from '../public/Nara/dualframe-lab/core.mjs';
import {archiveBackup,readArchiveBackup} from '../public/Nara/dualframe-lab/archive-backup.mjs';
test('100 distinct originals, derivatives and scores persist; concurrent 101st inserts roll back with accurate error',async()=>{
 globalThis.indexedDB=new IDBFactory();const disk=await import('../public/Nara/dualframe-lab/store.mjs?owner-cap='+crypto.randomUUID());await disk.setStorageOwner(null);
 for(let i=0;i<MAX_ORIGINALS;i++){const blob=new Blob(['synthetic-'+i],{type:'image/png'}),pair={pair_id:'owner_fixture_'+i,original:{sha256:await sha256(blob),blob,normalized:blob},variants:{landscape:{hd:{blob}},portrait:{}},jobs:[],masters:[{blob}],enhancement_families:[{status:'HELD',automatic_paid_retry:false}]};await disk.putOriginal(pair);}
 const before=await disk.getPairs();assert.equal(before.length,100);assert.equal(before[20].original.blob.__df_blob,1);await disk.addScore({comparison_id:'immutable-score',locked:true});
 const full=await disk.hydratePair(before[0]);await disk.putPair({...full,description:'metadata update at full capacity'});
 const blob=new Blob(['101st'],{type:'image/png'}),hash=await sha256(blob);await assert.rejects(disk.putOriginal({pair_id:'must_not_exist',original:{sha256:hash,blob,normalized:blob},variants:{}}),/^Error: PAIR_LIMIT$/);
 assert.equal((await disk.getPairs()).length,100);assert.equal(await disk.getPair('must_not_exist'),undefined);
 assert.equal(await sha256(await disk.getStoredBlob((await disk.getPairs())[99].original.blob)),before[99].original.sha256);assert.equal((await disk.getScores())[0].locked,true);
 await disk.setStorageOwner('other_fixture_owner');await disk.putPair({pair_id:'independent',original:{sha256:hash,blob,normalized:blob},variants:{}});assert.equal((await disk.getPairs()).length,1);await disk.setStorageOwner(null);assert.equal((await disk.getPairs()).length,100);
});
test('large raw archive round-trip preserves all 100 originals without base64 or a 40/64 MiB library cap',async()=>{
 const pairs=[];for(let i=0;i<100;i++){const bytes=new Uint8Array(460000);bytes.fill(i);bytes[0]=i;const blob=new Blob([bytes],{type:'image/png'});pairs.push({pair_id:'backup_'+i,original:{sha256:await sha256(blob),blob,normalized:blob},variants:{},jobs:[],enhancement_families:[{status:'HELD',automatic_paid_retry:false}]});}
 let progress=0;const zip=await archiveBackup(pairs,[{comparison_id:'score',locked:true}],{getBlob:async b=>b,onProgress:p=>progress=p.done});assert.ok(zip.size>40*1048576);assert.equal(progress,100);
 const restored=await readArchiveBackup(zip);assert.equal(restored.pairs.length,100);for(let i=0;i<100;i++)assert.equal(await sha256(restored.pairs[i].original.blob),pairs[i].original.sha256);assert.equal(restored.scores[0].locked,true);
 const bytes=new Uint8Array(await zip.arrayBuffer()),name=new TextEncoder().encode('assets/');let changed=false;for(let i=0;i<bytes.length-name.length;i++){if(name.every((b,j)=>bytes[i+j]===b)){const start=i+75;bytes[start]^=255;changed=true;break;}}assert.equal(changed,true);await assert.rejects(readArchiveBackup(new Blob([bytes])),/INVALID_BACKUP/);
});
