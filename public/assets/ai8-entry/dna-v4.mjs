import {CURATED, GROUPS, loadCatalogue} from './featured-catalog.mjs';
import {textEnabled} from './text-setting.mjs';
import {decorateDNA} from './dna-top-points.mjs?v=20261108-top3';
import {SECTIONS, classify, buildStrand, LOOP_HEIGHT, FIRST_Y, FIRST_CROSS} from './dna-sections.mjs';

const $ = s => document.querySelector(s), root = document.documentElement;
const canvas = $('#dna-canvas'), ctx = canvas.getContext('2d'), main = $('#dna'), nodes = $('#dna-nodes');
const panel = $('#dna-panel'), body = $('#panel-body'), origin = $('#dna-origin');
const read = (k, fallback = '') => {try{return localStorage.getItem(k) || fallback;}catch{return fallback;}};
const save = (k, v) => {try{localStorage.setItem(k,String(v));}catch{}};
let labelsShown=textEnabled();
document.addEventListener('ai8-dna:text',e=>{labelsShown=e.detail.enabled;});
const queryLang = new URLSearchParams(location.search).get('lang');
let lang = ['sl','en'].includes(queryLang) ? queryLang : read('mdlxdcc-lang',navigator.language.startsWith('sl') ? 'sl' : 'en');
if (!['sl','en'].includes(lang)) lang = 'en';
let scale = Number(read('mdlxdcc-font','1'));if(!(scale>=.8&&scale<=1.5))scale=1;
root.style.setProperty('--scale',scale);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let paused = read('ai8-dna-current-paused') === 'true', items = classify(decorateDNA(CURATED)), complete = false;
let active = null, pinned = false, opener = null, hoverTimer, closeTimer, ignoreFocus = false;
let interaction = null, lastInput = 'keyboard', pendingHover = null, closeReason = null, nearNode = null, suppressedHover = null;
let width = document.documentElement.clientWidth, height = innerHeight, frame = 0;
const buttons = new Map();
let strand=buildStrand(items), displays=[], selectedSection=null, sectionPinned=false, sectionOpener=null;
const sectionNotes=new Map();
const sectionLayer=nodes;
function orderControls(){for(const control of [...nodes.children].sort((a,b)=>parseFloat(a.style.top)-parseFloat(b.style.top)))nodes.append(control);}
function viewport(){
  const v=window.visualViewport;
  return {left:v?.pageLeft??scrollX,top:v?.pageTop??scrollY,width:v?.width||width,height:v?.height||height,scale:v?.scale||1};
}
function positionSectionNote(){
  const note=sectionNotes.get(sectionOpener);if(!note||note.hidden)return;
  const v=viewport(),pad=14/v.scale,x=parseFloat(sectionOpener.style.left),y=parseFloat(sectionOpener.style.top);
  note.style.width=Math.min(260,v.width-pad*2)+'px';note.style.maxHeight=Math.max(1,v.height-pad*2)+'px';
  const w=note.offsetWidth,h=note.offsetHeight,half=sectionOpener.offsetHeight/2;
  let left=x-w/2,top=y+half+12;
  const outer=strandAmplitude()+Math.min(width*.035,40)+24;
  if(v.width>=680&&width/2+outer+w<v.left+v.width-pad){left=width/2+outer;top=y-h/2;}
  else if(top+h>v.top+v.height-pad)top=y-half-h-12;
  note.style.left=Math.max(v.left+pad,Math.min(left,v.left+v.width-w-pad))+'px';
  note.style.top=Math.max(v.top+pad,Math.min(top,v.top+v.height-h-pad))+'px';
}
function selectSection(id,pin=false,button=sectionOpener){
  selectedSection=id;sectionPinned=pin;sectionOpener=id?button:null;
  main.classList.toggle('section-selected',!!id);
  for(const btn of buttons.values())btn.classList.toggle('section-active',btn.dataset.section===id);
  for(const btn of sectionLayer.querySelectorAll('.section-label')){
    const selected=btn.dataset.section===id,expanded=selected&&btn===sectionOpener;
    btn.classList.toggle('section-active',selected);btn.setAttribute('aria-expanded',String(expanded));btn.setAttribute('aria-pressed',String(selected&&pin));
    sectionNotes.get(btn).hidden=!expanded;
  }
  positionSectionNote();scheduleDraw();
}
function renderSections(){
  const previous=sectionOpener?{section:sectionOpener.dataset.section,top:sectionOpener.style.top}:null;
  for(const label of sectionLayer.querySelectorAll('.section-label'))label.remove();
  for(const note of sectionNotes.values())note.remove();sectionNotes.clear();sectionOpener=null;
  for(const [i,loop] of strand.loops.entries()){
    if(!loop.label)continue;
    const section=SECTIONS.find(s=>s.id===loop.section),btn=el('button',undefined,'section-label');
    btn.type='button';btn.dataset.section=section.id;btn.style.top=loop.centre+'px';
    btn.style.left=geometry(loop.centre).centre+'px';btn.style.width=Math.max(94,Math.min(156,strandAmplitude()*2-44))+'px';
    const title=width<600&&section.id==='cfh'?t('CFH / Zavest','CFH'):width<600&&section.id==='lab'?'LAB':section[lang];
    btn.append(el('span',title),el('small',loop.count+' '+t('strani','pages')+(loop.total>1?' · '+loop.part+'/'+loop.total:'')));
    btn.setAttribute('aria-controls','section-note-'+i);btn.setAttribute('aria-describedby','section-note-'+i);btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-pressed','false');
    const note=el('div',undefined,'section-note');note.id='section-note-'+i;note.hidden=true;note.setAttribute('role','tooltip');
    note.append(el('strong',section.name[lang]),el('span',section.description[lang]));
    document.body.append(note);sectionNotes.set(btn,note);btn.setAttribute('aria-label',section.name[lang]+' · '+loop.count+' '+t('strani','pages'));
    btn.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch'&&!sectionPinned){closePanel(false);selectSection(section.id,false,btn);}});
    btn.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch'&&!sectionPinned&&document.activeElement!==btn)selectSection(null);});
    btn.addEventListener('focus',()=>{if(lastInput==='keyboard'){closePanel(false);selectSection(section.id,false,btn);}});
    btn.addEventListener('keydown',e=>arrowNavigate(e,btn));
    btn.addEventListener('blur',()=>{if(!sectionPinned)selectSection(null);});
    btn.addEventListener('click',e=>{e.stopPropagation();closePanel(false);const off=sectionPinned&&selectedSection===section.id;selectSection(off?null:section.id,!off,btn);});
    sectionLayer.append(btn);
    if(previous?.section===section.id&&previous.top===btn.style.top)sectionOpener=btn;
  }
  orderControls();selectSection(selectedSection,sectionPinned,sectionOpener);
}
const t = (sl,en) => lang === 'sl' ? sl : en;
const KINDS={archive:['Arhiv','Archive'],tool:['Orodje','Tool'],game:['Igra','Game'],research:['Raziskava','Research'],gallery:['Galerija','Gallery'],story:['Zgodba','Story'],concept:['Zamisel','Concept'],collection:['Zbirka','Collection'],dialogue:['Pogovor','Dialogue'],portrait:['Portret','Portrait'],entrance:['Vstop','Entrance'],page:['Podstran','Page']};
const palette = ['#a7d9c5','#daca9c','#a4c8e3','#bbb0dc','#c8d6c8'];
const originY = 70, firstY = FIRST_Y;
const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const groupName = item => SECTIONS.find(s=>s.id===item.category)?.[lang] || GROUPS[item.group]?.[lang] || item.group || t('Zbirka','Collection');
const safeURL = raw => {try{const u=new URL(raw,location.origin);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}};

