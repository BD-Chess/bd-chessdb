/** Opt-in four-variant artwork. Public metadata contains only source bindings and delivery facts. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const assert=(value,message)=>{if(!value)throw Error(message)};
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const exact=(value,fields)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===fields.length&&fields.every(key=>Object.hasOwn(value,key));
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const RESPONSIVE_VERSION='nara-responsive-20261014-r1';
const slots=['L_HD','P_HD','L_4K','P_4K'];

export function responsiveEditionArtwork(root,item,manifest,validateWebp,sourceImages=[],validateApprovedHd=null){
 const preservedHd=Object.hasOwn(manifest,'landscape_hd_source');
 const fields=['schema','edition_id','story_id','date','format_revision','en_content_sha256','sl_content_sha256','images',...(preservedHd?['landscape_hd_source']:[])];
 assert(exact(manifest,fields)&&manifest.schema==='nara.format.edition.artwork.v4','responsive edition artwork manifest fields');
 assert(manifest.edition_id===item.binding.edition_id&&manifest.story_id===item.paths.story_id&&manifest.date===item.paths.date&&manifest.format_revision==='R1','edition artwork identity binding');
 assert(manifest.en_content_sha256===item.en.content_sha256&&manifest.sl_content_sha256===item.sl.content_sha256,'edition artwork language binding');
 assert(Array.isArray(manifest.images)&&manifest.images.length===3,'responsive edition artwork requires three moments');
 const prefix='assets/img/daily/'+item.paths.date+'/',leaf=prefix+(item.paths.instance?item.paths.instance+'/':'')+'R1-responsive/';
 const n=path.join(root,'public/Nara');let priorScene=0,priorParagraph=0;const seen=new Set();let approvedHd=[];
 if(preservedHd){
  const ref=manifest.landscape_hd_source,expected=item.paths.artwork.replace(/art-R1\.json$/,'art-approved-L-HD-R1.json');
  assert(exact(ref,['src','sha256'])&&ref.src===expected&&hex(ref.sha256),'unsafe approved landscape HD source');
  const file=path.join(n,ref.src);assert(fs.existsSync(file)&&fs.statSync(file).isFile(),'approved landscape HD source missing');
  assert(fs.realpathSync(file).startsWith(fs.realpathSync(path.join(n,'daily/format-editions'))+path.sep),'unsafe approved landscape HD source location');
  const bytes=fs.readFileSync(file);assert(sha(bytes)===ref.sha256,'approved landscape HD source hash mismatch');
  const original=JSON.parse(bytes);assert(original.schema==='nara.format.edition.artwork.v3'&&typeof validateApprovedHd==='function','approved landscape HD source validator required');
  approvedHd=validateApprovedHd(original);assert(approvedHd.length===3,'approved landscape HD source moments');
 }
 return manifest.images.map((entry,index)=>{
  const inherited=Object.hasOwn(entry,'source_after_paragraph');
  const imageFields=['scene','after_paragraph_en','after_paragraph_sl','paragraph_sha256_en','paragraph_sha256_sl','src','width','height','sha256','src_4k','width_4k','height_4k','sha256_4k','alt_en','alt_sl','moment_id','variants',...(inherited?['source_after_paragraph']:[])];
  assert(exact(entry,imageFields),'responsive edition artwork image fields');
  assert(/^moment-0[1-3]$/.test(entry.moment_id)&&!seen.has(entry.moment_id),'responsive moment identity');seen.add(entry.moment_id);
  assert(Number.isInteger(entry.scene)&&entry.scene>=1&&entry.scene<=item.en.scenes.length,'responsive artwork scene');
  assert(entry.scene>priorScene||(entry.scene===priorScene&&entry.after_paragraph_en>priorParagraph),'responsive artwork order');
  assert(Number.isInteger(entry.after_paragraph_en)&&entry.after_paragraph_en>=1&&entry.after_paragraph_en===entry.after_paragraph_sl,'edition artwork bilingual anchor binding');
  priorScene=entry.scene;priorParagraph=entry.after_paragraph_en;
  const en=item.en.scenes[entry.scene-1].paragraphs[entry.after_paragraph_en-1],sl=item.sl.scenes[entry.scene-1].paragraphs[entry.after_paragraph_sl-1];
  assert(typeof en==='string'&&typeof sl==='string'&&sha(en)===entry.paragraph_sha256_en&&sha(sl)===entry.paragraph_sha256_sl,'edition artwork paragraph binding');
  assert(text(entry.alt_en,300)&&text(entry.alt_sl,300),'responsive artwork bilingual alt text');
  if(inherited){
   assert(!preservedHd,'conflicting responsive landscape sources');
   assert(Number.isInteger(entry.source_after_paragraph),'responsive inherited source anchor');
   const original=sourceImages.find(image=>image.scene===entry.scene&&image.after_paragraph===entry.source_after_paragraph);
   assert(original,'responsive inherited source image');
   for(const field of ['src','width','height','sha256','src_4k','width_4k','height_4k','sha256_4k','alt_en','alt_sl'])assert(entry[field]===original[field],'edition artwork asset binding '+field);
   for(const lang of ['en','sl'])assert(item.binding.anchors[lang][entry.scene-1][entry.source_after_paragraph-1]?.after_anchor===entry['after_paragraph_'+lang],'edition artwork bilingual anchor binding');
  }
  if(preservedHd){
   const original=approvedHd[index];
   for(const field of ['scene','after_paragraph_en','after_paragraph_sl','paragraph_sha256_en','paragraph_sha256_sl','src','width','height','sha256','alt_en','alt_sl'])assert(entry[field]===original[field],'approved landscape HD binding '+field);
  }
  assert(exact(entry.variants,slots),'responsive artwork requires all four variant slots');
  for(const slot of slots){
   const v=entry.variants[slot];assert(exact(v,['src','width','height','sha256'])&&hex(v.sha256),'responsive variant fields');
   const legacy=inherited&&slot.startsWith('L_'),approved=preservedHd&&slot==='L_HD';
   const folder=legacy?prefix+(slot==='L_HD'?'HD/':'4K/'):approved?prefix+'R1/':leaf;
   assert(typeof v.src==='string'&&v.src.startsWith(folder)&&/^[A-Za-z0-9_.-]+\.webp$/.test(v.src.slice(folder.length)),'unsafe responsive variant path');
   const four=slot.endsWith('4K'),portrait=slot.startsWith('P_');
   const expected=approved?[1672,941]:portrait?(four?[2160,3840]:[1080,1920]):(inherited&&item.paths.date==='2026-10-05'?(four?[3838,2160]:[1919,1080]):(four?[3840,2160]:[1920,1080]));
   assert(v.width===expected[0]&&v.height===expected[1],'responsive variant dimensions');
   const file=path.join(n,v.src);assert(fs.existsSync(file)&&fs.statSync(file).isFile(),'responsive variant missing');
   assert(fs.realpathSync(file).startsWith(fs.realpathSync(path.join(n,'assets/img/daily'))+path.sep),'unsafe responsive asset location');
   const bytes=fs.readFileSync(file);assert(sha(bytes)===v.sha256,'responsive variant hash mismatch');validateWebp(bytes,v.width,v.height);
  }
  for(const [slot,suffix]of [['L_HD',''],['L_4K','_4k']])for(const field of ['src','width','height','sha256'])assert(entry.variants[slot][field]===entry[field+suffix],'responsive landscape fallback binding');
  return {...entry,after_paragraph:entry.after_paragraph_en,responsive:true,story_id:manifest.story_id};
 });
}

export function renderResponsiveIllustration(image,lang='en'){
 const l=image.variants.L_HD,p=image.variants.P_HD;
 const data=' data-nara-responsive="'+RESPONSIVE_VERSION+'" data-nara-story="'+esc(image.story_id)+'" data-nara-moment="'+esc(image.moment_id)+'" data-nara-variants="'+esc(JSON.stringify(image.variants))+'"';
 return '<figure class="daily-scene-figure"><picture class="nara-responsive-picture"><source media="(orientation: portrait)" srcset="'+esc(p.src)+'" width="'+p.width+'" height="'+p.height+'"><img src="'+esc(l.src)+'"'+data+' data-nara-image-hd="'+esc(image.src)+'" data-nara-image-4k="'+esc(image.src_4k)+'" alt="'+esc(lang==='sl'?image.alt_sl:image.alt_en)+'" width="'+l.width+'" height="'+l.height+'" loading="lazy" decoding="async"></picture><span class="nara-inline-error" role="status" hidden></span></figure>';
}
