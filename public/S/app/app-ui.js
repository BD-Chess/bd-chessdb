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

 const iconMap={
  'New game':'＋','Nova igra':'＋','What’s new':'✦','Kaj je novega':'✦',
  'Quick tutorial · optional':'◎','Kratka vaja · neobvezno':'◎','Redo':'↻','Uveljavi znova':'↻',
  'My games':'▦','Moje igre':'▦','Daily puzzles':'◫','Dnevne uganke':'◫',
  'Share puzzle':'↗','Deli uganko':'↗','Check correctness':'✓','Preveri pravilnost':'✓',
  'Review':'◎','Pregled':'◎','Settings':'⚙','Nastavitve':'⚙','Help / About':'?',
  'Pomoč / O igri':'?','Import session':'⇩','Uvozi igro':'⇩','Export session':'⇧','Izvozi igro':'⇧',
  'Delete all APP data':'⌫','Izbriši vse podatke APP':'⌫','App · offline & updates':'◌',
  'Aplikacija · brez povezave in posodobitve':'◌'
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
  decorateMore();
 }
 function enhanceSettings(){
  $('navModal')?.classList.remove('app-more-modal');
  const body=$('navModalBody'),anchor=$('uxSettings');
  if(!body||!anchor||$('appTextSizeSetting'))return;
  const sl=isSl(),current=readTextSize(),wrap=document.createElement('div');
  wrap.id='appTextSizeSetting';wrap.className='ux-setting app-text-setting';
  wrap.innerHTML='<label for="appTextSize">'+(sl?'Velikost besedila':'Text size')+'</label>'+
   '<select id="appTextSize">'+
   [['compact',sl?'Kompaktno':'Compact'],['normal',sl?'Običajno':'Normal'],['large',sl?'Veliko':'Large']]
    .map(([v,t])=>'<option value="'+v+'"'+(v===current?' selected':'')+'>'+t+'</option>').join('')+
   '</select>';
  anchor.before(wrap);
  $('appTextSize').onchange=e=>applyTextSize(e.target.value);
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
  if(!panel.hidden && document.body.dataset.appPanel==='assist'){$('aiAssistClose')?.click();return;}
  $('solveBtn')?.click();queueMicrotask(sync);
 }
 function showBoard(){document.body.dataset.appPanel='board';sync();}
 proxy('appNotes','notesBtn');proxy('appErase','uxErase');proxy('appUndo','uxUndo');
 $('appAssist').addEventListener('click',showAssist);
 $('appMore').addEventListener('click',()=>{$('uxMore')?.click();queueMicrotask(()=>{enhanceMore();sync();});});
 scrim.addEventListener('click',showBoard);

 document.addEventListener('click', event => {
  const settings=event.target.closest?.('#navModalBody [data-menu="Settings"],#navModalBody [data-menu="Nastavitve"]');
  if(settings)queueMicrotask(enhanceSettings);
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

 const watch = new MutationObserver(records=>{
  if($('navModal')?.hidden)$('navModal')?.classList.remove('app-more-modal');
  if(lastPoint&&$('uxLoupe'))placeLoupe(lastPoint.x,lastPoint.y);
  sync();
 });
 watch.observe(panel,{attributes:true,attributeFilter:['hidden']});
 watch.observe(document.body,{attributes:true,attributeFilter:['data-view','data-assist'],childList:true,subtree:false});
 watch.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 for(const id of ['notesBtn','uxErase','uxUndo','solveBtn','uxMore']){
  const node=$(id);if(node)watch.observe(node,{attributes:true,childList:true,subtree:true});
 }
 applyTextSize(readTextSize());
 document.body.dataset.appPanel='board';
 sync();
})();
