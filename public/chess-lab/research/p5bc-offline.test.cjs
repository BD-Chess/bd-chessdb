'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{createHash,webcrypto}=require('node:crypto'),{IDBFactory}=require('fake-indexeddb');
const Assets=require('../js/8zc-engine-assets.js'),sha=b=>createHash('sha256').update(b).digest('hex');
const base='https://fixture.test/chess-lab/';
class Cache {constructor(){this.rows=new Map();}async match(u){return this.rows.get(String(u.url||u))?.clone();}async put(u,v){this.rows.set(String(u.url||u),v.clone());}async delete(u){return this.rows.delete(String(u.url||u));}}
function fixture(){
  const data=Buffer.from('actual verified fixture bytes'),file={path:'engines/test/worker.js',bytes:data.length,sha256:sha(data)},pkg={mode:'reckless',variant:'single',version:'fixture',files:[file],identity:'a'.repeat(64),bytes:data.length};
  const shell=Buffer.from('shell fixture'),shellFile='vendor/stockfish/stockfish-18-lite-single.wasm',descriptor={root:base,release:'lab-0123456789abcdef',cacheName:'chessbest-chess-lab-lab-0123456789abcdef',hashes:{[shellFile]:sha(shell)}};
  const map=new Map(),env={location:{href:base},crypto:webcrypto,indexedDB:new IDBFactory(),navigator:{onLine:true,serviceWorker:{controller:{scriptURL:base+'engine-sw.js',postMessage(m,ports){ports[0].postMessage(descriptor);ports[0].close();}}}},caches:{async keys(){return [...map.keys()];},async open(n){if(!map.has(n))map.set(n,new Cache());return map.get(n);},async delete(n){return map.delete(n);}},fetch:async()=>{throw Error('INSPECTION MUST NOT FETCH');}};
  const store=Assets.create(env,{packages:[pkg]});return {env,store,pkg,data,file,shell,shellFile,descriptor,map};
}
async function installed(f){const shell=await f.env.caches.open(f.descriptor.cacheName);await shell.put(base+f.shellFile,new Response(f.shell));const c=await f.env.caches.open(f.store.cacheName(f.pkg));await c.put(base+f.file.path,new Response(f.data,{headers:{'Content-Length':String(f.data.length),'X-ChessBest-SHA256':f.file.sha256}}));await c.put(f.store.marker(f.pkg),new Response(JSON.stringify({identity:f.pkg.identity,bytes:f.pkg.bytes})));return c;}
test('BC-06 cache-only diagnostics distinguish shell, verified files, route and unsupported persistence APIs',async()=>{
  const f=fixture();assert.equal((await f.store.inspect('sf-lite')).offlineReady,false);await installed(f);
  const ready=await f.store.inspect('reckless',{verifyHashes:true});assert.equal(ready.files,'verified');assert.equal(ready.runtime,'supported');assert.equal(ready.offlineReady,true);
  f.env.navigator.serviceWorker.controller.scriptURL=base+'parent.js';const blocked=await f.store.inspect('reckless',{verifyHashes:true});assert.equal(blocked.files,'verified');assert.equal(blocked.runtime,'route-blocked');assert.equal(blocked.offlineReady,false);
  assert.equal(await f.store.estimate(),null);assert.equal(await f.store.persisted(),null);assert.deepEqual(await f.store.requestPersistence(),{supported:false,granted:false});
  f.env.document={baseURI:base};f.env.Worker=null;f.env.WebAssembly=null;const unsupported=await f.store.inspect('reckless');assert.equal(unsupported.runtime,'unsupported');assert.equal(unsupported.offlineReady,false);
});
test('BC-06 ready-marker-only, forged headers and missing shell never produce offline readiness; inspection never deletes good parts',async()=>{
  const f=fixture(),cache=await installed(f),before=[...f.map.keys()];
  await cache.delete(base+f.file.path);assert.equal((await f.store.inspect('reckless',{verifyHashes:true})).offlineReady,false);
  await cache.put(base+f.file.path,new Response(Buffer.alloc(f.file.bytes,88),{headers:{'Content-Length':String(f.file.bytes),'X-ChessBest-SHA256':f.file.sha256}}));const corrupt=await f.store.inspect('reckless',{verifyHashes:true});assert.equal(corrupt.files,'partial');assert.equal(corrupt.offlineReady,false);
  await cache.put(base+f.file.path,new Response(f.data,{headers:{'Content-Length':String(f.data.length),'X-ChessBest-SHA256':f.file.sha256}}));
  await (await f.env.caches.open(f.descriptor.cacheName)).delete(base+f.shellFile);const partial=await f.store.inspect('reckless',{verifyHashes:true});assert.equal(partial.files,'verified');assert.equal(partial.shell.files,'partial');assert.equal(partial.offlineReady,false);
  assert.deepEqual([...f.map.keys()],before);assert(await cache.match(base+f.file.path));assert(await cache.match(f.store.marker(f.pkg)));
});
