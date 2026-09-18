/* WL Deep Harvest R1. Read-only view; private synthesis remains authenticated ciphertext. */
(()=>{'use strict';
const $=id=>document.getElementById(id),app=$('app'),cockpit=$('cockpit');
if(!app||!cockpit||$('deepHarvest'))return;
const BASE=new URL('./',document.currentScript.src),SESSION='wl-v2-session';
const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('harvest.css?v=20260919R1',BASE);document.head.append(css);
const panel=document.createElement('section');panel.id='deepHarvest';panel.className='panel jump harvest';panel.hidden=true;cockpit.before(panel);
const te=new TextEncoder(),td=new TextDecoder('utf-8',{fatal:true});
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n};
const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
let epoch=0,identity='',active=false,lastRefresh=0,request=null;
function session(){try{const s=JSON.parse(sessionStorage.getItem(SESSION)||'null');return s?.vault==='wl-rhp11-20260912-v2'&&typeof s.key==='string'?s:null}catch{return null}}
function clear(){epoch++;request?.abort();request=null;identity='';active=false;lastRefresh=0;panel.replaceChildren();panel.hidden=true}
async function sha(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function json(path,signal){const u=new URL(path,BASE);const r=await fetch(u,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal});if(!r.ok)throw Error('HTTP '+r.status);return r.json()}
async function privateRead(s,signal){
 const box=await json('harvest.enc.json',signal);
 if(box.format!=='WL-ENC-2'||typeof box.cipher!=='string'||box.cipher.length>200000)throw Error('Neveljavna ovojnica');
 const c=b64(box.cipher);if(await sha(c)!==box.sha256)throw Error('Hash šifriranega izvlečka se ne ujema');
 const key=await crypto.subtle.importKey('raw',b64(s.key),'AES-GCM',false,['decrypt']);
 const pack=JSON.parse(td.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(box.iv),additionalData:te.encode('WL:harvest:v1')},key,c)));
 if(pack.schema!=='wl.harvest.pack.v1'||pack.compression!=='gzip'||!Number.isInteger(pack.bytes)||pack.bytes<1||pack.bytes>128000||typeof pack.data!=='string'||pack.data.length>200000)throw Error('Neveljaven paket');
 const stream=new Blob([b64(pack.data)]).stream().pipeThrough(new DecompressionStream('gzip'));
 const reader=stream.getReader(),parts=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>pack.bytes)throw Error('Prevelik paket');parts.push(value)}}finally{await reader.cancel().catch(()=>{})}
 const raw=new Uint8Array(await new Blob(parts).arrayBuffer());
 if(raw.length!==pack.bytes||await sha(raw)!==pack.sha256)throw Error('Celovitost vsebine ni pravilna');
 const p=JSON.parse(td.decode(raw));if(p.schema!=='wl.harvest.private.v1'||!Array.isArray(p.findings))throw Error('Neveljavna vsebina');return p;
}
function card(x){const a=node('article','harvest-card');if(x.status)a.append(node('span','harvest-tag',x.status));a.append(node('h3','',x.title),node('p','',x.text));if(x.refs)a.append(node('p','harvest-ref',x.refs));return a}
function group(title,items,open=false){const d=node('details','harvest-group');d.open=open;const s=node('summary','',title+' · '+items.length);const grid=node('div','harvest-grid');grid.append(...items.map(card));d.append(s,grid);return d}
function local(t){const d=new Date(t);return Number.isNaN(d.getTime())?'neznano':d.toLocaleString('sl-SI',{timeZone:'Europe/Ljubljana'})}
function render(pub,priv,errors){
 panel.replaceChildren();panel.hidden=false;
 panel.append(node('div','eyebrow','DEEP HARVEST · 2026-09-19 · R1'),node('h2','','Kaj je vredno ohraniti'));
 if(pub?.harvest){
  const h=pub.harvest;panel.append(node('p','harvest-lead',h.subtitle));
  const c=h.coverage,strip=node('div','harvest-strip');
  strip.append(node('span','',c.full_messages+' polnih email turnov'),node('span','','A–H · delna zgodovinska pokritost'),node('span','',priv?'70 sprejetih WL zapisov · preverjeno':'Zasebni WL izvleček ni odprt'));panel.append(strip);
  const coverage=node('details','harvest-coverage');coverage.append(node('summary','','Kaj je bilo dejansko prebrano?'));
  coverage.append(node('p','',Object.entries(c.ranges).map(([id,r])=>id+r[0]+'–'+id+r[1]).join(' · ')),node('p','',c.note),node('p','','Izvleček ustvarjen '+local(pub.generated_at)+'. To ni čas zadnjega celovitega pregleda mailboxov.'),node('p','',h.separation));panel.append(coverage);
  panel.append(group('Najmočnejši izvlečki',h.findings,true),group('Popravki, ovržene bližnjice in nove meje',h.corrections),group('Kaj je zdaj vredno narediti',h.decisions));
  panel.append(node('p','harvest-boundary',h.reproduction));
 }else panel.append(node('p','harvest-boundary','Email izvleček ni dosegljiv. Starega povzetka ne prikazujemo kot na novo preverjenega.'));
 if(priv){
  const d=node('details','harvest-private');d.open=cockpit.dataset.view==='bd';d.append(node('summary','','Zasebni Legacy WL · celotna veriga in vsebinski razvoj'));
  d.append(node('h3','',priv.title),node('p','',priv.overview),group('Rezultati in omejitve',priv.findings,true),group('Razvoj raziskave',priv.timeline),group('Dokazni audit',priv.audit),group('Naslednji razlikovalni korak',priv.next),node('p','harvest-boundary',priv.boundary));panel.append(d);
 }else panel.append(node('p','harvest-boundary','Zasebni izvleček: '+(errors[1]||'ni dosegljiv')+'. Brez ugibanja vsebine; dnevnik in obstoječi bralnik ostaneta ločena.'));
 if(errors[0])panel.append(node('p','harvest-boundary','Email vir: '+errors[0]));
 const b=node('button','harvest-refresh','Ponovno naloži izvleček');b.type='button';b.onclick=()=>{lastRefresh=0;sync()};panel.append(b);
}
async function sync(){
 const s=session();if(app.hidden||!s){if(identity||panel.childNodes.length)clear();return}
 const id=s.vault+':'+s.key;if(id!==identity){clear();identity=id}
 if(active||Date.now()-lastRefresh<300000)return;
 const g=++epoch;active=true;request=new AbortController();const ctl=request;const timeout=setTimeout(()=>ctl.abort(),20000);
 try{
  const rs=await Promise.allSettled([json('../data/AMAIL_CONTENT.json',ctl.signal),privateRead(s,ctl.signal)]);
  if(g!==epoch||app.hidden||session()?.key!==s.key)return;
  const pub=rs[0].status==='fulfilled'&&rs[0].value.schema==='amail.content.v1'?rs[0].value:null;
  const priv=rs[1].status==='fulfilled'?rs[1].value:null;
  render(pub,priv,rs.map(x=>x.status==='rejected'?String(x.reason?.message||'napaka'):''));lastRefresh=Date.now();
 }finally{clearTimeout(timeout);if(g===epoch){active=false;request=null}}
}
new MutationObserver(()=>{sync().catch(()=>{})}).observe(app,{attributes:true,attributeFilter:['hidden']});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync().catch(()=>{})});
$('lock')?.addEventListener('click',clear,{capture:true});window.addEventListener('pagehide',clear);
setInterval(()=>{if(!document.hidden)sync().catch(()=>{})},1000);sync().catch(()=>{});
})();
