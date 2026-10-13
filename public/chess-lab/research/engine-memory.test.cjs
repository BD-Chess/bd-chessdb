'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Memory=require('../js/8zc-engine-memory.js');
const Cards=require('../js/8zc-engine-cards.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const modes=['sf-lite','sf-full','berserk','reckless','lc0'];
function fixture(options={}){
  const engines=[];
  const pool=Memory.create({modes,...options,createEngine:mode=>{
    const engine={mode,prepared:0,destroyed:0,searches:[],prepare:async function(){this.prepared++;},
      analyze:async function(args){this.searches.push(args.fen);return {fen:args.fen,lines:[{pv:['e2e4']}],engineAssetStorage:{assetSource:'verified-local'}};},
      stop(){this.stopped=true;},destroy(){this.destroyed++;}};
    engines.push(engine);options.decorate?.(engine);return engine;
  }});
  return {pool,engines};
}
test('default retains one real prepared adapter across positions and consumers without re-preparing',async()=>{
  const {pool,engines}=fixture();const card=pool.handle('berserk');
  const a=await card.analyze({fen:'position-a'});card.destroy();
  const deep=pool.handle('berserk');const b=await deep.analyze({fen:'position-b'});deep.destroy();
  assert.equal(engines.length,1);assert.equal(engines[0].prepared,1);assert.equal(engines[0].destroyed,0);
  assert.deepEqual(engines[0].searches,['position-a','position-b']);assert.equal(a.engineMemory.instanceId,b.engineMemory.instanceId);
  assert.equal(b.engineMemory.fromMemory,true);assert.equal(b.engineAssetStorage.assetSource,'prepared-memory');assert.equal(b.assetLoadMs,0);
  assert.equal(pool.getState().engines.find(e=>e.mode==='berserk').status,'ready');pool.clear();
});
test('default releases the previous idle motor when another motor is selected',async()=>{
  const {pool,engines}=fixture();const a=pool.handle('sf-lite');await a.prepare();a.destroy();
  const b=pool.handle('lc0');await b.prepare();b.destroy();
  assert.equal(engines[0].destroyed,1);assert.equal(engines[1].destroyed,0);
  assert.equal(pool.getState().engines.filter(e=>e.status==='ready').length,1);pool.clear();
});
test('all policy prepares all five variants, preserves them simultaneously and starts no searches',async()=>{
  const {pool,engines}=fixture({policy:'all'});await pool.warmAll();
  assert.deepEqual(engines.map(e=>e.mode),modes);assert(engines.every(e=>e.prepared===1&&!e.destroyed&&!e.searches.length));
  assert.equal(pool.getState().engines.filter(e=>e.status==='ready').length,5);
  const a=pool.handle('sf-full');const result=await a.analyze({fen:'fresh-position'});a.destroy();
  assert.equal(result.engineMemory.fromMemory,true);assert.equal(engines.length,5);assert(engines.every(e=>!e.destroyed));pool.clear();
});
test('one engine cannot serve overlapping consumers; release transfers its lease once',async()=>{
  const {pool,engines}=fixture();const a=pool.handle('reckless'),b=pool.handle('reckless');await a.prepare();
  let second=false;const waiting=b.prepare().then(()=>second=true);await tick();assert.equal(second,false);
  a.destroy();await waiting;a.stop();assert.equal(engines[0].destroyed,0,'retired handle cannot stop a new owner');
  await b.analyze({fen:'position-b'});b.destroy();assert.equal(engines.length,1);pool.clear();
});
test('cancelling a queued consumer does not destroy the current owner',async()=>{
  const {pool,engines}=fixture();const a=pool.handle('sf-full');await a.prepare();
  const b=pool.handle('sf-full'),control=new AbortController();const wait=b.prepare({signal:control.signal});
  control.abort();await assert.rejects(wait,{name:'AbortError'});b.destroy();assert.equal(engines[0].destroyed,0);
  await a.analyze({fen:'position-a'});a.destroy();pool.clear();
});
test('dropping all to one cancels unfinished warmup and never loads queued motors',async()=>{
  const {pool,engines}=fixture({policy:'all',decorate:e=>{e.prepare=({signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error('Cancelled'),{name:'AbortError'})),{once:true}));}});
  const warm=pool.warmAll();await tick();assert.equal(engines.length,1);pool.setPolicy('one');await warm;
  assert.equal(engines[0].destroyed,1);assert.equal(engines.length,1);assert.equal(pool.getState().engines.filter(e=>e.status==='ready').length,0);
});
test('dropping all to one releases idle motors while keeping active owners intact',async()=>{
  const {pool,engines}=fixture({policy:'all'});await pool.warmAll();const active=pool.handle('berserk');await active.prepare();
  pool.setPolicy('one');assert.equal(engines.find(e=>e.mode==='berserk').destroyed,0);
  await active.analyze({fen:'position-a'});active.destroy();assert.equal(pool.getState().engines.filter(e=>e.status==='ready').length,1);pool.clear();
});
test('failure cannot claim Ready in RAM and a later explicit retry repairs only the missing engine',async()=>{
  let fail=true;const {pool,engines}=fixture({policy:'all',decorate:e=>{if(e.mode==='sf-full')e.prepare=async()=>{if(fail)throw new Error('Storage quota exceeded');};}});
  await pool.warmAll();assert.equal(pool.getState().engines.filter(e=>e.status==='ready').length,4);
  assert.match(pool.getState().engines.find(e=>e.mode==='sf-full').error,/quota/);fail=false;await pool.warmAll();
  assert.equal(pool.getState().engines.filter(e=>e.status==='ready').length,5);assert.equal(engines.length,6);pool.clear();
});
test('forced-stop results retire the adapter and the next analysis gets a fresh instance',async()=>{
  const {pool,engines}=fixture({decorate:e=>{e.analyze=async args=>({fen:args.fen,stopped:true,forcedStop:true});}});
  const a=pool.handle('sf-lite');await a.analyze({fen:'position-a'});a.destroy();
  assert.equal(engines[0].destroyed,1);const b=pool.handle('sf-lite');await b.prepare();assert.equal(engines.length,2);b.destroy();pool.clear();
});
test('release idle RAM does not delete files, waits for disposal and refuses to release active leases',async()=>{
  const {pool,engines}=fixture({policy:'all'});await pool.warmAll();const a=pool.handle('lc0');await a.prepare();
  await assert.rejects(pool.releaseIdle('lc0'),/Stop the active analysis/);assert.equal(engines.find(e=>e.mode==='lc0').destroyed,0);
  a.destroy();await pool.releaseIdle('lc0');assert.equal(engines.find(e=>e.mode==='lc0').destroyed,1);
  assert.equal(pool.getState().engines.filter(e=>e.status==='ready').length,4);pool.clear();
});
test('changing worker configuration never reuses an obsolete prepared generation',async()=>{
  let revision=1;const {pool,engines}=fixture({keyFor:mode=>mode+':'+revision});const a=pool.handle('sf-full');await a.prepare();a.destroy();
  revision++;const b=pool.handle('sf-full');await b.prepare();assert.equal(engines.length,2);assert.equal(engines[0].destroyed,1);b.destroy();pool.clear();
});
test('a late stopped search cannot discard the replacement instance on the same handle',async()=>{
  let rejectOld;const {pool,engines}=fixture();
  const a=pool.handle('sf-lite');await a.prepare();engines[0].analyze=()=>new Promise((resolve,reject)=>{rejectOld=reject;});
  const old=a.analyze({fen:'position-a'});await tick();a.stop();const current=await a.analyze({fen:'position-b'});
  rejectOld(new Error('Old worker closed'));await assert.rejects(old,/Old worker/);a.destroy();
  assert.equal(engines[1].destroyed,0);assert.equal(pool.getState().engines.find(e=>e.mode==='sf-lite').instanceId,current.engineMemory.instanceId);pool.clear();
});
test('all policy restores a stopped prepared worker without restarting its calculation',async()=>{
  const {pool,engines}=fixture({policy:'all'});await pool.warmAll();const a=pool.handle('sf-lite');await a.prepare();a.stop();a.destroy();
  await new Promise(resolve=>setTimeout(resolve,15));
  assert.equal(pool.getState().engines.filter(e=>e.status==='ready').length,5);assert.equal(engines.length,6);
  assert(engines.every(e=>!e.searches.length));pool.clear();
});
test('actual card controller returns its lease so Deep can reuse the same prepared worker after navigation',async()=>{
  const {pool,engines}=fixture();let fen='position-a';
  const cards=Cards.create({session:{capabilities:()=>({mobile:true}),getSettings:()=>({})},teardownGraceMs:0,
    getContext:()=>({fen,canAnalyze:true,settings:{}}),backendFor:mode=>({create:()=>pool.handle(mode)})});
  const first=await cards.analyze('sf-lite');fen='position-b';cards.positionChanged();
  const deep=pool.handle('sf-lite');const second=await deep.analyze({fen});deep.destroy();
  assert.equal(first.engineMemory.instanceId,second.engineMemory.instanceId);assert.equal(engines.length,1);assert.equal(engines[0].destroyed,0);
  cards.destroy();pool.clear();
});
