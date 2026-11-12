'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const read=p=>fs.readFileSync(p,'utf8'),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
test('one active LAB source exposes desktop LAB and APP presentation selector',()=>{
 const index=read('public/S/new/index.html'),app=read('public/S/new/app.html');
 assert.match(index,/href="\.\/\?view=app"/);assert.doesNotMatch(index,/href="\.\.\/app\//);
 assert.match(index,/id="sudokuGame"/);assert.match(index,/data-sudoku-shell/);
 assert.match(index,/border:6px solid #010705/);assert.match(index,/border-radius:32px/);assert.match(index,/box-shadow:0 18px 60px #0009,0 0 0 1px #59735f/);assert.match(index,/position:static!important;inset:auto!important/);assert.match(index,/height:min\(874px,calc\(100dvh - 24px\)\)/);
 assert.match(app,/id="sudoku-unified-bootstrap"/);assert.match(app,/id="sudoku-app-ui"/);assert.match(app,/id="sudoku-app-solve-playback"/);
 assert.match(app,/ai8SudokuNavigatorV020/);
});
test('legacy APP root is recovery only and old/003 points to the moved archive',()=>{
 const retired=read('public/S/app/index.html'),direct=read('public/S/app/app.html');
 assert.equal(retired,direct);assert.match(retired,/\.\.\/new\/\?view=app/);assert.doesNotMatch(retired,/navigator-core|SudokuNavigator=/);
 // The 2026-10-13 archive migration removed the old game bytes from public/.
 const archive=read('public/S/app/old/003/index.html');
 assert.match(archive,/Arhiv je preseljen/);
 assert.match(archive,/public\/S\/app\/old\/003/);
 assert.match(archive,/https:\/\/drive\.google\.com\/drive\/folders\//);
 assert.equal(fs.existsSync('public/S/app/old/003/app.html'),false);
 assert.equal(fs.existsSync('public/S/app/old/003/release.json'),false);
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
