// Bounded real Chromium test: synthetic Google APIs, no paid provider requests.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {server,TEST_PASSWORD} from './andaluzija-local-server.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');
const output=process.env.ANDALUZIJA_EVIDENCE_DIR||'../roads-evidence';await mkdir(output,{recursive:true});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.ANDALUZIJA_TEST_CHROMIUM||'/tmp/andaluzija-test-runtime/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],results=[];
async function fixture(page){
 await page.addInitScript(()=>{
  window.googleCalls=[];window.googleMaps=[];
  class Map{constructor(host,options){this.options=options;this.zoom=options.zoom;this.type=options.mapTypeId;googleMaps.push(this);host.textContent='Google Maps · controlled synthetic fixture';}setMapTypeId(v){this.type=v;}getMapTypeId(){return this.type;}setZoom(v){this.zoom=v;}getZoom(){return this.zoom;}panTo(p){this.center=p;}fitBounds(b){this.bounds=b;} }
  class LatLngBounds{constructor(){this.points=[];}extend(p){this.points.push(p);}isEmpty(){return !this.points.length;}}
  class Feature{constructor(o){Object.assign(this,o);}setMap(m){this.map=m;}addListener(){} }
  window.google={maps:{Map,LatLngBounds,Polyline:Feature,Marker:Feature,SymbolPath:{CIRCLE:0},event:{trigger(){}},importLibrary:async name=>{
   googleCalls.push({library:name});if(name==='maps')return {Map};
   if(name==='routes')return {RouteMatrix:{computeRouteMatrix:async p=>{googleCalls.push({matrix:p});const matrix={rows:p.origins.map((_,i)=>({items:p.destinations.map((_,j)=>({condition:'ROUTE_EXISTS',distanceMeters:i===j?0:1000+i*101+j*7,durationMillis:i===j?0:(1000+i*101+j*7)*1000}))}))};return {matrix};}},Route:{computeRoutes:async p=>{googleCalls.push({route:p});return {routes:[{path:[p.origin,...p.intermediates.map(x=>x.location),p.destination],distanceMeters:12345,durationMillis:600000,warnings:['SYNTHETIC · not for navigation']}]};}}};
   throw Error('UNEXPECTED_LIBRARY');
  }}};
  // iPhone fallback path: fullscreen wrapper, not an isolated map iframe.
  Element.prototype.requestFullscreen=undefined;
 });
}
try{
 const context=await browser.newContext({viewport:{width:402,height:874},hasTouch:true,isMobile:true});await context.route('https://**/*',r=>r.abort());const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await fixture(page);
 await page.goto(base+'/BD/O/izleti/andaluzija-2027.html');await page.waitForFunction(()=>window.AndaluzijaTripOptiV1);
 assert.equal(await page.evaluate(()=>googleCalls.length),0,'No map or paid routes on initial render');
 assert(await page.locator('.topbar').evaluate(e=>parseFloat(getComputedStyle(e).paddingTop)>=30));
 await page.locator('#map-draw').click();assert.equal(await page.evaluate(()=>googleCalls.length),0,'Consent enforced');
 await page.locator('[data-map-view="satellite"]').click();await page.waitForFunction(()=>googleMaps.length===1);assert.equal(await page.evaluate(()=>googleMaps[0].type),'hybrid');
 await page.locator('#map-provider-consent').check();await page.locator('#map-draw').click();await page.waitForFunction(()=>document.querySelector('#map-status').textContent.includes('12,3 km'));assert.equal(await page.evaluate(()=>googleCalls.filter(x=>x.route).length),3);assert(await page.evaluate(()=>googleCalls.filter(x=>x.route).every(x=>x.route.travelMode==='DRIVING'&&!x.route.optimizeWaypointOrder)));
 results.push('portrait: hybrid, explicit consent, three actual road route contracts, no background Google requests');
 await page.locator('#map-expand').click();await page.locator('#map-ai').click();assert.equal(await page.locator('#trip-ai-panel').evaluate(e=>e.parentElement.id),'trip-map-card');
 const box=await page.locator('#trip-ai-panel').boundingBox(),mapbox=await page.locator('#map-host').boundingBox();assert(box.y>150&&box.y+box.height<=875);assert(mapbox.height>=120&&mapbox.y+mapbox.height<=box.y+2,'Map remains above sheet');
 await page.locator('#trip-ai-input').fill('SYNTHETIC draft preserved');await page.locator('#trip-ai-close').click();await page.locator('#map-ai').click();assert.equal(await page.locator('#trip-ai-input').inputValue(),'SYNTHETIC draft preserved');
 await page.screenshot({path:output+'/portrait-map-ai.png'});await page.locator('#trip-ai-close').click();await page.locator('#map-expand').click();assert.equal(await page.locator('#trip-ai-panel').evaluate(e=>e.parentElement.tagName),'BODY');
 results.push('portrait: full-viewport fallback, bottom sheet, visible map, hide/reopen preserves draft, panel restored on exit');
 await page.locator('#poi-password').fill(TEST_PASSWORD);await page.locator('#poi-login button').click();await page.waitForSelector('#poi-lock:not([hidden])');
 const before=await page.evaluate(()=>AndaluzijaTripOptiV1.getContext().stops.map(x=>x.id));
 await assert.rejects(page.evaluate(()=>AndaluzijaTripOptiV1.optimizeDay()),/GOOGLE_CONSENT_REQUIRED/);
 await page.locator('#poi-provider-consent').check();const started=Date.now();const preview=await page.evaluate(()=>AndaluzijaTripOptiV1.optimizeDay());const elapsed=Date.now()-started;assert(elapsed>=4900&&elapsed<7500,'Real five-second worker deadline');assert.equal(preview.metrics.kind,'walking');assert(preview.metrics.moveMin>0);assert.equal(preview.receipt.source,'Google Maps · Routes WALKING');
 assert.deepEqual(await page.evaluate(()=>AndaluzijaTripOptiV1.getContext().stops.map(x=>x.id)),before,'Preview does not reorder stored plan');assert.equal(await page.evaluate(()=>googleCalls.filter(x=>x.matrix).length),1);
 const cancel=await page.evaluate(async()=>{const p=AndaluzijaTripOptiV1.optimizeDay();setTimeout(()=>AndaluzijaTripOptiV1.cancelOptimization(),50);try{await p;return false;}catch(e){return e.message==='CANCELLED';}});assert(cancel);assert.equal(await page.evaluate(()=>googleCalls.filter(x=>x.matrix).length),1,'RAM matrix reused');
 await page.locator('#poi-lock').click();assert.equal(await page.locator('#poi-password').inputValue(),'');assert.equal(await page.locator('#trip-ai-input').inputValue(),'');assert.equal(await page.evaluate(()=>AndaluzijaTripOptiV1.getContext().capabilities.write),false);assert.deepEqual(await page.evaluate(()=>googleMaps[0].center),{lat:37.1,lng:-4.8});assert.equal(await page.evaluate(()=>googleMaps[0].zoom),7);results.push('actual five-second solver with directed walking matrix, no mutation, cancellation, RAM reuse and lock clears bounds/camera');
 await page.setViewportSize({width:852,height:402});assert.equal(await page.locator('.topbar').evaluate(e=>getComputedStyle(e).paddingTop),'10px');await page.screenshot({path:output+'/landscape-topbar.png'});results.push('landscape topbar keeps original 10px padding');
 await context.close();
 const desktop=await browser.newContext({viewport:{width:1440,height:1000}});await desktop.route('https://**/*',r=>r.abort());const p=await desktop.newPage();p.on('pageerror',e=>errors.push(e.message));await fixture(p);await p.goto(base+'/BD/O/izleti/andaluzija-2027.html');await p.waitForFunction(()=>window.AndaluzijaTripOptiV1);await p.locator('#map-expand').click();await p.locator('#map-ai').click();const panel=await p.locator('#trip-ai-panel').boundingBox();assert(panel.x>=1000&&panel.width===420);await p.screenshot({path:output+'/desktop-map-ai.png'});results.push('desktop fullscreen AI panel is on the right');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({results,errors,providerCalls:0}));
 await writeFile(output+'/results.json',JSON.stringify({results,errors,providerCalls:0,limits:'Controlled Google fixtures; physical iPhone/Safari and live provider configuration not covered.'},null,2)+'\n');
}finally{await browser.close();await new Promise(r=>server.close(r));}
