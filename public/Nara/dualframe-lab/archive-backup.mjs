// Bounded, uncompressed private archive. Image bytes remain Blob slices;
// neither export nor restore builds a library-sized base64/JSON string.
import {sha256} from './core.mjs?v=3.0-r4.11';
import {zipStore} from './zip-store.mjs?v=3.0-r4.1';
const SCHEMA='bd.dualframe.archive.v2',MAX_FILE=0xffffffff,MAX_ASSET=64*1048576,MAX_META=16*1048576;
const fail=()=>{throw Error('INVALID_BACKUP');};
export async function archiveBackup(pairs,scores,{hydratePair,getBlob,onProgress=()=>{}}){
 const entries=new Map(),metadata=[];
 async function encode(value){
  if(value instanceof Blob||value?.__df_blob===1){
   const blob=value instanceof Blob?value:await getBlob(value);if(!(blob instanceof Blob)||blob.size>MAX_ASSET)throw Error('BACKUP_ASSET_LIMIT');
   const hash=await sha256(blob),name='assets/'+hash+'.bin';if(!entries.has(name))entries.set(name,{name,blob});
   return {__df_backup_asset:hash,size:blob.size,type:blob.type};
  }
  if(Array.isArray(value)){const out=[];for(const item of value)out.push(await encode(item));return out;}
  if(value&&typeof value==='object'){const out={};for(const [key,item] of Object.entries(value))if(!['__proto__','constructor','prototype','upload_id','gateway_job_id','url'].includes(key))out[key]=await encode(item);return out;}
  return value;
 }
 for(const [i,pair] of pairs.entries()){metadata.push(await encode(pair));onProgress({done:i+1,total:pairs.length});}
 const manifest=new Blob([JSON.stringify({archive_schema:SCHEMA,schema:'bd.dualframe.backup.v1',pairs:metadata,scores:await encode(scores)})],{type:'application/json'});
 if(manifest.size>MAX_META)throw Error('BACKUP_METADATA_LIMIT');
 return zipStore([{name:'manifest.json',blob:manifest},...entries.values()]);
}
export async function readArchiveBackup(file){
 if(!(file instanceof Blob)||file.size>MAX_FILE)throw Error('BACKUP_ARCHIVE_LIMIT');
 const entries=new Map();let offset=0;
 while(offset+4<=file.size){
  const signature=new DataView(await file.slice(offset,offset+4).arrayBuffer()).getUint32(0,true);if(signature===0x02014b50||signature===0x06054b50)break;
  if(signature!==0x04034b50||entries.size>=20000||offset+30>file.size)fail();
  const header=new DataView(await file.slice(offset,offset+30).arrayBuffer()),size=header.getUint32(18,true),raw=header.getUint32(22,true),names=header.getUint16(26,true),extra=header.getUint16(28,true);
  if(header.getUint16(8,true)!==0||(header.getUint16(6,true)&9)||size!==raw||names>256||extra>4096||offset+30+names+extra+size>file.size)fail();
  const name=await file.slice(offset+30,offset+30+names).text();
  if(!/^assets\/[a-f0-9]{64}\.bin$/.test(name)&&name!=='manifest.json'||entries.has(name)||size>(name==='manifest.json'?MAX_META:MAX_ASSET))fail();
  const start=offset+30+names+extra;entries.set(name,file.slice(start,start+size));offset=start+size;
 }
 if(!entries.has('manifest.json'))fail();
 const data=JSON.parse(await entries.get('manifest.json').text());if(data.archive_schema!==SCHEMA||data.schema!=='bd.dualframe.backup.v1'||!Array.isArray(data.pairs)||data.pairs.length>10000)fail();
 const checked=new Map();
 async function decode(value){
  if(value&&typeof value==='object'&&Object.hasOwn(value,'__df_backup_asset')){
   const hash=value.__df_backup_asset;if(!/^[a-f0-9]{64}$/.test(hash)||!Number.isSafeInteger(value.size)||typeof value.type!=='string'||value.type.length>200)fail();
   const blob=entries.get('assets/'+hash+'.bin');if(!blob||blob.size!==value.size)fail();
   if(!checked.has(hash)){if(await sha256(blob)!==hash)fail();checked.set(hash,true);}
   return blob.slice(0,blob.size,value.type);
  }
  if(Array.isArray(value)){const out=[];for(const item of value)out.push(await decode(item));return out;}
  if(value&&typeof value==='object'){const out={};for(const [key,item] of Object.entries(value))if(!['__proto__','constructor','prototype','upload_id','gateway_job_id','url'].includes(key))out[key]=await decode(item);return out;}
  return value;
 }
 // Verify every referenced image before the caller commits any record.
 return decode(data);
}
