/* AI8 model catalog: read-only evidence/status beside the LLM selectors.
   Source: static public projection ai8-model-catalog.json (ai8.model-catalog-public.v1).
   Fails closed: a missing or invalid file shows no model status; selectors and command stay unchanged.
   The catalog grants no selection or routing; UNKNOWN availability is never shown as available. */
"use strict";
(function(root){
  const SCHEMA="ai8.model-catalog-public.v1",NATURE="historical_evidence_only_no_live_controls",MAX_BYTES=65536;
  const DEPLOYMENTS=new Set(["CLOUD_MAL","HOME_LOCAL","SLAIF_REMOTE_HISTORICAL"]);
  const EVIDENCE=new Set(["TESTED","UNKNOWN"]);
  const AVAILABILITY=new Set(["UNKNOWN"]);
  const PROFILES=new Set(["efficient","frontier","max_final"]);
  const TOP_KEYS=["schema","as_of","nature","items"];
  const ITEM_KEYS=new Set(["id","name","deployment","evidence_state","current_availability","advisory_matched_profiles"]);
  // Selector value -> catalog id. Selector order is the page's own; the catalog only describes.
  const CLOUD={gemini:"mal-gemini",grok:"mal-grok",deepseek:"mal-deepseek",glm:"mal-glm"};
  const LOCAL={gemma4:"home-gemma4-q6","qwen3.8":"home-qwen3.8-q6","gpt-oss":"home-gpt-oss-mxfp4","gemma4-q5":"home-gemma4-q5",ministral3:"home-ministral3-q8",magistral:"home-magistral-q6","mellum2.1":"home-mellum2.1-q8","lfm2.5":"home-lfm2.5-q6"};
  const fail=m=>{throw Error("Katalog modelov: "+m);};
  const plain=v=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
  // No paths, URLs, IPs or ports may reach the page.
  const unsafe=s=>/[\\\/:@<>"'`]|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|localhost|https?/i.test(s);

  function validate(d){
    if(!plain(d))fail("ni objekt");
    const keys=Object.keys(d);
    if(keys.length!==TOP_KEYS.length||!TOP_KEYS.every(k=>keys.includes(k)))fail("nepričakovana polja");
    if(d.schema!==SCHEMA)fail("neznana shema");
    if(d.nature!==NATURE)fail("neznana narava kataloga");
    if(typeof d.as_of!=="string"||!/^20\d\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d.as_of))fail("neveljaven datum");
    if(!Array.isArray(d.items)||d.items.length<1||d.items.length>64)fail("neveljaven seznam");
    const ids=new Set();
    for(const it of d.items){
      if(!plain(it))fail("zapis ni objekt");
      for(const k of Object.keys(it))if(!ITEM_KEYS.has(k))fail("nepričakovano polje "+k);
      if(typeof it.id!=="string"||!/^[a-z0-9][a-z0-9.-]{0,63}$/.test(it.id)||unsafe(it.id))fail("neveljaven ID");
      if(ids.has(it.id))fail("podvojen ID");ids.add(it.id);
      if(typeof it.name!=="string"||!/^[A-Za-z0-9][A-Za-z0-9 .()_+-]{0,79}$/.test(it.name)||unsafe(it.name))fail("neveljavno ime");
      if(!DEPLOYMENTS.has(it.deployment))fail("neznana namestitev");
      if(!EVIDENCE.has(it.evidence_state))fail("neznano stanje dokaza");
      if(!AVAILABILITY.has(it.current_availability))fail("neznana dostopnost");
      if("advisory_matched_profiles" in it){
        const p=it.advisory_matched_profiles;
        if(it.deployment!=="CLOUD_MAL"||!Array.isArray(p)||p.length>PROFILES.size||new Set(p).size!==p.length||!p.every(x=>PROFILES.has(x)))fail("neveljavni profili");
        if(p.length&&it.evidence_state!=="TESTED")fail("profil brez dokaza");
      }
    }
    return d;
  }

  function parse(text){
    if(typeof text!=="string"||text.length>MAX_BYTES)fail("prevelik ali prazen");
    return validate(JSON.parse(text.replace(/^﻿/,"")));
  }

  // Four separate facts; each badge carries its own text label so colour is never the only signal.
  function badges(it,localClosed){
    const route=it.deployment==="HOME_LOCAL"?(localClosed?["off","izklopljeno"]:["none","ni potrjeno"]):it.deployment==="SLAIF_REMOTE_HISTORICAL"?["off","zgodovinsko, ni izbire"]:["none","ni preverjeno v katalogu"];
    const prof=it.advisory_matched_profiles;
    return [
      {kind:"evidence",state:it.evidence_state==="TESTED"?"tested":"none",label:"Dokaz",value:it.evidence_state==="TESTED"?"testiran (pretekli obseg)":"ni dokaza",title:"Zgodovinski dokaz. TESTED velja samo za navedeni preizkus; ni splošna ocena."},
      {kind:"availability",state:"unknown",label:"Dostopnost",value:"neznana",title:"Trenutna dostopnost ni preverjena. Ne pomeni, da je model na voljo."},
      {kind:"routing",state:route[0],label:"Usmerjanje",value:route[1],title:"Katalog ne podeljuje izbire ali usmerjanja; odloča stikalo te strani in lastnik izvajalnika."},
      {kind:"id",state:"id",label:"ID",value:it.id+(it.deployment==="CLOUD_MAL"?" · profil: "+(prof&&prof.length?prof.join(", "):"ni ujemanja"):""),title:"Stabilni ID zapisa v katalogu"+(it.deployment==="CLOUD_MAL"?" in točno ujemanje profilov MAL.":".")}
    ];
  }

  const api={validate,parse,badges,CLOUD,LOCAL,SCHEMA};
  if(typeof module!=="undefined"&&module.exports){module.exports=api;return;}
  root.LoopModels=api;
  if(typeof document==="undefined")return;

  const $=id=>document.getElementById(id);
  const el=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;};
  let catalog=null,byId=new Map();

  function badgeRow(it){
    const row=el("span","model-badges");
    for(const b of badges(it,!!$("local")?.disabled)){
      const s=el("span","model-badge "+b.kind+" "+b.state);s.title=b.title;
      s.append(el("span","model-badge-label",b.label+":"),document.createTextNode(" "+b.value));row.append(s);
    }
    return row;
  }
  function line(target,select,map,emptyText,closedText){
    const box=$(target);if(!box)return;
    if(!catalog){box.replaceChildren();box.hidden=true;return;}
    box.hidden=false;
    const value=select?.value||"";
    if(select?.disabled&&!value){box.replaceChildren(el("span","model-line-note",closedText));return;}
    if(!value){box.replaceChildren(el("span","model-line-note",emptyText));return;}
    const ids=value==="all"?Object.values(map):[map[value]];
    const parts=[el("span","model-line-note","Katalog za izbiro (samo dokazi; ne potrjuje zagona):")];
    for(const id of ids){const it=byId.get(id),row=el("span","model-line-item");row.append(el("strong","",it?it.name:id),it?badgeRow(it):el("span","model-line-note","ni v katalogu"));parts.push(row);}
    box.replaceChildren(...parts);
  }
  function table(){
    const host=$("model-evidence");if(!host)return;
    if(!catalog){host.hidden=true;host.querySelector(".model-evidence-body")?.replaceChildren();return;}
    host.hidden=false;
    $("model-evidence-asof").textContent="stanje kataloga "+catalog.as_of.split("-").reverse().map(Number).join(". ");
    const groups=[["CLOUD_MAL","Oblačni (MAL)",CLOUD],["HOME_LOCAL","Lokalni HOME (llama.cpp)",LOCAL],["SLAIF_REMOTE_HISTORICAL","SLAIF · samo zgodovinski",null]];
    const body=host.querySelector(".model-evidence-body"),out=[];
    for(const [dep,title,map] of groups){
      const items=catalog.items.filter(i=>i.deployment===dep);if(!items.length)continue;
      const inSelector=new Set(map?Object.values(map):[]);
      const sec=el("section","model-group");sec.append(el("h4","",title+" · "+items.length));
      const list=el("ul","model-list");
      for(const it of items){const li=el("li","model-item");const head=el("span","model-name",it.name);if(!inSelector.has(it.id))head.append(el("small",""," · ni v izbirniku"));li.append(head,badgeRow(it));list.append(li);}
      sec.append(list);out.push(sec);
    }
    body.replaceChildren(...out);
  }
  function render(){
    line("ext-evidence",$("ext"),CLOUD,"Oblačni: nič izbrano. Dokazi za Gemini, Grok, DeepSeek in GLM so spodaj.","Oblačni: izbirnik je trenutno zaprt.");
    line("local-evidence",$("local"),LOCAL,"Lokalni: nič izbrano.","Lokalni: izbirnik je izklopljen; katalog navaja pretekle teste, dostopnost je neznana.");
    table();
  }
  function status(text){const n=$("model-evidence-status");if(!n)return;n.hidden=!text;n.textContent=text||"";}
  function failClosed(){catalog=null;byId=new Map();render();status("Javni katalog modelov ni dosegljiv ali ni veljaven, zato stanje modelov ni prikazano. Izbirniki delujejo kot prej.");}
  async function load(){
    try{
      const res=await fetch(new URL("../AI8/ai8-model-catalog.json",location.href),{cache:"no-cache",credentials:"omit"});
      if(!res.ok)throw Error("HTTP "+res.status);
      catalog=parse(await res.text());byId=new Map(catalog.items.map(i=>[i.id,i]));
      status("");render();
    }catch(_){failClosed();}
  }
  function start(){
    const form=$("command-form");
    if(form){const later=()=>setTimeout(render,0);form.addEventListener("change",later);form.addEventListener("click",later);form.addEventListener("reset",later);}
    $("host")?.addEventListener("change",()=>setTimeout(render,0));
    render();load();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})(typeof globalThis!=="undefined"?globalThis:this);
