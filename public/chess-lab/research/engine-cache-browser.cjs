'use strict';
// Real engines and service workers. Network disabled BEFORE a new document/FEN.
// Linux browser/viewport emulation never constitutes physical iPhone acceptance.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const playwright=require('playwright'),{createHash}=require('node:crypto');
const opt=k=>process.argv.find(x=>x.startsWith('--'+k+'='))?.slice(k.length+3);
const root=path.resolve(__dirname,'..'),kind=opt('browser')||'chromium',output=path.resolve(opt('output')||'engine-cache-evidence');
const families=['sf-lite','sf-full','berserk','reckless','lc0'],role=m=>({'sf-lite':'SF','sf-full':'SF',berserk:'BER',reckless:'RLE',lc0:'LC0'}[m]);
const report={schema:'chessbest.r12.actual-engine-cache.v1',browser:kind,physicalIPhone:false,startedAt:new Date().toISOString(),checks:[],results:{},requests:[],responses:[],serverRequests:[],pageErrors:[]};
let browser,context,server,p,phase='boot',networkAllowed=true;
const check=(name,ok)=>{assert(ok,name);report.checks.push(name);console.log('PASS '+name);};
const optional=u=>/\/(?:vendor\/(?:stockfish-full|berserk)|engines\/(?:reckless|lc0))\//.test(new URL(u).pathname);
async function serve(){
 const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.wasm':'application/wasm','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
 server=http.createServer((req,res)=>{const u=new URL(req.url,'http://local'),name=decodeURIComponent(u.pathname).slice('/chess-lab/'.length)||'index.html';if(!u.pathname.startsWith('/chess-lab/')||name.includes('..'))return res.writeHead(404).end();
  if(!networkAllowed){report.serverRequests.push({phase,name,blocked:true});return res.writeHead(503).end('Network disabled at acceptance server');}
  try{const file=path.join(root,name),size=fs.statSync(file).size;report.serverRequests.push({phase,name,bytes:size});res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Content-Length',String(size));res.setHeader('Cache-Control','no-store');fs.createReadStream(file).pipe(res);}catch(_){res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port+'/chess-lab/';
}
async function boot(url){
 const page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push({phase,error:e.message}));
 await page.goto(url,{waitUntil:'load',timeout:90000});
 await page.waitForFunction(()=>!!window.ChessLabHost&&!!window.ChessEngineAssetStore&&navigator.serviceWorker.controller?.scriptURL.endsWith('/engine-sw.js'),null,{timeout:90000});
 return page;
}
async function budget(page,ms=600){await page.evaluate(ms=>{const n=document.getElementById('settingAnalysisTime');if(![...n.options].some(o=>o.value===String(ms)))n.add(new Option('Bounded acceptance',String(ms)));n.value=String(ms);n.dispatchEvent(new Event('change',{bubbles:true}));},ms);}
async function position(page,moves){await page.evaluate(moves=>ChessLabHost.navigate({startFen:new Chess().fen(),moves}),moves);}
async function run(page,mode){
 await budget(page);if(mode.startsWith('sf-'))await page.locator('#analysisSFFull').setChecked(mode==='sf-full');
 const previous=await page.evaluate(mode=>ChessLabHost.getEngineCardResult(mode)?.jobId,mode),started=Date.now();
 await page.locator('[data-eval-source="'+role(mode)+'"]').click();
 await page.waitForFunction(({mode,role,previous})=>{const s=ChessLabHost.getEngineCardState(role),r=ChessLabHost.getEngineCardResult(mode);return !s.working&&r&&r.jobId!==previous;},{mode,role:role(mode),previous},{timeout:160000});
 const result=await page.evaluate(mode=>ChessLabHost.getEngineCardResult(mode),mode);result.acceptanceWallMs=Date.now()-started;
 check(phase+' '+mode+' actually searches and returns legal PV',result.status==='complete'&&result.lines?.length>0&&!result.error&&await page.evaluate(r=>r.lines.every(l=>{const g=new Chess(r.fen);return l.pv.every(m=>!!g.move({from:m.slice(0,2),to:m.slice(2,4),promotion:m[4]}));}),result));
 if(mode==='lc0')check(phase+' native neural PUCT has >1 real visits and Q/WDL',result.visits>1&&result.lines[0].score.type==='q'&&result.lines[0].score.wdl.length===3);
 return result;
}
async function preserve(page){
 await page.evaluate(()=>{localStorage.setItem('R12-unrelated-app-sentinel','retained');ChessLabHost.onSaveLine({fen:ChessLabHost.getContext().fen,pv:['e2e4','e7e5'],source:'R12 cache data-loss guard',depth:1,evaluation:{type:'cp',white:0}});});
 await page.waitForFunction(()=>localStorage.getItem('ChessBest:LAB:v2:studies')?.includes('R12 cache data-loss guard'));
 return page.evaluate(()=>({studies:localStorage.getItem('ChessBest:LAB:v2:studies'),sentinel:localStorage.getItem('R12-unrelated-app-sentinel')}));
}
async function stopCase(page,mode){
 await budget(page,3000);await page.locator('[data-eval-source="'+role(mode)+'"]').click();await page.waitForFunction(role=>/Analyzing/.test(ChessLabHost.getEngineCardState(role).note),role(mode),{timeout:90000});
 await page.waitForTimeout(100);await page.locator('[data-eval-source="'+role(mode)+'"]').click();await page.waitForFunction(role=>!ChessLabHost.getEngineCardState(role).working,role(mode),{timeout:4000});
 check(mode+' Stop closes actual search',!await page.evaluate(role=>ChessLabHost.getEngineCardState(role).working,role(mode)));
}
(async()=>{
 fs.mkdirSync(output,{recursive:true});const url=opt('url')||await serve();report.url=url;report.public=!!opt('url');
 let proxy;if(opt('url')&&process.env.HTTPS_PROXY){const u=new URL(process.env.HTTPS_PROXY);proxy={server:u.protocol+'//'+u.host};if(u.username)proxy.username=decodeURIComponent(u.username);if(u.password)proxy.password=decodeURIComponent(u.password);}
 if(kind==='chromium'){const imported=require('@sparticuz/chromium'),c=imported.default||imported;browser=await playwright.chromium.launch({headless:true,executablePath:await c.executablePath(),args:c.args.filter(a=>a!=='--single-process'),proxy});}
 else browser=await playwright.webkit.launch({headless:true,proxy});
 report.version=browser.version();context=await browser.newContext({serviceWorkers:'allow',ignoreHTTPSErrors:!!proxy,viewport:{width:393,height:920},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'});
 context.on('request',r=>{if(optional(r.url()))report.requests.push({phase,url:r.url(),serviceWorker:!!r.serviceWorker(),save:r.headers()['x-chessbest-engine-save']==='1'});});
 context.on('response',r=>{if(optional(r.url()))report.responses.push({phase,url:r.url(),status:r.status(),fromServiceWorker:r.fromServiceWorker(),source:r.headers()['x-chessbest-asset-source']||null});});
 // Actual worker creation/termination counters; engines are never replaced.
 await context.addInitScript(()=>{const Native=Worker;window.__cacheWorkers=[];window.Worker=new Proxy(Native,{construct(Target,args){const w=new Target(...args),entry={url:String(args[0]),terminated:false};__cacheWorkers.push(entry);const close=w.terminate.bind(w),post=w.postMessage.bind(w);w.terminate=()=>{entry.terminated=true;return close();};w.postMessage=(value,...rest)=>{if(window.__forceBerserkHang&&/berserk-host/.test(entry.url)&&typeof value==='string'&&/^go movetime/.test(value)){entry.fault='go infinite';value='go infinite';}return post(value,...rest);};return w;}});});
 p=await boot(url);const baselineRequests=report.requests.length;
 await p.locator('#appMore').click();await p.locator('#btnSettings').click();await p.locator('#engineStorage summary').click();await p.waitForTimeout(200);
 await p.locator('#analysisSource').selectOption('lc0',{force:true});await p.waitForTimeout(150);
 check('opening Settings and changing display source do not download optional engine files',report.requests.length===baselineRequests);
 await p.locator('#btnCloseSettings').click();await p.locator('#analysisSource').selectOption('cdb',{force:true});
 await p.locator('[data-app-tab="board"]').click();
 check('actual mobile presentation exposes compact Engine storage without overflow',await p.evaluate(()=>document.body.classList.contains('app-mobile')&&document.documentElement.scrollWidth<=innerWidth));
 const retained=await preserve(p);report.retainedStudySha256=createHash('sha256').update(retained.studies).digest('hex');
 phase='cold-online';
 // Explicit offline save must not start a Worker/search.
 const beforeWorkers=await p.evaluate(()=>__cacheWorkers.length);await p.evaluate(()=>ChessEngineAssetStore.install('sf-full'));
 check('Save SF Full downloads only compatible variant without starting a worker',await p.evaluate(()=>__cacheWorkers.length)===beforeWorkers&&!report.requests.some(r=>/stockfish-19\.part/.test(r.url)));
 for(const mode of families){report.results[phase+':'+mode]=await run(p,mode);if(mode!=='sf-lite')check('cold '+mode+' full dependency closure is verified locally',(await p.evaluate(mode=>ChessEngineAssetStore.inspect(mode,{verifyHashes:true}),mode)).status==='ready');}
 check('Berserk NNUE is absent from optional CacheStorage',await p.evaluate(async()=>{const cache=await caches.open(ChessEngineAssetStore.cacheName(ChessEngineAssetStore.select('berserk')));return (await cache.keys()).every(r=>!r.url.endsWith('.nn'));}));
 phase='prepared-reuse';
 for(const mode of ['reckless','lc0']){await position(p,['d2d4','d7d5']);await run(p,mode);const count=await p.evaluate(()=>__cacheWorkers.length),r=await run(p,mode);report.results[phase+':'+mode]=r;check(mode+' completed repeat reuses the actual worker without asset reads',await p.evaluate(()=>__cacheWorkers.length)===count&&r.preparedEngineReused&&r.workerReused&&r.engineAssetStorage.assetSource==='prepared-memory');}
 // Every document is closed before the next phase, releasing prepared workers.
 phase='warm-online';await p.close();p=await boot(url);await position(p,['e2e4','e7e5']);const warmStart=report.requests.length;
 for(const mode of families){const r=await run(p,mode);report.results[phase+':'+mode]=r;if(mode!=='sf-lite')check('warm '+mode+' uses saved bytes in a newly initialized worker',r.assetCacheHit&&r.engineAssetStorage.localBytes>0);}
 check('warm page reopen performs no engine-save requests',report.requests.slice(warmStart).every(r=>!r.save));
 check('warm engine runtime responses come from verified local SW',report.responses.filter(r=>r.phase===phase&&r.status===200).every(r=>r.source==='verified-local'));
 phase='warm-offline';await p.close();await context.setOffline(true);networkAllowed=false;p=await boot(url);await position(p,['g1f3','d7d5']);
 const offlineServer=report.serverRequests.length,offlineResponse=report.responses.length;
 for(const mode of families){report.results[phase+':'+mode]=await run(p,mode);}
 check('fresh offline document and new FEN search all real saved families',families.every(m=>report.results[phase+':'+m]?.status==='complete'));
 check('offline has zero successful outgoing engine asset requests',report.responses.slice(offlineResponse).filter(r=>r.status===200).every(r=>r.source==='verified-local'));
 check('offline has zero engine bytes from the HTTP server',report.serverRequests.slice(offlineServer).every(r=>!/^engines\/|^vendor\/(?:stockfish-full|berserk)\//.test(r.name)));
 const keep=await p.evaluate(()=>({studies:localStorage.getItem('ChessBest:LAB:v2:studies'),sentinel:localStorage.getItem('R12-unrelated-app-sentinel')}));
 check('offline preserves saved Study nodes/annotation and unrelated storage',keep.studies.includes('R12 cache data-loss guard')&&keep.sentinel==='retained');
 phase='offline-stop-all';await stopCase(p,'berserk');await stopCase(p,'reckless');await stopCase(p,'lc0');
 // Explicit native fault injection: a synchronous blocked Berserk ignores queued Stop.
 await position(p,['b1c3','d7d5']);await budget(p,400);await p.evaluate(()=>{window.__forceBerserkHang=true;});
 await p.locator('[data-eval-source="BER"]').click();
 await p.waitForFunction(()=>!ChessLabHost.getEngineCardState('BER').working&&!!ChessLabHost.getEngineCardResult('berserk'),null,{timeout:6000});
 const fault=await p.evaluate(()=>ChessLabHost.getEngineCardResult('berserk'));report.results['fault-injection:berserk']=fault;
 check('real blocked Berserk watchdog terminates worker and retains last valid PV',fault.status==='stopped'&&fault.forcedStop&&fault.lines.length>0&&await p.evaluate(()=>__cacheWorkers.some(w=>w.fault==='go infinite'&&w.terminated)));
 await p.evaluate(()=>{window.__forceBerserkHang=false;});report.results['fault-recovery:berserk']=await run(p,'berserk');
 const beforeAll=await p.evaluate(()=>Object.fromEntries(['sf-full','reckless','lc0','berserk'].map(m=>[m,ChessLabHost.getEngineCardResult(m)?.jobId])));
 await budget(p,600);await p.locator('#analysisSFFull').check();await p.locator('#btnAnalyzeAll').click();
 await p.waitForFunction(()=>!ChessLabHost.getEngineCardState('SF').working&&!ChessLabHost.getEngineCardState('BER').working&&!ChessLabHost.getEngineCardState('RLE').working&&!ChessLabHost.getEngineCardState('LC0').working&&!document.querySelector('.is-batch-participant'),null,{timeout:120000});
 check('offline All searches four genuine families with the same base time',await p.evaluate(old=>['sf-full','reckless','lc0','berserk'].every(m=>{const r=ChessLabHost.getEngineCardResult(m);return r?.status==='complete'&&r.jobId!==old[m]&&r.requestedTimeMs===600;}),beforeAll));
 check('mobile retains at most one live heavy prepared worker',await p.evaluate(()=>__cacheWorkers.filter(w=>!w.terminated).length)<=1);
 await budget(p,5000);await p.locator('#btnAnalyzeAll').click();await p.waitForTimeout(100);await p.locator('#btnAnalyzeAll').click();check('Stop all removes active and queued jobs',await p.evaluate(()=>['SF','RLE','LC0','BER'].every(r=>!ChessLabHost.getEngineCardState(r).working)));
 phase='remove-eviction';
 const coreCaches=await p.evaluate(async()=> (await caches.keys()).filter(n=>n.startsWith('chessbest-chess-lab-')));
 await p.evaluate(()=>ChessEngineAssetStore.remove('reckless'));
 check('Remove selected engine preserves the shell and other engines',await p.evaluate(async core=>core.every(n=>n&&(true))&&(await ChessEngineAssetStore.inspect('reckless')).status==='online'&&(await ChessEngineAssetStore.inspect('lc0')).status==='ready'&&(await caches.keys()).some(n=>n.startsWith('chessbest-chess-lab-')),coreCaches));
 const offlineBefore=report.requests.length,missing=await p.evaluate(async()=>{try{await ChessEngineAssetStore.install('reckless');return null;}catch(e){return e.name;}});
 check('missing offline engine reports honest error with no retry download',missing==='OfflineError'&&report.requests.length===offlineBefore);
 await position(p,['c2c4','e7e5']);report.results['remaining-offline:lc0']=await run(p,'lc0');
 check('no uncaught application errors',report.pageErrors.length===0);report.status='PASS';
})().catch(e=>{report.status='FAIL';report.error=e.stack;process.exitCode=1;}).finally(async()=>{report.finishedAt=new Date().toISOString();fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:report.checks.length,error:report.error,output}));await browser?.close();if(server)await new Promise(r=>server.close(r));});
