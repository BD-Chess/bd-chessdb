import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {boot,savedFixture,until,sleep,plain,NS}=require('./support/native-harness.cjs');
const old=JSON.parse(await readFile(new URL('./fixtures/old-native-upgrade.json',import.meta.url)));
async function ready(t,options={}){
 const h=await boot(t,{},undefined,{native:true,...options});
 await h.w.SudokuNavigator.restore({...savedFixture('0.2.0'),timerRunning:false});
 const G=h.w.SudokuMobileGeometry;
 [...h.el('grid').children].forEach((c,i)=>c.getBoundingClientRect=()=>G.rect(21+i%9*40,100+Math.floor(i/9)*40,39,39));
 h.el('gridWrap').getBoundingClientRect=()=>G.rect(16,95,369,369);
 return h;
}
function touch(h,i,type,x=41+i%9*40,y=120+Math.floor(i/9)*40){
 const c=h.el('grid').children[i],e=new h.w.Event(type,{bubbles:true,cancelable:true});
 const a={identifier:11,clientX:x,clientY:y,target:c};
 Object.defineProperties(e,{touches:{value:type==='touchend'?[]:[a]},changedTouches:{value:[a]}});c.dispatchEvent(e);return e;
}
const session=h=>plain(h.w.SudokuNavigator.export().session);

test('N01 upgrade from actual old native data preserves stored play and consent, then new fields survive another restart',async t=>{
 assert.equal(old.generatedHtmlSha256,'c122e92d04e8c02182ccb70964bed678672c083e32f3d5d298e7b4b82536eb53');
 const h=await boot(t,old.stored,undefined,{native:true});
 await until(()=>h.get('!!playerGrid'),'old native session restored');h.w.stopTimer();
 const before=JSON.parse(old.stored[NS+'.session']),after=session(h);
 for(const k of ['puzzle','board','notes','history','time','rows','assistance','gameId'])assert.deepEqual(after[k],before[k],k);
 for(const k of ['previousGame','consentMachine','consentTutor','machine','tutor'])assert.equal(h.store()[NS+'.'+k],old.stored[NS+'.'+k],k);
 assert.equal(h.get('selectedCell'),null,'not invented when old native snapshot omitted selection');
 assert.equal(h.get('notesMode'),false);
 assert.ok(JSON.parse(old.stored[NS+'.machine']).observations.length>0,'nonempty consented old machine data');
 assert.ok(JSON.parse(old.stored[NS+'.tutor']).attempts.length>0,'nonempty consented old tutor data');
 h.w.selectCell(old.noteCell);h.w.toggleNotes();h.w.undoMove();h.w.placeNumber(8);
 await h.w.SudokuNavigator.whenReviewed();
 h.listeners.appStateChange({isActive:false});
 const updated=JSON.parse(h.store()[NS+'.session']);
 assert.equal(updated.selectedCell,old.noteCell);assert.equal(updated.notesMode,true);assert.equal(updated.timerRunning,false);
 const next=await boot(t,h.store(),undefined,{native:true});await until(()=>next.get('!!playerGrid'),'upgraded restart');
 const saved=session(next);for(const k of ['board','notes','history','time','selectedCell','notesMode','timerRunning'])assert.deepEqual(saved[k],updated[k],k);
 assert.deepEqual(h.errors,[]);assert.deepEqual(next.errors,[]);
});

test('N02 malformed and incompatible native saves remain recoverable and cannot be overwritten by autosave',async t=>{
 for(const raw of ['{broken',JSON.stringify({...savedFixture('99.0'),time:83})]){
  const h=await boot(t,{[NS+'.session']:raw},undefined,{native:true});
  await until(()=>h.el('nativeRecoveryExport'),'explicit recovery path');
  h.el('nativeRecoveryExport').click();await until(()=>h.nativeCalls.some(c=>c.method==='share'),'recovery export bridge');
  const file=h.nativeCalls.find(c=>c.method==='writeFile');assert.equal(JSON.parse(file.args.data).records[NS+'.session'],raw);
  h.el('nativeRecoveryKeep').click();h.listeners.appStateChange({isActive:false});h.w.dispatchEvent(new h.w.Event('pagehide'));
  assert.equal(h.store()[NS+'.session'],raw);
  h.listeners.appStateChange({isActive:true});
  await h.w.SudokuNavigator.restore(savedFixture('0.2.0'));h.w.selectCell(2);h.w.placeNumber(4);await sleep(250);
  h.listeners.appStateChange({isActive:false});assert.equal(h.store()[NS+'.session'],raw,'play cannot silently destroy the recovery source');
 }
});

