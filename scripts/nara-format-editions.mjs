/** Immutable historical format editions. Separate from live publication/backfill.
 * R1: 5–11 October belong to Work; 12 October may be appended by its own owner.
 * No original records, scores, logs, version colours or day manifests are written.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadIllustrations,renderStoryScene,validateWebp} from './nara-illustrations.mjs';
import {DIALOGUE_EFFECTIVE_DATE} from './nara-dialogue.mjs';
import {responsiveEditionArtwork,RESPONSIVE_VERSION} from './nara-responsive-artwork.mjs';

export const FORMAT_VERSION='nara-format-editions-r1';
const BASE='https://bd-chess.github.io/bd-chessdb/Nara/';
const assert=(v,m)=>{if(!v)throw Error(m)};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const hex=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const text=(s,n)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;
const keys=(o,allowed)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).every(k=>allowed.includes(k));
const stringify=o=>JSON.stringify(o,null,2)+'\n';
const naraRoot=root=>path.join(root,'public/Nara');
export const editionBodyHash=d=>sha(JSON.stringify({title:d.title,deck:d.deck,shape:d.shape,scenes:d.scenes}));
const bi=(en,sl)=>'<span data-language-content="en" lang="en">'+esc(en)+'</span><span data-language-content="sl" lang="sl" hidden>'+esc(sl)+'</span>';
const keyRE=/^2026-10-(0[5-9]|1[0-2])(?:-S[123])?$/;
export function editionPaths(key){
 assert(keyRE.test(key),'unsafe format edition key');
 const date=key.slice(0,10),instance=key.length>10?key.slice(11):null;
 assert((date<'2026-10-09')===!instance,'format instance/date mismatch');
 const prefix='daily/format-editions/'+key+'/';
 return {date,instance,en:prefix+'en-R1.json',sl:prefix+'sl-R1.json',binding:prefix+'binding-R1.json',artwork:prefix+'art-R1.json',page:'Nara-AI-'+key+'-format-R1.html',original_page:'Nara-AI-'+key+'-pre-format-R1.html',source_en:'daily/records/'+date+(instance?'/'+instance:'')+'.json',source_sl:'daily/translations/sl/'+date+(instance?'/'+instance:'')+'.json',story_id:'NARA-D-'+date+(instance?':'+instance:'')};
}
function validateBody(d){
 assert(keys(d,['title','deck','shape','scenes','content_sha256'])&&Object.keys(d).length===5,'edition body fields');
 assert(text(d.title,220)&&text(d.deck,900)&&text(d.shape,1200),'edition body text');
 assert(Array.isArray(d.scenes)&&d.scenes.length>0&&d.scenes.length<=12,'edition scenes');
 for(const s of d.scenes){
  assert(keys(s,['title','paragraphs'])&&text(s.title,240)&&Array.isArray(s.paragraphs)&&s.paragraphs.length>0,'edition scene');
  assert(s.paragraphs.every(p=>text(p,16000)),'edition paragraph');
  assert(/^\*[^*\r\n]+ · [^*\r\n]+\*$/.test(s.paragraphs[0]),'edition subtitle required');
 }
 assert(hex(d.content_sha256)&&d.content_sha256===editionBodyHash(d),'edition content hash mismatch');
 return d;
}
export function pairedAssessment(a,enHash){
 if(a?.status==='PENDING'){
  assert(keys(a,['status'])&&Object.keys(a).length===1,'pending cannot contain inherited scores');return null;
 }
 assert(a?.status==='PAIRED'&&keys(a,['status','en_content_sha256','gpt','claude','combined']),'edition assessment fields');
 assert(a.en_content_sha256===enHash,'assessment content binding');
 const maxima={premise:15,character:15,structure:15,prose:15,world:10,moral_intellectual_depth:15,ending:15};
 assert(a.gpt?.rubric_id==='GPT_LITERARY_7_100_V1'&&a.gpt?.anchor_revision==='SHARED_ANCHOR_V1','GPT instrument');
 assert(keys(a.gpt.dimensions,Object.keys(maxima))&&Object.keys(a.gpt.dimensions).length===7,'GPT seven dimensions');
 assert(Object.entries(maxima).every(([k,max])=>Number.isInteger(a.gpt.dimensions[k])&&a.gpt.dimensions[k]>=0&&a.gpt.dimensions[k]<=max),'GPT dimension range');
 assert(Object.values(a.gpt.dimensions).reduce((x,y)=>x+y,0)===a.gpt.score,'GPT arithmetic');
 assert(a.claude?.rubric_id==='PEC-6_V2'&&hex(a.claude?.prompt_sha256),'Claude instrument');
 for(const model of ['gpt','claude']){
  const score=a[model];assert(Number.isInteger(score.score)&&score.score>=0&&score.score<=100&&hex(score.output_sha256)&&score.sealed===true,'unsealed/invalid edition score');
  assert(score.en_content_sha256===enHash,'model edition hash binding');
 }
 assert(a.combined===(a.gpt.score+a.claude.score)/2,'edition equal-weight mean');
 return a.combined;
}
export function loadFormatEditions(root){
 if(!root)return [];
 const n=naraRoot(root),file=path.join(n,'daily/format-editions/manifest.json');
 if(!fs.existsSync(file))return [];
 const m=JSON.parse(fs.readFileSync(file,'utf8'));
 assert(m?.schema==='nara.format.editions.manifest.v1'&&keys(m,['schema','format_revision','authorized_dates','entries'])&&m.format_revision==='R1','format manifest schema');
 assert(Array.isArray(m.authorized_dates)&&new Set(m.authorized_dates).size===m.authorized_dates.length&&m.authorized_dates.every(d=>/^2026-10-(0[5-9]|1[0-2])$/.test(d)),'format date allowlist');
 assert(Array.isArray(m.entries)&&m.entries.length<=16,'format manifest entries');
 const seen=new Set();
 return m.entries.map(e=>{
  assert(keys(e,['key','en_file_sha256','sl_file_sha256','binding_file_sha256','original_page_sha256']),'format entry fields');
  const p=editionPaths(e.key);assert(m.authorized_dates.includes(p.date)&&!seen.has(e.key),'edition outside allowlist/duplicate');seen.add(e.key);
  const read=(rel,digest)=>{const b=fs.readFileSync(path.join(n,rel));assert(hex(digest)&&sha(b)===digest,'edition file binding '+rel);return JSON.parse(b)};
  const en=validateBody(read(p.en,e.en_file_sha256)),sl=validateBody(read(p.sl,e.sl_file_sha256)),b=read(p.binding,e.binding_file_sha256);
  assert(b?.schema==='nara.format.edition.binding.v1'&&keys(b,['schema','edition_id','original_story_id','date','format_revision','source','en_content_sha256','sl_content_sha256','anchors','assessment']),'edition binding fields');
  assert(b.original_story_id===p.story_id&&b.date===p.date&&b.format_revision==='R1','edition identity');
  assert(b.en_content_sha256===en.content_sha256&&b.sl_content_sha256===sl.content_sha256,'edition language binding');
  assert(b.edition_id===p.story_id+'@'+b.source?.en_content_sha256+':FORMAT-R1:'+en.content_sha256,'stable edition identity');
  assert(keys(b.source,['en_file','sl_file','en_file_sha256','sl_file_sha256','en_content_sha256','sl_content_sha256']),'original source fields');
  assert(b.source.en_file===p.source_en&&b.source.sl_file===p.source_sl,'original source paths');
  const originalEn=read(p.source_en,b.source.en_file_sha256),originalSl=read(p.source_sl,b.source.sl_file_sha256);
  assert(editionBodyHash(originalEn)===b.source.en_content_sha256&&editionBodyHash(originalSl)===b.source.sl_content_sha256,'original content hash binding');
  assert(originalEn.id===p.story_id&&(originalSl.story_id??originalSl.id)===p.story_id,'original story binding');
  assert(en.scenes.length===sl.scenes.length&&en.scenes.length===originalEn.scenes.length,'edition language scene count');
  assert(keys(b.anchors,['en','sl']),'edition anchor languages');
  for(const lang of ['en','sl']){
   const current=lang==='en'?en:sl,original=lang==='en'?originalEn:originalSl,scenes=b.anchors[lang];
   assert(Array.isArray(scenes)&&scenes.length===current.scenes.length,'anchor scene count');
   scenes.forEach((mapping,i)=>{
    assert(current.scenes[i].paragraphs.length===(lang==='en'?sl:en).scenes[i].paragraphs.length,'EN/SL paragraph parity');
    assert(Array.isArray(mapping)&&mapping.length===original.scenes[i].paragraphs.length,'anchor source count');
    let next=2;
    mapping.forEach((a,j)=>{
     assert(keys(a,['source_paragraph','new_paragraphs','after_anchor'])&&a.source_paragraph===j+1&&Array.isArray(a.new_paragraphs)&&a.new_paragraphs.length>0,'anchor entry');
     assert(a.new_paragraphs.every((v,k)=>v===next+k)&&a.after_anchor===a.new_paragraphs.at(-1),'anchor continuity');next=a.after_anchor+1;
    });
    assert(next===current.scenes[i].paragraphs.length+1,'complete paragraph mapping');
   });
  }
  const combined=pairedAssessment(b.assessment,en.content_sha256);
  const snapshot=path.join(n,p.original_page);assert(fs.existsSync(snapshot)&&hex(e.original_page_sha256)&&sha(fs.readFileSync(snapshot))===e.original_page_sha256,'immutable original page');
  return {entry:e,paths:p,binding:b,en,sl,originalEn,originalSl,combined};
 });
}
export function formatDayLinks(root,date,storyId=null){
 const items=loadFormatEditions(root).filter(x=>x.paths.date===date&&(!storyId||x.paths.story_id===storyId));
 if(!items.length)return '';
 return '<nav class="format-edition-links" aria-label="Format editions"><strong>'+bi('Dialogue format editions','Izdaje v dialognem formatu')+'</strong><ul>'+items.map(x=>'<li>'+esc(x.paths.instance??'')+(x.paths.instance?' · ':'')+'<a href="'+esc(x.paths.page)+'">'+bi('Read format R1','Preberi format R1')+'</a> · <a href="'+esc(x.paths.original_page)+'">'+bi('Original publication','Izvirna objava')+'</a> · <span class="format-assessment">'+(x.combined===null?'PENDING':esc(x.combined+' / 100'))+'</span></li>').join('')+'</ul></nav>';
}
export function renderFormatArchive(root){
 const items=loadFormatEditions(root).sort((a,b)=>b.paths.date.localeCompare(a.paths.date)||a.entry.key.localeCompare(b.entry.key));
 if(!items.length)return '';
 return '<section class="notice format-edition-archive" id="format-editions"><h2>Dialogue format editions · Izdaje v dialognem formatu</h2><p>Preserved plots and narration, with scene subtitles and named dialogue. Each edition receives a new independent assessment; PENDING means the paired assessment is incomplete.</p><ul>'+items.map(x=>'<li><time datetime="'+x.paths.date+'">'+x.paths.date+'</time> · '+esc(x.paths.instance??'')+' <a href="'+x.paths.page+'"><strong>'+esc(x.en.title)+'</strong></a> · <a href="'+x.paths.original_page+'">original / izvirnik</a> · <span class="format-assessment">'+(x.combined===null?'PENDING':esc(x.combined+' / 100'))+'</span></li>').join('')+'</ul></section>';
}
export function refreshFormatArchiveSection(html,root){
 const fragment=renderFormatArchive(root),pattern=/<section class="notice format-edition-archive" id="format-editions">[\s\S]*?<\/section>/;
 if(pattern.test(html))return html.replace(pattern,fragment);
 return fragment?html.replace('</main>',fragment+'</main>'):html;
}
function directEditionArtworkImages(root,item,manifest){
 const manifestFields=['schema','edition_id','story_id','date','format_revision','en_content_sha256','sl_content_sha256','images'];
 assert(keys(manifest,manifestFields)&&Object.keys(manifest).length===manifestFields.length,'direct edition artwork manifest fields');
 assert(['nara.format.edition.artwork.v2','nara.format.edition.artwork.v3'].includes(manifest.schema)&&manifest.edition_id===item.binding.edition_id&&manifest.story_id===item.paths.story_id&&manifest.date===item.paths.date&&manifest.format_revision==='R1','direct edition artwork identity binding');
 assert(manifest.en_content_sha256===item.en.content_sha256&&manifest.sl_content_sha256===item.sl.content_sha256,'direct edition artwork language binding');
 const legacyProvenance=manifest.schema==='nara.format.edition.artwork.v2';
 const imageFields=['scene','after_paragraph_en','after_paragraph_sl','paragraph_sha256_en','paragraph_sha256_sl','src','width','height','sha256','alt_en','alt_sl',...(legacyProvenance?['generation_prompt_sha256','model_reported','claude_review']:[])];
 assert(Array.isArray(manifest.images)&&manifest.images.length===3,'direct edition artwork requires three images');
 let priorScene=0,priorParagraph=0;
 return manifest.images.map(entry=>{
  assert(keys(entry,imageFields)&&Object.keys(entry).length===imageFields.length,'direct edition artwork image fields');
  assert(Number.isInteger(entry.scene)&&entry.scene>=1&&entry.scene<=item.en.scenes.length,'direct edition artwork scene');
  assert(Number.isInteger(entry.after_paragraph_en)&&entry.after_paragraph_en>=1&&entry.after_paragraph_en<=item.en.scenes[entry.scene-1].paragraphs.length&&Number.isInteger(entry.after_paragraph_sl)&&entry.after_paragraph_sl>=1&&entry.after_paragraph_sl<=item.sl.scenes[entry.scene-1].paragraphs.length,'direct edition artwork paragraph anchor');
  assert(entry.scene>priorScene||(entry.scene===priorScene&&entry.after_paragraph_en>priorParagraph),'direct edition artwork order');
  assert(entry.after_paragraph_en===entry.after_paragraph_sl,'direct edition artwork bilingual anchor');
  priorScene=entry.scene;priorParagraph=entry.after_paragraph_en;
  assert(hex(entry.paragraph_sha256_en)&&hex(entry.paragraph_sha256_sl)&&text(entry.alt_en,300)&&text(entry.alt_sl,300),'direct edition artwork metadata');
  if(legacyProvenance)assert(hex(entry.generation_prompt_sha256)&&text(entry.model_reported,120)&&['PASS','MISSING','FIX_LIMIT_REACHED'].includes(entry.claude_review),'direct edition artwork legacy provenance');
  const enParagraph=item.en.scenes[entry.scene-1].paragraphs[entry.after_paragraph_en-1],slParagraph=item.sl.scenes[entry.scene-1].paragraphs[entry.after_paragraph_sl-1];
  assert(sha(enParagraph)===entry.paragraph_sha256_en&&sha(slParagraph)===entry.paragraph_sha256_sl,'direct edition artwork paragraph binding');
  const prefix='assets/img/daily/'+item.paths.date+'/R1/';
  assert(typeof entry.src==='string'&&entry.src.startsWith(prefix)&&/^[A-Za-z0-9_.-]+\.webp$/.test(entry.src.slice(prefix.length)),'unsafe direct edition artwork source');
  assert(entry.width===1672&&entry.height===941&&hex(entry.sha256),'direct edition artwork asset metadata');
  const asset=path.join(naraRoot(root),entry.src);assert(fs.existsSync(asset)&&fs.statSync(asset).isFile(),'direct edition artwork asset missing');
  const bytes=fs.readFileSync(asset);assert(sha(bytes)===entry.sha256,'direct edition artwork asset hash mismatch');validateWebp(bytes,entry.width,entry.height);
  return {...entry,after_paragraph:entry.after_paragraph_en};
 });
}
function editionArtworkImages(root,item){
 const file=path.join(naraRoot(root),item.paths.artwork);
 assert(fs.existsSync(file),'edition artwork manifest missing');
 const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
 if(manifest?.schema==='nara.format.edition.artwork.v4')return responsiveEditionArtwork(root,item,manifest,validateWebp,manifest.images?.some(image=>Object.hasOwn(image,'source_after_paragraph'))?loadIllustrations(root,item.originalEn,item.originalSl):[]);
 if(['nara.format.edition.artwork.v2','nara.format.edition.artwork.v3'].includes(manifest?.schema))return directEditionArtworkImages(root,item,manifest);
 const manifestFields=['schema','edition_id','story_id','date','format_revision','en_content_sha256','sl_content_sha256','images'];
 assert(keys(manifest,manifestFields)&&Object.keys(manifest).length===manifestFields.length,'edition artwork manifest fields');
 assert(manifest.schema==='nara.format.edition.artwork.v1'&&manifest.edition_id===item.binding.edition_id&&manifest.story_id===item.paths.story_id&&manifest.date===item.paths.date&&manifest.format_revision==='R1','edition artwork identity binding');
 assert(manifest.en_content_sha256===item.en.content_sha256&&manifest.sl_content_sha256===item.sl.content_sha256,'edition artwork language binding');
 const sourceImages=loadIllustrations(root,item.originalEn,item.originalSl);
 assert(Array.isArray(manifest.images)&&manifest.images.length===3&&sourceImages.length===3,'edition artwork requires three validated images');
 const imageFields=['scene','source_after_paragraph','after_paragraph_en','after_paragraph_sl','paragraph_sha256_en','paragraph_sha256_sl','src','width','height','sha256','src_4k','width_4k','height_4k','sha256_4k','alt_en','alt_sl'];
 let priorScene=0,priorSourceParagraph=0;
 return manifest.images.map(entry=>{
  assert(keys(entry,imageFields)&&Object.keys(entry).length===imageFields.length,'edition artwork image fields');
  assert(Number.isInteger(entry.scene)&&entry.scene>=1&&entry.scene<=item.en.scenes.length&&Number.isInteger(entry.source_after_paragraph)&&entry.source_after_paragraph>=1&&entry.source_after_paragraph<=item.originalEn.scenes[entry.scene-1].paragraphs.length,'edition artwork source anchor');
  assert(Number.isInteger(entry.after_paragraph_en)&&entry.after_paragraph_en>=1&&entry.after_paragraph_en<=item.en.scenes[entry.scene-1].paragraphs.length&&Number.isInteger(entry.after_paragraph_sl)&&entry.after_paragraph_sl>=1&&entry.after_paragraph_sl<=item.sl.scenes[entry.scene-1].paragraphs.length,'edition artwork language anchors');
  assert(entry.scene>priorScene||(entry.scene===priorScene&&entry.source_after_paragraph>priorSourceParagraph),'edition artwork order');
  priorScene=entry.scene;priorSourceParagraph=entry.source_after_paragraph;
  assert(hex(entry.paragraph_sha256_en)&&hex(entry.paragraph_sha256_sl)&&text(entry.alt_en,300)&&text(entry.alt_sl,300),'edition artwork paragraph hashes/alt text');
  const original=sourceImages.find(image=>image.scene===entry.scene&&image.after_paragraph===entry.source_after_paragraph);
  assert(original,'edition artwork source image mapping');
  for(const field of ['src','width','height','sha256','src_4k','width_4k','height_4k','sha256_4k','alt_en','alt_sl'])assert(entry[field]===original[field],'edition artwork asset binding '+field);
  const en=item.binding.anchors.en[entry.scene-1][entry.source_after_paragraph-1],sl=item.binding.anchors.sl[entry.scene-1][entry.source_after_paragraph-1];
  assert(en&&sl&&entry.after_paragraph_en===en.after_anchor&&entry.after_paragraph_sl===sl.after_anchor&&en.after_anchor===sl.after_anchor,'edition artwork bilingual anchor binding');
  const enParagraph=item.en.scenes[entry.scene-1].paragraphs[entry.after_paragraph_en-1],slParagraph=item.sl.scenes[entry.scene-1].paragraphs[entry.after_paragraph_sl-1];
  assert(sha(enParagraph)===entry.paragraph_sha256_en&&sha(slParagraph)===entry.paragraph_sha256_sl,'edition artwork paragraph binding');
  return {...original,after_paragraph:entry.after_paragraph_en};
 });
}
function optionalEditionImages(root,item){
 const file=path.join(naraRoot(root),item.paths.artwork);
 if(item.paths.date==='2026-10-05'||fs.existsSync(file))return editionArtworkImages(root,item);
 try{
  const images=loadIllustrations(root,item.originalEn,item.originalSl,{nonBlocking:true});
  return images.map(image=>{
   const old=image.after_paragraph??item.originalEn.scenes[image.scene-1].paragraphs.length;
   const en=item.binding.anchors.en[image.scene-1][old-1],sl=item.binding.anchors.sl[image.scene-1][old-1];
   assert(en&&sl&&en.after_anchor===sl.after_anchor,'image bilingual anchor mapping');
   return {...image,after_paragraph:en.after_anchor};
  });
 }catch{return []} // Legacy artwork never blocks its text edition.
}
function formatShell(title,slTitle,file,body,responsive=false){
 const controls='<div class="tools"><button type="button" data-scale="-0.1">A−</button><output data-scale-label>100%</output><button type="button" data-scale="0.1">A+</button><button type="button" data-scale="reset">'+bi('Reset','Ponastavi')+'</button><button type="button" data-theme-toggle>'+bi('Day mode','Dnevni način')+'</button></div>';
 const artworkAssets=responsive?'<link rel="stylesheet" href="assets/css/nara-daily-responsive.css?v='+RESPONSIVE_VERSION+'">':'';
 const selector=responsive?'':'<script defer src="assets/js/nara-daily-resolution.js?v=1"></script>';
 const viewer=responsive?'<script defer src="assets/js/nara-daily-responsive.js?v='+RESPONSIVE_VERSION+'"></script>':'<script defer src="assets/js/nara-daily-lightbox.js?v=2"></script>';
 return '<!doctype html>\n<html lang="en" data-theme="dark" data-title-en="'+esc(title+' — Illuminara Daily')+'" data-title-sl="'+esc(slTitle+' — Illuminara Daily')+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="dark light"><title>'+esc(title)+' — Illuminara Daily</title><link rel="canonical" href="'+BASE+file+'"><link rel="stylesheet" href="assets/css/nara-daily.css?v='+FORMAT_VERSION+'">'+artworkAssets+selector+'<script defer src="assets/js/nara-daily-reader.js?v='+FORMAT_VERSION+'"></script>'+viewer+'</head><body><a class="skip" href="#main">'+bi('Skip to content','Preskoči na vsebino')+'</a><header class="bar"><div class="bar-inner"><a class="brand" href="Nara-AI-daily.html">ILLUMINARA / DAILY</a><nav class="nav"><a href="Nara-AI-daily.html">Daily</a><a href="Nara-AI-archive.html#format-editions">'+bi('Archive','Arhiv')+'</a></nav><div class="language-switch" data-language-switch role="group" aria-label="Language / Jezik" hidden><button type="button" data-language="en" lang="en" aria-pressed="true">EN</button><span aria-hidden="true">|</span><button type="button" data-language="sl" lang="sl" aria-pressed="false">SL</button></div></div></header><main class="wrap" id="main" tabindex="-1">'+controls+body+'</main><footer class="footer wrap"><p>'+bi('Original world: Bojan Dobrečevič. Prose: the GPT × Claude Daily creative line. A format edition does not confer canon status.','Izvirni svet: Bojan Dobrečevič. Proza: ustvarjalno sodelovanje GPT × Claude v dnevni zbirki. Formatna izdaja ne pomeni kanoničnega statusa.')+'</p></footer></body></html>\n';
}
export function renderEditionPage(root,item){
 const images=optionalEditionImages(root,item);
 const reading=(d,lang)=>'<div data-language-content="'+lang+'" lang="'+lang+'"'+(lang==='sl'?' hidden':'')+'><p class="lede">'+esc(d.deck)+'</p><article class="story" data-content-sha256="'+d.content_sha256+'">'+d.scenes.map((s,i)=>renderStoryScene(s,i+1,images,lang,2,DIALOGUE_EFFECTIVE_DATE)).join('\n')+'</article></div>';
 // Explicit format-edition presentation uses R10; the original story date and
 // original publication timestamp stay intact and are never forged as today.
 const header='<header class="masthead"><div class="eyebrow">'+bi('Dialogue format edition · R1','Izdaja v dialognem formatu · R1')+'</div><h1>'+bi(item.en.title,item.sl.title)+'</h1><p class="meta">'+item.paths.date+(item.paths.instance?' · '+item.paths.instance:'')+' · <a href="'+item.paths.original_page+'">'+bi('Read the preserved original publication','Preberi ohranjeno izvirno objavo')+'</a></p><p class="format-assessment">'+bi('New paired literary assessment:','Nova skupna književna ocena:')+' '+(item.combined===null?'PENDING':esc(item.combined+' / 100'))+'</p><p class="muted">'+bi('The original scores remain in the editorial log. Assessment applies to the English edition.','Izvirne ocene ostajajo v uredniškem dnevniku. Ocenjena je angleška izdaja.')+'</p></header>';
 return formatShell(item.en.title,item.sl.title,item.paths.page,header+reading(item.en,'en')+reading(item.sl,'sl'),images.some(image=>image.responsive));
}
export function renderOriginalSnapshot(root,{paths:p,en,sl}){
 const images=(()=>{try{return loadIllustrations(root,en,sl,{nonBlocking:true})}catch{return []}})();
 const reading=(d,lang)=>'<div data-language-content="'+lang+'" lang="'+lang+'"'+(lang==='sl'?' hidden':'')+'><p class="lede">'+esc(d.deck)+'</p><article class="story" data-content-sha256="'+d.content_sha256+'">'+d.scenes.map((s,i)=>renderStoryScene(s,i+1,images,lang,2,p.date)).join('\n')+'</article></div>';
 const score=en.literary_score?.combined;
 return formatShell('Original — '+en.title,'Izvirnik — '+sl.title,p.original_page,'<header class="masthead"><div class="eyebrow">'+bi('Preserved publication before format R1','Ohranjena objava pred formatom R1')+'</div><h1>'+bi(en.title,sl.title)+'</h1><p>'+p.date+(p.instance?' · '+p.instance:'')+' · '+esc(en.published_at)+'</p><p>'+bi('Original combined score:','Izvirna skupna ocena:')+' '+(Number.isFinite(score)?esc(score+' / 100'):'PENDING')+'</p><p><a href="'+p.page+'">'+bi('Read dialogue format R1','Preberi dialogni format R1')+'</a> · <a href="Nara-AI-log.html#NARA-D-'+p.date+'-LOG">'+bi('Original editorial log','Izvirni uredniški dnevnik')+'</a></p></header>'+reading(en,'en')+reading(sl,'sl'));
}
function writeChanged(file,s){
 fs.mkdirSync(path.dirname(file),{recursive:true});if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')===s)return false;
 const tmp=file+'.tmp';fs.writeFileSync(tmp,s);fs.renameSync(tmp,file);return true;
}
export function generateFormatEditions(root){
 const items=loadFormatEditions(root),changed=[];
 for(const item of items)if(writeChanged(path.join(naraRoot(root),item.paths.page),renderEditionPage(root,item)))changed.push(item.paths.page);
 return {status:'FORMAT_EDITIONS_GENERATED',edition_count:items.length,changed};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 try{assert(process.argv[2]==='generate','use generate <root>');console.log(JSON.stringify(generateFormatEditions(path.resolve(process.argv[3]??'.'))))}catch(e){console.error(e.message);process.exitCode=1}
}
