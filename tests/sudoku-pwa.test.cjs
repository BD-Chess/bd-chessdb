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
const base=path.resolve(__dirname,'../public/S/new');
const lab=path.resolve(__dirname,'../public/S/new');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=file=>fs.readFileSync(path.join(base,file));
const release=()=>JSON.parse(read('release.json'));
const nextTick=()=>new Promise(r=>setTimeout(r,0));
function workerHarness(scope='/S/new/', directory='new'){
 const root=new URL(scope,'https://example.test'),handlers={},buckets=new Map();
 const local=path.resolve(__dirname,'../public/S',directory), read=file=>fs.readFileSync(path.join(local,file));
 const assetMap=new Map(Object.keys(JSON.parse(read('release.json')).assets_sha256).map(name=>[new URL(name,root).pathname,name]));
 const state={offline:false,skipped:0,claimed:0,requests:[],failPath:null,tamperPath:null,failPutPath:null};
 const key=input=>new URL(input.url||input,root).href;
 const response=bytes=>{const r=new Response(bytes,{status:200});Object.defineProperty(r,'type',{value:'basic'});return r;};
 async function fetch(input){const url=new URL(key(input));state.requests.push(url.href);if(state.offline||url.pathname===state.failPath)throw Error('offline/unavailable');const relative=assetMap.get(url.pathname);assert.ok(relative,'only packaged URL requested: '+url.pathname);return response(url.pathname===state.tamperPath?Buffer.from('wrong-release-payload'):read(relative));}
 const caches={keys:async()=>[...buckets.keys()],delete:async name=>buckets.delete(name),open:async name=>{if(!buckets.has(name))buckets.set(name,new Map());const map=buckets.get(name);return{match:async input=>map.get(key(input))?.clone(),put:async(input,value)=>{if(new URL(key(input)).pathname===state.failPutPath)throw Error('cache quota exceeded');assert.ok(value.ok,'bad status cannot cache');map.set(key(input),value.clone());},keys:async()=>[...map.keys()].map(url=>new Request(url)),delete:async input=>map.delete(key(input)),addAll:async inputs=>{const all=await Promise.all(inputs.map(async input=>[key(input),await fetch(input)]));for(const[url,value]of all)map.set(url,value);}};}};
 const self={registration:{scope:root.href},location:{origin:root.origin,href:new URL('sw.js',root).href},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>{state.skipped++;},clients:{claim:async()=>{state.claimed++;}}};
 vm.runInNewContext(read('sw.js').toString(),{self,caches,fetch,URL,Request,Response,Set,Map,crypto:crypto.webcrypto,TextEncoder,Uint8Array,ArrayBuffer,console});
 async function dispatch(name,extra={}){let promise;assert.ok(handlers[name],name+' listener present');handlers[name]({waitUntil:p=>{promise=p;},respondWith:p=>{promise=p;},...extra});return promise;}
 return{root,state,buckets,caches,dispatch};
}

test('CURRENT and LAB install in place; legacy identity and source stay recoverable',()=>{
 for(const [dir,name] of [['','8zSudoku'],['new','8zSudoku LAB'],['PWA','8zSudoku']]){
  const p=path.resolve(__dirname,'../public/S',dir),m=JSON.parse(fs.readFileSync(path.join(p,'manifest.webmanifest')));
  assert.deepEqual([m.id,m.start_url,m.scope],['./','./','./']);assert.equal(m.name,name);assert.equal(m.display,'standalone');
  const dom=new JSDOM(fs.readFileSync(path.join(p,'index.html'),'utf8'));
  assert.deepEqual([...dom.window.document.querySelectorAll('.version-nav a')].map(x=>x.textContent),['CURRENT','LAB','PREVIOUS']);
  assert.equal(!!dom.window.document.getElementById('pwaInstall'),dir!=='PWA');dom.window.close();
 }
 const legacy=fs.readFileSync(path.resolve(__dirname,'../public/S/PWA/app.html'));
 assert.equal(hash(legacy),'73639dde9e8e7534fd1090b5b422206820583a77a0b59e904dfdd906262a048b','legacy recovery game stays frozen');
 assert.ok(read('app.html').toString().includes("NS='ai8SudokuNavigatorV020'"),'LAB data namespace unchanged');
});

