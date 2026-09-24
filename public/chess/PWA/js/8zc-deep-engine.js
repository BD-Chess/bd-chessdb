/* Optional, local Stockfish worker. The engine is loaded only on explicit analysis. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChessDeepEngine = api;
})(typeof window === 'object' ? window : globalThis, function (root) {
  'use strict';
  const ENGINE = Object.freeze({ id: 'stockfish-js-18.0.0-lite-single', name: 'Stockfish 18 Lite',
    version: '18.0.0', threads: 1, source: 'https://github.com/nmrugg/stockfish.js/releases/tag/v18.0.0',
    wasmSHA256: 'a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1' });
  const MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
  function abortError(message) { const e = new Error(message || 'Analysis cancelled'); e.name = 'AbortError'; return e; }
  function finiteInt(value, fallback, min, max) {
    if (value == null) return fallback;
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error('Invalid engine limit');
    return n;
  }
  function validateFen(fen, Chess) {
    if (typeof fen !== 'string' || /[\r\n]/.test(fen)) throw new Error('Invalid FEN');
    const parts = fen.trim().split(/\s+/), rows = (parts[0] || '').split('/');
    if (parts.length !== 6 || rows.length !== 8 || !/^[wb]$/.test(parts[1]) ||
        !/^(-|K?Q?k?q?)$/.test(parts[2]) || !/^(-|[a-h][36])$/.test(parts[3]) ||
        !/^\d+$/.test(parts[4]) || !/^[1-9]\d*$/.test(parts[5])) throw new Error('Invalid FEN');
    rows.forEach(row => {
      if (!/^[prnbqkPRNBQK1-8]+$/.test(row) || [...row].reduce((n, c) => n + (/\d/.test(c) ? Number(c) : 1), 0) !== 8) throw new Error('Invalid FEN board');
    });
    if ((parts[0].match(/K/g) || []).length !== 1 || (parts[0].match(/k/g) || []).length !== 1 || /[pP]/.test(rows[0] + rows[7])) throw new Error('FEN needs two kings and legal pawn ranks');
    if (Chess) { const game = new Chess(); if (!game.load(parts.join(' '))) throw new Error('Invalid chess position'); }
    return parts.join(' ');
  }
  function parseInfo(line, fen) {
    if (typeof line !== 'string' || !line.startsWith('info ') || line.startsWith('info string ')) return null;
    const tokens = line.trim().split(/\s+/), info = { multipv: 1 };
    for (const key of ['depth', 'seldepth', 'multipv', 'nodes', 'nps', 'time', 'hashfull', 'tbhits']) {
      const at = tokens.indexOf(key), n = at >= 0 ? Number(tokens[at + 1]) : NaN;
      if (Number.isFinite(n)) info[key] = n;
    }
    const s = tokens.indexOf('score');
    if (s >= 0 && /^(cp|mate)$/.test(tokens[s + 1]) && /^-?\d+$/.test(tokens[s + 2] || '')) {
      const value = Number(tokens[s + 2]), sign = fen.split(' ')[1] === 'b' ? -1 : 1;
      const bound = tokens.includes('lowerbound') ? 'lower' : tokens.includes('upperbound') ? 'upper' : 'exact';
      info.score = { type: tokens[s + 1], value, root: value, white: sign * value || 0, bound,
        whiteBound: sign < 0 && bound !== 'exact' ? (bound === 'lower' ? 'upper' : 'lower') : bound,
        unit: tokens[s + 1] === 'cp' ? 'centipawns' : 'moves' };
    }
    const p = tokens.indexOf('pv');
    if (p >= 0) { info.pv = []; for (const move of tokens.slice(p + 1)) { if (!MOVE.test(move)) break; info.pv.push(move); } }
    const w = tokens.indexOf('wdl');
    if (w >= 0 && tokens.slice(w + 1, w + 4).length === 3 && tokens.slice(w + 1, w + 4).every(v => /^\d+$/.test(v))) {
      info.wdl = tokens.slice(w + 1, w + 4).map(Number);
      info.whiteWdl = fen.split(' ')[1] === 'b' ? [...info.wdl].reverse() : [...info.wdl];
    }
    return info;
  }
  function limitsFor(options, Chess) {
    const fen = validateFen(options.fen, Chess);
    const multiPV = finiteInt(options.multiPV, 3, 1, 256);
    const nodes = finiteInt(options.nodes, null, 1, Number.MAX_SAFE_INTEGER);
    const depth = finiteInt(options.depth, options.infinite || nodes != null ? null : 14, 1, 128);
    if (options.infinite && (nodes != null || options.depth != null)) throw new Error('Infinite analysis cannot have depth or node limits');
    let searchMoves = options.searchMoves == null ? [] : options.searchMoves;
    if (!Array.isArray(searchMoves) || searchMoves.some(m => typeof m !== 'string' || !MOVE.test(m))) throw new Error('Invalid root moves');
    searchMoves = [...new Set(searchMoves)];
    if (Chess && searchMoves.length) {
      const game = new Chess(fen), legal = new Set(game.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || '')));
      if (searchMoves.some(m => !legal.has(m))) throw new Error('A selected root move is not legal');
    }
    let history = null;
    if (options.history != null) {
      if (!Chess || !Array.isArray(options.history.moves) || options.history.moves.some(m => !MOVE.test(m))) throw new Error('Valid coordinate move history and Chess are required');
      const startFen = validateFen(options.history.startFen, Chess), game = new Chess(startFen);
      for (const uci of options.history.moves) if (!game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })) throw new Error('Illegal move in engine history');
      if (game.fen() !== fen) throw new Error('Engine history does not reach the pinned position');
      history = { startFen, moves: options.history.moves.slice() };
    }
    return { fen, multiPV, nodes, depth, infinite: !!options.infinite, searchMoves, history };
  }
  function create(config) {
    config = config || {};
    const Chess = config.Chess || root.Chess;
    const hashMB = finiteInt(config.hashMB, 16, 1, 128);
    const workerUrl = config.workerUrl || new URL('vendor/stockfish/stockfish-18-lite-single.js', root.document ? root.document.baseURI : 'http://localhost/chess/new/').href;
    let active = null, serial = 0, destroyed = false;
    const clone = value => JSON.parse(JSON.stringify(value));
    function finish(job, error, forced) {
      if (active !== job) return;
      active = null;
      clearTimeout(job.initTimer); clearTimeout(job.stopTimer);
      if (job.signal) job.signal.removeEventListener('abort', job.onAbort);
      if (job.worker) { job.worker.onmessage = null; job.worker.onerror = null; job.worker.onmessageerror = null; job.worker.terminate(); }
      if (error) job.reject(error);
      else { const result = snapshot(job); result.forcedStop = !!forced; job.resolve(result); }
    }
    function snapshot(job) {
      const latest = [...job.lines.values()].sort((a, b) => (b.depth || 0) - (a.depth || 0) || a.multipv - b.multipv);
      const unique = new Map();
      for (const line of latest) if (!unique.has(line.pv[0])) unique.set(line.pv[0], line);
      const partial = [...unique.values()].sort((a, b) => a.multipv - b.multipv);
      // A partial new iteration can reorder roots. Never combine ranks across depths as one exact comparison.
      const selected = job.completeLines || partial;
      return clone({ fen: job.limits.fen, engine: Object.assign({}, ENGINE, { hashMB, reportedName: job.reportedName || null }),
        limits: job.limits, lines: selected, completeMultiPV: !!job.completeLines,
        linesDepth: job.completeDepth ?? null, expectedLines: job.expectedLines,
        partialLines: job.completeLines && partial.some(line => line.depth > job.completeDepth) ? partial : [],
        bestMove: job.bestMove || null, ponder: job.ponder || null, nodes: job.nodes, depth: job.depth,
        stopped: job.stopped, elapsedMs: Date.now() - job.started, startedAt: job.startedAt,
        positionHistory: job.limits.history ? 'Validated history supplied from startFen' : 'FEN only; repetition history before this position is unavailable',
        coldHash: true, perspective: 'root scores are for the side to move; white scores are for White' });
    }
    function stop() {
      const job = active;
      if (!job) return;
      job.stopped = true;
      if (job.phase !== 'search') { finish(job, null, true); return; }
      if (job.stopTimer) return;
      // A stop watchdog never limits a running search; it acts only AFTER a user's stop.
      job.stopTimer = setTimeout(() => finish(job, null, true), config.stopGraceMs || 1200);
      job.worker.postMessage('stop');
    }
    function analyze(options) {
      if (destroyed) return Promise.reject(new Error('Engine has been destroyed'));
      let limits;
      try { limits = limitsFor(options || {}, Chess); } catch (e) { return Promise.reject(e); }
      if (options.signal && options.signal.aborted) return Promise.reject(abortError());
      if (active) finish(active, abortError('Superseded by a new analysis'));
      return new Promise((resolve, reject) => {
        const job = { id: ++serial, limits, resolve, reject, signal: options.signal, started: Date.now(),
          startedAt: new Date().toISOString(), lines: new Map(), iterations: new Map(), nodes: null, depth: null, stopped: false, phase: 'uci',
          expectedLines: Math.min(limits.multiPV, limits.searchMoves.length || (Chess ? new Chess(limits.fen).moves().length : limits.multiPV)) };
        active = job;
        job.onAbort = () => { if (active === job) { try { job.worker?.postMessage('stop'); } catch (_) {} finish(job, abortError()); } };
        if (job.signal) job.signal.addEventListener('abort', job.onAbort, { once: true });
        try {
          // Fresh worker per run makes benchmark hash state reproducible and prevents late old UCI replies.
          job.worker = config.workerFactory ? config.workerFactory(workerUrl) : new root.Worker(workerUrl);
          job.worker.onerror = event => { if (event.preventDefault) event.preventDefault(); finish(job, new Error(event.message || 'Stockfish could not load. Check browser WebAssembly support and retry.')); };
          job.worker.onmessageerror = () => finish(job, new Error('Stockfish worker message failed'));
          job.worker.onmessage = event => {
            if (active !== job) return;
            for (const line of String(event.data).split(/\r?\n/)) {
              if (active !== job) break;
              if (line.startsWith('id name ')) job.reportedName = line.slice(8);
              if (line === 'uciok' && job.phase === 'uci') {
                job.phase = 'ready';
                ['setoption name Threads value 1', 'setoption name Hash value ' + hashMB,
                  'setoption name MultiPV value ' + limits.multiPV, 'setoption name UCI_ShowWDL value true',
                  'ucinewgame', 'isready'].forEach(command => job.worker.postMessage(command));
              } else if (line === 'readyok' && job.phase === 'ready') {
                clearTimeout(job.initTimer); job.phase = 'search';
                job.worker.postMessage(limits.history ? 'position fen ' + limits.history.startFen + ' moves ' + limits.history.moves.join(' ') : 'position fen ' + limits.fen);
                let command = 'go';
                if (limits.depth != null) command += ' depth ' + limits.depth;
                if (limits.nodes != null) command += ' nodes ' + limits.nodes;
                if (limits.infinite) command += ' infinite';
                if (limits.searchMoves.length) command += ' searchmoves ' + limits.searchMoves.join(' ');
                job.worker.postMessage(command);
              } else if (job.phase === 'search' && line.startsWith('bestmove ')) {
                const tokens = line.split(/\s+/);
                job.bestMove = MOVE.test(tokens[1]) ? tokens[1] : null;
                job.ponder = tokens[2] === 'ponder' && MOVE.test(tokens[3]) ? tokens[3] : null;
                finish(job);
              } else if (job.phase === 'search') {
                const info = parseInfo(line, limits.fen);
                if (!info) continue;
                if (Number.isFinite(info.nodes)) job.nodes = Math.max(job.nodes || 0, info.nodes);
                if (Number.isFinite(info.depth)) job.depth = Math.max(job.depth || 0, info.depth);
                if (info.score && info.pv && info.pv.length) {
                  const entry = Object.assign({ fen: limits.fen }, info);
                  job.lines.set(info.multipv, entry);
                  if (Number.isFinite(info.depth)) {
                    if (!job.iterations.has(info.depth)) job.iterations.set(info.depth, new Map());
                    const iteration = job.iterations.get(info.depth); iteration.set(info.multipv, entry);
                    const rows = [...iteration.values()].sort((a, b) => a.multipv - b.multipv);
                    if (rows.length === job.expectedLines && new Set(rows.map(row => row.pv[0])).size === job.expectedLines && rows.every(row => row.score.bound === 'exact') && info.depth >= (job.completeDepth || 0)) {
                      job.completeLines = rows; job.completeDepth = info.depth;
                    }
                    // Only neighboring iterations are useful; infinite searches cannot grow this map without bound.
                    for (const depth of job.iterations.keys()) if (depth < info.depth - 1) job.iterations.delete(depth);
                  }
                }
                if (typeof options.onInfo === 'function') {
                  try { options.onInfo(clone(info), snapshot(job)); } catch (_) { /* Consumer rendering cannot break engine lifecycle. */ }
                }
              }
            }
          };
          job.initTimer = setTimeout(() => finish(job, new Error('Stockfish did not become ready. Retry after the engine files finish loading.')), config.readyTimeoutMs || 60000);
          job.worker.postMessage('uci');
        } catch (e) { finish(job, e); }
      });
    }
    return { analyze, stop, destroy() { destroyed = true; if (active) finish(active, abortError('Engine closed')); },
      isRunning: () => !!active, engine: ENGINE };
  }
  return { create, parseInfo, limitsFor, validateFen, ENGINE };
});
