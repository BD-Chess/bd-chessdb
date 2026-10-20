// Application executor: the manual planner owns all data, solver, validation and saves.
import {clone,ensureDay,dayKey,mapsForStop,mapsForLeg} from './andaluzija-poi.mjs';
export function createTravelExecutor({adapter=()=>window.AndaluzijaTripOptiV1,fetcher=fetch,renderPreview=()=>{},progress=()=>{}}={}){
 const requests=new Map();let catalogue;
 const list=async()=>catalogue??=await fetcher('/ai/skills/andaluzija-2027-guide/references/visits.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('CATALOGUE_UNAVAILABLE');return r.json();});
 function clear(){requests.clear();catalogue=null;}
 function operations(day,scope,changes,choices){
  const stops=clone(day.stops);
  for(const c of changes){
   if(!c||!['add','enable','disable','duration'].includes(c.op)||typeof c.id!=='string')throw Error('INVALID_CHANGE');
   let p=stops.find(p=>p.id===c.id);
   if(c.op==='add'&&!p){
    const choice=choices.find(p=>p.id===c.id);if(!choice)throw Error('UNKNOWN_POI');
    // Match a catalogue alternative by its name to avoid a duplicate of an existing stop.
    const normalize=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(' · ')[0].trim();
    p=stops.find(p=>normalize(p.name)===normalize(choice.name));
    if(!p){p={id:choice.id,city:scope.city,name:choice.name,durationMin:choice.durationMin,enabled:true,fixedTime:null,optional:true,source:choice.source,checked:'2026-10-20',location:{query:choice.query,status:'unresolved'}};stops.push(p);}
   }
   if(!p)throw Error('UNKNOWN_POI');if(p.fixedTime)throw Error('FIXED_EVENT');
   if(c.op==='disable')p.enabled=false;else if(c.op==='duration'){if(!Number.isInteger(c.minutes)||c.minutes<0||c.minutes>720)throw Error('INVALID_DURATION');p.durationMin=c.minutes;}else p.enabled=true;
  }
  return changes.length?[{type:'replaceStops',...scope,stops}]:[];
 }
 async function execute(action,{epoch,signal}={}){
  if(requests.has(action.requestId)){const seen=requests.get(action.requestId);if(seen.body!==JSON.stringify(action))throw Error('REQUEST_ID_REUSED');return seen.promise;}
  const promise=run(action,{epoch,signal});requests.set(action.requestId,{body:JSON.stringify(action),promise});while(requests.size>32)requests.delete(requests.keys().next().value);return promise;
 }
 async function run(a,{epoch,signal}){
  const api=adapter(),scope=clone(a.selection),receipt={actor:a.actor,requestId:a.requestId,tripId:'andaluzija-2027',selection:scope,baseRevision:a.baseRevision,epoch,status:'failed',changedIds:[]};
  const sessionEpoch=api.getExecutionState?.().epoch;
  const alive=()=>{if(sessionEpoch!==undefined&&api.getExecutionState().epoch!==sessionEpoch)throw Error('LOCKED');const c=api.getContext();if(signal?.aborted||epoch!==a.epoch)throw Error('LOCKED');if(JSON.stringify(c.selection)!==JSON.stringify(scope))throw Error('SCOPE_CHANGED');};
  try{
   if(a.tripId!==receipt.tripId||!/^[-a-zA-Z0-9_]{8,100}$/.test(a.requestId||''))throw Error('INVALID_ACTION');alive();
   // Strong read before every action; never automatically rebase onto a newer revision.
   const writable=api.getContext().capabilities.write;
   const synced=writable?await api.sync():{status:'synced'};alive();if(synced.status==='conflict'||api.getContext().revision!==a.baseRevision)throw Error('REVISION_CONFLICT');
   const state=api.getState(),day=ensureDay(state,scope.variant,scope.day,scope.city),guard=api.getExecutionState?.();
   const readonly=['get_maps','propose_visit_changes'].includes(a.name)||a.name==='optimize_day_visits'&&!a.args.apply;
   if(!readonly&&(!a.allowWrite||!writable))throw Error('WRITE_NOT_REQUESTED');
   if(a.name==='get_maps'){
    const points=[day.entry,...day.stops],from=points.find(p=>p.id===a.args.from),to=points.find(p=>p.id===a.args.to);if(!from||a.args.to&&!to)throw Error('UNKNOWN_POI');
    if(to){const route=[day.entry,...day.stops.filter(p=>p.enabled),day.entry];if(!route.some((p,i)=>p.id===from.id&&route[i+1]?.id===to.id))throw Error('NOT_ADJACENT');}
    return {...receipt,status:'preview',maps:to?mapsForLeg(from,to):mapsForStop(from).walk};
   }
   if(['propose_visit_changes','apply_visit_changes','optimize_day_visits'].includes(a.name)){
    const args=a.args,changes=args.changes||[],choices=(await list())[scope.city]||[];alive();
    let ops=operations(day,scope,changes,choices),solver;
    if(ops.length)renderPreview({diff:api.previewChanges(ops,a.baseRevision).diff,requestId:a.requestId});
    if(args.optimize||a.name==='optimize_day_visits'){
     solver=await api.optimizeDay({mode:'estimate',segment:args.segment,operations:ops,baseRevision:a.baseRevision,progress:s=>{try{alive();progress(s);}catch{}}});alive();
     ops.push({type:'reorder',...scope,ids:solver.ids,origin:'deep',receipt:solver.receipt});
    }
    if(!ops.length)throw Error('NO_CHANGES');const p=api.previewChanges(ops,a.baseRevision);alive();
    receipt.changedIds=[...new Set(p.diff.flatMap(d=>[...d.changes.map(x=>x.id),...d.orderAfter.filter((id,i)=>id!==d.orderBefore[i])]))];
    const final=p.diff.at(-1);receipt.order=final.orderAfter;
    renderPreview({diff:p.diff,solver,requestId:a.requestId});
    if(readonly)return {...receipt,status:'preview'};
    // Fixed events were guarded above; preserve generation across asynchronous auth.
    const applied=await api.applyChanges(ops,a.baseRevision,a.requestId,guard);alive();
    if(applied.status!=='applied_local')throw Error('APPLY_FAILED');
   }else if(a.name==='undo_last_own_change'){await api.undoLastOwnChange();alive();}
   else if(a.name!=='save_visit_plan')throw Error('UNKNOWN_ACTION');
   const saved=await api.save();alive();
   if(!['saved','synced'].includes(saved.status)||!saved.etag)throw Error('SAVE_FAILED');
   return {...receipt,status:saved.status,save:saved};
  }catch(e){
   const message=String(e.message||e);const reason=/LOCATION|lokacij|POINT|COORDINATE/i.test(message)?'LOCATION_REQUIRED':/REVISION|spremenil|CONFLICT/i.test(message)?'REVISION_CONFLICT':/FIXED_EVENT/i.test(message)?'FIXED_EVENT':/SCOPE/.test(message)?'SCOPE_CHANGED':/LOCKED|Abort/.test(message)?'LOCKED':'ACTION_FAILED';
   return {...receipt,status:reason==='LOCKED'?'cancelled':reason==='REVISION_CONFLICT'?'conflict':'failed',reason};
  }
 }
 return {execute,clear};
}
