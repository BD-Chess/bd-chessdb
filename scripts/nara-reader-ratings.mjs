import fs from 'node:fs';
import path from 'node:path';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const READER_POLICY='READER_APPEAL_R1';
export const meanScore=(g,c)=>{
  if(![g,c].every(v=>Number.isInteger(v)&&v>=0&&v<=100))throw Error('Reader ratings require two integer scores from 0 to 100');
  return (g+c)/2;
};
export function loadReaderRatings(root){
  const p=root&&path.join(root,'public/Nara/daily/reader-ratings.json');
  if(!p||!fs.existsSync(p))return null;
  const d=JSON.parse(fs.readFileSync(p,'utf8'));
  if(d.schema!=='nara.reader-ratings.v1'||d.policy?.id!==READER_POLICY)throw Error('Invalid current reader-rating catalog');
  for(const [k,r]of Object.entries(d.stories))if(r.story_id!==k||r.combined!==meanScore(r.gpt,r.claude)||r.display!==Math.floor(r.combined+.5))throw Error('Reader-rating arithmetic/binding');
  return d;
}
export function readerRating(root,key){const d=loadReaderRatings(root);return d?.stories[key]??d?.stories[d?.aliases[key]]??null}
// Zbor panel (BD 18 Nov 2026): the mean of up to six no-context models, shown BESIDE the READER_APPEAL_R1 score for a while.
export const ZBOR_POLICY='ZBOR_PANEL_R1';
const ZBOR_NAMES={chatgpt:'ChatGPT',gemini:'Gemini',claude:'Claude',deepseek:'DeepSeek',grok:'Grok',qwen:'Qwen'};
export function loadZborRatings(root){
  const p=root&&path.join(root,'public/Nara/daily/reader-ratings-zbor.json');
  if(!p||!fs.existsSync(p))return null;
  const d=JSON.parse(fs.readFileSync(p,'utf8'));
  if(d.schema!=='nara.reader-ratings-zbor.v1'||d.policy?.id!==ZBOR_POLICY)throw Error('Invalid Zbor rating catalog');
  for(const [k,r]of Object.entries(d.stories)){
    const vs=Object.entries(r.voices??{});
    if(r.story_id!==k||!vs.length||vs.some(([n,v])=>!(n in ZBOR_NAMES)||!Number.isInteger(v)||v<0||v>100)||r.n_voices!==vs.length||!(Math.abs(r.mean-vs.reduce((a,[,v])=>a+v,0)/vs.length)<1e-9))throw Error('Zbor rating arithmetic/binding');
  }
  return d;
}
export function zborRating(root,key){
  const d=loadZborRatings(root);if(!d)return null;
  if(d.stories[key])return d.stories[key];
  const id=loadReaderRatings(root)?.aliases?.[key];
  return id?d.stories[id]??null:null;
}
export const ratingNumber=v=>Number.isInteger(v)?String(v):v.toFixed(1);
const bi=(a,b)=>'<span data-language-content="en" lang="en">'+esc(a)+'</span><span data-language-content="sl" lang="sl" hidden>'+esc(b)+'</span>';
const zborBody=z=>'<p class="reader-rating-zbor"><strong>Zbor '+ratingNumber(z.mean)+'</strong> · '+Object.entries(z.voices).map(([n,v])=>esc(ZBOR_NAMES[n])+' '+v).join(' · ')+'</p><p>'+bi('Panel of up to six models, each reading the story without any context. The Zbor score is the arithmetic mean of the panel ('+z.n_voices+' of 6 voices). It is shown beside the earlier GPT + Claude score for a while.','Zbor do šestih modelov, od katerih vsak prebere zgodbo brez kakršnega koli konteksta. Ocena Zbora je aritmetično povprečje zbora ('+z.n_voices+' od 6 glasov). Nekaj časa je prikazana poleg dosedanje ocene GPT + Claude.')+'</p>';
export function ratingMarkup(r,{compact=false,zbor=null}={}){
  if(!r&&zbor)return '<details class="reader-rating reader-rating--zbor-only'+(compact?' reader-rating--compact':'')+'" data-reader-rating="'+esc(zbor.story_id)+'"><summary aria-label="Open score explanation / Odpri razlago ocene"><strong>'+ratingNumber(zbor.mean)+'<small> / 100 Zbor</small></strong></summary><div class="reader-rating-body">'+zborBody(zbor)+'<p class="muted">'+bi('Assessment refers to the English reading edition.','Ocena velja za angleško bralno izdajo.')+'</p></div></details>';
  if(!r)return '<span class="reader-rating-pending">'+bi('Reader rating pending','Bralska ocena še ni pripravljena')+'</span>';
  if(r.combined!==meanScore(r.gpt,r.claude))throw Error('Incorrect displayed reader mean');
  const value=ratingNumber(r.combined);
  const edition=r.edition_url?'<p><a href="'+esc(r.edition_url)+'">'+bi('Read the assessed edition','Preberi ocenjeno izdajo')+'</a></p>':'';
  const plus=Object.entries(r.comments??{}).map(([m,s])=>'<p><strong>'+esc(m==='gpt'?'GPT':'Claude')+'</strong> — '+esc(s)+'</p>').join('');
  const gaps=Object.entries(r.suggestions??{}).map(([m,s])=>'<p><strong>'+esc(m==='gpt'?'GPT':'Claude')+'</strong> — '+esc(s)+'</p>').join('');
  return '<details class="reader-rating'+(compact?' reader-rating--compact':'')+'" data-reader-rating="'+esc(r.story_id)+'"><summary aria-label="Open score explanation / Odpri razlago ocene"><strong>'+value+'<small> / 100</small></strong>'+(zbor?'<span class="reader-rating-zbor-chip"><span aria-hidden="true"> | </span><strong>'+ratingNumber(zbor.mean)+'<small> Zbor</small></strong></span>':'')+'</summary><div class="reader-rating-body"><p class="reader-rating-models"><strong>GPT '+r.gpt+'</strong> · <strong>Claude '+r.claude+'</strong> · 50/50</p><p>'+bi('Independent model assessments of reader appeal. The combined score is their arithmetic mean.','Neodvisni modelski oceni bralske privlačnosti. Skupna ocena je njuno aritmetično povprečje.')+'</p>'+(zbor?zborBody(zbor):'')+'<h3>'+bi('Reading notes','Obrazložitvi')+'</h3>'+plus+edition+(gaps?'<h3>'+bi('Suggestions for improvement','Predlogi za izboljšave')+'</h3>'+gaps:'')+'<p class="muted">'+bi('Assessment refers to the English reading edition. Model comments retain their original language.','Ocena velja za angleško bralno izdajo. Komentarja modelov sta v izvirnem jeziku.')+'</p></div></details>';
}
export function requireCurrentReaderEvaluation(root,evaluation){
  if(!loadReaderRatings(root))return;
  if(!['gpt','claude'].every(m=>evaluation?.[m]?.rubric===READER_POLICY))throw Error('Current publication requires READER_APPEAL_R1 scores from both models');
  if(evaluation.combined!==meanScore(evaluation.gpt.score,evaluation.claude.score))throw Error('Invalid reader-score mean');
}
export function registerReaderRating(root,record,evaluation){
  const d=loadReaderRatings(root);if(!d)return false;
  requireCurrentReaderEvaluation(root,evaluation);
  const k=record.id;
  if(record.literary_score?.combined!==evaluation.combined||!['shared_strengths','shared_reservations'].every(x=>record.literary_score[x]?.length===2&&record.literary_score[x].every(y=>typeof y==='string'&&y.trim())))throw Error('Two attributed reader comments and matching scores are required');
  d.stories[k]={story_id:k,title:record.title,source_content_sha256:record.content_sha256,gpt:evaluation.gpt.score,claude:evaluation.claude.score,combined:evaluation.combined,display:Math.floor(evaluation.combined+.5),
    comments:{claude:record.literary_score.shared_strengths[0],gpt:record.literary_score.shared_strengths[1]},
    suggestions:{claude:record.literary_score.shared_reservations[0],gpt:record.literary_score.shared_reservations[1]}};
  const p=path.join(root,'public/Nara/daily/reader-ratings.json');fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');return true;
}

export function setReaderAlias(root,alias,key){
  const d=loadReaderRatings(root);if(!d)return;
  if(!d.stories[key])throw Error('Alias target has no current reader rating');
  d.aliases[alias]=key;
  fs.writeFileSync(path.join(root,'public/Nara/daily/reader-ratings.json'),JSON.stringify(d,null,2)+'\n');
}

