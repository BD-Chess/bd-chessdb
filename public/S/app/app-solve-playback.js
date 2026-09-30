'use strict';
// APP-only AI Solve Review. The underlying Solve all remains one atomic,
// persistent transaction owned by the existing Sudoku product. This module
// builds a checked, read-only review timeline and never mutates game history.
(() => {
 const nav=window.SudokuNavigator,product=nav?.product,grid=document.getElementById('grid'),C=window.SudokuNavCore,P=window.AI8SudokuProofPreview?.engine;
 if(!product||!grid||!C||!P)return;
 const $=id=>document.getElementById(id);
 const sl=()=>window.SudokuI18n?.get?.()==='sl';
 const rc=i=>'R'+(Math.floor(i/9)+1)+'C'+(i%9+1);
 const boardKey=b=>Array.isArray(b)?b.join(''):'';
 const currentKey=()=>{try{return boardKey(product.capture().board);}catch(_){return'';}};
 const techSL={
  naked_single:'Goli posameznik',hidden_single:'Skriti posameznik',pointing:'Kazanje',
  claiming:'Zaklep vrstica–blok',naked_subset:'Goli podnabor',hidden_subset:'Skriti podnabor',
  x_wing:'X-Wing',xy_wing:'XY-Wing',digit_path:'Pot števke',
  answer_correction:'Popravek vnosa',search_fallback:'MRV iskanje'
 };
 const techLabel=name=>sl()?(techSL[name]||name):(name==='answer_correction'?'Answer correction':name==='search_fallback'?'MRV search':(C.LABELS?.[C.NAMES?.indexOf(name)]||name));
 const pop=m=>C.pop?C.pop(m):m.toString(2).replace(/0/g,'').length;
 const filled=b=>b.filter(Boolean).length;
 function basicCandidates(board,index){
  if(board[index])return[];
  const r=Math.floor(index/9),c=index%9,used=new Set();
  for(let x=0;x<9;x++){used.add(board[r*9+x]);used.add(board[x*9+c]);}
  const br=Math.floor(r/3)*3,bc=Math.floor(c/3)*3;
  for(let rr=br;rr<br+3;rr++)for(let cc=bc;cc<bc+3;cc++)used.add(board[rr*9+cc]);
  return[1,2,3,4,5,6,7,8,9].filter(d=>!used.has(d));
 }
 function basicCandidateTotal(board){
  let n=0;for(let i=0;i<81;i++)if(!board[i])n+=basicCandidates(board,i).length;return n;
 }

 const review=document.createElement('section');
 review.id='appSolveReview';review.hidden=true;review.setAttribute('data-no-i18n','');
 review.innerHTML=
  '<div class="app-solve-review-head"><strong id="appSolveReviewTitle">AI Solve Review</strong>'+
   '<div class="app-solve-review-tabs"><button type="button" id="appSolveTabAI" aria-pressed="true">AI</button><button type="button" id="appSolveTabHuman" aria-pressed="false">Human</button></div></div>'+
  '<div id="appSolveReviewAI">'+
   '<div class="app-solve-step-line"><span id="appSolveStep">Start</span><span id="appSolveCount">0 / 0</span></div>'+
   '<div class="app-solve-sensors" id="appSolveSensors"></div>'+
   '<p class="app-solve-detail" id="appSolveDetail"></p>'+
   '<input id="appSolveScrub" class="app-solve-scrub" type="range" min="0" max="0" value="0" aria-label="Solve review step">'+
   '<div class="app-solve-nav" aria-label="Solve review navigation">'+
    '<button type="button" id="appSolveFirst" aria-label="First position">|◀</button>'+
    '<button type="button" id="appSolvePrev" aria-label="Previous step">◀</button>'+
    '<button type="button" id="appSolvePlay" aria-label="Play review">▶</button>'+
    '<button type="button" id="appSolveNext" aria-label="Next step">▶</button>'+
    '<button type="button" id="appSolveLast" aria-label="Last position">▶|</button>'+
   '</div>'+
  '</div>'+
  '<div id="appSolveReviewHuman" hidden><div id="appHumanReviewSummary" class="app-human-summary"></div><div id="appHumanReviewList" class="app-human-list"></div><p id="appHumanReviewNote" class="app-solve-detail"></p></div>';
 const gridWrap=document.getElementById('gridWrap')||grid.parentElement;
 gridWrap.after(review);

 const style=document.createElement('style');style.id='app-solve-review-style';
 style.textContent=[
  '#appSolveReview{width:100%;margin:9px 0 14px;padding:11px 12px 12px;border:1px solid #33475a;border-radius:12px;background:linear-gradient(180deg,#111b27,#0b141e);box-shadow:inset 0 1px 0 #ffffff08,0 8px 22px #0004;color:#dbe6f3}',
  '#appSolveReview[hidden]{display:none!important}',
  '.app-solve-review-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;font:800 .78rem/1.2 system-ui;letter-spacing:.035em;color:#c8d7e7}',
  '.app-solve-review-tabs{display:flex;gap:4px}.app-solve-review-tabs button,.app-solve-nav button{border:1px solid #3a5067;background:#172536;color:#d8e4f2;border-radius:8px;cursor:pointer}',
  '.app-solve-review-tabs button{padding:5px 9px;font:750 .68rem/1 system-ui}.app-solve-review-tabs button[aria-pressed=true]{border-color:#00d9f5;color:#79f2ff;background:#123447}',
  '.app-solve-step-line{display:flex;justify-content:space-between;gap:8px;margin:1px 0 7px;font:750 .78rem/1.25 system-ui;color:#f2f7ff}.app-solve-step-line #appSolveCount{color:#91a5bd}',
  '.app-solve-sensors{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;margin:0 0 8px}',
  '.app-solve-sensor{min-width:0;padding:5px 4px;border:1px solid #293e53;border-radius:7px;background:#101c29;text-align:center}.app-solve-sensor b{display:block;font:650 .54rem/1.1 system-ui;text-transform:uppercase;letter-spacing:.05em;color:#728aa3}.app-solve-sensor span{display:block;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:750 .65rem/1.15 system-ui;color:#dbe8f5}',
  '.app-solve-detail{min-height:2.6em;margin:5px 1px 7px;font:600 .72rem/1.4 system-ui;color:#aebed0}',
  '.app-solve-scrub{width:100%;accent-color:#00d9f5;margin:1px 0 7px}',
  '.app-solve-nav{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}.app-solve-nav button{min-height:38px;font:800 .84rem/1 system-ui}.app-solve-nav button:disabled{opacity:.35;cursor:default}',
  '.app-human-summary{display:flex;flex-wrap:wrap;gap:5px;margin:4px 0 8px}.app-human-chip{padding:5px 7px;border:1px solid #31465c;border-radius:999px;background:#101c29;font:700 .66rem/1 system-ui}.app-human-chip.good{color:#6ee7b7}.app-human-chip.warn{color:#fbbf24}.app-human-chip.bad{color:#fb7185}',
  '.app-human-list{display:grid;gap:4px}.app-human-row{padding:6px 7px;border-radius:7px;background:#0e1925;font:600 .69rem/1.3 system-ui;color:#c3d0df}',
  'body[data-app-solve-review=true] #grid .cell{position:relative}',
  'body[data-app-solve-review=true] #grid .cell:not(.given){color:transparent!important}',
  'body[data-app-solve-review=true] #grid .cell:not(.given)>*{visibility:hidden!important}',
  'body[data-app-solve-review=true] #grid .cell:not(.given)::after{content:attr(data-review-value);position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#f7fbff;font:inherit;font-weight:700;pointer-events:none}',
  'body[data-app-solve-review=true] #grid .cell.app-review-source{box-shadow:inset 0 0 0 2px #f59e0b99}',
  'body[data-app-solve-review=true] #grid .cell.app-review-elim{box-shadow:inset 0 0 0 2px #a78bfa99}',
  'body[data-app-solve-review=true] #grid .cell.app-review-focus{background:#0e3b49!important;box-shadow:inset 0 0 0 2px #00e5ffcc}',
  'body[data-app-solve-review=true] #grid .cell.app-review-pulse::after{animation:app-review-pop 190ms ease-out}@keyframes app-review-pop{from{transform:scale(.62);opacity:.25}to{transform:scale(1);opacity:1}}',
  'body[data-quiet=true] #grid .cell.app-review-pulse::after{animation:none}@media(prefers-reduced-motion:reduce){body[data-app-solve-review=true] #grid .cell.app-review-pulse::after{animation:none}}',
  '@media(max-width:380px){.app-solve-sensors{grid-template-columns:repeat(3,minmax(0,1fr))}.app-solve-sensor:nth-child(4),.app-solve-sensor:nth-child(5){grid-column:span 1}}'
 ].join('\n');
 document.head.append(style);

 const originalAria=new WeakMap();
 let data=null,timer=0,playing=false,tab='ai';

 function grid2flat(board){return Array.from({length:9},(_,r)=>board.slice(r*9,r*9+9));}
 function proofCandidateTotal(st){return st.masks.reduce((n,m)=>n+m.size,0);}
 const U=Array.from({length:27},(_,u)=>Array.from({length:9},(_,k)=>u<9?u*9+k:u<18?k*9+u-9:(Math.floor((u-18)/3)*3+Math.floor(k/3))*9+(u-18)%3*3+k%3));
 function immediatePlacements(st){
  const out=[],seen=new Set(),add=q=>{const k=q.cell+':'+q.value;if(!seen.has(k)){seen.add(k);out.push(q);}};
  for(let i=0;i<81;i++)if(!st.board[Math.floor(i/9)][i%9]&&st.masks[i].size===1){
   add({kind:'placement',technique:'naked_single',cell:i,value:[...st.masks[i]][0],sources:[i]});
  }
  for(let u=0;u<27;u++)for(let d=1;d<=9;d++){
   const cells=U[u].filter(i=>!st.board[Math.floor(i/9)][i%9]&&st.masks[i].has(d));
   if(cells.length===1)add({kind:'placement',technique:'hidden_single',cell:cells[0],value:d,sources:U[u].slice(),unit:u});
  }
  return out;
 }
 function humanFlow(st,q){
  const before=proofCandidateTotal(st),next=P.cloneState(st);
  if(!P.apply(next,q))return null;
  return{next,newSingles:immediatePlacements(next).length,candidateDrop:before-proofCandidateTotal(next),
   remaining:next.board.flat().filter(v=>!v).length,pathGain:q.kind==='placement'?1:0};
 }
 function chooseSmart(st){
  // Human-like priority: do forced placements first. When several are
  // available, prefer the one that opens the most other forced moves, then
  // the one that simplifies the candidate field most. Only when no forced
  // placement exists do we take the next conventional elimination.
  const forced=[];
  for(const q of immediatePlacements(st)){
   const flow=humanFlow(st,q);if(flow)forced.push({q,flow});
  }
  forced.sort((a,b)=>b.flow.newSingles-a.flow.newSingles||
   b.flow.candidateDrop-a.flow.candidateDrop||
   Number(a.q.technique!=='naked_single')-Number(b.q.technique!=='naked_single')||
   a.q.cell-b.q.cell);
  if(forced.length)return{...forced[0],source:'human_forced',reason:'FORCED_FLOW'};
  const q=P.nextStep(st);if(!q)return null;
  const flow=humanFlow(st,q);return flow?{q,flow,source:'human_elimination',reason:'TECHNIQUE_PROGRESS'}:null;
 }
 function proofElims(q){
  if(q.kind==='multi_elimination')return(q.eliminations||[]).map(e=>({cell:e.cell,digit:e.digit}));
  if(q.kind==='elimination')return(q.eliminations||[]).map(cell=>({cell,digit:q.digit}));
  return[];
 }
 function correctionStep(board,cell,from,to){
  const beforeCandidates=basicCandidateTotal(board),next=board.slice();next[cell]=0;
  return{kind:'correction',technique:'answer_correction',cell,value:to,previous:from,board:next,
   sources:[cell],eliminations:[],candidatesBefore:beforeCandidates,candidatesAfter:basicCandidateTotal(next),
   newSingles:null,pathGain:null,progress:filled(next),checked:false,answerAssisted:true,reason:'ANSWER_CHECK'};
 }
 function fallbackStep(st,finalBoard){
  let cell=-1,size=10;
  for(let i=0;i<81;i++)if(!st.b[i]){
   const n=pop(st.m[i]);if(n&&n<size){cell=i;size=n;}
  }
  if(cell<0)return null;
  const value=finalBoard[cell];if(!value)return null;
  const before=C.countCandidates(st),board=st.b.slice();board[cell]=value;
  let next;try{next=C.state(board);}catch(_){return null;}
  return{next,entry:{kind:'search',technique:'search_fallback',cell,value,board:next.b.slice(),sources:[cell],eliminations:[],
   candidatesBefore:before,candidatesAfter:C.countCandidates(next),newSingles:null,pathGain:null,progress:filled(next.b),
   checked:false,answerAssisted:true,reason:'MRV_FINAL_ANSWER',candidateSize:size}};
 }
 function buildReview(before,after){
  const start=before.board.slice(),finalBoard=after.board.slice(),steps=[],working=start.slice();
  for(let i=0;i<81;i++)if(working[i]&&working[i]!==finalBoard[i]){
   const step=correctionStep(working,i,working[i],finalBoard[i]);steps.push(step);working.splice(0,working.length,...step.board);
  }
  let st;try{st=P.makeState(grid2flat(working));}catch(_){st=null;}
  let guard=0,fallbacks=0;
  while(st&&!st.board.flat().every(Boolean)&&guard++<730){
   const picked=chooseSmart(st);
   if(picked){
    const q=picked.q,flow=picked.flow,next=flow.next,board=next.board.flat(),eliminations=proofElims(q);
    const focus=q.kind==='placement'?q.cell:(eliminations[0]?.cell??q.sources?.[0]??-1);
    if(q.kind!=='placement'||finalBoard[q.cell]===q.value){
     steps.push({kind:q.kind==='placement'?'placement':'elimination',technique:q.technique,cell:focus,
      value:q.kind==='placement'?q.value:null,board,sources:(q.sources||[]).slice(),eliminations,
      candidatesBefore:proofCandidateTotal(st),candidatesAfter:proofCandidateTotal(next),
      newSingles:flow.newSingles,pathGain:flow.pathGain,remaining:flow.remaining,progress:filled(board),
      checked:true,answerAssisted:false,reason:picked.reason,source:picked.source});
     st=next;continue;
    }
   }
   const current=st.board.flat(),cell=current.reduce((best,v,i)=>{
    if(v)return best;const n=st.masks[i].size;
    return !best||n<best.n?{i,n}:best;
   },null)?.i??-1;
   if(cell<0||!finalBoard[cell])break;
   const beforeCandidates=proofCandidateTotal(st),board=current.slice();board[cell]=finalBoard[cell];
   let next;try{next=P.makeState(grid2flat(board));}catch(_){next=null;}if(!next)break;
   fallbacks++;steps.push({kind:'search',technique:'search_fallback',cell,value:finalBoard[cell],board:next.board.flat(),
    sources:[cell],eliminations:[],candidatesBefore:beforeCandidates,candidatesAfter:proofCandidateTotal(next),
    newSingles:immediatePlacements(next).length,pathGain:1,remaining:next.board.flat().filter(v=>!v).length,
    progress:filled(next.board.flat()),checked:false,answerAssisted:true,reason:'MRV_FINAL_ANSWER',candidateSize:st.masks[cell].size});
   st=next;
  }
  const final=steps.length?steps.at(-1).board:start;
  if(boardKey(final)!==boardKey(finalBoard))throw Error('Solve review could not reproduce the certified final board');
  return{start,final:finalBoard,steps,fallbacks,finalKey:boardKey(finalBoard),createdAt:Date.now()};
 }
 function sensor(label,value){return'<div class="app-solve-sensor"><b>'+label+'</b><span>'+value+'</span></div>';}
 function detailFor(step){
  if(!step)return sl()?'Začetni položaj pred ukazom Reši vse.':'Position before Solve all.';
  if(step.technique==='answer_correction')return sl()?
   rc(step.cell)+' je vseboval '+step.previous+'. Ker je Reši vse izrecno odgovor-podprt ukaz, se napačen vnos najprej odstrani; to ni logični dokaz.':
   rc(step.cell)+' contained '+step.previous+'. Because Solve all is explicitly answer-assisted, the wrong entry is removed first; this is not a logical proof.';
  if(step.technique==='search_fallback')return sl()?
   'Logični P0–P3 pregled tu ni našel naslednjega dokazanega koraka. Uporabljen je MRV iskalni korak, jasno označen kot odgovor-podprt.':
   'The bounded P0–P3 proof scan found no next checked step here. An MRV search step is used and explicitly labelled answer-assisted.';
  if(step.kind==='placement')return sl()?
   techLabel(step.technique)+': '+rc(step.cell)+' = '+step.value+'. '+(step.source==='human_forced'?'Med prisiljenimi potezami je izbrana tista z boljšim kratkim logičnim tokom.':'Korak je neodvisno preverjen pred prikazom.'):
   techLabel(step.technique)+': '+rc(step.cell)+' = '+step.value+'. '+(step.source==='human_forced'?'Among forced moves, the short-horizon flow ranks this one first.':'The rule engine checked this logical step before display.');
  const es=step.eliminations.slice(0,5).map(e=>e.digit+'@'+rc(e.cell)).join(', ');
  return sl()?techLabel(step.technique)+': izločitev '+es+(step.eliminations.length>5?' …':'')+'. Kandidatne maske se spremenijo, mreža številk pa lahko ostane ista.':
   techLabel(step.technique)+': eliminate '+es+(step.eliminations.length>5?' …':'')+'. Candidate domains change even when the digit grid does not.';
 }
 function moveFor(step){
  if(!step)return sl()?'Začetek':'Start';
  if(step.technique==='answer_correction')return rc(step.cell)+' −'+step.previous;
  if(step.kind==='placement'||step.technique==='search_fallback')return rc(step.cell)+'='+step.value;
  return (step.eliminations.length?('−'+step.eliminations[0].digit+'@'+rc(step.eliminations[0].cell)):(sl()?'Izločitev':'Elimination'));
 }
 function humanRows(){
  try{return window.AI8SudokuProofPreview?.review?.()||[];}catch(_){return[];}
 }
 function renderHuman(){
  const rows=humanRows(),good=rows.filter(x=>x.verdict==='verified').length,unknown=rows.filter(x=>x.verdict==='unknown').length,bad=rows.filter(x=>x.verdict==='mistake').length;
  $('appHumanReviewSummary').innerHTML=
   '<span class="app-human-chip good">'+(sl()?'Preverjeno ':'Verified ')+good+'</span>'+
   '<span class="app-human-chip warn">'+(sl()?'Neznano ':'Unknown ')+unknown+'</span>'+
   '<span class="app-human-chip bad">'+(sl()?'Napačno ':'Wrong ')+bad+'</span>';
  $('appHumanReviewList').innerHTML=rows.length?rows.slice(-8).reverse().map(x=>{
   const v=x.value==null?'':('='+x.value),t=x.technique?' · '+techLabel(x.technique):'';
   const verdict=x.verdict==='verified'?(sl()?'preverjena logika':'verified logic'):x.verdict==='mistake'?(sl()?'napačen odgovor':'wrong answer'):(sl()?'razlog neznan':'reason unknown');
   return'<div class="app-human-row">#'+x.seq+' · '+rc(x.cell)+v+' · '+verdict+t+'</div>';
  }).join(''):'<div class="app-human-row">'+(sl()?'V tej seji še ni zabeleženih človeških vnosov za pregled.':'No human placements are recorded for review in this session.')+'</div>';
  $('appHumanReviewNote').textContent=sl()?
   'Pregled ne bere misli: pravilna poteza je “preverjena logika” samo, če je iz stanja pred potezo najden omejeni dokaz; sicer ostane razlog neznan.':
   'The review does not read the player’s mind: a correct move is “verified logic” only when a bounded proof is found from the pre-move state; otherwise the reason stays unknown.';
 }
 function setTab(next){
  tab=next==='human'?'human':'ai';
  $('appSolveTabAI').setAttribute('aria-pressed',String(tab==='ai'));$('appSolveTabHuman').setAttribute('aria-pressed',String(tab==='human'));
  $('appSolveReviewAI').hidden=tab!=='ai';$('appSolveReviewHuman').hidden=tab!=='human';
  $('appSolveReviewTitle').textContent=tab==='human'?(sl()?'Pregled človeškega reševanja':'Human Solve Review'):(sl()?'Pregled AI reševanja':'AI Solve Review');
  if(tab==='human')renderHuman();
 }
 function paint(index,pulse=false){
  if(!data)return;index=Math.max(0,Math.min(data.steps.length,Number(index)||0));data.index=index;
  const step=index?data.steps[index-1]:null,board=index?step.board:data.start;
  document.body.dataset.appSolveReview='true';review.hidden=false;
  const sources=new Set(step?.sources||[]),elims=new Set((step?.eliminations||[]).map(e=>e.cell)),focus=step?.cell??-1;
  [...grid.children].forEach((node,i)=>{
   if(!originalAria.has(node))originalAria.set(node,node.getAttribute('aria-label'));
   node.dataset.reviewValue=board[i]||'';
   node.classList.toggle('app-review-source',sources.has(i));
   node.classList.toggle('app-review-elim',elims.has(i));
   node.classList.toggle('app-review-focus',i===focus);
   node.classList.remove('app-review-pulse');
   node.setAttribute('aria-label',rc(i)+', '+(board[i]||'empty')+', solve review');
  });
  if(pulse&&focus>=0)grid.children[focus]?.classList.add('app-review-pulse');
  if(tab==='ai')$('appSolveReviewTitle').textContent=sl()?'Pregled AI reševanja':'AI Solve Review';
  $('appSolveTabAI').textContent='AI';$('appSolveTabHuman').textContent=sl()?'Človek':'Human';
  $('appSolveStep').textContent=index===0?(sl()?'Začetni položaj':'Starting position'):'#'+index+' · '+techLabel(step.technique);
  $('appSolveCount').textContent=index+' / '+data.steps.length;
  const cand=step&&Number.isFinite(step.candidatesBefore)?step.candidatesBefore+'→'+step.candidatesAfter:'—';
  const flow=step?.newSingles!=null?('+'+step.newSingles+' '+(sl()?'singlov':'singles')):step?.dccChanged?(sl()?'DCC izbira':'DCC pick'):(step?.checked?(sl()?'preverjeno':'checked'):(step?.answerAssisted?(sl()?'odgovor':'answer'):'—'));
  $('appSolveSensors').innerHTML=
   sensor(sl()?'Poteza':'Move',moveFor(step))+
   sensor(sl()?'Logika':'Logic',step?techLabel(step.technique):(sl()?'Začetek':'Start'))+
   sensor(sl()?'Kandidati':'Candidates',cand)+
   sensor(sl()?'Tok':'Flow',flow)+
   sensor(sl()?'Napredek':'Progress',filled(board)+'/81');
  $('appSolveDetail').textContent=detailFor(step);
  $('appSolveScrub').max=String(data.steps.length);$('appSolveScrub').value=String(index);
  $('appSolveFirst').disabled=index===0;$('appSolvePrev').disabled=index===0;
  $('appSolveNext').disabled=index>=data.steps.length;$('appSolveLast').disabled=index>=data.steps.length;
  $('appSolvePlay').textContent=playing?'❚❚':'▶';$('appSolvePlay').setAttribute('aria-label',playing?(sl()?'Ustavi predvajanje':'Pause review'):(sl()?'Predvajaj pregled':'Play review'));
  grid.setAttribute('aria-busy',String(playing));
  window.dispatchEvent(new Event('resize'));
 }
 function pause(){playing=false;clearTimeout(timer);timer=0;if(data)paint(data.index);}
 function delay(){
  if(!data?.steps?.length)return 90;
  return Math.max(45,Math.min(135,Math.floor(3900/data.steps.length)));
 }
 function tick(){
  if(!playing||!data)return;
  if(currentKey()!==data.finalKey){closeView(false);return;}
  if(data.index>=data.steps.length){pause();return;}
  paint(data.index+1,true);
  timer=setTimeout(tick,data.index===data.steps.length?220:delay());
 }
 function play(){
  if(!data)return;if(playing){pause();return;}
  if(data.index>=data.steps.length)paint(0);
  playing=true;paint(data.index);timer=setTimeout(tick,data.index===0?180:delay());
 }
 function restoreRealGrid(){
  for(const node of grid.children){
   node.classList.remove('app-review-source','app-review-elim','app-review-focus','app-review-pulse');
   delete node.dataset.reviewValue;
   const old=originalAria.get(node);if(old===null||old===undefined)node.removeAttribute('aria-label');else node.setAttribute('aria-label',old);
  }
  grid.removeAttribute('aria-busy');delete document.body.dataset.appSolveReview;
 }
 function closeView(discard=false){
  playing=false;clearTimeout(timer);timer=0;restoreRealGrid();review.hidden=true;
  if(discard)data=null;
  window.dispatchEvent(new Event('resize'));
 }
 function validReview(){return !!data&&currentKey()===data.finalKey;}
 function open(which='ai'){
  if(!validReview())return false;setTab(which);paint(data.index??data.steps.length);review.scrollIntoView({block:'nearest',behavior:'smooth'});return true;
 }

 function confirmAndReview(button,event){
  const commit=button.onclick;if(typeof commit!=='function')return;
  event.preventDefault();event.stopImmediatePropagation();closeView(false);
  const before=product.capture(),seq=product.historyData().transactionSeq;
  commit.call(button,event);
  if(product.historyData().transactionSeq===seq)return;
  const after=product.capture();
  if(!after.board?.every(Boolean))return;
  let built;try{built=buildReview(before,after);}catch(_){built=null;}
  if(!built)return;
  data={...built,index:0,humanAtSolve:humanRows()};
  product.switchView('play');document.body.dataset.appPanel='board';setTab('ai');paint(0);
  playing=true;paint(0);timer=setTimeout(tick,180);
 }

 $('appSolveFirst').onclick=()=>{pause();paint(0);};
 $('appSolvePrev').onclick=()=>{pause();paint((data?.index||0)-1);};
 $('appSolvePlay').onclick=play;
 $('appSolveNext').onclick=()=>{pause();paint((data?.index||0)+1);};
 $('appSolveLast').onclick=()=>{pause();paint(data?.steps.length||0);};
 $('appSolveScrub').oninput=e=>{pause();paint(Number(e.target.value));};
 $('appSolveTabAI').onclick=()=>setTab('ai');$('appSolveTabHuman').onclick=()=>setTab('human');

 document.addEventListener('click',event=>{
  const button=event.target.closest?.('#aiAssistConfirmAll');
  if(button&&product.view()!=='lab')confirmAndReview(button,event);
 },true);
 // Any real game interaction first removes the read-only overlay. Review
 // controls are exempt. Undo therefore reaches the original atomic transaction.
 for(const type of ['pointerdown','touchstart','keydown'])window.addEventListener(type,event=>{
  if(!data||review.hidden&&document.body.dataset.appSolveReview!=='true'||event.target?.closest?.('#appSolveReview'))return;
  closeView(false);
 },{capture:true,passive:true});
 const externalRenderObserver=new MutationObserver(()=>{if(data&&currentKey()!==data.finalKey)closeView(false);});
 externalRenderObserver.observe(grid,{childList:true,subtree:true,characterData:true});
 window.addEventListener('pagehide',()=>closeView(false));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)closeView(false);});
 window.SudokuSolveReview={
  hasReview:validReview,
  open:()=>open('ai'),
  openHuman:()=>{if(data&&validReview())return open('human');review.hidden=false;setTab('human');renderHuman();return true;},
  close:()=>closeView(false),
  get:()=>data?JSON.parse(JSON.stringify({start:data.start,final:data.final,steps:data.steps,index:data.index,fallbacks:data.fallbacks})):null
 };
})();