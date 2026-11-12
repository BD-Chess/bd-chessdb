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
// One point per work (versions share a point). The older cases below work on
// the whole strand; the progressive drawing has its own case first.
async function loaded(p){await p.waitForFunction(()=>document.querySelectorAll('.dna-node').length>400);}
async function ready(p){await loaded(p);await p.locator('#dna-more').evaluate(e=>e.click());}
async function guide(p){await p.keyboard.press('Control+k');await p.locator('#dna-search').waitFor({state:'visible'});}
async function categoryLayout(page,width){
 const state=await page.evaluate(()=>{
  const points=[...document.querySelectorAll('.dna-node .nucleus')].map(e=>({rect:e.getBoundingClientRect(),id:e.parentElement.dataset.project}));
  const labels=[...document.querySelectorAll('.section-label')];
  const collisions=labels.flatMap(e=>{const r=e.getBoundingClientRect();return points.filter(({rect:p})=>r.right>p.left&&r.left<p.right&&r.bottom>p.top&&r.top<p.bottom).map(p=>({loop:e.dataset.loop,point:p.id}));});
  const note=document.querySelector('.section-note:not([hidden])'),r=note.getBoundingClientRect(),v=visualViewport;
  return {collisions,noteInside:r.left>=v.offsetLeft&&r.top>=v.offsetTop&&r.right<=v.offsetLeft+v.width&&r.bottom<=v.offsetTop+v.height,
   title:parseFloat(getComputedStyle(labels[0]).fontSize),count:parseFloat(getComputedStyle(labels[0].querySelector('small')).fontSize),root:parseFloat(getComputedStyle(document.documentElement).fontSize)};
 });
 assert.deepEqual(state.collisions,[],width+' compact category labels clear nuclei');
 assert.equal(state.noteInside,true,width+' explanation remains in the visible viewport');
 assert.ok(state.title>state.count*1.5,'central title is larger than small details');
 if(width<=600)assert.ok(Math.abs(state.count-state.root*.5)<.01,'preserve mobile .5rem count size');
}

