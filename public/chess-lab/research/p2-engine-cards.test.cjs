'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const Registry=require('../js/8zc-engine-registry.js'),Deep=require('../js/8zc-deep-engine.js'),{Chess}=require('../js/chess.min.js');
const START=new Chess().fen(),tick=()=>new Promise(r=>setImmediate(r));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}
function fixture(t,{mobile=false,hc=1,variant='sf-lite',unavailable=[]}={}){
  let clock=0,serial=0,fen=START,history=null,canAnalyze=true;const timers=new Map(),calls=[],published=[],events=new Map();
  const registry={...Registry,supported:m=>!unavailable.includes(m),modes:()=>Registry.modes().filter(m=>!unavailable.includes(m)),participants:v=>Registry.participants(v).filter(m=>!unavailable.includes(m))};
  const settings={sfCardMode:variant,analysisTimeMs:3600000,topN:3},module={exports:{}};
  const timer=(fn,ms)=>{const id=++serial;timers.set(id,{fn,at:clock+ms});return id;};
  const root={document:{hidden:false,addEventListener:(n,f)=>events.set(n,f),removeEventListener(){}},performance:{now:()=>clock},ChessEngineRegistry:registry};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/8zc-engine-cards.js'),'utf8'),{window:root,module,AbortController,Date,Promise,setTimeout:timer,clearTimeout:id=>timers.delete(id)});
  const cards=module.exports.create({registry,session:{capabilities:()=>({mobile,hardwareConcurrency:hc}),getSettings:()=>({})},teardownGraceMs:0,
    getContext:()=>({fen,positionHistory:history,canAnalyze,settings}),backendFor:mode=>({create(){
      const ready=deferred(),search=deferred(),c={mode,ready,search,destroyed:false};calls.push(c);
      return {prepare:()=>ready.promise,analyze(options){c.options=options;c.started=clock;options.onSearchStarted({timestamp:clock});return search.promise;},destroy(){c.destroyed=true;}};
    }}),onResult:v=>published.push(v)});
  t.after(()=>cards.destroy());
  return {cards,calls,settings,published,root,events,timers,async advance(ms){clock+=ms;for(const [id,v]of [...timers])if(v.at<=clock){timers.delete(id);v.fn();}await tick();},
    change(nextFen=fen,nextHistory=history){fen=nextFen;history=nextHistory;cards.positionChanged();},lock(){canAnalyze=false;cards.positionChanged();}};
}
for(const mobile of [false,true])for(const variant of ['sf-lite','sf-full'])test(`lower All starts four independent full-budget families: mobile=${mobile}, ${variant}, hardwareConcurrency=1`,async t=>{
  const x=fixture(t,{mobile,variant}),run=x.cards.analyzeAll();await tick();
  assert.deepEqual(x.calls.map(c=>c.mode),[variant,'reckless','lc0','berserk']);
  for(const c of x.calls)c.ready.resolve();await tick();assert(x.calls.every(c=>c.options&&!c.destroyed));
  assert(x.calls.every(c=>c.options.movetime===3600000&&c.options.multiPV===3&&c.options.fen===START));
  await x.advance(3599000);assert.equal(x.cards.isRunning(),true,'one hour is not divided by four or capped');
  x.calls[0].search.resolve({fen:START,lines:[],actualSearchMs:3600000});await tick();assert.equal(x.calls.filter(c=>c.options&&!c.destroyed).length,4);
  for(const c of x.calls.slice(1))c.search.resolve({fen:START,lines:[],actualSearchMs:3600000});await run;
  for(const c of x.calls)assert.equal(x.cards.get(c.mode).requestedTimeMs,3600000);
  x.cards.stopAll();assert(x.calls.every(c=>c.destroyed));
});
test('one lower All slow/failed loader never holds healthy searches or substitutes Stockfish',async t=>{
  const x=fixture(t),run=x.cards.analyzeAll();await tick();
  for(const c of x.calls.filter(c=>c.mode!=='reckless'))c.ready.resolve();await tick();
  assert.equal(x.calls.filter(c=>c.options).length,3);assert.equal(x.cards.state('RLE').working,true);
  x.calls.find(c=>c.mode==='reckless').ready.reject(new Error('fixture loader unavailable'));await tick();
  assert.equal(x.cards.get('reckless').status,'failed');assert.match(x.cards.state('RLE').note,/Error: fixture loader unavailable/);
  for(const c of x.calls.filter(c=>c.options))c.search.resolve({fen:START,lines:[]});await run;assert.equal(x.calls.length,4);
});
test('lower All honors available families and repeated-click/individual/batch Stop during preparation and search',async t=>{
  const x=fixture(t,{mobile:true,unavailable:['lc0']}),first=x.cards.analyzeAll();await tick();assert.equal(x.calls.length,3);
  await x.cards.analyzeAll();await first;assert(x.calls.every(c=>c.destroyed));
  for(const c of x.calls)c.ready.resolve();await tick();assert(x.calls.every(c=>!c.options));
  const second=x.cards.analyzeAll();await tick();const next=x.calls.slice(3);for(const c of next)c.ready.resolve();await tick();
  x.cards.stopRole('RLE');assert.equal(next.find(c=>c.mode==='reckless').destroyed,true);assert.equal(x.cards.isRunning(),true);
  x.cards.stopAll();await second;assert(next.every(c=>c.destroyed));assert.equal(x.cards.isRunning(),false);
});
test('lower All binds history, rejects late callbacks after rapid navigation and stops on hidden page/live lock',async t=>{
  const x=fixture(t),run=x.cards.analyzeAll();await tick();for(const c of x.calls)c.ready.resolve();await tick();const old=x.calls.slice();
  const g=new Chess();g.move('e4');x.change(g.fen(),{startFen:START,moves:['e2e4']});await run;
  for(const c of old){c.options.onInfo(null,{fen:START,lines:[{pv:['e2e4']}]});c.search.resolve({fen:START,lines:[]});}await tick();assert.equal(x.published.length,0);
  const next=x.cards.analyzeAll();await tick();for(const c of x.calls.slice(4))c.ready.resolve();await tick();
  assert(x.calls.slice(4).every(c=>c.options.history.moves[0]==='e2e4'));x.root.document.hidden=true;x.events.get('visibilitychange')();await next;
  assert(x.calls.every(c=>c.destroyed));x.lock();await x.cards.analyzeAll();assert.equal(x.calls.length,8);
});
test('Deep All starts each ready child without a slow preparation barrier and preserves independent budgets',async t=>{
  const root={ChessEngineRegistry:Registry,navigator:{hardwareConcurrency:1},matchMedia:()=>({matches:true}),innerWidth:390,performance:{now:()=>0}},module={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/8zc-analysis-session.js'),'utf8'),{window:root,module,require:p=>p.includes('registry')?Registry:Deep,URL,Date,Promise,AbortController,setTimeout,clearTimeout});
  const Session=module.exports;Session.configure({analysisMode:'all'});const calls=[];
  const session=Session.create({Chess,adapterFactory:id=>{const ready=deferred(),search=deferred(),c={id,ready,search};calls.push(c);return {prepare:()=>ready.promise,analyze:o=>{c.options=o;o.onSearchStarted();return search.promise;},destroy(){c.destroyed=true;}};}});t.after(()=>session.destroy());
  const run=session.analyze({fen:START,movetime:3600000,multiPV:3});await tick();for(const c of calls.filter(c=>c.id!=='lc0'))c.ready.resolve();await tick();
  assert.equal(calls.filter(c=>c.options).length,3,'a healthy child does not wait for the slow network');
  calls.find(c=>c.id==='lc0').ready.reject(new Error('neural unavailable'));await tick();
  for(const c of calls.filter(c=>c.options)){assert.equal(c.options.movetime,3600000);c.search.resolve({fen:START,lines:[]});}
  const s=await run;assert.equal(s.status,'partial');assert.equal(s.children.lc0.status,'failed');assert(calls.every(c=>c.destroyed));
});
test('Deep All remains concurrent on mobile with only two available families and rejects an empty participant set',async t=>{
  for(const empty of [false,true]){
    const registry={...Registry,supported:id=>!empty&&['sf-lite','berserk'].includes(id)},root={ChessEngineRegistry:registry,navigator:{hardwareConcurrency:1},matchMedia:()=>({matches:true}),innerWidth:390},module={exports:{}};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/8zc-analysis-session.js'),'utf8'),{window:root,module,require:p=>p.includes('registry')?registry:Deep,URL,Date,Promise,AbortController,setTimeout,clearTimeout});
    const Session=module.exports;Session.configure({analysisMode:'all'});const calls=[];
    const session=Session.create({Chess,adapterFactory:id=>{const ready=deferred(),search=deferred(),c={id,ready,search};calls.push(c);return {prepare:()=>ready.promise,analyze:o=>{c.options=o;return search.promise;},destroy(){}};}});t.after(()=>session.destroy());
    if(empty){await assert.rejects(session.analyze({fen:START,movetime:10000}),/No local engines are available/);assert.equal(calls.length,0);continue;}
    assert.equal(Session.capabilities().sequential,false);const run=session.analyze({fen:START,movetime:10000});await tick();assert.deepEqual(calls.map(c=>c.id),['sf-lite','berserk']);
    for(const c of calls)c.ready.resolve();await tick();assert(calls.every(c=>c.options));session.stop();await run;
  }
});
