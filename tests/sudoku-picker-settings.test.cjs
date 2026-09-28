'use strict';
// Phase-A feature regressions: synthetic DOM/geometry, not native device evidence.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {boot,savedFixture,sleep,until,plain,NS,LANE}=require('./sudoku-ui-harness.cjs');
const PREF=NS+'.uiPreferences';
async function ready(t,stored={},width=402,height=874){
 const h=await boot(t,stored,{width,height});
 if(stored[NS+'.session'])await until(()=>h.get('!!playerGrid'),'restored');
 else await h.w.SudokuNavigator.restore(savedFixture('0.2.0'));
 h.w.stopTimer();layout(h);return h;
}
function layout(h,top=100){const G=h.w.SudokuMobileGeometry;
 [...h.el('grid').children].forEach((c,i)=>c.getBoundingClientRect=()=>G.rect(21+i%9*40,top+Math.floor(i/9)*40,39,39));
 h.el('gridWrap').getBoundingClientRect=()=>G.rect(16,top-5,369,369);
}
const cell=(h,i)=>h.el('grid').children[i];
function point(h,i){const r=cell(h,i).getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};}
function pointer(h,type,p,target=h.w.document,extra={}){
 const e=new h.w.MouseEvent(type,{bubbles:true,cancelable:true,clientX:p.x,clientY:p.y,button:0,buttons:type==='pointerup'?0:1});
 for(const[k,v]of Object.entries({pointerId:1,pointerType:'mouse',isPrimary:true,...extra}))Object.defineProperty(e,k,{value:v});target.dispatchEvent(e);
}
async function hold(h,i=40,id='uxPicker'){pointer(h,'pointerdown',point(h,i),cell(h,i));await until(()=>h.el(id),'hold opens '+id,1200);return h.w.SudokuNavigator.ui.geometry(i);}
function release(h,l,d){const q=l.targets[d-1],p={x:q.left+q.width/2,y:q.top+q.height/2};pointer(h,'pointermove',{x:p.x+10,y:p.y});pointer(h,'pointermove',p);pointer(h,'pointerup',p);}
function settings(h){h.el(h.w.innerWidth<=760?'uxMore':'uxDesktopSettings').click();if(h.w.innerWidth<=760)h.el('navModalBody').querySelector('[data-menu="Settings"]').click();}
function choice(h,id,value){settings(h);const n=h.el(id);assert.ok(n,'setting '+id+' reachable');n.value=value;n.dispatchEvent(new h.w.Event('change',{bubbles:true}));h.el('navClose').click();}
const state=h=>({board:h.get('playerGrid'),notes:h.get('notes.map(r=>r.map(n=>[...n]))'),history:h.get('history.map(x=>({...x,pn:[...x.pn]}))'),selected:h.get('selectedCell'),review:plain(h.w.SudokuNavigator.review()),model:plain(h.w.SudokuNavigator.model()),profile:plain(h.w.SudokuNavigator.profile())});

