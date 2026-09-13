/* Private tri-mode cockpit. Research ciphertext is read-only. No private payload or password is persisted. */
(()=>{'use strict';
const $=id=>document.getElementById(id),te=new TextEncoder(),td=new TextDecoder('utf-8',{fatal:true});
const SESSION='wl-v2-session',API='/api/wl/managed',DRAFT='wl-bd-draft-ids-v1:';
const STALE_MS=75*60*1000,ACTIONS=['START','PAUSE','RESUME','STOP','PROLONG','PROLONG_AND_RESUME','SOFT_DELETE','RESTORE_FROM_ARCHIVE'];
let key=null,vault=null,controlPassword='',summary=null,managed=null,managedFresh=false,font=100,language='sl';
let generation=0,requestController=new AbortController(),timer=null,summaryFlight=false,managedFlight=false,serverOffset=0;
let filter='ALL',pending=null,commandBusy=false,createKind='NEW_WL',actionContext=null,refreshAt=null,legacySnapshot=null,legacyFlight=false;
const words={
 private:['BD × AI · ZASEBNO','BD × AI · PRIVATE'],gateIntro:['Raziskave, Legacy Wake Lab in prave email izmenjave. En zasebni cockpit, ločene zgodovine.','Research, Legacy Wake Lab and real email dialogues. One private cockpit, separate histories.'],
 password:['Geslo','Password'],show:['Pokaži','Show'],hide:['Skrij','Hide'],unlock:['Odkleni','Unlock'],lock:['Zakleni','Lock'],locked:['Zaklenjeno.','Locked.'],unlocking:['Odklepam …','Unlocking …'],unlockFailed:['Odklep ni uspel. Preveri geslo in povezavo.','Unlock failed. Check the password and connection.'],
 sessionNotice:['Začasni ključ iz istega zavihka odklene šifrirani povzetek. Za upravljanje je potrebno tudi geslo; ostane le v pomnilniku tega zavihka.','The temporary key from this tab unlocks the encrypted summary. Management also requires the password, held only in this tab’s memory.'],
 back:['← Glavni Wake Lab','← Main Wake Lab'],skip:['Na raziskave','Skip to runs'],refresh:['Osveži','Refresh'],headline:['Tri poti. En pregled.','Three paths. One overview.'],subtitle:['Novi WL, Legacy in email izmenjave imajo vsak svoj rok, dovoljenja in zgodovino.','New WL, Legacy and email dialogues each have their own deadline, permissions and history.'],
 controlHeading:['Dostop do upravljanja','Management access'],controlPassword:['Geslo za upravljanje','Management password'],authorize:['Omogoči upravljanje','Enable management'],controlMissing:['Upravljanje ni avtenticirano. Šifrirani povzetek je mogoče brati z začasnim ključem.','Management is not authenticated. The encrypted summary can be read with the temporary key.'],controlOK:['Dostop preverjen. Ukaze vedno preveri tudi strežnik in dejanska izvajalna pot.','Access verified. Commands are also checked by the server and the actual effect path.'],controlChecking:['Preverjam zasebni dostop …','Checking private access …'],
 runs:['Raziskave in izmenjave','Research and dialogues'],newMission:['Nova raziskava','New research'],newEmail:['Nova email izmenjava','New email dialogue'],all:['Vse','All'],newWL:['Novi WL','New WL'],emails:['Email izmenjave','Email dialogues'],legacy:['Legacy','Legacy'],archive:['Arhiv','Archive'],
 retryNotice:['Odgovor na ukaz še ni potrjen. Ponovni poskus uporabi isti ID; novega ukaza ne pošlji pred razrešitvijo.','The command response is not yet confirmed. Retry uses the same ID; resolve it before submitting another command.'],retry:['Preveri / ponovi isti ukaz','Check / retry the same command'],summaryHeading:['Šifrirana raziskovalna povzetka','Encrypted research summaries'],emailMessages:['Email sporočila','Email messages'],emailFrontier:['Email frontier','Email frontier'],rhpEvents:['WL/RHP dogodki','WL/RHP events'],wlFrontier:['WL frontier','WL frontier'],assessment:['Ocena','Assessment'],
 footer:['Prikaz časa: Europe/Ljubljana. Premor ne podaljša roka. Arhiviranje ustavi izvajanje in ohrani dokaze. Aktivnost, meritev in povzetek so ločeni podatki.','Times: Europe/Ljubljana. Pause does not extend the deadline. Archiving stops execution and retains evidence. Activity, measurement and summary are distinct.'],
 close:['Zapri','Close'],title:['Naslov','Title'],intent:['Ideja, vprašanje ali naloga','Idea, question or task'],duration:['Trajanje v dnevih (dan = 24 ur)','Duration in days (day = 24 hours)'],endOverride:['Ali točen konec (UTC; neobvezno)','Or exact end (UTC; optional)'],missionContract:['Naloga in dovoljeni viri','Mission and allowed sources'],missionType:['Vrsta raziskave','Research type'],concreteMission:['Konkretna naloga','Concrete Mission'],openResearch:['Odprta raziskava','Open research'],targetArtifact:['Ciljni rezultat / datoteka','Target result / artifact'],successTest:['Preverljiv kriterij uspeha','Verifiable success criterion'],sourceRequirements:['Zahtevani viri (en na vrstico)','Required sources (one per line)'],sourceScope:['Dovoljeni viri in obseg branja (en na vrstico)','Allowed sources and read scope (one per line)'],missionBoundary:['Zasebna raziskava, brez plačljivih klicev. Dovoljen učinek: raziskovanje. Objavo ali druge učinke je treba posebej odobriti.','Private research, no paid calls. Allowed effect: research. Publication and other effects need separate authorization.'],
 recipients:['Odobreni BD računi','Approved BD accounts'],selectRecipients:['Izberi prejemnike iz dovoljenega seznama','Choose recipients from the allowlist'],emailBoundary:['Samo odobreni BD računi. Izdelava zapisa sama ne pošlje sporočila; Start potrebuje potrjeno delujočo pot in dovoljenja.','Approved BD accounts only. Creating a record sends no message; Start requires a verified path and permissions.'],createDraft:['Ustvari osnutek','Create draft'],prolongWindow:['Podaljšanje roka','Extend deadline'],addDays:['Dodaj dni','Add days'],custom:['Po meri','Custom'],customEnd:['Točen novi rok (UTC)','Exact new deadline (UTC)'],confirm:['Potrdi','Confirm'],
 unknown:['Ni potrjenega podatka','No verified data'],noRuns:['Za ta filter ni zapisov.','No records for this filter.'],noAccess:['Za prikaz upravljanih raziskav omogoči zasebni dostop.','Enable private access to view managed runs.'],sourceUnavailable:['VIR NEDOSEGLJIV — podatki in upravljanje niso potrjeni.','SOURCE UNAVAILABLE — data and management are unverified.'],stale:['ZASTARELO','STALE'],partial:['DELNO','PARTIAL'],measured:['Zadnja meritev','Last measurement'],refreshed:['Osvežitev prikaza','Projection refresh'],serverTime:['Čas strežnika','Server time'],revision:['Revizija','Revision'],pulse:['Zadnji runtime pulse','Last runtime pulse'],controlObserved:['Zadnje veljavno opazovanje kontrol','Last valid control observation'],workerInvoked:['Zadnji potrjeni klic izvajalca','Last verified worker invocation'],acceptedEvent:['Zadnji sprejeti raziskovalni dogodek','Last accepted research event'],sourceFrontier:['Izvorni frontier','Source frontier'],started:['Prvotni začetek','Original start'],windowStarted:['Začetek upravljanega okna','Managed window start'],expires:['Rok (Europe/Ljubljana)','Deadline (Europe/Ljubljana)'],remaining:['Preostali čas','Time remaining'],activity:['Zadnja dejanska aktivnost','Last actual activity'],actor:['Trenutni / naslednji akter','Current / next actor'],lastRole:['Zadnji / naslednji pisec','Last / next writer'],blockReason:['Razlog / stanje poti','Reason / path status'],details:['Podrobnosti in dokazi','Details and evidence'],receipts:['Operativna potrdila','Operational receipts'],turns:['Sprejeti koraki','Accepted turns'],results:['Rezultati','Results'],rounds:['Zaključeni krogi odgovorov','Completed reply rounds'],highestTurn:['Najvišji veljavni turn','Highest valid turn'],delivery:['Dostava','Delivery'],coverage:['Pokritost virov','Source coverage'],lineage:['Izvor in niti','Lineage and threads'],artifacts:['Datoteke / rezultati','Files / artifacts'],tests:['Testi','Tests'],memory:['Session Memory','Session Memory'],wake:['Pot prebujanja','Wake path'],repair:['Popravilo / upravljano okno','Repair / managed window'],receipt:['Zadnje potrdilo','Last receipt'],recordID:['ID zapisa','Record ID'],missionID:['Mission / Lab','Mission / Lab'],noActions:['Za ta zapis ni potrjenih dovoljenih ukazov.','No allowed commands are verified for this record.'],createBlocked:['Nova ustvarjanja potrebujejo potrjene zmožnosti izvajalnega okolja.','New creations require verified runtime capabilities.'],deadlineReached:['Rok dosežen; preveri stanje strežnika.','Deadline reached; check server state.'],noWindow:['Okno še ni začeto.','Window has not started.'],summaryGenerated:['Povzetek izdelan','Summary generated'],summaryDerived:['Izvedeni povzetek; izvorno besedilo ostane nespremenjeno. To ni trenutno stanje izvajanja.','Derived summary; source text is unchanged. This is not current execution state.'],summaryReading:['Berem šifrirani povzetek …','Reading encrypted summary …'],summaryError:['Povzetka ni bilo mogoče preveriti.','The summary could not be verified.'],loading:['Preverjam aktualni zasebni vir …','Checking current private source …'],
 START:['Start','Start'],PAUSE:['Premor','Pause'],RESUME:['Nadaljuj','Resume'],STOP:['Ustavi','Stop'],PROLONG:['Podaljšaj','Prolong'],PROLONG_AND_RESUME:['Podaljšaj in nadaljuj','Prolong and resume'],SOFT_DELETE:['Izbriši / arhiviraj','Delete / archive'],RESTORE_FROM_ARCHIVE:['Obnovi iz arhiva','Restore from archive'],
 descSTART:['Začetek velja šele po strežniškem sprejemu in preverjeni izvajalni poti.','Start takes effect only after server acceptance and verified worker binding.'],descPAUSE:['Blokira nove korake in učinke. Rok ostane nespremenjen.','Blocks new turns and effects. The deadline is unchanged.'],descRESUME:['Nadaljuje samo z veljavnim rokom in dovoljenji.','Resumes only within a valid window and permissions.'],descSTOP:['Ustavi trenutno dovoljenje za izvajanje. Pozni rezultati ga ne smejo samodejno nadaljevati.','Stops the current execution grant. Late results must not restart it.'],descPROLONG:['Spremeni rok. Premor ali Stop ostaneta; nadaljevanje ni samodejno.','Changes the deadline. Pause or Stop remain; execution does not resume automatically.'],descPROLONG_AND_RESUME:['Izrecno podaljša rok in zaprosi za novo veljavno izvajanje.','Explicitly extends the deadline and requests a valid execution grant.'],descSOFT_DELETE:['Najprej ustavi izvajanje in zapis premakne v arhiv. Pošta, dnevnik in raziskovalni dokazi ostanejo.','Stops execution first and moves the record to the archive. Mail, journal and research evidence remain.'],descRESTORE_FROM_ARCHIVE:['Vrne zapis iz arhiva. Ne pomeni samodejnega nadaljevanja.','Restores the record from the archive. Does not automatically resume it.'],
 commandPending:['Pošiljam; čakam na potrdilo …','Submitting; waiting for receipt …'],commandOK:['Ukaz sprejet; osvežujem avtoritativno stanje.','Command accepted; refreshing authoritative state.'],commandFailed:['Ukaz ni sprejet','Command not accepted'],commandUnknown:['Izid ni potrjen. Uporabi ponovni poskus istega ukaza.','Outcome unconfirmed. Retry the same command.'],conflict:['Stanje se je spremenilo. Osveži in ponovno preglej ukaz.','State changed. Refresh and review the command again.'],draftRetry:['Prejšnja oddaja še nima potrjenega odgovora. Isti ID bo uporabljen za ponovni poskus; podatki morajo ostati enaki.','A previous submission has no confirmed response. Retry will reuse its ID; the contents must remain identical.'],invalidDate:['Vnesi veljaven prihodnji čas v UTC.','Enter a valid future time in UTC.'],invalidRecipients:['Izberi vsaj dva odobrena BD računa.','Choose at least two approved BD accounts.'],authFailed:['Dostop zavrnjen ali ni dosegljiv. Ponovno preveri geslo.','Access denied or unavailable. Check the password again.'],viewStale:['Prejšnji prikaz je ohranjen, ukazi so izklopljeni do preverjene osvežitve.','Previous view retained; commands are disabled until a verified refresh.'],missingReceipt:['Strežnik ni vrnil preverljivega potrdila.','Server did not return a verifiable receipt.']
};
const t=k=>(words[k]||[k,k])[language==='en'?1:0],b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function read(k){try{return sessionStorage.getItem(k)}catch{return null}}
function write(k,v){try{sessionStorage.setItem(k,v)}catch{}}
function erase(k){try{sessionStorage.removeItem(k)}catch{}}
function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(className)n.className=className;return n}
function textValue(v){if(v===null||v===undefined||v==='')return t('unknown');if(typeof v==='object')return JSON.stringify(v);return String(v)}
function value(...vals){return vals.find(v=>v!==null&&v!==undefined&&v!=='')}
function now(){return Date.now()+serverOffset}
function date(v){if(!v)return t('unknown');const n=new Date(v);return Number.isNaN(n.getTime())?t('unknown'):n.toLocaleString(language==='sl'?'sl-SI':'en-GB',{timeZone:'Europe/Ljubljana',timeZoneName:'short'})}
function age(v){const n=Date.parse(v);return Number.isFinite(n)?now()-n:Infinity}
function counter(v){return Number.isFinite(v)&&v>=0?new Intl.NumberFormat(language==='sl'?'sl-SI':'en-GB').format(v):t('unknown')}
function fact(dl,label,v){const d=node('div');d.append(node('dt',t(label)),node('dd',textValue(v)));dl.append(d)}
function remaining(v){if(!v)return t('noWindow');const ms=Date.parse(v)-now();if(!Number.isFinite(ms))return t('unknown');if(ms<=0)return t('deadlineReached');const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000);return Math.floor(h/24)+' d '+h%24+' h '+m+' min'}
function setFont(n){font=Math.max(70,Math.min(200,Math.round(Number.isFinite(n)?n:100)));document.documentElement.style.setProperty('--reader',font/100);$('reset').textContent=font+'%'}
function translate(){
 document.documentElement.lang=language;document.querySelectorAll('[data-i18n]').forEach(n=>{n.textContent=t(n.dataset.i18n)});
 $('language').textContent=language==='sl'?'EN':'SL';$('language').setAttribute('aria-label',language==='sl'?'Switch to English':'Preklopi v slovenščino');
 $('minus').setAttribute('aria-label',language==='sl'?'Manjša pisava':'Smaller text');$('plus').setAttribute('aria-label',language==='sl'?'Večja pisava':'Larger text');$('reset').setAttribute('aria-label',language==='sl'?'Privzeta velikost pisave':'Default text size');$('theme').setAttribute('aria-label',language==='sl'?'Zamenjaj temo':'Change theme');
 $('show').textContent=t($('pw').type==='password'?'show':'hide');renderControl();renderManaged();if(summary)renderSummary(summary);
}
async function sha(x){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',x))].map(v=>v.toString(16).padStart(2,'0')).join('')}
async function aes(raw){return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt'])}
async function openBox(box,k,aad){if(box.format!=='WL-ENC-2')throw Error('FORMAT');const c=b64(box.cipher);if(await sha(c)!==box.sha256)throw Error('INTEGRITY');return JSON.parse(td.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(box.iv),additionalData:te.encode(aad)},k,c)))}
async function fetchJSON(url,options={}){
 const r=await fetch(url,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:requestController.signal,...options});
 let data;try{data=await r.json()}catch{const e=Error('HTTP_'+r.status);e.status=r.status;throw e}
 if(!r.ok||data?.ok===false){const e=Error(String(data?.error?.code||data?.error||data?.reason||'HTTP_'+r.status));e.status=r.status;e.code=e.message;throw e}return data;
}
function clearView(message='',forget=true){
 generation++;requestController.abort();requestController=new AbortController();clearInterval(timer);timer=null;
 key=null;vault=null;controlPassword='';summary=null;managed=null;legacySnapshot=null;legacyFlight=false;pending=null;actionContext=null;managedFresh=false;commandBusy=false;summaryFlight=false;managedFlight=false;serverOffset=0;refreshAt=null;
 if(forget)erase(SESSION);
 ['create-dialog','action-dialog'].forEach(id=>{if($(id).open)$(id).close()});
 ['login','control-login','create-form','action-form'].forEach(id=>$(id).reset());
 // Clear both hidden and visible decrypted DOM, including receipt text and dialog context.
 ['generated','summary-freshness','emailCount','emailFrontier','rhpCount','rhpFrontier','emailTitle','emailOverview','emailSections','emailAssessment','rhpTitle','rhpOverview','rhpSections','rhpAssessment','status','managed-status','health-facts','run-list','control-state','creation-status','command-notice','email-recipients','create-heading','draft-status','create-error','action-heading','action-description','action-error'].forEach(id=>$(id).replaceChildren());
 $('summary-details').open=false;$('retry-panel').hidden=true;$('pw').value='';$('control-pw').value='';$('pw').type='password';$('show').textContent=t('show');
 $('create-mission').disabled=true;$('create-email').disabled=true;$('create-submit').disabled=false;$('action-submit').disabled=false;$('control-unlock').disabled=false;$('app').hidden=true;$('gate').hidden=false;$('error').textContent=message;
}
function renderControl(){const authenticated=Boolean(controlPassword&&managedFresh);$('control-state').textContent=t(authenticated?'controlOK':controlPassword?'controlChecking':'controlMissing');$('control-login').hidden=authenticated;}
function sectionNodes(list){return (Array.isArray(list)?list:[]).map(x=>{const d=node('div',undefined,'sub');d.append(node('h3',textValue(x.heading)),node('p',textValue(x.text)));return d})}
function renderSummary(s){
 const e=s.frontiers?.email||{},r=s.frontiers?.rhp||{};
 $('generated').textContent=t('summaryGenerated')+': '+date(s.generated_at_utc);
 $('summary-freshness').textContent=(age(s.generated_at_utc)>STALE_MS||(legacySnapshot&&legacySnapshot.event_id!==r.event_id)?t('stale')+' · ':'')+t('summaryDerived')+(legacySnapshot?' '+t('sourceFrontier')+': '+legacySnapshot.event_id:'');
 $('summary-freshness').classList.toggle('warning',age(s.generated_at_utc)>STALE_MS||Boolean(legacySnapshot&&legacySnapshot.event_id!==r.event_id));
 $('emailCount').textContent=counter(e.logical_messages);$('emailFrontier').textContent='A'+textValue(e.A_turn)+' · B'+textValue(e.B_turn);
 $('rhpCount').textContent=counter(r.events);$('rhpFrontier').textContent=textValue(r.event_id);
 for(const kind of ['email','rhp']){const q=s[kind]||{};$(kind+'Title').textContent=textValue(q.title);$(kind+'Overview').textContent=textValue(q.overview);$(kind+'Sections').replaceChildren(...sectionNodes(q.sections));$(kind+'Assessment').textContent=textValue(q.assessment)}
 $('status').textContent=t('sourceFrontier')+': email A'+textValue(e.A_turn)+'/B'+textValue(e.B_turn)+' · WL '+textValue(r.event_id)+'.';
}
async function loadSummary(){
 if(!key||summaryFlight)return;const g=generation,k=key;summaryFlight=true;$('status').textContent=t('summaryReading');
 try{const box=await fetchJSON('/WL/BD/summary.enc.json');const s=await openBox(box,k,'WL:BD:summary:v1');if(g!==generation||!key)return;if(s.schema!=='wl.bd.summary.v1')throw Error('SCHEMA');summary=s;renderSummary(s)}
 catch(e){if(g===generation&&e.name!=='AbortError'){$('status').textContent=t('summaryError');$('summary-freshness').textContent=t('stale')+' · '+t('summaryError');$('summary-freshness').classList.add('warning')}}
 finally{if(g===generation)summaryFlight=false}
}
function allowed(run,action){return Boolean(controlPassword&&managedFresh&&!pending&&!commandBusy&&Array.isArray(run.allowed_actions)&&run.allowed_actions.includes(action)&&(!['START','RESUME'].includes(action)||!run.expires_at||Date.parse(run.expires_at)>now()))}
function recipients(){const raw=managed?.capabilities?.email_recipients||managed?.capabilities?.recipient_allowlist||[];return Array.isArray(raw)?raw.filter(x=>typeof x==='string'||(x&&typeof x.id==='string')).map(x=>typeof x==='string'?{id:x,label:x}:x):[]}
function canCreate(kind){const cap=managed?.capabilities||{};return Boolean(managedFresh&&controlPassword&&!pending&&!commandBusy&&(kind==='NEW_WL'?cap.create_new_wl===true:cap.create_email_dialogue===true&&recipients().length>=2))}
function detailValue(v){if(Array.isArray(v))return v.length?v.map(textValue).join('\n'):t('unknown');return textValue(v)}
function makeRun(sourceRun){
 const run=sourceRun.run_kind==='LEGACY_WL'&&legacySnapshot?{...sourceRun,source_frontier:legacySnapshot.event_id,last_activity_at:legacySnapshot.updated_at,last_measured_at:legacySnapshot.measured_at,counters:{...sourceRun.counters,accepted_turns:legacySnapshot.event_count}}:sourceRun;
 const card=node('article',undefined,'card run-card'),top=node('div',undefined,'run-top'),heading=node('div');
 const kind={NEW_WL:'newWL',LEGACY_WL:'legacy',EMAIL_DIALOGUE:'emails'}[run.run_kind];heading.append(node('div',kind?t(kind):textValue(run.run_kind),'eyebrow'),node('h3',textValue(run.title||run.run_id)));
 const badge=node('span',textValue(run.status),'badge');if(['BLOCKED','EXPIRED','STOPPED','DELETED'].includes(run.status))badge.classList.add('problem');top.append(heading,badge);card.append(top);
 if(run.seed_summary||run.intent_summary)card.append(node('p',value(run.seed_summary,run.intent_summary),'muted'));
 if(run.block_reason||run.health?.block_reason||run.binding_status)card.append(node('p',t('blockReason')+': '+textValue(value(run.block_reason,run.health?.block_reason,run.binding_status)),'notice warning'));
 if(run.original_worker_status)card.append(node('p',run.original_worker_status+' · '+(language==='sl'?'Obstoječi izvajalec še ni upravljan s tem cockpitom.':'The existing worker is not yet managed by this cockpit.'),'notice warning'));
 const facts=node('dl',undefined,'facts'),c=run.counters||{};
 if(run.run_kind==='EMAIL_DIALOGUE'){
  fact(facts,'emailMessages',counter(value(c.unique_logical_messages,c.logical_messages,c.unique_messages)));
  fact(facts,'rounds',counter(value(c.completed_reply_rounds,c.completed_rounds)));
  fact(facts,'highestTurn',counter(value(c.highest_valid_turn,c.highest_turn,run.highest_valid_turn)));
  fact(facts,'lastRole',textValue(value(run.last_writer,run.last_role))+' / '+textValue(value(run.next_role,run.next_expected_role)));
  fact(facts,'delivery',value(run.delivery_state,run.email?.delivery_state));
 }else{
  fact(facts,'turns',counter(value(c.accepted_turns,c.accepted_events,c.events)));
  fact(facts,'results',counter(value(c.results,c.accepted_results,c.artifacts)));
  fact(facts,'actor',value(run.current_actor,run.next_actor,run.next_role));
  fact(facts,'sourceFrontier',value(run.accepted_frontier,run.frontier,run.source_frontier));
 }
 fact(facts,'activity',date(run.last_activity_at));fact(facts,'measured',date(run.last_measured_at));fact(facts,'started',date(run.started_at));fact(facts,'windowStarted',date(run.managed_window_started_at));fact(facts,'expires',date(run.expires_at));fact(facts,'remaining',remaining(run.expires_at));card.append(facts);
 if(age(run.last_measured_at)>STALE_MS)card.append(node('p',(run.last_measured_at?t('stale'):t('partial'))+' · '+t('measured')+': '+date(run.last_measured_at),'notice warning'));
 const details=node('details'),dl=node('dl',undefined,'facts');details.append(node('summary',t('details')));
 fact(dl,'recordID',run.run_id);fact(dl,'revision',textValue(run.revision)+' / epoch '+textValue(run.control_epoch));fact(dl,'receipt',run.last_receipt_ref);fact(dl,'wake',value(run.wake_mode,run.worker_profile?.wake_mode,run.worker_profile));fact(dl,'coverage',detailValue(value(run.source_coverage,run.source_scope)));
 if(run.run_kind==='NEW_WL'){
  fact(dl,'missionID',textValue(value(run.mission_id,run.mission?.mission_id))+' / '+textValue(run.lab_id));
  fact(dl,'targetArtifact',detailValue(value(run.target_artifact,run.mission?.target_artifact)));
  fact(dl,'artifacts',detailValue(run.artifacts));fact(dl,'tests',detailValue(run.tests));fact(dl,'memory',detailValue(run.memory));
 }else if(run.run_kind==='EMAIL_DIALOGUE')fact(dl,'lineage',detailValue(value(run.lineage_summary,run.lineage,run.email?.lineage)));
 else{fact(dl,'repair',value(run.repair_status,run.window_status));const link=node('a',t('back'));link.href='/WL/';details.append(link)}
 fact(dl,'pulse',date(value(run.health?.last_runtime_pulse_at,run.last_runtime_pulse_at)));fact(dl,'controlObserved',date(value(run.health?.last_control_observation_at,run.last_control_observation_at)));fact(dl,'workerInvoked',date(value(run.health?.last_worker_invocation_at,run.last_worker_invocation_at)));fact(dl,'acceptedEvent',date(value(run.health?.last_accepted_event_at,run.last_accepted_event_at)));fact(dl,'receipts',detailValue(run.receipts));details.append(dl);if(!run.projection_only){const loadButton=node('button',language==='sl'?'Preberi aktualne dokaze':'Read current evidence');loadButton.type='button';loadButton.addEventListener('click',()=>loadDetails(run.run_id,details,loadButton));details.append(loadButton)}card.append(details);
 const actions=node('div',undefined,'run-actions');let count=0;
 ACTIONS.filter(a=>run.status==='DELETED'?a==='RESTORE_FROM_ARCHIVE':a!=='RESTORE_FROM_ARCHIVE').forEach(action=>{if(!Array.isArray(run.allowed_actions)||!run.allowed_actions.includes(action))return;const b=node('button',t(action));b.type='button';b.disabled=!allowed(run,action);b.addEventListener('click',()=>openAction(run,action));actions.append(b);count++});
 if(!count)actions.append(node('p',t('noActions'),'notice'));card.append(actions);return card;
}
function renderManaged(){
 $('create-mission').disabled=!canCreate('NEW_WL');$('create-email').disabled=!canCreate('EMAIL_DIALOGUE');
 $('creation-status').textContent=(canCreate('NEW_WL')&&canCreate('EMAIL_DIALOGUE')?'':t('createBlocked'))+(managed?.capabilities?.new_run_note?' '+(language==='sl'?'Osnutki in upravljanje zapisov so na voljo; model in email pošiljatelj še nista aktivirana.':managed.capabilities.new_run_note):'')+(managed?.capabilities?.block_reason?' '+textValue(managed.capabilities.block_reason):'');
 $('run-list').setAttribute('aria-labelledby','tab-'+filter);
 if(!managed){$('run-list').replaceChildren(node('p',controlPassword?t('sourceUnavailable'):t('noAccess'),'empty'));return}
 const health=managed.health||{},dl=$('health-facts');dl.replaceChildren();
 fact(dl,'serverTime',date(managed.server_time));fact(dl,'refreshed',date(refreshAt));fact(dl,'revision',managed.revision);
 fact(dl,'pulse',date(value(health.last_runtime_pulse_at,health.last_pulse_at)));fact(dl,'controlObserved',date(value(health.last_control_observation_at,health.last_control_observed_at)));fact(dl,'workerInvoked',date(health.last_worker_invocation_at));fact(dl,'acceptedEvent',date(health.last_accepted_event_at));
 const state=textValue(value(health.status,managed.status,managedFresh?'OBSERVED':undefined));$('managed-status').textContent=(managedFresh?state:t('stale')+' · '+t('viewStale'))+' · '+t('refreshed')+': '+date(refreshAt);$('managed-status').classList.toggle('warning',!managedFresh||['PARTIAL','BLOCKED','STALE'].includes(state));
 const runs=managed.runs.filter(r=>filter==='ARCHIVE'?r.status==='DELETED':r.status!=='DELETED'&&(filter==='ALL'||r.run_kind===filter));
 $('run-list').replaceChildren(...(runs.length?runs.map(makeRun):[node('p',t('noRuns'),'empty')]));
}
async function loadManaged(){
 if(!key||!controlPassword||managedFlight)return;const g=generation;managedFlight=true;$('managed-status').textContent=t('loading');
 try{const m=await fetchJSON(API,{headers:{'x-wl-password':controlPassword}});if(g!==generation||!key)return;if(m.ok!==true||!Array.isArray(m.runs))throw Error('PROJECTION_SCHEMA');managed=m;managedFresh=true;const time=Date.parse(m.server_time);serverOffset=Number.isFinite(time)?time-Date.now():0;refreshAt=new Date().toISOString();
  for(const kind of ['NEW_WL','EMAIL_DIALOGUE']){const ids=parseIDs(kind);if(ids&&m.runs.some(r=>r.run_id===ids.run_id))erase(DRAFT+kind)}
  renderControl();renderManaged();
 }catch(e){if(g===generation&&e.name!=='AbortError'){managedFresh=false;if(e.status===401||e.status===403)controlPassword='';renderControl();renderManaged();$('managed-status').textContent=t('sourceUnavailable')+(managed?' '+t('viewStale'):'');$('managed-status').classList.add('warning')}}
 finally{if(g===generation)managedFlight=false}
}
async function loadDetails(runID,details,button){
 const g=generation;if(!controlPassword||!managedFresh)return;button.disabled=true;
 try{const d=await fetchJSON(API+'?run_id='+encodeURIComponent(runID),{headers:{'x-wl-password':controlPassword}});if(g!==generation||!key||!details.isConnected)return;
  const block=node('div',undefined,'sub'),dl=node('dl',undefined,'facts');
  fact(dl,'missionID',d.mission?.mission_id);fact(dl,'targetArtifact',detailValue(d.mission?.target_artifact));fact(dl,'turns',Array.isArray(d.accepted_events)?d.accepted_events.length:undefined);
  fact(dl,'artifacts',detailValue(d.accepted_events?.flatMap(e=>e.result?.artifacts||[e.artifact||e.artifact_ref]).filter(Boolean)));
  fact(dl,'tests',detailValue(d.accepted_events?.flatMap(e=>e.result?.tests||[e.test_receipts||e.test_receipt]).filter(Boolean)));
  fact(dl,'memory',detailValue(d.memory||managed?.memory));fact(dl,'receipts',detailValue(d.receipts?.map(r=>({command_id:r.command_id,action:r.action,result:r.result,created_at:r.created_at}))));
  fact(dl,'sourceFrontier',detailValue(d.replay?{event_count:d.replay.event_count,state_hash:d.replay.state_hash}:null));
  if(Array.isArray(d.accepted_events))for(const e of d.accepted_events)fact(dl,'acceptedEvent',e.event_id+' · '+date(e.accepted_at)+' · '+textValue(e.state_hash));block.append(dl);details.append(block);button.remove();
 }catch(e){if(g===generation&&key&&details.isConnected){button.disabled=false;details.append(node('p',t('sourceUnavailable'),'notice warning'))}}
}
async function loadLegacySnapshot(){
 if(!key||!vault||legacyFlight)return;const g=generation,k=key,vaultID=vault.vault_id;legacyFlight=true;
 try{const box=await fetchJSON('/WL/state.enc.json');const s=await openBox(box,k,'WL:state:'+vaultID);
  if(s.schema!=='wl.state.v2'||s.run_id!=='WL-RHP11-20260912'||!Array.isArray(s.entries)||!s.entries.length)throw Error('STATE_SCHEMA');
  for(let i=0;i<s.entries.length;i++){const e=s.entries[i];if(e.seq!==i+1||e.event_id!=='e'+String(i+1).padStart(6,'0')||e.path!=='data/entries/'+e.event_id+'.enc.json')throw Error('STATE_INDEX')}
  if(g!==generation||!key)return;if(legacySnapshot&&s.revision<legacySnapshot.revision)throw Error('STATE_REGRESSION');
  legacySnapshot={event_id:s.entries.at(-1).event_id,event_count:s.entries.length,revision:s.revision,updated_at:s.updated_at,measured_at:new Date().toISOString()};
  renderManaged();if(summary)renderSummary(summary);
 }catch(e){if(g===generation&&legacySnapshot){legacySnapshot.measured_at=null;renderManaged()}}
 finally{if(g===generation)legacyFlight=false}
}
async function refreshAll(){await Promise.allSettled([loadSummary(),loadManaged(),loadLegacySnapshot()])}
async function activate(rawKeyB64,openedVault,g,persist){
 const candidate=await aes(b64(rawKeyB64));await openBox(openedVault.control,candidate,'WL:control:'+openedVault.vault_id);if(g!==generation)return false;
 key=candidate;vault=openedVault;if(persist)write(SESSION,JSON.stringify({vault:openedVault.vault_id,key:rawKeyB64}));
 $('gate').hidden=true;$('app').hidden=false;$('error').textContent='';setFont(font);renderControl();renderManaged();clearInterval(timer);
 timer=setInterval(()=>{if(key&&!document.hidden){loadManaged();loadLegacySnapshot();if(summary)renderSummary(summary)}},60000);return true;
}
async function unlockWithPassword(){
 const g=++generation;requestController.abort();requestController=new AbortController();$('unlock').disabled=true;$('error').textContent=t('unlocking');
 let password=$('pw').value;$('pw').value='';
 try{const v=await fetchJSON('/WL/vault.json');if(v.format!=='WL-VAULT-2'||v.kdf?.name!=='PBKDF2-SHA256'||v.kdf.iterations<600000||v.kdf.iterations>2000000)throw Error('VAULT');
  const material=await crypto.subtle.importKey('raw',te.encode(password),'PBKDF2',false,['deriveKey']);const kek=await crypto.subtle.deriveKey({name:'PBKDF2',salt:b64(v.kdf.salt),iterations:v.kdf.iterations,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);const wrapped=await openBox(v.wrap,kek,'WL:wrap:'+v.vault_id);
  if(g!==generation)return;if(await activate(wrapped.key,v,g,true)){controlPassword=password;password='';await refreshAll()}
 }catch(e){if(g===generation)clearView(t('unlockFailed'),false)}finally{password='';$('unlock').disabled=false}
}
function newID(prefix){return prefix+'-'+crypto.randomUUID()}
function parseIDs(kind){try{const ids=JSON.parse(read(DRAFT+kind)||'null');return ids&&['command_id','run_id','lab_id','mission_id'].every(k=>typeof ids[k]==='string'&&/^[A-Za-z0-9-]{8,100}$/.test(ids[k]))?ids:null}catch{return null}}
function draftIDs(kind){let ids=parseIDs(kind);if(!ids){ids={command_id:newID('cmd'),run_id:newID(kind==='NEW_WL'?'wl':'email'),lab_id:newID('lab'),mission_id:newID('mission'),sent:false};write(DRAFT+kind,JSON.stringify(ids))}return ids}
function openCreate(kind){if(!canCreate(kind))return;createKind=kind;$('create-form').reset();$('create-error').textContent='';$('create-heading').textContent=t(kind==='NEW_WL'?'newMission':'newEmail');$('mission-fields').hidden=kind!=='NEW_WL';$('mission-fields').disabled=kind!=='NEW_WL';$('email-fields').hidden=kind!=='EMAIL_DIALOGUE';$('email-fields').disabled=kind!=='EMAIL_DIALOGUE';
 const ids=draftIDs(kind);$('draft-status').textContent=ids.sent?t('draftRetry')+' '+ids.run_id:'';
 $('email-recipients').replaceChildren(...recipients().map(r=>{const o=node('option',r.label||r.id);o.value=r.id;return o}));$('create-dialog').showModal();$('create-title').focus();
}
function utcInput(id){const v=$(id).value;if(!v)return null;const d=new Date(v+'Z');if(!Number.isFinite(d.getTime())||d.getTime()<=now())throw Error(t('invalidDate'));return d.toISOString()}
function lines(id){return $(id).value.split('\n').map(s=>s.trim()).filter(Boolean)}
function createCommand(){
 const ids=draftIDs(createKind),p={run_kind:createKind,title:$('create-title').value.trim(),seed:$('create-intent').value.trim(),duration_hours:Number($('create-days').value)*24};
 const end=utcInput('create-end');if(end)p.expires_at=end;
 if(createKind==='NEW_WL'){const scope=lines('source-scope');p.lab_id=ids.lab_id;p.source_scope=scope;p.mission={mission_id:ids.mission_id,intent:p.seed,target_outcome:$('target-artifact').value.trim(),target_artifact:{kind:'report',name:$('target-artifact').value.trim()},mission_type:$('mission-type').value,source_requirements:lines('source-requirements'),source_scope:scope,allowed_read_scope:scope,allowed_effect_scope:['RESEARCH'],privacy_class:'PRIVATE',cost_policy:'NO_PAID',success_criteria:[$('success-test').value.trim()],success_test:$('success-test').value.trim(),collaboration_mode:'RHP',release_scope:'PRIVATE',revision:1}}
 else{const allow=new Set(recipients().map(r=>r.id));p.recipients=[...$('email-recipients').selectedOptions].map(o=>o.value);if(p.recipients.length<2||p.recipients.some(r=>!allow.has(r)))throw Error(t('invalidRecipients'))}
 ids.sent=true;write(DRAFT+createKind,JSON.stringify(ids));return {command_id:ids.command_id,run_id:ids.run_id,action:'CREATE',expected_revision:0,expected_control_epoch:0,parameters:p};
}
function openAction(run,action){if(!allowed(run,action))return;actionContext={run_id:run.run_id,action,revision:run.revision,control_epoch:run.control_epoch};$('action-form').reset();$('action-heading').textContent=t(action)+' · '+textValue(run.title);$('action-description').textContent=t('desc'+action);$('action-error').textContent='';$('prolong-fields').hidden=!action.startsWith('PROLONG');$('prolong-end').disabled=true;$('prolong-end').required=false;$('action-dialog').showModal();$('action-submit').focus()}
async function sendCommand(command,isRetry=false){
 if(!key||!controlPassword||commandBusy||(!isRetry&&pending))return;const g=generation;commandBusy=true;pending=command;$('retry-panel').hidden=true;$('command-notice').textContent=t('commandPending');$('create-submit').disabled=true;$('action-submit').disabled=true;renderManaged();
 try{let result;
  if(isRetry||command.action==='CREATE'){try{result=await fetchJSON(API+'?command_id='+encodeURIComponent(command.command_id),{headers:{'x-wl-password':controlPassword}})}catch(e){if(e.status!==404)throw e}}
  if(!result)result=await fetchJSON(API,{method:'POST',headers:{'Content-Type':'application/json','x-wl-password':controlPassword},body:JSON.stringify(command)});if(g!==generation||!key)return;
  if(result.ok!==true||result.receipt?.command_id!==command.command_id||result.receipt?.run_id!==command.run_id){throw Error(t('missingReceipt'))}
  pending=null;if(command.action==='CREATE')erase(DRAFT+command.parameters.run_kind);$('command-notice').textContent=t('commandOK');for(const id of ['create-dialog','action-dialog'])if($(id).open)$(id).close();$('create-form').reset();actionContext=null;await loadManaged();
 }catch(e){if(g!==generation||e.name==='AbortError')return;const certain=Number.isInteger(e.status)&&e.status>=400&&e.status<500;
  if(certain){pending=null;if(command.action==='CREATE')erase(DRAFT+command.parameters.run_kind);$('command-notice').textContent=(e.status===409?t('conflict'):t('commandFailed')+': '+e.message);$('create-error').textContent=$('command-notice').textContent;$('action-error').textContent=$('command-notice').textContent;if(e.status===401||e.status===403){controlPassword='';managedFresh=false}await loadManaged()}
  else{$('command-notice').textContent=t('commandUnknown');$('retry-panel').hidden=false;$('create-error').textContent=t('commandUnknown');$('action-error').textContent=t('commandUnknown')}
 }finally{if(g===generation){commandBusy=false;$('create-submit').disabled=Boolean(pending);$('action-submit').disabled=Boolean(pending);renderControl();renderManaged()}}
}
$('login').addEventListener('submit',e=>{e.preventDefault();unlockWithPassword()});
$('control-login').addEventListener('submit',async e=>{e.preventDefault();if(!key)return;const g=generation;controlPassword=$('control-pw').value;$('control-pw').value='';$('control-unlock').disabled=true;await loadManaged();if(g===generation){$('control-unlock').disabled=false;if(!managedFresh)$('control-state').textContent=t('authFailed')}});
$('show').addEventListener('click',()=>{$('pw').type=$('pw').type==='password'?'text':'password';$('show').textContent=t($('pw').type==='password'?'show':'hide')});
$('minus').onclick=()=>setFont(font-10);$('plus').onclick=()=>setFont(font+10);$('reset').onclick=()=>setFont(100);$('theme').onclick=()=>document.documentElement.dataset.theme=document.documentElement.dataset.theme==='light'?'dark':'light';$('language').onclick=()=>{language=language==='sl'?'en':'sl';translate()};
$('refresh').onclick=refreshAll;$('lock').onclick=()=>{clearView(t('locked'),true);$('pw').focus()};
$('create-mission').onclick=()=>openCreate('NEW_WL');$('create-email').onclick=()=>openCreate('EMAIL_DIALOGUE');
$('create-close').onclick=()=>{$('create-dialog').close();$('create-form').reset()};$('action-close').onclick=()=>{$('action-dialog').close();actionContext=null};
$('create-form').addEventListener('submit',e=>{e.preventDefault();if(!$('create-form').reportValidity()||!canCreate(createKind))return;try{sendCommand(createCommand())}catch(err){$('create-error').textContent=err.message}});
$('action-form').addEventListener('submit',e=>{e.preventDefault();if(!$('action-form').reportValidity()||!actionContext||!managedFresh)return;const c=actionContext,p={};try{if(c.action.startsWith('PROLONG')){if($('prolong-days').value==='custom'){p.expires_at=utcInput('prolong-end');if(!p.expires_at)throw Error(t('invalidDate'));}else p.duration_hours=Number($('prolong-days').value)*24}sendCommand({command_id:newID('cmd'),run_id:c.run_id,action:c.action,expected_revision:c.revision,expected_control_epoch:c.control_epoch,parameters:p})}catch(err){$('action-error').textContent=err.message}});
$('prolong-days').addEventListener('change',()=>{const custom=$('prolong-days').value==='custom';$('prolong-end').disabled=!custom;$('prolong-end').required=custom});
$('retry-command').onclick=()=>{if(pending)sendCommand(pending,true)};
const tabs=[...document.querySelectorAll('[data-filter]')];function selectTab(tab){filter=tab.dataset.filter;tabs.forEach(n=>{const chosen=n===tab;n.setAttribute('aria-selected',String(chosen));n.tabIndex=chosen?0:-1});renderManaged()}
for(const tab of tabs){tab.onclick=()=>selectTab(tab);tab.addEventListener('keydown',e=>{let i=tabs.indexOf(tab);if(e.key==='ArrowRight')i=(i+1)%tabs.length;else if(e.key==='ArrowLeft')i=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')i=0;else if(e.key==='End')i=tabs.length-1;else return;e.preventDefault();selectTab(tabs[i]);tabs[i].focus()})}
$('create-dialog').addEventListener('cancel',()=>{$('create-form').reset()});$('action-dialog').addEventListener('cancel',()=>{actionContext=null});
document.addEventListener('visibilitychange',()=>{if(key&&!document.hidden)refreshAll()});
window.addEventListener('pagehide',()=>clearView('',false));
translate();
(async()=>{const g=generation;try{const s=JSON.parse(read(SESSION)||'null');if(!s||!s.vault||!s.key)return;const v=await fetchJSON('/WL/vault.json');if(v.format!=='WL-VAULT-2'||s.vault!==v.vault_id)throw Error('VAULT');if(await activate(s.key,v,g,false))await Promise.allSettled([loadSummary(),loadLegacySnapshot()])}catch{if(g===generation)clearView('',true)}})();
})();
