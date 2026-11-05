import {DEMO_PROTOCOL,DEMO_EXTENSION_ID,DEMO_PRODUCT} from './privacy.mjs';
import {PAIR_REQUESTS,pendingRequests} from './pairing.mjs';
const $=id=>document.getElementById(id),status=text=>{$('status').textContent=text;};
const send=data=>chrome.runtime.sendMessage({protocol:DEMO_PROTOCOL,...data});
const stage=url=>{try{const u=new URL(url);return u.origin==='https://cpq-stg.apps.test-ocp.ts.telekom.si'&&!u.username&&!u.password;}catch{return false;}};
async function populate(){
 if(chrome.runtime.id!==DEMO_EXTENSION_ID)throw Error();
 const available=await chrome.tabs.query({currentWindow:true});
 for(const tab of available)if(stage(tab.url)&&!tab.incognito)$('cpq').add(new Option('STAGE zavihek '+tab.id,String(tab.id)));
 const saved=await chrome.storage.session.get(PAIR_REQUESTS);
 for(const request of pendingRequests(saved[PAIR_REQUESTS])){
  const tab=await chrome.tabs.get(request.id).catch(()=>null);if(!tab||tab.incognito)continue;
  if(tab.url!==undefined&&!/^https:\/\/www\.mdlxdcc\.org\/omnicpq\/demo\/(?:index\.html)?$/.test(tab.url))continue;
  $('assistant').add(new Option(DEMO_PRODUCT+' · zavihek '+request.id,String(request.id)));
 }
 $('pair').disabled=!$('cpq').options.length||!$('assistant').options.length;
 status($('pair').disabled?'Odpri demo pomočnik in na STAGE zavihku znova odpri to ikono.':'Ločena demo povezava. Samo branje in navigacija; cene in vsebina skriti.');
}
$('pair').onclick=async()=>{
 $('pair').disabled=true;
 try{const r=await send({type:'pair',cpqTabId:Number($('cpq').value),assistantTabId:Number($('assistant').value),scope:$('scope').value,allowWrites:false});status(r.ok?'Povezano z AI za OmniCPQ.':'Povezava ni uspela. Preveri prava zavihka.');}catch{status('Povezava ni dosegljiva.');}
 $('pair').disabled=false;
};
$('unpair').onclick=async()=>{await send({type:'unpair'});status('Demo povezava prekinjena.');};
populate().catch(()=>status('Demo identiteta ali izbrani zavihki niso potrjeni.'));
