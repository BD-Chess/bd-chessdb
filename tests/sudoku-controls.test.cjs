'use strict';
// Control ownership and handlers, not physical touch/Safari layout coverage.
const test=require('node:test');
const assert=require('node:assert/strict');
const {boot,savedFixture,plain,until}=require('./sudoku-ui-harness.cjs');
const board=h=>plain(h.w.SudokuNavigator.export().session.board);
const toolbar=h=>[...h.el('uxToolbar').children].filter(n=>!n.hidden).map(n=>n.id);
async function ready(t,lane='LAB'){
 const h=await boot(t,{}, {width:390,height:844},{lane});
 await h.w.SudokuNavigator.restore(savedFixture('0.2.0'));h.w.stopTimer();return h;
}
function resize(h,width){h.w.innerWidth=width;h.w.dispatchEvent(new h.w.Event('resize'));}

test('LAB phone has one compact action row; help opens guided Assist and never a research demo',async t=>{
 const h=await ready(t),w=h.w,p=w.SudokuNavigator.product,initial=board(h);
 for(const width of [320,375,390,402,430,760]){
  resize(h,width);
  for(const view of ['play','learn']){
   p.switchView(view);
   assert.equal(h.el('uxToolbar').hidden,false);
   assert.deepEqual(toolbar(h),['notesBtn','uxErase','uxUndo','uxNew','solveBtn','uxMore']);
   const desktop=w.document.querySelector('.pl-desktop-actions');
   assert.equal(desktop.hidden,true,'desktop More/Assist row is not a second phone toolbar');
   assert.equal(w.getComputedStyle(desktop).display,'none','later .ux-menu grid cannot override hidden');
   assert.equal(h.el('plRedo').hidden,true);
   assert.equal(h.el('uxDesktopSettings').hidden,true);
   assert.equal(h.el('uxOldHelp').hidden,true);
   h.el('solveBtn').click();
   assert.equal(h.el('aiAssistPanel').hidden,false);
   assert.equal(h.el('navModal').hidden,true);
   assert.equal(w.SudokuNavigator.ui.hasDemo(),false);
   assert.equal(h.el('uxDemoGrid'),null);
   assert.deepEqual(board(h),initial,'opening help does not place/remove digits');
   assert.equal(h.el('aiAssistClose').hidden,view==='learn','Learn has no non-functional Close action');
   if(view==='play'){h.el('aiAssistClose').click();assert.equal(h.el('aiAssistPanel').hidden,true);}
  }
 }
 w.SudokuI18n.set('sl');await until(()=>h.el('solveBtn').textContent==='Pomoč AI','Slovenian help label');
 w.SudokuI18n.set('en');await until(()=>h.el('solveBtn').textContent==='AI Assist','English help label');
 h.el('uxMore').click();assert.equal(h.el('navModalTitle').textContent,'More');h.el('navClose').click();
 assert.deepEqual(h.errors,[]);
});

test('LAB desktop uses the right panel for Hint/Why and hides its redundant opener while visible',async t=>{
 const h=await ready(t),w=h.w,p=w.SudokuNavigator.product,initial=board(h);
 for(const width of [761,1024,1440,390,1440]){
  resize(h,width);p.switchView('play');
  if(width<=760)continue;
  assert.equal(h.el('uxToolbar').hidden,true);
  assert.equal(w.document.querySelector('.pl-desktop-actions').hidden,false);
  assert.equal(h.el('plRedo').hidden,false);
  assert.equal(h.el('plHint').hidden,true);assert.equal(h.el('plWhy').hidden,true);
  assert.equal(h.el('plDemo').hidden,false);assert.equal(h.el('plMore').hidden,false);
  h.el('plDemo').click();
  assert.equal(h.el('aiAssistPanel').hidden,false);assert.equal(h.el('plDemo').hidden,true);
  assert.equal(w.document.activeElement,h.el('aiAssistHint'),'focus follows the newly opened panel');
  h.el('aiAssistClose').click();
  assert.equal(h.el('aiAssistPanel').hidden,true);assert.equal(h.el('plDemo').hidden,false);
  assert.equal(w.document.activeElement,h.el('plDemo'),'focus returns to the only visible opener');
  p.switchView('learn');
  assert.equal(h.el('aiAssistPanel').hidden,false);assert.equal(h.el('plDemo').hidden,true);
  p.switchView('lab');
  assert.equal(h.el('plDemo').hidden,true,'Research already owns its original solver controls');
  assert.equal(h.el('aiAssistPanel').hidden,true);
  assert.equal(h.el('solveBtn').hidden,false);
 }
 assert.deepEqual(board(h),initial);assert.deepEqual(h.errors,[]);
});

test('mode changes keep the phone Research demo separate from guided Play/Learn',async t=>{
 const h=await ready(t),w=h.w,p=w.SudokuNavigator.product,initial=board(h);
 p.switchView('lab');
 assert.deepEqual(toolbar(h),['notesBtn','uxErase','uxUndo','uxNew','uxHint','uxWhy','solveBtn','uxMore']);
 h.el('solveBtn').click();assert.equal(h.el('navModalTitle').textContent,'AI demonstration');
 h.el('uxDemoCancel').click();
 p.switchView('play');h.el('solveBtn').click();
 assert.equal(h.el('navModal').hidden,true);assert.equal(h.el('aiAssistPanel').hidden,false);
 w.selectCell(2);w.placeNumber(1);w.undoMove();
 h.el('aiAssistClose').click();h.el('solveBtn').click();
 assert.equal(h.el('navModal').hidden,true);assert.equal(w.SudokuNavigator.ui.hasDemo(),false);
 assert.deepEqual(board(h),initial);assert.deepEqual(h.errors,[]);
});

test('APP shares the compact phone controls; its Assist tab replaces the opener when available',async t=>{
 const h=await ready(t,'APP'),w=h.w,p=w.SudokuNavigator.product,initial=board(h);
 assert.deepEqual(toolbar(h),['notesBtn','uxErase','uxUndo','uxNew','solveBtn','uxMore']);
 assert.equal(w.document.querySelector('.pl-desktop-actions').hidden,true);
 h.el('solveBtn').click();
 await until(()=>!h.el('appAssist').hidden,'APP Assist tab available');
 assert.equal(h.el('solveBtn').hidden,true,'no second AI entry beside the dock');
 assert.equal(w.document.body.dataset.appPanel,'assist');
 assert.equal(h.el('appAssistScrim').parentElement,w.document.querySelector('.page'),'backdrop shares the sheet stacking context');
 h.el('aiAssistClose').click();assert.equal(h.el('solveBtn').hidden,false);
 p.switchView('learn');
 await until(()=>!h.el('appAssist').hidden,'Learn tab available');
 assert.equal(h.el('solveBtn').hidden,true);
 h.el('appAssist').click();assert.equal(w.document.body.dataset.appPanel,'assist');
 assert.equal(h.el('aiAssistClose').hidden,false,'APP Learn Close returns to its board');
 h.el('aiAssistClose').click();assert.equal(w.document.body.dataset.appPanel,'board');
 assert.deepEqual(board(h),initial);assert.deepEqual(h.errors,[]);
});
