/* ChessBest Reckless adapter. SPDX-License-Identifier: AGPL-3.0-only.
 * Reckless and its browser package retain their upstream authorship; see SOURCE.md.
 * The worker is loaded only by prepare/analyze, after the visitor requests analysis.
 */
import { RecklessEngine } from './reckless-engine.js';

export const ENGINE = Object.freeze({
  id: 'reckless-0.10.0-dev-a6fa482c-wasm-simd-single', name: 'Reckless 0.10.0-dev',
  version: '0.10.0-dev-a6fa482c', backend: 'wasm-simd', maxThreads: 1,
  source: new URL('./SOURCE.md', import.meta.url).href,
  sourceCommit: 'a6fa482c7d46fb81831573f10be396f20a5efdb5',
  variant: 'single-thread-simd128', license: 'AGPL-3.0-only',
  wasmSHA256: '928fcba02a40cd317660c99b5b278782d915c45aaf128778e9da535e37cd450f'
});

const MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const now = () => globalThis.performance?.now?.() ?? Date.now();
const clone = value => JSON.parse(JSON.stringify(value));
function aborted(message = 'Reckless analysis cancelled') { const e = new Error(message); e.name = 'AbortError'; return e; }
function positive(value, fallback, max = 0xffffffff) {
  if (value == null) return fallback;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > max) throw new Error('Invalid Reckless search limit');
  return n;
}
function limitsFor(options, Chess) {
  const shared = globalThis.ChessDeepEngine;
  let limits;
  if (shared?.limitsFor) limits = shared.limitsFor(options, Chess);
  else {
    const fen = String(options.fen || '').trim();
    if (fen.split(/\s+/).length !== 6 || /[\r\n]/.test(fen)) throw new Error('Invalid FEN');
    if (Chess && new Chess().load(fen) === false) throw new Error('Invalid chess position');
    const movetime = positive(options.movetime, null), nodes = positive(options.nodes, null);
    const depth = positive(options.depth, options.infinite || movetime || nodes ? null : 14, 128);
    if (options.infinite ? movetime || nodes || depth : ![movetime,nodes,depth].some(v=>v != null) || (nodes != null && depth != null))
      throw new Error('Choose exactly one engine limit');
    limits = {fen, movetime, nodes, depth, multiPV: positive(options.multiPV, 3, 10),
      infinite: !!options.infinite, deadline: options.deadline ?? null, history: options.history || null, searchMoves: []};
    if (limits.history) {
      if (!Chess || !Array.isArray(limits.history.moves)) throw new Error('Valid coordinate history and Chess are required');
      const game = new Chess(limits.history.startFen);
      for (const move of limits.history.moves) {
        if (!MOVE.test(move) || !game.move({from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]})) throw new Error('Illegal move in engine history');
      }
      if (game.fen() !== fen) throw new Error('Engine history does not reach the pinned position');
    }
  }
  if (limits.multiPV > 10) throw new Error('Reckless supports at most 10 principal variations');
  if (limits.nodes > 0xffffffff) throw new Error('Reckless node limit exceeds the browser API range');
  if (limits.searchMoves?.length) throw new Error('This Reckless port does not support restricted root moves');
  return limits;
}
function lineFor(info, fen) {
  const sign = fen.split(' ')[1] === 'b' ? -1 : 1;
  const value = info.mate != null ? info.mate : info.scoreCp;
  const type = info.mate != null ? 'mate' : 'cp';
  const bound = /\blowerbound\b/.test(info.raw || '') ? 'lower' : /\bupperbound\b/.test(info.raw || '') ? 'upper' : 'exact';
  return {multipv: info.multiPv || 1, depth: info.depth, seldepth: info.selDepth,
    nodes: info.nodes, nps: info.nps, time: info.timeMs,
    pv: (info.pv || []).filter(move => MOVE.test(move)),
    score: value == null ? null : {type, value, root:value, white:sign*value || 0, bound,
      whiteBound: sign < 0 && bound !== 'exact' ? bound === 'lower' ? 'upper' : 'lower' : bound,
      unit: type === 'cp' ? 'centipawns' : 'moves'}};
}

