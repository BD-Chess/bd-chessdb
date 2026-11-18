// 18 Nov 2026 (BD × AI Lab): a recording's optional east-west scale (xScale) is applied when drawing; its points and lengths stay as recorded.
import {ReplayTimeline,parseRecording,serializeRecording,validateRecording,REPLAY_LIMITS} from './replay-data.mjs';
import {REPLAY_COPY} from './replay-copy.mjs';
import {formatDistance} from './distance-format.mjs';
export function mountReplay(root){
 let data=null,aspect=1,timeline=null,raf=0,previous=0,drawn=-1,scale=1,pan=[0,0],bounds=null,oldOverflow='',lastNotice='';
 const nodes={},labels=[],pointers=new Map();
 const language=()=>((document.documentElement.dataset.lang||document.documentElement.lang||'en').startsWith('sl')?'sl':'en');
 const copy=()=>REPLAY_COPY[language()];
 const element=(tag,parent,attrs={})=>{const n=document.createElement(tag);Object.assign(n,attrs);parent.append(n);return n;};
 const label=(node,key)=>{labels.push([node,key]);node.textContent=copy()[key];return node;};
 root.classList.add('replay-panel');root.tabIndex=0;
 const heading=label(element('h2',root),'heading');
 const notice=element('p',root,{className:'replay-notice'});notice.setAttribute('role','status');
 const canvas=element('canvas',root,{tabIndex:0});canvas.setAttribute('aria-label',copy().canvas);
 const tools=element('div',root,{className:'replay-row'});
 function button(parent,key,action){const n=label(element('button',parent,{type:'button',id:'replay'+key[0].toUpperCase()+key.slice(1)}),key);nodes[key]=n;n.onclick=action;return n;}
 button(tools,'further',()=>changeScale(.8));button(tools,'closer',()=>changeScale(1.25));button(tools,'fit',()=>{scale=1;pan=[0,0];paint();});
 button(tools,'expand',async()=>{if(root.requestFullscreen)try{await root.requestFullscreen();return;}catch{}oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';root.classList.add('replay-expanded');render();paint();});
 button(tools,'close',async()=>{if(document.fullscreenElement===root)await document.exitFullscreen();if(root.classList.contains('replay-expanded')){root.classList.remove('replay-expanded');document.body.style.overflow=oldOverflow;}render();paint();});
 const info=element('p',root,{className:'replay-info'});info.setAttribute('aria-live','polite');
 const positionLabel=label(element('label',root),'time');
 const position=element('input',positionLabel,{id:'replayPosition',type:'range',min:'0',max:'1',step:'any',value:'0'});
 position.oninput=()=>{pause();timeline?.seek(Number(position.value));render();};
 const controls=element('div',root,{className:'replay-row'});
 button(controls,'play',()=>{if(!timeline)return;if(timeline.time>=data.duration)timeline.stop();timeline.playing=true;previous=performance.now();render();raf=requestAnimationFrame(tick);});
 button(controls,'pause',()=>{pause();render();});button(controls,'stop',()=>{pause();timeline?.stop();render();});
 const steps=element('div',root,{className:'replay-row'});
 function step(n){pause();timeline?.step(n);render();}
 button(steps,'back',()=>step(-1));button(steps,'next',()=>step(1));
 const jumpLabel=label(element('label',steps),'jump'),jump=element('select',jumpLabel,{id:'replayJump'});
 for(const n of [10,100])jump.add(new Option(String(n),String(n)));
 button(steps,'backMany',()=>step(-Number(jump.value)));button(steps,'nextMany',()=>step(Number(jump.value)));
 const seconds=element('div',root,{className:'replay-row'});
 function seek(n){pause();timeline?.seek(timeline.time+n);render();}
 button(seconds,'backSecond',()=>seek(-1));button(seconds,'nextSecond',()=>seek(1));
 const speedLabel=label(element('label',seconds),'speed'),speed=element('select',speedLabel,{id:'replaySpeed'});
 for(const n of [1,.5,.2,.1])speed.add(new Option('×'+n,String(n)));speed.value='0.2';speed.onchange=()=>{if(timeline){timeline.speed=Number(speed.value);render();}};
 const files=element('div',root,{className:'replay-row'});
 button(files,'save',()=>{if(!data)return;const url=URL.createObjectURL(new Blob([serializeRecording(data)],{type:'application/json'}));const a=element('a',root,{href:url,download:'8ztsp-recording.json'});a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 const loadLabel=label(element('label',files),'load'),file=element('input',loadLabel,{id:'replayFile',type:'file',accept:'.json,application/json'});
 file.onchange=async()=>{try{const selected=file.files[0];if(!selected)return;if(selected.size>REPLAY_LIMITS.fileBytes)throw Error();setRecording(parseRecording(await selected.text()));}catch{lastNotice=copy().invalid;notice.textContent=lastNotice;}finally{file.value='';}};
 label(element('p',root,{className:'replay-help'}),'hint');
 function pause(){cancelAnimationFrame(raf);raf=0;if(timeline)timeline.playing=false;}
 function tick(now){if(!timeline?.playing)return;timeline.tick(Math.max(0,(now-previous)/1000));previous=now;render();if(timeline.playing)raf=requestAnimationFrame(tick);}
 function render(){
  for(const key of ['play','pause','stop','back','next','backMany','nextMany','backSecond','nextSecond','save','further','closer','fit','expand','close'])nodes[key].disabled=!timeline;
  position.disabled=!timeline;speed.disabled=!timeline;jump.disabled=!timeline;
  nodes.play.disabled=!timeline||timeline.playing;nodes.pause.disabled=!timeline?.playing;
  const expanded=document.fullscreenElement===root||root.classList.contains('replay-expanded');nodes.expand.hidden=expanded;nodes.close.hidden=!expanded;
  if(!timeline){info.textContent=copy().empty;paint();return;}
  position.min=String(data.frames[0].at);position.max=String(data.duration);position.value=String(timeline.time);
  const f=data.frames[timeline.index],text=`${copy().recording} · ×${timeline.speed} · ${copy().step} ${timeline.index+1}/${data.frames.length} · ${copy().solver} ${f.solverSeconds.toFixed(3)} s${data.clock==='arrival'?' · '+copy().worker+' '+(f.source+1):''} · ${copy().best} ${formatDistance(f.length,data.unit??null,language())}`;
  if(info.textContent!==text)info.textContent=text;
  if(drawn!==timeline.index){drawn=timeline.index;paint();}
 }
 function paint(){
  const rect=canvas.getBoundingClientRect(),ratio=devicePixelRatio||1;if(!rect.width||!rect.height)return;
  canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,rect.width,rect.height);if(!data)return;
  const [x0,x1,y0,y1]=bounds,fit=Math.min((rect.width-32)/Math.max(1,(x1-x0)*aspect),(rect.height-32)/Math.max(1,y1-y0))*scale;
  const point=(x,y)=>[rect.width/2+pan[0]+(x-(x0+x1)/2)*fit*aspect,rect.height/2+pan[1]-(y-(y0+y1)/2)*fit];
  const frame=data.frames[timeline.index],route=frame.route;ctx.strokeStyle='#41d5e7';ctx.lineWidth=1.2;ctx.beginPath();
  for(let i=0;i<(data.sampled?route.length/2:route.length);i++){const p=data.sampled?point(route[i*2],route[i*2+1]):point(data.points[route[i]*2],data.points[route[i]*2+1]);i?ctx.lineTo(...p):ctx.moveTo(...p);}ctx.closePath();ctx.stroke();
  ctx.fillStyle='#d9faff';ctx.beginPath();for(let i=0;i<data.points.length;i+=2){const p=point(data.points[i],data.points[i+1]);ctx.moveTo(p[0]+1.3,p[1]);ctx.arc(...p,1.3,0,Math.PI*2);}ctx.fill();
 }
 function changeScale(factor,anchor){const rect=canvas.getBoundingClientRect(),next=Math.min(24,Math.max(.5,scale*factor)),r=next/scale;anchor??=[rect.width/2,rect.height/2];pan=[anchor[0]-rect.width/2-(anchor[0]-rect.width/2-pan[0])*r,anchor[1]-rect.height/2-(anchor[1]-rect.height/2-pan[1])*r];scale=next;paint();}
 canvas.addEventListener('wheel',event=>{if(!data)return;event.preventDefault();const r=canvas.getBoundingClientRect();changeScale(event.deltaY<0?1.1:1/1.1,[event.clientX-r.left,event.clientY-r.top]);},{passive:false});
 canvas.onpointerdown=event=>{canvas.focus();canvas.setPointerCapture(event.pointerId);pointers.set(event.pointerId,[event.clientX,event.clientY]);};
 canvas.onpointermove=event=>{
  if(!pointers.has(event.pointerId)||!data)return;const before=[...pointers.values()];pointers.set(event.pointerId,[event.clientX,event.clientY]);const after=[...pointers.values()];
  if(before.length===1){pan[0]+=after[0][0]-before[0][0];pan[1]+=after[0][1]-before[0][1];}
  else if(before.length===2){const distance=a=>Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]),center=a=>[(a[0][0]+a[1][0])/2,(a[0][1]+a[1][1])/2],a=center(before),b=center(after),rect=canvas.getBoundingClientRect();changeScale(distance(after)/Math.max(1,distance(before)),[a[0]-rect.left,a[1]-rect.top]);pan[0]+=b[0]-a[0];pan[1]+=b[1]-a[1];}paint();
 };
 canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=event=>pointers.delete(event.pointerId);
 root.onkeydown=event=>{
  if(event.key==='Escape'&&root.classList.contains('replay-expanded')){nodes.close.click();return;}
  if(!timeline||['INPUT','SELECT','TEXTAREA','BUTTON'].includes(event.target.tagName))return;
  if(event.key===' '){event.preventDefault();nodes[timeline.playing?'pause':'play'].click();}
  else if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();step((event.key==='ArrowLeft'?-1:1)*(event.shiftKey?Number(jump.value):1));}
  else if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();seek(event.key==='ArrowUp'?1:-1);}
 };
 function setRecording(record){pause();validateRecording(record);data=record;aspect=Number.isFinite(record.xScale)&&record.xScale>=.05&&record.xScale<=20?record.xScale:1;timeline=new ReplayTimeline(data);timeline.speed=Number(speed.value);scale=1;pan=[0,0];drawn=-1;bounds=[Infinity,-Infinity,Infinity,-Infinity];for(let i=0;i<data.points.length;i+=2){bounds[0]=Math.min(bounds[0],data.points[i]);bounds[1]=Math.max(bounds[1],data.points[i]);bounds[2]=Math.min(bounds[2],data.points[i+1]);bounds[3]=Math.max(bounds[3],data.points[i+1]);}heading.textContent=copy().heading+' · '+data.name;lastNotice=data.sampled?copy().sampled:'';notice.textContent=lastNotice;render();}
 new ResizeObserver(paint).observe(canvas);
 document.addEventListener('fullscreenchange',()=>{render();paint();});
 new MutationObserver(()=>{for(const [node,key] of labels)node.firstChild?node.firstChild.textContent=copy()[key]:node.textContent=copy()[key];canvas.setAttribute('aria-label',copy().canvas);heading.textContent=data?copy().heading+' · '+data.name:copy().heading;notice.textContent=data?.sampled?copy().sampled:'';render();}).observe(document.documentElement,{attributes:true,attributeFilter:['lang','data-lang']});
 render();
 return {setRecording,pause,clear(){pause();nodes.close.click();pointers.clear();data=timeline=null;drawn=-1;render();},get state(){return timeline?{playing:timeline.playing,index:timeline.index,time:timeline.time,speed:timeline.speed,frames:data.frames.length,solverSeconds:data.frames[timeline.index].solverSeconds,scale,pan:[...pan]}:null;}};
}
