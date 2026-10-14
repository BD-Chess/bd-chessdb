'use strict';
// Actual WASM/NNUE engines. Only --hang changes Berserk's go command in the
// explicit watchdog fault-injection case. Linux WebKit is not a physical iPhone.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const playwright=require('playwright');
const option=name=>process.argv.find(x=>x.startsWith('--'+name+'='))?.slice(name.length+3);
const kind=option('browser')||'chromium',budget=Number(option('budget')||500),out=path.resolve(option('evidence')||'.');
let browser,server;
const report={schema:'chessbest.r9.browser-acceptance.v1',startedAt:new Date().toISOString(),browser:kind,physicalIPhone:false,checks:[],results:{},pageErrors:[],assetRequests:[]};
const check=(name,ok)=>{assert(ok,name);report.checks.push(name);console.log('PASS '+name);};
async function localURL(){
 const base=path.resolve(__dirname,'../..'),types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.wasm':'application/wasm','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png'};
 server=http.createServer((req,res)=>{let file=path.join(base,decodeURIComponent(new URL(req.url,'http://local').pathname));if(!file.startsWith(base+path.sep))return res.writeHead(403).end();try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);}catch(_){res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port+'/chess-lab/';
}
async function boot(context,url){
 const p=await context.newPage();
 if(process.argv.includes('--cdb-fixture')){report.cdbBoundary='deterministic legal queryall/score fixture; DCC code and every local engine remain actual';const {Chess}=require('../js/chess.min.js');await p.route(/cdb\.php|\/\.netlify\/functions\/queryall/,route=>{const u=new URL(route.request().url()),fen=u.searchParams.get('board');let body='';try{const g=new Chess(fen);body=u.pathname.includes('queryall')||u.searchParams.get('action')==='queryall'?g.moves({verbose:true}).slice(0,3).map((m,i)=>'move:'+m.from+m.to+(m.promotion||'')+',score:'+String(12-i)+',rank:'+String(i+1)+',note:*').join('|'):'score:0';}catch(_){}return route.fulfill({body,contentType:'text/plain',headers:{'access-control-allow-origin':'*'}});});}
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
async function analyze(p,mode){if(mode.startsWith('sf-'))await p.locator('#analysisSFFull').setChecked(mode==='sf-full');const previous=await p.evaluate(mode=>ChessLabHost.getEngineCardResult(mode)?.jobId,mode);await p.locator('[data-eval-source="'+role(mode)+'"]').click();return settled(p,mode,previous);}
async function valid(p,r,name){check(name+' finishes with a native result',['complete','stopped'].includes(r.status)&&!!r.lines?.length&&!r.error);check(name+' PV is legal',await p.evaluate(r=>r.lines.every(line=>{const g=new Chess(r.fen);return line.pv.every(m=>!!g.move({from:m.slice(0,2),to:m.slice(2,4),promotion:m[4]}));}),r));}
async function layout(p,mobile){
 for(const width of mobile?[320,393,430]:[1024,1440]){await p.setViewportSize({width,height:1000});await p.waitForTimeout(40);const boxes=await p.evaluate(()=>{const rect=id=>document.getElementById(id).getBoundingClientRect().toJSON();return {width:innerWidth,scroll:document.documentElement.scrollWidth,all:rect('btnAnalyzeAll'),refresh:rect('btnAnalysisDeepen'),dcc:rect('btnDesktopDccAnalysis'),sim:rect(document.body.classList.contains('app-mobile')?'appSim':'btnSim'),legendClosed:!document.querySelector('.board-key').open,extra:!!document.querySelector('.app-analysis-status'),statusParent:document.getElementById('dccProgress').closest('[data-eval-source]')?.dataset.evalSource};});
  check((mobile?'mobile ':'desktop ')+width+' has no horizontal overflow',boxes.scroll<=boxes.width);
  check((mobile?'mobile ':'desktop ')+width+' engine controls precede Refresh',boxes.all.y+boxes.all.height<=boxes.refresh.y+1);
  check((mobile?'mobile ':'desktop ')+width+' SIM sits immediately beside DCC',Math.abs(boxes.dcc.y-boxes.sim.y)<2&&boxes.sim.x>=boxes.dcc.x+boxes.dcc.width);
  check((mobile?'mobile ':'desktop ')+width+' useful touch targets',boxes.all.height>=(mobile?44:36)&&boxes.sim.height>=(mobile?44:36));
  check((mobile?'mobile ':'desktop ')+width+' card owns DCC status',boxes.statusParent==='DCC'&&!boxes.extra&&boxes.legendClosed);
 }
 await p.locator('.board-key summary').click();check('legend remains available',await p.locator('.board-key .board-legend').isVisible());await p.locator('.board-key summary').click();
 await p.locator(mobile?'#appSim':'#btnSim').click();check((mobile?'mobile':'desktop')+' SIM opens existing setup',await p.locator('#simTournamentDialog').isVisible());await p.locator('#simTournamentDialog').evaluate(n=>n.close());
}
async function run(){
 const url=option('url')||await localURL();report.url=url;let proxy;if(!/127.0.0.1|localhost/.test(new URL(url).hostname)&&process.env.HTTPS_PROXY){const u=new URL(process.env.HTTPS_PROXY);proxy={server:u.protocol+'//'+u.host};if(u.username)proxy.username=decodeURIComponent(u.username);if(u.password)proxy.password=decodeURIComponent(u.password);}
 const launch={headless:true,proxy};if(kind==='chromium'){const m=require('@sparticuz/chromium'),c=m.default||m;launch.executablePath=await c.executablePath();launch.args=c.args.filter(a=>a!=='--single-process');}
 browser=await playwright[kind].launch(launch);report.version=browser.version();
 const options={serviceWorkers:'block',ignoreHTTPSErrors:!!proxy};const desktop=await browser.newContext({...options,viewport:{width:1440,height:1000}}),p=await boot(desktop,url);
 check('All engines is idle label',/All engines/.test(await p.locator('#btnAnalyzeAll').innerText()));check('follow remains default OFF',!await p.locator('#analysisAllMoves').isChecked());
 await layout(p,false);if(process.argv.includes('--cdb-fixture')){await p.locator('#allEvalBadges [data-eval-source="CDB"]').click();await p.waitForFunction(()=>ChessLabHost.getAdditionalAnalysis().cdb?.allMoves?.length>0&&!document.querySelector('#allEvalBadges [data-eval-source="CDB"]').disabled);check('CDB position data is shown in its card',/Position data/.test(await p.locator('#allEvalBadges [data-eval-source="CDB"] small').innerText()));}await setBudget(p,budget);
 for(const mode of ['sf-lite','sf-full','berserk']){const first=await analyze(p,mode);await valid(p,first,'desktop '+mode);report.results[mode]=first;report.results[mode+'-context']=await p.evaluate(()=>ChessLabHost.getAdditionalAnalysis());
  const workerCount=await p.evaluate(()=>__r9Workers.length),requests=report.assetRequests.length;const repeat=await analyze(p,mode);await valid(p,repeat,'repeat '+mode);
  check(mode+' repeat doubles existing budget',repeat.requestedTimeMs===first.requestedTimeMs*2);
  if(process.argv.includes('--cdb-fixture'))check(mode+' card retains its prepared engine',repeat.workerReused&&repeat.preparedEngineReused);
  if(repeat.workerReused){check(mode+' prepared repeat starts no worker or asset request',await p.evaluate(()=>__r9Workers.length)===workerCount&&report.assetRequests.length===requests);}
  report.results[mode+'-repeat']=repeat;
 }
 const phoneContext=await browser.newContext({...options,viewport:{width:393,height:1000},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'}),phone=await boot(phoneContext,url);
 await layout(phone,true);await phone.setViewportSize({width:393,height:1000});await setBudget(phone,budget);
 for(const mode of ['berserk','reckless','lc0','berserk']){const r=await analyze(phone,mode);await valid(phone,r,'mobile '+mode);report.results['mobile-'+mode]=r;}
 const previous=await phone.evaluate(()=>Object.fromEntries(['sf-lite','reckless','lc0','berserk'].map(m=>[m,ChessLabHost.getEngineCardResult(m)?.jobId])));
 await phone.locator('#analysisSFFull').uncheck();await phone.locator('#btnAnalyzeAll').click();check('running All label becomes Stop all',/Stop all/.test(await phone.locator('#btnAnalyzeAll').innerText()));
 for(const mode of ['sf-lite','reckless','lc0','berserk']){const r=await settled(phone,mode,previous[mode]);await valid(phone,r,'mobile All '+mode);check('All '+mode+' uses saved base time',r.requestedTimeMs===budget);report.results['all-'+mode]=r;}
 check('All settles to idle',/All engines/.test(await phone.locator('#btnAnalyzeAll').innerText()));
 await setBudget(phone,3000);await phone.locator('[data-eval-source="BER"]').click();await phone.waitForFunction(()=>/Analyzing/.test(ChessLabHost.getEngineCardState('BER').note));await phone.locator('[data-eval-source="BER"]').click();
 check('Berserk Stop settles immediately',!await phone.evaluate(()=>ChessLabHost.getEngineCardState('BER').working));
 await setBudget(phone,budget);const restart=await analyze(phone,'berserk');await valid(phone,restart,'Berserk after Stop');
 await setBudget(phone,3000);await phone.locator('[data-eval-source="BER"]').click();await phone.waitForFunction(()=>/Analyzing/.test(ChessLabHost.getEngineCardState('BER').note));
 await phone.evaluate(()=>ChessLabHost.navigate({startFen:new Chess().fen(),moves:['e2e4']}));check('position change cancels old Berserk',!await phone.evaluate(()=>ChessLabHost.getEngineCardState('BER').working));
 await setBudget(phone,budget);const changed=await analyze(phone,'berserk');await valid(phone,changed,'Berserk on new position');check('new result is pinned to new FEN',changed.fen===await phone.evaluate(()=>ChessLabHost.getContext().fen));
 await phone.evaluate(()=>window.__r9HangBerserk=true);const fault=await analyze(phone,'berserk');check('injected native infinite search is killed by watchdog',fault.stopped&&fault.forcedStop&&fault.stopReason==='time-watchdog');check('watchdog retains legal result',!!fault.lines?.length);report.results.watchdogFault=fault;
 check('watchdog terminated native Berserk worker',await phone.evaluate(()=>__r9Workers.some(w=>w.injected==='go infinite'&&w.terminated)));
 await phone.evaluate(()=>window.__r9HangBerserk=false);const recovered=await analyze(phone,'berserk');await valid(phone,recovered,'Berserk after watchdog');
 await phone.locator('#btnAnalyzeAll').click();await phone.waitForFunction(()=>ChessLabHost.getEngineCardState('SF').working);await phone.locator('#btnAnalyzeAll').click();
 check('Stop all clears active and queued cards',!await phone.evaluate(()=>['SF','RLE','LC0','BER'].some(r=>ChessLabHost.getEngineCardState(r).working)));
 await phone.locator('#analysisAllMoves').check();await phone.evaluate(()=>{const startFen=new Chess().fen();ChessLabHost.navigate({startFen,moves:['d2d4']});ChessLabHost.navigate({startFen,moves:['g1f3']});});
 try{await phone.waitForFunction(()=>['sf-lite','reckless','lc0','berserk'].every(m=>{const r=ChessLabHost.getEngineCardResult(m);return ['complete','stopped'].includes(r?.status)&&r.lines?.length&&!ChessLabHost.getEngineCardState({ 'sf-lite':'SF',reckless:'RLE',lc0:'LC0',berserk:'BER'}[m]).working&&r.fen===ChessLabHost.getContext().fen;}),null,{timeout:120000});}catch(e){report.followDiagnostic=await phone.evaluate(()=>({context:ChessLabHost.getContext(),states:Object.fromEntries(['SF','RLE','LC0','BER'].map(r=>[r,ChessLabHost.getEngineCardState(r)])),results:Object.fromEntries(['sf-lite','reckless','lc0','berserk'].map(m=>[m,ChessLabHost.getEngineCardResult(m)])),workers:__r9Workers}));throw e;}
 check('manual follow option A analyzes the latest position',true);await phone.locator('#analysisAllMoves').uncheck();
 report.mobileWorkers=await phone.evaluate(()=>__r9Workers);report.desktopWorkers=await p.evaluate(()=>__r9Workers);report.statuses=await phone.evaluate(()=>__r9Statuses);
 if(kind==='chromium'){await phone.screenshot({path:path.join(out,kind+'-mobile.png'),fullPage:true});await p.screenshot({path:path.join(out,kind+'-desktop.png'),fullPage:true});}else report.visualEvidence='Layout geometry checked in WebKit; exported screenshots use Chromium.';
 check('no uncaught application errors',report.pageErrors.length===0);report.status='PASS';
}
fs.mkdirSync(out,{recursive:true});run().catch(e=>{report.status='FAIL';report.error=e.stack;process.exitCode=1;}).finally(async()=>{report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,kind+'-r9-result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,browser:kind,checks:report.checks,error:report.error,evidence:out},null,2));await browser?.close();if(server)await new Promise(r=>server.close(r));});
