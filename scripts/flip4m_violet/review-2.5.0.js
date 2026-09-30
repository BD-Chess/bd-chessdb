/* Flip4M APP Review 2.5.0
 * Read-only review overlay inspired by ChessBest and 8zSudoku.
 * It reads the saved Flip4M session snapshot, pauses the live game,
 * paints historical positions in the existing board DOM, and restores
 * the exact live DOM on exit. It never changes F4MLab session history.
 */
(function(root){
'use strict';
const doc=root.document,$=id=>doc.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let api=null,E=null,active=false,data=null,index=0,playing=false,timer=0,liveDom=null,markerSteps=[];
const SIDES=['top','right','bottom','left'];

const TXT={
 sl:{
  review:'Pregled',title:'Pregled igre',start:'Začetni položaj',position:'Položaj',
  close:'Nazaj v igro',history:'Zgodovina / JSON',first:'Prvi položaj',prev:'Prejšnja poteza',
  play:'Predvajaj pregled',pause:'Premor pregleda',next:'Naslednja poteza',last:'Zadnji položaj',
  red:'Rdeči',yellow:'Rumeni',human:'Človek',classical:'Classical AI',dcc:'AI + DCC',
  drop:'Spusti',flipL:'Obrat levo',flipR:'Obrat desno',magnet:'Magnet',
  noAnalysis:'Za to potezo ni shranjene AI analize.',analysis:'Shranjena analiza',
  agree:'Classical in DCC sta izbrala isto potezo',differ:'Classical in DCC sta izbrala različni potezi',
  depth:'globina',nodes:'vozlišč',think:'razmišljanje',seconds:'s',rawGap:'raw razlika',
  moved:'premikov figur',tool:'poraba orodja',magPlaced:'magnet postavljen',
  magRemoved:'magnet odstranjen',magRefreshed:'magnet osvežen',magExpired:'magnet potekel',
  events:'Zanimivi dogodki',noEvents:'Brez posebnih oznak v tej partiji.',
  originalSafe:'Pregled je samo za branje. Igra ostane na prvotnem položaju; za nadaljevanje po izhodu pritisni Nadaljuj.',
  current:'Trenutno',final:'Konec',reviewing:'Pregled',noMoves:'Ni še potez za pregled.',
  dccRank:'DCC rank',thrift:'varčnost',stability:'stabilnost',unknown:'ni podatka'
 },
 en:{
  review:'Review',title:'Game review',start:'Starting position',position:'Position',
  close:'Back to game',history:'History / JSON',first:'First position',prev:'Previous move',
  play:'Play review',pause:'Pause review',next:'Next move',last:'Last position',
  red:'Red',yellow:'Yellow',human:'Human',classical:'Classical AI',dcc:'AI + DCC',
  drop:'Drop',flipL:'Rotate left',flipR:'Rotate right',magnet:'Magnet',
  noAnalysis:'No stored AI analysis for this move.',analysis:'Stored analysis',
  agree:'Classical and DCC selected the same move',differ:'Classical and DCC selected different moves',
  depth:'depth',nodes:'nodes',think:'think',seconds:'s',rawGap:'raw gap',
  moved:'piece movements',tool:'tool spent',magPlaced:'magnet placed',
  magRemoved:'magnet removed',magRefreshed:'magnet refreshed',magExpired:'magnet expired',
  events:'Interesting events',noEvents:'No special markers in this game.',
  originalSafe:'Review is read-only. The game stays at its original position; after leaving review press Continue to resume.',
  current:'Current',final:'Final',reviewing:'Review',noMoves:'No moves to review yet.',
  dccRank:'DCC rank',thrift:'thrift',stability:'stability',unknown:'unknown'
 }
};
const lang=()=>doc.documentElement.lang==='en'?'en':'sl',tt=k=>TXT[lang()][k]||k;
function sideText(side){return lang()==='sl'?['zgoraj','desno','spodaj','levo'][side]:['top','right','bottom','left'][side];}
function actor(side){
 const g=data?.game||{};
 let p='human';
 if(g.mode==='demo')p=g.policies?.[side]||'classical';
 else if(g.mode==='cpu')p=side===g.human?'human':(g.engine||'classical');
 return (side===1?tt('red'):tt('yellow'))+' · '+(p==='human'?tt('human'):p==='dcc'?tt('dcc'):tt('classical'));
}
function fmt(a){
 if(!a)return '—';
 if(a.type==='drop')return tt('drop')+' '+(Number(a.col)+1);
 if(a.type==='flip')return a.delta===1?tt('flipL'):tt('flipR');
 if(a.type==='magnet')return tt('magnet')+' · '+sideText(Number(a.side))+' '+(Number(a.idx)+1);
 return a.type||'—';
}
function piece(p,r,c,focus=false){
 const el=doc.createElement('div');el.className='piece p'+p+(focus?' review-focus':'');
 el.style.top=(r*12.5)+'%';el.style.left=(c*12.5)+'%';
 const disc=doc.createElement('div');disc.className='disc';el.append(disc);return el;
}
function magnetMap(s){
 const out=[];
 for(let side=0;side<4;side++)for(let i=0;i<8;i++){
  const m=s?.mag?.[SIDES[side]]?.[i]||null;
  out.push(m?{side,idx:i,p:m.p,life:m.life}:null);
 }
 return out;
}
function magDiff(prev,next,action){
 const a=magnetMap(prev),b=magnetMap(next),events=[];
 for(let i=0;i<32;i++){
  const x=a[i],y=b[i]; if(JSON.stringify(x)===JSON.stringify(y))continue;
  const slot=y||x;if(!slot)continue;
  if(!x&&y)events.push({kind:'placed',...slot});
  else if(x&&!y){
   const opposite=action?.type==='magnet'&&action.idx===x.idx&&((action.side+2)%4)===x.side;
   events.push({kind:opposite?'removed':'expired',...x});
  }else if(x&&y&&x.p===y.p&&y.life>x.life)events.push({kind:'refreshed',...y});
 }
 return events;
}
function pathsFor(prev,action){
 if(!prev||!action||!E?.action)return[];
 try{return (E.action(JSON.parse(JSON.stringify(prev)),action,true)?.paths||[]);}catch(_){return[];}
}
function selectedRank(bundle){
 const sel=bundle?.dcc?.selected;if(!sel)return null;
 return (bundle.dcc.ranks||[]).find(x=>x.id===sel.id)||null;
}
function num(v,d=2){return Number.isFinite(v)?Number(v).toFixed(d):tt('unknown');}
function analysisHTML(record){
 const b=record?.analysis;
 if(!b)return '<p class="review-empty">'+tt('noAnalysis')+'</p>';
 const r=b.report||{},ca=b.classical?.selected,dc=b.dcc?.selected,rank=selectedRank(b);
 const same=ca?.id&&dc?.id?ca.id===dc.id:null;
 const chips=[];
 if(Number.isFinite(r.depth))chips.push('<span>'+tt('depth')+' <b>'+r.depth+'</b></span>');
 if(Number.isFinite(r.nodes))chips.push('<span>'+tt('nodes')+' <b>'+Number(r.nodes).toLocaleString()+'</b></span>');
 const ms=Number.isFinite(record?.think_ms)&&record.think_ms>0?record.think_ms:b.total_ms;
 if(Number.isFinite(ms))chips.push('<span>'+tt('think')+' <b>'+(ms/1000).toFixed(2)+' '+tt('seconds')+'</b></span>');
 if(Number.isFinite(b.dcc?.rawGap))chips.push('<span>'+tt('rawGap')+' <b>'+num(b.dcc.rawGap,1)+'</b></span>');
 if(rank){
  chips.push('<span>GS <b>'+num(rank.gs,2)+'</b></span>');
  chips.push('<span>MR <b>'+num(rank.mr,2)+'</b></span>');
  chips.push('<span>'+tt('thrift')+' <b>'+num(rank.thrift,2)+'</b></span>');
  if(Number.isFinite(rank.depthStability?.volatility))chips.push('<span>'+tt('stability')+' <b>'+num(rank.depthStability.volatility,1)+'</b></span>');
  if(Number.isFinite(rank.rankScore))chips.push('<span>'+tt('dccRank')+' <b>'+num(rank.rankScore,1)+'</b></span>');
 }
 const choice=same===null?'':('<p class="review-choice '+(same?'same':'different')+'">'+(same?tt('agree'):tt('differ'))+
  (ca?.move?' · C: '+fmt(ca.move):'')+(dc?.move?' · D: '+fmt(dc.move):'')+'</p>');
 return '<div class="review-analysis"><strong>'+tt('analysis')+'</strong><div class="review-chips">'+chips.join('')+'</div>'+choice+'</div>';
}
function captureDom(){
 const rim=[...doc.querySelectorAll('#rim .mag-slot')].map(b=>({className:b.className,disabled:b.disabled,aria:b.getAttribute('aria-label'),title:b.title,life:b.querySelector('.mag-life')?.textContent||''}));
 const cells=[...doc.querySelectorAll('#matrix .cell')].map(b=>({className:b.className,disabled:b.disabled,aria:b.getAttribute('aria-label')}));
 return{
  angle:doc.documentElement.style.getPropertyValue('--angle'),
  pieces:$('pieces').innerHTML,ghost:$('ghost').innerHTML,
  status:$('status').textContent,gravity:$('gravity').textContent,ply:$('ply').textContent,
  feedback:$('feedback').textContent,instruction:$('instruction').textContent,
  resources1:$('resources1').textContent,resources2:$('resources2').textContent,
  p1:$('player1').className,p2:$('player2').className,
  outcomeHidden:$('outcome').hidden,outcomeTitle:$('outcomeTitle').textContent,outcomeText:$('outcomeText').textContent,
  rim,cells
 };
}
function restoreDom(){
 if(!liveDom)return;
 doc.documentElement.style.setProperty('--angle',liveDom.angle);
 $('pieces').innerHTML=liveDom.pieces;$('ghost').innerHTML=liveDom.ghost;
 $('status').textContent=liveDom.status;$('gravity').textContent=liveDom.gravity;$('ply').textContent=liveDom.ply;
 $('feedback').textContent=liveDom.feedback;$('instruction').textContent=liveDom.instruction;
 $('resources1').textContent=liveDom.resources1;$('resources2').textContent=liveDom.resources2;
 $('player1').className=liveDom.p1;$('player2').className=liveDom.p2;
 $('outcome').hidden=liveDom.outcomeHidden;$('outcomeTitle').textContent=liveDom.outcomeTitle;$('outcomeText').textContent=liveDom.outcomeText;
 [...doc.querySelectorAll('#rim .mag-slot')].forEach((b,i)=>{const x=liveDom.rim[i];if(!x)return;b.className=x.className;b.disabled=x.disabled;x.aria==null?b.removeAttribute('aria-label'):b.setAttribute('aria-label',x.aria);b.title=x.title;const life=b.querySelector('.mag-life');if(life)life.textContent=x.life;});
 [...doc.querySelectorAll('#matrix .cell')].forEach((b,i)=>{const x=liveDom.cells[i];if(!x)return;b.className=x.className;b.disabled=x.disabled;x.aria==null?b.removeAttribute('aria-label'):b.setAttribute('aria-label',x.aria);});
}
function renderBoard(i,pulse=false){
 const s=data.states[i],prev=i?data.states[i-1]:null,a=i?data.moves[i-1]:null;
 const paths=pathsFor(prev,a),focus=new Set(paths.map(x=>Number(x.toR)*8+Number(x.toC)).filter(Number.isFinite));
 doc.documentElement.style.setProperty('--angle',(-Number(s.gravityDir||0)*90)+'deg');
 $('pieces').replaceChildren();$('ghost').replaceChildren();
 for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(s.grid[r][c])$('pieces').append(piece(s.grid[r][c],r,c,pulse&&focus.has(r*8+c)));
 const wins=E.winningLines?E.winningLines(s.grid).filter(x=>x.p===s.result).flatMap(x=>x.cells.map(([r,c])=>r*8+c)):[];
 [...doc.querySelectorAll('#matrix .cell')].forEach((b,k)=>{
  const r=k>>3,c=k%8,changed=!!prev&&prev.grid[r][c]!==s.grid[r][c];
  b.className='cell'+(wins.includes(k)?' winning':'')+(changed?' review-changed':'');b.disabled=true;
 });
 const md=magDiff(prev,s,a);
 [...doc.querySelectorAll('#rim .mag-slot')].forEach((b,k)=>{
  const side=Number(b.dataset.side),idx=Number(b.dataset.idx),m=s.mag?.[SIDES[side]]?.[idx]||null;
  const changed=md.some(x=>x.side===side&&x.idx===idx);
  b.className='mag-slot '+(m?'owned'+m.p:'empty')+(m?.life===1?' expiring':'')+(changed?' review-changed':'');
  const life=b.querySelector('.mag-life');if(life)life.textContent=m?m.life:'';
  b.disabled=true;
 });
 $('resources1').textContent='↶ '+s.tokens[1].flip+'  ·  ⊓ '+s.tokens[1].mag;
 $('resources2').textContent='↶ '+s.tokens[2].flip+'  ·  ⊓ '+s.tokens[2].mag;
 $('player1').classList.toggle('active',!s.result&&s.curPlayer===1);$('player2').classList.toggle('active',!s.result&&s.curPlayer===2);
 $('status').textContent=tt('reviewing')+' · '+i+' / '+(data.states.length-1);
 $('gravity').textContent='G '+['↓','←','↑','→'][s.gravityDir||0];$('ply').textContent=i===0?tt('start'):tt('position')+' '+i;
 $('instruction').textContent=tt('originalSafe');$('feedback').textContent='';
 $('outcome').hidden=!s.result;if(s.result){$('outcomeTitle').textContent=s.result===3?'Draw / Remi':(s.result===1?tt('red'):tt('yellow'));$('outcomeText').textContent=tt('final');}
 return{paths,magEvents:md};
}
function markerKind(i){
 if(i<=0)return[];
 const a=data.moves[i-1],r=data.records[i-1],prev=data.states[i-1],s=data.states[i],out=[];
 if(a?.type==='flip')out.push({label:a.delta===1?'↶':'↷',title:fmt(a)});
 if(a?.type==='magnet')out.push({label:'⊓',title:fmt(a)});
 const md=magDiff(prev,s,a);if(md.some(x=>x.kind==='expired'))out.push({label:'M−',title:tt('magExpired')});
 if(r?.analysis?.dcc?.changed)out.push({label:'DCC',title:tt('differ')});
 if(s.result)out.push({label:'★',title:tt('final')});
 return out;
}
function buildMarkers(){
 markerSteps=[];const host=$('f4mReviewMarkers');host.replaceChildren();
 for(let i=1;i<data.states.length;i++){
  const kinds=markerKind(i);if(!kinds.length)continue;markerSteps.push(i);
  const b=doc.createElement('button');b.type='button';b.className='review-marker';b.dataset.step=String(i);b.textContent=i+' '+kinds.map(x=>x.label).join(' ');
  b.title=kinds.map(x=>x.title).join(' · ');b.onclick=()=>{pausePlay();paint(i,true);};host.append(b);
 }
 $('f4mReviewEventsEmpty').hidden=markerSteps.length>0;
}
function detailHTML(i,calc){
 if(i===0)return '<div class="review-move"><strong>'+tt('start')+'</strong><p>'+tt('originalSafe')+'</p></div>';
 const a=data.moves[i-1],prev=data.states[i-1],s=data.states[i],record=data.records[i-1]||{},side=prev.curPlayer;
 const bits=[];
 if(calc.paths.length)bits.push(calc.paths.length+' '+tt('moved'));
 const before=prev.tokens?.[side]||{},after=s.tokens?.[side]||{};
 const usedFlip=Math.max(0,(before.flip||0)-(after.flip||0)),usedMag=Math.max(0,(before.mag||0)-(after.mag||0));
 if(usedFlip||usedMag)bits.push(tt('tool')+': '+(usedFlip?'↶ '+usedFlip:'')+(usedFlip&&usedMag?' · ':'')+(usedMag?'⊓ '+usedMag:''));
 for(const e of calc.magEvents){
  const key=e.kind==='placed'?'magPlaced':e.kind==='removed'?'magRemoved':e.kind==='refreshed'?'magRefreshed':'magExpired';
  bits.push(tt(key)+' · '+sideText(e.side)+' '+(e.idx+1)+(Number.isFinite(e.life)?' · '+e.life:''));
 }
 const time=Number.isFinite(record.think_ms)&&record.think_ms>0?' · '+tt('think')+' '+(record.think_ms/1000).toFixed(2)+' '+tt('seconds'):'';
 return '<div class="review-move"><strong>#'+i+' · '+actor(side)+' · '+fmt(a)+'</strong><p>'+bits.join(' · ')+time+'</p></div>'+analysisHTML(record);
}
function paint(i,pulse=false){
 if(!active||!data)return;index=Math.max(0,Math.min(data.states.length-1,Number(i)||0));
 const calc=renderBoard(index,pulse);
 $('f4mReviewCount').textContent=index+' / '+(data.states.length-1);
 $('f4mReviewSlider').max=String(data.states.length-1);$('f4mReviewSlider').value=String(index);
 $('f4mReviewDetail').innerHTML=detailHTML(index,calc);
 $('f4mReviewFirst').disabled=index===0;$('f4mReviewPrev').disabled=index===0;
 $('f4mReviewNext').disabled=index>=data.states.length-1;$('f4mReviewLast').disabled=index>=data.states.length-1;
 for(const b of doc.querySelectorAll('.review-marker'))b.classList.toggle('current',Number(b.dataset.step)===index);
 $('f4mReviewPlay').textContent=playing?'Ⅱ':'▶';$('f4mReviewPlay').setAttribute('aria-label',playing?tt('pause'):tt('play'));
}
function pausePlay(){playing=false;clearTimeout(timer);timer=0;if(active)paint(index);}
function tick(){if(!playing||!active)return;if(index>=data.states.length-1){pausePlay();return;}paint(index+1,true);timer=setTimeout(tick,index>=data.states.length-1?250:700);}
function play(){if(!active||data.states.length<2)return;if(playing){pausePlay();return;}if(index>=data.states.length-1)paint(0);playing=true;paint(index);timer=setTimeout(tick,220);}
function setTabs(review){
 const tab=$('tab-review'),board=$('tab-board');
 if(review){for(const t of $('workspaceTabs').querySelectorAll('[data-view-tab]'))t.setAttribute('aria-selected',String(t===tab));}
 else if(board){for(const t of $('workspaceTabs').querySelectorAll('[data-view-tab]'))t.setAttribute('aria-selected',String(t===board));}
}
async function openReview(){
 if(active||!api||api.status().loading)return;
 api.pause();await sleep(0);
 data=api.snapshot();liveDom=captureDom();index=Math.min(Number(data.cursor)||0,data.states.length-1);
 active=true;doc.body.dataset.f4mReview='true';$('f4mReview').hidden=false;setTabs(true);buildMarkers();paint(index);
 $('f4mReview').scrollIntoView({block:'nearest',behavior:'smooth'});
}
function closeReview(){
 if(!active)return;pausePlay();restoreDom();active=false;data=null;delete doc.body.dataset.f4mReview;$('f4mReview').hidden=true;setTabs(false);
 $('feedback').textContent=tt('originalSafe');
 root.dispatchEvent(new Event('resize'));
}
function translate(){
 $('tab-review-label').textContent=tt('review');$('f4mReviewTitle').textContent=tt('title');
 $('f4mReviewClose').textContent=tt('close');$('f4mReviewHistory').textContent=tt('history');
 $('f4mReviewFirst').setAttribute('aria-label',tt('first'));$('f4mReviewPrev').setAttribute('aria-label',tt('prev'));
 $('f4mReviewNext').setAttribute('aria-label',tt('next'));$('f4mReviewLast').setAttribute('aria-label',tt('last'));
 $('f4mReviewEventsTitle').textContent=tt('events');$('f4mReviewEventsEmpty').textContent=tt('noEvents');
 if(active){buildMarkers();paint(index);}
}
function makeUI(){
 const tabs=$('workspaceTabs'),history=$('tab-history');
 const tab=doc.createElement('button');tab.id='tab-review';tab.type='button';tab.setAttribute('role','tab');tab.dataset.viewTab='review';tab.setAttribute('aria-selected','false');
 tab.innerHTML='<small aria-hidden="true">◫</small><span id="tab-review-label">Review</span>';tabs.insertBefore(tab,history);
 const panel=doc.createElement('section');panel.id='f4mReview';panel.className='f4m-review';panel.hidden=true;panel.setAttribute('aria-label','Flip4M game review');
 panel.innerHTML=
  '<div class="review-head"><strong id="f4mReviewTitle">Game review</strong><span id="f4mReviewCount">0 / 0</span></div>'+
  '<div id="f4mReviewDetail" class="review-detail"></div>'+
  '<input id="f4mReviewSlider" class="review-slider" type="range" min="0" max="0" value="0" aria-label="Review position">'+
  '<div class="review-nav" aria-label="Review navigation">'+
   '<button id="f4mReviewFirst" type="button" aria-label="First position">|◀</button>'+
   '<button id="f4mReviewPrev" type="button" aria-label="Previous move">◀</button>'+
   '<button id="f4mReviewPlay" type="button" aria-label="Play review">▶</button>'+
   '<button id="f4mReviewNext" type="button" aria-label="Next move">▶</button>'+
   '<button id="f4mReviewLast" type="button" aria-label="Last position">▶|</button>'+
  '</div>'+
  '<div class="review-events"><strong id="f4mReviewEventsTitle">Interesting events</strong><div id="f4mReviewMarkers" class="review-markers"></div><p id="f4mReviewEventsEmpty" class="review-empty"></p></div>'+
  '<div class="review-foot"><button id="f4mReviewClose" type="button">Back to game</button><button id="f4mReviewHistory" type="button">History / JSON</button></div>';
 $('arena').after(panel);
 tab.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openReview();},true);
 for(const other of tabs.querySelectorAll('[data-view-tab]:not(#tab-review)'))other.addEventListener('click',()=>{if(active)closeReview();},true);
 $('f4mReviewFirst').onclick=()=>{pausePlay();paint(0,true);};$('f4mReviewPrev').onclick=()=>{pausePlay();paint(index-1,true);};
 $('f4mReviewPlay').onclick=play;$('f4mReviewNext').onclick=()=>{pausePlay();paint(index+1,true);};$('f4mReviewLast').onclick=()=>{pausePlay();paint(data?.states.length-1||0,true);};
 $('f4mReviewSlider').oninput=e=>{pausePlay();paint(Number(e.target.value),true);};
 $('f4mReviewClose').onclick=closeReview;$('f4mReviewHistory').onclick=openHistory;
 root.addEventListener('keydown',e=>{
  if(!active||e.ctrlKey||e.altKey||e.metaKey||e.target?.closest?.('input:not(#f4mReviewSlider),select,textarea,[contenteditable=true],dialog[open]'))return;
  const map={ArrowLeft:()=>{pausePlay();paint(index-1,true);},ArrowRight:()=>{pausePlay();paint(index+1,true);},Home:()=>{pausePlay();paint(0,true);},End:()=>{pausePlay();paint(data.states.length-1,true);},' ':play,Escape:closeReview};
  const fn=map[e.key];if(fn){e.preventDefault();e.stopImmediatePropagation();fn();}
 },true);
 doc.addEventListener('f4m:language',translate);
 root.addEventListener('pagehide',()=>{if(active)closeReview();});
 translate();
}
async function boot(){
 for(let i=0;i<120;i++){api=root.F4MLab;E=root.F4M;if(api&&E&&!api.status().loading)break;await sleep(50);}
 if(!api||!E)return;makeUI();root.F4MReview=Object.freeze({open:openReview,close:closeReview,active:()=>active,index:()=>index,count:()=>data?.states?.length||0});
}
if(doc.readyState==='complete')boot();else root.addEventListener('load',boot,{once:true});
})(window);
