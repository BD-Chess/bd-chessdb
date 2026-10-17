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
async function open(t,{width=1280,height=800,app=false,preview=false,deviceScaleFactor=1}={}){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor,serviceWorkers:'block',...(app&&!preview?{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1'}:{})});t.after(()=>context.close());
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

async function localeAudit(page,selector,label){
  const audit=await page.evaluate(selector=>{
    const scope=document.querySelector(selector),map=new Map(window.ChessLanguage.entries()),text=[],attributes=[],untranslated=[];
    const preserve='script,style,code,pre,textarea,[translate="no"],[data-no-i18n],.deep-pv,.chess-study-comment-summary,.game-review-detail,.game-review-teaser,.game-review-intro h3,.game-review-moment>strong,.game-review-fact dd,.tournament-current,.research-summary,#appGameName,#boardGameTitle';
    for(const el of [scope,...scope.querySelectorAll('*')]){
      if(!el.getClientRects().length||el.closest(preserve))continue;
      for(const child of el.childNodes)if(child.nodeType===3&&child.nodeValue.trim()){
        const value=child.nodeValue.replace(/\s+/g,' ').trim();text.push(value);if(map.has(value)&&map.get(value)!==value)untranslated.push({text:value});
      }
      for(const name of ['aria-label','title','placeholder'])if(el.hasAttribute(name)){
        const value=el.getAttribute(name);attributes.push({name,value});if(map.has(value)&&map.get(value)!==value)untranslated.push({name,value});
      }
    }
    return {text,attributes,untranslated};
  },selector);
  records.push({case:'SL locale audit '+label,pass:!audit.untranslated.length,...audit});assert.deepEqual(audit.untranslated,[],label);return audit;
}
test('P4 B responsive Deep, Appearance, locale and native touch-help preserve the active owner',{timeout:150000},async t=>{
  for(const spec of [
    {label:'desktop1280',width:1280,height:800},
    {label:'short1280',width:1280,height:520},
    {label:'large4K',width:3840,height:2160},
    {label:'desktop200percent-layout-emulation',width:640,height:400,deviceScaleFactor:2},
    {label:'APP375-emulation',width:375,height:812,app:true},
    {label:'APP402-emulation',width:402,height:874,app:true},
    {label:'APP430-emulation',width:430,height:932,app:true},
    {label:'APP-landscape-emulation',width:740,height:402,app:true},
    {label:'APP-desktop-preview-resize',width:1280,height:900,app:true,preview:true}
  ]){
    const page=await open(t,spec),deep=page.locator('#deepAnalysisPanel');
    await page.locator(spec.app?'[data-app-tab="deep"]':'button[data-desktop-view="deep"]').click();
    await deep.waitFor({state:'visible'});assert.equal(await deep.locator('[data-deep="configuration"]').getAttribute('open'),null);
    for(const lang of ['sl','en','sl']){
      await page.locator((spec.app?'.app-language':'.desktop-language')+' [data-app-lang="'+lang+'"]').click();
      assert.equal(await deep.locator('[data-deep="status"]').textContent(),lang==='sl'?'Analiziraj položaj začne novo iskanje. Vsaka poteza je izklopljena.':'Analyze position starts a new search. Each move is off.');
      assert.equal(await page.evaluate(()=>window.__P4.calls.length),0);
    }
    await deep.locator('[data-deep="configuration"] > summary').click();
    await deep.locator('[data-deep="mode"]').selectOption('all');await deep.locator('[data-deep="time"]').selectOption('10000');
    await deep.locator('[data-deep="configuration"] > summary').click();await deep.locator('[data-deep="start"]').click();
    await page.waitForFunction(()=>window.__P4.calls.length===4);
    const ids=await page.evaluate(()=>window.ChessLabHost.getAnalysisActivity().owners.find(o=>o.owner==='deep').children.map(c=>c.id));
    const before=await page.evaluate(()=>window.ChessLabHost.getReviewGame());
    await deep.locator('[data-open-appearance]').click();await page.waitForFunction(()=>document.querySelector('#settingsPanel').contains(document.activeElement));
    const settings=page.locator('#settingsPanel');await settings.locator('#settingFont').selectOption('18px');
    await settings.locator('#settingTheme').check();await settings.locator('#settingLabWorkspaceWidth').selectOption('500');await settings.locator('#settingLabCompact').check();
    for(const lang of ['sl','en','sl']){
      await settings.locator('[data-app-lang="'+lang+'"]').click();
      await page.waitForFunction(lang=>document.documentElement.lang===lang,lang);
      for(const [selector,attr,en,sl]of [
        ['#analysisLink','aria-label','Link engine cards to displayed evaluation','Poveži kartice motorjev s prikazano oceno'],
        ['#btnAnalysisDeepen','title','Refresh ChessDB evaluations for the current position','Osveži ocene ChessDB za trenutni položaj'],
        ['#analysisCpuThreads','title','CDB has no configurable local search threads. Your local CPU setting is retained.','CDB nima nastavljivih niti lokalnega iskanja. Lokalna nastavitev CPU je ohranjena.'],
        ['#allEvalBadges','aria-label','ChessDB, Stockfish, ChessDCC, Reckless, LC Zero and Berserk comparison','Primerjava ChessDB, Stockfish, ChessDCC, Reckless, LC Zero in Berserk'],
        ['#humanWhiteName','placeholder','Human White','Beli igralec']
      ])assert.equal(await page.locator(selector).getAttribute(attr),lang==='sl'?sl:en,'public '+attr+' at '+spec.label);
      assert.deepEqual(await page.evaluate(()=>window.ChessLabHost.getAnalysisActivity().owners.find(o=>o.owner==='deep').children.map(c=>c.id)),ids);
      assert.equal(await page.evaluate(()=>window.__P4.calls.length),4);
    }
    await localeAudit(page,'#settingsPanel',spec.label+' Settings');
    await settings.locator('[data-analysis-help]').click();await page.locator('#analysisHelp').waitFor({state:'visible'});
    await localeAudit(page,'#analysisHelp',spec.label+' help');
    const rect=await page.locator('#analysisHelp').boundingBox();assert(rect&&rect.width<=spec.width&&rect.height<=spec.height);
    await page.keyboard.press('Escape');await page.locator('#analysisHelp').waitFor({state:'hidden'});assert.equal(await settings.isVisible(),true);
    assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-analysis-help')),true);
    await page.keyboard.press('Escape');await settings.waitFor({state:'hidden'});assert.equal(await deep.isVisible(),true);
    assert.equal(await deep.locator('[data-deep="configuration"]').getAttribute('open'),null);
    await localeAudit(page,'#deepAnalysisPanel',spec.label+' Deep');
    assert.equal(await page.evaluate(()=>window.__P4.calls.some(c=>c.destroyed)),false);
    assert.deepEqual(await page.evaluate(()=>window.ChessLabHost.getReviewGame()),before);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),true,spec.label+' no horizontal viewport clipping');
    if(spec.preview){
      for(const width of [900,1920]){await page.setViewportSize({width,height:900});assert.equal(await page.locator('body').getAttribute('data-app-presentation'),'app');assert.equal(await page.locator('.app-preview-screen').evaluate(e=>Math.round(e.getBoundingClientRect().width)),402);}
    }
    await page.screenshot({path:path.join(evidence,spec.label+'-P4-deep-SL.png'),fullPage:true});
    await page.locator(spec.app?'#appStopAnalysis':'#btnAnalyzeAll').click();await page.waitForFunction(()=>window.__P4.calls.every(c=>c.destroyed));
    records.push({...spec,case:'Deep collapse/preferences/locale/help/owner preserved',pass:true,ids});
  }
  assert.deepEqual(errors,[]);
});
test('P4 B SL Library/Review/Study/Evidence/Sim and ordinary-file GUI reload preserve full line and cursor',{timeout:90000},async t=>{
  for(const app of [false,true]){
    const label=app?'APP402':'desktop',page=await open(t,app?{app,width:402,height:874}:{}),view=name=>page.locator(app?'[data-app-tab="'+name+'"]':'button[data-desktop-view="'+name+'"]').click();
    const tools=()=>page.locator(app?'#appMore':'#btnWorkspaceMore').click();
    const file=path.join(tmp,label+'-ordinary-P4.pgn');fs.writeFileSync(file,'[Event "Ordinary P4"]\n[White "White"]\n[Black "Analysis settings"]\n[Result "*"]\n\n1. e4 {White · Stop · Analysis settings} e5 2. Nf3 *');
    await tools();const chooser=page.waitForEvent('filechooser');await page.locator('#btnLoad').click();await(await chooser).setFiles(file);
    await page.waitForFunction(()=>window.ChessLabHost.getReviewGame().totalPly===3);
    await page.locator('#first').click();await page.locator('#next').click();
    const before=await page.evaluate(()=>({review:window.ChessLabHost.getReviewGame(),fen:window.ChessLabHost.getContext().fen}));assert.equal(before.review.cursor,1);
    await page.evaluate(()=>window.ChessLanguage.apply('sl'));await page.waitForFunction(()=>document.documentElement.lang==='sl');
    await view('review');await localeAudit(page,'#gameReviewPanel',label+' Review');
    await page.locator(app?'#appGames':'#btnGames').click();await localeAudit(page,'#popularGamesPanel',label+' Library');
    await view('deep');await page.locator('[data-deep="configuration"] > summary').click();await page.locator('[data-deep="configuration"] > summary').click();
    await tools();await page.locator('#btnStudy').click();await page.locator('.chess-study-dialog').waitFor({state:'visible'});await localeAudit(page,'.chess-study-dialog',label+' Study');await page.locator('.chess-study-close').click();
    await tools();await page.locator('#btnEvidence').click();await page.locator('.chess-research-dialog').waitFor({state:'visible'});await localeAudit(page,'.chess-research-dialog',label+' Evidence');await page.locator('.research-close').click();
    await view(app?'board':'moves');await page.locator(app?'#appSim':'#btnSim').click();await page.locator('#simTournamentDialog').waitFor({state:'visible'});await localeAudit(page,'#simTournamentDialog',label+' Sim');await page.keyboard.press('Escape');
    await page.evaluate(()=>window.ChessLanguage.apply('en'));await page.evaluate(()=>window.ChessLanguage.apply('sl'));
    await page.reload();await page.waitForFunction(()=>window.ChessLabHost&&window.ChessLabHost.getReviewGame().totalPly===3&&window.ChessLabHost.getReviewGame().cursor===1);
    assert.equal(await page.evaluate(()=>document.documentElement.lang),'sl');
    const after=await page.evaluate(()=>({review:window.ChessLabHost.getReviewGame(),fen:window.ChessLabHost.getContext().fen}));
    assert.equal(after.review.sourcePGN,before.review.sourcePGN);assert.equal(after.fen,before.fen);assert.equal(after.review.totalPly,3);assert.equal(after.review.cursor,1);
    assert.equal(await page.locator('#analysisActivity,.analysis-activity-slot').count(),0);
    await page.screenshot({path:path.join(evidence,label+'-ordinary-P4-reload-SL.png'),fullPage:true});records.push({case:label+' ordinary full3/cursor1 after GUI/locale/collapse reload',pass:true,before,after});
  }
  assert.deepEqual(errors,[]);
});
