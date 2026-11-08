import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const out=path.resolve(process.env.DNA_EVIDENCE||'/tmp/ai8-dna-v4-evidence');fs.mkdirSync(out,{recursive:true});
const root=path.resolve('public');
const server=http.createServer((req,res)=>{
 if(new URL(req.url,'http://localhost').pathname==='/Trip/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Trip destination fixture</title>');return;}
 let file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 if(!path.extname(file))file+='.html';
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'})[path.extname(file)]||'application/octet-stream');res.end(data);});
});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
const report={cases:[],errors:[],externalRequests:[],physicalDevice:false};
const errors=report.errors;
async function context(options){const c=await browser.newContext({...options,serviceWorkers:'block'});await c.route('**/*',r=>{if(new URL(r.request().url()).origin!==base){report.externalRequests.push(r.request().url());return r.abort();}return r.continue();});c.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));return c;}
async function ready(p){await p.waitForFunction(()=>document.querySelectorAll('.dna-node').length>480);}
async function guide(p){await p.keyboard.press('Control+k');await p.locator('#dna-search').waitFor({state:'visible'});}
async function categoryLayout(page,width){
 const state=await page.evaluate(()=>{
  const points=[...document.querySelectorAll('.dna-node .nucleus')].map(e=>e.getBoundingClientRect());
  const labels=[...document.querySelectorAll('.section-label')];
  const collisions=labels.filter(e=>{const r=e.getBoundingClientRect();return points.some(p=>r.right>p.left&&r.left<p.right&&r.bottom>p.top&&r.top<p.bottom);}).length;
  const note=document.querySelector('.section-note:not([hidden])'),r=note.getBoundingClientRect(),v=visualViewport;
  return {collisions,noteInside:r.left>=v.offsetLeft&&r.top>=v.offsetTop&&r.right<=v.offsetLeft+v.width&&r.bottom<=v.offsetTop+v.height,
   title:parseFloat(getComputedStyle(labels[0]).fontSize),count:parseFloat(getComputedStyle(labels[0].querySelector('small')).fontSize),root:parseFloat(getComputedStyle(document.documentElement).fontSize)};
 });
 assert.equal(state.collisions,0,width+' compact category labels clear nuclei');
 assert.equal(state.noteInside,true,width+' explanation remains in the visible viewport');
 assert.ok(state.title>state.count*1.5,'central title is larger than small details');
 if(width<=600)assert.ok(Math.abs(state.count-state.root*.5)<.01,'preserve mobile .5rem count size');
}

