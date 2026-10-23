import {cpqPage} from './page.mjs';
const PROTOCOL='omnicpq.browser.v1', ORIGIN='https://www.mdlxdcc.org';
const CPQ=['https://cpq-stg.apps.test-ocp.ts.telekom.si','https://cpq.apps.prod-ocp.ts.telekom.si'];
const fail=code=>({ok:false,error:code});
export function assistantUrl(value){try{const u=new URL(value);return u.origin===ORIGIN && /^\/omnicpq\/(?:index\.html)?$/i.test(u.pathname) && !u.username && !u.password;}catch{return false;}}
export function cpqUrl(value){try{const u=new URL(value);return CPQ.includes(u.origin)&&/^\/sl\/(?:order|quote|dashboard)(?:\/|$)/.test(u.pathname)&&!u.username&&!u.password;}catch{return false;}}
export function makeBridgeHandler(api,now=()=>Date.now()) {
  const busy=new Set();
  return async function handle(message,sender,internal=false) {
    if(message?.protocol!==PROTOCOL)return fail('BRIDGE_INVALID_COMMAND');
    if(internal) {
      if(sender.id!==api.runtime.id || sender.url!==api.runtime.getURL('popup.html'))return fail('BRIDGE_SENDER_NOT_ALLOWED');
      if(message.type==='unpair'){await api.storage.session.remove('pair');return {ok:true};}
      if(message.type!=='pair' || !Number.isInteger(message.cpqTabId)||!Number.isInteger(message.assistantTabId) || !['order','quote'].includes(message.scope))return fail('BRIDGE_INVALID_COMMAND');
      const target=await api.tabs.get(message.cpqTabId);
      const {requests=[]}=await api.storage.session.get('requests');
      const host=requests.find(r=>r.id===message.assistantTabId && r.createdAt>now()-10*60_000);
      if(!target.active || !cpqUrl(target.url) || !host || !assistantUrl(host.url) || target.incognito)return fail('BRIDGE_TARGET_NOT_ALLOWED');
      const origin=new URL(target.url).origin;
      // activeTab is granted by the user's toolbar click on this CPQ tab.
      // Prove actual browser access without persistent host permissions.
      const probe=await api.scripting.executeScript({target:{tabId:target.id,frameIds:[0]},world:'ISOLATED',func:cpqPage,args:[{type:'observe',scope:message.scope,origin}]});
      if(!probe.find(r=>r.frameId===0)?.result?.ok)return fail('BRIDGE_PERMISSION_REQUIRED');
      const pair={targetTabId:target.id,assistantTabId:host.id,origin,scope:message.scope,token:crypto.randomUUID(),expiresAt:now()+30*60_000};
      await api.storage.session.set({pair});return {ok:true,expiresAt:pair.expiresAt};
    }
    if(!assistantUrl(sender.url) || sender.frameId!==0 || !Number.isInteger(sender.tab?.id) || sender.tab.incognito)return fail('BRIDGE_SENDER_NOT_ALLOWED');
    if(message.type==='status') {
      const {requests=[]}=await api.storage.session.get('requests');
      await api.storage.session.set({requests:[...requests.filter(r=>r.id!==sender.tab.id && r.createdAt>now()-10*60_000).slice(-9),
        {id:sender.tab.id,url:sender.url,createdAt:now()}]});
    }
    const {pair}=await api.storage.session.get('pair');
    if(!pair || pair.expiresAt<=now() || pair.assistantTabId!==sender.tab.id)return fail('BRIDGE_NOT_PAIRED');
    if(message.type==='status')return {ok:true,protocol:PROTOCOL,token:pair.token,expiresAt:pair.expiresAt,scope:pair.scope};
    if(message.token!==pair.token)return fail('BRIDGE_NOT_PAIRED');
    if(message.type==='disconnect'){await api.storage.session.remove('pair');return {ok:true};}
    if(!['observe','navigate'].includes(message.type))return fail('BRIDGE_INVALID_COMMAND');
    const target=await api.tabs.get(pair.targetTabId);
    if(!cpqUrl(target.url) || new URL(target.url).origin!==pair.origin)return fail('BRIDGE_TARGET_CHANGED');
    if(busy.has(pair.targetTabId))return fail('BRIDGE_BUSY');
    busy.add(pair.targetTabId);
    try {
      const a=message.action;
      if(message.type==='navigate' && (!a || a.schema!=='omnicpq.navigation.v1' || !/^n\d{1,3}$/.test(a.targetId) || !/^[a-f0-9]{64}$/.test(a.revision) ||
        Object.keys(a).some(k=>!['schema','observationId','revision','targetId','reason'].includes(k))))return fail('BRIDGE_INVALID_COMMAND');
      const {pair:current}=await api.storage.session.get('pair');
      if(!current || current.token!==pair.token || current.expiresAt<=now())return fail('BRIDGE_NOT_PAIRED');
      if(message.type==='navigate') {
        const key=a.observationId+':'+a.revision+':'+a.targetId;
        if(current.attempts?.includes(key))return fail('CPQ_ACTION_ALREADY_ATTEMPTED');
        await api.storage.session.set({pair:{...current,attempts:[...(current.attempts||[]).slice(-49),key]}});
      }
      const results=await api.scripting.executeScript({target:{tabId:pair.targetTabId,frameIds:[0]},world:'ISOLATED',func:cpqPage,args:[{type:message.type,scope:pair.scope,origin:pair.origin,...(a?{action:a}:{})}]});
      return results.find(r=>r.frameId===0)?.result || fail('BRIDGE_UNAVAILABLE');
    } catch {return fail(message.type==='navigate'?'CPQ_ACTION_OUTCOME_UNKNOWN':'BRIDGE_UNAVAILABLE');}
    finally {busy.delete(pair.targetTabId);}
  };
}
if(typeof chrome!=='undefined' && chrome.runtime?.onMessageExternal) {
  const handle=makeBridgeHandler(chrome);
  const listen=internal=>(message,sender,reply)=>{handle(message,sender,internal).then(reply,()=>reply(fail('BRIDGE_UNAVAILABLE')));return true;};
  chrome.runtime.onMessageExternal.addListener(listen(false));
  chrome.runtime.onMessage.addListener(listen(true));
  chrome.tabs.onRemoved.addListener(async id=>{const {pair}=await chrome.storage.session.get('pair');if(pair && [pair.targetTabId,pair.assistantTabId].includes(id))await chrome.storage.session.remove('pair');});
}
