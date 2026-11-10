import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {CURATED,FEATURED_IDS,loadCatalogue} from '../public/assets/ai8-entry/featured-catalog.mjs';
import {decorateDNA,DNA_TOP_PAGES} from '../public/assets/ai8-entry/dna-top-points.mjs';
import {SECTIONS,classify,buildStrand,groupWorks,workKey,workLabel,genericTitle} from '../public/assets/ai8-entry/dna-sections.mjs';
import {NEW_UPDATES,normalizedTarget,selectNewRecords} from '../public/assets/ai8-entry/dna-new-points.mjs';
const publicIndex=JSON.parse(fs.readFileSync('public/site-search-index.json'));
async function catalogue(index=publicIndex){const fetch=globalThis.fetch;try{globalThis.fetch=async()=>({ok:true,json:async()=>index});return await loadCatalogue();}finally{globalThis.fetch=fetch;}}
async function fullCatalogue(){return classify(decorateDNA((await catalogue()).items,{includeLive:true}));}

test('a refreshed index cannot duplicate the mapped current DNA destination',async()=>{
 const baseline=await catalogue();
 const forms=['/ai8-dna-v4.html','/ai8-dna-v4','https://www.mdlxdcc.org/ai8-dna-v4.html','https://mdlxdcc.org/ai8-dna-v4'];
 for(const urls of [...forms.map(url=>[url]),forms]){
  const result=await catalogue({...publicIndex,items:[...publicIndex.items,...urls.map(url=>({url,title:'AI8 DNA v4',description:'Index metadata must not replace the curated record.',priority:9999}))]});
  assert.equal(result.complete,true);
  assert.deepEqual(result.items,baseline.items,urls.join(', '));
  assert.deepEqual(result.items.find(p=>p.id==='ai8-dna'),CURATED.find(p=>p.id==='ai8-dna'));
  assert.equal(result.items.filter(p=>p.url==='/ai8-dna-v4.html').length,1);
 }
});
test('current DNA deduplication preserves case-distinct pages, fragments and unverified paths',async()=>{
 const urls=['/AI8-DNA-V4.html','/ai8-dna-v4/','/different-dna-page.html','/ai8-dna-v4.html#guide','/ai8-dna-v3.html'];
 const result=await catalogue({items:[{url:'/ai8-dna-v4.html',title:'AI8 DNA v4',priority:50},...urls.map(url=>({url,title:'AI8 DNA v4',priority:50}))]});
 for(const url of urls)assert.ok(result.items.some(p=>p.url===url),url);
 assert.equal(result.items.filter(p=>p.title==='AI8 DNA v4').length,urls.length,'same titles must not merge distinct destinations');
 assert.equal(result.items.find(p=>p.url==='/ai8-dna-v4.html').id,'ai8-dna');
});

test('Top 8 shortcuts share records, keep stable IDs, and do not inflate catalogue counts',async()=>{
 const items=await fullCatalogue(),strand=buildStrand(items),top=strand.instances.filter(d=>d.section==='top');
 assert.deepEqual(top.map(d=>d.project.id),FEATURED_IDS);
 assert.equal(new Set(items.map(p=>p.id)).size,items.length);
 assert.equal(new Set(strand.instances.map(d=>d.id)).size,strand.instances.length);
 // Versions of one work share a point, so pages are counted through the points' variants.
 assert.equal(strand.instances.reduce((n,d)=>n+1+d.variants.length,0),items.length+8+selectNewRecords(items).length);
 for(const d of top){const subject=strand.instances.find(n=>n.project.id===d.project.id&&!['top','new'].includes(n.section));assert.equal(subject.project,d.project);assert.notEqual(subject.id,d.id);}
 for(const h of DNA_TOP_PAGES)assert.ok(items.some(p=>p.url===h.url&&p.dnaTop),h.url);
});
test('all public entries have contiguous primary themes and retain useful source metadata',async()=>{
 const items=await fullCatalogue(),strand=buildStrand(items),keys=SECTIONS.map(s=>s.id);
 let previous=-1;
 for(const d of strand.instances){const next=keys.indexOf(d.section);assert.ok(next>=previous);previous=next;assert.ok(d.y>0);assert.equal(d.project,items.find(p=>p.id===d.project.id));}
 for(const item of items){assert.ok(keys.includes(item.category)&&item.category!=='top');assert.ok(Array.isArray(item.secondaryCategories));assert.ok(item.url&&item.title&&item.en&&item.sl);}
 for(const loop of strand.loops){const pages=loop.section==='top'?8:loop.section==='new'?selectNewRecords(items).length:items.filter(p=>p.category===loop.section).length;assert.equal(loop.pages,pages);assert.equal(loop.count,strand.instances.filter(d=>d.section===loop.section).length);assert.ok(loop.count<=pages);assert.ok(strand.instances.filter(d=>d.section===loop.section&&d.y>loop.start&&d.y<loop.end).length<=12);}
 const category=url=>items.find(p=>p.url===url)?.category;
 for(const [url,expected] of [['/BD/BD_CCH_Consciousness_Field.html','cfh'],['/crp/AI8_Architecture.html','ai8'],['/BD/BD_AIM3.html','ai8'],['/AI8/live/','ai8'],['/crp/HTH.html','machines'],['/crp/SORA.html','machines'],['/crp/ToE.html','theories'],['/crp/AC-WFP.html','theories'],['/Nara/','stories'],['/Trip/','apps'],['/S/','games'],['/S/new/','lab']])assert.equal(category(url),expected,url);
 for(const original of CURATED){const item=items.find(p=>p.id===original.id);assert.deepEqual(item.related,original.related);assert.equal(item.group,original.group);}
});
test('v3 archive dependency bytes are frozen and its loader never reads the changing index',()=>{
 const dir='public/assets/ai8-entry/archive-v3/',manifest=JSON.parse(fs.readFileSync(dir+'manifest.json'));
 for(const [name,entry] of Object.entries(manifest.files)){assert.equal(createHash('sha256').update(fs.readFileSync(dir+name)).digest('hex'),entry.frozenSHA256,name);}
 assert.match(fs.readFileSync(dir+'catalog.mjs','utf8'),/fetch\('\/assets\/ai8-entry\/archive-v3\/site-search-index.json'/);
 const html=fs.readFileSync('public/ai8-dna-v3.html','utf8');
 for(const match of html.matchAll(/(?:src|href)="(\/assets\/ai8-entry\/[^"?]+)/g))assert.ok(match[1].startsWith('/assets/ai8-entry/archive-v3/'),match[1]);
});

