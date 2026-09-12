/* WL UI helpers: collapsible journal entries + safe same-tab BD navigation. */
(()=>{'use strict';
const SESSION='wl-v2-session';
const stream=document.getElementById('stream');
let folding=false;
function foldEntries(){
 if(!stream||folding)return;
 folding=true;
 try{
  [...stream.children].forEach(node=>{
   if(!(node instanceof HTMLElement)||!node.classList.contains('entry'))return;
   const title=node.querySelector('h3')?.textContent?.trim()||node.dataset.eventId||'Prispevek';
   const meta=node.querySelector('.meta')?.textContent?.trim()||'';
   const details=document.createElement('details');details.className='entryFold';
   if(node.dataset.eventId)details.dataset.eventId=node.dataset.eventId;
   const summary=document.createElement('summary');
   const titleEl=document.createElement('span');titleEl.className='entryFoldTitle';titleEl.textContent=title;
   const metaEl=document.createElement('span');metaEl.className='entryFoldMeta';metaEl.textContent=meta;
   summary.append(titleEl,metaEl);details.append(summary);node.before(details);details.append(node);
  });
 }finally{folding=false}
}
if(stream){new MutationObserver(foldEntries).observe(stream,{childList:true});foldEntries()}
function hasSession(){try{const s=JSON.parse(sessionStorage.getItem(SESSION)||'null');return !!(s&&s.vault&&s.key)}catch{return false}}
for(const link of document.querySelectorAll('a[href="/WL/BD/"],a[href="/wl/bd/"]')){
 link.addEventListener('click',e=>{
  if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||hasSession())return;
  e.preventDefault();const target=link.href;let tries=0;
  const wait=()=>{if(hasSession()||tries++>=60){location.href=target;return}setTimeout(wait,50)};
  wait();
 });
}
})();
