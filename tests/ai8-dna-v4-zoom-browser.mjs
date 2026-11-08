import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const out=path.resolve(process.env.DNA_ZOOM_EVIDENCE||'/tmp/ai8-dna-v4-zoom');fs.mkdirSync(out,{recursive:true});
const root=path.resolve('public'),baseline=process.env.DNA_ZOOM_SOURCE||'CURRENT';
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+name);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{const bytes=baseline==='CURRENT'?fs.readFileSync(file):execFileSync('git',['show',baseline+':public'+name],{maxBuffer:10000000,stdio:['ignore','pipe','ignore']});res.setHeader('Content-Type',({'.mjs':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html'})[path.extname(name)]||'application/octet-stream');res.end(bytes);}catch{res.writeHead(404).end();}
});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
const report={source:baseline,engine:'Chromium',physicalIPhoneSafari:false,models:[],errors:[],external:[]};
async function init({safari}){
 if(safari){
  // Explicit Safari-coordinate regression model, not a physical Safari claim.
  Object.defineProperty(window,'scrollY',{configurable:true,get:()=>visualViewport.pageTop});
  Object.defineProperty(window,'scrollX',{configurable:true,get:()=>visualViewport.pageLeft});
  Object.defineProperty(window,'innerHeight',{configurable:true,get:()=>visualViewport.height});
  visualViewport.addEventListener('resize',()=>window.dispatchEvent(new Event('resize')));
  visualViewport.addEventListener('scroll',()=>window.dispatchEvent(new Event('scroll')));
 }
 const p=CanvasRenderingContext2D.prototype,begin=p.beginPath,move=p.moveTo,line=p.lineTo,bezier=p.bezierCurveTo,stroke=p.stroke,clear=p.clearRect;
 window.__dnaStrokes=[];
 p.beginPath=function(...a){this.__path=[];return begin.apply(this,a);};
 p.moveTo=function(x,y){this.__point={x,y};return move.call(this,x,y);};
 p.lineTo=function(x,y){if(this.__point)this.__path.push([this.__point,{x,y}]);this.__point={x,y};return line.call(this,x,y);};
 p.bezierCurveTo=function(...a){if(this.__point)this.__path.push([this.__point,{x:a[4],y:a[5]}]);return bezier.apply(this,a);};
 p.stroke=function(...a){if(this.canvas.id==='dna-canvas'&&(Math.abs(this.lineWidth-1.1)<.01||Math.abs(this.lineWidth-1.2)<.01)){const t=this.getTransform();for(const [p,q] of this.__path)window.__dnaStrokes.push({cap:Math.abs(this.lineWidth-1.2)<.01,a:t.transformPoint(p).toJSON(),b:t.transformPoint(q).toJSON()});}return stroke.apply(this,a);};
 p.clearRect=function(...a){if(this.canvas.id==='dna-canvas')window.__dnaStrokes=[];return clear.apply(this,a);};
}
async function capture(page,model,name){
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const state=await page.evaluate(()=>{
  const c=document.querySelector('#dna-canvas'),r=c.getBoundingClientRect(),v=visualViewport;
  const map=p=>({x:r.left+p.x*r.width/c.width,y:r.top+p.y*r.height/c.height});
  const all=window.__dnaStrokes.map(s=>({cap:s.cap,a:map(s.a),b:map(s.b)})),lines=all.filter(s=>!s.cap);
  const visible=p=>p.x>=v.offsetLeft&&p.x<=v.offsetLeft+v.width&&p.y>=v.offsetTop&&p.y<=v.offsetTop+v.height;
  function distance(p,s){const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,t=Math.max(0,Math.min(1,((p.x-s.a.x)*dx+(p.y-s.a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-s.a.x-t*dx,p.y-s.a.y-t*dy);}
  const anchors=[...document.querySelectorAll('.dna-node:not(.origin) .nucleus')].map(n=>{const r=n.getBoundingClientRect();return {id:n.parentElement.dataset.project,x:r.x+r.width/2,y:r.y+r.height/2};}).filter(visible).map(p=>({...p,error:Math.min(...lines.map(l=>distance(p,l)))}));
  const labels=[...document.querySelectorAll('.section-label')].map(n=>{const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};}).filter(visible).map(p=>{const xs=lines.filter(l=>p.y>=Math.min(l.a.y,l.b.y)&&p.y<=Math.max(l.a.y,l.b.y)).map(l=>l.a.x+(l.b.x-l.a.x)*(p.y-l.a.y)/(l.b.y-l.a.y));return {...p,error:xs.length?Math.abs(p.x-(Math.min(...xs)+Math.max(...xs))/2):Infinity};});
  const o=document.querySelector('#dna-origin').getBoundingClientRect(),origin={x:o.x+o.width/2,y:o.y+o.height/2};
  return {visual:{scale:v.scale,left:v.offsetLeft,top:v.offsetTop,pageLeft:v.pageLeft,pageTop:v.pageTop,width:v.width,height:v.height},canvas:{position:getComputedStyle(c).position,rect:r.toJSON(),width:c.width,height:c.height},anchors,labels,originError:visible(origin)?Math.min(...all.filter(l=>l.cap).map(l=>Math.hypot(origin.x-l.a.x,origin.y-l.a.y))):null,maxError:anchors.length?Math.max(...anchors.map(p=>p.error)):null,docHeight:document.documentElement.scrollHeight};
 });
 model.steps.push({name,...state});fs.writeFileSync(path.join(out,model.name+'-'+name+'.json'),JSON.stringify(state,null,2)+'\n');await page.screenshot({path:path.join(out,model.name+'-'+name+'.png')});
 if(name!=='real-two-contact-pinch')assert.ok(state.anchors.length>0,name+' must measure visible DOM nuclei against rendered strokes');
 if(state.anchors.length)assert.ok(state.maxError<.5,model.name+' '+name+' stroke/DOM error '+state.maxError);
 else state.measurement='No nucleus in this sampled visual tile; DOM/stroke assertions run at explicit scale 2, pan and scroll.';
 assert.ok(Math.abs(state.canvas.rect.left-state.visual.left)<.1&&Math.abs(state.canvas.rect.top-state.visual.top)<.1,'actual canvas tile follows the panned visual viewport');
 for(const label of state.labels)assert.ok(label.error<.5,name+' central label remains between actual backbones');
 if(state.originError!==null)assert.ok(state.originError<.01,'origin anchors the rendered top cap');
 assert.equal(state.canvas.position,'absolute');
 assert.ok(state.canvas.width*state.canvas.height<=393*852*4+4000,'canvas buffer stays viewport bounded at every zoom');
 return state;
}
async function gesture(cdp,points,moves){
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
 for(const touchPoints of moves){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints});await new Promise(r=>setTimeout(r,25));}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
try{
 for(const safari of [false,true]){
  const model={name:safari?'safari-coordinate-model':'chromium-native',safariCoordinateModel:safari,steps:[]};report.models.push(model);
  const context=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:3,isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():(report.external.push(r.request().url()),r.abort()));await context.addInitScript(init,{safari});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base+'/ai8-dna-v4.html?lang=sl');await page.waitForFunction(()=>document.querySelectorAll('.dna-node').length===488);
  const normal=await capture(page,model,'scale-1');assert.equal(normal.visual.scale,1);
  const initial=await page.locator('#dna-canvas').evaluate(c=>c.toDataURL());
  const hash=s=>createHash('sha256').update(s).digest('hex');
  if(!safari){
   // Compare actual raster output, not the geometry helper: original pitch,
   // cap, phase, backbones and rungs must all match the frozen v3 first view.
   const v3=await context.newPage();await v3.goto(base+'/ai8-dna-v3.html?lang=sl');await v3.waitForFunction(()=>document.querySelectorAll('.dna-node').length===480);await v3.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));
   assert.equal(hash(initial),hash(await v3.locator('#dna-canvas').evaluate(c=>c.toDataURL())),'initial strand raster equals original v3');
   model.initialStrandMatchesV3=true;model.rasterSHA256=createHash('sha256').update(initial).digest('hex');await v3.close();
  }
  const cdp=await context.newCDPSession(page);
  // First exercise an exact 1 -> 2 -> 1 cycle and the upper cap. These
  // explicit browser-scale controls are recorded separately from native input.
  await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});await page.waitForFunction(()=>visualViewport.scale===2);
  const cap=await capture(page,model,'controlled-scale-2-upper-cap');assert.notEqual(cap.originError,null);
  await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});await page.waitForFunction(()=>visualViewport.scale===1);await capture(page,model,'controlled-back-to-1');
  // Real two-contact input must change scale and offsets; a no-op gesture fails.
  await gesture(cdp,[{x:146,y:350,id:1},{x:246,y:350,id:2}],Array.from({length:8},(_,i)=>[{x:146-(i+1)*6,y:350,id:1},{x:246+(i+1)*6,y:350,id:2}]));
  await page.waitForFunction(()=>visualViewport.scale>1.5);const pinch=await capture(page,model,'real-two-contact-pinch');assert.ok(pinch.visual.left>0&&pinch.visual.top>0);
  await gesture(cdp,[{x:240,y:500,id:1}],Array.from({length:8},(_,i)=>[{x:240-(i+1)*10,y:500-(i+1)*15,id:1}]));
  const pan=await capture(page,model,'real-zoomed-pan');assert.ok(pan.visual.left>0&&pan.visual.top>0,'zoomed pan must have nonzero offsets');
  await page.evaluate(()=>scrollTo(0,1100));const scroll=await capture(page,model,'real-zoomed-scroll');assert.ok(scroll.visual.pageTop>1000);assert.ok(scroll.visual.left>0&&scroll.visual.top>0);
  await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:2});await page.waitForFunction(()=>visualViewport.scale===2);await capture(page,model,'controlled-scale-2-after-pan');
  await cdp.send('Emulation.setPageScaleFactor',{pageScaleFactor:1});await page.waitForFunction(()=>visualViewport.scale===1);await capture(page,model,'back-to-scale-1');
  await page.evaluate(()=>scrollTo(0,0));
  const positions=await page.locator('.dna-node').evaluateAll(es=>es.map(e=>[e.style.left,e.style.top]));
  await page.keyboard.press('Control+k');for(let i=0;i<10;i++)await page.locator('[aria-label="Večje besedilo"]').click();await page.keyboard.press('Escape');
  assert.deepEqual(await page.locator('.dna-node').evaluateAll(es=>es.map(e=>[e.style.left,e.style.top])),positions,'font sizing never changes nucleus geometry');
  await capture(page,model,'large-text');model.fontSizingPreservesAllAnchors=true;await context.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);report.status='PASS';
 fs.writeFileSync(path.join(out,'zoom-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,physicalIPhoneSafari:false,models:report.models.map(m=>({name:m.name,initialStrandMatchesV3:m.initialStrandMatchesV3,steps:m.steps.map(s=>({name:s.name,visual:s.visual,anchors:s.anchors.length,maxError:s.maxError,labels:s.labels.length,originError:s.originError}))}))},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
