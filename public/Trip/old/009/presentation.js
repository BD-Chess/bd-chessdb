(() => {
  'use strict';
  const KEY = '8z_trip_lab_desktop_view_v1';
  const query = new URLSearchParams(location.search);
  const requested = query.get('view');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const deviceMobile = Boolean(navigator.userAgentData?.mobile) || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  function readPref(){ try { return localStorage.getItem(KEY); } catch (_) { return null; } }
  function writePref(value){ try { localStorage.setItem(KEY,value); } catch (_) {} }
  if (!deviceMobile && !standalone && requested === 'app') writePref('app');
  if (!deviceMobile && !standalone && requested === 'lab') writePref('lab');
  function mode(){
    if (deviceMobile || standalone) return 'mobile';
    if (readPref() === 'app') return 'app';
    if (matchMedia('(max-width: 900px)').matches) return 'mobile';
    return 'lab';
  }
  function apply(){
    const value=mode();
    document.documentElement.dataset.tripPresentation=value;
    if(document.body){
      document.body.classList.toggle('trip-presentation-app',value==='app');
      document.body.classList.toggle('trip-presentation-mobile',value==='mobile');
      document.body.classList.toggle('trip-presentation-lab',value==='lab');
      const lab=document.querySelector('[data-presentation-link="lab"]');
      const app=document.querySelector('[data-presentation-link="app"]');
      lab?.toggleAttribute('aria-current', value!=='app');
      app?.toggleAttribute('aria-current', value==='app');
    }
  }
  apply();
  addEventListener('resize',apply,{passive:true});
  addEventListener('DOMContentLoaded',apply,{once:true});
})();
