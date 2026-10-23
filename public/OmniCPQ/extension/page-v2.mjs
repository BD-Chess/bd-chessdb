// OmniCPQ Full GUI R2, isolated-page evaluator. No fetch, cookies, storage or arbitrary script.
// This function is self-contained because chrome.scripting.executeScript serializes it.
export async function cpqPageV2(command) {
  const fail = code => ({ok:false,error:code});
  const allowed = ['https://cpq-stg.apps.test-ocp.ts.telekom.si','https://cpq.apps.prod-ocp.ts.telekom.si'];
  const scope = command.scope === 'quote' ? 'quote' : 'order';
  if (!allowed.includes(location.origin) || location.origin !== command.origin ||
      !/^\/sl\/(?:order|quote|dashboard)(?:\/|$)/.test(location.pathname)) return fail('CPQ_ORIGIN_NOT_ALLOWED');
  if(/^\/sl\/(?:order|quote)(?:\/|$)/.test(location.pathname) && !location.pathname.startsWith('/sl/'+scope))return fail('CPQ_ROUTE_SCOPE_CHANGED');
  const norm = v => String(v ?? '').replace(/\s+/g,' ').trim();
  const now = () => new Date().toISOString();
  const isSecret = e => /^(?:password|hidden)$/i.test(e?.type||'') || /password|geslo|token|secret|otp|enkratn|credential|api.?key|access.?key/i.test(
    [e?.name,e?.id,e?.getAttribute?.('aria-label'),e?.getAttribute?.('autocomplete')].join(' '));
  const isDisabled = e => !!(e?.disabled || e?.matches?.(':disabled') || e?.closest?.('[inert],[aria-disabled="true"],fieldset:disabled'));
  const visible = e => {
    if (!e || !e.isConnected || e.closest('[hidden],[aria-hidden="true"],[inert]')) return false;
    const r = e.getBoundingClientRect(),s=getComputedStyle(e);
    return r.width>0 && r.height>0 && s.display!=='none' && s.visibility!=='hidden' && Number(s.opacity||1)>0;
  };
  const rect = e => {const r=e.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),
    cx:Math.round(r.left+r.width/2),cy:Math.round(r.top+r.height/2)};};
  const accessible = e => {
    let n=norm(e.getAttribute('aria-label'));
    if (!n && e.getAttribute('aria-labelledby')) n=norm(e.getAttribute('aria-labelledby').split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' '));
    if (!n && e.labels?.length) n=norm([...e.labels].map(l=>l.textContent).join(' '));
    if (!n && e.id && e.ownerDocument.querySelector('label[for="'+CSS.escape(e.id)+'"]')) n=norm(e.ownerDocument.querySelector('label[for="'+CSS.escape(e.id)+'"]').textContent);
    if (!n && e.matches('[role="tab"],mat-step-header'))n=norm(e.querySelector('.mat-step-text-label')?.textContent);
    if (!n)n=norm(e.getAttribute('placeholder')||e.getAttribute('title')||e.getAttribute('mattooltip')||e.getAttribute('data-tooltip')||e.querySelector('svg title')?.textContent);
    if (!n && e.matches('input[type=submit],input[type=button]'))n=norm(e.value);
    if (!n) {const icons=[...e.querySelectorAll('mat-icon,.material-icons,.material-symbols-outlined')].map(m=>norm(m.textContent||m.getAttribute('fontIcon')));
      const clone=e.cloneNode(true);
      clone.querySelectorAll('svg,[hidden],[aria-hidden="true"],.cdk-visually-hidden,script,style').forEach(node=>node.remove());
      clone.querySelectorAll('mat-icon,.material-icons,.material-symbols-outlined').forEach(node=>node.remove());
      n=norm(clone.textContent);
      if (!n && icons.length) {
        const icon=icons[0].toLowerCase();n=/^(?:add|add_circle|add_box|plus|control_point)$/.test(icon)?'Dodaj (+)':
        /^(?:save|done|check|delete|remove|edit|close|menu|search|more_vert|arrow_back|download|upload)$/.test(icon)?'Ikona '+icon:'Ikona '+icon.slice(0,48);
      }
      if (!n && e.querySelector('svg'))n='Ikonski gumb';
    }
    if (!n)n=norm(e.getAttribute('name')||e.getAttribute('data-testid'));
    return n.slice(0,160);
  };
  const kind = e => {
    const role=e.getAttribute('role')||'';const tag=e.tagName.toLowerCase(),type=(e.getAttribute('type')||'').toLowerCase();
    if(['checkbox','radio','switch','option','combobox','tab','menuitem','menuitemcheckbox','menuitemradio','treeitem','slider','spinbutton'].includes(role)) return role;
    if(['checkbox','radio'].includes(type))return type;
    if(tag==='select')return 'select';if(tag==='textarea' || tag==='input' || e.isContentEditable || role==='textbox')return 'field';
    if(tag==='a')return 'link';if(tag==='button' || role==='button')return 'button';return 'control';
  };
  // Angular/Material overlays are outside the component DOM tree. Include all visible controls.
  const activeDialog=[...document.querySelectorAll('dialog[open],[role="dialog"],[aria-modal="true"]')].find(visible);
  const activeOverlay=[...document.querySelectorAll('.cdk-overlay-pane,[role="listbox"],[role="menu"]')].find(visible);
  const root=activeDialog||activeOverlay||document;
  const selector='button,a[href],input,textarea,select,[contenteditable="true"],[role="button"],[role="tab"],[role="combobox"],[role="option"],[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="checkbox"],[role="radio"],[role="switch"],[role="treeitem"],[role="textbox"],[role="spinbutton"],[role="slider"],[tabindex]';
  const candidates=[...root.querySelectorAll(selector)].filter(e=>visible(e)&&!isSecret(e)&&!e.matches('input[type=hidden]')&&!e.matches('option'));
  const controls=[];const refs=[];const cap=Math.max(60,Math.min(350,Number(command.limit)||180));
  const offset=Math.max(0,Math.min(5000,Number(command.offset)||0));
  let index=0;
  for(const e of candidates){
    // Ignore duplicate nested tab stops when parent is already the control.
    if(e.matches('[tabindex]') && e.closest('button,a[href],[role="button"],[role="combobox"]') && !e.matches('button,a[href],[role]'))continue;
    const k=kind(e),name=accessible(e);
    if(k==='link'){try{const u=new URL(e.getAttribute('href'),location.href);if(u.origin!==location.origin || !(u.pathname.startsWith('/sl/'+scope)||u.pathname.startsWith('/sl/dashboard')))continue;}catch{continue;}}
    if(index++<offset)continue;if(controls.length>=cap)break;
    const id='c'+(offset+controls.length),r=rect(e);
    const c={id,kind:k,label:name||('Neoznačen '+k+' #'+(offset+controls.length+1)),enabled:!isDisabled(e),
      inputType:(e.getAttribute('type')||'').slice(0,32),rect:r,visibleInViewport:r.cx>=0&&r.cy>=0&&r.cx<innerWidth&&r.cy<innerHeight};
    if(['field','combobox','select','checkbox','radio','switch','spinbutton','slider'].includes(k)) {
      if(k==='checkbox'||k==='radio'||k==='switch')c.checked=Boolean(e.checked ?? (e.getAttribute('aria-checked')==='true'));
      else {c.value=(e.type==='file'?'':norm(e.isContentEditable?e.innerText:e.value??e.getAttribute('aria-valuenow')??'')).slice(0,320);
        if(k==='select')c.options=[...e.options].slice(0,80).map(o=>({value:String(o.value).slice(0,80),label:norm(o.label).slice(0,80)}));}
      c.required=!!(e.required || e.getAttribute('aria-required')==='true');c.invalid=!!(e.matches(':invalid')||e.getAttribute('aria-invalid')==='true');
    }
    if(k==='link'){try{const u=new URL(e.getAttribute('href'),location.href);if(u.origin===location.origin)c.href=u.pathname+u.search;}catch{}}
    const tagLabel=norm(e.closest('section,form,[role="group"],mat-card')?.getAttribute('aria-label'));
    if(tagLabel)c.group=tagLabel.slice(0,80);
    controls.push(c);refs.push(e);
  }
  // Route and enabled save/confirm are conservative signals for leaving an editor.
  const dirty=/\/(?:configure|edit)(?:\/|$)/i.test(location.pathname) ||
    [...document.querySelectorAll('button,[role="button"]')].some(e=>visible(e)&&!isDisabled(e)&&/^(?:shrani|potrdi|save|submit)$/i.test(accessible(e)));
  const docMatch=location.pathname.match(/\/sl\/(?:order|quote)\/details\/view\/([^/?#]+)/);
  const documentKey=docMatch?docMatch[1]:null;
  const rawText=(activeDialog||document.body)?.innerText||'';
  const text=String(rawText).slice(0,16000);
  const current={url:location.href,title:document.title.slice(0,300),scope,documentKey,dialogOpen:!!activeDialog,navigationLocked:dirty,
    text,controls,viewport:{width:innerWidth,height:innerHeight,scrollX:scrollX,scrollY:scrollY},
    paging:{offset,limit:cap,totalFound:candidates.length,hasMore:offset+controls.length<candidates.length}};
  const encode=new TextEncoder().encode(JSON.stringify(current));
  const digest=await crypto.subtle.digest('SHA-256',encode);
  const revision=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
  if(command.type==='observe')return {ok:true,observation:{schema:'omnicpq.gui.observation.v2',observationId:crypto.randomUUID(),
    capturedAt:now(),revision,...current,capabilities:{dom:true,cdp:false,upload:false},origin:'extension_visible_DOM'}};
  if(command.type!=='prepare' && command.type!=='domApply' && command.type!=='verify')return fail('BRIDGE_INVALID_COMMAND');
  const a=command.action;
  if(!a || a.schema!=='omnicpq.gui.action.v2'||a.revision!==revision)return fail('CPQ_SCREEN_CHANGED');
  const control=controls.find(c=>c.id===a.targetId),e=control?refs[controls.indexOf(control)]:null;
  if(!e || !visible(e) || isDisabled(e))return fail('CPQ_TARGET_CHANGED');
  if(a.operation==='fill'&&!['field','combobox','spinbutton'].includes(control.kind))return fail('CPQ_INVALID_FIELD');
  if(a.operation==='check'&&!['checkbox','radio','switch'].includes(control.kind))return fail('CPQ_INVALID_CHECK');
  if(a.operation==='selectNative'&&control.kind!=='select')return fail('CPQ_INVALID_SELECT');
  if(a.operation==='upload' && !(e.tagName==='INPUT'&&e.type==='file'))return fail('CPQ_INVALID_UPLOAD');
  if(a.expectedDocument!==undefined && a.expectedDocument!==documentKey)return fail('CPQ_DOCUMENT_CHANGED');
  const at=rect(e);if(Math.abs(at.cx-control.rect.cx)>1||Math.abs(at.cy-control.rect.cy)>1)return fail('CPQ_TARGET_CHANGED');
  const label=control.label;
  const sensitive=/(?:izbriši|briši|delete|storniraj|prekliči naročilo|realiziraj|oddaj|submit|podpiši|pošlji stranki|plačaj|place order)/i.test(label);
  const unknownImpact=/^(?:Neoznačen|Ikonski gumb)/i.test(label);
  const saving=/(?:shrani|save|potrdi|confirm|ustvari|create|dodaj|add|generiraj|generate)/i.test(label);
  const leaving=dirty && (control.kind==='link' || (control.kind==='tab' && !activeDialog) ||
    ['click','doubleClick','key'].includes(a.operation)&&/(?:nazaj|zapri|zavrzi|na seznam|back|close|discard|exit)/i.test(label));
  const risk=sensitive?'irreversible':leaving?'lose_unsaved':unknownImpact?'unknown_impact':saving?'business_write':'ordinary';
  // Before execution preview exposes lose_unsaved risk; only actual dispatch checks explicit leave authorization.
  if(command.type==='prepare')return {ok:true,prepared:{schema:'omnicpq.gui.prepared.v2',targetId:a.targetId,kind:control.kind,
    label,rect:at,risk,revision,documentKey,enabled:control.enabled,value:control.value??null,checked:control.checked??null,visibleInViewport:control.visibleInViewport}};
  if(leaving && a.leaveConfirmed!==true)return fail('CPQ_UNSAVED_WORK_PROTECTED');
  // CDP preferred, with a bounded DOM fallback when enterprise policy denies debugger.
  // DOM-dispatched pointer/value events are NOT trusted hardware events and success
  // still requires a post-action observation, not a business-success assertion.
  if(command.type==='domApply') {
    if(!['click','focus','fill','check','hover','scroll','selectNative','upload','ensureVisible'].includes(a.operation))return fail('BRIDGE_DEBUGGER_UNAVAILABLE');
    if(a.operation==='click') {e.click();return {ok:true,method:'DOM_CLICK_UNTRUSTED'};}
    if(a.operation==='focus') {e.focus();return {ok:true,method:'DOM_FOCUS_UNTRUSTED'};}
    if(a.operation==='hover'){e.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));e.dispatchEvent(new MouseEvent('mouseenter',{bubbles:false}));return {ok:true,method:'DOM_HOVER_UNTRUSTED'};}
    if(a.operation==='scroll'){e.scrollBy?.({top:a.deltaY,left:a.deltaX||0,behavior:'instant'});return {ok:true,method:'DOM_SCROLL_UNTRUSTED'};}
    if(a.operation==='fill') {
      const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
      const descriptor=Object.getOwnPropertyDescriptor(proto,'value');
      if(e.isContentEditable){e.textContent=a.value;}
      else if(descriptor?.set){descriptor.set.call(e,a.value);}else return fail('CPQ_INVALID_FIELD');
      e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertReplacementText',data:a.value}));
      e.dispatchEvent(new Event('change',{bubbles:true}));
      return {ok:true,method:'DOM_VALUE_EVENTS_UNTRUSTED'};
    }
    if(a.operation==='check') {
      if(typeof a.checked!=='boolean')return fail('CPQ_INVALID_CHECK');
      if(e.checked!==undefined){if(e.checked!==a.checked)e.click();}
      else {e.setAttribute('aria-checked',String(a.checked));e.dispatchEvent(new Event('change',{bubbles:true}));}
      return {ok:true,method:'DOM_CHECK_UNTRUSTED'};
    }
    if(a.operation==='ensureVisible'){e.scrollIntoView({block:'center',inline:'nearest'});return {ok:true,method:'VIEWPORT_SCROLL'};}
    if(a.operation==='selectNative') {
      if(e.tagName!=='SELECT'||typeof a.value!=='string'||![...e.options].some(o=>o.value===a.value))return fail('CPQ_INVALID_SELECT');
      e.value=a.value;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));
      return {ok:true,method:'DOM_VALUE_EVENTS',value:e.value};
    }
    if(e.tagName!=='INPUT'||e.type!=='file'||typeof a.file?.name!=='string'||typeof a.file?.dataUrl!=='string' || a.file.dataUrl.length>2700000)return fail('CPQ_INVALID_UPLOAD');
    const b64=a.file.dataUrl.match(/^data:([\w.+-]+\/[\w.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/);if(!b64)return fail('CPQ_INVALID_UPLOAD');
    const bytes=Uint8Array.from(atob(b64[2]),ch=>ch.charCodeAt(0));if(bytes.length>2000000)return fail('CPQ_INVALID_UPLOAD');
    const dt=new DataTransfer();dt.items.add(new File([bytes],a.file.name.replace(/[\\/]/g,'_').slice(0,160),{type:b64[1]}));
    e.files=dt.files;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));
    return {ok:true,method:'USER_SELECTED_FILE',filename:e.files[0]?.name};
  }
  const value=e.isContentEditable?norm(e.innerText):e.value??null;
  return {ok:true,verified:{value,checked:e.checked??(e.getAttribute('aria-checked')==='true'),
    documentKey,revision,label,visible:visible(e),enabled:!isDisabled(e),invalid:!!(e.matches(':invalid')||e.getAttribute('aria-invalid')==='true')}};
}