/* One-shot live acceptance, not a deploy or model worker. Credentials are
 * transmitted in an envelope encrypted for this runner's ephemeral key. */
import {generateKeyPairSync,privateDecrypt,createDecipheriv,constants} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const REPO='BD-Chess/bd-chessdb',BRANCH='ops/wl-deploy-exchange';
const ID=process.env.GITHUB_RUN_ID+'-'+process.env.GITHUB_RUN_ATTEMPT;
const auth=process.env.GITHUB_TOKEN;
if(process.env.GITHUB_REPOSITORY!==REPO||!auth)throw Error('wrong runner');
async function api(path,method='GET',body=null,allowed=[]){
 const r=await fetch('https://api.github.com/repos/'+REPO+path,{method,headers:{Authorization:'Bearer '+auth,Accept:'application/vnd.github+json','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 if(allowed.includes(r.status))return null;if(!r.ok)throw Error('GitHub HTTP '+r.status);return r.status===204?null:r.json();
}
async function put(path,value){
 const old=await api('/contents/'+path+'?ref='+encodeURIComponent(BRANCH),'GET',null,[404]);
 await api('/contents/'+path,'PUT',{message:'WL private acceptance handoff',branch:BRANCH,content:Buffer.from(JSON.stringify(value)).toString('base64'),...(old?{sha:old.sha}:{})});
}
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:3072});
const head=await api('/git/ref/heads/main');
await api('/git/refs','POST',{ref:'refs/heads/'+BRANCH,sha:head.object.sha},[422]);
await put('.wl-exchange/public-'+ID+'.json',{schema:'WL-ACCEPT-PUBLIC-1',id:ID,source_sha:process.env.GITHUB_SHA,public_key:publicKey.export({type:'spki',format:'pem'}),expires_at:new Date(Date.now()+15*60000).toISOString()});
console.log('Acceptance handoff ready: '+ID);
let box;
for(let i=0;i<90;i++){
 const r=await api('/contents/.wl-exchange/payload-'+ID+'.json?ref='+encodeURIComponent(BRANCH),'GET',null,[404]);
 if(r){box=JSON.parse(Buffer.from(r.content,'base64'));break}
 await new Promise(resolve=>setTimeout(resolve,10000));
}
if(!box||box.schema!=='WL-ACCEPT-BOX-1'||box.id!==ID)throw Error('missing valid handoff');
const key=privateDecrypt({key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(box.key,'base64'));
const dec=createDecipheriv('aes-256-gcm',key,Buffer.from(box.iv,'base64'));dec.setAAD(Buffer.from('WL-ACCEPT:'+ID));dec.setAuthTag(Buffer.from(box.tag,'base64'));
const payload=JSON.parse(Buffer.concat([dec.update(Buffer.from(box.cipher,'base64')),dec.final()]));key.fill(0);
if(payload.source_sha!==process.env.GITHUB_SHA||typeof payload.password!=='string'||!payload.password)throw Error('invalid test payload');
console.log('::add-mask::'+payload.password);
function run(cmd,args,extra={}){
 const env={...process.env,...extra};delete env.GITHUB_TOKEN;
 const r=spawnSync(cmd,args,{env,encoding:'utf8',maxBuffer:8*1024*1024});
 const scrub=s=>String(s||'').split(payload.password).join('[REDACTED]');
 if(r.stdout)console.log(scrub(r.stdout).slice(-4000));if(r.stderr)console.log(scrub(r.stderr).slice(-5000));
 if(r.status!==0)throw Error('acceptance subprocess failed: '+r.status);
}
run('python3',['-m','venv','/tmp/wl-accept']);
run('/tmp/wl-accept/bin/pip',['install','--quiet','playwright==1.55.0']);
run('/tmp/wl-accept/bin/python',['tests/wl_live_test.py'],{WL_TEST_PASSWORD:payload.password});
await put('.wl-exchange/result-'+ID+'.json',{schema:'WL-LIVE-ACCEPTANCE-1',id:ID,source_sha:process.env.GITHUB_SHA,status:'PASS',checks:31,viewports:[320,390,1440],site:'https://www.mdlxdcc.org/WL/',completed_at:new Date().toISOString(),private_content_published:false});