function setLang(next,persist = true) {
  lang=next;root.lang=lang;
  $('#dna-text-label').textContent=t('Nazivi','Text on/off');
  if(persist){save('mdlxdcc-lang',lang);save('mdlxdcc-locale-v1',JSON.stringify({lang,source:'manual',at:Date.now()}));save('bdPortraitLang',lang);}
  origin.setAttribute('aria-label',t('AI8 DNA · glavna stran','AI8 DNA · home page'));
  origin.title=t('Klik odpre glavno stran','Click to open the home page');
  $('#dna-instructions').textContent=t('Približaj se točki za opis. Klik ali Enter odpre stran. Klik na vrhnjo točko vrne na glavno stran. Na dotik prvi dotik odpre opis, drugi stran. Iskanje in nastavitve odpre oznaka nad opisom ali Ctrl+K. Escape zapre opis.','Approach a point for its description. Click or Enter opens the page. The top point returns home. On touch, tap once for the description and again to open the page. Use the label above a description or Ctrl+K for search and settings. Escape closes the description.');
  $('#panel-close').setAttribute('aria-label',t('Zapri','Close'));$('#panel-overline').setAttribute('aria-label',t('AI8 DNA · iskanje in nastavitve','AI8 DNA · search and settings'));$('#panel-overline').title=t('AI8 DNA · iskanje in nastavitve','AI8 DNA · search and settings');
  if(sectionLayer.querySelector('.section-label'))renderSections();
  for(const item of displays){buttons.get(item.id)?.setAttribute('aria-label',item.title+' · '+groupName(item)+(item.featured?' · '+t('Izbrani projekt','Featured project'):'')+(item.dnaTop?' · '+t('BD izbor','BD selection'):''));}
  if(active){fillPanel(active);positionPanel();}
}

