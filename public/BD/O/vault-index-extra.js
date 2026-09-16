/* BD/O landing enhancement: robust top medication-plan link after vault render. */
(function(){
'use strict';
const ID='bdoTableteTop';
function inject(){
  if(!document.body||document.getElementById(ID))return;
  if(document.body.dataset.bdoUnlocked!=='true')return;
  const path=location.pathname.replace(/\/+$/,'');
  if(!/\/BD\/O(?:\/index\.html)?$/i.test(path))return;
  const box=document.createElement('div');box.id=ID;
  box.style.cssText='width:min(760px,calc(100% - 18px));margin:12px auto 16px;position:relative;z-index:50';
  const a=document.createElement('a');
  a.href=new URL('tablete.html',location.href).href;
  a.textContent='💊 Tablete · dnevni načrt';
  a.style.cssText='display:flex;align-items:center;justify-content:center;min-height:62px;padding:14px 18px;border:2px solid #58d9cf;border-radius:17px;background:linear-gradient(135deg,#12313a,#0b1d2b);color:#eafffc;text-decoration:none;font:900 20px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 12px 34px #0005;letter-spacing:.01em';
  box.appendChild(a);
  const wrap=document.querySelector('.wrap');
  if(wrap)wrap.prepend(box);
  else {
    const main=document.querySelector('main,.content');
    if(main)main.prepend(box); else document.body.prepend(box);
  }
}

/* vault.js replaces the whole document after successful decryption. Hook its
   exported afterRender callback so the link is injected into the decrypted
   landing itself, not into the temporary login document. */
let currentBDO;
try{
  Object.defineProperty(window,'BDO',{
    configurable:true,
    get(){return currentBDO;},
    set(v){
      currentBDO=v;
      if(v&&typeof v.afterRender==='function'&&!v.__tableteHooked){
        const original=v.afterRender;
        v.afterRender=function(){
          const result=original.apply(this,arguments);
          queueMicrotask(inject);
          setTimeout(inject,50);
          return result;
        };
        v.__tableteHooked=true;
      }
    }
  });
}catch(_){/* fallback below */}

/* Fallback for an already-unlocked page or browsers that reject the hook. */
const t=setInterval(inject,200);
setTimeout(()=>clearInterval(t),20000);
window.addEventListener('pageshow',()=>{inject();setTimeout(inject,100)});
})();
