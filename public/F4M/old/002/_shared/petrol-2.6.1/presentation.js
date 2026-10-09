/* Flip4M 2.6.1 unified presentation router: desktop LAB by default; APP is phone/native or explicit ?view=app. */
(()=>{'use strict';
  const q=new URLSearchParams(location.search),requested=(q.get('view')||'').toLowerCase(),forced=requested==='app',ua=navigator.userAgent||'';
  const tablet=/iPad|Tablet|PlayBook|Silk/i.test(ua);
  const phone=!tablet&&(navigator.userAgentData?.mobile===true||/iPhone|iPod|Windows Phone|Android.+Mobile/i.test(ua));
  const native=!!globalThis.Capacitor?.isNativePlatform?.();
  const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const app=forced||phone||native;
  document.body.dataset.presentation=app?'app':'lab';
  document.body.classList.toggle('is-app',app);document.body.classList.toggle('is-lab',!app);
  document.documentElement.classList.toggle('app-phone',app&&(phone||native));
  const labels=()=>{document.querySelectorAll('[data-presentation-link]').forEach(a=>{const active=a.dataset.presentationLink===(app?'app':'lab');active?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current');});document.querySelectorAll('[data-presentation-label]').forEach(el=>el.textContent=app?'APP':'LAB');document.querySelectorAll('[data-presentation-install]').forEach(el=>el.textContent='LAB');const badge=document.querySelector('.channel-badge');if(badge)badge.textContent=app?'APP':'LAB';};
  labels();addEventListener('DOMContentLoaded',labels);
  window.F4MPresentation=Object.freeze({mode:app?'app':'lab',forced,phone,native,standalone,isApp:()=>app});
})();
