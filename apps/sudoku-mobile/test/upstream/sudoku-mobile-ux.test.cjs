'use strict';
// Narrow controller regressions. Synthetic rectangles/events are explicitly not
// evidence for native pan arbitration, WebKit, physical touch or rendered layout.
const test=require('node:test');
const assert=require('node:assert/strict');
const {boot,savedFixture,fixture,fixtureSolution,sleep,until,plain,NS,LANE}=require('./sudoku-ui-harness.cjs');
async function ready(t,stored={}){const h=await boot(t,stored,{width:402,height:874});if(!Object.keys(stored).length)await h.w.SudokuNavigator.restore(savedFixture('0.2.0'));else await until(()=>h.get('!!playerGrid'),'restored');h.w.stopTimer();return h;}
function layout(h){const G=h.w.SudokuMobileGeometry,cells=[...h.w.document.querySelectorAll('#grid .cell')];cells.forEach((c,i)=>c.getBoundingClientRect=()=>G.rect(21+i%9*40,100+Math.floor(i/9)*40,39,39));h.el('gridWrap').getBoundingClientRect=()=>G.rect(16,95,369,369);return cells;}
function pointer(h,target,type,x,y,extra={}){const e=new h.w.MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1,...extra});for(const [k,v]of Object.entries({pointerId:1,pointerType:'mouse',isPrimary:true,...extra}))if(!['button','buttons','clientX','clientY'].includes(k))Object.defineProperty(e,k,{value:v});target.dispatchEvent(e);return e;}
function begin(h,i){const c=h.w.document.querySelector(`[data-index="${i}"]`),r=c.getBoundingClientRect();pointer(h,c,'pointerdown',r.left+20,r.top+20);return{x:r.left+20,y:r.top+20};}
async function hold(h,i=2){begin(h,i);await until(()=>h.el('uxPicker'),'picker opened',1000);return h.w.SudokuNavigator.ui.geometry(i);}
function releaseDigit(h,l,d){const r=l.targets[d-1],x=(r.left+r.right)/2,y=(r.top+r.bottom)/2;pointer(h,h.w.document,'pointermove',x,y);pointer(h,h.w.document,'pointerup',x,y);}
const history=h=>h.get('history.length');
const state=h=>({board:h.get('playerGrid'),notes:h.get('notes.map(row=>row.map(n=>[...n]))'),history:h.get('history.map(x=>({...x,pn:[...x.pn]}))'),selected:h.get('selectedCell'),notesMode:h.get('notesMode'),stats:h.get('gameStats'),nav:plain(h.w.SudokuNavigator.state()),rows:plain(h.w.SudokuNavigator.review()),timer:h.get('timerSeconds')});

test('G01–G04: normal tap; digits 1–9 exactly once; Notes add/remove and Undo use canonical transactions',async t=>{
 const h=await ready(t);layout(h);const c=h.w.document.querySelector('[data-index="2"]');begin(h,2);pointer(h,c,'pointerup',120,120);c.click();assert.equal(h.get('selectedCell'),2);assert.equal(history(h),0);await sleep(330);assert.equal(h.el('uxPicker'),null);
 for(let digit=1;digit<=9;digit++){const l=await hold(h);const n=history(h);releaseDigit(h,l,digit);assert.equal(h.get('playerGrid[0][2]'),digit);assert.equal(history(h),n+1);h.w.undoMove();assert.equal(h.get('playerGrid[0][2]'),0);assert.equal(history(h),n);}
 h.w.toggleNotes();for(const expected of [[5],[]]){const n=history(h),l=await hold(h);releaseDigit(h,l,5);assert.deepEqual(h.get('[...notes[0][2]]'),expected);assert.equal(history(h),n+1);}h.w.undoMove();assert.deepEqual(h.get('[...notes[0][2]]'),[5]);h.w.undoMove();assert.deepEqual(h.get('[...notes[0][2]]'),[]);assert.deepEqual(h.errors,[]);
});

