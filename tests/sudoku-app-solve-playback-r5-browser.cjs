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
 if(!base){server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let p=path.resolve(root,'.'+pathname);if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(pathname.endsWith('/'))p=path.join(p,'index.html');fs.readFile(p,(err,b)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',p.endsWith('.html')?'text/html':p.endsWith('.js')?'text/javascript':p.endsWith('.json')?'application/json':p.endsWith('.png')?'image/png':'text/plain');res.end(b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port+'/S/app/';}
 for(const [engine,name]of [[chromium,'chromium'],[webkit,'webkit']]){
  const browser=await engine.launch();try{for(const mode of ['phone','framed']){
   const phone=mode==='phone',reduced=name==='webkit'&&phone;
   const context=await browser.newContext({viewport:phone?{width:402,height:734}:{width:1440,height:1200},isMobile:phone,hasTouch:phone,serviceWorkers:'block',reducedMotion:reduced?'reduce':'no-preference',...(phone?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{})});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   let frame;
   const ready=async()=>{const handle=await page.locator('#game').elementHandle();frame=await handle.contentFrame();await frame.waitForURL(/app\.html/,{waitUntil:'load',timeout:15000});await frame.waitForFunction(()=>window.SudokuNavigator?.product&&document.querySelector('#appSolveProgress')&&!window.SudokuNavigator.ui.blocked(),null,{timeout:15000});};
   const capture=()=>frame.evaluate(()=>window.SudokuNavigator.product.capture());
   const begin=async()=>{await frame.locator('#appAssist').click();await frame.locator('#aiAssistAll').click();await frame.locator('#aiAssistConfirmAll').click();await frame.waitForFunction(()=>document.body.dataset.appSolvePlayback==='true',null,{timeout:3000});};
   const visible=()=>frame.locator('#grid .cell').evaluateAll(nodes=>nodes.map(n=>/^[1-9]$/.test(n.textContent.trim())?Number(n.textContent.trim()):0));
   const checkBefore=async before=>{assert.deepEqual(await capture(),before);assert.equal(await frame.locator('#notesBtn').evaluate(n=>n.classList.contains('active')),true);};
   const add=(scenario,extra={})=>report.cases.push({name,mode,scenario,reducedMotion:reduced,...extra});
   try{
    await page.goto(base,{waitUntil:'load',timeout:30000});await ready();
    const initial=fixture('solve-r5-'+name+'-'+mode,phone?'hard':'evil');
    await frame.evaluate(s=>window.SudokuNavigator.restore(s),initial);await frame.waitForFunction(()=>!window.SudokuNavigator.ui.blocked());
    await frame.locator('[data-sudoku-language="'+(phone?'sl':'en')+'"]').click();
    const before=await capture(),seq=await frame.evaluate(()=>window.SudokuNavigator.product.historyData().transactionSeq);
    // Cancelling confirmation must leave the entire position unchanged.
    await frame.locator('#appAssist').click();await frame.locator('#aiAssistAll').click();await frame.locator('#aiAssistCancelAll').click();await checkBefore(before);await frame.locator('#aiAssistClose').click();
    const started=Date.now();await begin();
    assert.equal(await frame.locator('#aiAssistPanel').evaluate(n=>n.hidden),true);assert.equal(await frame.locator('#navModal').evaluate(n=>n.hidden),true);assert.equal(await frame.evaluate(()=>document.body.dataset.appPanel),'board');
    const solved=await capture();assert.ok(solved.board.every(Boolean));assert.equal(solved.board[2],4,'wrong editable digit corrected');assert.equal(await frame.evaluate(()=>window.SudokuNavigator.product.historyData().transactionSeq),seq+1,'one existing atomic transaction');
    const samples=[];for(let i=0;i<5;i++){await page.waitForTimeout(130);const b=await visible();samples.push(b.filter(Boolean).length);for(let j=0;j<81;j++)if(puzzle[j])assert.equal(b[j],puzzle[j],'givens visible and unchanged');}
    assert.ok(samples.at(-1)>before.board.filter(Boolean).length,'visible progress started');assert.ok(samples.at(-1)<81,'not an instant fill');assert.ok(new Set(samples).size>=3,'multiple distinct visible stages');
    assert.ok(samples.every((n,i)=>!i||n>=samples[i-1]),'monotone visible fill');
    await page.screenshot({path:path.join(out,name+'-'+mode+'-solve-mid.png'),fullPage:true});
    await frame.waitForFunction(()=>!document.body.dataset.appSolvePlayback,null,{timeout:6500});const elapsed=Date.now()-started;
    assert.ok(elapsed>=2400&&elapsed<8000,'fast watchable duration '+elapsed);assert.deepEqual(await visible(),solved.board);
    assert.equal(await frame.locator('#appDock>button').count(),5);assert.equal(await frame.locator('.title').innerText(),'8zSudoku');assert.equal(await frame.locator('#plNumbers').evaluate(n=>n.hidden),true);
    add('visible-complete',{elapsedMs:elapsed,samples,blankCells:initial.board.filter(v=>!v).length});
    await frame.locator('#appUndo').click();await checkBefore(before);await page.waitForTimeout(250);await checkBefore(before);
    await frame.evaluate(()=>window.SudokuNavigator.product.redo());assert.deepEqual(await capture(),solved);await frame.locator('#appUndo').click();await checkBefore(before);add('one-undo-and-redo');
    await begin();await page.waitForTimeout(430);assert.ok(await frame.locator('.app-solve-pending').count()>0);await frame.locator('#appUndo').click();await checkBefore(before);await page.waitForTimeout(500);await checkBefore(before);assert.equal(await frame.locator('.app-solve-pending').count(),0);add('undo-during-fill-no-stale-timer');
    // Learn -> Solve all must return to the unobscured Play board too.
    await frame.locator('[data-pl-view="learn"]').click();await begin();assert.equal(await frame.evaluate(()=>window.SudokuNavigator.product.view()),'play');
    const replacement=fixture('replacement-'+name+'-'+mode,'evil');replacement.board=puzzle.slice();replacement.lineage={base:replacement.board,ops:[]};
    await frame.evaluate(s=>window.SudokuNavigator.restore(s),replacement);await page.waitForTimeout(500);assert.deepEqual((await capture()).board,replacement.board);assert.equal(await frame.locator('.app-solve-pending').count(),0);assert.equal(await frame.evaluate(()=>!!document.body.dataset.appSolvePlayback),false);add('replacement-and-learn-safe');
    const priorReload=await capture();await begin();
    // Deliberate keyboard interaction finishes only the cosmetic presentation.
    await page.keyboard.press('Tab');assert.equal(await frame.evaluate(()=>!!document.body.dataset.appSolvePlayback),false);
    assert.equal(await frame.evaluate(()=>window.SudokuNavigator.flushForUpdate()),true);
    await page.reload({waitUntil:'load'});await ready();assert.ok((await capture()).board.every(Boolean));await frame.locator('#appUndo').click();await checkBefore(priorReload);add('saved-position-undo-after-reload');
    assert.deepEqual(errors,[],'no browser page errors');
   }catch(e){report.diagnostics={name,mode,pageErrors:errors};await page.screenshot({path:path.join(out,name+'-'+mode+'-FAIL.png'),fullPage:true}).catch(()=>{});throw e;}finally{await context.close();}
  }}finally{await browser.close();}
 }
 assert.equal(report.cases.length,20);
}
run().then(()=>{report.status='PASS';console.log('SOLVE_PLAYBACK_PASS '+report.cases.length+' cases');}).catch(e=>{report.status='FAIL';report.errors.push(e.stack);console.error(e);process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(out,'solve-browser.json'),JSON.stringify(report,null,2)+'\n');server?.close();});
