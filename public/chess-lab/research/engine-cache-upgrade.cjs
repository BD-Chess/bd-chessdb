'use strict';
// A real installed old LAB service worker upgraded in the same browser context.
// Old files come from git objects. No storage/cache clearing or SW mocks.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process'),{createHash}=require('node:crypto');
const playwright=require('playwright');
const option=name=>process.argv.find(x=>x.startsWith('--'+name+'='))?.slice(name.length+3);
const root=path.resolve(option('repo')||path.resolve(__dirname,'../../..'));
const kind=option('browser')||'chromium',mobile=process.argv.includes('--mobile');
const baseline=option('baseline')||'83d88663e3ab3cd5eadbd9ea3fbe02ecc2eb2a88';
const output=path.resolve(option('evidence')||'engine-cache-upgrade-'+kind+(mobile?'-mobile':''));
const oldFiles=new Map(),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const oldFile=name=>{if(!oldFiles.has(name))oldFiles.set(name,execFileSync('git',['show',baseline+':public/chess-lab/'+name],{cwd:root,maxBuffer:80*1024*1024}));return oldFiles.get(name);};
const oldRelease=JSON.parse(oldFile('release.json')),candidateRelease=JSON.parse(fs.readFileSync(path.join(root,'public/chess-lab/release.json'),'utf8'));
const report={schema:'chessbest.r12.pwa-upgrade.v1',startedAt:new Date().toISOString(),browser:kind,mobile,physicalIPhone:false,baselineCommit:baseline,oldRelease:oldRelease.version,candidateRelease:candidateRelease.version,
 boundary:'Real LAB service worker/cache upgrade on a local HTTP origin. This is neither a physical iPhone nor an OS-level Home Screen installation test. No CDB result is asserted.',checks:[],phases:[],pageErrors:[],blockedExternalRequests:[],serverRequests:[]};
