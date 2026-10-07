/** Illuminara Daily R10 batch renderer.
 * Backward-compatible extension for the approved multi-story regime.
 * Existing single-story publication remains owned by scripts/nara-daily.mjs.
 * CLI: node scripts/nara-daily-batch.mjs publish <repoRoot> <public-batch.json>
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  hash,
  validateRecord,
  validateLog,
  loadRecords,
  latestPage,
  monthlyPage,
  archivePage,
  logPage,
} from './nara-daily.mjs';

export const VERSION='illuminara-daily-r10-three-story-batch';
const assert=(x,m)=>{if(!x)throw Error(m)};
const text=(s,n)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stringify=x=>JSON.stringify(x,null,2)+'\n';
const write=(p,s)=>{fs.mkdirSync(path.dirname(p),{recursive:true});if(fs.existsSync(p)&&fs.readFileSync(p,'utf8')===s)return false;const t=p+'.tmp';fs.writeFileSync(t,s);fs.renameSync(t,p);return true};
const localParts=s=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Ljubljana',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(s)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
const instances=['S1','S2','S3'];

export function instanceId(date,instance){assert(validDate(date),'invalid date');assert(instances.includes(instance),'invalid instance');return `NARA-D-${date}:${instance}`}
export function instanceRecordPath(date,instance){return `daily/records/${date}/${instance}.json`}
export function instanceTranslationPath(date,instance){return `daily/translations/sl/${date}/${instance}.json`}
export function dayManifestPath(date){return `daily/days/${date}.json`}

function normalizeEvaluation(x){
  assert(x&&x.blind===true&&x.method==='equal_weight_mean','evaluation must be blind equal-weight');
  for(const k of ['gpt','claude'])assert(x[k]&&Number.isInteger(x[k].score)&&x[k].score>=0&&x[k].score<=100&&text(x[k].rubric,180),'evaluation component');
  assert(x.weights?.gpt===0.5&&x.weights?.claude===0.5,'evaluation weights');
  const combined=(x.gpt.score+x.claude.score)/2;
  assert(x.combined===combined&&x.display===Math.floor(combined+0.5),'evaluation arithmetic');
  return x;
}

function validateTranslation(t,record,date,instance){
  assert(t&&t.schema==='nara.daily.translation.v1'&&t.language==='sl','translation schema');
  assert(t.story_id===instanceId(date,instance)&&t.date===date,'translation identity');
  assert(t.source_content_sha256===record.content_sha256,'translation source');
  assert(Array.isArray(t.scenes)&&t.scenes.length===record.scenes.length,'translation scenes');
  for(const k of ['title','deck','shape','critic_line'])assert(text(t[k],10000),'translation '+k);
  t.scenes.forEach((s,i)=>{assert(text(s.title,180)&&Array.isArray(s.paragraphs)&&s.paragraphs.length===record.scenes[i].paragraphs.length&&s.paragraphs.every(p=>text(p,10000)),'translation topology')});
  const body=JSON.stringify({title:t.title,deck:t.deck,shape:t.shape,scenes:t.scenes});
  assert(t.content_sha256===hash(body),'translation content hash');
  return t;
}

function validateInstanceRecord(r,date,instance){
  assert(r&&r.schema==='nara.daily.instance_record.v1','instance record schema');
  assert(r.id===instanceId(date,instance)&&r.day_id===`NARA-D-${date}`&&r.date===date&&r.instance===instance,'instance record identity');
  const allowed=['schema','id','day_id','date','instance','published_at','closed_at','title','deck','shape','scenes','critic_line','content_sha256','literary_score','translation_sl'];
  assert(Object.keys(r).every(k=>allowed.includes(k)),'unexpected instance field');
  assert(text(r.closed_at,40)&&Number.isFinite(Date.parse(r.closed_at)),'closed_at');
  const legacy={...r,schema:'nara.daily.record.v1',id:`NARA-D-${date}`};
  delete legacy.day_id;delete legacy.instance;delete legacy.closed_at;
  if(r.translation_sl){const t=r.translation_sl;legacy.translation_sl={title:t.title,deck:t.deck,shape:t.shape,scenes:t.scenes,critic_line:t.critic_line,content_sha256:t.content_sha256}}
  validateRecord(legacy);
  if(r.translation_sl)validateTranslation(r.translation_sl,r,date,instance);
  return r;
}

function validateInstanceLog(l,date,instance,record,candidates,selection){
  assert(l&&l.schema==='nara.daily.instance_log.v1','instance log schema');
  assert(l.id===`${instanceId(date,instance)}-LOG`&&l.story_id===instanceId(date,instance)&&l.day_id===`NARA-D-${date}`&&l.date===date&&l.instance===instance,'instance log identity');
  for(const k of ['proposer','selector','author','critic'])assert(['GPT','CLAUDE'].includes(l[k]),'log role');
  assert(l.proposer===l.author&&l.selector===l.critic&&l.author!==l.critic,'role pairing');
  assert(l.title===record.title&&l.final_critic_line===record.critic_line,'log/record binding');
  assert(Array.isArray(l.rounds)&&l.rounds.some(r=>r.stage==='AUTHOR_FINAL')&&l.rounds.some(r=>r.stage==='CRITIC_CLOSE'),'log close');
  normalizeEvaluation(l.evaluation);
  assert(selection.title===record.title,'selection title mismatch');
  assert(candidates.some(c=>c.title===selection.title),'selected candidate absent');
  return l;
}

export function chooseFeatured(items){
  assert(Array.isArray(items)&&items.length>=1&&items.length<=3,'eligible instances 1..3');
  const ranked=[...items].sort((a,b)=>{
    const av=normalizeEvaluation(a.log.evaluation),bv=normalizeEvaluation(b.log.evaluation);
    if(bv.combined!==av.combined)return bv.combined-av.combined;
    const amin=Math.min(av.gpt.score,av.claude.score),bmin=Math.min(bv.gpt.score,bv.claude.score);
    if(bmin!==amin)return bmin-amin;
    const at=Date.parse(a.record.closed_at),bt=Date.parse(b.record.closed_at);
    if(at!==bt)return at-bt;
    return instances.indexOf(a.instance)-instances.indexOf(b.instance);
  });
  return ranked[0].instance;
}

function featuredProjection(record,date,publishedAt){
  const r={...record,schema:'nara.daily.record.v1',id:`NARA-D-${date}`,published_at:publishedAt};
  delete r.day_id;delete r.instance;delete r.closed_at;
  if(r.translation_sl){const t=r.translation_sl;r.translation_sl={title:t.title,deck:t.deck,shape:t.shape,scenes:t.scenes,critic_line:t.critic_line,content_sha256:t.content_sha256}}
  return validateRecord(r);
}

function featuredLogProjection(item,batch){
  const l=item.log;
  const out={
    schema:'nara.daily.log.v1',id:`NARA-D-${batch.date}-LOG`,date:batch.date,story_id:`NARA-D-${batch.date}`,
    title:item.record.title,proposer:l.proposer,selector:l.selector,author:l.author,critic:l.critic,
    candidates:batch.candidates,selection:{...batch.selections.find(s=>s.instance===item.instance)},rounds:l.rounds,
    final_critic_line:item.record.critic_line,evaluation:l.evaluation,
  };
  delete out.selection.instance;
  return validateLog(out);
}

function publicInstanceRecord(r){return r}
function publicInstanceLog(l){return l}

function dayManifest(batch,items,featured,files){
  const sorted=[...items].sort((a,b)=>instances.indexOf(a.instance)-instances.indexOf(b.instance));
  return {
    schema:'nara.daily.day.v1',id:`NARA-D-${batch.date}`,date:batch.date,published_at:batch.published_at,
    regime:'THREE_STORY_CAPACITY_R8',cutoff_local:batch.cutoff_local,featured_instance:featured,
    selection_method:'highest 50/50 combined; tie higher minimum individual score; then earlier close',
    story_count:sorted.length,
    instances:sorted.map(x=>({
      instance:x.instance,id:instanceId(batch.date,x.instance),title:x.record.title,
      combined:x.log.evaluation.combined,display:x.log.evaluation.display,
      gpt:x.log.evaluation.gpt.score,claude:x.log.evaluation.claude.score,
      record_file:files[x.instance].record,record_sha256:files[x.instance].record_sha256,
      log_file:files[x.instance].log,log_sha256:files[x.instance].log_sha256,
      translation_file:files[x.instance].translation??null,translation_sha256:files[x.instance].translation_sha256??null,
      monthly_anchor:`Nara-AI-${batch.date.slice(0,7)}.html#${instanceId(batch.date,x.instance)}`,
    }))
  };
}

function instanceStoryHtml(item){
  const r=item.record,t=r.translation_sl;
  const prose=(src,lang)=>`<article class="story" lang="${lang}">${src.scenes.map((s,i)=>`<section><h3>${String(i+1).padStart(2,'0')} · ${esc(s.title)}</h3>${s.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('\n')}</section>`).join('\n')}</article>`;
  const english=`<div data-language-content="en" lang="en"><p class="lede">${esc(r.deck)}</p>${prose(r,'en')}</div>`;
  const sl=t?`<div data-language-content="sl" lang="sl" hidden><p class="lede">${esc(t.deck)}</p>${prose(t,'sl')}</div>`:`<p data-language-content="sl" lang="sl" hidden>Ta zgodba je trenutno na voljo v angleščini.</p>`;
  return `<details class="archive-item batch-instance" id="${esc(r.id)}"><summary><time datetime="${esc(r.date)}">${esc(r.date)} · ${esc(r.instance)}</time><span class="story-summary-title"><strong data-language-content="en" lang="en">${esc(r.title)}</strong>${t?`<strong data-language-content="sl" lang="sl" hidden>${esc(t.title)}</strong>`:''}<span class="score-chip" aria-label="Combined literary score">${r.literary_score.display}</span></span></summary><div class="inside">${english}${sl}<blockquote class="critic-line">${esc(r.critic_line)}</blockquote></div></details>`;
}

function insertBeforeMainClose(html,fragment){const needle='</main>';const i=html.lastIndexOf(needle);assert(i>=0,'main close missing');return html.slice(0,i)+fragment+html.slice(i)}
function patchLatest(html,batch,items,featured){
  const day=`NARA-D-${batch.date}`;
  html=html.replace(`class="archive-item daily-item" id="${day}"`,`class="archive-item daily-item" id="${day}" open`);
  const others=items.filter(x=>x.instance!==featured);
  if(!others.length)return html;
  const cards=`<section class="notice batch-other-stories"><h2>Other stories of the day</h2><p>The featured story above had the highest combined blind score. The other eligible stories remain in the monthly archive.</p><ul>${others.map(x=>`<li><a href="Nara-AI-${batch.date.slice(0,7)}.html#${esc(x.record.id)}"><strong>${esc(x.record.instance)} · ${esc(x.record.title)}</strong></a> · ${x.record.literary_score.display}/100</li>`).join('')}</ul></section>`;
  return insertBeforeMainClose(html,cards);
}
function patchMonthly(html,batch,items,featured){
  const others=items.filter(x=>x.instance!==featured);
  if(!others.length)return html;
  const block=`<section class="batch-archive"><header><div class="eyebrow">Other stories of ${esc(batch.date)}</div><h2>${esc(batch.date)} · complete eligible archive</h2><p class="lede">These stories completed the same editorial gates but were not the featured Daily story.</p></header>${others.map(instanceStoryHtml).join('\n')}</section>`;
  return insertBeforeMainClose(html,block);
}
function patchArchive(html,batch,items,featured){
  const links=items.map(x=>`<li>${esc(x.record.instance)} · <a href="Nara-AI-${batch.date.slice(0,7)}.html#${esc(x.record.id)}">${esc(x.record.title)}</a>${x.instance===featured?' · featured':''}</li>`).join('');
  return insertBeforeMainClose(html,`<section class="notice"><h2>${esc(batch.date)} · ${items.length} eligible stories</h2><ul>${links}</ul></section>`);
}
function patchLog(html,batch,items,featured){
  const rows=[...items].sort((a,b)=>instances.indexOf(a.instance)-instances.indexOf(b.instance)).map(x=>`<tr><td>${esc(x.instance)}</td><td>${esc(x.record.title)}</td><td>${x.log.evaluation.gpt.score}</td><td>${x.log.evaluation.claude.score}</td><td>${x.log.evaluation.combined.toFixed(1)}</td><td>${x.instance===featured?'featured':'archive'}</td></tr>`).join('');
  return insertBeforeMainClose(html,`<section class="notice score-audit"><h2>${esc(batch.date)} · day selection</h2><p>All eligible finals were blind-scored before the batch was opened for comparison. Featured selection used the approved deterministic rule.</p><table><thead><tr><th>Instance</th><th>Story</th><th>GPT</th><th>Claude</th><th>Combined</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table></section>`);
}

export function validateBatch(batch){
  assert(batch&&batch.schema==='nara.daily.batch.publish.v1','batch schema');
  assert(validDate(batch.date)&&batch.date>='2026-10-09','batch date');
  assert(text(batch.published_at,40)&&Number.isFinite(Date.parse(batch.published_at)),'published_at');
  const lp=localParts(batch.published_at);assert(`${lp.year}-${lp.month}-${lp.day}`===batch.date,'published_at local date');
  assert(batch.cutoff_local==='20:30','cutoff');
  assert(Array.isArray(batch.candidates)&&batch.candidates.length===10&&batch.candidates.every(c=>c&&text(c.title,180)&&text(c.premise,1200)),'candidates');
  assert(Array.isArray(batch.selections)&&batch.selections.length===3,'three selections');
  const seenSel=new Set();for(const s of batch.selections){assert(instances.includes(s.instance)&&!seenSel.has(s.instance),'selection instance');seenSel.add(s.instance);assert(text(s.title,180)&&text(s.reason,1200)&&text(s.risk,1200)&&batch.candidates.some(c=>c.title===s.title),'selection content')}
  assert(Array.isArray(batch.instances)&&batch.instances.length>=1&&batch.instances.length<=3,'eligible instances');
  const seen=new Set();for(const x of batch.instances){assert(instances.includes(x.instance)&&!seen.has(x.instance),'instance uniqueness');seen.add(x.instance);validateInstanceRecord(x.record,batch.date,x.instance);const sel=batch.selections.find(s=>s.instance===x.instance);validateInstanceLog(x.log,batch.date,x.instance,x.record,batch.candidates,sel);assert(x.record.literary_score.combined===x.log.evaluation.combined&&x.record.literary_score.display===x.log.evaluation.display,'record/log score binding');assert(x.record.translation_sl,'translation required for R8 eligibility')}
  return batch;
}

export function publishBatch(root,input,now=new Date()){
  const batch=validateBatch(input);
  assert(new Date(batch.published_at).getTime()<=now.getTime(),'future publication');
  const np=localParts(now.toISOString());assert(`${np.year}-${np.month}-${np.day}`===batch.date,'not current local date');
  const {n,c,records}=loadRecords(root);
  assert(!records.some(r=>r.date>batch.date),'backfill prohibited');
  const featured=chooseFeatured(batch.instances);
  if(batch.featured_instance!==undefined)assert(batch.featured_instance===featured,'featured mismatch');
  const item=batch.instances.find(x=>x.instance===featured);
  const featuredRecord=featuredProjection(item.record,batch.date,batch.published_at);
  const featuredLog=featuredLogProjection(item,batch);
  const featuredBytes=stringify(featuredRecord),featuredLogBytes=stringify(featuredLog);
  const existing=c.records.find(e=>e.date===batch.date);
  const dayPath=dayManifestPath(batch.date);
  if(existing){
    assert(existing.record_sha256===hash(featuredBytes)&&existing.log_sha256===hash(featuredLogBytes),'existing date conflicts with batch');
    const dp=path.join(n,dayPath);assert(fs.existsSync(dp),'existing batch missing day manifest');
    return {status:'ALREADY_PUBLISHED_BATCH',featured,changed:[]};
  }
  const files={};
  const staged={};
  for(const x of batch.instances){
    const rp=instanceRecordPath(batch.date,x.instance),lp=`daily/log/${batch.date}/${x.instance}.json`,rb=stringify(publicInstanceRecord(x.record)),lb=stringify(publicInstanceLog(x.log));
    staged[rp]=rb;staged[lp]=lb;
    files[x.instance]={record:rp,record_sha256:hash(rb),log:lp,log_sha256:hash(lb)};
    const tp=instanceTranslationPath(batch.date,x.instance),tb=stringify(x.record.translation_sl);staged[tp]=tb;files[x.instance].translation=tp;files[x.instance].translation_sha256=hash(tb);
  }
  const manifest=dayManifest(batch,batch.instances,featured,files),manifestBytes=stringify(manifest);staged[dayPath]=manifestBytes;
  const legacyFile=`daily/records/${batch.date}.json`,legacyLogFile=`daily/log/${batch.date}.json`;
  staged[legacyFile]=featuredBytes;staged[legacyLogFile]=featuredLogBytes;
  if(item.record.translation_sl){
    const t=item.record.translation_sl;
    const legacyTranslation={...t,story_id:`NARA-D-${batch.date}`};
    staged[`daily/translations/sl/${batch.date}.json`]=stringify(legacyTranslation);
  }
  const entries=[...c.records,{id:`NARA-D-${batch.date}`,date:batch.date,title:featuredRecord.title,file:legacyFile,record_sha256:hash(featuredBytes),log_file:legacyLogFile,log_sha256:hash(featuredLogBytes)}].sort((a,b)=>b.date.localeCompare(a.date));
  staged['daily/catalog.json']=stringify({schema:'nara.daily.catalog.v1',records:entries});
  // Write data first into the local candidate tree; the publishing worker commits all changed files atomically.
  for(const [rel,data] of Object.entries(staged))write(path.join(n,rel),data);
  const loaded=loadRecords(root);const next=loaded.records;const month=batch.date.slice(0,7);
  const translations={};for(const r of next){const p=path.join(n,'daily/translations/sl',r.date+'.json');if(fs.existsSync(p))translations[r.id]=JSON.parse(fs.readFileSync(p,'utf8'))}
  const logs=entries.filter(e=>e.log_file).map(e=>validateLog(JSON.parse(fs.readFileSync(path.join(n,e.log_file),'utf8'))));
  const pageOutputs={
    'Nara-AI-daily.html':patchLatest(latestPage(next,month,translations),batch,batch.instances,featured),
    [`Nara-AI-${month}.html`]:patchMonthly(monthlyPage(month,next.filter(r=>r.date.startsWith(month)),translations),batch,batch.instances,featured),
    'Nara-AI-archive.html':patchArchive(archivePage(entries,month),batch,batch.instances,featured),
    'Nara-AI-log.html':patchLog(logPage(logs),batch,batch.instances,featured),
  };
  for(const [rel,data] of Object.entries(pageOutputs))write(path.join(n,rel),data);
  return {status:'LOCAL_BATCH_CANDIDATE_READY',featured,changed:[...Object.keys(staged),...Object.keys(pageOutputs)].sort(),day_manifest_sha256:hash(manifestBytes)};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const [cmd,root,arg]=process.argv.slice(2);assert(root,'repoRoot required');
    if(cmd==='publish'){assert(arg,'batch file required');console.log(JSON.stringify(publishBatch(root,JSON.parse(fs.readFileSync(arg,'utf8')))))}
    else throw Error('use publish');
  }catch(e){console.error(e.message);process.exitCode=1}
}