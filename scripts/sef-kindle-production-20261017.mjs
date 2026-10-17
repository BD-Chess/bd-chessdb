// Owner-authorized Kindle release: read-only publication guards and exact live verification.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const site='17b4124d-c197-4c0a-a711-8b2c08d91088';
const expectedDeploy='6ad2c9452b30835fea90c2d6';
const originalDeploy='6ad2c372674de74206292aa2';
const baseline='95905176c313c2c3577d242bb55d5d3e2af594d2';
const names=['sef.js','sef-kindle.json','sef-kindle-20261017-r1.enc.txt'];
const sha=(bytes,algorithm='sha256')=>createHash(algorithm).update(bytes).digest('hex');
const canonical=path=>path.replace(/^\//,'').toLowerCase();
export async function inventory(load){
 const files={};
 for(let page=1;page<=200;page++){
  const batch=await load(page);assert(Array.isArray(batch),'INVALID_FILE_PAGE');
  for(const row of batch){const path=canonical(row.path);assert(/^[a-f0-9]{40}$/.test(row.sha),'INVALID_FILE_SHA');assert(!Object.hasOwn(files,path),'DUPLICATE_FILE');files[path]=row.sha;}
  if(batch.length<100){assert(files['bd/o/sef.js']&&files['netlify.toml'],'INCOMPLETE_SITE_MANIFEST');return files;}
 }
 throw Error('FILE_PAGE_LIMIT');
}
export function verifyManifest(before,after,overrides){assert.deepEqual(after,{...before,...overrides},'UNRELATED_PRODUCTION_FILE_CHANGED');}
export function verifyFunctions(before,after){
 const normalize=d=>(d.available_functions||[]).map(f=>({name:f.n,runtime:f.r,memory:f.m,mode:f.im,routes:f.ro||null,traffic:f.tr||null,priority:f.p})).sort((a,b)=>a.name.localeCompare(b.name));
 assert.deepEqual(normalize(after),normalize(before),'FUNCTION_CONFIGURATION_CHANGED');
 assert.deepEqual(after.function_schedules,before.function_schedules,'FUNCTION_SCHEDULE_CHANGED');
}
async function main(){
 const token=process.env.NETLIFY_AUTH_TOKEN;assert(token,'NETLIFY_CREDENTIAL_MISSING');
 const api=async(path,method='GET')=>{const r=await fetch('https://api.netlify.com/api/v1/'+path,{method,headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('NETLIFY_API_'+r.status);return r.json();};
 const loadSite=()=>api('sites/'+site);
 const loadInventory=()=>inventory(page=>api('sites/'+site+'/files?per_page=100&page='+page));
 const mode=process.argv[2];
 if(mode==='--snapshot'){
  assert.equal((await loadSite()).published_deploy.id,expectedDeploy,'PRODUCTION_BASELINE_CHANGED');
  const changed=execFileSync('git',['diff','--name-only',baseline,'HEAD','--','public','functions','netlify.toml','package.json','package-lock.json'],{encoding:'utf8'}).trim().split('\n').filter(Boolean).sort();
  assert.deepEqual(changed,names.map(n=>'public/BD/O/'+n).sort(),'UNAPPROVED_PUBLISH_SOURCE_CHANGE');
  const before=await api('deploys/'+expectedDeploy),reference=await api('deploys/'+originalDeploy),files=await loadInventory();
  assert.equal(files['bd/o/sef.js'],sha(await readFile('public/BD/O/sef.js'),'sha1'),'SEF_CHANGED_CONCURRENTLY');
  const overrides={},assets=[];
  for(const name of names){const bytes=await readFile('public/BD/O/'+name);overrides['bd/o/'+name]=sha(bytes,'sha1');assets.push({file:name,sha256:sha(bytes),bytes:bytes.length});}
  const cfg=JSON.parse(await readFile('public/BD/O/sef-kindle.json','utf8'));
  assert.equal(cfg.data.sha256,assets.find(x=>x.file===cfg.data.path).sha256,'OWNER_CIPHER_CHANGED');
  assert.equal(cfg.vault,JSON.parse(await readFile('public/BD/O/vault.json','utf8')).vault,'VAULT_KEY_ID_CHANGED');
  await writeFile('sef-kindle-before.json',JSON.stringify({before,reference,files,overrides,assets,changed})+'\n');
  // Cancel only this task's incomplete, never-published digest-upload attempt.
  const pending=await api('deploys/6ad2c69d76a59a698c81ef0b');
  if(['prepared','uploading'].includes(pending.state)){
   assert.equal(pending.site_id,site);assert(pending.title?.startsWith('BD Sef encrypted Kindle 6114585ce013adbe0b85300dd8e721967ccd10aa '));
   await api('deploys/'+pending.id+'/cancel','POST');
  }
  console.log(JSON.stringify({stage:'snapshot-verified',files:Object.keys(files).length,approved_source_paths:changed}));
 }else if(mode==='--guard'){
  const saved=JSON.parse(await readFile('sef-kindle-before.json','utf8'));
  assert.equal((await loadSite()).published_deploy.id,saved.before.id,'PRODUCTION_CHANGED_DURING_PREPARATION');
  console.log('PRODUCTION_LEASE_UNCHANGED');
 }else if(mode==='--verify'){
  const saved=JSON.parse(await readFile('sef-kindle-before.json','utf8'));
  const cli=JSON.parse(await readFile('sef-kindle-cli-deploy.json','utf8')),id=cli.deploy_id||cli.deployId;assert(id,'CLI_DEPLOY_ID_MISSING');
  let afterSite;for(let i=0;i<60;i++){afterSite=await loadSite();if(afterSite.published_deploy.id===id)break;await new Promise(r=>setTimeout(r,2000));}
  assert.equal(afterSite.published_deploy.id,id,'CLI_DEPLOY_NOT_PUBLISHED');
  const after=await api('deploys/'+id),files=await loadInventory();
  verifyManifest(saved.files,files,saved.overrides);verifyFunctions(saved.reference||saved.before,after);
  for(const asset of saved.assets){const r=await fetch('https://www.mdlxdcc.org/BD/O/'+asset.file,{cache:'no-store',signal:AbortSignal.timeout(30000)});assert(r.ok);assert.equal(sha(Buffer.from(await r.arrayBuffer())),asset.sha256,'LIVE_ASSET_MISMATCH');}
  const digestMap=d=>Object.fromEntries(d.available_functions.map(f=>[f.n,f.oid]));
  const receipt={status:'PRODUCTION_ASSETS_VERIFIED',verified_utc:new Date().toISOString(),source_commit:process.env.GITHUB_SHA,deploy_id:id,previous_deploy:saved.before.id,url:'https://www.mdlxdcc.org/BD/O/sef.html',changed_files:names,task_baseline_deploy:originalDeploy,preserved_files:Object.entries(saved.files).filter(([path,hash])=>saved.overrides[path]===undefined||saved.overrides[path]===hash).length,production_file_manifest_exact:true,preserved_functions:after.available_functions.length,function_configuration_preserved:true,function_schedules_preserved:true,function_source_files_unchanged:true,function_original_digests_equal:JSON.stringify(digestMap(saved.reference||saved.before))===JSON.stringify(digestMap(after)),live_assets:saved.assets,plaintext_credentials_in_release:false,browser_acceptance:'PENDING_SEPARATE_AUTHENTICATED_BROWSER_CHECK'};
  await writeFile('sef-kindle-production-receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
 }else throw Error('EXPECTED_SNAPSHOT_GUARD_OR_VERIFY_MODE');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
