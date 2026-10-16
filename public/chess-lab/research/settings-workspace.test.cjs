const { test } = require('node:test');
const assert = require('node:assert/strict');
const { boot } = require('./source-context-integration.test.cjs');
const flush = w => new Promise(resolve => w.requestAnimationFrame(resolve));

test('APP More to Settings keeps natural focus inside after the asynchronous Tools close event', async t => {
  const h = await boot(t, { skipReady: true, beforeInit(w) {
    w.document.body.classList.add('app-mobile');
    w.history.replaceState(null, '', '?view=app');
  } }), { w, el } = h;
  await flush(w); await flush(w);
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    w.setTimeout(() => this.dispatchEvent(new w.Event('close')), 0);
  };
  for (const method of ['escape', 'x', 'escape']) {
    el('appMore').click();
    el('btnSettings').click(); await flush(w); await flush(w);
    assert.equal(el('settingsPanel').contains(w.document.activeElement), true);
    assert.equal(el('labToolsDialog').open, false);
    if (method === 'x') el('btnCloseSettings').click();
    else w.document.activeElement.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flush(w);
    assert.equal(el('settingsPanel').classList.contains('open'), false);
    assert.equal(el('appTabs').hasAttribute('inert'), false);
  }
});

test('Settings X, Escape and trigger toggle restore temporary input isolation without changing game/preferences', async t => {
  const h = await boot(t, { skipReady: true }), { w, el } = h;
  h.w.ChessLabHost.navigate({ moves: ['e2e4', 'e7e5', 'g1f3'] });
  const before = JSON.stringify(w.ChessLabHost.getReviewGame());
  const settings = w.localStorage.getItem('ChessBest:LAB:v2:settings');
  const bottom = w.document.querySelector('.workspace-bottom');
  el('btnNew').disabled = true;
  w.document.querySelector('.workspace-top').setAttribute('inert', 'already');
  el('workspaceFocusBar').setAttribute('inert', '');
  for (const close of ['x', 'escape', 'toggle']) {
    el('btnSettings').click(); await flush(w);
    assert.equal(bottom.hasAttribute('inert'), true);
    assert.equal(el('appTabs').hasAttribute('inert'), true);
    assert.equal(el('settingsPanel').closest('[inert]'), null);
    assert.equal(el('btnNew').disabled, true);
    if (close === 'x') el('btnCloseSettings').click();
    else if (close === 'toggle') el('btnSettings').click();
    else el('btnCloseSettings').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flush(w);
    assert.equal(bottom.hasAttribute('inert'), false, close);
    assert.equal(el('appTabs').hasAttribute('inert'), false, close);
    assert.equal(el('workspaceFocusBar').hasAttribute('inert'), true, 'pre-existing inert state survives');
    assert.equal(w.document.querySelector('.workspace-top').getAttribute('inert'), 'already', 'original attribute restored exactly');
    assert.equal(el('btnNew').disabled, true, 'disabled state survives');
    assert.equal(JSON.stringify(w.ChessLabHost.getReviewGame()), before);
    assert.equal(w.localStorage.getItem('ChessBest:LAB:v2:settings'), settings);
  }
  assert.equal(h.errors.length, 0, h.errors.join('\n'));
});

for (const nested of [false, true]) test('Legacy setup modal owns keyboard/focus and preserves background state' + (nested ? ' inside APP preview' : ''), async t => {
  const h = await boot(t, { skipReady: true }), { w, el } = h;
  w.HTMLElement.prototype.getClientRects = function () { return [{ width: 10, height: 10 }]; };
  if (nested) {
    const frame = w.document.createElement('section'), screen = w.document.createElement('div');
    frame.className = 'app-preview-device'; screen.className = 'app-preview-content';
    screen.append(el('main'), el('replayModal'), el('simModal')); frame.append(screen, el('appTabs')); w.document.body.append(frame);
  }
  el('btnSettings').disabled = true;
  el('btnDesktopDccReplay').focus(); el('btnDesktopDccReplay').click(); await flush(w);
  assert.equal(el('main').hasAttribute('inert'), true);
  assert.equal(el('replayModal').closest('[inert]'), null, 'the dialog stays interactive through nested ancestors');
  assert.equal(el('replayModal').contains(w.document.activeElement), true);
  el('next').focus(); assert.equal(el('replayModal').contains(w.document.activeElement), true, 'focus cannot escape');
  el('replayCancel').focus();
  el('replayCancel').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  assert.equal(w.document.activeElement, el('replayDepth'), 'Tab wraps to first control');
  el('replayDepth').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await flush(w);
  assert.equal(el('replayModal').style.display, 'none');
  assert.equal(el('main').hasAttribute('inert'), false);
  assert.equal(el('btnSettings').disabled, true);
  assert.equal(w.document.activeElement, el('btnDesktopDccReplay'));
  assert.equal(h.errors.length, 0, h.errors.join('\n'));
});

test('Settings keys belong to the workspace panel and closing restores scroll only for its originating view', async t => {
  const h = await boot(t, { skipReady: true }), { w, el } = h;
  w.ChessLabHost.navigate({ moves: ['e2e4', 'e7e5', 'g1f3'] });
  const before = w.ChessLabHost.getContext().fen;
  el('workspaceDisplay').scrollTop = 147;
  el('btnSettings').click(); await flush(w);
  el('workspaceDisplay').scrollTop = 0;
  for (const key of ['Home', 'End', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
    el('btnCloseSettings').dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    assert.equal(w.ChessLabHost.getContext().fen, before, key);
  }
  el('btnCloseSettings').click(); await flush(w); await flush(w);
  assert.equal(el('workspaceDisplay').scrollTop, 147);
  el('btnSettings').click(); await flush(w);
  w.document.querySelector('[data-desktop-view="deep"]').click(); await flush(w); await flush(w);
  assert.equal(el('settingsPanel').classList.contains('open'), false);
  assert.equal(w.document.querySelector('.workspace-bottom').hasAttribute('inert'), false);
  assert.equal(w.document.body.dataset.desktopView, 'deep');
  assert.equal(el('workspaceDisplay').scrollTop, 0, 'an explicit view change keeps the destination scroll');
  el('btnGames').click(); await flush(w);
  assert.equal(w.document.querySelector('.workspace-bottom').hasAttribute('inert'), false, 'Library stays nonmodal');
});
