'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {IDBFactory}=require('fake-indexeddb'),E=require('../js/8zc-evidence.js'),C=require('../js/8zc-data-core.js');
const deps={Chess:require('../js/chess.min.js').Chess,Study:require('../js/8zc-study-core.js'),StudyStore:require('../js/8zc-study-store.js'),Evidence:E,Sim:require('../js/8zc-sim-store.js')};
const fen=new deps.Chess().fen(),key='ChessBest:LAB:v2:evidence-fallback';
const snapshot=(i,pad=0)=>E.createCollector().snapshot({receipt:{fen},pad:'x'.repeat(pad)},{label:String(i),createdAt:new Date(Date.UTC(2026,9,1,0,0,i)).toISOString()});
function env(backend){const data=new Map();let tail=Promise.resolve();return {indexedDB:backend==='IDB'?new IDBFactory():null,localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)},locks:{request(_n,_o,fn){const r=tail.then(fn);tail=r.catch(()=>{});return r;}}};}
for(const backend of ['IDB','fallback']) {
  test('BC-01/02 '+backend+': pins survive reopen without changing sealed bytes; deterministic retention protects oldest pins',async()=>{
    const options=env(backend),a=E.createStore(options),s=snapshot(0),sealed=E.canonical(s);
    await a.put(s);assert.equal((await a.setPinned(s.id,true)).persistent,true);
    for(let i=1;i<=31;i++)assert.equal((await a.put(snapshot(i))).persistent,true);
    const b=E.createStore(options),list=await b.list();assert.equal(list.length,30);assert.equal(list.filter(x=>x.pinned).length,1);
    assert.equal(E.canonical(await b.get(s.id)),sealed);assert.equal(await b.get(snapshot(1).id),null);assert.equal(await b.get(snapshot(2).id),null);
    await b.setPinned(s.id,false);assert.equal((await E.createStore(options).list()).find(x=>x.id===s.id).pinned,false);
  });
  test('BC-02 '+backend+': all-pinned refusal preserves every durable byte and offers bounded unsaved evidence',async()=>{
    const options=env(backend),a=E.createStore(options);
    for(let i=0;i<30;i++){const s=snapshot(i);await a.put(s);await a.setPinned(s.id,true);}
    const before=await a.dataSnapshot(),incoming=snapshot(31),result=await a.put(incoming);
    assert.equal(result.persistent,false);assert.equal(result.removed,0);assert.match(result.reason,/full/);
    assert.deepEqual((await E.createStore(options).dataSnapshot()).durable,before.durable);
    assert.equal(E.canonical(await a.get(incoming.id)),E.canonical(incoming));assert.equal(a.status().pendingCount,1);
    await assert.rejects(()=>a.put(snapshot(32)),/previous unsaved/);assert.equal(a.status().pendingCount,1);
  });
  test('BC-02 '+backend+': exact byte pressure counts metadata and never evicts pins',async()=>{
    const options=env(backend),s=snapshot(0,1000),next=snapshot(1,1000);
    options.maxBytes=E.canonical({snapshots:[s],metadata:{version:1,pins:[s.id]}}).length+10;
    const a=E.createStore(options);await a.put(s);await a.setPinned(s.id,true);
    const before=await a.dataSnapshot();assert.equal((await a.put(next)).persistent,false);
    assert.equal(a.status().metadataBytes,new TextEncoder().encode(E.canonical(before.metadata)).length);
    assert.deepEqual((await E.createStore(options).dataSnapshot()).durable,[s]);
  });
  test('BC-03 '+backend+': put/pin/retention/delete share one cross-instance serialization boundary',async()=>{
    const options={...env(backend),maxItems:2},s=snapshot(0),b=snapshot(1),c=snapshot(2),a=E.createStore(options);
    await a.put(s);await a.put(b);
    await Promise.all([E.createStore(options).setPinned(s.id,true),E.createStore(options).put(c)]);
    const list=await E.createStore(options).list();assert(list.find(x=>x.id===s.id)?.pinned);assert(list.find(x=>x.id===c.id));assert.equal(list.length,2);
    await Promise.all([E.createStore(options).remove(c.id),E.createStore(options).put(snapshot(3))]);
    assert((await E.createStore(options).list()).find(x=>x.id===s.id)?.pinned);
  });
}
test('BC-03 fallback: old array is upgraded in place; old code rejects new shape and a denied lock cannot erase it',async()=>{
  const options=env('fallback'),s=snapshot(0);options.localStorage.setItem(key,E.canonical([s]));
  const store=E.createStore(options);await store.setPinned(s.id,true);const raw=options.localStorage.getItem(key),value=JSON.parse(raw);
  assert.equal(value.version,2);assert.deepEqual(value.metadata.pins,[s.id]);assert(!Array.isArray(value));
  const noLock=E.createStore({...options,locks:null});assert.equal((await noLock.remove(s.id)).persistent,false);assert.equal(options.localStorage.getItem(key),raw);
});
test('BC-02 unreadable raw IDB records are preserved, reported and prevent destructive retention',async()=>{
  const options=env('IDB'),s=snapshot(0);await E.createStore(options).put(s);
  const db=await new Promise((r,j)=>{const q=options.indexedDB.open('ChessBest:LAB:v2:evidence',2);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});
  await new Promise(r=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put({id:'corrupt',raw:'retain exactly'});tx.oncomplete=r;});
  const store=E.createStore(options);await assert.rejects(()=>store.list(),/Unsupported/);assert.equal((await store.put(snapshot(1))).persistent,false);
  const rows=await new Promise(r=>{const q=db.transaction('snapshots').objectStore('snapshots').getAll();q.onsuccess=()=>r(q.result);});assert.equal(rows.length,2);assert.deepEqual(rows.find(x=>x.id==='corrupt'),{id:'corrupt',raw:'retain exactly'});db.close();
});
test('BC-04 authentic DATA v1 validates unchanged before separate v2 migration; target pin removal is previewed',async()=>{
  const p=C.empty(),s=snapshot(0);p.evidence={snapshots:[s]};const old=await C.pack(p,{channel:'LAB',release:'v1-fixture'},deps,1),text=C.canonical(old);
  const parsed=await C.parse(text,deps),migrated=await C.migrate(parsed,deps);
  assert.equal(C.canonical(old),text);assert.equal(C.canonical(parsed),text);assert.equal(migrated.version,2);assert.equal(migrated.sections.evidence,2);assert.deepEqual(migrated.payload.evidence.metadata,{version:1,pins:[]});
  assert.equal(E.canonical(migrated.payload.evidence.snapshots[0]),E.canonical(s));
  const target=C.empty();target.evidence={snapshots:[s],metadata:{version:1,pins:[s.id]}};
  assert.equal(C.diff(target,old.payload).find(r=>r.section==='Evidence pins').removed,1);
  const broken=JSON.parse(text);broken.payload.evidence.snapshots[0].payload.label='tampered';await assert.rejects(()=>C.migrate(broken,deps),/integrity/);
});
for(const [name,pins] of [['wrong type','yes'],['wrong ID',[4]],['duplicate',null],['dangling',['f'.repeat(64)]],['too many',Array(31).fill('f'.repeat(64))]]) {
  test('BC-05 correct-hash '+name+' metadata refuses before any storage adapter',async()=>{
    const p=C.empty(),s=snapshot(0);p.evidence.snapshots=[s];const value=await C.pack(p,{channel:'LAB',release:'fixture'},deps);
    value.payload.evidence.metadata.pins=pins===null?[s.id,s.id]:pins;value.sha256=await C.digest(value.payload);value.manifest=C.manifest(value.payload);
    await assert.rejects(()=>C.parse(C.canonical(value),deps),/pin|metadata/i);
  });
}
