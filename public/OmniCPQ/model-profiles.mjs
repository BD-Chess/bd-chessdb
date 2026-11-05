// Fixed server routes. Client selects only the profile id.
// Official model documentation checked 2026-11-05. reasoning.effort has no "auto".
export const MODEL_PROFILES = Object.freeze({
  fast: Object.freeze({title:'Hiter',model:'gpt-6-luna',reasoning:'medium'}),
  careful: Object.freeze({title:'Premišljen',model:'gpt-6.1-terra',reasoning:'high'})
});
export const DEFAULT_PROFILE = 'careful';
export function modelProfile(id=DEFAULT_PROFILE){
  if(typeof id!=='string'||!Object.hasOwn(MODEL_PROFILES,id))throw Object.assign(Error('INVALID_PROFILE'),{code:'INVALID_PROFILE',status:400});
  return MODEL_PROFILES[id];
}
// Conservative nano-USD/token ceilings, not a claimed invoice.
// Include long-context/cache-write/regional maxima; spending caps stay unchanged.
export function modelChargeCeilings(model){
  if(model==='gpt-6-luna')return Object.freeze({input:275,output:825});
  if(model==='gpt-6.1-terra')return Object.freeze({input:5500,output:8250});
  throw Object.assign(Error('UNPRICED_MODEL'),{code:'UNPRICED_MODEL',status:503});
}
