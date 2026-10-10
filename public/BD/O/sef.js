/* BD/O central private vault v2. Uses the already-authenticated BD/O tab session; no second password. */
(async function(){
'use strict';
const ROOT=new URL('./',location.href).pathname, PORTAL_SESSION='bd-o-v2-session', OLD_SEF_SESSION='bd-o-sef-v1-session';
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
 const extra=await openExtra(raw);if(extra)obj.html+=extra.html;
 const startme=await openExtra(raw,'sef-startme.json');if(startme)obj.html+=startme.html;
 return obj;
}
async function openExtra(raw,configFile='sef-extra.json'){
 let cfg;
 try{
  const r=await fetch(ROOT+configFile,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
  if(r.status===404)return null;
  if(!r.ok)throw new Error('Prenos dodatka Sefa ni uspel.');
  cfg=await r.json();
 }catch(err){if(err&&err.message==='Prenos dodatka Sefa ni uspel.')throw err;return null;}
 if(cfg.format!=='BD-O-SEF-EXTRA-CONFIG-1'||cfg.vault!==portalCfg.vault)return null;
 const r=await fetch(ROOT+cfg.data.path,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
 if(!r.ok)throw new Error('Prenos dodatka Sefa ni uspel.');
 const encoded=await r.text();
 if(await sha256hex(TE.encode(encoded))!==cfg.data.sha256)throw new Error('Preverjanje celovitosti dodatka Sefa ni uspelo.');
 const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);
 let out;
 try{out=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:from64(cfg.cipher.iv),additionalData:TE.encode(cfg.cipher.aad)},key,from64(encoded)));}
 catch(_){throw new Error('BD/O seja ne more odpreti dodatka Sefa.');}
 if(cfg.compression==='gzip'){const stream=new Blob([out]).stream().pipeThrough(new DecompressionStream('gzip'));out=new Uint8Array(await new Response(stream).arrayBuffer());}
 if(await sha256hex(out)!==cfg.plaintext_sha256)throw new Error('Preverjanje celovitosti dodatka Sefa ni uspelo.');
 const obj=JSON.parse(TD.decode(out));
 if(obj.format!=='BD-O-SEF-EXTRA-1'||typeof obj.html!=='string')throw new Error('Neveljaven dodatek Sefa.');
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
 const toolbar=q.closest('.toolbar2');if(!toolbar)return;
 /* All filtering happens only after the protected Sef has been decrypted in this tab.
    Never send, log, persist or include secret-value elements in the searchable index. */
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('sl').replace(/\s+/g,' ').trim();
 const safeText=el=>{
  const parts=[],walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node;
  while((node=walker.nextNode())){
   const parent=node.parentElement;
   if(!parent||parent.closest('.secret-value,[data-secret],[data-sef-secret],script,style'))continue;
   parts.push(node.nodeValue);
  }
  return normalize(parts.join(' '));
 };
 const labels=[
  ['all','Vse'],['exchange','Kripto borze'],['wallet','Denarnice'],
  ['trading','Trading'],['finance','Banke / plačila'],
  ['identity','Identiteta / 2FA'],['device','Naprave / omrežje'],
  ['family','Družina'],['other','Drugo'],['archive','Arhiv']
 ];
 const allowed=new Set(labels.map(pair=>pair[0]));
 const classify=(el,t)=>{
  const typed=el.closest('[data-sef-category]');
  if(typed){
   const value=normalize(typed.getAttribute('data-sef-category'));
   if(allowed.has(value))return value;
  }
  if(el.closest('#all213'))return 'archive';
  if(/\b(wallet|metamask|keplr|exodus|coinomi|ledger|trezor|jaxx|bread|brd)\b|denarnic/.test(t))return 'wallet';
  if(/\b(mexc|binance|bybit|bitget|bingx|bitmex|kraken|kucoin|bitstamp|gate\.io|okx|phemex|bilaxy|swissborg|primebit|primexbt|margex)\b/.test(t))return 'exchange';
  if(/\b(tradingview|metatrader|tradersreality|trading|copy.trade|oanda|fxtrade|three.commas|3commas|cryptowatch|cointracking)\b/.test(t))return 'trading';
  if(/\b(revolut|paypal|banka|bančni|bankanet|valu|kartica|plačil|payoneer)\b/.test(t))return 'finance';
  if(/\b(authenticator|2fa|totp|recovery|obnovit|passkey|sigen|si.pass|eosebna)\b/.test(t))return 'identity';
  if(/\b(router|ruter|fritz|modem|wifi|wi.fi|nas|bitlocker|veracrypt|anydesk|ultravnc|remote.desktop|mrež)\b/.test(t))return 'device';
  if(/\b(družina|family|otrok|šola|šolsko)\b/.test(t))return 'family';
  return 'other';
 };
 const nodes=[...document.querySelectorAll('#register table tbody tr,#register li,#register p,#all213 table tbody tr,#all213 li,#startme-import table tbody tr')]
  .filter(el=>!(el.tagName==='P'&&el.closest('li')));
 const entries=nodes.map(el=>{const text=safeText(el);return {el,text,category:classify(el,text),inArchive:!!el.closest('#all213')};});
 const archive=$('all213'),initialArchiveOpen=!!(archive&&archive.open);
 const importedGroups=[...document.querySelectorAll('#startme-import details.sef-import-group')].map(el=>({el,initialOpen:el.open}));
 const counts=new Map(labels.map(([k])=>[k,0]));
 entries.forEach(item=>counts.set(item.category,(counts.get(item.category)||0)+1));
 const panel=document.createElement('div');panel.className='sef-filters';
 panel.style.cssText='display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:12px 0 0';
 panel.setAttribute('role','group');panel.setAttribute('aria-label','Filter kategorij Sefa');
 const buttons=new Map();
 let selected='all';
 for(const [key,label] of labels){
  if(key!=='all'&&!counts.get(key))continue;
  const btn=document.createElement('button');btn.type='button';btn.className='chip';
  btn.textContent=label;btn.setAttribute('aria-pressed',key==='all'?'true':'false');
  btn.style.cssText='border:1px solid var(--line);border-radius:999px;background:var(--panel2);color:var(--text);padding:6px 11px;min-height:34px;font-size:.8rem;cursor:pointer';
  btn.addEventListener('click',()=>{selected=key;apply();});
  buttons.set(key,btn);panel.appendChild(btn);
 }
 const clear=document.createElement('button');clear.type='button';clear.textContent='Počisti';
 clear.style.cssText='border:1px solid var(--line);border-radius:8px;color:var(--cyan);padding:6px 11px;min-height:34px;font-size:.8rem;cursor:pointer';
 clear.addEventListener('click',()=>{q.value='';selected='all';apply();q.focus()});
 panel.appendChild(clear);
 const status=document.createElement('p');status.className='hint';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 status.style.margin='8px 0 0';
 const no=document.createElement('p');no.className='no-results';no.hidden=true;no.textContent='Ni zadetkov. Poskusi del imena, URL-ja ali drugo kategorijo.';
 toolbar.append(panel,status,no);
 const apply=()=>{
  const parts=normalize(q.value).split(' ').filter(Boolean);let visible=0,archiveHits=0;
  for(const item of entries){
   const ok=(selected==='all'||item.category===selected)&&parts.every(part=>item.text.includes(part));
   item.el.classList.toggle('search-hidden',!ok);
   if(ok){visible++;if(item.inArchive)archiveHits++;}
  }
  for(const [key,btn] of buttons){
   const on=selected===key;btn.setAttribute('aria-pressed',String(on));
   btn.style.borderColor=on?'var(--cyan)':'var(--line)';
   btn.style.color=on?'var(--cyan)':'var(--text)';
  }
  if(archive){
   if(selected==='archive'||archiveHits&&(parts.length||selected!=='all'))archive.open=true;
   else if(selected!=='archive'||!parts.length)archive.open=initialArchiveOpen;
  }
  const active=parts.length||selected!=='all';
  for(const g of importedGroups){
   const hasHit=[...g.el.querySelectorAll('tbody tr')].some(el=>!el.classList.contains('search-hidden'));
   g.el.hidden=!!active&&!hasHit;
   g.el.open=active?hasHit:g.initialOpen;
  }
  status.textContent=active?visible+' zadetkov · '+(selected==='all'?'Vse kategorije':labels.find(x=>x[0]===selected)[1]):'Išči po delih besedila; več besed pomeni, da se morajo ujemati vse. Gesla niso vključena v iskanje.';
  no.hidden=!active||visible>0;
 };
 q.addEventListener('input',apply);
 q.addEventListener('keydown',ev=>{if(ev.key==='Escape'){ev.preventDefault();q.value='';selected='all';apply();}});
 apply();
}
function installFont(){let p=100;const root=document.documentElement;const paint=()=>{root.style.setProperty('--scale',String(p/100));$('fontReset').textContent=p+'%';$('fontMinus').disabled=p<=70};$('fontMinus').onclick=()=>{p=Math.max(70,p-10);paint()};$('fontPlus').onclick=()=>{p+=10;paint()};$('fontReset').onclick=()=>{p=100;paint()};paint();}
function render(obj){$('loading').hidden=true;$('content').hidden=false;$('content').innerHTML=obj.html;installSecretControls();installSearch();installFont();document.querySelectorAll('a[href]').forEach(a=>{const u=new URL(a.href,location.href);if(u.origin!==location.origin){a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';a.target='_blank'}});}
$('lockAll').onclick=lockAll;
try{
 if(!window.isSecureContext||!crypto.subtle||!window.DecompressionStream)throw new Error('Odpri HTTPS naslov v posodobljenem brskalniku.');
 portalCfg=await getJSON(ROOT+'vault.json');sefCfg=await getJSON(ROOT+'sef-config.json');
 if(portalCfg.format!=='BD-O-VAULT-2')throw new Error('Neveljavna BD/O nastavitev.');
 const session=portalSession();
 if(!session){location.replace(ROOT+'index.html?next=sef');return;}
 try{sessionStorage.removeItem(OLD_SEF_SESSION)}catch(_){}
 const raw=from64(session.key);const obj=await openSef(raw);raw.fill(0);render(obj);
}catch(err){$('loading').hidden=false;$('loadingTitle').textContent='Sef se ni odprl';$('loadingText').textContent=err.message||'Napaka zaščite.';const back=$('backLink');if(back)back.hidden=false;}
})();
