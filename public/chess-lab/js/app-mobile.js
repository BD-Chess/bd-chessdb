/* Unified LAB mobile/native view controller. Desktop keeps the normal LAB layout;
 * phone browsers and Capacitor native builds use one focused view at a time. */
(function (root) {
  'use strict';
  const doc = root.document;
  const ua = root.navigator?.userAgent || '';
  const tablet = /iPad|Tablet|PlayBook|Silk/i.test(ua);
  const phone = !tablet && (root.navigator?.userAgentData?.mobile === true || /iPhone|iPod|Windows Phone|Android.+Mobile/i.test(ua));
  const native = !!root.Capacitor?.isNativePlatform?.();
  const requestedView = new URLSearchParams(root.location.search).get('view')?.toLowerCase() || '';
  const appMode = requestedView === 'app';
  const desktopPreview = appMode && !native && !phone;
  if (!native && !phone && !appMode) return;
  doc.body.classList.add('app-mobile');
  if (desktopPreview) doc.body.classList.add('app-preview-desktop');
  doc.body.dataset.appRuntime = native ? 'native' : phone ? 'phone' : 'preview';
  doc.body.dataset.appPresentation = appMode ? 'app' : 'mobile';
  const byId = id => doc.getElementById(id);

  if (desktopPreview) {
    const stage=doc.createElement('div');stage.className='app-preview-stage';
    stage.innerHTML='<div class="app-preview-device"><div class="app-preview-screen"><div class="app-preview-island" aria-hidden="true"></div><div class="app-preview-content"></div><div class="app-preview-home" aria-hidden="true"></div></div></div>';
    const screen=stage.querySelector('.app-preview-screen'),content=stage.querySelector('.app-preview-content');
    for(const node of [...doc.body.children]){
      if(node.id==='appPreviewDesktopTools'||node.tagName==='SCRIPT')continue;
      (node.id==='appTabs'||node.tagName==='DIALOG'?screen:content).append(node);
    }
    doc.body.append(stage);
    const choices=['375','390','402','430'],select=byId('appPreviewWidth'),key='ChessBest:LAB:v2:preview-width';
    let saved;try{saved=root.localStorage.getItem(key);}catch(_){}
    const requested=new URLSearchParams(root.location.search).get('width');
    select.value=choices.includes(requested)?requested:choices.includes(saved)?saved:'402';
    const geometry=()=>{const r=screen.getBoundingClientRect();for(const edge of ['left','top','right','bottom'])doc.body.style.setProperty('--app-screen-'+edge,r[edge]+'px');};
    const draw=()=>{doc.body.style.setProperty('--app-preview-width',select.value+'px');geometry();root.requestAnimationFrame?.(()=>{geometry();root.dispatchEvent(new Event('resize'));root.dispatchEvent(new Event('8zc:resize'));});};
    select.addEventListener('change',()=>{if(!choices.includes(select.value))return;try{root.localStorage.setItem(key,select.value);}catch(_){}const u=new URL(root.location.href);u.searchParams.set('width',select.value);root.history.replaceState(null,'',u);draw();});
    root.addEventListener('resize',geometry,{passive:true});root.addEventListener('scroll',geometry,{passive:true});
    if(root.ResizeObserver)new root.ResizeObserver(geometry).observe(screen);
    draw();
  }
  const syncPresentationLinks = () => {
    for (const link of doc.querySelectorAll('[data-lab-presentation]')) {
      if (appMode) link.removeAttribute('aria-current'); else link.setAttribute('aria-current', 'page');
    }
    for (const link of doc.querySelectorAll('[data-app-presentation]')) {
      if (appMode) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    }
    const previewTools = byId('appPreviewDesktopTools');
    if (previewTools) previewTools.hidden = !desktopPreview;
  };
  syncPresentationLinks();
  if (desktopPreview) doc.title = 'ChessBest APP preview · LAB';
  doc.dispatchEvent(new CustomEvent('chess:mobile-ready', { detail: { native, phone, appMode, desktopPreview } }));
  const views = new Set(['board', 'moves', 'review', 'deep', 'dcc']);
  const scroll = { moves: 0, dcc: 0 };
  let current = 'board', host = null, miniBoard = null, lastFen = '', movesPly = null, activity = {};
  const TOP_LINE_KEY = 'ChessBest:LAB:v2:showTopLine';
  let showTopLine = false;
  let lang = root.ChessLanguage?.getLanguage() || 'en';
  doc.addEventListener('chess:language',event=>{lang=event.detail.lang;if(host){updatePosition();updateActivity({});}});
  function reviewPanel() { return byId('gameReviewPanel'); }
  function deepPanel() { return byId('deepAnalysisPanel'); }
  function isDccOpen() { return byId('btnViewToggle')?.getAttribute('aria-pressed') === 'true'; }
  function lineToSan(fen, moves) {
    if (!host?.Chess || !Array.isArray(moves) || !moves.length) return [];
    try {
      const board = new host.Chess(fen), out = [];
      for (const uci of moves.slice(0, 10)) {
        if (typeof uci !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(uci)) break;
        const move = board.move({ from: uci.slice(0,2), to: uci.slice(2,4), promotion: uci[4] || 'q' });
        if (!move) break;
        out.push(move.san);
      }
      return out;
    } catch (_) { return []; }
  }
  function setTopLineVisibility(next, persist = true) {
    showTopLine = !!next;
    const toggle = byId('settingAppTopLine');
    if (toggle) toggle.checked = showTopLine;
    if (persist) {
      try { root.localStorage.setItem(TOP_LINE_KEY, showTopLine ? '1' : '0'); } catch (_) {}
    }
    if (host) updateTopLine(host.getContext());
    else if (byId('appTopLine')) byId('appTopLine').hidden = !showTopLine;
  }
  function initTopLineSetting() {
    let saved = null;
    try { saved = root.localStorage.getItem(TOP_LINE_KEY); } catch (_) {}
    showTopLine = saved === '1' || saved === 'true';
    const toggle = byId('settingAppTopLine');
    if (toggle) {
      toggle.checked = showTopLine;
      toggle.addEventListener('change', () => setTopLineVisibility(toggle.checked));
    }
    byId('btnResetSettings')?.addEventListener('click', () => setTopLineVisibility(false));
    if (byId('appTopLine')) byId('appTopLine').hidden = !showTopLine;
  }
  function updateTopLine(context) {
    const card = byId('appTopLine'), label = byId('appTopLineLabel'), movesEl = byId('appTopLineMoves');
    if (!card || !context) return;
    card.hidden = !showTopLine;
    const sources = context.analysisSources || {};
    const cdb = sources.CDB, sf = sources.SF, dcc = sources.DCC;
    const cdbBest = cdb?.allMoves?.[0] || cdb?.candidates?.[0] || null;
    const sfBest = sf?.allMoves?.[0] || sf?.candidates?.[0] || null;
    let source = null, depth = null, pv = null;
    if (cdb?.receipt?.status === 'ready' && cdbBest?.move) {
      source = 'CDB';
      const raw = cdbBest.move;
      const candidate = dcc?.receipt?.provider === 'CDB'
        ? (dcc.candidates || []).find(item => item.move === raw) : null;
      const data = candidate?.data || candidate;
      const continuation = Array.isArray(data?.movePath) ? data.movePath : [];
      pv = [raw, ...continuation];
      depth = Number.isFinite(data?.pvDepth) && data.pvDepth > 0 ? data.pvDepth : null;
    } else if (cdb?.receipt?.status === 'unavailable' && sfBest?.move) {
      source = 'SF';
      pv = Array.isArray(sfBest.pv) && sfBest.pv.length ? sfBest.pv : [sfBest.move];
      depth = Number.isFinite(sfBest.depth) ? sfBest.depth :
        Number.isFinite(sf?.receipt?.depth) ? sf.receipt.depth : null;
    }
    const san = lineToSan(context.fen, pv || []);
    if (source && san.length) {
      label.textContent = depth ? `TOP (d${depth}):` : 'TOP:';
      movesEl.textContent = san.join(' ');
      card.dataset.topSource = source;
      card.title = `${source} · ${lang === 'sl' ? 'Odpri Poteze za isti položaj' : 'Open Moves for the same position'}`;
    } else {
      const statusText = byId('analysisSourceStatus')?.textContent?.trim() || '';
      const cdbSettled = cdb?.receipt?.status === 'ready' || cdb?.receipt?.status === 'unavailable';
      const pending = !cdbSettled || /pending|analysis|depth|nodes|čaka|analiza|globina|vozlišč/i.test(statusText);
      label.textContent = 'TOP:';
      movesEl.textContent = pending
        ? (lang === 'sl' ? 'Analiziram…' : 'Analyzing…')
        : (lang === 'sl' ? 'Glavna linija za ta položaj ni na voljo.' : 'Top line is not available for this position.');
      delete card.dataset.topSource;
      card.title = lang === 'sl' ? 'Odpri Poteze za isti položaj' : 'Open Moves for the same position';
    }
  }
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
    updateTopLine(context);
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
    if (current === 'moves' && movesPly !== ply) {
      root.requestAnimationFrame(() => root.requestAnimationFrame(() => revealCurrentMove(ply)));
    }
  }
  function revealCurrentMove(ply) {
    if (current !== 'moves' || !Number.isInteger(ply)) return;
    const move = byId('moves')?.querySelector(`[data-history-ply="${Math.max(0, ply - 1)}"]`);
    const display = byId('workspaceDisplay');
    if (!move || !display) return;
    const visible = display.getBoundingClientRect();
    const selected = move.getBoundingClientRect();
    display.scrollTop += selected.top - visible.top - (visible.height - selected.height) / 2;
    scroll.moves = display.scrollTop;
    movesPly = ply;
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
    // View navigation hides Deep through CSS. Its explicit X/Stop owns engine
    // cancellation; the shared activity row keeps hidden work reachable.
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
    initTopLineSetting();
    // Move existing controls, keeping their IDs and event listeners intact.
    const controls = byId('appBoardControls');
    const analysisRow = doc.querySelector('.analysis-source-row');
    const navRow = doc.querySelector('.top-buttons');
    const status = doc.querySelector('.analysis-status-row') || byId('analysisSourceStatus');
    const actionRow = doc.createElement('div'); actionRow.className = 'app-action-row';
    const analysisSlot = doc.createElement('div'); analysisSlot.className = 'app-analysis-slot';
    analysisSlot.append(analysisRow);
    actionRow.append(analysisSlot);
    controls.append(navRow, actionRow, byId('appTopLine'));
    byId('appClocks').append(byId('workspaceClockSlot'), byId('humanSession'));
    host.onChange(updatePosition);
    for (const tab of byId('appTabs').querySelectorAll('[data-app-tab]')) {
      tab.addEventListener('click', () => setView(tab.dataset.appTab));
    }
    byId('appExpandBoard').addEventListener('click', () => setView('board'));
    byId('appGameName')?.addEventListener('click', () => byId('gameTitle')?.click());
    byId('appNew').addEventListener('click', () => { byId('btnNew').click(); setView('board'); });
    byId('appGames').addEventListener('click', () => {
      setView('moves');
      if (!byId('popularGamesPanel').classList.contains('open')) byId('btnGames').click();
    });
    doc.addEventListener('chess:library-loaded', event => {
      setView(event.detail?.view === 'review' ? 'review' : 'moves');
    });
    byId('appMore').addEventListener('click', () => root.ChessLabLayout?.openTools());
    byId('appSim').addEventListener('click', () => byId('btnSim').click());
    byId('appSimMore').addEventListener('click', () => {
      root.ChessLabLayout?.closeTools({ restoreFocus: false });
      setView('board');
      byId('btnSim').click();
    });
    byId('appReplay').addEventListener('click', () => byId('btnReplay').click());
    byId('appTopLine')?.addEventListener('click', () => setView('moves'));
    byId('next')?.addEventListener('click', event => {
      const review = host.getReviewGame?.();
      if (!review || review.cursor < review.totalPly) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const context = host.getContext();
      const cdb = context.analysisSources?.CDB, sf = context.analysisSources?.SF;
      let best = null;
      if (cdb?.receipt?.status === 'ready') best = cdb.allMoves?.[0] || cdb.candidates?.[0] || null;
      else if (cdb?.receipt?.status === 'unavailable') best = sf?.allMoves?.[0] || sf?.candidates?.[0] || null;
      if (!best?.move || !host.playSuggestedMove?.(best.move)) {
        byId('analysisSourceStatus').textContent = lang === 'sl'
          ? 'Najboljša poteza še ni pripravljena.' : 'Best move is not ready yet.';
      }
    }, true);
    byId('appPause').addEventListener('click', () => doc.dispatchEvent(new CustomEvent('chess:pause-request', { detail: { source: 'app-header' } })));
    // Drawers belong to #controls. Reveal that area before the original action runs.
    byId('labToolsDialog').addEventListener('click', event => {
      const id = event.target.closest('button')?.id;
      if (id === 'btnGames') setView('moves');
      if (id === 'btnNew') root.setTimeout(() => setView('board'), 0);
      if (id === 'btnDeepAnalysis') root.setTimeout(() => setView('deep'), 0);
      if (id === 'btnViewToggle') root.setTimeout(() => setView('dcc'), 0);
    }, true);
    // Tools owns its close focus. A delayed native close event must not pull
    // focus out of a drawer (notably Settings) opened by the selected action.
    byId('replayStart')?.addEventListener('click', () => root.setTimeout(() => setView('board'), 0));
    byId('simStartBtn')?.addEventListener('click', () => root.setTimeout(() => setView('board'), 0));
    byId('humanStart')?.addEventListener('click', () => root.setTimeout(() => setView('board'), 0));
    if (root.MutationObserver) new MutationObserver(() => {
      if (current === 'board' && isDccOpen()) setView('dcc');
    }).observe(byId('btnViewToggle'), { attributes: true, attributeFilter: ['aria-pressed'] });
    doc.addEventListener('chess:activity', event => updateActivity(event.detail || {}));
    const gameTitle = byId('boardGameTitle');
    if (gameTitle && root.MutationObserver) new MutationObserver(updatePosition).observe(gameTitle, { childList: true, characterData: true, subtree: true });
    const refreshTopLine = () => updateTopLine(host.getContext());
    if (root.MutationObserver) for (const watched of [byId('analysisSourceStatus'), byId('dccProgress'), byId('allEvalBadges')]) {
      if (watched) new MutationObserver(refreshTopLine).observe(watched, { childList: true, characterData: true, subtree: true, attributes: true });
    }
    // Fresh phone/native launches always enter the Board view.
    // The CSS keys off data-app-view, so the initial state must be applied explicitly.
    setView('board');
    updatePosition();
    resizeVisibleBoard();
  }
  const boot = () => {
    Promise.resolve(root.ChessLabReady || root.ChessLabStorage?.ready).then(() => {
      init();
    }).catch(() => {
      byId('appPositionName').textContent = 'LAB storage is unavailable';
    });
  };
  if (doc.readyState === 'complete') boot();
  else root.addEventListener('load', boot, { once: true });
})(window);
