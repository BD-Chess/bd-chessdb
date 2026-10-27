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
  if(['CPQ_SCREEN_CHANGED','CPQ_TARGET_CHANGED','CPQ_TARGET_COVERED','CPQ_TARGET_OFFSCREEN','CPQ_CONFIRMED_CHOICE_PROTECTED'].includes(code))return 'REPLAN';
  if(['BRIDGE_TIMEOUT','CPQ_ACTION_OUTCOME_UNKNOWN'].includes(code))return 'RECONCILE_OUTCOME';
  return null;
}
const folded=value=>String(value??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/\s+/g,' ').trim();
const driverName=label=>/^model postavitve\b/.test(folded(label))?'model':/^(?:operacijski sistem|os)\b/.test(folded(label))?'os':null;
function driverIntent(goal,driver,current){
  const name=driver==='model'?'model(?: postavitve)?':'(?:operacijski sistem|os)';
  const clauses=folded(goal).replace(/["“„`][\s\S]*?["”`]/g,'').split(/[.;\n]/);
  for(const text of clauses){
    if(/\b(?:ne|nikoli|ohrani|ostane|zakaj|spet|znova)\b/.test(text))continue;
    const change=new RegExp('\\b(?:nastavi|spremeni|zamenjaj|izberi|preklopi)\\b.{0,65}\\b'+name+'\\b').test(text);
    const declaration=new RegExp('(?:^|[,;:]\\s*)'+name+'\\s+(?:naj bo\\s+|=\\s*|:\\s*)?\\S').test(text);
    if(change||declaration)return change||!current||!text.includes(folded(current));
  }
  return false;
}
// Evaluated against THIS fresh document/item view, with no cached lock that can
// leak to another VM. Empty dependent fields never invalidate a visible parent.
export function configuredChoiceGuard(goal,observation,action,{guided=true}={}){
  const control=observation?.controls?.find(c=>c.id===action.targetId);if(!control)return null;
  if(['fill','selectNative'].includes(action.operation)&&(!action.inputMode||action.inputMode==='replace')&&typeof control.value==='string'&&control.value===action.value)
    return {status:'ALREADY_MATCHES',label:control.label,value:control.value};
  if(!guided||!['click','doubleClick','key','fill','selectNative'].includes(action.operation))return null;
  const field=control.choiceOwner||control;
  if(!control.choiceOwner&&!['combobox','select','field'].includes(control.kind))return null;
  const driver=driverName(field.label);if(!driver)return null;
  const main=field.fieldScope==='component'?observation.controls.find(c=>c.fieldScope==='form'&&driverName(c.label)===driver&&c.value):field;
  if(main?.value&&!driverIntent(goal,driver,main.value))return {error:'CPQ_CONFIRMED_CHOICE_PROTECTED',label:main.label,value:main.value};
  if(!field.valueSource||field.valueSource==='unknown')return {error:'CPQ_DRIVER_STATE_UNKNOWN',label:field.label};
  return null;
}
export function continuationMessage(run,summary){
  return `Nadaljuj isto uporabnikovo nalogo po koraku ${run.step}. Cilj: ${run.goal}\nZadnji rezultat: ${String(summary||'').slice(0,1400)}\nUporabi novo opazovanje istega dokumenta. Ohrani že potrjene izbire. Če je cilj dosežen, povej rezultat brez novega dejanja.`;
}
export function conversationForModel(messages){
  const selected=[];
  for(let i=0;i<messages.length;i++){
    const m=messages[i],automatic=m.input?.automaticContinuation;
    if(m.role==='user'){if(!automatic)selected.push({role:m.role,content:m.content});continue;}
    if(m.role!=='assistant'||m.status!=='complete')continue;
    if(automatic){
      const next=messages.slice(i+1).find(n=>n.role==='user'&&!n.input?.automaticContinuation||n.role==='assistant'&&n.input?.automaticContinuation);
      if(next?.role==='assistant')continue;
    }
    const progress=automatic||m.meta?.browserNavigation;
    const text=String(m.content).replace(/```omnicpq_(?:action|navigation)[\s\S]*?(?:```|$)/g,'').trim();
    selected.push({role:m.role,content:progress?[text.slice(0,1400),m.meta?.browserNavigation?.summary].filter(Boolean).join('\n'):m.content});
  }
  return selected.slice(-16);
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
