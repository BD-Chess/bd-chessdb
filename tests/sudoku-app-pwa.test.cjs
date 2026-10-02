'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const dir='public/S/app/',read=n=>fs.readFileSync(dir+n),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
test('retired APP package is recovery-only and internally hashed',()=>{
 const r=JSON.parse(read('release.json'));assert.equal(r.schema,'8ZSUDOKU_APP_RETIREMENT_V1');assert.equal(r.channel,'APP_RETIREMENT');assert.equal(r.target,'../new/?view=app');
 for(const [name,digest] of Object.entries(r.assets_sha256))assert.equal(hash(fs.readFileSync(dir+name)),digest,name);
 assert.equal(hash(read('sw.js')),r.worker_sha256);
 const html=read('index.html').toString();assert.doesNotMatch(html,/navigator-core|SudokuNavigator=/);assert.match(html,/Export old APP\/PWA data/);
});