test('N03 compiled bridge, real button cells and one LAB layout owner keep transactions exactly once',async t=>{
 const h=await ready(t),w=h.w;
 assert.equal(w.SudokuMobileBridge.isNative,true);assert.equal(h.el('grid').querySelectorAll('button[type=button]').length,81);
 const expected=['notesBtn','uxErase','uxUndo','uxNew','uxHint','uxWhy','solveBtn','uxMore'];
 for(const width of [402,1000,390,320,874,402]){
  w.innerWidth=width;w.dispatchEvent(new w.Event('resize'));
  assert.equal(w.document.querySelectorAll('#numpad').length,1);assert.equal(w.document.querySelectorAll('#uxToolbar').length,1);
  const panel=h.el('numpad').closest('.panel');
  assert.equal(panel.parentElement.className,width<=760?'col-center':'col-left');
  if(width<=760){assert.equal(h.el('gridWrap').nextElementSibling,panel);assert.deepEqual([...h.el('uxToolbar').children].map(n=>n.id),expected);}
 }
 h.el('grid').children[2].click();h.el('numpad').children[3].click();
 assert.equal(h.get('playerGrid[0][2]'),4);assert.equal(h.get('history.length'),1);
 h.el('uxUndo').click();assert.equal(h.get('playerGrid[0][2]'),0);assert.equal(h.get('history.length'),0);
 assert.match(h.el('grid').children[2].getAttribute('aria-label'),/Row 1, column 3, empty/);
 assert.deepEqual(h.errors,[]);
});

test('N04 native background cancels a pending hold, dismisses a card and resumes only one timer',async t=>{
 const h=await ready(t),w=h.w;w.resumeTimer();const before=h.get('timerSeconds');
 touch(h,2,'touchstart');h.listeners.appStateChange({isActive:false});w.dispatchEvent(new w.Event('pagehide'));
 await sleep(340);assert.equal(h.el('uxPicker'),null);assert.equal(h.get('timerInterval'),null);
 assert.equal(JSON.parse(h.store()[NS+'.session']).timerRunning,true);
 h.listeners.appStateChange({isActive:true});const timer=h.get('timerInterval');
 w.dispatchEvent(new w.Event('pageshow'));h.listeners.appStateChange({isActive:true});assert.equal(h.get('timerInterval'),timer);
 assert.equal(h.get('timerSeconds'),before);
 h.el('uxMore').click();assert.equal(h.el('navModal').hidden,false);h.listeners.backButton();assert.equal(h.el('navModal').hidden,true);
 assert.equal(h.nativeCalls.filter(c=>c.method==='exitApp').length,0);
 h.listeners.appStateChange({isActive:false});assert.deepEqual(h.errors,[]);
});

test('N05 native background and Android Back return the demo without saving its copy or silently resuming it',async t=>{
 const h=await ready(t),w=h.w;w.selectCell(2);w.placeNumber(4);await w.SudokuNavigator.whenReviewed();w.resumeTimer();
 const original=session(h);
 for(const exit of [()=>h.listeners.appStateChange({isActive:false}),()=>h.listeners.backButton()]){
  h.el('solveBtn').click();h.el('uxDemoConfirm').click();
  await until(()=>w.SudokuNavigator.ui.demoState()?.index>0,'visible demo step');
  exit();assert.equal(w.SudokuNavigator.ui.hasDemo(),false);assert.equal(h.el('uxDemoGrid'),null);
  const current=session(h);for(const k of ['board','notes','history','selectedCell','time'])assert.deepEqual(current[k],original[k],k);
  assert.ok(current.assistance.some(a=>a.kind==='AI_solver'||a.type==='AI_solver'||JSON.stringify(a).includes('AI_solver')),'truthful exposure retained');
  h.listeners.appStateChange({isActive:true});await sleep(30);assert.equal(w.SudokuNavigator.ui.hasDemo(),false);
 }
 assert.deepEqual(h.errors,[]);
});

