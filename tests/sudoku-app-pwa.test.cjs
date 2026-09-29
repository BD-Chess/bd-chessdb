'use strict';
// Automated worker/client contracts; physical iOS installation remains device QA.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {JSDOM}=require('jsdom');
const dir=path.resolve(__dirname,'../public/S/app'),read=name=>fs.readFileSync(path.join(dir,name));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),tick=()=>new Promise(r=>setTimeout(r,0));
function harness(options={}){
 const root='https://example.test/bd-chessdb/S/app/';
 const dom=new JSDOM('<!doctype html><body>'+(options.preview?'<button id="appPwaOpen">Install</button><iframe id="game"></iframe>':'')+'</body>',{url:root+(options.preview?'':'app.html')});
 const bus=()=>{const listeners={};return{addEventListener(type,fn){(listeners[type]||=[]).push(fn);},dispatch(type,event={}){for(const fn of listeners[type]||[])fn({type,...event});}};};
 const state={updates:0,reloads:0,posts:[],registrations:[],flushes:0,flushOK:true,now:Date.now(),updateFails:false,registerFails:!!options.registerFails,prompts:0};
 const reg=Object.assign(bus(),{scope:root,active:options.firstInstall?null:Object.assign(bus(),{state:'activated'}),installing:options.firstInstall?Object.assign(bus(),{state:'installing'}):null,waiting:options.firstInstall?null:{postMessage:m=>state.posts.push(m)},update:async()=>{state.updates++;if(state.updateFails)throw Error('offline');}});
 const sw=Object.assign(bus(),{controller:options.firstInstall?null:{scriptURL:root+'sw.js'},register:async(url,settings)=>{state.registrations.push({url,settings});if(state.registerFails)throw Error('network interrupted');return reg;}});
 const navigator={onLine:true,serviceWorker:sw},location={protocol:options.protocol||'https:',href:dom.window.location.href,reload(){state.reloads++;}};
 const window=Object.assign(bus(),{document:dom.window.document,navigator,location,matchMedia:()=>({matches:!!options.installed}),Capacitor:options.native?{isNativePlatform:()=>true}:undefined});window.parent=window;
 const app=options.preview?dom.window.document.getElementById('game').contentWindow:window;
 app.SudokuNavigator={flushForUpdate:async()=>{state.flushes++;return state.flushOK;}};app.SudokuI18n={get:()=>options.locale||'en'};
 class Clock extends Date{static now(){return state.now;}}
 vm.runInNewContext(read('pwa.js').toString(),{window,navigator,document:dom.window.document,location,URL,Date:Clock,MutationObserver:dom.window.MutationObserver,console});
 return{dom,state,sw,reg,window,navigator,el:id=>dom.window.document.getElementById(id)};
}

