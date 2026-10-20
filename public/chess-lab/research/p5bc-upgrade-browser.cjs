'use strict';
// Immutable pre-P5BC LAB, actual parent worker, both deployment prefixes.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../../..'),baseline='4849d5075ebdf4cf8ef440828fca3c9e65dab201',receipts=[];
let browser,server,origin,current=false;const cache=new Map();
test.before(async()=>{
  const types={'.html':'text/html','.js':'application/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.css':'text/css','.wasm':'application/wasm','.ico':'image/x-icon'};
  server=http.createServer((req,res)=>{const rel=new URL(req.url,'http://fixture').pathname.replace(/^\/bd-chessdb(?=\/)/,'');
    if(rel==='/'||rel==='/index.html')return res.writeHead(200,{'content-type':'text/html','cache-control':'no-store'}).end('<title>Parent fixture</title><script>navigator.serviceWorker.register("sw.js",{scope:"./"}).then(()=>navigator.serviceWorker.ready).then(()=>window.parentReady=true)</script>');
    if(rel.includes('..'))return res.writeHead(400).end();const name='public'+(rel.endsWith('/')?rel+'index.html':rel);
    try{let data;if(!current&&rel.startsWith('/chess-lab/')){if(!cache.has(name))cache.set(name,execFileSync('git',['show',baseline+':'+name],{cwd:root,maxBuffer:20*1024*1024,stdio:['ignore','pipe','ignore']}));data=cache.get(name);}else data=fs.readFileSync(path.join(root,name));
      res.writeHead(200,{'content-type':types[path.extname(name)]||'application/octet-stream','cache-control':'no-store'}).end(data);
    }catch(_){if(!rel.startsWith('/chess-lab/'))res.writeHead(200,{'content-type':'text/plain'}).end('controlled unrelated parent asset');else res.writeHead(404).end();}
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({headless:true});
});
test.after(async()=>{const dir=process.env.CHESS_P5BC_EVIDENCE_DIR;if(dir){fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'p5bc-upgrade.json'),JSON.stringify({baseline,browser:browser?.version(),receipts,parentUnrelatedAssetsFixtures:true,physicalDevice:false},null,2));}await browser?.close();await new Promise(r=>server.close(r));});
for(const prefix of ['/','/bd-chessdb/'])test('BC-10 actual pre-P5BC update, parent scope and idle second tab at '+prefix,{timeout:80000},async t=>{
  current=false;const c=await browser.newContext({viewport:{width:1280,height:900}});t.after(()=>c.close());await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await c.addInitScript(()=>{if(!localStorage.getItem('ChessBest:LAB:v2:settings'))localStorage.setItem('ChessBest:LAB:v2:settings',JSON.stringify({cdbEnabled:false,dccEnabled:false}));});
  const p=await c.newPage();await p.goto(origin+prefix);await p.waitForFunction(()=>window.parentReady&&navigator.serviceWorker.controller);
  await p.goto(origin+prefix+'chess-lab/');await p.waitForFunction(()=>window.ChessLabHost&&navigator.serviceWorker.controller?.scriptURL.endsWith('/chess-lab/engine-sw.js'));
  await p.locator('#filePGN').setInputFiles({name:'upgrade.pgn',mimeType:'application/x-chess-pgn',buffer:Buffer.from('[Event "P5BC upgrade"]\n[Result "*"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *')});await p.waitForFunction(()=>window.ChessLabHost.getReviewGame().totalPly===6);
  const seeded=await p.evaluate(async()=>{const h=ChessLabHost;h.navigateReview(2);
    const fen=h.getContext().fen,s=ChessEvidence.createCollector().snapshot({receipt:{fen}},{label:'pre-P5BC retained'});await ChessEvidence.createStore().put(s);await h.onSaveLine({fen,pv:['g1f3'],source:'P5BC upgrade Study'});
    h.navigateReview(2);await h.prepareData();if(h.saveBeforeUpdate()!==true)throw Error('Old workspace was not saved.');localStorage.setItem('ChessBest:CURRENT:v2:upgrade-sentinel','CURRENT retained');
    return {s,game:h.getReviewGame(),study:localStorage.getItem('ChessBest:LAB:v2:studies')};});
  const other=await c.newPage();await other.goto(origin+prefix+'chess-lab/');await other.waitForFunction(()=>!!window.ChessLabHost);await other.evaluate(()=>window.__tabIdentity='old-unreloaded-tab');let otherNavigations=0;other.on('framenavigated',f=>{if(f===other.mainFrame())otherNavigations++;});
  current=true;await p.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});await p.locator('#chessPwaUpdate').waitFor({state:'visible'});await p.waitForFunction(()=>ChessLabHost.saveBeforeUpdate()===true);
  await Promise.all([p.waitForNavigation({waitUntil:'load'}),p.locator('#chessPwaUpdate').click()]);await p.waitForFunction(()=>!!window.ChessLabHost&&!!window.ChessDataCore.migrate);
  assert.equal(otherNavigations,0);assert.equal(await other.evaluate(()=>window.__tabIdentity),'old-unreloaded-tab');
  assert.deepEqual(await p.evaluate(()=>ChessLabHost.getReviewGame()),seeded.game);
  const semantic=text=>{const v=JSON.parse(text);delete v.revision;delete v.appliedOperations;return v;};
  assert.deepEqual(semantic(await p.evaluate(()=>localStorage.getItem('ChessBest:LAB:v2:studies'))),semantic(seeded.study));
  const pin=await p.evaluate(async id=>{const e=ChessEvidence.createStore();const r=await e.setPinned(id,true);return {r,s:await e.get(id),list:await e.list()};},seeded.s.id);assert.equal(pin.r.persistent,true);assert.deepEqual(pin.s,seeded.s);assert(pin.list.find(x=>x.id===seeded.s.id)?.pinned);
  await other.evaluate(async id=>{const e=ChessEvidence.createStore();await e.remove(id);},seeded.s.id);assert((await p.evaluate(()=>ChessEvidence.createStore().list())).find(x=>x.id===seeded.s.id)?.pinned);
  await other.close();await p.close();await c.setOffline(true);const cold=await c.newPage();await cold.goto(origin+prefix+'chess-lab/');await cold.waitForFunction(()=>!!window.ChessLabHost);
  assert.deepEqual(await cold.evaluate(()=>ChessLabHost.getReviewGame()),seeded.game);assert((await cold.evaluate(()=>ChessEvidence.createStore().list())).find(x=>x.id===seeded.s.id)?.pinned);
  assert.equal(await cold.evaluate(()=>localStorage.getItem('ChessBest:CURRENT:v2:upgrade-sentinel')),'CURRENT retained');
  const ready=await cold.evaluate(()=>ChessEngineAssetStore.inspect('sf-lite'));assert.equal(ready.offlineReady,true);
  receipts.push({prefix,baseline,secondTabReloads:otherNavigations,sealedId:seeded.s.id,fullGamePlies:seeded.game.totalPly,cursor:seeded.game.cursor,shell:ready.shell.release,offlineColdNewDocument:true});
});
