import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {webcrypto,createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'..');
const sourceArg=process.argv[2];
const source=sourceArg?path.resolve(sourceArg):'';
const comicDir=path.join(repo,'public/Nara/dualframe-lab/cmarvel-01');
const vaultDir=path.join(repo,'public/BD/O');
const te=new TextEncoder(),td=new TextDecoder('utf-8',{fatal:true}),subtle=webcrypto.subtle;
const hash=data=>createHash('sha256').update(data).digest('hex');
const b64=data=>Buffer.from(data).toString('base64');
const un64=value=>new Uint8Array(Buffer.from(value,'base64'));
const readJson=async file=>JSON.parse(await readFile(file,'utf8'));
const readSecrets=async()=>{
 let line='';
 for await(const chunk of process.stdin){line+=chunk;if(line.includes('\n'))break;}
 try{return JSON.parse(line.slice(0,line.indexOf('\n')<0?undefined:line.indexOf('\n')));}catch{throw Error('SECRET_INPUT_INVALID');}
};
const escapeHtml=value=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function inflateGzip(bytes){return new Uint8Array(gunzipSync(bytes));}
async function derive(password,salt,iterations){
 const material=await subtle.importKey('raw',te.encode(password),'PBKDF2',false,['deriveKey']);
 return subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations},material,{name:'AES-GCM',length:256},false,['decrypt','encrypt']);
}
async function openAES(key,iv,aad,cipher){return new Uint8Array(await subtle.decrypt({name:'AES-GCM',iv,additionalData:te.encode(aad)},key,cipher));}
async function loadEncryptedConfig({config,configPath,plainFormat,expectedAad,key}){
 const encoded=await readFile(path.join(vaultDir,config.data.path),'utf8');
 if(hash(te.encode(encoded))!==config.data.sha256)throw Error('SEF_CIPHERTEXT_HASH_INVALID');
 const packed=await openAES(key,un64(config.cipher.iv),expectedAad,un64(encoded));
 const plain=config.compression==='gzip'?inflateGzip(packed):packed;
 if(hash(plain)!==config.plaintext_sha256)throw Error('SEF_PLAINTEXT_HASH_INVALID');
 const obj=JSON.parse(td.decode(plain));
 if(obj.format!==plainFormat||typeof obj.html!=='string')throw Error('SEF_PAYLOAD_INVALID');
 return {obj,plain};
}

if(!source||!path.isAbsolute(source))throw Error('SOURCE_DIRECTORY_REQUIRED');
const {vaultPassword,comicPassword}=await readSecrets();
if(typeof vaultPassword!=='string'||!vaultPassword||typeof comicPassword!=='string'||!comicPassword)throw Error('PASSWORDS_REQUIRED');
let previousComic=null;
try{previousComic=await readJson(path.join(comicDir,'manifest.json'));}catch(error){if(error.code!=='ENOENT')throw error;}
const previousReview=previousComic?.art_review;let retainedSalt=null,retainedIterations=600000;
if(previousReview){
 if(previousComic.story_id!=='CMARVEL_01'||previousReview.schema!=='bd.dfc.cmarvel.art-review.v1'||previousReview.pairs?.length!==6)throw Error('CMARVEL_ART_REVIEW_MANIFEST_INVALID');
 retainedSalt=un64(previousComic.salt);retainedIterations=previousComic.iterations;
 const previousKey=await derive(comicPassword,retainedSalt,retainedIterations);
 for(let i=0;i<6;i++){
  const pair=previousReview.pairs[i],panelId=`CM01-P01-K${String(i+1).padStart(2,'0')}`;
  if(pair.panel_id!==panelId)throw Error('CMARVEL_ART_REVIEW_PANEL_INVALID');
  for(const [orientation,key] of [['P','portrait'],['L','landscape']]){
   const asset=pair[key],filename=`${panelId}-${orientation}.webp`;
   if(asset?.file!==`assets/review/${filename}.enc`||asset.aad!==`DFC-CMARVEL-01:art-review-v1:${filename}`)throw Error('CMARVEL_ART_REVIEW_ASSET_INVALID');
   const encrypted=await readFile(path.join(comicDir,asset.file));
   if(encrypted.length!==asset.cipher_bytes||hash(encrypted)!==asset.cipher_sha256)throw Error('CMARVEL_ART_REVIEW_CIPHERTEXT_INVALID');
   let plain;try{plain=await openAES(previousKey,un64(asset.iv),asset.aad,encrypted);}catch{throw Error('CMARVEL_ART_REVIEW_PASSWORD_MISMATCH');}
   if(hash(plain)!==asset.payload_sha256)throw Error('CMARVEL_ART_REVIEW_PLAINTEXT_INVALID');
  }
 }
}
const vault=await readJson(path.join(vaultDir,'vault.json'));
if(vault.format!=='BD-O-VAULT-2'||vault.kdf?.iterations<600000)throw Error('VAULT_CONFIG_INVALID');
const kek=await derive(vaultPassword,un64(vault.kdf.salt),vault.kdf.iterations);
let rawMaster;
try{rawMaster=await openAES(kek,un64(vault.wrap.iv),`BD/O:v2:wrap:${vault.vault}`,un64(vault.wrap.cipher));}
catch{throw Error('VAULT_PASSWORD_OR_CIPHERTEXT_INVALID');}
const master=await subtle.importKey('raw',rawMaster,'AES-GCM',false,['decrypt','encrypt']);
const sefConfig=await readJson(path.join(vaultDir,'sef-config.json'));
if(sefConfig.format!=='BD-O-SEF-2'||sefConfig.vault!==vault.vault)throw Error('SEF_CONFIG_INVALID');
const sefParts=await Promise.all(sefConfig.data.parts.map(async part=>{
 const content=await readFile(path.join(vaultDir,part.path),'utf8');
 if(hash(te.encode(content))!==part.sha256)throw Error('SEF_SOURCE_INTEGRITY_FAILED');
 return content;
}));
const sefEncoded=sefParts.join('');
if(hash(te.encode(sefEncoded))!==sefConfig.data.sha256)throw Error('SEF_SOURCE_INTEGRITY_FAILED');
const sefPlain=await openAES(master,un64(sefConfig.cipher.iv),sefConfig.cipher.aad,un64(sefEncoded));
if(hash(inflateGzip(sefPlain))!==sefConfig.plaintext_sha256)throw Error('SEF_PASSWORD_CHECK_FAILED');

