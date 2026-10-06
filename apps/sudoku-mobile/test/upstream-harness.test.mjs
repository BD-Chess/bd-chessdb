import test from 'node:test';
import assert from 'node:assert/strict';
import harness from './upstream/sudoku-ui-harness.cjs';

test('upstream adapter preserves desktop defaults and explicit phone viewports', async t => {
  const desktop = await harness.boot(t);
  assert.equal(desktop.w.innerWidth, 1024);
  assert.equal(desktop.w.innerHeight, 768);
  assert.equal(desktop.w.SudokuNavigator.ui.mobile(), false);
  const phone = await harness.boot(t, {}, {width:402,height:874});
  assert.equal(phone.w.innerWidth, 402);
  assert.equal(phone.w.innerHeight, 874);
  assert.equal(phone.w.SudokuNavigator.ui.mobile(), true);
});
