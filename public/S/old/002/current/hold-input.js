'use strict';
// CURRENT presentation adapter; copied geometry/presentation only, no game engine.

/* Pure layout: all coordinates include the complete popup footprint. */
window.SudokuMobileGeometry=(()=>{
  const rect=(left,top,width,height)=>({left,top,right:left+width,bottom:top+height,width,height});
  const overlap=(a,b,g=0)=>a.left<b.right+g&&a.right>b.left-g&&a.top<b.bottom+g&&a.bottom>b.top-g;
  const inside=(a,b)=>a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom;
  function union(rs){return rect(Math.min(...rs.map(r=>r.left)),Math.min(...rs.map(r=>r.top)),Math.max(...rs.map(r=>r.right))-Math.min(...rs.map(r=>r.left)),Math.max(...rs.map(r=>r.bottom))-Math.min(...rs.map(r=>r.top)));}
  function place(cells,index,viewport,options){
    if(!viewport||!Array.isArray(cells)||cells.length!==81||!Number.isInteger(index)||index<0||index>80||[viewport,...cells].some(r=>!r||![r.left,r.top,r.right,r.bottom].every(Number.isFinite)||r.right<=r.left||r.bottom<=r.top))return{ok:false,reason:'Invalid visible geometry'};
    // No options preserves the released protected-cross search exactly.
    const requested=({normal:52,large:68,extraLarge:84})[options?.size]||68;
    const sizes=Array.from({length:(requested-44)/4+1},(_,i)=>requested-i*4);
    if(options?.position==='atCell'){
      const target=cells[index];if(!overlap(target,viewport))return{ok:false,reason:'Show the target cell, or use Numbers below'};
      for(const size of sizes){
        const width=32+size*3+8,height=width+24;
        if(width>viewport.right-viewport.left||height>viewport.bottom-viewport.top)continue;
        const x=Math.max(viewport.left,Math.min(viewport.right-width,(target.left+target.right-width)/2));
        const y=Math.max(viewport.top,Math.min(viewport.bottom-height,(target.top+target.bottom-height)/2));
        return{ok:true,footprint:rect(x,y,width,height),size,targets:Array.from({length:9},(_,i)=>({...rect(x+16+(i%3)*(size+4),y+40+Math.floor(i/3)*(size+4),size,size),digit:i+1}))};
      }
      return{ok:false,reason:'Not enough visible space; use Numbers below'};
    }
    const board=union(cells);if(!inside(board,viewport))return{ok:false,reason:'Show the whole board, or use Numbers below'};
    const row=union(cells.slice(Math.floor(index/9)*9,Math.floor(index/9)*9+9)),col=union(cells.filter((_,i)=>i%9===index%9)),target=cells[index];
    const box=union(cells.filter((_,i)=>Math.floor(i/27)===Math.floor(index/27)&&Math.floor(i%9/3)===Math.floor(index%9/3)));
    const cx=(target.left+target.right)/2,cy=(target.top+target.bottom)/2,clearance=4,frame=16,header=24,gap=4,choices=[];
    for(const size of sizes){
      const width=2*frame+size*3+gap*2,height=width+header;
      const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
      const xs=[viewport.left,viewport.right-width,clamp(cx-width/2,viewport.left,viewport.right-width),... [row,col,box].flatMap(r=>[r.left-width-clearance,r.right+clearance])];
      const ys=[viewport.top,viewport.bottom-height,clamp(cy-height/2,viewport.top,viewport.bottom-height),... [row,col,box].flatMap(r=>[r.top-height-clearance,r.bottom+clearance])];
      for(const x of new Set(xs))for(const y of new Set(ys)){
        const footprint=rect(x,y,width,height);if(!inside(footprint,viewport)||overlap(footprint,row,clearance)||overlap(footprint,col,clearance))continue;
        const distance=Math.hypot(cx-clamp(cx,x,x+width),cy-clamp(cy,y,y+height));
        const score=(requested-size)*6+distance+(overlap(footprint,box,clearance)?28:0);
        choices.push({ok:true,footprint,size,score,distance,clearance,targets:Array.from({length:9},(_,i)=>({...rect(x+frame+(i%3)*(size+gap),y+frame+header+Math.floor(i/3)*(size+gap),size,size),digit:i+1}))});
      }
    }
    choices.sort((a,b)=>a.score-b.score||b.size-a.size||a.footprint.top-b.footprint.top||a.footprint.left-b.footprint.left);
    return choices[0]||{ok:false,reason:'Not enough clear space; use Numbers below'};
  }
  return Object.freeze({place,rect,union,overlap,inside});
})();


