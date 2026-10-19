const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Chess}=require('../js/chess.min.js');
const C=require('../js/8zc-cdb-start.js');
const T=require('../js/8zc-tournament-core.js');
const SIM=require('../js/8zc-sim-core.js');
const Time=require('../js/8zc-time-core.js');
const DCC=require('../js/8zc-dcc-core.js');
const Runner=require('../js/8zc-sim-runner.js');
const Store=require('../js/8zc-sim-store.js');
const DATA=require('../js/8zc-data-core.js');
const uci=m=>m.from+m.to+(m.promotion||'');
const copy=v=>JSON.parse(JSON.stringify(v));
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(first='e4',length=60) {
  const board=new Chess(),rows=new Map(),seen=new Set([board.fen().split(' ').slice(0,4).join(' ')]),draw=C.random('nonterminal-fixture');
  for(let i=0;i<length;i++) {
    const fen=board.fen(),moves=board.moves({verbose:true}).filter(m=>{
      const b=new Chess(fen);b.move(m);return !b.game_over()&&!seen.has(b.fen().split(' ').slice(0,4).join(' '));
    });
    const move=i ? moves[Math.floor(draw()*moves.length)] : moves.find(m=>m.san===first);assert(move);
    rows.set(fen,[{move:uci(move),score:20,rank:0,sourceOrder:0}]);board.move(move);seen.add(board.fen().split(' ').slice(0,4).join(' '));
  }
  return async(fen,opts)=>{opts.requestBudget?.take();opts.requestBudget?.take();return {fen,moves:copy(rows.get(fen)||[]),provider:'CDB'};};
}
for(const moves of [1,8,30])for(const mode of ['e4','d4'])test(`CDB ${mode} X${moves}: exact plies, mover POV and PGN history`,async()=>{
  const b=C.budget(),o=await C.prepare({Chess,getCDB:fixture(mode),seed:'known',input:{cdbStartMoves:moves,cdbStartMode:mode},requestBudget:b});
  assert.equal(o.history.length,2*moves);assert.equal(o.history[0],mode==='e4'?'e2e4':'d2d4');assert.equal(o.startFen.split(' ')[1],'w');assert.equal(+o.startFen.split(' ')[5],moves+1);
  const g=new Chess();assert(g.load_pgn(o.startPgn));assert.equal(g.fen(),o.startFen);assert.equal(b.attempts,4*moves);assert(o.cdbStart.complete);assert.match(o.cdbStart.sha256,/^[a-f0-9]{64}$/);
  assert(o.cdbStart.observations.every(r=>r.candidates[0].score===20));
});
test('seeded choices are repeatable, varied and use disjoint entry classes',async()=>{
  const getCDB=async fen=>({fen,moves:new Chess(fen).moves({verbose:true}).map((m,i)=>({move:uci(m),score:20,rank:0,sourceOrder:i}))});
  for(const mode of ['random_main','random_side']) {
    const starts=new Set();
    for(let seed=0;seed<24;seed++) {
      const opts={Chess,getCDB,seed,input:{cdbStartMode:mode,cdbStartMoves:1}},a=await C.prepare(opts),b=await C.prepare(opts);
      assert.deepEqual(a.history,b.history);assert.equal(a.id,b.id);assert(C.MODES[mode].includes(a.history[0]));starts.add(a.history[0]);
    }
    assert(starts.size>=3);
  }
});
test('root score/rank/source order are preserved; illegal, unknown and losing entries excluded',async()=>{
  const fen=new Chess().fen(),rows=C.candidates(Chess,fen,{fen,moves:[{move:'a1a8',score:999},{move:'e2e4',score:null},{move:'d2d4',score:10,rank:1,sourceOrder:2},{move:'c2c4',score:10,rank:1,sourceOrder:1},{move:'g1f3',score:-200,rank:0}]});
  assert.deepEqual(rows.map(r=>r.move),['c2c4','d2d4','g1f3']);
  const o=await C.prepare({Chess,seed:1,input:{cdbStartMode:'e4'},getCDB:async()=>({moves:[{move:'e2e4',score:-200}]})});assert.equal(o.openingPlies,0);assert(!o.cdbStart.complete);
  assert.deepEqual(C.candidates(Chess,fen,{fen:'wrong',moves:rows}),[]);
});
for(const side of ['w','b'])test('typed mate is excluded without centipawn conversion on '+side,async()=>{
  let calls=0;const o=await C.prepare({Chess,seed:1,input:{cdbStartMode:'e4'},getCDB:async fen=>({fen,moves:++calls===(side==='w'?1:2)?[{move:new Chess(fen).moves({verbose:true}).map(uci)[0],score:29973,scoreType:'mate',mateIn:27}]:[{move:'e2e4',score:20}]})});
  assert.equal(o.openingPlies,side==='w'?0:1);assert.match(o.cdbStart.reason,/mate/);
});
test('OFF and global CDB disable make no prefix requests; old preferences remain valid',async()=>{
  for(const options of [{input:{cdbStartOn:false}},{input:{cdbStartOn:false,cdbStartMoves:0}},{enabled:()=>false}]) {
    const o=await C.prepare({Chess,getCDB:()=>{throw Error('must not query');},seed:1,...options});assert.equal(o.openingPlies,0);assert(!o.cdbStart.complete);
  }
  const deps={Chess,Study:require('../js/8zc-study-core.js'),StudyStore:require('../js/8zc-study-store.js'),Evidence:require('../js/8zc-evidence.js'),Sim:Store};
  for(const settings of [{},{cdbStartOn:false,cdbStartMoves:30,cdbStartMode:'random_side'}]) {
    const p=DATA.empty();p.preferences.settings=settings;
    const packed=await DATA.pack(p,{channel:'LAB',release:'fixture'},deps);assert.deepEqual((await DATA.parse(JSON.stringify(packed),deps)).payload.preferences.settings,settings);
  }
  for(const settings of [{cdbStartMoves:0},{cdbStartMoves:8.5},{cdbStartMoves:31},{cdbStartMode:'bad'},{cdbStartOn:'yes'}]) {
    const p=DATA.empty();p.preferences.settings=settings;await assert.rejects(DATA.pack(p,{channel:'LAB',release:'fixture'},deps));
  }
});
test('unknown, 429, timeout, terminal and repetition have bounded, honest outcomes',async()=>{
  for(const value of ['unknown','HTTP 429','timeout']) {
    let calls=0;const o=await C.prepare({Chess,seed:1,timeoutMs:1,getCDB:async()=>{calls++;if(value==='HTTP 429')throw Error(value);if(value==='timeout')return new Promise(()=>{});return {moves:[],reason:value};}});
    assert.equal(calls,2);assert.equal(o.openingPlies,0);assert(!o.cdbStart.complete);
  }
  for(const [first,line,reason] of [['e4',['e4','e5','Qh5','Nc6','Bc4','Nf6','Qxf7#'],/Terminal/],['Nf3',['Nf3','Nf6','Ng1','Ng8'],/repeating/]]) {
    const b=new Chess(),map=new Map();for(const m of line){const fen=b.fen();map.set(fen,[{move:uci(b.move(m)),score:0}]);}
    const o=await C.prepare({Chess,seed:1,input:{cdbStartMode:first==='e4'?'e4':'random_main'},getCDB:async fen=>({moves:map.get(fen)})});
    assert.equal(o.openingPlies,line.length-1);assert.match(o.cdbStart.reason,reason);assert(!new Chess(o.startFen).game_over());
  }
  const budget=C.budget(3);const o=await C.prepare({Chess,seed:1,getCDB:fixture(),requestBudget:budget,input:{cdbStartMode:'e4'}});
  assert.equal(budget.attempts,3);assert(!o.cdbStart.complete);
});
let harnessCounter=0;
function harness(t,options={}) {
  const harnessId=++harnessCounter;
  const game=new Chess(),events=new Map(),runs=new Map(),calls=[],errors=[];let serial=0,wall=0,runner,clock=Time.create({running:false});
  const store={createId:p=>p+'-'+harnessId+'-'+(++serial),ready:async()=>{},saveRun:async r=>runs.set(r.id,copy(r)),saveEvent:async e=>{if(options.quota)throw Error('quota');events.set(e.id,copy(e));},getRun:async id=>copy(runs.get(id)),getEvent:async id=>copy(events.get(id))};
  const workspace={start(_mode,cfg={}){clock=Time.create({mode:'countdown',seconds:(cfg.baseMs||60000)/1000,increment:2,turn:game.turn(),running:false,now:wall});},restoreClock(v){clock=Time.restore(v,wall);},beginTurn(){Time.resume(clock,wall);},endTurn(){Time.pause(clock,wall);return Time.snapshot(clock,wall);},clockSnapshot(){return Time.snapshot(clock,wall);},recordMove(fen,m){return Time.move(clock,m.color,game.turn(),wall,new Date().toISOString(),{allowPaused:true,pauseAfter:true});}};
  const sf={create(){calls.push({type:'engine'});return {prepare:async()=>{},destroy(){},analyzeDCC:async(fen,root)=>({dcc1Move:root.moves[0].move,candidates:[],receipt:{fen,provider:'SF',status:'complete'}}),root:async fen=>{wall+=10;return {complete:true,moves:[{move:uci(new Chess(fen).moves({verbose:true})[0]),score:0}]};}};}};
  const data=new Map(),storage=options.storage||{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const fixtureCDB=fixture();
  runner=Runner.create({Chess,SIM,Tournament:T,CDBStart:C,SF:sf,DCC,game,workspace,store,storage,evaluation:null,settings:()=>({cdbEnabled:true}),now:()=>wall,
    getCDB:async(fen,opts)=>{calls.push({type:'prefix',fen});wall+=500;return options.getCDB?options.getCDB(fen,opts):fixtureCDB(fen,opts);},
    callbacks:{error:e=>errors.push(e.message),move:()=>{void runner.pause('bounded fixture');},...options.callbacks}});
  t.after(async()=>{await runner.pause();try{await runner.settled();}catch(_){};});
  return {runner,game,events,runs,calls,errors,store,workspace};
}
test('real runner prepares before engines, freezes color pair, full clocks and PGN survive resume',async t=>{
  const h=harness(t),event=await h.runner.start({format:'duel',white:'sf',black:'sf-dcc',openingSource:'cdb',openingCount:1,cdbStartMode:'e4',cdbStartMoves:8,limitMode:'game-time',baseMs:60000,incrementMs:2000});
  await h.runner.settled();assert.deepEqual(h.errors,[]);
  const e=h.events.get(event.id),a=e.games[0].opening,b=e.games[1].opening;assert.deepEqual(a,b);assert.equal(a.openingPlies,16);
  assert.equal(h.calls.findIndex(r=>r.type==='engine'),16);
  let r=[...h.runs.values()][0];assert.equal(r.trace[0].clock_before_ms,60000);assert.equal(r.trace[0].root_ply,16);assert.equal(r.trace[0].game_ply,17);assert.equal(r.trace.length,1);
  let pgn=SIM.toPGN(Chess,r),probe=new Chess();assert(probe.load_pgn(pgn));assert.equal(probe.history().length,17);assert.match(pgn,/BookBoundaryPly "16"/);assert.match(pgn,/CDBStartSeed/);
  const count=h.calls.filter(r=>r.type==='prefix').length;await h.runner.resume(event.id);await h.runner.settled();assert.equal(h.calls.filter(r=>r.type==='prefix').length,count);
  r=[...h.runs.values()][0];assert.equal(r.trace.length,2);assert.equal(r.opening.cdbStart.sha256,a.cdbStart.sha256);
  Store.validate({schema:'chess-sim-archive',version:1,events:[...h.events.values()],runs:[...h.runs.values()]});
});
test('Stop and new Start discard a late prefix without board writes or a stuck busy flag',async t=>{
  let release;const h=harness(t,{getCDB:()=>new Promise(r=>release=r)}),before=h.game.fen();
  const started=h.runner.start({format:'single',openingSource:'cdb',cdbStartMoves:8});assert(h.runner.busy());
  while(!release)await tick();await h.runner.pause();await assert.rejects(started,{name:'AbortError'});assert(!h.runner.busy());
  h.game.move('d4');release({moves:[{move:'e2e4',score:20}]});await tick();assert.equal(h.game.history().length,1);assert.notEqual(h.game.fen(),before);assert.equal(h.events.size,0);assert.equal(h.calls.filter(c=>c.type==='engine').length,0);
});
test('preparation reserves the shared tab lease before requests; quota failure never changes board',async t=>{
  const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
  let release;const a=harness(t,{storage,getCDB:()=>new Promise(r=>release=r)}),b=harness(t,{storage});
  const pending=a.runner.start({openingSource:'cdb'});while(!release)await tick();
  await assert.rejects(b.runner.start({openingSource:'cdb'}),/another tab/);assert.equal(b.calls.length,0);
  await a.runner.pause();await assert.rejects(pending,{name:'AbortError'});assert.equal(map.size,0);
  const q=harness(t,{quota:true});const before=q.game.fen();
  await assert.rejects(q.runner.start({openingSource:'cdb',cdbStartOn:false,format:'single'}),/quota/);assert(!q.runner.busy());assert.equal(q.game.fen(),before);assert.equal(q.calls.length,0);
});
test('DATA freeze/generation change aborts preparation before any event or game mutation',async t=>{
  const previous=globalThis.ChessDataGuard;let frozen=false,release;
  globalThis.ChessDataGuard={epoch:'g-old',assertWritable(){if(frozen)throw Error('workspace changed');},key:k=>k};
  const h=harness(t,{getCDB:()=>new Promise(r=>release=r)});t.after(()=>globalThis.ChessDataGuard=previous);
  const pending=h.runner.start({openingSource:'cdb'});while(!release)await tick();frozen=true;release({moves:[{move:'e2e4',score:20}]});
  await assert.rejects(pending,/workspace changed/);assert.equal(h.events.size,0);assert.equal(h.game.history().length,0);assert(!h.runner.busy());
});
test('lease persistence failure at engine handover reaches idle without changing the loaded board',async t=>{
  let writes=0,preparing=false,idle=false;const map=new Map();
  const storage={getItem:k=>map.get(k)||null,removeItem:k=>map.delete(k),setItem(k,v){if(++writes===2)throw Error('lease quota at handover');map.set(k,v);}};
  const h=harness(t,{storage,callbacks:{preparing(){preparing=true;},idle(){preparing=false;idle=true;}}});
  await h.runner.start({format:'single',white:'sf',black:'sf',openingSource:'cdb',cdbStartOn:false});await h.runner.settled();
  assert.equal(h.game.history().length,0);assert(!h.runner.busy());assert.equal(preparing,false);assert.equal(idle,true);assert.equal(map.size,0);assert.match(h.errors[0],/lease quota/);
  assert.match([...h.events.values()][0].reason,/lease quota/);
});
