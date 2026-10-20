/* Andaluzija 2027 · Mateja / Claude / GPT · optional imagery, offline schematic. */
(()=>{
'use strict';
const D=window.ANDALUZIJA;
if(!D){document.getElementById('day-cards').textContent='Vsebine ni bilo mogoče naložiti. Osvežita stran.';return;}
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const privateKey=k=>k.startsWith('bd-andaluzija-2027-r1-')&&!k.endsWith('-plan');
const get=(k,f)=>{if(privateKey(k))return D.privateUnlocked?(D.preferences?.[k]??f):f;try{return localStorage.getItem(k)??f;}catch{return f;}};
const put=(k,v)=>{if(privateKey(k)){if(!D.privateUnlocked)return false;(D.preferences??={})[k]=String(v);window.dispatchEvent(new CustomEvent('andaluzija-preference',{detail:{key:k,value:String(v)}}));return true;}try{localStorage.setItem(k,String(v));return true;}catch{return false;}};
const KEY='bd-andaluzija-2027-r1-';
const PUBLIC_DATA=JSON.parse(JSON.stringify(D));
const variants=Object.keys(D.variants);
const params=new URLSearchParams(location.search);
let selected=params.get('plan')||get(KEY+'plan','gpt');
if(!variants.includes(selected))selected='gpt';
let selectedPlace='malaga';
const visible=new Set(variants);
const photo=name=>'./assets/andaluzija-2027/'+name+'.webp';
const money=n=>new Intl.NumberFormat('sl-SI',{style:'currency',currency:'EUR',minimumFractionDigits:0,maximumFractionDigits:2}).format(n);
const dateFor=i=>{const start=new Date((D.trip?.startDate||'2000-01-01')+'T00:00:00Z');start.setUTCDate(start.getUTCDate()+i);return start;};
const bookingFor=(day,i)=>{const date=dateFor(i).toISOString().slice(0,10);return (D.bookings||[]).find(b=>b.city===day.night&&b.checkIn<=date&&date<b.checkOut);};
const dateLabel=(i,long=false)=>dateFor(i).toLocaleDateString('sl-SI',{weekday:long?'long':'short',day:'numeric',month:'numeric',year:'numeric',timeZone:'UTC'});
const shortDate=i=>dateFor(i).toLocaleDateString('sl-SI',{day:'numeric',month:'numeric',timeZone:'UTC'});
function renderTripYear(){
 const year=String(dateFor(0).getUTCFullYear());
 $('naslov').querySelector('em').textContent=year+'.';
 document.title='Andaluzija '+year+' · Moji izleti';
 document.querySelector('meta[name="description"]').content='Andaluzija '+year+'. Tri poti, slovenski vodič, mestni ogledi in posamične Google Maps povezave. Osebni podatki so zaklenjeni.';
}
const mapSearch=q=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q);
function routeURL(keys,mode='driving'){
 const unique=keys.filter((v,i)=>!i||v!==keys[i-1]);
 if(unique.length<2)return mapSearch(D.places[unique[0]]?.query||'Málaga');
 const p=new URLSearchParams({api:'1',origin:D.places[unique[0]].name+', España',destination:D.places[unique.at(-1)].name+', España',travelmode:mode});
 if(unique.length>2)p.set('waypoints',unique.slice(1,-1).map(k=>D.places[k].name+', España').join('|'));
 return 'https://www.google.com/maps/dir/?'+p.toString();
}
function blocks(v){
 const result=[];
 v.days.forEach((d,i)=>{if(!d.night)return;const last=result.at(-1);if(last&&last.city===d.night){last.nights++;last.end=i;}else result.push({city:d.night,nights:1,start:i,end:i});});
 return result;
}
function datesForPlace(v,id){
 const days=[],nights=[];
 v.days.forEach((d,i)=>{if(d.city===id||d.via.includes(id))days.push(i);if(d.night===id)nights.push(i);});
 if(!days.length)return id==='marbella'?'V osnovni poti ni; možna zamenjava za Mijas.':'Ni v osnovni poti.';
 const optional=id==='carmona'?'po želji · ':'';
 return optional+days.map(shortDate).join(', ')+(nights.length?' · noči '+nights.map(shortDate).join(', '):' · brez nočitve');
}
function renderVariantControls(){
 $('variant-cards').innerHTML=variants.map(k=>{const v=D.variants[k];return `<button class="variant-card" type="button" data-plan="${k}" aria-pressed="${k===selected}" style="--route:${v.color}"><span class="variant-top"><span class="variant-letter">${v.letter} · ${esc(v.label)}</span><span>${esc(v.tag)}</span></span><h3>${esc(v.headline)}</h3><p>${esc(v.desc)}</p><span class="variant-metrics"><span><b>${v.days.filter(d=>d.night).length}</b> noči</span><span><b>${v.moves}</b> selitev</span><span><b>~${v.rental}</b> dni avta*</span></span><span class="variant-foot">${k===selected?'● Izbrani dnevni vodič':'Odpri ta načrt →'}</span></button>`;}).join('');
 $('variant-switch').innerHTML=variants.map(k=>`<button type="button" data-plan="${k}" aria-pressed="${k===selected}" style="--route:${D.variants[k].color}">${D.variants[k].letter} · ${D.variants[k].label}</button>`).join('');
 const foot=document.createElement('p');foot.className='muted small';foot.textContent='* Število obračunanih dni je odvisno od ur prevzema/vračila in pogodbe. Primerjalne ure so v osebnem proračunu. Izračun je v proračunu.';
 const old=document.querySelector('[data-rental-note]');if(old)old.remove();foot.dataset.rentalNote='true';$('variant-cards').after(foot);
}
function renderCompare(){
 $('comparison-body').innerHTML=Array.from({length:10},(_,i)=>`<tr class="${i>=7?'changed':''}"><td><b>${String(i+1).padStart(2,'0')}</b><br>${esc(dateLabel(i))}</td>${variants.map(k=>{const d=D.variants[k].days[i];return `<td><button type="button" data-day-plan="${k}" data-day-index="${i}" class="${k===selected?'selected':''}">${esc(d.title)}<small>${d.night?'Noč: '+D.places[d.night].name:'Let domov'}</small></button></td>`;}).join('')}</tr>`).join('');
}
function renderDays(){
 const v=D.variants[selected];document.documentElement.style.setProperty('--active-color',v.color);
 $('days-heading').textContent=v.label+' · '+v.headline;
 $('night-ribbon').innerHTML=blocks(v).map(b=>`<div class="night-block"><b>${esc(D.places[b.city].name)}</b>${b.nights} ${b.nights===1?'noč':'noči'}<small>${shortDate(b.start)}${b.end>b.start?'–'+shortDate(b.end):''}</small></div>`).join('');
 $('day-cards').innerHTML=v.days.map((d,i)=>{const p=D.places[d.city];const transferDay=(selected==='claude'&&i===7)||(selected==='gpt'&&i===8);const transitLastDay=i===9&&selected!=='mateja';const drivingStops=transferDay?d.via.slice(0,d.via.indexOf('agp')+1):d.via;const mapMode=transitLastDay?'transit':'driving';let image=p.image;if(i===2)image='granada-alhambra';if(i===7&&selected==='mateja')image='ronda-puente';return `<article class="day-card" id="dan-${i+1}"><div class="day-photo"><img src="${photo(image)}" alt="${esc(image==='pueblo-blanco'?'Belo mestno jedro, slika iz Matejinega dokumenta':p.name+' · slika iz Matejinega dokumenta')}" width="1000" height="650" loading="lazy"><div class="day-number"><b>${String(i+1).padStart(2,'0')}</b><span>${esc(dateLabel(i,true))}</span></div></div><div class="day-body"><h3>${esc(d.title)}</h3><div class="day-tags"><span class="night">${d.night?'☾ '+esc(D.places[d.night].name):'✈ let domov'}</span><span>Vožnja: ${esc(d.drive)}</span><span>Hoja: ${esc(d.walk)}</span></div><ol class="day-schedule">${d.blocks.map(([time,text])=>`<li><b>${esc(time)}</b>${esc(text)}</li>`).join('')}</ol><details class="day-practical"><summary>Praktično in rezervni načrt</summary><p>${esc(d.note)}</p></details>${bookingFor(d,i)?`<a class="day-booking" href="#booking-${esc(bookingFor(d,i).id)}">✓ Rezervirano: ${esc(bookingFor(d,i).name)} · ${esc(bookingFor(d,i).arrivalWindow)}</a>`:""}<div class="day-actions"><a href="${esc(routeURL(drivingStops,mapMode))}" target="_blank" rel="noopener noreferrer">${transitLastDay?'Javni prevoz do AGP ↗':d.via.length>1?'Pot med kraji ↗':'Kraj v Maps ↗'}</a>${transferDay?'<a href="https://www.aena.es/es/malaga-costa-del-sol/como-llegar/tren.html" target="_blank" rel="noopener noreferrer">C1 v center ↗</a>':''}<button class="story-link" type="button" data-guide="${d.guide}">Preberi zgodbo ↓</button><button type="button" data-place="${d.city}" data-jump-map="true">Na zemljevid</button></div></div></article>`;}).join('');
}
function renderGuides(){
 $('guide-cards').innerHTML=D.guides.map(g=>`<details class="guide-card" id="zgodba-${g.id}" data-search="${esc((g.title+' '+g.body.join(' ')).toLocaleLowerCase('sl'))}"><summary><img src="${photo(g.image)}" alt="${esc(g.image==='sevilla-plaza'?'Plaza de España v Sevilli':g.image==='pueblo-blanco'?'Belo mestno jedro iz Wordovega dokumenta':g.title)}" width="750" height="500" loading="lazy"><span class="guide-summary-text"><b>${esc(g.title)}</b><small>${esc(g.where)}</small><span class="guide-read">Odpri pripoved ＋</span></span></summary><div class="guide-body">${g.body.map(p=>`<p>${esc(p)}</p>`).join('')}<div class="guide-look"><b>Poglejta še to</b>${esc(g.look)}</div><p class="guide-route">${esc(g.route)}</p><div class="guide-actions"><button type="button" data-speak="${g.id}">▶ Poslušaj</button><a href="${esc(mapSearch(D.places[g.place].query))}" target="_blank" rel="noopener noreferrer">Lokacija ↗</a><a href="${esc(g.url)}" target="_blank" rel="noopener noreferrer">Vir zgodbe ↗</a></div></div></details>`).join('');
}
const gallery=[
 ['nerja-panorama','Nerja · pogled na obalo'],['nerja-balcon','Nerja · Balcón de Europa'],['granada-alhambra','Granada · Alhambra'],['cordoba-mezquita','Córdoba · Mezquita'],['carmona-puerta','Carmona · vrata v jedro'],['sevilla-plaza','Sevilla · Plaza de España'],['setenil-roca','Setenil · pod skalnim previsom'],['ronda-puente','Ronda · Puente Nuevo'],['pueblo-blanco','Belo mestno jedro · kraj na sliki ni potrjen'],['malaga-alcazaba','Málaga · gledališče in Alcazaba'],['nerja-costa','Nerja · obala in razgledišče'],['nerja-calles','Nerja · bele ulice'],['nerja-calahonda','Nerja · Calahonda'],['sevilla-metro','Primer mestne povezave iz Worda'],['alojamiento-rural','Primer podeželske nastanitve iz Worda'],['alojamiento-granada','Slikovni primer nastanitve · Granada'],['alojamiento-malaga','Slikovni primer nastanitve · Málaga'],['alojamiento-cordoba','Slikovni primer nastanitve · Córdoba'],['alojamiento-sevilla','Slikovni primer nastanitve · Sevilla'],['alojamiento-ronda','Slikovni primer nastanitve · Ronda'],['alojamiento-marbella','Slikovni primer nastanitve · Marbella']
];
function renderSupporting(){
 $('hotel-cards').innerHTML=D.hotels.map(h=>`<article class="hotel-card"><img src="${photo(h.image)}" alt="Slikovni primer nastanitve iz Worda; povezava s konkretno enoto ni potrjena" width="800" height="500" loading="lazy"><div class="hotel-content"><p class="hotel-city">${esc(h.city)}</p><h3>${esc(h.name)}</h3><p>${esc(h.note)}</p><span class="hotel-status">Kandidat iz izvirnika · nepreverjena ponudba</span><br><a class="text-link" target="_blank" rel="noopener noreferrer" href="${esc(h.url)}">Izvirna povezava ↗</a></div></article>`).join('');
 $('photo-gallery').innerHTML=gallery.map(([image,label])=>`<button type="button" data-photo="${image}" data-caption="${esc(label)}" aria-label="Povečaj: ${esc(label)}"><img src="${photo(image)}" alt="${esc(label)}" width="800" height="550" loading="lazy"><span>${esc(label)}</span></button>`).join('');
 $('source-list').innerHTML=D.sources.map(s=>`<div class="source-item"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ↗</a><p>${esc(s.note)}</p></div>`).join('');
 const checks=[['flights','Podatki leta','Dopolnite po potrditvi.'],['alhambra','Alhambra in Nasridske palače','Preverite datum in uro vstopnice.'],['sleep','Nastanitve','Potrditve so v osebnem delu.'],['car','Avto in vračilo','Preverite pogodbo, dovoze in končni račun.'],['sevilla','Sevillski ogledi','Velike oglede ločite z odmori.'],['final','Pred odhodom','Urniki, vreme in shranjene vstopnice.']];
 if($('booking-checklist'))$('booking-checklist').innerHTML=checks.map(([id,title,text])=>`<label class="check-item"><input type="checkbox" data-check="${id}" ${get(KEY+'check-'+id,'')==='1'?'checked':''}><span><b>${esc(title)}</b><small>${esc(text)}</small></span></label>`).join('');
}

// A self-contained geographic overview. The colored lines deliberately are not roads.
const project=([lon,lat])=>[(lon+6.7)*260,(38.35-lat)*320];
const point=id=>project([D.places[id].lon,D.places[id].lat]);
let zoom=1,panX=0,panY=0;
let photoMap=null,photoLayers=null,activePhotoLayer=null,leafletLoading=null;
let mapMode='satellite',mapViewRequest=0;
const photoRoutes=new Map(),photoMarkers=new Map();
function polygonPath(geometry){
 const polys=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
 return polys.map(poly=>poly.map(ring=>ring.map((xy,i)=>{const [x,y]=project(xy);return (i?'L':'M')+x.toFixed(2)+' '+y.toFixed(2);}).join(' ')+' Z').join(' ')).join(' ');
}
function renderMap(){
 $('map-viewport').innerHTML=`<rect x="-2000" y="-2000" width="5000" height="5000" fill="#0c2532"/><rect x="0" y="0" width="1000" height="700" fill="url(#map-grid)"/>${D.boundaries.map(g=>`<path d="${polygonPath(g)}" fill="#203b36" stroke="#4a685c" stroke-width="1.5" filter="url(#land-shadow)"/>`).join('')}<text class="region-label" x="420" y="255">ANDALUZIJA</text><text class="water-label" x="630" y="670">Sredozemsko morje</text><g id="map-routes"></g><g id="map-nodes"></g>`;
 $('map-toggles').innerHTML=variants.map(k=>`<label style="--route:${D.variants[k].color}"><input type="checkbox" data-map-toggle="${k}" checked><i class="route-dot"></i>${D.variants[k].letter} · ${D.variants[k].label}</label>`).join('');
 $('place-buttons').innerHTML=Object.entries(D.places).map(([id,p])=>`<button type="button" data-place="${id}" aria-pressed="${id===selectedPlace}">${esc(p.name)}</button>`).join('');
 updateMapRoutes();updatePlace();applyMapTransform();
}
function updateMapRoutes(){
 $('map-routes').innerHTML=variants.filter(k=>visible.has(k)).map(k=>{const v=D.variants[k],lane=(variants.indexOf(k)-1)*7;const points=v.route.map(id=>{const [x,y]=point(id);return (x+lane).toFixed(2)+','+y.toFixed(2);}).join(' ');return `<polyline points="${points}" fill="none" stroke="${v.color}" stroke-width="${k===selected?5:4}" stroke-dasharray="${v.dash}" stroke-linejoin="round" stroke-linecap="round" opacity="${k===selected?1:.7}"><title>${v.label}: ${v.route.map(id=>D.places[id].name).join(' → ')}</title></polyline>`;}).join('');
 updatePhotoRoutes();
}
function updatePlace(){
 const p=D.places[selectedPlace];
 $('map-nodes').innerHTML=Object.entries(D.places).map(([id,p])=>{const [x,y]=point(id);return `<g class="city-node" data-place="${id}"><circle cx="${x}" cy="${y}" r="${id===selectedPlace?9:6}" fill="${id===selectedPlace?'#ebc783':'#d0e2da'}" stroke="#102832" stroke-width="3"/><text class="city-label" x="${x+p.dx}" y="${y+p.dy}" text-anchor="${p.anchor}">${esc(p.name)}</text></g>`;}).join('');
 $('place-buttons').querySelectorAll('[data-place]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.place===selectedPlace)));
 $('map-detail').innerHTML=`<div><h3>${esc(p.name)}</h3><p>Datumi vključujejo tudi prihod oziroma odhod.</p><a class="text-link" href="${esc(mapSearch(p.query))}" target="_blank" rel="noopener noreferrer">Odpri lokacijo v Maps ↗</a></div><div>${variants.map(k=>`<div class="map-date-row" style="--route:${D.variants[k].color}"><b>${D.variants[k].letter} · ${D.variants[k].label}</b><span>${esc(datesForPlace(D.variants[k],selectedPlace))}</span></div>`).join('')}${!visible.size?'<p>Nobena pot ni prikazana. Vključita jo s kljukico nad zemljevidom.</p>':''}</div>`;
 updatePhotoMarkers();
}
function applyMapTransform(){$('map-viewport').setAttribute('transform',`translate(${panX} ${panY}) scale(${zoom})`);}
function changeZoom(factor){if(photoMap&&mapMode!=='scheme'){factor>1?photoMap.zoomIn():photoMap.zoomOut();return;}const next=Math.max(1,Math.min(3,zoom*factor));const [x,y]=point(selectedPlace);zoom=next;panX=500-x*zoom;panY=350-y*zoom;if(zoom===1){panX=0;panY=0;}applyMapTransform();}
function choosePlace(id,jump){if(!D.places[id])return;selectedPlace=id;updatePlace();if(photoMap&&mapMode!=='scheme'){const p=D.places[id];photoMap.panTo([p.lat,p.lon]);}if(zoom>1){const[x,y]=point(id);panX=500-x*zoom;panY=350-y*zoom;applyMapTransform();}if(jump)$('zemljevid').scrollIntoView({behavior:'smooth',block:'start'});}

function loadLeaflet(){
 if(window.L)return Promise.resolve();
 if(leafletLoading)return leafletLoading;
 leafletLoading=new Promise((resolve,reject)=>{
  const script=document.createElement('script');let settled=false;
  const finish=ok=>{if(settled)return;settled=true;clearTimeout(timer);if(ok&&window.L)resolve();else{script.remove();leafletLoading=null;reject(new Error('MAP_LIBRARY_UNAVAILABLE'));}};
  script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  script.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
  script.crossOrigin='anonymous';script.referrerPolicy='strict-origin-when-cross-origin';
  script.onload=()=>finish(true);script.onerror=()=>finish(false);
  const timer=setTimeout(()=>finish(false),12000);document.head.append(script);
 });return leafletLoading;
}
function fitPhotoMap(){if(photoMap)photoMap.fitBounds(Object.values(D.places).map(p=>[p.lat,p.lon]),{padding:[38,45],maxZoom:9,animate:false});}
function updatePhotoRoutes(){
 if(!photoMap)return;
 photoRoutes.forEach(layer=>photoMap.removeLayer(layer));photoRoutes.clear();
 variants.forEach((k,i)=>{if(!visible.has(k))return;const v=D.variants[k];
  const line=window.L.polyline(v.route.map(id=>[D.places[id].lat,D.places[id].lon]),{color:v.color,weight:[11,7,3.5][i],opacity:k===selected?1:.85,dashArray:k==='claude'?'14 10':undefined,lineCap:'round',lineJoin:'round',className:'photo-route photo-route-'+k});
  line.bindTooltip(esc(v.letter+' · '+v.label));line.addTo(photoMap);photoRoutes.set(k,line);
 });
 photoMarkers.forEach(marker=>marker.bringToFront());
 $('photo-map').dataset.visibleRoutes=variants.filter(k=>visible.has(k)).join(',');
}
function updatePhotoMarkers(){photoMarkers.forEach((marker,id)=>{marker.setStyle({fillColor:id===selectedPlace?'#ebc783':'#f6f6ed',color:'#10232e',weight:2});marker.setRadius(id===selectedPlace?8:5);marker.bringToFront();});}
async function ensurePhotoMap(){
 if(photoMap)return photoMap;await loadLeaflet();if(mapMode==='scheme')return null;if(photoMap)return photoMap;
 const L=window.L;$('map-host').classList.add('photo-mode');
 photoMap=L.map('photo-map',{zoomControl:false,scrollWheelZoom:false,minZoom:6,maxZoom:19,maxBounds:[[34,-11],[44,5]],maxBoundsViscosity:.8,attributionControl:true});
 photoMap.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>');
 photoLayers={
  satellite:L.tileLayer('https://www.ign.es/wmts/pnoa-ma?service=WMTS&request=GetTile&version=1.0.0&layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible&format=image/jpeg&tilematrix={z}&tilerow={y}&tilecol={x}',{maxZoom:19,keepBuffer:1,referrerPolicy:'strict-origin-when-cross-origin',attribution:'<a href="https://pnoa.ign.es/" target="_blank" rel="noopener noreferrer">PNOA / IGN–CNIG</a> · <a href="https://www.ign.es/web/ign/portal/politica-datos" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>'}),
  streets:L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,keepBuffer:1,referrerPolicy:'strict-origin-when-cross-origin',attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'})
 };
 Object.entries(photoLayers).forEach(([mode,layer])=>{let loaded=0,errors=0;
  layer.on('tileload',()=>{loaded++;if(mapMode===mode)$('photo-map').dataset.tiles='ready';});
  layer.on('load',()=>{if(mapMode===mode&&loaded){$('map-status').textContent=mode==='satellite'?'Satelit in ortofoto · IGN/PNOA. Izberita kraj ali povečajta zemljevid.':'Cestni zemljevid · OpenStreetMap. Barvne črte kažejo vrstni red postankov.';}});
  layer.on('tileerror',()=>{errors++;if(mapMode===mode&&!loaded&&errors>=3){$('photo-map').dataset.tiles='error';$('map-status').textContent='Podlage ni bilo mogoče naložiti. Poskusita drugi pogled ali Shemo; vse tri poti ostanejo dostopne.';}});
 });
 Object.entries(D.places).forEach(([id,p])=>{
  const label=document.createElement('span');label.textContent=p.name;
  const marker=L.circleMarker([p.lat,p.lon],{radius:5,color:'#10232e',fillColor:'#f6f6ed',fillOpacity:1,weight:2,className:'photo-place photo-place-'+id}).addTo(photoMap);
  marker.bindTooltip(label,{permanent:['malaga','granada','cordoba','sevilla','ronda','nerja'].includes(id),direction:'top',offset:[0,-6],className:'photo-city-label'});
  marker.on('click',()=>choosePlace(id,false));photoMarkers.set(id,marker);
 });
 photoMap.on('zoomend',()=>{$('photo-map').dataset.zoom=String(photoMap.getZoom());});
 fitPhotoMap();updatePhotoRoutes();updatePhotoMarkers();return photoMap;
}
function syncMapView(){document.querySelectorAll('[data-map-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mapView===mapMode)));$('map-host').dataset.mapMode=mapMode;}
async function setMapView(mode){
 if(!['satellite','streets','scheme'].includes(mode))return;
 const request=++mapViewRequest;mapMode=mode;syncMapView();
 if(mode==='scheme'){$('map-host').classList.remove('photo-mode');if(photoMap&&activePhotoLayer){photoMap.removeLayer(activePhotoLayer);activePhotoLayer=null;}$('map-status').textContent='Shema vseh treh poti · deluje tudi brez zunanje podlage.';return;}
 $('map-status').textContent=mode==='satellite'?'Nalagam satelit in ortofoto …':'Nalagam cestni zemljevid …';
 try{await ensurePhotoMap();if(request!==mapViewRequest||mode!==mapMode||!photoMap)return;
  $('map-host').classList.add('photo-mode');photoMap.invalidateSize({pan:false});
  if(activePhotoLayer)photoMap.removeLayer(activePhotoLayer);
  activePhotoLayer=photoLayers[mode];$('photo-map').dataset.tiles='loading';activePhotoLayer.addTo(photoMap);updatePhotoRoutes();updatePhotoMarkers();
 }catch{if(request!==mapViewRequest)return;mapMode='scheme';syncMapView();$('map-host').classList.remove('photo-mode');$('map-status').textContent='Fotografskega zemljevida ni bilo mogoče naložiti. Shema deluje; za ponovni poskus izberita Satelit ali Cestni zemljevid.';}
}

const defaults={malaga:110,granada:90,cordoba:95,sevilla:120,ronda:90,marbella:110};
function initBudget(){
 if(!D.privateUnlocked||!$('guest-count'))return;
 $('use-confirmed-bookings').checked=get(KEY+'use-confirmed-bookings','1')!=='0';
 $('use-confirmed-bookings').addEventListener('change',()=>{put(KEY+'use-confirmed-bookings',$('use-confirmed-bookings').checked?'1':'0');renderBudget();});
 const partyKey=KEY+'confirmed-party-20261019',partyChanged=get(partyKey,'')!=='1'&&get(KEY+'guest-count',null)===null;
 if(partyChanged){$('guest-count').value=String(D.purchase.flights.passengers);D.preferences[KEY+'guest-count']=$('guest-count').value;D.preferences[partyKey]='1';}
 $('room-rates').innerHTML=Object.entries(defaults).map(([city,value])=>`<label>${esc(D.places[city].name)} (€)<input id="rate-${city}" type="number" min="0" max="100000" step="1" value="${value}"></label>`).join('');
 ['guest-count','car-pickup','car-rate','parking-rate','food-rate','ticket-rate',...Object.keys(defaults).map(c=>'rate-'+c)].forEach(id=>{const stored=get(KEY+id,null);if(stored!==null&&!(id==='guest-count'&&partyChanged))$(id).value=stored;$(id).addEventListener('input',()=>{put(KEY+id,$(id).value);renderBudget();});});
 renderBudget();
}
const numeric=id=>{const el=$(id),n=Number(el.value),max=Number(el.max)||1000000;return Number.isFinite(n)?Math.min(max,Math.max(0,n)):0;};
function rentalDays(pickup,drop){
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(pickup))return null;
 const ms=Date.parse(drop+'Z')-Date.parse(pickup+'Z');
 if(!Number.isFinite(ms)||ms<=0)return null;
 return Math.ceil(ms/86400000);
}
function budgetFor(key){
 const v=D.variants[key],guests=Math.max(1,numeric('guest-count')),days=rentalDays($('car-pickup').value,v.returnAt);
 let lodging=0,confirmedLodging=0;v.days.forEach((d,i)=>{if(!d.night)return;const booked=$('use-confirmed-bookings').checked&&bookingFor(d,i);const amount=booked?booked.totalEur/booked.nights:numeric('rate-'+d.night);lodging+=amount;if(booked)confirmedLodging+=amount;});lodging=Math.round(lodging*100)/100;confirmedLodging=Math.round(confirmedLodging*100)/100;
 const pickupDate=$('car-pickup').value.slice(0,10);
 const start=Math.max(Date.parse(pickupDate+'T00:00Z'),Date.parse(D.trip.startDate+'T00:00Z'));
 const stop=Math.min(Date.parse(v.returnAt.slice(0,10)+'T00:00Z'),Date.parse(D.trip.endDate+'T00:00Z'));
 const parkingNights=Number.isFinite(start)&&Number.isFinite(stop)?Math.max(0,Math.round((stop-start)/86400000)):0;
 const parts={flights:D.purchase.flights.totalEur,lodging,car:(days??0)*numeric('car-rate'),parking:parkingNights*numeric('parking-rate'),food:guests*10*numeric('food-rate'),tickets:guests*numeric('ticket-rate')};
 const total=Object.values(parts).reduce((s,n)=>s+n,0);
 return {days,parts,total,guests,parkingNights,confirmedLodging};
}
function renderBudget(){
 if(!D.privateUnlocked||!$('budget-results'))return;
 $('budget-results').innerHTML=variants.map(k=>{const v=D.variants[k],b=budgetFor(k);return `<article class="budget-result ${k===selected?'selected':''}" style="--route:${v.color}"><div class="budget-head"><span>${v.letter} · ${v.label}</span><b>${b.days===null?'Preveri prevzem':money(b.total)}</b></div><p>${b.days===null?'Prevzem mora biti veljaven in pred vračilom.':b.days+' dni najema · '+money(b.total/b.guests)+' / osebo · '+b.parkingNights+' noči parkiranja · že plačani leti vključeni'}</p><details><summary>Razčlenitev izračuna</summary><div class="budget-breakdown">${[['Letalske karte · 3 / že plačano',b.parts.flights],['Nočitve · '+money(b.confirmedLodging)+' potrjeno + '+money(b.parts.lodging-b.confirmedLodging)+' ocena',b.parts.lodging],['Avto',b.parts.car],['Parkiranje',b.parts.parking],['Hrana',b.parts.food],['Ogledi',b.parts.tickets]].map(([label,value])=>`<span>${label}</span><span>${money(value)}</span>`).join('')}</div></details></article>`;}).join('');
}
function renderFlight(){
 if(!D.privateUnlocked||!$('flight-time'))return;
 const raw=$('flight-time').value;
 if(!raw){$('flight-result').textContent='Ure kupljenega leta v dosegljivih dokazilih še ni. Dokler ni potrjena, ogledov na dan odleta ne potrjujemo.';return;}
 const [h,m]=raw.split(':').map(Number),depart=h*60+m-210;
 const format=min=>String(Math.floor(min/60)).padStart(2,'0')+':'+String(min%60).padStart(2,'0');
 if(depart<0){$('flight-result').textContent='Let je zelo zgodaj. Potrebujeta transfer že prejšnji večer oziroma ponoči; ogledi na dan odleta odpadejo.';return;}
 $('flight-result').textContent='Informativno za vneseno uro (ni preverjena z vozovnico): zadnji odhod iz centra '+format(depart)+'. '+(h*60+m>=1200?'Alcazaba od 14.00 je časovno možna, če je potrjena hramba prtljage in ostane dovolj rezerve. Gibralfaro naj ostane izpuščen.':h*60+m<780?'Za jutranji ogled je lahko premalo časa; prednost imata pravočasni transfer in let.':'Prednost ima plačljiv dopoldanski ogled. Ne čakata do 14.00 samo zaradi brezplačnega vstopa.')+(selected==='mateja'?' V različici A avto vračata danes: odhod premaknita še prej za pregled oziroma shuttle.':'');
}
function choosePlan(key){
 if(!variants.includes(key))return;selected=key;put(KEY+'plan',key);
 try{const u=new URL(location.href);u.searchParams.set('plan',key);history.replaceState(null,'',u);}catch{}
 renderVariantControls();renderCompare();renderDays();updateMapRoutes();updatePlace();renderBudget();renderFlight();
}
function openStory(id){
 const el=$('zgodba-'+id);if(!el)return;
 $('guide-search').value='';document.querySelectorAll('.guide-card').forEach(c=>c.hidden=false);$('guide-empty').hidden=true;el.open=true;el.scrollIntoView({behavior:'smooth',block:'start'});
}
let activeSpeech=null;
function speak(id){
 const g=D.guides.find(g=>g.id===id);if(!g)return;
 if(!('speechSynthesis' in window)){$('audio-status').textContent='Ta brskalnik ne podpira branja. Besedilo je na voljo v odprti zgodbi.';openStory(id);return;}
 speechSynthesis.cancel();
 const voices=speechSynthesis.getVoices(),sl=voices.find(v=>v.lang.toLowerCase().startsWith('sl'));
 if(!sl){$('audio-status').textContent='Slovenski glas v tej napravi ni na voljo. Besedilo ostaja odprto za branje; dodajta slovenski sistemski glas in poskusita znova.';openStory(id);return;}
 activeSpeech=new SpeechSynthesisUtterance(g.title+'. '+g.body.join(' '));activeSpeech.lang='sl-SI';activeSpeech.voice=sl;activeSpeech.rate=.92;
 activeSpeech.onend=()=>{$('audio-status').textContent='Branje končano.';};activeSpeech.onerror=()=>{$('audio-status').textContent='Branje se je ustavilo; besedilo ostaja na voljo.';};
 $('audio-status').textContent='Berem: '+g.title;speechSynthesis.speak(activeSpeech);openStory(id);
}
function saveNotesFile(){window.dispatchEvent(new CustomEvent('andaluzija-export-encrypted'));}
document.addEventListener('click',e=>{
 const view=e.target.closest('[data-map-view]');if(view){setMapView(view.dataset.mapView);return;}
 const plan=e.target.closest('[data-plan]');if(plan){choosePlan(plan.dataset.plan);return;}
 const day=e.target.closest('[data-day-plan]');if(day){choosePlan(day.dataset.dayPlan);$('dan-'+(Number(day.dataset.dayIndex)+1)).scrollIntoView({behavior:'smooth'});return;}
 const guide=e.target.closest('[data-guide]');if(guide){openStory(guide.dataset.guide);return;}
 const place=e.target.closest('[data-place]');if(place){choosePlace(place.dataset.place,place.dataset.jumpMap==='true');return;}
 const speech=e.target.closest('[data-speak]');if(speech){speak(speech.dataset.speak);return;}
 const picture=e.target.closest('[data-photo]');if(picture){$('lightbox-photo').src=photo(picture.dataset.photo);$('lightbox-photo').alt=picture.dataset.caption;$('lightbox-caption').textContent=picture.dataset.caption+' · izvlečeno iz Matejinega Worda';$('photo-dialog').showModal();}
});
document.addEventListener('change',e=>{
 if(e.target.matches('[data-map-toggle]')){const key=e.target.dataset.mapToggle;e.target.checked?visible.add(key):visible.delete(key);updateMapRoutes();updatePlace();}
 if(e.target.matches('[data-check]'))put(KEY+'check-'+e.target.dataset.check,e.target.checked?'1':'0');
});
$('guide-search').addEventListener('input',()=>{const q=$('guide-search').value.trim().toLocaleLowerCase('sl');let count=0;document.querySelectorAll('.guide-card').forEach(c=>{c.hidden=!c.dataset.search.includes(q);if(!c.hidden)count++;});$('guide-empty').hidden=count>0;});
$('open-guides').onclick=()=>{const cards=[...document.querySelectorAll('.guide-card:not([hidden])')],open=cards.some(c=>!c.open);cards.forEach(c=>c.open=open);$('open-guides').textContent=open?'Zapri zgodbe':'Odpri vse zgodbe';};
$('stop-audio').onclick=()=>{if('speechSynthesis' in window)speechSynthesis.cancel();$('audio-status').textContent='Branje ustavljeno.';};
function bindPrivate(){
 if(!D.privateUnlocked||!$('bd-notes'))return;
 $('bd-notes').value=get(KEY+'notes','');
$('bd-notes').addEventListener('input',()=>{$('notes-status').textContent=put(KEY+'notes',$('bd-notes').value)?'Lokalna sprememba; skupno shranjevanje preverita pri Najini ogledi.':'Za trajno kopijo uporabi Izvozi zapiske.';});
$('export-notes').onclick=saveNotesFile;
if($('flight-time')){$('flight-time').value=get(KEY+'flight-time','');$('flight-time').addEventListener('input',()=>{put(KEY+'flight-time',$('flight-time').value);renderFlight();});}
 initBudget();renderFlight();
}

$('map-zoom-in').onclick=()=>changeZoom(1.35);$('map-zoom-out').onclick=()=>changeZoom(1/1.35);$('map-reset').onclick=()=>{if(photoMap&&mapMode!=='scheme'){fitPhotoMap();return;}zoom=1;panX=0;panY=0;applyMapTransform();};
const mapCard=document.querySelector('.map-card');
function expandMap(force){const expanded=force??!mapCard.classList.contains('map-expanded');mapCard.classList.toggle('map-expanded',expanded);document.body.style.overflow=expanded?'hidden':'';$('map-expand').textContent=expanded?'Zapri zemljevid':'Razširi';if(photoMap)requestAnimationFrame(()=>photoMap.invalidateSize({pan:false}));}
$('map-expand').onclick=()=>expandMap();document.addEventListener('keydown',e=>{if(e.key==='Escape')expandMap(false);});
let drag=null;
$('trip-map').addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||zoom===1)return;drag={x:e.clientX,y:e.clientY,px:panX,py:panY};$('trip-map').setPointerCapture(e.pointerId);});
$('trip-map').addEventListener('pointermove',e=>{if(!drag)return;const rect=$('trip-map').getBoundingClientRect(),scale=Math.min(rect.width/1000,rect.height/700);panX=drag.px+(e.clientX-drag.x)/scale;panY=drag.py+(e.clientY-drag.y)/scale;applyMapTransform();});
$('trip-map').addEventListener('pointerup',()=>drag=null);$('trip-map').addEventListener('pointercancel',()=>drag=null);
let font=Number(get('bd-trip-font-percent-v1','100'));if(!Number.isFinite(font))font=100;
function setFont(n){font=Math.min(200,Math.max(80,n));document.documentElement.style.setProperty('--scale',font/100);$('font-reset').textContent=font+'%';put('bd-trip-font-percent-v1',font);}
$('font-minus').onclick=()=>setFont(font-10);$('font-plus').onclick=()=>setFont(font+10);$('font-reset').onclick=()=>setFont(100);
if($('print-page'))$('print-page').onclick=()=>window.print();
window.addEventListener('pagehide',()=>{if('speechSynthesis' in window)speechSynthesis.cancel();});
renderTripYear();renderVariantControls();renderCompare();renderDays();renderGuides();renderSupporting();renderMap();bindPrivate();setFont(font);
if('IntersectionObserver' in window){const mapObserver=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){mapObserver.disconnect();if(mapMode!=='scheme')setMapView(mapMode);}},{rootMargin:'150px'});mapObserver.observe($('map-host'));}else setMapView(mapMode);
if('ResizeObserver' in window)new ResizeObserver(()=>{if(photoMap&&mapMode!=='scheme')photoMap.invalidateSize({pan:false});}).observe($('map-host'));
if('ResizeObserver' in window){new ResizeObserver(()=>{document.documentElement.style.setProperty('--topbar-h',document.querySelector('.topbar').getBoundingClientRect().height+'px');}).observe(document.querySelector('.topbar'));}
// Expose only deterministic data/math for inspection, without user notes or stored data.
window.addEventListener('andaluzija-preferences-sync',e=>{if(!D.privateUnlocked)return;D.preferences=e.detail||{};for(const id of ['bd-notes','flight-time','guest-count','car-pickup','car-rate','parking-rate','food-rate','ticket-rate',...Object.keys(defaults).map(c=>'rate-'+c)]){const el=$(id);if(el)el.value=get(KEY+(id==='bd-notes'?'notes':id),el.defaultValue||'');}document.querySelectorAll('[data-check]').forEach(el=>el.checked=get(KEY+'check-'+el.dataset.check,'')==='1');if($('use-confirmed-bookings'))$('use-confirmed-bookings').checked=get(KEY+'use-confirmed-bookings','1')!=='0';renderBudget();renderFlight();});
window.addEventListener('andaluzija-content',e=>{const p=e.detail;Object.keys(D).forEach(k=>delete D[k]);Object.assign(D,p?.data||JSON.parse(JSON.stringify(PUBLIC_DATA)));D.privateUnlocked=!!p;D.preferences=p?.preferences||{};renderTripYear();renderVariantControls();renderCompare();renderDays();renderSupporting();updatePlace();bindPrivate();});
window.AndaluzijaApp=Object.freeze({version:D.version,rentalDays,blocks,key:()=>selected});
})();


