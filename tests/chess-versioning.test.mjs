import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {checkVersions} from '../tools/chess-versioning.mjs';

function fixture(t){
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'chess-archive-gate-'));
  t.after(()=>fs.rmSync(repo,{recursive:true,force:true}));
  const put=(p,value)=>{const f=path.join(repo,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof value==='object'?JSON.stringify(value):value);};
  for(const channel of ['chess','chess-lab']){
    put('public/'+channel+'/index.html',channel==='chess'?'<link rel="manifest" href="manifest.webmanifest">':'<link rel="manifest" href="manifest.webmanifest"><nav class="bd-version-selector"><a href="../chess/">CURRENT</a><a href="./old/">PREVIOUS</a><a href="./" aria-current="page">LAB</a></nav>');
    put('public/'+channel+'/manifest.webmanifest',{id:'./',start_url:'./',scope:'./'});put('public/'+channel+'/sw.js','worker');
  }
  for(const p of ['old','old/app','old/lab','old/001'])put('public/chess-lab/'+p+'/index.html','sealed '+p);
  const versions={current:'/chess/',lab:'/chess-lab/',previous:'/chess-lab/old/',installable_channels:{CURRENT:'/chess/',LAB:'/chess-lab/'},archives:[]};
  const save=()=>put('public/chess/versions.json',versions);save();
  const git=(...args)=>execFileSync('git',args,{cwd:repo,stdio:'pipe'}).toString().trim();
  git('init','-q');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','sealed base');
  const base=git('rev-parse','HEAD');
  const add=(id='002')=>{
    const receipt={schema:'chessbest-drive-archive-receipt/1',archive_id:id,source_channel:'CURRENT',source_commit:'a'.repeat(40),source_tree:'b'.repeat(40),manifest_sha256:'c'.repeat(64),manifest_drive_id:'manifest'.repeat(4),verified_restore:true,drive_readback_verified:true,file_count:314,uncompressed_bytes:378655114,parts:[{drive_id:'part'.repeat(8),bytes:100,sha256:'d'.repeat(64)}]};
    versions.archives.push({id,path:'/chess-lab/old/'+id+'/',source_channel:'CURRENT',source_commit:receipt.source_commit,source_tree:receipt.source_tree,manifest_sha256:receipt.manifest_sha256,manifest_drive_id:receipt.manifest_drive_id});
    versions.latest_promotion={previous_current_archive:id,backup_created:true};save();
    put('public/chess-lab/old/'+id+'/index.html','new Drive recovery stub');put('public/chess-lab/old/'+id+'/ARCHIVE_RECEIPT.json',receipt);
    return receipt;
  };
  return {repo,base,put,add,versions,save,check:()=>checkVersions(repo,base)};
}
test('base archives pass; declared next Drive stub passes without reopening a sealed ID',t=>{
  const f=fixture(t);assert.equal(f.check().ok,true);f.add();assert.equal(f.check().ok,true);
});
for(const action of ['modify','delete','add'])test('sealed old archive rejects '+action,t=>{
  const f=fixture(t);f.add();
  if(action==='modify')f.put('public/chess-lab/old/001/index.html','changed');
  if(action==='delete')fs.unlinkSync(path.join(f.repo,'public/chess-lab/old/001/index.html'));
  if(action==='add')f.put('public/chess-lab/old/001/extra.html','extra');
  assert.equal(f.check().ok,false);assert(f.check().errors.some(e=>e.includes('001/')));
});
test('new stub rejects skipped number, missing verification, undeclared files and metadata mismatch',t=>{
  const skipped=fixture(t);skipped.add('003');assert.equal(skipped.check().ok,false);
  const missing=fixture(t),r=missing.add();r.drive_readback_verified=false;missing.put('public/chess-lab/old/002/ARCHIVE_RECEIPT.json',r);assert.equal(missing.check().ok,false);
  const extra=fixture(t);extra.add();extra.put('public/chess-lab/old/002/payload.js','unexpected');assert.equal(extra.check().ok,false);
  const mismatch=fixture(t);mismatch.add();mismatch.versions.archives[0].source_tree='e'.repeat(40);mismatch.save();assert.equal(mismatch.check().ok,false);
});
