/* API vault contract tests: no real passwords or provider secrets in fixtures. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const get=name=>fs.readFileSync(path.join(__dirname,'../public/AI8',name),'utf8');
test('encrypted vault has ten-provider format without readable credentials',()=>{
  const x=JSON.parse(get('api-check.vault.json'));
  assert.equal(x.schema,'bd-api-check-vault-v1');
  assert.equal(x.crypto,'8z-shield-v3-pbkdf2-aes256gcm');
  assert.equal(x.iterations,10000000);
  assert.equal(x.rounds,1024);
  const raw=Buffer.from(x.payload,'base64');
  assert(raw.length>60);
  assert.equal(raw.toString('utf8').includes('API_KEY'),false);
  assert.equal(raw.toString('utf8').includes('sk-'),false);
  assert.equal(raw.toString('utf8').includes('password'),false);
});
test('unlock UI is explicit and includes no background API invocation',()=>{
  const html=get('api-check.html'),js=get('api-check.js'),unlock=get('api-check-unlock.js');
  assert.match(html,/id="unlock-keys"/);
  assert.match(html,/id="vault-passphrase" type="password"/);
  assert.match(html,/api-check-unlock\.js/);
  assert.match(js,/BDAPIVault\.unlock\(passphrase\)/);
  assert.match(js,/Noben API test ni bil samodejno sprožen/);
  assert.match(js,/vaultPass\.value=''/);
  assert.match(unlock,/crypto\.subtle\.deriveBits/);
  assert.match(unlock,/AES-GCM/);
  assert.doesNotMatch(unlock,/bdai4ever/i);
  assert.doesNotMatch(html,/bdai4ever/i);
  assert.doesNotMatch(js,/bdai4ever/i);
  execFileSync(process.execPath,['--check',path.join(__dirname,'../public/AI8/api-check-unlock.js')]);
  execFileSync(process.execPath,['--check',path.join(__dirname,'../public/AI8/api-check.js')]);
});
