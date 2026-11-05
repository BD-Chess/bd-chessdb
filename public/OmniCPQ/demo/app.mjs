import {DEMO_PROTOCOL,DEMO_EXTENSION_ID,DEMO_PRODUCT,DEMO_POLICY,DEMO_TASKS,validateDemoHandshake,validateDemoObservation,validateDemoAction,makeDemoRequest,parseDemoAction,demoError} from '../extension-demo/privacy.mjs';
import {sseEvents} from '../core.mjs';
export const DEMO_API='/.netlify/functions/omnicpq-demo-assistant';
export function makeDemoClient({runtime=globalThis.chrome?.runtime,fetcher=globalThis.fetch,timeoutMs=15000,onState=()=>{},onText=()=>{}}={}){
 const identity=crypto.randomUUID();let handshake=null,observation=null,action=null,controller=null,epoch=0,busy=false;
 const state=()=>({connected:!!handshake,protected:!!handshake,observation,action,busy,product:handshake?.product||'NI POTRJENO',policy:handshake?.protection?.policy||'NI POTRJENO'});
 const notify=()=>onState(state());
 const send=(type,data={})=>new Promise((resolve,reject)=>{
  if(!runtime?.sendMessage)return reject(demoError('DEMO_BRIDGE_MISSING'));
  let done=false;const timer=setTimeout(()=>{done=true;reject(demoError('DEMO_BRIDGE_TIMEOUT'));},timeoutMs);
  try{runtime.sendMessage(DEMO_EXTENSION_ID,{protocol:DEMO_PROTOCOL,type,...data},result=>{
   if(done)return;done=true;clearTimeout(timer);
   if(runtime.lastError||!result)return reject(demoError('DEMO_BRIDGE_MISSING'));
   if(!result.ok)return reject(demoError('DEMO_BRIDGE_UNAVAILABLE'));
   try{validateDemoHandshake({...result,token:result.token||data.token||handshake?.token});}catch{return reject(demoError('DEMO_BRIDGE_IDENTITY'));}
   resolve(result);
  });}catch{clearTimeout(timer);reject(demoError('DEMO_BRIDGE_UNAVAILABLE'));}
 });
 async function connect(){
  const current=++epoch;
  try{const result=await send('status',{identity});validateDemoHandshake(result);
   if(epoch!==current)throw demoError('DEMO_CONNECTION_CHANGED');
   if(result.paused){await send('resume',{token:result.token});if(epoch!==current)throw demoError('DEMO_CONNECTION_CHANGED');}
   handshake=result;observation=null;action=null;notify();return state();
  }catch(e){if(current===epoch){handshake=null;observation=null;action=null;notify();}throw e;}
 }
 async function read(){
  if(!handshake)throw demoError('DEMO_BRIDGE_IDENTITY');
  const current=epoch,result=await send('observe',{token:handshake.token});
  if(current!==epoch)throw demoError('DEMO_CONNECTION_CHANGED');
  validateDemoObservation(result.observation);observation=result.observation;action=null;notify();return observation;
 }
 async function health(){
  const response=await fetcher(DEMO_API,{method:'GET',credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw demoError(response.status===401||response.status===403?'DEMO_LOGIN_REQUIRED':'DEMO_UNAVAILABLE');
  const result=await response.json();
  if(result.policy!==DEMO_POLICY||result.extensionId!==DEMO_EXTENSION_ID)throw demoError('DEMO_POLICY_UNAVAILABLE');
  return result;
 }
 async function ask(task,profile='careful'){
  if(typeof task!=='string'||!Object.hasOwn(DEMO_TASKS,task)||!['careful','fast'].includes(profile))throw demoError('DEMO_FREE_TEXT_BLOCKED');
  if(busy)throw demoError('DEMO_BUSY');
  if(!handshake)throw demoError('DEMO_BRIDGE_IDENTITY');
  const current=epoch;busy=true;action=null;controller=new AbortController();const abort=controller;notify();
  try{
   const observed=await read();if(current!==epoch||abort.signal.aborted)throw demoError('DEMO_STOPPED');
   const request=makeDemoRequest({task,profile,observation:observed,handshake});
   // This is the only data POST; validation occurs before any byte is sent.
   const response=await fetcher(DEMO_API,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:abort.signal});
   if(!response.ok)throw demoError('DEMO_REQUEST_REJECTED');
   if(!response.headers.get('content-type')?.includes('text/event-stream'))throw demoError('DEMO_RESPONSE_INVALID');
   let text='',terminal=false,result;
   for await(const frame of sseEvents(response.body,abort.signal)){
    if(abort.signal.aborted||current!==epoch)throw demoError('DEMO_STOPPED');
    if(frame.clientRequestId!==request.clientRequestId)throw demoError('DEMO_RESPONSE_INVALID');
    if(frame.type==='delta'){if(typeof frame.text!=='string'||text.length+frame.text.length>200000)throw demoError('DEMO_RESPONSE_INVALID');text+=frame.text;onText(text);}
    if(frame.type==='identity')onState({...state(),observedModel:frame.model,observedReasoning:frame.reasoning});
    if(frame.type==='done'){terminal=true;result=frame;break;}
    if(frame.type==='error')throw demoError('DEMO_MODEL_REQUEST_FAILED');
   }
   if(!terminal||!text)throw demoError('DEMO_RESPONSE_INVALID');
   action=parseDemoAction(text,observed);notify();return {text,result,action};
  }finally{if(controller===abort)controller=null;busy=false;notify();}
 }
 async function execute({humanApproved=false}={}){
  if(busy||!handshake||!observation||!action)throw demoError('DEMO_ACTION_BLOCKED');
  if(action.operation==='navigate'&&!humanApproved)throw demoError('DEMO_APPROVAL_REQUIRED');
  validateDemoAction(action,observation);
  const chosen={...action,actionId:crypto.randomUUID()},current=epoch;action=null;busy=true;notify();
  try{
   const result=await send('execute',{token:handshake.token,action:chosen,humanApproved});
   if(current!==epoch)throw demoError('DEMO_CONNECTION_CHANGED');
   validateDemoObservation(result.observation);observation=result.observation;notify();return result;
  }catch(e){observation=null;action=null;notify();throw e;}
  finally{busy=false;notify();}
 }
 async function stop(){
  epoch++;controller?.abort();action=null;observation=null;const old=handshake;handshake=null;notify();
  if(old)await send('suspend',{token:old.token}).catch(()=>{});
 }
 async function disconnect(){const old=handshake;await stop();if(old)await send('disconnect',{token:old.token}).catch(()=>{});}
 return {connect,read,health,ask,execute,stop,disconnect,state};
}
export const DEMO_MESSAGES=Object.freeze({
 DEMO_LOGIN_REQUIRED:'Najprej se prijavi v osebnem pomočniku; nato se vrni na ta ločeni demo pogled.',
 DEMO_BRIDGE_MISSING:'Namesti AI za OmniCPQ, odpri njegovo ikono na STAGE zavihku in poveži demo zavihka.',
 DEMO_BRIDGE_UNAVAILABLE:'Povezava še ni potrjena. V demo razširitvi poveži prava zavihka in ponovno preveri.',
 DEMO_BRIDGE_IDENTITY:'Demo identiteta ali zaščita ni potrjena. Podatki niso poslani.',
 DEMO_FREE_TEXT_BLOCKED:'Demo dovoljuje le izbrane preverjene pozive. Prosto besedilo, slike in priloge so izključeni.',
 DEMO_STOPPED:'Naloga ustavljena. Pred nadaljevanjem je potrebna nova povezava in opazovanje.'
});
export function bindDemoUI(doc=globalThis.document){
 const $=id=>doc.getElementById(id),status=text=>{$('status').textContent=text;};
 const problem=e=>status(DEMO_MESSAGES[e?.code]||'Korak ni potrjen. Ponovno preveri povezavo in trenutno stanje; dejanje ni samodejno ponovljeno.');
 const client=makeDemoClient({onState:s=>{
  $('identity').textContent=s.connected?s.product+' · '+s.policy:'Demo povezava še ni potrjena';
  $('observation').textContent=s.observation?JSON.stringify(s.observation,null,2):'Dovoljeno opazovanje še ni na voljo.';
  $('execute').disabled=s.busy||!s.action;$('send').disabled=s.busy||!s.connected;$('read').disabled=s.busy||!s.connected;
  if(s.observedModel)$('model-status').textContent='Vrnjeni model: '+s.observedModel+' · reasoning '+s.observedReasoning;
 },onText:text=>{$('answer').textContent=text;}});
 for(const [id,label]of Object.entries(DEMO_TASKS))$('task').add(new Option(label,id));
 $('connect').onclick=()=>client.connect().then(()=>status('Potrjena demo razširitev. Dovoljena sta branje in navigacija.')).catch(problem);
 $('read').onclick=()=>client.read().then(()=>status('Prejeto je samo minimizirano opazovanje.')).catch(problem);
 $('send').onclick=()=>{const typed=$('prompt').value.trim();const task=$('task').value;
  if(typed&&typed!==DEMO_TASKS[task])return problem(demoError('DEMO_FREE_TEXT_BLOCKED'));
  $('answer').textContent='';client.ask(task,$('profile').value).then(()=>status('Odgovor je pripravljen. Predlog navigacije zahteva tvojo potrditev.')).catch(problem);};
 $('execute').onclick=()=>client.execute({humanApproved:true}).then(()=>status('Prejeto novo opazovanje; to ni potrdilo shranitve.')).catch(problem);
 $('stop').onclick=()=>client.stop().then(()=>status(DEMO_MESSAGES.DEMO_STOPPED));
 $('task').onchange=()=>{$('prompt').value=DEMO_TASKS[$('task').value];};
 $('prompt').value=DEMO_TASKS[$('task').value];
 client.health().then(h=>{$('model-status').textContent='Privzeto: '+h.profiles.careful.model+' · High. Dejanski model je do odgovora UNKNOWN.';}).catch(problem);
 return client;
}
if(typeof document!=='undefined'&&document.getElementById('demo-root'))bindDemoUI(document);
