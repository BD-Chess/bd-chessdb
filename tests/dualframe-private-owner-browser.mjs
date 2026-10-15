// Bounded owner acceptance: real persistent Chrome/IndexedDB/PWA + local server,
// synthetic images/password, real application routes and strictly mocked vendors.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash,randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {createService} from '../functions/lib/dualframe/service.mjs';
import {passwordVerifier} from '../functions/lib/dualframe/auth.mjs';
import {createPrivateOwnerPolicy,routeOwnerPolicy} from '../functions/lib/dualframe/private-owner-policy.mjs';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url))),sharp=createRequire(new URL('../functions/package.json',import.meta.url))('sharp');
const evidence=path.join(root,'browser-evidence','owner');await mkdir(evidence,{recursive:true});
const profiles=await mkdtemp(path.join(tmpdir(),'dualframe-owner-')),contexts=new Set(),hash=data=>createHash('sha256').update(data).digest('hex');
class Store{
 map=new Map();
 async set(k,v,{onlyIfNew=false}={}){if(onlyIfNew&&this.map.has(k))return {modified:false};this.map.set(k,Buffer.from(v));return {modified:true};}
 async setJSON(k,v,{onlyIfNew=false}={}){if(onlyIfNew&&this.map.has(k))return {modified:false};this.map.set(k,structuredClone(v));return {modified:true};}
 async get(k,{type}={}){const v=this.map.get(k);if(v===undefined)return null;if(type==='arrayBuffer'){const b=Buffer.from(v);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}return structuredClone(v);}
 async delete(k){this.map.delete(k);}
 async list({prefix}){return {blobs:[...this.map.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))};}
}
const store=new Store(),secret=randomBytes(32).toString('hex'),password='synthetic-private-owner-fixture',verifier=passwordVerifier(password);let clock=Date.now(),mockProviderCalls=0,realProviderCalls=0;
const env=key=>({DF_SESSION_SECRET:secret,DF_PASSWORD_VERIFIER:verifier,DF_OPENAI_API_KEY:'synthetic-provider-key-never-sent'})[key];
const pending=new Set(),metrics={auth:0,plans:0,enhance:0,legacyJobs:0,uploads:0,assetGets:0,manifestGets:0,cursors:0};
const output=await sharp({create:{width:64,height:48,channels:4,background:'#a8c8b7'}}).png().toBuffer();
const policy=createPrivateOwnerPolicy({store,env,now:()=>clock});let service;
service=createService({store,env,now:()=>clock,enhancementPolicy:routeOwnerPolicy(policy,null),runProvider:async job=>{mockProviderCalls++;return {bytes:output,request_id:'synthetic-mock-'+mockProviderCalls,parameters:{fixture:true,operation:job.operation},actual_cost:null};},fetcher:async()=>{realProviderCalls++;throw Error('REAL_PROVIDER_FORBIDDEN');},dispatch:async payload=>{const p=new Promise(resolve=>setTimeout(resolve,10)).then(()=>service.work(payload));pending.add(p);p.finally(()=>pending.delete(p));}});
for(let i=0;i<235;i++)await store.setJSON('titles/bd-research-owner/'+hash('pagination-'+i),{title:'Synthetic pagination '+i,updated_at:'2026-10-15T00:00:00.000Z'});
let pauseDownloads=false,downloadAllowance=3;const held=new Set();
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/df/')){
   const parts=[];for await(const p of req)parts.push(p);const body=Buffer.concat(parts),request=new Request('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body}:{})});
   if(url.pathname==='/api/df/auth'&&req.method==='POST')metrics.auth++;
   if(url.pathname==='/api/df/plans'&&req.method==='POST')metrics.plans++;
   if(url.pathname==='/api/df/enhance'&&req.method==='POST')metrics.enhance++;
   if(/\/api\/df\/(expand|generate)$/.test(url.pathname)&&req.method==='POST')metrics.legacyJobs++;
   if(url.pathname.includes('/uploads/')&&req.method==='PUT')metrics.uploads++;
   if(url.pathname==='/api/df/sync/manifest'){metrics.manifestGets++;if(url.searchParams.has('cursor'))metrics.cursors++;}
   const response=await service.handle(request),bytes=Buffer.from(await response.arrayBuffer());
   if(pauseDownloads&&url.pathname.startsWith('/api/df/assets/')&&downloadAllowance--<=0){held.add(res);res.on('close',()=>held.delete(res));return;}
   if(url.pathname.startsWith('/api/df/assets/')&&response.ok)metrics.assetGets++;
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(bytes);return;
  }
  if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
  const file=path.resolve(root,'public','.'+decodeURIComponent(url.pathname)+(url.pathname.endsWith('/')?'index.html':''));if(!file.startsWith(root+'/public/'))throw Error('PATH_INVALID');
  const data=await readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(data);
 }catch{if(!res.destroyed){res.writeHead(500);res.end('SYNTHETIC_SERVER_ERROR');}}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port,app=origin+'/Nara/dualframe-lab/';
