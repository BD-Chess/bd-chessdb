/* LAB layout, localization and explicit Demo preset entrypoint. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id), UI=window.TripUI;

  function installCollapsibleHelp(){
    const editor=$('editorPanel');
    if(!editor || $('tripCollapsibleHelpStyles')) return;

    const style=document.createElement('style');
    style.id='tripCollapsibleHelpStyles';
    style.textContent=`
      #editorPanel .collapsible-help { border:1px solid var(--border); border-radius:8px; margin:8px 0; color:var(--text-dim); font-size:12px; line-height:1.5; overflow-wrap:anywhere; }
      #editorPanel .collapsible-help > summary { cursor:pointer; padding:9px 10px; color:var(--text-main); font-weight:600; line-height:1.35; }
      #editorPanel .collapsible-help > summary:focus-visible { outline:2px solid var(--primary); outline-offset:2px; border-radius:6px; }
      #editorPanel .collapsible-help[open] > summary { border-bottom:1px solid var(--border); }
      #editorPanel .collapsible-help-body { padding:4px 10px 9px; }
      #editorPanel details.tsp-notice { padding:0; }
      #editorPanel details.tsp-notice .collapsible-help-body { padding:4px 12px 10px; }
      #editorPanel details.tsp-notice p { margin:6px 0; }
      #editorPanel .mdl-controls > .collapsible-help { margin:6px 0; }
      #editorPanel .mdl-checkpoint-details button { width:auto; max-width:100%; padding:7px 10px; font-size:12px; margin:6px 6px 0 0; white-space:normal; overflow-wrap:anywhere; background:var(--bg-input); color:var(--text-main); border:1px solid var(--border); box-shadow:none; }
      #editorPanel .mdl-checkpoint-details button:not(:disabled):hover { background:#111827; border-color:#334155; color:#fff; }
      #editorPanel .mdl-checkpoint-details button:disabled { opacity:1; background:#1f2937; color:#60a5fa; border-color:#334155; }
      #editorPanel .mdl-checkpoint-details button:focus-visible { outline:2px solid var(--primary); outline-offset:2px; }
      html, body, * { scrollbar-width:thin; scrollbar-color:#334155 #0b0f14; }
      *::-webkit-scrollbar { width:10px; height:10px; }
      *::-webkit-scrollbar-track { background:#0b0f14; }
      *::-webkit-scrollbar-thumb { background:#334155; border:2px solid #0b0f14; border-radius:999px; }
      *::-webkit-scrollbar-thumb:hover { background:#475569; }
      #editorPanel .brute-help-details #bruteInfo { padding:0 10px 8px; margin:6px 0 0; }
      #editorPanel #bruteHelpCount { font-weight:400; color:var(--text-dim); }
    `;
    document.head.append(style);

    const tsp=$('tspNotice');
    if(tsp && tsp.tagName!=='DETAILS'){
      const details=document.createElement('details');
      for(const attr of [...tsp.attributes]) details.setAttribute(attr.name,attr.value);
      details.classList.add('collapsible-help');
      details.open=false;
      const summary=document.createElement('summary');
      const datasetName=$('tspDatasetName');
      if(datasetName) summary.append(datasetName);
      const body=document.createElement('div');
      body.className='collapsible-help-body';
      while(tsp.firstChild) body.append(tsp.firstChild);
      details.append(summary,body);
      tsp.replaceWith(details);
    }

    const controls=document.querySelector('.mdl-controls'), mdlStatus=$('mdlStatus');
    if(controls && mdlStatus){
      const paragraphs=[...controls.children].filter(el=>el.tagName==='P' && el!==mdlStatus).slice(0,2);
      if(paragraphs.length && !controls.querySelector('.mdl-help-details')){
        const details=document.createElement('details');
        details.className='collapsible-help mdl-help-details';
        details.open=false;
        const summary=document.createElement('summary');
        summary.id='mdlHelpSummary';
        const body=document.createElement('div');
        body.className='collapsible-help-body';
        paragraphs[0].before(details);
        paragraphs.forEach(p=>body.append(p));
        details.append(summary,body);
      }
      const checkpoint=[...controls.children].find(el=>el.tagName==='DETAILS' && !el.classList.contains('mdl-help-details'));
      if(checkpoint){checkpoint.classList.add('collapsible-help','mdl-checkpoint-details');checkpoint.open=false;}
    }

    const brute=$('bruteInfo');
    if(brute && !$('bruteHelpDetails')){
      const details=document.createElement('details');
      details.id='bruteHelpDetails';
      details.className='collapsible-help brute-help-details';
      details.open=false;
      const summary=document.createElement('summary');
      const title=document.createElement('span');
      title.id='bruteHelpTitle';
      const count=document.createElement('span');
      count.id='bruteHelpCount';
      summary.append(title,count);
      brute.before(details);
      details.append(summary,brute);
    }

    const countStops=()=>{
      const raw=$('bruteInfo')?.dataset.uiText || '';
      const fromInfo=/^(\d+)\s+stops\b/.exec(raw);
      if(fromInfo) return Number(fromInfo[1]);
      return String($('input')?.value || '').split(/\r?\n/).map(x=>x.trim()).filter(x=>x && !x.startsWith('#')).length;
    };
    const slStopWord=n=>n===1?'postanek':'postankov';
    const updateHelpLabels=lang=>{
      const sl=lang==='sl';
      if($('mdlHelpSummary')) $('mdlHelpSummary').textContent=sl?'O delavcih in načinu MDL×DCC':'About workers and MDL×DCC';
      if($('bruteHelpTitle')) $('bruteHelpTitle').textContent=sl?'Zahtevnost iskanja':'Search complexity';
      if($('bruteHelpCount')){
        const n=countStops();
        $('bruteHelpCount').textContent=n?` · ${n.toLocaleString(sl?'sl-SI':'en-US')} ${sl?slStopWord(n):(n===1?'stop':'stops')}`:'';
      }
    };
    const refreshHelpLabels=()=>updateHelpLabels(window.MDLxDCCLocale.current());
    const bruteInfo=$('bruteInfo');
    if(bruteInfo) new MutationObserver(refreshHelpLabels).observe(bruteInfo,{attributes:true,attributeFilter:['data-ui-text'],childList:true,characterData:true,subtree:true});
    $('input')?.addEventListener('input',refreshHelpLabels);
    window.MDLxDCCLocale.subscribe(updateHelpLabels);
  }

  function promoteTspLibraryForTesting(){
    const tree=$('presetTree');
    if(!tree) return;
    const direct=(node,selector)=>node ? [...node.children].find(el=>el.matches(selector)) : null;
    const labelOf=node=>direct(direct(node,'.tree-header'),'.tree-label')?.dataset.uiText;
    const openNode=node=>{
      const header=direct(node,'.tree-header'), group=direct(node,'.tree-group');
      if(!header || !group) return;
      group.classList.add('open');
      const arrow=direct(header,'.tree-arrow');
      if(arrow) arrow.textContent='⌄';
    };
    const promote=()=>{
      const special=[...tree.children].find(node=>labelOf(node)==='⭐ Special Collections');
      if(!special) return false;
      const regionGroup=direct(special,'.tree-group');
      if(!regionGroup) return false;
      const tsp=[...regionGroup.children].find(node=>labelOf(node)==='🧩 TSP country collection');
      if(!tsp) return false;
      if(tree.firstElementChild!==special) tree.prepend(special);
      if(regionGroup.firstElementChild!==tsp) regionGroup.prepend(tsp);
      openNode(special);
      openNode(tsp);
      return true;
    };
    if(promote()) return;
    const observer=new MutationObserver(()=>{if(promote()) observer.disconnect();});
    observer.observe(tree,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),5000);
  }

  document.addEventListener('DOMContentLoaded',()=>{
    installCollapsibleHelp();
    promoteTspLibraryForTesting();
    const labels={btnPlanMode:'Plan',btnMapMode:'Map',btnHelp:'Help',btnDeep:'Optimize (Deep)',btnPrepare:'Prepare distances',btnCancelWork:'Cancel calculation',btnDriving:'🚗 Drive',btnWalking:'🚶 Walk',btnSave:'💾 Save',btnLoad:'📂 Load',jumpLibrary:'Library ↓',jumpEditor:'Editor ↑'};
    for(const [id,text] of Object.entries(labels)) UI.set($(id),text);
    UI.set(document.querySelector('#editorPanel h3'),'Trip Editor');
    UI.set(document.querySelector('#librarySection h3'),'Trip Library');
    UI.set(document.querySelector('#comparisonPanel h3'),'Calculation comparison');
    UI.set($('matrixStatus'),$('matrixStatus').dataset.uiText || $('matrixStatus').textContent);
    // Migrate only the exact built-in greeting from previous releases.
    const welcome='Welcome to 8Z! Load a Library trip or enter your destinations. Ask the assistant for suggestions or help with Trip Optimizer.';
    document.querySelectorAll('#chatHistory .msg.ai, #bigChatHistory .msg.ai').forEach(el=>{
      const value=el.textContent.trim().replace(/^(?:Gemini|Trip Assistant):\s*/, '');
      if(value==='Welcome to 8Z! 🌍 Load a Trip Library tour, or send your destinations to plan a trip. I can suggest stops and help you use Trip Optimizer.' || value===welcome || value==='Welcome to 8Z! 🌍 I can build optimized itineraries, find the perfect "Base Camp" hotel for your route, and suggest dining spots. Where are we going?') {el.classList.add('welcome-message');UI.set(el,welcome);}
      else if(value==='Gemini usage limit reached. Please try later. The site owner can check the active quota in AI Studio.') UI.set(el,value);
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
      // The optimizer owns Start/Resume state; translation must preserve it.
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
    if(['eu14','eu15','capitals14','capitals15'].includes(preset)){
      window.TripDemo.load(preset);
      const url=new URL(location.href);url.searchParams.delete('preset');history.replaceState(null,'',url.pathname+url.search+url.hash);
    }
  });
})();
