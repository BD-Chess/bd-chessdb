'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { JSDOM } = require('jsdom');
const Cards = require('../js/8zc-engine-cards.js'), Deep = require('../js/8zc-deep-engine.js');
const Chess = require('../js/chess.min.js').Chess;
const START = new Chess().fen();
const tick = () => new Promise(resolve => setImmediate(resolve));

function cardFixture(t, mobile, savedTime) {
  let fen = START, history = null;
  const modes = ['sf-lite','reckless','lc0','berserk'];
  const calls = [], settings = { sfCardMode:'sf-lite', topN:3, analysisTimeMs:savedTime };
  const registry = { modes:()=>modes, supported:mode=>modes.includes(mode), participants:()=>modes,
    roleFor:mode=>({'sf-lite':'SF',reckless:'RLE',lc0:'LC0',berserk:'BER'}[mode]), label:mode=>mode };
  const cards = Cards.create({ registry, teardownGraceMs:0, session:{capabilities:()=>({mobile,hardwareConcurrency:8}),getSettings:()=>settings},
    getContext:()=>({fen,positionHistory:history,canAnalyze:true,settings}), backendFor:mode=>({create(){
      const engine = { prepare:async()=>{}, analyze(options){ const call = {mode,options};calls.push(call);return new Promise(resolve=>{call.finish=resolve;}); },
        stop(){},destroy(){} };return engine;
    }}) });
  t.after(()=>cards.destroy());
  return {cards,calls,settings,complete(i){calls[i].finish({fen,lines:[{depth:17,pv:['e2e4'],score:{type:'cp',white:10}}],searchElapsedMs:20,initializationMs:1,stopReason:'time-budget'});},
    next(){history={startFen:START,moves:[]};cards.positionChanged();}};
}

test('All uses the shared actual four-family participants and gives every engine equal search time', async t => {
  const x = cardFixture(t,false,30000), run=x.cards.analyzeAll();await tick();
  assert.equal(x.calls.length,2,'desktop concurrency stays bounded');
  x.complete(0);x.complete(1);await tick();assert.equal(x.calls.length,4);x.complete(2);x.complete(3);await run;
  assert.deepEqual(x.calls.map(call=>call.mode),['sf-lite','reckless','lc0','berserk']);
  for(const call of x.calls) {assert.equal(call.options.movetime,30000);assert.equal(call.options.depth,undefined);assert.equal(call.options.nodes,undefined);}
  for(const mode of ['sf-lite','reckless','lc0','berserk']) {const value=x.cards.get(mode);assert.equal(value.requestedTimeMs,30000);assert.ok(value.queueWaitMs>=0);assert.ok(value.initializationMs>=1);assert.equal(value.actualSearchMs,20);assert.equal(value.stopReason,'time-budget');assert.match(x.cards.state(mode==='sf-lite'?'SF':mode==='reckless'?'RLE':mode==='lc0'?'LC0':'BER').note,/Search 0.0s \/ 30.0s/);}
});

test('mobile defaults to five seconds, respects explicit saved time and sequential queue', async t => {
  const x=cardFixture(t,true), run=x.cards.analyzeAll();await tick();assert.equal(x.calls.length,1);assert.equal(x.calls[0].options.movetime,5000);
  for(let i=0;i<4;i++){x.complete(i);await tick();}await run;
  x.settings.analysisTimeMs=60000;x.next();const next=x.cards.analyze('lc0');await tick();assert.equal(x.calls[4].options.movetime,60000);x.complete(4);await next;
});

test('a repeated completed card grows time while automatic All returns to base', async t=>{
  const x=cardFixture(t,false,15000), first=x.cards.analyze('sf-lite');await tick();x.complete(0);await first;
  const second=x.cards.analyze('sf-lite');await tick();assert.equal(x.calls[1].options.movetime,30000);x.complete(1);await second;
  const all=x.cards.analyzeAll({automatic:true});await tick();assert.equal(x.calls[2].options.movetime,15000);
  x.complete(2);x.complete(3);await tick();x.complete(4);x.complete(5);await all;
});

test('explicit depth and time are sent together; a finite time alone has no hidden depth or nodes', async()=>{
  const limits=Deep.limitsFor({fen:START,depth:42,movetime:3600000},Chess);assert.equal(limits.depth,42);assert.equal(limits.movetime,3600000);
  const sent=[];let worker;
  const engine=Deep.create({Chess,workerFactory(){worker={postMessage(command){sent.push(command);if(command==='uci')queueMicrotask(()=>worker.onmessage({data:'uciok'}));if(command==='isready')queueMicrotask(()=>worker.onmessage({data:'readyok'}));},terminate(){}};return worker;}});
  const run=engine.analyze({fen:START,depth:42,movetime:3600000});await tick();assert.equal(sent.at(-1),'go depth 42 movetime 3600000');
  worker.onmessage({data:'info depth 42 score cp 12 nodes 1000 pv e2e4'});worker.onmessage({data:'bestmove e2e4'});const result=await run;
  assert.equal(result.stopReason,'depth-limit');assert.ok(result.actualSearchMs>=0);engine.destroy();
  const time=Deep.limitsFor({fen:START,movetime:14400000},Chess);assert.equal(time.depth,null);assert.equal(time.nodes,null);
});

