// Source-bound, repeatable lettering extraction. Never edits original art or pairs.
// node scripts/dfc-build-text-layers.mjs H1_ROOT ORIGINAL_R2_ROOT QA_DIR [LAST_PAGE]
import {readFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {sha,atomic,appRoot} from './dfc-build-overviews.mjs';
import {assert,canonical,validateEdition} from '../public/Nara/dualframe-lab/dfc-model.mjs';
import {validatePassiveSVG} from './dfc-import-pairs.mjs';
const sharp=createRequire(new URL('../functions/package.json',import.meta.url))('sharp');
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const plain=s=>s.replace(/<[^>]*>/g,' ').replace(/&apos;|&#x27;|&#39;/g,"'").replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
const norm=s=>s.normalize('NFC').replace(/\s+/g,' ').trim().toUpperCase();
const text=(x,y,value,size=24,colour='#181e29',align='start',extra='')=>`<text x="${x}" y="${y}" font-family="Comic" font-size="${size}" fill="${colour}" text-anchor="${align}"${extra}>${esc(value)}</text>`;
const frame=(w,h,style,body)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${style}${body}</svg>`);
// Exact source-font outlines use ReportLab's authored unkerned advance metrics.
// This avoids platform font fallback in SVG rasterizers and keeps glyphs passive.
function outline(markup,fonts){
 const code=`import sys,json,xml.etree.ElementTree as E
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
q=json.load(sys.stdin);fonts={k:TTFont(v) for k,v in q['fonts'].items()};root=E.fromstring('<g>'+q['markup']+'</g>')
for parent in list(root.iter()):
 for e in list(parent):
  if e.tag!='text':continue
  a=e.attrib;value=''.join(e.itertext());font=fonts[a.get('font-family','Comic')];gs=font.getGlyphSet();cm=font.getBestCmap();scale=float(a['font-size'])/font['head'].unitsPerEm
  names=[cm[ord(c)] for c in value];width=sum(font['hmtx'][g][0] for g in names)*scale;x=float(a['x']);y=float(a['y']);anchor=a.get('text-anchor','start');x-=width/2 if anchor=='middle' else width if anchor=='end' else 0
  pen=SVGPathPen(gs)
  for name in names:
   gs[name].draw(TransformPen(pen,(scale,0,0,-scale,x,y)));x+=font['hmtx'][name][0]*scale
  at={k:v for k,v in a.items() if k in ['fill','stroke','stroke-width','stroke-linejoin','paint-order','transform']};at.update({'d':pen.getCommands(),'data-original-text':value,'data-original-font':a.get('font-family','Comic')});new=E.Element('path',at);parent.insert(list(parent).index(e),new);parent.remove(e)
sys.stdout.write(''.join(E.tostring(c,encoding='unicode') for c in root))`;
 return execFileSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3',['-c',code],{input:JSON.stringify({markup,fonts}),maxBuffer:16*1048576}).toString('utf8');
}
function bubble(spec,lang){
 const [cx,cy,rx,ry]=spec.ellipse,tip=[spec.tip[0],spec.tip[1]+88],y=cy+88,angle=Math.atan2((tip[1]-y)/ry,(tip[0]-cx)/rx),points=[];
 for(let i=0;i<105;i++){const a=angle+.17+(2*Math.PI-.34)*i/104;points.push([cx+rx*Math.cos(a),y+ry*Math.sin(a)]);}points.push(tip);
 const d='M '+points.map(p=>p.map(n=>n.toFixed(2)).join(',')).join(' L ')+' Z',size=spec.size??19,lines=spec[lang].map(s=>s.toUpperCase()),leading=size*1.14,first=y-(lines.length-1)*leading/2+size*.34;
 return `<path d="${d}" fill="#fffef9" stroke="#181e29" stroke-width="2.3" stroke-linejoin="round"/>`+lines.map((s,i)=>text(cx,first+i*leading,s,size,'#181e29','middle')).join('');
}
function sfx(spec,lang){return text(spec.x,spec.y+88,spec[lang].toUpperCase(),spec.size??34,'#fffef9','middle',` stroke="#181e29" stroke-width="1.8" paint-order="stroke"${spec.rotate?` transform="rotate(${spec.rotate} ${spec.x} ${spec.y+88})"`:''}`);}
function furniture(page,lang){return text(29,38,'ILLUMINARA',30)+text(30,66,lang==='SL'?'TEŽA SVETLOBE':'THE WEIGHT OF LIGHT',19,'#9d6624')+text(994,35,'PILOT 01',12,'#181e29','end')+text(994,60,'BD × GPT',13,'#9d6624','end')+text(24,1645,lang==='SL'?'Svet in liki: Bojan Dobrečevič · Stripovski pilot: BD × GPT':'World and characters: Bojan Dobrečevič · Comic pilot: BD × GPT',10,'#666b74')+text(998,1645,`${page} / 8`,12,'#181e29','end');}
export async function buildTextLayers(h1,r2,qa,lastPage=8){
 const dest=path.join(appRoot,'content/illuminara'),edition=JSON.parse(await readFile(path.join(dest,'edition.json'))),members=JSON.parse(await readFile(path.join(dest,'members.json'))),specBytes=await readFile(path.join(h1,'specs/new_page_specs.json')),specs=JSON.parse(specBytes).pages,baseline=JSON.parse(await readFile(path.join(dest,'sources/DFC_OVERVIEW_CATALOG.json')));
 assert(sha(await readFile(path.join(h1,'output/DFC_OVERVIEW_CATALOG.json')))===edition.source.catalog,'TEXT_SOURCE_CATALOG');
 assert(sha(await readFile(path.join(h1,'output/DFC_DIALOGUE_SOURCE.json')))===edition.source.dialogue,'TEXT_SOURCE_DIALOGUE');
 await mkdir(qa,{recursive:true});const fonts={},fontHashes={},style='';
 for(const [family,file]of [['Comic','DejaVuSans-Bold.ttf'],['ComicItalic','VeraBI.ttf']]){fonts[family]=path.join(h1,'sources/Illuminara_Comic_P01-P03_R2/baseline_R1/fonts',file);fontHashes[file]=sha(await readFile(fonts[family]));}
 const saved=[],receipt={schema:'bd.dfc.text-layers.v1',version:'20261017-R1',source:edition.source,fonts:fontHashes,renderer:'Original SVG tokens P01-P03; exact H1 ComicPage geometry P04-P08; unchanged art at y=88 in 1024x1660',font_derivation:'Original glyph outlines and authored unkerned advance metrics; exact source text retained as data-original-text; no font substitution',pages:[],panels:[]};
 const save=async(file,b,extra={})=>{const a={file,bytes:b.length,sha256:sha(b),...extra};await atomic(path.join(dest,file),b);saved.push(a);return a;};
 for(const page of edition.pages.slice(0,lastPage))for(const lang of ['SL','EN']){
  const num=page.reading_order,panels=edition.panels.filter(p=>p.page_id===page.page_id),artSpec=panels[0].art_source;
  const art=await readFile(path.join(h1,artSpec.file));assert(sha(art)===artSpec.sha256,'TEXT_ART_HASH');
  const groups=new Map(panels.map(p=>[p.panel_id,'']));let fixed,sourceSVG=null;
  if(num<=3){
   const svgFile=path.join(r2,num===1?'baseline_R1':'pages',`Illuminara_${lang==='SL'?'Teza_svetlobe':'Weight_of_Light'}_P${String(num).padStart(2,'0')}_${lang}_${num===1?'R1':'R2'}.svg`),svg=await readFile(svgFile,'utf8');sourceSVG=sha(svg);
   const image=svg.match(/<image\b[^>]*id="unchanged-art"[^>]*\/>/)?.[0];assert(image&&/y="88"/.test(image),'TEXT_SOURCE_TRANSFORM');assert(sha(Buffer.from(image.match(/base64,([^"]+)/)[1],'base64'))===artSpec.sha256,'TEXT_EMBEDDED_ART_HASH');
   const body=svg.match(/<g id="editable-lettering">([\s\S]*?)<\/g>/)?.[1];assert(body,'TEXT_SOURCE_GROUP');const records=panels.flatMap(p=>p.dialogue),tokens=body.match(/<path\b[^>]*\/>|<text\b[^>]*>[\s\S]*?<\/text>/g)||[];let pending='',words='',at=0;fixed='';
   for(const token of tokens){if(token.startsWith('<text')){const y=+token.match(/\by="([^"]+)/)[1];if(y<88||y>=1624){assert(!pending,'TEXT_FURNITURE_BOUNDARY');fixed+=token;continue;}words+=(words?' ':'')+plain(token);}
    pending+=token;if(!words)continue;const record=records[at];assert(record&&norm(record[lang]).startsWith(norm(words)),'TEXT_ORIGINAL_ORDER');if(norm(words)===norm(record[lang])){groups.set(record.panel_id,groups.get(record.panel_id)+`<g data-text-ids="${record.text_id}">${pending}</g>`);pending='';words='';at++;}
   }assert(at===records.length&&!pending,'TEXT_ALL_TOKENS_OWNED');
  }else{fixed=furniture(num,lang);const spec=specs.find(s=>s.page===num);assert(spec,'TEXT_PAGE_SPEC');for(const b of spec.bubbles){assert(groups.has(b.panel_id),'TEXT_BUBBLE_OWNER');groups.set(b.panel_id,groups.get(b.panel_id)+`<g data-text-ids="${b.text_ids.join(' ')}">${bubble(b,lang)}</g>`);}for(const s of spec.sfx){assert(groups.has(s.panel_id),'TEXT_SFX_OWNER');groups.set(s.panel_id,groups.get(s.panel_id)+`<g data-text-ids="${(s.text_ids||[s.text_id]).join(' ')}">${sfx(s,lang)}</g>`);}}
  fixed=outline(fixed,fonts);const artSVG=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1660" viewBox="0 0 1024 1660">${style}<rect width="1024" height="1660" fill="white"/><image x="0" y="88" width="1024" height="1536" href="data:image/png;base64,${art.toString('base64')}"/>${fixed}</svg>`);
  const clean=await save(`text-r1/pages/${page.page_id}_${lang}.clean.webp`,await sharp(artSVG).webp({quality:96,effort:6}).toBuffer(),{width_px:1024,height_px:1660,source_sha256:artSpec.sha256,source_art_y_offset_px:88});
  page.text_layers??={capability:'clean-art-and-independent-panel-lettering',clean_assets:{},panel_overlays:{SL:{},EN:{}}};page.text_layers.clean_assets[lang]=clean;
  let all='';for(const p of panels){const group=groups.get(p.panel_id),wordList=[...group.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map(m=>plain(m[1])).join(' ');assert(norm(wordList)===norm(p.dialogue.map(r=>r[lang]).join(' ')),'TEXT_EXACT_SOURCE_WORDS');
   const content=`<g data-panel-id="${p.panel_id}" data-text-ids="${p.text_ids.join(' ')}">${outline(group,fonts)}</g>`,full=frame(1024,1660,style,content);await validatePassiveSVG(full,{width_px:1024,height_px:1660});all+=content;
   const overlay=await save(`text-r1/overview/${p.panel_id}_${lang}.svg`,full,{width_px:1024,height_px:1660,panel_id:p.panel_id,text_ids:p.text_ids});page.text_layers.panel_overlays[lang][p.panel_id]=overlay;
   const [x,y,w,h]=p.source_zoom.crop_rect_px;assert(w===p.source_zoom.width_px&&h===p.source_zoom.height_px,'TEXT_CROP_GEOMETRY');const crop=frame(w,h,style,`<g transform="translate(${-x} ${-y-88})">${content}</g>`);await validatePassiveSVG(crop,{width_px:w,height_px:h});
   p.source_overlays??={};p.source_overlays[lang]=await save(`text-r1/source/${p.panel_id}_${lang}.svg`,crop,{width_px:w,height_px:h,panel_id:p.panel_id,text_ids:p.text_ids});receipt.panels.push({panel_id:p.panel_id,language:lang,text_ids:p.text_ids,overview_sha256:overlay.sha256,source_sha256:p.source_overlays[lang].sha256});
  }
  await atomic(path.join(qa,`${page.page_id}_${lang}.clean.png`),await sharp(artSVG).png().toBuffer());
  const fullSVG=frame(1024,1660,style,`<rect width="1024" height="1660" fill="white"/><image xmlns:xlink="http://www.w3.org/1999/xlink" x="0" y="88" width="1024" height="1536" xlink:href="data:image/png;base64,${art.toString('base64')}"/>${fixed}${all}`);
  const composite=await sharp(fullSVG).png().toBuffer();await atomic(path.join(qa,`${page.page_id}_${lang}.lettered.png`),composite);
  const reference=await readFile(path.join(h1,baseline.pages[num-1].overview_assets[lang].file));await atomic(path.join(qa,`${page.page_id}_${lang}.accepted.png`),reference);
  receipt.pages.push({page_id:page.page_id,language:lang,art_source:artSpec,original_svg_sha256:sourceSVG,layout_specs_sha256:num>3?sha(specBytes):null,clean_sha256:clean.sha256,derived_composite_sha256:sha(composite),accepted_reference_sha256:sha(reference)});console.log(JSON.stringify({phase:'text-layers',page:page.page_id,language:lang,panels:panels.length}));
 }
 if(lastPage===8){edition.version='20261017-TEXT-R1';edition.text_capabilities={overview:true,source:true,pairs:true,languages:['SL','EN'],policy:'clean-art-with-independent-original-lettering'};validateEdition(edition);
  await save('text-r1/layers.json',Buffer.from(JSON.stringify(receipt,null,2)+'\n'));await save('edition.json',Buffer.from(JSON.stringify(edition,null,2)+'\n'));const replacements=new Map(saved.map(a=>[a.file,a]));members.members=members.members.map(a=>replacements.get(a.file)||a);const prior=new Set(members.members.map(a=>a.file));members.members.push(...saved.filter(a=>!prior.has(a.file)));await atomic(path.join(dest,'members.json'),JSON.stringify(members,null,2)+'\n');
 }
 await atomic(path.join(qa,'layer-build-receipt.json'),JSON.stringify(receipt,null,2)+'\n');return receipt;
}
if(process.argv[1]===fileURLToPath(import.meta.url))await buildTextLayers(...process.argv.slice(2,5).map(p=>path.resolve(p)),Number(process.argv[5]||8));
