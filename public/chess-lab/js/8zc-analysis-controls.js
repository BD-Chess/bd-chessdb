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
  const requested = () => session?.getSettings?.() || { boardSource:'cdb', analysisMode:'sf-lite', sfCardMode:'sf-lite', sfFullThreadsRequested:1 };
  const normalizeMode = mode => mode === 'sf' ? 'sf-lite' : mode === 'auto' ? 'cdb' : choices.includes(mode) ? mode : 'cdb';
  const normalizeThreads = value => Number.isInteger(Number(value)) && Number(value)>=1 && Number(value)<=8 ? Number(value) : 1;
  const isSF = mode => mode === 'sf-lite' || mode === 'sf-full';
  const sfToggle = document.getElementById('analysisSFFull');
  const sfSetting = document.getElementById('settingSFEngine');
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
  function reflectThreads(select, mode, settings, caps) {
    if (!select) return;
    const unavailable = ['cdb','reckless','lc0'].includes(mode);
    const max = unavailable ? 0 : mode==='sf-full'||mode==='sf-berserk' ? Number(caps.maxSFThreads)||1 : 1;
    const signature = String(max);
    if (select.dataset.cpuOptions !== signature) {
      select.replaceChildren();
      for (let n=unavailable?0:1; n<=max; n++) {
        const option=document.createElement('option');option.value=n?String(n):'none';
        option.textContent=n?'CPU '+n:'CPU —';select.appendChild(option);
      }
      select.dataset.cpuOptions=signature;
    }
    select.value = unavailable ? 'none' : String(Math.min(max,normalizeThreads(settings.sfFullThreadsRequested)));
    select.disabled = max<=1;
    select.title = mode==='cdb' ? 'CDB has no configurable local search threads. Your local CPU setting is retained.' :
      unavailable ? 'This engine is not implemented yet.' : max===1 ?
      (mode==='sf-full'||mode==='sf-berserk' ? caps.message || 'This browser supports one search thread.' : 'This engine supports one search thread.') :
      'Local search threads supported by this engine and browser.';
  }
  function reflect(settings) {
    settings = settings || requested();
    const mode = normalizeMode(settings.boardSource);
    const deepMode = settings.analysisMode || 'sf-lite';
    const caps = session?.capabilities?.(mode) || {};
    const deepCaps = session?.capabilities?.(deepMode) || {};
    if (topMode) topMode.value = mode;
    const cdbOption=topMode?.querySelector('option[value="cdb"]');
    if(cdbOption)cdbOption.textContent=document.body.classList.contains('app-mobile')?'CDB':'ChessDB.cn';
    if (modeControl()) modeControl().value = deepMode;
    reflectThreads(topThreads,mode,settings,caps);
    reflectThreads(threadControl(),deepMode,settings,deepCaps);
    if(sfToggle)sfToggle.checked=settings.sfCardMode==='sf-full';
    if(sfSetting)sfSetting.value=settings.sfCardMode==='sf-full'?'sf-full':'sf-lite';
    const text = allocationText(mode, caps);
    const note = caps.message ? ' · ' + caps.message : '';
    const topStatus = document.getElementById('analysisCpuStatus');
    if (topStatus) {
      topStatus.hidden=true;topStatus.textContent='';
      topStatus.title = text + note;
    }
    const deepStatus = deepPanel?.querySelector('[data-deep="allocation"]');
    if (deepStatus) deepStatus.textContent = allocationText(deepMode, deepCaps) + (deepCaps.message?' · '+deepCaps.message:'');
    const networkText = networkLoadError || (settings.berserkNetworkState === 'downloading' ? 'Downloading NNUE…' :
      settings.berserkNetworkState === 'checking' ? 'Checking cached NNUE…' :
      settings.berserkNetworkState === 'error' ? 'Error: ' + (settings.berserkNetworkError || 'NNUE unavailable') :
      settings.berserkNetworkReady ? 'Ready' : 'Ready');
    for (const status of document.querySelectorAll('[data-berserk-status]')) {
      const contextMode=status.closest('.deep-panel')?deepMode:mode;
      status.hidden = !status.closest('.analysis-network-control') && contextMode!=='berserk' && contextMode!=='sf-berserk' && settings.berserkNetworkState!=='downloading' && settings.berserkNetworkState!=='error';
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
      budget.disabled = deepMode === 'sf-berserk';
      budget.closest('label').hidden=false;
      budget.hidden = deepMode === 'sf-berserk';
      budget.title = deepMode === 'sf-berserk' ? 'Dual analysis uses equal timed searches instead of a depth target.' : '';
    }
    const lineCount=deepPanel?.querySelector('[data-deep="multipv"]');
    if(lineCount)lineCount.closest('label').hidden=false;
    const rootMoves=deepPanel?.querySelector('.deep-root-moves');if(rootMoves)rootMoves.hidden=false;
    const start=deepPanel?.querySelector('[data-deep="start"]');if(start)start.textContent='Analyze position';
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
    if (intro) intro.textContent = `${labels[deepMode]} · runs on this device`;
    const hostNote=document.getElementById('analysisHostNote');
    if(hostNote){hostNote.hidden=true;hostNote.textContent='';hostNote.title=caps.message||'';}
    const action = document.getElementById('btnAnalysisDeepen');
    if (action) {
      action.textContent = mode==='cdb'?'Refresh evals':'Deeper search';
      if (!action.disabled) {
        action.title = mode==='cdb'?'Refresh ChessDB evaluations for the current position':`Analyze with ${labels[mode]}`;
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
  function notifyBoard(passive=false) {
    if (!topMode) return;
    const event = new Event('change', { bubbles: true });
    event.chessAnalysisHandled = true;
    event.chessAnalysisPassive = passive;
    topMode.dispatchEvent(event);
  }
  function changeMode(event) {
    if (event.chessAnalysisHandled) return;
    const next = normalizeMode(event.target.value);
    const old=requested(),top=event.target===topMode;
    const patch=top?{boardSource:next}:{analysisMode:event.target.value};
    if(isSF(next)) {
      patch.sfCardMode=next;
      if(top&&isSF(old.analysisMode))patch.analysisMode=next;
    } else if(!top&&event.target.value==='sf-berserk')patch.sfCardMode='sf-full';
    if(top) {event.chessAnalysisHandled=true;event.chessAnalysisPassive=isSF(old.boardSource)&&isSF(next);}
    session?.configure?.(patch);
    reflect();
    // The analysis panel does not change the board source.
  }
  function changeThreads(event) {
    if(event.target.value==='none')return;
    session?.configure?.({ sfFullThreadsRequested: normalizeThreads(event.target.value) });
    reflect();
  }
  function setSFVariant(mode) {
    mode=mode==='sf-full'?'sf-full':'sf-lite';
    const old=requested(),patch={sfCardMode:mode};
    if(isSF(old.analysisMode))patch.analysisMode=mode;
    if(isSF(old.boardSource))patch.boardSource=mode;
    session?.configure?.(patch);reflect();
    if(patch.boardSource&&patch.boardSource!==old.boardSource)notifyBoard(true);
  }
  function changeSFVariant(event){setSFVariant(event.target===sfToggle?(sfToggle.checked?'sf-full':'sf-lite'):event.target.value);}
  topMode?.addEventListener('change', changeMode);
  topThreads?.addEventListener('change', changeThreads);
  sfToggle?.addEventListener('change',changeSFVariant);
  sfSetting?.addEventListener('change',changeSFVariant);
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
  root.ChessAnalysisControls = { registerDeep, refresh: reflect, setSFVariant, labels, destroy() {
    unsubscribe?.(); topMode?.removeEventListener('change', changeMode);
    topThreads?.removeEventListener('change', changeThreads);
    sfToggle?.removeEventListener('change',changeSFVariant);sfSetting?.removeEventListener('change',changeSFVariant);
  } };
})(window);
