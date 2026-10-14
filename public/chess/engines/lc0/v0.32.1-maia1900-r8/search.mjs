// SPDX-License-Identifier: GPL-3.0-or-later
// Deterministic browser PUCT; independent search, not native lc0's UCI search.
import { Chess } from './chess.mjs';
import { infer } from './neural.mjs';
const now = () => performance.now();
const taskYield = () => new Promise(resolve => setTimeout(resolve, 0));
const RETAINED_NODE_LIMIT = 32768;
function node(prior=1, move=null) { return {prior,move,n:0,w:0,wdlSum:[0,0,0],children:null,terminal:false,v:0,wdl:null}; }
function mean(n) { return n.n ? n.w/n.n : n.v; }
function terminal(chess, history) {
  if (chess.isCheckmate()) return {q:-1,wdl:[0,0,1],kind:'checkmate'};
  if (chess.isStalemate() || chess.isInsufficientMaterial() || Number(chess.fen().split(' ')[4]) >= 100) return {q:0,wdl:[0,1,0],kind:'draw'};
  const key = chess.fen().split(' ').slice(0,4).join(' ');
  if (history.filter(f => {
    const parts=f.split(' ');
    if(parts[3]!=='-')return new Chess(f).fen().split(' ').slice(0,4).join(' ')===key;
    return parts.slice(0,4).join(' ')===key;
  }).length >= 3) return {q:0,wdl:[0,1,0],kind:'threefold'};
  return null;
}
function choose(parent) {
  let best = null, bestScore = -Infinity;
  for (const child of parent.children || []) {
    const q = child.n ? -mean(child) : mean(parent) - 0.2;
    const score = q + 1.745 * child.prior * Math.sqrt(Math.max(1,parent.n)) / (1 + child.n);
    if (score > bestScore) {best=child;bestScore=score;}
  }
  return best;
}
function pv(child) {
  const out=[];
  for (let n=child; n?.move && out.length<24;) {
    out.push(n.move.uci);
    n=(n.children || []).filter(c=>c.n>0).sort((a,b)=>b.n-a.n || -mean(b)+mean(a))[0];
  }
  return out;
}
function snapshot(root, fen, started, budget, multiPV, reason, evaluations, memory) {
  const black=fen.split(' ')[1]==='b';
  const ranked=(root.children || []).filter(child=>child.n>0).sort((a,b)=>b.n-a.n || b.prior-a.prior);
  const lines=ranked.slice(0,multiPV).map((child,index)=>{
    const q=-mean(child);
    const wdl=[child.wdlSum[2]/child.n,child.wdlSum[1]/child.n,child.wdlSum[0]/child.n];
    return {multipv:index+1,pv:pv(child),visits:child.n,prior:child.prior,score:{type:'q',root:q,white:black ? -q : q,wdl,wdlWhite:black&&wdl ? [wdl[2],wdl[1],wdl[0]] : wdl}};
  });
  return {engine:'lc0',fen,nodes:root.n,visits:root.n,evaluations,depth:undefined,lines,bestmove:lines[0]?.pv[0] || null,
    score:lines[0]?.score || {type:'q',root:mean(root),white:black ? -mean(root) : mean(root),wdl:root.wdl},
    model:'Maia 1900 / 64x6-SE',runtime:'ONNX Runtime Web 1.24.1 / WASM SIMD / 1 thread',search:'browser PUCT',
    requestedMs:Number.isFinite(budget)?budget:null,infinite:!Number.isFinite(budget),actualSearchMs:now()-started,stopReason:reason,
    coverage:{visitedMoves:ranked.length,legalMoves:root.children?.length||0},memory:{...memory},searchComplete:reason==='time'||reason==='terminal',nativeUciSearch:false};
}
export async function search({ort,session,fen,history=[],movetime=5000,infinite=false,multiPV=3,retainedNodeLimit=RETAINED_NODE_LIMIT,isStopped=()=>false,onInfo=()=>{}}) {
  const requested=Number(movetime);
  if(!infinite && (!Number.isFinite(requested)||requested<1||requested>14400000))throw new Error('LCZero movetime must be 1..14400000 ms, or infinite');
  const budget=infinite?Infinity:requested;
  const started=now(),deadline=started+budget;
  const validHistory=Array.isArray(history) && history.length && history.every(f=>typeof f==='string'&&f.includes('/')) && history[history.length-1]===fen ? history.slice() : [];
  const root=node(); let evaluations=0,lastInfo=started,reason='time';
  const memory={retainedNodes:1,compactions:0,retainedNodeLimit:Math.max(256,Math.min(RETAINED_NODE_LIMIT,Number(retainedNodeLimit)||RETAINED_NODE_LIMIT))};
  function compact(n,depth=0) {
    // Preserve sampled N/Q/WDL on root and its immediate children. Drop only
    // deeper frontier allocations; revisit re-expands from the actual NN.
    if(depth>=1 && !n.terminal){n.children=null;return 1;}
    return 1+(n.children||[]).reduce((count,child)=>count+compact(child,depth+1),0);
  }
  const report=stopReason=>snapshot(root,fen,started,budget,multiPV,stopReason,evaluations,memory);
  async function expand(n,chess,fens) {
    const t=terminal(chess,fens);
    const ev=t || await infer(ort,session,chess,fens);
    if (!t) evaluations++;
    n.v=ev.q;n.wdl=ev.wdl;n.terminal=!!t;
    n.children=t ? [] : ev.priors.map(m=>node(m.prior,m));
    memory.retainedNodes+=n.children.length;
    return ev;
  }
  const initial=new Chess(fen),rootEv=await expand(root,initial,validHistory);
  root.n=1;root.w=rootEv.q;root.wdlSum=rootEv.wdl.slice();
  if (root.terminal) return report('terminal');
  onInfo(report('running'));
  await taskYield();
  while(now()<deadline) {
    if(isStopped()){reason='cancelled';break;}
    const chess=new Chess(fen), path=[root],fens=validHistory.length ? validHistory.slice() : [fen];
    let n=root;
    while(n.children?.length) {
      n=choose(n);chess.move(n.move.move);path.push(n);fens.push(chess.fen());
      if(!n.children) break;
    }
    const ev=n.terminal ? {q:n.v,wdl:n.wdl} : await expand(n,chess,fens);
    let q=ev.q,wdl=ev.wdl;
    for(let i=path.length-1;i>=0;i--) {
      const at=path[i];at.n++;at.w+=q;for(let j=0;j<3;j++) at.wdlSum[j]+=wdl[j];
      q=-q;wdl=[wdl[2],wdl[1],wdl[0]];
    }
    if(memory.retainedNodes>memory.retainedNodeLimit){memory.retainedNodes=compact(root);memory.compactions++;}
    if(now()-lastInfo>=150){onInfo(report('running'));lastInfo=now();}
    // Let worker process stop/new-position commands between neural calls.
    await taskYield();
  }
  if(isStopped())reason='cancelled';
  return report(reason);
}