test('P01-P05: At cell centers then minimally clamps complete footprint; sizes and clipped target differ from protected mode',async t=>{
 const h=await ready(t),G=h.w.SudokuMobileGeometry,cells=[...h.el('grid').children].map(c=>c.getBoundingClientRect()),v=G.rect(4,4,394,866);
 const sizes=[];
 for(const size of ['normal','large','extraLarge']){
  const a=G.place(cells,40,v,{position:'atCell',size}),c=cells[40];assert.equal(a.ok,true);
  assert.equal(a.footprint.left,(c.left+c.right-a.footprint.width)/2);assert.equal(a.footprint.top,(c.top+c.bottom-a.footprint.height)/2);
  sizes.push(a.size);assert.equal(a.targets.length,9);
  for(let d=0;d<9;d++){const q=a.targets[d];assert.equal(q.left,a.footprint.left+16+d%3*(a.size+4));assert.equal(q.top,a.footprint.top+40+Math.floor(d/3)*(a.size+4));assert.ok(G.inside(q,a.footprint));}
  for(const i of [0,4,8,36,44,72,76,80]){const b=G.place(cells,i,v,{position:'atCell',size});assert.equal(b.ok,true);assert.ok(G.inside(b.footprint,v));assert.equal(b.footprint.left,Math.max(v.left,Math.min(v.right-b.footprint.width,(cells[i].left+cells[i].right-b.footprint.width)/2)));assert.equal(b.footprint.top,Math.max(v.top,Math.min(v.bottom-b.footprint.height,(cells[i].top+cells[i].bottom-b.footprint.height)/2)));}
 }
 assert.ok(sizes[0]<sizes[1]&&sizes[1]<sizes[2]);
 const clipped=G.rect(4,220,394,400);assert.equal(G.place(cells,40,clipped,{position:'atCell',size:'large'}).ok,true);assert.equal(G.place(cells,40,clipped,{position:'context',size:'large'}).ok,false);
 assert.equal(G.place(cells,0,clipped,{position:'atCell',size:'large'}).ok,false);
 assert.equal(G.place(cells,40,G.rect(4,275,394,400),{position:'atCell',size:'large'}).ok,true,'partially visible target still has known feasible geometry');
 for(const size of ['normal','large','extraLarge']){const a=G.place(cells,40,v,{position:'context',size}),b=G.place(cells,40,v,{position:'context',size});assert.deepEqual(plain(a),plain(b));assert.equal(a.ok,true);const row=G.union(cells.slice(36,45)),col=G.union(cells.filter((_,i)=>i%9===4));assert.ok(!G.overlap(a.footprint,row,4));assert.ok(!G.overlap(a.footprint,col,4));}
 assert.deepEqual(plain(G.place(cells,40,v)),plain(G.place(cells,40,v,{position:'context',size:'large'})),'legacy protected algorithm retained');
 const tiny=G.rect(150,200,172,196),fitted=G.place(cells,40,tiny,{position:'atCell',size:'extraLarge'});assert.equal(fitted.ok,true);assert.equal(fitted.size,44);assert.ok(G.inside(fitted.footprint,tiny));
 assert.equal(G.place(cells,40,G.rect(150,200,171,195),{position:'atCell',size:'large'}).ok,false);assert.equal(G.place(cells,40,null,{position:'atCell'}).ok,false);
});

test('P12 reproduction: all nine visible occurrences never disable a picker digit',async t=>{
 const h=await ready(t);h.w.eval('for(let c=0;c<9;c++)playerGrid[8][c]=1;render()');
 assert.ok(h.el('numpad').children[0].disabled||h.el('numpad').children[0].classList.contains('used'));
 const l=await hold(h,2);release(h,l,1);assert.equal(h.get('playerGrid[0][2]'),1,'picker-local path must permit the digit');assert.equal(h.get('history.length'),1);h.w.undoMove();assert.equal(h.get('playerGrid[0][2]'),0);
 h.w.toggleNotes();const n=await hold(h,2);release(h,n,1);assert.deepEqual(h.get('[...notes[0][2]]'),[1]);h.w.undoMove();assert.deepEqual(h.get('[...notes[0][2]]'),[]);assert.deepEqual(h.errors,[]);
});

test('P18 reproduction: three preferences reachable before a game, independent of solver settings and persisted per lane',async t=>{
 const h=await boot(t,{}, {width:1440,height:900});assert.equal(h.get('playerGrid'),null);
 settings(h);assert.equal(h.el('uxPickerPosition').value,'atCell');assert.equal(h.el('uxPickerSize').value,'normal');assert.equal(h.el('uxCandidateAssist').value,'auto');
 for(const [id,value]of [['uxPickerPosition','context'],['uxPickerSize','extraLarge'],['uxCandidateAssist','off']]){h.el(id).value=value;h.el(id).dispatchEvent(new h.w.Event('change',{bubbles:true}));}
 assert.match(h.el('uxPreferenceStatus').textContent,/Saved/);h.el('navClose').click();assert.equal(h.get('playerGrid'),null);assert.equal(h.store()[NS+'.session'],undefined);
 const stored=h.store();assert.deepEqual(JSON.parse(stored[PREF]),{position:'context',size:'extraLarge',assist:'off'});
 const next=await boot(t,stored,{width:402,height:874});settings(next);assert.equal(next.el('uxPickerSize').value,'extraLarge');assert.equal(next.el('uxCandidateAssist').value,'off');next.el('navClose').click();
 await next.w.SudokuNavigator.restore(savedFixture('0.2.0'));next.w.stopTimer();assert.deepEqual(plain(next.w.SudokuNavigator.ui.preferences()),{position:'context',size:'extraLarge',assist:'off'});
 assert.equal(next.w.SudokuNavigator.export().session.settings.position,undefined);assert.deepEqual(h.errors,[]);assert.deepEqual(next.errors,[]);
});

test('P05/P18: coarse-pointer phone keeps Large default in landscape; explicit size wins across breakpoints',async t=>{
 const h=await boot(t,{}, {width:874,height:402});h.w.matchMedia=()=>({matches:true});assert.equal(h.w.SudokuNavigator.ui.preferences().size,'large');
 choice(h,'uxPickerSize','normal');for(const width of [402,760,761,874,1440]){h.w.innerWidth=width;h.w.SudokuNavigator.ui.resize();assert.equal(h.w.SudokuNavigator.ui.preferences().size,'normal');}assert.deepEqual(h.errors,[]);
});