test('NEW is one second opening of existing, honestly dated records outside the Top 8',async()=>{
 const items=await fullCatalogue(),strand=buildStrand(items),fresh=strand.instances.filter(d=>d.section==='new');
 assert.deepEqual(SECTIONS.slice(0,2).map(s=>s.id),['top','new']);
 assert.deepEqual(strand.loops.filter(l=>l.label).slice(0,2).map(l=>l.id),['top:1','new:1']);
 assert.equal(fresh.length,2);assert.equal(strand.loops.filter(l=>l.section==='new').length,1);
 assert.equal(strand.loops.find(l=>l.id==='top:1').end,strand.loops.find(l=>l.id==='new:1').start);
 const top=strand.instances.filter(d=>d.section==='top');
 for(const d of fresh){
  assert.ok(!top.some(t=>t.project.id===d.project.id||normalizedTarget(t.project.url)===normalizedTarget(d.project.url)));
  assert.equal(d.project,items.find(p=>p.id===d.project.id));
  assert.equal(strand.instances.find(n=>n.project.id===d.project.id&&!['top','new'].includes(n.section)).project,d.project);
  assert.match(d.update.date,/^\d{4}-\d{2}-\d{2}$/);
  if(d.update.type==='featured'){
   assert.equal(d.project.id,'bogastvo-obstoja');assert.equal(d.update.date,'2026-11-06');
   assert.equal(d.update.source,'https://github.com/BD-Chess/bd-chessdb/commit/b951225e2b77080a36914dd5cb6588fa6b8eb6b7');
   assert.ok(fs.readFileSync('public'+d.update.evidence,'utf8').includes('../bogastvo-obstoja/'),'dated commit adds this existing Start link');
  }else assert.ok(fs.readFileSync('public'+d.update.evidence,'utf8').includes(d.update.date),'date exists in the cited, authored public announcement');
  assert.ok(fs.existsSync('public'+d.project.url),'already-public destination');
 }
 assert.deepEqual(fresh.map(d=>d.project.id),NEW_UPDATES.map(u=>u.id));
 assert.equal(items.length,480,'one added essay record; display shortcuts do not inflate search or catalogue counts');
});

test('the featured essay has one canonical record even when the public index adds URL variants',async()=>{
 const baseline=await catalogue(),essay=CURATED.find(item=>item.id==='bogastvo-obstoja');
 for(const url of ['/bogastvo-obstoja/','/bogastvo-obstoja/index.html','https://mdlxdcc.org/bogastvo-obstoja/']){
  const result=await catalogue({...publicIndex,items:[...publicIndex.items,{url,title:'Duplicated essay metadata',priority:9999}]});
  assert.deepEqual(result.items,baseline.items);assert.deepEqual(result.items.find(p=>p.id===essay.id),essay);
 }
});

