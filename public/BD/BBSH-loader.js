/* BBSH owner-access bootstrap. Keeps the encrypted payload public and the owner secret out of source. */
(()=>{'use strict';
const VERSION='20260916-bbsh3';
const status=()=>document.getElementById('bbsh-loader-status');
function fail(message,error){const el=status();if(el)el.textContent=message;console.error('BBSH owner-access bootstrap:',error||message)}

async function installPublicStyles(){
  const response=await fetch('./private-trading/BBSH.html?v='+VERSION,{cache:'no-store',credentials:'same-origin'});
  if(!response.ok)throw new Error('style source HTTP '+response.status);
  const text=await response.text();
  const doc=new DOMParser().parseFromString(text,'text/html');
  const styles=[...doc.querySelectorAll('style')];
  if(styles.length<2)throw new Error('style source incomplete');
  for(const source of styles){
    const style=document.createElement('style');
    for(const attr of source.attributes)style.setAttribute(attr.name,attr.value);
    style.textContent=source.textContent;
    document.head.appendChild(style);
  }
}

async function loadOwnerRuntime(){
  const response=await fetch('../js/bd-owner-access-v1.js?v='+VERSION,{cache:'no-store',credentials:'same-origin'});
  if(!response.ok)throw new Error('owner runtime HTTP '+response.status);
  let source=await response.text();
  const before=`if(u.kind==='document'){
   const onload=()=>{showAssets();addLock();window.addEventListener('pageshow',e=>{if(e.persisted&&!saved())location.reload()});};
   document.open();document.write(text);document.close();
   if(document.readyState==='complete')onload();else window.addEventListener('load',onload,{once:true});
   return;
  }`;
  const after=`if(u.kind==='document'){
   const onload=()=>{showAssets();addLock();window.addEventListener('pageshow',e=>{if(e.persisted&&!saved())location.reload()});};
   const full=/^\\s*<!doctype\\s+html/i.test(text)||/<html(?:\\s|>)/i.test(text)||/<head(?:\\s|>)/i.test(text);
   if(full){
    document.open();document.write(text);document.close();
    if(document.readyState==='complete')onload();else window.addEventListener('load',onload,{once:true});
   }else{
    document.body.innerHTML=text;document.body.id='top';
    await scripts(document.body);onload();
   }
   return;
  }`;
  if(!source.includes(before))throw new Error('owner runtime compatibility guard failed');
  source=source.replace(before,after);
  const runtime=document.createElement('script');
  runtime.textContent=source;
  document.body.appendChild(runtime);
}

async function boot(){
 try{
  const [response]=await Promise.all([
   fetch('./BBSH.pack.html?v='+VERSION,{cache:'no-store',credentials:'same-origin'}),
   installPublicStyles()
  ]);
  if(!response.ok)throw new Error('payload HTTP '+response.status);
  const text=await response.text();
  const doc=new DOMParser().parseFromString(text,'text/html');
  const source=doc.getElementById('bd-access-data');
  if(!source)throw new Error('encrypted payload missing');
  const pack=JSON.parse(source.textContent);
  if(pack.schema!=='BD_ACCESS_V1'||pack.path!=='BD/BBSH.html'||!Array.isArray(pack.units)||!pack.units.length)throw new Error('encrypted payload identity mismatch');
  const data=document.createElement('script');
  data.id='bd-access-data';data.type='application/json';data.textContent=source.textContent;
  document.body.appendChild(data);
  await loadOwnerRuntime();
  if(document.getElementById('bd-owner-password')){const el=status();if(el)el.textContent='Zaščitena stran je pripravljena. Vnesi lastniško geslo spodaj.';return}
  throw new Error('owner runtime loaded but did not initialize');
 }catch(error){
  fail('Lastniškega dostopa ni bilo mogoče naložiti. Osveži stran s Ctrl+F5 in poskusi znova.',error);
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