test('P06-P11: presentation helper reads only visible peers/Notes; Auto and overrides never inspect a hidden answer or engine',()=>{
 const html=fs.readFileSync(path.resolve(__dirname,`../public/S/${LANE==='PWA'?'PWA':'new'}/app.html`),'utf8');
 const source=html.match(/<script id="picker-presentation">([\s\S]*?)<\/script>/)[1],sandbox={window:{}};
 for(const key of ['solution','SudokuNavCore','AI8Proof','getCandidates','Worker','navState'])Object.defineProperty(sandbox,key,{get(){throw Error('Forbidden preview dependency: '+key);}});
 vm.runInNewContext(source,sandbox);const P=sandbox.window.SudokuPickerPresentation,board=Array.from({length:9},()=>Array(9).fill(0));
 board[4][0]=1;board[0][4]=2;board[3][3]=3;board[4][3]=4;board[3][4]=5;board[0][0]=6;
 for(const diff of ['easy','medium','hard','evil','restored','UNKNOWN',null])for(const mode of ['auto','on','off']){
  const a=plain(P.preview(board,40,new Set([1,6,8]),diff,mode)),active=mode==='on'||mode==='auto'&&diff==='easy';
  assert.deepEqual(a.filter(x=>x.note).map(x=>x.digit),[1,6,8]);assert.deepEqual(a.filter(x=>x.conflict).map(x=>x.digit),active?[1,2,3,4,5]:[]);
 }
 assert.deepEqual(plain(P.preferences({position:'?',size:'?',assist:'?'},true)),{position:'atCell',size:'large',assist:'auto'});
});

test('P06/P10/P11: Notes and gray conflict signals survive hover; preview/open/move/cancel are answer-blind and event-free',async t=>{
 const h=await ready(t),w=h.w;w.eval('notes[4][4]=new Set([1,6,8]);render()');
 const before=state(h),requests=h.requests.length,outputs=[];
 // Poison the actual hidden answer during the gesture, not a static grep.
 w.eval('window.savedAnswer=solution;solution=new Proxy(solution,{get(){throw Error("hidden answer read by preview")}})');
 for(let pass=0;pass<2;pass++){
  if(pass)w.eval('solution=Array.from({length:9},()=>Array(9).fill(9))');
  const l=await hold(h);const picker=h.el('uxPicker');outputs.push(picker.innerHTML);
  assert.equal(picker.querySelectorAll('.ux-picker-digit').length,9);assert.equal(picker.querySelectorAll('.user-note').length,3);
  const digit=picker.querySelector('[data-digit="8"]');assert.ok(digit.classList.contains('user-note'));assert.ok(digit.classList.contains('conflict'));assert.equal(digit.getAttribute('aria-disabled'),null);
  const q=l.targets[7];pointer(h,'pointermove',{x:q.left+20,y:q.top+20});assert.ok(digit.classList.contains('active'));assert.ok(digit.classList.contains('conflict'));assert.ok(digit.classList.contains('user-note'));
  pointer(h,'pointercancel',point(h,40));assert.deepEqual(state(h),before);assert.equal(h.requests.length,requests);
 }
 assert.equal(outputs[0],outputs[1]);w.eval('solution=window.savedAnswer;delete window.savedAnswer');assert.deepEqual(h.errors,[]);
 choice(h,'uxCandidateAssist','off');const l=await hold(h);assert.equal(h.el('uxPicker').querySelectorAll('.conflict').length,0);assert.equal(h.el('uxPicker').querySelectorAll('.user-note').length,3);pointer(h,'pointercancel',point(h,40));
});

