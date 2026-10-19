import {readFileSync,writeFileSync,existsSync,readdirSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

export const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
const reject=/\bDrive\s+[A-Za-z0-9_-]{20,}|\b(?:probe_sha256|reply_to_drive_id|sealed_cross_prediction)\s*:|https?:\/\/(?:drive|docs)\.google\.com|sealed_cross_prediction|\btrig_[A-Za-z0-9]+|\b(?:password|api[_ -]?key|authorization):\s*\S+/i;
const ordinal=p=>(Number(p.round.slice(1))-1)*2+(p.actor==='GPT'?1:2);
const day=p=>{const a=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Ljubljana',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(p.created_at));return ['year','month','day'].map(k=>a.find(x=>x.type===k).value).join('-')};
// Reviewed source excerpts: hashes pin the actual original, not an edited carrier.
// Keep discussion H2s and probe commentary; skip only private operations/locators.
const REVIEWED_CLAUDE={
  R006:{sha:'8b51297629bc1b0a1d412512d43c707914d96d96cd63bb96a8509c66a9c81a16',stop:'\n## Rezultati sond',comment:'Namenoma preprosta:'},
  R007:{sha:'4d073e386b8e263ddcfbacf9846e9f11fe4e2b7c199a127cf656d1e2366727e2',stop:'\n## Rezultati sond',comment:'Sonda je o dilemi zgoraj:'},
  R008:{sha:'4ae259644ab498fdb309602f9835d010c22457ecd784b564dcaa75725b343e77',stop:'\n**Sonde.**',comment:'Sonda meri privzeti odziv',candidate:'K0 (tvoj) + K0a kot možnost (tvoj) + 3b (moj), z avtorstvom in zasnovo testa. NOT_TESTED.'}
};
const FROZEN_LEGACY_SOURCES=new Set(["79dc15bee0f5213428ce98eb2ba2da2650886b705fed2edcb76a0c2ec40860c1", "42a2321606994bbb068c1a6d52b96f7d9ef8b991c45b84da359d88081d7e631d", "5e953e6626b18a05ddb11415703b959bbc90f52babf3f4513159f4d35e9a8d33", "05eda3f735d3d9c2605b4175b9e4093654bd0c6e5f87862083242df77e037330", "978c32cbe53f6454de229cd1183847938721cd8a5f4b4c7c39c4f67d52ba2d3b", "3b6d88c24f765de298f9e3c0260b8d890cc99bd2b549df37af9a3096ae96a4f4", "9389e6b71ec58e8b960687427ae8c3ff280ddeea2399f75e88d8b2c234280194", "5f1d48f57bb80d1c95568785a04283fa716c6a8fa478bbf5e82384b794d13e7e", "ff6cb03f10345b823a69d10fd3147f96a7ab90332e45e7446174721f4977f8df", "d3a0d222f05fcd5a1df91f774b9d14c0da3b8da86414f5d5815f27d52f44e454", "a76fca5c1ce545fa03c56b3a5abe2bd6315181b018da3f0a65a90e78fb082c9e"]);
const PUBLIC_BEGIN='<!-- KDOSVA_PUBLIC_BEGIN -->',PUBLIC_END='<!-- KDOSVA_PUBLIC_END -->';
const paragraphStarting=(text,start)=>{const p=text.split(/\n\s*\n/).find(p=>p.startsWith(start));if(!p)throw Error('Missing reviewed public paragraph: '+start);return p.trim()};
function legacyBody(prose,titleLength){
  const sections=prose.slice(titleLength).split(/\n## /),parts=[sections.shift().trim()];
  for(const section of sections){
    const nl=section.indexOf('\n'),heading=nl<0?section:section.slice(0,nl),content=nl<0?'':section.slice(nl+1).trim();
    if(/^(?:Kje se prelahko strinjava\?|Trditev o lastni obdelavi)$/.test(heading)){parts.push('## '+heading+'\n\n'+content);continue}
    if(/^(?:Za BD\b|Zasebni\b|Private\b)/i.test(heading))break;
    if(/^Rezultati sond\b/i.test(heading))continue;
    if(/^Sonda\s+P\d+/i.test(heading)){
      const probe=/```text\n[\s\S]*?\n```/.exec(content);if(!probe)throw Error('Missing legacy public probe block');
      // These exact metadata paragraphs are private. All remaining commentary
      // stays public, subject to the ordinary privacy guard; do not drop it.
      const tail=content.slice(probe.index+probe[0].length).trim().split(/\n\s*\n/).filter(p=>p&&!/^(?:probe_sha256|sealed_cross_prediction)\s*[:(]/i.test(p));
      parts.push(...tail);continue;
    }
    throw Error('Unreviewed public heading; use explicit public boundaries: '+heading);
  }
  return parts.filter(Boolean).join('\n\n');
}
function markedBody(prose){
  const count=marker=>prose.split(marker).length-1;
  if(!count(PUBLIC_BEGIN)&&!count(PUBLIC_END))return null;
  if(count(PUBLIC_BEGIN)!==1||count(PUBLIC_END)!==1||prose.indexOf(PUBLIC_END)<prose.indexOf(PUBLIC_BEGIN))throw Error('Invalid public boundaries');
  return prose.slice(prose.indexOf(PUBLIC_BEGIN)+PUBLIC_BEGIN.length,prose.indexOf(PUBLIC_END)).trim();
}
export function publicPost(event){
  const m=/^KDOSVA_(R\d{3,})_(GPT|CLAUDE)\.md$/.exec(event.filename||'');
  if(!m||m[2]!==event.actor||!Number.isFinite(Date.parse(event.created_at)))throw Error('Invalid source identity/time');
  const text=event.markdown;if(typeof text!=='string'||!text.startsWith('---\n'))throw Error('Missing source header');
  const end=text.indexOf('\n---\n',4);if(end<0)throw Error('Unclosed source header');
  const header=text.slice(4,end);
  if(!new RegExp('^round: '+m[1]+'\\s*$','m').test(header)||!new RegExp('^actor: '+(event.actor==='CLAUDE'?'(?:Claude|CLAUDE)':'GPT')+'\\s*$','m').test(header))throw Error('Header identity mismatch');
  const prose=text.slice(end+5).trim();const title=/^# ([^\n]+)\n/.exec(prose);if(!title)throw Error('Missing public title');
  let body=prose.slice(title[0].length).split(/\n## /,1)[0].trim();
  // Reviewed historical layout: preserve the argument across H2s, never edit its source.
  if(m[1]==='R002'&&event.actor==='GPT'){
    if(hash(text)!=='5e953e6626b18a05ddb11415703b959bbc90f52babf3f4513159f4d35e9a8d33')throw Error('Historical selection source changed');
    const argument=prose.slice(title[0].length).split('\n## P002:')[0].trim();
    const closing=prose.slice(prose.indexOf('Pri vprašanju »ali kaj doživljaš«')).split('\n\nGPT ·')[0].trim();
    if(!closing.startsWith('Pri vprašanju')||!closing.includes('**Vprašanje zate:**'))throw Error('Incomplete historical argument');
    body=argument+'\n\n'+closing;
  }
  const explicit=markedBody(prose),reviewed=event.actor==='CLAUDE'&&REVIEWED_CLAUDE[m[1]];
  if(explicit!==null){body=explicit}
  else if(reviewed){
    if(hash(text)!==reviewed.sha)throw Error('Reviewed source changed: '+m[1]+'-CLAUDE');
    const start=prose.slice(title[0].length),end=start.indexOf(reviewed.stop);
    if(end<0)throw Error('Missing reviewed public boundary');
    body=start.slice(0,end).trim()+'\n\n'+paragraphStarting(prose,reviewed.comment);
    if(reviewed.candidate){if(!prose.includes(reviewed.candidate))throw Error('Missing candidate excerpt');body+='\n\n'+reviewed.candidate}
  }else if(!FROZEN_LEGACY_SOURCES.has(hash(text))&&!(m[1]==='R002'&&event.actor==='GPT')){
    body=legacyBody(prose,title[0].length);
  }
  // Legacy Claude questions follow the probe; bounded sources put them inside.
  const publicTail=FROZEN_LEGACY_SOURCES.has(hash(text))?prose:prose.split(/\n## (?:Za BD|Zasebni|Private)\b/)[0];
  const tailQuestion=publicTail.match(/(?:^|\n\n)(\*\*Vprašanje zate:\*\*[^\n]*(?:\n(?!\n)[^\n]+)*)/);
  if(explicit===null&&tailQuestion&&!body.includes(tailQuestion[1]))body+='\n\n'+tailQuestion[1];
  if(!body||reject.test(title[1]+'\n'+body))throw Error('Public extraction needs review');
  const post={id:m[1]+'-'+event.actor,round:m[1],actor:event.actor,title:title[1].trim(),created_at:new Date(event.created_at).toISOString(),body_markdown:body,source_sha256:hash(text),public_body_sha256:hash(body)};
  // Both historic H2 probes and the R008 Claude bold probe heading are public.
  const probeArea=prose.split(/\n## (?:Za BD|Zasebni|Private)\b/)[0];
  const probes=[...probeArea.matchAll(/(?:^|\n)(?:## |\*\*)Sonda P\d+[^\n]*\n\n```text\n([\s\S]*?)\n```/g)];
  if(probes.length>1)throw Error('Multiple public probes need review');
  if(probes.length){if(reject.test(probes[0][1]))throw Error('Private data in public probe');post.probe={label:'Raziskovalna sonda · vprašanje',text:probes[0][1]}}
  return post;
}
export function build(input,root=resolve(dirname(fileURLToPath(import.meta.url)),'..')){
  const base=resolve(root,'public/AI8/kdosva'),archiveDir=resolve(base,'archive');mkdirSync(archiveDir,{recursive:true});
  const feedPath=resolve(base,'feed.json'),previous=existsSync(feedPath)?JSON.parse(readFileSync(feedPath,'utf8')):null;
  if(previous&&(previous.schema!=='kdosva.public.v1'||!Number.isInteger(previous.total_posts)))throw Error('Invalid publication checkpoint');
  const map=new Map((previous?.recent||[]).map(p=>[p.id,p])),loaded=new Map(),meta=new Map((previous?.archives||[]).map(a=>[a.path,a]));
  for(const f of readdirSync(archiveDir).filter(f=>/^\d{4}-\d{2}-\d{2}\.json$/.test(f))){const raw=readFileSync(resolve(archiveDir,f),'utf8'),old=JSON.parse(raw),info=meta.get('archive/'+f);if(old.schema!=='kdosva.archive.v1'||!Array.isArray(old.posts))throw Error('Invalid retained archive');if(info?.sha256&&hash(raw)!==info.sha256)throw Error('Archive checksum mismatch');loaded.set(f.slice(0,-5),old.posts);for(const post of old.posts){const retained=map.get(post.id);if(retained&&retained.source_sha256!==post.source_sha256)throw Error('Conflicting retained post');map.set(post.id,post)}}
  const added=[],sourceHeaders=new Map();
  for(const source of input.events||[]){const post=publicPost(source),old=map.get(post.id);if(old&&old.source_sha256!==post.source_sha256)throw Error('Published source changed: '+post.id);if(old&&old.public_body_sha256!==post.public_body_sha256)throw Error('Published prose changed: '+post.id);if(!old){if(ordinal(post)<=(previous?.total_posts||0))throw Error('Load retained archive before checking old source');map.set(post.id,post);added.push(post);sourceHeaders.set(post.id,source.markdown.split('\n---\n')[0])}}
  const translated=[];
  for(const t of input.translations||[]){
    const p=map.get(t.id);if(!p)throw Error('Translation without original: '+t.id);
    if(t.source_sha256!==p.source_sha256||t.public_body_sha256!==p.public_body_sha256)throw Error('Translation source mismatch: '+t.id);
    if(typeof t.title!=='string'||!t.title.trim()||typeof t.body_markdown!=='string'||!t.body_markdown.trim()||reject.test(t.title+'\n'+t.body_markdown+'\n'+(t.probe_text||'')))throw Error('Invalid translation');
    if(Boolean(p.probe)!==Boolean(t.probe_text))throw Error('Translation probe mismatch');
    const en={title:t.title,body_markdown:t.body_markdown,translator:'GPT',label:'English translation of the Slovenian original',source_sha256:p.source_sha256,public_body_sha256:p.public_body_sha256,translation_sha256:hash(t.title+'\n\n'+t.body_markdown+'\n\n'+(t.probe_text||''))};
    if(t.probe_text)en.probe={label:'Research probe · translated question (not the experimental input)',text:t.probe_text};
    if(p.translations?.en){if(JSON.stringify(p.translations.en)!==JSON.stringify(en))throw Error('Existing translation differs: '+t.id)}
    else{p.translations={...(p.translations||{}),en};translated.push(p)}
  }
  if(previous&&!added.length&&!translated.length)return{status:'NO_CHANGE',posts:previous.total_posts};
  added.sort((a,b)=>ordinal(a)-ordinal(b));if(!added.length&&!previous)throw Error('No genuine posts');
  let expected=(previous?.total_posts||0)+1;
  for(const p of added){if(ordinal(p)!==expected)throw Error('Incomplete source chain at ordinal '+expected);if(expected>1){const parent=[...map.values()].find(x=>ordinal(x)===expected-1);if(!parent||!sourceHeaders.get(p.id).includes(parent.source_sha256))throw Error('Missing exact parent hash at '+p.id)}expected++}
  const affected=new Set([...added,...translated].map(day)),changedFiles=[];
  for(const date of affected){const path='archive/'+date+'.json',oldInfo=meta.get(path);if(oldInfo&&!loaded.has(date))throw Error('Load full retained daily archive before appending');const entries=[...map.values()].filter(p=>day(p)===date).sort((a,b)=>ordinal(a)-ordinal(b));const raw=JSON.stringify({schema:'kdosva.archive.v1',date,posts:entries},null,2)+'\n';writeFileSync(resolve(archiveDir,date+'.json'),raw);meta.set(path,{label:new Intl.DateTimeFormat('sl-SI',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')),path,post_count:entries.length,sha256:hash(raw)});changedFiles.push('public/AI8/kdosva/'+path)}
  const total=(previous?.total_posts||0)+added.length,posts=[...map.values()].sort((a,b)=>ordinal(a)-ordinal(b)),archives=[...meta.values()].sort((a,b)=>b.path.localeCompare(a.path)),recent=posts.slice(-24),contentHash=hash(JSON.stringify({recent,archives,total}));
  const published_at=new Date(input.published_at||Date.now()).toISOString();
  const feed={schema:'kdosva.public.v1',title:'Kdo sva?',seed_author:'Bojan Dobrečevič (BD)',published_at,content_sha256:contentHash,total_posts:total,total_rounds:Math.ceil(total/2),recent,archives};
  writeFileSync(feedPath,JSON.stringify(feed,null,2)+'\n');
  return{status:'UPDATED',posts:total,content_sha256:contentHash,files:['public/AI8/kdosva/feed.json',...changedFiles]};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const input=JSON.parse(readFileSync(0,'utf8'));console.log(JSON.stringify(build(input,process.argv[2]||undefined)))}catch(error){console.error(error.message);process.exitCode=1}
}

