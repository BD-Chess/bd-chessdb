/* One-shot owner-authorized Trip hotfix deployment.
 * Uses the existing Netlify connector's temporary proxy via an encrypted handoff.
 * No persistent Netlify credential is committed or printed.
 */
import {generateKeyPairSync,privateDecrypt,createDecipheriv,createHash,pbkdf2Sync,constants} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
const REPO='BD-Chess/bd-chessdb', SITE='17b4124d-c197-4c0a-a711-8b2c08d91088';
const EXCHANGE='ops/trip-deploy-exchange', SOURCE='ops/trip-unlock-hotfix-20260916-r1';
const ID=process.env.GITHUB_RUN_ID+'-'+process.env.GITHUB_RUN_ATTEMPT;
const auth=process.env.GITHUB_TOKEN;
if(process.env.GITHUB_REPOSITORY!==REPO||!auth)throw Error('invalid runner context');
const base='https://api.github.com/repos/'+REPO;
async function api(path,method='GET',data=null,allowed=[]){
 const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+auth,Accept:'application/vnd.github+json','Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(20000)});
 if(allowed.includes(r.status))return null;
 if(!r.ok)throw Error('GitHub handoff HTTP '+r.status);
 return r.status===204?null:r.json();
}
async function put(path,data){
 const old=await api('/contents/'+path+'?ref='+encodeURIComponent(EXCHANGE),'GET',null,[404]);
 await api('/contents/'+path,'PUT',{message:'Trip deployment handoff (public key or ciphertext only)',branch:EXCHANGE,content:Buffer.from(JSON.stringify(data)).toString('base64'),...(old?{sha:old.sha}:{})});
}
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:3072});
const main=await api('/git/ref/heads/main');
await api('/git/refs','POST',{ref:'refs/heads/'+EXCHANGE,sha:main.object.sha},[422]);
const source=await api('/git/ref/heads/'+SOURCE.replaceAll('/','%2F'));
await put('.trip-exchange/public-'+ID+'.json',{schema:'TRIP-DEPLOY-PUBLIC-1',id:ID,repository:REPO,site:SITE,source_ref:SOURCE,source_sha:source.object.sha,public_key:publicKey.export({type:'spki',format:'pem'}),expires_at:new Date(Date.now()+20*60000).toISOString()});
console.log('Trip deployment handoff ready: '+ID);
let box=null;
for(let i=0;i<120;i++){
 const value=await api('/contents/.trip-exchange/payload-'+ID+'.json?ref='+encodeURIComponent(EXCHANGE),'GET',null,[404]);
 if(value){box=JSON.parse(Buffer.from(value.content,'base64').toString('utf8'));break}
 await new Promise(r=>setTimeout(r,10000));
}
if(!box||box.schema!=='TRIP-DEPLOY-BOX-1'||box.id!==ID)throw Error('No valid encrypted deployment payload before deadline');
const key=privateDecrypt({key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(box.key,'base64'));
const dec=createDecipheriv('aes-256-gcm',key,Buffer.from(box.iv,'base64'));dec.setAAD(Buffer.from('TRIP-DEPLOY-ONE:'+ID));dec.setAuthTag(Buffer.from(box.tag,'base64'));
const payload=JSON.parse(Buffer.concat([dec.update(Buffer.from(box.cipher,'base64')),dec.final()]).toString('utf8'));key.fill(0);
const u=new URL(payload.proxy);
if(u.protocol!=='https:'||u.hostname!=='netlify-mcp.netlify.app'||!u.pathname.startsWith('/proxy/')||u.username||u.password||u.hash||u.search||payload.site!==SITE||payload.source_ref!==SOURCE||!(/^[a-f0-9]{40}$/).test(payload.source_sha))throw Error('invalid deployment target');
if(typeof payload.trip_test_password!=='string'||!payload.trip_test_password)throw Error('missing Trip acceptance credential');
console.log('::add-mask::'+payload.proxy);console.log('::add-mask::'+payload.trip_test_password);
const currentSource=await api('/git/ref/heads/'+SOURCE.replaceAll('/','%2F'));
if(currentSource.object.sha!==payload.source_sha)throw Error('Hotfix source advanced; refusing stale deployment');
function run(cmd,args){
 const env={...process.env};delete env.GITHUB_TOKEN;
 const r=spawnSync(cmd,args,{encoding:'utf8',env,maxBuffer:40*1024*1024});
 const clean=x=>String(x||'').split(payload.proxy).join('[REDACTED_PROXY]').split(payload.trip_test_password).join('[REDACTED]');
 if(r.stdout)console.log(clean(r.stdout).slice(-12000));if(r.stderr)console.log(clean(r.stderr).slice(-6000));
 if(r.status!==0)throw Error(cmd+' failed with '+r.status);
}
run('git',['fetch','origin',payload.source_sha,'--depth=1']);
run('git',['checkout','--detach',payload.source_sha]);
run('npm',['ci','--ignore-scripts']);
run('node',['--check','functions/trip-mdl-unlock.mjs']);
run('npx',['-y','@netlify/mcp@latest','--site-id',SITE,'--proxy-path',payload.proxy]);

// Live acceptance: health -> owner unlock -> credential decrypts the deployed encrypted Worker.
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let health=null;
for(let i=0;i<12;i++){
 try{const r=await fetch('https://www.mdlxdcc.org/api/trip-mdl-unlock?accept='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});health={status:r.status,body:await r.json()};if(r.ok&&health.body?.configured)break;}catch{}
 await sleep(5000);
}
if(!health||health.status!==200||health.body?.schema!=='TripUnlockHealthV1'||health.body?.configured!==true)throw Error('Trip health acceptance failed');
const unlock=await fetch('https://www.mdlxdcc.org/api/trip-mdl-unlock',{method:'POST',headers:{origin:'https://www.mdlxdcc.org','content-type':'application/json'},body:JSON.stringify({schema:'TripUnlockV1',password:payload.trip_test_password}),signal:AbortSignal.timeout(20000)});
const answer=await unlock.json();
if(unlock.status!==200||answer.schema!=='TripUnlockV1'||answer.engine!=='bd-trip-browser-r1.1.0'||answer.accessClass!=='owner')throw Error('Trip owner unlock acceptance failed: HTTP '+unlock.status);
const credential=Buffer.from(answer.credential,'base64');if(credential.length!==32)throw Error('Trip credential length mismatch');
const wr=await fetch('https://www.mdlxdcc.org/trip/new/mdl-worker.enc.json?accept='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!wr.ok)throw Error('Worker payload fetch failed');
const pack=await wr.json();if(pack.schema!=='TripShieldWorkerV1'||pack.engine!=='bd-trip-browser-r1.2.0')throw Error('Worker payload identity mismatch');
const raw=Buffer.from(pack.blob,'base64');if(createHash('sha256').update(raw).digest('hex')!==pack.sha256)throw Error('Worker payload hash mismatch');
const salt=raw.subarray(0,32),iv=raw.subarray(32,44),ctTag=raw.subarray(44),tag=ctTag.subarray(ctTag.length-16),ct=ctTag.subarray(0,ctTag.length-16);
const seed=createHash('sha256').update(Buffer.concat([credential,salt,Buffer.from('8Z_AUTH_V1')])).digest();
let x=seed.readBigUInt64BE(0),mask=(1n<<64n)-1n;if(x===0n)x=0x9E3779B97F4A7C15n;
for(let i=0;i<1024;i++){x=(x^(x>>12n))&mask;x=(x^(x<<25n))&mask;x=(x^(x>>27n))&mask;}
const state=Buffer.alloc(8);state.writeBigUInt64BE(x);const stateHash=createHash('sha256').update(state).digest();
const aes=pbkdf2Sync(Buffer.concat([credential,stateHash]),salt,500000,32,'sha256');
const wd=createDecipheriv('aes-256-gcm',aes,iv);wd.setAuthTag(tag);const compressed=Buffer.concat([wd.update(ct),wd.final()]);const workerText=gunzipSync(compressed).toString('utf8');
credential.fill(0);aes.fill(0);
if(!workerText.includes('bd-trip-browser-r1.2.0'))throw Error('Decrypted Worker engine marker missing');
await put('.trip-exchange/result-'+ID+'.json',{schema:'TRIP-DEPLOY-RESULT-1',id:ID,source_ref:SOURCE,source_sha:payload.source_sha,site:SITE,status:'PASS',health:true,owner_unlock:true,worker_decrypt:true,completed_at:new Date().toISOString()});
console.log('Trip hotfix deployed and live acceptance PASS.');