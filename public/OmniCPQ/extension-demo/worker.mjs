import {makeDemoCoreHandler} from './core-worker.mjs';
import {DEMO_PROTOCOL,DEMO_PRODUCT,DEMO_EXTENSION_ID,DEMO_POLICY,DEMO_VERSION,protection,projectDemoObservation,validateDemoAction,plain,demoError} from './privacy.mjs';
const fail=code=>({ok:false,error:code});
const finiteError=value=>typeof value==='string'&&/^(?:BRIDGE|CPQ|DEMO)_[A-Z_]{1,70}$/.test(value)?value:'DEMO_UNAVAILABLE';
export function makeDemoBridgeHandler(api,now=()=>Date.now()){
 const core=makeDemoCoreHandler(api,now),observed=new Map(),documents=new Map();
 const identify=()=>({protocol:DEMO_PROTOCOL,extensionId:DEMO_EXTENSION_ID,product:DEMO_PRODUCT,version:DEMO_VERSION,protection:protection()});
 const protect=(result,token)=>{
  if(!result?.ok){observed.delete(token);return fail(finiteError(result?.error));}
  if(result.observation){
   const safe=projectDemoObservation(result.observation,documents);
   observed.set(token,safe);
   return {ok:true,...identify(),observation:safe.wire,status:result.receipt?'OBSERVED_NOT_BUSINESS_ATTESTED':'OBSERVED'};
  }
  return {ok:true,...identify(),status:'ACKNOWLEDGED'};
 };
 return async(message,sender,internal=false)=>{
  try{
   if(api.runtime.id!==DEMO_EXTENSION_ID||!plain(message)||message.protocol!==DEMO_PROTOCOL)return fail('DEMO_BRIDGE_IDENTITY');
   const allowed=['protocol','type','identity','token','cpqTabId','assistantTabId','scope','allowWrites','action','humanApproved'];
   if(Object.keys(message).some(k=>!allowed.includes(k)))return fail('DEMO_UNKNOWN_FIELD');
   if(internal){
    if(message.type==='pair'&&(message.allowWrites!==false||message.scope!=='order'&&message.scope!=='quote'))return fail('DEMO_READ_ONLY');
    if(!['pair','unpair'].includes(message.type))return fail('DEMO_COMMAND_BLOCKED');
    observed.clear();documents.clear();
    const result=await core(message,sender,true);
    return result.ok?{ok:true,...identify(),status:'PAIR_CHANGED'}:fail(finiteError(result.error));
   }
   if(message.type==='status'){
    if(typeof message.identity!=='string'||!/^[a-f0-9-]{36}$/i.test(message.identity))return fail('DEMO_IDENTITY_REQUIRED');
    const result=await core(message,sender,false);
    if(!result.ok)return fail(finiteError(result.error));
    return {ok:true,...identify(),token:result.token,scope:result.scope,expiresAt:result.expiresAt,paused:!!result.paused};
   }
   if(!['observe','preview','execute','suspend','resume','disconnect'].includes(message.type))return fail('DEMO_COMMAND_BLOCKED');
   if(['suspend','resume','disconnect'].includes(message.type)){
    observed.delete(message.token);documents.clear();
    const result=await core(message,sender,false);
    return result.ok?{ok:true,...identify(),status:'PAIR_STATE_CHANGED'}:fail(finiteError(result.error));
   }
   if(message.type==='observe')return protect(await core({protocol:DEMO_PROTOCOL,type:'observe',token:message.token,offset:0,limit:180,query:'',framePath:''},sender,false),message.token);
   const safe=observed.get(message.token);if(!safe)return fail('DEMO_FRESH_OBSERVATION_REQUIRED');
   validateDemoAction(message.action,safe.wire);
   const a=message.action;
   if(typeof a.actionId!=='string'||!/^[a-f0-9-]{36}$/i.test(a.actionId))return fail('DEMO_ACTION_ID_REQUIRED');
   if(a.operation==='navigate'&&message.humanApproved!==true)return fail('DEMO_APPROVAL_REQUIRED');
   const translated={schema:'omnicpq.gui.action.v2',actionId:a.actionId,observationId:safe.raw.observationId,revision:safe.raw.revision,
    operation:a.operation==='read'?'read':'click',reason:'Izrecno potrjena demo navigacija',expectedDocument:safe.raw.documentKey??null};
   if(a.operation==='navigate'){
    const target=safe.mapping.get(a.targetId);if(!target)return fail('DEMO_TARGET_UNKNOWN');
    const raw=safe.raw.controls.find(c=>c.id===target);
    if(!raw||!['link','tab'].includes(raw.kind))return fail('DEMO_READ_ONLY');
    translated.targetId=target;
   }else Object.assign(translated,{offset:0,limit:180,query:'',framePath:''});
   const result=await core({protocol:DEMO_PROTOCOL,type:message.type,token:message.token,action:translated,humanApproved:a.operation==='navigate'},sender,false);
   if(message.type==='preview'){
    if(!result.ok)return fail(finiteError(result.error));
    return {ok:true,...identify(),status:'PREVIEW_ONLY',target:a.operation==='navigate'?safe.wire.controls.find(c=>c.id===a.targetId).label:'Branje'};
   }
   observed.delete(message.token);
   return protect(result,message.token);
  }catch{return fail('DEMO_PROTECTION_BLOCKED');}
 };
}
if(typeof chrome!=='undefined'&&chrome.runtime?.onMessageExternal){
 const handle=makeDemoBridgeHandler(chrome);
 const listen=internal=>(message,sender,respond)=>{handle(message,sender,internal).then(respond,()=>respond(fail('DEMO_PROTECTION_BLOCKED')));return true;};
 chrome.runtime.onMessageExternal.addListener(listen(false));chrome.runtime.onMessage.addListener(listen(true));
 chrome.tabs.onRemoved.addListener(async id=>{const {guiPair}=await chrome.storage.session.get('guiPair');if(guiPair&&[guiPair.cpqTabId,guiPair.assistantTabId].includes(id))await chrome.storage.session.remove('guiPair');});
}
