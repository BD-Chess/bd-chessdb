// Bounded exposed-development benchmark; no arena or heldout research run.
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {performance}=require('node:perf_hooks');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'public/S/new/app.html'),'utf8');
const baseline=fs.readFileSync(path.join(root,'tests/fixtures/sudoku-navigator-v020.cjs'),'utf8');
const corpus=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/sudoku-arena-31.json'),'utf8'));
function load(source){const s={module:{exports:{}},performance};vm.runInNewContext(source,s);return s.module.exports;}
const old=load(baseline),current=load(html.match(/<script id="navigator-core">([\s\S]*?)<\/script>/)[1]);
const timed=fn=>{const start=performance.now();fn();return performance.now()-start;};
const median=xs=>xs.slice().sort((a,b)=>a-b)[xs.length>>1];
const exact=c=>{for(const p of corpus.puzzles){const r=c.exact(p.puzzle,1000000);if(!r.complete||r.count!==1||r.solution.join('')!==p.solution)throw Error('EXACT_FAILURE '+p.id);}};
const generate=c=>{for(const diff of ['easy','medium','hard','evil'])for(const seed of [4,18,29]){const r=c.generate({diff,seed});if(r.status!=='GENERATED'||!r.unique)throw Error('GENERATION_FAILURE');}};
function measure(fn,passes){fn(old);fn(current);const oldMs=[],newMs=[];for(let i=0;i<passes;i++)for(const key of i%2?['new','old']:['old','new'])(key==='old'?oldMs:newMs).push(timed(()=>fn(key==='old'?old:current)));return{oldMs,newMs,oldMedianMs:median(oldMs),newMedianMs:median(newMs),speedup:median(oldMs)/median(newMs)};}
const result={status:'PASS',recordedAt:new Date().toISOString(),node:process.version,engineRevision:current.ENGINE_REVISION,appSha256:crypto.createHash('sha256').update(html).digest('hex'),baselineCoreSha256:crypto.createHash('sha256').update(baseline).digest('hex'),corpusSourceSha3_256:corpus.source_snapshot_sha3_256,boundary:'Exposed development set, same Node process. Not heldout, not phone/browser wall-time or a DCC-specific superiority claim.',exact:{scope:'31 identical puzzles; complete count-to-two uniqueness and answer agreement; 7 alternating batches',...measure(exact,7)},generation:{scope:'4 profiles × 3 identical seeds, 5 alternating batches; generated puzzle instances differ by algorithm',...measure(generate,5)}};
process.stdout.write(JSON.stringify(result,null,2)+'\n');
