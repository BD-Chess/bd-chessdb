'use strict';
// APP-specific learning affordances; actual game/worker stays the packaged donor.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {boot,savedFixture,fixture,fixtureSolution,plain,until}=require('./sudoku-ui-harness.cjs');
const ui=fs.readFileSync('public/S/app/app-ui.js','utf8');
const start=ui.indexOf(' function candidates('),end=ui.indexOf(' let lastBoard=');
assert.ok(start>=0&&end>start,'bounded read-only Coach helpers');
const helpers=vm.runInNewContext(ui.slice(start,end)+'\n({candidates,boardIssue,coachProof})');
const current=h=>plain(h.w.SudokuNavigator.export().session);
const txt=h=>h.el('appCoachCopy').textContent;
const set=(h,id,value)=>{const el=h.el(id);assert.ok(el,id);el.value=value;el.dispatchEvent(new h.w.Event('change',{bubbles:true}));};
async function ready(t,stored={}){
 const h=await boot(t,stored,{width:390,height:844},{lane:'APP'});
 await h.w.SudokuNavigator.restore(savedFixture('0.2.0'));h.w.stopTimer();
 await until(()=>!/Restoring/.test(txt(h)),'Coach waits for saved-game restore');
 return h;
}
async function settings(h){
 h.el('appMore').click();
 await until(()=>h.w.document.querySelector('#navModalBody [data-menu="Settings"]'),'real More menu');
 h.w.document.querySelector('#navModalBody [data-menu="Settings"]').click();
 await until(()=>h.el('appHoldTipSetting'),'actual Settings contains APP preferences');
}
test('Coach proof validates the entered digit, rejects conflicts and never mutates its inputs',()=>{
 const before=[...fixture].map(Number),correct=before.slice(),wrong=before.slice();correct[40]=5;wrong[40]=1;
 assert.equal(helpers.boardIssue(before),null);
 assert.deepEqual(Array.from(helpers.candidates(before,40)),[5]);
 assert.equal(helpers.coachProof(before,correct,40)?.kind,'naked');
 assert.equal(helpers.coachProof(before,wrong,40),null,'wrong digit must never earn a naked-single explanation');
 assert.equal(helpers.boardIssue(wrong)?.kind,'duplicate');
 const multi=correct.slice();multi[2]=4;
 assert.equal(helpers.coachProof(before,multi,40),null,'restore/bulk updates are not one player move');
 assert.equal(helpers.boardIssue([1,2])?.kind,'invalid');
 assert.equal(helpers.boardIssue(Array(81).fill(0)),null);
 assert.deepEqual(before,[...fixture].map(Number));
 assert.deepEqual(correct,before.map((n,i)=>i===40?5:n));
});
test('actual Settings toggles number pad, Coach and independent hold tip without changing the game',async t=>{
 const h=await ready(t),before=current(h);
 assert.equal(h.el('plNumbers').hidden,true);
 assert.equal(h.el('appHoldTip').hidden,false);
 assert.equal(h.el('appCoach').hidden,false);
 assert.match(h.el('appHoldTip').textContent,/Tap & hold an empty cell/);
 await settings(h);
 assert.equal(h.el('appNumberPad').value,'off');
 assert.equal(h.el('appCoachMode').value,'easy');
 assert.equal(h.el('appCoachDetail').value,'short');
 assert.equal(h.el('appHoldTipSetting').value,'on');
 set(h,'appNumberPad','on');assert.equal(h.el('plNumbers').hidden,false);assert.equal(h.el('appCoach').hidden,true);
 set(h,'appHoldTipSetting','off');assert.equal(h.el('appHoldTip').hidden,true);
 set(h,'appNumberPad','off');assert.equal(h.el('plNumbers').hidden,true);assert.equal(h.el('appCoach').hidden,false);
 set(h,'appCoachMode','off');assert.equal(h.el('appCoach').hidden,true);
 set(h,'appHoldTipSetting','on');assert.equal(h.el('appHoldTip').hidden,false,'tip is independent of Coach');
 set(h,'appCoachMode','always');set(h,'appCoachDetail','detailed');assert.equal(h.el('appCoach').hidden,false);
 set(h,'appHoldTipSetting','off');
 for(const key of ['board','puzzle','notes','history','assistance'])assert.deepEqual(current(h)[key],before[key],key+' unchanged');
 assert.equal(h.w.localStorage.getItem('8zSudoku.app.ui.holdTip'),'off');
 assert.equal(h.w.localStorage.getItem('8zSudoku.app.ui.coach'),'always');
 assert.equal(h.w.localStorage.getItem('8zSudoku.app.ui.coachDetail'),'detailed');
 h.el('navClose').click();h.w.SudokuI18n.set('sl');
 await until(()=>/Tapni in drži prazno/.test(h.el('appHoldTip').textContent),'SL tip stays localized while hidden');
 assert.deepEqual(h.errors,[]);
});
test('Coach follows the selected cell, discloses candidates only on request and preserves the board',async t=>{
 const h=await ready(t),before=current(h).board;
 h.el('grid').children[40].click();
 await until(()=>current(h).selectedCell===40&&/naked single/.test(txt(h)),'selected-cell deduction');
 assert.doesNotMatch(txt(h),/only 5|candidate: 5|Candidates for R5C5: 5/,'no automatic answer');
 assert.equal(h.el('appCoachCandidates').disabled,false);
 h.el('appCoachCandidates').click();
 assert.match(txt(h),/Candidates for R5C5: 5\./);
 assert.deepEqual(current(h).board,before);
 h.el('grid').children[0].click();
 await until(()=>/given/.test(txt(h)),'selecting a given replaces stale candidate advice');
 assert.equal(h.el('appCoachCandidates').disabled,true);
 assert.deepEqual(h.errors,[]);
});
test('saved UI preferences survive an APP restart and Coach is off for harder games in Easy-only mode',async t=>{
 const saved={'8zSudoku.app.ui.numberPad':'on','8zSudoku.app.ui.holdTip':'off','8zSudoku.app.ui.coach':'easy','8zSudoku.app.ui.coachDetail':'detailed','8zSudoku.ui.language':'sl'};
 const h=await ready(t,saved);
 assert.equal(h.el('plNumbers').hidden,false);assert.equal(h.el('appHoldTip').hidden,true);
 await settings(h);set(h,'appNumberPad','off');h.el('navClose').click();
 const harder=savedFixture('0.2.0');harder.diff='hard';
 await h.w.SudokuNavigator.restore(harder);h.w.stopTimer();
 await until(()=>h.el('appCoach').hidden,'Easy-only Coach does not intrude on Hard');
 assert.equal(h.w.localStorage.getItem('8zSudoku.ui.language'),'sl','LAB preference untouched');
 assert.deepEqual(h.errors,[]);
});


