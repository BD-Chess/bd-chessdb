/* One bounded CDB prefix, frozen before any engine is created. No book tree. */
(function(root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./8zc-sha256.js') : root.ChessAssetSHA256);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChessCDBStart = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(SHA) {
  'use strict';
  const VERSION = 1;
  const MODES = { e4: ['e2e4'], d4: ['d2d4'], random_main: ['e2e4','d2d4','c2c4','g1f3'], random_side: ['b2b3','g2g3','f2f4','b1c3'] };
  // Engineering quality limits, in centipawns from the current mover's POV.
  const WINDOWS = { main: 20, side: 60 }, FLOOR = -80;
  const aborted = () => Object.assign(new Error('CDB start cancelled'), {name:'AbortError'});
  function config(input = {}) {
    const disabled=input.cdbStartOn===false;
    const moves = disabled && (!Number.isInteger(input.cdbStartMoves)||input.cdbStartMoves<1||input.cdbStartMoves>30) ? 8 : input.cdbStartMoves ?? 8;
    if (!Number.isInteger(moves) || moves < 1 || moves > 30) throw Error('CDB start requires 1–30 full moves.');
    const mode = disabled && !Object.hasOwn(MODES,input.cdbStartMode) ? 'random_main' : input.cdbStartMode ?? 'random_main';
    if (!Object.hasOwn(MODES, mode)) throw Error('Unknown CDB opening mode.');
    return { cdbStartOn: input.cdbStartOn !== false, cdbStartMoves: moves, cdbStartMode: mode };
  }
  function random(seed) {
    let state = 2166136261;
    for (const c of String(seed)) state = Math.imul(state ^ c.charCodeAt(0), 16777619) >>> 0;
    return () => { state = (state + 0x6D2B79F5) >>> 0; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  let budgetSequence = 0;
  function budget(max = 400) {
    return { id:++budgetSequence, max, attempts: 0, take() { if (this.attempts >= this.max) throw Error('CDB request budget reached'); this.attempts++; } };
  }
  function hash(value) { return new SHA.SHA256().update(new TextEncoder().encode(JSON.stringify(value))).hex(); }
  const play = (board, move) => typeof move === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move) && board.move({from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]});
  function candidates(Chess, fen, response) {
    if (response?.fen && response.fen !== fen) return [];
    const seen = new Set();
    return (Array.isArray(response?.moves) ? response.moves : []).filter(row => {
      if (!row || !Number.isFinite(row.score) || seen.has(row.move) || !play(new Chess(fen), row.move)) return false;
      if (row.scoreType && !['cp','mate'].includes(row.scoreType)) return false;
      seen.add(row.move); return true;
    }).map((row, i) => ({ move:row.move, score:row.score, rank:Number.isFinite(row.rank) ? row.rank : 0,
      sourceOrder:Number.isFinite(row.sourceOrder) ? row.sourceOrder : i,
      scoreType:row.scoreType === 'mate' || Math.abs(row.score) >= 29000 ? 'mate' : 'cp',
      ...(row.mateIn != null ? {mateIn:row.mateIn} : {})
    })).sort((a,b) => b.score - a.score || a.rank - b.rank || a.sourceOrder - b.sourceOrder);
  }
  // Also bounds injected adapters that ignore AbortSignal or never settle.
  function lookup(getCDB, fen, options) {
    return new Promise((resolve,reject) => {
      let timer;
      const cancel = () => finish(aborted());
      const finish = (error,result) => { clearTimeout(timer); options.signal?.removeEventListener('abort',cancel); error ? reject(error) : resolve(result); };
      options.signal?.addEventListener('abort',cancel,{once:true});
      if (options.signal?.aborted) { cancel(); return; }
      timer = setTimeout(() => finish(Error('CDB timeout')), options.timeoutMs + 50);
      Promise.resolve().then(() => { if(options.signal?.aborted)throw aborted(); return getCDB(fen,options); }).then(value => finish(null,value),finish);
    });
  }
  async function prepare({Chess, getCDB, input = {}, seed, index = 0, signal, requestBudget = budget(),
    enabled = () => true, check = () => {}, progress = () => {}, timeoutMs = 10000, now = () => performance.now()}) {
    const cfg = config(input), board = new Chess(), history = [], observations = [], started = now();
    const requestedPlies = cfg.cdbStartMoves * 2, draw = random(String(seed) + ':' + index);
    const positions = new Set([board.fen().split(' ').slice(0,4).join(' ')]);
    const cpWindow = cfg.cdbStartMode === 'random_side' ? WINDOWS.side : WINDOWS.main;
    let reason = cfg.cdbStartOn ? '' : 'CDB start off', attempts = requestBudget.attempts;
    const verify = () => { if (signal?.aborted) throw aborted(); check(); };
    verify();
    for (let ply = 0; cfg.cdbStartOn && ply < requestedPlies; ply++) {
      verify();
      if (!enabled()) { reason = 'CDB disabled'; break; }
      if (requestBudget.attempts >= requestBudget.max) { reason = 'CDB request budget reached'; break; }
      const fen = board.fen(); let response, rows = [], error = '';
      for (let retry = 0; retry < 2; retry++) {
        verify();
        if (!enabled()) { error = 'CDB disabled'; break; }
        try { response = await lookup(getCDB,fen,{signal,timeoutMs,requestBudget,force:retry>0}); verify(); rows = candidates(Chess,fen,response); }
        catch (e) { verify(); error = e.message || 'CDB unavailable'; }
        if (rows.length || requestBudget.attempts >= requestBudget.max) break;
      }
      verify();
      if (!rows.length) { reason = error || response?.reason || 'CDB has no evaluated legal moves'; break; }
      // Mate is typed evidence, never a large cp value or a benchmark opening.
      if (rows[0].scoreType === 'mate') { reason = 'CDB mate position excluded'; break; }
      let good = rows.filter(row => row.scoreType === 'cp' && row.score >= FLOOR && rows[0].score - row.score <= cpWindow);
      if (!ply) good = good.filter(row => MODES[cfg.cdbStartMode].includes(row.move));
      if (!good.length) { reason = 'No suitable evaluated CDB continuation'; break; }
      const pick = cfg.cdbStartMode.startsWith('random_') ? good[Math.floor(draw()*good.length)] : good[0];
      play(board,pick.move);
      const position = board.fen().split(' ').slice(0,4).join(' ');
      if (board.game_over() || positions.has(position)) {
        board.undo(); reason = 'Terminal or repeating opening excluded'; break;
      }
      history.push(pick.move);
      positions.add(position);
      observations.push({fen,position,rootSide:fen.split(' ')[1],provider:'CDB',selected:pick.move,candidates:rows,
        source:response?.source || null,observedAt:response?.observedAt || null});
      progress({actualPlies:history.length,requestedPlies,index,elapsedMs:Math.max(0,now()-started)});
    }
    verify();
    const actualPlies = history.length, identity = hash({version:VERSION,seed:String(seed),index,mode:cfg.cdbStartMode,requestedPlies,history,startFen:board.fen()});
    const modeName={e4:'1.e4',d4:'1.d4',random_main:'Random – main openings',random_side:'Random – side openings'}[cfg.cdbStartMode];
    return {id:'cdb-'+identity,name:'CDB · '+modeName+' · '+actualPlies/2+'/'+cfg.cdbStartMoves,
      startFen:board.fen(),startPgn:board.pgn() || '*',history,openingPlies:actualPlies,bookPlies:actualPlies,boundary:'cdb-start',
      sourceHeaders:{Source:'ChessDB.cn'},cdbStart:{version:VERSION,seed:String(seed),index,mode:cfg.cdbStartMode,
        requestedPlies,actualPlies,complete:actualPlies===requestedPlies,reason:reason || 'CDB prefix complete',sha256:identity,
        cpWindow,floorCp:FLOOR,preparationMs:Math.max(0,now()-started),httpAttempts:requestBudget.attempts-attempts,observations}};
  }
  function status(opening) {
    const c = opening.cdbStart;
    if(c.reason==='CDB start off')return 'CDB start off · Engine play from move 1';
    const count = c.actualPlies/2+'/'+c.requestedPlies/2+' moves';
    return (c.complete ? 'CDB start · ' : 'CDB start incomplete · ') + count + (c.complete ? '' : ' · '+c.reason)
      + ' · Engine play from move '+opening.startFen.split(' ')[5]+' · preparation '+(c.preparationMs/1000).toFixed(1)+' s';
  }
  return {VERSION,MODES,WINDOWS,FLOOR,config,random,budget,hash,candidates,prepare,status};
});
