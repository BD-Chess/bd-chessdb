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
let providerCalls=0,forbiddenCalls=0;
const service=createService({store,env:key=>key==='DF_SESSION_SECRET'?secret:null,
 runProvider:async()=>{providerCalls++;throw Error('BROWSER_SMOKE_PROVIDER_FORBIDDEN');},
 fetcher:async()=>{forbiddenCalls++;throw Error('BROWSER_SMOKE_EXTERNAL_FORBIDDEN');},
 dispatch:async()=>{forbiddenCalls++;throw Error('BROWSER_SMOKE_DISPATCH_FORBIDDEN');}});
// Force three manifest pages without turning the browser smoke into a large decode test.
// The separate engine test exercises a library of more than 200 image records.
for(let i=0;i<235;i++)await store.setJSON(`titles/${owner}/${hash(Buffer.from('synthetic-title-'+i))}`,{title:'Synthetic pagination '+i,updated_at:'2026-10-15T00:00:00.000Z'});

const metrics={assetGets:0,assetBytes:0,uploadChunks:0,uploadBytes:0,manifestGets:0,cursorGets:0,maxManifestRecords:0,jobWrites:0};
let gateDownloads=false,gateAllowance=0;const held=new Set();
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname.startsWith('/api/df/')){
   const parts=[];for await(const part of req)parts.push(part);const bytes=Buffer.concat(parts);
   const request=new Request('http://127.0.0.1'+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:bytes}:{})});
   if(/\/(expand|generate|model-probe)(\/|$)/.test(url.pathname)||url.pathname.includes('/jobs/'))metrics.jobWrites++;
   if(url.pathname==='/api/df/sync/manifest'){metrics.manifestGets++;if(url.searchParams.has('cursor'))metrics.cursorGets++;}
   if(req.method==='PUT'&&/\/uploads\/.+\/\d+$/.test(url.pathname)){metrics.uploadChunks++;metrics.uploadBytes+=bytes.length;}
   const response=await service.handle(request),body=Buffer.from(await response.arrayBuffer());
   if(url.pathname==='/api/df/sync/manifest'&&response.ok)metrics.maxManifestRecords=Math.max(metrics.maxManifestRecords,JSON.parse(body).total_records||0);
   const send=()=>{if(res.destroyed)return;if(req.method==='GET'&&url.pathname.startsWith('/api/df/assets/')&&response.ok){metrics.assetGets++;metrics.assetBytes+=body.length;}res.writeHead(response.status,Object.fromEntries(response.headers));res.end(body);};
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
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===origin||url.protocol==='blob:'||url.protocol==='data:')return route.continue();externalRequests.push(url.origin);return route.abort();});
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
 const disk=await import('./store.mjs?v=3.0-r4.10'),pairs=await disk.getPairs(),digest=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',await b.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const result=[];
 for(const pair of pairs){const assets=[];async function visit(value,path=[],parent=null){if(disk.isBlobReference(value)||value instanceof Blob){const blob=await disk.getStoredBlob(value),sha256=await digest(blob);if(path.at(-1)==='blob'&&parent.sha256&&parent.sha256!==sha256)throw Error('FIXTURE_DECLARED_HASH_MISMATCH');assets.push({path:path.join('.'),sha256,size:blob.size});return;}if(Array.isArray(value))for(let i=0;i<value.length;i++)await visit(value[i],[...path,i],value);else if(value&&typeof value==='object')for(const [key,item] of Object.entries(value))await visit(item,[...path,key],value);}
  await visit(pair);result.push({source:pair.original.sha256,assets:assets.sort((a,b)=>a.path.localeCompare(b.path)),jobs:pair.jobs.map(j=>({status:j.status,job_id:j.job_id})),variantHashes:Object.fromEntries(Object.entries(pair.variants).map(([d,q])=>[d,Object.fromEntries(Object.entries(q).map(([quality,asset])=>[quality,asset.sha256]))]))});}
 return {version:(await disk.openStore()).version,metadataOnly:pairs.every(p=>!(p.original.blob instanceof Blob)),pairs:result.sort((a,b)=>a.source.localeCompare(b.source))};
});
async function syncClick(page){
 const before=metrics.manifestGets,previous=await page.evaluate(async()=>{const disk=await import('./store.mjs?v=3.0-r4.10');return (await disk.getSyncState('sync:bd-research-owner:last-run'))?.finished_at||null;});
 await page.locator('#cloud-load').click();
 await page.waitForFunction(async previous=>{const disk=await import('./store.mjs?v=3.0-r4.10'),last=await disk.getSyncState('sync:bd-research-owner:last-run');return last?.finished_at&&last.finished_at!==previous;},previous);
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
 for(const [name,width,height,color] of [['lhd',640,360,'#426d9b'],['phd',360,640,'#ab753e'],['l4k',3840,2160,'#478c68'],['p4k',2160,3840,'#8866aa'],['ready',360,640,'#b25577']]){
  const bytes=await sharp({create:{width,height,channels:4,background:color}}).png().toBuffer();variants.push({name,width,height,sha256:hash(bytes),b64:bytes.toString('base64')});
 }
 await a.page.evaluate(async variants=>{
  const disk=await import('./store.mjs?v=3.0-r4.10'),pairs=await disk.getPairs();
  const asset=name=>{const v=variants.find(x=>x.name===name),bytes=Uint8Array.from(atob(v.b64),c=>c.charCodeAt(0));return {blob:new Blob([bytes],{type:'image/png'}),sha256:v.sha256,width:v.width,height:v.height,origin:'imported',provenance:'synthetic browser fixture; no provider',path:name+'.png',resolution_origin:'native',resolution_verified:true,native_4k:name.endsWith('4k')};};
  for(const [i,p] of pairs.entries()){if(i===2)continue;p.variants.landscape.hd=asset('lhd');p.variants.portrait.hd=asset('phd');if(i===0){p.variants.landscape.fourK=asset('l4k');p.variants.portrait.fourK=asset('p4k');const candidate={...asset('ready'),candidate_id:'synthetic_ready_preview',direction:'portrait',source_sha256:p.original.sha256};p.candidates=[candidate];p.jobs=[{job_id:'synthetic_ready_preview',status:'READY',provider:'synthetic',model:'fixture',target:'portrait',quality:'hd',candidate}];}await disk.putPair(p);}
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
 await b0.page.waitForFunction(async()=>{const disk=await import('./store.mjs?v=3.0-r4.10'),db=await disk.openStore();return new Promise(resolve=>{const r=db.transaction('sync').objectStore('sync').getAll();r.onsuccess=()=>resolve(r.result.filter(v=>v?.verified===true).length>=2);});});
 const beforeResume=metrics.assetGets;assert.ok(beforeResume>=2);await close(b0.context);
 gateDownloads=false;for(const res of held)res.destroy();held.clear();
 const b=await makeContext('profile-b',true);activePage=b.page;await syncClick(b.page);
 const restored=await snapshot(b.page);assert.deepEqual(restored,expected,'raw original, normalized, HD, 4K and READY preview bytes survive A → cloud → B');
 receipt.checks.interrupt_reload_resume='PASS';receipt.checks.hashes_and_saved_states='PASS';
 const beforeNoop={gets:metrics.assetGets,chunks:metrics.uploadChunks,bytes:metrics.assetBytes+metrics.uploadBytes};await syncClick(b.page);
 assert.deepEqual({gets:metrics.assetGets,chunks:metrics.uploadChunks,bytes:metrics.assetBytes+metrics.uploadBytes},beforeNoop,'repeat Sync transfers no redundant image bytes');receipt.checks.repeat_noop='PASS';

 for(const [label,page] of [['desktop',a.page],['390px',b.page]]){
  activePage=page;await page.locator('#language').click();assert.equal(await page.locator('html').getAttribute('lang'),'sl');await syncClick(page);assert.match(await page.locator('#cloud-status').textContent(),/^Usklajeno/);
  await page.locator('#settings-open').click();assert.equal(await page.locator('#settings-dialog').evaluate(el=>el.open),true);await page.locator('#settings-delay').selectOption('0');await page.locator('#settings-save').click();
  await page.locator('#own-gallery .card-image').first().click();await page.waitForFunction(()=>document.querySelector('#viewer-image').naturalWidth>0);
  const frame=await page.locator('#viewer-image').getAttribute('data-orientation');await page.locator('#viewer-swap').click();await page.waitForFunction(prior=>document.querySelector('#viewer-image').dataset.orientation!==prior&&document.querySelector('#viewer-image').naturalWidth>0,frame);
  if(label==='390px'){
   for(const id of ['#viewer-swap','#fullscreen','#viewer-floating-close']){const box=await page.locator(id).boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=391,`${id} stays within the narrow viewport`);}
  }
  const beforeMemory=await page.evaluate(()=>window.__dfSmoke.live.size);
  for(let i=0;i<9;i++){await page.locator('#next').click();await page.waitForFunction(()=>document.querySelector('#viewer-image').naturalWidth>0);const memory=await page.evaluate(()=>({urls:window.__dfSmoke.live.size,warm:window.__dfSmoke.prefetched.filter(img=>img.getAttribute('src')).length}));assert.ok(memory.warm<=2,'only previous/next prefetch images remain live');assert.ok(memory.urls<=beforeMemory+8,'viewer traversal does not accumulate unbounded blob URLs');}
  await page.screenshot({path:path.join(evidence,label+'-viewer.png')});
  await page.locator(label==='390px'?'#viewer-floating-close':'#viewer-close').click();await page.waitForFunction(()=>!document.querySelector('#viewer').open);
  await page.locator('#language').click();assert.equal(await page.locator('html').getAttribute('lang'),'en');
  receipt.checks[label+'_EN_SL_settings_LP_viewer_bounded_memory']='PASS';
 }
 assert.deepEqual(pageErrors,[],'no uncaught browser errors');assert.equal(metrics.jobWrites,0,'no image model, probe or job API called');assert.equal(providerCalls,0);assert.equal(forbiddenCalls,0);
 Object.assign(receipt,{checks:{...receipt.checks,manifest_over_200_records:'PASS',no_provider_calls:'PASS'},metrics,page_errors:pageErrors,blocked_external_origins:[...new Set(externalRequests)],raw_original_hashes:originals.map(x=>hash(x.buffer)),saved_asset_hashes:expected.pairs.flatMap(p=>p.assets.map(a=>a.sha256)),status:'PASS'});
 await writeFile(path.join(evidence,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
}catch(error){
 receipt.status='FAIL';receipt.error=error.message;receipt.metrics=metrics;receipt.page_errors=pageErrors;receipt.page_url=activePage?.url();receipt.page_body=await activePage?.locator('body').innerText().catch(()=>null);await writeFile(path.join(evidence,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 await activePage?.screenshot({path:path.join(evidence,'failure.png')}).catch(()=>{});throw error;
}finally{
 clearTimeout(watchdog);for(const context of contexts)await context.close().catch(()=>{});for(const res of held)res.destroy();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(profiles,{recursive:true,force:true});
}
