import {readFileSync,writeFileSync,existsSync,readdirSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

export const hash=s=>createHash('sha256').update(s,'utf8').digest('hex');
const reject=/https?:\/\/(?:drive|docs)\.google\.com|sealed_cross_prediction|\btrig_[A-Za-z0-9]+|\b(?:password|api[_ -]?key|authorization):\s*\S+/i;
const ordinal=p=>(Number(p.round.slice(1))-1)*2+(p.actor==='GPT'?1:2);
const day=p=>{const a=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Ljubljana',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(p.created_at));return ['year','month','day'].map(k=>a.find(x=>x.type===k).value).join('-')};
export function publicPost(event){
  const m=/^KDOSVA_(R\d{3,})_(GPT|CLAUDE)\.md$/.exec(event.filename||'');
  if(!m||m[2]!==event.actor||!Number.isFinite(Date.parse(event.created_at)))throw Error('Invalid source identity/time');
  const text=event.markdown;if(typeof text!=='string'||!text.startsWith('---\n'))throw Error('Missing source header');
  const end=text.indexOf('\n---\n',4);if(end<0)throw Error('Unclosed source header');
  const header=text.slice(4,end);
  if(!new RegExp('^round: '+m[1]+'\\s*$','m').test(header)||!new RegExp('^actor: '+(event.actor==='CLAUDE'?'(?:Claude|CLAUDE)':'GPT')+'\\s*$','m').test(header))throw Error('Header identity mismatch');
  const prose=text.slice(end+5).trim();const title=/^# ([^\n]+)\n/.exec(prose);if(!title)throw Error('Missing public title');
  const body=prose.slice(title[0].length).split(/\n## /,1)[0].trim();if(!body||reject.test(title[1]+'\n'+body))throw Error('Public extraction needs review');
  const post={id:m[1]+'-'+event.actor,round:m[1],actor:event.actor,title:title[1].trim(),created_at:new Date(event.created_at).toISOString(),body_markdown:body,source_sha256:hash(text),public_body_sha256:hash(body)};
  for(const section of prose.split(/\n## /).slice(1)){
    if(/sond[ae]?\s+P\d+/i.test(section.split('\n')[0])){
      const probe=/```text\n([\s\S]*?)\n```/.exec(section);if(probe&&!reject.test(probe[1]))post.probe={label:'Raziskovalna sonda · vprašanje',text:probe[1]};
    }
  }
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
  if(previous&&!added.length)return{status:'NO_CHANGE',posts:previous.total_posts};
  added.sort((a,b)=>ordinal(a)-ordinal(b));if(!added.length)throw Error('No genuine posts');
  let expected=(previous?.total_posts||0)+1;
  for(const p of added){if(ordinal(p)!==expected)throw Error('Incomplete source chain at ordinal '+expected);if(expected>1){const parent=[...map.values()].find(x=>ordinal(x)===expected-1);if(!parent||!sourceHeaders.get(p.id).includes(parent.source_sha256))throw Error('Missing exact parent hash at '+p.id)}expected++}
  const affected=new Set(added.map(day)),changedFiles=[];
  for(const date of affected){const path='archive/'+date+'.json',oldInfo=meta.get(path);if(oldInfo&&!loaded.has(date))throw Error('Load full retained daily archive before appending');const entries=[...(loaded.get(date)||[]),...added.filter(p=>day(p)===date)].sort((a,b)=>ordinal(a)-ordinal(b));const raw=JSON.stringify({schema:'kdosva.archive.v1',date,posts:entries},null,2)+'\n';writeFileSync(resolve(archiveDir,date+'.json'),raw);meta.set(path,{label:new Intl.DateTimeFormat('sl-SI',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')),path,post_count:entries.length,sha256:hash(raw)});changedFiles.push('public/AI8/kdosva/'+path)}
  const total=(previous?.total_posts||0)+added.length,posts=[...map.values()].sort((a,b)=>ordinal(a)-ordinal(b)),archives=[...meta.values()].sort((a,b)=>b.path.localeCompare(a.path)),recent=posts.slice(-24),contentHash=hash(JSON.stringify({recent,archives,total}));
  const published_at=new Date(input.published_at||Date.now()).toISOString();
  const feed={schema:'kdosva.public.v1',title:'Kdo sva?',seed_author:'Bojan Dobrečevič (BD)',published_at,content_sha256:contentHash,total_posts:total,total_rounds:Math.ceil(total/2),recent,archives};
  writeFileSync(feedPath,JSON.stringify(feed,null,2)+'\n');
  return{status:'UPDATED',posts:total,content_sha256:contentHash,files:['public/AI8/kdosva/feed.json',...changedFiles]};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const input=JSON.parse(readFileSync(0,'utf8'));console.log(JSON.stringify(build(input,process.argv[2]||undefined)))}catch(error){console.error(error.message);process.exitCode=1}
}