// Nuclei stay anchored; only their visual size and their labels grow.
const strandAmplitude=()=>Math.min(158,width*(width>=680&&width<1100?.12:.20));
function geometry(y,side=0) {
  const amplitude=strandAmplitude(),theta=(y-firstY)*Math.PI*2/460+.62;
  const centre=width/2+Math.sin((y-firstY)/1000)*Math.min(width*.035,40);
  const sign=side===0?1:-1;
  return {x:centre+sign*Math.cos(theta)*amplitude,y,z:sign*Math.sin(theta),centre,amplitude};
}
function nodePosition(i){const d=displays[i];return geometry(d.y,d.side);}
function segmentAlpha(y){
  if(!selectedSection)return 1;
  const loop=strand.loops[y<FIRST_CROSS?0:1+Math.floor((y-FIRST_CROSS)/LOOP_HEIGHT)];
  return loop?.section===selectedSection?1.5:.55;
}

function scheduleDraw(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;draw();});}
function draw(){
  if(!ctx)return;
  // An absolute, viewport-sized tile shares document coordinates with every
  // DOM anchor. Avoid fixed-layer compositing during Safari pinch/pan.
  const v=viewport(),dpr=Math.min(devicePixelRatio||1,2)*v.scale,top=v.top,bottom=top+v.height;
  canvas.style.left=v.left+'px';canvas.style.top=top+'px';canvas.style.width=v.width+'px';canvas.style.height=v.height+'px';
  const pixelsWide=Math.ceil(v.width*dpr),pixelsHigh=Math.ceil(v.height*dpr);
  if(canvas.width!==pixelsWide||canvas.height!==pixelsHigh){canvas.width=pixelsWide;canvas.height=pixelsHigh;}
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
  const pixelX=canvas.width/v.width,pixelY=canvas.height/v.height;
  ctx.setTransform(pixelX,0,0,pixelY,-v.left*pixelX,-top*pixelY);ctx.lineCap='round';
  const end=strand.end, start=Math.max(firstY-42,top-40), finish=Math.min(end,bottom+40);
  if(top<firstY){for(let side=0;side<2;side++){const p=geometry(firstY-42,side);ctx.beginPath();ctx.moveTo(width/2,originY);ctx.bezierCurveTo(width/2,originY+32,p.x,firstY-70,p.x,p.y);ctx.strokeStyle=side?'#b5b28b7a':'#9cd7ca8a';ctx.lineWidth=1.2;ctx.stroke();}}
  // Rungs and their small nucleotide beads remain subordinate to the two backbones.
  for(let y=Math.ceil(start/14)*14;y<finish;y+=14){
    const a=geometry(y,0),b=geometry(y,1),fade=(.16+.16*Math.abs(a.z))*segmentAlpha(y);
    const grad=ctx.createLinearGradient(a.x,y,b.x+0.1,y);grad.addColorStop(0,`rgba(143,211,197,${fade})`);grad.addColorStop(.5,`rgba(147,178,182,${fade*.6})`);grad.addColorStop(1,`rgba(208,194,147,${fade})`);
    ctx.strokeStyle=grad;ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(a.x,y);ctx.bezierCurveTo(a.centre,y+8*a.z,a.centre,y-8*a.z,b.x,y);ctx.stroke();
    if(Math.abs(a.x-b.x)>60){for(let j=1;j<5;j++){const f=j/5;ctx.beginPath();ctx.arc(a.x+(b.x-a.x)*f,y+Math.sin(f*Math.PI*2)*a.z*3,1.05,0,Math.PI*2);ctx.fillStyle=`rgba(177,201,193,${fade*.65})`;ctx.fill();}}
  }
  // Fine layered filaments give depth without a large animated or raster asset.
  for(let side=0;side<2;side++){
    for(let y=start;y<finish;y+=5){
      const a=geometry(y,side),b=geometry(Math.min(y+5,finish),side),depth=(a.z+1)/2;
      for(let pass=0;pass<3;pass++){
        ctx.beginPath();ctx.moveTo(a.x,y);ctx.lineTo(b.x,b.y);
        ctx.lineWidth=pass===0?9:pass===1?3.2:1.1;
        const alpha=(pass===0?.025+depth*.035:pass===1?.12+depth*.2:.28+depth*.55)*Math.min(1.3,segmentAlpha(y));
        ctx.strokeStyle=side===0?`rgba(158,221,207,${alpha})`:`rgba(215,202,160,${alpha})`;ctx.stroke();
      }
      if(a.z>.25){ctx.beginPath();ctx.moveTo(a.x+2,y);ctx.lineTo(b.x+2,b.y);ctx.strokeStyle=side?'#ebdfa51a':'#bcf0e31a';ctx.lineWidth=.7;ctx.stroke();}
    }
  }
}

