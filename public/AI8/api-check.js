(function () {
  'use strict';
  const A = window.BDAPI;
  const $ = s => document.querySelector(s);
  const cards = new Map(), results = new Map();
  let running = false, importing = false, stopRequested = false, activeController = null, requestsIssued = 0;
  const stateLabels = {pass:'Deluje',attention:'Za pregled',error:'Napaka',unknown:'Neznano',running:'Preverjam …'};
  const authLabels = {accepted:'API je sprejel zahtevo',rejected:'Ni sprejet za to pot',unknown:'Ni potrjeno'};
  const modelLabels = {response_received:'Prejet odgovor',unknown:'Ni potrjeno'};
  function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  function link(label, url) { const a = el('a','',label + ' ↗'); a.href=url; a.target='_blank'; a.rel='noopener noreferrer'; return a; }
  function note(message, tone) { $('#notice').textContent=message; $('#notice').dataset.tone=tone || ''; }
  function secrets() { return [...cards.values()].map(c => c.key.value.trim()).filter(Boolean); }
  function config(c) { return {id:c.provider.id,model:c.model.value.trim(),endpoint:c.endpoint.value.trim(),type:c.type.value}; }
  function reset(c) { if (!running) { results.delete(c.provider.id); renderResult(c,null); updateCounts(); } }
  function field(label, input) { const l = el('label','',label); l.append(input); return l; }
  function input(type, id, value) { const i = el('input'); i.type=type; i.id=id; i.value=value || ''; i.autocomplete='off'; i.spellcheck=false; i.setAttribute('autocapitalize','none'); return i; }
  function buildCard(p) {
    const card = el('article','provider'); card.dataset.provider=p.id; card.dataset.state='unrun';
    card.style.setProperty('--brand-color',p.color); card.style.setProperty('--brand-bg',p.color+'14'); card.style.setProperty('--brand-line',p.color+'30');
    const head = el('div','provider-head');
    const select = input('checkbox','select-'+p.id); select.checked=true; select.setAttribute('aria-label','Izberi '+p.name);
    const logo = el('span','provider-logo',p.mark); logo.setAttribute('aria-hidden','true');
    const selectLabel = el('label','provider-select'); selectLabel.append(select,logo);
    const title = el('div','provider-title'), name = el('h3','provider-name',p.name); name.id='title-'+p.id; title.append(name,el('span','provider-vendor',p.vendor));
    card.setAttribute('aria-labelledby',name.id);
    const badge = el('span','badge','Ni preverjeno'); head.append(selectLabel,title,badge); card.append(head);
    const body = el('div','provider-body'), credentials = el('div','credentials');
    const model = input('text','model-'+p.id,p.model); model.maxLength=200;
    const key = input('password','key-'+p.id); key.placeholder='Vnesi API ključ'; key.maxLength=8192; key.setAttribute('data-lpignore','true'); key.setAttribute('data-1p-ignore','true');
    key.setAttribute('aria-label',p.name+' API ključ');
    const keyLabel = el('label','','API ključ'); keyLabel.htmlFor=key.id;
    const wrap = el('span','key-wrap'), reveal = el('button','reveal','Pokaži'); reveal.type='button'; reveal.setAttribute('aria-label','Pokaži ključ za '+p.name); reveal.setAttribute('aria-pressed','false');
    reveal.addEventListener('click',function () { const shown = key.type==='password'; key.type=shown?'text':'password'; reveal.textContent=shown?'Skrij':'Pokaži'; reveal.setAttribute('aria-pressed',String(shown)); reveal.setAttribute('aria-label',(shown?'Skrij':'Pokaži')+' ključ za '+p.name); });
    wrap.append(key,reveal); keyLabel.append(wrap); credentials.append(field('ID modela',model),keyLabel); body.append(credentials);
    const route = el('details','route-details'), routeSummary = el('summary','','API format & naslov'); route.append(routeSummary);
    const routeFields = el('div','route-fields'), type = el('select'); type.id='type-'+p.id;
    [['openai_chat','OpenAI Chat Completions'],['openai_responses','OpenAI Responses'],['anthropic_messages','Anthropic Messages'],['gemini_generate','Gemini generateContent']].forEach(([v,label]) => { const o=el('option','',label); o.value=v; type.append(o); }); type.value=p.type;
    const endpoint = input('text','endpoint-'+p.id,p.endpoint); endpoint.maxLength=1000;
    routeFields.append(field('API format',type),field('Endpoint',endpoint),el('p','route-note',p.note+' Začetni modeli so iz nastavitev MAL; njihova trenutna razpoložljivost se preveri s testom.')); route.append(routeFields); body.append(route);
    const result = el('div','result'); body.append(result); card.append(body);
    const footer = el('div','provider-footer'); footer.append(link('API ključi',p.keys),link('Poraba / plačila',p.billing),link('Konzola',p.console),link('Pomoč',p.help)); card.append(footer);
    const c = {provider:p,card,select,model,key,reveal,type,endpoint,badge,result};
    for (const control of [key,model,endpoint,type]) control.addEventListener(control===type?'change':'input',() => reset(c));
    select.addEventListener('change',updateCounts); renderResult(c,null); return c;
  }
  function detailRow(dl, label, value) { dl.append(el('dt','',label),el('dd','',value || '—')); }
  function renderResult(c, r) {
    c.result.replaceChildren(); c.card.dataset.state=r?.state || 'unrun'; c.result.dataset.state=r?.state || 'unrun';
    c.badge.textContent=r ? stateLabels[r.state] || 'Za pregled' : 'Ni preverjeno';
    const heading = el('div','result-heading'), strong = el('strong','',r?.title || 'Čaka na prvi test');
    const test = el('button','test-one','Preveri ↗'); test.type='button'; test.disabled=running; test.setAttribute('aria-label','Preveri '+c.provider.name); test.addEventListener('click',() => run([c]));
    heading.append(strong,test); c.result.append(heading);
    c.result.append(el('p','',r?.detail || 'Ključ se uporabi šele po kliku. Rezultat še ni znan.'));
    if (!r || r.state==='running') return;
    if (r.next) c.result.append(el('p','next',r.next));
    const metrics = el('div','result-metrics');
    if (r.http_status) metrics.append(el('span','','HTTP '+r.http_status));
    if (typeof r.latency_ms==='number') metrics.append(el('span','',(r.latency_ms/1000).toLocaleString('sl-SI',{maximumFractionDigits:2})+' s'));
    if (r.usage?.total !== null && r.usage?.total !== undefined) metrics.append(el('span','',r.usage.total+' tokenov (API)'));
    if (r.actual_model) metrics.append(el('span','','Vrnjeni model: '+r.actual_model));
    if (metrics.childNodes.length) c.result.append(metrics);
    const details = el('details','result-details'); details.append(el('summary','','Podrobnosti & odgovor'));
    const dl = el('dl');
    detailRow(dl,'Testirano',r.finished_at ? new Date(r.finished_at).toLocaleString('sl-SI') : '—');
    detailRow(dl,'Ključ',authLabels[r.authentication] || 'Ni potrjeno');
    detailRow(dl,'Dostop do modela',modelLabels[r.model_access] || 'Ni potrjeno');
    detailRow(dl,'Zahtevani model',r.requested_model); detailRow(dl,'Vrnjeni model',r.actual_model || 'API ga ni sporočil');
    detailRow(dl,'Povezava',r.transport==='direct'?'Neposredno iz brskalnika':'MAL posrednik');
    detailRow(dl,'Endpoint',r.endpoint); detailRow(dl,'API format',r.api_type);
    detailRow(dl,'Dobroimetje','Ni izmerjeno · preveri konzolo'); detailRow(dl,'Cena testa','Ni izmerjena · preveri porabo');
    detailRow(dl,'Vhod / izhod',r.usage ? (r.usage.input ?? '—')+' / '+(r.usage.output ?? '—')+' tokenov' : 'API ni sporočil');
    if (r.usage?.reasoning !== null && r.usage?.reasoning !== undefined) detailRow(dl,'Razmišljanje',r.usage.reasoning+' tokenov (API)');
    if (r.finish) detailRow(dl,'Zaključek',r.finish);
    if (r.provider_code) detailRow(dl,'Koda ponudnika',r.provider_code);
    if (r.request_id) detailRow(dl,'ID odgovora',r.request_id);
    details.append(dl);
    if (r.text) { details.append(el('p','','Besedilo odgovora'),el('pre','',r.text)); }
    if (r.provider_message) { details.append(el('p','','Sporočilo napake'),el('pre','',r.provider_message)); }
    if (r.diagnostic) { details.append(el('p','','Očiščen odgovor API (brez ključev)'),el('pre','',JSON.stringify(r.diagnostic,null,2).slice(0,32000))); }
    c.result.append(details);
  }
  function updateCounts() {
    const values = [...results.values()];
    $('#count-pass').textContent=values.filter(r => r.state==='pass').length;
    $('#count-attention').textContent=values.filter(r => ['attention','error','unknown'].includes(r.state)).length;
    $('#count-pending').textContent=A.PROVIDERS.length-values.filter(r => r.state!=='running').length;
    const selected = [...cards.values()].filter(c => c.select.checked).length;
    $('#selected-count').textContent=selected;
    $('#run-selected').disabled=running || importing || selected===0;
    $('#export').disabled=values.every(r => r.state==='running');
    $('#key-count').textContent=secrets().length+' / 10 ključev vnesenih';
  }
  function lock(value) {
    running=value;
    for (const c of cards.values()) for (const n of [c.select,c.model,c.key,c.endpoint,c.type,c.reveal,...c.card.querySelectorAll('.test-one')]) n.disabled=value;
    for (const id of ['import','clear-keys','select-ready','select-all','select-none','transport','token-cap']) $('#'+id).disabled=value;
    $('#stop').disabled=!value;
    updateCounts();
  }
  function nonce() { const bytes = new Uint8Array(12); crypto.getRandomValues(bytes); return 'BD_API_SMOKE_OK_'+Array.from(bytes,b => b.toString(16).padStart(2,'0')).join(''); }
  async function run(chosen) {
    if (running || importing || !chosen.length) return;
    stopRequested=false; lock(true);
    const transport = $('#transport').value, cap = Number($('#token-cap').value);
    let attempted=0, invalid=0;
    try {
      for (const c of chosen) {
        if (stopRequested) break;
        const cfg = config(c), key = c.key.value.trim();
        const meta = {id:c.provider.id,provider:c.provider.name,requested_model:cfg.model,endpoint:cfg.endpoint,api_type:cfg.type,transport,started_at:new Date().toISOString()};
        try { A.validate(cfg,key); } catch (e) {
          const r = A.redact({...meta,finished_at:new Date().toISOString(),state:'attention',category:'configuration',title:'Najprej dopolni nastavitve',detail:e.message,next:'Zahteva ni bila poslana.',authentication:'unknown',balance:'unknown'},secrets());
          results.set(c.provider.id,r); renderResult(c,r); invalid++; updateCounts(); continue;
        }
        const progress = {...meta,state:'running',title:'Čakam na ponudnika …',detail:'Ena zahteva, brez samodejne ponovitve.'};
        results.set(c.provider.id,progress); renderResult(c,progress); updateCounts();
        note('Preverjam '+c.provider.name+' · '+(attempted+1)+' / '+chosen.length+' · največ en klic hkrati.');
        activeController = new AbortController(); let timedOut=false;
        const timer = setTimeout(() => { timedOut=true; activeController?.abort(); },60000);
        let r;
        try {
          const checkNonce = nonce();
          requestsIssued++; attempted++;
          r = await A.perform(cfg,key,{transport,cap,nonce:checkNonce,signal:activeController.signal},window.fetch.bind(window));
        } finally { clearTimeout(timer); activeController=null; }
        if (timedOut) r.title='Časovna meja je potekla';
        r=A.redact({...meta,...r,finished_at:new Date().toISOString()},secrets());
        results.set(c.provider.id,r); renderResult(c,r); updateCounts();
      }
      $('#last-run').textContent='Zadnji pregled: '+new Date().toLocaleTimeString('sl-SI',{hour:'2-digit',minute:'2-digit'})+' · poslanih zahtev v tej seji: '+requestsIssued;
      note(stopRequested?'Ustavljeno. Novi testi niso bili poslani. Prekinjena zahteva je morda že ustvarila porabo.':'Pregled končan · '+attempted+' poslanih zahtev'+(invalid?' · '+invalid+' brez klica zaradi nastavitev':'')+'. Izvoz vsebuje rezultate brez ključev.',stopRequested?'':'success');
    } catch (_) { note('Pregled se je prekinil. Stanje zadnje zahteve preveri v konzoli ponudnika. Noben test se ne ponovi sam.','error'); }
    finally { lock(false); }
  }
  function settings() {
    const direct=$('#transport').value==='direct';
    $('#settings-summary').textContent=(direct?'Neposredno':'MAL posrednik')+' · do '+$('#token-cap').value+' izhodnih tokenov';
    $('#transport-help').textContent=direct?'Ključ se pošlje neposredno izbranemu ponudniku. Nekateri API-ji blokirajo brskalnik (CORS). Stran v tem primeru ne bo samodejno poskusila druge povezave.':'Zahteva in ključ se za izvedbo preneseta prek obstoječega MAL posrednika na mdlxdcc.org do izbranega ponudnika. Stran ju ne shranjuje.';
  }
  A.PROVIDERS.forEach(p => { const c=buildCard(p); cards.set(p.id,c); $('#providers').append(c.card); });
  $('#run-selected').addEventListener('click',() => run([...cards.values()].filter(c => c.select.checked)));
  $('#stop').addEventListener('click',() => { stopRequested=true; activeController?.abort(); $('#stop').disabled=true; note('Ustavljam pregled. Trenutna zahteva je morda že dosegla ponudnika.'); });
  for (const [id,predicate] of [['select-ready',c => !!c.key.value.trim()],['select-all',() => true],['select-none',() => false]]) $('#'+id).addEventListener('click',() => { for (const c of cards.values()) c.select.checked=predicate(c); updateCounts(); });
  $('#clear-keys').addEventListener('click',() => { for (const c of cards.values()) { c.key.value=''; c.key.type='password'; c.reveal.textContent='Pokaži'; c.reveal.setAttribute('aria-pressed','false'); c.reveal.setAttribute('aria-label','Pokaži ključ za '+c.provider.name); } updateCounts(); note('Ključi so odstranjeni iz te strani. Rezultati ostanejo brez ključev. Za nov test jih vnesi znova.'); });
  $('#transport').addEventListener('change',settings); $('#token-cap').addEventListener('change',settings);
  $('#import').addEventListener('click',() => { $('#import-files').value=''; $('#import-files').click(); });
  $('#import-files').addEventListener('change',async function () {
    if (running || importing) return;
    importing=true; updateCounts(); $('#import').disabled=true; $('#clear-keys').disabled=true;
    let imported=0, ignored=0; const updated=new Set();
    try {
      for (const file of [...this.files].slice(0,40)) {
        if (file.size>250000) { ignored++; continue; }
        let rows; try { rows=A.importMAL(await file.text(),file.name); } catch (_) { ignored++; continue; }
        if (!rows.length) { ignored++; continue; }
        for (const row of rows) {
          const c=cards.get(row.id); if (!c) continue;
          if (row.key) { c.key.value=row.key; imported++; }
          if (row.model) c.model.value=row.model;
          if (row.type && A.TYPES.includes(row.type)) c.type.value=row.type;
          if (row.endpoint) c.endpoint.value=row.endpoint;
          reset(c); updated.add(row.id);
        }
      }
      updateCounts(); note('Uvožene nastavitve za '+updated.size+' ponudnikov · zapisov s ključem: '+imported+(ignored?' · neprepoznanih ali prevelikih datotek: '+ignored:'')+'. Nič še ni poslano.',updated.size?'success':'error');
    } finally { this.value=''; importing=false; $('#import').disabled=false; $('#clear-keys').disabled=false; updateCounts(); }
  });
  $('#export').addEventListener('click',() => {
    const report = A.exportReport([...results.values()].filter(r => r.state!=='running'),secrets(),{requests_issued:requestsIssued});
    const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'}));
    const a=el('a'); a.href=url; a.download='BD-API-smoke-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
    note('Izvoz rezultatov brez ključev je pripravljen. Lahko ga predaš CLI Codexu.','success');
  });
  // Deliberately no localStorage, service worker, analytics or automatic API calls.
  settings(); updateCounts(); document.documentElement.dataset.apiReady='true';
})();
