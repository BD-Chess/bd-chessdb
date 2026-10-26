import {PAIR_REQUESTS,pendingRequests} from './pairing.mjs';
const $=id=>document.getElementById(id);
const status=text=>{$('status').textContent=text;};
const send=data=>chrome.runtime.sendMessage({protocol:'omnicpq.gui.v2',...data});
async function assistants(selected=$('assistant').value){
  const saved=await chrome.storage.session.get(PAIR_REQUESTS),legacy=await chrome.storage.session.get('requests');
  const candidates=[...pendingRequests(legacy.requests).map(r=>({...r,protocol:'omnicpq.browser.v1'})),
    ...pendingRequests(saved[PAIR_REQUESTS]).map(r=>({...r,protocol:'omnicpq.gui.v2'}))].sort((a,b)=>b.createdAt-a.createdAt);
  const latest=new Map();for(const r of candidates)if(!latest.has(r.id))latest.set(r.id,r);
  $('assistant').replaceChildren();
  for(const r of latest.values()){
    let tab;try{tab=await chrome.tabs.get(r.id);}catch{continue;}
    if(tab.incognito||(tab.url!==undefined&&!/^https:\/\/www\.mdlxdcc\.org\/omnicpq\/(?:index\.html)?(?:[?#].*)?$/i.test(tab.url)))continue;
    const option=new Option('OmniCPQ pomočnik · zavihek '+r.id+(r.protocol==='omnicpq.gui.v2'?' · polni GUI':' · navigacija'),String(r.id));
    option.dataset.protocol=r.protocol;$('assistant').add(option);
  }
  if([...$('assistant').options].some(o=>o.value===selected))$('assistant').value=selected;
}
async function tabs(){
  const current=await chrome.tabs.query({currentWindow:true});
  for(const active of current.filter(t=>/^https:\/\/(?:cpq-stg\.apps\.test-ocp|cpq\.apps\.prod-ocp)\.ts\.telekom\.si\/sl\/(?:order|quote|dashboard)(?:\/|$)/.test(t.url||'')&&!t.incognito)) {
    $('cpq').add(new Option(active.title||'CPQ zavihek',String(active.id)));
    if(active.active)$('cpq').value=String(active.id);
  }
  await assistants();
  $('pair').disabled=!$('cpq').options.length||!$('assistant').options.length;
  status($('pair').disabled?'Pomočnik sam pripravlja povezavo. To ikono odpri na CPQ zavihku.':'Izberi pravi par zavihkov in obseg, nato klikni Poveži. Pomočnik bo nadaljeval sam.');
}
$('pair').onclick=async()=>{try{
  const selected=$('assistant').value;await assistants(selected);
  if(!$('assistant').selectedOptions.length||$('assistant').value!==selected){status('Zahteva je potekla ali je zavihek zaprt. V pomočniku preveri povezavo, nato ponovno odpri to ikono.');return;}
  const r=await send({protocol:$('assistant').selectedOptions[0].dataset.protocol,type:'pair',cpqTabId:Number($('cpq').value),assistantTabId:Number($('assistant').value),scope:$('scope').value,allowWrites:$('allow-writes').checked});
  status(r.ok?'Povezano · '+(r.capabilities?.workerVersion||'navigacija')+(r.pairingVerification==='VERIFIED_EXTERNAL_SENDER_URL_METADATA_WITHHELD'?' · PWA URL je Edge skril; izvor zahteve preverjen.':'.')+' Pomočnik bo povezavo zaznal sam.':'Povezava ni uspela: '+r.error+(r.detail?' · '+r.detail:''));
}catch{status('Povezava ni uspela. Dostop odobri z odpiranjem te ikone na CPQ zavihku.');}};
$('unpair').onclick=async()=>{await send({type:'unpair'});status('Povezava je prekinjena.');};
tabs().catch(()=>status('Izbranega zavihka ni mogoče prebrati.'));
