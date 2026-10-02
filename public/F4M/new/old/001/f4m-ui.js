/* Flip4M Lab 2.1.0. V2 board, animations, help and translation foundation retained.
 * New controller: isolated clocks, paired experiments, policy reports and resumable journal.
 */
(()=>{'use strict';
const E=window.F4M,S=window.F4MSearch,T=window.F4MTime,B=window.F4MSim,Store=window.F4MStore,$=id=>document.getElementById(id);
const VERSION='2.1.1',PREF='flip4m.lab.2.1.preferences';
const EN={about:'About',original:'Original',tagline:'Connect four. One move changes everything.',how:'How to play?',left:'Turn left',right:'Turn right',magnet:'Magnet',undo:'↶ Undo',hint:'✦ Hint',pause:'Ⅱ Pause',resume:'▶ Continue',new:'＋ New game',yourGame:'Your game',local:'LOCAL',opponent:'Opponent',cpu:'Play against AI',pvp:'Two players',demo:'AI vs AI',tools:'Rules / tools per player',classic:'Classic · no tools',magnetic:'Flip4M · 2 flips + 2 magnets',pro:'Pro · 3 flips + 3 magnets',difficulty:'AI strength',beginner:'Beginner',casual:'Casual',strong:'Challenge',master:'Master',first:'First move',you:'You',style:'DCC style',balanced:'Balanced',defensive:'Defensive',aggressive:'Aggressive',start:'Start a new game →',settingsNote:'Rules and players change when you start a new game. AI strength can change during play.',analysis:'Under the hood · AI & DCC',dcc:'DCC · experimental re-ranking',dccNote:'Enable to compare rotation resilience and resource use at near-equal scores; the DCC style then becomes available. It cannot override a calculated win or tactical safety.',depth:'Depth',nodes:'Nodes',time:'Time',history:'History & saves',save:'Export JSON',load:'Import JSON',note:'Start without tools. Once you know connect four, add rotations and magnets — the same board, a whole new depth.',privacy:'No account. No API. Everything stays in your browser.',receipt:'Release record',play:'Let’s play →',rematch:'Play again',red:'Red',yellow:'Yellow',turn:'to move',thinking:'AI is thinking',paused:'Paused',review:'Review',choose:'Select a lane on the board.',chooseMag:'Select a rim slot. One magnet token per action.',watch:'Watching AI vs AI. Pause to inspect.',move:'Move',grav:'Board gravity',flips:'Flips',magnets:'Magnets',win:'wins!',draw:'Draw',full:'Board full',line:'Four connected',saved:'Saved automatically on this device.',storage:'Local saving unavailable. Export JSON to keep this game.',restored:'Game restored. Press Continue to resume.',newConfirm:'Start a new game? Export JSON first to keep the current game.',invalid:'The file could not be loaded',loaded:'Game imported. Press Continue to resume.',exported:'Game exported, including history and archived variations.',hintLabel:'Hint',calcWin:'immediate win',searched:'completed search',fallback:'bounded fallback',noMoves:'No legal moves.',error:'AI stopped safely. Press Continue to retry.',slow:'AI exceeded its limit and was stopped. Press Continue to retry.',working:'Searching',complete:'completed',safe:'One-move safety checked',incomplete:'Safety scan incomplete',dccChanged:'DCC changed the near-equal choice',dccSame:'DCC kept the search choice',workerFallback:'Worker unavailable: reduced search',top:'top',rightSide:'right',bottom:'bottom',leftSide:'left',drop:'Drop',flip:'Turn',position:'Position',branch:'Later positions have been retained as an archived variation in JSON.',reviewNote:'History view. Continue to play from this position.',toolOff:'This game has no tools. Select Flip4M or Pro and start a new game.',expire:'remaining turns',remove:'removes opposing magnet',refresh:'refreshes this magnet',place:'places a magnet',wins:'winning line',square:'Square'};
const SL={about:'O igri',original:'Izvirnik',tagline:'Štiri v vrsto. Ena poteza spremeni vse.',how:'Kako igrati?',left:'Obrni levo',right:'Obrni desno',magnet:'Magnet',undo:'↶ Razveljavi',hint:'✦ Namig',pause:'Ⅱ Premor',resume:'▶ Nadaljuj',new:'＋ Nova igra',yourGame:'Tvoja igra',local:'LOKALNO',opponent:'Nasprotnik',cpu:'Igraj proti AI',pvp:'Dva igralca',demo:'AI proti AI',tools:'Pravila / orodja na igralca',classic:'Klasika · brez orodij',magnetic:'Flip4M · 2 obrata + 2 magneta',pro:'Pro · 3 obrati + 3 magneti',difficulty:'Moč AI',beginner:'Začetnik',casual:'Sproščeno',strong:'Izziv',master:'Mojster',first:'Začne',you:'Ti',style:'Slog DCC',balanced:'Uravnotežen',defensive:'Obramben',aggressive:'Napadalen',start:'Začni novo igro →',settingsNote:'Pravila in igralci se spremenijo šele z novo igro. Moč AI lahko spremeniš med igro.',analysis:'Pod pokrovom · AI in DCC',dcc:'DCC · eksperimentalno razvrščanje',dccNote:'Vključi za primerjavo odpornosti na obrat in porabe orodij pri skoraj enakih ocenah; takrat postane na voljo tudi slog DCC. Ne sme preglasiti izračunane zmage ali taktične varnosti.',depth:'Globina',nodes:'Vozlišča',time:'Čas',history:'Zgodovina in shranjevanje',save:'Izvozi JSON',load:'Uvozi JSON',note:'Začni brez orodij. Ko obvladaš štiri v vrsto, vključi rotacije in magnete — ista plošča, povsem nova globina.',privacy:'Brez računa. Brez API-ja. Vse ostane v tvojem brskalniku.',receipt:'Zapis izdaje',play:'Igrajmo →',rematch:'Še ena igra',red:'Rdeči',yellow:'Rumeni',turn:'na potezi',thinking:'AI razmišlja',paused:'Premor',review:'Pregled',choose:'Izberi stolpec na plošči.',chooseMag:'Izberi mesto na robu. Poteza stane en magnet.',watch:'Igra AI proti AI. Za pregled pritisni Premor.',move:'Poteza',grav:'Gravitacija plošče',flips:'Obrati',magnets:'Magneti',win:'zmaga!',draw:'Remi',full:'Plošča je polna',line:'Štiri v vrsto',saved:'Samodejno shranjeno na tej napravi.',storage:'Lokalno shranjevanje ni na voljo. Za ohranitev igre izvozi JSON.',restored:'Igra je obnovljena. Za nadaljevanje pritisni Nadaljuj.',newConfirm:'Začnem novo igro? Za ohranitev trenutne igre jo prej izvozi v JSON.',invalid:'Datoteke ni bilo mogoče uvoziti',loaded:'Igra je uvožena. Za nadaljevanje pritisni Nadaljuj.',exported:'Igra je izvožena z zgodovino in arhiviranimi različicami.',hintLabel:'Namig',calcWin:'takojšnja zmaga',searched:'zaključeno iskanje',fallback:'časovno omejena rezervna izbira',noMoves:'Ni dovoljenih potez.',error:'AI se je varno ustavil. Pritisni Nadaljuj za nov poskus.',slow:'AI je presegel omejitev in je ustavljen. Pritisni Nadaljuj za nov poskus.',working:'Iskanje',complete:'zaključeno',safe:'Preverjena varnost pred takojšnjim porazom',incomplete:'Preverjanje varnosti ni zaključeno',dccChanged:'DCC je spremenil skoraj enakovredno izbiro',dccSame:'DCC je ohranil izbiro iskanja',workerFallback:'Worker ni voljo: skrajšano iskanje',top:'zgoraj',rightSide:'desno',bottom:'spodaj',leftSide:'levo',drop:'Spusti',flip:'Obrni',position:'Pozicija',branch:'Poznejše poteze so ohranjene kot arhivirana različica v JSON.',reviewNote:'Pregled zgodovine. Nadaljuj za igro od te pozicije.',toolOff:'Ta igra je brez orodij. Izberi Flip4M ali Pro in začni novo igro.',expire:'preostale poteze',remove:'odstrani nasprotnikov magnet',refresh:'obnovi ta magnet',place:'postavi magnet',wins:'zmagovalna vrsta',square:'Polje'};

Object.assign(EN,{stressSeeds:'Seeded · rotations & magnets',previewGame:'Game v2',engine:'Opponent engine',timeSettings:'Clocks & displays',showTimers:'Show player clocks',showStamps:'Show move timestamps',timeControl:'Time per player',custom:'Custom',seconds:'Seconds',increment:'Increment (s)',clockNote:'Animations and pauses do not cost time. Sim has no match clock limit.',compare:'Compare this position',sensors:'DCC sensors / ablation',guard:'Safety band (F4M points)',depthStability:'Stability across depths',experiments:'Sim · experiments & results',resumeBatch:'Resume Sim',backToPlay:'Back to my game',batchEvidence:'These are policy experiments. Repeated starts are not independent evidence.',bookmark:'Export position',simIntro:'Same physics, search and funded report. Different move selection.',redEngine:'Red engine',yellowEngine:'Yellow engine',swap:'⇄ Swap engines',simStartAt:'Starting position',current:'Current position',seeded:'Seeded opening positions',empty:'Empty board',simLength:'Experiment length',single:'Single game',onePair:'Pair · engines swap colors',computeMode:'Computation budget',workMode:'Reproducible · state transitions',timeMode:'Time per decision',workUnits:'State transitions',milliseconds:'Milliseconds',presentation:'Presentation',watchMode:'Watch · animations',fastMode:'Fast · no animations',simNote:'Sim never loses on time. The budget limits one analysis. Both policies observe the same analyzer and sensors. Fast mode does not alter compute.',startSim:'Start Sim →',timeout:'Time expired',sameChoice:'Same choice',differentChoice:'Different choice',rawGap:'Raw gap',inspecting:'Inspecting last decision',currentAnalysis:'Current position',noAnalysis:'No position analyzed yet.',noBatch:'No experiment yet. Open Sim to start.',pausedBatch:'Experiment paused; Resume Sim continues its checkpoint.',batchFinished:'Experiment complete',progressGames:'Completed / planned',winsLabel:'DCC / Classical / draws',uniquePairs:'Unique complete opening pairs',redYellow:'Red / Yellow wins',noCI:'At least 5 unique complete pairs are required for the descriptive bootstrap interval.',ci:'95% paired-start bootstrap interval',meanCompute:'Mean computation',toolsUsed:'Flips / magnets',analysisNote:'Raw scores are F4M heuristic points, not chess centipawns. DCC ranks are separate preferences.',safetyGap:'DCC retained raw choice: incomplete or incomparable measurements.',selection:'Selected',exportNote:'Export includes checkpoint, all moves and analysis provenance.',newBatchConfirm:'Start another experiment? Export the current Sim first to retain it separately.',loading:'Restoring checkpoint…',importOK:'Imported and paused. Continue when ready.',storeIdb:'Checkpoint saved locally (IndexedDB).',storeLocal:'Checkpoint saved locally (fallback).',returnNote:'Your previous game is restored and paused.',timedHint:'Analysis pauses the game clock.',seedNote:'The opening seed diversifies starts; moves are deterministic in work mode.',dccNote:'DCC ranks the same candidates within the safety band, using complete physical measurements. Partial data retains the raw policy.',settingsNote:'Rules, clocks and players apply to a new game. Analysis controls pause any running experiment.',workLabel:'Work',statusComplete:'complete',statusUnknown:'unknown',statusPartial:'partial',noManualSim:'Pause Sim to inspect; use Back to my game for manual play.',batchReplace:'Current game is retained behind Back to my game.',sourceNote:'Rules: production v2 · policies: Lab 2.1'});
Object.assign(SL,{stressSeeds:'Seed · rotacije in magneti',previewGame:'Igra v2',engine:'Nasprotnikov motor',timeSettings:'Časi in prikazi',showTimers:'Prikaži uri igralcev',showStamps:'Prikaži časovne oznake potez',timeControl:'Čas na igralca',custom:'Po meri',seconds:'Sekunde',increment:'Dodatek (s)',clockNote:'Animacije in premor ne porabljajo časa. Sim nima časovne omejitve partije.',compare:'Primerjaj ta položaj',sensors:'DCC senzorji / ablation',guard:'Varnostni pas (F4M točke)',depthStability:'Stabilnost med globinami',experiments:'Sim · poskusi in rezultati',resumeBatch:'Nadaljuj Sim',backToPlay:'Nazaj v mojo igro',batchEvidence:'To so poskusi politik. Ponovitve iste pozicije niso neodvisni dokazi.',bookmark:'Izvozi pozicijo',simIntro:'Ista fizika, iskanje in financirano poročilo. Drugačna izbira poteze.',redEngine:'Rdeči motor',yellowEngine:'Rumeni motor',swap:'⇄ Zamenjaj motorja',simStartAt:'Začetna pozicija',current:'Trenutna pozicija',seeded:'Začetne pozicije iz seeda',empty:'Prazna plošča',simLength:'Dolžina poskusa',single:'Ena igra',onePair:'Par · zamenjani barvi motorjev',computeMode:'Računski proračun',workMode:'Ponovljivo · število prehodov',timeMode:'Čas na odločitev',workUnits:'Prehodi stanja',milliseconds:'Milisekunde',presentation:'Prikaz',watchMode:'Gledanje · animacije',fastMode:'Hitro · brez animacij',simNote:'Sim ne izgublja na čas. Proračun omejuje posamezno analizo. Obe politiki opazujeta isti analizator in senzorje. Hiter prikaz ne spremeni računskega proračuna.',startSim:'Začni Sim →',timeout:'Čas je potekel',sameChoice:'Ista izbira',differentChoice:'Različna izbira',rawGap:'Razlika surove ocene',inspecting:'Zadnja odločitev',currentAnalysis:'Trenutna pozicija',noAnalysis:'Pozicija še ni analizirana.',noBatch:'Ni poskusa. Odpri Sim za začetek.',pausedBatch:'Poskus je ustavljen; Nadaljuj Sim obnovi shranjeno stanje.',batchFinished:'Poskus je končan',progressGames:'Končane / načrtovane igre',winsLabel:'DCC / Classical / remi',uniquePairs:'Različni dokončani začetni pari',redYellow:'Zmage rdečih / rumenih',noCI:'Za opisni bootstrap interval je potrebnih vsaj 5 različnih dokončanih parov.',ci:'95 % bootstrap interval po začetnih parih',meanCompute:'Povprečno računanje',toolsUsed:'Obrati / magneti',analysisNote:'Surove ocene so hevristične točke F4M, ne šahovski centipioni. DCC rang je ločena preferenca.',safetyGap:'DCC je ohranil osnovno izbiro: meritve niso dokončane ali primerljive.',selection:'Izbira',exportNote:'Izvoz vključuje stanje, vse poteze in izvor analiz.',newBatchConfirm:'Začnem drug poskus? Za ločeno ohranitev prejšnjega Sima ga prej izvozi.',loading:'Obnavljam stanje …',importOK:'Uvoženo in ustavljeno. Nadaljuj, ko želiš.',storeIdb:'Stanje je shranjeno lokalno (IndexedDB).',storeLocal:'Stanje je shranjeno lokalno (rezervni način).',returnNote:'Tvoja prejšnja igra je obnovljena in ustavljena.',timedHint:'Analiza ustavi igralno uro.',seedNote:'Seed razprši začetne pozicije; način s prehodi je determinističen.',dccNote:'DCC razvrsti iste kandidate znotraj varnostnega pasu na podlagi dokončanih fizičnih meritev. Pri nepopolnih podatkih ohrani osnovno izbiro.',settingsNote:'Pravila, ure in igralci veljajo za novo igro. Sprememba analize ustavi tekoči poskus.',workLabel:'Delo',statusComplete:'dokončano',statusUnknown:'neznano',statusPartial:'delno',noManualSim:'Ustavi Sim za pregled; za ročno igro izberi Nazaj v mojo igro.',batchReplace:'Trenutna igra ostane shranjena pod Nazaj v mojo igro.',sourceNote:'Pravila: produkcija v2 · politike: Lab 2.1'});
Object.assign(SL,{grandmaster:'Velemojster · 1 min',champion:'Prvak · 2 min',
 longThinkNote:'Velemojster: 60 s; Prvak: 120 s na odločitev. Motor poglablja iskanje; ob dokazanem izidu lahko konča prej. Premor prekine računanje.',
 budgetTime:'Časovni proračun',stopReason:'Razlog konca',searchingDepth:'Računam globino'});
Object.assign(EN,{grandmaster:'Grandmaster · 1 min',champion:'Champion · 2 min',
 longThinkNote:'Grandmaster: 60 s; Champion: 120 s per decision. Search keeps deepening; a proven result may finish early. Pause cancels computation.',
 budgetTime:'Time budget',stopReason:'Stop reason',searchingDepth:'Searching depth'});
let searchRuntime=null;
let prefs={lang:'sl',theme:'dark',mode:'cpu',tools:'2',difficulty:'casual',first:'human',cpuEngine:'classical',showTimers:false,showTimestamps:false,timeControl:'0',customSeconds:300,customIncrement:3,guard:'12',sensorGs:true,sensorMr:true,sensorThrift:true,sensorPath:true};
try{const x=JSON.parse(localStorage.getItem(PREF)||'null');if(x&&typeof x==='object')Object.assign(prefs,x);}catch(_){}
prefs.lang=prefs.lang==='en'?'en':'sl';prefs.theme=prefs.theme==='light'?'light':'dark';
const selectPrefs=['mode','tools','difficulty','first','cpuEngine','timeControl','guard'];
const checkPrefs=['showTimers','showTimestamps','sensorGs','sensorMr','sensorThrift','sensorPath'];
for(const k of selectPrefs){if([...$(k).options].some(o=>o.value===String(prefs[k])))$(k).value=String(prefs[k]);else prefs[k]=$(k).value;}
for(const k of checkPrefs)$(k).checked=!!prefs[k];
$('customSeconds').value=String(prefs.customSeconds);$('customIncrement').value=String(prefs.customIncrement);
let game={mode:'cpu',human:1,tools:2,engine:'classical'},states=[E.create(2)],moves=[],archived=[],records=[],clocks=[],cursor=0;
let timer=T.create(),timeout=null,paused=true,animating=false,thinking=false,magMode=false,worker=null,workerURL=null,job=0,animationEpoch=0,watchdog=null,searchClock=null,nextTimer=null,presentationTimer=null;
let lastStats=null,lastHint=null,angle=0,batch=null,pastBatches=[],backup=null,inSimulation=false,simDisplay='watch',loading=true,saveSerial=0;
const now=()=>performance.now(),state=()=>states[cursor],t=k=>(prefs.lang==='sl'?SL:EN)[k]||k,color=p=>t(p===1?'red':'yellow');
const policy=p=>game.mode==='pvp'?'human':game.mode==='demo'?(game.policies?.[p]||'classical'):p===game.human?'human':game.engine||'classical';
const label=p=>p==='human'?t('you'):p==='dcc'?'AI + DCC':'Classical AI';
const name=p=>game.mode==='pvp'?color(p):label(policy(p));
const finished=()=>state().result||(timeout?.cursor===cursor?timeout.winner:0);
const isCPU=()=>policy(state().curPlayer)!=='human';
const canPlay=()=>!loading&&!inSimulation&&!paused&&!animating&&!thinking&&!finished()&&!isCPU();
const message=txt=>{$('feedback').textContent=txt;};
const sideName=s=>t(['top','rightSide','bottom','leftSide'][s]);
function fmt(a){return !a?'—':a.type==='drop'?t('drop')+' '+(a.col+1):a.type==='flip'?t('flip')+' '+(a.delta===1?'↶':'↷'):t('magnet')+' '+sideName(a.side)+' '+(a.idx+1);}
function dccConfig(){return {guard:Number(prefs.guard),gs:!!prefs.sensorGs,mr:!!prefs.sensorMr,thrift:!!prefs.sensorThrift,path:!!prefs.sensorPath};}
function preferences(){for(const k of selectPrefs)prefs[k]=$(k).value;for(const k of checkPrefs)prefs[k]=$(k).checked;
 prefs.customSeconds=Math.max(1,Math.min(86400,Number($('customSeconds').value)||300));prefs.customIncrement=Math.max(0,Math.min(3600,Number($('customIncrement').value)||0));$('customTime').hidden=prefs.timeControl!=='custom';
 try{localStorage.setItem(PREF,JSON.stringify(prefs));}catch(_){}
}
function clockOptions(){const v=prefs.timeControl;return v==='custom'?{seconds:prefs.customSeconds,increment:prefs.customIncrement}:v==='182'?{seconds:180,increment:2}:v==='303'?{seconds:300,increment:3}:v==='600'?{seconds:600,increment:0}:{seconds:0,increment:0};}
function session(){return {game,states,moves,archived,records,clocks,cursor,timeout,clock:T.snapshot(timer,now())};}
function envelope(){return {format:'flip4m.lab.session',schema:1,engine:VERSION,rules:E.RULES,...session(),settings:prefs,batch,pastBatches,backup,inSimulation,simDisplay,savedAt:new Date().toISOString()};}
function persist(){if(loading)return;const serial=++saveSerial;Store.write(envelope()).then(status=>{if(serial===saveSerial)$('saveStatus').textContent=t(status==='indexeddb'?'storeIdb':status==='localstorage'?'storeLocal':'storage');});}
function stopWork(){searchRuntime=null;job++;animationEpoch++;if(worker){worker.terminate();worker=null;}if(workerURL){URL.revokeObjectURL(workerURL);workerURL=null;}clearTimeout(watchdog);clearInterval(searchClock);clearTimeout(nextTimer);clearTimeout(presentationTimer);T.pause(timer,now());thinking=false;animating=false;$('searchBar').style.width='0%';}
function pauseAll(note=''){stopWork();paused=true;if(inSimulation&&batch)B.stop(batch);setAngle(-state().gravityDir*90);render();persist();if(note)message(note);}
function translate(){document.documentElement.lang=prefs.lang;document.documentElement.dataset.theme=prefs.theme;for(const el of document.querySelectorAll('[data-i18n]'))el.textContent=t(el.dataset.i18n);$('lang').textContent=prefs.lang==='sl'?'EN':'SL';document.title='Flip4M Lab — Classical AI × AI+DCC';helpText();render();showStats(lastStats);renderBatch();}
function helpText(){
 const rows=prefs.lang==='sl'?[
 ['01 · Poveži štiri','Zmaga prva zaznana četverica iste barve: vodoravno, navpično ali diagonalno. Klikni ploščo; ob miški se prikaže mesto pristanka. Rdeči vedno začne.'],
 ['02 · Obrni svet','↶ in ↷ zavrtita ploščo za 90°. Vse nepripete figure se znova posedejo. Obrat porabi eno orodje in celotno potezo — po obratu ne dodajaš še figure.'],
 ['03 · Magneti','Vključi Magnet, nato izberi mesto na robu. Magnet privleče najbližjo figuro v svoji vrsti ali stolpcu, ne glede na njeno barvo, in jo drži na robu. Nasprotni magnet drugega igralca se s to potezo odstrani namesto postavitve novega.'],
 ['04 · Čas je del taktike','Magnet ima šest potez življenjske dobe, vključno s potezo postavitve. Število na robu kaže preostanek. Po izteku se sproščene figure premaknejo ob naslednjem posedanju, tako kot v izvirni igri. Obnovitev lastnega magneta prav tako stane potezo in orodje.'],
 ['05 · Začni preprosto','Klasika je brez orodij. Flip4M daje vsakemu igralcu dva obrata in dva magneta; Pro po tri. Moč AI izbereš neodvisno. Premor ustavi tudi računanje AI. Zgodovina omogoča pregled in nadaljevanje od izbrane pozicije.']]:[
 ['01 · Connect four','The first detected line of four of one color wins: horizontal, vertical or diagonal. Select a lane on the board; pointer hover previews the landing. Red always starts.'],
 ['02 · Turn the world','↶ and ↷ rotate the board 90°. Every unpinned token settles again. A rotation costs one flip token and your entire turn — you do not also drop a piece.'],
 ['03 · Magnets','Select Magnet, then a rim slot. A magnet pulls the nearest token in its row or column, regardless of color, and holds it on the rim. If the opposite rim has an opponent’s magnet, the action removes that magnet instead of placing a new one.'],
 ['04 · Timing is a tactic','Magnets last six turns, including placement. Rim numbers show turns remaining. An expired magnet releases its token at the next settlement, matching the original game. Refreshing your own magnet also costs a turn and a magnet token.'],
 ['05 · Start simple','Classic has no tools. Flip4M gives each player two flips and two magnets; Pro gives three of each. Choose AI strength independently. Pause stops AI computation too. History supports inspection and continuation from an earlier position.']];
 $('helpText').replaceChildren();for(const [title,body] of rows){const h=document.createElement('h3'),p=document.createElement('p');h.textContent=title;p.textContent=body;$('helpText').append(h,p);}
 const d=document.createElement('details'),su=document.createElement('summary'),p=document.createElement('p');su.textContent=prefs.lang==='sl'?'Združljivost pravil in tipkovnica':'Rule compatibility & keyboard';
 p.textContent=prefs.lang==='sl'?'Ohranjeno iz produkcije: ob sočasnih četvericah odloča prvi zadetek pri pregledu od zgoraj levo; polna plošča brez zmage je remi. Magnetna polja se obdelajo zgoraj, spodaj, levo, desno. Vstop figure uporablja prvo prazno mesto v smeri gravitacije, tudi za pripeto robno figuro. Tipke 1–8 izbirajo vidni stolpec, Q/E obračata, M izbere magnet, U razveljavi, H poišče namig, preslednica ustavi/nadaljuje. DCC je eksperimentalna politika; rezultati igranja niso dokaz zavesti.':'Preserved from production: simultaneous lines use the first match in the top-left scan; a full board without a win is a draw. Magnet fields are processed top, bottom, left, right. Entry uses the first empty slot along gravity, even behind a pinned edge token. Keys 1–8 choose the visible lane; Q/E rotate, M selects magnets, U undoes, H requests a hint, Space pauses/resumes. DCC is an experimental policy; game performance is not proof of consciousness.';
 d.append(su,p);$('helpText').append(d);
}
function setAngle(deg,animate=false){angle=deg;$('rotor').style.transition=animate?'':'none';document.documentElement.style.setProperty('--angle',deg+'deg');}
const cells=[];
for(let r=0;r<8;r++)for(let c=0;c<8;c++){
 const b=document.createElement('button');b.className='cell';b.dataset.r=r;b.dataset.c=c;
 b.addEventListener('click',()=>{if(canPlay()&&!magMode)play({type:'drop',col:state().gravityDir%2?r:c});});
 b.addEventListener('pointerenter',()=>{if(canPlay()&&!magMode)preview({type:'drop',col:state().gravityDir%2?r:c});});
 b.addEventListener('focus',()=>{if(canPlay()&&!magMode)preview({type:'drop',col:state().gravityDir%2?r:c});});
 $('matrix').append(b);cells.push(b);
}
$('arena').addEventListener('pointerleave',()=>{if(!lastHint)$('ghost').replaceChildren();});
const rim=[];
for(let side=0;side<4;side++)for(let idx=0;idx<8;idx++){
 const b=document.createElement('button');b.className='mag-slot';b.dataset.side=side;b.dataset.idx=idx;b.append(document.createElement('span'));
 const along=1.25+idx*12.5;
 if(side===0||side===2){b.style.left=along+'%';b.style[side===0?'top':'bottom']='-9%';}
 else{b.style.top=along+'%';b.style[side===1?'right':'left']='-9%';b.style.width='7%';b.style.height='10%';}
 b.addEventListener('click',()=>{if(canPlay()&&magMode)play({type:'magnet',side,idx});});
 $('rim').append(b);rim.push(b);
}
function piece(p,r,c,ghost=false){const el=document.createElement('div');el.className='piece p'+p+(ghost?' ghost':'');el.style.top=r*12.5+'%';el.style.left=c*12.5+'%';const disc=document.createElement('div');disc.className='disc';el.append(disc);return el;}
function preview(a){try{if(!E.validMove(state(),a))return;const v=E.action(state(),a,true),p=v.paths[v.paths.length-1];$('ghost').replaceChildren();if(a.type==='drop')$('ghost').append(piece(p.p,p.toR,p.toC,true));}catch(_){} }
function clearHint(){lastHint=null;document.querySelectorAll('.hint-flash').forEach(e=>e.classList.remove('hint-flash'));$('ghost').replaceChildren();}
function render(paths=null){
 const s=state(),end=finished();$('arena').classList.toggle('magnet-mode',magMode);
 for(const p of [1,2]){$('name'+p).textContent=name(p);$('player'+p).classList.toggle('active',!end&&s.curPlayer===p);$('resources'+p).textContent='↶ '+s.tokens[p].flip+'  ·  ⊓ '+s.tokens[p].mag;}
 updateStatus();
 if(!animating||paths){$('pieces').replaceChildren();$('ghost').replaceChildren();if(paths){for(const v of paths)$('pieces').append(piece(v.p,v.r,v.c));}else for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(s.grid[r][c])$('pieces').append(piece(s.grid[r][c],r,c));}
 const wins=E.winningLines(s.grid).filter(l=>l.p===s.result).flatMap(l=>l.cells.map(([r,c])=>r*8+c));
 for(let i=0;i<64;i++){const b=cells[i],r=i>>3,c=i%8;b.disabled=!canPlay()||magMode;b.classList.toggle('winning',wins.includes(i));b.setAttribute('aria-label',t('square')+' '+(r+1)+', '+(c+1)+(s.grid[r][c]?' · '+color(s.grid[r][c]):''));}
 for(const b of rim){const side=+b.dataset.side,idx=+b.dataset.idx,m=s.mag[E.SIDES[side]][idx],op=s.mag[E.SIDES[(side+2)%4]][idx];b.className='mag-slot '+(m?'owned'+m.p:'empty')+(m?.life===1?' expiring':'');b.firstChild.textContent=m?m.life:'·';b.disabled=!canPlay()||!magMode||s.tokens[s.curPlayer].mag<=0;b.setAttribute('aria-label',t('magnet')+' '+sideName(side)+' '+(idx+1)+(m?' · '+color(m.p)+' · '+m.life+' '+t('expire'):'')+' · '+(op&&op.p!==s.curPlayer?t('remove'):m?.p===s.curPlayer?t('refresh'):t('place')));b.title=b.getAttribute('aria-label');}
 for(const id of ['flipLeft','flipRight'])$(id).disabled=!canPlay()||s.tokens[s.curPlayer].flip<=0;
 $('magnet').disabled=!canPlay()||s.tokens[s.curPlayer].mag<=0;$('magnet').classList.toggle('selected',magMode);$('magnet').setAttribute('aria-pressed',String(magMode));
 $('undo').disabled=loading||cursor===0||inSimulation;$('hint').disabled=loading||animating||!!end;$('compare').disabled=loading||animating||!!end;
 $('pause').disabled=loading||(!inSimulation&&!!end);$('pause').textContent=t(paused?'resume':'pause');
 $('instruction').textContent=inSimulation?t('watch'):magMode?t('chooseMag'):t('choose');$('ply').textContent=t('move')+' '+(s.ply||cursor);
 $('outcome').hidden=!end||animating;if(end){$('outcomeTitle').textContent=end===3?t('draw'):name(end)+' '+t('win');$('outcomeText').textContent=t(timeout?.cursor===cursor?'timeout':end===3?'full':'line');}
 $('historyCount').textContent=cursor+' / '+(states.length-1);$('prev').disabled=cursor===0||loading;$('next').disabled=cursor===states.length-1||loading;
 $('moveList').replaceChildren();states.forEach((_,i)=>{const b=document.createElement('button');b.textContent=i===0?'0':i+' · '+fmt(moves[i-1]);b.classList.toggle('current',cursor===i);b.onclick=()=>navigate(i);if(prefs.showTimestamps&&records[i-1]?.atUTC){const el=document.createElement('time');el.dateTime=records[i-1].atUTC;el.textContent=new Date(el.dateTime).toLocaleTimeString();el.title=el.dateTime;b.append(el);}$('moveList').append(b);});
 renderClocks();
}
function updateStatus(){const end=finished();$('status').textContent=loading?t('loading'):end?(end===3?t('draw'):name(end)+' '+t('win')):thinking?t('thinking')+'…':paused?t(cursor<states.length-1?'review':'paused'):name(state().curPlayer)+' · '+t('turn');$('gravity').textContent=t('grav')+' '+['↓','←','↑','→'][state().gravityDir];}
function renderClocks(){
 if(loading)return;T.tick(timer,now());
 for(const p of [1,2]){const el=$('clock'+p);el.hidden=!prefs.showTimers;el.textContent=T.format(timer.mode==='countdown'?timer.remaining[p]:timer.used[p]);el.classList.toggle('timeout-clock',timer.flagged===p);}
 if(timer.flagged&&!finished()&&!inSimulation){timeout={cursor,winner:3-timer.flagged,reason:'timeout',atUTC:new Date().toISOString()};pauseAll(t('timeout'));}
}
function showStats(bundle){
 const panel=$('decision');panel.replaceChildren();$('candidates').replaceChildren();$('sensorDetails').textContent='';
 if(!bundle){panel.textContent=t('noAnalysis');return;}
 const r=bundle.report,a=bundle.classical.selected,b=bundle.dcc.selected;
 const h=document.createElement('small');h.textContent=(r.stateKey===E.key(state())?t('currentAnalysis'):t('inspecting'))+' · '+B.fingerprint(r.stateKey)+' · '+color(r.rootPlayer);panel.append(h);
 for(const [label,c] of [['Classical AI',a],['AI + DCC',b]]){const row=document.createElement('div');row.textContent=label+': '+fmt(c?.move)+' · '+(c?Math.round(c.score):'—');panel.append(row);}
 const note=document.createElement('small');note.textContent=(bundle.dcc.changed?t('differentChoice'):t('sameChoice'))+' · '+t('rawGap')+': '+bundle.dcc.rawGap+' · '+bundle.dcc.reason;panel.append(note);
 $('statDepth').textContent=r.depth;$('statNodes').textContent=r.nodes.toLocaleString();$('statTime').textContent=(bundle.total_ms/1000).toFixed(2)+' s';
 $('searchInfo').textContent=t('workLabel')+' '+r.work.toLocaleString()+' · '+(r.safetyComplete?t('safe'):t('incomplete'))+' · '+t('stopReason')+': '+(r.stopReason||'—')+' · '+t('analysisNote');
 const sorted=r.candidates.slice().sort((x,y)=>y.score-x.score||x.order-y.order);
 for(const c of sorted){const row=document.createElement('button');row.className=c.id===b?.id?'picked':'';const left=document.createElement('span'),right=document.createElement('span');left.textContent=(c.id===a?.id?'A ':'')+(c.id===b?.id?'D ':'')+fmt(c.move);right.textContent=Math.abs(c.score)>997952?(c.score>0?'WIN':'LOSS'):String(Math.round(c.score));row.append(left,right);
  row.onclick=()=>{const x=c.sensors,d=bundle.dcc.ranks?.find(z=>z.id===c.id);$('sensorDetails').textContent=fmt(c.move)+' · '+x.status+' · GS '+(x.gs??'—')+' · MR '+(x.mr??'—')+' · replies '+x.replies+'/'+x.totalReplies+' · non-winning '+x.nonWinningReplies+' · DCC '+(d?.rankScore?.toFixed(2)??'—')+' · '+c.byDepth.map(x=>'d'+x.depth+':'+x.score).join(' → ');};$('candidates').append(row);
 }
}
function branch(){if(cursor<states.length-1){archived.push({from:cursor,states:states.slice(cursor+1),moves:moves.slice(cursor),records:records.slice(cursor),clocks:clocks.slice(cursor+1)});states=states.slice(0,cursor+1);moves=moves.slice(0,cursor);records=records.slice(0,cursor);clocks=clocks.slice(0,cursor+1);timeout=null;message(t('branch'));}}
function play(a,meta={}){
 if(loading||animating||finished()||!E.validMove(state(),a))return;
 const side=state().curPlayer;
 let timing=meta.timing;
 if(!timing){T.tick(timer,now());if(timer.flagged){renderClocks();return;}timing=T.move(timer,side,3-side,now(),new Date().toISOString());}
 if(!timing&&!inSimulation)return;
 clearHint();message('');branch();
 const change=E.action(state(),a,true);states.push(change.state);moves.push(a);cursor++;
 const row={...(meta.row||{}),atUTC:timing?.atUTC||new Date().toISOString(),think_ms:timing?.think_ms||0,clockAfter:T.copy(timer),analysis:inSimulation?undefined:meta.bundle||null};
 records.push(row);clocks.push(T.copy(timer));
 const epoch=++animationEpoch;animating=true;magMode=false;render(change.paths);persist();
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches||(inSimulation&&simDisplay==='fast');
 const animationStart=now();if(a.type==='flip')setAngle(angle+(a.delta===1?-90:90),!reduce);
 function complete(){if(epoch!==animationEpoch)return;const spent=now()-animationStart;if(meta.row){meta.row.presentation_ms+=spent;meta.row.wall_ms+=spent;row.presentation_ms=meta.row.presentation_ms;row.wall_ms=meta.row.wall_ms;}animating=false;render();renderBatch();persist();scheduleAI();}
 if(reduce){complete();return;}
 const animate=()=>{if(epoch!==animationEpoch)return;[...$('pieces').children].forEach((el,i)=>{const p=change.paths[i];if(p){el.style.left=p.toC*12.5+'%';el.style.top=p.toR*12.5+'%';}});setTimeout(complete,360);};
 requestAnimationFrame(()=>requestAnimationFrame(()=>{if(a.type==='flip')setTimeout(animate,470);else animate();}));
}
const levels=S.LEVELS;
function request(kind='ai'){
 if(loading||state().result||animating||finished())return;
 stopWork();clearHint();
 if(kind!=='ai'){paused=true;if(inSimulation&&batch)B.stop(batch);message(t('timedHint'));}
 else T.resume(timer,now());
 thinking=true;const id=++job,key=E.key(state()),side=state().curPlayer,actor=policy(side);
 const options=inSimulation&&kind==='ai'?batch.config.budget:{mode:'time',...(levels[prefs.difficulty]||levels.casual)};
 const dcc=inSimulation&&kind==='ai'?batch.config.dcc:dccConfig(),started=now();
 searchRuntime={kind,options:S.normalizeBudget(options),started};
 $('statDepth').textContent='0';$('statNodes').textContent='0';
 $('searchInfo').textContent=options.mode==='time'?t('budgetTime')+': '+(options.ms/1000)+' s':'';render();
 searchClock=setInterval(()=>{if(id!==job)return;$('statTime').textContent=((now()-started)/1000).toFixed(1)+' s';if(options.mode==='time'){$('searchBar').style.width=Math.min(99,(now()-started)/options.ms*100)+'%';$('status').textContent=t('thinking')+' · '+((now()-started)/1000).toFixed(1)+' / '+(options.ms/1000)+' s';}},100);
 function receive(data){
  if(data.id!==job||E.key(state())!==key)return;
  if(data.type==='progress'){const r=data.report;$('statDepth').textContent=r.depth;$('statNodes').textContent=r.nodes.toLocaleString();
   $('searchInfo').textContent=t('workLabel')+' '+r.work.toLocaleString()+(r.progressOnly?' · '+t('searchingDepth')+' '+r.searchingDepth+' · '+r.rootDone+'/'+r.rootTotal:'');
   if(options.mode==='work')$('searchBar').style.width=Math.min(95,r.work/options.work*100)+'%';return;}
  clearTimeout(watchdog);clearInterval(searchClock);if(worker){worker.terminate();worker=null;}if(workerURL){URL.revokeObjectURL(workerURL);workerURL=null;}thinking=false;
  if(data.type==='error'){pauseAll(t('error')+' '+data.error);return;}
  const bundle=data.answer;searchRuntime=null;lastStats=bundle;showStats(bundle);$('searchBar').style.width='100%';
  const selected=(actor==='dcc'?bundle.dcc:bundle.classical).selected;
  if(!selected||!E.validMove(state(),selected.move)){pauseAll(t('error'));return;}
  if(kind!=='ai'){
   render();const a=selected.move;lastHint=a;message(t('hintLabel')+': '+fmt(a));if(a.type==='drop')preview(a);else if(a.type==='flip')$(a.delta===1?'flipLeft':'flipRight').classList.add('hint-flash');else rim.find(b=>+b.dataset.side===a.side&&+b.dataset.idx===a.idx)?.classList.add('hint-flash');persist();return;
  }
  if(paused)return;
  T.pause(timer,now());
  if(timer.flagged){renderClocks();return;}
  const decisionAt=now(),wait=inSimulation&&simDisplay==='watch'?400:0;
  animating=true;render(); // Lock input while presenting a committed decision, but before the move.
  presentationTimer=setTimeout(()=>{
   if(id!==job||E.key(state())!==key||paused)return;animating=false;
   const acceptedAt=now();T.resume(timer,acceptedAt);const timing=T.move(timer,side,3-side,acceptedAt,new Date().toISOString());
   if(!timing){renderClocks();return;}
   let row=null;
   if(inSimulation){try{row=B.append(batch,bundle,now()-decisionAt,now()-started).row;}catch(e){pauseAll(t('error')+' '+e.message);return;}}
   play(selected.move,{timing,bundle,row});
  },wait);
 }
 watchdog=setTimeout(()=>{if(id===job)pauseAll(t('slow'));},options.mode==='time'?options.ms+5000:180000);
 try{
  const body=$('f4m-worker-body');
  if(body){const parts=['f4m-core','f4m-search','f4m-classical','f4m-dcc','f4m-sim'].map(n=>document.querySelector('script[data-f4m-module="'+n+'"]').textContent);parts.push(body.textContent);workerURL=URL.createObjectURL(new Blob(parts,{type:'text/javascript'}));worker=new Worker(workerURL);}
  else worker=new Worker('f4m-worker.js?v=2.1.1');worker.onmessage=e=>receive(e.data);worker.onerror=e=>receive({id,type:'error',error:e.message});worker.postMessage({id,state:E.copy(state()),options,dcc});}
 catch(e){pauseAll(t('error')+' '+e.message);}
}
function scheduleAI(){
 if(loading||paused||animating||thinking)return;
 if(inSimulation){
  if(!batch)return;
  if(!batch.active){if(batch.status==='complete'){paused=true;render();renderBatch();persist();message(t('batchFinished'));return;}
   const id=job;nextTimer=setTimeout(()=>{if(id!==job||paused)return;adoptRun(B.begin(batch));scheduleAI();},simDisplay==='watch'?800:0);return;}
 }
 if(finished())return;T.resume(timer,now());
 if(isCPU()){const id=job;nextTimer=setTimeout(()=>{if(id===job&&!paused)request('ai');},0);}
}
function navigate(i){if(i<0||i>=states.length)return;pauseAll();clearHint();cursor=i;timer=T.restore(clocks[i]||T.create({turn:state().curPlayer}),now());setAngle(-state().gravityDir*90);lastStats=records[i-1]?.analysis||null;render();showStats(lastStats);persist();message(inSimulation?(prefs.lang==='sl'?'Sim nadaljuje shranjeno stanje; za novo vejo odpri Sim → Trenutna pozicija.':'Resume Sim restores its checkpoint; use Sim → Current position for a new branch.'):t('reviewNote'));}
function undo(){if(!cursor||inSimulation)return;pauseAll();clearHint();cursor--;if(game.mode==='cpu')while(cursor>0&&state().curPlayer!==game.human)cursor--;timer=T.restore(clocks[cursor]||T.create({turn:state().curPlayer}),now());timeout=null;paused=isCPU();setAngle(-state().gravityDir*90);lastStats=records[cursor-1]?.analysis||null;render();showStats(lastStats);persist();message('');scheduleAI();}
function togglePause(){if(loading)return;if(!paused){pauseAll();return;}if(inSimulation){resumeBatch();return;}if(finished())return;paused=false;render();message('');scheduleAI();persist();}
function start(force=false){
 if(loading)return;if(!force&&cursor>0&&!finished()&&!confirm(t('newConfirm')))return;
 preferences();stopWork();clearHint();inSimulation=false;backup=null;
 game={mode:prefs.mode,human:prefs.first==='cpu'?2:1,tools:Number(prefs.tools),engine:prefs.cpuEngine};states=[E.create(game.tools)];moves=[];archived=[];records=[];cursor=0;timeout=null;
 timer=T.create({...clockOptions(),turn:1,now:now()});clocks=[T.copy(timer)];paused=false;magMode=false;lastStats=null;setAngle(0);render();showStats(null);renderBatch();message('');persist();scheduleAI();
}
function adoptRun(run){
 if(!run)return;game={mode:'demo',human:1,tools:batch.config.tools,policies:{...run.policies}};
 states=[E.copy(run.start)];moves=[];records=[];archived=[];clocks=[];timeout=null;cursor=0;timer=T.create({turn:run.start.curPlayer,now:now()});clocks.push(T.copy(timer));
 for(const row of run.trace){states.push(E.action(states.at(-1),row.move));moves.push(row.move);records.push(row);timer.used[row.side]+=row.compute_ms;timer.turn=states.at(-1).curPlayer;clocks.push(T.copy(timer));cursor++;}
 setAngle(-state().gravityDir*90);lastStats=null;clearHint();render();showStats(null);
}
function renderBatch(){
 $('resumeBatch').disabled=!batch||batch.status==='complete'||loading;$('backToPlay').disabled=!backup||loading;$('exportBatch').disabled=!batch;$('exportCSV').disabled=!batch;
 $('experimentHistory').replaceChildren();const defaultOption=document.createElement('option');defaultOption.textContent=prefs.lang==='sl'?'Prejšnji poskusi ('+pastBatches.length+')':'Earlier experiments ('+pastBatches.length+')';defaultOption.value='';$('experimentHistory').append(defaultOption);pastBatches.forEach((b,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=b.experimentId+' · '+b.runs.length+' games';$('experimentHistory').append(o);});$('experimentHistory').disabled=!pastBatches.length;
 $('runList').replaceChildren();if(!batch){$('batchStatus').textContent=t('noBatch');$('batchStats').replaceChildren();return;}
 const a=B.summarize(batch);$('batchStatus').textContent=batch.experimentId+' · '+batch.status+' · '+(batch.config.budget.mode==='work'?batch.config.budget.work+' transitions':batch.config.budget.ms+' ms');
 const rows=[t('progressGames')+': '+a.games+'/'+a.planned,t('winsLabel')+': '+a.dccWins+' / '+a.classicalWins+' / '+a.draws,
  t('redYellow')+': '+a.redWins+' / '+a.yellowWins,t('uniquePairs')+': '+a.uniqueStarts+' ('+a.pairs+')',
  a.pairBootstrap95?t('ci')+': '+a.pairBootstrap95.map(x=>(100*x).toFixed(1)+'%').join(' – '):t('noCI')];
 for(const p of ['classical','dcc']){const z=a.byPolicy[p];rows.push(label(p)+' · '+t('meanCompute')+': '+(z.meanComputeMs===null?'—':z.meanComputeMs.toFixed(1)+' ms')+' · '+t('toolsUsed')+': '+z.flips+' / '+z.magnets+' · Δ '+z.changes);}
 $('batchStats').replaceChildren();for(const text of rows){const div=document.createElement('div');div.textContent=text;$('batchStats').append(div);}
 batch.runs.forEach(run=>{const b=document.createElement('button');b.textContent='#'+(run.index+1)+' · '+run.state+' · '+(run.result===3?'½':run.result?color(run.result):'—');b.onclick=()=>{pauseAll();inSimulation=true;$('historyPanel').open=true;adoptRun(run);renderBatch();persist();message(inSimulation?(prefs.lang==='sl'?'Sim nadaljuje shranjeno stanje; za novo vejo odpri Sim → Trenutna pozicija.':'Resume Sim restores its checkpoint; use Sim → Current position for a new branch.'):t('reviewNote'));};$('runList').append(b);});
}
function resumeBatch(){
 if(!batch||batch.status==='complete')return;stopWork();if(!inSimulation&&!backup)backup=JSON.parse(JSON.stringify(session()));inSimulation=true;
 const run=B.begin(batch);if(!run)return;adoptRun(run);batch.status='running';paused=false;render();renderBatch();persist();message('');scheduleAI();
}
function openSim(){if(loading)return;pauseAll();$('simTools').value=String(game.tools);$('simNotice').textContent=t('batchReplace')+' '+t('seedNote');$('simDialog').showModal();}
function startSim(){
 
 const length=$('simLength').value,cfg={pairs:length==='single'?1:Number(length),single:length==='single',seed:Number($('simSeed').value),tools:Number($('simTools').value),start:$('simStartAt').value,red:$('simRed').value,yellow:$('simYellow').value,
  budget:{mode:$('computeMode').value,work:Number($('simWork').value),ms:Number($('simMs').value),depth:$('computeMode').value==='time'?S.LIMITS.depth:12},dcc:dccConfig()};
 try{const next=B.create(cfg,state());if(!inSimulation)backup=JSON.parse(JSON.stringify(session()));if(batch)pastBatches.push(batch);batch=next;simDisplay=$('simDisplay').value;inSimulation=true;$('simDialog').close();$('batchPanel').open=true;resumeBatch();}catch(e){$('simNotice').textContent=e.message;}
}
function validateSession(data){
 let raw=data;
 if(Array.isArray(data))raw={states:data,moves:[],game:{mode:data.at(-1)?.humanPlayer?'cpu':'pvp',human:data.at(-1)?.humanPlayer||1,tools:3},cursor:data.length-1};
 else if(data?.format==='flip4m.preview'&&data.schema===2&&data.rules===E.RULES)raw=data;
 else if(data?.format==='flip4m.lab.position'&&data.rules===E.RULES)raw={states:[data.state],moves:[],game:{mode:'pvp',human:1,tools:3},cursor:0};
 else if(data?.format!=='flip4m.lab.session'||data.schema!==1||data.rules!==E.RULES)throw Error('Unknown session format/rules');
 return validateSessionFields(raw);
}
function validateSessionFields(raw){
 const ss=raw.states;if(!Array.isArray(ss)||ss.length<1||ss.length>1024)throw Error('Invalid history');
 const clean=ss.map(E.validate),mm=Array.from({length:ss.length-1},(_,i)=>raw.moves?.[i]||null);
 for(let i=0;i<mm.length;i++)if(mm[i]&&(!E.validMove(clean[i],mm[i])||E.key(E.action(clean[i],mm[i]))!==E.key(clean[i+1])))throw Error('Move/history mismatch '+i);
 const g=raw.game;if(!g||!['cpu','pvp','demo'].includes(g.mode)||![1,2].includes(g.human)||![0,2,3].includes(g.tools))throw Error('Invalid players');
 if(g.engine&&!['classical','dcc'].includes(g.engine))throw Error('Invalid engine');
 if(g.policies&&[1,2].some(p=>!['classical','dcc'].includes(g.policies[p])))throw Error('Invalid side policy');
 if(!Number.isInteger(raw.cursor)||raw.cursor<0||raw.cursor>=ss.length)throw Error('Invalid cursor');
 const cc=clean.map((s,i)=>raw.clocks?.[i]?T.restore(raw.clocks[i],now()):T.create({turn:s.curPlayer,now:now()}));
 const ct=raw.clock?T.restore(raw.clock,now()):T.copy(cc[raw.cursor]);
 if(ct.turn!==clean[raw.cursor].curPlayer&&!clean[raw.cursor].result)throw Error('Clock side mismatch');
 if(raw.timeout&&(!Number.isInteger(raw.timeout.cursor)||raw.timeout.cursor<0||raw.timeout.cursor>=ss.length||![1,2].includes(raw.timeout.winner)))throw Error('Invalid timeout');
 if(raw.archived&&(!Array.isArray(raw.archived)||raw.archived.length>128))throw Error('Invalid variations');
 const aa=(raw.archived||[]).map(b=>{if(!b||!Array.isArray(b.states)||b.states.length>1024)throw Error('Invalid variation');return {...b,states:b.states.map(E.validate)};});
 return {game:{...g,engine:g.engine||'classical'},states:clean,moves:mm,cursor:raw.cursor,clocks:cc,clock:ct,records:Array.isArray(raw.records)?raw.records.slice(0,mm.length):[],archived:aa,timeout:raw.timeout||null};
}
function installSession(x){
 stopWork();clearHint();({game,states,moves,records,clocks,cursor,timeout,archived}=x);timer=x.clock;paused=true;magMode=false;lastStats=null;setAngle(-state().gravityDir*90);render();showStats(null);
}
function download(data,name,type='application/json'){const blob=new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('start').onclick=()=>start();$('newGame').onclick=()=>start();$('rematch').onclick=()=>start(true);
$('flipLeft').onclick=()=>{if(canPlay())play({type:'flip',delta:1});};$('flipRight').onclick=()=>{if(canPlay())play({type:'flip',delta:-1});};$('magnet').onclick=()=>{if(canPlay()){clearHint();magMode=!magMode;render();}};
$('undo').onclick=undo;$('pause').onclick=togglePause;$('hint').onclick=$('compare').onclick=()=>{request('hint');$('analysisPanel').open=true;};$('prev').onclick=()=>navigate(cursor-1);$('next').onclick=()=>navigate(cursor+1);
$('help').onclick=()=>{pauseAll();$('helpDialog').showModal();};$('closeHelp').onclick=$('helpDone').onclick=()=>$('helpDialog').close();
$('lang').onclick=()=>{prefs.lang=prefs.lang==='sl'?'en':'sl';preferences();translate();persist();};$('theme').onclick=()=>{prefs.theme=prefs.theme==='dark'?'light':'dark';preferences();document.documentElement.dataset.theme=prefs.theme;};
for(const k of [...selectPrefs,...checkPrefs,'customSeconds','customIncrement'])$(k).addEventListener('change',()=>{preferences();if(!['showTimers','showTimestamps'].includes(k)&&!paused)pauseAll();render();persist();});
$('sim').onclick=openSim;$('closeSim').onclick=()=>$('simDialog').close();$('startSim').onclick=startSim;
$('swapEngines').onclick=()=>{[$('simRed').value,$('simYellow').value]=[$('simYellow').value,$('simRed').value];};
$('computeMode').onchange=()=>{$('simWork').disabled=$('computeMode').value!=='work';$('simMs').disabled=$('computeMode').value!=='time';};$('computeMode').onchange();
$('simStartAt').onchange=()=>{$('simTools').disabled=$('simStartAt').value==='current';};
$('resumeBatch').onclick=resumeBatch;$('backToPlay').onclick=()=>{if(!backup)return;pauseAll();const x=validateSessionFields(backup);inSimulation=false;backup=null;installSession(x);renderBatch();persist();message(t('returnNote'));};
$('experimentHistory').onchange=()=>{const value=$('experimentHistory').value;if(value==='')return;pauseAll();const chosen=pastBatches.splice(Number(value),1)[0];if(!chosen)return;if(batch)pastBatches.push(batch);batch=chosen;inSimulation=true;adoptRun(batch.active||batch.runs.at(-1)||B.begin(batch));paused=true;renderBatch();persist();};
$('exportBatch').onclick=()=>{if(batch)download(batch,batch.experimentId+'.json');};$('exportCSV').onclick=()=>{if(batch)download(B.csv(batch),batch.experimentId+'.csv','text/csv');};
$('save').onclick=()=>{download(envelope(),'Flip4M_Lab_2_1_'+Date.now()+'.json');message(t('exported'));};
$('bookmark').onclick=()=>download({format:'flip4m.lab.position',schema:1,rules:E.RULES,sourceVersion:VERSION,state:E.copy(state()),key:E.key(state())},'F4M_position_'+B.fingerprint(E.key(state()))+'.json');
$('load').onclick=()=>$('file').click();
$('file').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{
 if(f.size>100*1024*1024)throw Error('Maximum file size: 100 MB');const data=JSON.parse(await f.text());
 if(data?.format==='flip4m.lab.batch'){const next=B.restore(data);pauseAll();if(!inSimulation)backup=JSON.parse(JSON.stringify(session()));if(batch)pastBatches.push(batch);batch=next;inSimulation=true;adoptRun(batch.active||batch.runs.at(-1)||B.begin(batch));paused=true;B.stop(batch);if(batch.nextIndex>=B.count(batch))batch.status='complete';renderBatch();persist();}
 else{const x=validateSession(data),nextBatch=data.batch?B.restore(data.batch):null,nextBackup=data.backup?validateSessionFields(data.backup):null,previous=(data.pastBatches||[]).map(B.restore);pauseAll();batch=nextBatch;pastBatches=previous;backup=nextBackup;inSimulation=!!data.inSimulation&&!!batch;simDisplay=data.simDisplay==='fast'?'fast':'watch';installSession(x);renderBatch();persist();}
 message(t('importOK'));
 }catch(err){message(t('invalid')+': '+err.message);}};
document.addEventListener('keydown',e=>{
 if(e.ctrlKey||e.altKey||e.metaKey||/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)||document.querySelector('dialog[open]'))return;
 const k=e.key.toLowerCase();if(/^[1-8]$/.test(k)&&canPlay()&&!magMode){play({type:'drop',col:state().gravityDir<2?+k-1:8-+k});e.preventDefault();}
 else if(k==='u'){undo();e.preventDefault();}else if(k===' '){togglePause();e.preventDefault();}else if(k==='h'){request('hint');e.preventDefault();}else if(k==='m')$('magnet').click();else if(k==='q')$('flipLeft').click();else if(k==='e')$('flipRight').click();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!loading&&!paused)pauseAll();});window.addEventListener('pagehide',()=>{if(!loading)pauseAll();});
setInterval(renderClocks,100);
preferences();setAngle(0);translate();
(async()=>{let restored=false;try{const data=await Store.read();if(data){const x=validateSession(data),nb=data.batch?B.restore(data.batch):null,bk=data.backup?validateSessionFields(data.backup):null,previous=(data.pastBatches||[]).map(B.restore);batch=nb;pastBatches=previous;backup=bk;inSimulation=!!data.inSimulation&&!!batch;simDisplay=data.simDisplay==='fast'?'fast':'watch';installSession(x);restored=true;}}catch(err){await Store.quarantine();console.warn('Flip4M checkpoint:',err.message);message(t('invalid')+': '+err.message);}loading=false;if(!restored)start(true);else{$('batchPanel').open=!!batch;render();renderBatch();message(t('restored'));}})();
window.F4MLab=Object.freeze({version:VERSION,snapshot:()=>JSON.parse(JSON.stringify(envelope())),status:()=>({paused,thinking,animating,loading,inSimulation,cursor,job,search:searchRuntime?JSON.parse(JSON.stringify(searchRuntime)):null}),validateSave:validateSession,flush:()=>Store.flush()});
})();
