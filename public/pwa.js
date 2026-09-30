(()=>{'use strict';
let deferred=null,registration=null;
const button=()=>document.getElementById('pwa-install');
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function sync(){const b=button();if(!b)return;b.hidden=standalone();}
function words(){
 const sl=document.documentElement.dataset.lang==='sl';
 return sl?{title:'Namesti MDL×DCC',ios:'V Safariju tapni Deli → Dodaj na začetni zaslon → Dodaj.'}:{title:'Install MDL×DCC',ios:'In Safari tap Share → Add to Home Screen → Add.'};
}
async function install(){
 if(standalone())return;
 if(deferred){deferred.prompt();try{await deferred.userChoice;}catch(_){}deferred=null;sync();return;}
 const w=words();
 if(/iphone|ipad|ipod/i.test(navigator.userAgent||''))alert(w.title+'\n\n'+w.ios);
 else alert(w.title+'\n\nUse your browser menu and choose Install app or Add to Home Screen.');
}
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;sync();});
addEventListener('appinstalled',()=>{deferred=null;sync();});
document.addEventListener('DOMContentLoaded',()=>{const b=button();if(b)b.addEventListener('click',install);sync();});
if('serviceWorker'in navigator&&isSecureContext){
 addEventListener('load',async()=>{try{
  registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
  registration.update().catch(()=>{});
  addEventListener('online',()=>registration&&registration.update().catch(()=>{}));
  addEventListener('focus',()=>registration&&registration.update().catch(()=>{}));
 }catch(_){}},{once:true});
}
})();