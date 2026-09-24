const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Chess}=require('../js/chess.min.js');
const DCC=require('../js/8zc-dcc-core.js');
const E=require('../js/8zc-evidence.js');
const B=require('../js/8zc-benchmark.js');
const Deep=require('../js/8zc-deep-engine.js');
const fen=new Chess().fen();
function rootOnly(){const c=E.createCollector();const moves=[{move:'e2e4',score:0,rank:1},{move:'d2d4',score:0,rank:2}];c.capture({kind:'moves',fen,response:{moves}});return c.snapshot({allMoves:moves,receipt:{fen}},{settings:{dccDepth:3,dccDefensePlies:2}});}
test('unobserved requests remain incomplete under the same allowance; root baseline does not pretend equal compute',async()=>{
  const result=await B.runFrozen({Chess,DCC,Evidence:E,snapshot:rootOnly(),budget:12});
  assert.equal(result.rows.length,10);assert.equal(result.rows[0].requests,0);assert.equal(result.rows[0].move,'e2e4');
  assert.ok(result.rows.slice(1).every(row=>row.requestAllowance===12&&!row.complete&&row.missingQueries.length>0));
  assert.equal(result.budget.externalEngineNodes,null);assert.match(result.budget.note,/not an equal-compute/);
});
test('frozen comparison is reproducible apart from report creation time',async()=>{
  const snapshot=rootOnly(),a=await B.runFrozen({Chess,DCC,Evidence:E,snapshot,budget:20}),b=await B.runFrozen({Chess,DCC,Evidence:E,snapshot,budget:20});
  delete a.createdAt;delete b.createdAt;assert.deepEqual(a,b);
});
test('committed synthetic fixtures contain the union of all policy queries and reproduce fully',async()=>{
  const fixtures=require('./benchmark-fixtures.json');
  assert.match(fixtures.notice,/Synthetic/);
  for(const snapshot of fixtures.fixtures){
    const result=await B.runFrozen({Chess,DCC,Evidence:E,snapshot,budget:120});
    assert.ok(result.rows.every(row=>row.complete));
    assert.ok(result.rows.every(row=>row.requestAllowance===120));
    assert.ok(result.rows.slice(1).every(row=>row.requests>0&&row.requests<=120));
  }
});
test('adjudication accepts actual exact UCI scores including zero, rejects bounds and mate-as-cp',()=>{
  const lines=[Deep.parseInfo('info depth 20 nodes 10000 score cp 0 pv e2e4 e7e5',fen),
    Deep.parseInfo('info depth 20 nodes 10000 multipv 2 score cp -12 pv d2d4 d7d5',fen),
    Deep.parseInfo('info depth 20 nodes 10000 multipv 3 score cp 100 lowerbound pv c2c4 e7e5',fen),
    Deep.parseInfo('info depth 20 nodes 10000 multipv 4 score mate 3 pv g1f3 g8f6',fen)];
  const rows=B.compareMetrics(['e2e4','d2d4','c2c4','g1f3'].map(move=>({move})),{lines});
  assert.equal(rows[0].adjudication.scoreCp,0);assert.equal(rows[1].adjudication.lossToBestObservedCp,12);
  assert.equal(rows[2].adjudication,null);assert.equal(rows[3].adjudication,null);
});
test('frozen CDB choices get a separate targeted engine assessment without erasing source incompleteness',async()=>{
  const result=await B.runFrozen({Chess,DCC,Evidence:E,snapshot:rootOnly(),budget:20});let request;
  const engine={async analyze(options){request=options;return{completeMultiPV:true,nodes:1000000,lines:options.searchMoves.map((move,i)=>({multipv:i+1,pv:[move],score:{type:'cp',root:0,bound:'exact'}}))};}};
  const judged=await B.adjudicateFrozen({engine,result});
  assert.deepEqual(request.searchMoves,[...new Set(result.rows.map(r=>r.move))]);assert.equal(request.fen,fen);
  assert.equal(judged.adjudication.deeperThanCDB,null);assert.ok(judged.rows.every(r=>r.adjudication?.scoreCp===0));
  assert.ok(judged.rows.slice(1).every(r=>r.complete===false));
});
test('node experiment divides one total allowance and separately accounts adjudication, using exact engine scores',async()=>{
  const requests=[];
  const engine={async analyze(options){
    requests.push(options);const board=new Chess(options.fen),legal=board.moves({verbose:true}).map(m=>m.from+m.to+(m.promotion||''));
    const choices=options.searchMoves||legal.slice(0,options.multiPV),lines=choices.map((move,i)=>({multipv:i+1,depth:14,nodes:options.nodes,
      score:{type:'cp',root:0,value:0,bound:'exact'},pv:[move]}));
    return {engine:{name:'Mock fixture'},fen:options.fen,lines,bestMove:choices[0],nodes:options.nodes,limits:options,completeMultiPV:true};
  }};
  const report=await B.runEngineComparison({Chess,DCC,engine,fen,nodeBudget:10000,adjudicationNodes:100000,candidates:3});
  assert.equal(report.rows[0].nodes,10000);assert.equal(report.rows[1].nodeAllowance,10000);
  assert.ok(report.rows[1].nodes<=10000&&report.rows[1].nodes>9900);
  assert.equal(report.adjudication.nodes,100000);assert.ok(report.rows.every(r=>r.adjudication?.scoreCp===0));
  assert.ok(requests.every(r=>r.clearHash===true));assert.equal(requests.at(-1).nodes,100000);
});
test('mate or bounded top discovery score cannot silently become a lower-ranked cp candidate',async()=>{
  for(const topScore of [{type:'mate',root:5,value:5,bound:'exact'},{type:'cp',root:50,value:50,bound:'upper'}]){
    let call=0;const engine={async analyze(options){call++;return{completeMultiPV:true,nodes:options.nodes,lines:call===1?[{multipv:1,pv:['e2e4'],score:{type:'cp',root:30,bound:'exact'}}]:[
      {multipv:1,pv:['e2e4'],score:topScore},{multipv:2,pv:['d2d4'],score:{type:'cp',root:20,bound:'exact'}}]};}};
    await assert.rejects(B.runEngineComparison({Chess,DCC,engine,fen,candidates:2}),/top discovery score/);assert.equal(call,2);
  }
});
test('partial mixed-depth discovery is rejected before DCC ranking',async()=>{
  const engine={async analyze(options){return{completeMultiPV:false,nodes:options.nodes,lines:[{multipv:1,pv:['e2e4'],score:{type:'cp',root:30,bound:'exact'}}]};}};
  await assert.rejects(B.runEngineComparison({Chess,DCC,engine,fen}),/complete same-depth/);
});
test('aborted research does not launch an engine search',async()=>{
  const controller=new AbortController();controller.abort();let calls=0;
  await assert.rejects(B.runEngineComparison({Chess,DCC,engine:{analyze(){calls++;}},fen,signal:controller.signal}),{name:'AbortError'});
  assert.equal(calls,0);
});
