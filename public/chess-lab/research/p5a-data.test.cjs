const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../js/8zc-data-core.js');
const deps={Chess:require('../js/chess.min.js').Chess,Study:require('../js/8zc-study-core.js'),StudyStore:require('../js/8zc-study-store.js'),Evidence:require('../js/8zc-evidence.js'),Sim:require('../js/8zc-sim-store.js')};
const copy=v=>JSON.parse(JSON.stringify(v));
function fixture() {
  const p=C.empty(),g=new deps.Chess();g.move('e4');g.move('e5');g.move('Nf3');
  const pgn='[Event "Synthetic DATA"]\n[Result "*"]\n\n1. e4 {keep this comment} (1. d4 d5) e5 2. Nf3 *',middle=new deps.Chess();middle.move('e4');
  p.game={schema:'chessbest-game/1',pgn,topPick:null,resume:{cursor:1,totalPlies:3,pgnLength:pgn.length,fen:middle.fen()}};
  const study=deps.Study.parsePGN(deps.Chess,pgn);study.id='fixture-study';study.title='<img src=x onerror=globalThis.injected=true>';
  p.studies.collection={...deps.StudyStore.empty(),studies:[study],activeId:study.id};
  const collector=deps.Evidence.createCollector();collector.capture({kind:'score',fen:g.fen(),source:'synthetic',response:12});
  p.evidence.snapshots=[collector.snapshot({receipt:{fen:g.fen()}},{label:'Synthetic',createdAt:'2026-10-18T00:00:00Z'})];
  p.preferences={settings:{theme:'dark',showTimers:true},analysis:{analysisMode:'sf-lite',boardSource:'cdb'},layout:{},language:'en',appWidth:'402',showTopLine:'0'};
  p.simulation.runs=[{id:'run-1',eventId:'event-1',pgn:'1. e4 *',state:'paused',trace:[],_storeRevision:1}];
  p.simulation.events=[{id:'event-1',name:'Synthetic tournament',state:'paused',games:[{runId:'run-1',state:'paused'}],_storeRevision:1}];
  return p;
}
test('DATA v1 exact schema, canonical hash and complete line/cursor/variation are stable',async()=>{
  const p=fixture(),v=await C.pack(p,{channel:'LAB',release:'fixture-v1'},deps);
  assert.deepEqual((await C.parse(C.canonical(v),deps)).payload,copy(p));
  assert.equal(await C.digest({z:1,a:{d:2,b:3}}),await C.digest({a:{b:3,d:2},z:1}));
  assert.equal(v.manifest.counts.gamePlies,3);assert.equal(v.manifest.counts.studies,1);
  assert.match(v.payload.game.pgn,/\(1\. d4 d5\)/);
});
for(const [name,mutate] of [
  ['future version',v=>v.version=2],['future section',v=>v.sections.game=2],['missing section',v=>delete v.payload.recovery],
  ['untrusted target namespace',v=>v.payload.namespace='ChessBest:CURRENT:v2:'],
  ['numeric Sim ID',v=>v.payload.simulation.runs[0].id=1],
  ['numeric Sim reference',v=>v.payload.simulation.events[0].games[0].runId=1],
  ['wrong preference type',v=>v.payload.preferences.settings.showTimers='yes'],
  ['hash',v=>v.sha256='0'.repeat(64)],['count',v=>v.manifest.counts.studies=0],
  ['cursor',v=>v.payload.game.resume.cursor=999],['FEN',v=>v.payload.game.resume.fen='bad'],
  ['illegal PGN',v=>v.payload.game.pgn='1. e9 *'],
  ['broken Sim link',v=>v.payload.simulation.runs[0].eventId='absent'],
  ['duplicate Sim ID',v=>v.payload.simulation.runs.push(copy(v.payload.simulation.runs[0]))],
  ['unsafe key',v=>v.payload.preferences.settings=JSON.parse('{"__proto__":{"polluted":true}}')],
  ['foreign preference field',v=>v.payload.preferences.settings.namespace='ChessBest:CURRENT:v2:'],
  ['secret field',v=>v.payload.preferences.settings.apiKey='SYNTHETIC-SECRET'],
  ['invalid score',v=>v.payload.simulation.runs[0].trace=[{score:{type:'cp',root:'bad'}}]],
  ['Study limit',v=>v.payload.studies.collection.studies=Array.from({length:21},(_,i)=>({...copy(v.payload.studies.collection.studies[0]),id:'s'+i}))],
  ['Evidence limit',v=>v.payload.evidence.snapshots=Array.from({length:31},()=>copy(v.payload.evidence.snapshots[0]))]
])test('DATA refuses '+name+' before mutation',async()=>{
  const v=await C.pack(fixture(),{channel:'LAB',release:'fixture'},deps);mutate(v);
  await assert.rejects(()=>C.parse(JSON.stringify(v),deps));assert.equal({}.polluted,undefined);
});
test('DATA rejects truncated JSON and file preflight oversize',async()=>{
  await assert.rejects(()=>C.parse('{"schema":',deps),/truncated/);
  await assert.rejects(()=>C.parse(' '.repeat(C.LIMITS.file+1),deps),/64 MiB/);
});
test('DATA preview distinguishes additions, removals, conflicts and identical records',()=>{
  const a=fixture(),b=copy(a);b.simulation.runs[0].pgn='1. d4 *';b.studies.collection.studies=[];
  const d=C.diff(a,b);assert.equal(d.find(x=>x.section==='Sim games').changed,1);
  assert.equal(d.find(x=>x.section==='Studies').removed,1);assert.equal(d.find(x=>x.section==='Evidence').unchanged,1);
});
module.exports={fixture,deps};
