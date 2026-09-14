/* BD/O central private vault v2. Uses the already-authenticated BD/O tab session; no second password. */
(async function(){
'use strict';
const ROOT='/BD/O/', PORTAL_SESSION='bd-o-v2-session', OLD_SEF_SESSION='bd-o-sef-v1-session';
const TE=new TextEncoder(), TD=new TextDecoder('utf-8',{fatal:true});
const $=id=>document.getElementById(id);
const from64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
let portalCfg,sefCfg;
async function getJSON(path){const r=await fetch(path,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw new Error('Prenos zasebnih nastavitev ni uspel.');return r.json();}
async function sha256hex(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
function portalSession(){try{const x=JSON.parse(sessionStorage.getItem(PORTAL_SESSION)||'null');return x&&x.vault===portalCfg.vault&&typeof x.key==='string'&&from64(x.key).length===32?x:null}catch(_){return null}}
function lockAll(){try{sessionStorage.removeItem(PORTAL_SESSION);sessionStorage.removeItem('_bd_o_pp');sessionStorage.removeItem(OLD_SEF_SESSION)}catch(_){}location.replace(ROOT)}
async function openSef(raw){
 if(sefCfg.format!=='BD-O-SEF-2'||sefCfg.vault!==portalCfg.vault)throw new Error('Sef ne pripada trenutni BD/O različici.');
 const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);
 const c=sefCfg.cipher;
 const chunks=await Promise.all(sefCfg.data.parts.map(async part=>{const r=await fetch(ROOT+part.path,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw new Error('Prenos Sef podatkov ni uspel.');const t=await r.text();if(await sha256hex(TE.encode(t))!==part.sha256)throw new Error('Preverjanje celovitosti Sef dela ni uspelo.');return t;}));
 const encoded=chunks.join('');if(await sha256hex(TE.encode(encoded))!==sefCfg.data.sha256)throw new Error('Preverjanje celovitosti Sefa ni uspelo.');
 let out;
 try{out=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(c.iv),additionalData:TE.encode(c.aad)},key,from64(encoded)));}
 catch(_){throw new Error('BD/O seja ne more odpreti Sefa. Osveži Osebno in poskusi znova.');}
 if(sefCfg.compression==='gzip'){const stream=new Blob([out]).stream().pipeThrough(new DecompressionStream('gzip'));out=new Uint8Array(await new Response(stream).arrayBuffer());}
 if(await sha256hex(out)!==sefCfg.plaintext_sha256)throw new Error('Preverjanje celovitosti Sefa ni uspelo.');
 const obj=JSON.parse(TD.decode(out));
 if(obj.format!=='BD-O-SEF-PAYLOAD-1'||typeof obj.html!=='string')throw new Error('Neveljavna vsebina Sefa.');
 return obj;
}
function installSecretControls(){
 document.querySelectorAll('.secret-value').forEach(el=>{
   const copy=document.createElement('button');copy.type='button';copy.className='copy-secret';copy.textContent='Kopiraj';el.insertAdjacentElement('afterend',copy);
   const toggle=()=>{el.classList.toggle('revealed');el.setAttribute('aria-label',el.classList.contains('revealed')?'Prikazana zasebna vrednost; klikni za skritje':'Skrita vrednost; klikni za prikaz')};
   el.addEventListener('click',toggle);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}});
   copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(el.textContent);copy.textContent='Kopirano';copy.classList.add('ok');setTimeout(()=>{copy.textContent='Kopiraj';copy.classList.remove('ok')},1200)}catch(_){copy.textContent='Ni uspelo'}});
 });
}
function installSearch(){
 const q=$('vaultSearch');if(!q)return;
 const rows=[...document.querySelectorAll('#register table tbody tr, #register li, #register p, #register h2, #register h3, #all213 table tbody tr, #all213 li')];
 const no=document.createElement('div');no.className='no-results';no.hidden=true;no.textContent='Ni zadetkov v trenutno naloženem sefu.';q.closest('.toolbar2').appendChild(no);
 q.addEventListener('input',()=>{const needle=q.value.trim().toLocaleLowerCase('sl');let visible=0;rows.forEach(el=>{const ok=!needle||el.textContent.toLocaleLowerCase('sl').includes(needle);el.classList.toggle('search-hidden',!ok);if(ok&&needle)visible++});no.hidden=!needle||visible>0;if(needle&&visible)$('all213').open=true;});
}
function installFont(){let p=100;const root=document.documentElement;const paint=()=>{root.style.setProperty('--scale',String(p/100));$('fontReset').textContent=p+'%';$('fontMinus').disabled=p<=70};$('fontMinus').onclick=()=>{p=Math.max(70,p-10);paint()};$('fontPlus').onclick=()=>{p+=10;paint()};$('fontReset').onclick=()=>{p=100;paint()};paint();}
function render(obj){$('loading').hidden=true;$('content').hidden=false;$('content').innerHTML=obj.html;installSecretControls();installSearch();installFont();document.querySelectorAll('a[href]').forEach(a=>{const u=new URL(a.href,location.href);if(u.origin!==location.origin){a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';a.target='_blank'}});}
$('lockAll').onclick=lockAll;
try{
 if(!window.isSecureContext||!crypto.subtle||!window.DecompressionStream)throw new Error('Odpri HTTPS naslov v posodobljenem brskalniku.');
 portalCfg=await getJSON(ROOT+'vault.json');sefCfg=await getJSON(ROOT+'sef-config.json');
 if(portalCfg.format!=='BD-O-VAULT-2')throw new Error('Neveljavna BD/O nastavitev.');
 const session=portalSession();
 if(!session){location.replace(ROOT);return;}
 try{sessionStorage.removeItem(OLD_SEF_SESSION)}catch(_){}
 const raw=from64(session.key);const obj=await openSef(raw);raw.fill(0);render(obj);
}catch(err){$('loading').hidden=false;$('loadingTitle').textContent='Sef se ni odprl';$('loadingText').textContent=err.message||'Napaka zaščite.';const back=$('backLink');if(back)back.hidden=false;}
})();
