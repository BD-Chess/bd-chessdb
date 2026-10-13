const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Chess } = require('../js/chess.min.js');
const Review = require('../js/8zc-review-core.js');
const Registry = require('../js/8zc-engine-registry.js');
const Deep = require('../js/8zc-deep-engine.js');
const utils = fs.readFileSync(process.env.R11_DCC_BASELINE_UTILS || path.join(__dirname, '../js/8zc-utils.js'), 'utf8');
const fullId = 'stockfish-js-19.0.1-full', liteId = Deep.ENGINE.id;

function linkFixture(receipt, preference = 'sf-lite', enabled = true) {
  const doc = new (require('jsdom').JSDOM)('<select id="analysisSource"><option value="cdb">CDB</option><option value="sf-lite">Lite</option><option value="sf-full">Full</option><option value="berserk">Berserk</option></select>').window;
  const calls = [], selected = doc.document.getElementById('analysisSource');
  selected.value = 'cdb'; selected.addEventListener('change', e => calls.push({ value: selected.value, passive: e.chessAnalysisPassive, linked: e.chessLinkedCard }));
  const c = { settings: { analysisLink: enabled, sfCardMode: preference }, latestDCCReceipt: receipt, linkedCard: null,
    game: new Chess(), Event: doc.Event, document: doc.document, positionEval: { render() {} },
    window: { ChessEngineRegistry: Registry, ChessDeepEngine: Deep, ChessAnalysisSession: { descriptors: { 'sf-full': { id: fullId }, berserk: { id: 'berserk-14-wasm-scalar' } }, configure(value) { calls.push(JSON.parse(JSON.stringify(value))); } } } };
  const start = utils.indexOf('  function linkedDCCMode(') >= 0 ? utils.indexOf('  function linkedDCCMode(') : utils.indexOf('  function selectLinkedCard(');
  vm.createContext(c); vm.runInContext(utils.slice(start, utils.indexOf('  settings.sfCardMode =', start)), c);
  c.selectLinkedCard('DCC'); return { c, calls, selected, close: () => doc.close() };
}

for (const [actual, preference, expected] of [[fullId, 'sf-lite', 'sf-full'], [liteId, 'sf-full', 'sf-lite']])
  test(`DCC Link uses retained concrete ${actual}, ignoring opposing checkbox`, t => {
    const x = linkFixture({ provider: 'SF', engineId: actual }, preference); t.after(x.close);
    assert.equal(x.selected.value, expected); assert.deepEqual(x.calls[0], { boardSource: expected, sfCardMode: expected });
    assert.equal(x.calls[1].passive, true); assert.equal(x.calls[1].linked, true);
  });

test('DCC Link preserves canonical engineMode and leaves concrete identity unchanged', t => {
  const receipt = { provider: 'SF', engineId: fullId, engineMode: 'sf-full' };
  const x = linkFixture(receipt, 'sf-lite'); t.after(x.close);
  assert.equal(x.selected.value, 'sf-full'); assert.equal(receipt.engineId, fullId); assert.equal(receipt.engineMode, 'sf-full');
});

for (const [provider, expected] of [['CDB', 'cdb'], ['BER', 'berserk']])
  test(`DCC Link preserves ${provider} provenance`, t => {
    const x = linkFixture({ provider }, 'sf-full'); t.after(x.close);
    assert.equal(x.selected.value, expected); assert.deepEqual(x.calls[0], { boardSource: expected });
  });

test('Link OFF does not configure a source or dispatch display changes', t => {
  const x = linkFixture({ provider: 'SF', engineId: fullId, engineMode: 'sf-full' }, 'sf-lite', false); t.after(x.close);
  assert.deepEqual(x.calls, []); assert.equal(x.c.linkedCard, null);
});

