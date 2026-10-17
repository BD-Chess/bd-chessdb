'use strict';
// Touch-sequence/controller regressions. These are NOT native iOS/WebKit input.
const test=require('node:test');
const assert=require('node:assert/strict');
const {boot,savedFixture,sleep,until,plain,NS,LANE}=require('./sudoku-ui-harness.cjs');
async function ready(t){
 const h=await boot(t,{}, {width:402,height:874});
 await h.w.SudokuNavigator.restore(savedFixture('0.2.0'));h.w.stopTimer();
 const G=h.w.SudokuMobileGeometry;
 [...h.el('grid').children].forEach((c,i)=>c.getBoundingClientRect=()=>G.rect(21+i%9*40,100+Math.floor(i/9)*40,39,39));
 h.el('gridWrap').getBoundingClientRect=()=>G.rect(16,95,369,369);return h;
}
const cell=(h,i)=>h.el('grid').children[i];
const point=i=>({x:41+i%9*40,y:120+Math.floor(i/9)*40});
function touch(h,target,type,p,extra={}){
 const e=new h.w.Event(type,{bubbles:true,cancelable:extra.cancelable!==false});
 const a={identifier:11,clientX:p.x,clientY:p.y,target};
 Object.defineProperties(e,{touches:{value:type==='touchend'||type==='touchcancel'?[]:extra.multi?[a,{...a,identifier:12}]:[a]},changedTouches:{value:[a]}});
 target.dispatchEvent(e);return e;
}
const state=h=>({board:h.get('playerGrid'),notes:h.get('notes.map(r=>r.map(n=>[...n]))'),history:h.get('history.map(x=>({...x,pn:[...x.pn]}))'),selected:h.get('selectedCell'),stats:h.get('gameStats'),nav:plain(h.w.SudokuNavigator.state()),rows:plain(h.w.SudokuNavigator.review()),assistance:plain(h.w.SudokuNavigator.export().session.assistance),model:plain(h.w.SudokuNavigator.model()),profile:plain(h.w.SudokuNavigator.profile())});
const begin=(h,i,extra={})=>touch(h,cell(h,i),'touchstart',point(i),extra);
async function hold(h,i,id='uxPicker',extra={}){begin(h,i,extra);await until(()=>h.el(id),id+' opens',1200);}

test('T01: a noncancelable touchstart can arm; short tap stays native and selects once',async t=>{
 const h=await ready(t),c=cell(h,2),p=point(2);
 assert.equal(begin(h,2,{cancelable:false}).defaultPrevented,false);
 touch(h,c,'touchend',p);c.dispatchEvent(new h.w.MouseEvent('click',{bubbles:true,detail:1,clientX:p.x,clientY:p.y}));
 assert.equal(h.get('selectedCell'),2);assert.equal(h.get('history.length'),0);await sleep(330);assert.equal(h.el('uxPicker'),null);
 await hold(h,2,'uxPicker',{cancelable:false});
 const q=h.w.SudokuNavigator.ui.geometry(2).targets[3],end={x:q.left+20,y:q.top+20};
 assert.equal(touch(h,c,'touchmove',end).defaultPrevented,true);assert.equal(touch(h,c,'touchend',end).defaultPrevented,true);
 assert.equal(h.get('playerGrid[0][2]'),4);assert.equal(h.get('history.length'),1);assert.equal(h.el('uxPicker'),null);
});

test('T02: the first pre-hold touchmove yields the whole contact to native scrolling, including tiny/noncancelable moves',async t=>{
 const h=await ready(t),c=cell(h,2),p=point(2);
 for(const [dx,cancelable] of [[2,true],[25,true],[2,false]]){
  begin(h,2);assert.equal(touch(h,c,'touchmove',{x:p.x+dx,y:p.y+2},{cancelable}).defaultPrevented,false);
  await sleep(340);assert.equal(h.el('uxPicker'),null,'never try to reclaim a contact already offered to native pan');
  assert.equal(touch(h,c,'touchmove',{x:p.x,y:p.y+90}).defaultPrevented,false);touch(h,c,'touchend',p);
 }
 assert.equal(h.get('history.length'),0);assert.equal(h.get('selectedCell'),null);
});

test('T03: Notes touch target survives picker activation; release commits once and compatibility click is consumed',async t=>{
 const h=await ready(t),w=h.w;w.selectCell(2);w.toggleNotes();w.placeNumber(5);await w.SudokuNavigator.whenReviewed();w.selectCell(2);
 const n=cell(h,2).querySelector('.notes span'),p=point(2),before=h.get('history.length');
 touch(h,n,'touchstart',p);await until(()=>h.el('uxPicker'),'Notes hold opens');assert.equal(n.isConnected,true,'no mid-contact innerHTML rebuild');
 const q=w.SudokuNavigator.ui.geometry(2).targets[3],end={x:q.left+20,y:q.top+20};touch(h,n,'touchmove',end);touch(h,n,'touchend',end);
 cell(h,2).dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:1,clientX:p.x,clientY:p.y}));
 assert.deepEqual(h.get('[...notes[0][2]]'),[5,4]);assert.equal(h.get('history.length'),before+1);assert.equal(h.get('selectedCell'),2);
 w.undoMove();assert.deepEqual(h.get('[...notes[0][2]]'),[5]);assert.deepEqual(h.errors,[]);
});

