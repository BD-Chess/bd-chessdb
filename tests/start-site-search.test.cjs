'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const search = require('../public/Start/site-search.js');

const base = 'https://www.mdlxdcc.org/';
test('public search finds the current 8zTSP page and recent work', () => {
  const index = JSON.parse(fs.readFileSync('public/site-search-index.json', 'utf8'));
  const items = search.publicEntries(index, base);
  for (const [q, expected] of [
    ['8ztsp', '/TSP/8ztsp/'],
    ['ai8 dna', '/ai8-dna-v4.html'],
    ['omnicpq origin', '/AI8/omnicpq-origin-TS/'],
    ['the count the mountain asked for', '/Nara/Nara-AI-2026-11-11-S1-story.html']
  ]) {
    assert.ok(search.search(items, q).some(item => new URL(item.url).pathname.toLowerCase() === expected.toLowerCase()), q);
  }
});

test('catalogue entries stay within the site and exclude private routes, including encoded paths', () => {
  const payload = {items: [
    {url:'/BD/O/secret.html',title:'private'}, {url:'/BD%2FO%2Fsecret.html',title:'encoded private'},
    {url:'/%2FBD%2FO%2Fsecret.html',title:'encoded slash private'}, {url:'/WL/',title:'private workspace'},
    {url:'/BD/BBSH.html',title:'private loader'}, {url:'/BD/BD_kardiolog.html',title:'private document'},
    {url:'/AI8/AI8-state.html',title:'private state'}, {url:'/misc/vault/file.html',title:'private vault'},
    {url:'//example.invalid/secret',title:'external'}, {url:'https://example.invalid/',title:'absolute'},
    {url:'/a/index.html',title:'Jezero'}, {url:'/a/',title:'duplicate'}, {url:'/b.html',title:'Življenje'}
  ]};
  const items = search.publicEntries(payload, 'https://bd-chess.github.io/bd-chessdb/');
  assert.deepEqual(items.map(item => new URL(item.url).pathname), ['/bd-chessdb/a/index.html','/bd-chessdb/b.html']);
  assert.equal(search.search(items,'zivljenje')[0].title, 'Življenje');
  assert.equal(search.search(items,'JEZERO')[0].title, 'Jezero');
});

test('invalid catalogues fail safely and result counts are bounded', () => {
  assert.throws(() => search.publicEntries({}, base), /Invalid/);
  const items=search.publicEntries({items:Array.from({length:40},(_,i)=>({url:'/p'+i+'.html',title:'Page '+i}))},base);
  assert.equal(search.search(items,'page',12).length,12);
  assert.deepEqual(search.search(items,'',12),[]);
});

test('Aktualno is the first Start category and moves the existing project shortcuts without duplicates', () => {
  const html = fs.readFileSync('public/Start/index.html','utf8');
  const groups = [...html.matchAll(/<details[^>]*data-category="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(groups[0], 'current');
  assert.equal(groups[1], 'ai');
  const current = html.match(/<details[^>]*data-category="current"[\s\S]*?<\/details>/)[0];
  for (const route of ['/8zC-results/','/tsp/8ztsp/','/8zTSP/','/8zllm/','/8znas/']) {
    assert.ok(current.includes('href="'+route+'"'), route);
    assert.equal(html.split('href="'+route+'"').length, 2, route);
  }
  const contract = require('../public/Start/state.js');
  assert.equal(contract.categories[0], 'current');
  const prefs = {lang:'sl',theme:'dark',mode:'overview',linkGroup:'lab',newsGroup:'science',city:'Ljubljana',scale:100,calendarDate:'2026-11-24',calendarMonth:'2026-11',openPanels:Object.fromEntries(contract.panels.map(id=>[id,false])),openGroups:{ai:false,research:true,development:false,daily:false,travel:false,lab:false}};
  const prior={version:1,preferences:prefs,links:{daily:[],lab:[],markets:[]},events:[],notes:'preserved',saved:[]};
  let n=contract.normalize(prior);
  assert.equal(n.preferences.openGroups.current,true);
  assert.equal(n.preferences.openGroups.research,true);
  assert.equal(n.notes,'preserved');
  prefs.openGroups.current=false;
  n=contract.normalize(prior);
  assert.equal(n.preferences.openGroups.current,false);
  prefs.openGroups.current='false';
  assert.throws(()=>contract.normalize(prior),/invalidData/);
});
test('8zLLM and 8zNAS are public, cross-linked and discoverable at the lowercase routes', () => {
  const index = JSON.parse(fs.readFileSync('public/site-search-index.json','utf8'));
  const items = search.publicEntries(index,base);
  const redirects=fs.readFileSync('public/_redirects','utf8');
  for(const [name,slug,peer] of [['8zLLM','8zllm','8znas'],['8zNAS','8znas','8zllm']]){
    const html=fs.readFileSync('public/'+name+'/index.html','utf8');
    assert.ok(html.includes('href="/'+peer+'/"'));
    assert.ok(html.includes('lang="sl"')&&html.includes('lang="en"'));
    assert.ok(html.includes('https://www.mdlxdcc.org/'+slug+'/'));
    assert.ok(html.includes('/shared/8z-research.css')&&html.includes('/shared/8z-research.js'));
    assert.ok(redirects.includes('/'+slug+'/ /'+name+'/index.html 200!'));
    assert.ok(search.search(items,name).some(item=>new URL(item.url).pathname.toLowerCase()==='/'+slug+'/'));
    assert.ok(!/drive\.google\.com|onedrive\.live\.com/i.test(html),'no private source links');
  }
  assert.equal(index.total_pages,index.items.length);
});
