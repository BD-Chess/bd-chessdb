import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {webcrypto,createHash} from 'node:crypto';
import {fromBase64,validateComicManifest,deriveComicKey,decryptComicBytes} from '../public/Nara/dualframe-lab/cmarvel-01/crypto.mjs';
import {FIRST_PAGE_SOURCE_SHA256,FIRST_PAGE_PANELS,sourceRect,readingPlace} from '../public/Nara/dualframe-lab/cmarvel-01/first-page.mjs';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.join(repo,'public/Nara/dualframe-lab');
const text=async p=>readFile(path.join(root,p),'utf8');
const bytes=async p=>readFile(path.join(root,p));
const sha=value=>createHash('sha256').update(value).digest('hex');
const [html,reader,cryptoCode,manifestText,dfcReader,sw,releaseText,sefExtraText,buildScript]=await Promise.all([
 text('cmarvel-01/index.html'),text('cmarvel-01/reader.mjs'),text('cmarvel-01/crypto.mjs'),text('cmarvel-01/manifest.json'),text('dfc-reader.mjs'),text('sw.js'),text('release.json'),readFile(path.join(repo,'public/BD/O/sef-extra.json'),'utf8'),readFile(path.join(repo,'scripts/build-cmarvel-protected.mjs'),'utf8')
]);
const manifest=JSON.parse(manifestText),release=JSON.parse(releaseText),comicDir=path.join(root,'cmarvel-01');

test('CMarvel has its own password gate and keeps passphrases client-side',()=>{
 assert.match(html,/type="password"[^>]*autocomplete="current-password"[^>]*data-bd-pm-skip="1"/);
 assert.match(html,/noindex,nofollow,noarchive,nosnippet,noimageindex/);
 assert.match(html,/frame-ancestors 'none'/);
 assert.match(reader,/credentials:'omit'/);assert.match(reader,/cache:'no-store'/);
 assert.match(reader,/key=null/);assert.match(reader,/sessionStorage|localStorage/,'progress only may be stored locally');
 assert.equal(Object.hasOwn(manifest,'password'),false);assert.equal(Object.hasOwn(manifest,'passphrase'),false);
});

test('the gallery card links to a separate, original CMarvel cover and protected reader',async()=>{
 assert.match(dfcReader,/new URL\('cmarvel-01\/',root\)/);assert.match(dfcReader,/content\/cmarvel-01\/cover\.webp/);
 const cover=await bytes('content/cmarvel-01/cover.webp');assert.equal(cover.toString('ascii',8,12),'WEBP');
 assert.match(html,/CMarvel 01/);assert.match(html,/comic-page/);assert.match(reader,/manifest_sha256/);
});

test('all eleven story pages are authenticated ciphertext; no source page is published',async()=>{
 validateComicManifest(manifest);assert.equal(manifest.pages.length,11);assert.equal(manifest.iterations,600000);
 const files=(await readdir(path.join(comicDir,'assets'))).filter(name=>/^CM_\d+\.webp\.enc$/.test(name)).sort();assert.equal(files.length,11);
 for(const page of manifest.pages){const cipher=await bytes(`cmarvel-01/${page.file}`);assert.equal(cipher.length,page.cipher_bytes);assert.equal(sha(cipher),page.cipher_sha256);assert.ok(cipher.length>16);}
 const contents=await readdir(comicDir);assert.ok(!contents.some(name=>/^CM_\d+\.webp$/i.test(name)));
});

test('page-one art review exposes six encrypted P/L pairs at native dimensions for BD selection',async()=>{
 validateComicManifest(manifest);const review=manifest.art_review;
 assert.equal(review.schema,'bd.dfc.cmarvel.art-review.v1');assert.equal(review.status,'UNREVIEWED');assert.equal(review.pairs.length,6);
 const files=(await readdir(path.join(comicDir,'assets/review'))).sort();assert.equal(files.length,12);assert.ok(files.every(name=>name.endsWith('.webp.enc')));
 for(let i=0;i<6;i++){
  const pair=review.pairs[i],id=`CM01-P01-K0${i+1}`;assert.equal(pair.panel_id,id);
  for(const [key,orientation] of [['portrait','P'],['landscape','L']]){
   const art=pair[key],cipher=await bytes(`cmarvel-01/${art.file}`);
   assert.equal(art.candidate,i===1||i===3||(i===5&&orientation==='P')?'A01':'A02');
   assert.equal(cipher.length,art.cipher_bytes);assert.equal(sha(cipher),art.cipher_sha256);
   assert.equal(art.orientation,orientation);assert.equal(art.mime,'image/webp');
   assert.deepEqual([art.width_px,art.height_px],orientation==='P'?[1584,2816]:[2816,1584]);
  }
 }
 assert.equal(release.protected_comic.art_review.pair_count,6);assert.equal(release.protected_comic.art_review.candidate_image_count,12);
 assert.equal(release.protected_comic.art_review.text_overlays,0);assert.match(html,/čakajo na tvojo oceno/i);
 assert.match(reader,/loadReviewArt/);assert.match(reader,/showPage\(place.page,place.panel,place.orientation,place.reviewMode\)/);
});

