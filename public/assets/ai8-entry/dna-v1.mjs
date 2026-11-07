import {CURATED, GROUPS, loadCatalogue} from './catalog.mjs';

const $ = s => document.querySelector(s), root = document.documentElement;
const canvas = $('#dna-canvas'), ctx = canvas.getContext('2d'), main = $('#dna'), nodes = $('#dna-nodes');
const panel = $('#dna-panel'), body = $('#panel-body'), origin = $('#dna-origin');
const read = (k, fallback = '') => {try{return localStorage.getItem(k) || fallback;}catch{return fallback;}};
const save = (k, v) => {try{localStorage.setItem(k,String(v));}catch{}};
const queryLang = new URLSearchParams(location.search).get('lang');
let lang = ['sl','en'].includes(queryLang) ? queryLang : read('mdlxdcc-lang',navigator.language.startsWith('sl') ? 'sl' : 'en');
if (!['sl','en'].includes(lang)) lang = 'en';
let scale = Number(read('mdlxdcc-font','1'));if(!(scale>=.8&&scale<=1.5))scale=1;
root.style.setProperty('--scale',scale);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let paused = read('ai8-dna-paused') === 'true', items = [...CURATED], complete = false;
let active = null, pinned = false, opener = null, hoverTimer, closeTimer, ignoreFocus = false;
let width = document.documentElement.clientWidth, height = innerHeight, frame = 0;
const buttons = new Map();
const t = (sl,en) => lang === 'sl' ? sl : en;
const KINDS={archive:['Arhiv','Archive'],tool:['Orodje','Tool'],game:['Igra','Game'],research:['Raziskava','Research'],gallery:['Galerija','Gallery'],story:['Zgodba','Story'],concept:['Zamisel','Concept'],collection:['Zbirka','Collection'],dialogue:['Pogovor','Dialogue'],portrait:['Portret','Portrait'],entrance:['Vstop','Entrance'],page:['Podstran','Page']};
const palette = ['#a7d9c5','#daca9c','#a4c8e3','#bbb0dc','#c8d6c8'];
const originY = 84, firstY = 174, step = 54;
const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const groupName = item => GROUPS[item.group]?.[lang] || item.group || t('Zbirka','Collection');
const safeURL = raw => {try{const u=new URL(raw,location.origin);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}};

function setLang(next,persist = true) {
  lang=next;root.lang=lang;
  if(persist){save('mdlxdcc-lang',lang);save('mdlxdcc-locale-v1',JSON.stringify({lang,source:'manual',at:Date.now()}));save('bdPortraitLang',lang);}
  origin.setAttribute('aria-label',t('AI8 DNA v1 · raziskuj, išči, nastavitve','AI8 DNA v1 · explore, search, settings'));
  $('#dna-instructions').textContent=t('S tipko Tab raziskuj točke verige. Enter odpre opis in povezavo. Escape zapre opis. Prva točka vsebuje iskanje in nastavitve.','Use Tab to explore the strand. Enter opens a description and link. Escape closes it. The first point contains search and settings.');
  $('#panel-close').setAttribute('aria-label',t('Zapri','Close'));$('#panel-overline').setAttribute('aria-label',t('AI8 DNA v1 · iskanje in nastavitve','AI8 DNA v1 · search and settings'));$('#panel-overline').title=t('AI8 DNA v1 · iskanje in nastavitve','AI8 DNA v1 · search and settings');
  for(const item of items){buttons.get(item.id)?.setAttribute('aria-label',item.title+' · '+groupName(item));}
  if(active){fillPanel(active);positionPanel();}
}

// The geometry never moves under the pointer. Only light changes.
function geometry(y,side=0) {
  const amplitude=Math.min(188,width*.275), theta=(y-firstY)*Math.PI*2/580+.62;
  const centre=width/2+Math.sin((y-firstY)/1120)*Math.min(width*.065,65);
  const sign=side===0?1:-1;
  return {x:centre+sign*Math.cos(theta)*amplitude,y,z:sign*Math.sin(theta),centre,amplitude};
}
function nodePosition(i){return geometry(firstY+i*step,i%2);}

