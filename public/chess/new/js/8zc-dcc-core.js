/* ChessDCC 0.7: one bounded, deterministic policy for analysis, Sim and Replay.
 * Sensors are heuristics, not independent evaluations or a claim of Elo gain.
 * Every score is normalized to the mover at the supplied full FEN.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChessDCC = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '0.7.0-new';
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const uciObject = uci => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci || '')
    ? { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] } : null;
  function play(board, uci) {
    const move = uciObject(uci);
    if (!move) return null;
    try { return board.move(move); } catch (_) { return null; }
  }
  function normalize(score, sideToMove, rootSide) {
    return finite(score) ? (score === 0 ? 0 : sideToMove === rootSide ? score : -score) : null;
  }
  function config(input = {}) {
    return {
      depth: clamp(Math.trunc(Number(input.dccDepth) || 5), 1, 10),
      candidates: clamp(Math.trunc(Number(input.dccTopCandidates) || 3), 1, 10),
      window: clamp(Number(input.dccEvalFloor) || 80, 10, 200),
      guard: 10,
      source: input.evalMode === 'proxy' ? 'proxy' : 'direct',
      version: VERSION
    };
  }
  function lz76(s) {
    if (!s) return 0;
    let count = 0, cursor = 0;
    while (cursor < s.length) {
      let length = 1;
      while (cursor + length <= s.length && s.slice(0, cursor).includes(s.slice(cursor, cursor + length))) length++;
      cursor += length;
      count++;
    }
    return count;
  }
  function structure(fen) {
    const s = fen.split(' ')[0];
    return s ? lz76(s) / s.length : 0;
  }
  function sensors(sequence, resultingFen) {
    const seq = sequence.filter(finite);
    const unknown = { shape: 'unknown', label: '?', attack: 0, decay: 0, sustain: 0, release: 0 };
    if (!seq.length) return { stability: null, floor: null, volatility: null, recovery: null,
      endEval: null, momentum: 0, tunnel: false, trend: 'unknown', arrow: '—', adsr: unknown, complexity: structure(resultingFen), bonus: 0 };
    const first = seq[0], last = seq[seq.length - 1];
    const deltas = seq.slice(1).map((v, i) => v - seq[i]);
    const floor = Math.min(...seq);
    const volatility = deltas.length ? deltas.reduce((a, b) => a + Math.abs(b), 0) / deltas.length : null;
    const stability = seq.length >= 3 ? 1 / (1 + volatility / 20) : null;
    const recovery = last - floor;
    const momentum = deltas.length > 1 ? (deltas[deltas.length - 1] - deltas[0]) / (deltas.length - 1) : 0;
    const trend = seq.length < 2 ? 'unknown' : last - first > 15 ? 'rising' : last - first < -15 ? 'falling' : 'stable';
    const attack = Math.max(...seq) - first;
    const peakIndex = seq.indexOf(Math.max(...seq));
    const decay = Math.max(...seq) - Math.min(...seq.slice(peakIndex));
    let shape = 'unknown';
    if (seq.length >= 3) {
      if (Math.max(...seq) - floor < 10) shape = 'sustained';
      else if (last < first - 15) shape = 'collapse';
      else if (attack > 20 && decay > attack / 2) shape = 'spike';
      else if (last > first + 10 && decay < 10) shape = 'building';
      else if (volatility > 15) shape = 'volatile';
      else shape = 'mixed';
    }
    const label = { sustained: '▬', building: '▲', spike: '⚡', collapse: '▼', volatile: '〜', mixed: '◆', unknown: '?' }[shape];
    const tunnel = seq.length >= 4 && Math.min(...seq.slice(1, -1)) < first - 20 && last > first + 10;
    const complexity = structure(resultingFen);
    // Conservative auxiliaries: floor risk dominates a small recovery/structure tie signal.
    const bonus = stability === null ? 0 : stability * 8 - Math.min(25, Math.max(0, first - floor) * 0.25)
      - Math.min(8, volatility * 0.1) + clamp(last - first, -20, 20) * 0.15 - complexity * 2;
    return { stability, floor, volatility, recovery, endEval: last, momentum, tunnel, trend,
      arrow: { rising: '↑', falling: '↓', stable: '→', unknown: '—' }[trend],
      adsr: { shape, label, attack, decay, sustain: last - first, release: 0 }, complexity, bonus };
  }
  function legalMoves(Chess, fen, moves) {
    const seen = new Set();
    return (moves || []).filter(m => {
      if (!m || !finite(m.score) || seen.has(m.move)) return false;
      const board = new Chess(fen);
      if (!play(board, m.move)) return false;
      seen.add(m.move); return true;
    }).map(m => ({ ...m })).sort((a, b) => b.score - a.score || (a.rank || 0) - (b.rank || 0) || a.move.localeCompare(b.move));
  }
  async function analyze({ Chess, fen, settings = {}, moves, getMoves, getPV, getScore, cancelled = () => false, progress = () => {} }) {
    const cfg = config(settings), rootSide = new Chess(fen).turn();
    const stopped = () => { if (cancelled()) { const e = new Error('Stale DCC analysis'); e.name = 'AbortError'; throw e; } };
    const rawResult = moves ? { moves } : await getMoves(fen);
    stopped();
    const allMoves = legalMoves(Chess, fen, rawResult && rawResult.moves);
    if (!allMoves.length) return { candidates: [], dcc1Move: null, allMoves, receipt: { fen, config: cfg, status: 'unknown', calls: 0, reason: 'No legal evaluated move available.' } };
    const best = allMoves[0];
    const selected = allMoves.filter(m => best.score - m.score <= cfg.window).slice(0, cfg.candidates);
    const states = [];
    let calls = 0;
    const started = Date.now();
    let limited = false;
    const maxCalls = selected.length * cfg.depth;
    async function request(fn, position) {
      stopped();
      if (calls >= maxCalls || Date.now() - started >= 20000) { limited = true; return null; }
      calls++;
      const result = await fn(position);
      stopped();
      return result;
    }
    function terminal(state) {
      const b = state.board;
      if (b.in_checkmate()) return b.turn() === rootSide ? -30000 : 30000;
      if (b.in_draw() || b.in_stalemate()) return 0;
      return null;
    }
    async function extend(state, target) {
      state.target = target;
      while (state.plies < target && !state.terminal) {
        stopped();
        const uci = state.pv[state.plies - 1];
        if (!uci || !play(state.board, uci)) { state.short = true; break; }
        state.plies++;
        state.path.push(uci);
        const end = terminal(state);
        state.terminal = end !== null;
        const score = state.terminal ? end : normalize(await request(getScore, state.board.fen()), state.board.turn(), rootSide);
        state.samples.push({ ply: state.plies, score, move: uci });
      }
    }
    const initialTarget = Math.min(3, cfg.depth);
    for (const mv of selected) {
      stopped();
      const board = new Chess(fen);
      play(board, mv.move);
      const state = { mv, board, resultingFen: board.fen(), plies: 1, path: [], samples: [], pv: [], pvDepth: 0, target: initialTarget, short: false };
      const end = terminal(state);
      state.terminal = end !== null;
      if (state.terminal) state.samples.push({ ply: 1, score: end, move: mv.move });
      else {
        const pv = await request(getPV, board.fen());
        state.pv = pv && Array.isArray(pv.pv) ? pv.pv : [];
        state.pvDepth = pv && finite(pv.depth) ? pv.depth : 0;
        state.samples.push({ ply: 1, score: normalize(pv && pv.score, board.turn(), rootSide), move: mv.move });
      }
      await extend(state, initialTarget);
      states.push(state);
      progress(states.length, selected.length);
    }
    const eligible = states.filter(s => best.score - s.mv.score <= cfg.guard);
    const volatile = eligible.some(s => {
      const v = s.samples.map(x => x.score).filter(finite);
      return v.length > 1 && Math.max(...v) - Math.min(...v) > 20;
    });
    // Fund equal additional coverage for every guarded contender, preserving comparability.
    const deepen = cfg.depth > initialTarget && (eligible.length > 1 || volatile);
    if (deepen) for (const state of eligible) await extend(state, cfg.depth);
    stopped();
    const entries = states.map(state => {
      const seq = state.samples.map(x => x.score).filter(finite);
      const metrics = sensors(seq, state.resultingFen);
      const complete = state.samples.every(x => finite(x.score)) && (state.terminal || state.plies >= state.target);
      const status = complete ? 'complete' : seq.length ? 'partial' : 'unknown';
      return { move: state.mv.move, score: state.mv.score, raw: state.mv.score,
        ...metrics, dccScore: state.mv.score + metrics.bonus, evalSequence: seq,
        movePath: state.path, samples: state.samples, pvDepth: state.pvDepth,
        observedPlies: state.plies, targetPlies: state.target, requestedPlies: cfg.depth,
        status, complete, terminal: state.terminal, isMdlPick: false,
        eligible: best.score - state.mv.score <= cfg.guard };
    });
    const contenders = entries.filter(e => e.eligible);
    const sufficientlyMeasured = contenders.every(e => e.complete && (e.terminal || e.stability !== null));
    // A legal mate at the end of one PV is not proof that the root move forces it.
    // Only mate delivered by the candidate itself may bypass the raw-score guard.
    const mating = entries.find(e => e.terminal && e.observedPlies === 1 && e.endEval === 30000);
    let pick = entries.find(e => e.move === best.move);
    let reason = 'Raw best retained: insufficient comparable DCC coverage.';
    if (mating) { pick = mating; reason = 'Verified immediate checkmate.'; }
    else if (Math.abs(best.score) >= 10000) reason = 'Raw engine result protected for decisive / tablebase scores.';
    else if (sufficientlyMeasured) {
      pick = contenders.slice().sort((a, b) => b.dccScore - a.dccScore || b.raw - a.raw || a.move.localeCompare(b.move))[0];
      reason = pick.move === best.move ? 'Raw and DCC agree inside the 10 cp guard.' : 'DCC preference inside the 10 cp guard, with comparable coverage.';
    }
    if (pick) pick.isMdlPick = true;
    entries.sort((a, b) => Number(b.isMdlPick) - Number(a.isMdlPick) || Number(b.eligible) - Number(a.eligible) || b.dccScore - a.dccScore || a.move.localeCompare(b.move));
    const candidates = entries.map(data => ({ move: data.move, raw: data.raw, dcc: Math.round(data.dccScore),
      stability: data.stability, adsr: data.adsr.shape, trend: data.arrow, momentum: data.momentum, tunnel: data.tunnel, data }));
    return { candidates, dcc1Move: pick ? pick.move : best.move, allMoves,
      receipt: { fen, config: cfg, status: entries.every(e => e.complete) ? 'complete' : 'partial', calls, maxCalls,
        completed: entries.filter(e => e.complete).length, total: entries.length, requestedPlies: cfg.depth,
        deepened: deepen, limited, reason, rawBest: best.move, rootSide } };
  }
  return { VERSION, config, normalize, sensors, legalMoves, play, analyze };
});
