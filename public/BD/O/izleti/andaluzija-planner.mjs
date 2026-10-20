import {cities,clone,initialState,ensureDay,dayKey,reconcileLines,mapsForStop,mapsForLeg,segments} from './andaluzija-poi.mjs';
import {SharedTripStore} from './andaluzija-store.mjs';
import {DayOptimizer} from './andaluzija-optimize.mjs';
const root=document.getElementById('najini-ogledi'),$=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const canonical=['www.mdlxdcc.org','mdlxdcc.org','localhost','127.0.0.1'].includes(location.hostname);
const labels={locked:'Zaklenjeno · predlogi za branje',synced:'Naložena skupna različica',applied_local:'Lokalna sprememba · čaka na shranitev',saving:'Shranjujem …',saved:'Shranjeno',offline:'Čaka na povezavo · osnutek je šifriran',failed:'Shranjevanje ni uspelo',conflict:'Spor različic · oba osnutka sta ohranjena',local_unavailable:'Lokalne kopije ni bilo mogoče shraniti'};
root.innerHTML='<div class="section-heading"><div><p class="eyebrow">TRIPOPTI / VAJIN MESTNI RITEM</p><h2 id="poi-heading">Najini ogledi.</h2></div><p>En ogled na vrstico. Izberita mesto in dan, uredita svoj seznam, nato po želji preizkusita krožno pot.</p></div>'+
 '<div class="poi-access info-card"><div><b>Skupni izlet</b><p id="poi-host-message">'+(canonical?'Odklenita z obstoječim geslom. Vsak od vaju lahko ureja isti seznam.':'Za skupno urejanje odprite <a href="https://www.mdlxdcc.org/BD/O/izleti/andaluzija-2027.html#najini-ogledi">glavno stran izleta ↗</a>. Tukaj so predlogi za branje.')+'</p></div><form id="poi-login" '+(!canonical?'hidden':'')+'><label>Obstoječe geslo<input id="poi-password" type="password" autocomplete="current-password" maxlength="256" required></label><button type="submit">Odkleni izlet</button></form><button id="poi-lock" type="button" hidden>Zakleni</button><button id="poi-import-legacy" type="button" hidden>Uvozi prejšnje lokalne zapiske</button><p id="poi-status" role="status" aria-live="polite">Zaklenjeno · predlogi za branje</p><p id="poi-private-status" class="small muted"></p></div>'+
 '<div class="poi-selectors"><label>Različica<select id="poi-variant"><option value="mateja">A · Mateja</option><option value="claude">B · Claude</option><option value="gpt" selected>C · GPT</option></select></label><label>Dan<select id="poi-day"></select></label><label>Mesto<select id="poi-city"></select></label></div>'+
 '<p id="poi-city-note" class="muted"></p><div class="poi-layout"><div class="info-card"><label for="poi-lines"><b>Vajini ogledi · en ogled na vrstico</b></label><textarea id="poi-lines" rows="9" spellcheck="false"></textarea><p class="small muted">Osnovni predlogi so urejevalno izhodišče. Dodatki so izključeni; za en dan ni treba izbrati vseh.</p><p id="poi-error" role="alert"></p><details class="poi-settings"><summary>Začetek, odmori in lokacije</summary><div id="poi-entry"></div><label>Odmori v tem delu dneva (min)<input id="poi-breaks" type="number" min="0" max="480" step="5"></label><p class="small muted">Začetek je mestna vstopna točka. Prevoz iz nastanitve do nje je ločen.</p></details><div class="poi-actions"><button id="poi-save" type="button">Shrani</button><button id="poi-sync" type="button">Osveži skupni seznam</button><button id="poi-undo" type="button">Razveljavi svojo spremembo</button></div></div>'+
 '<div class="info-card"><h3>Predlog krožne poti</h3><label>Izračun<select id="poi-mode"><option value="estimate">Ocena po ravni črti · brez API</option><option value="walking">Peš razdalje · Google Maps</option></select></label><label>Odsek med določenimi termini<select id="poi-segment"></select></label><label class="poi-consent"><input id="poi-provider-consent" type="checkbox"> Dovolim izbrano Google poizvedbo; lahko se obračuna API.</label><p class="small muted">Za Google peš izračun poiščita in potrdita lokacije. Matrika se pridobi šele ob izračunu. Zračne razdalje so približek in niso peš poti. Ure prihodov in odprtost niso preverjene.</p><div class="poi-actions"><button id="poi-optimize" type="button">Uredi pot – DeepSearch</button><button id="poi-cancel" type="button" hidden>Prekliči</button></div><p id="poi-progress" role="status" aria-live="polite"></p><div id="poi-preview"></div><button id="poi-apply" type="button" hidden>Uporabi predlog</button><p class="small muted">Classical DeepSearch izboljšuje razdaljo; splošni globalni optimum ni dokazan. Določeni termini ostanejo na mestu. Krogi posameznih odsekov se vračajo na začetek; pravočasnost vstopnic preverita posebej.</p><p class="small"><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google zasebnost ↗</a> · <a href="https://www.google.com/intl/en/help/terms_maps/" target="_blank" rel="noopener noreferrer">Pogoji Google Maps ↗</a></p></div></div>'+
 '<div id="poi-conflict" class="info-card" hidden><h3>Druga različica je bila shranjena prej.</h3><p>Lokalne spremembe ostanejo ohranjene. Primerjajta seznama; posamezne želje lahko prepišeta po nalaganju skupne različice.</p><div id="poi-conflict-diff"></div><button id="poi-download-draft" type="button">Izvozi šifrirani osnutek</button><button id="poi-use-remote" type="button">Naloži skupno različico</button></div>'+
 '<div id="poi-stops" class="poi-stops"></div><p class="small muted">Imena in uradni viri preverjeni 20. 10. 2026; koordinate so približne točke za načrtovanje. Vhod, odpiralni čas, ceno in dostopnost za 2027 ponovno preverita. Trajanja so ocene. Povezave Maps delujejo tudi brez API ključa.</p>';
