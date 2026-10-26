import {PAIR_REQUESTS,pendingRequests} from './pairing.mjs';
const $=id=>document.getElementById(id);
const status=text=>{$('status').textContent=text;};
const send=data=>chrome.runtime.sendMessage({protocol:'omnicpq.gui.v2',...data});
async function tabs(){
  const current=await chrome.tabs.query({currentWindow:true});
  for(const active of current.filter(t=>/^https:\/\/(?:cpq-stg\.apps\.test-ocp|cpq\.apps\.prod-ocp)\.ts\.telekom\.si\/sl\/(?:order|quote|dashboard)(?:\/|$)/.test(t.url||'')&&!t.incognito)) {
    $('cpq').add(new Option(active.title||'CPQ zavihek',String(active.id)));
    if(active.active)$('cpq').value=String(active.id);
  }
  const saved=await chrome.storage.session.get(PAIR_REQUESTS),legacy=await chrome.storage.session.get('requests');
  for(const r of [...new Map([...pendingRequests(legacy.requests),...pendingRequests(saved[PAIR_REQUESTS])].map(r=>[r.id,r])).values()])$('assistant').add(new Option('OmniCPQ pomočnik · zavihek '+r.id,String(r.id)));
  $('pair').disabled=!$('cpq').options.length||!$('assistant').options.length;
  status($('pair').disabled?'Pomočnik sam pripravlja povezavo. To ikono odpri na CPQ zavihku.':'Izberi pravi par zavihkov in obseg, nato klikni Poveži. Pomočnik bo nadaljeval sam.');
}
$('pair').onclick=async()=>{try{
  const r=await send({type:'pair',cpqTabId:Number($('cpq').value),assistantTabId:Number($('assistant').value),scope:$('scope').value,allowWrites:$('allow-writes').checked});
  status(r.ok?'Povezano. Pomočnik bo povezavo zaznal sam.':'Povezava ni uspela: '+r.error);
}catch{status('Povezava ni uspela. Dostop odobri z odpiranjem te ikone na CPQ zavihku.');}};
$('unpair').onclick=async()=>{await send({type:'unpair'});status('Povezava je prekinjena.');};
tabs().catch(()=>status('Izbranega zavihka ni mogoče prebrati.'));
