/* Browser-local simulation setup and history. Scheduling and engine work live in the host. */
(function (root) {
  'use strict';
  const ENGINES = { raw: 'CDB/SF', dcc: 'CDB/SF + DCC', sf: 'SF', 'sf-dcc': 'SF + DCC' };
  function create(host = {}) {
    const doc = root.document, dialog = doc.createElement('dialog');
    dialog.id = 'simTournamentDialog'; dialog.className = 'tournament-dialog';
    dialog.setAttribute('aria-labelledby', 'simTournamentTitle');
    const engineOptions = Object.entries(ENGINES).map(([id, label]) => `<option value="${id}">${label}</option>`).join('');
    dialog.innerHTML = `<header class="tournament-header"><div><p class="tournament-kicker">LOCAL ENGINES</p><h2 id="simTournamentTitle">Sim · games & tournaments</h2></div><button type="button" data-action="close" aria-label="Close simulation settings">×</button></header>
      <p class="tournament-intro">Run games from the current position or compare engines across opening positions. Keep this browser open to compute; progress and history are stored in this browser.</p>
      <form data-ui="form">
        <div class="tournament-setup">
          <fieldset><legend>1 · Match</legend>
            <label>Format<select data-ui="format"><option value="single">Single game</option><option value="duel">Duel · both colors</option><option value="round-robin">Round robin · both colors</option></select></label>
            <div class="tournament-columns" data-ui="sides"><label><span data-ui="white-label">White engine</span><select data-ui="white">${engineOptions}</select></label><label><span data-ui="black-label">Black engine</span><select data-ui="black">${engineOptions}</select></label></div>
            <label data-ui="rounds-label" hidden>Rounds per opening<input data-ui="rounds" type="number" min="1" max="1000" step="1" value="1"></label>
            <div class="tournament-participants" data-ui="participants" hidden>${Object.entries(ENGINES).map(([id, label]) => `<label><input type="checkbox" value="${id}" checked> ${label}</label>`).join('')}</div>
            <p class="tournament-note">CDB/SF uses CDB with local Stockfish fallback. DCC adds its move selection.</p>
            <label>Event name <span class="tournament-optional">optional</span><input data-ui="name" maxlength="100" placeholder="e.g. Four-engine opening test"></label>
          </fieldset>
          <fieldset><legend>2 · Starting positions</legend>
            <label>Source<select data-ui="opening-source"><option value="current">Current board position</option><option value="collection">Game library collection</option></select></label>
            <p class="tournament-current" data-ui="current-title"></p>
            <div data-ui="collection-fields" hidden><label>Collection<select data-ui="collection"></select></label>
              <div class="tournament-columns"><label>Opening length<select data-ui="opening-mode"><option value="auto">Auto · opening metadata</option><option value="moves">Choose move count</option></select></label><label data-ui="opening-moves-label" hidden>Full moves<input data-ui="opening-moves" type="number" min="0" max="100" step="1" value="9"></label></div>
              <label>Opening positions<input data-ui="opening-count" type="number" min="1" max="1000" step="1" value="1"></label>
              <p class="tournament-note" data-ui="collection-note"></p>
            </div>
          </fieldset>
          <fieldset><legend>3 · Engine limits</legend>
            <label>Limit<select data-ui="limit-mode"><option value="depth">Search depth</option><option value="nodes">Nodes per move</option><option value="move-time">Time per move</option><option value="game-time">Game clock + increment</option></select></label>
            <label data-limit="depth">Depth<input data-ui="depth" type="number" min="1" max="100" step="1" value="15"></label>
            <label data-limit="nodes" hidden>Root nodes per move<input data-ui="nodes" type="number" min="1" max="1000000000" step="1" value="24000"></label>
            <div data-limit="move-time" hidden><label>Time per move<select data-ui="move-time"><option value="1000">1 second</option><option value="3000">3 seconds</option><option value="5000" selected>5 seconds</option><option value="10000">10 seconds</option><option value="15000">15 seconds</option><option value="30000">30 seconds</option><option value="60000">1 minute</option><option value="custom">Custom</option></select></label><label data-ui="move-custom-label" hidden>Seconds per move<input data-ui="move-custom" type="number" min="0.1" max="86400" step="0.1" value="5"></label></div>
            <div data-limit="game-time" hidden><div class="tournament-columns"><label>Time per side<select data-ui="game-time"><option value="30000">30 seconds</option><option value="60000">1 minute</option><option value="180000" selected>3 minutes</option><option value="300000">5 minutes</option><option value="900000">15 minutes</option><option value="1800000">30 minutes</option><option value="3600000">1 hour</option><option value="7200000">2 hours</option><option value="custom">Custom · up to 1 day</option></select></label><label>Increment<select data-ui="increment"><option value="0">0 seconds</option><option value="1000">1 second</option><option value="2000" selected>2 seconds</option><option value="5000">5 seconds</option><option value="10000">10 seconds</option></select></label></div><label data-ui="game-custom-label" hidden>Minutes per side <span class="tournament-optional">up to 1,440</span><input data-ui="game-custom" type="number" min="0.5" max="1440" step="0.5" value="3"></label></div>
            <p class="tournament-note">Depth and root-node limits apply to SF; DCC probes add nodes. Timed limits include CDB, SF and DCC together. Move pause and engine loading do not use player time.</p>
          </fieldset>
          <fieldset><legend>4 · Run</legend>
            <label>Pause between moves<select data-ui="move-pause"><option value="0">None · fastest</option><option value="400">0.4 seconds</option><option value="1000">1 second</option><option value="2000">2 seconds</option><option value="5000">5 seconds · inspect choices</option></select></label>
            <div class="tournament-plan" data-ui="plan" aria-live="polite"></div>
            <p class="tournament-note">Duels and round robins swap colors for each opening. You can pause and resume saved events.</p>
            <button class="tournament-start" data-ui="start" type="submit">Start simulation</button>
          </fieldset>
        </div>
      </form>
      <p class="tournament-status" data-ui="status" role="status"></p>
      <section class="tournament-history" aria-labelledby="simTournamentHistory"><div class="tournament-section-head"><h3 id="simTournamentHistory">History & standings</h3><div class="tournament-toolbar"><button type="button" data-action="import">Import JSON</button><button type="button" data-action="lichess" hidden>Lichess Bot…</button></div></div><input data-ui="import-file" type="file" accept=".json,application/json" hidden><div data-ui="history"></div></section>`;
    doc.body.appendChild(dialog);
    const el = name => dialog.querySelector('[data-ui="' + name + '"]');
    let context = {}, events = [], runs = [], lastFocus = null, busy = false;
    el('black').value = 'dcc';
    const label = engine => ENGINES[engine] || String(engine || '—');
    const setStatus = (message, error = false) => { el('status').textContent = message || ''; el('status').classList.toggle('is-error', error); };
    const selectedEngines = () => [...el('participants').querySelectorAll('input:checked')].map(input => input.value);
    function readConfig() {
      const format = el('format').value, white = el('white').value, black = el('black').value;
      return { format, white, black, rounds: format === 'single' ? 1 : Number(el('rounds').value), engines: format === 'round-robin' ? selectedEngines() : [...new Set([white, black])],
        openingSource: el('opening-source').value, collectionId: el('collection').value,
        openingMode: el('opening-mode').value, openingMoves: Number(el('opening-moves').value),
        openingCount: el('opening-source').value === 'current' ? 1 : Number(el('opening-count').value),
        limitMode: el('limit-mode').value, depth: Number(el('depth').value), nodes: Number(el('nodes').value),
        moveTimeMs: el('move-time').value === 'custom' ? Number(el('move-custom').value) * 1000 : Number(el('move-time').value),
        baseMs: el('game-time').value === 'custom' ? Number(el('game-custom').value) * 60000 : Number(el('game-time').value),
        incrementMs: Number(el('increment').value), movePauseMs: Number(el('move-pause').value), name: el('name').value.trim() };
    }
    function updateSetup() {
      const cfg = readConfig(), collection = (context.collections || []).find(item => String(item.id) === cfg.collectionId);
      const isCollection = cfg.openingSource === 'collection', count = Math.max(0, Number(collection?.count) || 0);
      el('rounds-label').hidden = cfg.format === 'single'; el('sides').hidden = cfg.format === 'round-robin'; el('participants').hidden = cfg.format !== 'round-robin';
      el('white-label').textContent = cfg.format === 'duel' ? 'Engine A' : 'White engine';
      el('black-label').textContent = cfg.format === 'duel' ? 'Engine B' : 'Black engine';
      el('collection-fields').hidden = !isCollection; el('current-title').hidden = isCollection;
      el('opening-moves-label').hidden = cfg.openingMode !== 'moves';
      el('opening-count').max = String(Math.max(1, count));
      el('collection-note').textContent = count ? `${count} games available. Auto uses opening metadata when available, otherwise up to 9 full moves.` : 'Choose a collection with games in the Game library.';
      dialog.querySelectorAll('[data-limit]').forEach(node => { node.hidden = node.dataset.limit !== cfg.limitMode; });
      el('move-custom-label').hidden = el('move-time').value !== 'custom';
      el('game-custom-label').hidden = el('game-time').value !== 'custom';
      // Hidden settings keep their values but cannot block native form validation.
      el('form').querySelectorAll('input, select').forEach(input => { input.disabled = !!input.closest('[hidden]'); if (input.type === 'number') input.required = true; });
      const participants = cfg.engines.length;
      const perOpening = cfg.format === 'single' ? 1 : cfg.format === 'duel' ? 2 : participants * (participants - 1);
      const openings = Math.max(0, cfg.openingCount || 0), games = perOpening * openings * cfg.rounds;
      el('plan').replaceChildren();
      const total = doc.createElement('strong'); total.textContent = games + (games === 1 ? ' game' : ' games');
      const detail = doc.createElement('span'); detail.textContent = `${openings} opening${openings === 1 ? '' : 's'} × ${perOpening} game${perOpening === 1 ? '' : 's'} × ${cfg.rounds} round${cfg.rounds === 1 ? '' : 's'}${cfg.format === 'round-robin' ? ' · ' + participants + ' engines' : ''}`;
      el('plan').append(total, detail);
      const invalidPair = cfg.format === 'duel' && cfg.white === cfg.black;
      el('start').disabled = busy || (isCollection && !count) || (cfg.format === 'round-robin' && participants < 2) || invalidPair;
      el('start').textContent = busy ? 'Starting…' : cfg.format === 'single' ? 'Start simulation' : 'Start tournament';
      if (invalidPair) detail.textContent = 'Choose two different engines for a duel.';
      else if (cfg.format === 'round-robin' && participants < 2) detail.textContent = 'Select at least two engines.';
    }
    function open(next = {}) {
      context = next || {}; const previousCollection = el('collection').value;
      el('collection').replaceChildren();
      for (const collection of context.collections || []) {
        const option = doc.createElement('option'); option.value = String(collection.id); option.textContent = `${collection.label || collection.name || 'Collection'} (${Number(collection.count) || 0})`; el('collection').appendChild(option);
      }
      if ([...el('collection').options].some(option => option.value === previousCollection)) el('collection').value = previousCollection;
      el('current-title').textContent = context.currentGameTitle || context.title || 'Current board position';
      if (context.openingSource === 'current') el('opening-source').value = 'current';
      dialog.querySelector('[data-action="lichess"]').hidden = typeof host.onLichess !== 'function';
      updateSetup(); setStatus('');
      if (!dialog.open) {
        lastFocus = doc.activeElement;
        if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
        el('format').focus({ preventScroll: true });
      }
    }
    function close() {
      if (!dialog.open) return;
      if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
      if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
    }
    function cell(row, text, heading = false) { const td = doc.createElement(heading ? 'th' : 'td'); td.textContent = String(text ?? '—'); if (heading) td.scope = 'col'; row.appendChild(td); return td; }
    function button(text, action, eventId, extra = {}) {
      const node = doc.createElement('button'); node.type = 'button'; node.textContent = text; node.dataset.action = action; node.dataset.event = eventId;
      Object.assign(node.dataset, extra); return node;
    }
    function eventGames(event) {
      return (event.games || []).map(game => {
        const run = runs.find(candidate => candidate.id === game.runId || (!game.runId && candidate.id === game.id));
        return run ? { ...game, state: run.state, result: run.result, runId: run.id } : game;
      });
    }
    function addStandings(parent, event, games) {
      if (!root.ChessTournament?.standings) return;
      const standings = root.ChessTournament.standings(games, event.config?.engines || []);
      const rows = Array.isArray(standings) ? standings : Object.values(standings || {});
      const table = doc.createElement('table'); table.className = 'tournament-table';
      const caption = doc.createElement('caption'); caption.textContent = 'Standings · completed games'; table.appendChild(caption);
      const head = table.createTHead().insertRow(); ['Engine', 'Played', 'Won', 'Drawn', 'Lost', 'Points'].forEach(text => cell(head, text, true));
      const body = table.createTBody();
      const represented = new Set();
      for (const standing of rows) {
        const engine = standing.engine || standing.id || standing.policy; represented.add(engine);
        const row = body.insertRow();
        [label(engine), standing.played ?? standing.games ?? 0, standing.wins ?? standing.won ?? 0, standing.draws ?? standing.drawn ?? 0, standing.losses ?? standing.lost ?? 0, standing.points ?? standing.score ?? 0].forEach(value => cell(row, value));
      }
      for (const engine of event.config?.engines || []) if (!represented.has(engine)) { const row = body.insertRow(); [label(engine), 0, 0, 0, 0, 0].forEach(value => cell(row, value)); }
      const wrapper = doc.createElement('div'); wrapper.className = 'tournament-table-wrap'; wrapper.appendChild(table); parent.appendChild(wrapper);
      if (root.ChessTournament.crosstable) {
        const cross = root.ChessTournament.crosstable(games, event.config?.engines || []);
        const details = doc.createElement('details'); details.className = 'tournament-games'; details.dataset.disclosure = 'cross:' + event.id;
        const summary = doc.createElement('summary'); summary.textContent = 'Head to head'; details.appendChild(summary);
        const grid = doc.createElement('table'); grid.className = 'tournament-table';
        const caption = doc.createElement('caption'); caption.textContent = 'Points / completed games'; grid.appendChild(caption);
        const heading = grid.createTHead().insertRow(); cell(heading, 'Engine', true);
        for (const engine of cross.engines) cell(heading, label(engine), true);
        const body = grid.createTBody();
        for (const engine of cross.engines) {
          const row = body.insertRow(); cell(row, label(engine));
          for (const opponent of cross.engines) {
            const result = cross.matrix[engine]?.[opponent]; cell(row, result?.played ? `${result.points} / ${result.played}` : '—');
          }
        }
        const scroll = doc.createElement('div'); scroll.className = 'tournament-table-wrap'; scroll.appendChild(grid); details.appendChild(scroll); parent.appendChild(details);
      }
    }
    function render(nextEvents = [], nextRuns = []) {
      events = Array.isArray(nextEvents) ? nextEvents : []; runs = Array.isArray(nextRuns) ? nextRuns : [];
      const history = el('history'), expanded = new Set([...history.querySelectorAll('details[open]')].map(node => node.dataset.disclosure));
      const focus = history.contains(doc.activeElement) ? { ...doc.activeElement.dataset } : null, scroll = dialog.scrollTop;
      const focusedSummary = doc.activeElement?.tagName === 'SUMMARY' ? doc.activeElement.parentElement.dataset.disclosure : null;
      history.replaceChildren();
      if (!events.length) { const empty = doc.createElement('p'); empty.className = 'tournament-note'; empty.textContent = 'No saved events yet. Your games, standings and exports will appear here.'; history.appendChild(empty); }
      for (const event of [...events].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))) {
        const games = eventGames(event), complete = games.filter(game => game.state === 'complete' && ['1-0', '0-1', '1/2-1/2'].includes(game.result)).length;
        const card = doc.createElement('details'); card.className = 'tournament-event'; card.dataset.disclosure = 'event:' + event.id; card.open = expanded.has(card.dataset.disclosure);
        const summary = doc.createElement('summary'), title = doc.createElement('strong'), state = doc.createElement('span');
        title.textContent = event.name || event.config?.name || 'Simulation'; state.textContent = `${event.state || 'saved'} · ${complete}/${games.length} complete`; summary.append(title, state);
        const runIds = new Set(games.map(game => game.runId).filter(Boolean));
        const decisions = runs.filter(run => run.eventId === event.id || runIds.has(run.id)).flatMap(run => run.trace || []);
        const counts = { CDB: 0, SF: 0, unknown: 0, changed: 0 };
        for (const decision of decisions) {
          const source = decision.actual_provider || decision.provider;
          if (source === 'CDB' || source === 'SF') counts[source]++; else counts.unknown++;
          if (decision.changed && (decision.dcc_requested || ['dcc', 'sf-dcc'].includes(decision.policy))) counts.changed++;
        }
        const statistics = doc.createElement('span'); statistics.className = 'tournament-event-stats';
        statistics.textContent = `Actual decisions · CDB ${counts.CDB} · SF ${counts.SF} · DCC changes ${counts.changed}${counts.unknown ? ' · unknown source ' + counts.unknown : ''}`;
        summary.appendChild(statistics); card.appendChild(summary);
        const content = doc.createElement('div'); content.className = 'tournament-event-body';
        const description = doc.createElement('p'); description.className = 'tournament-note';
        const date = new Date(event.createdAt); description.textContent = `${Number.isNaN(date.getTime()) ? '' : date.toLocaleString() + ' · '}${({ single: 'Single game', duel: 'Paired duel', 'round-robin': 'Round robin' })[event.config?.format] || 'Local engines'}`; content.appendChild(description);
        const actions = doc.createElement('div'); actions.className = 'tournament-toolbar';
        if (event.state === 'running') actions.appendChild(button('Pause', 'pause', event.id));
        else if (!['complete', 'completed'].includes(event.state) && complete < games.length) actions.appendChild(button('Resume', 'resume', event.id));
        for (const format of ['pgn', 'csv', 'json']) actions.appendChild(button('Export ' + format.toUpperCase(), 'export', event.id, { format }));
        content.appendChild(actions); addStandings(content, event, games);
        const gameList = doc.createElement('details'); gameList.className = 'tournament-games'; gameList.dataset.disclosure = 'games:' + event.id; gameList.open = expanded.has(gameList.dataset.disclosure);
        const gameSummary = doc.createElement('summary'); gameSummary.textContent = `Games (${games.length})`; gameList.appendChild(gameSummary);
        const wrap = doc.createElement('div'); wrap.className = 'tournament-table-wrap'; const table = doc.createElement('table'); table.className = 'tournament-table';
        const head = table.createTHead().insertRow(); ['#', 'Opening', 'White', 'Black', 'Result / state', 'Review'].forEach(text => cell(head, text, true));
        const body = table.createTBody();
        games.forEach((game, index) => {
          const row = body.insertRow(); [index + 1, game.opening?.label || game.opening?.name || game.opening?.title || game.openingId || 'Current board', label(game.white), label(game.black), game.state === 'complete' && game.result && game.result !== '*' ? game.result : game.state || 'queued'].forEach(value => cell(row, value));
          const review = cell(row, ''); if (game.runId) review.appendChild(button('Open game', 'game', event.id, { run: game.runId })); else review.textContent = '—';
        });
        wrap.appendChild(table); gameList.appendChild(wrap); content.appendChild(gameList); card.appendChild(content); history.appendChild(card);
      }
      history.querySelectorAll('details').forEach(node => { node.open = expanded.has(node.dataset.disclosure); });
      dialog.scrollTop = scroll;
      if (focusedSummary) [...history.querySelectorAll('details')].find(node => node.dataset.disclosure === focusedSummary)?.firstElementChild.focus({ preventScroll: true });
      else if (focus) [...history.querySelectorAll('button')].find(node => node.dataset.action === focus.action && node.dataset.event === focus.event && node.dataset.run === focus.run && node.dataset.format === focus.format)?.focus({ preventScroll: true });
    }
    el('form').addEventListener('change', updateSetup);
    el('form').addEventListener('input', event => { if (event.target.type === 'number') updateSetup(); });
    el('form').addEventListener('submit', async event => {
      event.preventDefault(); if (busy || el('start').disabled || !el('form').reportValidity()) return;
      const config = readConfig(); busy = true; updateSetup(); setStatus('Preparing simulation…');
      try { const started = await host.onStart?.(config); if (started !== false) close(); else setStatus('Simulation was not started.'); }
      catch (error) { setStatus(error.message || String(error), true); }
      finally { busy = false; updateSetup(); }
    });
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('keydown', event => event.stopPropagation());
    dialog.addEventListener('click', async event => {
      const control = event.target.closest('button[data-action]'); if (!control) return;
      const action = control.dataset.action, id = control.dataset.event;
      try {
        if (action === 'close') close();
        else if (action === 'import') el('import-file').click();
        else if (action === 'lichess') { close(); await host.onLichess?.(); }
        else if (action === 'pause') { control.disabled = true; await host.onPause?.(id); }
        else if (action === 'resume') { control.disabled = true; if (await host.onResume?.(id) !== false) close(); }
        else if (action === 'game') { if (await host.onOpenGame?.(control.dataset.run, id) !== false) close(); }
        else if (action === 'export') await host.onExport?.(control.dataset.format, id);
      } catch (error) { setStatus(error.message || String(error), true); }
      finally { control.disabled = false; }
    });
    el('import-file').addEventListener('change', async () => {
      const file = el('import-file').files?.[0]; if (!file) return;
      try { await host.onImport?.(JSON.parse(await file.text())); setStatus('History imported.'); }
      catch (error) { setStatus(error.message || String(error), true); }
      finally { el('import-file').value = ''; }
    });
    render(); updateSetup();
    return { open, close, render, destroy() { close(); dialog.remove(); } };
  }
  root.ChessTournamentUI = { create };
})(window);
