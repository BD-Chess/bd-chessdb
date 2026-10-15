import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';
import {loadFormatEditions,renderEditionPage,generateFormatEditions} from '../scripts/nara-format-editions.mjs';
import {responsiveEditionArtwork} from '../scripts/nara-responsive-artwork.mjs';
import {validateWebp,loadIllustrations} from '../scripts/nara-illustrations.mjs';
import {responsiveFixture,flush} from './helpers/nara-responsive-fixture.mjs';
const root=path.resolve(import.meta.dirname,'..'),n=path.join(root,'public/Nara');
const item=()=>loadFormatEditions(root).find(x=>x.entry.key==='2026-10-05');
const artwork=()=>JSON.parse(fs.readFileSync(path.join(n,'daily/format-editions/2026-10-05/art-R1.json')));
const validate=m=>{const i=item();return responsiveEditionArtwork(root,i,m,validateWebp,loadIllustrations(root,i.originalEn,i.originalSl));};

test('first edition has three moments, all six validated HD variants and bilingual static fallbacks',()=>{
 const m=artwork(),i=item(),images=validate(m),html=renderEditionPage(root,i);assert.equal(images.length,3);
 assert.equal((html.match(/data-nara-responsive=/g)||[]).length,6);assert.equal((html.match(/<source media="\(orientation: portrait\)"/g)||[]).length,6);
 assert.match(html,/nara-daily-responsive\.js/);assert.doesNotMatch(html,/nara-daily-lightbox\.js|nara-daily-resolution\.js/);
 assert.doesNotMatch(html,/data-nara-image-4k=/);assert.doesNotMatch(JSON.stringify(m),/drive|prompt|credential/i);
 for(const image of images){assert.equal(Object.keys(image.variants).length,2);assert.equal(image.after_paragraph,image.after_paragraph_en);for(const v of Object.values(image.variants))assert.ok(html.includes(v.src));}
 const legacy=fs.readFileSync(path.join(n,i.paths.original_page),'utf8');assert.doesNotMatch(legacy,/nara-daily-responsive/);
});
test('responsive schema rejects incomplete slots, unsafe paths, changed bytes, dimensions and binding',()=>{
 for(const [change,error]of [
  [m=>delete m.images[0].variants.P_HD,/two HD variant/],
  [m=>m.images[0].variants.P_HD.src='../private.webp',/unsafe responsive/],
  [m=>m.images[0].variants.P_HD.sha256='0'.repeat(64),/hash mismatch/],
  [m=>m.images[0].variants.P_HD.width=2160,/dimensions/],
  [m=>m.images[0].paragraph_sha256_sl='0'.repeat(64),/paragraph binding/],
  [m=>m.images[0].variants.private_prompt='secret',/two HD variant/],
  [m=>m.images[1].moment_id=m.images[0].moment_id,/moment identity/]
 ]){const m=artwork();change(m);assert.throws(()=>validate(m),error);}
});
test('Oct6 reuses all approved 1672x941 landscape HD bytes with a pinned, independently validated source',()=>{
 const i=loadFormatEditions(root).find(x=>x.entry.key==='2026-10-06'),m=JSON.parse(fs.readFileSync(path.join(n,i.paths.artwork)));
 assert.equal(m.schema,'nara.format.edition.artwork.v5');assert.equal(m.landscape_hd_source.src,'daily/format-editions/2026-10-06/art-approved-L-HD-R1.json');
 const approved=JSON.parse(fs.readFileSync(path.join(n,m.landscape_hd_source.src))),html=renderEditionPage(root,i);
 assert.equal((html.match(/data-nara-responsive=/g)||[]).length,6);assert.doesNotMatch(JSON.stringify(m),/drive|prompt|credential/i);
 for(let index=0;index<3;index++){const im=m.images[index],old=approved.images[index];assert.deepEqual(im.variants.L_HD,{src:old.src,width:1672,height:941,sha256:old.sha256});assert.equal(im.after_paragraph_en,old.after_paragraph_en);assert.equal(im.after_paragraph_sl,old.after_paragraph_sl);assert.equal(Object.keys(im.variants).length,2);}
 assert.equal(approved.schema,'nara.format.edition.artwork.v3');
 assert.throws(()=>responsiveEditionArtwork(root,i,m,validateWebp),/source validator required/);
});
test('approved HD reuse fails closed for unsafe references, hash, stale source, dimensions or changed anchors',t=>{
 const r=fs.mkdtempSync(path.join(os.tmpdir(),'nara-approved-hd-'));t.after(()=>fs.rmSync(r,{recursive:true,force:true}));const target=path.join(r,'public/Nara');fs.mkdirSync(target,{recursive:true});fs.cpSync(path.join(n,'daily'),path.join(target,'daily'),{recursive:true});
 for(const file of fs.readdirSync(n).filter(file=>file.endsWith('-pre-format-R1.html')))fs.copyFileSync(path.join(n,file),path.join(target,file));
 const srcDir='assets/img/daily/2026-10-06';fs.mkdirSync(path.dirname(path.join(target,srcDir)),{recursive:true});fs.cpSync(path.join(n,srcDir),path.join(target,srcDir),{recursive:true});
 const i=loadFormatEditions(r).find(x=>x.entry.key==='2026-10-06'),file=path.join(target,i.paths.artwork),original=JSON.parse(fs.readFileSync(file)),sourceFile=path.join(target,original.landscape_hd_source.src),sourceBytes=fs.readFileSync(sourceFile);
 for(const [change,error]of [
  [m=>m.landscape_hd_source.src='../private.json',/unsafe approved/],
  [m=>m.landscape_hd_source.sha256='0'.repeat(64),/source hash mismatch/],
  [m=>m.images[0].width=1920,/approved landscape HD binding/],
  [m=>m.images[0].variants.L_HD.src='assets/img/daily/2026-10-05/R1/moment-1.webp',/unsafe responsive/],
  [m=>m.images[0].after_paragraph_en++,/bilingual anchor binding/],
  [m=>m.images[0].src=m.images[1].src,/approved landscape HD binding/]
 ]){const m=JSON.parse(JSON.stringify(original));change(m);fs.writeFileSync(file,JSON.stringify(m));assert.throws(()=>renderEditionPage(r,i),error);}
 fs.writeFileSync(file,JSON.stringify(original));fs.unlinkSync(sourceFile);assert.throws(()=>renderEditionPage(r,i),/source missing/);fs.writeFileSync(sourceFile,sourceBytes);
 const stale=JSON.parse(sourceBytes);stale.en_content_sha256='0'.repeat(64);const bytes=JSON.stringify(stale);fs.writeFileSync(sourceFile,bytes);
 // Even a matching byte pin cannot bypass the existing v3 body/paragraph validator.
 const m=JSON.parse(JSON.stringify(original));m.landscape_hd_source.sha256=crypto.createHash('sha256').update(bytes).digest('hex');fs.writeFileSync(file,JSON.stringify(m));assert.throws(()=>renderEditionPage(r,i),/direct edition artwork language binding/);
});
test('Oct7 binds its three approved HD moments to six HD variants without changing EN/SL anchors',()=>{
 const i=loadFormatEditions(root).find(x=>x.entry.key==='2026-10-07'),m=JSON.parse(fs.readFileSync(path.join(n,i.paths.artwork))),source=JSON.parse(fs.readFileSync(path.join(n,m.landscape_hd_source.src))),html=renderEditionPage(root,i);
 assert.equal(m.schema,'nara.format.edition.artwork.v5');assert.equal((html.match(/data-nara-responsive=/g)||[]).length,6);assert.doesNotMatch(JSON.stringify(m),/prompt|drive|credential/i);
 for(let index=0;index<3;index++){const x=m.images[index],old=source.images[index];assert.equal(x.scene,old.scene);assert.equal(x.after_paragraph_en,old.after_paragraph_en);assert.equal(x.after_paragraph_sl,old.after_paragraph_sl);assert.equal(x.paragraph_sha256_en,old.paragraph_sha256_en);assert.equal(x.paragraph_sha256_sl,old.paragraph_sha256_sl);assert.deepEqual(x.variants.L_HD,{src:old.src,width:1672,height:941,sha256:old.sha256});assert.equal(Object.keys(x.variants).length,2);for(const variant of Object.values(x.variants))assert.ok(html.includes(variant.src));}
});
test('Oct9-S1 preserves its own approved landscape folder and rejects a sibling instance',()=>{
 const i=loadFormatEditions(root).find(x=>x.entry.key==='2026-10-09-S1'),m=JSON.parse(fs.readFileSync(path.join(n,i.paths.artwork))),approved=JSON.parse(fs.readFileSync(path.join(n,m.landscape_hd_source.src))),html=renderEditionPage(root,i);
 assert.equal(m.schema,'nara.format.edition.artwork.v5');assert.equal((html.match(/data-nara-responsive=/g)||[]).length,6);
 for(let index=0;index<3;index++)assert.deepEqual(m.images[index].variants.L_HD,{src:approved.images[index].src,width:1672,height:941,sha256:approved.images[index].sha256});
 const changed=structuredClone(m);changed.images[0].variants.L_HD.src=changed.images[0].variants.L_HD.src.replace('/S1/','/S2/');
 assert.throws(()=>responsiveEditionArtwork(root,i,changed,validateWebp,[],()=>approved.images),/unsafe responsive variant path/);
});
test('inline loads only visible-language HD; viewport resize selects P/L without a page reload',async()=>{
 const f=responsiveFixture();await flush();assert.equal(f.requests.length,3);assert.ok(f.requests.every(r=>/P[123]-HD/.test(r.src)));
 assert.equal(f.images[0].src,'P1-HD.webp');assert.equal(f.images[0].width,1080);assert.equal(f.images[0].height,1920);
 f.rotate(false);await flush();assert.equal(f.images[0].src,'L1-HD.webp');assert.equal(f.images[0].height,1080);assert.equal(f.viewer.open,false);
});
test('late old-orientation decode cannot overwrite newer inline or viewer selection',async()=>{
 const f=responsiveFixture({auto:false});f.rotate(false);f.settle('L1-HD.webp');await flush();f.settle('P1-HD.webp');await flush();assert.equal(f.images[0].src,'L1-HD.webp');
 f.images[0].fire('click');f.rotate(true);f.settle('P1-HD.webp');await flush();f.settle('L1-HD.webp');await flush();assert.equal(f.large.src,'P1-HD.webp');assert.equal(f.viewer.dataset.orientation,'P');
});
test('viewer keeps the same moment in HD on rotation; download matches displayed variant',async()=>{
 const f=responsiveFixture();await flush();f.images[1].fire('click');await flush();assert.equal(f.large.src,'P2-HD.webp');assert.equal(f.viewer.dataset.resolution,'hd');assert.equal(f.viewer.dataset.moment,'moment-02');
 f.rotate(false);await flush();assert.equal(f.large.src,'L2-HD.webp');assert.equal(f.controls.children[2].href,f.large.src);assert.equal(f.controls.children[2].download,'L2-HD.webp');
});
test('double tap toggles clean controls and iOS fallback; Escape restores focus and reading position',async()=>{
 const f=responsiveFixture({fullscreen:false});await flush();f.images[0].fire('click');await flush();f.doubleTap();
 assert.equal(f.viewer.classList.contains('nara-responsive-immersive'),true);assert.equal(f.close.hidden,true);assert.equal(f.controls.hidden,true);assert.equal(f.large.src,'P1-HD.webp');
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
test('rolling cache is at most six HD images, never crosses story boundary, and deduplicates rotation',async()=>{
 const f=responsiveFixture({otherStory:true});await flush();f.images[1].fire('click');await flush();
 assert.equal(f.viewer.dataset.cacheRetained,'6');assert.equal(f.viewer.dataset.cacheReady,'6');const cached=()=>f.requests.filter(r=>r.priority==='high'||r.priority==='low');
 assert.equal(cached().length,6);assert.ok(cached().every(r=>/^[LP][123]-HD\.webp$/.test(r.src)));f.rotate(false);await flush();assert.equal(cached().length,6);
 f.key('ArrowRight');await flush();assert.equal(f.viewer.dataset.cacheRetained,'4');assert.equal(f.controls.children[3].disabled,true);f.key('ArrowRight');await flush();assert.equal(f.viewer.dataset.moment,'moment-03');
});
test('required HD failure shows retry with a retry; retry can recover',async()=>{
 const failures=['P1-HD.webp'],f=responsiveFixture({failed:failures});await flush();f.images[0].fire('click');await flush();
 assert.equal(f.viewer.dataset.loadState,'error');assert.equal(f.message.hidden,false);assert.equal(f.message.children[1].hidden,false);assert.equal(f.controls.children[2].hidden,true);
 assert.ok(!f.large.src);failures.length=0;f.message.children[1].fire('click');await flush();assert.equal(f.large.src,'P1-HD.webp');assert.equal(f.viewer.dataset.loadState,'ready');
});
test('closing cancels pending viewer publication; non-opted-in pages make no new requests',async()=>{
 const f=responsiveFixture({auto:false});f.images[0].fire('click');f.key('Escape');f.settle('P1-HD.webp');await flush();assert.equal(f.viewer.open,false);assert.equal(f.viewer.dataset.cacheRetained,'0');
 const legacy=responsiveFixture({opted:false});assert.equal(legacy.requests.length,0);assert.equal(legacy.viewer,undefined);
});
test('normal regeneration is idempotent and leaves later editions and immutable snapshots unchanged',t=>{
 const r=fs.mkdtempSync(path.join(os.tmpdir(),'nara-responsive-'));t.after(()=>fs.rmSync(r,{recursive:true,force:true}));const target=path.join(r,'public/Nara');fs.mkdirSync(target,{recursive:true});
 fs.cpSync(path.join(n,'daily'),path.join(target,'daily'),{recursive:true});
 for(const file of fs.readdirSync(n).filter(f=>f.endsWith('-format-R1.html')))fs.copyFileSync(path.join(n,file),path.join(target,file));
 for(const i of loadFormatEditions(root)){const file=path.join(n,i.paths.artwork);if(!fs.existsSync(file))continue;const m=JSON.parse(fs.readFileSync(file));for(const src of new Set(m.images.flatMap(im=>[im.src,...Object.values(im.variants||{}).map(v=>v.src)]).filter(Boolean))){fs.mkdirSync(path.dirname(path.join(target,src)),{recursive:true});fs.copyFileSync(path.join(n,src),path.join(target,src));}}
 const originals=fs.readdirSync(target).filter(f=>f.endsWith('-pre-format-R1.html')).map(f=>[f,fs.readFileSync(path.join(target,f))]);
 // Historical generated pages may predate the current published score ledger.
 // Establish the current generated bytes, then prove another pass is stable.
 generateFormatEditions(r);const before=fs.readFileSync(path.join(target,'Nara-AI-2026-10-06-format-R1.html'));assert.deepEqual(generateFormatEditions(r).changed,[]);assert.deepEqual(fs.readFileSync(path.join(target,'Nara-AI-2026-10-06-format-R1.html')),before);
 for(const [file,bytes]of originals)assert.deepEqual(fs.readFileSync(path.join(target,file)),bytes);
});
