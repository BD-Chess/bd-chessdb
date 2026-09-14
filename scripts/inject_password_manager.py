#!/usr/bin/env python3
"""Deploy-time browser password-manager compatibility for MDLxDCC protected pages.

This intentionally does NOT persist credentials. It only supplies standards-based
HTML metadata so browser/OS password managers can recognise password-only unlock
forms. The visible UX remains password-only; technical usernames are offscreen,
stable, non-secret identifiers used only for credential grouping.
"""
from __future__ import annotations
import argparse, html, json, re
from pathlib import Path

VERSION = "20260914-pm1"
HELPER_TAG = '<script src="/js/bd-password-manager.js" defer></script>'
TECH_STYLE = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;padding:0;border:0;opacity:.01;pointer-events:none'
API_RE = re.compile(r'api.?key|apikey|openai|anthropic|gemini.?key|\bsk-[a-z0-9_-]*', re.I)
PW_RE = re.compile(r'<input\b[^>]*\btype\s*=\s*(["\'])password\1[^>]*>', re.I)
FORM_RE = re.compile(r'<form\b[^>]*>[\s\S]*?</form\s*>', re.I)

HELPER_JS = r'''/*
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
'''

def attr(tag,name):
    m=re.search(r'\b'+re.escape(name)+r'\s*=\s*(["\'])(.*?)\1',tag,re.I|re.S);return m.group(2) if m else ''
def is_api(tag): return bool(API_RE.search(tag))
def group_for(rel,tag):
    p='/'+rel.lower();i=attr(tag,'id').lower()
    if p=='/bd/o/index.html' or p.startswith('/bd/o/'):return 'bd-o'
    if p=='/wl/index.html' or p.startswith('/wl/'):return 'wake-lab'
    if i=='mdlpassword' or (p.startswith('/trip/') and 'mdl' in i):return 'trip-mdl'
    if '/trip/' in p and (i=='_8zp' or 'pass' in i):return 'trip-protected'
    if 'c_soul' in p:return 'bd-soul'
    if p.startswith('/aim3/'):return 'aim3-malm'
    if p.startswith('/crp/') and 'mentalarena_malm' in p:return 'crp-malm'
    if i=='shield-password':return 'mdlxdcc-technical'
    if '/8zt/bdt' in p:return 'bdt'
    for needle,group in [('bd_8z_dcc_trading','bd-8z-dcc-trading'),('bd_8z_trading_book','bd-8z-trading-book'),('sm_trader','bd-sm-trader'),('zz_trader','bd-zz-trader'),('dcc_trader','bd-dcc-trader'),('bd_8z_dcc_meta_architecture','bd-dcc-meta'),('bd_asi_origin','bd-asi-origin'),('bd_8zrp_arena','bd-8zrp')]:
        if needle in p:return group
    slug=re.sub(r'\.(?:html?|php)$','',p);slug=re.sub(r'[^a-z0-9]+','-',slug).strip('-');return 'bd-'+(slug or 'protected')
def normalize(tag):
    out=re.sub(r'\sautocomplete\s*=\s*(["\'])(?:off|new-password)\1',' autocomplete="current-password"',tag,flags=re.I)
    if not re.search(r'\sautocomplete\s*=',out,re.I):out=out[:-1]+' autocomplete="current-password">'
    if not re.search(r'\sname\s*=',out,re.I):out=out[:-1]+' name="password">'
    return out

def patch_html(path,root):
    s=path.read_text();ms=list(PW_RE.finditer(s));real=[m for m in ms if not is_api(m.group(0))]
    if not real:return False,0,len(ms)
    for m in reversed(real):s=s[:m.start()]+normalize(m.group(0))+s[m.end():]
    s=re.sub(r'(<form\b[^>]*?)\sautocomplete\s*=\s*(["\'])off\2',r'\1 autocomplete="on"',s,flags=re.I);rel=path.relative_to(root).as_posix()
    def fsub(m):
        f=m.group(0)
        if 'data-bd-pm-username="1"' in f:return f
        ps=[x.group(0) for x in PW_RE.finditer(f) if not is_api(x.group(0))]
        if not ps:return f
        g=group_for(rel,ps[0]);u=f'<input type="text" name="username" autocomplete="username" value="{html.escape(g)}" tabindex="-1" aria-hidden="true" data-bd-pm-username="1" data-bd-pm-group="{html.escape(g)}" style="{TECH_STYLE}">';pos=f.find('>')+1;return f[:pos]+u+f[pos:]
    s=FORM_RE.sub(fsub,s)
    if HELPER_TAG not in s:
        if not re.search(r'</head\s*>',s,re.I):raise RuntimeError('missing head '+rel)
        s=re.sub(r'</head\s*>',HELPER_TAG+'\n</head>',s,count=1,flags=re.I)
    path.write_text(s);return True,len(real),len(ms)-len(real)
def rep(path,old,new,label):
    s=path.read_text()
    if new in s:return
    if old not in s:raise RuntimeError(label+' missing: '+str(path))
    path.write_text(s.replace(old,new,1))
