/* LAB UI only: no solver or route-state changes. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id), UI=window.TripUI;
  document.addEventListener('DOMContentLoaded',()=>{
    const labels={btnPlanMode:'Plan',btnMapMode:'Map',btnHelp:'Help',btnDeep:'Optimize (Deep)',btnPrepare:'Prepare distances',btnCancelWork:'Cancel calculation',btnDriving:'🚗 Drive',btnWalking:'🚶 Walk',btnSave:'💾 Save',btnLoad:'📂 Load',jumpLibrary:'Library ↓',jumpEditor:'Editor ↑'};
    for(const [id,text] of Object.entries(labels)) UI.set($(id),text);
    UI.set(document.querySelector('#editorPanel h3'),'Trip Editor');
    UI.set(document.querySelector('#librarySection h3'),'Trip Library');
    UI.set(document.querySelector('#comparisonPanel h3'),'Calculation comparison');
    UI.set($('matrixStatus'),$('matrixStatus').dataset.uiText || $('matrixStatus').textContent);
    // Migrate only the exact built-in greeting from previous releases.
    const welcome='Welcome to 8Z! Load a Library trip or enter your destinations. Ask the assistant for suggestions or help with Trip Optimizer.';
    document.querySelectorAll('#chatHistory .msg.ai, #bigChatHistory .msg.ai').forEach(el=>{
      const value=el.textContent.trim().replace(/^Gemini:\s*/, '');
      if(value===welcome || value==='Welcome to 8Z! 🌍 I can build optimized itineraries, find the perfect "Base Camp" hotel for your route, and suggest dining spots. Where are we going?') {el.classList.add('welcome-message');UI.set(el,welcome);}
    });
    const heads=['Method','Compute time','Table distance','Result'];
    document.querySelectorAll('#comparisonPanel th').forEach((el,i)=>UI.set(el,heads[i]));
    const head=document.querySelector('#chatPanel .chat-head');
    const panel=$('chatPanel');
    const toggle=()=>{const open=panel.classList.toggle('open');head.setAttribute('aria-expanded',String(open));if(!open && panel.contains(document.activeElement))document.activeElement.blur();measure();};
    head.onclick=toggle;
    head.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}};
    let note=document.createElement('p');note.id='chatGroundingNote';note.className='demo-note';
    panel.insertBefore(note,$('chatHistory'));
    UI.set(note,'The assistant can consult current web sources; English place queries can also use Maps. Check dates, opening hours and bookable prices at the source.');
    const apply=lang=>{
      const sl=lang==='sl';
      document.querySelectorAll('[data-language]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.language===lang)));
      $('chatInput').placeholder=sl?'Vprašaj pomočnika …':'Ask the trip assistant …';
      $('chatInput').setAttribute('aria-label',sl?'Sporočilo pomočniku':'Message the assistant');
      if($('bigChatInput')){$('bigChatInput').placeholder=$('chatInput').placeholder;$('bigChatInput').setAttribute('aria-label',$('chatInput').getAttribute('aria-label'));}
      [$('btnSendChat'),$('btnSendBigChat')].filter(Boolean).forEach(b=>{b.title=sl?'Pošlji':'Send';b.setAttribute('aria-label',b.title);});
      $('input').placeholder=sl?'En postanek v vsako vrstico. START označi izhodišče.':'One stop per line. START fixes the starting stop.';
      $('input').setAttribute('aria-label',sl?'Urejevalnik poti':'Trip Editor');
      $('tripSearch').placeholder=sl?'Išči po knjižnici …':'Search library…';
      $('tripSearch').setAttribute('aria-label',sl?'Išči po knjižnici':'Search library');
      head.setAttribute('aria-label',sl?'Odpri ali zapri pomočnika':'Open or close trip assistant');
      $('btnPrepare').title=sl?'Pridobi ali osveži cestne razdalje. Porablja Googlovo API-kvoto.':'Fetch or refresh road distances. Uses Google API quota.';
      $('btnStandard').textContent=UI.t($('chkBrute').checked?'Run Brute Force':'Optimize (Fast)');
      document.querySelector('.chat-title').firstChild.textContent=sl?'✨ Pomočnik za potovanja ':'✨ AI Trip Assistant ';
      UI.render();
    };
    window.MDLxDCCLocale.subscribe(apply);
    document.querySelectorAll('[data-language]').forEach(b=>b.onclick=()=>window.MDLxDCCLocale.choose(b.dataset.language));
    $('chkBrute').addEventListener('change',()=>apply(window.MDLxDCCLocale.current()));
    // Resize for Safari's bars and software keyboard. No scrollIntoView on keyboard resize.
    const mq=matchMedia('(min-width:1024px)');
    function measure(){
      const v=window.visualViewport, h=v?.height||innerHeight;
      const gap=v?Math.max(0,innerHeight-v.height-v.offsetTop):0;
      const keyboard=!!(v && innerHeight-v.height>150 && /INPUT|TEXTAREA/.test(document.activeElement?.tagName));
      document.documentElement.style.setProperty('--visible-height',h+'px');
      document.documentElement.style.setProperty('--keyboard-gap',gap+'px');
      document.documentElement.style.setProperty('--visual-top',(v?.offsetTop||0)+'px');
      document.body.classList.toggle('keyboard-visible',keyboard);
      document.documentElement.style.setProperty('--chat-bar-height',(panel.style.display==='none'?0:head.getBoundingClientRect().height)+'px');
    }
    const arrange=()=>{
      if(mq.matches)$('editorPanel').appendChild($('librarySection'));
      else $('resultsPanel').appendChild($('librarySection'));
      measure();
    };
    mq.addEventListener('change',arrange);arrange();
    window.visualViewport?.addEventListener('resize',measure);
    window.visualViewport?.addEventListener('scroll',measure);
    window.addEventListener('resize',measure);
    document.addEventListener('focusin',measure);document.addEventListener('focusout',()=>requestAnimationFrame(measure));
    for(const id of ['btnPlanMode','btnMapMode'])$(id).addEventListener('click',()=>{apply(window.MDLxDCCLocale.current());measure();});
    new ResizeObserver(measure).observe(head);
    // Explicit shortcuts move focus without changing input or selecting a route.
    for(const [link,target] of [['jumpLibrary','tripSearch'],['jumpEditor','input']])$(link).onclick=e=>{e.preventDefault();const section=$(link==='jumpLibrary'?'librarySection':'editorPanel');section.tabIndex=-1;section.focus({preventScroll:true});section.scrollIntoView({block:'start'});};
    // Standalone Demo loads a city set only; never starts a calculation.
    const preset=new URLSearchParams(location.search).get('preset');
    if(['eu14','eu15'].includes(preset)){
      const cities=['Berlin, Germany','Madrid, Spain','Rome, Italy','Paris, France','Vienna, Austria','Hamburg, Germany','Warsaw, Poland','Bucharest, Romania','Barcelona, Spain','Budapest, Hungary','Munich, Germany','Prague, Czechia','Milan, Italy','Sofia, Bulgaria'];
      if(preset==='eu15')cities.unshift('Ljubljana, Slovenia');
      $('input').value=cities.map((s,i)=>s+(i?'':' START')).join('\n');
      $('input').dispatchEvent(new Event('input',{bubbles:true}));
      const url=new URL(location.href);url.searchParams.delete('preset');history.replaceState(null,'',url.pathname+url.search+url.hash);
    }
  });
})();
