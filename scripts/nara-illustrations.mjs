/** Optional, source-bound illustrations. Private prompts and Drive IDs stay off the public manifest. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const assert=(ok,message)=>{if(!ok)throw Error(message)};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const bodyHash=r=>sha(JSON.stringify({title:r.title,deck:r.deck,shape:r.shape,scenes:r.scenes}));
const text=(s,n)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;

export function loadIllustrations(root,record,translation=null,{nonBlocking=false}={}){
  if(!root)return [];
  assert(/^\d{4}-\d{2}-\d{2}$/.test(record.date),'illustration date');
  const base=path.join(root,'public','Nara');
  let instance=record.instance||record.id?.match(/:S([123])$/)?.[0].slice(1)||null;
  if(!instance&&record.id===`NARA-D-${record.date}`){
    const dayFile=path.join(base,'daily','days',record.date+'.json');
    if(fs.existsSync(dayFile)){
      const day=JSON.parse(fs.readFileSync(dayFile,'utf8'));
      if(day.schema==='nara.daily.day.v1'&&day.date===record.date&&day.id===record.id&&/^S[123]$/.test(day.featured_instance))instance=day.featured_instance;
    }
  }
  const suffix=instance?'-'+instance:'';
  const file=path.join(base,'daily','illustrations',record.date+suffix+'.json');
  if(!fs.existsSync(file))return [];
  try {
    const m=JSON.parse(fs.readFileSync(file,'utf8')),v2=m.schema==='nara.daily.illustrations.v2';
    const keys=['schema','story_id','date','edition','en_content_sha256','sl_content_sha256','images',...(v2?['instance']:[])];
    assert(m&&typeof m==='object'&&!Array.isArray(m)&&Object.keys(m).length===keys.length&&Object.keys(m).every(k=>keys.includes(k)),'illustration manifest fields');
    if(v2){
      assert(/^S[123]$/.test(instance)&&m.instance===instance&&m.story_id===`NARA-D-${record.date}:${instance}`,'illustration instance binding');
      assert(m.edition===(record.revision?.edition??null)&&m.date===record.date,'illustration edition binding');
      assert(bodyHash(record)===record.content_sha256,'illustration English body binding');
      assert(translation&&bodyHash(translation)===translation.content_sha256,'illustration translated body binding');
      if(translation.source_content_sha256!==undefined)assert(translation.source_content_sha256===record.content_sha256,'illustration translation source binding');
    } else assert(m.schema==='nara.daily.illustrations.v1'&&m.story_id===record.id&&m.date===record.date&&m.edition===record.revision?.edition,'illustration edition binding');
    assert(m.en_content_sha256===record.content_sha256&&translation&&m.sl_content_sha256===translation.content_sha256,'illustration language content binding');
    assert(Array.isArray(m.images)&&m.images.length>0&&m.images.length<=record.scenes.length&&(!v2||m.images.length<=3),'illustration scene count');
    let prior=0;
    for(const image of m.images){
      const fields=['scene','src','width','height','alt_en','alt_sl','sha256'];
      const optional=v2?['generation_prompt_sha256','model_reported','claude_review','review_reply_sha256']:[];
      assert(image&&typeof image==='object'&&!Array.isArray(image)&&fields.every(k=>Object.hasOwn(image,k))&&Object.keys(image).every(k=>fields.includes(k)||optional.includes(k)),'illustration image fields');
      assert(Number.isInteger(image.scene)&&image.scene>prior&&image.scene<=record.scenes.length,'illustration scene order');prior=image.scene;
      assert(image.width===1672&&image.height===941,'illustration image dimensions');
      assert(text(image.alt_en,300)&&text(image.alt_sl,300),'illustration alt text');
      const prefix=`assets/img/daily/${record.date}/${v2?instance+'/':''}`;
      assert(typeof image.src==='string'&&image.src.startsWith(prefix)&&/^[A-Za-z0-9_.-]+\.png$/.test(image.src.slice(prefix.length)),'illustration unsafe source path');
      const asset=path.join(base,image.src);assert(fs.existsSync(asset)&&fs.statSync(asset).isFile(),'illustration missing static file');
      const bytes=fs.readFileSync(asset);assert(/^[a-f0-9]{64}$/.test(image.sha256)&&sha(bytes)===image.sha256,'illustration source hash mismatch');
      if(v2){
        assert(bytes.length>=24&&bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a'&&bytes.subarray(12,16).toString()==='IHDR'&&bytes.readUInt32BE(16)===image.width&&bytes.readUInt32BE(20)===image.height,'illustration PNG dimensions');
        for(const k of ['generation_prompt_sha256','review_reply_sha256'])if(image[k]!==undefined)assert(/^[a-f0-9]{64}$/.test(image[k]),'illustration provenance hash');
        if(image.model_reported!==undefined)assert(text(image.model_reported,120),'illustration model label');
        if(image.claude_review!==undefined)assert(['PASS','MISSING','FIX_LIMIT_REACHED'].includes(image.claude_review),'illustration review verdict');
      }
    }
    return m.images;
  } catch(error){
    // Automatic instance images are optional; invalid assets cannot hold a text release.
    if(instance&&nonBlocking)return [];
    throw error;
  }
}
export const renderIllustration=(image,lang='en')=>'<figure class="daily-scene-figure"><img src="'+esc(image.src)+'" alt="'+esc(lang==='sl'?image.alt_sl:image.alt_en)+'" width="'+image.width+'" height="'+image.height+'" loading="lazy" decoding="async"></figure>';
