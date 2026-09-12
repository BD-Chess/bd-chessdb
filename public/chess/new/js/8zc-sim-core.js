/* Position experiments: raw top-1 versus the shared ChessDCC choice.
   Reports describe observed decisions; they do not estimate playing strength. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChessSim = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '1.0.0';
  const policy = value => value === 'dcc' ? 'dcc' : 'raw';
  const label = value => policy(value) === 'dcc' ? 'CDB + DCC' : 'CDB (top 1)';
  const escapeTag = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ');
  const legal = (Chess, fen, move) => {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move || '')) return false;
    try { return !!new Chess(fen).move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] }); }
    catch (_) { return false; }
  };
  function decision(Chess, fen, engine, moves, analysis) {
    const evaluated = (moves || []).filter(m => Number.isFinite(m.score) && legal(Chess, fen, m.move));
    const raw = evaluated[0];
    if (!raw) return null;
    const current = analysis && analysis.receipt?.fen === fen ? analysis : null;
    const dcc = evaluated.find(m => m.move === current?.dcc1Move);
    const chosen = policy(engine) === 'dcc' && dcc ? dcc : raw;
    const detail = current?.candidates?.find(c => c.move === chosen.move);
    return {
      move: chosen.move, side: new Chess(fen).turn(), policy: policy(engine),
      raw_best: raw.move, raw_best_score: raw.score, dcc_choice: dcc?.move || null,
      dcc_raw_gap: dcc ? raw.score - dcc.score : null,
      raw_score: chosen.score, raw_gap: raw.score - chosen.score,
      exact_ties: evaluated.filter(m => m.score === raw.score).length,
      near_ties: evaluated.filter(m => raw.score - m.score <= 10).length,
      changed: chosen.move !== raw.move,
      coverage: current?.receipt?.status || 'unknown',
      picked_by: policy(engine) === 'raw' ? 'cdb-top1' : dcc ? 'dcc' : 'cdb-fallback',
      dcc_score: detail?.dcc ?? null, stability: detail?.stability ?? null,
      probes: current?.receipt?.calls ?? 0
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
      Event: 'ChessBest position experiment', Site: 'https://www.mdlxdcc.org/chess/new/',
      Date: (run.startedAt || '').slice(0, 10).replace(/-/g, '.'), Round: run.id,
      White: label(run.white), Black: label(run.black), Result: run.result || '*',
      SetUp: '1', FEN: run.startFen, Termination: run.reason || run.state,
      ExperimentState: run.state, SimVersion: VERSION, DCCVersion: cfg.version,
      CDBSource: cfg.source, DCCDepth: cfg.depth, DCCCandidates: cfg.candidates,
      DCCWindowCp: cfg.window, DCCGuardCp: cfg.guard,
      DCCCoverageGaps: run.trace.filter(row => row.coverage !== 'complete').length
    };
    const lines = Object.entries(tags).map(([k, v]) => `[${k} "${escapeTag(v)}"]`);
    const moves = [];
    run.trace.forEach((row, i) => {
      if (board.fen() !== row.fen) throw new Error('Experiment PGN position mismatch');
      const number = board.fen().split(' ')[5];
      const prefix = board.turn() === 'w' ? `${number}. ` : i === 0 ? `${number}... ` : '';
      const played = board.move({ from: row.move.slice(0, 2), to: row.move.slice(2, 4), promotion: row.move[4] });
      if (!played) throw new Error('Experiment PGN contains an illegal move');
      moves.push(`${prefix}${played.san} {policy=${row.picked_by}; raw_cp=${row.raw_score}; POV=mover; CDB=${row.raw_best}; DCC=${row.dcc_choice || '?'}; gap_cp=${row.raw_gap}; exact_ties=${row.exact_ties}; coverage=${row.coverage}; DCC_rank=${row.dcc_score ?? '?'}}`);
    });
    return lines.join('\n') + '\n\n' + moves.join(' ') + ' ' + (run.result || '*');
  }
  function toCSV(runs) {
    const keys = ['experiment', 'white', 'black', 'start_fen', 'state', 'result', 'termination',
      'ply', 'fen', 'side', 'move', 'policy', 'picked_by', 'raw_best', 'dcc_choice',
      'raw_score', 'raw_gap', 'dcc_raw_gap', 'exact_ties', 'near_ties', 'changed',
      'coverage', 'dcc_score', 'stability', 'probes', 'elapsed_ms',
      'dcc_version', 'source', 'depth', 'candidates', 'window_cp', 'guard_cp'];
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
  return { VERSION, policy, label, decision, outcome, toPGN, toCSV };
});
