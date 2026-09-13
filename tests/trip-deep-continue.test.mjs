import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const root=new URL('../public/Trip/new/',import.meta.url),read=n=>readFileSync(new URL(n,root),'utf8');
function context(extra={}){
  const c=vm.createContext({window:{},crypto:webcrypto,TextEncoder,performance,...extra});
  for(const f of ['tsp-catalog.js','tsp-metric.js','air-distance.js','deep-search.js'])vm.runInContext(read(f),c);
  return c;
}
function dataset(c,id='qa194'){
  const entry=c.window.TRIP_TSP_CATALOG.find(e=>e.id===id),originalText=read(`tsp/${id}.tsp`);
  const reference=JSON.parse(read('tsp-optima.json')).datasets.find(e=>e.id===id);
  const raw=JSON.parse(read(`tsp/${id}.json`)).points.map(([node,lat,lon])=>({name:`${id} #${node}`,lat,lon}));
  return {points:c.TripTspMetric.authenticate(raw,c.TripTspMetric.parse(originalText,entry),entry),startIdx:0,roundTrip:true,metric:'tsp-euc2d',tspProof:{entry,reference,originalText}};
}
function score(s){const p=s.pointsSorted;assert.equal(new Set(p.map(p=>p.tspNodeId)).size,p.length);assert.equal(p[0].tspNodeId,1);return p.reduce((v,a,i)=>{const b=p[(i+1)%p.length];return v+Math.floor(Math.hypot(a.x-b.x,a.y-b.y)+.5);},0);}
test('repeated continuations retain candidate and RNG: identical to uninterrupted work at each checkpoint',()=>{
  const c=context(),msg=dataset(c);let clock=0;
  const hooks={now:()=>clock,workLimit:25600};const e=c.TripDeepSearch.create(msg,hooks);
  for(let cycle=1;cycle<=4;cycle++){
    hooks.workLimit=cycle*25600;e.step();const s=e.snapshot();
    assert.equal(s.reason,'budget');assert.equal(s.totalCost,score(s));
    const uninterrupted=c.TripDeepSearch.create(msg,{now:()=>0,workLimit:hooks.workLimit});uninterrupted.step();const expected=uninterrupted.snapshot();
    for(const k of ['work','candidates','completed','improvements','totalCost','bestVersion'])assert.equal(s[k],expected[k],`${cycle} ${k}`);
    assert.deepEqual(s.pointsSorted,expected.pointsSorted);
    const elapsed=s.elapsedMs;clock+=3_600_000;
    assert.equal(e.snapshot().elapsedMs,elapsed,'waiting time excluded');
    assert.equal(e.resume(),true);assert.equal(e.snapshot().budgetMs,(cycle+1)*60000);
    assert.equal(e.snapshot().elapsedMs,elapsed);assert.equal(e.resume(),false,'cannot extend while running');
  }
});
test('real deadline extension adds one policy budget, freezes pause and retains a partial 2-opt pass',()=>{
  const c=context(),msg=dataset(c);let clock=0;const e=c.TripDeepSearch.create(msg,{now:()=>clock,workLimit:12800});
  e.step();const old=e.snapshot();assert.equal(e.canResume,true);clock=60000;assert.equal(e.snapshot().elapsedMs,old.elapsedMs);
  assert.equal(e.resume(),true);clock=180000;e.step();const ended=e.snapshot();
  assert.equal(ended.elapsedMs,120000);assert.equal(ended.budgetMs,120000);assert.equal(ended.remainingMs,0);
  clock+=1000000;assert.equal(e.snapshot().elapsedMs,120000);e.resume();assert.equal(e.snapshot().budgetMs,180000);assert.equal(e.snapshot().remainingMs,60000);
});
test('cancelled search can continue, optimum and invalid reference cannot',async()=>{
  const c=context(),msg=dataset(c),hooks={now:()=>0,workLimit:25600};const e=c.TripDeepSearch.create(msg,hooks);
  e.cancel();e.step();const cost=e.snapshot().totalCost;assert.equal(e.resume(),true);e.step();assert.ok(e.snapshot().totalCost<=cost);assert.equal(e.snapshot().totalCost,score(e.snapshot()));
  for(const id of ['wi29','dj38']){
    const m=dataset(c,id),done=c.TripDeepSearch.create(m,{now:()=>0,workLimit:2000000});done.setTarget(await c.TripDeepSearch.verifyTarget(m));done.step();
    assert.equal(done.snapshot().reason,'optimum',id);assert.equal(done.canResume,false);assert.equal(done.resume(),false);assert.equal(done.snapshot().totalCost,score(done.snapshot()));
  }
  const bad=c.TripDeepSearch.create(msg,{now:()=>0});bad.setTarget({...msg.tspProof.reference,optimum:bad.snapshot().totalCost+1});assert.equal(bad.resume(),false);
});
test('worker resumes only its retained job, ignores stale IDs and releases it on a fresh solve',async()=>{
  let clock=0,next=0;const timers=new Map(),messages=[];
  const c=context({performance:{now:()=>{clock+=.1;return clock;}},self:{postMessage:m=>messages.push(m)},setTimeout:f=>{timers.set(++next,f);return next;},clearTimeout:id=>timers.delete(id)});
  c.importScripts=(...files)=>files.forEach(f=>vm.runInContext(read(f.split('?')[0]),c));
  vm.runInContext(read('brute-force.js'),c);vm.runInContext(read('worker.js'),c);
  const send=m=>c.self.onmessage({data:m});const tick=()=>{const [id,fn]=timers.entries().next().value;timers.delete(id);fn();};
  const msg=dataset(c);send({...msg,type:'solve',profile:'deep',jobId:1});
  // Allow SHA-256 verification to settle without replacing the production verifier.
  for(let i=0;i<20&&!timers.size;i++)await new Promise(r=>setTimeout(r,5));
  assert.ok(timers.size);tick();clock=60001;tick();const first=messages.at(-1);
  assert.equal(first.reason,'budget');assert.equal(first.canContinue,true);const frozen=first.elapsedMs;
  clock+=500000;send({type:'continue-deep',previousJobId:0,jobId:2});assert.equal(messages.at(-1),first);
  send({type:'continue-deep',previousJobId:1,jobId:2});let m=messages.at(-1);assert.equal(m.jobId,2);assert.equal(m.budgetMs,120000);assert.ok(Math.abs(m.elapsedMs-frozen)<1);assert.equal(m.work,first.work);
  send({type:'cancel',jobId:1});assert.equal(messages.at(-1),m);tick();send({type:'cancel',jobId:2});m=messages.at(-1);assert.equal(m.reason,'cancelled');assert.equal(m.canContinue,true);assert.ok(m.work>first.work);assert.equal(m.totalCost,score(m));
  send({...msg,type:'solve',profile:'standard',jobId:3});const fast=messages.at(-1);assert.equal(fast.algorithm,'standard');
  send({type:'continue-deep',previousJobId:2,jobId:4});assert.equal(messages.at(-1),fast);
});
