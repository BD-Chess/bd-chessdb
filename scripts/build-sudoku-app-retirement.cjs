'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),app=path.join(root,'public/S/app'),template=fs.readFileSync(path.join(__dirname,'sudoku-channel-worker.js'),'utf8'),check=process.argv.includes('--check');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=n=>fs.readFileSync(path.join(app,n));
const index=read('index.html'),direct=read('app.html');
if(index.compare(direct)!==0)throw Error('Retired APP index/app shells must be byte-identical');
if(index.includes('navigator-core')||index.includes('SudokuNavigator='))throw Error('Retired APP path must not contain gameplay');
const assets=['index.html','app.html','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png','../new/presentation/bootstrap.js'];
const digests=Object.fromEntries(assets.map(name=>[name,sha(fs.readFileSync(path.join(app,name)))]));
const meta={schema:'8ZSUDOKU_APP_RETIREMENT_V1',channel:'APP_RETIREMENT',target:'../new/?view=app',source_policy:'RECOVERY_AND_MIGRATION_ONLY_NO_GAMEPLAY',assets_sha256:digests,worker_runtime_sha256:sha(template)};
meta.release_id=sha(JSON.stringify(meta));
const worker=template.replace('const RELEASE = null;','const RELEASE = '+JSON.stringify({id:meta.release_id,channel:meta.channel,engine:'unified-lab',assets:digests},null,2)+';');
meta.worker_sha256=sha(worker);
for(const [name,text] of [['release.json',JSON.stringify(meta,null,2)+'\n'],['sw.js',worker]]){const target=path.join(app,name);if(check){if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==text)throw Error('Retired APP package stale: '+name);}else fs.writeFileSync(target,text);}
console.log('APP_RETIREMENT '+meta.release_id+' '+(check?'CHECK PASS':'packaged'));
