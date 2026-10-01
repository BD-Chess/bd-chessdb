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
test('public frozen adjudication accepts exact UCI zero and fails closed on bounds or mate',async()=>{
  const lines=[Deep.parseInfo('info depth 20 nodes 10000 score cp 0 pv e2e4 e7e5',fen),
    Deep.parseInfo('info depth 20 nodes 10000 multipv 2 score cp -12 pv d2d4 d7d5',fen),
    Deep.parseInfo('info depth 20 nodes 10000 multipv 3 score cp 100 lowerbound pv c2c4 e7e5',fen),
    Deep.parseInfo('info depth 20 nodes 10000 multipv 4 score mate 3 pv g1f3 g8f6',fen)];
  const result={kind:'frozen-query-comparison',fen,rows:['e2e4','d2d4'].map(move=>({move}))};
  const engine={async analyze(){return {fen,completeMultiPV:true,lines:lines.slice(0,2)};}};
  const judged=await B.adjudicateFrozen({engine,result});
  assert.equal(judged.rows[0].adjudication.scoreCp,0);assert.equal(judged.rows[1].adjudication.lossToBestObservedCp,12);
  for(const line of lines.slice(2))await assert.rejects(B.adjudicateFrozen({engine:{async analyze(){return {fen,completeMultiPV:true,lines:[line]};}},
    result:{...result,rows:[{move:line.pv[0]}]}}),/exact finite centipawn/);
  assert.equal(B.compareMetrics,undefined);
});
test('frozen CDB choices get a separate targeted engine assessment without erasing source incompleteness',async()=>{
  const result=await B.runFrozen({Chess,DCC,Evidence:E,snapshot:rootOnly(),budget:20});let request;
  const engine={async analyze(options){request=options;return{fen:options.fen,completeMultiPV:true,nodes:1000000,lines:options.searchMoves.map((move,i)=>({multipv:i+1,pv:[move],score:{type:'cp',root:0,bound:'exact'}}))};}};
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
function exactLine(move,value=0){return {pv:[move],score:{type:'cp',root:value,bound:'exact'}};}
function frozenSelection(moves=['e2e4','d2d4']){return {kind:'frozen-query-comparison',fen,rows:moves.map(move=>({move}))};}
test('frozen adjudication rejects partial, outsider, duplicate and aliased evidence identities',async()=>{
  const valid={fen,completeMultiPV:true,lines:[exactLine('e2e4'),exactLine('d2d4')]};
  const cases=[{...valid,completeMultiPV:false},{...valid,lines:valid.lines.slice(0,1)},
    {...valid,lines:[...valid.lines,exactLine('c2c4')]},
    {...valid,lines:[exactLine('e2e4'),exactLine('c2c4')]},
    {...valid,lines:[exactLine('e2e4'),exactLine('e2e4')]},
    {...valid,lines:[{...exactLine('e2e4'),move:'c2c4'},exactLine('d2d4')]}];
  for(const evidence of cases)await assert.rejects(B.adjudicateFrozen({result:frozenSelection(),engine:{async analyze(){return evidence;}}}),/scope mismatch/);
});
test('every FEN field is bound; missing context and non-exact score metadata fail closed',async()=>{
  const replacements=['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBKQBNR','b','-','e3','1','2'];
  for(let i=0;i<6;i++){
    const parts=fen.split(' ');parts[i]=replacements[i];
    await assert.rejects(B.adjudicateFrozen({result:frozenSelection(['e2e4']),engine:{async analyze(){return {fen:parts.join(' '),completeMultiPV:true,lines:[exactLine('e2e4')]};}}}),/FEN context mismatch/);
  }
  await assert.rejects(B.adjudicateFrozen({result:frozenSelection(['e2e4']),engine:{async analyze(){return {completeMultiPV:true,lines:[exactLine('e2e4')]};}}}),/six-field FEN/);
  for(const score of [{type:'cp',root:0},{type:'cp',root:NaN,bound:'exact'},{type:'cp',root:'0',bound:'exact'}])
    await assert.rejects(B.adjudicateFrozen({result:frozenSelection(['e2e4']),engine:{async analyze(){return {fen,completeMultiPV:true,lines:[{pv:['e2e4'],score}]};}}}),/exact finite centipawn/);
});
test('frozen selection and primitive scores are detached from provider mutations and read once',async()=>{
  const result=frozenSelection(['e2e4','e2e4','d2d4']);let reads=0;
  const evidence={fen,completeMultiPV:true,lines:[{pv:['e2e4'],score:{type:'cp',bound:'exact',get root(){reads++;return reads===1?0:999;}}},exactLine('d2d4',-12)]};
  const judged=await B.adjudicateFrozen({result,engine:{async analyze(options){
    result.fen=fen.replace(' w ',' b ');result.rows[0].move='c2c4';options.searchMoves[0]='h2h4';return evidence;
  }}});
  assert.equal(reads,1);assert.equal(judged.fen,fen);
  assert.deepEqual(judged.adjudication.rootMoves,['e2e4','d2d4']);
  assert.deepEqual(judged.rows.map(row=>[row.move,row.adjudication.scoreCp,row.adjudication.lossToBestObservedCp]),[['e2e4',0,0],['e2e4',0,0],['d2d4',-12,12]]);
  evidence.lines[1].score.root=500;assert.equal(judged.rows[2].adjudication.scoreCp,-12);
});
test('live adjudication covers bounded discovery roots before filtering and best includes unselected roots',async()=>{
  for(const omitBounded of [true,false]){
    let calls=0,assessment;
    const engine={async analyze(options){
      calls++;
      if(calls===1)return {fen:options.fen,completeMultiPV:true,nodes:options.nodes,lines:[exactLine('g1f3',20)]};
      if(calls===2)return {fen:options.fen,completeMultiPV:true,nodes:options.nodes,lines:[
        {...exactLine('e2e4',20),multipv:1},
        {...exactLine('d2d4',15),multipv:2,score:{type:'cp',root:15,bound:'lower'}},
        {...exactLine('c2c4',0),multipv:3}]};
      if(options.searchMoves){
        assessment=options.searchMoves.slice();
        return {fen:options.fen,completeMultiPV:true,nodes:options.nodes,lines:options.searchMoves.filter(move=>!omitBounded||move!=='d2d4').map(move=>exactLine(move,move==='d2d4'?100:0))};
      }
      // Stop after the first continuation: keep the discovered e2e4 choice.
      return {fen:options.fen,completeMultiPV:true,nodes:options.nodes,lines:[exactLine('e7e5')],bestMove:null};
    }};
    const run=B.runEngineComparison({Chess,DCC,engine,fen,candidates:3,nodeBudget:10000,adjudicationNodes:100000});
    if(omitBounded)await assert.rejects(run,/scope mismatch/);
    else{
      const report=await run;
      assert.deepEqual(report.rows.map(row=>row.move),['g1f3','e2e4']);
      assert.deepEqual(report.rows.map(row=>row.adjudication.lossToBestObservedCp),[100,100]);
      assert(report.rows.every(row=>row.adjudication.scoreCp===0));
    }
    assert.deepEqual(assessment,['g1f3','e2e4','d2d4','c2c4']);
  }
});
