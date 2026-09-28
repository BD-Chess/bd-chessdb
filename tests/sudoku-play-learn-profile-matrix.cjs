'use strict';
// PHASE B ONLY. Frozen engineering requests; every attempt and timeout is kept.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const spec=require('./fixtures/sudoku-play-learn-profile-sample.json');
function load(source){const x={module:{exports:{}}};vm.runInNewContext(source,x);return x.module.exports;}
if(!isMainThread){
 const C=load(workerData.source),old=load(workerData.reference),start=performance.now();
 try{const r=C.generate({...workerData.request,maxAttempts:spec.maxAttempts});let checks=null;
  if(r.status==='GENERATED'){
   const exact=old.exact(r.puzzle,1000000);let s=C.state(r.puzzle);for(const q of r.rating.path){if(!C.check(s,q))throw Error('PROOF_CHECK');s=C.apply(s,q);}
   const again=C.ratePuzzle(r.puzzle);checks={unique:exact.complete&&exact.count===1,solutionMatches:exact.solution.join('')===s.b.join(''),requested:r.rating.label===workerData.request.diff,replayed:again.status==='RATED'&&again.label===r.rating.label,lowerComplete:r.rating.tiers.slice(0,-1).every(x=>x.complete&&x.status==='STALLED')};
   if(Object.values(checks).some(x=>!x))throw Error('ADMISSION_FAILED');
  }
  parentPort.postMessage({...workerData.request,status:r.status,attempts:r.attempts,outcomes:r.outcomes,checks,ms:performance.now()-start});
 }catch(e){parentPort.postMessage({...workerData.request,status:'ERROR',message:e.message,ms:performance.now()-start});}
}else{
 const source=fs.readFileSync(path.join(__dirname,'../public/S/new/app.html'),'utf8').match(/<script id="navigator-core">([\s\S]*?)<\/script>/)[1],reference=fs.readFileSync(path.join(__dirname,'fixtures/sudoku-navigator-v020.cjs'),'utf8');
 const requests=spec.labels.flatMap((diff,i)=>spec.seeds[i].map(seed=>({diff,seed}))),results=[],start=performance.now();
 const run=request=>new Promise(resolve=>{const w=new Worker(__filename,{workerData:{source,reference,request}});let done=false;const finish=r=>{if(done)return;done=true;clearTimeout(timer);w.terminate();resolve(r);};const timer=setTimeout(()=>finish({...request,status:'TIMEOUT',ms:spec.perRequestMs}),spec.perRequestMs);w.once('message',finish);w.once('error',e=>finish({...request,status:'ERROR',message:e.message}));});
 (async()=>{for(const request of requests){const r=performance.now()-start>=spec.totalMs?{...request,status:'NOT_RUN_TOTAL_BUDGET'}:await run(request);results.push(r);console.log(JSON.stringify(r));}const summary=Object.fromEntries(spec.labels.map(diff=>{const a=results.filter(x=>x.diff===diff);return[diff,{requested:a.length,generated:a.filter(x=>x.status==='GENERATED').length,outcomes:a.reduce((o,x)=>(o[x.status]=(o[x.status]||0)+1,o),{})}];}));console.log(JSON.stringify({type:'summary',spec:spec.id,node:process.version,requested:requests.length,summary,ms:performance.now()-start}));if(results.some(x=>!['GENERATED','PROFILE_UNFULFILLED'].includes(x.status)))process.exitCode=1;})().catch(e=>{console.error(e);process.exitCode=1;});
}
