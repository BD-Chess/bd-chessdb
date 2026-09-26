'use strict';
// DOM integration with real computation in worker_threads. This does not test
// layout, Safari Worker policies, touch input or downloaded-file browser UI.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {Worker:Thread}=require('node:worker_threads');
const {JSDOM,VirtualConsole}=require('jsdom');
const LANE=process.env.SUDOKU_APP_LANE||'LAB';
assert.ok(['LAB','PWA'].includes(LANE),'SUDOKU_APP_LANE must be LAB or PWA');
const appSegment=LANE==='PWA'?'PWA':'new';
const appPath=path.resolve(__dirname,`../public/S/${appSegment}/app.html`);
const NS='ai8SudokuNavigatorV020'+(LANE==='PWA'?'PWA':'');
const fixture='530070000600195000098000060800060003400803001700020006060000280000419005000080079';
const fixtureSolution='534678912672195348198342567859761423426853791713924856961537284287419635345286179';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,message,ms=10000){const end=Date.now()+ms;while(Date.now()<end){if(fn())return;await sleep(10);}assert.ok(fn(),message);}
const plain=x=>JSON.parse(JSON.stringify(x));
function valid(grid,givens){const b=grid.flat(),p=givens.flat();assert.equal(b.length,81);for(let i=0;i<81;i++)if(p[i])assert.equal(b[i],p[i],'givens retained');for(let k=0;k<9;k++){const row=b.slice(k*9,k*9+9),col=Array.from({length:9},(_,i)=>b[i*9+k]),box=Array.from({length:9},(_,i)=>b[(Math.floor(k/3)*3+Math.floor(i/3))*9+(k%3)*3+i%3]);for(const u of [row,col,box])assert.deepEqual(u.slice().sort(),[1,2,3,4,5,6,7,8,9]);}}
async function boot(t,stored={}){
 const errors=[],requests=[],workers=new Set(),urls=new Map(),downloads=[],delayKinds={},delayedTimers=new Set();let nextUrl=0;
 const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(fs.readFileSync(appPath,'utf8'),{url:`https://mdlxDcc.org/S/${appSegment}/app.html`,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});const w=dom.window;
 w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
 w.alert=s=>errors.push('alert: '+s);w.confirm=()=>true;
 w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLElement.prototype.scrollTo=function(){};
 Object.defineProperty(w.HTMLElement.prototype,'innerText',{get(){return this.textContent;},set(v){this.textContent=String(v);},configurable:true});
 w.Blob=class{constructor(parts,opts){this.source=parts.map(x=>typeof x==='string'?x:String(x)).join('');this.size=Buffer.byteLength(this.source);this.type=opts?.type||'';}async text(){return this.source;}};
 w.URL.createObjectURL=blob=>{const key='blob:test-'+(++nextUrl);urls.set(key,blob.source);return key;};w.URL.revokeObjectURL=key=>urls.delete(key);
 w.HTMLAnchorElement.prototype.click=function(){if(this.download)downloads.push({name:this.download,text:urls.get(this.href)});};
 w.Worker=class{
  constructor(url){const source=urls.get(url);assert.equal(typeof source,'string','worker must use actual Blob source');const wrapper=`const {parentPort,workerData}=require('node:worker_threads');const vm=require('node:vm');const sandbox={console,performance,TextEncoder,TextDecoder,Uint8Array,Uint16Array,Uint32Array,Int32Array,ArrayBuffer,DataView,setTimeout,clearTimeout,structuredClone,crypto:require('node:crypto').webcrypto};sandbox.self=sandbox;sandbox.globalThis=sandbox;sandbox.postMessage=m=>parentPort.postMessage(m);vm.createContext(sandbox);vm.runInContext(workerData,sandbox);parentPort.on('message',data=>sandbox.onmessage({data}));`;this.thread=new Thread(wrapper,{eval:true,workerData:source});workers.add(this);this.thread.on('message',data=>{const delay=delayKinds[this.kind]||0;if(delay){const timer=setTimeout(()=>{delayedTimers.delete(timer);if(!this.stopped)this.onmessage?.({data});},delay);delayedTimers.add(timer);}else this.onmessage?.({data});});this.thread.on('error',e=>{errors.push(e.message);this.onerror?.({message:e.message});});}
  postMessage(data){this.kind=data.kind;requests.push(plain(data));this.thread.postMessage(plain(data));}
  terminate(){this.stopped=true;workers.delete(this);return this.thread.terminate();}
 };
 for(const[k,v]of Object.entries(stored))w.localStorage.setItem(k,v);
 for(const script of w.document.querySelectorAll('script')){assert.ok(!script.src,'app stays self contained');if(!script.type||/javascript/.test(script.type))vm.runInContext(script.textContent,dom.getInternalVMContext());}
 assert.ok(w.SudokuNavigator,'Navigator installed');
 t.after(async()=>{for(const timer of delayedTimers)clearTimeout(timer);for(const wk of workers)await wk.terminate();w.close();});
 return{w,errors,requests,downloads,delayKinds,el:id=>w.document.getElementById(id),get:expression=>plain(w.eval(expression)),store:()=>Object.fromEntries(Array.from({length:w.localStorage.length},(_,i)=>{const k=w.localStorage.key(i);return[k,w.localStorage.getItem(k)];}))};
}
function savedFixture(version){return{schema:'AI8_SUDOKU_NAV_SESSION_V1',version,gameId:'legacy-shape-fixture',diff:'easy',puzzle:[...fixture].map(Number),board:[...fixture].map(Number),notes:Array.from({length:81},()=>[]),time:37,lineage:{base:[...fixture].map(Number),ops:[]},rows:[],assistance:[],recentGains:[],practice:null,history:[],settings:{policy:'REAL',goal:'FLOW',target:1,deep:false}};}

