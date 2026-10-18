import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,access,symlink} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {webcrypto,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {validateCMarvelPairBundle,prepareEncryptedCMarvelCandidate} from '../scripts/dfc-cmarvel-pair-candidate.mjs';
import {FIRST_PAGE_PANELS,FIRST_PAGE_SOURCE_SHA256} from '../public/Nara/dualframe-lab/cmarvel-01/first-page.mjs';
const sharp=createRequire(new URL('../functions/package.json',import.meta.url))('sharp');
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=b=>JSON.parse(b.toString());
const bytes=o=>Buffer.from(JSON.stringify(o));
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
// A stored ZIP fixture writer, not a production archive parser.
const table=Array.from({length:256},(_,n)=>{for(let j=0;j<8;j++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(b){let n=0xffffffff;for(const x of b)n=table[(n^x)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
function zip(files){
 const local=[],central=[];let offset=0;
 for(const [name,data]of files){const n=Buffer.from(name),h=Buffer.alloc(30),c=Buffer.alloc(46),sum=crc(data);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt32LE(sum,14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(n.length,26);local.push(h,n,data);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt32LE(sum,16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);central.push(c,n);offset+=h.length+n.length+data.length;}
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.size,8);end.writeUInt16LE(files.size,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,directory,end]);
}
const initial=async()=>{
 const files=new Map(),panels=[],transcript={story_id:'CMARVEL_01',page_id:'CM01-P01',language:'EN',source_sha256:FIRST_PAGE_SOURCE_SHA256,panels:[]};
 const bundle={schema:'bd.dfc.cmarvel-p01-pairs.v1',story_id:'CMARVEL_01',page_id:'CM01-P01',source_sha256:FIRST_PAGE_SOURCE_SHA256,source_catalog_sha256:'6a78e66f8e843250f819bc8d0ba0077bd1f756d46e71661d5c477c80d37ab948',panels,member_hashes:{}};
 const add=(file,b)=>{files.set(file,b);return {file,sha256:sha(b)};};
 for(const [i,source]of FIRST_PAGE_PANELS.entries()){
  const record={text_id:`${source.id}-T01`,order:1,kind:'balloon',speaker:'Fixture person',text:`Synthetic fixture ${i+1}.`,verification:'VISUAL_REVIEWED'};
  const t={panel_id:source.id,reading_order:i+1,source_rect_px:source.rect,source_reference_sha256:sha(Buffer.from(`fixture-reference-${i}`)),status:'VISUAL_REVIEWED',records:[record]};transcript.panels.push(t);
  const p={panel_id:source.id,page_id:'CM01-P01',reading_order:i+1,source_rect_px:source.rect,qa:Object.fromEntries(['clean_art','anatomy','source_moment','portrait_composite','landscape_composite'].map(k=>[k,'PASS'])),overlays:{}};
  for(const orientation of ['P','L']){
   const [w,h]=orientation==='P'?[72,128]:[128,72],image=await sharp({create:{width:w,height:h,channels:3,background:{r:20+i*25,g:orientation==='P'?60:160,b:180}}}).png().toBuffer();
   p[orientation]={...add(`art/${source.id}-${orientation}.png`,image),width_px:w,height_px:h};
   const provenance={panel_id:source.id,orientation,source_sha256:FIRST_PAGE_SOURCE_SHA256,source_rect_px:source.rect,reference_sha256:t.source_reference_sha256,tool:'image_gen.imagegen',derivation:'independent-native-composition',prompt:`SYNTHETIC FIXTURE ONLY ${orientation}`,fixture:true,native_output:{sha256:sha(image),width_px:w,height_px:h}};
   p[orientation].provenance=add(`provenance/${source.id}-${orientation}.json`,bytes(provenance));
   const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><text x="1" y="12" font-size="4">${escape(record.text)}</text></svg>`);
   p.overlays[orientation]={...add(`overlays/${source.id}-${orientation}.svg`,svg),width_px:w,height_px:h,text_ids:[record.text_id]};
  }
  panels.push(p);
 }
 const expected=bytes(transcript);bundle.transcript=add('transcript.json',expected);
 for(const [name,b]of files)bundle.member_hashes[name]=sha(b);
 return {bundle,files,expected};
};
const base=await initial();
function fixture(){return {bundle:structuredClone(base.bundle),files:new Map([...base.files].map(([k,v])=>[k,Buffer.from(v)])),expected:Buffer.from(base.expected)};}
const pack=f=>zip(new Map([['bundle.json',bytes(f.bundle)],...f.files]));
const setMember=(f,name,b)=>{f.files.set(name,b);f.bundle.member_hashes[name]=sha(b);for(const p of f.bundle.panels)for(const o of ['P','L'])for(const a of [p[o],p[o]?.provenance,p.overlays?.[o]])if(a?.file===name)a.sha256=sha(b);};
const validate=f=>validateCMarvelPairBundle(pack(f),f.expected,{allowFixtures:true});

test('a complete synthetic six-pair bundle passes only the explicit test API',async()=>{
 const f=fixture(),v=await validate(f);assert.equal(v.assets.length,24);assert.equal(v.provenance&&Object.keys(v.provenance).length,12);
 await assert.rejects(validateCMarvelPairBundle(pack(f),f.expected),/SYNTHETIC_PRODUCTION_FORBIDDEN/);
});

const cases=[
 ['wrong story',f=>f.bundle.story_id='OTHER',/STORY/],
 ['wrong source',f=>f.bundle.source_sha256='0'.repeat(64),/SOURCE/],
 ['wrong source geometry',f=>f.bundle.panels[0].source_rect_px=[0,0,1,1],/PANEL_BINDING/],
 ['later-page ID',f=>f.bundle.panels[0].panel_id='CM01-P02-K01',/PANEL_BINDING/],
 ['five pairs',f=>f.bundle.panels.pop(),/SIX_COMPLETE_PAIRS_REQUIRED/],
 ['missing landscape',f=>delete f.bundle.panels[0].L,/ASSET_BINDING/],
 ['landscape dimensions on portrait',f=>Object.assign(f.bundle.panels[0].P,{width_px:128,height_px:72}),/ORIENTATION/],
 ['false image dimensions',f=>Object.assign(f.bundle.panels[0].P,{width_px:144,height_px:256}),/DECODED_DIMENSIONS/],
 ['unreviewed composition',f=>f.bundle.panels[0].qa.portrait_composite='PENDING',/VISUAL_QA/],
 ['different transcript bytes',f=>f.expected=Buffer.from('changed'),/TRANSCRIPT_PIN/],
 ['missing member',f=>f.files.delete(f.bundle.panels[0].P.file),/MEMBERS|MEMBER_HASH/],
 ['unsafe archive path',f=>{f.files.set('../escape.json',Buffer.from('{}'));f.bundle.member_hashes['../escape.json']=sha(Buffer.from('{}'));},/PATH/],
 ['changed overlay text',f=>{const a=f.bundle.panels[0].overlays.P;setMember(f,a.file,Buffer.from(f.files.get(a.file).toString().replace('Synthetic fixture 1.','Different words')));},/SVG_EXACT_TEXT/],
 ['active SVG',f=>{const a=f.bundle.panels[0].overlays.P;setMember(f,a.file,Buffer.from(f.files.get(a.file).toString().replace('</svg>','<script>alert(1)</script></svg>')));},/SVG_ACTIVE_CONTENT/],
 ['incorrect overlay dimensions',f=>f.bundle.panels[0].overlays.P.width_px=71,/OVERLAY_BINDING/],
 ['unbound source in provenance',f=>{const a=f.bundle.panels[0].P.provenance,p=json(f.files.get(a.file));p.reference_sha256='0'.repeat(64);setMember(f,a.file,bytes(p));},/PROVENANCE_SOURCE/],
 ['enlarged source claimed native',f=>{const a=f.bundle.panels[0].P.provenance,p=json(f.files.get(a.file));p.derivation='source-upscale';setMember(f,a.file,bytes(p));},/NATIVE_PROVENANCE/],
 ['unresolved transcript',f=>{const t=json(f.expected);t.panels[0].records[0].verification='UNRESOLVED';f.expected=bytes(t);setMember(f,'transcript.json',f.expected);f.bundle.transcript.sha256=sha(f.expected);},/TRANSCRIPT_RECORDS/]
];
for(const [name,mutate,error]of cases)test('rejects '+name,async()=>{const f=fixture();mutate(f);await assert.rejects(validate(f),error);});

const protection=async()=>{
 const passphrase='synthetic-fixture-key-only',salt=webcrypto.getRandomValues(new Uint8Array(16)),material=await webcrypto.subtle.importKey('raw',Buffer.from(passphrase),'PBKDF2',false,['deriveKey']);
 const key=await webcrypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:600000},material,{name:'AES-GCM',length:256},false,['encrypt']);
 const pages=[];let sourceCipher;
 for(let n=1;n<=11;n++){
  const page_id=`CM_${String(n).padStart(2,'0')}`,iv=webcrypto.getRandomValues(new Uint8Array(12)),aad=`DFC-CMARVEL-01:v1:${page_id}.webp`;
  const cipher=Buffer.from(await webcrypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:Buffer.from(aad)},key,Buffer.from(`synthetic-original-source-${n}`)));
  if(n===1)sourceCipher=cipher;
  pages.push({page_id,file:`assets/${page_id}.webp.enc`,iv:Buffer.from(iv).toString('base64'),aad,mime:'image/webp',width_px:3840,height_px:2160,cipher_bytes:cipher.length,cipher_sha256:sha(cipher)});
 }
 return {manifestBytes:bytes({schema:'bd.dfc.protected-comic.v1',story_id:'CMARVEL_01',version:1,protection:'PBKDF2-SHA-256 + AES-256-GCM',salt:Buffer.from(salt).toString('base64'),iterations:600000,pages}),sourceCipher,passphrase,allowFixtures:true};
};
const protectedFixture=await protection();
async function privateCase(fn){const root=await mkdtemp(path.join(os.tmpdir(),'cmarvel-pair-test-'));try{const v=await validate(fixture());await fn(v,{...protectedFixture,destination:path.join(root,'candidate')},root);}finally{await rm(root,{recursive:true,force:true});}}

test('cipher-only candidate has no transcript/plain art; re-import is byte-identical',()=>privateCase(async(v,options)=>{
 const first=await prepareEncryptedCMarvelCandidate(v,options),manifestPath=path.join(options.destination,'pair-manifest.json'),before=await readFile(manifestPath),manifest=json(before);
 assert.equal(first.status,'PRIVATE_CANDIDATE_BUILT_NOT_PUBLISHED');assert.equal(manifest.members.length,25);
 const source=json(options.manifestBytes),ivs=[...source.pages,...manifest.members].map(x=>x.iv);assert.equal(new Set(ivs).size,ivs.length);
 assert.ok(!before.includes(Buffer.from('Synthetic fixture')));assert.ok(!Object.hasOwn(manifest,'transcript'));
 for(const a of manifest.members){const b=await readFile(path.join(options.destination,a.file));assert.equal(sha(b),a.cipher_sha256);assert.ok(!b.includes(Buffer.from('Synthetic fixture')));assert.ok(!b.subarray(0,8).equals(v.files.get(v.assets[0].file).subarray(0,8)));}
 const again=await prepareEncryptedCMarvelCandidate(v,options);assert.equal(again.status,'UNCHANGED_VERIFIED');assert.ok(before.equals(await readFile(manifestPath)));
}));

test('wrong key cannot create a candidate',()=>privateCase(async(v,options)=>{
 await assert.rejects(prepareEncryptedCMarvelCandidate(v,{...options,passphrase:'wrong-synthetic-key'}));await assert.rejects(access(options.destination));
}));

test('cipher tampering blocks re-import',()=>privateCase(async(v,options)=>{
 await prepareEncryptedCMarvelCandidate(v,options);const m=json(await readFile(path.join(options.destination,'pair-manifest.json'))),file=path.join(options.destination,m.members[0].file),b=await readFile(file);b[0]^=1;await writeFile(file,b);
 await assert.rejects(prepareEncryptedCMarvelCandidate(v,options),/CIPHER_INTEGRITY/);
}));

test('another private package cannot replace an existing candidate',()=>privateCase(async(v,options)=>{
 await prepareEncryptedCMarvelCandidate(v,options);await assert.rejects(prepareEncryptedCMarvelCandidate({...v,package_sha256:'f'.repeat(64)},options),/IMMUTABLE_CANDIDATE_CONFLICT/);
}));

test('fixture cannot cross the production sealing boundary',()=>privateCase(async(v,options)=>{
 await assert.rejects(prepareEncryptedCMarvelCandidate(v,{...options,allowFixtures:false}),/SYNTHETIC_PRODUCTION_FORBIDDEN/);
}));

test('invalid original cipher pin blocks all output',()=>privateCase(async(v,options)=>{
 const damaged=Buffer.from(options.sourceCipher);damaged[0]^=1;await assert.rejects(prepareEncryptedCMarvelCandidate(v,{...options,sourceCipher:damaged}),/ORIGINAL_CIPHER_PIN/);await assert.rejects(access(options.destination));
}));

test('an existing output lock is respected',()=>privateCase(async(v,options)=>{
 await writeFile(options.destination+'.import.lock','other-writer');await assert.rejects(prepareEncryptedCMarvelCandidate(v,options),/EEXIST/);assert.equal((await readFile(options.destination+'.import.lock')).toString(),'other-writer');
}));

test('public output and a symlink into public are rejected',()=>privateCase(async(v,options,root)=>{
 const publicRoot=path.resolve(new URL('../public',import.meta.url).pathname);
 await assert.rejects(prepareEncryptedCMarvelCandidate(v,{...options,destination:path.join(publicRoot,'blocked-fixture-candidate')}),/PRIVATE_CANDIDATE_ONLY/);
 const alias=path.join(root,'public-alias');await symlink(publicRoot,alias,'dir');
 await assert.rejects(prepareEncryptedCMarvelCandidate(v,{...options,destination:path.join(alias,'blocked-fixture-candidate')}),/PRIVATE_CANDIDATE_ONLY/);
}));
