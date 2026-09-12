/* WL private journal v2. Only authenticated ciphertext crosses the public feed. */
(() => { 'use strict';
const $=id=>document.getElementById(id), te=new TextEncoder(), td=new TextDecoder('utf-8',{fatal:true});
const ROOT='/WL/', FEED='https://raw.githubusercontent.com/BD-Chess/bd-chessdb/main/public/WL/';
const RULES_MANIFEST_SHA='e39662d7d5287a2ae61a6f3de7e5ba3fbed483b0a0a6295f3e67b28e5cdb46a2', RULES_DOC_SHA='d5d23bc18d0be3f67d6e448b416436ec04700d5bba7e35bc1dff39b5e126129f';
const SESSION='wl-v2-session', FONT='wl-reader-percent-v2', THEME='wl-theme-v2';
let vault, key, token='', state=null, rulesDoc=null, rulesRelease=null, events=[], unlocked=false, timer=null, busy=false, font=100, generation=0;
function read(store,k){try{return store.getItem(k)}catch{return null}}
function write(store,k,v){try{store.setItem(k,v)}catch{}}
function erase(store,k){try{store.removeItem(k)}catch{}}
const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const to64=x=>btoa(String.fromCharCode(...new Uint8Array(x)));
const canonical=x=>JSON.stringify(sort(x));
function sort(x){if(Array.isArray(x))return x.map(sort);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,sort(x[k])]));return x}
async function hash(x){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',x))].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function aes(raw){return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt'])}
async function open(box,k,aad){
 if(box.format!=='WL-ENC-2')throw Error('Neznana oblika podatkov.');
 const c=b64(box.cipher);if(await hash(c)!==box.sha256)throw Error('Celovitost šifriranih podatkov ni pravilna.');
 return JSON.parse(td.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(box.iv),additionalData:te.encode(aad)},k,c)));
}
async function json(url){const r=await fetch(url,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw Error('Vir podatkov ni dosegljiv ('+r.status+').');return r.json()}

async function checkedRules(k){
 const get=async path=>{const r=await fetch(FEED+path,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw Error('Pravilnik ni dosegljiv ('+r.status+').');return new Uint8Array(await r.arrayBuffer())};
 const mb=await get('rules.manifest.json?t='+Date.now());
 if(await hash(mb)!==RULES_MANIFEST_SHA)throw Error('Različica pravilnika ni odobrena. Osveži stran.');
 const m=JSON.parse(td.decode(mb));
 if(m.schema!=='wl.rules.release.v1'||m.rules_id!=='WL-RULES'||m.version!=='1.0.0'||m.path!=='rules/v1.0.0.enc.json')throw Error('Neveljaven pravilnik.');
 const eb=await get(m.path);if(await hash(eb)!==m.envelope_sha256)throw Error('Poškodovan pravilnik.');

 const pack=await open(JSON.parse(td.decode(eb)),k,m.aad);
 if(pack.schema!=='wl.rules.pack.v1'||pack.compression!=='gzip'||pack.bytes!==m.document_bytes||pack.bytes>128000)throw Error('Neveljaven paket pravilnika.');
 const stream=new Blob([b64(pack.data)]).stream().pipeThrough(new DecompressionStream('gzip'));
 const raw=new Uint8Array(await new Response(stream).arrayBuffer());
 if(raw.length!==pack.bytes)throw Error('Neveljavna dolžina pravilnika.');
 const d=JSON.parse(td.decode(raw));
 if(await hash(te.encode(canonical(d)))!==RULES_DOC_SHA||m.document_sha256!==RULES_DOC_SHA||await hash(te.encode(d.markdown))!==m.markdown_sha256)throw Error('Hash pravilnika se ne ujema.');
 if(d.schema!=='wl.rules.v1'||d.id!=='WL-RULES'||d.version!==m.version||d.scope!=='WL_RESEARCH_JOURNAL_ONLY'||canonical(d.rule_ids)!==canonical(Array.from({length:16},(_,i)=>'R'+String(i+1).padStart(2,'0'))))throw Error('Neveljavna vsebina pravilnika.');
 return {doc:d,release:m};
}
function checkRulesReceipt(e,release){
 if(e.seq<=release.legacy_through_seq)return;
 const r=e.rules_receipt,age=r?Date.parse(e.created_at)-Date.parse(r.read_at_utc):NaN;
 if(!r||r.schema!=='wl.rules.receipt.v1'||r.id!=='WL-RULES'||r.version!==release.version||r.sha256!==RULES_DOC_SHA||r.scope!=='WL_RESEARCH_JOURNAL_ONLY'||r.assurance!=='BYTES_VERIFIED_APPLICATION_ATTESTED')throw Error('Prispevek nima veljavnega potrdila pravilnika: '+e.event_id);
 const ids=r.applied_rule_ids;
 if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(x=>!/^R(0[1-9]|1[0-6])$/.test(x))||!ids.some(x=>/^R0[3-9]$/.test(x))||!ids.some(x=>/^R1[0-4]$/.test(x))||typeof r.application!=='string'||r.application.length<20||r.application.length>1200||!Number.isFinite(age)||age<0||age>3600000)throw Error('Neveljavna uporaba pravilnika: '+e.event_id);
}
function renderRules(){
 text('rulesVersion','v'+rulesDoc.version);
 text('rulesStatus','Dokument preverjen · SHA-256 '+RULES_DOC_SHA+'. Potrdilo branja ni dokaz vsebinske nezmotljivosti.');
 const parts=[],clean=s=>s.replace(/\*\*([^*]+)\*\*/g,'$1').replace(/`([^`]+)`/g,'$1');
 for(const line of rulesDoc.markdown.split('\n')){
  if(!line.trim())continue;
  const h=line.match(/^(#{1,3})\s+(.*)$/);
  const el=fragment(h?('h'+(h[1].length+1)):'p',line.startsWith('- ')?'ruleBullet':'',clean(h?h[2]:line));
  parts.push(el);
 }
 $('rulesText').replaceChildren(...parts);
}

function now(t){return t?new Date(t).toLocaleString('sl-SI',{timeZone:'Europe/Ljubljana'}):'—'}
function setFont(n){if(!Number.isFinite(n))n=100;font=Math.max(70,Math.round(n));document.documentElement.style.setProperty('--reader',font/100);document.documentElement.dataset.large=String(font>=200);$('fontReset').textContent=font+'%';$('fontMinus').disabled=font<=70;write(localStorage,FONT,String(font))}
function text(id,s){$(id).textContent=s??'—'}
function gate(message=''){
 generation++;busy=false;unlocked=false;key=null;token='';state=null;rulesDoc=null;rulesRelease=null;events=[];clearInterval(timer);timer=null;erase(sessionStorage,SESSION);
 $('stream').replaceChildren();$('retained').replaceChildren();$('roster').replaceChildren();$('rulesText').replaceChildren();
 ['question','updated','execution','notice','integrity','phase','steps','autosteps','engine','control','pulseTime','rulesVersion','rulesStatus'].forEach(id=>text(id,''));
 $('rulesPanel').open=false;$('app').hidden=true;$('gate').hidden=false;text('error',message);$('pw').value='';
}
function fragment(tag,cls,value){const x=document.createElement(tag);if(cls)x.className=cls;if(value!==undefined)x.textContent=String(value);return x}
function render(){
 renderRules();
 $('gate').hidden=true;$('app').hidden=false;setFont(font);
 text('phase',state.phase);text('steps',events.length);text('autosteps',state.execution.auto_steps);text('engine',state.execution.scheduled_enabled?'URNO':'PRIPRAVLJENO');
 text('updated','Zadnji zapis: '+now(state.updated_at)+' · naslednji član: '+state.members.find(x=>x.id===state.next_author_id)?.name);
 text('execution',state.execution.note);text('question',state.next_question);
 $('roster').replaceChildren(...state.members.map(m=>{const d=fragment('div','member');d.append(fragment('b','',m.id+' · '+m.name),fragment('small','',m.function));if(m.id===state.next_author_id)d.classList.add('next');return d}));
 $('retained').replaceChildren(...state.retained.map(x=>fragment('p','',x)));
 const atBottom=window.innerHeight+window.scrollY>=document.body.scrollHeight-100;
 $('stream').replaceChildren(...events.slice().reverse().map(e=>{
   const a=fragment('article','entry');a.dataset.eventId=e.event_id;
   a.append(fragment('div','meta',e.event_id+' · '+e.author_name+' · '+now(e.created_at)+' · '+(e.execution==='scheduled_model_step'?'samodejni prispevek':'začetni prispevek v seji')),
            fragment('h3','',e.title||e.author_name),fragment('div','body',e.body));
   a.append(fragment('div','meta',e.seq<=rulesRelease.legacy_through_seq?'Pred uvedbo pravilnika v1.0.0':('Pravilnik v'+e.rules_receipt.version+' · potrdilo branja in navedba uporabe')));
   if(e.sources?.length){const links=fragment('p','sources');e.sources.forEach(s=>{try{const u=new URL(s.url);if(u.protocol!=='https:')return;const link=fragment('a','',s.title||u.hostname);link.href=u.href;link.target='_blank';link.rel='noreferrer noopener';links.append(link,document.createTextNode(' '))}catch{}});a.append(links)}
   return a;
 }));
 if(atBottom&&events.length>1){} // Never move the reader unexpectedly.
 text('integrity','AES-GCM + veriga SHA-256 preverjena · '+events.length+' prispevkov');
}
async function pollControl(){
 try{const c=await json('/api/wl/runtime?t='+Date.now());
  const age=Date.now()-Date.parse(c.server_time);if(!c.ok||!Number.isFinite(age)||Math.abs(age)>180000)throw Error();
  text('control',c.paused?'ZAUSTAVLJENO':'DOVOLJENO');text('pulseTime',now(c.last_pulse_at));
 }catch{text('control','NI PREVERJENO');text('pulseTime','Strežnik ni dosegljiv')}
}
async function refresh(first=false){
 if(busy||!key){if(first)throw Error('Preverjanje je že v teku.');return;}const g=generation,k=key;busy=true;text('notice','Preverjam nove prispevke …');
 try{
  const loaded=rulesDoc?{doc:rulesDoc,release:rulesRelease}:await checkedRules(k);
  const candidate=await open(await json(FEED+'state.enc.json?t='+Date.now()),k,'WL:state:'+vault.vault_id);
  if(candidate.schema!=='wl.state.v2'||candidate.run_id!=='WL-RHP11-20260912'||candidate.members.length!==11)throw Error('Neveljavno stanje raziskave.');
  if(state&&candidate.revision<state.revision)throw Error('Vir je vrnil starejše stanje; ohranjam zadnje preverjeno.');
  const next=[];let parent=null;
  for(const ref of candidate.entries){
   if(ref.seq!==next.length+1||ref.event_id!=='e'+String(ref.seq).padStart(6,'0')||ref.path!=='data/entries/'+ref.event_id+'.enc.json')throw Error('Vrzeli v indeksu prispevkov.');
   let e=events.find(x=>x.event_id===ref.event_id&&x._verifiedHash===ref.plain_sha256);
   if(!e){const box=await json(FEED+ref.path);e=await open(box,k,'WL:event:'+ref.event_id);const actual=await hash(te.encode(canonical(e)));if(actual!==ref.plain_sha256)throw Error('Hash prispevka ne ustreza indeksu.');Object.defineProperty(e,'_verifiedHash',{value:actual,enumerable:false})}
   if(e.event_id!==ref.event_id||e.seq!==ref.seq||e.run_id!==candidate.run_id)throw Error('Prispevek pripada drugi raziskavi.');
   if(e.parent_event_id!==(parent?.event_id??null)||e.parent_sha256!==(parent?parent._verifiedHash:null))throw Error('Prekinjena veriga prispevkov.');
   checkRulesReceipt(e,loaded.release);next.push(e);parent=e;
  }
  if(g!==generation)return;rulesDoc=loaded.doc;rulesRelease=loaded.release;state=candidate;events=next;unlocked=true;render();await pollControl();if(g!==generation)return;text('notice','Preverjeno '+now(new Date().toISOString())+' · naslednje preverjanje čez minuto.');
  if(!timer)timer=setInterval(()=>{if(unlocked&&!document.hidden)refresh().catch(()=>{})},60000);
 }catch(e){if(g!==generation)return;text('notice',e.message);if(first)throw e}finally{if(g===generation)busy=false}
}
async function unlock(e){e.preventDefault();const unlockGeneration=generation;$('unlock').disabled=true;text('error','Odklepam …');
 try{
  vault=await json(ROOT+'vault.json');if(vault.format!=='WL-VAULT-2'||vault.kdf.iterations<600000||vault.kdf.iterations>2000000)throw Error();
  const material=await crypto.subtle.importKey('raw',te.encode($('pw').value),'PBKDF2',false,['deriveKey']);$('pw').value='';
  const kek=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64(vault.kdf.salt),iterations:vault.kdf.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
  const w=await open(vault.wrap,kek,'WL:wrap:'+vault.vault_id);key=await aes(b64(w.key));token=(await open(vault.control,key,'WL:control:'+vault.vault_id)).token;
  await refresh(true);if(unlockGeneration!==generation||!unlocked||!key)return;write(sessionStorage,SESSION,JSON.stringify({vault:vault.vault_id,key:w.key}));
 }catch(e){gate(e.message&&e.message.includes('Vir')?e.message:'Odklep ni uspel. Preveri geslo in povezavo.')}finally{$('unlock').disabled=false}
}
async function control(action){
 try{const r=await fetch('/api/wl/runtime',{method:'POST',headers:{'Content-Type':'application/json','X-WL-Control':token},body:JSON.stringify({action,source:'manual'}),cache:'no-store',credentials:'omit',redirect:'error'});
  if(!r.ok)throw Error('Ukaz ni potrjen ('+r.status+').');await r.json();await pollControl();text('notice',action==='pulse'?'Pulse je zapisan; sam ne sproži modela.':action==='pause'?'Premor shranjen. Naslednji samodejni korak ga bo upošteval.':'Nadaljevanje shranjeno. Naslednji korak sledi ob zagonu izvajalnika.');
 }catch(e){text('notice',e.message)}
}
$('login').addEventListener('submit',unlock);$('show').onclick=()=>{const p=$('pw');p.type=p.type==='password'?'text':'password';$('show').textContent=p.type==='password'?'Pokaži':'Skrij'};
$('fontMinus').onclick=()=>setFont(font-10);$('fontPlus').onclick=()=>setFont(font+10);$('fontReset').onclick=()=>setFont(100);
$('theme').onclick=()=>{const t=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=t;write(localStorage,THEME,t)};
$('lock').onclick=()=>gate('Zaklenjeno.');$('refresh').onclick=()=>refresh();['pause','resume','pulse'].forEach(a=>$(a).onclick=()=>control(a));
font=Number(read(localStorage,FONT)||'100');setFont(font);document.documentElement.dataset.theme=read(localStorage,THEME)||'dark';
document.addEventListener('visibilitychange',()=>{if(unlocked&&!document.hidden)refresh()});
window.addEventListener('pageshow',()=>{if(unlocked&&!read(sessionStorage,SESSION))gate()});
(async()=>{try{const s=JSON.parse(read(sessionStorage,SESSION)||'null');if(!s)return;vault=await json(ROOT+'vault.json');if(s.vault!==vault.vault_id)throw Error();key=await aes(b64(s.key));token=(await open(vault.control,key,'WL:control:'+vault.vault_id)).token;await refresh(true)}catch{gate()}})();
})();
