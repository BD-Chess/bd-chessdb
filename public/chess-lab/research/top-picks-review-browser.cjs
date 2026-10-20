'use strict';
// Real shipped application in disposable Chromium; frozen local files only.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const {chromium}=require('playwright'),{Chess}=require('../js/chess.min.js'),Core=require('../js/8zc-review-core.js');
const registry=require('../js/8zc-review-registry.js'),repo=path.resolve(__dirname,'../../..'),base=path.join(repo,'public');
const release=JSON.parse(fs.readFileSync(base+'/chess-lab/release.json'));
const games=['ChessBest_Top_Picks.pgn','ChessBest_Top_Picks_TCEC.pgn'].flatMap(file=>fs.readFileSync(base+'/chess-lab/Games/'+file,'utf8').trim().split(/\n\s*\n(?=\[Event)/))
 .map(pgn=>({pgn,review:Core.build({Chess,pgn})}));
let browser,server,origin;const records=[],errors=[];
const out=process.env.CHESS_TOP_PICKS_EVIDENCE_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'chess-top-picks-'));
test.before(async()=>{
 fs.mkdirSync(out,{recursive:true});const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
 server=http.createServer((req,res)=>{const u=new URL(req.url,'http://fixture'),f=path.resolve(base,'.'+decodeURIComponent(u.pathname)+(u.pathname.endsWith('/')?'index.html':''));
  if(!f.startsWith(base+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(f,(err,b)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':types[path.extname(f)]||'text/plain','cache-control':'no-cache'}).end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true});
});
test.after(async()=>{
 fs.writeFileSync(path.join(out,'top-picks-browser.json'),JSON.stringify({schema:'chessbest-top-picks-browser/1',browser:browser?.version(),physicalDevice:false,release:release.version,records,errors},null,2)+'\n');
 await browser?.close();await new Promise(r=>server?.close(r));
});
async function open(t,app=false,sw=false){
 const c=await browser.newContext({viewport:{width:app?430:1440,height:app?874:1000},serviceWorkers:sw?'allow':'block',...(app?{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'}: {})});
 t.after(()=>c.close());const network=[];
 await c.addInitScript(()=>{
  if(!localStorage.getItem('ChessBest:LAB:v2:settings'))localStorage.setItem('ChessBest:LAB:v2:settings',JSON.stringify({cdbEnabled:false,analysisSource:'cdb'}));
  localStorage.setItem('ChessBest:LAB:v2:language','en');
  window.__reviewWorkers=[];const Worker=window.Worker;window.Worker=class extends Worker{constructor(...args){window.__reviewWorkers.push(String(args[0]));super(...args);}};
 });
 await c.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===origin)return route.continue();network.push(u.origin+u.pathname);return route.abort();});
 const p=await c.newPage();p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));
 await p.goto(origin+'/chess-lab/'+(app?'?view=app':''));await p.waitForFunction(()=>!!window.ChessLabHost);
 await p.evaluate(()=>ChessLanguage.apply('en'));return {c,p,network};
}
async function snapshot(p){return p.evaluate(()=>{const r=ChessLabHost.getReviewGame();return {sourcePGN:r.sourcePGN,cursor:r.cursor,totalPly:r.totalPly,fen:ChessLabHost.getContext().fen,sourceIsOriginal:r.sourceIsOriginal};});}
async function choose(p,game){
 await p.evaluate(()=>document.getElementById(document.body.classList.contains('app-mobile')?'appGames':'btnGames').click());
 await p.locator('#gameLibrarySearch').fill(game.review.headers.ChessBestTitle);
 const result=p.locator('.library-result').filter({hasText:game.review.headers.ChessBestTitle});await result.first().click();
 await p.waitForFunction(source=>ChessLabHost.getReviewGame().headers.ChessBestSource===source,game.review.headers.ChessBestSource);
 if(await p.locator('#gameReviewPanel').evaluate(el=>el.hidden))await p.evaluate(()=>document.getElementById('btnGameReview').click());
 await p.locator('#gameReviewReveal').waitFor({state:'visible'});
 assert.equal(await p.locator('#gameReviewGraph').count(),0);
 const before=await snapshot(p);await p.locator('#gameReviewReveal').click();await p.locator('#gameReviewGraph').waitFor({state:'visible'});
 assert.deepEqual(await snapshot(p),before);assert.equal(before.totalPly,game.review.totalPly);assert.equal(before.cursor,Number(game.review.headers.ChessBestAnchorPly));
 return before;
}
for(const app of [false,true])test('TP05/07 actual '+(app?'430px APP':'desktop')+' ten library reviews, reveal, keyboard graph, legal PV and bilingual layout',{timeout:120000},async t=>{
 const {p,network}=await open(t,app),workers=await p.evaluate(()=>__reviewWorkers.length),networkStart=network.length;
 for(let i=0;i<games.length;i++){
  const game=games[i],before=await choose(p,game),entry=Core.resolveEvidence(game.review,registry);
  const graph=p.locator('#gameReviewGraph');await graph.focus();await p.keyboard.press('ArrowLeft');
  await p.waitForFunction(cursor=>ChessLabHost.getReviewGame().cursor===cursor,before.cursor-1);
  assert.equal(await graph.getAttribute('aria-valuenow'),String(before.cursor-1));assert.equal(await p.evaluate(()=>document.activeElement.id),'gameReviewGraph');
  await p.keyboard.press('ArrowRight');await p.waitForFunction(cursor=>ChessLabHost.getReviewGame().cursor===cursor,before.cursor);
  assert.deepEqual(await snapshot(p),before);
  const open=p.getByRole('button',{name:'Explore SF line',exact:true});
  if(await open.count()){
   await open.click();const variation=p.locator('.game-review-saved-position .game-review-variation');
   assert.equal(await variation.locator('.review-square').count(),64);await variation.getByRole('button',{name:'Next',exact:true}).click();
   assert.equal(await variation.getAttribute('data-step'),'1');await variation.getByRole('button',{name:'Close line',exact:true}).click();
   assert(await open.evaluate(el=>document.activeElement===el));assert.deepEqual(await snapshot(p),before);
  }
  for(const lang of ['sl','en']){
   await p.evaluate(lang=>ChessLanguage.apply(lang),lang);assert.equal(await p.locator('html').getAttribute('lang'),lang);
   assert((await p.locator('#gameReviewPanel').innerText()).includes(lang==='sl'?'Potek partije':'Game trajectory'));
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  if(i===0||i===6||i===8){await p.evaluate(()=>{document.getElementById('gameReviewPanel').scrollTop=0;document.getElementById('workspaceDisplay').scrollTop=0;});await p.screenshot({path:path.join(out,(app?'app430':'desktop')+'-'+i+'.png')});}
  records.push({mode:app?'APP430':'desktop',id:entry.id,totalPly:before.totalPly,cursor:before.cursor,sourceUnchanged:true,graphKeyboard:true,pv:await open.count()?'open-close-focus':'not-available',languages:['sl','en']});
 }
 assert.equal(network.length,networkStart,'stored review makes no CDB/provider requests');assert.equal(await p.evaluate(()=>__reviewWorkers.length),workers,'stored review creates no engine workers');
 assert.deepEqual(errors,[]);
});
test('TP07 actual new offline document opens ten bundled review files and an unsupported PGN keeps a clear fallback',{timeout:120000},async t=>{
 const {c,p}=await open(t,false,true);
 await p.waitForFunction(async release=>{const name=(await caches.keys()).find(k=>k.endsWith(release));return name&&(await(await caches.open(name)).keys()).length>=145;},release.version,{timeout:60000});
 const before=await choose(p,games[6]);
 const sealed=await p.evaluate(async()=>{const s=ChessEvidence.createCollector().snapshot({receipt:{fen:ChessLabHost.getContext().fen}},{label:'Disposable Top Picks browser fixture'}),store=ChessEvidence.createStore();await store.put(s);await store.setPinned(s.id,true);return s;});
 await p.close();await c.setOffline(true);const offline=await c.newPage();offline.setDefaultTimeout(12000);
 await offline.goto(origin+'/chess-lab/');await offline.waitForFunction(()=>!!window.ChessLabHost);
 assert.deepEqual(await snapshot(offline),before,'fresh offline document restores full original line and cursor');
 await offline.evaluate(()=>document.getElementById('btnGameReview').click());await offline.locator('#gameReviewReveal').click();await offline.locator('#gameReviewGraph').waitFor({state:'visible'});
 for(const entry of registry.entries){const result=await offline.evaluate(async file=>{const r=await fetch(file);return {ok:r.ok,data:await r.json()};},entry.file);assert(result.ok);assert.equal(result.data.id,entry.alias);}
 assert.deepEqual(await offline.evaluate(id=>ChessEvidence.createStore().get(id),sealed.id),sealed);assert((await offline.evaluate(()=>ChessEvidence.createStore().list())).find(s=>s.id===sealed.id).pinned);
 const ordinary='[Event "Offline unsupported source"]\n[White "Fixture A"]\n[Black "Fixture B"]\n[Result "*"]\n\n1.e4 e5 2.Nf3 *';
 await offline.locator('#filePGN').setInputFiles({name:'unsupported.pgn',mimeType:'text/plain',buffer:Buffer.from(ordinary)});
 await offline.waitForFunction(()=>ChessLabHost.getReviewGame().totalPly===3);
 if(await offline.locator('#gameReviewPanel').evaluate(el=>el.hidden))await offline.evaluate(()=>document.getElementById('btnGameReview').click());
 assert.equal(await offline.locator('#gameReviewGraph').count(),0);assert.match(await offline.locator('#gameReviewPanel').innerText(),/No saved evaluation series/);
 await offline.screenshot({path:path.join(out,'offline-new-document-fallback.png')});
 records.push({mode:'fresh-offline-document',bundleFiles:10,sourceCursorRestored:true,pinnedSealedPayloadUnchanged:true,unsupportedPGN:'recorded-line-fallback',shellAssets:Object.keys(release.assets_sha256).length});
});