const observer=new IntersectionObserver(entries=>{for(const e of entries)e.target.classList.toggle('is-visible',e.isIntersecting);},{rootMargin:'50px'});
function renderNodes(){
  strand=buildStrand(items);
  displays=strand.instances.map(d=>({...d.project,id:d.id,projectId:d.project.id,section:d.section,y:d.y,side:d.side}));
  renderSections();
  displays.forEach((item,i)=>{
    let btn=buttons.get(item.id);
    if(!btn){
      btn=document.createElement('button');btn.type='button';btn.className='dna-node'+(item.featured?' featured':'');btn.dataset.project=item.id;btn.dataset.record=item.projectId;btn.dataset.section=item.section;btn.id='node-'+item.id.replace(':','-');
      btn.setAttribute('aria-controls','dna-panel');btn.setAttribute('aria-expanded','false');btn.innerHTML='<span class="nucleus" aria-hidden="true"></span><span class="node-label" aria-hidden="true"></span>';btn.querySelector('.node-label').textContent=item.title;
      btn.style.setProperty('--node',GROUPS[item.group]?.color||palette[i%palette.length]);btn.style.setProperty('--delay',(-(i*3.73)%13)+'s');
      bindNode(btn,item.id);buttons.set(item.id,btn);nodes.append(btn);observer.observe(btn);
    }
    btn.classList.toggle('dna-top',!!item.dnaTop);
    btn.querySelector('.node-label').textContent=item.dnaLabel||item.title;
    btn.setAttribute('aria-label',item.title+' · '+groupName(item)+(item.featured?' · '+t('Izbrani projekt','Featured project'):'')+(item.dnaTop?' · '+t('BD izbor','BD selection'):''));
    nodes.append(btn);
    const p=nodePosition(i);btn.style.left=p.x+'px';btn.style.top=p.y+'px';
    const left=p.x<p.centre;btn.classList.toggle('label-left',left);btn.style.setProperty('--label-width',Math.max(12,Math.min(220,(left?p.x-26:width-p.x-26)/1.5))+'px');
  });
  origin.style.left=width/2+'px';origin.style.top=originY+'px';
  main.style.height=Math.max(height,strand.end+100)+'px';
  orderControls();selectSection(selectedSection,sectionPinned);scheduleDraw();
}
function arrowNavigate(e,btn){
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const list=[...nodes.children],next=list[list.indexOf(btn)+(e.key==='ArrowDown'?1:-1)];next?.focus();}
}
function bindNode(btn,id){
  btn.addEventListener('focus',()=>{if(ignoreFocus||lastInput!=='keyboard')return;openPanel(id,btn,false,'keyboard');});
  btn.addEventListener('keydown',e=>arrowNavigate(e,btn));
}
function cancelHover(){clearTimeout(hoverTimer);pendingHover=null;}
function cancelClose(){clearTimeout(closeTimer);closeReason=null;}
function setNear(btn){
  if(nearNode===btn)return;
  nearNode?.classList.remove('is-near');nearNode=btn;btn?.classList.add('is-near');main.classList.toggle('near-point',!!btn);
}
// Resolve nearby nuclei and visible labels independently of overlapping buttons.
// Read unscaled label dimensions so enlargement cannot make the selection jump.
function nearestPoint(x,y,radius=36){
  let best=null,bestDistance=radius;
  const consider=(id,btn,p)=>{
    let d=Math.hypot(p.x-x,p.y-y);
    const label=btn.querySelector('.node-label');
    if(labelsShown&&label){
      const isOrigin=id==='origin', zoom=btn===nearNode?1.5:1;
      const w=label.offsetWidth*zoom,h=label.offsetHeight*zoom;
      const left=isOrigin?p.x-w/2:btn.classList.contains('label-left')?p.x-14-w:p.x+14;
      const top=isOrigin?p.y+24:p.y-h/2;
      const dx=Math.max(left-x,0,x-left-w),dy=Math.max(top-y,0,y-top-h);
      if(Math.hypot(dx,dy)<=8)d=Math.min(d,Math.hypot(dx,dy)+Math.abs(y-(top+h/2))*.15+.5);
    }
    if(d<=bestDistance){best={id,btn,distance:d};bestDistance=d;}
  };
  consider('origin',origin,{x:width/2,y:originY});
  // Nodes are ordered vertically. Only nearby anchors enter hit testing.
  for(let i=0;i<displays.length;i++){
    if(displays[i].y<y-radius-26)continue;
    if(displays[i].y>y+radius+26)break;
    consider(displays[i].id,buttons.get(displays[i].id),nodePosition(i));
  }
  return best;
}
function scheduleClose(delay=90,reason='away'){
  if(closeReason===reason)return;
  cancelClose();closeReason=reason;closeTimer=setTimeout(()=>{closeReason=null;closePanel(false);},delay);
}
function inPanelPassage(x,y){
  if(panel.hidden||!opener)return false;
  const a=opener.getBoundingClientRect(),r=panel.getBoundingClientRect(),ax=a.x+a.width/2,ay=a.y+a.height/2;
  // A short triangular corridor lets the visitor reach a More link.
  const edge=r.left>ax?r.left:r.right<ax?r.right:null;if(edge===null)return false;
  const fraction=(x-ax)/(edge-ax);if(fraction<0||fraction>1)return false;
  const top=ay+(r.top-ay)*fraction-12,bottom=ay+(r.bottom-ay)*fraction+12;
  return y>=top&&y<=bottom;
}
function trackPointer(e){
  if(e.pointerType==='touch')return;
  lastInput='pointer';
  if(e.target.closest('.section-label,[data-dna-lab]')){cancelHover();cancelClose();setNear(null);return;}
  if(panel.contains(e.target)){cancelHover();cancelClose();setNear(opener);return;}
  const hit=nearestPoint(e.pageX,e.pageY);
  if(suppressedHover&&hit?.id!==suppressedHover)suppressedHover=null;
  if(hit&&hit.id!==suppressedHover){
    cancelClose();setNear(hit.btn);
    if(active===hit.id){interaction='hover';pinned=false;return;}
    if(pendingHover?.id===hit.id)return;
    closePanel(false);setNear(hit.btn);pendingHover=hit;
    hoverTimer=setTimeout(()=>{const next=pendingHover;pendingHover=null;if(next)openPanel(next.id,next.btn,false,'hover');},75);
  }else{
    cancelHover();setNear(null);
    if(active){interaction='hover';pinned=false;scheduleClose(inPanelPassage(e.clientX,e.clientY)?240:90,inPanelPassage(e.clientX,e.clientY)?'passage':'away');}
  }
}
function openPanel(id,btn,pin,source='keyboard'){
  cancelClose();cancelHover();
  if(opener&&opener!==btn)opener.setAttribute('aria-expanded','false');
  active=id;opener=btn;pinned=pin;interaction=source;opener.setAttribute('aria-expanded','true');
  fillPanel(id);panel.hidden=false;positionPanel();
}
function closePanel(restore=false){
  cancelClose();cancelHover();panel.hidden=true;setNear(null);
  const previous=opener;previous?.setAttribute('aria-expanded','false');active=null;pinned=false;opener=null;interaction=null;
  if(restore&&previous){ignoreFocus=true;previous.focus({preventScroll:true});ignoreFocus=false;}
}
function positionPanel(){
  if(panel.hidden||!opener)return;
  const viewport=window.visualViewport,pad=14;
  const availableWidth=viewport?.width||width,availableHeight=viewport?.height||height;
  const vx=viewport?.offsetLeft||0,vy=viewport?.offsetTop||0;
  panel.style.maxHeight=Math.max(100,availableHeight-2*pad)+'px';
  panel.style.maxWidth=Math.max(100,availableWidth-2*pad)+'px';
  const outer=strandAmplitude()+Math.min(width*.035,40);
  let clearRight=width/2+outer+26,clearLeftEdge=width/2-outer-26;
  const r=opener.getBoundingClientRect(),label=opener.querySelector('.node-label');
  const labelLeft=opener.classList.contains('label-left');
  if(labelsShown&&opener!==origin&&label){
    const labelWidth=label.offsetWidth*1.5,anchor=r.left+r.width/2;
    if(labelLeft)clearLeftEdge=Math.min(clearLeftEdge,anchor-14-labelWidth-14);
    else clearRight=Math.max(clearRight,anchor+14+labelWidth+14);
  }
  const rightSpace=vx+availableWidth-pad-clearRight,leftSpace=clearLeftEdge-vx-pad;
  const preferLeft=labelsShown&&opener!==origin&&labelLeft;
  const side=availableWidth>=680?(preferLeft&&leftSpace>=200?'left':rightSpace>=200?'right':leftSpace>=200?'left':null):null;
  panel.style.width=side?Math.min(320,side==='right'?rightSpace:leftSpace)+'px':'';
  const pw=panel.offsetWidth,ph=panel.offsetHeight;
  let left=r.right+14;
  if(left+pw>vx+availableWidth-pad)left=r.left-pw-14;
  if(left<vx+pad)left=vx+(availableWidth-pw)/2;
  // On a wide screen keep the description beside the whole strand,
  // leaving neighbouring nuclei available for the next mouse movement.
  if(side==='right')left=clearRight;
  else if(side==='left')left=clearLeftEdge-pw;
  let top=availableWidth<620?r.bottom+12:r.top-20;
  top=Math.max(vy+pad,Math.min(top,vy+availableHeight-ph-pad));
  panel.style.left=Math.max(vx+pad,Math.min(left,vx+availableWidth-pw-pad))+'px';panel.style.top=top+'px';
}
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function link(text,url,cls){const a=el('a',text,cls);a.href=safeURL(url)||'/index-atlas.html';return a;}
function fillPanel(id){
  body.replaceChildren();panel.scrollTop=0;$('#panel-overline').disabled=id==='origin';
  $('#dna-text-control').hidden=id!=='origin';
  $('[data-dna-text]').checked=labelsShown;
  if(id==='origin'){fillGuide();return;}
  const item=displays.find(p=>p.id===id)||items.find(p=>p.id===id);if(!item)return;
  const kind=KINDS[item.kind];$('#panel-overline').textContent=groupName(item)+(kind?' / '+t(...kind):'');$('#panel-title').textContent=item.title;
  body.append(el('p',item[lang]||item.en||item.sl));
  const a=link('',item.url,'project-cta');a.append(el('span',t('Odpri stran','Open page')),el('span','↗'));body.append(a);
  const related=(item.related||[]).map(x=>items.find(p=>p.id===x)).filter(Boolean);
  if(related.length){const wrap=el('div',undefined,'related');wrap.append(el('span',t('Povezano v verigi','Connected in the strand'),'related-label'));for(const other of related){const b=el('button',other.title);b.type='button';b.addEventListener('click',()=>goTo(other.id));wrap.append(b);}body.append(wrap);}
  body.append(el('span',item.url,'project-path'));
}
function fillGuide(){
  $('#panel-overline').textContent='BD × AI LAB';$('#panel-title').textContent='AI8 DNA';
  body.append(el('p',t('Razišči tematske dele verige ali poišči stran. Oznaka v sredini razloži in osvetli temo; dotik jo vklopi ali izklopi. TOP 8 so bližnjice do projektov v njihovih temah.','Explore the strand by subject or search for a page. A central label explains and highlights its subject; tap to toggle it. TOP 8 offers shortcuts to projects in their own sections.')));
  body.append(el('span',items.length+' '+t('povezav','connections')+' · '+(complete?t('javna zbirka','public collection'):t('izbor projektov','selected projects')),'origin-count'));
  const nav=el('nav',undefined,'guide-links');nav.setAttribute('aria-label',t('Vstopne strani','Entry pages'));nav.append(link('AI8 Codex','/ai8-codex.html'),link('MDL×DCC','/'),link('Atlas','/index-atlas.html'),link('DNA v1','/ai8-dna.html'),link('DNA v2','/ai8-dna-v2.html'),link('DNA v3','/ai8-dna-v3.html'));body.append(nav);
  const sections=el('nav',undefined,'section-index');sections.setAttribute('aria-label',t('Teme','Subjects'));for(const section of SECTIONS){const first=sectionLayer.querySelector(`[data-section="${section.id}"]`);if(!first)continue;const b=el('button',section[lang]);b.type='button';b.addEventListener('click',()=>{closePanel(false);first.scrollIntoView({block:'center'});first.focus({preventScroll:true});selectSection(section.id,true);});sections.append(b);}body.append(sections);
  const label=el('label',t('Poišči točko v verigi','Find a point in the strand'),'search-label');label.htmlFor='dna-search';
  const input=el('input',undefined,'search-input');input.type='search';input.id='dna-search';input.placeholder=t('Projekt, pojem, podstran …','Project, concept, page …');input.autocomplete='off';
  const results=el('ul',undefined,'search-results');results.id='dna-results';results.setAttribute('aria-label',t('Rezultati iskanja','Search results'));input.setAttribute('aria-controls','dna-results');
  input.addEventListener('input',()=>{
    pinned=true;results.replaceChildren();const terms=normalize(input.value).split(/\s+/).filter(Boolean);if(!terms.length){positionPanel();return;}
    const matches=items.filter(p=>terms.every(w=>normalize([p.title,p.sl,p.en,p.url,p.group,p.category,SECTIONS.find(s=>s.id===p.category)?.sl,SECTIONS.find(s=>s.id===p.category)?.en].join(' ')).includes(w))).slice(0,20);
    for(const match of matches){const li=el('li'),b=el('button');b.type='button';b.dataset.record=match.id;b.append(el('span',match.title),el('span',match.url));b.addEventListener('click',()=>goTo(match.id));li.append(b);results.append(li);}
    if(!matches.length)results.append(el('li',t('Ni zadetkov. Poskusi drug izraz.','No matches. Try another term.'),'search-empty'));
    $('#dna-status').textContent=matches.length+' '+t('zadetkov','results');positionPanel();
  });body.append(label,input,results);
  const controls=el('div',undefined,'guide-controls');
  for(const l of ['sl','en']){const b=el('button',l.toUpperCase());b.type='button';b.setAttribute('aria-label',l==='sl'?'Slovenščina':'English');b.setAttribute('aria-pressed',String(lang===l));b.addEventListener('click',()=>{setLang(l);body.querySelector(`[aria-label="${l==='sl'?'Slovenščina':'English'}"]`).focus();});controls.append(b);}
  for(const [label,amount] of [['A−',-.05],['A+',.05]]){const b=el('button',label);b.type='button';b.setAttribute('aria-label',amount<0?t('Manjše besedilo','Smaller text'):t('Večje besedilo','Larger text'));b.addEventListener('click',()=>{scale=Math.max(.8,Math.min(1.5,Math.round((scale+amount)*100)/100));root.style.setProperty('--scale',scale);save('mdlxdcc-font',scale);positionPanel();positionSectionNote();});controls.append(b);}
  const motion=el('button',paused||reduced.matches?t('Mirovanje','Still'):t('Žarenje','Glow'),'motion');motion.type='button';motion.setAttribute('aria-pressed',String(paused||reduced.matches));motion.disabled=reduced.matches;motion.addEventListener('click',()=>{paused=!paused;save('ai8-dna-current-paused',paused);applyMotion();motion.textContent=paused?t('Mirovanje','Still'):t('Žarenje','Glow');motion.setAttribute('aria-pressed',String(paused));});controls.append(motion);body.append(controls);
}
function goTo(id){
  const instance=displays.find(p=>p.projectId===id&&p.section!=='top')||displays.find(p=>p.id===id);
  const btn=buttons.get(instance?.id);if(!btn)return;
  id=instance.id;
  closePanel(false);btn.scrollIntoView({behavior:'instant',block:'center'});ignoreFocus=true;btn.focus({preventScroll:true});ignoreFocus=false;openPanel(id,btn,true,lastInput==='touch'?'touch':'keyboard');$('#panel-close').focus({preventScroll:true});
}
function applyMotion(){root.classList.toggle('paused',paused||reduced.matches);}
bindNode(origin,'origin');observer.observe(origin);
panel.addEventListener('pointerenter',cancelClose);
panel.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch')trackPointer(e);});
panel.addEventListener('focusin',()=>{pinned=true;cancelClose();});
$('#panel-close').addEventListener('click',()=>{suppressedHover=active;closePanel(true);});
$('#panel-overline').addEventListener('click',()=>{openPanel('origin',opener||origin,true,lastInput==='touch'?'touch':'keyboard');$('#dna-search').focus({preventScroll:true});});
document.addEventListener('keydown',e=>{
  lastInput='keyboard';
  if(e.key==='Escape'&&selectedSection){selectSection(null);}
  if(e.key==='Escape'&&!panel.hidden){e.preventDefault();suppressedHover=active;closePanel(true);}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPanel('origin',origin,true,'keyboard');$('#dna-search').focus();}
},true);
document.addEventListener('pointermove',trackPointer,{passive:true});
document.addEventListener('pointerdown',e=>{lastInput=e.pointerType==='touch'?'touch':'pointer';},true);
document.addEventListener('click',e=>{
  if(e.composedPath().includes(panel)||e.target.closest('a,.section-label,.section-note,[data-dna-lab]'))return;
  if(selectedSection)selectSection(null);
  const target=e.target.closest('.dna-node');
  const hit=e.detail===0&&target?{id:target===origin?'origin':target.dataset.project,btn:target}:nearestPoint(e.pageX,e.pageY,lastInput==='touch'?28:36);
  if(!hit){closePanel(false);return;}
  e.preventDefault();suppressedHover=null;
  const source=lastInput==='touch'?'touch':e.detail===0?'keyboard':'pointer';
  if(hit.id==='origin'){location.assign('/index.html');return;}
  // Mouse and keyboard open the same destination as the popup link.
  // Touch keeps a first-tap preview; tapping that point again opens its page.
  if(source!=='touch'||active===hit.id){
    const item=displays.find(item=>item.id===hit.id),url=safeURL(item?.url);
    if(url)location.assign(url);
    return;
  }
  openPanel(hit.id,hit.btn,true,source);
  if(source!=='pointer')$('#panel-close').focus({preventScroll:true});
});
document.addEventListener('focusin',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!e.target.closest('.dna-node'))closePanel(false);});
document.documentElement.addEventListener('pointerleave',()=>{cancelHover();if(interaction==='hover'||interaction==='pointer')closePanel(false);});
window.addEventListener('blur',()=>{if(interaction==='hover'||interaction==='pointer')closePanel(false);});
window.addEventListener('scroll',()=>{scheduleDraw();positionSectionNote();cancelHover();if(active){const r=opener.getBoundingClientRect();if(interaction==='hover'||interaction==='pointer'||r.bottom<0||r.top>height)closePanel(false);else positionPanel();}},{passive:true});
window.addEventListener('resize',()=>{
  const nextWidth=document.documentElement.clientWidth;height=innerHeight;
  if(nextWidth!==width){width=nextWidth;renderNodes();}
  viewportChanged();
});
function viewportChanged(){scheduleDraw();positionPanel();positionSectionNote();}
window.visualViewport?.addEventListener('resize',viewportChanged);
window.visualViewport?.addEventListener('scroll',viewportChanged);
reduced.addEventListener('change',()=>{applyMotion();const motion=body.querySelector('.motion');if(motion){motion.disabled=reduced.matches;motion.textContent=paused||reduced.matches?t('Mirovanje','Still'):t('Žarenje','Glow');motion.setAttribute('aria-pressed',String(paused||reduced.matches));}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)root.classList.add('paused');else applyMotion();});
setLang(lang,!!queryLang);applyMotion();renderNodes();
loadCatalogue().then(result=>{
  items=classify(decorateDNA(result.items,{includeLive:true}));complete=result.complete;renderNodes();
  if(active==='origin'){
    const count=body.querySelector('.origin-count');
    if(count)count.textContent=items.length+' '+t('povezav','connections')+' · '+(complete?t('javna zbirka','public collection'):t('izbor projektov','selected projects'));
    const search=$('#dna-search');if(search?.value)search.dispatchEvent(new Event('input',{bubbles:true}));
    positionPanel();
  }
}).catch(()=>{});
