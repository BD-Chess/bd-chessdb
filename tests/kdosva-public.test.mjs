import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build,publicPost,hash} from '../scripts/kdosva-public.mjs';
const source=(actor='GPT',parent='')=>({filename:`KDOSVA_R001_${actor}.md`,actor,created_at:'2026-10-18T10:00:00Z',markdown:`---\nround: R001\nactor: ${actor}\nparent: ${parent}\n---\n\n# Title\n\nOriginal **argument**.\n\n## Private\n\nDo not export this.\n`});
const translated=p=>({id:p.id,source_sha256:p.source_sha256,public_body_sha256:p.public_body_sha256,title:'English title',body_markdown:'Translated **argument**.'});
function sandbox(fn){const root=mkdtempSync(join(tmpdir(),'kdosva-test-'));try{return fn(root)}finally{rmSync(root,{recursive:true,force:true})}}
const feed=r=>JSON.parse(readFileSync(join(r,'public/AI8/kdosva/feed.json'),'utf8'));
test('linked translations preserve the original and survive append; repeat is a byte-stable no-op',()=>sandbox(root=>{const e=source(),p=publicPost(e),t=translated(p);build({events:[e],translations:[t]},root);const f=feed(root),raw=readFileSync(join(root,'public/AI8/kdosva/feed.json'),'utf8');assert.equal(f.recent[0].body_markdown,p.body_markdown);assert.equal(f.recent[0].translations.en.public_body_sha256,p.public_body_sha256);assert(!raw.includes('Do not export'));assert.equal(build({events:[e],translations:[t]},root).status,'NO_CHANGE');assert.equal(readFileSync(join(root,'public/AI8/kdosva/feed.json'),'utf8'),raw);build({events:[source('CLAUDE',hash(e.markdown))]},root);assert.deepEqual(feed(root).recent[0].translations,f.recent[0].translations);assert.equal(feed(root).total_posts,2)}));
test('translation-only backfill is allowed without editing the original',()=>sandbox(root=>{const e=source(),p=publicPost(e);build({events:[e]},root);assert.equal(build({translations:[translated(p)]},root).status,'UPDATED');assert.equal(feed(root).recent[0].body_markdown,p.body_markdown)}));
test('wrong source link, altered translation, and private locators are rejected',()=>sandbox(root=>{const e=source(),p=publicPost(e),t=translated(p);build({events:[e],translations:[t]},root);assert.throws(()=>build({translations:[{...t,source_sha256:'0'.repeat(64)}]},root),/mismatch/);assert.throws(()=>build({translations:[{...t,body_markdown:'Changed'}]},root),/differs/);assert.throws(()=>build({translations:[{...t,body_markdown:'https://drive.google.com/file/private'}]},root),/Invalid translation/)}));
test('gaps, missing parent hashes, changed originals, and altered archives are rejected',()=>sandbox(root=>{assert.throws(()=>build({events:[source('CLAUDE')]},root),/Incomplete source chain/);const e=source();build({events:[e]},root);assert.throws(()=>build({events:[source('CLAUDE')]},root),/parent hash/);assert.throws(()=>build({events:[{...e,markdown:e.markdown.replace('Original','Changed')}]},root),/source changed/);const archive=join(root,'public/AI8/kdosva/archive/2026-10-18.json');writeFileSync(archive,readFileSync(archive,'utf8')+' ');assert.throws(()=>build({},root),/checksum mismatch/)}));
test('final debate question beyond a probe is retained without protocol metadata',()=>{const e=source('CLAUDE');e.markdown=e.markdown.split('\n## Private')[0];e.markdown+='\n## Sonda P007 za GPT\n\n```text\nAnswer A or B.\n```\n\nsealed_cross_prediction: private\n\n**Vprašanje zate:** Is this a real question?\n\n## Za BD\n\nPrivate operations.\n';const p=publicPost(e);assert(p.body_markdown.endsWith('Is this a real question?'));assert(!p.body_markdown.includes('sealed_cross'));assert(!p.body_markdown.includes('Private operations'));assert.equal(p.probe.text,'Answer A or B.')});

test('explicit public boundaries retain discussion H2s and a separate bold probe, excluding all later private paragraphs',()=>{
 const e=source();e.markdown=e.markdown.slice(0,e.markdown.indexOf('# Title'))+'# Title\n\n<!-- KDOSVA_PUBLIC_BEGIN -->\nOpening.\n\n## A substantive objection\n\nKeep this whole section.\n\n**Vprašanje zate:** Public question?\n<!-- KDOSVA_PUBLIC_END -->\n\n**Sonda P010 za GPT**\n\n```text\nAnswer A or B.\n```\n\nsealed_cross_prediction: private\n\n## Za BD\n\n**Vprašanje zate:** Private question?\n';
 const p=publicPost(e);assert(p.body_markdown.includes('## A substantive objection'));assert(p.body_markdown.endsWith('Public question?'));assert(!p.body_markdown.includes('Private question'));assert(!p.body_markdown.includes('sealed_cross'));assert(!p.body_markdown.includes('KDOSVA_PUBLIC'));assert.equal(p.probe.text,'Answer A or B.');
});
test('unreviewed discussion headings, malformed boundaries and private material inside public boundaries fail visibly',()=>{
 const e=source();assert.throws(()=>publicPost({...e,markdown:e.markdown.replace('## Private','## New discussion')}),/Unreviewed public heading/);
 const marked=e.markdown.replace('Original **argument**.','<!-- KDOSVA_PUBLIC_BEGIN -->\nPublic.\n<!-- KDOSVA_PUBLIC_END -->');
 assert.throws(()=>publicPost({...e,markdown:marked.replace('<!-- KDOSVA_PUBLIC_END -->','')}),/Invalid public boundaries/);
 assert.throws(()=>publicPost({...e,markdown:marked.replace('Public.','<!-- KDOSVA_PUBLIC_BEGIN -->')}),/Invalid public boundaries/);
 assert.throws(()=>publicPost({...e,markdown:marked.replace('Public.','Drive 1abcdefghijklmnopqrstuvwxyz012345')}),/Public extraction needs review/);
 assert.throws(()=>publicPost({...e,markdown:marked.replace('Public.','sealed_cross_prediction: hidden')}),/Public extraction needs review/);
});
test('more than one public probe is rejected instead of choosing an arbitrary experimental input',()=>{
 const e=source();e.markdown=e.markdown.split('\n## Private')[0];e.markdown+='\n## Sonda P001\n\n```text\nA\n```\n\n**Sonda P002**\n\n```text\nB\n```\n';assert.throws(()=>publicPost(e),/Multiple public probes/);
});

test('legacy private sections cannot inject a final public question or probe',()=>{const e=source();e.markdown+='\n**Vprašanje zate:** Private question?\n\n## Sonda P010\n\n```text\nPrivate probe\n```\n';const p=publicPost(e);assert(!p.body_markdown.includes('Private question'));assert(!p.probe)});
