import {initialState,validateState,clone,previewOperations} from './andaluzija-poi.mjs';
const endpoint='/.netlify/functions/andaluzija-state';
const LOCAL='andaluzija-encrypted-draft-v1';
const domain='www.mdlxdcc.org';
export const sealState=async(state,password)=>globalThis.ShieldCore.seal({kind:'sections',schema:'andaluzija-state-payload-v1',state:validateState(state)},[password],{domain});
export const openState=async(snapshot,password)=>{
 if(snapshot?.header?.domain!==domain)throw Error('ENVELOPE_DOMAIN');
 const value=await globalThis.ShieldCore.openEnvelope(snapshot,password);
 if(value.schema!=='andaluzija-state-payload-v1')throw Error('ENVELOPE_SCHEMA');
 return validateState(value.state);
};
export class SharedTripStore{
 constructor({fetcher=(...args)=>globalThis.fetch(...args),seal=sealState,open=openState,local=globalThis.localStorage,notify=()=>{}}={}){
  this.fetcher=fetcher;this.seal=seal;this.open=open;this.local=local;this.notify=notify;this.state=initialState();this.revision=0;this.etag='"0"';this.status='locked';this.dirty=false;this.generation=0;this.queue=Promise.resolve();this.epoch=0;this.password=null;this.conflict=null;this.pending=null;this.undo=null;this.requests=new Map();this.draftQueue=Promise.resolve();
 }
 emit(status,extra={}){this.status=status;this.notify({status,revision:this.revision,dirty:this.dirty,...extra});}
 async remote(){const r=await this.fetcher(endpoint,{credentials:'same-origin',cache:'no-store'});const b=await r.json();if(!r.ok)throw Error(b.error||'LOAD_FAILED');return {...b,etag:r.headers.get('ETag')};}
 readLocal(){try{return JSON.parse(this.local?.getItem(LOCAL)||'null');}catch{return null;}}
 async unlock(password){
  const epoch=++this.epoch;this.password=password;
  const local=this.readLocal();let remote;
  try{remote=await this.remote();}catch(e){
   if(!local){this.lock();throw e;}remote={revision:local.baseRevision,etag:local.etag,snapshot:null,unavailable:true};
  }
  if(epoch!==this.epoch)throw Error('LOCKED');
  this.revision=remote.revision;this.etag=remote.etag||'"0"';
  this.state=remote.snapshot?await this.open(remote.snapshot,password):initialState();this.state.revision=this.revision;
  if(local?.snapshot){
   const draft=await this.open(local.snapshot,password);this.generation=Number.isSafeInteger(local.generation)?local.generation:0;if(epoch!==this.epoch)throw Error('LOCKED');
   if(remote.unavailable&&!local.dirty){this.state=draft;this.state.revision=local.baseRevision;}
   if(local.dirty){
    this.state=draft;this.state.revision=local.baseRevision;this.dirty=true;this.pending=local.pending||null;
    const accepted=this.pending&&remote.receipts?.find(x=>x.requestId===this.pending.requestId);
    if(accepted&&accepted.revision===remote.revision&&local.generation===this.pending.generation){
     this.state=remote.snapshot?await this.open(remote.snapshot,password):draft;this.state.revision=remote.revision;this.pending=null;this.dirty=false;
    }else if(local.baseRevision!==remote.revision&&!remote.unavailable){
     this.conflict={remote,local:clone(draft)};this.emit('conflict');return this.getState();
    }else this.state.revision=remote.revision;
   }
  }
  if(epoch!==this.epoch)throw Error('LOCKED');
  this.emit(remote.unavailable?'offline':this.dirty?'applied_local':'synced',{updatedAt:remote.updatedAt});
  return this.getState();
 }
 getState(){return clone(this.state);}
 async persist(){
  if(!this.password)return;
  const epoch=this.epoch,generation=this.generation,state=this.getState(),password=this.password;
  const meta={baseRevision:this.revision,etag:this.etag,dirty:this.dirty,generation,pending:this.pending};
  this.draftQueue=this.draftQueue.catch(()=>{}).then(async()=>{
   const snapshot=await this.seal(state,password);if(epoch!==this.epoch)return;
   try{this.local?.setItem(LOCAL,JSON.stringify({...meta,snapshot}));}catch{this.emit('local_unavailable');}
  });await this.draftQueue;
 }
 preview(ops,baseRevision){return previewOperations(this.state,ops,baseRevision);}
 async apply(ops,baseRevision,requestId){
  if(!this.password)throw Error('AUTH_REQUIRED');if(this.conflict)throw Error('REVISION_CONFLICT');
  if(!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId||''))throw Error('INVALID_REQUEST_ID');
  const body=JSON.stringify(ops),seen=this.requests.get(requestId);
  if(seen){if(seen!==body)throw Error('REQUEST_ID_REUSED');return {status:'applied_local',duplicate:true,revision:this.revision};}
  const result=this.preview(ops,baseRevision),before=this.getState();
  this.state=result.state;this.generation++;this.dirty=true;
  this.undo={before,afterGeneration:this.generation};
  this.requests.set(requestId,body);while(this.requests.size>32)this.requests.delete(this.requests.keys().next().value);
  this.emit('applied_local');await this.persist();return {status:'applied_local',diff:result.diff,revision:this.revision};
 }
 save(){
  const action=()=>this.performSave();this.queue=this.queue.then(action,action);return this.queue;
 }
 async performSave(){
  if(!this.password)throw Error('AUTH_REQUIRED');if(this.conflict)throw Error('REVISION_CONFLICT');
  if(!this.dirty)return {status:'synced',revision:this.revision,etag:this.etag};
  const epoch=this.epoch,generation=this.generation,password=this.password,submitted=this.getState();
  if(!this.pending){
   const snapshot=await this.seal(submitted,password);if(epoch!==this.epoch)throw Error('LOCKED');
   this.pending={requestId:crypto.randomUUID(),baseRevision:this.revision,snapshot,generation};
  }
  const pending=this.pending;await this.persist();if(epoch!==this.epoch)throw Error('LOCKED');this.emit('saving');
  let r,b;
  try{
   r=await this.fetcher(endpoint,{method:'PUT',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','If-Match':this.etag},body:JSON.stringify({requestId:pending.requestId,baseRevision:pending.baseRevision,snapshot:pending.snapshot})});b=await r.json();
  }catch(e){if(epoch===this.epoch)this.emit('offline');throw e;}
  if(epoch!==this.epoch)throw Error('LOCKED');
  if(r.status===409){this.conflict={remote:{...b,etag:r.headers.get('ETag')},local:this.getState()};this.emit('conflict');throw Error(b.error||'REVISION_CONFLICT');}
  if(!r.ok){this.emit('failed');throw Error(b.error||'SAVE_FAILED');}
  if(!r.headers.get('ETag')||b.acceptedRevision!==pending.baseRevision+1)throw Error('INVALID_RECEIPT');
  this.revision=b.revision;this.etag=r.headers.get('ETag');this.pending=null;
  if(b.revision!==b.acceptedRevision){
   this.conflict={remote:{...b,etag:this.etag},local:this.getState()};this.emit('conflict');throw Error('REVISION_CONFLICT');
  }
  // If the acknowledged request was older than local edits, keep those edits dirty.
  this.state.revision=this.revision;this.dirty=this.generation!==pending.generation;
  await this.persist();this.emit(this.dirty?'applied_local':'saved',{updatedAt:b.updatedAt});
  if(this.dirty)return this.performSave();
  return {status:'saved',revision:this.revision,etag:this.etag,requestId:pending.requestId};
 }
 async sync(){
  if(!this.password)throw Error('AUTH_REQUIRED');await this.queue.catch(()=>{});
  const epoch=this.epoch,r=await this.remote();if(epoch!==this.epoch)throw Error('LOCKED');
  if(r.revision===this.revision){this.etag=r.etag;return {status:this.dirty?'applied_local':'synced',revision:this.revision};}
  if(this.dirty){this.conflict={remote:r,local:this.getState()};this.emit('conflict');return {status:'conflict',revision:r.revision};}
  const state=r.snapshot?await this.open(r.snapshot,this.password):initialState();if(epoch!==this.epoch)throw Error('LOCKED');
  this.state=state;this.revision=r.revision;this.state.revision=this.revision;this.etag=r.etag;this.undo=null;
  await this.persist();this.emit('synced',{updatedAt:r.updatedAt});return {status:'synced',revision:this.revision};
 }
 async inspectConflict(){
  if(!this.conflict)return null;
  const {remote,local}=this.conflict;return {local:clone(local),remote:remote.snapshot?await this.open(remote.snapshot,this.password):initialState(),revision:remote.revision};
 }
 async acceptRemote(){
  if(!this.conflict)throw Error('NO_CONFLICT');
  const r=await this.remote(),epoch=this.epoch;const state=r.snapshot?await this.open(r.snapshot,this.password):initialState();
  if(epoch!==this.epoch)throw Error('LOCKED');
  // Retain the local encrypted draft until the user explicitly selects this action.
  this.state=state;this.revision=r.revision;this.state.revision=r.revision;this.etag=r.etag;this.conflict=null;this.dirty=false;this.pending=null;this.undo=null;this.generation++;
  await this.persist();this.emit('synced');return this.getState();
 }
 async undoLastOwnChange(){
  if(!this.undo||this.undo.afterGeneration!==this.generation)throw Error('UNDO_UNAVAILABLE');
  await this.sync();if(this.conflict||!this.undo)throw Error('REVISION_CONFLICT');
  const before=this.undo.before;before.revision=this.revision;this.state=before;this.undo=null;this.dirty=true;this.generation++;
  await this.persist();this.emit('applied_local');return {status:'applied_local',revision:this.revision};
 }
 lock(){
  ++this.epoch;this.password=null;this.state=initialState();this.conflict=null;this.pending=null;this.undo=null;this.dirty=false;this.requests.clear();this.generation=0;this.emit('locked');
 }
}

