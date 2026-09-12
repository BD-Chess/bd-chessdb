/* Classical policy: shared tactics, then raw depth-limited search score. */
(function(root){'use strict';
function select(report){
 const all=report.candidates||[],win=all.filter(m=>m.immediateWin);
 const safe=all.filter(m=>m.safe===true),possible=all.filter(m=>!m.immediateLoss);
 const pool=win.length?win:safe.length?safe:possible.length?possible:all;
 const selected=pool.slice().sort((a,b)=>b.score-a.score||a.order-b.order)[0]||null;
 return {policy:'classical',selected,rawBest:selected,changed:false,rawGap:0,
  reason:win.length?'immediate-win':safe.length?'raw-best-safe':report.depth?'raw-best':'bounded-fallback'};
}
const api={VERSION:'1.0.0',select};root.F4MClassical=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