test('fresh game, checked hint and move review execute shipped worker code', {timeout:30000},async t=>{
 const h=await boot(t);const{w}=h;await w.newGame('easy');
 const p=h.get('puzzle'),sol=h.get('solution');valid(sol,p);assert.equal(h.get('currentDiff'),'easy');
 const cert=w.SudokuNavigator.core.exact(p,300000);assert.equal(cert.count,1);assert.ok(cert.complete);
 assert.ok(h.requests.some(x=>x.kind==='generate'),'generation ran in real worker');
 const before=h.get('playerGrid');await w.SudokuNavigator.analyze('reveal');assert.deepEqual(h.get('playerGrid'),before,'hint does not silently fill grid');assert.ok(h.requests.some(x=>x.kind==='search'));
 assert.doesNotMatch(h.el('navCopy').textContent,/unavailable|Error|stopped/i);
 const empty=p.flat().findIndex(v=>!v);w.selectCell(empty,'pointer');w.placeNumber(sol.flat()[empty],'pointer');await w.SudokuNavigator.whenReviewed();
 const review=plain(w.SudokuNavigator.review());assert.equal(review.at(-1).answer,'CORRECT');assert.ok(h.requests.some(x=>x.kind==='review'),'correct move reviewed in real worker');
 assert.deepEqual(h.errors,[]);
});

test('AI step replays real trace to a valid solution and reset keeps givens', {timeout:30000},async t=>{
 const h=await boot(t),{w}=h;assert.equal(await w.SudokuNavigator.restore(savedFixture(w.SudokuNavigator.version)),true);
 assert.equal(h.get('currentStrategy'),'fast','8z Fast is the actual default');
 for(const strategy of ['fast','full']){
  w.setStrategy(strategy);await w.aiStep();assert.ok(h.requests.some(x=>(x.kind==='legacy'||x.kind==='solve')&&x.data.strategy===strategy),'selected solver executed in a real worker');
  const length=h.get('aiLog.length');assert.ok(length>0,'solver produced an animation trace');
  for(let n=0;n<length+1&&h.get('aiStepIndex')<h.get('aiLog.length');n++)await w.aiStep();
  valid(h.get('playerGrid'),h.get('puzzle'));assert.equal(h.get('playerGrid.flat().join(\'\')'),fixtureSolution);
  w.aiReset();assert.deepEqual(h.get('playerGrid'),h.get('puzzle'));
 }
 assert.deepEqual(h.errors,[]);
});

