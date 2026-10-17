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
async function open(t,{width=1280,height=800,app=false,preview=false,deviceScaleFactor=1,cdbFixture=false}={}){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor,serviceWorkers:'block',...(app&&!preview?{isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1'}:{})});t.after(()=>context.close());
  await context.route('**/*',async route=>{
    const u=new URL(route.request().url());if(u.origin===origin)return route.continue();
    if(cdbFixture&&u.searchParams.has('action')){
      // Controlled transport, real shipped DCC computation and renderers.
      const {Chess}=require('../js/chess.min.js'),game=new Chess(u.searchParams.get('board'));
      const text=u.searchParams.get('action')==='queryall'?game.moves({verbose:true}).slice(0,7).map((m,i)=>'move:'+m.from+m.to+(m.promotion||'')+',score:0,rank:'+(i+1)+',note:*').join('|'):'eval:0';
      await new Promise(r=>setTimeout(r,45));return route.fulfill({status:200,contentType:'text/plain',headers:{'access-control-allow-origin':'*'},body:text});
    }
    return route.abort();
  });
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
test('P4 final title is legible in both themes and languages while native expansion preserves settings',{timeout:45000},async t=>{
  for(const app of [false,true]){
    const page=await open(t,app?{app,width:402,height:874}:{});
    await page.locator(app?'[data-app-tab="deep"]':'[data-desktop-view="deep"]').click();
    const configuration=page.locator('.deep-configuration'),summary=configuration.locator(':scope > summary');
    assert.equal(await configuration.getAttribute('open'),null,'default remains collapsed');
    const initial=await page.locator('[data-deep="configuration-body"] select').evaluateAll(es=>es.map(e=>({key:e.dataset.deep,value:e.value})));
    for(const light of [false,true]){
      await page.locator('[data-open-appearance]').click();await page.locator('#settingTheme').setChecked(light);
      await page.keyboard.press('Escape');await page.locator('#settingsPanel').waitFor({state:'hidden'});
      for(const lang of ['sl','en']){
        await page.locator((app?'.app-language':'.desktop-language')+' [data-app-lang="'+lang+'"]').click();
        for(const expanded of [false,true]){
          if((await configuration.getAttribute('open')!==null)!==expanded)await summary.click();
          const observed=await summary.evaluate(el=>{
            const title=el.querySelector('strong'),color=s=>{const m=s.match(/[\d.]+/g)||[];return [Number(m[0]),Number(m[1]),Number(m[2]),m[3]===undefined?1:Number(m[3])];};
            let bg=[255,255,255];const chain=[];for(let n=title;n;n=n.parentElement)chain.unshift(n);
            for(const n of chain){const c=color(getComputedStyle(n).backgroundColor);bg=bg.map((v,i)=>c[i]*c[3]+v*(1-c[3]));}
            const luminance=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
            const ink=color(getComputedStyle(title).color),a=luminance(ink),b=luminance(bg);
            return {text:title.textContent,color:getComputedStyle(title).color,yellow:ink[0]>ink[2]*1.5&&ink[1]>ink[2]*1.5,summaryColor:getComputedStyle(el.querySelector('span')).color,background:getComputedStyle(el).backgroundColor,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),rect:title.getBoundingClientRect().toJSON()};
          });
          assert.equal(observed.text,lang==='sl'?'Nastavitve analize':'Analysis settings');assert(observed.yellow,'title is yellow/gold');assert(observed.contrast>=4.5,'title readable in '+(light?'light':'dark')+' theme');
          assert.notEqual(observed.color,observed.summaryColor,'only the title receives emphasis');assert(observed.rect.width>50&&observed.rect.height>10);
          assert.deepEqual(await page.locator('[data-deep="configuration-body"] select').evaluateAll(es=>es.map(e=>({key:e.dataset.deep,value:e.value}))),initial);
          records.push({case:'final yellow title / controlled engine adapters',app,light,lang,expanded,...observed});
          await page.screenshot({path:path.join(evidence,'title-'+(app?'APP':'desktop')+'-'+(light?'light':'dark')+'-'+lang+'-'+(expanded?'open':'closed')+'-viewport.png'),fullPage:false});
        }
      }
    }
    assert.equal(await page.evaluate(()=>window.__P4.calls.length),0,'title/theme/language/toggle launches no engine');
  }
});
test('P4 fix browser DCC partial/final/recomposed captions localize owned measurements and retain source receipts',{timeout:60000},async t=>{
  const page=await open(t,{width:1280,height:520,cdbFixture:true});
  const capture=()=>page.evaluate(()=>{const b=document.querySelector('[data-eval-source="DCC"]'),p=document.querySelector('#dccProgress');return {lang:document.documentElement.lang,direct:p.title,parent:b.title,note:b.querySelector('small').title,aria:b.getAttribute('aria-label'),candidates:document.querySelector('#analysisCandidates').textContent};});
  await page.waitForFunction(()=>/^\d+\/\d+$/.test(document.querySelector('#dccProgress').textContent)&&!window.ChessLabHost.getContext().analysisSources.DCC);
  const invariants=()=>page.evaluate(()=>({game:window.ChessLabHost.getReviewGame(),dcc:window.ChessDCC.config(window.ChessLabHost.getContext().settings)}));
  const initial=await invariants();await page.locator('#btnSettings').click();
  await page.locator('#settingFont').selectOption('18px');await page.locator('#settingLabWorkspaceWidth').selectOption('560');await page.locator('#settingTheme').check();await page.locator('#settingLabCompact').check();
  await page.keyboard.press('Escape');await page.locator('#settingsPanel').waitFor({state:'hidden'});assert.deepEqual(await invariants(),initial);
  for(const lang of ['sl','en','sl']){
    await page.locator('.desktop-language [data-app-lang="'+lang+'"]').click();const c=await capture();
    records.push({case:'actual DCC partial composed captions / controlled CDB transport',...c});
    for(const text of [c.direct,c.parent,c.note,c.aria])assert.doesNotMatch(text,lang==='sl'?/source probes|measured candidates/:/pregledov vira|izmerjenih kandidatov/);
  }
  await page.waitForFunction(()=>!!window.ChessLabHost.getContext().analysisSources.DCC,{},{timeout:30000});
  const before=await page.evaluate(()=>window.ChessLabHost.getContext().analysisSources.DCC);
  // This transport supplies root moves/scores, not verified PV/defenses. The
  // real policy may truthfully return partial; cancellation would publish none.
  assert(['complete','partial'].includes(before.receipt.status)&&before.receipt.calls>0,'Appearance retains the in-flight real DCC result');
  records.push({case:'real DCC receipt from controlled transport; completeness is not fabricated',receipt:before.receipt});
  for(const lang of ['en','sl','en','sl']){
    await page.locator('.desktop-language [data-app-lang="'+lang+'"]').click();await page.locator('button[data-desktop-view="dcc"]').click();await page.locator('button[data-desktop-view="moves"]').click();
    const c=await capture();records.push({case:'actual DCC final + view rerender / controlled CDB transport',...c});
    for(const text of [c.direct,c.parent,c.note,c.aria]){assert.match(text,lang==='sl'?/\d+\/\d+ izmerjenih kandidatov/:/\d+\/\d+ measured candidates/);assert.doesNotMatch(text,lang==='sl'?/measured candidates/:/izmerjenih kandidatov/);}
    assert(c.candidates.endsWith(before.receipt.calls+(lang==='sl'?' pregledov':' probes')));assert(c.candidates.includes(before.receipt.reason));
    assert.deepEqual(await page.evaluate(()=>window.ChessLabHost.getContext().analysisSources.DCC),before);
    await page.screenshot({path:path.join(evidence,'fix-DCC-final-'+lang+'-viewport.png'),fullPage:false});
  }
});
const geometry=page=>page.evaluate(()=>({board:document.querySelector('#board').getBoundingClientRect().toJSON(),workspace:document.querySelector('#workspaceDisplay').getBoundingClientRect().toJSON(),cards:[...document.querySelectorAll('.all-eval-badge')].map(e=>({source:e.dataset.evalSource,rect:e.getBoundingClientRect().toJSON(),moveFont:getComputedStyle(e.querySelector('.all-eval-move')).fontSize}))}));
// A no-overflow assertion alone previously passed a 22px board. Wait for the
// resize observer/chessboard redraw to settle, then inspect the usable content.
async function settledLayout(page){
  return page.evaluate(async()=>{
    let previous='',same=0;
    for(let frame=0;frame<120;frame++){
      await new Promise(requestAnimationFrame);
      const rect=document.querySelector('#board').getBoundingClientRect(),key=[rect.width,rect.height,document.documentElement.scrollHeight].join(':');
      same=key===previous?same+1:0;previous=key;if(same>=5)break;
    }
    const box=e=>e.getBoundingClientRect().toJSON();
    return {viewport:{width:innerWidth,height:innerHeight},board:box(document.querySelector('#board')),container:box(document.querySelector('#board-container')),controls:box(document.querySelector('#controls')),
      pageWidth:document.documentElement.scrollWidth,squares:[...document.querySelectorAll('#board [data-square]')].map(box),
      cards:[...document.querySelectorAll('.all-eval-badge')].map(e=>({rect:box(e),text:e.textContent,main:[...e.querySelectorAll('.all-eval-move,.all-eval-score')].map(n=>({rect:box(n),text:n.textContent,scroll:n.scrollWidth,client:n.clientWidth,font:parseFloat(getComputedStyle(n).fontSize)}))}))};
  });
}
function usableLayout(g,label){
  assert(g.board.width>=240&&g.board.height>=240,label+' board >=240px; actual '+g.board.width+' × '+g.board.height);
  assert(Math.abs(g.board.width-g.board.height)<1,label+' square board');assert.equal(g.squares.length,64);
  for(const s of g.squares){assert(s.width>=29&&Math.abs(s.width-s.height)<1,label+' usable square');}
  assert(g.pageWidth<=g.viewport.width+1,label+' no horizontal page overflow');assert.equal(g.cards.length,6);
  for(const [i,c]of g.cards.entries()){
    assert(c.rect.width>=96&&c.rect.height>=62,label+' readable card '+i);
    for(const m of c.main){assert(m.font>=12&&m.scroll<=m.client+1,label+' main move/score not clipped '+m.text);assert(m.rect.x>=c.rect.x&&m.rect.right<=c.rect.right+1);}
    for(const other of g.cards.slice(i+1))assert(c.rect.right<=other.rect.x+1||other.rect.right<=c.rect.x+1||c.rect.bottom<=other.rect.y+1||other.rect.bottom<=c.rect.y+1,label+' cards do not overlap');
  }
}
test('P4 fix short desktop has usable settled board/cards and reachable navigation across Appearance preferences',{timeout:240000},async t=>{
  const page=await open(t,{width:1280,height:520});await page.locator('[data-desktop-view="deep"]').click();
  // Start with the exact rejected configuration, then cover both resize directions.
  for(const height of [520,800])for(const width of ['500','560','0'])for(const font of ['18px','14px'])for(const light of [false,true]){
    await page.locator('[data-open-appearance]').click();
    await page.locator('#settingFont').selectOption(font);await page.locator('#settingLabWorkspaceWidth').selectOption(width);
    await page.locator('#settingTheme').setChecked(light);await page.locator('#settingLabCompact').setChecked(light);
    await page.keyboard.press('Escape');await page.locator('#settingsPanel').waitFor({state:'hidden'});
    await page.setViewportSize({width:1280,height});
    const g=await settledLayout(page),label=[height,width,font,light?'light-compact':'dark'].join('-');records.push({case:'responsive fix settled geometry',label,...g});
    await page.screenshot({path:path.join(evidence,'fix-'+label+'-viewport.png'),fullPage:false});usableLayout(g,label);
    for(const view of ['moves','review','dcc','library','deep']){
      const nav=page.locator(view==='library'?'#btnGames':'button[data-desktop-view="'+view+'"]');await nav.click();
      assert.equal(await page.locator('body').getAttribute('data-desktop-view'),view);
      const reachable=await nav.evaluate(e=>{const r=e.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.top>=0&&r.bottom<=innerHeight&&!!at&&(at===e||e.contains(at));});assert(reachable,label+' reachable '+view);
    }
    await page.screenshot({path:path.join(evidence,'fix-'+label+'-navigation-viewport.png'),fullPage:false});
  }
  await page.setViewportSize({width:1280,height:520});const reverse=await settledLayout(page);usableLayout(reverse,'resize back to short');records.push({case:'responsive fix reverse resize',...reverse});
  assert.deepEqual(errors,[]);
});
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
    usableLayout(await settledLayout(page),spec.label+' mixed active fixture');
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
      const phases=await deep.locator('[data-deep="status"]').textContent();
      assert.match(phases,lang==='sl'?/: nalaganje/:/: loading/,'actual composed LC0 loading phase');
      assert.match(phases,lang==='sl'?/: analizira/:/: searching/,'actual composed searching phase');
      assert.doesNotMatch(phases,lang==='sl'?/: (loading|searching)/:/: (nalaganje|analizira)/);
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
    for(const lang of ['en','sl','en']){
      await page.locator((spec.app?'.app-language':'.desktop-language')+' [data-app-lang="'+lang+'"]').click();
      const stopped=await deep.locator('[data-deep="status"]').textContent();
      assert.match(stopped,lang==='sl'?/Ustavljeno/:/Stopped/,'actual stopped status follows locale');
    }
    if(spec.app){await page.locator('[data-app-tab="board"]').click();const board=await settledLayout(page);usableLayout(board,spec.label+' Large board');records.push({case:'APP Large board usable',...spec,...board});await page.screenshot({path:path.join(evidence,spec.label+'-large-board-viewport.png'),fullPage:false});}
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
