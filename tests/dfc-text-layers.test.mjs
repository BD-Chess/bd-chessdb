import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {sha} from '../scripts/dfc-build-overviews.mjs';
import {validatePassiveSVG} from '../scripts/dfc-import-pairs.mjs';
import {validateEdition,canonical} from '../public/Nara/dualframe-lab/dfc-model.mjs';
const sharp=createRequire(new URL('../functions/package.json',import.meta.url))('sharp');
const root=new URL('../public/Nara/dualframe-lab/content/illuminara/',import.meta.url),read=f=>readFile(new URL(f,root));
const edition=JSON.parse(await read('edition.json')),baseline=JSON.parse(execFileSync('git',['show','73353effe2b3fc43c71ad64f2160395cf5af2777:public/Nara/dualframe-lab/content/illuminara/edition.json']));
const plain=s=>s.replace(/&quot;/g,'"').replace(/&apos;|&#x27;|&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const words=b=>[...b.toString('utf8').matchAll(/data-original-text="([^"]*)"/g)].map(m=>plain(m[1])).join(' ').normalize('NFC').replace(/\s+/g,' ').trim().toUpperCase();
test('all eight pages /39 source panels have real separated text layers and exact bilingual ownership',async()=>{
 validateEdition(edition);assert.deepEqual(edition.text_capabilities,{overview:true,source:true,pairs:true,languages:['SL','EN'],policy:'clean-art-with-independent-original-lettering'});
 for(const page of edition.pages)for(const lang of ['SL','EN']){const a=page.text_layers.clean_assets[lang],b=await read(a.file);assert.equal(sha(b),a.sha256);const meta=await sharp(b).metadata();assert.equal(meta.width,1024);assert.equal(meta.height,1660);for(const id of page.panel_ids){const p=edition.panels.find(p=>p.panel_id===id),overlay=page.text_layers.panel_overlays[lang][id],data=await read(overlay.file);assert.equal(sha(data),overlay.sha256);await validatePassiveSVG(data,overlay);assert.equal(words(data),p.dialogue.map(d=>d[lang]).join(' ').replace(/\s+/g,' ').trim().toUpperCase());assert.match(data.toString(),new RegExp('data-panel-id="'+id+'"'));assert.deepEqual(overlay.text_ids,p.text_ids);}}
 for(const p of edition.panels)for(const lang of ['SL','EN']){const a=p.source_overlays[lang],b=await read(a.file);await validatePassiveSVG(b,a);assert.equal(sha(b),a.sha256);assert.equal(words(b),p.dialogue.map(d=>d[lang]).join(' ').replace(/\s+/g,' ').trim().toUpperCase());const [x,y]=p.source_zoom.crop_rect_px;assert.ok(b.toString().includes(`translate(${-x} ${-y-88})`));}
});
test('all original 78 paired art /156 overlays /39 source crops /16 lettered pages /source strings/state are byte-identical',async()=>{
 const frozen=[];for(const [i,p]of edition.panels.entries()){const old=baseline.panels[i];for(const key of ['panel_id','page_id','reading_order','story_beat','protected_story_facts','dialogue','text_ids','hotspots','art_source','story_state_sha256','P','L','overlays','source_zoom'])assert.equal(canonical(p[key]),canonical(old[key]),p.panel_id+' '+key);for(const a of [old.P,old.L,old.source_zoom,...Object.values(old.overlays).flatMap(Object.values)])frozen.push(a);}
 for(const [i,p]of edition.pages.entries()){assert.deepEqual(p.overview_assets,baseline.pages[i].overview_assets);frozen.push(...Object.values(p.overview_assets));}
 assert.equal(frozen.length,289);for(const a of frozen)assert.equal(sha(await read(a.file)),a.sha256,a.file);
});
test('declared separated layers fail closed for missing ownership, text IDs, geometry and capability',()=>{for(const mutate of [e=>delete e.pages[0].text_layers.panel_overlays.SL['P01-K02'],e=>e.pages[0].text_layers.panel_overlays.SL['P01-K02'].panel_id='P01-K03',e=>e.panels[0].source_overlays.SL.text_ids=[],e=>e.panels[0].source_overlays.SL.height_px++,e=>e.pages[0].text_layers.capability='embedded']){const bad=structuredClone(edition);mutate(bad);assert.throws(()=>validateEdition(bad),/DFC_/);}});
test('shared passive SVG validator rejects active/external markup before image decoding',async()=>{for(const payload of ['<script>alert(1)</script>','<image href="data:image/png;base64,abc"/>','<foreignObject/>','<g onclick="x()"/>','<style>@import "x"</style>','<style>x{fill:url(https://x)}</style>'])await assert.rejects(validatePassiveSVG(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10">${payload}</svg>`),{width_px:10,height_px:10}),/SVG_ACTIVE_CONTENT|SVG_EXTERNAL_RESOURCE/);});
