'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {boot,savedFixture,plain,until}=require('./sudoku-ui-harness.cjs');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const state=h=>plain(h.w.SudokuNavigator.export().session);

test('APP preview offers the four widths, frameless view and ordered channel navigation',()=>{
 const html=read('public/S/app/index.html');
 const nav=[...html.matchAll(/<a href="(\.\.\/|\.\.\/old\/|\.\.\/new\/|\.\/)"[^>]*>(CURRENT|PREVIOUS|LAB|APP)<\/a>/g)].map(m=>m[2]);
 assert.deepEqual(nav,['CURRENT','PREVIOUS','LAB','APP']);
 assert.deepEqual([...html.matchAll(/data-width="(\d+)"/g)].map(m=>m[1]),['375','390','402','430']);
 assert.match(html,/Open without frame/);
 assert.match(html,/game\.src='\.\/app\.html'\+location\.hash/);
 assert.match(html,/location\.replace\('\.\/app\.html'\+location\.hash\)/);
});

test('APP build pins exact packaged LAB donor and isolates its stored games',()=>{
 const check=spawnSync(process.execPath,['scripts/build-sudoku-app-preview.cjs','--check'],{cwd:root,encoding:'utf8'});
 assert.equal(check.status,0,check.stderr||check.stdout);
 const meta=JSON.parse(read('public/S/app/release.json'));
 const donor=read('public/S/new/app.html'),lab=JSON.parse(read('public/S/new/release.json'));
 const app=read('public/S/app/app.html');
 assert.equal(meta.lab_release_id,lab.release_id);
 assert.equal(meta.lab_app_sha256,sha(donor));
 assert.equal(meta.app_html_sha256,sha(app));
 assert.match(app,/NS='ai8SudokuAppV030'/);
 assert.doesNotMatch(app,/ai8SudokuNavigatorV020\.(session|library|trace|stats)/);
 assert.match(app,/const KEY='8zSudoku\.app\.ui\.language'/);
 assert.match(app,/id="sudoku-app-style"/);
 assert.match(app,/id="sudoku-app-ui"/);
 assert.doesNotMatch(app,/<script src=|<link rel="stylesheet"/);
});

test('APP phone Play stays simple; AI Solve and Learn use the guided sheet without changing the board',async t=>{
 const h=await boot(t,{}, {width:390,height:844},{lane:'APP'}),w=h.w;
 await w.SudokuNavigator.restore(savedFixture('0.2.0'));w.stopTimer();
 const before=state(h);
 assert.equal(w.document.body.dataset.appSurface,'true');
 assert.equal(h.el('numpad').closest('.mobile-input-panel').parentElement.className,'col-center');
 assert.equal(h.el('aiAssistPanel').hidden,true);
 assert.equal(h.el('appDock').querySelector('#appAssist').hidden,true);
 h.el('solveBtn').click();
 await until(()=>!h.el('aiAssistPanel').hidden&&w.document.body.dataset.appPanel==='assist','AI Solve opens guided APP sheet');
 assert.equal(h.el('uxDemoGrid'),null,'no legacy demonstration replaces the game');
 assert.deepEqual(state(h).board,before.board);
 h.el('appBoard').click();assert.equal(w.document.body.dataset.appPanel,'board');
 w.SudokuNavigator.product.switchView('learn');
 await until(()=>!h.el('aiAssistPanel').hidden&&!h.el('appAssist').hidden,'Learn keeps Assist available');
 h.el('appAssist').click();assert.equal(w.document.body.dataset.appPanel,'assist');
 h.el('aiAssistClose').click();assert.equal(w.document.body.dataset.appPanel,'board','Learn Close returns to grid');
 h.el('uxHint').click();await until(()=>w.document.body.dataset.appPanel==='assist','mobile Hint opens guided sheet');
 assert.deepEqual(state(h).board,before.board);
 assert.deepEqual(h.errors,[]);
});

test('APP assisted placement stays one reversible move and writes only APP storage',async t=>{
 const h=await boot(t,{}, {width:402,height:844},{lane:'APP'}),w=h.w;
 await w.SudokuNavigator.restore(savedFixture('0.2.0'));w.stopTimer();
 w.SudokuNavigator.product.switchView('learn');
 const before=state(h),count=b=>b.board.filter(Boolean).length;
 h.el('appAssist').click();h.el('aiAssistNext').click();h.el('aiAssistReveal').click();h.el('aiAssistApply').click();
 await until(()=>count(state(h))===count(before)+1,'one APP assisted digit');
 const after=state(h);assert.equal(after.board.filter((v,i)=>v!==before.board[i]).length,1);
 w.undoMove();assert.deepEqual(state(h).board,before.board);
 w.redoMove();assert.deepEqual(state(h).board,after.board);
 assert.equal(await w.SudokuNavigator.product.flush(),true);
 const stored=h.store();assert.ok(stored['ai8SudokuAppV030.session']);
 assert.equal(stored['ai8SudokuNavigatorV020.session'],undefined);
 assert.deepEqual(h.errors,[]);
});

test('APP delete clears its own game and language but leaves LAB preferences intact',async t=>{
 const h=await boot(t,{'8zSudoku.ui.language':'en'},{width:390,height:844},{lane:'APP'});
 await h.w.SudokuNavigator.restore(savedFixture('0.2.0'));h.w.stopTimer();
 h.w.SudokuI18n.set('sl');
 assert.equal(h.w.localStorage.getItem('8zSudoku.app.ui.language'),'sl');
 h.w.SudokuNavigator.product.deleteEverything();
 assert.equal(h.w.localStorage.getItem('8zSudoku.app.ui.language'),null);
 assert.equal(h.w.localStorage.getItem('8zSudoku.ui.language'),'en');
 assert.equal(h.w.localStorage.getItem('ai8SudokuAppV030.session'),null);
 assert.deepEqual(h.errors,[]);
});
