/** BD-approved late addition of finished stories to Daily days that are already published.
 * First use: 14 November 2026, BD: "B: objavimo vseh 13" (thirteen finished stories the nightly publisher held while the
 * rest of their day went out). A late addition never changes its day: the featured story, the day's scores, the other
 * stories and their records stay byte for byte as published. The day manifest gains one entry per added story, marked
 * late_addition, with no reader score. Every addition carries BD's decision (record.late_publication), shown on the page.
 * The decision may be older than the publication (BD decided on 14 November, the run was after midnight): decided_on is the
 * day of the decision, published_at the real time of the run, never before the decision and on the day of the run.
 * The monthly, Daily and archive pages are derived from the manifests, so a later nightly regeneration keeps the additions.
 * CLI: node scripts/nara-daily-late-add.mjs check|publish <repoRoot> <late-add.json>
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hash,validDate,localParts,validateLatePublication,loadRecords,monthStoryCount} from './nara-daily.mjs';
import {instanceRecordPath,instanceTranslationPath,dayManifestPath,validateInstanceRecord,refreshIllustratedPages} from './nara-daily-batch.mjs';
import {validateLateLog,updateArchiveCount} from './nara-daily-late.mjs';

const assert=(x,m)=>{if(!x)throw Error(m)};
const text=(s,n)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stringify=x=>JSON.stringify(x,null,2)+'\n';
const write=(p,s)=>{fs.mkdirSync(path.dirname(p),{recursive:true});if(fs.existsSync(p)&&fs.readFileSync(p,'utf8')===s)return false;const t=p+'.tmp';fs.writeFileSync(t,s);fs.renameSync(t,p);return true};
const INSTANCES=['S1','S2','S3'];

export function validateLateAddBatch(b){
  assert(b&&b.schema==='nara.daily.late_add.v1'&&Object.keys(b).every(k=>['schema','published_at','additions'].includes(k)),'late add schema');
  assert(text(b.published_at,40)&&/Z$/.test(b.published_at)&&Number.isFinite(Date.parse(b.published_at)),'published_at');
  assert(Array.isArray(b.additions)&&b.additions.length>=1&&b.additions.length<=40,'late additions');
  const seen=new Set(),p=localParts(b.published_at),publishedOn=`${p.year}-${p.month}-${p.day}`;
  for(const a of b.additions){
    assert(a&&Object.keys(a).every(k=>['record','log'].includes(k))&&a.record&&a.log,'addition fields');
    const r=a.record;
    assert(validDate(r.date)&&r.date>='2026-10-09'&&INSTANCES.includes(r.instance),'addition identity');
    const key=`${r.date}:${r.instance}`;assert(!seen.has(key),'duplicate addition '+key);seen.add(key);
    validateInstanceRecord(r,r.date,r.instance);
    const lp=validateLatePublication(r.late_publication,r.date);
    assert(publishedOn>=lp.decided_on,'published_at is before the decision date');
    assert(r.published_at===b.published_at,'record published_at binding');
    assert(r.literary_score===undefined,'a late addition has no reader score');
    validateLateLog(a.log,r.date,r.instance,r);
  }
  return b;
}

// Everything that can be decided without writing: the files to add and the new day manifests.
function plan(root,b){
  const {n}=loadRecords(root);
  const byDate=new Map();
  for(const a of b.additions){if(!byDate.has(a.record.date))byDate.set(a.record.date,[]);byDate.get(a.record.date).push(a)}
  const staged={},manifests={},summary=[];
  for(const [date,list] of [...byDate].sort((x,y)=>x[0].localeCompare(y[0]))){
    const mp=path.join(n,dayManifestPath(date));
    assert(fs.existsSync(mp),'a late addition needs an already published day: '+date);
    // The manifest as published is kept in git history and by the receipts that name its hash; the new manifest records the
    // hash of the version it replaces, so the chain stays checkable.
    const previousBytes=fs.readFileSync(mp,'utf8'),previousSha=hash(previousBytes),day=JSON.parse(previousBytes);
    assert(day.schema==='nara.daily.day.v1'&&day.date===date&&day.id===`NARA-D-${date}`&&Array.isArray(day.instances)&&INSTANCES.includes(day.featured_instance),'day manifest '+date);
    for(const a of list){
      const r=a.record,x=r.instance;
      assert(x!==day.featured_instance,'the featured story cannot be a late addition: '+r.id);
      assert(!day.instances.some(e=>e.instance===x),'story already in its day: '+r.id);
      const rp=instanceRecordPath(date,x),lg=`daily/log/${date}/${x}.json`,tp=instanceTranslationPath(date,x);
      for(const rel of [rp,lg,tp])assert(!fs.existsSync(path.join(n,rel)),'file already exists: '+rel);
      const rb=stringify(r),lb=stringify(a.log),tb=r.translation_sl?stringify(r.translation_sl):null;
      staged[rp]=rb;staged[lg]=lb;if(tb!==null)staged[tp]=tb;
      day.instances.push({instance:x,id:r.id,title:r.title,combined:null,display:null,gpt:null,claude:null,
        record_file:rp,record_sha256:hash(rb),log_file:lg,log_sha256:hash(lb),
        translation_file:tb!==null?tp:null,translation_sha256:tb!==null?hash(tb):null,
        monthly_anchor:`Nara-AI-${date.slice(0,7)}.html#${r.id}`,
        late_addition:{decided_by:'BD',decided_on:r.late_publication.decided_on,published_at:r.published_at,previous_manifest_sha256:previousSha}});
      summary.push(r.id);
    }
    day.instances.sort((p,q)=>INSTANCES.indexOf(p.instance)-INSTANCES.indexOf(q.instance));
    day.story_count=day.instances.length;
    manifests[dayManifestPath(date)]=stringify(day);
  }
  return {n,byDate,staged,manifests,summary};
}

export function checkLateAdditions(root,input){
  const b=validateLateAddBatch(input),p=plan(root,b);
  return {status:'LATE_ADDITIONS_VALID',added:p.summary,days:[...p.byDate.keys()]};
}

// Each added story gets one archive line, in a section the nightly regeneration already recognises and carries over.
function addArchiveSections(html,byDate){
  let out=html;
  for(const [date,list] of [...byDate].sort((x,y)=>x[0].localeCompare(y[0]))){
    const links=[...list].sort((a,c)=>INSTANCES.indexOf(a.record.instance)-INSTANCES.indexOf(c.record.instance)).map(a=>
      `<li>${esc(a.record.instance)} · <a href="Nara-AI-${date.slice(0,7)}.html#${esc(a.record.id)}">${esc(a.record.title)}</a></li>`).join('');
    const section=`<section class="notice"><h2>${date} · ${list.length} ${list.length===1?'story':'stories'} published later</h2><ul>${links}</ul></section>`;
    const end=out.lastIndexOf('</main>');assert(end>=0,'archive main close');
    out=out.slice(0,end)+section+out.slice(end);
  }
  return out;
}

export function publishLateAdditions(root,input,now=new Date()){
  const b=validateLateAddBatch(input);
  // BD's decision (late_publication.decided_on) may lie on an earlier day than the publication; the run itself must happen on
  // the local day of published_at, so the time on the records is the real one.
  const p0=localParts(b.published_at),publishedOn=`${p0.year}-${p0.month}-${p0.day}`,np=localParts(now.toISOString());
  assert(`${np.year}-${np.month}-${np.day}`===publishedOn,'late additions must run on the local day of their published_at; build the input again');
  assert(Date.parse(b.published_at)<=now.getTime(),'future publication');
  const {n,byDate,staged,manifests,summary}=plan(root,b);
  const changed=[];
  for(const [rel,data] of Object.entries({...staged,...manifests}))if(write(path.join(n,rel),data))changed.push(rel);
  // Pages are derived from the manifests. The latest month is refreshed too, because the Daily calendar lists every story of a day.
  const months=new Set([...byDate.keys()].map(d=>d.slice(0,7)));
  months.add(loadRecords(root).records[0].date.slice(0,7));
  for(const month of [...months].sort())changed.push(...refreshIllustratedPages(root,month).changed);
  const archiveFile=path.join(n,'Nara-AI-archive.html');
  if(fs.existsSync(archiveFile)){
    const {c}=loadRecords(root);let html=addArchiveSections(fs.readFileSync(archiveFile,'utf8'),byDate);
    for(const month of [...new Set([...byDate.keys()].map(x=>x.slice(0,7)))].sort())html=updateArchiveCount(html,month,monthStoryCount(root,c.records,month));
    if(write(archiveFile,html))changed.push('Nara-AI-archive.html');
  }
  return {status:'LOCAL_LATE_ADDITIONS_READY',added:summary,changed:[...new Set(changed)].sort()};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const [cmd,root,arg]=process.argv.slice(2);assert(root&&arg,'usage: check|publish <repoRoot> <late-add.json>');
    const input=JSON.parse(fs.readFileSync(arg,'utf8'));
    if(cmd==='check')console.log(JSON.stringify(checkLateAdditions(root,input)));
    else if(cmd==='publish')console.log(JSON.stringify(publishLateAdditions(root,input)));
    else throw Error('use check or publish');
  }catch(e){console.error(e.message);process.exitCode=1}
}
