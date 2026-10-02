/* Flip4M Lab 2.1.0. Shared, policy-neutral analyzer derived from v2.0.0.
 * Complete root iterations only; work = executed state transitions (including sensors).
 * No symmetry folding: the preserved legacy magnet precedence is orientation-sensitive.
 */
(function(root){'use strict';
const E=root.F4M||(typeof require==='function'?require('./f4m-core.js'):null);
const VERSION='2.1.1', M=E.MATE;
const LIMITS=Object.freeze({ms:120000,work:2000000,depth:320});
const LEVELS=Object.freeze(Object.fromEntries(Object.entries({
 beginner:{ms:150,depth:1},casual:{ms:500,depth:5},strong:{ms:1600,depth:9},master:{ms:4500,depth:14},
 grandmaster:{ms:60000,depth:320},champion:{ms:120000,depth:320}
}).map(([k,v])=>[k,Object.freeze(v)])));
function normalizeBudget(options={}){
 const number=(v,f)=>Number.isFinite(Number(v))&&Number(v)>0?Number(v):f;
 const mode=options.mode==='work'?'work':'time',legacyWorkLimit=options.legacyWorkLimit===true;
 return {mode,ms:Math.max(30,Math.min(LIMITS.ms,number(options.ms,500))),
  work:Math.max(128,Math.min(LIMITS.work,Math.trunc(number(options.work,25000)))),
  depth:Math.max(1,Math.min(LIMITS.depth,Math.trunc(number(options.depth,8)))),legacyWorkLimit};
}
// Every legal move either fills a square or consumes a finite tool. No pass moves.
function remainingActions(s){return s.grid.flat().filter(v=>v===0).length+
 [1,2].reduce((n,p)=>n+s.tokens[p].flip+s.tokens[p].mag,0);}
function analyze(raw,options={},progress=()=>{}){
 const s=E.validate(raw),start=performance.now(),limits=normalizeBudget(options),mode=limits.mode;
 const maxWork=mode==='work'||limits.legacyWorkLimit?limits.work:Infinity;
 const ms=limits.ms,maxDepth=Math.min(limits.depth,Math.max(1,remainingActions(s)));
 const deadline=mode==='time'?start+ms:Infinity,STOP={},tt=new Map();
 let work=0,nodes=0,hits=0,cutoffs=0,evals=0,depth=0,aborted=false,safetyComplete=false;
 let stopReason='depth-limit',phase='root',searchingDepth=0,rootDone=0,lastPulse=start;
 const check=()=>{
  const at=performance.now();
  if(work>=maxWork){stopReason='work-limit';throw STOP;}
  if(at>=deadline){stopReason='time-limit';throw STOP;}
  // Lightweight liveness only. Never expose a partially searched root score.
  if(at-lastPulse>=250){lastPulse=at;progress({progressOnly:true,version:VERSION,depth,searchingDepth,
   phase,rootDone,rootTotal:roots.length,work,nodes,hits,elapsed:at-start});}
 };
 const apply=(st,a)=>{check();work++;return E.action(st,a);};
 const ev=(st,p)=>{evals++;return E.evaluate(st,p);};
 const terminal=(st,p,ply)=>st.result?(st.result===3?0:st.result===p?M-ply:-M+ply):null;
 const sample=(st,p,ply)=>terminal(st,p,ply)??ev(st,p);
 const roots=[];
 // A legal fallback must exist even under a tiny deadline. At most 42 transitions.
 for(const [order,a] of E.legal(s).entries()){
  work++;const n=E.action(s,a),value=sample(n,s.curPlayer,1);
  roots.push({move:a,id:E.moveId(a),order,state:n,score:value,depth:0,byDepth:[],safe:null,
   terminalResult:n.result,immediateWin:n.result===s.curPlayer,immediateLoss:n.result===3-s.curPlayer,
   sensors:{status:'unknown',replies:0,totalReplies:0,winningReplies:0,nonWinningReplies:0,gs:null,mr:null,gsCount:0,mrCount:0,volatility:s.grid.flat().filter((v,i)=>v!==n.grid[i>>3][i%8]).length/64}});
 }
 function output(){return {schema:'f4m.analysis.v1',version:VERSION,rules:E.RULES,stateKey:E.key(s),rootPlayer:s.curPlayer,
  mode,budget:{ms:mode==='time'?ms:null,work:Number.isFinite(maxWork)?maxWork:null,depth:maxDepth},depth,work,nodes,hits,cutoffs,evals,
  elapsed:performance.now()-start,aborted,safetyComplete,stopReason,
  candidates:roots.map(({state,...m})=>({...m,byDepth:m.byDepth.slice(),sensors:{...m.sensors}}))};}
 if(!roots.length){stopReason='terminal';return output();}
 if(roots.some(m=>m.immediateWin)){stopReason='immediate-win';return output();}
 phase='safety';
 try{
  for(const m of roots){
   const sen=m.sensors;
   if(m.state.result){m.safe=!m.immediateLoss;sen.status='complete';continue;}
   const replies=E.legal(m.state);sen.totalReplies=replies.length;
   for(const a of replies){
    const n=apply(m.state,a),v=sample(n,s.curPlayer,2);sen.replies++;
    if(n.result===3-s.curPlayer)sen.winningReplies++;else sen.nonWinningReplies++;
    if(a.type==='flip'){sen.gs=sen.gs===null?v:Math.min(sen.gs,v);sen.gsCount++;}
    if(a.type==='magnet'){sen.mr=sen.mr===null?v:Math.min(sen.mr,v);sen.mrCount++;}
   }
   sen.status='complete';m.safe=sen.winningReplies===0;
  }
  safetyComplete=true;
 }catch(e){if(e!==STOP)throw e;aborted=true;}
 function nm(st,d,alpha,beta,ply){
  check();nodes++;
  if(d===0)return ev(st,st.curPlayer);
  const key=E.key(st),hit=tt.get(key);
  // Reuse only identical depth semantics, and never reuse root-relative mate distances.
  if(hit&&hit.depth===d){hits++;if(hit.flag===0)return hit.value;if(hit.flag===1)alpha=Math.max(alpha,hit.value);else beta=Math.min(beta,hit.value);if(alpha>=beta)return hit.value;}
  const lo=alpha,hi=beta,p=st.curPlayer;
  const children=E.legal(st).map((a,order)=>{const n=apply(st,a);return {a,n,order,v:sample(n,p,ply)};});
  children.sort((a,b)=>(E.moveId(b.a)===hit?.best)-(E.moveId(a.a)===hit?.best)||b.v-a.v||a.order-b.order);
  let value=-Infinity,best='';
  if(!children.length)return 0;
  for(const c of children){check();const v=terminal(c.n,p,ply)??-nm(c.n,d-1,-beta,-alpha,ply+1);if(v>value){value=v;best=E.moveId(c.a);}alpha=Math.max(alpha,v);if(alpha>=beta){cutoffs++;break;}}
  if(tt.size<60000&&Math.abs(value)<M-2048)tt.set(key,{depth:d,value,best,flag:value<=lo?2:value>=hi?1:0});
  return value;
 }
 if(!aborted)try{
  const order=roots.slice().sort((a,b)=>b.score-a.score||a.order-b.order);
  for(let d=1;d<=maxDepth;d++){
   phase='search';searchingDepth=d;rootDone=0;
   const values=[];
   for(const m of order){check();nodes++;values.push([m,terminal(m.state,s.curPlayer,1)??-nm(m.state,d-1,-M,M,2)]);rootDone++;}
   // Promote an entire iteration atomically. Partial values never escape.
   for(const [m,value] of values){m.score=value;m.depth=d;m.byDepth.push({depth:d,score:value});}
   depth=d;order.sort((a,b)=>b.score-a.score||a.order-b.order);progress(output());
   if(Math.abs(order[0].score)>M-2048){stopReason='forced-result';break;}
  }
 }catch(e){if(e!==STOP)throw e;aborted=true;}
 return output();
}
const api={VERSION,LIMITS,LEVELS,normalizeBudget,remainingActions,analyze};root.F4MSearch=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
