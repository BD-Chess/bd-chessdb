const {test}=require('node:test');
const assert=require('node:assert/strict');
const {boot:baseBoot}=require('./source-context-integration.test.cjs');
const boot=(t,options={})=>baseBoot(t,{skipReady:true,...options});
const prefix='ChessBest:LAB:v2:';
const dump=w=>Object.fromEntries(Object.keys(w.localStorage).map(k=>[k,w.localStorage.getItem(k)]));
test('P1 refused game/settings writes complete move, history, clocks and export; recovery reopens current game',async t=>{
  const h=await boot(t);h.drop('e2','e4');const durable=h.w.localStorage.getItem(prefix+'game');
  const write=h.w.Storage.prototype.setItem;let blocked=true;
  h.w.Storage.prototype.setItem=function(k,v){if(blocked&&[prefix+'game',prefix+'settings'].includes(k))throw new h.w.DOMException('full','QuotaExceededError');return write.call(this,k,v);};
  assert.doesNotThrow(()=>h.drop('e7','e5'));
  assert.match(h.el('moves').textContent,/e5/);assert.equal(h.w.ChessLabHost.getContext().moves.length,2);
  assert.match(h.w.ChessLabHost.getContext().pgn,/e5/);
  assert.equal(h.w.localStorage.getItem(prefix+'game'),durable);
  h.el('btnFlip').click();h.el('btnFormat').click();assert.match(h.el('btnFormat').textContent,/PGN/i);
  assert.equal(h.w.document.querySelectorAll('#chessPersistenceStatus').length,1);
  assert.match(h.el('chessPersistenceStatus').textContent,/not saved|unsaved/i);
  assert.equal(h.errors.length,0,h.errors.join('\n'));
  blocked=false;h.drop('g1','f3');h.el('btnFlip').click();
  assert.equal(h.el('chessPersistenceStatus').hidden,true);
  const restored=await boot(t,{initialStorage:dump(h.w)});
  assert.equal(restored.w.ChessLabHost.getContext().fen,h.w.ChessLabHost.getContext().fen);
});
test('P1 SecurityError/read refusal retains saved bytes; unrelated write errors are not swallowed',async t=>{
  const h=await boot(t);h.drop('e2','e4');const durable=h.w.localStorage.getItem(prefix+'game'),read=h.w.Storage.prototype.getItem,write=h.w.Storage.prototype.setItem;
  h.w.Storage.prototype.getItem=function(k){if(k===prefix+'game')throw new h.w.DOMException('denied','SecurityError');return read.call(this,k);};
  assert.doesNotThrow(()=>h.drop('e7','e5'));assert.match(h.el('moves').textContent,/e5/);
  assert.equal(read.call(h.w.localStorage,prefix+'game'),durable);
  assert.equal(h.w.ChessLabHost.saveBeforeUpdate(),false,'unsaved work blocks reload');
  h.w.Storage.prototype.getItem=read;
  assert.equal(h.w.ChessLabHost.saveBeforeUpdate(),true,'storage recovery permits a verified save');
  h.w.Storage.prototype.setItem=function(k,v){if(k===prefix+'game')throw Error('programming failure');return write.call(this,k,v);};
  assert.throws(()=>h.drop('g1','f3'),/programming failure/);
});
test('P1 legacy curated PGN+cursor migrates atomically and a rejected navigation keeps last durable cursor',async t=>{
  const fs=require('node:fs'),path=require('node:path');
  const all=fs.readFileSync(path.join(__dirname,'../Games/ChessBest_Top_Picks.pgn'),'utf8');
  const pgn=all.split(/(?=\[Event ")/).find(x=>x.includes('ChessBestAnchorPly'));
  const {Chess}=require('../js/chess.min.js'),C=require('../js/8zc-study-core.js');
  const study=C.parsePGN(Chess,pgn),probe=new Chess();let node=study.nodes.root;while(node.children.length)node=study.nodes[node.children[0]];
  probe.load_pgn(C.pathPGN(Chess,study,node.id));const cursor=Number(study.headers.ChessBestAnchorPly);
  const marker={cursor,totalPlies:probe.history().length,pgnLength:pgn.length,source:study.headers.ChessBestSource||''};
  const h=await boot(t,{initialStorage:{[prefix+'game']:pgn,[prefix+'top-pick']:JSON.stringify(marker)}});
  assert.equal(h.w.ChessLabHost.getReviewGame().cursor,cursor);
  const durable=h.w.localStorage.getItem(prefix+'game'),record=JSON.parse(durable);assert.equal(record.pgn,pgn);assert.equal(record.topPick.cursor,cursor);
  const write=h.w.Storage.prototype.setItem;
  h.w.Storage.prototype.setItem=function(k,v){if(k===prefix+'game')throw new h.w.DOMException('full','QuotaExceededError');return write.call(this,k,v);};
  h.w.ChessLabHost.navigateReview(cursor-1);assert.equal(h.w.ChessLabHost.getReviewGame().cursor,cursor-1);
  assert.equal(h.w.localStorage.getItem(prefix+'game'),durable);assert.equal(h.w.localStorage.getItem(prefix+'top-pick'),JSON.stringify(marker));
  const reopened=await boot(t,{initialStorage:dump(h.w)});assert.equal(reopened.w.ChessLabHost.getReviewGame().cursor,cursor);assert.equal(reopened.w.ChessLabHost.getReviewGame().sourcePGN,pgn);
});
test('P1 tab arrows/Home/End/repeat own the event and never move the playing board',async t=>{
  const h=await boot(t);h.w.ChessLabHost.navigate({moves:['e2e4','e7e5','g1f3']});h.w.ChessLabHost.navigateReview(1);
  const before=h.w.ChessLabHost.getContext().fen,cursor=h.w.ChessLabHost.getReviewGame().cursor;
  const keys=['ArrowRight','ArrowRight','ArrowRight','ArrowLeft','Home','End','Home'];
  for(const key of keys){
    const tab=h.w.document.querySelector('#desktopViewTabs [aria-selected="true"]');tab.focus();
    tab.dispatchEvent(new h.w.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,repeat:true}));
    assert.equal(h.w.ChessLabHost.getContext().fen,before,key);assert.equal(h.w.ChessLabHost.getReviewGame().cursor,cursor,key);
    assert.equal(h.w.document.activeElement.getAttribute('aria-selected'),'true');
  }
  h.el('workspaceDisplay').dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
  assert.equal(h.w.ChessLabHost.getReviewGame().cursor,cursor+1,'ordinary workspace navigation still works');
  assert.equal(h.errors.length,0,h.errors.join('\n'));
});
