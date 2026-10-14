/* Source-bound L/P artwork; only opted-in figures participate. Inline HD, viewer always 4K. */
(()=>{
 'use strict';
 const images=[...document.querySelectorAll('img[data-nara-responsive]')];
 if(!images.length)return;
 const slots=['L_HD','P_HD','L_4K','P_4K'],models=new Map(),inlineTokens=new WeakMap(),inlineLoads=new WeakMap();
 for(const image of images){
  try{
   const variants=JSON.parse(image.dataset.naraVariants);
   if(!slots.every(key=>variants[key]?.src&&variants[key].width>0&&variants[key].height>0))continue;
   models.set(image,{image,variants,story:image.dataset.naraStory,moment:image.dataset.naraMoment});
  }catch{}
 }
 if(!models.size)return;
 const orientationQuery=window.matchMedia?.('(orientation: portrait)');
 // Same viewport-media -> screen.orientation -> viewport fallback as the gallery.
 // Apply it on desktop too so resizing a reading window selects its real composition.
 const orientation=()=>orientationQuery?orientationQuery.matches?'P':'L':window.screen?.orientation?.type?
  window.screen.orientation.type.startsWith('portrait')?'P':'L':window.innerHeight>=window.innerWidth?'P':'L';
 const words=()=>document.documentElement.lang==='sl'?{
  open:'Odpri sliko',close:'Zapri sliko',previous:'Prejšnja slika',next:'Naslednja slika',clean:'Čist ogled',controls:'Prikaži gumbe',
  loading:'Nalaganje slike 4K …',failed:'Slike 4K ni mogoče naložiti.',retry:'Poskusi znova',download:'Shrani prikazano sliko 4K',inline:'Slike ni mogoče naložiti.'
 }:{open:'Open illustration',close:'Close illustration',previous:'Previous image',next:'Next image',clean:'Immersive view',controls:'Show controls',
  loading:'Loading 4K image …',failed:'The 4K image could not be loaded.',retry:'Retry',download:'Save displayed 4K image',inline:'The illustration could not be loaded.'};
 const visible=image=>!image.closest('[hidden]');
 const readingAnchor=()=>{
  if(viewer.open)return null;
  const node=document.elementFromPoint?.(Math.min(window.innerWidth/2,500),Math.min(window.innerHeight/3,220))?.closest?.('.story p, .story h2');
  return node?{node,top:node.getBoundingClientRect().top}:null;
 };
 const restoreAnchor=anchor=>{if(anchor&&!viewer.open){const delta=anchor.node.getBoundingClientRect().top-anchor.top;if(Math.abs(delta)>1)window.scrollBy?.(0,delta);}};
 const errorFor=image=>image.closest('figure')?.querySelector('.nara-inline-error');
 function inlineUpdate(model){
  const image=model.image;if(!visible(image))return;
  const o=orientation(),v=model.variants[o+'_HD'];
  if(image.dataset.naraRequested===v.src)return;
  image.dataset.naraRequested=v.src;
  const token=(inlineTokens.get(image)||0)+1;inlineTokens.set(image,token);
  // Once enhanced, JS owns selection so media changes cannot show an undecoded asset.
  const picture=image.closest('picture');
  if(picture?.querySelector('source')){
   const selected=image.currentSrc||image.src;image.src=selected;
   picture.querySelectorAll('source').forEach(source=>source.remove());
  }
  const pending=inlineLoads.get(image);if(pending){pending.onload=null;pending.onerror=null;pending.src='';}
  const probe=new Image();inlineLoads.set(image,probe);probe.decoding='async';
  const fail=()=>{
   if(inlineTokens.get(image)!==token)return;
   inlineLoads.delete(image);image.dataset.naraLoadState='error';
   const error=errorFor(image);if(error){error.textContent=words().inline;error.hidden=false;}
  };
  probe.onerror=fail;
  probe.onload=async()=>{
   try{if(probe.decode)await probe.decode();}catch{fail();return;}
   if(inlineTokens.get(image)!==token)return;
   if(!visible(image)){inlineLoads.delete(image);delete image.dataset.naraRequested;return;}
   const anchor=readingAnchor();image.width=v.width;image.height=v.height;image.src=v.src;
   image.dataset.naraOrientation=o;image.dataset.naraResolution='hd';image.dataset.naraLoadState='ready';
   const error=errorFor(image);if(error)error.hidden=true;
   inlineLoads.delete(image);requestAnimationFrame(()=>restoreAnchor(anchor));
  };
  probe.src=v.src;
 }

 const viewer=document.createElement('dialog');viewer.className='nara-daily-lightbox nara-responsive-viewer';
 const stage=document.createElement('div');stage.className='nara-daily-lightbox-stage';
 const surface=document.createElement('div');surface.className='nara-daily-lightbox-surface';surface.tabIndex=0;surface.setAttribute('role','button');
 let large=document.createElement('img');large.alt='';surface.append(large);
 const close=document.createElement('button');close.type='button';close.className='nara-daily-lightbox-close';close.textContent='×';
 const controls=document.createElement('nav');controls.className='nara-responsive-controls';
 const previous=document.createElement('button');previous.type='button';previous.textContent='‹';
 const next=document.createElement('button');next.type='button';next.textContent='›';
 const clean=document.createElement('button');clean.type='button';
 const download=document.createElement('a');download.className='nara-responsive-download';download.hidden=true;
 controls.append(previous,clean,download,next);
 const message=document.createElement('div');message.className='nara-responsive-message';message.setAttribute('role','status');message.hidden=true;
 const messageText=document.createElement('span'),retry=document.createElement('button');retry.type='button';retry.hidden=true;message.append(messageText,retry);
 stage.append(surface,close,controls,message);viewer.append(stage);document.body.append(viewer);
 let source=null,position=null,group=[],active=0,token=0,cacheEpoch=0,immersive=false,tap=null,suppressClickUntil=0;
 let plan=[],refreshPending=false;
 const cache=new Map();
 const cacheState=()=>{viewer.dataset.cacheRetained=String(cache.size);viewer.dataset.cacheReady=String([...cache.values()].filter(e=>e.state==='ready').length);};
 function release(src){
  const entry=cache.get(src);if(!entry)return;cache.delete(src);
  if(entry.state==='loading')entry.cancel();cacheState();
 }
 function getEntry(src,priority='low'){
  let entry=cache.get(src);if(entry){entry.image.fetchPriority=priority;return entry;}
  const image=new Image();image.decoding='async';image.fetchPriority=priority;
  entry={src,image,state:'loading',promise:null,cancel:null};
  entry.promise=new Promise(resolve=>{
   let finished=false;
   const done=result=>{if(finished)return;finished=true;image.onload=null;image.onerror=null;entry.state=result?'ready':'error';cacheState();resolve(result);};
   image.onerror=()=>done(null);
   image.onload=async()=>{try{if(image.decode)await image.decode();done(image);}catch{done(null);}};
   entry.cancel=()=>{done(null);image.src='';};
  });
  cache.set(src,entry);cacheState();image.src=src;return entry;
 }
 function prepareWindow(){
  cacheEpoch++;
  plan=[active,active-1,active+1].filter(i=>i>=0&&i<group.length).flatMap(i=>['L','P'].map(o=>group[i].variants[o+'_4K'].src));
  const keep=new Set(plan);for(const src of cache.keys())if(!keep.has(src))release(src);cacheState();
 }
 async function prefetch(epoch){
  while(viewer.open&&epoch===cacheEpoch){
   const src=plan.find(path=>!cache.has(path));if(!src)return;
   await getEntry(src,'low').promise;
  }
 }
 function labels(){
  const w=words();close.setAttribute('aria-label',w.close);previous.setAttribute('aria-label',w.previous);next.setAttribute('aria-label',w.next);
  clean.textContent=immersive?w.controls:w.clean;clean.setAttribute('aria-pressed',String(immersive));
  surface.setAttribute('aria-label',immersive?w.controls:w.clean);download.textContent=w.download;retry.textContent=w.retry;
  previous.disabled=active<=0;next.disabled=active>=group.length-1;
 }
 function setImmersive(enabled){
  if(!viewer.open)return;immersive=enabled;viewer.classList.toggle('nara-responsive-immersive',enabled);
  close.hidden=enabled;controls.hidden=enabled;labels();
  if(enabled){
   surface.focus({preventScroll:true});
   try{stage.requestFullscreen?.({navigationUI:'hide'})?.catch(()=>{});}catch{}
  }else{
   if(document.fullscreenElement===stage){try{document.exitFullscreen?.()?.catch(()=>{});}catch{}}
   close.focus({preventScroll:true});
  }
 }
 async function showCurrent(force=false){
  if(!viewer.open||!group[active])return;
  const model=group[active],o=orientation(),v=model.variants[o+'_4K'],key=model.moment+':'+o;
  if(!force&&viewer.dataset.requested===key)return;
  viewer.dataset.requested=key;const request=++token;prepareWindow();
  if(force)release(v.src);
  labels();message.hidden=false;messageText.textContent=words().loading;retry.hidden=true;viewer.setAttribute('aria-busy','true');
  const image=await getEntry(v.src,'high').promise;
  if(!viewer.open||request!==token)return;
  viewer.setAttribute('aria-busy','false');
  if(!image){
   large.hidden=true;download.hidden=true;setImmersive(false);messageText.textContent=words().failed;retry.hidden=false;viewer.dataset.loadState='error';return;
  }
  large.replaceWith(image);large=image;large.alt=model.image.alt||'';large.width=v.width;large.height=v.height;large.hidden=false;
  viewer.setAttribute('aria-label',large.alt||words().open);message.hidden=true;
  viewer.dataset.moment=model.moment;viewer.dataset.orientation=o;viewer.dataset.resolution='4k';viewer.dataset.loadState='ready';
  download.href=v.src;download.download=v.src.split('/').pop();download.hidden=false;labels();
  void prefetch(cacheEpoch);
 }
 function dismiss(){
  if(!viewer.open)return;token++;cacheEpoch++;
  immersive=false;viewer.classList.remove('nara-responsive-immersive');
  if(viewer.close)viewer.close();else viewer.removeAttribute('open');
  document.documentElement.classList.remove('nara-lightbox-open');
  if(document.fullscreenElement===stage){try{document.exitFullscreen?.()?.catch(()=>{});}catch{}}
  for(const src of [...cache.keys()])release(src);
  const blank=document.createElement('img');large.replaceWith(blank);large=blank;
  const restore=source,at=position;source=null;position=null;group=[];plan=[];tap=null;delete viewer.dataset.requested;
  if(restore?.isConnected!==false){try{restore?.focus({preventScroll:true});}catch{}}
  if(at)requestAnimationFrame(()=>{window.scrollTo(at.x,at.y);restoreAnchor(at.anchor);});
 }
 function open(image){
  if(viewer.open||!models.has(image))return;source=image;
  const figure=image.closest('figure'),anchor=readingAnchor()||(figure?{node:figure,top:figure.getBoundingClientRect().top}:null);
  position={x:window.scrollX,y:window.scrollY,anchor};
  const model=models.get(image),language=image.closest('[lang]')?.getAttribute('lang');
  group=[...models.values()].filter(m=>m.story===model.story&&m.image.closest('[lang]')?.getAttribute('lang')===language);
  const seen=new Set();group=group.filter(m=>!seen.has(m.moment)&&seen.add(m.moment));active=group.findIndex(m=>m.moment===model.moment);
  if(active<0)return;
  try{if(viewer.showModal)viewer.showModal();else viewer.setAttribute('open','');}catch{source=null;position=null;return;}
  document.documentElement.classList.add('nara-lightbox-open');immersive=false;close.hidden=false;controls.hidden=false;
  labels();close.focus({preventScroll:true});void showCurrent();
 }
 function rememberTap(event){
  if(event.pointerType!=='touch')return;
  const now=Date.now(),x=event.clientX||0,y=event.clientY||0;
  if(viewer.open&&tap&&now-tap.time<380&&Math.hypot(x-tap.x,y-tap.y)<40){
   tap=null;suppressClickUntil=now+550;event.preventDefault();setImmersive(!immersive);
  }else tap={time:now,x,y};
 }
 for(const model of models.values()){
  const image=model.image;image.setAttribute('role','button');image.setAttribute('aria-haspopup','dialog');image.tabIndex=0;
  image.setAttribute('aria-label',words().open+': '+image.alt);
  image.addEventListener('pointerup',rememberTap);
  image.addEventListener('click',()=>open(image));
  image.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open(image);}});
 }
 surface.addEventListener('pointerup',rememberTap);
 surface.addEventListener('dblclick',event=>{event.preventDefault();if(Date.now()>=suppressClickUntil)setImmersive(!immersive);});
 close.addEventListener('click',dismiss);clean.addEventListener('click',()=>setImmersive(!immersive));
 const move=delta=>{const index=active+delta;if(index>=0&&index<group.length){active=index;void showCurrent();}};
 previous.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));retry.addEventListener('click',()=>void showCurrent(true));
 viewer.addEventListener('click',event=>{if(event.target===viewer&&!immersive)dismiss();});
 viewer.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
 document.addEventListener('keydown',event=>{
  if(!viewer.open)return;
  if(event.key==='Escape'){event.preventDefault();dismiss();}
  else if(event.key==='ArrowLeft'){event.preventDefault();move(-1);}
  else if(event.key==='ArrowRight'){event.preventDefault();move(1);}
  else if(event.key==='i'||(event.target===surface&&(event.key==='Enter'||event.key===' '))){event.preventDefault();setImmersive(!immersive);}
  else if(event.key==='Tab'){
   const focusable=immersive?[surface]:[close,...(previous.disabled?[]:[previous]),clean,...(download.hidden?[]:[download]),...(next.disabled?[]:[next]),...(retry.hidden?[]:[retry])];
   const current=focusable.indexOf(document.activeElement),target=event.shiftKey?(current<=0?focusable.at(-1):focusable[current-1]):(current<0||current===focusable.length-1?focusable[0]:focusable[current+1]);
   event.preventDefault();target.focus({preventScroll:true});
  }
 });
 document.addEventListener('fullscreenchange',()=>{if(viewer.open&&immersive&&document.fullscreenElement!==stage)dismiss();});
 const update=()=>{
  refreshPending=false;
  for(const model of models.values()){
   const image=model.image,rect=image.getBoundingClientRect?.();
   image.setAttribute('aria-label',words().open+': '+image.alt);
   if(!rect||rect.top<window.innerHeight+300&&rect.bottom>-300)inlineUpdate(model);
  }
  if(viewer.open)void showCurrent();
 };
 const schedule=()=>{if(!refreshPending){refreshPending=true;requestAnimationFrame(update);}};
 window.addEventListener('resize',schedule,{passive:true});window.addEventListener('orientationchange',schedule,{passive:true});
 window.screen?.orientation?.addEventListener?.('change',schedule);orientationQuery?.addEventListener?.('change',schedule);
 if(typeof IntersectionObserver!=='undefined'){
  const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)inlineUpdate(models.get(entry.target));},{rootMargin:'300px'});
  for(const image of models.keys())observer.observe(image);
 }else window.addEventListener('scroll',schedule,{passive:true});
 if(typeof MutationObserver!=='undefined')new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 update();
})();
