(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.F4MClassical=api;})(globalThis,function(){
'use strict';
function choose(report){
 const all=report.candidates||[];if(!all.length)return null;
 const win=all.find(r=>r.terminal===report.player);if(win)return {move:win.move,raw:win.raw,row:win,reason:'immediate-win'};
 // Shared hard tactical guard. Unknown is not classified as safe.
 const safe=all.filter(r=>r.safe===true),pool=safe.length?safe:all;
 const row=pool.slice().sort((a,b)=>b.raw-a.raw||a.order-b.order)[0];
 return {move:row.move,raw:row.raw,row,reason:report.depth?'raw-best':'bounded-fallback'};
}
return {VERSION:'1.0.0',choose};
});
