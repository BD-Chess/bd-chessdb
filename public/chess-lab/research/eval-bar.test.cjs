const test = require('node:test');
const assert = require('node:assert/strict');
const { Chess } = require('../js/chess.min.js');
const E = require('../js/8zc-eval-bar.js');
const game = new Chess(), white = game.fen(); game.move('e4'); const black = game.fen();

test('LCZero WDL_mu matches independent pinned C++ outputs and guards unstable native signs', () => {
  const fixture = require('./fixtures/lc0-wdlmu-reference.json');
  let compared = 0, guarded = 0;
  for (const entry of fixture.cases) {
    const q = entry.wdl[0] - entry.wdl[2], before = JSON.stringify(entry.wdl);
    const result = E.neuralScore(q, entry.wdl);
    assert.ok(Number.isSafeInteger(result.cp), entry.id);
    if (result.method.includes('unstable')) {
      guarded++;
      assert.ok(entry.cp * q < 0, entry.id + ': native approximation has an inverted sign');
      assert.equal(result.cp, E.qToCp(q), entry.id + ': explicit Q fallback');
    } else {
      compared++;
      assert.ok(Math.abs(result.cp - entry.cp) <= 1, entry.id + ': native=' + entry.cp + ', display=' + result.cp);
    }
    assert.ok(result.cp === 0 || result.cp * q > 0, entry.id + ': display cannot reverse native Q');
    assert.equal(JSON.stringify(entry.wdl), before, 'probability evidence is immutable');
  }
  assert.ok(compared >= 165); assert.equal(guarded, 4);
});

test('LCZero full WDL changes its scale at the same Q and preserves color perspective', () => {
  const first = E.neuralScore(0.1, [.42,.26,.32]), second = E.neuralScore(0.1, [.12,.86,.02]);
  assert.notEqual(first.cp, second.cp, 'draw information must affect the score');
  for (const wdl of [[.5,.3,.2],[.001,.998,.001],[0,1,0],[1,0,0],[.3,.00011,.69989]]) {
    const q = wdl[0] - wdl[2], reverse = [wdl[2],wdl[1],wdl[0]];
    assert.equal(E.neuralScore(q,wdl).cp, -E.neuralScore(-q,reverse).cp || 0);
    const typed = Object.freeze({type:'q',root:q,white:-q,wdl:Object.freeze(wdl)});
    const auto = E.measure(black,typed,null,'LC0');
    const explicit = E.measure(black,{...typed,wdlWhite:reverse},null,'LC0');
    assert.equal(auto.label, explicit.label);
    assert.equal(auto.neural.cp, E.neuralScore(-q,reverse).cp);
  }
});

test('invalid or missing LCZero WDL has a labelled fallback without invented probabilities', () => {
  for (const wdl of [null,undefined,[],[0,0,0],[.5,.3,.3],[-.1,.6,.5],[NaN,.5,.5],['.5',.3,.2],[.4,.3,.3]]) {
    const result = E.neuralScore(.3,wdl);
    assert.equal(result.method,'Q fallback'); assert.equal(result.wdl,null);
    assert.match(result.description,/W\/D\/L unavailable/);
    assert.equal(result.cp,E.qToCp(.3));
  }
});