test('G05–G08: gaps/outside/origin never commit, reentry does; filled cells use loupe and stale targets cannot arm',async t=>{
 const h=await ready(t);layout(h);for(const where of ['gap','outside','origin']){const n=history(h),l=await hold(h);const r=l.targets[0],x=where==='gap'?r.right+2:where==='origin'?121:1,y=where==='gap'?r.top+15:where==='origin'?120:1;pointer(h,h.w.document,'pointermove',(r.left+r.right)/2,r.top+20);pointer(h,h.w.document,'pointerup',x,y);assert.equal(history(h),n);}
 const l=await hold(h);pointer(h,h.w.document,'pointermove',1,1);releaseDigit(h,l,4);assert.equal(h.get('playerGrid[0][2]'),4);for(const i of [2,0]){const p=begin(h,i);await until(()=>h.el('uxLoupe'),'filled-cell loupe');assert.equal(h.el('uxPicker'),null);pointer(h,h.w.document,'pointerup',p.x,p.y);assert.equal(h.el('uxLoupe'),null);}h.w.undoMove();
 begin(h,2);h.w.selectCell(3);h.w.placeNumber(6);await sleep(330);assert.equal(h.el('uxPicker'),null,'board/history revision invalidates arming');assert.deepEqual(h.errors,[]);
});

test('G08/G10: every cancellation is inert and the next ordinary tap survives',async t=>{
 const h=await ready(t);layout(h);const w=h.w;
 const cancel=[()=>pointer(h,w.document,'pointercancel',0,0),()=>h.el('grid').dispatchEvent(new w.Event('lostpointercapture')),()=>w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true})),()=>w.dispatchEvent(new w.Event('blur')),()=>w.dispatchEvent(new w.Event('scroll')),()=>w.dispatchEvent(new w.Event('resize')),()=>pointer(h,w.document,'pointermove',10,10,{buttons:2}),()=>pointer(h,w.document,'pointerdown',1,1,{isPrimary:false,pointerId:2}),()=>h.el('uxMore').click()];
 for(const fn of cancel){const n=history(h);await hold(h);fn();pointer(h,w.document,'pointerup',300,700);assert.equal(h.el('uxPicker'),null);assert.equal(history(h),n);if(!h.el('navModal').hidden)h.el('navClose').click();const previous=h.get('selectedCell'),c=w.document.querySelector('[data-index="3"]');pointer(h,c,'pointerdown',160,120);pointer(h,c,'pointerup',160,120);c.click();assert.equal(h.get('selectedCell'),previous===3?null:3,'normal tap toggles selection exactly once');}
 begin(h,2);pointer(h,w.document,'pointermove',145,120);await sleep(330);assert.equal(h.el('uxPicker'),null,'early motion abandons recognizer');assert.deepEqual(h.errors,[]);
});

test('G09 contract only: early touch movement is not canceled; active cancelable move is; no duplicate pointer path',async t=>{
 const h=await ready(t);layout(h);const w=h.w,c=w.document.querySelector('[data-index="2"]');
 function touch(type,x,y,opts={}){const e=new w.Event(type,{bubbles:true,cancelable:opts.cancelable!==false}),p={identifier:11,clientX:x,clientY:y};Object.defineProperties(e,{touches:{value:type==='touchend'?[]:opts.multi?[p,{...p,identifier:12}]:[p]},changedTouches:{value:[p]}});c.dispatchEvent(e);return e;}
 touch('touchstart',121,120);assert.equal(touch('touchmove',145,120).defaultPrevented,false);await sleep(330);assert.equal(h.el('uxPicker'),null);
 touch('touchstart',121,120);pointer(h,c,'pointerdown',121,120,{pointerType:'touch'});await until(()=>h.el('uxPicker'),'touch hold');let l=w.SudokuNavigator.ui.geometry(2),r=l.targets[3];assert.equal(touch('touchmove',r.left+20,r.top+20).defaultPrevented,true);touch('touchend',r.left+20,r.top+20);assert.equal(history(h),1);assert.equal(h.get('playerGrid[0][2]'),4);w.undoMove();
 touch('touchstart',121,120);await until(()=>h.el('uxPicker'),'second hold');touch('touchstart',122,121,{multi:true});touch('touchend',r.left+20,r.top+20);assert.equal(history(h),0);assert.equal(h.el('uxPicker'),null);assert.deepEqual(h.errors,[]);
});

test('G08/G10: consumed compatibility click is scoped; trace records one real transaction and paused input stays inert',async t=>{
 const h=await ready(t),w=h.w;layout(h);w.consentHumanTrace();const l=await hold(h);releaseDigit(h,l,4);const c=w.document.querySelector('[data-index="2"]');c.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,detail:1,clientX:121,clientY:120}));assert.equal(h.get('selectedCell'),2);assert.equal(history(h),1);const trace=w.exportHumanTrace();assert.equal(trace.events.filter(e=>e.action==='place_value'||e.type==='place_value').length,1);
 w.toggleHumanTracePause();begin(h,3);await sleep(330);assert.equal(h.el('uxPicker'),null);assert.equal(history(h),1);w.toggleHumanTracePause();const other=w.document.querySelector('[data-index="3"]');pointer(h,other,'pointerdown',161,120);pointer(h,other,'pointerup',161,120);other.dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:1}));assert.equal(h.get('selectedCell'),3);assert.deepEqual(h.errors,[]);
});

