const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { Chess } = require('../js/chess.min.js');
const Review = require('../js/8zc-review-core.js');
const base = path.resolve(__dirname, '..');
const dreev = fs.readFileSync(base + '/Games/ChessBest_Top_Picks.pgn', 'utf8')
  .split(/\n\s*\n(?=\[Event)/).find(pgn => pgn.includes('ChessBestReviewEvidence'));
const evidenceText = fs.readFileSync(base + '/config/dreev-kasparov-review.json', 'utf8');
const evidence = JSON.parse(evidenceText);
function state(pgn, cursor = 0) {
  const review = Review.build({ Chess, pgn });
  return { headers:review.headers, sourcePGN:pgn, sourceIsOriginal:true, startFen:review.rootFen,
    moves:review.moves, cursor, blocked:false };
}
async function fixture(t, response) {
  const dom = new JSDOM('<main><div id="controls"><div id="workspaceDisplay"></div>' +
    '<button id="btnGameReview">Review</button><button id="first">First</button></div></main>',
  { url:'https://example.test/chess-lab/', runScripts:'outside-only', pretendToBeVisual:true });
  const w = dom.window; t.after(()=>w.close());
  await new Promise(resolve=>w.addEventListener('load', resolve));
  let current = state(dreev, 37), studied = null;
  const listeners = [];
  w.Chess = Chess; w.ChessLabReady = Promise.resolve();
  w.TextDecoder = TextDecoder; w.AbortController = AbortController;
  w.fetch = async (...args) => {
    const r = await response(...args);
    return { ...r, arrayBuffer: async () => { await r.json(); return new TextEncoder().encode(evidenceText).buffer; } };
  };
  w.ChessLabHost = {
    getReviewGame:()=>current,
    getContext:()=>({fen:Review.build({Chess,pgn:current.sourcePGN}).positions[current.cursor].fen,
      history:current.moves.slice(0,current.cursor)}),
    navigateReview:ply=>{current.cursor=ply; listeners.forEach(callback=>callback());},
    openReviewStudy:()=>{studied=current.cursor;},
    onChange:callback=>listeners.push(callback)
  };
  for(const file of ['8zc-study-core.js','8zc-sha256.js','8zc-review-registry.js','8zc-review-core.js','8zc-review-presentation.js','8zc-review-ui.js'])
    w.eval(fs.readFileSync(base+'/js/'+file,'utf8'));
  const until = async predicate=>{
    const end=Date.now()+5000;
    while(!predicate()&&Date.now()<end) await new Promise(resolve=>setTimeout(resolve,10));
    assert(predicate(),'expected Review state');
  };
  await until(()=>!!w.document.getElementById('gameReviewPanel'));
  w.document.getElementById('btnGameReview').click();
  w.document.getElementById('gameReviewReveal').click();
  return {w, until, current:()=>current, studied:()=>studied,
    change:next=>{current=next; listeners.forEach(callback=>callback());}};
}
test('a late saved-analysis response cannot attach to the next loaded game', async t=>{
  let release;
  const deferred = new Promise(resolve=>{release=resolve;});
  const f = await fixture(t,async()=>({ok:true,json:()=>deferred}));
  const short = '[Event "Another game"]\n[White "A"]\n[Black "B"]\n[Result "*"]\n\n1.e4 e5 2.Nf3 Nc6 *';
  f.change(state(short));
  await f.until(()=>f.w.document.getElementById('gameReviewPanel').textContent.includes('Another game'));
  release(evidence);
  await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(f.w.document.getElementById('gameReviewGraph'),null);
  assert.doesNotMatch(f.w.document.getElementById('gameReviewPanel').textContent,/58\/99 scored/);
});
test('unavailable saved data keeps the PGN review and recorded board usable', async t=>{
  const f = await fixture(t,async()=>({ok:false}));
  await f.until(()=>f.w.document.getElementById('gameReviewPanel').textContent.includes('unavailable or does not match'));
  assert.equal(f.w.document.getElementById('gameReviewScrub').max,'99');
  assert.equal(f.current().cursor,37);
  assert.match(f.w.document.getElementById('gameReviewPanel').textContent,/27 plies, about M14/);
});
test('blocked review refuses graph navigation; Study/A-B still opens the exact root after unlock', async t=>{
  const f = await fixture(t,async()=>({ok:true,json:async()=>evidence}));
  await f.until(()=>!!f.w.document.getElementById('gameReviewGraph'));
  f.change({...f.current(),blocked:true});
  await f.until(()=>f.w.document.getElementById('gameReviewScrub').disabled);
  f.w.document.getElementById('gameReviewGraph').dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'End',bubbles:true}));
  assert.equal(f.current().cursor,37);
  assert.match(f.w.document.getElementById('gameReviewPanel').textContent,/Finish the active game/);
  f.change({...f.current(),blocked:false});
  await f.until(()=>!f.w.document.getElementById('gameReviewScrub').disabled);
  const card=f.w.document.querySelector('.game-review-decision[data-ply="63"]');
  [...card.querySelectorAll('.game-review-actions button')].find(button=>button.textContent==='Study / A-B').click();
  assert.equal(f.studied(),63);
  assert.equal(f.current().moves.length,99);
});
test('the recorded-line slider keeps Review open and preserves keyboard focus', async t=>{
  const f = await fixture(t,async()=>({ok:true,json:async()=>evidence}));
  await f.until(()=>!!f.w.document.getElementById('gameReviewGraph'));
  const slider=f.w.document.getElementById('gameReviewScrub');
  slider.focus(); slider.value='89';
  slider.dispatchEvent(new f.w.Event('change',{bubbles:true}));
  await f.until(()=>f.w.document.getElementById('gameReviewGraph').getAttribute('aria-valuenow')==='89');
  assert.equal(f.w.document.getElementById('gameReviewPanel').hidden,false);
  assert.equal(f.w.document.activeElement.id,'gameReviewScrub');
  assert.equal(f.current().cursor,89);
  assert.equal(f.current().moves.length,99);
});
