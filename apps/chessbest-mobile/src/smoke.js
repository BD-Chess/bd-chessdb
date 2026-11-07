/* Runs only with an explicitly injected Debug simulator launch token. Synthetic data only. */
(function () {
  if (!window.__CHESSBEST_SMOKE__) return;
  const started=performance.now(), checks={}, token=window.__CHESSBEST_SMOKE_TOKEN__, phase=window.__CHESSBEST_SMOKE_PHASE__;
  let stage='boot', sent=false, engine;
  const deadline=setTimeout(()=>finish(false,'TIMEOUT'),85000);
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  async function until(fn,name,ms=15000) { stage=name;const end=performance.now()+ms;while(performance.now()<end){if(fn())return;await delay(50);}throw Error('TIMEOUT_'+name); }
  function assert(ok,name) { if(!ok)throw Error(name);checks[name]=true; }
  function gameState() {
    const context=window.ChessLabHost.getContext(), review=window.ChessLabHost.getReviewGame();
    return JSON.stringify({fen:context.fen,moves:context.moves,pgn:context.pgn,cursor:review.cursor,
      totalPly:review.totalPly,sourcePGN:review.sourcePGN});
  }
  function finish(ok,code='') {
    if(sent)return;sent=true;clearTimeout(deadline);engine?.destroy();
    const receipt={schema:'chessbest-native-smoke/1',token,phase,ok,stage,code,checks,readyMs:Math.round(performance.now()-started),startupErrors:(window.__CHESSBEST_ERRORS__||[]).slice(0,12)};
    window.webkit?.messageHandlers?.chessbestDiagnostics?.postMessage(receipt);
    window.__CHESSBEST_SMOKE_RESULT__=receipt;
  }
  async function run() {
    await until(()=>window.ChessLabHost && window.ChessLabStorage?.status().complete,'storage-and-host');
    const board=document.getElementById('board');
    await until(()=>board.querySelectorAll('[data-square]').length===64 && [...board.querySelectorAll('img')].filter(i=>i.dataset.piece).length>=2,'board-squares');
    const rect=board.getBoundingClientRect();
    assert(rect.width>200 && rect.height>200 && getComputedStyle(board).visibility!=='hidden','visibleBoard');
    await until(()=>[...board.querySelectorAll('img[data-piece]')].every(i=>i.complete && i.naturalWidth>0),'piece-images');
    assert(true,'localPieces'); assert(window.ChessLabStorage.status().complete,'storageReady');
    const C=window.ChessStudy, Chess=window.Chess;
    const store=window.ChessStudyStore.create({C,Chess,storage:localStorage,locks:window.ChessNativeLocks});
    const marker='SIMULATOR-'+token;
    if(phase==='relaunch') {
      assert(store.read().studies.some(s=>s.title===marker),'studySurvivesTermination');
      const expected=localStorage.getItem('ChessBest:APP:v1:probe-'+token);
      assert(!!expected && gameState()===expected,'gameSurvivesTermination');
    }
    document.getElementById('btnGames').click();
    await until(()=>document.querySelectorAll('.library-result').length===7,'seven-top-picks');
    assert(document.getElementById('popularGamesPanel').classList.contains('open'),'libraryControl');
    document.querySelector('.library-result').click();
    await until(()=>window.ChessLabHost.getReviewGame().moves.length>0,'pick-loaded');
    document.getElementById('first').click();
    const before=window.ChessLabHost.getContext();
    document.getElementById('next').click();
    const after=window.ChessLabHost.getContext(), legal=new Chess(before.fen);
    const move=after.moves.at(-1);
    assert(after.moves.length===before.moves.length+1 && !!legal.move({from:move.slice(0,2),to:move.slice(2,4),promotion:move[4]}) && legal.fen()===after.fen,'legalMoveControl');
    // BoardDOM and host must agree after any animation.
    await until(()=>legal.board().every((row,r)=>row.every((p,c)=> {
      const square='abcdefgh'[c]+(8-r), img=board.querySelector('[data-square="'+square+'"] img[data-piece]');
      return p ? img?.dataset.piece===p.color+p.type.toUpperCase() : !img;
    })),'board-move-render');
    assert(document.querySelectorAll('.library-result').length===7,'sevenBundledTopPicks');
    if(phase!=='relaunch') {
      const study=C.create(Chess,{title:marker}); study.title=marker;
      await store.execute({type:'append',id:'probe-'+token,baseRevision:store.read().revision,study});
      assert(store.read().studies.some(s=>s.title===marker),'studyCommitted');
    }
    // Isolate the worker proof from automatic board analysis and stop it afterward.
    await window.ChessNativeHost.pause();
    if(phase!=='relaunch') localStorage.setItem('ChessBest:APP:v1:probe-'+token,gameState());
    engine=window.ChessDeepEngine.create({Chess,readyTimeoutMs:30000});
    stage='stockfish-wasm';let progress=false;
    const result=await engine.analyze({fen:after.fen,depth:3,multiPV:1,onInfo:i=>{if(i.depth>0)progress=true;}});
    const m=result.bestMove, g=new Chess(after.fen);
    assert(result.depth>=3 && progress && typeof m==='string' && !!g.move({from:m.slice(0,2),to:m.slice(2,4),promotion:m[4]}),'realStockfishDepth3');
    assert((window.__CHESSBEST_ERRORS__||[]).length===0,'noStartupErrors');
    stage='ready';finish(true);
  }
  run().catch(error=>finish(false,/^[A-Z_a-z0-9-]{1,70}$/.test(error.message)?error.message:'PROBE_FAILED'));
})();