const check=(name,value)=>{assert(value,name);report.checks.push(name);console.log('PASS '+name);};
let browser,server,serving='old';
const userPGN='[Event "R11 PWA user game"]\n[Site "Local acceptance"]\n[Date "2026.10.13"]\n[White "Upgrade White"]\n[Black "Upgrade Black"]\n[Result "*"]\n\n1. e4 {Main-line annotation must survive} (1. d4 $1 d5 {Alternate branch retained} 2. c4) e5 2. Nf3 Nc6 3. Bb5 a6 *';
async function localURL(){
 const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.wasm':'application/wasm','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.pgn':'application/x-chess-pgn'};
 server=http.createServer((req,res)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch(_){return res.writeHead(400).end();}
  if(!pathname.startsWith('/chess-lab/'))return res.writeHead(404).end();
  let name=pathname.slice('/chess-lab/'.length)||'index.html';if(name.includes('..')||name.startsWith('/'))return res.writeHead(403).end();
  try{
   const bytes=serving==='old'?oldFile(name):fs.readFileSync(path.join(root,'public/chess-lab',name));
   report.serverRequests.push({phase:serving,path:name,sha256:sha(bytes)});
   res.setHeader('Content-Type',types[path.extname(name)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.writeHead(200);res.end(bytes);
  }catch(_){res.writeHead(404).end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return 'http://127.0.0.1:'+server.address().port+'/chess-lab/';
}
async function snapshot(p){return p.evaluate(()=>{
 const keys=ChessLabStorage.KEYS,ctx=ChessLabHost.getContext(),game=ChessLabHost.getReviewGame();
 return {loadId:window.__pwaUpgradeLoadId,fen:ctx.fen,moves:ctx.moves,headers:ctx.headers,totalPly:game.totalPly,cursor:game.cursor,
  gameBytes:localStorage.getItem(keys.game),studyBytes:localStorage.getItem(keys.studies),settings:JSON.parse(localStorage.getItem(keys.settings)||'{}'),
  time:document.getElementById('settingAnalysisTime').value,link:document.getElementById('analysisLink').checked,follow:document.getElementById('analysisAllMoves').checked,
  session:ChessAnalysisSession.getSettings(),scope:navigator.serviceWorker.controller?.scriptURL,
  studyVisible:!document.querySelector('.chess-study-overlay')?.hidden};
});}
async function hashes(p,version){return p.evaluate(async version=>{
 const cache=await caches.open('chessbest-chess-lab-'+version),result={};
 for(const request of await cache.keys()){
  const response=await cache.match(request),bytes=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);
  const relative=new URL(request.url).pathname.slice('/chess-lab/'.length);
  result[relative]=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
 }
 return result;
},version);}
async function verifyShell(p,release,phase){
 const actual=await hashes(p,release.version),expected=release.assets_sha256;
 report[phase+'CachedAssets']=Object.keys(actual).length;
 check(phase+' complete installed shell matches every exact release asset',Object.keys(actual).length===Object.keys(expected).length&&Object.entries(expected).every(([name,digest])=>actual[name]===digest));
 const loaded=await p.evaluate(async()=>{
  const urls=[document.location.href,...Array.from(document.querySelectorAll('script[src],link[rel="stylesheet"][href]')).map(n=>n.src||n.href)].filter(url=>new URL(url).pathname.startsWith('/chess-lab/'));
  return Promise.all(urls.map(async url=>{
   const response=await fetch(url),bytes=await response.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);
   let relative=new URL(url).pathname.slice('/chess-lab/'.length)||'index.html';
   return {path:relative,url,sha256:Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')};
  }));
 });
 report[phase+'LoadedShell']=loaded;
 check(phase+' document and all attached scripts/styles resolve to one release',loaded.length>=30&&loaded.every(asset=>expected[asset.path]===asset.sha256));
}
function sameStudy(before,after){
 const b=JSON.parse(before.studyBytes),a=JSON.parse(after.studyBytes);
 return b.activeId===a.activeId&&b.studies.every(old=>{
  const now=a.studies.find(s=>s.id===old.id);
  return now&&now.title===old.title&&now.rootFen===old.rootFen&&JSON.stringify(now.nodes)===JSON.stringify(old.nodes)&&JSON.stringify(now.headers)===JSON.stringify(old.headers);
 });
}
function verifyUserData(before,after,phase){
 check(phase+' preserves open game FEN, full move line and headers',after.fen===before.fen&&JSON.stringify(after.moves)===JSON.stringify(before.moves)&&JSON.stringify(after.headers)===JSON.stringify(before.headers)&&after.totalPly===before.totalPly&&after.cursor===before.cursor);
 check(phase+' preserves exact persisted game bytes',after.gameBytes===before.gameBytes);
 check(phase+' preserves every Study node, branch, annotation and active Study',sameStudy(before,after));
 check(phase+' keeps saved card search time at 60 seconds',after.time==='60000'&&after.session.analysisTimeMs===60000&&after.settings.analysisTimeMs===60000);
 check(phase+' keeps independent Link ON preference',after.link===true&&after.settings.analysisLink===true);
 check(phase+' preserves all existing saved GUI preferences without resetting settings',JSON.stringify(after.settings)===JSON.stringify(before.settings));
 check(phase+' follow remains session-only and defaults OFF after reopening',after.follow===false);
}
async function ready(p){await p.waitForFunction(()=>!!window.ChessLabHost&&!!window.ChessLabStorage?.KEYS&&!!navigator.serviceWorker.controller,null,{timeout:90000});}
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 check('baseline uses exact previous published commit',/^83d8866/.test(baseline)&&oldRelease.version==='lab-1ff1230f79aae8df');
 if(!process.argv.includes('--baseline-only'))check('candidate is a distinct regenerated PWA release',candidateRelease.version!==oldRelease.version);
 const url=await localURL();report.url=url;
 if(kind==='webkit')browser=await playwright.webkit.launch({headless:true});
 else{const m=require('@sparticuz/chromium'),c=m.default||m;browser=await playwright.chromium.launch({executablePath:await c.executablePath(),args:c.args.filter(a=>a!=='--single-process'),headless:true});}
 const context=await browser.newContext({viewport:mobile?{width:393,height:852}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,...(mobile?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'}:{})});
 await context.route(url=>!['127.0.0.1','localhost'].includes(url.hostname),route=>{report.blockedExternalRequests.push(new URL(route.request().url()).hostname);return route.abort();});
 await context.addInitScript(()=>{window.__pwaUpgradeLoadId=crypto.randomUUID();});
 const attach=p=>p.on('pageerror',error=>report.pageErrors.push(error.message));
 let p=await context.newPage();attach(p);await p.goto(url,{waitUntil:'load'});await ready(p);
 await verifyShell(p,oldRelease,'old');
 check('previous installed LAB keeps the correct service-worker scope',(await snapshot(p)).scope===url+'sw.js');
 // Actual file import creates both the playing game and durable Study tree.
 await p.locator('#filePGN').setInputFiles({name:'R11-PWA-user-game.pgn',mimeType:'application/x-chess-pgn',buffer:Buffer.from(userPGN)});
 await p.waitForFunction(()=>ChessLabHost.getContext().headers.Event==='R11 PWA user game'&&ChessLabHost.getContext().moves.length===6&&JSON.parse(localStorage.getItem(ChessLabStorage.KEYS.studies)||'{}').studies?.some(s=>Object.values(s.nodes).some(n=>n.comments?.includes('Alternate branch retained'))));
 await p.evaluate(()=>{
  const s=document.getElementById('settingAnalysisTime');s.value='60000';s.dispatchEvent(new Event('change',{bubbles:true}));
  const link=document.getElementById('analysisLink');link.checked=true;link.dispatchEvent(new Event('change',{bubbles:true}));
  ChessLabHost.openReviewStudy('study');
 });
 await p.locator('.chess-study-dialog').waitFor({state:'visible'});
 check('real old GUI opens saved Study with imported variation',await p.locator('.chess-study-tree').innerText().then(text=>text.includes('d4')&&text.includes('c4')));
 await p.evaluate(async()=>{const c=await caches.open('chessbest-LAB-engine-assets-v1-QA-retained');await c.put(new URL('engines/QA-immutable-public-fixture',location.href),new Response('retained optional namespace fixture'));});
 const before=await snapshot(p);report.before={...before,gameBytes:undefined,studyBytes:undefined,gameSha256:sha(Buffer.from(before.gameBytes)),studySha256:sha(Buffer.from(before.studyBytes))};
 check('old PWA has a noninitial open game, branched Study and Link ON',before.moves.length===6&&before.link&&before.studyVisible&&before.time==='60000'&&!before.follow);
 if(process.argv.includes('--baseline-only')){report.status='BASELINE_PASS';return;}
 serving='candidate';report.phases.push({phase:serving,at:new Date().toISOString()});
 await p.evaluate(async()=>await(await navigator.serviceWorker.ready).update());
 await p.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting,null,{timeout:90000});
 const pending=await snapshot(p),pendingCaches=await p.evaluate(()=>caches.keys());report.waitingCaches=pendingCaches;
 check('new worker waits while old open game/Study stays controlled',pending.loadId===before.loadId&&pending.fen===before.fen&&pending.studyVisible&&pending.scope===before.scope);
 check('both old and new release caches coexist until user activation',pendingCaches.includes('chessbest-chess-lab-'+oldRelease.version)&&pendingCaches.includes('chessbest-chess-lab-'+candidateRelease.version));
 await verifyShell(p,oldRelease,'waitingOld');
 // Close only the visible Study modal; its stored selection/content remains.
 await p.locator('.chess-study-close').click();
 if(mobile)await p.locator('#appMore').click();
 const update=p.locator(mobile?'#appPwaUpdate':'#chessPwaUpdate');await update.waitFor({state:'visible',timeout:10000});
 check('existing Update ready/reload action is visible',/Update ready/.test(await update.innerText()));
 // Exercise the established session-only Follow reset without giving its
 // 100ms scheduling timer a chance to start a scientific search.
 const [,followEnabled]=await Promise.all([p.waitForEvent('load',{timeout:60000}),p.evaluate(updateId=>{
  const follow=document.getElementById('analysisAllMoves');follow.checked=true;follow.dispatchEvent(new Event('change',{bubbles:true}));
  const enabled=follow.checked;document.getElementById(updateId).click();return enabled;
 },mobile?'appPwaUpdate':'chessPwaUpdate')]);report.followWasEnabledBeforeUpdate=followEnabled;
 check('old current session accepts Follow ON before activation',report.followWasEnabledBeforeUpdate);await ready(p);
 await p.waitForFunction(id=>window.__pwaUpgradeLoadId!==id,before.loadId);
 const after=await snapshot(p);report.after={...after,gameBytes:undefined,studyBytes:undefined,gameSha256:sha(Buffer.from(after.gameBytes)),studySha256:sha(Buffer.from(after.studyBytes))};
 verifyUserData(before,after,'activated upgrade');
 await verifyShell(p,candidateRelease,'upgraded');

 // R11 registered sw.js; R12's strictly LAB-only wrapper is a separate SW script.
 // Each activation remains the existing explicit Update ready action. No forced reload.
 await p.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting,null,{timeout:90000});
 const bridgeBefore=await snapshot(p);
 check('optional namespace survives initial shell update',(await p.evaluate(()=>caches.keys())).includes('chessbest-LAB-engine-assets-v1-QA-retained'));
 check('wrapper waits while upgraded game/Study stays open',bridgeBefore.scope===url+'sw.js');
 if(mobile)await p.locator('#appMore').click();
 await p.locator(mobile?'#appPwaUpdate':'#chessPwaUpdate').waitFor({state:'visible',timeout:15000});
 await Promise.all([p.waitForEvent('load'),p.evaluate(id=>document.getElementById(id).click(),mobile?'appPwaUpdate':'chessPwaUpdate')]);
 await ready(p);await p.waitForFunction(()=>navigator.serviceWorker.controller?.scriptURL.endsWith('/engine-sw.js'));
 const bridgeAfter=await snapshot(p);verifyUserData(before,bridgeAfter,'R12 offline-route activation');
 check('optional cache namespace survives both explicit upgrade activations',(await p.evaluate(()=>caches.keys())).includes('chessbest-LAB-engine-assets-v1-QA-retained'));
 report.upgradeBridge={activations:2,reason:'First transition from existing R11 SW script to LAB-only optional asset wrapper',autoActivation:false};
 await p.evaluate(()=>ChessEngineAssetStore.install('lc0'));
 check('upgraded PWA saves actual complete LCZero runtime',(await p.evaluate(()=>ChessEngineAssetStore.inspect('lc0',{verifyHashes:true}))).status==='ready');

 const cachesAfter=await p.evaluate(()=>caches.keys());report.activatedCaches=cachesAfter;
 check('activation retires only the previous LAB shell cache',!cachesAfter.includes('chessbest-chess-lab-'+oldRelease.version)&&cachesAfter.includes('chessbest-chess-lab-'+candidateRelease.version));
 if(process.argv.includes('--activation-only')){
  report.offlineReopenStatus='UNVERIFIED_NOT_REPEATED';
  report.offlineLimitation='Prior native Linux WebKit new-tab and same-tab offline navigations both returned an internal browser error. This run verifies final-release activation only.';
  report.status='ACTIVATION_PASS';return;
 }
 // Reopen offline in this same context. The server is also closed: no fallback
 // transport can hide incomplete caching or make this a fresh-install test.
 await context.setOffline(true);await new Promise(resolve=>server.close(resolve));server=null;
 if(process.argv.includes('--offline-reload')){
  report.offlineReopenMethod='new document through offline reload in existing tab';
  await p.reload({waitUntil:'load',timeout:60000});
 }else{
  report.offlineReopenMethod='close previous tab then offline navigation in new tab';
  await p.close();p=await context.newPage();attach(p);await p.goto(url,{waitUntil:'load',timeout:60000});
 }
 await ready(p);
 const reopened=await snapshot(p);report.offline={...reopened,gameBytes:undefined,studyBytes:undefined,gameSha256:sha(Buffer.from(reopened.gameBytes)),studySha256:sha(Buffer.from(reopened.studyBytes))};
 verifyUserData(before,reopened,'offline reopen');await verifyShell(p,candidateRelease,'offline');
 check('offline reopened LAB retains All engines and direct desktop Settings',/All engines/.test(await p.locator('#btnAnalyzeAll').innerText())&&(mobile||await p.locator('#workspacePrimaryActions #btnSettings').count()===1));
 await p.evaluate(()=>ChessLabHost.openReviewStudy('study'));await p.locator('.chess-study-dialog').waitFor({state:'visible'});
 check('upgraded offline Study GUI still opens its saved alternative branch',await p.locator('.chess-study-tree').innerText().then(text=>text.includes('d4')&&text.includes('c4')));

 await p.locator('.chess-study-close').click();
 if(mobile)await p.locator('[data-app-tab="board"]').click();
 await p.evaluate(()=>{const s=document.getElementById('settingAnalysisTime');s.add(new Option('Bounded acceptance','600'));s.value='600';s.dispatchEvent(new Event('change',{bubbles:true}));ChessLabHost.navigate({startFen:new Chess().fen(),moves:['g1f3','d7d5']});});
 await p.locator('[data-eval-source="LC0"]').click();
 await p.waitForFunction(()=>!ChessLabHost.getEngineCardState('LC0').working&&!!ChessLabHost.getEngineCardResult('lc0'),null,{timeout:120000});
 const native=await p.evaluate(()=>ChessLabHost.getEngineCardResult('lc0'));report.offlineEngine=native;
 check('after old-to-R12 upgrade, fresh offline LCZero searches a NEW legal FEN',native.status==='complete'&&native.visits>1&&native.assetCacheHit&&native.lines.length>0&&await p.evaluate(r=>r.lines.every(l=>{const g=new Chess(r.fen);return l.pv.every(m=>!!g.move({from:m.slice(0,2),to:m.slice(2,4),promotion:m[4]}));}),native));

 check('no uncaught application errors during real PWA upgrade',report.pageErrors.length===0);report.status='PASS';
})().catch(error=>{report.status='FAIL';report.error=error.stack;process.exitCode=1;}).finally(async()=>{
 report.finishedAt=new Date().toISOString();fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'upgrade-result.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,checks:report.checks.length,error:report.error,output}));await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));
});
