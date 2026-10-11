import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadRecords,loadTranslations,latestPage,monthlyPage,loadIllustrations} from '../scripts/nara-daily.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const n=path.join(root,'public/Nara');
const storyId='NARA-D-2026-10-05';
const h=b=>crypto.createHash('sha256').update(b).digest('hex');
const imagesFrom=html=>(html.match(/<figure class="daily-scene-figure">/g)||[]).length;
const article=(html,lang)=>{
  const mark='<article class="story" lang="'+lang+'" data-story-id="'+storyId+'"';
  const start=html.indexOf(mark);assert.notEqual(start,-1,mark);
  assert.equal(html.indexOf(mark,start+mark.length),-1,'article must be unique');
  const end=html.indexOf('</article>',start);assert.ok(end>start);
  return html.slice(start,end+10);
};

test('real 2026-10-05 R3 image sources and bilingual manifest are pinned',()=>{
  const r=JSON.parse(fs.readFileSync(path.join(n,'daily/records/2026-10-05.json')));
  const t=JSON.parse(fs.readFileSync(path.join(n,'daily/translations/sl/2026-10-05.json')));
  const m=JSON.parse(fs.readFileSync(path.join(n,'daily/illustrations/2026-10-05.json')));
  assert.equal(r.id,storyId);assert.equal(r.revision.edition,'R3');
  assert.equal(r.content_sha256,'25901ac11d0e9cbad0961bcee265209eaf0960cc0ddbf34ff156e4935a40d233');
  assert.equal(t.content_sha256,'769cfa24e0b66042c19789284521c19897d5ac4bc57e1567e99856c7febce7c8');
  assert.equal(m.en_content_sha256,r.content_sha256);assert.equal(m.sl_content_sha256,t.content_sha256);
  assert.equal(r.scenes.length,8);assert.equal(t.scenes.length,8);
  assert.equal(m.schema,'nara.daily.illustrations.v3');assert.equal(m.instance,null);
  assert.deepEqual(m.images.map(i=>i.scene),[1,3,5]);
  assert.equal(m.images.length,3);
  assert.deepEqual(m.images.map(i=>i.after_paragraph),[16,9,20]);
  for(const i of m.images)assert.ok(Number.isInteger(i.after_paragraph)&&i.after_paragraph>=1&&i.after_paragraph<=r.scenes[i.scene-1].paragraphs.length);
  assert.ok(m.images.every(i=>i.width===1919&&i.height===1080&&i.width_4k===3838&&i.height_4k===2160));
  assert.equal(loadIllustrations(root,r,t).length,m.images.length);
  for(const i of m.images){
    const b=fs.readFileSync(path.join(n,i.src));
    assert.equal(h(b),i.sha256);
    assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');
    assert.equal(b.toString('ascii',12,16),'VP8 ');
    assert.equal(b.subarray(23,26).toString('hex'),'9d012a');
    assert.equal(b.readUInt16LE(26)&0x3fff,1919);assert.equal(b.readUInt16LE(28)&0x3fff,1080);
    const b4=fs.readFileSync(path.join(n,i.src_4k));
    assert.equal(h(b4),i.sha256_4k);
    assert.equal(b4.toString('ascii',0,4),'RIFF');assert.equal(b4.toString('ascii',8,12),'WEBP');
    assert.equal(b4.readUInt16LE(26)&0x3fff,3838);assert.equal(b4.readUInt16LE(28)&0x3fff,2160);
    assert.ok(i.alt_en&&i.alt_sl);
  }
  assert.equal(fs.readdirSync(path.join(n,'assets/img/daily/2026-10-05')).filter(f=>f.endsWith('.webp')||f.endsWith('.png')).length,0,'old flat Oct5 assets must be removed');
});

test('committed Daily and monthly R3 contain the retained or final R3 figures in each language, nowhere else',()=>{
  const m=JSON.parse(fs.readFileSync(path.join(n,'daily/illustrations/2026-10-05.json')));
  const en=JSON.parse(fs.readFileSync(path.join(n,'daily/records/2026-10-05.json')));
  const sl=JSON.parse(fs.readFileSync(path.join(n,'daily/translations/sl/2026-10-05.json')));
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  for(const file of ['Nara-AI-daily.html','Nara-AI-2026-10.html']){
    const html=fs.readFileSync(path.join(n,file),'utf8');
    assert.ok(imagesFrom(html)>=6,file);
    assert.ok(html.includes('data-language-content="sl" lang="sl" hidden'));
    assert.ok(html.includes('assets/js/nara-daily-resolution.js?v=1'));
    for(const lang of ['en','sl']){
      const a=article(html,lang),sections=a.match(/<section><h2>0[1-8] · [^<]+<\/h2>[\s\S]*?<\/section>/g);
      assert.equal(sections?.length,8,file+' '+lang);
      assert.equal(imagesFrom(a),m.images.length,file+' '+lang);
      sections.forEach((s,j)=>{
        const i=j+1,image=m.images.find(x=>x.scene===i),number=imagesFrom(s);assert.equal(number,image?1:0,'scene '+i+' '+lang);
        if(image){assert.ok(s.includes('src="'+image.src+'"'));assert.ok(s.includes('alt="'+(lang==='en'?image.alt_en:image.alt_sl)+'"'));assert.ok(s.includes('width="1919" height="1080" loading="lazy" decoding="async"'));assert.ok(s.includes('data-nara-image-4k="'+image.src_4k+'"'));const p=(lang==='en'?en:sl).scenes[i-1].paragraphs[image.after_paragraph-1];assert.ok(s.includes('<p>'+esc(p)+'</p><figure class="daily-scene-figure">'),'exact post-paragraph anchor '+file+' '+lang+' '+i);}
      });
    }
  }
  const archive=fs.readFileSync(path.join(n,'Nara-AI-archive.html'),'utf8');
  assert.ok(archive.includes('Nara-AI-2026-10.html'),'archive remains navigable');
  assert.ok(archive.includes('Nara-AI-2026-10.html'));
});

test('normal renderer reconstruction preserves the current figures without touching stored record text',()=>{
  const {records}=loadRecords(root),translations=loadTranslations(root,records),m=JSON.parse(fs.readFileSync(path.join(n,'daily/illustrations/2026-10-05.json')));
  const before=fs.readFileSync(path.join(n,'daily/records/2026-10-05.json'));
  const slBefore=fs.readFileSync(path.join(n,'daily/translations/sl/2026-10-05.json'));
  for(const page of [latestPage(records,'2026-10',translations,root),monthlyPage('2026-10',records.filter(r=>r.date.startsWith('2026-10')),translations,root)]){
    assert.ok(imagesFrom(page)>=m.images.length*2);
    assert.equal(imagesFrom(article(page,'en')),m.images.length);assert.equal(imagesFrom(article(page,'sl')),m.images.length);
  }
  assert.equal(h(fs.readFileSync(path.join(n,'daily/records/2026-10-05.json'))),h(before));
  assert.equal(h(fs.readFileSync(path.join(n,'daily/translations/sl/2026-10-05.json'))),h(slBefore));
  const batch=fs.readFileSync(path.join(root,'scripts/nara-daily-batch.mjs'),'utf8');
  assert.match(batch,/patchLatest\(latestPage\(next,month,translations,root\)/);
  assert.match(batch,/patchMonthly\(monthlyPage\(month,next\.filter/);
  const css=fs.readFileSync(path.join(n,'assets/css/nara-daily.css'),'utf8');
  assert.match(css,/\.daily-scene-figure img\{display:block;width:100%;height:auto;max-width:100%;object-fit:contain/);
});
