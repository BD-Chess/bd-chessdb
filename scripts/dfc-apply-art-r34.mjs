// One explicit, owner-requested anatomy revision. Keep every previous art file
// and every dialogue/state/lettering byte; publish new immutable asset paths.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {validateEdition} from '../public/Nara/dualframe-lab/dfc-model.mjs';
const sharp=createRequire(new URL('../functions/package.json',import.meta.url))('sharp');
const root=fileURLToPath(new URL('../public/Nara/dualframe-lab/content/illuminara/',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=b=>Buffer.from(JSON.stringify(b,null,2)+'\n');
const read=f=>fs.readFile(path.join(root,f));
const e=JSON.parse(await read('edition.json')),members=JSON.parse(await read('members.json'));
if(e.art_revision)throw Error('R34_ALREADY_APPLIED');
const records=JSON.parse(await fs.readFile(process.argv[2],'utf8')).records;
const picked=records.filter(r=>r.accepted),saved=[];
const id='ILLUMINARA_ANATOMY_R34',prefix='art-r34';
const reasons={
 'P01-K05':'Reversed left-hand chirality; portrait cross-body arm attachment.',
 'P02-K02':'Overlong crossing arm; natural left shoulder/elbow/wrist continuity.',
 'P04-K02':'Blade-like guiding fingers and ambiguous downward light-hand digits.',
 'P04-K05':'Overlong spidery fingers blending into light filaments.',
 'P06-K03':'Flattened/merged foreshortened fingers; five distinct coherent digits.',
 'P07-K01':'Rubbery foreground palm/fingers; natural five-digit foreshortening.'
};
async function save(file,b,extra={}){await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});await fs.writeFile(path.join(root,file),b);const a={file,bytes:b.length,sha256:sha(b),...extra};saved.push(a);return a;}
const revision={schema:'bd.dfc.art-revision.v1',revision_id:id,owner_request:'Inspect all Illuminara hands; correct anatomy and publish on GitHub Pages only. Do not deploy Netlify.',source:e.source,baseline_edition_sha256:sha(await read('edition.json')),scope:Object.keys(reasons),audit:e.panels.map(p=>({panel_id:p.panel_id,reviewed:['source','P','L'],result:reasons[p.panel_id]?'CORRECTED':'RETAINED',note:reasons[p.panel_id]||'No actionable Illuminara hand defect visible; perspective/occlusion retained.'})),assets:[],pages:[],generation_attempts:records.map(r=>({key:r.key,accepted:r.accepted,prompt:r.prompt,native_filename:path.basename(r.output_path),visual_review:r.review})),limitations:['Visual anatomy review is editorial, not a measurable guarantee of anatomical perfection.','No physical-device test is implied by responsive browser checks.']};
const pagePatches=new Map();
for(const p of e.panels.filter(p=>reasons[p.panel_id])){
 for(const o of ['P','L']){
  const record=picked.find(r=>r.key.startsWith(p.panel_id+'_'+o));if(!record)throw Error('MISSING_VARIANT '+p.panel_id+o);
  const before=structuredClone(p[o]),b=await fs.readFile(record.output_path),meta=await sharp(b).metadata();
  if(meta.width!==before.width_px||meta.height!==before.height_px)throw Error('NATIVE_GEOMETRY '+record.key);
  const provenanceFile=`${prefix}/provenance/${p.panel_id}/${o}.json`;
  const after=await save(`${prefix}/art/${p.panel_id}/${o}.png`,b,{...before,file:`${prefix}/art/${p.panel_id}/${o}.png`,bytes:b.length,sha256:sha(b),delivery_part_id:`R34_${p.panel_id}_${o}`,provenance:provenanceFile,native_generation:{is_native:true,tool:'image_gen.imagegen',model:'UNKNOWN_NOT_EXPOSED',native_width_px:meta.width,native_height_px:meta.height,transforms:[]},art_revision:id});
  const original=JSON.parse(await read('paired/'+before.provenance));
  const provenance={...original,prompt:record.prompt,prompt_file:null,reference_files:[before.file],generation_tool:'built-in image_gen.imagegen (reference-image edit)',native_output:{sha256:after.sha256,width_px:meta.width,height_px:meta.height,format:'PNG'},derivative_transformations:[],visual_review:{verdict:'ACCEPT_WITH_NOTED_CONSTRAINTS',anatomy:record.review,identity:'Original character and scene retained by reference edit.',action:p.story_beat,limitations:['Localized anatomy revision; no new story or lettering.']},correction_lineage:[...(original.correction_lineage||[]),{revision_id:id,original_asset:before,reason:reasons[p.panel_id],generation_output:path.basename(record.output_path)}],registered_at:new Date().toISOString(),art_revision:id};
  await save(provenanceFile,json(provenance));p[o]=after;
  revision.assets.push({panel_id:p.panel_id,role:o,before,after,provenance:provenanceFile,reason:reasons[p.panel_id]});
 }
 const record=picked.find(r=>r.key.startsWith(p.panel_id+'_S'));if(!record)throw Error('MISSING_SOURCE '+p.panel_id);
 const before=structuredClone(p.source_zoom),native=await fs.readFile(record.output_path),meta=await sharp(native).metadata();
 // Remove only generator-added white letterboxing from the ultra-wide panel.
 let master=native,trim=null;if(p.panel_id==='P07-K01'){const t=await sharp(native).trim({background:'#ffffff',threshold:10}).png().toBuffer({resolveWithObject:true});master=t.data;trim={left:-t.info.trimOffsetLeft,top:-t.info.trimOffsetTop,width:t.info.width,height:t.info.height};}
 const [x,y,w,h]=before.crop_rect_px,poly=p.hotspots.SL.polygon_norm;
 const left=Math.max(x,Math.round(Math.min(...poly.map(a=>a[0]))*1024)+1),top=Math.max(y+88,Math.round(Math.min(...poly.map(a=>a[1]))*1660)+1);
 const right=Math.min(x+w,Math.round(Math.max(...poly.map(a=>a[0]))*1024)-1),bottom=Math.min(y+88+h,Math.round(Math.max(...poly.map(a=>a[1]))*1660)-1);
 const local={left:left-x,top:top-y-88,width:right-left,height:bottom-top};
 const resized=await sharp(master).resize(w,h,{fit:'fill'}).png().toBuffer();
 const patch=await sharp(resized).extract(local).png().toBuffer();
 const corrected=await sharp(await read(before.file)).composite([{input:patch,left:local.left,top:local.top}]).webp({quality:96,effort:6}).toBuffer();
 const after=await save(`${prefix}/source/${p.panel_id}.webp`,corrected,{...before,file:`${prefix}/source/${p.panel_id}.webp`,bytes:corrected.length,sha256:sha(corrected),derivation:'Owner-requested anatomy edit; resized native edit into unchanged source-crop geometry; original source retained.',art_revision:id});
 const provenance={schema:'bd.dfc.source-art-revision.v1',revision_id:id,panel_id:p.panel_id,original_asset:before,native_output:{sha256:sha(native),width_px:meta.width,height_px:meta.height,filename:path.basename(record.output_path)},generation_tool:'image_gen.imagegen',prompt:record.prompt,transforms:{white_letterbox_trim:trim,resize_to:[w,h],patch_rect_in_source:local,webp_quality:96},visual_review:record.review};
 const provenanceFile=`${prefix}/provenance/${p.panel_id}/source.json`;await save(provenanceFile,json(provenance));
 p.source_zoom=after;revision.assets.push({panel_id:p.panel_id,role:'source',before,after,provenance:provenanceFile,reason:reasons[p.panel_id]});
 const list=pagePatches.get(p.page_id)||[];list.push({input:patch,left,top,panel_id:p.panel_id,rect:[left,top,right-left,bottom-top]});pagePatches.set(p.page_id,list);
}
const layers=JSON.parse(await read('text-r1/layers.json'));
layers.version='20261020-ART-R34';layers.art_revision=id;layers.renderer+='; R34 panel-local anatomy revisions, identical lettering and page geometry';
for(const page of e.pages.filter(p=>pagePatches.has(p.page_id)))for(const lang of ['SL','EN']){
 const patches=pagePatches.get(page.page_id),beforeClean=structuredClone(page.text_layers.clean_assets[lang]),beforeOverview=structuredClone(page.overview_assets[lang]);
 const clean=await sharp(await read(beforeClean.file)).composite(patches.map(({input,left,top})=>({input,left,top}))).webp({quality:96,effort:6}).toBuffer();
 const a=await save(`${prefix}/pages/${page.page_id}_${lang}.clean.webp`,clean,{...beforeClean,file:`${prefix}/pages/${page.page_id}_${lang}.clean.webp`,bytes:clean.length,sha256:sha(clean),art_revision:id});
 const overlays=await Promise.all(Object.values(page.text_layers.panel_overlays[lang]).map(async a=>({input:await read(a.file),left:0,top:0})));
 const full=await sharp(clean).composite(overlays).webp({quality:96,effort:6}).toBuffer();
 const b=await save(`${prefix}/pages/${page.page_id}_${lang}.webp`,full,{...beforeOverview,file:`${prefix}/pages/${page.page_id}_${lang}.webp`,bytes:full.length,sha256:sha(full),derivation:'Panel-local anatomy revision composed with unchanged independent original lettering.',art_revision:id});
 page.text_layers.clean_assets[lang]=a;page.overview_assets[lang]=b;
 revision.pages.push({page_id:page.page_id,language:lang,patches:patches.map(({panel_id,rect})=>({panel_id,rect})),before_clean:beforeClean,after_clean:a,before_overview:beforeOverview,after_overview:b});
 const row=layers.pages.find(r=>r.page_id===page.page_id&&r.language===lang);row.previous_clean_sha256=row.clean_sha256;row.clean_sha256=a.sha256;row.derived_composite_sha256=b.sha256;row.art_revision=id;
}
const layerAsset=await save(`${prefix}/layers.json`,json(layers));
revision.text_layers=layerAsset;
const rev=await save(`${prefix}/revision.json`,json(revision));
e.version='20261020-ART-R34';e.art_revision=rev;validateEdition(e);
await save('edition.json',json(e));
const replacements=new Map(saved.map(a=>[a.file,a]));members.members=members.members.map(a=>replacements.get(a.file)||a);
const prior=new Set(members.members.map(a=>a.file));members.members.push(...saved.filter(a=>!prior.has(a.file)));
await fs.writeFile(path.join(root,'members.json'),json(members));
console.log(JSON.stringify({revision:id,panels:revision.scope.length,artworks:revision.assets.length,patched_pages:pagePatches.size,new_members:saved.length,edition_sha256:sha(await read('edition.json')),members_sha256:sha(await read('members.json')),layerAsset,revisionAsset:rev},null,2));
