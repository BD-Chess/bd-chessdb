// Actual old CURRENT -> promoted CURRENT service-worker upgrade. The old
// application is read from the verified source commit, not a simulated worker.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const repo=path.resolve(__dirname,'..'),base='9ab90a82c751ad527eeee763fffc61f3e1edab8c';
test('old CURRENT full PGN/cursor, preferences and LAB sentinel survive actual promotion and profile reopen',{timeout:120000},async t=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'current-upgrade-')),old=path.join(tmp,'old');fs.mkdirSync(old);
  const tree=execFileSync('git',['ls-tree','-r','-z',base,'--','public/chess'],{cwd:repo}).toString().split('\0').filter(Boolean);
  for(const row of tree){const [meta,file]=row.split('\t'),sha=meta.split(' ')[2],out=path.join(old,file);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,execFileSync('git',['cat-file','blob',sha],{cwd:repo,maxBuffer:32*1024*1024}));}
  const fixture='[Event "Old CURRENT update fixture"]\n[White "Current A"]\n[Black "Current B"]\n[ChessBestAnchorPly "2"]\n[ChessBestSource "old-current-fixture"]\n[Result "*"]\n\n1. e4 {Keep old CURRENT comment} e5 2. Nf3 Nc6 3. Bb5 a6 *';
  let promoted=false,context;
  const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.webmanifest':'application/manifest+json'};
  const server=http.createServer((req,res)=>{
    const u=new URL(req.url,'http://fixture');if(u.pathname==='/seed'){res.writeHead(200,{'content-type':'text/html'}).end('<title>Disposable seed</title>');return;}
    const rel=decodeURIComponent(u.pathname)+(u.pathname.endsWith('/')?'index.html':''),p=path.resolve(promoted?repo:old,'public','.'+rel);
    if(!p.startsWith(path.resolve(promoted?repo:old,'public')+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(p,(e,b)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream','cache-control':'no-store'}).end(b);});
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  t.after(async()=>{await context?.close();await new Promise(r=>server.close(r));fs.rmSync(tmp,{recursive:true,force:true});});
  const open=async()=>{context=await chromium.launchPersistentContext(path.join(tmp,'profile'),{headless:true,viewport:{width:1440,height:1000}});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());return context.pages()[0];};
  let page=await open();page.setDefaultTimeout(20000);await page.goto(origin+'/seed');
  await page.evaluate(pgn=>{
    localStorage.setItem('ChessBest:CURRENT:v2:game',pgn);
    localStorage.setItem('ChessBest:CURRENT:v2:top-pick',JSON.stringify({cursor:2,totalPlies:6,pgnLength:pgn.length,source:'old-current-fixture'}));
    localStorage.setItem('ChessBest:CURRENT:v2:settings',JSON.stringify({sfAnalysisDepth:21,dccClickAction:'details'}));
    localStorage.setItem('ChessBest:CURRENT:v2:layout',JSON.stringify({workspaceWidth:500,compact:true}));
    localStorage.setItem('ChessBest:CURRENT:v2:language','sl');localStorage.setItem('ChessBest:LAB:v2:game','independent LAB game');
  },fixture);
  await page.goto(origin+'/chess/');await page.waitForFunction(()=>!!window.ChessLabHost);
  const snapshot=()=>page.evaluate(()=>{const h=ChessLabHost,r=h.getReviewGame();return {sans:r.moves.map(m=>m.san),cursor:r.cursor,total:r.totalPly,fen:h.getContext().fen,headers:r.headers,pgn:r.sourcePGN,depth:h.getContext().settings.sfAnalysisDepth,lab:localStorage.getItem('ChessBest:LAB:v2:game'),layout:localStorage.getItem('ChessBest:CURRENT:v2:layout'),language:localStorage.getItem('ChessBest:CURRENT:v2:language')};});
  const before=await snapshot();assert.equal(before.total,6);assert.equal(before.cursor,2);assert.equal(before.depth,21);
  await page.waitForFunction(()=>navigator.serviceWorker.controller?.scriptURL.endsWith('/engine-sw.js'));
  promoted=true;await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});
  await page.locator('#chessPwaUpdate').waitFor({state:'visible'});await Promise.all([page.waitForNavigation({waitUntil:'load'}),page.locator('#chessPwaUpdate').click()]);await page.waitForFunction(()=>!!window.ChessLabHost);
  assert.deepEqual(await snapshot(),before);assert.equal(await page.locator('.bd-version-selector').count(),0);
  await context.close();context=null;page=await open();await page.goto(origin+'/chess/');await page.waitForFunction(()=>!!window.ChessLabHost);assert.deepEqual(await snapshot(),before);
  const dir=process.env.CHESS_CURRENT_EVIDENCE_DIR;if(dir){fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'old-current-upgrade.json'),JSON.stringify({base,before,after:await snapshot(),physicalDevice:false},null,2)+'\n');}
});
