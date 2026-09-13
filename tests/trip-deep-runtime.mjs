// Actual worker transport with the production worker, also runnable via node --jitless.
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {readFileSync,writeFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../public/Trip/new/',import.meta.url),read=n=>readFileSync(new URL(n,root),'utf8');
if(!isMainThread) {
  globalThis.self=globalThis;globalThis.crypto??=webcrypto;
  globalThis.postMessage=m=>parentPort.postMessage({...m,runtimeMemory:process.memoryUsage()});
  globalThis.importScripts=(...files)=>files.forEach(f=>vm.runInThisContext(read(f.split('?')[0]),{filename:f}));
  importScripts('air-distance.js','tsp-metric.js','brute-force.js','worker.js');
  parentPort.on('message',m=>self.onmessage({data:m}));
  parentPort.postMessage({type:'ready'});
} else {
  const c=vm.createContext({window:{}});for(const f of ['tsp-catalog.js','tsp-metric.js'])vm.runInContext(read(f),c);
  function dataset(id){const entry=c.window.TRIP_TSP_CATALOG.find(e=>e.id===id),originalText=read(`tsp/${id}.tsp`),reference=JSON.parse(read('tsp-optima.json')).datasets.find(e=>e.id===id);const raw=JSON.parse(read(`tsp/${id}.json`)).points.map(([node,lat,lon])=>({name:`${id} #${node}`,lat,lon}));return{points:c.TripTspMetric.authenticate(raw,c.TripTspMetric.parse(originalText,entry),entry),startIdx:0,roundTrip:true,metric:'tsp-euc2d',tspProof:{entry,reference,originalText}};}
  const results=[];
  for(const [id,delay] of [['wi29',null],['nu3496',0],['nu3496',350],['qa194',350]]) {
    const w=new Worker(new URL(import.meta.url),{workerData:{}}),msg=dataset(id);
    let requested=null,latest=null,initialMemory=null,peakHeap=0,timer;
    const result=await new Promise((resolve,reject)=>{
      timer=setTimeout(()=>reject(Error('Worker runtime timeout')),12000);
      w.on('error',reject);
      w.on('message',m=>{
        peakHeap=Math.max(peakHeap,m.runtimeMemory?.heapUsed||0);
        if(m.type==='ready')w.postMessage({...msg,type:'solve',profile:'deep',jobId:1});
        if(m.type==='progress'){
          initialMemory??=m.runtimeMemory.heapUsed;latest=m;
          if(delay!==null&&requested===null){requested='scheduled';setTimeout(()=>{requested=performance.now();w.postMessage({type:'cancel',jobId:1});},delay);}
        }
        if(m.type==='error')reject(Error(m.error));
        if(m.type==='result')resolve(m);
      });
    });
    clearTimeout(timer);
    const latency=typeof requested==='number'?performance.now()-requested:null;
    const route=result.pointsSorted;assert.equal(new Set(route.map(p=>p.tspNodeId)).size,msg.points.length);assert.equal(route[0].tspNodeId,1);
    const cost=route.reduce((v,p,i)=>v+Math.floor(Math.sqrt((p.x-route[(i+1)%route.length].x)**2+(p.y-route[(i+1)%route.length].y)**2)+.5),0);
    assert.equal(result.totalCost,cost);assert.ok(result.totalCost<=latest.totalCost);
    assert.equal(result.reason,delay===null?'optimum':'cancelled');if(delay===null)assert.equal(cost,27603);
    results.push({dataset:id,cancelDelayMs:delay,cancelResponseMs:latency,cost,reason:result.reason,elapsedMs:result.elapsedMs,budgetMs:result.budgetMs,work:result.work,candidates:result.candidates,peakReportedHeapBytes:peakHeap,reportedHeapGrowthBytes:peakHeap-initialMemory});
    await w.terminate();
  }
  const evidence={runtime:process.version,mode:process.execArgv.includes('--jitless')?'V8 interpreter only (--jitless), software slowdown; not calibrated device emulation':'normal V8',results};
  console.log(JSON.stringify(evidence,null,2));if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(evidence,null,2));
}
