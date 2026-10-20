/* Compact Settings-only storage controls. No optional files load from inspection. */
(() => {
  'use strict';
  const store=window.ChessEngineAssetStore,section=document.getElementById('engineStorage');if(!store||!section)return;
  const modes=['sf-lite','sf-full','berserk','reckless','lc0'],names={'sf-lite':'SF Lite','sf-full':'SF Full',berserk:'Berserk',reckless:'Reckless',lc0:'LC Zero'};
  const rows=new Map();let saving=null,refreshing=false,lastEstimate=null,lastPersistence=null;
  const tr=text=>window.ChessLanguage?.translate(text)||text;
  const name=mode=>mode==='sf-full'&&window.ChessLanguage?.getLanguage()==='sl'?'SF':names[mode];
  const fileNames={verified:'Verified',missing:'Missing',partial:'Incomplete or corrupted',unknown:'Not verified','present-unverified':'Not verified'};
  const runtimeNames={supported:'Supported','route-blocked':'Offline setup pending',unsupported:'Not supported'};
  const ramNames={'not-loaded':'Not loaded',preparing:'Preparing',ready:'Ready',searching:'Analyzing',error:'Error'};
  const session=window.ChessAnalysisSession,memory=session?.engineMemory;
  const allRAM=section.querySelector('[data-engine-memory-all]'),memoryStatus=section.querySelector('[data-engine-memory-status]');
  const prepareRAM=section.querySelector('[data-engine-memory-prepare]');
  function showMemory(){
    if(!memory||!allRAM)return;
    const state=memory.getState(),ready=state.engines.filter(engine=>['ready','searching'].includes(engine.status));
    const preparing=state.engines.filter(engine=>engine.status==='preparing'),failed=state.engines.filter(engine=>engine.status==='error');
    allRAM.checked=state.policy==='all';prepareRAM.hidden=state.policy!=='all';prepareRAM.disabled=state.warming;
    memoryStatus.setAttribute('translate','no');memoryStatus.textContent=tr('Ready in RAM')+': '+ready.length+(state.policy==='all'?' / '+state.engines.length:'')+
      (ready.length?' · '+ready.map(engine=>name(engine.mode)).join(', '):'')+
      (preparing.length?' · '+tr('Preparing')+' '+preparing.map(engine=>name(engine.mode)).join(', '):'')+
      (failed.length?' · '+failed.map(engine=>name(engine.mode)+': '+engine.error).join('; '):'');
    for(const engine of state.engines){const row=rows.get(engine.mode);if(row){row.ram.textContent='RAM: '+tr(ramNames[engine.status]||'Not verified')+(engine.error?' · '+engine.error:'');row.remove.disabled=!!saving||engine.status==='searching'||engine.status==='preparing'||!row.last?.savedBytes;}}
  }
  if(memory){
    memory.subscribe(showMemory);showMemory();
    allRAM.addEventListener('change',()=>{session.configure({engineMemoryPolicy:allRAM.checked?'all':'one'});showMemory();});
    prepareRAM.addEventListener('click',()=>void memory.warmAll());
    section.querySelector('[data-engine-memory-release]').addEventListener('click',async()=>{
      try{await memory.releaseIdle();notice.textContent='Idle engines released from RAM. Saved local files are kept.';}catch(error){notice.textContent=error.message;}
    });
    const resume=()=>{if(session.getSettings().engineMemoryPolicy==='all')void memory.warmAll();};
    if(document.readyState==='complete')resume();else window.addEventListener('load',resume,{once:true});
    window.addEventListener('pageshow',event=>{if(event.persisted)resume();});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)resume();});
  }
  const size=n=>(Number(n||0)/1048576).toFixed(1)+' MiB';
  const usage=section.querySelector('[data-engine-usage]'),notice=section.querySelector('[data-engine-notice]');
  const sourceStatus=document.createElement('p');sourceStatus.className='engine-storage-source';sourceStatus.setAttribute('translate','no');section.append(sourceStatus);
  function showSource(){const c=window.ChessLabHost?.getContext?.(),e=c?.evidenceCoverage;
    sourceStatus.textContent=e?tr('Offline replay uses captured replies only.')+' '+tr('Captured replies')+': '+e.captured+' · '+tr('Hits')+': '+e.hits+' · '+tr('Missing')+': '+e.misses.length+' · '+tr('Dropped')+': '+e.dropped+' · '+tr('Budget denied')+': '+e.denied+'.':tr('Live CDB needs a network connection. A verified local engine can work offline.');
    sourceStatus.textContent+=' '+tr('Assistant availability depends on its host and endpoint.');
  }
  function showUsage(){usage.setAttribute('translate','no');usage.textContent=lastEstimate&&Number.isFinite(lastEstimate.quota)&&Number.isFinite(lastEstimate.usage)?tr('Origin storage estimate')+': '+size(lastEstimate.usage)+' / '+size(lastEstimate.quota)+'. ':tr('Storage estimate is unavailable.')+' ';usage.textContent+=tr(lastPersistence===null?'Persistence API is unavailable.':lastPersistence?'Persistence granted.':'Persistence not granted.');}
  function show(state){
    const row=rows.get(state.mode);if(!row)return;
    row.last=state;row.title.textContent=name(state.mode)+(state.mode==='sf-full'?' · '+row.pkg.variant:'');
    const busy=['saving','waiting'].includes(state.status),own=saving?.mode===state.mode;
    row.status.textContent=busy?tr(state.status==='waiting'?'Waiting for another tab':state.phase==='local'?'Loading locally':state.phase==='downloading'?'Saving':'Loading files')+' · '+size(state.loaded)+' / '+size(state.total):tr('Local files')+': '+tr(fileNames[state.files]||'Not verified')+' · '+tr('Runtime')+': '+tr(runtimeNames[state.runtime]||'Not verified')+' · '+tr('Offline')+': '+tr(state.offlineReady?'Ready':'Not ready');
    row.status.title=state.message||state.shell?.reason||'';
    row.bytes.textContent=(state.mode==='sf-lite'?tr('PWA core')+' · ':'')+size(state.savedBytes)+' / '+size(state.total??row.pkg?.bytes);
    row.save.textContent=tr(own?'Cancel':state.status==='ready'?'Verify saved files':['incomplete','error','quota'].includes(state.status)?'Retry / Repair':'Save for offline');
    row.save.disabled=!!saving&&!own||state.status==='unsupported'||state.mode==='sf-lite';
    row.remove.hidden=state.mode==='sf-lite';row.remove.disabled=!!saving||busy||!state.savedBytes;
    showMemory();
  }
  async function refresh(){
    if(refreshing||saving)return;refreshing=true;
    try{const shellReport=await store.inspectShell();for(const mode of modes){if(saving)break;show(await store.inspect(mode,{verifyHashes:true,shellReport}));}
      lastEstimate=await store.estimate();lastPersistence=await store.persisted();showUsage();showSource();
    }catch(e){notice.textContent=e.message;}finally{refreshing=false;}
  }
  for(const mode of modes){
    let pkg=null,unsupported=null;try{pkg=mode==='sf-lite'?null:store.select(mode);}catch(e){pkg={bytes:0,variant:'unavailable'};unsupported=e.message;}
    const element=document.createElement('div');element.className='engine-storage-row';element.dataset.engineStorage=mode;
    const title=document.createElement('strong');title.textContent=name(mode)+(mode==='sf-full'?' · '+pkg.variant:'');title.setAttribute('translate','no');
    const status=document.createElement('small');status.setAttribute('role','status');status.textContent='Checking local files…';
    const bytes=document.createElement('small');bytes.className='engine-storage-bytes';
    const ram=document.createElement('small');ram.className='engine-storage-ram';ram.setAttribute('translate','no');ram.textContent='RAM: '+tr('Not loaded');status.setAttribute('translate','no');bytes.setAttribute('translate','no');
    const save=document.createElement('button');save.type='button';save.className='btn';save.textContent='Save for offline';save.title=pkg?'Save verified '+size(pkg.bytes)+' of optional runtime files':'SF Lite is already included in the PWA';
    const remove=document.createElement('button');remove.type='button';remove.className='btn';remove.textContent='Remove local files';
    const actions=document.createElement('div');actions.className='engine-storage-actions';actions.append(save,remove);
    element.append(title,status,bytes,ram,actions);section.querySelector('[data-engine-rows]').append(element);
    rows.set(mode,{element,pkg,title,status,bytes,ram,save,remove});
    if(unsupported)show({mode,status:'unsupported',message:'Not supported · '+unsupported,savedBytes:0});
    if(mode==='sf-lite'){save.hidden=true;remove.hidden=true;show({mode,status:'included',files:'unknown',runtime:'route-blocked',offlineReady:false,message:'Included in shell; not yet verified',savedBytes:0});}
    save.addEventListener('click',async()=>{
      if(saving?.mode===mode){saving.controller.abort();return;}
      if(saving)return;
      const controller=new AbortController();saving={mode,controller};notice.textContent='Saving '+names[mode]+' ('+size(pkg.bytes)+'). You can cancel; verified parts are kept for Repair.';
      for(const row of rows.values()){row.save.disabled=row!==rows.get(mode);row.remove.disabled=true;}
      try{await store.install(mode,{signal:controller.signal});const s=await store.inspect(mode,{verifyHashes:true});notice.textContent=name(mode)+' · '+tr(s.offlineReady?'Saved and verified for offline.':'Saved files; offline setup still needs verification.');}
      catch(e){notice.textContent=e.name==='AbortError'?'Saving cancelled. Retry / Repair continues from verified files.':e.message;}
      finally{saving=null;await refresh();}
    });
    remove.addEventListener('click',async()=>{
      if(!window.confirm('Remove only '+names[mode]+' local engine files?'+(mode==='berserk'?' This also removes the original cached Berserk NNUE.':'')+' Saved games and Studies are kept.'))return;
      try{await memory?.releaseIdle(mode);await store.remove(mode);notice.textContent=names[mode]+' local files removed.';}catch(e){notice.textContent=e.message;}
      await refresh();
    });
  }
  store.subscribe(state=>{show(state);});
  const refreshButton=document.createElement('button');refreshButton.type='button';refreshButton.className='btn';refreshButton.textContent=tr('Refresh offline status');section.append(refreshButton);refreshButton.onclick=()=>void refresh();
  document.addEventListener('chess:language',()=>{for(const row of rows.values())if(row.last)show(row.last);refreshButton.textContent=tr('Refresh offline status');showUsage();showSource();showMemory();});
  section.addEventListener('toggle',()=>{if(section.open)void refresh();});
  section.querySelector('[data-engine-persist]').addEventListener('click',async()=>{
    try{const result=await store.requestPersistence();notice.textContent=!result.supported?'This browser has no storage persistence API.':result.granted?'Persistence granted by the browser. Device policies can still remove data.':'Persistence was not granted. Saved files remain subject to browser eviction.';await refresh();}catch(e){notice.textContent=e.message;}
  });
  window.addEventListener('online',()=>{if(section.open)void refresh();});
  window.addEventListener('offline',()=>{showSource();if(section.open)void refresh();});
  window.ChessLabHost?.onChange?.(()=>{if(section.open)showSource();});showSource();
  window.addEventListener('pagehide',()=>saving?.controller.abort());
})();