test('save reload and checked export/import preserve a legacy-shaped session', {timeout:30000},async t=>{
 const first=await boot(t);assert.equal(await first.w.SudokuNavigator.restore(savedFixture('0.2.0')),true);
 first.w.selectCell(2,'pointer');first.w.placeNumber(4,'pointer');await first.w.SudokuNavigator.whenReviewed();
 first.w.dispatchEvent(new first.w.Event('pagehide'));const stored=first.store();assert.ok(stored[NS+'.session']);
 const second=await boot(t,stored);await until(()=>second.w.SudokuNavigator.state(),'saved session restored');assert.deepEqual(second.get('playerGrid'),first.get('playerGrid'));assert.equal(second.get('timerSeconds'),37);
 const exported=plain(second.w.SudokuNavigator.export());assert.equal(exported.schema,'AI8_SUDOKU_NAVIGATOR_EXPORT_V1');assert.ok(exported.sha256);assert.match(exported.engineRevision,/^0\.3\./);
 // Prior .2 exports did not contain either optional engineRevision property.
 delete exported.engineRevision;delete exported.session.engineRevision;delete exported.sha256;exported.sha256=second.w.AI8SudokuTruth.sha256(JSON.stringify(exported));
 await second.w.newGame('medium');const newer=second.get('puzzle');const text=JSON.stringify(exported);
 await second.el('navFile').onchange({target:{files:[{size:Buffer.byteLength(text),text:async()=>text}]}});
 assert.deepEqual(second.get('playerGrid'),first.get('playerGrid'));assert.equal(second.el('navLearningMode').value,'FROZEN_TRANSFER');assert.deepEqual(JSON.parse(second.w.localStorage.getItem(NS+'.previousGame')).puzzle,newer.flat());
 const corrupt={...exported,sha256:'0'.repeat(64)},badText=JSON.stringify(corrupt);const current=second.get('playerGrid');await second.el('navFile').onchange({target:{files:[{size:badText.length,text:async()=>badText}]}});assert.deepEqual(second.get('playerGrid'),current);assert.match(second.el('navCopy').textContent,/Import rejected/);
 assert.deepEqual(first.errors,[]);assert.deepEqual(second.errors,[]);
});

test('cancel and overlapping new games cannot apply a stale generation', {timeout:30000},async t=>{
 const h=await boot(t),{w}=h;await w.SudokuNavigator.restore(savedFixture(w.SudokuNavigator.version));const original=h.get('playerGrid');
 const pending=w.newGame('evil');w.SudokuNavigator.cancel();await pending;await sleep(75);assert.deepEqual(h.get('playerGrid'),original,'cancelled worker cannot replace current board');
 const old=w.newGame('evil'),current=w.newGame('easy');await Promise.all([old,current]);assert.equal(h.get('currentDiff'),'easy');const stable=h.get('playerGrid');await sleep(100);assert.deepEqual(h.get('playerGrid'),stable,'stale first generation does not overwrite latest');valid(h.get('solution'),h.get('puzzle'));assert.deepEqual(h.errors,[]);
});


test('cancelled solver and superseded restore cannot overwrite new state', {timeout:30000},async t=>{
 const h=await boot(t),{w}=h;await w.SudokuNavigator.restore(savedFixture('0.2.0'));
 h.delayKinds.solve=350;h.delayKinds.legacy=350;const initial=h.get('playerGrid');
 const solving=w.aiStep();w.SudokuNavigator.cancel();await solving;await sleep(50);assert.deepEqual(h.get('playerGrid'),initial,'cancelled solver cannot apply its first step');
 const resetPending=w.aiSolve();w.aiReset();await resetPending;await sleep(50);assert.deepEqual(h.get('playerGrid'),initial,'Reset invalidates a pending solve even when the board bytes are unchanged');assert.equal(h.get('aiAnimating'),false);assert.equal(h.get('aiStepIndex'),0);
 h.delayKinds.certify=450;const restoring=w.SudokuNavigator.restore(savedFixture('0.2.0')).catch(e=>{assert.match(e.message,/STALE_RESTORE|CANCELLED/);return false;});
 await w.newGame('easy');const fresh=h.get('playerGrid');await restoring;assert.deepEqual(h.get('playerGrid'),fresh,'late certification cannot overwrite the newer game');assert.deepEqual(h.errors,[]);
});

