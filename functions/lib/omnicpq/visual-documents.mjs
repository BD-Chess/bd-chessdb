import {createHash} from 'node:crypto';
import release from './documents/visual-release-v18.json' with {type:'json'};
import assets from './documents/visual-assets-v18.json' with {type:'json'};

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const marker=/<!--OMNICPQ-LEGACY:([a-z0-9-]+)-->/g;
export const VISUAL_DOCUMENT_VERSION=release.version;
export const VISUAL_GUIDE_NAMES=new Set([release.baseName,'b2b-vodic-v18.html']);
export const isVisualAsset=name=>Object.hasOwn(assets,name);

// Only layout, artwork and byte-range metadata are bundled with the function.
// The 58 service descriptions and original evidence still require private v17 storage.
export function renderVisualGuide(item,expected=release){
  const base=item?.bytes;
  if(!Buffer.isBuffer(base)||base.length!==expected.baseSize||sha(base)!==expected.baseSha256||
    typeof expected.template!=='string'||sha(expected.template)!==expected.templateSha256)throw Error('VISUAL_DOCUMENT_INTEGRITY');
  const used=new Set();
  const html=expected.template.replace(marker,(_,key)=>{
    const part=expected.fragments[key];
    if(!part||used.has(key)||!Number.isSafeInteger(part.offset)||!Number.isSafeInteger(part.size)||
      part.offset<0||part.size<0||part.offset+part.size>base.length)throw Error('VISUAL_DOCUMENT_INTEGRITY');
    const bytes=base.subarray(part.offset,part.offset+part.size);
    if(sha(bytes)!==part.sha256)throw Error('VISUAL_DOCUMENT_INTEGRITY');
    used.add(key);return bytes.toString('utf8');
  });
  const bytes=Buffer.from(html,'utf8');
  if(used.size!==Object.keys(expected.fragments).length||html.includes('<!--OMNICPQ-LEGACY:')||sha(bytes)!==expected.renderedSha256)throw Error('VISUAL_DOCUMENT_INTEGRITY');
  return {mime:'text/html; charset=utf-8',bytes,size:bytes.length,sha256:expected.renderedSha256,version:expected.version};
}

export function readVisualAsset(name){
  const item=Object.hasOwn(assets,name)&&assets[name];
  if(!item||item.mime!=='image/webp')throw Error('VISUAL_ASSET_NOT_FOUND');
  const bytes=Buffer.from(item.base64,'base64');
  if(bytes.toString('base64')!==item.base64||bytes.length!==item.size||sha(bytes)!==item.sha256||
    bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw Error('VISUAL_ASSET_INTEGRITY');
  return {mime:item.mime,bytes,size:bytes.length,sha256:item.sha256,version:release.version};
}
