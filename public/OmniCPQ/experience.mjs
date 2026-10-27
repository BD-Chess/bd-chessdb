import {createTour,SCENES} from './tour.mjs';
import {CONTEXT_FIELDS} from './work-modes.mjs';

export function createExperience({document:doc,window:win,authorized,setMode,setDraft,notice}){
  if(!doc.querySelector?.('#experience-root'))return {setAccess(){},pause(){},handleCommand(){return false;},clear(){}};
  const $=id=>doc.getElementById(id),origin=win.location.origin;
  let popup=null,pending=null,sequence=0,sound=false,localVoice=null,previousFocus=null;
  const cancelSpeech=()=>win.speechSynthesis?.cancel();
  function voiceStatus(){
    localVoice=win.speechSynthesis?.getVoices().find(v=>/^sl(?:-|$)/i.test(v.lang)&&v.localService===true)||null;
    $('tour-sound').disabled=!localVoice;
    $('tour-voice-status').textContent=localVoice?`Izbirni lokalni glas: ${localVoice.name} (${localVoice.lang}). Kakovost izgovarjave še preveri na tej napravi.`:'Slovenski lokalni glas ni potrjen. Besedilo in podnapisi delujejo brez zvoka.';
  }
  function say(text){cancelSpeech();if(sound&&localVoice&&win.SpeechSynthesisUtterance){const u=new win.SpeechSynthesisUtterance(text);u.voice=localVoice;u.lang=localVoice.lang;win.speechSynthesis.speak(u);}}
  function settle(value){if(!pending)return;const p=pending;pending=null;win.clearTimeout(p.timer);p.resolve(value);}
  function deliver(scene){
    settle(null);
    if(!popup||popup.closed)return Promise.resolve(null);
    const requestId=++sequence;
    return new Promise(resolve=>{
      pending={requestId,scene:scene.id,resolve,timer:win.setTimeout(()=>settle(null),15000)};
      popup.postMessage({type:'ts-b2b:scene',requestId,scene},origin);
    });
  }
  const tour=createTour({show:scene=>{if(!authorized()||doc.visibilityState==='hidden')return Promise.resolve(null);setMode(scene.mode);return deliver(scene);},
    silence:cancelSpeech,caption:scene=>{$('tour-caption').textContent=scene.text;say(scene.text);},
    changed:s=>{$('tour-status').textContent=`${s.index+1}/${s.total} · ${s.status==='playing'?'Prizor je viden':s.status==='opening'?'Odpiram in preverjam prizor':s.status==='stopped'?'Ustavljeno':s.status==='idle'?'Pripravljeno':'Pavza · za nadaljevanje preveri okno'}`;
      $('tour-controls').hidden=s.status==='idle';}});
  function pausePresentation(){settle(null);tour.pause();popup?.postMessage({type:'ts-b2b:pause'},origin);}
  function openWindow(){
    if(!authorized()){notice('Najprej se prijavi v pomočnika.');return false;}
    if(popup&&!popup.closed){popup.focus();return true;}
    const width=Math.round((win.screen?.availWidth||1200)*.88),height=Math.round((win.screen?.availHeight||800)*.88);
    popup=win.open(new URL('./presentation.html',win.location.href).href,'TS_B2B_PRESENTATION',`popup=yes,width=${width},height=${height}`);
    $('presentation-fallback').hidden=Boolean(popup);
    if(!popup){notice('Brskalnik je blokiral predstavitveno okno. Uporabi povezavo »Odpri predstavitev v ločenem zavihku«; pomočnik in CPQ ostaneta odprta.');return false;}
    return true;
  }
  async function waitReady(){
    if(!popup||popup.closed)return false;
    // A reused window sends ready on each explicit ping; first load sends it itself.
    const requestId=++sequence;settle(null);
    return new Promise(resolve=>{
      pending={requestId,scene:'ready',resolve,timer:win.setTimeout(()=>settle(null),10000)};
      popup.postMessage({type:'ts-b2b:ping',requestId},origin);
    });
  }
  async function start(){if(!openWindow())return false;if(!await waitReady()){notice('Predstavitveno okno še ni potrdilo prikaza. Ponovi po nalaganju okna.');return false;}return tour.start();}
  async function openService(){
    if(!openWindow())return;
    if(!await waitReady())return;
    tour.pause();
    const service=$('presentation-service').value;
    const ack=await deliver({id:'service',title:'Vodič za B2B storitve v TS',service,kind:'POSNETEK',text:'Preverjena dokumentacija in ilustracija; datum vira ni potrditev današnjega kataloga.'});
    if(!ack?.visible)notice('Kartica storitve ni potrjeno vidna. Preveri dostop do zasebne dokumentacije v oknu.');
  }
  const actions={next:()=>tour.next(),back:()=>tour.back(),pause:pausePresentation,resume:()=>tour.resume(),repeat:()=>tour.repeat(),stop:()=>{settle(null);tour.stop();popup?.postMessage({type:'ts-b2b:pause'},origin);}};
  function incoming(e){
    if(e.origin!==origin||e.source!==popup||!e.data||typeof e.data!=='object')return;
    const m=e.data;
    if(m.type==='ts-b2b:ready'&&pending?.scene==='ready'&&(m.requestId===pending.requestId||m.requestId===null))settle(true);
    if(m.type==='ts-b2b:visible'&&pending&&m.requestId===pending.requestId&&m.scene===pending.scene)settle({scene:m.scene,visible:m.visible===true});
    if(m.type==='ts-b2b:control'&&Object.hasOwn(actions,m.action))actions[m.action]();
    if(m.type==='ts-b2b:question'&&typeof m.text==='string'&&m.text.trim()&&m.text.length<=2000){
      pausePresentation();
      if(/(?:nima|brez|ni)\s+optik/i.test(m.text))deliver({id:'service',service:'fwa',kind:'POSNETEK',title:'Poslovalnica brez optike · preveri možnosti',text:'VPI preko mobilnega dostopa je tema za preverbo razpoložljivosti. Kartica in vir ne potrjujeta pokritosti konkretne lokacije ali samodejne zamenjave storitve.'});
      win.focus();setDraft(m.text.trim());notice('Predstavitev je na pavzi. Vprašanje ostane v istem pogovoru; po odgovoru izberi Nadaljuj.');
    }
    if(m.type==='ts-b2b:hidden')pausePresentation();
  }
  win.addEventListener('message',incoming);
  doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='hidden')pausePresentation();});
  win.addEventListener('pagehide',()=>{settle(null);tour.stop();popup?.postMessage({type:'ts-b2b:clear'},origin);});
  doc.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='n'&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&!/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName)&&['playing','paused'].includes(tour.state.status)&&!doc.querySelector('dialog[open]')){e.preventDefault();tour.next();}});
  $('about-open').onclick=()=>{previousFocus=doc.activeElement;$('about-dialog').showModal();};
  $('about-close').onclick=()=>$('about-dialog').close();
  $('about-dialog').addEventListener('close',()=>previousFocus?.focus());
  $('tour-start').onclick=start;$('presentation-open').onclick=openService;
  $('presentation-fallback').addEventListener('click',()=>{tour.pause();});
  for(const [key,action] of Object.entries(actions))$('tour-'+key).onclick=action;
  $('tour-sound').onclick=()=>{voiceStatus();sound=!sound&&Boolean(localVoice);$('tour-sound').setAttribute('aria-pressed',String(sound));$('tour-sound').textContent=sound?'Zvok vklopljen':'Zvok izklopljen';if(sound&&tour.state.status==='playing')say($('tour-caption').textContent);else cancelSpeech();};
  win.speechSynthesis?.addEventListener?.('voiceschanged',voiceStatus);voiceStatus();
  return {tour,start,openService,pause:pausePresentation,
    setAccess(ok){$('tour-start').disabled=!ok;$('presentation-open').disabled=!ok;if(!ok){settle(null);tour.stop();popup?.postMessage({type:'ts-b2b:clear'},origin);}},
    clear(){tour.stop();for(const key of Object.keys(CONTEXT_FIELDS))$('shared-'+key).value='';},
    handleCommand(text){const value=text.trim().toLocaleLowerCase('sl');if(/^(predstavi se|predstavitev pomočnika)$/.test(value)){start();return true;}if(tour.state.status==='idle'||tour.state.status==='stopped')return false;
      const key=({naprej:'next',n:'next',nazaj:'back',pavza:'pause',nadaljuj:'resume',ponovi:'repeat',ustavi:'stop',stop:'stop'})[value];if(key){actions[key]();return true;}pausePresentation();return false;}
  };
}
