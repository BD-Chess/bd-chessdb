import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root));
const manifest=JSON.parse(read('tests/fixtures/trip-old2-manifest.json'));

test('old2 preserves every prior primary file, byte for byte',()=>{
  assert.equal(manifest.files.length,15);
  for(const entry of manifest.files) {
    const b=read(entry.path);
    const sha=createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
    assert.equal(sha,entry.sha,entry.path);
  }
});

test('primary serves the verified current frontend and its relative assets',()=>{
  for(const file of readdirSync(new URL('public/Trip/new/',root))) {
    assert.deepEqual(read('public/Trip/'+file),read('public/Trip/new/'+file),file);
  }
  for(const folder of ['','new/','old2/']) {
    const html=read('public/Trip/'+folder+'index.html').toString();
    const relative=[...html.matchAll(/(?:src|href)="([^"?:#]+)(?:\?[^"#]*)?"/g)].map(m=>m[1]).filter(v=>!v.includes(':')&&!v.startsWith('/'));
    assert.ok(relative.length>=5);
    for(const file of relative) assert.ok(read('public/Trip/'+folder+file).length>0);
  }
});

test('route rewrites keep archived and preview assets separate from primary assets',()=>{
  const rules=read('public/_redirects').toString().split('\n').map(s=>s.trim().split(/\s+/)).filter(r=>r[0].startsWith('/trip'));
  function resolve(path) {
    path=path.replace(/\/$/,'');
    for(const [from,to,status] of rules) {
      if(from.endsWith('/*')&&path.startsWith(from.slice(0,-1))) return [to.replace(':splat',path.slice(from.length-1)),status];
      if(from.replace(/\/$/,'')===path)return [to,status];
    }
  }
  for(const folder of ['','new/','old2/']) {
    assert.deepEqual(resolve('/trip/'+folder),['/Trip/'+folder+'index.html','200!']);
    for(const asset of ['app.js','worker.js','style.css']) {
      const [target,status]=resolve('/trip/'+folder+asset);
      assert.equal(status,'200!');assert.equal(target,'/Trip/'+folder+asset);
      assert.ok(read('public'+target).length>0);
    }
  }
});
