'use strict';
// Desktop Pointer Events/controller checks; synthetic events are not native input.
const test=require('node:test'),assert=require('node:assert/strict');
const {boot,savedFixture,sleep,until,plain}=require('./sudoku-ui-harness.cjs');
async function ready(t){
 const h=await boot(t,{}, {width:1440,height:900});
 await h.w.SudokuNavigator.restore(savedFixture('0.2.0'));h.w.stopTimer();
 const G=h.w.SudokuMobileGeometry;
 [...h.el('grid').children].forEach((c,i)=>c.getBoundingClientRect=()=>G.rect(373+i%9*73,190+Math.floor(i/9)*73,72,72));
 h.captures=[];h.el('grid').setPointerCapture=id=>h.captures.push(['set',id]);h.el('grid').releasePointerCapture=id=>h.captures.push(['release',id]);
 return h;
}
const cell=(h,i)=>h.el('grid').children[i];
const point=i=>({x:409+i%9*73,y:226+Math.floor(i/9)*73});
function pointer(h,target,type,p,extra={}){
 const e=new h.w.MouseEvent(type,{bubbles:true,cancelable:true,clientX:p.x,clientY:p.y,button:0,buttons:type==='pointerup'?0:1,...extra});
 for(const [k,v]of Object.entries({pointerId:1,pointerType:'mouse',isPrimary:true,...extra}))if(!['button','buttons'].includes(k))Object.defineProperty(e,k,{value:v});
 target.dispatchEvent(e);return e;
}
function click(h,i){const c=cell(h,i),p=point(i);pointer(h,c,'pointerdown',p);pointer(h,c,'pointerup',p);c.dispatchEvent(new h.w.MouseEvent('click',{bubbles:true,detail:1,clientX:p.x,clientY:p.y}));}
async function hold(h,i,id='uxPicker'){pointer(h,cell(h,i),'pointerdown',point(i));await until(()=>h.el(id),id+' opens on desktop',1000);}
function release(h,i,d){const q=h.w.SudokuNavigator.ui.geometry(i).targets[d-1],p={x:q.left+q.width/2,y:q.top+q.height/2};pointer(h,h.w.document,'pointermove',p);pointer(h,h.w.document,'pointerup',p);cell(h,i).dispatchEvent(new h.w.MouseEvent('click',{bubbles:true,detail:1,clientX:p.x,clientY:p.y}));}
const state=h=>({board:h.get('playerGrid'),notes:h.get('notes.map(r=>r.map(n=>[...n]))'),history:h.get('history.map(x=>({...x,pn:[...x.pn]}))'),selected:h.get('selectedCell'),nav:plain(h.w.SudokuNavigator.state()),review:plain(h.w.SudokuNavigator.review()),assistance:plain(h.w.SudokuNavigator.export().session.assistance)});

test('DESK01: short click and keyboard survive; left hold/drag/release enters once, supports Notes and Undo',async t=>{
 const h=await ready(t),w=h.w;
 click(h,2);assert.equal(h.get('selectedCell'),2);await sleep(330);assert.equal(h.el('uxPicker'),null);
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'4',bubbles:true}));assert.equal(h.get('playerGrid[0][2]'),4);w.undoMove();
 await hold(h,2);release(h,2,4);assert.equal(h.get('playerGrid[0][2]'),4);assert.equal(h.get('history.length'),1);assert.equal(h.get('selectedCell'),2);w.undoMove();
 w.toggleNotes();await hold(h,2);release(h,2,6);assert.deepEqual(h.get('[...notes[0][2]]'),[6]);assert.equal(h.get('history.length'),1);w.undoMove();assert.deepEqual(h.get('[...notes[0][2]]'),[]);
 assert.deepEqual(h.captures,[['set',1],['release',1],['set',1],['release',1]]);
 assert.equal(h.el('uxToolbar').hidden,true);assert.equal(h.el('notesBtn').closest('#uxToolbar'),null);assert.deepEqual(h.errors,[]);
});

test('DESK02: given/user-input holds open a fixed read-only loupe across blank and Notes cells',async t=>{
 const h=await ready(t),w=h.w;w.selectCell(2);w.placeNumber(4);await w.SudokuNavigator.whenReviewed();w.selectCell(3);w.toggleNotes();w.placeNumber(1);w.placeNumber(6);await w.SudokuNavigator.whenReviewed();
 const before=state(h);
 for(const origin of [0,2]){
  await hold(h,origin,'uxLoupe');const pos=h.el('uxLoupe').getAttribute('style');
  for(const i of [1,3,8,80]){pointer(h,w.document,'pointermove',point(i));assert.equal(h.el('uxLoupe').dataset.cell,String(i));assert.equal(h.el('uxLoupe').getAttribute('style'),pos);assert.equal(h.el('uxPicker'),null);if(i===3)assert.equal(h.el('uxLoupe').querySelector('.ux-loupe-focus .ux-loupe-notes').textContent,'16');}
  pointer(h,w.document,'pointerup',point(80));assert.equal(h.el('uxLoupe'),null);assert.deepEqual(state(h),before);
 }
 assert.deepEqual(h.errors,[]);
});

test('DESK03: secondary buttons/early drag do not arm; cancellation and clipped-board fallback never enter a value',async t=>{
 const h=await ready(t),w=h.w;
 for(const button of [1,2]){pointer(h,cell(h,2),'pointerdown',point(2),{button,buttons:button===1?4:2});await sleep(330);assert.equal(h.el('uxPicker'),null);}
 pointer(h,cell(h,2),'pointerdown',point(2));pointer(h,w.document,'pointermove',{x:600,y:300});await sleep(330);assert.equal(h.el('uxPicker'),null);
 const before=state(h),cancel=[()=>pointer(h,w.document,'pointerup',{x:1,y:1}),()=>pointer(h,w.document,'pointercancel',point(2)),()=>h.el('grid').dispatchEvent(new w.Event('lostpointercapture')),()=>w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true})),()=>w.dispatchEvent(new w.Event('blur')),()=>w.dispatchEvent(new w.Event('scroll')),()=>w.dispatchEvent(new w.Event('resize'))];
 for(const fn of cancel){await hold(h,2);fn();assert.equal(h.el('uxPicker'),null);assert.deepEqual(state(h),before);}
 h.w.innerHeight=400;pointer(h,cell(h,2),'pointerdown',point(2));await until(()=>!h.el('uxToast').hidden,'explicit fallback');assert.equal(h.el('uxPicker'),null);assert.deepEqual(state(h),before);
 click(h,3);assert.equal(h.get('selectedCell'),3);assert.equal(h.get('history.length'),0);assert.deepEqual(h.errors,[]);
});
