/* Explicit, non-destructive transition from the legacy installed channel. */
(async()=>{'use strict';const $=id=>document.getElementById(id);let save=null;
 try{save=await F4MStore.read();if(save&&save.format!=='flip4m.lab.session')throw Error('Unknown legacy save format');$('status').textContent=save?'Stara igra je na voljo. / Legacy save is available.':'Ni shranjene igre. Odpri LAB ali APP. / No saved game; open LAB or APP.';$('copy').disabled=$('export').disabled=!save;}
 catch(e){$('status').textContent='Branje ni uspelo; stari podatki niso spremenjeni. / Read failed; legacy data was not changed. '+e.message;}
 $('export').onclick=()=>{if(!save)return;const url=URL.createObjectURL(new Blob([JSON.stringify(save,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='Flip4M-legacy-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 $('copy').onclick=async()=>{if(!save)return;$('copy').disabled=true;
  try{
   if(localStorage.getItem('flip4m-lab-2.1'))throw Error('LAB že vsebuje podatke / LAB already contains data');
   if('BroadcastChannel'in window){const bc=new BroadcastChannel('flip4m-violet-lab-presence');let present=false;bc.onmessage=e=>{if(e.data==='present')present=true;};bc.postMessage('probe');await new Promise(r=>setTimeout(r,450));bc.close();if(present)throw Error('Najprej zapri zavihek LAB / Close the LAB tab first');}
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('flip4m-lab-2.1',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('LAB storage blocked'));});
   await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite'),s=tx.objectStore('state'),r=s.get('checkpoint');let conflict=false;r.onsuccess=()=>{if(r.result){conflict=true;tx.abort();}else s.put(save,'checkpoint');};tx.oncomplete=resolve;tx.onabort=()=>reject(Error(conflict?'LAB že vsebuje igro; uporabi izvoz. / LAB has a save; use export.':'Copy aborted'));tx.onerror=()=>reject(tx.error);});
   const stored=await new Promise((resolve,reject)=>{const r=db.transaction('state').objectStore('state').get('checkpoint');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();if(JSON.stringify(stored)!==JSON.stringify(save))throw Error('Readback mismatch');
   $('status').textContent='Kopija preverjena. Odpri LAB; stari original je ohranjen. / Copy verified. Open LAB; the legacy original is preserved.';
  }catch(e){$('status').textContent=e.message;$('copy').disabled=false;}
 };
 if('serviceWorker'in navigator){try{const r=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});if(r.waiting)$('update').hidden=false;r.addEventListener('updatefound',()=>{r.installing?.addEventListener('statechange',()=>{if(r.waiting)$('update').hidden=false;});});}catch(_){}}
})();
