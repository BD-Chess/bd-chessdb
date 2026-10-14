import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {execFileSync,spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const site=process.env.NETLIFY_SITE_ID,token=process.env.NETLIFY_AUTH_TOKEN;
if(!site||!token)throw Error('PRODUCTION_CREDENTIAL_MISSING');
const api=async path=>{const r=await fetch('https://api.netlify.com/api/v1/'+path,{headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('NETLIFY_API_'+r.status);return r.json();};
const current=await api('sites/'+site),deploy=current.published_deploy;
if(!deploy?.id)throw Error('PUBLISHED_DEPLOY_UNKNOWN');
const mode=process.argv[2];
if(mode==='--guard'){
 if(deploy.id!==(await readFile('.dualframe-deploy-before','utf8')).trim())throw Error('PRODUCTION_CHANGED_DURING_BUILD');
 console.log('Production baseline unchanged.');
}else if(mode==='--verify'){
 const receipt=JSON.parse(await readFile('dualframe-deploy.json','utf8')),id=receipt.deploy_id||receipt.deployId;
 if(!id||deploy.id!==id||deploy.state!=='ready')throw Error('PRODUCTION_DEPLOY_NOT_READY');
 const envMetadata=await api('accounts/'+current.account_id+'/env?site_id='+site);
 console.log(JSON.stringify({credential_presence:envMetadata.filter(v=>v.key.startsWith('DF_')).map(v=>({key:v.key,is_secret:v.is_secret,scopes:v.scopes}))}));
 const base=current.ssl_url||current.url;
 let capabilities=null;for(let i=0;i<40;i++){const cap=await fetch(base+'/api/df/capabilities',{cache:'no-store'});if(cap.ok){capabilities=await cap.json();if(capabilities.auth_configured&&capabilities.models.every(m=>m.key_configured))break;}await new Promise(r=>setTimeout(r,4000));}if(!capabilities)throw Error('LIVE_API_UNAVAILABLE');console.log(JSON.stringify({auth_configured:capabilities.auth_configured,available_models:capabilities.models?.filter(m=>m.available).map(m=>m.key)}));if(capabilities.version!=='3.0-r4')throw Error('LIVE_API_VERSION_MISMATCH');
 const anon=await fetch(base+'/api/df/library',{cache:'no-store'});if(anon.status!==401)throw Error('LIVE_API_NOT_PROTECTED');
 const corsOrigin='https://bd-chess.github.io';
 const corsUrl=base+'/api/df/pairs/dualframe_readonly_preflight_probe';
 const cors=await fetch(corsUrl,{method:'OPTIONS',headers:{origin:corsOrigin,'access-control-request-method':'DELETE','access-control-request-headers':'authorization'},cache:'no-store'});
 if(cors.status!==200||cors.headers.get('access-control-allow-origin')!==corsOrigin||!cors.headers.get('access-control-allow-methods')?.split(',').includes('DELETE'))throw Error('LIVE_GALLERY_DELETE_CORS_MISSING');
 const blocked=await fetch(corsUrl,{method:'OPTIONS',headers:{origin:'https://untrusted.example','access-control-request-method':'DELETE'},cache:'no-store'});
 if(blocked.status!==403||blocked.headers.get('access-control-allow-origin'))throw Error('LIVE_GALLERY_DELETE_CORS_TOO_BROAD');
 const page=await fetch(base+'/Nara/dualframe-lab/',{cache:'no-store'});const html=await page.text();if(!page.ok||!html.includes('api-auth-form')||!html.includes('3.0-r4'))throw Error('LIVE_PAGE_VERSION_MISMATCH');
 const appResponse=await fetch(base+'/Nara/dualframe-lab/app.mjs?v=3.0-r4.2',{cache:'no-store'}),appText=await appResponse.text();
 const zipResponse=await fetch(base+'/Nara/dualframe-lab/zip-store.mjs?v=3.0-r4.1',{cache:'no-store'}),zipText=await zipResponse.text();
 if(!appResponse.ok||!appText.includes('downloadAllVariants')||!appText.includes('Landscape (all)')||!appText.includes('Portrait (all)')||!zipResponse.ok||!zipText.includes('collectOrientationAssets')||!zipText.includes('0x04034b50'))throw Error('LIVE_VARIANT_EXPORT_UNAVAILABLE');
 const pwaRoot=base+'/Nara/dualframe-lab/',pwa=[await fetch(pwaRoot+'manifest.webmanifest',{cache:'no-store'}),await fetch(pwaRoot+'release.json',{cache:'no-store'}),await fetch(pwaRoot+'sw.js',{cache:'no-store'})];
 if(pwa.some(r=>!r.ok))throw Error('LIVE_PWA_ASSETS_UNAVAILABLE');
 const [pwaManifest,pwaRelease,pwaWorker]=await Promise.all([pwa[0].json(),pwa[1].json(),pwa[2].text()]);
 const pwaList=pwaWorker.match(/const ASSETS=(\[[\s\S]*?\]);/);if(!pwaList||pwaManifest.id!=='./'||pwaManifest.scope!=='./'||pwaRelease.pwa?.scope!=='./'||!html.includes('rel="manifest"')||!html.includes('id="pwa-install"'))throw Error('LIVE_PWA_CONTRACT_INVALID');
 const pwaAssets=JSON.parse(pwaList[1]),pwaHash=createHash('sha256'),pwaEvidence=[];
 for(const asset of pwaAssets){const name=asset.replace(/^\.\//,'').split('?')[0];if(name==='release.json')continue;const requestedUrl=new URL(asset,pwaRoot),r=await fetch(requestedUrl,{cache:'no-store'});if(!r.ok)throw Error('LIVE_PWA_PACKAGE_ASSET_MISSING');const data=Buffer.from(await r.arrayBuffer()),assetSha=createHash('sha256').update(data).digest('hex');pwaHash.update(asset).update('\0').update(assetSha).update('\n');pwaEvidence.push({asset,requested_url:requestedUrl.href,final_url:r.url,bytes:data.length,sha256:assetSha});}
 const livePwaHash=pwaHash.digest('hex'),workerPackageSha=pwaWorker.match(/const PACKAGE_SHA='([^']+)'/)?.[1]||null;
 if(livePwaHash!==pwaRelease.pwa.offline_package_sha256||workerPackageSha!==livePwaHash){console.log(JSON.stringify({pwa_integrity_mismatch:{expected:pwaRelease.pwa.offline_package_sha256,actual:livePwaHash,worker:workerPackageSha,assets:pwaEvidence}}));throw Error('LIVE_PWA_PACKAGE_HASH_MISMATCH');}
 const env=await api('accounts/'+current.account_id+'/env?site_id='+site);
 const names=['DF_PASSWORD_VERIFIER','DF_SESSION_SECRET','DF_OPENAI_API_KEY','DF_GEMINI_API_KEY','DF_XAI_API_KEY','DF_QWEN_API_KEY','DF_MINIMAX_API_KEY','DF_ZAI_API_KEY','DF_MISTRAL_API_KEY'];
 const configured=names.map(key=>({key,present:env.some(v=>v.key===key),secret:env.find(v=>v.key===key)?.is_secret===true,functions_scope:env.find(v=>v.key===key)?.scopes.includes('functions')===true}));
 const check={status:'PRODUCTION_VERIFIED',deploy_id:id,source_commit:process.env.GITHUB_SHA,baseline:(await readFile('.dualframe-baseline','utf8')).trim(),url:base+'/Nara/dualframe-lab/',api_version:capabilities.version,offline_package_sha256:livePwaHash,anonymous_library_status:anon.status,models:capabilities.models?.map(m=>({key:m.key,key_configured:m.key_configured,status:m.status})),credential_metadata:configured,configuration_storage:configured.every(v=>v.present)?'Netlify secret environment':'private-encrypted-netlify-vault',real_provider_calls:0,paid_image_spend:0};
 await writeFile('dualframe-live-check.json',JSON.stringify(check,null,2)+'\n');console.log(JSON.stringify(check));
 if(!capabilities.auth_configured||capabilities.models.some(m=>!m.key_configured))throw Error('IMAGE_CREDENTIAL_CONFIGURATION_INCOMPLETE');
}else{
 const title=deploy.title||'',baseline=title.match(/baseline=([a-f0-9]{40})/)?.[1]||title.match(/\b[a-f0-9]{40}\b/)?.[0]||deploy.commit_ref;
 if(!/^[a-f0-9]{40}$/.test(baseline||''))throw Error('PUBLISHED_GIT_BASELINE_UNIDENTIFIED');
 execFileSync('git',['cat-file','-e',baseline+'^{commit}']);
 await writeFile('.dualframe-baseline',baseline+'\n');await writeFile('.dualframe-deploy-before',deploy.id+'\n');
 await mkdir('.dualframe-prod',{recursive:true});
 await new Promise((resolve,reject)=>{
  const archive=spawn('git',['archive',baseline],{stdio:['ignore','pipe','inherit']}),extract=spawn('tar',['-x','-C','.dualframe-prod'],{stdio:['pipe','inherit','inherit']});
  let completed=0;const end=code=>{if(code!==0)reject(Error('BASELINE_ARCHIVE_FAILED'));else if(++completed===2)resolve();};
  archive.on('error',reject);extract.on('error',reject);archive.stdout.on('error',reject);extract.stdin.on('error',reject);archive.stdout.pipe(extract.stdin);archive.on('close',end);extract.on('close',end);
 });
 const paths=['public/Nara/dualframe-lab','functions/lib/dualframe','functions/dualframe-api.mjs','functions/dualframe-auth.mjs','functions/dualframe-work-background.mjs','functions/package.json'];
 for(const path of paths)await cp(path,'.dualframe-prod/'+path,{recursive:true,force:true});
 const config=await readFile('.dualframe-prod/netlify.toml','utf8'),fragment=await readFile('netlify-dualframe.fragment.toml','utf8');await writeFile('.dualframe-prod/netlify.toml',config.includes('# DualFrame AI R&D')?config.replace(/\n# DualFrame AI R&D[\s\S]*?# END DualFrame AI R&D\n/,fragment):config+fragment);
 const digest=createHash('sha256').update(config).digest('hex');console.log(JSON.stringify({preserved_deploy:deploy.id,preserved_git_baseline:baseline,preserved_config_sha256:digest,overlay_paths:paths,real_provider_calls:0}));
}