function scheduleDraw(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;draw();});}
function draw(){
  if(!ctx)return;
  const dpr=Math.min(devicePixelRatio||1,2), top=scrollY, bottom=top+height;
  if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.lineCap='round';
  const end=firstY+(items.length-1)*step+130, start=Math.max(firstY-42,top-40), finish=Math.min(end,bottom+40);
  if(top<firstY){for(let side=0;side<2;side++){const p=geometry(firstY-42,side);ctx.beginPath();ctx.moveTo(width/2,originY-top);ctx.bezierCurveTo(width/2,originY+32-top,p.x,firstY-70-top,p.x,p.y-top);ctx.strokeStyle=side?'#b5b28b7a':'#9cd7ca8a';ctx.lineWidth=1.2;ctx.stroke();}}
  // Rungs and their small nucleotide beads remain subordinate to the two backbones.
  for(let y=Math.ceil(start/17)*17;y<finish;y+=17){
    const a=geometry(y,0),b=geometry(y,1),fade=.16+.16*Math.abs(a.z);
    const grad=ctx.createLinearGradient(a.x,y-top,b.x+0.1,y-top);grad.addColorStop(0,`rgba(143,211,197,${fade})`);grad.addColorStop(.5,`rgba(147,178,182,${fade*.6})`);grad.addColorStop(1,`rgba(208,194,147,${fade})`);
    ctx.strokeStyle=grad;ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(a.x,y-top);ctx.bezierCurveTo(a.centre,y+8*a.z-top,a.centre,y-8*a.z-top,b.x,y-top);ctx.stroke();
    if(Math.abs(a.x-b.x)>60){for(let j=1;j<5;j++){const f=j/5;ctx.beginPath();ctx.arc(a.x+(b.x-a.x)*f,y+Math.sin(f*Math.PI*2)*a.z*3-top,1.05,0,Math.PI*2);ctx.fillStyle=`rgba(177,201,193,${fade*.65})`;ctx.fill();}}
  }
  // Fine layered filaments give depth without a large animated or raster asset.
  for(let side=0;side<2;side++){
    for(let y=start;y<finish;y+=5){
      const a=geometry(y,side),b=geometry(Math.min(y+5,finish),side),depth=(a.z+1)/2;
      for(let pass=0;pass<3;pass++){
        ctx.beginPath();ctx.moveTo(a.x,y-top);ctx.lineTo(b.x,b.y-top);
        ctx.lineWidth=pass===0?9:pass===1?3.2:1.1;
        const alpha=pass===0?.025+depth*.035:pass===1?.12+depth*.2:.28+depth*.55;
        ctx.strokeStyle=side===0?`rgba(158,221,207,${alpha})`:`rgba(215,202,160,${alpha})`;ctx.stroke();
      }
      if(a.z>.25){ctx.beginPath();ctx.moveTo(a.x+2,y-top);ctx.lineTo(b.x+2,b.y-top);ctx.strokeStyle=side?'#ebdfa51a':'#bcf0e31a';ctx.lineWidth=.7;ctx.stroke();}
    }
  }
}

