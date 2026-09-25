/* Regenerate synthetic frozen diagnostics. No fixture value is an engine result. */
const fs=require('node:fs');
const path=require('node:path');
const {Chess}=require('../js/chess.min.js');
const DCC=require('../js/8zc-dcc-core.js');
const E=require('../js/8zc-evidence.js');
const B=require('../js/8zc-benchmark.js');
async function build(fen,label){
  const collector=E.createCollector({maxRecords:1200}),settings={dccDepth:3,dccDefenseCandidates:2,dccDefensePlies:2,dccNoDeadline:true};
  const stamp='2026-09-13T00:00:00.000Z';
  function record(kind,position,response){collector.capture({kind,fen:position,source:'synthetic-diagnostic',request:{kind,fen:position},response,startedAt:stamp,finishedAt:stamp,cacheHit:false,metadata:{synthetic:true,engine:null,meaning:'Fixture values exercise code; not chess evaluations.'}});return response;}
  const getMoves=async position=>record('moves',position,{moves:new Chess(position).moves({verbose:true}).slice(0,position===fen?4:2).map((m,i)=>({move:m.from+m.to+(m.promotion||''),score:0,rank:i+1}))});
  const getPV=async position=>{const board=new Chess(position),pv=[];for(let i=0;i<5&&!board.game_over();i++){const move=board.moves({verbose:true})[0];pv.push(move.from+move.to+(move.promotion||''));board.move(move);}return record('pv',position,{score:0,depth:12,pv});};
  const getScore=async position=>record('score',position,0);
  const moves=(await getMoves(fen)).moves;let analysis;
  for(const extra of [{dccPolicy:'legacy',dccDefenseCheck:false},{dccPolicy:'balanced',dccDefenseCheck:true},
    {dccPolicy:'balanced',dccDefenseCheck:false,dccSensors:{stability:false,floor:false,volatility:false,trend:false,structure:false}},
    {dccPolicy:'balanced',dccDefenseCheck:true,dccStructureMode:'rank'}]){
    analysis=await DCC.analyze({Chess,fen,moves,settings:{...settings,...extra},getMoves,getPV,getScore});
  }
  const snapshot=collector.snapshot(analysis,{label,settings,sourceVersion:DCC.VERSION,createdAt:stamp});
  const comparison=await B.runFrozen({Chess,DCC,Evidence:E,snapshot,budget:120});
  if(comparison.rows.some(row=>!row.complete))throw new Error('Synthetic fixture lacks queries: '+JSON.stringify(comparison.rows.map(r=>({id:r.id,missing:r.missingQueries,coverage:r.coverage}))));
  return snapshot;
}
(async()=>{
  const board=new Chess();board.move('e4');
  const fixtures=[await build(new Chess().fen(),'Synthetic zero / equal candidates · White'),await build(board.fen(),'Synthetic zero / equal candidates · Black')];
  const pack={schema:'chess-benchmark-fixtures/1',notice:'Synthetic deterministic diagnostics only. All scores are artificial zero; no chess strength evidence.',generator:'benchmark-fixtures-build.cjs',coreVersion:DCC.VERSION,fixtures};
  fs.writeFileSync(path.join(__dirname,'benchmark-fixtures.json'),JSON.stringify(pack,null,2)+'\n');
  console.log(JSON.stringify({fixtures:fixtures.length,records:fixtures.map(f=>f.payload.records.length),coverage:'all policies complete at allowance120',ids:fixtures.map(f=>f.id)}));
})().catch(error=>{console.error(error);process.exitCode=1;});
