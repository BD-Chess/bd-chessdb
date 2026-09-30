/* ChessDCC 0.8: deterministic sampled analysis for analysis, Sim and Replay.
 * Sensors are heuristics, not independent evaluations or a claim of Elo gain.
 * Every score is normalized to the mover at the supplied full FEN.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChessDCC = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '0.8.0-new';
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
      noDeadline: input.dccNoDeadline === true,
      policy: input.dccPolicy === 'legacy' ? 'legacy' : 'balanced',
      requestBudget: input.dccRequestBudget !== null && input.dccRequestBudget !== undefined && finite(Number(input.dccRequestBudget)) ? clamp(Math.trunc(Number(input.dccRequestBudget)), 0, 10000) : null,
      defense: input.dccDefenseCheck === true,
      defenseCandidates: clamp(Math.trunc(Number(input.dccDefenseCandidates) || 2), 1, 4),
      defensePlies: clamp(Math.trunc(Number(input.dccDefensePlies) || 3), 2, 6),
      structureMode: input.dccStructureMode === 'descriptive' ? 'descriptive' : input.dccStructureMode === 'rank' || input.dccPolicy === 'legacy' ? 'rank' : 'descriptive',
      sensors: Object.fromEntries(['stability', 'floor', 'volatility', 'trend', 'structure'].map(name =>
        [name, !input.dccSensors || input.dccSensors[name] !== false])),
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
  function sensors(sequence, resultingFen, options = {}) {
    const cfg = options.version ? options : config(options);
    const gaps = sequence.map((value, index) => finite(value) ? null : index + 1).filter(value => value !== null);
    const seq = sequence.filter(finite);
    const emptyContributions = { stability: 0, floor: 0, volatility: 0, trend: 0, structure: 0 };
    const unknown = { shape: 'unknown', label: '?', attack: 0, decay: 0, sustain: 0, release: 0 };
    if (!seq.length) return { stability: null, floor: null, volatility: null, recovery: null,
      endEval: null, momentum: 0, tunnel: false, trend: 'unknown', arrow: '—', adsr: unknown, complexity: structure(resultingFen), bonus: 0, gaps, sensorContributions: emptyContributions };
    const first = seq[0], last = seq[seq.length - 1];
    // Missing samples break a trajectory; never invent an adjacent transition across a gap.
    const deltaSource = cfg.policy === 'legacy' ? seq : sequence;
    const deltas = deltaSource.slice(1).map((v, i) => finite(v) && finite(deltaSource[i]) ? v - deltaSource[i] : null).filter(finite);
    const floor = Math.min(...seq);
    const volatility = deltas.length ? deltas.reduce((a, b) => a + Math.abs(b), 0) / deltas.length : null;
    const stability = seq.length >= 3 && (cfg.policy === 'legacy' || !gaps.length) ? 1 / (1 + volatility / 20) : null;
    const recovery = last - floor;
    const momentum = deltas.length > 1 && (cfg.policy === 'legacy' || !gaps.length) ? (deltas[deltas.length - 1] - deltas[0]) / (deltas.length - 1) : 0;
    const trend = seq.length < 2 || (cfg.policy !== 'legacy' && gaps.length) ? 'unknown' : last - first > 15 ? 'rising' : last - first < -15 ? 'falling' : 'stable';
    const attack = Math.max(...seq) - first;
    const peakIndex = seq.indexOf(Math.max(...seq));
    const decay = Math.max(...seq) - Math.min(...seq.slice(peakIndex));
    let shape = 'unknown';
    if (seq.length >= 3 && (cfg.policy === 'legacy' || !gaps.length)) {
      if (Math.max(...seq) - floor < 10) shape = 'sustained';
      else if (last < first - 15) shape = 'collapse';
      else if (attack > 20 && decay > attack / 2) shape = 'spike';
      else if (last > first + 10 && decay < 10) shape = 'building';
      else if (volatility > 15) shape = 'volatile';
      else shape = 'mixed';
    }
    const label = { sustained: '▬', building: '▲', spike: '⚡', collapse: '▼', volatile: '〜', mixed: '◆', unknown: '?' }[shape];
    const tunnel = (cfg.policy === 'legacy' || !gaps.length) && seq.length >= 4 && Math.min(...seq.slice(1, -1)) < first - 20 && last > first + 10;
    const complexity = structure(resultingFen);
    // Conservative auxiliaries: floor risk dominates a small recovery/structure tie signal.
    const sensorContributions = stability === null ? emptyContributions : {
      stability: cfg.sensors.stability ? stability * 8 : 0,
      floor: cfg.sensors.floor ? -Math.min(25, Math.max(0, first - floor) * 0.25) : 0,
      volatility: cfg.sensors.volatility ? -Math.min(8, volatility * 0.1) : 0,
      trend: cfg.sensors.trend ? clamp(last - first, -20, 20) * 0.15 : 0,
      structure: cfg.sensors.structure && cfg.structureMode === 'rank' ? -complexity * 2 : 0
    };
    const bonus = Object.values(sensorContributions).reduce((sum, value) => sum + value, 0);
    return { stability, floor, volatility, recovery, endEval: finite(sequence[sequence.length - 1]) ? last : null, momentum, tunnel, trend,
      arrow: { rising: '↑', falling: '↓', stable: '→', unknown: '—' }[trend],
      adsr: { shape, label, attack, decay, sustain: last - first, release: 0 }, complexity, bonus, gaps, sensorContributions };
  }
  function legalMoves(Chess, fen, moves) {
    const seen = new Set();
    return (moves || []).filter(m => {
      if (!m || !finite(m.score) || seen.has(m.move)) return false;
      const board = new Chess(fen);
      if (!play(board, m.move)) return false;
      seen.add(m.move); return true;
    }).map(m => ({ ...m })).sort((a, b) => b.score - a.score || (a.rank || 0) - (b.rank || 0)
      || (a.sourceOrder ?? Infinity) - (b.sourceOrder ?? Infinity) || a.move.localeCompare(b.move));
  }
  // Geometric relations describe a position, not a tactical proof. Pins, recaptures and
  // exchanges must be tested by a concrete line before becoming an analysis question.
  function relationships(Chess, fen) {
    const board = new Chess(fen), pieces = [];
    for (let rank = 1; rank <= 8; rank++) for (let file = 0; file < 8; file++) {
      const square = 'abcdefgh'[file] + rank, piece = board.get(square);
      if (piece) pieces.push({ square, ...piece, file, rank, attackers: [], defenders: [] });
    }
    function attacks(a, b) {
      const dx = b.file - a.file, dy = b.rank - a.rank, ax = Math.abs(dx), ay = Math.abs(dy);
      if (a.type === 'p') return ax === 1 && dy === (a.color === 'w' ? 1 : -1);
      if (a.type === 'n') return ax * ay === 2;
      if (a.type === 'k') return Math.max(ax, ay) === 1;
      const diagonal = ax === ay && ax > 0, straight = (dx === 0 || dy === 0) && ax + ay > 0;
      if (!(a.type === 'q' && (diagonal || straight) || a.type === 'b' && diagonal || a.type === 'r' && straight)) return false;
      const sx = Math.sign(dx), sy = Math.sign(dy);
      for (let x = a.file + sx, y = a.rank + sy; x !== b.file || y !== b.rank; x += sx, y += sy)
        if (board.get('abcdefgh'[x] + y)) return false;
      return true;
    }
    for (const target of pieces) for (const source of pieces) if (source !== target && attacks(source, target))
      target[source.color === target.color ? 'defenders' : 'attackers'].push(source.square);
    return { fen, semantics: 'geometric attacks; pinned pieces may not have a legal capture', pieces };
  }
  function tacticalQuestions(Chess, fen, testedBranches = []) {
    const questions = [];
    for (const branch of testedBranches) {
      if (!branch.complete || !finite(branch.endEval) || !Array.isArray(branch.moves)) continue;
      const board = new Chess(fen), san = [];
      let valid = true;
      for (const uci of branch.moves) { const move = play(board, uci); if (!move) { valid = false; break; } san.push(move.san); }
      if (!valid || !san.length) continue;
      const graph = relationships(Chess, board.fen());
      for (const piece of graph.pieces) {
        if (piece.type === 'k' || !piece.attackers.length) continue;
        if (!piece.defenders.length) questions.push({ kind: 'undefended-target', square: piece.square,
          question: 'After ' + san.join(' ') + ', can the attacked piece on ' + piece.square + ' be saved or its loss justified?',
          moves: branch.moves.slice(), san, fen: board.fen(), endEval: branch.endEval, contributesToRank: false });
      }
      const duties = new Map();
      for (const piece of graph.pieces.filter(p => p.attackers.length && p.defenders.length === 1)) {
        const defender = piece.defenders[0];
        duties.set(defender, [...(duties.get(defender) || []), piece.square]);
      }
      for (const [defender, targets] of duties) if (targets.length > 1) questions.push({ kind: 'multiple-defense-duties', square: defender,
        question: 'After ' + san.join(' ') + ', can ' + defender + ' continue defending ' + targets.join(' and ') + '?',
        moves: branch.moves.slice(), san, fen: board.fen(), endEval: branch.endEval, contributesToRank: false });
    }
    return questions.slice(0, 12);
  }
  const scoreOf = value => finite(value) ? value : value && finite(value.score) ? value.score : null;
  function sample(position, ply, move, value, rootSide, side, kind, terminal = false) {
    return { ply, move, fen: position, score: terminal ? scoreOf(value) : normalize(scoreOf(value), side, rootSide),
      kind, sourceDepth: value && finite(value.depth) ? value.depth : null,
      source: value && typeof value.source === 'string' ? value.source : null,
      retrievedAt: value && value.retrievedAt || null, terminal };
  }
  async function analyze({ Chess, fen, settings = {}, moves, getMoves, getPV, getScore, cancelled = () => false, progress = () => {} }) {
    const cfg = config(settings), rootSide = new Chess(fen).turn();
    const stopped = () => { if (cancelled()) { const e = new Error('Stale DCC analysis'); e.name = 'AbortError'; throw e; } };
    stopped();
    const rawResult = moves ? { moves } : await getMoves(fen);
    stopped();
    const allMoves = legalMoves(Chess, fen, rawResult && rawResult.moves);
    if (!allMoves.length) return { candidates: [], dcc1Move: null, allMoves, receipt: { fen, config: cfg, status: 'unknown', calls: 0, reason: 'No legal evaluated move available.',
      coverage: { legalEvaluated: 0, eligible: 0, inspected: 0, eligibleInspected: 0, omitted: [] } } };
    const best = allMoves[0];
    const guarded = allMoves.filter(m => best.score - m.score <= cfg.guard);
    const inWindow = allMoves.filter(m => best.score - m.score <= cfg.window);
    const selected = cfg.policy === 'legacy' ? inWindow.slice(0, cfg.candidates) : [
      ...guarded, ...inWindow.filter(m => best.score - m.score > cfg.guard).slice(0, Math.max(0, cfg.candidates - guarded.length))
    ];
    const selectedIds = new Set(selected.map(m => m.move));
    const coverage = { legalEvaluated: allMoves.length, totalLegalMoves: new Chess(fen).moves().length, unscoredLegal: new Chess(fen).moves().length - allMoves.length, eligible: guarded.length, inspected: selected.length,
      eligibleInspected: selected.filter(m => best.score - m.score <= cfg.guard).length,
      omitted: allMoves.filter(m => !selectedIds.has(m.move)).map(m => ({ move: m.move, raw: m.score,
        eligible: best.score - m.score <= cfg.guard, reason: best.score - m.score > cfg.window ? 'outside-inspection-window' : 'inspection-cap' })) };
    let calls = 0, limited = false;
    const errors = [], started = Date.now();
    const defenseRoots = selected.filter(m => best.score - m.score <= cfg.guard).length;
    const plannedCalls = selected.length * cfg.depth + (cfg.defense ? defenseRoots * (1 + cfg.defenseCandidates * (cfg.defensePlies - 1)) : 0);
    const maxCalls = cfg.requestBudget === null ? plannedCalls : Math.min(plannedCalls, cfg.requestBudget);
    async function request(fn, position, kind) {
      stopped();
      if (calls >= maxCalls || (!cfg.noDeadline && Date.now() - started >= 20000)) { limited = true; return null; }
      if (typeof fn !== 'function') { errors.push({ kind, fen: position, reason: 'source-unavailable' }); return null; }
      calls++;
      try { const result = await fn(position); stopped(); progress(calls, maxCalls, { stage: kind }); return result; }
      catch (error) { stopped(); if (error && error.name === 'AbortError') throw error;
        errors.push({ kind, fen: position, reason: 'source-error' }); return null; }
    }
    function terminal(board) {
      if (board.in_checkmate()) return board.turn() === rootSide ? -30000 : 30000;
      if (board.in_draw() || board.in_stalemate()) return 0;
      return null;
    }
    const initialTarget = Math.min(3, cfg.depth);
    const states = selected.map(mv => {
      const board = new Chess(fen); play(board, mv.move);
      return { mv, board, resultingFen: board.fen(), plies: 1, path: [], samples: [], pv: [], pvDepth: 0,
        target: initialTarget, short: false, terminal: false, defense: null };
    });
    // Every root receives its first observation before any root receives a second.
    for (const state of states) {
      stopped();
      const end = terminal(state.board); state.terminal = end !== null;
      if (state.terminal) state.samples.push(sample(state.board.fen(), 1, state.mv.move, end, rootSide, state.board.turn(), 'terminal', true));
      else {
        const pv = await request(getPV, state.board.fen(), 'pv');
        state.pv = pv && Array.isArray(pv.pv) ? pv.pv : [];
        state.pvDepth = pv && finite(pv.depth) ? pv.depth : 0;
        state.samples.push(sample(state.board.fen(), 1, state.mv.move, pv, rootSide, state.board.turn(), 'pv'));
      }
    }
    async function extendOne(state) {
      if (state.terminal || state.short || state.plies >= state.target) return;
      stopped();
      const uci = state.pv[state.plies - 1];
      if (!uci || !play(state.board, uci)) { state.short = true; return; }
      state.plies++; state.path.push(uci);
      const end = terminal(state.board); state.terminal = end !== null;
      const value = state.terminal ? end : await request(getScore, state.board.fen(), 'score');
      state.samples.push(sample(state.board.fen(), state.plies, uci, value, rootSide, state.board.turn(), state.terminal ? 'terminal' : 'score', state.terminal));
    }
    async function rounds(funded) {
      while (funded.some(s => !s.terminal && !s.short && s.plies < s.target))
        for (const state of funded) await extendOne(state);
    }
    await rounds(states);
    const eligible = states.filter(s => best.score - s.mv.score <= cfg.guard);
    const volatile = eligible.some(s => { const v = s.samples.map(x => x.score).filter(finite); return v.length > 1 && Math.max(...v) - Math.min(...v) > 20; });
    const deepen = cfg.depth > initialTarget && (eligible.length > 1 || volatile);
    if (deepen) { for (const state of eligible) state.target = cfg.depth; await rounds(eligible); }
    if (cfg.defense) {
      // A separate bounded opponent-response sample challenges every guarded candidate.
      // It is not exhaustive minimax and neither a PV mate nor an endpoint proves a forced root result.
      for (const state of eligible) {
        stopped();
        const after = new Chess(state.resultingFen), end = terminal(after);
        if (end !== null) { state.defense = { enabled: true, complete: true, status: 'terminal', branches: [], legalEvaluated: 0,
          tested: 0, omitted: [], worstEval: end, allLegalRepliesCovered: true }; continue; }
        const response = await request(getMoves, state.resultingFen, 'defense-moves');
        const replies = legalMoves(Chess, state.resultingFen, response && response.moves);
        const chosen = replies.slice(0, cfg.defenseCandidates);
        const branches = chosen.map(reply => {
          const board = new Chess(state.resultingFen); const played = play(board, reply.move);
          return { move: reply.move, rawOpponent: reply.score, rootRaw: normalize(reply.score, after.turn(), rootSide),
            board, san: played.san, moves: [state.mv.move, reply.move], samples: [], pv: [], plies: 2,
            target: cfg.defensePlies, short: false, terminal: false };
        });
        state.defense = { enabled: true, complete: false, status: 'pending', branches, legalEvaluated: replies.length,
          totalLegalReplies: after.moves().length, tested: 0, omitted: replies.slice(cfg.defenseCandidates).map(m => m.move), worstEval: null,
          allLegalRepliesCovered: chosen.length === after.moves().length };
      }
      // Interleave one defense branch per root, then its next branch. Later plies
      // receive the same round-robin treatment, including short/unknown sources.
      const branchStates = [];
      for (let i = 0; i < cfg.defenseCandidates; i++) for (const state of eligible) {
        const branch = state.defense.branches[i]; if (!branch) continue;
        branchStates.push(branch);
        const end = terminal(branch.board); branch.terminal = end !== null;
        const pv = branch.terminal ? end : await request(getPV, branch.board.fen(), 'defense-pv');
        branch.pv = pv && Array.isArray(pv.pv) ? pv.pv : [];
        branch.samples.push(sample(branch.board.fen(), 2, branch.move, pv, rootSide, branch.board.turn(), branch.terminal ? 'terminal' : 'defense-pv', branch.terminal));
      }
      while (branchStates.some(b => !b.terminal && !b.short && b.plies < b.target)) for (const branch of branchStates) {
        if (branch.terminal || branch.short || branch.plies >= branch.target) continue;
        stopped();
        const uci = branch.pv[branch.plies - 2];
        if (!uci || !play(branch.board, uci)) { branch.short = true; continue; }
        branch.plies++; branch.moves.push(uci);
        const end = terminal(branch.board); branch.terminal = end !== null;
        const value = branch.terminal ? end : await request(getScore, branch.board.fen(), 'defense-score');
        branch.samples.push(sample(branch.board.fen(), branch.plies, uci, value, rootSide, branch.board.turn(), branch.terminal ? 'terminal' : 'defense-score', branch.terminal));
      }
      for (const state of eligible) {
        const defense = state.defense;
        if (defense.status === 'terminal') continue;
        defense.branches = defense.branches.map(branch => {
          const complete = branch.samples.length > 0 && branch.samples.every(s => finite(s.score)) && (branch.terminal || branch.plies >= branch.target);
          const last = branch.samples[branch.samples.length - 1];
          return { move: branch.move, san: branch.san, rawOpponent: branch.rawOpponent, rootRaw: branch.rootRaw,
            moves: branch.moves, samples: branch.samples, observedPlies: branch.plies, targetPlies: branch.target,
            complete, terminal: branch.terminal, endEval: last && finite(last.score) ? last.score : null };
        });
        defense.tested = defense.branches.filter(b => b.complete).length;
        defense.complete = defense.branches.length > 0 && defense.branches.every(b => b.complete);
        defense.status = defense.complete ? 'sampled' : defense.branches.length ? 'partial' : 'unknown';
        const values = defense.branches.map(b => b.endEval).filter(finite);
        defense.worstEval = values.length ? Math.min(...values) : null;
        defense.questions = tacticalQuestions(Chess, fen, defense.branches);
      }
    }
    stopped();
    const entries = states.map(state => {
      const seq = state.samples.map(x => x.score), known = seq.filter(finite);
      const metrics = sensors(seq, state.resultingFen, cfg);
      const complete = state.samples.length > 0 && state.samples.every(x => finite(x.score)) && (state.terminal || state.plies >= state.target);
      return { move: state.mv.move, score: state.mv.score, raw: state.mv.score,
        ...metrics, dccScore: state.mv.score + metrics.bonus, evalSequence: seq,
        movePath: state.path, samples: state.samples, pvDepth: state.pvDepth,
        observedPlies: state.plies, targetPlies: state.target, requestedPlies: cfg.depth,
        status: complete ? 'complete' : known.length ? 'partial' : 'unknown', complete, terminal: state.terminal, isMdlPick: false,
        eligible: best.score - state.mv.score <= cfg.guard, defense: state.defense, providerOrder: allMoves.findIndex(m => m.move === state.mv.move) };
    });
    const contenders = entries.filter(e => e.eligible);
    const sufficientlyMeasured = contenders.every(e => e.complete && (e.terminal || e.stability !== null));
    const defensesMeasured = !cfg.defense || contenders.every(e => e.defense && e.defense.complete && finite(e.defense.worstEval));
    const mating = entries.find(e => e.terminal && e.observedPlies === 1 && e.endEval === 30000);
    let pick = entries.find(e => e.move === best.move);
    let reason = 'Raw best retained: insufficient comparable DCC coverage.';
    if (mating) { pick = mating; reason = 'Verified immediate checkmate.'; }
    else if (Math.abs(best.score) >= 10000) reason = 'Raw engine result protected for decisive / tablebase scores.';
    else if (sufficientlyMeasured && defensesMeasured) {
      let pool = contenders;
      if (cfg.defense) {
        const bestDefense = Math.max(...contenders.map(e => e.defense.worstEval));
        pool = contenders.filter(e => e.defense.worstEval >= bestDefense - cfg.guard);
        for (const entry of contenders) entry.defense.setback = bestDefense - entry.defense.worstEval;
      }
      pick = pool.slice().sort((a, b) => b.dccScore - a.dccScore || b.raw - a.raw || (cfg.policy === 'legacy' ? 0 : a.providerOrder - b.providerOrder) || a.move.localeCompare(b.move))[0];
      reason = pick.move === best.move ? 'Raw and DCC agree inside the 10 cp guard.' : 'DCC preference inside the 10 cp guard, with comparable coverage.';
      if (cfg.defense) reason += ' Limited sampled defenses checked; this is not a proof of best play.';
    } else if (sufficientlyMeasured && !defensesMeasured) reason = 'Raw best retained: insufficient comparable defense coverage.';
    if (pick) pick.isMdlPick = true;
    entries.sort((a, b) => Number(b.isMdlPick) - Number(a.isMdlPick) || Number(b.eligible) - Number(a.eligible) || b.dccScore - a.dccScore || a.move.localeCompare(b.move));
    const candidates = entries.map(data => ({ move: data.move, raw: data.raw, dcc: Math.round(data.dccScore),
      stability: data.stability, adsr: data.adsr.shape, trend: data.arrow, momentum: data.momentum, tunnel: data.tunnel, data }));
    return { candidates, dcc1Move: pick ? pick.move : best.move, allMoves,
      receipt: { fen, config: cfg, status: entries.every(e => e.complete) && defensesMeasured ? 'complete' : 'partial', calls, maxCalls, plannedCalls, initialCandidateQueries: moves ? 0 : 1,
        completed: entries.filter(e => e.complete).length, total: entries.length, requestedPlies: cfg.depth,
        deepened: deepen, limited, reason, rawBest: best.move, rootSide, coverage, errors,
        defense: { enabled: cfg.defense, comparable: cfg.defense ? defensesMeasured : null,
          candidateCount: cfg.defense ? contenders.length : 0, completedCandidates: contenders.filter(e => e.defense && e.defense.complete).length,
          exhaustive: cfg.defense && contenders.every(e => e.defense && e.defense.allLegalRepliesCovered),
          scope: 'Top evaluated opponent replies sampled at a fixed horizon; provider scores are not independent adjudication.' } } };
  }
  return { VERSION, config, normalize, sensors, legalMoves, play, analyze, relationships, tacticalQuestions };
});
