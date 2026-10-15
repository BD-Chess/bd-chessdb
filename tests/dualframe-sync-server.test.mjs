import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createService} from '../functions/lib/dualframe/service.mjs';
import {signToken} from '../functions/lib/dualframe/auth.mjs';
import {hash} from '../functions/lib/dualframe/images.mjs';
const sharp=createRequire(new URL('../functions/package.json',import.meta.url))('sharp');
const OWNER='bd-research-owner',secret='sync-fixture-private-session-key-not-production',env=k=>k==='DF_SESSION_SECRET'?secret:null;
const png=await sharp({create:{width:24,height:16,channels:4,background:{r:40,g:80,b:120,alpha:1}}}).png().toBuffer();
const other=await sharp({create:{width:16,height:24,channels:4,background:{r:80,g:40,b:180,alpha:1}}}).png().toBuffer();
class Store{
 constructor(){this.map=new Map();}
 async set(k,v,o={}){if(o.onlyIfNew&&this.map.has(k))return {modified:false};this.map.set(k,Buffer.from(v));return {modified:true};}
 async setJSON(k,v,o={}){if(o.onlyIfNew&&this.map.has(k))return {modified:false};this.map.set(k,structuredClone(v));return {modified:true};}
 async get(k,o={}){const v=this.map.get(k);if(v===undefined)return null;if(o.type==='arrayBuffer'){const b=Buffer.from(v);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}return structuredClone(v);}
 async delete(k){this.map.delete(k);}
 // Deliberately paginate the backing store, not just the public API.
 async list({prefix,cursor}){const keys=[...this.map.keys()].filter(k=>k.startsWith(prefix)).sort(),start=Number(cursor||0),end=Math.min(start+37,keys.length);return {blobs:keys.slice(start,end).map(key=>({key})),...(end<keys.length?{cursor:String(end)}:{})};}
}
function harness(store=new Store()){
 let providerCalls=0;const service=createService({store,env,runProvider:async()=>{providerCalls++;throw Error('NO_PROVIDER_IN_SYNC');},dispatch:async()=>{throw Error('NO_DISPATCH_IN_SYNC');}});
 const api=(path,method='GET',body,owner=OWNER,raw)=>service.handle(new Request('https://www.mdlxdcc.org/api/df'+path,{method,headers:{authorization:'Bearer '+signToken({owner,scope:'session'},secret)},...(raw?{body:raw}:body!==undefined?{body:JSON.stringify(body)}:{})}));
 return {store,service,api,get providerCalls(){return providerCalls;}};
}
async function upload(h,kind='original',data=png,extra={}){
 const init=await h.api('/uploads/init','POST',{kind,sha256:hash(data),size:data.length,...extra});assert.equal(init.status,200,JSON.stringify(await init.clone().json()));const info=await init.json();
 for(let i=0;i<info.chunks;i++){const response=await h.api(`/uploads/${info.upload_id}/${i}`,'PUT',undefined,OWNER,data.subarray(i*info.chunk_size,(i+1)*info.chunk_size));assert.equal(response.status,200);}
 const finish=await h.api(`/uploads/${info.upload_id}/finish`,'POST',{});assert.equal(finish.status,200,JSON.stringify(await finish.clone().json()));return finish.json();
}
async function pair(h,data=png){const original=await upload(h,'original',data),normalized=await upload(h,'normalized',data);const r=await h.api('/pairs','POST',{original_asset_id:original.asset_id,normalized_asset_id:normalized.asset_id,original_sha256:original.sha256,title:'Fixture'});assert.equal(r.status,200);return {...await r.json(),original,normalized};}
async function manifest(h){const all={assets:[],pairs:[],jobs:[],titles:[],tombstones:[],sync_records:[]};let cursor,frontier;do{const r=await h.api('/sync/manifest?limit=53'+(cursor?'&cursor='+cursor:''));assert.equal(r.status,200);const b=await r.json();if(frontier)assert.equal(b.frontier,frontier);frontier=b.frontier;for(const k in all)all[k].push(...b.records[k]);cursor=b.next_cursor;}while(cursor);return {...all,frontier};}
const marker=a=>({__df_remote_asset:1,asset_id:a.asset_id,sha256:a.sha256,size:a.byte_size,type:a.mime});
function bodyFor(record,source,ids){return {record_id:hash(Buffer.from(JSON.stringify(record))),source_sha256:source,asset_ids:ids,record};}

