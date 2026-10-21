// Read-only production smoke. One map load and at most one Google route request.
// No login, model calls, private unlock or shared-plan writes. No API keys logged.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('playwright');
await mkdir('roads-release-evidence',{recursive:true});
const receipt=process.env.ANDALUZIJA_AUDIT_DEPLOY?{deploy_id:process.env.ANDALUZIJA_AUDIT_DEPLOY,url:'https://www.mdlxdcc.org/bd/o/izleti/andaluzija-2027',googleRoadSmokeVerifiedOn:'6ad8f264d12d64595e64eca4'}:JSON.parse(await readFile('roads-release-evidence/receipt.json','utf8'));
const browser=await chromium.launch({headless:true,executablePath:process.env.ANDALUZIJA_TEST_CHROMIUM||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const result={deploy_id:receipt.deploy_id,anonymous:true,modelCalls:0,privateWrites:0,roadDrawAttempts:0,errors:[],csp:[],mapErrors:[]};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();
 page.on('pageerror',e=>result.errors.push(String(e.message).replace(/https?:\/\/\S+/g,'[URL]').slice(0,400)));
 page.on('console',m=>{const code=m.text().match(/(?:RefererNotAllowed|ApiNotActivated|BillingNotEnabled|InvalidKey|OverQuota|ApiTargetBlocked)MapError/);if(code)result.mapErrors.push(code[0]);});
 await page.addInitScript(()=>{window.cspViolations=[];document.addEventListener('securitypolicyviolation',e=>{let host;try{host=new URL(e.blockedURI).hostname;}catch{host=e.blockedURI;}window.cspViolations.push({directive:e.effectiveDirective,host});});});
 const response=await page.goto(receipt.url,{waitUntil:'domcontentloaded',timeout:30000});assert.equal(response.status(),200);await page.waitForFunction(()=>window.AndaluzijaTripOptiV1&&window.AndaluzijaMapV1);
 assert.equal(await page.locator('#poi-mode').inputValue(),'walking');assert.equal(await page.locator('#map-provider-consent').isChecked(),false);
 const csp=response.headers()['content-security-policy'];assert(csp.includes('https://*.googleapis.com')&&csp.includes("frame-ancestors 'none'"));
 await page.waitForSelector('#photo-gallery[data-dualframe-ready="true"]',{timeout:15000});assert.equal(await page.evaluate(()=>AndaluzijaTripOptiV1.getContext().capabilities.write),false);
 if(process.env.ANDALUZIJA_STATIC_SMOKE_ONLY){
  const r=await page.request.get(new URL('./andaluzija-map.mjs',receipt.url).href);assert.equal(r.status(),200);assert((await r.text()).includes('this.bounds=null;this.map?.panTo({lat:37.1,lng:-4.8});this.map?.setZoom(7)'));result.cameraResetAsset=true;result.googleRoadSmokeVerifiedOn=receipt.googleRoadSmokeVerifiedOn;
 }else{
 await page.locator('[data-map-view="satellite"]').click();
 await page.waitForFunction(()=>document.querySelector('#photo-map .gm-style')||document.getElementById('map-status').textContent.includes('ni dosegljiv'),null,{timeout:30000});
 assert(await page.locator('#map-host').evaluate(e=>e.classList.contains('photo-mode')),'Google basemap did not initialize');
 // Choose C only before the explicit paid Google gesture. Never retry.
 await page.locator('[data-map-toggle="mateja"]').uncheck();await page.locator('[data-map-toggle="claude"]').uncheck();
 await page.locator('#map-provider-consent').check();result.roadDrawAttempts++;await page.locator('#map-draw').click();
 await page.waitForFunction(()=>!document.getElementById('map-draw').disabled,null,{timeout:30000});const status=await page.locator('#map-status').textContent();assert(/C · GPT:.*km/.test(status),'No actual Google road geometry returned');result.googleRoadGeometry=true;
 }
 await page.locator('#map-expand').click();assert.equal(await page.evaluate(()=>document.fullscreenElement?.id),'trip-map-card');await page.locator('#map-ai').click();assert.equal(await page.locator('#trip-ai-panel').evaluate(e=>e.parentElement.id),'trip-map-card');
 const panel=await page.locator('#trip-ai-panel').boundingBox(),close=await page.locator('#map-expand').boundingBox();assert(close.x+close.width<=panel.x+2,'AI covers fullscreen exit');await page.locator('#trip-ai-close').click();await page.locator('#map-expand').click();assert.equal(await page.evaluate(()=>!!document.fullscreenElement),false);result.nativeFullscreenAI=true;
 await page.setViewportSize({width:402,height:874});assert(await page.locator('.topbar').evaluate(e=>parseFloat(getComputedStyle(e).paddingTop)>=30));result.portraitSafeArea=true;
 result.csp=await page.evaluate(()=>window.cspViolations);assert.deepEqual(result.errors,[]);assert.deepEqual(result.mapErrors,[]);assert.deepEqual(result.csp,[]);
 result.status='PRODUCTION_SMOKE_PASSED';
}catch(e){result.status='PRODUCTION_SMOKE_FAILED';result.failure=String(e.message).replace(/https?:\/\/\S+/g,'[URL]').slice(0,600);process.exitCode=1;}
finally{await browser.close();await writeFile('roads-release-evidence/live-smoke.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));}
