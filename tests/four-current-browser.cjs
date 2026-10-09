'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const out=path.resolve(process.env.CURRENT_PROMOTION_EVIDENCE||'current-promotion-evidence');
fs.mkdirSync(out,{recursive:true});
const root=path.resolve('public'),report={schema:'four-current-acceptance-v1',cases:[],provider_calls:'BLOCKED',physical_device:'NOT_RUN'};
const specs=[
 {name:'Flip4M',url:'/F4M/',internal:'.f4m-shell'},
 {name:'8zSudoku',url:'/S/',internal:'#sudokuGame'},
 {name:'ChessBest',url:'/chess/',internal:'#board'},
 {name:'TripOpti',url:'/Trip/',internal:'#input'}
];
async function serve(){
 const server=http.createServer((req,res)=>{
  let u=new URL(req.url,'http://localhost'),pathname=decodeURIComponent(u.pathname),f=path.resolve(root,'.'+pathname);
  if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  if(pathname.endsWith('/'))f=path.join(f,'index.html');
  fs.readFile(f,(err,data)=>{
   if(err){res.writeHead(404).end();return;}
   const types={'.html':'text/html','.js':'text/javascript','.cjs':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.wasm':'application/wasm','.png':'image/png','.svg':'image/svg+xml','.pgn':'text/plain','.tsp':'text/plain'};
   res.setHeader('Content-Type',types[path.extname(f)]||'application/octet-stream');res.end(data);
  });
 }); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {server,url:'http://127.0.0.1:'+server.address().port};
}
async function ready(page,s){
 if(s.name==='Flip4M')await page.waitForFunction(()=>window.F4MLab?.snapshot&&document.querySelectorAll('.cell').length>0,null,{timeout:20000});
 if(s.name==='8zSudoku'){
  const iframe=await page.locator('#sudokuGame').elementHandle(),frame=await iframe.contentFrame();
  await frame.waitForFunction(()=>window.SudokuNavigator?.product&&document.querySelector('#grid'),null,{timeout:20000});
  return frame;
 }
 if(s.name==='ChessBest')await page.waitForFunction(()=>window.ChessLabHost?.getContext&&document.querySelector('#board'),null,{timeout:30000});
 if(s.name==='TripOpti')await page.locator('#input').waitFor({state:'visible',timeout:20000});
}
async function check(page,s,mobile,frame){
 const state=await page.evaluate(({name})=>{
  const html=document.documentElement,body=document.body;
  const nav=[...document.querySelectorAll('nav')].filter(n=>n.getAttribute('aria-label')==='Application versions'||n.getAttribute('aria-label')==='Flip4M versions'||n.getAttribute('aria-label')==='Sudoku versions'||n.getAttribute('aria-label')==='Trip version');
  return {width:html.clientWidth,scrollWidth:html.scrollWidth,navCount:nav.length,
    mode:name==='Flip4M'?body.dataset.presentation:name==='8zSudoku'?html.dataset.sudokuShell:name==='ChessBest'?(body.classList.contains('app-mobile')?'mobile':'desktop'):html.dataset.tripPresentation,
    preview:!!document.querySelector('.trip-preview-device,.app-preview-device,.preview-header'),
    activeVersionAnchors:[...document.querySelectorAll('a')].filter(a=>/^(CURRENT|PREVIOUS|LAB|APP)$/.test(a.textContent.trim())).map(a=>a.outerHTML.slice(0,160))};
 },{name:s.name});
 assert.equal(state.navCount,0,s.name+' CURRENT channel menu must be absent');
 assert.equal(state.activeVersionAnchors.length,0,s.name+' no version anchors');
 assert.equal(state.preview,false,s.name+' never a fake phone frame');
 assert.ok(state.scrollWidth<=state.width+2,s.name+' horizontal scroll '+JSON.stringify(state));
 const expected=s.name==='Flip4M'?(mobile?'app':'lab'):s.name==='8zSudoku'?(mobile?'phone':'lab'):s.name==='ChessBest'?(mobile?'mobile':'desktop'):(mobile?'mobile':'lab');
 assert.equal(state.mode,expected,s.name+' current adaptive presentation '+JSON.stringify(state));
 if(s.name==='8zSudoku')assert.equal(await frame.evaluate(()=>document.body.dataset.presentation),mobile?'app':'lab','Sudoku unified inner mode');
 if(s.name==='TripOpti'&&!mobile)assert.equal(await page.locator('.app-wrapper').count(),1,'Trip current Editor survives');
 if(s.name==='ChessBest'&&mobile)assert.equal(await page.locator('[data-app-tab="board"]').count(),1,'Chess mobile tabs');
 return state;
}
async function run(browser,base,s,mobile){
 const opts=mobile?{viewport:{width:402,height:874},isMobile:true,hasTouch:true,serviceWorkers:'block',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{viewport:{width:960,height:1150},serviceWorkers:'block'};
 const ctx=await browser.newContext(opts);
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"offline":true}'}));
 const page=await ctx.newPage();
 try {
  await page.goto(base+s.url,{waitUntil:'load',timeout:30000});
  let frame=await ready(page,s);
  let state=await check(page,s,mobile,frame);
  if(!mobile&&s.name==='Flip4M'){
   const cursor=await page.evaluate(()=>window.F4MLab.snapshot().cursor);
   await page.locator('[data-view-tab="history"]').click();
   await page.locator('[data-view-tab="board"]').click();
   assert.equal(await page.evaluate(()=>window.F4MLab.snapshot().cursor),cursor,'Flip4M view switch must preserve game');
  }
  if(!mobile&&s.name==='8zSudoku'){
   const iframeSrc=await page.locator('#sudokuGame').getAttribute('src');
   assert.match(iframeSrc,/^\/S\/app\.html\?presentation=lab/,'CURRENT must use promoted engine, not old current/');
  }
  if(!mobile&&s.name==='ChessBest'){
   assert.equal(typeof await page.evaluate(()=>ChessLabHost.getContext().fen),'string','Chess position restored');
   assert.ok(await page.locator('#board').isVisible(),'Desktop chess board visible');
  }
  if(!mobile&&s.name==='TripOpti'){
   const text='Ljubljana | 46.0569, 14.5058 START\nMaribor | 46.5547, 15.6459\nKoper | 45.5481, 13.7302';
   await page.locator('#input').fill(text);
   await page.locator('[data-language="sl"]').click();
   await page.locator('[data-language="en"]').click();
   assert.equal(await page.locator('#input').inputValue(),text,'Trip current input retained after language');
   await page.locator('#chkDirect').check();
   await page.locator('#btnStandard').click();
   await page.waitForFunction(()=>document.querySelectorAll('#routeList li').length>=3,null,{timeout:20000});
   assert.equal(await page.locator('#input').inputValue(),text);
  }
  if(!mobile){await page.setViewportSize({width:1440,height:1100});await check(page,s,mobile,frame);}
  const file=s.name+'-'+browser.browserType().name()+(mobile?'-mobile':'-desktop')+'.png';
  await page.screenshot({path:path.join(out,file),fullPage:!mobile});
  report.cases.push({engine:browser.browserType().name(),name:s.name,device:mobile?'phone':'desktop',state,screenshot:file});
  console.log('PASS',browser.browserType().name(),s.name,mobile?'phone':'desktop');
 } finally {await ctx.close();}
}
(async()=>{
 const {server,url}=await serve();
 try {
  for(const engine of [chromium,webkit]){
   const browser=await engine.launch();
   try{for(const s of specs){await run(browser,url,s,false);await run(browser,url,s,true);}}
   finally{await browser.close();}
  }
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2)+'\n');
  console.log('FOUR_CURRENT_BROWSER_PASS',report.cases.length);
 } finally {await new Promise(r=>server.close(r));}
})().catch(e=>{fs.writeFileSync(path.join(out,'failure.txt'),e.stack||String(e));console.error(e);process.exitCode=1;});
