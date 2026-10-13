/* One analysis owner; optional full engines are instantiated only by analyze(). */
(function(root, factory) {
  const api = factory(root, typeof module === 'object' && module.exports ? require('./8zc-deep-engine.js') : root.ChessDeepEngine);
  if (typeof module === 'object' && module.exports) module.exports = api; else root.ChessAnalysisSession = api;
})(typeof window === 'object' ? window : globalThis, function(root, Deep) {
  'use strict';
  const abortError=()=>Object.assign(new Error('Cancelled'),{name:'AbortError'});
  const MODES = ['sf-lite','sf-full','berserk','sf-berserk','reckless','lc0'];
  const BOARD_SOURCES = ['cdb','sf-lite','sf-full','reckless','lc0','berserk'];
  // New controls start with CDB / one thread; earlier R2 preferences remain in their original key.
  const STORAGE = 'ChessBest:LAB:v2:analysis-engine-r3';
  const listeners = new Set(), instances = new Set();
  let owner = null, generation = 0, cleanupUntil = 0, sessionSerial = 0, berserkNetwork = null;
  const BERSERK_NET = Object.freeze({bytes:25201924,sha256:"9b84c340af7e45f6e07f0046235ccb327f4ae0840c8ee2c4b97b99121e5c5084",name:"berserk-9b84c340af7e.nn"});
  const NETWORK_DB = 'ChessBest:LAB:engine-networks:v1';
  let networkState = 'unchecked', networkPersistent = false, networkError = '', networkRevision = 0, restorePending = null, networkLoadSerial = 0;
  let networkWrites = Promise.resolve();
  let savedCardMode='sf-lite';
  try{const key=root.ChessLabStorage?.KEYS?.settings||'ChessBest:LAB:v2:settings';savedCardMode=JSON.parse(root.localStorage?.getItem(key)||'null')?.sfCardMode==='sf-full'?'sf-full':'sf-lite';}catch(_){}
  let settings = { analysisMode:'sf-lite', boardSource:'cdb', sfCardMode:savedCardMode, sfFullThreadsRequested:1, hashMB:16 };
  try { const old = JSON.parse(root.localStorage?.getItem(STORAGE) || root.localStorage?.getItem('ChessBest:LAB:v2:analysis-engine') || 'null'); if (old) settings = sanitize(old); } catch (_) {}
  function sanitize(value) {
    const mode = ['auto','cdb','sf','cdb-sf-lite','CDB | SF Lite'].includes(value.analysisMode)?'sf-lite':value.analysisMode;
    const requested = value.sfFullThreadsRequested;
    return { analysisMode:MODES.includes(mode) ? mode : 'sf-lite',
      sfCardMode:value.sfCardMode==='sf-full'?'sf-full':value.sfCardMode==='sf-lite'?'sf-lite':savedCardMode,
      boardSource:BOARD_SOURCES.includes(value.boardSource) ? value.boardSource : 'cdb',
      sfFullThreadsRequested:Number.isInteger(Number(requested))&&Number(requested)>=1&&Number(requested)<=8?Number(requested):1,
      hashMB:Math.min(64, Math.max(8, Number(value.hashMB) || 16)),
      ...(Number(value.analysisTimeMs)>0?{analysisTimeMs:Math.min(14400000,Number(value.analysisTimeMs))}:{}),
      ...(Number.isFinite(Number(value.deepTimeMs))&&value.deepTimeMs!=null?{deepTimeMs:Math.max(-1,Math.min(14400000,Number(value.deepTimeMs)))}:{}) };
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
    const label = mode==='reckless'?'Reckless · 1':mode==='lc0'?'LCZero NN / browser PUCT · local inference':dual ? `SF Full · ${effectiveSFThreads} + Berserk · 1` : mode === 'berserk' ? 'Berserk · 1' : full ? `SF Full · ${effectiveSFThreads}` : 'SF Lite · 1';
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
  // Only an actual analysis calls this function. Idle selection restores local
  // bytes at most; no optional engine/network request is made at page startup.
  async function ensureBerserkNetwork(signal) {
    const abort = () => { if (signal?.aborted) throw abortError(); };
    abort();
    if (!berserkNetwork) await restoreBerserkNetwork();
    abort();
    if (berserkNetwork) return getSettings();
    const revision=networkRevision, serial=++networkLoadSerial;
    networkState='downloading';networkError='';notifySettings();
    try {
      const base=root.document?.baseURI || 'http://localhost/chess-lab/';
      const directory='vendor/berserk/v14-5b8d6c93/';
      const bytes=new Uint8Array(BERSERK_NET.bytes);let offset=0;
      // Part boundaries are packaging only: verification covers the original full file.
      for(let part=0;part<3;part++){
        abort();const url=new URL(directory+'berserk-9b84c340af7e.part'+part+'.nn',base).href;
        const response=await root.fetch(url,{signal,cache:'force-cache'});
        if(!response.ok)throw new Error('NNUE download failed (HTTP '+response.status+').');
        const chunk=new Uint8Array(await response.arrayBuffer());
        const expected=part<2?10485760:4230404;
        if(chunk.byteLength!==expected)throw new Error('Incomplete original NNUE download.');
        bytes.set(chunk,offset);offset+=chunk.byteLength;
      }
      const verified=await verifyNetwork(bytes.buffer);abort();
      if(revision!==networkRevision||serial!==networkLoadSerial)throw abortError();
      berserkNetwork=verified;networkPersistent=false;networkState='ready';notifySettings();
      try {
        await queueNetworkWrite('put',{id:BERSERK_NET.sha256,buffer:verified.buffer,name:BERSERK_NET.name});
        if(revision===networkRevision&&serial===networkLoadSerial)networkPersistent=true;
      } catch(error) { if(revision===networkRevision&&serial===networkLoadSerial)networkError=error.message; }
      abort();return getSettings();
    } catch(error) {
      if(revision===networkRevision&&serial===networkLoadSerial){
        networkState=berserkNetwork?'ready':error.name==='AbortError'?'missing':'error';
        networkError=error.name==='AbortError'?'':error.message;
      }
      throw error;
    } finally {notifySettings();}
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
    // Changing the board's display source does not cancel independent analysis.
    const computeChanged = ['analysisMode','sfFullThreadsRequested','hashMB'].some(key=>next[key]!==settings[key]);
    if(computeChanged){++generation; for (const instance of instances) instance.stop();}
    settings = next;
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
  // Reusable single-engine adapter for matched DCC continuation probes.
  // It uses the same pinned engine/network and actual thread policy as Deep.
  function backendFor(mode, Chess) {
    if(['reckless','lc0'].includes(mode))return browserBackend(mode,Chess);
    if(!['sf-full','berserk'].includes(mode))return Deep;
    return {create(){
      const base=root.document?.baseURI||'http://localhost/chess-lab/';
      const caps=capabilities(mode),single=!caps.isolated;
      const workerUrl=new URL(mode==='berserk'?'vendor/berserk/v14-5b8d6c93/berserk-host.js':
        'vendor/stockfish-full/v19.0.1/stockfish-19'+(single?'-single':'')+'.js',base).href;
      const config={Chess,workerUrl,engine:Object.assign({},descriptors[mode],{variant:mode==='berserk'?'scalar':single?'single':'threaded',wasmSHA256:mode==='berserk'?'0cffe539d41787c8cc2963911e24fe0bdf5319bae1fe03fae243642e8cda9372':single?'991bede2f253ebb08ff01fcc48270f4b9c8e66b12d5bd5f8d6f52eb3e3b3a740':'a599d78d72e0722d8895be84aca8b492d12e8bba3cdfcbcbc4a64017888c6667'}),threads:mode==='sf-full'?caps.effectiveSFThreads:1,
        hashMB:Math.min(settings.hashMB,caps.mobile?16:64),readyTimeoutMs:20000,forceTerminateOnStop:true};
      if(mode==='berserk')config.workerFactory=url=>{const w=new root.Worker(url),buffer=berserkNetwork.buffer.slice(0);w.postMessage({type:'init-network',buffer},[buffer]);return w;};
      const engine=Deep.create(config);
      return {prepare:async opts=>{if(mode==='berserk')await ensureBerserkNetwork(opts?.signal);return engine.prepare(opts);},
        analyze:async opts=>{if(mode==='berserk')await ensureBerserkNetwork(opts?.signal);return engine.analyze(opts);},
        stop:()=>engine.stop(),destroy:()=>engine.destroy()};
    }};
  }
  // Small lazy bridge. Models, WASM and optional modules load only on analysis.
  function browserBackend(mode,Chess){
    return {create(){
      let adapter=null, pending=null, cancelled=false;
      const controller=new AbortController();
      async function ensure(opts={}){
        if(cancelled||opts.signal?.aborted)throw abortError();
        if(!pending)pending=import(new URL('engines/'+(mode==='lc0'?'lc0':'reckless')+'/adapter.mjs',root.document?.baseURI||'http://localhost/chess-lab/').href)
          .then(module=>{if(cancelled)throw abortError();return adapter=module.create({Chess,hashMB:settings.hashMB});});
        const engine=await pending;
        if(cancelled||opts.signal?.aborted)throw abortError();
        return engine;
      }
      function stop(){cancelled=true;controller.abort();adapter?.stop();}
      return {async prepare(opts={}){const engine=await ensure(opts);return engine.prepare({...opts,signal:controller.signal});},
        async analyze(opts={}){const engine=await ensure(opts);const abort=()=>stop();opts.signal?.addEventListener('abort',abort,{once:true});
          try{return await engine.analyze({...opts,signal:controller.signal});}finally{opts.signal?.removeEventListener('abort',abort);}},
        stop,destroy(){stop();adapter?.destroy();}};
    }};
  }
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
      clearTimeout(job.timer); job.networkController?.abort();job.signal?.removeEventListener('abort',job.abort);
      for (const child of job.children) { if (!['complete','failed'].includes(child.status)) child.status='stopped'; child.engine?.destroy(); }
      job.resolve(snapshot(job));
    }
    function analyze(options = {}) {
      if (destroyed) return Promise.reject(new Error('Analysis session destroyed'));
      if (root.document?.hidden === true) return Promise.reject(new Error('Analysis is paused while the page is hidden'));
      let validated; try { validated = Deep.limitsFor(options, config.Chess || root.Chess); } catch (e) { return Promise.reject(e); }
      if (options.signal?.aborted) return Promise.reject(Deep.abortError ? abortError() : Object.assign(new Error('Cancelled'),{name:'AbortError'}));
      stop(); if (owner && owner !== api) owner.stop(); owner = api;
      const mode = config.analysisMode || settings.analysisMode, localMode = mode === 'auto' ? 'sf-lite' : mode;
      if(localMode==='cdb'){owner=null;return Promise.reject(new Error('ChessDB uses the connected source service, not a local UCI worker.'));}
      const caps = capabilities(localMode), heavy = ['sf-full','berserk','sf-berserk','reckless','lc0'].includes(localMode);
      const ids = localMode === 'sf-berserk' ? ['sf-full','berserk'] : [localMode];
      const requestedBudget = {depth:validated.depth,nodes:validated.nodes,movetime:validated.movetime,infinite:validated.infinite};
      // Respect the user's explicit time/depth constraints for each participant.
      const limits = Object.assign({},validated);
      return new Promise((resolve,reject) => {
        const job = {id:'analysis-'+Date.now()+'-'+(++sessionSerial)+'-'+(++serial),generation,mode:localMode,caps,requested:settings.sfFullThreadsRequested,
          children:ids.map(id=>({id,status:'loading',jobId:id+'-'+Date.now()+'-'+serial})),
          fen:limits.fen,history:limits.history,options:limits,onInfo:options.onInfo,signal:options.signal,
          started:now(),startedAt:new Date().toISOString(),lastEmit:-Infinity,resolve,reject,stopped:false,requestedBudget,
          networkController:new AbortController(),
          effectiveBudget:{depth:limits.depth,nodes:limits.nodes,movetime:limits.movetime,infinite:limits.infinite,
            maxSessionMs:null}};
        active = job;
        job.abort = stop; job.signal?.addEventListener('abort',job.abort,{once:true});
        if(Number.isFinite(job.effectiveBudget.maxSessionMs)&&job.effectiveBudget.maxSessionMs>0)job.timer=setTimeout(stop,job.effectiveBudget.maxSessionMs);
        // No serial await: each child has its own loader, deadline, worker tree and completion.
        const preparations = [];
        for (const child of job.children) {
          try {
            const browserMode=['reckless','lc0'].includes(child.id);
            const meta = browserMode?{id:child.id,name:child.id==='lc0'?'LCZero NN / browser PUCT':'Reckless'}:child.id === 'sf-lite' ? Deep.ENGINE : descriptors[child.id];
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
                if(!berserkNetwork)throw new Error('Berserk NNUE is not ready.');
                const worker = factory(url), copy = berserkNetwork.buffer.slice(0);
                worker.postMessage({type:'init-network',buffer:copy},[copy]);
                return worker;
              };
            }
            child.engine = config.adapterFactory ? config.adapterFactory(child.id,engineConfig) : browserMode?browserBackend(child.id,config.Chess||root.Chess).create():Deep.create(engineConfig);
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
                if(!berserkNetwork)await ensureBerserkNetwork(job.networkController.signal);
                if(active!==job||job.generation!==generation||job.stopped)return;
                if(!berserkNetwork)throw new Error('Berserk NNUE could not be loaded.');
              }
              return child.engine.prepare?.({signal:job.networkController.signal,onProgress:progress=>{if(active===job&&!job.stopped){child.snapshot={fen:job.fen,lines:[],downloadProgress:progress};emit(job,true);}}});
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
  return {create,configure,getSettings,capabilities,backendFor,loadBerserkNetwork,restoreBerserkNetwork,ensureBerserkNetwork,clearBerserkNetwork,BERSERK_NET,MODES,BOARD_SOURCES,descriptors,cardModes:()=>root.ChessEngineRegistry?.participants(settings.sfCardMode)||[settings.sfCardMode,'berserk'],subscribeSettings(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
});
