import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {roadGeometry} from '../public/BD/O/izleti/andaluzija-map.mjs';
import {DayOptimizer} from '../public/BD/O/izleti/andaluzija-optimize.mjs';
import {seedDay} from '../public/BD/O/izleti/andaluzija-poi.mjs';

test('maintained TripRoadMatrix reads every directed walking edge and reuses only the same coordinates/mode',async()=>{
 const code=await readFile('public/Trip/new/road-matrix.js','utf8'),ctx=vm.createContext({setTimeout,clearTimeout});vm.runInContext(code,ctx);let calls=0;
 const loadRoutes=async()=>({RouteMatrix:{computeRouteMatrix:async({origins,destinations,travelMode})=>{calls++;assert(['WALKING','DRIVING'].includes(travelMode));return {matrix:{rows:origins.map((_,i)=>({items:destinations.map((_,j)=>({condition:'ROUTE_EXISTS',distanceMeters:i===j?0:100+i*10+j,durationMillis:60000}))}))}};}}});
 const road=new ctx.TripRoadMatrix(),p=[{lat:36,lon:-4,name:'A'},{lat:37,lon:-5,name:'B'}],a=await road.prepare(p,'WALKING',{loadRoutes});assert.notEqual(a.distanceMatrix[0][1],a.distanceMatrix[1][0]);const b=await road.prepare([...p].reverse(),'WALKING',{loadRoutes});assert.equal(calls,1);assert.equal(b.reused,true);assert.equal(a.distanceMatrix[0][1],b.distanceMatrix[1][0]);await road.prepare(p,'DRIVING',{loadRoutes});assert.equal(calls,2);road.clear();await road.prepare(p,'DRIVING',{loadRoutes});assert.equal(calls,3);
});

const points=Array.from({length:30},(_,i)=>({id:String(i),name:'Synthetic '+i,lat:36+i/100,lon:-4}));
test('route geometry requests actual roads, preserves order and splits at 25 intermediates',async()=>{
 const calls=[];const r=await roadGeometry(points,'DRIVING',{load:async()=>({Route:{computeRoutes:async p=>{calls.push(p);return {routes:[{path:[p.origin,p.destination],distanceMeters:123,durationMillis:60000,warnings:['Check access']}]};}}})});
 assert.equal(calls.length,2);assert.equal(calls[0].intermediates.length,25);assert.deepEqual(calls[1].origin,calls[0].destination);assert.equal(calls[0].optimizeWaypointOrder,false);assert.equal(calls[0].routingPreference,'TRAFFIC_UNAWARE');assert.equal(r.meters,246);assert.equal(r.millis,120000);assert.deepEqual(r.warnings,['Check access']);
});
test('failed/missing roads have no direct-line fallback or automatic retries; stale results discarded',async()=>{
 let calls=0;await assert.rejects(roadGeometry(points.slice(0,2),'WALKING',{load:async()=>({Route:{computeRoutes:async()=>{calls++;return {routes:[]};}}})}),/NO_ROUTE/);assert.equal(calls,1);
 await assert.rejects(roadGeometry(points.slice(0,2),'WALKING',{current:()=>false,load:async()=>({})}),/CANCELLED/);
 await assert.rejects(roadGeometry([{lat:null,lon:null},points[0]],'WALKING'),/LOCATION/);
});
test('city optimizer sends directed road matrix to the real worker contract, reuses RAM matrix and clears on lock',async()=>{
 let prepared=0,cleared=0,wire;
 globalThis.TripRoadMatrix=class{clear(){cleared++;}async prepare(ps,mode){prepared++;assert.equal(mode,'WALKING');const D=ps.map((_,i)=>ps.map((_,j)=>i===j?0:100+i*10+j));return {distanceMatrix:D,durationMatrix:D.map(r=>r.map(x=>x*1000))};}};
 globalThis.Worker=class{terminate(){}postMessage(p){wire=p;queueMicrotask(()=>this.onmessage({data:{type:'result',result:{pointsSorted:p.points,totalCost:321}}}));}};
 const opt=new DayOptimizer(),day=seedDay('malaga',0),r=await opt.optimize(day);assert(wire.distanceMatrix);assert.notEqual(wire.distanceMatrix[0][1],wire.distanceMatrix[1][0]);assert.equal(prepared,1);assert.equal(cleared,0);assert.equal(r.mapRoute.mode,'WALKING');assert.equal(r.receipt.source,'Google Maps · Routes WALKING');assert(!JSON.stringify(r.receipt).includes('distanceMatrix'));opt.clear();assert.equal(cleared,1);
 delete globalThis.Worker;delete globalThis.TripRoadMatrix;
});
test('itinerary worker enforces a 5000ms deadline without modifying shared Trip engine defaults',async()=>{
 const engine=await readFile('public/Trip/new/deep-search.js','utf8'),air=await readFile('public/Trip/new/air-distance.js','utf8'),worker=await readFile('public/BD/O/izleti/andaluzija-worker.js','utf8');
 let clock=0;const messages=[],ticks=[],ctx=vm.createContext({performance:{now:()=>clock++},postMessage:x=>messages.push(x),setTimeout:f=>ticks.push(f),clearTimeout:()=>{}});ctx.importScripts=()=>{vm.runInContext(air,ctx);vm.runInContext(engine,ctx);};vm.runInContext(worker,ctx);const ps=points.slice(0,5);ctx.onmessage({data:{type:'start',points:ps,distanceMatrix:ps.map((_,i)=>ps.map((_,j)=>i===j?0:i*10+j+1))}});while(ticks.length&&clock<7000)ticks.shift()();const result=messages.at(-1);assert.equal(result.type,'result');assert.equal(result.result.budgetMs,5000);assert.equal(result.result.reason,'budget');assert.equal(result.result.cancelled,false);assert(result.result.elapsedMs>=4900&&result.result.elapsedMs<5100);assert.equal(ctx.TripDeepSearch.budgetMs(5),10000);
});
