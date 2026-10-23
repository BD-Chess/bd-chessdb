import {cpqPageV2} from './page-v2.mjs';
const PROTOCOL='omnicpq.gui.v2';
const APP_ORIGIN='https://www.mdlxdcc.org';
const CPQ_ORIGINS=['https://cpq-stg.apps.test-ocp.ts.telekom.si','https://cpq.apps.prod-ocp.ts.telekom.si'];
const fail=error=>({ok:false,error});
export function assistantUrl(value){try{const u=new URL(value);return u.origin===APP_ORIGIN && /^\/omnicpq\/(?:index\.html)?$/i.test(u.pathname) && !u.username&&!u.password;}catch{return false;}}
export function cpqUrl(value){try{const u=new URL(value);return CPQ_ORIGINS.includes(u.origin)&&/^\/sl\/(?:order|quote|dashboard)(?:\/|$)/.test(u.pathname)&&!u.username&&!u.password;}catch{return false;}}
const keyNames=new Set(['Enter','Tab','Escape','ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Backspace','Delete','Home','End','PageUp','PageDown','Space','Ctrl+A','Ctrl+C','Ctrl+V','Shift+Tab']);
const operations=new Set(['click','doubleClick','hover','contextClick','focus','scroll','drag','fill','key','check','selectNative','upload','ensureVisible']);
export function validateAction(action) {
  const a=action;
  if(!a||a.schema!=='omnicpq.gui.action.v2'||typeof a.actionId!=='string'||!/^[a-f0-9-]{36}$/i.test(a.actionId)||
    typeof a.observationId!=='string'||!/^[a-f0-9-]{36}$/i.test(a.observationId)||!/^[a-f0-9]{64}$/.test(a.revision||'')||
    !/^c\d{1,4}$/.test(a.targetId||'')||!operations.has(a.operation))return false;
  if(!['string','undefined'].includes(typeof a.reason)||a.reason?.length>500||
    (a.expectedDocument!==null&&a.expectedDocument!==undefined&&typeof a.expectedDocument!=='string')||a.expectedDocument?.length>150)return false;
  if(['fill','selectNative'].includes(a.operation) && (typeof a.value!=='string'||a.value.length>650))return false;
  if(a.operation==='key'&&!keyNames.has(a.key))return false;
  if(a.operation==='check'&&typeof a.checked!=='boolean')return false;
  if(a.operation==='scroll'&&(!Number.isFinite(a.deltaY)||Math.abs(a.deltaY)>1800||Math.abs(a.deltaX||0)>1800))return false;
  if(a.operation==='drag'&&(!Number.isFinite(a.endX)||!Number.isFinite(a.endY)))return false;
  if(a.operation==='upload'&&(!a.file || typeof a.file.name!=='string'||a.file.name.length>160||typeof a.file.dataUrl!=='string'||a.file.dataUrl.length>2700000))return false;
  const whitelist=['schema','actionId','observationId','revision','targetId','operation','reason','value','key','checked','deltaY','deltaX',
    'endX','endY','expectedDocument','offset','limit','file','commit','leaveConfirmed'];
  if(Object.keys(a).some(k=>!whitelist.includes(k)))return false;
  return true;
}
const cap = Object.freeze({
  schema:'omnicpq.gui.capabilities.v2',protocol:PROTOCOL,observation:true,
  pointer:['click','doubleClick','hover','contextClick','scroll','drag','ensureVisible'],keyboard:['key','fill','focus'],
  forms:['fill','check','selectNative','upload'],execution:'CDP_WHEN_ALLOWED',
  frames:'MAIN_FRAME_ONLY',trustedCDP:'probe_required',maxBatchActions:1,
  noArbitraryJavascript:true,noArbitraryCDP:true,approvalGate:true
});
export function makeGuiBridgeHandler(api,now=()=>Date.now()){
  const busy=new Set();
  const page=async (tabId,scope,origin,type,options={})=>{
    const results=await api.scripting.executeScript({target:{tabId,frameIds:[0]},world:'ISOLATED',func:cpqPageV2,args:[{type,scope,origin,...options}]});
    return results.find(r=>r.frameId===0)?.result||fail('BRIDGE_UNAVAILABLE');
  };
  const attach=async tabId=>{if(!api.debugger?.attach||!api.debugger?.sendCommand)return null;
    const target={tabId};await api.debugger.attach(target,'1.3');return target;};
  const cdp=async(target,name,params={})=>api.debugger.sendCommand(target,name,params);
  const mouse=async(target,type,x,y,button='left',clickCount=1,buttons=0)=>cdp(target,'Input.dispatchMouseEvent',{type,x,y,button,clickCount,buttons});
  const point=async(target,r,button='left',clickCount=1)=>{
    await mouse(target,'mouseMoved',r.cx,r.cy,'none');
    await mouse(target,'mousePressed',r.cx,r.cy,button,clickCount,button==='right'?2:1);
    await mouse(target,'mouseReleased',r.cx,r.cy,button,clickCount);
  };
  const key=async(target,keyName)=>{
    const ctrl=keyName==='Ctrl+A'||keyName==='Ctrl+C'||keyName==='Ctrl+V';const shift=keyName==='Shift+Tab';
    const k=ctrl?keyName.slice(5).toLowerCase():shift?'Tab':keyName;
    const aliases={Enter:['Enter',13],Tab:['Tab',9],Escape:['Escape',27],Backspace:['Backspace',8],Delete:['Delete',46],
      Space:[' ',32],ArrowDown:['ArrowDown',40],ArrowUp:['ArrowUp',38],ArrowLeft:['ArrowLeft',37],ArrowRight:['ArrowRight',39],
      Home:['Home',36],End:['End',35],PageUp:['PageUp',33],PageDown:['PageDown',34],a:['a',65],c:['c',67],v:['v',86]};
    const [name,code]=aliases[k]||[k,0],modifiers=(ctrl?2:0)|(shift?8:0);
    const fields={key:name,code:/^[acv]$/.test(name)?'Key'+name.toUpperCase():name===' '?'Space':name,windowsVirtualKeyCode:code,nativeVirtualKeyCode:code,modifiers};
    if(ctrl)await cdp(target,'Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Control',code:'ControlLeft',windowsVirtualKeyCode:17,nativeVirtualKeyCode:17,modifiers:2});
    if(shift)await cdp(target,'Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16,nativeVirtualKeyCode:16,modifiers:8});
    await cdp(target,'Input.dispatchKeyEvent',{type:'rawKeyDown',...fields});
    if(!ctrl&&!shift && ['Enter','Space'].includes(keyName))await cdp(target,'Input.dispatchKeyEvent',{type:'char',...fields,text:k===' '?' ':k==='Enter'?'\r':''});
    await cdp(target,'Input.dispatchKeyEvent',{type:'keyUp',...fields});
    if(shift)await cdp(target,'Input.dispatchKeyEvent',{type:'keyUp',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16,nativeVirtualKeyCode:16});
    if(ctrl)await cdp(target,'Input.dispatchKeyEvent',{type:'keyUp',key:'Control',code:'ControlLeft',windowsVirtualKeyCode:17,nativeVirtualKeyCode:17});
  };
  async function act(target,action,prepared,tabId,scope,origin){
    const r=prepared.rect;
    if(!r || r.w<=0||r.h<=0||r.cx<0||r.cy<0)return fail('CPQ_TARGET_OFFSCREEN');
    if(action.operation==='ensureVisible')return page(tabId,scope,origin,'domApply',{action});
    if(!prepared.visibleInViewport)return fail('CPQ_TARGET_OFFSCREEN');
    if(['selectNative','upload'].includes(action.operation))return page(tabId,scope,origin,'domApply',{action});
    if(action.operation==='check' && prepared.checked===action.checked)return {ok:true,method:'ALREADY_MATCHES'};
    if(!target)return fail('BRIDGE_DEBUGGER_UNAVAILABLE');
    if(['click','focus','check'].includes(action.operation))await point(target,r);
    else if(action.operation==='doubleClick'){await point(target,r);await point(target,r,'left',2);}
    else if(action.operation==='contextClick')await point(target,r,'right');
    else if(action.operation==='hover')await mouse(target,'mouseMoved',r.cx,r.cy,'none');
    else if(action.operation==='scroll')await cdp(target,'Input.dispatchMouseEvent',{type:'mouseWheel',x:r.cx,y:r.cy,deltaY:action.deltaY,deltaX:action.deltaX||0});
    else if(action.operation==='drag'){
      await mouse(target,'mouseMoved',r.cx,r.cy,'none');await mouse(target,'mousePressed',r.cx,r.cy,'left',1,1);
      await mouse(target,'mouseMoved',action.endX,action.endY,'left',1,1);await mouse(target,'mouseReleased',action.endX,action.endY,'left');
    }else if(action.operation==='key'){await point(target,r);await key(target,action.key);}
    else if(action.operation==='fill'){
      await point(target,r);await key(target,'Ctrl+A');
      if(action.value)await cdp(target,'Input.insertText',{text:action.value});
      if(action.commit===true)await key(target,'Tab');
    }
    return {ok:true,method:'TRUSTED_BROWSER_CDP'};
  }
  return async function handle(message,sender,internal=false){
    if(message?.protocol!==PROTOCOL)return fail('BRIDGE_UPDATE_REQUIRED');
    if(internal){
      if(sender.id!==api.runtime.id||sender.url!==api.runtime.getURL('popup.html'))return fail('BRIDGE_SENDER_NOT_ALLOWED');
      if(message.type==='unpair'){await api.storage.session.remove('guiPair');return {ok:true};}
      if(message.type!=='pair'||!Number.isInteger(message.cpqTabId)||!Number.isInteger(message.assistantTabId)||!['order','quote'].includes(message.scope)||typeof message.allowWrites!=='boolean')return fail('BRIDGE_INVALID_COMMAND');
      const tab=await api.tabs.get(message.cpqTabId),{guiRequests=[]}=await api.storage.session.get('guiRequests');
      const host=guiRequests.find(r=>r.id===message.assistantTabId && r.createdAt>now()-600000);
      if(!tab?.active||!cpqUrl(tab.url)||!host||!assistantUrl(host.url)||tab.incognito)return fail('BRIDGE_TARGET_NOT_ALLOWED');
      const origin=new URL(tab.url).origin;
      const observed=await page(tab.id,message.scope,origin,'observe');if(!observed.ok)return fail('BRIDGE_PERMISSION_REQUIRED');
      let cdpAvailable=false;
      try {const t=await attach(tab.id);if(t){cdpAvailable=true;await api.debugger.detach(t);}}catch{cdpAvailable=false;}
      const pair={cpqTabId:tab.id,assistantTabId:host.id,origin,scope:message.scope,token:crypto.randomUUID(),
        expiresAt:now()+30*60_000,cdpAvailable,allowWrites:message.allowWrites,attempted:[],lastObserved:null};
      await api.storage.session.set({guiPair:pair});
      return {ok:true,protocol:PROTOCOL,capabilities:{...cap,cdpAvailable,allowWrites:pair.allowWrites},expiresAt:pair.expiresAt};
    }
    if(!assistantUrl(sender.url)||sender.frameId!==0||!Number.isInteger(sender.tab?.id)||sender.tab.incognito)return fail('BRIDGE_SENDER_NOT_ALLOWED');
    const {guiPair}=await api.storage.session.get('guiPair');
    if(message.type==='status'){
      const {guiRequests=[]}=await api.storage.session.get('guiRequests');
      await api.storage.session.set({guiRequests:[...guiRequests.filter(r=>r.id!==sender.tab.id&&r.createdAt>now()-600000).slice(-8),
        {id:sender.tab.id,url:sender.url,createdAt:now()}]});
    }
    if(!guiPair||guiPair.expiresAt<=now()||guiPair.assistantTabId!==sender.tab.id)return fail('BRIDGE_NOT_PAIRED');
    if(message.type==='status')return {ok:true,protocol:PROTOCOL,token:guiPair.token,scope:guiPair.scope,expiresAt:guiPair.expiresAt,capabilities:{...cap,cdpAvailable:guiPair.cdpAvailable,allowWrites:guiPair.allowWrites}};
    if(message.token!==guiPair.token)return fail('BRIDGE_NOT_PAIRED');
    if(message.type==='disconnect'){await api.storage.session.remove('guiPair');return {ok:true};}
    if(!['observe','preview','execute'].includes(message.type))return fail('BRIDGE_INVALID_COMMAND');
    let tab;try{tab=await api.tabs.get(guiPair.cpqTabId);}catch{return fail('BRIDGE_TARGET_CHANGED');}
    if(!cpqUrl(tab.url)||new URL(tab.url).origin!==guiPair.origin)return fail('BRIDGE_TARGET_CHANGED');
    if(busy.has(guiPair.cpqTabId))return fail('BRIDGE_BUSY');busy.add(guiPair.cpqTabId);
    try {
      const current=(await api.storage.session.get('guiPair')).guiPair;
      if(!current||current.token!==guiPair.token||current.expiresAt<=now())return fail('BRIDGE_NOT_PAIRED');
      if(message.type==='observe'){
        const result=await page(tab.id,guiPair.scope,guiPair.origin,'observe',{offset:message.offset,limit:message.limit});
        if(result.ok){result.observation.capabilities={...cap,cdpAvailable:current.cdpAvailable,allowWrites:current.allowWrites};
          await api.storage.session.set({guiPair:{...current,lastObserved:{id:result.observation.observationId,revision:result.observation.revision,at:now(),url:result.observation.url}}});}
        return result;
      }
      const a=message.action;
      if(!validateAction(a) || ['execute','observe'].includes(a.operation))return fail('BRIDGE_INVALID_COMMAND');
      if(message.type==='execute'&&current.attempted.includes(a.actionId))return fail('CPQ_ACTION_ALREADY_ATTEMPTED');
      if(!current.lastObserved || current.lastObserved.id!==a.observationId ||current.lastObserved.revision!==a.revision ||
        current.lastObserved.at<now()-120000 || new URL(current.lastObserved.url).origin!==guiPair.origin)return fail('CPQ_SCREEN_CHANGED');
      // Permission to write is granted only by the extension's own pairing popup, not by a client-supplied role.
      
      const pre=await page(tab.id,guiPair.scope,guiPair.origin,'prepare',{action:a,offset:a.offset,limit:a.limit});
      if(!pre.ok)return pre;
      const prepared=pre.prepared;
      if(message.type==='preview')return {ok:true,prepared};
      // Read-only pairing permits navigational tabs/links; all forms, creation and writes need extension-side opt-in.
      if(!current.allowWrites && !(['hover','scroll','ensureVisible'].includes(a.operation) ||
        (['click','doubleClick'].includes(a.operation)&&['link','tab'].includes(prepared.kind)&&prepared.risk==='ordinary')))
        return fail('CPQ_WRITE_MODE_NOT_PAIRED');
      if(['irreversible','lose_unsaved'].includes(prepared.risk) && message.humanApproved!==true)return fail('CPQ_EXPLICIT_APPROVAL_REQUIRED');
      if(prepared.risk==='business_write'&&!(message.humanApproved===true||message.guidedAuthorization===true))return fail('CPQ_WRITE_APPROVAL_REQUIRED');

      // one attempt is durably recorded BEFORE an effect. On timeout, observe; do not retry.
      const attempted=[...current.attempted.slice(-149),a.actionId];
      await api.storage.session.set({guiPair:{...current,attempted}});
      let debuggerTarget=null;
      try{
        if(!['selectNative','upload','ensureVisible'].includes(a.operation)){debuggerTarget=await attach(tab.id);if(!debuggerTarget)return fail('BRIDGE_DEBUGGER_UNAVAILABLE');}
        // Re-read DOM revision, label, document and viewport AFTER debugger attach and immediately before input.
        const checked=await page(tab.id,guiPair.scope,guiPair.origin,'prepare',{action:a,offset:a.offset,limit:a.limit});
        if(!checked.ok || checked.prepared?.label!==prepared.label || checked.prepared?.risk!==prepared.risk ||
           checked.prepared?.rect?.cx!==prepared.rect.cx || checked.prepared?.rect?.cy!==prepared.rect.cy)return fail('CPQ_SCREEN_CHANGED');
        const result=await act(debuggerTarget,a,checked.prepared,tab.id,guiPair.scope,guiPair.origin);
        if(!result.ok)return result;
        const after=await page(tab.id,guiPair.scope,guiPair.origin,'observe',{offset:a.offset,limit:a.limit});
        if(!after.ok)return fail('CPQ_ACTION_OUTCOME_UNKNOWN');
        const observedTarget=after.observation.controls.find(c=>c.id===a.targetId && c.label===prepared.label);
        const observedValueMatch=a.operation==='fill'?observedTarget?.value===a.value:
          a.operation==='check'?observedTarget?.checked===a.checked:
          a.operation==='selectNative'?observedTarget?.value===a.value:null;
        const outcome=observedValueMatch===true?'OBSERVED_UI_VALUE_MATCH':observedValueMatch===false?'OUTCOME_UNKNOWN':'OBSERVATION_AVAILABLE_NOT_BUSINESS_ATTESTED';
        // Dispatch result != business success. Expose both, never promise saved/created.
        return {ok:true,receipt:{schema:'omnicpq.gui.receipt.v2',actionId:a.actionId,at:new Date().toISOString(),
          status:result.method==='ALREADY_MATCHES'?'ALREADY_MATCHES':'DISPATCHED',method:result.method,
          target:{id:a.targetId,label:prepared.label,operation:a.operation},risk:prepared.risk,beforeRevision:a.revision,
          afterRevision:after.observation.revision,documentKey:after.observation.documentKey,
          outcome},observation:after.observation};
      }catch{return fail('CPQ_ACTION_OUTCOME_UNKNOWN');}
      finally{if(debuggerTarget)try{await api.debugger.detach(debuggerTarget);}catch{}}
    }catch{return fail('BRIDGE_UNAVAILABLE');}
    finally{busy.delete(guiPair.cpqTabId);}
  };
}
if(typeof chrome!=='undefined'&&chrome.runtime?.onMessageExternal){
  const handle=makeGuiBridgeHandler(chrome);
  const listen=internal=>(message,sender,respond)=>{handle(message,sender,internal).then(respond,()=>respond(fail('BRIDGE_UNAVAILABLE')));return true;};
  chrome.runtime.onMessageExternal.addListener(listen(false));chrome.runtime.onMessage.addListener(listen(true));
  chrome.tabs.onRemoved.addListener(async id=>{const {guiPair}=await chrome.storage.session.get('guiPair');if(guiPair&&[guiPair.cpqTabId,guiPair.assistantTabId].includes(id))await chrome.storage.session.remove('guiPair');});
}