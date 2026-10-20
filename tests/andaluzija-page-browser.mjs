// Actual local Chromium/UI, synthetic owner, deterministic GPT/Claude. Never calls paid providers.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {server,extraHandlers,TEST_PASSWORD,memory} from './andaluzija-local-server.mjs';
import {makeTravelHandler} from '../functions/andaluzija-ai.mjs';
import {makeAuthHandler} from '../functions/mdlxdcc-guide-auth.mjs';
import {readSession,accessError} from '../functions/lib/mdlxdcc-guide/access.mjs';
import {scriptedClient} from './andaluzija-ai-provider-fixture.mjs';
const evidence=process.env.ANDALUZIJA_EVIDENCE_DIR||'../navigation-evidence',results=[],payloads=[],errors=[],writes=[];
await mkdir(evidence,{recursive:true});
extraHandlers.set('/.netlify/functions/andaluzija-ai',makeTravelHandler({configured:{gpt:true,claude:true},clientFactory:p=>scriptedClient(p,payloads,{name:'show_page_section',args:{section:'zemljevid',day:null}},'Prikazal sem vgrajeni zemljevid.'),budgetFactory:()=>({reserve:async()=>null,settle:async()=>{}}),stateReader:()=>{throw Error('NO_STORAGE_FOR_NAV');}}));
extraHandlers.set('/.netlify/functions/mdlxdcc-guide-auth',makeAuthHandler({auth:async req=>{const a=readSession(req);if(!a)throw accessError('AUTH_REQUIRED',401);return a;},login:async(action,email,password)=>{if(password!==TEST_PASSWORD)throw accessError('INVALID_LOGIN',401);return {id:'synthetic-account',email,role:'owner'};},usage:async()=>({exempt:true})}));
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.ANDALUZIJA_TEST_CHROMIUM||'/tmp/andaluzija-test-runtime/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const visible=async(page,id)=>page.locator('#'+id).evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,viewport:innerHeight,visible:r.bottom>130&&r.top<innerHeight-40};});
try{
 for(const width of [1440,900,402]){
  const context=await browser.newContext({viewport:{width,height:900}});await context.route('https://**/*',r=>r.abort());const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.method()!=='GET'&&!r.url().includes('guide-auth')&&!r.url().includes('andaluzija-ai')&&!r.url().includes('andaluzija-auth'))writes.push(r.url());});
  await p.goto(base+'/BD/O/izleti/andaluzija-2027.html');await p.waitForFunction(()=>window.AndaluzijaTripOptiV1);await p.locator('#trip-ai-toggle').click();await p.waitForSelector('#trip-ai-auth:not([hidden])');
  await p.locator('#trip-ai-email').fill('synthetic@example.invalid');await p.locator('#trip-ai-password').fill(TEST_PASSWORD);await p.locator('#trip-ai-auth-submit').click();await p.waitForFunction(()=>document.getElementById('trip-ai-status').textContent.startsWith('Javni mestni predlogi'));
  const c=await p.evaluate(()=>AndaluzijaTripOptiV1.getContext());assert.equal(c.capabilities.write,false);
  const before=payloads.length;
  await p.locator('#trip-ai-input').fill('premakni mi HTML stran na mesto kjer je zemljevid');await p.locator('#trip-ai-send').click();await p.waitForFunction(()=>document.getElementById('trip-ai-status').textContent==='Prikazano · brez klica AI');
  assert((await visible(p,'zemljevid')).visible);assert.equal(payloads.length,before);assert.equal(await p.locator('#trip-ai-panel').isHidden(),width<1100);assert(await p.locator('#trip-ai-page-result').textContent().then(x=>x.includes('Zemljevid')));
  await p.locator('#trip-ai-return').click();assert(await p.locator('#trip-ai-messages').textContent().then(x=>x.includes('premakni mi HTML')));
  await p.locator('#trip-ai-input').fill('Pokaži 4. dan');await p.locator('#trip-ai-send').click();await p.waitForFunction(()=>document.getElementById('trip-ai-page-result').textContent.includes('dan 4'));assert((await visible(p,'dan-4')).visible);await p.locator('#trip-ai-return').click();
  await p.locator('#trip-ai-input').fill('Pokaži proračun');await p.locator('#trip-ai-send').click();await p.waitForFunction(()=>document.getElementById('trip-ai-page-result').textContent.includes('ostaja zaklenjen'));assert((await visible(p,'proracun')).visible);assert.equal(await p.locator('#proracun').getAttribute('class'),'section private-placeholder');await p.locator('#trip-ai-return').click();
  for(const provider of ['gpt','claude']){
   await p.selectOption('#trip-ai-provider',provider);await p.locator('#trip-ai-input').fill('Ali lahko pokažeš zemljevid na tej strani?');await p.locator('#trip-ai-send').click();await p.waitForFunction(provider=>document.getElementById('trip-ai-status').textContent.startsWith('Odgovor · '+provider),provider==='gpt'?'GPT':'Claude');
   assert((await visible(p,'zemljevid')).visible);assert.equal(await p.locator('#trip-ai-panel').isHidden(),width<1100);await p.locator('#trip-ai-return').click();assert(await p.locator('#trip-ai-messages').textContent().then(x=>x.includes('Prikazal sem vgrajeni zemljevid')));
  }
  assert.deepEqual(await p.evaluate(()=>AndaluzijaTripOptiV1.getContext()),c);assert.equal(memory.data,null);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(width===402)await p.screenshot({path:evidence+'/navigation-402-public.png'});
  await p.locator('#trip-ai-account-action').click();await p.waitForFunction(()=>document.getElementById('trip-ai-status').textContent.startsWith('Odjavljena'));assert.equal(await p.locator('#trip-ai-messages').textContent(),'');assert(await p.locator('#trip-ai-page-notice').isHidden());
  results.push({width,status:'PASS',commands:['literal map without AI call','day 4','locked budget placeholder','GPT tool map','Claude tool map'],targetVisibility:true,conversationPreserved:true,unchangedPlanner:true});
  console.log('PASS navigation UI '+width+'px');await context.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
}finally{await writeFile(evidence+'/navigation-browser-results.json',JSON.stringify({results,errors,writes,providerFixtureCalls:payloads.length,paidCalls:0,scope:'local real browser, synthetic auth, deterministic providers'},null,2));await browser.close();await new Promise(r=>server.close(r));}
