// Serialized into Chrome's isolated world. Only visible DOM and bounded navigation.
// No cookies, storage, fetch, arbitrary selector/code, form writes or submission.
export async function cpqPage(command) {
  const fail=code=>({ok:false,error:code});
  const allowed=['https://cpq-stg.apps.test-ocp.ts.telekom.si','https://cpq.apps.prod-ocp.ts.telekom.si'];
  if(!allowed.includes(location.origin) || location.origin!==command.origin || !/^\/sl\/(?:order|quote|dashboard)(?:\/|$)/.test(location.pathname))return fail('CPQ_ORIGIN_NOT_ALLOWED');
  const visible=e=>!e.closest('[hidden],[aria-hidden="true"]') && e.getClientRects().length>0 &&
    getComputedStyle(e).visibility!=='hidden' && getComputedStyle(e).display!=='none';
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const disabled=e=>Boolean(e.disabled || e.matches(':disabled') || e.closest('[inert],[aria-disabled="true"]'));
  const label=e=>{
    if(e.getAttribute('aria-label'))return clean(e.getAttribute('aria-label'));
    // Material steppers include hidden "Editable" badges and icon ligatures in
    // innerText. Read their actual text label, not "EditablecreatePostavke".
    const step=e.getAttribute('role')==='tab' && e.querySelector('.mat-step-text-label');
    if(step)return clean(step.textContent);
    const copy=e.cloneNode(true);
    copy.querySelectorAll('mat-icon,[hidden],[aria-hidden="true"],.material-icons,.material-symbols-outlined,.cdk-visually-hidden,svg,script,style').forEach(n=>n.remove());
    return clean(copy.textContent || e.getAttribute('title'));
  };
  // Icon-only save actions still protect an editor, but a disabled save icon
  // in the document toolbar is not evidence of pending changes.
  const actionLabel=e=>label(e) || clean([...e.querySelectorAll('mat-icon')].map(n=>n.textContent).join(' '));
  const dangerous=/(?:^|\s)(?:shrani|potrdi|oddaj|izbriši|briši|prekliči|realiziraj|ustvari|dodaj|podpiši|generiraj|zaključi|pošlji|plačaj|naroči|save|submit|delete|create|cancel)(?:\s|$)/i;
  const scope=command.scope==='quote'?'quote':'order';
  const dialog=[...document.querySelectorAll('dialog[open],[role="dialog"],[aria-modal="true"]')].find(visible);
  const root=dialog || document;
  const departureLocked=()=>/\/(?:configure|edit)(?:\/|$)/i.test(location.pathname) ||
    [...document.querySelectorAll('button,[role="button"]')].some(e=>visible(e)&&!disabled(e)&&/^(Shrani|Potrdi|Save|Submit)$/i.test(actionLabel(e)));
  const locked=departureLocked();
  const elements=[];
  for(const e of root.querySelectorAll('a[href],[role="tab"],button,[role="button"][aria-expanded]')) {
    if(elements.length>=80)break;
    if(!visible(e)||disabled(e))continue;
    if(e.matches('input,textarea,select,option') || (e.tagName==='BUTTON' && e.form && e.type==='submit'))continue;
    const name=label(e);if(!name || name.length>160 || dangerous.test(name))continue;
    const role=e.getAttribute('role');let kind,href;
    if(e.matches('a[href]')) {
      try {const u=new URL(e.getAttribute('href'),location.href);
        if(u.origin!==location.origin || !new RegExp('^/sl/'+scope+'(?:/|$)').test(u.pathname)||u.username||u.password)continue;
        href=u.href;if(locked)continue;kind='link';
      }catch{continue;}
    } else if(role==='tab' && /^(?:Podatki|(?:Editable\s+)?Postavke|Generiranje|Naročila|Ponudbe)$/i.test(name)) {
      if(locked)continue;
      if((scope==='order' && name==='Ponudbe') || (scope==='quote' && name==='Naročila'))continue;
      kind='tab';
    } else if(e.hasAttribute('aria-expanded') && (role==='button'||e.tagName==='BUTTON'))kind='expand';
    else if(!locked && e.tagName==='BUTTON' && e.getAttribute('type')!=='submit' && /^(?:Odpri|Poglej|Konfiguriraj|Postavke|Podatki)$/i.test(name))kind='view';
    else continue;
    elements.push({element:e,id:'n'+elements.length,label:name,kind,...(href?{href}:{})});
  }
  const fields=[];
  for(const e of root.querySelectorAll('input,textarea,select,[role="combobox"]')) {
    if(fields.length>=60)break;
    if(!visible(e) || ['password','hidden','file'].includes(e.type) || /password|geslo|token|secret|otp|pin|credential/i.test((e.name||'')+' '+(e.id||'')+' '+(e.autocomplete||'')))continue;
    const name=clean(e.getAttribute('aria-label') || e.labels?.[0]?.textContent || e.getAttribute('placeholder') || e.getAttribute('name'));
    if(!name)continue;
    fields.push({label:name.slice(0,100),value:clean(['checkbox','radio'].includes(e.type)?String(e.checked):e.value??e.innerText??e.textContent).slice(0,500)});
  }
  const controls=elements.map(({element,...c})=>c);
  const text=String((dialog || document.body).innerText || '').slice(0,16000);
  const raw=JSON.stringify({url:location.href,text,fields,controls,locked,dialog:Boolean(dialog),scope});
  const revision=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(b=>b.toString(16).padStart(2,'0')).join('');
  if(command.type==='navigate') {
    const a=command.action;
    if(!a || a.schema!=='omnicpq.navigation.v1' || a.revision!==revision)return fail('CPQ_SCREEN_CHANGED');
    const target=elements.find(e=>e.id===a.targetId);
    if(!target)return fail('CPQ_TARGET_NOT_ALLOWED');
    // Recheck after the asynchronous digest, immediately before dispatch.
    if(departureLocked()!==locked || !target.element.isConnected || !visible(target.element) || disabled(target.element) || label(target.element)!==target.label ||
      (target.href && target.element.href!==target.href))return fail('CPQ_SCREEN_CHANGED');
    target.element.scrollIntoView({block:'center'});
    target.element.click();
    return {ok:true,receipt:{schema:'omnicpq.click-receipt.v1',id:crypto.randomUUID(),at:new Date().toISOString(),
      outcome:'CLICK_DISPATCHED',target:{id:target.id,label:target.label,kind:target.kind},beforeRevision:revision}};
  }
  if(command.type!=='observe')return fail('BRIDGE_INVALID_COMMAND');
  return {ok:true,observation:{schema:'omnicpq.browser-observation.v1',id:crypto.randomUUID(),revision,capturedAt:new Date().toISOString(),
    url:location.href,title:document.title.slice(0,300),text,fields,controls,routeScope:scope,navigationLocked:locked,dialogOpen:Boolean(dialog),
    origin:'extension_visible_DOM'}};
}
