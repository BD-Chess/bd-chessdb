/* Resumable local engine games. All decision work shares the player's clock. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChessSimRunner = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const abortError = () => Object.assign(new Error('Simulation paused'), { name: 'AbortError' });
  function limits(input = {}) {
    const number = (key, fallback, min, max) => Math.max(min, Math.min(max, Number(input[key]) || fallback));
    return { ...input, limitMode: ['depth', 'nodes', 'move-time', 'game-time'].includes(input.limitMode) ? input.limitMode : 'depth',
      depth: Math.round(number('depth', 15, 1, 128)), nodes: Math.round(number('nodes', 24000, 100, 1e9)),
      moveTimeMs: number('moveTimeMs', 5000, 100, 86400000), baseMs: number('baseMs', 180000, 1000, 86400000),
      incrementMs: Math.max(0, Math.min(60000, Number(input.incrementMs) || 0)),
      movePauseMs: Math.max(0, Math.min(60000, Number(input.movePauseMs) || 0)) };
  }
  function allocation(config, clock, side) {
    if (config.limitMode === 'move-time') return config.moveTimeMs;
    if (config.limitMode !== 'game-time') return null;
    const left = clock.remaining[side];
    return Math.max(1, Math.min(Math.max(1, left - 80), left / 30 + config.incrementMs * 0.8));
  }
  function create({ Chess, SIM, Tournament, SF, Engine, DCC, game, workspace, store,
    getCDB, getPV, getScore, settings, callbacks = {}, now = () => performance.now(), storage = globalThis.localStorage }) {
    let active = null, token = 0, controller = null, provider = null, heartbeat = null, task = null;
    const owner = store.createId('tab'), leaseKey = 'chessPwaSimRunnerLease-v1';
    const emit = (name, ...args) => callbacks[name]?.(...args);
    function acquire() {
      if (!storage) return;
      const old = JSON.parse(storage.getItem(leaseKey) || 'null');
      if (old && old.owner !== owner && old.expires > Date.now()) throw new Error('A simulation is running in another tab. Pause it there first.');
      storage.setItem(leaseKey, JSON.stringify({ owner, expires: Date.now() + 30000 }));
      if (JSON.parse(storage.getItem(leaseKey) || '{}').owner !== owner) throw new Error('Another tab started a simulation.');
    }
    function release() {
      clearInterval(heartbeat); heartbeat = null;
      try { if (JSON.parse(storage?.getItem(leaseKey) || '{}').owner === owner) storage.removeItem(leaseKey); } catch (_) {}
    }
    function checkpoint() {
      if (!active?.run) return;
      active.run.clock = workspace.clockSnapshot();
      active.run.updatedAt = new Date().toISOString();
      store.checkpointSync?.(active.run, active.event);
    }
    async function save(run, event) {
      run.updatedAt = new Date().toISOString();
      run.pgn = SIM.toPGN(Chess, run);
      const item = event.games.find(g => g.runId === run.id);
      if (item) Object.assign(item, { state: run.state, result: run.result, reason: run.reason });
      event.updatedAt = run.updatedAt;
      await store.saveRun(run);
      await store.saveEvent(event);
      emit('change', run, event);
    }
    function restore(run) {
      const probe = new Chess();
      if (run.startPgn) {
        if (!probe.load_pgn(run.startPgn) || probe.fen() !== run.startFen) throw new Error('Saved opening does not match its starting position.');
      } else if (!probe.load(run.startFen)) throw new Error('Saved start position is invalid.');
      for (const row of run.trace) {
        if (probe.fen() !== row.fen || !DCC.play(probe, row.move)) throw new Error('Saved game history is inconsistent.');
      }
      if (!game.load_pgn(probe.pgn())) game.load(probe.fen());
      if (game.fen() !== probe.fen()) throw new Error('Could not restore the saved game.');
      if (run.clock) workspace.restoreClock(run.clock);
      else workspace.start('sim', run.limits.limitMode === 'game-time' ? run.limits : {});
    }
    function history() {
      return { startFen: game.header().FEN || new Chess().fen(),
        moves: game.history({ verbose: true }).map(m => m.from + m.to + (m.promotion || '')) };
    }
    async function pause(reason = 'Paused by user') {
      if (!active) return;
      ++token; controller?.abort(); provider?.destroy(); workspace.endTurn();
      const { run, event } = active;
      if (run && run.state !== 'complete') { run.clock = workspace.clockSnapshot(); run.state = 'paused'; run.reason = reason; }
      event.state = 'paused'; release();
      emit('paused', run, event, reason);
      if (run) await save(run, event); else await store.saveEvent(event);
    }
    function finishOnTime(run, side) {
      Object.assign(run, { state: 'complete', result: side === 'w' ? '0-1' : '1-0', reason: 'time forfeit' });
    }
    async function choose(run, epoch) {
      const fen = game.fen(), side = game.turn(), policy = side === 'w' ? run.white : run.black;
      const stale = () => epoch !== token || game.fen() !== fen;
      const check = () => { if (stale() || controller.signal.aborted) throw abortError(); };
      const useDCC = policy === 'dcc' || policy === 'sf-dcc';
      provider = SF.create({ Chess, Engine, DCC });
      // Warmup is outside the player's time, including a possible hybrid fallback.
      try { await provider.prepare({ signal: controller.signal }); check(); }
      catch (error) { provider.destroy(); provider = null; throw error; }
      const before = workspace.clockSnapshot();
      const budget = allocation(run.limits, before, side);
      if (before.flagged) { provider.destroy(); provider = null; finishOnTime(run, side); return null; }
      workspace.beginTurn();
      const began = now(), deadline = budget == null ? Infinity : began + budget;
      const hardMs = run.limits.limitMode === 'game-time' ? before.remaining[side] : null;
      let timedOut = false;
      const hardTimer = hardMs == null ? null : setTimeout(() => { timedOut = true; controller.abort(); }, hardMs);
      let rootResult, analysis = null, source = 'SF', fallbackReason = null;
      try {
        emit('thinking', run, policy, side);
        if (!policy.startsWith('sf')) {
          const lookupMs = budget == null ? 5000 : Math.max(20, Math.min(1500, budget * 0.25));
          rootResult = await getCDB(fen, { signal: controller.signal, timeoutMs: lookupMs }); check();
          if (rootResult.moves?.length) source = 'CDB';
          else fallbackReason = rootResult.reason || 'CDB has no usable evaluation';
        }
        if (source === 'SF') {
          const remaining = Math.max(1, deadline - now());
          const search = budget == null ? (run.limits.limitMode === 'nodes' ? { nodes: run.limits.nodes } : { depth: run.limits.depth })
            : { movetime: Math.max(1, Math.floor(remaining * (useDCC ? 0.65 : 0.94))) };
          rootResult = await provider.root(fen, { ...search, ...(budget == null ? {} : { deadline }), history: history(), signal: controller.signal }); check();
          if (!rootResult.complete) throw new Error('SF did not finish a complete evaluation; increase the decision time and resume.');
          if (useDCC && rootResult.moves.length && now() < deadline) {
            analysis = await provider.analyzeDCC(fen, rootResult, run.settings, controller.signal, budget == null ? {} : { deadline }); check();
          }
        } else if (useDCC && now() < deadline) {
          const available = () => !stale() && !controller.signal.aborted && now() < deadline;
          const query = fn => async position => {
            if (!available()) throw abortError();
            return fn(position, { signal: controller.signal, timeoutMs: Math.min(5000, Math.max(1, deadline - now())) });
          };
          try {
            analysis = await DCC.analyze({ Chess, fen, settings: run.settings, moves: rootResult.moves,
              getMoves: query(getCDB), getPV: query(getPV), getScore: query(getScore), cancelled: () => !available() });
            analysis.receipt.provider = 'CDB';
          } catch (error) {
            check();
            if (error.name !== 'AbortError') throw error;
            analysis = { candidates: [], dcc1Move: null, receipt: { fen, provider: 'CDB', status: 'partial', reason: 'Decision time expired; CDB top move retained', calls: 0 } };
          }
        }
        check();
        const after = workspace.endTurn();
        if (after.flagged) { finishOnTime(run, side); return null; }
        const ledger = provider.ledger;
        const pick = SIM.decision(Chess, fen, policy, rootResult.moves, analysis, {
          provider: source, fallbackReason, budgetNodes: run.limits.limitMode === 'nodes' ? run.limits.nodes : null,
          budgetDepth: run.limits.limitMode === 'depth' ? run.limits.depth : null, budgetMs: budget,
          rootNodes: source === 'SF' ? ledger.rootNodes : null, rootDepth: source === 'SF' ? ledger.rootDepth : null,
          rootElapsedMs: source === 'SF' ? ledger.rootElapsedMs : null,
          extraNodes: ledger.extraNodes, extraElapsedMs: ledger.extraElapsedMs,
          elapsedMs: now() - began, chargedMs: after.turnSpent,
          clockBeforeMs: before.mode === 'countdown' ? before.remaining[side] : null,
          clockAfterMs: after.mode === 'countdown' ? after.remaining[side] : null,
          incrementMs: run.limits.incrementMs });
        if (!pick) throw new Error('The engine returned no evaluated legal move.');
        return { pick, fen, elapsed: now() - began, analysis, clock: after };
      } catch (error) {
        const after = workspace.endTurn();
        if (timedOut || after.flagged) { finishOnTime(run, side); return null; }
        throw error;
      } finally { clearTimeout(hardTimer); provider.destroy(); provider = null; }
    }
    async function play(run, event, epoch) {
      restore(run); run.state = 'running'; run.reason = ''; active.run = run;
      emit('started', run, event); await save(run, event); if (epoch !== token) return;
      while (epoch === token && !game.game_over()) {
        controller = new AbortController();
        let decision = run.pendingDecision;
        if (!decision || decision.fen !== game.fen()) decision = await choose(run, epoch);
        if (epoch !== token) return;
        run.clock = workspace.clockSnapshot();
        if (!decision) break;
        run.pendingDecision = decision;
        // Save the decision before a viewer pause. Resume never repeats paid thinking.
        await save(run, event); if (epoch !== token) return; emit('decision', decision, run, event);
        const shouldPause = callbacks.shouldPause?.(decision, run);
        if (shouldPause && !run.acknowledgedPauseFen?.includes(decision.fen)) {
          run.acknowledgedPauseFen = [...(run.acknowledgedPauseFen || []), decision.fen];
          await pause(shouldPause); return;
        }
        await new Promise(resolve => {
          const done = () => { clearTimeout(timer); controller.signal.removeEventListener('abort', done); resolve(); };
          const timer = setTimeout(done, Math.max(0, run.limits.movePauseMs));
          controller.signal.addEventListener('abort', done, { once: true });
          if (controller.signal.aborted) done();
        });
        if (epoch !== token) return;
        if (game.fen() !== decision.fen) throw new Error('The displayed position changed during the simulation.');
        const played = DCC.play(game, decision.pick.move);
        if (!played) throw new Error('The engine selected an illegal move.');
        const timing = workspace.recordMove(decision.fen, played, { analysis_ms: decision.elapsed, pause_ms: run.limits.movePauseMs });
        if (!timing) { game.undo(); finishOnTime(run, played.color); break; }
        run.trace.push({ ...decision.pick, ply: run.trace.length + 1, fen: decision.fen, san: played.san,
          elapsed_ms: decision.elapsed, turn_ms: timing.think_ms, pause_ms: run.limits.movePauseMs,
          at_utc: timing.at_utc, clock_ms: timing.clock_ms,
          white_elapsed_ms: timing.white_elapsed_ms, black_elapsed_ms: timing.black_elapsed_ms,
          white_clock_ms: timing.after.mode === 'countdown' ? timing.after.remaining.w : null,
          black_clock_ms: timing.after.mode === 'countdown' ? timing.after.remaining.b : null });
        delete run.pendingDecision;
        run.clock = workspace.clockSnapshot(); run.finalFen = game.fen();
        if (game.game_over()) Object.assign(run, SIM.outcome(game));
        await save(run, event); if (epoch !== token) return; emit('move', run, event);
        // An honest safety pause is resumable and is never scored as a draw.
        if (run.trace.length && run.trace.length % 1000 === 0 && !game.game_over()) { await pause('Safety pause after 1,000 plies; resume to continue.'); return; }
      }
      if (epoch !== token) return;
      if (run.state === 'running') Object.assign(run, SIM.outcome(game));
      run.clock = workspace.endTurn(); run.finalFen = game.fen();
      await save(run, event); emit('finished', run, event);
    }
    async function execute(event) {
      acquire(); const epoch = ++token; active = { event, run: null };
      event.state = 'running';
      try {
      await store.saveEvent(event); if (epoch !== token) return;
      heartbeat = setInterval(() => {
        try { acquire(); checkpoint(); } catch (error) { pause(error.message).catch(e => emit('error', e)); }
      }, 2000);
        for (let i = 0; i < event.games.length && epoch === token; i++) {
          const item = event.games[i]; event.nextIndex = i;
          let run = item.runId ? await store.getRun(item.runId) : null;
          if (run?.state === 'complete') { Object.assign(item, { state: run.state, result: run.result }); continue; }
          if (!run) {
            const opening = item.opening;
            run = { id: store.createId('game'), eventId: event.id, eventName: event.name, pairId: item.pairId || item.pair,
              startedAt: new Date().toISOString(), white: item.white, black: item.black,
              startFen: opening.startFen, startPgn: opening.startPgn, opening, trace: [], state: 'running', result: '*', reason: '',
              limits: event.config, settings: event.settings, config: DCC.config(event.settings), sfRootNodes: event.config.nodes,
              sfProbeNodes: 3000, timeControl: event.config.limitMode === 'game-time' ? { baseMs: event.config.baseMs, incrementMs: event.config.incrementMs } : '-' };
            item.runId = run.id;
          }
          await play(run, event, epoch);
          if (epoch !== token) return;
          if (run.state !== 'complete') { event.state = 'paused'; break; }
          event.nextIndex = i + 1;
        }
        if (epoch === token) { event.state = event.games.every(g => g.state === 'complete') ? 'complete' : 'paused'; await store.saveEvent(event); }
      } catch (error) {
        if (epoch === token) {
          event.state = 'paused';
          if (active.run) { active.run.state = 'incomplete'; active.run.reason = error.message; active.run.clock = workspace.endTurn(); try { await save(active.run, event); } catch (_) {} }
          else { try { await store.saveEvent(event); } catch (_) {} }
          emit('error', error);
        }
      } finally {
        if (epoch === token) { release(); workspace.endTurn(); emit('idle', active?.run, event); active = null; }
      }
    }
    async function launch(event) {
      if (active || task) throw new Error('Pause the active simulation first.');
      task = execute(event).finally(() => { task = null; if (active?.event.id === event.id && event.state !== 'running') active = null; });
      // The UI start action returns after durable creation, not after all games.
      task.catch(error => emit('error', error));
      return copy(event);
    }
    async function start(config, openings) {
      await store.ready();
      if (!openings.length) throw new Error('No usable orthodox opening was selected.');
      const cfg = limits(config);
      const selected = openings.slice(0, Math.max(1, Number(config.openingCount) || 1));
      const games = config.format === 'single' ? [{ id: '1', opening: selected[0], openingId: selected[0].id,
        white: SIM.policy(config.white), black: SIM.policy(config.black), pair: '1', round: 1 }]
        : Tournament.createSchedule({ ...cfg, engines: config.format === 'duel' ? [config.white, config.black] : config.engines }, selected);
      if (!games.length) throw new Error('Choose at least two different engines.');
      const event = { id: store.createId(config.format === 'single' ? 'match' : 'tournament'), name: String(config.name || (config.format === 'single' ? 'Engine game' : 'Engine tournament')).slice(0, 120),
        createdAt: new Date().toISOString(), config: cfg, settings: { ...settings(), dccNoDeadline: true }, state: 'paused', games, nextIndex: 0 };
      await store.saveEvent(event); return launch(event);
    }
    async function resume(id) {
      if (task) { await pause(); await task; }
      await store.ready(); acquire();
      try {
        await store.recoverCheckpoint?.(owner);
        const event = await store.getEvent(id);
        if (!event) throw new Error('Saved tournament not found.');
        return await launch(event);
      } catch (error) { release(); throw error; }
    }
    return { start, resume, pause, checkpoint, busy: () => !!active, current: () => active,
      settled: () => task || Promise.resolve(), limits, allocation };
  }
  return { create, limits, allocation };
});
