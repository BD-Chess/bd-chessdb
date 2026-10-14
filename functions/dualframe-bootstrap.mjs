import {createHash,timingSafeEqual} from 'node:crypto';
import {configurationStore,VAULT_KEY} from './lib/dualframe/runtime.mjs';
import {encryptConfiguration} from './lib/dualframe/config-crypto.mjs';
const TOKEN_HASH='fdcd56d203852c7cae79b95e56637874c9cdc9d98fbfda619f74173525625edd',EXPIRES='2026-10-14T01:05:59.637Z';
const allowed=['DF_PASSWORD_VERIFIER','DF_SESSION_SECRET','DF_OPENAI_API_KEY','DF_GEMINI_API_KEY','DF_XAI_API_KEY','DF_QWEN_API_KEY','DF_MINIMAX_API_KEY','DF_ZAI_API_KEY','DF_MISTRAL_API_KEY','DF_QWEN_API_HOST'];
export default async req=>{
 const reply=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
 if(Date.now()>Date.parse(EXPIRES))return reply({error:'NOT_FOUND'},404);if(req.method!=='POST')return reply({error:'METHOD_NOT_ALLOWED'},405);
 const token=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';if(token.length!==64||!timingSafeEqual(createHash('sha256').update(token).digest(),Buffer.from(TOKEN_HASH,'hex')))return reply({error:'UNAUTHORIZED'},401);
 try{const raw=await req.text();if(raw.length>16000)return reply({error:'REQUEST_TOO_LARGE'},413);const values=JSON.parse(raw);
  if(Object.keys(values).sort().join('|')!==allowed.slice().sort().join('|')||Object.values(values).some(v=>typeof v!=='string'||v.length<8||v.length>2048)||values.DF_SESSION_SECRET.length<32||!values.DF_PASSWORD_VERIFIER.startsWith('pbkdf2-sha256:600000:'))return reply({error:'CONFIGURATION_INVALID'},400);
  const store=configurationStore();if(await store.get(VAULT_KEY,{type:'json',consistency:'strong'}))return reply({installed:true,already_configured:true});
  const encrypted=encryptConfiguration(values,Netlify.env.get('GEMINI_API_KEY')),result=await store.setJSON(VAULT_KEY,encrypted,{onlyIfNew:true});
  if(result.modified&&JSON.stringify(await store.get(VAULT_KEY,{type:'json',consistency:'strong'}))!==JSON.stringify(encrypted))return reply({error:'STORAGE_WRITE_UNCONFIRMED'},503);
  return reply({installed:true,storage:'private-encrypted-netlify-vault',configured_keys:allowed.length,real_provider_calls:0});
 }catch{return reply({error:'CONFIGURATION_FAILED'},503);}
};
export const config={rateLimit:{action:'rate_limit',aggregateBy:'ip',windowSize:60,windowLimit:8}};
