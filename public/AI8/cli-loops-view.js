/* Pure selection over the existing published snapshot. Keeps source order on ties. */
"use strict";
(function(root){
  const active=new Set(['queued','running','paused','pending']);
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('sl');
  function publicDebate(d){return !d.status_only?d:{...d,title:'CLI '+(d.host||'')+' · javni status',summary:'Stanje izvajalnika ob zadnjem izvozu.',outcome:'Stanje izvajalnika in poraba ob zadnjem izvozu.',next_step:'Počakaj na naslednji objavljeni posnetek; vsebinski izkupiček zahteva ločen pregled.',events:[],role_findings:[],product_status:undefined,stage:undefined};}
  function selectDebates(data,filter='running',query='',sort='recent'){
    const all=[...data.debates,...(data.current_debates||[])].map(publicDebate),needle=normalize(query).trim();
    const list=all.filter(d=>{
      const visible=filter==='running'?(data.current_debates===undefined?active.has(d.state):d.current===true):filter==='all'||d.state===filter;
      return visible&&(!needle||normalize([d.title,d.summary,d.outcome,d.next_step].join(' ')).includes(needle));
    });
    return list.sort((a,b)=>sort==='turns'?b.turns-a.turns:sort==='oldest'?Date.parse(a.observed_at)-Date.parse(b.observed_at):Date.parse(b.observed_at)-Date.parse(a.observed_at));
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={selectDebates,publicDebate};else root.LoopView={selectDebates,publicDebate};
})(typeof globalThis!=='undefined'?globalThis:this);
