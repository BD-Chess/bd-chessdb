// Metadata pins only. Full Word/HTML/Markdown bytes remain in the same private
// document store; no private release JSON is imported or discovered on disk.
import {createHash} from 'node:crypto';
import manifest from './documents-manifest-v18.json' with {type:'json'};
import {documentStore,readPrivateDocument} from './private-documents.mjs';
import {isVisualAsset} from './visual-documents.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export {manifest as RELEASE_DOCUMENT_MANIFEST};
export const RELEASE_DOCUMENT_KEY='v18/'+manifest.bundleSha256+'.json';
export function resolveReleaseName(name,expected=manifest){
  if(Object.hasOwn(expected.files,name))return name;
  const alias=Object.hasOwn(expected.aliases||{},name)&&expected.aliases[name];
  return alias&&Object.hasOwn(expected.files,alias)?alias:null;
}
export function verifyReleaseDocuments(text,expected=manifest){
  if(typeof text!=='string'||Buffer.byteLength(text)>1000000||sha(text)!==expected.bundleSha256)throw Error('DOCUMENT_INTEGRITY');
  const data=JSON.parse(text);
  if(data.schema!=='omnicpq.private_documents.v1'||data.documentVersion!==expected.documentVersion||Object.keys(data.files||{}).length!==Object.keys(expected.files).length)throw Error('DOCUMENT_INTEGRITY');
  const result=new Map();
  for(const [name,spec] of Object.entries(expected.files)){
    const raw=data.files[name];if(!raw||raw.mime!==spec.mime||typeof raw.base64!=='string')throw Error('DOCUMENT_INTEGRITY');
    const bytes=Buffer.from(raw.base64,'base64');if(bytes.toString('base64')!==raw.base64||bytes.length!==spec.size||sha(bytes)!==spec.sha256)throw Error('DOCUMENT_INTEGRITY');
    result.set(name,{...spec,bytes});
  }
  return result;
}
export async function readReleaseDocument(name,{reader,expected=manifest}={}){
  const actual=resolveReleaseName(name,expected);if(!actual)throw Error('DOCUMENT_NOT_FOUND');
  const text=reader?await reader():await (await documentStore()).get('v18/'+expected.bundleSha256+'.json',{type:'text',consistency:'strong'});
  return verifyReleaseDocuments(text,expected).get(actual);
}
export async function readCurrentPrivateDocument(name){return resolveReleaseName(name)?readReleaseDocument(name):readPrivateDocument(name);}
export function protectedReleaseRendition(item){
  if(!item.mime.startsWith('text/html'))return item;
  const html=item.bytes.toString('utf8').replace(/\b(src|data-normal|data-failed)="(slike-v18\/webp\/[a-z0-9-]+\.webp)"/g,(_,attr,name)=>{
    if(!isVisualAsset(name))throw Error('VISUAL_ASSET_NOT_FOUND');
    return attr+'="/.netlify/functions/omnicpq-documents?file='+name+'"';
  }).replace(/href="((?:B2B_[A-Za-z0-9_]+\.docx|b2b-[a-z0-9-]+\.html))"/g,(_,name)=>'href="/.netlify/functions/omnicpq-documents?file='+name+'"');
  const bytes=Buffer.from(html);return {...item,bytes,size:bytes.length,sha256:sha(bytes)};
}
