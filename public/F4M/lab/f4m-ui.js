/* Flip4M v2.0.0 UI. No network services, no dependencies, no shared legacy storage. */
(()=>{
'use strict';
const E=window.F4M,$=id=>document.getElementById(id),SAVE='flip4m.lab.v1.game',PREF='flip4m.lab.v1.preferences';
const EN={about:'About',original:'Original',tagline:'Connect four. One move changes everything.',how:'How to play?',left:'Turn left',right:'Turn right',magnet:'Magnet',undo:'↶ Undo',hint:'✦ Hint',pause:'Ⅱ Pause',resume:'▶ Continue',new:'＋ New game',yourGame:'Your game',local:'LOCAL',opponent:'Opponent',cpu:'Play against AI',pvp:'Two players',demo:'AI vs AI',tools:'Rules / tools per player',classic:'Classic · no tools',magnetic:'Flip4M · 2 flips + 2 magnets',pro:'Pro · 3 flips + 3 magnets',difficulty:'AI strength',beginner:'Beginner',casual:'Casual',strong:'Challenge',master:'Master',first:'First move',you:'You',style:'DCC style',balanced:'Balanced',defensive:'Defensive',aggressive:'Aggressive',start:'Start a new game →',settingsNote:'Rules and players change when you start a new game. AI strength can change during play.',analysis:'Under the hood · AI & DCC',dcc:'DCC · experimental re-ranking',dccNote:'Enable to compare rotation resilience and resource use at near-equal scores; the DCC style then becomes available. It cannot override a calculated win or tactical safety.',depth:'Depth',nodes:'Nodes',time:'Time',history:'History & saves',save:'Export JSON',load:'Import JSON',note:'Start without tools. Once you know connect four, add rotations and magnets — the same board, a whole new depth.',privacy:'No account. No API. Everything stays in your browser.',receipt:'Release record',play:'Let’s play →',rematch:'Play again',red:'Red',yellow:'Yellow',turn:'to move',thinking:'AI is thinking',paused:'Paused',review:'Review',choose:'Select a lane on the board.',chooseMag:'Select a rim slot. One magnet token per action.',watch:'Watching AI vs AI. Pause to inspect.',move:'Move',grav:'Board gravity',flips:'Flips',magnets:'Magnets',win:'wins!',draw:'Draw',full:'Board full',line:'Four connected',saved:'Saved automatically on this device.',storage:'Local saving unavailable. Export JSON to keep this game.',restored:'Game restored. Press Continue to resume.',newConfirm:'Start a new game? Export JSON first to keep the current game.',invalid:'The file could not be loaded',loaded:'Game imported. Press Continue to resume.',exported:'Game exported, including history and archived variations.',hintLabel:'Hint',calcWin:'immediate win',searched:'completed search',fallback:'bounded fallback',noMoves:'No legal moves.',error:'AI stopped safely. Press Continue to retry.',slow:'AI exceeded its limit and was stopped. Press Continue to retry.',working:'Searching',complete:'completed',safe:'One-move safety checked',incomplete:'Safety scan incomplete',dccChanged:'DCC changed the near-equal choice',dccSame:'DCC kept the search choice',workerFallback:'Worker unavailable: reduced search',top:'top',rightSide:'right',bottom:'bottom',leftSide:'left',drop:'Drop',flip:'Turn',position:'Position',branch:'Later positions have been retained as an archived variation in JSON.',reviewNote:'History view. Continue to play from this position.',toolOff:'This game has no tools. Select Flip4M or Pro and start a new game.',expire:'remaining turns',remove:'removes opposing magnet',refresh:'refreshes this magnet',place:'places a magnet',wins:'winning line',square:'Square'};
const SL={about:'O igri',original:'Izvirnik',tagline:'Štiri v vrsto. Ena poteza spremeni vse.',how:'Kako igrati?',left:'Obrni levo',right:'Obrni desno',magnet:'Magnet',undo:'↶ Razveljavi',hint:'✦ Namig',pause:'Ⅱ Premor',resume:'▶ Nadaljuj',new:'＋ Nova igra',yourGame:'Tvoja igra',local:'LOKALNO',opponent:'Nasprotnik',cpu:'Igraj proti AI',pvp:'Dva igralca',demo:'AI proti AI',tools:'Pravila / orodja na igralca',classic:'Klasika · brez orodij',magnetic:'Flip4M · 2 obrata + 2 magneta',pro:'Pro · 3 obrati + 3 magneti',difficulty:'Moč AI',beginner:'Začetnik',casual:'Sproščeno',strong:'Izziv',master:'Mojster',first:'Začne',you:'Ti',style:'Slog DCC',balanced:'Uravnotežen',defensive:'Obramben',aggressive:'Napadalen',start:'Začni novo igro →',settingsNote:'Pravila in igralci se spremenijo šele z novo igro. Moč AI lahko spremeniš med igro.',analysis:'Pod pokrovom · AI in DCC',dcc:'DCC · eksperimentalno razvrščanje',dccNote:'Vključi za primerjavo odpornosti na obrat in porabe orodij pri skoraj enakih ocenah; takrat postane na voljo tudi slog DCC. Ne sme preglasiti izračunane zmage ali taktične varnosti.',depth:'Globina',nodes:'Vozlišča',time:'Čas',history:'Zgodovina in shranjevanje',save:'Izvozi JSON',load:'Uvozi JSON',note:'Začni brez orodij. Ko obvladaš štiri v vrsto, vključi rotacije in magnete — ista plošča, povsem nova globina.',privacy:'Brez računa. Brez API-ja. Vse ostane v tvojem brskalniku.',receipt:'Zapis izdaje',play:'Igrajmo →',rematch:'Še ena igra',red:'Rdeči',yellow:'Rumeni',turn:'na potezi',thinking:'AI razmišlja',paused:'Premor',review:'Pregled',choose:'Izberi stolpec na plošči.',chooseMag:'Izberi mesto na robu. Poteza stane en magnet.',watch:'Igra AI proti AI. Za pregled pritisni Premor.',move:'Poteza',grav:'Gravitacija plošče',flips:'Obrati',magnets:'Magneti',win:'zmaga!',draw:'Remi',full:'Plošča je polna',line:'Štiri v vrsto',saved:'Samodejno shranjeno na tej napravi.',storage:'Lokalno shranjevanje ni na voljo. Za ohranitev igre izvozi JSON.',restored:'Igra je obnovljena. Za nadaljevanje pritisni Nadaljuj.',newConfirm:'Začnem novo igro? Za ohranitev trenutne igre jo prej izvozi v JSON.',invalid:'Datoteke ni bilo mogoče uvoziti',loaded:'Igra je uvožena. Za nadaljevanje pritisni Nadaljuj.',exported:'Igra je izvožena z zgodovino in arhiviranimi različicami.',hintLabel:'Namig',calcWin:'takojšnja zmaga',searched:'zaključeno iskanje',fallback:'časovno omejena rezervna izbira',noMoves:'Ni dovoljenih potez.',error:'AI se je varno ustavil. Pritisni Nadaljuj za nov poskus.',slow:'AI je presegel omejitev in je ustavljen. Pritisni Nadaljuj za nov poskus.',working:'Iskanje',complete:'zaključeno',safe:'Preverjena varnost pred takojšnjim porazom',incomplete:'Preverjanje varnosti ni zaključeno',dccChanged:'DCC je spremenil skoraj enakovredno izbiro',dccSame:'DCC je ohranil izbiro iskanja',workerFallback:'Worker ni na voljo: skrajšano iskanje',top:'zgoraj',rightSide:'desno',bottom:'spodaj',leftSide:'levo',drop:'Spusti',flip:'Obrni',position:'Pozicija',branch:'Poznejše poteze so ohranjene kot arhivirana različica v JSON.',reviewNote:'Pregled zgodovine. Nadaljuj za igro od te pozicije.',toolOff:'Ta igra je brez orodij. Izberi Flip4M ali Pro in začni novo igro.',expire:'preostale poteze',remove:'odstrani nasprotnikov magnet',refresh:'obnovi ta magnet',place:'postavi magnet',wins:'zmagovalna vrsta',square:'Polje'};
Object.assign(EN,{"labTime": "Time & display", "showTimers": "Show player clocks", "showTimestamps": "Show move timestamps", "timeControl": "Game clock", "custom": "Custom", "minutes": "Minutes", "increment": "Increment (s)", "elapsedNote": "Elapsed · pauses and animation excluded", "countdownNote": "Remaining · increment after each move", "simTimeNote": "Sim · elapsed · no game time limit", "timeWin": "Win on time", "redEngine": "Red engine", "yellowEngine": "Yellow engine", "lab": "Simulation lab", "simStart": "Start simulation", "simCancel": "Close", "simFrom": "Start position", "current": "Displayed position", "fresh": "New empty board", "budgetMode": "Budget per move", "timeMode": "Time (ms)", "workMode": "Work units (deterministic)", "budget": "Budget", "depthLimit": "Maximum search depth", "pairs": "Starts / pairs", "seed": "Opening seed", "seeded": "Seeded 4-ply starts", "paired": "Pair with swapped engines", "watch": "Watch with animation", "fast": "Fast · no animation", "simSpeed": "Presentation", "swap": "Swap engines", "runSim": "Start Sim →", "experiments": "Experiments", "unique": "unique starts", "changes": "different choices", "noExperiments": "No experiment yet. Select Sim to compare engines.", "ciNote": "Confidence interval needs 5+ distinct paired starts. Repeats are not independent evidence.", "returnStudy": "Return to study", "nextGame": "Continue next game", "terminalStart": "Choose an unfinished starting position.", "coverage": "Coverage", "nodes": "Search nodes", "work": "Work units", "simNote": "Both policies observe the same funded candidate analysis. Only move selection differs. Seeds and complete decision traces are exported.", "engineNote": "DCC compares gravity, magnets, resource thrift and completed-depth stability inside a 12-point guard. This is an experimental selector, not full recursive rDCC."});
Object.assign(SL,{"labTime": "Čas in prikaz", "showTimers": "Prikaži uri igralcev", "showTimestamps": "Prikaži časovne oznake potez", "timeControl": "Igralna ura", "custom": "Po meri", "minutes": "Minute", "increment": "Dodatek (s)", "elapsedNote": "Porabljeni čas · brez premorov in animacij", "countdownNote": "Preostali čas · dodatek po potezi", "simTimeNote": "Sim · porabljeni čas · brez omejitve igre", "timeWin": "Zmaga na čas", "redEngine": "Rdeči motor", "yellowEngine": "Rumeni motor", "lab": "Simulacijski laboratorij", "simStart": "Zaženi simulacijo", "simCancel": "Zapri", "simFrom": "Začetni položaj", "current": "Prikazana pozicija", "fresh": "Nova prazna plošča", "budgetMode": "Proračun na potezo", "timeMode": "Čas (ms)", "workMode": "Delovne enote (ponovljivo)", "budget": "Proračun", "depthLimit": "Največja globina iskanja", "pairs": "Začetki / pari", "seed": "Seme otvoritve", "seeded": "4 začetne poteze iz semena", "paired": "Par z zamenjanima motorjema", "watch": "Opazuj z animacijo", "fast": "Hitro · brez animacije", "simSpeed": "Prikaz", "swap": "Zamenjaj motorja", "runSim": "Zaženi Sim →", "experiments": "Eksperimenti", "unique": "različni začetki", "changes": "različne izbire", "noExperiments": "Ni še eksperimenta. Izberi Sim za primerjavo motorjev.", "ciNote": "Interval potrebuje vsaj 5 različnih parnih začetkov. Ponovitve niso neodvisni dokazi.", "returnStudy": "Vrni se k igri", "nextGame": "Nadaljuj z naslednjo igro", "terminalStart": "Izberi začetni položaj, ki še ni končan.", "coverage": "Pokritost", "nodes": "Iskalna vozlišča", "work": "Delovne enote", "simNote": "Obe politiki opazujeta isto financirano analizo kandidatov. Razlikuje se le izbira poteze. Izvoz vsebuje semena in celoten zapis odločitev.", "engineNote": "DCC primerja gravitacijo, magnete, porabo orodij in stabilnost zaključenih globin znotraj pasu 12 točk. To je eksperimentalna izbira, ne celotni rekurzivni rDCC."});
let prefs={lang:'sl',theme:'dark',mode:'cpu',tools:'2',difficulty:'casual',first:'human',style:'balanced',dcc:false,redPolicy:'classical',yellowPolicy:'dcc',timeControl:'0+0',showTimers:false,showTimestamps:false};
try{const p=JSON.parse(localStorage.getItem(PREF)||'null');if(p&&typeof p==='object')Object.assign(prefs,p);}catch(_){}
prefs.lang=['sl','en'].includes(prefs.lang)?prefs.lang:'sl';prefs.theme=prefs.theme==='light'?'light':'dark';
let game={mode:'cpu',human:1,tools:2},states=[E.create(2)],moves=[],archived=[],cursor=0,paused=false,animating=false,thinking=false,magMode=false,worker=null,workerURL=null,job=0,animationEpoch=0,watchdog=null,clock=null,lastStats=null,lastHint=null,angle=0;
const state=()=>states[cursor],t=k=>(prefs.lang==='sl'?SL:EN)[k]||k,color=p=>t(p===1?'red':'yellow');
const name=p=>game.mode==='pvp'?color(p):game.mode==='demo'?'AI · '+color(p):p===game.human?t('you'):'AI';
const isCPU=()=>game.mode==='demo'||(game.mode==='cpu'&&state().curPlayer!==game.human);
const canPlay=()=>!paused&&!animating&&!thinking&&!state().result&&!timeResult&&!isCPU();
const message=txt=>{$('feedback').textContent=txt;};
const sideName=s=>t(['top','rightSide','bottom','leftSide'][s]);
function fmt(a){if(!a)return '—';return a.type==='drop'?t('drop')+' '+(a.col+1):a.type==='flip'?t('flip')+' '+(a.delta===1?'↶':'↷'):t('magnet')+' '+sideName(a.side)+' '+(a.idx+1);}
function envelopeBase(){return {format:'flip4m.preview',schema:2,engine:E.VERSION,rules:E.RULES,game,settings:prefs,states,moves,archived,cursor,savedAt:new Date().toISOString()};}
function persist(){try{localStorage.setItem(SAVE,JSON.stringify(envelope()));$('saveStatus').textContent=t('saved');}catch(_){$('saveStatus').textContent=t('storage');}}
function stopWork(){if(typeof playerClock!=='undefined')T.pause(playerClock,performance.now());job++;animationEpoch++;if(worker){worker.terminate();worker=null;}if(workerURL){URL.revokeObjectURL(workerURL);workerURL=null;}clearTimeout(watchdog);clearInterval(clock);thinking=false;animating=false;$('searchBar').style.width='0%';}
function translate(){
 document.documentElement.lang=prefs.lang;document.documentElement.dataset.theme=prefs.theme;
 for(const el of document.querySelectorAll('[data-i18n]'))el.textContent=t(el.dataset.i18n);
 $('lang').textContent=prefs.lang==='sl'?'EN':'SL';document.title=prefs.lang==='sl'?'Flip4M — Nova dimenzija štirih v vrsto':'Flip4M — A new dimension of connect four';
 helpText();render();if(lastStats)showStats(lastStats);
}
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
function renderBase(paths=null){
 const s=state();$('arena').classList.toggle('magnet-mode',magMode);
 for(const p of [1,2]){$('name'+p).textContent=name(p);$('player'+p).classList.toggle('active',!s.result&&s.curPlayer===p);$('resources'+p).replaceChildren();const span=document.createElement('span');span.textContent='↶ '+s.tokens[p].flip+'  ·  ⊓ '+s.tokens[p].mag;span.title=t('flips')+': '+s.tokens[p].flip+' · '+t('magnets')+': '+s.tokens[p].mag;$('resources'+p).append(span);}
 updateStatus();$('pieces').replaceChildren();$('ghost').replaceChildren();
 if(paths){for(const v of paths)$('pieces').append(piece(v.p,v.r,v.c));}
 else for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(s.grid[r][c])$('pieces').append(piece(s.grid[r][c],r,c));
 const wins=E.winningLines(s.grid).filter(l=>l.p===s.result).flatMap(l=>l.cells.map(([r,c])=>r*8+c));
 for(let i=0;i<64;i++){const b=cells[i],r=i>>3,c=i%8;b.disabled=!canPlay()||magMode;b.classList.toggle('winning',wins.includes(i));b.setAttribute('aria-label',t('square')+' '+(r+1)+', '+(c+1)+(s.grid[r][c]?' · '+color(s.grid[r][c]):''));}
 for(const b of rim){const side=+b.dataset.side,idx=+b.dataset.idx,m=s.mag[E.SIDES[side]][idx],op=s.mag[E.SIDES[(side+2)%4]][idx];b.className='mag-slot '+(m?'owned'+m.p:'empty')+(m?.life===1?' expiring':'');b.firstChild.textContent=m?m.life:'·';b.disabled=!canPlay()||!magMode||s.tokens[s.curPlayer].mag<=0;const effect=op&&op.p!==s.curPlayer?t('remove'):m?.p===s.curPlayer?t('refresh'):t('place');b.title=b.getAttribute('aria-label')||'';b.setAttribute('aria-label',t('magnet')+' '+sideName(side)+' '+(idx+1)+(m?' · '+color(m.p)+' · '+m.life+' '+t('expire'):'')+' · '+effect);b.title=b.getAttribute('aria-label');}
 for(const id of ['flipLeft','flipRight'])$(id).disabled=!canPlay()||s.tokens[s.curPlayer].flip<=0;
 $('magnet').disabled=!canPlay()||s.tokens[s.curPlayer].mag<=0;$('magnet').classList.toggle('selected',magMode);$('magnet').setAttribute('aria-pressed',String(magMode));
 $('undo').disabled=cursor===0;$('hint').disabled=animating||!!s.result;$('pause').disabled=!!s.result;$('pause').textContent=t(paused?'resume':'pause');
 $('instruction').textContent=magMode?t('chooseMag'):game.mode==='demo'?t('watch'):t('choose');$('ply').textContent=t('move')+' '+(s.ply||cursor);
 $('outcome').hidden=!s.result||animating;
 if(s.result){$('outcomeTitle').textContent=s.result===3?t('draw'):name(s.result)+' '+t('win');$('outcomeText').textContent=t(s.result===3?'full':'line');}
 $('historyCount').textContent=cursor+' / '+(states.length-1);$('prev').disabled=cursor===0;$('next').disabled=cursor===states.length-1;
 $('moveList').replaceChildren();states.forEach((_,i)=>{const b=document.createElement('button');b.textContent=i===0?'0':i+' · '+fmt(moves[i-1]);b.title=t('position')+' '+i;b.classList.toggle('current',cursor===i);b.onclick=()=>navigate(i);$('moveList').append(b);});
}
function updateStatus(){const s=state();$('status').textContent=s.result?(s.result===3?t('draw'):name(s.result)+' '+t('win')):thinking?t('thinking')+'…':paused?t(cursor<states.length-1?'review':'paused'):name(s.curPlayer)+' · '+t('turn');$('gravity').textContent=t('grav')+' '+['↓','←','↑','→'][s.gravityDir];}
function preview(a){try{if(!E.validMove(state(),a))return;const v=E.action(state(),a,true),p=v.paths[v.paths.length-1];$('ghost').replaceChildren();if(a.type==='drop')$('ghost').append(piece(p.p,p.toR,p.toC,true));}catch(_){} }
function clearHint(){lastHint=null;document.querySelectorAll('.hint-flash').forEach(e=>e.classList.remove('hint-flash'));$('ghost').replaceChildren();}
const levels={beginner:{ms:150,depth:1},casual:{ms:500,depth:5},strong:{ms:1600,depth:9},master:{ms:4500,depth:14}};
function decodeSaveBase(data){
 let arr,rawMoves=[],rawArchived=[],c,g;
 if(Array.isArray(data)){
  arr=data;c=arr.length-1;const last=arr[c]||{};g={mode:last.humanPlayer?'cpu':'pvp',human:last.humanPlayer||1,tools:3};
 }else{
  if(!data||data.format!=='flip4m.preview'||data.schema!==2||data.rules!==E.RULES)throw Error('Unknown save format/rules');
  arr=data.states;rawMoves=data.moves||[];rawArchived=data.archived||[];c=data.cursor;g=data.game;
 }
 if(!Array.isArray(arr)||arr.length===0||arr.length>1024)throw Error('Invalid history length');
 if(!g||!['cpu','pvp','demo'].includes(g.mode)||![1,2].includes(g.human)||![0,2,3].includes(g.tools))throw Error('Invalid game settings');
 if(!Number.isInteger(c)||c<0||c>=arr.length)throw Error('Invalid history cursor');
 const clean=arr.map((s,i)=>({...E.validate(s),ply:Number.isInteger(s.ply)?s.ply:i}));
 // Verify every supplied move against its snapshots; legacy snapshots have no move log.
 const cm=Array.from({length:clean.length-1},(_,i)=>rawMoves[i]||null);
 for(let i=0;i<cm.length;i++)if(cm[i]){if(!E.validMove(clean[i],cm[i])||E.key(E.action(clean[i],cm[i]))!==E.key(clean[i+1]))throw Error('Move/history mismatch at '+(i+1));cm[i]={...cm[i]};}
 if(!Array.isArray(rawArchived)||rawArchived.length>128)throw Error('Invalid archived variations');
 const ca=rawArchived.map(b=>{if(!b||!Number.isInteger(b.from)||!Array.isArray(b.states)||b.states.length>1024)throw Error('Invalid archived variation');return {from:b.from,states:b.states.map(E.validate),moves:Array.isArray(b.moves)?b.moves:[]};});
 return {states:clean,moves:cm,archived:ca,cursor:c,game:{...g}};
}
$('start').onclick=()=>start();$('newGame').onclick=()=>start();$('rematch').onclick=()=>start(true);
$('flipLeft').onclick=()=>{if(canPlay())play({type:'flip',delta:1});};$('flipRight').onclick=()=>{if(canPlay())play({type:'flip',delta:-1});};
$('magnet').onclick=()=>{if(canPlay()){clearHint();magMode=!magMode;render();}};
$('undo').onclick=undo;$('pause').onclick=togglePause;$('hint').onclick=()=>request('hint');$('prev').onclick=()=>navigate(cursor-1);$('next').onclick=()=>navigate(cursor+1);
let helpWasRunning=false;
$('help').onclick=()=>{helpWasRunning=!paused;if(!paused){stopWork();paused=true;setAngle(-state().gravityDir*90);render();}$('helpDialog').showModal();};
$('closeHelp').onclick=$('helpDone').onclick=()=>{$('helpDialog').close();};
$('helpDialog').addEventListener('close',()=>{if(helpWasRunning&&!state().result){paused=false;render();scheduleAI();}helpWasRunning=false;});
$('lang').onclick=()=>{prefs.lang=prefs.lang==='sl'?'en':'sl';preferences();translate();persist();};
$('theme').onclick=()=>{prefs.theme=prefs.theme==='dark'?'light':'dark';preferences();document.documentElement.dataset.theme=prefs.theme;};
for(const k of ['mode','tools','first'])$(k).addEventListener('change',preferences);
for(const k of ['difficulty','style','dcc'])$(k).addEventListener('change',()=>{preferences();if(thinking){stopWork();render();scheduleAI();}});
$('save').onclick=()=>{const blob=new Blob([JSON.stringify(envelope(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Flip4M_v2_'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message(t('exported'));};
$('load').onclick=()=>$('file').click();
$('file').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{if(f.size>50*1024*1024)throw Error('Maximum save size is 50 MB');const x=decodeSave(JSON.parse(await f.text()));installSave(x);message(t('loaded'));}catch(err){message(t('invalid')+': '+err.message);}};
document.addEventListener('keydown',e=>{
 if(e.ctrlKey||e.altKey||e.metaKey||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||$('helpDialog').open||$('simDialog').open)return;
 const k=e.key.toLowerCase();if(/^[1-8]$/.test(k)&&canPlay()&&!magMode){const n=+k-1;play({type:'drop',col:state().gravityDir<2?n:7-n});e.preventDefault();}
 else if(k==='u'){undo();e.preventDefault();}else if(k===' '){togglePause();e.preventDefault();}else if(k==='h'){request('hint');e.preventDefault();}else if(k==='m')$('magnet').click();else if(k==='q')$('flipLeft').click();else if(k==='e')$('flipRight').click();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&thinking){stopWork();paused=true;render();persist();}});
for(const k of ['mode','tools','difficulty','first','style']){const el=$(k);if([...el.options].some(o=>o.value===String(prefs[k])))el.value=prefs[k];else prefs[k]=el.value;}$('dcc').checked=!!prefs.dcc;$('style').disabled=!prefs.dcc;
/* Lab controller extension. Original v2 UI and rendering retained. */
const T=window.F4MTime,SIM=window.F4MSim;
let playerClock=T.create(),clockTape=[],timing=[],timeResult=null,tournament=null,simActive=false,simGeneration=0,simArchive=[],beforeSim=null,pendingDecision=null;
const mono=()=>performance.now();
function currentPolicy(p=state().curPlayer){if(simActive&&tournament){const j=tournament.jobs[tournament.index];return p===1?j.red:j.yellow;}if(game.mode==='demo'&&game.engines)return game.engines[p];return prefs[p===1?'redPolicy':'yellowPolicy']==='dcc'?'dcc':'classical';}
const policyLabel=p=>p==='dcc'?'AI + DCC':'Classical AI';
function readClock(){const parts=$('timeControl').value==='custom'?[$('customMinutes').value*60,$('customIncrement').value]:$('timeControl').value.split('+').map(Number);return {seconds:Math.max(0,Math.min(7200,+parts[0]||0)),increment:Math.max(0,Math.min(300,+parts[1]||0))};}
function resetTime(untimed=false){const o=untimed?{seconds:0,increment:0}:readClock();playerClock=T.create({...o,turn:state().curPlayer,now:mono()});clockTape=[T.copy(playerClock)];timing=[];timeResult=null;}
function syncClock(){
 if(!playerClock)return;
 if(paused||animating||state().result||timeResult)T.pause(playerClock,mono());
 else if(!playerClock.running){playerClock.turn=state().curPlayer;T.resume(playerClock,mono());}
 $('timers').hidden=!prefs.showTimers;
 for(const p of [1,2]){$('time'+p).textContent=T.format(playerClock.mode==='countdown'?playerClock.remaining[p]:playerClock.used[p]);$('time'+p).classList.toggle('running',playerClock.running&&playerClock.turn===p);}
 $('timerNote').textContent=simActive?t('simTimeNote'):t(playerClock.mode==='countdown'?'countdownNote':'elapsedNote');
}
function tickClock(){
 if(!playerClock)return;T.tick(playerClock,mono());
 if(playerClock.flagged&&!timeResult){timeResult={winner:3-playerClock.flagged,termination:'timeout',at_utc:new Date().toISOString()};stopWork();paused=true;render();persist();}
 syncClock();
}
function envelope(){const x=envelopeBase();x.lab={schema:1,clock:T.snapshot(playerClock,mono()),clockTape,timing,timeResult,tournament,simActive,simArchive,beforeSim};return x;}
function validateTournament(t){
 if(t===null||t===undefined)return null;
 if(!t||t.version!==SIM.VERSION||!Array.isArray(t.jobs)||t.jobs.length>200||!Array.isArray(t.runs)||t.runs.length>200||!Number.isInteger(t.index)||t.index<0||t.index>t.jobs.length)throw Error('Invalid tournament checkpoint');
 for(const j of t.jobs){E.validate(j.start);if(!['dcc','classical'].includes(j.red)||!['dcc','classical'].includes(j.yellow)||E.key(j.start)!==j.positionKey)throw Error('Invalid tournament job');}
 for(const r of t.runs){let s=E.validate(r.start);if(!Array.isArray(r.trace)||r.trace.length>384)throw Error('Invalid trace length');for(const row of r.trace){if(E.key(s)!==row.before||!E.validMove(s,row.move))throw Error('Invalid experiment trace');s=E.action(s,row.move);if(E.key(s)!==row.after)throw Error('Experiment hash mismatch');}if(r.status==='complete'&&s.result!==r.result)throw Error('Invalid experiment result');}
 return JSON.parse(JSON.stringify(t));
}
function decodeSave(data){
 const x=decodeSaveBase(data),l=data?.lab;
 if(l){if(l.schema!==1||!T.valid(l.clock)||!Array.isArray(l.clockTape)||l.clockTape.length!==x.states.length||!l.clockTape.every(T.valid)||!Array.isArray(l.timing)||l.timing.length!==x.states.length-1)throw Error('Invalid clock/history checkpoint');if(l.timeResult&&(![1,2].includes(l.timeResult.winner)||l.timeResult.termination!=='timeout'))throw Error('Invalid clock outcome');validateTournament(l.tournament);if(l.beforeSim)decodeSaveBase(l.beforeSim);if(!Array.isArray(l.simArchive)||l.simArchive.length>20)throw Error('Invalid experiment archive');for(const old of l.simArchive)validateTournament(old);x.lab=JSON.parse(JSON.stringify(l));}
 return x;
}
function restoreLab(x){
 const l=x.lab;if(l){playerClock=T.restore(l.clock,mono());clockTape=l.clockTape;timing=l.timing;timeResult=l.timeResult||null;tournament=l.tournament;simActive=!!l.simActive&&!!tournament&&tournament.index<tournament.jobs.length;simArchive=l.simArchive;beforeSim=l.beforeSim||null;}
 else{resetTime(true);clockTape=states.map(s=>T.create({turn:s.curPlayer}));timing=Array(moves.length).fill(null);tournament=null;simActive=false;}
}
function installSave(x){stopWork();clearHint();states=x.states;moves=x.moves;archived=x.archived;cursor=x.cursor;game=x.game;paused=true;magMode=false;lastStats=null;restoreLab(x);setAngle(-state().gravityDir*90);render();persist();}
function preferences(){
 for(const k of ['mode','tools','difficulty','first','style','redPolicy','yellowPolicy','timeControl'])prefs[k]=$(k).value;
 prefs.showTimers=$('showTimers').checked;prefs.showTimestamps=$('showTimestamps').checked;prefs.dcc=prefs.redPolicy==='dcc'||prefs.yellowPolicy==='dcc';$('style').disabled=!prefs.dcc;
 $('customTime').hidden=prefs.timeControl!=='custom';try{localStorage.setItem(PREF,JSON.stringify(prefs));}catch(_){}
}
function render(paths=null){
 renderBase(paths);syncClock();
 for(const p of [1,2]){$('name'+p).textContent=game.mode==='pvp'?color(p):game.mode==='cpu'&&p===game.human?t('you'):policyLabel(currentPolicy(p));}
 if(timeResult){$('status').textContent=color(timeResult.winner)+' · '+t('timeWin');$('outcome').hidden=false;$('outcomeTitle').textContent=color(timeResult.winner)+' '+t('win');$('outcomeText').textContent=t('timeWin');for(const el of [...cells,...rim,$('flipLeft'),$('flipRight'),$('magnet'),$('hint'),$('pause')])el.disabled=true;}
 if(prefs.showTimestamps){[...$('moveList').children].forEach((b,i)=>{const r=timing[i-1];if(r?.at_utc){const stamp=document.createElement('small');stamp.className='timestamp';stamp.textContent=new Date(r.at_utc).toLocaleTimeString(prefs.lang==='sl'?'sl-SI':'en-US')+' · '+(r.think_ms/1000).toFixed(1)+'s';b.append(stamp);}});}
 for(const id of ['mode','tools','first','difficulty','style','redPolicy','yellowPolicy','timeControl'])$(id).disabled=simActive||(id==='style'&&!prefs.dcc);
 $('simReturn').hidden=!beforeSim;$('simNextGame').hidden=!(simActive&&paused&&state().result&&tournament.index<tournament.jobs.length);
 renderSim();
}
function optionsFor(kind){
 if(simActive&&kind==='ai')return {...tournament.config.search,band:12,style:tournament.config.style};
 const o={mode:'time',...(levels[prefs.difficulty]||levels.casual),band:12,style:prefs.style};if(kind==='hint'){o.ms=Math.max(o.ms,1000);o.depth=Math.max(o.depth,6);}return o;
}
function request(kind){
 if(state().result||animating||timeResult)return;
 stopWork();clearHint();if(kind==='hint'&&isCPU())paused=true;
 const options=optionsFor(kind),key=E.key(state()),id=++job,policy=currentPolicy();thinking=true;render();
 const start=mono();clock=setInterval(()=>{if(id!==job)return;$('statTime').textContent=((mono()-start)/1000).toFixed(1)+' s';},100);
 const receive=data=>{
  if(data.id!==job||E.key(state())!==key)return;
  if(data.type==='progress'){$('statDepth').textContent=data.answer.depth;$('statNodes').textContent=data.answer.work;$('searchBar').style.width=(options.mode==='work'?Math.min(95,data.answer.work/options.work*100):Math.min(95,(mono()-start)/options.ms*100))+'%';return;}
  clearTimeout(watchdog);clearInterval(clock);if(worker){worker.terminate();worker=null;}if(workerURL){URL.revokeObjectURL(workerURL);workerURL=null;}thinking=false;
  if(data.type==='error'){paused=true;render();persist();message(t('error')+' '+data.error);return;}
  const a=data.answer,pick=policy==='dcc'?a.dcc:a.classical;lastStats=a;showStats(a);render();
  if(!pick||!E.validMove(state(),pick.move)){paused=true;render();message(t('noMoves'));return;}
  if(kind==='hint'){lastHint=pick.move;message(t('hintLabel')+': '+fmt(pick.move));if(pick.move.type==='drop')preview(pick.move);return;}
  if(paused)return;
  pendingDecision={answer:a,policy,key};play(pick.move);
 };
 // Time-mode fault detector is not a chess-clock adjudicator. Work mode is finite
 // but has no wall deadline, preserving deterministic completion on slow devices.
 if(options.mode!=='work')watchdog=setTimeout(()=>{if(id!==job)return;stopWork();paused=true;render();persist();message(t('slow'));},options.ms+5000);
 try{
  const inline=$('f4m-worker-source');if(inline){workerURL=URL.createObjectURL(new Blob([inline.textContent],{type:'text/javascript'}));worker=new Worker(workerURL);}else worker=new Worker('f4m-worker.js?v=2.1.0-lab.1');
  worker.onmessage=e=>receive(e.data);worker.onerror=e=>receive({id,type:'error',error:e.message});worker.postMessage({id,state:E.copy(state()),options});
 }catch(error){receive({id,type:'error',error:error.message});}
}
function showStats(a){
 if(!a?.report)return;
 const r=a.report;$('statDepth').textContent=r.depth;$('statNodes').textContent=r.work.toLocaleString();$('statTime').textContent=(a.compute_ms/1000).toFixed(2)+' s';$('searchBar').style.width='100%';
 $('searchInfo').textContent=t('coverage')+': '+r.coverage+' · '+r.nodes+' '+t('nodes')+' · '+a.dcc.reason;
 $('comparison').textContent='Classical: '+fmt(a.classical?.move)+' | DCC: '+fmt(a.dcc?.move)+' | Δ '+(a.dcc?.rawGap??'—');
 $('candidates').replaceChildren();for(const row of a.dcc?.sensorTable||[]){const d=document.createElement('div'),left=document.createElement('span'),right=document.createElement('span');left.textContent=fmt(row.move);right.textContent=Math.round(row.raw)+' → '+row.score.toFixed(1)+' · GS '+row.gs.toFixed(1)+' MR '+row.mr.toFixed(1);d.append(left,right);$('candidates').append(d);}
}
function play(a){
 if(animating||state().result||timeResult||!E.validMove(state(),a))return;
 const old=E.copy(state()),decision=pendingDecision;pendingDecision=null;
 const change=E.action(old,a,true),record=T.move(playerClock,old.curPlayer,change.state.curPlayer,mono(),new Date().toISOString());
 if(!record){tickClock();return;}clearHint();message('');
 if(cursor<states.length-1){archived.push({from:cursor,states:states.slice(cursor+1),moves:moves.slice(cursor),timing:timing.slice(cursor),clockTape:clockTape.slice(cursor+1)});states=states.slice(0,cursor+1);moves=moves.slice(0,cursor);timing=timing.slice(0,cursor);clockTape=clockTape.slice(0,cursor+1);message(t('branch'));}
 states.push(change.state);moves.push(a);timing.push(record);clockTape.push(T.copy(playerClock));cursor++;
 if(simActive&&decision&&decision.key===E.key(old))SIM.record(tournament.runs[tournament.runs.length-1],old,change.state,decision.answer,decision.policy,record.at_utc);
 const epoch=++animationEpoch,started=mono();animating=true;magMode=false;
 const fast=simActive&&tournament.config.speed==='fast';
 const finish=()=>{if(epoch!==animationEpoch)return;record.presentation_ms=mono()-started;animating=false;render();persist();if(simActive&&state().result)finishSimGame();else scheduleAI();};
 if(fast){setAngle(-state().gravityDir*90);render();persist();setTimeout(finish,0);return;}
 render(change.paths);persist();const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(a.type==='flip')setAngle(angle+(a.delta===1?-90:90),!reduce);
 const animate=()=>{if(epoch!==animationEpoch)return;[...$('pieces').children].forEach((el,i)=>{el.style.left=change.paths[i].toC*12.5+'%';el.style.top=change.paths[i].toR*12.5+'%';});setTimeout(finish,reduce?0:360);};
 requestAnimationFrame(()=>requestAnimationFrame(()=>{if(a.type==='flip'&&!reduce)setTimeout(animate,470);else animate();}));
}
function scheduleAI(){if(!paused&&!animating&&!thinking&&!state().result&&!timeResult&&isCPU())request('ai');}
function stopSim(reason='interrupted'){
 simGeneration++;if(simActive&&tournament){const run=tournament.runs[tournament.runs.length-1];if(run&&run.status==='running'){run.status='incomplete';run.termination=reason;}tournament.status='stopped';}simActive=false;
}
function navigate(i){if(i<0||i>=states.length)return;stopWork();if(simActive)stopSim('history-navigation');paused=true;magMode=false;clearHint();cursor=i;playerClock=T.restore(clockTape[i]||T.create({turn:state().curPlayer}),mono());timeResult=null;setAngle(-state().gravityDir*90);render();persist();message(t('reviewNote'));}
function undo(){if(!cursor)return;stopWork();if(simActive)stopSim('undo');clearHint();cursor--;if(game.mode==='cpu')while(cursor>0&&state().curPlayer!==game.human)cursor--;paused=game.mode==='demo'||(game.mode==='cpu'&&state().curPlayer!==game.human);playerClock=T.restore(clockTape[cursor],mono());timeResult=null;magMode=false;setAngle(-state().gravityDir*90);render();persist();message('');}
function togglePause(){
 if(timeResult)return;
 if(simActive&&state().result){if(paused){paused=false;if(tournament.index>=tournament.runs.length)nextSimGame();else finishSimGame();}else{stopWork();paused=true;render();persist();}return;}
 if(state().result)return;
 if(!paused){stopWork();paused=true;setAngle(-state().gravityDir*90);clearHint();render();}else{paused=false;render();message('');scheduleAI();}persist();
}
function start(force=false){
 if(!force&&cursor>0&&!state().result&&!confirm(t('newConfirm')))return;
 stopWork();stopSim('new-game');preferences();clearHint();game={mode:prefs.mode,human:prefs.first==='cpu'?2:1,tools:Number(prefs.tools)};states=[E.create(game.tools)];moves=[];archived=[];cursor=0;paused=false;magMode=false;lastStats=null;resetTime(game.mode==='demo');setAngle(0);render();message('');persist();scheduleAI();
}
function renderSim(){
 const summary=SIM.summary(tournament);$('simStats').textContent=tournament?(summary.games+'/'+tournament.jobs.length+' · DCC '+summary.w+' / '+summary.d+' / '+summary.l+' · '+t('unique')+' '+summary.uniqueStarts+' · '+t('changes')+' '+summary.interventions+'/'+summary.comparedMoves):t('noExperiments');
 $('simCI').textContent=summary.ci?'95% CI '+summary.ci.map(x=>(100*x).toFixed(1)+'%').join(' – '):t('ciNote');
 $('simDetail').textContent=summary.comparedMoves?Object.entries(summary.sideStats).map(([p,s])=>policyLabel(p)+': '+(s.compute_ms/Math.max(1,s.moves)).toFixed(0)+' ms/'+t('move')+' · ↶ '+s.flips+' ⊓ '+s.magnets).join(' | '):'';
 $('simRunList').replaceChildren();for(const [i,r] of (tournament?.runs||[]).entries()){const b=document.createElement('button');b.textContent='#'+(i+1)+' · '+r.red+' / '+r.yellow+' · '+r.status+' · '+r.result;b.onclick=()=>inspectRun(i);$('simRunList').append(b);}
}
function launchSim(){
 stopWork();stopSim('new-experiment');if(tournament){if(simArchive.length>=20){message(prefs.lang==='sl'?'Najprej izvozi arhiv eksperimentov.':'Export the experiment archive first.');return;}simArchive.push(tournament);}
 if(!beforeSim){beforeSim=envelopeBase();beforeSim.lab={schema:1,clock:T.snapshot(playerClock,mono()),clockTape,timing,timeResult,tournament:null,simActive:false,simArchive:[],beforeSim:null};}
 const base=$('simStartFrom').value==='current'?E.copy(state()):E.create(Number(prefs.tools));
 if(base.result){message(t('terminalStart'));return;}
 const work=$('simBudgetMode').value==='work',budget=Number($('simBudget').value),depth=Number($('simDepth').value);
 const config={red:$('simRed').value,yellow:$('simYellow').value,paired:$('simPair').checked,pairs:Number($('simPairs').value),seed:Number($('simSeed').value),seeded:$('simSeeded').checked,speed:$('simSpeed').value,search:work?{mode:'work',work:budget,depth}:{mode:'time',ms:budget,depth},style:prefs.style};
 tournament=SIM.plan(base,config);simActive=true;paused=false;simGeneration++;$('simDialog').close();nextSimGame();
}
function nextSimGame(){
 if(!simActive||!tournament||paused)return;
 if(tournament.index>=tournament.jobs.length){tournament.status='complete';simActive=false;paused=true;render();persist();return;}
 if(tournament.runs.length>tournament.index)return;const run=SIM.begin(tournament);states=[E.copy(run.start)];moves=[];archived=[];cursor=0;game={mode:'demo',human:1,tools:Number(prefs.tools),engines:{1:run.red,2:run.yellow}};resetTime(true);timeResult=null;lastStats=null;setAngle(-state().gravityDir*90);render();persist();scheduleAI();
}
function finishSimGame(){
 if(!simActive||paused||!state().result)return;
 const run=tournament.runs[tournament.runs.length-1];if(run.status!=='complete')return;
 tournament.index++;const gen=simGeneration;persist();
 if(tournament.index>=tournament.jobs.length){tournament.status='complete';simActive=false;paused=true;render();persist();return;}
 setTimeout(()=>{if(simActive&&gen===simGeneration&&!paused)nextSimGame();},tournament.config.speed==='fast'?10:900);
}
function inspectRun(index){
 const r=tournament?.runs[index];if(!r)return;stopWork();stopSim('inspect-run');let s=E.copy(r.start);states=[s];moves=[];for(const row of r.trace){s=E.action(s,row.move);states.push(s);moves.push(row.move);}cursor=states.length-1;archived=[];game={mode:'pvp',human:1,tools:2};resetTime(true);clockTape=states.map(s=>T.create({turn:s.curPlayer}));timing=r.trace.map(row=>({at_utc:row.at_utc,think_ms:row.compute_ms}));paused=true;setAngle(-state().gravityDir*90);render();persist();
}
function downloadData(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function bootLab(){
 for(const k of ['redPolicy','yellowPolicy','timeControl'])if([...$(k).options].some(o=>o.value===prefs[k]))$(k).value=prefs[k];
 $('showTimers').checked=!!prefs.showTimers;$('showTimestamps').checked=!!prefs.showTimestamps;
 for(const id of ['redPolicy','yellowPolicy','timeControl','showTimers','showTimestamps'])$(id).onchange=()=>{preferences();render();persist();};
 $('sim').onclick=()=>{stopWork();paused=true;render();$('simDialog').showModal();};$('simCancel').onclick=()=>$('simDialog').close();$('simLaunch').onclick=launchSim;
 $('simSwap').onclick=()=>{const a=$('simRed'),b=$('simYellow');[a.value,b.value]=[b.value,a.value];};
 $('simBudgetMode').onchange=()=>{$('simBudget').value=$('simBudgetMode').value==='work'?4000:500;};
 $('simExportJSON').onclick=()=>downloadData('Flip4M_Lab_experiments.json',JSON.stringify({format:'flip4m.experiments',version:1,tournament,archive:simArchive},null,2),'application/json');
 $('simExportCSV').onclick=()=>downloadData('Flip4M_Lab_experiments.csv',SIM.csv(tournament),'text/csv');
 $('simReturn').onclick=()=>{if(!beforeSim)return;const saved=decodeSave(beforeSim);stopSim('return-to-study');const retained=[...simArchive,...(tournament?[tournament]:[])];beforeSim=null;installSave(saved);simArchive=retained;render();persist();};
 $('simNextGame').onclick=()=>{simGeneration++;paused=false;nextSimGame();};
 let restored=false;try{const raw=localStorage.getItem(SAVE);if(raw){const x=decodeSave(JSON.parse(raw));states=x.states;moves=x.moves;archived=x.archived;cursor=x.cursor;game=x.game;restoreLab(x);paused=true;restored=true;}}catch(error){console.warn('Flip4M Lab checkpoint rejected:',error.message);}
 if(!restored){game={mode:prefs.mode,human:prefs.first==='cpu'?2:1,tools:Number(prefs.tools)};states=[E.create(game.tools)];resetTime(game.mode==='demo');}
 preferences();setAngle(-state().gravityDir*90);translate();persist();setInterval(tickClock,100);
 window.addEventListener('pagehide',()=>{stopWork();paused=true;T.pause(playerClock,mono());persist();});
 if(restored)message(t('restored'));else scheduleAI();
 window.F4MLab=Object.freeze({version:E.VERSION,snapshot:()=>JSON.parse(JSON.stringify(envelope())),status:()=>({paused,thinking,animating,cursor,job,simActive,lastStats}),validateSave:decodeSave});window.F4MPreview=window.F4MLab;
}
bootLab();

})();
