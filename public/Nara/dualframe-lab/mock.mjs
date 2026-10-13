import { taskGeometry, canonicalMode, sha256, RATIOS, verifyProtectedPixels } from './core.mjs?v=2.0-r4.1';
export const toBlob = canvas => new Promise((resolve,reject)=>canvas.toBlob(b=>b ? resolve(b) : reject(Error('ENCODE_FAILED')),'image/png'));
function context(canvas){const c=canvas.getContext('2d',{willReadFrequently:true});if(!c)throw Error('CANVAS_UNAVAILABLE');return c;}
export async function decodedRGBA(blob){
  let bitmap;
  try{bitmap=await createImageBitmap(blob,{imageOrientation:'from-image',colorSpaceConversion:'default',premultiplyAlpha:'default'});}catch{throw Error('UNSUPPORTED_OR_CORRUPT');}
  const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
  const c=context(canvas);c.drawImage(bitmap,0,0);bitmap.close();
  return {canvas,width:canvas.width,height:canvas.height,data:c.getImageData(0,0,canvas.width,canvas.height).data};
}
export async function normalizedImage(file) {
  const decoded=await decodedRGBA(file);
  return { blob: await toBlob(decoded.canvas), width:decoded.width, height:decoded.height, normalization:'browser-decoded-sRGB-RGBA8' };
}
export async function verifySavedProtectedPixels(sourceBlob,outputBlob,placement,sourceHash=null){
  const [source,output]=await Promise.all([decodedRGBA(sourceBlob),decodedRGBA(outputBlob)]);
  const proof=verifyProtectedPixels({sourceData:source.data,sourceWidth:source.width,sourceHeight:source.height,outputData:output.data,outputWidth:output.width,outputHeight:output.height,placement});
  return {...proof,checked_scope:'decoded-saved-output-normalized-rgba',source_sha256:sourceHash||await sha256(sourceBlob),normalized_source_sha256:await sha256(sourceBlob),output_sha256:await sha256(outputBlob),verified_at:new Date().toISOString()};
}
export async function demoFixture(target = 'landscape') {
  // This is deliberately a vector-painted, non-AI synthetic fixture.
  const canvas=document.createElement('canvas'),[w,h]=target==='landscape'?[960,540]:[540,960];canvas.width=w;canvas.height=h;
  const c=context(canvas),sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#193e55');sky.addColorStop(.55,'#c4a67d');sky.addColorStop(1,'#294e59');c.fillStyle=sky;c.fillRect(0,0,w,h);
  const glow=c.createRadialGradient(w*.72,h*.31,4,w*.72,h*.31,w*.4);glow.addColorStop(0,'#ffe2b3');glow.addColorStop(.3,'#eacb9270');glow.addColorStop(1,'#eacb9200');c.fillStyle=glow;c.fillRect(0,0,w,h);
  c.fillStyle='#f4d29d';c.beginPath();c.arc(w*.72,h*.31,w*.045,0,Math.PI*2);c.fill();
  for(const [baseline,amplitude,color,phase] of [[.50,.12,'#617681',1],[.62,.18,'#355866',2],[.73,.12,'#183e4a',3]]){c.fillStyle=color;c.beginPath();c.moveTo(0,h);for(let i=0;i<=20;i++){const x=w*i/20,y=h*(baseline-amplitude*(.4+.6*Math.sin(i*.65+phase)));c.lineTo(x,y);}c.lineTo(w,h);c.closePath();c.fill();}
  const water=c.createLinearGradient(0,h*.69,0,h);water.addColorStop(0,'#78938d');water.addColorStop(1,'#143842');c.fillStyle=water;c.fillRect(0,h*.72,w,h*.28);
  c.strokeStyle='#d7c6a3';c.globalAlpha=.28;c.lineWidth=1;for(let i=0;i<28;i++){const y=h*(.73+i*.009),length=w*(.1+i*.008);c.beginPath();c.moveTo(w*.68-length/2,y);c.lineTo(w*.68+length/2,y);c.stroke();}c.globalAlpha=1;
  c.fillStyle='#153a42';c.beginPath();c.moveTo(0,h*.82);c.quadraticCurveTo(w*.2,h*.77,w*.46,h);c.lineTo(0,h);c.fill();
  c.fillStyle='#e5c48c';c.fillRect(w*.13,h*.58,w*.12,h*.13);c.beginPath();c.arc(w*.19,h*.58,w*.06,Math.PI,0);c.fill();c.fillStyle='#284853';c.fillRect(w*.18,h*.63,w*.022,h*.08);
  c.strokeStyle='#122f38';c.lineWidth=3;for(let i=0;i<15;i++){const x=w*(.02+i*.013);c.beginPath();c.moveTo(x,h);c.quadraticCurveTo(x+w*.02,h*.87,x-w*.012,h*(.83+Math.sin(i)*.03));c.stroke();}
  return new File([await toBlob(canvas)],`Synthetic-${target}.png`,{type:'image/png'});
}
function palette(source){
  // Edge colors anchor the local backdrop without pretending to infer scenery.
  const colors=[];
  for(let side=0;side<4;side++){
    let r=0,g=0,b=0,weight=0;
    for(let i=0;i<64;i++){
      const x=side===0?0:side===1?source.width-1:Math.min(source.width-1,Math.floor(source.width*i/64));
      const y=side===2?0:side===3?source.height-1:Math.min(source.height-1,Math.floor(source.height*i/64));
      const n=(y*source.width+x)*4,a=source.data[n+3]/255;r+=source.data[n]*a;g+=source.data[n+1]*a;b+=source.data[n+2]*a;weight+=a;
    }
    colors.push(weight?[r/weight,g/weight,b/weight]:[28,50,60]);
  }
  return colors;
}
function fillBackdrop(c,p,colors,seed){
  const color=(arr,f=1,a=1)=>`rgba(${arr.map(v=>Math.round(v*f)).join(',')},${a})`;
  const g=c.createLinearGradient(0,0,p.width,p.height);g.addColorStop(0,color(colors[2],.7));g.addColorStop(.5,color(colors[0],.85));g.addColorStop(1,color(colors[3],.6));c.fillStyle=g;c.fillRect(0,0,p.width,p.height);
  for(let i=0;i<4;i++){const n=parseInt(seed.slice(i*6,i*6+6),16);const x=(n%997)/997*p.width,y=((n>>>5)%991)/991*p.height,r=Math.max(p.width,p.height)*.62;const glow=c.createRadialGradient(x,y,0,x,y,r);glow.addColorStop(0,color(colors[i],1,.25));glow.addColorStop(1,color(colors[i],1,0));c.fillStyle=glow;c.fillRect(0,0,p.width,p.height);}
}
export async function mockExpand(pair,job,signal=new AbortController().signal) {
  if(signal.aborted)throw Error('CANCELLED');
  const mode=canonicalMode(job.mode);if(!mode)throw Error('INVALID_TASK');if(job.quality==='4k')throw Error('DEMO_4K_UNAVAILABLE');
  await new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(Error('CANCELLED'));},timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},200);signal.addEventListener('abort',abort,{once:true});});
  if(signal.aborted)throw Error('CANCELLED');
  const p=taskGeometry(pair.original.width,pair.original.height,job.target,job.position,mode,'hd');
  const canvas=document.createElement('canvas');canvas.width=p.width;canvas.height=p.height;const c=context(canvas);
  const source=await decodedRGBA(pair.original.normalized),key=await sha256(`${job.input_sha256}|${job.seed}|${job.prompt}|${mode}|${job.position}`);fillBackdrop(c,p,palette(source),key);
  if(mode==='faithful')c.putImageData(new ImageData(new Uint8ClampedArray(source.data),source.width,source.height),p.x,p.y);
  else if(mode==='smart'){
    c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(source.canvas,p.x,p.y,p.source_width,p.source_height);
  }else{
    const margin=Math.round(Math.min(p.width,p.height)*.07),landscape=p.width>p.height,box={x:margin,y:margin,width:landscape?p.width*.57:p.width-margin*2,height:landscape?p.height-margin*2:p.height*.54};
    const scale=Math.min(box.width/source.width,box.height/source.height),w=Math.round(source.width*scale),h=Math.round(source.height*scale),x=Math.round(box.x+(box.width-w)/2),y=Math.round(box.y+(box.height-h)/2);
    c.drawImage(source.canvas,x,y,w,h);Object.assign(p,{x,y,source_width:w,source_height:h,scale,source_is_resampled:scale!==1});
    const tx=landscape?p.width*.68:margin,ty=landscape?p.height*.32:p.height*.68,available=landscape?p.width*.25:p.width-margin*2;
    // Reserve a calm text card; the caller renders the user's exact EN/SL text.
    c.fillStyle='rgba(12,30,36,.28)';c.fillRect(tx-margin*.2,ty-margin*.4,available+margin*.4,margin*2.75);
  }
  const blob=await toBlob(canvas),hash=await sha256(blob);let proof=null;
  if(mode==='faithful'){proof=await verifySavedProtectedPixels(pair.original.normalized,blob,p,pair.original.sha256);if(!proof.verified)throw Error('PROTECTED_PIXELS_CHANGED');}
  if(signal.aborted)throw Error('CANCELLED');
  return {blob,sha256:hash,width:p.width,height:p.height,path:`variants/${job.target}/${hash}.png`,origin:'demo',provider:'demo',model_key:'demo',model_or_version:'deterministic-canvas-v2',provider_model_id:'deterministic-canvas-v2',source_sha256:pair.original.sha256,direction:job.target,target_ratio:RATIOS[job.target],review_scale_policy:'equal-canvas-v1',lineage_status:'SOURCE_VERIFIED',mode,task_parameters_hash:job.task_parameters_hash||null,source_placement:p,source_pixel_protection:mode==='faithful'?'normalized-sRGB-RGBA-overwrite':'none',pixel_proof:proof,modification_disclosure:mode==='faithful'?'Procedural backdrop; normalized source pixels preserved. No AI generation.':mode==='smart'?'Local resized composition over procedural backdrop. No AI generation.':'Local spatial image layout with room for caller-rendered text. No AI generation.',provider_cost:0,cost_currency:'EUR',cost_basis:'local-no-provider-call',resolution_origin:'simulation',resolution_verified:false,export_resolution_verified:true,export_width:p.width,export_height:p.height};
}
export async function baseline(pair,target,mode='contain') {
  const p=taskGeometry(pair.original.width,pair.original.height,target,'center','smart','hd'),canvas=document.createElement('canvas');canvas.width=p.width;canvas.height=p.height;
  const c=context(canvas);c.fillStyle='#122026';c.fillRect(0,0,p.width,p.height);const b=await createImageBitmap(pair.original.normalized);
  const scale=mode==='crop'?Math.max(p.width/b.width,p.height/b.height):Math.min(p.width/b.width,p.height/b.height),w=b.width*scale,h=b.height*scale;c.drawImage(b,(p.width-w)/2,(p.height-h)/2,w,h);b.close();return toBlob(canvas);
}