const oldExtraConfig=await readJson(path.join(vaultDir,'sef-extra.json'));
if(oldExtraConfig.format!=='BD-O-SEF-EXTRA-CONFIG-1'||oldExtraConfig.vault!==vault.vault)throw Error('SEF_EXTRA_CONFIG_INVALID');
const {obj:oldExtra}=await loadEncryptedConfig({config:oldExtraConfig,plainFormat:'BD-O-SEF-EXTRA-1',expectedAad:oldExtraConfig.cipher.aad,key:master});
if(oldExtra.html.includes('CMARVEL_01_PASSWORD_ENTRY'))throw Error('SEF_ENTRY_ALREADY_PRESENT');
const secretEntry=`<article data-sef-category="other" data-sef-entry="CMARVEL_01_PASSWORD_ENTRY"><h2>CMarvel 01 · zasebni strip</h2><p>Geslo za zasebni CMarvel 01:</p><p><code class="secret-value" tabindex="0">${escapeHtml(comicPassword)}</code></p><p class="small">Vnos je prikazan šele po odklepu Sefa. Kopiraj ga samo na svoji napravi.</p></article>`;
oldExtra.html+=secretEntry;
const extraBytes=te.encode(JSON.stringify(oldExtra));
const extraPacked=gzipSync(extraBytes,{level:9});
const extraIv=webcrypto.getRandomValues(new Uint8Array(12));
const extraAad=`BD/O:sef-extra:v1:${vault.vault}`;
const extraCipher=new Uint8Array(await subtle.encrypt({name:'AES-GCM',iv:extraIv,additionalData:te.encode(extraAad)},master,extraPacked));
const extraEncoded=b64(extraCipher),extraName='sef-extra-20261017-cmarvel-v1.enc.txt';
await writeFile(path.join(vaultDir,extraName),extraEncoded+'\n');
const newExtraConfig={format:'BD-O-SEF-EXTRA-CONFIG-1',release:'20261017-cmarvel-v1',vault:vault.vault,compression:'gzip',cipher:{alg:'AES-256-GCM',iv:b64(extraIv),aad:extraAad},plaintext_sha256:hash(extraBytes),data:{path:extraName,sha256:hash(te.encode(extraEncoded+'\n'))}};
await writeFile(path.join(vaultDir,'sef-extra.json'),JSON.stringify(newExtraConfig,null,2)+'\n');

const iterations=previousReview?retainedIterations:600000,salt=retainedSalt??webcrypto.getRandomValues(new Uint8Array(16));
const storyKey=await derive(comicPassword,salt,iterations);
await mkdir(path.join(comicDir,'assets'),{recursive:true});
const pages=[];
for(let i=1;i<=11;i++){
 const pageId=`CM_${String(i).padStart(2,'0')}`,filename=pageId+'.webp';
 const plain=await readFile(path.join(source,filename));
 const iv=webcrypto.getRandomValues(new Uint8Array(12));
 const aad=`DFC-CMARVEL-01:v1:${filename}`;
 const encrypted=new Uint8Array(await subtle.encrypt({name:'AES-GCM',iv,additionalData:te.encode(aad)},storyKey,plain));
 const file=`assets/${filename}.enc`;
 const outPath=path.join(comicDir,file);
 await writeFile(outPath,encrypted);
 const verification=await openAES(storyKey,iv,aad,encrypted);
 if(!Buffer.from(verification).equals(plain))throw Error('COMIC_ENCRYPTION_VERIFY_FAILED');
 pages.push({page_id:pageId,file,iv:b64(iv),aad,mime:'image/webp',width_px:3840,height_px:2160,cipher_sha256:hash(encrypted),cipher_bytes:encrypted.length});
}
const manifest={schema:'bd.dfc.protected-comic.v1',story_id:'CMARVEL_01',version:1,protection:'PBKDF2-SHA-256 + AES-256-GCM',iterations,salt:b64(salt),pages,...(previousReview?{art_review:previousReview}:{})};
const manifestBytes=te.encode(JSON.stringify(manifest,null,2)+'\n');
await writeFile(path.join(comicDir,'manifest.json'),manifestBytes);
const releasePath=path.join(repo,'public/Nara/dualframe-lab/release.json'),release=await readJson(releasePath);
if(release.protected_comic?.story_id!=='CMARVEL_01')throw Error('CMARVEL_RELEASE_METADATA_INVALID');
release.protected_comic.manifest_sha256=hash(manifestBytes);
await writeFile(releasePath,JSON.stringify(release,null,2)+'\n');
rawMaster.fill(0);
console.log(JSON.stringify({status:'PROTECTED_ASSETS_BUILT',story_pages:pages.length,ciphertext_bytes:pages.reduce((sum,p)=>sum+p.cipher_bytes,0),comic_manifest_sha256:hash(manifestBytes),sef_extra_release:newExtraConfig.release,sef_entry_added:true,plaintext_passwords_written:false}));
