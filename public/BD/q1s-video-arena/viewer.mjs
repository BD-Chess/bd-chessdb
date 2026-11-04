import {upperBound,pathForDisplay,sampleAt,lineEnvelope,candlesForWindow,loadVerified,hhmmss} from './replay-core.mjs';

const $ = id => document.getElementById(id);
const base = new URL('.',import.meta.url);
const root = document.documentElement;
const original = Object.fromEntries([...document.querySelectorAll('[data-t]')].map(el=>[el.dataset.t,el.textContent]));
const english = {
  skip:'Skip to replay',hub:'Trading index',archive:'COMPLETED RUN · 4 NOV 2026',title:'See how the simulation traded.',
  lead:'Replay of the saved simulation on one-second data. Virtual money, historical market.',readOnly:'ARCHIVE · READ ONLY',loading:'Loading verified results…',
  policy:'Recorded variant',b00:'C00 · synthetic 200×',a07:'C07 · comparison candidate 1×',a00:'C00 · initial variant 1×',cost:'Recorded cost scenario',
  c0:'C0 · 0 entry fee / 0 exit fee',c1:'C1 · assumed costs',c2:'C2 · higher assumed costs',wallet:'Wallet · booked cash',equity:'Net account equity',
  virtualUsdt:'virtual USDT',netExplanation:'including open positions and modeled exit friction',return:'Net equity return',from100:'from an initial 100 USDT',
  drawdown:'Maximum drawdown up to this time',sampledDd:'sampled at events / completed bars',play:'▶ Play',pause:'Ⅱ Pause',begin:'Beginning',speed:'Speed',
  timeline:'Time in the completed TEST period',jump:'Jump to:',jumpMark:'first +50% marked equity',jumpFlat:'first +50% fully closed wallet',jumpDd:'maximum drawdown',end:'End',
  price:'Price and simulated executions',window:'Window',increase:'entry / addition',reduce:'reduction / stop',accountPath:'Virtual account path',
  wholeTest:'Full 48 hours · shown up to the selected time',equityShort:'net equity',initial:'initial 100',positions:'Open virtual positions',
  unrealized:'Unrealized PnL before modeled exit',closedCycles:'Closed cycles up to this time',executions:'Latest simulated executions',
  executionsNote:'Actual arena records up to the selected time. Partial fills are separate.',time:'Time UTC',action:'Event',leg:'Book',fillPrice:'Price USDT',fee:'Fee USDT',cycle:'Cycle',
  noFills:'No executions yet at this time.',finalResult:'Final result of the selected path',finalNote:'The final outcome remains visible while replaying history.',
  variant:'Variant',scenario:'Scenario',finalEquity:'Final net equity',maxDd:'Maximum drawdown',scope:'What this view establishes',
  scopeText:'This is a saved BTC test with a synthetic account. It is not a reconstruction of MEXC/APT video trades or proof of outperforming BD. C0 sets fees, slippage and funding to zero; C1/C2 are additional assumed scenarios. Natural terminal positions are preserved. Replay does not run a strategy or send orders.',
  sources:'Sources, dates and data verification',sourceText:'65 evaluations: 32 TRAIN, 16 VAL, 8 ORIGINAL and 9 TEST. TEST uses a previously selected volatile BTC week that was also used in older research. It was not used to select candidates in this new search.',
  numericText:'Charts and formatted numbers use display precision. Original accounting uses Decimal; source values and hashes remain in the evidence package.',
  report:'Final report',evidence:'Evidence package',index:'Index of displayed paths',footer:'The completed run is preserved. This page only displays its records.'
};
let lang = 'sl', meta, current, market, cursor = 172800, playing = false, requestId = 0, lastFrame = 0, lastPaint = 0;
let loaded = false, animation = 0;
const cache = new Map();
let marketPromise;
try { lang = localStorage.getItem('bd-q1s-replay-language-v1') || 'sl'; root.dataset.theme = localStorage.getItem('bd-q1s-replay-theme-v1') || 'dark'; } catch {}
if (!['sl','en'].includes(lang)) lang='sl';
const text = (sl,en) => lang === 'sl' ? sl : en;
const t = key => lang === 'en' ? english[key] || original[key] || key : original[key] || key;
const locale = () => lang === 'sl' ? 'sl-SI' : 'en-GB';
const number = (value,places=2) => Number.isFinite(Number(value)) ? new Intl.NumberFormat(locale(),{maximumFractionDigits:places}).format(Number(value)) : '—';
function money(value) { const n=Number(value); if (!Number.isFinite(n)) return '—'; return n!==0 && Math.abs(n)<1e-8 ? n.toExponential(5) : number(n,n!==0 && Math.abs(n)<.001 ? 10 : 6); }
const percent = (value,digits=2) => number(value,Math.abs(Number(value))>99.99&&Math.abs(Number(value))<100?Math.max(digits,8):digits)+' %';
const stamp = sec => new Intl.DateTimeFormat(locale(),{timeZone:'UTC',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(meta.start_ms+sec*1000))+' UTC';
function setLanguage() {
  root.lang=lang;
  for (const el of document.querySelectorAll('[data-t]')) el.textContent=t(el.dataset.t);
  $('language').textContent=lang==='sl'?'EN':'SL';
  $('language').setAttribute('aria-label',lang==='sl'?'English':'Slovenščina');
  $('play').textContent=t(playing?'pause':'play');
  $('price-chart').setAttribute('aria-label',text('Zgodovinske sveče in simulirane izvršitve','Historical candles and simulated executions'));
  $('account-chart').setAttribute('aria-label',text('Wallet in neto vrednost virtualnega računa','Wallet and net equity of the virtual account'));
  if (loaded) { scenarioCopy(); comparison(); finalResult(); render(); }
}
function scenarioCopy() {
  const trial=current.trial,cost=meta.costs[trial.scenario];
  $('cost-note').textContent=trial.scenario==='C0'
    ? text('Vstop 0 fee · izstop 0 fee. Tudi modelirani zdrs in funding sta 0.','Entry fee 0 · exit fee 0. Modeled slippage and funding are also 0.')
    : text(`Predpostavka: ${cost.fee_bps} bps fee + ${cost.slip_bps} bps zdrsa na izvršitev; funding ${cost.carry_bps_8h} bps/8 h. Ni MEXC tarifa.`,`Assumption: ${cost.fee_bps} bps fee + ${cost.slip_bps} bps slippage per fill; funding ${cost.carry_bps_8h} bps/8h. Not a MEXC tariff.`);
  $('load-status').textContent=text('Podatki preverjeni · shranjeni tek, brez povezave z borzo.','Data verified · saved run, no exchange connection.');
  $('integrity').textContent=text('SHA-256 preverjen za cene, pot računa in izvršitve izbrane različice.','SHA-256 verified for prices, account path and executions of the selected variant.');
}
function pause() { playing=false; cancelAnimationFrame(animation); $('play').textContent=t('play'); }
function seek(seconds) { cursor=Math.max(0,Math.min(meta.duration_seconds,seconds)); $('timeline').value=String(Math.floor(cursor)); render(); }
function enableTransport(enabled) { for (const id of ['play','begin','previous','next','timeline','end','jump-dd']) $(id).disabled=!enabled; }
function clearDisplay() {
  for(const key of ['wallet','equity','return','drawdown','positions','unrealized','cycles-count','fills-count','trial-name']) $(key).textContent='—';
  $('fills-body').replaceChildren();$('comparison-body').replaceChildren();$('terminal-summary').replaceChildren();
  $('feasibility').textContent='—';$('feasibility').className='chip';$('cost-note').textContent='';$('integrity').textContent='';
  for(const id of ['price-chart','account-chart']) {const canvas=$(id);canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);}
  $('jump-mark').disabled=true;$('jump-flat').disabled=true;
}

