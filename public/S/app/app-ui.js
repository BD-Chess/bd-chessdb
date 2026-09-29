'use strict';
// Embedded at the end of the self-contained APP game. The LAB solver/game
// stays the source of truth; this layer changes only its APP presentation.
(() => {
 const $ = id => document.getElementById(id);
 const panel = $('aiAssistPanel');
 const product = window.SudokuNavigator?.product;
 if (!panel || !product) return;

 const TEXT_KEY='ai8SudokuAppV030.appTextSize';
 const TEXT_SIZES=new Set(['compact','normal','large']);
 const readTextSize=()=>{
  try{const v=localStorage.getItem(TEXT_KEY);return TEXT_SIZES.has(v)?v:'normal';}
  catch(_){return 'normal';}
 };
 const applyTextSize=(value,persist=false)=>{
  const size=TEXT_SIZES.has(value)?value:'normal';
  document.body.dataset.appTextSize=size;
  if(persist)try{localStorage.setItem(TEXT_KEY,size);}catch(_){}
  return size;
 };
 let textSize=applyTextSize(readTextSize());

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

 const menuIcon = button => {
  if(button.id==='appPwaMenu')return '⬇';
  const key=button.dataset.menu||button.textContent.trim();
  return ({
   'Redo':'↻','My games':'▦','Daily puzzles':'◫','Share puzzle':'↗',
   'Check correctness':'✓','Review':'◎','Settings':'⚙','Help':'?',
   'Import':'⇩','Export':'⇧','Delete all APP data':'⌫'
  })[key]||'•';
 };
 function decorateMenuButton(button){
  if(!button || button.dataset.appDecorated==='true')return;
  const text=button.textContent.trim();
  button.dataset.appDecorated='true';
  button.innerHTML='<span class="app-more-icon" aria-hidden="true">'+menuIcon(button)+'</span><span class="app-more-label"></span>';
  button.querySelector('.app-more-label').textContent=text;
  if((button.dataset.menu||'').includes('Delete all APP data')){
   button.classList.add('app-danger');
   button.addEventListener('click',()=>queueMicrotask(()=>{
    try{if(!localStorage.getItem(TEXT_KEY)){textSize=applyTextSize('normal');}}catch(_){}
   }));
  }
 }
 function syncTextSizeButtons(){
  const group=$('appTextSize');
  if(!group)return;
  for(const b of group.querySelectorAll('[data-app-text-size]'))b.setAttribute('aria-pressed',String(b.dataset.appTextSize===textSize));
 }
 function setTextSize(value){
  textSize=applyTextSize(value,true);
  syncTextSizeButtons();
 }
 function enhanceMore(){
  const body=$('navModalBody');
  if(!body)return;
  let primary=$('appMorePrimary');
  if(!primary){
   const sl=isSl();
   primary=document.createElement('div');
   primary.id='appMorePrimary';
   primary.className='ux-menu app-more-primary';
   primary.innerHTML =
    '<button class="btn" id="appMoreNew"><span class="app-more-icon" aria-hidden="true">＋</span><span class="app-more-label">'+(sl?'Nova igra':'New game')+'</span></button>'+
    '<button class="btn" id="appMoreNews"><span class="app-more-icon" aria-hidden="true">✦</span><span class="app-more-label">'+(sl?'Kaj je novega':'What’s new')+'</span></button>'+
    '<button class="btn" id="appMoreTutorial"><span class="app-more-icon" aria-hidden="true">◉</span><span class="app-more-label">'+(sl?'Kratka vaja · neobvezno':'Quick tutorial · optional')+'</span></button>';
   body.prepend(primary);
   $('appMoreNew').onclick=()=>{$('navClose')?.click();queueMicrotask(()=>$('uxNew')?.click());};
   $('appMoreNews').onclick=()=>{$('navClose')?.click();queueMicrotask(()=>$('plNewsOpen')?.click());};
   $('appMoreTutorial').onclick=()=>{$('navClose')?.click();queueMicrotask(()=>$('plTutorialOpen')?.click());};
  }
  let textSettings=$('appTextSize');
  if(!textSettings){
   const sl=isSl();
   textSettings=document.createElement('section');
   textSettings.id='appTextSize';
   textSettings.className='app-more-textsize';
   textSettings.innerHTML =
    '<div class="app-more-textsize-title">'+(sl?'Velikost besedila':'Text size')+'</div>'+
    '<div class="app-more-textsize-buttons" role="group" aria-label="'+(sl?'Velikost besedila':'Text size')+'">'+
     '<button type="button" class="btn" data-app-text-size="compact">'+(sl?'Kompaktno':'Compact')+'</button>'+
     '<button type="button" class="btn" data-app-text-size="normal">'+(sl?'Običajno':'Normal')+'</button>'+
     '<button type="button" class="btn" data-app-text-size="large">'+(sl?'Veliko':'Large')+'</button>'+
    '</div>';
   primary.after(textSettings);
   for(const b of textSettings.querySelectorAll('[data-app-text-size]'))b.onclick=()=>setTextSize(b.dataset.appTextSize);
  }
  const menus=[...body.querySelectorAll('.ux-menu')].filter(n=>n!==primary);
  for(const menu of menus){
   menu.classList.add('app-more-menu');
   for(const b of menu.querySelectorAll(':scope > .btn'))decorateMenuButton(b);
   const danger=menu.querySelector('.app-danger');if(danger)menu.append(danger);
  }
  syncTextSizeButtons();
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
