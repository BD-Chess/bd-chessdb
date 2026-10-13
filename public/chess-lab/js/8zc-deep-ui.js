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
      <p class="deep-intro">Analyze the current position and compare several lines. While Deep analysis stays open, every new board position is analyzed automatically. Scores below are from White’s perspective.</p>
      <details class="deep-position"><summary>Pinned position</summary><code data-deep="fen"></code><button type="button" data-deep="use">Use current board position</button></details>
      <div class="deep-settings"><label>Analysis mode<select data-deep="mode" aria-label="Deep analysis mode"><option value="sf-lite" selected>SF Lite</option><option value="sf-full">SF Full</option><option value="berserk">Berserk</option><option value="reckless">Reckless</option><option value="lc0">LCZero NN / browser PUCT</option><option value="sf-berserk">SF &amp; Berserk</option></select></label><label>CPU<select data-deep="threads" aria-label="Local search CPU threads"><option value="1" selected>CPU 1</option></select></label><label><span data-deep="budget-label">Search depth</span><select data-deep="budget"><option value="depth:14">14</option><option value="depth:18">18</option><option value="depth:22">22</option><option value="depth:26">26</option><option value="depth:30">30</option><option value="depth:34">34</option><option value="depth:38">38</option><option value="depth:42">42</option><option value="infinite">Until I stop</option></select><output class="deep-dual-time" data-deep="dual-time" hidden></output></label><label>Time<select data-deep="time" aria-label="Deep analysis search time"><option value="off" selected>Off</option><option value="10000">10s</option><option value="30000">30s</option><option value="60000">1m</option><option value="300000">5m</option><option value="900000">15m</option><option value="1800000">30m</option><option value="3600000">1h</option><option value="14400000">4h</option><option value="infinite">Until I stop</option></select></label><label>Lines<select data-deep="multipv"><option>1</option><option selected>3</option><option>5</option><option>10</option></select></label></div>
      <p class="deep-budget-note" data-deep="budget-note" hidden></p><p class="deep-budget-note" data-deep="time-note" hidden></p>
      <p class="deep-allocation" data-deep="allocation" role="status"></p><p class="deep-dcc-note" data-deep="dcc-note" hidden>DCC is unavailable for these engine scores. The separate DCC view remains available.</p>
      <small data-berserk-status role="status" hidden></small>
      <details class="deep-additional"><summary>Additional data · CDB / DCC</summary><p data-deep="additional-status"></p><button type="button" data-deep="cdb-refresh">Refresh CDB data</button></details>
      <label class="deep-root-moves">Only these first moves <span>(optional)</span><input data-deep="roots" placeholder="e4, d4, Nf3" autocomplete="off" spellcheck="false"><small>Enter legal SAN or coordinate moves, separated by commas. Leave empty to search all moves.</small></label>
      <div class="deep-actions"><button type="button" data-deep="start">Analyze position</button><button type="button" data-deep="stop" disabled>Stop</button><button type="button" data-deep="export" disabled>Export analysis</button></div>
      <p class="deep-status" data-deep="status" role="status">Ready. The engine stays idle until you start.</p>
      <div class="deep-lines" data-deep="lines" aria-label="Engine principal variations"></div>
      <section class="deep-preview" data-deep="preview" hidden><div data-deep="preview-board"></div><div><h3>Variation preview</h3><p data-deep="preview-text"></p><button type="button" data-deep="save">Save line to study</button><p class="deep-note">The main board stays at your original position.</p></div></section>
      <p class="deep-note">SF Lite and Berserk each use one search thread. SF Full uses the effective thread count shown above. These local evaluations are separate from DCC. <a href="vendor/ENGINE_NOTICES.md" target="_blank" rel="noopener">Build, source &amp; license</a></p>`;
    workspace.appendChild(panel);
    const el = name => panel.querySelector('[data-deep="' + name + '"]');
    const trigger = doc.getElementById('btnDeepAnalysis');
    let engine = null, pinned = null, result = null, preview = null, previewBoard = null, run = 0, paintAt = 0, paintStatus = '';
    let lastFocus = null, workspaceScroll = 0, deepScroll = 0, workspaceLabel = null, liveUnsubscribe = null;
    let manualStoppedFen = null, pendingLiveScroll = null, followActive = false, unregisterControls = null, unsubscribeSettings = null;
    const Chess = host.Chess || root.Chess;
    const session = root.ChessAnalysisSession;
    const configuredMode = () => session?.getSettings?.()?.analysisMode || 'sf-lite';
    const positionKey = context => JSON.stringify([typeof context === 'string' ? context : context?.fen,
      typeof context === 'string' ? null : context?.positionHistory || null]);
    const modeLabels = { cdb: 'ChessDB', 'sf-lite': 'SF Lite', 'sf-full': 'SF Full', berserk: 'Berserk', reckless:'Reckless',lc0:'LCZero NN / browser PUCT', 'sf-berserk': 'SF & Berserk' };
    let depthWithTime = false;
    function reflectTime(settings = session?.getSettings?.() || {}) {
      if (settings.deepTimeMs != null) {
        const value = settings.deepTimeMs === -1 || settings.deepTimeMs === 'infinite' ? 'infinite' : Number(settings.deepTimeMs) > 0 ? String(settings.deepTimeMs) : 'off';
        if ([...el('time').options].some(option => option.value === value)) el('time').value = value;
      }
      const choice = el('time').value, timed = choice !== 'off';
      el('time-note').hidden = !timed;
      el('time-note').textContent = choice === 'infinite' ? 'Search continues until Stop. Search depth is not a limit.' :
        depthWithTime ? 'Time and the explicitly selected Search depth both apply; the first limit reached ends the search.' :
        'Time is the search budget. Search depth is not a limit unless you select it again.';
    }
    el('time').addEventListener('change', () => {
      depthWithTime = false;
      session?.configure?.({deepTimeMs:el('time').value === 'off' ? 0 : el('time').value === 'infinite' ? -1 : Number(el('time').value)});
      reflectTime();
    });
    el('budget').addEventListener('change', () => {
      depthWithTime = el('time').value !== 'off' && el('time').value !== 'infinite' && el('budget').value.startsWith('depth:');
      reflectTime();
    });
    reflectTime();
    const hasLines = snapshot => !!(snapshot?.lines?.length || Object.values(snapshot?.children || {}).some(child => child?.lines?.length));
    const state = () => ({ open: !panel.hidden, running: !!engine?.isRunning?.(), following: followActive, fen: pinned?.fen || null });
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
      if (!options.preserveViewport) panel.style.minHeight = '';
      el('fen').textContent = pinned.fen; el('roots').value = ''; result = null; preview = null;
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
      reflectAdditional();
      workspace.scrollTop = deepScroll;
      el('start').disabled = !pinned; el('stop').disabled = true;
      el('close').focus({ preventScroll: true });
      if (previewBoard) requestAnimationFrame(() => previewBoard.resize());
      notifyState();
    }
    function close() {
      if (panel.hidden) return;
      const wasRunning = engine?.isRunning();
      ++run; engine?.stop();
      if (wasRunning) el('status').textContent = hasLines(result) ? 'Analysis stopped; results retained.' : 'Analysis cancelled. Start again when ready.';
      el('start').disabled = !pinned; el('stop').disabled = true;
      deepScroll = workspace.scrollTop; panel.hidden = true; manualStoppedFen = null; followActive = false;
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
    function scoreLabel(score) {
      if (!score) return '—';
      if(score.type==='decisive')return score.label||'—';
      if(score.type==='q')return root.ChessEvalBar?.measure(current.fen,score,null,'LC Zero').label || '—';
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
      el('preview-text').textContent = moves.slice(0, index + 1).map(m => m.label).join(' ');
      el('save').hidden = typeof host.onSaveLine !== 'function';
      if (root.Chessboard) {
        if (!previewBoard) previewBoard = root.Chessboard(el('preview-board'), { position: chosen.fen, draggable: false,
          pieceTheme: 'img/chesspieces/wikipedia/{piece}.png' });
        else previewBoard.position(chosen.fen, false);
        requestAnimationFrame(() => previewBoard.resize());
      } else el('preview-board').textContent = chosen.fen;
    }
    function render(current, force, onUpdate) {
      result = current;
      const signature = Object.entries(current.children || {}).map(([key, child]) => key + ':' + child.status).join('|');
      const now = Date.now();
      if (!force && now - paintAt < 100 && signature === paintStatus) return;
      paintAt = now; paintStatus = signature;
      onUpdate?.(current);
      const scroll = el('lines').scrollTop;
      const fragment = doc.createDocumentFragment();
      const children = current.children && Object.keys(current.children).length ? Object.entries(current.children) : null;
      const mode = current.mode || configuredMode();
      const entries = children || [[mode === 'auto' ? 'sf-lite' : mode, current]];
      const showCards = !!children && mode !== 'sf-lite' && mode !== 'auto';
      let displayedLines = 0;
      function appendLines(target, child, key) {
      for (const line of child.lines || []) {
        displayedLines++;
        const row = doc.createElement('article'); row.className = 'deep-line';
        const meta = doc.createElement('div'); meta.className = 'deep-line-meta';
        const score = doc.createElement('strong'); score.textContent = scoreLabel(line.score);
        if (line.score?.type === 'q') score.title = root.ChessEvalBar?.measure(current.fen,line.score,null,'LC Zero').description || 'Native neural Q unavailable';
        const depth = doc.createElement('span'); depth.textContent = key==='cdb'?'Online data':key==='lc0'?'Visits ' + (line.visits ?? child.visits ?? child.nodes ?? '—'):'Depth ' + (line.depth ?? '—');
        meta.append(score, depth); row.appendChild(meta);
        const variation = doc.createElement('div'); variation.className = 'deep-pv';
        const lineMoves = movesFor(current.fen, line.pv);
        variation.title = lineMoves.map(move => move.label).join(' ');
        lineMoves.forEach((move, index) => {
          const button = doc.createElement('button'); button.type = 'button'; button.textContent = move.label;
          button.title = 'Preview ' + sourceName(key, child) + ' after ' + move.san;
          button.onclick = () => showPreview(line, index, key, child); variation.appendChild(button);
        });
        row.appendChild(variation); target.appendChild(row);
      }
      }
      if (showCards) {
        for (const [key, child] of entries) {
          const card = doc.createElement('section'); card.className = 'deep-engine-card';
          card.setAttribute('aria-label', sourceName(key, child) + ' analysis');
          const heading = doc.createElement('h3'); heading.textContent = sourceName(key, child);
          const progress = doc.createElement('p'); progress.className = 'deep-engine-progress';
          const nodes = key === 'lc0' ? ((child.visits ?? child.nodes ?? 0).toLocaleString() + ' visits') : Number.isFinite(child.nodes) ? child.nodes.toLocaleString() + ' nodes' : 'nodes pending';
          const seconds = Number.isFinite(child.elapsedMs) ? (child.elapsedMs / 1000).toFixed(1) + ' s' : 'time pending';
          const threads = Number(child.threadsEffective) || Number(child.engine?.threads) || 1;
          const nps = Number.isFinite(child.nps) ? ' · ' + child.nps.toLocaleString() + ' nps' : '';
          const coverage = key === 'lc0' ? ' · visited root candidates' : child.completeMultiPV ? ' · lines at depth ' + child.linesDepth : ' · partial line coverage';
          progress.textContent = (child.status || 'loading') + (key==='lc0'?' · visits ' + (child.visits ?? child.nodes ?? '—'):' · depth ' + (child.depth ?? child.linesDepth ?? '—')) +
            ' · ' + nodes + nps + ' · ' + seconds + ' · ' + threads + ' search thread' + (threads === 1 ? '' : 's') +
            coverage + (child.downloadProgress?.loaded?' · downloaded '+(child.downloadProgress.loaded/1048576).toFixed(1)+' MiB':'') + (child.error ? ' · ' + (child.error.message || child.error) : '');
          card.append(heading, progress); appendLines(card, child, key); fragment.appendChild(card);
        }
      } else appendLines(fragment, entries[0][1], entries[0][0]);
      el('lines').replaceChildren(fragment); el('lines').scrollTop = scroll;
      root.requestAnimationFrame(() => {
        for (const variation of el('lines').querySelectorAll('.deep-pv'))
          variation.classList.toggle('is-clipped', variation.scrollHeight > variation.clientHeight + 1);
        if (pendingLiveScroll !== null && !panel.hidden && current.fen === pinned?.fen) {
          workspace.scrollTop = pendingLiveScroll;
          if (force || current.completeMultiPV) {
            deepScroll = pendingLiveScroll;
            pendingLiveScroll = null;
          }
        }
      });
      el('export').disabled = !displayedLines;
      if (showCards) {
        const statuses = entries.map(([key, child]) => `${sourceName(key, child)}: ${child.status || 'loading'}`);
        el('status').textContent = statuses.join(' · ') + (mode === 'sf-berserk' ? ' · Independent evaluations; no combined score.' : '');
        return;
      }
      const nodes = Number.isFinite(current.nodes) ? current.nodes.toLocaleString() + ' nodes' : 'Waiting for search information';
      const coverage = current.completeMultiPV ? ' · comparable lines at depth ' + current.linesDepth : ' · partial line coverage';
      el('status').textContent = nodes + ' · ' + (current.elapsedMs / 1000).toFixed(1) + ' s' + coverage + ' · ' +
        (engine?.isRunning() ? 'Analyzing current position…' : current.stopped && manualStoppedFen === current.fen
          ? 'Stopped; the next move will analyze automatically.' : current.stopped ? 'Stopped; analysis retained.' : 'Analysis complete.');
    }
    function rootMoves() {
      const value = el('roots').value.trim(); if (!value) return [];
      return value.split(/[\s,;]+/).filter(Boolean).map(text => {
        const game = new Chess(pinned.fen);
        const move = /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(text) ? game.move({ from: text.slice(0, 2), to: text.slice(2, 4), promotion: text[4] }) : game.move(text, { sloppy: true });
        if (!move) throw new Error('Not a legal first move: ' + text);
        return move.from + move.to + (move.promotion || '');
      });
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
        try { workspace.scrollTo({ top: target, behavior: 'smooth' }); return; }
        catch (_) { /* Older embedded browsers: fall through to scrollTop. */ }
      }
      workspace.scrollTop = target;
    }
    async function start(options = {}) {
      const token = ++run;
      manualStoppedFen = null;
      try {
        if (host.pause) host.pause('deep-analysis');
        if (!pinned) throw new Error('Pin a board position first');
        const opts = { fen: pinned.fen, multiPV: Number(el('multipv').value), searchMoves: configuredMode() === 'lc0' ? [] : rootMoves(),
          history: pinned.positionHistory || (!Array.isArray(pinned.history) ? pinned.history : undefined) };
        const [kind, value] = el('budget').value.split(':'), time = el('time').value;
        if (!options.automatic) followActive = true;
        if (time === 'infinite') opts.infinite = true;
        else if (time !== 'off') {
          opts.movetime = Number.isFinite(options.timeOverride) ? options.timeOverride : Number(time);
          if (depthWithTime && kind === 'depth' && configuredMode() !== 'lc0') opts.depth = Number(value);
        } else if (configuredMode() === 'lc0') {
          const saved = Number(session?.getSettings?.()?.analysisTimeMs);
          opts.movetime = Number.isSafeInteger(saved) && saved > 0 ? saved : session?.capabilities?.()?.mobile ? 5000 : 15000;
        } else if (Number.isFinite(options.depthOverride)) opts.depth = Math.max(1, Math.min(128, Math.round(options.depthOverride)));
        else if (kind === 'infinite') opts.infinite = true;
        else opts[kind] = Number(value);
        if (opts.searchMoves.length) opts.multiPV = Math.min(opts.multiPV, opts.searchMoves.length);
        const onUpdate = host.onSearchStart?.(opts);
        if (!engine) engine = (session || root.ChessDeepEngine).create({ Chess });
        el('start').disabled = true; el('stop').disabled = false;
        el('status').textContent = configuredMode() === 'sf-berserk' ? 'Loading SF Full and Berserk on demand…' :
          configuredMode() === 'sf-full' ? 'Loading SF Full on demand…' :
          configuredMode() === 'berserk' ? 'Loading Berserk on demand…' :
          configuredMode() === 'reckless' ? 'Loading Reckless on demand…' :
          configuredMode() === 'lc0' ? 'Loading LCZero network on demand…' : 'Loading Stockfish 18 Lite (~7 MB on first use)…';
        if (options.reveal !== false) revealSearch();
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
    function stopCurrent() {
      if (!followActive && !engine?.isRunning?.()) return false;
      followActive = false;
      manualStoppedFen = pinned?.fen || null;
      ++run; engine?.stop();
      el('start').disabled = !pinned; el('stop').disabled = true;
      el('status').textContent = 'Stopped · press Analyze position to resume Deep analysis.';
      notifyState(); return true;
    }
    function deepenOrStop() {
      if (panel.hidden || !pinned || !followActive) return false;
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
      if (pinned && !panel.hidden && followActive) start({ automatic: true, reveal: false });
      else if (pinned && !panel.hidden) el('status').textContent = 'Stopped · press Analyze position to resume Deep analysis.';
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
        if (panel.hidden || !context?.fen || context.assistanceLocked || positionKey(context) === positionKey(pinned)) return;
        const keepScroll = workspace.scrollTop;
        const keepMinHeight = panel.style.minHeight;
        ++run; engine?.stop(); manualStoppedFen = null;
        try {
          pendingLiveScroll = keepScroll;
          setPinned(context, { preserveViewport: true });
          if (keepMinHeight) panel.style.minHeight = keepMinHeight;
          workspace.scrollTop = keepScroll;
          root.requestAnimationFrame(() => { if (pendingLiveScroll !== null && !panel.hidden) workspace.scrollTop = pendingLiveScroll; });
          if (followActive) start({ automatic: true, reveal: false });
          else {
            el('start').disabled = !pinned; el('stop').disabled = true;
            el('status').textContent = 'Stopped · press Analyze position to resume Deep analysis.';
            notifyState();
          }
        } catch (e) {
          el('status').textContent = e.message; notifyState();
        }
      });
    }
    unregisterControls = root.ChessAnalysisControls?.registerDeep?.(panel) || null;
    let analysisSettingsKey=JSON.stringify([session?.getSettings?.()?.analysisMode,session?.getSettings?.()?.sfFullThreadsRequested,session?.getSettings?.()?.hashMB]);
    unsubscribeSettings = session?.subscribeSettings?.(settings => {
      reflectTime(settings);
      const nextKey=JSON.stringify([settings.analysisMode,settings.sfFullThreadsRequested,settings.hashMB]);
      if(nextKey===analysisSettingsKey)return;
      analysisSettingsKey=nextKey;
      ++run; engine?.stop(); followActive = false; manualStoppedFen = pinned?.fen || null;
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
    return { open, close, start: () => { if (panel.hidden) open(); if (pinned) return start({ automatic: false }); },
      stop: stopCurrent, deepenOrStop, isOpen: () => !panel.hidden, isRunning: () => !!engine?.isRunning?.(), isFollowing: () => followActive,
      destroy() { close(); ++run; liveUnsubscribe?.(); unsubscribeSettings?.(); unregisterControls?.(); engine?.destroy(); previewBoard?.destroy(); trigger?.removeEventListener('click', toggle); panel.remove(); },
      getResult: () => result };
  }
  root.ChessDeepUI = { create };
})(window);
