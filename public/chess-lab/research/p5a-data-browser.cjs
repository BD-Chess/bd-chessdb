const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {chromium}=require('playwright');
const repo=path.resolve(__dirname,'../../..');
const evidence=process.env.CHESS_P5A_EVIDENCE_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'chess-p5a-evidence-'));
fs.mkdirSync(evidence,{recursive:true});
const mime={'.js':'application/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.wasm':'application/wasm','.json':'application/json','.webmanifest':'application/manifest+json'};
test('DATA real Save download → Load preview/cancel/confirm → reload/reopen → repeated import; stale preview and cross-tab writer exclusion', {timeout:120000},async t=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'chess-p5a-'));
  const server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://fixture').pathname;
    if(pathname.includes('..')){res.writeHead(400).end();return;}
    const f=path.join(repo,'public',pathname.endsWith('/')?pathname+'index.html':pathname);
    if(!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'text/plain','Cache-Control':'no-store'});fs.createReadStream(f).pipe(res);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+server.address().port;
  let ctx;const errors=[],checks=[];
  const open=async(name)=>{
    ctx=await chromium.launchPersistentContext(path.join(tmp,name),{headless:true,viewport:{width:1440,height:1000}});
    ctx.setDefaultTimeout(10000);
    await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    if(name==='fallback')await ctx.addInitScript(()=>{localStorage.setItem('ChessBest:LAB:v2:migration',JSON.stringify({version:1,complete:true,local:{},databases:{},warnings:[]}));Object.defineProperty(window,'indexedDB',{value:undefined});});
    const page=ctx.pages()[0];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/chess-lab/');await page.waitForFunction(()=>!!window.ChessLabHost);
    return page;
  };
  t.after(async()=>{if(ctx?.pages()[0]){fs.writeFileSync(path.join(evidence,'layout-debug.json'),JSON.stringify(await ctx.pages()[0].evaluate(()=>{const d=document.getElementById('dataDialog');return d?{bounds:d.getBoundingClientRect().toJSON(),maxHeight:getComputedStyle(d).maxHeight,top:getComputedStyle(d).top,scrollHeight:d.scrollHeight,scrollTop:d.scrollTop,innerHeight,screenTop:getComputedStyle(document.body).getPropertyValue('--app-screen-top')}:{};}),null,2));fs.writeFileSync(path.join(evidence,'final-dom.html'),await ctx.pages()[0].content());}fs.writeFileSync(path.join(evidence,'browser-results.json'),JSON.stringify({checks,errors},null,2));await ctx?.close();await new Promise(r=>server.close(r));fs.rmSync(tmp,{recursive:true,force:true});});
  const more=async(page)=>{if(!await page.locator('#btnSaveData').isVisible()){const desktop=page.locator('#btnWorkspaceMore');if(await desktop.isVisible())await desktop.click();else await page.locator('#appMore').click();}};
  const save=async(page,name)=>{
    await more(page);const event=page.waitForEvent('download');await page.locator('#btnSaveData').click();
    const downloaded=await event;const out=path.join(evidence,name);await downloaded.saveAs(out);
    await page.locator('#dataDialog button').filter({hasText:/^Close$|^Zapri$/}).click();return {file:out,data:JSON.parse(fs.readFileSync(out,'utf8'))};
  };
  const load=async(page,file)=>{await more(page);await page.locator('#fileData').setInputFiles(file);await page.locator('#dataDialog button').filter({hasText:/Restore entire workspace|Obnovi celoten/}).waitFor();};
  const restore=async(page)=>{await page.locator('#dataDialog button').filter({hasText:/Restore entire workspace|Obnovi celoten/}).click();await page.getByRole('button',{name:'Reload workspace',exact:true}).waitFor();await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.getByRole('button',{name:'Reload workspace',exact:true}).click()]);await page.waitForFunction(()=>!!window.ChessLabHost);};
  let page=await open('source');
  const seed=await page.evaluate(async()=>{
    const S=window.ChessStudy,C=window.Chess,board=new C();let seed=1234567;
    for(let i=0;i<80;i++){const moves=board.moves();if(!moves.length)break;seed=(Math.imul(seed,1664525)+1013904223)>>>0;board.move(moves[seed%moves.length]);}
    board.header('Event','Synthetic long DATA game','White','Fixture A','Black','Fixture B','Result','*');
    const pgn=board.pgn().replace(/1\. (\S+)/,'1. $1 {Keep comment} (1. d4 d5)');
    const study=S.parsePGN(C,'1. e4 (1. d4 d5) e5 2. Nf3 *');study.id='s-source';study.title='Synthetic <img src=x onerror=globalThis.injected=true>';
    const previous=JSON.parse(localStorage.getItem('ChessBest:LAB:v2:studies')||'null');
    const collection={...window.ChessStudyStore.empty(),revision:previous?.revision||0,appliedOperations:previous?.appliedOperations||[],studies:[study],activeId:study.id};
    const snapshot=window.ChessEvidence.createCollector();snapshot.capture({kind:'score',fen:new C().fen(),source:'synthetic',response:12});
    await window.ChessEvidence.createStore().put(snapshot.snapshot({receipt:{fen:new C().fen()}},{label:'synthetic',createdAt:'2026-10-18T00:00:00Z'}));
    const sim=window.ChessSimStore.create();await sim.saveEvent({id:'e-source',state:'paused',name:'Synthetic tournament',games:[{runId:'r-source',state:'paused'}]});
    await sim.saveRun({id:'r-source',eventId:'e-source',state:'paused',pgn:'1. e4 *',trace:[]});
    localStorage.setItem('ChessBest:LAB:v2:studies',JSON.stringify(collection));
    localStorage.setItem('ChessBest:CURRENT:v2:game','CURRENT-SENTINEL');localStorage.setItem('other-app-sentinel','OTHER-SENTINEL');
    localStorage.setItem('ChessBest:LAB:v2:lichess-token','SYNTHETIC-TOKEN-DO-NOT-EXPORT');
    localStorage.setItem('ChessBest:LAB:v2:preview-width','402');localStorage.setItem('ChessBest:LAB:v2:showTopLine','0');
    return {pgn,plies:board.history().length};
  });
  const pgn=path.join(tmp,'game.pgn');fs.writeFileSync(pgn,seed.pgn);
  await more(page);await page.locator('#filePGN').setInputFiles(pgn);await page.waitForFunction(n=>window.ChessLabHost.getReviewGame().totalPly===n,seed.plies).catch(async error=>{fs.writeFileSync(path.join(evidence,'import-debug.json'),JSON.stringify({seed,state:await page.evaluate(()=>({r:window.ChessLabHost.getReviewGame(),alerts:[...document.querySelectorAll('[role=status]')].map(n=>n.textContent)}))},null,2));throw error;});
  await page.evaluate(()=>window.ChessLabHost.navigateReview(30));
  const first=await save(page,'source.json');assert.equal(first.data.payload.game.resume.cursor,30);assert.equal(first.data.payload.game.resume.totalPlies,seed.plies);
  assert.match(first.data.payload.game.pgn,/Keep comment/);assert(!fs.readFileSync(first.file,'utf8').includes('SYNTHETIC-TOKEN'));checks.push('actual-save-file-long-game-and-sections');
  await ctx.close();page=await open('target');
  await page.evaluate(()=>{localStorage.setItem('ChessBest:CURRENT:v2:game','TARGET-CURRENT');localStorage.setItem('other-app-sentinel','TARGET-OTHER');});
  const before=await page.evaluate(()=>window.ChessDataGuard.capture(false).then(v=>v.sha256));
  await load(page,first.file);assert.equal(await page.evaluate(()=>globalThis.injected),undefined);
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.ChessDataGuard.capture(false).then(v=>v.sha256)),before);checks.push('preview-escape-no-write');
  await load(page,first.file);await restore(page);
  assert.equal(await page.evaluate(()=>window.ChessDataGuard.restoredPaused),true);assert.equal(page.workers().length,0);checks.push('restored-engine-searches-stay-stopped');
  assert.equal(await page.evaluate(()=>window.ChessLabHost.getReviewGame().cursor),30);
  const reexport=await save(page,'reexport.json');
  assert.deepEqual(reexport.data.payload.game,first.data.payload.game);
  const sem=v=>{v=JSON.parse(JSON.stringify(v));if(v.collection){delete v.collection.revision;delete v.collection.appliedOperations;}return v;};
  for(const key of ['studies','evidence','simulation','evaluations','recovery'])assert.deepEqual(sem(reexport.data.payload[key]),sem(first.data.payload[key]));checks.push('file-restore-reload-semantic-comparison');
  await ctx.close();page=await open('target');assert.equal(await page.evaluate(()=>window.ChessLabHost.getReviewGame().cursor),30);checks.push('browser-process-reopen');
  await load(page,first.file);await restore(page);const again=await save(page,'repeated.json');assert.equal(again.data.payload.simulation.runs.length,1);assert.equal(again.data.payload.evidence.snapshots.length,first.data.payload.evidence.snapshots.length);checks.push('idempotent-second-import');
  assert.deepEqual(await page.evaluate(()=>[localStorage.getItem('ChessBest:CURRENT:v2:game'),localStorage.getItem('other-app-sentinel')]),['TARGET-CURRENT','TARGET-OTHER']);checks.push('target-current-and-other-app-isolation');
  await load(page,first.file);
  await page.evaluate(()=>localStorage.setItem(window.ChessDataGuard.key('ChessBest:LAB:v2:showTopLine'),'1'));
  await page.getByRole('button',{name:'Restore entire workspace',exact:true}).click();await page.getByText('DATA operation stopped',{exact:true}).waitFor();assert.match(await page.locator('#dataDialog').innerText(),/stale/);await page.locator('#dataDialog button').click();checks.push('stale-preview-refused');
  const other=await ctx.newPage();await other.goto(origin+'/chess-lab/');await other.waitForFunction(()=>!!window.ChessLabHost);
  await other.evaluate(async()=>{const sim=window.ChessSimStore.create();await sim.saveRun({id:'other-tab-run',state:'paused',pgn:'1. d4 *',trace:[]});});
  await load(page,first.file);await page.getByRole('button',{name:'Restore entire workspace',exact:true}).click();await page.getByText('DATA operation stopped',{exact:true}).waitFor();assert.match(await page.locator('#dataDialog').innerText(),/other LAB tabs/);await page.locator('#dataDialog button').click();await other.close();checks.push('real-other-tab-sim-writer-excluded');
  for(const size of [{width:375,height:812},{width:402,height:874},{width:430,height:932},{width:874,height:402},{width:1280,height:520}]) {
    await page.setViewportSize(size);await more(page);assert(await page.locator('#btnSaveData').isVisible());assert(await page.locator('#btnLoadData').isVisible());
    const box=await page.locator('#btnLoadData').boundingBox();assert(box.x>=0&&box.x+box.width<=size.width+1);
  }
  checks.push('desktop-mobile-landscape-low-screen');
  await page.goto(origin+'/chess-lab/?view=app');await page.waitForFunction(()=>!!window.ChessLabHost);
  for(const size of [{width:375,height:812},{width:402,height:874},{width:430,height:932},{width:874,height:402}]) {
    await page.setViewportSize(size);await more(page);assert(await page.locator('#btnSaveData').isVisible());
    await page.evaluate(()=>window.ChessLanguage.apply('sl'));assert.equal(await page.locator('#btnSaveData').innerText(),'Shrani DATA');
    await page.evaluate(()=>window.ChessLanguage.apply('en'));assert.equal(await page.locator('#btnSaveData').innerText(),'Save DATA');
    await page.evaluate(()=>window.ChessLanguage.apply('sl'));assert.equal(await page.locator('#btnLoadData').innerText(),'Naloži DATA');
    await page.evaluate(()=>window.ChessLanguage.apply('en'));
  }
  checks.push('APP-portrait-landscape-and-SL-EN-SL');
  // Native preview contains no HTML interpretation and stays in both themes.
  await load(page,first.file);for(const light of [true,false]){await page.evaluate(v=>document.body.classList.toggle('light-theme',v),light);const bg=await page.locator('#dataDialog').evaluate(n=>getComputedStyle(n).backgroundColor);assert(light?bg.includes('247'):!bg.includes('247'));}
  await page.keyboard.press('Escape');checks.push('preview-light-dark-focus-escape');

  // Close/reopen while an actual restore is suspended after durable staging.
  await load(page,first.file);
  const beforeCrash=await page.evaluate(()=>window.ChessDataGuard.capture(false));fs.writeFileSync(path.join(evidence,'before-staged-crash.json'),JSON.stringify(beforeCrash));
  await page.evaluate(()=>{const current=window.ChessDataGuard.key('ChessBest:LAB:v2:evidence'),open=indexedDB.open.bind(indexedDB);indexedDB.open=(name,...args)=>{if(name!==current&&name.includes(':DATA:g-')&&name.endsWith(':evidence')){window.stagedCrashReached=true;return {};}return open(name,...args);};});
  await page.getByRole('button',{name:'Restore entire workspace',exact:true}).click();await page.waitForFunction(()=>window.stagedCrashReached);
  await ctx.close();page=await open('target');const afterCrash=await page.evaluate(()=>window.ChessDataGuard.capture(false));fs.writeFileSync(path.join(evidence,'after-staged-crash.json'),JSON.stringify(afterCrash));
  assert.equal(await page.evaluate(()=>window.ChessDataGuard.recovery().then(v=>v.sha256)),beforeCrash.sha256);
  for(const key of ['game','studies','evidence','simulation','evaluations','recovery'])assert.deepEqual(sem(afterCrash.payload[key]),sem(beforeCrash.payload[key]));checks.push('process-reopen-during-staged-keeps-original');
  // Crash after the pointer write, before verification/commit receipt.
  await load(page,first.file);
  await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){set.call(this,k,v);if(k==='ChessBest:LAB:v2:DATA-active'){window.committingCrashReached=true;crypto.subtle.digest=()=>new Promise(()=>{});}};});
  await page.getByRole('button',{name:'Restore entire workspace',exact:true}).click();await page.waitForFunction(()=>window.committingCrashReached);
  await ctx.close();page=await open('target');assert.equal(await page.evaluate(()=>window.ChessLabHost.getReviewGame().cursor),30);
  const recovered=await save(page,'after-committing-reopen.json');assert.deepEqual(recovered.data.payload.game,first.data.payload.game);checks.push('process-reopen-during-committing-verifies-before-boot');
  // Real browser localStorage fallback and genuine in-memory Evidence pending.
  await ctx.close();page=await open('fallback');
  await page.evaluate(async()=>{
    const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='ChessBest:LAB:v2:evidence-fallback')throw Object.assign(Error('synthetic quota'),{name:'QuotaExceededError'});return set.call(this,k,v);};
    const E=window.ChessEvidence,c=E.createCollector(),fen=new window.Chess().fen();c.capture({kind:'score',fen,source:'memory fixture',response:42});
    const store=window.ChessLabHost.dataStores().evidence;await store.put(c.snapshot({receipt:{fen}},{label:'Memory only',createdAt:'2026-10-18T00:00:00Z'}));
    if(!store.status().unsaved)throw Error('Memory-only Evidence fixture was not created.');
  });
  const fallback=await save(page,'fallback-memory.json');assert.equal(fallback.data.payload.evidence.snapshots.length,1);assert.equal(fallback.data.payload.recovery.evidencePending.length,1);
  await ctx.close();page=await open('fallback');await load(page,fallback.file);await restore(page);
  const fallbackRestored=await save(page,'fallback-restored.json');assert.equal(fallbackRestored.data.payload.evidence.snapshots.length,1);assert.equal(fallbackRestored.data.payload.recovery.evidencePending.length,1);checks.push('browser-localStorage-fallback-memory-pending-preserved');
  assert.deepEqual(errors,[]);
});
