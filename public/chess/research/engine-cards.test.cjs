'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Cards=require('../js/8zc-engine-cards.js');
function setup(t,mobile=false,extra={}){
  let fen='position-a',positionHistory=null,canAnalyze=true;const calls=[],engines=[],published=[];
  const settings={sfAnalysisDepth:11,sfCardMode:'sf-lite',topN:3};
  const session={capabilities:()=>({mobile,hardwareConcurrency:8}),getSettings:()=>({sfFullThreadsRequested:1})};
  const cards=Cards.create({session,teardownGraceMs:0,...extra,getContext:()=>({fen,positionHistory,canAnalyze,settings}),
    backendFor:mode=>({create(){
      const engine={prepare:async()=>{},analyze(options){const call={mode,options};calls.push(call);engine.options=options;return new Promise(r=>{call.resolve=r;engine.resolve=r;});},
        stop(){engine.resolve?.({fen,lines:[],stopped:true});},destroy(){engine.destroyed=true;}};
      engines.push(engine);return engine;
    }}),onResult:x=>published.push(x)});
  t.after(()=>cards.destroy());
  const tick=()=>new Promise(r=>setImmediate(r));
  const complete=(index,depth=11)=>calls[index].resolve({fen,lines:[{depth,pv:['e2e4'],score:{type:'cp',white:27}}],stopped:false});
  return {cards,calls,engines,published,settings,tick,complete,changeFen(value){fen=value;cards.positionChanged();},changeHistory(value){positionHistory=value;cards.positionChanged();},setAvailable(value){canAnalyze=value;cards.positionChanged();}};
}
test('each card owns its timed budget and result, and a completed repeat adds search time',async t=>{
  const x=setup(t),first=x.cards.analyze('sf-lite');await x.tick();assert.equal(x.calls[0].options.movetime,15000);assert.equal(x.calls[0].options.depth,undefined);
  x.complete(0);await first;
  const second=x.cards.analyze('sf-lite');await x.tick();assert.equal(x.calls[1].options.movetime,30000);assert.equal(x.calls[1].options.depth,undefined);
  x.complete(1,13);await second;assert.equal(x.cards.get('sf-lite').requestedTimeMs,30000);assert.equal(x.cards.get('sf-lite').requestedDepth,null);
  assert.equal(x.engines.length,1,'a completed repeat keeps the prepared worker');
  assert.equal(x.cards.get('berserk'),null);
});

test('per-move analysis is opt-in, uses the card variant, and cancels stale positions and pending follow work',async t=>{
  const x=setup(t),wait=()=>new Promise(r=>setTimeout(r,130));
  x.changeFen('position-b');await wait();assert.equal(x.calls.length,0);assert.equal(x.cards.isFollowing(),false);
  x.settings.sfCardMode='sf-full';x.cards.setFollowing(true);await wait();
  assert.deepEqual(x.calls.map(x=>x.mode),['sf-full','berserk']);
  const oldCallback=x.calls[0].options.onInfo;
  x.changeFen('position-c');x.changeFen('position-d');await wait();
  assert.equal(x.engines[0].destroyed,true);assert.equal(x.engines[1].destroyed,true);
  assert.deepEqual(x.calls.slice(2).map(x=>x.options.fen),['position-d','position-d']);
  oldCallback(null,{fen:'position-b',lines:[{depth:99,pv:['e2e4']}]});assert.equal(x.published.length,0);
  x.complete(2);x.complete(3);await x.tick();x.cards.positionChanged();await wait();assert.equal(x.calls.length,4,'same-position repaint does not reanalyze');
  x.changeFen('position-e');x.cards.setFollowing(false);await wait();assert.equal(x.calls.length,4,'off cancels pending automatic work');
  assert.equal(x.cards.isFollowing(),false);
});

test('mobile automatic analysis stays sequential and respects unavailable/locked contexts',async t=>{
  const x=setup(t,true),wait=()=>new Promise(r=>setTimeout(r,130));
  x.setAvailable(false);x.cards.setFollowing(true);await wait();assert.equal(x.calls.length,0);
  x.setAvailable(true);await wait();assert.equal(x.calls.length,1);assert.match(x.cards.state('BER').note,/Queued/);
  x.complete(0);await x.tick();assert.equal(x.calls.length,2);
  x.cards.setFollowing(false);await wait();assert.equal(x.cards.isRunning(),false);
  assert.equal(x.engines[1].destroyed,true);
});

