/** BD-approved late publication of a finished Daily day that the nightly publisher held.
 * First use: 2026-11-02, decided by BD on 2026-11-08. Claude was out of its usage limit that day, GPT did Claude's
 * selection and editing as a recorded stand-in, and no genuine isolated reader scores were made.
 * The day keeps its own date. published_at is the real publication time on BD's decision date, and every record
 * carries the decision (late_publication), which the pages show. Such a day has no reader score.
 * The live monthly, archive and log pages are extended in place (publisher-placed sections stay where they are);
 * the Daily page and the story page are rendered by the regular generator.
 * CLI: node scripts/nara-daily-late.mjs publish <repoRoot> <late-batch.json>
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash,validDate,localParts,validateRecord,validateLog,validateLatePublication,loadRecords,latestPage,monthlyPage,logPage,featuredStoryPageOutputs} from './nara-daily.mjs';
import {instanceId,instanceRecordPath,instanceTranslationPath,dayManifestPath,validateInstanceRecord,instanceStoryHtml} from './nara-daily-batch.mjs';
import {generateFormatEditions} from './nara-format-editions.mjs';

const assert=(x,m)=>{if(!x)throw Error(m)};
const text=(s,n)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stringify=x=>JSON.stringify(x,null,2)+'\n';
const write=(p,s)=>{fs.mkdirSync(path.dirname(p),{recursive:true});if(fs.existsSync(p)&&fs.readFileSync(p,'utf8')===s)return false;const t=p+'.tmp';fs.writeFileSync(t,s);fs.renameSync(t,p);return true};
const INSTANCES=['S1','S2','S3'];
const ROLES=['GPT','CLAUDE'];
const STAGES=new Set(['STORY_SELECTION','AUTHOR_DRAFT','CRITIC_REVIEW','AUTHOR_REVISION','AUTHOR_FINAL','CRITIC_CLOSE']);

function validateLateLog(l,date,instance,record){
  assert(l&&l.schema==='nara.daily.instance_log.v1','instance log schema');
  const keys=['schema','id','story_id','day_id','date','instance','title','proposer','selector','author','critic','stand_in_for','rounds','final_critic_line'];
  assert(Object.keys(l).every(k=>keys.includes(k)),'unexpected late log field (a late day has no reader evaluation)');
  assert(l.id===`${instanceId(date,instance)}-LOG`&&l.story_id===instanceId(date,instance)&&l.day_id===`NARA-D-${date}`&&l.date===date&&l.instance===instance,'instance log identity');
  for(const k of ['proposer','selector','author','critic'])assert(ROLES.includes(l[k]),'log role');
  if(l.stand_in_for!==undefined)assert(ROLES.includes(l.stand_in_for)&&l.stand_in_for!==l.critic&&l.author===l.critic,'stand-in model');
  assert(l.author!==l.critic||l.stand_in_for!==undefined,'author and closing critic must be independent or a recorded stand-in');
  assert(l.title===record.title&&l.final_critic_line===record.critic_line,'log/record binding');
  assert(Array.isArray(l.rounds)&&l.rounds.length>=3&&l.rounds.length<=40,'log rounds');
  for(const r of l.rounds)assert(r&&Object.keys(r).every(k=>['actor','stage','summary'].includes(k))&&ROLES.includes(r.actor)&&STAGES.has(r.stage)&&text(r.summary,1800),'round content');
  assert(l.rounds.some(r=>r.stage==='AUTHOR_FINAL')&&l.rounds.some(r=>r.stage==='CRITIC_CLOSE'),'log close');
  return l;
}

export function validateLateBatch(b){
  assert(b&&b.schema==='nara.daily.late_publish.v1','late batch schema');
  assert(validDate(b.date)&&b.date>='2026-10-09','late batch date');
  const lp=validateLatePublication(b.late_publication,b.date);
  assert(text(b.published_at,40)&&/Z$/.test(b.published_at)&&Number.isFinite(Date.parse(b.published_at)),'published_at');
  const p=localParts(b.published_at);assert(`${p.year}-${p.month}-${p.day}`===lp.decided_on,'published_at is not on the decision date');
  assert(Array.isArray(b.candidates)&&b.candidates.length===10&&b.candidates.every(c=>c&&Object.keys(c).every(k=>['title','premise'].includes(k))&&text(c.title,180)&&text(c.premise,1200)),'candidates');
  assert(b.selection&&Object.keys(b.selection).every(k=>['title','reason','risk'].includes(k))&&text(b.selection.title,180)&&text(b.selection.reason,1200)&&text(b.selection.risk,1200),'selection');
  assert(Array.isArray(b.instances)&&b.instances.length>=1&&b.instances.length<=3,'late instances');
  assert(INSTANCES.includes(b.featured_instance)&&b.instances.some(x=>x.instance===b.featured_instance),'featured instance');
  const seen=new Set();
  for(const x of b.instances){
    assert(INSTANCES.includes(x.instance)&&!seen.has(x.instance),'instance uniqueness');seen.add(x.instance);
    validateInstanceRecord(x.record,b.date,x.instance);
    assert(x.record.published_at===b.published_at&&JSON.stringify(x.record.late_publication)===JSON.stringify(lp),'record late publication binding');
    assert(x.record.literary_score===undefined,'a late day has no reader score');
    if(x.instance===b.featured_instance)assert(x.record.translation_sl,'the featured late story needs its source-bound Slovene translation');
    validateLateLog(x.log,b.date,x.instance,x.record);
  }
  const featured=b.instances.find(x=>x.instance===b.featured_instance);
  assert(b.selection.title===featured.record.title&&b.candidates.some(c=>c.title===b.selection.title),'selection binding');
  return b;
}

// The archive item of one story: a <details> element, possibly with nested <details>.
function extractEntry(html,id){
  const start=html.indexOf(`<details class="archive-item" id="${id}">`);
  assert(start>=0,'generated entry missing: '+id);
  const tags=/<details\b[^>]*>|<\/details>/g;tags.lastIndex=start;let depth=0,tag;
  while((tag=tags.exec(html))){depth+=tag[0].startsWith('</')?-1:1;if(depth===0)return html.slice(start,tags.lastIndex)}
  throw Error('generated entry boundary: '+id);
}
// Insert before the next older story of the month; otherwise before the month's companion sections or </main>.
function insertEntry(html,entry,date,id){
  assert(!html.includes(`id="${id}"`),'monthly page already lists '+id);
  const older=[...html.matchAll(/<details class="archive-item" id="NARA-D-(\d{4}-\d{2}-\d{2})">/g)].find(m=>m[1]<date);
  const batch=html.indexOf('<section class="batch-archive">'),end=html.lastIndexOf('</main>');
  const at=older?older.index:(batch>=0?batch:end);
  assert(at>=0,'monthly insertion point');
  return html.slice(0,at)+entry+'\n'+html.slice(at);
}
function updateArchiveCount(html,month,count){
  const re=new RegExp(`(<a href="Nara-AI-${month}\\.html"><strong>${month}</strong><br><span class="muted">)\\d+( published stories</span>)`,'g');
  const hits=html.match(re)?.length??0;assert(hits===1,'archive month entry '+month);
  return html.replace(re,`$1${count}$2`);
}
function addArchiveDay(html,b){
  const links=[...b.instances].sort((a,c)=>INSTANCES.indexOf(a.instance)-INSTANCES.indexOf(c.instance)).map(x=>
    `<li>${esc(x.instance)} · <a href="Nara-AI-${b.date.slice(0,7)}.html#${esc(x.record.id)}">${esc(x.record.title)}</a>${x.instance===b.featured_instance?' · featured':''}</li>`).join('');
  const section=`<section class="notice"><h2>${b.date} · ${b.instances.length} stories published later</h2><ul>${links}</ul></section>`;
  const end=html.lastIndexOf('</main>');assert(end>=0,'archive main close');return html.slice(0,end)+section+html.slice(end);
}
const generatedPart=html=>html.slice(0,html.lastIndexOf('</main>'));

export function publishLate(root,input,now=new Date()){
  const b=validateLateBatch(input);
  const lp=b.late_publication,np=localParts(now.toISOString());
  assert(`${np.year}-${np.month}-${np.day}`===lp.decided_on,'late publication runs on the decision date');
  assert(Date.parse(b.published_at)<=now.getTime(),'future publication');
  const {n,c}=loadRecords(root);
  assert(!c.records.some(e=>e.date===b.date),'date already published');
  assert(!fs.existsSync(path.join(n,dayManifestPath(b.date))),'day manifest already exists');
  const item=b.instances.find(x=>x.instance===b.featured_instance);
  const legacy={...item.record,schema:'nara.daily.record.v1',id:`NARA-D-${b.date}`};
  delete legacy.day_id;delete legacy.instance;delete legacy.closed_at;
  {const t=legacy.translation_sl;legacy.translation_sl={title:t.title,deck:t.deck,shape:t.shape,scenes:t.scenes,critic_line:t.critic_line,content_sha256:t.content_sha256}}
  validateRecord(legacy);
  const l=item.log;
  const legacyLog={schema:'nara.daily.log.v1',id:`NARA-D-${b.date}-LOG`,date:b.date,story_id:`NARA-D-${b.date}`,title:item.record.title,
    proposer:l.proposer,selector:l.selector,author:l.author,critic:l.critic,...(l.stand_in_for?{stand_in_for:l.stand_in_for}:{}),
    candidates:b.candidates,selection:b.selection,rounds:l.rounds,final_critic_line:item.record.critic_line};
  validateLog(legacyLog);
  const staged={},files={};
  for(const x of b.instances){
    const rp=instanceRecordPath(b.date,x.instance),lg=`daily/log/${b.date}/${x.instance}.json`,tp=instanceTranslationPath(b.date,x.instance);
    const rb=stringify(x.record),lb=stringify(x.log),tb=x.record.translation_sl?stringify(x.record.translation_sl):null;
    staged[rp]=rb;staged[lg]=lb;if(tb!==null)staged[tp]=tb;
    files[x.instance]={record:rp,record_sha256:hash(rb),log:lg,log_sha256:hash(lb),translation:tb!==null?tp:null,translation_sha256:tb!==null?hash(tb):null};
  }
  const sorted=[...b.instances].sort((x,y)=>INSTANCES.indexOf(x.instance)-INSTANCES.indexOf(y.instance));
  const manifest={schema:'nara.daily.day.v1',id:`NARA-D-${b.date}`,date:b.date,published_at:b.published_at,regime:'THREE_STORY_CAPACITY_R8',cutoff_local:'20:30',
    featured_instance:b.featured_instance,selection_method:'BD late-publication decision; displayed first available story, no combined reader score',
    late_publication:lp,story_count:sorted.length,
    instances:sorted.map(x=>({instance:x.instance,id:instanceId(b.date,x.instance),title:x.record.title,combined:null,display:null,gpt:null,claude:null,
      record_file:files[x.instance].record,record_sha256:files[x.instance].record_sha256,log_file:files[x.instance].log,log_sha256:files[x.instance].log_sha256,
      translation_file:files[x.instance].translation,translation_sha256:files[x.instance].translation_sha256,
      monthly_anchor:`Nara-AI-${b.date.slice(0,7)}.html#${instanceId(b.date,x.instance)}`}))};
  const manifestBytes=stringify(manifest);staged[dayManifestPath(b.date)]=manifestBytes;
  const legacyFile=`daily/records/${b.date}.json`,legacyLogFile=`daily/log/${b.date}.json`,legacyBytes=stringify(legacy),legacyLogBytes=stringify(legacyLog);
  staged[legacyFile]=legacyBytes;staged[legacyLogFile]=legacyLogBytes;
  staged[`daily/translations/sl/${b.date}.json`]=stringify({...item.record.translation_sl,story_id:`NARA-D-${b.date}`});
  const entries=[...c.records,{id:`NARA-D-${b.date}`,date:b.date,title:legacy.title,file:legacyFile,record_sha256:hash(legacyBytes),log_file:legacyLogFile,log_sha256:hash(legacyLogBytes)}].sort((x,y)=>y.date.localeCompare(x.date));
  staged['daily/catalog.json']=stringify({schema:'nara.daily.catalog.v1',records:entries});
  // Read the live pages before any data changes, then stage data, then derive pages from the new data.
  const month=b.date.slice(0,7),monthFile=`Nara-AI-${month}.html`;
  const read=rel=>fs.existsSync(path.join(n,rel))?fs.readFileSync(path.join(n,rel),'utf8'):null;
  const liveMonth=read(monthFile),liveArchive=read('Nara-AI-archive.html'),liveLog=read('Nara-AI-log.html');
  const logsOf=list=>list.filter(e=>e.log_file).map(e=>validateLog(JSON.parse(fs.readFileSync(path.join(n,e.log_file),'utf8'))));
  const logBefore=liveLog===null?null:generatedPart(logPage(logsOf(c.records)));
  if(liveLog!==null)assert(liveLog.startsWith(logBefore),'live log page differs from its generated part');
  for(const [rel,data] of Object.entries(staged))write(path.join(n,rel),data);
  const next=loadRecords(root).records,latestMonth=next[0].date.slice(0,7),translations={};
  for(const r of next){const p=path.join(n,'daily/translations/sl',r.date+'.json');if(fs.existsSync(p))translations[r.id]=JSON.parse(fs.readFileSync(p,'utf8'))}
  const record=next.find(r=>r.date===b.date);
  // The story page is written first: the Daily card and calendar link to it only when it exists.
  const storyPages=featuredStoryPageOutputs(root,[record],translations);
  for(const [rel,html] of Object.entries(storyPages))write(path.join(n,rel),html);
  const pages={...storyPages};
  pages['Nara-AI-daily.html']=latestPage(next,latestMonth,translations,root);
  const generatedMonth=monthlyPage(month,next.filter(r=>r.date.startsWith(month)),translations,root);
  let updatedMonth=liveMonth===null?generatedMonth:insertEntry(liveMonth,extractEntry(generatedMonth,record.id),b.date,record.id);
  const companions=b.instances.filter(x=>x.instance!==b.featured_instance);
  if(companions.length){
    for(const x of companions)assert(!updatedMonth.includes(`id="${instanceId(b.date,x.instance)}"`),'late companion already present');
    const block=`<section class="batch-archive"><header><div class="eyebrow">Other stories of ${b.date}</div><h2>${b.date} · stories published later</h2><p class="lede"><span data-language-content="en" lang="en">Published later; independent reader scores are pending.</span><span data-language-content="sl" lang="sl" hidden>Objavljeno naknadno; neodvisne bralske ocene še niso pripravljene.</span></p></header>${companions.map(x=>instanceStoryHtml(x,root)).join('\n')}</section>`;
    const end=updatedMonth.lastIndexOf('</main>');assert(end>=0,'monthly main close');updatedMonth=updatedMonth.slice(0,end)+block+updatedMonth.slice(end);
  }
  pages[monthFile]=updatedMonth;
  if(liveArchive!==null)pages['Nara-AI-archive.html']=addArchiveDay(updateArchiveCount(liveArchive,month,entries.filter(e=>e.date.startsWith(month)).length),b);
  if(liveLog!==null)pages['Nara-AI-log.html']=generatedPart(logPage(logsOf(entries)))+liveLog.slice(logBefore.length);
  for(const [rel,data] of Object.entries(pages))write(path.join(n,rel),data);
  const formats=generateFormatEditions(root);
  return {status:'LOCAL_LATE_PUBLICATION_READY',date:b.date,featured:b.featured_instance,changed:[...Object.keys(staged),...Object.keys(pages),...(formats?.changed??[])].sort(),day_manifest_sha256:hash(manifestBytes)};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const [cmd,root,arg]=process.argv.slice(2);assert(root,'repoRoot required');
    if(cmd==='publish'){assert(arg,'late batch file required');console.log(JSON.stringify(publishLate(root,JSON.parse(fs.readFileSync(arg,'utf8')))))}
    else throw Error('use publish');
  }catch(e){console.error(e.message);process.exitCode=1}
}
