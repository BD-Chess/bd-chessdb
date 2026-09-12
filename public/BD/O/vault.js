/* BD O vault v2: one password entry, authenticated ciphertext, no plaintext password storage. */
(async function () {
'use strict';
const ROOT='/BD/O/', SESSION='bd-o-v2-session', NOTES='bd-o-private-notes-v2';
const TE=new TextEncoder(), TD=new TextDecoder('utf-8',{fatal:true});
const $=id=>document.getElementById(id);
const from64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const to64=u=>btoa(String.fromCharCode(...new Uint8Array(u)));
const allowedNotes=['bd-o-font-size','bd-cardio-prep-v1','bd-cardio-prep-v1-size'];
let cfg, master, bundle, sessionValue, storeData={}, queue=Promise.resolve();
let nativeStore, nativeSession;
const aad=kind=>TE.encode('BD/O:v2:'+kind+':'+(kind==='data'?cfg.release:cfg.vault));
function showError(text){const e=$('error');if(e)e.textContent=text;const b=$('unlock');if(b){b.disabled=false;b.textContent='Odkleni';}}
async function getText(path){
 const r=await fetch(ROOT+path,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
 if(!r.ok)throw new Error('Prenos zaščitenih podatkov ni uspel. Osveži stran.');
 return r.text();
}
async function digest(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
function validPage(s){return typeof s==='string'&&cfg.pages.includes(s);}
function loginURL(page){return ROOT+'index.html'+(page!=='index.html'?'?next='+encodeURIComponent(page):'');}
function readSession(){try{const x=JSON.parse(nativeSession.getItem(SESSION)||'null');return x&&x.vault===cfg.vault&&typeof x.key==='string'&&from64(x.key).length===32?x:null;}catch(_){return null;}}
function eraseSession(){try{nativeSession.removeItem(SESSION);nativeSession.removeItem('_bd_o_pp');}catch(_){}}
async function importMaster(raw){return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);}
async function openBundle(){
 const chunks=await Promise.all(cfg.data.parts.map(async p=>{const t=await getText(p.path);if(await digest(TE.encode(t))!==p.sha256)throw new Error('Preverjanje celovitosti ni uspelo. Osveži stran.');return t;}));
 const bytes=from64(chunks.join(''));
 if(await digest(bytes)!==cfg.data.sha256)throw new Error('Preverjanje celovitosti ni uspelo.');
 const compressed=await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(cfg.data.iv),additionalData:aad('data')},master,bytes);
 // Consume the readable stream concurrently: no writer/read deadlock on larger pages.
 const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
 const json=TD.decode(await new Response(stream).arrayBuffer());
 bundle=JSON.parse(json);
 if(bundle.format!=='BD-O-PAGES-2'||!Array.isArray(bundle.fragments)||!bundle.pages||Object.keys(bundle.pages).length!==cfg.pages.length||!cfg.pages.every(p=>Array.isArray(bundle.pages[p])))throw new Error('Neveljaven zaščiten arhiv.');
}
function decodedPage(name){return bundle.pages[name].map(x=>typeof x==='number'?bundle.fragments[x]:x).join('');}
async function persistNotes(){
 const payload=JSON.stringify(storeData);
 queue=queue.then(async()=>{
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad('notes')},master,TE.encode(payload));
  nativeStore.setItem(NOTES,JSON.stringify({vault:cfg.vault,iv:to64(iv),cipher:to64(cipher)}));
 });
 return queue;
}
async function loadNotes(){
 const saved=nativeStore.getItem(NOTES);
 if(saved){const x=JSON.parse(saved);if(x.vault!==cfg.vault)throw new Error('Zapiski pripadajo drugi različici ključa. Ohranjeni so; potreben je prenos.');
  storeData=JSON.parse(TD.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(x.iv),additionalData:aad('notes')},master,from64(x.cipher))));}
 let migrate=false;
 for(const key of allowedNotes){const value=nativeStore.getItem(key);if(value!==null){if(!(key in storeData))storeData[key]=value;migrate=true;}}
 if(migrate){await persistNotes();for(const key of allowedNotes)nativeStore.removeItem(key);}
}
function storageWarning(){let el=$('bdo-storage-warning');if(!el){el=document.createElement('p');el.id='bdo-storage-warning';el.setAttribute('role','alert');el.style.cssText='padding:16px;background:#321922;color:#fff';document.body.prepend(el);}el.textContent='Zapiski se niso shranili. Pred zapiranjem jih kopiraj.';}
const safeStore={getItem:k=>Object.hasOwn(storeData,k)?storeData[k]:null,setItem:(k,v)=>{if(!allowedNotes.includes(k))throw new Error('Unsupported note key');storeData[k]=String(v);persistNotes().catch(storageWarning);},removeItem:k=>{delete storeData[k];persistNotes().catch(storageWarning);}};
async function lock(){
 try{await queue;}catch(_){storageWarning();return;}
 eraseSession();master=null;bundle=null;storeData={};document.documentElement.style.visibility='hidden';location.replace(ROOT+'index.html');
}
function guard(){if(!readSession()){document.documentElement.style.visibility='hidden';location.replace(ROOT+'index.html');return false;}document.documentElement.style.visibility='';return true;}
function afterRender(){
 document.body.dataset.bdoUnlocked='true';
 let button=$('lockNow');
 if(!button){button=document.createElement('button');button.id='lockNow';button.type='button';button.textContent='Zakleni';const box=document.querySelector('.tools,.top-actions,.actions')||document.body;box.appendChild(button);}
 button.onclick=lock;
 window.addEventListener('pageshow',guard);
 window.addEventListener('pagehide',()=>{document.documentElement.style.visibility='hidden';});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)guard();});
 document.addEventListener('click',async ev=>{
  const a=ev.target.closest('a[href]');if(!a||ev.defaultPrevented||ev.button!==0||ev.metaKey||ev.ctrlKey||ev.shiftKey||a.target==='_blank')return;
  const url=new URL(a.href,location.href);
  if(url.origin!==location.origin){a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';return;}
  if(url.hash&&url.pathname===location.pathname&&url.search===location.search)return;
  ev.preventDefault();try{await queue;location.assign(url.href);}catch(_){storageWarning();}
 });
 const note=document.createElement('p');note.className='footer';note.style.cssText='font:14px/1.5 system-ui;color:#aebdd0;text-align:center;padding:14px';
 note.textContent='Odklenjeno v tem zavihku. Po uporabi izberi Zakleni. Zapiski so šifrirani v tem brskalniku; niso sinhronizirani med napravami.';document.body.appendChild(note);
}
function render(name){
 let html=decodedPage(name);
 // Only storage plumbing changes; original article markup and wording stay intact.
 html=html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi,(_,attrs,body)=>'<script'+attrs+'>'+body.replace(/\blocalStorage\b/g,'window.BDO.store')+'<\/script>');
 html=html.replace('</head>','<meta name="robots" content="noindex,nofollow,noarchive,nosnippet"><meta name="referrer" content="no-referrer"></head>');
 html=html.replace('</body>','<script>window.BDO.afterRender();<\/script></body>');
 window.BDO={store:safeStore,afterRender,lock};
 document.open();document.write(html);document.close();
}
async function unlock(ev){
 ev.preventDefault();const input=$('pw'),button=$('unlock');let value=input.value;
 if(!value){showError('Vnesi geslo.');return;}
 button.disabled=true;button.textContent='Odklepam…';$('error').textContent='';
 try{
  const material=await crypto.subtle.importKey('raw',TE.encode(value),'PBKDF2',false,['deriveKey']);
  value='';input.value='';
  const kek=await crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:from64(cfg.kdf.salt),iterations:cfg.kdf.iterations},material,{name:'AES-GCM',length:256},false,['decrypt']);
  let raw;
  try{raw=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(cfg.wrap.iv),additionalData:aad('wrap')},kek,from64(cfg.wrap.cipher)));}catch(_){throw new Error('Napačno geslo.');}
  master=await importMaster(raw);await openBundle();await loadNotes();
  sessionValue={vault:cfg.vault,key:to64(raw)};raw.fill(0);
  nativeSession.setItem(SESSION,JSON.stringify(sessionValue));nativeSession.removeItem('_bd_o_pp');
  const next=new URLSearchParams(location.search).get('next');
  if(validPage(next)&&next!=='index.html'){location.replace(ROOT+next);return;}
  if(location.search)history.replaceState(null,'',ROOT+'index.html');render('index.html');
 }catch(err){master=null;bundle=null;eraseSession();showError(err.message||'Odklepanje ni uspelo.');}
}
try{
 if(!window.isSecureContext||!crypto.subtle||!window.DecompressionStream)throw new Error('Odpri HTTPS naslov v posodobljenem brskalniku Safari, Chrome ali Edge.');
 nativeStore=window.localStorage;nativeSession=window.sessionStorage;
 const probe='bdo-test';nativeSession.setItem(probe,'1');nativeSession.removeItem(probe);
 cfg=JSON.parse(await getText('vault.json'));
 if(cfg.format!=='BD-O-VAULT-2'||cfg.kdf.iterations<600000)throw new Error('Neveljavna nastavitev zaščite.');
 const leaf=decodeURIComponent(location.pathname.split('/').filter(Boolean).pop()||'');
 const page=leaf==='O'?'index.html':leaf.endsWith('.html')?leaf:leaf+'.html';
 const target=validPage(page)?page:'index.html';
 const existing=readSession();
 if(!existing&&target!=='index.html'){location.replace(loginURL(target));return;}
 $('gate').hidden=false;
 if(existing){try{master=await importMaster(from64(existing.key));await openBundle();await loadNotes();sessionValue=existing;render(target);return;}catch(_){eraseSession();master=null;bundle=null;if(target!=='index.html'){location.replace(loginURL(target));return;}}}
 $('form').addEventListener('submit',unlock);$('unlock').disabled=false;
 $('show').addEventListener('click',()=>{const p=$('pw');p.type=p.type==='password'?'text':'password';$('show').textContent=p.type==='password'?'Pokaži':'Skrij';});
}catch(err){if($('gate'))$('gate').hidden=false;showError(err.message||'Zaščiteni portal trenutno ni dosegljiv.');}
})();
