'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const { Chess } = require('../js/chess.min.js');
const Eval = require('../js/8zc-eval-bar.js');
const utils = fs.readFileSync(path.join(__dirname, '../js/8zc-utils.js'), 'utf8');
const start = utils.indexOf('  function annotateMove(');
const end = utils.indexOf('  function highlightLast(', start);
assert.ok(start >= 0 && end > start, 'execute actual production overlay function');

function fixture(t) {
  const dom = new JSDOM('<div class="square-f3"></div><button id="btnHideEval">Hide Eval</button>');
  t.after(() => dom.window.close());
  const w = dom.window;
  Object.defineProperty(w.HTMLElement.prototype, 'innerText', { configurable:true,
    get() { return this.textContent; }, set(value) { this.textContent = String(value); } });
  const fen = 'k7/8/8/8/8/8/3N3N/K7 w - - 0 1';
  for (const move of ['d2f3', 'h2f3']) assert.ok(new Chess(fen).move({ from:move.slice(0,2), to:'f3' }), 'same-destination fixture is legal');
  const ctx = { window:{ ChessEvalBar:Eval }, document:w.document, settings:{ notation:'number' } };
  vm.createContext(ctx); vm.runInContext(utils.slice(start, end), ctx);
  const score = q => Object.freeze({ scoreType:'q', nativeQ:q,
    wdl:Object.freeze(Number.isFinite(q) ? [(1+q)/2, 0, (1-q)/2] : []), visits:13 });
  return { paint:(move, detail, best=false) => ctx.annotateMove(move, null, best, 'LC Zero', detail),
    overlay:() => w.document.querySelector('.overlay'), score, ctx };
}

test('same-square LC0 candidates compare original Q, keeping a higher later candidate', t => {
  const f = fixture(t), first = f.score(0.2), later = f.score(0.3), before = JSON.stringify([first,later]);
  f.paint('d2f3', first); f.paint('h2f3', later);
  assert.equal(f.overlay().dataset.move, 'h2f3');
  assert.equal(f.overlay().dataset.rawScore, '0.3');
  assert.equal(f.overlay().textContent, '+22');
  assert.match(f.overlay().title, /approximately 22 cp.*native neural Q 0.300/);
  assert.equal(JSON.stringify([first,later]), before, 'display leaves original Q/WDL evidence unchanged');
});

test('LC0 raw #1 wins a same-square collision even when its Q is lower', t => {
  const f = fixture(t), raw = f.score(-0.3), other = f.score(0.9);
  f.paint('d2f3', raw, true); f.paint('h2f3', other);
  assert.equal(f.overlay().dataset.move, 'd2f3'); assert.equal(f.overlay().textContent, '-22');
  assert.equal(f.overlay().dataset.rawBest, 'true');
  f.overlay().remove(); f.paint('h2f3', other); f.paint('d2f3', raw, true);
  assert.equal(f.overlay().dataset.move, 'd2f3'); assert.equal(f.overlay().textContent, '-22');
  assert.equal(f.overlay().dataset.rawScore, '-0.3');
});

test('unknown LC0 Q is unavailable, never an invented zero or winner over known negative Q', t => {
  const f = fixture(t);
  for (const q of [null, undefined, NaN, Infinity, 1.1, -1.1]) {
    f.overlay()?.remove(); f.paint('d2f3', f.score(q));
    assert.equal(f.overlay().textContent, '—'); assert.equal(f.overlay().dataset.rawScore, '');
    assert.match(f.overlay().title, /evaluation unavailable/);
    f.paint('h2f3', f.score(-0.3));
    assert.equal(f.overlay().dataset.move, 'h2f3', 'finite negative Q replaces unknown');
    assert.equal(f.overlay().textContent, '-22');
    f.paint('d2f3', f.score(q));
    assert.equal(f.overlay().dataset.move, 'h2f3', 'unknown cannot erase a known score');
  }
});

test('LC0 overlay labels are integer approximate cp and dot mode preserves raw Q ordering', t => {
  const f = fixture(t);
  for (const q of [-1, -0.3, -0.001, 0, 0.001, 0.3, 1]) {
    f.overlay()?.remove(); const detail = f.score(q), before = JSON.stringify(detail);
    f.paint('d2f3', detail);
    assert.match(f.overlay().textContent, /^[-+]?\d+$/); assert.doesNotMatch(f.overlay().textContent, /[.#]/);
    assert.equal(JSON.stringify(detail), before); assert.equal(f.overlay().dataset.rawScore, String(q));
  }
  f.overlay().remove(); f.ctx.settings.notation = 'dot';
  f.paint('d2f3', f.score(0.2)); f.paint('h2f3', f.score(0.3));
  assert.equal(f.overlay().textContent, '•'); assert.equal(f.overlay().dataset.move, 'h2f3');
  assert.equal(f.overlay().dataset.rawScore, '0.3');
});

test('LCZero overlays use full WDL while collisions retain original Q ranking', t => {
  const f = fixture(t);
  const a = Object.freeze({scoreType:'q',nativeQ:.1,wdl:Object.freeze([.42,.26,.32])});
  const b = Object.freeze({scoreType:'q',nativeQ:.1,wdl:Object.freeze([.12,.86,.02])});
  f.paint('d2f3',a,true); assert.equal(f.overlay().textContent,'+40');
  assert.match(f.overlay().title,/WDL_mu.*win 42.0%.*draw 26.0%.*root player perspective/);
  f.overlay().remove();f.paint('d2f3',b,true);assert.equal(f.overlay().textContent,'+32');
  assert.equal(f.overlay().dataset.rawScore,'0.1');
});

test('candidate list uses the same full WDL display as overlays and Deep', t => {
  const dom=new JSDOM('<div id="analysisCandidates"></div>');t.after(()=>dom.window.close());
  const first=utils.indexOf('  function showAnalysisCandidates('),last=utils.indexOf('  async function fetchAnnotations',first);
  const context={window:{ChessEvalBar:Eval},document:dom.window.document,settings:{topN:3},
    game:{fen:()=>new Chess().fen()},uciToSan:(_fen,move)=>move};
  vm.createContext(context);vm.runInContext(utils.slice(first,last),context);
  context.showAnalysisCandidates([{move:'e2e4',scoreType:'q',nativeQ:.3,wdl:[.5,.3,.2]}],'LC0',null);
  const row=dom.window.document.querySelector('#analysisCandidates div');
  assert.match(row.textContent,/\+100 cp/);assert.match(row.title,/WDL_mu.*draw 30.0%/);
});
