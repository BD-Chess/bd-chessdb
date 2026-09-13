import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,writeFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const root=new URL('../public/Trip/new/',import.meta.url),read=n=>readFileSync(new URL(n,root),'utf8');
const c=vm.createContext({window:{},crypto:webcrypto,TextEncoder,performance});
for(const f of ['tsp-catalog.js','tsp-metric.js','air-distance.js','deep-search.js'])vm.runInContext(read(f),c);
const S=c.TripDeepSearch,M=c.TripTspMetric;
function dataset(id='wi29') {
  const entry=c.window.TRIP_TSP_CATALOG.find(e=>e.id===id),originalText=read(`tsp/${id}.tsp`);
  const reference=JSON.parse(read('tsp-optima.json')).datasets.find(e=>e.id===id);
  const raw=JSON.parse(read(`tsp/${id}.json`)).points.map(([node,lat,lon])=>({name:`${id} #${node}`,lat,lon}));
  return {points:M.authenticate(raw,M.parse(originalText,entry),entry),startIdx:0,roundTrip:true,metric:'tsp-euc2d',tspProof:{entry,reference,originalText}};
}
function verify(s,msg) {
  assert.equal(s.pointsSorted.length,msg.points.length);
  assert.equal(new Set(s.pointsSorted.map(p=>p.name)).size,msg.points.length);
  assert.equal(s.pointsSorted[0].name,msg.points[msg.startIdx].name);
  const indices=s.pointsSorted.map(p=>msg.points.findIndex(q=>q.name===p.name));
  const edge=(i,j)=>msg.metric==='tsp-euc2d' ? Math.floor(Math.sqrt((msg.points[i].x-msg.points[j].x)**2+(msg.points[i].y-msg.points[j].y)**2)+.5) : msg.distanceMatrix[i][j];
  let cost=0;for(let i=1;i<indices.length;i++)cost+=edge(indices[i-1],indices[i]);if(msg.roundTrip)cost+=edge(indices.at(-1),indices[0]);
  assert.equal(s.totalCost,cost);assert.ok(s.totalCost<=s.baseCost);return cost;
}
test('reproduce the archived wi29 defect without changing the old solver',()=>{
  const messages=[],w=vm.createContext({performance,self:{postMessage:m=>messages.push(m)}});
  for(const f of ['tsp-metric.js','air-distance.js','brute-force.js','worker.js']) vm.runInContext(readFileSync(new URL('../public/Trip/old/003/'+f,import.meta.url),'utf8'),w);
  const msg=dataset();
  for(const [profile,expected] of [['standard',29794],['deep',28031]]) {
    w.self.onmessage({data:{...msg,type:'solve',profile,jobId:1}});
    assert.equal(verify(messages.at(-1),msg),expected);
  }
});
test('all 29 STARTs reach independently verified 27603 within a deterministic work bound',async()=>{
  const results=[];
  for(let startIdx=0;startIdx<29;startIdx++) {
    const msg={...dataset(),startIdx},engine=S.create(msg,{now:()=>0,workLimit:1000000});
    engine.setTarget(await S.verifyTarget(msg));engine.step();const s=engine.snapshot();
    assert.equal(verify(s,msg),27603,`START ${startIdx+1}`);assert.equal(s.reason,'optimum');assert.equal(s.exact,true);
    assert.ok(s.work<1000000);assert.equal(s.remainingMs,10000);
    results.push({start:startIdx+1,cost:s.totalCost,candidates:s.candidates,work:s.work});
  }
  if(process.env.TRIP_DEEP_EVIDENCE)writeFileSync(process.env.TRIP_DEEP_EVIDENCE,JSON.stringify({mode:'controlled clock, maximum 1,000,000 work units; not cross-device timing',results},null,2));
});
test('reference gate rejects every incompatible problem or altered proof',async()=>{
  for(const change of [m=>m.metric='direct',m=>m.roundTrip=false,m=>m.distanceMatrix=[],m=>m.points.pop(),m=>m.points[0].x++,m=>m.points[0].tspNodeId=2,m=>m.points[0].lat+=.1,m=>m.tspProof.originalText+='\n',m=>m.tspProof.reference.metric='GEO',m=>m.tspProof.reference.status='best-known',m=>m.tspProof.entry.id='other',m=>m.tspProof.reference.count--,m=>m.tspProof.reference.originalSha256='0'.repeat(64)]) {
    const m=structuredClone(dataset());change(m);assert.equal(await S.verifyTarget(m),null);
  }
  const msg=dataset(),e=S.create(msg,{now:()=>0,workLimit:300000});e.step();assert.equal(e.snapshot().reason,'budget');assert.equal(e.snapshot().exact,false);
});
test('a result below a trusted reference is a discrepancy, never an optimum',()=>{
  const msg=dataset(),e=S.create(msg,{now:()=>0});
  e.setTarget({...msg.tspProof.reference,optimum:e.snapshot().totalCost+1});
  const s=e.snapshot();assert.equal(s.reason,'reference-mismatch');assert.equal(s.exact,false);assert.match(s.error,/below/);
});
test('one policy covers every budget boundary; preparation consumes the same deadline',()=>{
  for(const[n,ms]of[[2,10000],[50,10000],[51,30000],[100,30000],[101,60000],[500,60000],[501,180000],[1000,180000],[1001,300000]])assert.equal(S.budgetMs(n),ms);
  const msg=dataset();let clock=9999;const e=S.create(msg,{now:()=>clock,started:0});clock=10000;e.step();
  const s=e.snapshot();assert.equal(s.reason,'budget');assert.equal(s.candidates,0);assert.equal(s.elapsedMs,10000);verify(s,msg);
});
test('cancel before preparation and during 2-opt both retain a verified best route',()=>{
  for(const steps of [0,50]) {
    const msg=dataset('qa194');let clock=0;const e=S.create(msg,{now:()=>clock++/1000});
    for(let i=0;i<steps;i++)e.step(.02);
    const before=e.snapshot();e.cancel();assert.equal(e.step(),true);const after=e.snapshot();
    assert.equal(after.reason,'cancelled');assert.equal(after.totalCost,before.totalCost);verify(after,msg);
  }
});
test('directed 2-opt supports open/closed paths and all STARTs; continues after local optimum',()=>{
  const points=Array.from({length:6},(_,i)=>({name:String(i),lat:40+i,lon:10+i}));
  const D=points.map((_,i)=>points.map((_,j)=>i===j?0:1+((i*17+j*31+i*j*7)%41)));
  function perm(a){if(!a.length)return [[]];return a.flatMap((x,i)=>perm(a.filter((_,j)=>j!==i)).map(p=>[x,...p]));}
  for(const roundTrip of [false,true])for(let startIdx=0;startIdx<6;startIdx++) {
    const msg={points,distanceMatrix:D,startIdx,roundTrip};
    const oracle=Math.min(...perm(points.map((_,i)=>i).filter(i=>i!==startIdx)).map(p=>{const r=[startIdx,...p];let v=0;for(let i=1;i<6;i++)v+=D[r[i-1]][r[i]];return v+(roundTrip?D[r[5]][r[0]]:0);}));
    const e=S.create(msg,{now:()=>0,workLimit:50000});e.step();const s=e.snapshot();
    assert.equal(verify(s,msg),oracle);assert.equal(s.reason,'budget');assert.ok(s.completed>128);
  }
});
test('no former 2000-start cap, and no quadratic metric allocation for large TSP',()=>{
  const small={points:[{name:'a',lat:0,lon:0},{name:'b',lat:1,lon:1}],roundTrip:true,startIdx:0};
  const e=S.create(small,{now:()=>0,workLimit:20000});e.step();assert.ok(e.snapshot().completed>2000);
  const original=M.matrix,air=c.TripAirDistance.matrix;
  M.matrix=()=>{throw Error('Unexpected quadratic matrix');};c.TripAirDistance.matrix=M.matrix;
  try {const msg=dataset('nu3496'),large=S.create(msg,{now:()=>0,workLimit:200000});large.step();verify(large.snapshot(),msg);}
  finally{M.matrix=original;c.TripAirDistance.matrix=air;}
});
test('Fast routes and costs are identical to archive 003 for every metric and trip type; BF core is byte-identical',()=>{
  function fast(folder,msg){const messages=[],w=vm.createContext({performance,self:{postMessage:m=>messages.push(m)}});for(const f of ['tsp-metric.js','air-distance.js','brute-force.js','worker.js'])vm.runInContext(readFileSync(new URL(`../public/Trip/${folder}${f}`,import.meta.url),'utf8'),w);w.self.onmessage({data:{...msg,type:'solve',profile:'standard',jobId:1}});const s=messages.at(-1);return JSON.parse(JSON.stringify({points:s.pointsSorted,cost:s.totalCost,km:s.totalKm,base:s.baseCost,baseKm:s.baseKm,metric:s.metric}));}
  const d=dataset(),points=d.points.slice(0,8);
  const road=points.map((_,i)=>points.map((_,j)=>i===j?0:1+(i*31+j*19)%43));
  for(const roundTrip of [false,true])for(const startIdx of [0,4,7])for(const msg of [{points,metric:'direct'},{points,distanceMatrix:road},{points,metric:'tsp-euc2d'}])assert.deepEqual(fast('new/',{...msg,roundTrip,startIdx}),fast('old/003/',{...msg,roundTrip,startIdx}));
  assert.equal(read('brute-force.js'),readFileSync(new URL('../public/Trip/old/003/brute-force.js',import.meta.url),'utf8'));
});