test('geometry narrow invariants: complete shadow footprint, finite cross and row-major targets; clipped board fallback',async t=>{
 const h=await ready(t);layout(h);const G=h.w.SudokuMobileGeometry,cells=[...h.el('grid').children].map(c=>c.getBoundingClientRect()),v=G.rect(4,4,394,866);
 for(const i of [0,40,80]){const a=G.place(cells,i,v),b=G.place(cells,i,v);assert.equal(a.ok,true);assert.deepEqual(plain(a),plain(b));assert.ok(G.inside(a.footprint,v));assert.ok(!G.overlap(a.footprint,G.union(cells.slice(Math.floor(i/9)*9,Math.floor(i/9)*9+9)),4));assert.ok(!G.overlap(a.footprint,G.union(cells.filter((_,j)=>j%9===i%9)),4));assert.ok(a.size>=44);for(let n=0;n<9;n++){assert.equal(a.targets[n].digit,n+1);assert.ok(G.inside(a.targets[n],a.footprint));}}
 assert.equal(G.place(cells,40,G.rect(4,140,394,700)).ok,false);assert.equal(G.place(cells,40,G.rect(4,4,394,450)).ok,false);
});

test('L01–L03: eight actual controls, responsive restoration and keyboard Notes state',async t=>{
 const h=await ready(t),w=h.w,order=['notesBtn','uxErase','uxUndo','uxNew','uxHint','uxWhy','solveBtn','uxMore'];assert.deepEqual([...h.el('uxToolbar').children].map(n=>n.id),order);assert.equal(h.el('gridWrap').nextElementSibling,h.el('numpad').closest('.panel'));
 const ids=[...w.document.querySelectorAll('[id]')].map(n=>n.id);assert.equal(new Set(ids).size,ids.length);w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'n',bubbles:true}));assert.equal(h.el('notesBtn').getAttribute('aria-pressed'),'true');assert.match(h.el('notesBtn').textContent,/ON/);
 for(const width of [761,760,1440,402]){w.innerWidth=width;w.dispatchEvent(new w.Event('resize'));assert.equal(h.el('solveBtn').closest('#uxToolbar')!==null,width<=760);assert.equal(h.el('notesBtn').closest('#uxToolbar')!==null,width<=760);}assert.deepEqual([...h.el('uxToolbar').children].map(n=>n.id),order);assert.deepEqual(h.errors,[]);
});

test('H01–H04: Hint→Why shares one pending proof, closes without late dialog, no move and one disclosure per level',async t=>{
 const h=await ready(t),w=h.w;layout(h);w.selectCell(2);const before=h.get('playerGrid');h.delayKinds.search=180;h.el('uxHint').click();assert.equal(h.el('navModal').hidden,false);assert.match(h.el('uxHelpText').textContent,/Looking/);h.el('uxWhy').click();await until(()=>h.el('uxHelpText').textContent!=='Looking for checked continuations…','checked help');await until(()=>w.SudokuNavigator.export().session.assistance.some(a=>a.type==='explain'),'explanation disclosed');assert.equal(h.requests.filter(r=>r.kind==='search').length,1);assert.deepEqual(h.get('playerGrid'),before);assert.equal(history(h),0);h.el('uxCardWhy').click();await sleep(20);assert.equal(w.SudokuNavigator.export().session.assistance.filter(a=>a.type==='explain').length,1);h.el('navClose').click();assert.equal(h.get('selectedCell'),2);
 // Invalidate settings, then close a pending request and open an unrelated menu.
 h.el('navDeep').checked=true;h.el('navDeep').onchange();h.el('uxHint').click();h.el('navClose').click();h.el('uxMore').click();await sleep(300);assert.equal(h.el('navModalTitle').textContent,'More');w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'8',bubbles:true}));assert.deepEqual(h.get('playerGrid'),before);h.el('navClose').click();w.placeNumber(1);h.el('uxHint').click();await until(()=>/check the highlighted/.test(h.el('uxHelpText').textContent),'correction in visible card');assert.deepEqual(h.errors,[]);
});

