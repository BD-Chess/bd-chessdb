import {CURATED, GROUPS, GLOSSARY, loadCatalogue} from './catalog.mjs';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], root=document.documentElement;
const read=(k,f)=>{try{return localStorage.getItem(k)||f}catch{return f}},save=(k,v)=>{try{localStorage.setItem(k,String(v))}catch{}};
let language=window.MDLxDCCLocale?.current() || (read('mdlxdcc-lang','sl')==='en'?'en':'sl');
let catalogue=CURATED, complete=false, loaded=false, font=Math.max(.8,Math.min(1.5,Number(read('mdlxdcc-font','1'))||1));
const reveal=$('#reveal');
let active=null, activeData=null, pinned=false, openTimer=0, closeTimer=0;
const t=(sl,en)=>language==='sl'?sl:en;
const description=p=>p[language] || p.en || p.sl || '';
const normal=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const kinds={tool:['Orodje','Tool'],research:['Raziskava','Research'],game:['Igra','Game'],gallery:['Galerija','Gallery'],story:['Zgodba','Story'],concept:['Zamisel','Concept'],entrance:['Vstopna stran','Entrance'],archive:['Arhiv','Archive']};
const groupName=p=>GROUPS[p.group]?.[language]||p.group||t('Zapis','Record');
function node(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n}

function art(id){
  const wrap=s=>`<svg viewBox="0 0 180 110" aria-hidden="true" focusable="false">${s}</svg>`;
  if(id==='tripopti')return wrap('<g class="subtle"><path d="M22 20h134M22 45h134M22 70h134M22 95h134M35 13v89M70 13v89M105 13v89M140 13v89"/></g><path d="M36 80 57 40 91 67 123 25 144 58" stroke-width="1.8"/><g class="solid"><circle cx="36" cy="80" r="3"/><circle cx="57" cy="40" r="2.5"/><circle cx="91" cy="67" r="2.5"/><circle cx="123" cy="25" r="2.5"/><circle cx="144" cy="58" r="3"/></g><circle cx="144" cy="58" r="8"/>');
  if(id==='mdl-dcc'){let paths='';for(let i=0;i<18;i++){const pts=Array.from({length:3},(_,j)=>{let a=j*Math.PI*2/3+i*Math.PI/18-Math.PI/2;return `${90+Math.cos(a)*43},${55+Math.sin(a)*43}`}).join(' ');paths+=`<polygon points="${pts}" opacity=".55" stroke-width=".65"/>`}return wrap(paths+'<circle cx="90" cy="55" r="3" class="solid"/>')}
  if(id==='chessbest')return wrap('<g class="subtle"><path d="M49 14h82v82H49ZM49 34.5h82M49 55h82M49 75.5h82M69.5 14v82M90 14v82M110.5 14v82"/><path d="M49 14h20.5v20.5H49ZM90 14h20.5v20.5H90ZM69.5 34.5H90V55H69.5ZM110.5 34.5H131V55h-20.5ZM49 55h20.5v20.5H49ZM90 55h20.5v20.5H90ZM69.5 75.5H90V96H69.5ZM110.5 75.5H131V96h-20.5Z" class="solid" opacity=".22"/></g><path d="M75 80h35M77 75h30c-4-8-5-12-3-19 4-15-1-24-13-28l-2-8-6 9-14 14 2 10 11-4 8-9c1 15-14 17-13 35Z" stroke-width="1.8" fill="var(--bg)"/><circle cx="83" cy="36" r="1.5" class="solid"/>');
  if(id==='sudoku'){let s='<rect x="49.5" y="14.5" width="81" height="81"/>';for(let i=1;i<9;i++)s+=`<path d="M${49.5+i*9} 14.5v81M49.5 ${14.5+i*9}h81" stroke-width="${i%3?'.4':'1.15'}" opacity="${i%3?'.4':'1'}"/>`;return wrap(s+'<g style="font-size:8px"><text x="54" y="19" style="font-size:8px">5</text><text x="72" y="37" style="font-size:8px">9</text><text x="108" y="19" style="font-size:8px">1</text><text x="90" y="55" style="font-size:8px">5</text><text x="63" y="73" style="font-size:8px">8</text><text x="117" y="82" style="font-size:8px">4</text><text x="99" y="91" style="font-size:8px">6</text></g>')}
  if(id==='ai8'){let s='<circle cx="90" cy="55" r="37" stroke-dasharray="1 5" class="subtle"/>';for(let i=0;i<8;i++){let a=i*Math.PI/4,x=90+Math.cos(a)*37,y=55+Math.sin(a)*37;s+=`<path d="M90 55 ${x} ${y}" class="subtle"/><circle cx="${x}" cy="${y}" r="4"/>`}return wrap(s+'<circle cx="90" cy="55" r="11"/><circle cx="90" cy="55" r="2" class="solid"/>')}
  if(id==='materials')return wrap('<path d="m90 13 36 21v42L90 97 54 76V34ZM54 34l36 21 36-21M90 55v42M90 13v42M54 76l36-21 36 21"/><path d="m72 24 36 21v42M108 24 72 45v42M54 55l36 21 36-21" class="subtle"/><g class="solid"><circle cx="90" cy="13" r="2.3"/><circle cx="126" cy="34" r="2.3"/><circle cx="126" cy="76" r="2.3"/><circle cx="90" cy="97" r="2.3"/><circle cx="54" cy="76" r="2.3"/><circle cx="54" cy="34" r="2.3"/><circle cx="90" cy="55" r="2.8"/></g>');
  if(id==='8zip'){let s='';for(let j=0;j<6;j++){s+=`<path d="M28 ${25+j*12}h${24+(j%3)*11}" opacity="${.35+j*.1}"/>`;s+=`<path d="M120 ${32+j*9}h28"/>`}return wrap(s+'<path d="M77 55h24m-6-6 6 6-6 6"/><path d="M115 19h38v72h-38Z" class="subtle"/>')}
  if(id==='human-middle')return wrap('<circle cx="90" cy="52" r="39" class="subtle"/><ellipse cx="90" cy="52" rx="20" ry="39"/><path d="M51 52h78M57 31h66M57 73h66" class="subtle"/><circle cx="90" cy="44" r="5" fill="var(--bg)"/><path d="M90 51v24m-12-16 12-6 12 6M90 75l-7 17m7-17 7 17" stroke-width="1.7"/>');
  return wrap('<circle cx="90" cy="55" r="34"/><path d="M56 55h68M90 21v68" class="subtle"/>');
}

