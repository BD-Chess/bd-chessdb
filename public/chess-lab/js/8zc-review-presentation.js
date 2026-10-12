/* Saved game review: typed historical scores, navigation and legal PV previews.
   All board navigation goes through the existing LAB host. No engine requests. */
(function (root) {
  'use strict';
  const Core = root.ChessGameReview;
  const files = { 'dreev-kasparov-1996': 'config/dreev-kasparov-review.json' };
  const cache = new Map();
  const visible = { cdb: true, sf: true, pgn: true };
  let ledgerFilter = 'all';
  let ledgerOpen = false;
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = String(text);
    return node;
  }
  function button(ctx, label, callback, cls) {
    const node = el('button', 'btn ' + (cls || ''), label);
    node.type = 'button'; node.disabled = ctx.blocked();
    node.addEventListener('click', callback); return node;
  }
  function positionLabel(review, ply) {
    return ply === review.totalPly ? 'Final recorded position' : 'Before ' + review.positions[ply + 1].moveLabel;
  }
  function load(review) {
    const id = review.headers.ChessBestReviewEvidence;
    if (!files[id]) return null;
    if (!cache.has(id)) cache.set(id, fetch(files[id]).then(response => {
      if (!response.ok) throw Error('Saved analysis unavailable');
      return response.json();
    }));
    return cache.get(id);
  }
  function svg(tag, attrs, text) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [name, value] of Object.entries(attrs || {})) node.setAttribute(name, String(value));
    if (text != null) node.textContent = String(text);
    return node;
  }
  function overview(ctx) {
    const { review, body, snapshot } = ctx;
    if (review.evidence) {
      const coverage = review.evidence.coverage;
      const stats = el('dl', 'game-review-facts game-review-coverage');
      const facts = [
        ['CDB · played moves', coverage.cdb_scored + '/' + review.totalPly + ' scored'],
        ['CDB · types', coverage.cdb_played_types.cp + ' cp · ' + coverage.cdb_played_types.mate + ' mate · ' + coverage.cdb_played_types.unknown + ' unknown'],
        ['Stockfish · position scan', review.positions.length + '/' + review.positions.length + ' saved positions'],
        ['Review V4', review.evidence.decisions.length + ' decision comparisons']
      ];
      for (const [label, value] of facts) {
        const fact = el('div', 'game-review-fact');
        fact.append(el('dt', '', label), el('dd', '', value)); stats.append(fact);
      }
      body.append(stats);
    }
    const rows = review.evidence?.positions || review.pgnEvaluations;
    const providers = review.evidence ? ['cdb', 'sf'] : ['pgn'];
    const available = providers.some(provider => Core.plotSeries(rows, provider).length);
    const section = el('section', 'game-review-trajectory');
    section.append(el('h3', '', 'Game trajectory'));
    if (!available) {
      section.append(el('p', 'game-review-subtitle', ctx.evidenceState === 'loading' ?
        'Loading the saved analysis…' : ctx.evidenceState === 'failed' ?
        'Saved analysis could not be loaded. The recorded line and PGN notes remain available.' :
        'No saved evaluation series in this PGN. Recorded positions and notes are available below.'));
      body.append(section); return;
    }
    section.append(el('p', 'game-review-subtitle',
      'Position estimates · White POV: + White, − Black. Click the graph or use its arrow keys.'));
    const labels = { cdb: 'CDB R4 · 10 Oct', sf: 'SF · 1 Oct report', pgn: 'PGN evals' };
    const legend = el('div', 'game-review-legend');
    for (const provider of providers) {
      const label = el('label', 'game-review-series-label series-' + provider);
      const input = el('input');
      input.type = 'checkbox'; input.checked = visible[provider]; input.id = 'reviewSeries-' + provider;
      input.addEventListener('change', () => { visible[provider] = input.checked; ctx.repaint(); });
      label.append(input, el('span', '', labels[provider])); legend.append(label);
    }
    section.append(legend);
    const width = 700, height = 184, left = 36, right = 10, top = 14, bottom = 24;
    const plotWidth = width - left - right, plotHeight = height - top - bottom;
    const x = ply => left + ply / review.totalPly * plotWidth;
    const y = point => top + (8 - (point.mateSign ? point.mateSign * 8 :
      Math.max(-8, Math.min(8, point.cp / 100)))) / 16 * plotHeight;
    const cursor = Math.min(Math.max(snapshot.cursor || 0, 0), review.totalPly);
    const chart = svg('svg', { viewBox: '0 0 ' + width + ' ' + height,
      class: 'game-review-chart', id: 'gameReviewGraph', role: 'slider', tabindex: '0',
      'aria-label': 'Navigate saved evaluation graph', 'aria-valuemin': '0', 'aria-valuemax': review.totalPly,
      'aria-valuenow': cursor, 'aria-valuetext': positionLabel(review, cursor) });
    for (const cp of [800, 400, 0, -400, -800]) {
      const at = y({ cp });
      chart.append(svg('line', { x1: left, x2: width - right, y1: at, y2: at,
        class: cp === 0 ? 'review-zero' : 'review-grid' }));
      chart.append(svg('text', { x: left - 5, y: at + 4, 'text-anchor': 'end', class: 'review-axis' },
        cp === 0 ? '0' : (cp > 0 ? '+' : '−') + Math.abs(cp / 100)));
    }
    for (const ply of [0, Math.round(review.totalPly / 2), review.totalPly])
      chart.append(svg('text', { x: x(ply), y: height - 5, 'text-anchor': 'middle', class: 'review-axis' }, ply));
    for (const provider of providers.filter(p => visible[p])) {
      for (const points of Core.plotSeries(rows, provider)) {
        chart.append(svg('polyline', { points: points.map(point => x(point.ply) + ',' + y(point)).join(' '),
          fill: 'none', class: 'review-trace series-' + provider }));
        for (const point of points) {
          if (points.length !== 1 && !point.mateSign) continue;
          const marker = svg('circle', { cx: x(point.ply), cy: y(point), r: point.mateSign ? 4 : 2.5,
            class: 'review-point series-' + provider + (point.mateSign ? ' is-mate' : '') });
          marker.append(svg('title', {}, labels[provider] + ' · ' + positionLabel(review, point.ply) + ' · ' +
            Core.scoreText(point.score, rows[point.ply].fen, 'white')));
          chart.append(marker);
        }
      }
    }
    for (const decision of review.evidence?.decisions || [])
      chart.append(svg('line', { x1: x(decision.ply), x2: x(decision.ply),
        y1: height - bottom + 3, y2: height - bottom + 9, class: 'review-decision-tick' }));
    chart.append(svg('line', { x1: x(cursor), x2: x(cursor), y1: top, y2: height - bottom, class: 'review-cursor' }));
    chart.addEventListener('click', event => {
      const rect = chart.getBoundingClientRect();
      if (!rect.width) return;
      const px = (event.clientX - rect.left) / rect.width * width;
      ctx.navigate(Math.max(0, Math.min(review.totalPly, Math.round((px - left) / plotWidth * review.totalPly))), false, false, true);
    });
    chart.addEventListener('keydown', event => {
      const delta = { ArrowLeft: -1, ArrowRight: 1 };
      if (!(event.key in delta) && !['Home', 'End'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      ctx.navigate(event.key === 'Home' ? 0 : event.key === 'End' ? review.totalPly :
        Math.max(0, Math.min(review.totalPly, (snapshot.cursor || 0) + delta[event.key])), false, false, true);
    });
    section.append(chart, el('p', 'game-review-chart-note',
      'Horizontal axis: half-moves played. Scale capped at ±8 pawns; exact scores below. Mate is an edge marker; missing data leaves a gap.'));
    if (review.evidence) section.append(el('p', 'game-review-chart-note',
      'CDB: first scored move returned in frozen R4. SF: unrestricted 2M-node baseline. Deeper candidate comparisons have their own cards.'));
    body.append(section);
    savedPosition(ctx);
  }
  function preview(ctx, target, candidate, source, sourceLabel, opener) {
    const pv = candidate?.pv;
    if (!pv?.steps?.length) return;
    const panel = el('section', 'game-review-variation');
    panel.setAttribute('aria-label', 'Saved analysis continuation');
    panel.append(el('h4', '', sourceLabel + ' · ' + candidate.san));
    panel.append(el('p', 'game-review-chart-note', 'Analysis continuation · ' + source.at.slice(0, 10) + ' UTC' +
      (source.depth ? ' · depth ' + source.depth : '')));
    const board = el('div', 'game-review-variation-board');
    board.setAttribute('role', 'img');
    const caption = el('p', 'game-review-variation-caption');
    const actions = el('div', 'game-review-actions');
    const line = el('div', 'game-review-pv-moves');
    let cursor = 0;
    const previous = button(ctx, 'Previous', () => draw(Math.max(0, cursor - 1)));
    const next = button(ctx, 'Next', () => draw(Math.min(pv.steps.length - 1, cursor + 1)));
    actions.append(previous, next, button(ctx, 'Close line', () => { panel.remove(); opener?.focus(); }));
    const buttons = [];
    for (let index = 1; index < pv.steps.length; index++) {
      const move = button(ctx, pv.steps[index].label, () => draw(index), 'game-review-pv-move');
      buttons.push(move); line.append(move);
    }
    function draw(index) {
      cursor = index;
      const step = pv.steps[index], game = new root.Chess(step.fen);
      board.replaceChildren();
      for (const rank of [8, 7, 6, 5, 4, 3, 2, 1]) for (let file = 0; file < 8; file++) {
        const square = 'abcdefgh'[file] + rank;
        const cell = el('div', 'review-square ' + ((file + rank) % 2 ? 'review-light-square' : 'review-dark-square'));
        if (step.move && [step.move.slice(0, 2), step.move.slice(2, 4)].includes(square)) cell.classList.add('review-last-square');
        const piece = game.get(square);
        if (piece) {
          const image = el('img'); image.src = 'img/chesspieces/wikipedia/' + piece.color + piece.type.toUpperCase() + '.png';
          image.alt = ''; image.draggable = false; cell.append(image);
        }
        board.append(cell);
      }
      board.setAttribute('aria-label', 'Saved variation: ' + step.label + '. White at the bottom.');
      caption.textContent = step.label + (index === pv.steps.length - 1 && pv.checkmate ? ' · Checkmate in this line' : '');
      previous.disabled = ctx.blocked() || index === 0;
      next.disabled = ctx.blocked() || index === pv.steps.length - 1;
      for (let i = 0; i < buttons.length; i++) {
        buttons[i].classList.toggle('is-current', i + 1 === index);
        buttons[i].setAttribute('aria-pressed', String(i + 1 === index));
      }
      panel.dataset.step = String(index);
    }
    target.querySelector('.game-review-variation')?.remove();
    panel.append(board, caption, actions, line); target.append(panel); draw(0);
  }
  function savedPosition(ctx) {
    const { review, body, snapshot } = ctx;
    if (!review.evidence) return;
    const row = review.evidence.positions[snapshot.cursor];
    if (!row) return;
    const section = el('section', 'game-review-saved-position');
    section.append(el('h3', '', 'Saved analysis · ' + positionLabel(review, row.ply)));
    const cards = el('div', 'game-review-source-cards review-saved-cards');
    for (const provider of ['cdb', 'sf']) {
      const source = row[provider], best = source.candidates[0];
      const card = el('div', 'game-review-source-card');
      card.append(el('strong', '', provider === 'cdb' ? 'CDB R4' : 'SF baseline'));
      card.append(el('span', '', best ? best.san + ' · ' + Core.scoreText(best.score, row.fen, 'white') : 'Unknown'));
      card.append(el('small', '', (provider === 'sf' ? 'depth ' + source.depth + ' · ' : '') + source.at.slice(0, 10) + ' UTC · White POV'));
      cards.append(card);
    }
    section.append(cards);
    if (row.played) section.append(el('p', 'game-review-subtitle', 'Played: ' + review.positions[row.ply + 1].moveLabel +
      ' · direct CDB score: ' + Core.scoreText(row.cdb.candidates.find(m => m.uci === row.played)?.score, row.fen, 'white')));
    const best = row.sf.candidates[0];
    if (best?.pv) {
      const open = button(ctx, 'Explore SF baseline line', () => preview(ctx, section, best, row.sf, 'SF baseline', open));
      section.append(open);
    }
    body.append(section);
  }
  function decisionCard(ctx, row, moment) {
    const { review } = ctx;
    const decision = review.evidence?.decisions.find(d => d.ply === moment.ply);
    if (!decision) return false;
    const data = review.evidence.positions[moment.ply], sf = data.comparison || data.sf, human = decision.human;
    row.classList.add('game-review-decision');
    row.append(el('strong', '', decision.title));
    row.append(el('p', 'game-review-human', 'BD · ' + human.status +
      (human.choice_san ? ' · chose ' + human.choice_san : '') +
      (human.candidates_san.length ? ' · candidates: ' + human.candidates_san.join(', ') : '')));
    row.append(el('p', 'game-review-detail', decision.lesson));
    row.append(el('p', 'game-review-chart-note', (data.fen.split(' ')[1] === 'b' ? 'Black' : 'White') +
      ' POV · CDB R4 ' + data.cdb.at.slice(0, 10) + ' · SF ' + sf.at.slice(0, 10) + ' UTC' +
      ' depth ' + sf.depth + (data.comparison ? ' · matched candidate search' : ' · baseline')));
    const candidates = new Map();
    for (const c of [...sf.candidates, ...data.cdb.candidates]) candidates.set(c.uci, c.san);
    candidates.set(data.played, review.positions[moment.ply + 1].san);
    for (const move of new root.Chess(data.fen).moves({ verbose: true }))
      if (human.candidates_san.includes(move.san)) candidates.set(move.from + move.to + (move.promotion || ''), move.san);
    const table = el('table', 'game-review-comparison-table');
    table.setAttribute('aria-label', 'Saved candidate comparison at ' + moment.moveLabel);
    const head = el('tr');
    for (const label of ['Move', 'CDB R4', 'SF d' + sf.depth, 'Line']) head.append(el('th', '', label));
    const thead = el('thead'); thead.append(head); table.append(thead);
    const tbody = el('tbody');
    for (const [uci, name] of candidates) {
      const tr = el('tr'), move = el('td');
      move.append(el('strong', '', name));
      if (uci === data.played) move.append(el('small', 'review-move-tag', 'Game'));
      if (name === human.choice_san) move.append(el('small', 'review-move-tag review-bd-tag', 'BD choice'));
      else if (human.candidates_san.includes(name)) move.append(el('small', 'review-move-tag', 'BD candidate'));
      const cdb = data.cdb.candidates.find(c => c.uci === uci), candidate = sf.candidates.find(c => c.uci === uci);
      tr.append(move, el('td', '', cdb ? Core.scoreText(cdb.score, data.fen) : '—'),
        el('td', '', candidate ? Core.scoreText(candidate.score, data.fen) : '—'));
      const line = el('td');
      if (candidate?.pv) {
        const open = button(ctx, 'Explore', () => preview(ctx, row, candidate, sf,
          data.comparison ? 'SF comparison' : 'SF baseline', open), 'review-preview-open');
        line.append(open);
      } else line.textContent = '—';
      tr.append(line); tbody.append(tr);
    }
    table.append(tbody); row.append(table);
    row.append(el('p', 'game-review-chart-note', '— means unscored in this source. Dates and sources remain separate observations.'));
    if (moment.detail) {
      const details = el('details', 'game-review-full-note');
      details.append(el('summary', '', 'Full PGN note'), el('p', 'game-review-detail', moment.detail)); row.append(details);
    }
    return true;
  }
  function ledger(ctx) {
    const { review, body } = ctx;
    if (!review.evidence) return;
    const details = el('details', 'game-review-ledger');
    details.open = ledgerOpen;
    details.addEventListener('toggle', () => { ledgerOpen = details.open; });
    details.append(el('summary', '', 'All ' + review.totalPly + ' played moves · saved score coverage'));
    details.append(el('p', 'game-review-chart-note', 'White POV. Direct candidate scores only; SF here is the 2M-node baseline. Unknown is an empty result, not 0.00.'));
    const filter = el('select', 'game-review-ledger-filter');
    filter.id = 'gameReviewLedgerFilter'; filter.setAttribute('aria-label', 'Filter played move score ledger');
    for (const [value, text] of [['all', 'All played moves'], ['missing', 'Missing direct CDB score'], ['decisions', 'Key decisions']]) {
      const option = el('option', '', text); option.value = value; filter.append(option);
    }
    filter.value = ledgerFilter;
    const table = el('table', 'game-review-ledger-table'), head = el('tr');
    for (const label of ['Played move', 'CDB R4', 'SF baseline']) head.append(el('th', '', label));
    const thead = el('thead'); thead.append(head); table.append(thead);
    const tbody = el('tbody'); table.append(tbody);
    function draw() {
      tbody.replaceChildren();
      const decisions = new Set(review.evidence.decisions.map(d => d.ply));
      for (const data of review.evidence.positions.slice(0, -1)) {
        const cdb = data.cdb.candidates.find(c => c.uci === data.played);
        if (filter.value === 'missing' && cdb) continue;
        if (filter.value === 'decisions' && !decisions.has(data.ply)) continue;
        const tr = el('tr'); tr.dataset.ply = String(data.ply);
        const move = el('td');
        move.append(button(ctx, review.positions[data.ply + 1].moveLabel, () => ctx.navigate(data.ply, false, false, true)));
        tr.append(move, el('td', '', Core.scoreText(cdb?.score, data.fen, 'white')),
          el('td', '', Core.scoreText(data.sf.candidates.find(c => c.uci === data.played)?.score, data.fen, 'white')));
        tbody.append(tr);
      }
    }
    filter.addEventListener('change', () => { ledgerFilter = filter.value; draw(); }); draw();
    details.append(filter, table); body.append(details);
  }
  root.ChessReviewPresentation = { load, overview, decisionCard, ledger };
})(window);
