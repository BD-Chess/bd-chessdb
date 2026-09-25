const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const script = fs.readFileSync(path.join(__dirname, '../js/8zc-new-ui.js'), 'utf8');
const pgn = '[Event "Paired openings"]\n[White "CDB/SF"]\n[Black "SF+DCC"]\n[Opening "Sicilian"]\n[Result "1-0"]\n\n1. e4 c5 1-0';
function fixture() {
  const ids = ['btnWhatsNew', 'btnCloseWhatsNew', 'btnStartExploring', 'btnPlayBest', 'bestMoveLink', 'btnGames', 'btnSettings', 'simCancelBtn', 'replayCancel', 'first'];
  const dom = new JSDOM('<!doctype html>' + ids.map(id => `<button id="${id}">${id}</button>`).join('') + '<dialog id="whatsNewDialog"></dialog><div id="board"></div><div id="settingsPanel"><h2 class="drawer-heading">Settings</h2></div><div id="popularGamesPanel"><h2 class="drawer-heading">Games</h2><select><option value="">TCEC — Select a game</option><option value="native">Original TCEC game</option></select></div><div id="simModal" style="display:none"></div><div id="replayModal" style="display:none"></div>', { runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.eval(script);
  return dom;
}
const collections = games => [{ id: 'matches', label: 'My matches', games }];
const send = (window, data) => window.dispatchEvent(new window.CustomEvent('chess-sim-collections', { detail: data }));

test('generated collections received before load are searchable and open by ID without native imports', () => {
  const dom = fixture(), w = dom.window, d = w.document;
  send(w, collections([{ id: 'game-1', label: 'Match one', pgn }]));
  w.dispatchEvent(new w.Event('load'));
  const category = d.getElementById('popularGamesSelect');
  assert.equal(category.options.length, 3);
  category.value = 'sim:matches'; category.dispatchEvent(new w.Event('change'));
  const buttons = d.querySelectorAll('.library-result');
  assert.equal(buttons.length, 1);
  let selected = null, nativeChanges = 0;
  w.addEventListener('chess-sim-open-game', event => selected = event.detail.id);
  d.querySelector('.library-native-selects select').addEventListener('change', () => nativeChanges++);
  buttons[0].click(); assert.equal(selected, 'game-1'); assert.equal(nativeChanges, 0);
  const search = d.getElementById('gameLibrarySearch'); search.value = 'Sicilian'; search.dispatchEvent(new w.Event('input'));
  assert.equal(d.querySelectorAll('.library-result').length, 1);
  dom.window.close();
});

test('new results refresh an open selected collection and plain-text labels do not become markup', () => {
  const dom = fixture(), w = dom.window, d = w.document;
  w.dispatchEvent(new w.Event('load'));
  send(w, collections([{ id: 'game-1', label: 'First', pgn }]));
  const category = d.getElementById('popularGamesSelect'); category.value = 'sim:matches'; category.dispatchEvent(new w.Event('change'));
  send(w, collections([{ id: 'game-1', label: 'First', pgn }, { id: 'game-2', label: '<img src=x onerror=alert(1)>', pgn }]));
  assert.equal(category.value, 'sim:matches');
  assert.equal(d.querySelectorAll('.library-result').length, 2);
  assert.equal(d.querySelectorAll('.library-result img').length, 0);
  send(w, []); assert.equal(category.value, 'all');
  assert.equal(d.querySelectorAll('.library-result').length, 1);
  dom.window.close();
});
