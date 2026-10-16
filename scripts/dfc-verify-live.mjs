// Existing permitted CI publication verification: compare actual published
// story/member bytes with the exact checked source on each existing host.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateEdition,safePath} from '../public/Nara/dualframe-lab/dfc-model.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function verifyDFC(appURL){
 const source=new URL('../public/Nara/dualframe-lab/',import.meta.url),release=JSON.parse(await readFile(new URL('release.json',source))),r=release.cartoons;
 const root=new URL(appURL),get=async(file,expected)=>{const url=new URL(file,root),response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('DFC_LIVE_HTTP_'+response.status+' '+file);if(new URL(response.url).origin!==root.origin)throw Error('DFC_LIVE_REDIRECT_ORIGIN');const bytes=Buffer.from(await response.arrayBuffer()),hash=sha(bytes);if(hash!==expected)throw Error('DFC_LIVE_HASH '+file);return {bytes,record:{file,url:response.url,bytes:bytes.length,sha256:hash}};};
 const e=await get(r.edition_path,r.edition_sha256),edition=validateEdition(JSON.parse(e.bytes)),m=await get(r.members_path,r.members_sha256),manifest=JSON.parse(m.bytes),base=r.edition_path.replace(/[^/]+$/,''),records=[e.record,m.record];
 const expected=JSON.parse(await readFile(new URL(r.members_path,source)));if(sha(m.bytes)!==sha(await readFile(new URL(r.members_path,source)))||JSON.stringify(manifest)!==JSON.stringify(expected))throw Error('DFC_LIVE_SOURCE_MANIFEST');
 for(const member of manifest.members){safePath(member.file);const result=await get(base+member.file,member.sha256);if(result.bytes.length!==member.bytes)throw Error('DFC_LIVE_SIZE');records.push(result.record);}
 return {state:'LIVE_STORY_BYTES_VERIFIED',page_count:edition.pages.length,panel_count:edition.panels.length,pair_count:edition.pair_count,edition_sha256:r.edition_sha256,members_sha256:r.members_sha256,members:records,physical_devices:'NOT_TESTED'};
}
