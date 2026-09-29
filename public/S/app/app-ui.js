'use strict';
// Embedded at the end of the self-contained APP game. The LAB solver/game
// stays the source of truth; this layer changes only its phone presentation.
(() => {
 const $ = id => document.getElementById(id);
 const panel = $('aiAssistPanel');
 const product = window.SudokuNavigator?.product;
 if (!panel || !product) return;
 const dock = document.createElement('nav');
 dock.id = 'appDock';
 dock.setAttribute('aria-label', 'Game and AI Assist');
 dock.innerHTML = '<button type="button" id="appBoard" aria-pressed="true">Board</button><button type="button" id="appAssist" aria-pressed="false">AI Assist</button>';
 const scrim = document.createElement('button');
 scrim.type = 'button';
 scrim.id = 'appAssistScrim';
 scrim.setAttribute('aria-label', 'Return to board');
 document.body.append(scrim, dock);
 const isSl = () => window.SudokuI18n?.get?.() === 'sl';
 const setText = (node,value) => {if(node.textContent!==value)node.textContent=value;};
 const setLabel = (node,value) => {if(node.getAttribute('aria-label')!==value)node.setAttribute('aria-label',value);};
 const sync = () => {
  const available = !panel.hidden && product.view() !== 'lab';
  const active = available && document.body.dataset.appPanel === 'assist';
  if (!available) document.body.dataset.appPanel = 'board';
  $('appAssist').hidden = !available;
  $('appBoard').setAttribute('aria-pressed', String(!active));
  $('appAssist').setAttribute('aria-pressed', String(active));
  const sl = isSl();
  setText($('appBoard'),sl ? 'Mreža' : 'Board');
  setText($('appAssist'),sl ? 'Pomoč AI' : 'AI Assist');
  setLabel(dock,sl ? 'Mreža in pomoč AI' : 'Board and AI Assist');
  setLabel(scrim,sl ? 'Nazaj na mrežo' : 'Return to board');
 };
 function showAssist() {
  if (!panel.hidden && product.view() !== 'lab') {
   document.body.dataset.appPanel = 'assist';
   sync();
   panel.scrollTop = 0;
   $('aiAssistHint')?.focus({preventScroll:true});
  }
 }
 function showBoard() {
  document.body.dataset.appPanel = 'board';
  sync();
  $('appBoard').focus({preventScroll:true});
 }
 $('appBoard').addEventListener('click', showBoard);
 $('appAssist').addEventListener('click', showAssist);
 scrim.addEventListener('click', showBoard);
 // The LAB phone toolbar still owns touch/hold input. Route its three help
 // actions to the new guided assistant, not the older research demonstration.
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
  ({uxHint:'plHint',uxWhy:'plWhy',solveBtn:'plDemo'})[button.id] && $(({uxHint:'plHint',uxWhy:'plWhy',solveBtn:'plDemo'})[button.id])?.click();
  showAssist();
 }, true);
 const watch = new MutationObserver(() => {
  if (product.view() === 'lab') document.body.dataset.appPanel = 'board';
  sync();
 });
 watch.observe(panel, {attributes:true,attributeFilter:['hidden']});
 watch.observe(document.body, {attributes:true,attributeFilter:['data-view','data-assist']});
 watch.observe(document.documentElement, {attributes:true,attributeFilter:['lang']});
 document.body.dataset.appPanel = 'board';
 sync();
})();
