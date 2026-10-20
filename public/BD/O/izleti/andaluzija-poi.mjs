/* BD × AI Lab · Andaluzija 2027 · candidate catalogue, not booked entries.
 * Durations and coordinates are planning estimates. Maps links use named places;
 * Google geocoding/matrices are never persisted here. Checked names: 2026-10-20. */
export const SCHEMA='andaluzija-trip-v1';
export const VARIANTS=['mateja','claude','gpt'];
export const cities={
 malaga:{name:'Málaga',source:'https://visita.malaga.eu/',entry:['Plaza de la Marina',36.7177,-4.4208],stops:[
 ['teatro','Teatro Romano · Calle Alcazabilla',30,36.7210,-4.4162],
 ['alcazaba','Alcazaba · vhod Calle Alcazabilla',100,36.7211,-4.4156],
 ['catedral','Catedral de Málaga · Plaza del Obispo',50,36.7193,-4.4200],
 ['muelle','Muelle Uno',45,36.7145,-4.4132],
 ['atarazanas','Mercado Central de Atarazanas',40,36.7180,-4.4240,true],
 ['gibralfaro','Castillo de Gibralfaro',75,36.7233,-4.4119,true]]},
 nerja:{name:'Nerja',source:'https://visita.nerja.es/planifica/balcon-de-europa-p107096',entry:['Plaza de España',36.7469,-3.8770],note:'Jame niso vključene.',stops:[
 ['balcon','Balcón de Europa',35,36.7448,-3.8766],
 ['calles','Calle Pintada · staro jedro',40,36.7480,-3.8758],
 ['calahonda','Mirador de Calahonda',20,36.7451,-3.8758]]},
 granada:{name:'Granada',source:'https://www.alhambra-patronato.es/visitar',entry:['Plaza Nueva',37.1772,-3.5953],note:'Alhambra in Generalife sta en kompleks; uro Nasridskih palač določite po vstopnici.',stops:[
 ['alhambra','Alhambra in Generalife · Pabellón de Acceso',270,37.1730,-3.5841],
 ['darro','Carrera del Darro',35,37.1786,-3.5914],
 ['albaicin','Albaicín · Plaza Larga',50,37.1840,-3.5929],
 ['san-nicolas','Mirador de San Nicolás',35,37.1813,-3.5927],
 ['martires','Carmen de los Mártires · Paseo de los Mártires',60,37.1728,-3.5896,true]]},
 cordoba:{name:'Córdoba',source:'https://www.turismodecordoba.org/',entry:['Puerta del Puente',37.8771,-4.7794],stops:[
 ['mezquita','Mezquita-Catedral · Puerta del Perdón',110,37.8796,-4.7795],
 ['juderia','Judería · Calle Judíos',45,37.8796,-4.7823],
 ['puente','Puente Romano',30,37.8760,-4.7780],
 ['basilio','San Basilio · Calle San Basilio',40,37.8768,-4.7837],
 ['viana','Palacio de Viana · Plaza de Don Gome',80,37.8886,-4.7740,true],
 ['alcazar','Alcázar de los Reyes Cristianos · vrtovi',60,37.8767,-4.7823,true]]},
 carmona:{name:'Carmona',source:'https://turismo.carmona.org/alcazar-puerta-de-sevilla/',entry:['Puerta de Sevilla',37.4712,-5.6461],note:'Celoten postanek je možnost, ne obvezen ogled.',stops:[
 ['puerta','Alcázar de la Puerta de Sevilla',30,37.4712,-5.6461],
 ['san-fernando','Plaza de San Fernando',30,37.4721,-5.6398]]},
 sevilla:{name:'Sevilla',source:'https://visitasevilla.es/en/',entry:['Puerta de Jerez',37.3815,-5.9930],note:'Najprej prevoz do Puerta de Jerez. Peš krog se ne začne v Camasu.',stops:[
 ['alcazar','Real Alcázar · Puerta del León',180,37.3845,-5.9911],
 ['catedral','Catedral in Giralda · vhod obiskovalcev',105,37.3860,-5.9925],
 ['santa-cruz','Barrio Santa Cruz · Plaza de Doña Elvira',40,37.3845,-5.9882],
 ['espana','Plaza de España',50,37.3772,-5.9869],
 ['maria-luisa','Parque de María Luisa',40,37.3744,-5.9883],
 ['triana','Triana · Plaza del Altozano',60,37.3851,-6.0030,true],
 ['pilatos','Casa de Pilatos',65,37.3896,-5.9870,true],
 ['setas','Setas de Sevilla',45,37.3933,-5.9919,true]]},
 setenil:{name:'Setenil de las Bodegas',source:'https://www.cadizturismo.com/municipios/setenil-de-las-bodegas',entry:['Parking Los Caños · Avenida del Carmen',36.8649,-5.1782],note:'Parkiranje na robu; ozkih ulic ne uporabljajte za dovoz.',stops:[
 ['sol','Calle Cuevas del Sol',35,36.8616,-5.1795],
 ['sombra','Calle Cuevas de la Sombra',25,36.8619,-5.1796]]},
 ronda:{name:'Ronda',source:'https://www.turismoderonda.es/en',entry:['Oficina de Turismo · Paseo Blas Infante',36.7428,-5.1678],note:'Izberite en notranji ogled. Spust v sotesko je dodatni napor.',stops:[
 ['puente','Puente Nuevo',35,36.7407,-5.1659],
 ['casco','Staro jedro · Plaza Duquesa de Parcent',45,36.7372,-5.1655],
 ['cuenca','Jardines de Cuenca',35,36.7407,-5.1635],
 ['mondragon','Palacio de Mondragón',60,36.7380,-5.1676,true],
 ['banos','Baños Árabes · Calle Molino de Alarcón',60,36.7376,-5.1623,true]]},
 marbella:{name:'Marbella',source:'https://turismo.marbella.es/vive/cultura/patrimonio-historico/casco-historico/plaza-de-los-naranjos.html',entry:['Avenida del Mar',36.5081,-4.8847],stops:[
 ['naranjos','Plaza de los Naranjos',30,36.5102,-4.8851],
 ['casco','Staro jedro · Calle Ancha',35,36.5125,-4.8859],
 ['paseo','Paseo Marítimo · Playa de la Venus',45,36.5066,-4.8851]]},
 mijas:{name:'Mijas Pueblo',source:'https://turismo.mijas.es/es/',entry:['Plaza Virgen de la Peña',36.5951,-4.6358],stops:[
 ['plaza','Plaza de la Constitución',25,36.5952,-4.6375],
 ['calles','Stare ulice · Calle San Sebastián',30,36.5961,-4.6384],
 ['muralla','Jardines de la Muralla',40,36.5941,-4.6392]]}
};
export const clone=x=>JSON.parse(JSON.stringify(x));
export function makeStop(city,row,entry=false){
 const [slug,name,durationMin,lat,lon,optional]=entry?['entry',...row.slice(0,1),0,...row.slice(1)]:row;
 return {id:city+'-'+slug,city,name,durationMin,enabled:!optional,fixedTime:null,
 location:{query:name+', '+cities[city].name+', España',lat,lon,status:'approximate'},
 source: cities[city].source,checked:'2026-10-20',optional:!!optional};
}
export function seedDay(city,day){
 const c=cities[city];if(!c)throw Error('UNKNOWN_CITY');
 const stops=c.stops.map(row=>makeStop(city,row));
 // The complex gets its own day. These are editable starting suggestions.
 if(city==='granada')for(const p of stops)p.enabled=day===2?p.id.endsWith('-alhambra'):!p.id.endsWith('-alhambra')&&!p.optional;
 if(city==='malaga'&&[0,9].includes(day))for(const p of stops)p.enabled=day===0&&p.id==='malaga-muelle';
 if(city==='cordoba')for(const p of stops)p.enabled=day===4?p.id==='cordoba-basilio':!p.optional&&p.id!=='cordoba-basilio';
 if(city==='sevilla')for(const p of stops)p.enabled=day===4?p.id==='sevilla-triana':!p.optional;
 if(city==='ronda')for(const p of stops)p.enabled=day===6?p.id==='ronda-puente':day===7?['ronda-casco','ronda-cuenca','ronda-mondragon'].includes(p.id):false;
 return {city,entry:makeStop(city,c.entry,true),stops,breakMin:45,origin:'catalogue',receipt:null};
}
export const dayKey=(variant,day,city)=>variant+':'+day+':'+city;
export function initialState(){return {schema:SCHEMA,version:1,tripId:'andaluzija-2027',revision:0,preferences:{},days:{},selection:{variant:'gpt',day:0,city:'malaga'}};}
export function ensureDay(state,variant,day,city){const key=dayKey(variant,day,city);if(!state.days[key])state.days[key]=seedDay(city,day);return state.days[key];}
export function validateState(value){
 if(!value||value.schema!==SCHEMA||value.version!==1||value.tripId!=='andaluzija-2027'||!Number.isSafeInteger(value.revision)||value.revision<0||!value.days||Array.isArray(value.days)||Object.keys(value.days).length>300)throw Error('INVALID_STATE');
 const v=clone(value);if(JSON.stringify(v).length>300000)throw Error('STATE_TOO_LARGE');
 for(const [key,d] of Object.entries(v.days)){
  const [variant,day,city,...extra]=key.split(':');
  if(Object.keys(d).some(k=>!['city','entry','stops','breakMin','origin','receipt'].includes(k)))throw Error('DISALLOWED_DAY_FIELD');
  if(extra.length||!VARIANTS.includes(variant)||!/^[0-9]$/.test(day)||!cities[city]||d.city!==city||!Array.isArray(d.stops)||d.stops.length>49||!Number.isInteger(d.breakMin)||d.breakMin<0||d.breakMin>480)throw Error('INVALID_DAY');
  const ids=new Set();
  for(const p of [d.entry,...d.stops]){
   if(!p||typeof p.id!=='string'||!/^[a-zA-Z0-9_-]{1,90}$/.test(p.id)||ids.has(p.id)||p.city!==city||typeof p.name!=='string'||!p.name.trim()||p.name.length>180||/[\u0000-\u001f]/.test(p.name)||typeof p.enabled!=='boolean'||!Number.isInteger(p.durationMin)||p.durationMin<0||p.durationMin>720||p.fixedTime!==null&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.fixedTime))throw Error('INVALID_POI');
   if(Object.keys(p).some(k=>!['id','city','name','durationMin','enabled','fixedTime','location','source','checked','optional'].includes(k)))throw Error('DISALLOWED_POI_FIELD');
   if(p.source){let source;try{source=new URL(p.source);}catch{throw Error('INVALID_SOURCE');}if(source.protocol!=='https:'||source.username||source.password||p.source.length>700)throw Error('INVALID_SOURCE');}
   ids.add(p.id);const l=p.location;
   if(Object.keys(l||{}).some(k=>!['query','lat','lon','status','placeId'].includes(k))||l?.placeId&&!/^[A-Za-z0-9_-]{1,300}$/.test(l.placeId))throw Error('INVALID_LOCATION');
   if(!l||typeof l.query!=='string'||l.query.length<1||l.query.length>300||!['unresolved','approximate','confirmed'].includes(l.status))throw Error('INVALID_LOCATION');
   if(l.status!=='unresolved'&&(!Number.isFinite(l.lat)||!Number.isFinite(l.lon)||Math.abs(l.lat)>90||Math.abs(l.lon)>180))throw Error('INVALID_COORDINATES');
  }
 }
 if(!v.selection||!VARIANTS.includes(v.selection.variant)||!Number.isInteger(v.selection.day)||v.selection.day<0||v.selection.day>9||!cities[v.selection.city])throw Error('INVALID_SELECTION');
 // Keep a strict envelope of permitted fields, not arbitrary private data.
 const preferences=v.preferences||{};if(Object.keys(preferences).length>40||Object.entries(preferences).some(([k,x])=>!/^bd-andaluzija-2027-r1-(?:notes|check-[a-z]+|guest-count|car-pickup|car-rate|parking-rate|food-rate|ticket-rate|rate-[a-z]+|use-confirmed-bookings|confirmed-party-20261019|flight-time)$/.test(k)||typeof x!=='string'||x.length>20000))throw Error('INVALID_PREFERENCES');
 return {schema:SCHEMA,version:1,tripId:'andaluzija-2027',revision:v.revision,days:v.days,selection:v.selection,preferences};
}
function destination(p){return p.location.status==='confirmed'?p.location.lat+','+p.location.lon:p.location.query;}
export function mapsForStop(p){
 const search=new URL('https://www.google.com/maps/search/');search.search=new URLSearchParams({api:'1',query:p.location.query,...(p.location.placeId?{query_place_id:p.location.placeId}:{})});
 const walk=new URL('https://www.google.com/maps/dir/');walk.search=new URLSearchParams({api:'1',destination:destination(p),travelmode:'walking',...(p.location.placeId?{destination_place_id:p.location.placeId}:{})});
 return {place:search.href,walk:walk.href};
}
export function mapsForLeg(a,b){
 const u=new URL('https://www.google.com/maps/dir/');u.search=new URLSearchParams({api:'1',origin:destination(a),destination:destination(b),travelmode:'walking',...(a.location.placeId?{origin_place_id:a.location.placeId}:{}),...(b.location.placeId?{destination_place_id:b.location.placeId}:{})});return u.href;
}
export function reconcileLines(old,text,city,newId=()=>crypto.randomUUID()){
 const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(lines.length>49||lines.some(x=>x.length>180))throw Error('Največ 49 ogledov, vsak do 180 znakov.');
 const used=new Set(),assigned=new Map();
 // Match unchanged names first, then positional substitutions (ordinary rename).
 lines.forEach((name,i)=>{const n=old.findIndex((p,j)=>!used.has(j)&&p.name===name);if(n>=0){used.add(n);assigned.set(i,n);}});
 lines.forEach((name,i)=>{if(!assigned.has(i)&&i<old.length&&!used.has(i)){used.add(i);assigned.set(i,i);}});
 return lines.map((name,i)=>{
  const previous=assigned.has(i)?old[assigned.get(i)]:null;
  if(previous){const p=clone(previous);if(p.name!==name){p.name=name;p.location={query:name+', '+cities[city].name+', España',status:'unresolved'};}return p;}
  return {id:'u-'+newId(),city,name,durationMin:45,enabled:true,fixedTime:null,optional:false,location:{query:name+', '+cities[city].name+', España',status:'unresolved'}};
 });
}
export function previewOperations(state,operations,baseRevision){
 if(baseRevision!==state.revision)throw Error('REVISION_CONFLICT');
 if(!Array.isArray(operations)||operations.length<1||operations.length>50)throw Error('INVALID_OPERATIONS');
 const next=clone(state),diff=[];
 for(const op of operations){
  if(!op||!VARIANTS.includes(op.variant)||!Number.isInteger(op.day)||op.day<0||op.day>9||!cities[op.city])throw Error('INVALID_SCOPE');
  const d=ensureDay(next,op.variant,op.day,op.city),before=clone(ensureDay(next,op.variant,op.day,op.city));
  if(op.type==='replaceStops'){if(d.stops.some((p,i)=>p.fixedTime&&(op.stops[i]?.id!==p.id||op.stops[i]?.fixedTime!==p.fixedTime)))throw Error('FIXED_EVENT_MOVED');d.stops=clone(op.stops);d.receipt=null;d.origin='manual';}
  else if(op.type==='patchStop'){
   const p=op.id===d.entry.id?d.entry:d.stops.find(x=>x.id===op.id);if(!p)throw Error('UNKNOWN_POI');
   const allowed=['name','enabled','durationMin','fixedTime','location'];if(Object.keys(op.patch||{}).some(x=>!allowed.includes(x)))throw Error('DISALLOWED_FIELD');
   Object.assign(p,clone(op.patch));d.receipt=null;d.origin='manual';
  }else if(op.type==='reorder'){
   if(!Array.isArray(op.ids)||op.ids.length!==d.stops.length||new Set(op.ids).size!==d.stops.length||op.ids.some(id=>!d.stops.some(p=>p.id===id)))throw Error('INVALID_ORDER');
   // Timed events keep their exact positions. The solver works between them.
   if(d.stops.some((p,i)=>p.fixedTime&&op.ids[i]!==p.id))throw Error('FIXED_EVENT_MOVED');
   d.stops=op.ids.map(id=>d.stops.find(p=>p.id===id));d.origin=op.origin==='deep'?'deep':'manual';d.receipt=op.receipt?clone(op.receipt):null;
  }else if(op.type==='setBreak'){d.breakMin=op.minutes;}
  else throw Error('DISALLOWED_OPERATION');
  const ids=new Set([...before.stops,...d.stops,before.entry,d.entry].map(p=>p.id)),changes=[];
  for(const id of ids){const a=[before.entry,...before.stops].find(p=>p.id===id)||null,b=[d.entry,...d.stops].find(p=>p.id===id)||null;if(JSON.stringify(a)!==JSON.stringify(b))changes.push({id,before:a,after:b});}
  diff.push({type:op.type,variant:op.variant,day:op.day,city:op.city,changes,orderBefore:before.stops.map(p=>p.id),orderAfter:d.stops.map(p=>p.id),breakBefore:before.breakMin,breakAfter:d.breakMin});
 }
 return {status:'preview',diff,state:validateState(next)};
}
export function segments(d){
 const out=[];let ids=[];
 for(const p of d.stops){if(p.enabled&&p.fixedTime){if(ids.length)out.push(ids);ids=[];}else if(p.enabled)ids.push(p.id);}
 if(ids.length)out.push(ids);return out;
}

