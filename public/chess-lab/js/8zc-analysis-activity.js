/* Read-only, coalesced projection of real interactive owners. No scheduler,
 * worker or persisted live state. Existing cards and action rows paint it. */
(function(root){
  'use strict';
  const liveStates=new Set(['queued','loading','preparing','ready','searching','running','stopping']);
  const role=mode=>({'sf-lite':'SF','sf-full':'SF',lc0:'LC0',reckless:'RLE',berserk:'BER'}[mode]);
  const active=s=>(s?.owners||[]).some(o=>o.running||o.following||o.pending);
  function card(s,source,preferred){
    const matches=(s?.owners||[]).flatMap(owner=>(owner.children||[]).filter(child=>role(child.mode)===source).map(child=>({owner:owner.owner,following:!!owner.following,child,current:child.positionKey===s.positionKey})));
    return matches.find(x=>liveStates.has(x.child.state))||matches.find(x=>x.owner===preferred)||matches.at(-1)||null;
  }
  const words={en:{stop:'Stop analysis',all:'All engines',stopAll:'Stop all',scope:'Stop all interactive analysis and each-move policies; games, Sim and replay continue',armed:'Each move armed',off:'Each move off',cards:'Cards',deep:'Deep',probe:'Board/DCC',older:'Older position',queued:'Queued',loading:'Loading',preparing:'Preparing',ready:'Preparing',searching:'Searching',running:'Searching',stopping:'Stopping',complete:'Complete',stopped:'Stopped',failed:'Failed',partial:'Partial',depth:'Depth',lines:'lines',visits:'visits',limit:'Limit',until:'until Stop',noInfo:'No search info',stopDeep:'Stop Deep group and Deep each move',stopProbe:'Stop Board/DCC analysis',newSearch:'New search'},
    sl:{stop:'Ustavi analizo',all:'Vsi motorji',stopAll:'Ustavi vse',scope:'Ustavi vse interaktivne analize in samodejno analizo potez; partija, Sim in ponovitev tečejo naprej',armed:'Vsaka poteza vklopljena',off:'Vsaka poteza izklopljena',cards:'Kartice',deep:'Deep',probe:'Plošča/DCC',older:'Starejši položaj',queued:'V vrsti',loading:'Nalaganje',preparing:'Priprava',ready:'Priprava',searching:'Analizira',running:'Analizira',stopping:'Ustavljanje',complete:'Končano',stopped:'Ustavljeno',failed:'Napaka',partial:'Delno',depth:'Globina',lines:'linije',visits:'obiski',limit:'Omejitev',until:'do ustavitve',noInfo:'Brez podatkov iskanja',stopDeep:'Ustavi skupino Deep in Deep za vsako potezo',stopProbe:'Ustavi analizo plošče/DCC',newSearch:'Novo iskanje'}};
  const lex=()=>words[root.document.documentElement.lang==='sl'?'sl':'en'];
  function presentation(item){
    if(!item)return null;
    const l=lex(),c=item.child,r=c.result||{},busy=liveStates.has(c.state),budget=c.budget||{};
    const sec=n=>(n/1000).toFixed(1)+'s';
    const limit=budget.infinite?l.until:budget.movetime?sec(budget.movetime):budget.depth?l.depth+' '+budget.depth:budget.nodes?budget.nodes+' nodes':'';
    let phase=l[c.state]||c.state||l.noInfo;
    if(['queued','loading','preparing','ready'].includes(c.state)){
      if(Number.isFinite(c.progress?.loaded))phase+=' '+(c.progress.loaded/1048576).toFixed(1)+(Number.isFinite(c.progress.total)?' / '+(c.progress.total/1048576).toFixed(1):'')+' MiB';
      else if(limit)phase+=' · '+l.limit+' '+limit;
    }else if(Number.isFinite(c.searchElapsedMs))phase+=' · '+sec(c.searchElapsedMs)+(limit?'/'+limit:'');
    const reached=c.mode==='lc0'?(r.visits??r.nodes):(r.linesDepth??r.depth??r.lines?.[0]?.depth);
    const coverage=[Number.isFinite(reached)?(c.mode==='lc0'?reached.toLocaleString()+' '+l.visits:l.depth+' '+reached):'',r.lines?.length?r.lines.length+' '+l.lines:'',r.coverage?.status==='partial'?l.partial:''].filter(Boolean).join(' · ');
    const location=!item.current?l.older:'';
    const title=(c.mode==='sf-full'?'Stockfish Full':c.mode==='sf-lite'?'Stockfish Lite':c.mode==='lc0'?'LC Zero':c.label||c.mode)+(item.owner==='cards'?'':' · '+l[item.owner]);
    return {...item,busy,title,phase,detail:[location,coverage].filter(Boolean).join(' · '),result:r,
      action:item.owner==='deep'?l.stopDeep:item.owner==='probe'?l.stopProbe:undefined,
      note:[location,l[c.state]||c.state,coverage,item.following?l.armed:''].filter(Boolean).join(' · ')};
  }
  function create(host){
    const doc=root.document,byId=id=>doc.getElementById(id),preferred=new Map(),buttons=[];
    // Controls live in existing headers: no status strip or reserved slot.
    for(const [id,parent,before]of [['appStopAnalysis',doc.querySelector('.app-mobile-header'),'appMore'],['settingsStopAnalysis',byId('settingsPanel')?.querySelector('.drawer-heading'),'btnCloseSettings'],['toolsStopAnalysis',byId('labToolsDialog')?.querySelector('.lab-tools-header, header, .drawer-heading'),'btnCloseLabTools']]){
      if(!parent)continue;
      const b=doc.createElement('button');b.id=id;b.type='button';b.className='analysis-stop-action';b.dataset.activity='stop';b.hidden=true;
      const sibling=byId(before);if(sibling?.parentElement===parent)parent.insertBefore(b,sibling);else parent.append(b);
      b.onclick=()=>{host.stop();refresh();};buttons.push(b);
    }
    const announce=doc.createElement('span');announce.className='sr-only';announce.setAttribute('role','status');announce.setAttribute('aria-live','polite');byId('controls').append(announce);
    let timer=null,frame=null,destroyed=false,lastSnapshot=null,lastAnnouncement='';
    const text=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};
    function paint(){
      frame=null;if(destroyed)return;
      lastSnapshot=host.getSnapshot();const s=lastSnapshot,l=lex(),running=active(s);
      for(const source of ['SF','RLE','LC0','BER']){const item=card(s,source,preferred.get(source));if(item)preferred.set(source,item.owner);}
      for(const b of buttons){
        if(!running&&doc.activeElement===b){const target=b.id==='settingsStopAnalysis'?byId('btnCloseSettings'):b.id==='toolsStopAnalysis'?byId('btnCloseLabTools'):byId('appMore');target?.focus({preventScroll:true});}
        b.hidden=!running;b.disabled=!running;b.title=l.scope;b.setAttribute('aria-label',l.stop);text(b,l.stopAll);
      }
      const all=byId('btnAnalyzeAll');
      if(all){all.classList.toggle('is-working',running);all.dataset.analysisAction=running?'stop':'start';
        for(const label of all.querySelectorAll('.all-desktop-label,.all-mobile-label'))text(label,running?l.stopAll:l.all);
        all.title=running?l.scope:l.newSearch;all.setAttribute('aria-label',running?l.stopAll:l.all);
      }
      const armed=(s.owners||[]).filter(o=>o.following).map(o=>l[o.owner]).join(', ');
      for(const tab of doc.querySelectorAll('[data-app-tab="deep"],button[data-desktop-view="deep"]')){
        tab.classList.toggle('has-analysis-activity',running);
        tab.title=running?(armed?l.armed+': '+armed:l.stop+' · '+(s.owners||[]).filter(o=>o.running).map(o=>l[o.owner]).join(', ')):l.off;
      }
      const message=(s.owners||[]).filter(o=>o.running||o.following).map(o=>l[o.owner]+(o.following?' · '+l.armed:'')).join(', ');
      if(message!==lastAnnouncement){text(announce,message||l.off);lastAnnouncement=message;}
      host.onPaint?.(s);clearTimeout(timer);timer=null;if(running&&!doc.hidden)timer=root.setTimeout(refresh,250);
    }
    function refresh(){if(!frame&&!destroyed)frame=root.requestAnimationFrame(paint);}
    const observer=new MutationObserver(refresh);observer.observe(doc.documentElement,{attributes:true,attributeFilter:['lang']});
    doc.addEventListener('visibilitychange',refresh);refresh();
    return {refresh,getSnapshot:()=>lastSnapshot,card:source=>presentation(card(lastSnapshot,source,preferred.get(source))),
      destroy(){destroyed=true;clearTimeout(timer);root.cancelAnimationFrame(frame);observer.disconnect();doc.removeEventListener('visibilitychange',refresh);for(const b of buttons)b.remove();announce.remove();}};
  }
  root.ChessAnalysisActivity={create,active,card,presentation};
})(window);
