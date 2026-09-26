import test from 'node:test';
import assert from 'node:assert/strict';
import { nextArchive, checkVersions } from '../../../../tools/chess-versioning.mjs';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
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
test('PREVIOUS links lead to the preserved brown 004 release',()=>{
  const root=fileURLToPath(new URL('../../../../public/chess/',import.meta.url));
  for(const [name,href] of [['index.html','./old/004/'],['new/index.html','../old/004/'],['PWA/index.html','../old/004/']]){
    assert.match(readFileSync(root+name,'utf8'),new RegExp(`href="${href.replaceAll('/','\\/')}"\>PREVIOUS`));
  }
  const css=readFileSync(root+'old/004/css/chessboard-1.0.0.min.css','utf8');
  assert.match(css,/#f0d9b5/);assert.match(css,/#b58863/);
});
