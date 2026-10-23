export const BRIDGE_PROTOCOL = 'omnicpq.browser.v1';
export const BRIDGE_EXTENSION_ID = 'emoohebdiggbcppgphmdemdiakdamfnb';
export const CPQ_ORIGINS = Object.freeze({
  STAGE:'https://cpq-stg.apps.test-ocp.ts.telekom.si',
  PROD:'https://cpq.apps.prod-ocp.ts.telekom.si'
});
export function cpqLocation(value) {
  try { const u=new URL(value); const environment=Object.keys(CPQ_ORIGINS).find(k=>CPQ_ORIGINS[k]===u.origin);
    if (!environment || u.username || u.password || !/^\/sl\/(?:order|quote|dashboard)(?:\/|$)/.test(u.pathname)) return null;
    return {environment,routeScope:u.pathname.startsWith('/sl/quote')?'quote':'order',origin:u.origin};
  } catch {return null;}
}
export function navigationProposal(text, observation) {
  const blocks=[...String(text).matchAll(/```omnicpq_navigation\s*\n([\s\S]*?)```/g)];
  if(blocks.length!==1 || !observation) return null;
  try {const a=JSON.parse(blocks[0][1]);
    if(a.schema!=='omnicpq.navigation.v1' || a.observationId!==observation.id || a.revision!==observation.revision ||
      !/^n\d{1,3}$/.test(a.targetId) || typeof a.reason!=='string' || a.reason.length>500 ||
      Object.keys(a).some(k=>!['schema','observationId','revision','targetId','reason'].includes(k)) ||
      !observation.controls.some(c=>c.id===a.targetId)) return null;
    return a;
  } catch {return null;}
}
export function createBrowserBridge({runtime=globalThis.chrome?.runtime,timeoutMs=12000}={}) {
  let token=null;
  function send(type,data={}) {
    return new Promise((resolve,reject)=>{
      if(!runtime?.sendMessage) return reject(Error('BRIDGE_NOT_INSTALLED'));
      let finished=false;
      const timer=setTimeout(()=>{finished=true;reject(Error('BRIDGE_TIMEOUT'));},timeoutMs);
      try {runtime.sendMessage(BRIDGE_EXTENSION_ID,{protocol:BRIDGE_PROTOCOL,type,...data},r=>{
        if(finished)return;finished=true;clearTimeout(timer);
        if(runtime.lastError || !r) return reject(Error('BRIDGE_NOT_INSTALLED'));
        if(!r.ok) return reject(Error(r.error || 'BRIDGE_UNAVAILABLE'));
        resolve(r);
      });} catch {clearTimeout(timer);reject(Error('BRIDGE_NOT_INSTALLED'));}
    });
  }
  return {
    async connect(){const r=await send('status');token=r.token;return r;},
    async observe(){if(!token)throw Error('BRIDGE_NOT_PAIRED');return (await send('observe',{token})).observation;},
    async navigate(a){if(!token)throw Error('BRIDGE_NOT_PAIRED');return send('navigate',{token,action:a});},
    async disconnect(){const previous=token;token=null;if(previous)await send('disconnect',{token:previous});}
  };
}
