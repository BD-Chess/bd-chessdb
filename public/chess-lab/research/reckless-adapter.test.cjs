'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),path=require('node:path');
const {Chess}=require('../js/chess.min.js');
const START=new Chess().fen(),BLACK=(()=>{const g=new Chess();g.move('d4');return g.fen();})();
const adapter=import(pathToFileURL(path.resolve(__dirname,'../engines/reckless/v0.10.0-a6fa482c-r8/adapter.mjs')).href);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
class Worker {
  constructor(){this.messages=[];this.fen=START;}
  addEventListener(type,listener){this[type]=listener;}
  emit(data){this.message?.({data});}
  postMessage(message){
    this.messages.push(message);
    if(message.type==='analyze'){this.search=message;return;}
    if(message.type==='set-position')this.fen=message.fen;
    queueMicrotask(()=>this.emit({type:'response',requestId:message.requestId,ok:true,result:{fen:this.fen}}));
  }
  info(rank,depth,pv,score=20,bound='exact',mate=null){
    this.emit({type:'info',requestId:this.search?.requestId,info:{multiPv:rank,depth,pv:pv.split(' '),scoreCp:mate==null?score:null,mate,nodes:100,
      raw:`info depth ${depth} multipv ${rank} score ${mate==null?'cp '+score:'mate '+mate} ${bound==='exact'?'':bound+'bound'} pv ${pv}`}});
  }
  finish(bestMove='e2e4'){this.emit({type:'response',requestId:this.search.requestId,ok:true,result:{bestMove,nodes:100,depth:12}});}
  terminate(){this.terminated=true;}
}
async function fixture(t,options={}){
  const {create}=await adapter,workers=[],snapshots=[];
  const engine=create({Chess,workerFactory:()=>{const w=new Worker();workers.push(w);return w;},...options});
  t.after(()=>engine.destroy());
  return {engine,workers,snapshots,async start(opts={}){const done=engine.analyze({fen:START,infinite:true,multiPV:3,onInfo:(_,s)=>snapshots.push(s),...opts});done.catch(()=>{});await tick();return {done,w:workers.at(-1)};}};
}
function set(w,depth=8,roots=['e2e4 e7e5','d2d4 d7d5','g1f3 g8f6']){roots.forEach((pv,i)=>w.info(i+1,depth,pv));}
test('verified Reckless MultiPV is exact, distinct and fully legal; native bound evidence remains unchanged',async t=>{
  const x=await fixture(t),{done,w}=await x.start();
  set(w,8,['e2e4','e2e4','d2d4']);assert.equal(x.snapshots.at(-1).completeMultiPV,false,'duplicate roots are not a comparable set');
  w.info(1,9,'e2e4');w.info(2,9,'d2d4',21,'upper');w.info(3,9,'g1f3');
  assert.equal(x.snapshots.at(-1).completeMultiPV,false,'a bound cannot stand in for an exact candidate');
  set(w,10);w.finish();const s=await done;
  assert.equal(s.completeMultiPV,true);assert.equal(s.linesDepth,10);assert.equal(new Set(s.lines.map(l=>l.pv[0])).size,3);
});
for(const pv of ['e2e4 garbage e7e5','e2e4 e7e5 e4e6','e2e5'])test('whole PV rejected without token filtering: '+pv,async t=>{
  const x=await fixture(t),{done,w}=await x.start({multiPV:1});w.info(1,8,pv);w.finish();const s=await done;
  assert.equal(s.completeMultiPV,false);assert.deepEqual(s.lines,[]);assert.deepEqual(s.nativeLines[0].pv,pv.split(' '));assert.equal(s.nativeLines[0].validation.legal,false);
});
test('missing/out-of-range ranks and a new same-depth sweep cannot combine unrelated sets',async t=>{
  const x=await fixture(t),{done,w}=await x.start();
  w.info(1,7,'e2e4');w.info(3,7,'g1f3');w.info(4,7,'b1c3');assert.equal(x.snapshots.at(-1).completeMultiPV,false);
  w.info(1,7,'d2d4');w.info(2,7,'e2e4');assert.equal(x.snapshots.at(-1).completeMultiPV,false,'rank 3 from the prior rank-1 sweep cannot fill the new sweep');
  w.info(3,7,'g1f3');w.finish('d2d4');const s=await done;assert.equal(s.lines.length,3);assert.equal(s.completeMultiPV,true);
});
test('retains the latest verified set while rejecting older depths and exposing a deeper partial bound',async t=>{
  const x=await fixture(t),{done,w}=await x.start();set(w,10);set(w,8,['b1c3','a2a3','h2h3']);
  w.info(1,11,'e2e4',30,'lower');w.finish();const s=await done;
  assert.equal(s.linesDepth,10);assert.deepEqual(s.lines.map(l=>l.pv[0]),['e2e4','d2d4','g1f3']);
  assert.equal(s.partialLines.length,1);assert.equal(s.partialLines[0].score.bound,'lower');assert.equal(s.partialLines[0].score.root,30);
});
test('a changed final native bestmove is separate from the retained comparable set',async t=>{
  const x=await fixture(t),{done,w}=await x.start();set(w,8);w.info(1,9,'b1c3');w.finish('b1c3');const s=await done;
  assert.equal(s.bestMove,'e2e4');assert.equal(s.nativeBestMove,'b1c3');assert.equal(s.bestMoveConsistent,false);
  assert.equal(s.completeMultiPV,false);assert.equal(s.retainedCompleteMultiPV,true);assert.equal(s.coverage.status,'bestmove-mismatch');
});
test('Black cp/mate/bounds preserve native values and invert White POV without claiming complete coverage',async t=>{
  const x=await fixture(t),{done,w}=await x.start({fen:BLACK,multiPV:2});w.info(1,8,'d7d5',-21,'lower');w.info(2,8,'g8f6',null,'upper',-3);w.finish('d7d5');const s=await done;
  assert.equal(s.completeMultiPV,false);assert.equal(s.lines[0].score.root,-21);assert.equal(s.lines[0].score.white,21);assert.equal(s.lines[0].score.whiteBound,'upper');
  assert.equal(s.lines[1].score.type,'mate');assert.equal(s.lines[1].score.white,3);assert.equal(s.lines[1].score.whiteBound,'lower');
});
test('promotions and underpromotions are distinct legal roots; K is limited to legal moves',async t=>{
  const fen='7k/P7/6K1/8/8/8/8/8 w - - 0 1',x=await fixture(t),{done,w}=await x.start({fen,multiPV:3});
  set(w,4,['a7a8q','a7a8r','a7a8n']);w.finish('a7a8q');const s=await done;assert.equal(s.completeMultiPV,true);assert.equal(s.lines.length,3);
  const one='7k/6Q1/5K2/8/8/8/8/8 b - - 0 1';
  const pending=x.engine.analyze({fen:one,movetime:20,multiPV:10});await tick();x.workers.at(-1)?.finish(null);const terminal=await pending;
  assert.equal(terminal.terminal,true);assert.equal(terminal.expectedLines,0);assert.deepEqual(terminal.lines,[]);assert.equal(terminal.bestMove,null);
});
test('fewer legal roots than requested lines can complete exactly K ranks',async t=>{
  const fen='7k/8/5K2/8/8/8/8/7R b - - 0 1',legal=new Chess(fen).moves({verbose:true}).map(m=>m.from+m.to+(m.promotion||''));
  assert(legal.length>0&&legal.length<10);const x=await fixture(t),{done,w}=await x.start({fen,multiPV:10});
  legal.forEach((pv,i)=>w.info(i+1,3,pv));w.finish(legal[0]);const s=await done;assert.equal(s.expectedLines,legal.length);assert.equal(s.completeMultiPV,true);
});
test('stop between iterations retains verified evidence and a superseded worker never publishes into its successor',async t=>{
  const x=await fixture(t),first=await x.start();set(first.w,8);first.w.info(1,9,'b1c3');x.engine.stop();const stopped=await first.done;
  assert.equal(stopped.stopped,true);assert.equal(stopped.linesDepth,8);assert.equal(first.w.terminated,true);
  const next=await x.start({fen:BLACK,multiPV:1}),count=x.snapshots.length;set(first.w,99);assert.equal(x.snapshots.length,count);
  next.w.info(1,6,'d7d5');next.w.finish('d7d5');assert.equal((await next.done).fen,BLACK);
  const old=await x.start(),newer=await x.start({fen:BLACK,multiPV:1});await assert.rejects(old.done,{name:'AbortError'});
  const before=x.snapshots.length;set(old.w,99);assert.equal(x.snapshots.length,before);newer.w.info(1,5,'g8f6');newer.w.finish('g8f6');await newer.done;
});
test('without a chess validator legality stays unverified and no comparable set is invented',async t=>{
  const x=await fixture(t,{Chess:null}),{done,w}=await x.start({multiPV:1});w.info(1,8,'e2e4');w.finish();const s=await done;
  assert.equal(s.completeMultiPV,false);assert.equal(s.coverage.status,'unvalidated');assert.deepEqual(s.lines,[]);assert.equal(s.nativeLines.length,1);
});
test('nonfinite scores and invalid ranks cannot become verified candidates',async t=>{
  const x=await fixture(t),{done,w}=await x.start({multiPV:1});
  for(const rank of [0,-1,2,1.5])w.info(rank,8,'e2e4');w.info(1,9,'e2e4',Infinity);w.finish();const s=await done;
  assert.equal(s.completeMultiPV,false);assert.deepEqual(s.lines,[]);
});
test('late info carrying an earlier request ID is ignored even when the prepared worker is reused',async t=>{
  const x=await fixture(t),first=await x.start({multiPV:1});first.w.info(1,6,'e2e4');const oldId=first.w.search.requestId;first.w.finish();await first.done;
  const next=await x.start({fen:BLACK,multiPV:1});assert.equal(x.workers.length,1);const count=x.snapshots.length;
  next.w.emit({type:'info',requestId:oldId,info:{multiPv:1,depth:99,scoreCp:400,pv:['d7d5']}});assert.equal(x.snapshots.length,count);
  next.w.info(1,5,'g8f6');next.w.finish('g8f6');const s=await next.done;assert.equal(s.linesDepth,5);assert.equal(s.bestMove,'g8f6');
});
test('mixed depths and rank events before rank 1 cannot form a completed sweep',async t=>{
  const x=await fixture(t),{done,w}=await x.start();
  w.info(1,7,'e2e4');w.info(2,8,'d2d4');w.info(3,8,'g1f3');w.info(1,7,'b1c3');assert.equal(x.snapshots.at(-1).completeMultiPV,false);
  w.info(1,8,'e2e4');assert.equal(x.snapshots.at(-1).completeMultiPV,false,'rank 1 starts a fresh sweep');
  w.info(3,8,'g1f3');w.info(2,8,'d2d4');w.finish();assert.equal((await done).completeMultiPV,true);
});
test('a failed root restriction never degrades to an unrestricted standalone Reckless search',async t=>{
  const x=await fixture(t),pending=x.engine.analyze({fen:START,movetime:10,searchMoves:['e2e4']});pending.catch(()=>{});await tick();
  assert.equal(x.workers.length,0,'an unsupported request cannot instantiate a native search');await assert.rejects(pending,/does not support restricted root moves/);
});
