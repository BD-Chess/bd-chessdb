// Test-only generated compositions. Never production content.
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {SOURCE,STORY_ID} from '../public/Nara/dualframe-lab/dfc-model.mjs';
import {sha} from '../scripts/dfc-build-overviews.mjs';
import {zipStore} from '../public/Nara/dualframe-lab/zip-store.mjs';
const sharp=createRequire(new URL('../functions/package.json',import.meta.url))('sharp');
const content=new URL('../public/Nara/dualframe-lab/content/illuminara/',import.meta.url),read=p=>readFile(new URL(p,content));
const edition=JSON.parse(await read('edition.json'));
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export async function pairFixture(panelIndex=0){
 // Explicit synthetic test-only compositions. Returned to tests, never copied
 // into production content. Both are intentionally different, actual PNGs.
 const source=edition.panels[panelIndex],files=new Map(),part='SYNTHETIC_TEST_PART';const add=(file,bytes,extra={})=>{files.set(file,bytes);return {file,sha256:sha(bytes),delivery_part_id:part,...extra};};
 const panel={panel_id:source.panel_id,page_id:source.page_id,reading_order:source.reading_order,source_panel_ref:source.panel_id,story_state_sha256:source.story_state_sha256,text_ids:source.text_ids,qa_status:'PASS',overlays:{P:{},L:{}}};
 for(const [o,w,h,color]of [['P',96,160,'#218496'],['L',160,96,'#c79451']]){const b=await sharp({create:{width:w,height:h,channels:4,background:color}}).png().toBuffer();panel[o]=add(`art/${source.panel_id}/${o}.png`,b,{width_px:w,height_px:h,native_generation:{fixture:true},provenance:{fixture:true},protected_subject_rect_norm:[.05,.05,.9,.9],display_policy:'fit'});for(const lang of ['SL','EN']){const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><text x="2" y="20">${escape(source.dialogue.map(r=>r[lang]).join(' '))}</text></svg>`);panel.overlays[o][lang]=add(`lettering/${source.panel_id}/${o}_${lang}.svg`,svg,{width_px:w,height_px:h,text_ids:source.text_ids});}}
 add(`story-state/${source.panel_id}.json`,await read(`story-state/${source.panel_id}.json`));add(`provenance/${source.panel_id}.json`,Buffer.from(JSON.stringify({panel_id:source.panel_id,story_state_sha256:source.story_state_sha256,fixture:true})));add('sources/DFC_DIALOGUE_SOURCE.json',await read('sources/DFC_DIALOGUE_SOURCE.json'));
 add('SHA256SUMS.txt',Buffer.from([...files].map(([p,b])=>sha(b)+'  '+p).join('\n')+'\n'));
 const blob=await zipStore([...files].map(([name,bytes])=>({name,blob:new Blob([bytes])}))),zip=Buffer.from(await blob.arrayBuffer());
 const catalog={schema:'bd.dfc.paired-catalog.v1',version:'SYNTHETIC_FIXTURE_ONLY',story_id:STORY_ID,source_h1_release_sha256:SOURCE.h1,overview_catalog_sha256:SOURCE.catalog,dialogue_file:'sources/DFC_DIALOGUE_SOURCE.json',dialogue_sha256:SOURCE.dialogue,panel_count:39,pair_count:1,artwork_composition_count:2,panels:[panel],delivery_parts:[{part_id:part,filename:'fixture.zip',drive_id:'SYNTHETIC_LOCAL_TEST',bytes:zip.length,sha256:sha(zip),panel_ids:[source.panel_id],included_files:[...files.keys()],raw_readback:'PASS'}],package_manifest:'SHA256SUMS.txt'};
 return {catalog,catalogBytes:Buffer.from(JSON.stringify(catalog)),partsByDrive:{SYNTHETIC_LOCAL_TEST:'fixture.zip'},edition,loadPart:async()=>zip,zip,files};
}
