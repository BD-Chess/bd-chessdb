/* Public, curated snapshots only. This page never reads a private listener. */
"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const feedURL = new URL('../AI8/cli-loops-data.json', location.href);
  const date = new Intl.DateTimeFormat('sl-SI', {timeZone:'Europe/Ljubljana',day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'});
  let data = null, selected = new URL(location.href).searchParams.get('debate'), filter = 'all', busy = false;
  const text = (tag, cls, value) => { const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=value;return el; };
  const fmt = value => date.format(new Date(value));
  const states = {queued:'V vrsti',running:'V razpravi',paused:'Premor · kvota',pending:'Čaka arhiv',complete:'Zaključeno',partial:'Delno zaključeno',blocked:'Blokirano',unknown:'Stanje negotovo'};
  const activeStates = new Set(['queued','running','paused','pending']);
  const executorStates = new Set(['VALIDATED','QUEUED','STARTING','RUNNING','READY_NEXT','PAUSED_QUOTA','COMPLETE','PARTIAL','ARCHIVE_PENDING','UNKNOWN','FAILED','BLOCKED','CONFLICT','STOPPED','CANCELLED']);
  const efforts = new Set(['low','medium','high','xhigh','max','ultra',null]);
  const badge = value => text('span','state '+value,states[value]);
  function validate(value) {
    if(value?.schema!=='ai8.cli-loops.public.v1'||!Number.isFinite(Date.parse(value.published_at))||!Array.isArray(value.debates)||value.debates.length>100)throw Error('Neveljaven javni posnetek.');
    const ids=new Set();
    for(const d of value.debates){
      if(!/^[a-z0-9-]{1,80}$/.test(d.id)||ids.has(d.id)||!states[d.state]||!['AUTO','MIN','MAX'].includes(d.mode)||!Number.isFinite(Date.parse(d.observed_at)))throw Error('Neveljavna debata.');ids.add(d.id);
      for(const key of ['title','summary','outcome','next_step'])if(typeof d[key]!=='string'||d[key].length>3000)throw Error('Neveljavno besedilo.');
      if(!Number.isInteger(d.turns)||d.turns<0||d.turns>100||!Array.isArray(d.events)||d.events.length>100)throw Error('Neveljavna časovnica.');
      for(const e of d.events)if(!['GPT','Claude','BD','8zListener'].includes(e.author)||typeof e.label!=='string'||typeof e.text!=='string'||e.text.length>3000)throw Error('Neveljaven dogodek.');
      if(typeof d.rhp!=='boolean')throw Error('Neveljaven način.');
      if(d.executor_state!==undefined&&!executorStates.has(d.executor_state))throw Error('Neveljavno stanje izvajalnika.');
      if(d.active_seconds!==undefined&&(!Number.isInteger(d.active_seconds)||d.active_seconds<0||d.active_seconds>43200))throw Error('Neveljaven aktivni čas.');
      if(d.next_author!==undefined&&!['GPT','Claude',null].includes(d.next_author))throw Error('Neveljaven naslednji avtor.');
      if(d.effort!==undefined){
        for(const author of ['GPT','Claude'])if(!efforts.has(d.effort?.[author]?.requested)||!efforts.has(d.effort?.[author]?.reported))throw Error('Neveljaven effort.');
      }
      if(d.executor_state!==undefined&&(d.active_seconds===undefined||d.next_author===undefined||d.effort===undefined))throw Error('Nepopoln status izvajalnika.');
      if(d.product_status!==undefined&&(typeof d.product_status!=='string'||d.product_status.length>3000))throw Error('Neveljaven rezultat.');
    }
    return value;
  }
  function choose(id) {
    selected=id;const url=new URL(location.href);url.searchParams.set('debate',id);history.replaceState(null,'',url);render();
  }
  function render() {
    if(!data)return;
    $('all-count').textContent=String(data.debates.length);
    const list=data.debates.filter(d=>filter==='all'||(filter==='running'?activeStates.has(d.state):d.state===filter));
    if(!list.some(d=>d.id===selected))selected=list[0]?.id||null;
    const host=$('debate-list');host.replaceChildren();
    if(!list.length)host.append(text('p','snapshot-note','V tem izboru še ni objavljenih debat.'));
    for(const d of list){
      const card=text('button','debate-card');card.type='button';card.setAttribute('aria-pressed',String(d.id===selected));card.setAttribute('aria-controls','debate-detail');
      const meta=text('div','card-meta');meta.append(badge(d.state),text('span','mode-tag',d.mode+(d.rhp?' + RHP':'')));
      const bottom=text('div','card-bottom');bottom.append(text('span','',d.turns+' '+(d.turns===1?'potrjen odgovor':d.turns===2?'potrjena odgovora':d.turns<5?'potrjeni odgovori':'potrjenih odgovorov')),text('span','arrow','↗'));
      card.append(meta,text('h3','',d.title),text('p','',d.summary),bottom);card.addEventListener('click',()=>choose(d.id));host.append(card);
    }
    const d=list.find(x=>x.id===selected),panel=$('debate-detail');panel.replaceChildren();
    if(!d){const empty=text('div','empty-state');const title=text('h3','','Izberi drug pogled.');title.id='detail-title';empty.append(title,text('p','','Spremeni filter za objavljene debate.'));panel.append(empty);return;}
    const head=text('div','detail-head'),meta=text('div','detail-meta');meta.append(badge(d.state),text('span','detail-date','Stanje ob '+fmt(d.observed_at)));
    const title=text('h3','',d.title);title.id='detail-title';head.append(meta,title,text('p','',d.outcome));
    if(d.executor_state){
      const status=text('dl','executor-status');
      const item=(label,value)=>{const row=text('div');row.append(text('dt','',label),text('dd','',value));status.append(row);};
      item('Izvajalnik',d.executor_state+' · '+d.id);
      item('Potrjene poteze',String(d.turns));
      item('Aktivno delo',Math.floor(d.active_seconds/60)+' min '+d.active_seconds%60+' s · ob zadnji potrditvi');
      item('Na potezi / naslednji',d.next_author||'—');
      for(const author of ['GPT','Claude']){
        const e=d.effort[author];
        item(author+' · effort',(e.requested?'zahtevan '+e.requested:'ni podatka o zahtevi')+' · '+(e.reported?'klient potrdil '+e.reported:'klient ni potrdil'));
      }
      head.append(status);
    }
    if(d.product_status)head.append(text('p','product-status',d.product_status));
    const body=text('div','detail-body');body.append(text('h4','','IZBRANI KORAKI POGOVORA'));
    const timeline=text('ol','timeline');
    for(const e of d.events){const li=text('li');li.dataset.author=e.author;const top=text('div','timeline-top');top.append(text('strong','',e.author),text('span','',e.label));li.append(top,text('p','',e.text));timeline.append(li);}
    const next=text('div','next-step');next.append(text('h4','','NASLEDNJI KORAK'),text('p','',d.next_step));
    body.append(timeline,next,text('p','detail-footnote','Uredniški povzetek izbranih zapisov. Celotni izvirniki ostajajo v arhivu; neobjavljena vsebina ni del tega izvoza.'));panel.append(head,body);
  }
  async function refresh() {
    if(busy)return;busy=true;$('refresh').disabled=true;
    try {
      const response=await fetch(feedURL,{cache:'no-store',credentials:'omit'});if(!response.ok)throw Error('Podatki trenutno niso dosegljivi.');
      const candidate=validate(await response.json());data=candidate;render();
      $('updated-at').textContent='Objava '+fmt(data.published_at);
      $('feed-status').textContent='';
      const last=new Date(data.published_at).getTime();
      $('feed-note').textContent='Javni izbor · objava '+fmt(data.published_at)+'. '+(Date.now()-last>15*60*1000?'Posnetek je starejši od 15 minut; stanje se je lahko spremenilo. ':'Stanje izvajalnika je posnetek ob izvozu. ')+'Izvoz je omejen na največ enkrat na 15 minut; nova objava zahteva objavo skrbnika. Stran jo preveri vsake tri minute.';
    } catch(error) {
      $('feed-status').textContent=data?'Osvežitev ni uspela. Prikazan je zadnji uspešno prebrani posnetek.':'Objavljenih podatkov ni mogoče prebrati. Poskusi osvežiti pozneje.';
      $('updated-at').textContent=data?'Zadnja objava '+fmt(data.published_at):'Podatki niso dosegljivi';
    } finally {busy=false;$('refresh').disabled=false;}
  }
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{
    filter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render();
  }));
  function command() {
    const topic=$('topic').value.trim()||'Primerjajta dve zasnovi. Poiščita slabosti, ohranita nesoglasja in predlagajta naslednji preverljivi korak.';
    return ['LOOP CLI',$('host').value,$('limit').value,$('mode').value].filter(Boolean).join(' ')+': '+topic;
  }
  function updateCommand(){$('command').value=command();$('copy-status').textContent='Priprava ukaza še ne odda naloge.';}
  ['host','limit','mode','topic'].forEach(id=>$(id).addEventListener('input',updateCommand));
  $('command-form').addEventListener('submit',async event=>{
    event.preventDefault();$('command').value=command();
    try{await navigator.clipboard.writeText(command());$('copy-status').textContent='Kopirano. Prilepi v povezano GPT ali Claude sejo. Naloga še ni oddana.';}
    catch(error){$('command').focus();$('command').select();$('copy-status').textContent='Označeni ukaz kopiraj ročno in prilepi v povezano sejo.';}
  });
  $('refresh').addEventListener('click',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  window.addEventListener('popstate',()=>{selected=new URL(location.href).searchParams.get('debate');render();});
  updateCommand();refresh();setInterval(()=>{if(!document.hidden)refresh();},180000);
})();
