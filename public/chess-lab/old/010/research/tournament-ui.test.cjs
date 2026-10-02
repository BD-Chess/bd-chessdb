const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const source = fs.readFileSync(path.resolve(__dirname, '../js/8zc-tournament-ui.js'), 'utf8');

function setup(host) {
  const dom = new JSDOM('<!doctype html><html><body><button id="launcher">Sim</button></body></html>', {
    url: 'https://www.mdlxdcc.org/chess/', runScripts: 'outside-only', pretendToBeVisual: true
  });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  window.eval(source);
  const ui = window.ChessTournamentUI.create(host);
  const dialog = window.document.getElementById('simTournamentDialog');
  return { dom, window, ui, dialog };
}

test('Sim offers both human colors and hands control to the existing game setup', async t => {
  const calls = [];
  const { dom, ui, dialog } = setup({ onHuman(color) {
    assert.equal(dialog.open, false, 'the tournament dialog closes before the human setup opens');
    calls.push(color);
  } });
  t.after(() => dom.window.close());
  for (const [action, color] of [['human-white', 'white'], ['human-black', 'black']]) {
    ui.open({ currentGameTitle: 'Current position' });
    const group = dialog.querySelector('[data-ui="human-play"]');
    assert.equal(group.hidden, false);
    assert.equal(group.getAttribute('aria-labelledby'), 'simHumanTitle');
    dialog.querySelector(`[data-action="${action}"]`).click();
    assert.equal(dialog.open, false);
    assert.equal(calls.at(-1), color);
  }
  assert.deepEqual(calls, ['white', 'black']);
});

test('adding human play leaves tournament submission and Lichess entry intact', async t => {
  let started = 0, lichess = 0;
  const { dom, window, ui, dialog } = setup({
    onHuman() {},
    onStart(config) { started++; assert.equal(config.format, 'single'); return true; },
    onLichess() { assert.equal(dialog.open, false); lichess++; }
  });
  t.after(() => dom.window.close());
  ui.open();
  dialog.querySelector('[data-ui="form"]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await Promise.resolve();
  assert.equal(started, 1);
  assert.equal(dialog.open, false);
  ui.open();
  dialog.querySelector('[data-action="lichess"]').click();
  assert.equal(lichess, 1);
  assert.equal(dialog.open, false);
});

test('human play controls are absent when the host cannot start a human game', t => {
  const { dom, ui, dialog } = setup({ onStart() { return true; } });
  t.after(() => dom.window.close());
  ui.open();
  assert.equal(dialog.querySelector('[data-ui="human-play"]').hidden, true);
  assert.equal(dialog.querySelector('[data-action="lichess"]').hidden, true);
});
