/* One-shot owner-authorized Netlify source deployment.
 * The only public handoff is an ephemeral RSA public key and encrypted payload.
 * No Netlify credential is committed or printed. No model is invoked here.
 */
import {generateKeyPairSync,privateDecrypt,createDecipheriv,constants} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const REPO='BD-Chess/bd-chessdb', SITE='17b4124d-c197-4c0a-a711-8b2c08d91088';
const BRANCH='ops/wl-deploy-exchange';
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
 const old=await api('/contents/'+path+'?ref='+encodeURIComponent(BRANCH),'GET',null,[404]);
 await api('/contents/'+path,'PUT',{message:'WL deployment handoff (public key or ciphertext only)',branch:BRANCH,content:Buffer.from(JSON.stringify(data)).toString('base64'),...(old?{sha:old.sha}:{})});
}
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:3072});
const head=await api('/git/ref/heads/main');
await api('/git/refs','POST',{ref:'refs/heads/'+BRANCH,sha:head.object.sha},[422]);
await put('.wl-exchange/public-'+ID+'.json',{schema:'WL-DEPLOY-PUBLIC-1',id:ID,repository:REPO,site:SITE,public_key:publicKey.export({type:'spki',format:'pem'}),expires_at:new Date(Date.now()+20*60000).toISOString()});
console.log('Public deployment handoff ready: '+ID);
let box=null;
for(let i=0;i<120;i++){
 const value=await api('/contents/.wl-exchange/payload-'+ID+'.json?ref='+encodeURIComponent(BRANCH),'GET',null,[404]);
 if(value){box=JSON.parse(Buffer.from(value.content,'base64').toString('utf8'));break}
 await new Promise(r=>setTimeout(r,10000));
}
if(!box)throw Error('No authorized encrypted deployment payload before deadline');
if(box.schema!=='WL-DEPLOY-BOX-1'||box.id!==ID)throw Error('invalid envelope');
const key=privateDecrypt({key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(box.key,'base64'));
const dec=createDecipheriv('aes-256-gcm',key,Buffer.from(box.iv,'base64'));
dec.setAAD(Buffer.from('WL-DEPLOY-ONE:'+ID));dec.setAuthTag(Buffer.from(box.tag,'base64'));
const payload=JSON.parse(Buffer.concat([dec.update(Buffer.from(box.cipher,'base64')),dec.final()]).toString('utf8'));
key.fill(0);
const u=new URL(payload.proxy);
if(u.protocol!=='https:'||u.hostname!=='netlify-mcp.netlify.app'||!u.pathname.startsWith('/proxy/')||u.username||u.password||u.hash||u.search||payload.site!==SITE||!(/^[a-f0-9]{40}$/).test(payload.source_sha))throw Error('invalid deployment target');
console.log('::add-mask::'+payload.proxy);
if(typeof payload.wl_test_password!=='string'||!payload.wl_test_password)throw Error('missing private acceptance credential');
console.log('::add-mask::'+payload.wl_test_password);
function run(cmd,args,extraEnv={}){
 const env={...process.env,...extraEnv};delete env.GITHUB_TOKEN;
 const r=spawnSync(cmd,args,{encoding:'utf8',env,maxBuffer:40*1024*1024});
 const clean=x=>String(x||'').split(payload.proxy).join('[REDACTED_PROXY]').split(payload.wl_test_password).join('[REDACTED]');
 if(r.stdout)console.log(clean(r.stdout).slice(-14000));
 if(r.stderr)console.log(clean(r.stderr).slice(-6000));
 if(r.status!==0)throw Error(cmd+' failed with '+r.status);
}
run('git',['fetch','origin',payload.source_sha,'--depth=1']);
run('git',['checkout','--detach',payload.source_sha]);
const latest=await api('/git/ref/heads/main');
if(latest.object.sha!==payload.source_sha)throw Error('Main advanced; refusing an older deploy. Retry with fresh source.');
run('npm',['ci','--ignore-scripts']);
run('node',['--check','public/WL/reader.js']);
run('npx',['-y','@netlify/mcp@latest','--site-id',SITE,'--proxy-path',payload.proxy]);
run('python3',['-m','venv','/tmp/wl-e2e']);
run('/tmp/wl-e2e/bin/pip',['install','--quiet','playwright==1.55.0']);
run('/tmp/wl-e2e/bin/python',['tests/wl_live_test.py'],{WL_TEST_PASSWORD:payload.wl_test_password});
await put('.wl-exchange/result-'+ID+'.json',{schema:'WL-DEPLOY-RESULT-1',id:ID,source_sha:payload.source_sha,site:SITE,command_exit:0,completed_at:new Date().toISOString(),status:'COMMAND_COMPLETED_VERIFY_LIVE'});
console.log('Netlify command finished for '+payload.source_sha+'; live verification is a separate gate.');