function bindReveal(button,data){
  button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','reveal');button.setAttribute('aria-expanded','false');
  button.addEventListener('pointerenter',e=>{if(e.pointerType==='touch'||pinned)return;clearTimeout(closeTimer);clearTimeout(openTimer);openTimer=setTimeout(()=>showReveal(button,data,false),170)});
  button.addEventListener('pointerleave',()=>{clearTimeout(openTimer);scheduleClose()});
  button.addEventListener('focus',()=>{if(!pinned)showReveal(button,data,false)});
  button.addEventListener('blur',()=>scheduleClose());
  button.addEventListener('click',()=>{if(active===button&&pinned){closeReveal(true);return}showReveal(button,data,true);$('#reveal-link').focus({preventScroll:true})});
}
function showReveal(button,data,pin){
  clearTimeout(openTimer);clearTimeout(closeTimer);if(active&&active!==button)active.setAttribute('aria-expanded','false');
  active=button;activeData=data;pinned=pin;button.setAttribute('aria-expanded','true');
  const info=data.term?{title:data.term,sl:data.sl,en:data.en,url:CURATED.find(p=>p.id===(data.id==='ai8'?'ai8':'mdl-dcc'))?.url||'/index-search.html',kind:'concept',group:'research',related:[]}:data;
  $('#reveal-title').textContent=info.title;
  $('#reveal-kind').textContent=data.term?t('Pojem','Concept'):(kinds[info.kind]?t(...kinds[info.kind]):groupName(info));
  $('#reveal-description').textContent=description(info);$('#reveal-link').href=info.url;
  const related=$('#reveal-related');related.replaceChildren();
  for(const id of (info.related||[]).slice(0,3)){const p=CURATED.find(x=>x.id===id);if(p){const a=node('a','',p.title);a.href=p.url;related.append(a)}}
  reveal.hidden=false;positionReveal();
}
function positionReveal(){if(!active||reveal.hidden)return;const viewport=window.visualViewport,vh=viewport?.height||innerHeight,offset=viewport?.offsetTop||0;reveal.style.maxHeight=Math.max(80,vh-24)+'px';const r=active.getBoundingClientRect(),w=reveal.offsetWidth,h=reveal.offsetHeight;let left=Math.max(12,Math.min(innerWidth-w-12,r.left));let top=r.bottom+9;if(top+h>offset+vh-12)top=r.top-h-9;top=Math.max(offset+12,Math.min(offset+vh-h-12,top));reveal.style.left=left+'px';reveal.style.top=top+'px'}
function scheduleClose(){clearTimeout(closeTimer);if(pinned)return;closeTimer=setTimeout(()=>{if(!reveal.matches(':hover')&&!reveal.contains(document.activeElement)&&active!==document.activeElement)closeReveal(false)},250)}
function closeReveal(restore=false){clearTimeout(openTimer);clearTimeout(closeTimer);const old=active;active=null;activeData=null;pinned=false;reveal.hidden=true;old?.setAttribute('aria-expanded','false');if(restore&&old){old.focus({preventScroll:true});clearTimeout(openTimer);reveal.hidden=true;active=null;activeData=null;old.setAttribute('aria-expanded','false')}}
reveal.addEventListener('pointerenter',()=>clearTimeout(closeTimer));reveal.addEventListener('pointerleave',scheduleClose);reveal.addEventListener('focusin',()=>clearTimeout(closeTimer));reveal.addEventListener('focusout',scheduleClose);
$('#reveal-close').addEventListener('click',()=>closeReveal(true));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!reveal.hidden){e.preventDefault();closeReveal(true)}});
document.addEventListener('pointerdown',e=>{if(!reveal.hidden&&!reveal.contains(e.target)&&!active?.contains(e.target))closeReveal(false)});
document.addEventListener('focusin',e=>{if(!reveal.hidden&&active!==e.target&&!reveal.contains(e.target))closeReveal(false)});
window.addEventListener('resize',positionReveal);window.addEventListener('scroll',()=>{if(!reveal.hidden){if(pinned)positionReveal();else closeReveal(false)}},{passive:true});
window.visualViewport?.addEventListener('resize',positionReveal);window.visualViewport?.addEventListener('scroll',positionReveal);

