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
// Only a direct imperative or an explicit "OS naj bo …" specification grants
// a change. Descriptions/questions/quoted or reported commands grant nothing.
// Process every clause: a later explicit correction supersedes an earlier one.
function driverIntent(goal,driver){
  const name=driver==='model'?'model(?: postavitve)?':'(?:operacijski sistem|os)';
  const text=String(goal??'').replace(/"[^"]*"|“[^”]*”|„[^“”]*[“”]|`[^`]*`|'[^']*'/g,' ');
  let intent=null;
  for(const raw of text.match(/[^.!?;\n]+[.!?;\n]?/g)||[]){
    const t=folded(raw).replace(/[.!;\n]$/,'').trim();
    if(raw.trim().endsWith('?')||/^(?:ali|kako|kaj|zakaj|ce|lahko|primer|po(?:sta| e-posti)|model (?:pravi|predlaga))\b/.test(t))continue;
    const keep=new RegExp('^(?:prosim\\s+)?(?:(?:ne\\s+(?:spreminjaj|spremeni|zamenjaj|nastavljaj|nastavi|izberi))|ohrani|pusti)\\b.{0,45}\\b'+name+'\\b').test(t);
    if(keep){intent={keep:true};continue;}
    const imperative=new RegExp('^(?:prosim\\s+)?(?:zdaj\\s+)?(?:spremeni|zamenjaj|nastavi|izberi|preklopi)\\s+'+name+'\\b\\s*(?:(?:v|na|za)\\s+|[=:]\\s*)?(.+)$').exec(t);
    const specification=new RegExp('^'+name+'\\s+(?:naj bo|nastavi na)\\s+(.+)$').exec(t);
    const value=(imperative||specification)?.[1]?.split(/,|\s+(?:in|ter|pa)\s+(?:uredi|nastavi|spremeni|nadaljuj|ohrani)\b/)[0].trim();
    if(value)intent=/\b(?:ali|oziroma|morda|lahko|ne|izbran|nastavljen|enak|isti)\b|\//.test(value)?{unclear:true}:{value};
  }
  return intent;
}
const matching=(a,b)=>folded(a).replace(/\s*\*$/,'')===folded(b).replace(/\s*\*$/,'');
// Re-evaluate this fresh item view; never persist a lock across VMs/documents.
export function configuredChoiceGuard(goal,observation,action,{guided=true}={}){
  const controls=observation?.controls||[],control=controls.find(c=>c.id===action.targetId);if(!control)return null;
  if(['fill','selectNative'].includes(action.operation)&&(!action.inputMode||action.inputMode==='replace')&&typeof control.value==='string'&&control.value===action.value)
    return {status:'ALREADY_MATCHES',label:control.label,value:control.value};
  if(!guided||['read','scroll','ensureVisible','hover'].includes(action.operation))return null;
  const field=control.choiceOwner||control,driver=driverName(field.label);
  if(!driver){
    if(control.kind==='option'&&!control.choiceOwner&&controls.some(c=>driverName(c.label)&&c.value))return {error:'CPQ_DRIVER_STATE_UNKNOWN',label:control.label};
    return null;
  }
  const parents=controls.filter(c=>c.fieldScope==='form'&&driverName(c.label)===driver&&c.value);
  const derived=field.fieldScope==='component'||/[€$]|podedovan|vrednost nastavljena/i.test(field.label);
  const main=derived&&parents.length===1?parents[0]:field;
  const intent=driverIntent(goal,driver);
  if(!field.valueSource||field.valueSource==='unknown')return {error:'CPQ_DRIVER_STATE_UNKNOWN',label:field.label};
  if(intent?.unclear)return {error:'CPQ_CHOICE_INTENT_UNCLEAR',label:field.label};
  if(!intent?.value||intent.keep)return {error:main.value?'CPQ_CONFIRMED_CHOICE_PROTECTED':'CPQ_CHOICE_INTENT_REQUIRED',label:main.label,value:main.value};
  // Opening a specifically requested driver is allowed. Choosing/filling a
  // different option is not covered by that grant; keys cannot cycle values.
  let target;
  if(control.choiceOwner)target=control.label;
  else if(action.operation==='fill')target=action.value;
  else if(action.operation==='selectNative')target=control.options?.find(o=>o.value===action.value)?.label??action.value;
  if(target!==undefined&&!matching(target,intent.value))return {error:'CPQ_CHOICE_TARGET_MISMATCH',label:field.label};
  if(action.operation==='key'&&!['Enter','Space'].includes(action.key)||!['click','doubleClick','key','fill','selectNative'].includes(action.operation))return {error:'CPQ_CONFIRMED_CHOICE_PROTECTED',label:field.label,value:field.value};
  if(!control.choiceOwner&&main.value&&matching(main.value,intent.value)&&['click','doubleClick','key'].includes(action.operation))return {error:'CPQ_CONFIRMED_CHOICE_PROTECTED',label:main.label,value:main.value};
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
