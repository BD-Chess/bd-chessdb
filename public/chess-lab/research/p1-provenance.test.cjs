const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const E=require('../js/8zc-evidence.js');
async function render(t,{fen,receipt,candidate}){
  const dom=new JSDOM('<body></body>',{url:'https://example.test/chess-lab/',runScripts:'outside-only'}),w=dom.window;t.after(()=>w.close());
  for(const file of ['chess.min.js','8zc-eval-bar.js','8zc-study-core.js','8zc-study-store.js','8zc-study-ui.js'])w.eval(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'));
  const analysis={receipt:{fen,scorePOV:'root player to move',...receipt},allMoves:[candidate],candidates:[{...candidate,raw:candidate.score}]};
  const sealed=E.seal({fen,records:[],analysis}),before=E.canonical(sealed),actions=[];
  const ui=w.ChessStudyUI.create({locks:{request:(_n,_o,fn)=>Promise.resolve().then(fn)},getContext:()=>({fen,history:[],analysis}),navigate:x=>actions.push(x),mount:w.document.body});
  await ui.pin('A');await ui.pin('B');ui.open('compare',false);
  const text=w.document.querySelector('.chess-study-snapshot').textContent;
  assert.equal(E.canonical(sealed),before,'render cannot mutate sealed source bytes');
  E.validate(sealed);
  w.document.querySelector('.chess-study-snapshot tbody button').click();
  assert.equal(actions.length,0,'candidate preview cannot navigate live board');
  const json=ui.exportJSON();await ui.importJSON(json);assert.deepEqual(JSON.parse(ui.exportJSON()).comparison,JSON.parse(json).comparison);
  ui.destroy();
  const restored=w.ChessStudyUI.create({locks:{request:(_n,_o,fn)=>Promise.resolve().then(fn)},getContext:()=>({fen,history:[],analysis}),mount:w.document.body});
  restored.open('compare',false);assert.deepEqual(JSON.parse(restored.exportJSON()).comparison,JSON.parse(json).comparison,'saved A/B reload preserves native bytes and provenance');
  return {text,w,ui:restored};
}
const start='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
for(const [provider,mode,name] of [['CDB',null,'CDB'],['SF','sf-lite','Stockfish Lite'],['SF','sf-full','Stockfish Full'],['BER','berserk','Berserk'],['RLE','reckless','Reckless'],['LC0','lc0','LC0'],[null,null,'Unknown provider']]){
  test(`P1 A/B actual ${name} provenance and known zero`,async t=>{
    const {text}=await render(t,{fen:start,receipt:{provider,engineMode:mode},candidate:{move:'e2e4',scoreType:'cp',score:0}});
    assert(text.includes(name),text);assert.match(text,/0 cp/);assert.match(text,/White perspective/);
  });
}
for(const side of ['w','b'])test(`P1 neural ${side}-to-move uses shared WDL_mu with correct perspective`,async t=>{
  const fen=start.replace(' w ',' '+side+' '),q=.2,wdl=[.3,.6,.1];
  const {text,w}=await render(t,{fen,receipt:{provider:'LC0',engineMode:'lc0'},candidate:{move:side==='w'?'e2e4':'e7e5',scoreType:'q',score:null,nativeQ:q,wdl}});
  const sign=side==='w'?1:-1,whiteWdl=sign===1?wdl:[wdl[2],wdl[1],wdl[0]],value=w.ChessEvalBar.neuralScore(q*sign,whiteWdl);
  assert(text.includes('approximately '+value.cp+' cp'),text);assert.match(text,/native neural Q/);assert.match(text,/WDL_mu/);
});
for(const side of ['w','b'])for(const [name,fields,expected] of [
  ['positive',{scoreType:'cp',score:123},side==='w'?'123 cp':'-123 cp'],
  ['negative',{scoreType:'cp',score:-85},side==='w'?'-85 cp':'85 cp'],
  ['lower',{scoreType:'cp',score:60,bound:'lower'},side==='w'?'≥ 60 cp':'≤ -60 cp'],
  ['upper',{scoreType:'cp',score:-60,bound:'upper'},side==='w'?'≤ -60 cp':'≥ 60 cp'],
  ['mate',{scoreType:'mate',score:null,mateIn:4},side==='w'?'mate #4':'mate #-4'],
  ['unknown',{scoreType:'cp',score:null},'unknown'],
  ['Q fallback',{scoreType:'q',score:null,nativeQ:0,wdl:null},'approximately 0 cp (Q fallback)'],
  ['CDB mate sentinel',{score:29973},side==='w'?'mate #14 (27 plies':'mate #-14 (27 plies'],
  ['CDB decisive',{score:20000},'decisive / mate distance unknown']
])test(`P1 A/B ${side}-to-move ${name}`,async t=>{
  const {text}=await render(t,{fen:start.replace(' w ',' '+side+' '),receipt:{provider:fields.scoreType==='q'?'LC0':'CDB'},candidate:{move:side==='w'?'e2e4':'e7e5',...fields}});
  assert(text.includes(expected),text);assert.match(text,/White perspective/);assert.doesNotMatch(text,/29973 cp|20000 cp/);
});
test('P1 typed White neural value and WDL are converted only once; imported labels stay text',async t=>{
  const {text,w}=await render(t,{fen:start.replace(' w ',' b '),receipt:{provider:'LC0',engineName:'<img src=x onerror=alert(1)>'},candidate:{move:'e7e5',score:{type:'q',root:.2,white:-.2,wdl:[.3,.6,.1]}}});
  assert(text.includes('approximately '+w.ChessEvalBar.neuralScore(-.2,[.1,.6,.3]).cp+' cp'),text);
  assert.equal(w.document.querySelectorAll('img,script').length,0);
});
