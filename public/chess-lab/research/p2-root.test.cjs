'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom'),Deep=require('../js/8zc-deep-engine.js'),Registry=require('../js/8zc-engine-registry.js'),{Chess}=require('../js/chess.min.js');
const START=new Chess().fen(),tick=()=>new Promise(r=>setImmediate(r)),base=path.resolve(__dirname,'..');
function setup(t){
  const dom=new JSDOM('<!doctype html><select id="analysisSource"><option value="cdb">CDB</option><option value="sf-lite">Lite</option><option value="sf-full">Full</option><option value="berserk">Berserk</option><option value="reckless">Reckless</option><option value="lc0">LC0</option></select><input type="checkbox" id="analysisLink"><button id="btnDeepAnalysis">Deep</button><div id="workspaceDisplay"></div>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
  t.after(()=>w.close());w.ChessDeepEngine=Deep;
  for(const name of ['chess.min.js','8zc-engine-registry.js','8zc-analysis-session.js'])w.eval(fs.readFileSync(path.join(base,'js',name),'utf8'));
  const realSession=w.ChessAnalysisSession,calls=[];realSession.create=()=>({analyze:opts=>{calls.push(opts);return Promise.resolve({fen:opts.fen,lines:[],elapsedMs:0});},stop(){},destroy(){},isRunning:()=>false});
  for(const name of ['8zc-analysis-controls.js','8zc-deep-ui.js'])w.eval(fs.readFileSync(path.join(base,'js',name),'utf8'));
  const ui=w.ChessDeepUI.create({Chess:w.Chess,getContext:()=>({fen:START}),pause(){}});ui.open();t.after(()=>ui.destroy());
  const el=n=>w.document.querySelector('[data-deep="'+n+'"]'),change=e=>e.dispatchEvent(new w.Event('change',{bubbles:true}));
  return {w,ui,el,change,calls,Session:realSession};
}
test('root capability source agrees with actual SF/Berserk support and unsupported mixed participants',()=>{
  for(const mode of ['sf-lite','sf-full','berserk'])assert.equal(Registry.get(mode).restrictedRoots,true);
  for(const mode of ['reckless','lc0'])assert.equal(Registry.get(mode).restrictedRoots,false);
  assert.equal(Registry.rootSupport(['sf-full','berserk']).supported,true);assert.equal(Registry.rootSupport(['sf-full','reckless']).supported,false);
});
for(const linked of [false,true])test('root control transitions retain text and are idle-safe with Link '+linked,async t=>{
  const x=setup(t);x.w.document.getElementById('analysisLink').checked=linked;x.el('roots').value='e4, e2e4, d4';
  for(const mode of ['sf-lite','sf-full','reckless','sf-reckless','lc0','all','sf-berserk','berserk','sf-lite']){
    x.el('mode').value=mode;x.change(x.el('mode'));const supported=['sf-lite','sf-full','sf-berserk','berserk'].includes(mode);
    assert.equal(x.el('roots').disabled,!supported,mode);assert.equal(x.el('roots').value,'e4, e2e4, d4');
    if(!supported){assert.match(x.el('roots-note').textContent,/unavailable|not support/i);assert(x.el('roots').getAttribute('aria-describedby'));}
    assert.equal(x.calls.length,0,'selecting a mode never starts a worker');
  }
  await x.ui.start();assert.deepEqual([...x.calls.at(-1).searchMoves],['e2e4','d2d4']);assert.equal(x.calls.at(-1).multiPV,2);
  x.el('mode').value='sf-reckless';x.change(x.el('mode'));await x.ui.start();assert.deepEqual([...x.calls.at(-1).searchMoves],[],'stale disabled roots cannot be forwarded');
  x.el('mode').value='sf-full';x.change(x.el('mode'));x.el('roots').value='e5';const count=x.calls.length;await x.ui.start();assert.equal(x.calls.length,count);assert.match(x.el('status').textContent,/Not a legal first move/);
});
test('execution boundary rejects unsupported roots before launching any mixed participant',async t=>{
  for(const mode of ['reckless','lc0','sf-reckless','sf-lc0','all']){
    const root={ChessEngineRegistry:Registry},module={exports:{}};
    vm.runInNewContext(fs.readFileSync(path.join(base,'js/8zc-analysis-session.js'),'utf8'),{window:root,module,require:p=>p.includes('registry')?Registry:Deep,URL,Date,Promise,AbortController,setTimeout,clearTimeout});
    let created=0;const session=module.exports.create({Chess,analysisMode:mode,adapterFactory:()=>{created++;return {prepare(){},analyze:()=>Promise.resolve({fen:START,lines:[]}),destroy(){}}}});t.after(()=>session.destroy());
    await assert.rejects(session.analyze({fen:START,movetime:10,searchMoves:['e2e4']}),/restricted root|first.move.*unavailable/i);assert.equal(created,0,mode+' cannot start a partially restricted comparison');
  }
});
test('actual supported adapters receive legal unique roots and clamp candidates to those roots',async t=>{
  for(const mode of ['sf-lite','sf-full','berserk']){
    const root={ChessEngineRegistry:Registry},module={exports:{}};
    vm.runInNewContext(fs.readFileSync(path.join(base,'js/8zc-analysis-session.js'),'utf8'),{window:root,module,require:p=>p.includes('registry')?Registry:Deep,URL,Date,Promise,AbortController,setTimeout,clearTimeout});
    let options;const session=module.exports.create({Chess,analysisMode:mode,adapterFactory:()=>({prepare(){},analyze:o=>{options=o;return Promise.resolve({fen:START,lines:[]});},destroy(){}})});t.after(()=>session.destroy());
    await session.analyze({fen:START,movetime:10,multiPV:5,searchMoves:['e2e4','e2e4','d2d4']});
    assert.deepEqual([...options.searchMoves],['e2e4','d2d4']);assert.equal(options.multiPV,2);assert.equal(module.exports.rootMoveSupport(mode).supported,true);
  }
});