for (const receipt of [{ provider: 'SF' }, { provider: 'SF', engineId: 'unknown-engine' }, { provider: 'SF', engineId: fullId, engineMode: 'sf-lite' }, { provider: 'unavailable' }])
  test(`missing or conflicting DCC identity does not guess: ${JSON.stringify(receipt)}`, t => {
    const x = linkFixture(receipt, 'sf-full'); t.after(x.close);
    assert.deepEqual(x.calls, []); assert.equal(x.selected.value, 'cdb'); assert.equal(x.c.linkedCard, null);
  });

function scoreFixture(provider = 'CDB') {
  const start = utils.indexOf('  function dccScoreType(') >= 0 ? utils.indexOf('  function dccScoreType(') : utils.indexOf('  function formatDCCScore(');
  const c = { Chess, latestDCCReceipt: { provider }, window: { ChessGameReview: Review } };
  vm.createContext(c); vm.runInContext(utils.slice(start, utils.indexOf('  function labElement(', start)), c); return c;
}

test('DCC uses verified CDB 30000-minus-plies convention, never 29973 cp', () => {
  const c = scoreFixture();
  assert.equal(c.formatDCCScore(29973), 'M14 · 27 plies');
  assert.equal(c.formatDCCScore(-29973), '−M14 · 27 plies');
  assert.equal(c.formatDCCScore(42), '+42 cp');
  assert.equal(c.formatDCCScore(-42), '−42 cp');
});

test('large untyped non-CDB and out-of-convention CDB values have no invented mate distance', () => {
  const sf = scoreFixture('SF'), cdb = scoreFixture();
  assert.equal(sf.formatDCCScore(29973), 'Decisive / tablebase · raw 29973');
  assert.equal(cdb.formatDCCScore(12000), 'Decisive / tablebase · raw 12000');
  assert.equal(cdb.formatDCCScore(30001), 'Decisive / tablebase · raw 30001');
});

test('typed DCC cp/mate preserve score bounds and unknowns', () => {
  const c = scoreFixture('SF');
  assert.equal(c.formatDCCScore(42, { scoreType: 'cp', bound: 'lower' }), '≥+42 cp');
  assert.equal(c.formatDCCScore(-42, { scoreType: 'cp', bound: 'upper' }), '≤−42 cp');
  assert.equal(c.formatDCCScore(29973, { scoreType: 'mate', mateIn: -14, bound: 'upper' }), '≤−M14');
  assert.equal(c.formatDCCScore(null), 'Unknown');
  assert.equal(c.formatDCCScore(NaN), 'Unknown');
  assert.equal(c.formatDCCScore(29973, { scoreType: 'unknown' }), 'Unknown');
});

test('verified terminal samples show Checkmate/Draw instead of cp or inferred distance', () => {
  const c = scoreFixture('SF');
  const mate = new Chess(); for (const san of ['f3', 'e5', 'g4', 'Qh4#']) mate.move(san);
  assert.equal(c.formatDCCScore(30000, { terminal: true, fen: mate.fen() }), 'Checkmate');
  assert.equal(c.formatDCCScore(30000, { terminal: true, fen: new Chess().fen() }), 'Decisive / tablebase · raw 30000');
  assert.equal(c.formatDCCScore(0, { terminal: true, fen: '8/8/8/8/8/1k6/8/1K6 w - - 0 1' }), 'Draw');
});

