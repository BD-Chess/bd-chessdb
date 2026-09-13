import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root));
const manifest=JSON.parse(read('tests/fixtures/trip-old2-manifest.json'));
const withoutSelector = html => html
  .replace(/^[ \t]*<!-- BD VERSION SELECTOR STYLE START -->[\s\S]*?<!-- BD VERSION SELECTOR STYLE END -->\r?\n/m, '')
  .replace(/^[ \t]*<!-- BD VERSION SELECTOR START -->[\s\S]*?<!-- BD VERSION SELECTOR END -->\r?\n/m, '');

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
    if(file==='index.html') assert.equal(withoutSelector(read('public/Trip/'+file).toString()),withoutSelector(read('public/Trip/new/'+file).toString()));
    else assert.deepEqual(read('public/Trip/'+file),read('public/Trip/new/'+file),file);
  }
  for(const folder of ['','new/','old/','old/001/','old2/']) {
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
  for(const folder of ['','new/','old/','old/001/','old2/']) {
    assert.deepEqual(resolve('/trip/'+folder),['/Trip/'+folder+'index.html','200!']);
    for(const asset of ['app.js','worker.js','style.css']) {
      const [target,status]=resolve('/trip/'+folder+asset);
      assert.equal(status,'200!');assert.equal(target,'/Trip/'+folder+asset);
      assert.ok(read('public'+target).length>0);
    }
  }
});

test('all three channels link to each other with exactly one active channel',()=>{
  for(const [folder,active] of [['','CURRENT'],['old/','PREVIOUS'],['new/','LAB']]) {
    const html=read('public/Trip/'+folder+'index.html').toString();
    const nav=html.match(/<nav class="bd-versions"[^>]*>([\s\S]*?)<\/nav>/)[1];
    assert.equal((nav.match(/aria-current="page"/g)||[]).length,1);
    for(const [name,url] of [['CURRENT','/trip/'],['PREVIOUS','/trip/old/'],['LAB','/trip/new/']]) {
      assert.ok(nav.includes('<a href="'+url+'"'+(name===active?' aria-current="page"':'')+'>'+name+'</a>'));
    }
  }
});

test('archive 001 is the complete immutable previous release; previous adds only selector',()=>{
  const versions=JSON.parse(read('public/Trip/versions.json'));
  assert.equal(versions.nextArchive,'002');
  assert.equal(versions.archives[0].files.length,15);
  for(const entry of versions.archives[0].files) {
    const b=read('public/Trip/old/001/'+entry.path);
    assert.equal(createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex'),entry.gitBlobSha,entry.path);
    assert.deepEqual(b,read('public/Trip/old2/'+entry.path));
    const previous=read('public/Trip/old/'+entry.path);
    if(entry.path==='index.html') assert.equal(withoutSelector(previous.toString()),b.toString());
    else assert.deepEqual(previous,b);
  }
});