for(const [scope,dir] of [['/S/',''],['/bd-chessdb/S/',''],['/S/new/','new'],['/bd-chessdb/S/new/','new'],['/S/PWA/','PWA']])test('complete coherent offline release and request boundary at '+scope,async()=>{
 const rootPath=path.resolve(__dirname,'../public/S',dir), read=file=>fs.readFileSync(path.join(rootPath,file));
 const h=workerHarness(scope,dir);await h.dispatch('install');assert.equal(h.state.skipped,0,'installation waits for user approval');await h.dispatch('activate');h.state.offline=true;
 const assets=['',...Object.keys(JSON.parse(read('release.json')).assets_sha256)];
 for(const asset of assets){for(const query of ['', '?v=offline-check']){const r=await h.dispatch('fetch',{request:new Request(new URL(asset+query,h.root))});assert.ok(r?.ok,asset+query+' available offline');assert.equal(hash(Buffer.from(await r.arrayBuffer())),hash(read(asset||'index.html')),asset+' bytes');}}
 for(const url of ['https://third-party.test/x',new URL('../other-channel/app.html',h.root),new URL('private.json',h.root),new URL('/api/sudoku',h.root),new URL('unknown.json',h.root)])assert.equal(await h.dispatch('fetch',{request:new Request(url)}),undefined,String(url)+' not intercepted');
 assert.equal(await h.dispatch('fetch',{request:new Request(new URL('app.html',h.root),{method:'POST'})}),undefined,'POST not cached');
 const requests=h.state.requests.length;h.state.offline=false;h.state.tamperPath=new URL('index.html',h.root).pathname;const still=await h.dispatch('fetch',{request:new Request(new URL('index.html?new=1',h.root))});assert.equal(hash(Buffer.from(await still.arrayBuffer())),hash(read('index.html')));assert.equal(h.state.requests.length,requests,'installed snapshot remains coherent instead of mixing live files');
});

test('failed or mixed release install preserves old cache; only explicit activation skips waiting',async()=>{
 const h=workerHarness();const old=await h.caches.open('8zsudoku-pwa-v1');await old.put(new URL('app.html',h.root),new Response('old-game'));
 const foreign=await h.caches.open('8zsudoku-pwa-other-scope');await foreign.put('https://example.test/elsewhere/S/PWA/app.html',new Response('other-scope'));await h.caches.open('trip-pwa-cache');
 h.state.failPath=new URL('app.html',h.root).pathname;await assert.rejects(h.dispatch('install'));assert.equal(h.state.skipped,0);assert.equal(h.state.claimed,0);assert.equal(await (await old.match(new URL('app.html',h.root))).text(),'old-game');
 h.state.failPath=null;h.state.tamperPath=new URL('app.html',h.root).pathname;await assert.rejects(h.dispatch('install'),'asset hash mismatch cannot install a mixed release');assert.ok(h.buckets.has('8zsudoku-pwa-v1'));
 h.state.tamperPath=null;await h.dispatch('install');assert.equal(h.state.skipped,0);
 await h.dispatch('message',{data:{type:'ACTIVATE_UPDATE'}});assert.equal(h.state.skipped,1);await h.dispatch('activate');assert.equal(h.state.claimed,1);assert.ok(!h.buckets.has('8zsudoku-pwa-v1'),'same-scope old cache cleaned');assert.ok(h.buckets.has('8zsudoku-pwa-other-scope'),'foreign scope preserved');assert.ok(h.buckets.has('trip-pwa-cache'),'other app preserved');
});


test('each channel package binds its exact assets and reproducible worker',()=>{
 for(const dir of ['','new','PWA']){
  const p=path.resolve(__dirname,'../public/S',dir),r=JSON.parse(fs.readFileSync(path.join(p,'release.json')));
  assert.equal(r.schema,'8ZSUDOKU_CHANNEL_RELEASE_V2');assert.equal(r.source_policy,'SAME_CHANNEL_NO_GAME_COPY');
  for(const [name,digest] of Object.entries(r.assets_sha256))assert.equal(hash(fs.readFileSync(path.join(p,name))),digest,name);
  assert.equal(hash(fs.readFileSync(path.join(p,'sw.js'))),r.worker_sha256);
 }
 execFileSync(process.execPath,[path.resolve(__dirname,'../scripts/build-sudoku-pwa.cjs'),'--check']);
});

