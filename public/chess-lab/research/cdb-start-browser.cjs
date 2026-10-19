// Actual Sim form, real browser and real engine runtimes; controlled CDB HTTP.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {chromium}=require('playwright'),{Chess}=require('../js/chess.min.js');
const repo=path.resolve(__dirname,'../../..'),dir=process.env.CHESS_CDB_EVIDENCE_DIR||path.join(process.env.CHESS_RESUME_EVIDENCE_DIR||os.tmpdir(),'cdb-start');
fs.mkdirSync(dir,{recursive:true});let server,browser,origin;const records=[],errors=[];
const mime={'.js':'application/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.wasm':'application/wasm','.json':'application/json','.webmanifest':'application/manifest+json'};
before(async()=>{
  server=http.createServer((req,res)=>{const u=new URL(req.url,'http://fixture'),p=path.join(repo,'public',u.pathname.endsWith('/')?u.pathname+'index.html':u.pathname);if(!p.startsWith(path.join(repo,'public'))||!fs.existsSync(p)||!fs.statSync(p).isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(p).pipe(res);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({headless:true});
});
after(async()=>{fs.writeFileSync(path.join(dir,'browser-results.json'),JSON.stringify({records,errors,provider:'controlled HTTP CDB fixtures; actual engine runtimes'},null,2));await browser?.close();await new Promise(r=>server?.close(r));});
async function open(t,{app=false,width=1440,height=1000,hold=false,phone=app&&width<600}={}) {
  const context=await browser.newContext({viewport:{width,height},...(phone?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',isMobile:true,hasTouch:true}:{})});t.after(()=>context.close());
  await context.addInitScript(()=>{
    if(!localStorage.getItem('ChessBest:LAB:v2:settings'))localStorage.setItem('ChessBest:LAB:v2:settings',JSON.stringify({dccEnabled:false,showSimEval:false,analysisSource:'cdb',cdbEnabled:true}));
    const qa=window.__CDBQA={workers:[],prepared:[],started:[],moves:[],prefixHTTP:[],pauseAt:1};
    const NativeWorker=window.Worker;window.Worker=function(...a){qa.workers.push({url:String(a[0]),at:performance.now()});return new NativeWorker(...a);};window.Worker.prototype=NativeWorker.prototype;
    Object.defineProperty(window,'ChessSimRunner',{configurable:true,set(api){delete window.ChessSimRunner;window.ChessSimRunner=api;const create=api.create;api.create=options=>{const c=options.callbacks,original={...c};let runner;
      c.prepared=o=>{qa.prepared.push({opening:o,workers:qa.workers.length,at:performance.now()});original.prepared?.(o);};
      c.started=(run,event)=>{qa.started.push({run:JSON.parse(JSON.stringify(run)),clock:options.workspace.clockSnapshot()});original.started?.(run,event);};
      c.move=(run,event)=>{original.move?.(run,event);qa.moves.push(JSON.parse(JSON.stringify(run)));if(run.trace.length>=qa.pauseAt)void runner.pause('bounded browser QA');};
      runner=create(options);qa.runner=runner;return runner;};}});
  });
  let release;const gate=new Promise(r=>release=r);
  await context.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.origin===origin&&!u.pathname.startsWith('/.netlify/'))return route.continue();
    if(u.hostname==='www.chessdb.cn'||u.pathname.includes('queryall')) {
      if(hold)await gate;
      const fen=u.searchParams.get('board'),b=new Chess(fen),legal=b.moves({verbose:true});
      const root=fen===new Chess().fen(),selected=root?legal:legal.filter(m=>m.piece==='p');
      const moves=selected.length?selected:legal;
      const body=(u.searchParams.get('action')||'queryall')==='queryall'?moves.map(m=>'move:'+m.from+m.to+(m.promotion||'')+',score:20,rank:0').join('|'):'eval:20';
      await new Promise(r=>setTimeout(r,8));try{await route.fulfill({status:200,contentType:'text/plain',headers:{'access-control-allow-origin':'*'},body});}catch(_){};return;
    }
    return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
  await page.goto(origin+'/chess-lab/'+(app?'?view=app':''));await page.waitForFunction(()=>window.ChessLabHost&&window.__CDBQA.runner);
  return {page,context,release,app};
}
async function sim(h) {await h.page.locator(h.app?'#appSim':'#btnSim').click();await h.page.locator('#simTournamentDialog').waitFor({state:'visible'});}
const el=(p,k)=>p.locator('[data-ui="'+k+'"]');
async function saved(page) {return page.evaluate(async()=>{const s=window.ChessSimStore.create();return {events:await s.listEvents(),runs:await s.listRuns()};});}
test('CDB controls render without overflow in desktop/APP 375/402/430, SL/EN, dark/light', {timeout:90000},async t=>{
  for(const [app,width]of [[false,1440],[true,375],[true,402],[true,430],[true,1440]]) {
    const h=await open(t,{app,width,height:app?874:1000}),p=h.page;await sim(h);
    for(const light of [false,true])for(const lang of ['sl','en']) {
      await p.evaluate(({light,lang})=>{document.body.classList.toggle('light-theme',light);window.ChessLanguage.apply(lang);},{light,lang});
      await el(p,'cdb-start-mode').selectOption('random_side');await el(p,'cdb-start-mode').selectOption('random_main');
      const g=await p.locator('#simTournamentDialog').evaluate(d=>({width:innerWidth,scroll:d.scrollWidth,client:d.clientWidth,rect:d.getBoundingClientRect().toJSON(),source:d.querySelector('[data-ui="opening-source"] option:checked').textContent,controls:[...d.querySelectorAll('[data-ui^="cdb-start-"]')].filter(e=>!e.closest('[hidden]')).map(e=>({rect:e.getBoundingClientRect().toJSON(),disabled:e.disabled}))}));
      records.push({case:'UI',app,width,light,lang,...g});await p.screenshot({path:path.join(dir,'latest-ui.png')});
      assert(g.scroll<=g.client+1);assert(g.rect.x>=0&&g.rect.right<=g.width+1);assert.equal(g.source,lang==='sl'?'Nova partija · začetek s CDB':'New game · CDB start');
      const labels=await p.evaluate(()=>({opening:document.querySelector('[data-ui="cdb-start-mode"]').parentElement.firstChild.textContent.trim(),after:document.querySelector('[data-ui="cdb-start-moves"]').parentElement.firstChild.textContent.trim(),status:window.ChessLanguage.translate('CDB start incomplete · 3/8 moves · CDB disabled · Engine play from move 4 · preparation 2.0 s')}));
      assert.equal(labels.opening,lang==='sl'?'Otvoritev':'Opening');assert.equal(labels.after,lang==='sl'?'Začni po':'Start after');
      if(lang==='sl'){assert.match(labels.status,/Nepopoln začetek s CDB/);assert.match(labels.status,/3\/8 potez/);assert.match(labels.status,/Motorja igrata od 4. poteze/);assert.match(labels.status,/priprava 2.0 s/);}
      assert(g.controls.every(c=>c.rect.width>=17&&!c.disabled));
      await el(p,'cdb-fields').scrollIntoViewIfNeeded();
      await p.screenshot({path:path.join(dir,'gui-'+app+'-'+width+'-'+lang+'-'+light+'.png')});
    }
    await el(p,'cdb-start-moves').fill('12');await el(p,'cdb-start-moves').blur();await el(p,'cdb-start-mode').selectOption('d4');await el(p,'cdb-start-on').uncheck();
    const pref=await p.evaluate(()=>window.ChessLabHost.getContext().settings);assert.equal(pref.cdbStartMoves,12);assert.equal(pref.cdbStartMode,'d4');assert.equal(pref.cdbStartOn,false);
    await p.reload();await p.waitForFunction(()=>window.ChessLabHost);await sim(h);assert.equal(await el(p,'cdb-start-moves').inputValue(),'12');assert.equal(await el(p,'cdb-start-mode').inputValue(),'d4');assert(!await el(p,'cdb-start-on').isChecked());
  }
});
test('actual Sim handler CDB X8 → actual SF move → browser reload/resume → portable DATA', {timeout:90000},async t=>{
  const h=await open(t),p=h.page;await sim(h);await el(p,'white').selectOption('sf');await el(p,'black').selectOption('sf');await el(p,'limit-mode').selectOption('game-time');await el(p,'game-time').selectOption('60000');await el(p,'cdb-start-mode').selectOption('e4');
  await el(p,'start').click();await p.waitForFunction(()=>window.__CDBQA.moves.length===1&&!window.__CDBQA.runner.busy(),null,{timeout:40000});
  const a=await saved(p),qa=await p.evaluate(()=>({prepared:window.__CDBQA.prepared,started:window.__CDBQA.started,workers:window.__CDBQA.workers})),r=a.runs[0];
  assert.equal(r.opening.openingPlies,16);assert.equal(r.trace[0].game_ply,17);assert.equal(r.trace[0].clock_before_ms,60000);assert.equal(qa.prepared[0].workers,0,'no local engine initialization during prefix');assert.equal(qa.started[0].clock.remaining.w,60000);assert.equal(qa.started[0].clock.remaining.b,60000);
  assert.equal(r.trace[0].actual_provider,'SF');const probe=new Chess();assert(probe.load_pgn(r.pgn));assert.equal(probe.history().length,17);
  records.push({case:'actual SF after controlled CDB X8',archive:a,qa});
  await p.reload();await p.waitForFunction(()=>window.ChessLabHost&&window.__CDBQA.runner);await p.evaluate(id=>window.__CDBQA.runner.resume(id),a.events[0].id);await p.waitForFunction(()=>window.__CDBQA.moves.length===1&&!window.__CDBQA.runner.busy(),null,{timeout:40000});
  const b=await saved(p);assert.equal(b.runs[0].trace.length,2);assert.equal(b.runs[0].opening.cdbStart.sha256,r.opening.cdbStart.sha256);assert.equal(await p.evaluate(()=>window.__CDBQA.prepared.length),0);
  await p.evaluate(()=>window.ChessLabHost.prepareData());
  await p.waitForTimeout(300);
  const data=await p.evaluate(()=>window.ChessDataGuard.capture(false));assert.equal(data.payload.simulation.runs[0].opening.cdbStart.sha256,r.opening.cdbStart.sha256);assert.equal(data.payload.preferences.settings.cdbStartMode,'e4');
  records.push({case:'reload resume / DATA',archive:b,hash:data.sha256});
  const target=await open(t),q=target.page;
  await target.context.route('https://www.chessdb.cn/**',route=>route.abort());
  await q.evaluate(()=>window.ChessLabHost.prepareData());await q.waitForTimeout(200);
  const targetHash=await q.evaluate(()=>window.ChessDataGuard.capture(false).then(v=>v.sha256));
  await q.evaluate(({data,targetHash})=>window.ChessDataGuard.restore(data,targetHash),{data,targetHash});
  await q.reload();await q.waitForFunction(()=>window.ChessLabHost&&window.__CDBQA.runner);
  const restored=await saved(q);assert.equal(restored.runs[0].opening.cdbStart.sha256,r.opening.cdbStart.sha256);assert.equal(restored.runs[0].trace.length,2);
  assert.equal(await q.evaluate(()=>window.__CDBQA.prepared.length),0);assert.equal(await q.evaluate(()=>window.__CDBQA.workers.length),0);
  assert.equal(await q.evaluate(()=>window.ChessLabHost.getContext().settings.cdbStartMode),'e4');records.push({case:'actual clean-target DATA generation restore / reload retains frozen CDB prefix and preferences; engines stopped',archive:restored});
});
test('Stop/Close during real pending HTTP protects loaded game and blocks DATA restore', {timeout:30000},async t=>{
  const h=await open(t,{hold:true}),p=h.page;await sim(h);await el(p,'start').click();await p.waitForFunction(()=>window.__CDBQA.runner.isPreparing());
  const before=await p.evaluate(()=>window.ChessLabHost.getReviewGame());
  assert.match(await p.evaluate(()=>{try{window.ChessLabHost.canRestoreData();return '';}catch(e){return e.message;}}),/Pause/);
  const other=await h.context.newPage();await other.goto(origin+'/chess-lab/');await other.waitForFunction(()=>window.ChessLabHost&&window.__CDBQA.runner);
  await other.locator('#btnSim').click();await el(other,'start').click();await el(other,'status').filter({hasText:'another tab'}).waitFor();
  assert.equal(await other.evaluate(()=>window.__CDBQA.runner.busy()),false);await other.close();
  await p.evaluate(()=>window.ChessLabHost.prepareData());await p.waitForFunction(()=>!window.__CDBQA.runner.busy());
  assert.deepEqual(await p.evaluate(()=>window.ChessLabHost.getReviewGame()),before);
  records.push({case:'actual Save DATA preparation cancels a pending CDB prefix, settles and preserves the loaded game'});
  await el(p,'start').click();await p.waitForFunction(()=>window.__CDBQA.runner.isPreparing());
  await p.locator('[data-action="cancel-start"]').click();await p.waitForFunction(()=>!window.__CDBQA.runner.busy());h.release();await p.waitForTimeout(100);
  assert.deepEqual(await p.evaluate(()=>window.ChessLabHost.getReviewGame()),before);const state=await saved(p);assert.equal(state.events.length,0);assert.equal(state.runs.length,0);assert.equal(await p.evaluate(()=>window.__CDBQA.workers.length),0);records.push({case:'pending HTTP cancelled; second real tab and DATA guard blocked; no board/event/engine mutation'});
});
test('each supported Sim policy actually moves after a CDB prefix using its real browser engine', {timeout:180000},async t=>{
  for(const engine of ['raw','dcc','sf','sf-dcc','lc0','reckless','berserk']) {
    const h=await open(t),p=h.page;await sim(h);
    await el(p,'white').selectOption(engine);await el(p,'black').selectOption(engine);await el(p,'limit-mode').selectOption('move-time');await el(p,'move-time').selectOption('1000');
    await el(p,'cdb-start-moves').fill('1');await el(p,'cdb-start-mode').selectOption('d4');await el(p,'start').click();
    await p.waitForFunction(()=>window.__CDBQA.moves.length===1&&!window.__CDBQA.runner.busy(),null,{timeout:45000}).catch(async e=>{records.push({case:'engine failure',engine,state:await saved(p),status:await p.locator('#simStatusBar').textContent()});throw e;});
    const state=await saved(p),r=state.runs[0],qa=await p.evaluate(()=>window.__CDBQA.prepared);
    assert.equal(r.opening.openingPlies,2);assert.equal(r.trace.length,1);assert.equal(r.trace[0].game_ply,3);assert.equal(qa[0].workers,0);assert.equal(r.trace[0].policy,engine);
    assert.equal(r.trace[0].actual_provider,({lc0:'LC0',reckless:'RLE',berserk:'BER',raw:'CDB',dcc:'CDB',sf:'SF','sf-dcc':'SF'})[engine]);
    const b=new Chess();assert(b.load_pgn(r.pgn));assert.equal(b.history().length,3);records.push({case:'actual browser policy after controlled CDB',engine,archive:state});await h.context.close();
  }
});
test('loaded game at cursor zero keeps Current board as the explicit Sim source', {timeout:30000},async t=>{
  const h=await open(t),p=h.page;await p.locator('#btnWorkspaceMore').click();
  await p.locator('#filePGN').setInputFiles({name:'loaded-root-context.pgn',mimeType:'application/x-chess-pgn',buffer:Buffer.from('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *')});
  await p.waitForFunction(()=>window.ChessLabHost.getReviewGame().totalPly===6);await p.evaluate(()=>window.ChessLabHost.navigateReview(0));
  if(await p.locator('#btnCloseLabTools').isVisible())await p.locator('#btnCloseLabTools').click();
  await sim(h);assert.equal(await el(p,'opening-source').inputValue(),'current');assert(await el(p,'cdb-fields').isHidden());
  const context=await p.evaluate(()=>window.ChessLabHost.getReviewGame());assert.equal(context.cursor,0);assert.equal(context.totalPly,6);assert.equal(await p.evaluate(()=>window.__CDBQA.prepared.length),0);
  records.push({case:'loaded six-ply PGN viewed at cursor zero retains Current board source; no CDB preparation',context});
});
