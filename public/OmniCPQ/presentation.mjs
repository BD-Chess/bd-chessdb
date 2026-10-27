const $=id=>document.getElementById(id),origin=location.origin,parent=window.opener;
const services=new Set(['so','vpi','sdwan-lite','vpn-l3','vpn-vpls','dwdm','optika','fwa']);
let generation=0,guide=null;
const reply=data=>parent?.postMessage(data,origin);
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function safeCopy(source){
  if(source.nodeType===3)return document.createTextNode(source.textContent);
  if(source.nodeType!==1)return document.createDocumentFragment();
  if(['SCRIPT','STYLE','IFRAME','OBJECT','FORM','INPUT','BUTTON','SVG','LINK','META'].includes(source.tagName))return document.createDocumentFragment();
  const allowed=['P','DIV','SECTION','ARTICLE','H2','H3','H4','UL','OL','LI','STRONG','EM','SMALL','TABLE','THEAD','TBODY','TR','TH','TD','BR','FIGURE','FIGCAPTION','A','IMG','DETAILS','SUMMARY','CODE'];
  const n=document.createElement(allowed.includes(source.tagName)?source.tagName:'div');
  if(source.tagName==='DETAILS')n.open=true;
  if(source.tagName==='IMG'){
    const u=new URL(source.getAttribute('src')||'',location.href);
    if(u.origin!==origin||u.pathname!=='/.netlify/functions/omnicpq-documents'||!/^slike-v18\/webp\/[a-z0-9-]+\.webp$/.test(u.searchParams.get('file')||''))return node('p','Slika ni potrjena za ta izvor.');
    n.src=u.href;n.alt=source.getAttribute('alt')||'Ilustracija storitve';n.loading='eager';
    n.addEventListener('click',()=>{$('presentation-large-image').src=n.src;$('presentation-large-image').alt=n.alt;$('presentation-image').showModal();});
    n.setAttribute('tabindex','0');n.addEventListener('keydown',e=>{if(e.key==='Enter')n.click();});
  }
  if(source.tagName==='A'){
    const u=new URL(source.getAttribute('href')||'',new URL('/.netlify/functions/omnicpq-documents?file=b2b-vodic-v17.html',origin));
    if(['https:','http:'].includes(u.protocol)){n.href=u.href;n.target='_blank';n.rel='noopener noreferrer';}
  }
  for(const child of source.childNodes)n.append(safeCopy(child));return n;
}
async function loadGuide(){
  if(guide)return guide;
  const r=await fetch('/.netlify/functions/omnicpq-documents?file=b2b-vodic-v17.html',{credentials:'same-origin',cache:'no-store'});
  if(!r.ok)throw Error('Za prikaz vodiča potrebujem uspešno lastniško prijavo in dostopno zasebno dokumentacijo.');
  const text=await r.text(),sha=r.headers.get('X-Document-SHA256');
  const actual=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(v=>v.toString(16).padStart(2,'0')).join('');
  if(!sha||actual!==sha)throw Error('Celovitost prejetega vodiča ni potrjena.');
  guide=new DOMParser().parseFromString(text,'text/html');return guide;
}
function example(scene){
  const box=node('section');box.append(node('h2',scene.title));
  const rows=scene.id==='requirements'?[['Zahteva','Nova poslovalnica potrebuje zanesljivo povezljivost.'],['Odločitev','Potrditev naročnika in tehnične razpoložljivosti še manjka.'],['Odprto','Lokacija, aplikacije, SLA, rezervna pot, datum.']]:
    scene.id==='modeling'?[['Predlog','Storitev → dostop → oprema → opcije.'],['Vir pravila','Potrjena različica modela: UNKNOWN.'],['Sled','REQ-PRIMER-01 → RULE-PROPOSED-01; brez PLM zapisa.']]:
    scene.id==='testing'?[['Zahteva / pravilo','REQ-PRIMER-01 / RULE-PROPOSED-01'],['Test','Osnovna pot, neveljavna kombinacija, izpad in persistence.'],['Oracle / izvedba','ORACLE_PENDING / NOT_RUN'],['OMS / obračun','NOT_RUN · potreben dostop in potrjen obseg.']]:
    scene.id==='cpq'?[['Okolje','STAGE · primer, brez poslovne izvedbe.'],['Pogoji','Prijava → dovoljen Bridge → uporabnikov dostop in nalog.'],['Dokaz','Opazovanje, učinek, shranitev in persistence se preverijo posebej.']]:
    [['Poslovni primer','Podjetje odpira novo poslovalnico.'],['Pet načinov','Vodič → Zahteve → Modeliranje → OmniCPQ → Testiranje'],['Delo ostane','Pogovor in odprti CPQ dokument se s predstavitvijo ne zamenjata.']];
  const table=node('table');for(const [a,b] of rows){const tr=node('tr');tr.append(node('th',a),node('td',b));table.append(tr);}box.append(table);return box;
}
async function show(message){
  const ticket=++generation,scene=message.scene;
  if(!scene||typeof scene.id!=='string'||!['intro','guide','requirements','modeling','cpq','testing','finish','service'].includes(scene.id))return;
  $('scene-content').replaceChildren();$('scene-caption').textContent='';$('presentation-status').textContent='Odpiram in preverjam prizor …';
  $('scene-title').textContent=scene.title;$('scene-kind').textContent=scene.kind==='POSNETEK'?'POSNETEK · dokumentacija':'PRIMER · brez poslovnih dejanj';
  try{
    let content;
    if(scene.service){
      if(!services.has(scene.service))throw Error('Storitev ni v dovoljenem predstavitvenem registru.');
      const source=await loadGuide(),card=source.getElementById(scene.service);
      if(!card)throw Error('Kartice ni v preverjenem vodiču.');content=safeCopy(card);
      if(content.tagName==='DETAILS')content.open=true;
    }else content=example(scene);
    if(ticket!==generation)return;
    $('scene-content').replaceChildren(content);
    const images=[...$('scene-content').querySelectorAll('img')];
    await Promise.all(images.map(img=>img.complete?(img.naturalWidth?Promise.resolve():Promise.reject(Error('Slika ni dosegljiva.'))):new Promise((resolve,reject)=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',()=>reject(Error('Slika ni dosegljiva.')),{once:true});})));
    if(ticket!==generation)return;
    const visible=document.visibilityState!=='hidden'&&$('scene-content').getBoundingClientRect().height>0;
    if(!visible)throw Error('Prizor ni viden.');
    $('scene-caption').textContent=scene.text;$('presentation-status').textContent='Prizor je viden · '+(scene.kind==='POSNETEK'?'dokumentacija z datiranimi viri':'učni primer, NOT_RUN');
    reply({type:'ts-b2b:visible',requestId:message.requestId,scene:scene.id,visible:true});
  }catch(e){if(ticket!==generation)return;$('presentation-status').textContent=e.message;reply({type:'ts-b2b:visible',requestId:message.requestId,scene:scene.id,visible:false});}
}
window.addEventListener('message',e=>{
  if(e.origin!==origin||e.source!==parent||!parent||!e.data)return;
  if(e.data.type==='ts-b2b:ping')reply({type:'ts-b2b:ready',requestId:e.data.requestId});
  if(e.data.type==='ts-b2b:scene')show(e.data);
  if(e.data.type==='ts-b2b:clear'){++generation;guide=null;$('scene-content').replaceChildren();$('scene-caption').textContent='';$('presentation-status').textContent='Za nadaljevanje se prijavi v pomočniku.';}
  if(e.data.type==='ts-b2b:pause'){++generation;$('presentation-status').textContent='Predstavitev je ustavljena; poslovna dejanja niso bila izvedena.';}
});
document.querySelectorAll('[data-tour]').forEach(b=>b.onclick=()=>reply({type:'ts-b2b:control',action:b.dataset.tour}));
$('presentation-question').onsubmit=e=>{e.preventDefault();const text=$('scene-question').value.trim();if(text)reply({type:'ts-b2b:question',text});};
$('presentation-image-close').onclick=()=>$('presentation-image').close();
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')reply({type:'ts-b2b:hidden'});});
window.addEventListener('pagehide',()=>reply({type:'ts-b2b:hidden'}));
document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='n'&&!/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)&&!document.querySelector('dialog[open]'))reply({type:'ts-b2b:control',action:'next'});});
reply({type:'ts-b2b:ready',requestId:null});