test('manifest traverses all backing-store pages beyond 200 and immutable cursor survives additions',async()=>{
 const h=harness();for(let i=0;i<235;i++){const asset_id='fixture_'+String(i).padStart(5,'0');await h.store.setJSON(`asset-meta/${OWNER}/${asset_id}`,{asset_id,owner:OWNER,sha256:hash(Buffer.from(String(i))),byte_size:png.length,mime:'image/png',kind:'original'});await h.store.set(`assets/${OWNER}/${asset_id}`,png);}
 await h.store.setJSON('asset-meta/another-owner/private00',{asset_id:'private00',owner:'another-owner'});
 const first=await(await h.api('/sync/manifest?limit=100')).json();assert.equal(first.records.assets.length,100);assert.equal(first.total_records,235);assert.ok(first.next_cursor);
 await h.store.setJSON(`asset-meta/${OWNER}/newasset00`,{asset_id:'newasset00',owner:OWNER,sha256:hash(other),byte_size:other.length,mime:'image/png',kind:'original'});
 const next=await(await h.api('/sync/manifest?limit=200&cursor='+first.next_cursor)).json();assert.equal(next.frontier,first.frontier);assert.equal(next.records.assets.length,135);assert.equal(next.complete,true);assert.equal(next.records.assets.some(a=>a.asset_id==='newasset00'),false);
 const fresh=await manifest(h);assert.equal(fresh.assets.length,236);assert.notEqual(fresh.frontier,first.frontier);assert.equal(fresh.assets.find(a=>a.asset_id==='newasset00').bytes_present,false);assert.equal(fresh.assets.some(a=>a.asset_id==='private00'),false);assert.equal(h.providerCalls,0);
 const foreign=await h.api('/sync/manifest?cursor='+first.next_cursor,'GET',undefined,'another-owner');assert.equal(foreign.status,410);
});

test('saved derived asset keeps role, acceptance and validated lineage without changing originals',async()=>{
 const h=harness(),p=await pair(h),a=await upload(h,'derived',other,{pair_id:p.pair_id,source_sha256:p.original.sha256,parent_asset_ids:[p.normalized.asset_id],role:'portrait-output',acceptance:'READY',quality:'hd',lineage:{provider:'client-import-assertion'}});
 assert.equal(a.kind,'derived');assert.equal(a.role,'portrait-output');assert.equal(a.acceptance,'READY');assert.equal(a.parents[0].sha256,p.normalized.sha256);assert.deepEqual(Buffer.from(await h.store.get(`assets/${OWNER}/${p.original.asset_id}`,{type:'arrayBuffer'})),png);
 const list=await manifest(h);assert.equal(list.assets.length,3);assert.equal(list.assets.find(x=>x.asset_id===a.asset_id).acceptance,'READY');assert.equal(h.providerCalls,0);
});

test('upload rejects cross-owner and cross-pair parents, wrong source and corrupt claimed hashes',async()=>{
 const h=harness(),p=await pair(h),q=await pair(h,other);const base={kind:'derived',size:png.length,sha256:hash(png),pair_id:p.pair_id,source_sha256:p.original.sha256};
 for(const extra of [{parent_asset_ids:[q.normalized.asset_id]},{source_sha256:hash(Buffer.from('wrong'))},{parent_asset_ids:['foreign000']}]){const r=await h.api('/uploads/init','POST',{...base,...extra});assert.ok([400,404,409].includes(r.status));}
 await h.store.setJSON('asset-meta/foreign-owner/foreign000',{asset_id:'foreign000',owner:'foreign-owner',sha256:hash(png)});
 assert.equal((await h.api('/uploads/init','POST',{...base,parent_asset_ids:['foreign000']})).status,404);
 const init=await(await h.api('/uploads/init','POST',{kind:'original',size:png.length,sha256:'a'.repeat(64)})).json();await h.api(`/uploads/${init.upload_id}/0`,'PUT',undefined,OWNER,png);const r=await h.api(`/uploads/${init.upload_id}/finish`,'POST',{});assert.equal(r.status,409);assert.equal((await r.json()).error,'UPLOAD_HASH_MISMATCH');assert.equal(await h.store.get(`asset-meta/${OWNER}/${init.upload_id}`),null);
});

test('immutable Sync records preserve variants and validate marker hash, length and ownership',async()=>{
 const h=harness(),p=await pair(h),record={pair_id:'local_pair00',cloud_pair_id:p.pair_id,original:{sha256:p.original.sha256,blob:marker(p.original)},normalized:{blob:marker(p.normalized)}};
 const b=bodyFor(record,p.original.sha256,[p.original.asset_id,p.normalized.asset_id]);assert.equal((await h.api('/sync/records','POST',b)).status,200);assert.equal((await(await h.api('/sync/records','POST',b)).json()).reused,true);
 const changed={...record,title:'Second saved variant'};assert.equal((await h.api('/sync/records','POST',bodyFor(changed,p.original.sha256,b.asset_ids))).status,200);
 const invalid=structuredClone(record);invalid.original.blob.size++;assert.equal((await h.api('/sync/records','POST',bodyFor(invalid,p.original.sha256,b.asset_ids))).status,409);
 const list=await manifest(h);assert.equal(list.sync_records.length,2);assert.equal(list.assets.length,2);assert.equal(h.providerCalls,0);
});

