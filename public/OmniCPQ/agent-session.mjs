// Goal state has no executable queue. Resume always begins with a fresh observation.
export const DEFAULT_AGENT_BUDGET=Object.freeze({actions:80,modelCalls:100,durationMs:20*60000,recoveries:3});
export function createAgentRun(goal,{accountId,epoch,budget={},now=Date.now()}={}){
  const b={...DEFAULT_AGENT_BUDGET,...budget};
  for(const k of ['actions','modelCalls','durationMs','recoveries'])if(!Number.isFinite(b[k])||b[k]<1)throw Error('CPQ_INVALID_BUDGET');
  if(b.actions>200||b.modelCalls>200||b.durationMs>3600000||b.recoveries>10)throw Error('CPQ_INVALID_BUDGET');
  return {goal,accountId,epoch,budget:b,startedAt:now,step:0,modelCalls:0,recoveries:0,attempted:[],receipts:[],status:'GOAL_ACCEPTED'};
}
export function runLimit(run,now=Date.now()){
  return now-run.startedAt>=run.budget.durationMs?'TIME_BUDGET':run.step>=run.budget.actions?'ACTION_BUDGET':run.modelCalls>=run.budget.modelCalls?'MODEL_BUDGET':null;
}
export function actionSignature(a){return JSON.stringify([a.revision,a.targetId,a.operation,a.value,a.checked,a.key,a.inputMode,a.offset,a.query]);}
export function recoveryKind(code){
  if(['CPQ_SCREEN_CHANGED','CPQ_TARGET_CHANGED','CPQ_TARGET_COVERED','CPQ_TARGET_OFFSCREEN'].includes(code))return 'REPLAN';
  if(['BRIDGE_TIMEOUT','CPQ_ACTION_OUTCOME_UNKNOWN'].includes(code))return 'RECONCILE_OUTCOME';
  return null;
}
export function explicitGoalGrant(goal,observation){
  if(!observation?.url?.startsWith('https://cpq-stg.apps.test-ocp.ts.telekom.si/')||!observation.documentKey)return null;
  const text=String(goal).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  // Quoted/negated/discussed commands are data. Only a direct, named request
  // gets inherited authority; ambiguous objects still require a concrete review.
  if(/["“”„`]|\b(?:ne|nikoli|ce|primer|razlozi|kako|lahko bi|ali naj)\b/.test(text))return null;
  const verb=text.match(/^(?:prosim\s+)?(?:zdaj\s+)?(oddaj|izbrisi|storniraj|preklici)\b/);if(!verb)return null;
  const documentId=observation.title?.match(/\bOMNI-\d+\b/i)?.[0];
  if(!documentId||!text.includes(documentId.toLowerCase()))return null;
  const effect=verb[1]==='oddaj'?'submit':verb[1]==='izbrisi'?'delete':'cancel';
  return {effect,documentKey:observation.documentKey,documentId,source:'EXPLICIT_USER_GOAL'};
}
export function goalGrantCovers(grant,prepared,observation){
  if(!grant||grant.documentKey!==observation?.documentKey||!observation.url?.startsWith('https://cpq-stg.apps.test-ocp.ts.telekom.si/'))return false;
  const label=String(prepared.label).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  const effect=/izbrisi|delete/.test(label)?'delete':/storniraj|preklici narocilo|cancel order/.test(label)?'cancel':/oddaj|submit|place order|realiziraj/.test(label)?'submit':null;
  return effect===grant.effect;
}
