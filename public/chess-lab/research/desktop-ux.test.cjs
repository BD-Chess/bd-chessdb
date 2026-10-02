const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'js/8zc-lab-layout.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'css/8zc-styles.css'), 'utf8');
const deep = fs.readFileSync(path.join(root, 'css/8zc-deep.css'), 'utf8');
const reviewUi = fs.readFileSync(path.join(root, 'js/8zc-review-ui.js'), 'utf8');
const utils = fs.readFileSync(path.join(root, 'js/8zc-utils.js'), 'utf8');
const newUi = fs.readFileSync(path.join(root, 'js/8zc-new-ui.js'), 'utf8');

test('desktop separates top analysis controls from three aligned bottom rows', () => {
  const doc = new JSDOM(html).window.document;
  const source = doc.querySelector('.analysis-source-row');
  assert.ok(source);
  assert.deepEqual([...source.children].map(node => node.id || node.querySelector?.('#analysisDCC')?.id || ''), [
    'btnAnalysisDeepen', 'analysisSource', 'analysisDCC', 'btnDesktopDccReplay', 'btnDesktopDccAnalysis'
  ]);
  assert.equal(source.querySelector('#analysisSourceStatus'), null);
  assert.ok(doc.querySelector('.analysis-status-row #analysisSourceStatus'));
  assert.ok(doc.querySelector('.analysis-status-row #dccProgress'));
  assert.equal(source.querySelector('#btnGameReview'), null, 'Review is not duplicated in the top analysis controls');

  const stack = doc.querySelector('.desktop-control-stack');
  assert.ok(stack);
  assert.deepEqual([...stack.children].map(node => node.id), ['desktopNavRow', 'desktopViewTabs', 'workspacePrimaryActions']);
  assert.deepEqual([...doc.querySelectorAll('#desktopViewTabs [data-desktop-view]')].map(node => node.textContent), ['Moves','Review','Deep','DCC']);
  assert.match(layout, /\['btnNew', 'btnGames', 'btnSim'\]/);
  assert.match(html, /id="btnAnalysisDeepen"[^>]*>Deeper SF<\/button>/);
  assert.match(styles, /grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\) minmax\(0,2\.35fr\)/);
  assert.match(styles, /workspace-drawer\.open\) > \.workspace-bottom[\s\S]*visibility: visible/);
  assert.match(styles, /workspace-drawer\.open\) #desktopNavRow[\s\S]*visibility: hidden/);
  assert.match(styles, /workspace-drawer\.open\) #desktopViewTabs,[\s\S]*#workspacePrimaryActions[\s\S]*pointer-events: auto/);
  assert.match(styles, /data-desktop-view="library"[\s\S]*#workspaceDisplay > #popularGamesPanel/);
  assert.match(styles, /data-desktop-view="library"\] #workspaceDisplay \{ overflow: hidden; \}/);
  assert.match(styles, /#workspaceDisplay > #popularGamesPanel \{[\s\S]*display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden/);
  assert.match(styles, /\.library-result-list \{[\s\S]*overflow-y: auto;[\s\S]*pointer-events: auto/);
  assert.match(styles, /#btnUseTournamentOpening \{[\s\S]*background: var\(--ui-raised\); color: var\(--ui-text\)/);
  assert.match(styles, /data-desktop-view="review"[\s\S]*#workspaceDisplay > \.game-review-drawer/);
  assert.match(styles, /#workspacePrimaryActions #btnNew[\s\S]*background:var\(--ui-inset\)/);
});

test('legacy controls remain hidden backing controls', () => {
  assert.match(html, /id="viewToggle" class="legacy-view-controls" aria-hidden="true" hidden style="display:none !important"/);
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

test('desktop tabs and top DCC actions share the same backing state without duplicate Review', async () => {
  const script = fs.readFileSync(path.join(root, 'js/8zc-lab-layout.js'), 'utf8');
  const dom = new JSDOM(`<!doctype html><html><body>
    <main id="main"></main>
    <section id="controls">
      <div class="analysis-source-row"><button id="btnDesktopDccReplay">DCC replay</button><button id="btnDesktopDccAnalysis" aria-pressed="false">DCC analysis</button></div>
      <div class="workspace-analysis"><div id="workspaceDisplay" tabindex="0"></div></div>
      <div id="popularGamesPanel" class="workspace-drawer"></div>
      <div id="settingsPanel" class="workspace-drawer"></div>
      <button id="btnCloseGames"></button>
      <button id="btnCloseSettings"></button>
      <div id="viewToggle">
        <button id="btnSim">Sim / Play</button>
        <button id="btnReplay">DCC replay</button>
        <button id="btnViewToggle" aria-pressed="false">DCC analysis</button>
        <button id="btnGameReview" aria-expanded="false">Review game</button>
      </div>
      <div class="workspace-bottom">
        <div class="desktop-control-stack">
          <div id="desktopNavRow" class="top-buttons"></div>
          <nav id="desktopViewTabs">
            <button data-desktop-view="moves" aria-selected="true">Moves</button>
            <button data-desktop-view="review" aria-selected="false">Review</button>
            <button data-desktop-view="deep" aria-selected="false">Deep</button>
            <button data-desktop-view="dcc" aria-selected="false">DCC</button>
          </nav>
          <div id="workspacePrimaryActions"><button id="btnWorkspaceMore">More +</button></div>
        </div>
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
  </body></html>`, { runScripts:'outside-only', url:'https://example.test/chess-lab/', pretendToBeVisual:true });
  const { window:w } = dom, d=w.document, byId=id=>d.getElementById(id);
  w.ChessLabReady=Promise.resolve();
  let replayClicks=0;
  byId('btnReplay').addEventListener('click',()=>replayClicks++);
  byId('btnViewToggle').addEventListener('click',()=>byId('btnViewToggle').setAttribute('aria-pressed',byId('btnViewToggle').getAttribute('aria-pressed')==='true'?'false':'true'));
  byId('btnGameReview').addEventListener('click',()=>byId('btnGameReview').setAttribute('aria-expanded',byId('btnGameReview').getAttribute('aria-expanded')==='true'?'false':'true'));
  byId('btnDeepAnalysis').addEventListener('click',()=>byId('btnDeepAnalysis').setAttribute('aria-expanded',byId('btnDeepAnalysis').getAttribute('aria-expanded')==='true'?'false':'true'));
  byId('btnCloseGames').addEventListener('click',()=>{ byId('popularGamesPanel').classList.remove('open'); byId('btnGames').setAttribute('aria-expanded','false'); });
  byId('btnCloseSettings').addEventListener('click',()=>byId('settingsPanel').classList.remove('open'));
  w.eval(script);
  d.dispatchEvent(new w.Event('DOMContentLoaded'));
  await new Promise(resolve=>w.setTimeout(resolve,0));

  assert.deepEqual([...byId('workspacePrimaryActions').querySelectorAll('button')].map(x=>x.id),['btnNew','btnGames','btnSim','btnWorkspaceMore']);
  byId('btnDesktopDccReplay').click();
  assert.equal(replayClicks,1);

  byId('btnDesktopDccAnalysis').click();
  await new Promise(resolve=>w.setTimeout(resolve,0));
  assert.equal(d.body.dataset.desktopView,'dcc');
  assert.equal(byId('btnViewToggle').getAttribute('aria-pressed'),'true');
  assert.equal(byId('btnDesktopDccAnalysis').getAttribute('aria-pressed'),'true');

  d.querySelector('[data-desktop-view="review"]').click();
  await new Promise(resolve=>w.setTimeout(resolve,0));
  assert.equal(d.body.dataset.desktopView,'review');
  assert.equal(byId('btnViewToggle').getAttribute('aria-pressed'),'false');
  assert.equal(byId('btnGameReview').getAttribute('aria-expanded'),'true');

  d.querySelector('[data-desktop-view="deep"]').click();
  await new Promise(resolve=>w.setTimeout(resolve,0));
  assert.equal(byId('btnGameReview').getAttribute('aria-expanded'),'false');
  assert.equal(byId('btnDeepAnalysis').getAttribute('aria-expanded'),'true');

  d.querySelector('[data-desktop-view="moves"]').click();
  await new Promise(resolve=>w.setTimeout(resolve,0));
  assert.equal(byId('btnDeepAnalysis').getAttribute('aria-expanded'),'true','Deep remains alive in background');

  byId('popularGamesPanel').classList.add('open');
  byId('btnGames').setAttribute('aria-expanded','true');
  d.querySelector('[data-desktop-view="review"]').click();
  await new Promise(resolve=>w.setTimeout(resolve,0));
  assert.equal(byId('popularGamesPanel').classList.contains('open'),false,'tab switch closes Game library without using X');

  d.dispatchEvent(new w.CustomEvent('chess:library-loaded',{detail:{view:'moves',curatedReview:false}}));
  await new Promise(resolve=>w.setTimeout(resolve,0));
  assert.equal(d.body.dataset.desktopView,'moves');
  d.dispatchEvent(new w.CustomEvent('chess:library-loaded',{detail:{view:'review',curatedReview:true}}));
  await new Promise(resolve=>w.setTimeout(resolve,0));
  assert.equal(d.body.dataset.desktopView,'review');

  byId('btnGames').click();
  await new Promise(resolve=>w.setTimeout(resolve,0));
  assert.equal(d.body.dataset.desktopView,'library');
  assert.equal(byId('popularGamesPanel').parentElement,byId('workspaceDisplay'));
  assert.equal(byId('popularGamesPanel').classList.contains('open'),true);
  assert.equal(byId('btnGames').classList.contains('is-active'),true);
  d.querySelector('[data-desktop-view="deep"]').click();
  await new Promise(resolve=>w.setTimeout(resolve,0));
  assert.equal(d.body.dataset.desktopView,'deep');
  assert.equal(byId('popularGamesPanel').classList.contains('open'),false);
  dom.window.close();
});

test('Game library routes curated reviews only after a successful load and Review preserves scroll', () => {
  assert.match(utils, /panelId === 'popularGamesPanel' && !document\.body\.classList\.contains\('app-mobile'\)/);
  assert.match(utils, /sel\.chessLoadSelected = loadSelectedGame/);
  assert.match(utils, /\{ topPick: bucket\.topPicks, library: true \}/);
  assert.match(utils, /if \(options\.archive \|\| options\.library\) openCommitted\(\)/);
  assert.match(newUi, /typeof entry\.select\.chessLoadSelected === 'function'[\s\S]*loaded = await entry\.select\.chessLoadSelected\(\)/);
  assert.match(utils, /CustomEvent\('chess:library-loaded'[\s\S]*curatedReview \? 'review' : 'moves'/);
  assert.doesNotMatch(utils, /document\.getElementById\('main'\)\.scrollIntoView/);
  assert.match(reviewUi, /const scrollByKey = new Map\(\)/);
  assert.match(reviewUi, /desktop-workspace-panel/);
  assert.match(reviewUi, /reviewScroller\(\)\.scrollTop/);
  assert.match(reviewUi, /reviewScroller\(\)\.scrollTop = scrollByKey\.get\(key\) \|\| 0/);
  const openHandler = reviewUi.slice(reviewUi.indexOf("button.addEventListener('click'"), reviewUi.indexOf("close.addEventListener('click'"));
  assert.doesNotMatch(openHandler, /reviewScroller\(\)\.scrollTop\s*=\s*0/);
});
