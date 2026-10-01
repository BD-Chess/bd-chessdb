/* Analysis-lab presentation only. Chess state and cancellation belong to utils. */
(function (root) {
  'use strict';
  const STORAGE_KEY = '8zc-lab-layout-v1';
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
  try { preferences = normalize(JSON.parse(root.localStorage.getItem(STORAGE_KEY))); } catch (_) { /* Private browsing can disable storage. */ }
  let activity = { simRunning: false, kind: 'analysis', paused: false };
  let elements = null;
  let focused = false;
  let closing = false;
  let resizeFrame = 0;
  const byId = id => document.getElementById(id);
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
    if (elements || !byId('labToolsDialog')) return;
    elements = { controls: byId('controls'), main: byId('main'), bottom: document.querySelector('.workspace-bottom'),
      content: byId('workspaceToolContent'), focusBar: byId('workspaceFocusBar'), tools: byId('btnLabTools'),
      pause: byId('btnLabPause'), dialog: byId('labToolsDialog'), body: byId('labToolsBody') };
    const primary = byId('workspacePrimaryActions');
    for (const id of ['btnNew', 'btnGames', 'btnDeepAnalysis']) primary.insertBefore(byId(id), byId('btnWorkspaceMore'));
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
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(window);
