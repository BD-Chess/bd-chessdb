/* Optional LAB runtime storage. Public immutable files only; user data has no writes here.
 * A READY receipt is committed last. Original Berserk NNUE stays in its existing IDB.
 * Each file is verified with bounded memory; no second combined WASM is stored.
 */
(function(root,factory){
  const api=factory(root,typeof module==='object'&&module.exports?require('./8zc-engine-assets-manifest.js'):root.ChessEngineAssetManifest,
    typeof module==='object'&&module.exports?require('./8zc-sha256.js'):root.ChessAssetSHA256);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.ChessEngineAssetStore=api;
})(typeof window==='object'?window:globalThis,function(root,manifest,hashing){
  'use strict';
  function create(env=root,definition=manifest){
    const base=new URL('./',env.document?.baseURI||env.location?.href||'http://localhost/chess/');
    const PREFIX='chessbest-CURRENT-engine-assets-v1-',DB='ChessBest:CURRENT:engine-assets:v1';
    const states=new Map(),listeners=new Set(),receipts=new Map();let network=null;
    const now=()=>env.performance?.now?.()??Date.now();
    const error=(name,message)=>Object.assign(new Error(message),{name});
    const abort=signal=>{if(signal?.aborted)throw error('AbortError','Engine file operation cancelled');};
    const url=path=>{const u=new URL(path,base);if(u.origin!==base.origin||!u.pathname.startsWith(base.pathname)||path.includes('..')||!(/^(vendor|engines)\//.test(path)))throw error('IntegrityError','Unapproved engine asset path');return u.href;};
    function select(mode,variant){
      if(mode==='sf-lite')return null;
      if(env.document&&(!env.Worker||!env.WebAssembly))throw error('NotSupportedError','Local WebAssembly workers are not supported');
      const chosen=variant||(mode==='sf-full'?(env.crossOriginIsolated===true&&typeof env.SharedArrayBuffer==='function'?'threaded':'single'):null);
      const pkg=definition.packages.find(p=>p.mode===mode&&(!chosen||p.variant===chosen));
      if(!pkg||!/^[a-f0-9]{64}$/.test(pkg.identity))throw error('NotSupportedError','Unsupported engine package');
      if(pkg.variant==='threaded'&&!(env.crossOriginIsolated===true&&typeof env.SharedArrayBuffer==='function'))throw error('NotSupportedError','SF Full threaded requires an isolated host');
      pkg.files.forEach(f=>{url(f.path);if(!/^[a-f0-9]{64}$/.test(f.sha256)||!Number.isSafeInteger(f.bytes)||f.bytes<1)throw error('IntegrityError','Invalid pinned engine manifest');});return pkg;
    }
    const cacheName=p=>PREFIX+p.identity;
    const marker=p=>new URL('__engine-cache__/'+p.identity+'/ready.json',base).href;
    const available=()=>!!(env.caches&&env.crypto?.subtle&&env.indexedDB);
    const routeReady=()=>env.navigator?.serviceWorker?.controller?.scriptURL===new URL('engine-sw.js',base).href;
    async function waitRoute(signal){
      if(!env.navigator?.serviceWorker)throw error('StorageUnavailableError','Offline engine routing is unavailable');
      const start=now();while(!routeReady()){abort(signal);if(now()-start>30000)throw error('StorageUnavailableError','Offline setup pending. Keep CURRENT open or activate Update ready.');await sleep(100,signal);}
    }
    const emit=(p,value)=>{const state={mode:p.mode,variant:p.variant,total:p.bytes,...states.get(p.identity),...value};states.set(p.identity,state);for(const fn of listeners){try{fn(state);}catch(_){}}return state;};
    function transaction(work){
      return new Promise((resolve,reject)=>{
        if(!env.indexedDB)return reject(error('StorageUnavailableError','Engine storage is unavailable'));
        let db,result,settled=false;
        const finish=e=>{if(settled)return;settled=true;clearTimeout(timer);db?.close();e?reject(e):resolve(result);};
        const timer=setTimeout(()=>finish(error('StorageUnavailableError','Engine storage timed out')),4000);
        let request;try{request=env.indexedDB.open(DB,1);}catch(e){finish(e);return;}
        request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('leases'))request.result.createObjectStore('leases',{keyPath:'id'});};
        request.onerror=()=>finish(request.error);request.onblocked=()=>finish(error('StorageUnavailableError','Engine storage is blocked'));
        request.onsuccess=()=>{db=request.result;if(settled){db.close();return;}
          const tx=db.transaction('leases','readwrite');
          try{work(tx.objectStore('leases'),v=>{result=v;});}catch(e){tx.abort();finish(e);return;}
          tx.oncomplete=()=>finish();tx.onerror=tx.onabort=()=>finish(tx.error||error('StorageUnavailableError','Engine storage transaction failed'));
        };
      });
    }
    function lease(id,owner,release=false){return transaction((s,done)=>{const r=s.get(id);r.onsuccess=()=>{
      const old=r.result,t=Date.now();if(release){if(old?.owner===owner)s.delete(id);done(true);}
      else if(!old||old.expires<t||old.owner===owner){s.put({id,owner,expires:t+30000});done(true);}else done(false);
    };});}
    function sleep(ms,signal){return new Promise((resolve,reject)=>{abort(signal);const cancel=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);reject(error('AbortError','Cancelled'));};const timer=setTimeout(()=>{signal?.removeEventListener('abort',cancel);resolve();},ms);signal?.addEventListener('abort',cancel,{once:true});});}
    async function locked(p,signal,fn){
      const id='write:'+p.identity,owner=env.crypto.randomUUID?.()||Date.now()+'-'+Math.random(),started=now();
      for(;;){abort(signal);if(await lease(id,owner))break;if(now()-started>120000)throw error('StorageUnavailableError','Another tab is still saving this engine');emit(p,{status:'waiting',message:'Waiting for another tab',loaded:0});await sleep(200,signal);}
      const renew=setInterval(()=>{lease(id,owner).catch(()=>{});},5000);
      try{abort(signal);return await fn();}finally{clearInterval(renew);await lease(id,owner,true).catch(()=>{});}
    }
    async function useCount(p){return transaction((s,done)=>{const r=s.getAll();r.onsuccess=()=>{const t=Date.now(),rows=r.result;for(const v of rows)if(v.expires<t)s.delete(v.id);done(rows.filter(v=>v.id.startsWith('use:'+p.identity+':')&&v.expires>=t).length);};});}
    async function acquireUsage(mode,signal){
      const p=select(mode);if(!p||!available())return ()=>{};
      try{return await locked(p,signal,async()=>{
        const owner=env.crypto.randomUUID?.()||Date.now()+'-'+Math.random(),id='use:'+p.identity+':'+owner;
        await lease(id,owner);const timer=setInterval(()=>{lease(id,owner).catch(()=>{});},5000);let released=false;
        return ()=>{if(released)return;released=true;clearInterval(timer);return lease(id,owner,true).catch(()=>{});};
      });}catch(e){if(e.name==='AbortError')throw e;return ()=>{};}
    }
    async function verify(response,f,signal){
      if(!response||(response instanceof Uint8Array?false:!response.ok))throw error('IncompleteError','Missing '+f.path);abort(signal);
      const bytes=response instanceof Uint8Array?response:new Uint8Array(await response.arrayBuffer());abort(signal);
      if(bytes.length!==f.bytes)throw error('IntegrityError','Incomplete engine file: '+f.path);
      const digest=await env.crypto.subtle.digest('SHA-256',bytes),hex=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');abort(signal);
      if(hex!==f.sha256)throw error('IntegrityError','Engine SHA-256 mismatch: '+f.path);return bytes;
    }
    async function inspect(mode,{verifyHashes=false,signal}={}){
      if(mode==='sf-lite')return {mode,status:'included',message:'Included in PWA shell',savedBytes:0,total:0};
      let p;try{p=select(mode);}catch(e){return {mode,status:'unsupported',message:e.message,savedBytes:0};}
      if(!available())return emit(p,{status:'unavailable',message:'Storage unavailable · online analysis available',savedBytes:0});
      try{
        const cache=await env.caches.open(cacheName(p));let receipt=null,savedBytes=0,bad=false;
        try{receipt=await (await cache.match(marker(p)))?.json();}catch(_){}
        for(const f of p.files){abort(signal);const response=await cache.match(url(f.path));if(!response){bad=true;continue;}
          if(verifyHashes){try{await verify(response,f,signal);savedBytes+=f.bytes;}catch(e){if(e.name==='AbortError')throw e;bad=true;}}
          else if(Number(response.headers.get('Content-Length'))===f.bytes&&response.headers.get('X-ChessBest-SHA256')===f.sha256)savedBytes+=f.bytes;
          else bad=true;
        }
        if(p.network){const present=await network?.check(verifyHashes);if(present)savedBytes+=p.network.bytes;else bad=true;}
        const ready=!bad&&receipt?.identity===p.identity&&receipt?.bytes===p.bytes;
        return emit(p,{status:ready?'ready':savedBytes?'incomplete':'online',message:ready?(routeReady()?'Saved locally & verified':'Saved files · offline setup pending'):savedBytes?'Incomplete or corrupted':'Online only',savedBytes,receipt:ready?receipt:null});
      }catch(e){if(e.name==='AbortError')throw e;return emit(p,{status:'unavailable',message:e.name==='QuotaExceededError'?'Storage quota exceeded':e.message,savedBytes:0});}
    }
    async function install(mode,{signal,onProgress,variant}={}){
      const p=select(mode,variant);if(!p)return {mode,status:'included',assetCacheHit:true,downloadedBytes:0,integrityMs:0,assetLoadMs:0};
      if(!available())throw error('StorageUnavailableError','Engine storage is unavailable');
      await waitRoute(signal);
      return locked(p,signal,async()=>{
        const start=now(),cache=await env.caches.open(cacheName(p));let loaded=0,downloadedBytes=0,localBytes=0,integrityMs=0,downloadWaitMs=0,localReadMs=0;
        const combined=p.combined?new hashing.SHA256():null,partSet=new Set(p.combined?.parts||[]);
        let readyBefore;try{readyBefore=await (await cache.match(marker(p)))?.json();}catch(_){}
        const progress=(phase,extra={})=>{const value={phase,loaded,total:p.bytes,...extra};emit(p,{status:'saving',message:phase==='local'?'Loading locally':phase==='downloading'?'Downloading':'Verifying engine files',...value});onProgress?.(value);};
        progress('local');
        // Fail before a large transfer if the browser supplies a clearly inadequate quota.
        const estimate=await env.navigator?.storage?.estimate?.().catch(()=>null);
        if(estimate&&estimate.quota>0){let present=0;for(const f of p.files){const r=await cache.match(url(f.path));if(r&&Number(r.headers.get('Content-Length'))===f.bytes)present+=f.bytes;}
          if(p.network&&await network?.check(false))present+=p.network.bytes;
          if(estimate.usage+(p.bytes-present)+1048576>estimate.quota)throw error('QuotaExceededError','Insufficient engine storage quota');}
        try{
          for(const f of p.files){
            abort(signal);let bytes=null,response=await cache.match(url(f.path)),t=now();
            if(response){try{const readStart=now(),b=new Uint8Array(await response.arrayBuffer());localReadMs+=now()-readStart;t=now();bytes=await verify(b,f,signal);localBytes+=f.bytes;}catch(e){if(e.name==='AbortError')throw e;}integrityMs+=now()-t;}
            if(!bytes){
              if(env.navigator?.onLine===false)throw error('OfflineError','Offline engine package is incomplete; reconnect and Repair');
              progress('loading',{asset:f.path});
              const downloadStart=now(),response=await env.fetch(url(f.path),{signal,cache:'no-cache',headers:{'X-ChessBest-Engine-Save':'1'}});
              // Finish reading separately so integrity time never includes Internet wait.
              if(!response.ok)throw error('IncompleteError','Engine file HTTP '+response.status);
              const buffer=new Uint8Array(await response.arrayBuffer());downloadWaitMs+=now()-downloadStart;t=now();bytes=await verify(buffer,f,signal);integrityMs+=now()-t;
              // ResourceTiming, not fetch invocation alone, distinguishes wire traffic from HTTP cache.
              const timing=env.performance?.getEntriesByName?.(url(f.path))?.slice(-1)[0];
              const phase=timing?.transferSize>0?'downloading':'loading';downloadedBytes=downloadedBytes===null||!timing?null:downloadedBytes+(timing.transferSize>0?(timing.encodedBodySize||0):0);
              abort(signal);await cache.put(url(f.path),new Response(bytes,{headers:{'Content-Type':/\.(?:m?js)$/.test(f.path)?'application/javascript':f.path.endsWith('.wasm')?'application/wasm':'application/octet-stream','Content-Length':String(f.bytes),'X-ChessBest-SHA256':f.sha256}}));
              loaded+=f.bytes;progress(phase,{asset:f.path});
            }else{loaded+=f.bytes;progress('local',{asset:f.path});}
            if(partSet.has(f.path)){t=now();combined.update(bytes);integrityMs+=now()-t;}
            bytes=null;await sleep(0,signal);
          }
          if(combined&&combined.hex()!==p.combined.sha256)throw error('IntegrityError','Combined WASM SHA-256 mismatch');
          if(p.network){if(!network)throw error('StorageUnavailableError','Berserk network storage unavailable');
            const had=await network.check(true);
            if(!had){await network.ensure(signal,value=>{progress(value.phase,{asset:'NNUE',loaded:loaded+value.loaded});});downloadedBytes=null;
              if(!await network.check(true))throw error('StorageUnavailableError','Berserk NNUE was not saved');}
            loaded+=p.network.bytes;if(had)localBytes+=p.network.bytes;}
          abort(signal);
          const receipt={schema:definition.schema,identity:p.identity,mode:p.mode,variant:p.variant,version:p.version,bytes:p.bytes,files:p.files,combined:p.combined||null,network:p.network||null,verifiedAt:new Date().toISOString()};
          await cache.put(marker(p),new Response(JSON.stringify(receipt),{headers:{'Content-Type':'application/json'}}));
          const metrics={status:'ready',assetCacheHit:localBytes===p.bytes,localBytes,downloadedBytes,networkMeasurement:'ResourceTiming; null means unavailable/NNUE not measured here',integrityMs,downloadWaitMs,localReadMs,assetLoadMs:now()-start,identity:p.identity,variant:p.variant};receipts.set(p.identity,metrics);
          emit(p,{status:'ready',message:'Saved locally & verified',savedBytes:p.bytes,loaded:p.bytes,receipt});return metrics;
        }catch(e){
          // Keep previously good generations and verified parts. Never commit a fake READY.
          if(!readyBefore||readyBefore.identity!==p.identity)await cache.delete(marker(p)).catch(()=>{});
          emit(p,{status:e.name==='QuotaExceededError'?'quota':e.name==='AbortError'?'incomplete':'error',message:e.name==='AbortError'?'Saving cancelled · Repair to continue':e.message,savedBytes:loaded});throw e;
        }
      });
    }
    async function prepare(mode,opts={}){
      // A working secure SW route is required to serve the complete Worker/import closure.
      if(mode==='sf-lite')return {status:'included',assetCacheHit:true,downloadedBytes:0,integrityMs:0,assetLoadMs:0};
      try{return await install(mode,opts);}catch(e){
        if(['StorageUnavailableError','QuotaExceededError','SecurityError','InvalidStateError','UnknownError'].includes(e.name)&&env.navigator?.onLine!==false)
          return {status:'online-only',assetCacheHit:false,downloadedBytes:null,assetLoadMs:0,storageError:e.message};
        throw e;
      }
    }
    async function remove(mode){
      const p=select(mode);if(!p)return false;
      return locked(p,null,async()=>{if(await useCount(p)||p.network&&network?.busy?.())throw error('InUseError','Engine is prepared or running. Stop analysis, then change position or reopen CURRENT before removing its files.');
        if(p.network)await network?.remove();await env.caches.delete(cacheName(p));receipts.delete(p.identity);emit(p,{status:'online',message:'Online only',savedBytes:0,loaded:0,receipt:null});return true;});
    }
    return {select,cacheName,marker,inspect,install,prepare,remove,acquireUsage,setNetworkProvider:provider=>{network=provider;},
      subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},getState:mode=>{const p=select(mode);return p?states.get(p.identity):null;},
      lastMetrics:mode=>{const p=select(mode);return p?receipts.get(p.identity):null;},
      estimate:async()=>env.navigator?.storage?.estimate?.()||null,
      requestPersistence:async()=>({supported:!!env.navigator?.storage?.persist,granted:await env.navigator?.storage?.persist?.()||false}),
      persisted:async()=>env.navigator?.storage?.persisted?.()||false,
      routeReady,packages:()=>definition.packages.filter(p=>p.mode!=='sf-full'||p.variant===select('sf-full').variant),PREFIX,DB};
  }
  return {...create(),create};
});
