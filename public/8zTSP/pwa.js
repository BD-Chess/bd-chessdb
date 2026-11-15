// 8zTSP as an app: install button, offline readiness and updates for mdlxdcc.org/8zTSP/ (BD × AI Lab, R22b, 15 Nov 2026).
// Site version of 8zTSP-web's pwa.js (package d514cdd3…, sha256 of its pwa.js in demo/pwa/pwa.package.js): the same
// service-worker registration, update and install logic; texts follow the site's language (html[data-lang], switched live
// through MDLxDCCLocale), and on the lock page, which has no site language yet, English and Slovene stand side by side.
// The box sits in the page flow (#pwaControls if the page has one, otherwise a static block at the end), never over the page.
// Classic, idempotent bootstrap: it runs outside BD's lock and again inside the unlocked page (document.write).
(()=>{
 'use strict';
 const state=window.tsp8zPwa??={prompt:null,registration:null,acceptUpdate:false,reloading:false,message:null};
 const T={
  install:['Install the app','Namesti aplikacijo'],
  update:['Update and reload','Posodobi in ponovno naloži'],
  ios:['On iPhone and iPad: Share → Add to Home Screen.','Na iPhonu in iPadu: Deli → Dodaj na začetni zaslon.'],
  waiting:['A new version is ready. Reloading stops the current run.','Nova različica je pripravljena. Ponovno nalaganje ustavi trenutni tek.'],
  ready:['Ready for offline use too.','Pripravljeno tudi za uporabo brez povezave.'],
  offline:['Offline · saved version.','Brez povezave · shranjena različica.'],
  notReady:['Offline use is not ready yet.','Uporaba brez povezave še ni pripravljena.'],
 };
 const text=key=>{
  const lang=document.documentElement.dataset.lang;
  if(lang==='sl')return T[key][1];
  if(lang==='en')return T[key][0];
  return T[key][0]+' · '+T[key][1];                                   // the lock page: both languages
 };
 let controls=document.getElementById('pwaControls');
 if(!controls){
  controls=document.createElement('div');controls.id='pwaControls';
  controls.style.cssText='box-sizing:border-box;max-width:760px;margin:18px auto;padding:10px 14px;border:1px solid rgba(148,163,184,.35);border-radius:10px;font:14px/1.45 system-ui,sans-serif;color:inherit';
  document.body.append(controls);
 }
 controls.innerHTML='<button id="pwaInstall" type="button" hidden></button> <button id="pwaUpdate" type="button" hidden></button><p id="pwaStatus" role="status" style="margin:6px 0 0"></p>';
 const install=document.getElementById('pwaInstall'),update=document.getElementById('pwaUpdate'),status=document.getElementById('pwaStatus');
 const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
 const standalone=()=>matchMedia('(display-mode: standalone)').matches || navigator.standalone===true;
 function paint(){
  install.textContent=text('install');update.textContent=text('update');
  status.textContent=state.message?text(state.message):'';
 }
 function say(key){state.message=key;paint();}
 function refresh(){install.hidden=standalone() || !(ios || state.prompt);update.hidden=!state.registration?.waiting;controls.hidden=install.hidden && update.hidden && !state.message;paint();}
 window.onbeforeinstallprompt=event=>{event.preventDefault();state.prompt=event;refresh();};
 window.onappinstalled=()=>{state.prompt=null;refresh();};
 install.onclick=async()=>{
  if(ios){say('ios');refresh();return;}
  if(!state.prompt)return;const prompt=state.prompt;state.prompt=null;refresh();await prompt.prompt();await prompt.userChoice;
 };
 update.onclick=()=>{
  if(!state.registration?.waiting)return;
  if(window.tsp8zLab?.liveWorkers)window.tsp8zLab.stop();
  state.acceptUpdate=true;state.registration.waiting.postMessage({type:'SKIP_WAITING'});
 };
 window.MDLxDCCLocale?.subscribe?.(()=>paint());
 if('serviceWorker' in navigator && location.pathname.startsWith('/8zTSP/')){
  if(state.controllerHandler)navigator.serviceWorker.removeEventListener('controllerchange',state.controllerHandler);
  state.controllerHandler=()=>{if(state.acceptUpdate && !state.reloading){state.reloading=true;location.reload();}};
  navigator.serviceWorker.addEventListener('controllerchange',state.controllerHandler);
  navigator.serviceWorker.register('/8zTSP/sw.js',{scope:'/8zTSP/',updateViaCache:'none'}).then(async registration=>{
   state.registration=registration;
   if(state.updateHandler)registration.removeEventListener('updatefound',state.updateHandler);
   state.updateHandler=()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'){if(registration.waiting)say('waiting');refresh();}});};
   registration.addEventListener('updatefound',state.updateHandler);
   refresh();
   await navigator.serviceWorker.ready;
   if(!registration.waiting)say(navigator.onLine?'ready':'offline');
   refresh();
  }).catch(()=>{say('notReady');refresh();});
 }
 refresh();
})();