async function startDemo(h){h.el('solveBtn').click();assert.equal(h.el('navModalTitle').textContent,'AI demonstration');h.el('uxDemoConfirm').click();}
test('D01–D04/D08: separate checked demo, Stop and exact Return preserve canonical state; actual reveal remains assistance',async t=>{
 const h=await ready(t),w=h.w;w.selectCell(2);w.placeNumber(4);await w.SudokuNavigator.whenReviewed();w.selectCell(3);w.toggleNotes();w.placeNumber(6);const before=state(h);h.el('speedSlider').value='1';h.el('solveBtn').click();h.el('uxDemoCancel').click();assert.deepEqual(state(h),before);assert.equal(w.SudokuNavigator.ui.hasDemo(),false);
 await startDemo(h);await until(()=>w.SudokuNavigator.ui.demoState()?.revealed,'first checked demo step');assert.equal(h.el('solveBtn').textContent,'Stop');assert.ok(h.el('uxDemoGrid'));assert.deepEqual(state(h),before,'display steps never mutate canonical state or win stats');assert.equal(w.SudokuNavigator.export().session.assistance.filter(a=>a.type==='AI_solver').length,1);h.el('solveBtn').click();const index=w.SudokuNavigator.ui.demoState().index;await sleep(550);assert.equal(w.SudokuNavigator.ui.demoState().index,index);w.placeNumber(2);w.aiReset();w.clearGameReview();assert.deepEqual(state(h),before);h.el('uxDemoReturn').click();assert.deepEqual(state(h),before);assert.equal(w.SudokuNavigator.ui.hasDemo(),false);w.undoMove();assert.deepEqual(h.get('[...notes[0][3]]'),[]);w.undoMove();assert.equal(h.get('playerGrid[0][2]'),0);assert.equal(w.SudokuNavigator.export().session.assistance.filter(a=>a.type==='AI_solver').length,1);assert.deepEqual(h.errors,[]);
});

test('D04–D07: Stop while preparing, storage failure, stale callbacks, pagehide and bounded reload retain original',async t=>{
 const h=await ready(t),w=h.w;w.selectCell(2);w.toggleNotes();w.placeNumber(4);const before=state(h);h.delayKinds.legacy=250;await startDemo(h);h.el('solveBtn').click();await sleep(350);assert.equal(w.SudokuNavigator.ui.demoState().revealed,false);h.el('uxDemoReturn').click();assert.deepEqual(state(h),before);
 const set=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(k,v){if(k===NS+'.session')throw Error('quota fixture');return set.call(this,k,v);};await startDemo(h);await until(()=>w.SudokuNavigator.ui.demoState()?.phase==='STOPPED','storage failure');assert.match(h.el('uxDemoNote').textContent,/could not be saved/);assert.equal(h.el('uxDemoGrid'),null);h.el('uxDemoReturn').click();w.Storage.prototype.setItem=set;assert.deepEqual(state(h),before);
 h.delayKinds.legacy=0;h.el('speedSlider').value='1';w.resumeTimer();await startDemo(h);await until(()=>w.SudokuNavigator.ui.demoState()?.revealed,'demo active');w.dispatchEvent(new w.Event('pagehide'));assert.equal(w.SudokuNavigator.ui.hasDemo(),false);const stored=h.store(),saved=JSON.parse(stored[NS+'.session']);assert.deepEqual(saved.board,before.board.flat());assert.deepEqual(saved.notes,before.notes.flat());assert.equal(saved.timerRunning,true);const next=await ready(t,stored);assert.deepEqual(next.get('playerGrid'),before.board);assert.deepEqual(next.get('notes.map(row=>row.map(n=>[...n]))'),before.notes);assert.equal(next.get('notesMode'),true);assert.equal(next.get('selectedCell'),2);next.w.undoMove();assert.deepEqual(next.get('[...notes[0][2]]'),[]);assert.deepEqual(h.errors,[]);assert.deepEqual(next.errors,[]);
});

test('D03/D08: completed demonstration cannot create a win/practice result; trace lock refuses preparation',async t=>{
 const h=await ready(t),w=h.w;const before=state(h);h.el('speedSlider').value='100';await startDemo(h);await until(()=>w.SudokuNavigator.ui.demoState()?.phase==='STOPPED','bounded demonstration completion');assert.deepEqual(state(h),before);assert.match(h.el('uxDemoNote').textContent,/complete/);h.el('uxDemoReturn').click();w.consentHumanTrace();h.el('solveBtn').click();assert.equal(w.SudokuNavigator.ui.hasDemo(),false);assert.equal(h.el('navModal').hidden,true);assert.match(h.el('uxToast').textContent,/Human Trace/);assert.deepEqual(h.errors,[]);
});

