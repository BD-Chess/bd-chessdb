// 8zTSP as an app: install button, offline readiness and updates for mdlxdcc.org/8zTSP/ (BD × AI Lab, R22b, 15 Nov 2026).
// Site version of 8zTSP-web's pwa.js (package d514cdd3…, sha256 of its pwa.js in demo/pwa/pwa.package.js): the same
// service-worker registration and install logic; texts follow the site's language (html[data-lang], switched live through
// MDLxDCCLocale), and on the lock page, which has no site language yet, English and Slovene stand side by side.
// Classic, idempotent bootstrap: it runs outside BD's lock and again inside the unlocked page (document.write).
// R53 D (BD 18 Nov: the update notice was hard to find, below, only on the second page): a new build waits in the service worker
// as before (a page never mixes two builds), and this script decides:
//  - BD: the engine decides, not the page. When no run is going and no finished result is on the screen (K: so a result being
//    looked at does not vanish), it takes the new build and reloads once by itself, on either page (one automatic reload per
//    build id, kept in sessionStorage, so never a loop);
//  - otherwise a full-width bar at the very top, in a colour of its own, stays in view: »A new version is available. Updating
//    stops the current run.« with one large button »Update now«;
//  - it looks for a new build when the page opens and whenever the tab becomes visible again;
//  - the footer line of both pages shows the version (the build's date and time, the build id in small type), the install
//    button and the offline state; the old boxes (above the map panel, at the bottom of the password page) are gone.
(()=>{
 'use strict';
 const BUILT_AT='2026-11-26T01:42';
 const PAGE_BUILD='e3d631368e3c0c551ff8';   // demo/pwa_build.py writes this build's id here: the page knows its own build without asking the worker   // demo/pwa_build.py writes the build's local date and time here (YYYY-MM-DDTHH:MM)
 const state=window.tsp8zPwa??={prompt:null,registration:null,acceptUpdate:false,reloading:false,message:null,build:'',latestBuild:'',userPressed:false};
 const T={
  install:['Install the app','Namesti aplikacijo'],
  ios:['On iPhone and iPad: Share → Add to Home Screen.','Na iPhonu in iPadu: Deli → Dodaj na začetni zaslon.'],
  ready:['Ready for offline use too.','Pripravljeno tudi za uporabo brez povezave.'],
  offline:['Offline · saved version.','Brez povezave · shranjena različica.'],
  notReady:['Offline use is not ready yet.','Uporaba brez povezave še ni pripravljena.'],
  bar:['A new version is available. Updating stops the current run and returns to the password screen.','Na voljo je nova različica. Posodobitev ustavi tekoči tek in vrne na vnos gesla.'],
  barUnlocked:['A new version is available. Updating returns to the password screen.','Na voljo je nova različica. Posodobitev vrne na vnos gesla.'],
  barIdle:['A new version is available.','Na voljo je nova različica.'],
  working:['Updating …','Posodabljam …'],
  now:['Update now','Posodobi zdaj'],
  close:['Close','Zapri'],
  version:['Version','Različica'],
  diagPage:['page','stran'],diagSw:['worker','delavec'],diagWait:['waiting','čaka'],diagServer:['server','strežnik'],diagApp:['app','aplikacija'],yes:['yes','da'],no:['no','ne'],
  diagLast:['last','zadnje'],diag_auto:['auto','samodejno'],diag_press:['press','pritisk'],diag_net:['network','omrežje'],
 };
 const lang=()=>document.documentElement.dataset.lang;
 const text=key=>lang()==='sl'?T[key][1]:lang()==='en'?T[key][0]:T[key][0]+' · '+T[key][1];   // the lock page: both languages
 const stamp=()=>{
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})$/.exec(BUILT_AT);if(!m)return '';
  const [y,mo,d]=[+m[1],+m[2],+m[3]],en=`${d} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][mo-1]} ${y}, ${m[4]}`,sl=`${d}. ${mo}. ${y}, ${m[4]}`;
  return lang()==='sl'?`${T.version[1]} ${sl}`:lang()==='en'?`${T.version[0]} ${en}`:`${T.version[0]} ${en} · ${T.version[1]} ${sl}`;
 };
 const busy=()=>!!window.tsp8zLab?.liveWorkers;   // the engine is running
 const result=()=>!!window.tsp8zLab?.hasResult;   // a finished tour is on the screen
 const unlocked=()=>!document.getElementById('pw');   // inside the decrypted page: never auto-reload back to the password screen
 // Strip the cache-bust parameter left by rescue() so the address bar stays clean (preserves ?lang= and #hash).
 try{const u=new URL(location.href);if(u.searchParams.has('_u')){u.searchParams.delete('_u');history.replaceState(null,'',u.pathname+(u.search?u.search:'')+u.hash);}}catch{}
 // Entering the unlocked document (document.write keeps window.tsp8zPwa): cancel any lock-page timer so nothing pulls back to #pw.
 if(unlocked()){clearTimeout(state.fallback);state.fallback=null;state.acceptUpdate=false;state.working=false;state.userPressed=false;}
 // the bar at the very top (both pages), fixed, above everything; starts display:none so inline flex never overrides [hidden]
 let bar=document.getElementById('tsp8zUpdateBar');
 if(!bar){
  bar=document.createElement('div');bar.id='tsp8zUpdateBar';bar.hidden=true;bar.setAttribute('role','alert');
  bar.style.cssText='position:fixed;top:0;left:0;right:0;z-index:2147483000;box-sizing:border-box;display:none;flex-wrap:wrap;gap:10px 16px;align-items:center;justify-content:center;padding:10px 14px;background:#f59e0b;color:#111;font:600 15px/1.35 system-ui,sans-serif;box-shadow:0 2px 12px rgba(0,0,0,.45)';
  bar.innerHTML='<span id="tsp8zUpdateText"></span><button id="tsp8zUpdateNow" type="button" style="font:700 16px/1 system-ui,sans-serif;padding:12px 20px;border-radius:9px;border:0;background:#111;color:#fff;cursor:pointer"></button><button id="tsp8zUpdateClose" type="button" style="font:700 18px/1 system-ui,sans-serif;padding:8px 12px;border-radius:9px;border:1px solid rgba(0,0,0,.35);background:transparent;color:#111;cursor:pointer">×</button>';
  document.body.prepend(bar);
 }
 // the footer line (both pages): the version, the install button, the offline state (ids kept for the checks)
 let controls=document.getElementById('pwaControls');
 if(!controls){
  controls=document.createElement('div');controls.id='pwaControls';
  controls.style.cssText='box-sizing:border-box;max-width:960px;margin:14px auto 10px;padding:0 14px;font:12.5px/1.5 system-ui,sans-serif;color:inherit;opacity:.85;text-align:center';
  (document.querySelector('footer')||document.body).append(controls);
 }
 controls.innerHTML='<span id="tsp8zVersion"></span> <small id="tsp8zBuild" style="opacity:.7"></small> <button id="pwaInstall" type="button" hidden style="margin-left:8px"></button> <span id="pwaStatus" role="status"></span><small id="tsp8zDiag" style="display:block;opacity:.6;font-size:11px;line-height:1.4;margin-top:3px;overflow-wrap:anywhere"></small>';
 const install=document.getElementById('pwaInstall'),status=document.getElementById('pwaStatus');
 const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
 const standalone=()=>matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;
 function paint(){
  install.textContent=text('install');status.textContent=state.message?text(state.message):'';
  document.getElementById('tsp8zVersion').textContent=stamp();document.getElementById('tsp8zBuild').textContent=state.build?`· ${state.build.slice(0,8)}`:'';
  document.getElementById('tsp8zUpdateText').textContent=text(busy()?'bar':unlocked()?'barUnlocked':'barIdle');
  const now=document.getElementById('tsp8zUpdateNow');now.textContent=text(state.working?'working':'now');now.disabled=!!state.working;
  const cls=document.getElementById('tsp8zUpdateClose');if(cls){cls.setAttribute('aria-label',text('close'));cls.title=text('close');cls.hidden=!!state.working;cls.style.display=state.working?'none':'inline-block';}
  paintDiag();
 }
 function say(key){state.message=key;paint();}
 function showBar(on){bar.hidden=!on;bar.style.display=on?'flex':'none';document.body.style.paddingTop=on?`${bar.offsetHeight}px`:'';}
 function refresh(){install.hidden=standalone() || !(ios || state.prompt);paint();}
 window.onbeforeinstallprompt=event=>{event.preventDefault();state.prompt=event;refresh();};
 window.onappinstalled=()=>{state.prompt=null;refresh();};
 install.onclick=async()=>{
  if(ios){say('ios');refresh();return;}
  if(!state.prompt)return;const prompt=state.prompt;state.prompt=null;refresh();await prompt.prompt();await prompt.userChoice;
 };
 const ask=(worker,type)=>new Promise(done=>{try{const channel=new MessageChannel();channel.port1.onmessage=event=>done(event.data||null);worker.postMessage({type},[channel.port2]);}catch{done(null);}setTimeout(()=>done(null),3000);});
 // R53 diagnostics (K, BD's iPad): the last update step in this tab, its target, tries and time (sessionStorage); no private data
 function rec(){try{return JSON.parse(sessionStorage.getItem('tsp8z-diag')||'null');}catch{return null;}}
 function note(step,ver){const v=((ver||state.waitV||state.latestBuild)||'').slice(0,8)||'?',r=rec(),n=r && r.v===v?r.n+1:1;try{sessionStorage.setItem('tsp8z-diag',JSON.stringify({s:step,v,n,t:new Date().toTimeString().slice(0,8)}));}catch{}paintDiag();}
 function waitNow(){const w=state.registration?.waiting;if(!w){state.diagWait='–';state.waitV='';}paintDiag();}   // diagnostics: a worker that has taken over no longer waits
 function paintDiag(){
  const el=document.getElementById('tsp8zDiag');if(!el)return;
  const sl=lang()==='sl',w=k=>T[k][sl?1:0],r=rec(),parts=[`${w('diagPage')} ${BUILT_AT}`,`${w('diagSw')} ${state.diagCtl||'…'}`,`${w('diagWait')} ${state.diagWait||'–'}`,`${w('diagServer')} ${state.diagServer||'…'}`,`${w('diagApp')} ${standalone()?w('yes'):w('no')}`];
  if(r)parts.push(`${w('diagLast')} ${w('diag_'+r.s)} ×${r.n} → ${r.v} ${r.v==='?'?'?':r.v===state.diagCtl?'✓':'✗'} ${r.t}`);
  el.textContent=parts.join(' · ');
 }
 function take(src,target){
  const w=state.registration?.waiting;
  if(!w)return false;
  if(target && state.waitV && state.waitV!==target)return false;   // stale intermediate waiting worker: let rescue() jump straight to latest
  state.acceptUpdate=true;note(src||'press',target||state.waitV);
  w.postMessage({type:'SKIP_WAITING'});
  clearTimeout(state.fallback);state.fallback=setTimeout(()=>rescue(target),4000);
  return true;
 }
 // R53/Gem1 (BD's iPhone/iPad): if the waiting worker is stuck or stale, clear our caches, drop old /8zTSP/ registrations and
 // reload once with a cache-busting query param so the browser cannot stay trapped on an old build. Never runs automatically
 // on an unlocked page.
 async function rescue(target){
  if(state.reloading)return;
  if(unlocked() && !state.userPressed){clearTimeout(state.fallback);state.fallback=null;return;}
  const latest=target || await serverBuild();   // Gem1/K: our server answered with a build, not just any 200 (a captive portal)
  if(!latest || state.reloading){state.working=false;state.userPressed=false;paint();return;}
  if(latest===PAGE_BUILD){state.working=false;state.userPressed=false;showBar(false);paint();return;}
  state.reloading=true;state.working=true;paint();
  note('net',latest);
  try{sessionStorage.setItem('tsp8z-rescue-v',latest);sessionStorage.removeItem('tsp8z-rescue');}catch{}
  try{if('caches' in window){for(const k of await caches.keys())if(k.startsWith('8ztsp-pwa-'))await caches.delete(k);}}catch{}
  try{const regs=await navigator.serviceWorker?.getRegistrations?.()||[];for(const r of regs)if(r.scope.endsWith('/8zTSP/'))await r.unregister();}catch{}
  try{await state.registration?.unregister();}catch{}
  const u=new URL(location.href);u.searchParams.set('_u',latest.slice(0,8));location.replace(u.href);
 }
 // K (19 Nov, BD's iPad): which build is newest, asked of the server; a query string passes the worker (sw.js caches no query)
 async function serverBuild(){try{const r=await fetch('/8zTSP/precache-manifest.json?newest='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout?.(4000)});return r.ok?((await r.json())?.version||''):'';}catch{return '';}}
 // Gem1/K: look for a new build only when the server has one: its build first, at most once a minute, then update()
 async function check(){
  if(Date.now()-(state.lastCheck||0)<60000)return;
  state.lastCheck=Date.now();
  const latest=await serverBuild();
  state.latestBuild=latest;state.diagServer=latest.slice(0,8)||'?';paintDiag();
  if(!latest)return;
  if(latest===PAGE_BUILD){showBar(false);try{sessionStorage.removeItem('tsp8z-rescue');sessionStorage.removeItem('tsp8z-rescue-v');}catch{}return;}
  try{await state.registration?.update();}catch{}
  if(state.registration?.waiting || !state.registration?.installing)offer(latest);else if(!unlocked() && !busy() && !result())setTimeout(()=>{if(!state.registration?.waiting && !unlocked() && !busy() && !result())offer(latest);},2500);
 }
 async function offer(knownLatest){   // a new build waits in the service worker (or is live on the server)
  if(state.reloading)return;
  const w=state.registration?.waiting;
  const cur=PAGE_BUILD,latest=knownLatest || await serverBuild();   // Gem1/K: the page's own build, not the worker's answer (which may not come)
  const v=w?((await ask(w,'STATUS'))?.version||''):'';
  state.latestBuild=latest;state.diagServer=latest.slice(0,8)||'?';state.waitV=v;state.diagWait=w?(v.slice(0,8)||'?'):'–';paintDiag();
  if(!latest)return;   // K: offline, or the server does not answer: nothing to offer
  if(cur && latest===cur){showBar(false);if(w){try{w.postMessage({type:'SKIP_WAITING'});}catch{}setTimeout(waitNow,1500);}return;}   // K: the newest build already runs; quietly, no bar, no reload
  if(w && v && v!==latest){state.registration?.update().catch(()=>{});}   // stale waiting worker (two builds in a row): fetch latest
  let done='',rescued='',dismissed='';
  try{done=sessionStorage.getItem('tsp8z-auto-update')||'';rescued=sessionStorage.getItem('tsp8z-rescue-v')||'';dismissed=sessionStorage.getItem('tsp8z-dismiss')||'';}catch{}
  state.again=done===latest;
  if(!unlocked() && !busy() && !result()){   // auto-update ONLY on the lock page: never pull an unlocked user back to #pw
   if(done!==latest && w && (!v || v===latest)){try{sessionStorage.setItem('tsp8z-auto-update',latest);}catch{}take('auto',latest);return;}
   if(rescued!==latest){rescue(latest);return;}
  }
  if(unlocked() && dismissed===latest){showBar(false);return;}
  paint();showBar(true);   // unlocked page (or lock-page fallback after rescue): offer at the top
 }
 document.getElementById('tsp8zUpdateNow').onclick=async()=>{
  if(window.tsp8zLab?.liveWorkers)window.tsp8zLab.stop();
  state.userPressed=true;state.working=true;paint();
  const latest=(await serverBuild()) || state.latestBuild;
  if(!latest){state.working=false;state.userPressed=false;paint();return;}
  if(latest===PAGE_BUILD){state.working=false;state.userPressed=false;showBar(false);paint();return;}
  if(state.again || !take('press',latest))rescue(latest);   // nothing to take, stale worker, or taken before in vain: the network way
 };
 document.getElementById('tsp8zUpdateClose').onclick=()=>{
  const target=state.latestBuild || state.waitV || '';
  if(target){try{sessionStorage.setItem('tsp8z-dismiss',target);}catch{}}
  showBar(false);
 };
 window.MDLxDCCLocale?.subscribe?.(()=>paint());
 if('serviceWorker' in navigator && location.pathname.startsWith('/8zTSP/')){
  if(state.controllerHandler)navigator.serviceWorker.removeEventListener('controllerchange',state.controllerHandler);
  // the build id comes from the worker that controls the page; on a first visit that worker takes over only after the page loaded
  const stampBuild=async()=>{const c=navigator.serviceWorker.controller;if(c){state.build=(await ask(c,'STATUS'))?.version||'';}state.diagCtl=c?(state.build.slice(0,8)||'?'):'–';paint();};
  state.uncontrolledAtLoad=!navigator.serviceWorker.controller;
  state.controllerHandler=()=>{
   if(state.acceptUpdate && !state.reloading){clearTimeout(state.fallback);state.reloading=true;location.reload();return;}
   // Never force a second reload on clients.claim(): the page already loaded from network on the latest build, and reloading
   // here pulled unlocked users back to the password screen.
   try{sessionStorage.removeItem('tsp8z-rescue');}catch{}
   stampBuild();waitNow();
   if(!state.registration?.waiting || (state.latestBuild && state.latestBuild===PAGE_BUILD))showBar(false);
  };
  navigator.serviceWorker.addEventListener('controllerchange',state.controllerHandler);
  navigator.serviceWorker.register('/8zTSP/sw.js',{scope:'/8zTSP/',updateViaCache:'none'}).then(async registration=>{
   state.registration=registration;
   if(state.updateHandler)registration.removeEventListener('updatefound',state.updateHandler);
   state.updateHandler=()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed' && registration.waiting)offer();});};
   registration.addEventListener('updatefound',state.updateHandler);
   if(registration.waiting)offer();
   refresh();
   await navigator.serviceWorker.ready;
   say(navigator.onLine?'ready':'offline');
   await stampBuild();
   {const w=registration.waiting;if(w && !state.waitV){state.diagWait=(((await ask(w,'STATUS'))?.version)||'').slice(0,8)||'?';paintDiag();}}   // diagnostics: a worker that already waits
   // D5: look for a new build when the page opens and whenever the tab becomes visible again
   check();
   if(state.visibilityHandler)document.removeEventListener('visibilitychange',state.visibilityHandler);   // the unlocked page is a new document: listen again
   state.visibilityHandler=()=>{if(document.visibilityState==='visible')check();};document.addEventListener('visibilitychange',state.visibilityHandler);
  }).catch(()=>{say('notReady');refresh();});
 }
 refresh();
})();
