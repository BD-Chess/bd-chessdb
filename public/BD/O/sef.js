/* BD/O central private vault v1. Ciphertext only; requires active BD/O session + dedicated Sef key. */
(async function(){
'use strict';
const ROOT='/BD/O/';
const PORTAL_SESSION='bd-o-v2-session';
const SEF_SESSION='bd-o-sef-v1-session';
const TE=new TextEncoder(), TD=new TextDecoder('utf-8',{fatal:true});
const $=id=>document.getElementById(id);
const from64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const to64=u=>btoa(String.fromCharCode(...new Uint8Array(u)));
let portalCfg,sefCfg;
function setError(s){$('error').textContent=s||'';$('unlockSef').disabled=false;$('unlockSef').textContent='Odkleni sef';}
async function getJSON(path){const r=await fetch(path,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw new Error('Prenos nastavitev ni uspel.');return r.json();}
async function sha256hex(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
function validPortalSession(){try{const x=JSON.parse(sessionStorage.getItem(PORTAL_SESSION)||'null');return x&&x.vault===portalCfg.vault&&typeof x.key==='string'&&from64(x.key).length===32}catch(_){return false}}
function validSefSession(){try{const x=JSON.parse(sessionStorage.getItem(SEF_SESSION)||'null');return x&&x.release===sefCfg.release&&typeof x.key==='string'&&from64(x.key).length===32?x:null}catch(_){return null}}
function clearSef(){try{sessionStorage.removeItem(SEF_SESSION)}catch(_){} }
function clearAll(){clearSef();try{sessionStorage.removeItem(PORTAL_SESSION);sessionStorage.removeItem('_bd_o_pp')}catch(_){}location.replace(ROOT)}
async function importAes(raw){return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);}
async function decryptWithRaw(raw){
 const key=await importAes(raw),c=sefCfg.cipher;
 let out;
 try{out=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(c.iv),additionalData:TE.encode(c.aad)},key,from64(c.data)));}
 catch(_){throw new Error('Napačno Sef geslo ali poškodovan ciphertext.');}
 if(sefCfg.compression==='gzip'){const stream=new Blob([out]).stream().pipeThrough(new DecompressionStream('gzip'));out=new Uint8Array(await new Response(stream).arrayBuffer());}
 if(await sha256hex(out)!==sefCfg.plaintext_sha256)throw new Error('Preverjanje celovitosti Sefa ni uspelo.');
 const obj=JSON.parse(TD.decode(out));
 if(obj.format!=='BD-O-SEF-PAYLOAD-1'||typeof obj.html!=='string')throw new Error('Neveljavna vsebina Sefa.');
 return obj;
}
async function deriveRaw(password){
 const material=await crypto.subtle.importKey('raw',TE.encode(password),'PBKDF2',false,['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:from64(sefCfg.kdf.salt),iterations:sefCfg.kdf.iterations},material,256));
}
function installSecretControls(){
 document.querySelectorAll('.secret-value').forEach(el=>{
   const copy=document.createElement('button');copy.type='button';copy.className='copy-secret';copy.textContent='Kopiraj';
   el.insertAdjacentElement('afterend',copy);
   const toggle=()=>{el.classList.toggle('revealed');el.setAttribute('aria-label',el.classList.contains('revealed')?'Prikazana zasebna vrednost; klikni za skritje':'Skrita vrednost; klikni za prikaz')};
   el.addEventListener('click',toggle);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}});
   copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(el.textContent);copy.textContent='Kopirano';copy.classList.add('ok');setTimeout(()=>{copy.textContent='Kopiraj';copy.classList.remove('ok')},1200)}catch(_){copy.textContent='Ni uspelo'}});
 });
}
function installSearch(){
 const q=$('vaultSearch');if(!q)return;
 const rows=[...document.querySelectorAll('#register table tbody tr, #register li, #register p, #register h2, #register h3, #all213 table tbody tr, #all213 li')];
 const no=document.createElement('div');no.className='no-results';no.hidden=true;no.textContent='Ni zadetkov v trenutno naloženem sefu.';q.closest('.toolbar2').appendChild(no);
 q.addEventListener('input',()=>{
   const needle=q.value.trim().toLocaleLowerCase('sl');let visible=0;
   rows.forEach(el=>{const ok=!needle||el.textContent.toLocaleLowerCase('sl').includes(needle);el.classList.toggle('search-hidden',!ok);if(ok&&needle)visible++});
   no.hidden=!needle||visible>0;
   if(needle&&document.querySelector('#all213 .search-hidden+tr, #all213 tr:not(.search-hidden)'))$('all213').open=true;
 });
}
function installFont(){
 let p=100;const root=document.documentElement;const paint=()=>{root.style.setProperty('--scale',String(p/100));$('fontReset').textContent=p+'%';$('fontMinus').disabled=p<=70};
 $('fontMinus').onclick=()=>{p=Math.max(70,p-10);paint()};$('fontPlus').onclick=()=>{p+=10;paint()};$('fontReset').onclick=()=>{p=100;paint()};paint();
}
function render(obj){
 $('locked').hidden=true;$('content').hidden=false;$('content').innerHTML=obj.html;
 installSecretControls();installSearch();installFont();
 document.querySelectorAll('a[href]').forEach(a=>{const u=new URL(a.href,location.href);if(u.origin!==location.origin){a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';a.target='_blank'}});
}
async function unlock(password){
 const raw=await deriveRaw(password);let obj;
 try{obj=await decryptWithRaw(raw);sessionStorage.setItem(SEF_SESSION,JSON.stringify({release:sefCfg.release,key:to64(raw)}));}
 finally{raw.fill(0)}
 render(obj);
}
$('lockSef').onclick=()=>{clearSef();location.reload()};$('lockAll').onclick=clearAll;
try{
 if(!window.isSecureContext||!crypto.subtle||!window.DecompressionStream)throw new Error('Odpri HTTPS naslov v posodobljenem brskalniku.');
 portalCfg=await getJSON(ROOT+'vault.json');sefCfg=await getJSON(ROOT+'sef-config.json');
 if(portalCfg.format!=='BD-O-VAULT-2'||sefCfg.format!=='BD-O-SEF-1'||sefCfg.kdf.iterations<600000)throw new Error('Neveljavna nastavitev zaščite.');
 if(!validPortalSession()){$('gateLead').textContent='Sef je dostopen samo iz že odklenjenega osebnega portala.';$('portalRequired').hidden=false;return;}
 $('gateLead').textContent='Osebna seja je potrjena. Vnesi še namenski Sef master ključ.';$('sefForm').hidden=false;
 const prior=validSefSession();if(prior){try{const raw=from64(prior.key),obj=await decryptWithRaw(raw);render(obj);return}catch(_){clearSef()}}
 $('showPw').onclick=()=>{const i=$('sefPw');i.type=i.type==='password'?'text':'password';$('showPw').textContent=i.type==='password'?'Pokaži':'Skrij'};
 $('sefForm').addEventListener('submit',async e=>{e.preventDefault();let value=$('sefPw').value;if(!value)return;$('unlockSef').disabled=true;$('unlockSef').textContent='Odklepam…';setError('');try{await unlock(value);value='';$('sefPw').value=''}catch(err){clearSef();setError(err.message||'Odklepanje ni uspelo.')}});
}catch(err){$('gateLead').textContent='Sef trenutno ni dosegljiv.';$('portalRequired').hidden=true;$('sefForm').hidden=true;const p=document.createElement('p');p.className='err';p.textContent=err.message||'Napaka zaščite.';document.querySelector('.gate').appendChild(p)}
})();