const errors=[],checks={},receipt={status:'RUNNING',real_provider_calls:0,physical_devices:'NOT_TESTED',checks};let activePage;
const poll=async(fn,timeout=45000)=>{const start=Date.now();while(Date.now()-start<timeout){if(await fn())return;await new Promise(r=>setTimeout(r,80));}throw Error('SMOKE_POLL_TIMEOUT');};
async function context(label,mobile=false){
 const c=await chromium.launchPersistentContext(path.join(profiles,label),{executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,acceptDownloads:true,viewport:mobile?{width:402,height:874}:{width:1320,height:940},hasTouch:mobile,deviceScaleFactor:mobile?3:1,args:['--disable-background-networking','--no-sandbox']});contexts.add(c);c.setDefaultTimeout(20000);
 await c.route('**/*',route=>{const u=new URL(route.request().url());return u.origin===origin||['blob:','data:'].includes(u.protocol)?route.continue():route.abort();});
 await c.addInitScript(()=>{try{if(!localStorage.getItem('bd-dualframe-settings-v1'))localStorage.setItem('bd-dualframe-settings-v1',JSON.stringify({autoSyncMetadata:false,galleryCollection:'own',delaySeconds:1}));}catch{/* New about:blank documents have an opaque origin before navigation. */}});
 c.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));const p=await c.newPage();activePage=p;await p.goto(app,{waitUntil:'networkidle'});await p.waitForFunction(()=>document.documentElement.dataset.appReady==='true'&&document.documentElement.dataset.libraryState==='ready'&&(document.querySelector('#pair-count').textContent.startsWith('0 ')||document.querySelector('#api-toggle').textContent.includes('Lock')));return {c,p};
}
const count=(p,n)=>p.waitForFunction(n=>document.querySelector('#pair-count').textContent.startsWith(n+' '),n);
async function snapshot(p){return p.evaluate(async()=>{const d=await import('./store.mjs?v=3.0-r4.11'),out=[];for(const pair of await d.getPairs()){const b=await d.getStoredBlob(pair.original.blob),h=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await b.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');out.push({id:pair.pair_id,hash:h,source:pair.original.sha256,masters:pair.masters?.map(m=>m.sha256)||[],families:pair.enhancement_families?.map(f=>f.status)||[]});}return out.sort((a,b)=>a.source.localeCompare(b.source));});}
async function unlock(p,bad=false){await p.locator('#api-toggle').click();await p.waitForFunction(()=>document.querySelector('#api-auth').open);if(bad){await p.locator('#api-password').fill('wrong-fixture-password');await p.locator('#api-auth-form button[type=submit]').click();await p.waitForFunction(()=>document.querySelector('#api-auth-error').textContent.length>0);assert.equal(await p.locator('#api-auth').evaluate(x=>x.open),true);}await p.locator('#api-password').fill(password);await p.locator('#api-auth-form button[type=submit]').click();await p.waitForFunction(()=>!document.querySelector('#api-auth').open);await p.waitForFunction(()=>document.documentElement.dataset.libraryState==='ready'&&document.documentElement.dataset.libraryOwner==='bd-research-owner'&&(document.querySelector('#api-toggle').textContent.includes('Lock')||document.querySelector('#api-toggle').textContent.includes('Zakleni')));}
async function sync(p){const prior=await p.evaluate(async()=>{const d=await import('./store.mjs?v=3.0-r4.11');return (await d.getSyncState('sync:bd-research-owner:last-run'))?.finished_at;});await p.locator('#tab-showcase').click();await p.locator('#cloud-load').click();await poll(()=>p.evaluate(async prior=>{const d=await import('./store.mjs?v=3.0-r4.11'),v=await d.getSyncState('sync:bd-research-owner:last-run');return v?.finished_at&&v.finished_at!==prior;},prior));}
async function enhanced(p,{only=true,artistic=false,review=false}={}){clock+=60001;await p.locator('#tab-create').click();await p.locator('#mode').selectOption('smart');await p.locator('#pipeline').selectOption('openai-sunburst');await p.locator('#enhance-artistic').setChecked(artistic);await p.locator('#enhance-review').setChecked(review);const before={plans:metrics.plans,calls:mockProviderCalls,families:await p.locator('#enhancement-families article').count()};await p.locator(only?'#enhance-only':'#generate').click();await poll(()=>p.evaluate(({review,count})=>{const rows=[...document.querySelectorAll('#enhancement-families article')];return rows.length===count+1&&rows.at(-1).querySelector('p')?.textContent===(review?'MASTER_READY':'COMPLETE');},{review,count:before.families}));assert.equal(metrics.plans,before.plans+1);assert.equal(await p.locator('#enhancement-plan-dialog').count(),0);return before;}
try{
 const a=await context('desktop');await a.p.locator('#tab-create').click();assert.equal(await a.p.locator('#account-sign-in').count(),0);assert.equal(await a.p.locator('#admin-policy-open').count(),0);
 const originals=[];for(let i=0;i<101;i++)originals.push({name:'synthetic-'+i+'.png',mimeType:'image/png',buffer:await sharp({create:{width:32,height:24,channels:4,background:{r:i,g:180,b:140,alpha:1}}}).png().toBuffer()});
 // Photo-sized JPEG like the reported regression: metadata loads but preview is blank.
 originals[0]={name:'synthetic-portrait-1307x1516.jpeg',mimeType:'image/jpeg',buffer:await sharp({create:{width:1307,height:1516,channels:3,background:'#75a5c5'}}).jpeg({quality:80}).toBuffer()};
 await a.p.locator('#upload').setInputFiles(originals.slice(0,1));await count(a.p,1);
 await a.p.locator('#source-preview').scrollIntoViewIfNeeded();
 await poll(()=>a.p.evaluate(()=>{const img=document.querySelector('#source-preview');return img?.getAttribute('src')?.startsWith('blob:')&&img.complete&&img.naturalWidth===1307&&img.naturalHeight===1516;}),15000);
 checks.jpg_original_visible_immediately_after_import='PASS';
 await a.p.locator('#upload').setInputFiles(originals.slice(1,21));await count(a.p,21);assert.equal(metrics.auth,0);assert.equal(metrics.plans,0);assert.equal(mockProviderCalls,0);assert.equal(await a.p.locator('#api-auth').evaluate(x=>x.open),false);
 await a.p.locator('#upload').setInputFiles(originals.slice(21,100));await count(a.p,100);await a.p.locator('#upload').setInputFiles(originals[100]);await a.p.waitForFunction(()=>document.querySelector('#notice').textContent.includes('100'));await count(a.p,100);await a.p.locator('#upload').setInputFiles(originals[20]);await count(a.p,100);checks.local_import_21_100_101_dedupe_without_auth='PASS';
 const local=await snapshot(a.p);assert.equal(local.length,100);assert.ok(local.every(x=>x.hash===x.source));await a.p.reload({waitUntil:'networkidle'});await count(a.p,100);assert.deepEqual(await snapshot(a.p),local);
 await a.p.locator('#tab-create').click();await a.p.locator('#source-preview').scrollIntoViewIfNeeded();
 await poll(()=>a.p.evaluate(()=>{const img=document.querySelector('#source-preview');return img?.getAttribute('src')?.startsWith('blob:')&&img.complete&&img.naturalWidth>0;}),15000);
 checks.imported_preview_survives_reload='PASS';checks.locked_reload_100_raw_hashes='PASS';
 await unlock(a.p,true);await count(a.p,100);assert.deepEqual(await snapshot(a.p),local);const auth=metrics.auth;await a.p.reload({waitUntil:'networkidle'});await count(a.p,100);assert.equal(metrics.auth,auth);checks.password_once_preserved_local_owner_collection='PASS';
 const b=await context('phone',true);await unlock(b.p);await count(b.p,0);await sync(a.p);
 pauseDownloads=true;await b.p.locator('#cloud-load').click();await poll(()=>held.size>0);await b.p.locator('#sync-pause').click();pauseDownloads=false;for(const r of held)r.destroy();await b.p.reload({waitUntil:'networkidle'});await sync(b.p);await count(b.p,100);assert.deepEqual(await snapshot(b.p),await snapshot(a.p));assert.ok(metrics.cursors>0);const transfers={up:metrics.uploads,down:metrics.assetGets};await sync(a.p);await sync(b.p);assert.deepEqual({up:metrics.uploads,down:metrics.assetGets},transfers);checks.two_profiles_100_full_sync_pause_resume_noop_pagination='PASS';
 const before=await enhanced(a.p);assert.equal(mockProviderCalls-before.calls,1);await a.p.reload({waitUntil:'networkidle'});await count(a.p,100);assert.equal(metrics.auth,auth+1);assert.equal(mockProviderCalls-before.calls,1);checks.one_click_enhance_only_no_replay_on_reload='PASS';
 // Use the same source for a fresh artistic family and both orientations.
 const pair=await enhanced(a.p,{only:false,artistic:true});assert.equal(mockProviderCalls-pair.calls,3);const state=await snapshot(a.p);assert.ok(state.some(x=>x.families.includes('COMPLETE')&&x.masters.length));checks.artistic_pair_same_master_and_original_hashes='PASS';
 const callsBeforeSync=mockProviderCalls;await sync(a.p);await sync(b.p);assert.deepEqual(await snapshot(b.p),state);assert.equal(mockProviderCalls,callsBeforeSync);checks.enhanced_families_and_frames_full_sync_without_generation='PASS';
 // Back up through the real UI, restore into profile B after removing only
 // its disposable synthetic fixtures. No cloud deletion or provider replay.
 await a.p.locator('#tab-create').click();await a.p.locator('details.technical > summary').click();const event=a.p.waitForEvent('download');await a.p.locator('#bundle-export').click();const download=await event,file=path.join(profiles,'small-backup.json');await download.saveAs(file);
 activePage=b.p;await b.p.evaluate(async()=>{const d=await import('./store.mjs?v=3.0-r4.11');for(const p of await d.getPairs())await d.removePair(p.pair_id);});await b.p.reload({waitUntil:'networkidle'});await count(b.p,0);await b.p.locator('#tab-create').click();await b.p.locator('#backup-import').setInputFiles(file);await count(b.p,100);const restored=await snapshot(b.p);assert.deepEqual(restored.map(x=>x.hash),state.map(x=>x.hash));assert.ok(restored.some(x=>x.families.includes('RESTORED')));checks.backup_UI_restore_100_hashes_and_no_paid_reactivation='PASS';
 for(const [label,p]of [['desktop',a.p],['402px',b.p]]){
  activePage=p;await p.locator('#settings-open').click();assert.equal(await p.locator('#settings-delay').inputValue(),'1');assert.equal(await p.locator('#settings-enhance-tier option[value=free]').evaluate(x=>x.disabled),true);assert.equal(await p.locator('#settings-enhance-tier').inputValue(),'premium');await p.screenshot({path:path.join(evidence,label+'-settings.png')});await p.locator('#settings-close').click();await p.locator('#language').click();assert.equal(await p.locator('html').getAttribute('lang'),'sl');await p.locator('#tab-showcase').click();await p.locator('#own-gallery .card-image').first().click();await p.waitForFunction(()=>document.querySelector('#viewer-image').naturalWidth>0);await p.locator('#viewer-swap').click();await p.waitForFunction(()=>document.querySelector('#viewer-image').naturalWidth>0);await p.screenshot({path:path.join(evidence,label+'-viewer.png')});await p.locator(label==='402px'?'#viewer-floating-close':'#viewer-close').click();await p.locator('#language').click();checks[label+'_SL_EN_settings_delay_gallery_LP']='PASS';
 }
 // Persistent profile restart + actual cached app offline. Cached photo pixels
 // are served from IndexedDB; no anonymous private network reads are possible.
 await a.p.evaluate(async()=>{await navigator.serviceWorker.ready;});await a.c.close();contexts.delete(a.c);const again=await context('desktop');await count(again.p,100);assert.deepEqual((await snapshot(again.p)).map(x=>x.hash),local.map(x=>x.hash));await again.c.setOffline(true);await again.p.reload({waitUntil:'domcontentloaded'});await count(again.p,100);checks.persistent_restart_and_actual_offline_PWA='PASS';await again.c.setOffline(false);
 // Compare freezes and aggregates two supported models, without a second gate.
 clock+=60001;await again.p.locator('#tab-compare').click();await again.p.locator('#compare-task').selectOption('smart');const currentPlans=metrics.plans;await again.p.locator('#bench-generate').click();await poll(()=>metrics.plans===currentPlans+2&&pending.size===0,60000);await poll(()=>again.p.locator('#bench-generate').isEnabled());assert.equal(await again.p.locator('#enhancement-plan-dialog').count(),0);assert.match(await again.p.locator('#bench-status').textContent(),/6/);checks.compare_one_click_frozen_two_models_call_ceiling='PASS';
 assert.deepEqual(errors,[]);assert.equal(realProviderCalls,0);await Promise.all(pending);Object.assign(receipt,{status:'PASS',metrics,mock_provider_calls:mockProviderCalls,real_provider_calls:realProviderCalls,page_errors:errors,original_hashes:local.map(x=>x.hash),scope:'synthetic owner password, persistent Chrome, real app/service routes; no external vendor generation or private BD photos'});
 await writeFile(path.join(evidence,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({status:'PASS',checks:Object.keys(checks).length,metrics,mock_provider_calls:mockProviderCalls,real_provider_calls:0}));
}catch(error){receipt.status='FAIL';receipt.error=error.message;receipt.metrics=metrics;receipt.mock_provider_calls=mockProviderCalls;receipt.page_errors=errors;receipt.ui=await activePage?.evaluate(()=>({notice:document.querySelector('#notice')?.textContent,count:document.querySelector('#pair-count')?.textContent,owner:document.documentElement.dataset.libraryOwner,state:document.documentElement.dataset.libraryState})).catch(()=>null);await writeFile(path.join(evidence,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');await activePage?.screenshot({path:path.join(evidence,'failure.png')}).catch(()=>{});throw error;}
finally{for(const r of held)r.destroy();for(const c of contexts)await c.close();await new Promise(r=>server.close(r));await rm(profiles,{recursive:true,force:true});}
