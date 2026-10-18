/* Compact Settings-only storage controls. No optional files load from inspection. */
(() => {
  'use strict';
  const store=window.ChessEngineAssetStore,section=document.getElementById('engineStorage');if(!store||!section)return;
  const modes=['sf-lite','sf-full','berserk','reckless','lc0'],names={'sf-lite':'SF Lite','sf-full':'SF Full',berserk:'Berserk',reckless:'Reckless',lc0:'LC Zero'};
  const rows=new Map();let saving=null,refreshing=false;
  const session=window.ChessAnalysisSession,memory=session?.engineMemory;
  const allRAM=section.querySelector('[data-engine-memory-all]'),memoryStatus=section.querySelector('[data-engine-memory-status]');
  const prepareRAM=section.querySelector('[data-engine-memory-prepare]');
  function showMemory(){
    if(!memory||!allRAM)return;
    const state=memory.getState(),ready=state.engines.filter(engine=>['ready','searching'].includes(engine.status));
    const preparing=state.engines.filter(engine=>engine.status==='preparing'),failed=state.engines.filter(engine=>engine.status==='error');
    allRAM.checked=state.policy==='all';prepareRAM.hidden=state.policy!=='all';prepareRAM.disabled=state.warming;
    memoryStatus.textContent='Ready in RAM: '+ready.length+(state.policy==='all'?' / '+state.engines.length:'')+
      (ready.length?' · '+ready.map(engine=>names[engine.mode]).join(', '):'')+
      (preparing.length?' · Preparing '+preparing.map(engine=>names[engine.mode]).join(', '):'')+
      (failed.length?' · '+failed.map(engine=>names[engine.mode]+': '+engine.error).join('; '):'');
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
  function show(state){
    const row=rows.get(state.mode);if(!row)return;
    const busy=['saving','waiting'].includes(state.status),own=saving?.mode===state.mode;
    row.status.textContent=busy?(state.status==='waiting'?'Waiting for another tab':(state.phase==='local'?'Loading locally · ':state.phase==='downloading'?'Saving · ':'Loading files · ')+size(state.loaded)+' / '+size(state.total)):(state.message||'Online only');
    row.bytes.textContent=state.mode==='sf-lite'?'PWA core':size(state.savedBytes)+' / '+size(row.pkg?.bytes);
    row.save.textContent=own?'Cancel':state.status==='ready'?'Verify saved files':['incomplete','error','quota'].includes(state.status)?'Retry / Repair':'Save for offline';
    row.save.disabled=!!saving&&!own||state.status==='unsupported'||state.mode==='sf-lite';
    row.remove.hidden=state.mode==='sf-lite';row.remove.disabled=!!saving||busy||!state.savedBytes;
  }
  async function refresh(){
    if(refreshing||saving)return;refreshing=true;
    try{for(const mode of modes){if(saving)break;show(await store.inspect(mode,{verifyHashes:true}));}
      const e=await store.estimate(),persisted=await store.persisted();
      usage.textContent=e&&e.quota?'Origin storage estimate: '+size(e.usage)+' used / '+size(e.quota)+' quota. '+(persisted?'Persistence granted.':'Persistence not granted.'):'Storage estimate is unavailable.';
    }catch(e){notice.textContent=e.message;}finally{refreshing=false;}
  }
  for(const mode of modes){
    let pkg=null,unsupported=null;try{pkg=mode==='sf-lite'?null:store.select(mode);}catch(e){pkg={bytes:0,variant:'unavailable'};unsupported=e.message;}
    const element=document.createElement('div');element.className='engine-storage-row';element.dataset.engineStorage=mode;
    const title=document.createElement('strong');title.textContent=names[mode]+(mode==='sf-full'?' · '+pkg.variant:'');
    const status=document.createElement('small');status.setAttribute('role','status');status.textContent='Checking local files…';
    const bytes=document.createElement('small');bytes.className='engine-storage-bytes';
    const save=document.createElement('button');save.type='button';save.className='btn';save.textContent='Save for offline';save.title=pkg?'Save verified '+size(pkg.bytes)+' of optional runtime files':'SF Lite is already included in the PWA';
    const remove=document.createElement('button');remove.type='button';remove.className='btn';remove.textContent='Remove local files';
    const actions=document.createElement('div');actions.className='engine-storage-actions';actions.append(save,remove);
    element.append(title,status,bytes,actions);section.querySelector('[data-engine-rows]').append(element);
    rows.set(mode,{element,pkg,status,bytes,save,remove});
    if(unsupported)show({mode,status:'unsupported',message:'Not supported · '+unsupported,savedBytes:0});
    if(mode==='sf-lite'){save.hidden=true;remove.hidden=true;show({mode,status:'included',message:'Included in PWA shell',savedBytes:0});}
    save.addEventListener('click',async()=>{
      if(saving?.mode===mode){saving.controller.abort();return;}
      if(saving)return;
      const controller=new AbortController();saving={mode,controller};notice.textContent='Saving '+names[mode]+' ('+size(pkg.bytes)+'). You can cancel; verified parts are kept for Repair.';
      for(const row of rows.values()){row.save.disabled=row!==rows.get(mode);row.remove.disabled=true;}
      try{await store.install(mode,{signal:controller.signal});notice.textContent=names[mode]+' saved. Reopen LAB offline to use the saved engine.';}
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
  section.addEventListener('toggle',()=>{if(section.open)void refresh();});
  section.querySelector('[data-engine-persist]').addEventListener('click',async()=>{
    try{const result=await store.requestPersistence();notice.textContent=!result.supported?'This browser has no storage persistence API.':result.granted?'Persistence granted by the browser. Device policies can still remove data.':'Persistence was not granted. Saved files remain subject to browser eviction.';await refresh();}catch(e){notice.textContent=e.message;}
  });
  window.addEventListener('online',()=>{if(section.open)void refresh();});
  window.addEventListener('pagehide',()=>saving?.controller.abort());
})();
