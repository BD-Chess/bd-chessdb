import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
 const old={};for(const k of ['location','localStorage','document','fetch'])old[k]=globalThis[k];
 globalThis.location={hostname:'127.0.0.1',origin:'http://127.0.0.1:8765'};globalThis.document=new EventTarget();
 const saved=JSON.stringify({token:'fixture',expires_at:new Date(Date.now()+86400000).toISOString()});globalThis.localStorage={getItem:()=>saved,removeItem(){}};
 return ()=>{for(const [key,value] of Object.entries(old))if(value===undefined)delete globalThis[key];else globalThis[key]=value;};
}
test('download checkpoints resume exact byte ranges after interruption and reject corrupt/unknown assets',async()=>{
 const restore=fixture(),data=Buffer.alloc(2097189,121),meta={asset_id:'fixture_asset_1',sha256:sha(data),byte_size:data.length,mime:'image/png'};let checkpoint,calls=[],breakTransfer=true;
 try{
  globalThis.fetch=async(url,o)=>{
   const [_,a,b]=o.headers.range.match(/bytes=(\d+)-(\d+)/),start=Number(a),end=Number(b);calls.push(start);
   if(start>0&&breakTransfer)throw Error('NETWORK_INTERRUPTED');
   return new Response(data.subarray(start,end+1),{status:206,headers:{'content-type':'image/png','content-range':`bytes ${start}-${end}/${data.length}`}});
  };
  const api=await import('../public/Nara/dualframe-lab/api-client.mjs?transport='+randomUUID());
  await assert.rejects(api.downloadSyncAsset(meta,{onCheckpoint:c=>{checkpoint=c;}}),/NETWORK_INTERRUPTED/);assert.equal(checkpoint.next_byte,2097152);
  breakTransfer=false;const blob=await api.downloadSyncAsset(meta,{checkpoint});assert.equal(sha(Buffer.from(await blob.arrayBuffer())),meta.sha256);assert.deepEqual(calls,[0,2097152,2097152]);
  await assert.rejects(api.downloadSyncAsset({...meta,byte_size:undefined}),/SIZE_UNKNOWN/);
  await assert.rejects(api.downloadSyncAsset({...meta,sha256:'a'.repeat(64)}),/HASH_MISMATCH/);
 }finally{restore();}
});
test('upload receipt recovery avoids replaying committed chunks or a completed asset',async()=>{
 const restore=fixture(),data=Buffer.alloc(2097199,17),blob=new Blob([data],{type:'image/png'}),digest=sha(data),chunks=new Set(),ticket={upload_id:'fixture_upload',chunk_size:1048576,chunks:3};let checkpoint,chunkCalls=[],fail=true;
 try{
  globalThis.fetch=async(url,o)=>{
   const path=new URL(url).pathname;
   if(path.endsWith('/init'))return Response.json(ticket);
   if(path.endsWith('/fixture_upload'))return Response.json({complete:false,received:[...chunks]});
   if(path.endsWith('/finish'))return Response.json({asset_id:'fixture_upload',sha256:digest,byte_size:data.length,mime:'image/png'});
   const n=Number(path.split('/').at(-1));chunkCalls.push(n);if(n===1&&fail)throw Error('NETWORK_INTERRUPTED');chunks.add(n);return Response.json({ok:true});
  };
  const api=await import('../public/Nara/dualframe-lab/api-client.mjs?transport='+randomUUID());
  await assert.rejects(api.uploadSyncAsset(blob,{kind:'original',onCheckpoint:c=>{checkpoint=c;}}),/NETWORK_INTERRUPTED/);
  fail=false;const done=await api.uploadSyncAsset(blob,{kind:'original',checkpoint});assert.equal(done.sha256,digest);assert.deepEqual(chunkCalls,[0,1,1,2]);
  globalThis.fetch=async()=>Response.json({complete:true,asset:done});assert.deepEqual(await api.uploadSyncAsset(blob,{checkpoint}),done);
 }finally{restore();}
});