test('M01–M04: New Cancel and storage failure preserve game; menus route existing controls; file cancel/bad import safe',async t=>{
 const h=await ready(t),w=h.w;const before=h.get('playerGrid');h.el('uxNew').click();h.el('uxCancelNew').click();assert.deepEqual(h.get('playerGrid'),before);h.el('uxNew').click();h.el('navModalBody').querySelector('[data-difficulty="easy"]').click();assert.match(h.el('navModalTitle').textContent,/Replace/);h.el('uxCancelNew').click();assert.deepEqual(h.get('playerGrid'),before);
 const set=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(k,v){if(k===NS+'.previousGame')throw Error('quota fixture');return set.call(this,k,v);};await w.SudokuNavigator.createGame('easy');assert.deepEqual(h.get('playerGrid'),before);assert.match(h.el('navCopy').textContent,/Previous game could not be saved/);w.Storage.prototype.setItem=set;
 const more=item=>{h.el('uxMore').click();h.el('navModalBody').querySelector(`[data-menu="${item}"]`).click();};more('Review');assert.match(h.el('navModalBody').textContent,/No moves/);h.el('navClose').click();const node=h.el('navPolicy'),parent=node.parentNode;more('Settings');assert.equal(h.el('navPolicy'),node);node.value='OFF';node.onchange();h.el('navClose').click();assert.equal(node.parentNode,parent);assert.equal(node.value,'OFF');more('Help');assert.match(h.el('navModalBody').textContent,/300 ms/);h.el('navClose').click();more('Export');await until(()=>h.downloads.length===1,'native export writes asynchronously');assert.equal(h.downloads.length,1);more('Import');await h.el('navFile').onchange({target:{files:[]}});assert.deepEqual(h.get('playerGrid'),before);await h.el('navFile').onchange({target:{files:[{size:1,text:async()=>'{'}]}});assert.match(h.el('navCopy').textContent,/Import rejected/);assert.deepEqual(h.get('playerGrid'),before);
 await w.SudokuNavigator.createGame('easy');assert.notDeepEqual(h.get('playerGrid'),before);assert.equal(JSON.parse(w.localStorage.getItem(NS+'.previousGame')).board.join(''),fixture);assert.deepEqual(h.errors,[]);
});

test('H03/D02/M01: bounded/error worker outcomes are visible; invalid demo replay and failed generation never install',async t=>{
 const h=await ready(t),w=h.w;const before=state(h);
 // Faults replace only the returned worker envelope after actual computation.
 h.resultKinds.search=data=>({...data,error:'LIMIT: injected worker failure'});h.el('uxHint').click();await until(()=>/Analysis stopped/.test(h.el('uxHelpText').textContent),'visible error');assert.deepEqual(h.get('playerGrid'),before.board);h.el('navClose').click();delete h.resultKinds.search;
 h.resultKinds.legacy=data=>({...data,result:{...data.result,log:[{r:0,c:0,v:1}]}});await startDemo(h);await until(()=>w.SudokuNavigator.ui.demoState()?.phase==='STOPPED','bad replay refused');assert.equal(w.SudokuNavigator.ui.demoState().revealed,false);assert.equal(h.el('uxDemoGrid'),null);assert.match(h.el('uxDemoNote').textContent,/failed replay/);h.el('uxDemoReturn').click();assert.deepEqual(state(h),before);
 h.resultKinds.generate=data=>({...data,result:{status:'LIMIT',attempts:1}});await w.SudokuNavigator.createGame('easy');assert.deepEqual(state(h),before);assert.match(h.el('navCopy').textContent,/Profile not fulfilled/);assert.deepEqual(h.errors,[]);
});

if(LANE==='PWA')test('P01/D05: explicit update cancels demo and stores canonical state; help/picker cleanup is idempotent',async t=>{
 const h=await ready(t),w=h.w;layout(h);const before=h.get('playerGrid');h.el('speedSlider').value='1';await startDemo(h);await until(()=>w.SudokuNavigator.ui.demoState()?.revealed,'demo running');assert.equal(w.SudokuNavigator.flushForUpdate(),true);assert.equal(w.SudokuNavigator.ui.hasDemo(),false);assert.deepEqual(JSON.parse(w.localStorage.getItem(NS+'.session')).board,before.flat());await hold(h);assert.equal(w.SudokuNavigator.flushForUpdate(),true);assert.equal(h.el('uxPicker'),null);h.delayKinds.search=100;h.el('uxHint').click();assert.equal(w.SudokuNavigator.flushForUpdate(),true);assert.equal(h.el('navModal').hidden,true);await sleep(150);assert.deepEqual(h.get('playerGrid'),before);assert.deepEqual(h.errors,[]);
});