def patch_runtime(root):
    out=[];p=root/'js/trading-password-shield.js';old='<form method="dialog" novalidate><h2></h2><p></p><label for="trading-password-input"></label><input id="trading-password-input" type="password" autocomplete="current-password" required>';new='<form method="dialog" novalidate autocomplete="on"><h2></h2><p></p><input type="text" name="username" autocomplete="username" value="bd-trading" tabindex="-1" aria-hidden="true" style="position:fixed;left:-10000px;top:0;width:1px;height:1px;padding:0;border:0;opacity:.01;pointer-events:none"><label for="trading-password-input"></label><input id="trading-password-input" name="password" type="password" autocomplete="current-password" autocapitalize="none" spellcheck="false" required>';rep(p,old,new,'trading');out.append(str(p.relative_to(root)))
    p=root/'BD/O/vault.js';rep(p,"  value='';input.value='';\n  const kek=","  value='';\n  const kek=",'bdo retain');rep(p,"  nativeSession.setItem(SESSION,JSON.stringify(sessionValue));nativeSession.removeItem('_bd_o_pp');\n  const next=","  nativeSession.setItem(SESSION,JSON.stringify(sessionValue));nativeSession.removeItem('_bd_o_pp');input.value='';\n  const next=",'bdo success');rep(p," }catch(err){master=null;bundle=null;eraseSession();showError("," }catch(err){input.value='';master=null;bundle=null;eraseSession();showError(",'bdo fail');out.append(str(p.relative_to(root)))
    p=root/'WL/reader.js';rep(p,"  const material=await crypto.subtle.importKey('raw',te.encode($('pw').value),'PBKDF2',false,['deriveKey']);$('pw').value='';","  const material=await crypto.subtle.importKey('raw',te.encode($('pw').value),'PBKDF2',false,['deriveKey']);",'wl retain');rep(p,"write(sessionStorage,SESSION,JSON.stringify({vault:vault.vault_id,key:w.key}));","write(sessionStorage,SESSION,JSON.stringify({vault:vault.vault_id,key:w.key}));$('pw').value='';",'wl success');rep(p," }catch(e){gate(e.message&&e.message.includes('Vir')"," }catch(e){$('pw').value='';gate(e.message&&e.message.includes('Vir')",'wl fail');out.append(str(p.relative_to(root)))
    p=root/'WL/BD/reader.js';s=p.read_text();s=s.replace("  $('pw').value='';\n  const kek=await crypto.subtle.deriveKey","  const kek=await crypto.subtle.deriveKey",1);s=s.replace("await activateWithRawKey(wrapped.key,true);","await activateWithRawKey(wrapped.key,true);$('pw').value='';",1);s=s.replace("}catch(err){","}catch(err){$('pw').value='';",1);p.write_text(s);out.append(str(p.relative_to(root)))
    for rel in ['Trip/private-client.js','Trip/new/private-client.js','Trip/old/004/private-client.js']:
        p=root/rel;s=p.read_text();s=s.replace("let password=$('mdlPassword').value;$('mdlPassword').value='';","let password=$('mdlPassword').value;",1);s=s.replace("catch(_){password='';","catch(_){password='';$('mdlPassword').value='';",1);p.write_text(s);out.append(rel)
    return out
def verify(root):
    pages=inputs=forms=noform=0;api=[];issues=[]
    for p in root.rglob('*.html'):
        s=p.read_text();allm=list(PW_RE.finditer(s));real=[m for m in allm if not is_api(m.group(0))]
        if not real:
            if allm:api.append(p.relative_to(root).as_posix())
            continue
        pages+=1;inputs+=len(real)
        if HELPER_TAG not in s:issues.append([str(p),'helper'])
        for m in real:
            if 'current-password' not in m.group(0).lower():issues.append([str(p),'autocomplete'])
            b=s[:m.start()];fs=b.lower().rfind('<form');fe=b.lower().rfind('</form')
            if fs>fe:
                forms+=1
                if 'data-bd-pm-username="1"' not in s[fs:m.start()]:issues.append([str(p),'username'])
            else:noform+=1
    helper=(root/'js/bd-password-manager.js').read_text()
    for x in ['localStorage','sessionStorage','XMLHttpRequest','sendBeacon','fetch(']:
        if x in helper:issues.append(['helper','forbidden '+x])
    if pages<52:issues.append(['inventory',pages])
    if not {'BD/BD_AIM3_RHPm.html','BD/BD_AIM3_RHPm_v1_6_1.html'}.issubset(set(api)):issues.append(['api-exclusion',api])
    if issues:raise RuntimeError(json.dumps(issues[:20]))
    return {'version':VERSION,'password_pages':pages,'password_inputs':inputs,'passwords_in_forms':forms,'runtime_associated_passwords':noform,'api_key_only_pages':sorted(api),'issues':0}
def main():
    a=argparse.ArgumentParser();a.add_argument('public',type=Path);a.add_argument('--report',type=Path);x=a.parse_args();root=x.public.resolve();(root/'js').mkdir(parents=True,exist_ok=True);(root/'js/bd-password-manager.js').write_text(HELPER_JS)
    touched=[];excluded=0
    for p in root.rglob('*.html'):
        c,n,e=patch_html(p,root);excluded+=e
        if c:touched.append(p.relative_to(root).as_posix())
    runtimes=patch_runtime(root);r=verify(root);r.update({'html_files_enhanced':len(touched),'runtime_files_enhanced':runtimes,'api_password_controls_excluded':excluded});o=x.report or root/'password-manager-compat-report.json';o.write_text(json.dumps(r,indent=2,sort_keys=True)+'\n');print(json.dumps(r,indent=2,sort_keys=True))
if __name__=='__main__':main()
