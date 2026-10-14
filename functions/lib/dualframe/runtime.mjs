import {getStore} from '@netlify/blobs';
import {createService} from './service.mjs';
import {decryptConfiguration} from './config-crypto.mjs';
export const VAULT_KEY='configuration/private-v3';
export const configurationStore=()=>getStore({name:'dualframe-rd-v3',consistency:'strong'});
export async function runtimeService(){const store=configurationStore(),pack=await store.get(VAULT_KEY,{type:'json',consistency:'strong'});let values={};if(pack)values=decryptConfiguration(pack,Netlify.env.get('GEMINI_API_KEY'));return createService({store,env:key=>Netlify.env.get(key)||values[key]});}
