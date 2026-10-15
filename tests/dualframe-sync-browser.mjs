// One bounded Chrome smoke: synthetic data and two disposable persistent profiles.
// Run in CI with playwright-core and CHROME_PATH=/usr/bin/google-chrome.
import assert from 'node:assert/strict';
import http from 'node:http';
import {createHash,randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {createService} from '../functions/lib/dualframe/service.mjs';
import {signToken} from '../functions/lib/dualframe/auth.mjs';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const sharp=createRequire(new URL('../functions/package.json',import.meta.url))('sharp');
const evidence=path.join(root,'browser-evidence','sync');
await mkdir(evidence,{recursive:true});
const profiles=await mkdtemp(path.join(tmpdir(),'dualframe-sync-smoke-'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
class SyntheticStore {
 map=new Map();
 async set(key,value,{onlyIfNew=false}={}){if(onlyIfNew&&this.map.has(key))return {modified:false};this.map.set(key,Buffer.from(value));return {modified:true};}
 async setJSON(key,value,{onlyIfNew=false}={}){if(onlyIfNew&&this.map.has(key))return {modified:false};this.map.set(key,structuredClone(value));return {modified:true};}
 async get(key,{type}={}){const value=this.map.get(key);if(value===undefined)return null;if(type==='arrayBuffer'){const b=Buffer.from(value);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}return structuredClone(value);}
 async delete(key){this.map.delete(key);}
 async list({prefix}){return {blobs:[...this.map.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key}))};}
}
const store=new SyntheticStore(),owner='bd-research-owner',secret=randomBytes(32).toString('hex');
const token=signToken({owner,scope:'session'},secret,3600);
const fixtureAccounts=Object.fromEntries(['browser_app_account_A','browser_app_account_B'].map(owner=>[owner,{owner,token:signToken({owner,scope:'session',auth_method:'verified-account',issuer:'https://www.mdlxdcc.org/.netlify/identity',subject:'synthetic-'+owner},secret,3600),expires_at:new Date(Date.now()+3600000).toISOString(),auth_method:'verified-account',admin:false,paid_entitlement:0,account_access:'restricted'}]));
let popupSession=null;
let providerCalls=0,forbiddenCalls=0;
const service=createService({store,env:key=>key==='DF_SESSION_SECRET'?secret:null,
 runProvider:async()=>{providerCalls++;throw Error('BROWSER_SMOKE_PROVIDER_FORBIDDEN');},
 fetcher:async()=>{forbiddenCalls++;throw Error('BROWSER_SMOKE_EXTERNAL_FORBIDDEN');},
 dispatch:async()=>{forbiddenCalls++;throw Error('BROWSER_SMOKE_DISPATCH_FORBIDDEN');}});
// Force three manifest pages without turning the browser smoke into a large decode test.
// The separate engine test exercises a library of more than 200 image records.
for(let i=0;i<235;i++)await store.setJSON(`titles/${owner}/${hash(Buffer.from('synthetic-title-'+i))}`,{title:'Synthetic pagination '+i,updated_at:'2026-10-15T00:00:00.000Z'});

const metrics={assetGets:0,assetBytes:0,uploadChunks:0,uploadBytes:0,manifestGets:0,cursorGets:0,maxManifestRecords:0,jobWrites:0,planPosts:0,enhancePosts:0,syntheticPopupHandoffs:0,heldSessionRequests:0};
let gateDownloads=false,gateAllowance=0;const held=new Set();
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname.startsWith('/api/df/')){
   const parts=[];for await(const part of req)parts.push(part);const bytes=Buffer.concat(parts);
   const request=new Request('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:bytes}:{})});
   if(/\/(expand|generate|model-probe)(\/|$)/.test(url.pathname)||url.pathname.includes('/jobs/'))metrics.jobWrites++;
   if(req.method==='POST'&&url.pathname==='/api/df/plans')metrics.planPosts++;
   if(req.method==='POST'&&url.pathname==='/api/df/enhance')metrics.enhancePosts++;
   if(url.pathname==='/api/df/sync/manifest'){metrics.manifestGets++;if(url.searchParams.has('cursor'))metrics.cursorGets++;}
   if(req.method==='PUT'&&/\/uploads\/.+\/\d+$/.test(url.pathname)){metrics.uploadChunks++;metrics.uploadBytes+=bytes.length;}
   const response=await service.handle(request),body=Buffer.from(await response.arrayBuffer());
   if(url.pathname==='/api/df/sync/manifest'&&response.ok)metrics.maxManifestRecords=Math.max(metrics.maxManifestRecords,JSON.parse(body).total_records||0);
   const send=()=>{if(res.destroyed)return;if(req.method==='GET'&&url.pathname.startsWith('/api/df/assets/')&&response.ok){metrics.assetGets++;metrics.assetBytes+=body.length;}res.writeHead(response.status,Object.fromEntries(response.headers));res.end(body);};
   if(req.method==='GET'&&url.pathname==='/api/df/session'&&url.searchParams.get('smoke_hold')==='1'){metrics.heldSessionRequests++;held.add(res);res.on('close',()=>held.delete(res));return;}
   if(gateDownloads&&req.method==='GET'&&url.pathname.startsWith('/api/df/assets/')&&gateAllowance--<=0){held.add(res);res.on('close',()=>held.delete(res));return;}
   send();return;
  }
  if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname)+(url.pathname.endsWith('/')?'index.html':''));
  if(!file.startsWith(root+path.sep))throw Error('PATH_OUTSIDE_REPOSITORY');
  const bytes=await readFile(file);res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(bytes);
 }catch(error){if(!res.destroyed){res.writeHead(500,{'content-type':'text/plain'});res.end(/^[A-Z_]+$/.test(error.message)?error.message:'SYNTHETIC_SERVER_FAILURE');}}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`,app=origin+'/public/Nara/dualframe-lab/';
const contexts=new Set(),pageErrors=[],externalRequests=[];
const makeContext=async(label,mobile=false)=>{
 const context=await chromium.launchPersistentContext(path.join(profiles,label),{executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,serviceWorkers:'block',viewport:mobile?{width:390,height:844}:{width:1280,height:900},deviceScaleFactor:mobile?3:1,hasTouch:mobile,args:['--disable-background-networking']});
 contexts.add(context);context.setDefaultTimeout(15000);
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin==='https://www.mdlxdcc.org'&&url.pathname==='/Nara/dualframe-lab/account-login.html'&&popupSession){
   // A real cross-origin popup/source/nonce event, but a synthetic identity
   // handoff. No live Identity endpoint, account or credential is involved.
   const nonce=url.searchParams.get('nonce'),target=url.searchParams.get('opener_origin');assert.equal(target,origin);assert.match(nonce,/^[a-zA-Z0-9_-]{32,128}$/);
   const payload={type:'dualframe-account-session',nonce,session:popupSession};popupSession=null;metrics.syntheticPopupHandoffs++;
   return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic account handoff</title><script>setTimeout(()=>window.opener.postMessage('+JSON.stringify(payload)+','+JSON.stringify(target)+'),40)</script>'});
  }
  if(url.origin===origin||url.protocol==='blob:'||url.protocol==='data:')return route.continue();externalRequests.push(url.origin);return route.abort();
 });
 await context.addInitScript(({token})=>{
  localStorage.setItem('bd-dualframe-api-session-v3',JSON.stringify({token,expires_at:new Date(Date.now()+3600000).toISOString()}));
  // No production sessions, passwords, photographs, provider keys or environment loading.
  if(!localStorage.getItem('bd-dualframe-settings-v1'))localStorage.setItem('bd-dualframe-settings-v1',JSON.stringify({autoSyncMetadata:false,preloadAdjacent:true,delaySeconds:0,galleryCollection:'own'}));
  const live=new Set(),originalCreate=URL.createObjectURL.bind(URL),originalRevoke=URL.revokeObjectURL.bind(URL);
  const prefetched=[];window.__dfSmoke={live,prefetched};
  URL.createObjectURL=value=>{const url=originalCreate(value);live.add(url);return url;};
  URL.revokeObjectURL=url=>{live.delete(url);return originalRevoke(url);};
  window.Image=new Proxy(Image,{construct(target,args){const image=Reflect.construct(target,args);prefetched.push(image);return image;}});
 },{token});
 context.on('page',page=>page.on('pageerror',error=>pageErrors.push(error.message)));
 const page=context.pages()[0]||await context.newPage();page.on('pageerror',error=>pageErrors.push(error.message));
 await page.goto(app,{waitUntil:'networkidle'});return {context,page};
};
const close=async context=>{await context.close();contexts.delete(context);};
const snapshot=page=>page.evaluate(async()=>{
 const disk=await import('./store.mjs?v=3.0-r4.11'),pairs=await disk.getPairs(),digest=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await b.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const result=[];
 for(const pair of pairs){const assets=[];async function visit(value,path=[],parent=null){if(disk.isBlobReference(value)||value instanceof Blob){const blob=await disk.getStoredBlob(value),sha256=await digest(blob);if(path.at(-1)==='blob'&&parent.sha256&&parent.sha256!==sha256)throw Error('FIXTURE_DECLARED_HASH_MISMATCH');assets.push({path:path.join('.'),sha256,size:blob.size});return;}if(Array.isArray(value))for(let i=0;i<value.length;i++)await visit(value[i],[...path,i],value);else if(value&&typeof value==='object')for(const [key,item] of Object.entries(value))await visit(item,[...path,key],value);}
  await visit(pair);result.push({source:pair.original.sha256,assets:assets.sort((a,b)=>a.path.localeCompare(b.path)),jobs:pair.jobs.map(j=>({status:j.status,job_id:j.job_id})),variantHashes:Object.fromEntries(Object.entries(pair.variants).map(([d,q])=>[d,Object.fromEntries(Object.entries(q).map(([quality,asset])=>[quality,asset.sha256]))]))});}
 return {version:(await disk.openStore()).version,metadataOnly:pairs.every(p=>!(p.original.blob instanceof Blob)),pairs:result.sort((a,b)=>a.source.localeCompare(b.source))};
});
async function poll(check){const deadline=Date.now()+20000;while(Date.now()<deadline){if(await check())return;await new Promise(r=>setTimeout(r,30));}throw Error('BROWSER_PERSISTENCE_POLL_TIMEOUT');}
async function syncClick(page){
 const before=metrics.manifestGets,previous=await page.evaluate(async()=>{const disk=await import('./store.mjs?v=3.0-r4.11');return (await disk.getSyncState('sync:bd-research-owner:last-run'))?.finished_at||null;});
 await page.locator('#cloud-load').click();
 await poll(()=>page.evaluate(async previous=>{const disk=await import('./store.mjs?v=3.0-r4.11'),last=await disk.getSyncState('sync:bd-research-owner:last-run');return last?.finished_at&&last.finished_at!==previous;},previous));
 await page.waitForFunction(()=>/^(Synced|Usklajeno) ·/.test(document.querySelector('#cloud-status').textContent));
 assert.ok(metrics.manifestGets>before,'Sync actually queried the local synthetic service');
}
const receipt={schema:'dualframe.synthetic.browser-sync.v1',browser:'Linux installed Chrome, persistent isolated profiles',physical_ios:'NOT_TESTED',external_provider:'NOT_CALLED',checks:{}};
let activePage;
const watchdog=setTimeout(()=>{console.error('BROWSER_SMOKE_TIMEOUT');process.exitCode=1;for(const context of contexts)context.close().catch(()=>{});server.closeAllConnections();server.close();},175000);
try{
 const a=await makeContext('profile-a');activePage=a.page;
 const originals=await Promise.all([0,1,2].map(async i=>({name:`synthetic-original-${i}.png`,mimeType:'image/png',buffer:await sharp({create:{width:320,height:180,channels:4,background:{r:30+i*55,g:110,b:170-i*35,alpha:1}}}).png().toBuffer()})));
 await a.page.locator('#tab-create').click();await a.page.locator('#upload').setInputFiles(originals);
 await a.page.waitForFunction(()=>document.querySelectorAll('#local-gallery .card').length===3||document.querySelector('#pair-count').textContent.startsWith('3 '));
 const variants=[];
 for(const [name,width,height,color] of [['lhd',640,360,'#426d9b'],['phd',360,640,'#ab753e'],['l4k',3840,2160,'#478c68'],['p4k',2160,3840,'#8866aa'],['ready',360,640,'#b25577'],['natural-master',800,450,'#586e79'],['artistic-master',800,450,'#d5899d']]){
  const bytes=await sharp({create:{width,height,channels:4,background:color}}).png().toBuffer();variants.push({name,width,height,sha256:hash(bytes),b64:bytes.toString('base64')});
 }
 const hdCopy=await sharp(Buffer.from(variants.find(v=>v.name==='l4k').b64,'base64')).resize(1920,1080).png().toBuffer();variants.push({name:'hd-copy',width:1920,height:1080,sha256:hash(hdCopy),b64:hdCopy.toString('base64')});
 await a.page.evaluate(async variants=>{
  const disk=await import('./store.mjs?v=3.0-r4.11'),pairs=await disk.getPairs();
  const asset=name=>{const v=variants.find(x=>x.name===name),bytes=Uint8Array.from(atob(v.b64),c=>c.charCodeAt(0));return {blob:new Blob([bytes],{type:'image/png'}),sha256:v.sha256,width:v.width,height:v.height,origin:'imported',provenance:'synthetic browser fixture; no provider',path:name+'.png',resolution_origin:'native',resolution_verified:true,native_4k:name.endsWith('4k')};};
  for(const [i,p] of pairs.entries()){
   if(i===2)continue;p.variants.landscape.hd=asset('lhd');p.variants.portrait.hd=asset('phd');
   if(i===0){
    p.variants.landscape.fourK=asset('l4k');p.variants.portrait.fourK=asset('p4k');
    const candidate={...asset('ready'),candidate_id:'synthetic_ready_preview',direction:'portrait',source_sha256:p.original.sha256};p.candidates=[candidate];p.jobs=[{job_id:'synthetic_ready_preview',created_at:'2026-10-15T00:00:00.000Z',mode:'smart',status:'READY',provider:'synthetic',model:'fixture',target:'portrait',quality:'hd',candidate}];
    const natural={...asset('natural-master'),source_sha256:p.original.sha256,role:'natural-master',family_id:'a'.repeat(64),acceptance:'ACCEPTED',recipe:{kind:'natural'}},artistic={...asset('artistic-master'),source_sha256:p.original.sha256,role:'artistic-master',family_id:'b'.repeat(64),acceptance:'READY',recipe:{kind:'artistic'}};
    p.masters=[natural,artistic];p.enhancement_families=[{plan_id:natural.family_id,family_id:natural.family_id,status:'COMPLETE',master:natural,plan:{recipe:{kind:'natural'},available:false}},{plan_id:artistic.family_id,family_id:artistic.family_id,status:'MASTER_READY',master:artistic,plan:{recipe:{kind:'artistic'},available:false}}];
    p.accepted_variants=[{...asset('hd-copy'),source_sha256:p.original.sha256,parent_sha256:p.variants.landscape.fourK.sha256,family_id:natural.family_id,role:'hd-derivative',acceptance:'ACCEPTED',model_calls:0,direction:'landscape',quality:'hd'}];
   }
   await disk.putPair(p);
  }
 },variants);
 const expected=await snapshot(a.page);assert.equal(expected.pairs.length,3);assert.equal(expected.version,3);assert.equal(expected.metadataOnly,true);
 await a.page.reload({waitUntil:'networkidle'});await syncClick(a.page);receipt.checks.local_import_cloud='PASS';
 assert.ok(metrics.uploadChunks>0,'local-only originals and variants uploaded');assert.ok(metrics.maxManifestRecords>200&&metrics.cursorGets>0,'real manifest pagination exceeds 200 records');

 // Stop browser B after two complete responses while later requests are held.
 // Closing and reopening the same profile proves IndexedDB checkpoints survive.
 gateDownloads=true;gateAllowance=2;
 const b0=await makeContext('profile-b',true);activePage=b0.page;
 assert.equal((await snapshot(b0.page)).pairs.length,0,'profile B starts without profile A data');
 await b0.page.locator('#cloud-load').click();
 await poll(()=>b0.page.evaluate(async()=>{const disk=await import('./store.mjs?v=3.0-r4.11'),db=await disk.openStore();return new Promise(resolve=>{const r=db.transaction('sync').objectStore('sync').getAll();r.onsuccess=()=>resolve(new Set(r.result.filter(v=>v?.verified===true).map(v=>v.asset_id).filter(Boolean)).size>=2);});}));
 await b0.page.locator('#sync-pause').click();assert.match(await b0.page.locator('#sync-pause').textContent(),/Resume/);await b0.page.locator('#sync-pause').click();assert.match(await b0.page.locator('#sync-pause').textContent(),/Pause/);receipt.checks.pause_resume_control='PASS';
 const beforeResume=metrics.assetGets;assert.ok(beforeResume>=2);await close(b0.context);
 gateDownloads=false;for(const res of held)res.destroy();held.clear();
 const b=await makeContext('profile-b',true);activePage=b.page;await syncClick(b.page);
 const restored=await snapshot(b.page);assert.deepEqual(restored,expected,'raw original, normalized, HD, 4K and READY preview bytes survive A → cloud → B');
 receipt.checks.interrupt_reload_resume='PASS';receipt.checks.hashes_and_saved_states='PASS';receipt.checks.natural_artistic_masters_families_HD_derivative_sync='PASS';
 const beforeNoop={gets:metrics.assetGets,chunks:metrics.uploadChunks,bytes:metrics.assetBytes+metrics.uploadBytes};await syncClick(b.page);
 assert.deepEqual({gets:metrics.assetGets,chunks:metrics.uploadChunks,bytes:metrics.assetBytes+metrics.uploadBytes},beforeNoop,'repeat Sync transfers no redundant image bytes');receipt.checks.repeat_noop='PASS';

 for(const [label,page] of [['desktop',a.page],['390px',b.page]]){
  activePage=page;await page.locator('#language').click();assert.equal(await page.locator('html').getAttribute('lang'),'sl');await syncClick(page);assert.match(await page.locator('#cloud-status').textContent(),/^Usklajeno/);
  const beforeControls={jobs:metrics.jobWrites,plans:metrics.planPosts,submits:metrics.enhancePosts};
  await page.locator('#settings-open').click();assert.equal(await page.locator('#settings-dialog').evaluate(el=>el.open),true);await page.locator('#settings-delay').selectOption('0');
  assert.equal(await page.locator('#settings-enhance-tier').evaluate(el=>el.tagName),'SELECT');assert.deepEqual(await page.locator('#settings-enhance-tier option').evaluateAll(nodes=>nodes.map(n=>n.value)),['free','premium']);
  // isDisabled() follows the wrapping label to the select in Playwright 1.64.1; inspect this option's actual disabled property.
  await page.locator('#settings-enhance-tier').selectOption('premium');assert.equal(await page.locator('#settings-enhance-model option[value="cloudflare-flux-free"]').evaluate(option=>option.disabled),true);await page.locator('#settings-save').click();
  await page.locator('#settings-open').click();assert.equal(await page.locator('#settings-enhance-tier').inputValue(),'premium');await page.locator('#settings-enhance-tier').selectOption('free');assert.equal(await page.locator('#settings-enhance-model').inputValue(),'cloudflare-flux-free');await page.locator('#settings-save').click();
  assert.deepEqual({jobs:metrics.jobWrites,plans:metrics.planPosts,submits:metrics.enhancePosts},beforeControls,'changing preferences does not submit a plan or call a model');
  await page.locator('#own-gallery .card-image').first().click();await page.waitForFunction(()=>document.querySelector('#viewer-image').naturalWidth>0);
  const frame=await page.locator('#viewer-image').getAttribute('data-orientation');await page.locator('#viewer-swap').click();await page.waitForFunction(prior=>document.querySelector('#viewer-image').dataset.orientation!==prior&&document.querySelector('#viewer-image').naturalWidth>0,frame);
  if(label==='390px'){
   for(const id of ['#viewer-swap','#fullscreen','#viewer-floating-close']){const box=await page.locator(id).boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=391,`${id} stays within the narrow viewport`);}
  }
  const beforeMemory=await page.evaluate(()=>window.__dfSmoke.live.size);
  for(let i=0;i<9;i++){await page.locator('#next').click();await page.waitForFunction(()=>document.querySelector('#viewer-image').naturalWidth>0);const memory=await page.evaluate(()=>({urls:window.__dfSmoke.live.size,warm:window.__dfSmoke.prefetched.filter(img=>img.getAttribute('src')).length}));assert.ok(memory.warm<=2,'only previous/next prefetch images remain live');assert.ok(memory.urls<=beforeMemory+8,'viewer traversal does not accumulate unbounded blob URLs');}
  await page.screenshot({path:path.join(evidence,label+'-viewer.png')});
  await page.locator(label==='390px'?'#viewer-floating-close':'#viewer-close').click();await page.waitForFunction(()=>!document.querySelector('#viewer').open);
  await page.locator('#tab-create').click();assert.equal(await page.locator('#enhance-natural').isChecked(),true);assert.equal(await page.locator('#enhance-artistic').isChecked(),false);
  await page.locator('#enhance-background').selectOption('studio');await page.locator('#enhance-artistic').check();assert.equal(await page.locator('#enhance-natural').isChecked(),false);assert.equal(await page.locator('#enhance-natural').isDisabled(),true);assert.equal(await page.locator('#enhance-background').inputValue(),'ai');assert.equal(await page.locator('#enhance-background').isDisabled(),true);
  await page.locator('#enhance-artistic').uncheck();assert.equal(await page.locator('#enhance-background').inputValue(),'studio');assert.equal(await page.locator('#enhance-natural').isChecked(),true);
  await page.locator('#mode').selectOption('faithful');assert.equal(await page.locator('#enhancement-controls').isHidden(),true);await page.locator('#mode').selectOption('smart');assert.equal(await page.locator('#enhancement-controls').isVisible(),true);
  await page.locator('#output-quality').selectOption('4k');assert.equal(await page.locator('#enhance-hd-copy').isDisabled(),false);await page.locator('#enhance-hd-copy').check();await page.locator('#enhance-hd-copy').uncheck();await page.locator('#output-quality').selectOption('hd');assert.equal(await page.locator('#enhance-hd-copy').isDisabled(),true);
  assert.deepEqual({jobs:metrics.jobWrites,plans:metrics.planPosts,submits:metrics.enhancePosts},beforeControls,'Natural/Artistic, background, Faithful and resolution controls have no network generation effect');
  await page.locator('#enhance-only').click();await page.waitForFunction(()=>document.querySelector('#enhancement-plan-dialog').open);
  assert.equal(await page.locator('#enhancement-plan-start').isDisabled(),true);assert.match(await page.locator('#enhancement-plan-status').textContent(),/FREE_PROVIDER_NOT_CONFIGURED/);assert.equal(metrics.enhancePosts,beforeControls.submits);assert.equal(metrics.jobWrites,beforeControls.jobs);assert.equal(metrics.planPosts,beforeControls.plans+1);
  await page.screenshot({path:path.join(evidence,label+'-enhancement-held.png')});await page.locator('#enhancement-plan-close').click();await page.locator('#tab-showcase').click();
  await page.locator('#language').click();assert.equal(await page.locator('html').getAttribute('lang'),'en');
  receipt.checks[label+'_EN_SL_settings_LP_viewer_bounded_memory']='PASS';receipt.checks[label+'_enhancement_controls_held_plan_no_generation']='PASS';
 }
 // This fixture exercises real browser IndexedDB account namespaces, without
 // pretending that a live Identity account or login has been provisioned.
 const accountStorage=await a.page.evaluate(async()=>{
  const disk=await import('./store.mjs?v=3.0-r4.11'),legacyOwner=disk.storageOwner(),legacy=await disk.getPairs(),digest=async blob=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const legacyHashes=await Promise.all(legacy.map(async p=>digest(await disk.getStoredBlob(p.original.blob))));
  const make=async text=>{const blob=new Blob([text],{type:'image/png'});return {pair_id:'account_browser_fixture',original:{sha256:await digest(blob),blob,normalized:blob},variants:{landscape:{},portrait:{}},jobs:[]};};
  const denied=async operation=>{try{await operation();return false;}catch(error){return /STORAGE_(OWNER_CHANGED|ASSET_OWNER_MISMATCH)/.test(error.message);}};
  try{
   await disk.setStorageOwner('synthetic_account_A');const cleanA=(await disk.getPairs()).length===0&&await disk.getSyncState('checkpoint')===undefined,old=disk.captureStorageScope(),pA=await make('nonpersonal account A bytes');await old.putPair(pA);await old.putSyncState('checkpoint',{account:'A',next_byte:7});const ref=(await old.getPairs())[0].original.blob;
   await disk.setStorageOwner('synthetic_account_B');const cleanB=(await disk.getPairs()).length===0&&await disk.getSyncState('checkpoint')===undefined,pB=await make('nonpersonal account B bytes');await disk.putPair(pB);await disk.putSyncState('checkpoint',{account:'B',next_byte:11});
   const rejectAReference=await denied(()=>disk.getStoredBlob(ref)),rejectOldQueue=await denied(()=>old.putSyncState('late',{account:'A'}));
   await disk.setStorageOwner('synthetic_account_A');const oldEpochRejected=await denied(()=>old.getPairs()),retainedA=await digest(await disk.getStoredBlob((await disk.getPairs())[0].original.blob))===pA.original.sha256&&(await disk.getSyncState('checkpoint')).account==='A';
   await disk.setStorageOwner('synthetic_account_B');const retainedB=await digest(await disk.getStoredBlob((await disk.getPairs())[0].original.blob))===pB.original.sha256&&(await disk.getSyncState('checkpoint')).account==='B';
   return {cleanA,cleanB,rejectAReference,rejectOldQueue,oldEpochRejected,retainedA,retainedB,legacyHashes};
  }finally{await disk.setStorageOwner(legacyOwner);}
 });
 for(const [key,value] of Object.entries(accountStorage))if(key!=='legacyHashes')assert.equal(value,true,key);
 assert.deepEqual(accountStorage.legacyHashes.sort(),originals.map(x=>hash(x.buffer)).sort());receipt.checks.browser_account_storage_isolation='PASS';receipt.identity_provider_login='NOT_TESTED';
 // Exercise the application's real auth event, API cancellation, scope change,
 // image cleanup and settings transition through synthetic popup handoffs.
 activePage=a.page;const page=a.page;
 async function signInAs(account,count){
  popupSession=fixtureAccounts[account];assert.ok(popupSession);
  if(!await page.locator('#settings-dialog').evaluate(el=>el.open))await page.locator('#settings-open').click();
  await page.locator('#account-sign-in').click();
  await poll(()=>page.evaluate(async({account,count})=>{const api=await import('./api-client.mjs?v=3.0-r4.11'),disk=await import('./store.mjs?v=3.0-r4.11');return api.sessionOwner()===account&&disk.storageOwner()===account&&!document.querySelector('#settings-dialog').open&&document.querySelector('#pair-count').textContent.startsWith(count+' ');},{account,count}));
 }
 await signInAs('browser_app_account_A',0);assert.equal(await page.locator('#own-gallery .gallery-artwork').count(),0,'legacy gallery disappears on account A activation');
 await page.locator('#settings-open').click();assert.equal(await page.locator('#settings-enhance-tier').inputValue(),'free');assert.equal(await page.locator('#settings-delay').inputValue(),'1');await page.locator('#settings-enhance-tier').selectOption('premium');await page.locator('#settings-delay').selectOption('0.5');await page.locator('#settings-save').click();
 const appFixtures=await Promise.all([['account-A.png','#259d8b'],['account-B.png','#da784a']].map(async([name,color])=>({name,mimeType:'image/png',buffer:await sharp({create:{width:160,height:90,channels:4,background:color}}).png().toBuffer()})));
 await page.locator('#tab-create').click();await page.locator('#upload').setInputFiles(appFixtures[0]);await page.waitForFunction(()=>document.querySelector('#pair-count').textContent.startsWith('1 '));
 const aRef=await page.evaluate(async()=>{const api=await import('./api-client.mjs?v=3.0-r4.11'),disk=await import('./store.mjs?v=3.0-r4.11');window.__dfOldAccountAPI=api.captureAPI();window.__dfOldAccountStore=disk.captureStorageScope();await disk.putSyncState('app-switch-checkpoint',{account:'A',next_byte:17});window.__dfPendingAccountRequest=window.__dfOldAccountAPI.request('/session?smoke_hold=1').then(()=>({resolved:true}),error=>({error:error.message}));return (await disk.getPairs())[0].original.blob;});
 await poll(()=>metrics.heldSessionRequests===1);
 await page.locator('#source-preview').scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('#source-preview').naturalWidth>0);
 const oldURLs=await page.evaluate(()=>[...window.__dfSmoke.live]);assert.ok(oldURLs.length>0,'account A has an actual decoded private image before switching');
 await signInAs('browser_app_account_B',0);assert.equal(await page.locator('#own-gallery .gallery-artwork').count(),0,'account A gallery disappears on account B activation');
 assert.equal(await page.evaluate(async()=>(await window.__dfPendingAccountRequest).error),'AUTH_SESSION_CHANGED','switch cancels an in-flight previous-account API request');
 assert.equal(await page.evaluate(urls=>urls.every(url=>!window.__dfSmoke.live.has(url)),oldURLs),true,'old decoded image URLs are released');
 const blockedAccountA=await page.evaluate(async ref=>{const disk=await import('./store.mjs?v=3.0-r4.11');const code=async fn=>{try{await fn();return 'UNEXPECTED_SUCCESS';}catch(error){return error.message;}};return {reference:await code(()=>disk.getStoredBlob(ref)),queue:await code(()=>window.__dfOldAccountStore.putSyncState('late-app-work',{})),api:await code(()=>window.__dfOldAccountAPI.request('/session')),checkpoint:await disk.getSyncState('app-switch-checkpoint')};},aRef);
 assert.equal(blockedAccountA.reference,'STORAGE_ASSET_OWNER_MISMATCH');assert.equal(blockedAccountA.queue,'STORAGE_OWNER_CHANGED');assert.equal(blockedAccountA.api,'AUTH_SESSION_CHANGED');assert.equal(blockedAccountA.checkpoint,undefined);
 await page.locator('#settings-open').click();assert.equal(await page.locator('#settings-enhance-tier').inputValue(),'free','A preference does not follow B');assert.equal(await page.locator('#settings-delay').inputValue(),'1');await page.locator('#settings-close').click();
 await page.locator('#tab-create').click();await page.locator('#upload').setInputFiles(appFixtures[1]);await page.waitForFunction(()=>document.querySelector('#pair-count').textContent.startsWith('1 '));assert.equal((await snapshot(page)).pairs[0].source,hash(appFixtures[1].buffer));
 await signInAs('browser_app_account_A',1);assert.equal((await snapshot(page)).pairs[0].source,hash(appFixtures[0].buffer),'returning A restores exact original bytes');
 const returnState=await page.evaluate(async()=>{const disk=await import('./store.mjs?v=3.0-r4.11');let stale=false;try{await window.__dfOldAccountStore.getPairs();}catch(error){stale=error.message==='STORAGE_OWNER_CHANGED';}return {stale,checkpoint:await disk.getSyncState('app-switch-checkpoint')};});assert.equal(returnState.stale,true);assert.equal(returnState.checkpoint.account,'A');
 await page.locator('#settings-open').click();assert.equal(await page.locator('#settings-enhance-tier').inputValue(),'premium');assert.equal(await page.locator('#settings-delay').inputValue(),'0.5');await page.screenshot({path:path.join(evidence,'account-app-return-A.png')});await page.locator('#settings-close').click();
 assert.equal(metrics.syntheticPopupHandoffs,3);receipt.checks.app_account_switch_gallery_preferences_URLs_API_cancel='PASS';receipt.account_handoff='SYNTHETIC_POPUP_AND_SERVER_SIGNED_FIXTURE_ONLY';
 assert.deepEqual(pageErrors,[],'no uncaught browser errors');assert.equal(metrics.jobWrites,0,'no image model, probe or job API called');assert.equal(metrics.enhancePosts,0,'held plans never submit enhancement');assert.equal(providerCalls,0);assert.equal(forbiddenCalls,0);
 Object.assign(receipt,{checks:{...receipt.checks,manifest_over_200_records:'PASS',no_provider_calls:'PASS'},metrics,page_errors:pageErrors,blocked_external_origins:[...new Set(externalRequests)],raw_original_hashes:originals.map(x=>hash(x.buffer)),saved_asset_hashes:expected.pairs.flatMap(p=>p.assets.map(a=>a.sha256)),status:'PASS'});
 await writeFile(path.join(evidence,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
}catch(error){
 receipt.status='FAIL';receipt.error=error.message;receipt.metrics=metrics;receipt.page_errors=pageErrors;receipt.page_url=activePage?.url();receipt.page_body=await activePage?.locator('body').innerText().catch(()=>null);await writeFile(path.join(evidence,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 await activePage?.screenshot({path:path.join(evidence,'failure.png')}).catch(()=>{});throw error;
}finally{
 clearTimeout(watchdog);for(const context of contexts)await context.close().catch(()=>{});for(const res of held)res.destroy();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(profiles,{recursive:true,force:true});
}
