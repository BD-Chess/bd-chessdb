'use strict';
// APP-only web installation. The native package and downloaded standalone HTML
// do not register a worker. An embedded phone delegates to its preview shell.
(() => {
 if (!/^https?:$/.test(location.protocol) || window.Capacitor?.isNativePlatform?.()) return;
 const $ = id => document.getElementById(id);
 const appWindow = () => $('game')?.contentWindow || window;
 const sl = () => {try {return appWindow().SudokuI18n?.get?.() === 'sl';} catch (_) {return false;}};
 const text = (en,si) => sl() ? si : en;
 const set = (id,value) => {if ($(id)?.textContent !== value) $(id).textContent = value;};
 function openMenuEntry() {
  const menu = $('navModalBody')?.querySelector('.ux-menu');
  if (!menu || $('appPwaMenu')) return;
  const b = document.createElement('button');b.type='button';b.id='appPwaMenu';b.className='btn';b.setAttribute('data-no-i18n','');
  b.textContent=text('App · offline & updates','Aplikacija · brez povezave in posodobitve');
  b.onclick=()=>{try {$('navClose')?.click();$('uxMore')?.focus({preventScroll:true});const host=window.parent!==window?window.parent:window;host.SudokuAppPWA?.open();} catch (_) {}};
  menu.append(b);
 }
 document.addEventListener('click',e=>{if(e.target.closest?.('#uxMore,#plMore'))openMenuEntry();});
 if (window.parent !== window || document.body.dataset.appRedirect === 'true') return;
 let registration, installPrompt, ready=false, failed=false, replaced=false, reloadRequested=false, checking=false, registering=false, lastCheck=0, notice='update', hadController=false, returnFocus;
 const scriptURL = new URL('./sw.js',location.href).href;
 const scope = new URL('./',location.href).href;
 const ownController = () => navigator.serviceWorker?.controller?.scriptURL === scriptURL;
 const installed = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
 const style=document.createElement('style');
 style.textContent=`
 #appPwaPanel[hidden],#appPwaUpdate[hidden],#appPwaInstallHelp[hidden]{display:none!important}
 #appPwaPanel{position:fixed;inset:0;z-index:6000;background:#020711ce;display:flex;align-items:center;justify-content:center;padding:16px;font:16px/1.5 system-ui;color:#edf4ff}
 #appPwaCard{width:min(100%,460px);max-height:calc(100dvh - 32px);overflow:auto;background:#102039;border:1px solid #54718f;border-radius:18px;padding:20px;box-shadow:0 20px 70px #0008}
 #appPwaCard h2{font-size:1.25rem;margin:0 0 12px}#appPwaCard p{margin:12px 0}
 #appPwaPanel button,#appPwaUpdate button{min-height:44px;padding:9px 13px;font:600 15px/1.3 system-ui;white-space:normal;color:#edf4ff;border:1px solid #6787a6;border-radius:9px;background:#1c3c5b;cursor:pointer}
 #appPwaPanel button:focus-visible,#appPwaUpdate button:focus-visible{outline:3px solid #8aeef8;outline-offset:2px}
 #appPwaPanel button:disabled,#appPwaUpdate button:disabled{opacity:.6;cursor:wait}
 #appPwaClose{float:right;margin-left:10px}#appPwaStatus{clear:both;color:#a3e6eb}
 #appPwaUpdate{position:fixed;z-index:5500;top:max(8px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);width:min(94%,510px);padding:12px;box-sizing:border-box;display:flex;gap:10px;align-items:center;background:#102039;color:#edf4ff;border:1px solid #61d7e4;border-radius:12px;box-shadow:0 8px 30px #0009;font:14px/1.4 system-ui}
 #appPwaUpdateMessage{flex:1}#appPwaUpdateButton{flex:0 0 120px}
 `;
 document.head.append(style);
 document.body.insertAdjacentHTML('beforeend','<section id="appPwaPanel" hidden role="dialog" aria-modal="true" aria-labelledby="appPwaTitle" data-no-i18n><div id="appPwaCard"><button type="button" id="appPwaClose">Close</button><h2 id="appPwaTitle">8zSudoku</h2><p id="appPwaStatus" role="status"></p><p id="appPwaInfo"></p><button type="button" id="appPwaInstall">Install 8zSudoku</button><p id="appPwaInstallHelp" hidden></p><p><button type="button" id="appPwaCheck">Check for updates</button></p><p id="appPwaContainerNote"></p></div></section><aside id="appPwaUpdate" hidden data-no-i18n><span id="appPwaUpdateMessage" role="status"></span><button type="button" id="appPwaUpdateButton">Save & update</button></aside>');
 function render() {
  set('appPwaClose',text('Close','Zapri'));set('appPwaTitle',text('8zSudoku · App','8zSudoku · Aplikacija'));
  set('appPwaStatus',ready?text(navigator.onLine?'Ready for offline play':'Offline · ready to play',navigator.onLine?'Pripravljeno za igro brez povezave':'Brez povezave · pripravljeno za igro'):failed?text('Offline setup failed. Reconnect and check again.','Priprava za delo brez povezave ni uspela. Poveži se in preveri znova.'):text('Preparing offline play…','Pripravljam igro brez povezave…'));
  set('appPwaInfo',text('Play, learning help and saved games work offline after setup. Updates need an internet connection.','Po pripravi igra, učna pomoč in shranjene igre delujejo brez povezave. Za posodobitve potrebuješ internet.'));
  set('appPwaInstall',installed()?text('Installed','Nameščeno'):text('Install 8zSudoku','Namesti 8zSudoku'));
  $('appPwaInstall').disabled=installed();
  set('appPwaCheck',checking?text('Checking…','Preverjam…'):text('Check for updates','Preveri posodobitve'));
  $('appPwaCheck').disabled=checking||registering||!navigator.onLine||!navigator.serviceWorker;
  set('appPwaInstallHelp',text('iPhone/iPad: open this page in Safari, choose Share → Add to Home Screen → Add. On other browsers use Install app in the browser menu if available.','iPhone/iPad: odpri stran v Safariju, izberi Deli → Dodaj na začetni zaslon → Dodaj. V drugih brskalnikih uporabi Namesti aplikacijo v meniju brskalnika, če je na voljo.'));
  set('appPwaContainerNote',text('A Home Screen installation may have separate saved games. Use More → Export / Import session to transfer a game. LAB and CURRENT stay separate.','Namestitev na začetnem zaslonu ima lahko ločene shranjene igre. Za prenos uporabi Več → Izvozi / Uvozi sejo. LAB in CURRENT ostaneta ločena.'));
  const copy={
   update:['A new APP version is ready. Save and update when convenient.','Nova različica APP je pripravljena. Shrani igro in posodobi, ko ti ustreza.'],
   saving:['Game saved. Updating…','Igra je shranjena. Posodabljam…'],
   blocked:['The game could not be saved. Finish the current action or export the game, then retry.','Igre ni bilo mogoče shraniti. Končaj trenutno dejanje ali izvozi igro in poskusi znova.'],
   replaced:['An update is active. Save and reload to use it here.','Posodobitev je aktivna. Shrani in osveži, da jo uporabiš tudi tukaj.'],
   retry:['Update check failed. Reconnect and try again.','Preverjanje posodobitve ni uspelo. Poveži se in poskusi znova.']
  };
  set('appPwaUpdateMessage',copy[notice][Number(sl())]);
  set('appPwaUpdateButton',notice==='retry'?text('Retry','Poskusi znova'):replaced?text('Save & reload','Shrani in osveži'):text('Save & update','Shrani in posodobi'));
  if ($('appPwaOpen')) set('appPwaOpen',text('Install app / Offline','Namesti aplikacijo / Brez povezave'));
 }
 function show(kind='update'){notice=kind;$('appPwaUpdate').hidden=false;$('appPwaUpdateButton').disabled=false;render();}
 function open(){returnFocus=document.activeElement;render();$('appPwaPanel').hidden=false;$('appPwaClose').focus();check();}
 function close(){$('appPwaPanel').hidden=true;returnFocus?.focus?.({preventScroll:true});}
 window.SudokuAppPWA={open};
 $('appPwaOpen')?.addEventListener('click',open);
 $('appPwaClose').onclick=close;
 $('appPwaPanel').addEventListener('click',e=>{if(e.target===$('appPwaPanel'))close();});
 window.addEventListener('keydown',e=>{
  if($('appPwaPanel').hidden)return;
  e.stopImmediatePropagation();
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}
  if(e.key==='Tab'){const nodes=[...$('appPwaPanel').querySelectorAll('button:not(:disabled)')],first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
 },true);
 window.addEventListener('click',e=>{if(e.target.closest?.('#appPwaUpdateButton')&&!$('navModal')?.hidden)$('navClose')?.click();},true);
 $('game')?.addEventListener('load',render);
 async function flush(){
  try{const app=appWindow().SudokuNavigator;return typeof app?.flushForUpdate==='function'&&await app.flushForUpdate()===true;}catch(_){return false;}
 }
 async function check(force=false){
  if(!navigator.onLine||checking||registering)return;
  if(!registration){if(navigator.serviceWorker)await register();return;}
  if(!force&&Date.now()-lastCheck<30000)return;
  checking=true;lastCheck=Date.now();render();
  try{await registration.update();if(registration.waiting)show();else if(notice==='retry')$('appPwaUpdate').hidden=true;}
  catch(_){if(force)show('retry');}
  finally{checking=false;render();}
 }
 function watch(worker){
  if(!worker)return;
  worker.addEventListener('statechange',()=>{
   if(worker.state==='installed'&&registration?.active)show();
   if(worker.state==='activated'){ready=true;failed=false;render();}
   if(worker.state==='redundant'&&!ready&&!registration?.active){failed=true;render();}
  });
 }
 $('appPwaUpdateButton').onclick=async()=>{
  if(notice==='retry'){await check(true);return;}
  $('appPwaUpdateButton').disabled=true;
  if(!await flush()){show('blocked');return;}
  if(replaced||!registration?.waiting){location.reload();return;}
  reloadRequested=true;notice='saving';render();
  registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
 };
 $('appPwaCheck').onclick=()=>check(true);
 $('appPwaInstall').onclick=async()=>{
  if(installPrompt){const prompt=installPrompt;installPrompt=null;try{await prompt.prompt();await prompt.userChoice;}catch(_){$('appPwaInstallHelp').hidden=false;}}
  else $('appPwaInstallHelp').hidden=false;
 };
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
 window.addEventListener('appinstalled',()=>{installPrompt=null;$('appPwaInstallHelp').hidden=true;render();});
 const sw=navigator.serviceWorker;
 if(!sw){failed=true;render();return;}
 hadController=ownController();
 sw.addEventListener('controllerchange',async()=>{
  if(!ownController())return;
  ready=true;failed=false;render();
  if(reloadRequested){
   reloadRequested=false;
   if(await flush()){location.reload();return;}
   replaced=true;show('blocked');
  }else if(hadController){replaced=true;show('replaced');}
  hadController=true;
 });
 async function register(){
  registering=true;render();
  try{
   const reg=await sw.register('./sw.js',{scope:'./',updateViaCache:'none'});
   if(reg.scope!==scope)throw Error('Unexpected APP scope');
   registration=reg;ready=reg.active?.state==='activated';failed=false;watch(reg.installing);watch(reg.active);
   reg.addEventListener('updatefound',()=>watch(reg.installing));if(reg.waiting)show();
  }catch(_){failed=true;}
  finally{registering=false;render();}
  if(registration)check();
 }
 register();
 window.addEventListener('online',()=>{render();check();});window.addEventListener('offline',render);
 window.addEventListener('focus',()=>check());
 window.addEventListener('storage',e=>{if(e.key==='8zSudoku.app.ui.language')render();});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check();});
 new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 render();
})();
