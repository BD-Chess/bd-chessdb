import {welcomeHost,otherProvider,providerName} from './digest.mjs';
export function newConversation() { return {version:1,welcome:'new',host:null,messages:[],drafts:{gpt:'',claude:''},selected:'gpt'}; }
export function restoreConversation(raw) {
 const s=newConversation();
 if(raw?.version!==1)return s;
 s.welcome=['new','done','stopped','skipped'].includes(raw.welcome)?raw.welcome:'stopped';
 s.host=['gpt','claude'].includes(raw.host)?raw.host:null;
 s.selected=raw.selected==='claude'?'claude':'gpt';
 for(const p of ['gpt','claude'])s.drafts[p]=String(raw.drafts?.[p]||'').slice(0,4000);
 s.messages=(Array.isArray(raw.messages)?raw.messages:[]).filter(m=>['user','assistant','notice'].includes(m?.role)&&typeof m.content==='string').slice(-40).map(m=>({role:m.role,content:m.content.slice(0,18000),provider:m.provider==='claude'?'claude':'gpt',complete:m.complete===true,sources:Array.isArray(m.sources)?m.sources.slice(0,8):[]}));
 if(s.messages.length&&s.welcome==='new')s.welcome='skipped';
 return s;
}
export function createCoordinator({state,request,persist,changed=()=>{},now=()=>new Date()}) {
 let controller=null;
 const save=()=>{const durable=persist(state);changed();return durable;};
 const notice=content=>{state.messages.push({role:'notice',content,complete:true});save();};
 const history=()=>state.messages.filter(m=>['user','assistant'].includes(m.role)&&m.complete).slice(-16).map(({role,content,provider})=>({role,content,provider}));
 async function call(provider,message,mode='chat',stage) {
  const prior=history(),answer={role:'assistant',content:'',provider,complete:false,sources:[]};
  state.messages.push(answer);save();
  const result=await request({provider,message,history:prior,mode,stage,signal:controller.signal,onDelta:delta=>{answer.content+=delta;changed();}});
  if(controller.signal.aborted)throw Error('INTERRUPTED');
  if(result.provider!==provider)throw Error('PROVIDER_MISMATCH');
  if(!answer.content.trim())throw Error('EMPTY_RESPONSE');
  answer.complete=true;answer.sources=result.sources||[];save();
 }
 async function run(work) {
  if(controller)return false;
  controller=new AbortController();changed();
  try {await work();return true;}
  catch(e){state.welcome=state.welcome==='started'?'stopped':state.welcome;notice(e.message==='INTERRUPTED'||controller.signal.aborted?'Stopped. Partial answers are excluded from shared history. No automatic retry.':`Discussion stopped: ${e.message}. No automatic retry.`);return false;}
  finally {controller=null;save();}
 }
 return {
  get busy(){return !!controller;},
  cancel(){controller?.abort();},
  async welcome(account,available) {
   if(!account||state.welcome!=='new'||controller)return false;
   // Persist the intent before any paid request. Reloads never replay it.
   state.host=welcomeHost(now());state.welcome='started';
   if(save()===false){state.welcome='stopped';notice('Tab storage is unavailable. Ask a guide to start a live discussion.');return false;}
   if(!available.gpt||!available.claude){state.welcome='stopped';notice('Both guides must be available for the welcome. You can ask an available guide directly.');return false;}
   return run(async()=>{
    const host=state.host,partner=otherProvider(host);
    await call(host,`Ask ${providerName(partner)} what is new in the public Lab.`,'lab_welcome','ask');
    await call(partner,'Discuss the one approved public update and point to its DNA project.','lab_welcome','update');
    await call(host,'Invite the visitor to choose what to explore, then wait.','lab_welcome','invite');
    state.welcome='done';
   });
  },
  async ask(text,provider,both,account,available) {
   if(controller||!account||!text.trim()||text.length>4000)return false;
   if(!available[provider]||(both&&!available[otherProvider(provider)])){notice('The selected guide is unavailable. No substitute was called.');return false;}
   if(state.welcome==='new')state.welcome='skipped';
   const question=text.trim();state.drafts[provider]='';state.messages.push({role:'user',content:question,provider,complete:true});save();
   return run(async()=>{
    await call(provider,question);
    if(both)await call(otherProvider(provider),`The visitor explicitly asks both guides, sequentially. Give your own answer to: ${question}`);
   });
  }
 };
}
