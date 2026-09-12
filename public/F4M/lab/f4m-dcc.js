/* DCC physics and depth-path sensors. Bounded selector, NOT full recursive rDCC.
   The draft's ambiguous GS sign is operationalized as a loss: lower is safer.
   Depth samples are NOT a principal variation and NOT independent evidence. */
(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./f4m-classical.js'):root.F4MClassical);if(node)module.exports=api;root.F4MDCC=api;})(globalThis,function(C){
'use strict';const VERSION='1.0.0',clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function path(sequence){const v=sequence.map(x=>x.score),delta=v.slice(1).map((x,i)=>Math.abs(x-v[i]));return {samples:v.length,floor:v.length?Math.min(...v):null,volatility:delta.length?delta.reduce((a,b)=>a+b,0)/delta.length:null,recovery:v.length?v[v.length-1]-Math.min(...v):null};}
function choose(report,config={}){
 const raw=C.choose(report);if(!raw)return null;const band=clamp(Number.isFinite(+config.band)?+config.band:12,0,30);
 const fallback=reason=>({...raw,policy:'dcc',rawBest:raw.move,rawGap:0,changed:false,reason,band,coverage:report.coverage,sensorTable:[]});
 if(Math.abs(raw.raw)>997952||raw.row.terminal)return fallback('terminal-protected');
 if(report.depth<1)return fallback('no-completed-depth');
 const pool=report.candidates.filter(r=>r.raw>=raw.raw-band&&r.safe===raw.row.safe);
 if(raw.row.safe!==true||pool.some(r=>r.sensors?.coverage!=='complete'||r.rawKind!=='depth-exact'))return fallback('insufficient-comparable-coverage');
 let sensorTable=pool.map(r=>{
  const s=r.sensors,p=path(r.sequence),vol=s.displacement||0;
  const gs=-clamp((s.rotationLoss||0)/80,0,6),mr=-clamp((s.magnetLoss||0)/100,0,6);
  const thrift=r.move.type==='drop'?0:-(r.move.type==='flip'?1.8:2.4)/(0.35+vol);
  const unstable=p.volatility===null?0:-clamp(p.volatility/80,0,3);
  const style=config.style==='defensive'?1.3:config.style==='aggressive'?0.75:1;
  const bonus=style*(gs+mr)+thrift+unstable;
  return {move:r.move,order:r.order,raw:r.raw,score:r.raw+bonus,bonus,gs,mr,thrift,path:p,practicality:s.replies?s.nonWinningReplies/s.replies:1,rotationFloor:s.rotationFloor,magnetFloor:s.magnetFloor,coverage:s.coverage,row:r};
 });
 sensorTable.sort((a,b)=>b.score-a.score||b.raw-a.raw||a.order-b.order);const top=sensorTable[0];
 const changed=JSON.stringify(top.move)!==JSON.stringify(raw.move);
 return {move:top.move,raw:top.raw,row:top.row,policy:'dcc',rawBest:raw.move,rawGap:raw.raw-top.raw,changed,reason:changed?'physics-preference-in-band':'raw-and-dcc-agree',band,coverage:'complete',sensorTable:sensorTable.map(({row,...x})=>x)};
}
return {VERSION,path,choose};
});
