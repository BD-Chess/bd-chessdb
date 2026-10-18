/* LAB generation routing and bounded durable restore journal. */
(function(root) {
  'use strict';
  const C=root.ChessDataCore,P='ChessBest:LAB:v2:',ACTIVE=P+'DATA-active',MARK=P+'DATA-journal',CONTROL=P+'DATA-control',LOCK=P+'DATA-live';
  const names=new Set(['settings','game','eval-cache','top-pick','timing','layout','studies','studies-recovery','studies:pending','studies:undo:a','studies:undo:b',
    'evidence','evidence-fallback','evidence-legacy-fallback','sim','sim-fallback','sim-legacy-fallback','sim-checkpoint','sim-legacy-checkpoint','sim-lease','sim-fallback-origin',
    'analysis-engine','analysis-engine-r3','language','preview-width','showTopLine','data-positions','data-recovery','data-restored-paused']);
  const jsonFields={game:'game',timing:'timing'};
  let epoch='',bootError=null,releaseLive=null,liveTask=null,frozen=false,local;
  try {local=root.localStorage;epoch=readEpoch();}catch(e){bootError=e;}
  function readEpoch() {
    const v=JSON.parse(local.getItem(ACTIVE)||'null');
    if(v===null)return '';
    if(v.version!==1||!/^g-[a-zA-Z0-9-]{8,90}$/.test(v.epoch))throw Error('DATA active workspace is unreadable. Original data were retained.');
    return v.epoch;
  }
  function keyAt(name,gen=epoch) {
    if(!name.startsWith(P)||!names.has(name.slice(P.length)))return name;
    return gen?P+'DATA:'+gen+':'+name.slice(P.length):name;
  }
  const key=name=>keyAt(name);
  function assertWritable() {
    if(frozen||readEpoch()!==epoch)throw Error('The workspace changed. Reload this tab before saving. Pending work was retained in its original workspace.');
  }
  function putLocal(k,text) {
    if(text===null)local.removeItem(k);else local.setItem(k,text);
    if(local.getItem(k)!==text)throw Error('DATA storage readback failed.');
  }
  function parseLocal(name,gen=epoch) {
    const text=local.getItem(keyAt(P+name,gen));
    if(text===null)return null;
    try{return JSON.parse(text);}catch(_){throw Error('Unreadable '+name+' data were retained. Export this section separately or resolve it before Save DATA.');}
  }
  function openDB(name,stores,create=false) {
    return new Promise((resolve,reject)=>{
      if(!root.indexedDB){if(create)reject(Error('IndexedDB is unavailable.'));else resolve(null);return;}
      let missing=false,done=false,request;
      const timer=setTimeout(()=>finish(Error('DATA archive access timed out. Close other chess tabs and retry.')),4000);
      function finish(e,db){if(done){db?.close();return;}done=true;clearTimeout(timer);e?reject(e):resolve(db||null);}
      try{request=root.indexedDB.open(name,1);}catch(e){finish(e);return;}
      request.onupgradeneeded=()=>{if(done){request.transaction.abort();return;}if(!create){missing=true;const missingDB=request.result;request.transaction.abort();missingDB.close();return;}
        for(const store of stores)request.result.createObjectStore(store,{keyPath:'id'});};
      request.onsuccess=()=>{const db=request.result;if(stores.some(s=>!db.objectStoreNames.contains(s))){db.close();finish(Error('Unsupported DATA archive store.'));}else finish(null,db);};
      request.onerror=()=>missing?finish(null):finish(request.error||Error('DATA archive access failed.'));
      request.onblocked=()=>finish(Error('DATA archive is blocked by another tab.'));
    });
  }
  async function database(name,stores,values) {
    const db=await openDB(name,stores,values!==undefined);
    if(!db)return null;
    try{return await new Promise((resolve,reject)=>{
      const tx=db.transaction(stores,values===undefined?'readonly':'readwrite'),result={};
      for(const store of stores){const s=tx.objectStore(store);if(values!==undefined){s.clear();for(const v of values[store])s.put(v);}else{const r=s.getAll();r.onsuccess=()=>result[store]=r.result;}}
      tx.oncomplete=()=>resolve(values===undefined?result:values);tx.onerror=tx.onabort=()=>reject(tx.error||Error('DATA archive transaction failed.'));
    });}finally{db.close();}
  }
  function dependencies(){return {Chess:root.Chess,Study:root.ChessStudy,StudyStore:root.ChessStudyStore,Evidence:root.ChessEvidence,Sim:root.ChessSimStore};}
  async function rawSnapshot(gen=epoch) {
    const p=C.empty();
    for(const [field,name] of Object.entries(jsonFields))p[field]=parseLocal(name,gen);
    // Legacy plain PGN is upgraded logically, without rewriting its original bytes.
    if(typeof p.game==='string')throw Error('Legacy game data need the normal game save before Save DATA.');
    const rawGame=local.getItem(keyAt(P+'game',gen));
    if(rawGame!==null&&!rawGame.trimStart().startsWith('{'))throw Error('Legacy game data need the normal game save before Save DATA.');
    for(const [field,name] of [['settings','settings'],['analysis','analysis-engine-r3'],['layout','layout']])p.preferences[field]=parseLocal(name,gen);
    for(const [field,name] of [['language','language'],['appWidth','preview-width'],['showTopLine','showTopLine']])p.preferences[field]=local.getItem(keyAt(P+name,gen));
    p.evaluations.cache=parseLocal('eval-cache',gen)||{};p.evaluations.positions=parseLocal('data-positions',gen)||[];
    for(const [field,name] of [['collection','studies'],['undoA','studies:undo:a'],['undoB','studies:undo:b']])p.studies[field]=parseLocal(name,gen);
    const evidenceFallback=parseLocal('evidence-fallback',gen),simFallback=parseLocal('sim-fallback',gen);
    let E,S;
    try {E=await database(keyAt(P+'evidence',gen),['snapshots']);S=await database(keyAt(P+'sim',gen),['runs','events']);}
    catch(error){
      // An inaccessible existing archive is not an empty archive. A known live
      // fallback is allowed only when database enumeration confirms absence.
      const list=await root.indexedDB?.databases?.();
      if(!Array.isArray(list)||list.some(x=>[keyAt(P+'evidence',gen),keyAt(P+'sim',gen)].includes(x.name)))throw error;
    }
    p.evidence.snapshots=E?.snapshots||evidenceFallback||[];
    if(S){p.simulation.runs=S.runs;p.simulation.events=S.events;}else if(simFallback)p.simulation=simFallback;
    // Conflicting representations are retained as recovery, never overwritten by export.
    for(const [field,name] of [['studyPending','studies:pending'],['simulationCheckpoint','sim-checkpoint'],['legacyStudy','studies-recovery'],
      ['legacyEvidence','evidence-legacy-fallback'],['legacySimulation','sim-legacy-fallback'],['legacyCheckpoint','sim-legacy-checkpoint'],['legacyAnalysis','analysis-engine']])p.recovery[field]=parseLocal(name,gen);
    const retained=parseLocal('data-recovery',gen);
    if(retained) {
      for(const field of Object.keys(p.recovery))if(p.recovery[field]===null||Array.isArray(p.recovery[field])&&!p.recovery[field].length)p.recovery[field]=retained[field];
      p.recovery.recoveredDrafts=retained.recoveredDrafts;
    }
    if(E&&evidenceFallback&&C.canonical(E.snapshots)!==C.canonical(evidenceFallback)) {
      if(p.recovery.legacyEvidence!==null)throw Error('Multiple retained Evidence representations need separate export before Save DATA.');
      p.recovery.legacyEvidence=evidenceFallback;
    }
    if(S&&simFallback&&C.canonical({schema:'chess-sim-archive',version:1,...S})!==C.canonical(simFallback)) {
      if(p.recovery.legacySimulation!==null)throw Error('Multiple retained Sim representations need separate export before Save DATA.');
      p.recovery.legacySimulation=simFallback;
    }
    return p;
  }
  let release='unverified-LAB-runtime-p5a-r1';
  function source(){return {channel:'LAB',release};}
  async function workerState() {
    const controller=root.navigator?.serviceWorker?.controller;
    if(!controller)return null;
    return new Promise(resolve=>{const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(null);},2500);
      channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};controller.postMessage({type:'CHESS_DATA_STATE'},[channel.port2]);});
  }
  async function resolveRelease() {
    const worker=await workerState();
    if(worker?.release){release=worker.release;return;}
    try{const r=await root.fetch('release.json',{cache:'no-store'});const value=await r.json();if(value.channel==='LAB'&&/^lab-[0-9a-f]{16}$/.test(value.version))release=value.version;}catch(_){}
  }
  async function capture(live=true) {
    if(live){await resolveRelease();await root.ChessLabHost?.prepareData?.();}
    async function sample() {
      const p=await rawSnapshot();
      {
        const memory=await root.ChessLabHost?.dataMemory?.();
        if(memory) {
          if(memory.pending)p.recovery.studyPending=memory.pending;
          if(memory.evidence) {
            const merged=new Map(p.evidence.snapshots.map(v=>[v.id,v]));
            memory.evidence.memory.forEach(v=>merged.set(v.id,v));p.evidence.snapshots=[...merged.values()].sort((a,b)=>a.id.localeCompare(b.id));
            p.recovery.evidencePending=[...new Map([...p.recovery.evidencePending,...memory.evidence.pending].map(op=>[C.canonical(op),op])).values()];
          }
          const positions=new Map(p.evaluations.positions.map(v=>[v.id,v]));
          memory.positions?.forEach(v=>positions.set(v.id,v));p.evaluations.positions=[...positions.values()].sort((a,b)=>a.id.localeCompare(b.id));
        }
      }
      p.evidence.snapshots.sort((a,b)=>a.id.localeCompare(b.id));p.simulation.runs.sort((a,b)=>String(a.id).localeCompare(String(b.id)));p.simulation.events.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
      if(p.timing?.clock) p.timing.clock.anchor=0; // runtime performance origin is not portable.
      return p;
    }
    for(let attempt=0;attempt<2;attempt++) {
      const a=await sample(),b=await sample();
      if(C.canonical(a)!==C.canonical(b))continue;
      return C.pack(b,source(),dependencies());
    }
    throw Error('Workspace changed during Save DATA. Pause other chess tabs and retry.');
  }
  async function putControl(journal) {
    const value=C.canonical(journal);
    let mode='indexedDB';
    try{await database(CONTROL,['records'],{records:[{id:'journal',value}]});}
    catch(error){mode='localStorage';putLocal(P+'DATA-journal-fallback',value);}
    putLocal(MARK,mode);
    if(C.canonical(await getControl())!==value)throw Error('Recovery journal readback failed.');
  }
  async function getControl() {
    const mode=local.getItem(MARK);
    if(!mode)return null;
    if(mode==='localStorage')return JSON.parse(local.getItem(P+'DATA-journal-fallback'));
    if(mode!=='indexedDB')throw Error('DATA journal marker is unreadable.');
    const v=await database(CONTROL,['records']);
    if(!v?.records?.[0]?.value)throw Error('DATA recovery journal is unavailable.');
    return JSON.parse(v.records[0].value);
  }
  async function writeGeneration(p,gen) {
    putLocal(keyAt(P+'data-restored-paused',gen),'1');
    const fields={game:p.game,timing:p.timing,settings:p.preferences.settings,'analysis-engine-r3':p.preferences.analysis,layout:p.preferences.layout,
      'eval-cache':p.evaluations.cache,studies:p.studies.collection,'studies:undo:a':p.studies.undoA,'studies:undo:b':p.studies.undoB,
      'data-positions':p.evaluations.positions,'data-recovery':p.recovery};
    for(const [name,value] of Object.entries(fields))putLocal(keyAt(P+name,gen),value===null?null:JSON.stringify(value));
    for(const [name,value] of [['language',p.preferences.language],['preview-width',p.preferences.appWidth],['showTopLine',p.preferences.showTopLine]])putLocal(keyAt(P+name,gen),value);
    const E={snapshots:p.evidence.snapshots},S={runs:p.simulation.runs,events:p.simulation.events};
    try {await database(keyAt(P+'evidence',gen),['snapshots'],E);await database(keyAt(P+'sim',gen),['runs','events'],S);}
    catch(error){
      // A partial new IDB generation must never be hidden behind fallback data.
      const list=await root.indexedDB?.databases?.();
      if(list?.some(x=>[keyAt(P+'evidence',gen),keyAt(P+'sim',gen)].includes(x.name)))throw error;
      putLocal(keyAt(P+'evidence-fallback',gen),JSON.stringify(p.evidence.snapshots));
      putLocal(keyAt(P+'sim-fallback',gen),JSON.stringify(p.simulation));
    }
  }
  async function verifyGeneration(gen,hash) {
    const payload=await rawSnapshot(gen);
    if(payload.timing?.clock)payload.timing.clock.anchor=0;
    // Durable adapter sorting is defined by ID, independent of IDB iteration.
    payload.evidence.snapshots.sort((a,b)=>a.id.localeCompare(b.id));payload.simulation.runs.sort((a,b)=>String(a.id).localeCompare(String(b.id)));payload.simulation.events.sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    if(await C.digest(payload)!==hash)throw Error('Restored workspace durable SHA-256 does not match.');
    return payload;
  }
  async function removeGeneration(gen) {
    if(!gen||gen===readEpoch()||!/^g-[a-zA-Z0-9-]{8,90}$/.test(gen))return;
    for(const name of names)if(!['evidence','sim'].includes(name))local.removeItem(keyAt(P+name,gen));
    if(root.indexedDB)for(const name of ['evidence','sim'])await new Promise(resolve=>{const r=root.indexedDB.deleteDatabase(keyAt(P+name,gen));r.onsuccess=r.onerror=r.onblocked=()=>resolve();});
  }
  function id(){return 'g-'+root.crypto.randomUUID();}
  async function joinLive() {
    if(!root.navigator?.locks?.request)return;
    await new Promise((resolve,reject)=>{
      liveTask=root.navigator.locks.request(LOCK,{mode:'shared'},()=>{resolve();return new Promise(r=>{releaseLive=r;});});liveTask.catch(reject);
    });
  }
  async function exclusive(work) {
    if(!root.navigator?.locks?.request)throw Error('Safe DATA restore is unavailable in this browser. Use a browser with Web Locks.');
    releaseLive?.();releaseLive=null;await liveTask;
    try{return await root.navigator.locks.request(LOCK,{mode:'exclusive',ifAvailable:true},lock=>{if(!lock)throw Error('Close the other LAB tabs before restoring DATA.');return work();});}
    finally{await joinLive();}
  }
  async function restore(incoming,expectedHash) {
    assertWritable();
    // Revalidate the exact file again at the effect boundary.
    incoming=await C.parse(C.canonical(incoming),dependencies());
    return exclusive(async()=>{
      const worker=await workerState();
      if(root.navigator?.serviceWorker?.controller&&!worker)throw Error('Activate the LAB Update ready, then reload before restoring DATA.');
      if(worker?.clients?.length>1)throw Error('Close the other LAB tabs before restoring DATA.');
      assertWritable();frozen=true;
      try {
        const backup=await capture(false);
        if(backup.sha256!==expectedHash)throw Error('Preview is stale. Workspace changed; select the DATA file again.');
        const prior=await getControl();
        if(prior&&!['committed','rolledBack'].includes(prior.phase))throw Error('An unfinished DATA restore needs recovery before another restore.');
        if(prior?.previous&&prior.previous!==epoch)await removeGeneration(prior.previous);
        const journal={version:1,phase:'staged',previous:epoch,next:id(),hash:incoming.sha256,backup};
        await putControl(journal); // Verified full recovery BEFORE any new-generation write.
        await writeGeneration(incoming.payload,journal.next);
        await verifyGeneration(journal.next,incoming.sha256);
        if((await capture(false)).sha256!==expectedHash)throw Error('Workspace changed during staging. Nothing was replaced. Select the file again.');
        journal.phase='committing';await putControl(journal);
        putLocal(ACTIVE,JSON.stringify({version:1,epoch:journal.next}));
        await verifyGeneration(journal.next,incoming.sha256);
        journal.phase='committed';await putControl(journal);
        return {hash:incoming.sha256,epoch:journal.next};
      } catch(error) {
        const journal=await getControl().catch(()=>null);
        if(journal&&readEpoch()===journal.previous){journal.phase='rolledBack';await putControl(journal);await removeGeneration(journal.next);}
        // After pointer commit the boot gate owns recovery; never show success.
        throw error;
      } finally{frozen=false;}
    });
  }
  async function recover() {
    if(bootError)throw bootError;
    const journal=await getControl();
    if(!journal||['committed','rolledBack'].includes(journal.phase))return;
    if(!root.navigator?.locks?.request)throw Error('Close other LAB tabs and use Web Locks to recover this workspace.');
    return root.navigator.locks.request(LOCK,{mode:'exclusive',ifAvailable:true},async lock=>{
      if(!lock)throw Error('A DATA restore is active in another LAB tab. Close it and reload.');
      const journal=await getControl();
    if(journal.version!==1||!['staged','committing'].includes(journal.phase))throw Error('Unsupported DATA recovery journal. Original workspace was retained.');
    await C.parse(C.canonical(journal.backup),dependencies());
    if(readEpoch()===journal.previous){journal.phase='rolledBack';await putControl(journal);await removeGeneration(journal.next);return;}
    if(readEpoch()!==journal.next)throw Error('DATA recovery conflicts with another workspace. Original recovery was retained.');
    try{await verifyGeneration(journal.next,journal.hash);journal.phase='committed';await putControl(journal);}
    catch(error){
      const recovered=id();await writeGeneration(journal.backup.payload,recovered);await verifyGeneration(recovered,journal.backup.sha256);
      putLocal(ACTIVE,JSON.stringify({version:1,epoch:recovered}));journal.phase='rolledBack';await putControl(journal);await removeGeneration(journal.next);
      root.location.reload();throw Error('Previous workspace recovered. Reloading before application writers start.');
    }
    });
  }
  // Dependencies below this script load synchronously before DOMContentLoaded.
  const ready=new Promise((resolve,reject)=>{
    const boot=()=>recover().then(joinLive).then(resolve,reject);
    if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  });
  ready.catch(()=>{});
  root.addEventListener('pagehide',()=>releaseLive?.());
  root.addEventListener('storage',event=>{if(event.key===ACTIVE&&readEpoch()!==epoch) {
    const panel=root.document.createElement('dialog');panel.textContent='Workspace restored in another tab. Reload before continuing; this tab keeps its original pending work.';
    const button=root.document.createElement('button');button.textContent='Reload workspace';button.onclick=()=>root.location.reload();panel.append(button);root.document.body.append(panel);panel.showModal();
  }});
  root.ChessDataGuard={get epoch(){return epoch;},get restoredPaused(){return local.getItem(key(P+'data-restored-paused'))==='1';},resume:()=>putLocal(key(P+'data-restored-paused'),null),ready,key,assertWritable,source,refreshSource:resolveRelease,capture,restore,dependencies,
    drafts:()=>parseLocal('data-recovery'),recovery:async()=>{const j=await getControl();return j?.backup?C.parse(C.canonical(j.backup),dependencies()):null;}};
})(window);
