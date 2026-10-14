'use strict';
// Bounded real-engine QA. Browser emulation is not physical iPhone acceptance.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const playwright=require('playwright');
const option=name=>process.argv.find(x=>x.startsWith('--'+name+'='))?.slice(name.length+3);
const kind=option('browser')||'chromium',out=path.resolve(option('output')||'r13-evidence');
const base=path.resolve(__dirname,'..');
const report={schema:'chessbest.r14.engine-memory.v1',startedAt:new Date().toISOString(),browser:kind,physicalIPhone:false,checks:[],results:{},errors:[]};
let server,browser;
const check=(name,value)=>{assert(value,name);report.checks.push(name);console.log('PASS '+name);};
async function serve(){
  const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.wasm':'application/wasm','.json':'application/json','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png'};
  server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://local'),name=decodeURIComponent(url.pathname).slice('/chess-lab/'.length)||'index.html';
    if(!url.pathname.startsWith('/chess-lab/')||name.includes('..'))return res.writeHead(404).end();
    try{const file=path.join(base,name);res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');fs.createReadStream(file).on('error',()=>res.end()).pipe(res);}catch(_){res.writeHead(404).end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return 'http://127.0.0.1:'+server.address().port+'/chess-lab/';
}
async function boot(context,url){
  await context.addInitScript(()=>{
    if(window.__r13Workers)return;
    const Native=Worker;window.__r13Workers=[];
    window.Worker=new Proxy(Native,{construct(Target,args){const worker=new Target(...args),record={url:String(args[0]),terminated:false};__r13Workers.push(record);const terminate=worker.terminate.bind(worker);worker.terminate=()=>{record.terminated=true;return terminate();};return worker;}});
  });
  const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
  await page.goto(url,{waitUntil:'load',timeout:90000});
  await page.waitForFunction(()=>window.ChessLabHost&&window.ChessAnalysisControls&&navigator.serviceWorker.controller?.scriptURL.endsWith('/engine-sw.js'),null,{timeout:45000});
  await page.evaluate(()=>{
    const create=ChessAnalysisSession.create;ChessAnalysisSession.create=config=>{const session=create(config),analyze=session.analyze;
      session.analyze=options=>{const info=options.onInfo;return analyze({...options,onInfo:(...args)=>{window.__r13Latest=args[1];info?.(...args);}}).then(done=>{window.__r13Latest=done;return done;});};return session;};
  });
  return page;
}
async function deep(page){
  if(await page.evaluate(()=>document.body.classList.contains('app-mobile')))await page.locator('[data-app-tab="deep"]').click();
  else await page.locator('#desktopViewTabs [data-desktop-view="deep"]').click();
  await page.locator('[data-deep="mode"]').waitFor({state:'visible'});
}
async function link(page,checked){await page.evaluate(checked=>{const control=document.getElementById('analysisLink');control.checked=checked;control.dispatchEvent(new Event('change',{bubbles:true}));},checked);}
function studyPreserved(before,after){
  for(const original of before.studies){
    const retained=after.studies.find(study=>study.id===original.id);
    if(!retained||['title','rootFen','headers','result'].some(key=>JSON.stringify(original[key])!==JSON.stringify(retained[key])))return false;
    function visit(oldNode,newNode){
      if(!newNode)return false;
      for(const key of Object.keys(oldNode).filter(key=>!['id','parentId','children'].includes(key)))
        if(JSON.stringify(oldNode[key])!==JSON.stringify(newNode[key]))return false;
      return oldNode.children.every(id=>visit(original.nodes[id],newNode.children.map(child=>retained.nodes[child]).find(node=>node.move===original.nodes[id].move)));
    }
    if(!visit(original.nodes.root,retained.nodes.root))return false;
  }
  return JSON.stringify(before.comparison)===JSON.stringify(after.comparison);
}
async function chooseTime(page,ms){await page.evaluate(ms=>{const select=document.querySelector('[data-deep="time"]');if(![...select.options].some(o=>o.value===String(ms)))select.add(new Option('Bounded QA',String(ms)));select.value=String(ms);select.dispatchEvent(new Event('change',{bubbles:true}));},ms);}
async function search(page,mode){
  await page.locator('[data-deep="mode"]').selectOption(mode);await chooseTime(page,500);
  await page.evaluate(()=>{window.__r13Latest=null;});
  await page.locator('[data-deep="start"]').click();
  await page.waitForFunction(mode=>window.__r13Latest?.mode===mode&&['complete','partial','stopped'].includes(__r13Latest.status),mode,{timeout:120000});
  const result=await page.evaluate(()=>__r13Latest);
  check(mode+' real engines complete a fresh timed search',result.status==='complete'&&Object.values(result.children).every(child=>child.lines?.length));
  check(mode+' independent legal PVs and requested time retained',await page.evaluate(result=>Object.values(result.children).every(child=>child.limits.movetime===500&&child.limits.depth==null&&child.lines.every(line=>{const game=new Chess(result.fen);return line.pv.every(move=>!!game.move({from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]}));})),result));
  report.results[mode]=result;return result;
}
async function preview(page,label){
  const fen=await page.evaluate(()=>ChessLabHost.getContext().fen),scroll=await page.evaluate(()=>window.scrollY);
  await page.locator('.deep-pv button').first().click();await page.waitForTimeout(180);
  const fit=await page.evaluate(()=>{
    const workspace=document.getElementById('workspaceDisplay').getBoundingClientRect(),preview=document.querySelector('[data-deep="preview"]'),board=preview.querySelector('.board-b72b1').getBoundingClientRect();
    const squares=preview.querySelectorAll('.square-55d63');
    return {board:{width:board.width,height:board.height,top:board.top,bottom:board.bottom},workspace:{top:workspace.top,bottom:workspace.bottom},squareCount:squares.length,visible:squares.length===64&&Math.abs(board.height-board.width)<2&&board.top>=workspace.top-1&&board.bottom<=workspace.bottom+1,
      pvHeight:document.querySelector('.deep-pv').getBoundingClientRect().height,mainFen:ChessLabHost.getContext().fen,pageScroll:window.scrollY};
  });
  report.results[label+'Preview']=fit;
  check(label+' preview contains all eight ranks inside the workspace',fit.visible);
  check(label+' preview leaves the main board and page scroll unchanged',fit.mainFen===fen&&fit.pageScroll===scroll);
  check(label+' every Deep PV has exactly two fixed rows',fit.pvHeight===56);
  await page.locator('#controls').screenshot({path:path.join(out,label+'-preview.png')});
}