function clientHarness(firstInstall=false){
 const dom=new JSDOM(read('index.html').toString(),{url:'https://example.test/bd-chessdb/S/new/',runScripts:'outside-only'});
 const bus=()=>{const listeners=new Map();return{addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},removeEventListener(type,fn){listeners.set(type,(listeners.get(type)||[]).filter(x=>x!==fn));},dispatch(type){for(const fn of listeners.get(type)||[])fn({type});}};};
 const state={updates:0,reloads:0,posts:[],registrations:[],flushes:0,flushOK:true,now:Date.now()};
 const reg=Object.assign(bus(),{scope:'https://example.test/bd-chessdb/S/new/',active:firstInstall?null:Object.assign(bus(),{state:'activated'}),installing:firstInstall?Object.assign(bus(),{state:'installing'}):null,waiting:firstInstall?null:{postMessage:m=>state.posts.push(JSON.parse(JSON.stringify(m)))},update:async()=>{state.updates++;}});
 const sw=Object.assign(bus(),{controller:firstInstall?null:{state:'activated',scriptURL:'https://example.test/bd-chessdb/S/new/sw.js'},register:async(url,options)=>{state.registrations.push({url,options});return reg;},ready:firstInstall?new Promise(()=>{}):Promise.resolve(reg)});
 const navigator={onLine:true,serviceWorker:sw};const location={href:dom.window.location.href,origin:'https://example.test',pathname:'/bd-chessdb/S/new/',reload:()=>{state.reloads++;}};
 const window=Object.assign(bus(),{document:dom.window.document,navigator,location,setTimeout,clearTimeout,matchMedia:()=>({matches:false,addEventListener(){}})});
 class Clock extends Date{static now(){return state.now;}}
 const frame=dom.window.document.getElementById('sudokuGame');assert.ok(frame,'PWA iframe has stable update bridge');frame.contentWindow.SudokuNavigator={flushForUpdate(){state.flushes++;return state.flushOK;}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../public/S/_pwa/client.js'),'utf8'),{window,navigator,document:dom.window.document,location,console,URL,Date:Clock,Event:dom.window.Event,Promise,setTimeout,clearTimeout,setInterval:()=>0,clearInterval:()=>{}});
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
 h.sw.dispatch('controllerchange');await nextTick();assert.equal(h.state.reloads,1,'initiating tab reloads after explicit saved update');
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
 h.state.flushOK=false;h.sw.dispatch('controllerchange');await nextTick();assert.equal(h.state.flushes,2,'flush is rechecked at the actual reload boundary');assert.equal(h.state.reloads,0,'busy game or new quota failure must keep the tab open');assert.equal(h.el('pwaUpdate').hidden,false);assert.equal(h.el('pwaUpdateButton').disabled,false);assert.match(h.el('pwaUpdateButton').textContent,/reload/i);
 h.state.flushOK=true;h.el('pwaUpdateButton').click();await nextTick();assert.equal(h.state.reloads,1,'later successful explicit save reloads the new controller');
});

test('reinstall cache-write failure preserves an already installed identical release',async()=>{
 const h=workerHarness();await h.dispatch('install');const installedName=[...h.buckets.keys()][0],key=new URL('app.html',h.root).href;const before=hash(Buffer.from(await h.buckets.get(installedName).get(key).clone().arrayBuffer()));
 h.state.failPutPath=new URL('app.html',h.root).pathname;await assert.rejects(h.dispatch('install'));assert.ok(h.buckets.has(installedName),'preexisting same-release cache must survive quota failure');assert.equal(hash(Buffer.from(await h.buckets.get(installedName).get(key).clone().arrayBuffer())),before);assert.equal(h.state.skipped,0);
 const fresh=workerHarness();fresh.state.failPutPath=new URL('app.html',fresh.root).pathname;await assert.rejects(fresh.dispatch('install'));assert.equal(fresh.buckets.size,0,'new incomplete cache is discarded');
});

