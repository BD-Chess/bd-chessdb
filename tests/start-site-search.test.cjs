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
    ['8ztsp', '/BD/BD_8ZTSP.html'],
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