try{
 const desktop=await context({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),p=await desktop.newPage();
 await p.goto(base+'/ai8-dna-v4?lang=en');await ready(p);
 assert.equal(await p.locator('.dna-node[data-section=top]').count(),8);
 assert.equal(await p.locator('.dna-node[data-record=tripopti]').count(),2);
 const top=await p.locator('.dna-node[data-section=top]').evaluateAll(es=>es.map(e=>e.dataset.record));
 assert.deepEqual(top,['tripopti','mdl-dcc','chessbest','sudoku','ai8','human-middle','nara','flip4m']);
 await p.mouse.move(0,0);await p.screenshot({path:out+'/desktop-first.png'});
 for(const id of ['top','cfh','ai8','games','apps','machines','theories','stories','lab']){
  const label=p.locator(`.section-label[data-section=${id}]`).first();await label.scrollIntoViewIfNeeded();await label.hover();
  assert.equal(await label.getAttribute('aria-expanded'),'true',id+' hover');
  const physical=await label.evaluate(e=>{const y=parseFloat(e.style.top);return [...document.querySelectorAll('.dna-node:not(.origin)')].filter(n=>Math.abs(parseFloat(n.style.top)-y)<115).map(n=>n.dataset.project).sort();});
  assert.deepEqual(await p.locator('.dna-node.section-active').evaluateAll(es=>es.map(e=>e.dataset.project).sort()),physical,id+' physical oval only');
  assert.equal(await p.locator('.section-label.section-active').count(),1,id+' one label');
  if(id==='cfh'||id==='machines')await p.screenshot({path:out+'/desktop-'+id+'-hover.png'});
  await p.mouse.move(0,0);assert.equal(await label.getAttribute('aria-expanded'),'false',id+' hover exit');
  await p.keyboard.press('Tab');await label.focus();assert.equal(await label.getAttribute('aria-expanded'),'true',id+' keyboard focus');
  await p.keyboard.press('ArrowDown');assert.equal(await p.evaluate(()=>document.activeElement.classList.contains('dna-node')),true,id+' arrow continues to next point');await label.focus();
  await p.keyboard.press('Escape');assert.equal(await label.getAttribute('aria-expanded'),'false',id+' escape');
 }
 await guide(p);assert.match(await p.locator('.origin-count').textContent(),/^479 /);
 await p.locator('#dna-search').fill('TripOpti');const titles=await p.locator('#dna-results button span:first-child').allTextContents();assert.equal(titles.filter(t=>t==='TripOpti').length,2); // distinct /Trip/ and /Trip/TripOpti.html records already in source
 assert.equal(new Set(await p.locator('#dna-results button').evaluateAll(es=>es.map(e=>e.dataset.record))).size,titles.length,'Top 8 must not duplicate search results');
 await p.locator('#dna-search').fill('Consciousness Field Hypothesis');assert.equal(await p.locator('#dna-results button').count(),1);
 await p.locator('#dna-results button').click();assert.match(await p.locator('#panel-title').textContent(),/CFH/);assert.match(await p.locator('.project-cta').getAttribute('href'),/BD_CCH_Consciousness_Field/);
 await guide(p);await p.locator('#dna-search').fill('TripOpti');await p.locator('#dna-results button').first().click();assert.equal(await p.locator('#panel-title').textContent(),'TripOpti');
 await p.keyboard.press('Escape');const trip=p.locator('.dna-node[data-section=apps][data-record=tripopti]');await trip.focus();await p.keyboard.press('Enter');await p.waitForURL(base+'/Trip/');
 report.cases.push('desktop: categories hover/focus/Escape, exact Top 8, unique search, source URLs and Enter navigation');
 await desktop.close();
 for(const width of [320,390,768]){
  const c=await context({viewport:{width,height:844},hasTouch:true,isMobile:width<600,reducedMotion:'reduce'}),m=await c.newPage();await m.goto(base+'/ai8-dna-v4.html?lang=sl');await ready(m);
  assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,width+' no overflow');
  const label=m.locator('.section-label[data-section=cfh]').first();await label.scrollIntoViewIfNeeded();await label.tap();assert.equal(await label.getAttribute('aria-pressed'),'true');
  await m.touchscreen.tap(8,8); // outside closes the persistent explanation
  assert.equal(await label.getAttribute('aria-expanded'),'false');await label.tap();
  await m.evaluate(()=>scrollBy(0,20));assert.equal(await label.getAttribute('aria-expanded'),'true','touch highlight persists on scroll');
  await categoryLayout(m,width);
  await m.screenshot({path:out+'/touch-'+width+'-cfh.png'});await label.tap();assert.equal(await label.getAttribute('aria-expanded'),'false','second tap toggles off');
  await guide(m);await m.locator('[aria-label="English"]').click();assert.equal(await m.locator('html').getAttribute('lang'),'en');await m.locator('[data-dna-text]').uncheck();assert.equal(await m.locator('html').evaluate(e=>e.classList.contains('dna-text-off')),true);await m.locator('[data-dna-text]').check();
  for(let i=0;i<10;i++)await m.locator('[aria-label="Larger text"]').click();
  await m.keyboard.press('Escape');const enlarged=m.locator('.section-label[data-section=cfh]').first();await enlarged.scrollIntoViewIfNeeded();await enlarged.tap();
  await categoryLayout(m,width);await m.screenshot({path:out+'/touch-'+width+'-large-text.png'});await enlarged.tap();await guide(m);

  await m.locator('#dna-search').fill('TripOpti');await m.locator('#dna-results button').first().tap();await m.keyboard.press('Escape');
  const node=m.locator('.dna-node[data-section=apps][data-record=tripopti]');await node.tap();assert.equal(await m.locator('#panel-title').textContent(),'TripOpti');await node.tap();await m.waitForURL(base+'/Trip/');
  report.cases.push(`touch ${width}: no overflow, SL/EN, text control, persistent category toggle, first-tap preview/second-tap navigation`);await c.close();
 }
 // Compare today's archived v3 to the base revision, using the same browser and data.
 const c=await context({viewport:{width:390,height:844},reducedMotion:'reduce'}),v=await c.newPage();
 await v.goto(base+'/ai8-dna-v3.html?lang=en');await v.waitForFunction(()=>document.querySelectorAll('.dna-node').length===480);
 const archived=await v.screenshot({path:out+'/v3-frozen.png'});
 const source='93c097d4';
 await v.route(base+'/baseline-v3.html*',r=>r.fulfill({contentType:'text/html',body:execFileSync('git',['show',source+':public/ai8-dna-v3.html'],{encoding:'utf8'})}));
 await v.route(base+'/assets/ai8-entry/*',r=>{const name=new URL(r.request().url()).pathname;try{const data=execFileSync('git',['show',source+':public'+name]);return r.fulfill({contentType:name.endsWith('.css')?'text/css':'text/javascript',body:data});}catch{return r.abort();}});
 await v.goto(base+'/baseline-v3.html?lang=en');await v.waitForFunction(()=>document.querySelectorAll('.dna-node').length===480);
 const baseline=await v.screenshot({path:out+'/v3-baseline.png'});assert.deepEqual(archived,baseline,'v3 archive is pixel-identical to base at phone viewport with reduced motion');
 report.cases.push('v3: same 479 records and pixel-identical phone screenshot against pre-change base');await c.close();
 const fallback=await context({viewport:{width:390,height:844},reducedMotion:'reduce'}),f=await fallback.newPage();await f.route('**/site-search-index.json',r=>r.fulfill({status:503,body:'unavailable'}));await f.goto(base+'/ai8-dna-v4.html?lang=en');await f.waitForFunction(()=>document.querySelectorAll('.dna-node').length===38);await guide(f);assert.match(await f.locator('.origin-count').textContent(),/^29 .*selected projects/);assert.equal(await f.locator('.dna-node[data-section=top]').count(),8);report.cases.push('catalogue fetch failure: working curated fallback, honest count/status and eight shortcuts');await fallback.close();
 assert.deepEqual(errors,[]);assert.deepEqual(report.externalRequests,[]);
 fs.writeFileSync(out+'/browser-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