async function trialData(trial) {
  if (cache.has(trial.trial_id)) return cache.get(trial.trial_id);
  const promise = Promise.all([loadVerified(base,trial.path),loadVerified(base,trial.fills)]).then(([path,executions])=>({trial,path:pathForDisplay(path),fills:executions.fills,cycles:executions.cycles}));
  cache.set(trial.trial_id,promise);
  try { const data=await promise; while(cache.size>2) { const oldest=cache.keys().next().value; if(oldest===trial.trial_id)break;cache.delete(oldest); } return data; }
  catch(error) { cache.delete(trial.trial_id); throw error; }
}

async function chooseTrial() {
  const id=++requestId; pause(); loaded=false; enableTransport(false); $('load-error').hidden=true;
  clearDisplay();
  $('load-status').hidden=false; $('load-status').textContent=t('loading');
  const [lane,candidate]=$('policy').value.split(':');
  const trial=meta.trials.find(x=>x.lane===lane && x.candidate===candidate && x.scenario===$('cost').value);
  if (!trial) return fail(Error('Recorded path is not available'),id);
  try {
    const [data,candles]=await Promise.all([trialData(trial),marketPromise]);
    if (id!==requestId) return;
    current=data; market=candles.rows; loaded=true;
    $('trial-name').textContent=trial.trial_id+' · '+trial.candidate+' · '+trial.scenario;
    scenarioCopy();
    enableTransport(true);
    $('jump-mark').disabled=!trial.first_equity_plus50_percent?.hit;
    $('jump-flat').disabled=!trial.first_flat_wallet_plus50_percent?.hit;
    comparison(); finalResult(); seek(cursor);
  } catch(error) { fail(error,id); }
}
function fail(error,id=requestId) {
  if(id!==requestId)return;
  pause(); loaded=false; enableTransport(false);
  clearDisplay();
  $('load-status').hidden=true; $('load-error').hidden=false;
  $('load-error').textContent=text('Podatkov ni mogoče preveriti ali naložiti. Predvajanje je ustavljeno. ','Unable to verify or load data. Replay is stopped. ')+error.message;
  for(const key of ['wallet','equity','return','drawdown','positions','unrealized','cycles-count']) $(key).textContent='—';
}

