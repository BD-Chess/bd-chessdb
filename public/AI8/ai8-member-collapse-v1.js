/* AI8 State R5 — member accordion. Presentation only. */
(()=>{'use strict';
const cards=[...document.querySelectorAll('.member-card')];
if(!cards.length)return;
function setRevision(){
 const chip=[...document.querySelectorAll('.chip.gold')].find(x=>/^R4\s*·\s*2026-09-23\s*$/.test(x.textContent.trim()));
 if(chip)chip.textContent='R5 · 2026-09-23';
 const state=document.getElementById('ai8-derived-state');
 if(state){try{const j=JSON.parse(state.textContent);j.presentation_revision='R5_COLLAPSED_MEMBERS';state.textContent=JSON.stringify(j)}catch(_){}}
}
function closeOthers(keep){
 for(const card of cards){if(card===keep)continue;const button=card.querySelector(':scope > .member-toggle'),body=card.querySelector(':scope > .member-collapse-body');if(button&&body){button.setAttribute('aria-expanded','false');body.hidden=true}}
}
function setOpen(card,open){
 const button=card.querySelector(':scope > .member-toggle'),body=card.querySelector(':scope > .member-collapse-body');if(!button||!body)return;
 if(open)closeOthers(card);
 button.setAttribute('aria-expanded',open?'true':'false');body.hidden=!open;
}
for(const card of cards){
 if(card.dataset.ai8Collapse==='1')continue;
 const head=card.querySelector(':scope > .member-head'),lenses=card.querySelector(':scope > .lens-grid');
 if(!head||!lenses)continue;
 const name=head.querySelector('.member-name'),lineage=head.querySelector('.member-lineage');
 if(!name)continue;
 const body=document.createElement('div');body.className='member-collapse-body';body.id=card.id+'-body';body.hidden=true;
 card.insertBefore(body,head);body.appendChild(head);body.appendChild(lenses);
 const button=document.createElement('button');button.type='button';button.className='member-toggle';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',body.id);
 button.appendChild(name.cloneNode(true));if(lineage)button.appendChild(lineage.cloneNode(true));
 const spacer=document.createElement('span');spacer.className='member-toggle-spacer';button.appendChild(spacer);
 const hint=document.createElement('span');hint.className='member-toggle-hint';hint.innerHTML='<span class="lang sl">Odpri</span><span class="lang en">Open</span>';button.appendChild(hint);
 const chevron=document.createElement('span');chevron.className='member-toggle-chevron';chevron.setAttribute('aria-hidden','true');chevron.textContent='⌄';button.appendChild(chevron);
 button.addEventListener('click',()=>setOpen(card,button.getAttribute('aria-expanded')!=='true'));
 card.insertBefore(button,body);card.classList.add('ai8-member-collapsed');card.dataset.ai8Collapse='1';
}
const allButton=document.querySelector('[data-member-filter="all"]');
for(const link of document.querySelectorAll('.member-jump a[href^="#member-"]'))link.addEventListener('click',()=>{if(allButton&&!allButton.classList.contains('active'))allButton.click();const card=document.querySelector(link.getAttribute('href'));if(card)setOpen(card,true)});
function openHash(){if(!location.hash.startsWith('#member-'))return;const card=document.querySelector(location.hash);if(!card)return;if(allButton&&!allButton.classList.contains('active'))allButton.click();setOpen(card,true)}
window.addEventListener('hashchange',openHash);openHash();setRevision();
})();
