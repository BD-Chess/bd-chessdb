const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),{IDBFactory}=require('fake-indexeddb');
const Core=require('../js/8zc-data-core.js');
const deps={Chess:require('../js/chess.min.js').Chess,Study:require('../js/8zc-study-core.js'),StudyStore:require('../js/8zc-study-store.js'),Evidence:require('../js/8zc-evidence.js'),Sim:require('../js/8zc-sim-store.js')};
function locks(){const held=new Map();return {request(name,options,fn){if(typeof options==='function'){fn=options;options={};}const mode=options?.mode||'exclusive';
  if((held.get(name)||0)&&options?.ifAvailable)return Promise.resolve(fn(null));
  held.set(name,(held.get(name)||0)+1);return Promise.resolve().then(()=>fn({name,mode})).finally(()=>held.set(name,held.get(name)-1));}};}
function storage(){const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};}
async function boot(t,{local=storage(),idb=new IDBFactory(),lock=locks()}={}) {
  const dom=new JSDOM('<!doctype html><body/>',{url:'https://fixture.test/chess-lab/',runScripts:'outside-only'}),w=dom.window;
  t.after(()=>{w.dispatchEvent(new w.Event('pagehide'));w.close();});
  Object.defineProperty(w,'localStorage',{value:local});Object.defineProperty(w,'indexedDB',{value:idb});Object.defineProperty(w.navigator,'locks',{value:lock});
  Object.defineProperty(w,'crypto',{value:require('node:crypto').webcrypto});w.TextEncoder=TextEncoder;
  for(const name of ['chess.min.js','8zc-study-core.js','8zc-study-store.js','8zc-evidence.js','8zc-sim-store.js','8zc-data-core.js','8zc-data.js'])w.eval(fs.readFileSync(path.join(__dirname,'../js',name),'utf8'));
  await w.ChessDataGuard.ready;return {w,local,idb,lock,G:w.ChessDataGuard};
}
async function incoming(){const p=Core.empty();p.preferences.language='sl';p.preferences.appWidth='430';return Core.pack(p,{channel:'LAB',release:'synthetic'},deps);}
test('verified recovery precedes all effects; quota during first generation write keeps target and CURRENT',async t=>{
  const x=await boot(t),before=await x.G.capture(false),v=await incoming();x.local.setItem('ChessBest:CURRENT:v2:game','sentinel');
  const set=x.local.setItem;x.local.setItem=(k,v)=>{if(k.includes(':DATA:g-'))throw Object.assign(Error('synthetic quota'),{name:'QuotaExceededError'});set(k,v);};
  await assert.rejects(()=>x.G.restore(v,before.sha256),/quota/);
  assert.equal(x.local.getItem('ChessBest:LAB:v2:DATA-active'),null);assert.equal((await x.G.capture(false)).sha256,before.sha256);
  assert.equal((await x.G.recovery()).sha256,before.sha256);assert.equal(x.local.getItem('ChessBest:CURRENT:v2:game'),'sentinel');
});
test('failure in second IDB store leaves original snapshot; no fallback masks partial archives',async t=>{
  const idb=new IDBFactory(),open=idb.open.bind(idb);idb.open=(name,...args)=>{if(name.includes(':DATA:g-')&&name.endsWith(':sim'))throw Error('synthetic second store denied');return open(name,...args);};
  const x=await boot(t,{idb}),before=await x.G.capture(false);
  await assert.rejects(()=>x.G.restore(awaitedIncoming,before.sha256),/second store denied/);
  assert.equal(x.local.getItem('ChessBest:LAB:v2:DATA-active'),null);assert.equal((await x.G.capture(false)).sha256,before.sha256);
});
let awaitedIncoming;test.before(async()=>{awaitedIncoming=await incoming();});
test('real localStorage backend without IDB restores, hashes durable readback and reopens',async t=>{
  const x=await boot(t,{idb:null}),before=await x.G.capture(false),v=await incoming();await x.G.restore(v,before.sha256);
  x.w.dispatchEvent(new x.w.Event('pagehide'));x.w.close();
  const y=await boot(t,{local:x.local,idb:null,lock:x.lock});assert.equal((await y.G.capture(false)).sha256,v.sha256);
  assert.equal(y.local.getItem(y.G.key('ChessBest:LAB:v2:language')),'sl');assert.equal((await y.G.recovery()).sha256,before.sha256);
});
test('stale writer is bound to its old generation; unknown namespace never gets a write adapter',async t=>{
  const x=await boot(t),before=await x.G.capture(false),v=await incoming();const old=x.G.key('ChessBest:LAB:v2:studies');await x.G.restore(v,before.sha256);
  assert.throws(()=>x.G.assertWritable(),/workspace changed/);assert.equal(x.G.key('ChessBest:CURRENT:v2:game'),'ChessBest:CURRENT:v2:game');
  x.local.setItem(old,'old pending writer');const epoch=JSON.parse(x.local.getItem('ChessBest:LAB:v2:DATA-active')).epoch;
  assert.equal(x.local.getItem('ChessBest:LAB:v2:DATA:'+epoch+':studies'),null);
});
test('denied recovery storage refuses before changing target; future schema has no effect',async t=>{
  const x=await boot(t,{idb:null}),before=await x.G.capture(false),v=await incoming(),set=x.local.setItem;
  x.local.setItem=(k,v)=>{if(k.includes('DATA-journal'))throw Error('synthetic recovery denied');set(k,v);};
  await assert.rejects(()=>x.G.restore(v,before.sha256),/recovery denied/);assert.equal(x.local.getItem('ChessBest:LAB:v2:DATA-active'),null);
  const future=JSON.parse(JSON.stringify(v));future.version=2;await assert.rejects(()=>x.G.restore(future,before.sha256),/version/);
});

