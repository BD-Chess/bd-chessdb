// SPDX-License-Identifier: GPL-3.0-or-later
export function create() {
  let worker=null,serial=0,destroyed=false,active=null;
  const pending=new Map();
  const abortError=()=>new DOMException('LCZero analysis cancelled','AbortError');
  function init(){
    if(destroyed)throw new Error('LCZero adapter destroyed');
    if(worker)return;
    worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module',name:'ChessBest-LCZero-Maia1900'});
    worker.onmessage=({data})=>{
      const task=pending.get(data.id);if(!task)return;
      if(data.type==='info'){task.onInfo?.({},data.snapshot);return;}
      if(data.type==='started'){task.onSearchStarted?.(data.proof);return;}
      if(data.type==='progress'){task.onProgress?.(data);return;}
      pending.delete(data.id);task.cleanup?.();if(active===data.id)active=null;
      if(data.type==='error')task.reject(new Error(data.error));
      else if(data.type==='cancelled'||data.snapshot?.stopReason==='cancelled')task.reject(abortError());
      else task.resolve(data.snapshot||data.proof||data.evaluation);
    };
    worker.onerror=event=>{for(const task of pending.values())task.reject(new Error(event.message||'LCZero Worker failure'));pending.clear();worker?.terminate();worker=null;};
  }
  function request(type,args={}) {
    init();if(args.signal?.aborted)return Promise.reject(abortError());
    const id=++serial;if(type==='analyze')active=id;
    return new Promise((resolve,reject)=>{
      const abort=()=>{if(type==='analyze')worker?.postMessage({type:'stop'});pending.delete(id);reject(abortError());};
      args.signal?.addEventListener('abort',abort,{once:true});
      const cleanup=()=>args.signal?.removeEventListener('abort',abort);
      pending.set(id,{resolve,reject,onInfo:args.onInfo,onSearchStarted:args.onSearchStarted,onProgress:args.onProgress,cleanup});
      const {fen,history,movetime,multiPV,infinite}=args;
      try{worker.postMessage({id,type,fen,history,movetime,multiPV,infinite});}
      catch(error){pending.delete(id);cleanup();if(active===id)active=null;reject(error);}
    });
  }
  return {
    prepare:args=>request('prepare',args),
    analyze:args=>{if(active!==null){const prior=pending.get(active);prior?.cleanup?.();prior?.reject(abortError());pending.delete(active);worker?.postMessage({type:'stop'});}return request('analyze',args);},
    stop(){worker?.postMessage({type:'stop'});},
    destroy(){destroyed=true;worker?.terminate();worker=null;for(const task of pending.values()){task.cleanup?.();task.reject(abortError());}pending.clear();}
  };
}
