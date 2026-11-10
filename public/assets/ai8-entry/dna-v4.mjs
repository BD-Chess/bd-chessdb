import {CURATED, GROUPS, loadCatalogue} from './featured-catalog.mjs';
import {textEnabled} from './text-setting.mjs';
import {decorateDNA} from './dna-top-points.mjs?v=20261108-top3';
import {SECTIONS, classify, buildStrand, workLabel, LOOP_HEIGHT, FIRST_Y, FIRST_CROSS} from './dna-sections.mjs?v=20261110-works';

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
let strand=buildStrand(items), displays=[], selectedLoop=null, sectionPinned=false, sectionOpener=null;
const sectionNotes=new Map();
const sectionLayer=nodes;
function orderControls(){for(const control of [...nodes.children].sort((a,b)=>parseFloat(a.style.top)-parseFloat(b.style.top)))nodes.append(control);}
function viewport(){
  const v=window.visualViewport;
  return {left:v?.pageLeft??scrollX,top:v?.pageTop??scrollY,width:v?.width||width,height:v?.height||height,scale:v?.scale||1};
}
function positionSectionNote(){
  const note=sectionNotes.get(sectionOpener);if(!note||note.hidden)return;
  const loop=strand.loops.find(loop=>loop.id===selectedLoop);if(!loop)return;
  const v=viewport(),pad=14/v.scale,gap=12/v.scale,x=parseFloat(sectionOpener.style.left);
  const topEdge=v.top+pad,bottomEdge=v.top+v.height-pad;
  note.style.width=Math.min(260,v.width-pad*2)+'px';note.style.maxHeight=Math.max(1,v.height-pad*2)+'px';
  const above=Math.max(0,loop.start-gap-topEdge),below=Math.max(0,bottomEdge-loop.end-gap);
  // Stay beyond this physical ellipse, leaving all its highlighted page labels
  // clear. If one side is tight, flip; a short viewport gets a scrollable note.
  const placement=note.offsetHeight<=below?'below':note.offsetHeight<=above?'above':below>=above?'below':'above';
  const room=placement==='below'?below:above;
  note.style.visibility=loop.end<=v.top||loop.start>=v.top+v.height||room<32?'hidden':'';
  note.style.maxHeight=room+'px';note.dataset.placement=placement;
  const w=note.offsetWidth,h=note.offsetHeight,left=x-w/2,top=placement==='below'?loop.end+gap:loop.start-gap-h;
  note.style.left=Math.max(v.left+pad,Math.min(left,v.left+v.width-w-pad))+'px';
  note.style.top=top+'px';
}
function selectLoop(id,pin=false,button=sectionOpener){
  selectedLoop=id;sectionPinned=pin;sectionOpener=id?button:null;
  main.classList.toggle('section-selected',!!id);
  for(const btn of buttons.values())btn.classList.toggle('section-active',btn.dataset.loop===id);
  for(const btn of sectionLayer.querySelectorAll('.section-label')){
    const selected=btn.dataset.loop===id,expanded=selected&&btn===sectionOpener;
    btn.classList.toggle('section-active',selected);btn.setAttribute('aria-expanded',String(expanded));btn.setAttribute('aria-pressed',String(selected&&pin));
    sectionNotes.get(btn).hidden=!expanded;
  }
  positionSectionNote();scheduleDraw();
}
function renderSections(){
  const previous=sectionOpener?.dataset.loop;
  for(const label of sectionLayer.querySelectorAll('.section-label'))label.remove();
  for(const note of sectionNotes.values())note.remove();sectionNotes.clear();sectionOpener=null;plates=[];
  for(const [i,loop] of strand.loops.entries()){
    if(!loop.label)continue;
    const section=SECTIONS.find(s=>s.id===loop.section),btn=el('button',undefined,'section-label');
    btn.type='button';btn.dataset.section=section.id;btn.dataset.loop=loop.id;btn.style.top=loop.centre+'px';
    btn.style.left=geometry(loop.centre).centre+'px';btn.style.width=Math.max(94,Math.min(156,strandAmplitude()*2-44))+'px';
    const title=width<1100&&section.id==='cfh'?t('CFH / Zavest','CFH'):width<600&&section.id==='lab'?'LAB':width<600&&section.id==='apps'?'APPS':section[lang];
    btn.append(el('span',title),el('small',worksText(loop.count)+(loop.total>1?' · '+loop.part+'/'+loop.total:'')));
    btn.setAttribute('aria-controls','section-note-'+i);btn.setAttribute('aria-describedby','section-note-'+i);btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-pressed','false');
    const note=el('div',undefined,'section-note');note.id='section-note-'+i;note.hidden=true;note.setAttribute('role','tooltip');
    note.append(el('strong',section.name[lang]),el('span',section.description[lang]));
    if(loop.pages>loop.count)note.append(el('span',t(worksText(loop.count)+', '+pagesText(loop.pages)+': različice istega dela si delijo točko.',worksText(loop.count)+', '+pagesText(loop.pages)+': versions of one work share a point.'),'section-count'));
    document.body.append(note);sectionNotes.set(btn,note);btn.setAttribute('aria-label',section.name[lang]+' · '+worksText(loop.count)+(loop.total>1?' · '+loop.part+'/'+loop.total:''));
    btn.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch'&&!sectionPinned){closePanel(false);selectLoop(loop.id,false,btn);}});
    btn.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch'&&!sectionPinned&&document.activeElement!==btn)selectLoop(null);});
    btn.addEventListener('focus',()=>{if(lastInput==='keyboard'){closePanel(false);selectLoop(loop.id,false,btn);}});
    btn.addEventListener('keydown',e=>arrowNavigate(e,btn));
    btn.addEventListener('blur',()=>{if(!sectionPinned)selectLoop(null);});
    btn.addEventListener('click',e=>{e.stopPropagation();closePanel(false);const off=sectionPinned&&selectedLoop===loop.id;selectLoop(off?null:loop.id,!off,btn);});
    sectionLayer.append(btn);plates.push({node:btn,y:loop.centre});
    if(previous===loop.id)sectionOpener=btn;
  }
  orderControls();selectLoop(selectedLoop,sectionPinned,sectionOpener);renderRail();
}
const t = (sl,en) => lang === 'sl' ? sl : en;
const touchFirst=matchMedia('(hover: none)').matches, langButtons=[...document.querySelectorAll('#dna-lang button')];
const worksText=n=>n+' '+t(n%100===1?'delo':n%100===2?'deli':n%100===3||n%100===4?'dela':'del',n===1?'work':'works');
const pagesText=n=>n+' '+t(n%100===1?'stran':'strani',n===1?'page':'pages');
const KINDS={archive:['Arhiv','Archive'],tool:['Orodje','Tool'],game:['Igra','Game'],research:['Raziskava','Research'],gallery:['Galerija','Gallery'],story:['Zgodba','Story'],essay:['Esej','Essay'],concept:['Zamisel','Concept'],collection:['Zbirka','Collection'],dialogue:['Pogovor','Dialogue'],portrait:['Portret','Portrait'],entrance:['Vstop','Entrance'],page:['Podstran','Page']};
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
  $('#dna-instructions').textContent=t('Približaj se točki za opis. Klik ali Enter odpre stran. Klik na vrhnjo točko vrne na glavno stran. Na dotik prvi dotik odpre opis, drugi stran. Iskanje in nastavitve odpre oznaka nad opisom ali Ctrl+K. Escape zapre opis. Veriga se riše sproti med pomikanjem; gumb »Pokaži celo verigo« jo nariše v celoti.','Approach a point for its description. Click or Enter opens the page. The top point returns home. On touch, tap once for the description and again to open the page. Use the label above a description or Ctrl+K for search and settings. Escape closes the description. The strand is drawn as you scroll; “Show the whole strand” draws all of it.');
  hint.textContent=t('Vse delo BD × AI Lab na eni verigi. ','All the work of BD × AI Lab on one strand. ')+(touchFirst?t('Dotik točke pokaže opis, drugi dotik odpre stran. ','Tap a point for its description, tap again to open the page. '):t('Približaj se točki za opis, klik odpre stran. ','Move close to a point for its description; a click opens the page. '))+t('Pomikaj se navzdol: veriga se riše sproti.','Scroll down and the strand draws itself as you go.');
  more.textContent=t('Pokaži celo verigo','Show the whole strand');$('.skip').textContent=t('Preskoči na verigo AI8 DNA','Skip to the AI8 DNA strand');
  for(const b of langButtons)b.setAttribute('aria-pressed',String(b.dataset.lang===lang));
  $('#panel-close').setAttribute('aria-label',t('Zapri','Close'));$('#panel-overline').setAttribute('aria-label',t('AI8 DNA · iskanje in nastavitve','AI8 DNA · search and settings'));$('#panel-overline').title=t('AI8 DNA · iskanje in nastavitve','AI8 DNA · search and settings');
  if(sectionLayer.querySelector('.section-label')){renderSections();applyReveal(true);}
  for(const item of displays){buttons.get(item.id)?.setAttribute('aria-label',workLabel(item)+' · '+groupName(item)+(item.featured?' · '+t('Izbrani projekt','Featured project'):'')+(item.dnaTop?' · '+t('BD izbor','BD selection'):''));}
  if(active){fillPanel(active);positionPanel();}
}

