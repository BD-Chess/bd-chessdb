/* CDB position score. White POV; the fill is a visual scale, not a win probability. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChessEvalBar = api;
})(typeof window === 'object' ? window : this, function () {
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
  function create({ game, settings, isVisible }) {
    const el = document.getElementById('positionEval');
    const label = document.getElementById('positionEvalLabel');
    const scores = new Map();
    const comparison = document.getElementById('allEvalBadges');
    const sourceScores = new Map();
    const dccChoices = new Map();
    const sources = ['CDB', 'SF', 'DCC'];
    function renderComparison(fen, visible) {
      if (!comparison?.parentElement) return;
      const selectedAll = settings.analysisSource === 'all';
      const all = selectedAll && visible;
      comparison.hidden = !all;
      comparison.parentElement.classList.toggle('has-all-evals', selectedAll);
      comparison.parentElement.hidden = selectedAll && !visible;
      if (!all) return;
      comparison.replaceChildren();
      for (const source of sources) {
        const badge = document.createElement('div'); badge.className = 'all-eval-badge';
        const title = document.createElement('strong'); title.textContent = source;
        const value = document.createElement('span'); const note = document.createElement('small');
        badge.append(title);
        if (source === 'DCC') {
          const choice = dccChoices.get(fen);
          value.textContent = choice?.move || (choice?.status === 'pending' ? '…' : '—');
          note.textContent = choice?.provider ? (choice.status === 'raw-safety' ? `${choice.provider} · raw retained` : `${choice.provider} lines · choice`) : 'heuristic choice';
        } else {
          const entry = sourceScores.get(`${fen}:${source}`);
          const fresh = entry && Date.now() - entry.at < 300000;
          const result = measure(fen, fresh ? entry.score : null, null, source);
          const topMove = document.createElement('span'); topMove.className = 'all-eval-move';
          topMove.textContent = fresh ? entry.bestMove || '—' : '…';
          topMove.setAttribute('aria-label', `${source} best move ${fresh && entry.bestMove ? entry.bestMove : 'unavailable'}`);
          badge.append(topMove);
          value.textContent = fresh ? result.label : '…';
          note.textContent = source === 'SF' && fresh && entry.depth ? `depth ${entry.depth}` : 'White POV';
          if (fresh && entry.restricted) note.textContent += ' · selected moves';
          badge.title = result.description;
        }
        badge.classList.toggle('is-unknown', value.textContent === '—');
        badge.append(value, note); comparison.append(badge);
      }
    }
    function render() {
      if (!el) return;
      const fen = game.fen();
      let entry = scores.get(fen);
      if (entry && Date.now() - entry.at > 300000) entry = null;
      const terminal = game.in_checkmate() ? 'mate' : game.in_draw() ? 'draw' : null;
      const view = measure(fen, entry?.score, terminal, entry?.source || settings.analysisSource?.toUpperCase() || 'CDB');
      if (!terminal && !entry) Object.assign(view, { label: '…', state: 'pending', description: 'Waiting for position evaluation' });
      const visible = isVisible();
      renderComparison(fen, visible);
      el.classList.toggle('is-flipped', !!settings.flipBoard);
      el.classList.toggle('is-pending', view.state === 'pending');
      el.classList.toggle('is-unknown', view.state === 'unknown');
      el.classList.toggle('is-hidden', !visible);
      el.style.setProperty('--eval-white', view.white + '%');
      el.setAttribute('aria-label', visible ? view.description : 'Position evaluation hidden');
      el.title = visible ? view.description + '. Bar height is a visual scale, not a win probability.' : 'Show Eval to reveal the position evaluation';
      label.textContent = visible ? view.label : '—';
    }
    function update(fen, score, source = 'CDB') {
      scores.set(fen, { score, source, at: Date.now() });
      if (source === 'CDB' || source === 'SF') updateSource(fen, score, source);
      if (scores.size > 250) scores.delete(scores.keys().next().value);
      // A late response may be cached, but never painted onto a different position.
      if (game.fen() === fen) render();
    }
    function updateSource(fen, score, source, depth = undefined, bestMove = undefined, restricted = undefined) {
      const key = `${fen}:${source}`, previous = sourceScores.get(key);
      // Score-only refreshes must not erase root metadata. Explicit null clears it;
      // unavailable scores also clear omitted metadata rather than retain an old move.
      const known = Number.isFinite(score) || (['cp', 'mate'].includes(score?.type) && Number.isFinite(score.white));
      sourceScores.set(key, { score, at: Date.now(),
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
    return { render, update, updateSource, updateDCC };
  }
  return { measure, create };
});
