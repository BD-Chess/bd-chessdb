import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const matrixSource = readFileSync(new URL('../public/Trip/new/road-matrix.js', import.meta.url), 'utf8');
const workerSource = readFileSync(new URL('../public/Trip/new/worker.js', import.meta.url), 'utf8');
function planner() {
  const c = vm.createContext({setTimeout, clearTimeout});
  vm.runInContext(matrixSource, c);
  return new c.TripRoadMatrix();
}
function worker() {
  const messages = [];
  const c = vm.createContext({performance, postMessage:m=>messages.push(m), self:{postMessage:m=>messages.push(m)}});
  vm.runInContext(readFileSync(new URL('../public/Trip/new/brute-force.js', import.meta.url), 'utf8'), c);
  vm.runInContext(workerSource, c);
  return {c,messages};
}
const pts = n => Array.from({length:n},(_,i)=>({name:'Place '+i,lat:46,lon:14+i/100}));
const road = (a,b) => a.lng === b.lng ? 0 : Math.round((a.lng*10+b.lng)*1000);
function provider(onCall = ()=>{}) {
  return async () => ({RouteMatrix:{computeRouteMatrix:async req=>{
    onCall(req);
    return {matrix:{rows:req.origins.map(a=>({items:req.destinations.map(b=>({condition:'ROUTE_EXISTS',distanceMeters:road(a,b),durationMillis:road(a,b)*30}))}))}};
  }}});
}

test('directed matrix is reused and remapped after reordering stops; refresh and mode changes fetch anew', async()=>{
  const p=planner(); let calls=0;
  const loadRoutes=provider(req=>{calls++; assert.deepEqual(Array.from(req.fields),['distanceMeters','durationMillis','condition']);});
  const points=pts(3);
  const first=await p.prepare(points,'DRIVING',{loadRoutes});
  assert.notEqual(first.distanceMatrix[0][1],first.distanceMatrix[1][0]);
  const second=await p.prepare(points.slice().reverse(),'DRIVING',{loadRoutes});
  assert.equal(calls,1); assert.equal(second.reused,true);
  assert.equal(second.distanceMatrix[0][2],first.distanceMatrix[2][0]);
  await p.prepare(points,'DRIVING',{loadRoutes,force:true}); assert.equal(calls,2);
  await p.prepare(points,'WALKING',{loadRoutes}); assert.equal(calls,3);
  await p.prepare(pts(4),'WALKING',{loadRoutes}); assert.equal(calls,4);
});

test('matrix batching maps every origin/destination correctly across block boundaries',async()=>{
  const p=planner(), requests=[];
  const points=pts(27);
  const data=await p.prepare(points,'DRIVING',{loadRoutes:provider(req=>requests.push(req))});
  assert.equal(requests.length,4);
  assert.ok(requests.every(r=>r.origins.length*r.destinations.length<=625));
  for(let i=0;i<27;i++)for(let j=0;j<27;j++)
    assert.equal(data.distanceMatrix[i][j],road({lng:points[i].lon},{lng:points[j].lon}));
});

test('unreachable and missing elements block optimization; partial matrices are never retained',async()=>{
  const p=planner();
  await assert.rejects(p.prepare(pts(3),'DRIVING',{loadRoutes:async()=>({RouteMatrix:{computeRouteMatrix:async()=>({matrix:{rows:[]}})}})}),/Place \d+ → Place \d+/);
  assert.equal(p.active,null);
});

test('a cancelled request cannot commit or return a matrix',async()=>{
  const p=planner(); let current=true;
  await assert.rejects(p.prepare(pts(3),'DRIVING',{current:()=>current,loadRoutes:provider(()=>{current=false;})}),/TRIP_CHANGED/);
  assert.equal(p.active,null);
});

function length(route,D,closed) {
  let s=0;for(let i=1;i<route.length;i++)s+=D[route[i-1]][route[i]];
  return s+(closed?D[route.at(-1)][route[0]]:0);
}
test('directed 2-opt agrees with exhaustive reversal scoring, including the endpoint and return edge',()=>{
  const {c}=worker();
  for(let sample=1;sample<=40;sample++)for(const closed of [false,true]) {
    const n=3+sample%6;
    const D=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?0:1+(i*37+j*19+sample*13+i*j*sample)%89));
    const r=Array.from({length:n},(_,i)=>i);
    let best=length(r,D,closed);
    for(let i=1;i<n-1;i++)for(let k=i+1;k<n;k++) {
      const alt=r.slice(0,i).concat(r.slice(i,k+1).reverse(),r.slice(k+1));
      best=Math.min(best,length(alt,D,closed));
    }
    const actual=c.twoOpt(r.slice(),D,closed,1,100000);
    assert.equal(actual[0],0); assert.equal(length(actual,D,closed),best);
  }
});

test('solver uses the road matrix, preserves START, and cannot worsen the entered road order',()=>{
  const {c}=worker();
  const points=pts(5), D=Array.from({length:5},(_,i)=>Array.from({length:5},(_,j)=>i===j?0:50000));
  const bestOrder=[2,4,0,3,1];
  for(let i=1;i<5;i++)D[bestOrder[i-1]][bestOrder[i]]=1000;
  D[1][2]=2000;
  for(const closed of [false,true]) {
    const result=c.solve(points,2,'deep',closed,D);
    assert.deepEqual(Array.from(result.pointsSorted,p=>p.name),bestOrder.map(i=>points[i].name));
    assert.equal(result.totalKm,closed?6:4);
    assert.equal(result.metric,'road');
    assert.equal(result.baseKm,length([2,0,1,3,4],D,closed)/1000);
    assert.ok(result.totalKm<=result.baseKm);
    assert.notEqual(result.totalKm,result.directKm);
  }
});

test('worker rejects incomplete matrices instead of reverting to aerial costs and echoes job identity',()=>{
  const {c,messages}=worker();
  c.self.onmessage({data:{type:'solve',jobId:71,points:pts(3),startIdx:0,profile:'standard',roundTrip:false,distanceMatrix:[[0,1],[1,0]]}});
  assert.equal(messages.at(-1).type,'error');assert.equal(messages.at(-1).jobId,71);
  assert.match(messages.at(-1).error,/Incomplete road distance matrix/);
});
