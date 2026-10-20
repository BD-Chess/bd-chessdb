'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),{Chess}=require('../js/chess.min.js'),Core=require('../js/8zc-review-core.js');
const registry=require('../js/8zc-review-registry.js'),base=path.resolve(__dirname,'..');
const pgFiles=['ChessBest_Top_Picks.pgn','ChessBest_Top_Picks_TCEC.pgn'];
const games=pgFiles.flatMap(file=>fs.readFileSync(base+'/Games/'+file,'utf8').trim().split(/\n\s*\n(?=\[Event)/))
 .map(pgn=>({pgn,review:Core.build({Chess,pgn})}));
const clone=x=>JSON.parse(JSON.stringify(x));
const data=entry=>JSON.parse(fs.readFileSync(base+'/'+entry.file));
function state(game,cursor=Number(game.review.headers.ChessBestAnchorPly)){
 return {headers:game.review.headers,sourcePGN:game.pgn,sourceIsOriginal:true,startFen:game.review.rootFen,
  moves:game.review.moves,cursor,blocked:false};
}
async function fixture(t,options={}){
 const dom=new JSDOM('<div id="controls"><div id="workspaceDisplay"></div><button id="btnGameReview">Review</button></div>',
  {url:'https://example.test/chess-lab/',runScripts:'outside-only',pretendToBeVisual:true});
 t.after(()=>dom.window.close());const w=dom.window;await new Promise(r=>w.addEventListener('load',r));
 let current=state(games[0]),lang='en';const listeners=[],requests=[];
 w.Chess=Chess;w.TextDecoder=TextDecoder;w.AbortController=AbortController;w.ChessLabReady=Promise.resolve();
 w.ChessLanguage={getLanguage:()=>lang};
 w.Worker=function(){throw Error('Stored Review must not create an engine worker');};
 w.fetch=async url=>{requests.push(url);if(options.fetch)return options.fetch(url,requests.length);
  const b=fs.readFileSync(base+'/'+url);return {ok:true,arrayBuffer:async()=>b};};
 w.ChessLabHost={getReviewGame:()=>current,getContext:()=>{
  const r=Core.build({Chess,pgn:current.sourcePGN,moves:current.moves,startFen:current.startFen});
  return {fen:r.positions[current.cursor].fen,history:current.moves.slice(0,current.cursor)};
 },navigateReview:ply=>{current={...current,cursor:ply};listeners.forEach(f=>f());},onChange:f=>listeners.push(f)};
 for(const file of ['8zc-study-core.js','8zc-sha256.js','8zc-review-registry.js','8zc-review-core.js','8zc-review-presentation.js','8zc-review-ui.js'])
  w.eval(fs.readFileSync(base+'/js/'+file,'utf8'));
 const until=async fn=>{const end=Date.now()+5000;while(!fn()&&Date.now()<end)await new Promise(r=>setTimeout(r,10));assert(fn(),'Expected review state');};
 const el=id=>w.document.getElementById(id);
 await until(()=>el('gameReviewPanel'));el('btnGameReview').click();
 return {w,requests,until,el,current:()=>clone(current),change:async next=>{current=next;listeners.forEach(f=>f());await new Promise(r=>setTimeout(r,30));},
  reveal:()=>el('gameReviewReveal')?.click(),language:value=>{lang=value;w.document.dispatchEvent(new w.CustomEvent('chess:language'));}};
}
test('TP01/02 all ten full sources, roots, anchors and hashes bind actual nonempty evidence; pilot is preserved',()=>{
 assert.equal(games.length,10);assert.equal(registry.entries.length,10);
 for(const {review}of games){const entry=Core.resolveEvidence(review,registry);assert(entry);const e=Core.attachEvidence(review,data(entry),Chess,entry);
  assert.equal(e.evidence.positions.length,review.totalPly+1);assert(e.evidence.coverage.cdb_positions>0);
  if(entry.alias==='dreev-kasparov-1996'){assert.equal(e.evidence.decisions.length,12);assert.equal(e.evidence.coverage.cdb_scored,58);assert.equal(e.evidence.coverage.sf_positions,100);}
  else {const anchor=e.evidence.positions[entry.anchor.ply];assert(anchor.observations.length>0,entry.id);assert(e.evidence.notes.some(n=>n.ply===entry.anchor.ply));
   assert(e.evidence.provenance.archive.members['moves.csv'].sha256);assert(e.evidence.coverage.sf_positions<=1);}
 }
});
test('TP01 no matching names, truncated/foreign line, root mismatch, fake alias or injected URL can inherit evidence',()=>{
 const r=games[0].review,entry=Core.resolveEvidence(r,registry);
 for(const bad of [{...r,moves:r.moves.slice(0,-1),totalPly:r.totalPly-1},{...r,rootFen:new Chess().fen().replace(' 0 1',' 1 1')},
  {...r,headers:{...r.headers,ChessBestReviewEvidence:'https://evil.test/payload.json'}}])assert.throws(()=>Core.resolveEvidence(bad,registry));
 const foreign=Core.build({Chess,pgn:'[White "Gukesh Dommaraju"]\n[Black "Magnus Carlsen"]\n\n1.d4 d5 *'});
 assert.equal(Core.resolveEvidence(foreign,registry),null);
 const reg=clone(registry);reg.entries.find(e=>e.id===entry.id).file='https://evil.test/analysis.json';assert.throws(()=>Core.resolveEvidence(r,reg),/registration/);
});
test('TP03 sparse source counts, mate units, both POVs, missing vs zero and gaps retain meaning',()=>{
 const black=games[0].review.positions[87].fen;
 assert.equal(Core.scoreText({...Core.decodeCdb(29973),pov:'mover'},black,'white'),'−M14 · 27 plies');
 assert.equal(Core.scoreText({type:'mate',sign:-1,moves:5,pov:'white'},black,'mover'),'M5');
 assert.equal(Core.scoreText({type:'cp',cp:0},black),'0.00');assert.equal(Core.scoreText({type:'unknown'},black),'Unknown');
 const entry=registry.entries.find(e=>e.id==='gukesh-ding-wch-2024-28-qc8');
 const r=games.find(g=>Core.hashText(g.review.moves.join(' '))===entry.mainline_sha256).review;
 const e=Core.attachEvidence(r,data(entry),Chess,entry);assert.equal(e.evidence.coverage.sf_positions,0);
 assert.equal(Core.plotSeries(e.evidence.positions,'sf').length,0);
 const rows=[{ply:0,fen:black,cdb:{positionScore:{type:'cp',cp:25,pov:'white'}}},
  {ply:1,fen:black,cdb:{positionScore:{type:'unknown'}}},{ply:2,fen:black,cdb:{positionScore:{type:'cp',cp:0,pov:'white'}}}];
 assert.deepEqual(Core.plotSeries(rows,'cdb').map(s=>s.length),[1,1]);assert.equal(Core.plotSeries(rows,'cdb','mover')[0][0].cp,-25);
});
test('TP04 full-FEN mismatch, illegal candidate/PV, wrong coverage and invalid POV reject before attachment',()=>{
 const r=games[0].review,entry=Core.resolveEvidence(r,registry),e=data(entry),ply=entry.anchor.ply;
 for(const change of [x=>x.positions[ply].fen=x.positions[0].fen,x=>x.positions[ply].sf.candidates[0].uci='a1a8',
  x=>x.positions[ply].sf.candidates[0].pv=['a1a8'],x=>x.coverage.cdb_played_types.cp++,
  x=>x.positions[ply].sf.candidates[0].score.pov='Black',x=>x.sources=null,x=>x.notes[0].ply=-1]){
  const bad=clone(e);change(bad);assert.throws(()=>Core.attachEvidence(r,bad,Chess,entry));assert.equal(r.evidence,null);
 }
});
test('TP04 missing or invalid registry fails without fetching any unregistered path',async t=>{
 const f=await fixture(t);f.w.ChessReviewRegistry={schema:'broken',entries:[]};const before=f.current();f.reveal();
 await f.until(()=>f.el('gameReviewPanel').textContent.includes('does not match'));
 assert.equal(f.requests.length,0);assert.deepEqual(f.current(),before);
});
test('TP03 restricted roots and partial TCEC summaries cannot claim a global best or an exact cross-search loss',async t=>{
 const f=await fixture(t);f.reveal();await f.until(()=>!!f.el('gameReviewGraph'));
 const source=[...f.w.document.querySelectorAll('.game-review-observation')].find(el=>el.textContent.includes('restricted root: 2'));
 assert(source);assert.match(source.textContent,/256 cp \(mover POV\).*Limited to this dated candidate set/);
 await f.change(state(games[8]));f.reveal();await f.until(()=>!!f.el('gameReviewGraph'));
 const summaries=[...f.w.document.querySelectorAll('.game-review-observation')].filter(el=>el.dataset.provider==='sf');
 assert(summaries.length);for(const el of summaries){assert.match(el.textContent,/forced played-move search may be separate/);assert.doesNotMatch(el.textContent,/Same-root gap/);}
});
test('TP05 reveal hides future analysis, result, notes, accessible graph text and does not fetch until explicit reveal',async t=>{
 const f=await fixture(t),before=f.current(),panel=f.el('gameReviewPanel');
 assert.equal(f.requests.length,0);assert.equal(f.el('gameReviewGraph'),null);assert.equal(panel.querySelector('.game-review-detail'),null);
 assert.doesNotMatch(panel.textContent,/hidden cost|44\.\.\.f6|1-0|cross-node/);assert.equal(panel.querySelector('title'),null);
 f.reveal();await f.until(()=>!!f.el('gameReviewGraph'));assert.deepEqual(f.current(),before);
 assert.deepEqual(f.requests,['config/review-gukesh-carlsen-norway-2025-44-f6.json']);
});
test('TP02/05/07 ten actual UI reviews show three source shapes with no engine/CDB requests and keep source/cursor',async t=>{
 const f=await fixture(t);
 for(const game of games){await f.change(state(game));f.reveal();await f.until(()=>!!f.el('gameReviewGraph'));
  const before=state(game),text=f.el('gameReviewPanel').textContent;
  assert.deepEqual(f.current(),clone(before));assert.match(text,/White POV/);
  if(game.review.headers.White.startsWith('Dreev'))assert.equal(f.w.document.querySelectorAll('.game-review-decision').length,12);
  else assert(f.w.document.querySelector('.game-review-observation'));
  f.language('sl');assert.match(f.el('gameReviewPanel').textContent,/Shranjena analiza|Potek partije/);f.language('en');
 }
 assert.equal(f.requests.length,10);assert(f.requests.every(p=>/^config\/.+\.json$/.test(p)));
});
test('TP04 three delayed games and an intervening cursor change never attach stale evidence',async t=>{
 const pending=new Map(),f=await fixture(t,{fetch:url=>new Promise(resolve=>pending.set(url,resolve))});
 for(const game of games.slice(0,3)){await f.change(state(game));f.reveal();await f.until(()=>pending.size>=games.indexOf(game)+1);}
 const entries=games.slice(0,3).map(g=>Core.resolveEvidence(g.review,registry));
 await f.change({...f.current(),cursor:8});
 for(const entry of entries.slice(0,2))pending.get(entry.file)({ok:true,arrayBuffer:async()=>fs.readFileSync(base+'/'+entry.file)});
 await new Promise(r=>setTimeout(r,60));assert.equal(f.el('gameReviewGraph'),null);
 const last=entries[2];pending.get(last.file)({ok:true,arrayBuffer:async()=>fs.readFileSync(base+'/'+last.file)});
 await f.until(()=>!!f.el('gameReviewGraph'));assert.equal(f.current().cursor,8);assert.match(f.el('gameReviewPanel').textContent,/Leko.*Kramnik/);
 assert.doesNotMatch(f.el('gameReviewPanel').textContent,/Carlsen.*Aronian/);
});
test('TP04 corrupt bytes fail closed and explicit bounded retry succeeds without changing game',async t=>{
 const f=await fixture(t,{fetch:async(url,n)=>({ok:true,arrayBuffer:async()=>{
  const b=fs.readFileSync(base+'/'+url);if(n===1)b[20]^=1;return b;}})}),before=f.current();
 f.reveal();await f.until(()=>f.el('gameReviewPanel').textContent.includes('does not match'));
 assert.equal(f.requests.length,1);assert.equal(f.el('gameReviewGraph'),null);assert.deepEqual(f.current(),before);
 [...f.el('gameReviewPanel').querySelectorAll('button')].find(b=>b.textContent==='Retry saved review').click();
 await f.until(()=>!!f.el('gameReviewGraph'));assert.equal(f.requests.length,2);assert.deepEqual(f.current(),before);
});
test('TP04 repeated failure stops after three attempts; no automatic retry or unbounded loop',async t=>{
 const f=await fixture(t,{fetch:async()=>({ok:false})});f.reveal();
 for(let attempt=1;attempt<=3;attempt++){
  await f.until(()=>f.el('gameReviewPanel').textContent.includes('does not match'));assert.equal(f.requests.length,attempt);
  const retry=[...f.el('gameReviewPanel').querySelectorAll('button')].find(b=>b.textContent==='Retry saved review');
  if(attempt<3)retry.click();else assert.equal(retry,undefined);
 }
 await new Promise(r=>setTimeout(r,40));assert.equal(f.requests.length,3);
});
test('TP05 legal saved PV opens independently, closes with focus and preserves full line/cursor',async t=>{
 const f=await fixture(t);f.reveal();await f.until(()=>!!f.el('gameReviewGraph'));const before=f.current();
 const open=[...f.el('gameReviewPanel').querySelectorAll('button')].find(b=>b.textContent==='Explore SF line');open.click();
 const pv=f.w.document.querySelector('.game-review-variation');assert.equal(pv.querySelectorAll('.review-square').length,64);
 [...pv.querySelectorAll('button')].find(b=>b.textContent==='Next').click();assert.equal(pv.dataset.step,'1');assert.deepEqual(f.current(),before);
 [...pv.querySelectorAll('button')].find(b=>b.textContent==='Close line').click();assert.equal(f.w.document.activeElement,open);assert.deepEqual(f.current(),before);
});
