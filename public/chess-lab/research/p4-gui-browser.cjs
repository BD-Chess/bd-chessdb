// Disposable Chromium fixtures. Controlled adapters test presentation/races;
// the existing P3 scenario separately retains the required shipped-engine All4.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {chromium}=require('playwright');
const base=path.resolve(__dirname,'../../../public'),records=[],errors=[];
let browser,server,origin,evidence,tmp;
test.before(async()=>{
  tmp=fs.mkdtempSync(path.join(os.tmpdir(),'chess-p4-'));evidence=process.env.CHESS_P4_EVIDENCE_DIR||path.join(tmp,'evidence');fs.mkdirSync(evidence,{recursive:true});
  const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.webmanifest':'application/manifest+json'};
  server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),f=path.resolve(base,'.'+decodeURIComponent(url.pathname)+(url.pathname.endsWith('/')?'index.html':''));if(!f.startsWith(base+path.sep)){res.writeHead(403).end();return;}fs.readFile(f,(err,data)=>{if(err){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream','cache-control':'no-cache'}).end(data);});});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({headless:true});
});
test.after(async()=>{fs.writeFileSync(path.join(evidence,'p4-browser-acceptance.json'),JSON.stringify({schema:'chessbest-p4-browser/1',controlledAdapters:true,physicalDevice:false,records,errors},null,2)+'\n');await browser?.close();await new Promise(r=>server?.close(r));fs.rmSync(tmp,{recursive:true,force:true});});
async function open(t,{width=1280,height=800,app=false}={}){
  const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block',...(app?{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1'}:{})});t.after(()=>context.close());
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
  await page.addInitScript(()=>{
    const calls=[];window.__P4={calls};
    const install=()=>{
      const S=window.ChessAnalysisSession;if(!S)return false;
      const make=mode=>{const c={mode,destroyed:false};calls.push(c);return {prepare(options){c.preparation=options;if(mode==='lc0')return new Promise(r=>c.ready=r);return Promise.resolve();},analyze(options){c.options=options;options.onSearchStarted?.({timestamp:performance.now()});return new Promise((resolve,reject)=>{c.resolve=resolve;c.reject=reject;});},destroy(){c.destroyed=true;}};};
      const create=S.create;S.create=config=>create({...config,teardownGraceMs:0,adapterFactory:make});S.backendFor=mode=>({create:()=>make(mode)});return true;
    };
    const timer=setInterval(()=>{if(install())clearInterval(timer);},0);
  });
  await page.goto(origin+'/chess-lab/'+(app?'?view=app':''));await page.waitForFunction(()=>window.ChessLabHost&&window.ChessLabLayout);
  return page;
}
const geometry=page=>page.evaluate(()=>({board:document.querySelector('#board').getBoundingClientRect().toJSON(),workspace:document.querySelector('#workspaceDisplay').getBoundingClientRect().toJSON(),cards:[...document.querySelectorAll('.all-eval-badge')].map(e=>({source:e.dataset.evalSource,rect:e.getBoundingClientRect().toJSON(),moveFont:getComputedStyle(e.querySelector('.all-eval-move')).fontSize}))}));
test('P4 A mixed loading/searching/complete/failed cards have stable geometry and recover workspace space',{timeout:60000},async t=>{
  for(const spec of [{label:'desktop',width:1280,height:800},{label:'APP402',width:402,height:874,app:true}]){
    const page=await open(t,spec);const idle=await geometry(page);
    assert.equal(await page.locator('#analysisActivity,.analysis-activity-slot').count(),0);
    await page.screenshot({path:path.join(evidence,spec.label+'-cards-before.png'),fullPage:true});
    await page.locator('#btnAnalyzeAll').click();await page.waitForFunction(()=>window.__P4.calls.length===4&&window.__P4.calls.filter(c=>c.options).length===3);
    await page.evaluate(()=>{
      const calls=window.__P4.calls,sf=calls.find(c=>c.mode.startsWith('sf-')),rle=calls.find(c=>c.mode==='reckless'),ber=calls.find(c=>c.mode==='berserk'),lc=calls.find(c=>c.mode==='lc0');
      const value=c=>({fen:c.options.fen,linesDepth:18,actualSearchMs:1250,lines:[{depth:18,pv:['e2e4'],score:{type:'cp',white:22}}]});
      sf.resolve(value(sf));rle.options.onInfo({},value(rle));ber.reject(Error('Controlled unavailable fixture'));lc.preparation?.onProgress?.({phase:'local',loaded:90*1048576,total:95*1048576});
    });
    await page.waitForFunction(()=>document.querySelector('[data-eval-source="SF"]').dataset.analysisState==='complete'&&document.querySelector('[data-eval-source="BER"]').dataset.analysisState==='failed');
    const busy=await geometry(page);records.push({...spec,case:'mixed geometry observation',idle,busy});
    await page.screenshot({path:path.join(evidence,spec.label+'-cards-mixed-active.png'),fullPage:true});
    assert.deepEqual(busy.cards.map(c=>c.rect.height),idle.cards.map(c=>c.rect.height));assert.equal(busy.board.height,idle.board.height);assert.equal(busy.workspace.y,idle.workspace.y);
    assert.equal(new Set(busy.cards.map(c=>c.rect.height)).size,1);
    assert(parseFloat(busy.cards.find(c=>c.source==='SF').moveFont)>parseFloat(busy.cards.find(c=>c.source==='RLE').moveFont));
    await page.screenshot({path:path.join(evidence,spec.label+'-cards-mixed-active.png'),fullPage:true});
    await page.locator('#btnAnalyzeAll').click();await page.waitForFunction(()=>window.__P4.calls.every(c=>c.destroyed));
    await page.waitForFunction(()=>!document.querySelector('[data-eval-source="RLE"]').classList.contains('is-busy'));
    const stopped=await geometry(page);assert.deepEqual(stopped.cards.map(c=>c.rect.height),idle.cards.map(c=>c.rect.height));
    assert.equal(stopped.board.height,idle.board.height);assert.equal(stopped.workspace.y,idle.workspace.y);
    await page.screenshot({path:path.join(evidence,spec.label+'-cards-stopped.png'),fullPage:true});
    records.push({...spec,case:'mixed states/stable cards/no workspace strip',pass:true,idle,busy,stopped});
  }
  assert.deepEqual(errors,[]);
});
