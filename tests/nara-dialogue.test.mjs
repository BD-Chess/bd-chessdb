import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {renderSceneParagraphs,renderStoryScene} from '../scripts/nara-illustrations.mjs';
import {hash,validateRecord,latestPage,monthlyPage} from '../scripts/nara-daily.mjs';
import {instanceStoryHtml} from '../scripts/nara-daily-batch.mjs';
import {renderVersionArchive} from '../scripts/nara-version-history.mjs';

const scene={title:'At the gate',paragraphs:['*Sogeri · morning*','Ruth lifted the box. *Too soon,* she thought.','**Ruth**  \nHe gave them too many wheels.','She put it down.','**Grace, on the phone**  \nWait for me.']};
const slScene={title:'Pri vratih',paragraphs:['*Sogeri · jutro*','Ruth je dvignila škatlo. *Prezgodaj,* je pomislila.','**Ruth**  \nDal jim je preveč koles.','Odložila jo je.','**Grace po telefonu**  \nPočakaj me.']};
const bodyHash=r=>hash(JSON.stringify({title:r.title,deck:r.deck,shape:r.shape,scenes:r.scenes}));
function record(){
  const r={schema:'nara.daily.record.v1',id:'NARA-D-2026-10-13',date:'2026-10-13',published_at:'2026-10-13T21:10:00+02:00',title:'Format fixture',deck:'A local fixture.',shape:'Test',scenes:[structuredClone(scene)],critic_line:'Test only.'};
  r.content_sha256=bodyHash(r);return r;
}
const translation=r=>{const t={title:'Preskus oblike',deck:'Lokalni preskus.',shape:'Preskus',scenes:[structuredClone(slScene)],critic_line:'Samo preskus.'};t.content_sha256=bodyHash(t);return t};

test('speaker labels, subtitles and interior thoughts render safely without changing source or hash',()=>{
  const r=record(),before=JSON.stringify(r),html=renderStoryScene(r.scenes[0],1);
  assert.match(html,/<h2 class="scene">01 · At the gate<\/h2><p class="subtitle"><em>Sogeri · morning<\/em><\/p>/);
  assert.match(html,/<p class="dialogue"><strong class="speaker">Ruth<\/strong>He gave them too many wheels\.<\/p>/);
  assert.match(html,/Ruth lifted the box\. <em>Too soon,<\/em> she thought\./);
  assert.match(html,/<p>She put it down\.<\/p>/);assert.equal(JSON.stringify(r),before);assert.equal(validateRecord(r).content_sha256,bodyHash(r));
});
test('only specified formatting executes; raw HTML and unsupported Markdown remain escaped',()=>{
  const hostile={title:'<script>x()</script>',paragraphs:['*<img src=x> · noon*','**<svg onload=x()>**  \n<script>x()</script> *<img src=y>*','[unsafe](javascript:x()) **unsupported**']};
  const html=renderStoryScene(hostile,2);
  assert.doesNotMatch(html,/<(?:script|img|svg|a)\b/);assert.match(html,/&lt;script&gt;/);assert.match(html,/<em>&lt;img src=y&gt;<\/em>/);assert.match(html,/\*\*unsupported\*\*/);
});
test('legacy paragraphs and headings remain byte-identical, including literal asterisks',()=>{
  const legacy={title:'An old scene',paragraphs:['She said, “Wait.”','*Literal text*','**Name**  \nStill plain.']};
  assert.equal(renderStoryScene(legacy,1),'<section><h2>01 · An old scene</h2><p>She said, “Wait.”</p>\n<p>*Literal text*</p>\n<p>**Name**  \nStill plain.</p></section>');
});
test('images keep exact source indices across subtitles and multiline dialogue; HD has no 4K source',()=>{
  const img={scene:1,after_paragraph:3,src:'assets/img/hd.webp',width:1672,height:941,alt_en:'Box',alt_sl:'Škatla'};
  for(const [s,lang] of [[scene,'en'],[slScene,'sl']]){
    const html=renderSceneParagraphs(s,1,[img],lang);
    assert.match(html,/<\/strong>[^<]+<\/p><figure class="daily-scene-figure">/);
    assert.equal((html.match(/<figure /g)||[]).length,1);assert.doesNotMatch(html,/4k|4K|srcset/);
  }
});
test('optional act opener renders before scene heading while retaining source paragraphs and anchors',()=>{
  const s={title:'Arrival',paragraphs:['*Ridge · dawn*','ACT I · THE RETURN','*The ridge remembered.*','**Ruth**  \nHere.']},before=JSON.stringify(s);
  const html=renderStoryScene(s,1,[{scene:1,after_paragraph:4,src:'assets/img/a.webp',width:1672,height:941,alt_en:'Arrival',alt_sl:'Prihod'}]);
  assert.ok(html.indexOf('class="act"')<html.indexOf('class="scene"'));
  assert.match(html,/<h2 class="scene">01 · Arrival<\/h2><p class="subtitle"><em>Ridge · dawn<\/em><\/p>/);
  assert.match(html,/<\/strong>Here\.<\/p><figure /);assert.equal(JSON.stringify(s),before);
});
test('Daily and monthly, non-featured instances and version archive render EN/SL even with no images',t=>{
  const r=record(),tr=translation(r),translations={[r.id]:tr};
  const instance={...r,id:r.id+':S1',instance:'S1',translation_sl:tr,literary_score:{combined:80,display:80}};
  for(const html of [latestPage(r,'2026-10',translations),monthlyPage('2026-10',[r],translations),instanceStoryHtml({record:instance})]){
    assert.match(html,/<strong class="speaker">Ruth<\/strong>He gave/);assert.match(html,/<strong class="speaker">Ruth<\/strong>Dal jim/);
    assert.match(html,/<em>Sogeri · jutro<\/em>/);assert.doesNotMatch(html,/\*\*Ruth\*\*/);
  }
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'nara-dialogue-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const n=path.join(root,'public/Nara');fs.mkdirSync(path.join(n,'daily/versions'),{recursive:true});fs.mkdirSync(path.join(n,'daily/translations/sl/2026-10-13'),{recursive:true});
  const series={schema:'nara.daily.version_series.v1',story_id:instance.id,date:r.date,published_title:r.title,final_version:'FINAL',accepted_lineage:[{version:'FINAL',source_content_sha256:r.content_sha256,story:r,stage:'AUTHOR_FINAL',grade:null,coverage:'PENDING_BOTH'}]};
  fs.writeFileSync(path.join(n,'daily/versions/2026-10-13-S1.json'),JSON.stringify(series));fs.writeFileSync(path.join(n,'daily/translations/sl/2026-10-13/S1.json'),JSON.stringify(tr));
  const html=renderVersionArchive(root);assert.match(html,/<strong class="speaker">Ruth<\/strong>He gave/);assert.match(html,/<strong class="speaker">Ruth<\/strong>Dal jim/);assert.match(html,/lang="sl" data-language-content="sl" hidden/);
});
