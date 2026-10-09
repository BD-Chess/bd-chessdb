'use strict';
/* Narrow public-home PWA regression: manifest, legacy redirect and SW online/offline behavior.
 * Node 20+ only; no external packages/network calls. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const pub=path.resolve(__dirname,'../public');
const read=p=>fs.readFileSync(path.join(pub,p),'utf8');
const html=read('index.html');
const workerSource=read('sw.js');
const bootstrap=read('pwa.js');
const legacy=read('PWA/index.html');
const legacyWorker=read('PWA/sw.js');
const release=JSON.parse(read('pwa-release.json'));
const manifest=JSON.parse(read('manifest.webmanifest'));
const oldManifest=JSON.parse(read('PWA/manifest.webmanifest'));
assert.equal(manifest.start_url,'./');
assert.equal(manifest.scope,'./');
assert.equal(manifest.id,'./');
assert.equal(oldManifest.start_url,'../');
assert.equal(oldManifest.scope,'../');
assert.equal(oldManifest.id,'../');
assert.match(html,/name="mdlxdcc-pwa-release" content="root-20261009-r3"/);
assert.match(html,/manifest\.webmanifest\?v=root-20261009-r3/);
assert.match(html,/pwa\.js\?v=root-20261009-r3/);
assert.match(bootstrap,/updateViaCache:'none'/);
assert.match(bootstrap,/controllerchange/);
assert.match(bootstrap,/pageshow/);
assert.match(bootstrap,/visibilitychange/);
assert.match(bootstrap,/cache:'no-store'/);
assert.equal(release.release_id,'root-20261009-r3');
assert.match(workerSource,/const VERSION='root-20261009-r3'/);
assert.match(bootstrap,/const RELEASE='root-20261009-r3'/);
for(const variant of ['Clean','Caption'])assert.ok(fs.existsSync(path.join(pub,'assets/human-middle/v5/Human_in_the_Middle_Questions_Meadow_Tower_'+variant+'_R1.webp')),'Questions '+variant);
assert.match(legacy,/location\.replace/);
assert.doesNotMatch(legacy,/class="human-middle-card"/);
assert.match(legacyWorker,/registration\.unregister\(\)/);
assert.match(legacyWorker,/mdlxdcc-home-pwa-/);
assert.match(read('_redirects'),/\/PWA\/\s+\/\s+301!/);
assert.match(read('_headers'),/\/sw\.js[\s\S]*?Cache-Control:\s*no-store/);
assert.match(read('index-pwa.html'),/url=\.\/"/);
for(let i=1;i<=9;i++){
 const p=String(i).padStart(2,'0');
 assert.ok(fs.existsSync(path.join(pub,'assets/human-middle/v4/Human_in_the_Middle_HD_MP'+i+'.webp')),'Space '+i);
 for(const type of ['TIME','INFO'])assert.ok(fs.existsSync(path.join(pub,'assets/human-middle/v5/Human_in_the_Middle_HD_'+type+p+'.webp')),type+p);
}
for(const asset of release.core_shell_assets)assert.ok(fs.existsSync(path.join(pub,asset)),'Shell '+asset);
const scriptUrls=[...html.matchAll(/<script[^>]+src="\.\/(assets\/human-middle\/[^"?]+)/g)].map(m=>m[1]);
assert.equal(scriptUrls.length,3,'All 3 conceptual gallery scripts remain wired');
assert.ok(scriptUrls.some(x=>x.includes('explanations')),'Bilingual explanations retained');
new vm.Script(workerSource,{filename:'public/sw.js'});
new vm.Script(bootstrap,{filename:'public/pwa.js'});
new vm.Script(legacyWorker,{filename:'public/PWA/sw.js'});
// The existing Pages release gate also checks the four-axis public gallery.
require('./human-middle-questions.test.cjs');

function mockCacheStorage(){
 const collections=new Map();
 const key=req=>new URL(typeof req==='string'?req:req.url).origin+new URL(typeof req==='string'?req:req.url).pathname;
 function cache(){
  const items=new Map();
  return {
   async put(req,res){items.set(key(req),res.clone())},
   async match(req){const x=items.get(key(req));return x?x.clone():undefined},
   async keys(){return [...items.keys()].map(x=>new Request(x))},
   async delete(req){return items.delete(key(req))},
   get count(){return items.size}
  };
 }
 return {
  async open(name){if(!collections.has(name))collections.set(name,cache());return collections.get(name)},
  async keys(){return [...collections.keys()]},
  async delete(name){return collections.delete(name)}
 };
}
async function harness(base){
 const listeners=new Map(),storage=mockCacheStorage(),requests=[];
 let online=true,revision='v1',claimed=false,skipped=false;
 const self={
  registration:{scope:base},
  addEventListener(name,handler){listeners.set(name,handler)},
  skipWaiting:async()=>{skipped=true},
  clients:{claim:async()=>{claimed=true}}
 };
 const fetchMock=async (req,init={})=>{
  const url=typeof req==='string'?req:req.url||req.href;
  requests.push({url,cache:init.cache||req.cache});
  if(!online)throw new Error('Network unavailable');
  return new Response(revision+':'+url,{status:200,headers:{'Content-Type':'text/plain'}});
 };
 vm.runInNewContext(workerSource,{self,caches:storage,URL,Request,Response,fetch:fetchMock});
 const scope=new URL(base);
 const event=(req)=>({
  request:req,background:[],response:null,
  waitUntil(p){this.background.push(Promise.resolve(p))},
  respondWith(p){this.response=Promise.resolve(p)}
 });
 let e=event();
 listeners.get('install')(e);
 await Promise.all(e.background);
 assert.ok(skipped,'Atomic install completed and skipWaiting requested');
 assert.equal((await storage.keys()).length,1,'Exactly one root cache installed');
 const names=await storage.keys(),cache=await storage.open(names[0]);
 assert.equal(cache.count,release.core_shell_assets.length,'Only current lightweight shell precached');
 const old='mdlxdcc-root-pwa:'+scope.pathname+':previous-release';
 await storage.open(old);
 await storage.open('other-application-cache');
 e=event();
 listeners.get('activate')(e);await Promise.all(e.background);
 assert.ok(claimed,'New worker claims clients');
 assert.ok(!(await storage.keys()).includes(old),'Stale root SW caches purged');
 assert.ok((await storage.keys()).includes('other-application-cache'),'Other apps untouched');
 const root=scope.href;
 async function request(url,mode){
  const req={url,method:'GET',mode:mode||'cors'};
  const x=event(req);
  listeners.get('fetch')(x);
  if(!x.response)return {intercepted:false};
  const response=await x.response;
  await Promise.all(x.background);
  return {intercepted:true,text:await response.text(),response};
 }
 assert.equal((await request(new URL('chess/',root).href,'navigate')).intercepted,false,'No other app navigation interception');
 assert.equal((await request(new URL('api/private',root).href)).intercepted,false,'No API interception');
 const gallery=new URL('assets/human-middle/v5/Human_in_the_Middle_HD_TIME01.webp',root).href;
 const live=await request(gallery);
 assert.equal(live.text,'v1:'+gallery,'Online image fetched fresh');
 assert.equal(requests.at(-1).cache,'no-store','HTTP cache bypassed');
 revision='v2';
 assert.equal((await request(gallery)).text,'v2:'+gallery,'Online asset replaces stale cache');
 online=false;
 assert.equal((await request(gallery)).text,'v2:'+gallery,'Offline image uses last successful version');
 assert.equal((await request(root,'navigate')).intercepted,true,'Root navigation handled offline');
 online=true;revision='v3';
 assert.equal((await request(root,'navigate')).text,'v3:'+root,'Online homepage is network-first');
 assert.equal((await request(new URL('index.html',root).href,'navigate')).text,'v3:'+new URL('index.html',root).href,'index.html network-first');
 const privateUrl=new URL('BD/O/index.html',root).href;
 assert.equal((await request(privateUrl,'navigate')).intercepted,false,'Protected route untouched');
 for(let i=0;i<28;i++){
  await request(new URL('assets/human-middle/v5/demo-'+i+'.webp',root).href);
 }
 const remaining=(await cache.keys()).filter(k=>k.url.endsWith('.webp'));
 assert.ok(remaining.length<=24,'Media cache bound respected, found '+remaining.length);
 return {scope:scope.pathname,cacheEntries:cache.count,mediaEntries:remaining.length};
}
(async()=>{
 const cases=[
  await harness('https://www.mdlxdcc.org/'),
  await harness('https://example.github.io/bd-chessdb/')
 ];
 console.log('PASS root PWA: manifest, 27 assets, one entry, legacy migration, network-first, offline, scopes and bounded media cache');
 for(const x of cases)console.log('PASS scope '+x.scope+' cached='+x.cacheEntries+' media='+x.mediaEntries);
})().catch(error=>{console.error(error);process.exitCode=1});
