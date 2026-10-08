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

  // SA1_RESCORING_READER_R1: current reader-facing scores; the historical
  // publishing ledger is deliberately not presented as a competing rating.
  // This static projection survives daily HTML regeneration by the R8 builder.
  const sa1Scores={
    '2026-10-05':{g:88,c:82.5,final:85.25},
    '2026-10-06':{g:86.5,c:82.5,final:84.5},
    '2026-10-07':{g:86,c:84.5,final:85.25,first:{g:86.5,c:85,combined:85.75}},
    '2026-10-08':{g:87,c:81.5,final:84.25,first:{g:88,c:81,combined:84.5}}
  };
  const fSA1=v=>Number(v).toFixed(2);
  const nSA1=v=>fSA1(v).replace('.',',');
  const pairSA1=(en,sl)=>'<span data-language-content="en" lang="en">'+en+'</span><span data-language-content="sl" lang="sl" hidden>'+sl+'</span>';
  const applySA1=()=>{
    const isUnratedOriginal=/-original(?:-log)?\.html$/.test(location.pathname);
    if(isUnratedOriginal){
      document.querySelectorAll('.score-set, .score-dialog, details.score-audit').forEach(el=>el.remove());
      return;
    }
    for(const [date,v] of Object.entries(sa1Scores)){
      const id='NARA-D-'+date,scoreId='score-'+id;
      document.querySelectorAll('[data-score-open="'+scoreId+'"]').forEach(button=>{
        const en=v.first?'First '+fSA1(v.first.combined)+' → final '+fSA1(v.final):'Final '+fSA1(v.final);
        const sl=v.first?'Prva '+nSA1(v.first.combined)+' → končna '+nSA1(v.final):'Končna '+nSA1(v.final);
        button.innerHTML=pairSA1(en,sl);
        button.setAttribute('data-aria-en','SA1 score: '+en);
        button.setAttribute('data-aria-sl','Ocena SA1: '+sl);
        button.setAttribute('aria-label',language==='sl'?'Ocena SA1: '+sl:'SA1 score: '+en);
      });
      const dialog=document.getElementById(scoreId);
      if(dialog){
        const first=v.first
          ?'<h3>'+pairSA1('First complete draft','Prva popolna verzija')+'</h3><p>'+pairSA1('GPT: '+fSA1(v.first.g)+' · Claude: '+fSA1(v.first.c)+' · Combined: '+fSA1(v.first.combined),'GPT: '+nSA1(v.first.g)+' · Claude: '+nSA1(v.first.c)+' · Skupaj: '+nSA1(v.first.combined))+'</p>'
          :'';
        const delta=v.first
          ?'<p><strong>'+pairSA1('Change: '+fSA1(v.final-v.first.combined),'Sprememba: '+nSA1(v.final-v.first.combined))+'</strong></p>'
          :'';
        dialog.innerHTML='<div class="score-dialog-card"><form method="dialog" class="score-close-row"><button class="score-close" aria-label="Close">×</button></form><div class="eyebrow">SA1 · '+pairSA1('Updated joint literary score','Nova skupna književna ocena')+'</div><h2 id="'+scoreId+'-title">'+pairSA1(fSA1(v.final)+' / 100',nSA1(v.final)+' / 100')+'</h2>'+first+'<h3>'+pairSA1('Final version','Končna verzija')+'</h3><p>'+pairSA1('GPT: '+fSA1(v.g)+' · Claude: '+fSA1(v.c)+' · Combined: '+fSA1(v.final),'GPT: '+nSA1(v.g)+' · Claude: '+nSA1(v.c)+' · Skupaj: '+nSA1(v.final))+'</p>'+delta+'<p class="muted">'+pairSA1('SA1 shared quality anchors. Each model scored each available version twice in fresh contexts; the model averages have equal weight. Rating applies to the English original.','SA1 – skupna opredelitev kakovosti. Vsak model je vsako ocenjeno verzijo presodil dvakrat v ločenih kontekstih; povprečji obeh modelov imata enaki uteži. Ocena velja za angleški izvirnik.')+'</p></div>';
      }
      const log=document.getElementById(id+'-LOG');
      const logScore=log?.querySelector('details.score-audit');
      if(logScore){
        const firstLine=v.first?' · '+pairSA1('First: '+fSA1(v.first.combined),'Prva: '+nSA1(v.first.combined)):'';
        logScore.innerHTML='<summary>SA1 · '+pairSA1('final '+fSA1(v.final),'končna '+nSA1(v.final))+firstLine+'</summary><div class="inside"><p>'+pairSA1('Final GPT: '+fSA1(v.g)+' / 100 · Claude: '+fSA1(v.c)+' / 100','Končna GPT: '+nSA1(v.g)+' / 100 · Claude: '+nSA1(v.c)+' / 100')+'</p>'+(v.first?'<p>'+pairSA1('First GPT: '+fSA1(v.first.g)+' / 100 · Claude: '+fSA1(v.first.c)+' / 100','Prva GPT: '+nSA1(v.first.g)+' / 100 · Claude: '+nSA1(v.first.c)+' / 100')+'</p>':'')+'<p>'+pairSA1('Combined final: '+fSA1(v.final),'Skupna končna: '+nSA1(v.final))+'</p><p class="muted">SA1 · 2 × GPT, 2 × Claude · 50/50</p></div>';
      }
    }
  };
  applySA1();

  applyScale();applyLanguage();openHash();
})();
