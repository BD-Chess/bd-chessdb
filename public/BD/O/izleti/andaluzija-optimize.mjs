import {clone,segments} from './andaluzija-poi.mjs';
let mapsPromise;
export async function loadMapsLibrary(name){
 if(!globalThis.google?.maps?.importLibrary){
  if(!mapsPromise)mapsPromise=(async()=>{
   const r=await fetch('/.netlify/functions/trip-maps-config',{cache:'no-store'}),b=await r.json();if(!r.ok||!b.mapsBrowserKey)throw Error('MAPS_NOT_CONFIGURED');
   await new Promise((resolve,reject)=>{
    const s=document.createElement('script'),callback='AndaluzijaMapsReadyV1';
    const timer=setTimeout(()=>{s.remove();delete globalThis[callback];reject(Error('MAPS_TIMEOUT'));},12000);
    globalThis[callback]=()=>{clearTimeout(timer);delete globalThis[callback];resolve();};
    const u=new URL('https://maps.googleapis.com/maps/api/js');u.search=new URLSearchParams({key:b.mapsBrowserKey,v:'weekly',loading:'async',callback});
    s.src=u.href;s.onerror=()=>{clearTimeout(timer);s.remove();delete globalThis[callback];reject(Error('MAPS_UNAVAILABLE'));};document.head.append(s);
   });
  })().catch(e=>{mapsPromise=null;throw e;});await mapsPromise;
 }
 return globalThis.google.maps.importLibrary(name);
}
export class DayOptimizer{
 constructor(){this.worker=null;this.epoch=0;this.road=new globalThis.TripRoadMatrix();this.resolved=new Map();this.pending=null;}
 cancel(){++this.epoch;this.pending?.(Error('CANCELLED'));}
 clear(){this.cancel();this.road.clear();this.resolved.clear();}
 async geocode(stop){
  const {Geocoder}=await loadMapsLibrary('geocoding');
  const {results}=await new Geocoder().geocode({address:stop.location.query,componentRestrictions:{country:'ES'}});
  return results.slice(0,8).map(r=>({placeId:r.place_id,label:r.formatted_address,lat:r.geometry.location.lat(),lon:r.geometry.location.lng()}));
 }
 acceptLocation(id,result){this.resolved.set(id,{lat:result.lat,lon:result.lon,placeId:result.placeId});}
 async optimize(d,{mode='walking',segment=0,progress=()=>{},baseRevision,generation=0}={}){
  this.cancel();const epoch=this.epoch,current=()=>this.epoch===epoch;
  const parts=segments(d),ids=parts[segment];if(!ids?.length)throw Error('NO_STOPS');
  const group=ids.map(id=>d.stops.find(p=>p.id===id));
  const points=[d.entry,...group].map(p=>{
   const resolved=this.resolved.get(p.id);
   const l=resolved||p.location;if(!Number.isFinite(l.lat)||!Number.isFinite(l.lon))throw Error('Lokacija še ni razrešena: '+p.name);
   return {id:p.id,name:p.name,lat:l.lat,lon:l.lon};
  });
  let matrix=null,durations=null;
  if(mode==='walking'||mode==='driving'){
   if(points.length>21)throw Error('Za en izračun izberita največ 20 ogledov in začetek.');
   progress('Google: pripravljam '+(points.length*points.length)+' cestnih/peš razdalj; nato DeepOpti največ 5 s.');
   const result=await this.road.prepare(points,mode==='walking'?'WALKING':'DRIVING',{loadRoutes:()=>loadMapsLibrary('routes'),progress:()=>progress('Google: pridobivam dejanske '+(mode==='walking'?'peš':'cestne')+' razdalje …'),current});
   matrix=result.distanceMatrix;durations=result.durationMatrix;
  }else if(mode!=='estimate')throw Error('INVALID_MODE');
  if(!current())throw Error('CANCELLED');
  const result=await new Promise((resolve,reject)=>{
   const w=new Worker(new URL('./andaluzija-worker.js',import.meta.url));this.worker=w;
   let settled=false;const done=(err,result)=>{if(settled)return;settled=true;clearTimeout(timer);w.terminate();if(this.worker===w){this.worker=null;this.pending=null;}err?reject(err):resolve(result);};
   this.pending=done;
   const timer=setTimeout(()=>done(Error('WORKER_TIMEOUT')),7500);
   w.onerror=()=>done(Error('WORKER_FAILED'));
   w.onmessage=e=>{if(e.data.type==='progress')progress('DeepOpti: '+Math.min(5,Math.round(e.data.result.elapsedMs/1000))+' / 5 s');else if(e.data.type==='failed')done(Error(e.data.error));else if(e.data.type==='result')done(null,e.data.result);};
   w.postMessage({type:'start',points,distanceMatrix:matrix});
  });
  if(!current()||result.cancelled)throw Error('CANCELLED');
  if(result.error||result.pointsSorted?.[0]?.id!==d.entry.id||new Set(result.pointsSorted.map(p=>p.id)).size!==points.length||result.pointsSorted.length!==points.length)throw Error('INVALID_RESULT');
  const order=result.pointsSorted.slice(1).map(p=>p.id);
  const all=d.stops.map(p=>p.id);let j=0;for(let i=0;i<all.length;i++)if(ids.includes(all[i]))all[i]=order[j++];
  let moveMin=null;
  if(durations){const route=result.pointsSorted.map(p=>points.findIndex(x=>x.id===p.id));let ms=0,known=true;for(let i=0;i<route.length;i++){const v=durations[route[i]][route[(i+1)%route.length]];if(v==null)known=false;else ms+=v;}if(known)moveMin=ms/60000;}
  const visitMin=group.reduce((n,p)=>n+p.durationMin,0);
  const receipt={algorithm:'Classical DeepSearch',source:mode==='estimate'?'great-circle estimate':'Google Maps · Routes '+mode.toUpperCase(),optimizedAt:new Date().toISOString(),startId:d.entry.id,roundTrip:true,segment,exact:false,
   ...(mode==='estimate'?{directMeters:result.totalCost}:{}),fixedTimes:'untouched; arrival feasibility not verified'};
  // Provider matrices and derived Google metrics stay only in this preview.
  return {status:'preview',baseRevision,generation,ids:all,receipt,metrics:{meters:result.totalCost,moveMin,visitMin,breakMin:d.breakMin,kind:mode,unknown:moveMin===null},mapRoute:mode==='estimate'?null:{points:result.pointsSorted,mode:mode.toUpperCase(),roundTrip:true},raw:undefined};
 }
}

