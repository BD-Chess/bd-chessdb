/* Research comparisons distinguish equal query allowances from equal engine work.
 * Frozen CDB replay never manufactures missing evidence or implies Elo gain. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.ChessBenchmark=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='1.0.1';
  const finite=v=>typeof v==='number'&&Number.isFinite(v);
  const exact=score=>score && (!score.bound || score.bound==='exact');
  const abort=()=>{const e=new Error('Research stopped.');e.name='AbortError';throw e;};
  const check=signal=>{if(signal?.aborted)abort();};
  function settingsFrom(snapshot){
    const raw=snapshot.payload.settings||{};
    return { ...raw,dccDepth:raw.dccDepth??raw.depth??5,dccTopCandidates:raw.dccTopCandidates??raw.candidates??3,
      dccEvalFloor:raw.dccEvalFloor??raw.window??80,evalMode:raw.evalMode??raw.source??'direct',dccNoDeadline:true };
  }
  function fenContext(fen){
    if(typeof fen!=='string'||/[\r\n]/.test(fen)||fen.trim().split(/\s+/).length!==6)
      throw new Error('Adjudication requires a complete six-field FEN context.');
    return 'fen6/v1:'+fen.trim().split(/\s+/).join(' ');
  }
  function decisionScope(fen,moves){
    if(!Array.isArray(moves)||!moves.length||moves.some(move=>typeof move!=='string'||!/^([a-h][1-8]){2}[qrbn]?$/.test(move)))
      throw new Error('Adjudication requires valid root move identities.');
    return Object.freeze({context:fenContext(fen),moves:Object.freeze([...new Set(moves)])});
  }
  // Only these two callers can create a certificate. Copy primitive evidence;
  // never retain a provider-owned Map, callback or mutable score object.
  function certify(scope,evidence){
    if(fenContext(evidence?.fen)!==scope.context)throw new Error('Adjudication FEN context mismatch.');
    const lines=evidence?.lines;
    if(evidence?.completeMultiPV!==true||!Array.isArray(lines)||lines.length!==scope.moves.length)
      throw new Error('Adjudication evidence scope mismatch: a complete root set is required.');
    const expected=new Set(scope.moves),seen=new Set(),scores=[];
    for(const line of lines){
      const move=line?.pv?.[0],alias=line?.move,score=line?.score;
      const type=score?.type,value=score?.root,bound=score?.bound;
      if(!expected.has(move)||seen.has(move)||(alias!=null&&alias!==move))
        throw new Error('Adjudication evidence scope mismatch: root identities must match exactly.');
      if(type!=='cp'||!finite(value)||bound!=='exact')
        throw new Error('Adjudication requires an exact finite centipawn score for every scoped root.');
      seen.add(move);scores.push(Object.freeze([move,value]));
    }
    return Object.freeze({context:scope.context,scores:Object.freeze(scores),best:Math.max(...scores.map(pair=>pair[1]))});
  }
  function projectMetrics(rows,certificate,fen){
    if(fenContext(fen)!==certificate.context)throw new Error('Adjudication FEN context mismatch.');
    const cp=new Map(certificate.scores);
    return rows.map(row=>{
      if(!cp.has(row.move))throw new Error('Adjudication consumer is outside the certified root scope.');
      return {...row,adjudication:{scoreCp:cp.get(row.move),lossToBestObservedCp:Math.max(0,certificate.best-cp.get(row.move)),
        scope:'Compared root moves only; deeper same-engine evidence, not ground truth.'}};
    });
  }
  async function runFrozen({Chess,DCC,Evidence,snapshot,budget=120,signal,onProgress=()=>{}}){
    Evidence.validate(snapshot);check(signal);
    budget=Math.max(1,Math.min(2000,Math.trunc(Number(budget)||120)));
    const fen=snapshot.payload.fen, source=Evidence.replay(snapshot), rootReply=source.peek('moves',fen);
    const moves=rootReply?.moves||snapshot.payload.analysis?.allMoves||[];
    if(!moves.length)throw new Error('Snapshot has no captured root candidate list.');
    const settings=settingsFrom(snapshot), common={...settings,dccRequestBudget:budget,dccNoDeadline:true};
    const variants=[
      {id:'legacy',label:'Legacy DCC policy',settings:{dccPolicy:'legacy',dccDefenseCheck:false,dccStructureMode:'rank',dccSensors:{}}},
      {id:'balanced',label:'Balanced DCC',settings:{dccPolicy:'balanced',dccDefenseCheck:true,dccStructureMode:'descriptive',dccSensors:{}}},
      {id:'no-sensors',label:'No sensors / no defense',settings:{dccPolicy:'balanced',dccDefenseCheck:false,dccStructureMode:'descriptive',dccSensors:{stability:false,floor:false,volatility:false,trend:false,structure:false}}},
      {id:'no-stability',label:'DCC without stability bonus',settings:{dccPolicy:'balanced',dccDefenseCheck:true,dccStructureMode:'descriptive',dccSensors:{stability:false}}},
      {id:'no-floor',label:'DCC without floor penalty',settings:{dccPolicy:'balanced',dccDefenseCheck:true,dccStructureMode:'descriptive',dccSensors:{floor:false}}},
      {id:'no-volatility',label:'DCC without volatility penalty',settings:{dccPolicy:'balanced',dccDefenseCheck:true,dccStructureMode:'descriptive',dccSensors:{volatility:false}}},
      {id:'no-trend',label:'DCC without trend bonus',settings:{dccPolicy:'balanced',dccDefenseCheck:true,dccStructureMode:'descriptive',dccSensors:{trend:false}}},
      {id:'no-structure',label:'Descriptive structure control',settings:{dccPolicy:'balanced',dccDefenseCheck:true,dccStructureMode:'descriptive',dccSensors:{structure:false}}},
      {id:'structure-rank',label:'DCC with structure ranking',settings:{dccPolicy:'balanced',dccDefenseCheck:true,dccStructureMode:'rank',dccSensors:{structure:true}}}
    ];
    const legal=DCC.legalMoves(Chess,fen,moves), raw=legal[0];
    if(!raw)throw new Error('Snapshot root candidates contain no legal scored move.');
    const rows=[{id:'raw',label:'Captured CDB top 1',move:raw.move,rawCp:raw.score,requests:0,requestAllowance:budget,
      coverage:'root only',missingQueries:[],complete:true,reason:'Uses the same captured root list; it does not spend the extra query allowance.'}];
    for(let i=0;i<variants.length;i++){
      check(signal);const variant=variants[i], replay=Evidence.replay(snapshot,{budget,mode:'frozen-last'});
      onProgress({done:i,total:variants.length,label:variant.label});
      const analysis=await DCC.analyze({Chess,fen,moves:legal,settings:{...common,...variant.settings},
        getMoves:replay.getMoves,getPV:replay.getPV,getScore:replay.getScore,cancelled:()=>signal?.aborted});
      check(signal);const stats=replay.stats();
      rows.push({id:variant.id,label:variant.label,move:analysis.dcc1Move,
        rawCp:legal.find(m=>m.move===analysis.dcc1Move)?.score??null,requests:stats.calls,requestAllowance:budget,
        coverage:analysis.receipt?.status||'unknown',complete:stats.complete&&analysis.receipt?.status==='complete',
        missingQueries:stats.misses,deniedQueries:stats.denied,reason:analysis.receipt?.reason||'',
        analysis, replay:stats});
    }
    onProgress({done:variants.length,total:variants.length,label:'Complete'});
    return {schema:'chess-benchmark/1',version:VERSION,kind:'frozen-query-comparison',snapshotId:snapshot.id,
      fen,createdAt:new Date().toISOString(),rootFrom:rootReply?'source-record':'captured-analysis',
      budget:{type:'logical provider query allowance',perPolicy:budget,externalEngineNodes:null,
        note:'Same maximum request allowance, reported actual calls. CDB server work is unknown; this is not an equal-compute strength test.'},
      rows,adjudication:null,conclusion:'Diagnostic replay only. Missing queries stay missing. No Elo or strength conclusion.'};
  }
  function normalizeScore(line,side,rootSide){
    if(line?.score?.type!=='cp'||!finite(line.score.root)||!exact(line.score))return null;
    return side===rootSide?line.score.root:-line.score.root;
  }
  function spent(result){return finite(result?.nodes)?result.nodes:null;}
  async function adjudicateFrozen({engine,result,nodes=1000000,signal,onProgress=()=>{}}){
    if(result?.kind!=='frozen-query-comparison')throw new Error('Run a frozen comparison first.');
    const fen=result.fen,rows=result.rows.map(row=>({...row})),scope=decisionScope(fen,rows.map(row=>row.move));
    const rootMoves=scope.moves.slice();
    check(signal);onProgress({label:'Stockfish: separate assessment of captured CDB / DCC choices'});
    const adjudication=await engine.analyze({fen,multiPV:rootMoves.length,searchMoves:rootMoves.slice(),
      nodes:Math.max(10000,Math.min(10000000,Math.trunc(Number(nodes)||1000000))),clearHash:true,signal});
    check(signal);
    const certificate=certify(scope,adjudication);
    const judged={...adjudication,rootMoves,deeperThanCDB:null,
      note:'Separate pinned Stockfish search. Original CDB engine version and search work are unknown; greater depth than CDB is not established.'};
    return {...result,fen,rows:projectMetrics(rows,certificate,fen),adjudication:judged,
      conclusion:'Source-policy replay plus a separate Stockfish assessment of the chosen root moves. Incomplete replay stays incomplete. No Elo or strength conclusion.'};
  }
  async function runEngineComparison({Chess,DCC,engine,fen,nodeBudget=100000,adjudicationNodes=1000000,
    candidates=5,signal,onProgress=()=>{}}){
    if(!engine?.analyze)throw new Error('Load the browser engine before starting an engine comparison.');
    nodeBudget=Math.max(10000,Math.min(2000000,Math.trunc(Number(nodeBudget)||100000)));
    adjudicationNodes=Math.max(nodeBudget*2,Math.min(10000000,Math.trunc(Number(adjudicationNodes)||1000000)));
    candidates=Math.max(2,Math.min(10,Math.trunc(Number(candidates)||5)));
    const root=new Chess(fen),rootSide=root.turn(),legalCount=root.moves().length;
    if(!legalCount)throw new Error('This position has no legal move.');
    const search=async options=>{check(signal);const result=await engine.analyze({fen,...options,clearHash:true,signal});check(signal);return result;};
    onProgress({label:'Raw engine: full node budget'});
    const raw=await search({multiPV:1,nodes:nodeBudget});
    const rootShare=Math.floor(nodeBudget/2);
    onProgress({label:'DCC: candidate discovery'});
    const discovery=await search({multiPV:Math.min(candidates,legalCount),nodes:rootShare});
    const expected=Math.min(candidates,legalCount), ordered=discovery.lines.slice().sort((a,b)=>a.multipv-b.multipv);
    if(discovery.completeMultiPV!==true||ordered.length!==expected||new Set(ordered.map(l=>l.pv?.[0])).size!==expected)
      throw new Error('DCC discovery has no complete same-depth candidate set. Increase the node budget.');
    const first=ordered[0];
    if(!first||first.multipv!==1||first.score?.type!=='cp'||!finite(first.score.root)||!exact(first.score))
      throw new Error('The top discovery score is mate, bounded or unknown. This centipawn experiment cannot compare it.');
    if(raw.completeMultiPV!==true||!raw.lines[0]?.pv?.[0])throw new Error('Raw engine has no complete root result. Increase the node budget.');
    // Freeze the decision scope before filtering scores. Bounded/mate discovery
    // roots must still receive exact adjudication; silently dropping them biases best.
    const rawMove=raw.lines[0].pv[0],scope=decisionScope(fen,[rawMove,...ordered.map(line=>line.pv?.[0])]);
    const lines=ordered.filter(l=>l.pv?.[0]&&l.score?.type==='cp'&&finite(l.score.root)&&exact(l.score));
    const guarded=lines.filter(l=>first.score.root-l.score.root<=10), funded=guarded.length;
    const available=nodeBudget-rootShare, totalSamples=funded*3, perSample=Math.floor(available/Math.max(1,totalSamples));
    const observations=[];let remaining=available;const searches=[discovery];
    for(let i=0;i<guarded.length;i++){
      const line=guarded[i],board=new Chess(fen),sequence=[],path=[],sourceResults=[];
      for(let ply=0;ply<3;ply++){
        check(signal);
        const uci=ply===0?line.pv[0]:sourceResults[sourceResults.length-1]?.bestMove;
        if(!uci||!DCC.play(board,uci))break;
        path.push(uci);
        if(board.in_checkmate()||board.in_draw()){
          sequence.push(board.in_checkmate()?(board.turn()===rootSide?-30000:30000):0);break;
        }
        const allocation=Math.min(remaining,perSample);
        if(allocation<1)break;
        remaining-=allocation;
        onProgress({label:`DCC: candidate ${i+1}/${funded}, continuation ${ply+1}/3`});
        const result=await search({fen:board.fen(),multiPV:1,nodes:allocation});searches.push(result);sourceResults.push(result);
        sequence.push(result.completeMultiPV===true?normalizeScore(result.lines[0],board.turn(),rootSide):null);
      }
      const metrics=DCC.sensors(sequence,board.fen(),{dccStructureMode:'descriptive',dccSensors:{structure:false}});
      observations.push({move:line.pv[0],rawCp:line.score.root,sequence,path,metrics,sourceResults,
        complete:sequence.length===3&&sequence.every(finite),rank:line.score.root+(finite(metrics.bonus)?metrics.bonus:0)});
    }
    // Keep raw discovery move if any guarded continuation lacks comparable coverage.
    const complete=observations.length>0&&observations.every(o=>o.complete);
    const ranked=observations.slice().sort((a,b)=>b.rank-a.rank||b.rawCp-a.rawCp||a.move.localeCompare(b.move));
    const dccMove=complete?ranked[0].move:first.pv[0];
    const dccNodes=searches.every(s=>spent(s)!==null)?searches.reduce((sum,s)=>sum+spent(s),0):null;
    let rows=[{id:'raw-engine',label:'Raw engine · 1 PV',move:rawMove,finalEngineMove:raw.bestMove,nodes:spent(raw),nodeAllowance:nodeBudget},
      {id:'dcc-engine',label:'DCC on browser engine evidence',move:dccMove,nodes:dccNodes,nodeAllowance:nodeBudget,
        allocatedNodes:nodeBudget-remaining,complete,observations,
        reason:complete?'DCC ranking within the discovery 10 cp guard.':'Raw discovery retained: incomplete comparable continuations.'}];
    const rootMoves=scope.moves.slice();
    onProgress({label:'Separate deeper root adjudication'});
    const adjudication=await search({multiPV:rootMoves.length,searchMoves:rootMoves.slice(),nodes:adjudicationNodes});
    rows=projectMetrics(rows,certify(scope,adjudication),fen);
    const maximumActual=Math.max(spent(raw)||0,dccNodes||0),deeper=spent(adjudication)!==null&&spent(adjudication)>maximumActual;
    return {schema:'chess-benchmark/1',version:VERSION,kind:'engine-node-comparison',fen,createdAt:new Date().toISOString(),
      engine:raw.engine,budget:{type:'requested total engine nodes',perPolicy:nodeBudget,
        note:'Cold hash for every search. Engine stopping may overshoot; actual aggregate nodes are reported. DCC splits its allowance across discovery and continuations.'},
      raw,discovery,rows,adjudication:{...adjudication,greaterActualNodes:deeper,rootMoves},
      conclusion:'A reproducible single-position comparison of raw search and a DCC engine experiment. Deeper same-engine adjudication is not independent ground truth or an Elo estimate.'};
  }
  return {VERSION,settingsFrom,runFrozen,runEngineComparison,adjudicateFrozen};
});
