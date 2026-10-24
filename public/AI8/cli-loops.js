/* Published snapshots only: curated content and typed current status. No private connection. */
"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const feedURL = new URL('../AI8/cli-loops-data.json', location.href);
  const date = new Intl.DateTimeFormat('sl-SI', {timeZone:'Europe/Ljubljana',day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'});
  let data = null, selected = new URL(location.href).searchParams.get('debate'), filter = 'running', busy = false, initialView = true;
  const text = (tag, cls, value) => { const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=value;return el; };
  // Only reviewed local destinations become links; editorial content stays text.
  const editorial = (cls, value) => {
    const el=text('p',cls), pattern=/\/crp\/dgte-bd-r[12]\.html|\/ai8\/cli-loops\?debate=[a-z0-9-]{1,80}/g;
    let end=0;
    for(const match of value.matchAll(pattern)){
      el.append(document.createTextNode(value.slice(end,match.index)));
      const path=match[0],link=text('a','',path);
      link.href=new URL(path.startsWith('/crp/')?'..'+path:'../AI8/cli-loops.html'+path.slice(path.indexOf('?')),location.href).href;
      el.append(link);end=match.index+path.length;
    }
    el.append(document.createTextNode(value.slice(end)));return el;
  };
  const fmt = value => date.format(new Date(value));
  const states = {queued:'V vrsti',running:'V razpravi',paused:'Premor',pending:'Čaka arhiv',complete:'Zaključeno',partial:'Delno zaključeno',blocked:'Blokirano',unknown:'Stanje negotovo'};
  const activeStates = new Set(['queued','running','paused','pending']);
  const executorStates = new Set(['VALIDATED','QUEUED','STARTING','RUNNING','READY_NEXT','PAUSED_QUOTA','PAUSED_USER','COMPLETE','PARTIAL','ARCHIVE_PENDING','UNKNOWN','FAILED','BLOCKED','CONFLICT','STOPPED','CANCELLED']);
  const efforts = new Set(['low','medium','high','xhigh','max','ultra',null]);
  const seatEfforts = ['GPT','Claude','SA','SB','CX','CM'];
  const seatNames = {GPT:'GPT',Claude:'Claude',SA:'Claude-S (SA)',SB:'GPT-S (SB)',CX:'GPT-X (CX)',CM:'Claude-M (CM)'};
  const badge = value => text('span','state '+value,states[value]);
  function validate(value) {
    if(value?.schema!=='ai8.cli-loops.public.v1'||!Number.isFinite(Date.parse(value.published_at))||!Array.isArray(value.debates)||value.debates.length>100)throw Error('Neveljaven javni posnetek.');
    if(value.current_debates!==undefined&&(!Array.isArray(value.current_debates)||value.current_debates.length>32))throw Error('Neveljaven trenutni izbor.');
    for(const [host,s] of Object.entries(value.current_hosts||{}))if(!['HOME','WORK'].includes(host)||!Number.isInteger(s.capacity)||s.capacity<1||s.capacity>16||!Number.isFinite(Date.parse(s.observed_at)))throw Error('Neveljavna kapaciteta.');
    const ids=new Set();
    for(const d of [...value.debates,...(value.current_debates||[])]){
      if(!/^[a-z0-9-]{1,80}$/.test(d.id)||ids.has(d.id)||!states[d.state]||!['AUTO','MIN','XHIGH','MAX'].includes(d.mode)||!Number.isFinite(Date.parse(d.observed_at)))throw Error('Neveljavna debata.');ids.add(d.id);
      for(const key of ['title','summary','outcome','next_step'])if(typeof d[key]!=='string'||d[key].length>3000)throw Error('Neveljavno besedilo.');
      if(!Number.isInteger(d.turns)||d.turns<0||d.turns>100||!Array.isArray(d.events)||d.events.length>100)throw Error('Neveljavna časovnica.');
      for(const e of d.events)if(!['GPT','Claude','BD','8zListener'].includes(e.author)||typeof e.label!=='string'||typeof e.text!=='string'||e.text.length>3000)throw Error('Neveljaven dogodek.');
      if(d.usage!==undefined){const u=d.usage;if(!['COMPLETE','PARTIAL','UNKNOWN'].includes(u.coverage)||!['measured_tokens','attempts','measured_attempts','unknown_attempts'].every(k=>Number.isSafeInteger(u[k])&&u[k]>=0))throw Error('Neveljavna poraba.');for(const key of ['by_provider','by_seat','by_phase']){if(!u[key]||typeof u[key]!=='object'||Object.keys(u[key]).length>8)throw Error('Neveljavna razčlenitev.');for(const row of Object.values(u[key]))if(!['input_tokens','output_tokens','total_tokens'].every(k=>Number.isSafeInteger(row[k])&&row[k]>=0))throw Error('Neveljavni tokeni.');}}
      if(typeof d.rhp!=='boolean')throw Error('Neveljaven način.');
      if(d.executor_state!==undefined&&!executorStates.has(d.executor_state))throw Error('Neveljavno stanje izvajalnika.');
      if(d.active_seconds!==undefined&&(!Number.isInteger(d.active_seconds)||d.active_seconds<0||d.active_seconds>43200))throw Error('Neveljaven aktivni čas.');
      if(d.next_author!==undefined&&!['GPT','Claude',null].includes(d.next_author))throw Error('Neveljaven naslednji avtor.');
      if(d.effort!==undefined){
        if(Object.keys(d.effort||{}).some(k=>!seatEfforts.includes(k)))throw Error('Neveljaven effort.');
        for(const author of Object.keys(d.effort||{}).concat(['GPT','Claude']))if(!efforts.has(d.effort?.[author]?.requested)||!efforts.has(d.effort?.[author]?.reported))throw Error('Neveljaven effort.');
      }
      if(d.executor_state!==undefined&&(d.active_seconds===undefined||d.next_author===undefined||d.effort===undefined))throw Error('Nepopoln status izvajalnika.');
      if(d.product_status!==undefined&&(typeof d.product_status!=='string'||d.product_status.length>3000))throw Error('Neveljaven rezultat.');
      if(d.host!==undefined&&!['HOME','WORK'].includes(d.host))throw Error('Neveljaven host.');
      if(d.role_findings!==undefined&&(!Array.isArray(d.role_findings)||d.role_findings.length>32||d.role_findings.some(x=>typeof x!=='string'||x.length>3000)))throw Error('Neveljavne vloge.');
      if(d.status_only!==undefined&&typeof d.status_only!=='boolean')throw Error('Neveljaven status.');
      if(d.current!==undefined&&typeof d.current!=='boolean')throw Error('Neveljaven trenutni status.');
    }
    return value;
  }

  const setLive=(el,value)=>{if(el.textContent!==value)el.textContent=value;};
  const number=new Intl.NumberFormat('sl-SI');
  function usageLabel(u,current=false){return !u||!u.measured_attempts?'Tokeni: meritev še ni na voljo':(current?'Doslej izmerjeno: ':'Tokeni: ')+(u.coverage==='COMPLETE'?'':'najmanj ')+number.format(u.measured_tokens)+(u.coverage==='COMPLETE'?'':' · nepopolni podatki')+(current?' · tekoči klic še ni vključen':'');}
  const allDebates=()=>[...data.debates,...(data.current_debates||[])].map(LoopView.publicDebate);
  const currentDebates=()=>data.current_debates===undefined?data.debates.filter(d=>activeStates.has(d.state)).map(LoopView.publicDebate):allDebates().filter(d=>d.current===true);
  const visibleDebates=()=>LoopView.selectDebates(data,filter,$('debate-search').value,$('debate-sort').value);
  function usageTable(rows,costs=null){const table=text('table','usage-table'),head=text('tr');for(const h of ['Skupina','Vhod','Izhod','Skupaj',...(costs?['Ocena €']:[])]){const cell=text('th','',h);cell.scope='col';head.append(cell);}table.append(head);for(const [name,u] of Object.entries(rows)){const row=text('tr');const label=text('th','',name);label.scope='row';row.append(label);for(const k of ['input_tokens','output_tokens','total_tokens'])row.append(text('td','',Number.isSafeInteger(u[k])?number.format(u[k]):'—'));if(costs)row.append(text('td','cost-value',LoopCost.format(costs[name])));table.append(row);}const region=text('div','table-region');region.tabIndex=0;region.setAttribute('role','region');region.setAttribute('aria-label','Tabela porabe tokenov: '+Object.keys(rows).join(', '));region.append(table);return region;}
  function renderUsage(){
    const debates=allDebates(),measured=debates.filter(d=>d.usage?.measured_attempts),complete=measured.filter(d=>d.usage.coverage==='COMPLETE');
    const total=measured.reduce((n,d)=>n+d.usage.measured_tokens,0),all=complete.length===debates.length&&!currentDebates().length;
    $('usage-total').textContent=measured.length?(all?'':'najmanj ')+number.format(total)+' tokenov':'Meritve še niso na voljo';
    $('usage-coverage').textContent='Objavljenih debat: '+debates.length+' · popolne meritve vrnjenih klicev: '+complete.length+' · delne meritve: '+(measured.length-complete.length)+' · brez meritev: '+(debates.length-measured.length)+'. Tekoči klici še niso vključeni.';
    const providers={},modes={},providerCosts={},modeCosts={};for(const d of measured){for(const [p,u] of Object.entries(d.usage.by_provider||{})){const row=providers[p]||(providers[p]={input_tokens:0,output_tokens:0,total_tokens:0});for(const k of Object.keys(row))row[k]+=u[k]||0;}const key=d.full_rhp?'FullRHP':d.skeptics?'S':'Običajni';const row=modes[key]||(modes[key]={input_tokens:0,output_tokens:0,total_tokens:0});if(modeCosts[key]===undefined)modeCosts[key]=0;for(const [provider,usage] of Object.entries(d.usage.by_provider||{})){const cost=LoopCost.estimate(provider,usage);modeCosts[key]=cost===null||modeCosts[key]===null?null:modeCosts[key]+cost;}for(const u of Object.values(d.usage.by_provider||{}))for(const k of Object.keys(row))row[k]+=u[k]||0;}
    for(const [provider,row] of Object.entries(providers))providerCosts[provider]=LoopCost.estimate(provider,row);
    $('usage-providers').replaceChildren(text('h3','','Po ponudnikih'),usageTable(providers,providerCosts));$('usage-modes').replaceChildren(text('h3','','Po načinu sodelovanja'),usageTable(modes,modeCosts));
  }

  function choose(id) {
    selected=id;const url=new URL(location.href);url.searchParams.set('debate',id);history.replaceState(null,'',url);render();
  }
  function step(delta){const list=visibleDebates();if(list.length<2)return;const index=list.findIndex(d=>d.id===selected);choose(list[(Math.max(0,index)+delta+list.length)%list.length].id);}
  function render() {
    if(!data)return;
    const focused=document.activeElement,cardFocus=focused?.closest('.debate-card'),regionFocus=focused?.closest('.table-region'),detailFocus=focused?.closest('#debate-detail');
    const focusKey=cardFocus?.dataset.debateId,summaryFocus=detailFocus&&focused.tagName==='SUMMARY'?focused.textContent:null,regionIndex=regionFocus?Array.from(document.querySelectorAll('.table-region')).indexOf(regionFocus):-1;
    const oldSelected=selected,openDetails=new Set(Array.from($('debate-detail').querySelectorAll('details[open]')).map(x=>x.querySelector('summary')?.textContent));
    function restoreView(){
      if(oldSelected===selected)for(const x of $('debate-detail').querySelectorAll('details'))x.open=openDetails.has(x.querySelector('summary')?.textContent);
      if(focusKey){const target=Array.from(document.querySelectorAll('.debate-card')).find(x=>x.dataset.debateId===focusKey)||document.querySelector('[data-filter][aria-pressed=true]');target?.focus({preventScroll:true});}
      else if(summaryFocus){const target=Array.from($('debate-detail').querySelectorAll('summary')).find(x=>x.textContent===summaryFocus)||document.querySelector('[data-filter][aria-pressed=true]');target?.focus({preventScroll:true});}
      else if(regionIndex>=0)document.querySelectorAll('.table-region')[regionIndex]?.focus({preventScroll:true});
    }
    renderUsage();
    $('metric-current').textContent=currentDebates().length;$('metric-complete').textContent=allDebates().filter(d=>d.state==='complete').length;$('metric-all').textContent=allDebates().length;
    $('all-count').textContent=String(allDebates().length);$('current-count').textContent=String(currentDebates().length);
    document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
    const list=visibleDebates(),currentView=filter==='running';
    setLive($('debate-result-count'),list.length+' '+(list.length===1?'debata':list.length===2?'debati':list.length>=3&&list.length<5?'debate':'debat')+($('debate-search').value.trim()?' za »'+$('debate-search').value.trim()+'«':' v tem pogledu'));$('clear-search').disabled=!$('debate-search').value;
    if(!list.some(d=>d.id===selected)){selected=list[0]?.id||null;const url=new URL(location.href);if(selected)url.searchParams.set('debate',selected);else url.searchParams.delete('debate');history.replaceState(null,'',url);}
    $('debate-layout').classList.toggle('single-debate',currentView);$('debate-pager').hidden=!currentView;
    setLive($('debate-position'),(selected?list.findIndex(d=>d.id===selected)+1:0)+' / '+list.length);
    $('debate-prev').disabled=$('debate-next').disabled=list.length<2;
    $('debate-capacity').textContent=Object.entries(data.current_hosts||{}).map(([host,s])=>host+': '+currentDebates().filter(d=>d.host===host).length+' '+(currentDebates().filter(d=>d.host===host).length===1?'prikazana aktualna debata':'prikazanih aktualnih debat')+' · objavljena meja '+s.capacity).join(' · ');
    const host=$('debate-list');host.replaceChildren();host.hidden=currentView;
    if(!list.length)host.append(text('p','snapshot-note','V tem izboru še ni objavljenih debat.'));
    for(const d of currentView?[]:list){
      const card=text('button','debate-card');card.type='button';card.dataset.debateId=d.id;card.setAttribute('aria-pressed',String(d.id===selected));card.setAttribute('aria-controls','debate-detail');
      const meta=text('div','card-meta');meta.append(badge(d.state),text('span','mode-tag',d.mode+(d.full_rhp?' · FullRHP · 6 sej':d.skeptics?' · S · 4 seje':d.rhp?' + RHP':'')+(d.deep?' · DEEP':'')));
      const bottom=text('div','card-bottom');bottom.append(text('span','',d.turns+' '+(d.turns===1?'potrjen odgovor':d.turns===2?'potrjena odgovora':d.turns<5?'potrjeni odgovori':'potrjenih odgovorov')),text('span','arrow','↗'));
      card.append(meta,text('h3','',d.title),text('p','',d.summary),text('span','usage-chip',usageLabel(d.usage,currentDebates().some(x=>x.id===d.id))),bottom);card.addEventListener('click',()=>choose(d.id));host.append(card);
    }
    const d=list.find(x=>x.id===selected),panel=$('debate-detail');panel.replaceChildren();
    if(!d){const empty=text('div','empty-state');const title=text('h3','',$('debate-search').value.trim()?'Ni zadetkov za to iskanje.':currentView?'V tem posnetku ni trenutnih debat.':'Izberi drug pogled.');title.id='detail-title';empty.append(title,text('p','',$('debate-search').value.trim()?'Poskusi krajši izraz, počisti iskanje ali izberi pogled Vse.':'Pretekle objave najdeš v pogledu Vse ali Zaključene.'));panel.append(empty);restoreView();return;}
    const head=text('div','detail-head'),meta=text('div','detail-meta');meta.append(badge(d.state),text('span','detail-date','Stanje ob '+fmt(d.observed_at)));
    const title=text('h3','',d.title);title.id='detail-title';head.append(meta,title,text('p','mode-tag',d.mode+(d.full_rhp?' · FullRHP · 6 sej':d.skeptics?' · S · 4 seje':d.rhp?' + RHP':'')+(d.deep?' · DEEP':'')),editorial('',d.outcome));
    if(d.executor_state){
      const status=text('dl','executor-status');
      const item=(label,value)=>{const row=text('div');row.append(text('dt','',label),text('dd','',value));status.append(row);};
      item('Izvajalnik',d.executor_state+(d.status_only?' · '+(d.host||'')+' · javni posnetek':' · '+d.id));
      item('Potrjene poteze',String(d.turns));
      item('Aktivno delo',Math.floor(d.active_seconds/60)+' min '+d.active_seconds%60+' s · ob zadnji potrditvi');
      item('Na potezi / naslednji',d.next_seat||d.next_author||'—');
      for(const author of seatEfforts.filter(k=>d.effort[k])){
        const e=d.effort[author];
        item(seatNames[author]+' · effort',(e.requested?'zahtevan '+e.requested:'ni podatka o zahtevi')+' · '+(e.reported?'klient potrdil '+e.reported:'klient ni potrdil'));
      }
      head.append(status);
    }
    head.append(text('p','usage-chip',usageLabel(d.usage,currentDebates().some(x=>x.id===d.id))));
    if(d.stage)head.append(text('p','role-note','Faza: '+({map:'podvprašanja',alternatives:'alternative',challenge:'ugovori in preverjanje',synthesis:'sinteza'}[d.stage]||d.stage)));
    if(d.usage){const details=text('details','detail-usage');details.append(text('summary','','Razčlenitev porabe po ponudnikih, vlogah in fazah'));for(const [label,key] of [['Ponudniki','by_provider'],['Vloge','by_seat'],['Faze','by_phase']])if(d.usage[key]&&Object.keys(d.usage[key]).length){details.append(text('h4','',label),usageTable(d.usage[key]));}details.append(text('p','role-note',d.usage.measured_attempts+' od '+d.usage.attempts+' klicev z meritvami. Neznana poraba ni nič.'));head.append(details);}
    if(!d.status_only&&(d.full_rhp||d.skeptics)){const roles=text('details','detail-usage');roles.append(text('summary','','Vloge in njihov doprinos'));for(const r of d.role_findings||[])roles.append(text('p','role-note',r));if(!(d.role_findings||[]).length)roles.append(text('p','role-note','Vsebinski prispevki so prikazani v izbranih uredniških korakih spodaj. Število sej ali soglasje samo po sebi ne dokazuje uspeha naloge.'));head.append(roles);}
    if(d.product_status)head.append(editorial('product-status',d.product_status));
    const body=text('div','detail-body');if(d.events.length)body.append(text('h4','','IZBRANI KORAKI POGOVORA'));
    const timeline=text('ol','timeline');
    for(const e of d.events){const li=text('li');li.dataset.author=e.author;const top=text('div','timeline-top');top.append(text('strong','',e.author),text('span','',e.label));li.append(top,editorial('',e.text));timeline.append(li);}
    const next=text('div','next-step');next.append(text('h4','','NASLEDNJI KORAK'),editorial('',d.next_step));
    if(d.events.length)body.append(timeline);
    body.append(next,text('p','detail-footnote',d.status_only?'Javni prikaz vsebuje samo stanje in števce. Naslov teme in vsebina zasebne debate nista objavljena.':'Uredniški povzetek izbranih zapisov. Celotni izvirniki ostajajo v arhivu; neobjavljena vsebina ni del tega izvoza.'));panel.append(head,body);restoreView();
  }
  async function refresh() {
    if(busy)return;busy=true;$('refresh').setAttribute('aria-disabled','true');$('debate').setAttribute('aria-busy','true');
    try {
      const response=await fetch(feedURL,{cache:'no-store',credentials:'omit'});if(!response.ok)throw Error('Podatki trenutno niso dosegljivi.');
      const candidate=validate(await response.json());data=candidate;
      if(initialView){if(selected&&!currentDebates().some(d=>d.id===selected))filter='all';initialView=false;}
      render();
      $('updated-at').textContent='Objava '+fmt(data.published_at);
      $('feed-status').textContent='';
      updateSnapshotNote();
    } catch(error) {
      $('feed-status').textContent=data?'Osvežitev ni uspela. Prikazan je zadnji uspešno prebrani posnetek.':'Objavljenih podatkov ni mogoče prebrati. Poskusi osvežiti pozneje.';
      $('updated-at').textContent=data?'Zadnja objava '+fmt(data.published_at):'Podatki niso dosegljivi';
      updateSnapshotNote();
    } finally {busy=false;$('refresh').setAttribute('aria-disabled','false');$('debate').removeAttribute('aria-busy');}
  }
  function updateSnapshotNote(){if(data)$('feed-note').textContent='Javni izbor · objava '+fmt(data.published_at)+'. '+(Date.now()-Date.parse(data.published_at)>15*60*1000?'Posnetek je starejši od 15 minut; stanje se je lahko spremenilo. ':'Stanje izvajalnika je posnetek ob izvozu. ')+'Prikazan je objavljeni izbor, ne živa povezava z računalnikom. Nove objave preverjamo vsake tri minute.';}
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
    filter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render();
  }));
  $('debate-prev').addEventListener('click',()=>step(-1));$('debate-next').addEventListener('click',()=>step(1));
  $('debate-pager').addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();step(event.key==='ArrowLeft'?-1:1);}});

  $('debate-search').addEventListener('input',render);$('debate-sort').addEventListener('change',render);$('clear-search').addEventListener('click',()=>{$('debate-search').value='';render();$('debate-search').focus();});

  let commandSpec=null,currentPlan=null,lastHost=$('host').value;
  function markErrors(){
    const fields=['topic','host','mode','collaboration','custom-limit','limit','build-project','build-package','call-budget','token-budget'];
    for(const id of fields){$(id).removeAttribute('aria-invalid');$(id).removeAttribute('aria-describedby');}
    const rules=[['topic',!$('topic').value.trim()||new TextEncoder().encode($('topic').value.trim()).length>65536],['call-budget',!Number.isInteger(Number($('call-budget').value||commandSpec.defaults.max_native_calls))||Number($('call-budget').value||commandSpec.defaults.max_native_calls)<1||Number($('call-budget').value||commandSpec.defaults.max_native_calls)>400],['token-budget',$('token-budget').value!==''&&(!Number.isInteger(Number($('token-budget').value))||Number($('token-budget').value)<1||Number($('token-budget').value)>100000000)],['build-project',$('build').checked&&!/^[A-Za-z0-9_-]{1,40}$/.test($('build-project').value.trim())],['build-package',$('build').checked&&!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test($('build-package').value.trim())]];
    const limitError=currentPlan?.errors.some(x=>x.includes('Meja mora')||x.includes('Največ 100'));rules.push([$('limit').value==='custom'?'custom-limit':'limit',limitError]);
    for(const [id,invalid] of rules)if(invalid){$(id).setAttribute('aria-invalid','true');$(id).setAttribute('aria-describedby','command-warning');}
  }
  function values(){return {host:$('host').value,mode:$('mode').value,collaboration:$('collaboration').value,depth:$('depth').value,limit:$('limit').value,customLimit:$('custom-limit').value,customUnit:$('custom-unit').value,topic:$('topic').value,build:$('build').checked,buildProject:$('build-project').value,buildPackage:$('build-package').value,activate:$('activate').checked,calls:$('call-budget').value,tokens:$('token-budget').value};}
  function updateCommand(){
    if($('host').value!==lastHost){$('host-adjustment').textContent='';lastHost=$('host').value;}
    const workXhigh=(commandSpec?.host_modes?.WORK||[]).includes('XHIGH');
    if($('host').value==='WORK'&&($('mode').value==='MIN'||$('mode').value==='XHIGH'&&!workXhigh)){const m=$('mode').value;$('mode').value='';$('host-adjustment').textContent='Za WORK je izbran AUTO. '+m+' na tem računalniku še ni sprejet.';}
    $('mode').querySelector('option[value="MIN"]').disabled=$('host').value==='WORK';
    $('mode').querySelector('option[value="XHIGH"]').disabled=$('host').value==='WORK'&&!workXhigh;
    $('custom-limit-fields').hidden=$('limit').value!=='custom';$('custom-limit').disabled=$('custom-unit').disabled=$('limit').value!=='custom';$('build-fields').hidden=!$('build').checked;
    for(const id of ['build-project','build-package'])$(id).disabled=!$('build').checked;
    $('activate').disabled=!$('build').checked||$('build-project').value.trim().toUpperCase()!=='LISTENER';if($('activate').disabled)$('activate').checked=false;
    $('collaboration-help').textContent=$('collaboration').value==='FullRHP'?'Šest ločenih sej. S je vključen. Oba avtorja uporabljata interni RHP-11 na začetku in ob sintezah.':$('collaboration').value==='S'?'Štiri ločene seje: dva avtorja in dva skeptika.':'Dva avtorja primerjata predloge in ohranita nesoglasja.';
    if(!commandSpec){$('copy-command').disabled=true;return;}
    currentPlan=LoopCommand.build(commandSpec,values());$('command').value=currentPlan.command;$('plan-summary').textContent=currentPlan.summary;setLive($('command-warning'),currentPlan.errors.join(' '));$('copy-command').disabled=!!currentPlan.errors.length;markErrors();$('review-errors').hidden=!currentPlan.errors.length;
    setLive($('copy-status'),'Kopiranje še ne odda naloge; pred zagonom sledi pregled načrta.');
  }
  async function loadSpec(){try{const r=await fetch(new URL('../AI8/cli-loops-command-spec.json',location.href),{credentials:'omit',cache:'no-store'});if(!r.ok)throw Error();commandSpec=await r.json();if(commandSpec.schema!=='8zlistener.command_spec.v1'||!Array.isArray(commandSpec.arguments))throw Error();$('grammar').textContent=commandSpec.grammar;const list=$('argument-list');list.replaceChildren();for(const a of commandSpec.arguments){const row=text('div');row.append(text('dt','',a.name),text('dd','',a.description));list.append(row);}updateCommand();}catch(e){$('copy-command').disabled=true;setLive($('command-warning'),'Specifikacije ukaza ni mogoče prebrati; kopiranje je zadržano.');}}
  $('review-errors').addEventListener('click',()=>{updateCommand();const first=$('command-form').querySelector('[aria-invalid=true]');if(first){for(let parent=first.parentElement;parent;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;first.focus();}});
  $('command-form').addEventListener('input',updateCommand);$('command-form').addEventListener('change',updateCommand);
  $('command-form').addEventListener('submit',async event=>{event.preventDefault();updateCommand();if(!currentPlan||currentPlan.errors.length){const first=$('command-form').querySelector('[aria-invalid=true]');if(first){const details=first.closest('details');if(details)details.open=true;first.focus();}else $('command-warning').focus();return;}try{await navigator.clipboard.writeText(currentPlan.command);setLive($('copy-status'),'Kopirano. Prilepi v povezano sejo in potrdi prikazani načrt.');}catch(e){$('command').focus();$('command').select();setLive($('copy-status'),'Označeni ukaz kopiraj ročno; naloga še ni oddana.');}});
  $('reset-options').addEventListener('click',()=>{const topic=$('topic').value;$('host-adjustment').textContent='';$('command-form').reset();$('topic').value=topic;updateCommand();});
  $('refresh').addEventListener('click',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  window.addEventListener('popstate',()=>{selected=new URL(location.href).searchParams.get('debate');if(data&&selected&&!visibleDebates().some(d=>d.id===selected))filter=currentDebates().some(d=>d.id===selected)?'running':'all';render();});
  setInterval(updateSnapshotNote,60000);
  updateCommand();loadSpec();refresh();setInterval(()=>{if(!document.hidden)refresh();},180000);
})();
