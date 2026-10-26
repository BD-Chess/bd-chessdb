// Transport and model-output validation for the new, explicitly paired GUI bridge.
// No arbitrary selectors, evaluated code, URL navigation or CDP commands from AI.
export const BRIDGE_PROTOCOL='omnicpq.gui.v2';
export const BRIDGE_EXTENSION_ID='emoohebdiggbcppgphmdemdiakdamfnb';
export const CPQ_ORIGINS=Object.freeze({STAGE:'https://cpq-stg.apps.test-ocp.ts.telekom.si',PROD:'https://cpq.apps.prod-ocp.ts.telekom.si'});
export function cpqLocation(value){try{
  const u=new URL(value),environment=Object.keys(CPQ_ORIGINS).find(k=>CPQ_ORIGINS[k]===u.origin);
  if(!environment||u.username||u.password||!/^\/sl\/(?:order|quote|dashboard)(?:\/|$)/.test(u.pathname))return null;
  return {environment,routeScope:u.pathname.startsWith('/sl/quote')?'quote':'order',origin:u.origin};
}catch{return null;}}
const ALLOWED=new Set(['click','doubleClick','hover','contextClick','focus','scroll','drag','fill','key','check','selectNative','upload','ensureVisible','read']);
const KEYS=new Set(['Enter','Tab','Escape','ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Backspace','Delete','Home','End','PageUp','PageDown','Space','Ctrl+A','Shift+Tab']);
export function navigationProposal(text,observation){
  if(!observation||observation.schema!=='omnicpq.gui.observation.v2')return null;
  const blocks=[...String(text).matchAll(/```omnicpq_action\s*\n([\s\S]*?)```/g)];
  if(blocks.length!==1)return null;
  try{
    const a=JSON.parse(blocks[0][1]);
    const keys=['schema','observationId','revision','targetId','operation','reason','value','key','checked','deltaY','deltaX','endTargetId','expectedDocument','offset','limit','query','framePath','inputMode','commit'];
    if(a.schema!=='omnicpq.gui.action.v2'||a.observationId!==observation.id||a.revision!==observation.revision||
      (a.operation!=='read'&&!/^c\d{1,4}$/.test(a.targetId))||!ALLOWED.has(a.operation)||Object.keys(a).some(k=>!keys.includes(k))||typeof a.reason!=='string'||a.reason.length>500||
      (a.operation!=='read'&&!observation.controls.some(c=>c.id===a.targetId&&c.enabled)))return null;
    if(['fill','selectNative'].includes(a.operation)&& (typeof a.value!=='string'||a.value.length>650))return null;
    if(a.operation==='key'&&!KEYS.has(a.key))return null;
    if(a.operation==='check'&&typeof a.checked!=='boolean')return null;
    if(a.operation==='scroll'&&(!Number.isFinite(a.deltaY)||Math.abs(a.deltaY)>1800||Math.abs(a.deltaX||0)>1800))return null;
    if(a.operation==='drag'&&!observation.controls.some(c=>c.id===a.endTargetId&&c.enabled&&c.visibleInViewport))return null;
    if(a.operation==='upload')return null; // Binary selected explicitly in the GUI, never model-generated.
    if(a.expectedDocument!==undefined&&a.expectedDocument!==null&&a.expectedDocument!==observation.documentKey)return null;
    if(a.offset!==undefined&&(!Number.isInteger(a.offset)||a.offset<0||a.offset>5000))return null;
    if(a.limit!==undefined&&(!Number.isInteger(a.limit)||a.limit<60||a.limit>350))return null;
    if(a.query!==undefined&&(typeof a.query!=='string'||a.query.length>160))return null;
    if(a.framePath!==undefined&&a.framePath!==''&&a.framePath!==observation.framePath&&!observation.frames?.some(f=>f.path===a.framePath&&f.accessible))return null;
    if(a.inputMode!==undefined&&!['replace','append','clear'].includes(a.inputMode))return null;
    return a;
  }catch{return null;}
}
export function createBrowserBridge({runtime=globalThis.chrome?.runtime,timeoutMs=15000}={}){
  let token=null,capabilities=null,scope=null,identity='legacy-unbound';
  function send(type,data={}){return new Promise((resolve,reject)=>{
    if(!runtime?.sendMessage)return reject(Error('BRIDGE_NOT_INSTALLED'));
    let finished=false;const timer=setTimeout(()=>{finished=true;reject(Error('BRIDGE_TIMEOUT'));},timeoutMs);
    try{runtime.sendMessage(BRIDGE_EXTENSION_ID,{protocol:BRIDGE_PROTOCOL,type,...data},r=>{
      if(finished)return;finished=true;clearTimeout(timer);
      if(runtime.lastError||!r)return reject(Error('BRIDGE_NOT_INSTALLED'));
      if(!r.ok)return reject(Error(r.error==='BRIDGE_INVALID_COMMAND'?'BRIDGE_UPDATE_REQUIRED':r.error||'BRIDGE_UNAVAILABLE'));
      resolve(r);
    });}catch{clearTimeout(timer);reject(Error('BRIDGE_NOT_INSTALLED'));}
  });}
  const adapt=o=>({...o,id:o.observationId,routeScope:o.scope,
    fields:o.controls.filter(c=>c.value!==undefined||c.checked!==undefined).map(c=>({label:c.label,value:String(c.value??c.checked??'').slice(0,500)}))});
  return {
    get capabilities(){return capabilities;},get scope(){return scope;},
    setIdentity(value){if(identity!==value){token=null;capabilities=null;scope=null;}identity=value;},
    async connect(){const r=await send('status',{identity});if(r.protocol!==BRIDGE_PROTOCOL||r.capabilities?.schema!=='omnicpq.gui.capabilities.v2'||r.capabilities.apiRevision<3||!r.capabilities.apiRevision)throw Error('BRIDGE_UPDATE_REQUIRED');
      token=r.token;capabilities=r.capabilities;scope=r.scope;return r;},
    async observe(offset=0,limit=180,query='',framePath=''){if(!token)throw Error('BRIDGE_NOT_PAIRED');const r=await send('observe',{token,offset,limit,query,framePath});
      if(r.observation?.schema!=='omnicpq.gui.observation.v2')throw Error('BRIDGE_UPDATE_REQUIRED');return adapt(r.observation);},
    async preview(a){if(!token)throw Error('BRIDGE_NOT_PAIRED');return (await send('preview',{token,action:a})).prepared;},
    async execute(a,{humanApproved=false,guidedAuthorization=false,approvalSource}={}){
      if(!token)throw Error('BRIDGE_NOT_PAIRED');const r=await send('execute',{token,action:a,humanApproved,guidedAuthorization,approvalSource});
      return {...r,...(r.observation?{observation:adapt(r.observation)}:{})};},
    async suspend(){if(token)await send('suspend',{token});},
    async resume(){if(token)await send('resume',{token});},
    async disconnect(){const old=token;token=null;capabilities=null;scope=null;if(old)await send('disconnect',{token:old});}
  };
}
