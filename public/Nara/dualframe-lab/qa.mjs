import { mockExpand, toBlob, decodedRGBA, normalizedImage } from './mock.mjs?v=3.0-r1';
import { sha256, canonicalMode, comparisonRubric, verifyProtectedPixels, verifiedFourK, taskGeometry } from './core.mjs?v=3.0-r1';
import { MODELS, supportsMode } from './models.mjs?v=3.0-r1';
const preview=document.getElementById('preview'),output=document.getElementById('dimensions');
function resize(width,height){preview.width=String(width);preview.height=String(height);output.value=`${width} × ${height}`;}
document.getElementById('narrow').addEventListener('click',()=>resize(390,844));
document.getElementById('rotate').addEventListener('click',()=>resize(Number(preview.height),Number(preview.width)));
document.getElementById('wide').addEventListener('click',()=>resize(1280,800));
const check=(pass,message)=>{if(!pass)throw Error(message);};
// A real indexed/color-palette PNG, not just its header or a pre-encoding canvas.
const PALETTE_PNG='iVBORw0KGgoAAAANSUhEUgAAAAgAAAAECAMAAACEE47CAAAAGFBMVEUTq1TnQ4EmYNPZwR8FDR3z7+N/PcdT2b287omsAAAAFElEQVR4nGNgYGRiZmFlY2fAzQAAB1wAcUwNTD0AAAAASUVORK5CYII=';
const PALETTE=[[19,171,84],[231,67,129],[38,96,211],[217,193,31],[5,13,29],[243,239,227],[127,61,199],[83,217,189]];
async function paletteCheck(){
  const bytes=Uint8Array.from(atob(PALETTE_PNG),c=>c.charCodeAt(0)),source=new Blob([bytes],{type:'image/png'}),normalized=await normalizedImage(source),decoded=await decodedRGBA(normalized.blob);
  check(decoded.width===8&&decoded.height===4,'palette dimensions');
  for(let i=0;i<32;i++)for(let c=0;c<4;c++)check(decoded.data[i*4+c]===(c===3?255:PALETTE[i%8][c]),'decoded palette RGB changed');
  const hash=await sha256(source),pair={original:{width:8,height:4,normalized:normalized.blob,sha256:hash}},out=await mockExpand(pair,{target:'portrait',position:'center',mode:'faithful',seed:42,prompt:'',input_sha256:hash},new AbortController().signal);
  check(out.pixel_proof.verified&&out.pixel_proof.channel_difference_count===0,'palette saved PNG proof');
  const final=await decodedRGBA(out.blob),p=out.source_placement;
  for(let y=0;y<4;y++)for(let x=0;x<8;x++)for(let c=0;c<4;c++)check(final.data[((y+p.y)*final.width+x+p.x)*4+c]===(c===3?255:PALETTE[x][c]),'saved output palette pixel changed');
  return 'PASS · indexed PNG fully decoded; all 128 saved-output RGBA values match exact palette RGB';
}
async function alphaCheck(){
  const source=document.createElement('canvas');source.width=8;source.height=4;const ctx=source.getContext('2d'),raw=ctx.createImageData(8,4),alphas=[0,1,2,17,64,127,192,255];
  for(let i=0;i<32;i++)raw.data.set([120,80,40,alphas[i%8]],i*4);ctx.putImageData(raw,0,0);
  const blob=await toBlob(source),decoded=await decodedRGBA(blob),hash=await sha256(blob),pair={original:{width:8,height:4,normalized:blob,sha256:hash}};
  const out=await mockExpand(pair,{target:'portrait',position:'center',mode:'faithful',seed:42,prompt:'',input_sha256:hash},new AbortController().signal),final=await decodedRGBA(out.blob);
  const proof=verifyProtectedPixels({sourceData:decoded.data,sourceWidth:8,sourceHeight:4,outputData:final.data,outputWidth:final.width,outputHeight:final.height,placement:out.source_placement});
  check(proof.verified&&out.pixel_proof.verified,'alpha differs after saved output decode');check(decoded.data.some((v,i)=>i%4===3&&v===0),'transparent sample missing');check(decoded.data.some((v,i)=>i%4===3&&v===127),'translucent sample missing');
  return 'PASS · saved source/output PNG RGBA match for all alpha levels, including fully transparent pixels';
}
async function modeCheck(){
  check(canonicalMode('cinematic')==='smart','legacy mode mapping');check(MODELS.length===5,'model count');check(comparisonRubric('infographic').includes('textAccuracy'),'task rubric');check(!supportsMode('fal-bria','infographic'),'invalid Bria text capability');
  const n=await normalizedImage(await (await import('./mock.mjs')).demoFixture('landscape')),hash=await sha256(n.blob),pair={original:{...n,normalized:n.blob,sha256:hash}};
  for(const mode of ['smart','infographic']){const out=await mockExpand(pair,{target:'portrait',position:'center',mode,seed:42,prompt:'',input_sha256:hash});check(out.width===1080&&out.height===1920,'HD task dimensions');check(out.origin==='demo'&&!out.resolution_verified&&!out.pixel_proof,'demo must not claim AI/native/protected source');}
  check(!verifiedFourK({width:2160,height:3840,resolution_verified:true,resolution_origin:'simulation'}),'simulation promoted to native4k');check(taskGeometry(960,540,'portrait','center','smart','4k').height===3840,'actual target4k geometry');
  let held=false;try{await mockExpand(pair,{target:'portrait',position:'center',mode:'smart',quality:'4k',seed:42,prompt:'',input_sha256:hash});}catch(e){held=e.message==='DEMO_4K_UNAVAILABLE';}check(held,'mock allowed false4k');
  return 'PASS · 3 task rubrics, 5 model identities, Smart/Text actual HD; local 4K stays unavailable';
}
export async function runCanvasQA(){
  const result=document.getElementById('canvas-result'),list=document.getElementById('qa-results');result.value='Running saved-PNG and task checks…';result.dataset.status='running';list.replaceChildren();const receipts=[];
  for(const [name,run] of [['Palette PNG',paletteCheck],['Transparency',alphaCheck],['Modes and resolution',modeCheck]]){const row=document.createElement('li');try{const detail=await run();row.textContent=`${name}: ${detail}`;receipts.push({name,status:'PASS',detail});}catch(e){row.textContent=`${name}: FAIL · ${e.message}`;receipts.push({name,status:'FAIL',detail:e.message});}list.append(row);}
  const passed=receipts.every(x=>x.status==='PASS');result.value=`${passed?'PASS':'FAIL'} · ${receipts.filter(x=>x.status==='PASS').length}/${receipts.length} browser checks`;result.dataset.status=passed?'pass':'fail';window.dualframeQA={passed,receipts,completed_at:new Date().toISOString()};return window.dualframeQA;
}
document.getElementById('canvas-check').addEventListener('click',runCanvasQA);
