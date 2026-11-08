import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {CURATED,FEATURED_IDS,loadCatalogue} from '../public/assets/ai8-entry/featured-catalog.mjs';
import {decorateDNA,DNA_TOP_PAGES} from '../public/assets/ai8-entry/dna-top-points.mjs';
import {SECTIONS,classify,buildStrand} from '../public/assets/ai8-entry/dna-sections.mjs';
const publicIndex=JSON.parse(fs.readFileSync('public/site-search-index.json'));
async function fullCatalogue(){const fetch=globalThis.fetch;try{globalThis.fetch=async()=>({ok:true,json:async()=>publicIndex});return classify(decorateDNA((await loadCatalogue()).items,{includeLive:true}));}finally{globalThis.fetch=fetch;}}

test('Top 8 shortcuts share records, keep stable IDs, and do not inflate catalogue counts',async()=>{
 const items=await fullCatalogue(),strand=buildStrand(items),top=strand.instances.filter(d=>d.section==='top');
 assert.deepEqual(top.map(d=>d.project.id),FEATURED_IDS);
 assert.equal(new Set(items.map(p=>p.id)).size,items.length);
 assert.equal(new Set(strand.instances.map(d=>d.id)).size,strand.instances.length);
 assert.equal(strand.instances.length,items.length+8);
 for(const d of top){const subject=strand.instances.find(n=>n.project.id===d.project.id&&n.section!=='top');assert.equal(subject.project,d.project);assert.notEqual(subject.id,d.id);}
 for(const h of DNA_TOP_PAGES)assert.ok(items.some(p=>p.url===h.url&&p.dnaTop),h.url);
});
test('all public entries have contiguous primary themes and retain useful source metadata',async()=>{
 const items=await fullCatalogue(),strand=buildStrand(items),keys=SECTIONS.map(s=>s.id);
 let previous=-1;
 for(const d of strand.instances){const next=keys.indexOf(d.section);assert.ok(next>=previous);previous=next;assert.ok(d.y>0);assert.equal(d.project,items.find(p=>p.id===d.project.id));}
 for(const item of items){assert.ok(keys.includes(item.category)&&item.category!=='top');assert.ok(Array.isArray(item.secondaryCategories));assert.ok(item.url&&item.title&&item.en&&item.sl);}
 for(const loop of strand.loops){assert.equal(loop.count,loop.section==='top'?8:items.filter(p=>p.category===loop.section).length);assert.ok(strand.instances.filter(d=>d.section===loop.section&&d.y>loop.start&&d.y<loop.end).length<=12);}
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
test('current entry links choose v4 while explicit archive pages remain available',()=>{
 for(const file of ['index.html','proposal1.html','ai8-codex.html']){const html=fs.readFileSync('public/'+file,'utf8');assert.ok(html.includes('ai8-dna-v4.html'));assert.ok(!html.includes('ai8-dna-v3.html'));}
 assert.equal(CURATED.find(p=>p.id==='ai8-dna').url,'/ai8-dna-v4.html');
 for(const file of ['ai8-dna.html','ai8-dna-v2.html','ai8-dna-v3.html','ai8-dna-v4.html'])assert.ok(fs.existsSync('public/'+file));
});
