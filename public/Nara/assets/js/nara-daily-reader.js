/* Illuminara Daily R6. English is readable without JavaScript; EN / SL is progressive enhancement. */
(()=>{
  'use strict';
  const r=document.documentElement;
  const get=(k,d)=>{try{return localStorage.getItem(k)??d}catch{return d}};
  const set=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
  const validLanguage=v=>v==='en'||v==='sl';
  const switcher=document.querySelector('[data-language-switch]');
  const requested=new URLSearchParams(location.search).get('lang');
  const saved=get('nara-daily-lang',get('nara-daily-language','en'));
  let language=switcher?(validLanguage(requested)?requested:validLanguage(saved)?saved:'en'):'en';
  let scale=Number(get('nara-daily-scale','1'));
  if(!Number.isFinite(scale))scale=1;
  const applyScale=()=>{
    scale=Math.min(1.8,Math.max(.85,scale));
    r.style.setProperty('--scale',String(scale));
    const o=document.querySelector('[data-scale-label]');
    if(o)o.textContent=Math.round(scale*100)+'%';
    set('nara-daily-scale',String(scale));
  };
  r.dataset.theme=get('nara-daily-theme','dark')==='light'?'light':'dark';
  const themeButton=document.querySelector('[data-theme-toggle]');
  const themeLabel=()=>{
    if(!themeButton)return;
    themeButton.textContent=language==='sl'
      ?(r.dataset.theme==='light'?'Nočni način':'Dnevni način')
      :(r.dataset.theme==='light'?'Night mode':'Day mode');
    themeButton.setAttribute('aria-label',themeButton.textContent);
  };
  const applyLanguage=(updateURL=false)=>{
    if(!switcher){themeLabel();return}
    r.lang=language;
    document.querySelectorAll('[data-language-content]').forEach(el=>{
      el.hidden=el.dataset.languageContent!==language;
    });
    document.querySelectorAll('[data-aria-en]').forEach(el=>{
      el.setAttribute('aria-label',language==='sl'?el.dataset.ariaSl:el.dataset.ariaEn);
    });
    switcher.querySelectorAll('[data-language]').forEach(el=>{
      el.setAttribute('aria-pressed',String(el.dataset.language===language));
    });
    document.title=language==='sl'?r.dataset.titleSl:r.dataset.titleEn;
    const description=document.querySelector('[data-description-en]');
    if(description)description.content=language==='sl'?description.dataset.descriptionSl:description.dataset.descriptionEn;
    document.querySelectorAll('a[href]').forEach(a=>{
      const url=new URL(a.getAttribute('href'),location.href);
      if(url.origin===location.origin&&/\/Nara-AI-(?:daily|\d{4}-\d{2})\.html$/.test(url.pathname)){
        url.searchParams.set('lang',language);
        a.setAttribute('href',url.pathname+url.search+url.hash);
      }
    });
    set('nara-daily-lang',language);
    set('nara-daily-language',language);
    if(updateURL){
      const url=new URL(location.href);
      url.searchParams.set('lang',language);
      try{history.replaceState(null,'',url.pathname+url.search+url.hash)}catch{}
    }
    themeLabel();
    switcher.hidden=false;
  };
  document.querySelectorAll('[data-language]').forEach(b=>b.addEventListener('click',()=>{
    language=b.dataset.language;
    applyLanguage(true);
  }));
  document.querySelectorAll('[data-scale]').forEach(b=>b.addEventListener('click',()=>{
    scale=b.dataset.scale==='reset'?1:scale+Number(b.dataset.scale);
    applyScale();
  }));
  themeButton?.addEventListener('click',()=>{
    r.dataset.theme=r.dataset.theme==='light'?'dark':'light';
    set('nara-daily-theme',r.dataset.theme);
    themeLabel();
  });
  const openHash=()=>{
    let id;
    try{id=decodeURIComponent(location.hash.slice(1))}catch{return}
    const el=document.getElementById(id);
    if(el?.matches('details.archive-item')){
      el.open=true;
      requestAnimationFrame(()=>el.scrollIntoView());
    }
  };
  window.addEventListener('hashchange',openHash);
  // Preserve the concurrent per-story controls on already generated editions.
  const setStoryLang=(storyId,lang)=>{
    const panels=document.querySelectorAll('[data-story-panel][data-story-id="'+storyId+'"]');
    if(![...panels].some(p=>p.dataset.storyPanel===lang))lang='en';
    panels.forEach(p=>p.hidden=p.dataset.storyPanel!==lang);
    document.querySelectorAll('[data-story-lang][data-story-id="'+storyId+'"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.storyLang===lang)));
    set('nara-daily-language',lang);set('nara-daily-lang',lang);
  };
  document.querySelectorAll('[data-story-language]').forEach(g=>setStoryLang(g.dataset.storyLanguage,saved));
  document.addEventListener('click',e=>{
    const languageButton=e.target.closest?.('[data-story-lang]');
    if(languageButton){
      e.preventDefault();e.stopPropagation();
      setStoryLang(languageButton.dataset.storyId,languageButton.dataset.storyLang);
      return;
    }
    const b=e.target.closest?.('[data-score-open]');
    if(b){
      e.preventDefault();e.stopPropagation();
      const d=document.getElementById(b.dataset.scoreOpen);
      if(d?.showModal)d.showModal();else d?.setAttribute('open','');
      return;
    }
    if(e.target.matches?.('dialog.score-dialog'))e.target.close?.();
  });

  // R14: final grade, history trend and method are rendered from the source-bound, validated static records.
  // No client-side numerical overlay, alternative score mapping or colour guessing.


  applyScale();applyLanguage();openHash();
})();
