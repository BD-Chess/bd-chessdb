/** Optional, source-bound illustrations. Private prompts and Drive IDs stay off the public manifest. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const assert=(ok,message)=>{if(!ok)throw Error(message)};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const bodyHash=r=>sha(JSON.stringify({title:r.title,deck:r.deck,shape:r.shape,scenes:r.scenes}));
const text=(s,n)=>typeof s==='string'&&s.trim().length>0&&s.length<=n;
const validateWebp=(bytes,width,height)=>{

        assert(bytes.length>=30&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP','illustration WebP header');
        const kind=bytes.toString('ascii',12,16);let w,h;
        if(kind==='VP8 '){assert(bytes.subarray(23,26).toString('hex')==='9d012a','illustration WebP VP8 marker');w=bytes.readUInt16LE(26)&0x3fff;h=bytes.readUInt16LE(28)&0x3fff}
        else if(kind==='VP8X'){w=bytes.readUIntLE(24,3)+1;h=bytes.readUIntLE(27,3)+1}
        else if(kind==='VP8L'){assert(bytes[20]===0x2f,'illustration WebP VP8L marker');w=1+(((bytes[22]&0x3f)<<8)|bytes[21]);h=1+(((bytes[24]&0x0f)<<10)|(bytes[23]<<2)|((bytes[22]&0xc0)>>6))}
        else throw Error('illustration unsupported WebP encoding');
        assert(w===width&&h===height,'illustration WebP dimensions');
};

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
    const m=JSON.parse(fs.readFileSync(file,'utf8')),v3=m.schema==='nara.daily.illustrations.v3',v2=m.schema==='nara.daily.illustrations.v2'||v3;
    const keys=['schema','story_id','date','edition','en_content_sha256','sl_content_sha256','images',...(v2?['instance']:[])];
    assert(m&&typeof m==='object'&&!Array.isArray(m)&&Object.keys(m).length===keys.length&&Object.keys(m).every(k=>keys.includes(k)),'illustration manifest fields');
    if(v3&&!instance){
      assert(m.instance===null&&m.story_id===record.id&&m.date===record.date&&m.edition===record.revision?.edition,'illustration edition binding');
      assert(bodyHash(record)===record.content_sha256&&translation&&bodyHash(translation)===translation.content_sha256,'illustration body binding');
    } else if(v2){
      assert(/^S[123]$/.test(instance)&&m.instance===instance&&m.story_id===`NARA-D-${record.date}:${instance}`,'illustration instance binding');
      assert(m.edition===(record.revision?.edition??null)&&m.date===record.date,'illustration edition binding');
      assert(bodyHash(record)===record.content_sha256,'illustration English body binding');
      assert(translation&&bodyHash(translation)===translation.content_sha256,'illustration translated body binding');
      if(translation.source_content_sha256!==undefined)assert(translation.source_content_sha256===record.content_sha256,'illustration translation source binding');
    } else assert(m.schema==='nara.daily.illustrations.v1'&&m.story_id===record.id&&m.date===record.date&&m.edition===record.revision?.edition,'illustration edition binding');
    assert(m.en_content_sha256===record.content_sha256&&translation&&m.sl_content_sha256===translation.content_sha256,'illustration language content binding');
    assert(Array.isArray(m.images)&&m.images.length>0&&m.images.length<=record.scenes.length&&(!v2||m.images.length<=3),'illustration scene count');
    let prior=0,priorParagraph=0;
    for(const image of m.images){
      const fields=['scene','src','width','height','alt_en','alt_sl','sha256',...(v3?['after_paragraph']:[])];
      const optional=[...(v2?['generation_prompt_sha256','model_reported','claude_review','review_reply_sha256']:[]),...(v3?['src_4k','width_4k','height_4k','sha256_4k']:[])];
      assert(image&&typeof image==='object'&&!Array.isArray(image)&&fields.every(k=>Object.hasOwn(image,k))&&Object.keys(image).every(k=>fields.includes(k)||optional.includes(k)),'illustration image fields');
      assert(Number.isInteger(image.scene)&&image.scene>=1&&image.scene<=record.scenes.length&&(v3?image.scene>=prior:image.scene>prior),'illustration scene order');
      if(v3){
        const en=record.scenes[image.scene-1].paragraphs,sl=translation.scenes[image.scene-1].paragraphs;
        assert(en.length===sl.length,'illustration translated paragraph structure');
        assert(Number.isInteger(image.after_paragraph)&&image.after_paragraph>=1&&image.after_paragraph<=en.length,'illustration paragraph anchor');
        assert(image.scene>prior||image.after_paragraph>priorParagraph,'illustration paragraph order');
        priorParagraph=image.after_paragraph;
      }
      prior=image.scene;
      const variantKeys=['src_4k','width_4k','height_4k','sha256_4k'];
      const dual=variantKeys.some(k=>Object.hasOwn(image,k));
      assert(!dual||(v3&&variantKeys.every(k=>Object.hasOwn(image,k))),'illustration incomplete 4K variant');
      assert(dual
        ? !instance&&record.date==='2026-10-05'&&image.width===1919&&image.height===1080&&image.width_4k===3838&&image.height_4k===2160
        : image.width===1672&&image.height===941,'illustration image dimensions');
      assert(text(image.alt_en,300)&&text(image.alt_sl,300),'illustration alt text');
      const prefix=`assets/img/daily/${record.date}/${instance&&v2?instance+'/':''}`;
      if(v3)assert(image.src?.endsWith('.webp'),'illustration v3 WebP delivery');
      const hdPrefix=dual?prefix+'HD/':prefix;
      assert(typeof image.src==='string'&&image.src.startsWith(hdPrefix)&&/^[A-Za-z0-9_.-]+\.(?:png|webp)$/.test(image.src.slice(hdPrefix.length)),'illustration unsafe source path');
      const asset=path.join(base,image.src);assert(fs.existsSync(asset)&&fs.statSync(asset).isFile(),'illustration missing static file');
      const bytes=fs.readFileSync(asset);assert(/^[a-f0-9]{64}$/.test(image.sha256)&&sha(bytes)===image.sha256,'illustration source hash mismatch');
      if(image.src.endsWith('.webp'))validateWebp(bytes,image.width,image.height);
      if(dual){
        const basename=image.src.slice(hdPrefix.length);
        assert(image.src_4k===prefix+'4K/'+basename,'illustration unsafe 4K source path');
        assert(/^[a-f0-9]{64}$/.test(image.sha256_4k),'illustration 4K hash');
        const file4k=path.join(base,image.src_4k);
        assert(fs.existsSync(file4k)&&fs.statSync(file4k).isFile(),'illustration missing 4K static file');
        const bytes4k=fs.readFileSync(file4k);
        assert(sha(bytes4k)===image.sha256_4k,'illustration 4K source hash mismatch');
        validateWebp(bytes4k,image.width_4k,image.height_4k);
      }
      if(v2){
        if(image.src.endsWith('.png'))assert(bytes.length>=24&&bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a'&&bytes.subarray(12,16).toString()==='IHDR'&&bytes.readUInt32BE(16)===image.width&&bytes.readUInt32BE(20)===image.height,'illustration PNG dimensions');
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
export const renderIllustration=(image,lang='en')=>'<figure class="daily-scene-figure"><img src="'+esc(image.src)+'"'+(image.src_4k?' data-nara-image-hd="'+esc(image.src)+'" data-nara-image-4k="'+esc(image.src_4k)+'"':'')+' alt="'+esc(lang==='sl'?image.alt_sl:image.alt_en)+'" width="'+image.width+'" height="'+image.height+'" loading="lazy" decoding="async"></figure>';

/** One-based anchors; legacy manifests remain at scene end. EN/SL share structural indices. */
export function renderSceneParagraphs(scene,sceneNumber,images=[],lang='en'){
  return scene.paragraphs.map((p,j)=>'<p>'+esc(p)+'</p>'+images.filter(x=>x.scene===sceneNumber&&(x.after_paragraph??scene.paragraphs.length)===j+1).map(x=>renderIllustration(x,lang)).join('')).join('\n');
}
