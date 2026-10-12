/* Independent, position-bound local analyses. No numerical blending. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.ChessEngineCards=api;
})(typeof window==='object'?window:globalThis,function(root){
  'use strict';
  const available=['sf-lite','sf-full','berserk'];
  const roleFor=mode=>mode==='berserk'?'BER':'SF';
  function create(host){
    const session=host.session||root.ChessAnalysisSession;
    const results=new Map(),jobs=new Map(),queue=[];
    let serial=0,batch=null,destroyed=false,draining=false;
    const context=()=>host.getContext();
    const mobile=()=>session.capabilities('sf-full').mobile;
    const capacity=()=>mobile()?1:Math.max(1,Math.min(2,(session.capabilities('sf-full').hardwareConcurrency||2)-1));
    const key=(fen,mode)=>fen+'|'+mode;
    const changed=()=>host.onState?.();
    const live=job=>!job.cancelled&&!destroyed&&context().fen===job.fen&&JSON.stringify(context().positionHistory||null)===JSON.stringify(job.options.history||null)&&jobs.get(job.mode)===job;
    function get(mode,fen=context().fen){
      const value=results.get(key(fen,mode)),ctx=context();
      if(!value)return null;
      if(ctx.fen===fen&&JSON.stringify(value.positionHistory||null)!==JSON.stringify(ctx.positionHistory||null))return null;
      return value;
    }
    function state(role){
      const job=[...jobs.values()].find(x=>roleFor(x.mode)===role);
      const mode=role==='BER'?'berserk':context().settings?.sfCardMode||'sf-lite';
      const result=get(mode),variant=mode==='sf-full'?'Full':'Lite';
      return {working:!!job,disabled:!context().canAnalyze,
        title:job?'Stop '+(role==='BER'?'Berserk':'Stockfish '+variant):'Analyze '+(role==='BER'?'Berserk':'Stockfish '+variant)+'; click again to deepen',
        note:job?(job.phase==='queued'?'Queued · Stop':job.phase==='loading'?(mode==='berserk'?'Loading NNUE · Stop':'Loading · Stop'):'Analyzing · Stop'):
          result?.error?'Error: '+result.error:result?.stopped?'Stopped · partial':result?.limited?'Time limit · partial':null,
        variant:role==='SF'?variant:null};
    }
    function stop(mode){
      const job=jobs.get(mode);if(!job)return;
      job.cancelled=true;clearTimeout(job.timer);job.controller.abort();job.engine?.destroy();
      jobs.delete(mode);const i=queue.indexOf(job);if(i>=0)queue.splice(i,1);
      if(job.snapshot){const value={...job.snapshot,mode,stopped:true,status:'stopped'};results.set(key(job.fen,mode),value);host.onResult?.(value,job.options);}
      job.resolve(null);finishBatch();changed();pump();
    }
    function stopAll(){draining=true;batch=null;for(const mode of [...jobs.keys()])stop(mode);draining=false;changed();}
    function finishBatch(){
      if(batch&&!batch.modes.some(mode=>jobs.has(mode))){batch=null;changed();}
    }
    function remember(value,options){
      if(!available.includes(value.mode))return;
      results.set(key(value.fen,value.mode),value);
      if(results.size>150)results.delete(results.keys().next().value);
      host.onResult?.(value,options);changed();
    }
    async function run(job){
      job.phase='loading';changed();
      try{
        job.engine=(host.backendFor||session.backendFor)(job.mode,host.Chess).create({Chess:host.Chess});
        await job.engine.prepare({signal:job.controller.signal});
        if(!live(job))return;
        job.phase='searching';changed();
        job.timer=setTimeout(()=>{job.limited=true;job.engine.stop();},job.maxSearchMs);
        const value=await job.engine.analyze({...job.options,signal:job.controller.signal,onInfo:(_info,value)=>{
          if(!live(job))return;
          job.snapshot={...value,mode:job.mode,status:'running',positionHistory:job.options.history||null,requestedDepth:job.options.depth};
          host.onResult?.(job.snapshot,job.options);changed();
        }});
        if(!live(job))return;
        remember({...value,mode:job.mode,status:value.stopped?'stopped':'complete',limited:!!job.limited,
          positionHistory:job.options.history||null,requestedDepth:job.options.depth},job.options);
      }catch(error){
        if(live(job)&&error.name!=='AbortError')remember({fen:job.fen,mode:job.mode,lines:[],status:'failed',error:error.message},job.options);
      }finally{
        clearTimeout(job.timer);job.engine?.destroy();
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
    function analyze(mode,{reuse=false,all=false,depthOverride}={}){
      const ctx=context();
      if(!ctx.canAnalyze||!available.includes(mode))return Promise.resolve(null);
      const previous=get(mode,ctx.fen);
      if(reuse&&previous?.lines?.length)return Promise.resolve(previous);
      const current=jobs.get(mode);if(current)return reuse?current.promise:(stop(mode),Promise.resolve(null));
      host.beforeStart?.();
      // Lite and Full share one Stockfish card, and cannot occupy it simultaneously.
      for(const other of ['sf-lite','sf-full'])if(other!==mode&&roleFor(other)===roleFor(mode))stop(other);
      const base=Math.max(1,Math.min(128,Number(ctx.settings?.sfAnalysisDepth)||11));
      const priorDepth=Math.max(previous?.requestedDepth||0,...(previous?.lines||[]).map(x=>x.depth||0));
      const depth=Math.min(128,depthOverride||(!reuse&&previous?.lines?.length?Math.max(base,priorDepth)+2:base));
      const job={mode,fen:ctx.fen,id:++serial,phase:'queued',cancelled:false,controller:new AbortController(),
        options:{fen:ctx.fen,depth,multiPV:Math.min(5,Number(ctx.settings?.topN)||5),history:ctx.positionHistory},
        maxSearchMs:mobile()?(all?3000:5000):(all?6000:30000)};
      job.promise=new Promise(resolve=>{job.resolve=resolve;});jobs.set(mode,job);queue.push(job);changed();pump();return job.promise;
    }
    function analyzeAll(){
      if(batch){stopAll();return Promise.resolve([]);}
      const ctx=context();if(!ctx.canAnalyze)return Promise.resolve([]);
      const modes=[ctx.settings?.sfCardMode||'sf-lite','berserk'];
      batch={modes};changed();
      return Promise.all(modes.map(mode=>{
        const job=jobs.get(mode);if(!job)return analyze(mode,{all:true});
        job.maxSearchMs=mobile()?3000:6000;
        if(job.phase==='searching'){clearTimeout(job.timer);job.timer=setTimeout(()=>{job.limited=true;job.engine.stop();},job.maxSearchMs);}
        return job.promise;
      })).finally(()=>{finishBatch();changed();});
    }
    function ingest(snapshot){
      for(const [mode,child]of Object.entries(snapshot.children||{[snapshot.mode]:snapshot})){
        if(!available.includes(mode)||!child.lines?.length)continue;
        results.set(key(snapshot.fen,mode),{...child,fen:snapshot.fen,mode,status:child.status||snapshot.status,
          positionHistory:child.limits?.history||(typeof snapshot.positionHistory==='object'?snapshot.positionHistory:null),requestedDepth:child.limits?.depth||snapshot.requestedBudget?.depth||null});
      }
    }
    function positionChanged(){for(const [mode,job]of [...jobs])if(!live(job))stop(mode);changed();}
    const hidden=()=>{if(root.document?.hidden)stopAll();};
    root.document?.addEventListener('visibilitychange',hidden);root.addEventListener?.('pagehide',stopAll);
    let cpu=session.getSettings?.().sfFullThreadsRequested;
    const unsubscribe=session.subscribeSettings?.(settings=>{if(settings.sfFullThreadsRequested!==cpu){cpu=settings.sfFullThreadsRequested;stopAll();}});
    return {get,state,analyze,analyzeAll,ingest,positionChanged,stop,stopAll,isRunning:()=>jobs.size>0,isAllRunning:()=>!!batch,
      destroy(){destroyed=true;stopAll();unsubscribe?.();root.document?.removeEventListener('visibilitychange',hidden);root.removeEventListener?.('pagehide',stopAll);}};
  }
  return {create};
});
