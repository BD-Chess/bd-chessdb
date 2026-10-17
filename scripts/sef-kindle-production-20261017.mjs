// One owner-authorized encrypted Sef correction. Never reads or writes plaintext secrets.
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const site='17b4124d-c197-4c0a-a711-8b2c08d91088';
const expectedDeploy='6ad2c372674de74206292aa2';
const preservedGitBaseline='95905176c313c2c3577d242bb55d5d3e2af594d2';
const token=process.env.NETLIFY_AUTH_TOKEN;
assert(token,'NETLIFY_CREDENTIAL_MISSING');
const names=['sef.js','sef-kindle.json','sef-kindle-20261017-r1.enc.txt'];
const digest=(bytes,algorithm='sha256')=>createHash(algorithm).update(bytes).digest('hex');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const api=async(path,{method='GET',body,binary=false}={})=>{
 const response=await fetch('https://api.netlify.com/api/v1/'+path,{
  method,headers:{authorization:'Bearer '+token,...(body?{'content-type':binary?'application/octet-stream':'application/json'}:{})},
  body:body?(binary?body:JSON.stringify(body)):undefined,signal:AbortSignal.timeout(60000)
 });
 assert(response.ok,'NETLIFY_API_'+response.status);
 return response.json();
};
const mapFiles=rows=>{
 assert(Array.isArray(rows)&&rows.length>100,'INCOMPLETE_PRODUCTION_FILE_LIST');
 const files={};
 for(const row of rows){
  assert(typeof row.path==='string'&&/^[a-f0-9]{40}$/.test(row.sha),'INVALID_FILE_DIGEST');
  const path=row.path.replace(/^\//,'');assert(!Object.hasOwn(files,path),'DUPLICATE_FILE_PATH');files[path]=row.sha;
 }
 assert(Object.keys(files).some(p=>p.toLowerCase()==='bd/o/sef.js'),'SEF_NOT_IN_PRODUCTION_MANIFEST');
 assert(Object.hasOwn(files,'netlify.toml'),'DEPLOY_CONFIG_NOT_IN_MANIFEST');
 return files;
};
const listFiles=async()=>{
 const rows=[];
 for(let page=1;page<=40;page++){
  const batch=await api('sites/'+site+'/files?per_page=1000&page='+page);
  assert(Array.isArray(batch),'INVALID_FILE_LIST');rows.push(...batch);
  if(batch.length<1000){
   console.log(JSON.stringify({stage:'production-file-inventory',files:rows.length,pages:page,sef_paths:rows.filter(r=>/sef\.js$/i.test(r.path)).map(r=>r.path)}));
   return mapFiles(rows);
  }
 }
 throw Error('PRODUCTION_FILE_PAGINATION_LIMIT');
};
const publicBytes=async name=>{
 const response=await fetch('https://www.mdlxdcc.org/BD/O/'+name,{cache:'no-store',signal:AbortSignal.timeout(30000)});
 assert(response.ok,'LIVE_ASSET_UNAVAILABLE');return Buffer.from(await response.arrayBuffer());
};
const functionConfig=f=>{
 const cfg={};
 for(const [short,long] of [['dn','display_name'],['g','generator'],['bd','build_data'],['m','memory'],['p','priority'],['tr','traffic_rules']]){
  if(f[short]!==null&&f[short]!==undefined)cfg[long]=f[short];
 }
 if(f.ro)cfg.routes=f.ro.map(r=>Object.fromEntries(Object.entries({pattern:r.p,literal:r.l,expression:r.e,methods:r.m,prefer_static:r.ps}).filter(([,v])=>v!==null&&v!==undefined)));
 if(f.er)cfg.excluded_routes=f.er;
 return cfg;
};
const functionState=deploy=>(deploy.available_functions||[]).map(f=>({name:f.n,sha:f.d,runtime:f.r,mode:f.im,region:f.rg,...functionConfig(f)})).sort((a,b)=>a.name.localeCompare(b.name));
const waitFor=async(id,states)=>{
 for(let n=0;n<90;n++){
  const deploy=await api('deploys/'+id);
  assert(deploy.state!=='error','DEPLOY_FAILED');if(states.includes(deploy.state))return deploy;
  await sleep(3000);
 }
 throw Error('DEPLOY_TIMEOUT');
};

const initialSite=await api('sites/'+site);
assert(initialSite.published_deploy?.id===expectedDeploy,'PRODUCTION_LEASE_CHANGED');
const before=await api('deploys/'+expectedDeploy);
assert(!before.edge_functions_present&&!before.server,'UNSUPPORTED_DEPLOY_COMPONENT');
const files=await listFiles();
const existingFiles={...files};
const sefPath=Object.keys(files).find(p=>p.toLowerCase()==='bd/o/sef.js');
const targetRoot=sefPath.slice(0,-'sef.js'.length);
const originals=Object.fromEntries(await Promise.all(names.map(async name=>[name,await readFile('public/BD/O/'+name)])));
const cfg=JSON.parse(originals['sef-kindle.json']);
assert.equal(cfg.format,'BD-O-SEF-EXTRA-CONFIG-1');assert.equal(cfg.release,'20261017-kindle-r1');
assert.equal(cfg.vault,JSON.parse(await readFile('public/BD/O/vault.json','utf8')).vault);
assert.equal(cfg.data.path,names[2]);assert.equal(digest(originals[names[2]]),cfg.data.sha256);
// A newer production Sef change must be reconciled, never overwritten.
assert.equal(files[sefPath],'e86c71e1746153ec049afd4fe0d3820997f1da3c','PRODUCTION_SEF_CHANGED');
for(const name of names){
 const path=targetRoot+name,newSha=digest(originals[name],'sha1');
 if(name!=='sef.js'&&Object.hasOwn(files,path))assert.equal(files[path],newSha,'EXISTING_OVERLAY_CONFLICT');
 files[path]=newSha;
}
const functions=Object.fromEntries((before.available_functions||[]).map(f=>[f.n,f.d]));
assert(Object.keys(functions).length===25,'UNEXPECTED_FUNCTION_INVENTORY');
const functions_config=Object.fromEntries(before.available_functions.map(f=>[f.n,functionConfig(f)]));
for(const [name,config] of Object.entries(functions_config)){
 config.region=before.functions_region_overrides?.find(r=>r.name===name)?.region||before.functions_region;
}
assert.equal((await api('sites/'+site)).published_deploy.id,expectedDeploy,'PRODUCTION_CHANGED_BEFORE_CREATE');
const title='BD Sef encrypted Kindle '+process.env.GITHUB_SHA+' baseline='+preservedGitBaseline+' preserved-deploy='+expectedDeploy;
let created=await api('sites/'+site+'/deploys?title='+encodeURIComponent(title),{method:'POST',body:{files,functions,functions_config,function_schedules:before.function_schedules||[],draft:false,async:true,branch:'main',framework:before.framework||'unknown'}});
await writeFile('sef-kindle-deploy-started.json',JSON.stringify({deploy_id:created.id,previous_deploy:expectedDeploy,source_commit:process.env.GITHUB_SHA})+'\n');
created=await waitFor(created.id,['prepared','uploading','uploaded','ready']);
assert.equal((created.required_functions||[]).length,0,'CACHED_FUNCTIONS_NOT_REUSABLE');
assert.equal((created.required_edge_functions||[]).length,0,'UNEXPECTED_EDGE_UPLOAD');
const uploads=(created.required||[]).map(sha=>{
 const name=names.find(name=>digest(originals[name],'sha1')===sha);assert(name,'UNEXPECTED_UPLOAD_REQUIRED');return name;
});
console.log(JSON.stringify({stage:'verified-preserved-manifest',previous_deploy:expectedDeploy,preserved_files:Object.keys(existingFiles).length,preserved_functions:Object.keys(functions).length,changed_files:names,required_uploads:uploads.length}));
for(const name of uploads){
 assert.equal((await api('sites/'+site)).published_deploy.id,expectedDeploy,'PRODUCTION_CHANGED_BEFORE_UPLOAD');
 await api('deploys/'+created.id+'/files/'+targetRoot+name,{method:'PUT',body:originals[name],binary:true});
}
const ready=await waitFor(created.id,['ready']);
let afterSite;
for(let n=0;n<30;n++){afterSite=await api('sites/'+site);if(afterSite.published_deploy?.id===ready.id)break;await sleep(2000);}
assert.equal(afterSite.published_deploy?.id,ready.id,'DEPLOY_NOT_PUBLISHED');
const afterFiles=await listFiles();
assert.deepEqual(afterFiles,files,'PRODUCTION_MANIFEST_MISMATCH');
assert.deepEqual(functionState(ready),functionState(before),'FUNCTION_CONFIGURATION_CHANGED');
assert.deepEqual(ready.function_schedules,before.function_schedules,'FUNCTION_SCHEDULES_CHANGED');
const live=[];
for(const name of names){
 const data=await publicBytes(name);assert.equal(digest(data),digest(originals[name]),'LIVE_ASSET_MISMATCH');
 live.push({file:name,bytes:data.length,sha256:digest(data)});
}
const receipt={status:'PRODUCTION_ASSETS_VERIFIED',created_utc:new Date().toISOString(),source_commit:process.env.GITHUB_SHA,deploy_id:ready.id,previous_deploy:expectedDeploy,url:'https://www.mdlxdcc.org/BD/O/sef.html',changed_files:names,preserved_files:Object.keys(existingFiles).length-1,preserved_functions:Object.keys(functions).length,function_configuration_preserved:true,function_schedules_preserved:true,production_file_manifest_exact:true,live_assets:live,raw_credentials_read:false,browser_acceptance:'PENDING_SEPARATE_AUTHENTICATED_BROWSER_CHECK'};
await writeFile('sef-kindle-production-receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
