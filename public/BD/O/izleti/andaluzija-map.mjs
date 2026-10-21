// Google geometry and RAM-only working cache. Never substitute straight lines.
import {loadMapsLibrary} from './andaluzija-optimize.mjs';

export async function roadGeometry(points,mode,{current=()=>true,load=()=>loadMapsLibrary('routes')}={}){
 if(!['WALKING','DRIVING'].includes(mode)||points.length<2||points.length>52)throw Error('INVALID_ROUTE');
 if(points.some(p=>!Number.isFinite(p.lat)||!Number.isFinite(p.lon)))throw Error('LOCATION_REQUIRED');
 const {Route}=await load();if(!current())throw Error('CANCELLED');
 if(!Route?.computeRoutes)throw Error('ROUTES_UNAVAILABLE');
 const paths=[],warnings=[];let meters=0,millis=0,durationKnown=true;
 // At most 25 intermediates per request, no retries or provider fallback.
 for(let i=0;i<points.length-1;i+=26){
  if(!current())throw Error('CANCELLED');
  const part=points.slice(i,i+27),location=p=>({lat:p.lat,lng:p.lon});let timer;
  const {routes}=await Promise.race([Route.computeRoutes({origin:location(part[0]),destination:location(part.at(-1)),intermediates:part.slice(1,-1).map(p=>({location:location(p)})),travelMode:mode,optimizeWaypointOrder:false,...(mode==='DRIVING'?{routingPreference:'TRAFFIC_UNAWARE'}:{}),fields:['path','distanceMeters','durationMillis','warnings']}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('ROUTE_TIMEOUT')),20000);})]).finally(()=>clearTimeout(timer));
  if(!current())throw Error('CANCELLED');
  const r=routes?.[0];if(!r?.path?.length||!Number.isFinite(r.distanceMeters))throw Error('NO_ROUTE');
  paths.push(r.path);meters+=r.distanceMeters;
  if(Number.isFinite(r.durationMillis))millis+=r.durationMillis;else durationKnown=false;
  warnings.push(...(r.warnings||[]));
 }
 return {paths,meters,millis:durationKnown?millis:null,warnings:[...new Set(warnings)]};
}

export class GoogleTripMap{
 constructor({host,status,onPlace=()=>{}}){this.host=host;this.status=status;this.onPlace=onPlace;this.map=null;this.lines=[];this.markers=[];this.cache=new Map();this.epoch=0;this.loading=null;}
 async init(type='hybrid'){
  if(!this.map){
   if(!this.loading)this.loading=(async()=>{
    const {Map}=await loadMapsLibrary('maps');
    this.map=new Map(this.host,{center:{lat:37.1,lng:-4.8},zoom:7,mapTypeId:type,fullscreenControl:false,mapTypeControl:false,streetViewControl:false,zoomControl:false,gestureHandling:'cooperative',clickableIcons:false});
   })().finally(()=>{this.loading=null;});
   await this.loading;
  }
  this.map.setMapTypeId(type);return this;
 }
 clear(){++this.epoch;this.lines.forEach(x=>x.setMap(null));this.markers.forEach(x=>x.setMap(null));this.lines=[];this.markers=[];}
 clearPrivate(){this.clear();this.cache.clear();this.bounds=null;this.map?.panTo({lat:37.1,lng:-4.8});this.map?.setZoom(7);}
 async show(routes){
  this.clear();const epoch=this.epoch,current=()=>epoch===this.epoch;
  await this.init(this.map?.getMapTypeId()||'hybrid');if(!current())return;
  const staged=[];this.status.textContent='Google: pridobivam traso po '+(routes[0]?.mode==='WALKING'?'peš poteh':'cestah')+' …';
  try{
   for(const route of routes){
    const points=route.roundTrip?[...route.points,route.points[0]]:route.points;
    if(points.length<2)continue;
    const key=JSON.stringify([route.mode,points.map(p=>[p.lat,p.lon])]);
    let geometry=this.cache.get(key);
    if(!geometry){geometry=await roadGeometry(points,route.mode,{current});if(!current())return;this.cache.set(key,geometry);while(this.cache.size>8)this.cache.delete(this.cache.keys().next().value);}
    if(!current())return;staged.push({...route,geometry});
   }
   if(!current())return;
   const g=globalThis.google.maps,bounds=new g.LatLngBounds();
   for(const r of staged){
    for(const path of r.geometry.paths){const line=new g.Polyline({map:this.map,path,strokeColor:r.color||'#67e2c1',strokeWeight:5,strokeOpacity:.92});this.lines.push(line);path.forEach(p=>bounds.extend(p));}
    r.points.forEach((p,i)=>{
     const marker=new g.Marker({map:this.map,position:{lat:p.lat,lng:p.lon},label:{text:String(i+1),color:'#07191a',fontWeight:'800'},title:(r.label?r.label+' · ':'')+(i+1)+'. '+p.name,icon:{path:g.SymbolPath.CIRCLE,scale:13,fillColor:r.color||'#67e2c1',fillOpacity:1,strokeColor:'#fff',strokeWeight:2}});
     marker.addListener('click',()=>{if(p.place)this.onPlace(p.place);else this.status.textContent=(i+1)+'. '+p.name;});this.markers.push(marker);
    });
   }
   this.bounds=bounds;if(!bounds.isEmpty())this.fit();
   this.status.textContent=staged.length?staged.map(r=>(r.label||'Mestni krog')+': '+(r.geometry.meters/1000).toLocaleString('sl-SI',{maximumFractionDigits:1})+' km'+(r.geometry.millis===null?'':' · ~'+Math.ceil(r.geometry.millis/60000)+' min')).join(' | ')+'. '+[...new Set(staged.flatMap(r=>r.geometry.warnings))].join(' '):'Ni izbrane trase.';
  }catch(e){if(!current())return;this.clear();this.status.textContent='Google trase ni bilo mogoče pridobiti. Poti ne nadomeščam z ravno črto. Preverita povezavo, točke in dovoljenja Maps; nato poskusita znova.';throw e;}
 }
 fit(){if(this.bounds&&!this.bounds.isEmpty())this.map?.fitBounds(this.bounds,{top:45,right:45,bottom:55,left:45});}
 zoomBy(delta){if(this.map)this.map.setZoom(Math.min(20,Math.max(5,this.map.getZoom()+delta)));}
 focus(p){this.map?.panTo({lat:p.lat,lng:p.lon});}
 resize(){if(this.map)globalThis.google.maps.event.trigger(this.map,'resize');}
}
