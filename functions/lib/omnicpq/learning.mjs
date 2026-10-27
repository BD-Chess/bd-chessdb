import {createHash} from 'node:crypto';
import manifest from './learning-manifest-r1.json' with {type:'json'};
import {documentStore} from './private-documents.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const LEARNING_NAME=manifest.name;
export const LEARNING_KEY='learning/'+manifest.version+'/'+manifest.sha256+'.json';
export {manifest as LEARNING_MANIFEST};
export function verifyLearning(text,expected=manifest){
  if(typeof text!=='string'||Buffer.byteLength(text)!==expected.size||sha(text)!==expected.sha256)throw Error('LEARNING_INTEGRITY');
  const data=JSON.parse(text);
  if(data.schema!=='omnicpq.learning.v1'||data.version!==expected.version||!Array.isArray(data.records))throw Error('LEARNING_INTEGRITY');
  for(const record of data.records){
    if(!/^[a-z0-9-]+$/.test(record.id)||!Array.isArray(record.sources))throw Error('LEARNING_INTEGRITY');
    for(const source of record.sources)if(typeof source.text!=='string'||sha(source.text)!==source.sha256)throw Error('LEARNING_SOURCE_INTEGRITY');
  }
  return data;
}
export async function readLearning({reader,expected=manifest}={}){
  const text=reader?await reader():await (await documentStore()).get(LEARNING_KEY,{type:'text',consistency:'strong'});
  return {data:verifyLearning(text,expected),bytes:Buffer.from(text),mime:'application/json; charset=utf-8',sha256:expected.sha256,version:expected.version};
}
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function recordHTML(record){
  const layers=[['Poslovni namen in primer',record.purpose],['Tehnično delovanje',record.operation],['TS posebnosti in omejitve',record.ts],['Življenjski cikel',record.lifecycle],['PLM, OmniCPQ in nadaljnji sistemi',record.systems]];
  return `<section id="learn-${escape(record.id)}" class="learning-layer"><h3>Poglobljeno za IT analitika</h3><p>${escape(record.coverage)}</p>`+
    layers.map(([title,layer])=>`<h4>${escape(title)} · ${escape(layer.status)}</h4><p>${escape(layer.text)}</p>${layer.example?`<p>Primer: ${escape(layer.example)}</p>`:''}${layer.limits?`<p>Meje: ${escape(layer.limits)}</p>`:''}`).join('')+
    '<h4>Vprašanja za poslovni pogovor · PREDLOG</h4><ul>'+record.questions.map(q=>`<li>${escape(q)}</li>`).join('')+'</ul><h4>Viri in odločilni odseki</h4>'+
    record.sources.map(s=>`<details><summary>${escape(s.path)} · ${escape(s.status)}</summary><p>${escape(s.locator)}<br>SHA-256: ${escape(s.sha256)}</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(s.text)}</pre></details>`).join('')+
    '<h4>Odprto</h4><ul>'+record.gaps.map(q=>`<li>${escape(q)}</li>`).join('')+`</ul><p>${escape(record.provenance.originalArchiveAccess)}</p></section>`;
}
export function enrichGuide(item,learning=null){
  let html=item.bytes.toString('utf8');
  html=html.replace(/<title>[\s\S]*?<\/title>/,'<title>Vodič za B2B storitve v TS · v18</title>')
    .replace('<strong>3</strong><span>načini uporabe pomočnika','<strong>5</strong><span>načini uporabe pomočnika');
  const modes='<section id="pet-nacinov"><h2>Pet načinov · en pomočnik</h2><p>Vodič → Zahteve → Modeliranje → OmniCPQ → Testiranje E2E. PLM testi so sestavni del Testiranja. Storitev, zahteva, model, dokument/postavka in razrešene odločitve ostanejo v istem pogovoru. Stari trije vsebinski pozivi so ohranjeni z združljivo preslikavo.</p></section>';
  html=html.replace('</main>',modes+'</main>');
  if(learning)for(const record of learning.records){
    const start=html.indexOf(`id="${record.id}"`);if(start<0)throw Error('LEARNING_CARD_MISSING');
    const open=html.lastIndexOf('<details',start),tags=/<details\b|<\/details>/g;tags.lastIndex=open;let depth=0,match,end=-1;
    while((match=tags.exec(html))){depth+=match[0].startsWith('</')?-1:1;if(depth===0){end=match.index;break;}}
    if(end<0)throw Error('LEARNING_CARD_INVALID');html=html.slice(0,end)+recordHTML(record)+html.slice(end);
  }
  const coverage=learning?'<p>Učna plast: pet pilotnih skupin, sedem kartic; drugje ostaja opisna/delna pokritost. 59 kandidatnih dopolnitev ni integriranih.</p>':'<p>Poglobljena učna plast še ni potrjeno dosegljiva. Osnovni v18 opisi in slike ostanejo; aktualne TS vrzeli se ne dopolnijo z ugibanjem.</p>';
  html=html.replace('</main>',coverage+'</main>');
  const bytes=Buffer.from(html);return {...item,bytes,size:bytes.length,sha256:sha(bytes),version:learning?'v18+ts-pilot-r1':'v18+five-modes-r1'};
}
