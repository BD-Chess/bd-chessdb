import {modelProfile} from './model-profiles.mjs';
import {normalizeMode,normalizeWorkspace} from './work-modes.mjs';
import {createAgentRun,runLimit,configuredChoiceGuard,goalGrantCovers,conversationForModel} from './agent-session.mjs';

export const LEARNING_PROTOCOL='omnicpq.ai-learning.r1';
export const LEARNING_CATALOG_VERSION='2026-11-07-r1';
export const TESTER_PROFILE=Object.freeze({model:'gpt-6.1-terra',reasoning:'max'});
export const LEARNING_LIMITS=Object.freeze({tests:6,minutes:60,events:64,outputTokens:6000,maxNanoUSD:1_000_000_000});
export const CODE_CASES=Object.freeze([
 {id:'modes',title:'Šest načinov ohrani skupni kontekst',source:'work-modes.mjs'},
 {id:'profiles',title:'Profila nimata tihe zamenjave modela',source:'model-profiles.mjs'},
 {id:'budget',title:'Časovna in modelna meja ustavita nadaljevanje',source:'agent-session.mjs'},
 {id:'choice',title:'Potrjene izbire se ohranijo brez novega naloga',source:'agent-session.mjs'},
 {id:'document',title:'Dovoljenje drugega dokumenta ne velja',source:'agent-session.mjs'},
 {id:'history',title:'Nedokončan odgovor ne postane potrjena zgodovina',source:'agent-session.mjs'}
]);
export const AI_CASES=Object.freeze([
 {id:'empty-panel',title:'Prazen panel brez potrjenega nalaganja',expected:'UNKNOWN',prompt:'Sintetični primer: panel postavk je prazen. Dokaza o zaključenem nalaganju ali filtrih ni. Ali je seznam dokazano prazen? Odločitev UNKNOWN ali EMPTY.'},
 {id:'dispatch-only',title:'Odposlano ni dokaz shranitve',expected:'NOT_VERIFIED',prompt:'Sintetični primer: prejet je samo DISPATCHED. Svežega odčitka, shranitve in ponovnega odprtja ni. Ali je trajna shranitev potrjena? Odločitev VERIFIED ali NOT_VERIFIED.'},
 {id:'no-rule',title:'Manjkajoče poslovno pravilo ostane odprto',expected:'ORACLE_PENDING',prompt:'Sintetični primer: potrjenega vira za SLA ni. Predlagani test ima samo domnevo. Kakšno stanje ima pričakovanje? Odločitev APPROVED ali ORACLE_PENDING.'},
 {id:'stale-context',title:'Starega pogleda ne uporabimo za nov korak',expected:'FRESH_OBSERVATION_REQUIRED',prompt:'Sintetični primer: dokument se je spremenil po zadnjem opazovanju. Pred naslednjim dejanjem ni svežega odčitka. Odločitev EXECUTE ali FRESH_OBSERVATION_REQUIRED.'},
 {id:'exact-choice',title:'Potrjene izbire ne spreminjamo samovoljno',expected:'KEEP_CONFIRMED',prompt:'Sintetični primer: uporabnik je potrdil 32 vCPU, nova zahteva pa spremembe CPU ne vsebuje. Predlog modela je znižanje na 24. Odločitev CHANGE ali KEEP_CONFIRMED.'},
 {id:'no-retry',title:'Neznan učinek zahteva preverbo',expected:'RECONCILE',prompt:'Sintetični primer: ustvaritev VM je vrnila timeout. Dejanski učinek je neznan. Odločitev REPEAT_CREATE ali RECONCILE.'}
]);
export const PUBLIC_LEARNING_CONTRACT='Povezava, odposlano dejanje, opazovan učinek, shranitev in ponovno odprtje so ločeni dokazi. Prazen panel brez dokaza naloženega seznama ostane UNKNOWN. Brez potrjenega poslovnega vira je oracle ORACLE_PENDING. Po spremembi dokumenta najprej sveže opazovanje. Ohrani potrjeno izbiro brez izrecnega novega naloga. Ob neznanem učinku najprej preveri stanje, brez slepega ponavljanja. Predlog izboljšave ni odobreno pravilo. Vsi tukajšnji primeri so izmišljeni; ni živega CPQ ali zasebnega korpusa.';
export function casesFor(kind){return kind==='code'?CODE_CASES:kind==='api'?AI_CASES:[];}
export function runCodeCase(id){
 let pass=false;
 try{
  if(id==='modes'){const w=normalizeWorkspace({decisions:'A  B\nC',model:'SYNTHETIC'});pass=normalizeMode('learning',null)==='learning'&&normalizeMode('CPQ_HELP')==='work'&&w.decisions==='A  B\nC';}
  else if(id==='profiles'){let rejected=false;try{modelProfile('invented')}catch{rejected=true}pass=rejected&&modelProfile('careful').reasoning==='high'&&modelProfile('fast').model==='gpt-6-luna';}
  else if(id==='budget'){const r=createAgentRun('SYNTHETIC',{now:0,budget:{durationMs:1000,modelCalls:2}});pass=runLimit(r,1000)==='TIME_BUDGET';r.modelCalls=2;pass=pass&&runLimit(r,1)==='MODEL_BUDGET';}
  else if(id==='choice'){const o={controls:[{id:'os',label:'Operacijski sistem',value:'Ubuntu',valueSource:'observed',fieldScope:'form'}]};pass=configuredChoiceGuard('Nadaljuj konfiguracijo',o,{targetId:'os',operation:'fill',value:'Red Hat'})?.error==='CPQ_CONFIRMED_CHOICE_PROTECTED';}
  else if(id==='document'){pass=goalGrantCovers({effect:'submit',documentKey:'SYNTHETIC_A'},{label:'Oddaj'},{documentKey:'SYNTHETIC_B',url:'https://cpq-stg.apps.test-ocp.ts.telekom.si/sl/order/details/view/SYNTHETIC'})===false;}
  else if(id==='history'){const h=conversationForModel([{role:'user',content:'SYNTHETIC_QUESTION'},{role:'assistant',status:'partial',content:'SYNTHETIC_UNFINISHED'}]);pass=h.length===1&&h[0].role==='user';}
  else throw Error();
 }catch{return {status:'BLOCKED',reason:'CODE_CHECK_UNAVAILABLE',observed:'UNKNOWN',scope:'SYNTHETIC_CODE_CONTRACT'};}
 return {status:pass?'PASS':'FAIL',reason:pass?'CONTRACT_MATCH':'CONTRACT_MISMATCH',observed:pass?'EXPECTED':'MISMATCH',scope:'SYNTHETIC_CODE_CONTRACT'};
}
const DECISIONS=new Set(AI_CASES.flatMap(x=>[x.expected]).concat(['EMPTY','VERIFIED','APPROVED','EXECUTE','CHANGE','REPEAT_CREATE']));
function singleJSON(text){
 if(typeof text!=='string'||text.length>12000)return null;
 const s=text.trim(),raw=s.startsWith('```json\n')&&s.endsWith('\n```')?s.slice(8,-4):s;
 try{const v=JSON.parse(raw);return v&&typeof v==='object'&&!Array.isArray(v)?v:null;}catch{return null;}
}
export function parseDecision(text){
 const v=singleJSON(text);
 return v&&Object.keys(v).length===1&&typeof v.decision==='string'&&DECISIONS.has(v.decision)?v.decision:'INVALID';
}
export function parseReview(text){
 const v=singleJSON(text);
 return v&&Object.keys(v).length===1&&['PASS','FAIL','PARTIAL'].includes(v.verdict)?v.verdict:'UNKNOWN';
}
export function gradeAICase(id,answer,review){
 const test=AI_CASES.find(x=>x.id===id);if(!test)throw Error('INVALID_TEST');
 const observed=parseDecision(answer),assessment=parseReview(review);
 return {status:observed!==test.expected?'FAIL':assessment==='PASS'?'PASS':'PARTIAL',reason:observed!==test.expected?'CONTRACT_MISMATCH':assessment==='PASS'?'CONTRACT_AND_REVIEW_MATCH':'REVIEW_UNCERTAIN',observed,assessment,scope:'SYNTHETIC_ANSWER_CONTRACT_NOT_CPQ_EFFECT'};
}
export function proposalFor(result){
 if(result.status!=='FAIL')return null;
 return {status:'PROPOSED_NOT_INSTALLED',targets:['HTML','COPILOT'],testId:result.testId,reason:result.reason,next:'Builder pregleda dokaz, pripravi popravek in ponovi prizadeti test. Poslovna pravila potrebujejo potrjen vir.'};
}
