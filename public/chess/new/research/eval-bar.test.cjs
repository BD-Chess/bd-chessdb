const test = require('node:test');
const assert = require('node:assert/strict');
const { Chess } = require('../js/chess.min.js');
const E = require('../js/8zc-eval-bar.js');
const game = new Chess(), white = game.fen(); game.move('e4'); const black = game.fen();

test('evaluation bar normalizes mover centipawns into White perspective', () => {
  assert.equal(E.measure(white, 135).label, '+1.35');
  assert.equal(E.measure(black, 135).label, '-1.35');
  assert.equal(E.measure(black, -135).label, '+1.35');
  assert.ok(E.measure(white, 135).white > 50);
  assert.ok(E.measure(black, 135).white < 50);
  assert.equal(E.measure(black, 0).label, '0.00');
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
    b.move('e4'); view.render(); assert.equal(label.textContent, '…');
    view.update(white, 800); assert.equal(label.textContent, '…');
    view.update(b.fen(), 80); assert.equal(label.textContent, '-0.80');
    settings.flipBoard = true; view.render();
    assert.equal(bar.classes['is-flipped'], true); assert.equal(label.textContent, '-0.80');
    visible = false; view.render(); assert.equal(bar.classes['is-hidden'], true);
    assert.equal(bar.attrs['aria-label'], 'Position evaluation hidden');
    visible = true; view.update(b.fen(), null); assert.equal(label.textContent, '—');
    assert.equal(bar.classes['is-unknown'], true);
  } finally { global.document = prior; }
});
test('All keeps provider top moves with their scores/depth, clears stale FENs and identifies DCC choices', () => {
  const make = () => ({ textContent: '', className: '', children: [], hidden: false,
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
    const cells = source => badges.children.find(row => row.children[0].textContent === source).children.map(cell => cell.textContent);
    view.updateSource(b.fen(), 100, 'CDB', null, 'e4');
    view.updateSource(b.fen(), -30, 'SF', 18, 'Nf3');
    view.updateDCC(b.fen(), 'Nf3', 'CDB');
    assert.deepEqual(badges.children.map(row => row.children[0].textContent), ['CDB', 'SF', 'DCC']);
    assert.deepEqual(cells('CDB'), ['CDB', 'e4', '+1.00', 'White POV']);
    assert.deepEqual(cells('SF'), ['SF', 'Nf3', '-0.30', 'depth 18']);
    assert.deepEqual(cells('DCC'), ['DCC', 'Nf3', 'CDB lines · choice']);
    view.update(b.fen(), -30, 'SF');
    assert.deepEqual(cells('SF'), ['SF', 'Nf3', '-0.30', 'depth 18'], 'generic score update preserves root move and depth');
    view.updateSource(b.fen(), 42, 'SF', 22, 'd4');
    assert.deepEqual(cells('SF'), ['SF', 'd4', '+0.42', 'depth 22']);
    assert.deepEqual(cells('CDB'), ['CDB', 'e4', '+1.00', 'White POV'], 'SF refresh does not overwrite CDB');
    view.updateDCC(b.fen(), 'e4', 'CDB', 'raw-safety');
    assert.deepEqual(cells('DCC'), ['DCC', 'e4', 'CDB · raw retained']);
    b.move('e4'); view.render();
    assert.deepEqual(cells('CDB'), ['CDB', '…', '…', 'White POV']);
    assert.deepEqual(cells('SF'), ['SF', '…', '…', 'White POV']);
    assert.equal(cells('DCC')[1], '—');
    view.updateSource(b.fen(), 20, 'CDB', null, 'e5');
    view.updateSource(white, 900, 'CDB', null, 'a4');
    view.updateSource(white, 800, 'SF', 40, 'h4');
    assert.deepEqual(cells('CDB'), ['CDB', 'e5', '-0.20', 'White POV'], 'late other-FEN result cannot paint current move');
    assert.deepEqual(cells('SF'), ['SF', '…', '…', 'White POV']);
    view.updateSource(b.fen(), 5, 'SF', 10, 'c5');
    now += 300001; view.render();
    assert.deepEqual(cells('SF'), ['SF', '…', '…', 'White POV'], 'expired metadata never shows stale depth or move');
    view.updateSource(b.fen(), 8, 'SF', 12, 'e5');
    view.update(b.fen(), null, 'SF');
    assert.deepEqual(cells('SF'), ['SF', '—', '—', 'White POV'], 'unavailable provider clears its old move and depth');
  } finally { global.document = prior; global.matchMedia = priorMatch; Date.now = priorNow; }
});
