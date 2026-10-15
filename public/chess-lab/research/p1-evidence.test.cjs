const {test}=require('node:test');
const assert=require('node:assert/strict');
const {IDBFactory}=require('fake-indexeddb');
const E=require('../js/8zc-evidence.js');
const {Chess}=require('../js/chess.min.js');
const fen=new Chess().fen(), key='ChessBest:LAB:v2:evidence-fallback';
function snapshot(label){const c=E.createCollector();c.capture({kind:'score',fen,source:label,response:0});return c.snapshot({receipt:{fen}},{label,createdAt:'2026-10-15T10:00:00Z'});}
function fallback(){const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};}
function locks(){let tail=Promise.resolve();return {request(_name,_options,fn){const result=tail.then(fn);tail=result.catch(()=>{});return result;}};}
for(const backend of ['fallback','indexedDB']){
  function env(){return {indexedDB:backend==='indexedDB'?new IDBFactory():null,localStorage:fallback(),locks:locks()};}
  test(`P1 ${backend}: distinct simultaneous saves survive third-instance reopen with sealed hashes`,async()=>{
    const options=env(),a=snapshot('A'),b=snapshot('B');
    const outcomes=await Promise.all([E.createStore(options).put(a),E.createStore(options).put(b)]);
    assert(outcomes.every(x=>x.persistent));
    const reopened=E.createStore(options);
    assert.deepEqual(await reopened.get(a.id),a);assert.deepEqual(await reopened.get(b.id),b);
    assert.equal((await reopened.list()).length,2);
  });
  test(`P1 ${backend}: remove(A) interleaved with put(B) retains B; same-id writes are idempotent`,async()=>{
    const options=env(),a=snapshot('A'),b=snapshot('B');await E.createStore(options).put(a);
    await Promise.all([E.createStore(options).remove(a.id),E.createStore(options).put(b)]);
    const reopened=E.createStore(options);assert.equal(await reopened.get(a.id),null);assert.deepEqual(await reopened.get(b.id),b);
    await Promise.all([E.createStore(options).put(b),E.createStore(options).put(structuredClone(b))]);
    assert.equal((await E.createStore(options).list()).length,1);
  });
  test(`P1 ${backend}: concurrent retention is bounded and isolated from CURRENT`,async()=>{
    const options={...env(),maxItems:2},other='ChessBest:evidence-fallback';options.localStorage.setItem(other,'untouched');
    await Promise.all(['A','B','C'].map(label=>E.createStore(options).put(snapshot(label))));
    assert.equal((await E.createStore(options).list()).length,2);assert.equal(options.localStorage.getItem(other),'untouched');
  });
}
test('P1 fallback without Web Locks preserves durable records and reports memory-only writes',async()=>{
  const storage=fallback(),a=snapshot('A'),b=snapshot('B');storage.setItem(key,E.canonical([a]));
  const store=E.createStore({indexedDB:null,localStorage:storage,locks:null});
  assert.equal((await store.put(b)).persistent,false);assert.deepEqual(await store.get(a.id),a);assert.deepEqual(await store.get(b.id),b);
  assert.equal(JSON.parse(storage.getItem(key)).length,1);assert.equal(await E.createStore({indexedDB:null,localStorage:storage}).get(b.id),null);
});
test('P1 aborted IDB transaction preserves durable state and exposes unsaved memory honestly',async()=>{
  const idb=new IDBFactory(),a=snapshot('A'),b=snapshot('B');await E.createStore({indexedDB:idb}).put(a);
  const req=idb.open('ChessBest:LAB:v2:evidence',1);const database=await new Promise((r,j)=>{req.onsuccess=()=>r(req.result);req.onerror=()=>j(req.error);});
  const original=database.transaction.bind(database);let abort=true;
  database.transaction=(...args)=>{const tx=original(...args);if(abort&&args[1]==='readwrite')queueMicrotask(()=>tx.abort());return tx;};
  const provider={open(){const request={};queueMicrotask(()=>{request.result=database;request.onsuccess();});return request;}};
  const store=E.createStore({indexedDB:provider,localStorage:null});assert.equal((await store.put(b)).persistent,false);
  assert.deepEqual(await store.get(b.id),b);assert.deepEqual(await E.createStore({indexedDB:idb}).get(a.id),a);
  assert.equal(await E.createStore({indexedDB:idb}).get(b.id),null);abort=false;
  assert.equal((await store.put(b)).persistent,true);assert.deepEqual(await E.createStore({indexedDB:idb}).get(b.id),b);database.close();
});
