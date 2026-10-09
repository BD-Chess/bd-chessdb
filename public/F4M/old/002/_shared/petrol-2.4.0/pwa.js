/* Channel-owned offline package. Updates are opt-in and require a verified save. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id), text=k=>window.F4MShell.text(k);
  let registration=null,deferredInstall=null,reloadRequested=false,changedElsewhere=false;
  const state={state:'preparing'};window.F4MPWA=state;
  const showState=key=>{state.state=key;if($('offlineStatus'))$('offlineStatus').textContent=text(key);};
  const showUpdate=(other=false)=>{changedElsewhere=other;$('pwaToast').hidden=false;$('updateText').textContent=text(other?'otherUpdate':'updateReady');$('updateButton').textContent=text('update');};
  function rpc(worker,type){return new Promise((resolve,reject)=>{if(!worker)return reject(Error('No active worker'));const c=new MessageChannel(),timer=setTimeout(()=>{c.port1.close();reject(Error('Offline verification timeout'));},6000);c.port1.onmessage=e=>{clearTimeout(timer);c.port1.close();resolve(e.data);};worker.postMessage({type},[c.port2]);});}
  async function checkReady(){try{const r=await rpc(registration?.active,'VERIFY_PACKAGE');showState(r?.ready?(navigator.onLine?'ready':'offline'):'notReady');}catch(_){showState('notReady');}}
  $('install').onclick=async()=>{
    if(deferredInstall){const event=deferredInstall;deferredInstall=null;await event.prompt();await event.userChoice;}
    else{$('installInfo').hidden=false;$('installInfo').textContent=text('installHelp');}
  };
  addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;});
  $('updateButton').onclick=async()=>{
    $('updateButton').disabled=true;
    try{
      await window.F4MLab.saveForUpdate();
      if(registration?.waiting){reloadRequested=true;registration.waiting.postMessage({type:'ACTIVATE_SAVED'});}
      else if(changedElsewhere){location.reload();}
      else{await registration?.update();$('pwaToast').hidden=true;$('updateButton').disabled=false;}
    }catch(e){$('updateText').textContent=text('updateFail');$('updateButton').disabled=false;console.warn('Flip4M update refused:',e.message);}
  };
  if(!('serviceWorker'in navigator)||!window.isSecureContext){showState('offlineUnavailable');return;}
  navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='PAGE_BUILD')e.ports[0]?.postMessage({build:'2.4.0-petrol'});});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(reloadRequested){location.reload();return;}
    // Another tab must never interrupt this tab's active match.
    if(navigator.serviceWorker.controller)showUpdate(true);
  });
  navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(async reg=>{
    registration=reg;
    if(reg.waiting)showUpdate();
    reg.addEventListener('updatefound',()=>{const worker=reg.installing;if(!worker)return;worker.addEventListener('statechange',()=>{
      if(worker.state==='installed'&&reg.waiting&&navigator.serviceWorker.controller)showUpdate();
      if(worker.state==='activated')checkReady();
    });});
    if(reg.active)await checkReady();
    else if(reg.installing){reg.installing.addEventListener('statechange',()=>{if(reg.active)checkReady();});}
    addEventListener('online',checkReady);addEventListener('offline',checkReady);
  }).catch(error=>{showState('notReady');console.warn('Flip4M offline:',error.message);});
})();
