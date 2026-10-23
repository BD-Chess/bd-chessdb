const $=id=>document.getElementById(id);
const status=text=>{$('status').textContent=text;};
const send=data=>chrome.runtime.sendMessage({protocol:'omnicpq.gui.v2',...data});
async function tabs(){
  const [active]=await chrome.tabs.query({active:true,currentWindow:true});
  if(active && /^https:\/\/(?:cpq-stg\.apps\.test-ocp|cpq\.apps\.prod-ocp)\.ts\.telekom\.si\/sl\/(?:order|quote|dashboard)(?:\/|$)/.test(active.url||'') && !active.incognito) {
    $('cpq').add(new Option(active.title||'Trenutni CPQ zavihek',String(active.id)));
    $('scope').value=new URL(active.url).pathname.startsWith('/sl/quote')?'quote':'order';
  }
  const {requests=[]}=await chrome.storage.session.get('requests');
  for(const r of requests.filter(r=>r.createdAt>Date.now()-10*60_000))$('assistant').add(new Option('OmniCPQ pomočnik · zavihek '+r.id,String(r.id)));
  $('pair').disabled=!$('cpq').options.length||!$('assistant').options.length;
  status($('pair').disabled?'V pomočniku zahtevaj povezavo, nato to ikono odpri na CPQ zavihku.':'Preveri navigacijo in klikni Poveži.');
}
$('pair').onclick=async()=>{try{
  const r=await send({type:'pair',cpqTabId:Number($('cpq').value),assistantTabId:Number($('assistant').value),scope:$('scope').value});
  status(r.ok?'Povezano. V pomočniku klikni »Preveri povezavo s CPQ«.':'Povezava ni uspela: '+r.error);
}catch{status('Povezava ni uspela. Dostop odobri z odpiranjem te ikone na CPQ zavihku.');}};
$('unpair').onclick=async()=>{await send({type:'unpair'});status('Povezava je prekinjena.');};
tabs().catch(()=>status('Izbranega zavihka ni mogoče prebrati.'));
