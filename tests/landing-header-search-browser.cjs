'use strict';
/* Real mobile layout and search/navigation acceptance; isolated contexts only. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium,webkit}=require('playwright');
const pub=path.resolve(__dirname,'../public'),evidence=process.env.LANDING_QA_EVIDENCE;
if(evidence)fs.mkdirSync(evidence,{recursive:true});
let server;
async function localServer(){
 server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let file=path.resolve(pub,'.'+pathname);
  if(!file.startsWith(pub+path.sep)&&file!==pub){res.writeHead(403);return res.end();}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file)){res.writeHead(404);return res.end();}
  const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.webmanifest':'application/manifest+json'};
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return 'http://127.0.0.1:'+server.address().port+'/';
}
async function row(page,width){
 const boxes=await page.evaluate(()=>{
  const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,cy:r.y+r.height/2};};
  return {brand:box('.topbar .brand'),tools:box('.topbar .utilities'),header:box('.topbar'),controls:[...document.querySelectorAll('.topbar .utility')].map(el=>{const r=el.getBoundingClientRect();return {id:el.id||el.dataset.lang,x:r.x,y:r.y,w:r.width,h:r.height,right:r.right};})};
 });
 assert.ok(Math.abs(boxes.brand.cy-boxes.tools.cy)<2,'One header row at '+width);
 assert.ok(boxes.brand.right<=boxes.tools.x+1,'Brand/toolbar do not overlap at '+width);
 assert.equal(boxes.controls.length,7);
 for(const c of boxes.controls){
  assert.ok(c.w>=24&&c.h>=40,'Usable hit area '+c.id+' at '+width);
  assert.ok(c.x>=0&&c.right<=width+1,'No clipped control '+c.id+' at '+width);
 }
 return boxes;
}
async function run(name,engine,url){
 const browser=await engine.launch({headless:true});
 const context=await browser.newContext({viewport:{width:402,height:874},reducedMotion:'reduce',serviceWorkers:'block',locale:'en-US'});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>{if(new URL(page.url()).pathname===new URL(url).pathname)errors.push(String(error));});
 try{
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('#font-value').waitFor({state:'visible'});
  const layouts=[];
  for(const width of [320,390,402,430,700,1440]){
   await page.setViewportSize({width,height:874});
   for(const language of ['en','sl']){
    await page.locator('button[data-lang="'+language+'"]').click();
    for(const theme of ['dark','light']){
     if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#theme').click();
     await page.locator('#font-value').click();
     layouts.push({width,language,theme,font:100,...await row(page,width)});
    }
   }
   for(let i=0;i<10;i++)await page.locator('#font-up').click();
   assert.equal(await page.locator('#font-value').innerText(),'150%');
   layouts.push({width,font:150,...await row(page,width)});
   await page.locator('#font-value').click();
  }
  await page.setViewportSize({width:402,height:874});
  await page.locator('button[data-lang="en"]').click();
  if(await page.locator('html').getAttribute('data-theme')!=='dark')await page.locator('#theme').click();
  if(evidence)await page.screenshot({path:path.join(evidence,name+'-mobile-402.png')});
  await page.locator('#search-open').click();
  await page.waitForFunction(()=>!document.querySelector('#search-status').textContent.includes('loading'));
  const queries=[['LAB',null],['šah lab','/chess-lab/'],['chess lab','/chess-lab/'],['lab chess','/chess-lab/'],['sudoku lab','/s/new/'],['trip lab','/trip/new/'],['flip4m lab','/f4m/new/'],['križanke lab','/cw/new/'],['crosswords lab','/cw/new/'],['Start','/start/'],['/Start/','/start/'],['začetna','/start/'],['chess','/chess/']];
  const key=url=>new URL(url).pathname.replace(/\/index\.html$/i,'/').toLowerCase();
  for(const [query,target] of queries){
   await page.locator('#search-input').fill(query);
   const links=await page.locator('#search-results a').evaluateAll(nodes=>nodes.map(a=>({title:a.querySelector('strong').textContent,url:a.href})));
   if(query==='LAB'){
    assert.equal(links.length,5);
    assert.deepEqual(links.map(x=>key(x.url)).sort(),['/chess-lab/','/s/new/','/trip/new/','/f4m/new/','/cw/new/'].sort());
    assert.ok(links.every(x=>/LAB/.test(x.title)&&!x.url.includes('/old/')));
    if(evidence)await page.screenshot({path:path.join(evidence,name+'-lab-results.png')});
   }else assert.equal(key(links[0]?.url),target,query);
  }
  // Enter navigates to the chosen LAB; typing alone never ejects the user.
  await page.locator('#search-input').fill('šah lab');
  await Promise.all([page.waitForURL(url=>url.pathname.toLowerCase().includes('/chess-lab/')),page.locator('#search-input').press('Enter')]);
  assert.ok(await page.locator('body').innerText());
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await Promise.all([page.waitForURL(url=>/\/start\/(?:index\.html)?$/i.test(url.pathname)),page.locator('.topbar .brand').click()]);
  assert.match(await page.title(),/Start/i);
  await page.goto(url,{waitUntil:'domcontentloaded'});
  // Keep working if the global index is unavailable. Test in a fresh context.
  const offline=await browser.newContext({viewport:{width:402,height:874},serviceWorkers:'block'});
  const fallback=await offline.newPage();
  await fallback.route('**/site-search-index.json',route=>route.abort());
  await fallback.route('**/index-search*',route=>route.abort());
  await fallback.goto(url,{waitUntil:'domcontentloaded'});
  await fallback.locator('#search-open').click();
  await fallback.waitForFunction(()=>/quick routes|bližnjice/.test(document.querySelector('#search-status').textContent));
  await fallback.locator('#search-input').fill('LAB');assert.equal(await fallback.locator('#search-results a').count(),5);
  await fallback.locator('#search-input').fill('Start');assert.equal(key(await fallback.locator('#search-results a').first().getAttribute('href')),'/start/');
  await offline.close();
  assert.deepEqual(errors,[],'No landing JavaScript errors');
  if(evidence)fs.writeFileSync(path.join(evidence,name+'-layout.json'),JSON.stringify(layouts,null,2));
  console.log('PASS '+name+': 320/390/402/430/700/1440, EN/SL, dark/light, 100/150%, 13 searches, real Chess LAB Enter and Start logo navigation, offline search fallback');
 }finally{await context.close();await browser.close();}
}
(async()=>{
 const url=process.env.LANDING_QA_URL||await localServer();
 try{await run('chromium',chromium,url);await run('webkit',webkit,url);}finally{if(server)server.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
