/* One analysis owner; optional full engines are instantiated only by analyze(). */
(function(root, factory) {
  const api = factory(root, typeof module === 'object' && module.exports ? require('./8zc-deep-engine.js') : root.ChessDeepEngine);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.ChessAnalysisSession = api;
})(typeof window === 'object' ? window : globalThis, function(root, Deep) {
  'use strict';
  const MODES = ['auto','sf-lite','sf-full','berserk','sf-berserk'];
  const STORAGE = 'ChessBest:LAB:v2:analysis-engine-r2';
  const listeners = new Set(), instances = new Set();
  let owner = null, generation = 0, cleanupUntil = 0, sessionSerial = 0, berserkNetwork = null;
  const BERSERK_NET = Object.freeze({bytes:25201924,sha256:"9b84c340af7e45f6e07f0046235ccb327f4ae0840c8ee2c4b97b99121e5c5084",name:"berserk-9b84c340af7e.nn"});
  const NETWORK_DB = 'ChessBest:LAB:engine-networks:v1';
  let networkState = 'unchecked', networkPersistent = false, networkError = '', networkRevision = 0, restorePending = null;
  let networkWrites = Promise.resolve();
  let settings = { analysisMode:'auto', sfFullThreadsRequested:'auto', hashMB:16 };
  try { const old = JSON.parse(root.localStorage?.getItem(STORAGE) || 'null'); if (old) settings = sanitize(old); } catch (_) {}
  function sanitize(value) {
    const mode = value.analysisMode === 'sf' ? 'sf-lite' : value.analysisMode;
    const requested = value.sfFullThreadsRequested;
    return { analysisMode:MODES.includes(mode) ? mode : 'auto',
      sfFullThreadsRequested:requested === 'auto' || requested == null ? 'auto' : [1,2,4,6,8].includes(Number(requested)) ? Number(requested) : 1,
      hashMB:Math.min(64, Math.max(8, Number(value.hashMB) || 16)) };
  }
  function capabilities(mode = settings.analysisMode, environment = root) {
    const hc = Math.max(1, Number(environment.navigator?.hardwareConcurrency) || 2);
    const mobile = !!environment.matchMedia?.('(pointer: coarse)').matches || (environment.innerWidth > 0 && environment.innerWidth < 700);
    const isolated = environment.crossOriginIsolated === true && typeof environment.SharedArrayBuffer === 'function';
    const dual = mode === 'sf-berserk', full = mode === 'sf-full' || dual;
    const cap = Math.max(1, Math.min(mobile ? 2 : 8, hc - (dual ? 2 : 1)));
    const maxSFThreads = isolated ? cap : 1;
    const requested = settings.sfFullThreadsRequested;
    const auto = mobile ? 1 : hc >= 4 ? 2 : 1;
    const effectiveSFThreads = full ? Math.min(maxSFThreads, requested === 'auto' ? auto : requested) : 1;
    const totalThreads = dual ? effectiveSFThreads + 1 : mode === 'berserk' ? 1 : effectiveSFThreads;
    const label = dual ? `SF Full · ${effectiveSFThreads} + Berserk · 1` : mode === 'berserk' ? 'Berserk · 1' : full ? `SF Full · ${effectiveSFThreads}` : 'SF Lite · 1';
    const message = full && !isolated ? environment.location?.hostname?.endsWith('github.io') ? 'This GitHub Pages session is not cross-origin isolated; SF Full uses the full single-thread fallback. Multiple SF threads require an isolated host.' : 'Full single-thread fallback · host isolation is required for multiple SF threads.' : full && requested !== 'auto' && requested > maxSFThreads ? `SF threads clamped to ${maxSFThreads}; CPU resources are shared.` : 'CPU resources are shared; hardwareConcurrency is only a hint.';
    return { isolated, hardwareConcurrency:hc, mobile, maxSFThreads, effectiveSFThreads, berserkThreads:1, totalThreads,
      allocation:label, message, threadsLocked:!full || maxSFThreads === 1 };
  }
  function getSettings() { return Object.assign({}, settings, {sfFullThreadsEffective:capabilities().effectiveSFThreads,
    berserkNetworkReady:!!berserkNetwork,berserkNetworkState:networkState,berserkNetworkPersistent:networkPersistent,berserkNetworkError:networkError}); }
  function notifySettings() { for (const listener of listeners) listener(getSettings()); }
  function networkStore(operation, record) {
    return new Promise((resolve,reject) => {
      if (!root.indexedDB) return reject(new Error('Browser storage is unavailable'));
      let db, settled = false;
      const finish = (error,value) => { if (settled) return; settled=true;clearTimeout(timer);db?.close();error?reject(error):resolve(value); };
      const timer=setTimeout(()=>finish(new Error('Browser storage timed out')),4000);
      let open; try { open=root.indexedDB.open(NETWORK_DB,1); } catch(error) {finish(error);return;}
      open.onupgradeneeded=()=>{if(!open.result.objectStoreNames.contains('networks'))open.result.createObjectStore('networks',{keyPath:'id'});};
      open.onerror=()=>finish(open.error||new Error('Cannot open browser storage'));
      open.onblocked=()=>finish(new Error('Browser storage is blocked by another tab'));
      open.onsuccess=()=>{
        db=open.result;if(settled){db.close();return;}
        let tx,request;
        try {
          tx=db.transaction('networks',operation==='get'?'readonly':'readwrite');const store=tx.objectStore('networks');
          request=operation==='get'?store.get(BERSERK_NET.sha256):operation==='put'?store.put(record):store.delete(BERSERK_NET.sha256);
        } catch(error){finish(error);return;}
        tx.oncomplete=()=>finish(null,request.result);
        tx.onabort=tx.onerror=()=>finish(tx.error||new Error('Cannot save local NNUE'));
      };
    });
  }
  function queueNetworkWrite(operation,record) {
    const write=networkWrites.catch(()=>{}).then(()=>networkStore(operation,record));
    networkWrites=write;return write;
  }
  async function verifyNetwork(buffer) {
    if (!buffer || buffer.byteLength !== BERSERK_NET.bytes || !root.crypto?.subtle) throw new Error('NNUE verification requires the original Berserk 14 file and a secure browser.');
    const digest=await root.crypto.subtle.digest('SHA-256',buffer);
    const sha=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
    if(sha!==BERSERK_NET.sha256)throw new Error('This NNUE does not match berserk-9b84c340af7e.nn (25,201,924 bytes).');
    return {buffer,sha256:sha};
  }
  function restoreBerserkNetwork() {
    if(berserkNetwork||networkState==='missing'||networkState==='error')return Promise.resolve(getSettings());
    if(restorePending)return restorePending;
    const revision=networkRevision;networkState='checking';notifySettings();
    restorePending=(async()=>{
      try {
        await networkWrites.catch(()=>{});
        const stored=await networkStore('get');
        const verified=stored?await verifyNetwork(stored.buffer):null;
        if(revision!==networkRevision)return;
        berserkNetwork=verified;networkPersistent=!!verified;networkState=verified?'ready':'missing';networkError='';
      }catch(error){if(revision===networkRevision){networkState='error';networkPersistent=false;networkError=error.message;}}
      finally{restorePending=null;notifySettings();}
      return getSettings();
    })();
    return restorePending;
  }
  async function loadBerserkNetwork(file) {
    if (!file || file.size !== BERSERK_NET.bytes || typeof file.arrayBuffer !== 'function') throw new Error('Choose berserk-9b84c340af7e.nn (25,201,924 bytes).');
    const revision=++networkRevision;
    let verified;
    try{verified=await verifyNetwork(await file.arrayBuffer());}
    catch(error){if(revision===networkRevision){networkState=berserkNetwork?'ready':'missing';notifySettings();}throw error;}
    if(revision!==networkRevision)return getSettings();
    ++generation; for (const instance of instances) instance.stop();
    berserkNetwork=verified;networkPersistent=false;networkState='storing';networkError='';notifySettings();
    try {
      await queueNetworkWrite('put',{id:BERSERK_NET.sha256,buffer:verified.buffer,name:BERSERK_NET.name});
      if(revision===networkRevision)networkPersistent=true;
    }catch(error){if(revision===networkRevision)networkError=error.message;}
    if(revision===networkRevision)networkState='ready';notifySettings();
    return getSettings();
  }
  async function clearBerserkNetwork() {
    const revision=++networkRevision;++generation;for(const instance of instances)instance.stop();
    berserkNetwork=null;networkPersistent=false;networkState='removing';networkError='';notifySettings();
    try {await queueNetworkWrite('delete');if(revision===networkRevision)networkState='missing';}
    catch(error){if(revision===networkRevision){networkState='error';networkError='Could not remove the saved NNUE: '+error.message;}}
    notifySettings();return getSettings();
  }
  function configure(value) {
    const next = sanitize(Object.assign({}, settings, value));
    if (JSON.stringify(next) === JSON.stringify(settings)) return getSettings();
    ++generation; for (const instance of instances) instance.stop(); settings = next;
    try { root.localStorage?.setItem(STORAGE, JSON.stringify(settings)); } catch (_) {}
    for (const listener of listeners) listener(getSettings());
    return getSettings();
  }
  const descriptors = {
    'sf-full': {id:'stockfish-js-19.0.1-full',name:'Stockfish 19 Full',version:'19.0.1',backend:'wasm',maxThreads:8,
      source:'https://github.com/nmrugg/stockfish.js/releases/tag/v19.0.1'},
    berserk:{id:'berserk-14-wasm-scalar',name:'Berserk 14',version:'14',backend:'wasm-scalar',maxThreads:1,
      network:'berserk-9b84c340af7e.nn',source:'https://github.com/manthedan/0x88/tree/5b8d6c930168cd645dd34d646055f303fae2b5b1/engines/berserk'}
  };
  const clone = v => JSON.parse(JSON.stringify(v));
  function create(config = {}) {
    let active = null, destroyed = false, serial = 0;
    const now = () => root.performance?.now?.() ?? Date.now();
    function snapshot(job) {
      const children = {};
      for (const child of job.children) children[child.id] = Object.assign({}, child.snapshot || {fen:job.fen,lines:[]}, {
        status:child.status, error:child.error || null, jobId:child.jobId, searchStartedMs:child.searchStartedMs ?? null,
        finishedMs:child.finishedMs ?? null, threadsRequested:child.id === 'sf-full' ? job.requested : 1,
        threadsEffective:child.id === 'sf-full' ? job.caps.effectiveSFThreads : 1});
      const complete = job.children.every(c => c.status === 'complete');
      const anyFailed = job.children.some(c => c.status === 'failed');
      const base = job.children.length === 1 ? clone(Object.values(children)[0]) : {fen:job.fen,lines:[],limits:job.options};
      return Object.assign(base, {mode:job.mode,children,sessionId:job.id,generation:job.generation,
        stopped:job.stopped, status:job.stopped ? 'stopped' : complete ? 'complete' : anyFailed ? 'partial' : 'running',
        dualComplete:job.children.length === 2 && complete, partial:!complete,
        requestedBudget:job.requestedBudget, effectiveBudget:job.effectiveBudget,
        allocation:job.caps,elapsedMs:now()-job.started,startedAt:job.startedAt,
        positionHistory:job.history, comparison:job.children.length === 2 ? comparison(children) : null});
    }
    function comparison(children) {
      const moves = Object.values(children).map(c => c.lines?.find(l => (l.multipv || 1) === 1)?.pv?.[0]);
      if (moves.some(m => !m)) return 'Awaiting both first moves';
      return moves[0] === moves[1] ? 'Same first move (factual comparison)' : 'Different first moves (factual comparison)';
    }
    function emit(job, force = false) {
      if (active !== job || job.generation !== generation || job.stopped) return;
      if (!force && now()-job.lastEmit < 100) return;
      job.lastEmit = now(); try { job.onInfo?.({},snapshot(job)); } catch (_) {}
    }
    function stop() {
      const job = active; if (!job) return;
      active = null; if (owner === api) owner = null; job.stopped = true;
      if (root.document && ['sf-full','berserk','sf-berserk'].includes(job.mode))
        cleanupUntil = Math.max(cleanupUntil, now() + (config.teardownGraceMs ?? 3500));
      clearTimeout(job.timer); job.signal?.removeEventListener('abort',job.abort);
      for (const child of job.children) { if (!['complete','failed'].includes(child.status)) child.status='stopped'; child.engine?.destroy(); }
      job.resolve(snapshot(job));
    }
    function analyze(options = {}) {
      if (destroyed) return Promise.reject(new Error('Analysis session destroyed'));
      if (root.document?.hidden === true) return Promise.reject(new Error('Analysis is paused while the page is hidden'));
      let validated; try { validated = Deep.limitsFor(options, config.Chess || root.Chess); } catch (e) { return Promise.reject(e); }
      if (options.signal?.aborted) return Promise.reject(Deep.abortError ? Deep.abortError() : Object.assign(new Error('Cancelled'),{name:'AbortError'}));
      stop(); if (owner && owner !== api) owner.stop(); owner = api;
      const mode = config.analysisMode || settings.analysisMode, localMode = mode === 'auto' ? 'sf-lite' : mode;
      const caps = capabilities(localMode), heavy = ['sf-full','berserk','sf-berserk'].includes(localMode);
      const ids = localMode === 'sf-berserk' ? ['sf-full','berserk'] : [localMode];
      const requestedBudget = {depth:validated.depth,nodes:validated.nodes,movetime:validated.movetime,infinite:validated.infinite};
      // Dual comparisons use equal explicit wall-clock search budgets, rather than incomparable depth limits.
      const limits = Object.assign({},validated);
      if (ids.length === 2 && limits.movetime == null && limits.nodes == null) {
        limits.depth = null; limits.infinite = false; limits.movetime = caps.mobile ? 3000 : 6000;
      }
      return new Promise((resolve,reject) => {
        const job = {id:'analysis-'+Date.now()+'-'+(++sessionSerial)+'-'+(++serial),generation,mode:localMode,caps,requested:settings.sfFullThreadsRequested,
          children:ids.map(id=>({id,status:'loading',jobId:id+'-'+Date.now()+'-'+serial})),
          fen:limits.fen,history:limits.history,options:limits,onInfo:options.onInfo,signal:options.signal,
          started:now(),startedAt:new Date().toISOString(),lastEmit:-Infinity,resolve,reject,stopped:false,requestedBudget,
          effectiveBudget:{depth:limits.depth,nodes:limits.nodes,movetime:limits.movetime,infinite:limits.infinite,
            maxSessionMs:heavy ? caps.mobile ? 30000 : 120000 : null}};
        active = job;
        job.abort = stop; job.signal?.addEventListener('abort',job.abort,{once:true});
        if (heavy) job.timer = setTimeout(stop,job.effectiveBudget.maxSessionMs);
        // No serial await: each child has its own loader, deadline, worker tree and completion.
        const preparations = [];
        for (const child of job.children) {
          try {
            const meta = child.id === 'sf-lite' ? Deep.ENGINE : descriptors[child.id];
            if (!meta) throw new Error('Unsupported engine mode');
            const base = root.document?.baseURI || 'http://localhost/chess-lab/';
            const variant = caps.isolated ? 'threaded' : 'single';
            const workerUrl = child.id === 'sf-lite' ? new URL('vendor/stockfish/stockfish-18-lite-single.js',base).href :
              child.id === 'berserk' ? new URL('vendor/berserk/v14-5b8d6c93/berserk-host.js',base).href :
                new URL('vendor/stockfish-full/v19.0.1/stockfish-19'+(variant==='single'?'-single':'')+'.js',base).href;
            const engineConfig = {Chess:config.Chess || root.Chess,workerUrl,engine:Object.assign({},meta,{variant:child.id==='sf-full'?variant:child.id==='berserk'?'scalar':'lite-single',
                wasmSHA256:child.id==='sf-full' ? variant==='threaded' ? 'a599d78d72e0722d8895be84aca8b492d12e8bba3cdfcbcbc4a64017888c6667' : '991bede2f253ebb08ff01fcc48270f4b9c8e66b12d5bd5f8d6f52eb3e3b3a740' : child.id==='berserk' ? '0cffe539d41787c8cc2963911e24fe0bdf5319bae1fe03fae243642e8cda9372' : Deep.ENGINE.wasmSHA256,
                network:child.id==='sf-full'?'nn-1a298aa575a0.nnue':child.id==='berserk'?'berserk-9b84c340af7e.nn':undefined,
                networkSHA256:child.id==='sf-full'?'1a298aa575a085434d29027978dc36867fe9c5bcea9376654b7a8eba1e52dfc2':child.id==='berserk'?'9b84c340af7e45f6e07f0046235ccb327f4ae0840c8ee2c4b97b99121e5c5084':undefined}),
              threads:child.id==='sf-full'?caps.effectiveSFThreads:1,hashMB:Math.min(settings.hashMB,caps.mobile?16:64),
              readyTimeoutMs:20000,forceTerminateOnStop:true};
            if (config.workerFactory) engineConfig.workerFactory = url => config.workerFactory(url,child.id);
            if (child.id === 'berserk' && !config.adapterFactory) {
              const factory = engineConfig.workerFactory || (url=>new root.Worker(url));
              engineConfig.workerFactory = url => {
                if(!berserkNetwork)throw new Error('Choose the local Berserk NNUE file before starting analysis.');
                const worker = factory(url), copy = berserkNetwork.buffer.slice(0);
                worker.postMessage({type:'init-network',buffer:copy},[copy]);
                return worker;
              };
            }
            child.engine = config.adapterFactory ? config.adapterFactory(child.id,engineConfig) : Deep.create(engineConfig);
            const childOptions = Object.assign({},limits,{signal:undefined,onInfo:(_info,value) => {
              if (active !== job || job.generation !== generation || job.stopped) return;
              child.snapshot=value; child.status='searching';
              if (child.searchStartedMs == null) child.searchStartedMs=now(); emit(job);
            }});
            child.launch = () => child.engine.analyze(childOptions).then(value => {
              if (active !== job || job.generation !== generation || job.stopped) return;
              child.snapshot=value; child.status=value.stopped?'stopped':'complete'; child.finishedMs=now(); child.engine.destroy(); settle(job);
            },error=>{
              if (active !== job || job.generation !== generation || job.stopped) return;
              child.status='failed'; child.error=error.message;child.finishedMs=now();child.engine.destroy();settle(job);
            });
            preparations.push(Promise.resolve().then(async () => {
              const drain = Math.max(0, cleanupUntil - now());
              if (drain) await new Promise(resolve => setTimeout(resolve, drain));
              if (active !== job || job.generation !== generation || job.stopped) return;
              if(child.id==='berserk'&&!config.adapterFactory){
                if(!berserkNetwork)await restoreBerserkNetwork();
                if(active!==job||job.generation!==generation||job.stopped)return;
                if(!berserkNetwork)throw new Error('Berserk needs berserk-9b84c340af7e.nn. Choose it once with Load NNUE, then press Start.');
              }
              return child.engine.prepare?.();
            }).then(() => {
              if (active !== job || job.generation !== generation || job.stopped) return;
              child.status='ready'; emit(job,true);
            },error => {
              if (active !== job || job.generation !== generation || job.stopped) return;
              child.status='failed'; child.error=error.message; child.finishedMs=now(); child.engine.destroy(); emit(job,true);
            }));
          } catch(error) { child.engine?.destroy(); child.status='failed'; child.error=error.message; }
        }
        Promise.allSettled(preparations).then(() => {
          if (active !== job || job.generation !== generation || job.stopped) return;
          for (const child of job.children) if (child.status === 'ready') {
            child.searchStartedMs=now(); child.status='searching';
            try { child.launch(); } catch(error) { child.engine.destroy(); child.status='failed'; child.error=error.message; }
          }
          settle(job);
        });
        emit(job,true);
      });
    }
    function settle(job) {
      if (job.children.every(c=>['complete','failed','stopped'].includes(c.status))) {
        emit(job,true); clearTimeout(job.timer);job.signal?.removeEventListener('abort',job.abort);
        active=null;if(owner===api)owner=null;job.resolve(snapshot(job));
      } else emit(job,true);
    }
    const api = {analyze,stop,isRunning:()=>!!active,destroy(){stop();destroyed=true;instances.delete(api);},engine:Deep.ENGINE};
    instances.add(api);return api;
  }
  root.addEventListener?.('pagehide',()=>{++generation;for(const x of instances)x.stop();});
  root.document?.addEventListener('visibilitychange',()=>{if(root.document.hidden){++generation;for(const x of instances)x.stop();}});
  return {create,configure,getSettings,capabilities,loadBerserkNetwork,restoreBerserkNetwork,clearBerserkNetwork,BERSERK_NET,MODES,descriptors,subscribeSettings(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
});
