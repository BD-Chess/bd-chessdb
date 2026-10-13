/* Independent, position-bound local analyses. No numerical blending. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.ChessEngineCards=api;
})(typeof window==='object'?window:globalThis,function(root){
  'use strict';
  const fallbackModes=['sf-lite','sf-full','berserk'];
  const fallbackRoles={'sf-lite':'SF','sf-full':'SF',berserk:'BER',reckless:'RLE',lc0:'LC0'};
  function create(host){
    const session=host.session||root.ChessAnalysisSession;
    const registry=host.registry||root.ChessEngineRegistry;
    const available=()=>registry?.modes?.().filter(mode=>registry.supported(mode))||fallbackModes;
    const roleFor=mode=>registry?.roleFor?.(mode)||fallbackRoles[mode];
    const label=mode=>registry?.label?.(mode)||({'sf-lite':'Stockfish Lite','sf-full':'Stockfish Full',berserk:'Berserk',reckless:'Reckless',lc0:'LCZero'}[mode]||mode);
    const now=()=>root.performance?.now?.()??Date.now();
    const results=new Map(),jobs=new Map(),queue=[];
    let serial=0,batch=null,destroyed=false,draining=false;
    let following=false,followedPosition=null,followTimer=null,followSerial=0;
    const context=()=>host.getContext();
    const mobile=()=>session.capabilities('sf-full').mobile;
    const capacity=()=>mobile()?1:Math.max(1,Math.min(2,(session.capabilities('sf-full').hardwareConcurrency||2)-1));
    const key=(fen,mode)=>fen+'|'+mode;
    const changed=()=>host.onState?.();
    const positionKey=ctx=>JSON.stringify([ctx.fen,ctx.positionHistory||null]);
    function baseTime(ctx=context()){
      const saved=Number(ctx.settings?.analysisTimeMs??session.getSettings?.()?.analysisTimeMs);
      return Number.isSafeInteger(saved)&&saved>0?Math.min(saved,14400000):(mobile()?5000:15000);
    }
    function timedValue(job,value,status){
      const actualSearchMs=value.actualSearchMs??value.searchElapsedMs??Math.max(0,now()-(job.searchStarted??now()));
      return {...value,mode:job.mode,status,jobId:'card-'+job.startedAt+'-'+job.mode+'-'+job.id,sessionId:'cards-'+job.startedAt,generation:job.id,startedAt:job.startedAt,positionHistory:job.options.history||null,
        requestedDepth:null,requestedTimeMs:job.options.movetime,requestedBudget:{movetime:job.options.movetime,depth:null,nodes:null},
        queueWaitMs:Math.max(0,(job.loadingStarted??now())-job.queuedAt),
        initializationMs:Math.max(0,(job.analyzeStarted??now())-(job.loadingStarted??now()))+(Number(value.initializationMs)||0),
        actualSearchMs,stopReason:value.stopReason||(status==='stopped'?job.stopReason||'user-stop':status==='complete'?'time-budget':null)};
    }
    function cancelFollow(){++followSerial;clearTimeout(followTimer);followTimer=null;}
    function scheduleFollow(){
      cancelFollow();
      const ctx=context(),signature=positionKey(ctx);
      if(!following||destroyed||!ctx.canAnalyze||signature===followedPosition)return;
      const token=followSerial;
      // One current-position run after rapid navigation; late positions never publish.
      followTimer=setTimeout(()=>{
        followTimer=null;const current=context();
        if(token!==followSerial||!following||destroyed||!current.canAnalyze||positionKey(current)!==signature)return;
        followedPosition=signature;
        void analyzeAll({automatic:true});
      },100);
    }
    function setFollowing(value){
      following=!!value;cancelFollow();followedPosition=null;
      if(following)scheduleFollow();
      else if(batch?.automatic)stopAll();
      changed();
    }
    const live=job=>!job.cancelled&&!destroyed&&context().fen===job.fen&&JSON.stringify(context().positionHistory||null)===JSON.stringify(job.options.history||null)&&jobs.get(job.mode)===job;
    function get(mode,fen=context().fen){
      const value=results.get(key(fen,mode)),ctx=context();
      if(!value)return null;
      if(ctx.fen===fen&&JSON.stringify(value.positionHistory||null)!==JSON.stringify(ctx.positionHistory||null))return null;
      return value;
    }
    function state(role){
      const job=[...jobs.values()].find(x=>roleFor(x.mode)===role);
      const mode=job?.mode||(role==='SF'?context().settings?.sfCardMode||'sf-lite':available().find(mode=>roleFor(mode)===role));
      const result=get(mode),variant=mode==='sf-full'?'Full':'Lite';
      const seconds=value=>Number.isFinite(Number(value))?(Number(value)/1000).toFixed(1)+'s':null;
      const searched=seconds(result?.actualSearchMs??result?.searchElapsedMs),requested=seconds(result?.requestedTimeMs??result?.limits?.movetime);
      const reached=mode==='lc0'?(result?.visits??result?.nodes):result?.depth??result?.linesDepth??result?.lines?.[0]?.depth;
      const metrics=result?[searched&&('Search '+searched+(requested?' / '+requested:'')),Number.isFinite(reached)&&(mode==='lc0'?reached.toLocaleString()+' visits':'Depth '+reached),result.stopReason].filter(Boolean).join(' · '):null;
      return {working:!!job,disabled:!context().canAnalyze||!available().includes(mode),
        title:job?'Stop '+label(mode):'Analyze '+label(mode)+'; click again for more time',
        note:job?(job.phase==='queued'?'Queued · Stop':job.phase==='loading'?(job.progress?.loaded?`Downloading ${(job.progress.loaded/1048576).toFixed(1)}${job.progress.total?' / '+(job.progress.total/1048576).toFixed(1):''} MiB · Stop`:mode==='berserk'?'Loading NNUE · Stop':'Loading · Stop'):'Analyzing · Stop'):
          result?.error?'Error: '+result.error:result?.stopped?'Stopped · '+(metrics||'partial'):metrics||null,
        variant:role==='SF'?variant:null};
    }
    function stop(mode,reason='user-stop'){
      const job=jobs.get(mode);if(!job)return;
      job.cancelled=true;job.stopReason=reason;job.controller.abort();job.engine?.destroy();
      jobs.delete(mode);const i=queue.indexOf(job);if(i>=0)queue.splice(i,1);
      if(job.snapshot){const value={...job.snapshot,stopped:true,status:'stopped',stopReason:reason,actualSearchMs:Math.max(job.snapshot.actualSearchMs||0,now()-(job.searchStarted??now()))};results.set(key(job.fen,mode),value);
        if(context().fen===job.fen&&JSON.stringify(context().positionHistory||null)===JSON.stringify(job.options.history||null))host.onResult?.(value,job.options);}
      job.resolve(null);finishBatch();changed();pump();
    }
    function stopAll(reason='user-stop'){cancelFollow();draining=true;batch=null;for(const mode of [...jobs.keys()])stop(mode,reason);draining=false;changed();}
    function finishBatch(){
      if(batch&&!batch.modes.some(mode=>jobs.has(mode))){batch=null;changed();}
    }
    function remember(value,options){
      if(!available().includes(value.mode))return;
      results.set(key(value.fen,value.mode),value);
      if(results.size>150)results.delete(results.keys().next().value);
      host.onResult?.(value,options);changed();
    }
    async function run(job){
      job.phase='loading';job.loadingStarted=now();changed();
      try{
        job.engine=(host.backendFor||session.backendFor)(job.mode,host.Chess).create({Chess:host.Chess});
        await job.engine.prepare({signal:job.controller.signal,onProgress:progress=>{if(live(job)){job.progress=progress;changed();}}});
        if(!live(job))return;
        job.phase='searching';job.analyzeStarted=now();job.searchStarted=job.analyzeStarted;changed();
        const value=await job.engine.analyze({...job.options,signal:job.controller.signal,onSearchStarted:info=>{if(live(job)&&Number.isFinite(info?.timestamp))job.searchStarted=info.timestamp;},onInfo:(_info,value)=>{
          if(!live(job))return;
          job.snapshot=timedValue(job,value,'running');
          host.onResult?.(job.snapshot,job.options);changed();
        }});
        if(!live(job))return;
        remember(timedValue(job,value,value.stopped?'stopped':'complete'),job.options);
      }catch(error){
        if(live(job)&&error.name!=='AbortError')remember(timedValue(job,{fen:job.fen,lines:[],error:error.message,stopReason:'error'},'failed'),job.options);
      }finally{
        job.engine?.destroy();
        if(jobs.get(job.mode)===job)jobs.delete(job.mode);
        job.resolve(get(job.mode,job.fen));finishBatch();changed();pump();
      }
    }
    function pump(){
      if(destroyed||draining)return;
      let count=[...jobs.values()].filter(x=>x.phase!=='queued').length;
      while(queue.length&&count<capacity()){
        const job=queue.shift();if(!live(job)){stop(job.mode);continue;}
        count++;void run(job);
      }
    }
    function analyze(mode,{reuse=false,all=false,automatic=false,timeOverride}={}){
      const ctx=context();
      if(!ctx.canAnalyze||!available().includes(mode))return Promise.resolve(null);
      const previous=get(mode,ctx.fen);
      if(reuse&&previous?.lines?.length)return Promise.resolve(previous);
      const current=jobs.get(mode);if(current)return reuse?current.promise:(stop(mode),Promise.resolve(null));
      host.beforeStart?.();
      // Lite and Full share one Stockfish card, and cannot occupy it simultaneously.
      for(const other of ['sf-lite','sf-full'])if(other!==mode&&roleFor(other)===roleFor(mode))stop(other);
      const base=baseTime(ctx),priorTime=Number(previous?.requestedTimeMs)||0;
      const requested=Number(timeOverride);
      const movetime=Number.isSafeInteger(requested)&&requested>0?Math.min(requested,14400000):
        !reuse&&!all&&!automatic&&previous?.lines?.length?Math.min(14400000,Math.max(base,priorTime)*2):base;
      const job={mode,fen:ctx.fen,id:++serial,phase:'queued',cancelled:false,controller:new AbortController(),queuedAt:now(),startedAt:new Date().toISOString(),
        options:{fen:ctx.fen,movetime,multiPV:Math.min(5,Number(ctx.settings?.topN)||5),history:ctx.positionHistory}};
      job.promise=new Promise(resolve=>{job.resolve=resolve;});jobs.set(mode,job);queue.push(job);changed();pump();return job.promise;
    }
    function analyzeAll({automatic=false}={}){
      if(!automatic){cancelFollow();if(following)followedPosition=positionKey(context());}
      if(batch){if(automatic){batch.automatic=true;return Promise.resolve([]);}stopAll();return Promise.resolve([]);}
      const ctx=context();if(!ctx.canAnalyze)return Promise.resolve([]);
      const variant=ctx.settings?.sfCardMode||'sf-lite';
      const modes=registry?.participants?.(variant)||[variant,'berserk'];
      const base=baseTime(ctx);
      for(const mode of modes){const job=jobs.get(mode);if(job&&job.options.movetime!==base)stop(mode,'batch-base-time');}
      batch={modes,automatic};changed();
      return Promise.all(modes.map(mode=>{
        const job=jobs.get(mode);if(!job)return analyze(mode,{all:true,automatic});
        return job.promise;
      })).finally(()=>{finishBatch();changed();});
    }
    function ingest(snapshot){
      for(const [mode,child]of Object.entries(snapshot.children||{[snapshot.mode]:snapshot})){
        if(!available().includes(mode)||!child.lines?.length)continue;
        results.set(key(snapshot.fen,mode),{...child,fen:snapshot.fen,mode,status:child.status||snapshot.status,
          positionHistory:child.limits?.history||(typeof snapshot.positionHistory==='object'?snapshot.positionHistory:null),
          requestedDepth:child.limits?.depth||snapshot.requestedBudget?.depth||null,requestedTimeMs:child.limits?.movetime||snapshot.requestedBudget?.movetime||null});
      }
    }
    function positionChanged(){for(const [mode,job]of [...jobs])if(!live(job))stop(mode,'position-change');scheduleFollow();changed();}
    const hidden=()=>{if(root.document?.hidden)stopAll('page-hidden');else{followedPosition=null;scheduleFollow();}};
    root.document?.addEventListener('visibilitychange',hidden);const pagehide=()=>stopAll('page-hidden');root.addEventListener?.('pagehide',pagehide);
    let cpu=session.getSettings?.().sfFullThreadsRequested;
    const unsubscribe=session.subscribeSettings?.(settings=>{if(settings.sfFullThreadsRequested!==cpu){cpu=settings.sfFullThreadsRequested;stopAll();}});
    return {get,state,analyze,analyzeAll,ingest,positionChanged,stop,stopAll,setFollowing,isFollowing:()=>following,isRunning:()=>jobs.size>0,isAllRunning:()=>!!batch,
      destroy(){destroyed=true;stopAll();unsubscribe?.();root.document?.removeEventListener('visibilitychange',hidden);root.removeEventListener?.('pagehide',pagehide);}};
  }
  return {create};
});
