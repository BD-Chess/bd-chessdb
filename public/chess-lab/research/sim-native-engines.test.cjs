const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const { Chess } = require('../js/chess.min.js');
const SIM = require('../js/8zc-sim-core.js');
const T = require('../js/8zc-tournament-core.js');
const Runner = require('../js/8zc-sim-runner.js');
const Eval = require('../js/8zc-eval-bar.js');
const Store = require('../js/8zc-sim-store.js');
const flush = () => new Promise(resolve => setImmediate(resolve));
const uci = m => m.from + m.to + (m.promotion || '');
const moves = fen => new Chess(fen).moves({verbose:true}).map(uci);
function result(fen, mode, score) {
  return {fen,engine:{id:mode+'-fixture',name:SIM.label(mode)},model:mode==='lc0'?'Maia 1900':undefined,
    bestMove:moves(fen)[0],nodes:9,visits:mode==='lc0'?9:undefined,depth:mode==='lc0'?undefined:4,
    lines:[{multipv:1,pv:[moves(fen)[0]],depth:4,score:score || {type:'cp',root:20,white:fen.split(' ')[1]==='b'?-20:20,bound:'exact'}}]};
}
function storage() { const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)}; }
function harness(t, mode, extra={}) {
  const game=new Chess(),runs=new Map(),events=new Map(),calls=[],errors=[];let serial=0,runner;
  const clock=()=>({mode:'elapsed',remaining:{w:0,b:0},used:{w:0,b:0},turnSpent:3,flagged:null});
  const workspace={start(){},restoreClock(){},beginTurn(){},endTurn:clock,clockSnapshot:clock,
    recordMove:()=>({think_ms:3,after:clock(),at_utc:new Date().toISOString()})};
  const store={createId:p=>p+(++serial),ready:async()=>{},saveRun:async r=>runs.set(r.id,structuredClone(r)),
    saveEvent:async e=>events.set(e.id,structuredClone(e)),getRun:async id=>runs.get(id),getEvent:async id=>events.get(id)};
  const Session={backendFor(actual){assert.equal(actual,mode);return {create(){return {prepare:async()=>{},destroy(){},
    async analyze(opts){calls.push(opts);return extra.analyze?extra.analyze(opts):result(opts.fen,mode,mode==='lc0'?{type:'q',root:.2,white:game.turn()==='b'?-.2:.2,wdl:[.3,.6,.1],wdlWhite:game.turn()==='b'?[.1,.6,.3]:[.3,.6,.1]}:null);}};}};}};
  runner=Runner.create({Chess,SIM,Tournament:T,Session,game,workspace,store,storage:storage(),settings:()=>({showSimEval:false}),
    SF:{create(){throw Error('A native policy must never substitute Stockfish');}},DCC:{config:()=>({}),play:(g,m)=>g.move({from:m.slice(0,2),to:m.slice(2,4),promotion:m[4]})},
    getCDB(){throw Error('Native actor must not request CDB');},callbacks:{error:e=>errors.push(e),move(run){if(run.trace.length===4)void runner.pause('bounded fixture');}},evaluation:null});
  t.after(async()=>{await runner.pause();await runner.settled();});
  return {runner,game,runs,events,calls,errors,start:cfg=>runner.start({format:'single',white:mode,black:mode,limitMode:'move-time',moveTimeMs:1000,movePauseMs:0,...cfg},[{id:'start',startFen:game.fen()}])};
}
for(const mode of ['lc0','reckless','berserk']) test(mode+' actually plays both sides, preserves identity and resumes without SF/CDB substitution',async t=>{
  const h=harness(t,mode);const event=await h.start();await h.runner.settled();
  assert.deepEqual(h.errors,[]);assert.equal(h.calls.length,4);assert.equal(h.game.history().length,4);
  const run=[...h.runs.values()][0];assert.equal(run.white,mode);assert.equal(run.black,mode);
  assert(run.trace.every(p=>p.actual_provider===SIM.provider(mode)&&p.engine_id===mode+'-fixture'));
  assert(h.calls.every(c=>c.multiPV===1&&c.movetime>0&&c.movetime<=1000&&c.history.moves.length>=0));
  const pgn=SIM.toPGN(Chess,run);assert(pgn.includes('[White "'+SIM.label(mode)+'"]'));
  const parsed=new Chess();assert(parsed.load_pgn(pgn));assert.equal(parsed.fen(),h.game.fen());
  if(mode==='lc0'){assert(run.trace.every(p=>p.raw_best_score===null&&p.native_q===.2));assert(pgn.includes('raw_q=0.2'));assert.equal(run.trace[1].native_score.white,-.2);}
  await h.runner.resume(event.id);await flush();await h.runner.pause('resume bound');await h.runner.settled();
  assert.equal([...h.runs.values()][0].white,mode);assert.deepEqual(h.errors,[]);
});
test('LC0 unsupported limits fail before an event is written',async t=>{
  const h=harness(t,'lc0');await assert.rejects(h.start({limitMode:'depth'}),/Time per move/);
  await assert.rejects(h.start({limitMode:'nodes'}),/Time per move/);assert.equal(h.events.size,0);assert.equal(h.calls.length,0);
});
test('pause discards late native search results without committing a move',async t=>{
  let finish;const h=harness(t,'reckless',{analyze:opts=>new Promise(resolve=>{finish=()=>resolve(result(opts.fen,'reckless'));})});
  await h.start();for(let i=0;i<100&&!finish;i++)await flush();assert.equal(typeof finish,'function','native adapter must own the search');await h.runner.pause();finish();await h.runner.settled();assert.equal(h.game.history().length,0);
});
test('native bestmove is honored independently of older retained MultiPV and carries its actual bound',()=>{
  const fen=new Chess().fen(),[a,b]=moves(fen),s=result(fen,'reckless');s.bestMove=a;s.nativeBestMove=b;
  s.nativeLines=[{pv:[b],score:{type:'cp',root:13,white:13,bound:'upper'}}];
  const p=SIM.engineDecision(Chess,fen,'reckless',s);assert.equal(p.move,b);assert.equal(p.raw_best_score,13);assert.equal(p.score_bound,'upper');
  assert.equal(SIM.scoreText(p),'≤+13 cp');
});
test('unscored native bestmove is unknown, illegal bestmove and mismatched FEN are rejected',()=>{
  const fen=new Chess().fen(),s=result(fen,'berserk');s.lines=[];
  const p=SIM.engineDecision(Chess,fen,'berserk',s);assert.equal(p.score_type,'unknown');assert.equal(p.raw_best_score,null);assert.equal(SIM.scoreText(p),'unknown');
  assert.equal(SIM.engineDecision(Chess,fen,'berserk',{...s,bestMove:'a1a8'}),null);
  assert.equal(SIM.engineDecision(Chess,fen,'berserk',{...s,fen:fen.replace(' w ',' b ')}),null);
});
test('seven explicitly selected engines get every pairing, while legacy default remains four',()=>{
  const opening=[{id:'start',startFen:new Chess().fen()}];assert.equal(T.createSchedule({format:'round-robin'},opening).length,12);
  const games=T.createSchedule({format:'round-robin',engines:SIM.ENGINES},opening);assert.equal(games.length,42);
  for(const mode of SIM.ENGINES)assert.equal(games.filter(g=>g.white===mode).length,6);
  assert.equal(T.standings([{white:'lc0',black:'berserk',state:'complete',result:'1-0'}])[0].label,'LCZero');
});
test('neural native payload survives actual Sim archive export/import',async()=>{
  const fen=new Chess().fen(),p=SIM.engineDecision(Chess,fen,'lc0',result(fen,'lc0',{type:'q',root:.2,white:.2,wdl:[.3,.6,.1],wdlWhite:[.3,.6,.1]}));
  const a=Store.create({namespace:'native-test-a',indexedDB:null,localStorage:storage()});await a.saveRun({id:'run',white:'lc0',black:'berserk',trace:[p]});
  const text=await a.exportJSON(),b=Store.create({namespace:'native-test-b',indexedDB:null,localStorage:storage()});await b.importJSON(typeof text==='string'?text:JSON.stringify(text));
  const saved=(await b.listRuns())[0];assert.deepEqual(saved.trace[0].native_score,p.native_score);assert.equal(saved.white,'lc0');assert.equal(saved.trace[0].raw_best_score,null);
});
test('Sim evaluation toggle stops spectator work; reenabling rejects old same-FEN response and paints native Black Q',async()=>{
  const game=new Chess();game.move('d4');let enabled=false,resolveOld;const requests=[],paint=[];
  const view={render(){},markComparisonPending(){},updateSource(){},update:(fen,score,source)=>paint.push({fen,score,source})};
  const w=Eval.watchSimulation({Chess,game,view,enabled:()=>enabled,getCDB:fen=>new Promise(resolve=>{requests.push(fen);resolveOld=resolve;})});
  w.start();assert.equal(requests.length,0);enabled=true;w.refresh();assert.equal(requests.length,1);
  const old=resolveOld;enabled=false;w.refresh();old({moves:[{move:moves(game.fen())[0],score:900}]});await flush();assert.equal(paint.length,0);
  enabled=true;w.refresh();assert.equal(requests.length,2);
  const pick=SIM.engineDecision(Chess,game.fen(),'lc0',result(game.fen(),'lc0',{type:'q',root:.2,white:-.2,wdl:[.3,.6,.1],wdlWhite:[.1,.6,.3]}));
  w.decision({fen:game.fen(),pick});assert.equal(paint.at(-1).source,'LC0');assert.equal(paint.at(-1).score.white,-.2);
  assert.equal(Eval.measure(game.fen(),paint.at(-1).score,null,'LC0').neural.cp,-44);w.stop();
});
test('both Sim selectors expose all engines and LC0 switches to an honest supported time limit',t=>{
  const dom=new JSDOM('<body></body>',{runScripts:'outside-only'});t.after(()=>dom.window.close());
  dom.window.eval(fs.readFileSync(require.resolve('../js/8zc-tournament-ui.js'),'utf8'));
  dom.window.ChessTournamentUI.create({});const d=dom.window.document.getElementById('simTournamentDialog');
  const select=n=>d.querySelector('[data-ui="'+n+'"]');
  assert.deepEqual([...select('white').options].map(o=>o.value),[...SIM.ENGINES]);assert.equal(select('black').options.length,7);
  select('white').value='lc0';select('white').dispatchEvent(new dom.window.Event('change',{bubbles:true}));
  assert.equal(select('limit-mode').value,'move-time');assert(select('limit-mode').querySelector('[value="depth"]').disabled);
  select('white').value='reckless';select('white').dispatchEvent(new dom.window.Event('change',{bubbles:true}));assert(!select('limit-mode').querySelector('[value="depth"]').disabled);
});
