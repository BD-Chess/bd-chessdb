// Reproducible separate demo distribution. Original extension builder is unchanged.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {zipStore} from './build-browser-extension.mjs';
import {DEMO_EXTENSION_ID,DEMO_POLICY,DEMO_VERSION} from '../../public/OmniCPQ/extension-demo/privacy.mjs';
const root=new URL('../../public/OmniCPQ/',import.meta.url),source=new URL('extension-demo/',root);
const names=['manifest.json','worker.mjs','core-worker.mjs','page-v2.mjs','privacy.mjs','pairing.mjs','popup.html','popup.mjs'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function buildDemoExtension(){
 const manifest=JSON.parse(await readFile(new URL('manifest.json',source),'utf8'));
 const digest=createHash('sha256').update(Buffer.from(manifest.key,'base64')).digest('hex').slice(0,32);
 const identity=digest.replace(/[0-9a-f]/g,c=>String.fromCharCode(97+parseInt(c,16)));
 if(identity!==DEMO_EXTENSION_ID||manifest.version!==DEMO_VERSION||manifest.name!=='AI za OmniCPQ')throw Error('DEMO_PACKAGE_IDENTITY');
 const entries=[],files={};
 for(const name of names){const bytes=await readFile(new URL(name,source));entries.push(['AI_za_OmniCPQ_DEMO_v1/'+name,bytes]);files[name]=sha(bytes);}
 const icon=await readFile(new URL('icons/favicon-32.png',root));entries.push(['AI_za_OmniCPQ_DEMO_v1/icon-32.png',icon]);files['icon-32.png']=sha(icon);
 const readme=Buffer.from('AI za OmniCPQ · DEMO '+DEMO_VERSION+'\nNamestitev: https://www.mdlxdcc.org/omnicpq/demo-help.html\nLočeni pomočnik: https://www.mdlxdcc.org/omnicpq/demo/\nOmejeni STAGE demo: samo branje in potrjena navigacija.\nCene, tehnične vrednosti, prosto besedilo, slike, priloge in poslovni vnosi so izključeni.\nLokalna minimizacija ni potrdilo popolne anonimizacije.\nDejanski STAGE E2E, nameščeni soobstoj, neodvisni varnostni sprejem in odobritev TS niso potrjeni s paketom.\nNeposreden pogled ChatGPT Work, Copilot, osebni pomočnik in deljenje zaslona so drugi tokovi.\nIzvirne razširitve OmniCPQ · povezava 1.2.7 ne odstranjujte.\n');
 entries.push(['AI_za_OmniCPQ_DEMO_v1/README.txt',readme]);files['README.txt']=sha(readme);
 const bytes=zipStore(entries),filename='AI_za_OmniCPQ_DEMO_v1.zip';
 const receipt={schema:'omnicpq.demo_extension_integrity.v1',name:manifest.name,version:manifest.version,extensionId:identity,policy:DEMO_POLICY,filename,bytes:bytes.length,sha256:sha(bytes),files,
  acceptance:{synthetic:'SEE_TEST_RESULTS',installedCoexistence:'NOT_RUN',actualStageE2E:'NOT_RUN',independentSecurityReview:'NOT_RUN',tsApproval:'UNKNOWN'}};
 await writeFile(new URL(filename,root),bytes);
 await writeFile(new URL('demo-extension-integrity.json',root),JSON.stringify(receipt,null,2)+'\n');
 return receipt;
}
