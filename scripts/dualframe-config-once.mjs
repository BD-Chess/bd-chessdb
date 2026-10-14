import {generateKeyPairSync,privateDecrypt,createDecipheriv,randomUUID,constants} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
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
const info=await api('sites/'+site),path='accounts/'+info.account_id+'/env',existing=await api(path+'?site_id='+site),newVars=[];
for(const key of allowed){const variable={key,is_secret:key!=='DF_QWEN_API_HOST',scopes:['functions'],values:[{context:'all',value:payload.values[key]}]};
 if(existing.some(v=>v.key===key))await api(path+'/'+encodeURIComponent(key)+'?site_id='+site,'PUT',variable);else newVars.push(variable);
}
if(newVars.length)await api(path+'?site_id='+site,'POST',newVars);
payload=null;
const vars=await api(path+'?site_id='+site),metadata=allowed.map(key=>{const v=vars.find(x=>x.key===key);return {key,present:!!v,secret:v?.is_secret===true,functions_scope:v?.scopes.includes('functions')===true};});
const ok=metadata.every(v=>v.present&&v.functions_scope&&(v.key==='DF_QWEN_API_HOST'||v.secret));
const receipt={schema:request.schema,status:ok?'FUNCTIONS_SECRETS_VERIFIED':'CONFIGURATION_INCOMPLETE',request_id:request.request_id,site_id:site,credential_metadata:metadata,real_provider_calls:0};
await writeFile('dualframe-config-receipt.json',JSON.stringify(receipt,null,2)+'\n');await publish({...receipt,expires_at:request.expires_at});console.log(JSON.stringify(receipt));
if(!ok)throw Error('CONFIGURATION_NOT_VERIFIED');
