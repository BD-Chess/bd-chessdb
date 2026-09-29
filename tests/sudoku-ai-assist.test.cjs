'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {boot,savedFixture,fixtureSolution,plain,until}=require('./sudoku-ui-harness.cjs');

async function ready(t,stored={}){
 const h=await boot(t,stored,{width:1440,height:900});
 if(!Object.keys(stored).length)await h.w.SudokuNavigator.restore(savedFixture('0.2.0'));
 h.w.stopTimer();
 return h;
}
const session=h=>plain(h.w.SudokuNavigator.export().session);
const filled=b=>b.filter(Boolean).length;
const assist=h=>h.el('aiAssistText').textContent.trim();
function givensStay(puzzle,board){for(let i=0;i<81;i++)if(puzzle[i])assert.equal(board[i],puzzle[i],`given ${i} stayed fixed`);}

test('AI Assist: Learn sidebar stays visible; Play opens it on demand and Hint differs from Why for zero-support mistake',async t=>{
 const h=await ready(t),w=h.w,p=w.SudokuNavigator.product;
 assert.equal(h.el('aiAssistPanel').hidden,true,'Play starts with a simple board');
 p.switchView('learn');
 assert.equal(h.el('aiAssistPanel').hidden,false,'Learn keeps the sidebar open');
 h.el('aiAssistWhy').click();
 p.switchView('play');
 assert.equal(h.el('aiAssistPanel').hidden,true,'Play resets to its simple board after using Learn help');

 w.selectCell(2);w.placeNumber(1); // R1C3: no duplicate, but one digit has no unit support.
 const before=session(h);
 assert.equal(w.SudokuNavigator.core.exact(before.board,100000).status,'UNSAT');
 assert.equal(h.el('grid').children[2].classList.contains('error'),false,'mistake is not a direct duplicate');
 h.el('plHint').click();
 await until(()=>!h.el('aiAssistPanel').hidden&&/R1C3|row 1,? column 3/i.test(assist(h)),'Hint identifies the player entry');
 const hint=assist(h);
 assert.deepEqual(session(h).board,before.board,'Hint never fills or erases a value');
 h.el('plWhy').click();
 await until(()=>assist(h)!==hint,'Why adds a different explanation');
 assert.match(assist(h),/R1C3|row 1,? column 3/i);
 assert.match(assist(h),/solution|answer|certified|candidate|support|row|column|box/i);
 assert.deepEqual(session(h).board,before.board);
 w.eraseCell('pointer');
 assert.equal(session(h).board[2],0);
 assert.match(assist(h),/Board changed|Mreža se je spremenila/,'manual correction invalidates prior advice');
 assert.deepEqual(h.errors,[]);
});

test('AI Assist: a deeper wrong entry is diagnosed and cleared with reversible history, Notes and saved game intact',async t=>{
 const h=await ready(t),w=h.w;
 w.selectCell(3);w.toggleNotes();w.placeNumber(7);w.toggleNotes();
 w.selectCell(2);w.placeNumber(2); // R1C3 has candidates, yet this puzzle has no solution.
 const before=session(h);
 assert.ok(w.SudokuNavigator.core.state(before.board));
 assert.equal(w.SudokuNavigator.core.exact(before.board,100000).status,'UNSAT');
 h.el('plDemo').click();
 await until(()=>!h.el('aiAssistPanel').hidden&&/R1C3|row 1,? column 3/i.test(assist(h)),'AI Assist identifies the deeper wrong entry');
 assert.deepEqual(session(h).board,before.board,'opening the assistant does not change the game');
 h.el('aiAssistRemove').click();
 await until(()=>session(h).board[2]===0,'wrong editable entry removed');
 const after=session(h);
 givensStay(before.puzzle,after.board);
 assert.deepEqual(after.notes[3],[7],'unrelated Notes remain');
 w.undoMove();assert.equal(session(h).board[2],2,'Undo restores the removed digit');
 w.redoMove();assert.equal(session(h).board[2],0,'Redo reapplies the correction');
 assert.deepEqual(session(h).notes[3],[7]);
 assert(await w.SudokuNavigator.product.flush(),'the correction saves');
 const again=await ready(t,h.store());
 await until(()=>again.w.SudokuNavigator.state()&&session(again).board[2]===0,'corrected game recovered');
 assert.deepEqual(session(again).notes[3],[7]);
 assert.deepEqual(h.errors,[]);assert.deepEqual(again.errors,[]);
});

