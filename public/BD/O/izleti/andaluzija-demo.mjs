// Public, memory-only presentation. Never import the owner planner/store/AI runtime.
import { cities, makeStop, mapsForStop, mapsForLeg } from './andaluzija-poi.mjs';
import './andaluzija-shield-core.js';
import '../../../Trip/new/air-distance.js';
import { mountAlbum } from '../../../shared/dualframe-album.mjs';

const en = new URLSearchParams(location.search).get('lang') === 'en';
document.documentElement.lang = en ? 'en' : 'sl';
const t = (sl, english) => en ? english : sl;
document.title = t('Andaluzija · javni demo petih rešitev', 'Andalusia · five solutions demo');
const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = new URL('./andaluzija-demo.css', import.meta.url); document.head.append(style);
document.body.className = 'trip-demo';
document.body.innerHTML = `<header class="demo-header"><b>BD × AI Lab · Andaluzija</b><a href="${new URL('../../../index.html',import.meta.url).href}">MDL×DCC ↗</a></header>
<main class="demo-layout" id="glance-public-demo" data-demo-only="true">
<section id="overview"><p class="demo-kicker">${t('Pet rešitev · ena uporabniška zgodba','Five solutions · one journey')}</p><h1>${t('Dve uri v mestu. Pot, ki jo lahko uporabiš.','Two hours in a city. A route you can use.')}</h1><p>${t('Vodič → AI predlog → TripOpti → Maps → DualFrame → 8zShield. Preizkusi Málaga sprehod, poglej podobe poti in odpri nenevaren šifrirani primer.','Guide → AI suggestion → TripOpti → Maps → DualFrame → 8zShield. Try a Málaga walk, explore the images and unlock a harmless encrypted example.')}</p><p class="demo-fine">${t('Javni demo. Brez osebnega načrta, prijave, skupnega shranjevanja ali plačljivih API klicev. Izbire ostanejo samo v pomnilniku tega zavihka.','Public demo. No personal itinerary, login, shared storage or paid API calls. Choices remain in this tab’s memory only.')}</p><a href="#suggestion">${t('Začni s predlogom ↓','Start with a suggestion ↓')}</a></section>
<section id="authorship"><p class="demo-kicker">01 · ${t('Vodič in avtorstvo','Guide and authorship')}</p><h2>${t('Človeško izhodišče, trije pogledi.','A human starting point, three perspectives.')}</h2><p>${t('Mateja je pripravila oziroma posredovala izvirni dokument in slikovni izbor. BD je usmeril projekt. Claude je pripravil različico B; GPT različico C in spletni vodič. Demo ohranja njihove ločene prispevke.','Mateja prepared or supplied the original document and image selection. BD directed the project. Claude prepared variant B; GPT prepared variant C and the web guide. The demo preserves their separate contributions.')}</p></section>
<section id="suggestion"><p class="demo-kicker">02 · AI ${t('pomočnik','assistant')}</p><h2>${t('»V Málagi imava dve uri. Kaj predlagaš?«','“We have two hours in Málaga. What would you suggest?”')}</h2><div class="demo-card"><b>${t('Shranjeni GPT primer · 22. 10. 2026','Saved GPT example · 22 October 2026')}</b><p>${t('Predlagam kratek sprehod mimo petih javnih točk: Teatro Romano, vhod Alcazabe, katedrala, Muelle Uno in Atarazanas. Namenite približno 10 minut posamezni zunanji točki, preostanek hoji in odmoru. To ni predlog petih notranjih ogledov; odprtost tržnice preverite posebej. TripOpti naj preveri vrstni red.','Try a short walk past five public points: Teatro Romano, the Alcazaba entrance, the cathedral, Muelle Uno and Atarazanas. Allow roughly 10 minutes at each exterior stop, with the remaining time for walking and a break. This is not five interior visits; check the market’s opening separately. Let TripOpti check the order.')}</p><p class="demo-fine">${t('Dejanski GPT uredniški primer, shranjen pri izdelavi tega dema iz obstoječega javnega kataloga. Ni svež odgovor spletnega API, tekoča GPT/Claude seja ali potrjena časovna izvedljivost.','An actual GPT editorial example saved while building this demo from the existing public catalogue. It is not a fresh website API response, a live GPT/Claude session or verified schedule feasibility.')}</p><button id="demo-select">${t('Uporabi pet javnih točk','Use these five public points')}</button></div></section>
<section id="optimize"><p class="demo-kicker">03 · TripOpti</p><h2>${t('Iste točke. Boljši vrstni red.','Same places. A better order.')}</h2><p>${t('Classical DeepSearch uporablja isti vzdrževani Trip engine in worker kot izlet. Ta brezplačni prikaz uporablja izračunano matriko zračnih razdalj, ne Google peš razdalj. Krožna pot se začne in konča na Plaza de la Marina.','Classical DeepSearch uses the trip’s maintained Trip engine and worker. This free demo uses a computed great-circle distance matrix, not Google walking distances. The round trip starts and ends at Plaza de la Marina.')}</p><div class="demo-pair"><div class="demo-card"><h3>${t('Pred optimizacijo','Before optimization')}</h3><ol id="demo-before"></ol></div><div class="demo-card"><h3>${t('Po optimizaciji','After optimization')}</h3><ol id="demo-after"></ol></div></div><button id="demo-optimize">${t('Preveri vrstni red · DeepSearch','Check the order · DeepSearch')}</button><p id="demo-result" class="demo-metric" role="status" aria-live="polite"></p><p class="demo-fine">${t('Koordinate so približne načrtovalske točke. Rezultat izboljšuje ta model; ne dokazuje splošnega optimuma ali pravilnih ur vstopnic.','Coordinates are approximate planning points. The result improves this model; it does not prove general optimality or ticket timing.')}</p></section>
<section id="maps"><p class="demo-kicker">04 · Google Maps</p><h2>${t('Od izbranega kraja do naslednjega koraka.','From a selected place to the next step.')}</h2><p>${t('Povezave sledijo dejanskemu vrstnemu redu. Maps ob odprtju izračuna pravo peš pot; zračna ocena zgoraj ni peš navigacija.','Links follow the actual order. Maps computes the real walking route when opened; the estimate above is not walking navigation.')}</p><ol id="demo-maps"></ol></section>
<section id="gallery"><p class="demo-kicker">05 · DualFrame</p><h2>${t('Isti prizor, dva skrbno sestavljena kadra.','One scene, two composed frames.')}</h2><p>${t('Obstoječi album: 21 parov. Izberi L ali P, odpri sliko in preklopi cel zaslon.','The existing album: 21 pairs. Choose L or P, open an image and switch to fullscreen.')}</p><div id="demo-album"></div><p class="demo-fine">${t('Matejin slikovni izbor; izvirni fotografi niso potrjeni. L/P sta GPT AI kompoziciji. Dopolnjeni robovi so ilustrativni, ne nov dokumentarni dokaz. Koncept DualFrame: BD.','Mateja’s image selection; original photographers are unconfirmed. L/P are GPT AI compositions. Extended edges are illustrative, not new documentary evidence. DualFrame concept: BD.')}</p></section>
<section id="shield"><p class="demo-kicker">06 · 8zShield</p><h2>${t('Javni vodič. Šifriran osebni razdelek.','Public guide. Encrypted personal section.')}</h2><p>${t('Tukaj odpreš samo sintetični demo. Javno demo geslo:','This opens only a synthetic demo. Public demo password:')} <code>glance-trip-demo</code></p><div class="demo-shield"><input id="demo-password" type="password" autocomplete="off" aria-label="${t('Demo geslo','Demo password')}"><button id="demo-unlock">${t('Odkleni demo','Unlock demo')}</button><button id="demo-lock">${t('Zakleni','Lock')}</button></div><output id="demo-secret" aria-live="polite">${t('Zaklenjeno · šifrirana vsebina','Locked · encrypted content')}</output><p class="demo-fine">AES-256-GCM · PBKDF2 600.000 · ${t('Brez pravega gesla, rezervacije ali povezave z osebnim ključem.','No real password, booking or connection to an owner key.')}</p></section>
<section id="finish"><h2>${t('Od zamisli do uporabne poti.','From an idea to a usable route.')}</h2><p>${t('Pet rešitev sodeluje pri isti potrebi. V glavnem glance je to kratek primer; glance trip pokaže celotno pot.','Five solutions work together on one need. Main glance shows a short example; glance trip explores the full journey.')}</p></section></main>`;

