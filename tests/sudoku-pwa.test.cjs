'use strict';
// Static-release and service-worker lifecycle verification in Node VM/jsdom.
// It does not claim a real browser install, mobile rendering or iOS offline QA.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {JSDOM}=require('jsdom');
const base=path.resolve(__dirname,'../public/S/PWA');
const lab=path.resolve(__dirname,'../public/S/new');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=file=>fs.readFileSync(path.join(base,file));
const release=()=>JSON.parse(read('release.json'));
const nextTick=()=>new Promise(r=>setTimeout(r,0));
function workerHarness(scope='/S/PWA/'){
 const root=new URL(scope,'https://example.test'),handlers={},buckets=new Map();
 const state={offline:false,skipped:0,claimed:0,requests:[],failPath:null,tamperPath:null,failPutPath:null};
 const key=input=>new URL(input.url||input,root).href;
 const response=bytes=>{const r=new Response(bytes,{status:200});Object.defineProperty(r,'type',{value:'basic'});return r;};
 async function fetch(input){const url=new URL(key(input));state.requests.push(url.href);if(state.offline||url.pathname===state.failPath)throw Error('offline/unavailable');const relative=decodeURIComponent(url.pathname.slice(root.pathname.length))||'index.html';return response(url.pathname===state.tamperPath?Buffer.from('wrong-release-payload'):read(relative));}
 const caches={keys:async()=>[...buckets.keys()],delete:async name=>buckets.delete(name),open:async name=>{if(!buckets.has(name))buckets.set(name,new Map());const map=buckets.get(name);return{match:async input=>map.get(key(input))?.clone(),put:async(input,value)=>{if(new URL(key(input)).pathname===state.failPutPath)throw Error('cache quota exceeded');assert.ok(value.ok,'bad status cannot cache');map.set(key(input),value.clone());},keys:async()=>[...map.keys()].map(url=>new Request(url)),delete:async input=>map.delete(key(input)),addAll:async inputs=>{const all=await Promise.all(inputs.map(async input=>[key(input),await fetch(input)]));for(const[url,value]of all)map.set(url,value);}};}};
 const self={registration:{scope:root.href},location:{origin:root.origin,href:new URL('sw.js',root).href},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>{state.skipped++;},clients:{claim:async()=>{state.claimed++;}}};
 vm.runInNewContext(read('sw.js').toString(),{self,caches,fetch,URL,Request,Response,Set,Map,crypto:crypto.webcrypto,TextEncoder,Uint8Array,ArrayBuffer,console});
 async function dispatch(name,extra={}){let promise;assert.ok(handlers[name],name+' listener present');handlers[name]({waitUntil:p=>{promise=p;},respondWith:p=>{promise=p;},...extra});return promise;}
 return{root,state,buckets,caches,dispatch};
}