/* Presentation-only input contract: visible board, target Notes and difficulty.
   No engine/global game access, hidden solution or candidate computation. */
window.SudokuPickerPresentation=(()=>{
 const choices={position:['atCell','context'],size:['normal','large','extraLarge'],assist:['auto','on','off']};
 function validate(raw){const out={};if(raw&&typeof raw==='object'&&!Array.isArray(raw))for(const [k,values]of Object.entries(choices))if(values.includes(raw[k]))out[k]=raw[k];return out;}
 function preferences(raw,mobile){return{position:'atCell',size:mobile?'large':'normal',assist:'auto',...validate(raw)};}
 function preview(board,index,userNotes,difficulty,assist){
  const active=assist==='on'||assist==='auto'&&difficulty==='easy',conflicts=new Set(),r=Math.floor(index/9),c=index%9;
  if(active)for(let i=0;i<81;i++){if(i===index)continue;const y=Math.floor(i/9),x=i%9;if(y===r||x===c||Math.floor(y/3)===Math.floor(r/3)&&Math.floor(x/3)===Math.floor(c/3))conflicts.add(board[y][x]);}
  return Array.from({length:9},(_,i)=>({digit:i+1,note:userNotes.has(i+1),conflict:active&&conflicts.has(i+1)}));
 }
 return Object.freeze({validate,preferences,preview});
})();