function render() {
  if(!loaded)return;
  const sample=sampleAt(current.path,cursor),fillsEnd=upperBound(current.fills,cursor),cycleEnd=upperBound(current.cycles,cursor,r=>r[2]);
  $('wallet').textContent=money(sample.wallet); $('equity').textContent=money(sample.net);
  $('return').textContent=(sample.net>=100?'+':'')+percent(sample.net-100,4);
  $('return').className=sample.net>=100?'positive':'negative'; $('drawdown').textContent=percent(sample.dd*100,4);
  $('market-time').textContent=stamp(cursor); $('elapsed').textContent=hhmmss(cursor)+' / '+hhmmss(meta.duration_seconds);
  $('unrealized').textContent=money(sample.raw-sample.wallet)+' USDT'; $('cycles-count').textContent=number(cycleEnd,0);
  const last=fillsEnd?current.fills[fillsEnd-1]:null, long=last?last[8]:0, short=last?last[9]:0;
  $('positions').textContent=long||short ? 'LONG '+number(long*1e-8,8)+' BTC · SHORT '+number(short*1e-8,8)+' BTC' : sample.flat ? text('FLAT · brez pozicije','FLAT · no position') : text('0 BTC · usklajevanje naročil','0 BTC · reconciling orders');
  $('fills-count').textContent=number(fillsEnd,0)+' / '+number(current.fills.length,0);
  $('fills-empty').hidden=fillsEnd>0;
  const actionNames={ENTRY:text('VSTOP','ENTRY'),ADD:text('DODAJANJE','ADD'),REDUCE:text('ZMANJŠANJE','REDUCE'),STOP:'STOP'};
  $('fills-body').replaceChildren(...current.fills.slice(Math.max(0,fillsEnd-12),fillsEnd).reverse().map(r=>{
    const tr=document.createElement('tr');
    for(const value of [stamp(r[0]),actionNames[r[5]],r[1]===1?'LONG':'SHORT',number(r[2]*1e-8,8),money(r[3]),money(r[4]),String(r[6])]) { const td=document.createElement('td');td.textContent=value;tr.append(td); }
    return tr;
  }));
  drawPrice(); drawAccount(sample);
  $('play').textContent=t(playing?'pause':'play');
}

function comparison() {
  const lane=current.trial.lane;
  $('comparison-body').replaceChildren(...meta.trials.filter(r=>r.lane===lane).map(r=>{
    const tr=document.createElement('tr'); if(r.trial_id===current.trial.trial_id)tr.className='selected';
    for(const value of [r.candidate+' · '+(lane==='A'?'1×':text('sintetični 200×','synthetic 200×')),r.scenario,money(r.terminal_net_equity_USDT),percent(r.net_equity_return_percent,5),percent(r.maximum_sampled_drawdown_percent,4)]) {const td=document.createElement('td');td.textContent=value;tr.append(td);}return tr;
  }));
}
function finalResult() {
  const r=current.trial, badge=$('feasibility'); badge.className='chip '+(r.test_feasible?'pass':'fail');
  badge.textContent=r.test_feasible?text('TEST pogoji izpolnjeni','TEST conditions met'):text('TEST pogoji niso izpolnjeni','TEST conditions not met');
  const p=document.createElement('p');p.textContent=text(`Neto vrednost ${money(r.terminal_net_equity_USDT)} USDT; wallet ${money(r.terminal_wallet_USDT)} USDT; največji padec ${percent(r.maximum_sampled_drawdown_percent,4)}; ${r.flat_cycles} zaključenih ciklov.`,`Net equity ${money(r.terminal_net_equity_USDT)} USDT; wallet ${money(r.terminal_wallet_USDT)} USDT; maximum drawdown ${percent(r.maximum_sampled_drawdown_percent,4)}; ${r.flat_cycles} closed cycles.`);
  const note=document.createElement('p');
  note.textContent=r.terminal_position_state==='FLAT'?text('Konec brez odprte pozicije.','No open position at the end.'):text('Na koncu ostane odprta virtualna pozicija. Neto vrednost ni enaka realiziranemu walletu.','An open virtual position remains at the end. Net equity is not the realized wallet.');
  if(r.lane==='B'&&r.scenario==='C0')note.textContent+=' '+text('Padec 81,57 % preseže zamrznjeni prag 80 %.','Drawdown of 81.57% exceeds the frozen 80% limit.');
  $('terminal-summary').replaceChildren(p,note);
}

