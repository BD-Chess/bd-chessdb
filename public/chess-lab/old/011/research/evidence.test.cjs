const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const E=require('../js/8zc-evidence.js');
const {Chess}=require('../js/chess.min.js');
const fen=new Chess().fen();
function snapshot({score=0,label='test',at='2026-09-13T00:00:00Z'}={}){
  const collector=E.createCollector();
  collector.capture({kind:'score',fen,source:'fixture',request:{action:'queryscore'},response:score});
  return collector.snapshot({allMoves:[{move:'e2e4',score:0}],receipt:{fen,config:{version:'test'}}},{label,createdAt:at});
}
test('canonical evidence SHA-256 matches independent implementation including unicode and full FEN',()=>{
  for(const value of ['', '♟ šah'.repeat(100),{z:0,a:null,fen},Array.from({length:128},(_,i)=>i)]){
    assert.equal(E.digest(value),crypto.createHash('sha256').update(E.canonical(value)).digest('hex'));
  }
  assert.equal(E.digest({b:2,a:1}),E.digest({a:1,b:2}));
  assert.notEqual(E.candidateDigest([{move:'e2e4',score:0}]),E.candidateDigest([{move:'e2e4',score:null}]));
  assert.notEqual(E.cacheIdentity({fen,moves:[{move:'e2e4',score:0}]}),E.cacheIdentity({fen,moves:[{move:'e2e4',score:1}]}));
  assert.notEqual(E.cacheIdentity({fen}),E.cacheIdentity({fen:fen.replace(' 0 1',' 1 1')}));
});
test('export import validates both sealed payload and individual source records',()=>{
  const original=snapshot();assert.deepEqual(E.parse(JSON.stringify(original)),original);
  const broken=structuredClone(original);broken.payload.records[0].response=10;
  assert.throws(()=>E.validate(broken),/integrity/);
  assert.throws(()=>E.seal(broken.payload),/record integrity/);
  assert.throws(()=>E.parse('{"schema":"unknown"}'),/Unsupported/);
  assert.throws(()=>E.canonical({score:NaN}),/non-finite/);
  assert.throws(()=>E.parse('{"__proto__":{"polluted":true}}'));
  assert.equal({}.polluted,undefined);
});
test('frozen replay preserves zero versus null and cannot fall back to network',async()=>{
  const zero=E.replay(snapshot());assert.equal(await zero.getScore(fen),0);assert.equal(zero.stats().complete,true);
  const absent=E.replay(snapshot({score:null}));assert.equal(await absent.getScore(fen),null);assert.equal(absent.stats().hits,1);
  assert.equal(await absent.getPV(fen),null);assert.equal(absent.stats().complete,false);
  assert.deepEqual(absent.stats().misses,[{kind:'pv',fen}]);assert.equal(absent.stats().networkFallback,false);
  const budget=E.replay(snapshot(),{budget:1});await budget.getScore(fen);assert.equal(await budget.getScore(fen),null);assert.equal(budget.stats().denied,1);
});
test('changing repeated source replies replay in recorded order; frozen-last comparisons report conflict',async()=>{
  const collector=E.createCollector();
  collector.capture({kind:'score',fen,response:30,finishedAt:'2026-09-13T00:00:00Z'});
  collector.capture({kind:'score',fen,response:10,finishedAt:'2026-09-13T00:00:01Z'});
  const s=collector.snapshot({receipt:{fen}}),replay=E.replay(s);
  assert.deepEqual([await replay.getScore(fen),await replay.getScore(fen)],[30,10]);
  assert.equal(await replay.getScore(fen),null);assert.equal(replay.stats().complete,false);
  const frozen=E.replay(s,{mode:'frozen-last'});assert.equal(await frozen.getScore(fen),10);
  assert.equal(frozen.stats().complete,false);assert.equal(frozen.stats().conflicts.length,1);
});
test('collector bounds retained replies and does not infer unknown source metadata',()=>{
  const collector=E.createCollector({maxRecords:2});
  for(let i=0;i<3;i++)collector.capture({kind:'score',fen,response:i});
  const s=collector.snapshot({receipt:{fen}});
  assert.equal(s.payload.records.length,2);assert.equal(s.payload.droppedRecords,1);
  assert.equal(s.payload.records[0].startedAt,null);assert.equal(s.payload.records[0].metadata,null);assert.equal(s.payload.records[0].cacheHit,null);
});
test('bounded persistent fallback survives reopening and evicts oldest snapshots',async()=>{
  const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const store=E.createStore({indexedDB:null,localStorage:storage,maxItems:2});
  const a=snapshot({at:'2026-09-11T00:00:00Z'}),b=snapshot({at:'2026-09-12T00:00:00Z'}),c=snapshot({at:'2026-09-13T00:00:00Z'});
  await store.put(a);await store.put(b);assert.equal((await store.put(c)).persistent,true);
  const reopened=E.createStore({indexedDB:null,localStorage:storage});
  assert.equal((await reopened.list()).length,2);assert.equal(await reopened.get(a.id),null);assert.deepEqual(await reopened.get(c.id),c);
  await reopened.remove(c.id);assert.equal(await reopened.get(c.id),null);
});
test('quota failure retains readable memory and never reports persistent storage',async()=>{
  const storage={getItem:()=>null,setItem:()=>{throw new Error('QuotaExceededError');},removeItem(){}};
  const store=E.createStore({indexedDB:null,localStorage:storage}),s=snapshot();
  assert.equal((await store.put(s)).persistent,false);assert.equal((await store.list()).length,1);
  assert.deepEqual(await store.get(s.id),s);assert.deepEqual(store.status().mode,'memory');assert.equal(store.status().persistent,false);
});
