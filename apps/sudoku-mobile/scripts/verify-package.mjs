// Check generated web bytes actually copied into both native projects.
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const names=['bridge.js','icon.png','index.html'];
const read=p=>readFile(path.join(app,p));
assert.deepEqual((await readdir(path.join(app,'web'))).sort(),names,'Explicit offline runtime closure');
const result={schema:'8ZSUDOKU_NATIVE_ASSET_PARITY_V1',files:{}};
for(const name of names){
 const data=await read('web/'+name),hash=createHash('sha256').update(data).digest('hex');
 for(const platform of ['ios/App/App/public','android/app/src/main/assets/public'])assert.ok(data.equals(await read(platform+'/'+name)),platform+'/'+name);
 result.files[name]={bytes:data.length,sha256:hash,ios:true,android:true};
}
for(const configPath of ['ios/App/App/capacitor.config.json','android/app/src/main/assets/capacitor.config.json']){
 const config=JSON.parse(await read(configPath));
 assert.equal(config.appId,'org.chessbest.eightzsudoku');assert.equal(config.appName,'8zSudoku');assert.equal(config.webDir,'web');
 assert.deepEqual(config.server,{androidScheme:'https'},'Preserve installed origin configuration');
}
console.log(JSON.stringify(result,null,2));
