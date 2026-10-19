import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {FIRST_PAGE_SOURCE_SHA256,FIRST_PAGE_PANELS,sourceRect,readingPlace} from '../public/Nara/dualframe-lab/cmarvel-01/first-page.mjs';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.join(repo,'public/Nara/dualframe-lab');
const bytes=async p=>readFile(path.join(root,p));
const sha=value=>createHash('sha256').update(value).digest('hex');
const [html,reader,manifestText,dfcReader,sw,releaseText]=await Promise.all([
 readFile(path.join(root,'cmarvel-01/index.html'),'utf8'),
 readFile(path.join(root,'cmarvel-01/reader.mjs'),'utf8'),
 readFile(path.join(root,'cmarvel-01/manifest.json'),'utf8'),
 readFile(path.join(root,'dfc-reader.mjs'),'utf8'),
 readFile(path.join(root,'sw.js'),'utf8'),
 readFile(path.join(root,'release.json'),'utf8')
]);
const manifest=JSON.parse(manifestText),release=JSON.parse(releaseText),comicDir='cmarvel-01';

test('CMarvel opens directly without a password gate',()=>{
 assert.match(html,/<title>CMarvel 01 · R&amp;D predogled<\/title>/);
 assert.match(html,/R&amp;D · JAVNI PREDOGLED/);
 assert.ok(html.includes("reader.mjs?v=32"));
 assert.doesNotMatch(html,/type=["']password|gate-form|passphrase|Odpri strip|Zakleni strip/i);
 assert.doesNotMatch(reader,/passphrase|deriveComicKey|decryptComicBytes|unlockStory|gate-form|lockStory/i);
 assert.match(html,/noindex,nofollow,noarchive,nosnippet,noimageindex/);
 assert.match(html,/frame-ancestors 'none'/);
 assert.match(reader,/credentials:'omit'/);
 assert.match(reader,/cache:'no-store'/);
 assert.match(reader,/comic_preview/);
 assert.equal(Object.hasOwn(release,'protected_comic'),false);
});

test('the gallery card still opens the standalone CMarvel reader and cover',async()=>{
 assert.match(dfcReader,/new URL\('cmarvel-01\/',root\)/);
 assert.match(dfcReader,/content\/cmarvel-01\/cover\.webp/);
 const cover=await bytes('content/cmarvel-01/cover.webp');
 assert.equal(cover.toString('ascii',8,12),'WEBP');
 assert.match(html,/comic-page/);
});

test('the public manifest is pinned in the release record and lists all 11 source pages',async()=>{
 assert.equal(manifest.schema,'bd.dfc.public-comic.v1');
 assert.equal(manifest.story_id,'CMARVEL_01');
 assert.equal(manifest.access,'PUBLIC_RND_PREVIEW');
 assert.equal(manifest.pages.length,11);
 assert.equal(release.comic_preview.manifest_sha256,sha(Buffer.from(manifestText)));
 for(let i=0;i<manifest.pages.length;i++){
  const page=manifest.pages[i],id='CM_'+String(i+1).padStart(2,'0');
  assert.equal(page.page_id,id);
  assert.equal(page.file,'assets/'+id+'.webp');
  assert.equal(page.mime,'image/webp');
  assert.deepEqual([page.width_px,page.height_px],[3840,2160]);
  const image=await bytes(comicDir+'/'+page.file);
  assert.equal(image.length,page.bytes);
  assert.equal(sha(image),page.sha256);
  assert.equal(image.toString('ascii',0,4),'RIFF');
  assert.equal(image.toString('ascii',8,12),'WEBP');
 }
 assert.equal(release.comic_preview.page_count,11);
 assert.equal(release.comic_preview.plaintext_media_in_public_release,true);
});

test('six unreviewed P/L image pairs are publicly readable at their recorded dimensions',async()=>{
 const review=manifest.art_review;
 assert.equal(review.schema,'bd.dfc.cmarvel.art-review.v1');
 assert.equal(review.status,'UNREVIEWED');
 assert.equal(review.pairs.length,6);
 for(let i=0;i<6;i++){
  const pair=review.pairs[i],id='CM01-P01-K0'+(i+1);
  assert.equal(pair.panel_id,id);
  for(const [key,orientation,size] of [['portrait','P',[1584,2816]],['landscape','L',[2816,1584]]]){
   const art=pair[key],filename='assets/review/'+id+'-'+orientation+'.webp';
   assert.equal(art.file,filename);
   assert.equal(art.orientation,orientation);
   assert.deepEqual([art.width_px,art.height_px],size);
   assert.ok(['A01','A02'].includes(art.candidate));
   const image=await bytes(comicDir+'/'+filename);
   assert.equal(image.length,art.bytes);
   assert.equal(sha(image),art.sha256);
   assert.equal(image.toString('ascii',0,4),'RIFF');
   assert.equal(image.toString('ascii',8,12),'WEBP');
  }
 }
 assert.equal(release.comic_preview.art_review.pair_count,6);
 assert.equal(release.comic_preview.art_review.candidate_image_count,12);
 assert.equal(release.comic_preview.art_review.text_overlays,0);
 assert.equal(release.comic_preview.art_review.acceptance,'pending BD visual selection');
 assert.match(html,/čak[aą] na tvoj pregled/i);
});

test('page-one crop coordinates and saved reading positions remain bounded',()=>{
 assert.equal(FIRST_PAGE_SOURCE_SHA256,'fa1b62a0c1fdf9416f5283c4a81ea06680c4201e84e95559ab75a320aad1394f');
 assert.equal(FIRST_PAGE_PANELS.length,6);
 assert.deepEqual(sourceRect(0),[514,0,2812,2160]);
 const expected=[[2806,1470],[470,650],[880,650],[475,650],[440,650],[526,650]];
 for(let i=0;i<6;i++){const [x,y,w,h]=sourceRect(0,i);assert.ok(x>=0&&y>=0&&x+w<=3840&&y+h<=2160);assert.deepEqual([w,h],expected[i]);assert.equal(FIRST_PAGE_PANELS[i].id,'CM01-P01-K0'+(i+1));}
 for(const input of [[-1,null],[11,null],[0,-1],[0,6],[1,0],[0,'1']])assert.throws(()=>sourceRect(...input));
 assert.deepEqual(sourceRect(10),[0,0,3840,2160]);
 assert.deepEqual(readingPlace({page:7}),{page:7,panel:null});
 assert.deepEqual(readingPlace({page:0,panel:5}),{page:0,panel:5});
 assert.deepEqual(readingPlace({page:7,panel:5}),{page:7,panel:null});
 assert.deepEqual(readingPlace({page:7},'?page=1'),{page:0,panel:null});
 assert.deepEqual(readingPlace({page:0,panel:12}),{page:0,panel:null});
 assert.deepEqual(readingPlace({page:-1},'?page=99'),{page:0,panel:null});
});

test('CMarvel remains outside the service-worker cache',()=>{
 assert.match(sw,/cmarvel-01/);
 assert.match(sw,/request\.mode==='navigate'/);
});