if(LANE==='PWA'){
 test('PWA update flush durably preserves the old session schema and current move', {timeout:30000},async t=>{
  const saved=JSON.stringify(savedFixture('0.2.0')),h=await boot(t,{[NS+'.session']:saved}),{w}=h;
  await until(()=>w.SudokuNavigator.state(),'old PWA session restored');
  assert.equal(typeof w.SudokuNavigator.flushForUpdate,'function','PWA exports explicit update-save bridge');
  assert.equal(h.get('timerSeconds'),37);
  w.selectCell(2,'pointer');w.placeNumber(4,'pointer');await w.SudokuNavigator.whenReviewed();
  const live=h.get('playerGrid');assert.equal(w.SudokuNavigator.flushForUpdate(),true);
  const persisted=JSON.parse(w.localStorage.getItem(NS+'.session'));
  assert.equal(persisted.version,'0.2.0');assert.equal(persisted.board[2],4);assert.equal(persisted.time,37);
  assert.deepEqual(persisted.board,live.flat());assert.equal(persisted.rows.at(-1).answer,'CORRECT');
  const reloaded=await boot(t,h.store());await until(()=>reloaded.w.SudokuNavigator.state(),'flushed game restores');
  assert.deepEqual(reloaded.get('playerGrid'),live);assert.deepEqual(h.errors,[]);assert.deepEqual(reloaded.errors,[]);
 });

 test('PWA failed storage flush returns false and preserves both live game and last saved bytes', {timeout:30000},async t=>{
  const h=await boot(t),{w}=h;await w.SudokuNavigator.restore(savedFixture('0.2.0'));
  assert.equal(w.SudokuNavigator.flushForUpdate(),true);const saved=w.localStorage.getItem(NS+'.session');
  w.selectCell(2,'pointer');w.placeNumber(4,'pointer');await w.SudokuNavigator.whenReviewed();const live=h.get('playerGrid');
  const original=w.Storage.prototype.setItem;let denied=0;
  Object.defineProperty(w.Storage.prototype,'setItem',{configurable:true,value:function(k,v){if(k===NS+'.session'){denied++;throw new w.DOMException('Quota exceeded','QuotaExceededError');}return original.call(this,k,v);}});
  assert.equal(w.SudokuNavigator.flushForUpdate(),false,'shell must not activate update after failed persistence');
  assert.ok(denied>0);assert.deepEqual(h.get('playerGrid'),live);assert.equal(w.localStorage.getItem(NS+'.session'),saved);
  assert.match(h.el('navMemory').textContent,/Not saved to disk|Quota/i);assert.equal(h.downloads.length,0);assert.deepEqual(h.errors,[],'flush does not trigger a reload/navigation');
  Object.defineProperty(w.Storage.prototype,'setItem',{configurable:true,value:original});
  assert.equal(w.SudokuNavigator.flushForUpdate(),true);assert.equal(JSON.parse(w.localStorage.getItem(NS+'.session')).board[2],4,'game can save after storage is available again');
 });

 test('PWA local state stays isolated from LAB and stable storage during save and delete', {timeout:30000},async t=>{
  const external={'ai8SudokuNavigatorV020.session':JSON.stringify(savedFixture('0.2.0')),'ai8SudokuNavigatorV020.machine':'LAB history sentinel','ai8SudokuNavigatorV020.trace':'LAB trace sentinel','ai8SudokuStable.session':'stable game sentinel'};
  const h=await boot(t,external),{w}=h;assert.equal(w.SudokuNavigator.state(),null,'PWA does not load LAB session');
  await w.SudokuNavigator.restore(savedFixture('0.2.0'));assert.equal(w.SudokuNavigator.flushForUpdate(),true);assert.ok(w.localStorage.getItem(NS+'.session'));
  for(const[k,v]of Object.entries(external))assert.equal(w.localStorage.getItem(k),v);
  h.el('navDelete').onclick();
  for(const[k,v]of Object.entries(external))assert.equal(w.localStorage.getItem(k),v,'deleting PWA data preserves other lanes');
  assert.equal(w.localStorage.getItem(NS+'.session'),null);assert.deepEqual(h.errors,[]);
 });

 test('PWA refuses update flush while generation, certification, review or solving is active', {timeout:30000},async t=>{
  const h=await boot(t),{w}=h;await w.SudokuNavigator.restore(savedFixture('0.2.0'));const initial=h.get('playerGrid');
  h.delayKinds.generate=300;const generating=w.newGame('easy');assert.equal(w.SudokuNavigator.flushForUpdate(),false);assert.deepEqual(h.get('playerGrid'),initial);await generating;assert.equal(w.SudokuNavigator.flushForUpdate(),true);
  h.delayKinds.certify=300;const restoring=w.SudokuNavigator.restore(savedFixture('0.2.0'));assert.equal(w.SudokuNavigator.flushForUpdate(),false);await restoring;assert.equal(w.SudokuNavigator.flushForUpdate(),true);assert.equal(h.get('playerGrid.flat().join(\'\')'),fixture);
  h.delayKinds.review=300;w.selectCell(2,'pointer');w.placeNumber(4,'pointer');assert.equal(w.SudokuNavigator.flushForUpdate(),false,'pending move review is retained until it finishes');await w.SudokuNavigator.whenReviewed();assert.equal(w.SudokuNavigator.flushForUpdate(),true);
  h.delayKinds.solve=300;const solving=w.aiStep();assert.equal(w.SudokuNavigator.flushForUpdate(),false,'pending solve cannot be interrupted by update');await solving;assert.equal(w.SudokuNavigator.flushForUpdate(),true);
  await w.aiSolve();assert.equal(h.get('aiAnimating'),true);assert.equal(w.SudokuNavigator.flushForUpdate(),false,'active animation requires user pause');w.aiPause();assert.equal(w.SudokuNavigator.flushForUpdate(),true);assert.deepEqual(h.errors,[]);
 });
}
