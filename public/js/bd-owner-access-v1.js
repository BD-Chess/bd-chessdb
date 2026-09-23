/* BD owner access v1. Resource-scoped random keys; no password persistence. Production owner-unification entrypoint. */
(()=>{'use strict';
const node=document.getElementById('bd-access-data');if(!node)return;
const pack=JSON.parse(node.textContent),te=new TextEncoder(),td=new TextDecoder('utf-8',{fatal:true});
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const base64=x=>{let s='';for(const b of x)s+=String.fromCharCode(b);return btoa(s)};
const PREFIX='bd-access-v1:',storageKey=PREFIX+pack.pair,ttl=8*60*60*1000;
let master=null,epoch=0,bar,form,input,status,submit,lockButton,restoring=false,rendering=false,expiryTimer;
const original=new Map();
const assetURLs=new Map();
const sl=()=>document.documentElement.lang?.startsWith('sl')||document.documentElement.dataset.lang==='sl';
const say=(en,si)=>sl()?si:en;
function forget(){try{for(let i=sessionStorage.length-1;i>=0;i--){const key=sessionStorage.key(i);if(key.startsWith(PREFIX))sessionStorage.removeItem(key)}}catch(_){} }
function lock(){epoch++;master=null;forget();location.reload()}
function saved(){try{const a=JSON.parse(sessionStorage.getItem(storageKey)||'null');return a&&a.path===pack.path&&a.pair===pack.pair&&a.expires>Date.now()&&a.expires<=Date.now()+ttl&&bytes(a.key).length===32?a:null}catch(_){return null}}
function remember(key){clearTimeout(expiryTimer);expiryTimer=setTimeout(lock,ttl);try{sessionStorage.setItem(storageKey,JSON.stringify({pair:pack.pair,path:pack.path,key:base64(key),expires:Date.now()+ttl}))}catch(_){/* This tab still works without storage. */}}
async function importKey(raw,uses=['decrypt']){return crypto.subtle.importKey('raw',raw,'AES-GCM',false,uses)}
async function unwrap(password){
 if(pack.schema!=='BD_ACCESS_V1'||pack.kdf.name!=='PBKDF2-SHA256'||pack.kdf.iterations!==600000)throw Error('format');
 const material=await crypto.subtle.importKey('raw',te.encode(password),'PBKDF2',false,['deriveKey']);
 const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(pack.kdf.salt),iterations:pack.kdf.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
 return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(pack.wrap.iv),additionalData:te.encode('BD_ACCESS_V1:'+pack.path+':'+pack.pair+':wrap')},key,bytes(pack.wrap.cipher)));
}
async function decodeAll(raw){
 const key=await importKey(raw),out=[];
 for(let i=0;i<pack.units.length;i++){
  const u=pack.units[i];if(u.id!==i||u.aad!=='BD_ACCESS_V1:'+pack.path+':'+pack.pair+':'+i+':'+u.kind)throw Error('identity');
  const zipped=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(u.iv),additionalData:te.encode(u.aad)},key,bytes(u.cipher));
  const plain=await new Response(new Blob([zipped]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  out.push(u.kind==='asset'?new Uint8Array(plain):td.decode(plain));
 }
 return out;
}
async function scripts(root){
 for(const old of [...root.querySelectorAll('script')]){
  const n=document.createElement('script');for(const a of old.attributes)n.setAttribute(a.name,a.value);
  if(old.src&&!old.async&&!old.defer){await new Promise((resolve,reject)=>{n.onload=resolve;n.onerror=reject;old.replaceWith(n)})}
  else{n.textContent=old.textContent;old.replaceWith(n)}
 }
}
function addLock(){const b=document.createElement('button');b.type='button';b.id='bd-owner-lock';b.textContent=say('Lock','Zakleni');b.style.cssText='position:fixed;right:12px;bottom:12px;z-index:2147483000;padding:9px 16px;border:1px solid #697586;border-radius:8px;background:#17212d;color:white;cursor:pointer';b.addEventListener('click',lock);document.body.appendChild(b)}
function showAssets(){for(const el of document.querySelectorAll('img[src],source[src]')){const url=assetURLs.get(new URL(el.getAttribute('src'),location.href).pathname);if(url)el.src=url}}
function documentPresentation(text){
 if(pack.path!=='AI8/AI8-state.html'||text.includes('data-ai8-member-collapse-v1'))return text;
 if(!text.includes('</head>')||!text.includes('</body>'))return text;
 const style='<link rel="stylesheet" href="./ai8-member-collapse-v1.css" data-ai8-member-collapse-v1="style">';
 const script='<scr'+'ipt defer src="./ai8-member-collapse-v1.js" data-ai8-member-collapse-v1="script"></scr'+'ipt>';
 return text.replace('</head>',style+'</head>').replace('</body>',script+'</body>');
}
async function display(contents,token){
 // All authentication completes before any protected content becomes visible.
 if(token!==epoch)throw Error('cancelled');
 for(const u of pack.units)if(!['document','engine','asset'].includes(u.kind)&&!document.getElementById(u.target))throw Error('missing target');
 rendering=true;document.documentElement.dataset.bdOwnerActive='true';
 for(let i=0;i<pack.units.length;i++){const u=pack.units[i];if(u.kind==='asset'){const ext=u.target.split('.').pop().toLowerCase();const type=({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',svg:'image/svg+xml'})[ext]||'application/octet-stream';assetURLs.set('/'+u.target,URL.createObjectURL(new Blob([contents[i]],{type})))}}
 for(let i=0;i<pack.units.length;i++){
  const u=pack.units[i],text=contents[i];
  if(u.kind==='asset')continue;
  if(u.kind==='document'){
   const onload=()=>{showAssets();addLock();window.addEventListener('pageshow',e=>{if(e.persisted&&!saved())location.reload()});};
   const rendered=documentPresentation(text);document.open();document.write(rendered);document.close();
   if(document.readyState==='complete')onload();else window.addEventListener('load',onload,{once:true});
   return;
  }
  if(u.kind==='engine'){
   const s=document.createElement('script');s.textContent=text;document.body.appendChild(s);
   // Existing classic-script binding retained for the original application controls.
   const ready=document.createElement('script');ready.textContent="_engineReady=true; if(typeof drawEquityChart==='function')drawEquityChart(); if(typeof addLog==='function')addLog('system','Engine unlocked');";document.body.appendChild(ready);
  }else{
   const el=document.getElementById(u.target);if(!el)throw Error('missing target');
   if(!original.has(el))original.set(el,el.innerHTML);
   const target=el.querySelector('._8z-ct,.shield-content,.shield-private-content,.trading-shield-content')||el;
   target.innerHTML=text;target.hidden=false;target.style.display='';
   for(const hint of el.querySelectorAll('._8z-lui,.shield-locked,.shield-lock-panel,.shield-gate'))hint.hidden=true;
   el.classList.remove('_8z-lk','locked');el.classList.add('_8z-ok');el.dataset.bdAccess='open';
   if(el.matches('details'))el.open=true;await scripts(target);
  }
 }
 showAssets();bar.remove();addLock();document.documentElement.dataset.bdOwnerUnits=String(pack.units.length);document.dispatchEvent(new Event('bd-owner-open'));
}
async function go(event){
 event?.preventDefault();if(restoring)return;const token=++epoch;submit.disabled=true;status.textContent=say('Opening…','Odpiram …');
 let raw=null;
 try{raw=await unwrap(input.value);const contents=await decodeAll(raw);if(token!==epoch)return;remember(raw);master=raw;input.value='';await display(contents,token)}
 catch(_){if(token!==epoch)return;master=null;try{sessionStorage.removeItem(storageKey)}catch(_){}if(rendering){document.documentElement.style.visibility='hidden';lock();return;}input.value='';status.textContent=say('Unlock failed. No content opened.','Odklep ni uspel. Vsebina ni bila odprta.');submit.disabled=false;input.focus()}
 finally{raw?.fill(0)}
}
function init(){
 bar=document.createElement('aside');bar.id='bd-owner-access';bar.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:2147482000;background:#111b28;color:#eef4fc;border-top:1px solid #617188;padding:10px;box-sizing:border-box';
 form=document.createElement('form');form.style.cssText='display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px;margin:0';
 const identity=document.createElement('input');identity.type='text';identity.name='username';identity.autocomplete='username';identity.value='bd-owner';identity.tabIndex=-1;identity.setAttribute('aria-hidden','true');identity.style.cssText='position:fixed;left:-10000px;width:1px;height:1px';form.appendChild(identity);
 const label=document.createElement('label');label.htmlFor='bd-owner-password';label.textContent=say('Owner access','Lastniški dostop');form.appendChild(label);
 input=document.createElement('input');input.id='bd-owner-password';input.type='password';input.name='password';input.autocomplete='current-password';input.required=true;input.style.cssText='width:200px;max-width:80vw;padding:8px;background:#07111c;color:#fff;border:1px solid #667586;border-radius:6px';form.appendChild(input);
 submit=document.createElement('button');submit.type='submit';submit.textContent=say('Unlock','Odkleni');submit.style.cssText='padding:9px 16px;border-radius:6px;cursor:pointer';form.appendChild(submit);
 status=document.createElement('span');status.setAttribute('role','status');status.setAttribute('aria-live','polite');form.appendChild(status);form.addEventListener('submit',go);bar.appendChild(form);document.body.appendChild(bar);
 const prior=saved();if(prior){restoring=true;expiryTimer=setTimeout(lock,Math.max(1,prior.expires-Date.now()));const token=++epoch;decodeAll(bytes(prior.key)).then(contents=>display(contents,token)).catch(()=>{try{sessionStorage.removeItem(storageKey)}catch(_){}if(rendering){document.documentElement.style.visibility='hidden';lock();return;}status.textContent=say('Enter the owner password.','Vnesi lastniško geslo.');}).finally(()=>{restoring=false})}
}
document.addEventListener('bd-owner-lock',lock);
window.addEventListener('pagehide',()=>{master=null;input&&(input.value='');if(rendering)document.documentElement.style.visibility='hidden'});
window.addEventListener('pageshow',e=>{if(e.persisted){if(!saved())location.reload();else document.documentElement.style.visibility=''}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();