test('APP has one stable install identity, direct game launch and a complete hash-bound package',()=>{
 const manifest=JSON.parse(read('manifest.webmanifest')),release=JSON.parse(read('release.json'));
 assert.deepEqual([manifest.id,manifest.start_url,manifest.scope,manifest.display],['./','./app.html','./','standalone']);
 assert.equal(release.channel,'APP');assert.equal(release.schema,'8ZSUDOKU_APP_RELEASE_V2');
 assert.equal(release.worker_sha256,hash(read('sw.js')));
 for(const [name,digest] of Object.entries(release.assets_sha256)){assert.ok(!name.includes('..'),'cache stays within APP');assert.equal(hash(read(name)),digest,name);}
 for(const file of ['app.html','index.html']){const dom=new JSDOM(read(file));assert.equal(dom.window.document.querySelector('link[rel=manifest]').getAttribute('href'),'./manifest.webmanifest');assert.equal(dom.window.document.querySelector('link[rel=apple-touch-icon]').getAttribute('href'),'./icon-180.png');dom.window.close();}
 const preview=read('index.html').toString();
 assert.doesNotMatch(preview,/window\.innerWidth\s*<=|display-mode:\s*standalone|dataset\.appRedirect/,'APP shell selection never depends on viewport width or display mode');
 assert.match(preview,/navigator\.userAgentData/,'APP shell can use the browser mobile hint when available');
 assert.match(preview,/data-app-shell=phone/,'normal phone mode removes the simulated device chrome');
 assert.match(preview,/class="device"/,'desktop, tablet and requested-desktop modes retain the phone preview');
 assert.match(preview,/game\.src=['"]\.\/app\.html/,'game stays embedded inside the phone preview');
 assert.match(read('app.html').toString(),/viewport-fit=cover/);
});

for(const preview of [false,true])test('APP '+(preview?'preview':'direct')+' saves before activation and rechecks before reload',async t=>{
 const h=harness({preview});t.after(()=>h.dom.window.close());await tick();
 assert.equal(h.state.registrations.length,1);assert.equal(h.state.registrations[0].url,'./sw.js');assert.equal(h.state.registrations[0].settings.scope,'./');assert.equal(h.state.registrations[0].settings.updateViaCache,'none');
 assert.equal(h.state.posts.length,0);assert.equal(h.state.reloads,0);assert.equal(h.el('appPwaUpdate').hidden,false);
 h.state.flushOK=false;h.el('appPwaUpdateButton').click();await tick();assert.equal(h.state.posts.length,0);assert.equal(h.state.reloads,0);assert.match(h.el('appPwaUpdateMessage').textContent,/could not be saved/);
 h.state.flushOK=true;h.el('appPwaUpdateButton').click();await tick();assert.equal(h.state.posts[0].type,'ACTIVATE_UPDATE');assert.equal(h.state.reloads,0);
 h.state.flushOK=false;h.sw.dispatch('controllerchange');await tick();assert.equal(h.state.flushes,3);assert.equal(h.state.reloads,0,'new edits or quota failure between activation and reload keep the game open');
 h.state.flushOK=true;h.el('appPwaUpdateButton').click();await tick();assert.equal(h.state.reloads,1);
});

test('APP first install never reloads play; another tab activation requires a separate save',async t=>{
 const h=harness({firstInstall:true});t.after(()=>h.dom.window.close());await tick();
 assert.match(h.el('appPwaStatus').textContent,/Preparing/);h.reg.installing.state='redundant';h.reg.installing.dispatch('statechange');assert.match(h.el('appPwaStatus').textContent,/failed/);
 h.window.dispatch('online');assert.match(h.el('appPwaStatus').textContent,/failed/);
 h.sw.controller={scriptURL:h.reg.scope+'sw.js'};h.sw.dispatch('controllerchange');await tick();assert.equal(h.state.reloads,0);assert.match(h.el('appPwaStatus').textContent,/Ready for offline/);assert.equal(h.el('appPwaUpdate').hidden,true);
 const other=harness();t.after(()=>other.dom.window.close());await tick();other.sw.dispatch('controllerchange');await tick();assert.equal(other.state.reloads,0);assert.match(other.el('appPwaUpdateButton').textContent,/Save & reload/);
});

test('APP install and retry UI is localized and checks again after focus/online',async t=>{
 const h=harness({locale:'sl',preview:true});t.after(()=>h.dom.window.close());await tick();
 h.el('appPwaOpen').click();assert.equal(h.el('appPwaPanel').hidden,false);assert.match(h.el('appPwaStatus').textContent,/Pripravljeno/);
 h.el('appPwaInstall').click();assert.equal(h.el('appPwaInstallHelp').hidden,false);assert.match(h.el('appPwaInstallHelp').textContent,/Dodaj na začetni zaslon/);
 let prevented=false;h.window.dispatch('beforeinstallprompt',{preventDefault(){prevented=true;},prompt:async()=>{h.state.prompts++;},userChoice:Promise.resolve({outcome:'accepted'})});h.el('appPwaInstall').click();await tick();assert.ok(prevented);assert.equal(h.state.prompts,1);
 h.navigator.onLine=false;h.window.dispatch('offline');assert.match(h.el('appPwaStatus').textContent,/Brez povezave/);assert.equal(h.el('appPwaCheck').disabled,true);
 const before=h.state.updates;h.navigator.onLine=true;h.state.now+=60000;h.window.dispatch('online');await tick();assert.ok(h.state.updates>before);
 const after=h.state.updates;h.state.now+=60000;h.window.dispatch('focus');await tick();assert.ok(h.state.updates>after);
 h.state.updateFails=true;h.el('appPwaCheck').click();await tick();assert.match(h.el('appPwaUpdateMessage').textContent,/ni uspelo/);h.state.updateFails=false;h.el('appPwaUpdateButton').click();await tick();assert.equal(h.state.reloads,0);
});

test('native and downloaded standalone APP never register the web worker',t=>{
 for(const options of [{native:true},{protocol:'file:'}]){const h=harness(options);t.after(()=>h.dom.window.close());assert.equal(h.state.registrations.length,0);assert.equal(h.el('appPwaPanel'),null);}
});

test('interrupted initial APP setup can be retried without refreshing or losing the game',async t=>{
 const h=harness({registerFails:true});t.after(()=>h.dom.window.close());await tick();assert.match(h.el('appPwaStatus').textContent,/failed/);assert.equal(h.el('appPwaCheck').disabled,false);
 h.state.registerFails=false;h.el('appPwaCheck').click();await tick();assert.equal(h.state.registrations.length,2);assert.match(h.el('appPwaStatus').textContent,/Ready/);assert.equal(h.state.reloads,0);
});

test('APP More opens one usable install dialog and cannot type into the game behind it',async t=>{
 const {boot,savedFixture,until}=require('./sudoku-ui-harness.cjs');
 const h=await boot(t,{}, {width:390,height:844},{lane:'APP'}),w=h.w;await w.SudokuNavigator.restore(savedFixture('0.2.0'));w.stopTimer();w.selectCell(2);
 h.el('uxMore').click();assert.equal(w.document.querySelectorAll('#appPwaMenu').length,1);h.el('appPwaMenu').click();assert.equal(h.el('navModal').hidden,true);assert.equal(h.el('appPwaPanel').hidden,false);
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'4',bubbles:true,cancelable:true}));assert.equal(w.eval('playerGrid[0][2]'),0);
 h.el('appPwaInstall').click();assert.equal(h.el('appPwaInstallHelp').hidden,false,'install help remains clickable after closing More');
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(h.el('appPwaPanel').hidden,true);
 w.SudokuI18n.set('sl');h.el('uxMore').click();h.el('appPwaMenu').click();await until(()=>h.el('appPwaInstall').textContent==='Namesti 8zSudoku','Slovenian install UI');h.el('appPwaClose').click();assert.equal(h.el('appPwaPanel').hidden,true);assert.deepEqual(h.errors,[]);
});

