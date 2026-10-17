import {fromBase64,validateComicManifest,deriveComicKey,decryptComicBytes} from './crypto.mjs';
import {FIRST_PAGE_PANELS,FIRST_PAGE_OVERVIEW,sourceRect,readingPlace} from './first-page.mjs';
const $=id=>document.getElementById(id),gate=$('gate'),reader=$('reader'),form=$('gate-form'),input=$('passphrase'),status=$('status'),unlock=$('unlock'),image=$('comic-page'),stage=$('page-stage'),pageSelect=$('page-select'),hotspots=$('hotspots');
const STORAGE='bd.dfc.reader.v1:CMARVEL_01',root=new URL('./',location.href);
let manifest=null,key=null,index=0,panel=null,source=null,activeUrl=null,requestId=0,controller=null,zoomed=false,immersive=false;
function progress(){try{return readingPlace(JSON.parse(localStorage.getItem(STORAGE)||'{}'),location.search);}catch{return readingPlace({},location.search);}}
function save(){try{localStorage.setItem(STORAGE,JSON.stringify({page:index,panel}));}catch{}}
const digest=async data=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(v=>v.toString(16).padStart(2,'0')).join('');
async function loadManifest(){
 const releaseResponse=await fetch(new URL('../release.json',root),{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});if(!releaseResponse.ok)throw Error('RELEASE_HTTP');
 const expected=(await releaseResponse.json()).protected_comic?.manifest_sha256;if(!/^[a-f0-9]{64}$/.test(expected||''))throw Error('RELEASE_COMIC_INTEGRITY');
 const response=await fetch(new URL('manifest.json',root),{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('MANIFEST_HTTP');const data=await response.arrayBuffer();if(await digest(data)!==expected)throw Error('MANIFEST_INTEGRITY');manifest=validateComicManifest(JSON.parse(new TextDecoder().decode(data)));
 pageSelect.replaceChildren(...manifest.pages.map((page,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=`${i+1} / ${manifest.pages.length}`;return option;}));
}
function releaseSource(value){if(value){value.image.removeAttribute('src');URL.revokeObjectURL(value.url);}}
async function loadSource(next,withKey,signal){
 const page=manifest.pages[next],response=await fetch(new URL(page.file,root),{signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('PAGE_HTTP');
 const encrypted=await response.arrayBuffer();if(encrypted.byteLength!==page.cipher_bytes||await digest(encrypted)!==page.cipher_sha256)throw Error('PAGE_INTEGRITY');
 const plain=await decryptComicBytes(encrypted,withKey,page),url=URL.createObjectURL(new Blob([plain],{type:page.mime})),probe=new Image();
 try{probe.src=url;await probe.decode();if(probe.naturalWidth!==page.width_px||probe.naturalHeight!==page.height_px)throw Error('PAGE_DIMENSIONS');return {index:next,url,image:probe};}catch(error){URL.revokeObjectURL(url);throw error;}
}
async function cropUrl(value,selection){
 if(value.index!==0)return value.url;
 const [x,y,w,h]=sourceRect(value.index,selection),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 try{const ctx=canvas.getContext('2d');if(!ctx)throw Error('CANVAS_UNAVAILABLE');ctx.drawImage(value.image,x,y,w,h,0,0,w,h);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',1));if(!blob)throw Error('SOURCE_VIEW_UNAVAILABLE');return URL.createObjectURL(blob);}finally{canvas.width=canvas.height=0;}
}
function placeHotspots(){
 if(hotspots.hidden||!image.complete)return;
 const b=image.getBoundingClientRect(),s=stage.getBoundingClientRect();
 Object.assign(hotspots.style,{left:`${b.left-s.left+stage.scrollLeft-stage.clientLeft}px`,top:`${b.top-s.top+stage.scrollTop-stage.clientTop}px`,width:`${b.width}px`,height:`${b.height}px`});
}
function controls(){
 pageSelect.value=String(index);$('position').textContent=`Stran ${index+1} / ${manifest.pages.length}`;$('previous').disabled=index===0;$('next').disabled=index===manifest.pages.length-1;
 $('panel-controls').hidden=index!==0;$('panel-navigation').hidden=index!==0||panel===null;
 $('panel-position').textContent=panel===null?'Cela prva stran':`Izvorni kader ${panel+1} / 6`;
 $('panel-previous').disabled=panel===0;$('panel-next').disabled=panel===5;
 for(const button of $('panel-choices').children)button.setAttribute('aria-pressed',String(Number(button.dataset.panel)===panel));
 hotspots.hidden=index!==0||panel!==null;reader.dataset.page=String(index+1);reader.dataset.panel=panel===null?'':FIRST_PAGE_PANELS[panel].id;reader.dataset.ready='true';
 $('view-hint').textContent=index!==0?'Povečaj in povleci za podrobnosti. Dvojni klik/dotik odpre celozaslonski prikaz.':panel===null?'Izberi označen kader ali gumb 1–6. Dvojni klik/dotik odpre celozaslonski prikaz.':'To je povečan izvorni izrez z angleškim besedilom v sliki. Dvojni klik/dotik odpre celozaslonski prikaz.';
 requestAnimationFrame(placeHotspots);
}
async function showPage(next,selection=null){
 if(!manifest||!key)return false;sourceRect(next,selection);
 controller?.abort();const abort=new AbortController();controller=abort;const ticket=++requestId,withKey=key;
 reader.dataset.ready='false';stage.setAttribute('aria-busy','true');hotspots.hidden=true;image.hidden=true;$('reader-status').classList.remove('error');$('reader-status').textContent='Nalagam izvorni prikaz …';
 let candidate=null,url=null,committed=false;
 try{
  candidate=source?.index===next?source:await loadSource(next,withKey,abort.signal);
  if(ticket!==requestId||key!==withKey)return false;
  url=await cropUrl(candidate,selection);const probe=new Image();probe.src=url;await probe.decode();
  if(ticket!==requestId||key!==withKey)return false;
  const oldSource=source,oldUrl=activeUrl;source=candidate;activeUrl=url;image.src=url;image.alt=`CMarvel 01 · stran ${next+1}${selection===null?' · izvorna stran':` · izvorni kader ${selection+1}`}`;index=next;panel=selection;committed=true;
  if(oldUrl&&oldUrl!==oldSource?.url)URL.revokeObjectURL(oldUrl);if(oldSource!==source)releaseSource(oldSource);
  setZoom(false);image.hidden=false;controls();save();$('reader-status').textContent='';return true;
 }catch(error){if(ticket===requestId&&key===withKey){$('reader-status').textContent='Prikaza ni mogoče odpreti. Preveri povezavo in poskusi znova.';$('reader-status').classList.add('error');image.hidden=!activeUrl;if(activeUrl)controls();}return false;}
 finally{if(!committed){if(url&&url!==candidate?.url)URL.revokeObjectURL(url);if(candidate&&candidate!==source)releaseSource(candidate);}if(ticket===requestId)stage.setAttribute('aria-busy','false');}
}
function setZoom(value){zoomed=Boolean(value);stage.classList.toggle('zoomed',zoomed);$('zoom').textContent=zoomed?'Prilagodi':'Povečaj';if(zoomed)requestAnimationFrame(()=>{stage.scrollLeft=Math.max(0,(stage.scrollWidth-stage.clientWidth)/2);stage.scrollTop=Math.max(0,(stage.scrollHeight-stage.clientHeight)/2);placeHotspots();});else{stage.scrollLeft=0;stage.scrollTop=0;requestAnimationFrame(placeHotspots);}}
function setImmersive(value){immersive=Boolean(value);document.body.classList.toggle('immersive',immersive);$('immersive-exit').hidden=!immersive;$('fullscreen').setAttribute('aria-pressed',String(immersive));requestAnimationFrame(placeHotspots);}
function clearMedia(){if(activeUrl&&activeUrl!==source?.url)URL.revokeObjectURL(activeUrl);activeUrl=null;releaseSource(source);source=null;image.removeAttribute('src');image.alt='';hotspots.hidden=true;reader.dataset.ready='false';}
async function unlockStory(event){
 event.preventDefault();if(!manifest||unlock.disabled)return;const secret=input.value;input.value='';if(!secret)return;
 const ticket=++requestId;controller?.abort();const abort=new AbortController();controller=abort;unlock.disabled=true;unlock.textContent='Odklepam …';status.textContent='Preverjam geslo …';status.classList.remove('error');let candidateSource=null;
 try{const candidate=await deriveComicKey(secret,fromBase64(manifest.salt),manifest.iterations);if(ticket!==requestId)return;candidateSource=await loadSource(0,candidate,abort.signal);if(ticket!==requestId){releaseSource(candidateSource);candidateSource=null;return;}clearMedia();source=candidateSource;candidateSource=null;key=candidate;gate.hidden=true;reader.hidden=false;$('lock').hidden=false;setImmersive(false);const place=progress();await showPage(place.page,place.panel);status.textContent='';}
 catch{if(ticket===requestId){key=null;reader.hidden=true;gate.hidden=false;status.textContent='Geslo ni pravilno ali šifrirana vsebina ni dosegljiva.';status.classList.add('error');}releaseSource(candidateSource);}
 finally{unlock.disabled=false;unlock.textContent='Odpri strip';}
}
function lockStory(focus=true){requestId++;controller?.abort();controller=null;key=null;reader.hidden=true;gate.hidden=false;$('lock').hidden=true;setImmersive(false);setZoom(false);clearMedia();input.value='';status.textContent='Strip je zaklenjen.';status.classList.remove('error');if(focus)input.focus({preventScroll:true});}
for(const [i,p]of FIRST_PAGE_PANELS.entries()){
 const choice=document.createElement('button');choice.type='button';choice.dataset.panel=String(i);choice.textContent=String(i+1);choice.setAttribute('aria-label',`Izvorni kader ${i+1}`);choice.addEventListener('click',()=>showPage(0,i));$('panel-choices').append(choice);
 const hit=document.createElement('button');hit.type='button';hit.className='hotspot';hit.setAttribute('aria-label',`Odpri izvorni kader ${i+1}`);hit.textContent=String(i+1);const [x,y,w,h]=p.rect,[ox,oy,ow,oh]=FIRST_PAGE_OVERVIEW;Object.assign(hit.style,{left:`${(x-ox)/ow*100}%`,top:`${(y-oy)/oh*100}%`,width:`${w/ow*100}%`,height:`${h/oh*100}%`});hit.addEventListener('click',()=>showPage(0,i));hotspots.append(hit);
}
form.addEventListener('submit',unlockStory);$('lock').addEventListener('click',()=>lockStory());$('previous').addEventListener('click',()=>showPage(index-1));$('next').addEventListener('click',()=>showPage(index+1));$('zoom').addEventListener('click',()=>setZoom(!zoomed));pageSelect.addEventListener('change',()=>showPage(Number(pageSelect.value)));
$('overview').addEventListener('click',()=>showPage(0));$('panel-previous').addEventListener('click',()=>showPage(0,panel-1));$('panel-next').addEventListener('click',()=>showPage(0,panel+1));$('fullscreen').addEventListener('click',()=>setImmersive(!immersive));$('immersive-exit').addEventListener('click',()=>setImmersive(false));
let touch=null,lastTap=null,touchDblUntil=0;
stage.addEventListener('pointerdown',event=>{if(event.pointerType!=='touch'||event.target.closest('button'))return;if(!event.isPrimary){touch=null;lastTap=null;return;}touch={id:event.pointerId,x:event.clientX,y:event.clientY,at:performance.now()};},{passive:true});
stage.addEventListener('pointermove',event=>{if(touch?.id===event.pointerId&&Math.hypot(event.clientX-touch.x,event.clientY-touch.y)>12){touch=null;lastTap=null;}},{passive:true});
stage.addEventListener('pointercancel',()=>{touch=null;lastTap=null;},{passive:true});
stage.addEventListener('pointerup',event=>{if(!touch||touch.id!==event.pointerId)return;const now=performance.now(),point=touch;touch=null;if(now-point.at>300){lastTap=null;return;}if(lastTap&&now-lastTap.at<320&&Math.hypot(point.x-lastTap.x,point.y-lastTap.y)<30){lastTap=null;touchDblUntil=now+700;setImmersive(!immersive);}else lastTap={...point,at:now};},{passive:true});
image.addEventListener('dblclick',event=>{event.preventDefault();if(performance.now()>touchDblUntil)setImmersive(!immersive);});
document.addEventListener('keydown',event=>{if(reader.hidden)return;if(event.key==='Escape'){event.preventDefault();if(immersive)setImmersive(false);else if(zoomed)setZoom(false);else if(panel!==null)showPage(0);else lockStory();return;}if(event.target.matches('input,select,button'))return;if(event.key==='ArrowLeft'&&(panel!==null?panel>0:index>0)){event.preventDefault();showPage(panel!==null?0:index-1,panel!==null?panel-1:null);}else if(event.key==='ArrowRight'&&(panel!==null?panel<5:index<10)){event.preventDefault();showPage(panel!==null?0:index+1,panel!==null?panel+1:null);}});
image.addEventListener('load',placeHotspots);new ResizeObserver(placeHotspots).observe(image);window.addEventListener('resize',placeHotspots);window.addEventListener('pagehide',()=>lockStory(false));
try{await loadManifest();}catch{unlock.disabled=true;status.textContent='Zaščitene vsebine ni mogoče naložiti. Poskusi znova pozneje.';status.classList.add('error');}
