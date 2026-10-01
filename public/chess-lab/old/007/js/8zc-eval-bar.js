/* CDB position score. White POV; the fill is a visual scale, not a win probability. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChessEvalBar = api;
})(typeof window === 'object' ? window : this, function () {
  const instances = new WeakMap();
  function measure(fen, score, terminal, source = 'CDB') {
    const side = fen.split(' ')[1];
    if (terminal === 'mate') return { label: '#', white: side === 'b' ? 100 : 0,
      description: `Checkmate · ${side === 'b' ? 'White' : 'Black'} wins`, state: 'known' };
    if (terminal === 'draw') return { label: '0.00', white: 50, description: 'Draw', state: 'known' };
    // Deep analysis supplies typed White-POV scores. Preserve mate distance
    // and bounds instead of converting either into a centipawn evaluation.
    if (score && ['cp', 'mate'].includes(score.type) && Number.isFinite(score.white)) {
      const cp = score.white, mate = score.type === 'mate';
      const bound = score.whiteBound === 'lower' ? '≥' : score.whiteBound === 'upper' ? '≤' : '';
      const label = bound + (mate ? (cp < 0 ? '−' : '') + '#' + Math.abs(cp) : (cp > 0 ? '+' : '') + (cp / 100).toFixed(2));
      return { label, white: mate ? (cp < 0 ? 0 : 100) : Math.max(2, Math.min(98, 50 + 50 * Math.tanh(cp / 400))),
        description: `${source} ${label} · White perspective`, state: 'known' };
    }
    if (!Number.isFinite(score)) return { label: '—', white: 50, description: `${source} evaluation unavailable`, state: 'unknown' };
    const cp = score * (side === 'b' ? -1 : 1);
    // CDB decisive/tablebase sentinels are not ordinary centipawns. Do not invent mate distance.
    if (Math.abs(cp) >= 10000) return { label: cp > 0 ? 'W' : 'B', white: cp > 0 ? 100 : 0,
      description: `${source} decisive or mate score for ${cp > 0 ? 'White' : 'Black'} · raw ${score} from side to move`, state: 'known' };
    return { label: (cp > 0 ? '+' : '') + (cp / 100).toFixed(2),
      white: Math.max(2, Math.min(98, 50 + 50 * Math.tanh(cp / 400))),
      description: `${source} ${cp === 0 ? 'equal' : (Math.abs(cp) / 100).toFixed(2) + ' pawns for ' + (cp > 0 ? 'White' : 'Black')} · White perspective`, state: 'known' };
  }
  function create({ game, settings, isVisible, onBadgeAction, getBadgeControl }) {
    const el = document.getElementById('positionEval');
    const label = document.getElementById('positionEvalLabel');
    const scores = new Map();
    const comparison = document.getElementById('allEvalBadges');
    const sourceScores = new Map();
    const dccChoices = new Map();
    const sources = ['CDB', 'SF', 'DCC'];
    let lastKnown = null;
    function renderComparison(fen, visible) {
      if (!comparison?.parentElement) return;
      comparison.hidden = !visible;
      comparison.parentElement.classList.toggle('has-all-evals', true);
      comparison.parentElement.hidden = !visible;
      if (!visible) return;
      comparison.replaceChildren();
      for (const source of sources) {
        const actionable = typeof onBadgeAction === 'function';
        const badge = document.createElement(actionable ? 'button' : 'div'); badge.className = 'all-eval-badge';
        if (actionable) {
          badge.type = 'button'; badge.dataset.evalSource = source;
          badge.addEventListener('click', () => onBadgeAction(source));
          const control = getBadgeControl?.(source);
          badge.disabled = !!control?.disabled;
          badge.title = control?.title || '';
          badge.setAttribute('aria-label', `${source}: ${badge.title || 'analysis'}`);
          badge.classList.toggle('is-working', !!control?.working);
          if (source === 'DCC') {
            badge.setAttribute('aria-pressed', String(!!control?.pressed));
            badge.classList.toggle('is-active', !!control?.pressed);
          }
        }
        const main = document.createElement('div'); main.className = 'all-eval-main';
        const title = document.createElement('strong'); title.textContent = `${source}:`;
        const move = document.createElement('span'); move.className = 'all-eval-move';
        const score = document.createElement('span'); score.className = 'all-eval-score';
        const note = document.createElement('small');
        main.append(title, move);
        if (source === 'DCC') {
          const choice = dccChoices.get(fen);
          move.textContent = choice?.move || (choice?.status === 'pending' ? '…' : '—');
          note.textContent = choice?.provider ? (choice.status === 'raw-safety' ? `${choice.provider} · raw retained` : `${choice.provider} lines · choice`) :
            choice?.status === 'unavailable' ? 'unavailable' : 'heuristic choice';
          if (actionable) badge.setAttribute('aria-label', `DCC: ${move.textContent}. ${badge.title}`);
        } else {
          const entry = sourceScores.get(`${fen}:${source}`);
          const fresh = entry && Date.now() - entry.at < 300000;
          const result = measure(fen, fresh ? entry.score : null, null, source);
          move.textContent = fresh ? entry.bestMove || '—' : '…';
          move.setAttribute('aria-label', `${source} best move ${fresh && entry.bestMove ? entry.bestMove : 'unavailable'}`);
          score.textContent = fresh ? result.label : '…';
          main.append(score);
          if (actionable) badge.setAttribute('aria-label', `${source}: ${move.textContent} ${score.textContent}. ${badge.title}`);
          note.textContent = source === 'SF' && fresh && entry.depth ? `depth ${entry.depth}` : 'White POV';
          if (fresh && entry.restricted) note.textContent += ' · selected moves';
          if (!actionable) badge.title = result.description;
        }
        note.title = note.textContent;
        badge.classList.toggle('is-unknown', move.textContent === '—' || score.textContent === '—');
        badge.append(main, note); comparison.append(badge);
      }
    }
    function render() {
      if (!el) return;
      const fen = game.fen();
      let entry = scores.get(fen);
      if (entry && Date.now() - entry.at > 300000) entry = null;
      const terminal = game.in_checkmate() ? 'mate' : game.in_draw() ? 'draw' : null;
      let view = measure(fen, entry?.score, terminal, entry?.source || settings.analysisSource?.toUpperCase() || 'CDB');
      if (!terminal && !entry) Object.assign(view, { label: '…', state: 'pending', description: 'Waiting for position evaluation' });
      // Keep the last displayed height and number while an asynchronous request
      // for another position is pending. Do not present them as this FEN's score.
      let awaiting = false;
      if (view.state === 'known') lastKnown = { fen, view, source: entry?.source || 'terminal' };
      else if (entry?.settled) lastKnown = null;
      else if (lastKnown) {
        awaiting = true;
        view = { ...lastKnown.view,
          description: `Previous position ${lastKnown.view.label}; awaiting evaluation for the current position` };
      }
      const visible = isVisible();
      renderComparison(fen, visible);
      // Expose which position/source the number actually describes (also while waiting).
      // Some non-browser/unit-test view adapters intentionally omit dataset.
      if (el.dataset) {
        el.dataset.positionFen = fen;
        el.dataset.evalFen = awaiting ? lastKnown.fen : fen;
        el.dataset.evalSource = terminal ? 'terminal' : awaiting ? lastKnown.source : entry?.source || '';
        el.dataset.evalState = awaiting ? 'awaiting' : view.state;
      }
      el.classList.toggle('is-flipped', !!settings.flipBoard);
      el.classList.toggle('is-pending', view.state === 'pending');
      el.classList.toggle('is-unknown', view.state === 'unknown');
      el.classList.toggle('is-awaiting', awaiting);
      el.classList.toggle('is-hidden', !visible);
      el.style.setProperty('--eval-white', view.white + '%');
      el.setAttribute('aria-label', visible ? view.description : 'Position evaluation hidden');
      el.title = visible ? view.description + '. Bar height is a visual scale, not a win probability.' : 'Show Eval to reveal the position evaluation';
      label.textContent = visible ? view.label : '—';
    }
    function update(fen, score, source = 'CDB', settled = false) {
      const deep = source === 'SF' ? sourceScores.get(`${fen}:SF`) : null;
      const preserved = deep?.origin === 'deep' && Date.now() - deep.at < 300000;
      scores.set(fen, { score: preserved ? deep.score : score, source, settled, at: Date.now() });
      if (source === 'CDB' || source === 'SF') updateSource(fen, score, source);
      if (scores.size > 250) scores.delete(scores.keys().next().value);
      // A late response may be cached, but never painted onto a different position.
      if (game.fen() === fen) render();
    }
    function updateSource(fen, score, source, depth = undefined, bestMove = undefined, restricted = undefined, origin = 'regular') {
      const key = `${fen}:${source}`, previous = sourceScores.get(key);
      // A shallower normal search must not replace the user's pinned Deep
      // analysis, even if the main worker ignores a late abort.
      if (source === 'SF' && previous?.origin === 'deep' && origin !== 'deep' &&
          Date.now() - previous.at < 300000 && (!Number.isFinite(depth) || depth < previous.depth)) return;
      // Score-only refreshes must not erase root metadata. Explicit null clears it;
      // unavailable scores also clear omitted metadata rather than retain an old move.
      const known = Number.isFinite(score) || (['cp', 'mate'].includes(score?.type) && Number.isFinite(score.white));
      sourceScores.set(key, { score, at: Date.now(),
        origin,
        depth: depth === undefined ? (known ? previous?.depth ?? null : null) : depth,
        bestMove: bestMove === undefined ? (known ? previous?.bestMove ?? null : null) : bestMove,
        restricted: restricted === undefined ? (depth === undefined && known ? previous?.restricted : false) : restricted });
      if (sourceScores.size > 500) sourceScores.delete(sourceScores.keys().next().value);
      if (game.fen() === fen) render();
    }
    function updateDCC(fen, move, provider, status = 'ready') {
      dccChoices.set(fen, { move, provider, status });
      if (dccChoices.size > 250) dccChoices.delete(dccChoices.keys().next().value);
      if (game.fen() === fen) render();
    }
    function markComparisonPending(fen, holdPrevious = true) {
      if (!holdPrevious) lastKnown = null;
      // A new request for the same position must not expose another mode's old
      // root move, depth or DCC decision while the three sources recalculate.
      const deep = sourceScores.get(`${fen}:SF`);
      const keepDeep = deep?.origin === 'deep' && Date.now() - deep.at < 300000;
      if (keepDeep && settings.analysisSource === 'sf') scores.set(fen, { score: deep.score, source: 'SF', at: Date.now() });
      else scores.delete(fen);
      sourceScores.delete(`${fen}:CDB`);
      if (!keepDeep) sourceScores.delete(`${fen}:SF`);
      dccChoices.set(fen, { move: null, provider: null, status: 'pending' });
      if (dccChoices.size > 250) dccChoices.delete(dccChoices.keys().next().value);
      if (game.fen() === fen) render();
    }
    const api = { render, update, updateSource, updateDCC, markComparisonPending };
    instances.set(game, api);
    return api;
  }
  // Read-only spectator: independent of which engine is playing this turn.
  // One bounded CDB lookup at a time; fast moves coalesce to the displayed FEN.
  // Never await this observer from the runner or create another SF search.
  function watchSimulation({ Chess, game, getCDB, view = instances.get(game) }) {
    if (!view || typeof getCDB !== 'function') return null;
    let active = false, current = null, queued = null, inFlight = false;
    const live = item => active && item === current && item.fen === game.fen();
    function san(fen, move) {
      try {
        if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move || '')) return null;
        return new Chess(fen).move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] })?.san || null;
      } catch (_) { return null; }
    }
    function paint(item, score, source, move, depth) {
      if (!live(item)) return;
      view.updateSource(item.fen, score, source, depth, san(item.fen, move), false, 'simulation');
      view.update(item.fen, score, source, true);
    }
    function unavailable(item) {
      if (!live(item) || item.cdbKnown) return;
      item.cdbSettled = true;
      view.updateSource(item.fen, null, 'CDB');
      if (item.sf) paint(item, item.sf.score, 'SF', item.sf.move, item.sf.depth);
      else view.update(item.fen, null, 'CDB', true);
    }
    async function pump() {
      if (inFlight || !queued || !active) return;
      const item = queued; queued = null; inFlight = true;
      try {
        // No actor AbortSignal: cachedFetchChessDB uses a separate pending key
        // for signalled player requests, so spectator lifetime cannot abort a turn.
        const result = await getCDB(item.fen, { timeoutMs: 3500 });
        if (!live(item) || item.cdbKnown) return;
        const best = result?.fen && result.fen !== item.fen ? null :
          result?.moves?.find(row => Number.isFinite(row.score) && san(item.fen, row.move));
        if (best) {
          item.cdbKnown = true; item.cdbSettled = true;
          paint(item, best.score, 'CDB', best.move, best.depth);
        } else unavailable(item);
      } catch (_) {
        // A failed spectator lookup is not a failed game and never means 0.00.
        unavailable(item);
      } finally {
        inFlight = false;
        // A stale request must not paint a later position or a resumed same-FEN run.
        void pump();
      }
    }
    function position() {
      if (!active || current?.fen === game.fen()) return;
      current = { fen: game.fen(), cdbKnown: false, cdbSettled: false, sf: null };
      queued = null;
      view.markComparisonPending(current.fen, false);
      if (game.game_over()) { view.render(); return; }
      queued = current;
      void pump();
    }
    function start() { stop(); active = true; position(); }
    function stop() { active = false; current = null; queued = null; }
    function decision(value) {
      const item = current, pick = value?.pick;
      if (!item || !live(item) || value.fen !== item.fen || !pick || !san(item.fen, pick.raw_best)) return;
      const source = pick.actual_provider || pick.provider;
      if (source === 'CDB' && Number.isFinite(pick.raw_best_score)) {
        item.cdbKnown = true; item.cdbSettled = true;
        paint(item, pick.raw_best_score, 'CDB', pick.raw_best);
      } else if (source === 'SF') {
        const score = pick.score_type === 'mate'
          ? (Number.isFinite(pick.raw_best_mate_in) ? { type: 'mate', white: pick.raw_best_mate_in * (item.fen.split(' ')[1] === 'b' ? -1 : 1) } : null)
          : pick.raw_best_score;
        if (score == null || (!Number.isFinite(score) && !Number.isFinite(score.white))) return;
        item.sf = { score, move: pick.raw_best, depth: pick.root_depth };
        view.updateSource(item.fen, score, 'SF', pick.root_depth, san(item.fen, pick.raw_best), false, 'simulation');
        // Reuse the current player's result while CDB is pending/unavailable;
        // never replace a current CDB score with a shallow SF score.
        if (!item.cdbKnown) paint(item, score, 'SF', pick.raw_best, pick.root_depth);
      }
    }
    return { start, position, decision, stop };
  }
  return { measure, create, watchSimulation };
});
