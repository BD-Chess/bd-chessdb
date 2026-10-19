// Actual Chromium acceptance for the passwordless public CMarvel preview.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {FIRST_PAGE_PANELS,sourceRect} from '../public/Nara/dualframe-lab/cmarvel-01/first-page.mjs';

const repo=fileURLToPath(new URL('..',import.meta.url));
const publicRoot=path.join(repo,'public');
const prefix='/Nara/dualframe-lab/';
const base=prefix+'cmarvel-01/';
const out=path.join(repo,'browser-evidence/cmarvel-public');
await mkdir(out,{recursive:true});
const checks={},errors=[],requests=[];
const sha=value=>createHash('sha256').update(value).digest('hex');
const manifestBytes=await readFile(path.join(publicRoot,base.slice(1),'manifest.json'));
const manifest=JSON.parse(manifestBytes);
const releaseBytes=await readFile(path.join(publicRoot,prefix.slice(1),'release.json'));
const release=JSON.parse(releaseBytes);
assert.equal(sha(manifestBytes),release.comic_preview.manifest_sha256);

const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-background-networking']});
const context=await browser.newContext({viewport:{width:402,height:874},hasTouch:true,serviceWorkers:'block'});
const page=await context.newPage();
const server=http.createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  requests.push({path:pathname,method:req.method});
  assert.equal(req.method,'GET');
  const relative=pathname.replace(/^\//,'');
  const file=path.resolve(publicRoot,relative,pathname.endsWith('/')?'index.html':'');
  assert.ok(file.startsWith(publicRoot+path.sep));
  const data=pathname===prefix+'release.json'?releaseBytes:pathname===base+'manifest.json'?manifestBytes:await readFile(file);
  const ext=path.extname(file);
  const mime={'.html':'text/html','.mjs':'text/javascript','.json':'application/json','.webp':'image/webp'};
  res.writeHead(200,{'content-type':mime[ext]||'application/octet-stream','cache-control':'no-store'});
  res.end(data);
 }catch{res.writeHead(404);res.end('missing');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(()=>{
 window.previewUrls=new Set();
 const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
 URL.createObjectURL=blob=>{const url=create(blob);window.previewUrls.add(url);return url;};
 URL.revokeObjectURL=url=>{window.previewUrls.delete(url);return revoke(url);};
});
const ready=()=>page.waitForFunction(()=>document.querySelector('#reader')?.dataset.ready==='true'&&document.querySelector('#comic-page')?.complete&&document.querySelector('#comic-page')?.naturalWidth>0);
const dims=()=>page.locator('#comic-page').evaluate(image=>[image.naturalWidth,image.naturalHeight]);
const state=()=>page.locator('#reader').evaluate(reader=>({page:reader.dataset.page,panel:reader.dataset.panel}));
try{
 await page.goto(origin+base);
 await ready();
 assert.equal(await page.locator('#passphrase').count(),0);
 assert.equal(await page.locator('#gate-form').count(),0);
 assert.equal(await page.locator('#lock').count(),0);
 assert.equal(await page.locator('#reader').isVisible(),true);
 assert.deepEqual(await dims(),[1584,2816]);
 assert.equal((await state()).page,'1');
 assert.equal((await state()).panel,FIRST_PAGE_PANELS[0].id);
 checks.reader_opens_directly_without_password='PASS';

 await page.locator('#overview').click();
 await ready();
 assert.deepEqual(await dims(),[2812,2160]);
 assert.equal(await page.locator('#hotspots .hotspot').count(),6);
 checks.source_overview_and_six_hotspots='PASS';

 for(let i=0;i<6;i++){
  await page.locator('#panel-choices button').nth(i).click();
  await ready();
  assert.equal((await state()).panel,FIRST_PAGE_PANELS[i].id);
  assert.deepEqual(await dims(),[1584,2816]);
  await page.locator('#landscape').click();
  await ready();
  assert.deepEqual(await dims(),[2816,1584]);
  await page.locator('#source-toggle').click();
  await ready();
  assert.deepEqual(await dims(),sourceRect(0,i).slice(2));
  await page.locator('#source-toggle').click();
  await ready();
  assert.deepEqual(await dims(),[2816,1584]);
  assert.ok(await page.evaluate(()=>window.previewUrls.size)<=2);
 }
 checks.all_six_public_pairs_and_source_crop_dimensions='PASS';

 await page.locator('#overview').click();
 await ready();
 await page.locator('#hotspots .hotspot').nth(2).click();
 await ready();
 assert.equal((await state()).panel,FIRST_PAGE_PANELS[2].id);
 assert.deepEqual(await dims(),[1584,2816]);
 checks.overview_hotspot_opens_matching_candidate='PASS';

 await page.setViewportSize({width:874,height:402});
 await page.locator('#fullscreen').click();
 assert.equal(await page.locator('#immersive-exit').isVisible(),true);
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#immersive-exit').isVisible(),false);
 assert.equal((await state()).panel,FIRST_PAGE_PANELS[2].id);
 checks.rotation_and_immersive_view='PASS';

 await page.setViewportSize({width:402,height:874});
 await page.locator('#comic-page').dblclick();
 assert.equal(await page.locator('#immersive-exit').isVisible(),true);
 await page.locator('#comic-page').dblclick();
 assert.equal(await page.locator('#immersive-exit').isVisible(),false);
 checks.double_click_enters_and_returns='PASS';

 const point=await page.locator('#comic-page').evaluate(image=>{const box=image.getBoundingClientRect();return {x:box.x+box.width/2,y:box.y+box.height/2};});
 const tap=async()=>page.touchscreen.tap(point.x,point.y);
 await tap();await page.waitForTimeout(80);await tap();await page.locator('#immersive-exit').waitFor();await page.locator('#immersive-exit').click();
 checks.touch_double_tap_and_reachable_exit='PASS';

 await page.reload();
 await ready();
 assert.equal((await state()).panel,FIRST_PAGE_PANELS[2].id);
 checks.reader_position_resumes_without_a_password='PASS';

 await page.locator('#page-select').selectOption('10');
 await ready();
 assert.equal((await state()).page,'11');
 assert.equal(await page.locator('#next').isEnabled(),false);
 assert.equal(await page.locator('#panel-controls').isVisible(),false);
 assert.deepEqual(await dims(),[3840,2160]);
 checks.original_pages_and_last_page_limit='PASS';

 assert.equal(await page.evaluate(()=>Object.values(localStorage).some(value=>/password|passphrase/i.test(value))),false);
 assert.ok(requests.every(request=>request.method==='GET'));
 assert.ok(requests.every(request=>new URL(request.path,'http://localhost').pathname===request.path));
 assert.deepEqual(errors,[]);
 checks.no_password_storage_external_requests_or_browser_errors='PASS';

 await page.goto(origin+base);
 await ready();
 await page.locator('#page-select').selectOption('0');
 await ready();
 await page.locator('#panel-choices button').nth(2).click();
 await ready();
 await page.screenshot({path:path.join(out,'phone-panel.png'),fullPage:true});
 await readFile(path.join(out,'phone-panel.png'));
 const evidence={checks,source:'public CMarvel R&D preview',password_required:false,review_status:manifest.art_review.status,errors};
 const {writeFile}=await import('node:fs/promises');
 await writeFile(path.join(out,'checks.json'),JSON.stringify(evidence,null,2));
 console.log(JSON.stringify({checks,groups:Object.keys(checks).length}));
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
