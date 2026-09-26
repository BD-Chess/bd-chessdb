// Actual shipped /S/new/app.html engine; frozen previous implementation is the
// independent count-to-two reference. Corpus is exposed development evidence,
// not a holdout. Run: node --test tests/sudoku-engine-core.test.cjs
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {test}=require('node:test'),{performance}=require('node:perf_hooks');
const fixture=name=>path.join(__dirname,'fixtures',name);
const base=fs.readFileSync(fixture('sudoku-navigator-v020.cjs'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../public/S/new/app.html'),'utf8');
const source=html.match(/<script id="navigator-core">([\s\S]*?)<\/script>/)?.[1];
assert(source,'navigator-core script must exist');
function core(src){const sandbox={module:{exports:{}},performance};vm.runInNewContext(src,sandbox);return sandbox.module.exports;}
const old=core(base),fast=core(source),corpus=JSON.parse(fs.readFileSync(fixture('sudoku-arena-31.json'),'utf8')).puzzles;
const list=x=>JSON.parse(JSON.stringify(x));
function valid(board,givens){assert.equal(board.length,81);for(const u of fast.U)assert.equal(new Set(u.map(i=>board[i])).size,9);for(let i=0;i<81;i++){assert(board[i]>=1&&board[i]<=9);if(+givens[i])assert.equal(board[i],+givens[i]);}}
function candidates(b){let n=0;for(let i=0;i<81;i++)if(!b[i]){const used=new Set(fast.P[i].map(j=>b[j]));for(let d=1;d<=9;d++)if(!used.has(d))n++;}return n;}
function replay(input,res){
 const b=Array.from(input,Number);assert(res.log.length<=20000);
 for(const [index,e]of res.log.entries()){
  assert.equal(e.step,index+1);assert.equal(e.cb,candidates(b),'cb at '+index);
  if(e.cascadeStatus){let forced=0;for(let j=index+1;j<res.log.length&&!res.log[j].backtrack&&res.log[j].strategy!=='guess';j++)forced++;assert.equal(e.cascade,forced,'observed cascade at '+index);}
  if(e.backtrack){assert.equal(e.strategy,'backtrack');for(const {r,c}of e.restore){assert.equal(+input[r*9+c],0);assert.notEqual(b[r*9+c],0);b[r*9+c]=0;}}
  else{
   const i=e.r*9+e.c;assert.equal(b[i],0);assert(!fast.P[i].some(j=>b[j]===e.v));
   if(e.strategy==='naked_single')assert.equal(new Set(fast.P[i].map(j=>b[j]).filter(Boolean)).size,8);
   if(e.strategy==='hidden_single')assert(fast.U.some(u=>u.includes(i)&&!u.some(j=>b[j]===e.v)&&u.filter(j=>!b[j]&&!fast.P[j].some(k=>b[k]===e.v)).length===1));
   b[i]=e.v;
  }
  assert.equal(e.ca,candidates(b),'ca at '+index);
 }
 assert.deepEqual(b,list(res.solved.flat()));if(res.status==='SOLVED')valid(b,input);
}
const empty='0'.repeat(81),sol=corpus[0].solution;

test('31 development puzzles: independent uniqueness and expected solution agreement',()=>{
 assert.equal(corpus.length,31);
 for(const p of corpus){const x=fast.exact(p.puzzle,1000000),y=old.exact(p.puzzle,1000000);assert.equal(x.complete,true,p.id);assert.equal(x.count,y.count,p.id);assert.equal(x.count,1,p.id);assert.equal(x.solution.join(''),p.solution,p.id);valid(x.solution,p.puzzle);}
});
test('31 real solver traces: legal evidence, exact candidate counts, cascades and rollback replay',()=>{
 let backtracks=0;
 for(const p of corpus){const r=fast.solveFast(p.puzzle);assert.equal(r.status,'SOLVED',p.id);replay(p.puzzle,r);backtracks+=r.stats.backtracks;}
 assert(backtracks>0,'corpus must exercise failed search branches');
});
test('multiple, complete solved, duplicate and malformed givens are classified honestly',()=>{
 assert.equal(fast.exact(empty).count,2);assert.equal(fast.exact(empty).status,'MULTIPLE');assert.equal(fast.exact(sol).count,1);
 const duplicate='11'+'0'.repeat(79);assert.equal(fast.exact(duplicate).status,'INVALID');assert.equal(fast.solveFast(duplicate).status,'INVALID');
 assert.throws(()=>fast.exact('0'.repeat(80)));assert.throws(()=>fast.exact([-1,...Array(80).fill(0)]));
});
test('budgets include forced placements; limited exact and trace results remain incomplete',()=>{
 for(const cap of [0,1,2,7,20,50]){const r=fast.exact(empty,cap);assert(r.nodes<=cap);assert.equal(r.complete,false);assert.equal(r.status,'LIMIT');const s=fast.solveFast(empty,{maxNodes:cap});assert(s.stats.nodes<=cap);assert.equal(s.status,'LIMIT');replay(empty,s);}
 const forced=sol.slice(0,80)+'0';assert.equal(fast.exact(forced,1).status,'LIMIT');assert.equal(fast.exact(forced,2).status,'UNIQUE');
});
test('a found solution under an incomplete uniqueness search is never certified unique',()=>{
 let limited=null;
 for(const p of corpus){const total=fast.exact(p.puzzle).nodes;for(let cap=1;cap<total;cap++){const r=fast.exact(p.puzzle,cap);if(r.count===1&&!r.complete){limited=r;break;}}if(limited)break;}
 assert(limited,'fixture must exercise a first solution before uniqueness exhaustion');assert.equal(limited.status,'LIMIT');assert(limited.solution);
});
test('legal-looking unsatisfiable givens are independently rejected and trace restores correctly',()=>{
 let unsat=null;
 for(const p of corpus){const b=Array.from(p.puzzle,Number);for(let i=0;i<81&&!unsat;i++)if(!b[i])for(let d=1;d<=9&&!unsat;d++)if(d!==+p.solution[i]&&!fast.P[i].some(j=>b[j]===d)){b[i]=d;const r=old.exact(b,1000000);if(r.complete&&r.count===0)unsat=b.join('');b[i]=0;}if(unsat)break;}
 assert(unsat);assert.equal(fast.exact(unsat).status,'UNSAT');const no=fast.solveFast(unsat);assert.equal(no.status,'UNSAT');replay(unsat,no);
});
test('trace truncation leaves a replayable exact partial board without fabricated completion',()=>{
 for(const cap of [0,1,5,17,40,80]){const r=fast.solveFast(corpus[0].puzzle,{maxLog:cap});assert(r.log.length<=cap);replay(corpus[0].puzzle,r);if(r.status==='LIMIT')assert.equal(r.complete,false);}
});
test('first-solution randomized generation is deterministic for 20 repeated seeds',()=>{
 for(let seed=1;seed<=20;seed++){const a=fast.exact(empty,100000,fast.rng(seed)),b=fast.exact(empty,100000,fast.rng(seed));assert.equal(a.status,'FOUND');assert.equal(a.searchMode,'FIRST_SOLUTION');assert.deepEqual(list(a),list(b));valid(a.solution,empty);}
});
test('12 generated puzzles: independent uniqueness and explicit difficulty evidence',()=>{
 for(const diff of ['easy','medium','hard','evil'])for(const seed of [4,18,29]){
  const a=fast.generate({diff,seed}),b=fast.generate({diff,seed});assert.equal(a.status,'GENERATED');assert.deepEqual(list(a),list(b));assert.equal(a.givens,a.puzzle.filter(Boolean).length);
  assert.equal(a.difficultyEvidence.actualGivens,a.givens);assert.equal(a.difficultyEvidence.requestedClueCountReached,a.givens===a.requestedGivens);assert.equal(a.uniqueness.status,'UNIQUE');
  const check=old.exact(a.puzzle,1000000);assert.equal(check.complete,true);assert.equal(check.count,1);assert.deepEqual(list(check.solution),list(a.solution));
 }
});
