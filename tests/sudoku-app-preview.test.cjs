'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {boot,savedFixture,plain,until}=require('./sudoku-ui-harness.cjs');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const state=h=>plain(h.w.SudokuNavigator.export().session);

test('APP preview uses one compact desktop/tablet header and width selector',()=>{
 const html=read('public/S/app/index.html');
 const nav=[...html.matchAll(/<a href="(\.\.\/|\.\.\/old\/|\.\.\/new\/|\.\/)"[^>]*>(CURRENT|PREVIOUS|LAB|APP)<\/a>/g)].map(m=>m[2]);
 assert.deepEqual(nav,['CURRENT','PREVIOUS','LAB','APP']);
 assert.match(html,/<h1 class="preview-title">8zSudoku · APP preview<\/h1>/);
 assert.match(html,/<select id="previewWidth"[^>]*>[\s\S]*?<option value="375">375<\/option>[\s\S]*?<option value="390" selected>390<\/option>[\s\S]*?<option value="402">402<\/option>[\s\S]*?<option value="430">430<\/option>[\s\S]*?<\/select>/);
 assert.doesNotMatch(html,/data-width=|Open without frame|toggleFrame|Install app \/ Offline|iPhone preview — the same mobile game surface as the APP edition\./);
 assert.match(html,/game\.src='\.\/app\.html'\+location\.hash/);
 assert.match(html,/location\.replace\('\.\/app\.html'\+location\.hash\)/);
 assert.match(html,/html\[data-app-shell=preview\] main\{flex:1;width:100%;min-height:100svh;display:grid;grid-template-rows:auto 1fr/);
 assert.match(html,/padding:38px 16px 24px/);
 assert.match(html,/<div class="preview-stage"><div class="device"/);
 assert.match(html,/html\[data-app-shell=preview\] \.preview-stage\{display:flex;align-items:center;justify-content:center/);
 assert.match(html,/html\[data-app-shell=phone\] \.preview-header/);
 assert.match(html,/html\[data-app-shell=phone\] \.preview-stage\{width:100%;height:100%\}/);
 assert.match(html,/document\.documentElement\.dataset\.appShell=phone\?'phone':'preview'/);
 assert.match(html,/syncFramedPreview/);
 assert.doesNotMatch(html,/Play and Learn use one game\. APP storage is separate from LAB and CURRENT\./);
});

test('APP framed preview lowers only the simulated phone game block',()=>{
 const css=read('public/S/app/app.css');
 assert.match(css,/\[data-app-framed-preview=true\] \.title-block/);
 assert.match(css,/\[data-app-framed-preview=true\] \.pl-tabs/);
 assert.match(css,/\[data-app-framed-preview=true\] \.main\{transform:translateY\(24px\)\}/);
});

test('APP phone layout centers 6–9, uses 3+3 Play actions and removes the end slogan',()=>{
 const css=read('public/S/app/app.css'),app=read('public/S/app/app.html');
 assert.match(css,/\.numpad\{grid-template-columns:repeat\(10,minmax\(0,1fr\)\)/);
 assert.match(css,/\.numpad button:nth-child\(6\)\{grid-column:2\/span 2\}/);
 assert.match(css,/data-view=play.*data-assist=closed.*\.ux-toolbar\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/#solveBtn\{order:4\}/);assert.match(css,/#uxNew\{order:5\}/);assert.match(css,/#uxMore\{order:6\}/);
 assert.equal(app.includes('<div style="text-align:center;padding:2rem 5vw 0.5rem;font-family:\'Cormorant Garamond\',serif;font-size:1.2rem;font-style:italic;color:rgba(226,232,244,0.35);letter-spacing:.03em">Less describes more.</div>'),false);
});

test('APP numpad is visually separated from the board with gunmetal and silver controls',()=>{
 const css=read('public/S/app/app.css');
 assert.match(css,/\.mobile-input-panel\{[\s\S]*background:linear-gradient\(180deg,#151e2a 0%,#101721 100%\)/);
 assert.match(css,/\.numpad button:not\(\.pl-armed\)\{[\s\S]*background:#1b2735;[\s\S]*color:#c8d0da/);
 assert.match(css,/\.numpad button:not\(\.pl-armed\):active\{[\s\S]*border-color:#28dff2/);
});

test('APP defaults to Coach with number pad hidden and a visible hold-tip row',()=>{
 const css=read('public/S/app/app.css'),ui=read('public/S/app/app-ui.js');
 assert.ok(ui.includes("numberPad:{key:'8zSudoku.app.ui.numberPad'"));
 assert.ok(ui.includes("def:'off'"));
 assert.ok(ui.includes("coach:{key:'8zSudoku.app.ui.coach'"));
 assert.ok(ui.includes("def:'easy'"));
 assert.ok(ui.includes("holdTip:{key:'8zSudoku.app.ui.holdTip'"));
 assert.ok(ui.includes("Tap & hold a cell to get the number popup."));
 assert.ok(ui.includes("Sudoku Coach"));
 assert.ok(css.includes('#appCoach'));
 assert.ok(css.includes('#appHoldTip'));
});

test('APP dock and spacing keep secondary actions out of the Play surface',()=>{
 const css=read('public/S/app/app.css'),ui=read('public/S/app/app-ui.js');
 for(const id of ['appNotes','appErase','appUndo','appAssist','appMore'])assert.ok(ui.includes(id),id);
 assert.ok(css.includes('grid-template-columns:repeat(5,minmax(0,1fr))'));
 assert.ok(css.includes('margin:12px 0 18px'));
 assert.ok(css.includes('.pl-notice{display:none!important}'));
 for(const id of ['appMoreNew','appMoreNews','appMoreTutorial'])assert.ok(ui.includes(id),id);
});

test('APP iPhone polish scales controls, decorates More and follows touch with the loupe',()=>{
 const css=read('public/S/app/app.css'),ui=read('public/S/app/app-ui.js');
 assert.ok(css.includes('--app-text-scale'));
 assert.ok(css.includes('#navModal.app-more-modal .app-menu-icon'));
 assert.ok(css.includes('#aiAssistPanel .assist-actions .btn'));
 assert.ok(ui.includes("8zSudoku.app.ui.textSize"));
 assert.ok(ui.includes('appTextSizeSetting'));
 assert.ok(ui.includes('decorateMore'));
 assert.ok(ui.includes('placeLoupe'));
 assert.ok(ui.includes("document.addEventListener('touchmove'"));
 assert.ok(ui.includes("document.addEventListener('pointermove'"));
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
 assert.equal(h.el('plNumbers').hidden,true,'number pad is hidden by default');
 assert.equal(h.el('appCoach').hidden,false,'Easy opens contextual Coach by default');
 assert.equal(h.el('appHoldTip').hidden,false,'tap-and-hold tip is visible by default');
 assert.match(h.el('appHoldTip').textContent,/Tap & hold/);
 assert.equal(h.el('aiAssistPanel').hidden,true);
 assert.deepEqual([...h.el('appDock').querySelectorAll('button')].map(n=>n.id),['appNotes','appErase','appUndo','appAssist','appMore']);
 assert.equal(h.el('appAssist').hidden,false);
 h.el('solveBtn').click();
 await until(()=>!h.el('aiAssistPanel').hidden&&w.document.body.dataset.appPanel==='assist','AI Solve opens guided APP sheet');
 assert.equal(h.el('uxDemoGrid'),null,'no legacy demonstration replaces the game');
 assert.deepEqual(state(h).board,before.board);
 h.el('appAssist').click();assert.equal(w.document.body.dataset.appPanel,'board');
 w.SudokuNavigator.product.switchView('learn');
 await until(()=>!h.el('aiAssistPanel').hidden&&!h.el('appAssist').hidden,'Learn keeps Assist available');
 h.el('appAssist').click();assert.equal(w.document.body.dataset.appPanel,'assist');
 h.el('aiAssistClose').click();assert.equal(w.document.body.dataset.appPanel,'board','Learn Close returns to grid');
 h.el('uxHint').click();await until(()=>w.document.body.dataset.appPanel==='assist','mobile Hint opens guided sheet');
 assert.deepEqual(state(h).board,before.board);
 assert.deepEqual(h.errors,[]);
});

test('APP settings preferences can restore the classic number pad and hide the hold tip',async t=>{
 const stored={'8zSudoku.app.ui.numberPad':'on','8zSudoku.app.ui.holdTip':'off'};
 const h=await boot(t,stored,{width:390,height:844},{lane:'APP'}),w=h.w;
 await w.SudokuNavigator.restore(savedFixture('0.2.0'));w.stopTimer();
 assert.equal(h.el('plNumbers').hidden,false);
 assert.equal(h.el('appCoach').hidden,true);
 assert.equal(h.el('appHoldTip').hidden,true);
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