test('AES-GCM accepts valid ciphertext and rejects a wrong derived key',async()=>{
 const passphrase='unit-fixture-only',salt=webcrypto.getRandomValues(new Uint8Array(16)),iv=webcrypto.getRandomValues(new Uint8Array(12)),aad='DFC-CMARVEL-TEST';
 const key=await deriveComicKey(passphrase,salt,1200),wrong=await deriveComicKey('wrong-fixture-only',salt,1200),plain=new TextEncoder().encode('fixture comic page bytes');
 const material=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);
 const encryptKey=await webcrypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:1200},material,{name:'AES-GCM',length:256},false,['encrypt']);
 const cipher=await webcrypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(aad)},encryptKey,plain);
 const entry={iv:Buffer.from(iv).toString('base64'),aad};assert.deepEqual(await decryptComicBytes(cipher,key,entry),plain);
 await assert.rejects(decryptComicBytes(cipher,wrong,entry));
});

test('comic path is excluded from the offline app cache and header stays on current public Nara route',()=>{
 assert.match(sw,/cmarvel-01/);assert.match(sw,/request\.mode==='navigate'/);
 assert.match(sw,/cmarvel-01\/\*|cmarvel-01/);
 assert.equal(release.pwa.build_label,'2026-10-17-r4.23');assert.equal(release.release_revision,31);
 assert.match(sefExtraText,/20261017-cmarvel-v1/);
});

test('the protected comic is its own story-local state, without changing the public Nara story',()=>{
 assert.match(reader,/bd\.dfc\.reader\.v1:CMARVEL_01/);
 assert.equal(release.cartoons?.story_id,'ILLUMINARA_TEZA_SVETLOBE_01');
 assert.equal(release.cartoons?.page_count,8);assert.equal(release.cartoons?.pair_count,39);
 assert.match(buildScript,/CMARVEL_ART_REVIEW_PASSWORD_MISMATCH/);assert.match(buildScript,/art_review:previousReview/);assert.match(buildScript,/protected_comic\.manifest_sha256=hash\(manifestBytes\)/);
});

test('first-page source geometry is bounded, stable and honestly separate from P/L generation',()=>{
 assert.equal(FIRST_PAGE_SOURCE_SHA256,'fa1b62a0c1fdf9416f5283c4a81ea06680c4201e84e95559ab75a320aad1394f');
 assert.equal(FIRST_PAGE_PANELS.length,6);assert.deepEqual(sourceRect(0),[514,0,2812,2160]);
 const expected=[[2806,1470],[470,650],[880,650],[475,650],[440,650],[526,650]];
 for(let i=0;i<6;i++){const [x,y,w,h]=sourceRect(0,i);assert.ok(x>=0&&y>=0&&x+w<=3840&&y+h<=2160);assert.deepEqual([w,h],expected[i]);assert.equal(FIRST_PAGE_PANELS[i].id,`CM01-P01-K0${i+1}`);}
 for(const input of [[-1,null],[11,null],[0,-1],[0,6],[1,0],[0,'1']])assert.throws(()=>sourceRect(...input));
 assert.deepEqual(sourceRect(10),[0,0,3840,2160]);assert.equal(release.protected_comic.source_review.generated_pair_count,0);assert.equal(release.protected_comic.art_review.pair_count,6);
});

test('old page bookmarks, new first-page bookmarks and explicit review links remain distinct',()=>{
 assert.deepEqual(readingPlace({page:7}),{page:7,panel:null});
 assert.deepEqual(readingPlace({page:0,panel:5}),{page:0,panel:5});
 assert.deepEqual(readingPlace({page:7,panel:5}),{page:7,panel:null});
 assert.deepEqual(readingPlace({page:7},'?page=1'),{page:0,panel:null});
 assert.deepEqual(readingPlace({page:0,panel:12}),{page:0,panel:null});
 assert.deepEqual(readingPlace({page:-1},'?page=99'),{page:0,panel:null});
});