test('enabling per-move mode during a manual All run retains the current workers',async t=>{
  const x=setup(t),run=x.cards.analyzeAll();await x.tick();x.cards.setFollowing(true);
  await new Promise(r=>setTimeout(r,130));assert.equal(x.calls.length,2);assert.equal(x.cards.isAllRunning(),true);
  assert.equal(x.engines.some(x=>x.destroyed),false);
  x.complete(0);x.complete(1);await run;x.cards.stopAll();x.cards.positionChanged();
  await new Promise(r=>setTimeout(r,130));assert.equal(x.calls.length,2,'Stop and a repaint do not restart the stopped position');
});
test('desktop Analyze all runs actual engines concurrently and retains separate scores',async t=>{
  const x=setup(t),run=x.cards.analyzeAll();await x.tick();assert.deepEqual(x.calls.map(x=>x.mode),['sf-lite','berserk']);
  x.complete(0);x.engines[1].resolve({fen:'position-a',lines:[{depth:9,pv:['d2d4'],score:{type:'cp',white:12}}]});await run;
  assert.equal(x.cards.get('sf-lite').lines[0].score.white,27);assert.equal(x.cards.get('berserk').lines[0].score.white,12);
  assert.equal(x.cards.isAllRunning(),false);assert.equal(x.cards.get('reckless'),null);
});
test('mobile Analyze all queues the second engine and Stop cancels both active and queued work',async t=>{
  const x=setup(t,true),run=x.cards.analyzeAll();await x.tick();assert.equal(x.calls.length,1);
  assert.match(x.cards.state('BER').note,/Queued/);x.cards.stopAll();await run;await x.tick();assert.equal(x.calls.length,1);
  assert.equal(x.cards.isRunning(),false);assert.equal(x.engines[0].destroyed,true);
});
test('mobile starts its next engine only after the first completes',async t=>{
  const x=setup(t,true),run=x.cards.analyzeAll();await x.tick();x.complete(0);await x.tick();assert.equal(x.calls.length,2);
  x.complete(1);await run;
});
test('position changes destroy old workers and late callbacks cannot publish another position',async t=>{
  const x=setup(t),run=x.cards.analyze('berserk');await x.tick();const callback=x.calls[0].options.onInfo;
  x.changeFen('position-b');callback(null,{fen:'position-a',lines:[{depth:99,pv:['e2e4']}]});await run;
  assert.equal(x.published.length,0);assert.equal(x.engines[0].destroyed,true);assert.equal(x.cards.get('berserk'),null);
});
test('the same FEN with different repetition history cannot reuse an earlier result',async t=>{
  const x=setup(t),run=x.cards.analyze('sf-lite');await x.tick();x.complete(0);await run;
  assert.ok(x.cards.get('sf-lite'));x.changeHistory({startFen:'root',moves:['g1f3','g8f6']});
  assert.equal(x.cards.get('sf-lite'),null);
  const next=x.cards.analyze('sf-lite',{reuse:true});await x.tick();assert.equal(x.calls.length,2);
  assert.deepEqual(x.calls[1].options.history,{startFen:'root',moves:['g1f3','g8f6']});x.complete(1);await next;
});
test('a card watchdog settles a non-responsive adapter, keeps valid lines and allows a new search',async t=>{
  const x=setup(t,false,{timeGraceMs:5});x.settings.analysisTimeMs=15;
  const run=x.cards.analyze('berserk');await x.tick();const stale=x.calls[0].options.onInfo;
  x.calls[0].options.onSearchStarted();stale(null,{fen:'position-a',lines:[{depth:8,pv:['e2e4'],score:{type:'cp',white:27}}]});
  await run;assert.equal(x.cards.isRunning(),false);assert.equal(x.engines[0].destroyed,true);
  assert.match(x.cards.state('BER').note,/time-watchdog.*retained result/);assert.equal(x.cards.get('berserk').lines[0].depth,8);
  const again=x.cards.analyze('berserk');await x.tick();assert.equal(x.engines.length,2);assert.equal(x.calls[1].options.movetime,30);
  stale(null,{fen:'position-a',lines:[{depth:99,pv:['d2d4']}]});assert.equal(x.cards.get('berserk').lines[0].depth,8);
  x.complete(1);await again;assert.doesNotMatch(x.cards.state('BER').note,/watchdog/);
});
test('preparation watchdog settles silent loading without claiming an analysis result',async t=>{
  const mode='berserk';
  // Hold preparation through the adapter, then verify forced teardown of the loader.
  const originalCreate=Cards.create;
  let engine;
  const cards=originalCreate({session:{capabilities:()=>({mobile:true}),getSettings:()=>({})},teardownGraceMs:0,preparationTimeoutMs:10,
    getContext:()=>({fen:'position-a',canAnalyze:true,settings:{}}),backendFor:()=>({create:()=>engine={prepare:()=>new Promise(()=>{}),destroy(){this.destroyed=true;}}})});
  t.after(()=>cards.destroy());await cards.analyze(mode);
  assert.equal(engine.destroyed,true);assert.equal(cards.isRunning(),false);assert.equal(cards.get(mode),null);assert.match(cards.state('BER').note,/preparation-watchdog.*no result/);
});
test('mobile keeps one prepared engine and yields after tearing it down before the next engine',async t=>{
  const x=setup(t,true,{teardownGraceMs:30});const first=x.cards.analyze('sf-full');await x.tick();x.complete(0);await first;
  x.cards.positionChanged();const repeat=x.cards.analyze('sf-full');await x.tick();assert.equal(x.engines.length,1);x.complete(1);await repeat;
  const next=x.cards.analyze('berserk');await x.tick();assert.equal(x.engines[0].destroyed,true);assert.equal(x.calls.length,2);
  await new Promise(r=>setTimeout(r,40));assert.equal(x.calls.length,3);x.complete(2);await next;
  x.cards.stopAll();assert.equal(x.engines[1].destroyed,true);
});