for(let i=0;i<10;i++)$('poi-day').add(new Option('Dan '+(i+1),i));
let local;try{local=globalThis.localStorage;}catch{local=null;}
let preview=null,editingTimer=null,saveTimer=null,unlocked=false,selection={variant:'gpt',day:0,city:'malaga'},editBaseline=[];
let running=false;
const optimizer=new DayOptimizer();
const store=new SharedTripStore({local,notify:e=>{
 $('poi-status').textContent=(labels[e.status]||e.status)+(e.updatedAt?' · '+new Date(e.updatedAt).toLocaleTimeString('sl-SI'):'')+' · rev. '+e.revision;
 $('poi-status').dataset.state=e.status;$('poi-conflict').hidden=e.status!=='conflict';
 if(e.status==='conflict')showConflict().catch(showError);
 window.dispatchEvent(new CustomEvent('andaluzija-trip-state',{detail:{status:e.status,revision:e.revision}}));
}});
const privateMounts=new Map([...document.querySelectorAll('.private-placeholder')].map(el=>[el.id,el.outerHTML]));
const scoped=()=>({variant:selection.variant,day:selection.day,city:selection.city});
const currentDay=()=>ensureDay(store.state,selection.variant,selection.day,selection.city);
function showError(e){$('poi-error').textContent=String(e.message||e);}
function clearPreview(){preview=null;$('poi-preview').replaceChildren();$('poi-apply').hidden=true;}
function scheduleSave(){clearTimeout(saveTimer);if(unlocked&&!store.conflict)saveTimer=setTimeout(()=>store.save().catch(showError),900);}
function scopeOps(ops){if(ops.some(op=>op.variant!==selection.variant||op.day!==selection.day||op.city!==selection.city))throw Error('Izberita ciljni dan, različico in mesto pred spremembo.');}
async function apply(ops,base=store.state.revision,id=crypto.randomUUID()){
 scopeOps(ops);store.state.selection=clone(selection);const r=await store.apply(ops,base,id);clearPreview();scheduleSave();return r;
}
function availableCities(){
 const day=window.ANDALUZIJA.variants[selection.variant].days[selection.day];
 return [...new Set([...(day.via||[]),day.city].filter(c=>cities[c]))];
}
function renderSelectors(){
 $('poi-variant').value=selection.variant;$('poi-day').value=String(selection.day);
 $('poi-city').innerHTML=availableCities().map(id=>'<option value="'+id+'">'+esc(cities[id].name)+'</option>').join('');
 if(!availableCities().includes(selection.city))selection.city=availableCities()[0];
 $('poi-city').value=selection.city;
}
function stopHTML(p,next,entry=false){
 const links=mapsForStop(p),loc=p.location.status==='unresolved'?'Lokacija še ni razrešena':p.location.status==='confirmed'?'Vajina potrjena točka':'Približna lokacija';
 return '<article class="poi-stop '+(!p.enabled?'poi-disabled':'')+'"><div class="poi-stop-top"><b>'+esc(p.name)+'</b>'+(!entry?'<label><input type="checkbox" data-poi="'+p.id+'" data-field="enabled" '+(p.enabled?'checked':'')+' '+(!unlocked?'disabled':'')+'> Vključen</label>':'<span>Začetek / konec kroga</span>')+'</div><div class="poi-maps"><a href="'+esc(links.place)+'" target="_blank" rel="noopener noreferrer">Pokaži kraj ↗</a><a href="'+esc(links.walk)+'" target="_blank" rel="noopener noreferrer">Peš do sem ↗</a>'+(next?'<a href="'+esc(mapsForLeg(p,next))+'" target="_blank" rel="noopener noreferrer">Peš do naslednje točke ↗</a>':'')+'</div><details><summary>Trajanje'+(p.fixedTime?' · '+esc(p.fixedTime):'')+', lokacija in vir</summary><div class="poi-fields">'+
 (entry?'<label>Ime začetka<input data-poi="'+p.id+'" data-field="name" value="'+esc(p.name)+'" maxlength="180" '+(!unlocked?'disabled':'')+'></label>':'')+(!entry?'<label>Ogled (min)<input data-poi="'+p.id+'" data-field="durationMin" type="number" min="0" max="720" value="'+p.durationMin+'" '+(!unlocked?'disabled':'')+'></label><label>Določena ura (neobvezno)<input data-poi="'+p.id+'" data-field="fixedTime" type="time" value="'+(p.fixedTime||'')+'" '+(!unlocked?'disabled':'')+'></label>':'')+
 '<label>Lokacija z mestom in državo<input data-poi="'+p.id+'" data-field="query" value="'+esc(p.location.query)+'" maxlength="300" '+(!unlocked?'disabled':'')+'></label><p class="small muted">'+loc+(optimizer.resolved.has(p.id)?' · Google lokacija potrjena za to sejo':'')+'. '+(p.optional?'Dodatek po izbiri. ':'')+'Urniki in cene za 2027 niso potrjeni.</p><button type="button" data-geocode="'+p.id+'" '+(!unlocked?'disabled':'')+'>Poišči lokacijo · Google</button><div data-location-choice="'+p.id+'"></div>'+
 (p.source?'<a href="'+esc(p.source)+'" target="_blank" rel="noopener noreferrer">Uradni vir ↗</a>':'')+'</div></details></article>';
}
function renderStops(){
 const d=currentDay(),active=d.stops.filter(p=>p.enabled),route=[d.entry,...active,d.entry];
 $('poi-stops').innerHTML=d.stops.map(p=>{const i=route.findIndex(x=>x.id===p.id);return stopHTML(p,i>=0?route[i+1]:null);}).join('');
 $('poi-entry').innerHTML=stopHTML(d.entry,active[0]||null,true);
 $('poi-breaks').value=d.breakMin;$('poi-breaks').disabled=!unlocked;
 const parts=segments(d);$('poi-segment').innerHTML=parts.map((ids,i)=>'<option value="'+i+'">Odsek '+(i+1)+' · '+ids.length+' ogledov</option>').join('');
 $('poi-city-note').textContent=cities[selection.city].note||'Krožni sprehod od izbrane mestne vstopne točke; trajanja lahko prilagodita.';
}
function announcePreferences(){if(unlocked)window.dispatchEvent(new CustomEvent('andaluzija-preferences-sync',{detail:clone(store.state.preferences||{})}));}
function render(){
 renderSelectors();const d=currentDay();editBaseline=clone(d.stops);
 $('poi-lines').value=d.stops.map(p=>p.name).join('\n');$('poi-lines').disabled=!unlocked;
 for(const id of ['poi-save','poi-sync','poi-undo'])$(id).disabled=!unlocked;
 $('poi-lock').hidden=!unlocked;$('poi-import-legacy').hidden=!unlocked||!legacyEntries().length;$('poi-login').hidden=unlocked||!canonical;renderStops();
}
async function commitEditor(){
 clearTimeout(editingTimer);if(!unlocked)return;
 const text=$('poi-lines').value,old=currentDay().stops;
 if(text===old.map(p=>p.name).join('\n'))return;
 try{
  const stops=reconcileLines(editBaseline,text,selection.city);
  await apply([{type:'replaceStops',...scoped(),stops}]);editBaseline=clone(stops);$('poi-error').textContent='';renderStops();
 }catch(e){showError(e);throw e;}
}
$('poi-lines').addEventListener('input',()=>{
 $('poi-status').textContent='Osnutek besedila · še ni shranjen';clearPreview();clearTimeout(editingTimer);
 editingTimer=setTimeout(()=>commitEditor().catch(()=>{}),500);
});
$('poi-lines').addEventListener('blur',()=>commitEditor().catch(()=>{}));
for(const id of ['poi-variant','poi-day','poi-city'])$(id).onchange=async()=>{
 try{await commitEditor();}catch{renderSelectors();return;}
 optimizer.cancel();clearPreview();selection={variant:$('poi-variant').value,day:Number($('poi-day').value),city:$('poi-city').value};renderSelectors();render();
};
$('poi-breaks').onchange=async()=>{try{await apply([{type:'setBreak',...scoped(),minutes:Number($('poi-breaks').value)}]);}catch(e){showError(e);}};
root.addEventListener('change',async e=>{
 const el=e.target,id=el.dataset.poi,field=el.dataset.field;if(!id||!field)return;
 try{
  const p=[currentDay().entry,...currentDay().stops].find(p=>p.id===id);let patch;
  if(field==='query'){optimizer.resolved.delete(id);patch={location:{query:el.value,status:'unresolved'}};}
  else patch={[field]:field==='enabled'?el.checked:field==='durationMin'?Number(el.value):el.value||null};
  await apply([{type:'patchStop',...scoped(),id,patch}]);renderStops();
 }catch(err){showError(err);}
});
root.addEventListener('click',async e=>{
 const b=e.target.closest('[data-geocode]');if(!b)return;
 if(!$('poi-provider-consent').checked){showError(Error('Najprej dovolita izbrano Google poizvedbo.'));return;}
 try{
  b.disabled=true;const id=b.dataset.geocode,p=[currentDay().entry,...currentDay().stops].find(x=>x.id===id),epoch=store.epoch;
  const results=await optimizer.geocode(p);if(!unlocked||epoch!==store.epoch)return;
  const host=root.querySelector('[data-location-choice="'+id+'"]');if(!host)return;
  host.replaceChildren();if(!results.length){host.textContent='Ni zadetkov. Dopolnita ime z mestom in državo.';return;}
  const select=document.createElement('select');select.setAttribute('aria-label','Izberi dejanski kraj');results.forEach((r,i)=>select.add(new Option(r.label,i)));
  const accept=document.createElement('button');accept.type='button';accept.textContent='Potrdi izbrano lokacijo';
  accept.onclick=async()=>{
   try{const r=results[Number(select.value)];optimizer.acceptLocation(id,r);
    // Place IDs may be retained; coordinates and returned address remain in memory.
    await apply([{type:'patchStop',...scoped(),id,patch:{location:{...p.location,placeId:r.placeId}}}]);renderStops();
   }catch(err){showError(err);}
  };host.append(select,accept);
 }catch(err){showError(err);}finally{if(b.isConnected)b.disabled=!unlocked;}
});
function sanitizePrivateHTML(value){
 const doc=new DOMParser().parseFromString(value,'text/html');
 doc.querySelectorAll('script,style,iframe,object,embed,base,meta,link,form,svg,math,template').forEach(x=>x.remove());
 for(const el of doc.querySelectorAll('*'))for(const attr of [...el.attributes]){
  if(attr.name.startsWith('on')||['srcdoc','formaction','style'].includes(attr.name)){el.removeAttribute(attr.name);continue;}
  if(['href','src'].includes(attr.name)){try{const u=new URL(attr.value,location.href);if(!['https:','http:'].includes(u.protocol)||u.protocol==='http:'&&!['localhost','127.0.0.1'].includes(u.hostname))el.removeAttribute(attr.name);}catch{el.removeAttribute(attr.name);}}
 }
 return doc.body.innerHTML;
}
async function openPrivate(password){
 const r=await fetch('./andaluzija-private.8zs.json',{cache:'no-store'});
 if(r.status===404){$('poi-private-status').textContent='Osebna vsebina še čaka na varno pripravo.';return;}
 if(!r.ok)throw Error('Osebne vsebine ni mogoče naložiti.');
 const e=await r.json();if(e.header?.domain!=='www.mdlxdcc.org'||e.header?.kind!=='sections')throw Error('PRIVATE_ENVELOPE');
 const epoch=store.epoch,value=await globalThis.ShieldCore.openEnvelope(e,password);
 if(!unlocked||epoch!==store.epoch)return;
 if(value.schema!=='andaluzija-private-content-v1'||value.tripId!=='andaluzija-2027')throw Error('PRIVATE_SCHEMA');
 for(const [id,html] of Object.entries(value.sections||{})){
  const target=id==='bd-choice'?$('private-choice'):$(id);
  if(target&&['bd-choice','potrjeno','leti-kritja','proracun','rezervacije'].includes(id)){
   const safe=sanitizePrivateHTML(html);if(id==='bd-choice')target.innerHTML=safe;else target.outerHTML=safe;
  }
 }
 window.dispatchEvent(new CustomEvent('andaluzija-content',{detail:{data:value.data,preferences:clone(store.state.preferences||{})}}));
 $('poi-private-status').textContent='Osebni del je odklenjen.';
}
function legacyEntries(){try{return Object.keys(local||{}).filter(k=>/^bd-andaluzija-2027-r1-(?:notes|check-[a-z]+|guest-count|car-pickup|car-rate|parking-rate|food-rate|ticket-rate|rate-[a-z]+|use-confirmed-bookings|flight-time)$/.test(k)).map(k=>[k,local.getItem(k)]).filter(([k,v])=>v!==null&&!(k in (store.state.preferences||{})));}catch{return [];}}
$('poi-import-legacy').onclick=async()=>{if(!unlocked)return;try{const entries=legacyEntries();if(!entries.length)return;store.state.preferences={...(store.state.preferences||{}),...Object.fromEntries(entries)};store.dirty=true;store.generation++;await store.persist();const saved=store.readLocal();if(!saved?.snapshot)throw Error('Lokalni šifrirani zapis ni potrjen.');for(const [k] of entries)local?.removeItem(k);announcePreferences();render();scheduleSave();}catch(e){showError(e);}};
$('poi-login').onsubmit=async e=>{
 e.preventDefault();const password=$('poi-password').value;$('poi-password').value='';
 try{
  const r=await fetch('/.netlify/functions/andaluzija-auth',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'login',password})});
  const b=await r.json();if(!r.ok||!b.authenticated)throw Error('Prijava ni uspela. Preverita geslo in povezavo.');
  await store.unlock(password);unlocked=true;selection=clone(store.state.selection);render();await openPrivate(password);
 }catch(err){if(!unlocked)store.lock();showError(err);}
};
function lock(){
 clearTimeout(editingTimer);clearTimeout(saveTimer);optimizer.clear();unlocked=false;running=false;clearPreview();store.lock();
 for(const [id,html]of privateMounts){const target=$(id);if(target)target.outerHTML=html;}
 if($('private-choice'))$('private-choice').replaceChildren();
 window.dispatchEvent(new CustomEvent('andaluzija-content',{detail:null}));
 $('poi-private-status').textContent='';$('poi-error').textContent='';$('poi-conflict-diff').replaceChildren();$('poi-conflict').hidden=true;$('poi-progress').textContent='';$('poi-cancel').hidden=true;render();
}
$('poi-lock').onclick=async()=>{lock();try{await fetch('/.netlify/functions/andaluzija-auth',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'logout'})});}catch{}};
$('poi-save').onclick=async()=>{try{await commitEditor();await store.save();}catch(e){showError(e);}};
$('poi-sync').onclick=async()=>{try{await commitEditor();await store.sync();if(!store.conflict){announcePreferences();render();}}catch(e){showError(e);}};
$('poi-undo').onclick=async()=>{try{await commitEditor();await store.undoLastOwnChange();render();scheduleSave();}catch(e){showError(e);}};
async function optimize(options={}){
 await commitEditor();clearPreview();const d=clone(currentDay()),scope=JSON.stringify(selection),mode=options.mode||$('poi-mode').value;
 if(mode==='walking'&&!$('poi-provider-consent').checked)throw Error('Najprej dovolita izbrani Google izračun.');
 running=true;$('poi-optimize').disabled=true;$('poi-cancel').hidden=false;
 try{
  const baseRevision=store.state.revision,generation=store.generation;
  const p=await optimizer.optimize(d,{...options,mode,segment:options.segment??Number($('poi-segment').value),baseRevision,generation,progress:s=>$('poi-progress').textContent=s});
  if(JSON.stringify(selection)!==scope||store.generation!==generation||store.state.revision!==baseRevision)throw Error('Seznam se je spremenil. Zaženita nov izračun.');
  preview=p;const m=p.metrics,order=p.ids.map(id=>d.stops.find(p=>p.id===id)).filter(p=>p.enabled);
  $('poi-progress').textContent='Predogled je pripravljen. Pot še ni uporabljena.';
  $('poi-preview').innerHTML='<p><b>'+esc(p.receipt.source)+'</b><br>'+Math.round(m.meters)+' m '+(m.kind==='estimate'?'po ravni črti · peš razdalja ni znana':'peš · Google Maps')+'<br>Premiki: '+(m.moveMin===null?'neznano':Math.ceil(m.moveMin)+' min (ocena ponudnika)')+' · ogledi v odseku: '+m.visitMin+' min (vajina ocena) · odmori: '+m.breakMin+' min (vajina ocena)</p><ol>'+order.map(p=>'<li>'+esc(p.name)+'</li>').join('')+'</ol>';
  $('poi-apply').hidden=!unlocked;return clone(p);
 }finally{running=false;$('poi-optimize').disabled=false;$('poi-cancel').hidden=true;}
}
$('poi-optimize').onclick=()=>optimize().catch(e=>{showError(e);$('poi-progress').textContent='Izračun ni spremenil načrta.';});
$('poi-cancel').onclick=()=>{optimizer.cancel();$('poi-progress').textContent='Preklicujem …';};
$('poi-apply').onclick=async()=>{
 try{
  if(!preview||preview.baseRevision!==store.state.revision||preview.generation!==store.generation)throw Error('Predogled je zastarel.');
  const p=preview;await apply([{type:'reorder',...scoped(),ids:p.ids,origin:'deep',receipt:p.receipt}],p.baseRevision);render();
 }catch(e){showError(e);}
};
async function showConflict(){
 const c=await store.inspectConflict();if(!c||!unlocked)return;
 const key=dayKey(selection.variant,selection.day,selection.city),local=c.local.days[key],remote=c.remote.days[key];
 $('poi-conflict-diff').innerHTML='<div><b>Vajina lokalna različica</b><pre>'+esc((local?.stops||[]).map(p=>p.name).join('\n')||'Brez ogledov')+'</pre></div><div><b>Skupna različica · rev. '+c.revision+'</b><pre>'+esc((remote?.stops||[]).map(p=>p.name).join('\n')||'Brez ogledov')+'</pre></div>';
}
function exportCipher(){
 if(!unlocked)throw Error('AUTH_REQUIRED');
 const value=store.readLocal();if(!value?.snapshot)throw Error('Šifrirani osnutek še ni pripravljen.');
 const url=URL.createObjectURL(new Blob([JSON.stringify(value)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='andaluzija-2027-sifrirani-osnutek.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('poi-download-draft').onclick=()=>{try{exportCipher();}catch(e){showError(e);}};
$('poi-use-remote').onclick=async()=>{try{await store.acceptRemote();selection=clone(store.state.selection);clearPreview();render();}catch(e){showError(e);}};
window.addEventListener('andaluzija-export-encrypted',()=>store.persist().then(exportCipher).catch(showError));
window.addEventListener('andaluzija-preference',async e=>{
 if(!unlocked)return;try{store.state.preferences={...(store.state.preferences||{}),[e.detail.key]:e.detail.value};store.dirty=true;store.generation++;await store.persist();scheduleSave();}catch(err){showError(err);}
});
window.addEventListener('pagehide',lock);
window.addEventListener('pageshow',e=>{if(e.persisted)lock();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&unlocked&&!running)store.sync().then(()=>{if(!store.dirty&&!store.conflict){announcePreferences();render();}}).catch(showError);});
window.addEventListener('online',()=>{if(unlocked)store.sync().then(()=>{if(!store.conflict)scheduleSave();}).catch(showError);});
function projection(){
 const s=store.getState();return {schema:s.schema,version:s.version,tripId:s.tripId,revision:s.revision,selection:clone(selection),days:s.days};
}
window.AndaluzijaTripOptiV1=Object.freeze({
 version:'1.0.0',
 getState:projection,
 getContext:()=>{const d=currentDay();return {schema:'andaluzija-ai-context-v1',tripId:'andaluzija-2027',revision:store.state.revision,selection:clone(selection),
  city:cities[selection.city].name,entry:{id:d.entry.id,name:d.entry.name},stops:d.stops.map(p=>({id:p.id,name:p.name,enabled:p.enabled,durationMin:p.durationMin,fixedTime:p.fixedTime,maps:mapsForStop(p)})),
  capabilities:{preview:true,optimize:true,write:unlocked&&!store.conflict,save:canonical&&unlocked},flightTimesVerified:false};},
 previewChanges:(ops,base)=>{scopeOps(ops);const r=store.preview(ops,base);return {status:r.status,diff:r.diff};},
 applyChanges:async(ops,base,requestId)=>{
  const r=await fetch('/.netlify/functions/andaluzija-auth',{credentials:'same-origin',cache:'no-store'});const b=await r.json();if(!r.ok||!b.authenticated||!unlocked)throw Error('AUTH_REQUIRED');
  const result=await apply(ops,base,requestId);render();return result;
 },
 optimizeDay:optimize,cancelOptimization:()=>optimizer.cancel(),
 save:()=>store.save(),sync:async()=>{const r=await store.sync();if(!store.conflict){announcePreferences();render();}return r;},
 undoLastOwnChange:async()=>{const r=await store.undoLastOwnChange();render();scheduleSave();return r;},
 mapsForStop:id=>{const d=currentDay(),p=[d.entry,...d.stops].find(p=>p.id===id);if(!p)throw Error('UNKNOWN_POI');return mapsForStop(p);},
 mapsForLeg:(a,b)=>{const d=currentDay(),p=[d.entry,...d.stops],from=p.find(p=>p.id===a),to=p.find(p=>p.id===b);if(!from||!to)throw Error('UNKNOWN_POI');return mapsForLeg(from,to);}
});
render();

