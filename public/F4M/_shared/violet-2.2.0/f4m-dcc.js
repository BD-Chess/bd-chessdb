/* Physical sensors from the Flip4M v0.4 proposal; coverage/guard contract from ChessDCC.
 * Depth-score history is NOT a principal-variation path. No consciousness or Elo verdict.
 * GS/MR are worst legal reply evaluations: higher is better (explicit polarity).
 */
(function(root){'use strict';
const C=root.F4MClassical||(typeof require==='function'?require('./f4m-classical.js'):null);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function path(values){
 const v=values.map(x=>x.score).filter(Number.isFinite);
 if(v.length<3)return {status:'unknown',samples:v.length,floor:null,volatility:null,recovery:null,bonus:0};
 const floor=Math.min(...v),vol=v.slice(1).reduce((a,b,i)=>a+Math.abs(b-v[i]),0)/(v.length-1);
 return {status:'complete',samples:v.length,floor,volatility:vol,recovery:v.at(-1)-floor,bonus:-clamp(vol/100,0,2)};
}
function select(report,config={}){
 const raw=C.select(report),best=raw.selected,guard=clamp(Number(config.guard??12),0,40);
 const weights={gs:config.gs!==false,mr:config.mr!==false,thrift:config.thrift!==false,path:config.path!==false};
 const base={...raw,policy:'dcc',version:'1.0.0',guard,weights,coverage:'unknown',ranks:[]};
 if(!best)return {...base,reason:'terminal'};
 if(best.terminalResult||best.immediateWin||Math.abs(best.score)>=997952)return {...base,reason:'proven-result-protected'};
 if(!report.depth||!report.safetyComplete)return {...base,reason:'raw-retained-incomplete-coverage'};
 const pool=report.candidates.filter(m=>m.safe===best.safe&&m.score>=best.score-guard&&Math.abs(m.score)<997952);
 if(!pool.every(m=>m.depth===report.depth&&m.sensors.status==='complete'))return {...base,reason:'raw-retained-incomparable-coverage'};
 const ranks=pool.map(m=>{
  const s=m.sensors,dm=path(m.byDepth),cost=m.move.type==='drop'?0:m.move.type==='flip'?1:1.3;
  // Soft inverse-volatility thrift with an explicit floor; finite on an empty board.
  const thrift=-Math.min(4,0.3*cost/Math.max(0.1,s.volatility));
  const gs=s.gs===null?0:clamp((s.gs-m.score)/80,-4,2);
  const mr=s.mr===null?0:clamp((s.mr-m.score)/80,-4,2);
  const bonus=(weights.gs?gs:0)+(weights.mr?mr:0)+(weights.thrift?thrift:0)+(weights.path?dm.bonus:0);
  return {id:m.id,move:m.move,raw:m.score,rankScore:m.score+bonus,bonus,gs,mr,thrift,depthStability:dm,
   practicality:{nonWinning:s.nonWinningReplies,total:s.totalReplies},coverage:s.status};
 });
 ranks.sort((a,b)=>b.rankScore-a.rankScore||b.raw-a.raw||(a.id===best.id?-1:b.id===best.id?1:a.id.localeCompare(b.id)));
 const selected=report.candidates.find(m=>m.id===ranks[0]?.id)||best;
 return {...base,selected,changed:selected.id!==best.id,rawGap:best.score-selected.score,coverage:'complete',ranks,
  reason:selected.id===best.id?'raw-and-dcc-agree':'physics-preference-within-guard'};
}
const api={VERSION:'1.0.0',select,path};root.F4MDCC=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
