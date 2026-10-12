/* Shared, idle-safe controls for the board source and the Deep analysis session. */
(function (root) {
  'use strict';
  const choices = ['auto', 'sf-lite', 'sf-full', 'berserk', 'sf-berserk'];
  const labels = { auto: 'CDB | SF Lite', 'sf-lite': 'SF Lite', 'sf-full': 'SF Full', berserk: 'Berserk', 'sf-berserk': 'SF & Berserk' };
  const session = root.ChessAnalysisSession;
  const topMode = document.getElementById('analysisSource');
  const topThreads = document.getElementById('analysisCpuThreads');
  let deepPanel = null;
  let networkLoadError = '';
  const requested = () => session?.getSettings?.() || { analysisMode: 'auto', sfFullThreadsRequested: 'auto' };
  const normalizeMode = mode => mode === 'sf' ? 'sf-lite' : choices.includes(mode) ? mode : 'auto';
  const normalizeThreads = value => value === 'auto' ? 'auto' : [1, 2, 4, 6, 8].includes(Number(value)) ? Number(value) : 'auto';
  const modeControl = () => deepPanel?.querySelector('[data-deep="mode"]');
  const threadControl = () => deepPanel?.querySelector('[data-deep="threads"]');

  function allocationText(mode, caps) {
    if (mode === 'auto') return 'Deep: SF Lite · 1 thread; board: CDB first';
    if (mode === 'sf-lite') return 'SF Lite · 1 thread';
    if (mode === 'berserk') return 'Berserk · 1 thread';
    const sf = Number(caps.effectiveSFThreads) || 1;
    if (mode === 'sf-berserk') return `SF Full · ${sf} + Berserk · 1 = ${Number(caps.totalThreads) || sf + 1} search threads`;
    return `SF Full · ${sf} search thread${sf === 1 ? '' : 's'}`;
  }
  function reflect(settings) {
    settings = settings || requested();
    const mode = normalizeMode(settings.analysisMode);
    const caps = session?.capabilities?.() || {};
    const value = String(normalizeThreads(settings.sfFullThreadsRequested));
    const locked = mode !== 'sf-full' && mode !== 'sf-berserk';
    if (topMode) topMode.value = mode;
    if (modeControl()) modeControl().value = mode;
    for (const select of [topThreads, threadControl()]) if (select) {
      select.value = value;
      select.disabled = locked;
      select.title = locked ? 'Only SF Full has configurable search threads.' :
        'Requested Stockfish Full search threads; the browser may limit the effective count.';
    }
    const text = allocationText(mode, caps);
    const note = caps.message ? ' · ' + caps.message : '';
    const topStatus = document.getElementById('analysisCpuStatus');
    if (topStatus) {
      topStatus.textContent = mode === 'sf-berserk' ?
        `SF ${Number(caps.effectiveSFThreads) || 1} + Berserk 1 · ${Number(caps.totalThreads) || (Number(caps.effectiveSFThreads) || 1) + 1} threads` :
        mode === 'auto' ? 'CDB first · Deep SF Lite 1' : text;
      topStatus.title = text + note;
    }
    const deepStatus = deepPanel?.querySelector('[data-deep="allocation"]');
    if (deepStatus) deepStatus.textContent = text + note;
    for (const control of document.querySelectorAll('.analysis-network-control')) {
      control.hidden = mode !== 'berserk' && mode !== 'sf-berserk';
      const status = control.querySelector('[data-berserk-status]');
      if (status && !status.dataset.busy) status.textContent = networkLoadError ||
        (settings.berserkNetworkState === 'checking' ? 'Checking the NNUE saved in this browser…' :
        settings.berserkNetworkState === 'removing' ? 'Removing the saved NNUE…' :
        settings.berserkNetworkReady ? settings.berserkNetworkPersistent ? 'NNUE ready · saved in this browser for future visits. Press Start to analyze.' :
          'NNUE ready for this visit. Browser storage is unavailable; choose the file again next visit.' :
        'Choose berserk-9b84c340af7e.nn once (24 MB), then press Start. The file stays on this device.') +
        (settings.berserkNetworkError && settings.berserkNetworkState === 'error' ? ' ' + settings.berserkNetworkError : '');
      const input=control.querySelector('[data-berserk-network]');
      if (input && !input.dataset.bound) { input.dataset.bound='1';input.addEventListener('change',loadNetwork); }
      const remove=control.querySelector('[data-berserk-remove]');
      if(remove){remove.hidden=!settings.berserkNetworkReady&&settings.berserkNetworkState!=='error';
        remove.disabled=settings.berserkNetworkState==='removing';
        if(!remove.dataset.bound){remove.dataset.bound='1';remove.addEventListener('click',removeNetwork);}}
    }
    const budget = deepPanel?.querySelector('[data-deep="budget"]');
    if (budget) {
      budget.disabled = mode === 'sf-berserk';
      budget.hidden = mode === 'sf-berserk';
      budget.title = mode === 'sf-berserk' ? 'Dual analysis uses equal timed searches instead of a depth target.' : '';
    }
    const dualTime = deepPanel?.querySelector('[data-deep="dual-time"]');
    if (dualTime) {
      dualTime.hidden = mode !== 'sf-berserk';
      if (mode === 'sf-berserk') dualTime.textContent = `${caps.mobile ? 3 : 6} s each`;
    }
    const budgetLabel = deepPanel?.querySelector('[data-deep="budget-label"]');
    if (budgetLabel) budgetLabel.textContent = mode === 'sf-berserk' ? 'Shared search time' : 'Search depth';
    const budgetNote = deepPanel?.querySelector('[data-deep="budget-note"]');
    if (budgetNote) {
      budgetNote.hidden = mode !== 'sf-berserk';
      if (mode === 'sf-berserk') budgetNote.textContent = `SF Full and Berserk each receive up to ${caps.mobile ? 3 : 6} seconds of search time on this device. Their depths can differ.`;
    }
    const dcc = document.getElementById('analysisDccModeNote');
    if (dcc) dcc.hidden = mode === 'auto' || mode === 'sf-lite';
    const deepDcc = deepPanel?.querySelector('[data-deep="dcc-note"]');
    if (deepDcc) deepDcc.hidden = mode === 'auto' || mode === 'sf-lite';
    const intro = deepPanel?.querySelector('[data-deep="engine-intro"]');
    if (intro) intro.textContent = mode === 'auto' ? 'CDB | SF Lite uses SF Lite for a Deep local search.' : `${labels[mode]} · runs on this device`;
    const hostNote=document.getElementById('analysisHostNote');
    if(hostNote){hostNote.hidden=!(mode==='sf-full'||mode==='sf-berserk')||caps.isolated;hostNote.textContent=caps.message||'';}
    const action = document.getElementById('btnAnalysisDeepen');
    if (action) {
      action.textContent = mode === 'sf-berserk' ? 'Deep · SF & Berserk' :
        mode === 'berserk' ? 'Deeper Berserk' : mode === 'sf-full' ? 'Deeper SF Full' : 'Deeper SF Lite';
      if (!action.disabled) {
        action.title = `Analyze with ${mode === 'auto' ? 'SF Lite (CDB-first board)' : labels[mode]}`;
        action.setAttribute('aria-label', action.textContent);
      }
    }
    if((mode==='berserk'||mode==='sf-berserk')&&settings.berserkNetworkState==='unchecked')session.restoreBerserkNetwork?.();
  }
  async function loadNetwork(event) {
    if(!event.target.files?.[0])return;
    const status=event.target.closest('.analysis-network-control').querySelector('[data-berserk-status]');
    networkLoadError='';
    status.dataset.busy='1';status.textContent='Verifying local NNUE…';
    try { await session.loadBerserkNetwork(event.target.files?.[0]); delete status.dataset.busy; reflect(); notifyBoard(); }
    catch(error) { networkLoadError=error.message;delete status.dataset.busy;reflect(); }
    finally{event.target.value='';}
  }
  async function removeNetwork() {
    networkLoadError='';await session.clearBerserkNetwork();
    for(const input of document.querySelectorAll('[data-berserk-network]'))input.value='';
    reflect();notifyBoard();
  }
  function notifyBoard() {
    if (!topMode) return;
    const event = new Event('change', { bubbles: true });
    event.chessAnalysisHandled = true;
    topMode.dispatchEvent(event);
  }
  function changeMode(event) {
    if (event.chessAnalysisHandled) return;
    const next = normalizeMode(event.target.value);
    session?.configure?.({ analysisMode: next });
    reflect();
    if (event.target !== topMode) notifyBoard();
  }
  function changeThreads(event) {
    session?.configure?.({ sfFullThreadsRequested: normalizeThreads(event.target.value) });
    reflect();
    notifyBoard();
  }
  topMode?.addEventListener('change', changeMode);
  topThreads?.addEventListener('change', changeThreads);
  const unsubscribe = session?.subscribeSettings?.(reflect);
  function registerDeep(panel) {
    deepPanel = panel;
    modeControl()?.addEventListener('change', changeMode);
    threadControl()?.addEventListener('change', changeThreads);
    reflect();
    return () => {
      modeControl()?.removeEventListener('change', changeMode);
      threadControl()?.removeEventListener('change', changeThreads);
      if (deepPanel === panel) deepPanel = null;
    };
  }
  reflect();
  root.ChessAnalysisControls = { registerDeep, refresh: reflect, labels, destroy() {
    unsubscribe?.(); topMode?.removeEventListener('change', changeMode);
    topThreads?.removeEventListener('change', changeThreads);
  } };
})(window);
