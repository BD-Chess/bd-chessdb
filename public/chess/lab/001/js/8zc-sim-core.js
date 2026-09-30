/* Position experiments: raw top-1 versus the shared ChessDCC choice.
   Reports describe observed decisions; they do not estimate playing strength. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChessSim = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '1.3.0-lab';
  const policy = value => ['raw', 'dcc', 'sf', 'sf-dcc'].includes(value) ? value : 'raw';
  const label = value => ({ raw: 'CDB/SF', dcc: 'CDB/SF + DCC', sf: 'SF', 'sf-dcc': 'SF + DCC' })[policy(value)];
  const provider = value => policy(value).startsWith('sf') ? 'SF' : 'CDB';
  const escapeTag = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ');
  const legal = (Chess, fen, move) => {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move || '')) return false;
    try { return !!new Chess(fen).move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] }); }
    catch (_) { return false; }
  };
  function decision(Chess, fen, engine, moves, analysis, search = {}) {
    const evaluated = (moves || []).filter(m => Number.isFinite(m.score) && legal(Chess, fen, m.move));
    const raw = evaluated[0];
    if (!raw) return null;
    const source = ['CDB', 'SF'].includes(search.provider || search.actualProvider) ? search.provider || search.actualProvider : provider(engine);
    const requestedDcc = policy(engine) === 'dcc' || policy(engine) === 'sf-dcc';
    const current = analysis && analysis.receipt?.fen === fen && (!analysis.receipt.provider || analysis.receipt.provider === source) ? analysis : null;
    const measuredDcc = evaluated.find(m => m.move === current?.dcc1Move);
    // A retained raw move under incomplete coverage is a safety choice, not a DCC decision.
    const dcc = current?.receipt?.status === 'complete' ? measuredDcc : null;
    const chosen = requestedDcc && dcc ? dcc : raw;
    const mate = raw.scoreType === 'mate';
    const detail = current?.candidates?.find(c => c.move === chosen.move);
    return {
      move: chosen.move, side: new Chess(fen).turn(), policy: policy(engine), provider: source,
      actual_provider: source, requested_provider: provider(engine), dcc_requested: requestedDcc,
      fallback: provider(engine) === 'CDB' && source === 'SF', fallback_reason: search.fallbackReason || null,
      raw_best: raw.move, raw_best_score: raw.score, raw_best_mate_in: mate ? raw.mateIn : null,
      dcc_choice: dcc?.move || null, dcc_raw_gap: !mate && dcc ? raw.score - dcc.score : null,
      raw_score: chosen.score, raw_gap: mate ? null : raw.score - chosen.score,
      exact_ties: mate ? null : evaluated.filter(m => m.score === raw.score).length,
      near_ties: mate ? null : evaluated.filter(m => raw.score - m.score <= 10).length,
      changed: chosen.move !== raw.move,
      coverage: !requestedDcc && !current ? 'not requested' : current?.receipt?.status || 'unknown',
      picked_by: !requestedDcc ? source.toLowerCase() + '-top1' :
        dcc && !mate ? 'dcc' : source === 'CDB' ? 'cdb-fallback' : 'sf-raw-safety',
      dcc_score: detail?.dcc ?? null, stability: detail?.stability ?? null,
      probes: current?.receipt?.calls ?? 0, score_type: raw.scoreType || 'cp',
      root_budget_nodes: search.budgetNodes ?? null, root_nodes: search.rootNodes ?? null,
      root_depth: search.rootDepth ?? null, root_elapsed_ms: search.rootElapsedMs ?? null,
      root_budget_ms: search.budgetMs ?? null, root_budget_depth: search.budgetDepth ?? null,
      dcc_extra_nodes: search.extraNodes ?? null, dcc_extra_ms: search.extraElapsedMs ?? null,
      dcc_budget_ms: search.dccBudgetMs ?? null, dcc_budget_depth: search.dccBudgetDepth ?? null,
      clock_before_ms: search.clockBeforeMs ?? null, clock_after_ms: search.clockAfterMs ?? null,
      white_clock_ms: search.whiteClockMs ?? null, black_clock_ms: search.blackClockMs ?? null,
      charged_ms: search.chargedMs ?? null, overhead_ms: search.overheadMs ?? null,
      increment_ms: search.incrementMs ?? null, elapsed_ms: search.elapsedMs ?? null,
      compute_match: source === 'SF' ? 'unmatched: root and DCC probe nodes separately counted' : 'CDB remote',
      coverage_reason: current?.receipt?.reason || null
    };
  }
  function outcome(board, reason = 'paused') {
    if (board.in_checkmate()) return { state: 'complete', result: board.turn() === 'w' ? '0-1' : '1-0', reason: 'checkmate' };
    if (board.in_draw() || board.in_stalemate()) return { state: 'complete', result: '1/2-1/2', reason: 'draw' };
    return { state: reason === 'paused' ? 'paused' : 'incomplete', result: '*', reason };
  }
  function timeControl(run) {
    if (typeof run.timeControl === 'string' && run.timeControl) return run.timeControl;
    const value = run.timeControl || run.clockConfig || {};
    const base = value.baseMs ?? value.initialMs ?? run.baseMs;
    const increment = value.incrementMs ?? run.incrementMs ?? 0;
    return Number.isFinite(base) ? `${base / 1000}+${increment / 1000}` : '-';
  }
  function clockText(ms) {
    if (!Number.isFinite(ms)) return null;
    const value = Math.max(0, Math.round(ms)), hours = Math.floor(value / 3600000);
    const minutes = Math.floor(value % 3600000 / 60000), seconds = value % 60000 / 1000;
    return `${hours}:${String(minutes).padStart(2, '0')}:${seconds.toFixed(3).padStart(6, '0')}`;
  }
  const commentText = value => String(value ?? '').replace(/[{}\r\n]/g, ' ');
  function toPGN(Chess, run) {
    let board, opening = [], openingHeaders = {}, initialFen = run.startFen;
    if (run.startPgn && run.startPgn.trim()) {
      board = new Chess();
      if (!board.load_pgn(run.startPgn) || board.fen() !== run.startFen) throw new Error('Experiment PGN opening position mismatch');
      openingHeaders = { ...board.header() };
      opening = board.history({ verbose: true });
      while (board.undo()) { /* recover the original position, including a supplied FEN */ }
      initialFen = board.fen();
    }
    board = new Chess(initialFen);
    const cfg = run.config || {}, trace = run.trace || [];
    const actualSources = [...new Set(trace.map(row => row.actual_provider || row.provider).filter(Boolean))];
    const metadata = run.opening?.sourceHeaders || run.sourceHeaders || openingHeaders;
    const tags = {
      Event: run.eventName || ((run.tournamentId || run.eventId) ? 'ChessBest LAB tournament' : 'ChessBest position experiment'), Site: 'https://www.mdlxdcc.org/chess/new/',
      Date: (run.startedAt || '').slice(0, 10).replace(/-/g, '.'), Round: run.round ?? run.id,
      White: label(run.white), Black: label(run.black), Result: run.result || '*',
      Termination: run.reason || run.state, ExperimentState: run.state,
      SimVersion: VERSION, DCCVersion: cfg.version,
      ActualSources: actualSources.join(', ') || 'none',
      CDBSource: actualSources.includes('CDB') ? cfg.source || 'remote' : 'not used',
      SearchLimitMode: run.limits?.limitMode || 'legacy',
      SFRootBudgetNodes: run.limits ? run.limits.limitMode === 'nodes' ? run.limits.nodes : '-' : run.sfRootNodes ?? '-',
      SFRootBudgetDepth: run.limits?.limitMode === 'depth' ? run.limits.depth : '-',
      SFRootBudgetMs: run.limits?.limitMode === 'move-time' ? run.limits.moveTimeMs : run.limits?.limitMode === 'game-time' ? 'per-move allocation' : '-',
      SFProbeBudgetNodes: run.sfProbeNodes ?? '-',
      ComputeMatch: 'Actual source, root and DCC work recorded per move',
      DCCDepth: cfg.depth, DCCCandidates: cfg.candidates, DCCWindowCp: cfg.window, DCCGuardCp: cfg.guard,
      TimeControl: timeControl(run), DCCDeadline: timeControl(run) !== '-' || run.limits?.limitMode === 'move-time' ? 'per-move budget' : cfg.noDeadline ? 'none' : '20s', UTCStart: run.startedAt,
      OpeningPlies: opening.length, BookBoundaryPly: run.openingPlies ?? run.bookPlies ?? opening.length,
      DCCCoverageGaps: trace.filter(row => row.coverage !== 'complete' && row.coverage !== 'not requested').length
    };
    if (initialFen !== new Chess().fen()) { tags.SetUp = '1'; tags.FEN = initialFen; }
    if (run.openingId || run.opening?.id) tags.OpeningId = run.openingId || run.opening.id;
    if (run.openingName || run.opening?.name) tags.Opening = run.openingName || run.opening.name;
    if (run.tournamentId || run.eventId) tags.TournamentId = run.tournamentId || run.eventId;
    for (const key of ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result', 'ECO', 'Opening', 'Variation'])
      if (metadata[key]) tags['OpeningSource' + key] = metadata[key];
    const lines = Object.entries(tags).filter(([, value]) => value !== undefined && value !== null).map(([k, v]) => `[${k} "${escapeTag(v)}"]`);
    const moves = [];
    const appendMove = (move, comment) => {
      const number = board.fen().split(' ')[5];
      const prefix = board.turn() === 'w' ? `${number}. ` : moves.length === 0 ? `${number}... ` : '';
      const played = board.move(typeof move === 'string' ? { from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] } : move);
      if (!played) throw new Error('Experiment PGN contains an illegal move');
      moves.push(`${prefix}${played.san}${comment ? ' {' + comment + '}' : ''}`);
    };
    for (const move of opening) appendMove({ from: move.from, to: move.to, promotion: move.promotion }, 'book; source=opening');
    if (board.fen() !== run.startFen) throw new Error('Experiment PGN opening position mismatch');
    const boundary = `{Opening boundary: ${opening.length} plies; engine play begins here}`;
    if (moves.length) moves[moves.length - 1] += ' ' + boundary;
    else moves.push(boundary);
    trace.forEach(row => {
      if (board.fen() !== row.fen) throw new Error('Experiment PGN position mismatch');
      // A comment before Black's first move does not replace its move-number prefix.
      if (!opening.length && trace[0] === row && board.turn() === 'b') moves.push(board.fen().split(' ')[5] + '...');
      const fields = [`controller=${row.policy}`, `source=${row.actual_provider || row.provider}`, `policy=${row.picked_by}`,
        row.score_type === 'mate' ? 'raw_mate_in=' + row.raw_best_mate_in : 'raw_cp=' + row.raw_best_score,
        'POV=mover', `engine1=${row.raw_best}`, `DCC=${row.dcc_choice || '?'}`, `changed=${row.changed}`,
        `gap_cp=${row.score_type === 'mate' ? 'n/a' : row.raw_gap}`, `coverage=${row.coverage}`];
      for (const key of ['fallback_reason', 'coverage_reason', 'root_budget_nodes', 'root_budget_ms', 'root_budget_depth', 'root_nodes', 'root_depth', 'root_elapsed_ms',
        'dcc_budget_ms', 'dcc_budget_depth', 'dcc_extra_nodes', 'dcc_extra_ms', 'charged_ms', 'overhead_ms', 'increment_ms', 'probes', 'compute_match'])
        if (row[key] !== undefined && row[key] !== null) fields.push(`${key}=${commentText(row[key])}`);
      if (row.elapsed_ms !== undefined && row.elapsed_ms !== null) fields.push('analysis_ms=' + row.elapsed_ms);
      // The committed move clock includes its increment; the decision clock precedes it.
      const clock = row.clock_ms ?? (row.side === 'w' ? row.white_clock_ms : row.black_clock_ms) ?? row.clock_after_ms;
      if (Number.isFinite(clock)) fields.push(`[%clk ${clockText(clock)}]`);
      if (Number.isFinite(row.charged_ms ?? row.turn_ms)) fields.push(`[%emt ${clockText(row.charged_ms ?? row.turn_ms)}]`);
      if (row.at_utc) fields.push(`[%timestamp ${commentText(row.at_utc)}]`);
      appendMove(row.move, fields.join('; '));
    });
    return lines.join('\n') + '\n\n' + moves.join(' ') + ' ' + (run.result || '*');
  }
  function toCSV(runs) {
    const keys = ['experiment', 'white', 'black', 'start_fen', 'state', 'result', 'termination', 'tournament_id', 'opening_id', 'opening_name', 'opening_plies', 'time_control',
      'ply', 'fen', 'side', 'move', 'policy', 'picked_by', 'raw_best', 'dcc_choice',
      'raw_score', 'raw_gap', 'dcc_raw_gap', 'exact_ties', 'near_ties', 'changed',
      'coverage', 'coverage_reason', 'dcc_score', 'stability', 'probes', 'elapsed_ms',
      'provider', 'actual_provider', 'requested_provider', 'fallback', 'fallback_reason', 'dcc_requested', 'score_type', 'raw_best_mate_in', 'root_budget_nodes', 'root_nodes', 'root_depth', 'root_elapsed_ms', 'dcc_extra_nodes', 'dcc_extra_ms', 'compute_match',
      'dcc_version', 'source', 'depth', 'candidates', 'window_cp', 'guard_cp',
      'at_utc', 'turn_ms', 'pause_ms', 'white_elapsed_ms', 'black_elapsed_ms', 'root_budget_ms', 'root_budget_depth', 'dcc_budget_ms', 'dcc_budget_depth', 'clock_before_ms', 'clock_after_ms', 'white_clock_ms', 'black_clock_ms', 'charged_ms', 'overhead_ms', 'increment_ms'];
    const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [keys.join(',')];
    for (const run of runs) for (const row of run.trace) {
      const data = { ...row, experiment: run.id, white: label(run.white), black: label(run.black),
        start_fen: run.startFen, state: run.state, result: run.result, termination: run.reason,
        tournament_id: run.tournamentId || run.eventId, opening_id: run.openingId || run.opening?.id, opening_name: run.openingName || run.opening?.name,
        opening_plies: run.openingPlies ?? run.bookPlies ?? run.opening?.openingPlies, time_control: timeControl(run),
        dcc_version: run.config?.version, source: run.config?.source, depth: run.config?.depth,
        candidates: run.config?.candidates, window_cp: run.config?.window, guard_cp: run.config?.guard };
      rows.push(keys.map(k => quote(data[k])).join(','));
    }
    return rows.join('\n') + '\n';
  }
  return { VERSION, policy, label, provider, decision, outcome, timeControl, clockText, toPGN, toCSV };
});
