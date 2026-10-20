import {createTravelExecutor} from './andaluzija-ai-actions.mjs';
const $=id=>document.getElementById(id),panel=$('trip-ai-panel'),input=$('trip-ai-input'),log=$('trip-ai-messages'),status=$('trip-ai-status'),endpoint='/.netlify/functions/andaluzija-ai';
const canonical=['www.mdlxdcc.org','mdlxdcc.org','localhost','127.0.0.1'].includes(location.hostname);
let history=[],epoch=0,active=null,busy=false,available=null,authenticated=false,previousFocus;
const authEndpoint='/.netlify/functions/mdlxdcc-guide-auth';
let authBusy=false,authController=null,authGeneration=0,availabilitySequence=0,logoutPending=false;
const api=()=>window.AndaluzijaTripOptiV1;
function accountUI(){
 $('trip-ai-account-label').textContent=authenticated?'AI · prijavljena seja':'Prijava za AI';
 $('trip-ai-account-action').textContent=authenticated||logoutPending?'Odjava':'Prijava';
 $('trip-ai-account-action').hidden=!canonical;$('trip-ai-account-action').disabled=authBusy;
 $('trip-ai-auth-submit').disabled=authBusy;$('trip-ai-auth-cancel').disabled=authBusy;
}
function showAuth(show,focus=true){
 $('trip-ai-auth').hidden=!show;panel.classList.toggle('trip-ai-auth-open',show);$('trip-ai-auth-error').hidden=true;
 if(!show){$('trip-ai-password').value='';$('trip-ai-email').value='';}
 if(focus&&!panel.hidden)(show?$('trip-ai-email'):input).focus({preventScroll:true});
}
function clearCredentials(){
 authGeneration++;authController?.abort();authController=null;authBusy=false;
 $('trip-ai-password').value='';$('trip-ai-email').value='';showAuth(false,false);accountUI();
}
async function signIn(){
 if(authBusy||!canonical)return;
 const email=$('trip-ai-email').value.trim(),password=$('trip-ai-password').value;
 $('trip-ai-password').value='';$('trip-ai-auth-error').hidden=true;
 const generation=++authGeneration;authController=new AbortController();authBusy=true;accountUI();
 try{
  const r=await fetch(authEndpoint,{method:'POST',credentials:'same-origin',cache:'no-store',signal:AbortSignal.any([authController.signal,AbortSignal.timeout(20000)]),headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'login',email,password})});
  const d=await r.json();if(generation!==authGeneration)return;
  if(!r.ok||!d.authenticated)throw Error(d.error?.code||(r.status===429?'RATE_LIMITED':'INVALID_LOGIN'));
  if(d.account?.role!=='owner')throw Error('TRIP_ACCESS_REQUIRED');
  // The shared HttpOnly Guide cookie also authenticates this endpoint. It never unlocks Shield.
  authenticated=true;logoutPending=false;availabilitySequence++;showAuth(false);authBusy=false;accountUI();await availability();
 }catch(e){
  if(generation!==authGeneration)return;
  const reasons={INVALID_EMAIL:'Vpišita veljaven e-poštni naslov.',INVALID_LOGIN:'E-pošta ali geslo ni pravilno.',RATE_LIMITED:'Preveč poskusov prijave. Poskusita pozneje.',TRIP_ACCESS_REQUIRED:'Ta račun nima dostopa do zasebnega izleta. Javni vodnik je na glavni strani MDL×DCC.'};
  $('trip-ai-auth-error').textContent=reasons[e.message]||'Prijava trenutno ni dosegljiva. Poskusita pozneje.';$('trip-ai-auth-error').hidden=false;
 }finally{if(generation===authGeneration){authBusy=false;authController=null;accountUI();}}
}
async function signOut(){
 if(authBusy||!canonical)return;
 cancel(true);api()?.lockSession();logoutPending=true;authBusy=true;accountUI();
 const generation=++authGeneration;
 try{
  const responses=await Promise.all([authEndpoint,'/.netlify/functions/andaluzija-auth'].map(url=>fetch(url,{method:'POST',credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})})));
  if(generation!==authGeneration)return;if(responses.some(r=>!r.ok))throw Error('LOGOUT_UNCONFIRMED');
  logoutPending=false;status.textContent='Odjavljena. Osebni izlet je zaklenjen.';
 }catch{if(generation===authGeneration)status.textContent='Izlet je lokalno zaklenjen; strežniška odjava ni potrjena. Poskusita Odjava znova.';}
 finally{if(generation===authGeneration){authBusy=false;accountUI();}}
}
function line(role,text,provider){const el=document.createElement('article'),label=document.createElement('b'),body=document.createElement('div');el.className='trip-ai-message';label.textContent=role==='user'?'Vidva':role==='receipt'?'Izvedba':provider==='claude'?'Claude':'GPT';body.className='trip-ai-text';el.append(label,body);log.append(el);renderText(body,text);log.scrollTop=log.scrollHeight;return body;}
function renderText(el,text){el.replaceChildren();const re=/\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)/g;let at=0;for(const m of text.matchAll(re)){el.append(document.createTextNode(text.slice(at,m.index)));try{const u=new URL(m[2]);if(u.protocol==='https:'&&!u.username&&!u.password){const a=document.createElement('a');a.textContent=m[1];a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';el.append(a);}else el.append(document.createTextNode(m[0]));}catch{el.append(document.createTextNode(m[0]));}at=m.index+m[0].length;}el.append(document.createTextNode(text.slice(at)));}
const executor=createTravelExecutor({adapter:api,progress:s=>status.textContent=s,renderPreview:p=>{
 const host=$('trip-ai-preview');host.replaceChildren();const title=document.createElement('b');title.textContent='Predogled sprememb';host.append(title);
 for(const d of p.diff){const text=document.createElement('p');text.textContent=d.changes.map(c=>(c.before?.name||'Nov ogled')+' → '+(c.after?.name||'odstranjeno')).join('; ')||'Vrstni red: '+d.orderAfter.join(' → ');host.append(text);}
 if(p.solver){const text=document.createElement('p');text.textContent='TripOpti · '+p.solver.receipt.source+' · ocena po ravni črti; pravočasnost in peš pot nista potrjeni.';host.append(text);}
}});
function toggle(open=!panel.hidden){if(open){previousFocus=document.activeElement;panel.hidden=false;$('trip-ai-toggle').setAttribute('aria-expanded','true');document.body.classList.add('trip-ai-open');input.focus();availability();}else{availabilitySequence++;clearCredentials();panel.hidden=true;$('trip-ai-toggle').setAttribute('aria-expanded','false');document.body.classList.remove('trip-ai-open');previousFocus?.focus();}}
function cancel(clear=false){epoch++;availabilitySequence++;active?.abort();active=null;api()?.cancelOptimization();busy=false;$('trip-ai-send').disabled=false;if(clear){authenticated=false;available=null;history=[];log.replaceChildren();input.value='';$('trip-ai-preview').replaceChildren();executor.clear();$('trip-ai-allow').checked=true;clearCredentials();}status.textContent=clear?'Izlet je zaklenjen. Za AI se prijavita z računom MDL×DCC; za osebni del odklenita »Najini ogledi«.':'Odgovor je prekinjen. Že potrjene spremembe ostanejo vidne v programu.';}
function ready(){return canonical&&!logoutPending&&(authenticated||api()?.getContext().capabilities.write);}
async function availability(){
 accountUI();if(!canonical){showAuth(false,false);status.textContent='Ta gostitelj nima AI zaledja. Odprita glavno stran izleta.';return;}
 if(logoutPending||authBusy)return;
 const expectedEpoch=epoch,sequence=++availabilitySequence;
 try{
  const r=await fetch(endpoint,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(12000)});if(expectedEpoch!==epoch||sequence!==availabilitySequence||logoutPending)return;
  if(r.status===401){authenticated=false;if(api()?.getContext().capabilities.write)api().lockSession();accountUI();status.textContent='Za pogovor se prijavita z računom MDL×DCC ali odklenita skupni izlet.';if(!panel.hidden)showAuth(true);return;}
  if(!r.ok)throw Error('UNAVAILABLE');const data=await r.json();if(expectedEpoch!==epoch||sequence!==availabilitySequence)return;
  authenticated=true;available=data.providers;showAuth(false,false);accountUI();status.textContent=api()?.getContext().capabilities.write?'Izberita GPT ali Claude. Pogovor ostane v pomnilniku do zaklepa.':'Javni mestni predlogi · osebni del in spremembe ostajajo zaklenjeni.';
 }catch{if(expectedEpoch===epoch&&sequence===availabilitySequence){status.textContent='Pomočnik trenutno ni dosegljiv. Program in ročno urejanje ostaneta na voljo.';accountUI();}}
}
async function* events(response){const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';try{for(;;){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});if(buffer.length>500000)throw Error('TOO_LARGE');let i;while((i=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,i);buffer=buffer.slice(i+2);for(const line of frame.split('\n'))if(line.startsWith('data: '))yield JSON.parse(line.slice(6));}}}finally{reader.releaseLock();}}
async function submit(message){
 if(busy||authBusy||logoutPending)return;if(!ready()){await availability();if(!ready())return;}
 const provider=$('trip-ai-provider').value;if(available&&available[provider]===false){status.textContent=(provider==='claude'?'Claude':'GPT')+' trenutno ni dosegljiv.';return;}
 const selectedEpoch=++epoch;active=new AbortController();const signal=active.signal;busy=true;$('trip-ai-send').disabled=true;
 const prior=history.slice(-12);history.push({role:'user',content:message});line('user',message);input.value='';let answer='';
 let body={message,provider,epoch:selectedEpoch,allowChanges:$('trip-ai-allow').checked,history:prior,context:api().getContext()};
 try{
  for(let round=0;round<7;round++){
   if(selectedEpoch!==epoch||signal.aborted)throw Error('CANCELLED');
   const response=await fetch(endpoint,{method:'POST',credentials:'same-origin',cache:'no-store',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   if(!response.ok){if(response.status===401){api()?.lockSession();throw Error('AUTH_REQUIRED');}const data=await response.json().catch(()=>({}));throw Error(data.error?.code||'ANSWER_UNAVAILABLE');}
   let next=null,done=false;
   for await(const event of events(response)){
    if(selectedEpoch!==epoch||signal.aborted)throw Error('CANCELLED');
    if(event.type==='status')status.textContent='Pripravljam odgovor …';
    if(event.type==='delta')answer+=event.text;
    if(event.type==='error')throw Error(event.code);
    if(event.type==='done'){done=true;status.textContent='Odgovor · '+(provider==='claude'?'Claude':'GPT')+' · vodič '+event.skill.version;}
    if(event.type==='client_action'){
     status.textContent='Preverjam in izvajam zahtevo v programu …';
     const receipt=await executor.execute(event.action,{epoch:selectedEpoch,signal});
     if(selectedEpoch!==epoch||signal.aborted)throw Error('CANCELLED');
     const words={preview:'Predogled · načrt še ni shranjen',saved:'Shranjeno · rev. '+receipt.save?.revision,synced:'Skupni načrt je že usklajen',conflict:'Spor različic · sprememb nisem prepisal',failed:'Dejanje ni uspelo',cancelled:'Dejanje je preklicano'};
     line('receipt',words[receipt.status]+(receipt.reason?' · '+receipt.reason:''));
     next={continuation:event.continuation,receipt,context:api().getContext()};
    }
   }
   if(done){line('assistant',answer,provider);history.push({role:'assistant',content:answer,provider});history=history.slice(-24);return;}
   if(!next)throw Error('INCOMPLETE_RESPONSE');body=next;
  }
  throw Error('TOOL_LIMIT');
 }catch(e){if(selectedEpoch!==epoch||signal.aborted)return;const reasons={AUTH_REQUIRED:'Prijava je potekla. Izlet ponovno odklenita.',RATE_LIMITED:'Dosežena je omejitev. Poskusita pozneje.',AI_UNAVAILABLE:'Izbrani pomočnik ni dosegljiv.',INVALID_OR_EXPIRED_REQUEST:'Zahteva je potekla ali shranitev ni potrjena. Preverita stanje programa.'};status.textContent=reasons[e.message]||'Odgovor ni uspel. Preverita stanje programa; nove shranitve ne potrjujem.';}
 finally{if(selectedEpoch===epoch){busy=false;active=null;$('trip-ai-send').disabled=false;}}
}
$('trip-ai-toggle').onclick=()=>toggle(panel.hidden);$('trip-ai-close').onclick=()=>toggle(false);$('trip-ai-cancel').onclick=()=>cancel();
$('trip-ai-account-action').onclick=()=>{if(authenticated||logoutPending)signOut();else showAuth(true);};
$('trip-ai-auth').onsubmit=e=>{e.preventDefault();signIn();};$('trip-ai-auth-cancel').onclick=()=>showAuth(false);
$('trip-ai-form').onsubmit=e=>{e.preventDefault();const message=input.value.trim();if(message)submit(message);};
panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();toggle(false);}if(e.key==='Tab'&&matchMedia('(max-width: 700px)').matches){const nodes=[...panel.querySelectorAll('button,input,select,textarea,a[href]')].filter(x=>!x.disabled&&x.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
for(const b of panel.querySelectorAll('[data-trip-question]'))b.onclick=()=>{input.value=b.dataset.tripQuestion;input.focus();};
window.addEventListener('andaluzija-trip-state',e=>{if(e.detail.status==='locked')cancel(true);});
window.addEventListener('andaluzija-trip-ready',()=>{if(!panel.hidden)availability();});
for(const id of ['poi-day','poi-variant','poi-city'])document.getElementById(id)?.addEventListener('change',()=>{if(busy)cancel();});
window.addEventListener('pagehide',()=>cancel(true));window.addEventListener('pageshow',e=>{if(e.persisted)cancel(true);});
// Re-check only authentication, never paid providers, including while the panel is hidden.
setInterval(()=>{if(document.visibilityState==='visible'&&ready())availability();},60000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&ready())availability();});
accountUI();
