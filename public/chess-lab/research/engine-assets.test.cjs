'use strict';
// Tiny actual byte fixtures, independent SHA oracle and real IDB transactions.
// Transport/storage tests do not substitute for real-browser offline engine execution.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {webcrypto,createHash,randomBytes}=require('node:crypto');
const {IDBFactory}=require('fake-indexeddb');
const {SHA256}=require('../js/8zc-sha256.js'),Assets=require('../js/8zc-engine-assets.js');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const key=x=>typeof x==='string'?x:x.url??String(x);
class Cache {constructor(){this.rows=new Map();}async match(u){return this.rows.get(key(u))?.clone();}async put(u,r){this.rows.set(key(u),r.clone());}async delete(u){return this.rows.delete(key(u));}async keys(){return [...this.rows.keys()].map(u=>new Request(u));}}
class Caches {constructor(){this.rows=new Map();}async open(n){if(!this.rows.has(n))this.rows.set(n,new Cache());return this.rows.get(n);}async keys(){return [...this.rows.keys()];}async delete(n){return this.rows.delete(n);}}
function fixture(){
  const sources=new Map([['engines/test/worker.mjs',Buffer.from('export const proof = 1;')],['engines/test/wasm.part0',Buffer.from('first genuine bytes')],['engines/test/wasm.part1',Buffer.from('second genuine bytes')]]);
  const files=[...sources].map(([path,b])=>({path,bytes:b.length,sha256:sha(b)}));
  const combined={parts:files.slice(1).map(f=>f.path),sha256:sha(Buffer.concat([...sources.values()].slice(1))),bytes:files.slice(1).reduce((n,f)=>n+f.bytes,0)};
  const p={mode:'reckless',variant:'single',version:'test-v1',files,combined,identity:sha(Buffer.from(JSON.stringify(files))),bytes:files.reduce((n,f)=>n+f.bytes,0)};
  const requests=[],env={location:{href:'https://site.test/chess-lab/'},crypto:webcrypto,caches:new Caches(),indexedDB:new IDBFactory(),performance,
    navigator:{onLine:true,serviceWorker:{controller:{scriptURL:'https://site.test/chess-lab/engine-sw.js'}},storage:{estimate:async()=>({usage:0,quota:1024*1024*16}),persist:async()=>false,persisted:async()=>false}},
    fetch:async(u,{signal}={})=>{if(signal?.aborted)throw new DOMException('Cancelled','AbortError');requests.push(u);return new Response(sources.get(new URL(u).pathname.slice('/chess-lab/'.length)));}};
  const manifest={schema:'test',packages:[p]},store=Assets.create(env,manifest);return {sources,files,p,requests,env,manifest,store};
}
test('incremental SHA compares to independent crypto across boundary splits',()=>{
  for(const n of [0,1,55,56,63,64,65,257,4099]){const b=randomBytes(n),h=new SHA256();for(let i=0;i<n;i+=7)h.update(b.subarray(i,i+7));assert.equal(h.hex(),sha(b));assert.equal(h.hex(),sha(b));}
});
test('complete closure is committed last and warm install transfers no files',async()=>{
  const f=fixture();let observedReady=false;f.env.fetch=async u=>{assert.equal(await (await f.env.caches.open(f.store.cacheName(f.p))).match(f.store.marker(f.p)),undefined);f.requests.push(u);return new Response(f.sources.get(new URL(u).pathname.slice('/chess-lab/'.length)));};
  await f.store.install('reckless');observedReady=(await f.store.inspect('reckless',{verifyHashes:true})).status==='ready';assert(observedReady);assert.equal(f.requests.length,3);
  const r=await f.store.install('reckless');assert.equal(r.assetCacheHit,true);assert.equal(f.requests.length,3);assert.equal(r.localBytes,f.p.bytes);
});
test('truncated download cannot create READY and retry keeps good files',async()=>{
  const f=fixture(),fetch=f.env.fetch;f.env.fetch=async(u,o)=>u.endsWith('part1')?new Response('truncated'):fetch(u,o);
  await assert.rejects(f.store.install('reckless'),{name:'IntegrityError'});assert.equal((await f.store.inspect('reckless')).status,'incomplete');
  assert(!await (await f.env.caches.open(f.store.cacheName(f.p))).match(f.store.marker(f.p)));
  f.env.fetch=fetch;await f.store.install('reckless');assert.equal(f.requests.filter(u=>u.endsWith('worker.mjs')).length,1);assert.equal((await f.store.inspect('reckless',{verifyHashes:true})).status,'ready');
});
test('SHA mismatch fails closed and only the corrupted file is repaired',async()=>{
  const f=fixture();await f.store.install('reckless');const cache=await f.env.caches.open(f.store.cacheName(f.p)),file=f.files[1];
  await cache.put('https://site.test/chess-lab/'+file.path,new Response(Buffer.alloc(file.bytes,45),{headers:{'Content-Length':String(file.bytes),'X-ChessBest-SHA256':file.sha256}}));
  assert.equal((await f.store.inspect('reckless',{verifyHashes:true})).status,'incomplete');const before=f.requests.length;await f.store.install('reckless');assert.equal(f.requests.length-before,1);
});
test('missing byte eviction defeats stale READY and offline makes no network retries',async()=>{
  const f=fixture();await f.store.install('reckless');const cache=await f.env.caches.open(f.store.cacheName(f.p));await cache.delete('https://site.test/chess-lab/'+f.files[1].path);f.env.navigator.onLine=false;
  assert.equal((await f.store.inspect('reckless')).status,'incomplete');const before=f.requests.length;
  await assert.rejects(f.store.install('reckless'),{name:'OfflineError'});assert.equal(f.requests.length,before);
});
test('quota failure preserves Study-like and unrelated origin storage',async()=>{
  const f=fixture(),other=await f.env.caches.open('another-app-cache');await other.put('https://site.test/sudoku/user',new Response('retained'));
  f.env.navigator.storage.estimate=async()=>({usage:900,quota:1000});await assert.rejects(f.store.install('reckless'),{name:'QuotaExceededError'});assert.equal(f.requests.length,0);
  assert.equal(await (await other.match('https://site.test/sudoku/user')).text(),'retained');
  assert.equal((await f.store.prepare('reckless')).status,'online-only');
});
test('cancel during a download leaves a repairable checkpoint and closes its lease',async()=>{
  const f=fixture(),c=new AbortController(),fetch=f.env.fetch;f.env.fetch=async(u,o)=>{if(u.endsWith('part1')){c.abort();throw new DOMException('Cancelled','AbortError');}return fetch(u,o);};
  await assert.rejects(f.store.install('reckless',{signal:c.signal}),{name:'AbortError'});f.env.fetch=fetch;await f.store.install('reckless');assert.equal(f.requests.filter(u=>u.endsWith('worker.mjs')).length,1);
});
test('two tabs share a transaction lease and download one closure',async()=>{
  const f=fixture(),other=Assets.create(f.env,f.manifest),fetch=f.env.fetch;f.env.fetch=async(u,o)=>{await new Promise(r=>setTimeout(r,15));return fetch(u,o);};
  await Promise.all([f.store.install('reckless'),other.install('reckless')]);assert.equal(f.requests.length,3);
});
test('Remove refuses a prepared or running engine and deletes only the selected package',async()=>{
  const f=fixture();await f.store.install('reckless');const release=await f.store.acquireUsage('reckless');await assert.rejects(f.store.remove('reckless'),{name:'InUseError'});release();await new Promise(r=>setTimeout(r,10));
  const core=await f.env.caches.open('chessbest-chess-lab-core');await core.put('https://site.test/chess-lab/Study',new Response('my branch'));
  await f.store.remove('reckless');assert.equal((await f.store.inspect('reckless')).status,'online');assert.equal(await (await core.match('https://site.test/chess-lab/Study')).text(),'my branch');
});
test('private/unavailable IDB and denied persistence retain original online path',async()=>{
  const f=fixture();f.env.indexedDB=null;assert.equal((await f.store.prepare('reckless')).status,'online-only');assert.equal((await f.store.inspect('reckless')).status,'unavailable');assert.deepEqual(await f.store.requestPersistence(),{supported:true,granted:false});
});
test('unsupported SF threaded variant and cross-origin/path manifests are rejected',async()=>{
  const f=fixture();f.manifest.packages.push({...f.p,mode:'sf-full',variant:'threaded'});assert.throws(()=>f.store.select('sf-full','threaded'),{name:'NotSupportedError'});
  f.p.files=[{...f.files[0],path:'https://foreign.test/engine.js'}];assert.throws(()=>f.store.select('reckless'),{name:'IntegrityError'});
  f.p.files=[{...f.files[0],path:'engines/../../sudoku/engine.js'}];assert.throws(()=>f.store.select('reckless'),{name:'IntegrityError'});
});
test('Berserk receipt depends on existing IDB network; network is never put in CacheStorage',async()=>{
  const f=fixture();f.p.mode='berserk';f.p.network={bytes:25,sha256:'a'.repeat(64),storage:'IndexedDB'};f.p.bytes+=25;let saved=false;
  let networkProgress=false;f.store.subscribe(state=>{if(state.asset==='NNUE'&&state.loaded===f.p.bytes)networkProgress=true;});
  f.store.setNetworkProvider({check:async()=>saved,ensure:async(_signal,onProgress)=>{onProgress({phase:'downloading',loaded:25});saved=true;},remove:async()=>{saved=false;}});
  await f.store.install('berserk');assert.equal((await f.store.inspect('berserk')).status,'ready');const cache=await f.env.caches.open(f.store.cacheName(f.p));assert.equal((await cache.keys()).length,4);
  assert.equal(networkProgress,true);
  saved=false;assert.equal((await f.store.inspect('berserk')).status,'incomplete');await f.store.remove('berserk');assert.equal(saved,false);
});
test('offline route falls back to original online fetch when CacheStorage is blocked',async()=>{
  const vm=require('node:vm'),fs=require('node:fs'),f=fixture(),handlers={},attempts=[];
  const self={location:{href:'https://site.test/chess-lab/engine-sw.js'},ChessEngineAssetManifest:{prefix:f.store.PREFIX,packages:[f.p]},addEventListener:(n,fn)=>{handlers[n]=fn;}};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../js/8zc-engine-assets-sw.js'),'utf8'),{self,URL,Headers,Response,crypto:webcrypto,caches:{open:async()=>{throw new DOMException('Blocked','SecurityError');}},fetch:async request=>{attempts.push(request.url);return new Response('original online bytes');}});
  let response;handlers.fetch({request:new Request('https://site.test/chess-lab/'+f.files[0].path),respondWith:p=>{response=p;}});
  assert.equal(await (await response).text(),'original online bytes');assert.equal(attempts.length,1);
});
