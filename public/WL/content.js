/* WL content projection v1. Public-safe synthesis only; no raw email bodies or Legacy WL plaintext. */
(()=>{'use strict';
const $=id=>document.getElementById(id),view=$('cockpit')?.dataset.view;
if(!view)return;
const ROOT='https://raw.githubusercontent.com/BD-Chess/bd-chessdb/main/public/';
const titles={A:'MDL×DCC in nove arene',B:'Odprta raziskava',C:'AI8 kontinuiteta',D:'8zMaterials',E:'Zavest, jaz, odnos in AGI',F:'MDL×DCC Frontier Scout',G:'Bridge Lab',H:'Failure Foundry'};
let data=null,busy=false,timer=null,error='';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n};
const withId=(n,id)=>{n.id=id;return n};
const local=x=>{const d=new Date(x);return Number.isFinite(d.getTime())?d.toLocaleString('sl-SI',{timeZone:'Europe/Ljubljana',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—'};
async function json(url){const r=await fetch(url+(url.includes('?')?'&':'?')+'t='+Date.now(),{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json()}
function frontierText(){if(!data?.source_frontier)return'';return Object.entries(data.source_frontier).map(([k,v])=>k+v).join(' · ')}
function sub(heading,text){const d=el('div','sub');d.append(el('h3','',heading),el('p','',text));return d}
function ensurePanel(){
 const cockpit=$('cockpit');if(!cockpit||$('contentFrontier'))return;
 const panel=el('section','panel jump');panel.id='contentFrontier';
 panel.append(el('div','eyebrow','VSEBINSKI FRONTIER'),withId(el('h2','','Kaj se v nitih razvija'),'contentTitle'),withId(el('p','',''),'contentSummary'));
 const grid=el('div','grid');
 const a=el('article','card');a.append(el('h3','','Skupni princip'),withId(el('p','',''),'contentPrinciple'));
 const b=el('article','card');b.append(el('h3','','Kaj je zdaj najbolj vredno'),withId(el('p','',''),'contentPriority'));
 grid.append(a,b);panel.append(grid,withId(el('p','notice',''),'contentBoundary'),withId(el('p','notice',''),'contentFresh'));
 if(view==='technical')panel.append(withId(el('div','summaryCards'),'contentCards'));
 cockpit.insertAdjacentElement('afterend',panel);
}
function card(x){
 const a=el('article','card');
 const head=el('div','missionHead');head.append(el('h3','',x.id+' · '+(titles[x.id]||x.id)),el('span','badge',x.status));
 a.append(head,el('p','',x.summary),el('p','outcome','Ključni premik: '+x.latest),el('p','notice','Meja: '+x.limit),el('p','notice','Naslednji korak: '+x.next));
 return a;
}
function render(){
 if($('app')?.hidden)return;ensurePanel();
 if(!data){
  if($('contentTitle'))$('contentTitle').textContent=error?'Vsebinski povzetek trenutno ni dosegljiv':'Pridobivam vsebinski povzetek …';
  if($('contentFresh'))$('contentFresh').textContent=error||'';
  return;
 }
 $('contentTitle').textContent=data.overall.title;
 $('contentSummary').textContent=data.overall.summary;
 $('contentPrinciple').textContent=data.overall.principle;
 $('contentPriority').textContent=data.overall.priority;
 $('contentBoundary').textContent=data.overall.boundary+' '+data.legacy_wl.summary;
 $('contentFresh').textContent='Kuriran vsebinski frontier '+frontierText()+' · osveženo '+local(data.generated_at)+'. Surova korespondenca ni objavljena v tej projekciji.';
 if($('contentCards'))$('contentCards').replaceChildren(...data.runs.map(card));
 for(const x of data.runs){
  const box=$('lineResearch'+x.id);if(!box)continue;
  box.replaceChildren(sub('Kako se je nit razvila',x.summary),sub('Ključni premik',x.latest),sub('Meja / najmočnejši ugovor',x.limit),sub('Naslednji razlikovalni korak',x.next),el('p','notice',x.status+' · vsebinski frontier '+x.id+data.source_frontier[x.id]));
 }
}
async function load(){
 if(busy||$('app')?.hidden)return;busy=true;error='';
 try{
  const x=await json(ROOT+'data/AMAIL_CONTENT.json');
  if(x.schema!=='amail.content.v1'||!x.overall||!Array.isArray(x.runs)||x.runs.length!==8||new Set(x.runs.map(r=>r.id)).size!==8)throw Error('Neveljavna vsebinska projekcija');
  if(data&&new Date(x.generated_at)<new Date(data.generated_at))throw Error('Zavrnjen starejši vsebinski frontier');
  data=x;
 }catch(e){error='Vsebinski povzetek ni dosegljiv: '+(e.message||e);}
 finally{busy=false;render()}
}
function clear(){data=null;error='';if($('contentCards'))$('contentCards').replaceChildren();for(const id of 'ABCDEFGH')$('lineResearch'+id)?.replaceChildren()}
function sync(){if($('app')?.hidden){clear();clearInterval(timer);timer=null;return}ensurePanel();load();if(!timer)timer=setInterval(()=>{if(!document.hidden)load()},900000)}
$('refresh')?.addEventListener('click',()=>setTimeout(load,350));
new MutationObserver(sync).observe($('app'),{attributes:true,attributeFilter:['hidden']});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!$('app')?.hidden)load()});
sync();
})();
