const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const repo=path.resolve(__dirname,'..'),base='9ab90a82c751ad527eeee763fffc61f3e1edab8c';
const read=p=>fs.readFileSync(path.join(repo,p),'utf8');
const git=(...args)=>execFileSync('git',args,{cwd:repo});
test('014 is an append-only Drive recovery stub; prior archive and promotion history is retained',()=>{
 const versions=JSON.parse(read('public/chess/versions.json')),before=JSON.parse(git('show',base+':public/chess/versions.json'));
 assert.deepEqual(versions.archives.slice(0,-1),before.archives);
 assert.deepEqual(versions.promotion_history.slice(0,-1),before.promotion_history);
 const latest=versions.archives.at(-1),receipt=JSON.parse(read('public/chess-lab/old/014/ARCHIVE_RECEIPT.json'));
 assert.equal(latest.id,'014');assert.equal(latest.source_commit,base);assert.equal(latest.source_tree,'6e63cf5a3a1dd6dc76bdea5d1d8ee7e537f2f612');
 assert.equal(receipt.verified_restore,true);assert.equal(receipt.drive_readback_verified,true);
 assert.equal(receipt.file_count,314);assert.equal(receipt.parts.length,7);assert.equal(latest.manifest_sha256,receipt.manifest_sha256);
 assert.deepEqual(fs.readdirSync(path.join(repo,'public/chess-lab/old/014')).sort(),['ARCHIVE_RECEIPT.json','index.html']);
 assert.equal(versions.latest_promotion.previous_root_preserved,true);
 assert.equal(versions.latest_installable_pwas.CURRENT.version,JSON.parse(read('public/chess/release.json')).version);
 // This is the immutable promotion receipt; LAB may develop after promotion.
 const promotedLab=JSON.parse(git('show',base+':public/chess-lab/release.json'));
 assert.equal(versions.latest_installable_pwas.LAB.version,promotedLab.version);
});
test('CURRENT exposes accepted controls and own storage without a channel selector or LAB redirect',()=>{
 const index=read('public/chess/index.html');
 for(const id of ['btnSim','btnReplay','btnDeepAnalysis','btnGames','chessPwaInstall','appTabs'])assert(index.includes('id="'+id+'"'),id);
 assert.match(index,/<body data-channel="current">/);
 assert.doesNotMatch(index,/<nav[^>]*class="(?:bd-version-selector|app-channel-nav|app-preview-nav)"/);
 assert.match(read('public/chess/js/8zc-lab-storage.js'),/ChessBest:CURRENT:v2:/);
 assert.match(read('public/chess/js/8zc-language.js'),/ChessBest:CURRENT:v2:language/);
 assert.match(read('public/chess/pwa.js'),/saveBeforeUpdate/);
});
test('all promoted engine and vendor payloads retain approved donor Git blob identities',()=>{
 const rows=git('ls-tree','-rz',base,'--','public/chess-lab/engines','public/chess-lab/vendor').toString().split('\0').filter(Boolean);
 for(const row of rows){
  const [meta,donor]=row.split('\t'),[mode,type,expected]=meta.split(' ');assert.equal(type,'blob');
  const target=donor.replace('public/chess-lab/','public/chess/'),bytes=fs.readFileSync(path.join(repo,target));
  const actual=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  assert.equal(actual,expected,target);if(mode==='100755')assert(fs.statSync(path.join(repo,target)).mode&0o100,target+' executable bit');
 }
});
