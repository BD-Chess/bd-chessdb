// DualFrame AI LAB. Concept: Bojan Dobrečevič (BD). Implementation: GPT Work.
export const SCHEMA = 'bd.dualframe.pair.v1';
export const MAX_BYTES = 12 * 1024 * 1024;
export const MAX_PIXELS = 24000000;
export const RATIOS = { landscape: '16:9', portrait: '9:16' };
export const opposite = source => source === 'portrait' ? 'landscape' : 'portrait';
export const orientation = (w, h) => h > w ? 'portrait' : 'landscape';
export const ELIGIBILITY_RULE = '20261013-task-proof-v3';
const HASH = /^[a-f0-9]{64}$/;
export const MODE_REGISTRY = Object.freeze({
  faithful: Object.freeze({ label: 'Faithful Expand', changes: 'added-regions-only', pixel_protection: true, rubric: ['identity','seams','naturalness','subjectSize','quality'] }),
  smart: Object.freeze({ label: 'Smart Reframe', changes: 'entire-composition-may-change', pixel_protection: false, rubric: ['identity','composition','naturalness','subjectSize','quality'] }),
  infographic: Object.freeze({ label: 'Infographic / Text', changes: 'layout-and-text-may-change', pixel_protection: false, rubric: ['textAccuracy','textReadability','layout','hierarchy','quality'] })
});
export function canonicalMode(value) { return value === 'cinematic' ? 'smart' : Object.hasOwn(MODE_REGISTRY, value) ? value : null; }
export function comparisonRubric(mode) { return [...(MODE_REGISTRY[canonicalMode(mode)]?.rubric || [])]; }
export function modeDefinition(mode) { return MODE_REGISTRY[canonicalMode(mode)] || null; }
export async function sha256(value) {
  const data = typeof value === 'string' ? new TextEncoder().encode(value) : value instanceof Blob ? await value.arrayBuffer() : value;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(n => n.toString(16).padStart(2, '0')).join('');
}
export function geometry(w, h, target, position = 'center', hd = true) {
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || !RATIOS[target]) throw Error('INVALID_GEOMETRY');
  const [a, b] = target === 'landscape' ? [16, 9] : [9, 16];
  const unit = Math.max(Math.ceil(w / a), Math.ceil(h / b), hd ? 120 : 1);
  const width = a * unit, height = b * unit;
  if (width * height > MAX_PIXELS) throw Error('CANVAS_PIXEL_LIMIT');
  const x = position === 'left' ? 0 : position === 'right' ? width - w : Math.floor((width - w) / 2);
  const y = position === 'top' ? 0 : position === 'bottom' ? height - h : Math.floor((height - h) / 2);
  return { width, height, x, y, source_width: w, source_height: h, scale: 1, no_crop: true };
}
export function taskGeometry(w, h, target, position = 'center', mode = 'faithful', quality = 'hd') {
  const canonical = canonicalMode(mode);
  if (!canonical || !['hd','4k'].includes(quality)) throw Error('INVALID_TASK');
  if (canonical === 'faithful') {
    const p = geometry(w,h,target,position,quality === 'hd');
    if (quality === 'hd' || Math.max(p.width,p.height) >= 3840) return p;
    const [a,b] = target === 'landscape' ? [16,9] : [9,16], unit = Math.max(Math.ceil(w/a),Math.ceil(h/b),240);
    const width=a*unit, height=b*unit;
    if (width*height > MAX_PIXELS) throw Error('CANVAS_PIXEL_LIMIT');
    return {...p,width,height,x:position==='left'?0:position==='right'?width-w:Math.floor((width-w)/2),y:position==='top'?0:position==='bottom'?height-h:Math.floor((height-h)/2)};
  }
  if (!Number.isInteger(w) || !Number.isInteger(h) || w<1 || h<1 || !RATIOS[target]) throw Error('INVALID_GEOMETRY');
  const [width,height] = target === 'landscape' ? (quality==='4k'?[3840,2160]:[1920,1080]) : (quality==='4k'?[2160,3840]:[1080,1920]);
  const scale=Math.min(width/w,height/h), source_width=Math.round(w*scale), source_height=Math.round(h*scale);
  return {width,height,x:position==='left'?0:position==='right'?width-source_width:Math.floor((width-source_width)/2),y:position==='top'?0:position==='bottom'?height-source_height:Math.floor((height-source_height)/2),source_width,source_height,scale,no_crop:true,source_is_resampled:scale!==1};
}
export function verifyProtectedPixels({sourceData,sourceWidth,sourceHeight,outputData,outputWidth,outputHeight,placement}) {
  const dims=[sourceWidth,sourceHeight,outputWidth,outputHeight];
  const rgba8=value=>value instanceof Uint8Array || value instanceof Uint8ClampedArray;
  if (!rgba8(sourceData)||!rgba8(outputData)||dims.some(v=>!Number.isInteger(v)||v<1) || sourceWidth*sourceHeight>MAX_PIXELS || outputWidth*outputHeight>MAX_PIXELS || sourceData?.length!==sourceWidth*sourceHeight*4 || outputData?.length!==outputWidth*outputHeight*4) throw Error('INVALID_PIXEL_BUFFERS');
  const p=placement;
  if (!p || !Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.y<0||p.x+sourceWidth>outputWidth||p.y+sourceHeight>outputHeight || p.scale!==1 || p.source_width!==sourceWidth || p.source_height!==sourceHeight) throw Error('INVALID_PROTECTED_PLACEMENT');
  let channel_difference_count=0, pixel_difference_count=0, max_channel_difference=0;
  for(let y=0;y<sourceHeight;y++)for(let x=0;x<sourceWidth;x++){
    let changed=false;
    for(let channel=0;channel<4;channel++){
      const difference=Math.abs(sourceData[(y*sourceWidth+x)*4+channel]-outputData[((y+p.y)*outputWidth+x+p.x)*4+channel]);
      if(difference){channel_difference_count++;changed=true;max_channel_difference=Math.max(max_channel_difference,difference);}
    }
    if(changed)pixel_difference_count++;
  }
  return {schema:'bd.dualframe.pixel-proof.v1',verified:channel_difference_count===0,checked_scope:'normalized-rgba-values',normalization:'browser-decoded-sRGB-RGBA8',source_width:sourceWidth,source_height:sourceHeight,protected_pixel_count:sourceWidth*sourceHeight,checked_channel_count:sourceData.length,channel_difference_count,pixel_difference_count,max_channel_difference,placement:{x:p.x,y:p.y,width:sourceWidth,height:sourceHeight,scale:1}};
}
export function verifiedFourK(asset) {
  const originVerified=['native','upscaled'].includes(asset?.resolution_origin) || (['provider-native','provider-native-composite'].includes(asset?.resolution_origin) && asset?.native_4k===true) || (asset?.resolution_origin==='reference-provided' && asset?.origin==='reference' && asset?.reference_only===true);
  return Boolean(asset?.resolution_verified && Number.isInteger(asset.width) && Number.isInteger(asset.height) && Math.max(asset.width,asset.height)>=3840 && Math.min(asset.width,asset.height)>=2160 && asset.width*asset.height<=MAX_PIXELS && originVerified);
}
export function deviceOrientation({ device = 'desktop', width = 1280, height = 720, override = 'auto', simulation = 'auto', tablet = 'viewport' } = {}) {
  if (['portrait', 'landscape', 'original'].includes(override)) return override;
  if (simulation === 'phone-p') return 'portrait';
  if (simulation === 'phone-l' || simulation === 'desktop') return 'landscape';
  if (device === 'phone' || (device === 'tablet' && tablet === 'viewport')) return orientation(width, height);
  return 'landscape';
}
export function selectAsset(pair, target, quality = 'hd', dpr = 1) {
  if (target === 'original') return { asset: pair.original, orientation: pair.original.source_orientation, quality: 'original', missing: false };
  const branch = pair.variants[target];
  const wanted = quality === 'auto' ? (dpr > 1.5 && verifiedFourK(branch?.fourK) ? '4k' : 'hd') : quality;
  if (wanted === '4k' && verifiedFourK(branch?.fourK)) return { asset: branch.fourK, orientation: target, quality: '4k', missing: false, upscaled:branch.fourK.resolution_origin==='upscaled' };
  if (branch?.hd) return { asset: branch.hd, orientation: target, quality: branch.hd.origin === 'original' ? 'original' : 'hd', missing: wanted === '4k' };
  // A 4K-first result remains usable before a separate HD composition exists.
  // Keep its actual quality label; never relabel the 4K file as native HD.
  if (verifiedFourK(branch?.fourK)) return {asset:branch.fourK,orientation:target,quality:'4k',missing:wanted!=='4k',upscaled:branch.fourK.resolution_origin==='upscaled'};
  return { asset: pair.original, orientation: pair.original.source_orientation, quality: 'original', missing: true };
}
export function sniff(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length >= 24 && [137,80,78,71,13,10,26,10].every((n,i) => b[i] === n)) return 'image/png';
  if (b.length >= 12 && b[0] === 255 && b[1] === 216 && b[2] === 255) return 'image/jpeg';
  if (b.length >= 30 && String.fromCharCode(...b.slice(0,4)) === 'RIFF' && String.fromCharCode(...b.slice(8,12)) === 'WEBP') return 'image/webp';
  throw Error('UNSUPPORTED_OR_CORRUPT');
}
export function headerSize(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), d = new DataView(b.buffer, b.byteOffset, b.byteLength), mime = sniff(b);
  let w, h;
  if (mime === 'image/png') { w = d.getUint32(16); h = d.getUint32(20); }
  if (mime === 'image/webp') {
    const type = String.fromCharCode(...b.slice(12,16));
    if (type === 'VP8X') { w = 1 + b[24] + (b[25]<<8) + (b[26]<<16); h = 1 + b[27] + (b[28]<<8) + (b[29]<<16); }
    else if (type === 'VP8L' && b[20] === 47) { const v = d.getUint32(21,true); w = (v & 16383) + 1; h = ((v >>> 14) & 16383) + 1; }
    else if (type === 'VP8 ' && b[23] === 157 && b[24] === 1 && b[25] === 42) { w = d.getUint16(26,true)&16383; h = d.getUint16(28,true)&16383; }
  }
  if (mime === 'image/jpeg') {
    let i = 2;
    while (i + 8 < b.length) {
      if (b[i] !== 255) throw Error('UNSUPPORTED_OR_CORRUPT');
      while (b[i] === 255) i++;
      const m = b[i++];
      if (m === 217 || m === 218) break;
      if (m === 1 || (m >= 208 && m <= 215)) continue;
      if (i + 2 > b.length) break;
      const len = d.getUint16(i);
      if (len < 2 || i + len > b.length) throw Error('UNSUPPORTED_OR_CORRUPT');
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(m)) { h = d.getUint16(i+3); w = d.getUint16(i+5); break; }
      i += len;
    }
  }
  if (!w || !h || w * h > MAX_PIXELS) throw Error(w && h ? 'IMAGE_PIXEL_LIMIT' : 'UNSUPPORTED_OR_CORRUPT');
  return { width: w, height: h, mime };
}
export const TRANSITIONS = { PENDING:['RUNNING','CANCELLED','HELD','FAILED'], RUNNING:['READY','FAILED','CANCELLED','HELD'], READY:['ACCEPTED','REJECTED'], FAILED:[], CANCELLED:[], HELD:[], ACCEPTED:[], REJECTED:[] };
export function transition(job, next) {
  if (!TRANSITIONS[job.status]?.includes(next)) throw Error('INVALID_STATE_TRANSITION');
  return { ...job, status: next, updated_at: new Date().toISOString() };
}
export function publicManifest(pair) {
  return JSON.parse(JSON.stringify(pair, (key,value) => ['blob','normalized','thumbnail','candidate','url','upload_id','gateway_job_id'].includes(key) ? undefined : value));
}
export function checkPair(pair) {
  if (!pair || pair.schema !== SCHEMA || !/^[a-zA-Z0-9_-]{8,100}$/.test(pair.pair_id) || !HASH.test(pair.original?.sha256) || !pair.variants || !Number.isInteger(pair.original.width) || !Number.isInteger(pair.original.height) || pair.original.width<1 || pair.original.height<1 || pair.original.width*pair.original.height>MAX_PIXELS || orientation(pair.original.width,pair.original.height)!==pair.original.source_orientation) throw Error('INVALID_MANIFEST');
  if (pair.original.visibility !== 'private') throw Error('PRIVATE_REQUIRED');
  for (const direction of ['portrait','landscape']) for (const [q,a] of Object.entries(pair.variants[direction] || {})) {
    if (!['hd','fourK'].includes(q) || !HASH.test(a.sha256) || !Number.isInteger(a.width) || !Number.isInteger(a.height) || a.width<1 || a.height<1 || orientation(a.width,a.height) !== direction || !a.path || a.width*a.height > MAX_PIXELS) throw Error('INVALID_VARIANT');
    if (q === 'fourK' && !verifiedFourK(a)) throw Error('UNVERIFIED_4K');
  }
  return true;
}
export function comparisonEligibility(pair, web, reference, review = 'equal-canvas-v1') {
  const target = opposite(pair.original.source_orientation), ratio = RATIOS[target];
  const reasons = [];
  const modes = [web,reference].map(output=>canonicalMode(output?.mode));
  if(modes.some(mode=>!mode))reasons.push('TASK_MODE_UNVERIFIED');
  else if(modes[0]!==modes[1])reasons.push('TASK_MODE_MISMATCH');
  if([web,reference].some(output=>!HASH.test(output?.task_parameters_hash||'')))reasons.push('TASK_PARAMETERS_UNVERIFIED');
  else if(web.task_parameters_hash!==reference.task_parameters_hash)reasons.push('TASK_PARAMETERS_MISMATCH');
  for (const output of [web,reference]) {
    if (!output) { reasons.push('MISSING_OUTPUT'); continue; }
    if (!/^[a-f0-9]{64}$/.test(output.sha256 || '')) reasons.push('INVALID_OUTPUT_HASH');
    const validDimensions = Number.isInteger(output.width) && Number.isInteger(output.height) && output.width > 0 && output.height > 0 && output.width * output.height <= MAX_PIXELS;
    if (output.source_sha256 !== pair.original.sha256 || output.lineage_status !== 'SOURCE_VERIFIED') reasons.push('SOURCE_UNVERIFIED');
    if (!validDimensions || output.direction !== target || output.target_ratio !== ratio || Math.abs(output.width / output.height - (target === 'landscape' ? 16/9 : 9/16)) > .003) reasons.push('GEOMETRY_MISMATCH');
    if (output.review_scale_policy !== review) reasons.push('SCALE_POLICY_MISMATCH');
    if (output.provider === 'demo' || output.origin === 'demo' || output.resolution_origin === 'simulation') reasons.push('DEMO_ONLY');
    const evidence=output.provenance_evidence;
    if(output.provenance_verified!==true || output.provenance_basis!=='authenticated-gateway-response' || evidence?.source_sha256!==pair.original.sha256 || evidence?.output_sha256!==output.sha256)reasons.push('INDEPENDENT_PROVENANCE_UNVERIFIED');
    if(canonicalMode(output.mode)==='faithful'){
      const proof=output.pixel_proof;
      if(proof?.verified!==true || proof.channel_difference_count!==0 || !['decoded-saved-output-normalized-rgba','server-decoded-saved-output-normalized-rgba'].includes(proof.checked_scope) || proof.source_sha256!==pair.original.sha256 || proof.output_sha256!==output.sha256)reasons.push('PROTECTED_PIXELS_UNVERIFIED');
    }
  }
  if (pair.original.demo_fixture) reasons.push('DEMO_ONLY');
  const mode=modes[0]&&modes[0]===modes[1]?modes[0]:null;
  return { eligible: reasons.length === 0, classification: reasons.length ? 'ILLUSTRATIVE_ONLY' : 'SOURCE_VERIFIED', reasons: [...new Set(reasons)], mode, rubric:comparisonRubric(mode), method_group:mode?`${mode}:${review}:${web?.task_parameters_hash||'unverified'}`:null, rule_version:ELIGIBILITY_RULE };
}
export async function blindOrder(pairId, seed, outputHashes) {
  const digest = await sha256([pairId,seed,...outputHashes].join('|'));
  return parseInt(digest.slice(0,2),16) % 2 ? ['reference','web'] : ['web','reference'];
}
export function csv(rows) {
  if (!rows.length) return 'comparison_id,original_sha256,eligible\r\n';
  const keys = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const quote = v => {
    let text = String(v ?? '');
    if (/^[=+@-]/.test(text)) text = "'" + text; // Spreadsheet formula injection guard.
    return '"' + text.replaceAll('"','""') + '"';
  };
  return [keys.map(quote).join(','),...rows.map(r => keys.map(k=>quote(typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k])).join(','))].join('\r\n');
}

