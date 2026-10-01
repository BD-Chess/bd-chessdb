/* Game Review is a read-only guide to the recorded line. The board and Study
   remain owned by the LAB host; no new engine requests or stored records here. */
(function (root) {
  'use strict';

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value != null) node.textContent = String(value);
    return node;
  }

  function start() {
    const button = document.getElementById('btnGameReview');
    const controls = document.getElementById('controls');
    const host = root.ChessLabHost;
    if (!button || !controls || !host || !root.ChessGameReview) return;

    const panel = element('section', 'workspace-drawer game-review-drawer');
    panel.id = 'gameReviewPanel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'gameReviewHeading');
    panel.tabIndex = -1;
    const header = element('div', 'drawer-heading game-review-heading');
    const heading = element('h2', '', 'Game review');
    heading.id = 'gameReviewHeading';
    const close = element('button', 'btn', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close game review');
    header.append(heading, close);
    const body = element('div', 'game-review-content');
    const notice = element('p', 'game-review-notice');
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    panel.append(header, body, notice);
    controls.appendChild(panel);

    let review = null;
    let snapshot = null;
    let previousKey = '';
    let previousCursor = null;
    let previousBlocked = null;
    let refreshFrame = 0;

    const blocked = () => Boolean(snapshot?.blocked);
    function focusAfterClose() {
      if (button.getClientRects().length) button.focus({ preventScroll: true });
      else document.getElementById('first')?.focus({ preventScroll: true });
    }
    function closePanel(restoreFocus = true) {
      if (panel.hidden) return;
      panel.hidden = true;
      panel.classList.remove('open');
      button.setAttribute('aria-expanded', 'false');
      if (restoreFocus) focusAfterClose();
    }

    function positionLabel(ply) {
      if (ply === review?.totalPly) return 'Final recorded position';
      const next = review?.positions?.[ply + 1];
      return next?.moveLabel ? 'Before ' + next.moveLabel : 'After ' + ply + ' half-moves';
    }

    function navigate(ply, openStudy = false) {
      if (blocked()) {
        notice.textContent = 'Finish the active game or stop Replay before reviewing a position.';
        return;
      }
      const expected = review?.positions?.[ply];
      if (!expected || !Number.isSafeInteger(ply)) {
        notice.textContent = 'This position is unavailable in the current line.';
        return;
      }
      try {
        host.navigateReview(ply);
        const at = host.getContext();
        if (at.fen !== expected.fen || at.history?.length !== ply) throw Error('The current line changed. Reopen Review and try again.');
        closePanel(!openStudy);
        if (openStudy) {
          if (typeof host.openReviewStudy === 'function') host.openReviewStudy('compare');
          else document.getElementById('btnStudy')?.click();
        } else if (root.matchMedia?.('(max-width: 790px)')?.matches) {
          document.getElementById('board-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } catch (error) {
        notice.textContent = error?.message || 'Could not open this position. The board was kept.';
      }
    }

    function action(label, callback, className) {
      const item = element('button', 'btn ' + (className || ''), label);
      item.type = 'button';
      item.disabled = blocked();
      item.addEventListener('click', callback);
      return item;
    }

    function addFact(container, label, value) {
      if (!value) return;
      const item = element('div', 'game-review-fact');
      item.append(element('dt', '', label), element('dd', '', value));
      container.append(item);
    }

    function renderSummary() {
      const h = review.headers || {};
      const name = [h.White, h.Black].every(v => v && v !== '?' && v !== 'Book')
        ? `${h.White} vs ${h.Black}` : h.ChessBestTitle || h.Event || 'Current recorded line';
      const intro = element('div', 'game-review-intro');
      intro.append(element('h3', '', name));
      intro.append(element('p', 'game-review-subtitle',
        [h.Event && h.Event !== name ? h.Event : '', h.Date && h.Date !== '?' ? h.Date : '', h.Result && h.Result !== '*' ? h.Result : ''].filter(Boolean).join(' · ') || `${review.totalPly} recorded half-moves`));
      if (snapshot.lineChanged) intro.append(element('p', 'game-review-line-note', 'Current explored line. Original PGN markers and end-of-game details no longer apply to this branch.'));
      else if (h.ChessBestTeaser && snapshot.sourceIsOriginal) intro.append(element('p', 'game-review-teaser', h.ChessBestTeaser));
      body.append(intro);

      const facts = element('dl', 'game-review-facts');
      if (review.tcec?.isTcec && !snapshot.lineChanged) {
        addFact(facts, 'White engine', review.tcec.engineWhite);
        addFact(facts, 'Black engine', review.tcec.engineBlack);
        addFact(facts, 'Opening', review.tcec.opening);
        addFact(facts, 'Round', review.tcec.round);
        addFact(facts, 'Termination', [review.tcec.termination, review.tcec.terminationDetails].filter(Boolean).join(' · '));
      } else if (h.Opening && !snapshot.lineChanged) addFact(facts, 'Opening', h.Opening);
      if (facts.childElementCount) body.append(facts);
    }

    function renderTimeline() {
      const section = element('section', 'game-review-timeline');
      section.setAttribute('aria-label', 'Recorded game navigation');
      section.append(element('h3', '', 'Recorded line'));
      const sub = element('p', 'game-review-subtitle', `${review.totalPly} half-moves · choose any position`);
      section.append(sub);
      const sliderLabel = element('label', 'game-review-scrub-label', positionLabel(Math.min(snapshot.cursor ?? 0, review.totalPly)));
      sliderLabel.htmlFor = 'gameReviewScrub';
      const slider = element('input', 'game-review-scrub');
      slider.type = 'range';
      slider.id = 'gameReviewScrub';
      slider.min = '0';
      slider.max = String(review.totalPly);
      slider.step = '1';
      slider.value = String(Math.min(Math.max(snapshot.cursor ?? 0, 0), review.totalPly));
      slider.disabled = blocked() || !review.totalPly;
      slider.setAttribute('aria-label', 'Select a position in the recorded game');
      slider.addEventListener('input', () => { sliderLabel.textContent = positionLabel(Number(slider.value)); });
      slider.addEventListener('change', () => navigate(Number(slider.value)));
      section.append(sliderLabel, slider);
      const controls = element('div', 'game-review-actions');
      controls.append(action('First position', () => navigate(0)), action('Final position', () => navigate(review.totalPly)));
      section.append(controls);
      body.append(section);
    }

    function san(fen, uci) {
      if (typeof uci !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return uci || '—';
      try {
        const board = new root.Chess(fen);
        return board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }, { sloppy: true })?.san || uci;
      } catch (_) { return uci; }
    }

    function whiteScore(fen, move) {
      if (!move) return 'score unknown';
      const whiteSign = fen.split(' ')[1] === 'b' ? -1 : 1;
      if (move.scoreType === 'mate' && Number.isFinite(move.mateIn)) {
        const mate = move.mateIn * whiteSign;
        return `${mate < 0 ? '−' : ''}#${Math.abs(mate)}`;
      }
      if (!Number.isFinite(move.score)) return 'score unknown';
      const value = move.score * whiteSign;
      if (Math.abs(value) >= 10000) return `${value < 0 ? 'B' : 'W'} decisive / mate (distance unknown)`;
      const direction = move.bound === 'lower' || move.bound === 'upper'
        ? ((move.bound === 'lower') === (whiteSign === 1) ? '≥' : '≤') : '';
      return direction + (value > 0 ? '+' : '') + (value / 100).toFixed(2);
    }

    function renderRecordedComparison(target, context, fen) {
      if (snapshot.cursor >= review.totalPly) return;
      const played = review.moves[snapshot.cursor];
      if (!played) return;
      const block = element('div', 'game-review-played');
      block.append(element('h4', '', 'Recorded move vs source choice'));
      block.append(element('p', '', `Next in PGN: ${review.positions[snapshot.cursor + 1]?.moveLabel || san(fen, played)}`));
      for (const role of ['CDB', 'SF']) {
        const data = context.analysisSources?.[role];
        const receipt = data?.receipt;
        if (!data || receipt?.fen !== fen) {
          block.append(element('p', '', `${role}: current-position candidates unknown.`));
          continue;
        }
        const best = data.allMoves?.[0];
        const recorded = data.allMoves?.find(item => item.move === played);
        if (!best?.move) {
          block.append(element('p', '', `${role}: no candidate move recorded for this position.`));
          continue;
        }
        let comparison = 'played move score unknown';
        const exactCp = move => move && Number.isFinite(move.score) && Math.abs(move.score) < 10000 &&
          (move.scoreType === 'cp' || (role === 'CDB' && !move.scoreType)) &&
          !['lower', 'upper'].includes(move.bound);
        if (exactCp(best) && exactCp(recorded)) {
          const difference = best.score - recorded.score;
          comparison = difference >= 0 ? `${difference} cp below first returned candidate (mover POV)` :
            'returned order and scores disagree; gap unknown';
        }
        block.append(element('p', '', `${role}: first ${san(fen, best.move)} · ${comparison}.`));
      }
      const dcc = context.analysisSources?.DCC;
      if (dcc?.receipt?.fen === fen && dcc.dcc1Move)
        block.append(element('p', '', `DCC: ${san(fen, dcc.dcc1Move)} · ${dcc.receipt.status || 'status unknown'}; heuristic ranking or raw fallback, no cp gap.`));
      target.append(block);
    }

    function renderSources() {
      const target = body.querySelector('.game-review-sources');
      if (!target || !review || !snapshot) return;
      const focusedAction = target.contains(document.activeElement) && document.activeElement.closest('.game-review-actions');
      target.replaceChildren(element('h3', '', 'Current board · available source snapshots'));
      const context = host.getContext();
      const fen = review.positions?.[snapshot.cursor]?.fen;
      if (!fen || fen !== context.fen || context.history?.length !== snapshot.cursor) {
        target.append(element('p', 'game-review-subtitle', 'The board changed; reopen Review to match the current line.'));
        return;
      }
      const cards = element('div', 'game-review-source-cards');
      for (const role of ['CDB', 'SF', 'DCC']) {
        const card = element('div', 'game-review-source-card');
        card.append(element('strong', '', role));
        const measured = context.analysisSources?.[role];
        const receipt = measured?.receipt;
        if (!measured || receipt?.fen !== fen) {
          card.append(element('span', '', '—'), element('small', '', 'No current snapshot'));
        } else if (role === 'DCC') {
          const choice = measured.dcc1Move;
          const candidate = measured.candidates?.find(item => (item.move || item.uci) === choice);
          card.append(element('span', '', choice ? san(fen, choice) : '—'));
          card.append(element('small', '', [receipt.provider ? `${receipt.provider} lines` : 'Source unknown',
            !choice ? receipt.status || 'choice unavailable' : candidate?.data && Number.isFinite(candidate.data.dccScore) ? `heuristic ${candidate.data.dccScore.toFixed(1)}` : 'raw choice / heuristic unknown',
            Number.isFinite(receipt.completed) && Number.isFinite(receipt.total) ? `${receipt.completed}/${receipt.total} sampled` : ''].filter(Boolean).join(' · ')));
        } else {
          const best = measured.allMoves?.[0];
          card.append(element('span', '', best?.move ? `${san(fen, best.move)} · ${whiteScore(fen, best)}` : '—'));
          card.append(element('small', '', [receipt.source || receipt.provider || role,
            Number.isFinite(receipt.depth) ? `depth ${receipt.depth}` : '',
            receipt.providerPositionContext === 'fen-only' ? 'FEN only' : '',
            'White POV'].filter(Boolean).join(' · ')));
        }
        cards.append(card);
      }
      target.append(cards);
      renderRecordedComparison(target, context, fen);
      target.append(element('p', 'game-review-subtitle', 'These readings belong only to the board position above. DCC rank is a heuristic, never a centipawn score. Missing snapshots stay unknown.'));
      const actions = element('div', 'game-review-actions');
      actions.append(action('Study / A-B this position', () => navigate(snapshot.cursor, true)));
      target.append(actions);
      if (focusedAction) actions.querySelector('button')?.focus({ preventScroll: true });
    }

    function renderMoments() {
      const section = element('section', 'game-review-moments');
      section.append(element('h3', '', 'Places to investigate'));
      const moments = review.moments || [];
      if (!moments.length) {
        section.append(element('p', 'game-review-empty', 'No recorded highlights in this line. Use the slider or move history to inspect any position.'));
        body.append(section);
        return;
      }
      section.append(element('p', 'game-review-subtitle', `${moments.length} ${moments.length === 1 ? 'marker' : 'markers'} from the PGN or navigation checkpoints. Markers are questions to inspect, not verified engine mistakes.`));
      const list = element('ol', 'game-review-list');
      for (const moment of moments) {
        if (!Number.isSafeInteger(moment.ply) || moment.ply < 0 || moment.ply > review.totalPly) continue;
        const row = element('li', 'game-review-moment');
        row.dataset.ply = String(moment.ply);
        if (moment.ply === snapshot.cursor) row.classList.add('is-current');
        row.append(element('span', 'game-review-move', positionLabel(moment.ply)));
        row.append(element('strong', '', moment.title || 'Recorded moment'));
        if (moment.detail) row.append(element('p', 'game-review-detail', moment.detail));
        const provenance = [moment.source, moment.basis].filter(Boolean).join(' · ');
        if (provenance) row.append(element('small', 'game-review-basis', provenance));
        const actions = element('div', 'game-review-actions');
        actions.append(action('Show on board', () => navigate(moment.ply)),
          action('Study / A-B', () => navigate(moment.ply, true)));
        row.append(actions);
        list.append(row);
      }
      section.append(list);
      body.append(section);
    }

    function render() {
      if (panel.hidden) return;
      const previousScroll = panel.scrollTop;
      body.replaceChildren();
      notice.textContent = '';
      if (!snapshot || !snapshot.moves?.length) {
        body.append(element('p', 'game-review-empty', 'Open a game from Game library or load a PGN to review its recorded moves.'));
        return;
      }
      if (!review || !review.totalPly) {
        body.append(element('p', 'game-review-empty', 'No complete recorded line is available for this position.'));
        return;
      }
      renderSummary();
      if (blocked()) body.append(element('p', 'game-review-line-note', 'Finish the active game or stop Replay before navigating with Review.'));
      renderTimeline();
      const sourceSection = element('section', 'game-review-sources');
      body.append(sourceSection);
      renderSources();
      renderMoments();
      const foot = element('p', 'game-review-footnote',
        'Only available PGN notes and navigation checkpoints are shown. The board requests analysis for the position you open. Scores and DCC ranks must be read from their labeled sources; this view does not calculate an evaluation graph or verify every move.');
      body.append(foot);
      panel.scrollTop = previousScroll;
    }

    function refresh() {
      if (panel.hidden) return;
      try {
        const next = host.getReviewGame();
        const key = [next.sourcePGN, next.startFen, next.moves?.map(m => m.san).join(' '), next.lineChanged].join('\u0001');
        const stale = key !== previousKey;
        const cursorChanged = next.cursor !== previousCursor || Boolean(next.blocked) !== previousBlocked;
        snapshot = next;
        if (stale) {
          review = root.ChessGameReview.build({ Chess: root.Chess, pgn: next.sourcePGN, headers: next.headers,
            moves: next.moves, startFen: next.startFen, lineChanged: next.lineChanged, sourceIsOriginal: next.sourceIsOriginal });
          previousKey = key;
        }
        if (stale || cursorChanged) render();
        else renderSources();
        previousCursor = next.cursor;
        previousBlocked = Boolean(next.blocked);
      } catch (error) {
        review = null;
        previousKey = '';
        body.replaceChildren(element('p', 'game-review-empty', 'This game could not be reviewed; the board was kept.'));
        notice.textContent = error?.message || 'Review data unavailable.';
      }
    }

    button.addEventListener('click', () => {
      if (!panel.hidden) { closePanel(); return; }
      for (const [drawer, closeId] of [['popularGamesPanel', 'btnCloseGames'], ['settingsPanel', 'btnCloseSettings']]) {
        if (document.getElementById(drawer)?.classList.contains('open')) document.getElementById(closeId)?.click();
      }
      panel.hidden = false;
      panel.classList.add('open');
      button.setAttribute('aria-expanded', 'true');
      panel.scrollTop = 0;
      refresh();
      close.focus({ preventScroll: true });
    });
    close.addEventListener('click', () => closePanel());
    panel.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePanel(); return; }
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) event.stopPropagation();
      if (event.key !== 'Tab') return;
      const focusables = Array.from(panel.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href]'));
      if (!focusables.length) { event.preventDefault(); panel.focus(); return; }
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }, true);
    host.onChange(() => {
      if (!panel.hidden && !refreshFrame) refreshFrame = root.requestAnimationFrame(() => { refreshFrame = 0; refresh(); });
    });
    const boardCards = document.getElementById('allEvalBadges');
    if (boardCards && root.MutationObserver) new root.MutationObserver(() => {
      if (!panel.hidden && !refreshFrame) refreshFrame = root.requestAnimationFrame(() => { refreshFrame = 0; refresh(); });
    }).observe(boardCards, { childList: true, subtree: true, characterData: true });
  }

  const ready = () => Promise.resolve(root.ChessLabReady || root.ChessLabStorage?.ready).then(start);
  if (document.readyState === 'complete') ready();
  else root.addEventListener('load', ready, { once: true });
})(window);
