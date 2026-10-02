'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const read=p=>fs.readFileSync(p,'utf8'),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
test('one active LAB source exposes desktop LAB and APP presentation selector',()=>{
 const index=read('public/S/new/index.html'),app=read('public/S/new/app.html');
 assert.match(index,/href="\.\/\?view=app"/);assert.doesNotMatch(index,/href="\.\.\/app\//);
 assert.match(index,/id="sudokuGame"/);assert.match(index,/data-sudoku-shell/);
 assert.match(app,/id="sudoku-unified-bootstrap"/);assert.match(app,/id="sudoku-app-ui"/);assert.match(app,/id="sudoku-app-solve-playback"/);
 assert.match(app,/ai8SudokuNavigatorV020/);
});
test('legacy APP root is recovery only while immutable old/003 preserves previous game',()=>{
 const retired=read('public/S/app/index.html'),direct=read('public/S/app/app.html');
 assert.equal(retired,direct);assert.match(retired,/\.\.\/new\/\?view=app/);assert.doesNotMatch(retired,/navigator-core|SudokuNavigator=/);
 assert.equal(hash('public/S/app/old/003/app.html'),'9228617baa550c9fe2a97b3c2d477c1a5d44a00759d7327ecb519a7b9a37fc6a');
 assert.equal(JSON.parse(read('public/S/app/old/003/release.json')).release_id,'01b24c21dbd0bb3f69e50f357a6194b1b9cc3e45dbd9eb048816defef077b384');
});
test('CURRENT and PREVIOUS canonical game bytes remain untouched',()=>{
 assert.equal(hash('public/S/current/index.html'),'e5af3f7345fd506ec3d59a811fc482ae19204334809171b595a4898618c6c3ba');
 assert.equal(hash('public/S/old/index.html'),'e93f9cb15d1eea21818cd46a40c0a9fc5c4a1ffa3ed28936ac1e95f904b1fb7e');
});
test('mobile presentation sources retain Coach review and sensor guide',()=>{
 const ui=read('public/S/new/presentation/app-ui.js'),review=read('public/S/new/presentation/app-solve-playback.js');
 for(const s of ['appCoach','appNumberPad','appHoldTip','appDock'])assert.match(ui,new RegExp(s));
 for(const s of ['Cplx','Gini','Powr','Dens','ADSR','appSolveSensorsOverview'])assert.match(review,new RegExp(s));
 assert.match(ui,/8zSudoku\.ui\.coach/);assert.doesNotMatch(ui,/8zSudoku\.app\.ui\./);
});
