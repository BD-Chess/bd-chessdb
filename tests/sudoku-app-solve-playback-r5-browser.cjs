'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const out=process.env.SUDOKU_EVIDENCE_DIR||'sudoku-r5-evidence';fs.mkdirSync(out,{recursive:true});
const root=path.resolve('public');let server;
const puzzle=[...'530070000600195000098000060800060003400803001700020006060000280000419005000080079'].map(Number);
function fixture(id,diff){const board=puzzle.slice();board[2]=1;const notes=Array.from({length:81},()=>[]);notes[3]=[2,6];notes[5]=[1,4,8];return{schema:'AI8_SUDOKU_NAV_SESSION_V1',version:'0.2.0',gameId:id,diff,puzzle,board,notes,time:12,rows:[],assistance:[],history:[],selectedCell:3,notesMode:true,timerRunning:false,lineage:{base:board,ops:[]},settings:{policy:'REAL',goal:'FLOW',target:1,deep:false}};}
const report={cases:[],errors:[]};
async function run(){
 let base=process.env.SUDOKU_LIVE_URL;
 if(!base){server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let p=path.resolve(root,'.'+pathname);if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(pathname.endsWith('/'))p=path.join(p,'index.html');fs.readFile(p,(err,b)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',p.endsWith('.html')?'text/html':p.endsWith('.js')?'text/javascript':p.endsWith('.json')?'application/json':p.endsWith('.png')?'image/png':'text/plain');res.end(b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port+'/S/new/?view=app';}
 for(const [engine,name]of [[chromium,'chromium'],[webkit,'webkit']]){
  const browser=await engine.launch();try{for(const mode of ['phone','framed']){
   const phone=mode==='phone',reduced=name==='webkit'&&phone;
   const context=await browser.newContext({viewport:phone?{width:402,height:734}:{width:1440,height:1200},isMobile:phone,hasTouch:phone,serviceWorkers:'block',reducedMotion:reduced?'reduce':'no-preference',...(phone?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{})});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   let frame;
   const ready=async()=>{const handle=await page.locator('#sudokuGame').elementHandle();frame=await handle.contentFrame();await frame.waitForURL(/app\.html/,{waitUntil:'load',timeout:15000});await frame.waitForFunction(()=>window.SudokuNavigator?.product&&document.querySelector('#appSolveReview')&&!window.SudokuNavigator.ui.blocked(),null,{timeout:15000});};
   const capture=()=>frame.evaluate(()=>window.SudokuNavigator.product.capture());
   const begin=async()=>{await frame.locator('#appAssist').click();await frame.locator('#aiAssistAll').click();const before=await capture();await frame.locator('#aiAssistConfirmAll').click();await frame.waitForFunction(()=>document.body.dataset.appSolveReview==='true',null,{timeout:5000});return before;};
   const visible=()=>frame.locator('#grid .cell').evaluateAll(nodes=>{const review=document.body.dataset.appSolveReview==='true';return nodes.map(n=>review?Number(n.dataset.reviewValue||0):(/^[1-9]$/.test(n.textContent.trim())?Number(n.textContent.trim()):0));});
   const checkBefore=async before=>{assert.deepEqual(await capture(),before);assert.equal(await frame.locator('#notesBtn').evaluate(n=>n.classList.contains('active')),true);};
   const add=(scenario,extra={})=>report.cases.push({name,mode,scenario,reducedMotion:reduced,...extra});
   try{
    await page.goto(base,{waitUntil:'load',timeout:30000});await ready();
    if(!phone){assert.equal(await page.locator('#previewWidth').inputValue(),'402','desktop APP preview defaults to iPhone 16 Pro width');assert.equal(await page.locator('#device').evaluate(n=>getComputedStyle(n).getPropertyValue('--device-width').trim()),'402px');}
    const initial=fixture('solve-r5-'+name+'-'+mode,phone?'hard':'evil');
    await frame.evaluate(s=>window.SudokuNavigator.restore(s),initial);await frame.waitForFunction(()=>!window.SudokuNavigator.ui.blocked());
    await frame.locator('[data-sudoku-language="'+(phone?'sl':'en')+'"]').click();
    const notesWasOn=await frame.locator('#appNotes').getAttribute('aria-pressed')==='true';if(notesWasOn)await frame.locator('#appNotes').click();
    await frame.evaluate(()=>{if(window.SudokuNavigator.product.capture().selectedCell!==3)document.querySelector('.cell[data-index="3"]').click();if(typeof window.placeNumber!=='function')throw Error('placeNumber unavailable');window.placeNumber(6,'key',true);});await frame.waitForFunction(()=>window.SudokuNavigator.product.capture().board[3]===6,null,{timeout:3000});
    if(notesWasOn)await frame.locator('#appNotes').click();await frame.waitForFunction(()=>window.SudokuSolveReview?.hasHumanReview?.(),null,{timeout:3000});
    const humanEvidence=await frame.evaluate(()=>window.SudokuNavigator.product.reviewRows());assert.ok(humanEvidence.some(x=>Array.isArray(x.pre_board)&&x.pre_board.length===81),'APP human review preserves exact pre-move board');
    const initialPosition=await capture(),seq=await frame.evaluate(()=>window.SudokuNavigator.product.historyData().transactionSeq);
    // Existing AI Assist selects a suggested/problem cell without changing any
    // entries. Pin the precise pre-solve position AFTER opening that panel.
    await frame.locator('#appAssist').click();await frame.locator('#aiAssistAll').click();const before=await capture();
    assert.deepEqual(before.board,initialPosition.board);assert.deepEqual(before.notes,initialPosition.notes);assert.deepEqual(before.lineage,initialPosition.lineage);
    await frame.locator('#aiAssistCancelAll').click();await checkBefore(before);await frame.locator('#aiAssistClose').click();
    const started=Date.now();await begin();
    assert.equal(await frame.locator('#aiAssistPanel').evaluate(n=>n.hidden),true);assert.equal(await frame.locator('#navModal').evaluate(n=>n.hidden),true);assert.equal(await frame.evaluate(()=>document.body.dataset.appPanel),'board');
    assert.equal(await frame.locator('.header').evaluate(n=>getComputedStyle(n).display),'none','top identity/time/language row hidden during review');assert.equal(await frame.locator('.title-block').evaluate(n=>getComputedStyle(n).display),'none','title hidden during review');assert.equal(await frame.locator('.pl-tabs').evaluate(n=>getComputedStyle(n).display),'none','Play/Learn/Lab tabs hidden during review');
    assert.equal(await frame.locator('#appSolveInstruments').evaluate(n=>n.hidden),false);assert.equal(await frame.locator('#appSolveInstruments .app-pos-sensor').count(),5,'five horizontal position sensors');
    assert.equal(await frame.locator('#appSolveSensorsOverviewOpen').count(),1,'sensor overview tap target');
    await frame.locator('#appSolveSensorsOverviewOpen').click();assert.equal(await frame.locator('#appSolveSensorsOverview').evaluate(n=>n.hidden),false,'full sensor guide opens');
    assert.equal(await frame.locator('#appSensorsOverviewList .app-sensors-overview-item').count(),5,'overview explains all five sensors');
    const sensorCover=await frame.locator('#appSolveSensorsOverview').evaluate(n=>{const r=n.getBoundingClientRect();return{top:r.top,left:r.left,width:r.width,height:r.height,vw:innerWidth,vh:innerHeight};});
    assert.ok(Math.abs(sensorCover.top)<1&&Math.abs(sensorCover.left)<1&&Math.abs(sensorCover.width-sensorCover.vw)<1&&Math.abs(sensorCover.height-sensorCover.vh)<1,'sensor overview covers viewport');
    assert.match(await frame.locator('#appSensorsOverviewCaveat').innerText(),phone?/ni ocena inteligence/i:/not.*intelligence/i);await frame.locator('#appSensorsOverviewClose').click();
    assert.equal(await frame.locator('#appSolvePlay').innerText(),'▶','reading guide pauses playback');await frame.locator('#appSolvePlay').click();
    assert.match(await frame.locator('#appAssist .app-dock-label').innerText(),phone?/AI pregled/:/AI Review/);
    const solved=await capture();assert.ok(solved.board.every(Boolean));assert.equal(solved.board[2],4,'wrong editable digit corrected');assert.equal(await frame.evaluate(()=>window.SudokuNavigator.product.historyData().transactionSeq),seq+1,'one existing atomic transaction');
    const reviewData=await frame.evaluate(()=>window.SudokuSolveReview.get());
    assert.ok(reviewData&&reviewData.steps.length>3,'logical review timeline created');
    assert.ok(reviewData.steps.some(x=>x.checked),'at least one independently checked proof step');
    assert.equal(reviewData.steps[0].technique,'answer_correction','wrong editable entry is explicitly corrected before proof solving');
    const logicalPlacements=reviewData.steps.filter(x=>x.checked&&x.kind==='placement').map(x=>x.cell);
    assert.ok(logicalPlacements.length>2,'multiple checked placements available for review');
    const samples=[];for(let i=0;i<5;i++){await page.waitForTimeout(130);const b=await visible();samples.push(b.filter(Boolean).length);for(let j=0;j<81;j++)if(puzzle[j])assert.equal(b[j],puzzle[j],'givens visible and unchanged');}
    assert.ok(samples.at(-1)>=before.board.filter(Boolean).length-1,'visible logical progress started');assert.ok(samples.at(-1)<81,'not an instant fill');assert.ok(new Set(samples).size>=2,'multiple visible review stages');
    await page.screenshot({path:path.join(out,name+'-'+mode+'-solve-mid.png'),fullPage:true});
    await frame.waitForFunction(()=>{const r=window.SudokuSolveReview?.get?.();return r&&r.index===r.steps.length&&document.querySelector('#appSolvePlay')?.textContent==='▶';},null,{timeout:8500});const elapsed=Date.now()-started;
    assert.ok(elapsed>=2200&&elapsed<9000,'fast watchable duration '+elapsed);assert.deepEqual(await visible(),solved.board);
    assert.equal(await frame.locator('#appSolveSensors .app-solve-sensor').count(),5,'compact step sensors visible');
    assert.equal(await frame.locator('#appDock>button').count(),5);assert.equal(await frame.locator('.title').innerText(),'8zSudoku');assert.equal(await frame.locator('#plNumbers').evaluate(n=>n.hidden),true);
    await frame.locator('#appSolveInstruments [data-sensor="cplx"]').click();assert.equal(await frame.locator('#appSolveSensorModal').evaluate(n=>n.hidden),false);assert.match(await frame.locator('#appSensorTitle').innerText(),/LZ/);await frame.locator('#appSensorClose').click();
    await page.keyboard.press('ArrowUp');assert.equal(Number(await frame.locator('#appSolveScrub').inputValue()),0,'ArrowUp -> first');
    await page.keyboard.press('ArrowRight');assert.equal(Number(await frame.locator('#appSolveScrub').inputValue()),1,'ArrowRight -> next');
    await page.keyboard.press('ArrowDown');const aiMax=Number(await frame.locator('#appSolveScrub').getAttribute('max'));assert.equal(Number(await frame.locator('#appSolveScrub').inputValue()),aiMax,'ArrowDown -> last');
    await page.keyboard.press('ArrowLeft');assert.equal(Number(await frame.locator('#appSolveScrub').inputValue()),aiMax-1,'ArrowLeft -> previous');
    await page.keyboard.press('ArrowUp');await page.keyboard.press('Space');assert.equal(await frame.locator('#appSolvePlay').innerText(),'❚❚','Space starts playback');await page.keyboard.press('Space');assert.equal(await frame.locator('#appSolvePlay').innerText(),'▶','Space pauses playback');
    await frame.locator('#appSolveLast').click();assert.deepEqual(await visible(),solved.board,'last review position is solved grid');
    await frame.locator('#appSolveTabHuman').click();assert.ok((await frame.locator('#appHumanReviewSummary').innerText()).length>0,'human review summary available');const humanMax=Number(await frame.locator('#appSolveScrub').getAttribute('max'));assert.ok(humanMax>=1,'human review has navigable recorded moves');await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowRight');assert.equal(Number(await frame.locator('#appSolveScrub').inputValue()),1,'human review uses same keyboard navigation');
    await frame.locator('#appSolveTabAI').click();
    add('logical-review-navigation',{elapsedMs:elapsed,samples,steps:reviewData.steps.length,fallbacks:reviewData.fallbacks,blankCells:initial.board.filter(v=>!v).length});
    await frame.locator('#appUndo').click();await checkBefore(before);await page.waitForTimeout(250);await checkBefore(before);assert.notEqual(await frame.locator('.header').evaluate(n=>getComputedStyle(n).display),'none','top row restored after Undo');assert.notEqual(await frame.locator('.title-block').evaluate(n=>getComputedStyle(n).display),'none','title restored after Undo');assert.notEqual(await frame.locator('.pl-tabs').evaluate(n=>getComputedStyle(n).display),'none','tabs restored after Undo');assert.match(await frame.locator('#appAssist .app-dock-label').innerText(),phone?/Pomoč AI/:/AI Assist/);
    await frame.evaluate(()=>window.SudokuNavigator.product.redo());assert.deepEqual(await capture(),solved);await frame.locator('#appUndo').click();await checkBefore(before);add('one-undo-and-redo');
    await begin();await page.waitForTimeout(430);assert.equal(await frame.evaluate(()=>document.body.dataset.appSolveReview==='true'),true);await frame.locator('#appUndo').click();await checkBefore(before);await page.waitForTimeout(500);await checkBefore(before);assert.equal(await frame.evaluate(()=>!!document.body.dataset.appSolveReview),false);add('undo-during-fill-no-stale-timer');
    // Learn -> Solve all must return to the unobscured Play board too.
    await frame.locator('[data-pl-view="learn"]').click();await begin();assert.equal(await frame.evaluate(()=>window.SudokuNavigator.product.view()),'play');
    const replacement=fixture('replacement-'+name+'-'+mode,'evil');replacement.board=puzzle.slice();replacement.lineage={base:replacement.board,ops:[]};
    await frame.evaluate(s=>window.SudokuNavigator.restore(s),replacement);await page.waitForTimeout(500);assert.deepEqual((await capture()).board,replacement.board);assert.equal(await frame.evaluate(()=>!!document.body.dataset.appSolveReview),false);add('replacement-and-learn-safe');
    const priorReload=await begin();
    // Deliberate keyboard interaction finishes only the cosmetic presentation.
    await page.keyboard.press('Tab');assert.equal(await frame.evaluate(()=>!!document.body.dataset.appSolveReview),false);
    assert.equal(await frame.evaluate(()=>window.SudokuNavigator.flushForUpdate()),true);
    await page.reload({waitUntil:'load'});await ready();assert.ok((await capture()).board.every(Boolean));await frame.locator('#appUndo').click();await checkBefore(priorReload);add('saved-position-undo-after-reload');
    assert.deepEqual(errors,[],'no browser page errors');
   }catch(e){report.diagnostics={name,mode,pageErrors:errors};await page.screenshot({path:path.join(out,name+'-'+mode+'-FAIL.png'),fullPage:true}).catch(()=>{});throw e;}finally{await context.close();}
  }}finally{await browser.close();}
 }
 assert.equal(report.cases.length,20);
}
run().then(()=>{report.status='PASS';console.log('SOLVE_REVIEW_PASS '+report.cases.length+' cases');}).catch(e=>{report.status='FAIL';report.errors.push(e.stack);console.error(e);process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(out,'solve-browser.json'),JSON.stringify(report,null,2)+'\n');server?.close();});
