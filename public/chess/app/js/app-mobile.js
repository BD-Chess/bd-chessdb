/* Shared APP view controller. The iframe preview gives it the same narrow
 * viewport as a phone; all analysis/game state remains in the LAB-derived host. */
(function (root) {
  'use strict';
  const doc = root.document;
  const byId = id => doc.getElementById(id);
  const views = new Set(['board', 'moves', 'review', 'deep', 'dcc']);
  const scroll = { moves: 0, dcc: 0 };
  let current = 'board', host = null, miniBoard = null, lastFen = '', movesPly = null, activity = {};
  let topLine = null, showTopLineDetail = false;

  function appText(en, sl) { return root.ChessAppI18n?.lang === 'sl' ? sl : en; }
  function analysisCandidate(source) {
    if (!source) return null;
    const rows = source.allMoves || source.candidates || [];
    const first = rows[0];
    return first?.data || first || null;
  }
  function lineFromCandidate(candidate) {
    if (!candidate?.move) return [];
    const pv = Array.isArray(candidate.pv) ? candidate.pv.slice() : [];
    if (pv.length) return pv[0] === candidate.move ? pv : [candidate.move].concat(pv);
    const path = Array.isArray(candidate.movePath) ? candidate.movePath.slice() : [];
    return path.length ? path : [];
  }
  function topLineFor(context) {
    const sources = context?.analysisSources || {};
    const cdbBest = analysisCandidate(sources.CDB);
    let line = lineFromCandidate(cdbBest);
    if (line.length < 2 && sources.DCC?.receipt?.provider === 'CDB') {
      const rawBest = sources.DCC.receipt.rawBest || cdbBest?.move;
      const rows = (sources.DCC.candidates || []).map(row => row?.data || row);
      const measured = rows.find(row => row?.move === rawBest);
      const measuredLine = lineFromCandidate(measured);
      if (measuredLine.length >= 2) line = measuredLine;
    }
    if (line.length >= 2) return { source: 'CDB', moves: line, depth: sources.DCC?.receipt?.depth || null };
    const sf = analysisCandidate(sources.SF);
    line = lineFromCandidate(sf);
    if (line.length) return { source: 'SF', moves: line, depth: sf?.depth || sources.SF?.receipt?.depth || null };
    return null;
  }
  function formatLine(fen, moves) {
    if (!Array.isArray(moves) || !moves.length) return '';
    const Chess = host?.Chess || root.Chess;
    if (!Chess) return moves.join(' ');
    try {
      const board = new Chess(fen);
      const parts = fen.split(' ');
      let turn = parts[1] === 'b' ? 'b' : 'w';
      let number = Number(parts[5]) || 1;
      const out = [];
      for (const uci of moves.slice(0, 10)) {
        if (typeof uci !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) break;
        const spec = { from: uci.slice(0,2), to: uci.slice(2,4) }; if (uci[4]) spec.promotion = uci[4];
        const move = board.move(spec);
        if (!move) break;
        if (turn === 'w') out.push(number + '. ' + move.san);
        else {
          if (!out.length) out.push(number + '... ' + move.san);
          else out.push(move.san);
          number++;
        }
        turn = turn === 'w' ? 'b' : 'w';
      }
      return out.join(' ');
    } catch (_) { return moves.join(' '); }
  }
  function renderTopLine(context) {
    const card = byId('appTopLine'), detail = byId('appTopLineDetail');
    if (!card || !context) return;
    const found = topLineFor(context);
    if (found) {
      const formatted = formatLine(context.fen, found.moves);
      const meta = found.source === 'CDB'
        ? appText('CDB · measured continuation', 'CDB · izmerjeno nadaljevanje')
        : appText('SF' + (found.depth ? ' · depth ' + found.depth : ''), 'SF' + (found.depth ? ' · globina ' + found.depth : ''));
      topLine = { formatted, meta, source: found.source };
      card.disabled = false;
      byId('appTopLineLabel').textContent = appText('TOP LINE · ' + found.source, 'TOP LINIJA · ' + found.source);
      byId('appTopLineMoves').textContent = formatted;
      byId('appTopLineMeta').textContent = meta + appText(' · tap for full line', ' · tapni za celotno linijo');
      byId('appTopLineDetailLabel').textContent = appText('TOP LINE · ' + found.source, 'TOP LINIJA · ' + found.source);
      byId('appTopLineDetailMoves').textContent = formatted;
      byId('appTopLineDetailMeta').textContent = meta;
    } else {
      topLine = null; showTopLineDetail = false; if (detail) detail.hidden = true;
      const status = byId('analysisSourceStatus')?.textContent?.trim() || appText('Analysis pending', 'Analiza čaka');
      card.disabled = true;
      byId('appTopLineLabel').textContent = appText('ANALYSIS', 'ANALIZA');
      byId('appTopLineMoves').textContent = status;
      byId('appTopLineMeta').textContent = appText('Top line appears when CDB or SF has a measured continuation.', 'Top linija se prikaže, ko ima CDB ali SF izmerjeno nadaljevanje.');
    }
  }

  function reviewPanel() { return byId('gameReviewPanel'); }
  function deepPanel() { return byId('deepAnalysisPanel'); }
  function isDccOpen() { return byId('btnViewToggle')?.getAttribute('aria-pressed') === 'true'; }
  function updatePosition() {
    if (!host) return;
    const context = host.getContext();
    if (!context?.fen) return;
    const title = byId('boardGameTitle')?.textContent?.trim() || byId('gameTitle')?.textContent?.trim() || 'ChessBest';
    const ply = Array.isArray(context.history) ? context.history.length : null;
    const label = ply == null ? appText('Current position', 'Trenutni položaj') : (ply === 0 ? appText('Starting position', 'Začetni položaj') : (root.ChessAppI18n?.lang === 'sl' ? 'Položaj po ' + ply + ' polpotezah' : 'Position after ' + ply + ' half-moves'));
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
    renderTopLine(context);
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
    if (current === 'deep' && next !== 'deep') closeDeep();
    current = next;
    doc.body.dataset.appView = next;
    byId('appPositionPreview').hidden = next === 'board';
    byId('appReplay').hidden = next !== 'dcc';
    byId('appTopLineDetail').hidden = next !== 'moves' || !showTopLineDetail;
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
    const label = activity.kind === 'replay' ? appText('DCC replay running', 'DCC replay teče')
      : activity.kind === 'local' ? appText('Game in progress', 'Partija poteka') : appText('Simulation running', 'Simulacija teče');
    const active = activity.kind === 'replay' || activity.kind === 'local' || !!activity.simRunning;
    byId('appActivity').hidden = !active;
    byId('appActivityText').textContent = label;
    byId('appPause').textContent = activity.kind === 'replay' ? appText('Stop replay', 'Ustavi replay')
      : activity.kind === 'local' ? appText('End game', 'Končaj partijo') : appText('Pause', 'Pavza');
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
    byId('appTopLine').addEventListener('click', () => {
      if (!topLine) return;
      showTopLineDetail = true;
      setView('moves');
      byId('appTopLineDetail').hidden = false;
    });
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
    doc.addEventListener('chess:language', () => {
      updatePosition(); updateActivity(activity);
      if (host) renderTopLine(host.getContext());
    });
    const analysisStatus = byId('analysisSourceStatus');
    if (analysisStatus && root.MutationObserver) new MutationObserver(() => {
      if (host) renderTopLine(host.getContext());
    }).observe(analysisStatus, { childList: true, characterData: true, subtree: true });
    const gameTitle = byId('boardGameTitle');
    if (gameTitle && root.MutationObserver) new MutationObserver(updatePosition).observe(gameTitle, { childList: true, characterData: true, subtree: true });
    updatePosition();
    resizeVisibleBoard();
  }
  const boot = () => {
    Promise.resolve(root.ChessLabReady || root.ChessLabStorage?.ready).then(init).catch(() => {
      byId('appPositionName').textContent = appText('APP storage is unavailable', 'Shramba APP ni na voljo');
    });
  };
  if (doc.readyState === 'complete') boot();
  else root.addEventListener('load', boot, { once: true });
})(window);
