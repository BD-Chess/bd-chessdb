// Real Chromium acceptance. Only the explicitly labelled APP preparation/race
// case replaces adapters. The bounded Deep All case uses shipped engines.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {chromium}=require('playwright');
const repo=path.resolve(__dirname,'../../..'),base=path.join(repo,'public');
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.wasm':'application/wasm','.webmanifest':'application/manifest+json'};
const fixture='[Event "Disposable P3 ordinary game"]\n[Result "*"]\n\n1. e4 {P3 retention} e5 2. Nf3 *';
let browser,server,origin,evidence,tmp;
const records=[],errors=[];
test.before(async()=>{
  tmp=fs.mkdtempSync(path.join(os.tmpdir(),'chess-p3-'));
  evidence=process.env.CHESS_P3_EVIDENCE_DIR||path.join(tmp,'evidence');fs.mkdirSync(evidence,{recursive:true});
  server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(base,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
    if(!file.startsWith(base+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-cache'});res.end(data);});
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true});
});
test.after(async()=>{
  fs.writeFileSync(path.join(evidence,'p3-browser-acceptance.json'),JSON.stringify({schema:'chessbest-p3-browser/1',physicalDevice:false,records,errors},null,2)+'\n');
  await browser?.close();await new Promise(r=>server?.close(r));fs.rmSync(tmp,{recursive:true,force:true});
});
async function open(t,options={}){
  const context=await browser.newContext({viewport:{width:1280,height:800},...options});t.after(()=>context.close());
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  return {context,page};
}
const ready=async(page,app=false)=>{
  await page.goto(origin+'/chess-lab/'+(app?'?view=app':''));
  await page.waitForFunction(app=>!!window.ChessLabHost&&!!window.ChessLabLayout&&(!app||document.body.dataset.appView==='board'),app);
};
const activity=page=>page.evaluate(()=>window.ChessLabHost.getAnalysisActivity());
const retention=page=>page.evaluate(()=>{const r=window.ChessLabHost.getReviewGame();return {pgn:r.sourcePGN,cursor:r.cursor,total:r.totalPly,fen:window.ChessLabHost.getContext().fen};});

test('Chromium natural Settings focus/Escape, modal priority, keyboard and responsive navigation', {timeout:90000},async t=>{
  for(const spec of [
    {label:'desktop-1280x800',width:1280,height:800,app:false},
    {label:'desktop-short-1280x520',width:1280,height:520,app:false},
    {label:'APP402-portrait-emulation',width:402,height:874,app:true},
    {label:'APP-constrained-landscape-emulation',width:740,height:402,app:true}
  ]){
    const {page}=await open(t,{viewport:{width:spec.width,height:spec.height},...(spec.app?{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1'}:{})});
    await ready(page,spec.app);
    for(const close of ['Escape','X','Escape']){
      if(spec.app)await page.locator('#appMore').click();
      await page.locator('#btnSettings').click();
      try { await page.waitForFunction(()=>!document.querySelector('#labToolsDialog').open&&document.querySelector('#settingsPanel').contains(document.activeElement)); }
      catch(error){
        records.push({...spec,case:'natural focus failure '+close,pass:false,dom:await page.evaluate(()=>({active:document.activeElement?.outerHTML,
          view:document.body.dataset.appView,classes:document.body.className,settings:document.querySelector('#settingsPanel').className,tools:document.querySelector('#labToolsDialog').open,
          modals:[...document.querySelectorAll('[aria-modal="true"]')].map(n=>({id:n.id,display:getComputedStyle(n).display,rects:n.getClientRects().length}))}))});
        await page.screenshot({path:path.join(evidence,spec.label+'-focus-failure.png'),fullPage:true});throw error;
      }
      const focused=await page.evaluate(()=>document.activeElement.id);
      if(close==='X')await page.locator('#settingTheme').check();
      const fen=await page.evaluate(()=>window.ChessLabHost.getContext().fen);
      await page.keyboard.press('ArrowLeft');assert.equal(await page.evaluate(()=>window.ChessLabHost.getContext().fen),fen);
      if(close==='X')await page.locator('#btnCloseSettings').click();else await page.keyboard.press('Escape');
      await page.locator('#settingsPanel').waitFor({state:'hidden'});
      assert.equal(await page.locator('#appTabs').getAttribute('inert'),null);
      records.push({...spec,case:'natural Settings '+close,focused,pass:true});
    }
    // Native top-layer Escape closes its dialog without a background Settings handler.
    if(spec.app)await page.locator('#appMore').click();else await page.locator('#btnWorkspaceMore').click();
    await page.keyboard.press('Escape');await page.locator('#labToolsDialog').waitFor({state:'hidden'});
    const nav=spec.app?'[data-app-tab="deep"]':'button[data-desktop-view="deep"]';
    if(spec.app)await page.locator('#appGames').click();else await page.locator('#btnGames').click();
    await page.locator(nav).click();await page.locator('#deepAnalysisPanel').waitFor({state:'visible'});
    const deepBounds=await page.locator(nav).boundingBox();assert(deepBounds&&deepBounds.width>0&&deepBounds.height>=40);
    await page.screenshot({path:path.join(evidence,spec.label+'.png'),fullPage:true});
    records.push({...spec,case:'Library to Deep without X / native Escape',pass:true});
  }
});

test('Chromium shipped Deep All4 CPU1 10s budget keeps job ownership across views and stops from Settings', {timeout:150000},async t=>{
  const {page}=await open(t);await ready(page);
  const pgnFile=path.join(tmp,'p3-desktop-ordinary.pgn');fs.writeFileSync(pgnFile,fixture);
  await page.locator('#btnWorkspaceMore').click();const picker=page.waitForEvent('filechooser');await page.locator('#btnLoad').click();await(await picker).setFiles(pgnFile);
  await page.waitForFunction(()=>window.ChessLabHost.getReviewGame().totalPly===3);
  await page.locator('#first').click();await page.locator('#next').click();const saved=await retention(page);
  assert.equal(saved.total,3);assert.equal(saved.cursor,1);
  await page.locator('button[data-desktop-view="deep"]').click();
  await page.locator('[data-deep="mode"]').selectOption('all');await page.locator('[data-deep="time"]').selectOption('10000');
  const threads=page.locator('[data-deep="threads"]');
  if(await threads.isEnabled())await threads.selectOption('1');
  assert.equal(await threads.inputValue(),'1','CPU1 remains truthful even on a locked single-thread host');
  assert.equal(await page.locator('[data-deep="follow"]').isChecked(),false);
  await page.locator('[data-deep="follow"]').check();await page.locator('[data-deep="start"]').click();
  await page.waitForFunction(()=>window.ChessLabHost.getAnalysisActivity().owners.some(o=>o.owner==='deep'&&o.children.length===4));
  const initial=(await activity(page)).owners.find(o=>o.owner==='deep'),ids=initial.children.map(c=>c.id);
  assert(initial.children.every(c=>c.budget.movetime===10000));
  for(const view of ['moves','dcc','review','library','deep']){
    if(view==='library')await page.locator('#btnGames').click();else await page.locator('button[data-desktop-view="'+view+'"]').click();
    const s=await activity(page),owner=s.owners.find(o=>o.owner==='deep');assert.deepEqual(owner.children.map(c=>c.id),ids,view);
    assert.equal(s.display,'CDB');assert.equal(await page.locator('#analysisActivity').isVisible(),true,view);
  }
  await page.waitForFunction(()=>{const o=window.ChessLabHost.getAnalysisActivity().owners.find(o=>o.owner==='deep');return o?.children.every(c=>['searching','complete','failed'].includes(c.state));},{},{timeout:100000});
  const started=(await activity(page)).owners.find(o=>o.owner==='deep');
  assert(started.children.every(c=>c.state!=='failed'),JSON.stringify(started));
  await page.waitForFunction(()=>{const o=window.ChessLabHost.getAnalysisActivity().owners.find(o=>o.owner==='deep');return o?.children.every(c=>c.state==='complete'||c.searchElapsedMs>=9000);},{},{timeout:30000});
  await page.locator('button[data-desktop-view="moves"]').click();
  await page.locator('#analysisActivity details').evaluate(el=>el.open=true);
  await page.screenshot({path:path.join(evidence,'real-all-four-running-status.png'),fullPage:true});
  await page.locator('#btnSettings').click();
  await page.waitForFunction(()=>document.querySelector('#settingsPanel').contains(document.querySelector('#analysisActivity')));
  assert.equal(await page.locator('#analysisActivity').evaluate(el=>el.closest('[inert]')),null);
  await page.locator('[data-activity="stop"]').click();
  await page.waitForFunction(()=>window.ChessLabHost.getAnalysisActivity().owners.every(o=>!o.running&&!o.following));
  const stopped=await activity(page);assert.equal(await page.locator('[data-deep="follow"]').isChecked(),false);
  await page.screenshot({path:path.join(evidence,'real-all-four-settings-stopped.png'),fullPage:true});
  await page.keyboard.press('Escape');await page.locator('#settingsPanel').waitFor({state:'hidden'});
  await page.locator('button[data-desktop-view="deep"]').click();
  assert.deepEqual((await activity(page)).owners.find(o=>o.owner==='deep').children.map(c=>c.id),ids);
  assert.deepEqual(await retention(page),saved);await page.reload();await page.waitForFunction(()=>!!window.ChessLabHost);
  assert.deepEqual(await retention(page),saved,'ordinary full line/cursor survives desktop P3 controls and reload');
  assert((await activity(page)).owners.every(o=>!o.running&&!o.following));
  records.push({case:'real shipped All4 CPU1 selected 10000ms per family plus desktop ordinary cursor1/P3/reload',initial,started,stopped,retention:saved,physicalDevice:false,pass:true});
});

test('Chromium APP Quick preparation Stop, natural focus, late loader, status layout and ordinary full-line cursor reload', {timeout:90000},async t=>{
  const {context,page}=await open(t,{viewport:{width:402,height:874},isMobile:true,hasTouch:true,
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1',serviceWorkers:'block'});
  // Only adapters are controlled here; production controllers and cancellation run unchanged.
  const source=fs.readFileSync(path.join(base,'chess-lab/js/8zc-analysis-session.js'),'utf8');
  await context.route('**/js/8zc-analysis-session.js*',route=>route.fulfill({contentType:'application/javascript',body:source+`\nwindow.__P3={calls:[],release(){for(const c of this.calls)c.ready();}};ChessAnalysisSession.backendFor=mode=>({create(){const c={mode,started:false,destroyed:false};window.__P3.calls.push(c);return {prepare:()=>new Promise(r=>c.ready=r),analyze(opts){c.started=true;return new Promise(()=>{});},destroy(){c.destroyed=true;}};}});` }));
  await ready(page,true);
  const file=path.join(tmp,'p3-ordinary.pgn');fs.writeFileSync(file,fixture);
  await page.locator('#appMore').click();const chooser=page.waitForEvent('filechooser');await page.locator('#btnLoad').click();await(await chooser).setFiles(file);
  await page.waitForFunction(()=>window.ChessLabHost.getReviewGame().totalPly===3);
  await page.locator('[data-app-tab="board"]').click();await page.locator('#first').click();await page.locator('#next').click();
  const before=await retention(page);assert.equal(before.cursor,1);assert.equal(before.total,3);
  await page.locator('#analysisAllMoves').check();await page.waitForFunction(()=>window.__P3.calls.length===4);
  const ids=(await activity(page)).owners.find(o=>o.owner==='cards').children.map(c=>c.id);
  for(const view of ['moves','review','dcc','board']){
    await page.locator('[data-app-tab="'+view+'"]').click();assert.deepEqual((await activity(page)).owners.find(o=>o.owner==='cards').children.map(c=>c.id),ids);
    const a=await page.locator('[data-activity="stop"]').boundingBox(),tabs=await page.locator('#appTabs').boundingBox();assert(a&&a.height>=44&&a.y+a.height<=tabs.y,'Stop never overlaps bottom navigation');
  }
  for(const size of [{width:740,height:402},{width:402,height:874}]){
    await page.setViewportSize(size);await page.locator('[data-app-tab="moves"]').click();
    const stop=await page.locator('[data-activity="stop"]').boundingBox(),nav=await page.locator('#appTabs').boundingBox();
    assert(stop&&stop.height>=44&&stop.y+stop.height<=nav.y,'active Stop stays clear of landscape/portrait navigation');
    await page.screenshot({path:path.join(evidence,'app-active-'+size.width+'x'+size.height+'.png'),fullPage:true});
    records.push({case:'active APP responsive layout',viewport:size,stop,nav,emulation:true,pass:true});
  }
  await page.locator('#appGames').click();await page.locator('#appMore').click();await page.locator('#btnSettings').click();
  await page.waitForFunction(()=>document.querySelector('#settingsPanel').contains(document.activeElement));
  await page.locator('#settingTheme').check();
  await page.locator('[data-activity="stop"]').click();await page.evaluate(()=>window.__P3.release());
  await page.waitForFunction(()=>window.__P3.calls.every(c=>c.destroyed&&!c.started)&&document.querySelector('[data-activity="stop"]').disabled);
  assert(await page.locator('#settingsPanel').evaluate(el=>el.contains(document.activeElement)),'completed Stop preserves Settings natural Escape focus');
  await page.screenshot({path:path.join(evidence,'app402-preparation-stop-settings.png'),fullPage:true});
  await page.keyboard.press('Escape');await page.locator('#settingsPanel').waitFor({state:'hidden'});
  await page.locator('[data-app-tab="deep"]').click();await page.locator('[data-app-tab="moves"]').click();
  assert.deepEqual(await retention(page),before);await page.reload();await page.waitForFunction(()=>!!window.ChessLabHost&&document.body.dataset.appView==='board');
  assert.deepEqual(await retention(page),before);assert.equal(await page.evaluate(()=>window.__P3.calls.length),0,'reload restores no live jobs');
  await page.locator('[data-app-lang="sl"]').click();await page.locator('[data-app-lang="en"]').click();
  assert.equal(await page.locator('#analysisAllMoves').isChecked(),false);
  records.push({case:'APP402 controlled adapters: preparation Stop plus ordinary file import/cursor1/P3 view switching/reload',before,after:await retention(page),ids,serviceWorkers:'blocked only for controlled adapter case',physicalDevice:false,pass:true});
  assert.deepEqual(errors,[]);
});
