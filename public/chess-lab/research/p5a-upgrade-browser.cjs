// Actual baseline LAB -> P5A explicit worker update, using immutable Git bytes.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const repo=path.resolve(__dirname,'../../..'),baseline='87469d421bb5cabfdb91c17179e929648d9d26af';
test('baseline LAB explicit PWA Update preserves full game/cursor and DATA works in emulated offline mode',{timeout:90000},async t=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'chess-p5a-upgrade-')),evidence=process.env.CHESS_P5A_EVIDENCE_DIR||tmp;
  fs.mkdirSync(evidence,{recursive:true});let current=false,context;const cache=new Map(),errors=[];
  const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.css':'text/css','.wasm':'application/wasm','.webmanifest':'application/manifest+json'};
  const server=http.createServer((request,response)=>{
    const pathname=new URL(request.url,'http://fixture').pathname,rel='public'+(pathname.endsWith('/')?pathname+'index.html':pathname);
    if(pathname.includes('..')||!pathname.startsWith('/chess-lab/')){response.writeHead(404).end();return;}
    try{let bytes;
      if(current)bytes=fs.readFileSync(path.join(repo,rel));
      else {if(!cache.has(rel))cache.set(rel,execFileSync('git',['show','291be21d8a20d03e83a66a251233494205477e82:'+rel.replace('public/chess-lab/','')],{cwd:repo,maxBuffer:20*1024*1024,stdio:['ignore','pipe','ignore']}));bytes=cache.get(rel);}
      response.writeHead(200,{'Content-Type':mime[path.extname(rel)]||'text/plain','Cache-Control':'no-store'});response.end(bytes);
    }catch(_){response.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  t.after(async()=>{if(context?.pages()[0])fs.writeFileSync(path.join(evidence,'upgrade-final-dom.html'),await context.pages()[0].content());await context?.close();await new Promise(r=>server.close(r));fs.rmSync(tmp,{recursive:true,force:true});});
  context=await chromium.launchPersistentContext(path.join(tmp,'profile'),{headless:true,viewport:{width:1280,height:800}});context.setDefaultTimeout(15000);
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());const page=context.pages()[0];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/chess-lab/');await page.waitForFunction(()=>!!window.ChessLabHost);
  const file=path.join(tmp,'source.pgn'),pgn='[Event "P5A actual baseline update"]\n[Result "*"]\n\n1. e4 {P5A preservation} e5 2. Nf3 Nc6 3. Bb5 a6 *';fs.writeFileSync(file,pgn);
  await page.locator('#btnWorkspaceMore').click();await page.locator('#filePGN').setInputFiles(file);await page.waitForFunction(()=>window.ChessLabHost.getReviewGame().totalPly===6);
  await page.evaluate(()=>window.ChessLabHost.navigateReview(2));
  await page.waitForFunction(()=>navigator.serviceWorker.controller?.scriptURL.endsWith('/engine-sw.js'));
  if(await page.locator('#btnCloseLabTools').isVisible())await page.locator('#btnCloseLabTools').click();
  current=true;await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});
  await page.locator('#chessPwaUpdate').waitFor({state:'visible'});
  await page.waitForFunction(()=>window.ChessLabHost.saveBeforeUpdate()===true);
  await Promise.all([page.waitForNavigation({waitUntil:'load'}),page.locator('#chessPwaUpdate').click()]);await page.waitForFunction(()=>!!window.ChessLabHost&&!!window.ChessDataGuard);
  const restored=await page.evaluate(()=>{const r=window.ChessLabHost.getReviewGame();return {pgn:r.sourcePGN,cursor:r.cursor,plies:r.totalPly};});
  assert.deepEqual(restored,{pgn,cursor:2,plies:6});assert.equal(await page.locator('#btnSaveData').count(),1);
  await context.setOffline(true);await page.reload();await page.waitForFunction(()=>!!window.ChessLabHost&&!!window.ChessDataGuard);
  await page.locator('#btnWorkspaceMore').click();const download=page.waitForEvent('download');await page.locator('#btnSaveData').click();
  const output=path.join(evidence,'baseline-upgrade-offline-DATA.json');await(await download).saveAs(output);const data=JSON.parse(fs.readFileSync(output));
  assert.equal(data.payload.game.pgn,pgn);assert.equal(data.payload.game.resume.cursor,2);assert.match(data.source.release,/^lab-[0-9a-f]{16}$/);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(evidence,'pwa-upgrade-results.json'),JSON.stringify({baseline,release:data.source.release,actualExplicitUpdate:true,emulatedOffline:true,physicalOffline:false,restored,errors},null,2));
});
