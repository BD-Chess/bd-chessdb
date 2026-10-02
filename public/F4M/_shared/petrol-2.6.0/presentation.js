/* Flip4M 2.6 unified presentation router: one LAB source, three presentations. */
(() => {
  'use strict';
  const q=new URLSearchParams(location.search),forced=q.get('view')==='app',ua=navigator.userAgent||'';
  const handheld=navigator.userAgentData?.mobile===true||/iPhone|iPod|Android.+Mobile|Windows Phone/i.test(ua);
  const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const app=forced||handheld||standalone;
  document.body.dataset.presentation=app?'app':'lab';
  document.body.classList.toggle('is-app',app);document.body.classList.toggle('is-lab',!app);
  document.documentElement.classList.toggle('app-phone',app&&(handheld||standalone));
  const labels=()=>{document.querySelectorAll('[data-presentation-link]').forEach(a=>{const active=a.dataset.presentationLink===(app?'app':'lab');active?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current');});document.querySelectorAll('[data-presentation-label]').forEach(el=>el.textContent=app?'APP':'LAB');document.querySelectorAll('[data-presentation-install]').forEach(el=>el.textContent='LAB');const badge=document.querySelector('.channel-badge');if(badge)badge.textContent=app?'APP':'LAB';};
  labels();addEventListener('DOMContentLoaded',()=>{labels();document.querySelectorAll('[data-presentation-link]').forEach(a=>a.addEventListener('click',async e=>{const target=a.dataset.presentationLink;if(target!=='lab'&&target!=='app')return;e.preventDefault();try{await window.F4MLab?.flush?.();}catch(_){}location.href=target==='app'?'./?view=app':'./';}));});
  window.F4MPresentation=Object.freeze({mode:app?'app':'lab',forced,handheld,standalone,isApp:()=>app});
})();
