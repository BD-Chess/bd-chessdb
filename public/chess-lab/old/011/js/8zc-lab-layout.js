/* Analysis-lab presentation only. Chess state and cancellation belong to utils. */
(function (root) {
  'use strict';
  const STORAGE_KEY = 'ChessBest:LAB:v2:layout';
  const defaults = Object.freeze({ focusMode: 'auto', workspaceWidth: 0, compact: false,
    pauseOnDisagreement: false, pauseOnSwing: false, pauseSwingCp: 50, pauseOnMissing: false });
  const fields = {
    focusMode: 'settingLabFocusMode', workspaceWidth: 'settingLabWorkspaceWidth',
    compact: 'settingLabCompact', pauseOnDisagreement: 'settingLabPauseDisagreement',
    pauseOnSwing: 'settingLabPauseSwing', pauseSwingCp: 'settingLabPauseSwingCp',
    pauseOnMissing: 'settingLabPauseMissing'
  };
  const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
  function normalize(value) {
    const input = value && typeof value === 'object' ? value : {};
    return {
      focusMode: input.focusMode === 'expanded' ? 'expanded' : 'auto',
      workspaceWidth: input.workspaceWidth && Number.isFinite(Number(input.workspaceWidth)) ? clamp(input.workspaceWidth, 340, 560, 0) : 0,
      compact: input.compact === true,
      pauseOnDisagreement: input.pauseOnDisagreement === true,
      pauseOnSwing: input.pauseOnSwing === true,
      pauseSwingCp: clamp(input.pauseSwingCp, 10, 2000, 50),
      pauseOnMissing: input.pauseOnMissing === true
    };
  }
  let preferences = { ...defaults };

  let activity = { simRunning: false, kind: 'analysis', paused: false };
  let elements = null;
  let focused = false;
  let closing = false;
  let resizeFrame = 0;
  const byId = id => document.getElementById(id);
  const desktopViews = new Set(['moves', 'review', 'deep', 'dcc', 'library']);
  const desktopScroll = { moves: 0, review: 0, deep: 0, dcc: 0, library: 0 };
  let desktopView = 'moves', desktopSyncing = false;

  function backingState() {
    return {
      dcc: byId('btnViewToggle')?.getAttribute('aria-pressed') === 'true',
      review: byId('btnGameReview')?.getAttribute('aria-expanded') === 'true',
      deep: byId('btnDeepAnalysis')?.getAttribute('aria-expanded') === 'true'
    };
  }
  function paintDesktopView() {
    if (document.body.classList.contains('app-mobile')) return;
    document.body.dataset.desktopView = desktopView;
    const tabs = byId('desktopViewTabs');
    for (const tab of tabs?.querySelectorAll('[data-desktop-view]') || []) {
      const active = tab.dataset.desktopView === desktopView;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    const dccAction = byId('btnDesktopDccAnalysis');
    if (dccAction) {
      const active = desktopView === 'dcc';
      dccAction.setAttribute('aria-pressed', String(active));
      dccAction.classList.toggle('is-active', active);
    }
    const libraryOpen = desktopView === 'library';
    byId('popularGamesPanel')?.classList.toggle('open', libraryOpen);
    byId('btnGames')?.setAttribute('aria-expanded', String(libraryOpen));
    byId('btnGames')?.classList.toggle('is-active', libraryOpen);
    const display = byId('workspaceDisplay');
    if (display) display.setAttribute('aria-label', {
      moves: 'Moves', review: 'Game review', deep: 'Deep analysis', dcc: 'DCC analysis', library: 'Game library'
    }[desktopView]);
  }
  function closeDesktopDrawers() {
    if (byId('settingsPanel')?.classList.contains('open')) byId('btnCloseSettings')?.click();
  }
  function setDesktopView(next, options = {}) {
    if (document.body.classList.contains('app-mobile') || !desktopViews.has(next)) return;
    closeDesktopDrawers();
    const display = byId('workspaceDisplay');
    if (display && desktopViews.has(desktopView)) desktopScroll[desktopView] = display.scrollTop;
    const restoreScroll = desktopScroll[next] || 0;
    desktopView = next;
    paintDesktopView();
    if (desktopSyncing) return;
    desktopSyncing = true;
    try {
      const state = backingState();
      if (next !== 'review' && state.review) byId('btnGameReview')?.click();
      if (next !== 'dcc' && state.dcc) byId('btnViewToggle')?.click();
      if (next === 'dcc' && !backingState().dcc) byId('btnViewToggle')?.click();
      if (next === 'review' && !backingState().review) byId('btnGameReview')?.click();
      if (next === 'deep' && !backingState().deep) byId('btnDeepAnalysis')?.click();
    } finally {
      desktopSyncing = false;
    }
    const restoreViewScroll = () => {
      if (display && desktopView === next) display.scrollTop = restoreScroll;
    };
    restoreViewScroll();
    // Review is reopened by a backing-control click, which can render content
    // after the view switched. Re-apply once on the next frame so layout/CSS
    // changes cannot snap the shared workspace back to the top.
    if (next === 'review' && root.requestAnimationFrame) root.requestAnimationFrame(restoreViewScroll);
    if (!options.preserveFocus) {
      const target = byId('desktopViewTabs')?.querySelector('[data-desktop-view="' + next + '"]') || (next === 'library' ? byId('btnGames') : null);
      target?.focus({ preventScroll: true });
    }
  }
  function initDesktopViews() {
    if (document.body.classList.contains('app-mobile')) return;
    const tabs = byId('desktopViewTabs');
    const display = byId('workspaceDisplay');
    const library = byId('popularGamesPanel');
    if (!tabs || !display) return;
    if (library && library.parentElement !== display) display.appendChild(library);
    library?.classList.add('desktop-workspace-panel');
    for (const tab of tabs.querySelectorAll('[data-desktop-view]')) tab.addEventListener('click', () => setDesktopView(tab.dataset.desktopView));
    document.addEventListener('chess:library-loaded', event => {
      if (event.detail?.view === 'review') desktopScroll.review = 0;
      setDesktopView(event.detail?.view === 'review' ? 'review' : 'moves', { preserveFocus: true });
    });
    const games = byId('btnGames');
    if (games) games.onclick = () => setDesktopView('library', { preserveFocus: true });
    const closeGames = byId('btnCloseGames');
    if (closeGames) closeGames.onclick = () => setDesktopView('moves');
    library?.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setDesktopView('moves');
    }, true);
    tabs.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const ordered = [...tabs.querySelectorAll('[data-desktop-view]')];
      const index = Math.max(0, ordered.findIndex(tab => tab.dataset.desktopView === desktopView));
      const target = event.key === 'Home' ? 0 : event.key === 'End' ? ordered.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + ordered.length) % ordered.length;
      setDesktopView(ordered[target].dataset.desktopView);
    });
    byId('btnDesktopDccReplay')?.addEventListener('click', () => byId('btnReplay')?.click());
    byId('btnDesktopDccAnalysis')?.addEventListener('click', () => byId('btnViewToggle')?.click());
    const syncReplay = () => { const facade = byId('btnDesktopDccReplay'), source = byId('btnReplay'); if (facade && source) facade.disabled = source.disabled; };
    const syncDccAction = () => {
      const facade = byId('btnDesktopDccAnalysis'), source = byId('btnViewToggle');
      if (!facade || !source) return;
      facade.disabled = source.disabled;
      const active = source.getAttribute('aria-pressed') === 'true';
      facade.setAttribute('aria-pressed', String(active));
      facade.classList.toggle('is-active', active);
    };
    const replaySource = byId('btnReplay');
    if (replaySource && root.MutationObserver) new MutationObserver(syncReplay).observe(replaySource, { attributes: true, attributeFilter: ['disabled'] });
    const dccSource = byId('btnViewToggle');
    if (dccSource && root.MutationObserver) new MutationObserver(syncDccAction).observe(dccSource, { attributes: true, attributeFilter: ['disabled', 'aria-pressed'] });
    syncReplay(); syncDccAction();
    const watch = (id, attr, activeView) => {
      const node = byId(id); if (!node || !root.MutationObserver) return;
      new MutationObserver(() => {
        if (desktopSyncing) return;
        const on = node.getAttribute(attr) === 'true';
        if (on) setDesktopView(activeView, { preserveFocus: true });
        else if (desktopView === activeView) setDesktopView('moves', { preserveFocus: true });
      }).observe(node, { attributes: true, attributeFilter: [attr] });
    };
    watch('btnViewToggle', 'aria-pressed', 'dcc');
    watch('btnGameReview', 'aria-expanded', 'review');
    watch('btnDeepAnalysis', 'aria-expanded', 'deep');
    paintDesktopView();
  }
  function getSettings() { return { ...preferences }; }
  function update(next) {
    const detail = next && typeof next === 'object' ? next : {};
    activity = { ...activity, ...detail, simRunning: detail.simRunning === undefined ? activity.simRunning : detail.simRunning === true };
    renderActivity();
  }
  function setSettings(patch) {
    preferences = normalize({ ...preferences, ...patch });
    try { root.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch (_) { /* Settings still work for this page. */ }
    renderPreferences();
    document.dispatchEvent(new CustomEvent('chess:lab-settings', { detail: getSettings() }));
    return getSettings();
  }
  function measureTools() {
    if (!elements || elements.dialog.open) return;
    const { content, bottom, controls } = elements;
    // Measure the same controls at the workspace width. This only runs on a
    // layout preference, mode transition or resize, never on each new move.
    const oldStyle = content.style.cssText;
    if (focused) {
      content.style.setProperty('display', 'block', 'important');
      content.style.position = 'absolute';
      content.style.visibility = 'hidden';
      content.style.pointerEvents = 'none';
      content.style.width = `${bottom.clientWidth}px`;
    }
    const height = content.getBoundingClientRect().height;
    content.style.cssText = oldStyle;
    if (height > 0) controls.style.setProperty('--lab-focus-extra', `${Math.max(0, Math.ceil(height) - 44)}px`);
  }
  function renderActivity() {
    if (!elements) return;
    const running = activity.simRunning && activity.kind === 'sim' && !activity.paused;
    // Keep the underlying geometry still while the user is inside Tools, even
    // if a game finishes in the background. Apply the final mode on close.
    const nextFocused = preferences.focusMode === 'auto' && (running || (elements.dialog.open && focused));
    if (nextFocused !== focused) {
      if (nextFocused) measureTools();
      const hidingFocusedControl = nextFocused && elements.content.contains(document.activeElement);
      const leavingFocusedControl = !nextFocused && elements.focusBar.contains(document.activeElement);
      focused = nextFocused;
      elements.controls.classList.toggle('is-sim-focus', focused);
      elements.focusBar.hidden = !focused;
      if (hidingFocusedControl) elements.tools.focus({ preventScroll: true });
      else if (leavingFocusedControl) byId('btnSim')?.focus({ preventScroll: true });
    }
    elements.pause.disabled = !running;
    elements.pause.textContent = running ? 'Pause' : 'Paused';
  }
  function renderPreferences() {
    if (!elements) return;
    for (const [key, id] of Object.entries(fields)) {
      const field = byId(id);
      if (!field) continue;
      if (field.type === 'checkbox') field.checked = preferences[key];
      else field.value = String(preferences[key]);
    }
    const swingInput = byId(fields.pauseSwingCp);
    if (swingInput) swingInput.disabled = !preferences.pauseOnSwing;
    elements.controls.classList.toggle('lab-compact', preferences.compact);
    elements.main.classList.toggle('lab-custom-width', preferences.workspaceWidth !== 0);
    if (preferences.workspaceWidth) elements.main.style.setProperty('--lab-workspace-width', `${preferences.workspaceWidth}px`);
    else elements.main.style.removeProperty('--lab-workspace-width');
    measureTools();
    renderActivity();
  }
  function openTools() {
    if (!elements || elements.dialog.open) return;
    elements.body.appendChild(elements.content);
    elements.tools.setAttribute('aria-expanded', 'true');
    byId('btnWorkspaceMore').setAttribute('aria-expanded', 'true');
    elements.dialog.showModal();
    byId('btnCloseLabTools').focus({ preventScroll: true });
  }
  function restoreTools() {
    if (!elements) return;
    elements.bottom.appendChild(elements.content);
    elements.tools.setAttribute('aria-expanded', 'false');
    byId('btnWorkspaceMore').setAttribute('aria-expanded', 'false');
    renderActivity();
    measureTools();
  }
  function closeTools(options) {
    if (!elements || !elements.dialog.open || closing) return;
    closing = true;
    elements.dialog.close();
    restoreTools();
    if (!options || options.restoreFocus !== false) {
      (focused ? elements.tools : byId('btnWorkspaceMore')).focus({ preventScroll: true });
    }
    closing = false;
  }
  function start() {
  try { preferences = normalize(JSON.parse(root.localStorage.getItem(STORAGE_KEY))); } catch (_) { /* Private browsing can disable storage. */ }
    if (elements || !byId('labToolsDialog')) return;
    elements = { controls: byId('controls'), main: byId('main'), bottom: document.querySelector('.workspace-bottom'),
      content: byId('workspaceToolContent'), focusBar: byId('workspaceFocusBar'), tools: byId('btnLabTools'),
      pause: byId('btnLabPause'), dialog: byId('labToolsDialog'), body: byId('labToolsBody') };
    const primary = byId('workspacePrimaryActions');
    for (const id of ['btnNew', 'btnGames', 'btnSim']) primary.insertBefore(byId(id), byId('btnWorkspaceMore'));
    initDesktopViews();
    byId('btnWorkspaceMore').addEventListener('click', openTools);
    for (const [key, id] of Object.entries(fields)) {
      const field = byId(id);
      if (!field) continue;
      field.addEventListener('change', () => setSettings({ [key]: field.type === 'checkbox' ? field.checked : field.value }));
    }
    byId('btnResetSettings').addEventListener('click', () => {
      try { root.localStorage.removeItem(STORAGE_KEY); } catch (_) { /* Optional persistence. */ }
    }, true);
    elements.tools.addEventListener('click', openTools);
    elements.pause.addEventListener('click', () => {
      if (!elements.pause.disabled) document.dispatchEvent(new CustomEvent('chess:pause-request', { detail: { source: 'focus-toolbar' } }));
    });
    byId('btnCloseLabTools').addEventListener('click', () => closeTools());
    elements.dialog.addEventListener('cancel', event => { event.preventDefault(); closeTools(); });
    elements.dialog.addEventListener('close', () => {
      if (elements.content.parentElement !== elements.bottom) restoreTools();
    });
    elements.dialog.addEventListener('click', event => {
      if (event.target !== elements.dialog) return;
      const bounds = elements.dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeTools();
    });
    // Put the original controls back before their existing action runs. No
    // duplicated IDs, cloned handlers or invisible modal blocking the next one.
    elements.body.addEventListener('click', event => {
      const action = event.target.closest('button,a[href]');
      if (!action || action.id === 'btnFormat') return;
      closeTools({ restoreFocus: false });
      root.requestAnimationFrame(() => {
        if (document.querySelector('dialog[open], [aria-modal="true"]:not([style*="display:none"]):not([style*="display: none"])')) return;
        const openPanel = document.querySelector('.workspace-drawer.open');
        if (openPanel) openPanel.querySelector('button, input, select')?.focus({ preventScroll: true });
        else if (!document.activeElement || !document.activeElement.getClientRects().length) byId('workspaceDisplay').focus({ preventScroll: true });
      });
    }, true);
    document.addEventListener('keydown', event => {
      if (!elements.dialog.open) return;
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) event.stopPropagation();
    }, true);
    // Existing settings/library panels stay reachable when their original
    // buttons live in the collapsed toolbar. Return focus to visible Tools.
    for (const id of ['btnCloseSettings', 'btnCloseGames']) {
      byId(id)?.addEventListener('click', () => { if (focused) elements.tools.focus({ preventScroll: true }); });
    }
    for (const id of ['settingsPanel', 'popularGamesPanel']) {
      byId(id)?.addEventListener('keydown', event => {
        if (event.key === 'Escape' && focused) elements.tools.focus({ preventScroll: true });
      });
    }
    root.addEventListener('resize', () => {
      root.cancelAnimationFrame(resizeFrame);
      resizeFrame = root.requestAnimationFrame(measureTools);
    });
    renderPreferences();
  }
  document.addEventListener('chess:activity', event => update(event.detail));
  root.ChessLabLayout = Object.freeze({ update, getSettings, setSettings, openTools, closeTools });
  const startWhenReady = () => Promise.resolve(root.ChessLabReady || root.ChessLabStorage?.ready).then(start).catch(() => root.ChessLabStorage?.showFailure());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startWhenReady, { once: true });
  else startWhenReady();
})(window);
