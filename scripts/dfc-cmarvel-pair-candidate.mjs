// Private build-time preparation only. No reader, production or vault writes.
import {readFile,writeFile,mkdir,rename,rm,mkdtemp,lstat,open,realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash,webcrypto} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readZip,validateSVG} from './dfc-import-pairs.mjs';
import {canonical,safePath} from '../public/Nara/dualframe-lab/dfc-model.mjs';
import {FIRST_PAGE_PANELS,FIRST_PAGE_SOURCE_SHA256} from '../public/Nara/dualframe-lab/cmarvel-01/first-page.mjs';
import {validateComicManifest,fromBase64} from '../public/Nara/dualframe-lab/cmarvel-01/crypto.mjs';

const sharp=createRequire(new URL('../functions/package.json',import.meta.url))('sharp');
const sha=b=>createHash('sha256').update(b).digest('hex');
const enc=new TextEncoder(),subtle=webcrypto.subtle;
const SOURCE_CATALOG='6a78e66f8e843250f819bc8d0ba0077bd1f756d46e71661d5c477c80d37ab948';
const SOURCE_MANIFEST='acf27a701f384941e7ae5f4a25d682101664b0f2624fca867e7a2db4ebb93913';
const ensure=(ok,reason)=>{if(!ok)throw Error('CMARVEL_PAIR_'+reason);};
const json=b=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b));
const isHash=h=>typeof h==='string'&&/^[a-f0-9]{64}$/.test(h);
const equal=(a,b)=>canonical(a)===canonical(b);

