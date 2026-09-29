/* Shared APP view controller. The iframe preview gives it the same narrow
 * viewport as a phone; all analysis/game state remains in the LAB-derived host. */
(function (root) {
  'use strict';
  const doc = root.document;
  const byId = id => doc.getElementById(id);
  const views = new Set(['board', 'moves', 'review', 'deep', 'dcc']);
  const scroll = { moves: 0, dcc: 0 };
  let current = 'board', host = null, miniBoard = null, lastFen = '', activity = {};

  function reviewPanel() { return byId('gameReviewPanel'); }
  function deepPanel() { return byId('deepAnalysisPanel'); }
  function isDccOpen() { return byId('btnViewToggle')?.getAttribute('aria-pressed') === 'true'; }
  function updatePosition() {
    if (!host) return;
    const context = host.getContext();
    if (!context?.fen) return;
    const title = byId('boardGameTitle')?.textContent?.trim() || byId('gameTitle')?.textContent?.trim() || 'ChessBest';
    const ply = Array.isArray(context.history) ? context.history.length : null;
    const label = ply == null ? 'Current position' : (ply === 0 ? 'Starting position' : `Position after ${ply} half-moves`);
    byId('appGameName').textContent = title;
    byId('appPositionName').textContent = label;
    byId('appPreviewTitle').textContent = title;
    byId('appPreviewMove').textContent = label;
    if (current !== 'board') {
      if (!miniBoard && root.Chessboard) {
        miniBoard = root.Chessboard('appMiniBoard', {
          position: context.fen, draggable: false,
          pieceTheme: 'img/chesspieces/wikipedia/{piece}.png'
        });
        lastFen = context.fen;
      } else if (miniBoard && context.fen !== lastFen) {
        miniBoard.position(context.fen, false);
        lastFen = context.fen;
      }
    }
  }
  function resizeVisibleBoard() {
    root.requestAnimationFrame(() => root.requestAnimationFrame(() => {
      if (current === 'board') root.dispatchEvent(new Event('8zc:resize'));
      else miniBoard?.resize();
    }));
  }
  function closeReview() {
    if (reviewPanel() && !reviewPanel().hidden) byId('btnGameReview')?.click();
  }
  function closeDeep() {
    if (deepPanel() && !deepPanel().hidden) deepPanel().querySelector('[data-deep="close"]')?.click();
  }
  function closeWorkspaceDrawer() {
    for (const [panelId, buttonId] of [['popularGamesPanel', 'btnCloseGames'], ['settingsPanel', 'btnCloseSettings']]) {
      if (byId(panelId)?.classList.contains('open')) byId(buttonId)?.click();
    }
  }
  function setView(next) {
    if (!views.has(next)) return;
    const display = byId('workspaceDisplay');
    if (current === 'moves' || current === 'dcc') scroll[current] = display.scrollTop;
    closeWorkspaceDrawer();
    if (current === 'review' && next !== 'review') closeReview();
    if (current === 'deep' && next !== 'deep') closeDeep();
    current = next;
    doc.body.dataset.appView = next;
    byId('appPositionPreview').hidden = next === 'board';
    byId('appReplay').hidden = next !== 'dcc';
    for (const tab of byId('appTabs').querySelectorAll('[data-app-tab]')) {
      if (tab.dataset.appTab === next) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
    if (next !== 'dcc' && isDccOpen()) byId('btnViewToggle').click();
    if (next === 'dcc' && !isDccOpen()) byId('btnViewToggle').click();
    if (next === 'review' && reviewPanel()?.hidden) byId('btnGameReview').click();
    if (next === 'review' && reviewPanel() && !reviewPanel().dataset.appObserved && root.MutationObserver) {
      const panel = reviewPanel();
      panel.dataset.appObserved = 'true';
      new MutationObserver(() => { if (current === 'review' && panel.hidden) setView('moves'); })
        .observe(panel, { attributes: true, attributeFilter: ['hidden'] });
    }
    if (next === 'deep' && deepPanel()?.hidden) byId('btnDeepAnalysis').click();
    if (next === 'deep' && deepPanel() && !deepPanel().dataset.appObserved && root.MutationObserver) {
      const panel = deepPanel();
      panel.dataset.appObserved = 'true';
      new MutationObserver(() => { if (current === 'deep' && panel.hidden) setView('moves'); })
        .observe(panel, { attributes: true, attributeFilter: ['hidden'] });
    }
    if (next === 'moves' || next === 'dcc') display.scrollTop = scroll[next];
    updatePosition();
    resizeVisibleBoard();
  }
  function updateActivity(detail) {
    activity = { ...activity, ...detail };
    const label = activity.kind === 'replay' ? 'DCC replay running'
      : activity.kind === 'local' ? 'Game in progress' : 'Simulation running';
    const active = activity.kind === 'replay' || activity.kind === 'local' || !!activity.simRunning;
    byId('appActivity').hidden = !active;
    byId('appActivityText').textContent = label;
    byId('appPause').textContent = activity.kind === 'replay' ? 'Stop replay'
      : activity.kind === 'local' ? 'End game' : 'Pause';
    byId('appPause').disabled = !active;
  }
  function init() {
    host = root.ChessLabHost;
    if (!host || !byId('appTabs')) return;
    // Move existing controls, keeping their IDs and event listeners intact.
    byId('appBoardControls').append(doc.querySelector('.analysis-source-row'), doc.querySelector('.top-buttons'), byId('appSim'));
    byId('appClocks').append(byId('workspaceClockSlot'), byId('humanSession'));
    host.onChange(updatePosition);
    for (const tab of byId('appTabs').querySelectorAll('[data-app-tab]')) {
      tab.addEventListener('click', () => setView(tab.dataset.appTab));
    }
    byId('appExpandBoard').addEventListener('click', () => setView('board'));
    byId('appNew').addEventListener('click', () => { byId('btnNew').click(); setView('board'); });
    byId('appGames').addEventListener('click', () => {
      setView('moves');
      if (!byId('popularGamesPanel').classList.contains('open')) byId('btnGames').click();
    });
    byId('appMore').addEventListener('click', () => root.ChessLabLayout?.openTools());
    byId('appSim').addEventListener('click', () => byId('btnSim').click());
    byId('appSimMore').addEventListener('click', () => {
      root.ChessLabLayout?.closeTools({ restoreFocus: false });
      setView('board');
      byId('btnSim').click();
    });
    byId('appReplay').addEventListener('click', () => byId('btnReplay').click());
    byId('appPause').addEventListener('click', () => doc.dispatchEvent(new CustomEvent('chess:pause-request', { detail: { source: 'app-header' } })));
    // Drawers belong to #controls. Reveal that area before the original action runs.
    byId('labToolsDialog').addEventListener('click', event => {
      const id = event.target.closest('button')?.id;
      if (id === 'btnGames' || id === 'btnSettings') setView('moves');
      if (id === 'btnNew') root.setTimeout(() => setView('board'), 0);
      if (id === 'btnDeepAnalysis') root.setTimeout(() => setView('deep'), 0);
      if (id === 'btnViewToggle') root.setTimeout(() => setView('dcc'), 0);
    }, true);
    byId('labToolsDialog').addEventListener('close', () => byId('appMore').focus({ preventScroll: true }));
    byId('replayStart')?.addEventListener('click', () => root.setTimeout(() => setView('board'), 0));
    byId('simStartBtn')?.addEventListener('click', () => root.setTimeout(() => setView('board'), 0));
    byId('humanStart')?.addEventListener('click', () => root.setTimeout(() => setView('board'), 0));
    if (root.MutationObserver) new MutationObserver(() => {
      if (current === 'board' && isDccOpen()) setView('dcc');
    }).observe(byId('btnViewToggle'), { attributes: true, attributeFilter: ['aria-pressed'] });
    doc.addEventListener('chess:activity', event => updateActivity(event.detail || {}));
    const gameTitle = byId('boardGameTitle');
    if (gameTitle && root.MutationObserver) new MutationObserver(updatePosition).observe(gameTitle, { childList: true, characterData: true, subtree: true });
    updatePosition();
    resizeVisibleBoard();
  }
  const boot = () => {
    Promise.resolve(root.ChessLabReady || root.ChessLabStorage?.ready).then(init).catch(() => {
      byId('appPositionName').textContent = 'APP storage is unavailable';
    });
  };
  if (doc.readyState === 'complete') boot();
  else root.addEventListener('load', boot, { once: true });
})(window);
