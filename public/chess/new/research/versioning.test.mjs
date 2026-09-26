import test from 'node:test';
import assert from 'node:assert/strict';
import { nextArchive, checkVersions } from '../../../../tools/chess-versioning.mjs';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
test('BD archives increment monotonically and never fill historical gaps',()=>{
  assert.equal(nextArchive([]),'001');
  assert.equal(nextArchive(['001','003','js','img']),'004');
  assert.equal(nextArchive(['999']),'1000');
  assert.throws(()=>nextArchive(['001','0001']),/Duplicate/);
});
test('CURRENT/PREVIOUS/LAB/PWA each link directly to all channels with one active marker',()=>{
  const result=checkVersions(fileURLToPath(new URL('../../../../',import.meta.url)));
  assert.equal(result.ok,true,result.errors.join('\n'));
  assert.equal(result.promotionPerformed,false);
});
test('PREVIOUS opens the brown v0.6.0 application at old/ without redirects',()=>{
  const root=fileURLToPath(new URL('../../../../public/chess/',import.meta.url));
  for(const [name,href] of [['index.html','./old/'],['new/index.html','../old/'],['PWA/index.html','../old/']]){
    assert.match(readFileSync(root+name,'utf8'),new RegExp(`href="${href.replaceAll('/','\\/')}"\>PREVIOUS`));
  }
  const html=readFileSync(root+'old/index.html','utf8');
  assert.doesNotMatch(html,/http-equiv="refresh"/);
  assert.doesNotMatch(html,/ARCHIVE 004/);
  assert.match(html,/<strong>v0\.6\.0<\/strong>/);
  assert.match(html,/href="\.\/" aria-current="page">PREVIOUS/);
  const css=readFileSync(root+'old/css/chessboard-1.0.0.min.css','utf8');
  assert.match(css,/#f0d9b5/);assert.match(css,/#b58863/);
});
test('PREVIOUS root contains the copied legacy app, and numbered snapshots remain sealed',()=>{
  const root=fileURLToPath(new URL('../../../../public/chess/old/',import.meta.url));
  const archive=JSON.parse(readFileSync(root+'004/ARCHIVE_MANIFEST.json','utf8'));
  const names=[];
  function walk(folder,prefix=''){
    for(const entry of readdirSync(folder,{withFileTypes:true})){
      if(!prefix && /^\d{3,}$/.test(entry.name))continue;
      const name=prefix+entry.name;
      if(entry.isDirectory())walk(folder+entry.name+'/',name+'/');
      else names.push(name);
    }
  }
  walk(root);
  assert.deepEqual(names.sort(),Object.keys(archive.file_sha256).sort(),'no green release files remain in old/');
  for(const [name,sha] of Object.entries(archive.file_sha256)){
    const archived=createHash('sha256').update(readFileSync(root+'004/'+name)).digest('hex');
    assert.equal(archived,sha,'archive untouched: '+name);
    if(!name.endsWith('.html')){
      const copy=createHash('sha256').update(readFileSync(root+name)).digest('hex');
      assert.equal(copy,sha,'legacy asset copied exactly: '+name);
    }
  }
});