export async function validateCMarvelPairBundle(zipBytes,expectedTranscriptBytes,{allowFixtures=false}={}){
 const files=readZip(zipBytes),bundle=json(files.get('bundle.json'));
 ensure(bundle.schema==='bd.dfc.cmarvel-p01-pairs.v1'&&bundle.story_id==='CMARVEL_01'&&bundle.page_id==='CM01-P01','STORY');
 ensure(bundle.source_sha256===FIRST_PAGE_SOURCE_SHA256&&bundle.source_catalog_sha256===SOURCE_CATALOG,'SOURCE');
 ensure(bundle.transcript?.file==='transcript.json'&&bundle.transcript.sha256===sha(expectedTranscriptBytes),'TRANSCRIPT_PIN');
 ensure(bundle.member_hashes&&typeof bundle.member_hashes==='object'&&!Array.isArray(bundle.member_hashes),'MEMBERS');
 const names=Object.keys(bundle.member_hashes);
 ensure(names.length===files.size-1&&!names.includes('bundle.json'),'MEMBERS');
 for(const file of names){
  safePath(file);
  ensure(file==='transcript.json'||/^(?:art|overlays|provenance)\/[A-Za-z0-9_-]+\.(?:png|webp|jpe?g|svg|json)$/.test(file),'MEMBER_PATH');
  ensure(files.has(file)&&isHash(bundle.member_hashes[file])&&sha(files.get(file))===bundle.member_hashes[file],'MEMBER_HASH');
 }
 ensure(Buffer.from(files.get('transcript.json')).equals(Buffer.from(expectedTranscriptBytes)),'TRANSCRIPT_BYTES');
 const transcript=json(expectedTranscriptBytes);
 ensure(transcript.story_id==='CMARVEL_01'&&transcript.page_id==='CM01-P01'&&transcript.language==='EN'&&transcript.source_sha256===FIRST_PAGE_SOURCE_SHA256&&transcript.panels?.length===6,'TRANSCRIPT_SOURCE');
 ensure(bundle.panels?.length===6,'SIX_COMPLETE_PAIRS_REQUIRED');
 const used=new Set(['transcript.json']),assets=[],nativeHashes=new Set(),provenance={};
 for(let i=0;i<6;i++){
  const panel=bundle.panels[i],source=FIRST_PAGE_PANELS[i],text=transcript.panels[i];
  ensure(panel.panel_id===source.id&&panel.reading_order===i+1&&panel.page_id==='CM01-P01'&&equal(panel.source_rect_px,source.rect),'PANEL_BINDING');
  ensure(text.panel_id===source.id&&text.reading_order===i+1&&equal(text.source_rect_px,source.rect)&&text.status==='VISUAL_REVIEWED','TRANSCRIPT_PANEL');
  ensure(Array.isArray(text.records)&&text.records.every((r,n)=>r.text_id===`${source.id}-T${String(n+1).padStart(2,'0')}`&&r.order===n+1&&typeof r.text==='string'&&/^VISUAL_REVIEWED/.test(r.verification)),'TRANSCRIPT_RECORDS');
  ensure(['clean_art','anatomy','source_moment','portrait_composite','landscape_composite'].every(k=>panel.qa?.[k]==='PASS'),'VISUAL_QA');
  const get=a=>{
   ensure(a&&typeof a.file==='string'&&!used.has(a.file)&&isHash(a.sha256)&&a.sha256===bundle.member_hashes[a.file],'ASSET_BINDING');
   ensure(files.has(a.file),'ASSET_MISSING');used.add(a.file);return files.get(a.file);
  };
  for(const orientation of ['P','L']){
   const a=panel[orientation],bytes=get(a);
   ensure(Number.isInteger(a.width_px)&&Number.isInteger(a.height_px)&&a.width_px>0&&a.height_px>0&&a.width_px*a.height_px<=24*1024*1024,'DIMENSIONS');
   ensure(orientation==='P'?a.height_px>a.width_px:a.width_px>a.height_px,'ORIENTATION');
   ensure(Math.abs(Math.min(a.width_px,a.height_px)/Math.max(a.width_px,a.height_px)-9/16)<0.012,'ASPECT');
   const meta=await sharp(bytes,{limitInputPixels:24*1024*1024}).metadata();
   ensure(['png','jpeg','webp'].includes(meta.format)&&meta.width===a.width_px&&meta.height===a.height_px&&(!meta.orientation||meta.orientation===1)&&(!meta.pages||meta.pages===1),'DECODED_DIMENSIONS');
   await sharp(bytes,{limitInputPixels:24*1024*1024}).resize({width:32}).raw().toBuffer();
   ensure(!nativeHashes.has(a.sha256)&&a.sha256!==FIRST_PAGE_SOURCE_SHA256&&a.sha256!==text.source_reference_sha256,'DUPLICATE_ART');nativeHashes.add(a.sha256);
   const p=json(get(a.provenance));
   ensure(p.panel_id===panel.panel_id&&p.orientation===orientation&&p.source_sha256===FIRST_PAGE_SOURCE_SHA256&&equal(p.source_rect_px,source.rect)&&p.reference_sha256===text.source_reference_sha256,'PROVENANCE_SOURCE');
   ensure(p.tool==='image_gen.imagegen'&&p.derivation==='independent-native-composition'&&typeof p.prompt==='string'&&p.prompt.trim().length>0&&p.native_output?.sha256===a.sha256&&p.native_output.width_px===a.width_px&&p.native_output.height_px===a.height_px,'NATIVE_PROVENANCE');
   ensure(!p.fixture||allowFixtures,'SYNTHETIC_PRODUCTION_FORBIDDEN');
   if(!p.fixture)ensure(Math.min(a.width_px,a.height_px)>=720,'NATIVE_HD_REQUIRED');
   provenance[a.provenance.file]=p;
   assets.push({id:`${panel.panel_id}-${orientation}-art`,kind:'art',file:a.file,width_px:a.width_px,height_px:a.height_px,mime:`image/${meta.format==='jpeg'?'jpeg':meta.format}`});
   const overlay=panel.overlays?.[orientation],overlayBytes=get(overlay);
   ensure(overlay.width_px===a.width_px&&overlay.height_px===a.height_px&&equal(overlay.text_ids,text.records.map(r=>r.text_id)),'OVERLAY_BINDING');
   await validateSVG(overlayBytes,overlay,text.records.map(r=>({EN:r.text})),'EN');
   assets.push({id:`${panel.panel_id}-${orientation}-EN`,kind:'overlay',file:overlay.file,width_px:a.width_px,height_px:a.height_px,mime:'image/svg+xml'});
  }
 }
 ensure(names.every(file=>used.has(file)),'UNREFERENCED_MEMBER');
 return {bundle,files,assets,transcript,provenance,package_sha256:sha(zipBytes),fixture:allowFixtures};
}

