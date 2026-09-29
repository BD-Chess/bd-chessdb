'use strict';
// Embedded at the end of the self-contained APP game. The LAB solver/game
// stays the source of truth; this layer changes only its APP presentation.
(() => {
 const $ = id => document.getElementById(id);
 const panel = $('aiAssistPanel');
 const product = window.SudokuNavigator?.product;
 if (!panel || !product) return;

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

 function enhanceMore(){
  const body=$('navModalBody');
  if(!body || $('appMorePrimary'))return;
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

  const assistActive=!lab && !panel.hidden && document.body.dataset.appPanel==='assist';
  $('appAssist').setAttribute('aria-pressed',String(assistActive));
  $('appAssist').disabled=$('solveBtn')?.disabled===true;

  const sl=isSl();
  label('appNotes',sl?'Zapiski':'Notes');
  label('appErase',sl?'Izbriši':'Erase');
  label('appUndo',sl?'Razveljavi':'Undo');
  label('appAssist',sl?'Pomoč AI':'AI Assist');
  label('appMore',sl?'Več':'More');
  setLabel(dock,sl?'Kontrole igre':'Game controls');
  setLabel(scrim,sl?'Nazaj na mrežo':'Return to board');
 };

 function showAssist(){
  if(product.view()==='lab')return;
  if(!panel.hidden && document.body.dataset.appPanel==='assist'){
   $('aiAssistClose')?.click();
   return;
  }
  $('solveBtn')?.click();
  queueMicrotask(sync);
 }
 function showBoard(){
  document.body.dataset.appPanel='board';
  sync();
 }
 proxy('appNotes','notesBtn');
 proxy('appErase','uxErase');
 proxy('appUndo','uxUndo');
 $('appAssist').addEventListener('click',showAssist);
 $('appMore').addEventListener('click',()=>{
  $('uxMore')?.click();
  queueMicrotask(()=>{enhanceMore();sync();});
 });
 scrim.addEventListener('click',showBoard);

 // Route the existing APP help actions to the guided assistant.
 document.addEventListener('click', event => {
  if (product.view() === 'lab') return;
  const button = event.target.closest?.('#uxHint,#uxWhy,#solveBtn,#aiAssistClose');
  if (!button) return;
  if (button.id === 'aiAssistClose') {
   document.body.dataset.appPanel = 'board';
   sync();
   return;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
  ({uxHint:'plHint',uxWhy:'plWhy',solveBtn:'plDemo'})[button.id] &&
   $(({uxHint:'plHint',uxWhy:'plWhy',solveBtn:'plDemo'})[button.id])?.click();
  if (!panel.hidden) {
   document.body.dataset.appPanel = 'assist';
   panel.scrollTop = 0;
   $('aiAssistHint')?.focus({preventScroll:true});
  }
  sync();
 }, true);

 const watch = new MutationObserver(sync);
 watch.observe(panel,{attributes:true,attributeFilter:['hidden']});
 watch.observe(document.body,{attributes:true,attributeFilter:['data-view','data-assist']});
 watch.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 for(const id of ['notesBtn','uxErase','uxUndo','solveBtn','uxMore']){
  const node=$(id);if(node)watch.observe(node,{attributes:true,childList:true,subtree:true});
 }
 document.body.dataset.appPanel='board';
 sync();
})();
