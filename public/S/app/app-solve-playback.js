'use strict';
// APP-only presentation of an already verified Solve all transaction.
// The existing solver owns the board, saved history and single-action Undo.
// This layer reveals its result; it never writes the board or adds history.
(() => {
 const nav=window.SudokuNavigator,product=nav?.product,grid=document.getElementById('grid');
 if(!product||!grid)return;
 const $=id=>document.getElementById(id);
 const sl=()=>window.SudokuI18n?.get?.()==='sl';
 const stateKey=()=>{try{const s=product.capture();return JSON.stringify([s.board,s.notes,s.lineage]);}catch(_){return null;}};
 const progress=document.createElement('p');
 progress.id='appSolveProgress';progress.hidden=true;progress.className='pl-caption';
 progress.setAttribute('role','status');progress.setAttribute('aria-live','off');progress.setAttribute('data-no-i18n','');
 $('plGameStatus').before(progress);
 const style=document.createElement('style');style.id='app-solve-playback-style';
 style.textContent=`
  #appSolveProgress{width:100%;text-align:center;margin:8px 0 10px;min-height:1em;font:inherit;font-size:.74rem;line-height:1.5;color:var(--cyan)}
  #appSolveProgress[hidden]{display:none!important}
  body[data-app-solve-playback=true] :is(#plGameStatus,#plCompletion,#appCoach,#appHoldTip){display:none!important}
  body[data-app-surface] .cell.app-solve-enter{animation:app-solve-enter 180ms ease-out}
  @keyframes app-solve-enter{from{opacity:.35;background:var(--cyan-dim)}to{opacity:1}}
  body[data-quiet=true] .cell.app-solve-enter{animation:none}
  @media(prefers-reduced-motion:reduce){body[data-app-surface] .cell.app-solve-enter{animation:none}}
 `;
 document.head.append(style);
 let playback=null;
 const observer=new MutationObserver(()=>finish(false));
 function reveal(entry,pulse=false){
  // No writes to game data: only restore the final renderer-owned cell markup.
  if(!entry.node.isConnected)return;
  entry.node.innerHTML=entry.html;entry.node.className=entry.className;
  if(entry.label===null)entry.node.removeAttribute('aria-label');else entry.node.setAttribute('aria-label',entry.label);
  if(pulse)entry.node.classList.add('app-solve-enter');
 }
 function finish(restore=true){
  const run=playback;if(!run)return;
  playback=null;clearTimeout(run.timer);observer.disconnect();
  // An import/new game/external render supersedes this cosmetic playback.
  const same=restore&&stateKey()===run.key;
  for(const entry of run.entries){
   if(same&&entry.node.classList.contains('app-solve-pending'))reveal(entry);
   entry.node.classList.remove('app-solve-pending','app-solve-enter');
  }
  grid.removeAttribute('aria-busy');delete document.body.dataset.appSolvePlayback;
  progress.hidden=true;progress.textContent='';
  window.dispatchEvent(new Event('resize'));
 }
 function tick(run){
  if(playback!==run)return;
  if(document.hidden||stateKey()!==run.key){finish(document.hidden);return;}
  if(run.index>=run.entries.length){finish();return;}
  reveal(run.entries[run.index++],true);observer.takeRecords();
  // Avoid announcing every digit to assistive technology.
  progress.setAttribute('aria-label',sl()?'Prikaz rešitve. Razveljavi obnovi prejšnjo pozicijo.':'Showing the solution. Undo restores your previous position.');
  progress.textContent=(sl()?'Reševanje':'Solving')+' … '+run.index+' / '+run.entries.length;
  run.timer=setTimeout(()=>tick(run),run.index===run.entries.length?180:60);
 }
 function confirmAndReveal(button,event){
  const commit=button.onclick;if(typeof commit!=='function')return;
  event.preventDefault();event.stopImmediatePropagation();finish();
  const before=product.capture(),seq=product.historyData().transactionSeq;
  const old=[...grid.children].map(node=>({html:node.innerHTML,className:node.className,label:node.getAttribute('aria-label')}));
  // Invoke the original confirmed solve ONCE; its validation, assistance record,
  // atomic board commit, saved Notes and Undo/Redo transaction remain unchanged.
  commit.call(button,event);
  if(product.historyData().transactionSeq===seq)return;
  const after=product.capture();
  const changed=after.board.map((value,i)=>value!==before.board[i]?i:-1).filter(i=>i>=0);
  if(!changed.length)return;
  product.switchView('play');document.body.dataset.appPanel='board';
  const entries=changed.map(i=>{const node=grid.children[i];return{node,html:node.innerHTML,className:node.className,label:node.getAttribute('aria-label'),old:old[i]};});
  const run={entries,index:0,key:stateKey(),timer:0};playback=run;
  document.body.dataset.appSolvePlayback='true';grid.setAttribute('aria-busy','true');
  progress.textContent=sl()?'Prikaz rešitve …':'Showing the solution …';progress.hidden=false;
  for(const entry of entries){entry.node.innerHTML=entry.old.html;entry.node.className=entry.old.className;entry.node.classList.add('app-solve-pending');if(entry.old.label!==null)entry.node.setAttribute('aria-label',entry.old.label);}
  observer.observe(grid,{childList:true,subtree:true,characterData:true});
  // A visible starting frame, then roughly three seconds for a typical board.
  run.timer=setTimeout(()=>tick(run),160);
  window.dispatchEvent(new Event('resize'));
 }
 document.addEventListener('click',event=>{
  if(playback){finish();return;}
  const button=event.target.closest?.('#aiAssistConfirmAll');
  if(button&&product.view()!=='lab')confirmAndReveal(button,event);
 },true);
 // Any deliberate interaction first exposes the real current board. In
 // particular Undo cancels every timer before the original single Undo runs.
 for(const type of ['pointerdown','touchstart','keydown'])window.addEventListener(type,()=>finish(),{capture:true,passive:true});
 window.addEventListener('pagehide',()=>finish());
 document.addEventListener('visibilitychange',()=>{if(document.hidden)finish();});
})();