function canvasFrame(id) {
  const canvas=$(id),box=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);
  if(box.width<80||box.height<80)return null;
  canvas.width=Math.round(box.width*dpr);canvas.height=Math.round(box.height*dpr);
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,box.width,box.height);
  const css=getComputedStyle(root),colors=Object.fromEntries(['ink','muted','line','accent','cash','good','bad'].map(k=>[k,css.getPropertyValue('--'+k).trim()]));
  ctx.font='11px system-ui';return {ctx,w:box.width,h:box.height,colors,left:9,right:72,top:13,bottom:28};
}
function axes(f,min,max,start,end,label) {
  const {ctx,w,h,colors,left,right,top,bottom}=f; if(max===min)max=min+1;
  const x=t=>left+(t-start)/(end-start||1)*(w-left-right),y=v=>top+(max-v)/(max-min)*(h-top-bottom);
  for(let i=0;i<5;i++) {const v=min+(max-min)*i/4,py=y(v);ctx.strokeStyle=colors.line;ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(left,py);ctx.lineTo(w-right,py);ctx.stroke();ctx.fillStyle=colors.muted;ctx.fillText(number(v,max>1000?0:2),w-right+7,py+4);}
  for(let i=0;i<3;i++){const s=start+(end-start)*i/2;ctx.fillStyle=colors.muted;ctx.textAlign=i===0?'left':i===2?'right':'center';ctx.fillText(label(s),x(s),h-7);}ctx.textAlign='left';return {x,y};
}
function drawPrice() {
  const f=canvasFrame('price-chart');if(!f)return;
  const span=Number($('window').value),end=cursor,start=Math.max(0,end-span);
  const {bars,bucketSeconds}=candlesForWindow(market,end,Math.min(span,end),Math.floor((f.w-f.right)/5));
  if(!bars.length){$('price-caption').textContent=text('Prva zaključena 1s sveča še ni na voljo.','The first completed 1s bar is not available yet.');return;}
  let low=Infinity,high=-Infinity;for(const r of bars){low=Math.min(low,r.low);high=Math.max(high,r.high);}
  const padding=Math.max((high-low)*.09,high*.00002),{x,y}=axes(f,low-padding,high+padding,start,Math.max(start+1,end),s=>hhmmss(s));
  const {ctx,colors}=f,step=(f.w-f.left-f.right)/Math.max(bars.length,1);
  for(const r of bars){const px=x((r.first+r.t)/2),up=r.close>=r.open;ctx.fillStyle=up?colors.accent:colors.muted;ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(px,y(r.high));ctx.lineTo(px,y(r.low));ctx.stroke();ctx.fillRect(px-Math.max(.5,step*.25),Math.min(y(r.open),y(r.close)),Math.max(1,step*.5),Math.max(1,Math.abs(y(r.open)-y(r.close))));}
  const a=upperBound(current.fills,start-1e-9),b=upperBound(current.fills,cursor),visible=current.fills.slice(Math.max(a,b-600),b);
  for(const r of visible){const px=x(r[0]),py=y(Number(r[3])),increase=['ENTRY','ADD'].includes(r[5]);if(py<0||py>f.h-f.bottom)continue;ctx.fillStyle=increase?colors.accent:colors.cash;ctx.beginPath();ctx.moveTo(px,py+(increase?-5:5));ctx.lineTo(px-3,py+(increase?1:-1));ctx.lineTo(px+3,py+(increase?1:-1));ctx.closePath();ctx.fill();}
  $('price-caption').textContent=text(`1s vir · ${bucketSeconds}s sveče · ${visible.length} od ${b-a} izvršitev v oknu`,`1s source · ${bucketSeconds}s candles · ${visible.length} of ${b-a} window executions`);
}
function drawAccount(sample) {
  const f=canvasFrame('account-chart');if(!f)return;
  const p=current.path,n=sample.index+1;
  const net=lineEnvelope(p.t,p.net,n,Math.floor(f.w)),wallet=lineEnvelope(p.t,p.wallet,n,Math.floor(f.w));
  let low=0,high=105;for(const points of [net,wallet])for(const r of points){low=Math.min(low,r[1]);high=Math.max(high,r[1]*1.06);}
  const {ctx,colors}=f,{x,y}=axes(f,low,high,0,meta.duration_seconds,s=>Math.round(s/3600)+' h');
  ctx.strokeStyle=colors.muted;ctx.setLineDash([2,4]);ctx.beginPath();ctx.moveTo(x(0),y(100));ctx.lineTo(x(meta.duration_seconds),y(100));ctx.stroke();ctx.setLineDash([]);
  for(const [points,color,dash] of [[wallet,colors.cash,[5,4]],[net,colors.accent,[]]]){ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(x(0),y(100));for(const r of points)ctx.lineTo(x(r[0]),y(r[1]));ctx.stroke();}ctx.setLineDash([]);
  ctx.strokeStyle=colors.ink;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x(cursor),f.top);ctx.lineTo(x(cursor),f.h-f.bottom);ctx.stroke();
  ctx.fillStyle=colors.accent;ctx.beginPath();ctx.arc(x(cursor),y(sample.net),3,0,Math.PI*2);ctx.fill();
}

