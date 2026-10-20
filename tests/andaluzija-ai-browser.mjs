// Isolated real browser/worker/crypto/CAS, deterministic provider transport. No paid calls.
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {server,extraHandlers,TEST_PASSWORD} from './andaluzija-local-server.mjs';
import {makeTravelHandler} from '../functions/andaluzija-ai.mjs';
import {makeStateHandler} from '../functions/andaluzija-state.mjs';
import {memory} from './andaluzija-local-server.mjs';
import {scriptedClient} from './andaluzija-ai-provider-fixture.mjs';
const results=[],payloads=[],receipts=[];
const check=async(name,fn)=>{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);};
const stateReader=makeStateHandler({openStore:async()=>memory});
extraHandlers.set('/.netlify/functions/andaluzija-ai',makeTravelHandler({configured:{gpt:true,claude:true},clientFactory:p=>scriptedClient(p,payloads),budgetFactory:()=>({reserve:async()=>null,settle:async()=>{}}),stateReader}));
const {chromium}=createRequire(import.meta.url)('playwright');
await mkdir('../evidence',{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.ANDALUZIJA_TEST_CHROMIUM||'/tmp/andaluzija-test-runtime/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],contexts=[];let p,b;
async function page(){const context=await browser.newContext({viewport:{width:1440,height:1000}});contexts.push(context);await context.route('https://**/*',r=>r.abort());const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',async r=>{if(r.url().includes('/.netlify/functions/andaluzija-ai')&&r.request().method()==='POST'){const data=r.request().postDataJSON();if(data.receipt)receipts.push(data.receipt);}});await page.goto(base+'/BD/O/izleti/andaluzija-2027.html');await page.waitForFunction(()=>window.AndaluzijaTripOptiV1);return page;}
async function login(page){await page.locator('#poi-password').fill(TEST_PASSWORD);await page.locator('#poi-login button').click();await page.waitForFunction(()=>AndaluzijaTripOptiV1.getContext().capabilities.write);}
async function cordoba(page){await page.selectOption('#poi-day','3');await page.selectOption('#poi-city','cordoba');await page.waitForFunction(()=>AndaluzijaTripOptiV1.getContext().selection.city==='cordoba');}
try{
 await check('sidebar initial closed / desktop / provider attribution / same page',async()=>{p=await page();assert(await p.locator('#trip-ai-panel').isHidden());await p.locator('#trip-ai-toggle').click();assert(await p.locator('#trip-ai-panel').isVisible());await p.locator('#trip-ai-close').click();await login(p);await cordoba(p);await p.locator('#trip-ai-toggle').click();await p.screenshot({path:'../evidence/ai-desktop.png'});});
 await check('GPT: real app enable -> 10s worker -> guarded apply -> encrypted CAS save -> model continuation',async()=>{
  await p.locator('#trip-ai-allow').check();await p.locator('#trip-ai-input').fill('Dodaj Palacio de Viana in preuredi oglede.');await p.locator('#trip-ai-send').click();await p.waitForFunction(()=>document.getElementById('trip-ai-status').textContent.startsWith('DeepSearch:'));await p.waitForFunction(()=>document.getElementById('trip-ai-status').textContent.startsWith('Odgovor · GPT'),{timeout:30000});
  const c=await p.evaluate(()=>AndaluzijaTripOptiV1.getContext());assert(c.stops.find(x=>x.id==='cordoba-viana').enabled);assert(c.revision>0);assert(await p.locator('#trip-ai-messages').textContent().then(t=>t.includes('Shranjeno')));assert(receipts.some(r=>r.status==='saved'));const s=await p.evaluate(()=>AndaluzijaTripOptiV1.getState());assert.equal(s.days['gpt:3:cordoba'].origin,'deep');
 });
 await check('second isolated context loads saved result; Maps links follow new order outside chat',async()=>{
  b=await page();await login(b);await cordoba(b);const a=await p.evaluate(()=>AndaluzijaTripOptiV1.getContext()),c=await b.evaluate(()=>AndaluzijaTripOptiV1.getContext());assert.deepEqual(a.stops,c.stops);await p.locator('#trip-ai-close').click();const links=await p.locator('#poi-stops .poi-stop a').evaluateAll(es=>es.map(e=>e.href));assert(links.length>=3);for(const link of links)if(link.includes('google.com/maps/'))assert.equal(new URL(link).searchParams.get('api'),'1');const v=await p.locator('#poi-stops .poi-stop').filter({hasText:'Palacio de Viana'}).locator('a').first().getAttribute('href');assert(decodeURIComponent(v).includes('Viana'));
 });
 await check('Claude uses same loaded skill and same conversation after GPT / no author rewrite',async()=>{
  await p.locator('#trip-ai-toggle').click();await p.selectOption('#trip-ai-provider','claude');await p.locator('#trip-ai-input').fill('Preuredi oglede z Viano.');await p.locator('#trip-ai-send').click();await p.waitForFunction(()=>document.getElementById('trip-ai-status').textContent.startsWith('Odgovor · Claude'),{timeout:30000});const text=await p.locator('#trip-ai-messages').textContent();assert(text.includes('GPT')&&text.includes('Claude'));assert(payloads.some(x=>x.system?.includes('Version 1.0.0')));assert(payloads.some(x=>x.instructions?.includes('Version 1.0.0')));
 });
 await check('402px no horizontal overflow / keyboard / close and reopen preserves authorised conversation',async()=>{
  const before=await p.locator('#trip-ai-messages').textContent();await p.setViewportSize({width:402,height:874});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.locator('#trip-ai-input').focus();await p.keyboard.press('Tab');await p.keyboard.press('Escape');assert(await p.locator('#trip-ai-panel').isHidden());await p.locator('#trip-ai-toggle').click();assert.equal(await p.locator('#trip-ai-messages').textContent(),before);await p.screenshot({path:'../evidence/ai-402.png'});
  await p.setViewportSize({width:402,height:540});assert(await p.locator('#trip-ai-send').evaluate(e=>e.getBoundingClientRect().bottom<=innerHeight));await p.screenshot({path:'../evidence/ai-402-keyboard-height.png'});await p.setViewportSize({width:402,height:874});
 });
 await check('duplicate request ID executes once / mismatch and conflict preserve draft; no auto overwrite',async()=>{
  // Use exported real executor against the real adapter, isolate request ID from other tests.
  await p.evaluate(async()=>{const {createTravelExecutor}=await import('./andaluzija-ai-actions.mjs');window.testExecutor=createTravelExecutor();});
  const ctx=await p.evaluate(()=>AndaluzijaTripOptiV1.getContext());const action={name:'apply_visit_changes',args:{changes:[{op:'duration',id:'cordoba-viana',minutes:75}],optimize:false,segment:0},actor:'synthetic-browser',requestId:'duplicate-ai-0001',tripId:'andaluzija-2027',selection:ctx.selection,baseRevision:ctx.revision,epoch:88,allowWrite:true};
  const both=await p.evaluate(async a=>Promise.all([testExecutor.execute(a,{epoch:88}),testExecutor.execute(a,{epoch:88})]),action);assert.equal(both[0].status,'saved');assert.deepEqual(both[0],both[1]);
  await assert.rejects(p.evaluate(async a=>testExecutor.execute({...a,args:{...a.args,changes:[{op:'duration',id:'cordoba-viana',minutes:60}]}},{epoch:88}),action));
  const stale=await b.evaluate(async()=>{const c=AndaluzijaTripOptiV1.getContext();return AndaluzijaTripOptiV1.applyChanges([{type:'patchStop',...c.selection,id:'cordoba-viana',patch:{durationMin:65}}],c.revision,'other-client-edit');});assert.equal(stale.status,'applied_local');await assert.rejects(b.evaluate(()=>AndaluzijaTripOptiV1.save()));
  assert.equal(await b.locator('#poi-status').getAttribute('data-state'),'conflict');assert.equal(await b.evaluate(()=>AndaluzijaTripOptiV1.getContext().stops.find(x=>x.id==='cordoba-viana').durationMin),65);
 });
 await check('expired server authentication clears authorised conversation and private client state',async()=>{
  await p.context().clearCookies();await p.locator('#trip-ai-close').click();await p.locator('#trip-ai-toggle').click();await p.waitForFunction(()=>!AndaluzijaTripOptiV1.getContext().capabilities.write);assert.equal(await p.locator('#trip-ai-messages').textContent(),'');await p.locator('#trip-ai-close').click();await login(p);await cordoba(p);await p.locator('#trip-ai-toggle').click();await p.locator('#trip-ai-allow').check();
 });
 await check('lock during worker / late SSE discarded / conversation and private marker absent from plain cache',async()=>{
  await p.locator('#trip-ai-input').fill('Preuredi oglede z Viano.');await p.locator('#trip-ai-send').click();await p.waitForFunction(()=>!document.getElementById('poi-cancel').hidden);await p.evaluate(()=>document.getElementById('poi-lock').click());await p.waitForTimeout(500);assert.equal(await p.locator('#trip-ai-messages').textContent(),'');assert.equal(await p.locator('#trip-ai-input').inputValue(),'');assert.equal(await p.locator('#trip-ai-preview').textContent(),'');
  const content=await p.evaluate(()=>({html:document.body.innerText,cache:JSON.stringify({...localStorage})}));assert(!content.html.includes('SYNTHETIC_PRIVATE_MARKER'));assert(!content.cache.includes('SYNTHETIC_PRIVATE_MARKER'));assert(!content.cache.includes('Palacio de Viana'));await p.waitForTimeout(1000);assert.equal(await p.locator('#trip-ai-messages').textContent(),'');
 });
 await check('fixed events, variants, gallery, font controls, no JavaScript errors',async()=>{
  assert.equal(await p.locator('.variant-card').count(),3);assert.equal(await p.locator('#photo-gallery button').count(),21);await p.locator('#trip-ai-close').click();await p.locator('#font-plus').click();assert.equal(await p.locator('#font-reset').textContent(),'110%');assert.deepEqual(errors,[]);
 });
}catch(error){console.error(error);await writeFile('../evidence/ai-browser-error.txt',String(error.stack||error));throw error;}finally{
 await writeFile('../evidence/ai-browser-results.json',JSON.stringify({results,receipts,payloadCount:payloads.length,errors,fixture:'deterministic providers; isolated memory CAS and synthetic key; actual browser and 10s DeepSearch'},null,2));await browser.close();await new Promise(r=>server.close(r));
}