test('PWA retains exact LAB engine core, isolated legacy namespace and install identity',()=>{
 const sourceDOM=new JSDOM(fs.readFileSync(path.join(lab,'app.html'),'utf8'));const appDOM=new JSDOM(read('app.html').toString());
 assert.equal(appDOM.window.document.getElementById('navigator-core').textContent,sourceDOM.window.document.getElementById('navigator-core').textContent,'engine core is copied byte-for-byte from final LAB');sourceDOM.window.close();appDOM.window.close();
 const app=read('app.html').toString();assert.ok(app.includes("NS='ai8SudokuNavigatorV020PWA'"));assert.ok(!app.includes("'ai8SudokuNavigatorV020."));
 const manifest=JSON.parse(read('manifest.webmanifest'));assert.equal(manifest.short_name,'8zSudoku');assert.deepEqual([manifest.id,manifest.start_url,manifest.scope],['./','./','./']);assert.equal(manifest.display,'standalone');
 const dom=new JSDOM(read('index.html').toString());assert.equal(dom.window.document.querySelector('iframe').getAttribute('src'),'./app.html');assert.equal(dom.window.document.querySelector('[aria-current="page"]').textContent,'PWA');
 for(const el of dom.window.document.querySelectorAll('script[src],link[rel="manifest"],link[rel="apple-touch-icon"]')){const ref=(el.getAttribute('src')||el.getAttribute('href')).replace(/^\.\//,'').split('?')[0];assert.ok(fs.existsSync(path.join(base,ref)),ref+' exists');}
 dom.window.close();
});

for(const scope of ['/S/PWA/','/bd-chessdb/S/PWA/'])test('complete coherent offline release and request boundary at '+scope,async()=>{
 const h=workerHarness(scope);await h.dispatch('install');assert.equal(h.state.skipped,0,'installation waits for user approval');await h.dispatch('activate');h.state.offline=true;
 const assets=['','index.html','app.html','pwa.js','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'];
 for(const asset of assets){for(const query of ['', '?v=offline-check']){const r=await h.dispatch('fetch',{request:new Request(new URL(asset+query,h.root))});assert.ok(r?.ok,asset+query+' available offline');assert.equal(hash(Buffer.from(await r.arrayBuffer())),hash(read(asset||'index.html')),asset+' bytes');}}
 for(const url of ['https://third-party.test/x',new URL('../new/app.html',h.root),new URL('../app.html',h.root),new URL('/api/sudoku',h.root),new URL('unknown.json',h.root)])assert.equal(await h.dispatch('fetch',{request:new Request(url)}),undefined,String(url)+' not intercepted');
 assert.equal(await h.dispatch('fetch',{request:new Request(new URL('app.html',h.root),{method:'POST'})}),undefined,'POST not cached');
 const requests=h.state.requests.length;h.state.offline=false;h.state.tamperPath=new URL('app.html',h.root).pathname;const still=await h.dispatch('fetch',{request:new Request(new URL('app.html?new=1',h.root))});assert.equal(hash(Buffer.from(await still.arrayBuffer())),hash(read('app.html')));assert.equal(h.state.requests.length,requests,'installed snapshot remains coherent instead of mixing live files');
});

test('failed or mixed release install preserves old cache; only explicit activation skips waiting',async()=>{
 const h=workerHarness();const old=await h.caches.open('8zsudoku-pwa-v1');await old.put(new URL('app.html',h.root),new Response('old-game'));
 const foreign=await h.caches.open('8zsudoku-pwa-other-scope');await foreign.put('https://example.test/elsewhere/S/PWA/app.html',new Response('other-scope'));await h.caches.open('trip-pwa-cache');
 h.state.failPath=new URL('app.html',h.root).pathname;await assert.rejects(h.dispatch('install'));assert.equal(h.state.skipped,0);assert.equal(h.state.claimed,0);assert.equal(await (await old.match(new URL('app.html',h.root))).text(),'old-game');
 h.state.failPath=null;h.state.tamperPath=new URL('app.html',h.root).pathname;await assert.rejects(h.dispatch('install'),'asset hash mismatch cannot install a mixed release');assert.ok(h.buckets.has('8zsudoku-pwa-v1'));
 h.state.tamperPath=null;await h.dispatch('install');assert.equal(h.state.skipped,0);
 await h.dispatch('message',{data:{type:'ACTIVATE_UPDATE'}});assert.equal(h.state.skipped,1);await h.dispatch('activate');assert.equal(h.state.claimed,1);assert.ok(!h.buckets.has('8zsudoku-pwa-v1'),'same-scope old cache cleaned');assert.ok(h.buckets.has('8zsudoku-pwa-other-scope'),'foreign scope preserved');assert.ok(h.buckets.has('trip-pwa-cache'),'other app preserved');
});


test('release hashes bind complete assets to current LAB and repeatable build check',()=>{
 const r=release();assert.equal(r.schema,'8ZSUDOKU_PWA_RELEASE_V1');assert.equal(r.engine_revision,'0.3.0');assert.equal(r.source.path,'public/S/new/app.html');assert.equal(r.source.sha256,hash(fs.readFileSync(path.join(lab,'app.html'))));
 assert.deepEqual(Object.keys(r.assets_sha256).sort(),['index.html','app.html','pwa.js','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'].sort());for(const[file,digest]of Object.entries(r.assets_sha256))assert.equal(hash(read(file)),digest,file);assert.equal(hash(read('sw.js')),r.worker_sha256);assert.match(r.release_id,/^[0-9a-f]{64}$/);
 execFileSync(process.execPath,[path.resolve(__dirname,'../scripts/build-sudoku-pwa.cjs'),'--check'],{encoding:'utf8'});
});

function clientHarness(firstInstall=false){
 const dom=new JSDOM(read('index.html').toString(),{url:'https://example.test/bd-chessdb/S/PWA/',runScripts:'outside-only'});
 const bus=()=>{const listeners=new Map();return{addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},removeEventListener(type,fn){listeners.set(type,(listeners.get(type)||[]).filter(x=>x!==fn));},dispatch(type){for(const fn of listeners.get(type)||[])fn({type});}};};
 const state={updates:0,reloads:0,posts:[],registrations:[],flushes:0,flushOK:true,now:Date.now()};
 const reg=Object.assign(bus(),{active:firstInstall?null:{state:'activated'},installing:firstInstall?Object.assign(bus(),{state:'installing'}):null,waiting:firstInstall?null:{postMessage:m=>state.posts.push(JSON.parse(JSON.stringify(m)))},update:async()=>{state.updates++;}});
 const sw=Object.assign(bus(),{controller:firstInstall?null:{state:'activated'},register:async(url,options)=>{state.registrations.push({url,options});return reg;},ready:firstInstall?new Promise(()=>{}):Promise.resolve(reg)});
 const navigator={onLine:true,serviceWorker:sw};const location={href:dom.window.location.href,origin:'https://example.test',pathname:'/bd-chessdb/S/PWA/',reload:()=>{state.reloads++;}};
 const window=Object.assign(bus(),{document:dom.window.document,navigator,location,setTimeout,clearTimeout,matchMedia:()=>({matches:false,addEventListener(){}})});
 class Clock extends Date{static now(){return state.now;}}
 const frame=dom.window.document.getElementById('sudokuApp');assert.ok(frame,'PWA iframe has stable update bridge');frame.contentWindow.SudokuNavigator={flushForUpdate(){state.flushes++;return state.flushOK;}};
 vm.runInNewContext(read('pwa.js').toString(),{window,navigator,document:dom.window.document,location,console,URL,Date:Clock,Event:dom.window.Event,Promise,setTimeout,clearTimeout,setInterval:()=>0,clearInterval:()=>{}});
 return{dom,state,sw,reg,window,el:id=>dom.window.document.getElementById(id)};
}

test('shell prompts before activation, handles save failure, checks focus/online and never reloads another tab',async t=>{
 const h=clientHarness();t.after(()=>h.dom.window.close());await nextTick();await nextTick();
 assert.equal(h.state.registrations.length,1);assert.equal(h.state.registrations[0].url,'./sw.js');assert.equal(h.state.registrations[0].options.scope,'./');
 assert.equal(h.state.posts.length,0,'ready update does not activate itself');assert.equal(h.state.reloads,0,'open game is preserved');assert.equal(h.el('pwaUpdate').hidden,false,'waiting release is offered');
 const other=clientHarness();t.after(()=>other.dom.window.close());await nextTick();other.sw.dispatch('controllerchange');assert.equal(other.state.reloads,0,'another tab activating the update cannot reload this game');
 h.state.flushOK=false;h.el('pwaUpdateButton').click();await nextTick();assert.ok(h.state.flushes>0);assert.equal(h.state.posts.length,0,'quota/save failure blocks activation');assert.equal(h.state.reloads,0,'quota/save failure blocks reload');
 const before=h.state.updates;h.state.now+=600000;h.window.dispatch('focus');await nextTick();assert.ok(h.state.updates>before,'focus checks for an update');
 const afterFocus=h.state.updates;h.state.now+=600000;h.window.dispatch('online');await nextTick();assert.ok(h.state.updates>afterFocus,'coming online checks for an update');
 h.state.flushOK=true;h.el('pwaUpdateButton').click();await nextTick();assert.ok(h.state.posts.some(m=>m.type==='ACTIVATE_UPDATE'),'user confirms saved-game update');assert.equal(h.state.reloads,0,'reload waits for controller replacement');
 h.sw.dispatch('controllerchange');assert.equal(h.state.reloads,1,'initiating tab reloads after explicit saved update');
 const initial=clientHarness(true);t.after(()=>initial.dom.window.close());await nextTick();assert.equal(initial.el('pwaStatus').textContent,'PREPARING OFFLINE');initial.reg.installing.state='redundant';initial.reg.installing.dispatch('statechange');assert.equal(initial.el('pwaStatus').textContent,'OFFLINE SETUP FAILED','failed first install is not reported ready');initial.window.dispatch('online');assert.equal(initial.el('pwaStatus').textContent,'OFFLINE SETUP FAILED','connectivity event retains setup failure');
});


test('an evicted cache entry can only be repaired with same-release bytes',async()=>{
 const h=workerHarness();await h.dispatch('install');const key=new URL('app.html',h.root).href;const bucket=[...h.buckets.values()].find(x=>x.has(key));assert.ok(bucket);bucket.delete(key);
 h.state.tamperPath=new URL('app.html',h.root).pathname;await assert.rejects(h.dispatch('fetch',{request:new Request(key)}));assert.equal(bucket.has(key),false,'different release cannot pollute an evicted entry');
 h.state.tamperPath=null;const repaired=await h.dispatch('fetch',{request:new Request(key)});assert.equal(hash(Buffer.from(await repaired.arrayBuffer())),hash(read('app.html')));assert.ok(bucket.has(key));
});


test('new play or save failure between update click and controller change prevents reload',async t=>{
 const h=clientHarness();t.after(()=>h.dom.window.close());await nextTick();await nextTick();
 h.el('pwaUpdateButton').click();await nextTick();assert.ok(h.state.posts.some(m=>m.type==='ACTIVATE_UPDATE'));assert.equal(h.state.flushes,1);assert.equal(h.state.reloads,0);
 h.state.flushOK=false;h.sw.dispatch('controllerchange');assert.equal(h.state.flushes,2,'flush is rechecked at the actual reload boundary');assert.equal(h.state.reloads,0,'busy game or new quota failure must keep the tab open');assert.equal(h.el('pwaUpdate').hidden,false);assert.equal(h.el('pwaUpdateButton').disabled,false);assert.match(h.el('pwaUpdateButton').textContent,/reload/i);
 h.state.flushOK=true;h.el('pwaUpdateButton').click();await nextTick();assert.equal(h.state.reloads,1,'later successful explicit save reloads the new controller');
});

test('reinstall cache-write failure preserves an already installed identical release',async()=>{
 const h=workerHarness();await h.dispatch('install');const installedName=[...h.buckets.keys()][0],key=new URL('app.html',h.root).href;const before=hash(Buffer.from(await h.buckets.get(installedName).get(key).clone().arrayBuffer()));
 h.state.failPutPath=new URL('app.html',h.root).pathname;await assert.rejects(h.dispatch('install'));assert.ok(h.buckets.has(installedName),'preexisting same-release cache must survive quota failure');assert.equal(hash(Buffer.from(await h.buckets.get(installedName).get(key).clone().arrayBuffer())),before);assert.equal(h.state.skipped,0);
 const fresh=workerHarness();fresh.state.failPutPath=new URL('app.html',fresh.root).pathname;await assert.rejects(fresh.dispatch('install'));assert.equal(fresh.buckets.size,0,'new incomplete cache is discarded');
});
