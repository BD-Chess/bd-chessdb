import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const out=process.env.DNA_LOOP_EVIDENCE||'/tmp/dna-loop-evidence';fs.mkdirSync(out,{recursive:true});
const root=path.resolve('public');
const server=http.createServer((q,s)=>{
 let f=path.resolve(root,'.'+new URL(q.url,'http://localhost').pathname);
 if(!f.startsWith(root+path.sep)){s.writeHead(403).end();return;}
 if(!path.extname(f))f+='.html';
 try{s.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(f)]||'application/octet-stream');s.end(fs.readFileSync(f));}catch{s.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const report={cases:[],errors:[],paidCalls:0};
async function context(touch=false){
 const c=await browser.newContext({viewport:{width:touch?390:1440,height:1100},isMobile:touch,hasTouch:touch,reducedMotion:'reduce',serviceWorkers:'block'});
 await c.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 c.on('page',p=>p.on('pageerror',e=>report.errors.push(e.message)));
 return c;
}
async function ready(p){await p.waitForFunction(()=>document.querySelectorAll('.dna-node').length===488);}
async function local(p,label){
 const actual=await p.locator('.dna-node.section-active').evaluateAll(es=>es.map(e=>e.dataset.project).sort());
 // Independent physical membership: document-space position in the 230px oval.
 const physical=await label.evaluate(e=>{const y=parseFloat(e.style.top);return [...document.querySelectorAll('.dna-node:not(.origin)')].filter(n=>Math.abs(parseFloat(n.style.top)-y)<115).map(n=>n.dataset.project).sort();});
 assert.deepEqual(actual,physical);assert.equal(await p.locator('.section-label.section-active').count(),1);
 assert.equal(await label.getAttribute('aria-expanded'),'true');
 const note=await label.getAttribute('aria-controls');assert.equal(await p.locator('[id="'+note+'"]').isVisible(),true);
 assert.equal(await p.locator('.section-note:not([hidden])').count(),1);
 return physical.length;
}
function recordCanvas(){
 const proto=CanvasRenderingContext2D.prototype,begin=proto.beginPath,move=proto.moveTo,line=proto.lineTo,stroke=proto.stroke,clear=proto.clearRect;
 window.__backbones=[];
 proto.beginPath=function(...args){this.__line=null;return begin.apply(this,args);};
 proto.moveTo=function(x,y){this.__from={x,y};return move.call(this,x,y);};
 proto.lineTo=function(x,y){this.__line={a:this.__from,b:{x,y}};return line.call(this,x,y);};
 proto.clearRect=function(...args){if(this.canvas.id==='dna-canvas')window.__backbones=[];return clear.apply(this,args);};
 proto.stroke=function(...args){if(this.canvas.id==='dna-canvas'&&Math.abs(this.lineWidth-1.1)<.001&&this.__line)window.__backbones.push({...this.__line,style:this.strokeStyle});return stroke.apply(this,args);};
}
async function strokes(p){await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));return p.evaluate(()=>window.__backbones);}
function rgba(style){
 if(style.startsWith('#'))return {side:parseInt(style.slice(1,3),16),alpha:style.length===9?parseInt(style.slice(7,9),16)/255:1};
 const n=style.match(/[\d.]+/g).map(Number);return {side:n[0],alpha:n[3]??1};
}
function crossings(lines){
 const points=new Map();
 for(const l of lines)for(const p of [l.a,l.b]){if(!points.has(p.y))points.set(p.y,new Map());points.get(p.y).set(rgba(l.style).side,p.x);}
 const pairs=[...points].filter(([,xs])=>xs.size===2).sort((a,b)=>a[0]-b[0]).map(([y,x])=>({y,d:x.get(158)-x.get(215)})),result=[];
 for(let i=1;i<pairs.length;i++){const a=pairs[i-1],b=pairs[i];if(a.d*b.d<0)result.push(a.y+(b.y-a.y)*(-a.d)/(b.d-a.d));}
 return result;
}
async function canvasLocality(p,id){
 await p.mouse.move(0,0);await p.keyboard.press('Escape');await p.evaluate(()=>scrollTo(0,0));
 const baseline=await strokes(p),label=p.locator('.section-label[data-loop="'+id+'"]'),centre=await label.evaluate(e=>parseFloat(e.style.top));
 const edges=crossings(baseline),start=Math.max(...edges.filter(y=>y<centre)),end=Math.min(...edges.filter(y=>y>centre));assert.ok(Number.isFinite(start)&&Number.isFinite(end));
 await label.hover();await local(p,label);const selected=await strokes(p);
 assert.deepEqual(selected.map(({a,b})=>({a,b})),baseline.map(({a,b})=>({a,b})),'selection cannot change actual canvas geometry');
 const key=l=>JSON.stringify([l.a,l.b,rgba(l.style).side]),old=new Map(baseline.map(l=>[key(l),rgba(l.style).alpha]));let localCount=0,otherCount=0;
 for(const l of selected){assert.ok(old.has(key(l)),'same backbone and coordinates in baseline');const before=old.get(key(l)),after=rgba(l.style).alpha,y=(l.a.y+l.b.y)/2;
  if(y>start+8&&y<end-8){assert.ok(after>before*1.15,'actual selected oval gets brighter (RGBA clamps at 1)');localCount++;}
  else if(y<start-8||y>end+8){assert.ok(after<before*.61,'all other physical loops including same-category siblings dim');otherCount++;}
 }
 assert.ok(localCount>20&&otherCount>20);await p.screenshot({path:out+'/canvas-'+id.replace(':','-')+'.png'});
 return {id,start,end,localSegments:localCount,otherSegments:otherCount};
}
try{
 for(const touch of [false,true]){
  const c=await context(touch),p=await c.newPage();await p.goto(base+'/ai8-dna-v4?lang=en');await ready(p);
  const pos=await p.locator('.dna-node').evaluateAll(es=>es.map(e=>[e.style.left,e.style.top]));
  const a=p.locator('.section-label[data-loop="cfh:1"]'),b=p.locator('.section-label[data-loop="cfh:2"]');
  if(touch){
   await a.scrollIntoViewIfNeeded();await a.tap();await local(p,a);await b.scrollIntoViewIfNeeded();await b.tap();await local(p,b);
   assert.equal(await a.getAttribute('aria-pressed'),'false');assert.equal(await b.getAttribute('aria-pressed'),'true');await p.screenshot({path:out+'/touch-cfh-2.png'});
   await b.tap();assert.equal(await p.locator('.dna-node.section-active').count(),0);
  }else{
   await a.scrollIntoViewIfNeeded();await a.hover();assert.equal(await local(p,a),8);await p.mouse.move(0,0);assert.equal(await p.locator('.dna-node.section-active').count(),0);
   await b.scrollIntoViewIfNeeded();await b.hover();assert.equal(await local(p,b),8);assert.equal(await a.getAttribute('aria-expanded'),'false');await p.screenshot({path:out+'/desktop-cfh-2-hover.png'});
   await b.click();await a.scrollIntoViewIfNeeded();await a.click();await local(p,a);assert.equal(await b.getAttribute('aria-pressed'),'false');assert.equal(await a.getAttribute('aria-pressed'),'true');await p.keyboard.press('Escape');
   await p.keyboard.press('Tab');await b.focus();await local(p,b);await p.locator('#dna-origin').focus();assert.equal(await p.locator('.dna-node.section-active').count(),0);await p.keyboard.press('Escape');
   const top=p.locator('.section-label[data-loop="top:1"]');await top.scrollIntoViewIfNeeded();await top.hover();assert.equal(await local(p,top),5);assert.equal(await p.locator('.dna-node[data-loop="top:cap"].section-active').count(),0);assert.equal(await p.locator('.dna-node[data-section=top]').count(),8);await p.mouse.move(0,0);
   await p.keyboard.press('Control+k');await p.locator('.section-index button').filter({hasText:'CFH'}).click();await local(p,a);assert.equal(await a.getAttribute('aria-pressed'),'true');await p.keyboard.press('Escape');
  }
  assert.deepEqual(await p.locator('.dna-node').evaluateAll(es=>es.map(e=>[e.style.left,e.style.top])),pos);
  report.cases.push(touch?'touch: local pin, same-category switching and toggle':'desktop: local hover/leave, pin switching, keyboard/blur, category navigation and separate Top cap');await c.close();
 }
 const delayed=await context(),p=await delayed.newPage();let release;
 const held=new Promise(r=>release=r);await p.route('**/site-search-index.json',async r=>{await held;return r.continue();});
 await p.goto(base+'/ai8-dna-v4?lang=en',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>document.querySelectorAll('.dna-node').length===37);
 // Click synchronously in the curated render so actionability waiting cannot
 // consume the source loader's real eight-second network timeout.
 await p.locator('.section-label[data-loop="ai8:1"]').evaluate(e=>e.click());
 const before=await p.evaluate(()=>{window.__oldNodes=[...document.querySelectorAll('.dna-node[data-project]')].map(node=>({node,id:node.dataset.project,loop:node.dataset.loop}));const label=document.querySelector('.section-label[data-loop="ai8:1"]');const first=window.__oldNodes[0];first.node.dataset.loop='stale-membership-canary';return {index:[...document.querySelectorAll('.section-label')].indexOf(label),labelTop:label.style.top,nodes:window.__oldNodes.length};});
 release();await ready(p);const selected=p.locator('.section-label[data-loop="ai8:1"]');await selected.scrollIntoViewIfNeeded();await local(p,selected);assert.equal(await selected.getAttribute('aria-pressed'),'true');
 const after=await p.evaluate(()=>{const label=document.querySelector('.section-label[data-loop="ai8:1"]');return {index:[...document.querySelectorAll('.section-label')].indexOf(label),labelTop:label.style.top,reused:window.__oldNodes.filter(x=>x.node.isConnected&&document.querySelector('[data-project="'+x.id+'"]')===x.node).length,moved:window.__oldNodes.filter(x=>x.loop!==x.node.dataset.loop).length,stale:[...document.querySelectorAll('[data-loop="stale-membership-canary"]')].length};});
 assert.ok(after.index>before.index,'same physical ID survives shifting global loop index');assert.notEqual(after.labelTop,before.labelTop);assert.equal(after.reused,before.nodes);assert.equal(after.stale,0,'membership refreshed on reused buttons');
 await p.setViewportSize({width:390,height:1100});await local(p,selected);assert.equal(await selected.getAttribute('aria-pressed'),'true');
 report.cases.push({delayedCatalogue:{before,after,pinnedLoop:'ai8:1',resizeRetainsPin:true}});await p.screenshot({path:out+'/late-catalogue-pin.png'});await delayed.close();
 const canvas=await context();await canvas.addInitScript(recordCanvas);const q=await canvas.newPage();await q.goto(base+'/ai8-dna-v4?lang=en');await ready(q);
 report.cases.push({canvas:[await canvasLocality(q,'cfh:2'),await canvasLocality(q,'top:1')]});await canvas.close();
 const guides=await context(),g=await guides.newPage();let modelPosts=0,guideRequests=0;
 g.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/.netlify/functions/mdlxdcc-guide')){guideRequests++;if(r.method()==='POST')modelPosts++;}});
 await g.goto(base+'/ai8-dna-v4?lang=en');await ready(g);const positions=await g.locator('.dna-node').evaluateAll(es=>es.map(e=>[e.style.left,e.style.top]));
 await g.locator('#lab-toggle').click();await g.locator('#lab-input-gpt').fill('Retain this public draft');const second=g.locator('.section-label[data-loop="cfh:2"]');await second.hover();await local(g,second);await g.locator('#lab-close').click();await g.locator('#lab-toggle').click();assert.equal(await g.locator('#lab-input-gpt').inputValue(),'Retain this public draft');assert.deepEqual(await g.locator('.dna-node').evaluateAll(es=>es.map(e=>[e.style.left,e.style.top])),positions);
 const digest=g.locator('.lab-panel[data-provider=gpt] .lab-digest');await digest.locator('summary').click();await digest.locator('.lab-project').click();await g.waitForFunction(()=>document.querySelector('.lab-highlight')?.dataset.record==='ai8-dna');assert.equal(await g.locator('.lab-highlight').count(),1);const requestsBefore=guideRequests;
 await g.goto(base+'/ai8-dna-v4?mode=ai8-live');await ready(g);assert.equal(await g.locator('#lab-header').isVisible(),false);assert.equal(guideRequests,requestsBefore);const nativeLoop=g.locator('.section-label[data-loop="cfh:2"]');await nativeLoop.scrollIntoViewIfNeeded();await nativeLoop.hover();await local(g,nativeLoop);assert.equal(modelPosts,0);await g.screenshot({path:out+'/native-local-hover.png'});report.cases.push({guides:{draftRetained:true,geometryPreserved:true,registeredPublicHighlight:true,nativeLocalSelection:true,nativeRequests:0,modelPOSTs:0}});await guides.close();
 assert.deepEqual(report.errors,[]);report.status='PASS';console.log(JSON.stringify(report,null,2));
}finally{fs.writeFileSync(out+'/focused-report.json',JSON.stringify(report,null,2));await browser.close();server.close();}
