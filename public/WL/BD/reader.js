/* WL BD private summary reader. Uses the same in-tab WL v2 session key as /WL/. */
(()=>{'use strict';
const $=id=>document.getElementById(id),te=new TextEncoder(),td=new TextDecoder('utf-8',{fatal:true});
const ROOT='/WL/',SESSION='wl-v2-session';
let vault=null,key=null,font=100,timer=null;
const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function read(store,k){try{return store.getItem(k)}catch{return null}}
function write(store,k,v){try{store.setItem(k,v)}catch{}}
function erase(store,k){try{store.removeItem(k)}catch{}}
async function sha(x){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',x))].map(v=>v.toString(16).padStart(2,'0')).join('')}
async function aes(raw){return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt'])}
async function openBox(box,k,aad){
 if(box.format!=='WL-ENC-2')throw Error('Neznana oblika podatkov.');
 const c=b64(box.cipher);
 if(await sha(c)!==box.sha256)throw Error('Celovitost šifriranih podatkov ni pravilna.');
 return JSON.parse(td.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(box.iv),additionalData:te.encode(aad)},k,c)));
}
async function fetchJSON(url){
 const r=await fetch(url+(url.includes('?')?'&':'?')+'t='+Date.now(),{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
 if(!r.ok)throw Error('Vir podatkov ni dosegljiv ('+r.status+').');
 return r.json();
}
function setFont(n){
 font=Math.max(70,Math.round(Number.isFinite(n)?n:100));
 document.documentElement.style.setProperty('--reader',font/100);
 $('reset').textContent=font+'%';
}
function clearView(message='',forgetSession=false){
 key=null;vault=null;clearInterval(timer);timer=null;
 if(forgetSession)erase(sessionStorage,SESSION);
 $('app').hidden=true;$('gate').hidden=false;$('pw').value='';$('error').textContent=message;
}
function showApp(){
 $('gate').hidden=true;$('app').hidden=false;$('error').textContent='';setFont(font);
}
function sectionNodes(list){
 return (list||[]).map(x=>{
  const d=document.createElement('div');d.className='sub';
  const h=document.createElement('h3');h.textContent=x.heading;
  const p=document.createElement('p');p.textContent=x.text;
  d.append(h,p);return d;
 });
}
function render(s){
 $('generated').textContent='Povzetek generiran: '+new Date(s.generated_at_utc).toLocaleString('sl-SI',{timeZone:'Europe/Ljubljana'});
 $('emailCount').textContent=s.frontiers.email.logical_messages;
 $('emailFrontier').textContent='A'+s.frontiers.email.A_turn+' · B'+s.frontiers.email.B_turn;
 $('rhpCount').textContent=s.frontiers.rhp.events;
 $('rhpFrontier').textContent=s.frontiers.rhp.event_id;
 $('emailTitle').textContent=s.email.title;$('emailOverview').textContent=s.email.overview;
 $('emailSections').replaceChildren(...sectionNodes(s.email.sections));$('emailAssessment').textContent=s.email.assessment;
 $('rhpTitle').textContent=s.rhp.title;$('rhpOverview').textContent=s.rhp.overview;
 $('rhpSections').replaceChildren(...sectionNodes(s.rhp.sections));$('rhpAssessment').textContent=s.rhp.assessment;
 $('status').textContent='Frontier: email A'+s.frontiers.email.A_turn+'/B'+s.frontiers.email.B_turn+' · WL '+s.frontiers.rhp.event_id+'.';
}
async function load(){
 if(!key)return;
 $('status').textContent='Preverjam najnovejši šifrirani povzetek …';
 try{
  const box=await fetchJSON('/WL/BD/summary.enc.json');
  const s=await openBox(box,key,'WL:BD:summary:v1');
  if(s.schema!=='wl.bd.summary.v1')throw Error('Neveljaven povzetek.');
  render(s);
 }catch(e){$('status').textContent=e.message||'Povzetka ni bilo mogoče prebrati.'}
}
async function activateWithRawKey(rawKeyB64,persist=true){
 key=await aes(b64(rawKeyB64));
 await openBox(vault.control,key,'WL:control:'+vault.vault_id);
 if(persist)write(sessionStorage,SESSION,JSON.stringify({vault:vault.vault_id,key:rawKeyB64}));
 showApp();await load();
 clearInterval(timer);timer=setInterval(()=>{if(!document.hidden)load()},14400000);
}
async function unlockWithPassword(){
 $('unlock').disabled=true;$('error').textContent='Odklepam …';
 try{
  vault=await fetchJSON(ROOT+'vault.json');
  if(vault.format!=='WL-VAULT-2'||vault.kdf.name!=='PBKDF2-SHA256'||vault.kdf.iterations<600000||vault.kdf.iterations>2000000)throw Error('Neveljaven WL vault.');
  const password=$('pw').value;
  const material=await crypto.subtle.importKey('raw',te.encode(password),'PBKDF2',false,['deriveKey']);
  $('pw').value='';
  const kek=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64(vault.kdf.salt),iterations:vault.kdf.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
  const wrapped=await openBox(vault.wrap,kek,'WL:wrap:'+vault.vault_id);
  await activateWithRawKey(wrapped.key,true);
 }catch(err){
  clearView(err&&String(err.message).includes('Vir podatkov')?err.message:'Odklep ni uspel. Preveri geslo in povezavo.',false);
 }finally{$('unlock').disabled=false}
}
$('login').addEventListener('submit',e=>{e.preventDefault();unlockWithPassword()});
$('show').addEventListener('click',()=>{
 const p=$('pw');p.type=p.type==='password'?'text':'password';$('show').textContent=p.type==='password'?'Pokaži':'Skrij';
});
$('minus').onclick=()=>setFont(font-10);$('plus').onclick=()=>setFont(font+10);$('reset').onclick=()=>setFont(100);
$('theme').onclick=()=>document.documentElement.dataset.theme=document.documentElement.dataset.theme==='light'?'dark':'light';
$('refresh').onclick=load;$('lock').onclick=()=>clearView('Zaklenjeno.',true);
document.addEventListener('visibilitychange',()=>{if(key&&!document.hidden)load()});
(async()=>{
 try{
  const s=JSON.parse(read(sessionStorage,SESSION)||'null');
  if(!s||!s.vault||!s.key)return;
  vault=await fetchJSON(ROOT+'vault.json');
  if(vault.format!=='WL-VAULT-2'||s.vault!==vault.vault_id)throw Error();
  await activateWithRawKey(s.key,false);
 }catch{clearView('',true)}
})();
})();
