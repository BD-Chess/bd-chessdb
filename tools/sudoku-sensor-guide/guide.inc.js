 // Full-screen shared instrument guide. Reuses the existing modal boundary so
 // review input guards keep the timeline and the atomic game transaction intact.
 const guideHeader=document.createElement('div');guideHeader.className='app-sensor-guide-header';
 guideHeader.innerHTML='<button type="button" id="appSensorGuideOpen" aria-haspopup="dialog" aria-controls="appSensorGuide"><span id="appSensorGuideLabel"></span><span aria-hidden="true">ⓘ</span></button>';
 instruments.prepend(guideHeader);
 const guide=document.createElement('section');guide.id='appSensorGuide';guide.hidden=true;
 guide.setAttribute('role','dialog');guide.setAttribute('aria-modal','true');guide.setAttribute('aria-labelledby','appSensorGuideTitle');
 guide.innerHTML='<header class="app-guide-head"><h2 id="appSensorGuideTitle"></h2><button type="button" id="appSensorGuideClose">×</button></header><div class="app-guide-body" tabindex="0" role="region" aria-labelledby="appSensorGuideTitle"><p id="appSensorGuideContext" class="app-guide-context"></p><p id="appSensorGuideIntro"></p><p id="appSensorGuideCaution" class="app-guide-caution"></p><div id="appSensorGuideCards"></div><section class="app-guide-reading"><h3 id="appSensorGuideReadingTitle"></h3><p id="appSensorGuideReading"></p><p id="appSensorGuideLimits"></p></section></div>';
 sensorModal.append(guide);
 style.textContent+='\n'+[
  '.app-sensor-guide-header{min-width:0}#appSensorGuideOpen{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-height:36px;padding:5px 2px 7px;border:0;border-bottom:1px solid #20364a;border-radius:0;background:transparent;color:#bcd1e4;font:650 .68rem/1.25 system-ui;text-align:left;cursor:pointer}#appSensorGuideOpen>span:last-child{font-size:1rem;color:#79c8da}',
  '#appSensorGuideOpen:focus-visible,#appSensorGuide button:focus-visible,.app-guide-body:focus-visible{outline:2px solid #79efff;outline-offset:2px}',
  '#appSensorGuide[hidden]{display:none!important}#appSolveSensorModal[data-guide=true]{padding:16px;align-items:center;overscroll-behavior:contain}#appSolveSensorModal[data-guide=true]>.app-sensor-sheet{display:none!important}',
  '#appSensorGuide{display:flex;flex-direction:column;width:min(100%,760px);height:min(880px,calc(100dvh - 32px));max-height:100%;min-height:0;overflow:hidden;border:1px solid #355269;border-radius:16px;background:#0c1724;color:#dbe7f4;box-shadow:0 18px 60px #000b;font:400 .94rem/1.55 system-ui;text-align:left}',
  '.app-guide-head{flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid #294056;background:#0c1724}.app-guide-head h2{margin:0;font:750 1.15rem/1.25 system-ui;color:#dfeef9}#appSensorGuideClose{flex:none;display:grid;place-items:center;width:44px;height:44px;padding:0;border:1px solid #3a5067;border-radius:10px;background:#142435;color:#f0f7ff;font:400 1.65rem/1 system-ui;cursor:pointer}',
  '.app-guide-body{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:4px 18px 22px;scrollbar-gutter:stable}.app-guide-body p{margin:12px 0}.app-guide-context{color:#91b5cb;font-size:.82rem}.app-guide-caution{padding:12px 14px;border-left:3px solid #bca376;background:#192332;color:#ede2cc}.app-guide-card{padding:16px 0;border-bottom:1px solid #294056}.app-guide-card h3,.app-guide-reading h3{margin:0 0 6px;font:750 1rem/1.35 system-ui;color:#c7e8f3}.app-guide-card .app-guide-value{margin:6px 0;color:#a2bdce;font-size:.82rem;font-variant-numeric:tabular-nums}.app-guide-card button{min-height:44px;padding:7px 12px;border:1px solid #3a5067;border-radius:8px;background:#142435;color:#c7e8f3;font:650 .85rem/1.3 system-ui;cursor:pointer}.app-guide-reading{padding:20px 0 2px}.app-guide-reading p{color:#b8c8d8}',
  '@media(max-width:700px),(pointer:coarse){#appSensorGuideOpen{min-height:44px}#appSolveSensorModal[data-guide=true]{padding:0;align-items:stretch}#appSensorGuide{width:100%;height:100%;height:100dvh;max-height:100%;border:0;border-radius:0}.app-guide-head{padding-top:max(10px,env(safe-area-inset-top));padding-right:max(12px,env(safe-area-inset-right));padding-left:max(16px,env(safe-area-inset-left))}.app-guide-body{padding-left:max(18px,env(safe-area-inset-left));padding-right:max(18px,env(safe-area-inset-right));padding-bottom:max(24px,env(safe-area-inset-bottom))}}'
 ].join('\n');
 const guideCopy={
  en:{label:'Sensors · What do they mean?',title:'Understanding the sensors',close:'Close sensor guide',intro:'These five instruments describe the recorded solve path: how candidate counts and forced-move opportunities change. They summarize the steps from the start up to the selected review position, not just the current grid.',caution:'These are structural descriptions, not an intelligence score, an accuracy rating or proof that one solver is better. Higher is not always better; lower is not always better.',readingTitle:'How to read them during a solve',reading:'Use the review arrows or slider to compare nearby steps, then open this guide. Opening pauses playback and freezes the values while you read. The Move, Logic, Candidates and Flow facts below the grid explain what happened at the selected step; these five sensors describe the accumulated path. Closing keeps the same position. Press Play to resume.',limits:'A dash means fewer than two recorded steps, not zero intelligence. Short traces can fluctuate strongly. LZ values can exceed 1 and Powr has no fixed maximum; a full bar is a display limit, not 100% quality. AI counts available forced placements after each step; Human uses the increase in simple naked singles. Missing cascade counts are treated as zero. Their raw values are therefore not a calibrated AI-versus-human ranking.',current:'At this step: ',missing:'— · at least two steps required',details:'Individual explanation',scope:'Recorded path · ',names:['LZ Complexity','Gini Cascade','Cascade Power','Density Flow','ADSR Bimodality'],texts:[
   'Measures repetition in the candidate-reduction sequence, encoded above or below its median. Lower: a more repetitive encoded pattern. Higher: a more varied pattern. It does not measure Sudoku difficulty or the quality of a move.',
   'Measures how unevenly recorded cascade counts are distributed across steps. Here “cascade” is a forced-move count, not the measured length of a complete chain. Lower: more similar counts. Higher: a few steps account for a larger share. Zero can also mean that all counts are zero.',
   'The average of cascade count × candidate reduction, with negative reductions clamped to zero. Lower: less combined forced-move availability and candidate removal. Higher: the two occur together more strongly. It is a descriptive average, not a success rate.',
   'Measures repetition in the sequence of remaining candidate counts, encoded above or below its median. Lower: a more repetitive encoded density pattern. Higher: a more varied pattern. It does not guarantee smooth progress or a better solve.',
   'The share of steps with a recorded cascade count of 0 or at least 5, inspired by Attack–Decay–Sustain–Release. Lower: more steps in the middle range 1–4. Higher: more steps in either extreme. A high value can come entirely from zero-cascade steps; it does not by itself prove bimodality or stronger solving.'
  ]},
  sl:{label:'Senzorji · Kaj pomenijo?',title:'Kaj pomenijo senzorji?',close:'Zapri razlago senzorjev',intro:'Teh pet kazalnikov opisuje zabeleženo pot reševanja: kako se spreminjajo kandidati in možnosti za prisiljene vpise. Povzemajo korake od začetka do izbranega položaja v pregledu, ne le trenutne mreže.',caution:'To so opisi strukture, ne ocena inteligence, pravilnosti ali dokaz, da je en reševalec boljši. Višje ni vedno bolje; nižje ni vedno bolje.',readingTitle:'Kako jih bereš med reševanjem',reading:'S puščicami ali drsnikom primerjaj bližnje korake, nato odpri to razlago. Odpiranje ustavi predvajanje in med branjem ohrani vrednosti. Podatki Poteza, Logika, Kandidati in Tok pod mrežo razložijo izbrani korak; teh pet senzorjev opisuje dotedanjo pot. Po zaprtju ostane isti položaj. Za nadaljevanje pritisni Predvajaj.',limits:'Črtica pomeni manj kot dva zabeležena koraka, ne ničelne inteligence. Kratke sledi lahko močno nihajo. LZ vrednosti lahko presežejo 1, Powr pa nima fiksnega maksimuma; poln trak je meja prikaza, ne 100-odstotna kakovost. AI šteje razpoložljive prisiljene vpise po koraku, Človek pa porast preprostih golih posameznikov. Manjkajoče število kaskad se obravnava kot nič. Vrednosti zato niso umerjena lestvica AI proti človeku.',current:'Pri tem koraku: ',missing:'— · potrebna sta vsaj dva koraka',details:'Posamezna razlaga',scope:'Zabeležena pot · ',names:['LZ kompleksnost','Gini kaskad','Moč kaskade','Tok gostote','ADSR bimodalnost'],texts:[
   'Meri ponavljanje v zaporedju zmanjševanja kandidatov, kodiranem nad ali pod njegovo mediano. Nižje: bolj ponovljiv kodirani vzorec. Višje: bolj raznolik vzorec. Ne meri težavnosti sudokuja ali kakovosti poteze.',
   'Meri neenakomernost zabeleženih kaskad med koraki. »Kaskada« tu pomeni število prisiljenih vpisov, ne izmerjene dolžine celotne verige. Nižje: bolj podobna števila. Višje: nekaj korakov prispeva večji delež. Nič lahko pomeni tudi, da so vsa števila ničelna.',
   'Povprečje produkta število kaskade × zmanjšanje kandidatov; negativno zmanjšanje se šteje kot nič. Nižje: manj skupnega učinka razpoložljivih prisiljenih vpisov in odstranjevanja kandidatov. Višje: močnejše sovpadanje obojega. To je opisno povprečje, ne odstotek uspešnosti.',
   'Meri ponavljanje v zaporedju preostalih kandidatov, kodiranem nad ali pod njegovo mediano. Nižje: bolj ponovljiv kodirani vzorec gostote. Višje: bolj raznolik vzorec. Samo po sebi ne zagotavlja gladkega napredka ali boljšega reševanja.',
   'Delež korakov z zabeleženo kaskado 0 ali vsaj 5, po navdihu Attack–Decay–Sustain–Release. Nižje: več korakov v srednjem območju 1–4. Višje: več korakov na enem ali drugem skrajnem delu. Visoka vrednost lahko nastane samo zaradi ničelnih kaskad; sama ne dokazuje bimodalnosti ali boljšega reševanja.'
  ]}
 };
 let guidePreviousFocus=null,guideInert=[],guideOverflow=null;
 const guideLabel=()=>{$('appSensorGuideLabel').textContent=guideCopy[sl()?'sl':'en'].label;};
 function closeSensorGuide(restoreFocus=true){
  if(sensorModal.dataset.guide!=='true')return;
  sensorModal.hidden=true;guide.hidden=true;delete sensorModal.dataset.guide;
  for(const [node,prior]of guideInert)node.inert=prior;guideInert=[];
  if(guideOverflow){for(const [node,value,priority]of guideOverflow){if(value)node.style.setProperty('overflow',value,priority);else node.style.removeProperty('overflow');}guideOverflow=null;}
  const target=guidePreviousFocus;guidePreviousFocus=null;
  if(restoreFocus&&!instruments.hidden&&target?.isConnected)target.focus({preventScroll:true});
 }
 function openSensorGuide(){
  if(instruments.hidden||sensorModal.dataset.guide==='true')return;
  const copy=guideCopy[sl()?'sl':'en'];guideLabel();guidePreviousFocus=document.activeElement;
  pause();const timeline=activeTimeline(),index=activeIndex(),values=reviewSensors(timeline?.steps||[],index);
  for(const [id,text]of Object.entries({appSensorGuideTitle:copy.title,appSensorGuideIntro:copy.intro,appSensorGuideCaution:copy.caution,appSensorGuideReadingTitle:copy.readingTitle,appSensorGuideReading:copy.reading,appSensorGuideLimits:copy.limits}))$(id).textContent=text;
  $('appSensorGuideClose').setAttribute('aria-label',copy.close);
  $('appSensorGuideContext').textContent=copy.scope+(tab==='human'?(sl()?'Človek':'Human'):'AI')+' · '+index+' / '+(timeline?.steps?.length||0);
  const cards=$('appSensorGuideCards');cards.replaceChildren();
  Object.entries(sensorDefs).forEach(([key,def],i)=>{
   const card=document.createElement('section');card.className='app-guide-card';card.dataset.guideSensor=key;
   const heading=document.createElement('h3');heading.textContent=def.abbr+' — '+copy.names[i];
   const value=document.createElement('p');value.className='app-guide-value';value.textContent=copy.current+(index<2?copy.missing:Number(values[key]||0).toFixed(key==='powr'?1:3));
   const text=document.createElement('p');text.textContent=copy.texts[i];
   const detail=document.createElement('button');detail.type='button';detail.textContent=copy.details+' · '+def.abbr;detail.onclick=()=>{closeSensorGuide(false);openSensor(key);};
   card.append(heading,value,text,detail);cards.append(card);
  });
  guideOverflow=[document.documentElement,document.body].map(node=>[node,node.style.getPropertyValue('overflow'),node.style.getPropertyPriority('overflow')]);
  document.documentElement.style.setProperty('overflow','hidden');document.body.style.setProperty('overflow','hidden');
  guideInert=[...document.body.children].filter(node=>node!==sensorModal&&!['SCRIPT','STYLE','LINK'].includes(node.tagName)).map(node=>[node,node.inert]);
  for(const [node]of guideInert)node.inert=true;
  sensorModal.dataset.guide='true';guide.hidden=false;sensorModal.hidden=false;
  guide.querySelector('.app-guide-body').scrollTop=0;$('appSensorGuideClose').focus({preventScroll:true});
 }
 $('appSensorGuideOpen').onclick=openSensorGuide;$('appSensorGuideClose').onclick=()=>closeSensorGuide();
 instruments.addEventListener('click',event=>{if(event.target===instruments||event.target===guideHeader)openSensorGuide();});
 window.addEventListener('keydown',event=>{
  if(sensorModal.dataset.guide!=='true')return;
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeSensorGuide();return;}
  if(event.key==='Tab'){
   const stops=[...guide.querySelectorAll('button:not([disabled]),[tabindex="0"]')].filter(n=>n.getClientRects().length),first=stops[0],last=stops.at(-1);
   if(event.shiftKey&&(document.activeElement===first||!guide.contains(document.activeElement))){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&(document.activeElement===last||!guide.contains(document.activeElement))){event.preventDefault();first?.focus();}
  }
 },true);
 document.addEventListener('focusin',event=>{if(sensorModal.dataset.guide==='true'&&!guide.contains(event.target))$('appSensorGuideClose').focus({preventScroll:true});},true);
 new MutationObserver(()=>{if(sensorModal.hidden)closeSensorGuide();}).observe(sensorModal,{attributes:true,attributeFilter:['hidden']});
 window.addEventListener('sudoku-solve-review-change',event=>{guideLabel();if(event.detail?.active===false)closeSensorGuide(false);});
 guideLabel();