export function create(config = {}) {
  const Chess = config.Chess || globalThis.Chess;
  const descriptor = Object.freeze({...ENGINE, ...(config.engine || {}), threads:1, threadsEffective:1});
  let engine = null, preparing = null, active = null, destroyed = false;
  function getEngine() {
    if (!engine) engine = new RecklessEngine({assetBaseUrl:new URL('./',import.meta.url).href,
      ...(config.assetBaseUrl ? {assetBaseUrl:config.assetBaseUrl} : {}),
      ...(config.workerFactory ? {workerFactory:config.workerFactory} : {})});
    return engine;
  }
  function discard() { const old = engine; engine = null; preparing = null; old?.terminate(); }
  function prepare({signal,onProgress} = {}) {
    if (destroyed) return Promise.reject(new Error('Engine has been destroyed'));
    if (signal?.aborted) return Promise.reject(aborted());
    const instance = getEngine();
    const offProgress = typeof onProgress === 'function' ? instance.onDownloadProgress(onProgress) : null;
    if (!preparing) preparing = instance.init().catch(error => { if (engine === instance) preparing = null; throw error; });
    return new Promise((resolve,reject) => {
      let finished = false;
      const complete = error => {
        if (finished) return; finished = true;
        clearTimeout(timer); signal?.removeEventListener('abort',cancel); offProgress?.();
        error ? reject(error) : resolve();
      };
      const cancel = () => { if (engine === instance) discard(); complete(aborted()); };
      const timer = setTimeout(() => { if (engine === instance) discard(); complete(new Error('Reckless download or initialization timed out')); }, config.readyTimeoutMs || 180000);
      signal?.addEventListener('abort',cancel,{once:true});
      preparing.then(() => complete(),complete);
    });
  }
  function snapshot(job) {
    const latest = [...job.lines.values()].sort((a,b) => a.multipv-b.multipv);
    const chosen = job.completeLines || latest;
    return clone({fen:job.limits.fen, engine:descriptor, limits:job.limits,
      lines:chosen, completeMultiPV:!!job.completeLines, linesDepth:job.completeDepth ?? null,
      expectedLines:job.expectedLines, partialLines:job.completeLines && latest.some(l=>l.depth>job.completeDepth)?latest:[],
      nodes:job.nodes,depth:job.depth,bestMove:job.bestMove || chosen.find(l=>l.multipv===1)?.pv?.[0] || null,
      stopped:job.stopped, stopReason:job.stopReason || null, forcedStop:!!job.forcedStop, partial:!!job.forcedStop,
      startedAt:job.startedAt,elapsedMs:now()-job.started,
      searchElapsedMs:job.searchStarted == null ? 0 : now()-job.searchStarted,
      initializationMs:(job.searchStarted ?? now())-job.started,
      positionHistory:job.limits.history?'Validated history supplied from startFen':'FEN only; repetition history before this position is unavailable',
      coldHash:true,perspective:'root scores are for the side to move; white scores are for White'});
  }
  function finish(job,error) {
    if (active !== job) return;
    active = null; clearTimeout(job.timer); job.signal?.removeEventListener('abort',job.abort); job.offInfo?.();
    error ? job.reject(error) : job.resolve(snapshot(job));
  }
  function stop() {
    const job = active; if (!job) return;
    job.stopped = true; job.forcedStop = true; job.stopReason = 'user'; discard(); finish(job);
  }
  function analyze(options = {}) {
    if (destroyed) return Promise.reject(new Error('Engine has been destroyed'));
    if (options.signal?.aborted) return Promise.reject(aborted());
    let limits;
    try { limits = limitsFor(options,Chess); } catch(error) { return Promise.reject(error); }
    if (active) { const previous = active; discard(); finish(previous,aborted('Superseded by a new analysis')); }
    return new Promise((resolve,reject) => {
      const expectedLines = Chess ? Math.min(limits.multiPV,new Chess(limits.fen).moves().length) : limits.multiPV;
      const job = {limits,resolve,reject,signal:options.signal,started:now(),startedAt:new Date().toISOString(),
        searchStarted:null,lines:new Map(),iterations:new Map(),nodes:0,depth:0,expectedLines,stopped:false};
      active = job;
      job.abort = () => { if (active===job) { discard(); finish(job,aborted()); } };
      job.signal?.addEventListener('abort',job.abort,{once:true});
      (async () => {
        await prepare({signal:job.signal});
        if (active!==job) throw aborted();
        const instance = getEngine();
        await instance.newGame();
        if (limits.history) {
          await instance.setPosition(limits.history.startFen);
          for (const move of limits.history.moves) { if (active!==job) throw aborted(); await instance.makeMove(move); }
        } else await instance.setPosition(limits.fen);
        if (active!==job) throw aborted();
        const remaining = limits.deadline == null ? limits.movetime : Math.floor(limits.deadline-now());
        if (remaining != null && remaining<=0) { const error=new Error('Search deadline reached before search');error.name='DeadlineError';throw error; }
        job.offInfo = instance.onInfo(info => {
          if (active!==job) return;
          const line = lineFor(info,limits.fen);
          if (line.pv.length && line.score) {
            job.lines.set(line.multipv,line);
            const iteration = job.iterations.get(line.depth) || new Map(); iteration.set(line.multipv,line); job.iterations.set(line.depth,iteration);
            if (job.expectedLines && iteration.size>=job.expectedLines && [...Array(job.expectedLines)].every((_,i)=>iteration.has(i+1))) {
              job.completeLines=[...iteration.values()].sort((a,b)=>a.multipv-b.multipv);job.completeDepth=line.depth;
            }
            for (const d of job.iterations.keys()) if (d < line.depth-2) job.iterations.delete(d);
          }
          job.nodes=Math.max(job.nodes,info.nodes || 0);job.depth=Math.max(job.depth,info.depth || 0);
          try { options.onInfo?.(clone(line),snapshot(job)); } catch(_) { /* rendering cannot break search */ }
        });
        job.searchStarted=now();
        try { options.onSearchStarted?.({engine:descriptor,startedMs:job.searchStarted,fen:limits.fen}); } catch(_) {}
        // The upstream WASM API accepts one native limit. A second time bound
        // therefore terminates the depth/node worker at the actual search deadline,
        // retaining its last completed MultiPV iteration as the finite result.
        if (remaining != null && (limits.depth != null || limits.nodes != null)) {
          job.timer=setTimeout(()=>{if(active===job){job.stopReason='time';job.forcedStop=true;discard();finish(job);}},remaining);
        }
        const search = {multiPv:limits.multiPV};
        if (limits.nodes != null) search.nodes=limits.nodes;
        else if (limits.infinite) search.infinite=true;
        else if (limits.depth != null) search.depth=limits.depth;
        else search.movetime=remaining;
        const result = await instance.analyze(search);
        if (active!==job) return;
        job.bestMove=result.bestMove;job.nodes=Math.max(job.nodes,result.nodes || 0);job.depth=Math.max(job.depth,result.depth || 0);
        job.stopReason=limits.depth != null?'depth':limits.nodes != null?'nodes':limits.movetime != null?'time':'search-complete';
        finish(job);
      })().catch(error => { if (active===job) { discard();finish(job,error); } });
    });
  }
  return {prepare,analyze,stop,engine:descriptor,isRunning:()=>!!active,destroy() {
    destroyed=true;const job=active;discard();if(job)finish(job,aborted('Engine closed'));
  }};
}
