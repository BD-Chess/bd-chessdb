/* PWA local Worker controller. Only encrypted code is fetched after unlock.
   All private checkpoints are stored in a PWA-specific IndexedDB namespace. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),ENGINE='bd-trip-browser-r1.2.0';
  const sl=()=>window.MDLxDCCLocale?.current()==='sl',say=(en,si)=>sl()?si:en;
  const clientSessionId=crypto.randomUUID();
  // Canonical input serialization, hashes and ZIP assembly never run on the page thread.
  function helperRequest(message,{signal,onProgress}={}) {
    return new Promise((resolve,reject)=>{
      const task=new Worker(window.TripRecovery?.diagnosticsURL||'diagnostics-export.js?v=20260914-diag1');
      const requestId=message.requestId||crypto.randomUUID();let finished=false;
      const finish=(error,data)=>{if(finished)return;finished=true;task.terminate();signal?.removeEventListener('abort',abort);error?reject(error):resolve(data);};
      const abort=()=>finish(new DOMException('Export cancelled','AbortError'));
      if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});
      task.onerror=()=>finish(Error('Diagnostic helper failed.'));
      task.onmessage=({data})=>{if(data?.requestId!==requestId)return;if(data.type==='diagnostics-progress'||data.type==='diagnostics-export-progress'){onProgress?.(data);return;}if(data.type==='error'||data.type==='diagnostics-export-error')finish(Error('Diagnostic helper failed.'));else finish(null,data);};
      task.postMessage({...message,requestId});
    });
  }
  window.TripDiagnosticExport=Object.freeze({request:helperRequest});
  let enabled=false,credential=null,payload=null,worker=null,workerURL=null,privateWorkerURL=null,connection=null,hooks={},unlockVersion=0,busy=false,creation=0,cancelCreation=false;
  const pending=new Map();
  let controlPromise=null,controlType=null;
  function deviceLimits(){return {hardwareConcurrency:navigator.hardwareConcurrency||null,deviceMemory:navigator.deviceMemory||null,mobile:matchMedia('(max-width: 1023px)').matches};}
  function setupWorkers(){const l=deviceLimits(),cap=Math.min(16,l.mobile?4:16,Number.isInteger(l.hardwareConcurrency)&&l.hardwareConcurrency>0?l.hardwareConcurrency:2),select=$('mdlWorkers');select.replaceChildren();for(let n=1;n<=cap;n++){const o=document.createElement('option');o.value=String(n);o.textContent=String(n);select.append(o);}select.value='1';}
  function refreshBackgroundCopy(){
    const help=document.querySelector('.mdl-controls > p:not(.mdl-worker-help):not(#mdlStatus)');
    if(help){help.removeAttribute('data-ui-text');help.textContent=say('Experimental Deep runs on this device. Hidden tabs continue calculating when the browser allows background work; closing the page stops live calculation. Unlock to recover the last encrypted checkpoint (up to 7 days); a new run replaces it.','Eksperimentalni Deep računa na tej napravi. Skrit zavihek nadaljuje računanje, kadar brskalnik dovoli delo v ozadju; zaprtje strani ustavi živi izračun. Po odklepu obnovi zadnje šifrirano stanje (do 7 dni); nov izračun ga nadomesti.');}
    if(!connection)return;
    const progress=$('searchProgressHint');
    if(progress){progress.removeAttribute('data-ui-text');progress.textContent=say('Budget includes local preparation, worker scheduling, checkpoint storage and diagnostics. Only explicit pauses are excluded. Hidden tabs continue MDLxDCC; the browser or OS may still throttle background work.','Proračun vključuje lokalno pripravo, razporejanje delavcev, hrambo stanja in diagnostiko. Izključeni so le izrecni premori. Skrit zavihek nadaljuje MDLxDCC; brskalnik ali operacijski sistem lahko delo v ozadju še vedno upočasni.');}
    const note=$('diagnosticsTimingNote');
    if(note&&/(Hidden tabs pause MDLxDCC\.|Skrit zavihek ustavi MDLxDCC\.)/.test(note.textContent)){note.removeAttribute('data-ui-text');note.textContent=say('Budget includes local preparation, worker scheduling, checkpoint storage and diagnostics. Only explicit pauses are excluded. Hidden tabs continue MDLxDCC; the browser or OS may still throttle background work.','Proračun vključuje lokalno pripravo, razporejanje delavcev, hrambo stanja in diagnostiko. Izključeni so le izrecni premori. Skrit zavihek nadaljuje MDLxDCC; brskalnik ali operacijski sistem lahko delo v ozadju še vedno upočasni.');}
  }

  function hint(text){$('mdlStatus').textContent=text;}
  function terminate(){worker?.terminate();worker=null;if(workerURL)URL.revokeObjectURL(workerURL);workerURL=null;if(privateWorkerURL)URL.revokeObjectURL(privateWorkerURL);privateWorkerURL=null;for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Worker closed'));}pending.clear();}
  function detach(){creation++;cancelCreation=false;connection=null;controlPromise=null;controlType=null;terminate();}
  function lock(){detach();enabled=false;credential?.fill(0);credential=null;payload=null;$('chkMdl').checked=false;}
  function rpc(message,timeout=20000){
    if(!worker)return Promise.reject(Error('Worker unavailable'));
    const requestId=crypto.randomUUID(),packet={v:2,requestId,...message};
    return new Promise((resolve,reject)=>{const entry={resolve,reject,retried:false};const expire=()=>{if(!entry.retried&&worker){entry.retried=true;worker.postMessage(packet);entry.timer=setTimeout(expire,timeout);}else{pending.delete(requestId);reject(Error(say('Worker did not respond. Recover the last local checkpoint.','Worker se ni odzval. Obnovi zadnjo lokalno kontrolno točko.')));}};entry.timer=setTimeout(expire,timeout);pending.set(requestId,entry);worker.postMessage(packet);});
  }
  async function ensureWorker(){
    if(worker)return;if(!enabled||!credential||!payload)throw Error('Unlock first');
    const version=creation,blob=await TripShield.decrypt(payload,credential);if(version!==creation||!enabled)throw Error('Unlock cancelled');
    privateWorkerURL=URL.createObjectURL(blob);
    // The decrypted coordinator spawns more Workers from workerURL. Give every
    // Worker the same boot script so each IndexedDB open/delete is scoped to PWA.
    // If the namespace cannot be installed, importScripts never runs private code.
    const bootstrap=`(() => {
      'use strict';
      const prefix='bd-trip-pwa-v1:';
      const source=self.indexedDB;
      if(!source)throw Error('IndexedDB is required for private checkpoints');
      const scoped=new Proxy(source,{
        get(target,key){
          if(key==='open'||key==='deleteDatabase')return (name,...args)=>target[key](prefix+String(name),...args);
          if(key==='databases'&&typeof target.databases==='function')return async()=>
            (await target.databases()).filter(db=>db.name?.startsWith(prefix))
              .map(db=>({...db,name:db.name.slice(prefix.length)}));
          const value=Reflect.get(target,key,target);
          return typeof value==='function'?value.bind(target):value;
        }
      });
      Object.defineProperty(self,'indexedDB',{configurable:false,value:scoped});
      if(self.indexedDB!==scoped)throw Error('Cannot isolate checkpoint storage');
      importScripts(${JSON.stringify(privateWorkerURL)});
    })();`;
    workerURL=URL.createObjectURL(new Blob([bootstrap],{type:'text/javascript'}));
    try{
      worker=new Worker(workerURL);const created=worker;
      worker.onmessage=({data})=>{
        if(worker!==created||data?.v!==2)return;
        if(data.type==='verification-progress'&&$('mdlVerifyResult'))$('mdlVerifyResult').textContent=String(data.completed)+' / '+data.total;
        const p=pending.get(data.requestId);
        if(p){pending.delete(data.requestId);clearTimeout(p.timer);if(data.type==='error'||data.type==='fatal')p.reject(Error(data.error));else p.resolve(data);}
        if(data.type==='receipt'&&!p&&connection){try{accept(data.receipt,connection);}catch(e){detach();hooks.disconnected?.(e);}}
        if(data.type==='fatal'){detach();hooks.disconnected?.(Error(data.error));}
      };
      worker.onerror=()=>{if(worker!==created)return;detach();hooks.disconnected?.(Error(say('Experimental Worker failed. Reload and recover.','Eksperimentalni Worker ni uspel. Znova odpri stran in obnovi stanje.')));};
      await rpc({type:'init',credential:credential.slice(),workerURL,limits:deviceLimits()});
    }catch(e){terminate();throw e;}
  }
  function closeDialog(){unlockVersion++;$('mdlPassword').value='';$('mdlUnlockSubmit').disabled=false;if($('mdlUnlock').open)$('mdlUnlock').close();$('chkMdl').checked=enabled;$('chkMdl').focus();}
  function askUnlock(){lock();$('mdlUnlockError').textContent='';$('mdlPassword').value='';$('mdlUnlock').showModal();$('mdlPassword').focus();}
  async function unlock(event){
    event.preventDefault();const version=++unlockVersion;$('mdlUnlockSubmit').disabled=true;
    let password=$('mdlPassword').value;
    try{
      const response=await fetch('/api/trip-mdl-unlock',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json'},body:JSON.stringify({schema:'TripUnlockV1',password}),signal:AbortSignal.timeout(20000)});password='';
      const answer=await response.json();if(!response.ok||answer.schema!=='TripUnlockV1'||answer.engine!=='bd-trip-browser-r1.1.0')throw Error('unlock');
      const next=TripShield.bytes(answer.credential);if(next.length!==32)throw Error('key');
      const resource=await fetch('mdl-worker.enc.json?v=20260914-diag1',{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!resource.ok)throw Error('payload');
      const pack=await resource.json();if(version!==unlockVersion){next.fill(0);return;}
      credential=next;payload=pack;enabled=true;await ensureWorker();
      if(version!==unlockVersion){lock();return;}
      $('chkMdl').checked=true;closeDialog();hint(say('Local experimental Deep enabled.','Lokalni eksperimentalni Deep je omogočen.'));hooks.modeChanged?.();
    }catch(_){password='';$('mdlPassword').value='';if(version===unlockVersion){lock();$('mdlUnlockError').textContent=say('Unlock failed. Check the password and connection.','Odklep ni uspel. Preveri geslo in povezavo.');$('mdlUnlockSubmit').disabled=false;$('mdlPassword').focus();}}
  }
  async function makeContext(job,tspData){
    const nodeIds=job.planar?job.points.map(p=>String(p.tspNodeId)):job.points.map((_,i)=>String(i));
    const cost=job.planar?{schema:'CostSpecV2',kind:'catalog-euc2d',units:'EUC_2D',numeric:'binary64-browser-halfup-v1',instanceId:tspData.entry.id,originalSha256:tspData.entry.originalSha256}:job.distanceMatrix?{schema:'CostSpecV2',kind:'matrix',units:'m',values:job.distanceMatrix}:{schema:'CostSpecV2',kind:'haversine',units:'m',points:job.points.map(p=>[p.lat,p.lon])};
    const problem={schema:'ProblemV2',nodeIds,start:job.startIdx,closed:job.roundTrip,directed:!!job.distanceMatrix,cost};
    const edge=job.planar?(i,j)=>TripTspMetric.edge(job.points[i],job.points[j]):job.distanceMatrix?(i,j)=>job.distanceMatrix[i][j]:(i,j)=>{const a=job.points[i],b=job.points[j],r=Math.PI/180,lat1=a.lat*r,lat2=b.lat*r,h=Math.sin((lat2-lat1)/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin((b.lon-a.lon)*r/2)**2;return 2*6371008.8*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));};
    return {problem,problemHash:(await helperRequest({type:'problem-hash',problem})).problemHash,cost:edge,points:job.points,localId:job.jobId,last:null,controlSeq:0};
  }
  function accept(data,ctx){
    if(connection!==ctx)return;
    if(!['ProgressV2','ResultV2'].includes(data.schema)||data.engine!==ENGINE||data.problemHash!==ctx.problemHash||data.jobId!==ctx.id||ctx.last&&data.configHash!==ctx.last.configHash)throw Error('Worker identity mismatch');
    if(ctx.last&&data.sequence<=ctx.last.sequence)return;
    const route=data.route,n=ctx.problem.nodeIds.length;if(!Array.isArray(route)||route.length!==n||route[0]!==ctx.problem.start||new Set(route).size!==n||route.some(i=>!Number.isInteger(i)||i<0||i>=n))throw Error('Invalid Worker route');
    let total=0;for(let i=1;i<n;i++)total+=ctx.cost(route[i-1],route[i]);if(ctx.problem.closed)total+=ctx.cost(route.at(-1),route[0]);
    if(!Number.isFinite(data.cost)||Math.abs(total-data.cost)>1e-9*Math.max(1,total)||ctx.last&&data.cost>ctx.last.cost+1e-9*Math.max(1,ctx.last.cost))throw Error('Worker objective mismatch');
    ctx.last=data;ctx.controlSeq=data.controlSeq;const terminal=data.schema==='ResultV2',planar=ctx.problem.cost.units==='EUC_2D';
    hooks.diagnostics?.(data);
    hooks.message?.({data:{type:terminal?'result':'progress',jobId:ctx.localId,algorithm:'deep',private:true,phase:data.state,reason:data.state==='failed'?'error':data.state==='completed_optimum'?'optimum':data.state==='paused_budget'?'budget':data.state==='paused_hidden'?'hidden':terminal?'cancelled':null,error:data.error||null,cancelled:terminal&&!data.optimumReached&&data.state!=='paused_budget',exact:data.optimumReached,canContinue:data.canContinue,
      pointsSorted:route.map(i=>ctx.points[i]),totalCost:data.cost,baseCost:data.baseCost,totalKm:planar?null:data.cost/1000,baseKm:planar?null:data.baseCost/1000,directKm:null,elapsedMs:data.timing?.budget_used_ms??data.activeMs,budgetMs:data.allocatedMs,candidates:data.candidates,completed:data.completed,improvements:data.improvements,metric:planar?'tsp-euc2d':ctx.problem.cost.kind==='matrix'?'road':'direct',privateReceipt:data}});
    hint(data.error?say('A CPU worker failed. Best route kept; recover the last complete checkpoint.','CPU delavec ni uspel. Najboljša pot je ohranjena; obnovi zadnjo popolno kontrolno točko.'):data.storageError?say('Local save failed; keep this tab open. ','Lokalna hramba ni uspela; ohrani ta zavihek odprt. ')+data.storageError:data.persisted?say('Encrypted checkpoint saved on this device.','Šifrirano stanje je shranjeno na tej napravi.'):say('Calculating locally.','Računam lokalno.'));
    refreshBackgroundCopy();
  }
  async function start(job,tspData){
    const startRequested=job.localStartRequested??performance.timeOrigin+performance.now();
    detach();const version=creation;cancelCreation=false;await ensureWorker();const ctx=await makeContext(job,tspData);if(version!==creation)return;
    ctx.id=crypto.randomUUID();connection=ctx;
    const ui={editor:$('input').value,points:job.points,startIdx:job.startIdx,roundTrip:job.roundTrip,direct:job.direct,mode:job.mode,planar:job.planar,distanceMatrix:job.distanceMatrix||null,entry:tspData?.entry||null,reference:tspData?.reference||null};
    const reply=await rpc({type:'start',runId:ctx.id,problemHash:ctx.problemHash,problem:ctx.problem,options:{engine:'bd-trip-browser-r1.1.0',seed:42,workerCount:Number($('mdlWorkers').value)},ui,visible:true,startRequested,clientSessionId,diagnosticsEnabled:$('diagnosticsEnabled')?.checked!==false,environment:{userAgent:navigator.userAgent,platform:navigator.platform||null,hardwareConcurrency:navigator.hardwareConcurrency||null,deviceMemory:navigator.deviceMemory||null}});accept(reply.receipt,ctx);
    refreshBackgroundCopy();
    if(cancelCreation)await cancel();
  }
  async function operation(type,extra={}){
    const ctx=connection;if(!ctx)throw Error('Recover the local run first');
    const token=creation;
    if(controlPromise){
      if(controlType===type)return controlPromise;
      const prior=controlPromise;try{await prior;}catch(_){}
      if(token!==creation||ctx!==connection)throw Error('Worker closed');
      return operation(type,extra);
    }
    const promise=rpc({type,runId:ctx.id,problemHash:ctx.problemHash,engine:ENGINE,controlSeq:ctx.controlSeq+1,controlId:crypto.randomUUID(),...extra}).then(reply=>{if(token===creation&&reply.receipt)accept(reply.receipt,ctx);return reply;});
    controlType=type;controlPromise=promise;try{return await promise;}finally{if(controlPromise===promise){controlPromise=null;controlType=null;}}
  }
  async function resume(job,extraMs){if(!enabled)throw Error('Unlock first');connection.localId=job.jobId;await operation('continue',{extraMs});}
  async function cancel(){if(!connection){cancelCreation=true;return;}await operation('cancel');}
  async function recover(type='restore'){if(busy)return;await ensureWorker();const reply=await rpc({type});if(reply.type==='empty'){hint(say('No saved checkpoint on this device.','Na tej napravi ni shranjenega stanja.'));return;}
    const saved=reply.restored,job=await hooks.recover(saved.ui),ctx=await makeContext(job,{entry:saved.ui.entry});if(ctx.problemHash!==reply.receipt.problemHash)throw Error('Saved input identity mismatch');ctx.id=reply.receipt.jobId;connection=ctx;$('mdlWorkers').value=String(reply.receipt.workerCount);accept(reply.receipt,ctx);if(saved.previousGeneration)hint(say('Recovered the previous complete generation; the newest saved record was invalid.','Obnovljena je prejšnja popolna generacija; najnovejši zapis ni bil veljaven.'));await visibility();
  }
  async function diagnosticCommand(type,extra={}) {
    const ctx=connection;if(!ctx||!worker)throw Error('Recover the local run first');
    const result=await rpc({type,runId:ctx.id,problemHash:ctx.problemHash,engine:ENGINE,...extra},60000);
    if(result.receipt&&ctx===connection)accept(result.receipt,ctx);
    else if(result.diagnostics&&ctx===connection&&ctx.last)hooks.diagnostics?.({...ctx.last,diagnostics:result.diagnostics});
    return result;
  }
  async function exportDiagnostics({includeInput=false,signal,onProgress}={}) {
    const cut=await diagnosticCommand('diagnostics-export',{includeInput});
    if(signal?.aborted)throw new DOMException('Export cancelled','AbortError');
    return helperRequest({type:'diagnostics-export',payload:cut.payload,filename:cut.filename,includeInput},{signal,onProgress});
  }
  async function setDiagnostics(enabled){return diagnosticCommand('diagnostics-settings',{enabled:!!enabled});}
  async function visibility(){
    refreshBackgroundCopy();
    if(document.hidden||!connection||!worker||connection.last?.state!=='paused_hidden')return;
    try{const ctx=connection,r=await rpc({type:'visibility',runId:ctx.id,problemHash:ctx.problemHash,engine:ENGINE,visible:true});accept(r.receipt,ctx);}catch(_){}
  }
  function init(callbacks){hooks=callbacks;setupWorkers();if(new URLSearchParams(location.search).get('verify')==='1'){const b=document.createElement('button');b.id='mdlVerify';b.type='button';b.textContent='Run bounded browser comparison';const pre=document.createElement('pre');pre.id='mdlVerifyResult';pre.style.cssText='max-height:200px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere';$('mdlRefresh').parentElement.append(b,pre);}if($('mdlVerify'))$('mdlVerify').addEventListener('click',async()=>{const b=$('mdlVerify');b.disabled=true;try{await ensureWorker();const r=await rpc({type:'verify'},90000);$('mdlVerifyResult').textContent=JSON.stringify(r.result);}catch(e){$('mdlVerifyResult').textContent=e.message;}finally{b.disabled=false;}});$('chkMdl').checked=false;$('chkMdl').addEventListener('change',()=>{if($('chkMdl').checked)askUnlock();else{lock();hooks.modeChanged?.();hint('');}});$('mdlUnlockForm').addEventListener('submit',unlock);$('mdlUnlockCancel').addEventListener('click',()=>{lock();closeDialog();});$('mdlUnlock').addEventListener('cancel',e=>{e.preventDefault();lock();closeDialog();});$('mdlRefresh').addEventListener('click',()=>recover().catch(e=>hint(e.message)));$('mdlImportLegacy').addEventListener('click',()=>recover('import-legacy').catch(e=>hint(e.message)));window.addEventListener('pagehide',detach);$('mdlDelete').addEventListener('click',()=>operation('delete').then(()=>{connection=null;hooks.deleted?.();hint(say('Local checkpoint deleted.','Lokalno stanje je izbrisano.'));}).catch(e=>hint(e.message)));document.addEventListener('visibilitychange',visibility);window.MDLxDCCLocale?.subscribe?.(()=>refreshBackgroundCopy());refreshBackgroundCopy();}
  window.TripPrivate=Object.freeze({init,start,resume,cancel,recover,detach,exportDiagnostics,setDiagnostics,diagnosticsAvailable:()=>!!connection,enabled:()=>enabled,setBusy(value){busy=value;$('mdlWorkers').disabled=busy;$('mdlImportLegacy').disabled=busy;$('chkMdl').disabled=busy;$('mdlRefresh').disabled=busy;$('mdlDelete').disabled=busy;}});
})();
