/* Bounded integration: exact vendored browser engine running through its Node CLI. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),readline=require('node:readline');
const assert=require('node:assert/strict');
const {Chess}=require('../js/chess.min.js');
const DCC=require('../js/8zc-dcc-core.js');
const Deep=require('../js/8zc-deep-engine.js');
const B=require('../js/8zc-benchmark.js');
function workerFactory(){
  const worker={onmessage:null,onerror:null};
  const child=spawn(process.execPath,[path.join(__dirname,'../vendor/stockfish/stockfish-18-lite-single.js')],{stdio:['pipe','pipe','pipe']});
  readline.createInterface({input:child.stdout}).on('line',line=>worker.onmessage?.({data:line}));
  let stderr='';child.stderr.on('data',data=>{stderr+=data.toString();});
  child.on('error',error=>worker.onerror?.({message:error.message}));
  child.on('exit',code=>{if(!worker.closed)worker.onerror?.({message:'Engine exited '+code+' '+stderr.slice(0,300)});});
  worker.postMessage=command=>child.stdin.write(command+'\n');worker.terminate=()=>{worker.closed=true;child.kill();};return worker;
}
(async()=>{
  const engine=Deep.create({Chess,workerFactory});
  try{
    const result=await B.runEngineComparison({Chess,DCC,engine,fen:new Chess().fen(),nodeBudget:40000,adjudicationNodes:200000,candidates:3});
    assert.equal(result.discovery.completeMultiPV,true);assert.equal(result.rows.length,2);
    assert.ok(result.rows.every(row=>row.move&&row.nodes>0));
    assert.ok(result.rows.every(row=>row.adjudication&&Number.isFinite(row.adjudication.scoreCp)));
    assert.ok(result.adjudication.completeMultiPV);assert.ok(result.adjudication.greaterActualNodes);
    result.integration={runtime:process.version,platform:process.platform,coreVersion:DCC.VERSION,
      recipe:'node public/chess/new/research/benchmark-smoke.cjs',
      moduleSHA256:Object.fromEntries(['8zc-benchmark.js','8zc-deep-engine.js','8zc-dcc-core.js'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../js',file))).digest('hex')])),
      meaning:'Single-position engine integration smoke. Not an Elo test or strength estimate.'};
    fs.writeFileSync(path.join(__dirname,'benchmark-smoke-result.json'),JSON.stringify(result,null,2)+'\n');
    console.log(JSON.stringify({status:'PASS',rows:result.rows.map(({id,move,nodes,adjudication})=>({id,move,nodes,adjudication})),adjudicationNodes:result.adjudication.nodes}));
  }finally{engine.destroy();}
})().catch(error=>{console.error(error);process.exitCode=1;});