test('APP update flush persists Notes/Redo and blocks quota failures without touching LAB',async t=>{
 const {boot,savedFixture,until}=require('./sudoku-ui-harness.cjs');
 const foreign={'ai8SudokuNavigatorV020.session':'lab-marker','8zSudoku.ui.language':'en'};
 const h=await boot(t,foreign,{width:390,height:844},{lane:'APP'}),w=h.w;await until(()=>w.SudokuNavigator.product.ready(),'APP ready');await w.SudokuNavigator.restore(savedFixture('0.2.0'));w.stopTimer();w.selectCell(2);w.toggleNotes();w.placeNumber(4);w.undoMove();
 assert.equal(await w.SudokuNavigator.flushForUpdate(),true);assert.equal(JSON.parse(w.localStorage.getItem('ai8SudokuAppV030.session')).redo.length,1);
 const second=await boot(t,h.store(),{width:390,height:844},{lane:'APP'});await until(()=>second.w.SudokuNavigator.product.ready()&&second.w.SudokuNavigator.state(),'APP restored');second.w.redoMove();assert.deepEqual(second.get('[...notes[0][2]]'),[4]);
 const proto=Object.getPrototypeOf(w.localStorage),original=proto.setItem;proto.setItem=function(){throw Error('QuotaExceededError');};assert.equal(await w.SudokuNavigator.flushForUpdate(),false);proto.setItem=original;
 second.w.localStorage.setItem('ai8SudokuAppV030.library','{"foreignWriter":true}');assert.equal(await second.w.SudokuNavigator.flushForUpdate(),false);
 for(const [key,value] of Object.entries(foreign))assert.equal(w.localStorage.getItem(key),value);assert.deepEqual(h.errors,[]);
});
