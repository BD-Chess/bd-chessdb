import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const root=new URL('../public/Trip/new/',import.meta.url),read=n=>readFileSync(new URL(n,root),'utf8');
const c=vm.createContext({window:{},crypto:webcrypto,TextDecoder,performance});
for(const f of ['tsp-catalog.js','tsp-metric.js'])vm.runInContext(read(f),c);
const M=c.TripTspMetric,catalog=c.window.TRIP_TSP_CATALOG,refs=JSON.parse(read('tsp-optima.json'));
function dataset(id) {
  const entry=catalog.find(e=>e.id===id), original=M.parse(read(`tsp/${id}.tsp`),entry);
  const pts=JSON.parse(read(`tsp/${id}.json`)).points.map(([node,lat,lon])=>({name:`${id} #${node}`,lat,lon}));
  return {entry, original, pts, points:M.authenticate(pts,original,entry),reference:refs.datasets.find(r=>r.id===id)};
}
test('all nine references bind a proven score to the exact original bytes, metric and node count',async()=>{
  assert.equal(refs.datasets.length,9);
  for(const e of catalog) {
    const d=dataset(e.id), ref=d.reference;
    const bytes=readFileSync(new URL(`tsp/${e.id}.tsp`,root));
    const hash=Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');
    assert.equal(ref.originalSha256,hash);assert.equal(ref.count,d.points.length);assert.equal(ref.metric,'EUC_2D');assert.equal(ref.status,'proven');
    for(let i=1;i<d.points.length;i++) {
      const a=d.original[i-1],b=d.original[i];
      assert.equal(M.edge(a,b),Math.floor(Math.sqrt((a.x-b.x)**2+(a.y-b.y)**2)+.5));
    }
  }
});
test('EUC_2D rounds individual edges before summing, preserves duplicate nodes and never uses GPS',()=>{
  const p=[{x:0,y:0,lat:80,lon:0},{x:.4,y:0,lat:-80,lon:0},{x:.8,y:0,lat:0,lon:0}];
  assert.equal(M.length(p,false),0);assert.equal(M.length(p,true),1);
  assert.equal(M.edge({x:0,y:0},{x:.5,y:0}),1);
  const d=dataset('lu980');assert.equal(d.points.length,980);assert.equal(M.edge(d.points[0],d.points[1]),0);assert.notEqual(d.points[0].tspNodeId,d.points[1].tspNodeId);
});
test('authentication rejects edited names, IDs, coordinates, NaN and duplicate IDs; reordering and START are safe',()=>{
  const d=dataset('wi29');
  for(const mutate of [p=>p[0].name='Unknown #1',p=>p[0].lat+=.001,p=>p[0].lon=NaN,p=>p[0]={...p[1]}]) {
    const p=structuredClone(d.pts);mutate(p);assert.throws(()=>M.authenticate(p,d.original,d.entry),/changed/);
  }
  assert.equal(M.authenticate(d.pts.toReversed(),d.original,d.entry)[0].tspNodeId,29);
  assert.equal(M.authenticate(d.pts.slice(0,4),d.original,d.entry).length,4);
});
test('proof label requires a valid complete original cycle and exactly recomputed cost',()=>{
  const d=dataset('wi29'), cost=M.length(d.points,true);
  const ref={...d.reference,optimum:cost}; // controlled reference for this proof-gate test; not a published optimum
  assert.equal(M.assess(d.points,d.points,ref,true,cost).reached,true);
  for(const [tour,input,r,closed,value] of [
    [d.points,d.points,ref,false,cost], [d.points.slice(1),d.points,ref,true,cost],
    [[d.points[1],...d.points.slice(1)],d.points,ref,true,cost],
    [d.points,d.points,{...ref,metric:'great-circle'},true,cost],
    [d.points,d.points,ref,true,cost-1],
    [d.points.map((p,i)=>i? p : {...p,x:p.x+1}),d.points,ref,true,cost]
  ]) assert.equal(M.assess(tour,input,r,closed,value),null);
  const gap=M.assess(d.points,d.points,d.reference,true,cost);assert.ok(gap.gap>0);
});
test('downloaded original bytes must pass SHA-256 before coordinates or reference are accepted',async()=>{
  const ctx=vm.createContext({window:{},crypto:webcrypto,TextDecoder,fetch:async url=>({ok:true,arrayBuffer:async()=>new TextEncoder().encode('corrupted').buffer,json:async()=>refs})});
  for(const f of ['tsp-catalog.js','tsp-metric.js','tsp-library.js'])vm.runInContext(read(f),ctx);
  await assert.rejects(ctx.window.TripTspLibrary.original('wi29'),/checksum/);
});
