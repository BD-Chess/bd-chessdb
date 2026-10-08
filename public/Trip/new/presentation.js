(() => {
  'use strict';
  const KEY='8z_trip_lab_desktop_view_v1',WIDTH_KEY='8z_trip_lab_preview_width_v1';
  const choices=['375','390','402','430'],query=new URLSearchParams(location.search),requested=query.get('view');
  const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const deviceMobile=Boolean(navigator.userAgentData?.mobile)||/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)||Boolean(globalThis.Capacitor?.isNativePlatform?.());
  function read(key){try{return localStorage.getItem(key);}catch(_){return null;}}
  function write(key,value){try{localStorage.setItem(key,value);}catch(_){}}
  if(!deviceMobile&&!standalone&&['app','lab'].includes(requested))write(KEY,requested);
  function mode(){if(deviceMobile||standalone)return 'mobile';if(requested==='app'||(requested!=='lab'&&read(KEY)==='app'))return 'app';return matchMedia('(max-width:900px)').matches?'mobile':'lab';}
  let screen;
  function geometry(){if(!screen)return;const r=screen.getBoundingClientRect();for(const edge of ['left','top','right','bottom']){const key='--trip-screen-'+edge,value=r[edge]+'px';if(document.body.style.getPropertyValue(key)!==value)document.body.style.setProperty(key,value);}}
  function makeDevice(){
    if(screen)return;
    const wrapper=document.querySelector('.app-wrapper');if(!wrapper)return;
    const stage=document.createElement('div');stage.className='trip-preview-stage';
    stage.innerHTML='<div class="trip-preview-device"><div class="trip-preview-screen"><div class="trip-preview-island" aria-hidden="true"></div><div class="trip-preview-content"></div><div class="trip-preview-home" aria-hidden="true"></div></div></div>';
    screen=stage.querySelector('.trip-preview-screen');
    stage.querySelector('.trip-preview-content').append(wrapper);
    const chat=document.getElementById('chatPanel');if(chat)screen.append(chat);
    for(const dialog of document.querySelectorAll('body>dialog'))screen.append(dialog);
    document.body.append(stage);
    const select=document.getElementById('tripPreviewWidth'),q=query.get('width'),saved=read(WIDTH_KEY);
    select.value=choices.includes(q)?q:choices.includes(saved)?saved:'402';
    const draw=()=>{document.body.style.setProperty('--trip-preview-width',select.value+'px');geometry();requestAnimationFrame(()=>{geometry();dispatchEvent(new Event('resize'));});};
    select.addEventListener('change',()=>{if(!choices.includes(select.value))return;write(WIDTH_KEY,select.value);const u=new URL(location.href);u.searchParams.set('view','app');u.searchParams.set('width',select.value);history.replaceState(null,'',u);draw();});
    if(globalThis.ResizeObserver)new ResizeObserver(geometry).observe(screen);
    new MutationObserver(geometry).observe(document.body,{attributes:true,attributeFilter:['style']});
    draw();
  }
  function apply(){
    const value=mode();document.documentElement.dataset.tripPresentation=value;
    if(!document.body)return;
    for(const name of ['app','mobile','lab'])document.body.classList.toggle('trip-presentation-'+name,value===name);
    for(const link of document.querySelectorAll('[data-presentation-link]')){const active=link.dataset.presentationLink===(value==='app'?'app':'lab');if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
    if(value==='app')makeDevice();
  }
  apply();addEventListener('resize',apply,{passive:true});addEventListener('scroll',geometry,{passive:true});addEventListener('DOMContentLoaded',apply,{once:true});
})();