function renderProjects(){
  closeReveal(false);const grid=$('#project-grid');grid.replaceChildren();
  CURATED.filter(p=>p.featured).slice(0,8).forEach((p,i)=>{
    const b=node('button','project-tile');b.type='button';b.dataset.project=p.id;
    const top=node('span','tile-top');top.append(node('span','',String(i+1).padStart(2,'0')),node('span','tile-open','+'));
    const illustration=node('span','tile-art');illustration.setAttribute('aria-hidden','true');illustration.innerHTML=art(p.id);
    b.append(top,illustration,node('span','tile-title',p.title),node('span','tile-group',groupName(p)));bindReveal(b,p);grid.append(b);
  });
  const threads=$('#thread-links');threads.replaceChildren();
  CURATED.filter(p=>!p.featured && p.kind!=='entrance').slice(0,12).forEach(p=>{const b=node('button','thread-link',p.title);b.type='button';bindReveal(b,p);threads.append(b)});
}
function renderCatalogue(){
  const q=normal($('#catalogue-search').value.trim()),terms=q.split(/\s+/).filter(Boolean),shown=catalogue.filter(p=>terms.every(term=>normal([p.title,p.sl,p.en,p.url,p.mark,groupName(p)].join(' ')).includes(term)));
  $('#catalogue-count').textContent=loaded?`${catalogue.length} ${t('povezav','connections')}`:'';
  $('#catalogue-status').textContent=!loaded?t('Nalagam javni zapis …','Loading the public record …'):!complete?t('Prikazan je izbor. Celoten javni indeks trenutno ni dosegljiv.','Showing selected records. The full public index is currently unavailable.'):q?`${shown.length} ${t('zadetkov','results')}`:`${catalogue.length} ${t('javnih zapisov','public records')}`;
  if(q&&shown.length===0)$('#catalogue-status').textContent=t('Ni zadetkov. Poskusi drug pojem ali odpri Atlas.','No matches. Try another term or open the Atlas.');
  const target=$('#catalogue-groups'),wasOpen=new Set([...target.querySelectorAll('details[open]')].map(d=>d.dataset.group));target.replaceChildren();
  const groups=[...Object.keys(GROUPS),...new Set(shown.map(p=>p.group).filter(g=>!GROUPS[g]))];
  for(const key of groups){const entries=shown.filter(p=>p.group===key);if(!entries.length)continue;const d=node('details','catalogue-group');d.dataset.group=key;d.open=!!q||wasOpen.has(key);const s=node('summary'),heading=node('span','group-heading',GROUPS[key]?.[language]||key||t('Zbirka','Collection'));heading.append(node('span','group-count',String(entries.length)));s.append(heading);const list=node('ul','catalogue-items');for(const p of entries){const li=node('li'),a=node('a','',p.title);a.href=p.url;a.title=description(p);li.append(a);list.append(li)}d.append(s,list);target.append(d)}
}
$('#catalogue-search').addEventListener('input',renderCatalogue);

