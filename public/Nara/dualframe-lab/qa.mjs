const preview=document.getElementById('preview'),output=document.getElementById('dimensions');
function resize(width,height){preview.width=String(width);preview.height=String(height);output.value=`${width} × ${height}`;}
document.getElementById('narrow').addEventListener('click',()=>resize(390,844));
document.getElementById('rotate').addEventListener('click',()=>resize(Number(preview.height),Number(preview.width)));
document.getElementById('wide').addEventListener('click',()=>resize(1280,800));
import { mockExpand, toBlob } from './mock.mjs';
import { sha256 } from './core.mjs';
document.getElementById('canvas-check').addEventListener('click',async()=>{
  const result=document.getElementById('canvas-result');result.value='Running synthetic RGBA check…';
  try {
    const source=document.createElement('canvas');source.width=8;source.height=4;
    const ctx=source.getContext('2d');ctx.fillStyle='rgba(120,80,40,0.5)';ctx.fillRect(0,0,4,4);
    ctx.fillStyle='#e8c889';ctx.fillRect(4,0,2,4); // Last two columns stay fully transparent.
    const blob=await toBlob(source),decoded=await createImageBitmap(blob);
    ctx.clearRect(0,0,8,4);ctx.drawImage(decoded,0,0);decoded.close();
    const expected=ctx.getImageData(0,0,8,4).data;
    const pair={original:{width:8,height:4,normalized:blob,sha256:await sha256(blob)}};
    const out=await mockExpand(pair,{target:'portrait',position:'center',mode:'faithful',seed:42,prompt:'',input_sha256:pair.original.sha256},new AbortController().signal);
    const image=await createImageBitmap(out.blob),canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const c=canvas.getContext('2d');c.drawImage(image,0,0);image.close();
    const p=out.source_placement,actual=c.getImageData(p.x,p.y,8,4).data;
    if(!actual.every((v,i)=>v===expected[i]))throw Error('RGBA pixels changed');
    result.value='PASS · all 128 normalized RGBA values preserved, including translucent and transparent pixels';
  }catch(error){result.value='FAIL · '+error.message;}
});