test('evaluation bar normalizes mover centipawns into White perspective', () => {
  assert.equal(E.measure(white, 135).label, '+1.35');
  assert.equal(E.measure(black, 135).label, '-1.35');
  assert.equal(E.measure(black, -135).label, '+1.35');
  assert.ok(E.measure(white, 135).white > 50);
  assert.ok(E.measure(black, 135).white < 50);
  assert.equal(E.measure(black, 0).label, '0.00');
});
test('LC Zero display conversion preserves native evidence and never invents mate or unknown scores', () => {
  const score = Object.freeze({ type: 'q', root: 0.3, white: -0.3, wdl: Object.freeze([0.5, 0.3, 0.2]) });
  assert.equal(E.qToCp(0.3), 22);
  assert.equal(E.qToCp(-0.3), -22);
  assert.equal(E.measure(black, score, null, 'LC0').label, '-1.00', 'typed White score is not flipped twice');
  assert.match(E.measure(black, score, null, 'LC0').description, /approximately -100 cp.*WDL_mu.*native neural Q -0.300/);
  assert.match(E.measure(black, score, null, 'LC0').description, /win 20.0%.*draw 30.0%.*loss 50.0%/);
  assert.equal(score.type, 'q'); assert.equal(score.root, 0.3); assert.deepEqual(score.wdl, [0.5, 0.3, 0.2]);
  for (const q of [null, undefined, '0.3', NaN, Infinity, -Infinity, 1.01, -1.01]) {
    assert.equal(E.qToCp(q), null);
    assert.equal(E.measure(white, { type:'q', white:q }).state, 'unknown');
  }
  let previous = -Infinity;
  for (const q of [-1,-0.9,-0.5,-0.003,0,0.003,0.5,0.9,1]) {
    const cp = E.qToCp(q); assert.ok(Number.isSafeInteger(cp) && cp >= previous); previous = cp;
    assert.equal(cp, -E.qToCp(-q) || 0, 'rounding remains symmetric');
    const view = E.measure(white,{type:'q',white:q}); assert.equal(view.state,'known');
    assert.doesNotMatch(view.label, /[#WB]/, 'neural endpoints do not prove a mating distance or tablebase');
  }
});
test('missing evaluations and decisive CDB scores never become invented pawn or mate counts', () => {
  for (const score of [null, undefined, NaN, '0']) assert.equal(E.measure(white, score).state, 'unknown');
  assert.equal(E.measure(white, 29999).label, 'W');
  assert.equal(E.measure(black, 29999).label, 'B');
  assert.equal(E.measure(black, -20000).white, 100);
  assert.equal(E.measure(white, -10000).white, 0);
  assert.equal(E.measure(white, 9000).state, 'known');
});
test('actual mate and draw override raw or missing CDB data', () => {
  assert.equal(E.measure(white, 99, 'mate').white, 0);
  assert.equal(E.measure(black, undefined, 'mate').white, 100);
  assert.equal(E.measure(white, 900, 'draw').label, '0.00');
  assert.equal(E.measure(white, null, 'draw').white, 50);
});
test('late replies cannot paint another FEN; flipping, hiding and unavailable data remain distinct', () => {
  const node = () => ({ classes: {}, attrs: {}, props: {}, textContent: '',
    classList: { toggle(key, value) { this.owner.classes[key] = value; } },
    style: { setProperty(key, value) { this.owner.props[key] = value; } },
    setAttribute(key, value) { this.attrs[key] = value; } });
  const bar = node(), label = node(); bar.classList.owner = bar; bar.style.owner = bar;
  const prior = global.document;
  global.document = { getElementById: id => id === 'positionEval' ? bar : label };
  try {
    const b = new Chess(), settings = { flipBoard: false }; let visible = true;
    const view = E.create({ game: b, settings, isVisible: () => visible });
    view.update(b.fen(), 25); assert.equal(label.textContent, '+0.25');
    assert.equal(bar.props['--eval-white'], E.measure(white, 25).white + '%');
    b.move('e4'); view.render(); assert.equal(label.textContent, '+0.25');
    assert.equal(bar.props['--eval-white'], E.measure(white, 25).white + '%', 'bar height remains while waiting');
    assert.equal(bar.classes['is-awaiting'], true);
    assert.match(bar.attrs['aria-label'], /Previous position.*awaiting evaluation for the current position/);
    assert.match(bar.title, /Previous position.*awaiting evaluation for the current position/);
    view.update(white, 800); assert.equal(label.textContent, '+0.25', 'late reply cannot change the visible bar');
    view.update(b.fen(), 80); assert.equal(label.textContent, '-0.80');
    assert.equal(bar.classes['is-awaiting'], false);
    assert.equal(bar.props['--eval-white'], E.measure(black, 80).white + '%');
    settings.flipBoard = true; view.render();
    assert.equal(bar.classes['is-flipped'], true); assert.equal(label.textContent, '-0.80');
    visible = false; view.render(); assert.equal(bar.classes['is-hidden'], true);
    assert.equal(bar.attrs['aria-label'], 'Position evaluation hidden');
    visible = true; view.update(b.fen(), null);
    assert.equal(label.textContent, '-0.80', 'transient unavailability keeps the previous result');
    assert.equal(bar.classes['is-pending'], false, 'pending CSS must not hide the previous fill');
    view.update(b.fen(), null, 'CDB', true);
    assert.equal(label.textContent, '—', 'a completed lookup without a score clears the old result');
    assert.equal(bar.classes['is-unknown'], true);
    b.load('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1'); view.render();
    assert.equal(label.textContent, '#', 'a terminal position supersedes a previous unavailable evaluation immediately');
    assert.equal(bar.classes['is-awaiting'], false);
  } finally { global.document = prior; }
});
test('source cards keep provider top moves and depths, clear stale FENs and identify DCC choices in every mode', () => {
  const make = () => ({ dataset: {}, textContent: '', className: '', children: [], hidden: false,
    classList: { toggle() {} }, style: { setProperty() {} }, setAttribute() {},
    append(...nodes) { this.children.push(...nodes); }, replaceChildren(...nodes) { this.children = nodes; } });
  const bar = make(), label = make(), badges = make();
  badges.parentElement = make();
  const prior = global.document, priorMatch = global.matchMedia, priorNow = Date.now;
  global.document = { hidden: false, getElementById: id => ({ positionEval: bar, positionEvalLabel: label, allEvalBadges: badges })[id],
    createElement: make, addEventListener() {} };
  global.matchMedia = () => ({ matches: false });
  let now = 1000000; Date.now = () => now;
  try {
    const b = new Chess(), settings = { analysisSource: 'all', flipBoard: false };
    const view = E.create({ game: b, settings, isVisible: () => true });
    const cells = source => {
      const badge = badges.children.find(row => row.children[0].children[0].textContent === ({CDB:'ChessDB',SF:'Stockfish',DCC:'ChessDCC'})[source]);
      return [...badge.children[0].children.map(cell => cell.textContent), badge.children[1].textContent];
    };
    view.updateSource(b.fen(), 100, 'CDB', null, 'e4');
    view.updateSource(b.fen(), -30, 'SF', 18, 'Nf3');
    view.updateDCC(b.fen(), 'Nf3', 'CDB');
    assert.deepEqual(badges.children.map(row => row.children[0].children[0].textContent), ['ChessDB','Stockfish','ChessDCC','Reckless','LC Zero','Berserk']);
    assert.deepEqual(cells('CDB'), ['ChessDB', 'e4', '+1.00', 'Position data']);
    assert.deepEqual(cells('SF'), ['Stockfish', 'Nf3', '-0.30', 'Lite · depth 18']);
    assert.deepEqual(cells('DCC'), ['ChessDCC', 'Nf3', 'Measured']);
    for (const selected of ['auto', 'sf', 'dcc', 'all']) {
      settings.analysisSource = selected; view.render();
      assert.equal(badges.hidden, false, `${selected} shows the three computed results`);
      assert.deepEqual(badges.children.map(row => row.children[0].children[0].textContent), ['ChessDB','Stockfish','ChessDCC','Reckless','LC Zero','Berserk']);
      assert.deepEqual(cells('CDB'), ['ChessDB', 'e4', '+1.00', 'Position data']);
      assert.deepEqual(cells('SF'), ['Stockfish', 'Nf3', '-0.30', 'Lite · depth 18']);
      assert.deepEqual(cells('DCC'), ['ChessDCC', 'Nf3', 'Measured']);
    }
    view.update(b.fen(), -30, 'SF');
    assert.deepEqual(cells('SF'), ['Stockfish', 'Nf3', '-0.30', 'Lite · depth 18'], 'generic score update preserves root move and depth');
    view.updateSource(b.fen(), 42, 'SF', 22, 'd4');
    assert.deepEqual(cells('SF'), ['Stockfish', 'd4', '+0.42', 'Lite · depth 22']);
    assert.deepEqual(cells('CDB'), ['ChessDB', 'e4', '+1.00', 'Position data'], 'SF refresh does not overwrite CDB');
    view.updateDCC(b.fen(), 'e4', 'CDB', 'raw-safety');
    assert.deepEqual(cells('DCC'), ['ChessDCC', 'e4', 'Raw choice']);
    b.move('e4'); view.render();
    assert.deepEqual(cells('CDB'), ['ChessDB', '…', '…', 'No position data']);
    assert.deepEqual(cells('SF'), ['Stockfish', '…', '…', 'Lite · Ready']);
    assert.equal(cells('DCC')[1], '—');
    view.updateSource(b.fen(), 20, 'CDB', null, 'e5');
    view.updateSource(white, 900, 'CDB', null, 'a4');
    view.updateSource(white, 800, 'SF', 40, 'h4');
    assert.deepEqual(cells('CDB'), ['ChessDB', 'e5', '-0.20', 'Position data'], 'late other-FEN result cannot paint current move');
    assert.deepEqual(cells('SF'), ['Stockfish', '…', '…', 'Lite · Ready']);
    view.updateSource(b.fen(), 5, 'SF', 10, 'c5');
    now += 300001; view.render();
    assert.deepEqual(cells('SF'), ['Stockfish', '…', '…', 'Lite · Ready'], 'expired metadata never shows stale depth or move');
    view.updateSource(b.fen(), 8, 'SF', 12, 'e5');
    view.update(b.fen(), null, 'SF');
    assert.deepEqual(cells('SF'), ['Stockfish', '—', '—', 'Lite · Ready'], 'unavailable provider clears its old move and depth');
    view.updateSource(b.fen(), 13, 'CDB', null, 'Nc6');
    view.updateSource(b.fen(), 24, 'SF', 19, 'd5');
    view.updateDCC(b.fen(), 'Nc6', 'CDB');
    view.update(b.fen(), 13, 'CDB');
    view.markComparisonPending(b.fen());
    assert.deepEqual(cells('CDB'), ['ChessDB', 'Nc6', '-0.13', 'Position data']);
    assert.deepEqual(cells('SF'), ['Stockfish', 'd5', '-0.24', 'Lite · depth 19'], 'same-FEN refresh preserves independent card results');
    assert.equal(cells('DCC')[1], 'Nc6', 'same-FEN refresh retains measured DCC choice');
    assert.equal(label.textContent, '-0.13', 'left bar retains its last score while awaiting the new source');
    view.updateSource(b.fen(), 31, 'CDB', null, 'Nc6');
    assert.equal(cells('SF')[1], 'd5', 'CDB reply preserves independent SF result');
    view.updateSource(b.fen(), { type: 'cp', white: 38 }, 'SF', 24, 'd5', false, 'deep');
    view.updateSource(b.fen(), 4, 'SF', 9, 'a5');
    assert.deepEqual(cells('SF'), ['Stockfish', 'd5', '+0.38', 'Lite · depth 24'], 'late shallow SF cannot replace Deep root');
    settings.analysisSource = 'sf';
    view.update(b.fen(), 4, 'SF');
    assert.equal(label.textContent, '+0.38', 'SF board bar preserves the deeper White-POV score');
    view.markComparisonPending(b.fen());
    assert.deepEqual(cells('SF'), ['Stockfish', 'd5', '+0.38', 'Lite · depth 24'], 'same-FEN refresh retains the pinned Deep result');
    assert.equal(label.textContent, '+0.38', 'switching back to SF keeps the pinned board score');
    settings.analysisSource = 'cdb';
    view.update(b.fen(), -100, 'CDB');
    assert.equal(label.textContent, '+1.00', 'CDB selected board score is never replaced by deep SF');
    assert.deepEqual(cells('SF'), ['Stockfish', 'd5', '+0.38', 'Lite · depth 24'], 'deep SF remains visible on its separate card');
  } finally { global.document = prior; global.matchMedia = priorMatch; Date.now = priorNow; }
});

test('Deep SF scores preserve White POV, mate distance and upper/lower bounds', () => {
  assert.equal(E.measure(black, { type: 'cp', white: -43, whiteBound: 'upper' }, null, 'SF').label, '≤-0.43');
  assert.equal(E.measure(black, { type: 'mate', white: 3, whiteBound: 'lower' }, null, 'SF').label, '≥#3');
  assert.equal(E.measure(white, { type: 'mate', white: -2, whiteBound: 'exact' }, null, 'SF').label, '−#2');
});

test('every analysis mode shows six source cards; Hide Eval hides the row; Hide Eval hides the row', t => {
  const { JSDOM } = require('jsdom'), fs = require('node:fs');
  const dom = new JSDOM('<div class="board-actions"><div id="allEvalBadges"></div></div><div id="positionEval"></div><span id="positionEvalLabel"></span>', {runScripts:'outside-only'});
  t.after(() => dom.window.close()); const w = dom.window;
  Object.defineProperty(w.document, 'hidden', { value: false }); w.matchMedia = () => ({ matches: true });
  const timers = new Map(); let next = 0;
  w.setTimeout = (fn, ms) => {timers.set(++next, {fn,ms}); return next;}; w.clearTimeout = id => timers.delete(id);
  w.eval(fs.readFileSync(require('node:path').join(__dirname,'../js/8zc-eval-bar.js'),'utf8'));
  const b = new Chess(), settings = {analysisSource:'all', allCDBSeconds:2, allSFSeconds:3};
  let visible=true;
  const view = w.ChessEvalBar.create({game:b, settings, isVisible:()=>visible});
  view.updateSource(b.fen(), 10, 'CDB', null, 'e4');
  for (let depth=8;depth<20;depth++) view.updateSource(b.fen(), {type:'cp',white:depth}, 'SF',depth,'Nf3');
  const row=w.document.getElementById('allEvalBadges');
  for (const selected of ['auto','cdb','sf','dcc','all']) {
    settings.analysisSource=selected;view.render();
    assert.equal(row.hidden,false,`${selected} displays all provider cards`);
    assert.deepEqual([...row.children].map(card=>card.querySelector('strong').textContent),['ChessDB','Stockfish','ChessDCC','Reckless','LC Zero','Berserk']);
    assert.equal(row.parentElement.classList.contains('has-all-evals'),true);
  }
  assert.equal(timers.size,0,'saved rotation seconds do not schedule hidden mobile timers');
  visible=false; view.render();
  assert.equal(row.hidden,true); assert.equal(row.parentElement.hidden,true);
  visible=true; settings.analysisSource='auto'; view.render();
  assert.equal(row.hidden,false); assert.equal(row.parentElement.hidden,false);
  assert.equal(row.parentElement.classList.contains('has-all-evals'),true);
});

test('DCC progress moves into its card, survives redraws and rejects stale-position status', () => {
  const {JSDOM}=require('jsdom');
  const dom=new JSDOM('<body><div id="positionEval"></div><span id="positionEvalLabel"></span><div><div id="allEvalBadges"></div></div><aside id="settings"><span id="dccProgress"></span></aside></body>');
  const previous=global.document;global.document=dom.window.document;
  try{
    const g=new Chess(),fen=g.fen(),view=E.create({game:g,settings:{analysisSource:'cdb'},isVisible:()=>true});
    const progress=document.getElementById('dccProgress');
    view.updateDCC(fen,null,null,'pending');
    assert.equal(progress.closest('.all-eval-badge').querySelector('strong').textContent,'ChessDCC');
    assert.equal(document.querySelector('#settings #dccProgress'),null);assert.equal(progress.textContent,'Analyzing');
    progress.textContent='2/3';view.render();assert.equal(progress.textContent,'2/3');
    view.updateDCC(fen,'e4','CDB','ready');assert.equal(progress.parentElement.textContent,'2/3');assert.match(progress.parentElement.title,/CDB/);
    g.move('e4');view.render();assert.equal(progress.textContent,'No data');
    view.updateDCC(fen,'d4','CDB','pending');assert.equal(progress.textContent,'No data');
    view.updateDCC(g.fen(),'e5','SF','ready');view.clearDCC(g.fen());assert.equal(document.querySelector('[data-eval-source="DCC"] .all-eval-move').textContent,'—','changed repetition history can explicitly clear a same-FEN local choice');
  }finally{global.document=previous;dom.window.close();}
});

test('native info paints keep the card and inner touch target connected, with one Stop listener and an independent Link highlight',()=>{
  const {JSDOM}=require('jsdom'),dom=new JSDOM('<body><div id="positionEval"></div><span id="positionEvalLabel"></span><div><div id="allEvalBadges"></div></div></body>');
  const previous=global.document;global.document=dom.window.document;
  try{
    const g=new Chess();let selected=false,working=true,clicks=0;const actions=[];
    const view=E.create({game:g,settings:{analysisSource:'cdb'},isVisible:()=>true,onBadgeAction:(_,intent)=>{clicks++;actions.push(intent);},getBadgeControl:()=>({working,selected})});
    view.render();const card=document.querySelector('[data-eval-source="SF"]'),target=card.querySelector('.all-eval-move');
    for(let depth=1;depth<=40;depth++)view.updateSource(g.fen(),{type:'cp',white:depth},'SF',depth,'e4');
    assert.equal(document.querySelector('[data-eval-source="SF"]'),card);assert.equal(card.querySelector('.all-eval-move'),target);assert.equal(target.isConnected,true);
    target.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));assert.equal(clicks,1);
    target.dispatchEvent(new dom.window.MouseEvent('pointerdown',{bubbles:true}));working=false;
    target.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));assert.equal(actions.at(-1).stopOnly,true,'completion during a held Stop cannot turn it into a new search');
    selected=true;view.render();assert.equal(card.classList.contains('is-linked'),true);assert.equal(card.getAttribute('aria-current'),'true');
    selected=false;view.render();assert.equal(card.classList.contains('is-linked'),false);
  }finally{global.document=previous;dom.window.close();}
});

