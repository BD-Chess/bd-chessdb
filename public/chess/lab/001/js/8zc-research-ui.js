(function(root){
  'use strict';
  function create(host={}){
    const E=root.ChessEvidence,B=root.ChessBenchmark;
    if(!E||!B)throw new Error('Research modules are not loaded.');
    const store=E.createStore(),dialog=document.createElement('dialog');
    dialog.className='chess-research-dialog';dialog.setAttribute('aria-labelledby','chessResearchTitle');
    dialog.innerHTML=`<div class="research-heading"><div><span class="section-kicker">CHESSDCC RESEARCH</span><h2 id="chessResearchTitle">Evidence & comparisons</h2></div><button class="research-close" type="button" aria-label="Close research">×</button></div>
      <nav class="research-tabs" aria-label="Research sections"><button type="button" data-tab="evidence">Evidence</button><button type="button" data-tab="benchmark">Compare policies</button><button type="button" data-tab="engine">Engine experiment</button></nav>
      <p class="research-status" role="status" aria-live="polite"></p>
      <section data-section="evidence"><p>Freeze source replies, the full position, settings and DCC decision. Offline replay uses only those captured replies. Unobserved answers remain unknown.</p>
        <div class="research-actions"><button type="button" data-action="capture">Save current analysis</button><button type="button" data-action="import">Import evidence JSON</button><input type="file" accept="application/json,.json" data-input="import" hidden></div>
        <label class="research-label">Saved snapshots<select data-input="snapshots"><option value="">No saved snapshots</option></select></label>
        <p class="research-storage"></p><pre class="research-summary" tabindex="0"></pre>
        <div class="research-actions"><button type="button" data-action="restore">Restore offline</button><button type="button" data-action="live">Return to live data</button><button type="button" data-action="export">Export evidence</button><button type="button" data-action="delete">Delete selected</button></div>
      </section>
      <section data-section="benchmark" hidden><p>Replay the same frozen evidence with legacy, balanced and sensor variants. Every policy has the same query allowance; actual requests and missing replies are shown. CDB server compute is unknown.</p>
        <label class="research-label">Logical queries per policy<input data-input="budget" type="number" min="1" max="2000" value="120"></label>
        <div class="research-actions"><button type="button" data-action="frozen">Compare selected / current snapshot</button><button type="button" data-action="fixture">Run diagnostic fixture</button></div>
        <p class="research-note">The fixture is synthetic and tests reproducibility. It is not a chess strength result. More queries cannot recover source replies that were never captured.</p>
      </section>
      <section data-section="engine" hidden><p>Compare raw browser Stockfish with a DCC experiment at the same total requested node budget. DCC divides its budget between candidate discovery and continued analysis. A separate, larger search then compares the selected root moves.</p>
        <div class="research-fields"><label class="research-label">Nodes per policy<select data-input="nodes"><option value="50000">50,000</option><option value="100000" selected>100,000</option><option value="300000">300,000</option><option value="1000000">1,000,000</option></select></label>
        <label class="research-label">Discovery candidates<select data-input="candidates"><option>3</option><option selected>5</option><option>10</option></select></label></div>
        <div class="research-actions"><button type="button" data-action="engine">Run engine comparison</button></div>
        <p class="research-note">Runs on this device. Requested limits can overshoot slightly; actual nodes are reported. This experimental policy samples three continuations per guarded candidate. Deeper analysis by the same engine is evidence, not an independent proof or an Elo estimate.</p>
      </section>
      <div class="research-actions"><button type="button" data-action="cancel" hidden>Stop comparison</button><button type="button" data-action="adjudicate" hidden>Assess these choices with Stockfish</button><button type="button" data-action="export-result" hidden>Export comparison JSON</button></div>
      <div class="research-results" aria-live="polite"></div>`;
    document.body.appendChild(dialog);
    const $=selector=>dialog.querySelector(selector),status=$('.research-status');
    let selected=null,lastResult=null,controller=null,engine=null,destroyed=false;
    function say(message){status.textContent=message;}
    function tab(name){
      dialog.querySelectorAll('[data-section]').forEach(section=>{section.hidden=section.dataset.section!==name;});
      dialog.querySelectorAll('[data-tab]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.tab===name));});
    }
    function busy(value){
      dialog.querySelectorAll('[data-action]').forEach(button=>{if(!['cancel','export-result'].includes(button.dataset.action))button.disabled=value;});
      $('[data-action="cancel"]').hidden=!value;
    }
    function summary(){
      if(!selected){$('.research-summary').textContent='Select or save a snapshot.';return;}
      const p=selected.payload,parsed=p.records.filter(r=>['moves','pv','score'].includes(r.kind));
      const withTime=parsed.filter(r=>r.finishedAt!==null).length;
      $('.research-summary').textContent=[p.label||'Saved analysis',p.fen,
        'Captured: '+(p.createdAt||'unknown'),'DCC version: '+(p.analysis?.receipt?.config?.version||p.sourceVersion||'unknown'),
        'Source records: '+p.records.length+' · Parsed replies: '+parsed.length,
        'Reply timestamps recorded: '+withTime+'/'+parsed.length,
        'Source search nodes: unknown unless explicitly present in a reply',
        'Dropped older collector records: '+(p.droppedRecords||0),
        'SHA-256: '+selected.id].join('\n');
    }
    async function refresh(id){
      const options=await store.list(),select=$('[data-input="snapshots"]');select.replaceChildren();
      const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=options.length?'Choose a saved snapshot':'No saved snapshots';select.appendChild(placeholder);
      for(const item of options){const option=document.createElement('option');option.value=item.id;option.textContent=(item.label||item.fen.split(' ')[1]+' to move')+' · '+(item.createdAt||'time unknown')+' · '+item.records+' replies';select.appendChild(option);}
      if(id){select.value=id;selected=await store.get(id);}else if(selected&&options.some(s=>s.id===selected.id)){select.value=selected.id;}else selected=null;
      const mode=store.status(),context=await host.getContext?.();$('.research-storage').textContent=(context?.evidenceMode==='offline'?'OFFLINE REPLAY · ':'LIVE DATA · ')+(mode.persistent?'Saved in this browser':'Temporary memory only; export to keep')+' · Up to 30 snapshots / 16 MB. Export JSON to move evidence between devices.';
      summary();
    }
    async function currentSnapshot(){
      if(selected)return selected;
      const available=await host.getEvidence?.();
      if(available)return E.validate(available);
      const captured=await host.captureEvidence?.();
      if(!captured)throw new Error('Wait for a completed analysis, then save its evidence.');
      return E.validate(captured);
    }
    function saveFile(value,name){
      const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    function san(move,fen){
      try{const b=new root.Chess(fen),m=root.ChessDCC.play(b,move);return m?m.san:move||'—';}catch(_){return move||'—';}
    }
    function render(result){
      lastResult=result;const container=$('.research-results');container.replaceChildren();
      const title=document.createElement('h3');title.textContent=result.kind==='engine-node-comparison'?'Engine node comparison':'Frozen evidence comparison';container.appendChild(title);
      const table=document.createElement('table'),thead=document.createElement('thead'),tr=document.createElement('tr');
      const isEngine=result.kind==='engine-node-comparison';
      for(const text of ['Policy','Move',isEngine?'Actual nodes':'Queries','Coverage','Stockfish score']){const th=document.createElement('th');th.textContent=text;tr.appendChild(th);}thead.appendChild(tr);table.appendChild(thead);
      const body=document.createElement('tbody');
      for(const row of result.rows){const tr=document.createElement('tr');const values=[row.label,san(row.move,result.fen),
        isEngine?(row.nodes===null?'unknown':Number(row.nodes).toLocaleString()):row.requests+'/'+row.requestAllowance,
        row.id==='raw'||row.id==='raw-engine'?'root':row.complete?'complete':(row.missingQueries?.length||0)+' missing · '+(row.coverage||'partial'),
        row.adjudication?((row.adjudication.scoreCp/100).toFixed(2)+' · loss '+row.adjudication.lossToBestObservedCp+' cp'):'unknown'];
        for(const text of values){const td=document.createElement('td');td.textContent=text;tr.appendChild(td);}body.appendChild(tr);
        if(row.missingQueries?.length){const detailsTr=document.createElement('tr'),td=document.createElement('td');td.colSpan=5;const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Unobserved queries for '+row.label;details.appendChild(summary);const pre=document.createElement('pre');pre.textContent=row.missingQueries.map(q=>q.kind+' '+q.fen).join('\n');details.appendChild(pre);td.appendChild(details);detailsTr.appendChild(td);body.appendChild(detailsTr);}
      }
      table.appendChild(body);container.appendChild(table);
      for(const text of [result.budget.note,result.conclusion]){const p=document.createElement('p');p.className='research-note';p.textContent=text;container.appendChild(p);}
      if(isEngine){const note=document.createElement('p');note.className='research-note';note.textContent='Adjudication nodes: '+(result.adjudication.nodes??'unknown')+'. Scores are relative to the root player. Loss is against the best of the compared moves only.';container.appendChild(note);}
      $('[data-action="export-result"]').hidden=false;
      $('[data-action="adjudicate"]').hidden=result.kind!=='frozen-query-comparison';
      if(result.kind==='frozen-query-comparison'&&result.adjudication){const p=document.createElement('p');p.className='research-note';p.textContent=result.adjudication.note;container.appendChild(p);}
    }
    async function task(fn){
      if(controller)return;controller=new AbortController();busy(true);
      try{await fn(controller.signal);}catch(error){say(error.name==='AbortError'?'Stopped. Completed evidence remains available.':error.message||'Research failed.');}
      finally{controller=null;if(!destroyed)busy(false);}
    }
    async function action(name){
      if(name==='cancel'){controller?.abort();engine?.stop();return;}
      if(name==='import'){$('[data-input="import"]').click();return;}
      if(name==='export-result'){if(lastResult)saveFile(lastResult,'ChessDCC_comparison_'+lastResult.createdAt.replace(/[:.]/g,'-')+'.json');return;}
      if(name==='export'){const snapshot=await currentSnapshot();saveFile(snapshot,'ChessDCC_evidence_'+snapshot.id.slice(0,12)+'.json');return;}
      if(name==='delete'){if(selected){const id=selected.id;await store.remove(id);selected=null;await refresh();say('Deleted the selected snapshot from this browser.');}return;}
      if(name==='live'){if(!host.resumeLive)throw new Error('Live data control is unavailable.');await host.resumeLive();await refresh();say('Live source queries enabled again.');return;}
      if(name==='restore'){const snapshot=await currentSnapshot();if(!host.onRestore)throw new Error('Offline restore is unavailable in this page.');await host.onRestore(snapshot);say('Restored offline evidence. Uncaptured positions have no evaluation.');dialog.close();return;}
      if(name==='capture'){
        say('Capturing the current position…');
        const snapshot=await host.captureEvidence?.()||await host.getEvidence?.();
        if(!snapshot)throw new Error('No analysis evidence is available yet.');
        const saved=await store.put(E.validate(snapshot));await refresh(snapshot.id);say(saved.persistent?'Evidence saved in this browser. Export it for another device.':'Evidence captured temporarily. Export JSON to keep it.');return;
      }
      await task(async signal=>{
        if(name==='frozen'||name==='fixture'){
          let snapshot;
          if(name==='fixture'){
            say('Loading a frozen synthetic diagnostic fixture…');
            const response=await fetch(new URL('research/benchmark-fixtures.json',location.href),{signal});
            if(!response.ok)throw new Error('Could not load diagnostic fixture.');
            const pack=await response.json();snapshot=E.validate(pack.fixtures?.[0]);
          }else snapshot=await currentSnapshot();
          const result=await B.runFrozen({Chess:root.Chess,DCC:root.ChessDCC,Evidence:E,snapshot,
            budget:Number($('[data-input="budget"]').value),signal,onProgress:p=>say(p.label+' · '+p.done+'/'+p.total)});
          render(result);say((name==='fixture'?'Synthetic diagnostic':'Frozen comparison')+' complete. Review coverage before comparing selections.');
        }else if(name==='adjudicate'){
          if(!root.ChessDeepEngine)throw new Error('Browser engine module is unavailable.');
          engine=engine||root.ChessDeepEngine.create();
          const result=await B.adjudicateFrozen({engine,result:lastResult,signal,nodes:1000000,onProgress:p=>say(p.label)});
          render(result);say(result.adjudication.completeMultiPV?'Separate Stockfish assessment complete.':'Assessment stopped before a complete comparable root set.');
        }else if(name==='engine'){
          const context=await host.getContext?.();if(!context?.fen)throw new Error('No current position.');
          if(!root.ChessDeepEngine)throw new Error('Browser engine module is unavailable.');
          engine=engine||root.ChessDeepEngine.create();
          const nodes=Number($('[data-input="nodes"]').value);
          const result=await B.runEngineComparison({Chess:root.Chess,DCC:root.ChessDCC,engine,fen:context.fen,
            nodeBudget:nodes,adjudicationNodes:Math.max(1000000,nodes*4),candidates:Number($('[data-input="candidates"]').value),
            signal,onProgress:p=>say(p.label)});
          render(result);say('Engine comparison complete for the captured position. No strength conclusion is inferred from one position.');
        }
      });
    }
    dialog.addEventListener('click',event=>{
      const button=event.target.closest('button');if(!button)return;
      if(button.classList.contains('research-close')){controller?.abort();engine?.stop();dialog.close();return;}
      if(button.dataset.tab){tab(button.dataset.tab);return;}
      if(button.dataset.action)Promise.resolve(action(button.dataset.action)).catch(error=>say(error.message));
    });
    dialog.addEventListener('cancel',()=>{controller?.abort();engine?.stop();});
    $('[data-input="snapshots"]').addEventListener('change',async event=>{selected=await store.get(event.target.value);summary();});
    $('[data-input="import"]').addEventListener('change',async event=>{
      const file=event.target.files[0];if(!file)return;
      try{if(file.size>16*1024*1024)throw new Error('Evidence file exceeds 16 MB.');const snapshot=E.parse(await file.text());await store.put(snapshot);await refresh(snapshot.id);say('Imported and verified SHA-256. Integrity does not authenticate the original provider.');}catch(error){say(error.message);}finally{event.target.value='';}
    });
    return { async open(section='evidence'){tab(section);say('');await refresh();if(!dialog.open)dialog.showModal();},
      close(){controller?.abort();engine?.stop();dialog.close();},
      destroy(){destroyed=true;controller?.abort();engine?.destroy();dialog.remove();},store };
  }
  root.ChessResearchUI={create};
})(typeof globalThis!=='undefined'?globalThis:this);
