// Shared reader preferences, viewport sizing and image zoom. No story data lives here.
export const UI_STORAGE='bd.dfc.ui.v1';
export const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
export function readPreferences(storage){
 try{storage=storage||globalThis.localStorage;const p=JSON.parse(storage.getItem(UI_STORAGE)||'{}');return {language:['SL','EN'].includes(p.language)?p.language:null,font:clamp(Number(p.font)||100,80,160),orientation:['P','L'].includes(p.orientation)?p.orientation:'auto'};}catch{return {language:null,font:100,orientation:'auto'};}
}
export function bindReaderPreferences(root,{language='SL',onLanguage=()=>{},onOrientation=()=>{}}={}){
 const prefs=readPreferences();prefs.language=prefs.language||language;
 const save=()=>{try{localStorage.setItem(UI_STORAGE,JSON.stringify(prefs));}catch{}};
 function paint(){root.style.setProperty('--reader-font',String(prefs.font/100));for(const b of root.querySelectorAll('[data-reader-lang]'))b.setAttribute('aria-pressed',String(b.dataset.readerLang===prefs.language));for(const b of root.querySelectorAll('[data-font-reset]')){b.textContent=prefs.font+'%';b.title=prefs.language==='SL'?'Ponastavi velikost besedila':'Reset text size';}for(const b of root.querySelectorAll('[data-reader-orientation]'))b.setAttribute('aria-pressed',String(b.dataset.readerOrientation===prefs.orientation));}
 for(const b of root.querySelectorAll('[data-reader-lang]'))b.addEventListener('click',()=>{prefs.language=b.dataset.readerLang;save();paint();onLanguage(prefs.language);});
 for(const b of root.querySelectorAll('[data-font-step]'))b.addEventListener('click',()=>{prefs.font=clamp(prefs.font+Number(b.dataset.fontStep),80,160);save();paint();});
 for(const b of root.querySelectorAll('[data-font-reset]'))b.addEventListener('click',()=>{prefs.font=100;save();paint();});
 for(const b of root.querySelectorAll('[data-reader-orientation]'))b.addEventListener('click',()=>{prefs.orientation=b.dataset.readerOrientation;save();paint();onOrientation(prefs.orientation);});
 root.querySelector('[data-reader-more]')?.addEventListener('click',event=>{const on=root.classList.toggle('details-open');event.currentTarget.setAttribute('aria-expanded',String(on));});
 paint();return {prefs,setLanguage(lang){prefs.language=lang;save();paint();},paint};
}
export function installReaderLayout(root,head,dock){
 const update=()=>{const top=root.classList.contains('immersive')?0:Math.max(0,head.getBoundingClientRect().bottom);const h=window.visualViewport?.height||innerHeight;root.style.setProperty('--reader-height',Math.max(150,h-top-dock.getBoundingClientRect().height-34)+'px');};
 const observer=new ResizeObserver(update);observer.observe(head);observer.observe(dock);window.addEventListener('resize',update);window.visualViewport?.addEventListener('resize',update);update();return update;
}
export class ReaderZoom{
 constructor(stage,frame,{changed=()=>{}}={}){this.stage=stage;this.frame=frame;this.changed=changed;this.scale=1;this.asset=null;this.memory=new Map();this.drag=null;
  new ResizeObserver(()=>this.fit()).observe(stage);
  stage.addEventListener('wheel',e=>{if(e.ctrlKey||e.deltaMode===1||Math.abs(e.deltaY)>=80&&!e.deltaX){e.preventDefault();this.step(e.deltaY<0?1:-1);}},{passive:false});
  stage.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0||this.scale<=1||e.target.closest('button'))return;this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:stage.scrollLeft,top:stage.scrollTop};});
  stage.addEventListener('pointermove',e=>{const d=this.drag;if(!d||e.pointerId!==d.id||!e.buttons)return;stage.scrollLeft=d.left+d.x-e.clientX;stage.scrollTop=d.top+d.y-e.clientY;});
  const end=()=>{this.drag=null;};stage.addEventListener('pointerup',end);stage.addEventListener('pointerleave',end);stage.addEventListener('pointercancel',end);
 }
 setAsset(width,height,key){if(this.asset?.key!==key){if(this.asset){this.memory.set(this.asset.key,this.scale);if(this.memory.size>24)this.memory.delete(this.memory.keys().next().value);}this.scale=this.memory.get(key)||1;}this.asset={width,height,key};this.fit();}
 fit(){if(!this.asset)return;const {stage,frame,asset}=this;const fit=Math.min(stage.clientWidth/asset.width,stage.clientHeight/asset.height);const left=stage.scrollWidth? (stage.scrollLeft+stage.clientWidth/2)/stage.scrollWidth:.5,top=stage.scrollHeight?(stage.scrollTop+stage.clientHeight/2)/stage.scrollHeight:.5;frame.style.width=Math.max(1,asset.width*fit*this.scale)+'px';frame.style.height=Math.max(1,asset.height*fit*this.scale)+'px';stage.classList.toggle('zoomed',this.scale>1.001);stage.dataset.zoom=this.scale.toFixed(2);requestAnimationFrame(()=>{stage.scrollLeft=Math.max(0,left*stage.scrollWidth-stage.clientWidth/2);stage.scrollTop=Math.max(0,top*stage.scrollHeight-stage.clientHeight/2);});this.changed(this.scale);}
 step(direction){this.scale=clamp(this.scale*Math.pow(1.25,direction),.5,5);this.fit();}
 reset(){this.scale=1;this.fit();this.stage.scrollLeft=0;this.stage.scrollTop=0;}
}
