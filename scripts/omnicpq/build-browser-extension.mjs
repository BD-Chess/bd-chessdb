// Reproducible STORE ZIP with reviewed source only. No npm dependency or private input.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {STARTERS} from '../../public/OmniCPQ/starters.mjs';
const root=new URL('../../public/OmniCPQ/',import.meta.url);
const source=new URL('extension/',root);
const names=['manifest.json','worker.mjs','page.mjs','worker-v2.mjs','page-v2.mjs','popup.html','popup.mjs','popup.css'];
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
export function zipStore(entries){
  const locals=[],directory=[];let offset=0;
  for(const [path,bytes] of entries){
    const name=Buffer.from(path),crc=crc32(bytes),header=Buffer.alloc(30),central=Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x0800,6);
    header.writeUInt16LE(0x5d57,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(bytes.length,18);header.writeUInt32LE(bytes.length,22);header.writeUInt16LE(name.length,26);
    central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x0800,8);
    central.writeUInt16LE(0x5d57,14);central.writeUInt32LE(crc,16);central.writeUInt32LE(bytes.length,20);central.writeUInt32LE(bytes.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(offset,42);
    locals.push(header,name,bytes);directory.push(central,name);offset+=header.length+name.length+bytes.length;
  }
  const records=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(records.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,records,end]);
}
export async function buildBrowserExtension(){
  const entries=[];for(const name of names)entries.push(['OmniCPQ_Browser_Bridge_R6/'+name,await readFile(new URL(name,source))]);
  entries.push(['OmniCPQ_Browser_Bridge_R6/icon-32.png',await readFile(new URL('icons/favicon-32.png',root))]);
  entries.push(['OmniCPQ_Browser_Bridge_R6/README.txt',Buffer.from('OmniCPQ Browser Bridge R6\nNavodilo: https://www.mdlxdcc.org/omnicpq/browser-help.html\nNamestitev in povezavo odobri uporabnik. Razvojna distribucija, ni objava v trgovini.\nDostop: activeTab, scripting, storage, debugger; samo izbrani CPQ GUI po potrditvah.\nBrez API kljucev, gesel, zasebnega znanja, analitike ali oddaljene kode.\n')]);
  const bytes=zipStore(entries);await writeFile(new URL('OmniCPQ_Browser_Bridge_R6.zip',root),bytes);
  await writeFile(new URL('OMNICPQ_ZACETNI_POZIVI_12_R6.txt',root),STARTERS.map((p,i)=>`${i+1}. ${p.title}\n${p.message}\n`).join('\n'));
  const manifest=JSON.parse(await readFile(new URL('manifest.json',source),'utf8'));
  const receipt={version:manifest.version,filename:'OmniCPQ_Browser_Bridge_R6.zip',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  await writeFile(new URL('browser-extension-integrity.json',root),JSON.stringify(receipt,null,2)+'\n');return receipt;
}
