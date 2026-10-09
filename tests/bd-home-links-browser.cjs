'use strict';
/* Click the actual visible BD × AI Lab label in 8 CURRENT/LAB routes.
 * Cross-origin landing is fulfilled with a static fixture; no paid/provider calls.
 * In particular, Sudoku iframe links must navigate the TOP browsing context.
 */
const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve('public'),out=path.resolve(process.env.BD_HOME_TEST_EVIDENCE||'bd-home-evidence');
fs.mkdirSync(out,{recursive:true});
const cases=[
  {
    "name": "Flip4M CURRENT",
    "url": "/F4M/",
    "selector": ".brand-caption a.bd-lab-home",
    "count": 2
  },
  {
    "name": "Flip4M LAB",
    "url": "/F4M/new/",
    "selector": ".brand-caption a.bd-lab-home",
    "count": 2
  },
  {
    "name": "8zSudoku CURRENT",
    "url": "/S/",
    "selector": ".logo a.bd-lab-home",
    "count": 2,
    "frame": true
  },
  {
    "name": "8zSudoku LAB",
    "url": "/S/new/",
    "selector": ".logo a.bd-lab-home",
    "count": 2,
    "frame": true
  },
  {
    "name": "ChessBest CURRENT",
    "url": "/chess/",
    "desktop": ".brand-kicker a.bd-lab-home",
    "phone": ".app-brand-name a.bd-lab-home",
    "count": 2
  },
  {
    "name": "ChessBest LAB",
    "url": "/chess-lab/",
    "desktop": ".brand-kicker a.bd-lab-home",
    "phone": ".app-brand-name a.bd-lab-home",
    "count": 2
  },
  {
    "name": "TripOpti CURRENT",
    "url": "/Trip/",
    "selector": ".brand a.bd-lab-home",
    "count": 1
  },
  {
    "name": "TripOpti LAB",
    "url": "/Trip/new/",
    "selector": ".brand a.bd-lab-home",
    "count": 1
  }
];
const target='https://www.mdlxdcc.org/index.html';
const report={schema:'bd-home-link-eight-channels/1',homepage:target,cases:[],externalCalls:'BLOCKED except static landing fixture'};
async function serve(){
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost'),p=decodeURIComponent(url.pathname);
  let file=path.resolve(root,'.'+p);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  if(p.endsWith('/'))file=path.join(file,'index.html');
  fs.readFile(file,(err,data)=>{
   if(err){res.writeHead(404).end();return;}
   const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.wasm':'application/wasm','.pgn':'text/plain','.tsp':'text/plain'};
   res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data);
  });
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {server,base:'http://127.0.0.1:'+server.address().port};
}
async function check(engine,s,phone,base){
 const browser=await engine.launch();
 const context=await browser.newContext(phone?{viewport:{width:402,height:874},isMobile:true,hasTouch:true,serviceWorkers:'block',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}:{viewport:{width:960,height:1100},serviceWorkers:'block'});
 let redirects=0;await context.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.href===target){redirects++;return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>MDLxDCC landing fixture</title><h1 id="landingProof">MDLxDCC landing index.html</h1>'});}
  if(u.origin===base)return route.continue();
  return route.fulfill({status:503,contentType:'text/plain',body:'External resources blocked in bounded browser test'});
 });
 const page=await context.newPage(),label=s.name+' '+engine.name()+' '+(phone?'phone':'desktop');
 try{
  const response=await page.goto(base+s.url,{waitUntil:'domcontentloaded',timeout:25000});
  assert.ok(response&&response.ok(),label+' initial HTTP');
  const site=s.frame?page.frameLocator('#sudokuGame'):page;
  if(s.name.startsWith('ChessBest')&&phone)await page.waitForFunction(()=>document.body.classList.contains('app-mobile'),null,{timeout:15000});
  let anchors=site.locator('a.bd-lab-home');
  await anchors.first().waitFor({state:'attached',timeout:18000});
  assert.equal(await anchors.count(),s.count,label+' branded links');
  const actualHrefs=await anchors.evaluateAll(nodes=>nodes.map(n=>({href:n.href,target:n.target})));
  assert.ok(actualHrefs.every(v=>v.href===target&&v.target==='_top'),label+' exact URL and top-level target '+JSON.stringify(actualHrefs));
  const chosen=s.frame?s.selector:(s.desktop||s.phone)?(phone?s.phone:s.desktop):s.selector;
  const link=site.locator(chosen);
  await link.waitFor({state:'visible',timeout:15000});
  const geometry=await link.boundingBox();
  assert.ok(geometry?.width>=45&&geometry?.height>=9,label+' actual visible tap/click target '+JSON.stringify(geometry));
  if(!s.frame){
   const viewport=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
   assert.ok(viewport.scroll<=viewport.client+2,label+' horizontal overflow '+JSON.stringify(viewport));
  }
  await page.screenshot({path:path.join(out,label.replace(/[^A-Za-z0-9-]+/g,'-')+'-before.png')});
  await link.click({timeout:15000});
  await page.waitForURL(url=>url.href===target,{timeout:16000});
  assert.equal(await page.locator('#landingProof').count(),1,label+' escaped iframe and landed in top page');
  assert.equal(redirects,1,label+' exactly one top-level landing navigation');
  report.cases.push({case:label,status:'PASS',source:s.url,href:target});
  console.log('BD_HOME_LINK_PASS',label);
 }catch(err){
  report.cases.push({case:label,status:'FAIL',source:s.url,error:String(err?.stack||err).slice(0,900)});
  console.error('BD_HOME_LINK_FAIL',label,String(err?.message||err));
  try{await page.screenshot({path:path.join(out,label.replace(/[^A-Za-z0-9-]+/g,'-')+'-failed.png')})}catch(_){}
 }finally{await context.close();await browser.close();}
}
(async()=>{
 const {server,base}=await serve();
 try{
  for(const engine of [chromium,webkit])for(const s of cases)for(const phone of [false,true])await check(engine,s,phone,base);
  report.passed=report.cases.filter(x=>x.status==='PASS').length;report.total=report.cases.length;
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('BD_HOME_LINK_RESULT',report.passed,'/',report.total);
  if(report.passed!==report.total)process.exitCode=1;
 }finally{await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
