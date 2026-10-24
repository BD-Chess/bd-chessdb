/* Public, curated snapshots only. This page never reads a private listener. */
"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const feedURL = new URL('../AI8/cli-loops-data.json', location.href);
  const date = new Intl.DateTimeFormat('sl-SI', {timeZone:'Europe/Ljubljana',day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'});
  let data = null, selected = new URL(location.href).searchParams.get('debate'), filter = 'all', busy = false;
  const text = (tag, cls, value) => { const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=value;return el; };
  const fmt = value => date.format(new Date(value));
  const states = {running:'V razpravi · posnetek',complete:'Zaključeno'};
  const badge = value => text('span','state '+value,states[value]);
  function validate(value) {
    if(value?.schema!=='ai8.cli-loops.public.v1'||!Number.isFinite(Date.parse(value.published_at))||!Array.isArray(value.debates)||value.debates.length>100)throw Error('Neveljaven javni posnetek.');
    const ids=new Set();
    for(const d of value.debates){
      if(!/^[a-z0-9-]{1,80}$/.test(d.id)||ids.has(d.id)||!states[d.state]||!['AUTO','MIN','MAX'].includes(d.mode)||!Number.isFinite(Date.parse(d.observed_at)))throw Error('Neveljavna debata.');ids.add(d.id);
      for(const key of ['title','summary','outcome','next_step'])if(typeof d[key]!=='string'||d[key].length>3000)throw Error('Neveljavno besedilo.');
      if(!Number.isInteger(d.turns)||d.turns<0||d.turns>100||!Array.isArray(d.events)||d.events.length>100)throw Error('Neveljavna časovnica.');
      for(const e of d.events)if(!['GPT','Claude','BD','8zListener'].includes(e.author)||typeof e.label!=='string'||typeof e.text!=='string'||e.text.length>3000)throw Error('Neveljaven dogodek.');
    }
    return value;
  }
  function choose(id) {
    selected=id;const url=new URL(location.href);url.searchParams.set('debate',id);history.replaceState(null,'',url);render();
  }
  function render() {
    if(!data)return;
    $('all-count').textContent=String(data.debates.length);
    const list=data.debates.filter(d=>filter==='all'||d.state===filter);
    if(!list.some(d=>d.id===selected))selected=list[0]?.id||null;
    const host=$('debate-list');host.replaceChildren();
    if(!list.length)host.append(text('p','snapshot-note','V tem izboru še ni objavljenih debat.'));
    for(const d of list){
      const card=text('button','debate-card');card.type='button';card.setAttribute('aria-pressed',String(d.id===selected));card.setAttribute('aria-controls','debate-detail');
      const meta=text('div','card-meta');meta.append(badge(d.state),text('span','mode-tag',d.mode+(d.rhp?' + RHP':'')));
      const bottom=text('div','card-bottom');bottom.append(text('span','',d.turns+' '+(d.turns===1?'potrjen odgovor':'potrjeni odgovori')),text('span','arrow','↗'));
      card.append(meta,text('h3','',d.title),text('p','',d.summary),bottom);card.addEventListener('click',()=>choose(d.id));host.append(card);
    }
    const d=list.find(x=>x.id===selected),panel=$('debate-detail');panel.replaceChildren();
    if(!d){const empty=text('div','empty-state');empty.append(text('h3','','Izberi drug pogled.'),text('p','','Spremeni filter za objavljene debate.'));panel.append(empty);return;}
    const head=text('div','detail-head'),meta=text('div','detail-meta');meta.append(badge(d.state),text('span','detail-date','Stanje ob '+fmt(d.observed_at)));
    const title=text('h3','',d.title);title.id='detail-title';head.append(meta,title,text('p','',d.outcome));
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
      $('feed-note').textContent='Javni izbor · objava '+fmt(data.published_at)+'. '+(Date.now()-last>15*60*1000?'Posnetek ni v živo; stanje se je lahko spremenilo. ':'To je objavljeni posnetek, ne živi status terminalov. ')+'Preverjanje nove objave vsakih 30 sekund.';
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
  updateCommand();refresh();setInterval(()=>{if(!document.hidden)refresh();},30000);
})();
