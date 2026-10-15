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
  // Validate before the optional shared normalizer as well as after it. The
  // standalone wrapper must never silently discard an unsupported restriction.
  if (options.searchMoves != null && (!Array.isArray(options.searchMoves) || options.searchMoves.length))
    throw new Error('This Reckless port does not support restricted root moves');
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
  return {multipv: info.multiPv ?? 1, depth: info.depth, seldepth: info.selDepth,
    nodes: info.nodes, nps: info.nps, time: info.timeMs,
    pv: Array.isArray(info.pv) ? info.pv.slice() : [], raw:info.raw || '',
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
    const latest = [...job.lines.values()].sort((a,b) => a.multipv-b.multipv),chosen = job.completeLines || latest;
    const first=chosen.find(l=>l.multipv===1)?.pv?.[0] || null;
    const consistent=job.bestMove&&first?job.bestMove===first:null;
    const complete=!!job.completeLines&&consistent!==false;
    const status=job.terminal?'terminal':!Chess?'unvalidated':consistent===false?'bestmove-mismatch':complete?'complete':'partial';
    return clone({fen:job.limits.fen, engine:descriptor, limits:job.limits,
      lines:chosen, completeMultiPV:complete, retainedCompleteMultiPV:!!job.completeLines, linesDepth:job.completeDepth ?? null,
      expectedLines:job.expectedLines, partialLines:job.completeLines && job.sequence!==job.completeSequence?latest:[],
      nativeLines:job.nativeLines, terminal:!!job.terminal,
      coverage:{status,expected:job.expectedLines,verified:job.completeLines?.length||0,depth:job.completeDepth??null,
        latestDepth:job.iterationDepth??null,partial:latest.length,legalityValidated:!!Chess},
      nodes:job.nodes,depth:job.depth,bestMove:first || job.legalBestMove || null,
      nativeBestMove:job.bestMove ?? null,bestMoveConsistent:consistent,
      bestMoveSource:first?(job.completeLines?'verified-lines':'partial-lines'):job.legalBestMove?'native-bestmove':'none',
      stopped:job.stopped, stopReason:job.stopReason || null, forcedStop:!!job.forcedStop, partial:!!job.forcedStop||!complete&&!job.terminal,
      startedAt:job.startedAt,elapsedMs:now()-job.started,
      searchElapsedMs:job.searchStarted == null ? 0 : now()-job.searchStarted,
      initializationMs:(job.searchStarted ?? now())-job.started,
      positionHistory:job.limits.history?'Validated history supplied from startFen':'FEN only; repetition history before this position is unavailable',
      coldHash:true,perspective:'root scores are for the side to move; white scores are for White'});
  }
  function validatePV(job,pv){
    if(!Chess)return {legal:false,reason:'Chess validator unavailable'};
    const key=JSON.stringify(pv);
    if(job.pvCache.has(key))return job.pvCache.get(key);
    let reason=null,played=0;
    try{
      if(!pv.length)reason='Empty principal variation';
      else for(const move of pv){
        if(typeof move!=='string'||!MOVE.test(move)){reason='Invalid coordinate token';break;}
        if(!job.validator.move({from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]})){reason='Illegal principal variation';break;}
        played++;
      }
    }catch(_){reason='Illegal principal variation';}
    finally{while(played-->0)job.validator.undo();}
    const result={legal:!reason,reason};job.pvCache.set(key,result);
    if(job.pvCache.size>512)job.pvCache.delete(job.pvCache.keys().next().value);
    return result;
  }
  function receive(job,info){
    const line=lineFor(info,job.limits.fen),rank=line.multipv,depth=line.depth;
    const validation=validatePV(job,line.pv);
    // Keep exact native evidence separate; an invalid middle token is never
    // removed to manufacture a plausible continuation. Bound values stay typed.
    const native={...line,validation};
    job.nativeLines.push(native);if(job.nativeLines.length>10)job.nativeLines.shift();
    if(!Number.isInteger(rank)||rank<1||rank>job.expectedLines||!Number.isInteger(depth)||depth<1||depth<(job.iterationDepth??0))return line;
    if(depth!==job.iterationDepth||rank===1){
      job.lines=new Map();job.iterationDepth=depth;job.sequence++;job.sweepStarted=rank===1;
    }
    const scored=line.score&&Number.isFinite(line.score.root)&&Number.isFinite(line.score.white);
    if(validation.legal&&scored)job.lines.set(rank,line);else job.lines.delete(rank);
    const rows=[...job.lines.values()].sort((a,b)=>a.multipv-b.multipv);
    if(job.sweepStarted&&job.expectedLines&&rows.length===job.expectedLines&&
      rows.every((row,i)=>row.multipv===i+1&&row.score.bound==='exact')&&new Set(rows.map(row=>row.pv[0])).size===job.expectedLines){
      job.completeLines=rows;job.completeDepth=depth;job.completeSequence=job.sequence;
    }
    return line;
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
      let validator;
      if(Chess){
        validator=new Chess(limits.history?.startFen||limits.fen);
        for(const move of limits.history?.moves||[])validator.move({from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]});
      }
      const expectedLines = validator ? Math.min(limits.multiPV,validator.moves().length) : limits.multiPV;
      const job = {limits,resolve,reject,signal:options.signal,started:now(),startedAt:new Date().toISOString(),
        searchStarted:null,lines:new Map(),nativeLines:[],sequence:0,validator,pvCache:new Map(),nodes:0,depth:0,expectedLines,stopped:false};
      active = job;
      if(validator&&!expectedLines){job.terminal=true;job.stopReason='terminal-position';finish(job);return;}
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
          const line = receive(job,info);
          job.nodes=Math.max(job.nodes,info.nodes || 0);job.depth=Math.max(job.depth,info.depth || 0);
          try { options.onInfo?.(clone(line),snapshot(job)); } catch(_) { /* rendering cannot break search */ }
        });
        job.searchStarted=now();
        try { options.onSearchStarted?.({engine:descriptor,timestamp:job.searchStarted,startedMs:job.searchStarted,fen:limits.fen}); } catch(_) {}
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
        job.bestMove=result.bestMove;
        if(Chess&&typeof result.bestMove==='string'&&validatePV(job,[result.bestMove]).legal)job.legalBestMove=result.bestMove;
        job.nodes=Math.max(job.nodes,result.nodes || 0);job.depth=Math.max(job.depth,result.depth || 0);
        job.stopReason=limits.depth != null?'depth':limits.nodes != null?'nodes':limits.movetime != null?'time':'search-complete';
        finish(job);
      })().catch(error => { if (active===job) { discard();finish(job,error); } });
    });
  }
  return {prepare,analyze,stop,engine:descriptor,isRunning:()=>!!active,destroy() {
    destroyed=true;const job=active;discard();if(job)finish(job,aborted('Engine closed'));
  }};
}
