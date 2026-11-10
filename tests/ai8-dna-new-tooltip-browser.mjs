import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {FEATURED_IDS} from '../public/assets/ai8-entry/featured-catalog.mjs';
import {NEW_UPDATES,normalizedTarget} from '../public/assets/ai8-entry/dna-new-points.mjs';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const out=path.resolve(process.env.DNA_NEW_EVIDENCE||'/tmp/dna-new-tooltip-evidence');fs.mkdirSync(out,{recursive:true});
const root=path.resolve('public');let server;
let base=process.env.DNA_BASE_URL;
if(!base){
 server=http.createServer((req,res)=>{
  let file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  if(!path.extname(file))file+='.html';
  try{res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
}
base=base.replace(/\/$/,'');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const report={base,cases:[],errors:[],modelPOSTs:0,physicalDevice:false};
async function context(width,height=920,touch=false){
 const c=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch&&width<600,reducedMotion:'reduce',serviceWorkers:'block'});
 await c.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==new URL(base).origin)return route.abort();
  if(url.pathname.startsWith('/.netlify/functions/')){
   if(request.method()==='POST')report.modelPOSTs++;
   return route.fulfill({status:401,contentType:'application/json',body:'{"authenticated":false}'});
  }
  return route.continue();
 });
 c.on('page',p=>p.on('pageerror',e=>report.errors.push(e.message)));return c;
}
// 412 works + 8 + 2 shortcuts + origin; these cases work on the whole strand.
async function ready(p){await p.waitForFunction(()=>document.querySelectorAll('.dna-node').length===423);await p.locator('#dna-more').evaluate(e=>e.click());}
async function settled(p){await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function at(p,label,y){
 const docY=await label.evaluate(e=>parseFloat(e.style.top));
 await p.evaluate(({docY,y})=>scrollTo(0,docY-y),{docY,y});await settled(p);
}
async function geometry(p,label){
 const state=await label.evaluate(e=>{
  const note=document.getElementById(e.getAttribute('aria-controls')),r=note.getBoundingClientRect(),b=e.getBoundingClientRect(),v=visualViewport;
  const middle=b.top+b.height/2,ellipse={top:middle-115,bottom:middle+115};
  const overlaps=[...document.querySelectorAll('.dna-node.section-active .node-label')].filter(n=>{
   const a=n.getBoundingClientRect();return r.left<a.right&&r.right>a.left&&r.top<a.bottom&&r.bottom>a.top;
  }).map(n=>n.textContent);
  return {loop:e.dataset.loop,placement:note.dataset.placement,ellipse,note:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},
   centred:Math.abs(r.left+r.width/2-(b.left+b.width/2))<1,
   inside:r.left>=v.offsetLeft&&r.right<=v.offsetLeft+v.width+.5&&r.top>=v.offsetTop&&r.bottom<=v.offsetTop+v.height+.5,
   outside:r.top>=ellipse.bottom||r.bottom<=ellipse.top,overlaps,visible:getComputedStyle(note).visibility!=='hidden',scrollable:note.scrollHeight>note.clientHeight};
 });
 assert.equal(state.visible,true);assert.equal(state.inside,true,JSON.stringify(state));
 assert.equal(state.centred,true,'tooltip stays centred on its ellipse');assert.equal(state.outside,true,'tooltip clears the whole selected ellipse');assert.deepEqual(state.overlaps,[],'all highlighted project labels remain clear');
 return state;
}
try{
 for(const native of [false,true])for(const width of [1440,754,390]){
  const c=await context(width),p=await c.newPage();let guideRequests=0;
  p.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/.netlify/functions/mdlxdcc-guide'))guideRequests++;});
  await p.goto(base+'/ai8-dna-v4?lang=en'+(native?'&mode=ai8-live':''));await ready(p);
  const top=await p.locator('.dna-node[data-section=top]').evaluateAll(es=>es.map(e=>({id:e.dataset.record,title:e.querySelector('.node-label').textContent})));
  assert.deepEqual(top.map(n=>n.id),FEATURED_IDS);
  const fresh=await p.locator('.dna-node[data-section=new]').evaluateAll(es=>es.map(e=>e.dataset.record));
  assert.deepEqual(fresh,NEW_UPDATES.map(u=>u.id));assert.ok(!fresh.some(id=>FEATURED_IDS.includes(id)));
  assert.deepEqual(await p.locator('.section-label').evaluateAll(es=>es.slice(0,2).map(e=>e.dataset.section)),['top','new']);
  assert.equal(await p.locator('.section-label[data-section=new]').count(),1);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal clipping');
  const label=p.locator('.section-label[data-loop="cfh:2"]');
  const positions=await p.locator('.dna-node').evaluateAll(es=>es.map(e=>[e.style.left,e.style.top]));
  const states=[];
  for(const [edge,y,placement] of [['upper',150,'below'],['lower',770,'above']]){
   await p.keyboard.press('Escape');await at(p,label,y);await label.hover();
   assert.equal(await label.getAttribute('aria-expanded'),'true');const state=await geometry(p,label);assert.equal(state.placement,placement);states.push({edge,...state});
   await p.screenshot({path:path.join(out,`${native?'native':'public'}-${width}-${edge}.png`)});
  }
  await label.click();assert.equal(await label.getAttribute('aria-pressed'),'true');await p.evaluate(()=>scrollBy(0,-30));await settled(p);await geometry(p,label);
  await p.keyboard.press('Escape');assert.equal(await label.getAttribute('aria-expanded'),'false');
  await p.keyboard.press('Tab');await label.focus();await geometry(p,label);await p.keyboard.press('ArrowDown');assert.equal(await p.evaluate(()=>document.activeElement.classList.contains('dna-node')),true);await p.keyboard.press('Escape');
  assert.deepEqual(await p.locator('.dna-node').evaluateAll(es=>es.map(e=>[e.style.left,e.style.top])),positions,'selection cannot move anchors');
  const newLabel=p.locator('.section-label[data-loop="new:1"]');await at(p,newLabel,300);await newLabel.hover();await geometry(p,newLabel);await p.screenshot({path:path.join(out,`${native?'native':'public'}-${width}-new.png`)});await p.keyboard.press('Escape');
  const node=p.locator('.dna-node[data-section=new][data-record="bogastvo-obstoja"]');await node.scrollIntoViewIfNeeded();await p.keyboard.press('Tab');await node.focus();
  assert.equal(await p.locator('.project-update time').textContent(),'2026-11-06');assert.equal(await p.locator('.project-update time').getAttribute('datetime'),'2026-11-06');
  assert.match(await p.locator('.project-update').textContent(),/Featured on Start/);assert.equal(await p.locator('.project-update a').getAttribute('href'),'https://github.com/BD-Chess/bd-chessdb/commit/b951225e2b77080a36914dd5cb6588fa6b8eb6b7');
  const destination=await p.locator('.project-cta').getAttribute('href');assert.equal(normalizedTarget(new URL(destination).pathname),normalizedTarget('/bogastvo-obstoja/'));
  await p.route(destination,r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Public destination test fixture</title>'}));await p.keyboard.press('Enter');await p.waitForURL(destination);
  if(native)assert.equal(guideRequests,0,'native DNA mode never initializes guide or authentication traffic');
  report.cases.push({native,width,states,newCount:fresh.length,top8Unchanged:true,datedSource:true,keyboardNavigation:true,guideRequests});await c.close();
 }
 const c=await context(754,400,true),p=await c.newPage();await p.goto(base+'/ai8-dna-v4?lang=sl&mode=ai8-live');await ready(p);
 const label=p.locator('.section-label[data-loop="cfh:2"]');await at(p,label,200);await label.tap();const short=await geometry(p,label);assert.equal(short.scrollable,true,'short viewport bounds the note with internal scrolling');
 const note=p.locator('.section-note:not([hidden])');await note.hover();await p.mouse.wheel(0,180);assert.equal(await p.locator('#dna-panel').isVisible(),false,'reading a pinned note does not activate a page beneath it');await p.keyboard.press('Escape');
 await p.setViewportSize({width:754,height:920});await at(p,label,400);await label.tap();assert.equal(await label.getAttribute('aria-pressed'),'true');await geometry(p,label);await label.tap();assert.equal(await label.getAttribute('aria-expanded'),'false');
 report.cases.push({shortViewport:short,touchToggle:true,pinnedNoteUsable:true});await c.close();
 assert.deepEqual(report.errors,[]);assert.equal(report.modelPOSTs,0);report.status='PASS';console.log(JSON.stringify(report,null,2));
}finally{fs.writeFileSync(path.join(out,'new-tooltip-report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
