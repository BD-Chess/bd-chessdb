// Build-time only. Resolve exact Drive IDs with the connected Drive tool first;
// provide a local {drive_id:absolute_zip_path} map. Public readers never use Drive.
import {readFile,access,rename,rm,cp} from 'node:fs/promises';
import path from 'node:path';
import {inflateRawSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {SOURCE,STORY_ID,assert,canonical,safePath,rectValid,validateEdition} from '../public/Nara/dualframe-lab/dfc-model.mjs';
import {sha,atomic,appRoot} from './dfc-build-overviews.mjs';
const sharp=createRequire(new URL('../functions/package.json',import.meta.url))('sharp');
const required=(value,keys,reason)=>{assert(value&&keys.every(k=>Object.hasOwn(value,k)),reason);};
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(b){let n=0xffffffff;for(const v of b)n=crcTable[(n^v)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
export function readZip(bytes){
 assert(bytes.length<90*1048576,'PART_SIZE');let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50){end=i;break;}assert(end>=0,'ZIP_DIRECTORY');
 assert(bytes.readUInt16LE(end+4)===0&&bytes.readUInt16LE(end+6)===0,'ZIP_MULTIDISK');const count=bytes.readUInt16LE(end+10),size=bytes.readUInt32LE(end+12),start=bytes.readUInt32LE(end+16);assert(count<2000&&start+size===end&&end+22+bytes.readUInt16LE(end+20)===bytes.length,'ZIP_DIRECTORY');
 const files=new Map();let at=start,total=0;for(let n=0;n<count;n++){
  assert(at+46<=end&&bytes.readUInt32LE(at)===0x02014b50,'ZIP_ENTRY');const flags=bytes.readUInt16LE(at+8),method=bytes.readUInt16LE(at+10),crc=bytes.readUInt32LE(at+16),packed=bytes.readUInt32LE(at+20),unpacked=bytes.readUInt32LE(at+24),len=bytes.readUInt16LE(at+28),extra=bytes.readUInt16LE(at+30),comment=bytes.readUInt16LE(at+32),offset=bytes.readUInt32LE(at+42),mode=(bytes.readUInt32LE(at+38)>>>16)&0xf000;assert(!(flags&1)&&[0,8].includes(method)&&mode!==0xa000,'ZIP_FORMAT');
  const name=bytes.subarray(at+46,at+46+len).toString('utf8');at+=46+len+extra+comment;assert(at<=end,'ZIP_ENTRY');if(name.endsWith('/')){safePath(name.slice(0,-1));continue;}safePath(name);assert(!files.has(name)&&unpacked<=64*1048576,'ZIP_DUPLICATE_OR_SIZE');total+=unpacked;assert(total<=256*1048576,'ZIP_EXPANSION');assert(offset+30<=start&&bytes.readUInt32LE(offset)===0x04034b50,'ZIP_LOCAL');const localLen=bytes.readUInt16LE(offset+26),localExtra=bytes.readUInt16LE(offset+28);assert(bytes.subarray(offset+30,offset+30+localLen).toString('utf8')===name&&bytes.readUInt16LE(offset+8)===method,'ZIP_LOCAL_NAME');const dataAt=offset+30+localLen+localExtra;assert(dataAt+packed<=start,'ZIP_BOUNDS');const compressed=bytes.subarray(dataAt,dataAt+packed),data=method===0?compressed:inflateRawSync(compressed,{maxOutputLength:64*1048576});assert(data.length===unpacked&&crc32(data)===crc,'ZIP_CRC');files.set(name,Buffer.from(data));
 }assert(at===end,'ZIP_DIRECTORY');return files;
}
const plain=s=>s.replace(/<[^>]*>/g,' ').replace(/&#x([a-f0-9]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
export async function validateSVG(bytes,asset,records,language){
 assert(bytes.length<=2*1048576,'SVG_SIZE');const svg=bytes.toString('utf8'),withoutNamespace=svg.replace(/\sxmlns(?::[A-Za-z0-9_-]+)?=["']http:\/\/www\.w3\.org\/[^"']+["']/g,'');assert(!/<!DOCTYPE|<!ENTITY|<\s*(script|foreignObject|image|use|a|iframe|animate\w*|set)\b|\bon\w+\s*=|(?:href|xlink:href)\s*=|@import|javascript:|https?:|file:/i.test(withoutNamespace),'SVG_ACTIVE_CONTENT');
 // Only self-contained fonts and fragment paint references; no external I/O.
 for(const match of svg.matchAll(/url\(\s*['"]?([^)'"\s]+)/gi))assert(/^#[A-Za-z0-9_-]+$/.test(match[1])||/^data:(?:font\/|application\/font-)/.test(match[1]),'SVG_EXTERNAL_RESOURCE');
 const view=svg.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1]?.trim().split(/[ ,]+/).map(Number);assert(view?.length===4&&view[0]===0&&view[1]===0&&view[2]===asset.width_px&&view[3]===asset.height_px,'SVG_VIEWBOX');
 const words=[...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text\s*>/gi)].map(m=>plain(m[1])).join(' ');assert(words===records.map(r=>r[language].replace(/\s+/g,' ').trim()).join(' '),'SVG_EXACT_TEXT');
 const m=await sharp(bytes,{limitInputPixels:24*1024*1024}).metadata();assert(m.width===asset.width_px&&m.height===asset.height_px,'SVG_DIMENSIONS');await sharp(bytes,{limitInputPixels:24*1024*1024}).resize({width:64}).png().toBuffer();return true;
}
export async function validatePairImport({catalog,catalogBytes,partsByDrive,edition,loadPart=readFile}){
 required(catalog,['schema','version','story_id','source_h1_release_sha256','overview_catalog_sha256','dialogue_file','dialogue_sha256','panel_count','pair_count','artwork_composition_count','panels','delivery_parts','package_manifest'],'CATALOG_FIELDS');
 assert(catalog.schema==='bd.dfc.paired-catalog.v1'&&catalog.story_id===STORY_ID&&catalog.source_h1_release_sha256===SOURCE.h1&&catalog.overview_catalog_sha256===SOURCE.catalog&&catalog.dialogue_sha256===SOURCE.dialogue,'PAIR_SOURCE');
 assert(catalog.panel_count===39&&catalog.pair_count===catalog.panels.length&&catalog.pair_count>0&&catalog.pair_count<=39&&catalog.artwork_composition_count===2*catalog.pair_count,'PAIR_COUNTS');
 const allFiles=new Map(),fileParts=new Map(),partIds=new Set();const receipt=[];
 for(const p of catalog.delivery_parts){required(p,['part_id','filename','drive_id','bytes','sha256','panel_ids','included_files','raw_readback'],'PART_FIELDS');assert(!partIds.has(p.part_id)&&typeof p.drive_id==='string'&&/^[a-f0-9]{64}$/.test(p.sha256),'PART_ID');partIds.add(p.part_id);safePath(p.filename);assert(p.raw_readback==='PASS'||p.raw_readback?.status==='PASS'||p.raw_readback?.verified===true,'PART_READBACK');assert(partsByDrive[p.drive_id],'UNRESOLVED_DRIVE_PART');const bytes=await loadPart(partsByDrive[p.drive_id]);assert(bytes.length===p.bytes&&sha(bytes)===p.sha256,'PART_HASH');const files=readZip(bytes),included=p.included_files.map(f=>typeof f==='string'?f:f.file||f.path);assert(new Set(included).size===included.length&&included.length===files.size&&included.every(f=>files.has(safePath(f))),'PART_MEMBERS');
  for(const [name,data]of files){assert(/^(?:art|lettering|provenance|story-state|fonts|licenses)\//.test(name)||name==='sources/DFC_DIALOGUE_SOURCE.json'||(!name.includes('/')&&/\.(json|txt|md)$/.test(name)),'UNEXPECTED_PUBLIC_MEMBER');assert(/\.(png|jpe?g|webp|svg|json|ttf|otf|woff2?|txt|md)$/i.test(name),'UNEXPECTED_PUBLIC_TYPE');assert(!allFiles.has(name),'PART_PATH_COLLISION');allFiles.set(name,data);fileParts.set(name,p.part_id);}receipt.push({part_id:p.part_id,drive_id:p.drive_id,sha256:p.sha256,bytes:bytes.length});
 }
 const assetBytes=(a,panelId)=>{safePath(a.file);assert(fileParts.get(a.file)===a.delivery_part_id&&allFiles.has(a.file),'ASSET_PART_BINDING');if(panelId)assert(catalog.delivery_parts.find(p=>p.part_id===a.delivery_part_id)?.panel_ids.includes(panelId),'ASSET_PANEL_BINDING');const b=allFiles.get(a.file);assert(sha(b)===a.sha256,'PAIR_ASSET_HASH');return b;};
 assert(sha(allFiles.get(safePath(catalog.dialogue_file))||Buffer.alloc(0))===SOURCE.dialogue,'DELIVERED_DIALOGUE');assert(allFiles.has(safePath(catalog.package_manifest)),'PACKAGE_MANIFEST');
 // Verify every entry of the supplied member manifest, independently of the
 // catalog. Accept SHA256SUMS text or an object/array of file/hash records.
 const manifestBytes=allFiles.get(catalog.package_manifest);let entries;
 if(catalog.package_manifest.endsWith('.json')){const m=JSON.parse(manifestBytes);entries=Array.isArray(m)?m:m.files||m.members;assert(Array.isArray(entries),'PACKAGE_MANIFEST_SHAPE');entries=entries.map(x=>[x.sha256,x.file||x.path]);}else entries=manifestBytes.toString('utf8').trim().split(/\r?\n/).filter(Boolean).map(l=>{const m=l.match(/^([a-f0-9]{64})\s+\*?(.+)$/);assert(m,'PACKAGE_MANIFEST_LINE');return [m[1],m[2]];});
 for(const [hash,name]of entries)assert(sha(allFiles.get(safePath(name))||Buffer.alloc(0))===hash,'PACKAGE_MEMBER_HASH');
 const seen=new Set(),imported=[];
 for(const p of catalog.panels){required(p,['panel_id','page_id','reading_order','source_panel_ref','story_state_sha256','text_ids','P','L','overlays','qa_status'],'PAIR_FIELDS');const source=edition.panels.find(s=>s.panel_id===p.panel_id);assert(source&&!seen.has(p.panel_id)&&p.page_id===source.page_id&&p.reading_order===source.reading_order,'PAIR_ID');seen.add(p.panel_id);assert(['PASS','APPROVED','REVIEWED_PASS','QA_PASS'].includes(p.qa_status),'PAIR_QA');assert(canonical(p.text_ids)===canonical(source.text_ids),'PAIR_TEXT_IDS');assert(p.source_panel_ref===p.panel_id||p.source_panel_ref?.panel_id===p.panel_id,'SOURCE_PANEL_REF');
  const statePath=`story-state/${p.panel_id}.json`,stateBytes=allFiles.get(statePath);assert(stateBytes&&sha(stateBytes)===p.story_state_sha256,'STORY_STATE_HASH');const state=JSON.parse(stateBytes);assert(sha(canonical(state))===p.story_state_sha256,'STORY_STATE_CANONICAL');const expected={panel_id:source.panel_id,page_id:source.page_id,reading_order:source.reading_order,story_beat:source.story_beat,protected_story_facts:source.protected_story_facts,dialogue:source.dialogue};assert(canonical(state)===canonical(expected),'STORY_STATE_FACTS');
  for(const o of ['P','L']){const a=p[o];required(a,['file','delivery_part_id','sha256','width_px','height_px','native_generation','provenance','protected_subject_rect_norm','display_policy'],'VARIANT_FIELDS');assert(rectValid(a.protected_subject_rect_norm)&&['fit','safe-cover'].includes(typeof a.display_policy==='string'?a.display_policy:a.display_policy?.mode),'DISPLAY_POLICY');assert(a.width_px*a.height_px<=24*1024*1024&&(o==='P'?a.height_px>a.width_px:a.width_px>a.height_px),'PAIR_DIMENSIONS');const bytes=assetBytes(a,p.panel_id),meta=await sharp(bytes,{limitInputPixels:24*1024*1024}).metadata();assert(['png','jpeg','webp'].includes(meta.format)&&meta.width===a.width_px&&meta.height===a.height_px,'PAIR_IMAGE');await sharp(bytes).resize({width:64}).raw().toBuffer();
   assert(a.native_generation&&a.provenance,'NATIVE_PROVENANCE');
   for(const l of ['SL','EN']){const overlay=p.overlays?.[o]?.[l];required(overlay,['file','delivery_part_id','sha256','width_px','height_px','text_ids'],'OVERLAY_FIELDS');assert(overlay.width_px===a.width_px&&overlay.height_px===a.height_px&&canonical(overlay.text_ids)===canonical(source.text_ids),'OVERLAY_GEOMETRY');await validateSVG(assetBytes(overlay,p.panel_id),overlay,source.dialogue,l);}
  }
  assert(p.P.sha256!==p.L.sha256&&p.P.sha256!==source.source_zoom.sha256&&p.L.sha256!==source.source_zoom.sha256,'DUPLICATE_SOURCE_CROP');
  const prov=allFiles.get(`provenance/${p.panel_id}.json`);assert(prov,'PROVENANCE_FILE');const provenance=JSON.parse(prov);assert(provenance.panel_id===p.panel_id&&provenance.story_state_sha256===p.story_state_sha256,'PROVENANCE_BINDING');
  imported.push({...p,qa_status:'PASS'});
 }
 for(const p of catalog.delivery_parts)assert(p.panel_ids.every(id=>seen.has(id)),'PART_PANEL_IDS');
 return {imported,files:allFiles,receipt:{catalog_sha256:sha(catalogBytes),pair_count:imported.length,parts:receipt}};
}
export async function importPairs(catalogPath,mapPath,destination=path.join(appRoot,'content/illuminara')){
 // Recover a process stop between the two sibling renames before revalidating.
 try{await access(destination);}catch(error){try{await rename(destination+'.previous',destination);}catch{throw error;}}
 const catalogBytes=await readFile(catalogPath),catalog=JSON.parse(catalogBytes),partsByDrive=JSON.parse(await readFile(mapPath)),edition=validateEdition(JSON.parse(await readFile(path.join(destination,'edition.json'))));
 const result=await validatePairImport({catalog,catalogBytes,partsByDrive,edition});
 const parent=path.dirname(destination),stage=destination+'.candidate',backup=destination+'.previous';await rm(stage,{recursive:true,force:true});await cp(destination,stage,{recursive:true});
 // Validation finishes before any destination is changed. Import is a complete
 // sibling edition swap, never a half-pair patch. Re-running is idempotent.
 try{for(const [file,bytes]of result.files)await atomic(path.join(stage,'paired',safePath(file)),bytes);
  const rebase=a=>({...a,file:'paired/'+a.file});for(const p of result.imported){const s=edition.panels.find(x=>x.panel_id===p.panel_id);Object.assign(s,{P:rebase(p.P),L:rebase(p.L),overlays:Object.fromEntries(['P','L'].map(o=>[o,Object.fromEntries(['SL','EN'].map(l=>[l,rebase(p.overlays[o][l])]))])),qa_status:'PASS',pair_source_story_state_sha256:p.story_state_sha256,readiness:{...s.readiness,pair_ready:true}});}
  edition.pair_count=edition.panels.filter(p=>p.readiness.pair_ready).length;edition.pair_import_history=[...(edition.pair_import_history||[]),...(edition.pair_import?[edition.pair_import]:[])].filter((r,i,all)=>all.findIndex(a=>a.catalog_sha256===r.catalog_sha256)===i&&r.catalog_sha256!==result.receipt.catalog_sha256);edition.pair_import=result.receipt;validateEdition(edition);await atomic(path.join(stage,'paired/DFC_PAIRED_CATALOG.json'),catalogBytes);await atomic(path.join(stage,'edition.json'),JSON.stringify(edition,null,2)+'\n');
  const old=JSON.parse(await readFile(path.join(stage,'members.json'))),replaced=new Set([...result.files.keys()].map(p=>'paired/'+p)),members=old.members.filter(m=>m.file!=='edition.json'&&m.file!=='paired/DFC_PAIRED_CATALOG.json'&&!replaced.has(m.file));for(const [file,bytes]of result.files)if(file!=='DFC_PAIRED_CATALOG.json')members.push({file:'paired/'+file,bytes:bytes.length,sha256:sha(bytes)});const ed=await readFile(path.join(stage,'edition.json'));members.push({file:'edition.json',bytes:ed.length,sha256:sha(ed)});const cb=await readFile(path.join(stage,'paired/DFC_PAIRED_CATALOG.json'));members.push({file:'paired/DFC_PAIRED_CATALOG.json',bytes:cb.length,sha256:sha(cb)});await atomic(path.join(stage,'members.json'),JSON.stringify({...old,members},null,2)+'\n');
  await rm(backup,{recursive:true,force:true});await rename(destination,backup);try{await rename(stage,destination);}catch(error){await rename(backup,destination);throw error;}await rm(backup,{recursive:true,force:true});console.log(JSON.stringify({state:'IMPORTED',...result.receipt,edition_sha256:sha(ed)}));return result.receipt;
 }catch(error){await rm(stage,{recursive:true,force:true});throw error;}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){assert(process.argv[2]&&process.argv[3],'USAGE_CATALOG_PART_MAP');await importPairs(process.argv[2],process.argv[3]);}
