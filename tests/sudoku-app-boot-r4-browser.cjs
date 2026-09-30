'use strict';
// Run with NODE_PATH pointing to pinned playwright. Optional external URL
// verifies deployed bytes; default serves the exact checkout on localhost.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const out=process.env.SUDOKU_EVIDENCE_DIR||'sudoku-r4-evidence';fs.mkdirSync(out,{recursive:true});
const root=path.resolve('public');
const fixture={schema:'AI8_SUDOKU_NAV_SESSION_V1',version:'0.2.0',gameId:'boot-r4-fixture',diff:'easy',puzzle:[...'530070000600195000098000060800060003400803001700020006060000280000419005000080079'].map(Number),notes:Array.from({length:81},()=>[]),time:0,rows:[],assistance:[],history:[],settings:{policy:'REAL',goal:'FLOW',target:1,deep:false}};fixture.board=fixture.puzzle;fixture.lineage={base:fixture.puzzle,ops:[]};
const report={cases:[],errors:[],navigation:[]};let server;
async function run(){
 let base=process.env.SUDOKU_LIVE_URL;
 if(!base){server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let p=path.resolve(root,'.'+pathname);if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(pathname.endsWith('/'))p=path.join(p,'index.html');fs.readFile(p,(err,b)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',p.endsWith('.html')?'text/html':p.endsWith('.js')?'text/javascript':p.endsWith('.json')?'application/json':p.endsWith('.png')?'image/png':'text/plain');res.end(b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port+'/S/app/';}
 for(const [engine,name]of [[chromium,'chromium'],[webkit,'webkit']]){
  const browser=await engine.launch();try{
   for(const mode of ['phone','framed']){
    const context=await browser.newContext({viewport:mode==='phone'?{width:402,height:734}:{width:1440,height:1200},isMobile:mode==='phone',hasTouch:mode==='phone',serviceWorkers:'block',...(mode==='phone'?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{})});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('framenavigated',f=>report.navigation.push({name,mode,url:f.url(),at:Date.now()}));
    try{
     await page.goto(base,{waitUntil:'load',timeout:30000});const frame=await (await page.locator('#game').elementHandle()).contentFrame();assert.ok(frame,'APP iframe exists');await frame.waitForURL(/app\.html/,{waitUntil:'load',timeout:12000});
     await frame.waitForFunction(()=>window.SudokuNavigator?.product&&document.querySelector('#appDock'),null,{timeout:12000});
     await page.waitForTimeout(700);
     for(const diff of ['easy','hard','evil']){
      await frame.evaluate(async s=>{await window.SudokuNavigator.restore(s);window.stopTimer();window.SudokuNavigator.product.switchView('play');},{...fixture,diff});
      await frame.waitForFunction(d=>document.body.dataset.appHardNoHelp===(d==='easy'?'false':'true'),diff);
      for(const lang of ['en','sl']){
       await frame.locator('[data-sudoku-language="'+lang+'"]').click();await frame.waitForFunction(l=>window.SudokuI18n.get()===l,lang);await page.waitForTimeout(180);
const retained=await frame.evaluate(()=>window.SudokuNavigator.export().session);assert.equal(retained.gameId,fixture.gameId);assert.equal(retained.diff,diff);assert.deepEqual(retained.board,fixture.board);
       const state=await frame.evaluate(()=>{const vis=e=>!!e&&getComputedStyle(e).display!=='none'&&!e.hidden;const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{top:r.top,bottom:r.bottom,height:r.height,width:r.width};};return{title:document.querySelector('.title').textContent.trim(),tabs:document.querySelectorAll('[data-pl-view]').length,buttons:[...document.querySelectorAll('#appDock>button')].filter(vis).length,pad:vis(document.querySelector('#plNumbers')),coach:vis(document.querySelector('#appCoach')),tip:vis(document.querySelector('#appHoldTip')),board:rect('.grid-wrap'),tabsRect:rect('.pl-tabs'),dock:rect('#appDock')};});
       assert.equal(state.title,'8zSudoku');assert.equal(state.tabs,3);assert.equal(state.buttons,5);assert.equal(state.pad,false);assert.equal(state.coach,diff==='easy');assert.equal(state.tip,diff==='easy');
       if(diff!=='easy'){const error=Math.abs((state.board.top+state.board.bottom)/2-(state.tabsRect.bottom+state.dock.top)/2);assert.ok(error<=12,'board centering '+mode+' '+name+' '+error);assert.ok(state.board.bottom<state.dock.top);state.centerError=error;}
       report.cases.push({name,mode,diff,lang,...state});
       if(diff==='hard'&&lang==='sl')await page.screenshot({path:path.join(out,name+'-'+mode+'-hard-sl.png'),fullPage:true});
      }
     }
     const before=await frame.evaluate(()=>JSON.stringify(window.SudokuNavigator.export().session.board));
     await frame.locator('#appAssist').click();await frame.waitForFunction(()=>!document.querySelector('#aiAssistPanel').hidden&&document.body.dataset.appPanel==='assist');
     assert.equal(await frame.evaluate(()=>JSON.stringify(window.SudokuNavigator.export().session.board)),before,'opening AI Assist does not change board');
     await frame.locator('#aiAssistClose').click();
     await frame.evaluate(()=>window.SudokuI18n.set('en'));await frame.locator('#appMore').click();await frame.locator('#navModalBody [data-menu="Settings"]').click();
     await frame.locator('#appNumberPad').selectOption('on');assert.equal(await frame.locator('#plNumbers').evaluate(e=>e.hidden),false);await frame.locator('#appNumberPad').selectOption('off');assert.equal(await frame.locator('#plNumbers').evaluate(e=>e.hidden),true);await frame.locator('#navClose').click();
     
// Real pointer hold + slide must still work with the numpad hidden.
const cell=await frame.locator('#grid .cell').nth(2).boundingBox();
await page.mouse.move(cell.x+cell.width/2,cell.y+cell.height/2);await page.mouse.down();
await frame.locator('#uxPicker').waitFor({state:'visible',timeout:5000});
const digit=await frame.locator('#uxPicker [data-digit="4"]').boundingBox();
await page.mouse.move(digit.x+digit.width/2,digit.y+digit.height/2,{steps:5});await page.mouse.up();
await frame.waitForFunction(()=>window.SudokuNavigator.export().session.board[2]===4);
await frame.locator('#appUndo').click();assert.equal(await frame.evaluate(()=>JSON.stringify(window.SudokuNavigator.export().session.board)),before,'picker Undo restores board');
// Resize without a new page, lost game, or leaving the APP shell.
for(const size of mode==='phone'?[{width:375,height:667},{width:402,height:874}]:[{width:3840,height:2160},{width:1024,height:900}]){
 await page.setViewportSize(size);await page.waitForTimeout(150);
 const geometry=await frame.evaluate(()=>{const r=s=>document.querySelector(s).getBoundingClientRect();const b=r('.grid-wrap'),t=r('.pl-tabs'),d=r('#appDock');return{error:Math.abs((b.top+b.bottom-t.bottom-d.top)/2),bottom:b.bottom,dock:d.top};});
 assert.ok(geometry.error<=12,'resize centering '+JSON.stringify({size,geometry}));assert.ok(geometry.bottom<geometry.dock);assert.match(frame.url(),/app\.html/);
 report.cases.push({name,mode,resize:size,...geometry});
}
assert.equal(report.navigation.filter(x=>x.name===name&&x.mode===mode&&/app\.html/.test(x.url)).length,1,'APP must not reload during interaction');
assert.deepEqual(errors,[],'no runtime errors');
    }catch(e){report.diagnostics={name,mode,pageErrors:errors,frames:[]};for(const f of page.frames()){try{report.diagnostics.frames.push(await f.evaluate(()=>({url:location.href,visibility:document.visibilityState,body:document.body?.dataset,main:document.querySelector('.main')?.style.cssText,welcome:document.querySelector('#welcomeOverlay')?.className})));}catch(_){}}await page.screenshot({path:path.join(out,name+'-'+mode+'-FAIL.png'),fullPage:true}).catch(()=>{});throw e;}finally{await context.close();}
   }
  }finally{await browser.close();}
 }
}
run().then(()=>{report.status='PASS';console.log('BROWSER_PASS '+report.cases.length+' cases');}).catch(e=>{report.status='FAIL';report.errors.push(e.stack);console.error(e);process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2)+'\n');server?.close();});
