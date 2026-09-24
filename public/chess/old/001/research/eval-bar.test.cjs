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