test('a grouped update paints every independent source once, including nested batches and thrown callbacks',()=>{
  const {JSDOM}=require('jsdom'),dom=new JSDOM('<body><div id="positionEval"></div><span id="positionEvalLabel"></span><div><div id="allEvalBadges"></div></div></body>');
  const previous=global.document,previousRegistry=global.ChessEngineRegistry;
  global.document=dom.window.document;global.ChessEngineRegistry=require('../js/8zc-engine-registry.js');
  try{
    const g=new Chess(),fen=g.fen();let controlReads=0;
    const view=E.create({game:g,settings:{analysisSource:'sf-lite'},isVisible:()=>true,getBadgeControl:()=>{controlReads++;return {};}});
    view.batch(()=>{
      view.updateSource(fen,{type:'cp',white:25},'SF',14,'e4',false,'deep');
      view.batch(()=>{
        view.updateSource(fen,{type:'cp',white:35},'BER',15,'d4');
        view.updateSource(fen,{type:'cp',white:15},'RLE',16,'Nf3');
        view.updateSource(fen,{type:'q',white:0.2},'LC0',null,'c4');
      });
      view.update(fen,{type:'cp',white:25},'SF');
      assert.equal(controlReads,0,'intermediate source changes do not repaint all badges');
    });
    assert.equal(controlReads,6,'one final comparison render reads six independent badge controls');
    for(const [role,move]of [['SF','e4'],['BER','d4'],['RLE','Nf3'],['LC0','c4']])
      assert.equal(document.querySelector(`[data-eval-source="${role}"] .all-eval-move`).textContent,move);
    assert.equal(document.getElementById('positionEvalLabel').textContent,'+0.25');
    assert.throws(()=>view.batch(()=>{view.updateSource(fen,40,'BER',17,'d4');throw Error('consumer failed');}),/consumer failed/);
    assert.equal(controlReads,12,'accepted updates still flush after a callback fails');
    view.updateSource(fen,45,'BER',18,'d4');assert.equal(controlReads,18,'later unbatched updates remain immediate');
  }finally{global.document=previous;global.ChessEngineRegistry=previousRegistry;dom.window.close();}
});
