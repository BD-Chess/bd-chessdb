// Bounded owner acceptance: real persistent Chrome/IndexedDB/PWA + local server,
// synthetic images/password, real application routes and strictly mocked vendors.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash,randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {createService} from '../functions/lib/dualframe/service.mjs';
import {passwordVerifier} from '../functions/lib/dualframe/auth.mjs';
import {createPrivateOwnerPolicy,routeOwnerPolicy} from '../functions/lib/dualframe/private-owner-policy.mjs';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url))),sharp=createRequire(new URL('../functions/package.json',import.meta.url))('sharp');
const evidence=path.join(root,'browser-evidence','owner');await mkdir(evidence,{recursive:true});
const profiles=await mkdtemp(path.join(tmpdir(),'dualframe-owner-')),contexts=new Set(),hash=data=>createHash('sha256').update(data).digest('hex');
// Exercise the real released package before the working-tree update. CI must
// retain this immutable commit (checkout fetch-depth: 0), rather than inventing
// an old package by changing a version string in the new application.
const baselineCommit='6183ef4b35b50b6bc5f13b1829132b58bcf862b6',appPrefix='/Nara/dualframe-lab/';
function baselineFile(name){try{return execFileSync('git',['show',baselineCommit+':public'+appPrefix+name],{cwd:root,maxBuffer:2*1024*1024,stdio:['ignore','pipe','pipe']});}catch{throw Error('R4_15_BASELINE_COMMIT_REQUIRED_FETCH_FULL_HISTORY');}}
const baselineWorker=baselineFile('sw.js').toString('utf8'),baselineRelease=JSON.parse(baselineFile('release.json'));
assert.equal(baselineRelease.pwa.build_label,'2026-10-15-r4.15');
const baselineAssets=JSON.parse(baselineWorker.match(/const ASSETS=(\[[\s\S]*?\]);/)[1]),baselineFiles=new Map();
for(const name of new Set(['sw.js',...baselineAssets.map(asset=>asset.replace(/^\.\//,'').split('?')[0])]))baselineFiles.set(name,baselineFile(name));
let serveBaseline=true;
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
  const baselineName=url.pathname.startsWith(appPrefix)?url.pathname.slice(appPrefix.length)||'index.html':null;
  const data=serveBaseline&&baselineFiles.has(baselineName)?baselineFiles.get(baselineName):await readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(data);
 }catch{if(!res.destroyed){res.writeHead(500);res.end('SYNTHETIC_SERVER_ERROR');}}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port,app=origin+'/Nara/dualframe-lab/';
const errors=[],consoleErrors=[],resourceConsoleErrors=[],checks={},receipt={status:'RUNNING',real_provider_calls:0,physical_devices:'NOT_TESTED',checks};let activePage;
const poll=async(fn,timeout=45000)=>{const start=Date.now();while(Date.now()-start<timeout){if(await fn())return;await new Promise(r=>setTimeout(r,80));}throw Error('SMOKE_POLL_TIMEOUT');};
async function context(label,mobile=false,standalone=false){
 const c=await chromium.launchPersistentContext(path.join(profiles,label),{executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,acceptDownloads:true,viewport:mobile?{width:402,height:874}:{width:1440,height:900},hasTouch:mobile,deviceScaleFactor:mobile?3:1,args:['--disable-background-networking','--no-sandbox']});contexts.add(c);c.setDefaultTimeout(20000);
 await c.route('**/*',route=>{const u=new URL(route.request().url());return u.origin===origin||['blob:','data:'].includes(u.protocol)?route.continue():route.abort();});
 if(standalone)await c.addInitScript(()=>Object.defineProperty(navigator,'standalone',{configurable:true,value:true}));
 await c.addInitScript(()=>{try{if(!localStorage.getItem('bd-dualframe-settings-v1'))localStorage.setItem('bd-dualframe-settings-v1',JSON.stringify({autoSyncMetadata:false,galleryCollection:'own',delaySeconds:1}));}catch{/* New about:blank documents have an opaque origin before navigation. */}});
 c.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',message=>{if(message.type()==='error'){const text=message.text();(text.startsWith('Failed to load resource:')?resourceConsoleErrors:consoleErrors).push(text);}});});const p=await c.newPage();activePage=p;await p.goto(app,{waitUntil:'networkidle'});await p.waitForFunction(()=>document.documentElement.dataset.appReady==='true'&&document.documentElement.dataset.libraryState==='ready'&&(document.querySelector('#pair-count').textContent.startsWith('0 ')||document.querySelector('#api-toggle').textContent.includes('Lock')));return {c,p};
}
const count=(p,n)=>p.waitForFunction(n=>document.querySelector('#pair-count').textContent.startsWith(n+' '),n);
async function snapshot(p){return p.evaluate(async()=>{const d=await import('./store.mjs?v=3.0-r4.11'),out=[];for(const pair of await d.getPairs()){const b=await d.getStoredBlob(pair.original.blob),h=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await b.arrayBuffer()))].map(v=>v.toString(16).padStart(2,'0')).join('');out.push({id:pair.pair_id,hash:h,source:pair.original.sha256,masters:pair.masters?.map(m=>m.sha256)||[],families:pair.enhancement_families?.map(f=>f.status)||[],gallery_order:pair.gallery_order||null});}return out.sort((a,b)=>a.source.localeCompare(b.source));});}
async function photoOrder(p,container='own-gallery'){return p.locator('#'+container+' .image-action-list').evaluateAll(rows=>rows.map(row=>row.dataset.pairId));}
function photoAction(p,id,name,container='own-gallery'){return p.locator('#'+container+' .image-action-list[data-pair-id="'+id+'"]').getByRole('button',{name,exact:true});}
async function movedPhoto(p,id,name,expected){await photoAction(p,id,name).click();await poll(async()=>JSON.stringify(await photoOrder(p))===JSON.stringify(expected));}
async function unlock(p,bad=false){await p.locator('#api-toggle').click();await p.waitForFunction(()=>document.querySelector('#api-auth').open);if(bad){await p.locator('#api-password').fill('wrong-fixture-password');await p.locator('#api-auth-form button[type=submit]').click();await p.waitForFunction(()=>document.querySelector('#api-auth-error').textContent.length>0);assert.equal(await p.locator('#api-auth').evaluate(x=>x.open),true);}await p.locator('#api-password').fill(password);await p.locator('#api-auth-form button[type=submit]').click();await p.waitForFunction(()=>!document.querySelector('#api-auth').open);await p.waitForFunction(()=>document.documentElement.dataset.libraryState==='ready'&&document.documentElement.dataset.libraryOwner==='bd-research-owner'&&(document.querySelector('#api-toggle').textContent.includes('Lock')||document.querySelector('#api-toggle').textContent.includes('Zakleni')));}
async function sync(p){const prior=await p.evaluate(async()=>{const d=await import('./store.mjs?v=3.0-r4.11');return (await d.getSyncState('sync:bd-research-owner:last-run'))?.finished_at;});await p.locator('#tab-showcase').click();await p.locator('#cloud-load').click();await poll(()=>p.evaluate(async prior=>{const d=await import('./store.mjs?v=3.0-r4.11'),v=await d.getSyncState('sync:bd-research-owner:last-run');return v?.finished_at&&v.finished_at!==prior;},prior));
 // The engine saves its receipt before the app refreshes the cloud catalog and
 // gallery. Await the visible Sync completion before asserting the new DOM.
 await p.waitForFunction(()=>document.querySelector('#sync-pause').hidden);
}
async function enhanced(p,{only=true,artistic=false,review=false}={}){clock+=60001;await p.locator('#tab-create').click();await p.locator('#mode').selectOption('smart');await p.locator('#pipeline').selectOption('openai-sunburst');await p.locator('#enhance-artistic').setChecked(artistic);await p.locator('#enhance-review').setChecked(review);const before={plans:metrics.plans,calls:mockProviderCalls,families:await p.locator('#enhancement-families article').count()};await p.locator(only?'#enhance-only':'#generate').click();await poll(()=>p.evaluate(({review,count})=>{const rows=[...document.querySelectorAll('#enhancement-families article')];return rows.length===count+1&&rows.at(-1).querySelector('p')?.textContent===(review?'MASTER_READY':'COMPLETE');},{review,count:before.families}));assert.equal(metrics.plans,before.plans+1);assert.equal(await p.locator('#enhancement-plan-dialog').count(),0);return before;}
async function preservedState(p){return {originals:await snapshot(p),state:await p.evaluate(async()=>{
 const d=await import('./store.mjs?v=3.0-r4.11'),db=await d.openStore(),pairs=await d.getPairs();
 const keys=['bd-dualframe-settings-v1','bd-df-favorites','dualframe-language'],rawSession=localStorage.getItem('bd-dualframe-api-session-v3'),session=rawSession?JSON.parse(rawSession):null;
 const sessionHash=rawSession?[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(rawSession)))].map(v=>v.toString(16).padStart(2,'0')).join(''):null;
 return {database:{name:db.name,version:db.version,stores:[...db.objectStoreNames].sort(),owner:d.storageOwner()},
  labels:pairs.map(pair=>({id:pair.pair_id,label:pair.display_name||null,filename:pair.original.filename})).sort((a,b)=>a.id.localeCompare(b.id)),
  session:session?{sha256:sessionHash,fields:Object.keys(session).sort(),owner:session.owner,auth_method:session.auth_method,expires_at:session.expires_at}:null,
  local:Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]))};
})};}
async function workerPackage(p){return p.evaluate(async()=>{
 const registration=await navigator.serviceWorker.ready;return new Promise((resolve,reject)=>{
  const channel=new MessageChannel(),timer=setTimeout(()=>reject(Error('UPDATE_PACKAGE_REPLY_TIMEOUT')),6000);
  channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};
  registration.active.postMessage({type:'VERIFY_PACKAGE'},[channel.port2]);
 });
});}
async function photosShell(p,lang='en'){
 assert.equal(await p.locator('html').getAttribute('lang'),lang);
 assert.equal(await p.title(),lang==='sl'?'DualFrame Photos — Galerija · Ustvari · Primerjaj':'DualFrame Photos — Gallery · Create · Compare');
 assert.match(await p.locator('.brand').getAttribute('aria-label'),/DualFrame Photos/);
 const photos=p.locator('#product-photos'),cartoons=p.locator('#product-cartoons');
 assert.equal(await photos.getAttribute('aria-pressed'),'true');assert.equal(await cartoons.isDisabled(),false);
 const before={plans:metrics.plans,calls:mockProviderCalls,legacy:metrics.legacyJobs};
 await cartoons.focus();await p.keyboard.press('Enter');
 await p.waitForFunction(()=>window.DFCReader?.getEdition()?.panel_count===39);
 assert.equal(await p.locator('#cartoons-gallery').isVisible(),true);
 assert.equal(await p.locator('.dfc-coming button').isDisabled(),true);
 assert.equal(await p.locator('#workspace').isVisible(),false);
 await photos.click();
 assert.equal(await photos.getAttribute('aria-pressed'),'true');assert.equal(await p.locator('#cartoons-gallery').isVisible(),false);
 assert.deepEqual({plans:metrics.plans,calls:mockProviderCalls,legacy:metrics.legacyJobs},before,'product switching must not create image work');
}
async function headerLayout(p,label){
 await p.evaluate(()=>scrollTo(0,0));
 const layout=await p.evaluate(()=>{
  const rect=element=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  const header=document.querySelector('.topbar'),tabs=document.querySelector('.tabs'),selector=document.querySelector('.product-switch');
  const controls=[...header.querySelectorAll('a,button,select,[tabindex="0"]')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden';}).map(el=>({id:el.id||el.className,...rect(el)}));
  return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,header:rect(header),tabs:rect(tabs),selector:rect(selector),controls};
 });
 assert.ok(layout.scrollWidth<=layout.width+1,label+' horizontal overflow: '+JSON.stringify(layout));
 assert.ok(layout.selector.bottom<=layout.tabs.y+1,label+' product selector must stay above feature tabs');
 for(const control of layout.controls){assert.ok(control.x>=-1&&control.right<=layout.width+1,label+' clipped header control '+control.id);assert.ok(control.y>=layout.header.y-1&&control.bottom<=layout.header.bottom+1,label+' control outside header '+control.id);}
 for(let i=0;i<layout.controls.length;i++)for(let j=i+1;j<layout.controls.length;j++){
  const a=layout.controls[i],b=layout.controls[j],width=Math.min(a.right,b.right)-Math.max(a.x,b.x),height=Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y);
  assert.ok(width<=1||height<=1,label+' overlapping header controls '+a.id+' / '+b.id);
 }
 await p.screenshot({path:path.join(evidence,label+'-photos-shell.png')});return layout;
}
try{
 const a=await context('desktop',false,true);await a.p.locator('#tab-create').click();assert.equal(await a.p.locator('#account-sign-in').count(),0);assert.equal(await a.p.locator('#admin-policy-open').count(),0);assert.equal(await a.p.locator('#pwa-install').isVisible(),false);
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
 // Change real UI state while the immutable r4.15 application owns the profile.
 await a.p.locator('#tab-showcase').click();const firstCard=a.p.locator('#own-gallery .card').first();await firstCard.getByRole('button',{name:'Rename',exact:true}).click();await a.p.locator('#rename-input').fill('Pre-update synthetic original');await a.p.locator('#rename-save').click();await a.p.waitForFunction(()=>!document.querySelector('#rename-dialog').open);await a.p.locator('#own-gallery .favorite-button').first().click();
 await a.p.locator('#settings-open').click();await a.p.locator('#settings-remember-last').setChecked(true);await a.p.locator('#settings-viewer-quality').selectOption('hd');await a.p.locator('#settings-preload-adjacent').setChecked(false);await a.p.locator('#settings-save').click();
 await a.p.locator('#language').click();await a.p.locator('#language').click();
 await a.p.waitForFunction(()=>navigator.serviceWorker.controller!==null);const oldPackage=await workerPackage(a.p);assert.equal(oldPackage.ready,true);assert.equal(oldPackage.build,baselineRelease.pwa.build_label+':'+baselineRelease.pwa.offline_package_sha256);
 const retained=await preservedState(a.p);assert.equal(retained.state.database.name,'bd-dualframe-lab-v1');assert.equal(retained.state.database.version,3);assert.equal(retained.state.database.owner,'bd-research-owner');assert.ok(retained.state.labels.some(row=>row.label==='Pre-update synthetic original'));assert.equal(JSON.parse(retained.state.local['bd-df-favorites']).length,1);
 const retainedSession=retained.state.session;assert.equal(retainedSession.owner,'bd-research-owner');assert.equal(retainedSession.auth_method,'legacy-password');assert.ok(retainedSession.fields.includes('token'));assert.match(retainedSession.sha256,/^[a-f0-9]{64}$/);
 const updateCalls={auth:metrics.auth,plans:metrics.plans,provider:mockProviderCalls};serveBaseline=false;
 await a.p.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();});
 await a.p.waitForFunction(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.waiting));await a.p.locator('#pwa-update-button').waitFor({state:'visible'});
 // An installed package waits for the user's saved-update action; it must not
 // silently replace a running page or migrate this profile to another database.
 assert.match(await a.p.title(),/^DualFrame AI/);assert.deepEqual(await preservedState(a.p),retained);
 await Promise.all([a.p.waitForNavigation({waitUntil:'networkidle'}),a.p.locator('#pwa-update-button').click()]);await count(a.p,100);await a.p.waitForFunction(()=>document.documentElement.dataset.appReady==='true'&&document.documentElement.dataset.libraryState==='ready');
 assert.deepEqual(await preservedState(a.p),retained);assert.deepEqual({auth:metrics.auth,plans:metrics.plans,provider:mockProviderCalls},updateCalls);
 const newRelease=JSON.parse(await readFile(path.join(root,'public/Nara/dualframe-lab/release.json'),'utf8')),newPackage=await workerPackage(a.p);assert.equal(newPackage.ready,true);assert.equal(newPackage.build,newRelease.pwa.build_label+':'+newRelease.pwa.offline_package_sha256);assert.notEqual(newPackage.build,oldPackage.build);
 receipt.pwa_update={baseline_commit:baselineCommit,from:oldPackage.build,to:newPackage.build,originals:retained.originals.length,database:retained.state.database,session_fields:retainedSession.fields,session_owner:retainedSession.owner,session_method:retainedSession.auth_method,session_sha256:retainedSession.sha256,retained_state_sha256:hash(JSON.stringify(retained)),no_authentication_or_generation_replay:true,standalone_detection:'synthetic navigator.standalone; no physical device claim'};assert.equal(await a.p.locator('#pwa-install').isVisible(),false);
 checks.r4_15_saved_update_preserves_100_original_hashes_labels_favorites_settings_and_signed_session='PASS';
 await photosShell(a.p);await a.p.locator('#language').click();await photosShell(a.p,'sl');await a.p.locator('#language').click();checks.photos_cartoons_reader_enabled_creation_disabled_keyboard_and_SL_EN='PASS';
 const layoutEvidence=[];for(const [width,height]of [[1440,900],[402,874],[874,402],[768,1024]]){await a.p.setViewportSize({width,height});layoutEvidence.push(await headerLayout(a.p,width+'x'+height));}
 receipt.header_layouts=layoutEvidence;await a.p.setViewportSize({width:1440,height:900});checks.photos_header_four_viewports_no_overflow_or_control_overlap='PASS';
 const navigationCalls={plans:metrics.plans,provider:mockProviderCalls,legacy:metrics.legacyJobs};
 for(const suffix of ['?product=cartoons&view=cartoons#cartoons','?product=dfc#dfc']){await a.p.goto(app+suffix,{waitUntil:'networkidle'});await count(a.p,100);await photosShell(a.p);assert.equal(await a.p.locator('#tab-showcase').getAttribute('aria-pressed'),'true');}
 await a.p.evaluate(()=>{localStorage.setItem('dualframe-product','cartoons');sessionStorage.setItem('dualframe-product','cartoons');});await a.p.reload({waitUntil:'networkidle'});await count(a.p,100);await photosShell(a.p);await a.p.evaluate(()=>{localStorage.removeItem('dualframe-product');sessionStorage.removeItem('dualframe-product');});
 assert.deepEqual({plans:metrics.plans,provider:mockProviderCalls,legacy:metrics.legacyJobs},navigationCalls);assert.deepEqual(await preservedState(a.p),retained);checks.direct_URL_and_restored_cartoon_state_remain_Photos_without_generation='PASS';
 // Manual order is a metadata operation; the actual eight UI actions must be in
 // the requested order, with decorative gray pipes and the orange Delete last.
 const photoIds=await photoOrder(a.p),orderedId=photoIds[2];assert.equal(photoIds.length,100);
 const firstActions=a.p.locator('#own-gallery .image-action-list').first();
 assert.deepEqual(await firstActions.locator('button').allTextContents(),['View pair','Use as source','Rename','Move up','Move down','Move to top','Move to bottom','Delete']);
 assert.equal(await firstActions.locator('.action-separator').count(),7);assert.ok((await firstActions.locator('.action-separator').evaluateAll(rows=>rows.map(row=>getComputedStyle(row).color))).every(color=>color==='rgb(128, 128, 128)'));
 assert.equal(await firstActions.locator('.card-delete').evaluate(row=>getComputedStyle(row).color),'rgb(233, 156, 85)');assert.equal(await firstActions.locator('.card-delete').textContent(),'Delete');
 assert.equal(await photoAction(a.p,photoIds[0],'Move up').isDisabled(),true);assert.equal(await photoAction(a.p,photoIds.at(-1),'Move down').isDisabled(),true);
 const moveCalls={auth:metrics.auth,plans:metrics.plans,provider:mockProviderCalls};
 await movedPhoto(a.p,orderedId,'Move up',[photoIds[0],orderedId,photoIds[1],...photoIds.slice(3)]);
 await movedPhoto(a.p,orderedId,'Move down',photoIds);
 const topOrder=[orderedId,...photoIds.filter(id=>id!==orderedId)];await movedPhoto(a.p,orderedId,'Move to top',topOrder);
 await movedPhoto(a.p,orderedId,'Move to bottom',[...photoIds.filter(id=>id!==orderedId),orderedId]);await movedPhoto(a.p,orderedId,'Move to top',topOrder);
 const originalHashes=(await snapshot(a.p)).map(row=>row.hash);assert.deepEqual(originalHashes,local.map(row=>row.hash));
 await a.p.reload({waitUntil:'networkidle'});await count(a.p,100);assert.deepEqual(await photoOrder(a.p),topOrder);
 await a.p.locator('#tab-create').click();assert.deepEqual(await photoOrder(a.p,'gallery'),topOrder);await a.p.locator('#tab-showcase').click();
 await a.p.locator('#own-gallery .image-action-list[data-pair-id="'+orderedId+'"]').locator('xpath=..').locator('.favorite-button').click();
 const allBeforeFilter=await photoOrder(a.p);await a.p.locator('#collection-filter').selectOption('favorites');const favoriteBefore=await photoOrder(a.p);assert.equal(favoriteBefore.length,2);
 await movedPhoto(a.p,favoriteBefore[0],'Move to bottom',[favoriteBefore[1],favoriteBefore[0]]);assert.equal(await photoAction(a.p,favoriteBefore[1],'Move up').isDisabled(),true);
 await a.p.locator('#collection-filter').selectOption('own');const orderBeforeSync=await photoOrder(a.p);
 assert.deepEqual(orderBeforeSync.filter(id=>!favoriteBefore.includes(id)),allBeforeFilter.filter(id=>!favoriteBefore.includes(id)));
 const firstTitle=await a.p.locator('#own-gallery .card-title').nth(1).textContent();await a.p.locator('#own-gallery .card-image').first().click();await a.p.waitForFunction(()=>document.querySelector('#viewer-image').naturalWidth>0);await a.p.locator('#next').click();const nextPhotoId=orderBeforeSync[1];await a.p.waitForFunction(id=>{const image=document.querySelector('#viewer-image');return image.dataset.pairId===id&&image.complete&&image.naturalWidth>0;},nextPhotoId);assert.equal(await a.p.locator('#viewer-title').textContent(),firstTitle);await a.p.locator('#viewer-close').click();
 assert.deepEqual({auth:metrics.auth,plans:metrics.plans,provider:mockProviderCalls},moveCalls);checks.photo_eight_actions_gray_pipes_orange_delete_last='PASS';checks.photo_all_four_moves_reload_Create_viewer_order_and_original_hashes='PASS';checks.favorite_subset_moves_preserve_hidden_order='PASS';

 const b=await context('phone',true);await photosShell(b.p);assert.equal(await b.p.locator('#pwa-install').isVisible(),true);for(const [width,height]of [[1440,900],[402,874],[874,402],[768,1024]]){await b.p.setViewportSize({width,height});receipt.header_layouts.push(await headerLayout(b.p,'browser-'+width+'x'+height));}await b.p.setViewportSize({width:402,height:874});checks.browser_and_standalone_header_controls_four_viewports='PASS';await unlock(b.p);await count(b.p,0);await sync(a.p);
 pauseDownloads=true;await b.p.locator('#cloud-load').click();await poll(()=>held.size>0);await b.p.locator('#sync-pause').click();pauseDownloads=false;for(const r of held)r.destroy();await b.p.reload({waitUntil:'networkidle'});await sync(b.p);await count(b.p,100);assert.deepEqual(await snapshot(b.p),await snapshot(a.p));assert.ok(metrics.cursors>0);const transfers={up:metrics.uploads,down:metrics.assetGets};await sync(a.p);await sync(b.p);assert.deepEqual({up:metrics.uploads,down:metrics.assetGets},transfers);checks.two_profiles_100_full_sync_pause_resume_noop_pagination='PASS';
 assert.deepEqual(await photoOrder(b.p),await photoOrder(a.p));const bIds=await photoOrder(b.p),bTop=bIds.at(-1),phoneOrder=[bTop,...bIds.slice(0,-1)];await movedPhoto(b.p,bTop,'Move to top',phoneOrder);
 await sync(b.p);await sync(a.p);assert.deepEqual(await photoOrder(a.p),phoneOrder);assert.deepEqual(await photoOrder(b.p),phoneOrder);assert.deepEqual({up:metrics.uploads,down:metrics.assetGets},transfers);assert.deepEqual(await snapshot(b.p),await snapshot(a.p));checks.photo_order_two_way_Sync_without_retransferring_image_bytes='PASS';
 const mobileActions=b.p.locator('#own-gallery .image-action-list').first();await mobileActions.scrollIntoViewIfNeeded();const actionLayout=await mobileActions.evaluate(list=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,groupOverflow:list.scrollWidth>list.clientWidth+1,buttons:[...list.querySelectorAll('button')].map(button=>{const r=button.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};})}));assert.equal(actionLayout.groupOverflow,false);assert.ok(actionLayout.scrollWidth<=actionLayout.width+1);assert.ok(actionLayout.buttons.every(button=>button.left>=0&&button.right<=actionLayout.width+1&&button.height>=44));
 await b.p.locator('#own-gallery .card').first().screenshot({path:path.join(evidence,'402px-photo-actions.png')});await b.p.locator('#language').click();assert.deepEqual((await b.p.locator('#own-gallery .image-action-list').first().locator('[data-move]').allTextContents()),['Premakni gor','Premakni dol','Premakni na vrh','Premakni na dno']);await b.p.locator('#language').click();checks.photo_actions_402px_wrap_tap_targets_SL_EN='PASS';

 const before=await enhanced(a.p);assert.equal(mockProviderCalls-before.calls,1);await a.p.reload({waitUntil:'networkidle'});await count(a.p,100);assert.equal(metrics.auth,auth+1);assert.equal(mockProviderCalls-before.calls,1);checks.one_click_enhance_only_no_replay_on_reload='PASS';
 // Use the same source for a fresh artistic family and both orientations.
 const pair=await enhanced(a.p,{only:false,artistic:true});assert.equal(mockProviderCalls-pair.calls,3);const state=await snapshot(a.p);assert.ok(state.some(x=>x.families.includes('COMPLETE')&&x.masters.length));checks.artistic_pair_same_master_and_original_hashes='PASS';
 const callsBeforeSync=mockProviderCalls;await sync(a.p);await sync(b.p);assert.deepEqual(await snapshot(b.p),state);assert.equal(mockProviderCalls,callsBeforeSync);checks.enhanced_families_and_frames_full_sync_without_generation='PASS';
 // Back up through the real UI, restore into profile B after removing only
 // its disposable synthetic fixtures. No cloud deletion or provider replay.
 await a.p.locator('#tab-create').click();await a.p.locator('details.technical > summary').click();const event=a.p.waitForEvent('download');await a.p.locator('#bundle-export').click();const download=await event,file=path.join(profiles,'small-backup.json');await download.saveAs(file);
 activePage=b.p;await b.p.evaluate(async()=>{const d=await import('./store.mjs?v=3.0-r4.11');for(const p of await d.getPairs())await d.removePair(p.pair_id);});await b.p.reload({waitUntil:'networkidle'});await count(b.p,0);await b.p.locator('#tab-create').click();await b.p.locator('#backup-import').setInputFiles(file);await count(b.p,100);const restored=await snapshot(b.p);assert.deepEqual(restored.map(x=>x.hash),state.map(x=>x.hash));assert.ok(restored.some(x=>x.families.includes('RESTORED')));assert.deepEqual(restored.map(row=>row.gallery_order),state.map(row=>row.gallery_order));assert.deepEqual(await photoOrder(b.p,'gallery'),await photoOrder(a.p,'gallery'));checks.backup_UI_restore_100_hashes_and_no_paid_reactivation='PASS';checks.photo_order_preserved_by_private_backup_restore='PASS';
 for(const [label,p]of [['desktop',a.p],['402px',b.p]]){
  activePage=p;await p.locator('#settings-open').click();assert.equal(await p.locator('#settings-delay').inputValue(),'1');assert.equal(await p.locator('#settings-enhance-tier option[value=free]').evaluate(x=>x.disabled),true);assert.equal(await p.locator('#settings-enhance-tier').inputValue(),'premium');await p.screenshot({path:path.join(evidence,label+'-settings.png')});await p.locator('#settings-close').click();await p.locator('#language').click();await photosShell(p,'sl');await p.locator('#tab-showcase').click();await p.locator('#own-gallery .card-image').first().click();await p.waitForFunction(()=>document.querySelector('#viewer-image').naturalWidth>0);await p.locator('#viewer-swap').click();await p.waitForFunction(()=>document.querySelector('#viewer-image').naturalWidth>0);await p.screenshot({path:path.join(evidence,label+'-viewer.png')});await p.locator(label==='402px'?'#viewer-floating-close':'#viewer-close').click();await p.locator('#language').click();await photosShell(p);checks[label+'_SL_EN_settings_delay_gallery_LP']='PASS';
 }
 // Persistent profile restart + actual cached app offline. Cached photo pixels
 // are served from IndexedDB; no anonymous private network reads are possible.
 await a.p.evaluate(async()=>{await navigator.serviceWorker.ready;});await a.c.close();contexts.delete(a.c);const again=await context('desktop',false,true);await count(again.p,100);assert.deepEqual((await snapshot(again.p)).map(x=>x.hash),local.map(x=>x.hash));await again.c.setOffline(true);await again.p.reload({waitUntil:'domcontentloaded'});await count(again.p,100);await photosShell(again.p);await again.p.locator('#tab-create').click();await again.p.locator('#source-preview').scrollIntoViewIfNeeded();await poll(()=>again.p.evaluate(()=>{const image=document.querySelector('#source-preview');return image.complete&&image.naturalWidth>0&&image.getAttribute('src')?.startsWith('blob:');}));checks.persistent_restart_and_actual_offline_PWA='PASS';checks.updated_Photos_shell_and_original_pixels_survive_offline_restart='PASS';await again.c.setOffline(false);
 // Compare freezes and aggregates two supported models, without a second gate.
 clock+=60001;await again.p.locator('#tab-compare').click();await again.p.locator('#compare-task').selectOption('smart');const currentPlans=metrics.plans;await again.p.locator('#bench-generate').click();await poll(()=>metrics.plans===currentPlans+2&&pending.size===0,60000);await poll(()=>again.p.locator('#bench-generate').isEnabled());assert.equal(await again.p.locator('#enhancement-plan-dialog').count(),0);assert.match(await again.p.locator('#bench-status').textContent(),/6/);checks.compare_one_click_frozen_two_models_call_ceiling='PASS';
 assert.deepEqual(errors,[]);const unexpectedConsoleErrors=consoleErrors.filter(text=>text!=='DualFrame: PAIR_LIMIT');assert.deepEqual(unexpectedConsoleErrors,[]);assert.equal(realProviderCalls,0);await Promise.all(pending);Object.assign(receipt,{status:'PASS',metrics,mock_provider_calls:mockProviderCalls,real_provider_calls:realProviderCalls,page_errors:errors,console_errors:unexpectedConsoleErrors,expected_fixture_console_errors:consoleErrors.filter(text=>text==='DualFrame: PAIR_LIMIT'),resource_console_errors:resourceConsoleErrors,original_hashes:local.map(x=>x.hash),scope:'synthetic owner password, persistent Chrome, real app/service routes; no external vendor generation or private BD photos'});
 await writeFile(path.join(evidence,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({status:'PASS',checks:Object.keys(checks).length,metrics,mock_provider_calls:mockProviderCalls,real_provider_calls:0}));
}catch(error){receipt.status='FAIL';receipt.error=error.message;receipt.metrics=metrics;receipt.mock_provider_calls=mockProviderCalls;receipt.page_errors=errors;receipt.ui=await activePage?.evaluate(()=>({notice:document.querySelector('#notice')?.textContent,count:document.querySelector('#pair-count')?.textContent,owner:document.documentElement.dataset.libraryOwner,state:document.documentElement.dataset.libraryState})).catch(()=>null);await writeFile(path.join(evidence,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');await activePage?.screenshot({path:path.join(evidence,'failure.png')}).catch(()=>{});throw error;}
finally{for(const r of held)r.destroy();for(const c of contexts)await c.close();await new Promise(r=>server.close(r));await rm(profiles,{recursive:true,force:true});}
