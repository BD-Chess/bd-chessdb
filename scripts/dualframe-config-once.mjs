import {generateKeyPairSync,privateDecrypt,createDecipheriv,randomUUID,constants} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {signToken} from '../functions/lib/dualframe/auth.mjs';
const site=process.env.NETLIFY_SITE_ID,netlify=process.env.NETLIFY_AUTH_TOKEN,github=process.env.GITHUB_TOKEN,repo=process.env.GITHUB_REPOSITORY;
if(site!=='17b4124d-c197-4c0a-a711-8b2c08d91088'||repo!=='BD-Chess/bd-chessdb'||!netlify||!github)throw Error('TRANSFER_SCOPE_INVALID');
const allowed=['DF_PASSWORD_VERIFIER','DF_SESSION_SECRET','DF_OPENAI_API_KEY','DF_GEMINI_API_KEY','DF_XAI_API_KEY','DF_QWEN_API_KEY','DF_MINIMAX_API_KEY','DF_ZAI_API_KEY','DF_MISTRAL_API_KEY','DF_QWEN_API_HOST'];
const requestPath='ops/dualframe-config-request.json',sealedPath='ops/dualframe-config-sealed.json';
async function gh(path,method='GET',body){const r=await fetch('https://api.github.com/repos/'+repo+'/'+path,{method,headers:{authorization:'Bearer '+github,'content-type':'application/json','x-github-api-version':'2022-11-28'},body:body?JSON.stringify(body):undefined});if(r.status===404)return null;if(!r.ok)throw Error('GITHUB_TRANSFER_HTTP_'+r.status);return r.json();}
async function publish(value){const path='contents/'+requestPath,old=await gh(path);return gh(path,'PUT',{message:'DualFrame scoped configuration receipt '+value.status,content:Buffer.from(JSON.stringify(value,null,2)+'\n').toString('base64'),branch:'main',...(old?{sha:old.sha}:{})});}
async function api(path,method='GET',body){const r=await fetch('https://api.netlify.com/api/v1/'+path,{method,headers:{authorization:'Bearer '+netlify,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error('NETLIFY_CONFIGURATION_HTTP_'+r.status);return r.json();}
let {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:3072,publicKeyEncoding:{type:'spki',format:'pem'}});
const request={schema:'bd.dualframe.secret-transfer.v1',status:'WAITING_FOR_SEALED_ENVELOPE',request_id:randomUUID(),site_id:site,repository:repo,allowed_keys:allowed,public_key:publicKey,expires_at:new Date(Date.now()+8*60000).toISOString(),private_key_storage:'runner-memory-only'};
await publish(request);console.log(JSON.stringify({status:request.status,request_id:request.request_id,expires_at:request.expires_at,private_key_storage:request.private_key_storage}));
let payload=null;
while(Date.now()<Date.parse(request.expires_at)){
 const file=await gh('contents/'+sealedPath);if(file){const envelope=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
  if(envelope.request_id===request.request_id){
   if(envelope.schema!==request.schema||envelope.site_id!==site)throw Error('ENVELOPE_SCOPE_INVALID');
   const key=privateDecrypt({key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(envelope.wrapped_key,'base64'));
   const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64'));decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));decipher.setAAD(Buffer.from(request.request_id+':'+site));
   const plain=Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,'base64')),decipher.final()]);payload=JSON.parse(plain.toString('utf8'));plain.fill(0);key.fill(0);break;
  }
 }
 await new Promise(resolve=>setTimeout(resolve,8000));
}
privateKey=null;
if(!payload)throw Error('SEALED_ENVELOPE_NOT_RECEIVED');
if(payload.request_id!==request.request_id||payload.site_id!==site||Object.keys(payload.values).sort().join('|')!==allowed.slice().sort().join('|'))throw Error('SECRET_PAYLOAD_SCOPE_INVALID');
for(const [name,value]of Object.entries(payload.values))if(typeof value!=='string'||value.length<8||value.length>2048)throw Error('SECRET_PAYLOAD_FORMAT_INVALID');
const info=await api('sites/'+site),base=info.ssl_url||info.url;
if(!/^[a-f0-9]{64}$/.test(payload.bootstrap_token||''))throw Error('BOOTSTRAP_TOKEN_INVALID');
let installed=false;
for(let i=0;i<25;i++){
 const r=await fetch(base+'/.netlify/functions/dualframe-bootstrap',{method:'POST',headers:{authorization:'Bearer '+payload.bootstrap_token,'content-type':'application/json'},body:JSON.stringify(payload.values)});
 if(r.ok){const response=await r.json();if(response.installed){installed=true;break;}}
 if(![404,503,429].includes(r.status))throw Error('BOOTSTRAP_HTTP_'+r.status);
 await new Promise(resolve=>setTimeout(resolve,8000));
}
if(!installed)throw Error('PRIVATE_CONFIGURATION_NOT_INSTALLED');
const shortSession=signToken({owner:'bd-research-owner',scope:'session'},payload.values.DF_SESSION_SECRET,120),headers={authorization:'Bearer '+shortSession};
const session=await fetch(base+'/api/df/session',{headers}),library=await fetch(base+'/api/df/library',{headers});if(session.status!==200||library.status!==200)throw Error('LIVE_AUTHENTICATED_STORAGE_FAILED');
const negative=await fetch(base+'/api/df/auth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:randomUUID()})});if(negative.status!==401)throw Error('PASSWORD_BOUNDARY_FAILED');
const caps=await (await fetch(base+'/api/df/capabilities')).json();if(!caps.auth_configured||caps.models.some(m=>!m.key_configured))throw Error('LIVE_IMAGE_KEYS_NOT_VISIBLE');
const receipt={schema:request.schema,status:'PRIVATE_FUNCTIONS_CONFIGURATION_VERIFIED',request_id:request.request_id,site_id:site,storage:'private-encrypted-netlify-vault',session_status:session.status,library_status:library.status,wrong_password_status:negative.status,configured_image_models:caps.models.map(m=>m.key),real_provider_calls:0};
payload=null;
await writeFile('dualframe-config-receipt.json',JSON.stringify(receipt,null,2)+'\n');await publish({...receipt,expires_at:request.expires_at});console.log(JSON.stringify(receipt));

