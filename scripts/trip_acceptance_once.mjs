/* One-shot Trip production unlock acceptance. No deploy; no plaintext password is committed. */
import {generateKeyPairSync,privateDecrypt,createDecipheriv,constants} from 'node:crypto';
const REPO='BD-Chess/bd-chessdb',BRANCH='ops/trip-accept-exchange';
const ID=process.env.GITHUB_RUN_ID+'-'+process.env.GITHUB_RUN_ATTEMPT;
const auth=process.env.GITHUB_TOKEN;
if(process.env.GITHUB_REPOSITORY!==REPO||!auth)throw Error('wrong runner');
async function api(path,method='GET',body=null,allowed=[]){
 const r=await fetch('https://api.github.com/repos/'+REPO+path,{method,headers:{Authorization:'Bearer '+auth,Accept:'application/vnd.github+json','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 if(allowed.includes(r.status))return null;
 if(!r.ok)throw Error('GitHub HTTP '+r.status);
 return r.status===204?null:r.json();
}
async function put(path,value){
 const old=await api('/contents/'+path+'?ref='+encodeURIComponent(BRANCH),'GET',null,[404]);
 await api('/contents/'+path,'PUT',{message:'Trip private acceptance handoff',branch:BRANCH,content:Buffer.from(JSON.stringify(value)).toString('base64'),...(old?{sha:old.sha}:{})});
}
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:3072});
const head=await api('/git/ref/heads/main');
await api('/git/refs','POST',{ref:'refs/heads/'+BRANCH,sha:head.object.sha},[422]);
await put('.trip-accept/public-'+ID+'.json',{schema:'TRIP-ACCEPT-PUBLIC-1',id:ID,source_sha:process.env.GITHUB_SHA,public_key:publicKey.export({type:'spki',format:'pem'}),expires_at:new Date(Date.now()+15*60000).toISOString()});
console.log('Trip acceptance handoff ready: '+ID);
let box;
for(let i=0;i<90;i++){
 const r=await api('/contents/.trip-accept/payload-'+ID+'.json?ref='+encodeURIComponent(BRANCH),'GET',null,[404]);
 if(r){box=JSON.parse(Buffer.from(r.content,'base64'));break}
 await new Promise(resolve=>setTimeout(resolve,10000));
}
if(!box||box.schema!=='TRIP-ACCEPT-BOX-1'||box.id!==ID)throw Error('missing valid handoff');
const key=privateDecrypt({key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(box.key,'base64'));
const dec=createDecipheriv('aes-256-gcm',key,Buffer.from(box.iv,'base64'));
dec.setAAD(Buffer.from('TRIP-ACCEPT:'+ID));dec.setAuthTag(Buffer.from(box.tag,'base64'));
const payload=JSON.parse(Buffer.concat([dec.update(Buffer.from(box.cipher,'base64')),dec.final()]));key.fill(0);
if(payload.source_sha!==process.env.GITHUB_SHA||typeof payload.password!=='string'||!payload.password)throw Error('invalid payload');
console.log('::add-mask::'+payload.password);
const health=await fetch('https://www.mdlxdcc.org/api/trip-mdl-unlock?accept='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});
const hb=await health.json();
if(health.status!==200||hb.schema!=='TripUnlockHealthV1'||hb.configured!==true)throw Error('health failed HTTP '+health.status);
const unlock=await fetch('https://www.mdlxdcc.org/api/trip-mdl-unlock',{method:'POST',headers:{origin:'https://www.mdlxdcc.org','content-type':'application/json'},body:JSON.stringify({schema:'TripUnlockV1',password:payload.password}),signal:AbortSignal.timeout(20000)});
const answer=await unlock.json();
const pass=unlock.status===200&&answer.schema==='TripUnlockV1'&&answer.engine==='bd-trip-browser-r1.1.0'&&answer.accessClass==='owner'&&Buffer.from(answer.credential||'','base64').length===32;
await put('.trip-accept/result-'+ID+'.json',{schema:'TRIP-LIVE-ACCEPTANCE-1',id:ID,status:pass?'PASS':'FAIL',health:true,owner_unlock:pass,http_status:unlock.status,error:answer.error||null,completed_at:new Date().toISOString()});
if(!pass)throw Error('owner unlock failed HTTP '+unlock.status+' error '+String(answer.error||'none'));
console.log('Trip live owner unlock acceptance PASS.');