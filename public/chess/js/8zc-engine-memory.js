/* Shared prepared engines. A lease owns one search; immutable local files have
 * their own lifetime. Retained adapters reset search state for every position. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.ChessEngineMemory=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  const aborted=()=>Object.assign(new Error('Engine preparation cancelled'),{name:'AbortError'});
  function create({modes,createEngine,keyFor=mode=>mode,canWarm=()=>true,policy='one'}){
    const entries=new Map(),listeners=new Set(),failures=new Map();
    let selectedPolicy=policy==='all'?'all':'one',serial=0,clock=0,warmGeneration=0,warming=null,warmTimer=null,paused=false;
    function restoreWarm(){
      if(selectedPolicy!=='all'||paused||!canWarm()||warmTimer)return;
      warmTimer=setTimeout(async()=>{
        warmTimer=null;
        if(warming)await warming;
        if(selectedPolicy==='all'&&!paused&&canWarm())await warmAll();
      },0);
    }
    function snapshot(){return {policy:selectedPolicy,warming:!!warming,
      engines:modes.map(mode=>{
        const entry=entries.get(keyFor(mode));
        return {mode,status:entry?(entry.prepared?(entry.searching?'searching':'ready'):'preparing'):failures.has(mode)?'error':'not-loaded',
          instanceId:entry?.id||null,error:failures.get(mode)||null};
      })};}
    function emit(){const value=snapshot();for(const fn of listeners){try{fn(value);}catch(_){}}}
    function current(entry){return entries.get(entry.key)===entry;}
    function drop(entry){
      if(!current(entry))return Promise.resolve();
      entries.delete(entry.key);entry.controller.abort();
      for(const waiter of entry.waiters.splice(0))waiter.reject(aborted());
      let disposal;try{disposal=entry.engine?.destroy();}catch(_){}
      emit();return Promise.resolve(disposal).catch(()=>{});
    }
    function trim(){
      if(selectedPolicy==='all')return;
      const idle=[...entries.values()].filter(e=>!e.owner).sort((a,b)=>b.used-a.used);
      const keep=idle.find(e=>e.prepared);
      for(const entry of idle)if(entry!==keep)void drop(entry);
    }
    function entryFor(mode,factory){
      const key=keyFor(mode);let entry=entries.get(key);
      if(!entry){
        // Changed worker options cannot share an older prepared generation.
        for(const old of entries.values())if(old.mode===mode&&old.key!==key&&!old.owner)void drop(old);
        entry={key,mode,id:'ram-'+(++serial),controller:new AbortController(),engine:null,promise:null,
          owner:null,waiters:[],prepared:false,searching:false,used:++clock};
        entries.set(key,entry);entry.factory=factory||(()=>createEngine(mode));failures.delete(mode);emit();
      }
      return entry;
    }
    async function ensure(entry,opts={}){
      if(!current(entry))throw aborted();
      if(!entry.promise){
        entry.promise=Promise.resolve().then(()=>{
          if(!current(entry)||entry.controller.signal.aborted)throw aborted();
          entry.engine=entry.factory();
          return entry.engine.prepare?.({...opts,signal:entry.controller.signal});
        }).then(()=>{
          if(!current(entry)||entry.controller.signal.aborted)throw aborted();
          entry.prepared=true;emit();return entry;
        }).catch(error=>{
          if(current(entry)){if(error.name!=='AbortError')failures.set(entry.mode,error.message);void drop(entry);}
          throw error;
        });
      }
      await entry.promise;return entry;
    }
    function claim(entry,owner,signal){
      if(signal.aborted||!current(entry))return Promise.reject(aborted());
      if(!entry.owner){entry.owner=owner;entry.used=++clock;return Promise.resolve(entry);}
      return new Promise((resolve,reject)=>{
        const waiter={owner,resolve:()=>{cleanup();resolve(entry);},reject:error=>{cleanup();reject(error);}};
        const cancel=()=>{const index=entry.waiters.indexOf(waiter);if(index>=0)entry.waiters.splice(index,1);waiter.reject(aborted());};
        const cleanup=()=>signal.removeEventListener('abort',cancel);
        signal.addEventListener('abort',cancel,{once:true});entry.waiters.push(waiter);
      });
    }
    function release(entry,owner){
      if(!current(entry)||entry.owner!==owner)return;
      entry.owner=null;entry.searching=false;entry.used=++clock;
      const waiter=entry.waiters.shift();
      if(waiter){entry.owner=waiter.owner;waiter.resolve();}
      trim();emit();
    }
    function handle(mode,factory){
      const owner={};let closed=false,entry=null,acquisition=null,controller=null,fromMemory=false;
      function stop(){
        controller?.abort();controller=null;acquisition=null;
        if(entry&&entry.owner===owner){const prepared=entry.prepared;try{entry.engine?.stop();}catch(_){}void drop(entry);if(prepared)restoreWarm();}
        entry=null;
      }
      async function acquire(opts={}){
        if(closed||opts.signal?.aborted)throw aborted();
        if(entry&&current(entry)&&entry.owner===owner)return entry;
        if(acquisition)return acquisition;
        const taskController=new AbortController();controller=taskController;
        const candidate=entryFor(mode,factory);fromMemory=candidate.prepared;
        const cancel=()=>{taskController.abort();if(candidate.owner===owner)void drop(candidate);};
        opts.signal?.addEventListener('abort',cancel,{once:true});
        const task=(async()=>{
          await claim(candidate,owner,taskController.signal);
          if(closed||taskController.signal.aborted){release(candidate,owner);throw aborted();}
          entry=candidate;
          // One default idle engine; active comparison children remain independent.
          if(selectedPolicy==='one')for(const old of entries.values())if(old!==candidate&&!old.owner)void drop(old);
          await ensure(candidate,opts);
          if(closed||taskController.signal.aborted||!current(candidate))throw aborted();
          return candidate;
        })();
        acquisition=task;
        try{return await task;}
        finally{opts.signal?.removeEventListener('abort',cancel);if(acquisition===task)acquisition=null;}
      }
      return {memoryManaged:true,
        prepare:acquire,
        async analyze(opts={}){
          const owned=await acquire(opts);
          if(closed||opts.signal?.aborted||!current(owned)||owned.owner!==owner)throw aborted();
          if(owned.searching)throw new Error('This engine already has an active search');
          owned.searching=true;emit();const reused=fromMemory;
          const cancel=()=>stop();opts.signal?.addEventListener('abort',cancel,{once:true});
          try{
            const result=await owned.engine.analyze(opts);
            if(!current(owned)||owned.owner!==owner)return result;
            owned.searching=false;owned.used=++clock;fromMemory=true;
            const memory={policy:selectedPolicy,instanceId:owned.id,fromMemory:reused};
            if(result.stopped||result.forcedStop){void drop(owned);if(entry===owned)entry=null;restoreWarm();}
            emit();
            return {...result,workerReused:reused||!!result.workerReused,engineMemory:memory,
              ...(reused?{assetLoadMs:0,integrityMs:0,engineAssetStorage:{...result.engineAssetStorage,assetSource:'prepared-memory',assetLoadMs:0,integrityMs:0,downloadedBytes:0,downloadWaitMs:0,localReadMs:0,localBytes:0}}:{})};
          }catch(error){if(current(owned)&&owned.owner===owner)void drop(owned);if(entry===owned)entry=null;throw error;}
          finally{opts.signal?.removeEventListener('abort',cancel);}
        },
        stop,
        destroy(){
          if(closed)return;closed=true;controller?.abort();controller=null;
          if(entry&&entry.owner===owner){if(entry.searching||!entry.prepared){const prepared=entry.prepared;void drop(entry);if(prepared)restoreWarm();}else release(entry,owner);}
          entry=null;
        }};
    }
    async function warmAll(){
      if(selectedPolicy!=='all')return snapshot();
      paused=false;
      if(warming)return warming;
      const token=warmGeneration;
      const task=(async()=>{
        for(const mode of modes){
          if(selectedPolicy!=='all'||token!==warmGeneration)break;
          const entry=entryFor(mode);
          try{await ensure(entry);}catch(error){if(error.name!=='AbortError'&&token===warmGeneration)failures.set(mode,error.message);}
          emit();
        }
        return snapshot();
      })();
      warming=task;emit();
      try{return await task;}finally{if(warming===task)warming=null;emit();}
    }
    function setPolicy(value){
      const next=value==='all'?'all':'one';if(next===selectedPolicy)return;
      selectedPolicy=next;++warmGeneration;warming=null;
      clearTimeout(warmTimer);warmTimer=null;paused=false;
      if(next==='one')trim();emit();
      if(next==='all')void warmAll();
    }
    async function releaseIdle(mode){
      const chosen=[...entries.values()].filter(entry=>!mode||entry.mode===mode);
      if(chosen.some(entry=>entry.owner))throw new Error('Stop the active analysis before releasing this engine from RAM.');
      ++warmGeneration;warming=null;
      paused=true;clearTimeout(warmTimer);warmTimer=null;
      await Promise.all(chosen.map(drop));emit();
    }
    function clear(){paused=true;clearTimeout(warmTimer);warmTimer=null;++warmGeneration;warming=null;failures.clear();for(const entry of [...entries.values()])void drop(entry);emit();}
    return {handle,warmAll,setPolicy,releaseIdle,clear,getState:snapshot,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
  }
  return {create};
});
