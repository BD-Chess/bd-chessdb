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
 const BUILT_AT='2026-11-18T23:00';   // demo/pwa_build.py writes the build's local date and time here (YYYY-MM-DDTHH:MM)
 const state=window.tsp8zPwa??={prompt:null,registration:null,acceptUpdate:false,reloading:false,message:null,build:''};
 const T={
  install:['Install the app','Namesti aplikacijo'],
  ios:['On iPhone and iPad: Share → Add to Home Screen.','Na iPhonu in iPadu: Deli → Dodaj na začetni zaslon.'],
  ready:['Ready for offline use too.','Pripravljeno tudi za uporabo brez povezave.'],
  offline:['Offline · saved version.','Brez povezave · shranjena različica.'],
  notReady:['Offline use is not ready yet.','Uporaba brez povezave še ni pripravljena.'],
  bar:['A new version is available. Updating stops the current run.','Na voljo je nova različica. Posodobitev ustavi tekoči tek.'],
  now:['Update now','Posodobi zdaj'],
  version:['Version','Različica'],
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
 // the bar at the very top (both pages), fixed, above everything
 let bar=document.getElementById('tsp8zUpdateBar');
 if(!bar){
  bar=document.createElement('div');bar.id='tsp8zUpdateBar';bar.hidden=true;bar.setAttribute('role','alert');
  bar.style.cssText='position:fixed;top:0;left:0;right:0;z-index:2147483000;box-sizing:border-box;display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;justify-content:center;padding:10px 14px;background:#f59e0b;color:#111;font:600 15px/1.35 system-ui,sans-serif;box-shadow:0 2px 12px rgba(0,0,0,.45)';
  bar.innerHTML='<span id="tsp8zUpdateText"></span><button id="tsp8zUpdateNow" type="button" style="font:700 16px/1 system-ui,sans-serif;padding:12px 20px;border-radius:9px;border:0;background:#111;color:#fff;cursor:pointer"></button>';
  document.body.prepend(bar);
 }
 // the footer line (both pages): the version, the install button, the offline state (ids kept for the checks)
 let controls=document.getElementById('pwaControls');
 if(!controls){
  controls=document.createElement('div');controls.id='pwaControls';
  controls.style.cssText='box-sizing:border-box;max-width:960px;margin:14px auto 10px;padding:0 14px;font:12.5px/1.5 system-ui,sans-serif;color:inherit;opacity:.85;text-align:center';
  (document.querySelector('footer')||document.body).append(controls);
 }
 controls.innerHTML='<span id="tsp8zVersion"></span> <small id="tsp8zBuild" style="opacity:.7"></small> <button id="pwaInstall" type="button" hidden style="margin-left:8px"></button> <span id="pwaStatus" role="status"></span>';
 const install=document.getElementById('pwaInstall'),status=document.getElementById('pwaStatus');
 const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
 const standalone=()=>matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;
 function paint(){
  install.textContent=text('install');status.textContent=state.message?text(state.message):'';
  document.getElementById('tsp8zVersion').textContent=stamp();document.getElementById('tsp8zBuild').textContent=state.build?`· ${state.build.slice(0,8)}`:'';
  document.getElementById('tsp8zUpdateText').textContent=text('bar');document.getElementById('tsp8zUpdateNow').textContent=text('now');
 }
 function say(key){state.message=key;paint();}
 function showBar(on){bar.hidden=!on;document.body.style.paddingTop=on?`${bar.offsetHeight}px`:'';}
 function refresh(){install.hidden=standalone() || !(ios || state.prompt);paint();}
 window.onbeforeinstallprompt=event=>{event.preventDefault();state.prompt=event;refresh();};
 window.onappinstalled=()=>{state.prompt=null;refresh();};
 install.onclick=async()=>{
  if(ios){say('ios');refresh();return;}
  if(!state.prompt)return;const prompt=state.prompt;state.prompt=null;refresh();await prompt.prompt();await prompt.userChoice;
 };
 const ask=(worker,type)=>new Promise(done=>{try{const channel=new MessageChannel();channel.port1.onmessage=event=>done(event.data||null);worker.postMessage({type},[channel.port2]);}catch{done(null);}setTimeout(()=>done(null),3000);});
 function take(){const w=state.registration?.waiting;if(!w)return false;state.acceptUpdate=true;w.postMessage({type:'SKIP_WAITING'});return true;}
 async function offer(){   // a new build waits in the service worker
  const w=state.registration?.waiting;if(!w || state.reloading)return;
  if(!busy() && !result()){   // BD: the engine is not running: take it and reload once by itself (one automatic reload per build)
   const v=(await ask(w,'STATUS'))?.version||'';let done='';
   try{done=sessionStorage.getItem('tsp8z-auto-update')||'';}catch{}
   if(v && done!==v){try{sessionStorage.setItem('tsp8z-auto-update',v);}catch{}take();return;}
  }
  paint();showBar(true);   // a run or a result: ask at the top
 }
 document.getElementById('tsp8zUpdateNow').onclick=()=>{
  if(window.tsp8zLab?.liveWorkers)window.tsp8zLab.stop();
  if(!take()){state.reloading=true;location.reload();}
 };
 window.MDLxDCCLocale?.subscribe?.(()=>paint());
 if('serviceWorker' in navigator && location.pathname.startsWith('/8zTSP/')){
  if(state.controllerHandler)navigator.serviceWorker.removeEventListener('controllerchange',state.controllerHandler);
  // the build id comes from the worker that controls the page; on a first visit that worker takes over only after the page loaded
  const stampBuild=async()=>{const c=navigator.serviceWorker.controller;if(c){state.build=(await ask(c,'STATUS'))?.version||'';paint();}};
  state.controllerHandler=()=>{if(state.acceptUpdate && !state.reloading){state.reloading=true;location.reload();}else stampBuild();};
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
   // D5: look for a new build when the page opens and whenever the tab becomes visible again
   registration.update().catch(()=>{});
   if(state.visibilityHandler)document.removeEventListener('visibilitychange',state.visibilityHandler);   // the unlocked page is a new document: listen again
   state.visibilityHandler=()=>{if(document.visibilityState==='visible')state.registration?.update().catch(()=>{});};document.addEventListener('visibilitychange',state.visibilityHandler);
  }).catch(()=>{say('notReady');refresh();});
 }
 refresh();
})();