test('LAB update persists Notes, Redo and library; quota/concurrent writer blocks reload',async t=>{
 const {boot,savedFixture,NS,until}=require('./sudoku-ui-harness.cjs');
 const h=await boot(t);await until(()=>h.w.SudokuNavigator.product.ready(),'product boot');await h.w.SudokuNavigator.restore(savedFixture('0.2.0'));h.w.stopTimer();
 h.w.selectCell(2);h.w.toggleNotes();h.w.placeNumber(4);h.w.undoMove();
 assert.equal(await h.w.SudokuNavigator.flushForUpdate(),true);
 const saved=JSON.parse(h.w.localStorage.getItem(NS+'.session'));assert.equal(saved.redo.length,1);
 const library=JSON.parse(h.w.localStorage.getItem(NS+'.library'));assert.equal(library.entries[0].session.redo.length,1);
 const second=await boot(t,h.store());await until(()=>second.w.SudokuNavigator.product.ready(),'restored product');await until(()=>!!second.w.SudokuNavigator.state(),'restored game');second.w.redoMove();assert.deepEqual(second.get('[...notes[0][2]]'),[4]);
 const proto=Object.getPrototypeOf(h.w.localStorage),original=proto.setItem;
 proto.setItem=function(){throw Error('QuotaExceededError');};assert.equal(await h.w.SudokuNavigator.flushForUpdate(),false);proto.setItem=original;
 second.w.localStorage.setItem(NS+'.library','{"foreignWriter":true}');assert.equal(await second.w.SudokuNavigator.flushForUpdate(),false);
});

