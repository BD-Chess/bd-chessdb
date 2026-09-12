/* Shared analysis. Same candidate/evaluation budget for both selectors.
   Every action simulation costs one work unit, including sensor coverage.
   No wall deadline in work-unit mode; cancelled by terminating the Worker.
   Only completed root iterations can replace the last report. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./f4m-core.js'):root.F4M);if(typeof module==='object'&&module.exports)module.exports=api;root.F4MSearch=api;})(globalThis,function(E){
'use strict';
const VERSION='2.1.0-lab.1',M=E.MATE;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function analyze(raw,options={},progress=()=>{}){
 const s=E.validate(raw),start=performance.now();
 const mode=options.mode==='work'?'work':'time';
 const budget=mode==='work'?Math.max(50,Math.min(1000000,Math.trunc(+options.work||10000))):Math.max(50,Math.min(15000,+options.ms||500));
 const maxDepth=Math.max(1,Math.min(16,Math.trunc(+options.depth||10))),deadline=mode==='time'?start+budget:Infinity;
 const limit=mode==='work'?budget:Infinity,STOP={};let work=0,nodes=0,hits=0,depth=0,aborted=false,rows=[],iterations=[];const tt=new Map();
 const check=()=>{if(work>=limit||performance.now()>=deadline)throw STOP;};
 const apply=(st,a)=>{check();work++;return E.action(st,a);};
 const terminal=(st,p,ply)=>st.result?(st.result===3?0:st.result===p?M-ply:-M+ply):null;
 const moveSort=(a,b)=>b.raw-a.raw||a.order-b.order;
 function negamax(st,d,alpha,beta,ply){
  check();nodes++;if(d<=0)return E.evaluate(st);
  const k=E.key(st)+'|'+d,hit=tt.get(k);const originalAlpha=alpha,originalBeta=beta;
  if(hit){hits++;if(hit.flag===0)return hit.score;if(hit.flag===1)alpha=Math.max(alpha,hit.score);else beta=Math.min(beta,hit.score);if(alpha>=beta)return hit.score;}
  const lo=alpha,hi=beta,moves=E.legal(st).map((a,order)=>{const n=apply(st,a);return {a,n,order,raw:terminal(n,st.curPlayer,ply)??E.evaluate(n,st.curPlayer)};});
  if(!moves.length)return 0;
  moves.sort((a,b)=>(E.moveId(b.a)===hit?.best)-(E.moveId(a.a)===hit?.best)||moveSort(a,b));
  let best=-Infinity,bestId='';for(const r of moves){const v=terminal(r.n,st.curPlayer,ply)??-negamax(r.n,d-1,-beta,-alpha,ply+1);if(v>best){best=v;bestId=E.moveId(r.a);}alpha=Math.max(alpha,v);if(alpha>=beta)break;}
  if(tt.size<60000&&Math.abs(best)<M-2048)tt.set(k,{score:best,best:bestId,flag:best<=lo?2:best>=hi?1:0});
  return best;
 }
 const moves=E.legal(s);let evaluated=0;
 if(!moves.length)return {version:VERSION,positionKey:E.key(s),player:s.curPlayer,candidates:[],depth:0,nodes:0,work:0,elapsed_ms:0,mode,budget,reason:'terminal',coverage:'complete',iterations:[]};
 // At least one legal fallback; incomplete scan is explicit, never a claimed proof.
 let emergency={move:moves[0],order:0,raw:0,rawKind:'unsearched',depth:0,safe:null,terminal:0,sequence:[],sensors:null};
 try{
  for(let order=0;order<moves.length;order++){
   const move=moves[order],n=apply(s,move),raw=terminal(n,s.curPlayer,1)??E.evaluate(n,s.curPlayer);
   rows.push({move,order,n,raw,rawKind:'static',depth:0,safe:n.result?(n.result===s.curPlayer||n.result===3):null,terminal:n.result,sequence:[],sensors:null});evaluated++;
  }
  const win=rows.find(r=>r.terminal===s.curPlayer);
  if(!win){
   // Probe ALL legal replies, including own-magnet refresh. Original source definition
   // of practicality = number of opponent replies which do NOT immediately win.
   for(const row of rows){
    if(row.terminal){row.sensors={coverage:'complete',replies:0,nonWinningReplies:0,rotationFloor:null,magnetFloor:null,rotationCount:0,magnetCount:0,rotationLoss:0,magnetLoss:0,displacement:0};continue;}
    const replies=E.legal(row.n),sensor={coverage:'partial',replies:replies.length,observed:0,nonWinningReplies:0,rotationFloor:null,magnetFloor:null,rotationCount:0,magnetCount:0,rotationLoss:null,magnetLoss:null,displacement:0};row.sensors=sensor;let loss=false;
    for(const a of replies){const n=apply(row.n,a),score=terminal(n,s.curPlayer,2)??E.evaluate(n,s.curPlayer);sensor.observed++;
     if(n.result===3-s.curPlayer)loss=true;else sensor.nonWinningReplies++;
     if(a.type==='flip'){sensor.rotationCount++;sensor.rotationFloor=sensor.rotationFloor===null?score:Math.min(sensor.rotationFloor,score);const changed=n.grid.flat().filter((v,i)=>v!==row.n.grid[i>>3][i%8]).length/64;sensor.displacement=Math.max(sensor.displacement,changed);}
     if(a.type==='magnet'){sensor.magnetCount++;sensor.magnetFloor=sensor.magnetFloor===null?score:Math.min(sensor.magnetFloor,score);}
    }
    sensor.coverage='complete';sensor.rotationLoss=sensor.rotationFloor===null?0:Math.max(0,E.evaluate(row.n,s.curPlayer)-sensor.rotationFloor);sensor.magnetLoss=sensor.magnetFloor===null?0:Math.max(0,E.evaluate(row.n,s.curPlayer)-sensor.magnetFloor);row.safe=!loss;
   }
   for(let d=1;d<=maxDepth;d++){
    const next=[];
    for(const r of rows){check();const score=terminal(r.n,s.curPlayer,1)??-negamax(r.n,d-1,-M,M,2);next.push({...r,raw:score,rawKind:'depth-exact',depth:d,sequence:[...r.sequence,{depth:d,score}]});}
    rows=next;depth=d;iterations.push({depth:d,work,nodes,elapsed_ms:performance.now()-start});progress({depth,nodes,work,elapsed_ms:performance.now()-start});
    const sorted=rows.slice().sort(moveSort);if(Math.abs(sorted[0].raw)>M-2048)break;
   }
  }
 }catch(e){if(e!==STOP)throw e;aborted=true;}
 const candidates=(rows.length?rows:[emergency]).map(({n,...r})=>r);
 const coverage=candidates.length===moves.length&&candidates.every(r=>r.terminal||r.sensors?.coverage==='complete')?'complete':'partial';
 return {version:VERSION,positionKey:E.key(s),player:s.curPlayer,candidates,depth,nodes,work,hits,elapsed_ms:performance.now()-start,mode,budget,maxDepth,aborted,coverage,rootCoverage:evaluated+'/'+moves.length,reason:candidates.some(r=>r.terminal===s.curPlayer)?'win':depth?'search':'fallback',iterations};
}
return {VERSION,analyze};
});