test('NEW excludes canonical Top 8 IDs and normalized targets, and never synthesizes records',()=>{
 const trip={id:'tripopti',url:'/Trip/',category:'apps'},chess={id:'chessbest',url:'https://chessbest.org/',category:'games'};
 const candidates=[
  {id:'trip-alias',url:'https://mdlxdcc.org/Trip/index.html?source=new#route'},
  {id:'chess-alias',url:'/index-chess.html'},
  {id:'fresh',url:'/Fresh.html'},
  {id:'fresh-alias',url:'https://www.mdlxdcc.org/Fresh?from=new#intro'},
  {id:'distinct-case',url:'/TRIP/index.html'}
 ];
 const updates=[{id:'tripopti',url:'/renamed-trip.html'},...candidates,{id:'missing',url:'/missing.html'}];
 const result=selectNewRecords([trip,chess,...candidates],updates);
 assert.deepEqual(result,[candidates[2],candidates[4]]);
 assert.equal(result[0],candidates[2],'reuse the actual record');
 assert.equal(normalizedTarget('/ai8-dna-v4.html#guide'),normalizedTarget('https://mdlxdcc.org/ai8-dna-v4?lang=en'));
 assert.notEqual(normalizedTarget('/TRIP/'),normalizedTarget('/Trip/'),'retain case-distinct pages');
 assert.deepEqual(selectNewRecords([trip,chess],updates),[],'no unavailable or excluded replacement entries');
 const many=Array.from({length:12},(_,i)=>({id:'new-'+i,url:'/new-page-'+i+'.html'}));
 assert.equal(selectNewRecords(many,many).length,8,'a longer editorial list still occupies one opening');
});
test('current entry links choose v4 while explicit archive pages remain available',()=>{
 for(const file of ['index.html','proposal1.html','ai8-codex.html']){const html=fs.readFileSync('public/'+file,'utf8');assert.ok(html.includes('ai8-dna-v4.html'));assert.ok(!html.includes('ai8-dna-v3.html'));}
 assert.equal(CURATED.find(p=>p.id==='ai8-dna').url,'/ai8-dna-v4.html');
 for(const file of ['ai8-dna.html','ai8-dna-v2.html','ai8-dna-v3.html','ai8-dna-v4.html'])assert.ok(fs.existsSync('public/'+file));
});

test('physical loop IDs are category-local and keep top cap separate from its full oval',async()=>{
 const items=await fullCatalogue(),s=buildStrand(items),ids=s.loops.map(l=>l.id);
 assert.equal(new Set(ids).size,ids.length);
 for(const n of s.instances){const loop=s.loops.find(l=>l.id===n.loopId);assert.ok(loop);assert.equal(loop.section,n.section);assert.ok(n.y>loop.start&&n.y<loop.end);}
 assert.equal(s.instances.filter(n=>n.loopId==='top:cap').length,3);
 assert.equal(s.instances.filter(n=>n.loopId==='top:1').length,5);
 assert.equal(s.loops.find(l=>l.id==='top:1').count,8);
 const initial=buildStrand(classify(decorateDNA(CURATED)));
 for(const l of initial.loops)assert.ok(s.loops.some(full=>full.id===l.id),'identity survives full catalogue expansion');
});

test('versions of one work share a point and every catalogue page stays reachable',async()=>{
 const items=await fullCatalogue(),strand=buildStrand(items),subject=strand.instances.filter(d=>!['top','new'].includes(d.section));
 const seen=new Map();
 for(const d of subject){
  assert.ok(!seen.has(d.section+'|'+workKey(d.project)),'one point per work in a section: '+d.project.title);seen.set(d.section+'|'+workKey(d.project),d);
  for(const v of d.variants){assert.equal(workKey(v),workKey(d.project));assert.equal(v.category,d.section);assert.equal(v,items.find(p=>p.id===v.id));assert.notEqual(v.id,d.project.id);}
 }
 const reachable=subject.flatMap(d=>[d.project,...d.variants]);
 assert.equal(reachable.length,items.length);assert.equal(new Set(reachable.map(p=>p.id)).size,items.length);
 assert.ok(subject.length<items.length,'the public catalogue does contain versions');
 for(const d of strand.instances.filter(d=>['top','new'].includes(d.section)))assert.deepEqual(d.variants,[]);
});
test('file-derived titles are grouped per folder, real titles across folders',()=>{
 const page=(id,title,url)=>({id,title,url});
 const works=groupWorks([page('a','app','/F4M/app/'),page('b','app','/S/app/'),page('c','app','/S/new/app.html'),page('d','The Story','/BD/Story.html'),page('e','The  story','/OS/Story2.html'),page('f','Other','/BD/Other.html')]);
 assert.deepEqual(works.map(w=>[w.project.id,...w.variants.map(v=>v.id)]),[['a'],['b','c'],['d','e'],['f']]);
 assert.equal(genericTitle('app'),true);assert.equal(genericTitle('The Story'),false);
 assert.equal(workLabel(page('b','app','/S/app/')),'S · app');assert.equal(workLabel(page('d','The Story','/BD/Story.html')),'The Story');
 assert.equal(workLabel(page('x','help','https://chessbest.org/help')),'help','an external address has no folder to name');
});
