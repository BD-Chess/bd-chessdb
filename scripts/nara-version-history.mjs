/** Nara Daily: append-only, public-safe author version archive and SA1 colour logic.
 * This module never reads private Drive files. Public series JSON is built only from
 * genuine closed source events and sealed ratings by an authorized publisher.
 */
import fs from 'node:fs';
import path from 'node:path';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const realGrade=g=>g&&g.instrument==='SA1'&&Number.isFinite(g.gpt)&&Number.isFinite(g.claude)&&Number.isFinite(g.combined)&&Math.abs(g.combined-(g.gpt+g.claude)/2)<1e-8;
const dateFile=/^\d{4}-\d{2}-\d{2}(?:-S[123])?\.json$/;
export function listVersionSeries(root){
  if(!root)return [];
  const dir=path.join(root,'public','Nara','daily','versions');
  if(!fs.existsSync(dir))return [];
  const names=fs.readdirSync(dir).filter(n=>dateFile.test(n)).sort().reverse();
  return names.map(n=>{const s=JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
    if(s.schema!=='nara.daily.version_series.v1'||!Array.isArray(s.accepted_lineage)||s.accepted_lineage.length===0||typeof s.story_id!=='string')throw Error('invalid Nara version series: '+n);
    return s;
  });
}
function relevantPriorVersions(s){
  const accepted=s.accepted_lineage.filter(v=>v.version!==s.final_version);
  const parallel=(s.parallel_branches||[]).flatMap(x=>{
    if(Array.isArray(x))return x;
    const label=String(x?.name||'').toLowerCase();
    return label.includes('unselected')||label.includes('not an earlier')||label.includes('abandoned separate launch')?[]:(x.versions||[]);
  });
  return [...accepted,...parallel];
}
export function deriveVersionTrend(s){
  if(!s||!Array.isArray(s.accepted_lineage))return 'neutral';
  const end=s.accepted_lineage.find(v=>v.version===s.final_version);
  if(!end||!realGrade(end.grade))return 'neutral';
  const prior=relevantPriorVersions(s);
  if(!prior.length)return 'neutral';
  const seen=new Set(),unique=[];
  for(const v of prior){const hash=v.source_content_sha256||JSON.stringify(v.story);if(seen.has(hash)||hash===end.source_content_sha256)continue;seen.add(hash);unique.push(v)}
  if(!unique.length)return 'neutral';
  if(unique.some(v=>realGrade(v.grade)&&v.grade.combined>end.grade.combined+1e-9))return 'orange';
  if(unique.some(v=>!realGrade(v.grade)))return 'neutral';
  return 'green';
}
export function storyScoreTrend(root,storyId){
  const series=listVersionSeries(root),found=series.find(s=>s.story_id===storyId);
  if(found)return deriveVersionTrend(found);
  const day=/^NARA-D-(\d{4}-\d{2}-\d{2})$/.exec(storyId||'');
  if(!day)return 'neutral';
  const manifest=path.join(root,'public','Nara','daily','days',day[1]+'.json');
  if(!fs.existsSync(manifest))return 'neutral';
  const d=JSON.parse(fs.readFileSync(manifest,'utf8'));
  return deriveVersionTrend(series.find(s=>s.story_id===storyId+':'+d.featured_instance));
}
const formatScore=x=>String(Math.round(x*100)/100).replace(/\.0+$/,'');
function gradeView(v){
  const g=v.grade;
  if(!realGrade(g)){
    let msg=v.coverage==='CLAUDE_SEALED_GPT_PENDING'?'Claude SA1 sealed; GPT SA1 pending':v.coverage==='PENDING_BOTH'?'Both SA1 scores pending':'No comparable paired SA1 grade yet';
    return '<p class="muted version-grade-pending">'+esc(msg)+' / Claudova ocena zapečatena oziroma ocenjevanje še poteka.</p>';
  }
  return '<p class="version-grade"><strong>GPT</strong> '+formatScore(g.gpt)+' / 100 · <strong>Claude</strong> '+formatScore(g.claude)+' / 100 · <strong>50/50</strong> '+formatScore(g.combined)+' / 100 <small>SA1</small></p>';
}
function versionView(v,id,index,branch=''){
  const safeId=String(id+'-'+branch+'-'+v.version).replace(/[^A-Za-z0-9_-]/g,'-');
  const readable=v.story||{},scenes=Array.isArray(readable.scenes)?readable.scenes:[];
  const stage=v.stage||'STORED_FULL_TEXT';
  const side=v.branch?' · '+esc(v.branch):'';
  const full=scenes.map((scene,j)=>'<section><h5>'+String(j+1).padStart(2,'0')+' · '+esc(scene.title)+'</h5>'+(scene.paragraphs||[]).map(p=>'<p>'+esc(p)+'</p>').join('')+'</section>').join('');
  const notes=v.note?'<p class="muted">'+esc(v.note)+'</p>':'';
  const duplicate=v.same_text_events?.length>1?'<p class="muted">Identical text also recorded at '+esc(v.same_text_events.join(', '))+'</p>':'';
  const rating=realGrade(v.grade)?' · '+formatScore(v.grade.combined)+'/100':' · PENDING';
  return '<details class="version-entry" id="'+esc(safeId)+'"><summary><strong>'+esc(v.version)+'</strong> · '+esc(stage)+side+rating+'</summary><div class="inside"><p class="muted">Full English original · celotno angleško besedilo'+(branch?' · '+esc(branch):'')+'</p>'+gradeView(v)+notes+duplicate+'<article class="story" lang="en"><h4>'+esc(readable.title||'')+'</h4>'+(readable.deck?'<p class="lede">'+esc(readable.deck)+'</p>':'')+full+'</article></div></details>';
}
function branchView(name,entries,id){
  return '<section class="version-branch"><h3>'+esc(name)+'</h3>'+entries.map((v,i)=>versionView(v,id,i,name)).join('')+'</section>';
}
export function renderVersionArchive(root){
  const series=listVersionSeries(root);
  if(!series.length)return '';
  const storyCount=series.length,versions=series.reduce((n,s)=>n+s.accepted_lineage.length+(s.parallel_branches||[]).reduce((m,b)=>m+(Array.isArray(b)?b.length:b.versions?.length||0),0),0);
  const intro='<section class="version-history" id="version-history"><header class="masthead"><div class="eyebrow">GPT × Claude · text lineage / sled različic</div><h2>All published stories · every preserved author version</h2><p class="lede">Inspect each original, revision, rewrite and final text, including missing assessments. Public SA1 scores are 50/50 across models; PENDING never means zero. Earlier readings may be stronger. This archive does not hide them.</p><p class="lede">Vse objavljene zgodbe in ohranjene različice. Vse potrjene ocene SA1 so vidne, manjkajoče pa izrecno označene.</p><p class="muted">'+storyCount+' published story identities · '+versions+' version records, including separately labelled branches</p></header>';
  const items=series.map(s=>{
    const sid='versions-'+s.story_id.replace(/[^a-z0-9]/gi,'-'),final=s.accepted_lineage.find(v=>v.version===s.final_version),grade=final?.grade,trend=deriveVersionTrend(s);
    const label=realGrade(grade)?formatScore(grade.combined)+'/100':'PENDING';
    const main=branchView('Published story lineage / objavljena veja',s.accepted_lineage,s.story_id);
    const alt=(s.parallel_branches||[]).map((b,i)=>Array.isArray(b)?branchView('Parallel branch '+(i+1),b,s.story_id):branchView(b.name||'Parallel branch',b.versions||[],s.story_id)).join('');
    return '<details class="archive-item version-story" id="'+esc(sid)+'"><summary><time datetime="'+esc(s.date)+'">'+esc(s.date)+'</time><span class="story-summary-title"><strong>'+esc(s.story_id.includes(':')?s.story_id.slice(-2)+' · '+s.published_title:s.published_title)+'</strong><span class="score-chip score-trend--'+trend+'">'+esc(label)+'</span></span></summary><div class="inside">'+main+alt+'</div></details>';
  }).join('\n');
  return intro+items+'</section>';
}
