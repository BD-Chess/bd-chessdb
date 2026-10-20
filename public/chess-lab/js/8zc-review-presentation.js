/* Saved game review: typed historical scores, navigation and legal PV previews.
   All board navigation goes through the existing LAB host. No engine requests. */
(function (root) {
  'use strict';
  const Core = root.ChessGameReview;
  const cache = new Map();
  const L = (en, sl) => root.ChessLanguage?.getLanguage() === 'sl' ? sl : en;
  const date = value => typeof value === 'string' ? value.slice(0, 10) : L('date unknown', 'datum ni znan');
  const label = (review, provider) => review.evidence?.sources?.[provider]?.label || (provider === 'sf' ? 'SF' : 'CDB');
  const rawScoreText = Core.scoreText;
  const Score = (score, fen, pov) => rawScoreText(score, fen, pov).replace('Unknown', L('Unknown', 'Neznano'))
    .replace('Special code ', L('Special code ', 'Posebna koda ')).replace(' plies', L(' plies', ' polpotez'));
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
    return ply === review.totalPly ? L('Final recorded position', 'Končni zabeleženi položaj') : L('Before ', 'Pred ') + review.positions[ply + 1].moveLabel;
  }
  function load(review) {
    if (!review.headers.ChessBestSource && !review.headers.ChessBestReviewEvidence) return null;
    let entry;
    try { entry = Core.resolveEvidence(review, root.ChessReviewRegistry); }
    catch (error) { return Promise.reject(error); }
    if (!entry) return null;
    const id = entry.file + ':' + entry.sha256;
    if (!cache.has(id)) {
      const controller = new AbortController();
      const timer = root.setTimeout(() => controller.abort(), 12000);
      const request = fetch(entry.file, { signal: controller.signal }).then(async response => {
        if (!response.ok) throw Error('Saved analysis unavailable');
        const limit = entry.bytes, chunks = []; let length = 0;
        if (response.body?.getReader) {
          const reader = response.body.getReader();
          try {
            for (;;) { const { value, done } = await reader.read(); if (done) break;
              length += value.byteLength; if (length > limit) throw Error('Saved analysis exceeds its registered size'); chunks.push(value); }
          } finally { await reader.cancel().catch(() => {}); }
        } else {
          const bytes = new Uint8Array(await response.arrayBuffer()); length = bytes.length; chunks.push(bytes);
        }
        if (length !== limit) throw Error('Saved analysis size mismatch');
        const bytes = new Uint8Array(length); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        if (new root.ChessAssetSHA256.SHA256().update(bytes).hex() !== entry.sha256) throw Error('Saved analysis hash mismatch');
        const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        // Verify the complete line, candidates and PVs before the cache can keep it.
        Core.attachEvidence(review, data, root.Chess, entry);
        return data;
      }).finally(() => root.clearTimeout(timer)).catch(error => {
        if (cache.get(id) === request) cache.delete(id); throw error;
      });
      if (cache.size >= 10) cache.delete(cache.keys().next().value);
      cache.set(id, request);
    }
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
        [L('CDB · played moves', 'CDB · odigrane poteze'), coverage.cdb_scored + '/' + review.totalPly + L(' scored', ' ocenjenih')],
        [L('CDB · types', 'CDB · vrste'), coverage.cdb_played_types.cp + ' cp · ' + coverage.cdb_played_types.mate + ' mate · ' + coverage.cdb_played_types.unknown + L(' unknown', ' neznanih')],
        [L('CDB · position estimates', 'CDB · ocene položajev'), coverage.cdb_positions + '/' + review.positions.length],
        [L('SF · saved positions', 'SF · shranjeni položaji'), coverage.sf_positions + '/' + review.positions.length],
        [L('Decision comparisons', 'Primerjave odločitev'), String(review.evidence.decisions.length)]
      ];
      for (const [label, value] of facts) {
        const fact = el('div', 'game-review-fact');
        fact.append(el('dt', '', label), el('dd', '', value)); stats.append(fact);
      }
      body.append(stats);
      const sources = el('details', 'game-review-provenance');
      sources.append(el('summary', '', L('Sources and missing coverage', 'Viri in manjkajoča pokritost')));
      for (const provider of ['cdb','sf']) {
        const meta = review.evidence.sources[provider];
        sources.append(el('p', 'game-review-chart-note', meta.label + ' · ' + date(meta.date) +
          (meta.engine ? ' · ' + meta.engine : provider === 'cdb' ? L(' · backend/version unknown', ' · zaledni motor/različica nista znana') : '')));
        if (provider === 'cdb' && meta.archive_note) sources.append(el('p', 'game-review-chart-note',
          L('Archived parsed projections; original HTTP bodies are unavailable in this package. Position estimates do not supply missing played-move scores.', 'Arhivske razčlenjene projekcije; izvirna telesa HTTP v tem paketu niso na voljo. Ocene položajev ne nadomestijo manjkajočih ocen odigranih potez.')));
        if (provider === 'sf') {
          if (meta.baseline_nodes) sources.append(el('p', 'game-review-chart-note',
            L('Baseline budget: ', 'Proračun osnovne analize: ') + meta.baseline_nodes + L(' nodes · threads ', ' vozlišč · niti ') + meta.threads + ' · Hash ' + meta.hash_mb + ' MB'));
          if (coverage.sf_positions < review.positions.length) sources.append(el('p', 'game-review-chart-note',
            L('No complete SF scan. All positions outside the counted saved searches remain unknown.', 'Ni celotnega pregleda s SF. Vsi položaji zunaj preštetih shranjenih iskanj ostajajo neznani.')));
        }
      }
      body.append(sources);
    }
    const rows = review.evidence?.positions || review.pgnEvaluations;
    const providers = (review.evidence ? ['cdb', 'sf'] : ['pgn']).filter(p => Core.plotSeries(rows, p).length);
    const available = providers.some(provider => Core.plotSeries(rows, provider).length);
    const section = el('section', 'game-review-trajectory');
    section.append(el('h3', '', L('Game trajectory', 'Potek partije')));
    if (!available) {
      section.append(el('p', 'game-review-subtitle', ctx.evidenceState === 'loading' ?
        L('Loading the saved analysis…', 'Nalagam shranjeno analizo…') : ctx.evidenceState === 'failed' ?
        L('Saved analysis is unavailable or does not match this game. The recorded line and PGN notes remain available.', 'Shranjena analiza ni na voljo ali se ne ujema s partijo. Zabeležena linija in opombe PGN ostajajo na voljo.') :
        L('No saved evaluation series. Recorded positions and notes remain available.', 'Ni shranjene serije ocen. Zabeleženi položaji in opombe ostajajo na voljo.')));
      if (ctx.evidenceState === 'failed' && ctx.canRetry) section.append(button(ctx, L('Retry saved review', 'Ponovi nalaganje pregleda'), ctx.retry));
      body.append(section); savedPosition(ctx); return;
    }
    section.append(el('p', 'game-review-subtitle',
      L('Position estimates · White POV: + White, − Black. Click the graph or use its arrow keys.', 'Ocene položajev · pogled belega: + beli, − črni. Klikni graf ali uporabi smerne tipke.')));
    const labels = { cdb: label(review, 'cdb') + ' · ' + date(review.evidence?.sources?.cdb?.date),
      sf: label(review, 'sf') + ' · ' + date(review.evidence?.sources?.sf?.date), pgn: L('PGN evals', 'Ocene PGN') };
    const legend = el('div', 'game-review-legend');
    for (const provider of providers) {
      const label = el('label', 'game-review-series-label series-' + provider);
      const input = el('input');
      input.type = 'checkbox'; input.checked = visible[provider]; input.id = 'reviewSeries-' + provider;
      input.addEventListener('change', () => { visible[provider] = input.checked; ctx.repaint(); });
      label.append(input, el('span', '', labels[provider])); legend.append(label);
    }
    section.append(legend);
    // Review lives in a ~320px sidebar/phone drawer, not a full-width canvas.
    // Keep the SVG's native scale close to that width so axis text stays legible.
    const width = 360, height = 168, left = 32, right = 8, top = 14, bottom = 24;
    const plotWidth = width - left - right, plotHeight = height - top - bottom;
    const x = ply => left + ply / review.totalPly * plotWidth;
    const y = point => top + (8 - (point.mateSign ? point.mateSign * 8 :
      Math.max(-8, Math.min(8, point.cp / 100)))) / 16 * plotHeight;
    const cursor = Math.min(Math.max(snapshot.cursor || 0, 0), review.totalPly);
    const chart = svg('svg', { viewBox: '0 0 ' + width + ' ' + height,
      class: 'game-review-chart', id: 'gameReviewGraph', role: 'slider', tabindex: '0',
      'aria-label': L('Navigate saved evaluation graph', 'Krmarjenje po grafu shranjenih ocen'), 'aria-valuemin': '0', 'aria-valuemax': review.totalPly,
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
            Score(point.score, rows[point.ply].fen, 'white')));
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
      L('Horizontal axis: half-moves played. Scale capped at ±8 pawns; exact scores below. Mate is an edge marker; missing data leaves a gap.', 'Vodoravna os: odigrane polpoteze. Prikaz omejen na ±8 kmetov; točne ocene so spodaj. Mat je robna oznaka; manjkajoči podatki pustijo vrzel.')));
    if (review.evidence) section.append(el('p', 'game-review-chart-note',
      review.evidence.sources.cdb.snapshot === 'refreshed_02' ?
      L('CDB: first returned scored candidate. SF: unrestricted 2M-node baseline. Candidate comparisons have separate budgets.', 'CDB: prvi vrnjeni ocenjeni kandidat. SF: osnovna analiza z 2 milijonoma vozlišč brez omejitve začetnih potez. Primerjave kandidatov imajo ločene proračune.') :
      L('CDB graph: parsed archive position estimates. SF covers only saved anchor searches. Dated root observations below stay separate; cross-node change is not move regret.', 'Graf CDB: razčlenjene arhivske ocene položajev. SF pokriva le shranjene analize izbranega položaja. Datirani zapisi spodaj ostajajo ločeni; sprememba med položajema ni neposredna izguba poteze.')));
    body.append(section);
    savedPosition(ctx);
  }
  function preview(ctx, target, candidate, source, sourceLabel, opener) {
    const pv = candidate?.pv;
    if (!pv?.steps?.length) return;
    const panel = el('section', 'game-review-variation');
    panel.setAttribute('aria-label', L('Saved analysis continuation', 'Shranjeno analitično nadaljevanje'));
    panel.append(el('h4', '', sourceLabel + ' · ' + candidate.san));
    panel.append(el('p', 'game-review-chart-note', L('Analysis continuation · ', 'Analitično nadaljevanje · ') + date(source.at) + ' UTC' +
      (source.depth ? L(' · depth ', ' · globina ') + source.depth : '')));
    const board = el('div', 'game-review-variation-board');
    board.setAttribute('role', 'img');
    const caption = el('p', 'game-review-variation-caption');
    const actions = el('div', 'game-review-actions');
    const line = el('div', 'game-review-pv-moves');
    let cursor = 0;
    const previous = button(ctx, L('Previous', 'Prejšnja'), () => draw(Math.max(0, cursor - 1)));
    const next = button(ctx, L('Next', 'Naslednja'), () => draw(Math.min(pv.steps.length - 1, cursor + 1)));
    actions.append(previous, next, button(ctx, L('Close line', 'Zapri linijo'), () => { panel.remove(); opener?.focus(); }));
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
      board.setAttribute('aria-label', L('Saved variation: ', 'Shranjena varianta: ') + step.label + L('. White at the bottom.', '. Beli spodaj.'));
      caption.textContent = (index === 0 ? L('Before the candidate', 'Pred kandidatom') : step.label) +
        (index === pv.steps.length - 1 && pv.checkmate ? L(' · Checkmate in this line', ' · Mat v tej liniji') : '');
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
    section.append(el('h3', '', L('Saved analysis · ', 'Shranjena analiza · ') + positionLabel(review, row.ply)));
    const cards = el('div', 'game-review-source-cards review-saved-cards');
    for (const provider of ['cdb', 'sf']) {
      const source = row[provider], best = source.candidates[0];
      const card = el('div', 'game-review-source-card');
      card.append(el('strong', '', source.label || label(review, provider)));
      card.append(el('span', '', best ? best.san + ' · ' + Score(best.score, row.fen, 'white') :
        Score(source.positionScore, row.fen, 'white')));
      card.append(el('small', '', (source.depth ? L('depth ', 'globina ') + source.depth + ' · ' : '') +
        (source.at ? date(source.at) + ' UTC · ' : '') + L('White POV', 'Pogled belega')));
      if (!best && source.positionScore) card.append(el('small', '', L('Position estimate; no direct candidate score', 'Ocena položaja; brez neposredne ocene kandidata')));
      cards.append(card);
    }
    section.append(cards);
    if (row.played) section.append(el('p', 'game-review-subtitle', L('Played: ', 'Odigrano: ') + review.positions[row.ply + 1].moveLabel +
      L(' · direct CDB score: ', ' · neposredna ocena CDB: ') + Score(row.cdb.candidates.find(m => m.uci === row.played)?.score, row.fen, 'white')));
    const best = row.sf.candidates[0];
    if (best?.pv) {
      const open = button(ctx, L('Explore SF line', 'Razišči linijo SF'), () => preview(ctx, section, best, row.sf, label(review, 'sf'), open));
      section.append(open);
    }
    if (row.observations?.length) observations(ctx, section, row);
    body.append(section);
  }
  function sourceTable(ctx, target, row, source) {
    const card = el('details', 'game-review-observation');
    card.dataset.provider = source.provider || 'cdb';
    card.append(el('summary', '', (source.label || source.provider || 'CDB') + ' · ' + date(source.at) +
      (source.depth ? L(' · depth ', ' · globina ') + source.depth : '')));
    const known = source.candidates.filter(c => ['cp','mate'].includes(c.score.type)).length;
    const legal = new root.Chess(row.fen).moves().length;
    card.append(el('p', 'game-review-chart-note', known + '/' + legal + L(' legal moves scored · White POV', ' ocenjenih legalnih potez · pogled belega') +
      (source.settings?.root_moves ? L(' · restricted root: ', ' · omejen nabor začetnih potez: ') + source.settings.root_moves.length : '')));
    const settings = source.settings;
    if (source.engine || settings) card.append(el('p', 'game-review-chart-note', [source.engine,
      settings?.threads != null ? L('threads ', 'niti ') + settings.threads : '',
      (settings?.hash_mb ?? settings?.Hash) != null ? 'Hash ' + (settings.hash_mb ?? settings.Hash) + ' MB' : '',
      (settings?.multipv ?? settings?.MultiPV) != null ? 'MultiPV ' + (settings.multipv ?? settings.MultiPV) : ''].filter(Boolean).join(' · ')));
    if (source.positionScore) card.append(el('p', '', L('Position estimate: ', 'Ocena položaja: ') + Score(source.positionScore, row.fen, 'white') +
      L(' · separate position observation; not a played-move score', ' · ločen zapis položaja; ni ocena odigrane poteze')));
    const table = el('table', 'game-review-comparison-table');
    const head = el('tr');
    for (const text of [L('Move', 'Poteza'), source.provider === 'dcc' ? L('CDB raw', 'CDB izvorno') : L('White POV', 'Pogled belega'),
      source.provider === 'dcc' ? L('DCC · mover POV', 'DCC · pogled na potezi') : L('Line', 'Linija')]) head.append(el('th', '', text));
    const thead = el('thead'); thead.append(head); table.append(thead);
    const tbody = el('tbody');
    for (const c of source.candidates) {
      if (c.score.type === 'unknown' && c.uci !== row.played) continue;
      const tr = el('tr'), name = el('td', '', c.san);
      if (c.uci === row.played) name.append(el('small', 'review-move-tag', L('Game', 'Partija')));
      tr.append(name, el('td', '', Score(c.score, row.fen, 'white')));
      const line = el('td');
      if (source.provider === 'dcc') line.textContent = c.heuristic == null ? '—' : c.heuristic.toFixed(3);
      else if (c.pv) { const open = button(ctx, L('Explore', 'Razišči'), () => preview(ctx, card, c, source, source.label, open), 'review-preview-open'); line.append(open); }
      else line.textContent = '—';
      tr.append(line); tbody.append(tr);
    }
    if (tbody.childElementCount) { table.append(tbody); card.append(table); }
    const first = source.candidates[0], played = source.candidates.find(c => c.uci === row.played);
    const exact = c => c?.score.type === 'cp' && !c.score.bound;
    const moverValue = c => c.score.cp * (c.score.pov === 'white' && row.fen.split(' ')[1] === 'b' ? -1 : 1);
    if (source.status === 'ok' && ['queryall','same-depth-multipv','restricted-root-multipv'].includes(source.method) && exact(first) && exact(played)) {
      const gap = moverValue(first) - moverValue(played);
      if (gap >= 0) card.append(el('p', 'game-review-chart-note',
        L('Same-root gap to first returned candidate: ', 'Razlika v istem položaju do prvega vrnjenega kandidata: ') + gap +
        L(' cp (mover POV). Limited to this dated candidate set.', ' cp (pogled na potezi). Velja le za ta datirani nabor kandidatov.')));
    }
    if (source.method === 'candidate-summary') card.append(el('p', 'game-review-chart-note',
      L('Candidate summary; a forced played-move search may be separate. No exact same-search regret is claimed.', 'Povzetek kandidatov; vsiljeno iskanje odigrane poteze je lahko ločeno. Točna izguba iz istega iskanja ni potrjena.')));
    if (source.provider === 'dcc') card.append(el('p', 'game-review-chart-note',
      L('DCC uses mover POV and is a sampled heuristic, not centipawns or independent playing-strength evidence. Receipt: ', 'DCC uporablja pogled igralca na potezi in je vzorčena hevristika, ni centipavnska ocena ali neodvisen dokaz igralne moči. Zapis: ') + source.status));
    const provenance = source.provenance;
    if (provenance) {
      const details = el('details', 'game-review-provenance'); details.append(el('summary', '', L('Source record', 'Izvorni zapis')));
      details.append(el('p', 'game-review-chart-note', provenance.kind === 'parsed-projection' ?
        L('Parsed archive projection. Original HTTP body unavailable; date is the archive snapshot.', 'Razčlenjena arhivska projekcija. Izvirno telo HTTP ni na voljo; datum označuje arhivski posnetek.') :
        provenance.kind === 'saved-http-body' ? L('Archived HTTP body in the source receipt.', 'Arhivirano telo HTTP v izvornem zapisu.') :
        provenance.kind === 'parsed-engine-summary' ? L('Parsed engine summary; the full UCI round is unavailable here.', 'Razčlenjeni povzetek motorja; celoten krog UCI tukaj ni na voljo.') :
        L('Saved local engine receipt. Preserve its search settings.', 'Shranjeni zapis lokalnega motorja. Veljajo njegove nastavitve iskanja.')));
      details.append(el('p', 'game-review-chart-note', provenance.path + '\nSHA-256 ' + provenance.sha256 +
        (provenance.record_sha256 ? '\n' + L('Record ', 'Zapis ') + provenance.record_sha256 : '') +
        (source.engine_sha256 ? '\nEngine SHA-256 ' + source.engine_sha256 : ''))); card.append(details);
    }
    target.append(card);
  }
  function observations(ctx, target, row) {
    const latest = new Map();
    for (const source of row.observations) latest.set(source.provider === 'sf' ? 'sf' : source.provider + ':' + source.method, source);
    for (const source of latest.values()) sourceTable(ctx, target, row, source);
    const previous = row.observations.filter(source => ![...latest.values()].includes(source));
    if (previous.length) {
      const details = el('details', 'game-review-other-observations');
      details.append(el('summary', '', L('Other dated observations · ', 'Drugi datirani zapisi · ') + previous.length));
      for (const source of previous) sourceTable(ctx, details, row, source); target.append(details);
    }
  }
  function decisionCard(ctx, row, moment) {
    const { review } = ctx;
    const decision = review.evidence?.decisions.find(d => d.ply === moment.ply);
    if (!decision) {
      const note = review.evidence?.notes?.find(n => n.ply === moment.ply);
      if (!note) return false;
      row.append(el('strong', '', L('Saved critical position', 'Shranjeni ključni položaj')),
        el('p', 'game-review-detail', note.text));
      observations(ctx, row, review.evidence.positions[moment.ply]);
      return true;
    }
    const data = review.evidence.positions[moment.ply], sf = data.comparison || data.sf, human = decision.human;
    row.classList.add('game-review-decision');
    row.append(el('strong', '', decision.title));
    row.append(el('p', 'game-review-human', 'BD · ' + human.status +
      (human.choice_san ? ' · chose ' + human.choice_san : '') +
      (human.candidates_san.length ? ' · candidates: ' + human.candidates_san.join(', ') : '')));
    row.append(el('p', 'game-review-detail', decision.lesson));
    row.append(el('p', 'game-review-chart-note', (data.fen.split(' ')[1] === 'b' ? L('Black', 'Črni') : L('White', 'Beli')) +
      ' POV · ' + label(review, 'cdb') + ' ' + date(data.cdb.at) + ' · SF ' + date(sf.at) + ' UTC' +
      L(' depth ', ' globina ') + sf.depth + (data.comparison ? L(' · matched candidate search', ' · usklajeno iskanje kandidatov') : L(' · baseline', ' · osnovna analiza'))));
    const candidates = new Map();
    for (const c of [...sf.candidates, ...data.cdb.candidates]) candidates.set(c.uci, c.san);
    candidates.set(data.played, review.positions[moment.ply + 1].san);
    for (const move of new root.Chess(data.fen).moves({ verbose: true }))
      if (human.candidates_san.includes(move.san)) candidates.set(move.from + move.to + (move.promotion || ''), move.san);
    const table = el('table', 'game-review-comparison-table');
    table.setAttribute('aria-label', L('Saved candidate comparison at ', 'Shranjena primerjava kandidatov pri ') + moment.moveLabel);
    const head = el('tr');
    for (const text of [L('Move', 'Poteza'), label(review, 'cdb'), 'SF d' + sf.depth, L('Line', 'Linija')]) head.append(el('th', '', text));
    const thead = el('thead'); thead.append(head); table.append(thead);
    const tbody = el('tbody');
    for (const [uci, name] of candidates) {
      const tr = el('tr'), move = el('td');
      move.append(el('strong', '', name));
      if (uci === data.played) move.append(el('small', 'review-move-tag', L('Game', 'Partija')));
      if (name === human.choice_san) move.append(el('small', 'review-move-tag review-bd-tag', L('BD choice', 'Izbira BD')));
      else if (human.candidates_san.includes(name)) move.append(el('small', 'review-move-tag', L('BD candidate', 'Kandidat BD')));
      const cdb = data.cdb.candidates.find(c => c.uci === uci), candidate = sf.candidates.find(c => c.uci === uci);
      tr.append(move, el('td', '', cdb ? Score(cdb.score, data.fen) : '—'),
        el('td', '', candidate ? Score(candidate.score, data.fen) : '—'));
      const line = el('td');
      if (candidate?.pv) {
        const open = button(ctx, L('Explore', 'Razišči'), () => preview(ctx, row, candidate, sf,
          data.comparison ? L('SF comparison', 'Primerjava SF') : L('SF baseline', 'Osnovna analiza SF'), open), 'review-preview-open');
        line.append(open);
      } else line.textContent = '—';
      tr.append(line); tbody.append(tr);
    }
    table.append(tbody); row.append(table);
    row.append(el('p', 'game-review-chart-note', L('— means unscored in this source. Dates and sources remain separate observations.', '— pomeni brez ocene v tem viru. Datumi in viri ostajajo ločeni zapisi.')));
    if (moment.detail) {
      const details = el('details', 'game-review-full-note');
      details.append(el('summary', '', L('Full PGN note', 'Celotna opomba PGN')), el('p', 'game-review-detail', moment.detail)); row.append(details);
    }
    return true;
  }
  function ledger(ctx) {
    const { review, body } = ctx;
    if (!review.evidence) return;
    const details = el('details', 'game-review-ledger');
    details.open = ledgerOpen;
    details.addEventListener('toggle', () => { ledgerOpen = details.open; });
    details.append(el('summary', '', L('All ', 'Vseh ') + review.totalPly + L(' played moves · saved score coverage', ' odigranih potez · pokritost shranjenih ocen')));
    details.append(el('p', 'game-review-chart-note', L('White POV. Direct candidate scores stay separate from position estimates. Unknown is an empty result, not 0.00.', 'Pogled belega. Neposredne ocene kandidatov ostajajo ločene od ocen položajev. Neznano pomeni manjkajoč podatek, ni 0.00.')));
    const filter = el('select', 'game-review-ledger-filter');
    filter.id = 'gameReviewLedgerFilter'; filter.setAttribute('aria-label', L('Filter played move score ledger', 'Filter preglednice ocen odigranih potez'));
    for (const [value, text] of [['all', L('All played moves', 'Vse odigrane poteze')], ['missing', L('Missing direct CDB score', 'Brez neposredne ocene CDB')], ['decisions', L('Key decisions', 'Ključne odločitve')]]) {
      const option = el('option', '', text); option.value = value; filter.append(option);
    }
    filter.value = ledgerFilter;
    const table = el('table', 'game-review-ledger-table'), head = el('tr');
    for (const text of [L('Played move', 'Odigrana poteza'), label(review, 'cdb'), label(review, 'sf')]) head.append(el('th', '', text));
    const thead = el('thead'); thead.append(head); table.append(thead);
    const tbody = el('tbody'); table.append(tbody);
    function draw() {
      tbody.replaceChildren();
      const decisions = new Set(review.evidence.decisions.map(d => d.ply));
      for (const data of review.evidence.positions.slice(0, -1)) {
        const cdb = data.cdb.candidates.find(c => c.uci === data.played);
        if (filter.value === 'missing' && ['cp','mate'].includes(cdb?.score.type)) continue;
        if (filter.value === 'decisions' && !decisions.has(data.ply)) continue;
        const tr = el('tr'); tr.dataset.ply = String(data.ply);
        const move = el('td');
        move.append(button(ctx, review.positions[data.ply + 1].moveLabel, () => ctx.navigate(data.ply, false, false, true)));
        tr.append(move, el('td', '', Score(cdb?.score, data.fen, 'white')),
          el('td', '', Score(data.sf.candidates.find(c => c.uci === data.played)?.score, data.fen, 'white')));
        tbody.append(tr);
      }
    }
    filter.addEventListener('change', () => { ledgerFilter = filter.value; draw(); }); draw();
    details.append(filter, table); body.append(details);
  }
  root.ChessReviewPresentation = { load, overview, decisionCard, ledger };
})(window);