test('P07/P08/P18: restored difficulty governs Auto, explicit overrides survive new games/reload and malformed legacy data is harmless',async t=>{
 const h=await ready(t),w=h.w;
 for(const diff of ['easy','medium','hard','evil','unknown']){
  const s=savedFixture('0.2.0');s.diff=diff;await w.SudokuNavigator.restore(s);w.stopTimer();layout(h);
  // A generation button/label is not the current puzzle difficulty.
  h.el('status').textContent='EASY';await hold(h);assert.equal(h.el('uxPicker').querySelectorAll('.conflict').length>0,diff==='easy');pointer(h,'pointercancel',point(h,40));
 }
 // This is a preferences transition test. Hard profile fulfillment is bounded
 // and tested separately; Easy keeps this check independent of rejection UI.
 choice(h,'uxCandidateAssist','on');await w.SudokuNavigator.createGame('easy');w.stopTimer();assert.equal(w.SudokuNavigator.ui.preferences().assist,'on');
 const legacy=savedFixture('0.2.0');legacy.diff='evil';await w.SudokuNavigator.restore(legacy);w.stopTimer();layout(h);await hold(h);assert.ok(h.el('uxPicker').querySelectorAll('.conflict').length);pointer(h,'pointercancel',point(h,40));
 choice(h,'uxCandidateAssist','off');w.dispatchEvent(new w.Event('pagehide'));const next=await ready(t,h.store());assert.equal(next.w.SudokuNavigator.ui.preferences().assist,'off');choice(next,'uxCandidateAssist','auto');await hold(next);assert.equal(next.el('uxPicker').querySelectorAll('.conflict').length,0);pointer(next,'pointercancel',point(next,40));
 for(const raw of ['{','null','[]','{"position":"bad","size":"huge","assist":true}']){const stored={[PREF]:raw,[NS+'.session']:JSON.stringify(savedFixture('0.2.0'))};const old=await ready(t,stored);assert.deepEqual(plain(old.w.SudokuNavigator.ui.preferences()),{position:'atCell',size:'large',assist:'auto'});assert.equal(old.w.localStorage.getItem(PREF),raw,'boot must not rewrite bytes');assert.equal(old.get('playerGrid.flat().join(\'\')'),legacy.puzzle.join(''));}
 assert.deepEqual(h.errors,[]);assert.deepEqual(next.errors,[]);
});

test('P13-P15: stationary/jitter holds cancel; deliberate motion can choose the initially underlying digit and all nine on original cell',async t=>{
 const h=await ready(t),w=h.w,origin=40,p=point(h,origin);
 for(const delta of [null,{x:2,y:2},{x:7,y:0}]){
  const before=state(h);await hold(h,origin);if(delta)pointer(h,'pointermove',{x:p.x+delta.x,y:p.y+delta.y});pointer(h,'pointerup',p);assert.deepEqual(state(h),before);
 }
 // Touch Events exercise the same no-move guard after the 300 ms owner activates.
 const touch=(type,p)=>{const e=new w.Event(type,{bubbles:true,cancelable:true}),a={identifier:42,clientX:p.x,clientY:p.y,target:cell(h,origin)};Object.defineProperties(e,{touches:{value:type==='touchend'?[]:[a]},changedTouches:{value:[a]}});cell(h,origin).dispatchEvent(e);};
 touch('touchstart',p);await until(()=>h.el('uxPicker'),'touch hold');touch('touchend',p);assert.equal(h.get('history.length'),0);
 await sleep(1010);const l=await hold(h,origin),under=l.targets.find(q=>p.x>=q.left&&p.x<q.right&&p.y>=q.top&&p.y<q.bottom);assert.ok(under);
 pointer(h,'pointermove',{x:p.x+10,y:p.y});pointer(h,'pointermove',p);pointer(h,'pointerup',p);assert.equal(h.get('playerGrid[4][4]'),under.digit);w.undoMove();
 for(let d=1;d<=9;d++){const a=await hold(h,origin),style=h.el('uxPicker').getAttribute('style');pointer(h,'pointermove',point(h,80));assert.equal(h.el('uxPicker').getAttribute('style'),style);release(h,a,d);assert.equal(h.get('playerGrid[4][4]'),d);assert.equal(h.get('history.length'),1);cell(h,origin).dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:1,clientX:p.x,clientY:p.y}));assert.equal(h.get('selectedCell'),origin);w.undoMove();assert.equal(h.get('history.length'),0);}
 for(const where of ['gap','title','padding','outside']){const a=await hold(h),q=a.targets[0];pointer(h,'pointermove',{x:q.left+20,y:q.top+20});const end=where==='gap'?{x:q.right+2,y:q.top+20}:where==='title'?{x:q.left+10,y:q.top-12}:where==='padding'?{x:q.left-5,y:q.top+10}:{x:1,y:1};pointer(h,'pointerup',end);assert.equal(h.get('history.length'),0);}
 // Clamping can put another digit under the start; opening is never an entry.
 layout(h,-140);const edge=await hold(h,40);assert.ok(edge.footprint.top>=4);pointer(h,'pointerup',point(h,40));assert.equal(h.get('history.length'),0);assert.deepEqual(h.errors,[]);
});

