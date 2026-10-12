/* Shared, idle-safe controls for the board source and the Deep analysis session. */
(function (root) {
  'use strict';
  const choices = ['cdb', 'sf-lite', 'sf-full', 'reckless', 'lc0', 'berserk'];
  const labels = { cdb: 'ChessDB', 'sf-lite': 'SF Lite', 'sf-full': 'SF Full', reckless:'Reckless',lc0:'LCZero',berserk: 'Berserk', 'sf-berserk': 'SF & Berserk' };
  const session = root.ChessAnalysisSession;
  const topMode = document.getElementById('analysisSource');
  const topThreads = document.getElementById('analysisCpuThreads');
  let deepPanel = null;
  let networkLoadError = '';
  const requested = () => session?.getSettings?.() || { analysisMode: 'cdb', sfFullThreadsRequested: 1 };
  const normalizeMode = mode => mode === 'sf' ? 'sf-lite' : mode === 'auto' ? 'cdb' : choices.includes(mode) ? mode : 'cdb';
  const normalizeThreads = value => value === 'auto' ? 'auto' : [1, 2, 4, 6, 8].includes(Number(value)) ? Number(value) : 1;
  const modeControl = () => deepPanel?.querySelector('[data-deep="mode"]');
  const threadControl = () => deepPanel?.querySelector('[data-deep="threads"]');

  function allocationText(mode, caps) {
    if (mode === 'cdb') return 'ChessDB · online position data';
    if (mode === 'sf-lite') return 'SF Lite · 1 thread';
    if (mode === 'berserk') return 'Berserk · 1 thread';
    if (mode === 'reckless' || mode === 'lc0') return labels[mode]+' · not implemented yet';
    const sf = Number(caps.effectiveSFThreads) || 1;
    if (mode === 'sf-berserk') return `SF Full · ${sf} + Berserk · 1 = ${Number(caps.totalThreads) || sf + 1} search threads`;
    return `SF Full · ${sf} search thread${sf === 1 ? '' : 's'}`;
  }
  function reflect(settings) {
    settings = settings || requested();
    const mode = normalizeMode(settings.boardSource);
    const deepMode = settings.analysisMode || 'cdb';
    const caps = session?.capabilities?.(mode) || {};
    const deepCaps = session?.capabilities?.(deepMode) || {};
    const value = String(normalizeThreads(settings.sfFullThreadsRequested));
    const locked = mode !== 'sf-full' && mode !== 'sf-berserk';
    if (topMode) topMode.value = mode;
    if (modeControl()) modeControl().value = deepMode;
    for (const select of [topThreads, threadControl()]) if (select) {
      select.value = value;
      select.disabled = select===topThreads ? false : deepMode!=='sf-full'&&deepMode!=='sf-berserk';
      select.title = locked ? 'Only SF Full has configurable search threads.' :
        'Requested Stockfish Full search threads; the browser may limit the effective count.';
    }
    const text = allocationText(mode, caps);
    const note = caps.message ? ' · ' + caps.message : '';
    const topStatus = document.getElementById('analysisCpuStatus');
    if (topStatus) {
      topStatus.textContent = mode === 'sf-berserk' ?
        `SF ${Number(caps.effectiveSFThreads) || 1} + Berserk 1 · ${Number(caps.totalThreads) || (Number(caps.effectiveSFThreads) || 1) + 1} threads` :
        mode === 'cdb' ? 'ChessDB · selected source' : text;
      topStatus.title = text + note;
    }
    const deepStatus = deepPanel?.querySelector('[data-deep="allocation"]');
    if (deepStatus) deepStatus.textContent = allocationText(deepMode, deepCaps) + (deepCaps.message?' · '+deepCaps.message:'');
    const networkText = networkLoadError || (settings.berserkNetworkState === 'downloading' ? 'Downloading NNUE…' :
      settings.berserkNetworkState === 'checking' ? 'Checking cached NNUE…' :
      settings.berserkNetworkState === 'error' ? 'Error: ' + (settings.berserkNetworkError || 'NNUE unavailable') :
      settings.berserkNetworkReady ? 'Ready · NNUE verified' : 'Ready · original NNUE loads automatically on Start');
    for (const status of document.querySelectorAll('[data-berserk-status]')) {
      status.hidden = !status.closest('.analysis-network-control') && mode !== 'berserk' && deepMode !== 'berserk' && deepMode !== 'sf-berserk' && settings.berserkNetworkState!=='downloading' && settings.berserkNetworkState!=='error';
      if(!status.dataset.busy)status.textContent=networkText;
    }
    for(const control of document.querySelectorAll('.analysis-network-control')) {
      const input=control.querySelector('[data-berserk-network]');
      if(input&&!input.dataset.bound){input.dataset.bound='1';input.addEventListener('change',loadNetwork);}
      const remove=control.querySelector('[data-berserk-remove]');
      if(remove){remove.hidden=!settings.berserkNetworkReady;remove.disabled=settings.berserkNetworkState==='removing';
        if(!remove.dataset.bound){remove.dataset.bound='1';remove.addEventListener('click',removeNetwork);}}
    }
    const budget = deepPanel?.querySelector('[data-deep="budget"]');
    if (budget) {
      budget.disabled = deepMode === 'sf-berserk' || deepMode === 'cdb';
      budget.closest('label').hidden=deepMode==='cdb';
      budget.hidden = deepMode === 'sf-berserk';
      budget.title = deepMode === 'sf-berserk' ? 'Dual analysis uses equal timed searches instead of a depth target.' : '';
    }
    const lineCount=deepPanel?.querySelector('[data-deep="multipv"]');
    if(lineCount)lineCount.closest('label').hidden=deepMode==='cdb';
    const rootMoves=deepPanel?.querySelector('.deep-root-moves');if(rootMoves)rootMoves.hidden=deepMode==='cdb';
    const start=deepPanel?.querySelector('[data-deep="start"]');if(start)start.textContent=deepMode==='cdb'?'Refresh CDB':'Analyze position';
    const dualTime = deepPanel?.querySelector('[data-deep="dual-time"]');
    if (dualTime) {
      dualTime.hidden = deepMode !== 'sf-berserk';
      if (deepMode === 'sf-berserk') dualTime.textContent = `${deepCaps.mobile ? 3 : 6} s each`;
    }
    const budgetLabel = deepPanel?.querySelector('[data-deep="budget-label"]');
    if (budgetLabel) budgetLabel.textContent = deepMode === 'sf-berserk' ? 'Shared search time' : 'Search depth';
    const budgetNote = deepPanel?.querySelector('[data-deep="budget-note"]');
    if (budgetNote) {
      budgetNote.hidden = deepMode !== 'sf-berserk';
      if (deepMode === 'sf-berserk') budgetNote.textContent = `SF Full and Berserk each receive up to ${deepCaps.mobile ? 3 : 6} seconds of search time on this device. Their depths can differ.`;
    }
    const dcc = document.getElementById('analysisDccModeNote');
    if (dcc) dcc.hidden = true;
    const deepDcc = deepPanel?.querySelector('[data-deep="dcc-note"]');
    if (deepDcc) deepDcc.hidden = true;
    const intro = deepPanel?.querySelector('[data-deep="engine-intro"]');
    if (intro) intro.textContent = deepMode === 'cdb' ? 'ChessDB position data · refresh the selected position.' : `${labels[deepMode]} · runs on this device`;
    const hostNote=document.getElementById('analysisHostNote');
    if(hostNote){hostNote.hidden=!(mode==='sf-full'||mode==='sf-berserk')||caps.isolated;hostNote.textContent=caps.message||'';}
    const action = document.getElementById('btnAnalysisDeepen');
    if (action) {
      action.textContent = 'Deeper search';
      if (!action.disabled) {
        action.title = `Analyze with ${labels[mode]}`;
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
    session?.configure?.(event.target===topMode ? {boardSource:next} : {analysisMode:event.target.value});
    reflect();
    // The analysis panel does not change the board source.
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
  const helpButton=document.getElementById('btnDccScoreHelp'),helpDialog=document.getElementById('dccScoreHelp');
  helpButton?.addEventListener('click',()=>helpDialog?.showModal());
  helpDialog?.querySelector('[data-close-dcc-help]')?.addEventListener('click',()=>helpDialog.close());
  reflect();
  root.ChessAnalysisControls = { registerDeep, refresh: reflect, labels, destroy() {
    unsubscribe?.(); topMode?.removeEventListener('change', changeMode);
    topThreads?.removeEventListener('change', changeThreads);
  } };
})(window);