test('AI Assist: reveal and apply advance by one digit; Solve all needs its own explicit action',async t=>{
 const h=await ready(t),w=h.w,p=w.SudokuNavigator.product;
 p.switchView('learn');
 const before=session(h),n=filled(before.board);
 h.el('aiAssistNext').click();
 await until(()=>/R\dC\d|row \d/i.test(assist(h)),'next step selected');
 const next=assist(h);
 assert.deepEqual(session(h).board,before.board,'selecting a step does not fill the board');
 h.el('aiAssistReveal').click();
 await until(()=>assist(h)!==next,'one digit revealed');
 assert.match(assist(h),/\b[1-9]\b/);
 assert.deepEqual(session(h).board,before.board,'revealing a digit does not fill the board');
 h.el('aiAssistApply').click();
 await until(()=>filled(session(h).board)===n+1,'one step entered');
 const one=session(h);
 givensStay(before.puzzle,one.board);
 assert.equal(one.board.filter((v,i)=>v!==before.board[i]).length,1,'one click makes exactly one placement');
 const changed=one.board.findIndex((v,i)=>v!==before.board[i]);
 assert.equal(one.board[changed],Number(fixtureSolution[changed]),'the entered digit matches the certified solution');
 w.undoMove();assert.deepEqual(session(h).board,before.board);
 w.redoMove();assert.deepEqual(session(h).board,one.board);
 assert.notEqual(session(h).board.join(''),fixtureSolution,'ordinary AI Assist does not solve all');
 h.el('aiAssistAll').click();
 assert.equal(h.el('navModal').hidden,false,'Solve all asks for confirmation');
 assert.deepEqual(session(h).board,one.board,'opening Solve all does not mutate the board');
 h.el('aiAssistCancelAll').click();assert.deepEqual(session(h).board,one.board,'cancellation leaves the game intact');
 h.el('aiAssistAll').click();h.el('aiAssistConfirmAll').click();
 await until(()=>session(h).board.join('')===fixtureSolution,'explicit Solve all completes the puzzle',15000);
 assert.equal(h.el('plCompletion').hidden,false,'completion UI appears on the solved board');
 w.undoMove();assert.deepEqual(session(h).board,one.board,'one Undo restores the pre-solve grid');
 assert.ok(session(h).completion,'completion remains in the historical record');
 assert.equal(h.el('plCompletion').hidden,true,'completion UI follows the current unsolved board');
 assert.doesNotMatch(assist(h),/^Solved using the certified answer/,'assistant no longer describes the undone board as solved');
 w.redoMove();assert.equal(session(h).board.join(''),fixtureSolution,'Redo restores the explicit solution');
 assert.equal(h.el('plCompletion').hidden,false,'completion UI returns with the solved board');
 w.undoMove();assert(await p.flush(),'undone board and completion history save together');
 const again=await ready(t,h.store());
 await until(()=>again.w.SudokuNavigator.state()&&session(again).board.join('')===one.board.join(''),'undone board recovered');
 assert.ok(session(again).completion,'saved completion history remains monotone');
 assert.equal(again.el('plCompletion').hidden,true,'reload does not present a historical completion as the current board');
 assert.deepEqual(h.errors,[]);
 assert.deepEqual(again.errors,[]);
});

test('AI Assist: the captured Easy board identifies eleven wrong entries and reversibly clears only editable values',async t=>{
 const h=await ready(t),w=h.w;
 const givens='302670058000200640070000010000080320803500476000367890008000560030926704064050030';
 const shown='302671058581293647076845913617489325893512476240367891728134569135926784964758132';
 const s=savedFixture('0.2.0');
 s.gameId='captured-easy-board';s.puzzle=[...givens].map(Number);s.board=[...shown].map(Number);s.lineage=null;
 const cert=w.SudokuNavigator.core.exact(s.puzzle,100000);
 assert.equal(cert.status,'UNIQUE');assert.equal(w.SudokuNavigator.core.exact(s.board,100000).status,'UNSAT');
 assert.equal(await w.SudokuNavigator.restore(s),true);w.stopTimer();
 const initial=session(h),wrong=initial.board.map((v,i)=>v&&v!==cert.solution[i]?i:-1).filter(i=>i>=0);
 assert.equal(wrong.length,11,'the captured board has eleven incorrect player entries');
 givensStay(initial.puzzle,initial.board);
 h.el('plHint').click();
 assert.equal(h.el('aiAssistPanel').hidden,false);
 assert.match(assist(h),/11/);
 assert.equal([...h.el('grid').children].filter(c=>c.classList.contains('ai-correction')).length,11);
 h.el('plWhy').click();assert.match(assist(h),/certified unique solution|verified|preverjen/i);
 h.el('plDemo').click();assert.equal(h.el('aiAssistRemove').hidden,false);
 assert.deepEqual(session(h).board,initial.board,'the three help actions never edit the captured game');
 h.el('aiAssistRemove').click();
 const repaired=session(h);
 assert.equal(repaired.board.filter((v,i)=>v&&v!==cert.solution[i]).length,0);
 assert.equal(repaired.history.length-initial.history.length,11,'each correction has its own Undo step');
 for(const i of wrong)assert.equal(repaired.board[i],0,`wrong entry ${i} was removed`);
 givensStay(initial.puzzle,repaired.board);
 for(let i=0;i<wrong.length;i++)w.undoMove();
 assert.deepEqual(session(h).board,initial.board,'Undo restores the exact captured board');
 for(let i=0;i<wrong.length;i++)w.redoMove();
 assert.deepEqual(session(h).board,repaired.board,'Redo restores the corrected board');
 assert.deepEqual(h.errors,[]);
});
