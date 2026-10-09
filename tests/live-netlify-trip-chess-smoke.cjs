'use strict';
// One-shot, read-only production browser smoke. Auth, API and paid providers blocked.
const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=process.env.LIVE_SMOKE_EVIDENCE||'live-smoke-evidence';
fs.mkdirSync(out,{recursive:true});
const site={
 trip:{url:'https://www.mdlxdcc.org/Trip/',host:'www.mdlxdcc.org'},
 chess:{url:'https://chessbest.org/',host:'chessbest.org'},
 chessMdl:{url:'https://www.mdlxdcc.org/chess/',host:'www.mdlxdcc.org'}
};
const results={schema:'bd-live-trip-chess-smoke-20261009-v4',sourceCommit:'33a4e359a00e15e8043df94544a1ec3800dacf69',realDevice:'NOT_RUN',providerBackedRoutes:'NOT_RUN: provider requests blocked',cases:[]};
const blocked=[],errors=[];
const staticExt=/\.(?:html?|js|css|webmanifest|png|svg|ico|webp|jpe?g|woff2?|wasm|pgn|tsp|json)$/i;
function permitted(pathname,resource){
 if(/\/(?:\.netlify|api|auth|unlock|token|secrets?|credential|config\/private|keys?)(?:\/|$)/i.test(pathname))return false;
 if(/(?:maps-config|maps_key|road[_-]?matrix[_-]?api|gemini[_-]?api|mdl[_-]?unlock)/i.test(pathname))return false;
 if(resource==='fetch'||resource==='xhr'){
  // Only static, known-public chess/game library and Trip TSP fixtures.
  // WebKit importScripts and local Stockfish WASM often use fetch/other. They are static;
  // blocking them breaks offline solvers despite no paid provider involvement.
  if(/\.(?:js|wasm)$/i.test(pathname))return true;
  return /\/(?:Games\/.*\.pgn|config\/(?:bots|coach)\.json|Trip\/tsp\/[^/]+\.(?:json|tsp)|chess\/research\/benchmark-fixtures\.json)$/i.test(pathname);
 }
 if(resource==='document')return true;
 return staticExt.test(pathname);
}
async function guard(ctx,host){
 await ctx.route('**/*',route=>{
  const request=route.request(),u=new URL(request.url()),p=u.pathname;
  if(request.method()==='GET'&&u.protocol==='https:'&&u.hostname===host&&permitted(p,request.resourceType()))return route.continue();
  blocked.push({host:u.hostname,path:p,method:request.method(),type:request.resourceType()});
  return route.fulfill({status:503,contentType:'text/plain',body:'External/API calls disabled by bounded browser test'});
 });
}
async function caseRun(engine,kind,mobile){
 const b=await engine.launch();
 const opts=mobile?{viewport:{width:402,height:874},isMobile:true,hasTouch:true,serviceWorkers:'block',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{viewport:{width:960,height:1100},serviceWorkers:'block'};
 const ctx=await b.newContext(opts); await guard(ctx,site[kind].host);
 const page=await ctx.newPage();
 const name=engine.name()+'-'+kind+'-'+(mobile?'mobile':'desktop');
 page.on('pageerror',e=>errors.push({case:name,message:String(e.message).slice(0,180)}));
 try{
  const response=await page.goto(site[kind].url,{waitUntil:'domcontentloaded',timeout:35000});
  assert.ok(response&&response.ok(),name+' initial HTTP');
  const effective=new URL(page.url());
  assert.equal(effective.hostname,site[kind].host,name+' no domain escape');
  const v=await page.evaluate(()=>({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,title:document.title}));
  assert.ok(v.scrollWidth<=v.width+5,name+' no horizontal scrolling');
  const versionAnchors=await page.locator('a').evaluateAll(nodes=>nodes.filter(a=>/^(CURRENT|PREVIOUS|LAB|APP)$/.test(a.textContent.trim())).length);
  assert.equal(versionAnchors,0,name+' CURRENT must hide all version navigation');
  if(kind==='trip'){
   await page.locator('#input').waitFor({state:'visible',timeout:20000});
   const mode=await page.evaluate(()=>document.documentElement.dataset.tripPresentation);
   assert.equal(mode,mobile?'mobile':'lab',name+' Trip presentation');
   assert.equal(await page.locator('.trip-preview-device').count(),0,name+' no desktop simulated device');
   assert.equal(await page.locator('#btnEnableMap').isEnabled(),true,name+' Map control available on Netlify (not loaded)');
   assert.equal(await page.locator('#btnPrepare').isEnabled(),true,name+' roads Prepare present (not invoked)');
   if(!mobile){
    const draft='Ljubljana | 46.0569, 14.5058 START\nMaribor | 46.5547, 15.6459\nKoper | 45.5481, 13.7302';
    await page.locator('#input').fill(draft);
    await page.locator('#chkDirect').check();
    await page.locator('#btnStandard').click();
    await page.waitForFunction(()=>document.querySelectorAll('#routeList li').length>=3,null,{timeout:22000});
    assert.equal(await page.locator('#input').inputValue(),draft,'Direct Line calculation retained points');
    const dist=await page.locator('#distKm').textContent();
    assert.match(dist||'',/[0-9]/,'Direct Line produced numeric distance');
    await page.locator('#btnMapMode').click();
    assert.equal(await page.locator('#mapContainer').isVisible(),true,'Map panel opens without provider calls');
    assert.equal(await page.locator('#mapPlaceholder').isVisible(),true,'Map stays inactive until explicit Load Map');
    await page.locator('#btnPlanMode').click();
    assert.equal(await page.locator('#input').inputValue(),draft,'Plan/Map leaves draft intact');
   }else{
    assert.equal(await page.locator('#btnMapMode').count(),1,'mobile Map navigation present');
    assert.equal(await page.locator('#mapContainer').count(),1,'mobile map container present');
   }
  }else{
   await page.waitForFunction(()=>window.ChessLabHost?.getContext&&document.querySelector('#board'),null,{timeout:40000});
   const fen=await page.evaluate(()=>ChessLabHost.getContext().fen);
   assert.ok(fen&&fen.includes('/'),'Chess initialized to valid FEN');
   assert.equal(await page.locator('.app-preview-device').count(),0,'No desktop phone frame in CURRENT chess');
   const appMode=await page.locator('body').evaluate(b=>b.classList.contains('app-mobile'));
   assert.equal(appMode,mobile,'Chess responsive mobile presentation');
   if(mobile){
    for(const tab of ['moves','review','board']){
     await page.locator('[data-app-tab="'+tab+'"]').click({timeout:12000});
     assert.equal(await page.locator('body').getAttribute('data-app-view'),tab,'Chess tab '+tab);
    }
   }else{
    assert.equal(await page.locator('#btnGames').count(),1,'Chess game library control');
    assert.equal(await page.locator('#btnDeepAnalysis').count(),1,'Chess Deep analysis control');
    // The legacy Flip board button is intentionally hidden in CURRENT desktop.
    // Test visible workspace navigation instead of forcing a hidden control.
    await page.locator('#desktopViewTabs [data-desktop-view="review"]:visible').first().click({timeout:12000});
    await page.waitForFunction(()=>[...document.querySelectorAll('#desktopViewTabs [data-desktop-view="review"]')].some(e=>e.getAttribute('aria-selected')==='true'),null,{timeout:5000});
    await page.locator('#desktopViewTabs [data-desktop-view="moves"]:visible').first().click({timeout:12000});
   }
   assert.equal(await page.evaluate(()=>ChessLabHost.getContext().fen),fen,'Chess UI interaction preserves board position');
   // Visual acceptance must wait for chessboard.js piece images after tab/resize animation.
   // A valid FEN alone can coexist with a temporarily empty board.
   await page.waitForFunction(()=>{
    const imgs=[...document.querySelectorAll('#board img')];
    return imgs.length>=32&&imgs.every(x=>x.complete&&x.naturalWidth>0);
   },null,{timeout:10000}).catch(async()=>{
    const state=await page.evaluate(()=>({images:document.querySelectorAll('#board img').length,loaded:[...document.querySelectorAll('#board img')].filter(x=>x.complete&&x.naturalWidth>0).length}));
    throw Error('Chess visual board does not have 32 loaded starting pieces: '+JSON.stringify(state));
   });
  }
  await page.screenshot({path:path.join(out,name+'.png'),fullPage:false});
  results.cases.push({case:name,status:'PASS',loaded:page.url(),pageTitle:v.title,viewport:v.width,blockedProviders:blocked.filter(x=>x.host!==site[kind].host).length});
  console.log('LIVE_BROWSER_PASS',name,page.url());
 }catch(e){
  results.cases.push({case:name,status:'FAIL',error:String(e.stack||e).slice(0,1000),loaded:page.url()});
  console.log('LIVE_BROWSER_FAIL',name,String(e.message||e));
  try{await page.screenshot({path:path.join(out,name+'-fail.png'),fullPage:false})}catch(_){}
 }finally{await ctx.close();await b.close();}
}
(async()=>{
 for(const engine of [chromium,webkit])for(const type of ['trip','chess','chessMdl'])for(const mobile of [false,true])await caseRun(engine,type,mobile);
 results.providerRequestsBlocked=blocked.length;
 results.blockedRequestClasses=[...new Set(blocked.map(x=>x.type))];
 results.pageErrors=errors;
 results.pass=results.cases.filter(x=>x.status==='PASS').length;
 results.total=results.cases.length;
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(results,null,2)+'\n');
 console.log('LIVE_BROWSER_RESULT',results.pass,'/',results.total,'provider_requests_blocked',blocked.length);
 if(results.pass!==results.total)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
