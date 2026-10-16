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

  function initSettingsWorkspace() {
    const panel = byId('settingsPanel');
    if (!panel || !root.MutationObserver) return;
    let saved = null;
    const sync = () => {
      const open = panel.classList.contains('open');
      if (open === !!saved) return;
      if (open) {
        const scrollOwners = [byId('workspaceDisplay'), byId('popularGamesPanel'),
          document.querySelector('.library-result-list'), byId('gameReviewPanel')].filter(Boolean);
        const background = [...elements.controls.children].filter(node => node !== panel);
        for (const id of ['appTabs', 'geminiPanel']) if (byId(id)) background.push(byId(id));
        saved = {
          view: document.body.dataset.appView || document.body.dataset.desktopView,
          scroll: scrollOwners.map(node => [node, node.scrollTop, node.scrollLeft]),
          inert: background.map(node => [node, node.getAttribute('inert')])
        };
        for (const [node] of saved.inert) node.setAttribute('inert', '');
        document.body.classList.add('workspace-settings-open');
      } else {
        const previous = saved;
        saved = null;
        document.body.classList.remove('workspace-settings-open');
        for (const [node, inert] of previous.inert) {
          if (inert === null) node.removeAttribute('inert'); else node.setAttribute('inert', inert);
        }
        const restore = () => {
          if (saved) return;
          if (previous.view === (document.body.dataset.appView || document.body.dataset.desktopView)) {
            for (const [node, top, left] of previous.scroll) { node.scrollTop = top; node.scrollLeft = left; }
          }
          const active = document.activeElement;
          if (active === document.body || panel.contains(active) || !active?.getClientRects().length) {
            const trigger = byId(document.body.classList.contains('app-mobile') ? 'appMore' : 'btnSettings');
            const target = trigger?.getClientRects().length ? trigger : elements.tools;
            target?.focus({ preventScroll: true });
          }
        };
        restore();
        root.requestAnimationFrame?.(restore);
      }
    };
    // Observe the existing lifecycle, including X, Escape, toggle and view exits.
    // Inert is temporary: do not enable controls that were already disabled/hidden.
    new MutationObserver(sync).observe(panel, { attributes: true, attributeFilter: ['class'] });
    panel.addEventListener('keydown', event => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) event.stopPropagation();
    });
    sync();
  }

  function initCustomModalIsolation() {
    // Existing ARIA overlays keep their own rendering/close handlers. Native
    // <dialog>s already own the browser top layer and need no replacement.
    const modals = [];
    let active = null, priorFocus = null, lastExternal = null, blocked = [];
    const nativeModal = () => document.querySelector('dialog[open]');
    const focusable = () => [...active.querySelectorAll('button, input, select, textarea, a[href], [tabindex]')]
      .filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
    const focusFirst = () => (focusable()[0] || active).focus({ preventScroll: true });
    const sync = () => {
      const next = modals.filter(node => node.isConnected && !node.closest('[hidden]') && getComputedStyle(node).display !== 'none').at(-1) || null;
      if (next === active) return;
      const origin = priorFocus;
      for (const [node, inert] of blocked) {
        if (inert === null) node.removeAttribute('inert'); else node.setAttribute('inert', inert);
      }
      blocked = []; active = next;
      if (!active) {
        const useful = origin?.isConnected && origin.getClientRects().length && !origin.closest('[inert]') && getComputedStyle(origin).visibility !== 'hidden';
        (useful ? origin : byId(document.body.classList.contains('app-mobile') ? 'appMore' : 'btnWorkspaceMore'))?.focus({ preventScroll: true });
        return;
      }
      priorFocus = active.contains(document.activeElement) ? lastExternal : document.activeElement;
      active.tabIndex = -1;
      // APP preview nests the same controls in a frame. Isolate siblings along
      // that path instead of making the frame (and the dialog) inert together.
      for (let branch = active; branch && branch !== document.body; branch = branch.parentElement) {
        for (const sibling of branch.parentElement.children) {
          if (sibling === branch || sibling.tagName === 'DIALOG' || sibling.tagName === 'SCRIPT') continue;
          blocked.push([sibling, sibling.getAttribute('inert')]); sibling.setAttribute('inert', '');
        }
      }
      if (!active.contains(document.activeElement)) focusFirst();
    };
    const observer = new MutationObserver(sync);
    const register = node => {
      if (!node.matches?.('[aria-modal="true"]:not(dialog)') || modals.includes(node)) return;
      modals.push(node);
      observer.observe(node, { attributes: true, attributeFilter: ['style', 'hidden'] });
      if (node.parentElement !== document.body) observer.observe(node.parentElement, { attributes: true, attributeFilter: ['style', 'hidden'] });
    };
    document.querySelectorAll('[aria-modal="true"]:not(dialog)').forEach(register);
    // Study capacity/recovery overlays can be created lazily at the body root.
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        register(node); node.querySelectorAll?.('[aria-modal="true"]:not(dialog)').forEach(register);
      }
      sync();
    }).observe(document.body, { childList: true });
    document.addEventListener('focusin', event => {
      if (active && !nativeModal() && !active.contains(event.target)) focusFirst();
      else if (!active && !modals.some(node => node.contains(event.target))) lastExternal = event.target;
    }, true);
    document.addEventListener('keydown', event => {
      if (!active || nativeModal() || event.defaultPrevented) return;
      if (event.key === 'Escape' && ['simModal', 'replayModal'].includes(active.id)) {
        event.preventDefault(); event.stopImmediatePropagation();
        byId(active.id === 'simModal' ? 'simCancelBtn' : 'replayCancel')?.click();
      } else if (event.key === 'Tab') {
        const targets = focusable(), index = targets.indexOf(document.activeElement);
        if (!targets.length || index < 0 || (event.shiftKey ? index === 0 : index === targets.length - 1)) {
          event.preventDefault(); (event.shiftKey ? targets.at(-1) : targets[0])?.focus({ preventScroll: true });
        }
      }
    }, true);
    sync();
  }

  function backingState() {
    return {
      dcc: byId('btnViewToggle')?.getAttribute('aria-pressed') === 'true',
      review: byId('btnGameReview')?.getAttribute('aria-expanded') === 'true',
      deep: byId('btnDeepAnalysis')?.getAttribute('aria-expanded') === 'true'
    };
  }
  function positionGemini() {
    const panel = byId('geminiPanel');
    if (!elements || !panel || panel.hidden || document.body.classList.contains('app-mobile')) return;
    const dock = elements.bottom.getBoundingClientRect();
    const above = Math.max(0, dock.top - 24), below = Math.max(0, root.innerHeight - dock.bottom - 24);
    const useAbove = above >= below;
    panel.style.bottom = `${useAbove ? Math.max(12, root.innerHeight - dock.top + 12) : 12}px`;
    panel.style.height = `${Math.max(120, Math.min(650, useAbove ? above : below))}px`;
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
    positionGemini();
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
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
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
    positionGemini();
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
      (document.body.classList.contains('app-mobile') ? byId('appMore') : focused ? elements.tools : byId('btnWorkspaceMore')).focus({ preventScroll: true });
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
    for (const id of ['btnNew', 'btnGames']) primary.insertBefore(byId(id), byId('btnWorkspaceMore'));
    // Reuse the existing Settings action on desktop; phones keep it in More.
    const settingsAction = byId('btnSettings');
    if (settingsAction && !document.body.classList.contains('app-mobile')) {
      primary.insertBefore(settingsAction, byId('btnWorkspaceMore'));
    }
    initDesktopViews();
    initSettingsWorkspace();
    initCustomModalIsolation();
    if (byId('geminiPanel') && root.MutationObserver) new MutationObserver(positionGemini)
      .observe(byId('geminiPanel'), { attributes: true, attributeFilter: ['hidden'] });
    root.addEventListener('scroll', positionGemini, { passive: true });
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
        if (document.querySelector('dialog[open]')) return;
        const modal = [...document.querySelectorAll('[aria-modal="true"]:not(dialog)')].some(node =>
          !node.closest('[hidden]') && getComputedStyle(node).display !== 'none' && node.getClientRects().length);
        if (modal) return;
        const openPanel = document.querySelector('.workspace-drawer.open');
        const active = document.activeElement;
        const launcher = ['appMore', 'btnWorkspaceMore', 'btnLabTools', 'btnCloseLabTools'].includes(active?.id);
        if (openPanel && (launcher || active === document.body || !active?.getClientRects().length)) {
          const target = openPanel.id === 'settingsPanel' ? byId('btnCloseSettings') :
            [...openPanel.querySelectorAll('button, input, select')].find(node => !node.disabled && !node.closest('[hidden], [inert]'));
          if (!target?.disabled) target?.focus({ preventScroll: true });
        }
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
