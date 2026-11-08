import {LAB_UPDATE,providerName} from './digest.mjs';
import {newConversation,restoreConversation,createCoordinator} from './conversation.mjs';
import {loadCatalogue} from '../ai8-entry/featured-catalog.mjs';
import {createPublicRoutes} from '../mdlxdcc-guide/routes.mjs';

// A display mode only: no auth/probe/provider request and no public guide controls.
if(new URLSearchParams(location.search).get('mode')!=='ai8-live')initLab();
function initLab(){
 const $=id=>document.getElementById(id),shell=$('lab-shell'),key='ai8-dna-lab-conversation-v1';
 let state=newConversation();try{state=restoreConversation(JSON.parse(sessionStorage.getItem(key)));}catch{}
 let account=null,usage=null,available={gpt:false,claude:false},refreshing=null,authBusy=false,register=false,catalogPromise;
 const panels=new Map(),routeMap=new Map(),routes=createPublicRoutes([]);
 const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const persist=()=>{try{sessionStorage.setItem(key,JSON.stringify(state));return true;}catch{return false;}};
 const safeLink=raw=>{try{const u=new URL(raw);return u.protocol==='https:'?u.href:null;}catch{return null;}};
 function sources(node,list){
  const links=el('div',undefined,'lab-sources');
  for(const s of list.slice(0,8)){const href=safeLink(s?.url);if(!href)continue;const a=el('a',String(s.title||'Public source'));a.href=href;a.target='_blank';a.rel='noopener noreferrer';links.append(a);}node.append(links);
 }
 function content(node,text){
  // Provider prose is data: only explicit HTTPS Markdown links become anchors.
  const p=el('p'),re=/\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)/g;let at=0;
  for(const m of text.matchAll(re)){p.append(document.createTextNode(text.slice(at,m.index)));const href=safeLink(m[2]);if(href){const a=el('a',m[1]);a.href=href;a.target='_blank';a.rel='noopener noreferrer';p.append(a);}else p.append(document.createTextNode(m[0]));at=m.index+m[0].length;}
  p.append(document.createTextNode(text.slice(at)));node.append(p);
 }
 async function catalogue(){
  if(!catalogPromise)catalogPromise=loadCatalogue().then(({items})=>{for(const item of items){try{const u=new URL(item.url,location.origin);if(u.origin!==location.origin||u.search||u.hash||!u.pathname.startsWith('/'))continue;routes.add(u.pathname);routeMap.set(u.pathname,item.id);}catch{}}});
  await catalogPromise;
 }
 async function highlight(projectId,{scroll=true}={}){
  await catalogue();
  // Only IDs actually returned by the public registered catalogue are eligible.
  if(![...routeMap.values()].includes(projectId))return false;
  const nodes=[...document.querySelectorAll('.dna-node[data-record]')],node=nodes.find(n=>n.dataset.record===projectId);
  if(!node)return false;
  for(const n of nodes)n.classList.toggle('lab-highlight',n===node);
  if(scroll){node.scrollIntoView({block:'center',behavior:'auto'});node.focus({preventScroll:true});}
  return true;
 }
 async function action(a){if(a?.type!=='show_page'||typeof a.path!=='string')return;await catalogue();const id=routeMap.get(routes.resolve(a.path));if(id)await highlight(id);}
 function projectButton(){const b=el('button','Find AI8 DNA on the strand →','lab-project');b.type='button';b.addEventListener('click',()=>highlight(LAB_UPDATE.projectId));return b;}
 for(const provider of ['gpt','claude']){
  const panel=el('section',undefined,'lab-panel');panel.dataset.provider=provider;panel.setAttribute('aria-label',providerName(provider)+' guide');
  const heading=el('h2',providerName(provider));heading.id='lab-title-'+provider;panel.setAttribute('aria-labelledby',heading.id);panel.append(heading,el('p','Public site guide · shared conversation','lab-subtitle'));
  const log=el('div',undefined,'lab-log');log.id='lab-log-'+provider;log.setAttribute('role','log');log.setAttribute('aria-label',providerName(provider)+' conversation');log.setAttribute('aria-live','polite');panel.append(log);
  const digest=el('details',undefined,'lab-digest');digest.append(el('summary','Public update · '+LAB_UPDATE.date),el('p',LAB_UPDATE.summary));sources(digest,LAB_UPDATE.sources);digest.append(projectButton());panel.append(digest);
  const form=el('form',undefined,'lab-compose'),label=el('label','Ask '+providerName(provider)),input=el('textarea');input.id='lab-input-'+provider;input.maxLength=4000;input.rows=2;input.value=state.drafts[provider];label.htmlFor=input.id;
  const actions=el('div',undefined,'lab-actions'),bothLabel=el('label',''),both=el('input');both.type='checkbox';both.id='lab-both-'+provider;bothLabel.append(both,document.createTextNode('Ask both, one after another'));
  const send=el('button','Send');send.type='submit';actions.append(bothLabel,send);form.append(label,input,actions,el('p','Live API answers: OpenAI / Anthropic. Shared history is sent to each guide you ask. Saved in this tab only.','lab-privacy'));panel.append(form);$('lab-panels').append(panel);
  panels.set(provider,{panel,log,input,both,send});
  input.addEventListener('input',()=>{state.drafts[provider]=input.value;persist();});
  form.addEventListener('submit',async event=>{event.preventDefault();if(coordinator.busy||!input.value.trim())return;if(!account){showAuth();return;}const accepted=coordinator.ask(input.value,provider,both.checked,account,available);input.value=state.drafts[provider];await accepted;});
 }
 function render(){
  for(const [provider,p] of panels){
   p.panel.dataset.active=String(state.selected===provider);p.send.disabled=coordinator.busy||authBusy;p.both.disabled=coordinator.busy;p.log.setAttribute('aria-busy',String(coordinator.busy));
   const nearEnd=p.log.scrollHeight-p.log.clientHeight-p.log.scrollTop<40,previous=p.log.scrollTop;
   p.log.replaceChildren();
   if(!state.messages.length){const intro=el('article',undefined,'lab-message');intro.append(el('small','Prepared introduction · no model call'));content(intro,provider==='gpt'?'Welcome to BD × AI Lab. Explore the DNA in the center, or sign in to talk with both guides.':`Our public update (${LAB_UPDATE.date}): ${LAB_UPDATE.summary}`);if(provider==='claude'){sources(intro,LAB_UPDATE.sources);intro.append(projectButton());}p.log.append(intro);}
   for(const m of state.messages){if(m.role==='assistant'&&m.provider!==provider)continue;const article=el('article',undefined,'lab-message'+(!m.complete?' incomplete':''));article.dataset.role=m.role;article.append(el('small',m.role==='assistant'?providerName(m.provider)+' · model generated'+(!m.complete?' · incomplete':''):m.role==='user'?'You → '+providerName(m.provider):'Discussion status'));content(article,m.content||'…');sources(article,m.sources||[]);p.log.append(article);}
   p.log.scrollTop=nearEnd?p.log.scrollHeight:previous;
  }
  document.querySelectorAll('[data-lab-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.labTab===state.selected)));
  $('lab-new').disabled=coordinator.busy||authBusy;$('lab-account').disabled=coordinator.busy||authBusy;$('lab-stop').hidden=!coordinator.busy;
  $('lab-account').textContent=account?'Sign out':'Sign in';
  $('lab-status').textContent=coordinator.busy?'One bounded turn in progress…':account?`${account.role==='owner'?'BD · existing owner rules':'Signed in'}${usage&&!usage.exempt?' · Public pool $'+Number(usage.spent+usage.reserved).toFixed(2)+' / $'+Number(usage.limit).toFixed(0):''}`:'Prepared introduction · sign in for live discussion';
 }
 async function request({signal,onDelta,...body}){
  const timeout=AbortSignal.timeout(56000),combined=AbortSignal.any([signal,timeout]);
  const r=await fetch('/.netlify/functions/mdlxdcc-guide',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,mode:body.mode==='chat'?'lab_chat':body.mode,language:document.documentElement.lang==='sl'?'sl':'en',page:{path:'/ai8-dna-v4.html',title:'AI8 DNA',excerpt:LAB_UPDATE.summary,verified:true}}),signal:combined});
  if(!r.ok||!r.headers.get('content-type')?.includes('text/event-stream')){let code='AI_UNAVAILABLE';try{code=(await r.json()).error?.code||code;}catch{}if(code==='AUTH_REQUIRED')account=null;throw Error(code);}
  const reader=r.body.getReader(),decoder=new TextDecoder();let buffer='',result=null;const actions=[];
  try{for(;;){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let at;while((at=buffer.indexOf('\n\n'))>=0){const part=buffer.slice(0,at);buffer=buffer.slice(at+2);if(!part.startsWith('data: '))continue;const e=JSON.parse(part.slice(6));if(e.type==='delta')onDelta(String(e.text));if(e.type==='error')throw Error(e.code||'ANSWER_UNAVAILABLE');if(e.type==='done')result=e;if(e.type==='action')actions.push(e);}}}
  finally{await reader.cancel().catch(()=>{});}
  if(!result)throw Error('INCOMPLETE_RESPONSE');
  for(const a of actions.slice(-1))await action(a);
  if(body.mode==='lab_welcome'&&body.stage==='update')await highlight(LAB_UPDATE.projectId,{scroll:false});
  return result;
 }
 const coordinator=createCoordinator({state,request,persist,changed:render});
 async function refresh(){
  if(refreshing)return refreshing;
  refreshing=(async()=>{
   const results=await Promise.allSettled([
    fetch('/.netlify/functions/mdlxdcc-guide',{cache:'no-store',signal:AbortSignal.timeout(12000)}).then(r=>r.ok?r.json():null),
    fetch('/.netlify/functions/mdlxdcc-guide-auth',{cache:'no-store',signal:AbortSignal.timeout(12000)}).then(r=>r.ok?r.json():null)
   ]);
   const [probe,auth]=results.map(r=>r.status==='fulfilled'?r.value:null);
   available={gpt:probe?.providers?.gpt?.available===true,claude:probe?.providers?.claude?.available===true};account=auth?.authenticated?auth.account:null;usage=auth?.usage||null;render();
   if(!shell.hidden)await coordinator.welcome(account,available);
  })().finally(()=>{refreshing=null;});return refreshing;
 }
 function setOpen(open){shell.hidden=!open;$('lab-toggle').setAttribute('aria-expanded',String(open));document.body.classList.toggle('lab-open',open);if(open){refresh();catalogue();}else $('lab-toggle').focus({preventScroll:true});}
 $('lab-toggle').addEventListener('click',()=>setOpen(shell.hidden));$('lab-close').addEventListener('click',()=>setOpen(false));
 $('lab-stop').addEventListener('click',()=>coordinator.cancel());
 $('lab-new').addEventListener('click',()=>{if(coordinator.busy)return;Object.assign(state,newConversation());for(const p of panels.values())p.input.value='';persist();render();coordinator.welcome(account,available);});
 document.querySelectorAll('[data-lab-tab]').forEach(b=>b.addEventListener('click',()=>{state.selected=b.dataset.labTab;persist();render();}));
 function showAuth(){if(authBusy)return;$('lab-auth-error').textContent='';$('lab-auth').showModal();$('lab-email').focus();}
 $('lab-auth-close').addEventListener('click',()=>$('lab-auth').close());
 $('lab-auth').addEventListener('close',()=>{$('lab-password').value='';$('lab-email').value='';});
 $('lab-auth-mode').addEventListener('click',()=>{register=!register;$('lab-auth-title').textContent=register?'Create a site guide account':'Sign in for live discussion';$('lab-auth-submit').textContent=register?'Create account':'Sign in';$('lab-auth-mode').textContent=register?'Use existing account':'Create account';$('lab-password').minLength=register?8:1;$('lab-password').autocomplete=register?'new-password':'current-password';});
 async function auth(action,details={}){
  if(authBusy||coordinator.busy)return;authBusy=true;render();$('lab-auth-submit').disabled=true;$('lab-auth-mode').disabled=true;
  try{const r=await fetch('/.netlify/functions/mdlxdcc-guide-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...details}),signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok)throw Error(d.error?.code||'AUTH_UNAVAILABLE');account=d.authenticated?d.account:null;usage=d.usage||null;$('lab-auth').close();}
  catch(e){$('lab-auth-error').textContent='Account request failed: '+e.message;}
  finally{$('lab-password').value='';authBusy=false;$('lab-auth-submit').disabled=false;$('lab-auth-mode').disabled=false;render();}
  if(account)await coordinator.welcome(account,available);
 }
 $('lab-account').addEventListener('click',()=>account?auth('logout'):showAuth());
 $('lab-auth-form').addEventListener('submit',e=>{e.preventDefault();auth(register?'register':'login',{email:$('lab-email').value,password:$('lab-password').value});});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!shell.hidden&&!$('lab-auth').open&&!e.defaultPrevented){setOpen(false);}});
 function viewport(){const v=visualViewport;document.documentElement.style.setProperty('--lab-keyboard',Math.max(0,innerHeight-(v?.height||innerHeight)-(v?.offsetTop||0))+'px');}
 visualViewport?.addEventListener('resize',viewport);visualViewport?.addEventListener('scroll',viewport);window.addEventListener('resize',viewport);
 window.addEventListener('pagehide',()=>{coordinator.cancel();persist();});
 render();viewport();
}
