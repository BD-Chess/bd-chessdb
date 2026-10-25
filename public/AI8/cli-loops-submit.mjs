/* Owner-only preview/confirm submission. Credentials and topics are never persisted. */
const $=id=>document.getElementById(id),endpoint='/.netlify/functions/cli-loops-inbox',authEndpoint='/.netlify/functions/mdlxdcc-guide-auth';
let ready=false,busy=false,pending=null,uncertain=false;
const messages={AUTH_REQUIRED:'Za oddajo se prijavi kot lastnik.',OWNER_REQUIRED:'Oddaja je omogočena samo lastniku strani.',INBOX_NOT_CONFIGURED:'Povezava z zasebnim GitHub Inboxom še ni nastavljena.',PRIVATE_INBOX_REQUIRED:'Zasebni Inbox trenutno ni dosegljiv.',INBOX_BRANCH_MISSING:'GitHub Inbox še ni pripravljen.',GITHUB_AUTH_REQUIRED:'Dostop do GitHub Inboxa je treba obnoviti.',GITHUB_UNAVAILABLE:'GitHub trenutno ni dosegljiv.',SUBMISSION_UNCERTAIN:'Odgovor o zapisu ni potrjen. Preveri isti ID; ne ustvarjaj nove zahteve.',GITHUB_CONFLICT:'Za isti ID obstaja drugačen zapis. Oddaja je zadržana.',PLAN_CHANGED:'Načrt se je spremenil. Znova odpri pregled.',PREVIEW_EXPIRED:'Pregled načrta je potekel. Pripravi novega.',INVALID_TOPIC:'Dodaj veljavno temo; največ 64 KiB.',INVALID_LIMIT:'Preveri mejo potez, časa in proračuna.',INVALID_BUILD:'Preveri ciljni projekt, paket in aktivacijo.',UNSUPPORTED_PROFILE:'Izbrani profil na tem računalniku ni sprejet.',INVALID_LOGIN:'Prijava ni uspela.',INVALID_EMAIL:'Preveri e-poštni naslov.'};
const say=value=>{if($('inbox-status').textContent!==value)$('inbox-status').textContent=value;if($('inbox-plan').open)$('inbox-plan-status').textContent=value;};
const values=()=>({host:$('host').value,mode:$('mode').value,collaboration:$('collaboration').value,depth:$('depth').value,limit:$('limit').value,customLimit:$('custom-limit').value,customUnit:$('custom-unit').value,topic:$('topic').value,build:$('build').checked,buildProject:$('build-project').value,buildPackage:$('build-package').value,activate:$('activate').checked,calls:$('call-budget').value,tokens:$('token-budget').value,ext:$('ext').value,mal:$('mal').checked});
function controls(){
 $('submit-plan').disabled=!ready||busy||uncertain||!$('topic').value.trim();$('inbox-login-open').disabled=busy;$('inbox-confirm').disabled=busy||!pending;$('inbox-check').hidden=!uncertain;
}
async function api(url,options={}){
 let response;try{response=await fetch(url,{credentials:'same-origin',cache:'no-store',redirect:'error',signal:typeof AbortSignal.timeout==='function'?AbortSignal.timeout(55000):undefined,...options,headers:{'Content-Type':'application/json',...options.headers}});}catch{throw Object.assign(Error(),{code:'NETWORK_UNAVAILABLE'});}
 let data;try{data=await response.json();}catch{throw Object.assign(Error(),{code:'INBOX_UNAVAILABLE'});}if(!response.ok)throw Object.assign(Error(),{code:data.error?.code||'INBOX_UNAVAILABLE',status:response.status});return data;
}
async function session(){
 try{const state=await api(endpoint);ready=state.authenticated&&state.configured;$('inbox-login-open').hidden=state.authenticated;say(state.configured?'Pripravljeno za zasebno oddajo v izbrani GitHub Inbox.':messages.INBOX_NOT_CONFIGURED);}
 catch(error){ready=false;$('inbox-login-open').hidden=false;say(messages[error.code]||'Oddaje trenutno ni mogoče pripraviti. Kopiranje ukaza ostaja na voljo.');}controls();
}
function summary(req){
 const fields=[['Računalnik',req.target_host],['Profil',req.effort_mode],['Sodelovanje',req.full_rhp?'FullRHP · 6 sej':req.skeptics?'S · 4 seje':'2 avtorja'],['Globina',req.deep?'DEEP':'Običajna'],['Viri',req.projects?.includes('DRIVE')?'CLI modela sama poiščeta in prebereta potrebne datoteke v Drive.':'Po izbranem obsegu naloge'],['Meje',req.max_cli_turns+' potez / '+req.max_duration_s+' s aktivnega dela'],['Proračun',req.max_native_calls+' native klicev'+(req.max_tokens?' / '+req.max_tokens+' izmerjenih tokenov':'')],['Učinki',req.build_requested?'Gradnja '+req.build_target.project+' / '+req.build_target.package_name+(req.build_target.activate?' + AKTIVACIJA LISTENERJA':''):'Analiza'],['Rok sprejema',req.expires_utc],['ID zahteve',req.request_id],['Zasebnost','Zasebni GitHub Inbox; vsebina se ne objavi na tej strani.']];
 const list=$('inbox-plan-fields');list.replaceChildren();for(const [label,value] of fields){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;list.append(dt,dd);}
 $('inbox-plan-topic').textContent=req.topic;$('inbox-plan-hash').textContent=req.approval.plan_sha256;
}
$('inbox-login-open').addEventListener('click',()=>{$('inbox-login').showModal();$('inbox-email').focus();});
$('inbox-login-cancel').addEventListener('click',()=>$('inbox-login').close());
$('inbox-login-form').addEventListener('submit',async event=>{
 event.preventDefault();$('inbox-login-send').disabled=true;$('inbox-login-status').textContent='Prijavljam …';
 try{await api(authEndpoint,{method:'POST',body:JSON.stringify({action:'login',email:$('inbox-email').value,password:$('inbox-password').value})});await session();$('inbox-login').close();$('submit-plan').focus();}
 catch(error){$('inbox-login-status').textContent=messages[error.code]||'Prijava trenutno ni dosegljiva.';}
 finally{$('inbox-password').value='';$('inbox-login-send').disabled=false;}
});
$('submit-plan').addEventListener('click',async()=>{
 if(!ready||busy||uncertain)return;busy=true;controls();say('Pripravljam natančen načrt …');
 try{pending=await api(endpoint,{method:'POST',body:JSON.stringify({action:'preview',values:values()})});summary(pending.request);$('inbox-plan').showModal();$('inbox-plan-cancel').focus();say('Načrt je pripravljen. Oddaja sledi samo tvoji potrditvi.');}
 catch(error){say(messages[error.code]||'Pregleda ni mogoče pripraviti. Naloga ni bila oddana.');}
 finally{busy=false;controls();}
});
$('inbox-plan-cancel').addEventListener('click',()=>{if(!busy){$('inbox-plan').close();pending=null;say('Pregled je preklican. Zahteva ni bila oddana.');controls();$('submit-plan').focus();}});
$('inbox-plan').addEventListener('cancel',event=>{if(busy)event.preventDefault();else{pending=null;controls();}});
function remember(){try{sessionStorage.setItem('cli-loops-pending',JSON.stringify({id:pending.request.request_id,host:pending.request.target_host,sha:pending.request_sha256}));}catch{}}
function forget(){try{sessionStorage.removeItem('cli-loops-pending');}catch{}}
function success(receipt){
 uncertain=false;forget();$('inbox-plan').close();say('Zahteva '+receipt.request_id+' je zapisana v GitHub Inbox za '+receipt.target_host+'. Zagon Listenerja še ni potrjen.');
 const link=$('inbox-receipt');link.textContent='Odpri zasebni zapis zahteve ↗';link.href=receipt.url;link.hidden=false;$('inbox-new').hidden=false;$('submit-plan').disabled=true;
 pending=null;ready=false;
 link.focus();
}
$('inbox-confirm').addEventListener('click',async()=>{
 if(busy||!pending)return;busy=true;controls();remember();say('Oddajam zamrznjeni načrt …');
 try{const receipt=await api(endpoint,{method:'POST',body:JSON.stringify({action:'submit',request:pending.request,confirmation:pending.confirmation})});success(receipt);}
 catch(error){uncertain=['NETWORK_UNAVAILABLE','SUBMISSION_UNCERTAIN','INBOX_UNAVAILABLE','GITHUB_UNAVAILABLE'].includes(error.code);say(messages[error.code]||'Potrdila oddaje ni bilo mogoče prebrati. Preveri isti ID.');if(uncertain)$('inbox-plan').close();else forget();if(error.code==='AUTH_REQUIRED'){ready=false;$('inbox-plan').close();$('inbox-login-open').hidden=false;}}
 finally{busy=false;controls();}
});
$('inbox-check').addEventListener('click',async()=>{
 if(busy)return;busy=true;controls();
 try{let record;try{record=JSON.parse(sessionStorage.getItem('cli-loops-pending')||'null');}catch{}if(!record&&pending)record={id:pending.request.request_id,host:pending.request.target_host,sha:pending.request_sha256};if(!record)throw Error();
 const receipt=await api(endpoint+'?'+new URLSearchParams({action:'status',host:record.host,request_id:record.id}));
 if(receipt.state==='FOUND_GITHUB'){if(receipt.request_sha256!==record.sha)throw Object.assign(Error(),{code:'GITHUB_CONFLICT'});success({...receipt,url:'https://github.com/BD-Chess/8zListener-Inbox/blob/main/8zlistener/inbox/'+record.host+'/'+record.id+'.json'});}
 else{say('Zapis za ID '+record.id+' trenutno ni najden. Samodejne ponovne oddaje ni bilo.');$('inbox-new').hidden=false;}
 }catch(error){say(messages[error.code]||'Stanja oddaje trenutno ni mogoče potrditi. Isti ID ostaja shranjen.');}
 finally{busy=false;controls();}
});
$('inbox-new').addEventListener('click',()=>{pending=null;uncertain=false;forget();$('inbox-new').hidden=true;$('inbox-receipt').hidden=true;session();});
$('command-form').addEventListener('input',controls);$('command-form').addEventListener('change',controls);
try{if(sessionStorage.getItem('cli-loops-pending')){uncertain=true;say('Prejšnja oddaja ima shranjen ID. Najprej preveri njen zapis.');}}catch{}
session().then(()=>{if(uncertain)say('Prejšnja oddaja ima shranjen ID. Najprej preveri njen zapis.');});
