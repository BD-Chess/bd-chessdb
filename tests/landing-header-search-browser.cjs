'use strict';
/* Real mobile layout and search/navigation acceptance; isolated contexts only. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
if(process.env.CI!=='true')throw Error('Browser verification runs only in the existing GitHub CI, not on HOME.');
const {chromium,webkit}=require('playwright');
const pub=path.resolve(__dirname,'../public'),evidence=process.env.LANDING_QA_EVIDENCE;
if(evidence)fs.mkdirSync(evidence,{recursive:true});
let server;
async function localServer(){
 server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let file=path.resolve(pub,'.'+pathname);
  if(!file.startsWith(pub+path.sep)&&file!==pub){res.writeHead(403);return res.end();}
  // The deployed canonical URL is lowercase; the unchanged source directory is TSP.
  if(!fs.existsSync(file)&&pathname.startsWith('/tsp/media/'))file=path.resolve(pub,'TSP/media/'+pathname.slice('/tsp/media/'.length));
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  if(!fs.existsSync(file)){res.writeHead(404);return res.end();}
  const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.mp4':'video/mp4','.webmanifest':'application/manifest+json'};
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return 'http://127.0.0.1:'+server.address().port+'/';
}
async function row(page,width){
 const boxes=await page.evaluate(()=>{
  const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,cy:r.y+r.height/2};};
  return {brand:box('.topbar .brand'),search:box('#search-open'),menu:box('#main-menu-trigger'),tools:box('.topbar .utilities'),header:box('.topbar'),controls:[...document.querySelectorAll('.topbar>.utilities>.utility,.topbar>.utilities>.main-menu>summary')].map(el=>{const r=el.getBoundingClientRect();return {id:el.id,x:r.x,y:r.y,w:r.width,h:r.height,right:r.right};})};
 });
 assert.ok(Math.abs(boxes.brand.cy-boxes.tools.cy)<2,'One header row at '+width);
 assert.ok(boxes.brand.right<=boxes.tools.x+1,'Brand/toolbar do not overlap at '+width);
 assert.ok(boxes.search.right<=boxes.menu.x+1,'S stays left of the menu at '+width);
 assert.ok(Math.abs(boxes.search.cy-boxes.menu.cy)<2,'S and menu share one row at '+width);
 assert.equal(boxes.controls.length,2,'Only S and menu stay in the header');
 for(const c of boxes.controls){
  assert.ok(c.w>=24&&c.h>=40,'Usable hit area '+c.id+' at '+width);
  assert.ok(c.x>=0&&c.right<=width+1,'No clipped control '+c.id+' at '+width);
 }
 return boxes;
}
async function homeStudies(name,browser,url){
 const report={browser:name,sourceCommit:process.env.GITHUB_SHA||null,layouts:[],media:[],errors:[]};
 const origin=new URL(url).origin;
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
 const page=await context.newPage(),requests=[],mediaPaths=[];
 page.on('pageerror',error=>report.errors.push(String(error)));
 page.on('request',request=>{if(/\.mp4(?:\?|$)/.test(request.url()))requests.push(request.url());if(request.url().includes('8ztsp-nu3496-engine-at-work'))mediaPaths.push(new URL(request.url()).pathname);});
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 const go=async(language='en')=>{
  const target=new URL(url);target.searchParams.set('lang',language);
  await page.goto(target.href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#study').dataset.heroKind==='tsp');
  await page.waitForFunction(()=>document.querySelector('#tsp-hero-poster').naturalWidth>0);
 };
 async function fit(width){
  const boxes=await page.evaluate(()=>{
   const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};};
   return {hero:box('.hero'),study:box('#study'),intro:box('.lab-intro'),card:box('#tsp-start-card'),access:box('.tsp-card-access'),cta:box('.tsp-hero-cta'),context:box('#tsp-hero-context'),engine:box('.tsp-engine'),review:box('.tsp-review-link'),header:box('.topbar')};
  });
  for(const key of ['study','intro','card','access','cta','context','engine','review']){
   const b=boxes[key];assert.ok(b.x>=-1&&b.right<=width+1&&b.w>0,key+' fits '+width+': '+JSON.stringify(b));
  }
  assert.ok(boxes.intro.y>=boxes.hero.bottom-1,'Introduction follows the hero');
  assert.ok(boxes.engine.y>=boxes.intro.bottom-1,'Engine follows introduction/card');
  assert.ok(boxes.study.y>=boxes.header.bottom-1,'Hero does not overlap header');
  assert.ok(boxes.context.y>=boxes.cta.bottom-1,'Recording context follows hero CTA');
  return boxes;
 }
 try{
  await go();
  assert.equal(await page.locator('#hero-count').innerText(),'1 / 4');
  assert.equal(await page.locator('#tsp-hero-link').getAttribute('href'),'/8zTSP/');
  assert.equal(await page.locator('#tsp-start-card').getAttribute('href'),'/8zTSP/');
  assert.equal(await page.locator('.tsp-review-link').getAttribute('href'),'https://www.mdlxdcc.org/tsp/review/');
  assert.equal(await page.locator('#tsp-hero-video').getAttribute('preload'),'none');
  assert.equal(await page.locator('#tsp-hero-video').getAttribute('src'),null,'Reduced motion does not request MP4');
  assert.deepEqual(requests,[],'Poster only until manual play');
  for(const width of [320,390,1440,3840]){
   await page.setViewportSize({width,height:width>=1440?1000:844});
   for(const language of ['en','sl']){
    await page.evaluate(lang=>window.MDLxDCCLocale.choose(lang),language);
    await page.waitForFunction(lang=>document.querySelector('#tsp-hero-poster').src.endsWith('-'+lang+'.webp'),language);
    const hint=language==='en'?'password; access on request':'z geslom; dostop na prošnjo';
    assert.ok((await page.locator('#tsp-hero-link').innerText()).includes(hint),'Password hint is visible before hero click');
    assert.ok((await page.locator('#tsp-hero-link').getAttribute('aria-label')).includes(hint),'Hero accessible name includes access condition');
    assert.ok((await page.locator('#tsp-start-card').innerText()).includes(hint),'Card states access condition before click');
    const contextText=await page.locator('#tsp-hero-context').innerText();
    for(const term of language==='en'?['4 workers','7 cores','15 Nov 2026']:['4 delavci','7 jedri','15. 11. 2026'])assert.ok(contextText.includes(term),'Recording/native context in '+language+': '+term);
    for(const theme of ['dark','light']){
     await page.locator('#main-menu-trigger').click();
     if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#theme').click();
     await page.locator('#main-menu-trigger').click();
     report.layouts.push({width,language,theme,zoom:100,...await fit(width)});
     if(evidence&&theme==='dark'&&[390,1440].includes(width)){
      await page.locator('#study').screenshot({path:path.join(evidence,name+'-home-'+width+'-'+language+'-hero.png')});
      await page.locator('.lab-intro').screenshot({path:path.join(evidence,name+'-home-'+width+'-'+language+'-entry.png')});
      await page.locator('.tsp-engine').screenshot({path:path.join(evidence,name+'-home-'+width+'-'+language+'-engine.png')});
     }
    }
   }
  }
  // Browser page zoom changes layout width; test 390 CSS px at 200% on a 780 px viewport.
  await page.setViewportSize({width:780,height:1200});
  for(const language of ['en','sl']){
   await page.evaluate(lang=>{window.MDLxDCCLocale.choose(lang);document.documentElement.style.zoom='2';},language);
   report.layouts.push({width:780,language,zoom:200,...await fit(780)});
   if(evidence)await page.locator('.lab-intro').screenshot({path:path.join(evidence,name+'-home-zoom200-'+language+'.png')});
  }
  await page.evaluate(()=>document.documentElement.style.zoom='');
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>window.MDLxDCCLocale.choose('en'));
  for(const [i,kind] of ['tsp','claustrum','pi','pattern'].entries()){
   assert.equal(await page.locator('#study').getAttribute('data-hero-kind'),kind);
   assert.equal(await page.locator('[data-hero-slide]:visible').count(),1);
   assert.equal(await page.locator('#hero-count').innerText(),(i+1)+' / 4');
   if(i<3)await page.locator('#hero-next').click();
  }
  assert.ok(await page.locator('#hero-next').isDisabled());
  for(let i=0;i<3;i++)await page.locator('#hero-prev').click();
  assert.ok(await page.locator('#hero-prev').isDisabled());
  // A keyboard user reaches a real link; all three earlier detail studies still work.
  await page.locator('#tsp-hero-link').focus();
  assert.ok(await page.locator('#tsp-hero-link').evaluate(el=>el===document.activeElement));
  await page.locator('#hero-next').click();
  await page.locator('[data-hero-slide="claustrum"] [data-open-current-detail]').press('Enter');
  for(const [i,kind] of ['claustrum','pi','pattern'].entries()){
   assert.equal(await page.locator('#hero-dialog').getAttribute('data-detail'),kind);
   assert.equal(await page.locator('#hero-detail-count').innerText(),(i+1)+' / 3');
   if(i<2)await page.locator('#hero-detail-next').click();
  }
  await page.locator('#hero-dialog-close').click();
  await page.locator('#slogan').press('Enter');
  assert.equal(await page.locator('#study').getAttribute('data-hero-kind'),'tsp');
  await page.locator('#tsp-hero-link').focus();
  for(const kind of ['claustrum','pi','pattern','tsp']){
   await page.keyboard.press('ArrowRight');
   assert.equal(await page.locator('#study').getAttribute('data-hero-kind'),kind,'Fullscreen navigation '+kind);
   if(kind==='claustrum')assert.ok(await page.locator('#hero-demo-dcc-controls').isVisible());
   if(kind==='pi')assert.ok(await page.locator('.hero-demo-pi-caption').isVisible());
  }
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#study').getAttribute('role'),null);
  assert.deepEqual(requests,[],'All reduced-motion navigation still uses only posters');
  // Manual playback is permitted under reduced motion, but stops when leaving the slide.
  await page.locator('#hero-prev').click();
  await page.locator('#tsp-hero-play').click();
  await page.waitForFunction(()=>{const v=document.querySelector('#tsp-hero-video');return (!v.paused&&v.readyState>=2&&v.currentTime>0)||document.querySelector('#tsp-hero-status').textContent;},null,{timeout:12000});
  report.media.push(await page.locator('#tsp-hero-video').evaluate(v=>({mode:'manual-reduced',src:v.currentSrc,paused:v.paused,readyState:v.readyState,error:v.error?.code||null})));
  assert.ok(await page.locator('#tsp-hero-video').evaluate(v=>!v.paused&&!v.error),'Manual playback actually starts');
  assert.ok(requests.every(value=>value.endsWith('-en.mp4')),'Only selected-language video requested');
  await page.locator('#hero-next').click();
  assert.ok(await page.locator('#tsp-hero-video').evaluate(v=>v.paused),'Inactive video is paused');
  // Normal motion, language replacement, and a runtime preference change.
  await page.emulateMedia({reducedMotion:'no-preference'});
  await go('sl');
  await page.waitForFunction(()=>document.querySelector('#tsp-hero-video').src.endsWith('-sl.mp4'));
  await page.locator('#tsp-hero-link').scrollIntoViewIfNeeded();
  if(await page.locator('#tsp-hero-video').evaluate(v=>v.paused))await page.locator('#tsp-hero-play').click();
  await page.waitForFunction(()=>{const v=document.querySelector('#tsp-hero-video');return (!v.paused&&v.readyState>=2&&v.currentTime>0)||document.querySelector('#tsp-hero-status').textContent;},null,{timeout:12000});
  report.media.push(await page.locator('#tsp-hero-video').evaluate(v=>({mode:'normal-sl',src:v.currentSrc,paused:v.paused,readyState:v.readyState,error:v.error?.code||null})));
  assert.ok(await page.locator('#tsp-hero-video').evaluate(v=>!v.paused&&!v.error),'Selected-language playback actually starts');
  if(evidence)await page.locator('#study').screenshot({path:path.join(evidence,name+'-home-motion-sl.png')});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>document.querySelector('#tsp-hero-video').paused);
  assert.equal(await page.locator('#tsp-hero-link').evaluate(el=>el.classList.contains('is-playing')),false,'Preference change restores poster');
  // A failed movie never hides the poster or prevents navigation.
  await page.route('**/*.mp4',route=>route.abort());
  await page.emulateMedia({reducedMotion:'no-preference'});
  await go('en');
  await page.waitForFunction(()=>document.querySelector('#tsp-hero-status').textContent.length>0);
  assert.ok(await page.locator('#tsp-hero-poster').evaluate(el=>el.naturalWidth>0));
  assert.equal(await page.locator('#tsp-hero-link').evaluate(el=>el.classList.contains('is-playing')),false);
  if(evidence)await page.locator('#study').screenshot({path:path.join(evidence,name+'-home-video-fallback.png')});
  await page.locator('#tsp-hero-link').focus();
  await Promise.all([page.waitForURL(value=>value.pathname==='/8zTSP/'),page.keyboard.press('Enter')]);
  assert.match(await page.title(),/8zTSP/,'Hero link opens the public browser tool');
  assert.ok(mediaPaths.length>0&&mediaPaths.every(value=>value.startsWith('/tsp/media/')),'All runtime poster/video URLs use canonical lowercase path');
  report.mediaPaths=mediaPaths;
  assert.deepEqual(report.errors,[],'No home JavaScript errors');
  console.log('PASS '+name+': four hero studies, old details/fullscreen navigation, EN/SL 320/390/1440/3840, dark/light, 200% zoom, visible/accessibility password hints, browser/native timing context, canonical lowercase media, reduced/manual motion and failed-video keyboard navigation');
 }catch(error){
  if(evidence)await page.screenshot({path:path.join(evidence,name+'-home-failure.png')}).catch(()=>{});
  throw error;
 }finally{
  if(evidence)fs.writeFileSync(path.join(evidence,name+'-home-report.json'),JSON.stringify(report,null,2));
  await context.close();
 }
 const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844},serviceWorkers:'block'});
 try{
  const staticPage=await nojs.newPage();await staticPage.goto(url,{waitUntil:'domcontentloaded'});
  assert.ok(await staticPage.locator('#tsp-start-card').isVisible());
  assert.equal(await staticPage.locator('#tsp-hero-video').getAttribute('src'),null);
  await Promise.all([staticPage.waitForURL(value=>value.pathname==='/8zTSP/'),staticPage.locator('#tsp-start-card').click()]);
  assert.match(await staticPage.title(),/8zTSP/);
 }finally{await nojs.close();}
}
async function run(name,engine,url){
 const browser=await engine.launch({headless:true});
 const context=await browser.newContext({viewport:{width:402,height:874},reducedMotion:'reduce',serviceWorkers:'block',locale:'en-US'});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>{if(new URL(page.url()).pathname===new URL(url).pathname)errors.push(String(error));});
 try{
  await homeStudies(name,browser,url);
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('#main-menu-trigger').click();
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
  await page.locator('#main-menu-trigger').click();
  if(evidence)await page.screenshot({path:path.join(evidence,name+'-mobile-402.png')});
  await page.locator('#search-open').click();
  // This global-only page proves that S actually loads the full index.
  await page.locator('#search-input').fill('8Z_project_files_manager');
  await page.locator('#search-results a[href*="8Z_project_files_manager"]').waitFor({state:'visible'});
  const queries=[['8ztsp','/tsp/8ztsp/'],['LAB',null],['šah lab','/chess-lab/'],['chess lab','/chess-lab/'],['lab chess','/chess-lab/'],['sudoku lab','/s/new/'],['trip lab','/trip/new/'],['flip4m lab','/f4m/new/'],['križanke lab','/cw/new/'],['crosswords lab','/cw/new/'],['Start','/start/'],['/Start/','/start/'],['začetna','/start/'],['chess','/chess/']];
  const key=url=>new URL(url).pathname.replace(/\/index\.html$/i,'/').toLowerCase();
  for(const [query,target] of queries){
   await page.locator('#search-input').fill(query);
   const links=await page.locator('#search-results a').evaluateAll(nodes=>nodes.map(a=>({title:a.querySelector('strong').textContent,url:a.href})));
   if(query==='LAB'){
    assert.equal(links.length,6);
    assert.deepEqual(links.map(x=>key(x.url)).sort(),['/chess-lab/','/s/new/','/trip/new/','/f4m/new/','/cw/new/','/nara/dualframe-lab/'].sort());
    assert.ok(links.every(x=>/LAB/.test(x.title)&&!x.url.includes('/old/')));
    if(evidence)await page.screenshot({path:path.join(evidence,name+'-lab-results.png')});
   }else assert.equal(key(links[0]?.url),target,query);
  }
  // Enter navigates to the chosen LAB; typing alone never ejects the user.
  await page.locator('#search-input').fill('šah lab');
  await Promise.all([page.waitForURL(url=>url.pathname.toLowerCase().includes('/chess-lab/')),page.locator('#search-input').press('Enter')]);
  assert.ok(await page.locator('body').innerText());
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await Promise.all([page.waitForURL(url=>/\/start\/(?:index\.html)?$/i.test(url.pathname)),page.locator('.topbar .brand-sub a[href="./Start/index.html"]').click()]);
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
  await fallback.locator('#search-input').fill('LAB');assert.equal(await fallback.locator('#search-results a').count(),6);
  await fallback.locator('#search-input').fill('Start');assert.equal(key(await fallback.locator('#search-results a').first().getAttribute('href')),'/start/');
  await fallback.locator('#search-input').fill('8ztsp');assert.equal(key(await fallback.locator('#search-results a').first().getAttribute('href')),'/tsp/8ztsp/');
  await offline.close();
  await page.goto(new URL('TSP/8ztsp/',url).href,{waitUntil:'domcontentloaded'});
  await page.locator('#menu-trigger').click();
  const before=await page.locator('#font-value').textContent();
  const leadBefore=await page.locator('.lead').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  await page.locator('#font-up').click();
  const leadAfter=await page.locator('.lead').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  assert.ok(leadAfter>leadBefore,'8zTSP A+ increases the rendered text');
  assert.equal(parseInt(await page.locator('#font-value').textContent(),10),parseInt(before,10)+5,'8zTSP A+ grows text');
  await page.locator('#font-down').click();
  assert.equal(await page.locator('#font-value').textContent(),before,'8zTSP A− restores text');
  assert.deepEqual(errors,[],'No landing JavaScript errors');
  if(evidence)fs.writeFileSync(path.join(evidence,name+'-layout.json'),JSON.stringify(layouts,null,2));
  console.log('PASS '+name+': S left of menu at 320/390/402/430/700/1440, menu settings EN/SL dark/light 100/150%, 13 searches, real Chess LAB Enter and Start navigation, offline search fallback');
 }finally{await context.close();await browser.close();}
}
(async()=>{
 const url=process.env.LANDING_QA_URL||await localServer();
 try{await run('chromium',chromium,url);await run('webkit',webkit,url);}finally{if(server)server.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
