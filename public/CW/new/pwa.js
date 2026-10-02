(()=>{
'use strict';
if(!('serviceWorker' in navigator)) return;
let deferredInstall=null, updateRequested=false;
const installBtn=document.getElementById('pwaInstallBtn');
const updateBtn=document.getElementById('pwaUpdateBtn');
function show(el,on){if(el)el.style.display=on?'inline-block':'none'}
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;show(installBtn,true)});
installBtn?.addEventListener('click',async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;show(installBtn,false)});
function exposeWaiting(reg){show(updateBtn,!!reg.waiting)}
async function register(){
 const reg=await navigator.serviceWorker.register('./sw.js',{scope:'./'}); exposeWaiting(reg);
 reg.addEventListener('updatefound',()=>{const w=reg.installing;if(w)w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)exposeWaiting(reg)})});
 addEventListener('focus',()=>reg.update().catch(()=>{})); addEventListener('online',()=>reg.update().catch(()=>{}));
 updateBtn?.addEventListener('click',()=>{if(!reg.waiting)return;const ok=window.CW_LAB?.persistLabState?.();if(ok===false)return;updateRequested=true;reg.waiting.postMessage({type:'SKIP_WAITING'})});
}
navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updateRequested)location.reload()});
register().catch(e=>console.warn('Crosswords LAB PWA registration failed',e));
})();