async function keyFor(passphrase,manifest){
 ensure(typeof passphrase==='string'&&passphrase.length>0,'SECURE_KEY_ACCESS_REQUIRED');
 const material=await subtle.importKey('raw',enc.encode(passphrase),'PBKDF2',false,['deriveKey']);
 return subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:fromBase64(manifest.salt),iterations:manifest.iterations},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function decrypt(bytes,key,entry){return Buffer.from(await subtle.decrypt({name:'AES-GCM',iv:fromBase64(entry.iv),additionalData:enc.encode(entry.aad)},key,bytes));}
async function regularBytes(root,file){safePath(file);const full=path.join(root,file);ensure((await lstat(full)).isFile(),'CIPHER_NOT_REGULAR');return readFile(full);}

export async function prepareEncryptedCMarvelCandidate(validated,{manifestBytes,sourceCipher,passphrase,destination,allowFixtures=false}){
 ensure(!validated.fixture||allowFixtures,'SYNTHETIC_PRODUCTION_FORBIDDEN');
 const original=validateComicManifest(json(manifestBytes));
 ensure(Number.isInteger(original.iterations)&&original.iterations>=600000&&fromBase64(original.salt).length===16,'KDF');
 ensure(allowFixtures||sha(manifestBytes)===SOURCE_MANIFEST,'ORIGINAL_MANIFEST_PIN');
 ensure(sourceCipher.length===original.pages[0].cipher_bytes&&sha(sourceCipher)===original.pages[0].cipher_sha256,'ORIGINAL_CIPHER_PIN');
 const key=await keyFor(passphrase,original);
 const first=await decrypt(sourceCipher,key,original.pages[0]);
 ensure(allowFixtures||sha(first)===FIRST_PAGE_SOURCE_SHA256,'ORIGINAL_SOURCE_HASH');first.fill(0);
 ensure(typeof destination==='string'&&path.isAbsolute(destination),'PRIVATE_DESTINATION');
 const publicRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
 const out=path.resolve(destination);
 ensure(out!==publicRoot&&!out.startsWith(publicRoot+path.sep),'PRIVATE_CANDIDATE_ONLY');
 // A candidate is immutable. Re-import checks all ciphertext before returning.
 await mkdir(path.dirname(out),{recursive:true});
 const physicalParent=await realpath(path.dirname(out)),physicalPublic=await realpath(publicRoot);
 ensure(physicalParent!==physicalPublic&&!physicalParent.startsWith(physicalPublic+path.sep),'PRIVATE_CANDIDATE_ONLY');
 const lock=await open(out+'.import.lock','wx');
 let stage;
 try{
  let exists=false;try{await lstat(out);exists=true;}catch(e){if(e.code!=='ENOENT')throw e;}
  if(exists){
   const old=json(await regularBytes(out,'pair-manifest.json'));
   ensure(old.schema==='bd.dfc.cmarvel-p01-cipher.v1'&&old.source_manifest_sha256===sha(manifestBytes)&&old.members?.length===25,'EXISTING_CANDIDATE');
   const opened=new Map(),ivs=new Set(original.pages.map(p=>p.iv));
   for(const entry of old.members){
    ensure(!opened.has(entry.id)&&entry.aad===`DFC-CMARVEL-01:page01-pairs:v1:${sha(manifestBytes)}:${entry.id}`&&!ivs.has(entry.iv),'CIPHER_BINDING');ivs.add(entry.iv);
    const bytes=await regularBytes(out,entry.file);ensure(bytes.length===entry.cipher_bytes&&sha(bytes)===entry.cipher_sha256,'CIPHER_INTEGRITY');opened.set(entry.id,await decrypt(bytes,key,entry));
   }
   const metadata=json(opened.get('metadata'));
   ensure(metadata.package_sha256===validated.package_sha256,'IMMUTABLE_CANDIDATE_CONFLICT');
   ensure(equal(metadata.bundle,validated.bundle)&&equal(metadata.transcript,validated.transcript)&&equal(metadata.provenance,validated.provenance),'METADATA_MISMATCH');
   for(const asset of validated.assets)ensure(opened.get(asset.id)?.equals(validated.files.get(asset.file)),'CIPHER_PLAINTEXT_MISMATCH');
   for(const bytes of opened.values())bytes.fill(0);
   return {status:'UNCHANGED_VERIFIED',pair_count:6,art_count:12,manifest_sha256:sha(await readFile(path.join(out,'pair-manifest.json')))};
  }
  stage=await mkdtemp(out+'.candidate-');await mkdir(path.join(stage,'assets'));
  const ivs=new Set(original.pages.map(p=>p.iv)),members=[];
  const seal=async(id,plain,extra={})=>{
   let iv;do{iv=Buffer.from(webcrypto.getRandomValues(new Uint8Array(12))).toString('base64');}while(ivs.has(iv));ivs.add(iv);
   const aad=`DFC-CMARVEL-01:page01-pairs:v1:${sha(manifestBytes)}:${id}`,file=`assets/${id}.enc`;
   const cipher=Buffer.from(await subtle.encrypt({name:'AES-GCM',iv:fromBase64(iv),additionalData:enc.encode(aad)},key,plain));
   const entry={id,file,iv,aad,cipher_sha256:sha(cipher),cipher_bytes:cipher.length,...extra};
   ensure((await decrypt(cipher,key,entry)).equals(plain),'ENCRYPTION_READBACK');
   await writeFile(path.join(stage,file),cipher,{flag:'wx'});members.push(entry);
  };
  for(const a of validated.assets)await seal(a.id,validated.files.get(a.file),{kind:a.kind,width_px:a.width_px,height_px:a.height_px,mime:a.mime});
  await seal('metadata',Buffer.from(JSON.stringify({schema:'bd.dfc.cmarvel-p01-private.v1',package_sha256:validated.package_sha256,bundle:validated.bundle,transcript:validated.transcript,provenance:validated.provenance})),{kind:'metadata'});
  const publicManifest={schema:'bd.dfc.cmarvel-p01-cipher.v1',story_id:'CMARVEL_01',page_id:'CM01-P01',source_manifest_sha256:sha(manifestBytes),pair_count:6,art_count:12,members};
  const bytes=Buffer.from(JSON.stringify(publicManifest,null,2)+'\n');await writeFile(path.join(stage,'pair-manifest.json'),bytes,{flag:'wx'});
  await rename(stage,out);stage=null;
  return {status:'PRIVATE_CANDIDATE_BUILT_NOT_PUBLISHED',pair_count:6,art_count:12,manifest_sha256:sha(bytes)};
 }finally{if(stage)await rm(stage,{recursive:true,force:true});await lock.close();await rm(out+'.import.lock',{force:true});}
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [zipPath,transcriptPath,manifestPath,destination]=process.argv.slice(2);
 ensure(zipPath&&transcriptPath&&manifestPath&&destination,'USAGE_ZIP_REVIEWED_TRANSCRIPT_ORIGINAL_MANIFEST_PRIVATE_OUT');
 // Validate public-source bindings and private art before reading a secret.
 const validated=await validateCMarvelPairBundle(await readFile(zipPath),await readFile(transcriptPath));
 const manifestBytes=await readFile(manifestPath),manifest=validateComicManifest(json(manifestBytes));
 ensure(sha(manifestBytes)===SOURCE_MANIFEST,'ORIGINAL_MANIFEST_PIN');
 let line='';for await(const chunk of process.stdin){line+=chunk;ensure(line.length<=16384,'SECRET_INPUT_SIZE');if(line.includes('\n'))break;}
 let credentials;try{credentials=JSON.parse(line.split('\n')[0]);}catch{throw Error('CMARVEL_PAIR_SECURE_KEY_ACCESS_REQUIRED');}line='';
 const passphrase=credentials.comicPassword;delete credentials.comicPassword;
 const receipt=await prepareEncryptedCMarvelCandidate(validated,{manifestBytes,sourceCipher:await readFile(path.join(path.dirname(manifestPath),manifest.pages[0].file)),passphrase,destination:path.resolve(destination)});
 console.log(JSON.stringify(receipt));
}
