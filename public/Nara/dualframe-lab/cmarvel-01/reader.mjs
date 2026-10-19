import {FIRST_PAGE_PANELS,FIRST_PAGE_OVERVIEW,sourceRect,readingPlace} from './first-page.mjs';
const $=id=>document.getElementById(id),reader=$('reader'),image=$('comic-page'),stage=$('page-stage'),pageSelect=$('page-select'),hotspots=$('hotspots');
const STORAGE='bd.dfc.reader.v1:CMARVEL_01',root=new URL('./',location.href);
let manifest=null,index=0,panel=null,orientation='P',reviewMode='art',source=null,activeArt=null,activeUrl=null,requestId=0,controller=null,zoomed=false,immersive=false;
function progress(){
 let saved={};try{saved=JSON.parse(localStorage.getItem(STORAGE)||'{}');}catch{}
 const place=readingPlace(saved,location.search),explicitPage=new URLSearchParams(location.search).has('page');
 if(place.page!==0)return {...place,orientation:'P',reviewMode:'source'};
 return {...place,panel:place.panel??0,orientation:explicitPage?'P':saved?.orientation==='L'?'L':'P',reviewMode:!explicitPage&&saved?.page===0&&saved?.reviewMode==='source'?'source':'art'};
}
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
 const releaseResponse=await fetch(new URL('../release.json',root),{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});if(!releaseResponse.ok)throw Error('RELEASE_HTTP');
 const expected=(await releaseResponse.json()).comic_preview?.manifest_sha256;if(!/^[a-f0-9]{64}$/.test(expected||''))throw Error('RELEASE_COMIC_INTEGRITY');
 const response=await fetch(new URL('manifest.json',root),{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('MANIFEST_HTTP');
 const data=await response.arrayBuffer();if(await digest(data)!==expected)throw Error('MANIFEST_INTEGRITY');
 manifest=validatePublicManifest(JSON.parse(new TextDecoder().decode(data)));
 pageSelect.replaceChildren(...manifest.pages.map((page,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=(i+1)+' / '+manifest.pages.length;return option;}));
}
function releaseSource(value){if(value){value.image.removeAttribute('src');URL.revokeObjectURL(value.url);}}
function releaseArt(value){if(value){value.image.removeAttribute('src');URL.revokeObjectURL(value.url);}}
async function loadPublicImage(asset,signal){
 const response=await fetch(new URL(asset.file,root),{signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('PUBLIC_IMAGE_HTTP');
 const bytes=await response.arrayBuffer();if(bytes.byteLength!==asset.bytes||await digest(bytes)!==asset.sha256)throw Error('PUBLIC_IMAGE_INTEGRITY');
 const url=URL.createObjectURL(new Blob([bytes],{type:asset.mime})),probe=new Image();
 try{probe.src=url;await probe.decode();if(probe.naturalWidth!==asset.width_px||probe.naturalHeight!==asset.height_px)throw Error('PUBLIC_IMAGE_DIMENSIONS');return {url,image:probe};}catch(error){URL.revokeObjectURL(url);throw error;}
}
async function loadSource(next,signal){
 const page=manifest.pages[next],loaded=await loadPublicImage(page,signal);return {index:next,url:loaded.url,image:loaded.image};
}
async function loadReviewArt(selection,layout,signal){
 const pair=manifest.art_review?.pairs?.[selection],asset=pair?.[layout==='P'?'portrait':'landscape'];if(!asset)throw Error('ART_REVIEW_ASSET_MISSING');
 return loadPublicImage(asset,signal);
}
async function cropUrl(value,selection){
 if(value.index!==0)return value.url;
 const [x,y,w,h]=sourceRect(value.index,selection),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 try{const ctx=canvas.getContext('2d');if(!ctx)throw Error('CANVAS_UNAVAILABLE');ctx.drawImage(value.image,x,y,w,h,0,0,w,h);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',1));if(!blob)throw Error('SOURCE_VIEW_UNAVAILABLE');return URL.createObjectURL(blob);}finally{canvas.width=canvas.height=0;}
}
function placeHotspots(){
 if(hotspots.hidden||!image.complete)return;
 const b=image.getBoundingClientRect(),s=stage.getBoundingClientRect();
 Object.assign(hotspots.style,{left:(b.left-s.left+stage.scrollLeft-stage.clientLeft)+'px',top:(b.top-s.top+stage.scrollTop-stage.clientTop)+'px',width:b.width+'px',height:b.height+'px'});
}
function controls(){
 pageSelect.value=String(index);$('position').textContent='Stran '+(index+1)+' / '+manifest.pages.length;$('previous').disabled=index===0;$('next').disabled=index===manifest.pages.length-1;
 $('panel-controls').hidden=index!==0;$('panel-navigation').hidden=index!==0||panel===null;$('orientation-choices').hidden=index!==0||panel===null;
 $('panel-position').textContent=panel===null?'Izvorna stran':reviewMode==='source'?'Kader '+(panel+1)+' / 6 · izvirnik':'Kader '+(panel+1)+' / 6 · '+(orientation==='P'?'pokončno':'ležeče')+' · '+manifest.art_review.pairs[panel][orientation==='P'?'portrait':'landscape'].candidate;
 $('panel-previous').disabled=panel===0;$('panel-next').disabled=panel===5;
 $('source-toggle').hidden=index!==0||panel===null;$('source-toggle').textContent=reviewMode==='source'?'Nazaj k ilustraciji':'Izvorni kader';$('source-toggle').setAttribute('aria-pressed',String(reviewMode==='source'));
 $('portrait').setAttribute('aria-pressed',String(orientation==='P'));$('landscape').setAttribute('aria-pressed',String(orientation==='L'));
 for(const button of $('panel-choices').children)button.setAttribute('aria-pressed',String(Number(button.dataset.panel)===panel));
 hotspots.hidden=index!==0||panel!==null;reader.dataset.page=String(index+1);reader.dataset.panel=panel===null?'':FIRST_PAGE_PANELS[panel].id;reader.dataset.ready='true';
 $('view-hint').textContent=index!==0?'Povečaj in povleci za podrobnosti. Dvojni klik/dotik odpre celozaslonski prikaz.':panel===null?'Izberi kader 1–6, nato pokončno ali ležečo različico. Dvojni klik/dotik odpre celozaslonski prikaz.':reviewMode==='source'?'Izvirni kader izbrane strani. Dvojni klik/dotik odpre celozaslonski prikaz.':'Osnutek za tvojo vizualno oceno. Dvojni klik/dotik odpre celozaslonski prikaz.';
 requestAnimationFrame(placeHotspots);
}
async function showPage(next,selection=null,layout='P',mode='art'){
 if(!manifest)return false;sourceRect(next,selection);
 controller?.abort();const abort=new AbortController();controller=abort;const ticket=++requestId;
 const showArt=next===0&&selection!==null&&mode==='art';
 reader.dataset.ready='false';stage.setAttribute('aria-busy','true');hotspots.hidden=true;image.hidden=true;$('reader-status').classList.remove('error');$('reader-status').textContent=showArt?'Nalagam ilustracijo …':'Nalagam izvorni prikaz …';
 let candidate=null,artCandidate=null,url=null,committed=false;
 try{
  if(showArt)artCandidate=await loadReviewArt(selection,layout,abort.signal);else candidate=source?.index===next?source:await loadSource(next,abort.signal);
  if(ticket!==requestId)return false;
  url=showArt?artCandidate.url:await cropUrl(candidate,selection);if(!showArt){const probe=new Image();probe.src=url;await probe.decode();}
  if(ticket!==requestId)return false;
  const oldSource=source,oldArt=activeArt,oldUrl=activeUrl;if(candidate)source=candidate;activeArt=showArt?artCandidate:null;activeUrl=url;image.src=url;image.alt=showArt?'CMarvel 01 · kader '+(selection+1)+' · '+(layout==='P'?'pokončno':'ležeče')+' · '+manifest.art_review.pairs[selection][layout==='P'?'portrait':'landscape'].candidate:'CMarvel 01 · stran '+(next+1)+(selection===null?' · izvirna stran':' · izvirni kader '+(selection+1));index=next;panel=selection;orientation=layout;reviewMode=mode;committed=true;
  if(oldUrl&&oldUrl!==oldSource?.url&&oldUrl!==oldArt?.url)URL.revokeObjectURL(oldUrl);if(oldArt&&oldArt!==activeArt)releaseArt(oldArt);if(oldSource!==source)releaseSource(oldSource);
  setZoom(false);image.hidden=false;controls();save();$('reader-status').textContent='';return true;
 }catch(error){if(ticket===requestId){$('reader-status').textContent='Prikaza ni mogoče naložiti. Preveri povezavo in osveži stran.';$('reader-status').classList.add('error');image.hidden=!activeUrl;if(activeUrl)controls();}return false;}
 finally{if(!committed){if(url&&url!==candidate?.url&&url!==artCandidate?.url)URL.revokeObjectURL(url);if(artCandidate&&artCandidate!==activeArt)releaseArt(artCandidate);if(candidate&&candidate!==source)releaseSource(candidate);}if(ticket===requestId)stage.setAttribute('aria-busy','false');}
}
function setZoom(value){zoomed=Boolean(value);stage.classList.toggle('zoomed',zoomed);$('zoom').textContent=zoomed?'Prilagodi':'Povečaj';if(zoomed)requestAnimationFrame(()=>{stage.scrollLeft=Math.max(0,(stage.scrollWidth-stage.clientWidth)/2);stage.scrollTop=Math.max(0,(stage.scrollHeight-stage.clientHeight)/2);placeHotspots();});else{stage.scrollLeft=0;stage.scrollTop=0;requestAnimationFrame(placeHotspots);}}
function setImmersive(value){immersive=Boolean(value);document.body.classList.toggle('immersive',immersive);$('immersive-exit').hidden=!immersive;$('fullscreen').setAttribute('aria-pressed',String(immersive));requestAnimationFrame(placeHotspots);}
function clearMedia(){if(activeUrl&&activeUrl!==source?.url&&activeUrl!==activeArt?.url)URL.revokeObjectURL(activeUrl);activeUrl=null;releaseArt(activeArt);activeArt=null;releaseSource(source);source=null;image.removeAttribute('src');image.alt='';hotspots.hidden=true;reader.dataset.ready='false';}
for(const [i,p]of FIRST_PAGE_PANELS.entries()){
 const choice=document.createElement('button');choice.type='button';choice.dataset.panel=String(i);choice.textContent=String(i+1);choice.setAttribute('aria-label','Odpri par slik kadra '+(i+1));choice.addEventListener('click',()=>showPage(0,i,'P','art'));$('panel-choices').append(choice);
 const hit=document.createElement('button');hit.type='button';hit.className='hotspot';hit.setAttribute('aria-label','Odpri par slik kadra '+(i+1));hit.textContent=String(i+1);const [x,y,w,h]=p.rect,[ox,oy,ow,oh]=FIRST_PAGE_OVERVIEW;Object.assign(hit.style,{left:((x-ox)/ow*100)+'%',top:((y-oy)/oh*100)+'%',width:(w/ow*100)+'%',height:(h/oh*100)+'%'});hit.addEventListener('click',()=>showPage(0,i,'P','art'));hotspots.append(hit);
}
$('previous').addEventListener('click',()=>showPage(index-1));$('next').addEventListener('click',()=>showPage(index+1));$('zoom').addEventListener('click',()=>setZoom(!zoomed));pageSelect.addEventListener('change',()=>showPage(Number(pageSelect.value)));
$('overview').addEventListener('click',()=>showPage(0,null,orientation,'source'));$('portrait').addEventListener('click',()=>showPage(0,panel,'P','art'));$('landscape').addEventListener('click',()=>showPage(0,panel,'L','art'));$('source-toggle').addEventListener('click',()=>showPage(0,panel,orientation,reviewMode==='art'?'source':'art'));$('panel-previous').addEventListener('click',()=>showPage(0,panel-1,orientation,reviewMode));$('panel-next').addEventListener('click',()=>showPage(0,panel+1,orientation,reviewMode));$('fullscreen').addEventListener('click',()=>setImmersive(!immersive));$('immersive-exit').addEventListener('click',()=>setImmersive(false));
let touch=null,lastTap=null,touchDblUntil=0;
stage.addEventListener('pointerdown',event=>{if(event.pointerType!=='touch'||event.target.closest('button'))return;if(!event.isPrimary){touch=null;lastTap=null;return;}touch={id:event.pointerId,x:event.clientX,y:event.clientY,at:performance.now()};},{passive:true});
stage.addEventListener('pointermove',event=>{if(touch?.id===event.pointerId&&Math.hypot(event.clientX-touch.x,event.clientY-touch.y)>12){touch=null;lastTap=null;}},{passive:true});
stage.addEventListener('pointercancel',()=>{touch=null;lastTap=null;},{passive:true});
stage.addEventListener('pointerup',event=>{if(!touch||touch.id!==event.pointerId)return;const now=performance.now(),point=touch;touch=null;if(now-point.at>300){lastTap=null;return;}if(lastTap&&now-lastTap.at<320&&Math.hypot(point.x-lastTap.x,point.y-lastTap.y)<30){lastTap=null;touchDblUntil=now+700;setImmersive(!immersive);}else lastTap={...point,at:now};},{passive:true});
image.addEventListener('dblclick',event=>{event.preventDefault();if(performance.now()>touchDblUntil)setImmersive(!immersive);});
document.addEventListener('keydown',event=>{if(reader.hidden)return;if(event.key==='Escape'){event.preventDefault();if(immersive)setImmersive(false);else if(zoomed)setZoom(false);else if(panel!==null)showPage(0,null,orientation,'source');return;}if(event.target.matches('input,select,button'))return;if(event.key==='ArrowLeft'&&(panel!==null?panel>0:index>0)){event.preventDefault();showPage(panel!==null?0:index-1,panel!==null?panel-1:null,orientation,reviewMode);}else if(event.key==='ArrowRight'&&(panel!==null?panel<5:index<10)){event.preventDefault();showPage(panel!==null?0:index+1,panel!==null?panel+1:null,orientation,reviewMode);}});
image.addEventListener('load',placeHotspots);new ResizeObserver(placeHotspots).observe(image);window.addEventListener('resize',placeHotspots);
window.addEventListener('pagehide',()=>{requestId++;controller?.abort();controller=null;setImmersive(false);clearMedia();});
try{await loadManifest();const place=progress();await showPage(place.page,place.panel,place.orientation,place.reviewMode);}catch(error){$('reader-status').textContent='Stripa ni mogoče naložiti. Preveri povezavo in osveži stran.';$('reader-status').classList.add('error');}