test('an active Stockfish card stops its actual variant after the preference changes, even when new analysis is unavailable',async t=>{
  const x=setup(t),run=x.cards.analyze('sf-lite');await x.tick();
  x.settings.sfCardMode='sf-full';x.setAvailable(false);
  assert.equal(x.cards.state('SF').mode,'sf-lite');assert.equal(x.cards.state('SF').disabled,false);
  await x.cards.analyze('sf-full');await run;
  assert.equal(x.engines[0].destroyed,true);assert.equal(x.calls.length,1);assert.equal(x.cards.isRunning(),false);
});
test('coalesced paints retain the latest snapshot on Stop and cancel a pending stale paint',async t=>{
  const x=setup(t,false,{paintIntervalMs:100}),run=x.cards.analyze('sf-lite');await x.tick();
  const info=x.calls[0].options.onInfo;
  for(let i=1;i<=30;i++)info(null,{fen:'position-a',lines:[{depth:i,pv:['e2e4'],score:{type:'cp',white:i}}]});
  assert.equal(x.published.length,1,'native bursts do not repaint the entire board thirty times');
  x.cards.stopRole('SF');await run;
  assert.equal(x.cards.get('sf-lite').lines[0].depth,30);assert.equal(x.published.at(-1).lines[0].depth,30);
  const count=x.published.length;x.changeFen('position-b');await new Promise(r=>setTimeout(r,120));
  assert.equal(x.published.length,count,'cancelled paint cannot publish into the next position');
});

test('All requests Full after a preference change while Lite is running, instead of silently skipping Stockfish',async t=>{
  const x=setup(t),first=x.cards.analyze('sf-lite');await x.tick();x.settings.sfCardMode='sf-full';
  const all=x.cards.analyzeAll();await x.tick();await first;
  assert.equal(x.engines[0].destroyed,true);assert.deepEqual(x.calls.map(c=>c.mode),['sf-lite','sf-full','berserk']);
  assert.equal(x.cards.isAllRunning(),true,'replacing the first variant keeps Stop all active');
  assert.equal(x.calls[1].options.movetime,15000);x.complete(1);x.complete(2);await all;
  assert.equal(x.cards.get('sf-full').status,'complete');assert.equal(x.cards.isAllRunning(),false);
});
test('reuse never returns a running Lite result as Full after a variant change',async t=>{
  const x=setup(t),first=x.cards.analyze('sf-lite');await x.tick();
  assert.equal(await x.cards.analyze('sf-full',{reuse:true}),null);assert.equal(x.cards.state('SF').working,true);
  x.complete(0);await first;
});
