/* Policy experiments: seeded paired starts, exact action trace, no game clock limit.
   Inspired by ChessSim contract; chess notation/eval scales are NOT reused. */
(function(root,factory){const node=typeof module==='object'&&module.exports;const api=factory(node?require('./f4m-core.js'):root.F4M);if(node)module.exports=api;root.F4MSim=api;})(globalThis,function(E){
'use strict';const VERSION='1.0.0';
function rng(seed){let x=seed>>>0;return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
function opening(base,seed,plies){const rand=rng(seed);let s=E.copy(base);const prefix=[];for(let i=0;i<plies&&!s.result;i++){let all=E.legal(s).map(a=>({a,n:E.action(s,a)})).filter(x=>!x.n.result);if(!all.length)break;const drops=all.filter(x=>x.a.type==='drop');const pool=drops.length&&rand()<0.8?drops:all;const r=pool[Math.floor(rand()*pool.length)];prefix.push(r.a);s=r.n;}return {state:s,prefix};}
function plan(base,config,stamp=new Date().toISOString()){
 const pairs=Math.max(1,Math.min(100,Math.trunc(+config.pairs||1))),seed=(+config.seed||20260912)>>>0,red=config.red==='dcc'?'dcc':'classical',yellow=config.yellow==='classical'?'classical':'dcc';
 const jobs=[];for(let i=0;i<pairs;i++){const start=opening(base,(seed+i)>>>0,config.seeded?4:0);const count=config.paired?2:1;for(let j=0;j<count;j++)jobs.push({pair:i,seed:(seed+i)>>>0,leg:j,red:j?yellow:red,yellow:j?red:yellow,start:E.copy(start.state),prefix:start.prefix,positionKey:E.key(start.state)});}
 return {version:VERSION,id:'f4m-'+stamp.replace(/[^0-9]/g,'')+'-'+seed,startedAt:stamp,config:JSON.parse(JSON.stringify(config)),jobs,index:0,runs:[],status:'ready'};
}
function begin(t){const j=t.jobs[t.index];if(!j)return null;const run={id:t.id+'-'+t.index,pair:j.pair,seed:j.seed,leg:j.leg,red:j.red,yellow:j.yellow,positionKey:j.positionKey,start:E.copy(j.start),prefix:j.prefix,trace:[],status:'running',result:0,termination:null,config:t.config};t.runs.push(run);t.status='running';return run;}
function record(run,before,after,answer,policy,atUTC){
 if(E.key(before)!==answer.report.positionKey)throw Error('Stale analysis');
 const pick=policy==='dcc'?answer.dcc:answer.classical;
 if(!pick||!E.validMove(before,pick.move))throw Error('Illegal simulation choice');
 const expected=E.action(before,pick.move);if(E.key(expected)!==E.key(after))throw Error('Trace state mismatch');
 const row={ply:run.trace.length+1,player:before.curPlayer,policy,move:pick.move,before:E.key(before),after:E.key(after),raw_best:answer.classical.move,dcc_choice:answer.dcc.move,changed:answer.dcc.changed,chosen_raw:pick.raw,raw_gap:policy==='dcc'?answer.dcc.rawGap:0,coverage:answer.report.coverage,depth:answer.report.depth,nodes:answer.report.nodes,work:answer.report.work,compute_ms:answer.compute_ms,analysis_ms:answer.report.elapsed_ms,selector_ms:answer.selector_ms,at_utc:atUTC,budgetMode:answer.report.mode,budget:answer.report.budget,resources_after:JSON.parse(JSON.stringify(after.tokens)),sensorTable:answer.dcc.sensorTable};
 run.trace.push(row);if(after.result){run.result=after.result;run.status='complete';run.termination=after.result===3?'board-full':'connect-four';}return row;
}
function summary(t){
 const runs=t?.runs||[],done=runs.filter(r=>r.status==='complete'),contests=done.filter(r=>r.red!==r.yellow),groups=new Map();
 let w=0,l=0,d=0,redDcc={games:0,points:0},yellowDcc={games:0,points:0};
 for(const r of contests){const p=r.result===3?0.5:((r.result===1?r.red:r.yellow)==='dcc'?1:0);if(p===1)w++;else if(p===0)l++;else d++;const color=r.red==='dcc'?redDcc:yellowDcc;color.games++;color.points+=p;
  const key=r.positionKey;const g=groups.get(key)||{points:0,games:0};g.points+=p;g.games++;groups.set(key,g);
 }
 // Descriptive cluster bootstrap over UNIQUE start positions, never duplicate games.
 const cluster=[...groups.values()].filter(g=>g.games>=2).map(g=>g.points/g.games);let ci=null;
 if(cluster.length>=5){const random=rng(113),samples=[];for(let b=0;b<2000;b++){let x=0;for(let i=0;i<cluster.length;i++)x+=cluster[Math.floor(random()*cluster.length)];samples.push(x/cluster.length);}samples.sort((a,b)=>a-b);ci=[samples[49],samples[1949]];}
 const trace=done.flatMap(r=>r.trace),interventions=trace.filter(r=>r.changed).length;
 const sideStats={classical:{moves:0,compute_ms:0,flips:0,magnets:0},dcc:{moves:0,compute_ms:0,flips:0,magnets:0}};
 for(const row of trace){const p=sideStats[row.policy];p.moves++;p.compute_ms+=row.compute_ms||0;if(row.move.type==='flip')p.flips++;if(row.move.type==='magnet')p.magnets++;}
 return {games:done.length,pending:runs.filter(r=>r.status!=='complete').length,w,l,d,score:contests.length?(w+d/2)/contests.length:null,uniqueStarts:groups.size,pairedClusters:cluster.length,ci,ciMethod:'descriptive bootstrap over unique-start clusters; minimum 5 complete paired starts',redDcc,yellowDcc,interventions,comparedMoves:trace.length,coverageGaps:trace.filter(r=>r.coverage!=='complete').length,sideStats};
}
function csv(t){const keys=['run_id','pair','seed','leg','red','yellow','status','result','ply','player','policy','move','raw_best','dcc_choice','changed','chosen_raw','raw_gap','coverage','depth','nodes','work','compute_ms','analysis_ms','selector_ms','budgetMode','budget','at_utc'];const q=x=>'"'+String(typeof x==='object'?JSON.stringify(x):x??'').replace(/"/g,'""')+'"';const rows=[keys.join(',')];for(const r of t?.runs||[])for(const a of r.trace){const row={...r,...a,run_id:r.id};rows.push(keys.map(k=>q(row[k])).join(','));}return rows.join('\n')+'\n';}
return {VERSION,rng,opening,plan,begin,record,summary,csv};
});
