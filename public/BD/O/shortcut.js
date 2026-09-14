/* Prominent private shortcut on the decrypted /BD/O/ landing page. */
(function(){
'use strict';
function isLanding(){
  const p=location.pathname.replace(/\/+$/,'');
  return p==='/BD/O'||p==='/BD/O/index.html';
}
function install(){
  if(!isLanding()||!document.body||document.getElementById('bdoMedicationShortcut'))return false;
  if(document.body.dataset.bdoUnlocked!=='true')return false;
  const card=document.createElement('a');
  card.id='bdoMedicationShortcut';
  card.href='/BD/O/tablete.html';
  card.setAttribute('aria-label','Odpri dnevni načrt tablet');
  card.innerHTML='<span class="bdo-med-icon">💊</span><span class="bdo-med-copy"><strong>Tablete · dnevni načrt</strong><small>Danes / jutri · ura vstajanja · checkboxi · opomniki</small></span><span class="bdo-med-arrow">→</span>';
  card.style.cssText='display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;text-decoration:none;color:#f3f8ff;border:1px solid rgba(103,224,215,.55);border-radius:20px;background:linear-gradient(135deg,rgba(103,224,215,.15),rgba(121,192,255,.08)),#0d1727;padding:16px 18px;margin:0 0 16px;box-shadow:0 14px 36px rgba(0,0,0,.28);min-width:0';
  const strong=card.querySelector('strong');strong.style.cssText='display:block;font:900 1.15em/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;color:#fff';
  const small=card.querySelector('small');small.style.cssText='display:block;margin-top:4px;font:700 .78em/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;color:#b8c7d8';
  card.querySelector('.bdo-med-icon').style.cssText='font-size:1.65em;line-height:1';
  card.querySelector('.bdo-med-arrow').style.cssText='font-size:1.5em;color:#67e0d7;font-weight:900';
  const hero=document.querySelector('.hero');
  const main=document.querySelector('main,.wrap,.container');
  if(hero&&hero.parentNode)hero.insertAdjacentElement('afterend',card);
  else if(main)main.prepend(card);
  else document.body.prepend(card);
  return true;
}
let tries=0;
const timer=setInterval(()=>{tries++;if(install()||tries>120)clearInterval(timer)},100);
window.addEventListener('pageshow',()=>setTimeout(install,0));
})();
