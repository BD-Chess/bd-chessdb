(()=>{'use strict';
// One installable app: the site's primary index.html, never a /PWA/ clone.
const RELEASE='root-20261009-r4';
const ROOT=new URL('./',document.currentScript?.src||document.baseURI);
const SW=new URL('sw.js',ROOT);
const RELOAD_KEY='mdlxdcc-root-pwa-reload-v2';
const UPDATE_GAP_MS=15000;
let registration=null,deferredPrompt=null,lastUpdate=0,reloading=false,pendingReload=false;
let hadController=!!navigator.serviceWorker?.controller;
let started=false;
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function button(){return document.getElementById('pwa-install')}
function sync(){const b=button();if(b)b.hidden=standalone()}
function labels(){return document.documentElement.dataset.lang==='sl'?
 {title:'Namesti MDL×DCC',ios:'V Safariju tapni Deli → Dodaj na začetni zaslon → Dodaj.'}:
 {title:'Install MDL×DCC',ios:'In Safari tap Share → Add to Home Screen → Add.'}}
async function install(){
 if(standalone())return;
 if(deferredPrompt){deferredPrompt.prompt();try{await deferredPrompt.userChoice}catch(_){}deferredPrompt=null;sync();return}
 const t=labels();
 alert(t.title+'\n\n'+(/iphone|ipad|ipod/i.test(navigator.userAgent||'')?
   t.ios:'Use your browser menu to install the app or add it to the Home Screen.'));
}
function reloadOnce(target){
 if(reloading)return;
 const token=String(target||RELEASE);
 try{
  // Prevent repeated reloads if the server/CDN briefly alternates versions.
  if(sessionStorage.getItem(RELOAD_KEY)===token)return;
  sessionStorage.setItem(RELOAD_KEY,token);
 }catch(_){}
 if(document.visibilityState==='hidden'){pendingReload=true;return}
 reloading=true;location.reload();
}
async function checkServerDocument(){
 if(navigator.onLine===false)return;
 try{
  // This is a public same-origin asset, not a private/API request.
  const response=await fetch(new URL('index.html',ROOT),{
   credentials:'same-origin',cache:'no-store'
  });
  if(!response.ok)return;
  const body=await response.text();
  const marker=body.match(/<meta\s+name=["']mdlxdcc-pwa-release["']\s+content=["']([^"']+)/i);
  if(marker&&marker[1]!==RELEASE)reloadOnce(marker[1]);
 }catch(_){/* Offline fallback is managed by the service worker. */}
}
async function update(){
 if(!registration||navigator.onLine===false||document.visibilityState==='hidden')return;
 const now=Date.now();
 if(now-lastUpdate<UPDATE_GAP_MS)return;
 lastUpdate=now;
 try{await registration.update()}catch(_){}
 await checkServerDocument();
}
function setUpdateHooks(){
 if(!('serviceWorker'in navigator))return;
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(!hadController){hadController=true;return}
  reloadOnce(RELEASE+'-controller');
 });
 navigator.serviceWorker.addEventListener('message',e=>{
  if(e.data?.type==='MDLX_ROOT_PWA_VERSION'&&
     typeof e.data.version==='string'&&e.data.version!==RELEASE)
   reloadOnce(e.data.version);
 });
 window.addEventListener('focus',update);
 window.addEventListener('online',update);
 window.addEventListener('pageshow',update);
 document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='visible')return;
  if(pendingReload){pendingReload=false;reloadOnce(RELEASE+'-resumed');return}
  update();
 });
}
async function start(){
 if(started)return;started=true;
 if(!('serviceWorker'in navigator)||!isSecureContext)return;
 setUpdateHooks();
 try{
  registration=await navigator.serviceWorker.register(SW.href,{
   scope:ROOT.pathname,updateViaCache:'none'
  });
  if(registration.waiting)registration.waiting.postMessage({type:'MDLX_ROOT_PWA_ACTIVATE'});
  if(navigator.serviceWorker.controller)
   navigator.serviceWorker.controller.postMessage({type:'MDLX_ROOT_PWA_VERSION'});
  update();
 }catch(_){}
}
window.addEventListener('beforeinstallprompt',event=>{
 if(!button())return;
 event.preventDefault();deferredPrompt=event;sync();
});
window.addEventListener('appinstalled',()=>{deferredPrompt=null;sync()});
if(document.readyState==='loading')
 document.addEventListener('DOMContentLoaded',()=>{const b=button();if(b)b.addEventListener('click',install);sync()},{once:true});
else {const b=button();if(b)b.addEventListener('click',install);sync()}
if(document.readyState==='complete')start();
else window.addEventListener('load',start,{once:true});
})();