test('P16/P17: all picker preferences leave loupe position, content and read-only behavior unchanged; stale gestures cancel',async t=>{
 const h=await ready(t),w=h.w;w.selectCell(2);w.placeNumber(4);await w.SudokuNavigator.whenReviewed();w.eval('notes[4][4]=new Set([1,6,8]);render()');const before=state(h);let position;
 for(const mode of ['atCell','context'])for(const size of ['normal','large','extraLarge']){
  choice(h,'uxPickerPosition',mode);choice(h,'uxPickerSize',size);choice(h,'uxCandidateAssist',size==='normal'?'off':size==='large'?'on':'auto');
  for(const origin of [0,2]){await hold(h,origin,'uxLoupe');const style=h.el('uxLoupe').getAttribute('style');position??=style;assert.equal(style,position);pointer(h,'pointermove',point(h,40));assert.equal(h.el('uxLoupe').querySelector('.ux-loupe-focus').textContent,'168');pointer(h,'pointerup',point(h,40));assert.deepEqual(state(h),before);}
 }
 choice(h,'uxPickerPosition','atCell');await hold(h,40);w.toggleNotes();pointer(h,'pointermove',point(h,80));assert.equal(h.el('uxPicker'),null);pointer(h,'pointerup',point(h,80));assert.deepEqual(h.get('playerGrid'),before.board);assert.deepEqual(h.errors,[]);
});

test('P18/P20: storage failure retains existing game/unknown preference bytes, reports session-only; blocked reads and lane separation',async t=>{
 const otherNS=NS.endsWith('PWA')?'ai8SudokuNavigatorV020':'ai8SudokuNavigatorV020PWA';
 const stored={[PREF]:JSON.stringify({assist:'off',futureFlag:'keep'}),[otherNS+'.uiPreferences']:JSON.stringify({size:'extraLarge',assist:'on'})};
 const h=await ready(t,stored),w=h.w;w.dispatchEvent(new w.Event('pagehide'));const before=h.store(),set=w.Storage.prototype.setItem;
 settings(h);w.Storage.prototype.setItem=function(k,v){if(k===PREF)throw Error('quota fixture');return set.call(this,k,v);};h.el('uxPickerSize').value='extraLarge';h.el('uxPickerSize').dispatchEvent(new w.Event('change',{bubbles:true}));assert.match(h.el('uxPreferenceStatus').textContent,/tab only/);assert.equal(w.localStorage.getItem(PREF),before[PREF]);assert.equal(w.localStorage.getItem(NS+'.session'),before[NS+'.session']);h.el('navClose').click();w.Storage.prototype.setItem=set;
 choice(h,'uxPickerPosition','context');assert.equal(JSON.parse(w.localStorage.getItem(PREF)).futureFlag,'keep');assert.equal(w.localStorage.getItem(otherNS+'.uiPreferences'),stored[otherNS+'.uiPreferences']);
 const get=w.Storage.prototype.getItem;w.Storage.prototype.getItem=function(k){if(k===PREF)throw Error('blocked fixture');return get.call(this,k);};assert.doesNotThrow(()=>w.SudokuNavigator.ui.readPreferences());assert.deepEqual(plain(w.SudokuNavigator.ui.preferences()),{position:'atCell',size:'large',assist:'auto'});w.Storage.prototype.getItem=get;
 const isolated=await boot(t,{[otherNS+'.uiPreferences']:stored[otherNS+'.uiPreferences']},{width:1440,height:900});assert.deepEqual(plain(isolated.w.SudokuNavigator.ui.preferences()),{position:'atCell',size:'normal',assist:'auto'});assert.deepEqual(h.errors,[]);
});

test('P18/P20: retained game/Notes/history and independent UI choices survive pagehide or PWA Save & update',async t=>{
 const h=await ready(t),w=h.w;choice(h,'uxPickerPosition','context');choice(h,'uxPickerSize','extraLarge');choice(h,'uxCandidateAssist','off');w.selectCell(2);w.placeNumber(4);await w.SudokuNavigator.whenReviewed();w.selectCell(3);w.toggleNotes();w.placeNumber(6);const before=state(h);
 if(LANE==='PWA')assert.equal(w.SudokuNavigator.flushForUpdate(),true);else w.dispatchEvent(new w.Event('pagehide'));
 const next=await ready(t,h.store());assert.deepEqual(state(next),before);assert.deepEqual(plain(next.w.SudokuNavigator.ui.preferences()),{position:'context',size:'extraLarge',assist:'off'});next.w.undoMove();assert.deepEqual(next.get('[...notes[0][3]]'),[]);assert.deepEqual(h.errors,[]);assert.deepEqual(next.errors,[]);
});
