import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const packageId='andaluzija-2027-guide';
export const travelTopics=['overview','itinerary','page-guide','food-culture','practical','tickets-access'];
// Included deployment files, never a mutable main fetch or a private page fetch.
const root=()=>new URL('./public/ai/skills/', 'file://'+process.cwd()+'/');
export async function travelKnowledge({read=path=>readFile(new URL(path,root()),'utf8')}={}){
 const registry=JSON.parse(await read('registry.json')),entry=registry.skills.find(s=>s.id===packageId&&s.availability==='ready');
 if(!entry||entry.version!=='1.1.0')throw Error('SKILL_UNAVAILABLE');
 const checked=new Map();
 async function load(path){
  if(!(path in entry.file_hashes)||path.includes('..'))throw Error('REFERENCE_UNAVAILABLE');
  const text=await read(packageId+'/'+path);if(text.length>50000||createHash('sha256').update(text).digest('hex')!==entry.file_hashes[path])throw Error('SKILL_HASH_MISMATCH');
  checked.set(path,entry.file_hashes[path]);return text;
 }
 const skill=await load('SKILL.md'),actions=await load('references/actions.md'),visits=JSON.parse(await load('references/visits.json'));
 return {skill,actions,visits,reference:async city=>{if(!Object.hasOwn(visits,city))throw Error('UNKNOWN_CITY');return load('references/'+city+'.md');},topic:async name=>{if(!travelTopics.includes(name))throw Error('UNKNOWN_TOPIC');return load('references/'+name+'.md');},receipt:()=>({id:packageId,version:entry.version,files:Object.fromEntries(checked)})};
}
