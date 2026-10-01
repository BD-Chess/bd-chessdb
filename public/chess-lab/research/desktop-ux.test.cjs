const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'js/8zc-lab-layout.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'css/8zc-styles.css'), 'utf8');
const deep = fs.readFileSync(path.join(root, 'css/8zc-deep.css'), 'utf8');

test('desktop uses stable analysis views and separate primary actions', () => {
  const tabOrder = [...html.matchAll(/data-desktop-view="(moves|review|deep|dcc)"/g)].map(x => x[1]);
  assert.deepEqual(tabOrder, ['moves', 'review', 'deep', 'dcc']);
  assert.match(layout, /\['btnNew', 'btnGames', 'btnSim'\]/);
  assert.match(html, /id="btnDesktopDccReplay"[^>]*hidden>DCC replay…<\/button>/);
  assert.match(html, /id="btnAnalysisDeepen"[^>]*>Deeper SF<\/button>/);
});

test('legacy controls stay as backing controls instead of duplicate desktop navigation', () => {
  assert.match(html, /id="viewToggle" class="legacy-view-controls"/);
  assert.match(styles, /body:not\(\.app-mobile\) \.legacy-view-controls\{display:none!important\}/);
  assert.match(styles, /\.lab-research-tools #btnDeepAnalysis\{display:none!important\}/);
});

test('Deep can stay alive while Moves or DCC is shown', () => {
  assert.match(deep, /not\(\[data-desktop-view="deep"\]\) #deepAnalysisPanel\{display:none!important\}/);
  assert.match(deep, /data-desktop-view="moves"[^\n]+#moves\{display:block!important\}/);
  assert.match(deep, /data-desktop-view="dcc"[^\n]+#dccAnalysisPanel\{display:block!important\}/);
  const setView = layout.slice(layout.indexOf('function setDesktopView'), layout.indexOf('function initDesktopViews'));
  assert.doesNotMatch(setView, /next !== 'deep'.*btnDeepAnalysis/s);
});
