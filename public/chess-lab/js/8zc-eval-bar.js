/* CDB position score. White POV; the fill is a visual scale, not a win probability. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChessEvalBar = api;
})(typeof window === 'object' ? window : this, function () {
  const instances = new WeakMap();
  // Display-only Lc0 v0.32.1 WDL_mu, with no contempt or WDL rescaling.
  // Upstream: fd71a2d921b689c5f479d3227c3806c8e272d9c5,
  // src/search/classic/search.cc (WDLRescale / Search::SendUciInfo).
  // Native Q/WDL remain the evidence; this is an approximate display scale.
  // WDL routines adapt code by The LCZero Authors, GPL-3.0-or-later.
  // Corresponding source is pinned above; license is distributed at
  // engines/lc0/v0.32.1-maia1900-r8/GPL-3.0.txt.
  const f32 = Math.fround, floatBits = new DataView(new ArrayBuffer(4));
  function fastLog(a) {
    floatBits.setFloat32(0, a, true);
    const bits = floatBits.getUint32(0, true), exponent = bits >>> 23;
    floatBits.setUint32(0, (bits & 0x7fffff) | (0x7f << 23), true);
    const x = f32(floatBits.getFloat32(0, true) - 1);
    const log2 = f32(f32(f32(x * f32(f32(1.3465552) - f32(f32(0.34655523) * x))) - 127) + exponent);
    return f32(f32(0.6931471805599453) * log2);
  }
  function fastLogistic(a) {
    if (a > 20) return 1;
    if (a < -20) return 0;
    const x = f32(f32(1.442695040) * f32(-a));
    if (x < -126) return 1;
    const exponent = Math.trunc(x < 0 ? f32(x - 1) : x), fraction = f32(x - exponent);
    const mantissa = f32(1 + f32(fraction * f32(f32(0.6602339) + f32(f32(0.33976606) * fraction))));
    floatBits.setFloat32(0, mantissa, true);
    floatBits.setInt32(0, (floatBits.getInt32(0, true) + (exponent << 23)) | 0, true);
    return f32(1 / f32(1 + floatBits.getFloat32(0, true)));
  }
  function validWdl(wdl) {
    if (!Array.isArray(wdl) || wdl.length !== 3 || wdl.some(p => !Number.isFinite(p) || p < 0 || p > 1)) return null;
    const sum = wdl.reduce((a, b) => a + b, 0);
    return Math.abs(sum - 1) <= 0.0001 ? wdl.map(p => p / sum) : null;
  }
  function neuralScore(q, wdl) {
    if (!Number.isFinite(q) || Math.abs(q) > 1) return null;
    let probabilities = validWdl(wdl);
    if (probabilities && Math.abs(probabilities[0] - probabilities[2] - q) > 0.0001) probabilities = null;
    // The native WDL_mu fallback is finite even at neural Q endpoints.
    let wl = f32(q), draw = probabilities ? f32(probabilities[1]) : 0, mu = 0;
    let unstable = false;
    let method = probabilities ? 'WDL_mu fallback' : 'Q fallback';
    if (probabilities) {
      const w = f32(f32(f32(1 + wl) - draw) / 2), l = f32(f32(f32(1 - wl) - draw) / 2), eps = f32(0.0001);
      if ([w, draw, l].every(p => p > eps && p < f32(1 - eps))) {
        const a = fastLog(f32(f32(1 / l) - 1)), b = fastLog(f32(f32(1 / w) - 1));
        const sum = f32(a + b), scale = f32(2 / sum);
        mu = f32(f32(a - b) / sum);
        // Native FastLog can reverse mu at extremely broad distributions.
        // A display conversion must never reverse the sign of measured Q.
        unstable = !Number.isFinite(mu) || !Number.isFinite(scale) || scale <= 0 || (mu !== 0 && Math.sign(mu) !== Math.sign(q));
        if (!unstable) {
          const wNew = fastLogistic(f32(f32(-1 + mu) / scale)), lNew = fastLogistic(f32(f32(-1 - mu) / scale));
          wl = f32(wNew - lNew); draw = Math.max(0, f32(f32(1 - wNew) - lNew));
        }
      }
    }
    let value = f32(45 * Math.tan(1.56728071628 * wl));
    if (unstable) method = 'Q fallback (unstable WDL)';
    else if (probabilities && mu !== 0 && f32(Math.abs(wl) + draw) < f32(0.996) &&
        (Math.abs(mu) < 1 || Math.abs(value) < Math.abs(f32(100 * mu)))) {
      value = f32(100 * mu); method = 'WDL_mu';
    }
    // Native UCI emits integer cp by truncation. Endpoints do not prove mate.
    const cp = Math.trunc(value) || 0;
    const wdlLabel = probabilities ? probabilities.map((p, i) => ['win', 'draw', 'loss'][i] + ' ' + (100 * p).toFixed(1) + '%').join(' · ') : 'W/D/L unavailable';
    return { cp, method, wdl: probabilities, wdlLabel,
      description: `approximately ${cp} cp (${method}); native neural Q ${q.toFixed(3)} · ${wdlLabel}` };
  }
  function qToCp(q) {
    return neuralScore(q, null)?.cp ?? null;
  }
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
    if (score?.type === 'q') {
      const rootWdl = validWdl(score.wdl);
      const wdl = validWdl(score.wdlWhite) || (rootWdl && (side === 'b' ? [rootWdl[2], rootWdl[1], rootWdl[0]] : rootWdl));
      const neural = neuralScore(score.white, wdl);
      if (!neural) return { label: '—', white: 50, description: `${source} evaluation unavailable`, state: 'unknown' };
      const cp = neural.cp;
      const label = (cp > 0 ? '+' : '') + (cp / 100).toFixed(2);
      return { label, white: Math.max(2, Math.min(98, 50 + 50 * Math.tanh(cp / 400))),
        description: `${source} ${neural.description} · White perspective · model estimates`, state: 'known', neural };
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
    const dccProgress = document.getElementById('dccProgress');
    const sourceScores = new Map();
    const dccChoices = new Map();
    const sources = ['CDB','SF','DCC','RLE','LC0','BER'];
    const names={CDB:'ChessDB',SF:'Stockfish',DCC:'ChessDCC',RLE:'Reckless',LC0:'LC Zero',BER:'Berserk'};
    const cards = new Map();
    function cardNodes(source) {
      if (cards.has(source)) return cards.get(source);
      const actionable = typeof onBadgeAction === 'function';
      const badge = document.createElement(actionable ? 'button' : 'div');
      badge.className = 'all-eval-badge'; badge.dataset.evalSource = source;
      if (actionable) {
        let stopOnly = false;
        badge.type = 'button';
        badge.addEventListener('pointerdown', () => { stopOnly = !!getBadgeControl?.(source)?.working; });
        badge.addEventListener('pointercancel', () => { stopOnly = false; });
        badge.addEventListener('click', () => { const intent = stopOnly; stopOnly = false; onBadgeAction(source, { stopOnly: intent }); });
      }
      const main = document.createElement('div'); main.className = 'all-eval-main';
      const title = document.createElement('strong'); title.textContent = names[source];
      const move = document.createElement('span'); move.className = 'all-eval-move';
      const score = document.createElement('span'); score.className = 'all-eval-score';
      const note = document.createElement('small');
      main.append(title, move); if (source !== 'DCC') main.append(score);
      if (source === 'DCC' && dccProgress) note.append(dccProgress);
      badge.append(main, note); comparison.append(badge);
      const nodes = { badge, main, title, move, score, note }; cards.set(source, nodes); return nodes;
    }
    let lastKnown = null, batchDepth = 0, paintPending = false;
    function renderComparison(fen, visible) {
      if (!comparison?.parentElement) return;
      comparison.hidden = !visible;
      comparison.parentElement.classList.toggle('has-all-evals', true);
      comparison.parentElement.hidden = !visible;
      if (!visible) return;
      // Keep buttons (and their children) alive across native engine info events.
      // Replacing a touch target between pointer-down and pointer-up can lose Stop.
      for (const source of sources) {
        const actionable = typeof onBadgeAction === 'function';
        const placeholder=source==='RLE'?!globalThis.ChessEngineRegistry?.supported('reckless'):source==='LC0'?!globalThis.ChessEngineRegistry?.supported('lc0'):false;
        const enabled=source==='CDB'?settings.cdbEnabled!==false:!placeholder;
        const control=getBadgeControl?.(source);
        const { badge, move, score, note } = cardNodes(source);
        if (actionable) {
          badge.disabled = placeholder || !!control?.disabled;
          badge.title = control?.title || '';
          badge.setAttribute('aria-label', `${source}: ${badge.title || 'analysis'}`);
          badge.classList.toggle('is-working', !!control?.working);
          badge.classList.toggle('is-batch-running', !!control?.allRunning);
          badge.classList.toggle('is-batch-participant', !!control?.batchParticipant);
          badge.classList.toggle('is-linked', !!control?.selected && !control?.allRunning);
          badge.setAttribute('aria-current', control?.selected ? 'true' : 'false');
          if (source === 'DCC') {
            badge.setAttribute('aria-pressed', String(!!control?.pressed));
            badge.classList.toggle('is-active', !!control?.pressed);
          }
        }
        if (source === 'DCC') {
          const choice = dccChoices.get(fen);
          move.textContent = choice?.move || (choice?.status === 'pending' ? '…' : '—');
          const progress = dccProgress;
          if(progress){
            if(progress.dataset.fen!==fen){progress.textContent='';progress.title='No measured evidence available';progress.dataset.fen=fen;}
            if(!progress.textContent)progress.textContent=choice?.status==='pending'?'Analyzing':'No data';
          }else note.textContent=choice?.status==='pending'?'Analyzing':choice?.status==='raw-safety'?'Raw choice':choice?.provider?'Measured':'No data';
          note.title = `${dccProgress?.title || note.textContent}${choice?.provider ? ' · ' + choice.provider : ''}${choice?.status==='raw-safety'?' · raw choice retained; insufficient measured evidence':''}`;
          if (actionable) badge.setAttribute('aria-label', `ChessDCC: ${move.textContent}. ${note.title}. ${badge.title}`);
        } else {
          const entry = sourceScores.get(`${fen}:${source}`);
          const fresh = enabled && entry && Date.now() - entry.at < 300000 &&
            (source !== 'SF' || !control?.variant || !entry.variant || control.variant === entry.variant);
          const result = measure(fen, fresh ? entry.score : null, null, source);
          move.textContent = placeholder || !enabled ? '—' : fresh ? entry.bestMove || '—' : '…';
          move.setAttribute('aria-label', `${source} best move ${fresh && entry.bestMove ? entry.bestMove : 'unavailable'}`);
          score.textContent = placeholder || !enabled ? '—' : fresh ? result.label : '…';
          score.title = fresh && entry.score?.type === 'q' ? result.description : '';
          if (actionable) badge.setAttribute('aria-label', `${source}: ${move.textContent} ${score.textContent}. ${badge.title}`);
          note.textContent = placeholder ? 'Unavailable in this release' : !enabled ? 'Disabled' : control?.note ||
            (fresh && entry.depth ? `depth ${entry.depth}` : source==='CDB'?fresh&&(Number.isFinite(entry.score)||entry.bestMove)?'Position data':'No position data':'Ready');
          if(source==='SF')note.textContent=(control?.variant||entry?.variant||'Lite')+' · '+note.textContent;
          if (fresh && entry.restricted) note.textContent += ' · selected moves';
          if (!actionable) badge.title = result.description;
        }
        if (source !== 'DCC') note.title = note.textContent;
        if (actionable) {
          badge.title = [control?.title, note.title, source !== 'DCC' ? score.title : ''].filter(Boolean).join('. ');
          badge.setAttribute('aria-label', `${names[source]}: ${move.textContent}${source==='DCC'?'':' '+score.textContent}. ${badge.title}`);
        }
        badge.classList.toggle('is-unknown', move.textContent === '—' || score.textContent === '—');
      }
    }
    function render() {
      if (batchDepth) { paintPending = true; return; }
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
      if (source === 'CDB' || source === 'SF' || source === 'BER' || source === 'RLE' || source === 'LC0') updateSource(fen, score, source);
      if (scores.size > 250) scores.delete(scores.keys().next().value);
      // A late response may be cached, but never painted onto a different position.
      if (game.fen() === fen) render();
    }
    function updateSource(fen, score, source, depth = undefined, bestMove = undefined, restricted = undefined, origin = 'regular', metadata = {}) {
      const key = `${fen}:${source}`, previous = sourceScores.get(key);
      // A shallower normal search must not replace the user's pinned Deep
      // analysis, even if the main worker ignores a late abort.
      if (source === 'SF' && previous?.origin === 'deep' && origin !== 'deep' &&
          Date.now() - previous.at < 300000 && (!Number.isFinite(depth) || depth < previous.depth)) return;
      // Score-only refreshes must not erase root metadata. Explicit null clears it;
      // unavailable scores also clear omitted metadata rather than retain an old move.
      const known = Number.isFinite(score) || (['cp', 'mate','q'].includes(score?.type) && Number.isFinite(score.white));
      sourceScores.set(key, { score, at: Date.now(),
        origin, variant:metadata.variant||previous?.variant, engineName:metadata.engineName||previous?.engineName,
        depth: depth === undefined ? (known ? previous?.depth ?? null : null) : depth,
        bestMove: bestMove === undefined ? (known ? previous?.bestMove ?? null : null) : bestMove,
        restricted: restricted === undefined ? (depth === undefined && known ? previous?.restricted : false) : restricted });
      if (sourceScores.size > 500) sourceScores.delete(sourceScores.keys().next().value);
      if (game.fen() === fen) render();
    }
    function updateDCC(fen, move, provider, status = 'ready') {
      const previous = dccChoices.get(fen);
      if (status === 'pending' && previous?.move) { move = previous.move; provider = previous.provider; }
      dccChoices.set(fen, { move, provider, status });
      if(dccProgress&&game.fen()===fen){dccProgress.dataset.fen=fen;
        if(status==='pending'){dccProgress.textContent='Analyzing';dccProgress.title='Analyzing measured DCC candidates';}
        else if(status==='unavailable'||status==='unknown'){dccProgress.textContent='No data';dccProgress.title='No measured evidence available';}
      }
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
      // Independent card results stay available when only the board source changes.
      if (!dccChoices.has(fen)) dccChoices.set(fen, { move: null, provider: null, status: 'pending' });
      if (dccChoices.size > 250) dccChoices.delete(dccChoices.keys().next().value);
      if (game.fen() === fen) render();
    }
    function clearLocalSources(fen) {
      for(const role of ['SF','BER','RLE','LC0'])sourceScores.delete(`${fen}:${role}`);
      if(['SF','BER','RLE','LC0'].includes(scores.get(fen)?.source))scores.delete(fen);
      lastKnown=null;if(game.fen()===fen)render();
    }
    function batch(update) {
      batchDepth++;
      try { return update(); }
      finally {
        batchDepth--;
        if (!batchDepth && paintPending) { paintPending = false; render(); }
      }
    }
    const api = { render, batch, update, updateSource, updateDCC, markComparisonPending, clearLocalSources,
      clearDCC(fen){dccChoices.delete(fen);if(dccProgress&&game.fen()===fen){dccProgress.textContent='';dccProgress.title='No measured evidence available';}if(game.fen()===fen)render();},
      clearBoard(fen){scores.delete(fen);lastKnown=null;if(game.fen()===fen)render();} };
    instances.set(game, api);
    return api;
  }
  // Read-only spectator: independent of which engine is playing this turn.
  // One bounded CDB lookup at a time; fast moves coalesce to the displayed FEN.
  // Never await this observer from the runner or create another SF search.
  function watchSimulation({ Chess, game, getCDB, view = instances.get(game), enabled = () => true }) {
    if (!view || typeof getCDB !== 'function') return null;
    let active = false, current = null, queued = null, inFlight = false;
    const live = item => active && enabled() && item === current && item.fen === game.fen();
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
      if (item.local) paint(item, item.local.score, item.local.source, item.local.move, item.local.depth);
      else view.update(item.fen, null, 'CDB', true);
    }
    async function pump() {
      if (inFlight || !queued || !active || !enabled()) return;
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
      if (!active) return;
      if (!enabled()) { current = null; queued = null; view.render(); return; }
      if (current?.fen === game.fen()) return;
      current = { fen: game.fen(), cdbKnown: false, cdbSettled: false, local: null };
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
      } else if (['SF','BER','RLE','LC0'].includes(source)) {
        const score = pick.native_score || (pick.score_type === 'mate'
          ? (Number.isFinite(pick.raw_best_mate_in) ? { type: 'mate', white: pick.raw_best_mate_in * (item.fen.split(' ')[1] === 'b' ? -1 : 1) } : null)
          : pick.raw_best_score);
        if (score == null || (!Number.isFinite(score) && !Number.isFinite(score.white))) return;
        item.local = { score, source, move: pick.raw_best, depth: pick.root_depth };
        view.updateSource(item.fen, score, source, pick.root_depth, san(item.fen, pick.raw_best), false, 'simulation');
        // Reuse the current player's result while CDB is pending/unavailable;
        // never replace a current CDB score with a shallow SF score.
        if (!item.cdbKnown) paint(item, score, source, pick.raw_best, pick.root_depth);
      }
    }
    function refresh() {
      if (!active) return;
      if (!enabled()) { current = null; queued = null; view.render(); }
      else { position(); view.render(); }
    }
    return { start, position, decision, stop, refresh };
  }
  return { measure, qToCp, neuralScore, create, watchSimulation };
});
