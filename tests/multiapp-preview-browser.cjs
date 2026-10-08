'use strict';
// Bounded real-browser presentation acceptance. External/provider traffic is blocked.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const out=path.resolve(process.env.MULTIAPP_EVIDENCE_DIR||'multiapp-evidence');fs.mkdirSync(out,{recursive:true});
const root=path.resolve('public'),report={cases:[],externalProviders:'BLOCKED',physicalIPhone:'NOT_RUN'};
const specs=[
 {name:'flip4m',route:'/F4M/new/',screen:'.device-screen',device:'.device',toolbar:'.preview-header',select:'#previewWidth'},
 {name:'sudoku',route:'/S/new/',screen:'.screen',device:'.device',toolbar:'.preview-header',select:'#previewWidth'},
 {name:'chess',route:'/chess-lab/',screen:'.app-preview-screen',device:'.app-preview-device',toolbar:'#appPreviewDesktopTools',select:'#appPreviewWidth'},
 {name:'trip',route:'/Trip/new/',screen:'.trip-preview-screen',device:'.trip-preview-device',toolbar:'.trip-preview-toolbar',select:'#tripPreviewWidth'}
];
let server,activePage,activeSpec;
async function serve(){server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost');let p=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!p.startsWith(root+path.sep))return res.writeHead(403).end();if(u.pathname.endsWith('/'))p=path.join(p,'index.html');fs.readFile(p,(e,b)=>{if(e)return res.writeHead(404).end();const ext=path.extname(p);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.wasm':'application/wasm','.png':'image/png','.svg':'image/svg+xml'})[ext]||'application/octet-stream');res.end(b);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port;}
async function ready(page,s){
 if(s.name==='flip4m')await page.waitForFunction(()=>window.F4MLab?.snapshot&&document.querySelectorAll('.cell').length>0);
 if(s.name==='sudoku'){const f=await (await page.locator('#sudokuGame').elementHandle()).contentFrame();await f.waitForFunction(()=>window.SudokuNavigator?.product&&document.querySelector('#appDock'));return f;}
 if(s.name==='chess')await page.waitForFunction(()=>window.ChessLabHost?.getContext&&document.querySelectorAll('#board img').length>0);
 if(s.name==='trip')await page.locator('#input').waitFor({state:'visible'});
}
async function geometry(page,s){return page.evaluate(s=>{const rect=selector=>{const e=document.querySelector(selector),r=e?.getBoundingClientRect();return r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,display:getComputedStyle(e).display}:null;};return {screen:rect(s.screen),device:rect(s.device),toolbar:rect(s.toolbar),viewport:{width:innerWidth,height:innerHeight},scrollHeight:document.documentElement.scrollHeight};},s);}
function inside(child,parent,label){assert.ok(child&&parent&&child.left>=parent.left-.6&&child.right<=parent.right+.6&&child.top>=parent.top-.6&&child.bottom<=parent.bottom+.6,label+' '+JSON.stringify({child,parent}));}
async function contained(page,s){
 const g=await geometry(page,s);inside(g.screen,g.device,s.name+' screen');assert.ok(g.toolbar.bottom<=g.device.top+.6,s.name+' toolbar outside phone');assert.ok(Math.abs((g.device.left+g.device.right)/2-g.viewport.width/2)<=10,s.name+' centered');
 const selectors={flip4m:['#main','.workspace-tabs'],sudoku:['#sudokuGame'],chess:['#main','.app-tabs'],trip:['#chatPanel']};
 for(const selector of selectors[s.name]){const e=page.locator(selector);if(await e.isVisible())inside(await e.boundingBox().then(r=>r&&({left:r.x,right:r.x+r.width,top:r.y,bottom:r.y+r.height})),g.screen,s.name+' '+selector);}
 return g;
}
async function interactions(page,s,f){
 if(s.name==='flip4m'){
  const before=await page.evaluate(()=>F4MLab.snapshot().cursor);await page.locator('[data-view-tab="history"]').click();await page.locator('[data-view-tab="board"]').click();assert.equal(await page.evaluate(()=>F4MLab.snapshot().cursor),before);
 }
 if(s.name==='sudoku'){
  await f.getByRole('button',{name:/^(Easy|Lahka)$/}).click();await f.waitForFunction(()=>window.SudokuNavigator.export().session?.puzzle?.some(x=>x));
  await f.evaluate(()=>window.stopTimer());
  const state=await f.evaluate(()=>window.SudokuNavigator.export().session);
  const i=state.board.findIndex(x=>!x);await f.locator('#grid .cell').nth(i).click();
  await f.locator('#appNotes').click();assert.equal(await f.locator('#appNotes').getAttribute('aria-pressed'),'true');await f.locator('#appNotes').click();
  await f.locator('#grid .cell').nth(i).press('1');await f.locator('#appUndo').click();
  assert.deepEqual(await f.evaluate(()=>window.SudokuNavigator.export().session.board),state.board,'Sudoku Play/Undo');
  await f.locator('#appMore').click();assert.equal(await f.locator('#navModal').isVisible(),true);await f.locator('#navClose').click();
 }
 if(s.name==='chess'){
  const fen=await page.evaluate(()=>ChessLabHost.getContext().fen);
  for(const tab of ['moves','review','board']){await page.locator('[data-app-tab="'+tab+'"]').click();assert.equal(await page.locator('body').getAttribute('data-app-view'),tab);}
  assert.equal(await page.evaluate(()=>ChessLabHost.getContext().fen),fen,'Chess tabs keep position');
 }
 if(s.name==='trip'){
  await page.locator('#input').fill('Ljubljana | 46.0569, 14.5058 START\nMaribor | 46.5547, 15.6459\nKoper | 45.5481, 13.7302');
  const before=await page.locator('#input').inputValue();
  await page.locator('[data-language="sl"]').click();await page.locator('[data-language="en"]').click();assert.equal(await page.locator('#input').inputValue(),before);
  await page.locator('#btnHelp').click();const g=await geometry(page,s);inside(await page.locator('#helpOverlay').boundingBox().then(r=>({left:r.x,right:r.x+r.width,top:r.y,bottom:r.y+r.height})),g.screen,'Trip help dialog');await page.screenshot({path:path.join(out,'trip-help-'+page.context().browser().browserType().name()+'.png'),fullPage:true});await page.locator('#btnCloseHelp').click();
  await page.locator('#chatPanel .chat-head').click();assert.equal(await page.locator('#chatPanel').evaluate(e=>e.classList.contains('open')),true);await contained(page,s);await page.locator('#chatPanel .chat-head').click();assert.equal(await page.locator('#chatPanel').evaluate(e=>e.classList.contains('open')),false);
  await page.locator('#btnMapMode').click();await page.locator('#mapContainer').scrollIntoViewIfNeeded();const mapRect=await page.locator('#mapContainer').boundingBox();assert.ok(mapRect.width<=402,'Trip map fits mobile column');await page.locator('#btnPlanMode').click();
 }
}
async function desktop(browser,base,s){
 const ctx=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 const page=await ctx.newPage(),errors=[];activePage=page;activeSpec=s;page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+s.route+'?view=app',{waitUntil:'load'});let f=await ready(page,s);
 assert.equal(await page.locator(s.select).inputValue(),'402',s.name+' fresh default');
 await interactions(page,s,f);
 let retained;
 if(s.name==='sudoku')retained=await f.evaluate(()=>JSON.stringify(SudokuNavigator.export().session.board));
 if(s.name==='chess')retained=await page.evaluate(()=>ChessLabHost.getContext().fen);
 if(s.name==='trip')retained=await page.locator('#input').inputValue();
 for(const width of ['375','390','402','430']){
  await page.locator(s.select).selectOption(width);
  await page.waitForFunction(({screen,width})=>Math.abs(document.querySelector(screen).getBoundingClientRect().width-Number(width))<.6,{screen:s.screen,width});
  const g=await contained(page,s);report.cases.push({engine:browser.browserType().name(),app:s.name,width:Number(width),...g});
  if(s.name==='sudoku')assert.equal(await f.evaluate(()=>JSON.stringify(SudokuNavigator.export().session.board)),retained,'width keeps game');
  if(s.name==='chess')assert.equal(await page.evaluate(()=>ChessLabHost.getContext().fen),retained,'width keeps chess study');
  if(s.name==='trip')assert.equal(await page.locator('#input').inputValue(),retained,'width keeps plan');
 }
 await page.locator(s.select).selectOption('402');await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,s.name+'-'+browser.browserType().name()+'-402.png'),fullPage:true});
 await page.setViewportSize({width:1152,height:720});await contained(page,s);report.cases.push({engine:browser.browserType().name(),app:s.name,size:'1152x720-125percent-zoom-equivalent',...await geometry(page,s)});
 await page.setViewportSize({width:1024,height:768});await contained(page,s);report.cases.push({engine:browser.browserType().name(),app:s.name,size:'1024x768',...await geometry(page,s)});
 await page.setViewportSize({width:800,height:600});await contained(page,s);assert.equal(await page.locator(s.toolbar).isVisible(),true);report.cases.push({engine:browser.browserType().name(),app:s.name,size:'800x600-small-desktop',...await geometry(page,s)});
 await page.setViewportSize({width:1440,height:900});await page.reload({waitUntil:'load'});f=await ready(page,s);assert.equal(await page.locator(s.select).inputValue(),'402','width reload');
 await page.goto(base+s.route+'?view=app&width=375',{waitUntil:'load'});await ready(page,s);assert.equal(await page.locator(s.select).inputValue(),'375','URL priority');
 const nav=page.locator(s.toolbar+' nav');assert.equal(await nav.locator('a[aria-current="page"]').innerText(),'APP');assert.equal(await nav.locator('a').count(),4);
 await nav.getByRole('link',{name:'LAB',exact:true}).click();await page.waitForLoadState('load');assert.equal(await page.locator(s.toolbar).isVisible(),false,'LAB restores wide mode');
 if(s.name==='trip')assert.equal(await page.locator('#input').inputValue(),retained,'LAB/APP keeps plan');
 assert.deepEqual(errors,[],s.name+' runtime errors');await ctx.close();
}
async function phone(browser,base,s){
 const ctx=await browser.newContext({viewport:{width:402,height:874},isMobile:true,hasTouch:true,serviceWorkers:'block',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'});
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 const page=await ctx.newPage();activePage=page;activeSpec=s;await page.goto(base+s.route,{waitUntil:'load'});await ready(page,s);
 assert.equal(await page.locator(s.toolbar).isVisible(),false,'phone toolbar absent');
 assert.equal(await page.locator(s.device).count(),s.name==='chess'||s.name==='trip'?0:1,'no artificial phone wrapper');
 const widths=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));assert.ok(widths.scroll<=widths.client,s.name+' phone overflow '+JSON.stringify(widths));
 await page.screenshot({path:path.join(out,s.name+'-'+browser.browserType().name()+'-phone.png')});report.cases.push({engine:browser.browserType().name(),app:s.name,size:'402x874-touch',frameless:true});await ctx.close();
}
(async()=>{const base=await serve();report.failures=[];
 for(const engine of [chromium,webkit]){const browser=await engine.launch();try{
  for(const spec of specs){try{await desktop(browser,base,spec);await phone(browser,base,spec);console.log('PASS',browser.browserType().name(),spec.name);}
   catch(e){report.failures.push({engine:browser.browserType().name(),app:spec.name,error:e.stack||String(e)});console.error('FAIL',browser.browserType().name(),spec.name,e.message);
    if(activePage&&!activePage.isClosed()){await activePage.screenshot({path:path.join(out,spec.name+'-'+browser.browserType().name()+'-FAIL.png'),fullPage:true}).catch(()=>{});report.failures.at(-1).geometry=await geometry(activePage,spec).catch(()=>null);await activePage.context().close();}
   }
  }
 }finally{await browser.close();}}
 fs.writeFileSync(path.join(out,'geometry.json'),JSON.stringify(report,null,2));
 if(report.failures.length)throw Error('Browser acceptance failures: '+report.failures.map(x=>x.engine+'/'+x.app+': '+x.error.split('\n')[0]).join(' | '));
 console.log('MULTIAPP_BROWSER_PASS',report.cases.length);
})().catch(e=>{fs.writeFileSync(path.join(out,'failure.txt'),e.stack||String(e));console.error(e);process.exitCode=1;}).finally(()=>server?.close());