function tick(now) {
  if(!playing||!loaded)return;
  if(!lastFrame)lastFrame=now;
  cursor=Math.min(meta.duration_seconds,cursor+(now-lastFrame)/1000*Number($('speed').value));lastFrame=now;
  if(now-lastPaint>=180||cursor===meta.duration_seconds){lastPaint=now;$('timeline').value=String(Math.floor(cursor));render();}
  if(cursor>=meta.duration_seconds){pause();return;}animation=requestAnimationFrame(tick);
}
$('play').addEventListener('click',()=>{if(!loaded)return;if(playing){pause();return;}if(cursor>=meta.duration_seconds)cursor=0;playing=true;lastFrame=0;lastPaint=0;$('play').textContent=t('pause');animation=requestAnimationFrame(tick);});
$('begin').addEventListener('click',()=>{pause();seek(0);});$('end').addEventListener('click',()=>{pause();seek(meta.duration_seconds);});
$('previous').addEventListener('click',()=>{pause();seek(Math.floor(cursor)-1);});$('next').addEventListener('click',()=>{pause();seek(Math.floor(cursor)+1);});
$('timeline').addEventListener('input',()=>{pause();seek(Number($('timeline').value));});
$('jump-mark').addEventListener('click',()=>{pause();seek(Number(current.trial.first_equity_plus50_percent.sampled_seconds));});
$('jump-flat').addEventListener('click',()=>{pause();seek(Number(current.trial.first_flat_wallet_plus50_percent.sampled_seconds));});
$('jump-dd').addEventListener('click',()=>{pause();seek(current.trial.drawdown_interval_seconds[1]);});
$('policy').addEventListener('change',chooseTrial);$('cost').addEventListener('change',chooseTrial);$('window').addEventListener('change',()=>{if(loaded)drawPrice();});
$('theme').addEventListener('click',()=>{root.dataset.theme=root.dataset.theme==='light'?'dark':'light';try{localStorage.setItem('bd-q1s-replay-theme-v1',root.dataset.theme);}catch{}if(loaded)render();});
$('language').addEventListener('click',()=>{lang=lang==='sl'?'en':'sl';try{localStorage.setItem('bd-q1s-replay-language-v1',lang);}catch{}setLanguage();});
new ResizeObserver(()=>{if(loaded){drawPrice();drawAccount(sampleAt(current.path,cursor));}}).observe($('price-chart'));
new ResizeObserver(()=>{if(loaded)drawAccount(sampleAt(current.path,cursor));}).observe($('account-chart'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
setLanguage();
try {
  const response=await fetch(new URL('replay-index.r1.json',base),{cache:'no-cache',credentials:'omit',redirect:'error'});
  if(!response.ok)throw Error('Index HTTP '+response.status);meta=await response.json();
  if(meta.schema!=='bd.q1s.public.completed.replay.v1'||meta.mode!=='HISTORICAL_READ_ONLY'||meta.duration_seconds!==172800)throw Error('Unsupported replay index');
  marketPromise=loadVerified(base,meta.market);
  const requested=new URL(location.href).searchParams.get('trial'),initial=meta.trials.find(r=>r.trial_id===(requested||meta.default_trial))||meta.trials.find(r=>r.trial_id===meta.default_trial);
  $('policy').value=initial.lane+':'+initial.candidate;$('cost').value=initial.scenario;
  await chooseTrial();
} catch(error) { fail(error); }
