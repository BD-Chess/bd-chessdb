/* LAB layout, localization and explicit Demo preset entrypoint. */
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

    // LAB-only compact help: preserve the existing nodes/IDs/listeners and only change presentation.
    const compactStyle=document.createElement('style');
    compactStyle.id='tripLabCollapsibleHelpStyle';
    compactStyle.textContent=`
      .trip-help-details{margin:7px 0;color:var(--text-dim);font-size:12px;line-height:1.45}
      .trip-help-details>summary{cursor:pointer;font-weight:600;color:var(--text-main,#f1f5f9);line-height:1.4;padding:5px 2px;overflow-wrap:anywhere}
      .trip-help-details>summary:focus-visible{outline:2px solid var(--primary,#38bdf8);outline-offset:3px;border-radius:4px}
      .trip-help-details>.trip-help-body{padding:2px 0 2px 18px}
      .trip-help-details>.trip-help-body>p{margin:5px 0}
      #tspNotice.trip-collapsible-notice{padding-top:5px;padding-bottom:5px}
      #tspNotice.trip-collapsible-notice .trip-help-details{margin:0}
      #tspNotice.trip-collapsible-notice .trip-help-details>summary{padding:0}
      #tspNotice.trip-collapsible-notice .trip-help-body{padding-top:5px}
      .trip-checkpoint-actions{display:flex;flex-wrap:wrap;gap:7px;padding:6px 0 2px 18px}
      .trip-checkpoint-actions button{flex:1 1 150px;min-width:0;width:auto;margin:0;white-space:normal}
      #bruteInfoDetails>.trip-help-body{padding-left:18px}
      #bruteInfoDetails #bruteInfo{margin:4px 0 0}
      @media(max-width:430px){.trip-help-details>.trip-help-body,.trip-checkpoint-actions,#bruteInfoDetails>.trip-help-body{padding-left:14px}.trip-checkpoint-actions button{flex-basis:100%}}
    `;
    document.head.appendChild(compactStyle);

    function makeDetails(summaryNode,bodyNodes,className=''){
      const details=document.createElement('details');
      details.className=`trip-help-details ${className}`.trim();
      const summary=document.createElement('summary');
      summary.className='trip-help-summary';
      summary.appendChild(summaryNode);
      const body=document.createElement('div');
      body.className='trip-help-body';
      bodyNodes.forEach(node=>body.appendChild(node));
      details.append(summary,body);
      return details;
    }

    const tspNotice=$('tspNotice'),tspDatasetName=$('tspDatasetName');
    if(tspNotice&&tspDatasetName&&!tspNotice.querySelector(':scope > details.trip-tsp-help')){
      const original=[...tspNotice.childNodes].filter(node=>node!==tspDatasetName);
      const details=makeDetails(tspDatasetName,original,'trip-tsp-help');
      tspNotice.replaceChildren(details);
      tspNotice.classList.add('trip-collapsible-notice');
    }

    const mdlControls=document.querySelector('.mdl-controls');
    if(mdlControls){
      const workerHelp=mdlControls.querySelector(':scope > .mdl-worker-help');
      const deviceHelp=workerHelp?.nextElementSibling?.tagName==='P' ? workerHelp.nextElementSibling : null;
      if(workerHelp&&deviceHelp&&!mdlControls.querySelector(':scope > details.trip-mdl-help')){
        const title=document.createElement('span');title.id='mdlHelpSummary';
        const details=makeDetails(title,[workerHelp,deviceHelp],'trip-mdl-help');
        mdlControls.insertBefore(details,$('mdlStatus'));
      }
      const checkpoint=[...mdlControls.querySelectorAll(':scope > details')].find(details=>details.querySelector('summary[data-ui-text="Local checkpoint"]'));
      if(checkpoint&&!checkpoint.classList.contains('trip-checkpoint-help')){
        checkpoint.classList.add('trip-help-details','trip-checkpoint-help');
        const buttons=[...checkpoint.children].filter(node=>node.tagName==='BUTTON');
        if(buttons.length){
          const actions=document.createElement('div');actions.className='trip-checkpoint-actions';
          buttons.forEach(button=>actions.appendChild(button));checkpoint.appendChild(actions);
        }
      }
    }

    const bruteInfo=$('bruteInfo');
    if(bruteInfo&&!$('bruteInfoDetails')){
      const bruteParent=bruteInfo.parentNode, bruteNext=bruteInfo.nextSibling;
      const summaryText=document.createElement('span');summaryText.id='bruteInfoSummary';
      const details=makeDetails(summaryText,[bruteInfo],'trip-brute-help');
      details.id='bruteInfoDetails';
      bruteParent.insertBefore(details,bruteNext);
    }

    function editorStopCount(){
      return String($('input')?.value||'').split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith('#')).length;
    }
    function updateCompactHelp(lang=window.MDLxDCCLocale.current()){
      const sl=lang==='sl';
      const mdlTitle=$('mdlHelpSummary');
      if(mdlTitle)mdlTitle.textContent=sl?'O delavcih in načinu MDL×DCC':'About workers and MDL×DCC';
      const code=/^# TSP source: ([a-z]+\d+)$/m.exec($('input')?.value||'')?.[1];
      const entry=code&&window.TripTspLibrary?.get(code);
      if(entry&&$('tspDatasetName'))$('tspDatasetName').textContent=window.TripTspLibrary.label(entry,lang);
      const n=editorStopCount(),details=$('bruteInfoDetails'),summary=$('bruteInfoSummary');
      if(details&&summary){
        const hasInfo=!!String(bruteInfo?.textContent||'').trim();
        details.hidden=!hasInfo||n===0;
        if(!details.hidden)summary.textContent=sl?`Zahtevnost iskanja · ${n} ${n===1?'postanek':'postankov'}`:`Search complexity · ${n} ${n===1?'stop':'stops'}`;
      }
    }
    $('input')?.addEventListener('input',()=>updateCompactHelp());
    if(bruteInfo)new MutationObserver(()=>updateCompactHelp()).observe(bruteInfo,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['data-ui-text']});

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
      updateCompactHelp(lang);
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
