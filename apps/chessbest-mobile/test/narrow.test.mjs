import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawn, execFileSync } from 'node:child_process';
import readline from 'node:readline';
import { JSDOM, VirtualConsole } from 'jsdom';
import { IDBFactory } from 'fake-indexeddb';
const app=path.resolve(import.meta.dirname,'..'), web=path.join(app,'web');
const text=f=>fs.readFileSync(path.join(web,f),'utf8');
function load(f,extra={}) { const box={module:{exports:{}},Blob,URL,console,...extra};box.exports=box.module.exports;vm.runInNewContext(text(f),box);return box.module.exports; }
function memory() {const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),data};}
async function nativeStorage(storage=memory(),idb=new IDBFactory()) {
  const box={globalThis:null,localStorage:storage,indexedDB:idb,navigator:{},setTimeout,clearTimeout,DOMException};box.globalThis=box;
  vm.runInNewContext(text('js/8zc-lab-storage.js'),box);await box.ChessLabStorage.ready;return box;
}
test('generation verifies full pinned closure and excludes web migrations and token acquisition',()=> {
  execFileSync(process.execPath,['scripts/build.mjs','--verify'],{cwd:app});
  const m=JSON.parse(fs.readFileSync(path.join(app,'asset-manifest.json')));
  assert(m.files['vendor/stockfish/stockfish-js-18.0.0-source.zip']);
  assert(m.files['vendor/stockfish/nn-9067e33176e8.nnue']);
  assert(!m.files['pwa.js']); assert(!m.files['Lichess-API.txt']);
  assert(!text('index.html').includes('chessPwaInstall'));
  for(const f of Object.keys(m.files).filter(f=>/^js\//.test(f))) {
    assert(!text(f).includes('ChessBest:CURRENT:v2:'),f);assert(!text(f).includes('ChessBest:LAB:v2:'),f);
  }
  assert(!text('js/8zc-utils.js').includes('fetchPublicLichessToken'));
});
test('native storage probes IDB and isolates website data without Web Locks',async()=> {
  const s=memory();s.setItem('ChessBest:CURRENT:v2:studies','web');s.setItem('chessBestLichessToken','fixture-never-copy');
  const box=await nativeStorage(s);
  assert.equal(box.ChessLabStorage.status().serialization,'single-native-scene');
  assert.equal(s.getItem('ChessBest:APP:v1:studies'),null);
  assert.equal(s.getItem('ChessBest:APP:v1:lichess-token'),null);
  assert.equal(s.getItem('ChessBest:CURRENT:v2:studies'),'web');
  await assert.rejects(nativeStorage(memory(),null),/IndexedDB/);
});
test('shared native queue serializes Study writers and preserves data on quota failure',async()=> {
  const s=memory(), box=await nativeStorage(s), {Chess}=load('js/chess.min.js');
  const C=load('js/8zc-study-core.js'), S=load('js/8zc-study-store.js');
  const a=S.create({C,Chess,storage:s,locks:box.ChessNativeLocks}), b=S.create({C,Chess,storage:s,locks:box.ChessNativeLocks});
  await Promise.all([a.execute({id:'a',baseRevision:0,type:'append',study:C.create(Chess,{title:'A'})}),b.execute({id:'b',baseRevision:0,type:'append',study:C.create(Chess,{title:'B'})})]);
  assert.equal(a.read().studies.length,2);
  const before=s.getItem(S.KEY), set=s.setItem;
  s.setItem=(key,value)=> { if(key===S.KEY) throw new DOMException('fixture quota','QuotaExceededError');return set(key,value); };
  await assert.rejects(a.execute({id:'fail',baseRevision:2,type:'append',study:C.create(Chess)}),e=>e.code==='QUOTA');
  assert.equal(s.getItem(S.KEY),before);assert.equal(a.read().studies.length,2);
});
test('generated page wires seven PGN picks, legal navigation, Studies and background cancellation (DOM fixtures)',{timeout:15000},async t=> {
  const errors=[], logs=[], vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));vc.on('error',(...e)=>logs.push(e.map(String).join(' ')));
  const dom=new JSDOM(text('index.html'),{url:'https://native.fixture/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
  t.after(()=>dom.window.close());const w=dom.window;
  await new Promise(r=>w.addEventListener('load',r,{once:true}));
  w.indexedDB=new IDBFactory();w.structuredClone=structuredClone;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.AbortController=AbortController;
  w.URL.createObjectURL=()=> 'blob:fixture';w.URL.revokeObjectURL=()=>{};
  w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLElement.prototype.scrollTo=function(){};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
  Object.defineProperty(w.HTMLElement.prototype,'innerText',{get(){return this.textContent},set(x){this.textContent=x}});
  w.alert=message=>{throw Error(message)};w.confirm=()=>true;
  let rendered,stopped=0,createdSF=0;
  w.Chessboard=(id,options)=>{rendered=options.position;return {position:fen=>{if(fen)rendered=fen;return rendered},resize(){},orientation(){}};};
  w.fetch=async input=> {const u=new URL(String(input),w.location.href);if(u.origin!==w.location.origin)throw Error('offline fixture');
    const file=path.resolve(web,'.'+u.pathname);assert(file.startsWith(web+'/'));
    if(!fs.existsSync(file))return {ok:false,status:404};const content=fs.readFileSync(file,'utf8');return {ok:true,text:async()=>content,json:async()=>JSON.parse(content)};};
  w.localStorage.setItem('ChessBest:APP:v1:settings',JSON.stringify({analysisSource:'sf',sfAnalysisDepth:3}));
  for(const script of w.document.querySelectorAll('script[src]')) {
    const file=script.getAttribute('src').split('?')[0];if(/jquery-|chessboard-/.test(file))continue;
    w.eval(text(file));
    if(file==='js/8zc-utils.js') await w.initAll();
    if(file==='js/8zc-sf-provider.js') w.ChessSFProvider.create=()=>{createdSF++;return {destroy(){stopped++},prepare:async()=>{},ledger:{},root:async fen=>({fen,provider:'SF',complete:true,moves:new w.Chess(fen).moves({verbose:true}).slice(0,1).map(m=>({move:m.from+m.to+(m.promotion||''),score:0,rank:1,depth:3}))})};};
  }
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));w.dispatchEvent(new w.Event('load'));
  const wait=async fn=> {const end=Date.now()+5000;while(!fn()&&Date.now()<end)await new Promise(r=>setTimeout(r,20));assert(fn(),JSON.stringify({errors,logs,storage:w.ChessLabStorage?.status(),host:!!w.ChessLabHost,picks:w.document.querySelectorAll('.library-result').length}));};
  await wait(()=>w.ChessLabHost && w.document.querySelectorAll('.library-result').length===7);
  w.document.getElementById('btnGames').click();w.document.querySelector('.library-result').click();
  await wait(()=>w.ChessLabHost.getReviewGame().moves.length>0);
  w.document.getElementById('first').click();const before=w.ChessLabHost.getContext();
  w.document.getElementById('next').click();const after=w.ChessLabHost.getContext();
  const g=new w.Chess(before.fen),m=after.moves.at(-1);assert(g.move({from:m.slice(0,2),to:m.slice(2,4),promotion:m[4]}));assert.equal(g.fen(),after.fen);assert.equal(rendered,after.fen);
  await wait(()=>createdSF>0);await w.ChessNativeHost.pause();assert.equal(w.__CHESSBEST_BACKGROUND__,true);assert(stopped>0);
  w.__CHESSBEST_BACKGROUND__=false;
  w.document.getElementById('btnTwoPlayers').click();w.document.getElementById('humanStart').click();
  assert.equal(w.document.getElementById('humanSession').hidden,false);
  await w.ChessNativeHost.pause();
  assert.equal(w.document.getElementById('humanSession').hidden,false);
  assert.equal(w.document.getElementById('btnHumanPause').textContent,'Resume game');
  assert.equal(JSON.parse(w.localStorage.getItem('ChessBest:APP:v1:timing')).kind,'human');
  assert(w.document.querySelector('input[value="lichess"]').disabled);
  await new Promise(r=>setTimeout(r,200));
  const saved=JSON.parse(w.localStorage.getItem('ChessBest:APP:v1:studies'));assert(saved.studies.length>=1);
  assert.equal(w.localStorage.getItem('ChessBest:CURRENT:v2:studies'),null);
  assert.deepEqual(errors,[]);
});
test('generated bundled Stockfish returns legal depth result and cancels (real WASM, Node transport)',{timeout:20000},async()=> {
  const {Chess}=load('js/chess.min.js'), Deep=load('js/8zc-deep-engine.js',{setTimeout,clearTimeout,performance});
  function worker() {const file=path.join(web,'vendor/stockfish/stockfish-18-lite-single.js');
    const launcher="const M=require('node:module'),f=process.argv[1],m=new M(f);m.filename=f;m.paths=M._nodeModulePaths(require('node:path').dirname(f));process.mainModule=m;m._compile(require('node:fs').readFileSync(f,'utf8'),f)";
    const w={},child=spawn(process.execPath,['-e',launcher,file],{stdio:['pipe','pipe','pipe']});
    readline.createInterface({input:child.stdout}).on('line',line=>w.onmessage?.({data:line}));child.on('error',e=>w.onerror?.({message:e.message}));
    child.stderr.resume();child.on('exit',code=>{if(!w.closed)w.onerror?.({message:'Node engine exit '+code})});w.postMessage=s=>child.stdin.write(s+'\n');w.terminate=()=>{w.closed=true;child.kill()};return w;}
  const engine=Deep.create({Chess,workerFactory:worker,readyTimeoutMs:5000});
  try { const result=await engine.analyze({fen:new Chess().fen(),depth:3,multiPV:1});assert(result.depth>=3);const m=result.bestMove;assert(new Chess().move({from:m.slice(0,2),to:m.slice(2,4),promotion:m[4]}));
    let cancelled=false;const next=await engine.analyze({fen:new Chess().fen(),infinite:true,onInfo:i=>{if(i.depth>=3&&!cancelled){cancelled=true;engine.stop();}}});assert(cancelled&&next.stopped);
  } finally {engine.destroy();}
});
