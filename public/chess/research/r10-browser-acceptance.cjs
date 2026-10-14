'use strict';
// Actual WASM/NNUE engines. Only --hang changes Berserk's go command in the
// explicit watchdog fault-injection case. Linux WebKit is not a physical iPhone.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const playwright=require('playwright');
const option=name=>process.argv.find(x=>x.startsWith('--'+name+'='))?.slice(name.length+3);
const kind=option('browser')||'chromium',budget=Number(option('budget')||500),out=path.resolve(option('evidence')||'.');
let browser,server;
const report={schema:'chessbest.r10.browser-acceptance.v1',startedAt:new Date().toISOString(),browser:kind,physicalIPhone:false,checks:[],results:{},pageErrors:[],assetRequests:[]};
const check=(name,ok)=>{assert(ok,name);report.checks.push(name);console.log('PASS '+name);};
async function localURL(){
 const base=path.resolve(__dirname,'../..'),types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.wasm':'application/wasm','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
 server=http.createServer((req,res)=>{let file=path.join(base,decodeURIComponent(new URL(req.url,'http://local').pathname));if(!file.startsWith(base+path.sep))return res.writeHead(403).end();try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);}catch(_){res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port+'/chess-lab/';
}
async function boot(context,url){
 const p=await context.newPage();
 if(process.argv.includes('--cdb-fixture')){
  report.cdbBoundary='Deterministic legal CDB transport fixture; unchanged DCC algorithm and all local engines are actual';
  const {Chess}=require('../js/chess.min.js');await p.route(/cdb\.php|\/\.netlify\/functions\/queryall/,route=>{
   const u=new URL(route.request().url()),fen=u.searchParams.get('board'),action=u.searchParams.get('action');let body='';
   try{const g=new Chess(fen);
    if(u.pathname.includes('queryall')||action==='queryall')body=g.moves({verbose:true}).slice(0,3).map((m,i)=>'move:'+m.from+m.to+(m.promotion||'')+',score:'+String(12-i)+',rank:'+String(i+1)+',note:*').join('|');
    else if(action==='querypv'){const moves=[];for(let i=0;i<6&&!g.game_over();i++){const m=g.moves({verbose:true})[0];moves.push(m.from+m.to+(m.promotion||''));g.move(m);}body='score:0,depth:20,pv:'+moves.join('|');}
    else body='eval:0';
   }catch(_){}
   return route.fulfill({body,contentType:'text/plain',headers:{'access-control-allow-origin':'*'}});
  });
 }
 p.on('pageerror',e=>report.pageErrors.push(e.message));p.on('request',r=>{if(/\.(?:wasm|nn)(?:\?|$)/.test(r.url()))report.assetRequests.push(r.url());});
 await p.addInitScript(()=>{
  const Native=Worker,descriptor=Object.getOwnPropertyDescriptor(Worker.prototype,'onmessage');window.__r9Workers=[];window.__r9Statuses=[];
  window.Worker=new Proxy(Native,{construct(Target,args){const w=new Target(...args),record={url:String(args[0]),created:performance.now(),terminated:false,commands:[],progress:[]};__r9Workers.push(record);
   const post=w.postMessage.bind(w),terminate=w.terminate.bind(w);w.postMessage=(value,...rest)=>{if(typeof value==='string'){record.commands.push(value);if(window.__r9HangBerserk&&/berserk-host/.test(record.url)&&/^go movetime/.test(value)){record.injected='go infinite';value='go infinite';}}return post(value,...rest);};
   w.terminate=()=>{record.terminated=true;record.ended=performance.now();return terminate();};
   let handler;Object.defineProperty(w,'onmessage',{configurable:true,get:()=>handler,set(value){handler=value;descriptor.set.call(w,event=>{if(event.data?.type==='chessbest-engine-progress')record.progress.push(event.data);handler?.call(w,event);});}});return w;
  }});
  document.addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>{for(const n of document.querySelectorAll('#allEvalBadges [data-eval-source] small')){const entry=n.parentElement.dataset.evalSource+': '+n.textContent;if(__r9Statuses.at(-1)!==entry)__r9Statuses.push(entry);}}).observe(document.body,{subtree:true,childList:true,characterData:true}));
 });
 await p.goto(url,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>!!window.ChessLabHost&&document.querySelectorAll('#allEvalBadges [data-eval-source]').length===6);
 return p;
}
async function setBudget(p,ms){await p.evaluate(ms=>{const s=document.getElementById('settingAnalysisTime');if(![...s.options].some(o=>o.value===String(ms)))s.append(new Option('Acceptance budget',String(ms)));s.value=String(ms);s.dispatchEvent(new Event('change',{bubbles:true}));},ms);}
const role=mode=>({'sf-lite':'SF','sf-full':'SF',reckless:'RLE',lc0:'LC0',berserk:'BER'}[mode]);
async function settled(p,mode,previous){await p.waitForFunction(({mode,role,previous})=>{const r=ChessLabHost.getEngineCardResult(mode);return !ChessLabHost.getEngineCardState(role).working&&r&&r.jobId!==previous;},{mode,role:role(mode),previous},{timeout:120000});return p.evaluate(mode=>ChessLabHost.getEngineCardResult(mode),mode);}
async function analyze(p,mode){if(mode.startsWith('sf-'))await p.locator('#analysisSFFull').setChecked(mode==='sf-full');const previous=await p.evaluate(mode=>ChessLabHost.getEngineCardResult(mode)?.jobId,mode);await p.locator('#allEvalBadges [data-eval-source="'+role(mode)+'"]').click();return settled(p,mode,previous);}
async function valid(p,r,name){check(name+' finishes with a native result',['complete','stopped'].includes(r.status)&&!!r.lines?.length&&!r.error);check(name+' PV is legal',await p.evaluate(r=>r.lines.every(line=>{const g=new Chess(r.fen);return line.pv.every(m=>!!g.move({from:m.slice(0,2),to:m.slice(2,4),promotion:m[4]}));}),r));}
async function layout(p,mobile){
 for(const width of mobile?[320,393,430]:[1024,1440]){await p.setViewportSize({width,height:1000});await p.waitForFunction(()=>{const board=document.getElementById('board'),grid=board?.querySelector('.board-b72b1');return !grid||grid.getBoundingClientRect().width<=board.getBoundingClientRect().width+1;},null,{timeout:5000});const boxes=await p.evaluate(()=>{const rect=id=>document.getElementById(id).getBoundingClientRect().toJSON();return {width:innerWidth,scroll:document.documentElement.scrollWidth,all:rect('btnAnalyzeAll'),refresh:rect('btnAnalysisDeepen'),dcc:rect('btnDesktopDccAnalysis'),sim:rect(document.body.classList.contains('app-mobile')?'appSim':'btnSim'),legendClosed:!document.querySelector('.board-key').open,extra:!!document.querySelector('.app-analysis-status'),statusParent:document.getElementById('dccProgress').closest('[data-eval-source]')?.dataset.evalSource,offenders:[...document.body.querySelectorAll('*')].map(n=>({tag:n.tagName,id:n.id,className:typeof n.className==='string'?n.className:'',right:n.getBoundingClientRect().right,width:n.getBoundingClientRect().width})).filter(n=>n.width&&n.right>innerWidth+1).slice(0,12)};});
  (report.layout||=[]).push({mobile,width,boxes});
  check((mobile?'mobile ':'desktop ')+width+' has no horizontal overflow',boxes.scroll<=boxes.width);
  check((mobile?'mobile ':'desktop ')+width+' engine controls precede Refresh',boxes.all.y+boxes.all.height<=boxes.refresh.y+1);
  check((mobile?'mobile ':'desktop ')+width+' SIM sits immediately beside DCC',Math.abs(boxes.dcc.y-boxes.sim.y)<2&&boxes.sim.x>=boxes.dcc.x+boxes.dcc.width);
  check((mobile?'mobile ':'desktop ')+width+' useful touch targets',boxes.all.height>=(mobile?44:36)&&boxes.sim.height>=(mobile?44:36));
  check((mobile?'mobile ':'desktop ')+width+' card owns DCC status',boxes.statusParent==='DCC'&&!boxes.extra&&boxes.legendClosed);
 }
 await p.locator('.board-key summary').click();check('legend remains available',await p.locator('.board-key .board-legend').isVisible());await p.locator('.board-key summary').click();
 await p.locator(mobile?'#appSim':'#btnSim').click();check((mobile?'mobile':'desktop')+' SIM opens existing setup',await p.locator('#simTournamentDialog').isVisible());await p.locator('#simTournamentDialog').evaluate(n=>n.close());
}