test('Hard and Evil suppress proactive Coach/tip help and enable centered quiet-play layout',async t=>{
 const h=await ready(t,{'8zSudoku.app.ui.holdTip':'on','8zSudoku.app.ui.coach':'always'});
 for(const diff of ['hard','evil']){
  const game=savedFixture('0.2.0');game.diff=diff;
  await h.w.SudokuNavigator.restore(game);h.w.stopTimer();
  await until(()=>h.w.document.body.dataset.appHardNoHelp==='true',diff+' quiet-play mode');
  assert.equal(h.el('appCoach').hidden,true,diff+' Coach hidden');
  assert.equal(h.el('appHoldTip').hidden,true,diff+' tap/hold tip hidden');
  assert.equal(h.el('appAssist').hidden,false,diff+' AI Assist remains available on demand');
 }
 assert.deepEqual(h.errors,[]);
});

test('APP ordinary generation failure silently uses a checked example instead of a profile modal',async t=>{
 const h=await ready(t),w=h.w,before=current(h),oldId=before.gameId;
 h.resultKinds.generate=data=>({...data,result:{status:'PROFILE_UNFULFILLED',attempts:8}});
 await w.SudokuNavigator.createGame('evil');
 await until(()=>current(h).diff==='evil'&&current(h).gameId!==oldId,'checked evil fallback opened');
 assert.equal(h.el('navModal').hidden,true,'no failure modal');
 assert.doesNotMatch(h.el('navModalBody').textContent,/Profile not fulfilled/);
 assert.deepEqual(h.errors,[]);
});
