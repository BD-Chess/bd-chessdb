/* BBSH owner-access bootstrap. Keeps the encrypted payload public and the owner secret out of source. */
(()=>{'use strict';
const VERSION='20260916-bbsh2';
const status=()=>document.getElementById('bbsh-loader-status');
function fail(message,error){const el=status();if(el)el.textContent=message;console.error('BBSH owner-access bootstrap:',error||message)}
async function boot(){
 try{
  const response=await fetch('./BBSH.pack.html?v='+VERSION,{cache:'no-store',credentials:'same-origin'});
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
  await new Promise((resolve,reject)=>{
   const runtime=document.createElement('script');
   runtime.src='../js/bd-owner-access-v1.js?v='+VERSION;runtime.async=false;
   runtime.onload=resolve;runtime.onerror=()=>reject(new Error('owner runtime failed to load'));
   document.body.appendChild(runtime);
  });
  if(document.getElementById('bd-owner-password')){const el=status();if(el)el.remove();return}
  throw new Error('owner runtime loaded but did not initialize');
 }catch(error){
  fail('Lastniškega dostopa ni bilo mogoče naložiti. Osveži stran s Ctrl+F5 in poskusi znova.',error);
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