function currentHarness(t,stored={}){
 const zlib=require('node:zlib');const p=path.resolve(__dirname,'../public/S/current');
 const compressed=Array.from({length:8},(_,i)=>fs.readFileSync(path.join(p,'payload/part-'+String(i+1).padStart(2,'0')+'.txt'),'utf8').trim()).join('');
 const html=zlib.gunzipSync(Buffer.from(compressed,'base64')).toString();
 const dom=new JSDOM(html,{url:'https://example.test/S/current/',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;
 w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.alert=()=>{};w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=function(){};
 for(const [key,value] of Object.entries(stored))w.localStorage.setItem(key,value);
 for(const script of w.document.querySelectorAll('script'))if(!script.src)vm.runInContext(script.textContent,dom.getInternalVMContext());
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const script of ['../_pwa/current-ui.js','pwa-bridge.js','../_pwa/i18n.js'])vm.runInContext(fs.readFileSync(path.join(p,script),'utf8'),dom.getInternalVMContext());
 t.after(()=>{w.SudokuI18n?.dispose();w.close();});return{w,store:()=>Object.fromEntries(Array.from({length:w.localStorage.length},(_,i)=>{const k=w.localStorage.key(i);return[k,w.localStorage.getItem(k)];}))};
}
test('frozen CURRENT update adapter restores board, Notes, Undo and timer without touching LAB or legacy data',t=>{
 const {fixture,fixtureSolution}=require('./sudoku-ui-harness.cjs');
 const h=currentHarness(t,{'ai8SudokuNavigatorV020.session':'lab-data','ai8SudokuNavigatorV020PWA.session':'legacy-data'});
 h.w.AI8SudokuTestAPI.loadPuzzle(fixture,fixtureSolution);h.w.AI8SudokuTestAPI.selectCell(2);h.w.AI8SudokuTestAPI.toggleNotes();h.w.AI8SudokuTestAPI.placeValue(4);h.w.stopTimer();h.w.eval('timerSeconds=123');
 assert.equal(h.w.SudokuCurrentPWA.flushForUpdate(),true);const stored=h.store();
 assert.equal(stored['ai8SudokuNavigatorV020.session'],'lab-data');assert.equal(stored['ai8SudokuNavigatorV020PWA.session'],'legacy-data');
 const restored=currentHarness(t,stored);assert.equal(restored.w.eval('timerSeconds'),123);assert.equal(restored.w.eval('notes[0][2].has(4)'),true);restored.w.AI8SudokuTestAPI.undo();assert.equal(restored.w.eval('notes[0][2].has(4)'),false);
 restored.w.localStorage.setItem('8zSudokuCurrent.pwaSessionV1','newer-tab');assert.equal(restored.w.SudokuCurrentPWA.flushForUpdate(),false);
});

test('LAB EN/SL covers gameplay, settings, lessons and restoration without translating machine state',async t=>{
 const {boot,savedFixture,until,NS}=require('./sudoku-ui-harness.cjs');
 const h=await boot(t);await until(()=>h.w.SudokuNavigator.product.ready(),'LAB ready');await h.w.SudokuNavigator.restore(savedFixture('0.2.0'));h.w.stopTimer();
 await nextTick();const i18n=h.w.SudokuI18n;assert.ok(i18n);const before=JSON.stringify(h.w.SudokuNavigator.export().session);
 i18n.set('sl');await nextTick();assert.equal(h.w.document.documentElement.lang,'sl');assert.equal(h.el('plNewsOpen').textContent,'Kaj je novega');assert.equal(h.el('plGameStatus').textContent,'Lahka · Shranjena igra obnovljena');
 assert.equal(h.el('plNotice').parentElement.className,'col-center');assert.equal(h.el('status').parentElement.className,'col-center');
 assert.equal(JSON.stringify(h.w.SudokuNavigator.export().session),before,'locale does not mutate game');
 h.w.SudokuNavigator.ui.openSettings();await nextTick();assert.equal(h.el('navModalTitle').textContent,'Nastavitve');assert.equal(h.el('plPref-theme').querySelector('[value="light"]').textContent,'Svetla');assert.equal(h.el('plPref-entryMode').querySelector('[value="number"]').value,'number');h.el('navClose').click();
 for(let technique=0;technique<8;technique++){h.w.SudokuNavigator.product.lesson(technique);await nextTick();assert.doesNotMatch(h.el('navModalBody').textContent,/Teaching example|Outlined cells|Only one cell|Digit \d|are confined|Pivot |The player grid/,'lesson '+technique+' translated');assert.equal(h.el('plExercise').textContent,'Začni samostojno vajo');h.el('navClose').click();}
 h.w.SudokuNavigator.product.tutorialDialog();await nextTick();assert.equal(h.el('navModalTitle').textContent,'Majhen prostor za vajo');h.el('plTutorialCell').click();await nextTick();assert.equal(h.el('plTutorialFeedback').textContent,'Zdaj izberi 4.');h.el('plTutorialSkip').click();
 h.w.selectCell(2);h.w.toggleNotes();h.w.placeNumber(4);await nextTick();assert.equal(h.el('notesBtn').textContent,'Zapiski: DA');assert.equal(await h.w.SudokuNavigator.flushForUpdate(),true);
 const stored=h.store();assert.equal(stored['8zSudoku.ui.language'],'sl');const again=await boot(t,stored);await until(()=>again.w.SudokuNavigator.product.ready(),'reload ready');await until(()=>!!again.w.SudokuNavigator.state(),'game restored');await nextTick();assert.equal(again.w.SudokuI18n.get(),'sl');assert.deepEqual(again.get('[...notes[0][2]]'),[4]);
 i18n.set('en');await nextTick();assert.equal(h.el('plNewsOpen').textContent,'What’s new');assert.equal(h.el('notesBtn').textContent,'Notes: ON');assert.equal(h.el('navPolicy').value,'REAL');
});

test('CURRENT gets centered Play/Learn, quiet title and EN/SL without replacing stable engine',async t=>{
 const {fixture,fixtureSolution}=require('./sudoku-ui-harness.cjs');const h=currentHarness(t);await nextTick();
 const w=h.w,$=id=>w.document.getElementById(id);w.SudokuI18n.set('sl');await nextTick();
 assert.equal($('currentNews').textContent,'Kaj je novega');assert.equal($('currentTutorial').parentElement.parentElement.className,'col-center');assert.equal(w.document.querySelector('[data-view-button="play"]').textContent,'Igra');
 w.document.querySelector('[data-view-button="learn"]').click();assert.equal(w.document.body.dataset.view,'learn');assert.equal($('proofCoachPanel').hidden,false);
 $('currentTutorial').click();await nextTick();$('currentPracticeCell').click();await nextTick();assert.equal($('currentPracticeStatus').textContent,'Zdaj izberi 4.');$('currentPracticeNumber').click();assert.equal($('currentPracticeCell').textContent,'4');$('currentPracticeUndo').click();assert.equal($('currentPracticeCell').textContent,'·');$('currentDialogClose').click();
 w.AI8SudokuTestAPI.loadPuzzle(fixture,fixtureSolution);w.AI8SudokuTestAPI.selectCell(2);w.AI8SudokuTestAPI.toggleNotes();w.AI8SudokuTestAPI.placeValue(4);w.stopTimer();assert.equal(w.SudokuCurrentPWA.flushForUpdate(),true);const again=currentHarness(t,h.store());await nextTick();assert.equal(again.w.SudokuI18n.get(),'sl');assert.equal(again.w.eval('notes[0][2].has(4)'),true);
 w.SudokuI18n.set('en');assert.equal($('currentNews').textContent,'What’s new');
});
