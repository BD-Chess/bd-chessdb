// OmniCPQ Full GUI R2, isolated-page evaluator. No fetch, cookies, storage or arbitrary script.
// This function is self-contained because chrome.scripting.executeScript serializes it.
export async function cpqPageV2(command) {
  const fail = code => ({ok:false,error:code});
  const topDoc=document,topView=window;let doc=document,view=window,offsetX=0,offsetY=0;
  const framePath=String(command.framePath||'');
  if(framePath&&!/^(?:\d{1,3}\.){0,3}\d{1,3}$/.test(framePath))return fail('CPQ_FRAME_NOT_ALLOWED');
  for(const part of framePath?framePath.split('.'):[]){
    const f=doc.querySelectorAll('iframe,frame')[Number(part)];if(!f)return fail('CPQ_FRAME_CHANGED');
    const r=f.getBoundingClientRect(),style=view.getComputedStyle(f);
    if(r.width<=0||r.height<=0||style.display==='none'||style.visibility==='hidden')return fail('CPQ_FRAME_CHANGED');
    if(style.transform&&style.transform!=='none')return fail('CPQ_FRAME_TRANSFORM_UNSUPPORTED');
    try{const next=f.contentDocument;if(!next||!next.body||!['about:blank','about:srcdoc'].includes(next.URL)&&next.location.origin!==command.origin)return fail('CPQ_FRAME_NOT_ALLOWED');
      offsetX+=r.left+(f.clientLeft||0);offsetY+=r.top+(f.clientTop||0);doc=next;view=doc.defaultView;}catch{return fail('CPQ_FRAME_NOT_ALLOWED');}
  }
  const docElementAt=(x,y)=>doc.elementFromPoint?.(x-offsetX,y-offsetY);
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
  const clickable = e => e.closest('button,a,[role="button"],[role="menuitem"],[role="treeitem"],mat-card,[onclick],[data-action],.mat-mdc-card,.mat-card') || e;
  const visible = e => {
    if (!e || !e.isConnected || e.closest('[hidden],[aria-hidden="true"],[inert]')) return false;
    const r = e.getBoundingClientRect(),s=view.getComputedStyle(e);
    return r.width>0 && r.height>0 && s.display!=='none' && s.visibility!=='hidden' && Number(s.opacity||1)>0;
  };
  const rect = e => {const r=e.getBoundingClientRect();return {x:Math.round(r.x+offsetX),y:Math.round(r.y+offsetY),w:Math.round(r.width),h:Math.round(r.height),
    cx:Math.round(r.left+offsetX+r.width/2),cy:Math.round(r.top+offsetY+r.height/2)};};
  const accessible = e => {
    let n=norm(e.getAttribute('aria-label'));
    if (!n && e.getAttribute('aria-labelledby')) n=norm(e.getAttribute('aria-labelledby').split(/\s+/).map(id=>doc.getElementById(id)?.textContent||'').join(' '));
    if (!n && e.labels?.length) n=norm([...e.labels].map(l=>l.textContent).join(' '));
    if (!n && e.id && e.ownerDocument.querySelector('label[for="'+CSS.escape(e.id)+'"]')) n=norm(e.ownerDocument.querySelector('label[for="'+CSS.escape(e.id)+'"]').textContent);
    if (!n && e.matches('[role="tab"],mat-step-header'))n=norm(e.querySelector('.mat-step-text-label')?.textContent);
    if (!n)n=norm(e.getAttribute('placeholder')||e.getAttribute('title'));
    if (!n && e.matches('input[type=submit],input[type=button]'))n=norm(e.value);
    if (!n) {const clone=e.cloneNode(true);
      clone.querySelectorAll('svg,[hidden],[aria-hidden="true"],.cdk-visually-hidden,script,style').forEach(node=>node.remove());
      const icons=[...clone.querySelectorAll('mat-icon,.material-icons,.material-symbols-outlined')].map(m=>norm(m.textContent||m.getAttribute('fontIcon')));
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
    if(tag==='a')return e.hasAttribute('href')?'link':'button';if(tag==='button' || role==='button')return 'button';return 'control';
  };
  // Angular/Material overlays are outside the component DOM tree. Include all visible controls.
  const activeDialog=[...doc.querySelectorAll('dialog[open],[role="dialog"],[aria-modal="true"]')].filter(visible).at(-1);
  // Material menus/listboxes can be sibling overlays outside an active dialog.
  const roots=activeDialog?[activeDialog,...doc.querySelectorAll('.cdk-overlay-pane,[role="menu"],[role="listbox"]')].filter(visible):[doc];
  const selector='button,a,input,textarea,select,[contenteditable="true"],[role="button"],[role="tab"],[role="combobox"],[role="option"],[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="checkbox"],[role="radio"],[role="switch"],[role="treeitem"],[role="textbox"],[role="spinbutton"],[role="slider"],[tabindex],mat-card,.mat-card,.mat-mdc-card,[onclick],[data-action],mat-tree-node,mat-nested-tree-node';
  const all=[...new Set(roots.flatMap(r=>[...r.querySelectorAll(selector)]))];
  // Include semantic-looking div cards whose hit handler is registered by Angular.
  for(const e of doc.querySelectorAll('div,span'))if(visible(e)&&/pointer/.test(view.getComputedStyle(e).cursor)&&norm(e.textContent).length<220)all.push(clickable(e));
  let candidates=[...new Set(all)].filter(e=>visible(e)&&!isSecret(e)&&!e.matches('input[type=hidden]')&&!e.matches('option'));
  candidates=candidates.filter(e=>!e.matches('[tabindex],mat-icon')||!e.closest('button,a,[role="button"],[role="combobox"]')||e.matches('button,a,[role]'));
  const eligible=e=>{
    if(kind(e)==='link'){try{const u=new URL(e.getAttribute('href'),location.href);return u.origin===location.origin&&(u.pathname.startsWith('/sl/'+scope)||u.pathname.startsWith('/sl/dashboard'));}catch{return false;}}
    return true;
  };
  candidates=candidates.filter(eligible);
  const stateStamp=candidates.map(e=>[accessible(e),e.value??e.getAttribute('aria-valuenow'),e.checked,e.getAttribute('aria-expanded'),e.getAttribute('aria-selected'),isDisabled(e)]);
  if(command.query)candidates=candidates.filter(e=>norm(accessible(e)+' '+e.closest('[role="group"],mat-form-field')?.textContent).toLocaleLowerCase().includes(norm(command.query).toLocaleLowerCase()));
  const controls=[];const refs=[];const cap=Math.max(60,Math.min(350,Number(command.limit)||180));
  const offset=Math.max(0,Math.min(5000,Number(command.offset)||0));
  let index=0;
  for(const e of candidates){
    // Ignore duplicate nested tab stops when parent is already the control.
    if(e.matches('[tabindex]') && e.closest('button,a,[role="button"],[role="combobox"]') && !e.matches('button,a,[role]'))continue;
    const k=kind(e),name=accessible(e);
    if(k==='link'){try{const u=new URL(e.getAttribute('href'),location.href);if(u.origin!==location.origin || !(u.pathname.startsWith('/sl/'+scope)||u.pathname.startsWith('/sl/dashboard')))continue;}catch{continue;}}
    if(index++<offset)continue;if(controls.length>=cap)break;
    const id='c'+(offset+controls.length),r=rect(e);
    const c={id,kind:k,label:name||('Neoznačen '+k+' #'+(offset+controls.length+1)),enabled:!isDisabled(e),
      inputType:(e.getAttribute('type')||'').slice(0,32),rect:r,visibleInViewport:r.cx>=0&&r.cy>=0&&r.cx<topView.innerWidth&&r.cy<topView.innerHeight};
    if(['field','combobox','select','checkbox','radio','switch','spinbutton','slider'].includes(k)) {
      if(k==='checkbox'||k==='radio'||k==='switch')c.checked=Boolean(e.checked ?? (e.getAttribute('aria-checked')==='true'));
      else {c.value=(e.type==='file'?'':String(e.isContentEditable?e.innerText:e.value??e.getAttribute('aria-valuenow')??'')).slice(0,320);
        if(k==='select')c.options=[...e.options].slice(0,80).map(o=>({value:String(o.value).slice(0,80),label:norm(o.label).slice(0,80)}));}
      c.required=!!(e.required || e.getAttribute('aria-required')==='true');c.invalid=!!(e.matches(':invalid')||e.getAttribute('aria-invalid')==='true');
      c.constraints=Object.fromEntries(['min','max','step','minlength','maxlength','pattern'].filter(n=>e.hasAttribute(n)).map(n=>[n,e.getAttribute(n).slice(0,100)]));
      c.rangeText=name;
    }
    if(k==='link'){try{const u=new URL(e.getAttribute('href'),location.href);if(u.origin===location.origin)c.href=u.pathname+u.search;}catch{}}
    const container=e.closest('section,form,[role="group"],mat-card,mat-expansion-panel,mat-form-field');
    const tagLabel=norm(container?.getAttribute('aria-label')||container?.querySelector('legend,mat-panel-title,h2,h3,mat-label')?.textContent);
    if(tagLabel)c.group=tagLabel.slice(0,80);
    const component=norm(e.closest('[role="listbox"],mat-expansion-panel')?.querySelector('[role="option"][aria-selected="true"],mat-panel-title')?.textContent);
    if(component)c.component=component.slice(0,200);
    controls.push(c);refs.push(e);
  }
  // Route and enabled save/confirm are conservative signals for leaving an editor.
  const dirty=/\/(?:configure|edit)(?:\/|$)/i.test(location.pathname) ||
    [...doc.querySelectorAll('button,[role="button"]')].some(e=>visible(e)&&!isDisabled(e)&&/^(?:shrani|potrdi|save|submit)$/i.test(accessible(e)));
  const docMatch=location.pathname.match(/\/sl\/(?:order|quote)\/details\/view\/([^/?#]+)/);
  const documentKey=docMatch?docMatch[1]:null;
  const clone=(activeDialog||doc.body)?.cloneNode(true);
  clone?.querySelectorAll('script,style,noscript,[hidden],[aria-hidden="true"],input[type="password"],input[type="hidden"]').forEach(e=>e.remove());
  const rawText=clone?.textContent||'';
  const text=String(rawText).slice(0,16000);
  const current={url:location.href,title:topDoc.title.slice(0,300),scope,documentKey,dialogOpen:!!activeDialog,navigationLocked:dirty,
    text,controls,viewport:{width:topView.innerWidth,height:topView.innerHeight,scrollX:scrollX,scrollY:scrollY},
    framePath,frames:[...doc.querySelectorAll('iframe,frame')].filter(visible).slice(0,50).map((f)=>{const index=[...doc.querySelectorAll('iframe,frame')].indexOf(f);let accessible=false;try{accessible=!!f.contentDocument&&(['about:blank','about:srcdoc'].includes(f.contentDocument.URL)||f.contentDocument.location.origin===command.origin);}catch{}return {path:framePath?framePath+'.'+index:String(index),title:norm(f.title||f.getAttribute('aria-label')).slice(0,160),accessible};}),
    parentContext:framePath?[...topDoc.querySelectorAll('h1,h2,[role=heading]')].map(e=>norm(e.textContent)).join(' ').slice(0,500):'',
    runtime:{pageVersion:'1.2.3',apiRevision:3,transport:'ISOLATED_FUNCTION_PER_REQUEST'},
    paging:{offset,limit:cap,totalFound:candidates.length,hasMore:offset+controls.length<candidates.length,query:norm(command.query).slice(0,160)}};
  const encode=new TextEncoder().encode(JSON.stringify({...current,stateStamp}));
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
  const saving=/(?:shrani|save|potrdi|confirm|ustvari|create|dodaj|add|generiraj|generate)/i.test(label);
  const leaving=dirty && ((control.kind==='link' && e.getAttribute('href')!=='#' && !e.getAttribute('href')?.startsWith('#') && control.href!==location.pathname+location.search) || (control.kind==='tab' && !activeDialog && /^(?:Podatki|Postavke|Generiranje)$/i.test(label.replace(/^Editable\s*/,''))) ||
    ['click','doubleClick','key'].includes(a.operation)&&/(?:nazaj|zapri|zavrzi|na seznam|back|close|discard|exit)/i.test(label));
  const formSubmit=e.form?.querySelector('button[type="submit"],input[type="submit"]');
  const enterSubmit=a.operation==='key'&&a.key==='Enter'&&formSubmit&&/(?:oddaj|submit|podpiši|pošlji|place order|realiziraj)/i.test(accessible(formSubmit));
  const escapeEditor=a.operation==='key'&&a.key==='Escape'&&dirty&&![...doc.querySelectorAll('[role="menu"],[role="listbox"],.cdk-overlay-pane')].some(visible);
  const risk=sensitive||enterSubmit?'irreversible':leaving||escapeEditor?'lose_unsaved':saving?'business_write':'ordinary';
  // Before execution preview exposes lose_unsaved risk; only actual dispatch checks explicit leave authorization.
  if(command.type==='prepare'){
    let endRect;
    if(a.operation==='drag'){
      const i=controls.findIndex(c=>c.id===a.endTargetId),end=refs[i];
      if(!end||!controls[i].visibleInViewport||isDisabled(end))return fail('CPQ_TARGET_CHANGED');
      endRect=rect(end);const hit=docElementAt(endRect.cx,endRect.cy);
      if(hit&&hit!==end&&!end.contains(hit))return fail('CPQ_TARGET_COVERED');
    }
    if(control.visibleInViewport && a.operation!=='ensureVisible'){
      const hit=docElementAt(at.cx,at.cy);
      if(framePath){const outer=topDoc.elementFromPoint?.(at.cx,at.cy);if(outer&&!outer.matches('iframe,frame'))return fail('CPQ_TARGET_COVERED');}
      if(hit && hit!==e && !e.contains(hit) && !clickable(e).contains(hit))return fail('CPQ_TARGET_COVERED');
    }
    if(a.operation==='fill'&&Object.keys(control.constraints||{}).length&&a.value?.trim()!==''&&Number.isFinite(Number(a.value))){
      const v=Number(a.value),c=control.constraints;
      if(c.min!==undefined&&v<Number(c.min)||c.max!==undefined&&v>Number(c.max))return fail('UI_CONSTRAINT_CONFLICT');
    }
    return {ok:true,prepared:{schema:'omnicpq.gui.prepared.v2',targetId:a.targetId,kind:control.kind,
      label,rect:at,...(endRect?{endRect}:{}),risk,revision,documentKey,enabled:control.enabled,value:control.value??null,checked:control.checked??null,visibleInViewport:control.visibleInViewport}};
  }
  if(leaving && a.leaveConfirmed!==true)return fail('CPQ_UNSAVED_WORK_PROTECTED');
  // DOM-only native selects/check reads. Trusted keyboard/pointer input is in the extension debugger transport.
  if(command.type==='domApply') {
    if(!['selectNative','upload','ensureVisible'].includes(a.operation))return fail('BRIDGE_INVALID_COMMAND');
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
  const value=e.isContentEditable?String(e.innerText):e.value??null;
  return {ok:true,verified:{value,checked:e.checked??(e.getAttribute('aria-checked')==='true'),
    documentKey,revision,label,visible:visible(e),enabled:!isDisabled(e),invalid:!!(e.matches(':invalid')||e.getAttribute('aria-invalid')==='true')}};
}
