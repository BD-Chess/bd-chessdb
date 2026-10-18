const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),{IDBFactory}=require('fake-indexeddb');
const C=require('../js/8zc-data-core.js'),Time=require('../js/8zc-time-core.js');
const deps={Chess:require('../js/chess.min.js').Chess,Study:require('../js/8zc-study-core.js'),StudyStore:require('../js/8zc-study-store.js'),Evidence:require('../js/8zc-evidence.js'),Sim:require('../js/8zc-sim-store.js')};
const base=path.resolve(__dirname,'..'),copy=x=>JSON.parse(JSON.stringify(x));
const source={channel:'LAB',release:'P5A-review-regression'};
function fixture(mode='countdown') {
  const p=C.empty(),g=new deps.Chess();g.move('e4');const pgn=g.pgn();
  p.game={schema:'chessbest-game/1',pgn,topPick:null,resume:{cursor:1,totalPlies:1,pgnLength:pgn.length,fen:g.fen()}};
  const clock=Time.create({mode,seconds:mode==='countdown'?30:0,turn:'b',running:false});clock.used={w:1234,b:456};clock.remaining={w:28766,b:29544};clock.turnSpent=456;
  p.timing={pgn,kind:'human',humanStartPly:0,records:[],clock};
  const s=deps.Study.parsePGN(deps.Chess,'1. e4 *');s.id='review-a';const b=deps.Study.parsePGN(deps.Chess,'1. d4 *');b.id='review-b';
  p.studies.collection={...deps.StudyStore.empty(),studies:[s,b],activeId:s.id};
  p.studies.undoA=copy(p.studies.collection);p.studies.undoB=copy(p.studies.collection);return p;
}
function storage(){const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};}
function locks(){const held=new Map();return {request(name,options,fn){if(typeof options==='function'){fn=options;options={};}if(held.get(name)&&options.ifAvailable)return Promise.resolve(fn(null));held.set(name,(held.get(name)||0)+1);return Promise.resolve().then(()=>fn({name})).finally(()=>held.set(name,held.get(name)-1));}};}
async function boot(t,{local=storage(),idb=new IDBFactory(),lock=locks(),ui=false}={}) {
  const dom=new JSDOM(fs.readFileSync(path.join(base,'index.html'),'utf8'),{url:'https://fixture.test/chess-lab/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
  t.after(()=>{w.dispatchEvent(new w.Event('pagehide'));w.close();});
  Object.defineProperty(w,'localStorage',{value:local});Object.defineProperty(w,'indexedDB',{value:idb});Object.defineProperty(w.navigator,'locks',{value:lock});Object.defineProperty(w,'crypto',{value:require('node:crypto').webcrypto});w.TextEncoder=TextEncoder;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  for(const n of ['chess.min.js','8zc-time-core.js','8zc-study-core.js','8zc-study-store.js','8zc-evidence.js','8zc-sim-store.js','8zc-data-core.js','8zc-data.js'])w.eval(fs.readFileSync(path.join(base,'js',n),'utf8'));
  await w.ChessDataGuard.ready;
  const downloads=[];w.URL.createObjectURL=blob=>{downloads.push({blob});return 'blob:synthetic';};w.URL.revokeObjectURL=()=>{};
  w.HTMLAnchorElement.prototype.click=function(){downloads.at(-1).name=this.download;};
  if(ui){w.eval(fs.readFileSync(path.join(base,'js/8zc-data-ui.js'),'utf8'));await new Promise(setImmediate);}
  return {w,G:w.ChessDataGuard,local,idb,lock,downloads};
}
async function unboot(x){x.w.dispatchEvent(new x.w.Event('pagehide'));x.w.close();await new Promise(setImmediate);}
async function settled(){for(let i=0;i<6;i++)await new Promise(setImmediate);}
async function blobText(w,b){return new Promise((resolve,reject)=>{const r=new w.FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsText(b);});}

for(const [name,change] of [
  ['A/B question',p=>p.studies.collection.comparison.question='Replacement question'],
  ['A/B pin',p=>{const fen=new deps.Chess().fen();p.studies.collection.comparison=deps.Study.pin(p.studies.collection.comparison,'A',deps.Study.snapshot(fen,{receipt:{fen},allMoves:[]},{label:'Replacement pin'}));}],
  ['active Study',p=>p.studies.collection.activeId='review-b'],
  ['undo A',p=>p.studies.undoA.comparison.question='Undo A replacement'],
  ['undo B',p=>p.studies.undoB.comparison.question='Undo B replacement']
])test('P5A-R1-01 preview reports isolated '+name+' replacement in valid files',async()=>{
  const a=fixture(),b=copy(a);change(b);const x=await C.pack(a,source,deps),y=await C.pack(b,source,deps);
  await C.parse(C.canonical(x),deps);await C.parse(C.canonical(y),deps);assert.notEqual(x.sha256,y.sha256);
  assert(C.diff(a,b).some(r=>r.changed+r.added+r.removed>0),name);assert.deepEqual(a,x.payload);
});
test('P5A-R1-01 identical content and only revision/operation bookkeeping show no false changes',()=>{
  const a=fixture(),b=copy(a);for(const v of Object.values(b.studies)){v.revision++;v.appliedOperations.push('synthetic-flush');}
  assert.equal(C.diff(a,a).reduce((n,r)=>n+r.changed+r.added+r.removed,0),0);
  assert.equal(C.diff(a,b).reduce((n,r)=>n+r.changed+r.added+r.removed,0),0);
});
test('P5A-R1-01 actual preview Cancel retains current Studies/A-B/undo and all storage',async t=>{
  const x=await boot(t,{ui:true}),a=fixture(),b=copy(a);b.studies.collection.comparison.question='Replacement question';
  x.local.setItem(x.G.key('ChessBest:LAB:v2:studies'),C.canonical(a.studies.collection));
  const input=await C.pack(b,source,deps),before=[...x.local.data];const file=x.w.document.getElementById('fileData');Object.defineProperty(file,'files',{value:[{size:C.bytes(input),text:async()=>C.canonical(input)}]});
  await file.onchange();const rows=[...x.w.document.querySelectorAll('#dataDialog tr')];assert(rows.some(r=>/A \/ B/.test(r.textContent)&&r.children[2].textContent==='1'));
  [...x.w.document.querySelectorAll('#dataDialog button')].find(b=>b.textContent==='Cancel').click();assert.deepEqual([...x.local.data],before);
});
test('P5A-R1-02 real failed Save handler downloads validated previous DATA and recovery drafts, restore in a clean target',async t=>{
  let x=await boot(t);const previous=await x.G.capture(false),incoming=await C.pack(fixture(),source,deps);await x.G.restore(incoming,previous.sha256);await unboot(x);
  x=await boot(t,{local:x.local,idb:x.idb,lock:x.lock,ui:true});const drafts=C.empty().recovery;drafts.recoveredDrafts={note:'retained draft'};
  x.local.setItem(x.G.key('ChessBest:LAB:v2:data-recovery'),C.canonical(drafts));x.local.setItem(x.G.key('ChessBest:LAB:v2:timing'),'unreadable current timing');const before=[...x.local.data];
  await x.w.document.getElementById('btnSaveData').onclick();await settled();
  const button=[...x.w.document.querySelectorAll('#dataDialog button')].find(b=>b.textContent==='Save previous workspace');assert(button,'previous verified backup must remain accessible');
  await button.onclick();assert.equal(x.downloads.at(-1).name,'ChessBest_DATA_previous.json');const text=await blobText(x.w,x.downloads.at(-1).blob),v=await C.parse(text,deps);assert.equal(v.sha256,previous.sha256);
  const draftButton=[...x.w.document.querySelectorAll('#dataDialog button')].find(b=>b.textContent==='Save recovery drafts');assert(draftButton);await draftButton.onclick();assert.equal(JSON.parse(await blobText(x.w,x.downloads.at(-1).blob)).drafts.recoveredDrafts.note,'retained draft');
  assert.deepEqual([...x.local.data],before);const target=await boot(t),old=await target.G.capture(false);await target.G.restore(v,old.sha256);await unboot(target);
  const reopened=await boot(t,{local:target.local,idb:target.idb,lock:target.lock});assert.equal((await reopened.G.capture(false)).sha256,previous.sha256);
});
test('P5A-R1-02 missing or corrupt recovery never offers a successful previous DATA export',async t=>{
  for(const corrupt of [false,true]){
    let x=await boot(t,{idb:null});if(corrupt){const a=await x.G.capture(false);await x.G.restore(await C.pack(fixture(),source,deps),a.sha256);await unboot(x);x=await boot(t,{local:x.local,idb:null,lock:x.lock});const key='ChessBest:LAB:v2:DATA-journal-fallback';const j=JSON.parse(x.local.getItem(key));j.backup.sha256='0'.repeat(64);x.local.setItem(key,C.canonical(j));}
    x.local.setItem(x.G.key('ChessBest:LAB:v2:timing'),'unreadable');x.w.eval(fs.readFileSync(path.join(base,'js/8zc-data-ui.js'),'utf8'));await settled();await x.w.document.getElementById('btnSaveData').onclick();await settled();
    assert(![...x.w.document.querySelectorAll('#dataDialog button')].some(b=>b.textContent==='Save previous workspace'));assert.equal(x.downloads.length,0);
  }
});

const invalid=[['missing used',p=>delete p.timing.clock.used],['missing initial',p=>delete p.timing.clock.initial],['missing flag',p=>delete p.timing.clock.flagged],['missing running',p=>delete p.timing.clock.running],['missing anchor',p=>delete p.timing.clock.anchor],['wrong remaining type',p=>p.timing.clock.remaining.w='broken'],['negative used',p=>p.timing.clock.used.b=-1],['null increment',p=>p.timing.clock.increment=null],['wrong side',p=>p.timing.clock.turn='x'],['wrong mode',p=>p.timing.clock.mode='rapid'],['wrong flag',p=>p.timing.clock.flagged='x'],['wrong running type',p=>p.timing.clock.running=0],['negative anchor',p=>p.timing.clock.anchor=-1],['missing kind',p=>delete p.timing.kind],['wrong kind',p=>p.timing.kind='worker'],['wrong start ply',p=>p.timing.humanStartPly=-1],['bad record',p=>p.timing.records=[{}]]];
for(const [name,change] of invalid)test('P5A-R1-03 correct-hash invalid '+name+' is rejected before journal/generation/pointer writes',async t=>{
  const x=await boot(t),before=await x.G.capture(false),v=await C.pack(fixture(),source,deps);change(v.payload);v.manifest=C.manifest(v.payload);v.sha256=await C.digest(v.payload);
  const old=[...x.local.data],dbs=await x.idb.databases();await assert.rejects(()=>x.G.restore(v,before.sha256));assert.deepEqual([...x.local.data],old);assert.deepEqual(await x.idb.databases(),dbs);assert.equal(await x.G.recovery(),null);
});
for(const mode of ['elapsed','countdown'])test('P5A-R1-03 valid paused '+mode+' survives actual restore/reopen and Resume game without starting engines',async t=>{
  const x=await boot(t),before=await x.G.capture(false),v=await C.pack(fixture(mode),source,deps);assert.deepEqual((await C.parse(C.canonical(v),deps)).payload,copy(v.payload));await x.G.restore(v,before.sha256);await unboot(x);
  const y=await boot(t,{local:x.local,idb:x.idb,lock:x.lock}),w=y.w;let now=100;Object.defineProperty(w.performance,'now',{value:()=>now});const g=new w.Chess();g.load_pgn(v.payload.game.pgn);w.eval(fs.readFileSync(path.join(base,'js/8zc-workspace.js'),'utf8'));
  const workspace=w.ChessWorkspace.create({Chess:w.Chess,game:g,settings:{showTimers:true,showTimestamps:false},onDisplaySettings(){},analyze(){throw Error('Unexpected engine analysis');},onAnnotations(){},getAnalysis:()=>null,isBusy:()=>false,isSimulationRunning:()=>false,stopActivities(){}});
  const saved=JSON.parse(y.local.getItem(y.G.key('ChessBest:LAB:v2:timing')));assert.deepEqual(copy(saved.clock),v.payload.timing.clock);
  assert.equal(workspace.clockSnapshot().running,false);assert.equal(y.G.restoredPaused,true);w.document.getElementById('btnHumanPause').click();assert.equal(workspace.clockSnapshot().running,true);now+=250;
  const active=workspace.clockSnapshot();assert.equal(active.used.w,v.payload.timing.clock.used.w);assert.equal(active.used.b,v.payload.timing.clock.used.b+250);assert.equal(active.remaining.b,v.payload.timing.clock.remaining.b-(mode==='countdown'?250:0));
});
test('P5A-R1-03 invalid hashed clock preserves an existing verified recovery and never opens a write store',async t=>{
  let x=await boot(t),a=await x.G.capture(false);await x.G.restore(await C.pack(fixture(),source,deps),a.sha256);await unboot(x);
  x=await boot(t,{local:x.local,idb:x.idb,lock:x.lock});const prior=await x.G.recovery(),target=await x.G.capture(false),v=await C.pack(fixture(),source,deps);v.payload.timing.clock.remaining.b='broken';v.manifest=C.manifest(v.payload);v.sha256=await C.digest(v.payload);
  const local=[...x.local.data],open=x.idb.open.bind(x.idb);let opened=0;x.idb.open=(...args)=>{opened++;return open(...args);};
  await assert.rejects(()=>x.G.restore(v,target.sha256));assert.equal(opened,0);assert.deepEqual([...x.local.data],local);assert.equal((await x.G.recovery()).sha256,prior.sha256);
});
test('P5A-R1-03 every native clock field is required and real move records retain their full unmodified values',async()=>{
  const p=fixture(),game=new deps.Chess(),fen=game.fen(),clock=Time.create({mode:'countdown',seconds:30,turn:'w',now:0});
  const move=game.move('e4'),row=Time.move(clock,'w','b',1234,'2026-10-18T20:45:00.000Z');Time.pause(clock,1456);clock.anchor=0;
  p.timing.clock=clock;p.timing.records=[{...row,fen,afterFen:game.fen(),move:'e2e4',san:move.san}];
  const packed=await C.pack(p,source,deps),before=C.canonical(p);assert.equal(C.canonical((await C.parse(C.canonical(packed),deps)).payload),before);
  assert.doesNotThrow(()=>Time.restore(p.timing.clock));assert.doesNotThrow(()=>Time.restore(p.timing.records[0].after));
  for(const key of Object.keys(clock)){const invalid=copy(p);delete invalid.timing.clock[key];assert.throws(()=>C.validatePayload(invalid,deps),undefined,key);}
  for(const value of [null,'bad',-1,Infinity,NaN]){const invalid=copy(p);invalid.timing.records[0].white_elapsed_ms=value;assert.throws(()=>C.validatePayload(invalid,deps));}
  for(const value of ['white','',4]){const invalid=copy(p);invalid.timing.records[0].after.turn=value;assert.throws(()=>C.validatePayload(invalid,deps));}
  assert.equal(C.canonical(p),before);
});
test('P5A-R1-03 all existing workspace modes including local dccbot retain valid paused timing',async()=>{
  for(const kind of ['analysis','human','sim','lichess','dccbot']){const p=fixture();p.timing.kind=kind;const value=await C.pack(p,source,deps);assert.equal(C.canonical((await C.parse(C.canonical(value),deps)).payload),C.canonical(p));}
});
