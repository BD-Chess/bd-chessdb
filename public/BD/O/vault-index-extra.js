/* BD/O landing enhancement: top medication-plan link. No health content or password is embedded here. */
(function(){
'use strict';
const ID='bdoTableteTop';
function inject(){
  if(!document.body||document.body.dataset.bdoUnlocked!=='true'||document.getElementById(ID))return;
  const host=document.querySelector('.wrap,main,.content')||document.body;
  const box=document.createElement('div');box.id=ID;
  box.style.cssText='width:min(760px,calc(100% - 18px));margin:12px auto 16px;position:relative;z-index:5';
  const a=document.createElement('a');
  a.href='/BD/O/tablete.html';
  a.textContent='💊 Tablete · dnevni načrt';
  a.style.cssText='display:flex;align-items:center;justify-content:center;min-height:58px;padding:13px 18px;border:1px solid #58d9cf;border-radius:17px;background:linear-gradient(135deg,#12313a,#0b1d2b);color:#eafffc;text-decoration:none;font:900 19px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 12px 34px #0005;letter-spacing:.01em';
  box.appendChild(a);
  if(host===document.body)document.body.prepend(box);else host.insertAdjacentElement('beforebegin',box);
}
const t=setInterval(inject,150);
setTimeout(()=>clearInterval(t),15000);
window.addEventListener('pageshow',()=>{inject();setTimeout(inject,250)});
})();