function setFont(n,persist=true){font=Math.max(.8,Math.min(1.5,Math.round(n*20)/20));root.style.setProperty('--scale',font);root.dataset.largeText=String(font>=1.25);$('#font-reset').textContent=Math.round(font*100)+'%';$('#font-down').disabled=font<=.8;$('#font-up').disabled=font>=1.5;if(persist)save('mdlxdcc-font',font);positionReveal()}
function setTheme(theme,persist=true){root.dataset.theme=theme==='dark'?'dark':'light';$('meta[name="theme-color"]').content=theme==='dark'?'#101b1c':'#f4f1e9';$('#theme-switch').setAttribute('aria-label',theme==='dark'?t('Preklopi na svetlo temo','Switch to light theme'):t('Preklopi na temno temo','Switch to dark theme'));if(persist)save('mdlxdcc-theme',root.dataset.theme)}
function applyLanguage(lang){language=lang==='en'?'en':'sl';root.lang=language;root.dataset.lang=language;$$('[data-language]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.language===language)));$('#catalogue-search').placeholder=t('Projekt, pojem, povezava …','Project, idea, connection …');renderProjects();renderCatalogue();setTheme(root.dataset.theme,false)}
const settings=$('#settings');$('#settings-open').addEventListener('click',()=>{closeReveal();settings.showModal()});$('#settings-close').addEventListener('click',()=>settings.close());settings.addEventListener('click',e=>{if(e.target!==settings)return;const r=settings.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)settings.close()});
$('#theme-switch').addEventListener('click',()=>setTheme(root.dataset.theme==='light'?'dark':'light'));$('#font-down').addEventListener('click',()=>setFont(font-.05));$('#font-up').addEventListener('click',()=>setFont(font+.05));$('#font-reset').addEventListener('click',()=>setFont(1));
$$('[data-language]').forEach(b=>b.addEventListener('click',()=>{if(window.MDLxDCCLocale)window.MDLxDCCLocale.choose(b.dataset.language);else{save('mdlxdcc-lang',b.dataset.language);applyLanguage(b.dataset.language)}}));
window.addEventListener('storage',e=>{if(e.key==='mdlxdcc-theme')setTheme(e.newValue,false);if(e.key==='mdlxdcc-font')setFont(Number(e.newValue)||1,false)});

for(let i=0;i<24;i++){const polygon=document.createElementNS('http://www.w3.org/2000/svg','polygon');polygon.setAttribute('points','150,28 203.7,121 96.3,121');polygon.setAttribute('transform',`rotate(${i*15} 150 90)`);$('#geometry-petals').append(polygon)}
$$('[data-term]').forEach(b=>{const g=GLOSSARY.find(g=>g.id===b.dataset.term||g.term.toLowerCase()===b.dataset.term);if(g)bindReveal(b,g)});
setFont(font,false);applyLanguage(language);window.MDLxDCCLocale?.subscribe(applyLanguage);
loadCatalogue().then(result=>{catalogue=result.items;complete=result.complete;loaded=true;renderCatalogue()}).catch(()=>{loaded=true;renderCatalogue()});
