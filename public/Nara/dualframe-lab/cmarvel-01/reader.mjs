import {FIRST_PAGE_PANELS,FIRST_PAGE_OVERVIEW,sourceRect,readingPlace} from './first-page.mjs';
import {bindReaderPreferences,installReaderLayout,ReaderZoom} from '../reader-ui.mjs?v=33';
const $=id=>document.getElementById(id),reader=$('reader'),image=$('comic-page'),canvas=$('comic-source'),frame=$('comic-frame'),stage=$('page-stage'),pageSelect=$('page-select'),hotspots=$('hotspots');
const STORAGE='bd.dfc.reader.v1:CMARVEL_01',root=new URL('./',location.href),cache=new Map();
let manifest=null,index=0,panel=null,lastPanel=null,orientation='P',reviewMode='source',requestId=0,immersive=false,currentKey=null,language='SL';
const copy={SL:{gallery:'← Galerija stripov',page:'Stran',panel:'Kader',previous:'← Stran',next:'Stran →',panelPrevious:'← kader',panelNext:'kader →',overview:'Cela stran',fit:'Prilagodi',fullscreen:'Cel zaslon',close:'Zapri cel zaslon',more:'Prikaz',original:'Izvirnik',illustration:'Ilustracija',portrait:'P',landscape:'L',auto:'Auto',loading:'Nalagam …',error:'Slike ni mogoče naložiti. Poskusi znova.',retry:'Poskusi znova',info:'Podrobnosti',unreviewed:'Ilustracije prve strani čakajo na tvoj pregled.'},EN:{gallery:'← Cartoons gallery',page:'Page',panel:'Panel',previous:'← Page',next:'Page →',panelPrevious:'← panel',panelNext:'panel →',overview:'Whole page',fit:'Fit',fullscreen:'Full screen',close:'Exit full screen',more:'View',original:'Original',illustration:'Illustration',portrait:'P',landscape:'L',auto:'Auto',loading:'Loading…',error:'The image could not be loaded. Try again.',retry:'Try again',info:'Details',unreviewed:'The page-one illustrations await your review.'}};
const tr=k=>copy[language][k]||k;
const preferences=bindReaderPreferences(document.body,{language:'SL',onLanguage:lang=>{language=lang;document.documentElement.lang=lang.toLowerCase();controls();},onOrientation:()=>{if(panel!==null&&reviewMode==='art')showPage(index,panel,chosenOrientation(),'art');}});
language=preferences.prefs.language;document.documentElement.lang=language.toLowerCase();
const viewZoom=new ReaderZoom(stage,frame);
const layout=installReaderLayout(document.body,$('reader-header'),$('reader-dock'));
function chosenOrientation(){return preferences.prefs.orientation==='auto'?(innerWidth>=innerHeight?'L':'P'):preferences.prefs.orientation;}
function progress(){let saved={};try{saved=JSON.parse(localStorage.getItem(STORAGE)||'{}');}catch{}const place=readingPlace(saved,location.search);return {...place,orientation:chosenOrientation(),reviewMode:place.panel!==null&&saved.reviewMode!=='source'?'art':'source'};}
function save(){try{localStorage.setItem(STORAGE,JSON.stringify({page:index,panel,orientation,reviewMode}));}catch{}}
const digest=async data=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(v=>v.toString(16).padStart(2,'0')).join('');
function validAssetPath(value){return typeof value==='string'&&value.length>0&&/^[A-Za-z0-9_./-]+$/.test(value)&&!value.startsWith('/')&&!value.split('/').some(part=>!part||part==='.'||part==='..');}
function validatePublicManifest(value){
 if(value?.schema!=='bd.dfc.public-comic.v1'||value.story_id!=='CMARVEL_01'||value.version!==1||value.access!=='PUBLIC_RND_PREVIEW'||value.pages?.length!==11)throw Error('CMARVEL_PUBLIC_MANIFEST_INVALID');
 for(let i=0;i<value.pages.length;i++){
  const page=value.pages[i],id='CM_'+String(i+1).padStart(2,'0');
  if(page.page_id!==id||page.file!=='assets/'+id+'.webp'||!validAssetPath(page.file)||page.mime!=='image/webp'||page.width_px!==3840||page.height_px!==2160||!Number.isInteger(page.bytes)||page.bytes<16||!/^[a-f0-9]{64}$/.test(page.sha256))throw Error('CMARVEL_PUBLIC_PAGE_INVALID');
 }
 const review=value.art_review;
 if(review?.schema!=='bd.dfc.cmarvel.art-review.v1'||review.version!==1||review.status!=='UNREVIEWED'||review.page_id!=='CM_01'||review.pair_count!==6||review.pairs?.length!==6)throw Error('CMARVEL_PUBLIC_ART_REVIEW_INVALID');
 for(let i=0;i<6;i++){
  const pair=review.pairs[i],id='CM01-P01-K0'+(i+1);
  if(pair.panel_id!==id)throw Error('CMARVEL_PUBLIC_ART_PANEL_INVALID');
  for(const [field,orientation,width,height] of [['portrait','P',1584,2816],['landscape','L',2816,1584]]){
   const art=pair[field],filename=id+'-'+orientation+'.webp';
   if(art?.file!=='assets/review/'+filename||!validAssetPath(art.file)||art.mime!=='image/webp'||art.orientation!==orientation||art.width_px!==width||art.height_px!==height||!['A01','A02'].includes(art.candidate)||!Number.isInteger(art.bytes)||art.bytes<16||!/^[a-f0-9]{64}$/.test(art.sha256)||!/^[a-f0-9]{64}$/.test(art.source_sha256)||!Number.isInteger(art.source_bytes)||art.source_bytes<1)throw Error('CMARVEL_PUBLIC_ART_IMAGE_INVALID');
  }
 }
 return value;
}
async function loadManifest(){
 const releaseResponse=await fetch(new URL('../release.json?reader=33',root),{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});if(!releaseResponse.ok)throw Error('RELEASE_HTTP');
 const expected=(await releaseResponse.json()).comic_preview?.manifest_sha256;if(!/^[a-f0-9]{64}$/.test(expected||''))throw Error('RELEASE_COMIC_INTEGRITY');
 const response=await fetch(new URL('manifest.json',root),{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('MANIFEST_HTTP');
 const data=await response.arrayBuffer();if(await digest(data)!==expected)throw Error('MANIFEST_INTEGRITY');manifest=validatePublicManifest(JSON.parse(new TextDecoder().decode(data)));
 pageSelect.replaceChildren(...manifest.pages.map((page,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=(i+1)+' / '+manifest.pages.length;return option;}));
}
function dispose(entry){entry.controller.abort();if(entry.url)URL.revokeObjectURL(entry.url);entry.image?.removeAttribute('src');}
function prune(incoming=null){const keep=new Set([currentKey,incoming]);if(index===0){keep.add(manifest.pages[0].sha256);if(panel!==null)for(const field of ['portrait','landscape'])keep.add(manifest.art_review.pairs[panel][field].sha256);}for(const [key,entry] of cache){if(cache.size<=4)break;if(!keep.has(key)){cache.delete(key);dispose(entry);}}}
async function loadPublicImage(asset){
 const key=asset.sha256;let entry=cache.get(key);if(entry){cache.delete(key);cache.set(key,entry);return entry.promise;}
 entry={controller:new AbortController(),url:null,image:null};cache.set(key,entry);prune(key);
 entry.promise=(async()=>{const url=new URL(asset.file,root);url.searchParams.set('sha256',asset.sha256);const response=await fetch(url,{signal:entry.controller.signal,cache:'force-cache',credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('PUBLIC_IMAGE_HTTP');const bytes=await response.arrayBuffer();if(bytes.byteLength!==asset.bytes||await digest(bytes)!==asset.sha256)throw Error('PUBLIC_IMAGE_INTEGRITY');entry.url=URL.createObjectURL(new Blob([bytes],{type:asset.mime}));entry.image=new Image();entry.image.src=entry.url;await entry.image.decode();if(entry.image.naturalWidth!==asset.width_px||entry.image.naturalHeight!==asset.height_px)throw Error('PUBLIC_IMAGE_DIMENSIONS');return entry;})().catch(error=>{if(cache.get(key)===entry)cache.delete(key);dispose(entry);throw error;});
 return entry.promise;
}
function prefetch(){if(navigator.connection?.saveData)return;const assets=panel!==null?(reviewMode==='art'?[manifest.art_review.pairs[panel][orientation==='P'?'landscape':'portrait'],manifest.art_review.pairs[Math.min(5,panel+1)][orientation==='P'?'portrait':'landscape']]:[manifest.art_review.pairs[panel][orientation==='P'?'portrait':'landscape']]):[manifest.pages[Math.min(10,index+1)]];for(const asset of assets)if(asset.sha256!==currentKey)loadPublicImage(asset).catch(()=>{});}
function controls(){
 for(const n of document.querySelectorAll('[data-copy]'))n.textContent=tr(n.dataset.copy);
 if(!manifest)return;pageSelect.value=String(index);pageSelect.setAttribute('aria-label',language==='SL'?'Izberi stran':'Choose page');$('position').textContent=tr('page')+' '+(index+1)+' / 11';$('previous').disabled=index===0;$('next').disabled=index===10;
 $('panel-controls').hidden=index!==0;$('panel-navigation').hidden=index!==0||panel===null;$('orientation-choices').hidden=panel===null||reviewMode!=='art';$('source-toggle').hidden=panel===null;
 $('panel-position').textContent=panel===null?'':tr('panel')+' '+(panel+1)+' / 6';$('panel-previous').disabled=panel===0;$('panel-next').disabled=panel===5;
 $('source-toggle').textContent=tr(reviewMode==='source'?'illustration':'original');$('source-toggle').setAttribute('aria-pressed',String(reviewMode==='source'));$('overview').setAttribute('aria-pressed',String(panel===null));
 for(const button of $('panel-choices').children)button.setAttribute('aria-pressed',String(Number(button.dataset.panel)===(panel??lastPanel)));
 hotspots.hidden=index!==0||panel!==null;reader.dataset.page=String(index+1);reader.dataset.panel=panel===null?'':FIRST_PAGE_PANELS[panel].id;reader.dataset.ready='true';$('art-info').parentElement.hidden=panel===null;$('art-info').textContent=panel===null?'':manifest.art_review.pairs[panel][orientation==='P'?'portrait':'landscape'].candidate+' · '+tr('unreviewed');
 preferences.paint();layout();
}
async function showPage(next,selection=null,chosen=chosenOrientation(),mode='art'){
 if(!manifest)return false;sourceRect(next,selection);const ticket=++requestId,art=next===0&&selection!==null&&mode==='art',asset=art?manifest.art_review.pairs[selection][chosen==='P'?'portrait':'landscape']:manifest.pages[next];
 reader.dataset.ready='false';stage.setAttribute('aria-busy','true');$('reader-status').textContent=tr('loading');$('retry').hidden=true;
 try{const loaded=await loadPublicImage(asset);if(ticket!==requestId)return false;
  currentKey=asset.sha256;const rect=!art&&next===0?sourceRect(next,selection):null;
  if(rect){const [x,y,w,h]=rect;canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');if(!ctx)throw Error('CANVAS_UNAVAILABLE');ctx.drawImage(loaded.image,x,y,w,h,0,0,w,h);canvas.hidden=false;image.hidden=true;viewZoom.setAsset(w,h,next+':'+selection+':source');}
  else{canvas.hidden=true;image.hidden=false;image.src=loaded.url;viewZoom.setAsset(asset.width_px,asset.height_px,next+':'+selection+':'+(art?chosen:'source'));}
  image.alt='CMarvel 01 · '+tr('page')+' '+(next+1)+(selection===null?'':' · '+tr('panel')+' '+(selection+1));canvas.setAttribute('aria-label',image.alt);index=next;panel=selection;if(selection!==null)lastPanel=selection;orientation=chosen;reviewMode=art?'art':'source';controls();save();$('reader-status').textContent='';prune();prefetch();return true;
 }catch(error){if(ticket===requestId){$('reader-status').textContent=tr('error');$('retry').hidden=false;reader.dataset.error=error.message;}return false;}finally{if(ticket===requestId)stage.setAttribute('aria-busy','false');}
}
function setImmersive(value){immersive=Boolean(value);document.body.classList.toggle('immersive',immersive);document.body.classList.remove('controls-hidden');$('immersive-exit').hidden=!immersive;$('fullscreen').setAttribute('aria-pressed',String(immersive));layout();requestAnimationFrame(()=>viewZoom.fit());}
for(const [i,p]of FIRST_PAGE_PANELS.entries()){
 const choose=()=>showPage(0,i,chosenOrientation(),'art');const choice=document.createElement('button');choice.type='button';choice.dataset.panel=String(i);choice.textContent=String(i+1);choice.setAttribute('aria-label','Kader / Panel '+(i+1));choice.addEventListener('click',choose);$('panel-choices').append(choice);
 const hit=choice.cloneNode(true);hit.className='hotspot';const [x,y]=p.rect,[ox,oy,ow,oh]=FIRST_PAGE_OVERVIEW;Object.assign(hit.style,{left:((x-ox)/ow*100)+'%',top:((y-oy)/oh*100)+'%'});hit.addEventListener('click',choose);hotspots.append(hit);
}
$('previous').addEventListener('click',()=>showPage(index-1));$('next').addEventListener('click',()=>showPage(index+1));pageSelect.addEventListener('change',()=>showPage(Number(pageSelect.value)));
$('zoom').addEventListener('click',()=>viewZoom.step(1));$('zoom-out').addEventListener('click',()=>viewZoom.step(-1));$('zoom-fit').addEventListener('click',()=>viewZoom.reset());$('overview').addEventListener('click',()=>showPage(index,null,orientation,'source'));
$('source-toggle').addEventListener('click',()=>showPage(0,panel,orientation,reviewMode==='art'?'source':'art'));$('panel-previous').addEventListener('click',()=>showPage(0,panel-1,orientation,reviewMode));$('panel-next').addEventListener('click',()=>showPage(0,panel+1,orientation,reviewMode));$('fullscreen').addEventListener('click',()=>setImmersive(!immersive));$('immersive-exit').addEventListener('click',()=>setImmersive(false));$('retry').addEventListener('click',()=>manifest?showPage(index,panel,orientation,reviewMode):start());
let touch=null,lastTap=null,touchDblUntil=0;
stage.addEventListener('pointerdown',event=>{if(event.pointerType!=='touch'||event.target.closest('button'))return;if(!event.isPrimary){touch=null;lastTap=null;return;}touch={id:event.pointerId,x:event.clientX,y:event.clientY,at:performance.now()};},{passive:true});
stage.addEventListener('pointermove',event=>{if(touch?.id===event.pointerId&&Math.hypot(event.clientX-touch.x,event.clientY-touch.y)>12){touch=null;lastTap=null;}},{passive:true});stage.addEventListener('pointercancel',()=>{touch=null;lastTap=null;},{passive:true});
stage.addEventListener('pointerup',event=>{if(!touch||touch.id!==event.pointerId)return;const now=performance.now(),point=touch;touch=null;if(now-point.at>300){lastTap=null;return;}if(lastTap&&now-lastTap.at<320&&Math.hypot(point.x-lastTap.x,point.y-lastTap.y)<30){lastTap=null;touchDblUntil=now+700;setImmersive(!immersive);}else lastTap={...point,at:now};},{passive:true});
stage.addEventListener('dblclick',event=>{if(event.target.closest('button'))return;event.preventDefault();if(performance.now()>touchDblUntil)setImmersive(!immersive);});stage.addEventListener('click',event=>{if(immersive&&!event.target.closest('button')&&event.detail===1)document.body.classList.toggle('controls-hidden');});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();if(immersive)setImmersive(false);else if(viewZoom.scale!==1)viewZoom.reset();else if(panel!==null)showPage(index,null,orientation,'source');return;}if(event.target.matches('input,select,button')||!manifest)return;const delta=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0;if(delta){event.preventDefault();if(panel!==null&&panel+delta>=0&&panel+delta<6)showPage(0,panel+delta,orientation,reviewMode);else if(panel===null&&index+delta>=0&&index+delta<11)showPage(index+delta);}if(event.key==='+')viewZoom.step(1);if(event.key==='-')viewZoom.step(-1);if(event.key==='0')viewZoom.reset();});
window.addEventListener('resize',()=>{if(manifest&&panel!==null&&reviewMode==='art'&&preferences.prefs.orientation==='auto'&&orientation!==chosenOrientation())showPage(index,panel,chosenOrientation(),'art');});
window.addEventListener('pagehide',()=>{requestId++;for(const entry of cache.values())dispose(entry);cache.clear();});window.addEventListener('pageshow',event=>{if(event.persisted)start();});
async function start(){try{await loadManifest();const place=progress();await showPage(place.page,place.panel,place.orientation,place.reviewMode);}catch(error){$('reader-status').textContent=tr('error');reader.dataset.error=error.message;$('retry').hidden=false;}}
controls();await start();
