import { geometry, sha256, RATIOS } from './core.mjs';
export const toBlob = canvas => new Promise((resolve,reject)=>canvas.toBlob(b=>b ? resolve(b) : reject(Error('ENCODE_FAILED')),'image/png'));
export async function normalizedImage(file) {
  let bitmap;
  try { bitmap = await createImageBitmap(file,{ imageOrientation:'from-image', colorSpaceConversion:'default' }); }
  catch { throw Error('UNSUPPORTED_OR_CORRUPT'); }
  const canvas = document.createElement('canvas'); canvas.width=bitmap.width; canvas.height=bitmap.height;
  canvas.getContext('2d').drawImage(bitmap,0,0); bitmap.close();
  return { blob: await toBlob(canvas), width:canvas.width, height:canvas.height };
}
export async function demoFixture(target = 'landscape') {
  const canvas=document.createElement('canvas'), [w,h]=target==='landscape'?[960,540]:[540,960];
  canvas.width=w; canvas.height=h;
  const c=canvas.getContext('2d'), g=c.createLinearGradient(0,0,w,h);
  g.addColorStop(0,'#326369');g.addColorStop(1,'#14282d');c.fillStyle=g;c.fillRect(0,0,w,h);
  c.strokeStyle='#97d7d4';c.lineWidth=2;
  for(let x=30;x<w;x+=60){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}
  for(let y=30;y<h;y+=60){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
  c.fillStyle='#e8c889';c.fillRect(w*.32,h*.35,w*.36,h*.3);c.fillStyle='#153035';
  c.font=`${Math.round(w*.05)}px sans-serif`;c.textAlign='center';c.fillText('SOURCE',w/2,h/2);
  return new File([await toBlob(canvas)],`Synthetic-${target}.png`,{type:'image/png'});
}
export async function mockExpand(pair,job,signal) {
  await new Promise((resolve,reject)=> {
    const timer=setTimeout(resolve,600);
    signal.addEventListener('abort',()=>{clearTimeout(timer);reject(Error('CANCELLED'));},{once:true});
  });
  if(signal.aborted)throw Error('CANCELLED');
  const p=geometry(pair.original.width,pair.original.height,job.target,job.position);
  const canvas=document.createElement('canvas');canvas.width=p.width;canvas.height=p.height;
  const c=canvas.getContext('2d'), g=c.createLinearGradient(0,0,p.width,p.height);
  g.addColorStop(0,'#17333a');g.addColorStop(1,job.mode==='cinematic'?'#52563b':'#243945');c.fillStyle=g;c.fillRect(0,0,p.width,p.height);
  const key=await sha256(`${job.input_sha256}|${job.seed}|${job.prompt}|${job.mode}|${job.position}`);
  c.strokeStyle=`#${key.slice(0,6)}`;c.lineWidth=5;c.globalAlpha=.35;
  for(let i=-p.height;i<p.width;i+=48){c.beginPath();c.moveTo(i,0);c.lineTo(i+p.height,p.height);c.stroke();}
  c.globalAlpha=1;
  const source=await createImageBitmap(pair.original.normalized);
  const sourceCanvas=document.createElement('canvas');sourceCanvas.width=source.width;sourceCanvas.height=source.height;
  const sourceContext=sourceCanvas.getContext('2d');sourceContext.drawImage(source,0,0);source.close();
  // Copy RGBA pixels; source-over drawing would replace translucent pixels with the demo background.
  c.putImageData(sourceContext.getImageData(0,0,sourceCanvas.width,sourceCanvas.height),p.x,p.y);
  const blob=await toBlob(canvas), hash=await sha256(blob);
  return { blob,sha256:hash,width:p.width,height:p.height,path:`variants/${job.target}/${hash}.png`,origin:'demo',provider:'demo',model_or_version:'deterministic-canvas-v1',source_sha256:pair.original.sha256,direction:job.target,target_ratio:RATIOS[job.target],review_scale_policy:'equal-canvas-v1',lineage_status:'SOURCE_VERIFIED',source_placement:p,source_pixel_protection:'normalized-sRGB-RGBA-overwrite',provider_cost:0,cost_currency:'EUR',resolution_origin:'simulation',resolution_verified:false };
}
export async function baseline(pair,target,mode='contain') {
  const p=geometry(pair.original.width,pair.original.height,target), canvas=document.createElement('canvas');canvas.width=p.width;canvas.height=p.height;
  const c=canvas.getContext('2d');c.fillStyle='#122026';c.fillRect(0,0,p.width,p.height);
  const b=await createImageBitmap(pair.original.normalized);
  const scale=mode==='crop'?Math.max(p.width/b.width,p.height/b.height):Math.min(p.width/b.width,p.height/b.height);
  const w=b.width*scale,h=b.height*scale;c.drawImage(b,(p.width-w)/2,(p.height-h)/2,w,h);b.close();
  return toBlob(canvas);
}
