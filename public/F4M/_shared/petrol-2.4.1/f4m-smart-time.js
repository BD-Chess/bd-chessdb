/* Flip4M Smart Time v2.
 * Beginner/Casual/Challenge/Master are unchanged.
 * Grandmaster (60 s) and Champion (120 s) keep a ceiling, but no longer
 * collapse to a few seconds after the opening. The first two moves of EACH
 * side stay fast; from that side's third move onward the floor and target
 * rise with ply, legal branching, threats, active magnets and remaining tools.
 * Classical and AI+DCC share this same analyzer budget.
 */
(function(root){'use strict';
const S=root.F4MSearch,E=root.F4M;
if(!S||typeof S.analyze!=='function'||!E||typeof E.legal!=='function')throw Error('F4M + F4MSearch required before Smart Time v2');
const originalAnalyze=S.analyze;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

function threatSignal(s){
 const g=s.grid;let twos=0,threes=0;
 for(let r=0;r<8;r++)for(let c=0;c<8;c++)for(const [dr,dc] of [[0,1],[1,0],[1,1],[1,-1]]){
  const rr=r+3*dr,cc=c+3*dc;if(rr<0||rr>=8||cc<0||cc>=8)continue;
  let a=0,b=0;
  for(let i=0;i<4;i++){const v=g[r+i*dr][c+i*dc];if(v===1)a++;else if(v===2)b++;}
  if(a&&b)continue;
  const n=a||b;if(n===3)threes++;else if(n===2)twos++;
 }
 return clamp((threes*3+twos)/10,0,1);
}

function smartTimeBudget(s,requestedMs){
 const requested=Math.max(30,Math.min(120000,Number(requestedMs)||500));
 const ply=Number.isInteger(s?.ply)?Math.max(0,s.ply):0;
 const playerMove=Math.floor(ply/2)+1;
 const occupied=s.grid.flat().filter(Boolean).length;
 const legalMoves=E.legal(s).length;
 const activeMagnets=E.SIDES.reduce((n,k)=>n+(s.mag?.[k]||[]).filter(Boolean).length,0);
 const remainingTools=[1,2].reduce((n,p)=>n+(s.tokens?.[p]?.flip||0)+(s.tokens?.[p]?.mag||0),0);
 const threats=threatSignal(s);

 const base={requestedMs:requested,ply,playerMove,occupied,legalMoves,activeMagnets,remainingTools,threats};
 if(requested<60000)return {...base,effectiveMs:requested,adaptive:false,complexity:1,reason:'standard-profile'};

 const champion=requested>=120000;
 if(legalMoves<=1){
  const ms=champion?2000:1000;
  return {...base,effectiveMs:ms,adaptive:true,complexity:0,reason:'forced-move'};
 }
 // First two turns for each side remain deliberately cheap.
 if(playerMove===1){
  const ms=champion?1500:1000;
  return {...base,effectiveMs:ms,adaptive:true,complexity:ms/requested,reason:'opening-move-1'};
 }
 if(playerMove===2){
  const ms=champion?5000:3000;
  return {...base,effectiveMs:ms,adaptive:true,complexity:ms/requested,reason:'opening-move-2'};
 }

 // From each side's third move onward, occupied pieces are not the main proxy.
 // Flip4M can be highly branched while visually sparse because flips/magnets
 // globally transform the board.
 const phase=clamp((ply-4)/16,0,1);
 const branching=clamp((legalMoves-8)/34,0,1);
 const magnets=clamp(activeMagnets/4,0,1);
 const tools=clamp(remainingTools/12,0,1);
 let complexity=clamp(0.05+0.30*phase+0.25*threats+0.15*magnets+0.10*branching+0.05*tools,0,1);
 if(threats>=0.9&&(activeMagnets>=2||branching>=0.75))complexity=Math.max(complexity,0.95);

 // Requested design:
 // GM: 15–25 s early, ~30–45 s midgame, 45–60 s complex.
 // Champion: 25–50 s early, ~55–90 s midgame, 90–120 s complex.
 const floor=champion?(playerMove>=6?55000:25000):(playerMove>=6?30000:15000);
 const raw=floor+(requested-floor)*complexity;
 const effective=Math.min(requested,Math.max(floor,Math.round(raw/250)*250));
 return {...base,effectiveMs:effective,adaptive:true,complexity,phase,branching,magnets,tools,floorMs:floor,
  reason:effective===requested?'full-complexity':playerMove>=6?'mid-late-complexity':'post-opening-complexity'};
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
 const opt={...options},meta=smartTimeBudget(raw,opt.ms);
 if(opt.mode!=='work'&&meta.adaptive)opt.ms=meta.effectiveMs;
 return decorate(originalAnalyze(raw,opt,r=>progress(decorate(r,meta))),meta);
};
if(typeof module!=='undefined')module.exports={smartTimeBudget,threatSignal};
})(globalThis);
