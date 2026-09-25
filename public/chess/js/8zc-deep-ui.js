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
    panel.innerHTML = `<header class="deep-header"><div><h2 id="deepAnalysisTitle">Deep analysis</h2><p>Stockfish 18 Lite · runs on this device</p></div><button type="button" data-deep="close" aria-label="Return to moves and DCC">×</button></header>
      <p class="deep-intro">Analyze a pinned position, compare several lines, or challenge selected moves. The local engine loads when you start. Scores below are from White’s perspective.</p>
      <details class="deep-position"><summary>Pinned position</summary><code data-deep="fen"></code><button type="button" data-deep="use">Use current board position</button></details>
      <div class="deep-settings"><label>Search budget<select data-deep="budget"><option value="depth:14">Depth 14</option><option value="depth:18">Depth 18</option><option value="nodes:250000">250,000 nodes</option><option value="nodes:1000000">1,000,000 nodes</option><option value="infinite">Until I stop</option></select></label><label>Lines<select data-deep="multipv"><option>1</option><option selected>3</option><option>5</option><option>10</option></select></label></div>
      <label class="deep-root-moves">Only these first moves <span>(optional)</span><input data-deep="roots" placeholder="e4, d4, Nf3" autocomplete="off" spellcheck="false"><small>Enter legal SAN or coordinate moves, separated by commas. Leave empty to search all moves.</small></label>
      <div class="deep-actions"><button type="button" data-deep="start">Analyze position</button><button type="button" data-deep="stop" disabled>Stop</button><button type="button" data-deep="export" disabled>Export analysis</button></div>
      <p class="deep-status" data-deep="status" role="status">Ready. The engine stays idle until you start.</p>
      <div class="deep-lines" data-deep="lines" aria-label="Stockfish principal variations"></div>
      <section class="deep-preview" data-deep="preview" hidden><div data-deep="preview-board"></div><div><h3>Variation preview</h3><p data-deep="preview-text"></p><button type="button" data-deep="save">Save line to study</button><p class="deep-note">The main board stays at your original position.</p></div></section>
      <p class="deep-note">Lite is a compact build for desktop and mobile, with one CPU thread. This is a separate engine evaluation, not a DCC score. <a href="vendor/stockfish/README.md" target="_blank" rel="noopener">Build, source &amp; license</a></p>`;
    workspace.appendChild(panel);
    const el = name => panel.querySelector('[data-deep="' + name + '"]');
    const trigger = doc.getElementById('btnDeepAnalysis');
    let engine = null, pinned = null, result = null, preview = null, previewBoard = null, run = 0, paintAt = 0;
    let lastFocus = null, workspaceScroll = 0, deepScroll = 0, workspaceLabel = null;
    const Chess = host.Chess || root.Chess;
    function setPinned(context) {
      const next = typeof context === 'string' ? { fen: context } : Object.assign({}, context);
      if (!next || !next.fen) throw new Error('No board position is available');
      if (next.assistanceLocked) throw new Error('Analysis tools are unavailable in this live game.');
      root.ChessDeepEngine.validateFen(next.fen, Chess); pinned = next;
      el('fen').textContent = pinned.fen; el('roots').value = ''; result = null; preview = null;
      el('lines').replaceChildren(); el('preview').hidden = true; el('export').disabled = true;
      el('status').textContent = 'Position pinned. Choose your analysis settings.';
    }
    function open(context) {
      if (!panel.hidden) return;
      try {
        if (host.pause) host.pause('deep-analysis');
        const next = context || host.getContext?.();
        const fen = typeof next === 'string' ? next : next?.fen;
        if (!fen || next?.assistanceLocked || pinned?.fen !== fen) { setPinned(next); deepScroll = 0; }
      } catch (e) { pinned = null; el('status').textContent = e.message; }
      lastFocus = doc.activeElement; workspaceScroll = workspace.scrollTop;
      workspaceLabel = workspace.getAttribute('aria-label');
      workspace.classList.add('is-deep-analysis');
      workspace.setAttribute('aria-label', 'Deep analysis');
      panel.hidden = false; trigger?.setAttribute('aria-expanded', 'true');
      workspace.scrollTop = deepScroll;
      el('start').disabled = !pinned; el('stop').disabled = true;
      el('close').focus({ preventScroll: true });
      if (previewBoard) requestAnimationFrame(() => previewBoard.resize());
    }
    function close() {
      if (panel.hidden) return;
      const wasRunning = engine?.isRunning();
      ++run; engine?.stop();
      if (wasRunning) el('status').textContent = result?.lines?.length ? 'Analysis stopped; results retained.' : 'Analysis cancelled. Start again when ready.';
      el('start').disabled = !pinned; el('stop').disabled = true;
      deepScroll = workspace.scrollTop; panel.hidden = true;
      workspace.classList.remove('is-deep-analysis');
      if (workspaceLabel === null) workspace.removeAttribute('aria-label'); else workspace.setAttribute('aria-label', workspaceLabel);
      trigger?.setAttribute('aria-expanded', 'false');
      workspace.scrollTop = workspaceScroll;
      (lastFocus?.isConnected ? lastFocus : trigger)?.focus?.({ preventScroll: true });
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
      const prefix = score.whiteBound === 'lower' ? '≥' : score.whiteBound === 'upper' ? '≤' : '';
      if (score.type === 'mate') return prefix + (score.white < 0 ? '−' : '') + '#' + Math.abs(score.white);
      return prefix + (score.white > 0 ? '+' : '') + (score.white / 100).toFixed(2);
    }
    function showPreview(line, index) {
      const moves = movesFor(pinned.fen, line.pv);
      const chosen = moves[index]; if (!chosen) return;
      preview = { fen: pinned.fen, pv: line.pv.slice(), index, source: 'Stockfish 18 Lite', evaluation: line.score, depth: line.depth };
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
      const now = Date.now(); if (!force && now - paintAt < 100) return; paintAt = now;
      onUpdate?.(current);
      const scroll = el('lines').scrollTop;
      const fragment = doc.createDocumentFragment();
      current.lines.forEach(line => {
        const row = doc.createElement('article'); row.className = 'deep-line';
        const meta = doc.createElement('div'); meta.className = 'deep-line-meta';
        const score = doc.createElement('strong'); score.textContent = scoreLabel(line.score);
        const depth = doc.createElement('span'); depth.textContent = 'Depth ' + (line.depth ?? '—');
        meta.append(score, depth); row.appendChild(meta);
        const variation = doc.createElement('div'); variation.className = 'deep-pv';
        movesFor(current.fen, line.pv).forEach((move, index) => {
          const button = doc.createElement('button'); button.type = 'button'; button.textContent = move.label;
          button.title = 'Preview after ' + move.san; button.onclick = () => showPreview(line, index); variation.appendChild(button);
        });
        row.appendChild(variation); fragment.appendChild(row);
      });
      el('lines').replaceChildren(fragment); el('lines').scrollTop = scroll;
      el('export').disabled = !current.lines.length;
      const nodes = Number.isFinite(current.nodes) ? current.nodes.toLocaleString() + ' nodes' : 'Waiting for search information';
      const coverage = current.completeMultiPV ? ' · comparable lines at depth ' + current.linesDepth : ' · partial line coverage';
      el('status').textContent = nodes + ' · ' + (current.elapsedMs / 1000).toFixed(1) + ' s' + coverage + ' · ' + (engine?.isRunning() ? 'Analyzing pinned position…' : current.stopped ? 'Stopped; analysis retained.' : 'Analysis complete.');
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
    async function start() {
      const token = ++run;
      try {
        if (host.pause) host.pause('deep-analysis');
        if (!pinned) throw new Error('Pin a board position first');
        const opts = { fen: pinned.fen, multiPV: Number(el('multipv').value), searchMoves: rootMoves(),
          history: pinned.positionHistory || (!Array.isArray(pinned.history) ? pinned.history : undefined) };
        const [kind, value] = el('budget').value.split(':');
        if (kind === 'infinite') opts.infinite = true; else opts[kind] = Number(value);
        if (opts.searchMoves.length) opts.multiPV = Math.min(opts.multiPV, opts.searchMoves.length);
        // The host binds this publisher to the current board/session, while the
        // run token below rejects responses after close, repin or restart.
        const onUpdate = host.onSearchStart?.(opts);
        if (!engine) engine = root.ChessDeepEngine.create({ Chess });
        el('start').disabled = true; el('stop').disabled = false;
        el('status').textContent = 'Loading Stockfish 18 Lite (~7 MB on first use)…';
        opts.onInfo = (_, snapshot) => { if (token === run) render(snapshot, false, onUpdate); };
        const done = await engine.analyze(opts);
        if (token !== run) return;
        render(done, true, onUpdate);
        if (host.onResult) host.onResult(done);
      } catch (e) { if (token === run) el('status').textContent = e.name === 'AbortError' ? 'Analysis cancelled.' : e.message; }
      finally { if (token === run) { el('start').disabled = false; el('stop').disabled = true; } }
    }
    el('start').onclick = start; el('stop').onclick = () => { engine?.stop(); el('status').textContent = 'Stopping…'; };
    el('close').onclick = close;
    el('use').onclick = () => { engine?.stop(); ++run; pinned = null; try { if (host.pause) host.pause('deep-analysis'); setPinned(host.getContext?.()); } catch (e) { el('status').textContent = e.message; } el('start').disabled = !pinned; el('stop').disabled = true; };
    el('save').onclick = () => { if (preview && host.onSaveLine) host.onSaveLine(preview); };
    el('export').onclick = () => {
      if (!result) return;
      const blob = new Blob([JSON.stringify(result, null, 2) + '\n'], { type: 'application/json' });
      const url = URL.createObjectURL(blob), link = doc.createElement('a'); link.href = url;
      link.download = 'Chess_Stockfish_Analysis_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    // Panel keyboard actions never move the main board or reach its shortcuts.
    panel.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    });
    if (trigger) {
      trigger.removeAttribute('aria-haspopup'); trigger.setAttribute('aria-controls', panel.id); trigger.setAttribute('aria-expanded', 'false');
      trigger.addEventListener('click', toggle);
    }
    return { open, close, stop: () => engine?.stop(), destroy() { close(); ++run; engine?.destroy(); previewBoard?.destroy(); trigger?.removeEventListener('click', toggle); panel.remove(); },
      getResult: () => result };
  }
  root.ChessDeepUI = { create };
})(window);
