/* Flip4M smart long-think budget v1.
 * Keeps Beginner/Casual/Strong/Master unchanged. For 60s/120s profiles,
 * the requested value is a ceiling; early/simple positions get less time.
 * Same deterministic budget function is used by Classical and DCC.
 */
(function(root){'use strict';
const S=root.F4MSearch;if(!S||typeof S.analyze!=='function')throw Error('F4MSearch required before f4m-smart-time.js');
const originalAnalyze=S.analyze;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function threatSignal(s){
 const g=s.grid;let twos=0,threes=0;
 for(let r=0;r<8;r++)for(let c=0;c<8;c++)for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]){
  const rr=r+3*dr,cc=c+3*dc;if(rr<0||rr>=8||cc<0||cc>=8)continue;
  let a=0,b=0;for(let i=0;i<4;i++){const v=g[r+i*dr][c+i*dc];if(v===1)a++;else if(v===2)b++;}
  if(a&&b)continue;const n=a||b;if(n===3)threes++;else if(n===2)twos++;
 }
 return clamp((threes*3+twos)/10,0,1);
}
function smartTimeBudget(s,requestedMs){
 const requested=Math.max(30,Math.min(120000,Number(requestedMs)||500));
 const occupied=s.grid.flat().filter(Boolean).length;
 if(requested<60000)return {requestedMs:requested,effectiveMs:requested,adaptive:false,occupied,complexity:1,reason:'standard-profile'};
 if(occupied===0)return {requestedMs:requested,effectiveMs:1000,adaptive:true,occupied,complexity:1000/requested,reason:'empty-opening'};
 if(occupied===1){const ms=requested>=120000?3000:2000;return {requestedMs:requested,effectiveMs:ms,adaptive:true,occupied,complexity:ms/requested,reason:'first-reply'};}
 if(occupied<=3){const ms=requested>=120000?6000:4000;return {requestedMs:requested,effectiveMs:ms,adaptive:true,occupied,complexity:ms/requested,reason:'very-early'};}
 const activeMagnets=['top','right','bottom','left'].reduce((n,k)=>n+(s.mag?.[k]||[]).filter(Boolean).length,0);
 const remainingTools=[1,2].reduce((n,p)=>n+(s.tokens?.[p]?.flip||0)+(s.tokens?.[p]?.mag||0),0);
 const phase=Math.pow(clamp(occupied/20,0,1),1.35);
 const threats=threatSignal(s);
 const magnets=clamp(activeMagnets/4,0,1);
 const tools=phase*clamp(remainingTools/8,0,1);
 const complexity=clamp(0.05+0.64*phase+0.18*threats+0.09*magnets+0.04*tools,0.05,1);
 const floor=requested>=120000?6000:4000;
 const effective=Math.min(requested,Math.max(floor,Math.round(requested*complexity/250)*250));
 return {requestedMs:requested,effectiveMs:effective,adaptive:true,occupied,complexity,phase,threats,activeMagnets,remainingTools,reason:effective===requested?'full-complexity':'adaptive-complexity'};
}
function decorate(report,meta){
 if(!report||typeof report!=='object')return report;
 report.smartTime={...meta};
 if(report.budget&&typeof report.budget==='object'){
  report.budget.requestedMs=meta.requestedMs;
  report.budget.effectiveMs=meta.effectiveMs;
  report.budget.adaptive=meta.adaptive;
 }
 return report;
}
S.smartTimeBudget=smartTimeBudget;
S.analyze=function(raw,options={},progress=()=>{}){
 const opt={...options};const meta=smartTimeBudget(raw,opt.ms);
 if(opt.mode!=='work'&&meta.adaptive)opt.ms=meta.effectiveMs;
 return decorate(originalAnalyze(raw,opt,r=>progress(decorate(r,meta))),meta);
};
if(typeof module!=='undefined')module.exports={smartTimeBudget,threatSignal};
})(globalThis);
