'use strict';
// Actual two-page IDB/Web Locks, GUI pinning, cache-only inspection and replay.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'../../..'),out=process.env.CHESS_P5BC_EVIDENCE_DIR;
const {execFileSync}=require('node:child_process');
let browser,server,origin;const receipts=[],requests=[];
test.before(async()=>{
  const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.ico':'image/x-icon'};
  server=http.createServer((req,res)=>{let rel=new URL(req.url,'http://fixture').pathname.replace(/^\/bd-chessdb(?=\/)/,'');requests.push(rel);
    if(rel==='/seed')return res.writeHead(200,{'content-type':'text/html'}).end('<title>Disposable storage page</title>');
    if(rel.includes('..'))return res.writeHead(400).end();const file=path.join(root,'public',rel.endsWith('/')?rel+'index.html':rel);
    fs.readFile(file,(e,b)=>e?res.writeHead(404).end():res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'}).end(b));
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({headless:true});
});
test.after(async()=>{if(out){fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'p5bc-browser.json'),JSON.stringify({browser:browser?.version(),receipts,requests,physicalDevice:false},null,2));}await browser?.close();await new Promise(r=>server.close(r));});
async function context(t,{fallback=false,noLocks=false,mobile=false}={}) {
  const c=await browser.newContext({viewport:mobile?{width:402,height:874}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});t.after(()=>c.close());
  c.__externalRequests=[];await c.route('**/*',r=>{if(new URL(r.request().url()).origin===origin)return r.continue();c.__externalRequests.push(r.request().url());return r.abort();});
  await c.addInitScript(({fallback,noLocks})=>{
    localStorage.setItem('ChessBest:LAB:v2:settings',JSON.stringify({cdbEnabled:false,dccEnabled:false,theme:'dark'}));
    localStorage.setItem('ChessBest:LAB:v2:analysis-engine-r3',JSON.stringify({engineMemoryPolicy:'one'}));
    if(fallback){localStorage.setItem('ChessBest:LAB:v2:migration',JSON.stringify({version:1,complete:true,local:{},databases:{},warnings:[]}));Object.defineProperty(window,'indexedDB',{value:undefined});}
    if(noLocks)Object.defineProperty(navigator,'locks',{value:undefined});
    const Native=Worker;window.__p5bcWorkers=[];window.Worker=new Proxy(Native,{construct(Target,args){__p5bcWorkers.push(String(args[0]));return new Target(...args);}});
  },{fallback,noLocks});return c;
}
async function page(c,prefix='/',suffix='') {const p=await c.newPage();await p.goto(origin+prefix+'chess-lab/'+suffix);await p.waitForFunction(()=>!!window.ChessLabHost);return p;}
async function seed(p,n=0,opts={}) {return p.evaluate(async({n,opts})=>{
  const fen=new Chess().fen(),s=ChessEvidence.createCollector().snapshot({receipt:{fen}},{label:'browser-'+n,createdAt:new Date(Date.UTC(2026,9,1,0,0,n)).toISOString()});
  const store=ChessEvidence.createStore(opts),result=await store.put(s);window.__p5bcStore=store;return {s,result};
},{n,opts});}
async function settings(p) {await p.evaluate(()=>document.getElementById('btnSettings').click());await p.locator('#engineStorage summary').click();await p.waitForFunction(()=>document.querySelector('[data-engine-storage="sf-lite"] [role="status"]').textContent.includes('Local files'));}
for(const fallback of [false,true])test('BC-03 actual two pages serialize pin/retention/delete; '+(fallback?'localStorage + Web Locks':'IndexedDB v2'),{timeout:45000},async t=>{
  const c=await context(t,{fallback}),a=await page(c),b=await page(c),first=await seed(a,0,{maxItems:2});await seed(b,1,{maxItems:2});
  await Promise.all([a.evaluate(id=>ChessEvidence.createStore({maxItems:2}).setPinned(id,true),first.s.id),seed(b,2,{maxItems:2})]);
  const list=await a.evaluate(()=>ChessEvidence.createStore({maxItems:2}).list());assert.equal(list.length,2);assert(list.find(x=>x.id===first.s.id)?.pinned);
  const victim=list.find(x=>!x.pinned);await Promise.all([a.evaluate(id=>ChessEvidence.createStore({maxItems:2}).remove(id),victim.id),seed(b,3,{maxItems:2})]);
  await a.reload();await a.waitForFunction(()=>!!ChessLabHost);const retained=await a.evaluate(id=>ChessEvidence.createStore().get(id),first.s.id);assert.deepEqual(retained,first.s);
  const pins=await a.evaluate(()=>ChessEvidence.createStore().list());assert(pins.find(x=>x.id===first.s.id)?.pinned);assert.equal(pins.length,2);
  receipts.push({case:'two-real-pages',backend:fallback?'localStorage+WebLocks':'IDB',pin:first.s.id,count:pins.length});
});
test('BC-03 real fallback without Web Locks refuses writes and keeps original bytes',{timeout:35000},async t=>{
  const c=await context(t,{fallback:true}),p=await page(c),{s}=await seed(p,0);await p.evaluate(id=>__p5bcStore.setPinned(id,true),s.id);
  const before=await p.evaluate(()=>localStorage.getItem(ChessDataGuard.key('ChessBest:LAB:v2:evidence-fallback')));
  await p.evaluate(()=>Object.defineProperty(navigator,'locks',{value:undefined}));
  const result=await p.evaluate(async()=>{const store=ChessEvidence.createStore({locks:null}),s=ChessEvidence.createCollector().snapshot({receipt:{fen:new Chess().fen()}},{label:'unsafe write'});return store.put(s);});
  assert.equal(result.persistent,false);assert.equal(await p.evaluate(()=>localStorage.getItem(ChessDataGuard.key('ChessBest:LAB:v2:evidence-fallback'))),before);receipts.push({case:'real-no-lock',result});
});
test('BC-01/06/08/09 real APP pin controls, cache-only status, partial replay and stable full game',{timeout:65000},async t=>{
  const c=await context(t,{mobile:true}),p=await page(c,'/','?view=app');await p.waitForFunction(()=>navigator.serviceWorker.controller?.scriptURL.endsWith('/engine-sw.js'));
  const {s}=await seed(p,0);await p.evaluate(()=>document.getElementById('btnEvidence').click());await p.locator('[data-input="snapshots"]').selectOption(s.id);
  await p.locator('[data-action="pin"]').click();await p.waitForFunction(()=>document.querySelector('[data-action="pin"]').textContent==='Unpin');
  assert.deepEqual(await p.evaluate(id=>ChessEvidence.createStore().get(id),s.id),s);
  await p.keyboard.press('Escape');await p.reload();await p.waitForFunction(()=>!!ChessLabHost);
  const workers=await p.evaluate(()=>__p5bcWorkers.length),before=requests.filter(x=>/\/(?:engines|vendor\/(?:stockfish-full|berserk))\//.test(x)).length;
  await settings(p);await p.waitForFunction(()=>document.querySelector('[data-engine-storage="sf-lite"] [role="status"]').textContent.includes('Offline: Ready'));
  assert.equal(await p.evaluate(()=>__p5bcWorkers.length),workers);assert.equal(requests.filter(x=>/\/(?:engines|vendor\/(?:stockfish-full|berserk))\//.test(x)).length,before);
  const verified=await p.evaluate(()=>ChessEngineAssetStore.inspect('sf-lite'));assert.equal(verified.offlineReady,true);
  const eviction=await p.evaluate(async()=>{const d=await new Promise(resolve=>{const ch=new MessageChannel();ch.port1.onmessage=e=>resolve(e.data);navigator.serviceWorker.controller.postMessage({type:'CHESS_OFFLINE_SHELL'},[ch.port2]);}),cache=await caches.open(d.cacheName),url=new URL('vendor/stockfish/stockfish-18-lite-single.wasm',location.href).href;
    window.__restoreShell={cache:d.cacheName,url,response:await cache.match(url)};await cache.delete(url);return ChessEngineAssetStore.inspect('sf-lite');});
  assert.equal(eviction.offlineReady,false);assert.equal(eviction.files,'partial');assert(eviction.shell.missing.includes('vendor/stockfish/stockfish-18-lite-single.wasm'));
  await p.evaluate(async()=>{await(await caches.open(__restoreShell.cache)).put(__restoreShell.url,__restoreShell.response);});
  for(const width of [375,402,430])for(const lang of ['sl','en','sl'])for(const light of [false,true]) {
    await p.setViewportSize({width,height:874});await p.evaluate(({lang,light})=>{ChessLanguage.apply(lang);document.body.classList.toggle('light-theme',light);},{lang,light});
    assert(await p.evaluate(()=>document.body.classList.contains('app-mobile')));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    assert.match(await p.locator('[data-engine-storage="sf-full"] strong').innerText(),lang==='sl'?/^SF ·/:/^SF Full ·/);
    const refresh=p.getByRole('button',{name:lang==='sl'?'Osveži stanje brez povezave':'Refresh offline status',exact:true});await refresh.scrollIntoViewIfNeeded();const box=await refresh.boundingBox();assert(box.width>40&&box.height>=35);
  }
  await p.evaluate(()=>ChessLanguage.apply('en'));if(out){fs.mkdirSync(out,{recursive:true});await p.screenshot({path:path.join(out,'engine-storage-app-430.png')});}
  await p.locator('#btnCloseSettings').click();
  const gameBefore=await p.evaluate(()=>{ChessLabHost.navigate({startFen:new Chess().fen(),moves:['e2e4','e7e5','g1f3']});ChessLabHost.navigateReview(1);return ChessLabHost.getReviewGame();});
  const networkBefore=c.__externalRequests.length,replay=await p.evaluate(async()=>{const h=ChessLabHost,fen=h.getContext().fen,c=ChessEvidence.createCollector();c.capture({kind:'moves',fen,response:{fen,moves:[]},source:'captured-browser-fixture'});const snap=c.snapshot({receipt:{fen}},{label:'partial replay'});h.onRestore(snap);await h.analyze(fen);const miss=new Chess();miss.move('d4');await h.analyze(miss.fen());return h.getContext();});
  assert.equal(replay.evidenceMode,'offline');assert(replay.evidenceCoverage.hits>=1);assert(replay.evidenceCoverage.misses.length>=1);assert.equal(replay.evidenceCoverage.networkFallback,false);
  assert.equal(c.__externalRequests.length,networkBefore,'replay hit and missing query make zero external requests');
  assert.deepEqual(await p.evaluate(()=>ChessLabHost.getReviewGame()),gameBefore);await c.setOffline(true);await p.evaluate(()=>ChessLabHost.resumeLive());assert.deepEqual(await p.evaluate(()=>ChessLabHost.getReviewGame()),gameBefore);
  receipts.push({case:'APP-UI-shell-and-replay',verified,eviction,replay:replay.evidenceCoverage,widths:[375,402,430],languages:['sl','en','sl'],themes:['dark','light'],workers});
});
test('BC-01/09 desktop keyboard pin and explicit pinned-delete confirmation preserve game and sealed payload',{timeout:35000},async t=>{
  const c=await context(t),p=await page(c),{s}=await seed(p,0),game=await p.evaluate(()=>ChessLabHost.getReviewGame());
  await p.evaluate(()=>document.getElementById('btnEvidence').click());await p.locator('[data-input="snapshots"]').selectOption(s.id);
  const pin=p.locator('[data-action="pin"]');await pin.focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>document.querySelector('[data-action="pin"]').textContent==='Unpin');
  assert.deepEqual(await p.evaluate(id=>ChessEvidence.createStore().get(id),s.id),s);
  await p.evaluate(()=>ChessLanguage.apply('sl'));await p.waitForFunction(()=>document.querySelector('[data-action="pin"]').textContent==='Odpni');await p.evaluate(()=>ChessLanguage.apply('en'));
  p.once('dialog',d=>d.dismiss());await p.locator('[data-action="delete"]').click();assert((await p.evaluate(()=>ChessEvidence.createStore().list())).find(x=>x.id===s.id)?.pinned);
  if(out)await p.screenshot({path:path.join(out,'evidence-desktop.png')});
  p.once('dialog',d=>d.accept());await p.locator('[data-action="delete"]').click();await p.waitForFunction(()=>document.querySelector('[data-input="snapshots"]').options.length===1);
  assert.equal(await p.evaluate(id=>ChessEvidence.createStore().get(id),s.id),null);await p.keyboard.press('Escape');assert.deepEqual(await p.evaluate(()=>ChessLabHost.getReviewGame()),game);
  receipts.push({case:'desktop-keyboard-and-delete-confirm',sealedId:s.id,gameUnchanged:true});
});
test('BC-05 malicious rehashed metadata rejects at the actual restore boundary before journal/generation effects',{timeout:40000},async t=>{
  const c=await context(t),p=await page(c);await seed(p,0);
  const results=await p.evaluate(async()=>{const C=ChessDataCore,G=ChessDataGuard,current=await G.capture(false),writes=[],open=indexedDB.open.bind(indexedDB),set=Storage.prototype.setItem;
    indexedDB.open=(name,...args)=>{if(/DATA-control|DATA:g-/.test(name))writes.push(name);return open(name,...args);};Storage.prototype.setItem=function(k,v){if(/DATA-active|DATA-journal|DATA:g-/.test(k))writes.push(k);return set.call(this,k,v);};
    const out=[];for(const change of [v=>v.payload.evidence.metadata.pins=['f'.repeat(64)],v=>v.payload.evidence.metadata.pins=[v.payload.evidence.snapshots[0].id,v.payload.evidence.snapshots[0].id],v=>v.payload.evidence.metadata.version=2,v=>v.version=3]) {
      const v=JSON.parse(C.canonical(current));change(v);v.sha256=await C.digest(v.payload);v.manifest=C.manifest(v.payload);try{await G.restore(v,current.sha256);out.push('UNEXPECTED');}catch(e){out.push(e.message);}
    }return {out,writes};});
  assert.equal(results.out.length,4);assert(results.out.every(x=>x!=='UNEXPECTED'));assert.deepEqual(results.writes,[]);receipts.push({case:'real-invalid-restore-no-effects',...results});
});
test('BC-03 real blocked upgrade and old pre-P5BC writer cannot delete new pins',{timeout:40000},async t=>{
  const c=await context(t),old=await c.newPage();await old.goto(origin+'/seed');
  const oldCode=execFileSync('git',['show','4849d5075ebdf4cf8ef440828fca3c9e65dab201:public/chess-lab/js/8zc-evidence.js'],{cwd:root,encoding:'utf8'});
  await old.addScriptTag({content:oldCode});const fen='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const initial=await old.evaluate(async fen=>{window.oldStore=ChessEvidence.createStore();const s=ChessEvidence.createCollector().snapshot({receipt:{fen}},{label:'pre-P5BC'});await oldStore.put(s);window.held=await new Promise(resolve=>{const r=indexedDB.open('ChessBest:LAB:v2:evidence',1);r.onsuccess=()=>resolve(r.result);});held.onversionchange=()=>{};return s;},fen);
  const next=await c.newPage();await next.goto(origin+'/seed');await next.addScriptTag({content:fs.readFileSync(path.join(root,'public/chess-lab/js/8zc-evidence.js'),'utf8')});
  const refused=await next.evaluate(s=>ChessEvidence.createStore().put(s),initial);assert.equal(refused.persistent,false);assert.match(refused.reason,/blocked/i);
  await old.evaluate(()=>held.close());
  await next.waitForTimeout(30);await next.evaluate(async s=>{window.newStore=ChessEvidence.createStore();const r=await newStore.put(s);if(!r.persistent)throw Error(r.reason);await newStore.setPinned(s.id,true);},initial);
  const oldAttempt=await old.evaluate(s=>oldStore.put(s),initial);assert.equal(oldAttempt.mode,'localStorage');await old.evaluate(id=>oldStore.remove(id),initial.id);
  const retained=await next.evaluate(async id=>({snapshot:await newStore.get(id),list:await newStore.list()}),initial.id);assert.deepEqual(retained.snapshot,initial);assert(retained.list.find(s=>s.id===initial.id)?.pinned);
  receipts.push({case:'blocked-upgrade-and-actual-old-code',refused,oldAttempt,sealedId:initial.id});
});
test('BC-08 delayed live CDB reply cannot overwrite replay or the complete current game',{timeout:35000},async t=>{
  const c=await context(t),p=await page(c);let arrive;const pending=[],arrived=new Promise(r=>arrive=r);
  await c.route('**/cdb.php**',route=>{pending.push(route);if(pending.length>=2)arrive();});
  const before=await p.evaluate(()=>{ChessLabHost.navigate({startFen:new Chess().fen(),moves:['e2e4','e7e5','g1f3']});ChessLabHost.navigateReview(1);return ChessLabHost.getReviewGame();});
  await p.evaluate(()=>{window.__lateResult='pending';void ChessLabHost.analyze(ChessLabHost.getContext().fen).then(r=>window.__lateResult=r,e=>window.__lateResult={error:e.name});});
  await Promise.race([arrived,new Promise((_,reject)=>setTimeout(()=>reject(Error('Mock live requests did not arrive')),5000))]);
  await p.evaluate(()=>{const fen=ChessLabHost.getContext().fen,col=ChessEvidence.createCollector();col.capture({kind:'moves',fen,response:{fen,moves:[]},source:'captured only'});ChessLabHost.onRestore(col.snapshot({receipt:{fen}},{label:'delayed-source test'}));});
  for(const route of pending)await route.fulfill({status:200,contentType:'text/plain',body:'move:e7e5,score:999,rank:1,note:late'}).catch(()=>{});
  await p.waitForFunction(()=>window.__lateResult!=='pending');assert.equal(await p.evaluate(()=>window.__lateResult),null);
  const after=await p.evaluate(()=>({game:ChessLabHost.getReviewGame(),context:ChessLabHost.getContext()}));assert.deepEqual(after.game,before);assert.equal(after.context.evidenceMode,'offline');assert.equal(after.context.analysisSources.CDB.receipt.status,'unavailable');assert.deepEqual(after.context.analysisSources.CDB.allMoves,[]);
  receipts.push({case:'late-live-response-replay-guard',mockReplies:pending.length,fullGameRetained:true,lateResult:null});
});