(() => {
 const $=id=>document.getElementById(id), G=window.SudokuMobileGeometry,P=window.SudokuPickerPresentation;
 let gesture=null,gestureSeq=0,suppress=null,toastTimer;
 const preferences=()=>P.preferences({},innerWidth<=760);
 const modal=()=>document.getElementById('helpModal').style.display==='flex'||!!document.querySelector('dialog[open]');
 const inspectable=i=>!!playerGrid&&!aiAnimating&&!tracePaused&&!recoveryAwaitingContinue&&!modal()&&Number.isInteger(i)&&i>=0&&i<81;
 const eligible=i=>inspectable(i)&&!givenCells[Math.floor(i/9)][i%9]&&!playerGrid[Math.floor(i/9)][i%9];
 const key=()=>playerGrid?.flat().join('')+'|'+history.length+'|'+notesMode;
 const validGesture=g=>g.key===key()&&(g.mode==='picker'?eligible(g.index):inspectable(g.index)&&!!playerGrid[Math.floor(g.index/9)][g.index%9]);
 const mobile=()=>innerWidth<=760;
 function visibleBounds(){
  let left=0,top=0,right=innerWidth,bottom=innerHeight,win=window,ox=0,oy=0;
  try{while(true){const vv=win.visualViewport;left=Math.max(left,(vv?.offsetLeft||0)-ox);top=Math.max(top,(vv?.offsetTop||0)-oy);right=Math.min(right,(vv?.offsetLeft||0)+(vv?.width||win.innerWidth)-ox);bottom=Math.min(bottom,(vv?.offsetTop||0)+(vv?.height||win.innerHeight)-oy);
   if(win===win.parent)break;const frame=win.frameElement;if(!frame)return null;const r=frame.getBoundingClientRect();if(Math.abs(r.width-frame.offsetWidth)>.5||Math.abs(r.height-frame.offsetHeight)>.5)return null;ox+=r.left+frame.clientLeft;oy+=r.top+frame.clientTop;
   // Actual clipping ancestors, not the nominal iframe height.
   for(let p=frame.parentElement;p;p=p.parentElement){const cs=win.parent.getComputedStyle(p),b=p.getBoundingClientRect();if(/hidden|clip|auto|scroll/.test(cs.overflowX)){left=Math.max(left,b.left-ox);right=Math.min(right,b.right-ox);}if(/hidden|clip|auto|scroll/.test(cs.overflowY)){top=Math.max(top,b.top-oy);bottom=Math.min(bottom,b.bottom-oy);}}
   win=win.parent;
  }}catch(_){return null;}
  const safe=getComputedStyle($('uxSafeArea'));left+=parseFloat(safe.paddingLeft)||0;top+=parseFloat(safe.paddingTop)||0;right-=parseFloat(safe.paddingRight)||0;bottom-=parseFloat(safe.paddingBottom)||0;
  return G.rect(left+4,top+4,right-left-8,bottom-top-8);
 }
 function geometry(i,prefs=preferences()){return G.place([...$('grid').children].map(c=>c.getBoundingClientRect()),i,visibleBounds(),prefs);}
 function toast(text){let n=$('uxToast');n.textContent=text;n.hidden=false;const v=visibleBounds();if(v){n.style.left=v.left+'px';n.style.top=v.top+'px';}clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.hidden=true,2400);}
 function cancelGesture(consumed=false){const g=gesture;if(!g)return;gesture=null;gestureSeq++;clearTimeout(g.timer);$('uxPicker')?.remove();$('uxLoupe')?.remove();$('grid').classList.remove('ux-holding');$('grid').children[g.index]?.classList.remove('ux-origin');if(g.active||consumed)suppress={until:Date.now()+850,x:g.x,y:g.y};if(g.capture)try{$('grid').releasePointerCapture(g.id);}catch(_){} }
 function paintLoupe(g,x,y){
  const p=$('uxLoupe');if(!p)return;const i=g.cells.findIndex(r=>x>=r.left&&x<r.right&&y>=r.top&&y<r.bottom);
  p.dataset.outside=String(i<0);if(i<0){p.querySelector('.ux-loupe-title').textContent='Slide over the grid';return;}
  if(p.dataset.cell===String(i)){p.querySelector('.ux-loupe-title').textContent=`Magnifier · R${Math.floor(i/9)+1} C${i%9+1}`;return;}
  p.dataset.cell=String(i);p.querySelector('.ux-loupe-title').textContent=`Magnifier · R${Math.floor(i/9)+1} C${i%9+1}`;
  const view=p.querySelector('.ux-loupe-grid');view.replaceChildren();
  // Read only the player's visible values/Notes. Never consult solution,
  // candidates, proof/search, selection, history, review or assistance adapters.
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const r=Math.floor(i/9)+dy,c=i%9+dx,n=document.createElement('div');n.className='ux-loupe-cell'+(!dx&&!dy?' ux-loupe-focus':'');
   if(r<0||r>8||c<0||c>8)n.classList.add('ux-loupe-edge');
   else if(playerGrid[r][c])n.textContent=String(playerGrid[r][c]);
   else if(notes[r][c].size){const marks=document.createElement('div');marks.className='ux-loupe-notes';for(let d=1;d<=9;d++){const s=document.createElement('span');s.textContent=notes[r][c].has(d)?String(d):'';marks.appendChild(s);}n.appendChild(marks);}
   view.appendChild(n);
  }
 }
 function openLoupe(g){const v=visibleBounds();if(!v)return false;const width=Math.min(280,v.width-16,v.height-46),height=width+30;if(width<100)return false;
  const p=document.createElement('div');p.id='uxLoupe';p.className='ux-loupe';p.setAttribute('aria-hidden','true');p.style.cssText=`left:${v.left+(v.width-width)/2}px;top:${v.top+(v.height-height)/2}px;width:${width}px;height:${height}px;--ux-loupe-cell:${(width-28)/3}px`;
  p.innerHTML='<div class="ux-loupe-title"></div><div class="ux-loupe-grid"></div>';g.cells=[...$('grid').children].map(c=>c.getBoundingClientRect());document.body.appendChild(p);paintLoupe(g,g.x,g.y);return true;
 }
 function activate(token){const g=gesture;if(!g||g.token!==token||!validGesture(g)){cancelGesture();return;}
  if(g.mode==='loupe'){if(!openLoupe(g)){cancelGesture(true);return;}}
  else{
   const layout=geometry(g.index,g.preferences);if(!layout.ok){toast(layout.reason||'Use Numbers below');cancelGesture(true);return;}
   g.layout=layout;g.openX=g.x;g.openY=g.y;g.intentional=false;
   const marks=P.preview(playerGrid,g.index,notes[Math.floor(g.index/9)][g.index%9],currentDiff,g.preferences.assist);
   const p=document.createElement('div');p.id='uxPicker';p.className='ux-picker';p.setAttribute('role','presentation');p.style.cssText=`left:${layout.footprint.left+6}px;top:${layout.footprint.top+6}px;width:${layout.footprint.width-12}px;--ux-target:${layout.size}px`;
   p.innerHTML='<div class="ux-picker-title">Slide · release to enter</div><div class="ux-picker-grid">'+marks.map(m=>`<div class="ux-picker-digit${m.note?' user-note':''}${m.conflict?' conflict':''}" data-digit="${m.digit}">${m.digit}</div>`).join('')+'</div>';document.body.appendChild(p);$('grid').children[g.index].classList.add('ux-origin');
  }
  // Do not render/select mid-contact: render replaces Notes descendants which
  // may own the Touch target. Selection/transaction occurs only on valid release.
  g.active=true;$('grid').classList.add('ux-holding');if(g.kind==='pointer')try{$('grid').setPointerCapture(g.id);g.capture=true;}catch(_){}
 }
 function arm(index,id,x,y,kind,source){cancelGesture();suppress=null;if((kind==='touch'&&!mobile())||!inspectable(index))return;const mode=playerGrid[Math.floor(index/9)][index%9]?'loupe':'picker';if(mode==='picker'&&!eligible(index))return;const token=++gestureSeq;gesture={index,id,x,y,x0:x,y0:y,kind,source,mode,preferences:preferences(),key:key(),token,active:false};gesture.timer=setTimeout(()=>activate(token),300);}
 function hover(g,x,y){const t=g.layout.targets.find(t=>x>=t.left&&x<t.right&&y>=t.top&&y<t.bottom);return t?t.digit:0;}
 function move(x,y){const g=gesture;if(!g)return;g.x=x;g.y=y;if(!validGesture(g)){cancelGesture();return;}if(!g.active){if(Math.hypot(x-g.x0,y-g.y0)>10)cancelGesture();return;}if(g.mode==='loupe'){paintLoupe(g,x,y);return;}
  // Deliberate post-opening travel (8 CSS px), not accumulating small jitter.
  if(Math.hypot(x-g.openX,y-g.openY)>=8)g.intentional=true;
  g.hover=g.intentional?hover(g,x,y):0;$('uxPicker').querySelectorAll('[data-digit]').forEach(n=>n.classList.toggle('active',+n.dataset.digit===g.hover));
 }
 function commitPicker(g,digit){cancelGesture();if(digit){if(selectedCell!==g.index)selectCell(g.index,g.source,'picker');if(selectedCell===g.index)placeNumber(digit,g.source,true);}}
 function choosePinned(digit){const g=gesture;if(!g?.pinned)return;if(!validGesture(g)){cancelGesture();return;}commitPicker(g,digit);}
 function pinPicker(g){
  g.pinned=true;g.pinClickReady=false;const p=$('uxPicker');p.dataset.pinned='true';p.setAttribute('role','group');p.setAttribute('aria-label','Number picker');p.querySelector('.ux-picker-title').textContent='Choose a number · Esc';
  for(const n of p.querySelectorAll('[data-digit]')){const b=document.createElement('button');b.type='button';b.className=n.className;b.dataset.digit=n.dataset.digit;b.textContent=n.textContent;b.onclick=()=>choosePinned(+b.dataset.digit);n.replaceWith(b);}
  $('grid').classList.remove('ux-holding');if(g.capture){g.capture=false;try{$('grid').releasePointerCapture(g.id);}catch(_){}}
 }
 function release(x,y){const g=gesture;if(!g||g.pinned)return;g.x=x;g.y=y;
  if(g.kind==='pointer'&&g.active&&g.mode==='picker'&&!g.intentional&&validGesture(g)&&Math.hypot(x-g.openX,y-g.openY)<8){pinPicker(g);return;}
  const digit=g.active&&g.mode==='picker'&&g.intentional&&validGesture(g)?hover(g,x,y):0;commitPicker(g,digit);
 }

 const style=document.createElement('style');style.textContent=".ux-picker{position:fixed;z-index:1100;background:#0b1423;color:#fff;border:2px solid #00e5ff;border-radius:10px;padding:8px;box-shadow:0 0 0 6px #020409;user-select:none;-webkit-user-select:none;pointer-events:none}\n.ux-picker[data-pinned=true]{pointer-events:auto}.ux-picker[data-pinned=true] .ux-picker-digit{padding:0;cursor:pointer}.ux-picker-digit:focus-visible{outline:2px solid #00e5ff;outline-offset:1px}.ux-picker-title{height:24px;font:600 14px/20px system-ui;white-space:nowrap;overflow:hidden}\n.ux-picker-grid{display:grid;grid-template-columns:repeat(3,var(--ux-target));grid-template-rows:repeat(3,var(--ux-target));gap:4px}\n.ux-picker-digit{position:relative;display:flex;align-items:center;justify-content:center;border:1px solid #547186;border-radius:6px;font:700 calc(var(--ux-target)*.5)/1 ui-monospace,monospace;background:#152339;color:#fff}\n.ux-picker-digit.user-note{color:#9defff}\n.ux-picker-digit.user-note::after{content:'';position:absolute;bottom:4px;width:5px;height:5px;border-radius:50%;background:#9defff}\n.ux-picker-digit.conflict{color:#8c98a9}\n.ux-picker-digit.active{background:#23586a;border:2px solid #00e5ff;box-shadow:inset 0 0 0 1px #9defff}\n.ux-setting{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin:10px 0;font:16px/1.5 system-ui}\n.ux-setting select{max-width:100%;min-height:44px;padding:6px 8px;background:#101c2e;color:var(--text);border:1px solid var(--border2);border-radius:5px;font:16px/1.4 system-ui}\n#uxDesktopSettings{margin-top:8px;width:100%;font-size:14px}\n#grid{-webkit-user-select:none;user-select:none}\n#grid.ux-holding{-webkit-touch-callout:none;user-select:none;-webkit-user-select:none}\n.ux-origin{outline:2px solid var(--cyan);outline-offset:-3px}\n.ux-loupe{position:fixed;box-sizing:border-box;z-index:1100;padding:10px;border:2px solid #00e5ff;border-radius:12px;background:#0b1423;color:#fff;box-shadow:0 8px 32px #000b;pointer-events:none;user-select:none;-webkit-user-select:none}\n.ux-loupe-title{height:24px;margin-bottom:6px;font:600 13px/24px system-ui;text-align:center}\n.ux-loupe-grid{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);aspect-ratio:1;background:#547186;gap:2px}\n.ux-loupe-cell{display:flex;align-items:center;justify-content:center;min-width:0;min-height:0;background:#152339;color:#fff;font:700 calc(var(--ux-loupe-cell)*.60)/1 ui-monospace,monospace}\n.ux-loupe-focus{outline:3px solid #00e5ff;outline-offset:-3px;background:#214558}.ux-loupe-edge{background:#0b1423}\n.ux-loupe-notes{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);width:90%;height:90%;font:600 calc(var(--ux-loupe-cell)*.23)/1 ui-monospace,monospace;color:#b7cce4}\n.ux-loupe-notes span{display:flex;align-items:center;justify-content:center}.ux-loupe[data-outside=true] .ux-loupe-grid{opacity:.4}\n\n.ux-safe-area{position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}.ux-toast{position:fixed;z-index:1101;max-width:330px;padding:10px;background:#0b1423;color:#fff;border:1px solid #547186;border-radius:8px;font:14px/1.4 system-ui;pointer-events:none}";document.head.append(style);
 for(const [id,cls] of [['uxSafeArea','ux-safe-area'],['uxToast','ux-toast']]){const el=document.createElement('div');el.id=id;el.className=cls;if(id==='uxToast'){el.hidden=true;el.setAttribute('role','status');}document.body.append(el);}
 const grid=$('grid');
 grid.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')return;if(gesture||e.isPrimary===false||e.button!==0){cancelGesture();return;}const c=e.target.closest('.cell');if(c)arm(+c.dataset.index,e.pointerId,e.clientX,e.clientY,'pointer','pointer');});
 document.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')return;if(gesture?.pinned){if(e.target.closest('#uxPicker')){gesture.pinClickReady=true;return;}cancelGesture();}if(e.isPrimary===false)cancelGesture();if(!gesture)suppress=null;},true);
 document.addEventListener('pointermove',e=>{if(gesture?.pinned||gesture?.kind!=='pointer'||gesture.id!==e.pointerId)return;if(e.buttons!==1){cancelGesture();return;}move(e.clientX,e.clientY);});
 document.addEventListener('pointerup',e=>{if(gesture?.kind==='pointer'&&gesture.id===e.pointerId)release(e.clientX,e.clientY);});
 document.addEventListener('pointercancel',()=>cancelGesture());grid.addEventListener('lostpointercapture',()=>{if(!gesture?.pinned)cancelGesture();});
 document.addEventListener('click',e=>{if(gesture?.pinned&&!gesture.pinClickReady&&e.detail!==0){e.preventDefault();e.stopImmediatePropagation();return;}if(suppress&&Date.now()<suppress.until&&e.detail!==0&&(e.target.closest('#grid')||Math.hypot(e.clientX-suppress.x,e.clientY-suppress.y)<32)){e.preventDefault();e.stopImmediatePropagation();suppress=null;}},true);
 document.addEventListener('keydown',e=>{if(gesture?.pinned&&/^[1-9]$/.test(e.key)){e.preventDefault();e.stopImmediatePropagation();choosePinned(+e.key);return;}if(gesture?.pinned&&e.target.closest?.('#uxPicker')&&['Enter',' ','Tab'].includes(e.key))return;if(gesture){const active=gesture.active;cancelGesture();if(active||e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();}}},true);
 for(const event of ['blur','scroll','resize','pagehide'])window.addEventListener(event,()=>cancelGesture());
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelGesture();});
 window.SudokuCurrentHold={cancel:cancelGesture,geometry};
 const help=document.querySelector('#helpModal>div');
 if(help){const p=document.createElement('p');p.textContent='Hold an empty cell for 300 ms, then move at least 8 px to a digit and release. On desktop, release without sliding to keep the picker open, then click a number. Escape or an outside click closes it. Touch holds without sliding and releases in gaps cancel. Hold a filled cell for a read-only magnifier.';help.append(p);}
})();
