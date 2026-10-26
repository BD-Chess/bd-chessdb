import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {sanitizePrivateHTML} from '../public/BD/O/izleti/andaluzija-private-html.mjs';
const {JSDOM}=createRequire(process.env.ANDALUZIJA_TEST_DEPENDENCIES||import.meta.url)('jsdom');
const dom=new JSDOM('',{url:'https://www.mdlxdcc.org/bd/o/izleti/andaluzija-2027'});
globalThis.location=dom.window.location;
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII=';
function clean(html){return new dom.window.DOMParser().parseFromString(sanitizePrivateHTML(html,dom.window.DOMParser),'text/html');}
test('private PNG evidence survives while active markup and unsafe URLs are removed',()=>{
 const doc=clean('<details><summary>Evidence</summary><img src="'+png+'" onerror="alert(1)"><script>alert(1)</script><svg onload="alert(1)"></svg><a href="javascript:alert(1)">bad</a><a href="https://www.google.com/maps/">map</a></details>');
 assert.equal(doc.querySelector('img').getAttribute('src'),png);
 assert.equal(doc.querySelector('img').hasAttribute('onerror'),false);
 assert.equal(doc.querySelectorAll('script,svg').length,0);
 assert.equal(doc.querySelectorAll('a')[0].hasAttribute('href'),false);
 assert.equal(doc.querySelectorAll('a')[1].href,'https://www.google.com/maps/');
 assert.equal(doc.querySelector('summary').textContent,'Evidence');
});
test('private image exception is bounded and applies only to PNG image sources',()=>{
 for(const src of ['data:image/svg+xml;base64,PHN2Zz4=','data:text/html;base64,PGgxPng8L2gxPg==','data:image/png;base64,bm90LXBuZw==',png+'!','data:image/png;base64,iVBORw0KGgo'+'A'.repeat(2*1024*1024)])assert.equal(clean('<img src="'+src+'">').querySelector('img').hasAttribute('src'),false);
 assert.equal(clean('<a href="'+png+'">file</a>').querySelector('a').hasAttribute('href'),false);
});
test('published evidence remains a Shield envelope without plaintext image or document markup',async()=>{
 const raw=await readFile('public/BD/O/izleti/andaluzija-private.8zs.json','utf8'),e=JSON.parse(raw);
 assert.equal(e.header.format,'8ZShield');assert.equal(e.header.version,4);assert.equal(e.header.kind,'sections');
 assert.equal(e.header.domain,'www.mdlxdcc.org');assert(e.keys.length>0);
 assert(!raw.includes('data:image/'));assert(!raw.includes('mail-evidence'));
 assert(Buffer.byteLength(raw)<32*1024*1024);
});
