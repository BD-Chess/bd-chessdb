import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const core = readFileSync(new URL('../public/Trip/new/brute-force.js', import.meta.url), 'utf8');
const workerSource = readFileSync(new URL('../public/Trip/new/worker.js', import.meta.url), 'utf8');
const c = vm.createContext({}); vm.runInContext(core,c);
const BF = c.TripBruteForce;
const costs = (n,seed=1) => Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?0:1+(i*37+j*19+seed*13+i*j*seed)%137));
const points = n => Array.from({length:n},(_,i)=>({name:'Stop '+i,lat:46+i/100,lon:14+i/100}));
function score(route,D,closed) {
  let cost=0; for(let i=1;i<route.length;i++) cost+=D[route[i-1]][route[i]];
  return cost+(closed?D[route.at(-1)][route[0]]:0);
}
// Independent recursive oracle; production enumerator is iterative lexicographic.
function oracle(D,start,closed) {
  let best=Infinity,count=0;
  function visit(route,remaining) {
    if (!remaining.length) {best=Math.min(best,score(route,D,closed));count++;return;}
    for(const next of remaining) visit([...route,next],remaining.filter(i=>i!==next));
  }
  visit([start],D.map((_,i)=>i).filter(i=>i!==start));
  return {best,count};
}

test('exact factorial counts at the 14/15 boundary and the 30-stop demonstration',()=>{
  assert.equal(BF.orders(2),1n); assert.equal(BF.orders(6),120n);
  assert.equal(BF.orders(14),6227020800n); assert.equal(BF.orders(15),87178291200n);
  assert.equal(BF.orders(30),8841761993739701954543616000000n);
  assert.equal(BF.orders(1),null);
  assert.equal(BF.duration(0),'0 s');
  assert.equal(BF.duration(0.0006),'0.60 ms');
  assert.equal(BF.duration(0.25),'250.00 ms');
  assert.match(BF.duration(Number(BF.orders(30))/1e6),/2.80 × 10\^17 years/);
  assert.equal(BF.percent(999999,1000000),'99.99%');
  assert.equal(BF.percent(1000000,1000000),'100.00%');
});

test('all orders agree with an independent oracle for asymmetric open and closed trips, every START',()=>{
  for(let n=2;n<=7;n++) for(const closed of [false,true]) for(let start=0;start<n;start++) {
    const D=costs(n,start+3), expected=oracle(D,start,closed), search=BF.create(D,start,closed);
    while(!search.step(37)) {}
    const s=search.snapshot();
    assert.equal(s.checked,expected.count); assert.equal(s.checked,s.total);
    assert.equal(s.bestLength,expected.best); assert.equal(s.route[0],start);
    assert.equal(new Set(s.route).size,n); assert.equal(score(s.route,D,closed),expected.best);
  }
});

test('14-stop search is bounded per step, preserves best, and rejects oversized or invalid matrices',()=>{
  const D=costs(14), search=BF.create(D,5,true);
  assert.equal(search.step(5000),false);
  const first=search.snapshot(); assert.equal(first.checked,5000);assert.equal(first.done,false);
  search.step(5000);const second=search.snapshot();
  assert.equal(second.checked,10000);assert.ok(second.bestLength<=first.bestLength);
  assert.ok(second.bestLength<=second.baseLength);
  assert.throws(()=>BF.create(costs(15),0,true),/2–14/);
  assert.throws(()=>BF.create([[0,1],[2,NaN]],0,true),/complete distance table/);
});

function worker(onMessage) {
  const context=vm.createContext({performance,setTimeout,clearTimeout,postMessage:onMessage,self:{postMessage:onMessage}});
  vm.runInContext(core,context); vm.runInContext(workerSource,context);
  return context.self;
}
test('worker completes all six-city orders and reports table optimum, timing and fixed START',async()=>{
  const D=costs(6), messages=[];
  const result=await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Worker timed out')),2000);
    const w=worker(m=>{messages.push(m);if(m.type==='result'){clearTimeout(timeout);resolve(m);}});
    w.onmessage({data:{type:'solve',profile:'brute',jobId:91,points:points(6),distanceMatrix:D,startIdx:2,roundTrip:true}});
  });
  assert.equal(result.checked,120); assert.equal(result.total,120);assert.equal(result.exact,true);
  assert.equal(result.totalKm,oracle(D,2,true).best/1000); assert.equal(result.metric,'road');
  assert.equal(result.pointsSorted[0].name,'Stop 2');assert.ok(result.elapsedMs>=0);
  assert.equal(messages[0].checked,0);assert.equal(result.jobId,91);
});

test('14-stop Cancel returns the latest best and stops; a subsequent heuristic job succeeds',async()=>{
  const D=costs(14), messages=[];let cancelledAt, w;
  const result=await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Cancel timed out')),2500);
    let requested=false;
    w=worker(m=>{
      messages.push(m);
      if(m.type==='brute-progress'&&m.checked>0&&!requested) {
        requested=true;setTimeout(()=>{cancelledAt=performance.now();w.onmessage({data:{type:'cancel',jobId:92}});},0);
      }
      if(m.type==='result'){clearTimeout(timeout);resolve(m);}
    });
    w.onmessage({data:{type:'solve',profile:'brute',jobId:92,points:points(14),distanceMatrix:D,startIdx:7,roundTrip:false}});
  });
  assert.ok(performance.now()-cancelledAt<500);
  assert.equal(result.cancelled,true);assert.equal(result.exact,false);
  assert.ok(result.checked>0&&result.checked<result.total);
  assert.equal(result.totalKm,score(Array.from(result.pointsSorted,p=>Number(p.name.split(' ')[1])),D,false)/1000);
  const count=messages.length;
  await new Promise(r=>setTimeout(r,40));assert.equal(messages.length,count);
  w.onmessage({data:{type:'solve',profile:'standard',jobId:93,points:points(14),distanceMatrix:D,startIdx:7,roundTrip:false}});
  assert.equal(messages.at(-1).type,'result');assert.equal(messages.at(-1).jobId,93);
  assert.equal(messages.at(-1).exact,false);
});

test('worker rejects 15 stops even if the UI guard is bypassed',()=>{
  const messages=[],w=worker(m=>messages.push(m));
  w.onmessage({data:{type:'solve',profile:'brute',jobId:94,points:points(15),distanceMatrix:costs(15),startIdx:0,roundTrip:true}});
  assert.equal(messages.length,1);assert.equal(messages[0].type,'error');assert.match(messages[0].error,/2–14/);
});