async function guiFixture(t, cdb = false) {
  const { JSDOM, VirtualConsole } = require('jsdom'), base = path.resolve(__dirname, '..');
  const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8'), errors = [], cache = new Map(), calls = { network:0, engine:0, probes:0 };
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(html, { url:'https://bd-chess.github.io/bd-chessdb/chess-lab/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc });
  const w = dom.window; t.after(()=>w.close()); await new Promise(resolve=>w.addEventListener('load',resolve));
  Object.defineProperty(w.HTMLElement.prototype,'innerText',{get(){return this.textContent;},set(v){this.textContent=String(v);},configurable:true});
  w.HTMLElement.prototype.scrollIntoView = w.HTMLElement.prototype.scrollTo = function(){};
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;}; w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.URL.createObjectURL=()=> 'blob:fixture'; w.URL.revokeObjectURL=()=>{};
  w.AbortController=AbortController; w.structuredClone=structuredClone; w.TextEncoder=TextEncoder; w.TextDecoder=TextDecoder;
  w.indexedDB=new(require('fake-indexeddb').IDBFactory)(); w.alert=msg=>{throw Error(msg);}; w.confirm=()=>true;
  const queues=new Map(); Object.defineProperty(w.navigator,'locks',{value:{request(name,settings,callback){const r=(queues.get(name)||Promise.resolve()).then(callback||settings);queues.set(name,r.catch(()=>{}));return r;}}});
  w.localStorage.setItem('ChessBest:LAB:v2:settings',JSON.stringify({cdbEnabled:cdb,dccDepth:1,dccTopCandidates:3,dccDefenseCheck:false,dccClickAction:'details',badgeInitialDelay:0,nextDot:false}));
  w.Chessboard=(id,options)=>{
    let fen=options.position;for(const file of 'abcdefgh')for(let rank=1;rank<=8;rank++){const n=w.document.createElement('div');n.className=`square-${file}${rank}`;w.document.getElementById(id).append(n);}
    return {position(value){if(value)fen=value;return fen;},resize(){},orientation(){}};
  };
  w.fetch=async url=>{
    calls.network++;const u=new URL(url,w.location.href), board=u.searchParams.get('board'), action=u.searchParams.get('action');let text='';
    if(cdb&&board){const b=new w.Chess(board),moves=b.moves({verbose:true}).map(m=>m.from+m.to+(m.promotion||''));
      if(action==='queryall')text=moves.slice(0,3).map((move,i)=>`move:${move},score:${i?29972:29973},rank:1,note:*`).join('|');
      if(action==='querypv')text=`score:-29973,depth:24,pv:${moves[0]||''}`;
      if(action==='queryscore')text='eval:29973';}
    return {ok:true,text:async()=>text,json:async()=>({})};
  };
  let cardOptions;
  for(const match of html.matchAll(/<script src="(js\/[^?\"]+)/g)){
    const file=match[1];if(/jquery|chessboard|8zc-new-ui|8zc-lab-layout/.test(file))continue;
    w.eval(file==='js/8zc-utils.js' ? utils : fs.readFileSync(path.join(base,file),'utf8'));
    if(file==='js/8zc-engine-cards.js')w.ChessEngineCards.create=options=>{cardOptions=options;return {
      get(mode){return cache.get(mode);},state(){return {disabled:false,working:false,title:'fixture retained engine'};},
      stopRole(){return false;},stopAll(){},positionChanged(){},ingest(r){cache.set(r.mode,r);},
      isAllRunning(){return false;},isFollowing(){return false;},setFollowing(){},
      analyze(){calls.engine++;},analyzeAll(){calls.engine++;}};};
    if(file==='js/8zc-sf-provider.js')w.ChessSFProvider.create=()=>({destroy(){},ledger:{},analyzeDCC:async(fen,root,settings)=>{
      calls.probes++;return w.ChessDCC.analyze({Chess:w.Chess,fen,moves:root.moves,settings,
        getPV:async f=>({score:0,depth:18,pv:new w.Chess(f).moves({verbose:true}).slice(0,1).map(m=>m.from+m.to+(m.promotion||''))}),getScore:async()=>0});}});
  }
  await w.initAll();const el=id=>w.document.getElementById(id);
  const waitFor=async(read,label)=>{const end=Date.now()+4000;while(Date.now()<end){if(read())return;await new Promise(r=>setTimeout(r,10));}throw Error('Timed out '+label+'; '+errors.join(';'));};
  await waitFor(()=>w.ChessLabHost.getContext().analysisSources.CDB!==null,'initial annotations');
  const publish=mode=>{
    const descriptor=mode==='sf-lite'?w.ChessDeepEngine.ENGINE:w.ChessAnalysisSession.descriptors[mode];
    const r={mode,fen:w.ChessLabHost.getContext().fen,jobId:'fixture-'+mode,status:'complete',engine:{...descriptor},completeMultiPV:true,
      lines:['e2e4','d2d4','c2c4'].map((move,i)=>({multipv:i+1,depth:18,pv:[move],score:{type:'cp',root:60-i*4,white:60-i*4,bound:'exact',whiteBound:'exact'}}))};
    cache.set(mode,r);cardOptions.onResult(r);return r;
  };
  return {w,el,calls,errors,publish,waitFor};
}

for(const mode of ['sf-full','sf-lite','berserk'])test(`complete GUI retained ${mode} DCC Link does not compute/download and preserves provenance`,{timeout:15000},async t=>{
  const x=await guiFixture(t);const {w,el,calls}=x;
  el('analysisSource').value=mode;el('analysisSource').dispatchEvent(new w.Event('change'));
  const r=x.publish(mode);await x.waitFor(()=>w.ChessLabHost.getContext().analysisSources.DCC?.receipt.engineId===r.engine.id,'DCC receipt');
  const original=w.ChessLabHost.getContext().analysisSources.DCC.receipt;
  assert.equal(original.engineMode,mode);assert.equal(w.ChessLabHost.getContext().analysisSources[mode==='berserk'?'BER':'SF'].receipt.engineMode,mode);
  // Deliberately leave the opposite preference while preserving the DCC result.
  el('analysisSFFull').checked=mode!=='sf-full';el('analysisSFFull').dispatchEvent(new w.Event('change'));
  if(mode!=='berserk')assert.equal(el('analysisSource').value,mode==='sf-full'?'sf-lite':'sf-full','opposite SF preference changes only the displayed source');
  el('analysisLink').checked=true;el('analysisLink').dispatchEvent(new w.Event('change'));
  const before={...calls};el('allEvalBadges').querySelector('[data-eval-source="DCC"]').click();
  assert.equal(el('analysisSource').value,mode);assert.equal(el('positionEval').dataset.evalSource,mode==='berserk'?'BER':'SF');
  if(mode!=='berserk'){assert.equal(el('analysisSFFull').checked,mode==='sf-full');assert.equal(el('settingSFEngine').value,mode);}
  assert.match(el('analysisCandidates').textContent,new RegExp(r.engine.name));
  assert.equal(el('allEvalBadges').querySelector('[data-eval-source="DCC"]').getAttribute('aria-current'),'true');
  assert.deepEqual(calls,before);assert.deepEqual(w.ChessLabHost.getContext().analysisSources.DCC.receipt,original);
  assert.equal(el('dccAnalysisPanel').style.display,'block');assert.match(el('dccAnalysisPanel').textContent,/typed source scores/);
  el('dccAnalysisPanel').querySelector('.dcc-candidate-button').click();
  assert.equal(el('dccInfoPanel').style.display,'block');assert.match(el('dccInfoPanel').textContent,/0 cp/);
  assert.deepEqual(calls,before);assert.deepEqual(x.errors,[]);
});

test('complete GUI CDB mate Raw/End/samples/details are typed without fabricated cp', {timeout:15000}, async t=>{
  const x=await guiFixture(t,true);await x.waitFor(()=>x.w.ChessLabHost.getContext().analysisSources.DCC?.receipt.status==='complete','CDB DCC');
  x.el('btnViewToggle').click();const table=x.el('dccAnalysisPanel').textContent;
  assert.match(table,/M14 · 27 plies/);assert.doesNotMatch(table,/29973 cp|centipawns, mover/);
  x.el('dccAnalysisPanel').querySelector('.dcc-candidate-button').click();
  const detail=x.el('dccInfoPanel').textContent;assert.match(detail,/M14 · 27 plies/);assert.doesNotMatch(detail,/29973 cp/);
  assert.match(detail,/mixed score units/);assert.deepEqual(x.errors,[]);
});
