const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
function ui(t,host={}) {
  const dom=new JSDOM('<body></body>',{runScripts:'outside-only',url:'https://fixture/chess-lab/'});t.after(()=>dom.window.close());
  dom.window.eval(fs.readFileSync(path.join(__dirname,'../js/8zc-tournament-ui.js'),'utf8'));
  const api=dom.window.ChessTournamentUI.create(host),q=k=>dom.window.document.querySelector('[data-ui="'+k+'"]');
  const change=(k,value)=>{if(typeof value==='boolean')q(k).checked=value;else q(k).value=value;q(k).dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
  return {api,q,change,window:dom.window};
}
test('fresh Sim defaults ON/X8/main; OFF disables preparation settings; persisted settings reopen',t=>{
  const saved=[];const h=ui(t,{onPreferences:p=>saved.push(p)});h.api.open();assert.equal(h.q('opening-source').value,'cdb');assert(h.q('cdb-start-on').checked);assert.equal(h.q('cdb-start-moves').value,'8');assert.equal(h.q('cdb-start-mode').value,'random_main');
  h.change('cdb-start-mode','random_side');h.change('cdb-start-moves','30');h.change('cdb-start-on',false);assert(h.q('cdb-start-moves').disabled);assert(h.q('cdb-start-mode').disabled);assert.equal(saved.length,3);
  const next=ui(t,{getPreferences:()=>saved.at(-1)});next.api.open();assert(!next.q('cdb-start-on').checked);assert.equal(next.q('cdb-start-moves').value,'30');assert.equal(next.q('cdb-start-mode').value,'random_side');
});
test('explicit current and collection selections survive opening and never enable CDB fields',t=>{
  const h=ui(t);h.api.open({openingSource:'current'});assert.equal(h.q('opening-source').value,'current');assert(h.q('cdb-fields').hidden);
  h.change('opening-source','collection');h.api.close();h.api.open({collections:[{id:'flat',label:'Existing flat book',count:53}]});assert.equal(h.q('opening-source').value,'collection');assert(!h.q('collection-fields').hidden);assert.equal(h.q('collection').value,'flat');
});
test('Stop/Close during async start cancel host preparation and controls recover',async t=>{
  let finish,cancelled=0;const h=ui(t,{onStart:()=>new Promise(r=>finish=r),onCancelStart:()=>{cancelled++;finish(false);}});h.api.open();
  h.q('form').dispatchEvent(new h.window.Event('submit',{bubbles:true,cancelable:true}));assert(h.q('start').disabled);assert(h.q('cdb-start-on').disabled);
  h.window.document.querySelector('[data-action="cancel-start"]').click();await new Promise(r=>setImmediate(r));assert.equal(cancelled,1);assert(!h.q('start').disabled);
  h.q('form').dispatchEvent(new h.window.Event('submit',{bubbles:true,cancelable:true}));h.api.close();await new Promise(r=>setImmediate(r));assert.equal(cancelled,2);assert(!h.q('start').disabled);
});
test('CDB opening count and visible plan agree for single, paired and OFF starts',async t=>{
  const configs=[],h=ui(t,{onStart:c=>{configs.push(c);return false;}});h.api.open();
  h.change('format','duel');h.change('cdb-start-count','3');assert.match(h.q('plan').textContent,/6 games/);
  const submit=async()=>{h.q('form').dispatchEvent(new h.window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setImmediate(r));};
  await submit();assert.equal(configs.at(-1).openingCount,3);
  h.change('cdb-start-on',false);assert.match(h.q('plan').textContent,/2 games/);await submit();assert.equal(configs.at(-1).openingCount,1);
  h.change('cdb-start-on',true);h.change('format','single');assert(h.q('cdb-count-label').hidden);assert.match(h.q('plan').textContent,/1 game/);await submit();assert.equal(configs.at(-1).openingCount,1);
});