const observer=new IntersectionObserver(entries=>{for(const e of entries)e.target.classList.toggle('is-visible',e.isIntersecting);},{rootMargin:'50px'});
function renderNodes(){
  items.forEach((item,i)=>{
    let btn=buttons.get(item.id);
    if(!btn){
      btn=document.createElement('button');btn.type='button';btn.className='dna-node'+(item.featured?' featured':'');btn.dataset.project=item.id;
      btn.setAttribute('aria-controls','dna-panel');btn.setAttribute('aria-expanded','false');btn.innerHTML='<span class="nucleus" aria-hidden="true"></span>';
      btn.style.setProperty('--node',GROUPS[item.group]?.color||palette[i%palette.length]);btn.style.setProperty('--delay',(-(i*3.73)%13)+'s');
      bindNode(btn,item.id);buttons.set(item.id,btn);nodes.append(btn);observer.observe(btn);
    }
    btn.setAttribute('aria-label',item.title+' · '+groupName(item));
    const p=nodePosition(i);btn.style.left=p.x+'px';btn.style.top=p.y+'px';
  });
  origin.style.left=width/2+'px';origin.style.top=originY+'px';
  main.style.height=Math.max(height,firstY+items.length*step+150)+'px';
  scheduleDraw();
}
function bindNode(btn,id){
  btn.addEventListener('pointerenter',e=>{clearTimeout(closeTimer);if(e.pointerType==='touch'||pinned)return;clearTimeout(hoverTimer);hoverTimer=setTimeout(()=>openPanel(id,btn,false),130);});
  btn.addEventListener('pointerleave',()=>{clearTimeout(hoverTimer);if(!pinned)scheduleClose();});
  btn.addEventListener('focus',()=>{if(ignoreFocus)return;openPanel(id,btn,false);});
  btn.addEventListener('click',()=>{if(active===id&&pinned){closePanel(true);return;}openPanel(id,btn,true);$('#panel-close').focus({preventScroll:true});});
  btn.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const list=[origin,...buttons.values()],next=list[list.indexOf(btn)+(e.key==='ArrowDown'?1:-1)];next?.focus();}});
}
function scheduleClose(){clearTimeout(closeTimer);closeTimer=setTimeout(()=>{if(!pinned&&!panel.matches(':hover')&&!panel.contains(document.activeElement)&&!opener?.matches(':focus-visible'))closePanel(false);},260);}
function openPanel(id,btn,pin){
  clearTimeout(closeTimer);clearTimeout(hoverTimer);
  if(opener&&opener!==btn)opener.setAttribute('aria-expanded','false');
  active=id;opener=btn;pinned=pin;opener.setAttribute('aria-expanded','true');
  fillPanel(id);panel.hidden=false;positionPanel();
}
function closePanel(restore=false){
  clearTimeout(closeTimer);clearTimeout(hoverTimer);panel.hidden=true;
  const previous=opener;previous?.setAttribute('aria-expanded','false');active=null;pinned=false;opener=null;
  if(restore&&previous){ignoreFocus=true;previous.focus({preventScroll:true});ignoreFocus=false;}
}
function positionPanel(){
  if(panel.hidden||!opener)return;
  const viewport=window.visualViewport,pad=14;
  const availableWidth=viewport?.width||width,availableHeight=viewport?.height||height;
  const vx=viewport?.offsetLeft||0,vy=viewport?.offsetTop||0;
  panel.style.maxHeight=Math.max(100,availableHeight-2*pad)+'px';
  panel.style.maxWidth=Math.max(100,availableWidth-2*pad)+'px';
  const r=opener.getBoundingClientRect(),pw=panel.offsetWidth,ph=panel.offsetHeight;
  let left=r.right+14;
  if(left+pw>vx+availableWidth-pad)left=r.left-pw-14;
  if(left<vx+pad)left=vx+(availableWidth-pw)/2;
  let top=availableWidth<620?r.bottom+12:r.top-20;
  top=Math.max(vy+pad,Math.min(top,vy+availableHeight-ph-pad));
  panel.style.left=Math.max(vx+pad,Math.min(left,vx+availableWidth-pw-pad))+'px';panel.style.top=top+'px';
}
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function link(text,url,cls){const a=el('a',text,cls);a.href=safeURL(url)||'/index-atlas.html';return a;}
function fillPanel(id){
  body.replaceChildren();panel.scrollTop=0;$('#panel-overline').disabled=id==='origin';
  if(id==='origin'){fillGuide();return;}
  const item=items.find(p=>p.id===id);if(!item)return;
  const kind=KINDS[item.kind];$('#panel-overline').textContent=groupName(item)+(kind?' / '+t(...kind):'');$('#panel-title').textContent=item.title;
  body.append(el('p',item[lang]||item.en||item.sl));
  const a=link('',item.url,'project-cta');a.append(el('span',t('Odpri projekt','Explore project')),el('span','↗'));body.append(a);
  const related=(item.related||[]).map(x=>items.find(p=>p.id===x)).filter(Boolean);
  if(related.length){const wrap=el('div',undefined,'related');wrap.append(el('span',t('Povezano v verigi','Connected in the strand'),'related-label'));for(const other of related){const b=el('button',other.title);b.type='button';b.addEventListener('click',()=>goTo(other.id));wrap.append(b);}body.append(wrap);}
  body.append(el('span',item.url,'project-path'));
}
function fillGuide(){
  $('#panel-overline').textContent='BD × AI LAB';$('#panel-title').textContent='AI8 DNA v1';
  body.append(el('p',t('Vsaka točka nosi del našega dela. Ustavi se ob njej. Odpri povezavo. Nadaljuj po verigi.','Every point holds a piece of our work. Pause over it. Open a connection. Follow the strand.')));
  body.append(el('span',items.length+' '+t('povezav','connections')+' · '+(complete?t('javna zbirka','public collection'):t('izbor projektov','selected projects')),'origin-count'));
  const nav=el('nav',undefined,'guide-links');nav.setAttribute('aria-label',t('Vstopne strani','Entry pages'));nav.append(link('MDL×DCC','/'),link('AI8 Codex','/ai8-codex.html'),link('Atlas','/index-atlas.html'));body.append(nav);
  const label=el('label',t('Poišči točko v verigi','Find a point in the strand'),'search-label');label.htmlFor='dna-search';
  const input=el('input',undefined,'search-input');input.type='search';input.id='dna-search';input.placeholder=t('Projekt, pojem, podstran …','Project, concept, page …');input.autocomplete='off';
  const results=el('ul',undefined,'search-results');results.id='dna-results';results.setAttribute('aria-label',t('Rezultati iskanja','Search results'));input.setAttribute('aria-controls','dna-results');
  input.addEventListener('input',()=>{
    pinned=true;results.replaceChildren();const terms=normalize(input.value).split(/\s+/).filter(Boolean);if(!terms.length){positionPanel();return;}
    const matches=items.filter(p=>terms.every(w=>normalize([p.title,p.sl,p.en,p.url,p.group].join(' ')).includes(w))).slice(0,20);
    for(const match of matches){const li=el('li'),b=el('button');b.type='button';b.append(el('span',match.title),el('span','↗ DNA'));b.addEventListener('click',()=>goTo(match.id));li.append(b);results.append(li);}
    if(!matches.length)results.append(el('li',t('Ni zadetkov. Poskusi drug izraz.','No matches. Try another term.'),'search-empty'));
    $('#dna-status').textContent=matches.length+' '+t('zadetkov','results');positionPanel();
  });body.append(label,input,results);
  const controls=el('div',undefined,'guide-controls');
  for(const l of ['sl','en']){const b=el('button',l.toUpperCase());b.type='button';b.setAttribute('aria-label',l==='sl'?'Slovenščina':'English');b.setAttribute('aria-pressed',String(lang===l));b.addEventListener('click',()=>{setLang(l);body.querySelector(`[aria-label="${l==='sl'?'Slovenščina':'English'}"]`).focus();});controls.append(b);}
  for(const [label,amount] of [['A−',-.05],['A+',.05]]){const b=el('button',label);b.type='button';b.setAttribute('aria-label',amount<0?t('Manjše besedilo','Smaller text'):t('Večje besedilo','Larger text'));b.addEventListener('click',()=>{scale=Math.max(.8,Math.min(1.5,Math.round((scale+amount)*100)/100));root.style.setProperty('--scale',scale);save('mdlxdcc-font',scale);positionPanel();});controls.append(b);}
  const motion=el('button',paused||reduced.matches?t('Mirovanje','Still'):t('Žarenje','Glow'),'motion');motion.type='button';motion.setAttribute('aria-pressed',String(paused||reduced.matches));motion.disabled=reduced.matches;motion.addEventListener('click',()=>{paused=!paused;save('ai8-dna-paused',paused);applyMotion();motion.textContent=paused?t('Mirovanje','Still'):t('Žarenje','Glow');motion.setAttribute('aria-pressed',String(paused));});controls.append(motion);body.append(controls);
}
function goTo(id){
  const btn=buttons.get(id);if(!btn)return;
  closePanel(false);btn.scrollIntoView({behavior:'instant',block:'center'});ignoreFocus=true;btn.focus({preventScroll:true});ignoreFocus=false;openPanel(id,btn,true);$('#panel-close').focus({preventScroll:true});
}
function applyMotion(){root.classList.toggle('paused',paused||reduced.matches);}
bindNode(origin,'origin');observer.observe(origin);
panel.addEventListener('pointerenter',()=>{clearTimeout(closeTimer);});panel.addEventListener('pointerleave',scheduleClose);
panel.addEventListener('focusin',()=>{pinned=true;clearTimeout(closeTimer);});
panel.addEventListener('keydown',e=>{
  if(e.key!=='Tab'||!pinned)return;
  const list=[...panel.querySelectorAll('a[href],button:not(:disabled),input')];
  if(e.shiftKey&&document.activeElement===list[0]){e.preventDefault();list.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===list.at(-1)){e.preventDefault();list[0]?.focus();}
});
$('#panel-close').addEventListener('click',()=>closePanel(true));
$('#panel-overline').addEventListener('click',()=>{openPanel('origin',opener||origin,true);$('#dna-search').focus({preventScroll:true});});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.preventDefault();closePanel(true);}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPanel('origin',origin,true);$('#dna-search').focus();}});
document.addEventListener('pointerdown',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!e.target.closest('.dna-node'))closePanel(false);});
document.addEventListener('focusin',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!e.target.closest('.dna-node'))closePanel(false);});
window.addEventListener('scroll',()=>{scheduleDraw();if(active){const r=opener.getBoundingClientRect();if(r.bottom<0||r.top>height)closePanel(false);else positionPanel();}},{passive:true});
window.addEventListener('resize',()=>{width=document.documentElement.clientWidth;height=innerHeight;renderNodes();positionPanel();});
window.visualViewport?.addEventListener('resize',positionPanel);
window.visualViewport?.addEventListener('scroll',positionPanel);
reduced.addEventListener('change',()=>{applyMotion();const motion=body.querySelector('.motion');if(motion){motion.disabled=reduced.matches;motion.textContent=paused||reduced.matches?t('Mirovanje','Still'):t('Žarenje','Glow');motion.setAttribute('aria-pressed',String(paused||reduced.matches));}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)root.classList.add('paused');else applyMotion();});
setLang(lang,!!queryLang);applyMotion();renderNodes();
loadCatalogue().then(result=>{
  items=result.items;complete=result.complete;renderNodes();
  if(active==='origin'){
    const count=body.querySelector('.origin-count');
    if(count)count.textContent=items.length+' '+t('povezav','connections')+' · '+(complete?t('javna zbirka','public collection'):t('izbor projektov','selected projects'));
    const search=$('#dna-search');if(search?.value)search.dispatchEvent(new Event('input',{bubbles:true}));
    positionPanel();
  }
}).catch(()=>{});