test('N06 button-cell picker commits once; native Back closes a read-only moving magnifier',async t=>{
 const h=await ready(t),w=h.w;touch(h,2,'touchstart');await until(()=>h.el('uxPicker'),'picker');
 const q=w.SudokuNavigator.ui.geometry(2).targets[3];touch(h,2,'touchmove',q.left+20,q.top+20);touch(h,2,'touchend',q.left+20,q.top+20);
 assert.equal(h.get('playerGrid[0][2]'),4);assert.equal(h.get('history.length'),1);await w.SudokuNavigator.whenReviewed();
 const before=session(h);touch(h,0,'touchstart');await until(()=>h.el('uxLoupe'),'magnifier');const pos=h.el('uxLoupe').style.cssText;
 touch(h,0,'touchmove',161,120);assert.equal(h.el('uxLoupe').dataset.cell,'3');assert.equal(h.el('uxLoupe').style.cssText,pos);
 h.listeners.backButton();assert.equal(h.el('uxLoupe'),null);assert.deepEqual(session(h),before);
 assert.deepEqual(h.errors,[]);
});

test('N07 all reachable JSON exports use compiled native Share and retain files until explicit deletion',async t=>{
 const h=await ready(t),w=h.w;
 w.SudokuNavigator.export();w.exportGameReview();w.consentHumanTrace();w.exportHumanTrace();
 await until(()=>h.nativeCalls.filter(c=>c.method==='share').length===3,'three native export paths');
 assert.equal(h.downloads.length,0);assert.equal(h.nativeCalls.filter(c=>c.method==='deleteFile').length,0);
 assert.equal(new Set(h.nativeCalls.filter(c=>c.method==='writeFile').map(c=>c.args.path)).size,3);
 const before=h.get('playerGrid');
 w.Capacitor.nativePromise=async(plugin,method)=>{if(method==='writeFile')return{uri:'file:///cache/cancel'};if(method==='share')throw Error('Share canceled');return{};};
 w.SudokuNavigator.export();await until(()=>h.el('navCopy').textContent.includes('Share canceled'),'share cancellation reported');assert.deepEqual(h.get('playerGrid'),before);
});

test('N08 native delete and consent revocation stay deleted through lifecycle/unload; cache scope stays local',async t=>{
 const h=await ready(t,{nativePromise:async(plugin,method,args)=>{
  if(method==='writeFile')return{uri:'file:///cache/'+args.path};
  if(method==='readdir')return{files:[{name:'export-1790-game.json'},{name:'unrelated.bin'}]};return{};
 }}),w=h.w;
 h.el('navLearn').click();h.el('navTutor').click();w.selectCell(2);w.placeNumber(4);await w.SudokuNavigator.whenReviewed();
 h.el('navLearn').click();h.el('navTutor').click();assert.equal(w.localStorage.getItem(NS+'.machine'),null);assert.equal(w.localStorage.getItem(NS+'.tutor'),null);
 w.consentHumanTrace();w.localStorage.setItem('unrelated','keep');
 h.el('navDelete').click();await until(()=>h.nativeCalls.some(c=>c.method==='deleteFile'),'cache cleared');
 w.dispatchEvent(new w.Event('beforeunload'));w.dispatchEvent(new w.Event('pagehide'));h.listeners.appStateChange({isActive:false});h.listeners.appStateChange({isActive:true});await sleep(250);
 assert.deepEqual(h.store(),{unrelated:'keep'});assert.equal(h.get('timerInterval'),null);
 assert.deepEqual(h.nativeCalls.filter(c=>c.method==='deleteFile').map(c=>c.args.path),['export-1790-game.json']);
 // JSDOM cannot navigate/reload; that one known environment limitation is explicit.
 assert.ok(h.errors.every(e=>e.includes('Not implemented: navigation')),h.errors.join('\n'));
});

test('N09 Delete All waits for pending cache writes and prevents a late Share',async t=>{
 let finishWrite,cache=[];
 const h=await ready(t,{nativePromise:async(plugin,method,args)=>{
  if(method==='writeFile')return new Promise(resolve=>{finishWrite=()=>{cache.push({name:args.path});resolve({uri:'file:///cache/'+args.path});};});
  if(method==='readdir')return{files:cache};return{};
 }});
 const exporting=h.w.SudokuMobileBridge.exportFile('{}','game.json','application/json');
 const rejected=assert.rejects(exporting,/canceled by local deletion/);
 await until(()=>finishWrite,'pending cache write');h.el('navDelete').click();
 assert.equal(h.nativeCalls.some(c=>c.method==='readdir'),false);
 finishWrite();await rejected;await until(()=>h.nativeCalls.some(c=>c.method==='deleteFile'),'late cache file removed');
 assert.equal(h.nativeCalls.some(c=>c.method==='share'),false);assert.deepEqual(h.store(),{});
});