// Nuclei stay anchored; only their visual size and their labels grow.
const strandAmplitude=()=>Math.min(158,width*(width>=680&&width<1100?.12:.20));
// On a phone a name keeps its full width (two lines) instead of growing.
const nearZoom=()=>width<600?1:1.5;
function geometry(y,side=0) {
  const amplitude=strandAmplitude(),theta=(y-firstY)*Math.PI*2/460+.62;
  const centre=width/2+Math.sin((y-firstY)/1000)*Math.min(width*.035,40);
  const sign=side===0?1:-1;
  return {x:centre+sign*Math.cos(theta)*amplitude,y,z:sign*Math.sin(theta),centre,amplitude};
}
function nodePosition(i){const d=displays[i];return geometry(d.y,d.side);}
function segmentAlpha(y){
  if(!selectedLoop)return 1;
  const loop=strand.loops[y<FIRST_CROSS?0:1+Math.floor((y-FIRST_CROSS)/LOOP_HEIGHT)];
  return loop?.id===selectedLoop?1.5:.55;
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
  const end=strand.end, start=Math.max(firstY-42,top-40), finish=Math.min(end,revealed,bottom+40);
  if(top<firstY){for(let side=0;side<2;side++){const p=geometry(firstY-42,side);ctx.beginPath();ctx.moveTo(width/2,originY);ctx.bezierCurveTo(width/2,originY+32,p.x,firstY-70,p.x,p.y);ctx.strokeStyle=side?'#b5b28b7a':'#9cd7ca8a';ctx.lineWidth=1.2;ctx.stroke();}}
  // Rungs and their small nucleotide beads remain subordinate to the two backbones.
  for(let y=Math.ceil(start/14)*14;y<finish;y+=14){
    ctx.globalAlpha=fog(y);
    const a=geometry(y,0),b=geometry(y,1),fade=(.16+.16*Math.abs(a.z))*segmentAlpha(y);
    const grad=ctx.createLinearGradient(a.x,y,b.x+0.1,y);grad.addColorStop(0,`rgba(143,211,197,${fade})`);grad.addColorStop(.5,`rgba(147,178,182,${fade*.6})`);grad.addColorStop(1,`rgba(208,194,147,${fade})`);
    ctx.strokeStyle=grad;ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(a.x,y);ctx.bezierCurveTo(a.centre,y+8*a.z,a.centre,y-8*a.z,b.x,y);ctx.stroke();
    if(Math.abs(a.x-b.x)>60){for(let j=1;j<5;j++){const f=j/5;ctx.beginPath();ctx.arc(a.x+(b.x-a.x)*f,y+Math.sin(f*Math.PI*2)*a.z*3,1.05,0,Math.PI*2);ctx.fillStyle=`rgba(177,201,193,${fade*.65})`;ctx.fill();}}
  }
  // Fine layered filaments give depth without a large animated or raster asset.
  for(let side=0;side<2;side++){
    for(let y=start;y<finish;y+=5){
      ctx.globalAlpha=fog(y);
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
  ctx.globalAlpha=1;
}

// The strand is drawn as far as the visitor has travelled. Its end thins into
// fog just above the bottom of the window and keeps drawing as the visitor
// moves down, so the page never opens as one very long column. Search, the
// list of parts, the keyboard and "show the whole strand" draw as far as they
// need at once.
const FOG=190, POSITION='ai8-dna-v4-position';
// The native display scene (?mode=ai8-live) is managed elsewhere: it keeps the
// whole strand and gets no caption, button or list of parts.
const native=root.dataset.dnaNative==='true';
let revealed=0, revealTarget=0, revealFrame=0, whole=native, shown=0, misty=0, plates=[], hintSeen=false;
const hint=$('#dna-hint'), more=$('#dna-more'), rail=$('#dna-rail'), dock=$('#dna-dock');
// The fog ends above the caption and the button at the bottom of the window.
const dockRoom=()=>dock.offsetHeight+18;
const finished=()=>revealed>=strand.end-1;
const fog=y=>{if(finished())return 1;const f=Math.max(0,Math.min(1,(revealed-y)/FOG));return f*f*(3-2*f);};
function setFog(node,y){const a=fog(y);if(a<.995)node.style.setProperty('--fog',a.toFixed(2));else node.style.removeProperty('--fog');}
function applyReveal(full=false){
  const done=finished(),edge=done?Infinity:revealed-22;
  // The page is as long as the strand asked for so far, plus one more window
  // to move into (a whole Page Down), in steps so it is not laid out every frame.
  main.style.height=(done?Math.max(height,strand.end+100):Math.ceil((revealTarget+dockRoom()+height)/240)*240)+'px';
  if(full)shown=misty=0;
  // Points are ordered by height: show the ones the drawing has passed …
  for(;shown<displays.length&&displays[shown].y<=edge;shown++)buttons.get(displays[shown].id).hidden=false;
  if(full)for(let i=shown;i<displays.length;i++)buttons.get(displays[i].id).hidden=true;
  // … and thin the ones that are still inside the fog.
  for(let i=misty;i<shown;i++)setFog(buttons.get(displays[i].id),displays[i].y);
  while(misty<shown&&(done||displays[misty].y<=revealed-FOG))misty++;
  for(const plate of plates){const waiting=!done&&plate.y>revealed-40;if(plate.node.hidden!==waiting)plate.node.hidden=waiting;if(!waiting)setFog(plate.node,plate.y);}
  more.hidden=done;updateRail();scheduleDraw();
}
function animateReveal(){
  if(revealFrame)return;
  let last=performance.now();
  const step=now=>{
    const elapsed=Math.min(64,now-last),gap=revealTarget-revealed;last=now;
    // A steady pen, quicker when the visitor is far ahead of it.
    revealed=Math.min(revealTarget,revealed+elapsed*Math.max(.55,gap/260));
    applyReveal();revealFrame=revealed<revealTarget?requestAnimationFrame(step):0;
  };
  revealFrame=requestAnimationFrame(step);
}
function revealThrough(y,instant=false){
  let stop=Math.min(strand.end,y);if(strand.end-stop<FOG*.6)stop=strand.end;
  const further=stop>revealTarget;if(further)revealTarget=stop;
  if(instant||reduced.matches){if(revealed<revealTarget){revealed=revealTarget;applyReveal();}}
  else if(further){applyReveal();animateReveal();}
}
function ensureReveal(instant=false){const v=viewport();revealThrough(v.top+v.height-dockRoom(),instant);}
function syncReveal(){
  // After a render: keep what is drawn and fill the first view.
  revealTarget=whole?strand.end:Math.min(strand.end,revealTarget);revealed=whole?strand.end:Math.min(revealed,revealTarget);
  applyReveal(true);ensureReveal(true);
}
more.addEventListener('click',()=>{whole=true;revealThrough(strand.end,true);});
nodes.addEventListener('focusin',e=>{const y=parseFloat(e.target.style?.top);if(y)revealThrough(y+LOOP_HEIGHT);});
// The caption belongs to the first view; once the visitor has moved on it stays away.
function updateHint(){if(scrollY>200)hintSeen=true;if(hint.hidden!==hintSeen){hint.hidden=hintSeen;ensureReveal();}}
// The parts of the strand, listed beside it on a wide window: what lies ahead,
// where the visitor is, and a way to jump.
function jumpToSection(id){
  const target=sectionLayer.querySelector(`.section-label[data-section="${id}"]`);if(!target)return;
  closePanel(false);revealThrough(parseFloat(target.style.top)+height,true);
  target.scrollIntoView({block:'center'});target.focus({preventScroll:true});selectLoop(target.dataset.loop,true,target);
}
function renderRail(){
  rail.replaceChildren();rail.setAttribute('aria-label',t('Deli verige','Parts of the strand'));
  for(const section of SECTIONS){
    const loop=strand.loops.find(l=>l.label&&l.section===section.id);if(!loop)continue;
    const b=el('button',undefined,'rail-item');b.type='button';b.dataset.section=section.id;b.dataset.y=loop.centre;
    b.append(el('span',section[lang]),el('small',String(loop.count)));b.setAttribute('aria-label',section.name[lang]+' · '+worksText(loop.count));
    b.addEventListener('click',()=>jumpToSection(section.id));rail.append(b);
  }
  // Left of the longest name the strand can show; a narrow window has no room.
  rail.hidden=native||width<1200;
  if(!rail.hidden)rail.style.left=Math.max(14,width/2-840-rail.offsetWidth)+'px';
  updateRail();
}
const railEdge=()=>rail.hidden?0:rail.getBoundingClientRect().right+12;
function updateRail(){
  if(rail.hidden)return;
  // The part in the middle of the window; at the very top that is the opening.
  const v=viewport(),y=v.top<120?0:v.top+v.height/2,here=strand.loops[y<FIRST_CROSS?0:Math.min(strand.loops.length-1,1+Math.floor((y-FIRST_CROSS)/LOOP_HEIGHT))]?.section;
  for(const b of rail.children){
    b.classList.toggle('is-drawn',finished()||Number(b.dataset.y)<=revealed);
    if(b.dataset.section===here)b.setAttribute('aria-current','true');else b.removeAttribute('aria-current');
  }
}
const observer=new IntersectionObserver(entries=>{for(const e of entries)e.target.classList.toggle('is-visible',e.isIntersecting);},{rootMargin:'50px'});
function renderNodes(){
  strand=buildStrand(items);
  displays=strand.instances.map(d=>({...d.project,id:d.id,projectId:d.project.id,section:d.section,loopId:d.loopId,y:d.y,side:d.side,update:d.update,variants:d.variants||[]}));
  // A page that became a version of another work no longer has a point of its own.
  const live=new Set(displays.map(d=>d.id));
  for(const [id,btn] of buttons)if(!live.has(id)){if(opener===btn)closePanel(false);if(nearNode===btn)setNear(null);observer.unobserve(btn);btn.remove();buttons.delete(id);}
  renderSections();
  const zoom=nearZoom(),widest=width>=1900?400:width>=1300?300:220,keep=railEdge();
  main.style.setProperty('--near-zoom',zoom);main.classList.toggle('compact',width<600);
  displays.forEach((item,i)=>{
    let btn=buttons.get(item.id);
    if(!btn){
      btn=document.createElement('button');btn.type='button';btn.className='dna-node'+(item.featured?' featured':'');btn.dataset.project=item.id;btn.dataset.record=item.projectId;btn.dataset.section=item.section;btn.id='node-'+item.id.replace(':','-');
      btn.setAttribute('aria-controls','dna-panel');btn.setAttribute('aria-expanded','false');btn.innerHTML='<span class="nucleus" aria-hidden="true"></span><span class="node-label" aria-hidden="true"></span>';btn.querySelector('.node-label').textContent=workLabel(item);
      btn.style.setProperty('--node',GROUPS[item.group]?.color||palette[i%palette.length]);btn.style.setProperty('--delay',(-(i*3.73)%13)+'s');
      bindNode(btn,item.id);buttons.set(item.id,btn);nodes.append(btn);observer.observe(btn);
    }
    // Existing buttons can move to another physical loop after catalogue load.
    btn.dataset.loop=item.loopId;
    btn.classList.toggle('dna-top',!!item.dnaTop);
    btn.querySelector('.node-label').textContent=item.dnaLabel||workLabel(item);
    btn.setAttribute('aria-label',workLabel(item)+' · '+groupName(item)+(item.featured?' · '+t('Izbrani projekt','Featured project'):'')+(item.dnaTop?' · '+t('BD izbor','BD selection'):''));
    nodes.append(btn);
    const p=nodePosition(i);btn.style.left=p.x+'px';btn.style.top=p.y+'px';
    const left=p.x<p.centre;btn.classList.toggle('label-left',left);btn.style.setProperty('--label-width',Math.max(12,Math.min(widest,(left?p.x-26:width-p.x-26)/zoom,left&&keep?p.x-26-keep:Infinity))+'px');
  });
  origin.style.left=width/2+'px';origin.style.top=originY+'px';
  orderControls();selectLoop(selectedLoop,sectionPinned);syncReveal();
}
function arrowNavigate(e,btn){
  if(e.key!=='ArrowDown'&&e.key!=='ArrowUp')return;
  e.preventDefault();const list=[...nodes.children],step=e.key==='ArrowDown'?1:-1;let i=list.indexOf(btn)+step;
  if(step>0&&list[i]?.hidden)revealThrough(parseFloat(list[i].style.top)+LOOP_HEIGHT,true);
  while(list[i]?.hidden)i+=step;list[i]?.focus();
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
  // A long name on the left may grow across the list of parts: let it through.
  const label=btn&&btn!==origin&&!rail.hidden&&btn.classList.contains('label-left')?btn.querySelector('.node-label'):null;
  rail.classList.toggle('yield',!!label&&parseFloat(btn.style.left)-14-label.offsetWidth*nearZoom()<railEdge());
}
// Resolve nearby nuclei and visible labels independently of overlapping buttons.
// Read unscaled label dimensions so enlargement cannot make the selection jump.
function nearestPoint(x,y,radius=36){
  let best=null,bestDistance=radius;
  const consider=(id,btn,p)=>{
    let d=Math.hypot(p.x-x,p.y-y);
    const label=btn.querySelector('.node-label');
    if(labelsShown&&label){
      const isOrigin=id==='origin', zoom=btn===nearNode?nearZoom():1;
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
    const candidate=buttons.get(displays[i].id);if(candidate.hidden)continue;
    consider(displays[i].id,candidate,nodePosition(i));
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
  if(e.target.closest('.section-label,.section-note,[data-dna-lab],[data-dna-ui]')){cancelHover();cancelClose();setNear(null);return;}
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
    const labelWidth=label.offsetWidth*nearZoom(),anchor=r.left+r.width/2;
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
  const kind=KINDS[item.kind];$('#panel-overline').textContent=groupName(item)+(kind?' / '+t(...kind):'');$('#panel-title').textContent=workLabel(item);
  body.append(el('p',item[lang]||item.en||item.sl));
  if(item.update){
    const update=el('div',undefined,'project-update'),date=el('time',item.update.date);date.dateTime=item.update.date;
    update.append(el('span',item.update.type==='featured'?t('Predstavljeno na Start · ','Featured on Start · '):t('Objavljena novost · ','Update announced · ')),date,link(t('Vir obvestila ↗','Source announcement ↗'),item.update.source));body.append(update);
  }
  const a=link('',item.url,'project-cta');a.append(el('span',t('Odpri stran','Open page')),el('span','↗'));body.append(a);
  if(item.variants?.length){const wrap=el('div',undefined,'variants');wrap.append(el('span',t('Druge različice in kopije','Other versions and copies')+' ('+item.variants.length+')','related-label'));const list=el('ul');for(const v of item.variants){const li=el('li');li.append(link(v.url,v.url));list.append(li);}wrap.append(list);body.append(wrap);}
  const related=(item.related||[]).map(x=>items.find(p=>p.id===x)).filter(Boolean);
  if(related.length){const wrap=el('div',undefined,'related');wrap.append(el('span',t('Povezano v verigi','Connected in the strand'),'related-label'));for(const other of related){const b=el('button',other.title);b.type='button';b.addEventListener('click',()=>goTo(other.id));wrap.append(b);}body.append(wrap);}
  body.append(el('span',item.url,'project-path'));
}
// Points are works; the catalogue also counts every version and copy.
function countText(){
  const works=displays.filter(d=>!['top','new'].includes(d.section)).length;
  return (works===items.length?worksText(works):worksText(works)+' · '+pagesText(items.length))+' · '+(complete?t('javna zbirka','public collection'):t('izbor projektov','selected projects'));
}
function fillGuide(){
  $('#panel-overline').textContent='BD × AI LAB';$('#panel-title').textContent='AI8 DNA';
  body.append(el('p',t('Razišči tematske dele verige ali poišči stran. Oznaka v sredini razloži temo in osvetli le svojo zanko s točkami na njej; dotik jo vklopi ali izklopi. TOP 8 so bližnjice do izbranih projektov. NOVO prinaša kratek uredniški izbor nedavnih novosti z datumi objave ali predstavitve.','Explore the strand by subject or search for a page. A central label explains its subject and highlights only its own ellipse and the points on it; tap to toggle it. TOP 8 offers featured shortcuts. NEW is a short editorial selection of recent highlights, dated by their announcement or feature.')));
  body.append(el('span',countText(),'origin-count'));
  const nav=el('nav',undefined,'guide-links');nav.setAttribute('aria-label',t('Vstopne strani','Entry pages'));nav.append(link('AI8 Codex','/ai8-codex.html'),link('MDL×DCC','/'),link('Atlas','/index-atlas.html'),link('DNA v1','/ai8-dna.html'),link('DNA v2','/ai8-dna-v2.html'),link('DNA v3','/ai8-dna-v3.html'));body.append(nav);
  const sections=el('nav',undefined,'section-index');sections.setAttribute('aria-label',t('Teme','Subjects'));for(const section of SECTIONS){const first=sectionLayer.querySelector(`.section-label[data-section="${section.id}"]`);if(!first)continue;const b=el('button',section[lang]);b.type='button';b.addEventListener('click',()=>jumpToSection(section.id));sections.append(b);}body.append(sections);
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
  // The work's own point first, also when the page is one of its versions; a shortcut last.
  const own=p=>!['top','new'].includes(p.section);
  const instance=displays.find(p=>own(p)&&p.projectId===id)||displays.find(p=>own(p)&&p.variants.some(v=>v.id===id))||displays.find(p=>p.projectId===id||p.id===id);
  const btn=buttons.get(instance?.id);if(!btn)return;
  id=instance.id;
  closePanel(false);revealThrough(instance.y+height,true);btn.scrollIntoView({behavior:'instant',block:'center'});ignoreFocus=true;btn.focus({preventScroll:true});ignoreFocus=false;openPanel(id,btn,true,lastInput==='touch'?'touch':'keyboard');$('#panel-close').focus({preventScroll:true});
}
// The AI Lab asks where a record is: answer with its point and draw the strand
// that far. A page that is a version of another work is answered with that work.
document.addEventListener('ai8-dna:locate',e=>{
  const id=e.detail?.record,instance=displays.find(p=>p.projectId===id)||displays.find(p=>p.variants.some(v=>v.id===id));
  if(!instance)return;
  revealThrough(instance.y+height,true);e.detail.node=buttons.get(instance.id);
});
function applyMotion(){root.classList.toggle('paused',paused||reduced.matches);}
bindNode(origin,'origin');observer.observe(origin);
panel.addEventListener('pointerenter',cancelClose);
panel.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch')trackPointer(e);});
panel.addEventListener('focusin',()=>{pinned=true;cancelClose();});
$('#panel-close').addEventListener('click',()=>{suppressedHover=active;closePanel(true);});
$('#panel-overline').addEventListener('click',()=>{openPanel('origin',opener||origin,true,lastInput==='touch'?'touch':'keyboard');$('#dna-search').focus({preventScroll:true});});
document.addEventListener('keydown',e=>{
  lastInput='keyboard';
  if(e.key==='End'&&!e.target.closest?.('input,textarea,select')){whole=true;revealThrough(strand.end,true);}
  if(e.key==='Escape'&&selectedLoop){selectLoop(null);}
  if(e.key==='Escape'&&!panel.hidden){e.preventDefault();suppressedHover=active;closePanel(true);}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPanel('origin',origin,true,'keyboard');$('#dna-search').focus();}
},true);
document.addEventListener('pointermove',trackPointer,{passive:true});
document.addEventListener('pointerdown',e=>{lastInput=e.pointerType==='touch'?'touch':'pointer';},true);
document.addEventListener('click',e=>{
  if(e.target.closest('[data-dna-lab]')){if(selectedLoop)selectLoop(null);closePanel(false);return;}
  if(e.composedPath().includes(panel)||e.target.closest('a,.section-label,.section-note,[data-dna-ui]'))return;
  if(selectedLoop)selectLoop(null);
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
window.addEventListener('scroll',()=>{ensureReveal();updateHint();updateRail();scheduleDraw();positionSectionNote();cancelHover();if(active){const r=opener.getBoundingClientRect();if(interaction==='hover'||interaction==='pointer'||r.bottom<0||r.top>height)closePanel(false);else positionPanel();}},{passive:true});
window.addEventListener('resize',()=>{
  const nextWidth=document.documentElement.clientWidth;height=innerHeight;
  if(nextWidth!==width){width=nextWidth;renderNodes();}
  viewportChanged();
});
function viewportChanged(){ensureReveal();updateRail();scheduleDraw();positionPanel();positionSectionNote();}
window.visualViewport?.addEventListener('resize',viewportChanged);
window.visualViewport?.addEventListener('scroll',viewportChanged);
reduced.addEventListener('change',()=>{applyMotion();const motion=body.querySelector('.motion');if(motion){motion.disabled=reduced.matches;motion.textContent=paused||reduced.matches?t('Mirovanje','Still'):t('Žarenje','Glow');motion.setAttribute('aria-pressed',String(paused||reduced.matches));}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)root.classList.add('paused');else applyMotion();});
for(const b of langButtons)b.addEventListener('click',()=>setLang(b.dataset.lang));
try{history.scrollRestoration='manual';}catch{}
addEventListener('pagehide',()=>{try{sessionStorage.setItem(POSITION,JSON.stringify({y:Math.round(scrollY),revealed:Math.round(revealTarget),whole}));}catch{}});
// Coming back from a work, or reloading, returns to the same place on the strand.
function restorePosition(){
  const kind=performance.getEntriesByType?.('navigation')[0]?.type;if(kind!=='back_forward'&&kind!=='reload')return;
  let saved=null;try{saved=JSON.parse(sessionStorage.getItem(POSITION)||'null');}catch{}
  if(!saved||!(saved.y>0))return;
  if(saved.whole)whole=true;
  revealThrough(whole?strand.end:Math.max(Number(saved.revealed)||0,saved.y+height),true);scrollTo(0,saved.y);
}
hint.hidden=false;setLang(lang,!!queryLang);applyMotion();renderNodes();
loadCatalogue().then(result=>{
  items=classify(decorateDNA(result.items,{includeLive:true}));complete=result.complete;renderNodes();restorePosition();
  if(active==='origin'){
    const count=body.querySelector('.origin-count');
    if(count)count.textContent=countText();
    const search=$('#dna-search');if(search?.value)search.dispatchEvent(new Event('input',{bubbles:true}));
    positionPanel();
  }
}).catch(()=>{});