const $ = id => document.getElementById(id);
const catalogue = cities.malaga;
const entry = makeStop('malaga', catalogue.entry, true);
// Deliberately inefficient starting order; every public POI occurs once.
let stops = [0,3,4,1,2].map(i => ({...makeStop('malaga', catalogue.stops[i]), durationMin:10}));
let after = null, receipt = null, job = null, unlockEpoch = 0;
const points = () => [entry,...stops].map(p => ({id:p.id,name:p.name,lat:p.location.lat,lon:p.location.lon}));
function list(node, values) { node.replaceChildren(...values.map(p => {const li=document.createElement('li');li.textContent=p.name;return li;})); }
function render() {
  list($('demo-before'), stops); list($('demo-after'), after || []);
  const order = [entry,...(after || stops)], items=[];
  for (let i=0;i<order.length;i++) {
    const p=order[i], next=order[(i+1)%order.length], li=document.createElement('li');li.append(document.createTextNode(p.name));
    for (const [label,url] of [[t('Kraj ↗','Place ↗'),mapsForStop(p).place],[t('Peš do naslednje točke ↗','Walk to the next stop ↗'),mapsForLeg(p,next)]]) {
      const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';li.append(a);
    } items.push(li);
  } $('demo-maps').replaceChildren(...items);
}
function cost(route,matrix) {let n=0;for(let i=0;i<route.length;i++)n+=matrix[route[i]][route[(i+1)%route.length]];return n;}
async function optimize() {
  if(job)return job.promise;
  const p=points(), matrix=TripAirDistance.matrix(p).map(r=>Array.from(r));
  const worker=new Worker(new URL('./andaluzija-worker.js',import.meta.url));
  $('demo-optimize').disabled=true;$('demo-result').textContent=t('Računam …','Computing …');
  const promise=new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>done(Error('WORKER_TIMEOUT')),7500);
    const done=(error,result)=>{clearTimeout(timeout);worker.terminate();job=null;$('demo-optimize').disabled=false;error?reject(error):resolve(result);};
    worker.onerror=()=>done(Error('WORKER_FAILED'));
    worker.onmessage=e=>{
      if(e.data.type==='failed')return done(Error(e.data.error));if(e.data.type!=='result')return;
      try {
        const result=e.data.result, ids=result.pointsSorted?.map(x=>x.id);
        if(!ids||ids[0]!==entry.id||ids.length!==p.length||new Set(ids).size!==p.length||ids.some(id=>!p.some(q=>q.id===id)))throw Error('INVALID_ROUTE');
        const route=ids.map(id=>p.findIndex(q=>q.id===id)), beforeMeters=cost(p.map((_,i)=>i),matrix),afterMeters=cost(route,matrix);
        if(Math.abs(afterMeters-result.totalCost)>0.01||afterMeters>beforeMeters+0.01)throw Error('INVALID_COST');
        after=ids.slice(1).map(id=>stops.find(q=>q.id===id));
        receipt={algorithm:'Classical DeepSearch',matrixKind:'great-circle estimate',matrix,pointIds:p.map(x=>x.id),order:ids,beforeMeters,afterMeters,roundTrip:true,source:'maintained andaluzija-worker.js',persisted:false};
        render();$('demo-result').textContent=`${t('Zračna ocena kroga','Great-circle round trip')}: ${Math.round(beforeMeters)} m → ${Math.round(afterMeters)} m. ${t('Vseh pet točk natanko enkrat.','All five stops exactly once.')}`;done(null,receipt);
      }catch(error){done(error);}
    };worker.postMessage({type:'start',points:p,distanceMatrix:matrix});
  }).catch(error=>{$('demo-result').textContent=t('Izračun ni uspel. Poskusi znova.','Calculation failed. Try again.');throw error;});
  job={worker,promise};return promise;
}
function lock() {unlockEpoch++;$('demo-password').value='';$('demo-secret').textContent=t('Zaklenjeno · šifrirana vsebina','Locked · encrypted content');}
async function unlock(password=$('demo-password').value) {
  const epoch=++unlockEpoch;
  try {
    const response=await fetch(new URL('./andaluzija-demo.8zs.json',import.meta.url));if(!response.ok)throw Error();
    const value=await ShieldCore.openEnvelope(await response.json(),password,()=>{if(epoch!==unlockEpoch)throw Error('CANCELLED');});
    if(epoch!==unlockEpoch)return false;
    $('demo-secret').textContent=value.message;$('demo-password').value='';return true;
  }catch{if(epoch===unlockEpoch)$('demo-secret').textContent=t('Napačno demo geslo ali nedosegljiva ovojnica.','Wrong demo password or unavailable envelope.');return false;}
}
$('demo-select').onclick=()=>{$('optimize').scrollIntoView({behavior:'smooth'});};
$('demo-optimize').onclick=()=>optimize().catch(()=>{});
$('demo-unlock').onclick=()=>unlock();$('demo-lock').onclick=lock;
window.addEventListener('pagehide',()=>{lock();job?.worker.terminate();});
render();
const albumURL=new URL('./assets/andaluzija-2027/dualframe/album.json',import.meta.url);
const album=await fetch(albumURL).then(r=>{if(!r.ok)throw Error('ALBUM_UNAVAILABLE');return r.json();});
mountAlbum($('demo-album'),album,albumURL);
window.AndaluzijaGlanceDemo=Object.freeze({
  version:'1.0.0',mode:'public-synthetic',
  getReceipt:()=>receipt?structuredClone(receipt):null,
  getContext:()=>({mode:'public-synthetic',city:'malaga',poiIds:stops.map(p=>p.id),privateContext:false,cloudWrite:false}),
  save:()=>Promise.reject(Error('DEMO_CLOUD_WRITE_DISABLED')),
  async show(stage) {
    if(!['overview','authorship','suggestion','before','optimize','maps','gallery','shield','finish'].includes(stage))throw Error('INVALID_DEMO_STAGE');
    if(stage==='optimize'||stage==='maps')await optimize();
    if(stage==='shield'){lock();if(!await unlock('glance-trip-demo'))throw Error('DEMO_SHIELD_FAILED');}
    $(stage==='before'?'optimize':stage).scrollIntoView({behavior:'instant'});
    return {stage,verified:true,mode:'public-synthetic'};
  }
});
document.body.dataset.demoReady='true';
const stage=location.hash.slice(1);if(stage&&$(stage))$(stage).scrollIntoView();
