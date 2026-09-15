/*
  BD password-manager compatibility bridge v1.0.
  Purpose: let browser/OS password managers recognise password-only unlock forms.
  Security: this script never stores, logs, hashes, transmits or persists passwords.
  It only adds standards-based username/current-password metadata in the DOM.
*/
(function () {
  'use strict';
  const VERSION = '20260914-pm1';
  const MARK = 'data-bd-pm-enhanced';
  function text(v) { return String(v || '').toLowerCase(); }
  function isApiCredential(input) {
    const probe = [input.id, input.name, input.placeholder, input.getAttribute('aria-label')].map(text).join(' ');
    return /api.?key|apikey|openai|anthropic|gemini.?key|\bsk-[a-z0-9_-]*/i.test(probe);
  }
  function isPassword(input) { return input instanceof HTMLInputElement && input.type === 'password' && !isApiCredential(input); }
  function groupFor(input) {
    const p = location.pathname.toLowerCase(), id = text(input.id);
    if (p === '/bd/o' || p.startsWith('/bd/o/')) return 'bd-o';
    if (p === '/wl' || p.startsWith('/wl/')) return 'wake-lab';
    if (id === 'mdlpassword' || (p.startsWith('/trip/') && id.includes('mdl'))) return 'trip-mdl';
    if (p.includes('/trip/') && (id === '_8zp' || id.includes('pass'))) return 'trip-protected';
    if (p.includes('c_soul')) return 'bd-soul';
    if (p.startsWith('/aim3/')) return 'aim3-malm';
    if (p.startsWith('/crp/') && p.includes('mentalarena_malm')) return 'crp-malm';
    if (id === 'shield-password') return 'mdlxdcc-technical';
    if (p.includes('/8zt/bdt')) return 'bdt';
    if (p.includes('bd_8z_dcc_trading')) return 'bd-8z-dcc-trading';
    if (p.includes('bd_8z_trading_book')) return 'bd-8z-trading-book';
    if (p.includes('sm_trader')) return 'bd-sm-trader';
    if (p.includes('zz_trader')) return 'bd-zz-trader';
    if (p.includes('dcc_trader')) return 'bd-dcc-trader';
    if (p.includes('bd_8z_dcc_meta_architecture')) return 'bd-dcc-meta';
    if (p.includes('bd_asi_origin')) return 'bd-asi-origin';
    if (p.includes('bd_8zrp_arena')) return 'bd-8zrp';
    const slug = p.replace(/\.(?:html?|php)$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return 'bd-' + (slug || 'protected');
  }
  function styleUsername(el) { el.style.cssText='position:fixed;left:-10000px;top:0;width:1px;height:1px;padding:0;border:0;opacity:.01;pointer-events:none'; }
  function addUsername(form,input,group) {
    let u=form&&form.querySelector('input[data-bd-pm-username="1"]'); if(u)return u;
    u=document.createElement('input');u.type='text';u.name='username';u.autocomplete='username';u.value=group;u.tabIndex=-1;u.setAttribute('aria-hidden','true');u.setAttribute('data-bd-pm-username','1');u.setAttribute('data-bd-pm-group',group);styleUsername(u);
    if(form)form.insertBefore(u,form.firstChild);else input.insertAdjacentElement('beforebegin',u);return u;
  }
  function formFor(input,group) {
    if(input.form)return input.form; const id='bd-pm-form-'+group.replace(/[^a-z0-9_-]/gi,'-');let f=document.getElementById(id);
    if(!f){f=document.createElement('form');f.id=id;f.autocomplete='on';f.method='post';f.action=location.pathname;f.setAttribute('data-bd-pm-virtual-form','1');f.style.cssText='position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden';document.body.appendChild(f);}input.setAttribute('form',id);return f;
  }
  function enhance(input) {
    if(!isPassword(input)||input.hasAttribute(MARK))return false;const group=groupFor(input),form=formFor(input,group);form.autocomplete='on';input.autocomplete='current-password';if(!input.name)input.name='password';input.autocapitalize='none';input.spellcheck=false;input.setAttribute('data-bd-pm-group',group);input.setAttribute(MARK,VERSION);addUsername(form,input,group);return true;
  }
  function scan(root){if(!root)return;if(root instanceof HTMLInputElement)enhance(root);if(root.querySelectorAll)root.querySelectorAll('input[type="password"]').forEach(enhance);}
  function start(){scan(document);const observer=new MutationObserver(rs=>{for(const r of rs)for(const n of r.addedNodes)if(n.nodeType===1)scan(n)});observer.observe(document.documentElement,{childList:true,subtree:true});window.BDPasswordManager=Object.freeze({version:VERSION,scan:()=>scan(document)});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
