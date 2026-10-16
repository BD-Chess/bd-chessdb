// Deterministic, source-bound web derivatives. Source files remain byte-identical.
// Usage: node scripts/dfc-build-overviews.mjs H1_EXTRACTED_ROOT H1_RELEASE_JSON
import {readFile,writeFile,mkdir,rename,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {SOURCE,STORY_ID,PANEL_IDS,assert,canonical,normalizeDialogue,storyState,rectValid,safePath,validateEdition} from '../public/Nara/dualframe-lab/dfc-model.mjs';
const sharp=createRequire(new URL('../functions/package.json',import.meta.url))('sharp');
export const sha=b=>createHash('sha256').update(b).digest('hex');
export const appRoot=fileURLToPath(new URL('../public/Nara/dualframe-lab/',import.meta.url));
export async function atomic(file,bytes){await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.tmp',bytes);await rename(file+'.tmp',file);}
export async function build(source,releasePath,destination=path.join(appRoot,'content/illuminara')){
 const read=async name=>readFile(path.join(source,safePath(name)));
 const catalogBytes=await read('output/DFC_OVERVIEW_CATALOG.json'),dialogueBytes=await read('output/DFC_DIALOGUE_SOURCE.json'),release=await readFile(releasePath);
 assert(sha(catalogBytes)===SOURCE.catalog&&sha(dialogueBytes)===SOURCE.dialogue&&sha(release)===SOURCE.h1,'INPUT_HASH');
 const c=JSON.parse(catalogBytes),d=JSON.parse(dialogueBytes),records=normalizeDialogue(c,d);assert(c.story_id===STORY_ID&&c.panels.length===39&&canonical(c.panels.map(p=>p.panel_id))===canonical(PANEL_IDS),'INPUT_ORDER');
 const members=[];const save=async(file,b,extra={})=>{await atomic(path.join(destination,file),b);const a={file,bytes:b.length,sha256:sha(b),...extra};members.push(a);return a;};
 await save('sources/DFC_OVERVIEW_CATALOG.json',catalogBytes);await save('sources/DFC_DIALOGUE_SOURCE.json',dialogueBytes);await save('sources/DFC_H1_RELEASE.json',release);
 const e={schema:'bd.dfc.web-edition.v1',version:'20261016-R3',story_id:STORY_ID,source:SOURCE,title:{SL:d.page_furniture.SL.title,EN:d.page_furniture.EN.title},credits:{SL:d.page_furniture.SL.credit,EN:d.page_furniture.EN.credit},page_count:8,panel_count:39,pair_count:0,pages:[],panels:[],network_required:true};
 for(const page of c.pages){const overview_assets={};for(const lang of ['SL','EN']){const a=page.overview_assets[lang],bytes=await read(a.file);assert(sha(bytes)===a.sha256,'OVERVIEW_HASH');const meta=await sharp(bytes).metadata();assert(meta.width===1024&&meta.height===1660,'OVERVIEW_DIMENSIONS');const web=await sharp(bytes).webp({quality:96,effort:6}).toBuffer();overview_assets[lang]=await save(`pages/${page.page_id}_${lang}.webp`,web,{width_px:meta.width,height_px:meta.height,source_sha256:a.sha256,derivation:'WebP quality 96; unchanged dimensions and full-page geometry'});}e.pages.push({page_id:page.page_id,reading_order:page.reading_order,panel_ids:page.panel_ids,overview_assets});console.log(JSON.stringify({phase:'overviews',page:page.page_id,at:new Date().toISOString()}));}
 for(const p of c.panels){const a=p.art_source;assert(rectValid(a.crop_rect_norm),'CROP');const art=await read(a.file);assert(sha(art)===a.sha256,'ART_SOURCE_HASH');const meta=await sharp(art).metadata();assert(meta.width===a.native_width_px&&meta.height===a.native_height_px,'ART_SOURCE_DIMENSIONS');const [x,y,w,h]=a.crop_rect_norm,left=Math.max(0,Math.floor(x*meta.width)),top=Math.max(0,Math.floor(y*meta.height)),width=Math.min(meta.width-left,Math.ceil((x+w)*meta.width)-left),height=Math.min(meta.height-top,Math.ceil((y+h)*meta.height)-top);const web=await sharp(art).extract({left,top,width,height}).webp({quality:96,effort:6}).toBuffer();const source_zoom=await save(`source/${p.panel_id}.webp`,web,{width_px:width,height_px:height,source_sha256:a.sha256,crop_rect_px:[left,top,width,height],crop_rect_norm:a.crop_rect_norm,derivation:'Authoritative unlettered panel crop; separately composed exact source dialogue; no upscale or new composition'});
  const state=storyState(p,records),story_state_sha256=sha(canonical(state));await save(`story-state/${p.panel_id}.json`,Buffer.from(canonical(state)));
  e.panels.push({...p,dialogue:state.dialogue,source_zoom,story_state_sha256,readiness:{overview_ready:true,source_zoom_ready:true,pair_ready:false}});
 }
 validateEdition(e);await save('edition.json',Buffer.from(JSON.stringify(e,null,2)+'\n'));await atomic(path.join(destination,'members.json'),JSON.stringify({schema:'bd.dfc.web-members.v1',story_id:STORY_ID,source:SOURCE,members},null,2)+'\n');
 console.log(JSON.stringify({phase:'complete',pages:8,panels:39,pairs:0,bytes:members.reduce((s,a)=>s+a.bytes,0),edition_sha256:sha(await readFile(path.join(destination,'edition.json'))),members_sha256:sha(await readFile(path.join(destination,'members.json')))}));return e;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){assert(process.argv[2]&&process.argv[3],'USAGE_H1_ROOT_RELEASE');await build(path.resolve(process.argv[2]),path.resolve(process.argv[3]));}
