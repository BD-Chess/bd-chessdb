'use strict';
// Embedded at the end of the self-contained APP game. The LAB solver/game
// stays the source of truth; this layer changes only its APP presentation.
(() => {
 const $ = id => document.getElementById(id);
 const panel = $('aiAssistPanel');
 const product = window.SudokuNavigator?.product;
 if (!panel || !product) return;

 const TEXT_KEY='8zSudoku.app.ui.textSize';
 const textSizes=new Set(['compact','normal','large']);
 const readTextSize=()=>{try{const v=localStorage.getItem(TEXT_KEY);return textSizes.has(v)?v:'normal';}catch(_){return 'normal';}};
 const applyTextSize=v=>{const size=textSizes.has(v)?v:'normal';document.body.dataset.appTextSize=size;try{localStorage.setItem(TEXT_KEY,size);}catch(_){}};
 const UI_PREFS={
  numberPad:{key:'8zSudoku.app.ui.numberPad',allowed:new Set(['off','on']),def:'off'},
  coach:{key:'8zSudoku.app.ui.coach',allowed:new Set(['off','easy','always']),def:'easy'},
  coachDetail:{key:'8zSudoku.app.ui.coachDetail',allowed:new Set(['short','detailed']),def:'short'},
  holdTip:{key:'8zSudoku.app.ui.holdTip',allowed:new Set(['off','on']),def:'on'}
 };
 const readUiPref=name=>{const p=UI_PREFS[name];try{const v=localStorage.getItem(p.key);return p.allowed.has(v)?v:p.def;}catch(_){return p.def;}};
 const writeUiPref=(name,value)=>{const p=UI_PREFS[name];if(!p.allowed.has(value))return false;try{localStorage.setItem(p.key,value);return true;}catch(_){return false;}};

 const dock = document.createElement('nav');
 dock.id = 'appDock';
 dock.setAttribute('aria-label', 'Game controls');
 dock.innerHTML =
  '<button type="button" id="appNotes" aria-pressed="false"><span class="app-dock-icon" aria-hidden="true">✎</span><span class="app-dock-label">Notes</span></button>'+
  '<button type="button" id="appErase"><span class="app-dock-icon" aria-hidden="true">⌫</span><span class="app-dock-label">Erase</span></button>'+
  '<button type="button" id="appUndo"><span class="app-dock-icon" aria-hidden="true">↶</span><span class="app-dock-label">Undo</span></button>'+
  '<button type="button" id="appAssist" aria-pressed="false"><span class="app-dock-icon" aria-hidden="true">✦</span><span class="app-dock-label">AI Assist</span></button>'+
  '<button type="button" id="appMore"><span class="app-dock-icon" aria-hidden="true">⋯</span><span class="app-dock-label">More</span></button>';

 const scrim = document.createElement('button');
 scrim.type = 'button';
 scrim.id = 'appAssistScrim';
 scrim.setAttribute('aria-label', 'Return to board');
 document.querySelector('.page').append(scrim);
 document.body.append(dock);

 const numbersPanel=$('numpad')?.closest('.mobile-input-panel')||$('plNumbers');
 const holdTip=document.createElement('p');
 holdTip.id='appHoldTip';holdTip.className='app-hold-tip';holdTip.setAttribute('role','note');
 const coach=document.createElement('section');
 coach.id='appCoach';coach.className='app-coach-card';coach.setAttribute('aria-live','polite');
 coach.innerHTML='<div class="app-coach-title">Sudoku Coach</div><div class="app-coach-copy" id="appCoachCopy"></div><div class="app-coach-actions"><button type="button" id="appCoachWhy">Why?</button><button type="button" id="appCoachCandidates">Show candidates</button></div>';
 if(numbersPanel)numbersPanel.before(holdTip,coach);

 const isSl = () => window.SudokuI18n?.get?.() === 'sl';
 const label = (id,text) => {
  const node=$(id)?.querySelector('.app-dock-label');
  if(node && node.textContent!==text)node.textContent=text;
 };
 const setLabel = (node,value) => {
  if(node && node.getAttribute('aria-label')!==value)node.setAttribute('aria-label',value);
 };
 const proxy = (source,target) => $(source)?.addEventListener('click',()=>{
  $(target)?.click();
  queueMicrotask(sync);
 });

 const iconMap={
  'New game':'＋','Nova igra':'＋','What’s new':'✦','Kaj je novega':'✦',
  'Quick tutorial · optional':'◎','Kratka vaja · neobvezno':'◎','Redo':'↻','Uveljavi znova':'↻',
  'My games':'▦','Moje igre':'▦','Daily puzzles':'◫','Dnevne uganke':'◫',
  'Share puzzle':'↗','Deli uganko':'↗','Check correctness':'✓','Preveri pravilnost':'✓',
  'Review':'◎','Pregled':'◎','Settings':'⚙','Nastavitve':'⚙','Help / About':'?',
  'Pomoč / O igri':'?','Import session':'⇩','Uvozi igro':'⇩','Export session':'⇧','Izvozi igro':'⇧',
  'Delete all APP data':'⌫','Izbriši vse podatke APP':'⌫','App · offline & updates':'◌',
  'Aplikacija · brez povezave in posodobitve':'◌','AI solve review':'◀▶','Pregled AI reševanja':'◀▶','Human solve review':'◎','Pregled človeškega reševanja':'◎'
 };
 function decorateMenuButton(button){
  if(button.dataset.appDecorated)return;
  const text=button.textContent.trim(),icon=iconMap[text]||'•';
  button.dataset.appDecorated='true';
  button.dataset.appMenuLabel=text;
  button.innerHTML='<span class="app-menu-icon" aria-hidden="true">'+icon+'</span><span class="app-menu-label"></span>';
  button.querySelector('.app-menu-label').textContent=text;
  if(/Delete all APP data|Izbriši vse podatke APP/.test(text))button.classList.add('app-menu-danger');
 }
 function decorateMore(){
  const modal=$('navModal'),body=$('navModalBody');
  if(!modal||!body)return;
  modal.classList.add('app-more-modal');
  body.querySelectorAll('button.btn').forEach(decorateMenuButton);
 }
 function enhanceMore(){
  const body=$('navModalBody');
  if(!body)return;
  if(!$('appMorePrimary')){
   const sl=isSl(), group=document.createElement('div');
   group.id='appMorePrimary';
   group.className='ux-menu app-more-primary';
   group.innerHTML =
    '<button class="btn" id="appMoreNew">'+(sl?'Nova igra':'New game')+'</button>'+
    '<button class="btn" id="appMoreNews">'+(sl?'Kaj je novega':'What’s new')+'</button>'+
    '<button class="btn" id="appMoreTutorial">'+(sl?'Kratka vaja · neobvezno':'Quick tutorial · optional')+'</button>';
   body.prepend(group);
   $('appMoreNew').onclick=()=>{$('navClose')?.click();queueMicrotask(()=>$('uxNew')?.click());};
   $('appMoreNews').onclick=()=>{$('navClose')?.click();queueMicrotask(()=>$('plNewsOpen')?.click());};
   $('appMoreTutorial').onclick=()=>{$('navClose')?.click();queueMicrotask(()=>$('plTutorialOpen')?.click());};
  }
  const reviewAPI=window.SudokuSolveReview,primary=$('appMorePrimary');
  let aiReview=$('appMoreAIReview');
  if(reviewAPI?.hasReview?.()){
   if(!aiReview){
    aiReview=document.createElement('button');aiReview.className='btn';aiReview.id='appMoreAIReview';
    primary.append(aiReview);
    aiReview.onclick=()=>{$('navClose')?.click();queueMicrotask(()=>window.SudokuSolveReview?.open?.());};
   }
   aiReview.hidden=false;aiReview.textContent=isSl()?'Pregled AI reševanja':'AI solve review';delete aiReview.dataset.appDecorated;
  }else if(aiReview)aiReview.hidden=true;
  let humanReview=$('appMoreHumanReview');
  if(reviewAPI?.hasHumanReview?.()){
   if(!humanReview){
    humanReview=document.createElement('button');humanReview.className='btn';humanReview.id='appMoreHumanReview';
    primary.append(humanReview);
    humanReview.onclick=()=>{$('navClose')?.click();queueMicrotask(()=>window.SudokuSolveReview?.openHuman?.());};
   }
   humanReview.hidden=false;humanReview.textContent=isSl()?'Pregled človeškega reševanja':'Human solve review';delete humanReview.dataset.appDecorated;
  }else if(humanReview)humanReview.hidden=true;
  decorateMore();
 }
 function enhanceSettings(){
  $('navModal')?.classList.remove('app-more-modal');
  const body=$('navModalBody'),anchor=$('uxSettings');
  if(!body||!anchor||$('appSettingsExtras'))return;
  const sl=isSl(),wrap=document.createElement('div');
  wrap.id='appSettingsExtras';wrap.className='app-settings-extras';
  const options=(items,current)=>items.map(([v,t])=>'<option value="'+v+'"'+(v===current?' selected':'')+'>'+t+'</option>').join('');
  wrap.innerHTML=
   '<div class="ux-setting app-text-setting" id="appTextSizeSetting"><label for="appTextSize">'+(sl?'Velikost besedila':'Text size')+'</label><select id="appTextSize">'+
    options([['compact',sl?'Kompaktno':'Compact'],['normal',sl?'Običajno':'Normal'],['large',sl?'Veliko':'Large']],readTextSize())+'</select></div>'+
   '<div class="ux-setting"><label for="appNumberPad">'+(sl?'Številke pod mrežo':'Number pad')+'</label><select id="appNumberPad">'+
    options([['off',sl?'Izključeno':'Off'],['on',sl?'Vključeno':'On']],readUiPref('numberPad'))+'</select></div>'+
   '<div class="ux-setting"><label for="appCoachMode">'+(sl?'Sudoku Coach':'Sudoku Coach')+'</label><select id="appCoachMode">'+
    options([['off',sl?'Izključeno':'Off'],['easy',sl?'Samo Lahka':'Easy only'],['always',sl?'Lahka + Srednja':'Easy + Medium']],readUiPref('coach'))+'</select></div>'+
   '<div class="ux-setting"><label for="appCoachDetail">'+(sl?'Podrobnost Coach-a':'Coach detail')+'</label><select id="appCoachDetail">'+
    options([['short',sl?'Kratko':'Short'],['detailed',sl?'Podrobno':'Detailed']],readUiPref('coachDetail'))+'</select></div>'+
   '<div class="ux-setting"><label for="appHoldTipSetting">'+(sl?'Namig Tapni in drži':'Tap & hold tip')+'</label><select id="appHoldTipSetting">'+
    options([['on',sl?'Vključeno':'On'],['off',sl?'Izključeno':'Off']],readUiPref('holdTip'))+'</select></div>';
  anchor.before(wrap);
  $('appTextSize').onchange=e=>{applyTextSize(e.target.value);updateCoach();};
  $('appNumberPad').onchange=e=>{writeUiPref('numberPad',e.target.value);updateCoach();};
  $('appCoachMode').onchange=e=>{writeUiPref('coach',e.target.value);updateCoach();};
  $('appCoachDetail').onchange=e=>{writeUiPref('coachDetail',e.target.value);updateCoach();};
  $('appHoldTipSetting').onchange=e=>{writeUiPref('holdTip',e.target.value);updateCoach();};
 }

 const rc=i=>'R'+(Math.floor(i/9)+1)+'C'+(i%9+1);
 const difficulty=()=>{
  try{if(typeof currentDiff==='string')return currentDiff.toLowerCase();}catch(_){}
  const raw=($('plGameStatus')?.textContent||'').toLowerCase();
  if(/lahka|easy/.test(raw))return'easy';if(/srednja|medium/.test(raw))return'medium';if(/zelo težka|evil/.test(raw))return'evil';if(/težka|hard/.test(raw))return'hard';return'';
 };
 const capture=()=>{try{return product.capture?.()||null;}catch(_){return null;}};
 function candidates(board,index){
  if(!Array.isArray(board)||board.length!==81||board[index])return[];
  const r=Math.floor(index/9),c=index%9,used=new Set();
  for(let x=0;x<9;x++){used.add(board[r*9+x]);used.add(board[x*9+c]);}
  const br=Math.floor(r/3)*3,bc=Math.floor(c/3)*3;
  for(let rr=br;rr<br+3;rr++)for(let cc=bc;cc<bc+3;cc++)used.add(board[rr*9+cc]);
  return[1,2,3,4,5,6,7,8,9].filter(d=>!used.has(d));
 }
 const candidateMap=board=>Array.from({length:81},(_,i)=>board[i]?[]:candidates(board,i));
 function hiddenSingle(board,all,index,digit){
  if(board[index])return null;
  const r=Math.floor(index/9),c=index%9;
  const units=[
   Array.from({length:9},(_,x)=>r*9+x),
   Array.from({length:9},(_,x)=>x*9+c),
   Array.from({length:9},(_,k)=>(Math.floor(r/3)*3+Math.floor(k/3))*9+Math.floor(c/3)*3+k%3)
  ];
  const names=['row','column','box'];
  for(let u=0;u<units.length;u++)if(units[u].filter(i=>!board[i]&&all[i].includes(digit)).length===1)return names[u];
  return null;
 }
 function forcedCell(board,all=candidateMap(board)){
  if(!Array.isArray(board)||board.length!==81)return null;
  for(let i=0;i<81;i++)if(!board[i]&&all[i].length===1)return{index:i,digit:all[i][0],kind:'naked'};
  for(let i=0;i<81;i++)if(!board[i])for(const d of all[i]){const unit=hiddenSingle(board,all,i,d);if(unit)return{index:i,digit:d,kind:'hidden',unit};}
  return null;
 }
 // Coach derives statements only from visible entries, never the solved grid.
 function boardIssue(board,puzzle){
  if(!Array.isArray(board)||board.length!==81||board.some(v=>!Number.isInteger(v)||v<0||v>9))return {kind:'invalid'};
  if(Array.isArray(puzzle)&&puzzle.length===81){for(let i=0;i<81;i++)if(puzzle[i]&&puzzle[i]!==board[i])return{kind:'given',index:i};}
  for(let k=0;k<9;k++){
   const units=[Array.from({length:9},(_,x)=>k*9+x),Array.from({length:9},(_,x)=>x*9+k),Array.from({length:9},(_,x)=>(Math.floor(k/3)*3+Math.floor(x/3))*9+(k%3)*3+x%3)];
   for(let u=0;u<3;u++){const seen=new Map();for(const i of units[u]){const d=board[i];if(!d)continue;if(seen.has(d))return{kind:'duplicate',digit:d,index:i,other:seen.get(d),unit:['row','column','box'][u]};seen.set(d,i);}}
  }
  for(let i=0;i<81;i++)if(!board[i]&&!candidates(board,i).length)return{kind:'empty',index:i};
  return null;
 }
 function coachProof(before,after,index){
  if(!Number.isInteger(index)||index<0||index>=81||boardIssue(before)||boardIssue(after))return null;
  if(before[index]||!after[index]||before.some((v,i)=>i!==index&&v!==after[i]))return null;
  const all=candidateMap(before),cs=all[index],digit=after[index];
  if(!cs.includes(digit))return null;
  if(cs.length===1)return{index,digit,kind:'naked'};
  const unit=hiddenSingle(before,all,index,digit);
  return unit?{index,digit,kind:'hidden',unit}:null;
 }
 let lastBoard=null,lastPuzzle=null,lastSelected=null,lastLanguage=null,coachMoment=null,coachTimer=0,disclosed=null;
 const setText=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};
 function setCoachText(text){setText($('appCoachCopy'),text);}
 function resetCoachMoment(){coachMoment=null;clearTimeout(coachTimer);}
 function updateCoach(showCandidates=false){
  const lab=product.view()==='lab',sl=isSl(),padOn=readUiPref('numberPad')==='on',mode=readUiPref('coach'),detail=readUiPref('coachDetail');
  const diff=difficulty(),hardNoHelp=diff==='hard'||diff==='evil';
  document.body.dataset.appHardNoHelp=hardNoHelp?'true':'false';
  if(numbersPanel)numbersPanel.hidden=lab||!padOn;
  holdTip.hidden=lab||hardNoHelp||readUiPref('holdTip')!=='on';
  setText(holdTip,sl?'Tapni in drži prazno celico za pojavni izbor številke.':'Tap & hold an empty cell to open the number picker.');
  const allowed=mode==='always'&&!hardNoHelp||mode==='easy'&&(!diff||diff==='easy');
  coach.hidden=lab||hardNoHelp||padOn||mode==='off'||!allowed;
  setText(coach.querySelector('.app-coach-title'),'Sudoku Coach');
  setText($('appCoachWhy'),sl?'Zakaj?':'Why?');setText($('appCoachCandidates'),sl?'Pokaži kandidate':'Show candidates');
  if(coach.hidden){lastBoard=null;disclosed=null;resetCoachMoment();return;}
  let restoreBusy=false;try{restoreBusy=typeof restoring==='number'&&restoring>0;}catch(_){}
  if(restoreBusy){lastBoard=null;resetCoachMoment();$('appCoachWhy').disabled=true;$('appCoachCandidates').disabled=true;setCoachText(sl?'Obnavljam shranjeno igro …':'Restoring your saved game…');return;}
  const state=capture(),board=state?.board;
  if(!Array.isArray(board)||board.length!==81){lastBoard=null;resetCoachMoment();$('appCoachWhy').disabled=true;$('appCoachCandidates').disabled=true;setCoachText(sl?'Izberi težavnost. Pri lahki igri te bom sproti usmerjal.':'Choose a difficulty. On Easy, I’ll guide you as you play.');return;}
  const selected=state.selectedCell,boardKey=board.join(''),puzzleKey=JSON.stringify([state.gameId||'',state.puzzle||[]]);
  const changed=lastBoard?board.map((v,i)=>v===lastBoard[i]?-1:i).filter(i=>i>=0):[];
  const newContext=lastPuzzle!==puzzleKey||lastSelected!==selected||lastLanguage!==sl;
  if(newContext||changed.length){disclosed=null;resetCoachMoment();}
  const issue=boardIssue(board,state.puzzle);
  if(lastBoard&&lastPuzzle===puzzleKey&&changed.length===1&&!issue){
   const proof=coachProof(lastBoard,board,changed[0]);
   if(proof){coachMoment=proof;coachTimer=setTimeout(()=>{coachMoment=null;updateCoach();},5200);}
  }
  lastBoard=board.slice();lastPuzzle=puzzleKey;lastSelected=selected;lastLanguage=sl;
  $('appCoachWhy').disabled=false;$('appCoachCandidates').disabled=true;
  if(issue){
   coach.dataset.state='conflict';
   const unitSL={row:'vrstici',column:'stolpcu',box:'bloku'}[issue.unit],unitEN={row:'row',column:'column',box:'3×3 box'}[issue.unit];
   setCoachText(issue.kind==='duplicate'?(sl?'Številka '+issue.digit+' se ponovi v isti '+unitSL+' ('+rc(issue.other)+' in '+rc(issue.index)+'). Najprej preveri vnos ali uporabi Razveljavi.':'Digit '+issue.digit+' repeats in the same '+unitEN+' ('+rc(issue.other)+' and '+rc(issue.index)+'). Check the entry or use Undo first.'):
    issue.kind==='empty'?(sl?'Za '+rc(issue.index)+' ne ostane noben kandidat. Preveri zadnje vnose; zdaj ni varno sklepati naprej.':'No candidate remains for '+rc(issue.index)+'. Check recent entries before making another deduction.'):
    issue.kind==='given'?(sl?'Začetna številka v '+rc(issue.index)+' ni ohranjena. Preveri obnovljeno igro.':'The given in '+rc(issue.index)+' is not preserved. Check the restored game.'):
    (sl?'Te mreže še ne morem varno razložiti.':'This grid cannot be explained safely yet.'));
   return;
  }
  coach.dataset.state='ready';
  if(board.every(Boolean)){setCoachText(sl?'Mreža je izpolnjena: vsaka vrstica, stolpec in blok vsebuje številke 1–9 brez ponovitev.':'Grid complete: every row, column and box contains 1–9 without repeats.');$('appCoachWhy').disabled=true;return;}
  const emptySelected=Number.isInteger(selected)&&selected>=0&&selected<81&&!board[selected];
  $('appCoachCandidates').disabled=!emptySelected;
  if(showCandidates&&emptySelected)disclosed=boardKey+':'+selected;
  if(emptySelected&&disclosed===boardKey+':'+selected){
   const cs=candidates(board,selected);
   setCoachText((sl?'Kandidati za ':'Candidates for ')+rc(selected)+': '+cs.join(', ')+'. '+(sl?'Dovoljeni glede na sedanje vnose v vrstici, stolpcu in bloku.':'Allowed by the current row, column and box entries.'));return;
  }
  if(coachMoment){
   const p=coachMoment,us={row:'vrstici',column:'stolpcu',box:'bloku'}[p.unit],ue={row:'row',column:'column',box:'3×3 box'}[p.unit];
   setCoachText(p.kind==='naked'?(sl?'Vnos '+p.digit+' v '+rc(p.index)+' sledi golemu posamezniku: glede na prejšnje vnose je ostal en kandidat.':'The '+p.digit+' in '+rc(p.index)+' follows a naked single: the previous entries left one candidate.'):
    (sl?'Vnos '+p.digit+' v '+rc(p.index)+' sledi skritemu posamezniku v '+us+'.':'The '+p.digit+' in '+rc(p.index)+' follows a hidden single in its '+ue+'.'));return;
  }
  if(Number.isInteger(selected)&&selected>=0&&selected<81){
   if(board[selected]){const given=state.puzzle?.[selected]||$('grid')?.children[selected]?.classList.contains('given');setCoachText(given?(sl?'To je začetna številka. Izberi prazno celico.':'That is a given. Choose an empty cell.'):(sl?'Celica je izpolnjena. Izberi prazno celico za pregled kandidatov.':'That cell is filled. Choose an empty cell to examine candidates.'));return;}
   const all=candidateMap(board),cs=all[selected];
   if(cs.length===1){setCoachText(sl?rc(selected)+': v vrstici, stolpcu in bloku izloči že uporabljene številke. Ostane en kandidat — goli posameznik.'+(detail==='detailed'?' S »Pokaži kandidate« preveri, kateri.':''):
    rc(selected)+': eliminate digits already used in its row, column and box. One candidate remains — a naked single.'+(detail==='detailed'?' Use “Show candidates” to check which one.':''));return;}
   for(const d of cs){const unit=hiddenSingle(board,all,selected,d);if(unit){const us={row:'vrstici',column:'stolpcu',box:'3×3 bloku'}[unit],ue={row:'row',column:'column',box:'3×3 box'}[unit];setCoachText(sl?'Primerjaj kandidate v isti '+us+' kot '+rc(selected)+'. Eden je mogoč samo v tej celici — skriti posameznik.':'Compare candidates in the same '+ue+' as '+rc(selected)+'. One candidate can go only here — a hidden single.');return;}}
   setCoachText(sl?rc(selected)+' ima po osnovnem pregledu '+cs.length+' kandidatov. '+(detail==='detailed'?'Primerjaj prazne celice v isti vrstici, stolpcu in bloku; išči številko, ki ima le eno dovoljeno mesto.':'Primerjaj še vrstico, stolpec in blok.'):
    rc(selected)+' has '+cs.length+' candidates after basic checks. '+(detail==='detailed'?'Compare empty cells in the same row, column and box; look for a digit with only one allowed place.':'Compare its row, column and box.'));return;
  }
  const forced=forcedCell(board,candidateMap(board));
  if(forced){setCoachText(sl?'Poskusi '+rc(forced.index)+' — osnovni pregled tam omogoča naslednji logični korak.'+(detail==='detailed'?' Preveri ponovitve in primerjaj kandidate; številke ne vnesem namesto tebe.':''):
   'Try '+rc(forced.index)+' — basic checks identify a logical next step there.'+(detail==='detailed'?' Check used digits and compare candidates; I won’t place the number for you.':''));return;}
  setCoachText(sl?'Izberi prazno celico. Preglej vrstico, stolpec in blok; več kandidatov še ni dokaz za eno številko.':'Choose an empty cell. Check its row, column and box; several candidates do not justify one digit yet.');
 }

 const sync = () => {
  const lab=product.view()==='lab';
  dock.hidden=lab;
  if(lab)document.body.dataset.appPanel='board';
  const notesOn=$('notesBtn')?.classList.contains('active')===true;
  $('appNotes').setAttribute('aria-pressed',String(notesOn));
  $('appNotes').disabled=$('notesBtn')?.disabled===true;
  $('appErase').disabled=$('uxErase')?.disabled===true;
  $('appUndo').disabled=$('uxUndo')?.disabled===true;
  $('appMore').disabled=$('uxMore')?.disabled===true;
  const reviewActive=!lab&&document.body.dataset.appSolveReview==='true'&&window.SudokuSolveReview?.active?.()===true;
  const assistActive=reviewActive||!lab && !panel.hidden && document.body.dataset.appPanel==='assist';
  $('appAssist').setAttribute('aria-pressed',String(assistActive));
  $('appAssist').disabled=$('solveBtn')?.disabled===true;
  const sl=isSl();
  label('appNotes',sl?'Zapiski':'Notes');
  label('appErase',sl?'Izbriši':'Erase');
  label('appUndo',sl?'Razveljavi':'Undo');
  label('appAssist',reviewActive?(sl?'AI pregled':'AI Review'):(sl?'Pomoč AI':'AI Assist'));
  label('appMore',sl?'Več':'More');
  setLabel(dock,sl?'Kontrole igre':'Game controls');
  setLabel(scrim,sl?'Nazaj na mrežo':'Return to board');
  updateCoach();
 };
 function showAssist(){
  if(product.view()==='lab')return;
  if(document.body.dataset.appSolveReview==='true'&&window.SudokuSolveReview?.active?.()){window.SudokuSolveReview.open();return;}
  if(!panel.hidden && document.body.dataset.appPanel==='assist'){$('aiAssistClose')?.click();return;}
  $('solveBtn')?.click();queueMicrotask(sync);
 }
 function showBoard(){document.body.dataset.appPanel='board';sync();}
 $('appCoachWhy')?.addEventListener('click',()=>{showAssist();setTimeout(()=>$('aiAssistWhy')?.click(),0);});
 $('appCoachCandidates')?.addEventListener('click',()=>updateCoach(true));
 proxy('appNotes','notesBtn');proxy('appErase','uxErase');proxy('appUndo','uxUndo');
 $('appAssist').addEventListener('click',showAssist);
 $('appMore').addEventListener('click',()=>{$('uxMore')?.click();queueMicrotask(()=>{enhanceMore();sync();});});
 scrim.addEventListener('click',showBoard);

 document.addEventListener('click', event => {
  const settings=event.target.closest?.('#navModalBody [data-menu="Settings"],#navModalBody [data-menu="Nastavitve"]');
  if(settings)setTimeout(enhanceSettings,0);
  if (product.view() === 'lab') return;
  const button = event.target.closest?.('#uxHint,#uxWhy,#solveBtn,#aiAssistClose');
  if (!button) return;
  if (button.id === 'aiAssistClose') {document.body.dataset.appPanel='board';sync();return;}
  event.preventDefault();event.stopImmediatePropagation();
  ({uxHint:'plHint',uxWhy:'plWhy',solveBtn:'plDemo'})[button.id] &&
   $(({uxHint:'plHint',uxWhy:'plWhy',solveBtn:'plDemo'})[button.id])?.click();
  if (!panel.hidden) {
   document.body.dataset.appPanel='assist';panel.scrollTop=0;
   $('aiAssistHint')?.focus({preventScroll:true});
  }
  sync();
 }, true);

 // Turn the filled-cell magnifier into a true finger-follow loupe without
 // changing the underlying read-only gesture transaction.
 let lastPoint=null;
 const pointFromTouch=e=>e.touches?.[0]||e.changedTouches?.[0]||null;
 function placeLoupe(x,y){
  const loupe=$('uxLoupe');if(!loupe||!Number.isFinite(x)||!Number.isFinite(y))return;
  const box=loupe.getBoundingClientRect(),vv=window.visualViewport;
  const left0=vv?.offsetLeft||0,top0=vv?.offsetTop||0,vw=vv?.width||innerWidth,vh=vv?.height||innerHeight,pad=10,offset=62;
  let left=x-box.width/2;
  let top=y-box.height-offset;
  if(top<top0+pad)top=y+42;
  left=Math.max(left0+pad,Math.min(left,left0+vw-box.width-pad));
  top=Math.max(top0+pad,Math.min(top,top0+vh-box.height-pad));
  loupe.style.left=Math.round(left)+'px';loupe.style.top=Math.round(top)+'px';
 }
 document.addEventListener('pointerdown',e=>{lastPoint={x:e.clientX,y:e.clientY};},{capture:true,passive:true});
 document.addEventListener('pointermove',e=>{lastPoint={x:e.clientX,y:e.clientY};placeLoupe(e.clientX,e.clientY);},{capture:true,passive:true});
 document.addEventListener('touchstart',e=>{const p=pointFromTouch(e);if(p)lastPoint={x:p.clientX,y:p.clientY};},{capture:true,passive:true});
 document.addEventListener('touchmove',e=>{const p=pointFromTouch(e);if(p){lastPoint={x:p.clientX,y:p.clientY};placeLoupe(p.clientX,p.clientY);}},{capture:true,passive:true});

 const menuBody=$('navModalBody');
 if(menuBody)new MutationObserver(()=>{if($('navModal')?.classList.contains('app-more-modal'))decorateMore();}).observe(menuBody,{childList:true,subtree:true});
 const grid=$('grid');
 let coachQueued=false;
 const scheduleCoach=(delay=0)=>{
  if(coachQueued)return;
  coachQueued=true;
  setTimeout(()=>{coachQueued=false;updateCoach();},delay);
 };
 if(grid){
  for(const event of ['click','pointerup','touchend'])grid.addEventListener(event,()=>scheduleCoach());
 }
 for(const id of ['numpad','appErase','appUndo','aiAssistApply','uxNew']){
  $(id)?.addEventListener('click',()=>scheduleCoach());
 }
 const gameStatus=$('plGameStatus');
 if(gameStatus)new MutationObserver(()=>scheduleCoach()).observe(gameStatus,{childList:true,subtree:true,characterData:true});
 // Bounded post-boot refreshes cover asynchronous saved-game recovery without
 // observing 81 changing cells or competing with the solver worker.
 setTimeout(()=>updateCoach(),600);
 setTimeout(()=>updateCoach(),2200);

 const watch = new MutationObserver(records=>{
  if($('navModal')?.hidden)$('navModal')?.classList.remove('app-more-modal');
  if(lastPoint&&$('uxLoupe'))placeLoupe(lastPoint.x,lastPoint.y);
  sync();
 });
 watch.observe(panel,{attributes:true,attributeFilter:['hidden']});
 watch.observe(document.body,{attributes:true,attributeFilter:['data-view','data-assist','data-app-solve-review'],childList:true,subtree:false});
 window.addEventListener('sudoku-solve-review-change',sync);
 watch.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 for(const id of ['notesBtn','uxErase','uxUndo','solveBtn','uxMore']){
  const node=$(id);if(node)watch.observe(node,{attributes:true,childList:true,subtree:true});
 }
 // Center the board in measured space between tabs and dock, not a
 // guessed viewport subtraction. This also handles framed APP and Safari bars.
 const layoutMain=document.querySelector('.main'),layoutTabs=document.querySelector('.pl-tabs');
 const layoutBoard=document.querySelector('.grid-wrap'),layoutColumn=document.querySelector('.col-center');
 let layoutFrame=0,layoutActive=false,layoutExtra=0;
 const layoutOriginal=layoutMain?Object.fromEntries(['minHeight','alignContent','paddingTop','paddingBottom'].map(k=>[k,layoutMain.style[k]])):{};
 function alignAppBoard(){
  layoutFrame=0;if(!layoutMain||!layoutTabs||!layoutBoard||!layoutColumn)return;
  const active=document.body.dataset.appHardNoHelp==='true'&&product.view()==='play';
  if(!active){if(layoutActive){Object.assign(layoutMain.style,layoutOriginal);layoutExtra=0;layoutActive=false;}return;}
  if(!layoutActive){layoutMain.style.minHeight='0px';layoutMain.style.alignContent='start';layoutMain.style.paddingTop='5px';layoutMain.style.paddingBottom='8px';layoutExtra=0;layoutActive=true;}
  const boardRect=layoutBoard.getBoundingClientRect(),tabsRect=layoutTabs.getBoundingClientRect(),dockRect=dock.getBoundingClientRect(),columnRect=layoutColumn.getBoundingClientRect();
  if(!boardRect.height||!dockRect.height)return;
  const below=Math.max(0,columnRect.bottom-boardRect.bottom);
  const baseTop=boardRect.top-layoutExtra;
  const lower=dockRect.top-8-boardRect.height-below;
  const centered=(tabsRect.bottom+dockRect.top-boardRect.height)/2;
  const top=Math.max(baseTop,tabsRect.bottom+8,Math.min(centered,lower));
  const extra=Math.max(0,Math.round((top-baseTop)*100)/100);
  if(Math.abs(extra-layoutExtra)>.25){layoutExtra=extra;layoutMain.style.paddingTop=(5+extra)+'px';}
 }
 // Coalesce one layout task, independent of nested-frame animation scheduling.
function queueAppLayout(){if(!layoutFrame)layoutFrame=setTimeout(alignAppBoard,0);}
 window.addEventListener('resize',queueAppLayout,{passive:true});
 window.visualViewport?.addEventListener('resize',queueAppLayout,{passive:true});
 new MutationObserver(queueAppLayout).observe(document.body,{attributes:true,attributeFilter:['data-view','data-app-hard-nohelp','data-app-framed-preview','data-app-text-size']});
 if(typeof ResizeObserver==='function'){const ro=new ResizeObserver(queueAppLayout);for(const node of [layoutTabs,layoutColumn,dock])if(node)ro.observe(node);}
 document.fonts?.ready?.then(queueAppLayout);
 applyTextSize(readTextSize());
 document.body.dataset.appPanel='board';
 sync();queueAppLayout();
})();
