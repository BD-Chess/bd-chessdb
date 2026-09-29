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

test('APP phone layout centers 6–9 and removes the superseded Play action block and end slogan',()=>{
 const css=read('public/S/app/app.css'),app=read('public/S/app/app.html');
 assert.match(css,/\.numpad\{grid-template-columns:repeat\(10,minmax\(0,1fr\)\)/);
 assert.match(css,/\.numpad button:nth-child\(6\)\{grid-column:2\/span 2\}/);
 assert.match(css,/:not\(\[data-view=lab\]\) \.ux-toolbar\{display:none!important\}/);
 assert.equal(app.includes('<div style="text-align:center;padding:2rem 5vw 0.5rem;font-family:\'Cormorant Garamond\',serif;font-size:1.2rem;font-style:italic;color:rgba(226,232,244,0.35);letter-spacing:.03em">Less describes more.</div>'),false);
});

test('APP dock and spacing keep secondary actions out of the Play surface',()=>{
 const css=read('public/S/app/app.css'),ui=read('public/S/app/app-ui.js');
 for(const id of ['appNotes','appErase','appUndo','appAssist','appMore'])assert.ok(ui.includes(id),id);
 assert.ok(css.includes('grid-template-columns:repeat(5,minmax(0,1fr))'));
 assert.ok(css.includes('margin:12px 0 18px'));
 assert.ok(css.includes('.pl-notice{display:none!important}'));
 for(const id of ['appMoreNew','appMoreNews','appMoreTutorial'])assert.ok(ui.includes(id),id);
});

test('APP iPhone polish enlarges text, decorates More, persists text size and keeps secondary actions under More',async t=>{
 const css=read('public/S/app/app.css'),ui=read('public/S/app/app-ui.js');
 assert.match(css,/font:700 calc\(\.80rem \* var\(--app-text-scale\)\)/);
 assert.match(css,/#aiAssistHint.*#aiAssistWhy\{font-size:calc\(1\.08rem \* var\(--app-text-scale\)\)/);
 assert.match(css,/\.app-more-primary \.btn,[\s\S]*min-height:70px/);
 for(const id of ['appMoreNew','appMoreNews','appMoreTutorial','appTextSize'])assert.ok(ui.includes(id),id);
 const h=await boot(t,{}, {width:402,height:874},{lane:'APP'}),w=h.w;await w.SudokuNavigator.restore(savedFixture('0.2.0'));w.stopTimer();
 h.el('appMore').click();await until(()=>h.el('appMorePrimary')&&h.el('appTextSize'),'APP More enhanced');
 assert.equal(h.el('plNotice').hidden,false,'source notice may remain logically present while APP CSS hides it');
 assert.ok(w.document.querySelectorAll('.app-more-menu .app-more-icon').length>=10,'secondary More actions gain icons');
 const large=h.el('appTextSize').querySelector('[data-app-text-size="large"]');large.click();
 assert.equal(w.document.body.dataset.appTextSize,'large');assert.equal(w.localStorage.getItem('ai8SudokuAppV030.appTextSize'),'large');assert.equal(large.getAttribute('aria-pressed'),'true');
 h.el('navClose').click();h.el('appMore').click();await until(()=>h.el('appTextSize'),'More reopens');assert.equal(h.el('appTextSize').querySelector('[data-app-text-size="large"]').getAttribute('aria-pressed'),'true');
 assert.deepEqual(h.errors,[]);
});

test('APP touch loupe follows the finger while desktop loupe semantics remain read-only',async t=>{
 const h=await boot(t,{}, {width:402,height:874},{lane:'APP'}),w=h.w;await w.SudokuNavigator.restore(savedFixture('0.2.0'));w.stopTimer();
 const G=w.SudokuMobileGeometry;[...h.el('grid').children].forEach((c,i)=>c.getBoundingClientRect=()=>G.rect(21+i%9*40,100+Math.floor(i/9)*40,39,39));h.el('gridWrap').getBoundingClientRect=()=>G.rect(16,95,369,369);
 const point=i=>({x:41+i%9*40,y:120+Math.floor(i/9)*40}),target=h.el('grid').children[0];
 const touch=(type,p)=>{const e=new w.Event(type,{bubbles:true,cancelable:true}),a={identifier:17,clientX:p.x,clientY:p.y,target};Object.defineProperties(e,{touches:{value:type==='touchend'?[]:[a]},changedTouches:{value:[a]}});target.dispatchEvent(e);return e;};
 const before=state(h).board;touch('touchstart',point(0));await until(()=>h.el('uxLoupe'),'touch loupe opens',1200);const first=h.el('uxLoupe').getAttribute('style');
 const moved=touch('touchmove',point(40));assert.equal(moved.defaultPrevented,true);assert.equal(h.el('uxLoupe').dataset.cell,'40');assert.notEqual(h.el('uxLoupe').getAttribute('style'),first,'touch loupe follows the finger');
 touch('touchend',point(40));assert.equal(h.el('uxLoupe'),null);assert.deepEqual(state(h).board,before);assert.deepEqual(h.errors,[]);
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
 assert.equal(h.w.localStorage.getItem('ai8SudokuAppV030.appTextSize'),null);
 assert.deepEqual(h.errors,[]);
});