try{
 // The strand opens short, its end in fog, and is drawn as the visitor moves down.
 const fresh=await context({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),r=await fresh.newPage();
 await r.goto(base+'/ai8-dna-v4?lang=sl');await loaded(r);
 const strand=()=>r.evaluate(()=>({points:document.querySelectorAll('.dna-node').length,waiting:document.querySelectorAll('.dna-node[hidden]').length,fog:[...document.querySelectorAll('.dna-node:not([hidden])')].filter(n=>n.style.getPropertyValue('--fog')).length,height:document.querySelector('#dna').offsetHeight,caption:!document.querySelector('#dna-hint').hidden,button:!document.querySelector('#dna-more').hidden,y:Math.round(scrollY)}));
 const first=await strand();await r.screenshot({path:out+'/progressive-first.png'});
 assert.ok(first.waiting>350&&first.fog>0&&first.caption&&first.button,'first view: most points wait, the end is in fog, caption and button are shown');
 assert.ok(first.height<3000,'the page opens about two windows long, not as one very long column');
 const dock=await r.locator('#dna-dock').boundingBox(),drawn=await r.evaluate(()=>Math.max(...[...document.querySelectorAll('.dna-node:not([hidden])')].map(n=>n.getBoundingClientRect().bottom)));
 assert.ok(drawn<=dock.y+22,'the strand thins out above the caption instead of running under it');
 const names=await r.locator('.dna-node:not(.origin):not([hidden]) .node-label').evaluateAll(es=>es.map(e=>({size:parseFloat(getComputedStyle(e).fontSize),opacity:Number(getComputedStyle(e).opacity),text:e.textContent})));
 assert.ok(names.every(n=>n.size>=10.5&&n.opacity>=.6),'names are readable at rest');
 const works=await r.locator('.dna-node:not(.origin):not([data-section=top]):not([data-section=new])').evaluateAll(es=>es.map(e=>e.dataset.section+'|'+e.querySelector('.node-label').textContent));
 assert.equal(new Set(works).size,works.length,'no name appears twice within a part of the strand');
 await r.mouse.move(720,500);await r.mouse.wheel(0,900);await r.waitForFunction(()=>scrollY>=900);
 const moved=await strand();assert.ok(moved.waiting<first.waiting&&moved.height>first.height&&!moved.caption&&moved.button,'moving down draws more of the strand and retires the caption');
 // The list of parts shows where the visitor is and reaches a part that is not drawn yet.
 const part=r.locator('#dna-rail button[data-section=lab]');assert.equal(await part.isVisible(),true);await part.click();
 assert.equal(await r.locator('.section-label[data-section=lab]').first().isVisible(),true);assert.equal(await part.getAttribute('aria-current'),'true');
 // A reload (or coming back from a work) returns to the same place on the strand.
 const place=(await strand()).y;assert.ok(place>3000);await r.reload();await loaded(r);await r.waitForFunction(y=>Math.abs(scrollY-y)<2,place);
 // Versions and copies of one work share its point and stay reachable from its description.
 await guide(r);await r.locator('#dna-search').fill('6-Hour Operating System');await r.locator('#dna-results button').first().click();
 assert.equal(await r.locator('.variants a').count(),7);assert.equal(await r.locator('.dna-node[aria-expanded=true]').isVisible(),true);await r.keyboard.press('Escape');
 // The visible language switch changes every strand label; names of works keep their own language.
 await r.locator('#dna-lang button[data-lang=en]').click();assert.equal(await r.locator('html').getAttribute('lang'),'en');assert.equal(await r.locator('#dna-rail button[data-section=new] span').textContent(),'NEW');
 await r.locator('#dna-lang button[data-lang=sl]').click();assert.equal(await r.locator('#dna-rail button[data-section=new] span').textContent(),'NOVO');assert.equal(await r.locator('#dna-more').textContent(),'Pokaži celo verigo');
 await r.locator('#dna-more').click();const whole=await strand();assert.equal(whole.waiting,0);assert.equal(whole.fog,0);assert.equal(whole.button,false);assert.ok(whole.height>13000);
 report.cases.push(`progressive strand: ${first.points} points, ${first.waiting} wait in the first view, readable names, no repeated name, drawing on scroll, list of parts, reload returns, versions in the description, SL/EN switch, whole strand on request`);
 await fresh.close();
 // A phone shows a name on two lines instead of cutting it after a few letters.
 const phone=await context({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'}),ph=await phone.newPage();await ph.goto(base+'/ai8-dna-v4?lang=sl');await loaded(ph);
 assert.equal(await ph.locator('#dna-rail').isVisible(),false);assert.equal(await ph.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const long=await ph.locator('.dna-node[data-section=top][data-record="human-middle"] .node-label').evaluate(e=>({lines:Math.round(e.getBoundingClientRect().height/parseFloat(getComputedStyle(e).lineHeight)),cut:e.scrollWidth>e.clientWidth+1,text:e.textContent}));
 assert.equal(long.lines,2,JSON.stringify(long));assert.equal(long.cut,false);await ph.screenshot({path:out+'/progressive-phone.png'});
 // The AI Lab's request for a record's point draws the strand that far; a version is answered with its work.
 await guide(ph);await ph.locator('#dna-search').fill('F4M_rDCC_v3_Tournament1');const version=await ph.locator('#dna-results button').first().getAttribute('data-record');await ph.keyboard.press('Escape');
 const found=await ph.evaluate(record=>{const before=document.querySelectorAll('.dna-node[hidden]').length,ask={record,node:null};document.dispatchEvent(new CustomEvent('ai8-dna:locate',{detail:ask}));return ask.node&&{hidden:ask.node.hidden,record:ask.node.dataset.record,before,after:document.querySelectorAll('.dna-node[hidden]').length};},version);
 assert.ok(found&&!found.hidden&&found.record!==version&&found.after<found.before,JSON.stringify(found));
 report.cases.push('phone 390: two-line names, no list of parts, no overflow, a record located for the AI Lab');await phone.close();
 // The native display scene keeps the whole strand and gets no dock or list of parts.
 const scene=await context({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),nv=await scene.newPage();await nv.goto(base+'/ai8-dna-v4?lang=sl&mode=ai8-live');await loaded(nv);
 assert.equal(await nv.locator('.dna-node[hidden]').count(),0);assert.equal(await nv.locator('#dna-dock').isVisible(),false);assert.equal(await nv.locator('#dna-rail').isVisible(),false);assert.ok(await nv.evaluate(()=>document.querySelector('#dna').offsetHeight)>13000);
 report.cases.push('native scene: whole strand, no dock, no list of parts');await scene.close();
 const desktop=await context({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),p=await desktop.newPage();
 await p.goto(base+'/ai8-dna-v4?lang=en');await ready(p);
 assert.equal(await p.locator('.dna-node[data-section=top]').count(),8);
 assert.equal(await p.locator('.dna-node[data-record=tripopti]').count(),2);
 const top=await p.locator('.dna-node[data-section=top]').evaluateAll(es=>es.map(e=>e.dataset.record));
 assert.deepEqual(top,['tripopti','mdl-dcc','chessbest','sudoku','ai8','human-middle','nara','flip4m']);
 await p.mouse.move(0,0);await p.screenshot({path:out+'/desktop-first.png'});
 for(const id of ['top','new','cfh','ai8','games','apps','machines','theories','stories','lab']){
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
 await guide(p);const counted=(await p.locator('.origin-count').textContent()).match(/^(\d+) works · (\d+) pages · public collection$/);assert.ok(counted,'the guide counts works and pages');
 const expectedPages=await p.evaluate(async()=>{
  const [{loadCatalogue},{decorateDNA}]=await Promise.all([import('/assets/ai8-entry/featured-catalog.mjs'),import('/assets/ai8-entry/dna-top-points.mjs')]);
  const source=await loadCatalogue();if(!source.complete)throw Error('Catalogue did not load');
  return decorateDNA(source.items,{includeLive:true}).length;
 });
 assert.equal(Number(counted[2]),expectedPages,'the guide counts actual public catalogue pages');
 assert.equal(Number(counted[1]),await p.locator('.dna-node:not(.origin):not([data-section=top]):not([data-section=new])').count());
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
 const fallback=await context({viewport:{width:390,height:844},reducedMotion:'reduce'}),f=await fallback.newPage();await f.route('**/site-search-index.json',r=>r.fulfill({status:503,body:'unavailable'}));await f.goto(base+'/ai8-dna-v4.html?lang=en');await f.waitForFunction(()=>document.querySelectorAll('.dna-node').length===41);await guide(f);assert.match(await f.locator('.origin-count').textContent(),/^30 .*selected projects/);assert.equal(await f.locator('.dna-node[data-section=top]').count(),8);assert.equal(await f.locator('.dna-node[data-section=new]').count(),2);report.cases.push('catalogue fetch failure: working curated fallback, honest count/status, eight featured and two available NEW shortcuts');await fallback.close();
 assert.deepEqual(errors,[]);assert.deepEqual(report.externalRequests,[]);
 fs.writeFileSync(out+'/browser-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
