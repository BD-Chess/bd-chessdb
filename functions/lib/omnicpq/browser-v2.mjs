import {cpqLocation} from '../../../public/OmniCPQ/browser-bridge-v2.mjs';
const BAD=()=>Object.assign(Error('INVALID_BROWSER_CONTEXT'),{code:'INVALID_BROWSER_CONTEXT',status:400});
const kinds=new Set(['checkbox','radio','switch','option','combobox','tab','menuitem','menuitemcheckbox','menuitemradio','treeitem','slider','spinbutton','select','field','link','button','control']);
function boundedString(value,max){if(typeof value!=='string'||value.length>max)throw BAD();return value;}
export function validateGuiBrowser(raw,now=Date.now()){
  if(!raw||raw.schema!=='omnicpq.gui.observation.v2')throw BAD();
  const loc=cpqLocation(raw.url),at=Date.parse(raw.capturedAt);
  if(!loc || !Number.isFinite(at)||at>now+5000||at<now-120000 || raw.scope!==raw.routeScope || !['order','quote'].includes(raw.scope)||
    !Array.isArray(raw.controls)||raw.controls.length>350||!raw.paging||!raw.viewport||typeof raw.dialogOpen!=='boolean'||typeof raw.navigationLocked!=='boolean'||
    !/^[a-f0-9-]{36}$/i.test(raw.id||'')||raw.id!==raw.observationId||!/^[a-f0-9]{64}$/.test(raw.revision||''))throw BAD();
  boundedString(raw.url,1200);boundedString(raw.title,300);boundedString(raw.text,16000);
  if(raw.documentKey!==null&&raw.documentKey!==undefined)boundedString(raw.documentKey,150);
  if(!Number.isInteger(raw.paging.offset)||raw.paging.offset<0||raw.paging.offset>5000||
    !Number.isInteger(raw.paging.limit)||raw.paging.limit<60||raw.paging.limit>350||
    !Number.isInteger(raw.paging.totalFound)||raw.paging.totalFound<0||typeof raw.paging.hasMore!=='boolean')throw BAD();
  if(![raw.viewport.width,raw.viewport.height,raw.viewport.scrollX,raw.viewport.scrollY].every(Number.isFinite) ||raw.viewport.width<100||raw.viewport.height<100||raw.viewport.width>16000||raw.viewport.height>16000)throw BAD();
  const ids=new Set();const controls=raw.controls.map(c=>{
    if(!c||!/^c\d{1,4}$/.test(c.id||'')||ids.has(c.id)||!kinds.has(c.kind)||typeof c.enabled!=='boolean'||
      typeof c.visibleInViewport!=='boolean'||!c.rect||![c.rect.x,c.rect.y,c.rect.w,c.rect.h,c.rect.cx,c.rect.cy].every(Number.isFinite)||
      Math.max(...Object.values(c.rect).map(Number).filter(Number.isFinite).map(Math.abs))>1000000)throw BAD();
    ids.add(c.id);boundedString(c.label,160);boundedString(c.inputType,32);
    if(c.value!==undefined)boundedString(c.value,320);
    if(c.checked!==undefined&&typeof c.checked!=='boolean')throw BAD();
    if(c.href!==undefined){boundedString(c.href,1200);if(!c.href.startsWith('/sl/')||c.href.startsWith('//'))throw BAD();}
    if(c.group!==undefined)boundedString(c.group,80);
    if(c.options!==undefined){if(!Array.isArray(c.options)||c.options.length>80)throw BAD();
      for(const o of c.options){boundedString(o.value,80);boundedString(o.label,80);}}
    return {id:c.id,kind:c.kind,label:c.label,enabled:c.enabled,inputType:c.inputType,rect:c.rect,visibleInViewport:c.visibleInViewport,
      ...(c.value!==undefined?{value:c.value}:{}),...(c.checked!==undefined?{checked:c.checked}:{}),
      ...(c.required!==undefined?{required:!!c.required}:{}),...(c.invalid!==undefined?{invalid:!!c.invalid}:{}),
      ...(c.href!==undefined?{href:c.href}:{}),...(c.options!==undefined?{options:c.options}:{}),...(c.group!==undefined?{group:c.group}:{})};
  });
  if(JSON.stringify(raw).length>200000)throw BAD();
  return {schema:raw.schema,id:raw.id,observationId:raw.id,revision:raw.revision,capturedAt:raw.capturedAt,url:raw.url,title:raw.title,
    text:raw.text,controls,fields:controls.filter(c=>c.value!==undefined||c.checked!==undefined).map(c=>({label:c.label,value:String(c.value??c.checked).slice(0,320)})),
    routeScope:raw.scope,scope:raw.scope,documentKey:raw.documentKey??null,dialogOpen:raw.dialogOpen,navigationLocked:raw.navigationLocked,
    paging:raw.paging,viewport:raw.viewport,environment:loc.environment,
    capabilities:raw.capabilities?.schema==='omnicpq.gui.capabilities.v2'?{
      schema:'omnicpq.gui.capabilities.v2',cdpAvailable:raw.capabilities.cdpAvailable===true,frames:'MAIN_FRAME_ONLY'}:null,
    origin:'client_reported_extension_DOM_not_server_attested'};
}
export function guiInstructions(browser){
  if(!browser)throw BAD();
  const actions='click, doubleClick, hover, contextClick, focus, scroll, drag, fill, key, check, selectNative';
  return `Povezan je NAMENSKI OmniCPQ GUI most v2. Dejansko opazovanje je uporabnikovo odjemalsko poročilo, ne strežniški dokaz. Obseg: ${browser.scope==='order'?'NAROČILA':'PONUDBE'}, okolje ${browser.environment}, dokument ${browser.documentKey??'še ni identificiran'}. Podprti tipi predlogov: ${actions}. Prenos datoteke zahteva uporabniško izbrano datoteko in ločeno UI dejanje, nikoli podatkov iz modelovega odgovora.
Izključno dejanski controls z ID cN so izvedljive tarče; tudi ikonski gumbi in +. Če manjkajo relevantne kontrole, predlagaj pomik ali naslednje opazovanje paging.offset; NIKOLI ne izmišljaj ID, CSS selectorja, URL poti, stranke, cen, količin ali vrednosti. Ne reci, da je nastavitev shranjena ali naročilo oddano, dokler sveže opazovanje in poslovno stanje tega ne potrdita.
Pri naročilu razlikuj Ponudbo za stranko od Naročila za realizacijo. Ne ustvari novega dokumenta, če uporabnik že ureja pravi dokument; ohrani documentKey. Ob odprtem dialogu obravnavaj ta dialog. Ob navigationLocked NE predlagaj odhoda, ki bi izgubil neshranjeno delo. Tipkanje/shranjevanje znotraj istega konfiguratorja je dovoljeno, če je v nalogu. Stop/Pause uporabnika ima prednost. Uporabnikova odobritev cilja pokriva običajne vmesne vnose v vodenem načinu; nepovratne/nenamerne izgube zahtevajo pregled in konkretno odobritev.
Če je naslednji korak razviden in izvedljiv, dodaj na konec odgovora NATANKO EN modelni predlog v bloku:
\`\`\`omnicpq_action
{"schema":"omnicpq.gui.action.v2","observationId":"${browser.id}","revision":"${browser.revision}","targetId":"cN iz controls","operation":"click","expectedDocument":${JSON.stringify(browser.documentKey)},"reason":"Zakaj to dejanje vodi do cilja"}
\`\`\`
Za fill dodaj "value" samo z izrecno uporabnikovo vrednostjo; za check "checked":true/false; za key "key":"Enter"; za selectNative "value" iz konkretnih options; za scroll "deltaY":600. To je predlog, ne dejanska izvedba; ob prejemu novega zaslona ponovno preveri. Brez modelnega arbitrarnega JavaScripta/CDP, sprememb drugih zavihkov ali obhoda pravic. Če nimaš podatka ali dovoljenja, povej konkretno vrzel, vendar nadaljuj vse drugo že dovoljeno delo.`;
}