import fs from 'node:fs';
import vm from 'node:vm';
const script=fs.readFileSync(new URL('../../public/Nara/assets/js/nara-daily-responsive.js',import.meta.url),'utf8');
export const flush=()=>new Promise(resolve=>setImmediate(resolve));

/** Browser-free DOM harness with controlled image load/decode and real event ordering. */
export function responsiveFixture({portrait=true,auto=true,fullscreen=true,failed=[],opted=true,otherStory=false}={}){
 const requests=[],pending=[],windowListeners=new Map(),documentListeners=new Map(),rootClasses=new Set();
 let clock=1000,scrollCalls=0,scrollByCalls=0;
 const dispatch=(map,type,event)=>{for(const fn of map.get(type)||[])fn(event);};
 const on=(map,type,fn)=>{if(!map.has(type))map.set(type,[]);map.get(type).push(fn);};
 class Node{
  constructor(tag){this.tagName=tag;this.attrs={};this.dataset={};this.children=[];this.listeners=new Map();this.hidden=false;this.open=false;this.isConnected=true;const classes=new Set();this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle:(x,yes)=>yes?classes.add(x):classes.delete(x)};}
  setAttribute(key,value){this.attrs[key]=value;if(key==='open')this.open=true;}
  removeAttribute(key){delete this.attrs[key];if(key==='open')this.open=false;}
  getAttribute(key){return this.attrs[key]??null;}
  addEventListener(type,fn){on(this.listeners,type,fn);}
  fire(type,event={}){dispatch(this.listeners,type,{target:this,preventDefault(){this.prevented=true;},...event});}
  append(...nodes){for(const n of nodes){this.children.push(n);n.parent=this;}}
  replaceWith(node){const i=this.parent.children.indexOf(this);this.parent.children[i]=node;node.parent=this.parent;this.parent=null;}
  remove(){if(this.parent){this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  querySelectorAll(selector){return this.children.flatMap(n=>[(selector==='source'&&n.tagName==='source'||selector==='.nara-inline-error'&&n.className==='nara-inline-error')?n:null,...n.querySelectorAll(selector)]).filter(Boolean);}
  closest(selector){if(selector==='[lang]')return this.languageNode||this.parent?.closest(selector);if(selector==='[hidden]')return this.languageNode&&this.languageNode.getAttribute('lang')!==document.documentElement.lang?this.languageNode:null;if(selector==='picture')return this.picture;if(selector==='figure')return this.figure;return null;}
  getBoundingClientRect(){return {top:100,bottom:600,width:402,height:500};}
  focus(){document.activeElement=this;}
  showModal(){this.open=true;}
  close(){this.open=false;}
  requestFullscreen(){if(!fullscreen)return Promise.reject(Error('Unavailable'));document.fullscreenElement=this;dispatch(documentListeners,'fullscreenchange',{});return Promise.resolve();}
 }
 class LoadedImage extends Node{
  constructor(){super('img');this.state='new';}
  set src(value){this._src=value;if(!value)return;requests.push({src:value,image:this,priority:this.fetchPriority});pending.push(this);if(auto)queueMicrotask(()=>settleImage(this));}
  get src(){return this._src||'';}
  decode(){this.decoded=true;return Promise.resolve();}
 }
 const settleImage=image=>{if(image.state!=='new')return;image.state='settled';if(failed.includes(image.src))image.onerror?.();else image.onload?.();};
 const document={
  activeElement:null,fullscreenElement:null,body:new Node('body'),documentElement:{lang:'en',classList:{add:x=>rootClasses.add(x),remove:x=>rootClasses.delete(x),contains:x=>rootClasses.has(x)}},
  querySelectorAll:selector=>selector==='img[data-nara-responsive]'&&opted?images:[],createElement:tag=>new Node(tag),
  addEventListener:(type,fn)=>on(documentListeners,type,fn),
  exitFullscreen(){this.fullscreenElement=null;dispatch(documentListeners,'fullscreenchange',{});return Promise.resolve();}
 };
 const media={matches:portrait,addEventListener:(type,fn)=>on(windowListeners,'media-'+type,fn)};
 const window={
  innerWidth:portrait?402:874,innerHeight:portrait?874:402,scrollX:19,scrollY:720,screen:{orientation:{type:portrait?'portrait-primary':'landscape-primary'}},
  matchMedia:()=>media,addEventListener:(type,fn)=>on(windowListeners,type,fn),
  scrollTo(x,y){this.scrollX=x;this.scrollY=y;scrollCalls++;},scrollBy(x,y){this.scrollX+=x;this.scrollY+=y;scrollByCalls++;}
 };
 const images=[];
 for(const lang of ['en','sl'])for(let index=1;index<=3;index++){
  const image=new Node('img'),picture=new Node('picture'),figure=new Node('figure'),fallback=new Node('source'),error=new Node('span'),languageNode=new Node('div');
  languageNode.setAttribute('lang',lang);error.className='nara-inline-error';error.hidden=true;picture.append(fallback,image);figure.append(picture,error);
  image.languageNode=languageNode;image.picture=picture;image.figure=figure;image.alt=lang+' moment '+index;image.src='L'+index+'-HD.webp';image.currentSrc=image.src;image.height=1080;
  image.dataset={naraStory:'story-one',naraMoment:'moment-0'+index,naraVariants:JSON.stringify(Object.fromEntries(['L_HD','P_HD','L_4K','P_4K'].map(slot=>[slot,{src:slot[0]+index+'-'+(slot.endsWith('4K')?'4K':'HD')+'.webp',width:slot[0]==='P'?1080:1920,height:slot[0]==='P'?1920:1080}])))};
  images.push(image);
 }
 if(otherStory){const image=new Node('img');image.languageNode=images[0].languageNode;image.dataset={...images[0].dataset,naraStory:'story-two',naraVariants:images[0].dataset.naraVariants.replaceAll('1-','other-')};image.alt='other';images.push(image);}
 vm.runInNewContext(script,{document,window,Image:LoadedImage,requestAnimationFrame:fn=>fn(),Date:{now:()=>clock},console});
 const viewer=document.body.children[0],stage=viewer?.children[0],surface=stage?.children[0],close=stage?.children[1],controls=stage?.children[2],message=stage?.children[3];
 return {images,requests,document,window,viewer,stage,surface,close,controls,message,
  get large(){return surface.children[0];},get position(){return {x:window.scrollX,y:window.scrollY};},get scrollCalls(){return scrollCalls;},get scrollByCalls(){return scrollByCalls;},
  rotate(p){media.matches=p;window.innerWidth=p?402:874;window.innerHeight=p?874:402;dispatch(windowListeners,'resize',{});},
  settle(src){for(const image of pending.filter(i=>i.src===src))settleImage(image);},
  key(key,options={}){dispatch(documentListeners,'keydown',{key,preventDefault(){},...options});},
  doubleTap(){surface.fire('pointerup',{pointerType:'touch',clientX:100,clientY:100});clock+=180;surface.fire('pointerup',{pointerType:'touch',clientX:101,clientY:102});},
  tick(ms){clock+=ms;}
 };
}
