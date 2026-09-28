import test from 'node:test';
import assert from 'node:assert/strict';
import { nextArchive, checkVersions } from '../../../tools/chess-versioning.mjs';
import { fileURLToPath } from 'node:url';
test('BD archives increment monotonically and never fill historical gaps',()=>{
  assert.equal(nextArchive([]),'001');
  assert.equal(nextArchive(['001','003','js','img']),'004');
  assert.equal(nextArchive(['999']),'1000');
  assert.throws(()=>nextArchive(['001','0001']),/Duplicate/);
});
test('CURRENT/PREVIOUS/LAB/PWA each link directly to all channels with one active marker',()=>{
  const result=checkVersions(fileURLToPath(new URL('../../../',import.meta.url)));
  assert.equal(result.ok,true,result.errors.join('\n'));
  assert.equal(result.promotionPerformed,false);
});
