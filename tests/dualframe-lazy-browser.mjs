import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';
const root=path.resolve(new URL('..',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'));
const base='https://dualframe.test',app=base+'/public/Nara/dualframe-lab/';
const browser=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
const results=[];
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({serviceWorkers:'block',viewport:mobile?{width:393,height:852}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?3:1,userAgent:mobile?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1':undefined});
  // No authenticated requests, generations, private photos or vendor calls in this smoke.
  await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin===base){if(u.pathname==='/seed.html')return route.fulfill({body:'<!doctype html><title>Isolated migration fixture</title>',contentType:'text/html'});try{const file=path.resolve(root,'.'+decodeURIComponent(u.pathname)+(u.pathname.endsWith('/')?'index.html':''));if(!file.startsWith(root+path.sep))throw Error('PATH');return route.fulfill({body:await readFile(file),contentType:file.endsWith('.mjs')||file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'application/json'});}catch{return route.fulfill({status:404,body:'not found'});}}if(u.pathname.endsWith('/capabilities'))return route.fulfill({json:{models:[],providers:[]}});return route.abort();});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/seed.html');
  const seed=await page.evaluate(async()=>{
   const make=async(w,h,color)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,w,h);return new Promise(r=>c.toBlob(r,'image/png'));};
   const landscape=await make(800,450,'#4777ad'),portrait=await make(450,800,'#cc9955'),hash=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await b.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');
   const lh=await hash(landscape),ph=await hash(portrait),db=await new Promise((resolve,reject)=>{const r=indexedDB.open('bd-dualframe-lab-v1',1);r.onupgradeneeded=()=>{r.result.createObjectStore('pairs',{keyPath:'pair_id'});r.result.createObjectStore('scores',{keyPath:'comparison_id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   const p={schema:'bd.dualframe.pair.v1',pair_id:'df_native_fixture',created_at:new Date().toISOString(),original:{blob:landscape,normalized:landscape,sha256:lh,filename:'fixture.png',mime:'image/png',bytes:landscape.size,width:800,height:450,source_orientation:'landscape',visibility:'private'},variants:{landscape:{hd:{blob:landscape,sha256:lh,width:800,height:450,path:'L.png',origin:'original'}},portrait:{hd:{blob:portrait,sha256:ph,width:450,height:800,path:'P.png',origin:'imported'}}},jobs:[],references:[],comparison_seed:'fixture-seed'};
   await new Promise((resolve,reject)=>{const tx=db.transaction('pairs','readwrite');tx.objectStore('pairs').put(p);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});db.close();return {lh,ph};
  });
  console.log('BROWSER_SEED',mobile);await page.goto(app);console.log('BROWSER_APP',mobile,await page.locator('#notice').textContent());await page.waitForFunction(()=>document.querySelectorAll('#own-gallery .gallery-artwork').length===1);
  console.log('BROWSER_GALLERY',mobile);await page.locator('#own-gallery .card-image').click();await page.waitForFunction(()=>document.querySelector('#viewer-image').naturalWidth>0);
  if(mobile){const full=await page.locator('#fullscreen').boundingBox(),stage=await page.locator('#viewer-stage').boundingBox();assert.ok(full.x+full.width<=393&&full.y+full.height<=stage.y,'all toolbar controls stay inside viewport and above image');await page.screenshot({path:path.join(root,'browser-evidence','mobile-viewer-before.png')});console.log('MOBILE_BUTTONS',await page.locator('#viewer-swap').boundingBox(),await page.locator('#viewer-floating-close').boundingBox());}console.log('BROWSER_VIEWER',mobile);const before=await page.locator('#viewer-image').getAttribute('data-orientation');await page.locator('#viewer-swap').click();await page.waitForFunction(prior=>document.querySelector('#viewer-image').dataset.orientation!==prior&&document.querySelector('#viewer-image').naturalWidth>0,before);
  const other=await page.locator('#viewer-image').getAttribute('data-orientation');assert.notEqual(other,before);
  const downloadEvent=page.waitForEvent('download');await page.locator('#download-original').click();const originalDownload=await downloadEvent;assert.equal(originalDownload.suggestedFilename(),'fixture.png');
  await page.locator(mobile?'#viewer-floating-close':'#viewer-close').click();await page.waitForFunction(()=>!document.querySelector('#viewer').open);
  await page.locator('#own-gallery .card-controls button').filter({hasText:'Rename'}).click();await page.locator('#rename-input').fill('Native migration verified');await page.locator('#rename-save').click();
  await page.reload();await page.waitForFunction(()=>document.querySelector('#own-gallery')?.textContent.includes('Native migration verified'));
  const integrity=await page.evaluate(async()=>{const s=await import('./store.mjs?v=3.0-r4.9'),rows=await s.getPairs(),row=rows[0],blob=await s.getStoredBlob(row.original.blob),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');return {version:(await s.openStore()).version,metadata:!(row.original.blob instanceof Blob),hash};});
  assert.equal(integrity.version,2);assert.equal(integrity.metadata,true);assert.equal(integrity.hash,seed.lh);
  await page.locator('#settings-open').click();for(const delay of ['0','0.5','1'])await page.locator('#settings-delay').selectOption(delay);await page.locator('#settings-save').click();
  const quick=await page.locator('#delay-quick').inputValue();assert.equal(quick,'1');
  if(mobile){await page.setViewportSize({width:852,height:393});await page.locator('#own-gallery .card-image').click();await page.waitForFunction(()=>document.querySelector('#viewer-image').dataset.orientation==='landscape');await page.locator('#viewer-close').click();}
  // App shell should launch with the local library when external reference/API calls are unavailable.
  assert.deepEqual(errors,[]);
  const dir=path.join(root,'browser-evidence');await mkdir(dir,{recursive:true});await page.screenshot({path:path.join(dir,mobile?'mobile.png':'desktop.png'),fullPage:false});
  results.push({device:mobile?'Windows Chrome iPhone-layout emulation':'Windows Chrome desktop',migration:'PASS',hash:seed.lh,metadata_only:true,orientation_swap:'PASS',download:'PASS',rename_reload:'PASS',delay:'PASS',page_errors:errors});await context.close();
 }
 await writeFile(path.join(root,'browser-evidence','receipt.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
