
 // Full-screen, read-only sensor guide. Kept inside the review closure so
 // the values and step label always use the same active timeline as the bars.
 const guide=document.createElement('dialog');
 guide.id='appSolveSensorGuide';guide.setAttribute('data-no-i18n','');
 guide.setAttribute('aria-labelledby','appSensorGuideTitle');
 guide.setAttribute('aria-describedby','appSensorGuideIntro');
 guide.innerHTML='<header class="app-sensor-guide-head"><div><h2 id="appSensorGuideTitle"></h2><p id="appSensorGuidePosition"></p></div><button type="button" id="appSensorGuideClose" autofocus>×</button></header><div class="app-sensor-guide-body" tabindex="0"><p id="appSensorGuideIntro" class="app-sensor-guide-notice"></p><section id="appSensorGuideReading"></section><div id="appSensorGuideCards"></div><p id="appSensorGuideFootnote"></p></div>';
 document.body.append(guide);
 const guideButton=document.createElement('button');
 guideButton.type='button';guideButton.id='appSensorGuideOpen';
 guideButton.setAttribute('aria-haspopup','dialog');guideButton.setAttribute('aria-controls',guide.id);
 guideButton.setAttribute('aria-expanded','false');
 instruments.prepend(guideButton);
 const guideStyle=document.createElement('style');guideStyle.id='app-sensor-guide-style';
 guideStyle.textContent=`
 #appSensorGuideOpen{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-height:32px;margin:0 0 3px;padding:3px 2px 7px;border:0;border-bottom:1px solid #254055;background:transparent;color:#b7d3e8;font:700 .72rem/1.3 system-ui;text-align:left;cursor:pointer;touch-action:manipulation}
 #appSensorGuideOpen:focus-visible,#appSensorGuideClose:focus-visible{outline:2px solid #79efff;outline-offset:2px}
 #appSolveSensorGuide:not([open]){display:none!important}
 #appSolveSensorGuide{position:fixed;inset:0;box-sizing:border-box;width:100%;max-width:none;height:100%;height:100dvh;max-height:none;margin:0;padding:0;border:0;border-radius:0;background:#0b1522;color:#dbe7f4;overflow:hidden;overscroll-behavior:contain;font-family:system-ui,sans-serif;text-align:left;color-scheme:dark}
 #appSolveSensorGuide[open]{display:flex;flex-direction:column}
 #appSolveSensorGuide::backdrop{background:#020812}
 #appSolveSensorGuide *{box-sizing:border-box}
 .app-sensor-guide-head{flex:0 0 auto;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:calc(14px + env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) 12px max(16px,env(safe-area-inset-left,0px));background:#0e1d2c;border-bottom:1px solid #2a4258}
 #appSensorGuideTitle{margin:0;color:#ccebf7;font:800 1.12rem/1.3 system-ui}
 #appSensorGuidePosition{margin:5px 0 0;color:#9eb8ca;font:600 .78rem/1.4 system-ui}
 #appSensorGuideClose{flex:0 0 44px;min-width:44px;min-height:44px;margin:-3px -4px 0 0;padding:0;border:1px solid #3a546a;border-radius:10px;background:#182c3e;color:#edf7ff;font:400 1.8rem/1 system-ui;cursor:pointer;touch-action:manipulation}
 .app-sensor-guide-body{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:18px max(16px,env(safe-area-inset-right,0px)) calc(24px + env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px));scrollbar-gutter:stable}
 .app-sensor-guide-body p{margin:8px 0;font:400 .91rem/1.6 system-ui;overflow-wrap:anywhere;color:#c2d2e0}
 .app-sensor-guide-body h3{margin:0 0 8px;font:750 1rem/1.35 system-ui;color:#e3effa}
 #appSensorGuideIntro{padding:12px 14px;margin:0 0 20px;border-left:3px solid #79cfe3;background:#132637;border-radius:0 8px 8px 0;color:#dfedf5}
 #appSensorGuideReading{margin-bottom:20px}
 #appSensorGuideCards{display:grid;gap:14px}
 .app-sensor-guide-card{padding:15px;border:1px solid #2f475c;border-radius:12px;background:#101f2e}
 .app-sensor-guide-card dl{margin:12px 0 0;display:grid;grid-template-columns:auto 1fr;column-gap:12px;row-gap:8px;font:.88rem/1.5 system-ui}
 .app-sensor-guide-card dt{font-weight:750;color:#cde2ef}
 .app-sensor-guide-card dd{margin:0;color:#baccdc;overflow-wrap:anywhere}
 .app-sensor-guide-value{font-variant-numeric:tabular-nums;color:#93d6e7!important}
 #appSensorGuideFootnote{margin-top:20px;font-size:.81rem;color:#93acbf}
 @media(min-width:640px){.app-sensor-guide-head{padding-left:max(24px,calc((100vw - 760px)/2));padding-right:max(24px,calc((100vw - 760px)/2))}.app-sensor-guide-body>*{max-width:760px;margin-left:auto!important;margin-right:auto!important}}
 `;
 document.head.append(guideStyle);
 const guideCopy={
  sl:{title:'Kaj pomenijo senzorji?',button:'Senzorji · Kaj pomenijo?  ⓘ',close:'Zapri razlago senzorjev',current:'Trenutna vrednost',low:'Nižje',high:'Višje',reading:'Kako jih berem med koraki?',pending:'— · na voljo po vsaj dveh korakih',
   intro:'To niso fizični senzorji telefona in niso ocena inteligence. So izračunani opisni kazalniki strukture zabeleženega reševanja. Višja ali nižja vrednost sama po sebi ne pomeni boljšega reševalca ali težje uganke.',
   readingText:'Puščice in drsnik izberejo korak pregleda. Senzorji povzemajo vse korake od začetka do tega mesta, ne le zadnje poteze ali trenutne mreže. Okno ob odprtju ustavi predvajanje; po zaprtju nadaljuješ na istem mestu. Ob začetku in po prvem koraku je prikaz —, ker je zaporedje prekratko.',
   readingMore:'Najprej poglej, kaj je poteza spremenila: koliko kandidatov je odstranila in katere prisiljene postavitve so na voljo. Nato opazuj spremembo senzorjev skozi več korakov. Primerjaj predvsem dele istega pregleda; kratki odseki, drugačne uganke in drugačni postopki izračuna niso poštena lestvica uspešnosti.',
   footnote:'Vrednosti so opisne hevristike iz sledi te aplikacije, ne neodvisno validiran benchmark. AI uporablja število razpoložljivih prisiljenih postavitev po koraku; človeški pregled uporablja ocenjen porast golih posameznikov. Zato njune kaskadne vrednosti niso neposredno primerljive. Normalizirani LZ vrednosti Cplx in Dens lahko presegata 1; dolžina vrstice je le omejen vizualni prikaz.',
   sensors:{
    cplx:{name:'Cplx · LZ Complexity',text:'LZ kompleksnost zaporedja zmanjšanj števila kandidatov. Zmanjšanja se primerjajo z mediano dotedanjega zaporedja in pretvorijo v binarni vzorec, nato se izmeri njegova normalizirana Lempel–Ziv kompleksnost.',low:'Bolj ponovljiv, lažje opisljiv vzorec zmanjšanj kandidatov.',high:'Manj ponovljiv vzorec. To ni dokaz večje težavnosti ali boljše poteze.'},
    gini:{name:'Gini · Gini Cascade',text:'Ginijev koeficient porazdelitve kaskadnega kazalnika med dotedanjimi koraki. Kaskada je tu praktični kazalnik prisiljenih postavitev, ne izmerjena dolžina rekurzivne verige.',low:'Koraki imajo bolj podobne kaskadne vrednosti. Nič lahko pomeni tudi, da so vse kaskadne vrednosti nič.',high:'Večji del kaskadnega kazalnika je skoncentriran v manjšem številu korakov; ne pomeni, da je vsaka poteza močnejša.'},
    powr:{name:'Powr · Cascade Power',text:'Povprečje produkta kaskadnega kazalnika in zmanjšanja kandidatov v vsakem koraku. Negativna zmanjšanja kandidatov se pri tem štejejo kot nič.',low:'Manjši skupni učinek teh dveh sestavin; lahko je manj kaskad ali manj odstranjenih kandidatov.',high:'Koraki z več prisiljenimi postavitvami so povezani tudi z večjim zmanjšanjem kandidatov. To ni ocena inteligence.'},
    dens:{name:'Dens · Density Flow',text:'LZ kompleksnost zaporedja preostalih kandidatov. Tudi to zaporedje je binarizirano glede na svojo mediano. Meri ponovljivost toka, ne samega števila kandidatov.',low:'Bolj ponovljiv binarni vzorec preostalih kandidatov; pogosto bolj enakomeren potek, ne nujno manj kandidatov.',high:'Manj ponovljiv binarni vzorec. Sama vrednost ne dokazuje, da je položaj gostejši ali težji.'},
    adsr:{name:'ADSR · ADSR Bimodality',text:'Kontekstni kazalnik Attack–Decay–Sustain–Release: delež korakov, pri katerih je kaskadni kazalnik 0 ali vsaj 5. Ime se nanaša na oba skrajna razreda.',low:'Več korakov je v srednjem razredu, s kaskadno vrednostjo od 1 do 4.',high:'Več korakov ima 0 ali vsaj 5. Visoka vrednost lahko nastane tudi samo zaradi ničel; ne dokazuje bimodalnosti in ni sama po sebi boljša.'}
   }},
  en:{title:'What do the sensors mean?',button:'Sensors · What do they mean?  ⓘ',close:'Close sensor guide',current:'Current value',low:'Lower',high:'Higher',reading:'How do I read them during replay?',pending:'— · available after at least two steps',
   intro:'These are not physical phone sensors and not an intelligence score. They are calculated descriptive indicators of the recorded solving structure. Higher or lower does not by itself mean a better solver or a harder puzzle.',
   readingText:'The arrows and slider select a review step. The sensors summarize all steps from the start up to that point, not just the last move or current board. Opening this guide pauses playback; closing it leaves you at the same step. At the start and after the first step, — means the sequence is too short.',
   readingMore:'First inspect what the move changed: how many candidates it removed and which forced placements are available. Then watch the sensors across several steps. Compare sections of the same review first; short samples, different puzzles and different calculations are not a fair performance ranking.',
   footnote:'These are descriptive heuristics from this application’s trace, not an independently validated benchmark. AI uses available forced placements after a step; human review uses the estimated increase in naked singles. Their cascade values are therefore not directly comparable. Normalized LZ values Cplx and Dens can exceed 1; the bars are only a capped visual display.',
   sensors:{
    cplx:{name:'Cplx · LZ Complexity',text:'LZ complexity of the candidate-reduction sequence. Reductions are compared with the sequence median to form a binary pattern, whose normalized Lempel–Ziv complexity is measured.',low:'A more repetitive, more easily described pattern of candidate reductions.',high:'A less repetitive pattern. It does not prove greater difficulty or a better move.'},
    gini:{name:'Gini · Gini Cascade',text:'The Gini coefficient of the cascade indicator across steps so far. Cascade is a practical forced-placement indicator here, not a measured recursive chain depth.',low:'Steps have more similar cascade values. Zero can also mean that all cascade values are zero.',high:'More of the cascade indicator is concentrated in fewer steps; not every move is stronger.'},
    powr:{name:'Powr · Cascade Power',text:'The average of each step’s cascade indicator multiplied by its candidate reduction. Negative candidate reductions are treated as zero.',low:'A smaller combined effect: fewer cascades, fewer candidates removed, or both.',high:'Steps with more forced placements are also associated with larger candidate reductions. This is not an intelligence score.'},
    dens:{name:'Dens · Density Flow',text:'LZ complexity of the remaining-candidate sequence, also binarized against its median. It measures the flow’s repetition, not the actual number of candidates.',low:'A more repetitive binary pattern of remaining candidates; often a more regular flow, not necessarily fewer candidates.',high:'A less repetitive binary pattern. It does not by itself prove a denser or harder position.'},
    adsr:{name:'ADSR · ADSR Bimodality',text:'Attack–Decay–Sustain–Release context indicator: the share of steps whose cascade indicator is zero or at least five. The name refers to these two extreme classes.',low:'More steps in the middle class, with cascade values from one to four.',high:'More steps with zero or at least five. Zeros alone can produce a high value; it neither proves bimodality nor is inherently better.'}
   }}
 };
 let guideOpener=null,guideScrollState=null;
 const copy=()=>guideCopy[sl()?'sl':'en'];
 function guideLabels(){const text=copy();guideButton.textContent=text.button;guideButton.setAttribute('aria-label',text.title);$('appSensorGuideClose').setAttribute('aria-label',text.close);}
 function guideParagraph(parent,text){const p=document.createElement('p');p.textContent=text;parent.append(p);}
 function renderSensorGuide(){
  const text=copy(),timeline=activeTimeline(),index=activeIndex(),steps=timeline?.steps||[],values=reviewSensors(steps,index);
  guideLabels();$('appSensorGuideTitle').textContent=text.title;
  $('appSensorGuidePosition').textContent=(tab==='human'?(sl()?'Človek':'Human'):'AI')+' · '+(sl()?'korak ':'step ')+index+' / '+steps.length;
  $('appSensorGuideIntro').textContent=text.intro;
  const reading=$('appSensorGuideReading');reading.replaceChildren();
  const heading=document.createElement('h3');heading.textContent=text.reading;reading.append(heading);
  guideParagraph(reading,text.readingText);guideParagraph(reading,text.readingMore);
  const cards=$('appSensorGuideCards');cards.replaceChildren();
  for(const [key,d] of Object.entries(text.sensors)){
   const card=document.createElement('section');card.className='app-sensor-guide-card';card.dataset.guideSensor=key;
   const h=document.createElement('h3');h.textContent=d.name;card.append(h);
   const v=document.createElement('p');v.className='app-sensor-guide-value';v.textContent=text.current+': '+(index<2?text.pending:(key==='powr'?values[key].toFixed(1):values[key].toFixed(3)));card.append(v);
   guideParagraph(card,d.text);
   const dl=document.createElement('dl');for(const [label,meaning] of [[text.low,d.low],[text.high,d.high]]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=meaning;dl.append(dt,dd);}card.append(dl);cards.append(card);
  }
  $('appSensorGuideFootnote').textContent=text.footnote;
 }
 function finishSensorGuide(){
  if(guideScrollState){for(const [node,value,priority] of guideScrollState){if(value)node.style.setProperty('overflow',value,priority);else node.style.removeProperty('overflow');}guideScrollState=null;}
  guideButton.setAttribute('aria-expanded','false');
  if(guideOpener?.isConnected&&!instruments.hidden)guideOpener.focus({preventScroll:true});guideOpener=null;
 }
 function closeSensorGuide(){if(guide.open)guide.close();finishSensorGuide();}
 function openSensorGuide(){
  if(instruments.hidden||guide.open)return;
  pause();sensorModal.hidden=true;guideOpener=guideButton;renderSensorGuide();
  guideScrollState=[document.documentElement,document.body].map(node=>[node,node.style.getPropertyValue('overflow'),node.style.getPropertyPriority('overflow')]);
  for(const [node] of guideScrollState)node.style.setProperty('overflow','hidden');
  guide.showModal();guideButton.setAttribute('aria-expanded','true');
  guide.querySelector('.app-sensor-guide-body').scrollTop=0;$('appSensorGuideClose').focus({preventScroll:true});
 }
 guideLabels();
 guideButton.onclick=e=>{e.stopPropagation();openSensorGuide();};
 instruments.addEventListener('click',e=>{if(!e.target.closest('button'))openSensorGuide();});
 $('appSensorGuideClose').onclick=closeSensorGuide;
 guide.addEventListener('cancel',e=>{e.preventDefault();closeSensorGuide();});
 guide.addEventListener('close',finishSensorGuide);
 window.addEventListener('keydown',e=>{if(!guide.open)return;e.stopImmediatePropagation();if(e.key==='Escape'){e.preventDefault();closeSensorGuide();}},true);
 window.addEventListener('sudoku-solve-review-change',e=>{guideLabels();if(!e.detail?.active)closeSensorGuide();});
 // Labels follow language changes even when the review is already open.
 new MutationObserver(()=>{guideLabels();if(guide.open)renderSensorGuide();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