test('corrupt committing generation restores verified previous payload before normal writers can boot',async t=>{
  const x=await boot(t),before=await x.G.capture(false),v=await incoming();await x.G.restore(v,before.sha256);
  const active=JSON.parse(x.local.getItem('ChessBest:LAB:v2:DATA-active')).epoch;
  const request=x.idb.open('ChessBest:LAB:v2:DATA-control',1);
  await new Promise((resolve,reject)=>{request.onsuccess=()=>{const db=request.result,tx=db.transaction('records','readwrite'),store=tx.objectStore('records'),r=store.get('journal');r.onsuccess=()=>{const record=r.result,j=JSON.parse(record.value);j.phase='committing';j.hash='0'.repeat(64);record.value=JSON.stringify(j);store.put(record);};tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};request.onerror=()=>reject(request.error);});
  x.w.dispatchEvent(new x.w.Event('pagehide'));x.w.close();await new Promise(setImmediate);
  await assert.rejects(()=>boot(t,{local:x.local,idb:x.idb,lock:x.lock}),/Previous workspace recovered/);
  assert.notEqual(JSON.parse(x.local.getItem('ChessBest:LAB:v2:DATA-active')).epoch,active);
  const y=await boot(t,{local:x.local,idb:x.idb,lock:x.lock});assert.equal((await y.G.capture(false)).sha256,before.sha256);
});

test('pending human review blocks a complete backup until its existing queue is durably settled',async t=>{
  const base=path.resolve(__dirname,'..'),dom=new JSDOM(fs.readFileSync(path.join(base,'index.html'),'utf8'),{url:'https://fixture.test/chess-lab/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;t.after(()=>w.close());
  for(const name of ['chess.min.js','8zc-time-core.js','8zc-workspace.js'])w.eval(fs.readFileSync(path.join(base,'js',name),'utf8'));
  const game=new w.Chess();let finish;
  const workspace=w.ChessWorkspace.create({Chess:w.Chess,game,settings:{showTimers:true,showTimestamps:false},onDisplaySettings(){},analyze:()=>new Promise(resolve=>finish=resolve),onAnnotations(){},getAnalysis:()=>null,isBusy:()=>false,isSimulationRunning:()=>false,stopActivities(){}});
  workspace.start('human',{seconds:0,increment:0});const fen=game.fen();assert(workspace.beforeMove());workspace.recordMove(fen,game.move('e4'));workspace.pause();
  assert.equal(workspace.pendingData(),true);await assert.rejects(()=>workspace.dataReady({timeoutMs:10}),/still pending/);
  finish({allMoves:[],candidates:[],receipt:{status:'partial'}});await workspace.dataReady();assert.equal(workspace.pendingData(),false);
  const saved=JSON.parse(w.localStorage.getItem('ChessBest:LAB:v2:timing'));assert(saved.records[0].review);assert.equal(saved.clock.running,false);
});

test('restored-generation Sim startup respects the active owner lease of its own generation',async t=>{
  const x=await boot(t),before=await x.G.capture(false);await x.G.restore(await incoming(),before.sha256);x.w.dispatchEvent(new x.w.Event('pagehide'));x.w.close();await new Promise(setImmediate);
  const y=await boot(t,{local:x.local,idb:x.idb,lock:x.lock}),lease=y.G.key('ChessBest:LAB:v2:sim-lease');
  y.local.setItem(lease,JSON.stringify({owner:'synthetic-active-tab',expires:Date.now()+30000}));
  const store=y.w.ChessSimStore.create();store.checkpointSync({id:'lease-fixture',state:'paused',pgn:'1. e4 *',trace:[]});await store.ready();
  assert.equal((await store.getRun('lease-fixture'))==null,true);assert.equal((await store.recoverCheckpoint('different-tab')).activeElsewhere,true);
  assert(y.local.getItem(y.G.key('ChessBest:LAB:v2:sim-checkpoint')));await store.close();
});
