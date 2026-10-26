import {createHash} from 'node:crypto';
import manifest from './documents-manifest-v17.json' with {type:'json'};
export const DOCUMENT_STORE='omnicpq-documents-prod-v17';
export const DOCUMENT_KEY='v17/'+manifest.bundleSha256+'.json';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function verifyDocuments(text,expected=manifest){
  if(typeof text!=='string'||Buffer.byteLength(text)>1000000||sha(text)!==expected.bundleSha256)throw Error('DOCUMENT_INTEGRITY');
  const data=JSON.parse(text);
  if(data.schema!=='omnicpq.private_documents.v1'||data.documentVersion!=='v17'||Object.keys(data.files||{}).length!==Object.keys(expected.files).length)throw Error('DOCUMENT_INTEGRITY');
  const files=new Map();
  for(const [name,spec] of Object.entries(expected.files)){
    const item=data.files[name];if(!item||typeof item.base64!=='string'||item.mime!==spec.mime)throw Error('DOCUMENT_INTEGRITY');
    const bytes=Buffer.from(item.base64,'base64');if(bytes.toString('base64')!==item.base64||bytes.length!==spec.size||sha(bytes)!==spec.sha256)throw Error('DOCUMENT_INTEGRITY');
    files.set(name,{...spec,bytes});
  }
  return files;
}
export async function documentStore(){
  const {getStore}=await import('@netlify/blobs');
  return getStore({name:DOCUMENT_STORE,region:'eu-central-1',consistency:'strong'});
}
export async function readPrivateDocument(name,{reader,expected=manifest}={}){
  if(!Object.hasOwn(expected.files,name))throw Error('DOCUMENT_NOT_FOUND');
  const text=reader?await reader():await (await documentStore()).get(DOCUMENT_KEY,{type:'text',consistency:'strong'});
  if(!text)throw Error('DOCUMENT_UNAVAILABLE');
  return verifyDocuments(text,expected).get(name);
}
export {manifest as DOCUMENT_MANIFEST};
