/* Flip4M paired experiments. Shared analysis; only final move policy differs.
 * Unlike a strength tournament between independent programs, both policies observe
 * the same funded report at each encountered position. No DCC-only compute subsidy.
 */
(function(root){'use strict';
const E=root.F4M||(typeof require==='function'?require('./f4m-core.js'):null);
const S=root.F4MSearch||(typeof require==='function'?require('./f4m-search.js'):null);
const C=root.F4MClassical||(typeof require==='function'?require('./f4m-classical.js'):null);
const D=root.F4MDCC||(typeof require==='function'?require('./f4m-dcc.js'):null);
const VERSION='1.1.0',clone=x=>JSON.parse(JSON.stringify(x));
function rng(seed){let x=seed>>>0;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function fingerprint(text){let a=2166136261;for(const c of text){a^=c.charCodeAt(0);a=Math.imul(a,16777619);}return (a>>>0).toString(16).padStart(8,'0');}
function opening(tools,seed,plies=6,stress=false){
 let s=E.create(tools),random=rng(seed),moves=[];
 for(let i=0;i<plies;i++){
  let a=E.legal(s).filter(a=>!E.action(s,a).result);const type=stress&&i>=6?(i%4===2?'flip':i%4===3?'magnet':'drop'):'drop';const preferred=a.filter(a=>a.type===type);a=preferred.length?preferred:a.filter(a=>a.type==='drop');
  if(!a.length)break;const m=a[Math.floor(random()*a.length)];s=E.action(s,m);moves.push(m);
 }
 return {state:s,moves};
}
function decide(state,options={},dcc={},progress=()=>{}){
 const start=performance.now(),report=S.analyze(state,options,progress),policyStart=performance.now();
 const classical=C.select(report),governed=D.select(report,dcc);
 return {report,classical,dcc:governed,policy_ms:performance.now()-policyStart,total_ms:performance.now()-start};
}
function create(config={},current=E.create(2)){
 const cfg={pairs:Math.max(1,Math.min(100,Math.trunc(config.pairs||1))),single:config.single===true,
  seed:(Number.isFinite(Number(config.seed))?Number(config.seed):20260912)>>>0,tools:[0,2,3].includes(Number(config.tools))?Number(config.tools):2,
  start:['seeded','stress','current','empty'].includes(config.start)?config.start:'seeded',
  red:config.red==='dcc'?'dcc':'classical',yellow:config.yellow==='classical'?'classical':'dcc',
  budget:S.normalizeBudget({mode:'work',work:10000,...config.budget}),
  dcc:clone(config.dcc||{}),maxPlies:Math.max(1,Math.min(256,Math.trunc(config.maxPlies||96)))};
 const starts=[];
 for(let i=0;i<(cfg.single?1:cfg.pairs);i++){
  const op=(cfg.start==='seeded'||cfg.start==='stress')?opening(cfg.tools,(cfg.seed+i)>>>0,cfg.start==='stress'?12:6,cfg.start==='stress'):{state:cfg.start==='current'?E.validate(current):E.create(cfg.tools),moves:[]};
  if(op.state.result)throw Error('Simulation requires a non-terminal starting position');starts.push(op);
 }
 const signature=fingerprint(JSON.stringify(cfg)+'|'+starts.map(s=>E.key(s.state)).join('|'));
 return {format:'flip4m.lab.batch',schema:1,version:VERSION,rules:E.RULES,experimentId:'f4m-'+signature,
  instanceId:'f4m-'+signature+'-'+new Date().toISOString(),startedAt:new Date().toISOString(),config:cfg,starts,runs:[],active:null,status:'paused',nextIndex:0};
}
function count(batch){return batch.config.single?1:batch.starts.length*2;}
function begin(batch){
 if(batch.active)return batch.active;
 if(batch.nextIndex>=count(batch)){batch.status='complete';return null;}
 const i=batch.nextIndex,pair=batch.config.single?0:Math.floor(i/2),leg=batch.config.single?0:i%2,op=batch.starts[pair];
 const policies=leg?{1:batch.config.yellow,2:batch.config.red}:{1:batch.config.red,2:batch.config.yellow};
 batch.active={id:batch.experimentId+'-'+i,index:i,pair,leg,seed:batch.config.seed+pair,policies,
  start:E.copy(op.state),openingMoves:clone(op.moves),position:E.copy(op.state),trace:[],state:'running',result:null,reason:'',startedAt:new Date().toISOString()};
 batch.status='running';return batch.active;
}
function append(batch,bundle,presentationMs=0,wallMs=bundle.total_ms){
 const run=begin(batch);if(!run)throw Error('Batch finished');
 const before=run.position,key=E.key(before);
 if(bundle.report.stateKey!==key)throw Error('Stale analysis');
 const policy=run.policies[before.curPlayer],choice=policy==='dcc'?bundle.dcc:bundle.classical,m=choice.selected?.move;
 if(!m||!E.validMove(before,m))throw Error('Engine returned an illegal move');
 const after=E.action(before,m),report=bundle.report,raw=bundle.classical.selected;
 const row={ply:run.trace.length+1,side:before.curPlayer,policy,move:clone(m),beforeKey:key,afterKey:E.key(after),
  rawBest:raw.id,dccChoice:bundle.dcc.selected?.id||null,rawScore:choice.selected.score,rawGap:raw.score-choice.selected.score,
  changed:choice.selected.id!==raw.id,dccWouldChange:bundle.dcc.changed,dccCoverage:bundle.dcc.coverage,reason:choice.reason,
  engineVersion:report.version,stopReason:report.stopReason,effectiveBudget:clone(report.budget),
  depth:report.depth,work:report.work,nodes:report.nodes,compute_ms:bundle.total_ms,analysis_ms:report.elapsed,policy_ms:bundle.policy_ms,
  presentation_ms:presentationMs,wall_ms:wallMs,atUTC:new Date().toISOString(),
  sensors:clone(choice.selected.sensors),rootCandidates:report.candidates.map(c=>({id:c.id,score:c.score,depth:c.depth,safe:c.safe,byDepth:c.byDepth,sensors:c.sensors}))};
 run.trace.push(row);run.position=after;
 if(after.result){run.result=after.result;run.state='complete';run.reason=after.result===3?'board-full':'connect-four';}
 else if(run.trace.length>=batch.config.maxPlies){run.state='incomplete';run.reason='move-cap';}
 if(run.state!=='running'){run.finishedAt=new Date().toISOString();batch.runs.push(run);batch.active=null;batch.nextIndex++;if(batch.nextIndex>=count(batch))batch.status='complete';}
 return {run,row,position:after,finished:run.state!=='running'};
}
function stop(batch,reason='paused'){batch.status='paused';if(batch.active)batch.active.pauseReason=reason;}
function restore(raw){
 if(!raw||raw.format!=='flip4m.lab.batch'||raw.schema!==1||raw.rules!==E.RULES)throw Error('Invalid batch schema');
 if(!Array.isArray(raw.starts)||raw.starts.length>100||!Array.isArray(raw.runs)||raw.runs.length>200)throw Error('Invalid batch size');
 const out=clone(raw),cfg=out.config;
 // Pre-1.1 experiments used a combined deadline+work cap. Preserve their contract.
 if(out.version==='1.0.0'&&cfg?.budget?.mode==='time')cfg.budget.legacyWorkLimit=true;
 if(!cfg||!['time','work'].includes(cfg.budget?.mode)||!Number.isInteger(cfg.budget.work)||cfg.budget.work<128||cfg.budget.work>2000000||!Number.isFinite(cfg.budget.ms)||cfg.budget.ms<30||cfg.budget.ms>S.LIMITS.ms||!Number.isInteger(cfg.budget.depth)||cfg.budget.depth<1||cfg.budget.depth>S.LIMITS.depth||!Number.isInteger(out.nextIndex)||!Number.isInteger(cfg.pairs)||cfg.pairs<1||cfg.pairs>100||!['seeded','stress','current','empty'].includes(cfg.start)||![0,2,3].includes(cfg.tools)||!['classical','dcc'].includes(cfg.red)||!['classical','dcc'].includes(cfg.yellow)||!Number.isInteger(cfg.maxPlies)||cfg.maxPlies<1||cfg.maxPlies>256)throw Error('Invalid batch configuration');
 if(out.starts.length!==(cfg.single?1:cfg.pairs))throw Error('Opening count mismatch');
 out.starts.forEach(x=>{x.state=E.validate(x.state);});
 function verify(run){
  if(!run||!Array.isArray(run.trace)||run.trace.length>256||![0,1].includes(run.leg)||!Number.isInteger(run.pair)||run.pair<0||run.pair>=out.starts.length)throw Error('Invalid run');
  let s=E.validate(run.start);if(E.key(s)!==E.key(out.starts[run.pair].state))throw Error('Start mismatch');
  const expected=run.leg?{1:cfg.yellow,2:cfg.red}:{1:cfg.red,2:cfg.yellow};
  if(run.policies[1]!==expected[1]||run.policies[2]!==expected[2])throw Error('Policy mismatch');
  for(const row of run.trace){if(row.side!==s.curPlayer||row.policy!==expected[s.curPlayer]||row.beforeKey!==E.key(s)||!E.validMove(s,row.move))throw Error('Invalid simulation trace');s=E.action(s,row.move);if(row.afterKey!==E.key(s))throw Error('Trace transition mismatch');}
  if(E.key(s)!==E.key(E.validate(run.position)))throw Error('Run position mismatch');
  if(run.state==='complete'&&(!s.result||s.result!==run.result))throw Error('Invalid game result');
  run.position=s;
 }
 out.runs.forEach(verify);if(out.active)verify(out.active);
 if(out.nextIndex!==out.runs.length||out.nextIndex>count(out))throw Error('Invalid batch cursor');
 out.status=out.nextIndex===count(out)?'complete':'paused';return out;
}
function summarize(batch){
 const all=[...batch.runs,...(batch.active?[batch.active]:[])],complete=all.filter(r=>r.state==='complete');
 const rows=all.flatMap(r=>r.trace),dcc=complete.filter(r=>r.policies[1]!==r.policies[2]);
 const score=r=>r.result===3?0.5:r.policies[r.result]==='dcc'?1:0;
 const w=dcc.filter(r=>score(r)===1).length,d=dcc.filter(r=>score(r)===.5).length;
 const byPolicy={};for(const p of ['classical','dcc']){const a=rows.filter(r=>r.policy===p);byPolicy[p]={moves:a.length,meanComputeMs:a.length?a.reduce((s,r)=>s+r.compute_ms,0)/a.length:null,
  meanDepth:a.length?a.reduce((s,r)=>s+r.depth,0)/a.length:null,work:a.reduce((s,r)=>s+r.work,0),flips:a.filter(r=>r.move.type==='flip').length,magnets:a.filter(r=>r.move.type==='magnet').length,changes:a.filter(r=>r.changed).length};}
 const pairs=[];
 for(let i=0;i<batch.starts.length;i++){const a=dcc.filter(r=>r.pair===i);if(a.length===2)pairs.push({key:E.key(batch.starts[i].state),score:(score(a[0])+score(a[1]))/2});}
 const clusters=new Map();for(const p of pairs){if(!clusters.has(p.key))clusters.set(p.key,[]);clusters.get(p.key).push(p.score);}
 const means=[...clusters.values()].map(a=>a.reduce((x,y)=>x+y,0)/a.length);let ci=null;
 if(means.length>=5){const random=rng(7141),boot=[];for(let b=0;b<2000;b++){let x=0;for(let i=0;i<means.length;i++)x+=means[Math.floor(random()*means.length)];boot.push(x/means.length);}boot.sort((a,b)=>a-b);ci=[boot[50],boot[1949]];}
 return {games:complete.length,planned:count(batch),incomplete:all.filter(r=>r.state==='incomplete').length,dccWins:w,classicalWins:dcc.length-w-d,draws:d,
  dccScore:dcc.length?(w+d/2)/dcc.length:null,redWins:complete.filter(r=>r.result===1).length,yellowWins:complete.filter(r=>r.result===2).length,
  pairs:pairs.length,uniqueStarts:clusters.size,pairedScore:means.length?means.reduce((a,b)=>a+b,0)/means.length:null,pairBootstrap95:ci,
  byPolicy,coverageGaps:rows.filter(r=>r.dccCoverage!=='complete').length,
  evidence:'Descriptive paired policy experiment, not Elo or consciousness evidence. CI clusters identical starts; fewer than 5 unique pairs: no interval.'};
}
function csv(batch){
 const keys=['experiment','pair','leg','result','termination','ply','side','policy','move','rawBest','dccChoice','rawScore','rawGap','changed','dccWouldChange','dccCoverage','depth','work','nodes','compute_ms','analysis_ms','policy_ms','presentation_ms','wall_ms','atUTC'];
 const q=x=>'"'+String(x??'').replaceAll('"','""')+'"';const lines=[keys.join(',')];
 for(const run of [...batch.runs,...(batch.active?[batch.active]:[])])for(const row of run.trace){const r={...row,experiment:batch.experimentId,pair:run.pair,leg:run.leg,result:run.result,termination:run.reason,move:E.moveId(row.move)};lines.push(keys.map(k=>q(r[k])).join(','));}
 return lines.join('\n')+'\n';
}
const api={VERSION,rng,fingerprint,opening,decide,create,count,begin,append,stop,restore,summarize,csv};root.F4MSim=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
