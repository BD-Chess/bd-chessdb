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
});

test('legacy controls remain hidden backing controls', () => {
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

test('desktop tabs and top DCC actions share the same backing state without duplicate Review', async () => {
  const script = fs.readFileSync(path.join(root, 'js/8zc-lab-layout.js'), 'utf8');
  const dom = new JSDOM(`<!doctype html><html><body>
    <main id="main"></main>
    <section id="controls">
      <div class="analysis-source-row"><button id="btnDesktopDccReplay">DCC replay</button><button id="btnDesktopDccAnalysis" aria-pressed="false">DCC analysis</button></div>
      <div class="workspace-analysis"><div id="workspaceDisplay" tabindex="0"></div></div>
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
  dom.window.close();
});