function deepFixture(t) {
  const base=path.resolve(__dirname,'..');
  const dom=new JSDOM('<!doctype html><button id="btnDeepAnalysis"></button><div id="workspaceDisplay"></div>',{runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;t.after(()=>w.close());w.eval(fs.readFileSync(path.join(base,'js/chess.min.js'),'utf8'));
  const settings={analysisMode:'sf-lite',deepTimeMs:0},analyses=[];let pending,running=false;
  const adapter={analyze(options){analyses.push(options);running=true;return new Promise(resolve=>{pending=resolve;});},isRunning:()=>running,stop(){running=false;},destroy(){}};
  w.ChessDeepEngine={validateFen(){},create:()=>adapter};w.ChessAnalysisSession={getSettings:()=>settings,capabilities:()=>({mobile:false}),configure:patch=>Object.assign(settings,patch),create:()=>adapter};
  w.eval(fs.readFileSync(path.join(base,'js/8zc-deep-ui.js'),'utf8'));const game=new w.Chess();let change;
  const ui=w.ChessDeepUI.create({Chess:w.Chess,getContext:()=>({fen:game.fen()}),onChange:fn=>{change=fn;return()=>{};}});
  const el=name=>w.document.querySelector('[data-deep="'+name+'"]');ui.open();
  const select=(name,value)=>{el(name).value=value;el(name).dispatchEvent(new w.Event('change'));};
  const finish=(value)=>{running=false;pending(value||{fen:game.fen(),lines:[],limits:{movetime:analyses.at(-1).movetime},elapsedMs:1});};
  return {w,ui,el,select,settings,analyses,finish,repin:context=>change(context),next(){game.move('e4');change({fen:game.fen()});}};
}

test('Deep finite Time ignores legacy depth until explicitly changed and keeps base on next position', async t=>{
  const x=deepFixture(t);assert.equal(x.el('time').value,'off');
  assert.deepEqual([...x.el('time').options].map(option=>option.textContent),['Off','10s','30s','1m','5m','15m','30m','1h','4h','Until I stop']);
  x.select('budget','depth:18');x.select('time','3600000');x.el('start').click();assert.equal(x.analyses[0].movetime,3600000);assert.equal(x.analyses[0].depth,undefined);x.finish();await tick();
  x.select('budget','depth:26');x.el('start').click();assert.equal(x.analyses[1].depth,26);assert.equal(x.analyses[1].movetime,3600000);x.finish();await tick();
  x.select('time','30000');x.el('start').click();assert.equal(x.analyses[2].depth,undefined);x.finish();await tick();x.ui.deepenOrStop();assert.equal(x.analyses[3].movetime,60000);x.finish();await tick();
  x.next();assert.equal(x.analyses[4].movetime,30000);assert.equal(x.analyses[4].depth,undefined);
  x.ui.stop();x.select('time','infinite');x.el('start').click();assert.equal(x.settings.deepTimeMs,-1);assert.equal(x.analyses[5].infinite,true);assert.equal(x.analyses[5].depth,undefined);assert.equal(x.analyses[5].movetime,undefined);
  x.ui.stop();x.select('time','off');x.el('start').click();assert.equal(x.analyses[6].depth,26);assert.equal(x.analyses[6].movetime,undefined);
});

test('All replaces an active extended card so every participant starts with the base budget',async t=>{
  const x=cardFixture(t,false,15000),first=x.cards.analyze('sf-lite');await tick();x.complete(0);await first;
  const extended=x.cards.analyze('sf-lite');await tick();assert.equal(x.calls[1].options.movetime,30000);
  const all=x.cards.analyzeAll();await tick();assert.equal(await extended,null);assert.equal(x.calls[2].mode,'sf-lite');assert.equal(x.calls[2].options.movetime,15000);
  x.complete(2);x.complete(3);await tick();x.complete(4);x.complete(5);await all;
  assert(x.calls.slice(2).every(call=>call.options.movetime===15000));
});

test('Deep dual Time Off uses depth and LCZero skips unsupported root/depth limits while exposing Q and visits',async t=>{
  const x=deepFixture(t);x.settings.analysisMode='sf-berserk';x.select('budget','depth:22');x.el('start').click();
  assert.equal(x.analyses[0].depth,22);assert.equal(x.analyses[0].movetime,undefined);x.finish();await tick();
  x.settings.analysisMode='lc0';x.el('roots').value='this is not a legal move';x.el('start').click();
  assert.deepEqual([...x.analyses[1].searchMoves],[]);assert.equal(x.analyses[1].depth,undefined);assert.equal(x.analyses[1].movetime,15000);
  x.finish({mode:'lc0',fen:START,lines:[{score:{type:'q',white:0.125},pv:['e2e4'],visits:9}],visits:9,elapsedMs:100,completeMultiPV:false});await tick();
  assert.match(x.el('lines').textContent,/Q \+0\.125/);assert.match(x.el('lines').textContent,/Visits 9/);
});


test('Deep repins a same-FEN transposition when repetition history changes and ignores source-only repaints', async t=>{
  const x=deepFixture(t), left=new x.w.Chess(),right=new x.w.Chess();
  for(const san of ['Nf3','Nf6','Nc3','Nc6'])left.move(san);
  for(const san of ['Nc3','Nc6','Nf3','Nf6'])right.move(san);
  assert.equal(left.fen(),right.fen());
  const first={fen:left.fen(),positionHistory:{startFen:START,moves:['g1f3','g8f6','b1c3','b8c6']}};
  const second={fen:right.fen(),positionHistory:{startFen:START,moves:['b1c3','b8c6','g1f3','g8f6']}};
  x.el('start').click();x.repin(first);assert.equal(x.analyses.length,2);assert.deepEqual([...x.analyses[1].history.moves],first.positionHistory.moves);
  x.repin({...first,source:'berserk',settings:{boardSource:'berserk'}});assert.equal(x.analyses.length,2,'display-only settings do not replace the pinned search');
  x.repin(second);assert.equal(x.analyses.length,3,'same position with another history requires a fresh search');assert.deepEqual([...x.analyses[2].history.moves],second.positionHistory.moves);
});
