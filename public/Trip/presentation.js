(() => {
  'use strict';
  const KEY='8z_trip_current_desktop_view_v1',WIDTH_KEY='8z_trip_current_preview_width_v1';
  const choices=['375','390','402','430'],query=new URLSearchParams(location.search),requested=query.get('view');
  // Desktop Edge installed PWAs also report display-mode: standalone. That is
  // not evidence of a phone: explicit LAB/APP must still work in their windows.
  const ipadDesktopUA=navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
  const deviceMobile=Boolean(navigator.userAgentData?.mobile)||/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)||ipadDesktopUA||Boolean(globalThis.Capacitor?.isNativePlatform?.());
  function read(key){try{return localStorage.getItem(key);}catch(_){return null;}}
  function write(key,value){try{localStorage.setItem(key,value);}catch(_){}}
  // A presentation navigation must keep an edited draft in the canonical backup.
  // Merge only editor text; retain options, chat and any future schema fields.
  function preserveEditor(){
    const input=document.getElementById('input');if(!input)return;
    try{const raw=localStorage.getItem('8z_trip_backup_v2'),saved=raw?JSON.parse(raw):{};
      if(!saved||typeof saved!=='object'||Array.isArray(saved)||saved.t===input.value)return;
      localStorage.setItem('8z_trip_backup_v2',JSON.stringify({...saved,t:input.value,ts:Date.now()}));
    }catch(_){}
  }

  // CURRENT ignores LAB/APP requests. Channel choices remain on /Trip/new/.
  function mode(){return deviceMobile?'mobile':'lab';}
  let screen;
  function geometry(){if(!screen)return;const r=screen.getBoundingClientRect();for(const edge of ['left','top','right','bottom']){const key='--trip-screen-'+edge,value=r[edge]+'px';if(document.body.style.getPropertyValue(key)!==value)document.body.style.setProperty(key,value);}}
  function makeDevice(){
    // Resize may fire while the parser is still building the wrapper. Move the
    // complete runtime only after chat and dialogs exist, including on reload.
    if(screen||document.readyState==='loading')return;
    const wrapper=document.querySelector('.app-wrapper');if(!wrapper)return;
    const stage=document.createElement('div');stage.className='trip-preview-stage';
    stage.innerHTML='<div class="trip-preview-device"><div class="trip-preview-screen"><div class="trip-preview-island" aria-hidden="true"></div><div class="trip-preview-content"></div><div class="trip-preview-home" aria-hidden="true"></div></div></div>';
    screen=stage.querySelector('.trip-preview-screen');
    // Capture before detaching the wrapper: document.getElementById cannot
    // find its chat while the runtime is inside a detached preview stage.
    const chat=wrapper.querySelector('#chatPanel');
    stage.querySelector('.trip-preview-content').append(wrapper);
    if(chat)screen.append(chat);
    for(const dialog of document.querySelectorAll('body>dialog'))screen.append(dialog);
    document.body.append(stage);
    const select=document.getElementById('tripPreviewWidth'),q=query.get('width'),saved=read(WIDTH_KEY);
    select.value=choices.includes(q)?q:choices.includes(saved)?saved:'402';
    const draw=()=>{document.body.style.setProperty('--trip-preview-width',select.value+'px');geometry();requestAnimationFrame(()=>{geometry();dispatchEvent(new Event('resize'));});};
    select.addEventListener('change',()=>{if(!choices.includes(select.value))return;preserveEditor();write(WIDTH_KEY,select.value);const u=new URL(location.href);u.searchParams.set('view','app');u.searchParams.set('width',select.value);history.replaceState(null,'',u);draw();});
    if(globalThis.ResizeObserver)new ResizeObserver(geometry).observe(screen);
    new MutationObserver(geometry).observe(document.body,{attributes:true,attributeFilter:['style']});
    draw();
  }
  function apply(){
    const value=mode();document.documentElement.dataset.tripPresentation=value;
    document.title='8Z Trip Optimizer';
    if(!document.body)return;
    for(const name of ['app','mobile','lab'])document.body.classList.toggle('trip-presentation-'+name,value===name);
    for(const link of document.querySelectorAll('[data-presentation-link]')){const active=link.dataset.presentationLink===(value==='app'?'app':'lab');if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
    if(value==='app')makeDevice();
  }
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-presentation-link],.trip-preview-nav a'))preserveEditor();},true);
  // Safari can leave the bottom of a newly focused Plan field clipped by the
  // nested scrollport. Correct only the phone content after its focus scroll.
  document.addEventListener('focusin',event=>{
    const target=event.target,content=screen?.querySelector('.trip-preview-content');
    if(document.documentElement.dataset.tripPresentation!=='app'||!content?.contains(target))return;
    requestAnimationFrame(()=>{
      if(!target.isConnected||document.activeElement!==target)return;
      const field=target.getBoundingClientRect(),port=content.getBoundingClientRect();
      if(field.height>port.height)return;
      if(field.bottom>port.bottom)content.scrollTop+=field.bottom-port.bottom+12;
      else if(field.top<port.top)content.scrollTop-=port.top-field.top+12;
    });
  });
  apply();addEventListener('resize',apply,{passive:true});addEventListener('scroll',geometry,{passive:true});addEventListener('DOMContentLoaded',apply,{once:true});
})();
