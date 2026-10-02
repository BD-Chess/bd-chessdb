/* Classical policy: shared tactics, then raw depth-limited search score. */
(function(root){'use strict';
function select(report){
 const all=report.candidates||[],win=all.filter(m=>m.immediateWin);
 const safe=all.filter(m=>m.safe===true),possible=all.filter(m=>!m.immediateLoss);
 const pool=win.length?win:safe.length?safe:possible.length?possible:all;
 const selected=pool.slice().sort((a,b)=>b.score-a.score||a.order-b.order)[0]||null;
 return {policy:'classical',selected,rawBest:selected,changed:false,rawGap:0,
  reason:win.length?'immediate-win':safe.length?'raw-best-safe':report.depth?'raw-best':'bounded-fallback'};
}
const api={VERSION:'1.0.0',select};root.F4MClassical=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);

/* BD web-app version selector. UI-only; search/policy behavior above is unchanged. */
(()=>{'use strict';
if(typeof document==='undefined')return;
function install(){
 const nav=document.querySelector('.topbar nav');
 if(!nav||document.getElementById('bd-version-nav'))return;
 const about=nav.querySelector('[data-i18n="about"]');
 const root=new URL((location.pathname.match(/^(.*\/F4M\/)/i)||[])[1]||'./',location.origin);
 if(about)about.setAttribute('href',new URL('f4m/',root).pathname);
 const oldPreview=nav.querySelector('[data-i18n="previewGame"]');
 if(oldPreview)oldPreview.remove();
 if(!document.getElementById('bd-version-nav-style')){
  const style=document.createElement('style');style.id='bd-version-nav-style';
  style.textContent='.bd-version-nav{display:inline-flex;align-items:center;gap:2px;padding:3px;border:1px solid rgba(140,227,207,.20);border-radius:999px;background:rgba(12,20,34,.82);box-shadow:0 5px 18px rgba(0,0,0,.22);font:700 9px/1 system-ui,sans-serif;letter-spacing:.07em;white-space:nowrap}.bd-version-nav a{padding:6px 7px;border-radius:999px;color:var(--muted);text-decoration:none}.bd-version-nav a:hover,.bd-version-nav a:focus-visible{color:var(--text);background:rgba(255,255,255,.06);outline:none}.bd-version-nav a.active{color:var(--mint);background:rgba(140,227,207,.13);box-shadow:inset 0 0 0 1px rgba(140,227,207,.24)}@media(max-width:680px){.bd-version-nav{font-size:8px;letter-spacing:.04em}.bd-version-nav a{padding:5px 6px}}';
  document.head.appendChild(style);
 }
 const edition=location.pathname.slice(root.pathname.length).split('/')[0].toLowerCase();
 const active=edition==='new'?'LAB':edition==='old'?'PREVIOUS':edition==='pwa'?'PWA':'CURRENT';
 const holder=document.createElement('span');holder.id='bd-version-nav';holder.className='bd-version-nav';holder.setAttribute('aria-label','Flip4M versions');
 for(const [label,path] of [['CURRENT',''],['PREVIOUS','old/'],['LAB','new/'],['PWA','PWA/']]){
  const a=document.createElement('a');a.href=new URL(path,root).pathname;a.textContent=label;
  if(label===active){a.className='active';a.setAttribute('aria-current','page');}
  holder.appendChild(a);
 }
 nav.insertBefore(holder,nav.querySelector('button')||null);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
