// Synthetic dates and times only. Never place the owner's schedule in fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const root='public/BD/O/izleti/';
test('verified private flight prefills the calculator; manual comparison is labelled; lock clears data',async()=>{
 const html=await readFile(root+'andaluzija-2027.html','utf8');
 const dom=new JSDOM(html,{url:'https://www.mdlxdcc.org/bd/o/izleti/andaluzija-2027',runScripts:'outside-only'}),w=dom.window;
 delete w.ResizeObserver;
 w.eval(await readFile(root+'andaluzija-2027-data.js','utf8'));
 const pub=structuredClone(w.ANDALUZIJA);
 w.eval(await readFile(root+'andaluzija-2027.js','utf8'));
 const privateNotes=w.document.createElement('div');privateNotes.innerHTML='<textarea id="bd-notes"></textarea><button id="export-notes"></button><p id="notes-status"></p>';w.document.body.append(privateNotes);
 const data=structuredClone(pub);data.trip={startDate:'2032-06-01',endDate:'2032-06-10',flightTimesVerified:true};
 data.purchase={flights:{inboundDeparture:'2032-06-10T23:35:00+02:00',inboundArrival:'2032-06-11T02:20:00+02:00'}};
 w.dispatchEvent(new w.CustomEvent('andaluzija-content',{detail:{data,preferences:{'bd-andaluzija-2027-r1-flight-time':'12:00'}}}));
 assert.equal(w.document.querySelector('#flight-time').value,'23:35','verified schedule wins over stale saved guesses');
 assert.match(w.document.querySelector('#flight-result').textContent,/preverjena iz »Karte«/);
 assert.match(w.document.querySelector('#flight-result').textContent,/02:20/);
 w.document.querySelector('#flight-time').value='14:30';w.document.querySelector('#flight-time').dispatchEvent(new w.Event('input'));
 assert.match(w.document.querySelector('#flight-result').textContent,/Primerjalna ura/);
 w.dispatchEvent(new w.CustomEvent('andaluzija-content',{detail:null}));
 assert.equal(w.ANDALUZIJA.privateUnlocked,false);assert.equal(w.ANDALUZIJA.purchase,undefined);
 assert.equal(w.document.querySelector('#flight-time').value,'');assert(!w.document.querySelector('#flight-result').textContent.includes('02:20'));
 dom.window.close();
});
test('portrait inset is not additive; album changes are scoped; fullscreen status owns its row',async()=>{
 const css=await readFile(root+'andaluzija-2027.css','utf8'),html=await readFile(root+'andaluzija-2027.html','utf8'),js=await readFile(root+'andaluzija-2027.js','utf8');
 assert(css.includes('--trip-safe-top:max(18px,env(safe-area-inset-top,0px))'));
 assert(css.includes('.andaluzija-trip .df-album-viewer:not(.is-immersive)>.df-viewer-top'));
 assert(css.includes('.map-expanded .map-viewbar{display:grid;grid-template-columns:minmax(0,1fr)'));
 assert(html.includes('<body class="andaluzija-trip">'));
 assert(!js.includes('Podlaga je satelitska s cestami in oznakami.'));
 assert(html.includes('Izberita podlago.'));
});
