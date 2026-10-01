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

test('desktop tab controller switches views without stopping an open Deep panel', async () => {
  const { JSDOM } = require('jsdom');
  const script = fs.readFileSync(path.join(root, 'js/8zc-lab-layout.js'), 'utf8');
  const dom = new JSDOM(`<!doctype html><html><body>
    <main id="main"></main>
    <section id="controls">
      <nav id="desktopViewTabs">
        <button data-desktop-view="moves" aria-selected="true">Moves</button>
        <button data-desktop-view="review" aria-selected="false">Review</button>
        <button data-desktop-view="deep" aria-selected="false">Deep</button>
        <button data-desktop-view="dcc" aria-selected="false">DCC</button>
      </nav>
      <div id="workspaceDisplay" tabindex="0"></div>
      <div id="viewToggle">
        <button id="btnSim">Sim / Play</button>
        <button id="btnReplay">DCC replay</button>
        <button id="btnViewToggle" aria-pressed="false">DCC analysis</button>
        <button id="btnGameReview" aria-expanded="false">Review game</button>
      </div>
      <div id="desktopViewContext"><button id="btnDesktopDccReplay" hidden>DCC replay…</button><span id="dccProgress"></span></div>
      <div class="workspace-bottom">
        <div id="workspacePrimaryActions"><button id="btnWorkspaceMore">More +</button></div>
        <div id="workspaceFocusBar" hidden><button id="btnLabPause">Pause</button><button id="btnLabTools">Tools</button></div>
        <div id="workspaceToolContent">
          <button id="btnNew">New game</button>
          <button id="btnGames">Game library</button>
          <button id="btnDeepAnalysis" aria-expanded="false">Deep analysis</button>
          <button id="btnResetSettings">Reset</button>
        </div>
      </div>
    </section>
    <dialog id="labToolsDialog"><button id="btnCloseLabTools">Close</button><div id="labToolsBody"></div></dialog>
  </body></html>`, { runScripts: 'outside-only', url: 'https://example.test/chess-lab/', pretendToBeVisual: true });
  const { window: w } = dom;
  const d = w.document, byId = id => d.getElementById(id);
  w.ChessLabReady = Promise.resolve();
  let replayClicks = 0;
  byId('btnReplay').addEventListener('click', () => { replayClicks++; });
  byId('btnViewToggle').addEventListener('click', () => byId('btnViewToggle').setAttribute('aria-pressed', byId('btnViewToggle').getAttribute('aria-pressed') === 'true' ? 'false' : 'true'));
  byId('btnGameReview').addEventListener('click', () => byId('btnGameReview').setAttribute('aria-expanded', byId('btnGameReview').getAttribute('aria-expanded') === 'true' ? 'false' : 'true'));
  byId('btnDeepAnalysis').addEventListener('click', () => byId('btnDeepAnalysis').setAttribute('aria-expanded', byId('btnDeepAnalysis').getAttribute('aria-expanded') === 'true' ? 'false' : 'true'));
  w.eval(script);
  d.dispatchEvent(new w.Event('DOMContentLoaded'));
  await new Promise(resolve => w.setTimeout(resolve, 0));

  assert.deepEqual([...byId('workspacePrimaryActions').querySelectorAll('button')].map(x => x.id), ['btnNew', 'btnGames', 'btnSim', 'btnWorkspaceMore']);

  d.querySelector('[data-desktop-view="review"]').click();
  await new Promise(resolve => w.setTimeout(resolve, 0));
  assert.equal(d.body.dataset.desktopView, 'review');
  assert.equal(byId('btnGameReview').getAttribute('aria-expanded'), 'true');

  d.querySelector('[data-desktop-view="deep"]').click();
  await new Promise(resolve => w.setTimeout(resolve, 0));
  assert.equal(d.body.dataset.desktopView, 'deep');
  assert.equal(byId('btnGameReview').getAttribute('aria-expanded'), 'false');
  assert.equal(byId('btnDeepAnalysis').getAttribute('aria-expanded'), 'true');

  d.querySelector('[data-desktop-view="moves"]').click();
  await new Promise(resolve => w.setTimeout(resolve, 0));
  assert.equal(d.body.dataset.desktopView, 'moves');
  assert.equal(byId('btnDeepAnalysis').getAttribute('aria-expanded'), 'true', 'Deep remains alive in the background');

  d.querySelector('[data-desktop-view="dcc"]').click();
  await new Promise(resolve => w.setTimeout(resolve, 0));
  assert.equal(d.body.dataset.desktopView, 'dcc');
  assert.equal(byId('btnViewToggle').getAttribute('aria-pressed'), 'true');
  assert.equal(byId('btnDeepAnalysis').getAttribute('aria-expanded'), 'true');
  assert.equal(byId('btnDesktopDccReplay').hidden, false);
  byId('btnDesktopDccReplay').click();
  assert.equal(replayClicks, 1);

  d.querySelector('[data-desktop-view="moves"]').click();
  await new Promise(resolve => w.setTimeout(resolve, 0));
  assert.equal(byId('btnViewToggle').getAttribute('aria-pressed'), 'false');
  assert.equal(byId('btnDeepAnalysis').getAttribute('aria-expanded'), 'true');
  dom.window.close();
});
