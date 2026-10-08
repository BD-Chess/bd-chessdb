const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const test=require('node:test');
const {JSDOM,VirtualConsole}=require('jsdom');

test('real Dreev-Kasparov Top Pick loads from Game library and opens populated Review', {timeout:10000}, async t=>{
  const base=path.resolve(__dirname,'..')+'/';
  const errors=[];
  const vc=new VirtualConsole(); vc.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(fs.readFileSync(base+'index.html','utf8'),{
    url:'https://www.mdlxdcc.org/chess-lab/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc
  });
  const w=dom.window; t.after(()=>w.close());
  let lockTail=Promise.resolve();
  Object.defineProperty(w.navigator,'locks',{value:{request:(_name,_options,job)=>{const next=lockTail.then(job||_options);lockTail=next.catch(()=>{});return next;}}});
  w.indexedDB={databases:async()=>[],open(){throw Error('Fixture archive fallback');}};
  Object.defineProperty(w.HTMLElement.prototype,'innerText',{get(){return this.textContent},set(v){this.textContent=String(v)},configurable:true});
  await new Promise(resolve=>w.addEventListener('load',resolve));
  w.HTMLElement.prototype.scrollTo=function(options){if(options&&Number.isFinite(options.top))this.scrollTop=options.top;};
  w.HTMLElement.prototype.scrollIntoView=function(){};
  let fen;
  w.Chessboard=(id,options)=>{
    fen=options.position;
    for(let rank=1;rank<=8;rank++)for(const file of 'abcdefgh'){const el=w.document.createElement('div');el.className='square-'+file+rank;w.document.getElementById(id).append(el);}
    return {position:next=>{if(next)fen=next;return fen},resize(){},orientation(){}};
  };
  w.URL.createObjectURL=()=> 'blob:fixture'; w.URL.revokeObjectURL=()=>{};
  w.alert=msg=>{throw Error(msg)}; w.confirm=()=>true;
  w.TextEncoder=TextEncoder; w.TextDecoder=TextDecoder; w.AbortController=AbortController;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true}; w.HTMLDialogElement.prototype.close=function(){this.open=false};
  w.fetch=async url=>{
    const u=new URL(url,w.location.href); let text='';
    if(u.searchParams.get('action')==='queryall'){
      const board=new w.Chess(u.searchParams.get('board'));
      text=board.moves({verbose:true}).slice(0,5).map(m=>`move:${m.from+m.to+(m.promotion||'')},score:0,rank:1,note:*`).join('|');
    } else if(u.pathname.endsWith('/Games/ChessBest_Top_Picks.pgn')) {
      text=fs.readFileSync(base+'Games/ChessBest_Top_Picks.pgn','utf8');
    }
    return {ok:true,text:async()=>text,json:async()=>({})};
  };
  const scripts=[...w.document.querySelectorAll('script[src]')].map(node=>node.getAttribute('src').split('?')[0]);
  for(const file of scripts){
    if(/jquery-|chessboard-/.test(file))continue;
    w.eval(fs.readFileSync(base+file,'utf8'));
    if(file==='js/8zc-sf-provider.js')w.ChessSFProvider.create=()=>({
      prepare:async()=>{},destroy(){},ledger:{rootNodes:1,rootDepth:1,rootElapsedMs:0,extraNodes:0,extraElapsedMs:0},
      root:async position=>({fen:position,provider:'SF',complete:true,moves:new w.Chess(position).moves({verbose:true}).slice(0,5).map((move,index)=>({move:move.from+move.to+(move.promotion||''),score:0,scoreType:'cp',rank:index+1,depth:1}))}),
      analyzeDCC:async(position,result)=>({candidates:[],dcc1Move:result.moves[0]?.move,receipt:{fen:position,provider:'SF',status:'partial',calls:0}})
    });
    if(file==='js/8zc-utils.js')await w.initAll();
  }
  const el=id=>w.document.getElementById(id);
  const until=async(predicate,message)=>{
    const deadline=Date.now()+5000;
    while(!predicate()&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));
    assert(predicate(),message);
  };
  await until(()=>w.document.body.dataset.desktopView==='moves','desktop controller starts');
  el('btnGames').click();
  assert.equal(w.document.body.dataset.desktopView,'library');
  await until(()=>[...el('popularGamesPanel').querySelectorAll('.library-result')].some(button=>/Dreev.*Kasparov/i.test(button.textContent)),'Dreev-Kasparov Top Pick renders');
  const search=el('gameLibrarySearch'); search.value='dreev'; search.dispatchEvent(new w.Event('input',{bubbles:true}));
  const dreev=[...el('popularGamesPanel').querySelectorAll('.library-result')].find(button=>/Dreev.*Kasparov/i.test(button.textContent));
  assert(dreev,'Dreev-Kasparov remains selectable after search');
  dreev.click();
  await until(()=>w.document.body.dataset.desktopView==='review','Dreev-Kasparov switches Library to Review');
  const review=w.ChessLabHost.getReviewGame();
  assert(review.totalPly>0,'recorded line is loaded');
  assert.equal(review.sourceIsOriginal,true,'curated source PGN is retained');
  assert.match(review.headers.ChessBestTitle,/Dreev.*Kasparov/i);
  assert.equal(el('gameReviewPanel').hidden,false);
  assert.match(el('gameReviewPanel').textContent,/Dreev.*Kasparov/i,'Review is populated');
  assert.notEqual(fen,new w.Chess().fen(),'board is no longer the initial position');
  assert.equal(errors.length,0,errors.join('\n'));
});
