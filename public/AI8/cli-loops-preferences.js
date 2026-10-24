/* Same theme/font preferences as the main landing. No network or private data. */
"use strict";
(() => {
  const root=document.documentElement;
  const down=document.getElementById('font-down'),up=document.getElementById('font-up'),reset=document.getElementById('font-value'),theme=document.getElementById('theme');
  if(!down||!up||!reset||!theme)return;
  const read=(key,fallback)=>{try{return localStorage.getItem(key)||fallback;}catch(_){return fallback;}};
  const save=(key,value)=>{try{localStorage.setItem(key,String(value));}catch(_){}};
  let scale=1;
  function setScale(value,persist=true){
    const number=Number(value);scale=Number.isFinite(number)?Math.round(Math.min(1.5,Math.max(.8,number))*100)/100:1;
    root.style.setProperty('--scale',scale);down.setAttribute('aria-disabled',String(scale<=.8));up.setAttribute('aria-disabled',String(scale>=1.5));
    reset.textContent=Math.round(scale*100)+'%';reset.setAttribute('aria-label','Ponastavi velikost besedila na 100 %, trenutno '+Math.round(scale*100)+' %');
    if(persist)save('mdlxdcc-font',scale);
  }
  function setTheme(value,persist=true){
    const next=['light','dark'].includes(value)?value:matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';root.dataset.theme=next;
    theme.setAttribute('aria-label',next==='dark'?'Preklopi na svetlo temo':'Preklopi na temno temo');
    theme.setAttribute('title',next==='dark'?'Svetla tema':'Temna tema');
    document.querySelector('meta[name="theme-color"]').content=next==='light'?'#f5f7f9':'#0b1220';
    if(persist)save('mdlxdcc-theme',next);
  }
  down.addEventListener('click',()=>{if(scale>.8)setScale(scale-.05);});up.addEventListener('click',()=>{if(scale<1.5)setScale(scale+.05);});reset.addEventListener('click',()=>setScale(1));
  theme.addEventListener('click',()=>setTheme(root.dataset.theme==='dark'?'light':'dark'));
  window.addEventListener('storage',event=>{
    if(event.key==='mdlxdcc-font'||event.key===null)setScale(event.newValue===null?1:event.newValue,false);
    if(event.key==='mdlxdcc-theme'||event.key===null)setTheme(event.newValue,false);
  });
  setScale(read('mdlxdcc-font','1'),false);
  setTheme(read('mdlxdcc-theme',matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'),false);
})();
