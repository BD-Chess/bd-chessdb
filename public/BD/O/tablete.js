/* BD/O medication planner v1. Medication content remains encrypted at rest. */
(async function(){
'use strict';
const ROOT='/BD/O/', SESSION='bd-o-v2-session', API='/api/bd-o-medication-state', TZ='Europe/Ljubljana';
const TE=new TextEncoder(), TD=new TextDecoder('utf-8',{fatal:true});
const from64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const to64=u=>btoa(String.fromCharCode(...new Uint8Array(u)));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let cfg,bundle,med,token,state=null,pollTimer=null;

async function getText(path){
 const r=await fetch(path,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
 if(!r.ok)throw new Error('Prenos zasebnih podatkov ni uspel.');
 return r.text();
}
async function digestBytes(bytes){return new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));}
async function digestHex(bytes){return [...await digestBytes(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function validSession(x){try{return x&&x.vault===cfg.vault&&typeof x.key==='string'&&from64(x.key).length===32}catch(_){return false}}
function showLogin(message=''){
 document.body.innerHTML=`<main class="loading"><section class="box"><div class="ey">BD · Osebno</div><h1>Tablete</h1><p class="muted">Uporabi isto geslo kot za /BD/O/.</p>
 <form id="medLogin"><label style="display:block;font-weight:800;margin:18px 0 6px">Geslo</label>
 <input id="medPw" type="password" autocomplete="current-password" autocapitalize="none" spellcheck="false" style="width:100%;min-height:52px;border:1px solid #526881;border-radius:12px;background:#060e1c;color:#fff;padding:12px 14px;font:inherit">
 <button id="medUnlock" type="submit" style="width:100%;min-height:50px;margin-top:10px;border:1px solid #64d8d0;border-radius:12px;background:#153a41;color:#e9fffb;font:inherit;font-weight:800">Odkleni</button>
 <p id="medErr" class="muted" style="color:#ff9eaa">${esc(message)}</p></form><p><a style="color:#67e0d7" href="${ROOT}">← Osebno</a></p></section></main>`;
 document.getElementById('medLogin').onsubmit=async ev=>{
  ev.preventDefault();const input=document.getElementById('medPw'),btn=document.getElementById('medUnlock');let value=input.value;
  if(!value)return;btn.disabled=true;btn.textContent='Odklepam…';document.getElementById('medErr').textContent='';
  try{
   const material=await crypto.subtle.importKey('raw',TE.encode(value),'PBKDF2',false,['deriveKey']);value='';input.value='';
   const kek=await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:from64(cfg.kdf.salt),iterations:cfg.kdf.iterations},material,{name:'AES-GCM',length:256},false,['decrypt']);
   const raw=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(cfg.wrap.iv),additionalData:TE.encode('BD/O:v2:wrap:'+cfg.vault)},kek,from64(cfg.wrap.cipher)));
   sessionStorage.setItem(SESSION,JSON.stringify({vault:cfg.vault,key:to64(raw)}));
   await startWithRaw(raw);raw.fill(0);
  }catch(_){showLogin('Napačno geslo ali odklepanje ni uspelo.')}
 };
} 
async function openBundle(master){
 const chunks=await Promise.all(cfg.data.parts.map(async p=>{
   const t=await getText(ROOT+p.path);
   if(await digestHex(TE.encode(t))!==p.sha256)throw new Error('Preverjanje celovitosti ni uspelo.');
   return t;
 }));
 const bytes=from64(chunks.join(''));
 if(await digestHex(bytes)!==cfg.data.sha256)throw new Error('Preverjanje celovitosti ni uspelo.');
 const compressed=await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(cfg.data.iv),additionalData:TE.encode('BD/O:v2:data:'+cfg.release)},master,bytes);
 const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
 bundle=JSON.parse(TD.decode(await new Response(stream).arrayBuffer()));
 if(bundle.format!=='BD-O-PAGES-2')throw new Error('Neveljaven zasebni arhiv.');
}
function decodedPage(name){return bundle.pages[name].map(x=>typeof x==='number'?bundle.fragments[x]:x).join('');}
async function openMedConfig(){
 const wrap=JSON.parse(await getText(ROOT+'med-config.json'));
 if(wrap.format!=='BD-O-MED-WRAP-1')throw new Error('Neveljavna nastavitev dnevnega načrta.');
 for(const v of wrap.variants){
   if(!bundle.pages[v.page])continue;
   try{
     const page=decodedPage(v.page);
     const keyRaw=await digestBytes(TE.encode(page));
     const key=await crypto.subtle.importKey('raw',keyRaw,'AES-GCM',false,['decrypt']);
     const out=await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(v.iv),additionalData:TE.encode('BD/O:med-config-v1:'+v.page)},key,from64(v.cipher));
     const obj=JSON.parse(TD.decode(out));
     if(obj.format==='BD-O-MED-CONFIG-1')return obj;
   }catch(_){}
 }
 throw new Error('Dnevnega načrta ni bilo mogoče odkleniti.');
}
function todayISO(){
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const o=Object.fromEntries(p.map(x=>[x.type,x.value]));return `${o.year}-${o.month}-${o.day}`;
}
function addDays(date,days){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
function zonedEpoch(date,time){
 const [y,m,d]=date.split('-').map(Number),[hh,mm]=time.split(':').map(Number);
 const want=Date.UTC(y,m-1,d,hh,mm,0,0);
 let guess=want;
 const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 for(let i=0;i<4;i++){
  const p=Object.fromEntries(fmt.formatToParts(new Date(guess)).map(x=>[x.type,x.value]));
  const got=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
  const delta=want-got;if(!delta)break;guess+=delta;
 }
 return guess;
}
function hmFromOffset(wake,offsetMin){
 const [h,m]=wake.split(':').map(Number);const total=h*60+m+offsetMin;
 const day=Math.floor(total/1440),v=((total%1440)+1440)%1440;
 return {time:String(Math.floor(v/60)).padStart(2,'0')+':'+String(v%60).padStart(2,'0'),day};
}
function fmtLocal(iso){
 if(!iso)return '—';
 return new Intl.DateTimeFormat('sl-SI',{timeZone:TZ,hour:'2-digit',minute:'2-digit'}).format(new Date(iso));
}
function wakeOptions(selected){
 let out='';for(let h=0;h<24;h++)for(let m=0;m<60;m+=15){const v=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;out+=`<option value="${v}"${v===selected?' selected':''}>${v}</option>`}return out;
}
function allScheduled(){return [...med.active,...med.optional.filter(x=>Number.isFinite(x.offsetMin))]}
function makePlan(date,wake){
 const items={}; const blocks={};
 for(const item of allScheduled()){
   const dueMs=zonedEpoch(date,wake)+item.offsetMin*60000;
   items[item.id]={takenAt:null};
   if(item.required&&item.remind){
     const b=blocks[item.block]||(blocks[item.block]={id:item.block,dueAt:new Date(dueMs).toISOString(),itemIds:[]});
     b.itemIds.push(item.id);
     if(dueMs<new Date(b.dueAt).getTime())b.dueAt=new Date(dueMs).toISOString();
   }
 }
 return {date,wake,timezone:TZ,items,blocks:Object.values(blocks)};
}
async function api(method,date,body){
 const url=API+(date?'?date='+encodeURIComponent(date):'');
 const r=await fetch(url,{method,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',
  headers:{'Content-Type':'application/json','X-BD-Med-Token':token},
  body:body?JSON.stringify(body):undefined});
 const x=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(x.error||'Strežniška napaka.');
 return x;
}
async function loadState(date,ensure=true){
 let x=await api('GET',date);
 if(!x.state&&ensure){
   const wake=med.initialWakeByDate?.[date]||med.defaultWake||'08:00';
   x=await api('POST','',{action:'plan',plan:makePlan(date,wake)});
 }
 state=x.state||null;
 return x;
}
function statusFor(item){
 const s=state?.items?.[item.id];if(s?.takenAt)return {cls:'done',text:'Vzeto '+fmtLocal(s.takenAt)};
 if(!Number.isFinite(item.offsetMin))return {cls:'',text:'po potrebi'};
 const due=zonedEpoch(state.date,state.wake)+item.offsetMin*60000,now=Date.now();
 if(state.date===todayISO()&&now>due+med.reminderGraceMin*60000)return {cls:'late',text:'ZAMUJA'};
 if(state.date===todayISO()&&now>due)return {cls:'soon',text:'čas je'};
 return {cls:'',text:hmFromOffset(state.wake,item.offsetMin).time};
}
function itemCard(item,section){
 const s=statusFor(item),taken=!!state?.items?.[item.id]?.takenAt,canCheck=state.date<=todayISO();
 const when=Number.isFinite(item.offsetMin)?hmFromOffset(state.wake,item.offsetMin):null;
 return `<label class="medcard ${s.cls}">
  <input class="medcheck" type="checkbox" data-id="${esc(item.id)}" ${taken?'checked':''} ${canCheck?'':'disabled'}>
  <span class="medmain"><span class="medname">${esc(item.name)} <small>${esc(item.dose)}</small></span>
  <span class="medmeta">${when?`ob <strong>${esc(when.time)}</strong>${when.day?` (+${when.day} dan)`:''}`:'samo po potrebi'} · <b>${esc(s.text)}</b></span></span>
 </label>`;
}
function detailsCard(item,badge){
 return `<details class="detail"><summary><span>${esc(item.name)}</span><em>${esc(badge||item.dose||'')}</em></summary>
   <p class="desc">${esc(item.short||'')}</p>
   ${item.details?.length?`<ul>${item.details.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}
 </details>`;
}
function render(){
 const date=state.date,wake=state.wake,today=todayISO(),tomorrow=addDays(today,1);
 const future=date>today;
 const mail=state.emailReady?'<span class="ok">Gmail opomniki pripravljeni</span>':'<span class="warn">Gmail opomniki še niso avtorizirani</span>';
 document.body.innerHTML=`<header class="top"><div class="topin"><a href="${ROOT}">← BD · Osebno</a><div class="tools"><button id="fontMinus">A−</button><button id="fontPlus">A+</button><button id="lockBtn">Zakleni</button></div></div></header>
 <main class="wrap">
 <section class="hero"><div class="kicker">Dnevni načrt · Europe/Ljubljana</div><h1>Tablete</h1><p>Izberi dan in uro vstajanja. Vse načrtovane ure se samodejno premaknejo.</p></section>
 <section class="panel planner">
   <div class="quickrow"><button data-date="${today}" class="datequick ${date===today?'active':''}">Danes</button><button data-date="${tomorrow}" class="datequick ${date===tomorrow?'active':''}">Jutri</button></div>
   <label class="field"><span>Načrtujem dan</span><input id="planDate" type="date" value="${esc(date)}"></label>
   <label class="field"><span>Vstal bom / sem vstal ob</span><select id="wake">${wakeOptions(wake)}</select></label>
   <div class="mailstate">Opomnik po <strong>${med.reminderGraceMin} min</strong> zamude · ${mail}</div>
   ${future?'<div class="note">Za prihodnji dan lahko že zdaj nastaviš uro vstajanja. Checkboxi se odprejo na dan jemanja.</div>':''}
 </section>
 <section class="panel"><h2>Redno</h2><div class="medlist">${med.active.map(x=>itemCard(x,'active')).join('')}</div></section>
 <section class="panel"><h2>Po potrebi</h2><div class="medlist">${med.optional.map(x=>itemCard(x,'optional')).join('')}</div></section>
 <section class="panel"><h2>Vsa zdravila in dodatki</h2><p class="sub">Tapni vrstico za opis.</p>
   <div class="details">${med.active.map(x=>detailsCard(x,'redno')).join('')}${med.optional.map(x=>detailsCard(x,'po potrebi')).join('')}</div>
 </section>
 <section class="panel hold"><h2>Imam doma, vendar za zdaj ne jemljem</h2><div class="details">${med.held.map(x=>detailsCard(x,'NA ČAKANJU')).join('')}</div></section>
 <p class="footer">${esc(med.footer)}</p>
 </main>`;
 injectStyle();bind();applyFont();
}
function injectStyle(){
 if(document.getElementById('medStyle'))return;
 const s=document.createElement('style');s.id='medStyle';s.textContent=`
 :root{--bg:#050913;--bg2:#081321;--panel:#0d1727;--line:#2d465f;--text:#f2f7ff;--muted:#b8c7d8;--cyan:#67e0d7;--blue:#79c0ff;--gold:#ffd56a;--green:#6ce0a5;--red:#ff8c9b;--body:20px}
 *{box-sizing:border-box}html{background:var(--bg);-webkit-text-size-adjust:100%}body{margin:0;color:var(--text);font:var(--body)/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;background:radial-gradient(circle at 5% -5%,#163346,transparent 28rem),linear-gradient(180deg,var(--bg),var(--bg2));min-height:100vh}
 .top{position:sticky;top:0;z-index:20;background:#050913ed;backdrop-filter:blur(14px);border-bottom:1px solid #29415f}.topin{width:min(760px,calc(100% - 18px));margin:auto;min-height:56px;display:flex;align-items:center;justify-content:space-between;gap:8px}.top a{color:var(--cyan);font-size:14px;font-weight:900;text-decoration:none}.tools{display:flex;gap:6px}.tools button{border:1px solid var(--line);border-radius:999px;background:#0b1727;color:var(--text);padding:8px 10px;font-weight:850}
 .wrap{width:min(760px,calc(100% - 18px));margin:auto;padding:20px 0 80px}.hero,.panel{border:1px solid var(--line);border-radius:22px;background:linear-gradient(145deg,#101f34,#091421);padding:18px;box-shadow:0 15px 40px #0005;margin-bottom:14px}.hero{border-color:#356480}.kicker{font-size:.72em;letter-spacing:.13em;text-transform:uppercase;font-weight:900;color:var(--gold)}h1{font-size:clamp(2.7rem,11vw,4.8rem);letter-spacing:-.05em;line-height:.95;margin:.2em 0}h2{font-size:1.45em;margin:0 0 .65em}.hero p,.sub,.footer,.desc,li{color:var(--muted)}
 .planner{display:grid;gap:12px}.quickrow{display:grid;grid-template-columns:1fr 1fr;gap:8px}.datequick{min-height:46px;border:1px solid var(--line);border-radius:13px;background:#091522;color:var(--text);font-weight:850}.datequick.active{border-color:var(--cyan);color:var(--cyan)}
 .field{display:grid;gap:6px}.field span{font-weight:850;color:#dfeaff}.field input,.field select{width:100%;min-height:52px;border:1px solid #3c5875;border-radius:13px;background:#071120;color:#fff;padding:10px 13px;font:inherit;font-size:1.08em}
 .mailstate,.note{padding:12px 14px;border:1px solid #37516b;border-radius:13px;background:#081522;color:var(--muted)}.ok{color:var(--green)}.warn{color:var(--gold)}
 .medlist{display:grid;gap:10px}.medcard{display:grid;grid-template-columns:34px 1fr;align-items:center;gap:10px;padding:15px;border:1px solid var(--line);border-radius:16px;background:#081421;cursor:pointer}.medcard.done{border-color:#2e7657;background:#0b2018}.medcard.late{border-color:#8a3643;background:#281119}.medcard.soon{border-color:#7b6730;background:#211d0d}.medcheck{width:26px;height:26px;accent-color:#68dba2}.medmain{min-width:0}.medname{display:block;font-weight:900;font-size:1.04em}.medname small{display:block;color:#a9bad0;font-size:.78em;font-weight:700;margin-top:2px}.medmeta{display:block;color:#aabbd0;font-size:.84em;margin-top:5px}.medmeta strong{color:#fff}.medmeta b{color:var(--gold)}.done .medmeta b{color:var(--green)}.late .medmeta b{color:var(--red)}
 .details{display:grid;gap:8px}.detail{border:1px solid var(--line);border-radius:15px;background:#081421;overflow:hidden}.detail summary{list-style:none;display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px;cursor:pointer;font-weight:900}.detail summary::-webkit-details-marker{display:none}.detail summary:before{content:'＋';color:var(--cyan);margin-right:6px}.detail[open] summary:before{content:'−'}.detail summary span{flex:1}.detail summary em{font-style:normal;font-size:.72em;color:var(--gold);text-align:right}.detail p,.detail ul{margin:0;padding:0 16px 14px}.detail ul{padding-left:34px}.hold{border-color:#6d5b2d}.footer{text-align:center;font-size:.78em;padding:8px 15px}
 @media(max-width:520px){.topin{align-items:flex-start;padding:8px 0}.tools{flex-wrap:wrap;justify-content:flex-end}.hero,.panel{padding:15px;border-radius:18px}.wrap{padding-top:12px}.medcard{padding:13px}.detail summary{align-items:flex-start}.detail summary em{max-width:38%}}
 `;document.head.appendChild(s);
}
function applyFont(){
 let p=Number(localStorage.getItem('bd-o-med-font')||100);if(!Number.isFinite(p)||p<70)p=100;
 const root=document.documentElement; const paint=()=>{root.style.fontSize=(p/100*16)+'px';};
 paint();
 document.getElementById('fontMinus').onclick=()=>{p=Math.max(70,p-10);localStorage.setItem('bd-o-med-font',p);paint()};
 document.getElementById('fontPlus').onclick=()=>{p+=10;localStorage.setItem('bd-o-med-font',p);paint()};
}
function bind(){
 document.getElementById('lockBtn').onclick=()=>{sessionStorage.removeItem(SESSION);location.replace(ROOT+'index.html')};
 document.getElementById('planDate').onchange=async e=>{await selectDate(e.target.value)};
 document.getElementById('wake').onchange=async e=>{await saveWake(e.target.value)};
 document.querySelectorAll('.datequick').forEach(b=>b.onclick=async()=>selectDate(b.dataset.date));
 document.querySelectorAll('.medcheck').forEach(c=>c.onchange=async()=>{
  const id=c.dataset.id;
  try{
   const x=await api('POST','',{action:'taken',date:state.date,id,taken:c.checked,takenAt:c.checked?new Date().toISOString():null});
   state=x.state;render();
  }catch(err){c.checked=!c.checked;alert(err.message)}
 });
}
async function selectDate(date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
 const x=await loadState(date,true);state=x.state;render();
}
async function saveWake(wake){
 try{
  const plan=makePlan(state.date,wake);
  for(const [id,v] of Object.entries(state.items||{}))if(v?.takenAt&&plan.items[id])plan.items[id].takenAt=v.takenAt;
  const x=await api('POST','',{action:'plan',plan});
  state=x.state;render();
 }catch(err){alert(err.message)}
}
function maybeLocalAlert(){
 if(!state||state.date!==todayISO())return;
 const now=Date.now(),late=med.active.filter(x=>x.remind&&!state.items?.[x.id]?.takenAt&&now>zonedEpoch(state.date,state.wake)+x.offsetMin*60000+med.reminderGraceMin*60000);
 if(late.length&&'Notification'in window&&Notification.permission==='granted'){
  const k='bd-med-local-'+state.date+'-'+late.map(x=>x.block).join('-');
  if(!sessionStorage.getItem(k)){new Notification('Opomnik za dnevni načrt',{body:'Vsaj ena načrtovana tableta še ni označena kot vzeta.'});sessionStorage.setItem(k,'1')}
 }
}
async function refresh(){
 try{const x=await api('GET',state?.date||todayISO());if(x.state){state=x.state;render();maybeLocalAlert()}}catch(_){}
}
async function startWithRaw(raw){
 const master=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);
 await openBundle(master);med=await openMedConfig();token=med.apiToken;
 const x=await loadState(todayISO(),true);state=x.state;render();maybeLocalAlert();
 if(pollTimer)clearInterval(pollTimer);pollTimer=setInterval(refresh,60000);
}
try{
 if(!window.isSecureContext||!crypto.subtle||!window.DecompressionStream)throw new Error('Odpri HTTPS stran v posodobljenem brskalniku.');
 cfg=JSON.parse(await getText(ROOT+'vault.json'));
 const sess=JSON.parse(sessionStorage.getItem(SESSION)||'null');
 if(validSession(sess)){await startWithRaw(from64(sess.key));return}
 showLogin();
}catch(err){
 document.body.innerHTML=`<main class="loading"><section class="box"><div class="ey">BD · Osebno</div><h1>Napaka</h1><p class="muted">${esc(err.message||'Strani ni bilo mogoče odpreti.')}</p><p><a style="color:#67e0d7" href="${ROOT}">Nazaj na Osebno</a></p></section></main>`;
}
})();