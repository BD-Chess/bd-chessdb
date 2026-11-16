// Recording data only. No search code or credentials.
export const REPLAY_LIMITS=Object.freeze({bytes:8*1024*1024,frames:256,fullCities:20000,points:4096,fileBytes:16*1024*1024});
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const fail=()=>{throw Error('Invalid or oversized recording.');};
export function createRecorder(coordinates,meta={},options={}){
 const n=coordinates.length/2,full=n<=REPLAY_LIMITS.fullCities;
 const limit=Math.min(options.bytes??REPLAY_LIMITS.bytes,REPLAY_LIMITS.bytes);
 const stride=Math.max(1,Math.ceil(n/REPLAY_LIMITS.points));
 const points=full?coordinates.slice():Float64Array.from({length:Math.ceil(n/stride)*2},(_,i)=>coordinates[Math.floor(i/2)*stride*2+i%2]);
 const frameBytes=full?n*4:Math.ceil(n/stride)*16;
 const capacity=Math.min(REPLAY_LIMITS.frames,Math.floor((limit-points.byteLength)/frameBytes)-1);
 if(capacity<2)fail();
 const data={schema:'8ztsp-recording-v1',name:String(meta.name??'Map').slice(0,200),inputSha256:meta.inputSha256??'',cities:n,
  metric:meta.metric==='CEIL_2D'?'CEIL_2D':'EUC_2D',optimum:meta.optimum??null,source:String(meta.source??'').slice(0,1000),
  credit:String(meta.credit??'').slice(0,1000),sampled:!full,clock:options.separate?'arrival':'solver',points,frames:[],duration:0,dropped:0};
 let latest=null,costMs=0,received=0;
 function append(item){
  if(data.frames.length>=capacity){const before=data.frames.length,last=data.frames.at(-1);data.frames=data.frames.filter((_,i)=>i%2===0);if(data.frames.at(-1)!==last)data.frames.push(last);if(data.frames.length>=capacity)data.frames.splice(1,1);data.dropped+=before-data.frames.length;}
  const at=Math.max(data.frames.length?data.frames.at(-1).at+.000001:0,options.separate?item.pageSeconds:item.seconds);
  data.frames.push({at,solverSeconds:item.seconds,source:item.source,length:item.length,route:item.route});
 }
 return {
  data,
  capture(tour,length,seconds,source,pageSeconds){
   if(!tour?.length||tour.length!==n||!finite(seconds)||seconds<0||!finite(length)||length<=0||length>=(latest?.length??Infinity))return;
   const begin=performance.now();received++;
   const route=full?new Uint32Array(tour):Float64Array.from({length:Math.ceil(n/stride)*2},(_,i)=>coordinates[tour[Math.floor(i/2)*stride]*2+i%2]);
   latest={route,length,seconds,source,pageSeconds};
   if(!full&&data.frames.length&&(options.separate?pageSeconds:seconds)-data.frames.at(-1).at<.2){data.dropped++;costMs+=performance.now()-begin;return;}
   append(latest);costMs+=performance.now()-begin;
  },
  finish(seconds=0){const begin=performance.now();if(latest&&data.frames.at(-1)?.length!==latest.length)append(latest);data.duration=Math.max(data.frames.at(-1)?.at??0,seconds);data.dropped=Math.max(0,received-data.frames.length);costMs+=performance.now()-begin;return data;},
  summary(){return {frames:data.frames.length,received,dropped:data.dropped,sampled:data.sampled,bytes:points.byteLength+data.frames.reduce((s,f)=>s+f.route.byteLength,0),limitBytes:limit,captureMs:costMs};}
 };
}
function base64(bytes){
 if(typeof Buffer!=='undefined')return Buffer.from(bytes).toString('base64');
 let text='';for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(text);
}
function encode(array){const bytes=new Uint8Array(array.byteLength),view=new DataView(bytes.buffer),width=array.BYTES_PER_ELEMENT;for(let i=0;i<array.length;i++)width===4?view.setUint32(i*4,array[i],true):view.setFloat64(i*8,array[i],true);return base64(bytes);}
function decode(text,width){
 if(typeof text!=='string'||text.length>REPLAY_LIMITS.fileBytes||text.length%4||/[^A-Za-z0-9+/=]/.test(text)||text.slice(0,-2).includes('=')||!/^(?:[A-Za-z0-9+/]{2}|[A-Za-z0-9+/]=|==)$/.test(text.slice(-2)))fail();
 const bytes=typeof Buffer!=='undefined'?Uint8Array.from(Buffer.from(text,'base64')):Uint8Array.from(atob(text),c=>c.charCodeAt(0));
 if(bytes.length%width)fail();const view=new DataView(bytes.buffer),out=width===4?new Uint32Array(bytes.length/4):new Float64Array(bytes.length/8);
 for(let i=0;i<out.length;i++)out[i]=width===4?view.getUint32(i*4,true):view.getFloat64(i*8,true);return out;
}
export function serializeRecording(data){
 const {points,frames,...meta}=data;
 return JSON.stringify({...meta,encoding:'little-endian/base64',points:encode(points),frames:frames.map(({route,...f})=>({...f,route:encode(route)}))});
}
export function parseRecording(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>REPLAY_LIMITS.fileBytes)fail();
 const raw=JSON.parse(text);if(raw.encoding!=='little-endian/base64'||!Array.isArray(raw.frames)||raw.frames.length>REPLAY_LIMITS.frames)fail();
 // Bound cumulative allocation before decoding any payload.
 if(typeof raw.points!=='string'||raw.frames.some(f=>!f||typeof f.route!=='string')||raw.points.length+raw.frames.reduce((s,f)=>s+f.route.length,0)>Math.ceil(REPLAY_LIMITS.bytes/3)*4+raw.frames.length*4)fail();
 const data={...raw,points:decode(raw.points,8),frames:raw.frames.map(f=>({...f,route:decode(f.route,raw.sampled?8:4)}))};
 validateRecording(data);return data;
}
export function validateRecording(data){
 if(data.schema!=='8ztsp-recording-v1'||typeof data.name!=='string'||data.name.length>200||typeof data.sampled!=='boolean'||!['EUC_2D','CEIL_2D'].includes(data.metric)||!['solver','arrival'].includes(data.clock))fail();
 if(!Number.isInteger(data.cities)||data.cities<3||data.cities>10000000||!finite(data.duration)||data.duration<0||data.duration>86400||!Array.isArray(data.frames)||!data.frames.length||data.frames.length>REPLAY_LIMITS.frames)fail();
 if(!(data.points instanceof Float64Array)||data.points.length%2||data.points.length<6||data.points.length>(data.sampled?REPLAY_LIMITS.points:data.cities)*2||(!data.sampled&&(data.cities>REPLAY_LIMITS.fullCities||data.points.length!==data.cities*2)))fail();
 for(const c of data.points)if(!finite(c)||Math.abs(c)>1e12)fail();
 let bytes=data.points.byteLength,at=-1,length=Infinity;
 for(const f of data.frames){
  if(!finite(f.at)||f.at<=at||f.at>data.duration||!finite(f.solverSeconds)||f.solverSeconds<0||!Number.isInteger(f.source)||f.source<0||!finite(f.length)||f.length<=0||f.length>=length)fail();
  if(data.sampled){if(!(f.route instanceof Float64Array)||f.route.length%2||f.route.length<6||f.route.length>REPLAY_LIMITS.points*2)fail();for(const c of f.route)if(!finite(c)||Math.abs(c)>1e12)fail();}
  else{
   if(!(f.route instanceof Uint32Array)||f.route.length!==data.cities)fail();const seen=new Uint8Array(data.cities);let sum=0;
   for(let i=0;i<f.route.length;i++){const a=f.route[i],b=f.route[(i+1)%f.route.length];if(a>=data.cities||b>=data.cities||seen[a])fail();seen[a]=1;const d=Math.hypot(data.points[a*2]-data.points[b*2],data.points[a*2+1]-data.points[b*2+1]);sum+=data.metric==='CEIL_2D'?Math.ceil(d):Math.floor(d+.5);}
   if(sum!==f.length)fail();
  }
  bytes+=f.route.byteLength;at=f.at;length=f.length;
 }
 if(bytes>REPLAY_LIMITS.bytes)fail();return data;
}
export class ReplayTimeline{
 constructor(data){this.data=data;this.time=data.frames[0].at;this.speed=.2;this.playing=false;}
 get index(){let lo=0,hi=this.data.frames.length;while(lo+1<hi){const mid=(lo+hi)>>1;if(this.data.frames[mid].at<=this.time)lo=mid;else hi=mid;}return lo;}
 seek(time){if(!finite(time))return;this.time=Math.max(this.data.frames[0].at,Math.min(this.data.duration,time));}
 step(delta){const i=Math.max(0,Math.min(this.data.frames.length-1,this.index+delta));this.seek(this.data.frames[i].at);}
 stop(){this.playing=false;this.seek(this.data.frames[0].at);}
 tick(seconds){if(this.playing){this.seek(this.time+seconds*this.speed);if(this.time>=this.data.duration)this.playing=false;}}
}
