import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {execFileSync,spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {verifyDFC} from './dfc-verify-live.mjs';
import {waitForPublishedDeploy} from './dualframe-deploy-ready.mjs';
const site=process.env.NETLIFY_SITE_ID,token=process.env.NETLIFY_AUTH_TOKEN;
if(!site||!token)throw Error('PRODUCTION_CREDENTIAL_MISSING');
const api=async path=>{const r=await fetch('https://api.netlify.com/api/v1/'+path,{headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('NETLIFY_API_'+r.status);return r.json();};
let current=await api('sites/'+site);const deploy=current.published_deploy;
if(!deploy?.id)throw Error('PUBLISHED_DEPLOY_UNKNOWN');
const mode=process.argv[2];
if(mode==='--guard'){
 if(deploy.id!==(await readFile('.dualframe-deploy-before','utf8')).trim())throw Error('PRODUCTION_CHANGED_DURING_BUILD');
 console.log('Production baseline unchanged.');
}else if(mode==='--verify'){
 const receipt=JSON.parse(await readFile('dualframe-deploy.json','utf8')),id=receipt.deploy_id||receipt.deployId;
 current=await waitForPublishedDeploy({expectedId:id,initialSite:current,loadSite:()=>api('sites/'+site)});
 const envMetadata=await api('accounts/'+current.account_id+'/env?site_id='+site);
 console.log(JSON.stringify({credential_presence:envMetadata.filter(v=>v.key.startsWith('DF_')).map(v=>({key:v.key,is_secret:v.is_secret,scopes:v.scopes}))}));
 const base=current.ssl_url||current.url;
 let capabilities=null;for(let i=0;i<40;i++){const cap=await fetch(base+'/api/df/capabilities',{cache:'no-store'});if(cap.ok){capabilities=await cap.json();if(capabilities.auth_configured&&capabilities.models.every(m=>m.key_configured))break;}await new Promise(r=>setTimeout(r,4000));}if(!capabilities)throw Error('LIVE_API_UNAVAILABLE');console.log(JSON.stringify({auth_configured:capabilities.auth_configured,available_models:capabilities.models?.filter(m=>m.available).map(m=>m.key)}));if(capabilities.version!=='3.0-r4')throw Error('LIVE_API_VERSION_MISMATCH');
 const anon=await fetch(base+'/api/df/library',{cache:'no-store'});if(anon.status!==401)throw Error('LIVE_API_NOT_PROTECTED');
 const syncAnon=await fetch(base+'/api/df/sync/manifest',{cache:'no-store'});if(syncAnon.status!==401)throw Error('LIVE_SYNC_NOT_PROTECTED');
 const syncRecordAnon=await fetch(base+'/api/df/sync/records',{method:'POST',headers:{'content-type':'application/json'},body:'{}',cache:'no-store'});if(syncRecordAnon.status!==401)throw Error('LIVE_SYNC_WRITE_NOT_PROTECTED');
 const enhanceAnon=await fetch(base+'/api/df/enhance',{method:'POST',headers:{'content-type':'application/json'},body:'{}',cache:'no-store'});if(enhanceAnon.status!==401)throw Error('LIVE_ENHANCE_NOT_PROTECTED');
 const adminAnon=await fetch(base+'/api/df/admin/policy',{cache:'no-store'});if(adminAnon.status!==401)throw Error('LIVE_ADMIN_NOT_PROTECTED');
 if(capabilities.account_identity?.public_enabled!==false)throw Error('PUBLIC_ENABLEMENT_GATE_NOT_HELD');
 const probeAnon=await fetch(base+'/api/df/model-probe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({models:['openai-flare']}),cache:'no-store'});
 if(probeAnon.status!==401)throw Error('LIVE_MODEL_PROBE_NOT_PROTECTED');
 const probeCors=await fetch(base+'/api/df/model-probe',{method:'OPTIONS',headers:{origin:'https://bd-chess.github.io','access-control-request-method':'POST','access-control-request-headers':'authorization,content-type'}});
 if(!probeCors.ok||probeCors.headers.get('access-control-allow-origin')!=='https://bd-chess.github.io'||!probeCors.headers.get('access-control-allow-methods')?.includes('POST'))throw Error('LIVE_MODEL_PROBE_CORS_MISSING');
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
 const expectedRelease=JSON.parse(await readFile('public/Nara/dualframe-lab/release.json','utf8'));
 if(livePwaHash!==expectedRelease.pwa.offline_package_sha256)throw Error('LIVE_PWA_SOURCE_PACKAGE_MISMATCH');
 if(livePwaHash!==pwaRelease.pwa.offline_package_sha256||workerPackageSha!==livePwaHash){console.log(JSON.stringify({pwa_integrity_mismatch:{expected:pwaRelease.pwa.offline_package_sha256,actual:livePwaHash,worker:workerPackageSha,assets:pwaEvidence}}));throw Error('LIVE_PWA_PACKAGE_HASH_MISMATCH');}
 const comicBase=pwaRoot+'cmarvel-01/',comicGate=await fetch(comicBase,{cache:'no-store'}),comicHtml=await comicGate.text();
 if(!comicGate.ok||!comicHtml.includes('id="gate-form"')||!comicHtml.includes('noindex,nofollow,noarchive,nosnippet,noimageindex'))throw Error('LIVE_CMARVEL_GATE_MISSING');
 if(!comicGate.headers.get('cache-control')?.includes('no-store')||!comicGate.headers.get('x-robots-tag')?.includes('noindex')||comicGate.headers.get('referrer-policy')!=='no-referrer')throw Error('LIVE_CMARVEL_HEADERS_MISSING');
 if(pwaRelease.protected_comic?.manifest_sha256!==expectedRelease.protected_comic.manifest_sha256)throw Error('LIVE_CMARVEL_RELEASE_MISMATCH');
 const comicManifestResponse=await fetch(comicBase+'manifest.json',{cache:'no-store'});if(!comicManifestResponse.ok)throw Error('LIVE_CMARVEL_MANIFEST_MISSING');
 const comicManifestBytes=Buffer.from(await comicManifestResponse.arrayBuffer()),comicManifestSha=createHash('sha256').update(comicManifestBytes).digest('hex');
 if(comicManifestSha!==expectedRelease.protected_comic.manifest_sha256)throw Error('LIVE_CMARVEL_MANIFEST_MISMATCH');
 const comicManifest=JSON.parse(comicManifestBytes.toString('utf8'));
 if(comicManifest.story_id!=='CMARVEL_01'||comicManifest.iterations!==600000||comicManifest.pages?.length!==11)throw Error('LIVE_CMARVEL_MANIFEST_INVALID');
 for(const asset of comicManifest.pages){const response=await fetch(new URL(asset.file,comicBase),{cache:'no-store'});if(!response.ok)throw Error('LIVE_CMARVEL_CIPHERTEXT_MISSING');const bytes=Buffer.from(await response.arrayBuffer()),sha=createHash('sha256').update(bytes).digest('hex');if(bytes.length!==asset.cipher_bytes||sha!==asset.cipher_sha256)throw Error('LIVE_CMARVEL_CIPHERTEXT_MISMATCH');}
 const directSource=await fetch(comicBase+'assets/CM_01.webp',{cache:'no-store'});if(directSource.status!==404)throw Error('LIVE_CMARVEL_PLAINTEXT_SOURCE_EXPOSED');
 const liveSefConfigResponse=await fetch(base+'/BD/O/sef-extra.json',{cache:'no-store'});if(!liveSefConfigResponse.ok)throw Error('LIVE_CMARVEL_SEF_ENTRY_MISSING');
 const liveSefConfig=await liveSefConfigResponse.json();if(liveSefConfig.release!=='20261017-cmarvel-v1'||liveSefConfig.data?.path!=='sef-extra-20261017-cmarvel-v1.enc.txt')throw Error('LIVE_CMARVEL_SEF_ENTRY_VERSION');
 const liveSefCipherResponse=await fetch(base+'/BD/O/'+liveSefConfig.data.path,{cache:'no-store'});if(!liveSefCipherResponse.ok)throw Error('LIVE_CMARVEL_SEF_CIPHERTEXT_MISSING');
 const liveSefCipher=Buffer.from(await liveSefCipherResponse.arrayBuffer());if(createHash('sha256').update(liveSefCipher).digest('hex')!==liveSefConfig.data.sha256)throw Error('LIVE_CMARVEL_SEF_CIPHERTEXT_MISMATCH');
 const comicCheck={gate:'PASS',password_input:'client_only',encrypted_pages:comicManifest.pages.length,direct_plaintext_probe_status:directSource.status,sef_entry_release:liveSefConfig.release,manifest_sha256:comicManifestSha};
 const env=await api('accounts/'+current.account_id+'/env?site_id='+site);
 const names=['DF_PASSWORD_VERIFIER','DF_SESSION_SECRET','DF_OPENAI_API_KEY','DF_GEMINI_API_KEY','DF_XAI_API_KEY','DF_QWEN_API_KEY','DF_MINIMAX_API_KEY','DF_ZAI_API_KEY','DF_MISTRAL_API_KEY'];
 const configured=names.map(key=>({key,present:env.some(v=>v.key===key),secret:env.find(v=>v.key===key)?.is_secret===true,functions_scope:env.find(v=>v.key===key)?.scopes.includes('functions')===true}));
 const check={status:'PRODUCTION_VERIFIED',deploy_id:id,source_commit:process.env.GITHUB_SHA,baseline:(await readFile('.dualframe-baseline','utf8')).trim(),url:base+'/Nara/dualframe-lab/',api_version:capabilities.version,offline_package_sha256:livePwaHash,anonymous_library_status:anon.status,anonymous_enhance_status:enhanceAnon.status,anonymous_admin_status:adminAnon.status,account_identity_status:capabilities.account_identity,enhancement_status:capabilities.enhancement_policy||null,models:capabilities.models?.map(m=>({key:m.key,key_configured:m.key_configured,status:m.status})),credential_metadata:configured,configuration_storage:configured.every(v=>v.present)?'Netlify secret environment':'private-encrypted-netlify-vault',real_provider_calls:0,paid_image_spend:0};
 Object.assign(check,{final_page_url:page.url,pwa_asset_count:pwaAssets.length,pwa_assets:pwaEvidence,pwa_manifest_identity:{id:pwaManifest.id,start_url:pwaManifest.start_url,scope:pwaManifest.scope,orientation:pwaManifest.orientation}});
 check.protected_comic=comicCheck;
 check.cartoons=await verifyDFC(base+'/nara/dualframe-lab/');
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
 // Preserve the owner-authorized encrypted Sef correction on subsequent isolated releases.
 const paths=['public/BD/O/sef.js','public/BD/O/sef-extra.json','public/BD/O/sef-extra-20261017-cmarvel-v1.enc.txt','public/BD/O/sef-kindle.json','public/BD/O/sef-kindle-20261017-r1.enc.txt','public/Nara/dualframe-lab','functions/lib/dualframe','functions/dualframe-api.mjs','functions/dualframe-auth.mjs','functions/dualframe-work-background.mjs','functions/package.json','functions/package-lock.json'];
 for(const path of paths)await cp(path,'.dualframe-prod/'+path,{recursive:true,force:true});
 const config=await readFile('.dualframe-prod/netlify.toml','utf8'),fragment=await readFile('netlify-dualframe.fragment.toml','utf8');await writeFile('.dualframe-prod/netlify.toml',config.includes('# DualFrame AI R&D')?config.replace(/\n# DualFrame AI R&D[\s\S]*?# END DualFrame AI R&D\n/,fragment):config+fragment);
 const digest=createHash('sha256').update(config).digest('hex');console.log(JSON.stringify({preserved_deploy:deploy.id,preserved_git_baseline:baseline,preserved_config_sha256:digest,overlay_paths:paths,real_provider_calls:0}));
}
