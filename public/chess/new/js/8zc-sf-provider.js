/* A pinned Stockfish provider for the normal board and position experiments.
   Scores stay in the side-to-move POV expected by ChessDCC. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChessSFProvider = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SOURCE = 'Stockfish 18 Lite';
  const isCp = line => line?.score?.type === 'cp' && line.score.bound === 'exact' && Number.isFinite(line.score.root);
  const isScored = line => (isCp(line) || (line?.score?.type === 'mate' && line.score.bound === 'exact' && Number.isFinite(line.score.root)));
  const value = line => line.score.type === 'mate' ? Math.sign(line.score.root) * (30000 - Math.min(1000, Math.abs(line.score.root))) : line.score.root;
  const uci = line => line?.pv?.[0];
  const legal = (Chess, fen, move) => {
    try { return !!new Chess(fen).move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] }); }
    catch (_) { return false; }
  };
  function create({ Chess, Engine, DCC, rootNodes = 24000, probeNodes = 3000, multiPV = 8 }) {
    if (!Chess || !Engine?.create) throw new Error('Local Stockfish is unavailable');
    const engine = Engine.create({ Chess });
    let destroyed = false;
    const now = () => globalThis.performance?.now ? globalThis.performance.now() : Date.now();
    const ensure = signal => { if (destroyed || signal?.aborted) { const e = new Error('Stockfish analysis cancelled'); e.name = 'AbortError'; throw e; } };
    const ledger = { rootNodes: 0, rootDepth: null, rootElapsedMs: 0, extraNodes: 0, extraElapsedMs: 0, probes: 0, probeDepths: [], initializationMs: 0 };
    async function prepare(options = {}) { ensure(options.signal); await engine.prepare?.(options); ensure(options.signal); }
    async function search(fen, options, signal, isRoot = false) {
      ensure(signal);
      const result = await engine.analyze({ fen, ...options, signal });
      ensure(signal);
      ledger.initializationMs += result.initializationMs || 0;
      if (isRoot) {
        ledger.rootNodes = result.nodes ?? 0; ledger.rootDepth = result.linesDepth ?? result.depth;
        ledger.rootElapsedMs = result.searchElapsedMs ?? result.elapsedMs;
      } else {
        ledger.extraNodes += result.nodes ?? 0; ledger.extraElapsedMs += result.searchElapsedMs ?? result.elapsedMs;
        ledger.probes++; ledger.probeDepths.push(result.linesDepth ?? result.depth);
      }
      return result;
    }
    async function root(fen, { nodes, depth, movetime, deadline, history, signal, onInfo } = {}) {
      const count = Math.min(multiPV, new Chess(fen).moves().length);
      if (!count) return { fen, moves: [], provider: 'SF', source: SOURCE, complete: true, ledger };
      if ([nodes, depth, movetime].filter(value => value != null).length > 1) throw new Error('Choose exactly one SF budget');
      // Review depth and timed play must not inherit the default simulation node cap.
      const budget = movetime != null ? { movetime, deadline } : depth != null ? { depth } : { nodes: nodes ?? rootNodes };
      const result = await search(fen, { multiPV: count, ...budget, history, onInfo }, signal, true);
      const lines = result.lines.filter(line => isScored(line) && legal(Chess, fen, uci(line)));
      const moves = lines.map((line, sourceOrder) => ({ move: uci(line), score: value(line), scoreType: line.score.type, mateIn: line.score.type === 'mate' ? line.score.root : null,
        rank: line.multipv, sourceOrder, depth: line.depth, pv: line.pv.slice(), source: 'SF' }));
      const complete = !!result.completeMultiPV && lines.length === result.expectedLines &&
        moves.length === result.expectedLines && !result.stopped && !!moves.length;
      // When the last listed line is within the tie guard, another unlisted move
      // may belong to that group. Retain the raw best until the group is known.
      const unboundedTie = count < new Chess(fen).moves().length && moves.length === count &&
        moves[0].score - moves[moves.length - 1].score <= 10;
      return { fen, moves, provider: 'SF', source: SOURCE, complete, unboundedTie,
        bestMove: moves[0]?.move || null, engineBestMove: result.bestMove, result, ledger };
    }
    async function probePV(fen, signal, nodes = probeNodes, timed = null) {
      const r = await search(fen, { multiPV: 1, ...(timed || { nodes }) }, signal);
      const line = r.lines[0];
      return isCp(line) && legal(Chess, fen, uci(line)) ? { score: line.score.root, depth: line.depth, pv: line.pv, source: 'SF' } :
        { score: null, depth: r.depth || 0, pv: [], source: 'SF' };
    }
    async function probeScore(fen, signal, nodes = probeNodes, timed = null) {
      const r = await search(fen, { multiPV: 1, ...(timed || { nodes }) }, signal);
      return isCp(r.lines[0]) ? r.lines[0].score.root : null;
    }
    async function analyzeDCC(fen, rootResult, settings, signal, { deadline = null, probeMovetime = 100 } = {}) {
      ensure(signal);
      if (deadline != null && !Number.isFinite(deadline)) throw new Error('Invalid DCC deadline');
      if (deadline != null && (!Number.isSafeInteger(probeMovetime) || probeMovetime < 1)) throw new Error('Invalid timed DCC probe budget');
      const expired = () => deadline != null && now() >= deadline;
      const best = rootResult.moves[0];
      const incomplete = reason => ({ candidates: [], dcc1Move: best?.move || null, allMoves: rootResult.moves,
        receipt: { fen, provider: 'SF', status: 'partial', reason, calls: ledger.probes,
          rootNodes: ledger.rootNodes, extraNodes: ledger.extraNodes, probeDepths: ledger.probeDepths.slice(),
          computeMatch: deadline == null ? 'unmatched: root and DCC probe nodes reported separately' : 'shared decision deadline',
          rawBest: best?.move || null, coverage: { eligible: 0, eligibleInspected: 0 } } });
      if (expired()) return incomplete('Decision time exhausted; SF #1 retained.');
      if (!best) return incomplete('No usable Stockfish centipawn candidate.');
      if (!rootResult.complete || rootResult.unboundedTie)
        return incomplete(rootResult.unboundedTie ? 'Near-tie group extends beyond the displayed MultiPV; SF #1 retained.' : 'Incomplete same-depth Stockfish MultiPV; SF #1 retained.');
      if (rootResult.moves.some(m => m.scoreType !== 'cp')) return incomplete('Mate scores are protected; SF #1 retained.');
      const eligible = rootResult.moves.filter(m => best.score - m.score <= 10);
      if (eligible.length < 2) return incomplete('No second candidate within the 10 cp safety guard.');
      // The shared DCC core probes every eligible candidate in rounds. Disable
      // optional asymmetric defense sampling for SF; every probe gets the same
      // node budget and coverage must be comparable before its choice is used.
      const sfSettings = { ...settings, dccDefenseCheck: false, dccEvalFloor: 10,
        dccTopCandidates: Math.max(eligible.length, settings.dccTopCandidates || 3),
        dccNoDeadline: true, dccPolicy: 'balanced' };
      const timedBudget = () => {
        if (deadline == null) return null;
        const remaining = Math.floor(deadline - now());
        if (remaining <= 0) { const error = new Error('Decision time exhausted'); error.name = 'DeadlineError'; throw error; }
        return { movetime: Math.min(probeMovetime, remaining), deadline };
      };
      let analysis;
      try {
        analysis = await DCC.analyze({ Chess, fen, settings: sfSettings, moves: rootResult.moves,
          getPV: position => probePV(position, signal, probeNodes, timedBudget()),
          getScore: position => probeScore(position, signal, probeNodes, timedBudget()),
          cancelled: () => destroyed || !!signal?.aborted || expired() });
      } catch (error) {
        ensure(signal);
        if (expired() || error?.name === 'DeadlineError') return incomplete('Decision time exhausted; SF #1 retained.');
        throw error;
      }
      ensure(signal);
      if (expired()) return incomplete('Decision time exhausted; SF #1 retained.');
      const contenders = analysis.candidates.map(c => c.data).filter(c => c.eligible);
      const targets = new Set(contenders.map(c => c.targetPlies));
      const observed = new Set(contenders.map(c => c.observedPlies));
      const comparable = contenders.length === eligible.length && contenders.every(c => c.complete && c.stability !== null) &&
        targets.size === 1 && observed.size === 1 && analysis.receipt.coverage.eligibleInspected === eligible.length;
      analysis.receipt.provider = 'SF'; analysis.receipt.rootNodes = ledger.rootNodes;
      analysis.receipt.extraNodes = ledger.extraNodes; analysis.receipt.probeDepths = ledger.probeDepths.slice();
      analysis.receipt.computeMatch = deadline == null ? 'unmatched: root and DCC probe nodes reported separately' : 'shared decision deadline';
      if (!comparable) {
        analysis.dcc1Move = best.move; analysis.receipt.status = 'partial';
        analysis.receipt.reason = 'Incomplete or incomparable SF continuation coverage; SF #1 retained.';
      }
      return analysis;
    }
    return { root, prepare, probePV, probeScore, analyzeDCC, ledger, source: SOURCE,
      destroy() { destroyed = true; engine.destroy(); } };
  }
  return { SOURCE, create };
});