async function ramSettings(page,all){
  if(!await page.locator('#btnSettings').isVisible())await page.locator('#appMore').click();
  await page.locator('#btnSettings').click();
  await page.locator('#engineStorage').evaluate(element=>element.open=true);
  await page.locator('[data-engine-memory-all]').setChecked(all);
}
async function memoryChecks(page,label){
  const modes=['sf-lite','sf-full','berserk','reckless','lc0'];
  check(label+' default memory policy is one',await page.evaluate(()=>ChessAnalysisSession.getSettings().engineMemoryPolicy==='one'));
  await link(page,false);await deep(page);await search(page,'sf-lite');
  await page.locator('[data-deep="stop"]').click();
  const initial=await page.evaluate(()=>ChessAnalysisSession.engineMemory.getState().engines.find(e=>e.mode==='sf-lite').instanceId);
  check(label+' actual board move preserves its prepared worker',await page.evaluate(initial=>{
    const moved=ChessLabHost.playSuggestedMove('e2e4');
    return moved&&ChessAnalysisSession.engineMemory.getState().engines.find(e=>e.mode==='sf-lite').instanceId===initial;
  },initial));
  const shared=await page.evaluate(async()=>{
    const engine=ChessAnalysisSession.backendFor('sf-lite',Chess).create({Chess});
    try{return await engine.analyze({fen:ChessLabHost.getContext().fen,history:ChessLabHost.getContext().positionHistory,movetime:500,multiPV:2});}finally{engine.destroy();}
  });
  check(label+' card/probe backend reuses the Deep worker on a different FEN',shared.engineMemory.instanceId===initial&&shared.engineMemory.fromMemory&&shared.lines.length>0);
  await ramSettings(page,true);
  check(label+' all RAM checkbox has a full mobile touch target',await page.locator('.engine-memory-choice').evaluate(element=>element.getBoundingClientRect().height>=44));
  await page.waitForFunction(()=>ChessAnalysisSession.engineMemory.getState().engines.every(e=>e.status==='ready'),null,{timeout:180000});
  const warmed=await page.evaluate(()=>({state:ChessAnalysisSession.engineMemory.getState(),workers:__r13Workers.filter(w=>!w.terminated).length,stored:JSON.parse(localStorage.getItem('ChessBest:LAB:v2:analysis-engine-r3')).engineMemoryPolicy}));
  report.results[label+'WarmAll']=warmed;
  check(label+' all five genuine variants occupy RAM simultaneously',warmed.state.engines.length===5&&warmed.workers===5&&warmed.stored==='all');
  await page.locator('#settingsPanel').screenshot({path:path.join(out,label+'-ram-settings.png')});
  await page.locator('#btnCloseSettings').click();
  for(const mode of modes){
    const result=await page.evaluate(async mode=>{
      const engine=ChessAnalysisSession.backendFor(mode,Chess).create({Chess});
      try{return await engine.analyze({fen:ChessLabHost.getContext().fen,history:ChessLabHost.getContext().positionHistory,movetime:500,multiPV:2});}finally{engine.destroy();}
    },mode);
    report.results[label+'Memory-'+mode]=result;
    check(label+' '+mode+' searches using its already prepared native worker',result.engineMemory.fromMemory&&result.lines?.length>0);
  }
  check(label+' completed searches retain all five workers',await page.evaluate(()=>ChessAnalysisSession.engineMemory.getState().engines.every(e=>e.status==='ready')&&__r13Workers.filter(w=>!w.terminated).length===5));
  await ramSettings(page,false);
  await page.waitForFunction(()=>ChessAnalysisSession.engineMemory.getState().engines.filter(e=>e.status==='ready').length===1);
  check(label+' turning All off releases four idle workers',await page.evaluate(()=>__r13Workers.filter(w=>!w.terminated).length===1));
  await page.locator('[data-engine-memory-all]').check();
  await page.waitForFunction(()=>ChessAnalysisSession.engineMemory.getState().engines.every(e=>e.status==='ready'),null,{timeout:180000});
  await page.locator('#btnCloseSettings').click();
}

