'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {boot,savedFixture,fixture,fixtureSolution,plain,NS,until,sleep}=require('./sudoku-ui-harness.cjs');
async function ready(t,stored={}){const h=await boot(t,stored,{width:1200,height:900});if(!Object.keys(stored).length)await h.w.SudokuNavigator.restore(savedFixture('0.2.0'));h.w.stopTimer();return h;}
function bytes(h){return plain(h.w.SudokuNavigator.export().session);}
function core(){const x={module:{exports:{}}};vm.runInNewContext(fs.readFileSync('public/S/new/app.html','utf8').match(/<script id="navigator-core">([\s\S]*?)<\/script>/)[1],x);return x.module.exports;}
const C=core(),corpus=JSON.parse(fs.readFileSync('tests/fixtures/sudoku-arena-31.json')).puzzles;

test('CP1: three views share the board, notes, history and policy; opening views runs no worker',async t=>{
 const h=await ready(t),w=h.w,p=w.SudokuNavigator.product;w.selectCell(2);w.toggleNotes();w.placeNumber(4);const before=bytes(h),requests=h.requests.length;
 for(const v of ['learn','lab','play']){p.switchView(v);assert.equal(w.document.body.dataset.view,v);assert.deepEqual(bytes(h),before);}
 assert.equal(h.requests.length,requests);assert.equal(h.el('plLearnActions').querySelectorAll('#navTutor').length,1);assert.deepEqual(h.errors,[]);
});
test('CP1: tutorial is optional, isolated and replayable; preferences retain unknown fields',async t=>{
 const h=await ready(t),p=h.w.SudokuNavigator.product,b=bytes(h);p.tutorialDialog();h.el('plTutorialCell').click();h.el('plTutorialNumber').click();assert.equal(h.el('plTutorialCell').textContent,'4');h.el('plTutorialUndo').click();assert.equal(h.el('plTutorialCell').textContent,'·');h.el('plTutorialSkip').click();assert.deepEqual(bytes(h),b);
 h.w.localStorage.setItem(NS+'.uiPreferences',JSON.stringify({future:{x:1},position:'context'}));p.writePref('theme','light');p.writePref('notesSize','large');p.writePref('timer','hide');assert.equal(h.w.document.documentElement.dataset.theme,'light');assert(h.el('timer').hidden);assert.equal(h.get('timerSeconds'),b.time);assert.deepEqual(JSON.parse(h.w.localStorage.getItem(NS+'.uiPreferences')).future,{x:1});assert.deepEqual(h.errors,[]);
});
test('CP2: None/Direct conflicts are independent of assist; hints and reviews do not call the answer oracle',async t=>{
 const h=await ready(t),w=h.w,p=w.SudokuNavigator.product;p.writePref('feedback','none');w.selectCell(2);w.placeNumber(1);await w.SudokuNavigator.whenReviewed();assert(!h.el('grid').children[2].classList.contains('error'));assert.equal(w.SudokuNavigator.review()[0].answer,'NOT_CHECKED');assert.doesNotMatch(h.el('reviewSummary').textContent,/Wrong|Incorrect/);
 // A locally consistent incorrect entry must not trigger the old correction-first oracle.
 w.eval('solution=Array.from({length:9},()=>Array(9).fill(9))');await w.SudokuNavigator.analyze('nudge');assert.doesNotMatch(h.el('navCopy').textContent,/unique solution|answer checking|highlighted entries/);assert(!w.SudokuNavigator.export().session.assistance.some(x=>x.type==='correction_feedback'));
 assert.equal(w.SudokuNavigator.ui.preferences().assist,'auto');assert.deepEqual(h.errors,[]);
});
test('CP2: correctness disclosure is explicit and cancellation records no assistance',async t=>{
 const h=await ready(t),w=h.w,p=w.SudokuNavigator.product;w.selectCell(2);w.placeNumber(1);await w.SudokuNavigator.whenReviewed();p.checkCorrectness();h.el('plCheckCancel').click();assert.equal(bytes(h).assistance.length,0);p.checkCorrectness();h.el('plCheckConfirm').click();assert.match(h.el('navModalBody').textContent,/1 entered value/);h.el('navClose').click();w.undoMove();assert.equal(bytes(h).assistance.filter(x=>x.type==='explicit_answer_check').length,1);w.redoMove();assert.equal(bytes(h).assistance.filter(x=>x.type==='explicit_answer_check').length,1);
});
test('CP2: number-first arms, targets only empty editable cells, keyboard Escape disarms',async t=>{
 const h=await ready(t),w=h.w,p=w.SudokuNavigator.product;p.writePref('entryMode','number');w.placeNumber(4);assert.equal(p.armed(),4);assert.equal(h.get('history.length'),0);h.el('grid').children[2].click();assert.equal(h.get('playerGrid[0][2]'),4);assert.equal(h.get('history.length'),1);h.el('grid').children[0].click();assert.equal(h.get('history.length'),1);h.el('grid').children[2].click();assert.equal(h.get('playerGrid[0][2]'),4);w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(p.armed(),0);w.placeNumber(2);p.about();assert.equal(p.armed(),0);h.el('navClose').click();assert.deepEqual(h.errors,[]);
});
test('CP2: cleanup and Notes are one reversible transaction; Redo branch invalidates without rewinding time/help',async t=>{
 const h=await ready(t),w=h.w,p=w.SudokuNavigator.product;w.eval('notes[0][5].add(4);notes[1][2].add(4);render()');p.writePref('cleanup','on');assert.deepEqual(h.get('[...notes[0][5]]'),[4]);w.selectCell(2);w.placeNumber(4);await w.SudokuNavigator.whenReviewed();assert.deepEqual(h.get('[...notes[0][5]]'),[]);w.undoMove();assert.deepEqual(h.get('[...notes[0][5]]'),[4]);w.redoMove();assert.deepEqual(h.get('[...notes[0][5]]'),[]);const time=h.get('timerSeconds');w.undoMove();w.toggleNotes();w.placeNumber(3);assert.equal(bytes(h).redo.length,0);w.undoMove();w.redoMove();assert.deepEqual(h.get('[...notes[0][2]]'),[3]);assert.equal(h.get('timerSeconds'),time);assert.deepEqual(h.errors,[]);
});
test('CP2: checked elimination participates in history without treating Notes as proof',async t=>{
 const h=await ready(t),w=h.w,p=w.SudokuNavigator.product;const ex=p.lessonExample(2);const s=savedFixture('0.2.0');
 // Exercise an actual unique corpus prefix with the first elimination in its rated path.
 const r=C.ratePuzzle(corpus[5].puzzle);let st=C.state(corpus[5].puzzle),prefix=[];let q;
 for(const x of r.path){if(x.c<0){q=x;break;}st=C.apply(st,x);prefix.push(x);}
 assert(q);s.puzzle=[...corpus[5].puzzle].map(Number);s.board=plain(st.b);s.lineage={base:s.puzzle,ops:plain(prefix).map(q=>({kind:'proof',q}))};await w.SudokuNavigator.restore(s);const before=plain(w.SudokuNavigator.state());await w.SudokuNavigator.analyze('reveal');w.SudokuNavigator.applyElimination();const after=plain(w.SudokuNavigator.state());assert.notDeepEqual(after,before);w.undoMove();assert.deepEqual(plain(w.SudokuNavigator.state()),before);w.redoMove();assert.deepEqual(plain(w.SudokuNavigator.state()),after);assert(bytes(h).assistance.length>0);assert.deepEqual(h.errors,[]);
});
test('CP2/CP4: saved Redo, legacy Undo and unknown session metadata survive reload',async t=>{
 const h=await ready(t),w=h.w,s=savedFixture('0.2.0');s.futureExtension={keep:'yes'};await w.SudokuNavigator.restore(s);w.selectCell(2);w.placeNumber(4);await w.SudokuNavigator.whenReviewed();w.undoMove();assert(await w.SudokuNavigator.product.flush());const h2=await boot(t,h.store());await until(()=>h2.w.SudokuNavigator.state(),'restore');h2.w.stopTimer();h2.w.redoMove();assert.equal(h2.get('playerGrid[0][2]'),4);assert.deepEqual(bytes(h2).futureExtension,{keep:'yes'});assert.deepEqual(h2.errors,[]);
});
test('CP3: four positive profile fixtures complete lower closure and independently replay',()=>{
 for(const [i,label]of [[0,'easy'],[5,'medium'],[30,'hard'],[7,'evil']]){const r=C.ratePuzzle(corpus[i].puzzle);assert.equal(r.status,'RATED');assert.equal(r.label,label);assert(r.tiers.every(x=>x.complete));assert(r.tiers.slice(0,-1).every(x=>x.status==='STALLED'));let s=C.state(corpus[i].puzzle);for(const q of r.path){assert(C.check(s,q));s=C.apply(s,q);}assert.equal(s.b.join(''),corpus[i].solution);assert.deepEqual(plain(C.ratePuzzle(corpus[i].puzzle)),plain(r));}
});
test('CP3: limits, unsupported, invalid and nonunique never acquire a rated label',()=>{
 for(const [p,opts,status]of [[corpus[7].puzzle,{budget:0},'UNRATED_LIMIT'],[corpus[24].puzzle,{},'UNSUPPORTED'],['0'.repeat(81),{},'MULTIPLE'],['11'+'0'.repeat(79),{},'INVALID'],[corpus[7].puzzle,{maxNodes:0},'UNRATED_LIMIT']]){const r=C.ratePuzzle(p,opts);assert.equal(r.status,status);assert.equal(r.label,undefined);}
 const r=C.generate({diff:'evil',seed:1,maxAttempts:2,ratingBudget:0});assert.equal(r.status,'PROFILE_UNFULFILLED');assert.equal(r.attempts,2);assert.equal(r.outcomes.length,2);assert(r.outcomes.every(x=>x.status==='UNRATED_LIMIT'));
});
test('CP3: all eight lessons use checked example relationships, never the construction answer',async t=>{
 const h=await ready(t),p=h.w.SudokuNavigator.product,C=h.w.SudokuNavigator.core;for(let t=0;t<8;t++){const x=p.lessonExample(t);assert.equal(x.q.t,t);assert(C.check(x.s,x.q));p.lesson(t);assert.match(h.el('navModalBody').textContent,/Teaching example/);h.el('navClose').click();}assert.deepEqual(h.errors,[]);
});
test('CP4: migration retains current and previous games; favorites/resume are distinct attempts',async t=>{
 const s=savedFixture('0.2.0'),prev={...s,gameId:'previous-attempt',time:11};const h=await boot(t,{[NS+'.session']:JSON.stringify(s),[NS+'.previousGame']:JSON.stringify(prev)});await until(()=>h.w.SudokuNavigator.state(),'current restored');await until(()=>h.w.SudokuNavigator.product.entries().length===1,'previous migrated');assert(await h.w.SudokuNavigator.product.flush());const p=h.w.SudokuNavigator.product;assert.equal(p.entries().length,2);p.libraryDialog();const b=h.w.document.querySelector('[data-favorite="previous-attempt"]');await b.onclick();assert(p.entries().find(x=>x.id==='previous-attempt').favorite);assert.equal(h.get('timerSeconds'),37);assert.deepEqual(h.errors,[]);
});
test('CP4: quotas and detected stale writers preserve the active board and saved bytes',async t=>{
 const h=await ready(t),w=h.w,p=w.SudokuNavigator.product;assert(await p.flush());const original=w.localStorage.getItem(NS+'.library'),board=h.get('playerGrid');w.localStorage.setItem(NS+'.library',JSON.stringify({...JSON.parse(original),revision:88}));assert.equal(await p.flush(),false);assert.deepEqual(h.get('playerGrid'),board);assert.equal(JSON.parse(w.localStorage.getItem(NS+'.library')).revision,88);assert.match(h.el('plStorageText').textContent,/another tab/);
 const q=await ready(t),p2=q.w.SudokuNavigator.product,proto=Object.getPrototypeOf(q.w.localStorage),set=proto.setItem;proto.setItem=function(k,v){if(k.includes('.recovery.'))throw Error('QuotaExceededError');return set.call(this,k,v);};assert.equal(await p2.archive(),false);assert.deepEqual(q.get('playerGrid'),board);assert.match(q.el('plStorageText').textContent,/QuotaExceeded/);
});
test('CP4: corrupt/versioned saves remain byte-for-byte recoverable; deletion does not resurrect',async t=>{
 const raw='{"damaged":';const h=await boot(t,{[NS+'.session']:raw,[NS+'.uiPreferences']:'broken'});h.w.dispatchEvent(new h.w.Event('pagehide'));assert.equal(h.w.localStorage.getItem(NS+'.session'),raw);assert.equal(h.w.localStorage.getItem(NS+'.uiPreferences'),'broken');assert(!h.w.SudokuNavigator.product.canWrite());
 const q=await ready(t);assert(await q.w.SudokuNavigator.product.flush());q.w.SudokuNavigator.product.deleteEverything();q.w.dispatchEvent(new q.w.Event('pagehide'));await sleep(230);assert.equal(q.w.localStorage.getItem(NS+'.library'),null);assert.equal(q.w.localStorage.getItem(NS+'.session'),null);assert(q.w.localStorage.getItem(NS+'.deletionEpoch'));assert.equal(q.get('playerGrid'),null);
});
test('CP4: daily calendar uses explicit UTC and finite immutable catalog; every catalog entry is certified',async t=>{
 const h=await ready(t),p=h.w.SudokuNavigator.product;assert.deepEqual(plain(p.dailyIdentity('2026-09-28')),plain(p.dailyIdentity(new Date('2026-09-28T01:00:00+01:00').toISOString().slice(0,10))));assert.equal(p.dailyIdentity('2026-10-06').index,p.dailyIdentity('2026-09-28').index);assert.throws(()=>p.dailyIdentity('2026-02-30'));for(const x of C.DAILY_CATALOG)assert.equal(C.ratePuzzle(x.givens).status,'RATED');await p.startDaily('2026-09-28');assert.equal(bytes(h).daily.date,'2026-09-28');const actual=bytes(h).puzzle;await p.startDaily('2026-09-28');assert.deepEqual(bytes(h).puzzle,actual);assert.equal(p.entries().filter(x=>x.session.daily?.date==='2026-09-28').length,1);
});
test('CP4: share schema contains only givens; malformed/nonunique links leave game and storage intact',async t=>{
 const h=await ready(t),p=h.w.SudokuNavigator.product;const hash=p.shareCodec([...fixture].map(Number));assert.match(hash,/^s=1\.[0-9]{81}$/);assert.equal(p.decodeShare(hash).join(''),fixture);for(const bad of ['s=2.'+fixture,'s=1.'+'0'.repeat(1000),'s=1.<img>'])assert.throws(()=>p.decodeShare(bad));const before=h.store();assert.equal(await p.inspectShare('s=1.'+'0'.repeat(81)),false);assert.deepEqual(h.store(),before);assert.equal(h.get('puzzle.flat().join(\'\')'),fixture);assert.equal(await p.inspectShare(hash),true);h.el('plCancelShare').click();assert.deepEqual(h.store(),before);const wrapper=fs.readFileSync('public/S/new/index.html','utf8');assert.match(wrapper,/\.\/app\.html"\+location\.hash/);
});

test('CP2: sticky digit and held picker/magnifier swallow ghost clicks and commit exactly once',async t=>{
 const h=await ready(t),w=h.w,p=w.SudokuNavigator.product,G=w.SudokuMobileGeometry;
 const pt=i=>({x:409+i%9*73,y:226+Math.floor(i/9)*73});
 [...h.el('grid').children].forEach((c,i)=>c.getBoundingClientRect=()=>G.rect(373+i%9*73,190+Math.floor(i/9)*73,72,72));
 function event(target,type,q){const e=new w.MouseEvent(type,{bubbles:true,cancelable:true,clientX:q.x,clientY:q.y,button:0,buttons:type==='pointerup'?0:1});for(const[k,v]of Object.entries({pointerId:1,pointerType:'mouse',isPrimary:true}))Object.defineProperty(e,k,{value:v});target.dispatchEvent(e);}
 p.writePref('entryMode','number');w.placeNumber(1);event(h.el('grid').children[2],'pointerdown',pt(2));await until(()=>h.el('uxPicker'),'held picker');const r=w.SudokuNavigator.ui.geometry(2).targets[3],q={x:r.left+r.width/2,y:r.top+r.height/2};event(w.document,'pointermove',q);event(w.document,'pointerup',q);h.el('grid').children[2].dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:1}));assert.equal(h.get('playerGrid[0][2]'),4);assert.equal(h.get('history.length'),1);
 const before=bytes(h);event(h.el('grid').children[0],'pointerdown',pt(0));await until(()=>h.el('uxLoupe'),'loupe');event(w.document,'pointermove',pt(3));event(w.document,'pointerup',pt(3));h.el('grid').children[0].dispatchEvent(new w.MouseEvent('click',{bubbles:true,detail:1}));assert.deepEqual(bytes(h).board,before.board);assert.equal(h.get('history.length'),1);assert.deepEqual(h.errors,[]);
});
test('CP2/CP4: actual legacy history remains reversible and restored help exposure is monotone',async t=>{
 const h=await ready(t),w=h.w,s=savedFixture('0.2.0');s.board[2]=4;s.lineage={base:s.board,ops:[]};s.history=[{r:0,c:2,prev:0,pn:[],action:'place_value'}];await w.SudokuNavigator.restore(s);w.undoMove();assert.equal(h.get('playerGrid[0][2]'),0);w.redoMove();assert.equal(h.get('playerGrid[0][2]'),4);
 const old=bytes(h);w.SudokuNavigator.product.checkCorrectness();h.el('plCheckConfirm').click();h.el('navClose').click();await w.SudokuNavigator.restore(old);assert.equal(bytes(h).assistance.filter(x=>x.type==='explicit_answer_check').length,1);assert.deepEqual(h.errors,[]);
});
test('CP3/CP4: real generated practice archives and returns to the original Notes/history/time',async t=>{
 const h=await ready(t),w=h.w,p=w.SudokuNavigator.product;w.selectCell(2);w.toggleNotes();w.placeNumber(4);const before=bytes(h);p.switchView('learn');h.el('navTechnique').value='0';await h.el('navPractice').onclick();assert(bytes(h).practice);assert.equal(bytes(h).returnGame,before.gameId);p.switchView('play');p.more();assert(h.w.document.querySelector('[data-menu="Return to my game"]'));h.el('navClose').click();await p.returnPractice();const after=bytes(h);for(const k of ['gameId','board','notes','history','time'])assert.deepEqual(after[k],before[k],k);assert.equal(w.document.body.dataset.view,'play');assert.deepEqual(h.errors,[]);
});
test('CP4: interrupted canonical writes retain recovery and transformed libraries enforce the game limit',async t=>{
 const h=await ready(t),p=h.w.SudokuNavigator.product;assert(await p.flush());const raw=h.w.localStorage.getItem(NS+'.library');assert.equal(p.flushSync(null,l=>{for(let i=0;i<12;i++)l.entries.push({id:'overflow-'+i,session:{...savedFixture('0.2.0'),gameId:'overflow-'+i}});}),false);assert.equal(h.w.localStorage.getItem(NS+'.library'),raw);
 const proto=Object.getPrototypeOf(h.w.localStorage),set=proto.setItem;proto.setItem=function(k,v){if(k===NS+'.library')throw Error('interrupted canonical write');return set.call(this,k,v);};assert.equal(await p.flush(),false);assert.equal(h.w.localStorage.getItem(NS+'.library'),raw);assert(Object.keys(h.store()).some(k=>k.startsWith(NS+'.recovery.')));assert.deepEqual(h.errors,[]);
});
test('CP2/CP4: consented trace replays Redo and peer cleanup, including reload; legacy trace remains readable',async t=>{
 const h=await ready(t),w=h.w,p=w.SudokuNavigator.product;w.eval('notes[0][5].add(4)');p.writePref('cleanup','on');w.AI8SudokuTestAPI.consent();w.selectCell(2);w.placeNumber(4);w.undoMove();w.redoMove();const trace=w.AI8SudokuTestAPI.exportTrace();assert(trace.events.some(e=>e.action==='redo'));assert(trace.events.find(e=>e.action==='place_value').payload.note_changes.length);const replay=w.replayStoredTraceState(trace);assert(replay);assert.equal(replay.board[2],4);assert.equal(replay.masks[5],0);
 const old=plain(trace);old.engine_id='8Z_SUDOKU_HTML_HUMAN_TRACE_V1_2_0';old.trace_hash=w.AI8SudokuHumanTrace.traceHash(old);assert(w.eval('humanTraceRecorder').validateStoredObject(old).ok);
 assert(await p.flush());const h2=await boot(t,h.store());await until(()=>!h2.w.SudokuNavigator.ui.blocked(),'trace and session restored');assert.equal(bytes(h2).gameId,bytes(h).gameId);assert.equal(h2.get('playerGrid[0][2]'),4);assert(h2.w.AI8SudokuTestAPI.continueRecovered());h2.w.undoMove();assert.equal(h2.get('playerGrid[0][2]'),0);assert.deepEqual(h2.get('[...notes[0][5]]'),[4]);assert.deepEqual(h.errors,[]);assert.deepEqual(h2.errors,[]);
});
test('CP4: cross-tab deletion prevents trace, statistics and lifecycle resurrection',async t=>{
 const h=await ready(t),w=h.w,p=w.SudokuNavigator.product;w.AI8SudokuTestAPI.consent();w.selectCell(2);w.placeNumber(4);assert(w.localStorage.getItem(NS+'.trace'));
 const keys=Object.keys(h.store());for(const k of keys)w.localStorage.removeItem(k);w.localStorage.setItem(NS+'.deletionEpoch','other-tab');w.dispatchEvent(new w.StorageEvent('storage',{key:NS+'.deletionEpoch',newValue:'other-tab'}));w.dispatchEvent(new w.Event('beforeunload'));w.dispatchEvent(new w.Event('pagehide'));w.saveStats();await sleep(230);assert.equal(p.canWrite(),false);assert.deepEqual(Object.keys(h.store()),[NS+'.deletionEpoch']);assert.deepEqual(h.errors,[]);
});
test('CP3/CP4: forged rating does not replace current game; view changes cancel pending generation',async t=>{
 const h=await ready(t),w=h.w,p=w.SudokuNavigator.product,old=bytes(h),bad=savedFixture('0.2.0');bad.generationEvidence={difficulty:{rating:{status:'RATED',version:C.RATING_VERSION,label:'evil'}}};await assert.rejects(w.SudokuNavigator.restore(bad),/RATING_NOT_REPRODUCED/);assert.deepEqual(bytes(h).board,old.board);h.delayKinds.generate=200;const pending=w.SudokuNavigator.createGame('easy');await sleep(10);p.switchView('learn');await pending;await sleep(240);assert.deepEqual(bytes(h).board,old.board);assert.deepEqual(h.errors,[]);
});
test('CP4: exact PR47 captured session retains values, Notes, review and its legacy Undo',async t=>{
 const f=JSON.parse(fs.readFileSync('tests/fixtures/sudoku-pr47-session-v1.json'));assert.equal(f.sourceSha256,'2f5e6bf38f35db866802fca0bfb31be107636c6e90d0e0a6bd1ea0bfc4b5e6ca');const h=await boot(t,{[NS+'.session']:JSON.stringify(f.session)});await until(()=>h.w.SudokuNavigator.state(),'PR47 fixture recovered');const s=bytes(h);for(const k of ['gameId','board','notes','rows','time','history'])assert.deepEqual(s[k],f.session[k],k);h.w.stopTimer();h.w.undoMove();assert.deepEqual(h.get('[...notes[0][3]]'),[1]);h.w.redoMove();assert.deepEqual(h.get('[...notes[0][3]]'),[1,6]);assert.deepEqual(h.errors,[]);
});
