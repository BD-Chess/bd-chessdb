(()=>{const root=document.documentElement,btn=document.querySelector('[data-lang-toggle]');
const setLang=(lang)=>{lang=lang==='sl'?'sl':'en';root.dataset.lang=lang;root.lang=lang;try{localStorage.setItem('ai8-r3h-lang',lang)}catch(e){}if(btn){btn.textContent=lang==='en'?'SL':'EN';btn.setAttribute('aria-label',lang==='en'?'Prikaži slovensko različico':'Show English version')}};
let preferred='en';try{preferred=localStorage.getItem('ai8-r3h-lang')||document.documentElement.dataset.lang||'en'}catch(e){}setLang(preferred);if(btn)btn.addEventListener('click',()=>setLang(root.dataset.lang==='en'?'sl':'en'));
const open=document.querySelector('[data-open-architecture]'),dlg=document.getElementById('architectureDialog');if(open&&dlg){open.addEventListener('click',()=>dlg.showModal());dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});}
})();
