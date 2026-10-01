/* Position experiments: raw top-1 versus the shared ChessDCC choice.
   Reports describe observed decisions; they do not estimate playing strength. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChessSim = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '1.2.0';
  const policy = value => ['raw', 'dcc', 'sf', 'sf-dcc'].includes(value) ? value : 'raw';
  const label = value => ({ raw: 'CDB (top 1)', dcc: 'CDB + DCC', sf: 'SF', 'sf-dcc': 'SF + DCC' })[policy(value)];
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
    const source = provider(engine);
    const current = analysis && analysis.receipt?.fen === fen && (!analysis.receipt.provider || analysis.receipt.provider === source) ? analysis : null;
    const measuredDcc = evaluated.find(m => m.move === current?.dcc1Move);
    const dcc = source === 'SF' && current?.receipt?.status !== 'complete' ? null : measuredDcc;
    const chosen = (policy(engine) === 'dcc' || policy(engine) === 'sf-dcc') && dcc ? dcc : raw;
    const mate = raw.scoreType === 'mate';
    const detail = current?.candidates?.find(c => c.move === chosen.move);
    return {
      move: chosen.move, side: new Chess(fen).turn(), policy: policy(engine), provider: source,
      raw_best: raw.move, raw_best_score: raw.score, raw_best_mate_in: mate ? raw.mateIn : null,
      dcc_choice: dcc?.move || null, dcc_raw_gap: !mate && dcc ? raw.score - dcc.score : null,
      raw_score: chosen.score, raw_gap: mate ? null : raw.score - chosen.score,
      exact_ties: mate ? null : evaluated.filter(m => m.score === raw.score).length,
      near_ties: mate ? null : evaluated.filter(m => raw.score - m.score <= 10).length,
      changed: chosen.move !== raw.move,
      coverage: policy(engine) === 'sf' ? 'not requested' : current?.receipt?.status || 'unknown',
      picked_by: policy(engine) === 'raw' ? 'cdb-top1' : policy(engine) === 'sf' ? 'sf-top1' :
        dcc && !mate ? 'dcc' : source === 'CDB' ? 'cdb-fallback' : 'sf-raw-safety',
      dcc_score: detail?.dcc ?? null, stability: detail?.stability ?? null,
      probes: current?.receipt?.calls ?? 0, score_type: raw.scoreType || 'cp',
      root_budget_nodes: search.budgetNodes ?? null, root_nodes: search.rootNodes ?? null,
      root_depth: search.rootDepth ?? null, root_elapsed_ms: search.rootElapsedMs ?? null,
      dcc_extra_nodes: search.extraNodes ?? null, dcc_extra_ms: search.extraElapsedMs ?? null,
      compute_match: source === 'SF' ? 'unmatched: root and DCC probe nodes separately counted' : 'CDB remote',
      coverage_reason: current?.receipt?.reason || null
    };
  }
  function outcome(board, reason = 'paused') {
    if (board.in_checkmate()) return { state: 'complete', result: board.turn() === 'w' ? '0-1' : '1-0', reason: 'checkmate' };
    if (board.in_draw() || board.in_stalemate()) return { state: 'complete', result: '1/2-1/2', reason: 'draw' };
    return { state: reason === 'paused' ? 'paused' : 'incomplete', result: '*', reason };
  }
  function toPGN(Chess, run) {
    const board = new Chess(run.startFen);
    const cfg = run.config || {};
    const tags = {
      Event: 'ChessBest position experiment', Site: 'https://www.mdlxdcc.org/chess/',
      Date: (run.startedAt || '').slice(0, 10).replace(/-/g, '.'), Round: run.id,
      White: label(run.white), Black: label(run.black), Result: run.result || '*',
      SetUp: '1', FEN: run.startFen, Termination: run.reason || run.state,
      ExperimentState: run.state, SimVersion: VERSION, DCCVersion: cfg.version,
      CDBSource: run.white.startsWith('sf') && run.black.startsWith('sf') ? 'not used' : cfg.source,
      SFRootBudgetNodes: run.white.startsWith('sf') || run.black.startsWith('sf') ? run.sfRootNodes ?? '-' : 'not used',
      SFProbeBudgetNodes: run.white === 'sf-dcc' || run.black === 'sf-dcc' ? run.sfProbeNodes ?? '-' : 'not used',
      ComputeMatch: run.white.startsWith('sf') || run.black.startsWith('sf') ? 'unmatched: SF+DCC extra probes' : 'CDB remote',
      DCCDepth: cfg.depth, DCCCandidates: cfg.candidates,
      DCCWindowCp: cfg.window, DCCGuardCp: cfg.guard,
      TimeControl: '-', DCCDeadline: cfg.noDeadline ? 'none' : '20s', UTCStart: run.startedAt,
      DCCCoverageGaps: run.trace.filter(row => row.coverage !== 'complete' && row.coverage !== 'not requested').length
    };
    const lines = Object.entries(tags).map(([k, v]) => `[${k} "${escapeTag(v)}"]`);
    const moves = [];
    run.trace.forEach((row, i) => {
      if (board.fen() !== row.fen) throw new Error('Experiment PGN position mismatch');
      const number = board.fen().split(' ')[5];
      const prefix = board.turn() === 'w' ? `${number}. ` : i === 0 ? `${number}... ` : '';
      const played = board.move({ from: row.move.slice(0, 2), to: row.move.slice(2, 4), promotion: row.move[4] });
      if (!played) throw new Error('Experiment PGN contains an illegal move');
      moves.push(`${prefix}${played.san} {controller=${row.policy}; source=${row.provider}; policy=${row.picked_by}; ${row.score_type === 'mate' ? 'raw_mate_in=' + row.raw_best_mate_in : 'raw_cp=' + row.raw_best_score}; POV=mover; engine1=${row.raw_best}; DCC=${row.dcc_choice || '?'}; changed=${row.changed}; gap_cp=${row.score_type === 'mate' ? 'n/a' : row.raw_gap}; coverage=${row.coverage}; root_budget_nodes=${row.root_budget_nodes ?? '?'}; root_nodes=${row.root_nodes ?? '?'}; root_depth=${row.root_depth ?? '?'}; root_ms=${row.root_elapsed_ms ?? '?'}; dcc_extra_nodes=${row.dcc_extra_nodes ?? '?'}; dcc_extra_ms=${row.dcc_extra_ms ?? '?'}; probes=${row.probes}; compute_match=${row.compute_match}; analysis_ms=${row.elapsed_ms ?? '?'}${row.at_utc ? '; [%timestamp ' + row.at_utc + ']' : ''}}`);
    });
    return lines.join('\n') + '\n\n' + moves.join(' ') + ' ' + (run.result || '*');
  }
  function toCSV(runs) {
    const keys = ['experiment', 'white', 'black', 'start_fen', 'state', 'result', 'termination',
      'ply', 'fen', 'side', 'move', 'policy', 'picked_by', 'raw_best', 'dcc_choice',
      'raw_score', 'raw_gap', 'dcc_raw_gap', 'exact_ties', 'near_ties', 'changed',
      'coverage', 'coverage_reason', 'dcc_score', 'stability', 'probes', 'elapsed_ms',
      'provider', 'score_type', 'raw_best_mate_in', 'root_budget_nodes', 'root_nodes', 'root_depth', 'root_elapsed_ms', 'dcc_extra_nodes', 'dcc_extra_ms', 'compute_match',
      'dcc_version', 'source', 'depth', 'candidates', 'window_cp', 'guard_cp',
      'at_utc', 'turn_ms', 'pause_ms', 'white_elapsed_ms', 'black_elapsed_ms'];
    const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [keys.join(',')];
    for (const run of runs) for (const row of run.trace) {
      const data = { ...row, experiment: run.id, white: label(run.white), black: label(run.black),
        start_fen: run.startFen, state: run.state, result: run.result, termination: run.reason,
        dcc_version: run.config?.version, source: run.config?.source, depth: run.config?.depth,
        candidates: run.config?.candidates, window_cp: run.config?.window, guard_cp: run.config?.guard };
      rows.push(keys.map(k => quote(data[k])).join(','));
    }
    return rows.join('\n') + '\n';
  }
  return { VERSION, policy, label, provider, decision, outcome, toPGN, toCSV };
});
