// Bounded portrait regression: synthetic Maps; no providers, owner login or plan writes.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {server} from './andaluzija-local-server.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');
const output='corrections-release-evidence';await mkdir(output,{recursive:true});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.ANDALUZIJA_TEST_CHROMIUM||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const result={status:'STARTED',providerCalls:0,modelCalls:0,privateWrites:0,views:[],errors:[]};
try{
 const context=await browser.newContext({viewport:{width:402,height:874},isMobile:true,hasTouch:true});
 await context.route('https://**/*',r=>r.abort());
 const page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));
 await page.addInitScript(()=>{
  Element.prototype.requestFullscreen=undefined;
  class Map{constructor(){}setMapTypeId(){}setZoom(){}getZoom(){return 7;}panTo(){}}
  window.google={maps:{Map,event:{trigger(){}},importLibrary:async name=>{if(name==='maps')return {Map};throw Error('NO_PROVIDER_ALLOWED');}}};
 });
 await page.goto(base+'/BD/O/izleti/andaluzija-2027.html');await page.waitForSelector('#photo-gallery[data-dualframe-ready="true"]');
 const pad=sel=>page.locator(sel).evaluate(e=>parseFloat(getComputedStyle(e).paddingTop));
 assert.equal(await pad('.topbar'),18);
 await page.screenshot({path:output+'/portrait-page.png'});result.views.push('page: one 18px row when Safari has already reserved the status area');
 for(const id of ['potrjeno','nacrti','zemljevid','primerjava','dnevi','najini-ogledi','vodic','prakticno','leti-kritja','proracun','slike']){
  await page.locator('.jump-nav a[href="#'+id+'"]').click();
  assert(await page.locator('#trip-ai-toggle').isVisible());
  assert.equal(await page.locator('.topbar').evaluate(e=>Math.round(e.getBoundingClientRect().top)),0);
 }
 result.views.push('all eleven section tabs: sticky header visible');
 await page.locator('#trip-ai-toggle').click();assert.equal(await pad('#trip-ai-panel'),18);await page.locator('#trip-ai-close').click();
 await page.locator('[data-map-view="satellite"]').click();await page.waitForFunction(()=>document.querySelector('#map-status').textContent==='Satelit + ceste');
 await page.locator('#map-expand').click();
 const status=await page.locator('#map-status').boundingBox(),views=await page.locator('.map-views').boundingBox();
 assert(status.y>=views.y+views.height,'status has a full row, never a side column');assert(status.width>350);assert(status.height<25);
 assert((await page.locator('#map-host').boundingBox()).height>650);
 await page.screenshot({path:output+'/portrait-map.png'});result.views.push('fullscreen map: short full-width status; map keeps more than 650px height');
 await page.locator('#map-ai').click();const sheet=await page.locator('#trip-ai-panel').boundingBox();assert(sheet.y>150);assert(sheet.y+sheet.height<=875);await page.locator('#trip-ai-close').click();await page.locator('#map-expand').click();
 await page.locator('[data-df-open="0"]').click();assert.equal(await pad('.df-viewer-top'),18);assert(await page.locator('[data-df-close]').isVisible());
 await page.screenshot({path:output+'/portrait-album.png'});result.views.push('album: one safe row above close and navigation controls');
 await page.locator('[data-df-full]').click();assert.equal(await page.locator('.df-viewer-top').isVisible(),false);await page.locator('.df-viewer-stage').dblclick();assert(await page.locator('[data-df-close]').isVisible());await page.locator('[data-df-close]').click();
 result.views.push('photo-only fullscreen and double-tap return unchanged');
 // Simulate the same effective inset Safari exposes in edge-to-edge mode.
 await page.addStyleTag({content:':root{--trip-safe-top:59px!important}'});
 assert.equal(await pad('.topbar'),59);await page.locator('#trip-ai-toggle').click();assert.equal(await pad('#trip-ai-panel'),59);await page.locator('#trip-ai-close').click();
 await page.locator('[data-df-open="0"]').click();assert.equal(await pad('.df-viewer-top'),59);await page.locator('[data-df-close]').click();
 await page.locator('#map-expand').click();assert.equal(await pad('#trip-map-card'),59);await page.locator('#map-expand').click();result.views.push('59px edge-to-edge inset: page, AI, album and map reserve it once');
 await page.setViewportSize({width:852,height:402});assert.equal(await pad('.topbar'),10);await page.locator('[data-df-open="0"]').click();assert.equal(await pad('.df-viewer-top'),4);await page.locator('[data-df-close]').click();result.views.push('landscape topbar and album retain their original 10px / 4px padding');
 assert.deepEqual(result.errors,[]);result.status='PORTRAIT_CORRECTIONS_PASSED';
}catch(e){result.status='PORTRAIT_CORRECTIONS_FAILED';result.failure=e.message;process.exitCode=1;}
finally{await browser.close();await new Promise(r=>server.close(r));await writeFile(output+'/portrait-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));}