test('revisioned title writes have one concurrent winner and legacy writes cannot overwrite it',async()=>{
 const h=harness(),p=await pair(h),path='/titles/'+p.original.sha256;
 const responses=await Promise.all([h.api(path,'PUT',{title:'Device A',base_revision:0}),h.api(path,'PUT',{title:'Device B',base_revision:0})]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
 assert.equal((await h.api(path,'PUT',{title:'Stale',base_revision:0})).status,409);assert.equal((await h.api(path,'PUT',{title:'Old client'})).status,409);
 assert.equal((await h.api(path,'PUT',{title:'Resolved',base_revision:1})).status,200);const list=await manifest(h);assert.equal(list.titles[0].revision,2);assert.equal(list.titles[0].title,'Resolved');
});

test('tombstones preserve bytes and prohibit re-creation or stale record resurrection',async()=>{
 const h=harness(),p=await pair(h),record={cloud_pair_id:p.pair_id,original:{sha256:p.original.sha256,blob:marker(p.original)}};
 const waiting=await(await h.api('/uploads/init','POST',{kind:'derived',sha256:hash(other),size:other.length,pair_id:p.pair_id,source_sha256:p.original.sha256})).json();await h.api(`/uploads/${waiting.upload_id}/0`,'PUT',undefined,OWNER,other);
 assert.equal((await h.api('/pairs/'+p.pair_id,'DELETE')).status,200);
 assert.equal((await h.api('/pairs','POST',{original_asset_id:p.original.asset_id,normalized_asset_id:p.normalized.asset_id,original_sha256:p.original.sha256})).status,409);
 assert.equal((await h.api(`/uploads/${waiting.upload_id}/finish`,'POST',{})).status,409);
 assert.equal((await h.api('/sync/records','POST',bodyFor(record,p.original.sha256,[p.original.asset_id]))).status,409);
 const list=await manifest(h);assert.equal(list.tombstones.length,1);assert.equal(list.tombstones[0].source_sha256,p.original.sha256);assert.ok(await h.store.get(`assets/${OWNER}/${p.original.asset_id}`,{type:'arrayBuffer'}));assert.equal(h.providerCalls,0);
});

test('prompt-generated source without fabricated original ancestry participates in Sync and source deletion',async()=>{
 const h=harness(),source=await upload(h,'generated',png,{operation:'generate',family_id:'prompt_family00',source_sha256:hash(png),acceptance:'READY'});
 assert.equal(source.kind,'generated');assert.deepEqual(source.parent_asset_ids,[]);
 const record={pair_id:'prompt_family00',origin:'generated',original:{sha256:source.sha256,blob:marker(source)}};
 assert.equal((await h.api('/sync/records','POST',bodyFor(record,source.sha256,[source.asset_id]))).status,200);
 assert.equal((await h.api('/sync/records/'+source.sha256,'DELETE')).status,200);
 assert.equal((await h.api('/sync/records','POST',bodyFor(record,source.sha256,[source.asset_id]))).status,409);
 assert.equal((await manifest(h)).tombstones[0].source_sha256,source.sha256);
});

test('upload receipts expose interruption/resume state and finish is idempotent after chunks are cleared',async()=>{
 const h=harness(),init=await(await h.api('/uploads/init','POST',{kind:'original',sha256:hash(png),size:png.length})).json();
 assert.deepEqual((await(await h.api('/uploads/'+init.upload_id)).json()).received,[]);
 await h.api(`/uploads/${init.upload_id}/0`,'PUT',undefined,OWNER,png);
 assert.deepEqual((await(await h.api('/uploads/'+init.upload_id)).json()).received,[0]);
 const a=await(await h.api(`/uploads/${init.upload_id}/finish`,'POST',{})).json(),b=await(await h.api(`/uploads/${init.upload_id}/finish`,'POST',{})).json();assert.equal(a.asset_id,b.asset_id);assert.equal((await(await h.api('/uploads/'+init.upload_id)).json()).complete,true);assert.equal(h.providerCalls,0);
});

test('a verified reupload repairs missing bytes under old immutable asset IDs without changing metadata',async()=>{
 const h=harness(),p=await pair(h),old=await h.store.get(`asset-meta/${OWNER}/${p.original.asset_id}`);
 await h.store.delete(`assets/${OWNER}/${p.original.asset_id}`);
 assert.equal((await manifest(h)).assets.find(a=>a.asset_id===p.original.asset_id).bytes_present,false);
 const replacement=await upload(h,'original',png);assert.notEqual(replacement.asset_id,p.original.asset_id);
 assert.deepEqual(await h.store.get(`asset-meta/${OWNER}/${p.original.asset_id}`),old);
 assert.equal(hash(Buffer.from(await h.store.get(`assets/${OWNER}/${p.original.asset_id}`,{type:'arrayBuffer'}))),old.sha256);
 assert.equal((await manifest(h)).assets.find(a=>a.asset_id===p.original.asset_id).bytes_present,true);
});