test('T04: filled-cell hold opens a fixed central loupe; slides across given, input, blank and Notes stay read-only',async t=>{
 const h=await ready(t),w=h.w;w.selectCell(2);w.placeNumber(4);await w.SudokuNavigator.whenReviewed();w.selectCell(3);w.toggleNotes();w.placeNumber(1);w.placeNumber(6);await w.SudokuNavigator.whenReviewed();
 w.consentHumanTrace();const before=state(h),trace=w.exportHumanTrace().events.length;
 for(const start of [0,2]){
  await hold(h,start,'uxLoupe');const lens=h.el('uxLoupe'),pos=lens.getAttribute('style');assert.equal(h.el('uxPicker'),null);
  for(const i of [1,2,4,3,8,80]){
   assert.equal(touch(h,cell(h,start),'touchmove',point(i)).defaultPrevented,true);
   assert.equal(lens.dataset.cell,String(i));assert.equal(lens.getAttribute('style'),pos,'lens never follows the finger');assert.equal(h.el('uxPicker'),null);
   if(i===3)assert.equal(lens.querySelector('.ux-loupe-focus .ux-loupe-notes').textContent,'16');
   if(i===8)assert.equal(lens.querySelector('.ux-loupe-focus').textContent,'','blank never reveals solution');
  }
  assert.equal(touch(h,cell(h,start),'touchmove',{x:1,y:1}).defaultPrevented,true);assert.equal(lens.dataset.outside,'true');
  touch(h,cell(h,start),'touchmove',point(3));assert.equal(lens.dataset.outside,'false');
  touch(h,cell(h,start),'touchend',point(3));assert.equal(h.el('uxLoupe'),null);
  cell(h,3).dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:1,clientX:point(3).x,clientY:point(3).y}));
  assert.deepEqual(state(h),before);assert.equal(w.exportHumanTrace().events.length,trace,'visual inspection adds no trace event');
 }
 assert.deepEqual(h.errors,[]);
});

test('T05: touchcancel, second contact, noncancelable active move, scroll, orientation and hidden page remove both overlays without a move',async t=>{
 const h=await ready(t),w=h.w;const before=state(h);
 const cancellations=[
  i=>touch(h,cell(h,i),'touchcancel',point(i)),
  i=>touch(h,w.document.body,'touchstart',point(i),{multi:true}),
  i=>touch(h,cell(h,i),'touchmove',point(4),{cancelable:false}),
  ()=>w.dispatchEvent(new w.Event('scroll')),
  ()=>w.dispatchEvent(new w.Event('orientationchange')),
  ()=>{Object.defineProperty(w.document,'hidden',{value:true,configurable:true});w.document.dispatchEvent(new w.Event('visibilitychange'));Object.defineProperty(w.document,'hidden',{value:false,configurable:true});}
 ];
 for(const i of [2,0])for(const cancel of cancellations){await hold(h,i,i===2?'uxPicker':'uxLoupe');cancel(i);touch(h,cell(h,i),'touchend',point(4));assert.equal(h.el('uxPicker'),null);assert.equal(h.el('uxLoupe'),null);assert.deepEqual(state(h),before);}
 begin(h,0);touch(h,cell(h,0),'touchcancel',point(0));await sleep(340);assert.equal(h.el('uxLoupe'),null,'canceled timer cannot open later');assert.deepEqual(h.errors,[]);
});

test('T06: pagehide/update discards only ephemeral loupe and recovers the canonical game',async t=>{
 const h=await ready(t),w=h.w;w.selectCell(2);w.placeNumber(4);await w.SudokuNavigator.whenReviewed();w.selectCell(3);w.toggleNotes();w.placeNumber(6);await w.SudokuNavigator.whenReviewed();
 const before=state(h);await hold(h,0,'uxLoupe');touch(h,cell(h,0),'touchmove',point(3));
 if(LANE==='PWA')assert.equal(w.SudokuNavigator.flushForUpdate(),true);else w.dispatchEvent(new w.Event('pagehide'));
 assert.equal(h.el('uxLoupe'),null);const stored=h.store(),saved=JSON.parse(stored[NS+'.session']);assert.deepEqual(saved.board,before.board.flat());assert.deepEqual(saved.notes,before.notes.flat());assert.equal(saved.selectedCell,before.selected);
 const next=await boot(t,stored,{width:402,height:874});await until(()=>next.get('!!playerGrid'),'recovered');next.w.stopTimer();assert.deepEqual(state(next),before);assert.equal(next.el('uxLoupe'),null);assert.equal(next.el('uxPicker'),null);assert.deepEqual(h.errors,[]);assert.deepEqual(next.errors,[]);
});
