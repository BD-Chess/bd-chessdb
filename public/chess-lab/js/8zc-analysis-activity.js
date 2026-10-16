/* Read-only projection of the existing interactive controllers. No scheduler,
 * workers, result scores or persistent state live here. */
(function(root){
  'use strict';
  function create(host){
    const doc=root.document,byId=id=>doc.getElementById(id);
    const slot=doc.createElement('div');slot.className='analysis-activity-slot';
    byId('controls').prepend(slot);
    const row=doc.createElement('section');row.id='analysisActivity';row.className='analysis-activity';
    row.innerHTML='<details><summary><strong data-activity="title"></strong><span data-activity="brief"></span></summary><p data-activity="details"></p></details><button type="button" data-activity="stop"></button><span class="sr-only" data-activity="announce" role="status" aria-live="polite"></span>';
    const el=name=>row.querySelector('[data-activity="'+name+'"]');
    const activeStates=new Set(['queued','loading','preparing','ready','searching','running','stopping']);
    const modes={'sf-lite':'SF Lite','sf-full':'SF Full',lc0:'LC0',reckless:'RLE',berserk:'BER'};
    const lex={en:{cards:'Cards/All',deep:'Deep',probe:'Board/DCC',display:'Display',follow:'Each move',off:'off',idle:'idle',stop:'Stop analysis',scope:'Stop all interactive local analysis and each-move policies; games, Sim and replay keep running',current:'current position',older:'pinned/older position',pending:'latest position queued',complete:'complete',stopped:'stopped',failed:'failed',queued:'queued',loading:'loading',preparing:'preparing',ready:'preparing',searching:'searching',running:'searching',stopping:'stopping',until:'until Stop',next:'New search: Analyze; each move stays off until enabled.'},
      sl:{cards:'Kartice/Vsi',deep:'Deep',probe:'Plošča/DCC',display:'Prikaz',follow:'Vsaka poteza',off:'izklop',idle:'miruje',stop:'Ustavi analizo',scope:'Ustavi vse interaktivne lokalne analize in samodejno analizo potez; partija, Sim in Replay tečejo naprej',current:'trenutni položaj',older:'pripet/starejši položaj',pending:'zadnji položaj v vrsti',complete:'končano',stopped:'ustavljeno',failed:'napaka',queued:'v vrsti',loading:'nalaganje',preparing:'priprava',ready:'priprava',searching:'analizira',running:'analizira',stopping:'ustavljanje',until:'do ustavitve',next:'Analyze začne novo iskanje; samodejna analiza ostane izklopljena do vklopa.'}};
    let timer=null,frame=null,destroyed=false,lastAnnouncement='',lastSnapshot=null;
    const text=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
    const seconds=ms=>(ms/1000).toFixed(1)+'s';
    function place(){
      const settings=byId('settingsPanel'),library=byId('popularGamesPanel'),tools=byId('labToolsDialog');
      let target=slot;
      if(tools?.open)target=byId('labToolsBody')||tools;
      else if(settings?.classList.contains('open'))target=settings;
      else if(doc.body.classList.contains('app-mobile')){
        const header=doc.querySelector('.app-mobile-header');
        if(header)target=header.parentElement;
        if(target!==slot&&row.previousElementSibling!==header){header.after(row);measure();return;}
      }else if(library?.classList.contains('open'))target=library;
      if(row.parentElement!==target){
        const heading=target.querySelector(':scope > header, :scope > .panel-header');
        if(heading)heading.after(row);else target.prepend(row);
      }
      measure();
    }
    function measure(){
      const app=doc.body.classList.contains('app-mobile')&&!row.closest('#controls,dialog');
      doc.body.style.setProperty('--analysis-activity-height',app&&!row.hidden?Math.ceil(row.getBoundingClientRect().height)+'px':'0px');
    }
    function paint(){
      frame=null;if(destroyed)return;
      const s=host.getSnapshot();lastSnapshot=s;
      const l=lex[doc.documentElement.lang==='sl'?'sl':'en'];
      const owners=(s.owners||[]).filter(o=>o.running||o.following||o.children?.length);
      const active=owners.some(o=>o.running||o.following||o.pending);
      row.hidden=!owners.length;
      el('stop').disabled=!active;el('stop').title=l.scope;el('stop').setAttribute('aria-label',l.stop);text(el('stop'),l.stop);
      const ownerNames=owners.map(o=>l[o.owner]||o.owner);
      text(el('title'),l.display+': '+s.display+' · '+(ownerNames.join(' / ')||l.idle));
      const brief=[],details=[];
      for(const owner of owners){
        for(const child of owner.children||[]){
          const status=l[child.state]||child.state||l.idle,label=modes[child.mode]||child.label||child.mode;
          const location=child.positionKey===s.positionKey?l.current:l.older;
          const budget=child.budget||{},limit=budget.infinite?l.until:budget.movetime?seconds(budget.movetime):budget.depth?'depth '+budget.depth:budget.nodes?budget.nodes+' nodes':'';
          const clock=Number.isFinite(child.searchElapsedMs)?seconds(child.searchElapsedMs)+(limit?' / '+limit:''):limit;
          let progress='';
          if(Number.isFinite(child.progress?.loaded))progress=' · '+(child.progress.loaded/1048576).toFixed(1)+(child.progress.total?' / '+(child.progress.total/1048576).toFixed(1):'')+' MiB';
          brief.push(label+' '+status);
          details.push(label+' · '+status+' · '+location+(clock?' · '+clock:'')+progress+(child.error?' · '+child.error:''));
        }
        if(owner.pending)brief.push(l.pending);
      }
      const armed=owners.filter(o=>o.following).map(o=>l[o.owner]);
      const follow=l.follow+': '+(armed.join(', ')||l.off);
      text(el('brief'),brief.join(' · ')+(brief.length?' · ':'')+follow);
      text(el('details'),details.join('\n')+'\n'+follow+'. '+l.next);
      const states=owners.flatMap(o=>(o.children||[]).map(c=>c.state));
      const terminal=states.length&&states.every(s=>s==='complete')?l.complete:states.includes('failed')?l.failed:l.stopped;
      const announcement=ownerNames.join(', ')+' · '+(active?follow:terminal);
      if(announcement!==lastAnnouncement){lastAnnouncement=announcement;text(el('announce'),announcement);}
      place();clearTimeout(timer);timer=null;
      if(active&&!doc.hidden)timer=root.setTimeout(refresh,250);
    }
    function refresh(){if(!frame&&!destroyed)frame=root.requestAnimationFrame(paint);}
    el('stop').onclick=()=>{host.stop();refresh();};
    row.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))e.stopPropagation();});
    row.querySelector('details').addEventListener('toggle',measure);
    const observer=new MutationObserver(refresh);
    observer.observe(doc.body,{attributes:true,attributeFilter:['class','data-app-view','data-desktop-view']});
    observer.observe(doc.documentElement,{attributes:true,attributeFilter:['lang']});
    for(const id of ['settingsPanel','popularGamesPanel','labToolsDialog'])if(byId(id))observer.observe(byId(id),{attributes:true,attributeFilter:['class','open']});
    const resize=typeof root.ResizeObserver==='function'?new root.ResizeObserver(measure):null;resize?.observe(row);
    doc.addEventListener('visibilitychange',refresh);
    refresh();
    return {refresh,getSnapshot:()=>lastSnapshot,destroy(){destroyed=true;clearTimeout(timer);root.cancelAnimationFrame(frame);observer.disconnect();resize?.disconnect();doc.removeEventListener('visibilitychange',refresh);row.remove();slot.remove();}};
  }
  root.ChessAnalysisActivity={create};
})(window);
