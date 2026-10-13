const preview=document.getElementById('preview'),output=document.getElementById('dimensions');
function resize(width,height){preview.width=String(width);preview.height=String(height);output.value=`${width} × ${height}`;}
document.getElementById('narrow').addEventListener('click',()=>resize(390,844));
document.getElementById('rotate').addEventListener('click',()=>resize(Number(preview.height),Number(preview.width)));
document.getElementById('wide').addEventListener('click',()=>resize(1280,800));
