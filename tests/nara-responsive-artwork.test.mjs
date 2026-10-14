import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {loadFormatEditions,renderEditionPage,generateFormatEditions} from '../scripts/nara-format-editions.mjs';
import {responsiveEditionArtwork} from '../scripts/nara-responsive-artwork.mjs';
import {validateWebp,loadIllustrations} from '../scripts/nara-illustrations.mjs';
import {responsiveFixture,flush} from './helpers/nara-responsive-fixture.mjs';
const root=path.resolve(import.meta.dirname,'..'),n=path.join(root,'public/Nara');
const item=()=>loadFormatEditions(root).find(x=>x.entry.key==='2026-10-05');
const artwork=()=>JSON.parse(fs.readFileSync(path.join(n,'daily/format-editions/2026-10-05/art-R1.json')));
const validate=m=>{const i=item();return responsiveEditionArtwork(root,i,m,validateWebp,loadIllustrations(root,i.originalEn,i.originalSl));};

test('first edition has three moments, all 12 validated variants and bilingual static fallbacks',()=>{
 const m=artwork(),i=item(),images=validate(m),html=renderEditionPage(root,i);assert.equal(images.length,3);
 assert.equal((html.match(/data-nara-responsive=/g)||[]).length,6);assert.equal((html.match(/<source media="\(orientation: portrait\)"/g)||[]).length,6);
 assert.match(html,/nara-daily-responsive\.js/);assert.doesNotMatch(html,/nara-daily-lightbox\.js|nara-daily-resolution\.js/);
 assert.equal((html.match(/data-nara-image-4k=/g)||[]).length,6);assert.doesNotMatch(JSON.stringify(m),/drive|prompt|credential/i);
 for(const image of images){assert.equal(Object.keys(image.variants).length,4);assert.equal(image.after_paragraph,image.after_paragraph_en);for(const v of Object.values(image.variants))assert.ok(html.includes(v.src));}
 const legacy=loadFormatEditions(root).find(x=>x.entry.key==='2026-10-06');assert.doesNotMatch(renderEditionPage(root,legacy),/nara-daily-responsive/);
});
test('responsive schema rejects incomplete slots, unsafe paths, changed bytes, dimensions and binding',()=>{
 for(const [change,error]of [
  [m=>delete m.images[0].variants.P_4K,/four variant/],
  [m=>m.images[0].variants.P_HD.src='../private.webp',/unsafe responsive/],
  [m=>m.images[0].variants.P_HD.sha256='0'.repeat(64),/hash mismatch/],
  [m=>m.images[0].variants.P_4K.width=1080,/dimensions/],
  [m=>m.images[0].paragraph_sha256_sl='0'.repeat(64),/paragraph binding/],
  [m=>m.images[0].variants.private_prompt='secret',/four variant/],
  [m=>m.images[1].moment_id=m.images[0].moment_id,/moment identity/]
 ]){const m=artwork();change(m);assert.throws(()=>validate(m),error);}
});
test('inline loads only visible-language HD; viewport resize selects P/L without a page reload',async()=>{
 const f=responsiveFixture();await flush();assert.equal(f.requests.length,3);assert.ok(f.requests.every(r=>/P[123]-HD/.test(r.src)));
 assert.equal(f.images[0].src,'P1-HD.webp');assert.equal(f.images[0].width,1080);assert.equal(f.images[0].height,1920);
 f.rotate(false);await flush();assert.equal(f.images[0].src,'L1-HD.webp');assert.equal(f.images[0].height,1080);assert.equal(f.viewer.open,false);
});
test('late old-orientation decode cannot overwrite newer inline or viewer selection',async()=>{
 const f=responsiveFixture({auto:false});f.rotate(false);f.settle('L1-HD.webp');await flush();f.settle('P1-HD.webp');await flush();assert.equal(f.images[0].src,'L1-HD.webp');
 f.images[0].fire('click');f.rotate(true);f.settle('P1-4K.webp');await flush();f.settle('L1-4K.webp');await flush();assert.equal(f.large.src,'P1-4K.webp');assert.equal(f.viewer.dataset.orientation,'P');
});
test('viewer keeps the same moment in 4K on rotation; download matches displayed variant',async()=>{
 const f=responsiveFixture();await flush();f.images[1].fire('click');await flush();assert.equal(f.large.src,'P2-4K.webp');assert.equal(f.viewer.dataset.resolution,'4k');assert.equal(f.viewer.dataset.moment,'moment-02');
 f.rotate(false);await flush();assert.equal(f.large.src,'L2-4K.webp');assert.equal(f.controls.children[2].href,f.large.src);assert.equal(f.controls.children[2].download,'L2-4K.webp');
});
test('double tap toggles clean controls and iOS fallback; Escape restores focus and reading position',async()=>{
 const f=responsiveFixture({fullscreen:false});await flush();f.images[0].fire('click');await flush();f.doubleTap();
 assert.equal(f.viewer.classList.contains('nara-responsive-immersive'),true);assert.equal(f.close.hidden,true);assert.equal(f.controls.hidden,true);assert.equal(f.large.src,'P1-4K.webp');
 f.tick(700);f.doubleTap();assert.equal(f.close.hidden,false);assert.equal(f.viewer.open,true);assert.equal(f.document.fullscreenElement,null);
 f.key('Escape');assert.equal(f.viewer.open,false);assert.equal(f.document.activeElement,f.images[0]);assert.deepEqual(f.position,{x:19,y:720});assert.equal(f.viewer.dataset.cacheRetained,'0');
});
test('native fullscreen returns to controls on double tap, and keyboard focus remains inside viewer',async()=>{
 const f=responsiveFixture();await flush();f.images[0].fire('keydown',{key:'Enter'});await flush();f.doubleTap();assert.equal(f.document.fullscreenElement,f.stage);
 f.key('Tab');assert.equal(f.document.activeElement,f.surface);f.tick(700);f.doubleTap();assert.equal(f.document.fullscreenElement,null);assert.equal(f.viewer.open,true);f.close.fire('click');assert.equal(f.viewer.open,false);
});
test('closing after a composition change restores the reading anchor, beyond the old pixel offset',async()=>{
 const f=responsiveFixture();await flush();let layoutTop=820;f.images[0].figure.getBoundingClientRect=()=>({top:layoutTop-f.window.scrollY});
 f.images[0].fire('click');await flush();layoutTop=940;f.rotate(false);await flush();f.key('Escape');
 assert.equal(f.window.scrollY,840);assert.equal(f.scrollByCalls,1);assert.equal(f.document.activeElement,f.images[0]);
});
test('switching language uses the translated figure and its own three-moment group',async()=>{
 const f=responsiveFixture();await flush();f.document.documentElement.lang='sl';f.rotate(true);await flush();f.images[4].fire('click');await flush();
 assert.equal(f.large.alt,'sl moment 2');assert.equal(f.viewer.dataset.moment,'moment-02');assert.equal(f.viewer.dataset.cacheRetained,'6');assert.match(f.images[4].attrs['aria-label'],/Odpri/);
});
test('rolling cache is at most six 4K images, never crosses story boundary, and deduplicates rotation',async()=>{
 const f=responsiveFixture({otherStory:true});await flush();f.images[1].fire('click');await flush();
 assert.equal(f.viewer.dataset.cacheRetained,'6');assert.equal(f.viewer.dataset.cacheReady,'6');const four=()=>f.requests.filter(r=>r.src.includes('4K'));
 assert.equal(four().length,6);assert.ok(four().every(r=>/^[LP][123]-4K\.webp$/.test(r.src)));f.rotate(false);await flush();assert.equal(four().length,6);
 f.key('ArrowRight');await flush();assert.equal(f.viewer.dataset.cacheRetained,'4');assert.equal(f.controls.children[3].disabled,true);f.key('ArrowRight');await flush();assert.equal(f.viewer.dataset.moment,'moment-03');
});
test('required 4K failure shows retry without an HD substitute; retry can recover',async()=>{
 const failures=['P1-4K.webp'],f=responsiveFixture({failed:failures});await flush();f.images[0].fire('click');await flush();
 assert.equal(f.viewer.dataset.loadState,'error');assert.equal(f.message.hidden,false);assert.equal(f.message.children[1].hidden,false);assert.equal(f.controls.children[2].hidden,true);
 assert.ok(!f.large.src);failures.length=0;f.message.children[1].fire('click');await flush();assert.equal(f.large.src,'P1-4K.webp');assert.equal(f.viewer.dataset.loadState,'ready');
});
test('closing cancels pending viewer publication; non-opted-in pages make no new requests',async()=>{
 const f=responsiveFixture({auto:false});f.images[0].fire('click');f.key('Escape');f.settle('P1-4K.webp');await flush();assert.equal(f.viewer.open,false);assert.equal(f.viewer.dataset.cacheRetained,'0');
 const legacy=responsiveFixture({opted:false});assert.equal(legacy.requests.length,0);assert.equal(legacy.viewer,undefined);
});
test('normal regeneration is idempotent and leaves later editions and immutable snapshots unchanged',t=>{
 const r=fs.mkdtempSync(path.join(os.tmpdir(),'nara-responsive-'));t.after(()=>fs.rmSync(r,{recursive:true,force:true}));const target=path.join(r,'public/Nara');fs.mkdirSync(target,{recursive:true});
 fs.cpSync(path.join(n,'daily'),path.join(target,'daily'),{recursive:true});
 for(const file of fs.readdirSync(n).filter(f=>f.endsWith('-format-R1.html')))fs.copyFileSync(path.join(n,file),path.join(target,file));
 for(const i of loadFormatEditions(root)){const file=path.join(n,i.paths.artwork);if(!fs.existsSync(file))continue;const m=JSON.parse(fs.readFileSync(file));for(const src of new Set(m.images.flatMap(im=>[im.src,im.src_4k,...Object.values(im.variants||{}).map(v=>v.src)]).filter(Boolean))){fs.mkdirSync(path.dirname(path.join(target,src)),{recursive:true});fs.copyFileSync(path.join(n,src),path.join(target,src));}}
 const before=fs.readFileSync(path.join(target,'Nara-AI-2026-10-06-format-R1.html'));assert.deepEqual(generateFormatEditions(r).changed,[]);assert.deepEqual(fs.readFileSync(path.join(target,'Nara-AI-2026-10-06-format-R1.html')),before);
});
