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
    const results=new Map(),jobs=new Map(),queue=[],attempts=new Map(),recentActivity=new Map();
    let serial=0,batch=null,destroyed=false,draining=false,preparedSlot=null;
    // Every retained adapter resets its actual search state; one slot caps mobile RAM.
    const reusable=mode=>['sf-lite','sf-full','berserk','reckless','lc0'].includes(mode);
    let cooldownUntil=0,pumpTimer=null,lastPosition=null;
    const retired=new WeakSet();
    function dispose(engine){if(!engine||retired.has(engine))return;retired.add(engine);engine.destroy();if(mobile())cooldownUntil=now()+(host.teardownGraceMs??350);}
    function releasePrepared(){if(preparedSlot)dispose(preparedSlot.engine);preparedSlot=null;}
    let following=false,followedPosition=null,followTimer=null,followSerial=0;
    const context=()=>host.getContext();
    const mobile=()=>session.capabilities('sf-full').mobile;
    // CPU is per engine. All owns one concurrent worker per available family.
    const capacity=()=>batch?batch.modes.length:mobile()?1:Math.max(1,Math.min(2,(session.capabilities('sf-full').hardwareConcurrency||2)-1));
    const key=(fen,mode)=>fen+'|'+mode;
    const changed=()=>host.onState?.();
    const disarm=()=>{following=false;followedPosition=null;cancelFollow();};
    const positionKey=ctx=>JSON.stringify([ctx.fen,ctx.positionHistory||null]);
    lastPosition=positionKey(context());
    function baseTime(ctx=context()){
      const saved=Number(ctx.settings?.analysisTimeMs??session.getSettings?.()?.analysisTimeMs);
      return Number.isSafeInteger(saved)&&saved>0?Math.min(saved,14400000):(mobile()?5000:15000);
    }
    function timedValue(job,value,status){
      const actualSearchMs=value.actualSearchMs??value.searchElapsedMs??Math.max(0,now()-(job.searchStarted??now()));
      return {...value,mode:job.mode,status,preparedEngineReused:!!job.preparationReused,jobId:'card-'+job.startedAt+'-'+job.mode+'-'+job.id,sessionId:'cards-'+job.startedAt,generation:job.id,startedAt:job.startedAt,positionHistory:job.options.history||null,
        requestedDepth:null,requestedTimeMs:job.options.movetime,requestedBudget:{movetime:job.options.movetime,depth:null,nodes:null},
        queueWaitMs:Math.max(0,(job.loadingStarted??now())-job.queuedAt),
        initializationMs:Math.max(0,(job.analyzeStarted??now())-(job.loadingStarted??now()))+(Number(value.initializationMs)||0),
        workerInitializationMs:Math.max(0,(job.analyzeStarted??now())-(job.loadingStarted??now())-(Number(value.assetLoadMs)||0))+(Number(value.initializationMs)||0),
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
      if(value&&!following)host.beforeFollow?.();
      following=!!value;cancelFollow();followedPosition=null;
      if(following)scheduleFollow();
      else if(batch?.automatic)stopAll();
      changed();
    }
    const live=job=>{
      if(job.cancelled||destroyed||jobs.get(job.mode)!==job)return false;
      const ctx=context();
      return ctx.fen===job.fen&&JSON.stringify(ctx.positionHistory||null)===JSON.stringify(job.options.history||null);
    };
    function get(mode,fen,current){
      const ctx=current||context();if(fen==null)fen=ctx.fen;
      const value=results.get(key(fen,mode));
      if(!value)return null;
      if(ctx.fen===fen&&JSON.stringify(value.positionHistory||null)!==JSON.stringify(ctx.positionHistory||null))return null;
      return value;
    }
    function state(role){
      // One coherent context for this paint; obtaining history can be costly.
      const ctx=context();
      const job=[...jobs.values()].find(x=>roleFor(x.mode)===role);
      const mode=job?.mode||(role==='SF'?ctx.settings?.sfCardMode||'sf-lite':available().find(mode=>roleFor(mode)===role));
      const result=get(mode,ctx.fen,ctx),attempt=attempts.get(key(ctx.fen,mode)),variant=mode==='sf-full'?'Full':'Lite';
      const seconds=value=>Number.isFinite(Number(value))?(Number(value)/1000).toFixed(1)+'s':null;
      const searched=seconds(result?.actualSearchMs??result?.searchElapsedMs),requested=seconds(result?.requestedTimeMs??result?.limits?.movetime);
      const reached=mode==='lc0'?(result?.visits??result?.nodes):result?.linesDepth??result?.lines?.[0]?.depth??result?.depth;
      const coverage=result?.coverage?.status==='bestmove-mismatch'?'Verified set retained; native best move differs':
        result?.coverage?.status==='unvalidated'?'Legality unverified':result?.coverage?.status==='partial'?'Partial line coverage':null;
      const metrics=result?[searched&&('Search '+searched+(requested?' / '+requested:'')),Number.isFinite(reached)&&(mode==='lc0'?reached.toLocaleString()+' visits':'Depth '+reached),coverage,result.stopReason].filter(Boolean).join(' · '):null;
      return {mode,working:!!job,batchParticipant:!!batch?.modes.some(candidate=>roleFor(candidate)===role),disabled:!job&&(!ctx.canAnalyze||!available().includes(mode)),
        title:job?'Stop '+label(mode)+' and Cards each move':'New search: '+label(mode)+'; search again with a larger budget',
        note:job?(job.phase==='queued'?'Queued · Stop':job.phase==='searching'?'Analyzing · Stop':
          job.progress?.loaded?`${job.progress.phase==='downloading'?'Downloading':job.progress.phase==='local'?'Loading locally':job.progress.phase==='preparing'?'Preparing engine':'Loading files'} ${(job.progress.loaded/1048576).toFixed(1)}${job.progress.total?' / '+(job.progress.total/1048576).toFixed(1):''} MiB · Stop`:'Preparing engine · Stop'):
          attempt?'Stopped · '+attempt+(result?.lines?.length?' · retained result':' · no result'):
          result?.error?'Error: '+result.error:result?.stopped?'Stopped · '+(metrics||'partial'):metrics||null,
        variant:role==='SF'?variant:null};
    }
    function stop(mode,reason='user-stop'){
      if(reason==='user-stop'||reason==='shared-stop'||reason==='takeover'){disarm();changed();}
      const job=jobs.get(mode);if(!job)return;
      recentActivity.set(mode,{...jobActivity(job),state:'stopped',stopReason:reason});
      job.cancelled=true;job.stopReason=reason;clearTimeout(job.guard);clearTimeout(job.paintTimer);job.controller.abort();dispose(job.engine);
      if(reason.includes('watchdog')){attempts.set(key(job.fen,mode),reason);if(attempts.size>150)attempts.delete(attempts.keys().next().value);}
      jobs.delete(mode);const i=queue.indexOf(job);if(i>=0)queue.splice(i,1);
      if(job.snapshot){const value={...job.snapshot,stopped:true,status:'stopped',stopReason:reason,forcedStop:reason.includes('watchdog'),partial:true,actualSearchMs:Math.max(job.snapshot.actualSearchMs||0,now()-(job.searchStarted??now()))};results.set(key(job.fen,mode),value);
        const ctx=context();if(ctx.fen===job.fen&&JSON.stringify(ctx.positionHistory||null)===JSON.stringify(job.options.history||null))host.onResult?.(value,job.options);}
      job.resolve(null);finishBatch();changed();pump();
    }
    function stopAll(reason='user-stop'){
      if(reason==='page-hidden')cancelFollow();else disarm();
      clearTimeout(pumpTimer);pumpTimer=null;releasePrepared();draining=true;batch=null;
      // Retire every generation before abort callbacks can drain another child.
      for(const job of jobs.values())job.cancelled=true;
      for(const mode of [...jobs.keys()])stop(mode,reason);
      queue.length=0;draining=false;changed();
    }
    function jobActivity(job){
      return {id:'card-'+job.startedAt+'-'+job.mode+'-'+job.id,mode:job.mode,label:label(job.mode),
        state:job.phase,positionKey:job.positionKey,fen:job.fen,result:job.snapshot||null,
        budget:{movetime:job.options.movetime},progress:job.progress?{...job.progress}:null,
        searchElapsedMs:job.searchStarted==null?null:Math.max(0,now()-job.searchStarted)};
    }
    function activitySnapshot(){
      const children=new Map(recentActivity);
      for(const [mode,job]of jobs)children.set(mode,jobActivity(job));
      return {owner:'cards',following,running:jobs.size>0,pending:!!followTimer,children:[...children.values()]};
    }
    function finishBatch(){
      if(batch&&!batch.scheduling&&!batch.modes.some(mode=>jobs.has(mode))){batch=null;changed();}
    }
    function remember(value,options){
      if(!available().includes(value.mode))return;
      results.set(key(value.fen,value.mode),value);
      const job=jobs.get(value.mode);
      if(job)recentActivity.set(value.mode,{...jobActivity(job),state:value.status,error:value.error||null,result:value,
        searchElapsedMs:value.actualSearchMs??null});
      if(results.size>150)results.delete(results.keys().next().value);
      host.onResult?.(value,options);changed();
    }
    function paint(job){
      clearTimeout(job.paintTimer);job.paintTimer=null;
      if(!live(job)||!job.snapshot)return;
      job.lastPaint=now();host.onResult?.(job.snapshot,job.options);changed();
    }
    async function run(job){
      job.phase='loading';job.loadingStarted=now();changed();
      try{
        host.beforeRun?.();
        const retained=preparedSlot?.mode===job.mode?preparedSlot:null;
        job.preparationReused=!!retained;
        if(retained)preparedSlot=null;else releasePrepared();
        if(mobile()&&now()<cooldownUntil)await new Promise(resolve=>setTimeout(resolve,cooldownUntil-now()));
        if(!live(job))return;
        job.engine=retained?.engine||(host.backendFor||session.backendFor)(job.mode,host.Chess).create({Chess:host.Chess});
        const progress=value=>{if(live(job)){job.progress=value;changed();}};
        // Also settle a non-responsive loader/adapter; abort owns worker teardown.
        job.guard=setTimeout(()=>stop(job.mode,'preparation-watchdog'),host.preparationTimeoutMs??120000);
        await job.engine.prepare({signal:job.controller.signal,onProgress:progress});
        if(!live(job))return;
        job.phase='preparing';job.analyzeStarted=now();changed();
        const value=await job.engine.analyze({...job.options,signal:job.controller.signal,onProgress:progress,onSearchStarted:info=>{if(live(job)){
          clearTimeout(job.guard);job.phase='searching';job.searchStarted=Number.isFinite(info?.timestamp)?info.timestamp:now();
          job.guard=setTimeout(()=>stop(job.mode,'time-watchdog'),job.options.movetime+(host.timeGraceMs??2500));changed();
        }},onInfo:(_info,value)=>{
          if(!live(job))return;
          if(job.phase!=='searching'){job.phase='searching';job.searchStarted=now();clearTimeout(job.guard);job.guard=setTimeout(()=>stop(job.mode,'time-watchdog'),job.options.movetime+(host.timeGraceMs??2500));}
          job.snapshot=timedValue(job,value,'running');
          // Coalesce expensive board/card paints; retain every latest valid result
          // independently so Stop/final completion never loses a newer snapshot.
          const delay=(host.paintIntervalMs??100)-(now()-(job.lastPaint??-Infinity));
          if(delay<=0)paint(job);else if(!job.paintTimer)job.paintTimer=setTimeout(()=>paint(job),delay);
        }});
        if(!live(job))return;
        remember(timedValue(job,value,value.stopped?'stopped':'complete'),job.options);
      }catch(error){
        if(live(job)&&error.name!=='AbortError')remember(timedValue(job,{fen:job.fen,lines:[],error:error.message,stopReason:'error'},'failed'),job.options);
      }finally{
        clearTimeout(job.guard);clearTimeout(job.paintTimer);
        if(live(job)&&!job.engine?.memoryManaged&&reusable(job.mode)&&host.canRetainPrepared?.()!==false&&get(job.mode,job.fen)?.status==='complete'&&!get(job.mode,job.fen)?.forcedStop){
          releasePrepared();preparedSlot={mode:job.mode,engine:job.engine};
        }else dispose(job.engine);
        if(jobs.get(job.mode)===job)jobs.delete(job.mode);
        job.resolve(get(job.mode,job.fen));finishBatch();changed();pump();
      }
    }
    function pump(){
      if(destroyed||draining)return;
      if(mobile()&&now()<cooldownUntil){clearTimeout(pumpTimer);pumpTimer=setTimeout(pump,cooldownUntil-now());return;}
      let count=[...jobs.values()].filter(x=>x.phase!=='queued').length;
      while(queue.length&&count<capacity()){
        const job=queue.shift();if(!live(job)){stop(job.mode,'position-change');continue;}
        count++;void run(job);
      }
    }
    function analyze(mode,{reuse=false,all=false,automatic=false,timeOverride}={}){
      const ctx=context();
      const current=[...jobs.values()].find(job=>roleFor(job.mode)===roleFor(mode));
      if(current){
        if(reuse)return current.mode===mode?current.promise:Promise.resolve(get(mode,ctx.fen));
        if(!all||current.mode===mode){stop(current.mode);return Promise.resolve(null);}
        // All explicitly requests its selected variant; replace a different
        // running Stockfish variant instead of omitting that family from All.
        stop(current.mode,'batch-variant-change');
      }
      if(!ctx.canAnalyze||!available().includes(mode))return Promise.resolve(null);
      const previous=get(mode,ctx.fen);
      if(reuse&&previous?.lines?.length)return Promise.resolve(previous);
      attempts.delete(key(ctx.fen,mode));
      host.beforeStart?.();
      // Lite and Full share one Stockfish card, and cannot occupy it simultaneously.
      for(const other of ['sf-lite','sf-full'])if(other!==mode&&roleFor(other)===roleFor(mode))stop(other,'variant-change');
      const base=baseTime(ctx),priorTime=Number(previous?.requestedTimeMs)||0;
      const requested=Number(timeOverride);
      const movetime=Number.isSafeInteger(requested)&&requested>0?Math.min(requested,14400000):
        !reuse&&!all&&!automatic&&previous?.lines?.length?Math.min(14400000,Math.max(base,priorTime)*2):base;
      if(!jobs.size)recentActivity.clear();
      for(const other of recentActivity.keys())if(other!==mode&&roleFor(other)===roleFor(mode))recentActivity.delete(other);
      const job={mode,fen:ctx.fen,id:++serial,phase:'queued',cancelled:false,controller:new AbortController(),queuedAt:now(),startedAt:new Date().toISOString(),
        positionKey:positionKey(ctx),
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
      batch={modes,automatic,scheduling:true};changed();
      const pending=modes.map(mode=>{
        const job=jobs.get(mode);if(!job)return analyze(mode,{all:true,automatic});
        return job.promise;
      });
      if(batch)batch.scheduling=false;
      finishBatch();changed();
      return Promise.all(pending).finally(()=>{finishBatch();changed();});
    }
    function ingest(snapshot){
      for(const [mode,child]of Object.entries(snapshot.children||{[snapshot.mode]:snapshot})){
        if(!available().includes(mode)||!child.lines?.length)continue;
        results.set(key(snapshot.fen,mode),{...child,fen:snapshot.fen,mode,status:child.status||snapshot.status,
          positionHistory:child.limits?.history||(typeof snapshot.positionHistory==='object'?snapshot.positionHistory:null),
          requestedDepth:child.limits?.depth||snapshot.requestedBudget?.depth||null,requestedTimeMs:child.limits?.movetime||snapshot.requestedBudget?.movetime||null});
      }
    }
    function positionChanged(){const signature=positionKey(context());if(lastPosition!==null&&signature!==lastPosition)releasePrepared();lastPosition=signature;for(const [mode,job]of [...jobs])if(!live(job))stop(mode,'position-change');scheduleFollow();changed();}
    const hidden=()=>{if(root.document?.hidden)stopAll('page-hidden');else{followedPosition=null;scheduleFollow();}};
    root.document?.addEventListener('visibilitychange',hidden);const pagehide=()=>stopAll('page-hidden');root.addEventListener?.('pagehide',pagehide);
    let computePolicy=JSON.stringify([session.getSettings?.().sfFullThreadsRequested,session.getSettings?.().hashMB]);
    const unsubscribe=session.subscribeSettings?.(settings=>{const next=JSON.stringify([settings.sfFullThreadsRequested,settings.hashMB]);if(next!==computePolicy){computePolicy=next;stopAll();}});
    return {get,state,analyze,analyzeAll,ingest,positionChanged,stop,stopRole(role,reason='user-stop'){const armed=following;const job=[...jobs.values()].find(x=>roleFor(x.mode)===role);stop(job?.mode,reason);return !!job||armed;},stopAll,setFollowing,activitySnapshot,isFollowing:()=>following,isRunning:()=>jobs.size>0,isAllRunning:()=>!!batch,
      destroy(){destroyed=true;stopAll();clearTimeout(pumpTimer);unsubscribe?.();root.document?.removeEventListener('visibilitychange',hidden);root.removeEventListener?.('pagehide',pagehide);}};
  }
  return {create};
});
