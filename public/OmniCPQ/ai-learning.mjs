import {LEARNING_PROTOCOL,TESTER_PROFILE,casesFor} from './ai-learning-contract.mjs';
import {uuid,digest} from './core.mjs';
const ENDPOINT='/.netlify/functions/omnicpq-assistant?omnicpq_learning=control-v1';
const TERMINAL=['STOPPED','COMPLETE','BLOCKED','EXPIRED'];
const WORDS={RUNNING:'Poteka',PAUSED:'Pavza',STOPPED:'Ustavljeno',STOPPING:'Ustavljanje še ni potrjeno',COMPLETE:'Končano',BLOCKED:'Zadržano',EXPIRED:'Čas je potekel'};
const ERRORS={AUTH_REQUIRED:'Prijava je potekla. Najprej ponovno potrdi dostop.',OWNER_REQUIRED:'AI učenje je na voljo preverjenemu lastniku.',LEARNING_CONFLICT:'Stanje se je spremenilo. Preveri shranjeno stanje pred nadaljevanjem.',LEARNING_UNCERTAIN:'Izid prejšnjega koraka ni potrjen. Koraka ne ponavljamo samodejno.',LEARNING_BUDGET:'Preostali proračun ne zadošča za celoten naslednji preizkus.',LEARNING_TIME:'Dosežena je časovna meja.',LEARNING_STOPPED:'Ta cikel je trajno ustavljen.',LEARNING_PAUSED:'Cikel je na pavzi.',LEARNING_VERSION_CHANGED:'Različica pomočnika se je spremenila. Za nov preizkus začni nov cikel.',AI_UNAVAILABLE:'Modelni API še ni dosegljiv. Vgrajeni preizkusi so ločena možnost.',MODEL_UNAVAILABLE:'Zahtevani model ni dosegljiv; drugega ne uporabimo.',MODEL_PROFILE_UNAVAILABLE:'Zahtevana nastavitev modela ni podprta; druge ne uporabimo.',STORAGE_UNAVAILABLE:'Trajnega zapisa ni mogoče potrditi. Novih preizkusov ne zaženemo.',RATE_LIMITED:'Dosežena je omejitev zahtev. Samodejnega ponavljanja ni.',LEARNING_NOT_FOUND:'Shranjeni cikel ni dosegljiv za to prijavo.',LEARNING_LIMIT:'Dosežena je meja dogodkov tega cikla.'};
const money=n=>'$'+(Number.isSafeInteger(n)?Math.ceil(n/1000)/1e6:0).toFixed(6);
export function reportMarkdown(s,sha=''){
 return '# AI učenje — poročilo\n\n'+
  ['Cikel: '+s.runId,'Različica pomočnika: '+s.appVersion,'Katalog: '+s.catalogVersion,'Način: '+(s.kind==='api'?'AI tester nad izmišljenimi primeri':'Vgrajeni preizkusi kode'),'Stanje: '+s.status,'Razlog zadržanja: '+(s.reason||'NONE'),s.budgetHold?'Naslednji celotni par zahteva: '+money(s.budgetHold.requiredNanoUSD)+'; preostalo: '+money(s.budgetHold.remainingNanoUSD):'','Rezervirana zgornja poraba: '+money(s.reservedNanoUSD)+' / '+money(s.budgetNanoUSD),'Zaprtje prihodnjih klicev ob ustavitvi: '+(s.stopBarrierClosed?'POTRJENO':'NI_POTRJENO_ALI_NI_ZAHTEVANO'),'Predhodno zavezani klici ob ustavitvi: '+(s.stopCommittedCalls??0)+' (ni dokaz odpošiljanja ali računa)','Dejanski CPQ: NOT_RUN','Prevzem znanja: PROPOSED_ONLY; nič ni samodejno nameščeno.',sha?'SHA-256 JSON poročila: '+sha:''].filter(Boolean).join('\n\n')+
  '\n\n| Preizkus | Rezultat | Razlog |\n|---|---|---|\n'+s.results.map(r=>'| '+r.title+' | '+r.status+' | '+r.reason+' |').join('\n')+
  '\n\nPASS tukaj velja samo za navedeni sintetični preizkus. Ni dokaz poslovnega učinka, shranitve ali ponovnega odprtja v CPQ. Predlogi so za pregled graditelja in ločen sprejem v HTML ter Copilot.\n';
}
export function createLearningUI({document:doc,window:win,authorized,canStart=()=>true,account=()=>'',notice=()=>{}}){
 const $=id=>doc.getElementById(id),root=$('ai-learning-panel');
 if(!root)return {open(){},hide(){},setAccess(){},isBusy(){return false;}};
 let access=false,visible=false,epoch=0,state=null,capability=null,runId=null,paused=true,inflight=false,looping=false,starting=false,controller=null,preview=null,quoteSerial=0;
 const key=()=> 'omnicpq:ai-learning:r1:'+String(account()).slice(0,100);
 const allowed=()=>access&&authorized();
 const status=text=>{$('learning-status').textContent=text;};
 const problem=e=>ERRORS[e?.code]||'Odgovor ni potrjen. Preveri shranjeno stanje; preizkusa ne ponavljamo samodejno.';
 function pointer(id){
  try{win.localStorage.setItem(key(),JSON.stringify({schema:LEARNING_PROTOCOL,runId:id}));return true;}
  catch{status('Lokalne obnovitve ni mogoče shraniti. ID cikla si shrani pred nadaljevanjem.');return false;}
 }
 function adopt(s,token){
  if(token!==epoch||!allowed()||s?.schema!==LEARNING_PROTOCOL||s.runId!==runId)return false;
  if(state?.status==='STOPPED'&&s.status!=='STOPPED')return false;
  if(state?.status==='STOPPING'&&!['STOPPING','STOPPED'].includes(s.status))return false;
  if(state&&s.revision<state.revision&&s.status!=='STOPPED')return false;
  if(state&&s.revision===state.revision&&!state.pending&&s.pending&&s.status!=='STOPPED')return false;
  state=s;render();return true;
 }
 async function request(action,data={},signal){
  const response=await win.fetch(ENDPOINT,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,runId,...data}),signal});
  if(response.headers.get('content-type')?.startsWith('text/event-stream')){
   const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',size=0,terminal=null;
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>200000)throw Error('OUTPUT_LIMIT');buffer+=decoder.decode(value,{stream:true});let at;
    while((at=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,at);buffer=buffer.slice(at+2);const line=frame.split('\n').find(x=>x.startsWith('data: '));if(!line)continue;const v=JSON.parse(line.slice(6));if(v.type==='result'||v.type==='error')terminal=v;}
   }}finally{reader.releaseLock();}
   if(!terminal?.ok)throw Object.assign(Error(),{code:terminal?.error?.code||'LEARNING_UNCERTAIN'});
   return terminal;
  }
  const result=await response.json();if(!response.ok||result.ok!==true)throw Object.assign(Error(),{code:result.error?.code||'LEARNING_UNCERTAIN'});return result;
 }
 const settings=()=>({kind:$('learning-kind').value,profile:$('learning-profile').value,maxTests:Number($('learning-tests').value),minutes:Number($('learning-minutes').value),budgetNanoUSD:$('learning-kind').value==='api'?Number($('learning-budget').value):0});
 const settingsKey=x=>JSON.stringify(x);
 const budgetMessage=()=> 'Zadržano zaradi proračuna. Naslednji celotni preizkus zahteva '+money(state.budgetHold?.requiredNanoUSD)+'; preostalo '+money(state.budgetHold?.remainingNanoUSD)+'. Nedokončani preizkusi ostanejo NOT_RUN. Za drugačno mejo izberi nov cikel in ponovno potrdi stroške.';
 async function refreshQuote(fields=settings()){
  const serial=++quoteSerial,token=epoch,k=settingsKey(fields);
  preview={key:k,pending:true};render();
  try{
   const v=await request('quote',{runId:uuid(),...fields}),q=v.quote;
   if(serial!==quoteSerial||token!==epoch||!allowed()||!visible||k!==settingsKey(settings()))return null;
   if(q?.schema!==LEARNING_PROTOCOL||q.appVersion!==capability?.appVersion||q.kind!==fields.kind||q.profile!==fields.profile||q.budgetNanoUSD!==fields.budgetNanoUSD||!Number.isSafeInteger(q.requiredNanoUSD)||q.requiredNanoUSD<0||typeof q.fits!=='boolean'||q.fits!==(q.requiredNanoUSD<=fields.budgetNanoUSD))throw Object.assign(Error(),{code:'LEARNING_UNCERTAIN'});
   preview={key:k,quote:q};render();return q;
  }catch(e){
   if(serial===quoteSerial&&token===epoch&&allowed()&&visible){preview={key:k,error:problem(e)};render();}
   return null;
  }
 }
 function render(){
  if(root.isConnected===false)return;
  root.hidden=!visible||!allowed();
  const kind=$('learning-kind').value,p=preview?.key===settingsKey(settings())?preview:null;
  $('learning-api-options').hidden=kind!=='api';
  const running=state?.status==='RUNNING'&&!paused;
  $('learning-start').disabled=!allowed()||starting||inflight||looping||!canStart()||Boolean(runId&&!state)||Boolean(state&&!TERMINAL.includes(state.status))||(kind==='api'&&(!capability?.apiAvailable||!$('learning-cost-ack').checked||!p?.quote?.fits));
  $('learning-pause').disabled=!allowed()||!state||state.status!=='RUNNING'||paused;
  $('learning-resume').disabled=!allowed()||!state||TERMINAL.includes(state.status)||state.status==='STOPPING'||inflight||looping||!canStart();
  $('learning-stop').disabled=!allowed()||!state||TERMINAL.includes(state.status);
  $('learning-refresh').disabled=!allowed()||!runId;
  for(const id of ['learning-export-json','learning-export-md'])$(id).disabled=!allowed()||!state;
  for(const id of ['learning-kind','learning-profile','learning-tests','learning-minutes','learning-budget','learning-cost-ack'])$(id).disabled=Boolean(state&&!TERMINAL.includes(state.status))||starting||inflight||looping;
  $('learning-run-id').value=runId||'';
  if($('learning-budget-preview'))$('learning-budget-preview').textContent=kind!=='api'?'':p?.pending?'Preverjam potrebno rezervacijo; modelnih klicev ni.':p?.error?'Rezervacija še ni potrjena. '+p.error:p?.quote?'Naslednji celotni preizkus rezervira največ '+money(p.quote.requiredNanoUSD)+' za pomočnika in testerja; izbrana meja '+money(p.quote.budgetNanoUSD)+'. '+(p.quote.fits?'Meja zadošča za ta par.':'Zadržano pred zagonom: meja ne zadošča, preizkusi ostanejo NOT_RUN.')+' Predogled ne kliče modelov in ni račun.':'Pred zagonom preveri potrebno rezervacijo.';
  $('learning-progress').textContent=state?state.completed+' / '+state.total+' · '+(WORDS[state.status]||'Neznano')+(state.pending?' · korak še ni potrjeno zaključen':''):kind==='api'&&p?.quote&&!p.quote.fits?'Zadržano pred zagonom · NOT_RUN':'Pripravljen nov omejeni cikel';
  $('learning-counts').textContent=state?Object.entries(state.counts).map(([k,v])=>k+': '+v).join(' · '):'PASS: 0 · FAIL: 0 · PARTIAL: 0 · BLOCKED: 0 · NOT_RUN: '+(kind==='api'&&p?.quote&&!p.quote.fits?Number($('learning-tests').value):0);
  $('learning-cost').textContent=state?'Rezervirano največ '+money(state.reservedNanoUSD)+' / '+money(state.budgetNanoUSD)+' · '+state.reservedCalls+' / '+state.maxCalls+' rezerviranih API klicev. Dejanska usage je pri posamezni vlogi; zneski niso račun.':'Vgrajeni preizkusi ne kličejo modelov.';
  $('learning-next').textContent=state?.nextTest?'Naslednji: '+state.nextTest:'';
  $('learning-results').replaceChildren();
  for(const r of state?.results||[]){
   const row=doc.createElement('li'),title=doc.createElement('strong'),details=doc.createElement('p');title.textContent=r.title+' · '+r.status;
   details.textContent=r.reason+(r.observed?' · opaženo: '+r.observed:'');
   row.append(title,details);
   for(const c of r.calls||[]){const p=doc.createElement('p');p.className='hint';p.textContent=(c.role==='tester'?'Tester':'Pomočnik')+': '+c.requestedModel+' / '+c.requestedReasoning+' → '+c.observedModel+' / '+c.observedReasoning+' · '+(c.usage.inputTokens??'UNKNOWN')+' vhodnih, '+(c.usage.outputTokens??'UNKNOWN')+' izhodnih tokenov · '+c.usage.status;row.append(p);}
   if(r.status==='FAIL'){const p=doc.createElement('p');p.textContent='Kandidat za popravek: pregled istega primera in regresija za HTML ter Copilot. Še ni sprejeto ali nameščeno.';row.append(p);}
   $('learning-results').append(row);
  }
  if(state?.status==='BLOCKED'&&state.reason==='LEARNING_BUDGET')status(budgetMessage());
  else if(running)status(inflight?'Preizkus poteka. Pavza ustavi naslednje korake; Ustavi prekliče cikel.':'Pripravljam naslednji omejeni preizkus.');
 }
 async function refresh(){
  if(!allowed()||!runId)return;const token=epoch;
  try{const v=await request('status');if(adopt(v.state,token)){if(state.status==='BLOCKED'&&state.reason==='LEARNING_BUDGET')status(budgetMessage());else status('Shranjeno stanje je prebrano. Nadaljevanje sproži samo gumb Nadaljuj.');}}
  catch(e){if(token===epoch&&allowed()&&e?.code==='LEARNING_NOT_FOUND'){runId=null;state=null;try{win.localStorage.removeItem(key());}catch{}}status(problem(e));render();}
 }
 async function loop(){
  if(looping)return;looping=true;const token=epoch;
  try{
   while(token===epoch&&allowed()&&visible&&!paused&&state?.status==='RUNNING'&&!state.pending){
    inflight=true;controller=new AbortController();render();
    try{const result=await request('step',{revision:state.revision},controller.signal);if(!adopt(result.state,token))break;}
    catch(e){paused=true;if(token===epoch&&allowed())status(problem(e));break;}
    finally{inflight=false;controller=null;render();}
   }
   if(token===epoch&&allowed()&&state&&TERMINAL.includes(state.status))status(state.status==='BLOCKED'&&state.reason==='LEARNING_BUDGET'?budgetMessage():(WORDS[state.status]||'Končano')+'. To je omejeni preizkus, ne dokaz izvedbe v CPQ.');
  }finally{looping=false;render();}
 }
 async function start(){
  if(!allowed()||!canStart()||starting||inflight||looping||runId&&!state||state&&!TERMINAL.includes(state.status))return;
  const fields=settings();if(fields.kind==='api'&&(!$('learning-cost-ack').checked||!capability?.apiAvailable))return;
  starting=true;const token=++epoch;paused=true;render();
  try{
   if(fields.kind==='api'){
    const q=await refreshQuote(fields);
    if(token!==epoch||!allowed()||!visible||settingsKey(fields)!==settingsKey(settings()))return;
    if(!q?.fits){status(q?'Zadržano pred zagonom zaradi proračuna. Izberi mejo, ki zadošča za celoten par, in ponovno potrdi stroške.':'Potrebne rezervacije ni mogoče potrditi. Preizkusi niso bili zagnani.');return;}
   }
   if(token!==epoch||!allowed()||!visible)return;
   runId=uuid();state=null;
   if(!pointer(runId)){runId=null;return;}
   const v=await request('start',{...fields,ackCost:fields.kind==='api'});
   starting=false;if(adopt(v.state,token)){paused=false;await loop();}
  }catch(e){if(token===epoch&&allowed())status(problem(e));}finally{starting=false;render();}
 }
 async function pause(){
  paused=true;render();if(!allowed()||!state||state.status!=='RUNNING')return;
  const token=epoch;
  try{const latest=await request('status');if(!adopt(latest.state,token)||state.status!=='RUNNING')return;const v=await request('pause',{revision:state.revision});adopt(v.state,token);status(inflight?'Pavza je shranjena; že začeti preizkus se zaključuje.':'Pavza je shranjena.');}
  catch(e){status(problem(e));}
 }
 async function resume(){
  if(!allowed()||!state||inflight||looping||!canStart())return;
  const token=epoch;paused=true;
  try{const latest=await request('status');if(!adopt(latest.state,token)||TERMINAL.includes(state.status))return;
   if(state.pending){status('Prejšnji poskus še nima potrjenega zaključka. Ne ponavljamo ga. Preveri stanje pozneje ali ustavi cikel.');return;}
   const v=await request('resume',{revision:state.revision});if(adopt(v.state,token)){paused=false;await loop();}
  }catch(e){status(problem(e));}render();
 }
 async function stop(){
  if(!allowed()||!runId)return;paused=true;const token=epoch;
  try{const v=await request('stop');adopt(v.state,token);controller?.abort();status('Cikel je trajno ustavljen. Klic, katerega začetek je bil potrjen pred ustavitvijo, se lahko še odpošlje ali zaključi; rezervirana poraba ostane v evidenci.');}
  catch(e){status(problem(e));}render();
 }
 async function exportReport(format){
  if(!allowed()||!runId)return;const token=epoch;
  try{const v=await request('export');if(!adopt(v.state,token)||!allowed())return;
   const text=JSON.stringify(v.report,null,2)+'\n',sha=await digest(text);if(token!==epoch||!allowed())return;
   const payload=format==='md'?reportMarkdown(v.report,sha):text;
   const url=win.URL.createObjectURL(new Blob([payload],{type:format==='md'?'text/markdown;charset=utf-8':'application/json'})),a=doc.createElement('a');
   a.href=url;a.download='OmniCPQ_AI_ucenje_'+runId+'.'+format;a.click();win.setTimeout(()=>win.URL.revokeObjectURL(url),2000);
   status('Poročilo je pripravljeno za prenos. SHA-256 JSON: '+sha+'. Prenos ni dokaz prevzema pri graditelju ali namestitve znanja.');
  }catch(e){status(problem(e));}
 }
 async function open(){
  if(!allowed()){notice('AI učenje je na voljo preverjenemu lastniku.');return;}
  visible=true;paused=true;render();const token=epoch;
  try{
   const r=await win.fetch(ENDPOINT,{credentials:'same-origin',headers:{Accept:'application/json'}}),v=await r.json();
   if(token!==epoch||!allowed()||!visible)return;
   if(!r.ok||v.protocol!==LEARNING_PROTOCOL)throw Error();
   capability=v;$('learning-model').textContent='Tester: '+TESTER_PROFILE.model+' / '+TESTER_PROFILE.reasoning+' · dejanski model še UNKNOWN. Obstoječi profil pomočnika izbereš spodaj.';
   if(!runId){try{const p=JSON.parse(win.localStorage.getItem(key())||'null');if(p?.schema===LEARNING_PROTOCOL&&typeof p.runId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(p.runId))runId=p.runId;}catch{}}
   if(runId)await refresh();else status('Izberi vrsto preizkusov in meje, nato Začni. Odpiranje tega načina ne kliče modela ali CPQ.');
  }catch{if(token!==epoch||!allowed()||!visible)return;status('Povezave s krmilnikom učenja še ni mogoče potrditi. Preizkusi niso bili zagnani.');}
  if(token===epoch&&allowed()&&visible){if($('learning-kind').value==='api'&&(!state||TERMINAL.includes(state.status)))await refreshQuote();render();}
 }
 function hide(){quoteSerial++;preview=null;if(visible)epoch++;visible=false;paused=true;if(allowed()&&state?.status==='RUNNING')void pause();render();}
 function setAccess(value){access=value===true;if(!access){epoch++;quoteSerial++;preview=null;paused=true;visible=false;controller?.abort();state=null;capability=null;runId=null;}render();}
 $('learning-start').onclick=start;$('learning-pause').onclick=pause;$('learning-resume').onclick=resume;$('learning-stop').onclick=stop;$('learning-refresh').onclick=refresh;
 $('learning-export-json').onclick=()=>exportReport('json');$('learning-export-md').onclick=()=>exportReport('md');
 function settingsChanged(){
  quoteSerial++;preview=null;$('learning-cost-ack').checked=false;render();
  if(allowed()&&visible&&$('learning-kind').value==='api')return refreshQuote();
 }
 $('learning-kind').onchange=()=>{$('learning-tests').value=$('learning-kind').value==='api'?'1':'6';return settingsChanged();};
 for(const id of ['learning-profile','learning-tests','learning-minutes','learning-budget'])$(id).onchange=settingsChanged;
 $('learning-cost-ack').onchange=render;
 win.addEventListener('offline',()=>{quoteSerial++;preview=null;paused=true;controller?.abort();if(visible)status('Povezava je prekinjena. Po obnovi najprej preberi shranjeno stanje, brez samodejnega ponavljanja.');render();});
 win.addEventListener('pagehide',()=>{epoch++;quoteSerial++;preview=null;visible=false;paused=true;controller?.abort();});
 render();
 return {open,hide,setAccess,isBusy:()=>inflight,start,pause,resume,stop,refresh,get state(){return state;}};
}
