// Shared host contract. Product rules remain in the separately authenticated knowledge.
export const WORK_MODES = Object.freeze([
  {mode:'guide',short:'Vodič',symbol:'01',purpose:'Razumi storitev, TS posebnosti in vire.'},
  {mode:'jira',short:'Zahteve',symbol:'02',purpose:'Od poslovne potrebe do sledljivega osnutka.'},
  {mode:'model',short:'Modeliranje',symbol:'03',purpose:'Zasnova PLM modela, pravil in odvisnosti.'},
  {mode:'work',short:'OmniCPQ',symbol:'04',purpose:'Delo v pravem dokumentu in postavki.'},
  {mode:'plm',short:'Testiranje',symbol:'05',purpose:'E2E od zahteve do dokaza; vključuje PLM teste.'}
]);
export const MODE_ALIASES=Object.freeze({CPQ_HELP:'work',PLM_TESTS:'plm',JIRA_REQUIREMENT:'jira',GUIDE:'guide',PLM_MODELING:'model',E2E_TESTS:'plm',requirements:'jira',modeling:'model',testing:'plm',omnicpq:'work'});
export function normalizeMode(value,fallback='guide'){
  return WORK_MODES.some(m=>m.mode===value)?value:Object.hasOwn(MODE_ALIASES,value)?MODE_ALIASES[value]:fallback;
}
export const CONTEXT_FIELDS=Object.freeze({requirement:4000,model:2000,documentItem:1200,decisions:4000,openQuestions:4000});
export function normalizeWorkspace(value={}){
  const result={};
  for(const [key,max] of Object.entries(CONTEXT_FIELDS))result[key]=typeof value?.[key]==='string'?value[key].slice(0,max):'';
  return result;
}
export const MODE_CONTRACT=`En pomočnik, pet načinov: Vodič → Zahteve → Modeliranje → OmniCPQ → Testiranje.
Stare CPQ_HELP/PLM_TESTS/JIRA_REQUIREMENT obravnavaj združljivo. Testiranje je E2E in vključuje PLM teste.
Ob menjavi načina ohrani storitev, zahtevo, model/verzijo, dokument/postavko, potrjene odločitve in odprta vprašanja. Že razrešenega ne sprašuj ponovno. Uporabniški zapis odločitve ni odobritev poslovne akcije.
Vodič loči splošno razlago, potrjeno TS pravilo, datirani podatek, predlog in neznanko. Navedi celotno vidno pot ali URL vira in odločilni odsek. VPI/VPN/VPS ter SD-WAN/SD-WAN Lite ostanejo različne storitve.
Modeliranje pomaga tudi brez GUI: hierarhija, karakteristike, števnosti, relacije, pogoji in sled zahtev. Predlog ni implementiran model. Spletni PLM zahteva svoj preverjeni adapter, dostop in dovoljenje; Java PLM ni pokrit s CPQ Bridge.
Testiranje poveže zahtevo → različico pravila/modela → test → pričakovanje → opaženo → dokaz. Brez potrjenega pravila je oracle PROPOSED/ORACLE_PENDING; neizvedeni nadaljnji OMS/obračun/provisioning so NOT_RUN.
Izbrani način ne podeli dovoljenja za poslovno spremembo. Shranjeno naročilo ni oddano ali aktivirano. 32 vCPU ne znižaj na 24; TB in OS/model postavitve brez potrditve ostanejo odprti.
59 neintegriranih kandidatov Jira/Confluence ostane ločena naloga; ta izdaja jih ne vključuje.`;
