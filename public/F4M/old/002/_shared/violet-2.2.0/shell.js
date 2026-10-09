/* Flip4M Violet shell. One controller, two channel presentations. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id), api=window.F4MLab;
  if (!api) throw Error('Flip4M controller did not initialize');
  const app=document.body.dataset.channel==='app';
  const small=matchMedia('(max-width:800px)');
  let view='board';
  const SL={play:'Igra',analysis:'Analiza',sim:'Sim',history:'Zgodovina',workspace:'TVOJ DELOVNI PROSTOR',local:'LOKALNO',board:'IGRALNA PLOŠČA',more:'⋯ Več',moreTitle:'Orodja in nastavitve',setup:'Nova igra / nastavitve',how:'Kako igrati?',dcc:'Kako deluje DCC?',paper:'O igri in raziskavi ↗',theme:'Svetla / temna tema',install:'Namesti',release:'Zapis izdaje',close:'Zapri',newSim:'＋ Nov poskus',privacy:'Brez računa. Igra in AI delujeta lokalno.',note:'Ena plošča. Dva pogleda.',noteBody:'Igraj, preglej poteze ali primerjaj Classical in DCC.',longThink:'Velemojster: do 60 s; Prvak: do 120 s. Enostavne začetne pozicije dobijo manj časa. Premor ustavi računanje.',update:'Shrani in posodobi',updateReady:'Nova različica je pripravljena.',offline:'Brez povezave · lokalna igra',ready:'Pripravljeno za uporabo brez povezave',preparing:'Pripravljam paket za uporabo brez povezave …',notReady:'Offline paket še ni potrjen.',updateFail:'Shranjevanje ni uspelo. Igra ni bila ponovno naložena. Izvozi JSON.',installHelp:'Na iPhonu odpri to stran v Safariju: Deli → Dodaj na začetni zaslon. Na računalniku ali Androidu uporabi Namesti aplikacijo v meniju brskalnika. LAB in APP sta ločeni namestitvi.',otherUpdate:'Drug zavihek je posodobil paket. Ta igra ostane odprta; shrani in osveži, ko boš pripravljen.',offlineUnavailable:'Namestitev in offline način tu nista na voljo.',pwaTitle:'Namestitev in posodobitve',viewWidth:'Širina prikaza'};
  const EN={play:'Play',analysis:'Analysis',sim:'Sim',history:'History',workspace:'YOUR WORKSPACE',local:'LOCAL',board:'GAME BOARD',more:'⋯ More',moreTitle:'Tools & settings',setup:'New game / settings',how:'How to play?',dcc:'How does DCC work?',paper:'Game & research ↗',theme:'Light / dark theme',install:'Install',release:'Release record',close:'Close',newSim:'＋ New experiment',privacy:'No account. Game and AI run locally.',note:'One board. Two perspectives.',noteBody:'Play, review moves, or compare Classical and DCC.',longThink:'Grandmaster: up to 60 s; Champion: up to 120 s. Simple opening positions receive less time. Pause cancels computation.',update:'Save & update',updateReady:'A new version is ready.',offline:'Offline · local game',ready:'Ready for offline use',preparing:'Preparing the offline package …',notReady:'Offline package is not verified yet.',updateFail:'Saving failed. The game was not reloaded. Export JSON.',installHelp:'On iPhone, open this page in Safari: Share → Add to Home Screen. On desktop or Android, use Install app in your browser menu. LAB and APP are separate installations.',otherUpdate:'Another tab updated the package. This game stays open; save and reload when ready.',offlineUnavailable:'Installation and offline mode are unavailable here.',pwaTitle:'Installation & updates',viewWidth:'Preview width'};
  const language=()=>document.documentElement.lang==='en'?'en':'sl';
  const text=k=>(language()==='en'?EN:SL)[k]||k;
  const mobile=()=>app||small.matches;
  function translate(){
    document.querySelectorAll('[data-shell]').forEach(el=>el.textContent=text(el.dataset.shell));
    document.querySelectorAll('[data-language]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.language===language())));
    document.title='Flip4M '+(app?'APP':'LAB')+' · Violet';
    $('offlineStatus').textContent=text(window.F4MPWA?.state||'preparing');
    if($('installInfo')&&!$('installInfo').hidden)$('installInfo').textContent=text('installHelp');
    document.querySelector('meta[name="theme-color"]').content=document.documentElement.dataset.theme==='light'?'#f3f0f8':'#100f19';
  }
  function setView(next,focus=false){
    if(!['board','setup','analysis','sim','history'].includes(next))return;
    view=next;document.body.dataset.view=view;
    $('playPanel').hidden=app&&view!=='board';
    const pause=$('pause');if(app){(view==='board'?document.querySelector('.status-actions'):document.querySelector('.header-tools')).append(pause);(view==='board'?document.querySelector('.utility'):document.querySelector('.header-tools')).append($('more'));}
    const active=view==='board'?(mobile()?null:'setup'):view;
    for(const [name,id] of Object.entries({setup:'setupPanel',analysis:'analysisPanel',sim:'batchPanel',history:'historyPanel'})){
      $(id).hidden=name!==active;
      if($(id).tagName==='DETAILS')$(id).open=true;
    }
    document.querySelectorAll('[data-view-tab]').forEach(b=>{const selected=b.dataset.viewTab===(view==='setup'?'board':view);b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;});
    if(focus&&mobile()&&active){
      const panel=$({setup:'setupPanel',analysis:'analysisPanel',sim:'batchPanel',history:'historyPanel'}[active]);
      panel.focus({preventScroll:true});if(!app)panel.scrollIntoView({block:'start',behavior:'smooth'});
    }
    if(app){const s=document.querySelector('.device-screen');if(s)s.scrollTop=0;}
  }
  document.querySelectorAll('[data-view-tab]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.viewTab,true)));
  $('workspaceTabs').addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    const tabs=[...document.querySelectorAll('[data-view-tab]')];let i=tabs.indexOf(document.activeElement);
    if(i<0)return;e.preventDefault();i=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    tabs[i].click();tabs[i].focus();
  });
  document.querySelectorAll('[data-language]').forEach(b=>b.onclick=()=>{api.setLanguage(b.dataset.language);translate();});
  $('more').onclick=()=>{api.pause();$('moreDialog').showModal();};
  $('closeMore').onclick=()=>$('moreDialog').close();
  const setup=()=>{$('moreDialog').close();api.pause();setView('setup',true);};
  $('openSetup').onclick=setup;$('newGame').onclick=setup;
  $('start').addEventListener('click',()=>{if(api.status().cursor===0&&!api.status().paused)setView('board');});
  $('help').addEventListener('click',()=>$('moreDialog').close());
  $('helpDcc').onclick=()=>{$('moreDialog').close();$('help').click();requestAnimationFrame(()=>{const e=$('helpText').querySelector('details');if(e)e.open=true;});};
  $('theme').addEventListener('click',()=>requestAnimationFrame(translate));
  $('newSim').onclick=()=>{$('sim').click();};
  $('startSim').addEventListener('click',()=>{if(api.status().inSimulation)setView(app?'board':'sim');});
  $('backToPlay').addEventListener('click',()=>setView('board'));
  $('hint').addEventListener('click',()=>setView('analysis',true));
  document.addEventListener('f4m:panel',e=>setView(e.detail,true));
  document.addEventListener('f4m:language',translate);
  small.addEventListener('change',()=>setView(view));
  if(app){
    const ua=navigator.userAgent||'';
    const phone=navigator.userAgentData?.mobile===true||/iPhone|iPod|Android.+Mobile|Windows Phone/i.test(ua);
    document.documentElement.classList.toggle('app-phone',phone);
    if(phone){const nav=document.querySelector('.brand-header .version-nav');document.querySelector('.brand-header').prepend(nav);}
    const choices=['375','390','402','430'];const q=new URLSearchParams(location.search).get('width');
    if(choices.includes(q))$('previewWidth').value=q;
    const draw=()=>document.querySelector('.device').style.setProperty('--device-width',$('previewWidth').value+'px');
    $('previewWidth').onchange=draw;draw();
  }
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}));
  window.F4MShell=Object.freeze({setView,translate,text,getView:()=>view});
  if(!app&&'BroadcastChannel'in window){const presence=new BroadcastChannel('flip4m-violet-lab-presence');presence.onmessage=e=>{if(e.data==='probe')presence.postMessage('present');};}
  setView('board');translate();
})();