(async()=>{
  fs.mkdirSync(out,{recursive:true});const url=option('url')||await serve();report.url=url;
  let proxy;if(option('url')&&process.env.HTTPS_PROXY){const value=new URL(process.env.HTTPS_PROXY);proxy={server:value.protocol+'//'+value.host};if(value.username)proxy.username=decodeURIComponent(value.username);if(value.password)proxy.password=decodeURIComponent(value.password);}
  if(kind==='chromium'){browser=await playwright.chromium.launch({headless:true,
    ...(process.env.CHESS_QA_CHROMIUM?{executablePath:process.env.CHESS_QA_CHROMIUM}:{}),
    args:['--no-sandbox','--disable-dev-shm-usage',...(proxy?['--ignore-certificate-errors']:[])],proxy});}
  else browser=await playwright.webkit.launch({headless:true,proxy});
  report.version=browser.version();
  const desktopContext=await browser.newContext({serviceWorkers:'allow',ignoreHTTPSErrors:!!proxy,viewport:{width:1920,height:1080}});
  const page=await boot(desktopContext,url);
  report.release=await page.evaluate(async()=>await(await fetch('release.json',{cache:'no-store'})).json());
  if(option('release'))check('public document has the exact expected release',report.release.version===option('release'));
  await page.evaluate(()=>{document.getElementById('gameTitle').textContent='Dreev–Kasparov: whole-game review (V4)';document.getElementById('openingName').textContent='';});
  check('desktop CDB labels and compact row',await page.evaluate(()=>document.querySelector('#analysisSource [value="cdb"]').textContent==='ChessDB.cn (CDB)'&&document.querySelector('.cdb-desktop-label').textContent==='CDB'&&Math.abs(document.querySelector('.analysis-checks').getBoundingClientRect().top-document.querySelector('.analysis-dcc-actions').getBoundingClientRect().top)<8));
  check('empty metadata occupies no reserved rows and decorative rule is removed',await page.evaluate(()=>getComputedStyle(document.getElementById('openingName')).display==='none'&&document.getElementById('gameTitle').clientHeight<44&&getComputedStyle(document.querySelector('.board-actions')).borderBottomWidth==='0px'));
  for(const theme of ['dark','light']){
    await page.evaluate(theme=>document.body.classList.toggle('light-theme',theme==='light'),theme);
    check(theme+' More+ matches New game colors and border',await page.evaluate(()=>{const a=getComputedStyle(document.getElementById('btnNew')),b=getComputedStyle(document.getElementById('btnWorkspaceMore'));return ['backgroundColor','color','borderColor'].every(k=>a[k]===b[k]);}));
  }
  await deep(page);await page.locator('#analysisLink').check();
  for(const mode of ['berserk','reckless','lc0','sf-full','sf-lite']){
    await page.locator('[data-deep="mode"]').selectOption(mode);
    check('Link immediately synchronizes '+mode+' to the board source',await page.locator('#analysisSource').inputValue()===mode);
  }
  await page.locator('#analysisLink').uncheck();await page.locator('[data-deep="mode"]').selectOption('berserk');
  check('Link Off preserves the independent board source',await page.locator('#analysisSource').inputValue()==='sf-lite');
  await page.locator('#analysisSource').selectOption('cdb');
  await search(page,'sf-lite');await preview(page,'desktop-HD');
  await page.setViewportSize({width:3840,height:2160});await page.waitForTimeout(150);await preview(page,'desktop-4K');
  await page.locator('[data-deep="stop"]').click();
  await memoryChecks(page,'desktop');
  await desktopContext.close();
  const mobileContext=await browser.newContext({serviceWorkers:'allow',ignoreHTTPSErrors:!!proxy,viewport:{width:402,height:874},hasTouch:true,isMobile:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'});
  const phone=await boot(mobileContext,url);
  check('mobile labels and full touch targets fit',await phone.evaluate(()=>document.querySelector('#analysisSource [value="cdb"]').textContent==='CDB'&&document.documentElement.scrollWidth<=innerWidth&&document.getElementById('analysisLink').closest('label').getBoundingClientRect().height>=44));
  await memoryChecks(phone,'mobile');
  await phone.evaluate(()=>ChessLabHost.navigate({startFen:new Chess().fen(),moves:[]}));
  await ramSettings(phone,false);await phone.locator('#btnCloseSettings').click();
  await link(phone,false);await deep(phone);
  for(const mode of ['sf-lc0','sf-reckless','sf-berserk','all']){
    const result=await search(phone,mode);
    check(mode+' mobile runs one child at a time',result.allocation.sequential&&result.allocation.totalThreads===1&&await phone.evaluate(()=>__r13Workers.filter(w=>!w.terminated).length<=1));
  }
  check('All Engines contains the four genuine families',Object.keys(report.results.all.children).join(',')==='sf-lite,lc0,reckless,berserk');
  check('LCZero retains native Q and real visits in Deep',report.results.all.children.lc0.visits>1&&report.results.all.children.lc0.lines[0].score.type==='q');
  await preview(phone,'mobile');
  await phone.locator('[data-deep="stop"]').click();
  await link(phone,true);const linked=await search(phone,'berserk');
  check('linked Berserk Deep paints board candidates and source',await phone.evaluate(()=>document.getElementById('analysisSource').value==='berserk'&&ChessLabHost.getContext().boardAnalysisProvider==='BER'&&document.querySelectorAll('#board .overlay').length>0));
  await phone.locator('[data-deep="stop"]').click();await link(phone,false);
  await phone.locator('[data-deep="mode"]').selectOption('all');await chooseTime(phone,10000);await phone.locator('[data-deep="start"]').click();await phone.waitForTimeout(80);await phone.locator('[data-deep="stop"]').click();
  check('Stop cancels active and queued group workers',await phone.evaluate(()=>__r13Workers.filter(w=>!w.terminated).length<=1&&document.querySelector('[data-deep="stop"]').disabled));
  await phone.evaluate(async()=>{
    localStorage.setItem('R13-data-guard','retained');
    await ChessLabHost.onSaveLine({fen:ChessLabHost.getContext().fen,pv:['e2e4','e7e5'],source:'R13 saved Study guard',depth:1,evaluation:{type:'cp',white:0}});
  });
  await phone.waitForFunction(()=>localStorage.getItem('ChessBest:LAB:v2:studies')?.includes('R13 saved Study guard'));
  const saved=await phone.evaluate(()=>localStorage.getItem('ChessBest:LAB:v2:studies'));
  await phone.close();await mobileContext.setOffline(true);
  if(kind==='webkit')report.offlineStatus='PENDING_PHYSICAL_IPHONE: WebKit fresh offline navigation deferred after the R12 browser-internal failure';
  else{
    const offline=await boot(mobileContext,url);await offline.evaluate(()=>ChessLabHost.navigate({startFen:new Chess().fen(),moves:['d2d4','d7d5']}));await deep(offline);
    const value=await search(offline,'all');report.results.offlineAll=value;
    check('fresh offline document computes four real engines on a different FEN',value.fen!==report.results['sf-lc0'].fen&&Object.values(value.children).every(child=>child.engineAssetStorage?.assetCacheHit||child.engine?.id?.includes('lite')));
    const retained=await offline.evaluate(()=>({studies:localStorage.getItem('ChessBest:LAB:v2:studies'),sentinel:localStorage.getItem('R13-data-guard')}));
    report.studyReadback={before:JSON.parse(saved),after:JSON.parse(retained.studies),sentinel:retained.sentinel};
    // Navigation records the new d4/d5 branch. The existing Study validator
    // renumbers nodes, so compare paths, full annotations and stable Study IDs.
    check('offline restart preserves saved Study trees, notes and unrelated data',studyPreserved(JSON.parse(saved),JSON.parse(retained.studies))&&retained.sentinel==='retained');
    await offline.close();report.offlineStatus='PASS';
  }
  await mobileContext.setOffline(false);
  const restore=await boot(mobileContext,url);
  await ramSettings(restore,true);
  await restore.waitForFunction(()=>ChessAnalysisSession.engineMemory.getState().engines.every(e=>e.status==='ready'),null,{timeout:180000});
  await restore.evaluate(()=>localStorage.setItem('R14-memory-guard','retained'));
  await restore.close();await mobileContext.setOffline(true);
  if(kind==='chromium'){
    const reopened=await boot(mobileContext,url);
    await reopened.waitForFunction(()=>ChessAnalysisSession.engineMemory.getState().engines.every(e=>e.status==='ready'),null,{timeout:180000});
    check('offline new document restores saved All preference and prepares all five native engines',await reopened.evaluate(()=>ChessAnalysisSession.getSettings().engineMemoryPolicy==='all'&&__r13Workers.filter(w=>!w.terminated).length===5&&localStorage.getItem('R14-memory-guard')==='retained'));
    await reopened.close();
  }
  check('browser reports no uncaught errors',report.errors.length===0);
  await mobileContext.close();report.status='PASS';
})().catch(error=>{report.status='FAIL';report.failure=error.stack;console.error(error.stack);process.exitCode=1;}).finally(async()=>{
  report.finishedAt=new Date().toISOString();fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));
});