async function heldStop(p,context,mode){
 const card=p.locator('#allEvalBadges [data-eval-source="'+role(mode)+'"]');
 await p.waitForFunction(role=>/Analyzing/.test(ChessLabHost.getEngineCardState(role).note),role(mode),{timeout:120000});
 await card.evaluate(n=>n.scrollIntoView({behavior:'instant',block:'center'}));
 await p.evaluate(()=>{window.__r10Input=[];if(window.__r10InputsBound)return;window.__r10InputsBound=true;for(const type of ['pointerdown','pointerup','mousedown','mouseup','touchstart','touchend','click'])document.addEventListener(type,e=>__r10Input.push({type,source:e.target.closest('[data-eval-source]')?.dataset.evalSource,target:e.target.tagName,x:e.clientX,y:e.clientY}),true);});
 const activeWorker=await p.evaluate(mode=>__r9Workers.map((w,i)=>({w,i})).filter(({w})=>!w.terminated&&(mode==='sf-lite'?/stockfish-18-lite/.test(w.url):mode==='sf-full'?/stockfish-full/.test(w.url):mode==='berserk'?/berserk/.test(w.url):mode==='reckless'?/reckless/.test(w.url):/lc0/.test(w.url))).at(-1)?.i,mode);
 check(mode+' has an actual active native worker',Number.isInteger(activeWorker));
 const original=await card.elementHandle(),target=await card.locator('.all-eval-move').elementHandle(),box=await card.boundingBox(),point={x:box.x+box.width/2,y:box.y+box.height/2};
 check(mode+' held input lands on its own card',await p.evaluate(({point,role})=>document.elementFromPoint(point.x,point.y)?.closest('[data-eval-source]')?.dataset.evalSource===role,{point,role:role(mode)}));
 if(kind==='chromium'){
  const cdp=await context.newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await p.waitForTimeout(180);
  check(mode+' mobile card and inner target survive touch-down',await original.evaluate(n=>n.isConnected)&&await target.evaluate(n=>n.isConnected));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
 }else{
  await p.mouse.move(point.x,point.y);await p.mouse.down();await p.waitForTimeout(180);
  check(mode+' WebKit card and inner target survive held input',await original.evaluate(n=>n.isConnected)&&await target.evaluate(n=>n.isConnected));await p.mouse.up();
 }
 report.results[mode+'-input']=await p.evaluate(({box,point,mode,role})=>({box,point,events:__r10Input,state:ChessLabHost.getEngineCardState(role),workers:__r9Workers}),{box,point,mode,role:role(mode)});
 await p.waitForFunction(role=>!ChessLabHost.getEngineCardState(role).working,role(mode),{timeout:3000});
 check(mode+' second card press actually stops its engine',!await p.evaluate(role=>ChessLabHost.getEngineCardState(role).working,role(mode)));
 check(mode+' actually terminates this search worker',await p.evaluate(index=>__r9Workers[index].terminated,activeWorker));
 check(mode+' held input targets the stable button',report.results[mode+'-input'].events.find(e=>e.type==='pointerdown')?.target==='BUTTON');
 const r=await p.evaluate(mode=>ChessLabHost.getEngineCardResult(mode),mode);await valid(p,r,mode+' retained after Stop');
}
async function verifyLayouts(p,options,url){
 await layout(p,true);
 for(const width of [320,393,430]){await p.setViewportSize({width,height:1000});const dimensions=await p.evaluate(()=>({link:document.querySelector('.analysis-link-toggle').getBoundingClientRect().height,names:[...document.querySelectorAll('#allEvalBadges strong')].map(n=>({scroll:n.scrollWidth,width:n.clientWidth})),dcc:document.querySelector('#allEvalBadges [data-eval-source="DCC"] small').getBoundingClientRect().height,line:parseFloat(getComputedStyle(document.querySelector('#allEvalBadges [data-eval-source="DCC"] small')).lineHeight)}));check('mobile '+width+' full names fit and Link remains tappable',dimensions.link>=44&&dimensions.names.every(n=>n.scroll<=n.width+1));report.results['geometry-'+width]=dimensions;check('mobile '+width+' DCC status uses one line',dimensions.dcc<=dimensions.line+1);}
 const desktop=await browser.newContext({...options,viewport:{width:1440,height:1000}}),d=await boot(desktop,url);await layout(d,false);check('desktop uses the same approved full names',JSON.stringify(await d.locator('#allEvalBadges strong').allTextContents())===JSON.stringify(['ChessDB','Stockfish','ChessDCC','Reckless','LC Zero','Berserk']));
 if(kind==='chromium'){await p.screenshot({path:path.join(out,'r10-mobile.png'),fullPage:true});await d.screenshot({path:path.join(out,'r10-desktop.png'),fullPage:true});}else report.inputBoundary='Native Linux WebKit touch taps and held mouse input; not Safari on a physical iPhone';
}
async function run(){
 const url=option('url')||await localURL();report.url=url;let proxy;
 if(!/127.0.0.1|localhost/.test(new URL(url).hostname)&&process.env.HTTPS_PROXY){const u=new URL(process.env.HTTPS_PROXY);proxy={server:u.protocol+'//'+u.host};if(u.username)proxy.username=decodeURIComponent(u.username);if(u.password)proxy.password=decodeURIComponent(u.password);}
 const launch={headless:true,proxy};if(kind==='chromium'){const m=require('@sparticuz/chromium'),c=m.default||m;launch.executablePath=await c.executablePath();launch.args=c.args.filter(a=>a!=='--single-process');}
 browser=await playwright[kind].launch(launch);report.version=browser.version();
 const options={serviceWorkers:'block',ignoreHTTPSErrors:!!proxy};const context=await browser.newContext({...options,viewport:{width:393,height:1000},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'}),p=await boot(context,url);
 check('Link is default OFF',!await p.locator('#analysisLink').isChecked());check('follow is independently default OFF',!await p.locator('#analysisAllMoves').isChecked());check('idle label is All engines',/All engines/.test(await p.locator('#btnAnalyzeAll').innerText()));
 check('approved full names appear in the mobile cards',JSON.stringify(await p.locator('#allEvalBadges strong').allTextContents())===JSON.stringify(['ChessDB','Stockfish','ChessDCC','Reckless','LC Zero','Berserk']));
 if(process.argv.includes('--layout-only')){await p.locator('#analysisLink').check();await p.waitForTimeout(500);await verifyLayouts(p,options,url);report.status='PASS';return;}
 const fixture=process.argv.includes('--cdb-fixture');let receipt;
 if(fixture){await p.waitForFunction(()=>ChessLabHost.getContext().analysisSources.DCC?.receipt.status==='complete',null,{timeout:30000});receipt=await p.evaluate(()=>ChessLabHost.getContext().analysisSources.DCC.receipt);check('actual DCC completes with fixture measurements',receipt.provider==='CDB'&&receipt.completed>0);}
 await setBudget(p,budget);const off=await analyze(p,'sf-lite');await valid(p,off,'SF Lite with Link off');
 check('Link OFF keeps the board source independent',await p.locator('#analysisSource').inputValue()==='cdb'&&await p.locator('#positionEval').getAttribute('data-eval-source')==='CDB');
 await p.locator('#analysisLink').check();check('Link does not enable automatic follow',!await p.locator('#analysisAllMoves').isChecked());
 for(const mode of ['sf-lite','sf-full','reckless','lc0','berserk']){
  const r=await analyze(p,mode);await valid(p,r,'mobile finite '+mode);report.results[mode]=r;
  check(mode+' settles within budget plus watchdog allowance',r.actualSearchMs<=r.requestedTimeMs+3500);
  check(mode+' Link selects its source',await p.locator('#analysisSource').inputValue()===mode&&await p.locator('#allEvalBadges [data-eval-source="'+role(mode)+'"]').getAttribute('aria-current')==='true');
  check(mode+' Link displays its native score and candidates',await p.evaluate(({role,r})=>document.getElementById('positionEval').dataset.evalSource===role&&document.getElementById('analysisCandidates').textContent.includes(r.engine.name),{role:role(mode),r}));
  if(mode==='lc0')check('LC Zero retains native Q provenance',r.lines[0].score.type==='q'&&/^Q /.test(await p.locator('#positionEvalLabel').innerText()));
  await setBudget(p,10000);await p.locator('#allEvalBadges [data-eval-source="'+role(mode)+'"]').click();await heldStop(p,context,mode);await setBudget(p,budget);if(process.argv.includes('--debug-stop')){report.status='PASS';return;}
 }
 if(fixture){const after=await p.evaluate(()=>ChessLabHost.getContext().analysisSources.DCC.receipt);check('native card runs preserve CDB DCC evidence without local probes',after.provider==='CDB'&&after.capturedAt===receipt.capturedAt);}
 await p.locator('#analysisSFFull').uncheck();
 const allSF=process.argv.includes('--full-all')?'sf-full':'sf-lite';
 if(allSF==='sf-full'){await p.locator('#allEvalBadges [data-eval-source="SF"]').tap();await p.waitForFunction(()=>/Analyzing/.test(ChessLabHost.getEngineCardState('SF').note));await p.locator('#analysisSFFull').check();}
 const previous=await p.evaluate(allSF=>Object.fromEntries([allSF,'reckless','lc0','berserk'].map(m=>[m,ChessLabHost.getEngineCardResult(m)?.jobId])),allSF);
 const chosen=await p.locator('#analysisSource').inputValue();await p.locator('#btnAnalyzeAll').click();check('All engines becomes Stop all',/Stop all/.test(await p.locator('#btnAnalyzeAll').innerText()));
 for(const mode of [allSF,'reckless','lc0','berserk']){const r=await settled(p,mode,previous[mode]);await valid(p,r,'All '+mode);check('All '+mode+' keeps the saved budget',r.requestedTimeMs===budget);report.results['all-'+mode]=r;}
 check('All keeps the last manually selected source',await p.locator('#analysisSource').inputValue()===chosen);check('All completes to idle',/All engines/.test(await p.locator('#btnAnalyzeAll').innerText()));
 await p.locator('#analysisSFFull').uncheck();await setBudget(p,10000);await p.locator('#allEvalBadges [data-eval-source="SF"]').click();await p.waitForFunction(()=>/Analyzing/.test(ChessLabHost.getEngineCardState('SF').note));await p.locator('#analysisSFFull').check();
 await p.locator('#allEvalBadges [data-eval-source="SF"]').tap();check('Stockfish card stops the running Lite after a Full preference change',!await p.evaluate(()=>ChessLabHost.getEngineCardState('SF').working));
 await p.locator('#analysisSFFull').uncheck();await p.locator('#btnAnalyzeAll').click();await p.waitForFunction(()=>/Queued/.test(ChessLabHost.getEngineCardState('LC0').note));await p.locator('#allEvalBadges [data-eval-source="LC0"]').tap();
 check('a queued card press cancels that family',!await p.evaluate(()=>ChessLabHost.getEngineCardState('LC0').working));await p.locator('#btnAnalyzeAll').click();check('Stop all clears remaining active and queued engines',!await p.evaluate(()=>['SF','RLE','LC0','BER'].some(role=>ChessLabHost.getEngineCardState(role).working)));
 await setBudget(p,budget);

 if(fixture){
  await p.locator('#allEvalBadges [data-eval-source="DCC"]').tap();check('DCC Link shows its measured provider, without an invented DCC numerical score',await p.locator('#analysisSource').inputValue()==='cdb'&&await p.locator('#positionEval').getAttribute('data-eval-source')==='CDB'&&await p.locator('#allEvalBadges [data-eval-source="DCC"]').getAttribute('aria-current')==='true');
  await p.locator('[data-app-tab="board"]').tap();
  const requests=[];p.on('request',r=>{if(/cdb\.php/.test(r.url()))requests.push(r.url());});const counter=await p.locator('#dccProgress').innerText();
  await p.locator('#allEvalBadges [data-eval-source="CDB"]').tap();await p.waitForFunction(()=>!document.querySelector('#allEvalBadges [data-eval-source="CDB"]').disabled&&ChessLabHost.getContext().analysisSources.DCC?.receipt.status==='complete');
  check('same-candidate CDB refresh reuses measured DCC',requests.every(url=>new URL(url).searchParams.get('action')==='queryall')&&await p.locator('#dccProgress').innerText()===counter);
 }
 await p.locator('#analysisLink').uncheck();const independent=await p.locator('#analysisSource').inputValue();await p.locator('#allEvalBadges [data-eval-source="BER"]').tap();await settled(p,'berserk',report.results['all-berserk'].jobId);check('Link OFF restores independent card clicks',await p.locator('#analysisSource').inputValue()===independent&&!await p.locator('.all-eval-badge.is-linked').count());
 await p.locator('#analysisLink').check();await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>!!window.ChessLabHost);check('saved Link and existing time preference survive reload',await p.locator('#analysisLink').isChecked()&&await p.locator('#settingAnalysisTime').inputValue()===String(budget));check('follow stays OFF after reload',!await p.locator('#analysisAllMoves').isChecked());
 if(fixture)await p.waitForFunction(()=>ChessLabHost.getContext().analysisSources.DCC?.receipt.status==='complete');
 await p.evaluate(()=>ChessLabHost.navigate({startFen:new Chess().fen(),moves:['e2e4']}));check('new position never retains the previous DCC choice',await p.evaluate(()=>{const c=ChessLabHost.getContext(),choice=document.querySelector('#allEvalBadges [data-eval-source="DCC"] .all-eval-move').textContent;return ['…','—'].includes(choice)||(c.analysisSources.DCC?.receipt.fen===c.fen&&new Chess(c.fen).moves().includes(choice));}));
 await setBudget(p,1000);const beforeRace=await p.evaluate(()=>ChessLabHost.getEngineCardResult('sf-lite')?.jobId);
 await p.locator('#allEvalBadges [data-eval-source="SF"]').click();await p.waitForFunction(()=>/Analyzing/.test(ChessLabHost.getEngineCardState('SF').note));
 const raceCard=p.locator('#allEvalBadges [data-eval-source="SF"]');await raceCard.evaluate(n=>n.scrollIntoView({behavior:'instant',block:'center'}));const raceBox=await raceCard.boundingBox(),racePoint={x:raceBox.x+raceBox.width/2,y:raceBox.y+raceBox.height/2};let raceInput;
 if(kind==='chromium'){raceInput=await context.newCDPSession(p);await raceInput.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[racePoint]});}else{await p.mouse.move(racePoint.x,racePoint.y);await p.mouse.down();}
 await settled(p,'sf-lite',beforeRace);const raceResult=await p.evaluate(()=>ChessLabHost.getEngineCardResult('sf-lite').jobId);
 if(kind==='chromium'){await raceInput.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await raceInput.detach();}else await p.mouse.up();await p.waitForTimeout(150);
 check('budget completion during a held Stop does not restart Stockfish',await p.evaluate(id=>!ChessLabHost.getEngineCardState('SF').working&&ChessLabHost.getEngineCardResult('sf-lite').jobId===id,raceResult));
 await setBudget(p,budget);
 await verifyLayouts(p,options,url);
 report.workers=await p.evaluate(()=>__r9Workers);check('no uncaught application errors',report.pageErrors.length===0);report.status='PASS';
}
fs.mkdirSync(out,{recursive:true});run().catch(e=>{report.status='FAIL';report.error=e.stack;process.exitCode=1;}).finally(async()=>{report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,kind+'-r10-result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,browser:kind,checks:report.checks.length,error:report.error}));await browser?.close();if(server)await new Promise(r=>server.close(r));});
