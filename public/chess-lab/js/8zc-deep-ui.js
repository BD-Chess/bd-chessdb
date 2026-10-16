/* User-requested, local deep analysis. Pinned root and preview never change the main board. */
(function (root) {
  'use strict';
  function create(host) {
    host = host || {};
    const doc = document;
    const workspace = doc.getElementById('workspaceDisplay');
    if (!workspace) throw new Error('Deep analysis requires the analysis workspace');
    const panel = doc.createElement('section'); panel.className = 'deep-panel'; panel.id = 'deepAnalysisPanel'; panel.hidden = true;
    panel.setAttribute('aria-labelledby', 'deepAnalysisTitle');
    panel.innerHTML = `<header class="deep-header"><div><h2 id="deepAnalysisTitle">Deep analysis</h2><p data-deep="engine-intro">SF Lite · runs on this device.</p></div><button type="button" data-deep="close" aria-label="Return to moves and DCC">×</button></header>
      <p class="deep-intro">Analyze the current position and compare independent lines. Each move is opt-in; turning it off cancels future automatic searches. A current search may finish. Scores below are from White’s perspective.</p>
      <details class="deep-position"><summary>Pinned position</summary><code data-deep="fen"></code><button type="button" data-deep="use">Use current board position</button></details>
      <div class="deep-settings"><label>Analysis mode<select data-deep="mode" aria-label="Deep analysis mode"><option value="sf-lite" selected>SF Lite</option><option value="sf-full">SF Full</option><option value="berserk">Berserk</option><option value="reckless">Reckless</option><option value="lc0">LCZero NN</option><option value="sf-lc0">SF &amp; LC Zero</option><option value="sf-reckless">SF &amp; Reckless</option><option value="sf-berserk">SF &amp; Berserk</option><option value="all">All Engines</option></select></label><label>CPU<select data-deep="threads" aria-label="Local search CPU threads"><option value="1" selected>CPU 1</option></select></label><label><span data-deep="budget-label">Search depth</span><select data-deep="budget"><option value="depth:14">14</option><option value="depth:18">18</option><option value="depth:22">22</option><option value="depth:26">26</option><option value="depth:30">30</option><option value="depth:34">34</option><option value="depth:38">38</option><option value="depth:42">42</option><option value="infinite">Until I stop</option></select><output class="deep-dual-time" data-deep="dual-time" hidden></output></label><label>Time<select data-deep="time" aria-label="Deep analysis search time"><option value="off" selected>Off</option><option value="10000">10s</option><option value="30000">30s</option><option value="60000">1m</option><option value="300000">5m</option><option value="900000">15m</option><option value="1800000">30m</option><option value="3600000">1h</option><option value="14400000">4h</option><option value="infinite">Until I stop</option></select></label><label>Lines<select data-deep="multipv"><option>1</option><option selected>3</option><option>5</option><option>10</option></select></label></div>
      <p class="deep-budget-note" data-deep="budget-note" hidden></p><p class="deep-budget-note" data-deep="time-note" hidden></p>
      <p class="deep-allocation" data-deep="allocation" role="status"></p><p class="deep-dcc-note" data-deep="dcc-note" hidden>DCC is unavailable for these engine scores. The separate DCC view remains available.</p>
      <small data-berserk-status role="status" hidden></small>
      <details class="deep-additional"><summary>Additional data · CDB / DCC</summary><p data-deep="additional-status"></p><button type="button" data-deep="cdb-refresh">Refresh CDB data</button></details>
      <label class="deep-root-moves">Only these first moves <span>(optional)</span><input data-deep="roots" placeholder="e4, d4, Nf3" autocomplete="off" spellcheck="false" aria-describedby="deepRootMovesNote"><small id="deepRootMovesNote" data-deep="roots-note">Enter legal SAN or coordinate moves, separated by commas. Leave empty to search all moves.</small></label>
      <div class="deep-actions"><button type="button" data-deep="start">Analyze position</button><button type="button" data-deep="stop" title="Stop Deep analysis and Deep each move" disabled>Stop</button><label class="deep-follow"><input type="checkbox" data-deep="follow" aria-label="Deep: analyze each new board position">Deep · Each move</label><button type="button" data-deep="export" disabled>Export analysis</button></div>
      <p class="deep-status" data-deep="status" role="status">Ready. The engine stays idle until you start.</p>
      <div class="deep-lines" data-deep="lines" aria-label="Engine principal variations"></div>
      <section class="deep-preview" data-deep="preview" hidden><div data-deep="preview-board"></div><div><h3>Variation preview</h3><p data-deep="preview-text"></p><button type="button" data-deep="save">Save line to study</button><p class="deep-note">The main board stays at your original position.</p></div></section>
      <p class="deep-note">SF Lite and Berserk each use one search thread. SF Full uses the effective thread count shown above. These local evaluations are separate from DCC. <a href="vendor/ENGINE_NOTICES.md" target="_blank" rel="noopener">Build, source &amp; license</a></p>`;
    workspace.appendChild(panel);
    const el = name => panel.querySelector('[data-deep="' + name + '"]');
    const trigger = doc.getElementById('btnDeepAnalysis');
    let engine = null, pinned = null, result = null, resultRun = 0, preview = null, previewBoard = null, run = 0, paintAt = 0, paintStatus = '';
    let lastFocus = null, workspaceScroll = 0, deepScroll = 0, workspaceLabel = null, liveUnsubscribe = null;
    let manualStoppedFen = null, followActive = false, unregisterControls = null, unsubscribeSettings = null;
    let followTimer = null, followGeneration = 0;
    const cancelFollow = () => { ++followGeneration; root.clearTimeout(followTimer); followTimer = null; };
    const eligible = () => !doc.hidden && host.canAnalyze?.() !== false;
    const lineViews = new Map();
    let renderKey = null, clippingFrame = 0;
    const Chess = host.Chess || root.Chess;
    const session = root.ChessAnalysisSession;
    const configuredMode = () => session?.getSettings?.()?.analysisMode || 'sf-lite';
    const positionKey = context => JSON.stringify([typeof context === 'string' ? context : context?.fen,
      typeof context === 'string' ? null : context?.positionHistory || null]);
    const modeLabels = { cdb: 'ChessDB', 'sf-lite': 'SF Lite', 'sf-full': 'SF Full', berserk: 'Berserk', reckless:'Reckless',lc0:'LCZero NN', 'sf-lc0':'SF & LC Zero', 'sf-reckless':'SF & Reckless', 'sf-berserk':'SF & Berserk', all:'All Engines' };
    function reflectTime(settings = session?.getSettings?.() || {}) {
      if (settings.deepTimeMs != null) {
        const value = settings.deepTimeMs === -1 || settings.deepTimeMs === 'infinite' ? 'infinite' : Number(settings.deepTimeMs) > 0 ? String(settings.deepTimeMs) : 'off';
        if ([...el('time').options].some(option => option.value === value)) el('time').value = value;
      }
      const choice = el('time').value, timed = choice !== 'off';
      el('time-note').hidden = !timed;
      el('time-note').textContent = choice === 'infinite' ? 'Search continues until Stop. Search depth is not a limit.' :
        'Time is the search budget for each engine. Search depth is inactive until Time Off.';
      el('budget').disabled=timed||configuredMode()==='lc0';
    }
    el('time').addEventListener('change', () => {
      const time=el('time').value;
      session?.configure?.({deepTimeMs:time==='off'?0:time==='infinite'?-1:Number(time),
        ...(doc.getElementById('analysisLink')?.checked&&Number(time)>0?{analysisTimeMs:Number(time)}:{})});
      reflectTime();
    });
    el('budget').addEventListener('change', () => {
      reflectTime();
      root.ChessAnalysisControls?.refresh?.();
    });
    reflectTime();
    const hasLines = snapshot => !!(snapshot?.lines?.length || Object.values(snapshot?.children || {}).some(child => child?.lines?.length));
    const state = () => ({ open: !panel.hidden, running: !!engine?.isRunning?.(), following: followActive, fen: pinned?.fen || null });
    const activitySnapshot = () => ({owner:'deep',...state(),pending:!!followTimer,
      ...(engine?.activitySnapshot?.()||{children:[]})});
    const notifyState = extra => host.onStateChange?.({...state(),...extra});
    function reflectAdditional() {
      const data=host.getAdditionalAnalysis?.()||{};
      const receipt=data.dcc;
      el('additional-status').textContent=(data.cdbEnabled===false?'CDB disabled':'CDB · '+(data.cdb?.allMoves?.length?'position data available':'no current data'))+' · '+
        (data.dccEnabled===false?'DCC hidden':'DCC · '+(receipt?.provider||receipt?.engineName||receipt?.status||'pending'));
      el('cdb-refresh').disabled=data.cdbEnabled===false||typeof host.onCDBSearch!=='function';
    }
    function setPinned(context, options = {}) {
      const next = typeof context === 'string' ? { fen: context } : Object.assign({}, context);
      if (!next || !next.fen) throw new Error('No board position is available');
      if (next.assistanceLocked) throw new Error('Analysis tools are unavailable in this live game.');
      root.ChessDeepEngine.validateFen(next.fen, Chess); pinned = next;
      manualStoppedFen = null; paintAt = 0; paintStatus = '';
      if (options.preserveViewport) retainViewportHeight();
      else panel.style.minHeight = '';
      el('fen').textContent = pinned.fen; el('roots').value = ''; result = null; preview = null;
      lineViews.clear(); renderKey = null;
      el('lines').replaceChildren(); el('preview').hidden = true; el('export').disabled = true;
      el('status').textContent = 'Position pinned. Choose your analysis settings.';
    }
    function open(context) {
      if (!panel.hidden) return;
      try {
        if (host.pause) host.pause('deep-panel');
        const next = context || host.getContext?.();
        const fen = typeof next === 'string' ? next : next?.fen;
        if (!fen || next?.assistanceLocked || positionKey(pinned) !== positionKey(next)) { setPinned(next); deepScroll = 0; }
      } catch (e) { pinned = null; el('status').textContent = e.message; }
      lastFocus = doc.activeElement; workspaceScroll = workspace.scrollTop;
      workspaceLabel = workspace.getAttribute('aria-label');
      workspace.classList.add('is-deep-analysis');
      workspace.setAttribute('aria-label', 'Deep analysis');
      panel.hidden = false; trigger?.setAttribute('aria-expanded', 'true');
      // Merely entering this view never changes the board's display source.
      reflectAdditional();
      workspace.scrollTop = deepScroll;
      el('start').disabled = !pinned || !!engine?.isRunning?.(); el('stop').disabled = !followActive && !engine?.isRunning?.();
      el('close').focus({ preventScroll: true });
      if (previewBoard) requestAnimationFrame(resizePreview);
      notifyState();
    }
    function close() {
      if (panel.hidden) return;
      cancelFollow();
      const wasRunning = stopAnalysis('panel-close');
      if (wasRunning) el('status').textContent = hasLines(result) ? 'Analysis stopped; results retained.' : 'Analysis cancelled. Start again when ready.';
      el('start').disabled = !pinned; el('stop').disabled = true;
      deepScroll = workspace.scrollTop; panel.hidden = true; manualStoppedFen = null; followActive = false; el('follow').checked = false;
      workspace.classList.remove('is-deep-analysis');
      if (workspaceLabel === null) workspace.removeAttribute('aria-label'); else workspace.setAttribute('aria-label', workspaceLabel);
      trigger?.setAttribute('aria-expanded', 'false');
      workspace.scrollTop = workspaceScroll;
      (lastFocus?.isConnected ? lastFocus : trigger)?.focus?.({ preventScroll: true });
      notifyState(); host.onClose?.();
    }
    function toggle() { if (panel.hidden) open(); else close(); }
    function movesFor(fen, pv) {
      const game = new Chess(fen), list = [];
      for (const uci of pv) {
        const turn = game.turn(), number = Number(game.fen().split(' ')[5]);
        const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
        if (!move) break;
        list.push({ san: move.san, uci, fen: game.fen(), label: (turn === 'w' ? number + '. ' : list.length ? '' : number + '… ') + move.san });
      }
      return list;
    }
    function scoreLabel(score, fen) {
      if (!score) return '—';
      if(score.type==='decisive')return score.label||'—';
      if(score.type==='q')return root.ChessEvalBar?.measure(fen,score,null,'LC Zero').label || '—';
      const prefix = score.whiteBound === 'lower' ? '≥' : score.whiteBound === 'upper' ? '≤' : '';
      if (score.type === 'mate') return prefix + (score.white < 0 ? '−' : '') + '#' + Math.abs(score.white);
      return prefix + (score.white > 0 ? '+' : '') + (score.white / 100).toFixed(2);
    }
    function sourceName(key, snapshot) {
      const engine = snapshot?.engine || {};
      const provided = engine.name || engine.reportedName;
      if (provided) return provided;
      if (key === 'sf-full') return 'Stockfish Full' + (engine.version ? ' ' + engine.version : '');
      if(key==='lc0'||key==='reckless')return root.ChessEngineRegistry?.label(key)||key;
      if (key === 'berserk') return 'Berserk' + (engine.version ? ' ' + engine.version : '');
      if (key === 'reckless') return 'Reckless' + (engine.version ? ' ' + engine.version : '');
      if (key === 'lc0') return 'LCZero NN / browser PUCT';
      return 'Stockfish 18 Lite';
    }
    function resizePreview() {
      if(el('preview').hidden||panel.hidden)return;
      const width=panel.clientWidth||260,height=workspace.clientHeight||400;
      const sideBySide=width>=320;
      el('preview').classList.toggle('is-side-by-side',sideBySide);
      const size=Math.max(80,Math.min(220,sideBySide?width*.46:width-12,height-(sideBySide?40:145)));
      el('preview-board').style.width=Math.floor(size)+'px';
      previewBoard?.resize();
    }
    function revealPreview() {
      const area=el('preview'),padding=parseFloat(root.getComputedStyle(workspace).paddingTop)||0;
      workspace.scrollTop=Math.max(0,workspace.scrollTop+area.getBoundingClientRect().top-workspace.getBoundingClientRect().top-workspace.clientTop-padding);
      deepScroll=workspace.scrollTop;
    }
    const previewObserver=typeof root.ResizeObserver==='function'?new root.ResizeObserver(()=>{ requestAnimationFrame(resizePreview); checkClipping(); }):null;
    previewObserver?.observe(workspace);
    previewObserver?.observe(panel);
    function showPreview(line, index, key, snapshot) {
      const moves = movesFor(pinned.fen, line.pv);
      const chosen = moves[index]; if (!chosen) return;
      preview = { fen: pinned.fen, pv: line.pv.slice(), index, source: sourceName(key, snapshot),
        evaluation: line.score, depth: line.depth, engine: snapshot?.engine || null,
        jobId: snapshot?.jobId || null, threadsEffective: snapshot?.threadsEffective ?? snapshot?.engine?.threadsEffective ?? null,
        analysisMode: result?.mode || snapshot?.mode || key, child: key, limits: snapshot?.limits || null,
        positionHistory: pinned.positionHistory || snapshot?.positionHistory || null,
        elapsedMs: snapshot?.elapsedMs ?? null, completeMultiPV: !!snapshot?.completeMultiPV,
        startedAt: snapshot?.startedAt || null };
      el('preview').hidden = false;
      resizePreview();
      el('preview-text').textContent = moves.slice(0, index + 1).map(m => m.label).join(' ');
      el('save').hidden = typeof host.onSaveLine !== 'function';
      if (root.Chessboard) {
        if (!previewBoard) previewBoard = root.Chessboard(el('preview-board'), { position: chosen.fen, draggable: false,
          pieceTheme: 'img/chesspieces/wikipedia/{piece}.png' });
        else previewBoard.position(chosen.fen, false);
        const shownPreview = preview;
        requestAnimationFrame(() => {
          if (panel.hidden || el('preview').hidden || preview !== shownPreview || root.getComputedStyle(panel).display === 'none') return;
          resizePreview(); revealPreview();
        });
      } else el('preview-board').textContent = chosen.fen;
    }
    const setText = (node, value) => { if (node.textContent !== value) node.textContent = value; };
    function retainViewportHeight() {
      // Clearing old results must not clamp a reader's scroll before new PVs arrive.
      panel.style.minHeight = Math.max(panel.offsetHeight, parseFloat(panel.style.minHeight) || 0) + 'px';
    }
    function checkClipping() {
      if (clippingFrame) return;
      clippingFrame = root.requestAnimationFrame(() => {
        clippingFrame = 0;
        for (const variation of el('lines').querySelectorAll('.deep-pv'))
          variation.classList.toggle('is-clipped', variation.scrollHeight > variation.clientHeight + 1);
      });
    }
    function render(current, force, onUpdate) {
      if(!hasLines(current)&&hasLines(result)&&resultRun!==run&&current.fen===result.fen){
        // Loading/failed/empty stopped requests have no replacement lines.
        // Keep the earlier receipt intact and label it as retained UI data.
        onUpdate?.(current);notifyState({passive:true});
        const errors=[current.error,...Object.values(current.children||{}).map(child=>child.error)].filter(Boolean);
        const failed=errors.length||Object.values(current.children||{}).some(child=>child.status==='failed');
        el('status').textContent=(current.stopped?'Stopped. ':errors.length?'Analysis failed: '+[...new Set(errors)].join('; ')+'. ':failed?'New search failed. ':'Preparing a new search. ')+'Previous results retained.';
        return;
      }
      result = current; resultRun = run;
      const signature = Object.entries(current.children || {}).map(([key, child]) => key + ':' + child.status).join('|');
      const now = Date.now();
      if (!force && now - paintAt < 100 && signature === paintStatus) return;
      paintAt = now; paintStatus = signature;
      notifyState({passive:true});
      const scroll = workspace.scrollTop;
      onUpdate?.(current);
      const children = current.children && Object.keys(current.children).length ? Object.entries(current.children) : null;
      const mode = current.mode || configuredMode();
      const entries = children || [[mode === 'auto' ? 'sf-lite' : mode, current]];
      const showCards = !!children && mode !== 'sf-lite' && mode !== 'auto';
      const nextKey = JSON.stringify([current.fen, showCards, entries.map(([key]) => key)]);
      if (nextKey !== renderKey) {
        lineViews.clear(); el('lines').replaceChildren(); renderKey = nextKey;
      }
      let displayedLines = 0;
      for (const [key, child] of entries) {
        let view = lineViews.get(key);
        const name = sourceName(key, child);
        if (!view) {
          const target = showCards ? doc.createElement('section') : el('lines');
          view = { target, rows: [] }; lineViews.set(key, view);
          if (showCards) {
            target.className = 'deep-engine-card';
            view.heading = doc.createElement('h3');
            view.progress = doc.createElement('p'); view.progress.className = 'deep-engine-progress';
            target.append(view.heading, view.progress); el('lines').appendChild(target);
          }
        }
        if (showCards) {
          view.target.setAttribute('aria-label', name + ' analysis'); setText(view.heading, name);
          const nodes = key === 'lc0' ? ((child.visits ?? child.nodes ?? 0).toLocaleString() + ' visits') : Number.isFinite(child.nodes) ? child.nodes.toLocaleString() + ' nodes' : 'nodes pending';
          const elapsed = child.actualSearchMs ?? child.searchElapsedMs ?? child.elapsedMs;
          const seconds = Number.isFinite(elapsed) ? (elapsed / 1000).toFixed(1) + ' s' : 'time pending';
          const threads = Number(child.threadsEffective) || Number(child.engine?.threads) || 1;
          const nps = Number.isFinite(child.nps) ? ' · ' + child.nps.toLocaleString() + ' nps' : '';
          const coverage = key === 'lc0' ? ' · visited root candidates' : child.coverage?.status==='bestmove-mismatch' ?
            ' · verified lines retained at depth '+child.linesDepth+'; native best move differs ('+child.nativeBestMove+')' :
            child.coverage?.status==='unvalidated'?' · legality unverified':child.completeMultiPV ? ' · lines at depth ' + child.linesDepth : ' · partial line coverage';
          setText(view.progress, (child.status || 'loading') + (key==='lc0'?' · visits ' + (child.visits ?? child.nodes ?? '—'):' · depth ' + (child.depth ?? child.linesDepth ?? '—')) +
            ' · ' + nodes + nps + ' · ' + seconds + ' · ' + threads + ' search thread' + (threads === 1 ? '' : 's') +
            coverage + (child.downloadProgress?.loaded?' · downloaded '+(child.downloadProgress.loaded/1048576).toFixed(1)+' MiB':'') + (child.error ? ' · ' + (child.error.message || child.error) : ''));
        }
        const lines = child.lines || [];
        while (view.rows.length > lines.length) view.rows.pop().row.remove();
        lines.forEach((line, rank) => {
          displayedLines++;
          let item = view.rows[rank];
          if (!item) {
            const row = doc.createElement('article'); row.className = 'deep-line';
            const meta = doc.createElement('div'); meta.className = 'deep-line-meta';
            const score = doc.createElement('strong'), depth = doc.createElement('span');
            const variation = doc.createElement('div'); variation.className = 'deep-pv';
            meta.append(score, depth); row.append(meta, variation); view.target.appendChild(row);
            item = { row, score, depth, variation, buttons: [] }; view.rows.push(item);
          }
          item.line = line; item.child = child;
          setText(item.score, scoreLabel(line.score, current.fen));
          item.score.title = line.score?.type === 'q' ? root.ChessEvalBar?.measure(current.fen,line.score,null,'LC Zero').description || 'Native neural Q unavailable' : '';
          setText(item.depth, key==='cdb'?'Online data':key==='lc0'?'Visits ' + (line.visits ?? child.visits ?? child.nodes ?? '—'):'Depth ' + (line.depth ?? '—'));
          const pvKey = JSON.stringify([current.fen, line.pv, name]);
          if (item.pvKey !== pvKey) {
            item.pvKey = pvKey;
            const moves = movesFor(current.fen, line.pv);
            item.variation.title = moves.map(move => move.label).join(' ');
            while (item.buttons.length > moves.length) item.buttons.pop().remove();
            moves.forEach((move, index) => {
              let button = item.buttons[index];
              if (!button) {
                button = doc.createElement('button'); button.type = 'button';
                button.onclick = () => showPreview(item.line, index, key, item.child);
                item.buttons.push(button); item.variation.appendChild(button);
              }
              setText(button, move.label); button.title = 'Preview ' + name + ' after ' + move.san;
            });
            checkClipping();
          }
        });
        const neuralLines = lines.filter(line => line.score?.type === 'q');
        if (neuralLines.length && !view.neuralDetails) {
          view.neuralDetails = doc.createElement('details'); view.neuralDetails.className = 'deep-neural-details';
          const summary = doc.createElement('summary'); summary.textContent = 'Score details · W/D/L';
          view.neuralText = doc.createElement('p');
          view.neuralDetails.append(summary, view.neuralText); view.target.appendChild(view.neuralDetails);
        }
        if (view.neuralDetails) {
          view.neuralDetails.hidden = !neuralLines.length;
          setText(view.neuralText, neuralLines.map((line, i) => {
            const measured = root.ChessEvalBar?.measure(current.fen, line.score, null, 'LCZero');
            return 'Line ' + (line.multipv || i + 1) + ' · ' + (measured?.description || 'evaluation unavailable');
          }).join('\n') + '\nW/D/L are model estimates for White. Approximate centipawns preserve the original Q/WDL. Maia 1900 models human play.');
          // New MultiPV rows must stay before this persistent, user-opened detail.
          if (view.target.lastElementChild !== view.neuralDetails) view.target.appendChild(view.neuralDetails);
        }
      }
      el('export').disabled = !displayedLines;
      if (showCards) {
        const statuses = entries.map(([key, child]) => `${sourceName(key, child)}: ${child.status || 'loading'}`);
        setText(el('status'), statuses.join(' · ') + (entries.length>1 ? ' · Independent evaluations; no combined score.' : ''));
      } else {
        const nodes = Number.isFinite(current.nodes) ? current.nodes.toLocaleString() + ' nodes' : 'Waiting for search information';
        const coverage = current.coverage?.status==='bestmove-mismatch'?' · verified lines retained at depth '+current.linesDepth+'; native best move differs ('+current.nativeBestMove+')':
          current.coverage?.status==='unvalidated'?' · legality unverified':current.completeMultiPV ? ' · comparable lines at depth ' + current.linesDepth : ' · partial line coverage';
        setText(el('status'), nodes + ' · ' + (current.elapsedMs / 1000).toFixed(1) + ' s' + coverage + ' · ' +
          (engine?.isRunning() ? 'Analyzing current position…' : current.error ? 'Analysis failed: ' + current.error :
            current.forcedStop ? 'Stopped after the engine exceeded its time limit; latest results retained.' :
            current.status === 'partial' ? 'Analysis incomplete; partial results retained.' : current.stopped && manualStoppedFen === current.fen
              ? 'Stopped; retained results. Each move is off.' : current.stopped ? 'Stopped; analysis retained.' : 'Analysis complete.'));
      }
      // The workspace is the scroller. The lines container itself never scrolls.
      if (workspace.scrollTop !== scroll) workspace.scrollTop = scroll;
    }
    function rootMoves() {
      const value = el('roots').value.trim(); if (!value) return [];
      return [...new Set(value.split(/[\s,;]+/).filter(Boolean).map(text => {
        const game = new Chess(pinned.fen);
        const move = /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(text) ? game.move({ from: text.slice(0, 2), to: text.slice(2, 4), promotion: text[4] }) : game.move(text, { sloppy: true });
        if (!move) throw new Error('Not a legal first move: ' + text);
        return move.from + move.to + (move.promotion || '');
      }))];
    }
    function revealSearch() {
      const actions = panel.querySelector('.deep-actions');
      const style = root.getComputedStyle(workspace);
      const topPadding = parseFloat(style.paddingTop) || 0, bottomPadding = parseFloat(style.paddingBottom) || 0;
      const offset = actions.getBoundingClientRect().top - panel.getBoundingClientRect().top;
      // Keep room below the toolbar even while the engine is loading or has
      // only a short PV. Reveal the result area inside the workspace, never
      // by moving the page itself.
      panel.style.minHeight = Math.max(0, offset + workspace.clientHeight - topPadding - bottomPadding) + 'px';
      const target = Math.max(0, workspace.scrollTop + actions.getBoundingClientRect().top -
        workspace.getBoundingClientRect().top - workspace.clientTop - topPadding);
      deepScroll = target;
      if (typeof workspace.scrollTo === 'function') {
        try { workspace.scrollTo({ top: target, behavior: 'instant' }); return; }
        catch (_) { /* Older embedded browsers: fall through to scrollTop. */ }
      }
      workspace.scrollTop = target;
    }
    async function start(options = {}) {
      if (!eligible() || options.automatic && !followActive) return;
      cancelFollow();
      if (!options.automatic) {
        const next = host.getContext?.();
        if (next?.fen && positionKey(next) !== positionKey(pinned)) setPinned(next, {preserveViewport:true});
      }
      const token = ++run;
      manualStoppedFen = null;
      try {
        if (host.pause) host.pause('deep-analysis');
        if (!pinned) throw new Error('Pin a board position first');
        const support=session?.rootMoveSupport?.(configuredMode())||root.ChessEngineRegistry?.rootSupport?.(session?.participants?.(configuredMode())||[configuredMode()]);
        const opts = { fen: pinned.fen, multiPV: Number(el('multipv').value), searchMoves: support?.supported ? rootMoves() : [],
          history: pinned.positionHistory || (!Array.isArray(pinned.history) ? pinned.history : undefined) };
        const [kind, value] = el('budget').value.split(':'), time = el('time').value;
        if (time === 'infinite') opts.infinite = true;
        else if (time !== 'off') {
          opts.movetime = Number.isFinite(options.timeOverride) ? options.timeOverride : Number(time);
        } else if (configuredMode() === 'lc0') {
          const saved = Number(session?.getSettings?.()?.analysisTimeMs);
          opts.movetime = Number.isSafeInteger(saved) && saved > 0 ? saved : session?.capabilities?.()?.mobile ? 5000 : 15000;
        } else if (Number.isFinite(options.depthOverride)) opts.depth = Math.max(1, Math.min(128, Math.round(options.depthOverride)));
        else if (kind === 'infinite') opts.infinite = true;
        else opts[kind] = Number(value);
        if (opts.searchMoves.length) opts.multiPV = Math.min(opts.multiPV, opts.searchMoves.length);
        root.ChessAnalysisControls?.syncLinkedDeep?.();
        const onUpdate = host.onSearchStart?.(opts);
        if (!engine) engine = (session || root.ChessDeepEngine).create({ Chess });
        el('start').disabled = true; el('stop').disabled = false;
        el('status').textContent = session?.isGroup?.(configuredMode()) ? 'Preparing '+modeLabels[configuredMode()]+' on demand…' :
          configuredMode() === 'sf-full' ? 'Loading SF Full on demand…' :
          configuredMode() === 'berserk' ? 'Loading Berserk on demand…' :
          configuredMode() === 'reckless' ? 'Loading Reckless on demand…' :
          configuredMode() === 'lc0' ? 'Loading LCZero network on demand…' : 'Loading Stockfish 18 Lite (~7 MB on first use)…';
        if (options.reveal === false) retainViewportHeight();
        else revealSearch();
        opts.onInfo = (_, snapshot) => { if (token === run) render(snapshot, false, onUpdate); };
        const pending = engine.analyze(opts); notifyState();
        const done = await pending;
        if (token !== run) return;
        render(done, true, onUpdate);
        if (host.onResult) host.onResult(done);
      } catch (e) { if (token === run) el('status').textContent = e.name === 'AbortError' ? 'Analysis cancelled.' : e.message; }
      finally {
        if (token === run) { el('start').disabled = false; el('stop').disabled = !followActive; notifyState(); }
      }
    }
    function stopAnalysis(reason) {
      const wasRunning=!!engine?.isRunning?.(),ownsResult=result&&resultRun===run;
      ++run;const final=engine?.stop();
      // Session cancellation owns newer information than a throttled UI paint.
      // Retain that exact snapshot locally; it is not a new evidence receipt.
      if(final?.fen===pinned?.fen&&(hasLines(final)||!hasLines(result))){render(final,true);return wasRunning;}
      if(ownsResult){
        const active=status=>['loading','preparing','ready','queued','searching','running'].includes(status);
        let changed=wasRunning||active(result.status);
        const children=result.children&&Object.fromEntries(Object.entries(result.children).map(([key,child])=>{
          if(!active(child.status))return [key,child];
          changed=true;
          return [key,{...child,status:'stopped',stopped:true,partial:true,stopReason:reason}];
        }));
        if(changed)render({...result,status:'stopped',stopped:true,partial:true,stopReason:reason,
          ...(children?{children,groupComplete:false,dualComplete:false}:{})},true);
      }
      return wasRunning;
    }
    function stopCurrent() {
      const active = followActive || !!followTimer || !!engine?.isRunning?.();
      cancelFollow();
      followActive = false;
      el('follow').checked = false;
      if (!active) { notifyState({passive:true}); return false; }
      manualStoppedFen = pinned?.fen || null;
      stopAnalysis('user-stop');
      el('start').disabled = !pinned; el('stop').disabled = true;
      el('status').textContent = hasLines(result)?'Stopped · Retained results. Each move is off. Analyze position starts a new search.':
        'Stopped · Each move is off. Analyze position starts a new search.';
      notifyState(); return true;
    }
    function deepenOrStop() {
      if (panel.hidden || !pinned) return false;
      if (engine?.isRunning?.()) return stopCurrent();
      const [kind, value] = el('budget').value.split(':'), time = el('time').value;
      if (time !== 'off') {
        const prior = Number(result?.requestedBudget?.movetime ?? result?.limits?.movetime) || Number(time);
        start({ ...(time === 'infinite' ? {} : {timeOverride:Math.min(14400000,Math.max(Number(time),prior)*2)}), reveal: false }); return true;
      }
      if (configuredMode() === 'sf-berserk' || configuredMode() === 'lc0') { start({ reveal: false }); return true; }
      if (kind === 'infinite') { start({ reveal: false }); return true; }
      const snapshots = result?.children ? Object.values(result.children) : [result];
      const reached = Math.max(Number(value) || 14, ...snapshots.flatMap(snapshot =>
        [Number(snapshot?.linesDepth) || 0, ...(snapshot?.lines || []).map(line => Number(line.depth) || 0)]));
      start({ depthOverride: Math.min(128, reached + 2), reveal: false }); return true;
    }
    el('start').onclick = () => start({ automatic: false }); el('stop').onclick = stopCurrent;
    function scheduleFollow(context = host.getContext?.()) {
      cancelFollow();
      if (!followActive || !eligible() || !context?.fen || context.assistanceLocked) return;
      const token = followGeneration, signature = positionKey(context);
      followTimer = root.setTimeout(() => {
        followTimer = null;
        const next = host.getContext?.() || context;
        if (token !== followGeneration || !followActive || !eligible() || positionKey(next) !== signature) return;
        if (positionKey(pinned) !== signature) setPinned(next, {preserveViewport:true});
        void start({automatic:true,reveal:false});
      },100);
      notifyState({passive:true});
    }
    el('follow').onchange = () => {
      cancelFollow();
      followActive = el('follow').checked && eligible();
      el('follow').checked = followActive;
      if (followActive) { host.onFollowEnable?.(); if(!engine?.isRunning?.())scheduleFollow(); }
      el('stop').disabled = !followActive && !engine?.isRunning?.();
      notifyState({passive:true});
    };
    el('cdb-refresh').onclick=async()=>{
      el('cdb-refresh').disabled=true;el('additional-status').textContent='Refreshing ChessDB…';
      try{await host.onCDBSearch?.();reflectAdditional();}
      catch(error){el('additional-status').textContent=error.message;}
      finally{el('cdb-refresh').disabled=host.getAdditionalAnalysis?.().cdbEnabled===false;}
    };
    el('close').onclick = close;
    el('use').onclick = () => {
      engine?.stop(); ++run; pinned = null;
      try { if (host.pause) host.pause(followActive ? 'deep-analysis' : 'deep-panel'); setPinned(host.getContext?.()); }
      catch (e) { el('status').textContent = e.message; }
      el('start').disabled = !pinned; el('stop').disabled = !followActive;
      if (pinned && !panel.hidden && followActive) scheduleFollow();
      else if (pinned && !panel.hidden) el('status').textContent = 'Analyze position starts a new search.';
    };
    el('save').onclick = async () => {
      if (!preview || !host.onSaveLine || el('save').disabled) return;
      const frozen = JSON.parse(JSON.stringify(preview)); el('save').disabled = true;
      try { const saved = await host.onSaveLine(frozen); el('status').textContent = saved?.ok ? saved.message || 'Continuation saved.' : 'Save pending. Open Manage Studies to continue.'; }
      catch (e) { el('status').textContent = 'Save failed: ' + e.message; }
      finally { el('save').disabled = false; }
    };
    el('export').onclick = () => {
      if (!result) return;
      const blob = new Blob([JSON.stringify(result, null, 2) + '\n'], { type: 'application/json' });
      const url = URL.createObjectURL(blob), link = doc.createElement('a'); link.href = url;
      link.download = 'Chess_' + (modeLabels[result.mode || configuredMode()] || 'Engine').replace(/[^a-z0-9]+/gi, '_') +
        '_Analysis_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    if (typeof host.onChange === 'function') {
      liveUnsubscribe = host.onChange(context => {
        if (!context?.fen || positionKey(context) === positionKey(pinned)) return;
        cancelFollow();
        const keepScroll = workspace.scrollTop;
        ++run; engine?.stop(); manualStoppedFen = null;
        try {
          setPinned(context, { preserveViewport: true });
          workspace.scrollTop = keepScroll;
          if (followActive && eligible() && !context.assistanceLocked) scheduleFollow(context);
          else {
            el('start').disabled = !pinned; el('stop').disabled = true;
            el('status').textContent = 'Analyze position starts a new search. Each move is off.';
            notifyState();
          }
        } catch (e) {
          el('status').textContent = e.message; notifyState();
        }
      });
    }
    unregisterControls = root.ChessAnalysisControls?.registerDeep?.(panel) || null;
    const settingsKey=settings=>JSON.stringify([settings?.analysisMode,
      ['sf-lc0','sf-reckless','sf-berserk','all'].includes(settings?.analysisMode)?settings?.sfCardMode:null,
      settings?.sfFullThreadsRequested,settings?.hashMB,settings?.deepTimeMs]);
    let analysisSettingsKey=settingsKey(session?.getSettings?.());
    unsubscribeSettings = session?.subscribeSettings?.(settings => {
      reflectTime(settings);
      const nextKey=settingsKey(settings);
      if(nextKey===analysisSettingsKey)return;
      analysisSettingsKey=nextKey;
      cancelFollow(); stopAnalysis('settings-change'); followActive = false; el('follow').checked = false; manualStoppedFen = pinned?.fen || null;
      el('start').disabled = !pinned; el('stop').disabled = true;
      el('status').textContent = 'Selected '+modeLabels[settings.analysisMode]+'. '+(hasLines(result)?'Previous '+(modeLabels[result.mode]||'engine')+' results retained. ':'')+'Press Analyze position to start.';
      notifyState({passive:true});
    }) || null;
    // Panel keyboard actions never move the main board or reach its shortcuts.
    panel.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    });
    if (trigger) {
      trigger.removeAttribute('aria-haspopup'); trigger.setAttribute('aria-controls', panel.id); trigger.setAttribute('aria-expanded', 'false');
      trigger.addEventListener('click', toggle);
    }
    const pauseHidden = () => {
      cancelFollow();stopAnalysis('page-hidden');
      el('start').disabled=!pinned;el('stop').disabled=!followActive;
      notifyState({passive:true});
    };
    const pageHidden = () => { if(doc.hidden)pauseHidden(); };
    doc.addEventListener('visibilitychange',pageHidden);
    const pageExit = pauseHidden;
    root.addEventListener('pagehide',pageExit);
    return { open, close, start: () => { if (panel.hidden) open(); if (pinned) return start({ automatic: false }); },
      activitySnapshot,
      stop: stopCurrent, deepenOrStop, isOpen: () => !panel.hidden, isRunning: () => !!engine?.isRunning?.(), isFollowing: () => followActive,
      destroy() { cancelFollow(); close(); ++run; doc.removeEventListener('visibilitychange',pageHidden);root.removeEventListener('pagehide',pageExit);liveUnsubscribe?.(); unsubscribeSettings?.(); unregisterControls?.(); engine?.destroy(); previewObserver?.disconnect();root.cancelAnimationFrame(clippingFrame);previewBoard?.destroy(); trigger?.removeEventListener('click', toggle); panel.remove(); },
      getResult: () => result };
  }
  root.ChessDeepUI = { create };
})(window);
